import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely, Transaction } from 'kysely';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { queueNotification } from '../common/notification-queue.js';
import { nextDocumentCode } from '../fees/document-codes.js';
import type { DraftItem } from '../fees/fee-calculation.service.js';
import { recalculatePendingDiscounts } from '../fees/invoice-amounts.js';
import { formatPeriod, periodRange, type Period } from '../fees/registration-periods.js';
import { guardianUserIds } from '../finance/receivables.js';

// Phí hoạt động ngoại khóa vào khoản phải thu (P14-11; BR-19, BR-85; YCTD-78). Phí theo tháng thu đủ mỗi kỳ mà đăng ký còn
// hiệu lực ít nhất một ngày, không giảm trừ khi trẻ nghỉ buổi hay thôi giữa tháng; phí theo hoạt động thu một lần ở kỳ của
// ngày bắt đầu đăng ký. Khoản phát sinh khi hóa đơn chính của kỳ đã phát hành lập thành hóa đơn bổ sung; hóa đơn chính còn
// nháp thì thêm dòng vào nháp; chưa tính thì lần tính học phí của kỳ lấy vào
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

export const MONTHLY_BASIS = 'Thu theo tháng, không giảm trừ khi nghỉ buổi hoặc thôi giữa tháng';
export const ONCE_BASIS = 'Thu một lần theo hoạt động';

export function periodOf(date: string): Period {
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) };
}

// Dòng ngoại khóa của các trẻ trong kỳ, bỏ đăng ký đã lập khoản thu ở hóa đơn khác (hóa đơn bổ sung của kỳ, hoặc phí một
// lần đã thu ở bất kỳ kỳ nào)
export async function extracurricularItems(
  database: Executor,
  childIds: string[],
  period: Period,
): Promise<Map<string, DraftItem[]>> {
  const result = new Map<string, DraftItem[]>();
  if (childIds.length === 0) {
    return result;
  }
  const { from, to } = periodRange(period);
  const rows = await database
    .selectFrom('extracurricular_registrations')
    .innerJoin(
      'extracurricular_activities',
      'extracurricular_activities.id',
      'extracurricular_registrations.activity_id',
    )
    .select([
      'extracurricular_registrations.id',
      'extracurricular_registrations.child_id',
      'extracurricular_activities.name',
      'extracurricular_activities.fee_type',
      'extracurricular_activities.fee_amount',
    ])
    .where('extracurricular_registrations.child_id', 'in', childIds)
    .where('extracurricular_activities.fee_type', '<>', 'free')
    .where((expression) =>
      expression.or([
        expression.and([
          expression('extracurricular_activities.fee_type', '=', 'monthly'),
          expression('extracurricular_registrations.effective_from', '<=', to),
          expression.or([
            expression('extracurricular_registrations.effective_to', 'is', null),
            expression('extracurricular_registrations.effective_to', '>=', from),
          ]),
        ]),
        expression.and([
          expression('extracurricular_activities.fee_type', '=', 'per_activity'),
          expression('extracurricular_registrations.effective_from', '>=', from),
          expression('extracurricular_registrations.effective_from', '<=', to),
        ]),
      ]),
    )
    .orderBy('extracurricular_activities.name')
    .execute();
  if (rows.length === 0) {
    return result;
  }
  const invoiced = await database
    .selectFrom('invoice_items')
    .innerJoin('invoices', 'invoices.id', 'invoice_items.invoice_id')
    .select([
      'invoice_items.extracurricular_registration_id',
      'invoices.period_year',
      'invoices.period_month',
      'invoices.invoice_kind',
    ])
    .where(
      'invoice_items.extracurricular_registration_id',
      'in',
      rows.map((row) => row.id),
    )
    .execute();
  for (const row of rows) {
    const charged = invoiced.some(
      (item) =>
        item.extracurricular_registration_id === row.id &&
        (row.fee_type === 'per_activity'
          ? item.invoice_kind !== 'main' || item.period_year !== period.year || item.period_month !== period.month
          : item.invoice_kind === 'supplementary' &&
            item.period_year === period.year &&
            item.period_month === period.month),
    );
    if (charged) {
      continue;
    }
    const amount = Number(row.fee_amount);
    const items = result.get(row.child_id) ?? [];
    items.push(itemOf(row.id, row.name, row.fee_type === 'monthly', amount));
    result.set(row.child_id, items);
  }
  return result;
}

