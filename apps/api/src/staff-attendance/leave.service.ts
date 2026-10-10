import { Injectable } from '@nestjs/common';
import type { DayHalf, LeaveRequestStatus, SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, validationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Kysely, Transaction } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import { SchoolCalendar, VIETNAM_DATE } from '../attendance/school-calendar.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification } from '../common/notification-queue.js';
import { notFoundError } from '../common/request-fields.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { assertMonthsOpen, leavePortions } from './timesheet-periods.js';

// Quy định phép năm (P08-11), số ngày phép (BR-41), đơn nghỉ phép (P08-03, BR-40; QT-06 E4, E5, E6; YCTD-59).
// Phép năm tính theo năm dương lịch; quy định chung toàn trường theo chức danh và thâm niên tính bằng năm tròn từ ngày
// vào làm đến ngày 1 tháng 1. Nhân sự tự gửi đơn hoặc phòng nhân sự lập hộ; Hiệu trưởng, Phó Hiệu trưởng duyệt
export interface LeavePolicyInput {
  jobTitleId: string;
  seniorityFromYears: number;
  seniorityToYears: number | null;
  entitledDays: number;
}

export interface LeaveRequestInput {
  staffId: string | null;
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  firstDayHalf: DayHalf | null;
  lastDayHalf: DayHalf | null;
  reason: string;
}

type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

const REQUEST_COLUMNS = [
  'leave_requests.id',
  'leave_requests.staff_id',
  'leave_requests.leave_type_id',
  'leave_requests.is_paid',
  'leave_requests.deducts_annual_leave',
  'leave_requests.insurance_paid',
  'leave_requests.from_date',
  'leave_requests.to_date',
  'leave_requests.first_day_half',
  'leave_requests.last_day_half',
  'leave_requests.days',
  'leave_requests.reason',
  'leave_requests.status',
  'leave_requests.created_by',
  'leave_requests.requested_at',
  'leave_requests.decided_by',
  'leave_requests.decided_at',
  'leave_requests.reject_reason',
] as const;

function seniorityYears(startDate: string, year: number): number {
  const start = Number(startDate.slice(0, 4));
  const startsAfterNewYear = startDate.slice(5) !== '01-01';
  return Math.max(0, year - start - (startsAfterNewYear ? 1 : 0));
}

