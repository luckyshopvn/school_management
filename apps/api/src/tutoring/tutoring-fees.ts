import type { SchoolYearDatabase } from '@school-management/database';
import {
  applyTutoringCredits,
  perProgramSessionShare,
  TUTORING_INVOICE_PREFIX,
  tutoringChargeAmount,
  type TutoringFeeBasis,
} from '@school-management/shared';
import type { Kysely, Transaction } from 'kysely';
import type { DraftItem } from '../fees/fee-calculation.service.js';
import { periodRange, type Period } from '../fees/registration-periods.js';

// Khoản thu của chương trình gia sư bổ trợ có thu trong lần tính học phí của kỳ (DT-27 phần 27c, YCTD-253; tài liệu 47 mục 19.5).
// Chương trình `curriculum` không bao giờ có dòng thu (ràng buộc của bảng và hàm thuần). Theo buổi: thu các buổi chưa hủy từ ngày đơn
// được duyệt đến hết kỳ (cả buổi của kỳ trước chưa thu), đơn đã rút thì chỉ đến ngày rút; trọn gói: thu một lần ở kỳ đầu tiên tính
// sau khi đơn được duyệt. Khoản trừ của buổi bị hủy sau khi đã thu (chế độ trừ kỳ sau) trừ vào các dòng gia sư của học sinh trong kỳ,
// không để dòng âm. Hóa đơn chính còn nháp của kỳ được tính lại nên dòng, buổi đã thu và phần trừ của nó không tính là đã thu.
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

export interface TutoringPlan {
  registrationId: string;
  charges: { sessionId: string | null; amount: number; sessionsTotal: number | null }[];
  credits: { id: string; amount: number }[];
}

