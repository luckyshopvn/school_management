import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Query, Req } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely, Transaction } from 'kysely';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification } from '../common/notification-queue.js';
import { isUuid, notFoundError, readRequiredUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import {
  formatPeriod,
  parsePeriod,
  periodRange,
  RegistrationPeriods,
  type Period,
} from '../fees/registration-periods.js';
import { check, InventoryAccess, readText } from '../inventory/inventory-common.js';
import { PERIOD_LOCK_RULE } from './fiscal-period-lock.js';

// Chốt kỳ tài chính theo tháng của đơn vị (P06-09; BR-25, BR-29, BR-77; Q-133; YCTD-82). Kế toán trưởng đề nghị chốt khi
// tháng đã hết và không còn chứng từ chờ duyệt của kỳ; Hiệu trưởng phê duyệt (không theo hạn mức vì không có giá trị tiền)
// hoặc từ chối kèm lý do. Kỳ đã chốt khóa số liệu: xem fiscal-period-lock.ts. Chưa có mở lại kỳ đã chốt
const VIEW_PERMISSIONS = [
  PERMISSION_CODES.periodCloseRequest,
  PERMISSION_CODES.periodCloseApprove,
  PERMISSION_CODES.receiptManage,
  PERMISSION_CODES.paymentManage,
  'P06.view',
];
const ISSUED_RECEIPT_STATUSES = ['issued', 'pending_reversal', 'reversed'] as const;
const ISSUED_PAYMENT_STATUSES = ['issued', 'pending_reversal', 'reversed'] as const;

type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

@Injectable()
export class FiscalPeriodsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: InventoryAccess,
    private readonly periods: RegistrationPeriods,
    private readonly clock: Clock,
  ) {}

  private today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  // Các tháng của năm học đang mở kèm trạng thái kỳ tài chính của đơn vị
  async list(currentUser: CurrentUser, orgUnitId: string) {
    await this.access.assertUnit(
      currentUser,
      VIEW_PERMISSIONS,
      orgUnitId,
      'Bạn không có quyền xem kỳ tài chính của đơn vị này',
    );
    const { database } = await this.currentSchoolYear.require();
    const rows = await database.selectFrom('fiscal_periods').selectAll().where('org_unit_id', '=', orgUnitId).execute();
    const today = this.today();
    return (await this.periods.list()).map((info) => {
      const [year = 0, month = 0] = info.period.split('-').map(Number);
      const row = rows.find((item) => item.period_year === year && item.period_month === month);
      const ended = periodRange({ year, month }).to < today;
      return {
        period: info.period,
        id: row?.id ?? null,
        status: row?.status ?? 'open',
        ended,
        can_request: ended && (!row || row.status === 'rejected'),
        summary: row?.summary ?? null,
        request_note: row?.request_note ?? null,
        close_requested_by: row?.close_requested_by ?? null,
        close_requested_at: row?.close_requested_at ?? null,
        closed_by: row?.closed_by ?? null,
        closed_at: row?.closed_at ?? null,
        reject_reason: row?.reject_reason ?? null,
      };
    });
  }

  // Số liệu của kỳ để xem trước khi đề nghị: phiếu thu, phiếu chi, hóa đơn, chứng từ chờ duyệt
  async preview(currentUser: CurrentUser, orgUnitId: string, period: Period) {
    await this.access.assertUnit(
      currentUser,
      VIEW_PERMISSIONS,
      orgUnitId,
      'Bạn không có quyền xem kỳ tài chính của đơn vị này',
    );
    await this.periods.require(period);
    const { database } = await this.currentSchoolYear.require();
    return { period: formatPeriod(period), ...(await this.summary(database, orgUnitId, period)) };
  }

  async requestClose(
    currentUser: CurrentUser,
    input: { orgUnitId: string; period: Period; note: string | null },
    origin: ChangeOrigin,
  ) {
    await this.access.assertUnit(
      currentUser,
      [PERMISSION_CODES.periodCloseRequest],
      input.orgUnitId,
      'Chỉ kế toán trưởng đề nghị chốt kỳ tài chính',
    );
    await this.periods.require(input.period);
    if (periodRange(input.period).to >= this.today()) {
      throw ruleViolationError(PERIOD_LOCK_RULE, 'Chỉ đề nghị chốt kỳ khi tháng đã kết thúc');
    }
    const { database } = await this.currentSchoolYear.require();
    const summary = await this.summary(database, input.orgUnitId, input.period);
    this.assertNoPending(summary.pending);
    const id = await database.transaction().execute(async (transaction) => {
      const existing = await transaction
        .selectFrom('fiscal_periods')
        .selectAll()
        .where('org_unit_id', '=', input.orgUnitId)
        .where('period_year', '=', input.period.year)
        .where('period_month', '=', input.period.month)
        .forUpdate()
        .executeTakeFirst();
      if (existing && existing.status !== 'rejected') {
        throw new ApplicationError(
          'ERR_CONFLICT',
          existing.status === 'closed' ? 'Kỳ tài chính đã chốt' : 'Kỳ tài chính đang chờ Hiệu trưởng duyệt chốt',
        );
      }
      const values = {
        status: 'pending' as const,
        summary: JSON.stringify(summary),
        request_note: input.note,
        close_requested_by: origin.actorUserId,
        close_requested_at: this.clock.now(),
        rejected_by: null,
        rejected_at: null,
        reject_reason: null,
      };
      const row = existing
        ? await transaction
            .updateTable('fiscal_periods')
            .set(values)
            .where('id', '=', existing.id)
            .returning('id')
            .executeTakeFirstOrThrow()
        : await transaction
            .insertInto('fiscal_periods')
            .values({
              ...values,
              org_unit_id: input.orgUnitId,
              period_year: input.period.year,
              period_month: input.period.month,
            })
            .returning('id')
            .executeTakeFirstOrThrow();
      const root = await transaction
        .selectFrom('org_units')
        .select('id')
        .where('unit_type', '=', 'truong_chinh')
        .executeTakeFirst();
      await queueNotification(transaction, {
        orgUnitId: input.orgUnitId,
        templateCode: 'fiscal_period_close_pending',
        title: 'Có đề nghị chốt kỳ tài chính',
        body: `Kỳ ${formatPeriod(input.period)}: thu ${summary.receipt_amount} đồng, chi ${summary.payment_amount} đồng`,
        targetType: 'fiscal_periods',
        targetId: row.id,
        recipients: root ? [{ roleCode: 'VT-02', orgUnitId: root.id, channel: 'in_app' as const }] : [],
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: input.orgUnitId,
        entityName: 'fiscal_periods',
        entityId: row.id,
        action: existing ? 'update' : 'create',
        before: existing ? { status: existing.status } : null,
        after: { status: 'pending', period: formatPeriod(input.period), summary },
      });
      return row.id;
    });
    return this.read(database, id);
  }

  // Hiệu trưởng duyệt chốt: kiểm tra lại chứng từ chờ duyệt, ghi số liệu chốt và khóa kỳ
  async close(currentUser: CurrentUser, periodId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const row = await this.load(database, periodId);
    await this.access.assertUnit(
      currentUser,
      [PERMISSION_CODES.periodCloseApprove],
      row.org_unit_id,
      'Chỉ Hiệu trưởng phê duyệt chốt kỳ tài chính',
    );
    if (row.status !== 'pending') {
      throw new ApplicationError('ERR_CONFLICT', 'Kỳ tài chính không ở trạng thái chờ duyệt chốt');
    }
    if (row.close_requested_by === origin.actorUserId) {
      throw ruleViolationError('BR-77', 'Người đề nghị không tự phê duyệt chốt kỳ');
    }
    const period = { year: row.period_year, month: row.period_month };
    await database.transaction().execute(async (transaction) => {
      const locked = await transaction
        .selectFrom('fiscal_periods')
        .select('status')
        .where('id', '=', periodId)
        .forUpdate()
        .executeTakeFirstOrThrow();
      if (locked.status !== 'pending') {
        throw new ApplicationError('ERR_CONFLICT', 'Kỳ tài chính không ở trạng thái chờ duyệt chốt');
      }
      const summary = await this.summary(transaction, row.org_unit_id, period);
      this.assertNoPending(summary.pending);
      await transaction
        .updateTable('fiscal_periods')
        .set({
          status: 'closed',
          summary: JSON.stringify(summary),
          closed_by: origin.actorUserId,
          closed_at: this.clock.now(),
        })
        .where('id', '=', periodId)
        .execute();
      await queueNotification(transaction, {
        orgUnitId: row.org_unit_id,
        templateCode: 'fiscal_period_closed',
        title: 'Kỳ tài chính đã chốt',
        body: `Kỳ ${formatPeriod(period)} đã được Hiệu trưởng duyệt chốt`,
        targetType: 'fiscal_periods',
        targetId: periodId,
        recipients: [{ userId: row.close_requested_by, channel: 'in_app' as const }],
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: row.org_unit_id,
        entityName: 'fiscal_periods',
        entityId: periodId,
        action: 'update',
        before: { status: 'pending' },
        after: { status: 'closed', summary },
      });
    });
    return this.read(database, periodId);
  }

  async reject(currentUser: CurrentUser, periodId: string, reason: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const row = await this.load(database, periodId);
    await this.access.assertUnit(
      currentUser,
      [PERMISSION_CODES.periodCloseApprove],
      row.org_unit_id,
      'Chỉ Hiệu trưởng từ chối chốt kỳ tài chính',
    );
    await database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('fiscal_periods')
        .set({
          status: 'rejected',
          rejected_by: origin.actorUserId,
          rejected_at: this.clock.now(),
          reject_reason: reason,
        })
        .where('id', '=', periodId)
        .where('status', '=', 'pending')
        .returning('id')
        .executeTakeFirst();
      if (!updated) {
        throw new ApplicationError('ERR_CONFLICT', 'Kỳ tài chính không ở trạng thái chờ duyệt chốt');
      }
      await queueNotification(transaction, {
        orgUnitId: row.org_unit_id,
        templateCode: 'fiscal_period_rejected',
        title: 'Đề nghị chốt kỳ tài chính bị từ chối',
        body: `Kỳ ${formatPeriod({ year: row.period_year, month: row.period_month })}: ${reason}`,
        targetType: 'fiscal_periods',
        targetId: periodId,
        recipients: [{ userId: row.close_requested_by, channel: 'in_app' as const }],
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: row.org_unit_id,
        entityName: 'fiscal_periods',
        entityId: periodId,
        action: 'update',
        before: { status: 'pending' },
        after: { status: 'rejected', reject_reason: reason },
      });
    });
    return this.read(database, periodId);
  }

  private assertNoPending(pending: Array<{ document: string; count: number }>) {
    const blocking = pending.filter((item) => item.count > 0);
    if (blocking.length > 0) {
      throw ruleViolationError(
        PERIOD_LOCK_RULE,
        'Kỳ còn chứng từ chờ duyệt hoặc hóa đơn nháp, xử lý xong trước khi chốt',
        blocking.map((item) => ({ field: item.document, message: `Còn ${item.count}` })),
      );
    }
  }

  // Số liệu của kỳ: phiếu thu, phiếu chi có ngày thuộc kỳ, hóa đơn đã phát hành của kỳ, chứng từ đang chờ
  private async summary(executor: Executor, orgUnitId: string, period: Period) {
    const { from, to } = periodRange(period);
    const receipts = await executor
      .selectFrom('receipts')
      .select((expression) => [
        expression.fn.countAll<string>().as('count'),
        expression.fn.sum<string | null>('amount').as('amount'),
      ])
      .where('org_unit_id', '=', orgUnitId)
      .where('receipt_date', '>=', from)
      .where('receipt_date', '<=', to)
      .where('status', 'in', ISSUED_RECEIPT_STATUSES)
      .executeTakeFirst();
    const payments = await executor
      .selectFrom('payments')
      .select((expression) => [
        expression.fn.countAll<string>().as('count'),
        expression.fn.sum<string | null>('amount').as('amount'),
      ])
      .where('org_unit_id', '=', orgUnitId)
      .where('payment_date', '>=', from)
      .where('payment_date', '<=', to)
      .where('status', 'in', ISSUED_PAYMENT_STATUSES)
      .executeTakeFirst();
    const invoices = await executor
      .selectFrom('invoices')
      .select((expression) => [
        expression.fn.countAll<string>().as('count'),
        expression.fn.sum<string | null>('total_amount').as('amount'),
      ])
      .where('org_unit_id', '=', orgUnitId)
      .where('period_year', '=', period.year)
      .where('period_month', '=', period.month)
      .where('status', '=', 'issued')
      .executeTakeFirst();
    const countOf = async (query: Promise<{ count: string } | undefined>) => Number((await query)?.count ?? 0);
    const pending = [
      {
        document: 'draft_invoices',
        count: await countOf(
          executor
            .selectFrom('invoices')
            .select((expression) => expression.fn.countAll<string>().as('count'))
            .where('org_unit_id', '=', orgUnitId)
            .where('period_year', '=', period.year)
            .where('period_month', '=', period.month)
            .where('status', '=', 'draft')
            .executeTakeFirst(),
        ),
      },
      {
        document: 'discounts',
        count: await countOf(
          executor
            .selectFrom('discounts')
            .innerJoin('invoices', 'invoices.id', 'discounts.invoice_id')
            .select((expression) => expression.fn.countAll<string>().as('count'))
            .where('invoices.org_unit_id', '=', orgUnitId)
            .where('invoices.period_year', '=', period.year)
            .where('invoices.period_month', '=', period.month)
            .where('discounts.status', '=', 'pending')
            .executeTakeFirst(),
        ),
      },
      {
        document: 'invoice_adjustments',
        count: await countOf(
          executor
            .selectFrom('invoice_adjustments')
            .innerJoin('invoices', 'invoices.id', 'invoice_adjustments.invoice_id')
            .select((expression) => expression.fn.countAll<string>().as('count'))
            .where('invoices.org_unit_id', '=', orgUnitId)
            .where('invoices.period_year', '=', period.year)
            .where('invoices.period_month', '=', period.month)
            .where('invoice_adjustments.status', '=', 'pending')
            .executeTakeFirst(),
        ),
      },
      {
        document: 'receipt_reversals',
        count: await countOf(
          executor
            .selectFrom('receipt_reversals')
            .innerJoin('receipts', 'receipts.id', 'receipt_reversals.receipt_id')
            .select((expression) => expression.fn.countAll<string>().as('count'))
            .where('receipts.org_unit_id', '=', orgUnitId)
            .where('receipts.receipt_date', '>=', from)
            .where('receipts.receipt_date', '<=', to)
            .where('receipt_reversals.status', '=', 'pending')
            .executeTakeFirst(),
        ),
      },
      {
        document: 'payment_reversals',
        count: await countOf(
          executor
            .selectFrom('payment_reversals')
            .innerJoin('payments', 'payments.id', 'payment_reversals.payment_id')
            .select((expression) => expression.fn.countAll<string>().as('count'))
            .where('payments.org_unit_id', '=', orgUnitId)
            .where('payments.payment_date', '>=', from)
            .where('payments.payment_date', '<=', to)
            .where('payment_reversals.status', '=', 'pending')
            .executeTakeFirst(),
        ),
      },
    ];
    return {
      receipt_count: Number(receipts?.count ?? 0),
      receipt_amount: Number(receipts?.amount ?? 0),
      payment_count: Number(payments?.count ?? 0),
      payment_amount: Number(payments?.amount ?? 0),
      invoice_count: Number(invoices?.count ?? 0),
      invoice_amount: Number(invoices?.amount ?? 0),
      pending,
    };
  }

  private async load(database: Kysely<SchoolYearDatabase>, periodId: string) {
    const row = await database.selectFrom('fiscal_periods').selectAll().where('id', '=', periodId).executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy kỳ tài chính', 'fiscal_period');
    }
    return row;
  }

  private async read(database: Kysely<SchoolYearDatabase>, periodId: string) {
    const row = await this.load(database, periodId);
    return { ...row, period: formatPeriod({ year: row.period_year, month: row.period_month }) };
  }
}

