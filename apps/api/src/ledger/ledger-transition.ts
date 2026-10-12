import type { SchoolYearDatabase } from '@school-management/database';
import { sql, type Kysely } from 'kysely';
import type { AcademicYearTransitionStep } from '../academic-years/academic-year-transition.js';
import { insertJournalEntry, postPendingDocuments, type PostingLine } from './ledger-posting.js';

// Mở năm học mới (G3-06, BR-93; YCTD-88): ghi sổ nốt chứng từ của năm cũ, chuyển hệ thống tài khoản (giữ mã) và quy tắc ghi
// sổ của năm cũ thay cho bộ mặc định của năm mới, rồi mỗi đơn vị có một bút toán số dư đầu năm ngày bắt đầu năm học bằng số
// dư cuối năm cũ theo tài khoản. Số dư các tài khoản doanh thu, chi phí, xác định kết quả (loại 5 đến 9) kết chuyển vào 421
// "Thặng dư (thâm hụt) lũy kế" trong bút toán này thay cho bút toán kết chuyển cuối năm. Bút toán, sổ của năm cũ tra ở năm
// cũ. Chạy sau bước tài chính (cần khoản mục thu chi, đơn vị đã chuyển)
export const ledgerTransitionStep: AcademicYearTransitionStep = {
  name: 'ledger',
  async carryOver(context) {
    if (!context.previousDatabase) {
      return;
    }
    const previous = context.previousDatabase as Kysely<SchoolYearDatabase>;
    const next = context.newDatabase as Kysely<SchoolYearDatabase>;
    await previous.transaction().execute((transaction) => postPendingDocuments(transaction));

    const accounts = await previous.selectFrom('ledger_accounts').selectAll().execute();
    const rules = await previous.selectFrom('ledger_posting_rules').selectAll().execute();
    const balances = await previous
      .selectFrom('journal_lines')
      .innerJoin('journal_entries', 'journal_entries.id', 'journal_lines.entry_id')
      .select([
        'journal_entries.org_unit_id',
        'journal_lines.account_id',
        sql<string>`sum(journal_lines.debit - journal_lines.credit)`.as('net'),
      ])
      .where('journal_entries.status', '=', 'posted')
      .groupBy(['journal_entries.org_unit_id', 'journal_lines.account_id'])
      .execute();

    await next.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('ledger_posting_rules').execute();
      await transaction.deleteFrom('ledger_accounts').execute();
      // Tài khoản cha có số hiệu ngắn hơn tài khoản chi tiết nên chèn theo độ dài số hiệu
      for (const account of [...accounts].sort(
        (left, right) => left.code.length - right.code.length || left.code.localeCompare(right.code),
      )) {
        await transaction.insertInto('ledger_accounts').values(account).execute();
      }
      for (const rule of rules) {
        await transaction.insertInto('ledger_posting_rules').values(rule).execute();
      }
      const units = new Set((await transaction.selectFrom('org_units').select('id').execute()).map((row) => row.id));
      const byId = new Map(accounts.map((account) => [account.id, account]));
      const surplus = accounts.find((account) => account.code === '421');
      const perUnit = new Map<string, Map<string, number>>();
      for (const row of balances) {
        const account = byId.get(row.account_id);
        const net = Number(row.net);
        if (!account || net === 0 || !units.has(row.org_unit_id)) {
          continue;
        }
        const target = surplus && /^[5-9]/.test(account.code) ? surplus.id : account.id;
        const unit = perUnit.get(row.org_unit_id) ?? new Map<string, number>();
        unit.set(target, (unit.get(target) ?? 0) + net);
        perUnit.set(row.org_unit_id, unit);
      }
      for (const [orgUnitId, nets] of perUnit) {
        const lines: PostingLine[] = [...nets.entries()]
          .filter(([, net]) => net !== 0)
          .sort(([left], [right]) => (byId.get(left)?.code ?? '').localeCompare(byId.get(right)?.code ?? ''))
          .map(([accountId, net]) => ({
            accountId,
            debit: net > 0 ? net : 0,
            credit: net < 0 ? -net : 0,
            description: 'Số dư cuối năm học trước',
          }));
        await insertJournalEntry(transaction, {
          orgUnitId,
          entryDate: context.academicYear.startDate,
          description: 'Số dư đầu năm học chuyển từ năm học trước',
          entryType: 'opening',
          sourceType: 'opening',
          sourceId: orgUnitId,
          sourceCode: null,
          lines,
          createdBy: context.actorUserId,
        });
      }
    });
  },
};