const dateText = (value: unknown) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
const vietnamDate = (value: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(value);
const shortDate = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;
const money = (amount: number) => `${amount.toLocaleString('vi-VN')} đ`;

// Hóa đơn chính còn nháp của kỳ: lần tính này lập lại nên phần đã ghi của nó không tính
async function recomputableInvoiceIds(database: Executor, childIds: string[], period: Period): Promise<string[]> {
  const rows = await database
    .selectFrom('invoices')
    .select('id')
    .where('child_id', 'in', childIds)
    .where('period_year', '=', period.year)
    .where('period_month', '=', period.month)
    .where('invoice_kind', '=', 'main')
    .where('status', '=', 'draft')
    .execute();
  return rows.map((row) => row.id);
}

// Khoản trừ còn lại của các học sinh: khoản trừ kỳ sau đang mở, trừ phần đã trừ vào hóa đơn khác (bỏ phần trừ ở các hóa đơn
// đang tính lại)
export async function remainingCredits(
  database: Executor,
  childIds: string[],
  excludeInvoiceIds: string[],
): Promise<Map<string, { id: string; remaining: number }[]>> {
  const result = new Map<string, { id: string; remaining: number }[]>();
  if (childIds.length === 0) {
    return result;
  }
  // Chỉ khoản trừ của buổi thu ở hóa đơn đã phát hành; hóa đơn còn nháp thì lần tính lại tự bỏ buổi đã hủy
  const credits = await database
    .selectFrom('tutoring_credits')
    .innerJoin('invoices', 'invoices.id', 'tutoring_credits.charged_invoice_id')
    .select(['tutoring_credits.id', 'tutoring_credits.child_id', 'tutoring_credits.amount'])
    .where('tutoring_credits.child_id', 'in', childIds)
    .where('tutoring_credits.status', '=', 'open')
    .where('tutoring_credits.mode', '=', 'deduct_next')
    .where('invoices.status', '=', 'issued')
    .orderBy('tutoring_credits.created_at')
    .execute();
  if (credits.length === 0) {
    return result;
  }
  let applied = database
    .selectFrom('tutoring_credit_applications')
    .innerJoin('invoice_items', 'invoice_items.id', 'tutoring_credit_applications.invoice_item_id')
    .select(['tutoring_credit_applications.credit_id', 'tutoring_credit_applications.amount'])
    .where(
      'tutoring_credit_applications.credit_id',
      'in',
      credits.map((credit) => credit.id),
    );
  if (excludeInvoiceIds.length > 0) {
    applied = applied.where('invoice_items.invoice_id', 'not in', excludeInvoiceIds);
  }
  const used = new Map<string, number>();
  for (const row of await applied.execute()) {
    used.set(row.credit_id, (used.get(row.credit_id) ?? 0) + Number(row.amount));
  }
  for (const credit of credits) {
    const remaining = Number(credit.amount) - (used.get(credit.id) ?? 0);
    if (remaining > 0) {
      const list = result.get(credit.child_id) ?? [];
      list.push({ id: credit.id, remaining });
      result.set(credit.child_id, list);
    }
  }
  return result;
}

// Dòng gia sư của các học sinh trong kỳ và kế hoạch ghi buổi đã thu, phần trừ (ghi sau khi chèn dòng, xem recordTutoringCharges)
export async function tutoringItems(
  database: Executor,
  childIds: string[],
  period: Period,
): Promise<{ items: Map<string, DraftItem[]>; plans: Map<string, TutoringPlan[]> }> {
  const items = new Map<string, DraftItem[]>();
  const plans = new Map<string, TutoringPlan[]>();
  if (childIds.length === 0) {
    return { items, plans };
  }
  const { to } = periodRange(period);
  const registrations = await database
    .selectFrom('tutoring_registrations')
    .innerJoin('tutoring_programs', 'tutoring_programs.id', 'tutoring_registrations.program_id')
    .select([
      'tutoring_registrations.id',
      'tutoring_registrations.child_id',
      'tutoring_registrations.status',
      'tutoring_registrations.decided_at',
      'tutoring_registrations.withdrawn_at',
      'tutoring_programs.id as program_id',
      'tutoring_programs.name as program_name',
      'tutoring_programs.fee_basis',
      'tutoring_programs.fee_amount',
      'tutoring_programs.starts_on',
    ])
    .where('tutoring_registrations.child_id', 'in', childIds)
    .where('tutoring_registrations.status', 'in', ['approved', 'withdrawn'])
    .where('tutoring_registrations.decided_at', 'is not', null)
    .where('tutoring_programs.content_type', '=', 'enrichment')
    .where('tutoring_programs.charges_fee', '=', true)
    .where('tutoring_programs.fee_amount', 'is not', null)
    .where('tutoring_programs.status', 'in', ['approved', 'closed'])
    .orderBy('tutoring_programs.name')
    .execute();
  const recomputable = await recomputableInvoiceIds(database, childIds, period);
  const credits = await remainingCredits(database, childIds, recomputable);
  if (registrations.length === 0 && credits.size === 0) {
    return { items, plans };
  }
  const registrationIds = registrations.map((row) => row.id);
  let chargedQuery = database
    .selectFrom('tutoring_charge_sessions')
    .innerJoin('invoice_items', 'invoice_items.id', 'tutoring_charge_sessions.invoice_item_id')
    .select(['tutoring_charge_sessions.registration_id', 'tutoring_charge_sessions.session_id'])
    .where('tutoring_charge_sessions.registration_id', 'in', registrationIds.length > 0 ? registrationIds : ['']);
  if (recomputable.length > 0) {
    chargedQuery = chargedQuery.where('invoice_items.invoice_id', 'not in', recomputable);
  }
  const charged = await chargedQuery.execute();
  const chargedSessions = new Set(charged.map((row) => `${row.registration_id}:${row.session_id ?? ''}`));
  const programIds = [...new Set(registrations.map((row) => row.program_id))];
  const sessions =
    programIds.length > 0
      ? await database
          .selectFrom('tutoring_sessions')
          .select(['id', 'program_id', 'session_date'])
          .where('program_id', 'in', programIds)
          .where('status', '=', 'scheduled')
          .orderBy('session_date')
          .orderBy('start_time')
          .execute()
      : [];

  for (const registration of registrations) {
    const basis = registration.fee_basis as TutoringFeeBasis;
    const fee = Number(registration.fee_amount);
    const approvedOn = vietnamDate(registration.decided_at as Date);
    const withdrawnOn = registration.withdrawn_at ? vietnamDate(registration.withdrawn_at) : null;
    const programSessions = sessions
      .map((session) => ({ ...session, session_date: dateText(session.session_date) }))
      .filter((session) => session.program_id === registration.program_id);
    let plan: TutoringPlan;
    let item: DraftItem;
    if (basis === 'per_session') {
      const due = programSessions.filter(
        (session) =>
          session.session_date >= approvedOn &&
          session.session_date <= to &&
          (withdrawnOn === null || session.session_date < withdrawnOn) &&
          !chargedSessions.has(`${registration.id}:${session.id}`),
      );
      if (due.length === 0) {
        continue;
      }
      const gross = tutoringChargeAmount('per_session', fee, due.length);
      plan = {
        registrationId: registration.id,
        charges: due.map((session) => ({ sessionId: session.id, amount: fee, sessionsTotal: null })),
        credits: [],
      };
      item = {
        item_type: 'tutoring',
        service_id: null,
        service_registration_id: null,
        tutoring_registration_id: registration.id,
        description: `${TUTORING_INVOICE_PREFIX}: ${registration.program_name}`,
        quantity: due.length,
        unit_price: fee,
        amount: gross,
        basis_note: `${due.length} buổi: ${due.map((session) => shortDate(session.session_date)).join(', ')}`,
      };
    } else {
      // Trọn gói thu một lần, khi chương trình đã bắt đầu trong hoặc trước kỳ và đơn còn hiệu lực
      if (
        registration.status !== 'approved' ||
        dateText(registration.starts_on) > to ||
        chargedSessions.has(`${registration.id}:`) ||
        programSessions.length === 0
      ) {
        continue;
      }
      plan = {
        registrationId: registration.id,
        charges: [{ sessionId: null, amount: fee, sessionsTotal: programSessions.length }],
        credits: [],
      };
      item = {
        item_type: 'tutoring',
        service_id: null,
        service_registration_id: null,
        tutoring_registration_id: registration.id,
        description: `${TUTORING_INVOICE_PREFIX}: ${registration.program_name}`,
        quantity: 1,
        unit_price: fee,
        amount: fee,
        basis_note: `Trọn gói ${programSessions.length} buổi`,
      };
    }
    const childItems = items.get(registration.child_id) ?? [];
    childItems.push(item);
    items.set(registration.child_id, childItems);
    const childPlans = plans.get(registration.child_id) ?? [];
    childPlans.push(plan);
    plans.set(registration.child_id, childPlans);
  }

  // Trừ khoản trừ của buổi bị hủy vào các dòng gia sư của học sinh trong kỳ; không có dòng thì để kỳ sau hoặc kế toán hoàn
  for (const [childId, childItems] of items) {
    const childCredits = credits.get(childId);
    if (!childCredits || childCredits.length === 0) {
      continue;
    }
    const childPlans = plans.get(childId) ?? [];
    childItems.forEach((item, index) => {
      const { net, applied } = applyTutoringCredits(item.amount, childCredits);
      if (applied.length === 0) {
        return;
      }
      for (const entry of applied) {
        const credit = childCredits.find((candidate) => candidate.id === entry.id);
        if (credit) {
          credit.remaining -= entry.amount;
        }
      }
      const deducted = item.amount - net;
      item.amount = net;
      item.basis_note = `${item.basis_note}; trừ ${money(deducted)} buổi bị hủy đã thu`;
      const plan = childPlans[index];
      if (plan) {
        plan.credits = applied;
      }
    });
  }
  return { items, plans };
}

// Ghi buổi đã thu và phần trừ cho các dòng gia sư vừa chèn của hóa đơn (gọi trong giao dịch của lần tính, sau khi chèn dòng)
export async function recordTutoringCharges(
  transaction: Transaction<SchoolYearDatabase>,
  invoiceId: string,
  plans: TutoringPlan[],
): Promise<void> {
  if (plans.length === 0) {
    return;
  }
  const rows = await transaction
    .selectFrom('invoice_items')
    .select(['id', 'tutoring_registration_id'])
    .where('invoice_id', '=', invoiceId)
    .where('item_type', '=', 'tutoring')
    .execute();
  const itemOf = new Map(rows.map((row) => [row.tutoring_registration_id, row.id]));
  for (const plan of plans) {
    const itemId = itemOf.get(plan.registrationId);
    if (!itemId) {
      continue;
    }
    if (plan.charges.length > 0) {
      await transaction
        .insertInto('tutoring_charge_sessions')
        .values(
          plan.charges.map((charge) => ({
            invoice_item_id: itemId,
            registration_id: plan.registrationId,
            session_id: charge.sessionId,
            amount: charge.amount,
            sessions_total: charge.sessionsTotal,
          })),
        )
        .execute();
    }
    if (plan.credits.length > 0) {
      await transaction
        .insertInto('tutoring_credit_applications')
        .values(
          plan.credits.map((credit) => ({ credit_id: credit.id, invoice_item_id: itemId, amount: credit.amount })),
        )
        .execute();
    }
  }
}

// Tính lại hóa đơn nháp: khoản trừ lập từ buổi thu ở chính hóa đơn này không còn giá trị (buổi đã hủy không thu lại), xóa trước khi
// chèn dòng mới
export async function dropCreditsOfRecomputedInvoice(
  transaction: Transaction<SchoolYearDatabase>,
  invoiceId: string,
): Promise<void> {
  await transaction
    .deleteFrom('tutoring_credits')
    .where('charged_invoice_id', '=', invoiceId)
    .where('status', '=', 'open')
    .execute();
}

// Buổi bị hủy sau khi đã thu: lập khoản trừ cho từng đơn đã thu buổi đó (theo buổi: đúng số đã thu; trọn gói: chia đều theo số buổi
// lúc thu). Trả số khoản trừ đã lập
export async function creditCancelledSession(
  transaction: Transaction<SchoolYearDatabase>,
  input: { sessionId: string; programId: string; reason: string; actorName: string },
): Promise<number> {
  const program = await transaction
    .selectFrom('tutoring_programs')
    .select(['cancel_refund', 'fee_basis'])
    .where('id', '=', input.programId)
    .executeTakeFirstOrThrow();
  if (!program.fee_basis) {
    return 0;
  }
  const charges = await transaction
    .selectFrom('tutoring_charge_sessions')
    .innerJoin('tutoring_registrations', 'tutoring_registrations.id', 'tutoring_charge_sessions.registration_id')
    .innerJoin('invoice_items', 'invoice_items.id', 'tutoring_charge_sessions.invoice_item_id')
    .select([
      'tutoring_charge_sessions.registration_id',
      'tutoring_charge_sessions.session_id',
      'tutoring_charge_sessions.amount',
      'tutoring_charge_sessions.sessions_total',
      'tutoring_registrations.child_id',
      'invoice_items.invoice_id',
    ])
    .where('tutoring_registrations.program_id', '=', input.programId)
    .where((expression) =>
      expression.or([
        expression('tutoring_charge_sessions.session_id', '=', input.sessionId),
        expression('tutoring_charge_sessions.session_id', 'is', null),
      ]),
    )
    .execute();
  const values = charges
    .map((charge) => ({
      child_id: charge.child_id,
      registration_id: charge.registration_id,
      session_id: input.sessionId,
      charged_invoice_id: charge.invoice_id,
      amount:
        charge.session_id === null
          ? perProgramSessionShare(Number(charge.amount), charge.sessions_total ?? 1)
          : Number(charge.amount),
      reason: input.reason,
      mode: program.cancel_refund,
      created_by_name: input.actorName,
    }))
    .filter((value) => value.amount > 0);
  if (values.length === 0) {
    return 0;
  }
  await transaction
    .insertInto('tutoring_credits')
    .values(values)
    .onConflict((conflict) => conflict.columns(['registration_id', 'session_id']).doNothing())
    .execute();
  return values.length;
}
