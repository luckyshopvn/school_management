import { Injectable } from '@nestjs/common';
import { TUTORING_PAY_ITEM_CODE, type SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, validationError } from '@school-management/server';
import {
  PERMISSION_CODES,
  teacherPayFor,
  TUTORING_CANCEL_REFUND_LABELS,
  TUTORING_CONTENT_TYPE_LABELS,
  TUTORING_CREDIT_STATUS_LABELS,
  TUTORING_FEE_BASIS_LABELS,
  TUTORING_FUNDING_SOURCE_LABELS,
  TUTORING_PAY_ITEM_NAME,
  type TutoringFundingSource,
} from '@school-management/shared';
import type { Kysely, Transaction } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { notFoundError } from '../common/request-fields.js';
import { buildTableFile, CONTENT_TYPES } from '../exports/table-file.js';
import { DiscountsService } from '../fees/discounts.service.js';
import { periodRange } from '../fees/registration-periods.js';
import { assertTutoringModule, tutoringRuleError } from './tutoring.js';

// Thu chi của chương trình gia sư trong trường (DT-27 phần 27c, YCTD-253; tài liệu 47 mục 19.5): báo cáo thu, trừ, hoàn, chi thù lao
// theo chương trình và kỳ (xuất Excel); đẩy thù lao giáo viên vào bảng lương tháng; xử lý khoản trừ của buổi bị hủy (kế toán lập
// điều chỉnh giảm hóa đơn qua luồng điều chỉnh hiện có, chuyển sang trừ kỳ sau, hoặc đóng sau khi đã hoàn qua phiếu chi hoàn).
// Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - kế toán (quyền nhập thưởng, khấu trừ của phân hệ lương) đẩy thù lao; Ban Giám hiệu, kế toán xem trước và xem báo cáo; bảng lương
//   của tháng đã gửi duyệt hoặc đã duyệt thì không đẩy (BR-45), buổi còn lại đẩy vào tháng sau;
// - thù lao ghi theo giáo viên đã dạy buổi (ghi khi xác nhận điểm danh); giáo viên chưa có hồ sơ nhân sự hoặc chương trình chưa có
//   đơn giá thì buổi được liệt kê để bổ sung, không đẩy.
type Database = Kysely<SchoolYearDatabase>;
type Executor = Database | Transaction<SchoolYearDatabase>;

const MANAGE = PERMISSION_CODES.tutoringManage;
const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const dateText = (value: unknown) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
const monthOf = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;

function parseMonth(value: unknown, field: string): { year: number; month: number } {
  const match = typeof value === 'string' ? MONTH.exec(value) : null;
  if (!match) {
    throw validationError([{ field, message: 'Tháng dạng yyyy-mm' }]);
  }
  return { year: Number(match[1]), month: Number(match[2]) };
}

export interface PendingPayRow {
  session_id: string;
  session_date: string;
  program_id: string;
  program_name: string;
  teacher_user_id: string | null;
  teacher_name: string | null;
  staff_id: string | null;
  periods: number;
  rate: number | null;
  amount: number | null;
  funding_source: TutoringFundingSource;
  problem: string | null;
}