@Controller('fiscal-periods')
export class FiscalPeriodsController {
  constructor(private readonly service: FiscalPeriodsService) {}

  @Get()
  list(@Query('org_unit_id') orgUnitId: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    if (!isUuid(orgUnitId)) {
      throw validationError([{ field: 'org_unit_id', message: 'Bắt buộc chọn đơn vị' }]);
    }
    return this.service.list(currentUser, orgUnitId);
  }

  @Get('preview')
  preview(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    if (!isUuid(query.org_unit_id)) {
      throw validationError([{ field: 'org_unit_id', message: 'Bắt buộc chọn đơn vị' }]);
    }
    return this.service.preview(currentUser, query.org_unit_id, parsePeriod(query.period));
  }

  @Post()
  @HttpCode(201)
  requestClose(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const orgUnitId = readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị');
    const note = readText(body, 'note', errors, false);
    check(errors);
    return this.service.requestClose(
      currentUser,
      { orgUnitId, period: parsePeriod(body?.period), note },
      originOf(request, currentUser),
    );
  }

  @Post(':id/close')
  @HttpCode(200)
  close(
    @Param('id', uuidParameter('Mã kỳ tài chính không hợp lệ')) periodId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.service.close(currentUser, periodId, originOf(request, currentUser));
  }

  @Post(':id/reject')
  @HttpCode(200)
  reject(
    @Param('id', uuidParameter('Mã kỳ tài chính không hợp lệ')) periodId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const reason = readText(body, 'reason', errors, true) ?? '';
    check(errors);
    return this.service.reject(currentUser, periodId, reason, originOf(request, currentUser));
  }
}
