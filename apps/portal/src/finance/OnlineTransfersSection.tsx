import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, StatusBadge, TextField } from '@school-management/ui';
import { formatMoney } from '../fees/fees-api.js';
import { ApiError } from '../session/api-client.js';
import { listPendingTransfers, resolveTransfer, type OnlineTransfer } from './finance-api.js';

// Giao dịch chuyển khoản trực tuyến không khớp chờ kế toán xử lý (P06-11; QT-04 E10; CTC-P06-062; YCTD-57)
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const REASON_LABELS: Record<OnlineTransfer['match_status'], string> = {
  matched: 'Đã khớp',
  wrong_amount: 'Sai số tiền',
  unknown_invoice: 'Không xác định hóa đơn',
  already_paid: 'Hóa đơn đã thu đủ',
};

export function OnlineTransfersSection({ onResolved }: { onResolved(message: string): void }) {
  const queryClient = useQueryClient();
  const transfers = useQuery({ queryKey: ['online-transfers'], queryFn: listPendingTransfers });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const resolve = useMutation({
    mutationFn: (transferId: string) => resolveTransfer(transferId, notes[transferId] ?? ''),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['online-transfers'] });
      onResolved('Đã ghi xử lý giao dịch');
    },
  });

  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      aria-label="Giao dịch chuyển khoản chờ xử lý"
    >
      <h2 className="text-section-title font-semibold text-text">Giao dịch chuyển khoản chờ xử lý</h2>
      {transfers.error ? <Alert tone="danger">{messageOf(transfers.error)}</Alert> : null}
      {resolve.error ? <Alert tone="danger">{messageOf(resolve.error)}</Alert> : null}
      {transfers.data && transfers.data.length === 0 ? (
        <p className="text-content text-text-secondary">Không có giao dịch chờ xử lý.</p>
      ) : null}
      {(transfers.data ?? []).map((transfer) => (
        <div
          key={transfer.id}
          className="flex flex-col gap-2 border-t border-border pt-3"
          role="group"
          aria-label={`Giao dịch ${transfer.provider_transaction_ref}`}
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-medium">{formatMoney(transfer.amount)}</span>
            <StatusBadge tone="warning" label={REASON_LABELS[transfer.match_status]} />
            <span>{transfer.child_name ?? 'Chưa xác định trẻ'}</span>
            {transfer.invoice_code ? <span>Hóa đơn {transfer.invoice_code}</span> : null}
          </div>
          <span className="text-label text-text-secondary">
            Nội dung: {transfer.transfer_content}; nhận lúc {new Date(transfer.received_at).toLocaleString('vi-VN')}
          </span>
          <div className="flex flex-wrap items-end gap-2">
            <TextField
              label={`Nội dung xử lý giao dịch ${transfer.provider_transaction_ref}`}
              value={notes[transfer.id] ?? ''}
              onChange={(event) => setNotes({ ...notes, [transfer.id]: event.target.value })}
            />
            <Button disabled={resolve.isPending} onClick={() => resolve.mutate(transfer.id)}>
              Ghi đã xử lý
            </Button>
          </div>
        </div>
      ))}
    </section>
  );
}
