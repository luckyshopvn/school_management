import { Injectable } from '@nestjs/common';
import type { LateChargeMethod, SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, validationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import { sql, type Kysely } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import { ChildScope } from '../children/child-scope.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification, type NotificationRecipient } from '../common/notification-queue.js';
import { notFoundError } from '../common/request-fields.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { periodRange, RegistrationPeriods, type Period } from './registration-periods.js';

// Đăng ký dịch vụ theo tháng, chốt danh sách kỳ, đăng ký và hủy trễ, đăng ký học hè
// (P05-03, P05-04, P05-13; QT-03 bước 1 đến 3; BR-26, BR-83, BR-92; YCTD-49, YCTD-50).
// Dịch vụ bắt buộc tự có cho trẻ đang học; dịch vụ không bắt buộc tự giữ từ tháng trước cho tới khi hủy, trừ tháng hè
const CARRIED_STATUSES = ['active', 'pending_cancel'];
const REGISTRATION_COLUMNS = [
  'service_registrations.id',
  'service_registrations.child_id',
  'service_registrations.service_id',
  'service_registrations.status',
  'service_registrations.source',
  'service_registrations.is_late',
  'service_registrations.service_start_date',
  'service_registrations.late_charge_method',
  'service_registrations.decision_note',
] as const;

interface ChildContext {
  id: string;
  full_name: string;
  org_unit_id: string;
  status: string;
  class_id: string | null;
}

@Injectable()
export class ServiceRegistrationsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly childScope: ChildScope,
    private readonly periods: RegistrationPeriods,
    private readonly clock: Clock,
  ) {}

  periodList() {
    return this.periods.list();
  }

  // Bảng đăng ký của đơn vị trong kỳ cho nhân sự (MH-05): mỗi dòng một trẻ đang học kèm các đăng ký
  async sheet(currentUser: CurrentUser, orgUnitId: string, period: Period) {
    await this.assertCanView(currentUser, orgUnitId);
    const { database } = await this.currentSchoolYear.require();
    const state = await this.periods.state(database, orgUnitId, period);
    const children = await database
      .selectFrom('children')
      .innerJoin('class_enrollments', (join) =>
        join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
      )
      .innerJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select(['children.id', 'children.full_name', 'children.org_unit_id', 'classes.name as class_name'])
      .where('children.org_unit_id', '=', orgUnitId)
      .where('children.status', '=', 'active')
      .orderBy('classes.name')
      .orderBy('children.full_name')
      .execute();
    const summerChildren = await this.summerChildIds(database, period);
    if (!state.is_locked) {
      await this.ensureRows(database, children, period, state.is_summer, summerChildren);
    }
    const registrations = await this.registrationsOf(
      database,
      children.map((child) => child.id),
      period,
    );
    return {
      ...state,
      org_unit_id: orgUnitId,
      services: await this.activeServices(database),
      children: children.map((child) => ({
        child_id: child.id,
        full_name: child.full_name,
        class_name: child.class_name,
        summer_registered: summerChildren.has(child.id),
        registrations: registrations.filter((row) => row.child_id === child.id),
      })),
    };
  }

  // Đăng ký của một trẻ trong kỳ cho phụ huynh và người được xem trẻ (MP-12)
  async childView(currentUser: CurrentUser, childId: string, period: Period) {
    const { database } = await this.currentSchoolYear.require();
    await this.childScope.assertCanRead(currentUser, database, childId);
    const child = await this.activeChild(database, childId);
    const state = await this.periods.state(database, child.org_unit_id, period);
    const summerChildren = await this.summerChildIds(database, period);
    if (!state.is_locked) {
      await this.ensureRows(database, [child], period, state.is_summer, summerChildren);
    }
    return {
      ...state,
      child_id: child.id,
      summer_registered: summerChildren.has(child.id),
      services: await this.activeServices(database),
      registrations: await this.registrationsOf(database, [child.id], period),
    };
  }

  // Đăng ký dịch vụ không bắt buộc; trong thời gian trễ phải có ngày bắt đầu học và chờ Ban Giám hiệu duyệt (BR-26, Q-150)
  async register(
    currentUser: CurrentUser,
    input: { childId: string; period: Period; serviceId: string; serviceStartDate: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const child = await this.activeChild(database, input.childId);
    const source = await this.actorFor(currentUser, database, child);
    const state = await this.periods.state(database, child.org_unit_id, input.period);
    const summerChildren = await this.summerChildIds(database, input.period);
    if (source === 'parent' && (await this.periods.blocksWhenOverdue(child.org_unit_id))) {
      await this.assertNoOverdue(database, child.id);
    }
    if (state.is_summer && !summerChildren.has(child.id)) {
      throw ruleViolationError('BR-92', 'Trẻ chưa đăng ký học hè tháng này');
    }
    const service = await database
      .selectFrom('services')
      .select(['id', 'name', 'status', 'is_mandatory'])
      .where('id', '=', input.serviceId)
      .executeTakeFirst();
    if (!service || service.status !== 'active') {
      throw validationError([{ field: 'service_id', message: 'Dịch vụ không có hoặc đã ngừng sử dụng' }]);
    }
    if (service.is_mandatory) {
      throw ruleViolationError('BR-83', 'Dịch vụ bắt buộc đã được đăng ký sẵn cho mọi trẻ đang học');
    }
    if (state.is_late) {
      const { from, to } = periodRange(input.period);
      if (!input.serviceStartDate) {
        throw validationError([
          { field: 'service_start_date', message: 'Đăng ký sau ngày chốt phải ghi ngày bắt đầu học dịch vụ' },
        ]);
      }
      if (input.serviceStartDate < from || input.serviceStartDate > to) {
        throw validationError([{ field: 'service_start_date', message: 'Ngày bắt đầu học phải thuộc kỳ đăng ký' }]);
      }
    }
    if (!state.is_locked) {
      await this.ensureRows(database, [child], input.period, state.is_summer, summerChildren);
    }
    const existing = await database
      .selectFrom('service_registrations')
      .select(['id', 'status'])
      .where('child_id', '=', child.id)
      .where('period_year', '=', input.period.year)
      .where('period_month', '=', input.period.month)
      .where('service_id', '=', service.id)
      .executeTakeFirst();
    if (existing && ['active', 'pending_late', 'pending_cancel'].includes(existing.status)) {
      throw new ApplicationError('ERR_CONFLICT', 'Trẻ đã đăng ký dịch vụ này trong kỳ', [
        { field: 'service_id', message: existing.status },
      ]);
    }
    const now = this.clock.now();
    const values = {
      status: state.is_late ? ('pending_late' as const) : ('active' as const),
      source,
      registered_by: origin.actorUserId,
      registered_at: now,
      is_late: state.is_late,
      service_start_date: state.is_late ? input.serviceStartDate : null,
      late_charge_method: null,
      decided_by: null,
      decided_at: null,
      decision_note: null,
      cancel_requested_by: null,
      cancel_requested_at: null,
      cancelled_by: null,
      cancelled_at: null,
      updated_at: now,
    };
    const saved = await database.transaction().execute(async (transaction) => {
      const row = existing
        ? await transaction
            .updateTable('service_registrations')
            .set(values)
            .where('id', '=', existing.id)
            .returning('id')
            .executeTakeFirstOrThrow()
        : await transaction
            .insertInto('service_registrations')
            .values({
              ...values,
              child_id: child.id,
              org_unit_id: child.org_unit_id,
              period_year: input.period.year,
              period_month: input.period.month,
              service_id: service.id,
            })
            .returning('id')
            .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: child.org_unit_id,
        entityName: 'service_registrations',
        entityId: row.id,
        action: existing ? 'update' : 'create',
        before: existing ?? null,
        after: { ...values, period: state.period, service_id: service.id },
      });
      if (state.is_late) {
        await queueNotification(transaction, {
          orgUnitId: child.org_unit_id,
          templateCode: 'late_registration_pending',
          title: 'Đăng ký dịch vụ trễ chờ duyệt',
          body: `${child.full_name} đăng ký ${service.name} kỳ ${state.period} sau ngày chốt, bắt đầu học từ ${input.serviceStartDate}`,
          targetType: 'service_registrations',
          targetId: row.id,
          recipients: await this.approverRecipients(transaction, child.org_unit_id),
        });
      }
      return row;
    });
    return this.findRegistration(database, saved.id);
  }

  // Hủy dịch vụ không bắt buộc; sau ngày chốt chờ Ban Giám hiệu duyệt (YCTD-50); rút đăng ký trễ chưa duyệt thì hủy ngay
  async cancel(currentUser: CurrentUser, registrationId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const registration = await this.loadRegistration(database, registrationId);
    const child = await this.childContext(database, registration.child_id);
    await this.actorFor(currentUser, database, child);
    if (registration.is_mandatory) {
      throw ruleViolationError('BR-83', 'Bán trú là dịch vụ bắt buộc, không hủy được');
    }
    const period = { year: registration.period_year, month: registration.period_month };
    const state = await this.periods.state(database, registration.org_unit_id, period);
    const now = this.clock.now();
    let next: 'cancelled' | 'pending_cancel';
    if (registration.status === 'pending_late') {
      next = 'cancelled';
    } else if (registration.status === 'active') {
      next = state.is_late ? 'pending_cancel' : 'cancelled';
    } else {
      throw ruleViolationError('BR-26', 'Đăng ký này không ở trạng thái hủy được');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('service_registrations')
        .set(
          next === 'cancelled'
            ? { status: next, cancelled_by: origin.actorUserId, cancelled_at: now, updated_at: now }
            : { status: next, cancel_requested_by: origin.actorUserId, cancel_requested_at: now, updated_at: now },
        )
        .where('id', '=', registration.id)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: registration.org_unit_id,
        entityName: 'service_registrations',
        entityId: registration.id,
        action: 'update',
        before: { status: registration.status },
        after: { status: next },
      });
      if (next === 'pending_cancel') {
        await queueNotification(transaction, {
          orgUnitId: registration.org_unit_id,
          templateCode: 'late_cancellation_pending',
          title: 'Hủy dịch vụ sau ngày chốt chờ duyệt',
          body: `${child.full_name} xin hủy ${registration.service_name} kỳ ${state.period} sau ngày chốt`,
          targetType: 'service_registrations',
          targetId: registration.id,
          recipients: await this.approverRecipients(transaction, registration.org_unit_id),
        });
      }
    });
    return this.findRegistration(database, registration.id);
  }

  // Ban Giám hiệu duyệt hoặc từ chối đăng ký trễ, hủy trễ; duyệt đăng ký trễ chọn thu cả tháng hoặc theo ngày thực tế (BR-26)
  async decide(
    currentUser: CurrentUser,
    registrationId: string,
    decision: { approve: boolean; chargeMethod: LateChargeMethod | null; note: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const registration = await this.loadRegistration(database, registrationId);
    await this.organizationScopes.assertCanAccess(
      currentUser,
      PERMISSION_CODES.lateRegistrationApprove,
      registration.org_unit_id,
    );
    if (registration.status !== 'pending_late' && registration.status !== 'pending_cancel') {
      throw ruleViolationError('BR-26', 'Đăng ký này không chờ duyệt');
    }
    if (decision.approve && registration.status === 'pending_late' && !decision.chargeMethod) {
      throw validationError([
        { field: 'charge_method', message: 'Chọn thu cả tháng (full_month) hoặc theo ngày thực tế (actual_days)' },
      ]);
    }
    if (!decision.approve && !decision.note) {
      throw validationError([{ field: 'reason', message: 'Bắt buộc nhập lý do từ chối' }]);
    }
    const next =
      registration.status === 'pending_late'
        ? decision.approve
          ? 'active'
          : 'rejected'
        : decision.approve
          ? 'cancelled'
          : 'active';
    const now = this.clock.now();
    const child = await this.childContext(database, registration.child_id);
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('service_registrations')
        .set({
          status: next,
          decided_by: origin.actorUserId,
          decided_at: now,
          decision_note: decision.note,
          updated_at: now,
          ...(registration.status === 'pending_late' && decision.approve
            ? { late_charge_method: decision.chargeMethod }
            : {}),
          ...(next === 'cancelled' ? { cancelled_by: origin.actorUserId, cancelled_at: now } : {}),
        })
        .where('id', '=', registration.id)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: registration.org_unit_id,
        entityName: 'service_registrations',
        entityId: registration.id,
        action: 'update',
        before: { status: registration.status },
        after: { status: next, charge_method: decision.chargeMethod, note: decision.note },
      });
      const action = registration.status === 'pending_late' ? 'đăng ký' : 'hủy';
      await queueNotification(transaction, {
        orgUnitId: registration.org_unit_id,
        templateCode: 'late_registration_decided',
        title: decision.approve
          ? `Ban Giám hiệu đã duyệt ${action} dịch vụ`
          : `Ban Giám hiệu từ chối ${action} dịch vụ`,
        body: `${child.full_name}: ${action} ${registration.service_name} kỳ ${registration.period_year}-${String(registration.period_month).padStart(2, '0')}${decision.note ? `. ${decision.note}` : ''}`,
        targetType: 'service_registrations',
        targetId: registration.id,
        recipients: (await this.guardianUserIds(transaction, child.id)).map((userId) => ({
          userId,
          channel: 'in_app' as const,
        })),
      });
    });
    return this.findRegistration(database, registration.id);
  }

  // Đăng ký trễ và hủy trễ chờ duyệt trong các đơn vị người duyệt phụ trách
  async pending(currentUser: CurrentUser, orgUnitId: string | null) {
    const { database } = await this.currentSchoolYear.require();
    const scope = await this.organizationScopes.resolve(currentUser, PERMISSION_CODES.lateRegistrationApprove);
    if (!scope.wholeSchool && scope.orgUnitIds.length === 0) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền duyệt đăng ký trễ');
    }
    if (orgUnitId && !scope.wholeSchool && !scope.orgUnitIds.includes(orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Đơn vị này nằm ngoài phạm vi của bạn');
    }
    let query = database
      .selectFrom('service_registrations')
      .innerJoin('children', 'children.id', 'service_registrations.child_id')
      .innerJoin('services', 'services.id', 'service_registrations.service_id')
      .select([
        ...REGISTRATION_COLUMNS,
        'service_registrations.org_unit_id',
        'service_registrations.period_year',
        'service_registrations.period_month',
        'service_registrations.registered_at',
        'children.full_name as child_name',
        'services.name as service_name',
      ])
      .where('service_registrations.status', 'in', ['pending_late', 'pending_cancel']);
    if (orgUnitId) {
      query = query.where('service_registrations.org_unit_id', '=', orgUnitId);
    } else if (!scope.wholeSchool) {
      query = query.where('service_registrations.org_unit_id', 'in', scope.orgUnitIds);
    }
    return query.orderBy('service_registrations.registered_at').execute();
  }

  // Chốt danh sách đăng ký của kỳ cho một đơn vị; sau đó đăng ký thêm là đăng ký trễ (P05-04, BR-26)
  async lock(currentUser: CurrentUser, orgUnitId: string, period: Period, origin: ChangeOrigin) {
    await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.registrationManage, orgUnitId);
    const { database } = await this.currentSchoolYear.require();
    const state = await this.periods.state(database, orgUnitId, period);
    if (state.is_locked) {
      throw ruleViolationError('BR-26', 'Kỳ này đã chốt danh sách đăng ký');
    }
    await this.sheet(currentUser, orgUnitId, period);
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      await transaction
        .insertInto('registration_periods')
        .values({
          org_unit_id: orgUnitId,
          period_year: period.year,
          period_month: period.month,
          status: 'locked',
          locked_by: origin.actorUserId,
          locked_at: now,
        })
        .onConflict((conflict) =>
          conflict
            .columns(['org_unit_id', 'period_year', 'period_month'])
            .doUpdateSet({ status: 'locked', locked_by: origin.actorUserId, locked_at: now }),
        )
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId,
        entityName: 'registration_periods',
        entityId: orgUnitId,
        action: 'update',
        before: { status: 'open', period: state.period },
        after: { status: 'locked', period: state.period },
      });
      await queueNotification(transaction, {
        orgUnitId,
        templateCode: 'registrations_locked',
        title: 'Đã chốt đăng ký dịch vụ',
        body: `Đăng ký dịch vụ kỳ ${state.period} đã chốt`,
        targetType: 'registration_periods',
        targetId: orgUnitId,
        recipients: [{ roleCode: 'VT-03', orgUnitId, channel: 'in_app' }],
      });
    });
    return this.sheet(currentUser, orgUnitId, period);
  }

  // Đăng ký học hè theo từng tháng hè; trẻ đăng ký thì có điểm danh và tính học phí như tháng thường (BR-92)
  async registerSummer(currentUser: CurrentUser, childId: string, period: Period, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const child = await this.activeChild(database, childId);
    const source = await this.actorFor(currentUser, database, child);
    const state = await this.periods.state(database, child.org_unit_id, period);
    if (!state.is_summer) {
      throw validationError([{ field: 'period', message: 'Tháng này không thuộc kỳ hè' }]);
    }
    if (state.is_locked) {
      throw ruleViolationError('BR-26', 'Kỳ này đã chốt danh sách đăng ký');
    }
    const existing = await database
      .selectFrom('summer_registrations')
      .select(['id', 'status'])
      .where('child_id', '=', child.id)
      .where('period_year', '=', period.year)
      .where('period_month', '=', period.month)
      .executeTakeFirst();
    if (existing?.status === 'active') {
      throw new ApplicationError('ERR_CONFLICT', 'Trẻ đã đăng ký học hè tháng này');
    }
    const now = this.clock.now();
    const saved = await database.transaction().execute(async (transaction) => {
      const row = existing
        ? await transaction
            .updateTable('summer_registrations')
            .set({
              status: 'active',
              source,
              registered_by: origin.actorUserId,
              registered_at: now,
              cancelled_by: null,
              cancelled_at: null,
            })
            .where('id', '=', existing.id)
            .returning(['id', 'child_id', 'period_year', 'period_month', 'status', 'source'])
            .executeTakeFirstOrThrow()
        : await transaction
            .insertInto('summer_registrations')
            .values({
              child_id: child.id,
              org_unit_id: child.org_unit_id,
              period_year: period.year,
              period_month: period.month,
              status: 'active',
              source,
              registered_by: origin.actorUserId,
            })
            .returning(['id', 'child_id', 'period_year', 'period_month', 'status', 'source'])
            .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: child.org_unit_id,
        entityName: 'summer_registrations',
        entityId: row.id,
        action: existing ? 'update' : 'create',
        before: existing ?? null,
        after: row,
      });
      return row;
    });
    return saved;
  }

  // Hủy học hè trước ngày chốt của tháng đó
  async cancelSummer(currentUser: CurrentUser, summerRegistrationId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const row = await database
      .selectFrom('summer_registrations')
      .select(['id', 'child_id', 'org_unit_id', 'period_year', 'period_month', 'status'])
      .where('id', '=', summerRegistrationId)
      .executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy đăng ký học hè', 'summer_registration');
    }
    const child = await this.childContext(database, row.child_id);
    await this.actorFor(currentUser, database, child);
    if (row.status !== 'active') {
      throw ruleViolationError('BR-92', 'Đăng ký học hè này đã hủy');
    }
    const state = await this.periods.state(database, row.org_unit_id, {
      year: row.period_year,
      month: row.period_month,
    });
    if (state.is_late) {
      throw ruleViolationError('BR-26', 'Đã qua ngày chốt, không hủy được học hè tháng này');
    }
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('summer_registrations')
        .set({ status: 'cancelled', cancelled_by: origin.actorUserId, cancelled_at: now })
        .where('id', '=', row.id)
        .execute();
      // Dòng đăng ký dịch vụ của tháng hè không còn hiệu lực
      await transaction
        .updateTable('service_registrations')
        .set({ status: 'cancelled', cancelled_by: origin.actorUserId, cancelled_at: now, updated_at: now })
        .where('child_id', '=', row.child_id)
        .where('period_year', '=', row.period_year)
        .where('period_month', '=', row.period_month)
        .where('status', 'in', ['active', 'pending_late', 'pending_cancel'])
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: row.org_unit_id,
        entityName: 'summer_registrations',
        entityId: row.id,
        action: 'update',
        before: { status: 'active' },
        after: { status: 'cancelled' },
      });
    });
    return { id: row.id, status: 'cancelled' as const };
  }

  // Danh sách học hè theo trẻ (phụ huynh, người xem trẻ) hoặc theo đơn vị và kỳ (nhân sự)
  async summerList(currentUser: CurrentUser, filter: { childId?: string; orgUnitId?: string; period?: Period }) {
    const { database } = await this.currentSchoolYear.require();
    let query = database
      .selectFrom('summer_registrations')
      .innerJoin('children', 'children.id', 'summer_registrations.child_id')
      .select([
        'summer_registrations.id',
        'summer_registrations.child_id',
        'children.full_name as child_name',
        'summer_registrations.period_year',
        'summer_registrations.period_month',
        'summer_registrations.status',
        'summer_registrations.source',
      ]);
    if (filter.childId) {
      await this.childScope.assertCanRead(currentUser, database, filter.childId);
      query = query.where('summer_registrations.child_id', '=', filter.childId);
    } else if (filter.orgUnitId) {
      await this.assertCanView(currentUser, filter.orgUnitId);
      query = query.where('summer_registrations.org_unit_id', '=', filter.orgUnitId);
    } else {
      throw validationError([{ field: 'child_id', message: 'Chọn trẻ hoặc đơn vị' }]);
    }
    if (filter.period) {
      query = query
        .where('summer_registrations.period_year', '=', filter.period.year)
        .where('summer_registrations.period_month', '=', filter.period.month);
    }
    return query
      .orderBy('summer_registrations.period_year')
      .orderBy('summer_registrations.period_month')
      .orderBy('children.full_name')
      .execute();
  }

  // Tạo dòng của kỳ: dịch vụ bắt buộc cho mọi trẻ học trong kỳ; dịch vụ không bắt buộc giữ từ tháng gần nhất có đăng ký,
  // trừ tháng hè (YCTD-49, YCTD-50). Trẻ không đăng ký học hè thì tháng hè không có dòng nào (BR-92)
  private async ensureRows(
    database: Kysely<SchoolYearDatabase>,
    children: Array<{ id: string; org_unit_id: string }>,
    period: Period,
    isSummer: boolean,
    summerChildren: Set<string>,
  ): Promise<void> {
    const eligible = isSummer ? children.filter((child) => summerChildren.has(child.id)) : children;
    if (eligible.length === 0) {
      return;
    }
    const services = await database.selectFrom('services').select(['id', 'is_mandatory', 'status']).execute();
    const mandatory = services.filter((service) => service.is_mandatory && service.status === 'active');
    const optionalActive = new Set(
      services.filter((service) => !service.is_mandatory && service.status === 'active').map((service) => service.id),
    );
    const rows: Array<{ child_id: string; org_unit_id: string; service_id: string; source: 'system' | 'carried' }> = [];
    for (const child of eligible) {
      for (const service of mandatory) {
        rows.push({ child_id: child.id, org_unit_id: child.org_unit_id, service_id: service.id, source: 'system' });
      }
    }
    if (!isSummer) {
      const target = period.year * 100 + period.month;
      const earlier = await database
        .selectFrom('service_registrations')
        .select(['child_id', 'service_id', 'status', 'period_year', 'period_month'])
        .where(
          'child_id',
          'in',
          eligible.map((child) => child.id),
        )
        .where(sql<boolean>`period_year * 100 + period_month < ${target}`)
        .orderBy('period_year', 'desc')
        .orderBy('period_month', 'desc')
        .execute();
      const latest = new Map<string, (typeof earlier)[number]>();
      for (const row of earlier) {
        const key = `${row.child_id}:${row.service_id}`;
        if (!latest.has(key)) {
          latest.set(key, row);
        }
      }
      for (const row of latest.values()) {
        if (CARRIED_STATUSES.includes(row.status) && optionalActive.has(row.service_id)) {
          const child = eligible.find((item) => item.id === row.child_id);
          if (child) {
            rows.push({
              child_id: child.id,
              org_unit_id: child.org_unit_id,
              service_id: row.service_id,
              source: 'carried',
            });
          }
        }
      }
    }
    if (rows.length === 0) {
      return;
    }
    await database
      .insertInto('service_registrations')
      .values(
        rows.map((row) => ({
          ...row,
          period_year: period.year,
          period_month: period.month,
          status: 'active' as const,
        })),
      )
      .onConflict((conflict) => conflict.columns(['child_id', 'period_year', 'period_month', 'service_id']).doNothing())
      .execute();
  }

  // Còn hóa đơn đã phát hành quá hạn nộp thì phụ huynh không đăng ký thêm được; trẻ vẫn được điểm danh (BR-33, AC-182).
  // Số đã thu trừ vào khi có phiếu thu ở phần 5d
  private async assertNoOverdue(database: Kysely<SchoolYearDatabase>, childId: string): Promise<void> {
    const overdue = await database
      .selectFrom('invoices')
      .select(['code', 'due_date'])
      .where('child_id', '=', childId)
      .where('status', '=', 'issued')
      .where('due_date', '<', this.periods.today())
      .where('total_amount', '>', '0')
      .executeTakeFirst();
    if (overdue) {
      throw ruleViolationError('BR-33', 'Không đăng ký thêm được vì còn công nợ quá hạn', [
        { field: 'invoice', message: `${overdue.code ?? ''} quá hạn từ ${overdue.due_date ?? ''}` },
      ]);
    }
  }

  private async summerChildIds(database: Kysely<SchoolYearDatabase>, period: Period): Promise<Set<string>> {
    const rows = await database
      .selectFrom('summer_registrations')
      .select('child_id')
      .where('period_year', '=', period.year)
      .where('period_month', '=', period.month)
      .where('status', '=', 'active')
      .execute();
    return new Set(rows.map((row) => row.child_id));
  }

  private async registrationsOf(database: Kysely<SchoolYearDatabase>, childIds: string[], period: Period) {
    if (childIds.length === 0) {
      return [];
    }
    return database
      .selectFrom('service_registrations')
      .select(REGISTRATION_COLUMNS)
      .where('service_registrations.child_id', 'in', childIds)
      .where('service_registrations.period_year', '=', period.year)
      .where('service_registrations.period_month', '=', period.month)
      .execute();
  }

  private activeServices(database: Kysely<SchoolYearDatabase>) {
    return database
      .selectFrom('services')
      .select(['id', 'code', 'name', 'unit', 'calculation_method', 'is_mandatory'])
      .where('status', '=', 'active')
      .orderBy('is_system', 'desc')
      .orderBy('code')
      .execute();
  }

  private async findRegistration(database: Kysely<SchoolYearDatabase>, registrationId: string) {
    return database
      .selectFrom('service_registrations')
      .select([...REGISTRATION_COLUMNS, 'service_registrations.period_year', 'service_registrations.period_month'])
      .where('service_registrations.id', '=', registrationId)
      .executeTakeFirstOrThrow();
  }

  private async loadRegistration(database: Kysely<SchoolYearDatabase>, registrationId: string) {
    const registration = await database
      .selectFrom('service_registrations')
      .innerJoin('services', 'services.id', 'service_registrations.service_id')
      .select([
        'service_registrations.id',
        'service_registrations.child_id',
        'service_registrations.org_unit_id',
        'service_registrations.period_year',
        'service_registrations.period_month',
        'service_registrations.status',
        'services.name as service_name',
        'services.is_mandatory',
      ])
      .where('service_registrations.id', '=', registrationId)
      .executeTakeFirst();
    if (!registration) {
      throw notFoundError('Không tìm thấy đăng ký dịch vụ', 'service_registration');
    }
    return registration;
  }

  private async childContext(database: Kysely<SchoolYearDatabase>, childId: string): Promise<ChildContext> {
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

  private async activeChild(database: Kysely<SchoolYearDatabase>, childId: string): Promise<ChildContext> {
    const child = await this.childContext(database, childId);
    if (child.status !== 'active' || !child.class_id) {
      throw ruleViolationError('QT-03', 'Chỉ đăng ký dịch vụ cho trẻ đang học đã phân lớp');
    }
    return child;
  }

  // Phụ huynh đăng ký cho con mình; kế toán đăng ký thay trong phạm vi đơn vị (P05-03, P05-13)
  private async actorFor(
    currentUser: CurrentUser,
    database: Kysely<SchoolYearDatabase>,
    child: ChildContext,
  ): Promise<'parent' | 'staff'> {
    const guardian = await database
      .selectFrom('child_guardians')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .select('guardians.id')
      .where('child_guardians.child_id', '=', child.id)
      .where('guardians.user_id', '=', currentUser.id)
      .executeTakeFirst();
    if (guardian) {
      return 'parent';
    }
    if (currentUser.hasPermission(PERMISSION_CODES.registrationManage)) {
      await this.organizationScopes.assertCanAccess(
        currentUser,
        PERMISSION_CODES.registrationManage,
        child.org_unit_id,
      );
      return 'staff';
    }
    throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền đăng ký dịch vụ cho trẻ này');
  }

  // Nhân sự xem bảng đăng ký của đơn vị: quyền xem học phí, đăng ký thay hoặc duyệt đăng ký trễ trong phạm vi đơn vị
  private async assertCanView(currentUser: CurrentUser, orgUnitId: string): Promise<void> {
    for (const permission of [
      'P05.view',
      PERMISSION_CODES.registrationManage,
      PERMISSION_CODES.lateRegistrationApprove,
    ]) {
      if (currentUser.hasPermission(permission)) {
        const scope = await this.organizationScopes.resolveStaff(currentUser, permission);
        if (scope.wholeSchool || scope.orgUnitIds.includes(orgUnitId)) {
          return;
        }
      }
    }
    throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem đăng ký dịch vụ của đơn vị này');
  }

  private async approverRecipients(
    database: Kysely<SchoolYearDatabase>,
    orgUnitId: string,
  ): Promise<NotificationRecipient[]> {
    const root = await database
      .selectFrom('org_units')
      .select('id')
      .where('unit_type', '=', 'truong_chinh')
      .executeTakeFirst();
    return [
      { roleCode: 'VT-15', orgUnitId, channel: 'in_app' },
      ...(root ? [{ roleCode: 'VT-02', orgUnitId: root.id, channel: 'in_app' as const }] : []),
    ];
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
}
