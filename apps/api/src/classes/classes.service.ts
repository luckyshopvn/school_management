import { Injectable } from '@nestjs/common';
import type { AssignmentRole, ClassAgeGroup, ClassStatus, SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, validationError } from '@school-management/server';
import { PERMISSION_CODES, classStageOf } from '@school-management/shared';
import { sql, type Kysely, type Transaction } from 'kysely';
import { IdentityClient } from '../authentication/identity-client.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { conflictOnDuplicate, notFoundError } from '../common/request-fields.js';
import { CatalogAccess } from '../catalogs/catalog-access.js';
import { buildStudentWorkbook, fileStamp } from '../children/student-workbook.js';
import type { TableFileFormat } from '../exports/table-file.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { classAgeGroup } from '../statistics/statistics-calc.js';
import { CLASS_EXPORT_COLUMNS, matchesClassFilter, type ClassListFilter, type ClassListRow } from './class-list.js';

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
  // Thông tin lớp theo Sở (DT-15 phần 15b, YCTD-111); age_group trống là theo bậc học
  age_group: ClassAgeGroup | null;
  sort_order: number | null;
  two_sessions_per_day: boolean;
  mixed_age_count: number | null;
  is_combined: boolean;
  combined_into_class_id: string | null;
  boarding: boolean;
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
  age_group: ClassAgeGroup | null;
  sort_order: number | null;
  two_sessions_per_day: boolean;
  mixed_age_count: number | null;
  is_combined: boolean;
  combined_into_class_id: string | null;
  boarding: boolean;
}

