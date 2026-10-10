import { Injectable } from '@nestjs/common';
import type { PickupPersonKind, PickupType, SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, validationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Kysely } from 'kysely';
import { SchoolCalendar, VIETNAM_DATE } from '../attendance/school-calendar.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { ChildScope } from '../children/child-scope.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification } from '../common/notification-queue.js';
import { notFoundError } from '../common/request-fields.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';

// Người được ủy quyền đón trẻ, bàn giao trẻ cuối ngày, bảo vệ xác nhận tại cổng, phụ huynh xác nhận người đón ngoài
// danh sách (P02-04, P04-03; QT-02 bước 6, 7, E6; BR-11, BR-56; YCTD-48)
const PRESENT_STATUSES = ['present', 'late', 'early_leave', 'late_and_early_leave'] as const;
const DIRECTORY_LIMIT = 20;

export interface AuthorizedPickupInput {
  fullName: string;
  relationship: string;
  phone: string;
  validFrom: string | null;
  validTo: string | null;
}

// Người đón chọn từ hồ sơ (phụ huynh, người được ủy quyền) hoặc nhập tay khi không có trong danh sách
export type PickupPerson =
  | { guardianId: string }
  | { authorizedPickupId: string }
  | { fullName: string; relationship: string; phone: string | null };

export interface PickupInput {
  pickupType: PickupType;
  date: string | null;
  person: PickupPerson;
  photoFileId: string | null;
  pickedUpAt: Date | null;
}

interface ChildContext {
  id: string;
  full_name: string;
  org_unit_id: string;
  status: string;
  class_id: string | null;
}

interface ResolvedPerson {
  kind: PickupPersonKind | null;
  fullName: string;
  relationship: string;
  phone: string | null;
  guardianId: string | null;
  authorizedPickupId: string | null;
}

// So khớp họ tên người đón với yêu cầu xác nhận: bỏ khoảng trắng thừa, không phân biệt hoa thường
const normalizeName = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');

