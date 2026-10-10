import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, TextField } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { formatMoney } from '../fees/fees-api.js';
import { AppShell } from '../pages/AppShell.js';
import { ApiError } from '../session/api-client.js';
import { listCashAccounts, readCashBook } from './finance-api.js';

// MH-11 Sổ quỹ và sổ tài khoản (P06-05; BR-34; AC-108, AC-112; YCTD-55): số dư đầu kỳ, từng phiếu thu, phiếu chi, phiếu
// đảo theo ngày và số dư cuối kỳ
function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

export function CashBookPage() {
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const accounts = useQuery({
    queryKey: ['cash-accounts', orgUnitId],
    queryFn: () => listCashAccounts(orgUnitId ?? ''),
    enabled: Boolean(orgUnitId),
  });
  const [chosenAccountId, setChosenAccountId] = useState<string>();
  const accountId =
    chosenAccountId && accounts.data?.some((account) => account.id === chosenAccountId)
      ? chosenAccountId
      : accounts.data?.[0]?.id;
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const book = useQuery({
    queryKey: ['cash-book', accountId, from, to],
    queryFn: () => readCashBook(accountId ?? '', from, to),
    enabled: Boolean(accountId && from && to),
  });
  const data = book.data;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Sổ quỹ</h1>
        <div className="flex flex-wrap items-end gap-4">
          <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
          <label className="flex flex-col gap-2 text-label font-medium text-text">
            Quỹ hoặc tài khoản
            <select
              value={accountId ?? ''}
              onChange={(event) => setChosenAccountId(event.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-content font-normal"
            >
              {(accounts.data ?? []).map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
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
        </div>
        {book.error ? <Alert tone="danger">{messageOf(book.error)}</Alert> : null}
        {accounts.data && accounts.data.length === 0 ? (
          <p className="text-content text-text-secondary">Đơn vị chưa khai báo quỹ hoặc tài khoản.</p>
        ) : null}
        {data ? (
          <section
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
            aria-label="Sổ quỹ theo ngày"
          >
            <div className="flex flex-wrap gap-6 text-content">
              <span>Số dư đầu kỳ {formatMoney(data.opening_balance)}</span>
              <span>Tổng thu {formatMoney(data.total_in)}</span>
              <span>Tổng chi {formatMoney(data.total_out)}</span>
              <span className="font-semibold">Số dư cuối kỳ {formatMoney(data.closing_balance)}</span>
            </div>
            {data.transactions.length === 0 ? (
              <p className="text-content text-text-secondary">Không có giao dịch trong khoảng ngày này.</p>
            ) : (
              <table className="w-full text-content">
                <thead className="text-left text-label font-medium text-text-secondary">
                  <tr>
                    <th className="px-3 py-2">Ngày</th>
                    <th className="px-3 py-2">Số phiếu</th>
                    <th className="px-3 py-2">Diễn giải</th>
                    <th className="px-3 py-2 text-right">Thu</th>
                    <th className="px-3 py-2 text-right">Chi</th>
                    <th className="px-3 py-2 text-right">Tồn</th>
                  </tr>
                </thead>
                <tbody>
                  {data.transactions.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-3 py-2">{row.transaction_date}</td>
                      <td className="px-3 py-2 font-medium">{row.document_code ?? ''}</td>
                      <td className="px-3 py-2">{row.description}</td>
                      <td className="px-3 py-2 text-right">{row.amount > 0 ? formatMoney(row.amount) : ''}</td>
                      <td className="px-3 py-2 text-right">{row.amount < 0 ? formatMoney(-row.amount) : ''}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(row.balance_after)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
