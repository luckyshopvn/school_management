import { useCallback, useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import {
  Alert,
  Button,
  ConfirmDeleteDialog,
  DataGrid,
  FORM_CONTROL_CLASS,
  FormBlock,
  FormRow,
  StatusBadge,
  TextField,
  Toast,
  type DataGridColumn,
} from '@school-management/ui';
import { useUnitChoice } from '../catalogs/UnitSelect.js';
import { formatMoney, listCashflowCategories } from '../fees/fees-api.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ExportButton } from '../reports/PhaseTwoReports.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  createAccount,
  createEntry,
  deleteRule,
  listAccounts,
  listRules,
  postDocuments,
  readGeneralLedger,
  readJournal,
  readTrialBalance,
  saveRule,
  voidEntry,
  type LedgerAccount,
  type LedgerFilter,
  type PostingRule,
} from './ledger-api.js';

// MH-67 Sổ nhật ký chung và bút toán thủ công, MH-68 Sổ cái và bảng cân đối số phát sinh, MH-69 Hệ thống tài khoản và
// quy tắc ghi sổ (G3-06, N5; BR-95; YCTD-88). Giao diện chỉ hiển thị số liệu máy chủ trả về. Sổ nhật ký, sổ cái, cân
// đối giữ bố cục sổ; hệ thống tài khoản và quy tắc ghi sổ dùng lưới dữ liệu chung, biểu mẫu theo khối (DT-15 phần 15f1)
type Tab = 'journal' | 'ledger' | 'trial' | 'accounts' | 'rules';
const TABS: Array<[Tab, string]> = [
  ['journal', 'Nhật ký chung'],
  ['ledger', 'Sổ cái'],
  ['trial', 'Cân đối số phát sinh'],
  ['accounts', 'Hệ thống tài khoản kế toán'],
  ['rules', 'Quy tắc ghi sổ'],
];
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const firstOfMonth = () => `${today().slice(0, 7)}-01`;
const ENTRY_TYPE_LABELS = { auto: 'Tự động', manual: 'Thủ công', opening: 'Số dư đầu năm' } as const;

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => `${detail.field}: ${detail.message}`)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const money = (value: number) => (value ? formatMoney(value) : '');

function AccountSelect({
  label,
  accounts,
  value,
  onChange,
  allowEmpty,
}: {
  label: string;
  accounts: LedgerAccount[];
  value: string;
  onChange(value: string): void;
  allowEmpty?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-label font-medium text-text">
        {label}
      </label>
      <select
        id={id}
        className="rounded-lg border border-border bg-card px-3 py-2 text-content"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{allowEmpty ?? 'Chọn tài khoản'}</option>
        {accounts
          .filter((account) => account.status === 'active')
          .map((account) => (
            <option key={account.id} value={account.id}>
              {account.code} - {account.name}
            </option>
          ))}
      </select>
    </div>
  );
}

