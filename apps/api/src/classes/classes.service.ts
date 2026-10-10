import { Injectable } from '@nestjs/common';
import type { AssignmentRole, ClassStatus } from '@school-management/database';
import { Clock, ruleViolationError, validationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import { IdentityClient } from '../authentication/identity-client.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { conflictOnDuplicate, notFoundError } from '../common/request-fields.js';
import { CatalogAccess } from '../catalogs/catalog-access.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';

// Lớp học và phân công giáo viên (P02-05, BR-02, YCTD-44)
export interface ClassRecord {
  id: string;
  org_unit_id: string;
  academic_year_id: string;
  code: string;
  name: string;
  grade_level: string;
  room_id: string | null;
  max_size: number;
  status: ClassStatus;
}

export interface StaffAssignment {
  id: string;
  class_id: string;
  staff_user_id: string;
  staff_name: string;
  assignment_role: AssignmentRole;
  subject_name: string | null;
  from_date: string;
  to_date: string | null;
  status: 'active' | 'ended';
}

export interface ClassInput {
  org_unit_id: string;
  code: string;
  name: string;
  grade_level: string;
  room_id: string | null;
  max_size: number;
}

export type ClassChanges = Partial<Omit<ClassInput, 'org_unit_id'>> & { status?: ClassStatus };

export interface AssignmentInput {
  staff_user_id: string;
  assignment_role: AssignmentRole;
  subject_name: string | null;
  from_date: string | null;
}

const CLASS_COLUMNS = [
  'id',
  'org_unit_id',
  'academic_year_id',
  'code',
  'name',
  'grade_level',
  'room_id',
  'max_size',
  'status',
] as const;
const ASSIGNMENT_COLUMNS = [
  'id',
  'class_id',
  'staff_user_id',
  'staff_name',
  'assignment_role',
  'subject_name',
  'from_date',
  'to_date',
  'status',
] as const;
const PERMISSION = PERMISSION_CODES.classManage;
// Giáo viên chủ nhiệm là VT-07, giáo viên bộ môn là VT-08 (YCTD-44)
const ROLE_OF_ASSIGNMENT: Record<AssignmentRole, string> = { homeroom: 'VT-07', subject: 'VT-08' };
const DUPLICATE_CODE_MESSAGE = 'Mã lớp đã có trong đơn vị';
const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

@Injectable()
export class ClassesService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly catalogAccess: CatalogAccess,
    private readonly identityClient: IdentityClient,
    private readonly clock: Clock,
  ) {}

  // Ai có vai trò ở đơn vị đều xem được lớp; mine là các lớp mình đang được phân công
  async list(
    currentUser: CurrentUser,
    filter: { orgUnitId?: string; status?: ClassStatus; gradeLevel?: string; mine: boolean },
  ): Promise<Array<ClassRecord & { enrolled_count: number; staff: StaffAssignment[] }>> {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return [];
    }
    let query = current.database.selectFrom('classes').select(CLASS_COLUMNS);
    if (filter.mine) {
      query = query.where('id', 'in', (subquery) =>
        subquery
          .selectFrom('class_staff_assignments')
          .select('class_id')
          .where('staff_user_id', '=', currentUser.id)
          .where('status', '=', 'active'),
      );
    } else {
      const scope = await this.organizationScopes.resolveAnyRole(currentUser);
      if (filter.orgUnitId) {
        await this.organizationScopes.assertCanAccessAnyRole(currentUser, filter.orgUnitId);
        query = query.where('org_unit_id', '=', filter.orgUnitId);
      } else if (!scope.wholeSchool) {
        query = query.where('org_unit_id', 'in', this.catalogAccess.unitFilter(scope) ?? []);
      }
    }
    if (filter.status) {
      query = query.where('status', '=', filter.status);
    }
    if (filter.gradeLevel) {
      query = query.where('grade_level', '=', filter.gradeLevel);
    }
    const classes = await query.orderBy('code').execute();
    if (classes.length === 0) {
      return [];
    }
    const assignments = await current.database
      .selectFrom('class_staff_assignments')
      .select(ASSIGNMENT_COLUMNS)
      .where(
        'class_id',
        'in',
        classes.map((row) => row.id),
      )
      .where('status', '=', 'active')
      .orderBy('assignment_role')
      .orderBy('staff_name')
      .execute();
    // Sĩ số đang học để chọn lớp khi duyệt hồ sơ và chuyển lớp (QT-01 mục 11)
    const counts = await current.database
      .selectFrom('class_enrollments')
      .select(['class_id', (expression) => expression.fn.countAll<string>().as('count')])
      .where(
        'class_id',
        'in',
        classes.map((row) => row.id),
      )
      .where('is_current', '=', true)
      .groupBy('class_id')
      .execute();
    return classes.map((row) => ({
      ...row,
      enrolled_count: Number(counts.find((count) => count.class_id === row.id)?.count ?? 0),
      staff: assignments.filter((item) => item.class_id === row.id),
    }));
  }

  async create(currentUser: CurrentUser, input: ClassInput, origin: ChangeOrigin): Promise<ClassRecord> {
    const database = await this.catalogAccess.writableDatabase(currentUser, PERMISSION, input.org_unit_id);
    const { academicYearId } = await this.currentSchoolYear.require();
    await this.assertGradeLevel(input.grade_level);
    if (input.room_id) {
      await this.assertRoom(input.org_unit_id, input.room_id);
    }
    return conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const created = await transaction
          .insertInto('classes')
          .values({ ...input, academic_year_id: academicYearId, created_by: origin.actorUserId })
          .returning(CLASS_COLUMNS)
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: created.org_unit_id,
          entityName: 'classes',
          entityId: created.id,
          action: 'create',
          before: null,
          after: created,
        });
        return created;
      }),
      DUPLICATE_CODE_MESSAGE,
      'code',
    );
  }

  async update(
    currentUser: CurrentUser,
    classId: string,
    changes: ClassChanges,
    origin: ChangeOrigin,
  ): Promise<ClassRecord> {
    const existing = await this.find(classId);
    const database = await this.catalogAccess.writableDatabase(currentUser, PERMISSION, existing.org_unit_id);
    // Không đóng được lớp còn trẻ đang học (BR-02)
    if (changes.status === 'closed' && existing.status === 'active') {
      const enrolled = await database
        .selectFrom('class_enrollments')
        .select('id')
        .where('class_id', '=', classId)
        .where('is_current', '=', true)
        .executeTakeFirst();
      if (enrolled) {
        throw ruleViolationError('BR-02', 'Lớp còn trẻ đang học; chuyển trẻ sang lớp khác trước khi đóng lớp');
      }
    }
    if (changes.grade_level !== undefined && changes.grade_level !== existing.grade_level) {
      await this.assertGradeLevel(changes.grade_level);
    }
    if (changes.room_id && changes.room_id !== existing.room_id) {
      await this.assertRoom(existing.org_unit_id, changes.room_id);
    }
    return conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const updated = await transaction
          .updateTable('classes')
          .set({ ...changes, updated_at: this.clock.now() })
          .where('id', '=', classId)
          .returning(CLASS_COLUMNS)
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: existing.org_unit_id,
          entityName: 'classes',
          entityId: classId,
          action: 'update',
          before: existing,
          after: updated,
        });
        return updated;
      }),
      DUPLICATE_CODE_MESSAGE,
      'code',
    );
  }

  async listAssignments(currentUser: CurrentUser, classId: string): Promise<StaffAssignment[]> {
    const existing = await this.find(classId);
    await this.organizationScopes.assertCanAccessAnyRole(currentUser, existing.org_unit_id);
    const { database } = await this.currentSchoolYear.require();
    return database
      .selectFrom('class_staff_assignments')
      .select(ASSIGNMENT_COLUMNS)
      .where('class_id', '=', classId)
      .orderBy('status')
      .orderBy('assignment_role')
      .orderBy('from_date', 'desc')
      .execute();
  }

  // Người được phân công phải có đúng vai trò ở đơn vị của lớp, kiểm tra qua dịch vụ định danh
  async addAssignment(
    currentUser: CurrentUser,
    accessToken: string,
    classId: string,
    input: AssignmentInput,
    origin: ChangeOrigin,
  ): Promise<StaffAssignment> {
    const existing = await this.find(classId);
    const database = await this.catalogAccess.writableDatabase(currentUser, PERMISSION, existing.org_unit_id);
    if (existing.status !== 'active') {
      throw ruleViolationError('BR-02', 'Lớp đã đóng, không phân công thêm giáo viên');
    }
    const roleCode = ROLE_OF_ASSIGNMENT[input.assignment_role];
    const staff = (await this.identityClient.listStaff(accessToken, roleCode, existing.org_unit_id)).find(
      (entry) => entry.user_id === input.staff_user_id,
    );
    if (!staff) {
      throw validationError([
        {
          field: 'staff_user_id',
          message:
            input.assignment_role === 'homeroom'
              ? 'Người được chọn không có vai trò giáo viên chủ nhiệm ở đơn vị của lớp'
              : 'Người được chọn không có vai trò giáo viên bộ môn ở đơn vị của lớp',
        },
      ]);
    }
    return conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const created = await transaction
          .insertInto('class_staff_assignments')
          .values({
            class_id: classId,
            staff_user_id: staff.user_id,
            staff_name: staff.full_name,
            assignment_role: input.assignment_role,
            subject_name: input.assignment_role === 'subject' ? input.subject_name : null,
            from_date: input.from_date ?? VIETNAM_DATE.format(this.clock.now()),
            created_by: origin.actorUserId,
          })
          .returning(ASSIGNMENT_COLUMNS)
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: existing.org_unit_id,
          entityName: 'class_staff_assignments',
          entityId: created.id,
          action: 'create',
          before: null,
          after: created,
        });
        return created;
      }),
      'Người này đang được phân công vào lớp với cùng vai trò',
      'staff_user_id',
    );
  }

  async endAssignment(
    currentUser: CurrentUser,
    classId: string,
    assignmentId: string,
    toDate: string | null,
    origin: ChangeOrigin,
  ): Promise<StaffAssignment> {
    const existing = await this.find(classId);
    const database = await this.catalogAccess.writableDatabase(currentUser, PERMISSION, existing.org_unit_id);
    const assignment = await database
      .selectFrom('class_staff_assignments')
      .select(ASSIGNMENT_COLUMNS)
      .where('id', '=', assignmentId)
      .where('class_id', '=', classId)
      .executeTakeFirst();
    if (!assignment) {
      throw notFoundError('Không tìm thấy phân công', 'class_staff_assignment');
    }
    if (assignment.status === 'ended') {
      return assignment;
    }
    const endDate = toDate ?? VIETNAM_DATE.format(this.clock.now());
    if (endDate < assignment.from_date) {
      throw validationError([{ field: 'to_date', message: 'Ngày kết thúc không trước ngày bắt đầu' }]);
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('class_staff_assignments')
        .set({ status: 'ended', to_date: endDate, updated_at: this.clock.now() })
        .where('id', '=', assignmentId)
        .returning(ASSIGNMENT_COLUMNS)
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: existing.org_unit_id,
        entityName: 'class_staff_assignments',
        entityId: assignmentId,
        action: 'update',
        before: assignment,
        after: updated,
      });
      return updated;
    });
  }

  private async find(classId: string): Promise<ClassRecord> {
    const { database } = await this.currentSchoolYear.require();
    const existing = await database
      .selectFrom('classes')
      .select(CLASS_COLUMNS)
      .where('id', '=', classId)
      .executeTakeFirst();
    if (!existing) {
      throw notFoundError('Không tìm thấy lớp', 'class');
    }
    return existing;
  }

  private async assertGradeLevel(code: string): Promise<void> {
    const { database } = await this.currentSchoolYear.require();
    const level = await database
      .selectFrom('grade_levels')
      .select('status')
      .where('code', '=', code)
      .executeTakeFirst();
    if (!level || level.status !== 'active') {
      throw validationError([{ field: 'grade_level', message: 'Bậc học không có hoặc đã ngừng sử dụng' }]);
    }
  }

  // Phòng học phải đang dùng và cùng đơn vị với lớp (CT-105)
  private async assertRoom(orgUnitId: string, roomId: string): Promise<void> {
    const { database } = await this.currentSchoolYear.require();
    const room = await database
      .selectFrom('rooms')
      .select(['org_unit_id', 'status'])
      .where('id', '=', roomId)
      .executeTakeFirst();
    if (!room || room.status !== 'active') {
      throw validationError([{ field: 'room_id', message: 'Phòng học không có hoặc đã ngừng sử dụng' }]);
    }
    if (room.org_unit_id !== orgUnitId) {
      throw ruleViolationError('P01-11', 'Phòng học thuộc đơn vị khác với lớp');
    }
  }
}
