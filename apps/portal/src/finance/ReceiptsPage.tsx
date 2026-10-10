import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, StatusBadge, TextField } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { formatMoney } from '../fees/fees-api.js';
import { AppShell } from '../pages/AppShell.js';
import { ApiError } from '../session/api-client.js';
import { listReceipts, METHOD_LABELS } from './finance-api.js';

// MH-09 Danh sách phiếu thu (P06-01; BR-28, BR-29; YCTD-53): lọc theo đơn vị và khoảng ngày. Phiếu thu lập từ chi tiết
// công nợ của trẻ để chọn đúng hóa đơn phân bổ; phiếu đã phát hành không xóa được
function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const STATUS_LABELS = { issued: 'Đã phát hành', pending_reversal: 'Chờ duyệt đảo', reversed: 'Đã đảo' } as const;

export function ReceiptsPage() {
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const receipts = useQuery({
    queryKey: ['receipts', orgUnitId, from, to],
    queryFn: () => listReceipts(orgUnitId ?? '', from, to),
    enabled: Boolean(orgUnitId),
  });
  const rows = receipts.data ?? [];

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Phiếu thu</h1>
        <div className="flex flex-wrap items-end gap-4">
          <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
          <div className="w-44">
            <TextField label="Từ ngày" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </div>
          <div className="w-44">
            <TextField label="Đến ngày" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
        </div>
        <p className="text-content text-text-secondary">Lập phiếu thu tại màn hình Công nợ, mục chi tiết của trẻ.</p>
        {receipts.error ? <Alert tone="danger">{messageOf(receipts.error)}</Alert> : null}
        <section
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
          aria-label="Danh sách phiếu thu"
        >
          <div className="flex flex-wrap gap-4 text-content">
            <span>{rows.length} phiếu</span>
            <span>Tổng thu {formatMoney(rows.reduce((sum, row) => sum + row.amount, 0))}</span>
          </div>
          {receipts.data && rows.length === 0 ? (
            <p className="text-content text-text-secondary">Chưa có phiếu thu.</p>
          ) : null}
          {rows.length > 0 ? (
            <table className="w-full text-content">
              <thead className="text-left text-label font-medium text-text-secondary">
                <tr>
                  <th className="px-3 py-2">Số phiếu</th>
                  <th className="px-3 py-2">Ngày thu</th>
                  <th className="px-3 py-2">Trẻ</th>
                  <th className="px-3 py-2">Người nộp</th>
                  <th className="px-3 py-2">Phương thức</th>
                  <th className="px-3 py-2">Tài khoản nhận</th>
                  <th className="px-3 py-2 text-right">Số tiền</th>
                  <th className="px-3 py-2 text-right">Đã phân bổ</th>
                  <th className="px-3 py-2">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{row.code}</td>
                    <td className="px-3 py-2">{row.receipt_date}</td>
                    <td className="px-3 py-2">{row.child_name}</td>
                    <td className="px-3 py-2">{row.payer_name}</td>
                    <td className="px-3 py-2">{METHOD_LABELS[row.method]}</td>
                    <td className="px-3 py-2">{row.account_name}</td>
                    <td className="px-3 py-2 text-right">{formatMoney(row.amount)}</td>
                    <td className="px-3 py-2 text-right">{formatMoney(row.allocated_amount)}</td>
                    <td className="px-3 py-2">
                      <StatusBadge
                        tone={row.status === 'issued' ? 'success' : 'warning'}
                        label={STATUS_LABELS[row.status]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