@Injectable()
export class LeaveService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly calendar: SchoolCalendar,
    private readonly clock: Clock,
  ) {}

  // Quy định phép năm: mọi người có quyền xem nhân sự hoặc quản lý quy định đều xem được
  async listPolicies() {
    const { database } = await this.currentSchoolYear.require();
    const rows = await database
      .selectFrom('leave_policies')
      .innerJoin('job_titles', 'job_titles.id', 'leave_policies.job_title_id')
      .innerJoin('org_units', 'org_units.id', 'job_titles.org_unit_id')
      .selectAll('leave_policies')
      .select(['job_titles.name as job_title_name', 'org_units.name as unit_name'])
      .orderBy('org_units.name')
      .orderBy('job_titles.name')
      .orderBy('leave_policies.seniority_from_years')
      .execute();
    return rows.map((row) => ({ ...row, entitled_days: Number(row.entitled_days) }));
  }

  async createPolicy(currentUser: CurrentUser, input: LeavePolicyInput, origin: ChangeOrigin) {
    await this.assertPolicyManager(currentUser);
    const { database } = await this.currentSchoolYear.require();
    await this.assertPolicyRange(database, input, null);
    const created = await database.transaction().execute(async (transaction) => {
      const row = await transaction
        .insertInto('leave_policies')
        .values({
          job_title_id: input.jobTitleId,
          seniority_from_years: input.seniorityFromYears,
          seniority_to_years: input.seniorityToYears,
          entitled_days: input.entitledDays,
          created_by: origin.actorUserId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'leave_policies',
        entityId: row.id,
        action: 'create',
        before: null,
        after: input,
      });
      return row;
    });
    return (await this.listPolicies()).find((row) => row.id === created.id);
  }

  async updatePolicy(
    currentUser: CurrentUser,
    policyId: string,
    input: LeavePolicyInput & { status: 'active' | 'inactive' },
    origin: ChangeOrigin,
  ) {
    await this.assertPolicyManager(currentUser);
    const { database } = await this.currentSchoolYear.require();
    const existing = await database
      .selectFrom('leave_policies')
      .selectAll()
      .where('id', '=', policyId)
      .executeTakeFirst();
    if (!existing) {
      throw notFoundError('Không tìm thấy quy định phép năm', 'leave_policy');
    }
    if (input.status === 'active') {
      await this.assertPolicyRange(database, input, policyId);
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('leave_policies')
        .set({
          job_title_id: input.jobTitleId,
          seniority_from_years: input.seniorityFromYears,
          seniority_to_years: input.seniorityToYears,
          entitled_days: input.entitledDays,
          status: input.status,
          updated_at: this.clock.now(),
        })
        .where('id', '=', policyId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'leave_policies',
        entityId: policyId,
        action: 'update',
        before: existing,
        after: input,
      });
    });
    return (await this.listPolicies()).find((row) => row.id === policyId);
  }

  // Số ngày phép năm của nhân sự trong đơn vị; người chưa được cấp thì tính thử theo quy định hiện hành
  async listBalances(currentUser: CurrentUser, orgUnitId: string, year: number) {
    if (
      !(await this.inScope(currentUser, PERMISSION_CODES.staffAttendanceView, orgUnitId)) &&
      !(await this.inScope(currentUser, PERMISSION_CODES.leaveApprove, orgUnitId))
    ) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem số ngày phép của đơn vị này');
    }
    const { database } = await this.currentSchoolYear.require();
    const staff = await database
      .selectFrom('staff')
      .select(['id', 'code', 'full_name', 'job_title_id', 'start_date'])
      .where('org_unit_id', '=', orgUnitId)
      .where('status', '=', 'active')
      .orderBy('full_name')
      .execute();
    const result = [];
    for (const row of staff) {
      result.push({
        staff_id: row.id,
        code: row.code,
        full_name: row.full_name,
        ...(await this.balanceView(database, row, year)),
      });
    }
    return result;
  }

  // Phòng nhân sự chỉnh số ngày được cấp của một năm kèm lý do; chưa cấp thì tạo mới
  async adjustBalance(
    currentUser: CurrentUser,
    input: { staffId: string; year: number; entitledDays: number; reason: string },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const staff = await this.loadStaff(database, input.staffId);
    await this.assertAttendanceManager(currentUser, staff.org_unit_id);
    const existing = await database
      .selectFrom('leave_balances')
      .selectAll()
      .where('staff_id', '=', input.staffId)
      .where('balance_year', '=', input.year)
      .executeTakeFirst();
    if (existing && Number(existing.used_days) > input.entitledDays) {
      throw ruleViolationError(
        'BR-41',
        `Số ngày được cấp không được nhỏ hơn số ngày đã nghỉ (${Number(existing.used_days)})`,
      );
    }
    await database.transaction().execute(async (transaction) => {
      const row = existing
        ? await transaction
            .updateTable('leave_balances')
            .set({
              entitled_days: input.entitledDays,
              adjust_reason: input.reason,
              updated_by: origin.actorUserId,
              updated_at: this.clock.now(),
            })
            .where('id', '=', existing.id)
            .returning('id')
            .executeTakeFirstOrThrow()
        : await transaction
            .insertInto('leave_balances')
            .values({
              staff_id: input.staffId,
              balance_year: input.year,
              entitled_days: input.entitledDays,
              adjust_reason: input.reason,
              updated_by: origin.actorUserId,
            })
            .returning('id')
            .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: staff.org_unit_id,
        entityName: 'leave_balances',
        entityId: row.id,
        action: existing ? 'update' : 'create',
        before: existing ?? null,
        after: { entitled_days: input.entitledDays, reason: input.reason, year: input.year },
      });
    });
    const full = await database
      .selectFrom('staff')
      .select(['id', 'job_title_id', 'start_date'])
      .where('id', '=', input.staffId)
      .executeTakeFirstOrThrow();
    return this.balanceView(database, full, input.year);
  }

  // Đơn nghỉ của chính mình kèm số ngày phép năm hiện tại
  async mine(currentUser: CurrentUser) {
    const { database } = await this.currentSchoolYear.require();
    const staff = await database
      .selectFrom('staff')
      .select(['id', 'job_title_id', 'start_date', 'full_name'])
      .where('user_id', '=', currentUser.id)
      .executeTakeFirst();
    if (!staff) {
      throw notFoundError('Tài khoản chưa gắn với hồ sơ nhân sự', 'staff');
    }
    const year = Number(this.today().slice(0, 4));
    return {
      staff: { id: staff.id, full_name: staff.full_name },
      balance: { year, ...(await this.balanceView(database, staff, year)) },
      requests: await this.requestQuery(database).where('leave_requests.staff_id', '=', staff.id).execute(),
    };
  }

  // Danh sách đơn của đơn vị cho người duyệt, phòng nhân sự và người xem bảng công
  async list(currentUser: CurrentUser, filter: { orgUnitId: string; status: LeaveRequestStatus | null }) {
    const canSee = await Promise.all(
      [PERMISSION_CODES.leaveApprove, PERMISSION_CODES.staffAttendanceManage, PERMISSION_CODES.staffAttendanceView].map(
        (permission) => this.inScope(currentUser, permission, filter.orgUnitId),
      ),
    );
    if (!canSee.some(Boolean)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem đơn nghỉ của đơn vị này');
    }
    const { database } = await this.currentSchoolYear.require();
    let query = this.requestQuery(database).where('staff.org_unit_id', '=', filter.orgUnitId);
    if (filter.status) {
      query = query.where('leave_requests.status', '=', filter.status);
    }
    return {
      can_approve: canSee[0],
      can_manage: canSee[1],
      requests: await query.execute(),
    };
  }

  async create(currentUser: CurrentUser, input: LeaveRequestInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const staff = input.staffId
      ? await this.loadStaff(database, input.staffId)
      : await database
          .selectFrom('staff')
          .select(['id', 'org_unit_id', 'full_name', 'status', 'user_id', 'job_title_id', 'start_date', 'end_date'])
          .where('user_id', '=', currentUser.id)
          .executeTakeFirst();
    if (!staff) {
      throw notFoundError('Tài khoản chưa gắn với hồ sơ nhân sự', 'staff');
    }
    if (staff.user_id !== currentUser.id) {
      await this.assertAttendanceManager(currentUser, staff.org_unit_id);
    }
    if (staff.status !== 'active') {
      throw ruleViolationError('BR-40', 'Hồ sơ nhân sự đã nghỉ việc, không gửi đơn nghỉ được');
    }
    if (input.fromDate.slice(0, 4) !== input.toDate.slice(0, 4)) {
      throw validationError([
        { field: 'to_date', message: 'Đơn nghỉ phải nằm trong cùng một năm, tách thành hai đơn' },
      ]);
    }
    const leaveType = await database
      .selectFrom('catalog_items')
      .select(['id', 'name', 'status', 'attributes', 'catalog_type'])
      .where('id', '=', input.leaveTypeId)
      .executeTakeFirst();
    if (!leaveType || leaveType.catalog_type !== 'leave_type' || leaveType.status !== 'active') {
      throw validationError([{ field: 'leave_type_id', message: 'Loại nghỉ không có hoặc đã ngừng dùng' }]);
    }
    const attributes = leaveType.attributes as {
      is_paid?: boolean;
      deducts_annual_leave?: boolean;
      insurance_paid?: boolean;
    };
    if (typeof attributes.is_paid !== 'boolean') {
      throw ruleViolationError('BR-40', 'Loại nghỉ này chưa khai thuộc tính tính công ở danh mục dùng chung');
    }
    const days = await this.countDays(input);
    if (days <= 0) {
      throw ruleViolationError('BR-40', 'Khoảng thời gian này không có ngày làm việc nào');
    }
    await assertMonthsOpen(database, staff.org_unit_id, input.fromDate, input.toDate);
    await this.assertNoOverlap(database, staff.id, input.fromDate, input.toDate, null);
    const year = Number(input.fromDate.slice(0, 4));
    if (attributes.deducts_annual_leave) {
      const balance = await this.balanceView(database, staff, year);
      if (balance.policy_missing) {
        throw ruleViolationError(
          'BR-41',
          'Chưa có quy định phép năm cho nhân sự này, cần cấu hình ở Quy định phép năm',
        );
      }
      if ((balance.remaining_days ?? 0) < days) {
        throw ruleViolationError(
          'BR-41',
          `Số ngày phép còn lại không đủ (còn ${balance.remaining_days}, đơn ${days} ngày), chọn loại nghỉ không lương`,
        );
      }
    }
    const created = await database.transaction().execute(async (transaction) => {
      const row = await transaction
        .insertInto('leave_requests')
        .values({
          staff_id: staff.id,
          leave_type_id: leaveType.id,
          is_paid: attributes.is_paid === true,
          deducts_annual_leave: attributes.deducts_annual_leave === true,
          insurance_paid: attributes.insurance_paid === true,
          from_date: input.fromDate,
          to_date: input.toDate,
          first_day_half: input.firstDayHalf,
          last_day_half: input.lastDayHalf,
          days,
          reason: input.reason,
          created_by: origin.actorUserId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: staff.org_unit_id,
        entityName: 'leave_requests',
        entityId: row.id,
        action: 'create',
        before: null,
        after: { ...input, staffId: staff.id, days },
      });
      await queueNotification(transaction, {
        orgUnitId: staff.org_unit_id,
        templateCode: 'leave_request_submitted',
        title: 'Đơn nghỉ phép cần duyệt',
        body: `${staff.full_name} xin nghỉ ${leaveType.name} ${days} ngày từ ${input.fromDate} đến ${input.toDate}`,
        targetType: 'leave_requests',
        targetId: row.id,
        recipients: await this.approverRecipients(transaction, staff.org_unit_id),
      });
      return row;
    });
    return this.readRequest(database, created.id);
  }

  async approve(currentUser: CurrentUser, requestId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const request = await this.loadPending(database, requestId);
    await this.assertApprover(currentUser, request);
    await assertMonthsOpen(database, request.org_unit_id, request.from_date, request.to_date);
    await this.assertNoOverlap(database, request.staff_id, request.from_date, request.to_date, request.id);
    const days = Number(request.days);
    await database.transaction().execute(async (transaction) => {
      if (request.deducts_annual_leave) {
        const year = Number(request.from_date.slice(0, 4));
        const balance = await this.ensureBalance(transaction, request.staff_id, year, origin);
        const remaining = Number(balance.entitled_days) - Number(balance.used_days);
        if (remaining < days) {
          throw ruleViolationError(
            'BR-41',
            `Số ngày phép còn lại không đủ (còn ${remaining}, đơn ${days} ngày), đề nghị chuyển sang nghỉ không lương`,
          );
        }
        await transaction
          .updateTable('leave_balances')
          .set({ used_days: Number(balance.used_days) + days, updated_at: this.clock.now() })
          .where('id', '=', balance.id)
          .execute();
      }
      await this.decide(transaction, request, 'approved', null, origin);
    });
    return this.readRequest(database, requestId);
  }

  async reject(currentUser: CurrentUser, requestId: string, reason: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const request = await this.loadPending(database, requestId);
    await this.assertApprover(currentUser, request);
    await database
      .transaction()
      .execute((transaction) => this.decide(transaction, request, 'rejected', reason, origin));
    return this.readRequest(database, requestId);
  }

  // Người gửi, chính nhân sự hoặc phòng nhân sự của đơn vị hủy được đơn còn chờ duyệt
  async cancel(currentUser: CurrentUser, requestId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const request = await this.loadPending(database, requestId);
    if (
      request.created_by !== currentUser.id &&
      request.user_id !== currentUser.id &&
      !(await this.inScope(currentUser, PERMISSION_CODES.staffAttendanceManage, request.org_unit_id))
    ) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền hủy đơn nghỉ này');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('leave_requests')
        .set({ status: 'cancelled', decided_by: origin.actorUserId, decided_at: this.clock.now() })
        .where('id', '=', requestId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: request.org_unit_id,
        entityName: 'leave_requests',
        entityId: requestId,
        action: 'update',
        before: { status: 'pending' },
        after: { status: 'cancelled' },
      });
    });
    return this.readRequest(database, requestId);
  }

  // Số ngày phép của một năm: đã cấp thì đọc; chưa cấp thì tính theo quy định khớp chức danh và thâm niên
  private async balanceView(
    database: Executor,
    staff: { id: string; job_title_id: string | null; start_date: string },
    year: number,
  ) {
    const balance = await database
      .selectFrom('leave_balances')
      .selectAll()
      .where('staff_id', '=', staff.id)
      .where('balance_year', '=', year)
      .executeTakeFirst();
    if (balance) {
      const entitled = Number(balance.entitled_days);
      const used = Number(balance.used_days);
      return {
        granted: true,
        policy_missing: false,
        entitled_days: entitled,
        used_days: used,
        remaining_days: entitled - used,
        adjust_reason: balance.adjust_reason,
      };
    }
    const policy = await this.matchPolicy(database, staff, year);
    return {
      granted: false,
      policy_missing: !policy,
      entitled_days: policy ? Number(policy.entitled_days) : null,
      used_days: 0,
      remaining_days: policy ? Number(policy.entitled_days) : null,
      adjust_reason: null,
    };
  }

  private async matchPolicy(
    database: Executor,
    staff: { job_title_id: string | null; start_date: string },
    year: number,
  ) {
    if (!staff.job_title_id) {
      return undefined;
    }
    const seniority = seniorityYears(staff.start_date, year);
    return database
      .selectFrom('leave_policies')
      .select(['id', 'entitled_days'])
      .where('job_title_id', '=', staff.job_title_id)
      .where('status', '=', 'active')
      .where('seniority_from_years', '<=', seniority)
      .where((expression) =>
        expression.or([expression('seniority_to_years', 'is', null), expression('seniority_to_years', '>', seniority)]),
      )
      .executeTakeFirst();
  }

  private async ensureBalance(
    transaction: Transaction<SchoolYearDatabase>,
    staffId: string,
    year: number,
    origin: ChangeOrigin,
  ) {
    const existing = await transaction
      .selectFrom('leave_balances')
      .select(['id', 'entitled_days', 'used_days'])
      .where('staff_id', '=', staffId)
      .where('balance_year', '=', year)
      .forUpdate()
      .executeTakeFirst();
    if (existing) {
      return existing;
    }
    const staff = await transaction
      .selectFrom('staff')
      .select(['job_title_id', 'start_date'])
      .where('id', '=', staffId)
      .executeTakeFirstOrThrow();
    const policy = await this.matchPolicy(transaction, staff, year);
    if (!policy) {
      throw ruleViolationError('BR-41', 'Chưa có quy định phép năm cho nhân sự này, cần cấu hình ở Quy định phép năm');
    }
    return transaction
      .insertInto('leave_balances')
      .values({
        staff_id: staffId,
        balance_year: year,
        entitled_days: policy.entitled_days,
        policy_id: policy.id,
        updated_by: origin.actorUserId,
      })
      .returning(['id', 'entitled_days', 'used_days'])
      .executeTakeFirstOrThrow();
  }

  private async decide(
    transaction: Transaction<SchoolYearDatabase>,
    request: { id: string; org_unit_id: string; user_id: string | null; from_date: string; to_date: string },
    status: 'approved' | 'rejected',
    reason: string | null,
    origin: ChangeOrigin,
  ) {
    await transaction
      .updateTable('leave_requests')
      .set({ status, reject_reason: reason, decided_by: origin.actorUserId, decided_at: this.clock.now() })
      .where('id', '=', request.id)
      .execute();
    await writeAuditLog(transaction, {
      origin,
      orgUnitId: request.org_unit_id,
      entityName: 'leave_requests',
      entityId: request.id,
      action: 'update',
      before: { status: 'pending' },
      after: { status, reject_reason: reason },
    });
    if (request.user_id) {
      await queueNotification(transaction, {
        orgUnitId: request.org_unit_id,
        templateCode: status === 'approved' ? 'leave_request_approved' : 'leave_request_rejected',
        title: status === 'approved' ? 'Đơn nghỉ phép đã được duyệt' : 'Đơn nghỉ phép bị từ chối',
        body: `Đơn nghỉ từ ${request.from_date} đến ${request.to_date}${reason ? `: ${reason}` : ''}`,
        targetType: 'leave_requests',
        targetId: request.id,
        recipients: [{ userId: request.user_id, channel: 'in_app' }],
      });
    }
  }

  private async countDays(input: LeaveRequestInput): Promise<number> {
    const portions = leavePortions(await this.calendar.staffDays(input.fromDate, input.toDate), {
      from_date: input.fromDate,
      to_date: input.toDate,
      first_day_half: input.firstDayHalf,
      last_day_half: input.lastDayHalf,
    });
    return [...portions.values()].reduce((total, portion) => total + portion, 0);
  }

  // Không trùng ngày với đơn còn chờ duyệt hoặc đã duyệt của cùng nhân sự (QT-06 E5)
  private async assertNoOverlap(
    database: Executor,
    staffId: string,
    from: string,
    to: string,
    exceptId: string | null,
  ) {
    let query = database
      .selectFrom('leave_requests')
      .select(['from_date', 'to_date', 'status'])
      .where('staff_id', '=', staffId)
      .where('status', 'in', ['pending', 'approved'])
      .where('from_date', '<=', to)
      .where('to_date', '>=', from);
    if (exceptId) {
      query = query.where('id', '!=', exceptId);
    }
    const overlapping = await query.executeTakeFirst();
    if (overlapping) {
      throw ruleViolationError(
        'BR-40',
        `Khoảng thời gian này trùng đơn nghỉ ${overlapping.status === 'approved' ? 'đã được duyệt' : 'đang chờ duyệt'} từ ${overlapping.from_date} đến ${overlapping.to_date}`,
      );
    }
  }

  private requestQuery(database: Executor) {
    return database
      .selectFrom('leave_requests')
      .innerJoin('staff', 'staff.id', 'leave_requests.staff_id')
      .innerJoin('catalog_items', 'catalog_items.id', 'leave_requests.leave_type_id')
      .select(REQUEST_COLUMNS)
      .select([
        'staff.full_name',
        'staff.code as staff_code',
        'staff.org_unit_id',
        'catalog_items.name as leave_type_name',
      ])
      .orderBy('leave_requests.from_date', 'desc');
  }

  private async readRequest(database: Executor, requestId: string) {
    const row = await this.requestQuery(database).where('leave_requests.id', '=', requestId).executeTakeFirstOrThrow();
    return { ...row, days: Number(row.days) };
  }

  private async loadPending(database: Executor, requestId: string) {
    const request = await database
      .selectFrom('leave_requests')
      .innerJoin('staff', 'staff.id', 'leave_requests.staff_id')
      .select([
        'leave_requests.id',
        'leave_requests.staff_id',
        'leave_requests.status',
        'leave_requests.from_date',
        'leave_requests.to_date',
        'leave_requests.days',
        'leave_requests.deducts_annual_leave',
        'leave_requests.created_by',
        'staff.org_unit_id',
        'staff.user_id',
      ])
      .where('leave_requests.id', '=', requestId)
      .executeTakeFirst();
    if (!request) {
      throw notFoundError('Không tìm thấy đơn nghỉ phép', 'leave_request');
    }
    if (request.status !== 'pending') {
      throw ruleViolationError('BR-40', 'Đơn nghỉ này không còn chờ duyệt');
    }
    return request;
  }

  private async loadStaff(database: Executor, staffId: string) {
    const staff = await database
      .selectFrom('staff')
      .select(['id', 'org_unit_id', 'full_name', 'status', 'user_id', 'job_title_id', 'start_date', 'end_date'])
      .where('id', '=', staffId)
      .executeTakeFirst();
    if (!staff) {
      throw notFoundError('Không tìm thấy hồ sơ nhân sự', 'staff');
    }
    return staff;
  }

  // Hiệu trưởng hoặc Phó Hiệu trưởng trong phạm vi đơn vị duyệt; không tự duyệt đơn của chính mình (YCTD-58)
  private async assertApprover(currentUser: CurrentUser, request: { org_unit_id: string; user_id: string | null }) {
    if (!(await this.inScope(currentUser, PERMISSION_CODES.leaveApprove, request.org_unit_id))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền duyệt đơn nghỉ của đơn vị này');
    }
    if (request.user_id === currentUser.id) {
      throw ruleViolationError('BR-40', 'Không tự duyệt đơn nghỉ của chính mình');
    }
  }

  private async approverRecipients(transaction: Transaction<SchoolYearDatabase>, orgUnitId: string) {
    const root = await transaction
      .selectFrom('org_units')
      .select('id')
      .where('unit_type', '=', 'truong_chinh')
      .executeTakeFirst();
    return [
      { roleCode: 'VT-15', orgUnitId, channel: 'in_app' as const },
      ...(root ? [{ roleCode: 'VT-02', orgUnitId: root.id, channel: 'in_app' as const }] : []),
    ];
  }

  private async assertPolicyRange(database: Executor, input: LeavePolicyInput, exceptId: string | null) {
    const jobTitle = await database
      .selectFrom('job_titles')
      .select('status')
      .where('id', '=', input.jobTitleId)
      .executeTakeFirst();
    if (!jobTitle || jobTitle.status !== 'active') {
      throw validationError([{ field: 'job_title_id', message: 'Chức danh không có hoặc đã ngừng dùng' }]);
    }
    let query = database
      .selectFrom('leave_policies')
      .select(['seniority_from_years', 'seniority_to_years'])
      .where('job_title_id', '=', input.jobTitleId)
      .where('status', '=', 'active')
      .where((expression) =>
        expression.or([
          expression('seniority_to_years', 'is', null),
          expression('seniority_to_years', '>', input.seniorityFromYears),
        ]),
      );
    if (input.seniorityToYears !== null) {
      query = query.where('seniority_from_years', '<', input.seniorityToYears);
    }
    if (exceptId) {
      query = query.where('id', '!=', exceptId);
    }
    const overlapping = await query.executeTakeFirst();
    if (overlapping) {
      throw ruleViolationError(
        'BR-41',
        `Khoảng thâm niên trùng quy định từ ${overlapping.seniority_from_years} năm${
          overlapping.seniority_to_years === null ? ' trở lên' : ` đến dưới ${overlapping.seniority_to_years} năm`
        } của cùng chức danh`,
      );
    }
  }

  private async assertPolicyManager(currentUser: CurrentUser) {
    const scope = await this.organizationScopes.resolveStaff(currentUser, PERMISSION_CODES.leavePolicyManage);
    if (!scope.wholeSchool) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ phòng nhân sự gán ở Trường chính được lập quy định phép năm');
    }
  }

  private async assertAttendanceManager(currentUser: CurrentUser, orgUnitId: string) {
    if (!(await this.inScope(currentUser, PERMISSION_CODES.staffAttendanceManage, orgUnitId))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền quản lý chấm công của đơn vị này');
    }
  }

  private async inScope(currentUser: CurrentUser, permission: string, orgUnitId: string): Promise<boolean> {
    const scope = await this.organizationScopes.resolveStaff(currentUser, permission);
    return scope.wholeSchool || scope.orgUnitIds.includes(orgUnitId);
  }

  private today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }
}
