import { Fragment, useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, StatusBadge, TextField, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { formatMoney } from './fees-api.js';
import {
  calculateFees,
  issueInvoices,
  issueSupplementary,
  listInvoices,
  REVIEW_FLAG_LABELS,
  type Invoice,
} from './invoices-api.js';
import { InvoiceDetailPanel } from './InvoiceDetailPanel.js';
import { listPeriods } from './registrations-api.js';

// MH-06 Bảng tính học phí và phát hành khoản phải thu (P05-05, P05-06; QT-03 bước 4 đến 9; YCTD-51)
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.slice(0, 10).map((detail) => `${detail.field} ${detail.message}`)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

function previousMonth(): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  return new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 2, 1)).toISOString().slice(0, 7);
}

export function InvoicesPage() {
  const canManage = useHasPermission(PERMISSION_CODES.feeCalculationManage);
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const periods = useQuery({ queryKey: ['registration-periods'], queryFn: listPeriods });
  const [chosenPeriod, setChosenPeriod] = useState<string>();
  const period =
    chosenPeriod ?? periods.data?.find((item) => item.period === previousMonth())?.period ?? periods.data?.[0]?.period;
  const queryClient = useQueryClient();
  const invoices = useQuery({
    queryKey: ['invoices', orgUnitId, period],
    queryFn: () => listInvoices(orgUnitId ?? '', period ?? ''),
    enabled: Boolean(orgUnitId && period),
  });
  const [dueDate, setDueDate] = useState('');
  const [openId, setOpenId] = useState<string>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);

  const action = useMutation({
    mutationFn: (input: { kind: 'calculate' | 'issue' | 'supplementary'; childId?: string }) =>
      input.kind === 'calculate'
        ? calculateFees(orgUnitId ?? '', period ?? '')
        : input.kind === 'issue'
          ? issueInvoices(orgUnitId ?? '', period ?? '', dueDate)
          : issueSupplementary(input.childId ?? '', period ?? '', dueDate),
    onSuccess: async (_result, input) => {
      await queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setToastMessage(
        input.kind === 'calculate'
          ? 'Đã tính học phí'
          : input.kind === 'issue'
            ? 'Đã phát hành hóa đơn'
            : 'Đã lập hóa đơn bổ sung',
      );
    },
  });

  const rows = invoices.data ?? [];
  const hasDraft = rows.some((row) => row.status === 'draft');
  const total = rows.reduce((sum, row) => sum + row.total_amount, 0);
  const issuedMainChildren = new Set(
    rows.filter((row) => row.invoice_kind === 'main' && row.status === 'issued').map((row) => row.child_id),
  );

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Học phí</h1>
        <div className="flex flex-wrap items-end gap-4">
          <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
          <label className="flex flex-col gap-2 text-label font-medium text-text">
            Kỳ
            <select
              value={period ?? ''}
              onChange={(event) => setChosenPeriod(event.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-content font-normal"
            >
              {(periods.data ?? []).map((item) => (
                <option key={item.period} value={item.period}>
                  {item.period}
                  {item.is_summer ? ' (hè)' : ''}
                </option>
              ))}
            </select>
          </label>
          {canManage ? (
            <>
              <Button disabled={action.isPending} onClick={() => action.mutate({ kind: 'calculate' })}>
                Tính học phí
              </Button>
              <div className="w-48">
                <TextField
                  label="Ngày đến hạn"
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </div>
              <Button
                variant="primary"
                disabled={action.isPending || !hasDraft}
                onClick={() => action.mutate({ kind: 'issue' })}
              >
                Phát hành hóa đơn
              </Button>
            </>
          ) : null}
        </div>
        {action.error ? <Alert tone="danger">{messageOf(action.error)}</Alert> : null}
        {invoices.error ? <Alert tone="danger">{messageOf(invoices.error)}</Alert> : null}
        <section
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
          aria-label="Bảng tính học phí"
        >
          <div className="flex flex-wrap items-center gap-3 text-content">
            <span>{rows.length} hóa đơn</span>
            <span>Tổng {formatMoney(total)}</span>
            {hasDraft ? <StatusBadge tone="warning" label="Còn hóa đơn nháp" /> : null}
          </div>
          {invoices.data && rows.length === 0 ? (
            <p className="text-content text-text-secondary">Chưa có hóa đơn của kỳ này.</p>
          ) : null}
          {rows.length > 0 ? (
            <table className="w-full text-content">
              <thead className="text-left text-label font-medium text-text-secondary">
                <tr>
                  <th className="px-3 py-2">Trẻ</th>
                  <th className="px-3 py-2">Loại</th>
                  <th className="px-3 py-2">Số hóa đơn</th>
                  <th className="px-3 py-2">Ngày học</th>
                  <th className="px-3 py-2 text-right">Tổng</th>
                  <th className="px-3 py-2 text-right">Phải nộp</th>
                  <th className="px-3 py-2">Cần xem lại</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row: Invoice) => (
                  <Fragment key={row.id}>
                    <tr className="border-t border-border" aria-label={`Hóa đơn ${row.child_name}`}>
                      <td className="px-3 py-2 font-medium">{row.child_name}</td>
                      <td className="px-3 py-2">{row.invoice_kind === 'main' ? 'Chính' : 'Bổ sung'}</td>
                      <td className="px-3 py-2">{row.code ?? <StatusBadge tone="warning" label="Nháp" />}</td>
                      <td className="px-3 py-2">
                        {row.basis.present_days ?? '-'}/{row.basis.school_days ?? '-'}
                      </td>
                      <td className="px-3 py-2 text-right">{formatMoney(row.total_amount)}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(row.payable_amount)}</td>
                      <td className="px-3 py-2">
                        {row.review_flags.map((flag) => REVIEW_FLAG_LABELS[flag] ?? flag).join(', ')}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right">
                        <Button variant="text" onClick={() => setOpenId(openId === row.id ? undefined : row.id)}>
                          {openId === row.id ? 'Ẩn' : 'Chi tiết'}
                        </Button>
                        {canManage && row.invoice_kind === 'main' && issuedMainChildren.has(row.child_id) ? (
                          <Button
                            variant="text"
                            disabled={action.isPending}
                            onClick={() => action.mutate({ kind: 'supplementary', childId: row.child_id })}
                          >
                            Lập hóa đơn bổ sung
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                    {openId === row.id ? (
                      <tr>
                        <td colSpan={8} className="px-3 pb-3">
                          <InvoiceDetailPanel invoiceId={row.id} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
