import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Query, Req } from '@nestjs/common';
import type { DebtResolutionStatus, SchoolYearDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification } from '../common/notification-queue.js';
import {
  isUuid,
  notFoundError,
  readOptionalUuid,
  readRequiredUuid,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { DebtsService } from '../fees/debts.service.js';
import {
  check,
  InventoryAccess,
  optionalEnumQuery,
  optionalUuidQuery,
  readText,
} from '../inventory/inventory-common.js';
import { readIntegration } from '../integrations/integrations.js';
import { SettingsService } from '../settings/settings.service.js';
import { guardianUserIds, smsGuardianUserIds } from './receivables.js';

// Nhắc nợ và xử lý công nợ quá hạn (P05-10, P05-12; BR-33; YCTD-23, YCTD-82). Danh sách nhắc nợ gồm hóa đơn đã phát hành
// còn nợ và đã quá hạn; mốc là mốc cấu hình lớn nhất đã tới (mặc định 3, 7, 15 ngày). Mỗi hóa đơn nhắc một lần ở mỗi mốc,
// gửi trong ứng dụng cho phụ huynh; khi nhà trường bật Zalo Official Account thì gửi thêm qua kênh zalo (Zalo nếu phụ huynh
// đã liên kết, không thì tin nhắn; G3-08, YCTD-90). Đề xuất xử lý do quản lý đơn vị hoặc kế toán lập, Phó Hiệu trưởng hoặc Hiệu trưởng
// ghi quyết định; đề xuất và quyết định không đổi số tiền công nợ (thay đổi số tiền phải qua miễn giảm, điều chỉnh)
const REMINDER_VIEW = [PERMISSION_CODES.debtReminderManage, PERMISSION_CODES.debtView];
const RESOLUTION_VIEW = [
  PERMISSION_CODES.overdueDebtPropose,
  PERMISSION_CODES.overdueDebtDecide,
  PERMISSION_CODES.debtView,
];
const DEFAULT_MILESTONES = [3, 7, 15];
const MAXIMUM_INVOICES_PER_SEND = 500;

const periodLabel = (year: number, month: number) => `${String(month).padStart(2, '0')}/${year}`;

@Injectable()
export class DebtCollectionService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: InventoryAccess,
    private readonly debts: DebtsService,
    private readonly settings: SettingsService,
    private readonly clock: Clock,
  ) {}

  async milestones(orgUnitId: string): Promise<number[]> {
    const setting = (await this.settings.effective(orgUnitId)).find((item) => item.key === 'debt_reminder_days');
    const value = Array.isArray(setting?.value) ? (setting.value as unknown[]).map(Number) : DEFAULT_MILESTONES;
    return value.filter((day) => Number.isInteger(day) && day > 0).sort((left, right) => left - right);
  }

  // P05-10: hóa đơn quá hạn của đơn vị kèm mốc đã tới, lần nhắc gần nhất, cần nhắc ở mốc hiện tại chưa
  async reminders(
    currentUser: CurrentUser,
    filter: { orgUnitId: string; classId: string | null; milestone: number | null; dueOnly: boolean },
  ) {
    await this.access.assertUnit(
      currentUser,
      REMINDER_VIEW,
      filter.orgUnitId,
      'Bạn không có quyền xem danh sách nhắc nợ của đơn vị này',
    );
    const { database } = await this.currentSchoolYear.require();
    const rows = await this.overdueRows(database, filter.orgUnitId, filter.classId);
    const filtered = rows
      .filter((row) => filter.milestone === null || row.milestone_days === filter.milestone)
      .filter((row) => !filter.dueOnly || row.needs_reminder);
    return {
      milestones: await this.milestones(filter.orgUnitId),
      rows: filtered,
      totals: {
        invoice_count: filtered.length,
        child_count: new Set(filtered.map((row) => row.child_id)).size,
        outstanding_amount: filtered.reduce((sum, row) => sum + row.outstanding_amount, 0),
        needs_reminder_count: filtered.filter((row) => row.needs_reminder).length,
      },
    };
  }

  private async overdueRows(database: Kysely<SchoolYearDatabase>, orgUnitId: string, classId: string | null) {
    let childrenQuery = database
      .selectFrom('children')
      .leftJoin('class_enrollments', (join) =>
        join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
      )
      .leftJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select(['children.id', 'children.full_name', 'classes.id as class_id', 'classes.name as class_name'])
      .where('children.org_unit_id', '=', orgUnitId);
    if (classId) {
      childrenQuery = childrenQuery.where('classes.id', '=', classId);
    }
    const children = await childrenQuery.execute();
    const childById = new Map(children.map((child) => [child.id, child]));
    const invoices = (
      await this.debts.invoiceRows(
        database,
        children.map((child) => child.id),
      )
    ).filter((invoice) => invoice.payment_status === 'overdue');
    const milestones = await this.milestones(orgUnitId);
    const sent = invoices.length
      ? await database
          .selectFrom('debt_reminders')
          .select(['invoice_id', 'milestone_days', 'sent_at'])
          .where(
            'invoice_id',
            'in',
            invoices.map((invoice) => invoice.id),
          )
          .orderBy('sent_at', 'desc')
          .execute()
      : [];
    return invoices
      .map((invoice) => {
        const child = childById.get(invoice.child_id);
        const milestone = Math.max(0, ...milestones.filter((day) => day <= invoice.overdue_days));
        const own = sent.filter((row) => row.invoice_id === invoice.id);
        const last = own[0];
        return {
          invoice_id: invoice.id,
          invoice_code: invoice.code,
          period: `${invoice.period_year}-${String(invoice.period_month).padStart(2, '0')}`,
          child_id: invoice.child_id,
          child_name: child?.full_name ?? '',
          class_id: child?.class_id ?? null,
          class_name: child?.class_name ?? null,
          due_date: invoice.due_date,
          payable_amount: invoice.payable_amount,
          outstanding_amount: invoice.outstanding_amount,
          overdue_days: invoice.overdue_days,
          milestone_days: milestone,
          last_reminder_milestone: last?.milestone_days ?? null,
          last_reminded_at: last?.sent_at ?? null,
          needs_reminder: milestone > 0 && !own.some((row) => row.milestone_days === milestone),
        };
      })
      .sort(
        (left, right) =>
          right.overdue_days - left.overdue_days ||
          (left.class_name ?? '').localeCompare(right.class_name ?? '') ||
          left.child_name.localeCompare(right.child_name),
      );
  }

  // P05-10: gửi nhắc nợ cho phụ huynh của các hóa đơn được chọn; hóa đơn hết quá hạn hoặc đã nhắc ở mốc hiện tại thì bỏ qua
  async sendReminders(currentUser: CurrentUser, orgUnitId: string, invoiceIds: string[], origin: ChangeOrigin) {
    await this.access.assertUnit(
      currentUser,
      [PERMISSION_CODES.debtReminderManage],
      orgUnitId,
      'Bạn không có quyền gửi nhắc nợ của đơn vị này',
    );
    const { database } = await this.currentSchoolYear.require();
    const rows = new Map((await this.overdueRows(database, orgUnitId, null)).map((row) => [row.invoice_id, row]));
    const skipped: Array<{ invoice_id: string; reason: string }> = [];
    const viaZalo = (await readIntegration(database, 'zalo')).enabled;
    let sentCount = 0;
    for (const invoiceId of [...new Set(invoiceIds)]) {
      const row = rows.get(invoiceId);
      if (!row) {
        skipped.push({ invoice_id: invoiceId, reason: 'Hóa đơn không thuộc đơn vị hoặc không còn quá hạn' });
        continue;
      }
      const sent = await database.transaction().execute(async (transaction) => {
        const inserted = await transaction
          .insertInto('debt_reminders')
          .values({
            org_unit_id: orgUnitId,
            child_id: row.child_id,
            invoice_id: row.invoice_id,
            milestone_days: row.milestone_days,
            overdue_days: row.overdue_days,
            outstanding_amount: row.outstanding_amount,
            sent_by: origin.actorUserId,
          })
          .onConflict((conflict) => conflict.columns(['invoice_id', 'milestone_days']).doNothing())
          .returning('id')
          .executeTakeFirst();
        if (!inserted) {
          return false;
        }
        const [year = '', month = ''] = row.period.split('-');
        await queueNotification(transaction, {
          orgUnitId,
          templateCode: 'debt_reminder',
          title: 'Nhắc nộp học phí quá hạn',
          body: `${row.child_name} còn ${row.outstanding_amount} đồng của hóa đơn ${row.invoice_code ?? ''} kỳ ${periodLabel(Number(year), Number(month))}, đã quá hạn ${row.overdue_days} ngày (hạn ${row.due_date ?? ''})`,
          targetType: 'invoices',
          targetId: row.invoice_id,
          recipients: [
            ...(await guardianUserIds(transaction, row.child_id)).map((userId) => ({
              userId,
              channel: 'in_app' as const,
            })),
            ...(viaZalo ? await smsGuardianUserIds(transaction, row.child_id) : []).map((userId) => ({
              userId,
              channel: 'zalo' as const,
            })),
          ],
        });
        await writeAuditLog(transaction, {
          origin,
          orgUnitId,
          entityName: 'debt_reminders',
          entityId: inserted.id,
          action: 'create',
          before: null,
          after: {
            invoice_id: row.invoice_id,
            milestone_days: row.milestone_days,
            overdue_days: row.overdue_days,
            outstanding_amount: row.outstanding_amount,
          },
        });
        return true;
      });
      if (sent) {
        sentCount += 1;
      } else {
        skipped.push({ invoice_id: invoiceId, reason: 'Đã nhắc ở mốc này' });
      }
    }
    return { sent_count: sentCount, skipped };
  }

  // P05-12: lập đề xuất xử lý cho trẻ còn nợ quá hạn; mỗi trẻ chỉ có một đề xuất đang chờ quyết định
  async propose(
    currentUser: CurrentUser,
    input: { childId: string; invoiceId: string | null; proposal: string },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const child = await database
      .selectFrom('children')
      .select(['id', 'full_name', 'org_unit_id'])
      .where('id', '=', input.childId)
      .executeTakeFirst();
    if (!child) {
      throw notFoundError('Không tìm thấy trẻ', 'child');
    }
    await this.access.assertUnit(
      currentUser,
      [PERMISSION_CODES.overdueDebtPropose],
      child.org_unit_id,
      'Bạn không có quyền lập đề xuất xử lý công nợ của đơn vị này',
    );
    const invoices = (await this.debts.invoiceRows(database, [child.id])).filter(
      (invoice) => invoice.payment_status === 'overdue',
    );
    const scoped = input.invoiceId ? invoices.filter((invoice) => invoice.id === input.invoiceId) : invoices;
    if (scoped.length === 0) {
      throw ruleViolationError(
        'BR-33',
        input.invoiceId ? 'Hóa đơn không còn nợ quá hạn' : 'Trẻ không có công nợ quá hạn để đề xuất xử lý',
      );
    }
    const overdueAmount = scoped.reduce((sum, invoice) => sum + invoice.outstanding_amount, 0);
    const overdueDays = Math.max(...scoped.map((invoice) => invoice.overdue_days));
    try {
      const created = await database.transaction().execute(async (transaction) => {
        const row = await transaction
          .insertInto('debt_resolutions')
          .values({
            org_unit_id: child.org_unit_id,
            child_id: child.id,
            invoice_id: input.invoiceId,
            overdue_amount: overdueAmount,
            overdue_days: overdueDays,
            proposal: input.proposal,
            proposed_by: origin.actorUserId,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        const root = await transaction
          .selectFrom('org_units')
          .select('id')
          .where('unit_type', '=', 'truong_chinh')
          .executeTakeFirst();
        await queueNotification(transaction, {
          orgUnitId: child.org_unit_id,
          templateCode: 'debt_resolution_pending',
          title: 'Có đề xuất xử lý công nợ quá hạn',
          body: `${child.full_name}: nợ quá hạn ${overdueAmount} đồng, ${overdueDays} ngày. Đề xuất: ${input.proposal}`,
          targetType: 'debt_resolutions',
          targetId: row.id,
          recipients: [
            { roleCode: 'VT-15', orgUnitId: child.org_unit_id, channel: 'in_app' as const },
            ...(root ? [{ roleCode: 'VT-02', orgUnitId: root.id, channel: 'in_app' as const }] : []),
          ],
        });
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: child.org_unit_id,
          entityName: 'debt_resolutions',
          entityId: row.id,
          action: 'create',
          before: null,
          after: {
            child_id: child.id,
            invoice_id: input.invoiceId,
            overdue_amount: overdueAmount,
            proposal: input.proposal,
          },
        });
        return row;
      });
      return this.read(database, created.id);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ApplicationError('ERR_CONFLICT', 'Trẻ đã có đề xuất xử lý công nợ đang chờ quyết định', [
          { field: 'child_id', message: 'Đang chờ quyết định' },
        ]);
      }
      throw error;
    }
  }

  // P05-12: Phó Hiệu trưởng hoặc Hiệu trưởng ghi quyết định; chỉ ghi nhận, không đổi hóa đơn hay phiếu thu
  async decide(currentUser: CurrentUser, resolutionId: string, decision: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const resolution = await database
      .selectFrom('debt_resolutions')
      .selectAll()
      .where('id', '=', resolutionId)
      .executeTakeFirst();
    if (!resolution) {
      throw notFoundError('Không tìm thấy đề xuất xử lý công nợ', 'debt_resolution');
    }
    await this.access.assertUnit(
      currentUser,
      [PERMISSION_CODES.overdueDebtDecide],
      resolution.org_unit_id,
      'Chỉ Phó Hiệu trưởng hoặc Hiệu trưởng ghi quyết định xử lý công nợ',
    );
    await database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('debt_resolutions')
        .set({ status: 'decided', decision, decided_by: origin.actorUserId, decided_at: this.clock.now() })
        .where('id', '=', resolutionId)
        .where('status', '=', 'pending')
        .returning('id')
        .executeTakeFirst();
      if (!updated) {
        throw new ApplicationError('ERR_CONFLICT', 'Đề xuất đã có quyết định');
      }
      await queueNotification(transaction, {
        orgUnitId: resolution.org_unit_id,
        templateCode: 'debt_resolution_decided',
        title: 'Đã có quyết định xử lý công nợ quá hạn',
        body: decision,
        targetType: 'debt_resolutions',
        targetId: resolutionId,
        recipients: [{ userId: resolution.proposed_by, channel: 'in_app' as const }],
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: resolution.org_unit_id,
        entityName: 'debt_resolutions',
        entityId: resolutionId,
        action: 'update',
        before: { status: 'pending' },
        after: { status: 'decided', decision },
      });
    });
    return this.read(database, resolutionId);
  }

  async list(
    currentUser: CurrentUser,
    filter: { orgUnitId: string | null; childId: string | null; status: DebtResolutionStatus | null },
  ) {
    const scope = await this.access.requireScope(
      currentUser,
      RESOLUTION_VIEW,
      'Bạn không có quyền xem đề xuất xử lý công nợ',
    );
    const { database } = await this.currentSchoolYear.require();
    let query = this.query(database).orderBy('debt_resolutions.proposed_at', 'desc');
    if (!scope.wholeSchool) {
      query = query.where('debt_resolutions.org_unit_id', 'in', scope.orgUnitIds);
    }
    if (filter.orgUnitId) {
      query = query.where('debt_resolutions.org_unit_id', '=', filter.orgUnitId);
    }
    if (filter.childId) {
      query = query.where('debt_resolutions.child_id', '=', filter.childId);
    }
    if (filter.status) {
      query = query.where('debt_resolutions.status', '=', filter.status);
    }
    return (await query.execute()).map(toView);
  }

  private query(database: Kysely<SchoolYearDatabase>) {
    return database
      .selectFrom('debt_resolutions')
      .innerJoin('children', 'children.id', 'debt_resolutions.child_id')
      .leftJoin('invoices', 'invoices.id', 'debt_resolutions.invoice_id')
      .selectAll('debt_resolutions')
      .select(['children.full_name as child_name', 'invoices.code as invoice_code']);
  }

  private async read(database: Kysely<SchoolYearDatabase>, resolutionId: string) {
    return toView(await this.query(database).where('debt_resolutions.id', '=', resolutionId).executeTakeFirstOrThrow());
  }
}

