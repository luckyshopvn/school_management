import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Kysely, Transaction } from 'kysely';
import { SchoolCalendar, VIETNAM_DATE } from '../attendance/school-calendar.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification } from '../common/notification-queue.js';
import { notFoundError } from '../common/request-fields.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { formatPeriod, periodRange, RegistrationPeriods, type Period } from './registration-periods.js';

// Tính học phí kỳ, phát hành hóa đơn chính và hóa đơn bổ sung (P05-05, P05-06; QT-03 bước 4 đến 10;
// BR-14, BR-17, BR-19, BR-23, BR-25, BR-58, BR-85, BR-92; Q-150, Q-151; YCTD-51).
// Học phí chính khóa theo số ngày học trong thời gian đang học; tiền ăn theo số ngày có mặt; dịch vụ theo tháng thu đủ,
// đăng ký trễ thu theo ngày thực tế thì tính từ ngày bắt đầu học; mỗi dòng làm tròn đến đồng
const PRESENT_STATUSES = ['present', 'late', 'early_leave', 'late_and_early_leave'];
const ABSENCE_FLAG_DAYS = 5;
const CHANGE_FLAG_RATIO = 0.3;
const INVOICE_SEQUENCE = 'invoice';

export interface DraftItem {
  item_type: 'tuition' | 'service';
  service_id: string | null;
  service_registration_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  basis_note: string | null;
}

interface PriceTable {
  scheduleId: string;
  scheduleName: string;
  tuition: Map<string, number>;
  services: Map<string, number>;
}

const priceKey = (gradeLevel: string, serviceId: string) => `${gradeLevel}:${serviceId}`;
const share = (price: number, days: number, totalDays: number) => Math.round((price * days) / totalDays);

