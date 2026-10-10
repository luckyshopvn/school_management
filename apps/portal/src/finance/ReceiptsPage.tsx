import { Fragment, useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, StatusBadge, TextField, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { formatMoney } from '../fees/fees-api.js';
import { AppShell } from '../pages/AppShell.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { OnlineTransfersSection } from './OnlineTransfersSection.js';
import { decideReversal, listPendingReversals, listReceipts, METHOD_LABELS, reverseReceipt } from './finance-api.js';

// MH-09 Danh sách phiếu thu (P06-01, P06-03; BR-28, BR-29, BR-77; YCTD-53, YCTD-54): lọc theo đơn vị và khoảng ngày;
// lập phiếu đảo kèm lý do; Ban Giám hiệu duyệt phiếu đảo theo hạn mức. Phiếu thu lập từ chi tiết công nợ của trẻ
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const STATUS_LABELS = { issued: 'Đã phát hành', pending_reversal: 'Chờ duyệt đảo', reversed: 'Đã đảo' } as const;

export function ReceiptsPage() {
  const canReverse = useHasPermission(PERMISSION_CODES.receiptReversalCreate);
  const canApprove = useHasPermission(PERMISSION_CODES.receiptReversalApprove);
  const canCollect = useHasPermission(PERMISSION_CODES.receiptManage);
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const queryClient = useQueryClient();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const receipts = useQuery({
    queryKey: ['receipts', orgUnitId, from, to],
    queryFn: () => listReceipts(orgUnitId ?? '', from, to),
    enabled: Boolean(orgUnitId),
  });
  const pending = useQuery({
    queryKey: ['receipt-reversals', orgUnitId],
    queryFn: () => listPendingReversals(orgUnitId ?? ''),
    enabled: Boolean(orgUnitId) && canApprove,
  });
  const [reversingId, setReversingId] = useState<string>();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['receipts'] });
    await queryClient.invalidateQueries({ queryKey: ['receipt-reversals'] });
  };
  const reverse = useMutation({
    mutationFn: (receiptId: string) => reverseReceipt(receiptId, reasons[receiptId] ?? ''),
    onSuccess: async (reversal) => {
      setReversingId(undefined);
      await refresh();
      setToastMessage(`Đã lập phiếu đảo ${reversal.code}, chờ Ban Giám hiệu duyệt`);
    },
  });
  const decide = useMutation({
    mutationFn: (input: { receiptId: string; approve: boolean }) =>
      decideReversal(input.receiptId, input.approve, reasons[input.receiptId] ?? ''),
    onSuccess: async (_result, input) => {
      await refresh();
      setToastMessage(input.approve ? 'Đã duyệt phiếu đảo' : 'Đã từ chối phiếu đảo');
    },
  });
  const rows = receipts.data ?? [];

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
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
        {reverse.error ? <Alert tone="danger">{messageOf(reverse.error)}</Alert> : null}
        {decide.error ? <Alert tone="danger">{messageOf(decide.error)}</Alert> : null}
        {canCollect ? <OnlineTransfersSection onResolved={setToastMessage} /> : null}
        {canApprove ? (
          <section
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
            aria-label="Phiếu đảo chờ duyệt"
          >
            <h2 className="text-section-title font-semibold text-text">Phiếu đảo chờ duyệt</h2>
            {pending.data && pending.data.length === 0 ? (
              <p className="text-content text-text-secondary">Không có phiếu đảo chờ duyệt.</p>
            ) : null}
            {(pending.data ?? []).map((reversal) => (
              <div
                key={reversal.id}
                className="flex flex-col gap-2 border-t border-border pt-3"
                role="group"
                aria-label={`Phiếu đảo ${reversal.code}`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium">
                    {reversal.code}: đảo {reversal.receipt_code} của {reversal.child_name}
                  </span>
                  <span>{formatMoney(reversal.amount)}</span>
                  {reversal.requires_principal ? <StatusBadge tone="warning" label="Cần Hiệu trưởng duyệt" /> : null}
                </div>
                <span className="text-label text-text-secondary">Lý do: {reversal.reason}</span>
                <div className="flex flex-wrap items-end gap-2">
                  <Button
                    variant="primary"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ receiptId: reversal.receipt_id, approve: true })}
                  >
                    Duyệt
                  </Button>
                  <TextField
                    label={`Lý do từ chối ${reversal.code}`}
                    value={reasons[reversal.receipt_id] ?? ''}
                    onChange={(event) => setReasons({ ...reasons, [reversal.receipt_id]: event.target.value })}
                  />
                  <Button
                    variant="danger"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ receiptId: reversal.receipt_id, approve: false })}
                  >
                    Từ chối
                  </Button>
                </div>
              </div>
            ))}
          </section>
        ) : null}
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
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <Fragment key={row.id}>
                    <tr className="border-t border-border" aria-label={`Phiếu thu ${row.code}`}>
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
                      <td className="px-3 py-2 text-right">
                        {canReverse && row.status === 'issued' ? (
                          <Button
                            variant="text"
                            onClick={() => setReversingId(reversingId === row.id ? undefined : row.id)}
                          >
                            Lập phiếu đảo
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                    {reversingId === row.id ? (
                      <tr>
                        <td colSpan={10} className="px-3 pb-3">
                          <div className="flex flex-wrap items-end gap-2">
                            <TextField
                              label={`Lý do đảo ${row.code}`}
                              value={reasons[row.id] ?? ''}
                              onChange={(event) => setReasons({ ...reasons, [row.id]: event.target.value })}
                            />
                            <Button
                              variant="primary"
                              disabled={reverse.isPending}
                              onClick={() => reverse.mutate(row.id)}
                            >
                              Gửi duyệt phiếu đảo
                            </Button>
                          </div>
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
