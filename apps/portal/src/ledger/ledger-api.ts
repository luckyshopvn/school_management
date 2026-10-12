import { requestJson } from '../session/api-client.js';

// Gọi điểm cuối sổ kế toán kép (G3-06, N5; YCTD-88)
const send = <T>(method: string, path: string, body: unknown = {}) =>
  requestJson<T>(path, { method, body: JSON.stringify(body) });

export interface LedgerAccount {
  id: string;
  code: string;
  name: string;
  parent_id: string | null;
  normal_balance: 'debit' | 'credit' | 'both';
  is_system: boolean;
  status: 'active' | 'inactive';
  has_children: boolean;
}

export interface PostingRule {
  id: string;
  document_type: string;
  label: string;
  category_id: string | null;
  category_name: string | null;
  debit_account_id: string | null;
  debit_account_code: string | null;
  credit_account_id: string | null;
  credit_account_code: string | null;
}

export interface DocumentType {
  code: string;
  label: string;
  money_side: 'debit' | 'credit' | 'account' | null;
  by_category: boolean;
}

export interface JournalLine {
  line_no: number;
  account_id: string;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  description: string | null;
}

export interface JournalEntry {
  id: string;
  code: string;
  org_unit_name: string;
  entry_date: string;
  description: string;
  entry_type: 'auto' | 'manual' | 'opening';
  source_code: string | null;
  total_amount: number;
  status: 'posted' | 'voided';
  void_reason: string | null;
  lines: JournalLine[];
}

export interface TrialBalanceRow {
  account_id: string;
  account_code: string;
  account_name: string;
  level: number;
  opening_debit: number;
  opening_credit: number;
  period_debit: number;
  period_credit: number;
  closing_debit: number;
  closing_credit: number;
}

export interface GeneralLedgerRow {
  entry_date: string;
  code: string;
  description: string;
  account_code: string;
  counterpart_accounts: string;
  debit: number;
  credit: number;
  balance_debit: number;
  balance_credit: number;
}

export interface LedgerFilter {
  org_unit_id: string;
  from: string;
  to: string;
}

const query = (filter: LedgerFilter, extra: Record<string, string> = {}) =>
  new URLSearchParams(
    Object.entries({ ...filter, ...extra }).filter(([, value]) => value !== '') as Array<[string, string]>,
  ).toString();

export const listAccounts = (): Promise<{ can_manage: boolean; accounts: LedgerAccount[] }> =>
  requestJson('/api/v1/ledger/accounts');
export const createAccount = (input: { parent_id: string; code: string; name: string }) =>
  send<LedgerAccount>('POST', '/api/v1/ledger/accounts', input);
export const updateAccount = (id: string, input: { name?: string; status?: 'active' | 'inactive' }) =>
  send<LedgerAccount>('PATCH', `/api/v1/ledger/accounts/${id}`, input);
export const listRules = (): Promise<{ can_manage: boolean; document_types: DocumentType[]; rules: PostingRule[] }> =>
  requestJson('/api/v1/ledger/posting-rules');
export const saveRule = (input: {
  document_type: string;
  category_id: string | null;
  debit_account_id: string | null;
  credit_account_id: string | null;
}) => send<PostingRule>('PUT', '/api/v1/ledger/posting-rules', input);
export const deleteRule = (id: string) => requestJson(`/api/v1/ledger/posting-rules/${id}`, { method: 'DELETE' });
export const postDocuments = () =>
  send<{ posted: Record<string, number>; total: number }>('POST', '/api/v1/ledger/post-documents');
export const readJournal = (
  filter: LedgerFilter,
): Promise<{ entries: JournalEntry[]; totals: { entry_count: number; debit: number; credit: number } }> =>
  requestJson(`/api/v1/ledger/entries?${query(filter)}`);
export const createEntry = (input: {
  org_unit_id: string;
  entry_date: string;
  description: string;
  request_key: string;
  lines: Array<{ account_id: string; debit: number; credit: number; description?: string }>;
}) => send<JournalEntry>('POST', '/api/v1/ledger/entries', input);
export const voidEntry = (id: string, reason: string) =>
  send<JournalEntry>('POST', `/api/v1/ledger/entries/${id}/void`, { reason });
export const readTrialBalance = (
  filter: LedgerFilter,
): Promise<{
  accounts: TrialBalanceRow[];
  totals: Omit<TrialBalanceRow, 'account_id' | 'account_code' | 'account_name' | 'level'>;
  balanced: boolean;
}> => requestJson(`/api/v1/ledger/reports/trial-balance?${query(filter)}`);
export const readGeneralLedger = (
  filter: LedgerFilter,
  accountId: string,
): Promise<{ account: { code: string; name: string }; lines: GeneralLedgerRow[]; totals: Record<string, number> }> =>
  requestJson(`/api/v1/ledger/reports/general-ledger?${query(filter, { account_id: accountId })}`);