function ManualEntryForm({
  accounts,
  orgUnitId,
  onSaved,
}: {
  accounts: LedgerAccount[];
  orgUnitId: string;
  onSaved(message: string): void;
}) {
  const empty = () => ({ account_id: '', debit: '', credit: '' });
  const [entryDate, setEntryDate] = useState(today());
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState([empty(), empty()]);
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const save = useMutation({
    mutationFn: () =>
      createEntry({
        org_unit_id: orgUnitId,
        entry_date: entryDate,
        description,
        request_key: requestKey,
        lines: lines.map((line) => ({
          account_id: line.account_id,
          debit: Number(line.debit || 0),
          credit: Number(line.credit || 0),
        })),
      }),
    onSuccess: (entry) => {
      setDescription('');
      setLines([empty(), empty()]);
      setRequestKey(crypto.randomUUID());
      onSaved(`Đã ghi bút toán ${entry.code}`);
    },
  });
  const debit = lines.reduce((total, line) => total + Number(line.debit || 0), 0);
  const credit = lines.reduce((total, line) => total + Number(line.credit || 0), 0);
  const update = (index: number, key: 'account_id' | 'debit' | 'credit', value: string) =>
    setLines(lines.map((line, position) => (position === index ? { ...line, [key]: value } : line)));
  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      aria-label="Bút toán thủ công"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <h2 className="text-section-title font-semibold">Ghi bút toán thủ công</h2>
      <FormBlock title="Thông tin bút toán">
        <FormRow label="Ngày ghi sổ">
          <input
            className={FORM_CONTROL_CLASS}
            type="date"
            value={entryDate}
            onChange={(event) => setEntryDate(event.target.value)}
          />
        </FormRow>
        <FormRow label="Diễn giải">
          <input
            className={FORM_CONTROL_CLASS}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </FormRow>
      </FormBlock>
      {lines.map((line, index) => (
        <div key={index} className="flex flex-wrap items-end gap-3">
          <AccountSelect
            label={`Tài khoản dòng ${index + 1}`}
            accounts={accounts}
            value={line.account_id}
            onChange={(value) => update(index, 'account_id', value)}
          />
          <TextField
            label={`Nợ dòng ${index + 1}`}
            inputMode="numeric"
            value={line.debit}
            onChange={(event) => update(index, 'debit', event.target.value.replace(/\D/g, ''))}
          />
          <TextField
            label={`Có dòng ${index + 1}`}
            inputMode="numeric"
            value={line.credit}
            onChange={(event) => update(index, 'credit', event.target.value.replace(/\D/g, ''))}
          />
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setLines([...lines, empty()])}>Thêm dòng</Button>
        <span className={debit === credit ? 'text-text-secondary' : 'text-danger'}>
          Tổng Nợ {formatMoney(debit)}, tổng Có {formatMoney(credit)}
        </span>
        <Button type="submit" variant="primary" disabled={save.isPending || !description.trim()}>
          Ghi sổ bút toán
        </Button>
      </div>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
    </form>
  );
}

function JournalView({
  filter,
  canManage,
  accounts,
}: {
  filter: LedgerFilter;
  canManage: boolean;
  accounts: LedgerAccount[];
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const journal = useQuery({
    queryKey: ['ledger', 'journal', filter],
    queryFn: () => readJournal(filter),
    retry: false,
  });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['ledger'] });
    setToastMessage(message);
  };
  const post = useMutation({
    mutationFn: postDocuments,
    onSuccess: (result) => refresh(`Đã ghi sổ ${result.total} chứng từ`),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => voidEntry(id, reason),
    onSuccess: (entry) => {
      setReason('');
      return refresh(`Đã hủy bút toán ${entry.code}`);
    },
  });
  return (
    <div className="flex flex-col gap-4">
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-wrap items-end gap-3">
        {canManage ? (
          <Button variant="primary" disabled={post.isPending} onClick={() => post.mutate()}>
            Ghi sổ chứng từ
          </Button>
        ) : null}
        <ExportButton code="ledger-journal" filters={{ ...filter }} />
        {canManage ? (
          <TextField label="Lý do hủy bút toán" value={reason} onChange={(event) => setReason(event.target.value)} />
        ) : null}
      </div>
      {post.error ? <Alert tone="danger">{messageOf(post.error)}</Alert> : null}
      {cancel.error ? <Alert tone="danger">{messageOf(cancel.error)}</Alert> : null}
      {canManage && filter.org_unit_id ? (
        <ManualEntryForm accounts={accounts} orgUnitId={filter.org_unit_id} onSaved={refresh} />
      ) : null}
      {journal.error ? <Alert tone="danger">{messageOf(journal.error)}</Alert> : null}
      {journal.data ? (
        <p className="text-content text-text-secondary">
          {journal.data.totals.entry_count} bút toán, tổng Nợ {formatMoney(journal.data.totals.debit)}, tổng Có{' '}
          {formatMoney(journal.data.totals.credit)}
        </p>
      ) : null}
      <section className="rounded-xl border border-border bg-card p-4" aria-label="Sổ nhật ký chung">
        <table className="w-full text-content">
          <thead className="text-left text-label font-medium text-text-secondary">
            <tr>
              <th className="px-3 py-2">Ngày</th>
              <th className="px-3 py-2">Số</th>
              <th className="px-3 py-2">Diễn giải</th>
              <th className="px-3 py-2">Tài khoản</th>
              <th className="px-3 py-2 text-right">Nợ</th>
              <th className="px-3 py-2 text-right">Có</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {(journal.data?.entries ?? []).map((entry) =>
              entry.lines.map((line, index) => (
                <tr key={`${entry.id}-${line.line_no}`} className={index === 0 ? 'border-t border-border' : ''}>
                  <td className="px-3 py-1">{index === 0 ? entry.entry_date : ''}</td>
                  <td className="px-3 py-1">{index === 0 ? entry.code : ''}</td>
                  <td className="px-3 py-1">
                    {index === 0 ? (
                      <span className="flex flex-wrap items-center gap-2">
                        {entry.description}
                        <StatusBadge
                          tone={entry.status === 'voided' ? 'danger' : 'neutral'}
                          label={entry.status === 'voided' ? 'Đã hủy' : ENTRY_TYPE_LABELS[entry.entry_type]}
                        />
                      </span>
                    ) : null}
                  </td>
                  <td className={`px-3 py-1 ${line.credit > 0 ? 'pl-8' : ''}`}>
                    {line.account_code} {line.account_name}
                  </td>
                  <td className="px-3 py-1 text-right">{money(line.debit)}</td>
                  <td className="px-3 py-1 text-right">{money(line.credit)}</td>
                  <td className="px-3 py-1">
                    {index === 0 && canManage && entry.entry_type === 'manual' && entry.status === 'posted' ? (
                      <Button variant="text" disabled={!reason.trim()} onClick={() => cancel.mutate(entry.id)}>
                        Hủy {entry.code}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function TrialBalanceView({ filter }: { filter: LedgerFilter }) {
  const report = useQuery({
    queryKey: ['ledger', 'trial', filter],
    queryFn: () => readTrialBalance(filter),
    retry: false,
  });
  const columns = [
    'opening_debit',
    'opening_credit',
    'period_debit',
    'period_credit',
    'closing_debit',
    'closing_credit',
  ] as const;
  return (
    <div className="flex flex-col gap-4">
      <ExportButton code="ledger-trial-balance" filters={{ ...filter }} />
      {report.error ? <Alert tone="danger">{messageOf(report.error)}</Alert> : null}
      {report.data ? (
        <Alert tone={report.data.balanced ? 'success' : 'danger'}>
          {report.data.balanced ? 'Sổ cân: tổng Nợ bằng tổng Có' : 'Sổ lệch, kiểm tra lại bút toán'}
        </Alert>
      ) : null}
      <section className="rounded-xl border border-border bg-card p-4" aria-label="Bảng cân đối số phát sinh">
        <table className="w-full text-content">
          <thead className="text-left text-label font-medium text-text-secondary">
            <tr>
              <th className="px-3 py-2">Tài khoản</th>
              <th className="px-3 py-2 text-right">Đầu kỳ Nợ</th>
              <th className="px-3 py-2 text-right">Đầu kỳ Có</th>
              <th className="px-3 py-2 text-right">Phát sinh Nợ</th>
              <th className="px-3 py-2 text-right">Phát sinh Có</th>
              <th className="px-3 py-2 text-right">Cuối kỳ Nợ</th>
              <th className="px-3 py-2 text-right">Cuối kỳ Có</th>
            </tr>
          </thead>
          <tbody>
            {(report.data?.accounts ?? []).map((row) => (
              <tr key={row.account_id} className={`border-t border-border ${row.level === 1 ? 'font-medium' : ''}`}>
                <td className="px-3 py-1" style={{ paddingLeft: `${row.level * 12}px` }}>
                  {row.account_code} {row.account_name}
                </td>
                {columns.map((key) => (
                  <td key={key} className="px-3 py-1 text-right">
                    {money(row[key])}
                  </td>
                ))}
              </tr>
            ))}
            {report.data ? (
              <tr className="border-t border-border font-bold">
                <td className="px-3 py-1">Tổng cộng</td>
                {columns.map((key) => (
                  <td key={key} className="px-3 py-1 text-right">
                    {formatMoney(report.data.totals[key])}
                  </td>
                ))}
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function GeneralLedgerView({ filter, accounts }: { filter: LedgerFilter; accounts: LedgerAccount[] }) {
  const [accountId, setAccountId] = useState('');
  const report = useQuery({
    queryKey: ['ledger', 'general', filter, accountId],
    queryFn: () => readGeneralLedger(filter, accountId),
    enabled: accountId !== '',
    retry: false,
  });
  const totals = report.data?.totals;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <AccountSelect label="Tài khoản sổ cái" accounts={accounts} value={accountId} onChange={setAccountId} />
        {accountId ? (
          <ExportButton code="ledger-general-ledger" filters={{ ...filter, account_id: accountId }} />
        ) : null}
      </div>
      {report.error ? <Alert tone="danger">{messageOf(report.error)}</Alert> : null}
      {totals ? (
        <p className="text-content text-text-secondary">
          Số dư đầu kỳ Nợ {formatMoney(totals.opening_debit ?? 0)}, Có {formatMoney(totals.opening_credit ?? 0)}. Phát
          sinh Nợ {formatMoney(totals.period_debit ?? 0)}, Có {formatMoney(totals.period_credit ?? 0)}. Số dư cuối kỳ Nợ{' '}
          {formatMoney(totals.closing_debit ?? 0)}, Có {formatMoney(totals.closing_credit ?? 0)}
        </p>
      ) : null}
      <section className="rounded-xl border border-border bg-card p-4" aria-label="Sổ cái">
        <table className="w-full text-content">
          <thead className="text-left text-label font-medium text-text-secondary">
            <tr>
              <th className="px-3 py-2">Ngày</th>
              <th className="px-3 py-2">Số</th>
              <th className="px-3 py-2">Diễn giải</th>
              <th className="px-3 py-2">TK</th>
              <th className="px-3 py-2">Đối ứng</th>
              <th className="px-3 py-2 text-right">Nợ</th>
              <th className="px-3 py-2 text-right">Có</th>
              <th className="px-3 py-2 text-right">Số dư</th>
            </tr>
          </thead>
          <tbody>
            {(report.data?.lines ?? []).map((line, index) => (
              <tr key={`${line.code}-${index}`} className="border-t border-border">
                <td className="px-3 py-1">{line.entry_date}</td>
                <td className="px-3 py-1">{line.code}</td>
                <td className="px-3 py-1">{line.description}</td>
                <td className="px-3 py-1">{line.account_code}</td>
                <td className="px-3 py-1">{line.counterpart_accounts}</td>
                <td className="px-3 py-1 text-right">{money(line.debit)}</td>
                <td className="px-3 py-1 text-right">{money(line.credit)}</td>
                <td className="px-3 py-1 text-right">
                  {line.balance_credit ? `Có ${formatMoney(line.balance_credit)}` : formatMoney(line.balance_debit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

// Các tài khoản đang dùng làm lựa chọn của ô chọn trong biểu mẫu khối
function accountOptions(accounts: LedgerAccount[], emptyLabel: string) {
  return [
    <option key="" value="">
      {emptyLabel}
    </option>,
    ...accounts
      .filter((account) => account.status === 'active')
      .map((account) => (
        <option key={account.id} value={account.id}>
          {account.code} - {account.name}
        </option>
      )),
  ];
}

function AccountsView({ accounts, canManage }: { accounts: LedgerAccount[]; canManage: boolean }) {
  const queryClient = useQueryClient();
  const grid = useGridSettings('ledger-accounts');
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [parentId, setParentId] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const create = useMutation({
    mutationFn: () => createAccount({ parent_id: parentId, code, name }),
    onSuccess: async () => {
      setCode('');
      setName('');
      setCreating(false);
      await queryClient.invalidateQueries({ queryKey: ['ledger-accounts'] });
    },
  });
  const byId = new Map(accounts.map((account) => [account.id, account]));
  const depth = (account: LedgerAccount): number =>
    account.parent_id && byId.get(account.parent_id) ? depth(byId.get(account.parent_id) as LedgerAccount) + 1 : 0;
  const keyword = search.trim().toLocaleLowerCase('vi');
  const rows = accounts.filter(
    (account) => keyword === '' || `${account.code} ${account.name}`.toLocaleLowerCase('vi').includes(keyword),
  );
  const columns: Array<DataGridColumn<LedgerAccount>> = [
    {
      id: 'code',
      header: 'Số hiệu',
      alwaysVisible: true,
      cell: (account) => <span style={{ paddingLeft: `${depth(account) * 16}px` }}>{account.code}</span>,
    },
    { id: 'name', header: 'Tên', cell: (account) => account.name },
    { id: 'source', header: 'Nguồn', cell: (account) => (account.is_system ? 'Theo chế độ' : 'Chi tiết') },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: (account) => (account.status === 'active' ? 'Đang dùng' : 'Ngừng dùng'),
    },
  ];
  return (
    <div className="flex flex-col gap-4">
      {canManage && creating ? (
        <form
          noValidate
          className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
          aria-label="Thêm tài khoản chi tiết"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <h2 className="text-section-title font-semibold">Thêm tài khoản chi tiết</h2>
          <FormBlock title="Thông tin tài khoản">
            <FormRow label="Tài khoản cha">
              <select
                className={FORM_CONTROL_CLASS}
                value={parentId}
                onChange={(event) => setParentId(event.target.value)}
              >
                {accountOptions(accounts, 'Chọn tài khoản')}
              </select>
            </FormRow>
            <FormRow label="Số hiệu">
              <input className={FORM_CONTROL_CLASS} value={code} onChange={(event) => setCode(event.target.value)} />
            </FormRow>
            <FormRow label="Tên tài khoản chi tiết">
              <input className={FORM_CONTROL_CLASS} value={name} onChange={(event) => setName(event.target.value)} />
            </FormRow>
          </FormBlock>
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={!parentId || !code || !name || create.isPending}>
              Ghi
            </Button>
            <Button variant="text" onClick={() => setCreating(false)}>
              Hủy
            </Button>
          </div>
        </form>
      ) : null}
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
      {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
      <DataGrid
        label="Danh sách tài khoản kế toán"
        columns={columns}
        rows={rows}
        getRowId={(account) => account.id}
        getRowLabel={(account) => `${account.code} ${account.name}`}
        emptyText="Chưa có tài khoản kế toán."
        search={{ label: 'Tìm theo số hiệu, tên', value: search, onChange: setSearch }}
        toolbar={
          canManage ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Thêm mới
            </Button>
          ) : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </div>
  );
}

function RulesView({ accounts }: { accounts: LedgerAccount[] }) {
  const queryClient = useQueryClient();
  const grid = useGridSettings('ledger-rules');
  const rules = useQuery({ queryKey: ['ledger-rules'], queryFn: listRules });
  const categories = useQuery({ queryKey: ['cashflow-categories'], queryFn: listCashflowCategories });
  const [search, setSearch] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [debitId, setDebitId] = useState('');
  const [creditId, setCreditId] = useState('');
  const [removing, setRemoving] = useState<PostingRule>();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['ledger-rules'] });
  const save = useMutation({
    mutationFn: () =>
      saveRule({
        document_type: documentType,
        category_id: categoryId || null,
        debit_account_id: debitId || null,
        credit_account_id: creditId || null,
      }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: deleteRule,
    onSuccess: async () => {
      setRemoving(undefined);
      await refresh();
    },
    onError: () => setRemoving(undefined),
  });
  const type = rules.data?.document_types.find((item) => item.code === documentType);
  const keyword = search.trim().toLocaleLowerCase('vi');
  const rows = (rules.data?.rules ?? []).filter(
    (rule) => keyword === '' || `${rule.label} ${rule.category_name ?? ''}`.toLocaleLowerCase('vi').includes(keyword),
  );
  const columns: Array<DataGridColumn<PostingRule>> = [
    { id: 'label', header: 'Loại chứng từ', alwaysVisible: true, cell: (rule) => rule.label },
    { id: 'category_name', header: 'Khoản mục', cell: (rule) => rule.category_name ?? 'Mọi khoản mục' },
    {
      id: 'debit',
      header: 'Nợ',
      cell: (rule) => rule.debit_account_code ?? (rule.document_type.startsWith('money') ? '' : 'Tiền'),
    },
    {
      id: 'credit',
      header: 'Có',
      cell: (rule) => rule.credit_account_code ?? (rule.document_type.startsWith('money') ? '' : 'Tiền'),
    },
  ];
  return (
    <div className="flex flex-col gap-4">
      {rules.data?.can_manage ? (
        <form
          noValidate
          className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
          aria-label="Sửa quy tắc ghi sổ"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <FormBlock title="Quy tắc ghi sổ">
            <FormRow label="Loại chứng từ">
              <select
                className={FORM_CONTROL_CLASS}
                value={documentType}
                onChange={(event) => setDocumentType(event.target.value)}
              >
                <option value="">Chọn loại chứng từ</option>
                {(rules.data?.document_types ?? []).map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </select>
            </FormRow>
            {type?.by_category ? (
              <FormRow label="Khoản mục">
                <select
                  className={FORM_CONTROL_CLASS}
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                >
                  <option value="">Mọi khoản mục</option>
                  {(categories.data ?? []).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </FormRow>
            ) : null}
            <FormRow label="Tài khoản Nợ">
              <select
                className={FORM_CONTROL_CLASS}
                value={debitId}
                onChange={(event) => setDebitId(event.target.value)}
              >
                {accountOptions(accounts, 'Tài khoản tiền của quỹ')}
              </select>
            </FormRow>
            <FormRow label="Tài khoản Có">
              <select
                className={FORM_CONTROL_CLASS}
                value={creditId}
                onChange={(event) => setCreditId(event.target.value)}
              >
                {accountOptions(accounts, 'Tài khoản tiền của quỹ')}
              </select>
            </FormRow>
          </FormBlock>
          <div>
            <Button type="submit" variant="primary" disabled={!documentType || save.isPending}>
              Ghi
            </Button>
          </div>
        </form>
      ) : null}
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      {remove.error ? <Alert tone="danger">{messageOf(remove.error)}</Alert> : null}
      {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
      <DataGrid
        label="Danh sách quy tắc ghi sổ"
        columns={columns}
        rows={rows}
        getRowId={(rule) => rule.id}
        getRowLabel={(rule) => rule.label}
        loading={rules.isPending}
        emptyText="Chưa có quy tắc ghi sổ."
        search={{ label: 'Tìm theo loại chứng từ, khoản mục', value: search, onChange: setSearch }}
        rowActions={
          rules.data?.can_manage
            ? (rule) =>
                rule.category_id ? (
                  <Button variant="text" onClick={() => setRemoving(rule)}>
                    Bỏ quy tắc
                  </Button>
                ) : null
            : undefined
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
      <ConfirmDeleteDialog
        open={removing !== undefined}
        subject={`quy tắc ghi sổ ${removing?.label ?? ''}, khoản mục ${removing?.category_name ?? ''}`}
        confirmLabel="Bỏ quy tắc"
        busy={remove.isPending}
        onCancel={() => setRemoving(undefined)}
        onConfirm={() => {
          if (removing) {
            remove.mutate(removing.id);
          }
        }}
      >
        Chỉ bỏ quy tắc riêng của khoản mục; quy tắc chung của loại chứng từ giữ nguyên.
      </ConfirmDeleteDialog>
    </div>
  );
}

export function LedgerPage() {
  const unitChoice = useUnitChoice();
  const canManage = useHasPermission(PERMISSION_CODES.ledgerManage);
  const [tab, setTab] = useState<Tab>('journal');
  const [unit, setUnit] = useState<string>();
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const unitId = useId();
  const accounts = useQuery({ queryKey: ['ledger-accounts'], queryFn: listAccounts });
  const orgUnitId = unit ?? unitChoice.selectedId ?? '';
  const filter: LedgerFilter = { org_unit_id: orgUnitId, from, to };
  const accountList = accounts.data?.accounts ?? [];
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/ledger')}</h1>
        <div className="flex flex-wrap gap-2" role="tablist">
          {TABS.map(([key, label]) => (
            <Button
              key={key}
              role="tab"
              aria-selected={tab === key}
              variant={tab === key ? 'primary' : 'secondary'}
              onClick={() => setTab(key)}
            >
              {label}
            </Button>
          ))}
        </div>
        {tab === 'journal' || tab === 'ledger' || tab === 'trial' ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-2">
              <label htmlFor={unitId} className="text-label font-medium text-text">
                Đơn vị
              </label>
              <select
                id={unitId}
                className="rounded-lg border border-border bg-card px-3 py-2 text-content"
                value={orgUnitId}
                onChange={(event) => setUnit(event.target.value)}
              >
                <option value="">Mọi đơn vị trong phạm vi</option>
                {unitChoice.units.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <TextField label="Từ ngày" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            <TextField label="Đến ngày" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
        ) : null}
        {accounts.error ? <Alert tone="danger">{messageOf(accounts.error)}</Alert> : null}
        {tab === 'journal' ? <JournalView filter={filter} canManage={canManage} accounts={accountList} /> : null}
        {tab === 'ledger' ? <GeneralLedgerView filter={filter} accounts={accountList} /> : null}
        {tab === 'trial' ? <TrialBalanceView filter={filter} /> : null}
        {tab === 'accounts' ? (
          <AccountsView accounts={accountList} canManage={accounts.data?.can_manage ?? false} />
        ) : null}
        {tab === 'rules' ? <RulesView accounts={accountList} /> : null}
      </div>
    </AppShell>
  );
}