function itemOf(registrationId: string, name: string, monthly: boolean, amount: number): DraftItem {
  return {
    item_type: 'extracurricular',
    service_id: null,
    service_registration_id: null,
    extracurricular_registration_id: registrationId,
    description: `Ngoại khóa: ${name}`,
    quantity: 1,
    unit_price: amount,
    amount,
    basis_note: monthly ? MONTHLY_BASIS : ONCE_BASIS,
  };
}

// Lập khoản thu ngay khi đăng ký cho kỳ của ngày bắt đầu: hóa đơn chính đã phát hành thì lập hóa đơn bổ sung (BR-85);
// còn nháp thì thêm dòng vào nháp. Trả hóa đơn đã lập hoặc đã sửa, hoặc null khi chờ lần tính học phí của kỳ
export async function chargeRegistration(
  transaction: Transaction<SchoolYearDatabase>,
  input: {
    registrationId: string;
    childId: string;
    childName: string;
    orgUnitId: string;
    activityName: string;
    monthly: boolean;
    amount: number;
    effectiveFrom: string;
    today: string;
    now: Date;
  },
  origin: ChangeOrigin,
): Promise<{ invoice_id: string; invoice_kind: 'main' | 'supplementary' } | null> {
  const period = periodOf(input.effectiveFrom);
  const main = await transaction
    .selectFrom('invoices')
    .select(['id', 'status', 'due_date', 'total_amount', 'basis'])
    .where('child_id', '=', input.childId)
    .where('period_year', '=', period.year)
    .where('period_month', '=', period.month)
    .where('invoice_kind', '=', 'main')
    .forUpdate()
    .executeTakeFirst();
  if (!main) {
    return null;
  }
  const item = itemOf(input.registrationId, input.activityName, input.monthly, input.amount);
  if (main.status === 'draft') {
    await transaction
      .insertInto('invoice_items')
      .values({ ...item, invoice_id: main.id })
      .execute();
    await transaction
      .updateTable('invoices')
      .set({ total_amount: Number(main.total_amount) + input.amount, updated_at: input.now })
      .where('id', '=', main.id)
      .execute();
    await recalculatePendingDiscounts(transaction, main.id);
    return { invoice_id: main.id, invoice_kind: 'main' };
  }
  const dueDate = main.due_date && main.due_date > input.today ? main.due_date : input.today;
  const invoice = await transaction
    .insertInto('invoices')
    .values({
      code: await nextDocumentCode(transaction, 'invoice', 'HD'),
      child_id: input.childId,
      org_unit_id: input.orgUnitId,
      period_year: period.year,
      period_month: period.month,
      invoice_kind: 'supplementary',
      status: 'issued',
      total_amount: input.amount,
      basis: JSON.stringify({ ...(main.basis as object), source: 'extracurricular' }),
      review_flags: JSON.stringify([]),
      due_date: dueDate,
      issued_at: input.now,
      issued_by: origin.actorUserId,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await transaction
    .insertInto('invoice_items')
    .values({ ...item, invoice_id: invoice.id })
    .execute();
  await writeAuditLog(transaction, {
    origin,
    orgUnitId: input.orgUnitId,
    entityName: 'invoices',
    entityId: invoice.id,
    action: 'create',
    before: null,
    after: { invoice_kind: 'supplementary', period: formatPeriod(period), total: input.amount, items: [item] },
  });
  const guardians = await guardianUserIds(transaction, input.childId);
  await queueNotification(transaction, {
    orgUnitId: input.orgUnitId,
    templateCode: 'supplementary_invoice_issued',
    title: 'Có hóa đơn bổ sung',
    body: `Phí ngoại khóa ${input.activityName} kỳ ${formatPeriod(period)} của ${input.childName}: ${input.amount} đồng, hạn nộp ${dueDate}`,
    targetType: 'invoices',
    targetId: invoice.id,
    recipients: [
      ...guardians.map((userId) => ({ userId, channel: 'in_app' as const })),
      { roleCode: 'VT-04', orgUnitId: input.orgUnitId, channel: 'in_app' as const },
    ],
  });
  return { invoice_id: invoice.id, invoice_kind: 'supplementary' };
}
