import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, StatusBadge, TextField, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { formatMoney } from '../fees/fees-api.js';
import { AppShell } from '../pages/AppShell.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { listCashAccounts } from './finance-api.js';
import {
  autoMatch,
  createStatementLine,
  deleteStatementLine,
  matchStatementLine,
  readReconciliation,
  unmatchStatementLine,
} from './finance-g2-api.js';

// MH-11 phần giao dịch ngân hàng và đối chiếu (P06-06; BR-34; YCTD-82): nhập dòng sao kê, so phát sinh theo sổ và theo sao kê,
// khớp tay hoặc khớp tự động với giao dịch của phiếu thu, phiếu chi
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const monthStart = () => `${today().slice(0, 7)}-01`;

export function BankReconciliationPage() {
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const canManage = useHasPermission(PERMISSION_CODES.bankTransactionManage);
  const queryClient = useQueryClient();
  const accounts = useQuery({
    queryKey: ['cash-accounts', orgUnitId],
    queryFn: () => listCashAccounts(orgUnitId ?? ''),
    enabled: Boolean(orgUnitId),
  });
  const banks = (accounts.data ?? []).filter((account) => account.account_type === 'bank');
  const [chosenAccountId, setChosenAccountId] = useState<string>();
  const accountId = banks.some((account) => account.id === chosenAccountId) ? chosenAccountId : banks[0]?.id;
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [line, setLine] = useState({ date: today(), amount: '', description: '', reference: '' });
  const [matching, setMatching] = useState<string>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);

  const reconciliation = useQuery({
    queryKey: ['bank-reconciliation', accountId, from, to],
    queryFn: () => readReconciliation(accountId ?? '', from, to),
    enabled: Boolean(accountId && from && to),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['bank-reconciliation'] });
  const create = useMutation({
    mutationFn: () =>
      createStatementLine({
        account_id: accountId ?? '',
        transaction_date: line.date,
        amount: Number(line.amount),
        description: line.description,
        ...(line.reference ? { bank_reference: line.reference } : {}),
      }),
    onSuccess: async () => {
      setLine({ date: line.date, amount: '', description: '', reference: '' });
      await refresh();
      setToastMessage('Đã ghi dòng sao kê');
    },
  });
  const action = useMutation({
    mutationFn: async (run: () => Promise<unknown>) => run(),
    onSuccess: async () => {
      setMatching(undefined);
      await refresh();
    },
  });
  const data = reconciliation.data;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Đối chiếu ngân hàng</h1>
        <Toast message={toastMessage} onClose={closeToast} />
        <div className="flex flex-wrap items-end gap-4">
          <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
          <label className="flex flex-col gap-2 text-label font-medium text-text">
            Tài khoản ngân hàng
            <select
              value={accountId ?? ''}
              onChange={(event) => setChosenAccountId(event.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-content font-normal"
            >
              {banks.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.account_number})
                </option>
              ))}
            </select>
          </label>
          <div className="w-44">
            <TextField label="Từ ngày" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </div>
          <div className="w-44">
            <TextField label="Đến ngày" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
          {canManage && accountId ? (
            <Button
              onClick={() =>
                action.mutate(async () => {
                  const result = await autoMatch(accountId, from, to);
                  setToastMessage(`Đã khớp tự động ${result.auto_matched_count} dòng`);
                })
              }
            >
              Khớp tự động
            </Button>
          ) : null}
        </div>
        {accounts.data && banks.length === 0 ? (
          <p className="text-content text-text-secondary">Đơn vị chưa khai báo tài khoản ngân hàng.</p>
        ) : null}
        {reconciliation.error ? <Alert tone="danger">{messageOf(reconciliation.error)}</Alert> : null}
        {action.error ? <Alert tone="danger">{messageOf(action.error)}</Alert> : null}
        {data ? (
          <section
            className="flex flex-wrap gap-6 rounded-xl border border-border bg-card p-4 text-content"
            aria-label="Kết quả đối chiếu"
          >
            <span>Số dư sổ đầu kỳ {formatMoney(data.book_opening_balance)}</span>
            <span>Phát sinh theo sổ {formatMoney(data.book_movement)}</span>
            <span>Phát sinh theo sao kê {formatMoney(data.statement_movement)}</span>
            <span className="font-semibold">Chênh lệch {formatMoney(data.difference)}</span>
            <span>Đã khớp {data.matched_count}</span>
          </section>
        ) : null}
        {canManage && accountId ? (
          <section
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
            aria-label="Ghi dòng sao kê"
          >
            <h2 className="text-section-title font-semibold text-text">Ghi dòng sao kê</h2>
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-44">
                <TextField
                  label="Ngày giao dịch"
                  type="date"
                  value={line.date}
                  onChange={(event) => setLine({ ...line, date: event.target.value })}
                />
              </div>
              <div className="w-48">
                <TextField
                  label="Số tiền (âm là tiền ra)"
                  type="number"
                  value={line.amount}
                  onChange={(event) => setLine({ ...line, amount: event.target.value })}
                />
              </div>
              <div className="w-72">
                <TextField
                  label="Diễn giải"
                  value={line.description}
                  onChange={(event) => setLine({ ...line, description: event.target.value })}
                />
              </div>
              <div className="w-44">
                <TextField
                  label="Số tham chiếu"
                  value={line.reference}
                  onChange={(event) => setLine({ ...line, reference: event.target.value })}
                />
              </div>
              <Button
                variant="primary"
                disabled={!line.amount || !line.description.trim() || create.isPending}
                onClick={() => create.mutate()}
              >
                Ghi dòng sao kê
              </Button>
            </div>
            {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
          </section>
        ) : null}
        {data ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <section
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
              aria-label="Sao kê ngân hàng"
            >
              <h2 className="text-section-title font-semibold text-text">Sao kê ngân hàng</h2>
              {data.statement.length === 0 ? (
                <p className="text-content text-text-secondary">Chưa có dòng sao kê.</p>
              ) : (
                <table className="w-full text-content">
                  <tbody>
                    {data.statement.map((row) => (
                      <tr key={row.id} className="border-t border-border">
                        <td className="px-2 py-2">{row.transaction_date}</td>
                        <td className="px-2 py-2">{row.description}</td>
                        <td className="px-2 py-2 text-right">{formatMoney(row.amount)}</td>
                        <td className="px-2 py-2">
                          {row.status === 'matched' ? (
                            <StatusBadge tone="success" label="Đã khớp" />
                          ) : (
                            <StatusBadge tone="warning" label="Chưa khớp" />
                          )}
                        </td>
                        <td className="px-2 py-2">
                          {canManage && row.status === 'unmatched' ? (
                            <>
                              <Button variant="text" onClick={() => setMatching(row.id)}>
                                Khớp
                              </Button>
                              <Button variant="text" onClick={() => action.mutate(() => deleteStatementLine(row.id))}>
                                Xóa
                              </Button>
                            </>
                          ) : null}
                          {canManage && row.status === 'matched' ? (
                            <Button variant="text" onClick={() => action.mutate(() => unmatchStatementLine(row.id))}>
                              Bỏ khớp
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
            <section
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
              aria-label="Giao dịch theo sổ chưa khớp"
            >
              <h2 className="text-section-title font-semibold text-text">Giao dịch theo sổ chưa khớp</h2>
              {matching ? (
                <p className="text-content text-text-secondary">Chọn giao dịch cùng số tiền để khớp với dòng sao kê.</p>
              ) : null}
              {data.unmatched_book.length === 0 ? (
                <p className="text-content text-text-secondary">Không có giao dịch chưa khớp.</p>
              ) : (
                <table className="w-full text-content">
                  <tbody>
                    {data.unmatched_book.map((entry) => (
                      <tr key={entry.id} className="border-t border-border">
                        <td className="px-2 py-2">{entry.transaction_date}</td>
                        <td className="px-2 py-2">{entry.description}</td>
                        <td className="px-2 py-2 text-right">{formatMoney(entry.amount)}</td>
                        <td className="px-2 py-2">
                          {matching ? (
                            <Button
                              variant="text"
                              onClick={() => action.mutate(() => matchStatementLine(matching, entry.id))}
                            >
                              Chọn
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