function toView<Row extends { overdue_amount: string }>(row: Row) {
  return { ...row, overdue_amount: Number(row.overdue_amount) };
}

@Controller()
export class DebtCollectionController {
  constructor(private readonly service: DebtCollectionService) {}

  @Get('debts/reminders')
  reminders(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    if (!isUuid(query.org_unit_id)) {
      throw validationError([{ field: 'org_unit_id', message: 'Bắt buộc chọn đơn vị' }]);
    }
    let milestone: number | null = null;
    if (query.milestone !== undefined && query.milestone !== '') {
      milestone = Number(query.milestone);
      if (!Number.isInteger(milestone) || milestone < 0) {
        throw validationError([{ field: 'milestone', message: 'Mốc là số ngày nguyên không âm' }]);
      }
    }
    return this.service.reminders(currentUser, {
      orgUnitId: query.org_unit_id,
      classId: optionalUuidQuery(query.class_id, 'class_id'),
      milestone,
      dueOnly: query.due_only === 'true',
    });
  }

  @Post('debts/reminders/send')
  @HttpCode(200)
  send(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const orgUnitId = readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị');
    const invoiceIds = body?.invoice_ids;
    if (
      !Array.isArray(invoiceIds) ||
      invoiceIds.length === 0 ||
      invoiceIds.length > MAXIMUM_INVOICES_PER_SEND ||
      !invoiceIds.every(isUuid)
    ) {
      errors.push({ field: 'invoice_ids', message: `Chọn từ 1 đến ${MAXIMUM_INVOICES_PER_SEND} hóa đơn` });
    }
    check(errors);
    return this.service.sendReminders(currentUser, orgUnitId, invoiceIds as string[], originOf(request, currentUser));
  }

  @Get('debt-resolutions')
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.service.list(currentUser, {
      orgUnitId: optionalUuidQuery(query.org_unit_id, 'org_unit_id'),
      childId: optionalUuidQuery(query.child_id, 'child_id'),
      status: optionalEnumQuery(query.status, 'status', ['pending', 'decided'] as const),
    });
  }

  @Post('debt-resolutions')
  @HttpCode(201)
  propose(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      childId: readRequiredUuid(body, 'child_id', errors, 'Bắt buộc chọn trẻ'),
      invoiceId: readOptionalUuid(body, 'invoice_id', errors) ?? null,
      proposal: readText(body, 'proposal', errors, true) ?? '',
    };
    check(errors);
    return this.service.propose(currentUser, input, originOf(request, currentUser));
  }

  @Post('debt-resolutions/:id/decide')
  @HttpCode(200)
  decide(
    @Param('id', uuidParameter('Mã đề xuất không hợp lệ')) resolutionId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const decision = readText(body, 'decision', errors, true) ?? '';
    check(errors);
    return this.service.decide(currentUser, resolutionId, decision, originOf(request, currentUser));
  }
}