@Injectable()
export class FeeCalculationService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly calendar: SchoolCalendar,
    private readonly periods: RegistrationPeriods,
    private readonly clock: Clock,
  ) {}

  private today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  // Chạy tính cho mọi trẻ của đơn vị trong kỳ; chạy lại thì thay kết quả nháp, không sinh trùng (AC-102)
  async calculate(currentUser: CurrentUser, orgUnitId: string, period: Period, origin: ChangeOrigin) {
    await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.feeCalculationManage, orgUnitId);
    const { database } = await this.currentSchoolYear.require();
    const state = await this.periods.state(database, orgUnitId, period);
    if (!state.is_locked) {
      throw ruleViolationError('BR-26', 'Chốt danh sách đăng ký dịch vụ của kỳ trước khi tính học phí');
    }
    const issued = await database
      .selectFrom('invoices')
      .select('id')
      .where('org_unit_id', '=', orgUnitId)
      .where('period_year', '=', period.year)
      .where('period_month', '=', period.month)
      .where('invoice_kind', '=', 'main')
      .where('status', '=', 'issued')
      .executeTakeFirst();
    if (issued) {
      throw ruleViolationError('BR-25', 'Kỳ đã phát hành hóa đơn, sửa sai bằng phiếu điều chỉnh');
    }
    const schoolDays = await this.schoolDays(period);
    if (schoolDays.length === 0) {
      throw ruleViolationError('BR-91', 'Tháng này không có ngày học theo lịch năm học');
    }
    const children = await this.billableChildren(database, orgUnitId, period, state.is_summer);
    // Thiếu biểu phí của bậc học là lỗi dữ liệu nên báo trước khi kiểm tra chốt điểm danh (AC-100)
    const prices = await this.priceTable(database, period);
    const missingGrades = [...new Set(children.map((child) => child.grade_level))].filter(
      (gradeLevel) => !prices.tuition.has(gradeLevel),
    );
    if (missingGrades.length > 0) {
      throw ruleViolationError(
        'BR-17',
        'Chưa có biểu phí cho bậc học này trong kỳ',
        missingGrades.map((gradeLevel) => ({ field: 'grade_level', message: gradeLevel })),
      );
    }
    await this.assertAttendanceLocked(database, children, schoolDays);
    const registrations = await this.activeRegistrations(
      database,
      children.map((child) => child.id),
      period,
    );
    const presentDays = await this.presentDays(
      database,
      children.map((child) => child.id),
      schoolDays,
    );
    const previousTotals = await this.previousTotals(
      database,
      children.map((child) => child.id),
      period,
    );

    const missing: FieldError[] = [];
    const drafts = children.flatMap((child) => {
      const enrolledDays = schoolDays.filter(
        (day) => day >= (child.enroll_date ?? '0000-00-00') && (!child.leave_date || day <= child.leave_date),
      );
      if (enrolledDays.length === 0) {
        return [];
      }
      const items: DraftItem[] = [];
      const tuitionPrice = prices.tuition.get(child.grade_level);
      if (tuitionPrice === undefined) {
        missing.push({ field: 'grade_level', message: child.grade_level });
      } else if (tuitionPrice > 0) {
        const full = enrolledDays.length === schoolDays.length;
        items.push({
          item_type: 'tuition',
          service_id: null,
          service_registration_id: null,
          description: 'Học phí chính khóa',
          quantity: full ? 1 : enrolledDays.length / schoolDays.length,
          unit_price: tuitionPrice,
          amount: full ? tuitionPrice : share(tuitionPrice, enrolledDays.length, schoolDays.length),
          basis_note: full ? null : `${enrolledDays.length}/${schoolDays.length} ngày học`,
        });
      }
      const present = presentDays.get(child.id) ?? 0;
      for (const registration of registrations.filter((row) => row.child_id === child.id)) {
        const item = this.serviceItem(registration, child.grade_level, prices, schoolDays, present, missing);
        if (item) {
          items.push(item);
        }
      }
      const total = items.reduce((sum, item) => sum + item.amount, 0);
      const flags: string[] = [];
      if (enrolledDays.length - present >= ABSENCE_FLAG_DAYS) {
        flags.push('absent_many');
      }
      const previous = previousTotals.get(child.id);
      if (previous !== undefined && previous > 0 && Math.abs(total - previous) / previous > CHANGE_FLAG_RATIO) {
        flags.push('large_change');
      }
      const hasOptional = registrations.some((row) => row.child_id === child.id && !row.is_mandatory);
      if (!hasOptional && present === 0) {
        flags.push('no_registration');
      }
      return [
        {
          child,
          items,
          total,
          flags,
          basis: {
            school_days: schoolDays.length,
            enrolled_days: enrolledDays.length,
            present_days: present,
            grade_level: child.grade_level,
            fee_schedule_id: prices.scheduleId,
            fee_schedule_name: prices.scheduleName,
          },
        },
      ];
    });
    if (missing.length > 0) {
      const unique = [...new Map(missing.map((error) => [`${error.field}:${error.message}`, error])).values()];
      throw ruleViolationError('BR-17', 'Thiếu biểu phí hiệu lực trong kỳ cho bậc học hoặc dịch vụ', unique);
    }

    const run = await database
      .insertInto('fee_calculation_runs')
      .values({
        org_unit_id: orgUnitId,
        period_year: period.year,
        period_month: period.month,
        status: 'running',
        run_by: origin.actorUserId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    try {
      await database.transaction().execute(async (transaction) => {
        const keep = new Set(drafts.map((draft) => draft.child.id));
        const stale = await transaction
          .selectFrom('invoices')
          .select(['id', 'child_id'])
          .where('org_unit_id', '=', orgUnitId)
          .where('period_year', '=', period.year)
          .where('period_month', '=', period.month)
          .where('invoice_kind', '=', 'main')
          .where('status', '=', 'draft')
          .execute();
        const staleIds = stale.filter((row) => !keep.has(row.child_id)).map((row) => row.id);
        if (staleIds.length > 0) {
          await transaction.deleteFrom('invoices').where('id', 'in', staleIds).execute();
        }
        for (const draft of drafts) {
          const invoice = await transaction
            .insertInto('invoices')
            .values({
              child_id: draft.child.id,
              org_unit_id: orgUnitId,
              period_year: period.year,
              period_month: period.month,
              invoice_kind: 'main',
              status: 'draft',
              calculation_run_id: run.id,
              total_amount: draft.total,
              basis: JSON.stringify(draft.basis),
              review_flags: JSON.stringify(draft.flags),
            })
            .onConflict((conflict) =>
              conflict
                .columns(['child_id', 'period_year', 'period_month'])
                .where('invoice_kind', '=', 'main')
                .doUpdateSet({
                  org_unit_id: orgUnitId,
                  calculation_run_id: run.id,
                  total_amount: draft.total,
                  basis: JSON.stringify(draft.basis),
                  review_flags: JSON.stringify(draft.flags),
                  updated_at: this.clock.now(),
                }),
            )
            .returning('id')
            .executeTakeFirstOrThrow();
          await transaction.deleteFrom('invoice_items').where('invoice_id', '=', invoice.id).execute();
          if (draft.items.length > 0) {
            await transaction
              .insertInto('invoice_items')
              .values(draft.items.map((item) => ({ ...item, invoice_id: invoice.id })))
              .execute();
          }
        }
        await transaction
          .updateTable('fee_calculation_runs')
          .set({
            status: 'succeeded',
            finished_at: this.clock.now(),
            child_count: drafts.length,
            total_amount: drafts.reduce((sum, draft) => sum + draft.total, 0),
          })
          .where('id', '=', run.id)
          .execute();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId,
          entityName: 'fee_calculation_runs',
          entityId: run.id,
          action: 'create',
          before: null,
          after: { period: formatPeriod(period), child_count: drafts.length },
        });
      });
    } catch (error) {
      // Lỗi giữa chừng thì kết quả cũ giữ nguyên nhờ giao dịch, lần chạy ghi thất bại để chạy lại (QT-03 E7)
      await database
        .updateTable('fee_calculation_runs')
        .set({ status: 'failed', finished_at: this.clock.now(), error_detail: String(error).slice(0, 1000) })
        .where('id', '=', run.id)
        .execute();
      throw error;
    }
    return this.readRun(currentUser, run.id);
  }

  async readRun(currentUser: CurrentUser, runId: string) {
    const { database } = await this.currentSchoolYear.require();
    const run = await database
      .selectFrom('fee_calculation_runs')
      .selectAll()
      .where('id', '=', runId)
      .executeTakeFirst();
    if (!run) {
      throw notFoundError('Không tìm thấy lần tính học phí', 'fee_calculation_run');
    }
    await this.assertStaffCanView(currentUser, run.org_unit_id);
    return { ...run, total_amount: run.total_amount === null ? null : Number(run.total_amount) };
  }

  // Phát hành mọi hóa đơn nháp của đơn vị trong kỳ: cấp số, ngày đến hạn, khóa kỳ, báo phụ huynh (P05-06, BR-85)
  async issue(currentUser: CurrentUser, orgUnitId: string, period: Period, dueDate: string, origin: ChangeOrigin) {
    await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.feeCalculationManage, orgUnitId);
    const today = this.today();
    if (dueDate < today) {
      throw validationError([{ field: 'due_date', message: 'Ngày đến hạn không nhỏ hơn ngày phát hành' }]);
    }
    const { database } = await this.currentSchoolYear.require();
    const drafts = await database
      .selectFrom('invoices')
      .innerJoin('children', 'children.id', 'invoices.child_id')
      .select(['invoices.id', 'invoices.child_id', 'invoices.total_amount', 'children.full_name'])
      .where('invoices.org_unit_id', '=', orgUnitId)
      .where('invoices.period_year', '=', period.year)
      .where('invoices.period_month', '=', period.month)
      .where('invoices.invoice_kind', '=', 'main')
      .where('invoices.status', '=', 'draft')
      .orderBy('children.full_name')
      .execute();
    if (drafts.length === 0) {
      throw ruleViolationError('QT-03', 'Không có hóa đơn nháp để phát hành; chạy tính học phí trước');
    }
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      for (const draft of drafts) {
        await transaction
          .updateTable('invoices')
          .set({
            status: 'issued',
            code: await this.nextCode(transaction),
            due_date: dueDate,
            issued_at: now,
            issued_by: origin.actorUserId,
            updated_at: now,
          })
          .where('id', '=', draft.id)
          .execute();
        await this.notifyGuardians(transaction, orgUnitId, draft.child_id, {
          templateCode: 'invoice_issued',
          title: 'Học phí đã phát hành',
          body: `Học phí kỳ ${formatPeriod(period)} của ${draft.full_name}: ${Number(draft.total_amount)} đồng, hạn nộp ${dueDate}`,
          invoiceId: draft.id,
          sms: true,
        });
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId,
        entityName: 'invoices',
        entityId: orgUnitId,
        action: 'update',
        before: { status: 'draft', period: formatPeriod(period), count: drafts.length },
        after: { status: 'issued', due_date: dueDate },
      });
    });
    return this.list(currentUser, { orgUnitId, period });
  }

  // Hóa đơn bổ sung cùng kỳ cho đăng ký trễ đã duyệt sau khi hóa đơn chính đã phát hành; hóa đơn chính giữ nguyên (BR-85)
  async issueSupplementary(
    currentUser: CurrentUser,
    childId: string,
    period: Period,
    dueDate: string,
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const child = await database
      .selectFrom('children')
      .innerJoin('class_enrollments', (join) =>
        join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
      )
      .innerJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select(['children.id', 'children.full_name', 'children.org_unit_id', 'classes.grade_level'])
      .where('children.id', '=', childId)
      .executeTakeFirst();
    if (!child) {
      throw notFoundError('Không tìm thấy trẻ đang học', 'child');
    }
    await this.organizationScopes.assertCanAccess(
      currentUser,
      PERMISSION_CODES.feeCalculationManage,
      child.org_unit_id,
    );
    if (dueDate < this.today()) {
      throw validationError([{ field: 'due_date', message: 'Ngày đến hạn không nhỏ hơn ngày phát hành' }]);
    }
    const main = await database
      .selectFrom('invoices')
      .select(['id', 'basis'])
      .where('child_id', '=', childId)
      .where('period_year', '=', period.year)
      .where('period_month', '=', period.month)
      .where('invoice_kind', '=', 'main')
      .where('status', '=', 'issued')
      .executeTakeFirst();
    if (!main) {
      throw ruleViolationError('BR-85', 'Hóa đơn chính của kỳ chưa phát hành; khoản này sẽ vào hóa đơn chính');
    }
    const invoiced = new Set(
      (
        await database
          .selectFrom('invoice_items')
          .innerJoin('invoices', 'invoices.id', 'invoice_items.invoice_id')
          .select('invoice_items.service_registration_id')
          .where('invoices.child_id', '=', childId)
          .where('invoices.period_year', '=', period.year)
          .where('invoices.period_month', '=', period.month)
          .where('invoice_items.service_registration_id', 'is not', null)
          .execute()
      ).map((row) => row.service_registration_id),
    );
    const pending = (await this.activeRegistrations(database, [childId], period)).filter(
      (row) => row.is_late && !invoiced.has(row.id),
    );
    if (pending.length === 0) {
      throw ruleViolationError('BR-85', 'Không có khoản phát sinh nào chưa lập hóa đơn trong kỳ');
    }
    const schoolDays = await this.schoolDays(period);
    const prices = await this.priceTable(database, period);
    const presentDays = await this.presentDays(database, [childId], schoolDays);
    const missing: FieldError[] = [];
    const items = pending
      .map((registration) =>
        this.serviceItem(registration, child.grade_level, prices, schoolDays, presentDays.get(childId) ?? 0, missing),
      )
      .filter((item): item is DraftItem => item !== null);
    if (missing.length > 0) {
      throw ruleViolationError('BR-17', 'Thiếu biểu phí hiệu lực trong kỳ cho bậc học hoặc dịch vụ', missing);
    }
    const total = items.reduce((sum, item) => sum + item.amount, 0);
    const now = this.clock.now();
    const invoiceId = await database.transaction().execute(async (transaction) => {
      const invoice = await transaction
        .insertInto('invoices')
        .values({
          code: await this.nextCode(transaction),
          child_id: childId,
          org_unit_id: child.org_unit_id,
          period_year: period.year,
          period_month: period.month,
          invoice_kind: 'supplementary',
          status: 'issued',
          total_amount: total,
          basis: JSON.stringify({ ...main.basis, school_days: schoolDays.length }),
          review_flags: JSON.stringify([]),
          due_date: dueDate,
          issued_at: now,
          issued_by: origin.actorUserId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await transaction
        .insertInto('invoice_items')
        .values(items.map((item) => ({ ...item, invoice_id: invoice.id })))
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: child.org_unit_id,
        entityName: 'invoices',
        entityId: invoice.id,
        action: 'create',
        before: null,
        after: { invoice_kind: 'supplementary', period: formatPeriod(period), total, items },
      });
      await this.notifyGuardians(transaction, child.org_unit_id, childId, {
        templateCode: 'supplementary_invoice_issued',
        title: 'Có hóa đơn bổ sung',
        body: `Hóa đơn bổ sung kỳ ${formatPeriod(period)} của ${child.full_name}: ${total} đồng, hạn nộp ${dueDate}`,
        invoiceId: invoice.id,
        sms: false,
      });
      await queueNotification(transaction, {
        orgUnitId: child.org_unit_id,
        templateCode: 'supplementary_invoice_issued',
        title: 'Có hóa đơn bổ sung',
        body: `Hóa đơn bổ sung kỳ ${formatPeriod(period)} của ${child.full_name}`,
        targetType: 'invoices',
        targetId: invoice.id,
        recipients: [{ roleCode: 'VT-04', orgUnitId: child.org_unit_id, channel: 'in_app' }],
      });
      return invoice.id;
    });
    return this.read(currentUser, invoiceId);
  }

  // Danh sách hóa đơn: nhân sự theo đơn vị trong phạm vi; phụ huynh chỉ hóa đơn đã phát hành của con mình (AC-103)
  async list(
    currentUser: CurrentUser,
    filter: { orgUnitId?: string; period?: Period; childId?: string; status?: 'draft' | 'issued' },
  ) {
    const { database } = await this.currentSchoolYear.require();
    let query = database
      .selectFrom('invoices')
      .innerJoin('children', 'children.id', 'invoices.child_id')
      .select([
        'invoices.id',
        'invoices.code',
        'invoices.child_id',
        'children.full_name as child_name',
        'invoices.org_unit_id',
        'invoices.period_year',
        'invoices.period_month',
        'invoices.invoice_kind',
        'invoices.status',
        'invoices.total_amount',
        'invoices.due_date',
        'invoices.issued_at',
        'invoices.review_flags',
        'invoices.basis',
      ]);
    const staffUnits = await this.staffUnits(currentUser);
    if (filter.orgUnitId) {
      if (!staffUnits.wholeSchool && !staffUnits.orgUnitIds.includes(filter.orgUnitId)) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem học phí của đơn vị này');
      }
      query = query.where('invoices.org_unit_id', '=', filter.orgUnitId);
    } else if (!staffUnits.wholeSchool) {
      // Không chọn đơn vị: nhân sự xem trong phạm vi, phụ huynh xem hóa đơn đã phát hành của con mình
      query = query.where((expression) =>
        expression.or([
          expression(
            'invoices.org_unit_id',
            'in',
            staffUnits.orgUnitIds.length ? staffUnits.orgUnitIds : ['00000000-0000-0000-0000-000000000000'],
          ),
          expression.and([
            expression('invoices.status', '=', 'issued'),
            expression(
              'invoices.child_id',
              'in',
              expression
                .selectFrom('child_guardians')
                .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
                .select('child_guardians.child_id')
                .where('guardians.user_id', '=', currentUser.id),
            ),
          ]),
        ]),
      );
    }
    if (filter.period) {
      query = query
        .where('invoices.period_year', '=', filter.period.year)
        .where('invoices.period_month', '=', filter.period.month);
    }
    if (filter.childId) {
      query = query.where('invoices.child_id', '=', filter.childId);
    }
    if (filter.status) {
      query = query.where('invoices.status', '=', filter.status);
    }
    const rows = await query
      .orderBy('invoices.period_year', 'desc')
      .orderBy('invoices.period_month', 'desc')
      .orderBy('children.full_name')
      .orderBy('invoices.invoice_kind')
      .execute();
    return rows.map((row) => ({ ...row, total_amount: Number(row.total_amount) }));
  }

  async read(currentUser: CurrentUser, invoiceId: string) {
    const { database } = await this.currentSchoolYear.require();
    const invoice = await database
      .selectFrom('invoices')
      .innerJoin('children', 'children.id', 'invoices.child_id')
      .selectAll('invoices')
      .select('children.full_name as child_name')
      .where('invoices.id', '=', invoiceId)
      .executeTakeFirst();
    if (!invoice) {
      throw notFoundError('Không tìm thấy hóa đơn', 'invoice');
    }
    const staffUnits = await this.staffUnits(currentUser);
    const isStaff = staffUnits.wholeSchool || staffUnits.orgUnitIds.includes(invoice.org_unit_id);
    if (!isStaff) {
      const guardian = await database
        .selectFrom('child_guardians')
        .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
        .select('guardians.id')
        .where('child_guardians.child_id', '=', invoice.child_id)
        .where('guardians.user_id', '=', currentUser.id)
        .executeTakeFirst();
      if (!guardian || invoice.status !== 'issued') {
        throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem hóa đơn này');
      }
    }
    const items = await database
      .selectFrom('invoice_items')
      .select(['id', 'item_type', 'service_id', 'description', 'quantity', 'unit_price', 'amount', 'basis_note'])
      .where('invoice_id', '=', invoiceId)
      .orderBy('item_type', 'desc')
      .orderBy('description')
      .execute();
    return {
      ...invoice,
      total_amount: Number(invoice.total_amount),
      items: items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        amount: Number(item.amount),
      })),
    };
  }

  private serviceItem(
    registration: Awaited<ReturnType<FeeCalculationService['activeRegistrations']>>[number],
    gradeLevel: string,
    prices: PriceTable,
    schoolDays: string[],
    presentDays: number,
    missing: FieldError[],
  ): DraftItem | null {
    const price = prices.services.get(priceKey(gradeLevel, registration.service_id));
    if (price === undefined) {
      missing.push({ field: 'service', message: `${gradeLevel}: ${registration.service_name}` });
      return null;
    }
    if (registration.calculation_method === 'per_present_day') {
      if (presentDays === 0) {
        return null;
      }
      return {
        item_type: 'service',
        service_id: registration.service_id,
        service_registration_id: registration.id,
        description: registration.service_name,
        quantity: presentDays,
        unit_price: price,
        amount: price * presentDays,
        basis_note: `${presentDays} ngày ăn`,
      };
    }
    if (registration.is_late && registration.late_charge_method === 'actual_days' && registration.service_start_date) {
      const days = schoolDays.filter((day) => day >= (registration.service_start_date ?? '')).length;
      return {
        item_type: 'service',
        service_id: registration.service_id,
        service_registration_id: registration.id,
        description: registration.service_name,
        quantity: days / schoolDays.length,
        unit_price: price,
        amount: share(price, days, schoolDays.length),
        basis_note: `Đăng ký trễ, ${days}/${schoolDays.length} ngày học từ ${registration.service_start_date}`,
      };
    }
    return {
      item_type: 'service',
      service_id: registration.service_id,
      service_registration_id: registration.id,
      description: registration.service_name,
      quantity: 1,
      unit_price: price,
      amount: price,
      basis_note: null,
    };
  }

  // Ngày học của tháng theo lịch năm học (BR-91), gồm ngày kỳ hè (BR-92)
  async schoolDays(period: Period): Promise<string[]> {
    const { from, to } = periodRange(period);
    const days: string[] = [];
    for (
      let cursor = new Date(`${from}T00:00:00Z`);
      cursor.toISOString().slice(0, 10) <= to;
      cursor = new Date(cursor.getTime() + 86_400_000)
    ) {
      const day = cursor.toISOString().slice(0, 10);
      if (!(await this.calendar.reasonNotSchoolDay(day))) {
        days.push(day);
      }
    }
    return days;
  }

  // Trẻ đang học của đơn vị có lớp; tháng hè chỉ trẻ đăng ký học hè (BR-92)
  private async billableChildren(
    database: Kysely<SchoolYearDatabase>,
    orgUnitId: string,
    period: Period,
    isSummer: boolean,
  ) {
    let query = database
      .selectFrom('children')
      .innerJoin('class_enrollments', (join) =>
        join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
      )
      .innerJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select([
        'children.id',
        'children.full_name',
        'children.enroll_date',
        'children.leave_date',
        'classes.id as class_id',
        'classes.name as class_name',
        'classes.grade_level',
      ])
      .where('children.org_unit_id', '=', orgUnitId)
      .where('children.status', '=', 'active');
    if (isSummer) {
      query = query.where('children.id', 'in', (expression) =>
        expression
          .selectFrom('summer_registrations')
          .select('child_id')
          .where('period_year', '=', period.year)
          .where('period_month', '=', period.month)
          .where('status', '=', 'active'),
      );
    }
    return query.orderBy('children.full_name').execute();
  }

  // Còn ngày học chưa chốt điểm danh thì chặn và liệt kê lớp, ngày (Q-151, AC-222)
  private async assertAttendanceLocked(
    database: Kysely<SchoolYearDatabase>,
    children: Array<{ class_id: string; class_name: string }>,
    schoolDays: string[],
  ): Promise<void> {
    const classes = new Map(children.map((child) => [child.class_id, child.class_name]));
    if (classes.size === 0) {
      return;
    }
    const locked = await database
      .selectFrom('attendance_days')
      .select(['class_id', 'attendance_date'])
      .where('class_id', 'in', [...classes.keys()])
      .where('attendance_date', 'in', schoolDays)
      .where('status', '=', 'locked')
      .execute();
    const lockedKeys = new Set(locked.map((row) => `${row.class_id}:${row.attendance_date}`));
    const unlocked: FieldError[] = [];
    for (const [classId, className] of classes) {
      for (const day of schoolDays) {
        if (!lockedKeys.has(`${classId}:${day}`)) {
          unlocked.push({ field: className, message: day });
        }
      }
    }
    if (unlocked.length > 0) {
      throw ruleViolationError('Q-151', 'Còn ngày chưa chốt điểm danh, chốt xong mới tính được', unlocked);
    }
  }

  // Phiên bản biểu phí hiệu lực vào ngày đầu kỳ (BR-17, BR-18)
  private async priceTable(database: Kysely<SchoolYearDatabase>, period: Period): Promise<PriceTable> {
    const { from } = periodRange(period);
    const schedule = await database
      .selectFrom('fee_schedules')
      .select(['id', 'name'])
      .where('effective_from', '<=', from)
      .where((expression) =>
        expression.or([expression('effective_to', 'is', null), expression('effective_to', '>=', from)]),
      )
      .executeTakeFirst();
    if (!schedule) {
      throw ruleViolationError('BR-17', 'Chưa có biểu phí hiệu lực trong kỳ');
    }
    const items = await database
      .selectFrom('fee_schedule_items')
      .select(['grade_level', 'fee_type', 'service_id', 'amount'])
      .where('fee_schedule_id', '=', schedule.id)
      .execute();
    const tuition = new Map<string, number>();
    const services = new Map<string, number>();
    for (const item of items) {
      if (item.fee_type === 'tuition') {
        tuition.set(item.grade_level, Number(item.amount));
      } else if (item.service_id) {
        services.set(priceKey(item.grade_level, item.service_id), Number(item.amount));
      }
    }
    return { scheduleId: schedule.id, scheduleName: schedule.name, tuition, services };
  }

  private async activeRegistrations(database: Kysely<SchoolYearDatabase>, childIds: string[], period: Period) {
    if (childIds.length === 0) {
      return [];
    }
    return (
      database
        .selectFrom('service_registrations')
        .innerJoin('services', 'services.id', 'service_registrations.service_id')
        .select([
          'service_registrations.id',
          'service_registrations.child_id',
          'service_registrations.service_id',
          'service_registrations.is_late',
          'service_registrations.late_charge_method',
          'service_registrations.service_start_date',
          'services.name as service_name',
          'services.calculation_method',
          'services.is_mandatory',
        ])
        .where('service_registrations.child_id', 'in', childIds)
        .where('service_registrations.period_year', '=', period.year)
        .where('service_registrations.period_month', '=', period.month)
        // Đang chờ duyệt hủy thì vẫn thu cho tới khi Ban Giám hiệu duyệt hủy
        .where('service_registrations.status', 'in', ['active', 'pending_cancel'])
        .orderBy('services.is_system', 'desc')
        .orderBy('services.name')
        .execute()
    );
  }

  // Số ngày ăn bằng số ngày có mặt, đi muộn, về sớm theo điểm danh đã chốt (BR-14, BR-58, Q-39)
  private async presentDays(
    database: Kysely<SchoolYearDatabase>,
    childIds: string[],
    schoolDays: string[],
  ): Promise<Map<string, number>> {
    if (childIds.length === 0 || schoolDays.length === 0) {
      return new Map();
    }
    const rows = await database
      .selectFrom('attendance_records')
      .select('child_id')
      .select((expression) => expression.fn.countAll<string>().as('days'))
      .where('child_id', 'in', childIds)
      .where('attendance_date', 'in', schoolDays)
      .where('status', 'in', PRESENT_STATUSES as never)
      .groupBy('child_id')
      .execute();
    return new Map(rows.map((row) => [row.child_id, Number(row.days)]));
  }

  private async previousTotals(
    database: Kysely<SchoolYearDatabase>,
    childIds: string[],
    period: Period,
  ): Promise<Map<string, number>> {
    if (childIds.length === 0) {
      return new Map();
    }
    const previous =
      period.month === 1 ? { year: period.year - 1, month: 12 } : { year: period.year, month: period.month - 1 };
    const rows = await database
      .selectFrom('invoices')
      .select(['child_id', 'total_amount'])
      .where('child_id', 'in', childIds)
      .where('period_year', '=', previous.year)
      .where('period_month', '=', previous.month)
      .where('invoice_kind', '=', 'main')
      .where('status', '=', 'issued')
      .execute();
    return new Map(rows.map((row) => [row.child_id, Number(row.total_amount)]));
  }

  // Số hóa đơn cấp liên tục trong năm học (YCTD-30)
  private async nextCode(transaction: Transaction<SchoolYearDatabase>): Promise<string> {
    const row = await transaction
      .insertInto('document_sequences')
      .values({ document_type: INVOICE_SEQUENCE, last_value: 1 })
      .onConflict((conflict) =>
        conflict.column('document_type').doUpdateSet((expression) => ({
          last_value: expression('document_sequences.last_value', '+', 1),
        })),
      )
      .returning('last_value')
      .executeTakeFirstOrThrow();
    return `HD-${String(row.last_value).padStart(6, '0')}`;
  }

  private async notifyGuardians(
    transaction: Transaction<SchoolYearDatabase>,
    orgUnitId: string,
    childId: string,
    message: { templateCode: string; title: string; body: string; invoiceId: string; sms: boolean },
  ): Promise<void> {
    const guardians = await transaction
      .selectFrom('child_guardians')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .select('guardians.user_id')
      .where('child_guardians.child_id', '=', childId)
      .where('guardians.user_id', 'is not', null)
      .execute();
    const userIds = [...new Set(guardians.map((row) => row.user_id).filter((id): id is string => id !== null))];
    await queueNotification(transaction, {
      orgUnitId,
      templateCode: message.templateCode,
      title: message.title,
      body: message.body,
      targetType: 'invoices',
      targetId: message.invoiceId,
      recipients: userIds.flatMap((userId) => [
        { userId, channel: 'in_app' as const },
        ...(message.sms ? [{ userId, channel: 'sms' as const }] : []),
      ]),
    });
  }

  // Nhân sự xem học phí theo `P05.view` hoặc quyền tính học phí trong phạm vi đơn vị, không tính vai trò phụ huynh
  private async staffUnits(currentUser: CurrentUser): Promise<{ wholeSchool: boolean; orgUnitIds: string[] }> {
    const units = new Set<string>();
    for (const permission of ['P05.view', PERMISSION_CODES.feeCalculationManage]) {
      const scope = await this.organizationScopes.resolveStaff(currentUser, permission);
      if (scope.wholeSchool) {
        return { wholeSchool: true, orgUnitIds: [] };
      }
      scope.orgUnitIds.forEach((id) => units.add(id));
    }
    return { wholeSchool: false, orgUnitIds: [...units] };
  }

  private async assertStaffCanView(currentUser: CurrentUser, orgUnitId: string): Promise<void> {
    const units = await this.staffUnits(currentUser);
    if (!units.wholeSchool && !units.orgUnitIds.includes(orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem học phí của đơn vị này');
    }
  }
}
