import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { sql, type Kysely } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { notFoundError } from '../common/request-fields.js';
import { LedgerAccess } from './ledger-common.js';
import { LedgerPostingService } from './ledger-posting.js';

// Sổ nhật ký chung, sổ cái theo tài khoản, bảng cân đối số phát sinh (G3-06, N5; BR-36; YCTD-88) của một đơn vị hoặc mọi
// đơn vị trong phạm vi, trong khoảng ngày. Trước khi tổng hợp thì ghi sổ chứng từ chưa ghi để sổ khớp chứng từ. Bút toán
// đã hủy không tính. Số dư tài khoản tính theo Nợ trừ Có: dương hiện ở cột Nợ, âm hiện ở cột Có; tài khoản tổng hợp cộng
// cả tài khoản chi tiết
export interface LedgerFilter {
  orgUnitId: string | null;
  from: string;
  to: string;
}

interface AccountRow {
  id: string;
  code: string;
  name: string;
  parent_id: string | null;
}

const split = (net: number) => ({ debit: net > 0 ? net : 0, credit: net < 0 ? -net : 0 });

@Injectable()
export class LedgerReportsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: LedgerAccess,
    private readonly posting: LedgerPostingService,
  ) {}

  private async prepare(currentUser: CurrentUser, orgUnitId: string | null) {
    const { database } = await this.currentSchoolYear.require();
    const units = await this.access.viewUnits(currentUser, database, orgUnitId);
    await this.posting.postPending();
    return { database, units };
  }

  // Sổ nhật ký chung: bút toán theo ngày, số bút toán, kèm các dòng Nợ / Có
  async journal(currentUser: CurrentUser, filter: LedgerFilter) {
    const { database, units } = await this.prepare(currentUser, filter.orgUnitId);
    const entries = await database
      .selectFrom('journal_entries')
      .innerJoin('org_units', 'org_units.id', 'journal_entries.org_unit_id')
      .select([
        'journal_entries.id',
        'journal_entries.code',
        'journal_entries.org_unit_id',
        'org_units.name as org_unit_name',
        'journal_entries.entry_date',
        'journal_entries.description',
        'journal_entries.entry_type',
        'journal_entries.source_type',
        'journal_entries.source_id',
        'journal_entries.source_code',
        'journal_entries.total_amount',
        'journal_entries.status',
        'journal_entries.created_by',
        'journal_entries.void_reason',
      ])
      .where('journal_entries.org_unit_id', 'in', units)
      .where('journal_entries.entry_date', '>=', filter.from)
      .where('journal_entries.entry_date', '<=', filter.to)
      .orderBy('journal_entries.entry_date')
      .orderBy('journal_entries.code')
      .execute();
    const lines =
      entries.length === 0
        ? []
        : await database
            .selectFrom('journal_lines')
            .innerJoin('ledger_accounts', 'ledger_accounts.id', 'journal_lines.account_id')
            .select([
              'journal_lines.entry_id',
              'journal_lines.line_no',
              'journal_lines.account_id',
              'ledger_accounts.code as account_code',
              'ledger_accounts.name as account_name',
              'journal_lines.debit',
              'journal_lines.credit',
              'journal_lines.description',
            ])
            .where(
              'journal_lines.entry_id',
              'in',
              entries.map((entry) => entry.id),
            )
            .orderBy('journal_lines.line_no')
            .execute();
    const byEntry = new Map<string, typeof lines>();
    for (const line of lines) {
      byEntry.set(line.entry_id, [...(byEntry.get(line.entry_id) ?? []), line]);
    }
    const result = entries.map((entry) => ({
      ...entry,
      total_amount: Number(entry.total_amount),
      lines: (byEntry.get(entry.id) ?? []).map((line) => ({
        line_no: line.line_no,
        account_id: line.account_id,
        account_code: line.account_code,
        account_name: line.account_name,
        debit: Number(line.debit),
        credit: Number(line.credit),
        description: line.description,
      })),
    }));
    const posted = result.filter((entry) => entry.status === 'posted');
    return {
      entries: result,
      // Dòng phẳng để xuất Excel
      lines: posted.flatMap((entry) =>
        entry.lines.map((line) => ({
          entry_date: entry.entry_date,
          code: entry.code,
          org_unit_name: entry.org_unit_name,
          description: entry.description,
          source_code: entry.source_code ?? '',
          account_code: line.account_code,
          account_name: line.account_name,
          debit: line.debit,
          credit: line.credit,
        })),
      ),
      totals: {
        entry_count: posted.length,
        debit: posted.reduce((total, entry) => total + entry.total_amount, 0),
        credit: posted.reduce((total, entry) => total + entry.lines.reduce((sum, line) => sum + line.credit, 0), 0),
      },
    };
  }

  // Số liệu theo tài khoản: số dư trước khoảng ngày, phát sinh Nợ, Có trong khoảng
  private async movements(database: Kysely<SchoolYearDatabase>, units: string[], filter: LedgerFilter) {
    return database
      .selectFrom('journal_lines')
      .innerJoin('journal_entries', 'journal_entries.id', 'journal_lines.entry_id')
      .select([
        'journal_lines.account_id',
        sql<string>`coalesce(sum(case when journal_entries.entry_date < ${filter.from}::date
          then journal_lines.debit - journal_lines.credit else 0 end), 0)`.as('opening'),
        sql<string>`coalesce(sum(case when journal_entries.entry_date >= ${filter.from}::date
          then journal_lines.debit else 0 end), 0)`.as('period_debit'),
        sql<string>`coalesce(sum(case when journal_entries.entry_date >= ${filter.from}::date
          then journal_lines.credit else 0 end), 0)`.as('period_credit'),
      ])
      .where('journal_entries.status', '=', 'posted')
      .where('journal_entries.org_unit_id', 'in', units)
      .where('journal_entries.entry_date', '<=', filter.to)
      .groupBy('journal_lines.account_id')
      .execute();
  }

  // Bảng cân đối số phát sinh: mỗi tài khoản có số liệu một dòng, tài khoản tổng hợp cộng tài khoản chi tiết; dòng tổng
  // cộng các tài khoản cấp 1, tổng Nợ bằng tổng Có ở cả ba cột khi sổ cân
  async trialBalance(currentUser: CurrentUser, filter: LedgerFilter) {
    const { database, units } = await this.prepare(currentUser, filter.orgUnitId);
    const accounts: AccountRow[] = await database
      .selectFrom('ledger_accounts')
      .select(['id', 'code', 'name', 'parent_id'])
      .orderBy('code')
      .execute();
    const byId = new Map(accounts.map((account) => [account.id, account]));
    const totals = new Map<string, { opening: number; debit: number; credit: number }>();
    for (const row of await this.movements(database, units, filter)) {
      let current = byId.get(row.account_id);
      while (current) {
        const value = totals.get(current.id) ?? { opening: 0, debit: 0, credit: 0 };
        value.opening += Number(row.opening);
        value.debit += Number(row.period_debit);
        value.credit += Number(row.period_credit);
        totals.set(current.id, value);
        current = current.parent_id ? byId.get(current.parent_id) : undefined;
      }
    }
    const level = (account: AccountRow): number => {
      const parent = account.parent_id ? byId.get(account.parent_id) : undefined;
      return parent ? level(parent) + 1 : 1;
    };
    const rows = accounts
      .filter((account) => {
        const value = totals.get(account.id);
        return value && (value.opening !== 0 || value.debit !== 0 || value.credit !== 0);
      })
      .map((account) => {
        const value = totals.get(account.id) ?? { opening: 0, debit: 0, credit: 0 };
        const opening = split(value.opening);
        const closing = split(value.opening + value.debit - value.credit);
        return {
          account_id: account.id,
          account_code: account.code,
          account_name: account.name,
          level: level(account),
          opening_debit: opening.debit,
          opening_credit: opening.credit,
          period_debit: value.debit,
          period_credit: value.credit,
          closing_debit: closing.debit,
          closing_credit: closing.credit,
        };
      });
    const top = rows.filter((row) => row.level === 1);
    const sum = (key: keyof (typeof rows)[number]) => top.reduce((total, row) => total + Number(row[key]), 0);
    const summary = {
      opening_debit: sum('opening_debit'),
      opening_credit: sum('opening_credit'),
      period_debit: sum('period_debit'),
      period_credit: sum('period_credit'),
      closing_debit: sum('closing_debit'),
      closing_credit: sum('closing_credit'),
    };
    return {
      accounts: rows,
      totals: summary,
      balanced:
        summary.opening_debit === summary.opening_credit &&
        summary.period_debit === summary.period_credit &&
        summary.closing_debit === summary.closing_credit,
    };
  }

  // Sổ cái của một tài khoản (gồm tài khoản chi tiết): số dư đầu, từng dòng kèm tài khoản đối ứng và số dư lũy kế, số dư cuối
  async generalLedger(currentUser: CurrentUser, filter: LedgerFilter & { accountId: string }) {
    const { database, units } = await this.prepare(currentUser, filter.orgUnitId);
    const accounts: AccountRow[] = await database
      .selectFrom('ledger_accounts')
      .select(['id', 'code', 'name', 'parent_id'])
      .execute();
    const account = accounts.find((row) => row.id === filter.accountId);
    if (!account) {
      throw notFoundError('Không tìm thấy tài khoản', 'ledger_account');
    }
    const ids = new Set([account.id]);
    let added = true;
    while (added) {
      added = false;
      for (const row of accounts) {
        if (row.parent_id && ids.has(row.parent_id) && !ids.has(row.id)) {
          ids.add(row.id);
          added = true;
        }
      }
    }
    const opening = await database
      .selectFrom('journal_lines')
      .innerJoin('journal_entries', 'journal_entries.id', 'journal_lines.entry_id')
      .select(sql<string>`coalesce(sum(journal_lines.debit - journal_lines.credit), 0)`.as('net'))
      .where('journal_entries.status', '=', 'posted')
      .where('journal_entries.org_unit_id', 'in', units)
      .where('journal_entries.entry_date', '<', filter.from)
      .where('journal_lines.account_id', 'in', [...ids])
      .executeTakeFirstOrThrow();
    const lines = await database
      .selectFrom('journal_lines')
      .innerJoin('journal_entries', 'journal_entries.id', 'journal_lines.entry_id')
      .innerJoin('ledger_accounts', 'ledger_accounts.id', 'journal_lines.account_id')
      .select([
        'journal_lines.entry_id',
        'journal_lines.line_no',
        'journal_lines.debit',
        'journal_lines.credit',
        'ledger_accounts.code as account_code',
        'journal_entries.code',
        'journal_entries.entry_date',
        'journal_entries.description',
        'journal_entries.source_code',
      ])
      .where('journal_entries.status', '=', 'posted')
      .where('journal_entries.org_unit_id', 'in', units)
      .where('journal_entries.entry_date', '>=', filter.from)
      .where('journal_entries.entry_date', '<=', filter.to)
      .where('journal_lines.account_id', 'in', [...ids])
      .orderBy('journal_entries.entry_date')
      .orderBy('journal_entries.code')
      .orderBy('journal_lines.line_no')
      .execute();
    const entryIds = [...new Set(lines.map((line) => line.entry_id))];
    const others =
      entryIds.length === 0
        ? []
        : await database
            .selectFrom('journal_lines')
            .innerJoin('ledger_accounts', 'ledger_accounts.id', 'journal_lines.account_id')
            .select(['journal_lines.entry_id', 'journal_lines.debit', 'ledger_accounts.code'])
            .where('journal_lines.entry_id', 'in', entryIds)
            .execute();
    let balance = Number(opening.net);
    const rows = lines.map((line) => {
      const debit = Number(line.debit);
      const credit = Number(line.credit);
      balance += debit - credit;
      // Tài khoản đối ứng: các dòng phía bên kia của cùng bút toán
      const counterpart = [
        ...new Set(
          others
            .filter((other) => other.entry_id === line.entry_id && Number(other.debit) > 0 !== debit > 0)
            .map((other) => other.code),
        ),
      ].join(', ');
      return {
        entry_date: line.entry_date,
        code: line.code,
        description: line.description,
        source_code: line.source_code ?? '',
        account_code: line.account_code,
        counterpart_accounts: counterpart,
        debit,
        credit,
        balance_debit: split(balance).debit,
        balance_credit: split(balance).credit,
      };
    });
    const openingSplit = split(Number(opening.net));
    const closingSplit = split(balance);
    return {
      account: { id: account.id, code: account.code, name: account.name },
      lines: rows,
      totals: {
        opening_debit: openingSplit.debit,
        opening_credit: openingSplit.credit,
        period_debit: rows.reduce((total, row) => total + row.debit, 0),
        period_credit: rows.reduce((total, row) => total + row.credit, 0),
        closing_debit: closingSplit.debit,
        closing_credit: closingSplit.credit,
      },
    };
  }
}
