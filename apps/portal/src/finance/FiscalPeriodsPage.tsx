import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, StatusBadge, TextField, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { formatMoney } from '../fees/fees-api.js';
import { AppShell } from '../pages/AppShell.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  approvePeriodClose,
  FISCAL_STATUS_LABELS,
  listFiscalPeriods,
  rejectPeriodClose,
  requestPeriodClose,
  type FiscalPeriodRow,
  type FiscalPeriodStatus,
} from './finance-g2-api.js';

// MH-58 (đề xuất) Chốt kỳ tài chính (P06-09; BR-25, BR-29, BR-77; Q-133; YCTD-82): kế toán trưởng đề nghị chốt tháng đã kết thúc,
// Hiệu trưởng duyệt hoặc từ chối; kỳ đã chốt khóa phiếu thu, phiếu chi, phiếu đảo, hóa đơn của kỳ
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => `${detail.field}: ${detail.message}`)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const STATUS_TONES: Record<FiscalPeriodStatus, 'neutral' | 'warning' | 'success' | 'danger'> = {
  open: 'neutral',
  pending: 'warning',
  closed: 'success',
  rejected: 'danger',
};

export function FiscalPeriodsPage() {
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const canRequest = useHasPermission(PERMISSION_CODES.periodCloseRequest);
  const canApprove = useHasPermission(PERMISSION_CODES.periodCloseApprove);
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const periods = useQuery({
    queryKey: ['fiscal-periods', orgUnitId],
    queryFn: () => listFiscalPeriods(orgUnitId ?? ''),
    enabled: Boolean(orgUnitId),
  });
  const action = useMutation({
    mutationFn: async ({ run }: { run: () => Promise<unknown>; message: string }) => run(),
    onSuccess: async (_result, variables) => {
      setNote('');
      setReason('');
      await queryClient.invalidateQueries({ queryKey: ['fiscal-periods'] });
      setToastMessage(variables.message);
    },
  });
  const actions = (row: FiscalPeriodRow) => {
    if (canRequest && row.can_request && orgUnitId) {
      return (
        <Button
          variant="text"
          onClick={() =>
            action.mutate({
              run: () => requestPeriodClose(orgUnitId, row.period, note),
              message: `Đã đề nghị chốt kỳ ${row.period}`,
            })
          }
        >
          Đề nghị chốt {row.period}
        </Button>
      );
    }
    if (canApprove && row.status === 'pending' && row.id) {
      const id = row.id;
      return (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="text"
            onClick={() => action.mutate({ run: () => approvePeriodClose(id), message: `Đã chốt kỳ ${row.period}` })}
          >
            Duyệt chốt {row.period}
          </Button>
          <Button
            variant="text"
            disabled={!reason.trim()}
            onClick={() =>
              action.mutate({ run: () => rejectPeriodClose(id, reason), message: `Đã từ chối chốt kỳ ${row.period}` })
            }
          >
            Từ chối {row.period}
          </Button>
        </div>
      );
    }
    return null;
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Chốt kỳ tài chính</h1>
        <Toast message={toastMessage} onClose={closeToast} />
        <div className="flex flex-wrap items-end gap-4">
          <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
          {canRequest ? (
            <div className="w-80">
              <TextField label="Ghi chú đề nghị" value={note} onChange={(event) => setNote(event.target.value)} />
            </div>
          ) : null}
          {canApprove ? (
            <div className="w-80">
              <TextField label="Lý do từ chối" value={reason} onChange={(event) => setReason(event.target.value)} />
            </div>
          ) : null}
        </div>
        <p className="text-content text-text-secondary">
          Kỳ đã chốt không lập phiếu thu, phiếu chi có ngày thuộc kỳ, không đảo phiếu, không tính lại, miễn giảm hay
          điều chỉnh hóa đơn của kỳ.
        </p>
        {periods.error ? <Alert tone="danger">{messageOf(periods.error)}</Alert> : null}
        {action.error ? <Alert tone="danger">{messageOf(action.error)}</Alert> : null}
        <section className="rounded-xl border border-border bg-card p-4" aria-label="Kỳ tài chính">
          <table className="w-full text-content">
            <thead className="text-left text-label font-medium text-text-secondary">
              <tr>
                <th className="px-3 py-2">Kỳ</th>
                <th className="px-3 py-2">Trạng thái</th>
                <th className="px-3 py-2 text-right">Thu</th>
                <th className="px-3 py-2 text-right">Chi</th>
                <th className="px-3 py-2 text-right">Hóa đơn</th>
                <th className="px-3 py-2">Ghi chú</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {(periods.data ?? []).map((row) => (
                <tr key={row.period} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{row.period}</td>
                  <td className="px-3 py-2">
                    <StatusBadge tone={STATUS_TONES[row.status]} label={FISCAL_STATUS_LABELS[row.status]} />
                  </td>
                  <td className="px-3 py-2 text-right">{row.summary ? formatMoney(row.summary.receipt_amount) : ''}</td>
                  <td className="px-3 py-2 text-right">{row.summary ? formatMoney(row.summary.payment_amount) : ''}</td>
                  <td className="px-3 py-2 text-right">{row.summary ? formatMoney(row.summary.invoice_amount) : ''}</td>
                  <td className="px-3 py-2">{row.reject_reason ?? row.request_note ?? ''}</td>
                  <td className="px-3 py-2">{actions(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </AppShell>
  );
}