// Kết quả thao tác hàng loạt trên lớp (DT-16 phần 16e): lớp làm được và lớp không làm được kèm lý do
export interface BulkClassResult {
  succeeded: Array<{ id: string; name: string }>;
  failed: Array<{ id: string; name: string; message: string }>;
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
  'age_group',
  'sort_order',
  'two_sessions_per_day',
  'mixed_age_count',
  'is_combined',
  'combined_into_class_id',
  'boarding',
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
// Xóa lớp, thao tác hàng loạt, nhập cột mới của lớp theo Sở (DT-16 phần 16e)
const CLASS_DELETE_RULE_CODE = 'YCTD-124';
const DUPLICATE_CODE_MESSAGE = 'Mã lớp đã có trong đơn vị';
const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
// Tệp Excel tối đa 10 000 dòng như danh sách học sinh (YCTD-108)
const EXPORT_LIMIT = 10_000;
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

export type ClassListItem = ClassListRow & { academic_year_id: string; staff: StaffAssignment[] };

export interface AssignmentListFilter {
  orgUnitId?: string;
  gradeLevel?: string;
  role?: AssignmentRole;
  q?: string;
  // Tình trạng phân công (DT-16 phần 16e): đã phân công, chưa phân công; trống là cả hai
  assignment?: 'assigned' | 'unassigned';
}

// Dòng của giáo viên chưa phân công (DT-16 phần 16e) để trống lớp, vai trò, ngày
export interface AssignmentRow {
  id: string;
  class_id: string | null;
  class_code: string;
  class_name: string;
  grade_name: string;
  org_unit_id: string;
  org_unit_name: string;
  staff_user_id: string;
  staff_name: string;
  assignment_role: AssignmentRole | null;
  subject_name: string | null;
  from_date: string | null;
}

const ASSIGNMENT_EXPORT_COLUMNS: Array<{ id: string; label: string; value(row: AssignmentRow): string }> = [
  { id: 'staff_name', label: 'Giáo viên', value: (row) => row.staff_name },
  {
    id: 'assignment_role',
    label: 'Vai trò trong lớp',
    value: (row) =>
      row.assignment_role === null ? 'Chưa phân công' : row.assignment_role === 'homeroom' ? 'Chủ nhiệm' : 'Bộ môn',
  },
  { id: 'subject_name', label: 'Môn dạy', value: (row) => row.subject_name ?? '' },
  { id: 'class_name', label: 'Lớp', value: (row) => row.class_name },
  { id: 'grade_name', label: 'Khối', value: (row) => row.grade_name },
  { id: 'org_unit_name', label: 'Đơn vị', value: (row) => row.org_unit_name },
  { id: 'from_date', label: 'Từ ngày', value: (row) => row.from_date?.split('-').reverse().join('/') ?? '' },
];

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
  // Danh sách theo mục 2.1 của Sở (YCTD-111): thêm đơn vị, bậc học, nhóm tuổi đang áp dụng, giáo viên chủ nhiệm, lớp được
  // ghép vào; thứ tự theo ô Thứ tự rồi mã lớp
  async list(currentUser: CurrentUser, filter: ClassListFilter & { mine: boolean }): Promise<ClassListItem[]> {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return [];
    }
    let query = current.database.selectFrom('classes').select(CLASS_COLUMNS);
    if (filter.q) {
      const pattern = `%${filter.q.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
      query = query.where((builder) =>
        builder.or([builder('name', 'ilike', pattern), builder('code', 'ilike', pattern)]),
      );
    }
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
    const classes = await query
      .orderBy(sql`sort_order asc nulls last`)
      .orderBy('code')
      .execute();
    if (classes.length === 0) {
      return [];
    }
    const [units, gradeLevels, rooms, targets] = await Promise.all([
      current.database.selectFrom('org_units').select(['id', 'name', 'unit_type']).execute(),
      current.database.selectFrom('grade_levels').select(['code', 'name', 'age_from_months']).execute(),
      current.database.selectFrom('rooms').select(['id', 'name']).execute(),
      current.database.selectFrom('classes').select(['id', 'name']).execute(),
    ]);
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
    return classes
      .map((row): ClassListItem => {
        const unit = units.find((item) => item.id === row.org_unit_id);
        const grade = gradeLevels.find((item) => item.code === row.grade_level);
        const staff = assignments.filter((item) => item.class_id === row.id);
        const ageGroup = row.age_group ?? classAgeGroup(grade?.age_from_months ?? 36);
        return {
          ...row,
          org_unit_name: unit?.name ?? '',
          org_unit_type: unit?.unit_type ?? 'truong_chinh',
          grade_name: grade?.name ?? row.grade_level,
          age_group: ageGroup as ClassAgeGroup,
          age_group_from_grade: row.age_group === null,
          stage: classStageOf(ageGroup as ClassAgeGroup),
          room_name: rooms.find((item) => item.id === row.room_id)?.name ?? null,
          enrolled_count: Number(counts.find((count) => count.class_id === row.id)?.count ?? 0),
          homeroom_names: staff
            .filter((item) => item.assignment_role === 'homeroom')
            .map((item) => item.staff_name)
            .join(', '),
          combined_into_name: targets.find((item) => item.id === row.combined_into_class_id)?.name ?? null,
          staff,
        };
      })
      .filter((row) => matchesClassFilter(row, filter));
  }

  // Xuất Excel theo bộ lọc và các cột đang hiện trên lưới; tệp có tên giáo viên nên ghi nhật ký xuất có dữ liệu cá nhân
  // (BR-74). Nhiều hơn 10 000 dòng thì báo thu hẹp bộ lọc
  async exportList(
    currentUser: CurrentUser,
    filter: ClassListFilter,
    columns: string[],
    ipAddress: string | null,
    format: TableFileFormat = 'xlsx',
  ) {
    const { database } = await this.currentSchoolYear.require();
    const rows = await this.list(currentUser, { ...filter, mine: false });
    if (rows.length > EXPORT_LIMIT) {
      throw ruleViolationError('YCTD-111', `Danh sách có hơn ${EXPORT_LIMIT} lớp; hãy thu hẹp bộ lọc trước khi xuất`);
    }
    const selected = columns.flatMap((id) => CLASS_EXPORT_COLUMNS.filter((column) => column.id === id));
    const createdAt = this.clock.now();
    return buildStudentWorkbook({
      database,
      currentUser,
      reportCode: 'classes',
      title: 'Hồ sơ lớp học',
      fileName: `danh-sach-lop-${fileStamp(createdAt)}.xlsx`,
      filters: { ...filter },
      orgUnitIds: [...new Set(rows.map((row) => row.org_unit_id))],
      columns: selected.map((column) => ({ key: column.id, label: column.label })),
      rows: rows.map((row) => Object.fromEntries(selected.map((column) => [column.id, column.value(row)]))),
      ipAddress,
      createdAt,
      format,
    });
  }

  // 3.3 Phân công phụ trách lớp (YCTD-111): mỗi dòng là một phân công còn hiệu lực của lớp trong phạm vi xem, sắp theo tên
  // giáo viên rồi tên lớp; lấy từ giáo viên của lớp, không thêm bảng. Theo Sở (DT-16 phần 16e) danh sách hiện cả giáo viên
  // chưa phụ trách lớp nào: người có vai trò giáo viên chủ nhiệm (VT-07) hoặc bộ môn (VT-08) ở đơn vị trong phạm vi, đọc từ
  // danh bạ nhân sự của dịch vụ định danh, mỗi người một dòng để trống lớp. Người xem không có quyền đọc danh bạ (quyền
  // quản lý lớp hoặc hồ sơ học sinh) chỉ thấy các dòng đã phân công
  async listAssignmentRows(
    currentUser: CurrentUser,
    filter: AssignmentListFilter,
    accessToken: string | null = null,
  ): Promise<AssignmentRow[]> {
    const classes = await this.list(currentUser, {
      orgUnitId: filter.orgUnitId,
      status: 'active',
      gradeLevel: filter.gradeLevel,
      mine: false,
    });
    const keyword = filter.q?.toLocaleLowerCase('vi');
    const collator = new Intl.Collator('vi');
    const assigned: AssignmentRow[] =
      filter.assignment === 'unassigned'
        ? []
        : classes.flatMap((classRecord) =>
            classRecord.staff.map((assignment) => ({
              id: assignment.id,
              class_id: classRecord.id,
              class_code: classRecord.code,
              class_name: classRecord.name,
              grade_name: classRecord.grade_name,
              org_unit_id: classRecord.org_unit_id,
              org_unit_name: classRecord.org_unit_name,
              staff_user_id: assignment.staff_user_id,
              staff_name: assignment.staff_name,
              assignment_role: assignment.assignment_role,
              subject_name: assignment.subject_name,
              from_date: assignment.from_date,
            })),
          );
    const unassigned =
      filter.assignment === 'assigned' || accessToken === null || filter.gradeLevel
        ? []
        : await this.unassignedTeachers(currentUser, accessToken, filter);
    return [...assigned, ...unassigned]
      .filter(
        (row) =>
          (filter.role === undefined || row.assignment_role === filter.role || row.assignment_role === null) &&
          (keyword === undefined || row.staff_name.toLocaleLowerCase('vi').includes(keyword)),
      )
      .sort(
        (left, right) =>
          collator.compare(left.staff_name, right.staff_name) ||
          collator.compare(left.class_name, right.class_name) ||
          (left.assignment_role ?? '').localeCompare(right.assignment_role ?? ''),
      );
  }

  // Giáo viên chưa có phân công còn hiệu lực ở lớp nào của năm học; vai trò lọc theo bộ lọc Vai trò trong lớp
  private async unassignedTeachers(
    currentUser: CurrentUser,
    accessToken: string,
    filter: AssignmentListFilter,
  ): Promise<AssignmentRow[]> {
    const { database } = await this.currentSchoolYear.require();
    let units = await database.selectFrom('org_units').select(['id', 'name']).where('status', '=', 'active').execute();
    if (filter.orgUnitId) {
      units = units.filter((unit) => unit.id === filter.orgUnitId);
    } else {
      const scope = await this.organizationScopes.resolveAnyRole(currentUser);
      if (!scope.wholeSchool) {
        units = units.filter((unit) => scope.orgUnitIds.includes(unit.id));
      }
    }
    const busy = new Set(
      (
        await database
          .selectFrom('class_staff_assignments')
          .select('staff_user_id')
          .where('status', '=', 'active')
          .execute()
      ).map((row) => row.staff_user_id),
    );
    const roles = filter.role ? [ROLE_OF_ASSIGNMENT[filter.role]] : Object.values(ROLE_OF_ASSIGNMENT);
    const found = new Map<string, AssignmentRow>();
    for (const unit of units) {
      for (const roleCode of roles) {
        let entries: Awaited<ReturnType<IdentityClient['listStaff']>>;
        try {
          entries = await this.identityClient.listStaff(accessToken, roleCode, unit.id);
        } catch (error) {
          if (error instanceof ApplicationError && error.code === 'ERR_FORBIDDEN') {
            return [];
          }
          throw error;
        }
        for (const entry of entries) {
          if (busy.has(entry.user_id) || found.has(entry.user_id)) {
            continue;
          }
          // Người gán ở Trường chính hiện ở mọi đơn vị; ghi đơn vị là đơn vị của vai trò
          const ownUnit = units.find((item) => item.id === entry.org_unit_id) ?? unit;
          found.set(entry.user_id, {
            id: `unassigned-${entry.user_id}`,
            class_id: null,
            class_code: '',
            class_name: '',
            grade_name: '',
            org_unit_id: ownUnit.id,
            org_unit_name: ownUnit.name,
            staff_user_id: entry.user_id,
            staff_name: entry.full_name,
            assignment_role: null,
            subject_name: null,
            from_date: null,
          });
        }
      }
    }
    return [...found.values()];
  }

  async exportAssignments(
    currentUser: CurrentUser,
    filter: AssignmentListFilter,
    ipAddress: string | null,
    format: TableFileFormat = 'xlsx',
    accessToken: string | null = null,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const rows = await this.listAssignmentRows(currentUser, filter, accessToken);
    const createdAt = this.clock.now();
    return buildStudentWorkbook({
      database,
      currentUser,
      reportCode: 'class-assignments',
      title: 'Phân công phụ trách lớp',
      fileName: `phan-cong-phu-trach-lop-${fileStamp(createdAt)}.xlsx`,
      filters: { ...filter },
      orgUnitIds: [...new Set(rows.map((row) => row.org_unit_id))],
      columns: ASSIGNMENT_EXPORT_COLUMNS.map((column) => ({ key: column.id, label: column.label })),
      rows: rows.map((row) =>
        Object.fromEntries(ASSIGNMENT_EXPORT_COLUMNS.map((column) => [column.id, column.value(row)])),
      ),
      ipAddress,
      createdAt,
      format,
    });
  }

  async create(currentUser: CurrentUser, input: ClassInput, origin: ChangeOrigin): Promise<ClassRecord> {
    const database = await this.catalogAccess.writableDatabase(currentUser, PERMISSION, input.org_unit_id);
    const { academicYearId } = await this.currentSchoolYear.require();
    await this.assertGradeLevel(input.grade_level);
    if (input.room_id) {
      await this.assertRoom(input.org_unit_id, input.room_id);
    }
    await this.assertSoFields(database, input.org_unit_id, null, input);
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
    // Bỏ đánh dấu lớp ghép thì bỏ luôn lớp được ghép vào
    if (changes.is_combined === false) {
      changes.combined_into_class_id = null;
    }
    const soFields = ['grade_level', 'age_group', 'mixed_age_count', 'is_combined', 'combined_into_class_id'] as const;
    if (soFields.some((field) => changes[field] !== undefined)) {
      const merged = { ...existing };
      for (const field of soFields) {
        if (changes[field] !== undefined) {
          Object.assign(merged, { [field]: changes[field] });
        }
      }
      await this.assertSoFields(database, existing.org_unit_id, classId, merged);
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

  // Xóa lớp theo Sở (DT-16 phần 16e, khảo sát mục 3.2 dòng 2.1): chỉ xóa lớp chưa phát sinh dữ liệu (chưa có học sinh, điểm
  // danh, sổ, thực đơn…; cơ sở dữ liệu từ chối xóa khi còn dòng tham chiếu) và không có lớp khác ghép vào; phân công giáo
  // viên của lớp xóa theo. Lớp đã có dữ liệu thì giải thể. Chọn nhiều lớp thì xóa từng lớp, lớp không xóa được báo lý do
  async remove(currentUser: CurrentUser, classIds: string[], origin: ChangeOrigin): Promise<BulkClassResult> {
    const result: BulkClassResult = { succeeded: [], failed: [] };
    for (const classId of classIds) {
      let name = classId;
      try {
        const existing = await this.find(classId);
        name = existing.name;
        const database = await this.catalogAccess.writableDatabase(currentUser, PERMISSION, existing.org_unit_id);
        const dependent = await database
          .selectFrom('classes')
          .select('name')
          .where('combined_into_class_id', '=', classId)
          .executeTakeFirst();
        if (dependent) {
          throw ruleViolationError(CLASS_DELETE_RULE_CODE, `Lớp ${dependent.name} đang ghép vào lớp này`);
        }
        await database.transaction().execute(async (transaction) => {
          const assignments = await transaction
            .deleteFrom('class_staff_assignments')
            .where('class_id', '=', classId)
            .returning(ASSIGNMENT_COLUMNS)
            .execute();
          await transaction.deleteFrom('classes').where('id', '=', classId).execute();
          await writeAuditLog(transaction, {
            origin,
            orgUnitId: existing.org_unit_id,
            entityName: 'classes',
            entityId: classId,
            action: 'delete',
            before: { ...existing, staff_assignments: assignments },
            after: null,
          });
        });
        result.succeeded.push({ id: classId, name });
      } catch (error) {
        const inUse = (error as { code?: string }).code === '23503';
        result.failed.push({
          id: classId,
          name,
          message: inUse
            ? 'Lớp đã phát sinh dữ liệu (học sinh, điểm danh, sổ…); không xóa được, hãy giải thể lớp'
            : error instanceof ApplicationError
              ? error.message
              : 'Không xóa được lớp',
        });
      }
    }
    return result;
  }

  // Thao tác hàng loạt trên các lớp đã chọn (DT-16 phần 16e): giải thể, mở lại, đặt học 2 buổi/ngày, lớp bán trú; mỗi lớp
  // ghi như sửa từng lớp nên giữ mọi kiểm tra (không giải thể lớp còn học sinh, BR-02)
  async bulkUpdate(
    currentUser: CurrentUser,
    classIds: string[],
    changes: Pick<ClassChanges, 'status' | 'two_sessions_per_day' | 'boarding'>,
    origin: ChangeOrigin,
  ): Promise<BulkClassResult> {
    const result: BulkClassResult = { succeeded: [], failed: [] };
    for (const classId of classIds) {
      try {
        const updated = await this.update(currentUser, classId, { ...changes }, origin);
        result.succeeded.push({ id: classId, name: updated.name });
      } catch (error) {
        const existing = await this.currentSchoolYear
          .require()
          .then(({ database }) =>
            database.selectFrom('classes').select('name').where('id', '=', classId).executeTakeFirst(),
          );
        result.failed.push({
          id: classId,
          name: existing?.name ?? classId,
          message: error instanceof ApplicationError ? error.message : 'Không cập nhật được lớp',
        });
      }
    }
    return result;
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

  // Ràng buộc thông tin lớp theo Sở (YCTD-111): chỉ lớp mẫu giáo mới ghép 2 hoặc 3 độ tuổi; lớp ghép chỉ ghép vào một lớp
  // khác đang dùng của cùng đơn vị, không ghép nối tiếp (lớp đã có lớp ghép vào thì không ghép vào lớp khác)
  private async assertSoFields(
    database: Executor,
    orgUnitId: string,
    classId: string | null,
    values: Pick<
      ClassInput,
      'grade_level' | 'age_group' | 'mixed_age_count' | 'is_combined' | 'combined_into_class_id'
    >,
  ): Promise<void> {
    if (values.mixed_age_count !== null) {
      let ageGroup = values.age_group;
      if (ageGroup === null) {
        const grade = await database
          .selectFrom('grade_levels')
          .select('age_from_months')
          .where('code', '=', values.grade_level)
          .executeTakeFirst();
        ageGroup = classAgeGroup(grade?.age_from_months ?? 36) as ClassAgeGroup;
      }
      if (classStageOf(ageGroup) !== 'mau_giao') {
        throw ruleViolationError('YCTD-111', 'Chỉ lớp mẫu giáo mới ghép 2 hoặc 3 độ tuổi', [
          { field: 'mixed_age_count', message: 'Nhóm trẻ không ghép độ tuổi' },
        ]);
      }
    }
    if (!values.combined_into_class_id) {
      return;
    }
    if (!values.is_combined) {
      throw validationError([{ field: 'combined_into_class_id', message: 'Chỉ chọn lớp ghép vào khi là lớp ghép' }]);
    }
    if (values.combined_into_class_id === classId) {
      throw ruleViolationError('YCTD-111', 'Lớp không ghép vào chính nó', [
        { field: 'combined_into_class_id', message: 'Chọn lớp khác' },
      ]);
    }
    const target = await database
      .selectFrom('classes')
      .select(['org_unit_id', 'status', 'combined_into_class_id'])
      .where('id', '=', values.combined_into_class_id)
      .executeTakeFirst();
    if (!target) {
      throw validationError([{ field: 'combined_into_class_id', message: 'Không tìm thấy lớp ghép vào' }]);
    }
    if (target.org_unit_id !== orgUnitId || target.status !== 'active' || target.combined_into_class_id !== null) {
      throw ruleViolationError(
        'YCTD-111',
        'Lớp ghép vào phải là lớp đang dùng của cùng đơn vị và chưa ghép vào lớp khác',
        [{ field: 'combined_into_class_id', message: 'Chọn lớp khác' }],
      );
    }
    if (classId) {
      const dependent = await database
        .selectFrom('classes')
        .select('name')
        .where('combined_into_class_id', '=', classId)
        .executeTakeFirst();
      if (dependent) {
        throw ruleViolationError(
          'YCTD-111',
          `Lớp ${dependent.name} đang ghép vào lớp này; không ghép lớp này vào lớp khác`,
          [{ field: 'combined_into_class_id', message: 'Lớp đã có lớp ghép vào' }],
        );
      }
    }
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
