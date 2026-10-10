import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, StatusBadge, TextField, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { ApiError } from '../session/api-client.js';
import { formatMoney } from './fees-api.js';
import { decideDocument, listPendingApprovals } from './invoices-api.js';

// MH-07 Miễn giảm và học phí đặc biệt: Ban Giám hiệu duyệt miễn giảm và phiếu điều chỉnh theo hạn mức
// (P05-07, P05-08; BR-77; Q-112; YCTD-52). Phó Hiệu trưởng chỉ thấy khoản dưới hạn mức
function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

export function FeeApprovalsPage() {
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const queryClient = useQueryClient();
  const pending = useQuery({
    queryKey: ['fee-approvals', orgUnitId],
    queryFn: () => listPendingApprovals(orgUnitId ?? ''),
    enabled: Boolean(orgUnitId),
  });
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const decide = useMutation({
    mutationFn: (input: { kind: 'discounts' | 'invoice-adjustments'; id: string; approve: boolean }) =>
      decideDocument(input.kind, input.id, input.approve, reasons[input.id] ?? ''),
    onSuccess: async (_result, input) => {
      await queryClient.invalidateQueries({ queryKey: ['fee-approvals'] });
      setToastMessage(input.approve ? 'Đã duyệt' : 'Đã từ chối');
    },
  });

  const actions = (kind: 'discounts' | 'invoice-adjustments', id: string, label: string) => (
    <div className="flex flex-wrap items-end gap-2">
      <Button variant="primary" disabled={decide.isPending} onClick={() => decide.mutate({ kind, id, approve: true })}>
        Duyệt
      </Button>
      <TextField
        label={`Lý do từ chối ${label}`}
        value={reasons[id] ?? ''}
        onChange={(event) => setReasons({ ...reasons, [id]: event.target.value })}
      />
      <Button variant="danger" disabled={decide.isPending} onClick={() => decide.mutate({ kind, id, approve: false })}>
        Từ chối
      </Button>
    </div>
  );

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Duyệt miễn giảm và điều chỉnh</h1>
        <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
        {pending.error ? <Alert tone="danger">{messageOf(pending.error)}</Alert> : null}
        {decide.error ? <Alert tone="danger">{messageOf(decide.error)}</Alert> : null}
        <section
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
          aria-label="Miễn giảm chờ duyệt"
        >
          <h2 className="text-section-title font-semibold text-text">Miễn giảm chờ duyệt</h2>
          {pending.data && pending.data.discounts.length === 0 ? (
            <p className="text-content text-text-secondary">Không có miễn giảm chờ duyệt.</p>
          ) : null}
          {(pending.data?.discounts ?? []).map((row) => (
            <div
              key={row.id}
              className="flex flex-col gap-2 border-t border-border pt-3"
              role="group"
              aria-label={`Miễn giảm của ${row.child_name}`}
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-medium">
                  {row.child_name}: {row.discount_type_name} kỳ {row.period_month}/{row.period_year}
                </span>
                <span>{formatMoney(row.applied_amount)}</span>
                {row.requires_principal ? <StatusBadge tone="warning" label="Cần Hiệu trưởng duyệt" /> : null}
              </div>
              <span className="text-label text-text-secondary">Căn cứ: {row.basis}</span>
              {actions('discounts', row.id, row.child_name)}
            </div>
          ))}
        </section>
        <section
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
          aria-label="Phiếu điều chỉnh chờ duyệt"
        >
          <h2 className="text-section-title font-semibold text-text">Phiếu điều chỉnh chờ duyệt</h2>
          {pending.data && pending.data.adjustments.length === 0 ? (
            <p className="text-content text-text-secondary">Không có phiếu điều chỉnh chờ duyệt.</p>
          ) : null}
          {(pending.data?.adjustments ?? []).map((row) => (
            <div
              key={row.id}
              className="flex flex-col gap-2 border-t border-border pt-3"
              role="group"
              aria-label={`Phiếu ${row.code}`}
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-medium">
                  {row.code}: hóa đơn {row.invoice_code ?? ''} của {row.child_name}
                </span>
                <span>{formatMoney(row.amount)}</span>
                {row.requires_principal ? <StatusBadge tone="warning" label="Cần Hiệu trưởng duyệt" /> : null}
              </div>
              <span className="text-label text-text-secondary">Lý do: {row.reason}</span>
              {actions('invoice-adjustments', row.id, row.code)}
            </div>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