@Injectable()
export class TutoringFinanceService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly discounts: DiscountsService,
    private readonly clock: Clock,
  ) {}

  private async database(): Promise<Database> {
    assertTutoringModule();
    return (await this.currentSchoolYear.require()).database;
  }

  // Kế toán xử lý khoản trừ: quản lý gia sư, lập điều chỉnh hóa đơn hoặc lập phiếu chi
  private assertCanHandleCredits(currentUser: CurrentUser) {
    if (
      !currentUser.hasPermission(MANAGE) &&
      !currentUser.hasPermission(PERMISSION_CODES.invoiceAdjustmentCreate) &&
      !currentUser.hasPermission(PERMISSION_CODES.paymentManage)
    ) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Không có quyền xử lý khoản trừ của chương trình gia sư');
    }
  }

  // ---------- Thù lao giáo viên

  // Buổi đã dạy (chưa hủy, đã xác nhận điểm danh) đến hết ngày `upTo` chưa đẩy vào bảng lương (dòng thưởng đã bị hủy ở phân hệ
  // lương thì tính là chưa đẩy)
  async pendingPay(database: Executor, upTo: string): Promise<PendingPayRow[]> {
    const sessions = await database
      .selectFrom('tutoring_sessions')
      .innerJoin('tutoring_programs', 'tutoring_programs.id', 'tutoring_sessions.program_id')
      .leftJoin('tutoring_program_teachers', (join) =>
        join
          .onRef('tutoring_program_teachers.program_id', '=', 'tutoring_sessions.program_id')
          .onRef('tutoring_program_teachers.teacher_user_id', '=', 'tutoring_sessions.taught_by_user_id'),
      )
      .leftJoin('staff', 'staff.user_id', 'tutoring_sessions.taught_by_user_id')
      .select([
        'tutoring_sessions.id',
        'tutoring_sessions.session_date',
        'tutoring_sessions.periods',
        'tutoring_sessions.taught_by_user_id',
        'tutoring_sessions.taught_by_name',
        'tutoring_programs.id as program_id',
        'tutoring_programs.name as program_name',
        'tutoring_programs.pay_rate_per_period',
        'tutoring_programs.funding_source',
        'tutoring_program_teachers.pay_rate_per_period as teacher_rate',
        'staff.id as staff_id',
        'staff.status as staff_status',
      ])
      .where('tutoring_sessions.status', '=', 'scheduled')
      .where('tutoring_sessions.attendance_confirmed_at', 'is not', null)
      .where('tutoring_sessions.session_date', '<=', upTo)
      .where((expression) =>
        expression.not(
          expression.exists(
            expression
              .selectFrom('tutoring_teacher_pay')
              .innerJoin(
                'staff_bonus_deductions',
                'staff_bonus_deductions.id',
                'tutoring_teacher_pay.bonus_deduction_id',
              )
              .select('tutoring_teacher_pay.id')
              .whereRef('tutoring_teacher_pay.session_id', '=', 'tutoring_sessions.id')
              .where('staff_bonus_deductions.status', '=', 'active'),
          ),
        ),
      )
      .orderBy('tutoring_sessions.session_date')
      .orderBy('tutoring_sessions.start_time')
      .execute();
    return sessions.map((session) => {
      const pay = teacherPayFor(
        session.periods,
        session.pay_rate_per_period === null ? null : Number(session.pay_rate_per_period),
        session.teacher_rate === null || session.teacher_rate === undefined ? null : Number(session.teacher_rate),
      );
      const staffActive = session.staff_id !== null && session.staff_status === 'active';
      return {
        session_id: session.id,
        session_date: dateText(session.session_date),
        program_id: session.program_id,
        program_name: session.program_name,
        teacher_user_id: session.taught_by_user_id,
        teacher_name: session.taught_by_name,
        staff_id: staffActive ? session.staff_id : null,
        periods: session.periods,
        rate: pay?.rate ?? null,
        amount: pay?.amount ?? null,
        funding_source: session.funding_source,
        problem: !session.taught_by_user_id
          ? 'Chưa ghi giáo viên dạy buổi'
          : !pay
            ? 'Chương trình chưa có đơn giá thù lao'
            : !staffActive
              ? 'Giáo viên chưa có hồ sơ nhân sự đang làm việc'
              : null,
      };
    });
  }

  async previewPay(month: unknown) {
    const database = await this.database();
    const period = parseMonth(month, 'month');
    const rows = await this.pendingPay(database, periodRange(period).to);
    return {
      month: monthOf(period.year, period.month),
      payroll_status: await this.payrollStatus(database, period),
      rows,
      total: rows.reduce((sum, row) => sum + (row.problem ? 0 : (row.amount ?? 0)), 0),
    };
  }

  private async payrollStatus(database: Executor, period: { year: number; month: number }) {
    const payroll = await database
      .selectFrom('payrolls')
      .select('status')
      .where('period_year', '=', period.year)
      .where('period_month', '=', period.month)
      .executeTakeFirst();
    return payroll?.status ?? null;
  }

  // Đẩy thù lao các buổi đã dạy đến hết tháng vào bảng lương tháng: một dòng thưởng mỗi giáo viên, chịu thuế thu nhập cá nhân theo
  // biểu thuế của lần tính lương
  async pushPay(currentUser: CurrentUser, month: unknown, origin: ChangeOrigin) {
    const database = await this.database();
    if (!currentUser.hasPermission(PERMISSION_CODES.bonusDeductionManage)) {
      throw new ApplicationError(
        'ERR_FORBIDDEN',
        'Cần quyền nhập thưởng, khấu trừ của phân hệ lương để đẩy thù lao vào bảng lương',
      );
    }
    const period = parseMonth(month, 'month');
    const status = await this.payrollStatus(database, period);
    if (status !== null && status !== 'draft') {
      throw tutoringRuleError([
        {
          code: 'payroll_locked',
          message: `Bảng lương tháng ${monthOf(period.year, period.month)} đã gửi duyệt hoặc đã duyệt; đẩy thù lao vào tháng sau`,
        },
      ]);
    }
    const payItem = await database
      .selectFrom('pay_item_types')
      .select(['id', 'status'])
      .where('code', '=', TUTORING_PAY_ITEM_CODE)
      .executeTakeFirst();
    if (!payItem || payItem.status !== 'active') {
      throw new ApplicationError(
        'ERR_CONFLICT',
        `Khoản mục lương "${TUTORING_PAY_ITEM_NAME}" chưa có hoặc đã ngừng dùng`,
      );
    }
    const rows = await this.pendingPay(database, periodRange(period).to);
    const payable = rows.filter((row) => row.problem === null);
    const byStaff = new Map<string, PendingPayRow[]>();
    for (const row of payable) {
      const list = byStaff.get(row.staff_id as string) ?? [];
      list.push(row);
      byStaff.set(row.staff_id as string, list);
    }
    const now = this.clock.now();
    const pushed = await database.transaction().execute(async (transaction) => {
      const result: { staff_id: string; teacher_name: string; sessions: number; amount: number }[] = [];
      for (const [staffId, list] of byStaff) {
        const amount = list.reduce((sum, row) => sum + (row.amount as number), 0);
        const programs = [...new Set(list.map((row) => row.program_name))];
        const bonus = await transaction
          .insertInto('staff_bonus_deductions')
          .values({
            staff_id: staffId,
            pay_item_type_id: payItem.id,
            target_year: period.year,
            target_month: period.month,
            amount,
            basis: `${TUTORING_PAY_ITEM_NAME}: ${list.length} buổi (${programs.join(', ')})`.slice(0, 1000),
            created_by: origin.actorUserId,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await transaction
          .insertInto('tutoring_teacher_pay')
          .values(
            list.map((row) => ({
              session_id: row.session_id,
              program_id: row.program_id,
              teacher_user_id: row.teacher_user_id as string,
              teacher_name: row.teacher_name ?? '',
              staff_id: staffId,
              periods: row.periods,
              rate: row.rate as number,
              amount: row.amount as number,
              funding_source: row.funding_source,
              bonus_deduction_id: bonus.id,
              target_year: period.year,
              target_month: period.month,
              pushed_by_name: currentUser.description.full_name,
              pushed_at: now,
            })),
          )
          .execute();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: null,
          entityName: 'staff_bonus_deductions',
          entityId: bonus.id,
          action: 'create',
          before: null,
          after: { source: 'tutoring', month: monthOf(period.year, period.month), sessions: list.length, amount },
        });
        result.push({ staff_id: staffId, teacher_name: list[0]?.teacher_name ?? '', sessions: list.length, amount });
      }
      return result;
    });
    return {
      month: monthOf(period.year, period.month),
      pushed,
      skipped: rows.filter((row) => row.problem !== null),
    };
  }

  // ---------- Khoản trừ của buổi bị hủy

  async listCredits(currentUser: CurrentUser) {
    this.assertCanHandleCredits(currentUser);
    const database = await this.database();
    return this.creditRows(database);
  }

  private async creditRows(database: Executor) {
    const credits = await database
      .selectFrom('tutoring_credits')
      .innerJoin('tutoring_registrations', 'tutoring_registrations.id', 'tutoring_credits.registration_id')
      .innerJoin('tutoring_programs', 'tutoring_programs.id', 'tutoring_registrations.program_id')
      .innerJoin('children', 'children.id', 'tutoring_credits.child_id')
      .innerJoin('invoices', 'invoices.id', 'tutoring_credits.charged_invoice_id')
      .leftJoin('invoice_adjustments', 'invoice_adjustments.id', 'tutoring_credits.invoice_adjustment_id')
      .select([
        'tutoring_credits.id',
        'tutoring_credits.amount',
        'tutoring_credits.reason',
        'tutoring_credits.mode',
        'tutoring_credits.status',
        'tutoring_credits.closed_note',
        'tutoring_credits.closed_by_name',
        'tutoring_credits.closed_at',
        'tutoring_credits.created_at',
        'tutoring_programs.id as program_id',
        'tutoring_programs.name as program_name',
        'children.id as child_id',
        'children.full_name as child_name',
        'invoices.id as invoice_id',
        'invoices.code as invoice_code',
        'invoices.status as invoice_status',
        'invoices.period_year as invoice_year',
        'invoices.period_month as invoice_month',
        'invoice_adjustments.code as adjustment_code',
        'invoice_adjustments.status as adjustment_status',
      ])
      .orderBy('tutoring_credits.created_at', 'desc')
      .execute();
    const applied = credits.length
      ? await database
          .selectFrom('tutoring_credit_applications')
          .innerJoin('invoice_items', 'invoice_items.id', 'tutoring_credit_applications.invoice_item_id')
          .innerJoin('invoices', 'invoices.id', 'invoice_items.invoice_id')
          .select([
            'tutoring_credit_applications.credit_id',
            'tutoring_credit_applications.amount',
            'invoices.code',
            'invoices.status',
          ])
          .where(
            'tutoring_credit_applications.credit_id',
            'in',
            credits.map((credit) => credit.id),
          )
          .execute()
      : [];
    return credits.map((credit) => {
      const uses = applied.filter((row) => row.credit_id === credit.id);
      const deducted = uses.reduce((sum, row) => sum + Number(row.amount), 0);
      const amount = Number(credit.amount);
      const rejected = credit.status === 'adjusted' && credit.adjustment_status === 'rejected';
      return {
        ...credit,
        amount,
        deducted,
        remaining: credit.status === 'open' || rejected ? amount - deducted : 0,
        deducted_on: uses.map((row) => row.code ?? 'hóa đơn nháp'),
        adjustment_rejected: rejected,
        // Kế toán làm tiếp được: khoản còn mở hoặc điều chỉnh bị từ chối, của hóa đơn đã phát hành
        actionable:
          (credit.status === 'open' || rejected) && credit.invoice_status === 'issued' && amount - deducted > 0,
      };
    });
  }

  private async loadActionableCredit(database: Executor, creditId: string) {
    if (!UUID.test(creditId)) {
      throw notFoundError('Không tìm thấy khoản trừ', 'tutoring_credit');
    }
    const credit = (await this.creditRows(database)).find((row) => row.id === creditId);
    if (!credit) {
      throw notFoundError('Không tìm thấy khoản trừ', 'tutoring_credit');
    }
    if (!credit.actionable) {
      throw new ApplicationError(
        'ERR_CONFLICT',
        'Khoản trừ đã xử lý, đã trừ hết hoặc hóa đơn đã thu buổi này chưa phát hành',
      );
    }
    return credit;
  }

  // Hoàn qua luồng điều chỉnh hóa đơn hiện có: điều chỉnh giảm chờ duyệt trên hóa đơn đã thu buổi (hóa đơn còn nợ đủ số tiền)
  async adjustCredit(currentUser: CurrentUser, creditId: string, origin: ChangeOrigin) {
    const database = await this.database();
    const credit = await this.loadActionableCredit(database, creditId);
    if (credit.deducted > 0) {
      throw new ApplicationError(
        'ERR_CONFLICT',
        'Khoản trừ đã trừ một phần vào kỳ sau; phần còn lại đóng sau khi hoàn',
      );
    }
    const adjustment = await this.discounts.createAdjustment(
      currentUser,
      {
        invoiceId: credit.invoice_id,
        amount: -credit.amount,
        reason: `Gia sư ${credit.program_name}: ${credit.reason}`.slice(0, 500),
      },
      origin,
    );
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('tutoring_credits')
        .set({ status: 'adjusted', mode: 'adjust_invoice', invoice_adjustment_id: adjustment.id })
        .where('id', '=', creditId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'tutoring_credits',
        entityId: creditId,
        action: 'update',
        before: { status: credit.status },
        after: { status: 'adjusted', invoice_adjustment_id: adjustment.id },
      });
    });
    return { id: creditId, status: 'adjusted', adjustment_code: adjustment.code };
  }

  // Chuyển sang trừ vào khoản gia sư kỳ sau
  async deductCreditNext(currentUser: CurrentUser, creditId: string, origin: ChangeOrigin) {
    this.assertCanHandleCredits(currentUser);
    const database = await this.database();
    const credit = await this.loadActionableCredit(database, creditId);
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('tutoring_credits')
        .set({ status: 'open', mode: 'deduct_next', invoice_adjustment_id: null })
        .where('id', '=', creditId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'tutoring_credits',
        entityId: creditId,
        action: 'update',
        before: { status: credit.status, mode: credit.mode },
        after: { status: 'open', mode: 'deduct_next' },
      });
    });
    return { id: creditId, status: 'open', mode: 'deduct_next' };
  }

  // Đóng khoản trừ sau khi kế toán đã hoàn qua phiếu chi hoàn (ghi số phiếu, cách hoàn)
  async closeCredit(currentUser: CurrentUser, creditId: string, note: unknown, origin: ChangeOrigin) {
    this.assertCanHandleCredits(currentUser);
    const text = typeof note === 'string' ? note.trim().slice(0, 500) : '';
    if (text.length < 3) {
      throw validationError([{ field: 'note', message: 'Ghi số phiếu chi hoàn hoặc cách đã hoàn' }]);
    }
    const database = await this.database();
    const credit = await this.loadActionableCredit(database, creditId);
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('tutoring_credits')
        .set({
          status: 'closed',
          invoice_adjustment_id: null,
          closed_note: text,
          closed_by_name: currentUser.description.full_name,
          closed_at: this.clock.now(),
        })
        .where('id', '=', creditId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'tutoring_credits',
        entityId: creditId,
        action: 'update',
        before: { status: credit.status },
        after: { status: 'closed', note: text },
      });
    });
    return { id: creditId, status: 'closed' };
  }

  // ---------- Báo cáo thu, trừ, hoàn, chi thù lao theo chương trình và kỳ

  async report(currentUser: CurrentUser, fromMonth: unknown, toMonth: unknown) {
    if (
      !currentUser.hasPermission(MANAGE) &&
      !currentUser.hasPermission(PERMISSION_CODES.bonusDeductionManage) &&
      !currentUser.hasPermission(PERMISSION_CODES.paymentManage)
    ) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ Ban Giám hiệu, kế toán xem báo cáo thu chi gia sư');
    }
    const database = await this.database();
    const from = parseMonth(fromMonth, 'from');
    const to = parseMonth(toMonth, 'to');
    const fromKey = from.year * 12 + from.month;
    const toKey = to.year * 12 + to.month;
    if (toKey < fromKey || toKey - fromKey > 23) {
      throw validationError([{ field: 'to', message: 'Khoảng tháng từ 1 đến 24 tháng, đến không trước từ' }]);
    }
    const inRange = (year: number, month: number) => {
      const key = year * 12 + month;
      return key >= fromKey && key <= toKey;
    };
    const programs = await database
      .selectFrom('tutoring_programs')
      .select([
        'id',
        'name',
        'content_type',
        'charges_fee',
        'fee_basis',
        'fee_amount',
        'cancel_refund',
        'funding_source',
        'status',
      ])
      .orderBy('name')
      .execute();
    const charges = await database
      .selectFrom('tutoring_charge_sessions')
      .innerJoin('tutoring_registrations', 'tutoring_registrations.id', 'tutoring_charge_sessions.registration_id')
      .innerJoin('invoice_items', 'invoice_items.id', 'tutoring_charge_sessions.invoice_item_id')
      .innerJoin('invoices', 'invoices.id', 'invoice_items.invoice_id')
      .select([
        'tutoring_registrations.program_id',
        'tutoring_charge_sessions.amount',
        'invoices.status',
        'invoices.period_year',
        'invoices.period_month',
      ])
      .execute();
    const applications = await database
      .selectFrom('tutoring_credit_applications')
      .innerJoin('tutoring_credits', 'tutoring_credits.id', 'tutoring_credit_applications.credit_id')
      .innerJoin('tutoring_registrations', 'tutoring_registrations.id', 'tutoring_credits.registration_id')
      .innerJoin('invoice_items', 'invoice_items.id', 'tutoring_credit_applications.invoice_item_id')
      .innerJoin('invoices', 'invoices.id', 'invoice_items.invoice_id')
      .select([
        'tutoring_registrations.program_id',
        'tutoring_credit_applications.amount',
        'invoices.status',
        'invoices.period_year',
        'invoices.period_month',
      ])
      .execute();
    // Khoản trừ tính vào kỳ của hóa đơn đã thu buổi bị hủy
    const credits = (await this.creditRows(database)).filter((credit) =>
      inRange(credit.invoice_year, credit.invoice_month),
    );
    const pay = await database
      .selectFrom('tutoring_teacher_pay')
      .innerJoin('staff_bonus_deductions', 'staff_bonus_deductions.id', 'tutoring_teacher_pay.bonus_deduction_id')
      .select([
        'tutoring_teacher_pay.program_id',
        'tutoring_teacher_pay.teacher_name',
        'tutoring_teacher_pay.amount',
        'tutoring_teacher_pay.periods',
        'tutoring_teacher_pay.funding_source',
        'tutoring_teacher_pay.target_year',
        'tutoring_teacher_pay.target_month',
      ])
      .where('staff_bonus_deductions.status', '=', 'active')
      .execute();
    const pending = await this.pendingPay(database, periodRange(to).to);

    const rows = programs.map((program) => {
      const own = <T extends { program_id: string }>(list: T[]) => list.filter((row) => row.program_id === program.id);
      const sum = (list: { amount: unknown }[]) => list.reduce((total, row) => total + Number(row.amount), 0);
      const programCharges = own(charges).filter((row) => inRange(row.period_year, row.period_month));
      const programApplications = own(applications).filter((row) => inRange(row.period_year, row.period_month));
      const programCredits = own(credits);
      const programPay = own(pay).filter((row) => inRange(row.target_year, row.target_month));
      const billed = sum(programCharges.filter((row) => row.status === 'issued'));
      const deducted = sum(programApplications.filter((row) => row.status === 'issued'));
      const adjusted = sum(
        programCredits.filter((row) => row.status === 'adjusted' && row.adjustment_status !== 'rejected'),
      );
      const refunded = sum(programCredits.filter((row) => row.status === 'closed'));
      return {
        program_id: program.id,
        name: program.name,
        content_type: program.content_type,
        charges_fee: program.charges_fee,
        fee_basis: program.fee_basis,
        fee_amount: program.fee_amount === null ? null : Number(program.fee_amount),
        cancel_refund: program.cancel_refund,
        funding_source: program.funding_source,
        billed,
        billed_draft: sum(programCharges.filter((row) => row.status === 'draft')),
        cancelled_credits: sum(programCredits),
        deducted,
        adjusted,
        refunded,
        credit_open: programCredits.reduce((total, row) => total + row.remaining, 0),
        net_income: billed - deducted - adjusted - refunded,
        teacher_pay: sum(programPay),
        teacher_periods: programPay.reduce((total, row) => total + row.periods, 0),
        teacher_pay_pending: pending
          .filter((row) => row.program_id === program.id && row.problem === null)
          .reduce((total, row) => total + (row.amount ?? 0), 0),
      };
    });
    const active = rows.filter(
      (row) =>
        row.billed + row.billed_draft + row.cancelled_credits + row.teacher_pay + row.teacher_pay_pending > 0 ||
        programs.find((program) => program.id === row.program_id)?.status === 'approved',
    );
    return {
      from: monthOf(from.year, from.month),
      to: monthOf(to.year, to.month),
      programs: active,
      totals: {
        billed: active.reduce((sum, row) => sum + row.billed, 0),
        deducted: active.reduce((sum, row) => sum + row.deducted, 0),
        adjusted: active.reduce((sum, row) => sum + row.adjusted, 0),
        refunded: active.reduce((sum, row) => sum + row.refunded, 0),
        net_income: active.reduce((sum, row) => sum + row.net_income, 0),
        teacher_pay: active.reduce((sum, row) => sum + row.teacher_pay, 0),
        teacher_pay_school_budget: pay
          .filter((row) => inRange(row.target_year, row.target_month) && row.funding_source === 'school_budget')
          .reduce((sum, row) => sum + Number(row.amount), 0),
        teacher_pay_tutoring_fees: pay
          .filter((row) => inRange(row.target_year, row.target_month) && row.funding_source === 'tutoring_fees')
          .reduce((sum, row) => sum + Number(row.amount), 0),
      },
      credits,
    };
  }

  // Tệp Excel của báo cáo: có tên học sinh ở bảng khoản trừ nên ghi nhật ký xuất có dữ liệu cá nhân (BR-74)
  async exportReport(currentUser: CurrentUser, fromMonth: unknown, toMonth: unknown, ipAddress: string | null) {
    const data = await this.report(currentUser, fromMonth, toMonth);
    const database = await this.database();
    const createdAt = this.clock.now();
    const buffer = await buildTableFile(
      'xlsx',
      [
        {
          title: 'Thu chi theo chương trình',
          heading: [`Thu chi gia sư trong trường từ ${data.from} đến ${data.to}`],
          columns: [
            { key: 'name', label: 'Chương trình', width: 36 },
            { key: 'content_label', label: 'Loại nội dung', width: 30 },
            { key: 'fee_label', label: 'Thu phí', width: 26 },
            { key: 'billed', label: 'Đã thu trên hóa đơn (đ)', width: 18 },
            { key: 'deducted', label: 'Đã trừ kỳ sau (đ)', width: 16 },
            { key: 'adjusted', label: 'Điều chỉnh giảm (đ)', width: 16 },
            { key: 'refunded', label: 'Đã hoàn (đ)', width: 14 },
            { key: 'credit_open', label: 'Chờ trừ hoặc hoàn (đ)', width: 18 },
            { key: 'net_income', label: 'Thu thuần (đ)', width: 16 },
            { key: 'teacher_periods', label: 'Số tiết đã chi', width: 12 },
            { key: 'teacher_pay', label: 'Thù lao đã đẩy vào lương (đ)', width: 20 },
            { key: 'teacher_pay_pending', label: 'Thù lao chưa đẩy (đ)', width: 18 },
            { key: 'funding_label', label: 'Nguồn chi thù lao', width: 28 },
          ],
          rows: data.programs.map((row) => ({
            ...row,
            content_label: TUTORING_CONTENT_TYPE_LABELS[row.content_type],
            fee_label:
              row.charges_fee && row.fee_basis && row.fee_amount !== null
                ? `${TUTORING_FEE_BASIS_LABELS[row.fee_basis]}: ${row.fee_amount}`
                : 'Không thu tiền',
            funding_label: TUTORING_FUNDING_SOURCE_LABELS[row.funding_source],
          })),
          numbered: true,
        },
        {
          title: 'Khoản trừ buổi hủy',
          columns: [
            { key: 'program_name', label: 'Chương trình', width: 30 },
            { key: 'child_name', label: 'Học sinh', width: 26 },
            { key: 'reason', label: 'Lý do', width: 36 },
            { key: 'amount', label: 'Số tiền (đ)', width: 14 },
            { key: 'mode_label', label: 'Cách xử lý', width: 30 },
            { key: 'status_label', label: 'Trạng thái', width: 22 },
            { key: 'remaining', label: 'Còn lại (đ)', width: 14 },
            { key: 'invoice_code', label: 'Hóa đơn đã thu', width: 16 },
          ],
          rows: data.credits.map((credit) => ({
            ...credit,
            mode_label: TUTORING_CANCEL_REFUND_LABELS[credit.mode],
            status_label: credit.adjustment_rejected
              ? 'Điều chỉnh bị từ chối'
              : TUTORING_CREDIT_STATUS_LABELS[credit.status],
          })),
          numbered: true,
        },
      ],
      createdAt,
    );
    const fileName = `thu-chi-gia-su-${data.from}-${data.to}.xlsx`;
    const log = await database
      .insertInto('export_logs')
      .values({
        user_id: currentUser.id,
        actor_name: currentUser.description.full_name,
        report_code: 'tutoring_finance',
        filters_data: JSON.stringify({ from: data.from, to: data.to }),
        org_unit_ids: [],
        row_count: data.programs.length + data.credits.length,
        contains_personal_data: data.credits.length > 0,
        file_name: fileName,
        ip_address: ipAddress,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return { buffer, contentType: CONTENT_TYPES.xlsx, fileName, logId: log.id };
  }
}