@Injectable()
export class PickupsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly childScope: ChildScope,
    private readonly calendar: SchoolCalendar,
    private readonly clock: Clock,
  ) {}

  private today(): string {
    return this.calendar.today(this.clock.now());
  }

  // Danh sách người được ủy quyền của trẻ: người được xem trẻ, hoặc bảo vệ trong đơn vị của trẻ (CTC-P04-029)
  async listAuthorized(currentUser: CurrentUser, childId: string) {
    const { database } = await this.currentSchoolYear.require();
    const child = await this.findChild(database, childId);
    await this.assertCanReadPickupList(currentUser, database, child);
    const today = this.today();
    const rows = await database
      .selectFrom('authorized_pickups')
      .select(['id', 'child_id', 'full_name', 'relationship', 'phone', 'valid_from', 'valid_to', 'status', 'source'])
      .where('child_id', '=', childId)
      .where('status', '=', 'active')
      .orderBy('created_at')
      .execute();
    return rows.map((row) => ({ ...row, is_valid_today: this.isValidOn(row, today) }));
  }

  // Phụ huynh khai báo cho con mình; nhà trường khai báo bằng P02.authorized-pickup.manage (BR-11, AC của P02-04)
  async createAuthorized(
    currentUser: CurrentUser,
    childId: string,
    input: AuthorizedPickupInput,
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const child = await this.findChild(database, childId);
    const source = await this.assertCanManageAuthorized(currentUser, database, child);
    const validFrom = input.validFrom ?? this.today();
    if (input.validTo && input.validTo < validFrom) {
      throw validationError([{ field: 'valid_to', message: 'Ngày hết hạn không trước ngày bắt đầu' }]);
    }
    const created = await database.transaction().execute(async (transaction) => {
      const row = await transaction
        .insertInto('authorized_pickups')
        .values({
          child_id: child.id,
          full_name: input.fullName,
          relationship: input.relationship,
          phone: input.phone,
          valid_from: validFrom,
          valid_to: input.validTo,
          source,
          created_by: origin.actorUserId,
        })
        .returning([
          'id',
          'child_id',
          'full_name',
          'relationship',
          'phone',
          'valid_from',
          'valid_to',
          'status',
          'source',
        ])
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: child.org_unit_id,
        entityName: 'authorized_pickups',
        entityId: row.id,
        action: 'create',
        before: null,
        after: row,
      });
      return row;
    });
    return { ...created, is_valid_today: this.isValidOn(created, this.today()) };
  }

  async revokeAuthorized(currentUser: CurrentUser, authorizedPickupId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const row = await database
      .selectFrom('authorized_pickups')
      .select(['id', 'child_id', 'full_name', 'status'])
      .where('id', '=', authorizedPickupId)
      .executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy người được ủy quyền', 'authorized_pickup');
    }
    const child = await this.findChild(database, row.child_id);
    await this.assertCanManageAuthorized(currentUser, database, child);
    if (row.status === 'revoked') {
      throw ruleViolationError('P02-04', 'Ủy quyền này đã được hủy');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('authorized_pickups')
        .set({ status: 'revoked', revoked_by: origin.actorUserId, revoked_at: this.clock.now() })
        .where('id', '=', row.id)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: child.org_unit_id,
        entityName: 'authorized_pickups',
        entityId: row.id,
        action: 'update',
        before: { status: 'active' },
        after: { status: 'revoked' },
      });
    });
    return { id: row.id, status: 'revoked' as const };
  }

  // Màn hình đón trả của lớp (MG-04): trẻ, trạng thái có mặt, người được đón, lượt bàn giao và yêu cầu xác nhận trong ngày
  async classPickups(currentUser: CurrentUser, classId: string, date: string) {
    const { database } = await this.currentSchoolYear.require();
    const classRecord = await database
      .selectFrom('classes')
      .select(['id', 'org_unit_id', 'name', 'status'])
      .where('id', '=', classId)
      .executeTakeFirst();
    if (!classRecord) {
      throw notFoundError('Không tìm thấy lớp', 'class');
    }
    const scope = await this.childScope.resolve(currentUser, database);
    if (!(scope.wholeSchool || scope.unitIds.includes(classRecord.org_unit_id) || scope.classIds.includes(classId))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không phụ trách lớp này');
    }
    const children = await database
      .selectFrom('class_enrollments')
      .innerJoin('children', 'children.id', 'class_enrollments.child_id')
      .leftJoin('attendance_records', (join) =>
        join
          .onRef('attendance_records.child_id', '=', 'children.id')
          .on('attendance_records.attendance_date', '=', date),
      )
      .select(['children.id as child_id', 'children.full_name', 'attendance_records.status as attendance_status'])
      .where('class_enrollments.class_id', '=', classId)
      .where('class_enrollments.is_current', '=', true)
      .where('children.status', '=', 'active')
      .orderBy('children.full_name')
      .execute();
    const childIds = children.map((child) => child.child_id);
    const people = await this.pickupPeople(database, childIds, date);
    const handovers = childIds.length
      ? await database
          .selectFrom('pickup_records')
          .select(['id', 'child_id', 'person_kind', 'person_name', 'relationship', 'recorded_at', 'photo_file_id'])
          .where('child_id', 'in', childIds)
          .where('pickup_date', '=', date)
          .where('pickup_type', '=', 'handover')
          .execute()
      : [];
    const requests = childIds.length
      ? await database
          .selectFrom('pickup_confirmation_requests')
          .select(['id', 'child_id', 'person_name', 'relationship', 'phone', 'status', 'requested_at', 'responded_at'])
          .where('child_id', 'in', childIds)
          .where('pickup_date', '=', date)
          .orderBy('requested_at')
          .execute()
      : [];
    return {
      class_id: classId,
      class_name: classRecord.name,
      org_unit_id: classRecord.org_unit_id,
      date,
      can_hand_over: await this.isHomeroomTeacher(currentUser, database, classId),
      children: children.map((child) => ({
        child_id: child.child_id,
        full_name: child.full_name,
        attendance_status: child.attendance_status,
        is_present: PRESENT_STATUSES.some((status) => status === child.attendance_status),
        guardians: people.guardians.filter((guardian) => guardian.child_id === child.child_id),
        authorized_pickups: people.authorized.filter((person) => person.child_id === child.child_id),
        handover: handovers.find((handover) => handover.child_id === child.child_id) ?? null,
        confirmation_requests: requests.filter((request) => request.child_id === child.child_id),
      })),
    };
  }

  // Bảo vệ tìm trẻ trong đơn vị được gán để đối chiếu người đón tại cổng (MG-16); không trả hồ sơ trẻ
  async directory(currentUser: CurrentUser, orgUnitId: string, search: string) {
    await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.pickupGateConfirm, orgUnitId);
    const { database } = await this.currentSchoolYear.require();
    const children = await database
      .selectFrom('children')
      .innerJoin('class_enrollments', (join) =>
        join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
      )
      .innerJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select(['children.id as child_id', 'children.full_name', 'classes.name as class_name'])
      .where('children.org_unit_id', '=', orgUnitId)
      .where('children.status', '=', 'active')
      .where('children.full_name', 'ilike', `%${search.replace(/[\\%_]/g, (character) => `\\${character}`)}%`)
      .orderBy('children.full_name')
      .limit(DIRECTORY_LIMIT)
      .execute();
    const today = this.today();
    const people = await this.pickupPeople(
      database,
      children.map((child) => child.child_id),
      today,
    );
    const checks = children.length
      ? await database
          .selectFrom('pickup_records')
          .select(['child_id', 'person_name', 'recorded_at'])
          .where(
            'child_id',
            'in',
            children.map((child) => child.child_id),
          )
          .where('pickup_date', '=', today)
          .where('pickup_type', '=', 'gate_check')
          .orderBy('recorded_at')
          .execute()
      : [];
    return children.map((child) => ({
      ...child,
      guardians: people.guardians.filter((guardian) => guardian.child_id === child.child_id),
      authorized_pickups: people.authorized.filter(
        (person) => person.child_id === child.child_id && person.is_valid_today,
      ),
      gate_checks: checks.filter((check) => check.child_id === child.child_id),
    }));
  }

  // Ghi nhận bàn giao của giáo viên chủ nhiệm hoặc xác nhận tại cổng của bảo vệ (QT-02 bước 6, 7)
  async record(currentUser: CurrentUser, childId: string, input: PickupInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const child = await this.findChild(database, childId);
    if (child.status !== 'active' || !child.class_id) {
      throw ruleViolationError('QT-02', 'Chỉ ghi nhận đón trả cho trẻ đang học');
    }
    const classId = child.class_id;
    const now = this.clock.now();
    const today = this.today();
    const date = input.date ?? today;
    if (input.pickupType === 'gate_check') {
      await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.pickupGateConfirm, child.org_unit_id);
      if (date !== today) {
        throw ruleViolationError('QT-02', 'Bảo vệ chỉ xác nhận người đón trong ngày hôm nay');
      }
    } else if (!(await this.isHomeroomTeacher(currentUser, database, classId))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không phụ trách lớp này');
    }
    const pickedUpAt = input.pickupType === 'gate_check' ? now : (input.pickedUpAt ?? now);
    if (input.pickupType === 'handover') {
      await this.assertHandoverAllowed(database, child.id, date, pickedUpAt, now);
    }
    if (input.photoFileId) {
      const photo = await database
        .selectFrom('files')
        .select('id')
        .where('id', '=', input.photoFileId)
        .where('purpose', '=', 'pickup_photo')
        .executeTakeFirst();
      if (!photo) {
        throw validationError([{ field: 'photo_file_id', message: 'Không tìm thấy ảnh bàn giao' }]);
      }
    }
    const person = await this.resolvePerson(database, child.id, date, input.person);
    let confirmationRequestId: string | null = null;
    if (!person.kind) {
      if (input.pickupType === 'gate_check') {
        throw ruleViolationError('BR-56', 'Người này không có trong danh sách được ủy quyền');
      }
      confirmationRequestId = await this.requireParentConfirmation(database, child, date, person, origin);
    }
    const kind: PickupPersonKind = person.kind ?? 'parent_confirmed';
    const record = await database.transaction().execute(async (transaction) => {
      const row = await transaction
        .insertInto('pickup_records')
        .values({
          child_id: child.id,
          class_id: classId,
          org_unit_id: child.org_unit_id,
          pickup_date: date,
          pickup_type: input.pickupType,
          person_kind: kind,
          person_name: person.fullName,
          relationship: person.relationship,
          phone: person.phone,
          guardian_id: person.guardianId,
          authorized_pickup_id: person.authorizedPickupId,
          confirmation_request_id: confirmationRequestId,
          photo_file_id: input.photoFileId,
          recorded_by: origin.actorUserId,
          recorded_at: pickedUpAt,
        })
        .onConflict((conflict) =>
          conflict.columns(['child_id', 'pickup_date']).where('pickup_type', '=', 'handover').doNothing(),
        )
        .returning([
          'id',
          'child_id',
          'pickup_date',
          'pickup_type',
          'person_kind',
          'person_name',
          'relationship',
          'phone',
          'confirmation_request_id',
          'photo_file_id',
          'recorded_at',
        ])
        .executeTakeFirst();
      if (!row) {
        throw ruleViolationError('QT-02', 'Trẻ đã được bàn giao trong ngày');
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: child.org_unit_id,
        entityName: 'pickup_records',
        entityId: row.id,
        action: 'create',
        before: null,
        after: row,
      });
      if (input.pickupType === 'handover') {
        await queueNotification(transaction, {
          orgUnitId: child.org_unit_id,
          templateCode: 'child_handed_over',
          title: 'Trẻ đã được bàn giao',
          body: `${child.full_name} đã được bàn giao cho ${person.fullName} (${person.relationship})`,
          targetType: 'children',
          targetId: child.id,
          recipients: (await this.guardianUserIds(transaction, child.id)).map((userId) => ({
            userId,
            channel: 'in_app' as const,
          })),
        });
      }
      return row;
    });
    return record;
  }

  // Yêu cầu xác nhận người đón của các con của phụ huynh đang đăng nhập (MP-18)
  async myConfirmationRequests(currentUser: CurrentUser, status: 'pending' | 'all') {
    const { database } = await this.currentSchoolYear.require();
    let query = database
      .selectFrom('pickup_confirmation_requests')
      .innerJoin('children', 'children.id', 'pickup_confirmation_requests.child_id')
      .select([
        'pickup_confirmation_requests.id',
        'pickup_confirmation_requests.child_id',
        'children.full_name as child_name',
        'pickup_confirmation_requests.pickup_date',
        'pickup_confirmation_requests.person_name',
        'pickup_confirmation_requests.relationship',
        'pickup_confirmation_requests.phone',
        'pickup_confirmation_requests.status',
        'pickup_confirmation_requests.requested_at',
        'pickup_confirmation_requests.responded_at',
      ])
      .where('pickup_confirmation_requests.child_id', 'in', (expression) =>
        expression
          .selectFrom('child_guardians')
          .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
          .select('child_guardians.child_id')
          .where('guardians.user_id', '=', currentUser.id),
      );
    if (status === 'pending') {
      query = query.where('pickup_confirmation_requests.status', '=', 'pending');
    }
    return query.orderBy('pickup_confirmation_requests.requested_at', 'desc').limit(50).execute();
  }

  // Phụ huynh của trẻ có tài khoản xác nhận hoặc từ chối người đón ngoài danh sách (BR-56)
  async respond(currentUser: CurrentUser, requestId: string, decision: 'confirmed' | 'refused', origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const request = await database
      .selectFrom('pickup_confirmation_requests')
      .innerJoin('children', 'children.id', 'pickup_confirmation_requests.child_id')
      .select([
        'pickup_confirmation_requests.id',
        'pickup_confirmation_requests.child_id',
        'pickup_confirmation_requests.status',
        'pickup_confirmation_requests.person_name',
        'pickup_confirmation_requests.pickup_date',
        'children.full_name as child_name',
        'children.org_unit_id',
      ])
      .where('pickup_confirmation_requests.id', '=', requestId)
      .executeTakeFirst();
    if (!request) {
      throw notFoundError('Không tìm thấy yêu cầu xác nhận', 'pickup_confirmation_request');
    }
    if (!(await this.isGuardianOf(database, currentUser.id, request.child_id))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ phụ huynh của trẻ được xác nhận người đón');
    }
    if (request.status !== 'pending') {
      throw ruleViolationError('BR-56', 'Yêu cầu này đã được trả lời');
    }
    const classId = (
      await database
        .selectFrom('class_enrollments')
        .select('class_id')
        .where('child_id', '=', request.child_id)
        .where('is_current', '=', true)
        .executeTakeFirst()
    )?.class_id;
    const teachers = classId
      ? await database
          .selectFrom('class_staff_assignments')
          .select('staff_user_id')
          .where('class_id', '=', classId)
          .where('assignment_role', '=', 'homeroom')
          .where('status', '=', 'active')
          .execute()
      : [];
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('pickup_confirmation_requests')
        .set({ status: decision, responded_by: origin.actorUserId, responded_at: this.clock.now() })
        .where('id', '=', request.id)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: request.org_unit_id,
        entityName: 'pickup_confirmation_requests',
        entityId: request.id,
        action: 'update',
        before: { status: 'pending' },
        after: { status: decision },
      });
      await queueNotification(transaction, {
        orgUnitId: request.org_unit_id,
        templateCode: 'pickup_confirmation_answered',
        title: decision === 'confirmed' ? 'Phụ huynh đã xác nhận người đón' : 'Phụ huynh từ chối người đón',
        body: `${request.person_name} đón ${request.child_name} ngày ${request.pickup_date}: ${
          decision === 'confirmed' ? 'đã xác nhận' : 'bị từ chối'
        }`,
        targetType: 'children',
        targetId: request.child_id,
        recipients: teachers.map((teacher) => ({ userId: teacher.staff_user_id, channel: 'in_app' as const })),
      });
    });
    return { id: request.id, status: decision };
  }

  private async assertHandoverAllowed(
    database: Kysely<SchoolYearDatabase>,
    childId: string,
    date: string,
    pickedUpAt: Date,
    now: Date,
  ): Promise<void> {
    await this.calendar.assertSchoolDay(date);
    if (date > this.today()) {
      throw ruleViolationError('QT-02', 'Không ghi nhận bàn giao cho ngày chưa tới');
    }
    if (pickedUpAt > now || VIETNAM_DATE.format(pickedUpAt) !== date) {
      throw validationError([
        { field: 'picked_up_at', message: 'Thời điểm đón phải thuộc ngày bàn giao và không ở tương lai' },
      ]);
    }
    const attendance = await database
      .selectFrom('attendance_records')
      .select(['status', 'recorded_at'])
      .where('child_id', '=', childId)
      .where('attendance_date', '=', date)
      .executeTakeFirst();
    if (!attendance || !PRESENT_STATUSES.some((status) => status === attendance.status)) {
      throw ruleViolationError('QT-02', 'Trẻ không được điểm danh có mặt trong ngày nên không bàn giao được');
    }
    if (pickedUpAt < attendance.recorded_at) {
      throw ruleViolationError('QT-02', 'Thời điểm đón không được trước thời điểm điểm danh');
    }
    const existing = await database
      .selectFrom('pickup_records')
      .select('id')
      .where('child_id', '=', childId)
      .where('pickup_date', '=', date)
      .where('pickup_type', '=', 'handover')
      .executeTakeFirst();
    if (existing) {
      throw ruleViolationError('QT-02', 'Trẻ đã được bàn giao trong ngày');
    }
  }

  // Người đón ngoài danh sách: đã được phụ huynh xác nhận trong ngày thì cho bàn giao; chưa thì tạo yêu cầu và chặn (E6)
  private async requireParentConfirmation(
    database: Kysely<SchoolYearDatabase>,
    child: ChildContext,
    date: string,
    person: ResolvedPerson,
    origin: ChangeOrigin,
  ): Promise<string> {
    const requests = await database
      .selectFrom('pickup_confirmation_requests')
      .select(['id', 'person_name', 'status'])
      .where('child_id', '=', child.id)
      .where('pickup_date', '=', date)
      .orderBy('requested_at', 'desc')
      .execute();
    const matching = requests.find((request) => normalizeName(request.person_name) === normalizeName(person.fullName));
    if (matching?.status === 'confirmed') {
      return matching.id;
    }
    if (matching?.status === 'refused') {
      throw ruleViolationError('BR-56', 'Phụ huynh đã từ chối người đón này', [
        { field: 'confirmation_request_id', message: matching.id },
      ]);
    }
    let requestId = matching?.id;
    if (!requestId) {
      const guardianUserIds = await this.guardianUserIds(database, child.id);
      if (guardianUserIds.length === 0) {
        throw ruleViolationError(
          'BR-56',
          'Người này không có trong danh sách được ủy quyền và trẻ chưa có phụ huynh dùng ứng dụng để xác nhận',
        );
      }
      requestId = await database.transaction().execute(async (transaction) => {
        const created = await transaction
          .insertInto('pickup_confirmation_requests')
          .values({
            child_id: child.id,
            pickup_date: date,
            person_name: person.fullName,
            relationship: person.relationship,
            phone: person.phone,
            requested_by: origin.actorUserId,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: child.org_unit_id,
          entityName: 'pickup_confirmation_requests',
          entityId: created.id,
          action: 'create',
          before: null,
          after: {
            child_id: child.id,
            pickup_date: date,
            person_name: person.fullName,
            relationship: person.relationship,
          },
        });
        await queueNotification(transaction, {
          orgUnitId: child.org_unit_id,
          templateCode: 'pickup_confirmation_requested',
          title: 'Yêu cầu xác nhận người đón',
          body: `${person.fullName} (${person.relationship}) đến đón ${child.full_name}; người này không có trong danh sách được ủy quyền`,
          targetType: 'children',
          targetId: child.id,
          recipients: guardianUserIds.map((userId) => ({ userId, channel: 'in_app' as const })),
        });
        return created.id;
      });
    }
    throw ruleViolationError('BR-56', 'Người này không có trong danh sách được ủy quyền, đang chờ phụ huynh xác nhận', [
      { field: 'confirmation_request_id', message: requestId },
    ]);
  }

  // Phụ huynh được đánh dấu đón trẻ và người được ủy quyền còn hiệu lực thì được bàn giao không cần xác nhận (BR-56)
  private async resolvePerson(
    database: Kysely<SchoolYearDatabase>,
    childId: string,
    date: string,
    person: PickupPerson,
  ): Promise<ResolvedPerson> {
    if ('guardianId' in person) {
      const guardian = await database
        .selectFrom('child_guardians')
        .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
        .innerJoin('catalog_items', 'catalog_items.id', 'child_guardians.relationship_item_id')
        .select([
          'guardians.id',
          'guardians.full_name',
          'guardians.phone',
          'catalog_items.name as relationship',
          'child_guardians.can_pickup',
        ])
        .where('child_guardians.child_id', '=', childId)
        .where('guardians.id', '=', person.guardianId)
        .executeTakeFirst();
      if (!guardian) {
        throw validationError([{ field: 'guardian_id', message: 'Phụ huynh này không thuộc hồ sơ của trẻ' }]);
      }
      return {
        kind: guardian.can_pickup ? 'guardian' : null,
        fullName: guardian.full_name,
        relationship: guardian.relationship,
        phone: guardian.phone,
        guardianId: guardian.can_pickup ? guardian.id : null,
        authorizedPickupId: null,
      };
    }
    if ('authorizedPickupId' in person) {
      const authorized = await database
        .selectFrom('authorized_pickups')
        .select(['id', 'full_name', 'relationship', 'phone', 'valid_from', 'valid_to', 'status'])
        .where('child_id', '=', childId)
        .where('id', '=', person.authorizedPickupId)
        .executeTakeFirst();
      if (!authorized) {
        throw validationError([{ field: 'authorized_pickup_id', message: 'Người này không thuộc danh sách của trẻ' }]);
      }
      // Ủy quyền đã hủy hoặc hết hạn thì coi như người ngoài danh sách (CTC-P02-038)
      const valid = authorized.status === 'active' && this.isValidOn(authorized, date);
      return {
        kind: valid ? 'authorized' : null,
        fullName: authorized.full_name,
        relationship: authorized.relationship,
        phone: authorized.phone,
        guardianId: null,
        authorizedPickupId: valid ? authorized.id : null,
      };
    }
    return {
      kind: null,
      fullName: person.fullName,
      relationship: person.relationship,
      phone: person.phone,
      guardianId: null,
      authorizedPickupId: null,
    };
  }

  private async pickupPeople(database: Kysely<SchoolYearDatabase>, childIds: string[], date: string) {
    if (childIds.length === 0) {
      return { guardians: [], authorized: [] };
    }
    const guardians = await database
      .selectFrom('child_guardians')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .innerJoin('catalog_items', 'catalog_items.id', 'child_guardians.relationship_item_id')
      .select([
        'child_guardians.child_id',
        'guardians.id as guardian_id',
        'guardians.full_name',
        'guardians.phone',
        'catalog_items.name as relationship',
      ])
      .where('child_guardians.child_id', 'in', childIds)
      .where('child_guardians.can_pickup', '=', true)
      .orderBy('child_guardians.is_primary', 'desc')
      .execute();
    const authorized = (
      await database
        .selectFrom('authorized_pickups')
        .select(['id', 'child_id', 'full_name', 'relationship', 'phone', 'valid_from', 'valid_to'])
        .where('child_id', 'in', childIds)
        .where('status', '=', 'active')
        .orderBy('created_at')
        .execute()
    ).map((row) => ({ ...row, is_valid_today: this.isValidOn(row, date) }));
    return { guardians, authorized };
  }

  private isValidOn(row: { valid_from: string; valid_to: string | null }, date: string): boolean {
    return row.valid_from <= date && (row.valid_to === null || row.valid_to >= date);
  }

  private async findChild(database: Kysely<SchoolYearDatabase>, childId: string): Promise<ChildContext> {
    const child = await database
      .selectFrom('children')
      .leftJoin('class_enrollments', (join) =>
        join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
      )
      .select([
        'children.id',
        'children.full_name',
        'children.org_unit_id',
        'children.status',
        'class_enrollments.class_id',
      ])
      .where('children.id', '=', childId)
      .executeTakeFirst();
    if (!child) {
      throw notFoundError('Không tìm thấy trẻ', 'child');
    }
    return child;
  }

  private async assertCanReadPickupList(
    currentUser: CurrentUser,
    database: Kysely<SchoolYearDatabase>,
    child: ChildContext,
  ): Promise<void> {
    if (currentUser.hasPermission(PERMISSION_CODES.pickupGateConfirm)) {
      const scope = await this.organizationScopes.resolve(currentUser, PERMISSION_CODES.pickupGateConfirm);
      if (scope.wholeSchool || scope.orgUnitIds.includes(child.org_unit_id)) {
        return;
      }
    }
    await this.childScope.assertCanRead(currentUser, database, child.id);
  }

  private async assertCanManageAuthorized(
    currentUser: CurrentUser,
    database: Kysely<SchoolYearDatabase>,
    child: ChildContext,
  ): Promise<'parent' | 'staff'> {
    if (await this.isGuardianOf(database, currentUser.id, child.id)) {
      return 'parent';
    }
    if (currentUser.hasPermission(PERMISSION_CODES.authorizedPickupManage)) {
      await this.organizationScopes.assertCanAccess(
        currentUser,
        PERMISSION_CODES.authorizedPickupManage,
        child.org_unit_id,
      );
      return 'staff';
    }
    throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền khai báo người đón cho trẻ này');
  }

  private async isGuardianOf(database: Kysely<SchoolYearDatabase>, userId: string, childId: string): Promise<boolean> {
    const guardian = await database
      .selectFrom('child_guardians')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .select('guardians.id')
      .where('child_guardians.child_id', '=', childId)
      .where('guardians.user_id', '=', userId)
      .executeTakeFirst();
    return guardian !== undefined;
  }

  private async guardianUserIds(database: Kysely<SchoolYearDatabase>, childId: string): Promise<string[]> {
    const rows = await database
      .selectFrom('child_guardians')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .select('guardians.user_id')
      .where('child_guardians.child_id', '=', childId)
      .where('guardians.user_id', 'is not', null)
      .execute();
    return [...new Set(rows.map((row) => row.user_id).filter((id): id is string => id !== null))];
  }

  // Bàn giao chỉ giáo viên chủ nhiệm đang được phân công lớp của trẻ (P04-03)
  async isHomeroomTeacher(
    currentUser: CurrentUser,
    database: Kysely<SchoolYearDatabase>,
    classId: string,
  ): Promise<boolean> {
    if (!currentUser.description.assignments.some((assignment) => assignment.role_code === 'VT-07')) {
      return false;
    }
    const homeroom = await database
      .selectFrom('class_staff_assignments')
      .select('id')
      .where('class_id', '=', classId)
      .where('staff_user_id', '=', currentUser.id)
      .where('assignment_role', '=', 'homeroom')
      .where('status', '=', 'active')
      .executeTakeFirst();
    return homeroom !== undefined;
  }
}
