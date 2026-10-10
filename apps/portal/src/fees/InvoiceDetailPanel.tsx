import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, StatusBadge, TextField } from '@school-management/ui';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { formatMoney, listDiscountTypes } from './fees-api.js';
import {
  copyPreviousDiscounts,
  createAdjustment,
  createDiscount,
  FEE_DOCUMENT_STATUS_LABELS,
  readInvoice,
  type FeeDocumentStatus,
} from './invoices-api.js';

// Chi tiết hóa đơn trong MH-06 và MH-07: các dòng khoản phải thu, miễn giảm, phiếu điều chỉnh, số phải nộp; kế toán lập
// miễn giảm và phiếu điều chỉnh (P05-07, P05-08; BR-20 đến BR-22, BR-25; YCTD-52)
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const toneOf = (status: FeeDocumentStatus) =>
  status === 'approved' ? ('success' as const) : status === 'pending' ? ('warning' as const) : ('neutral' as const);

export function InvoiceDetailPanel({ invoiceId }: { invoiceId: string }) {
  const canDiscount = useHasPermission(PERMISSION_CODES.discountManage);
  const canAdjust = useHasPermission(PERMISSION_CODES.invoiceAdjustmentCreate);
  const queryClient = useQueryClient();
  const invoice = useQuery({ queryKey: ['invoice', invoiceId], queryFn: () => readInvoice(invoiceId) });
  const discountTypes = useQuery({
    queryKey: ['discount-types'],
    queryFn: listDiscountTypes,
    enabled: canDiscount,
  });
  const [discountForm, setDiscountForm] = useState({ typeId: '', basis: '' });
  const [adjustmentForm, setAdjustmentForm] = useState({ amount: '', reason: '' });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
    await queryClient.invalidateQueries({ queryKey: ['invoices'] });
  };
  const action = useMutation({
    mutationFn: (kind: 'discount' | 'copy' | 'adjustment') =>
      kind === 'discount'
        ? createDiscount(invoiceId, discountForm.typeId, discountForm.basis)
        : kind === 'copy'
          ? copyPreviousDiscounts(invoiceId)
          : createAdjustment(invoiceId, Number(adjustmentForm.amount), adjustmentForm.reason),
    onSuccess: async (_result, kind) => {
      if (kind === 'discount') {
        setDiscountForm({ typeId: '', basis: '' });
      }
      if (kind === 'adjustment') {
        setAdjustmentForm({ amount: '', reason: '' });
      }
      await refresh();
    },
  });

  if (!invoice.data) {
    return <div className="h-12 animate-pulse rounded bg-border" aria-hidden="true" />;
  }
  const data = invoice.data;
  return (
    <div className="flex flex-col gap-3" role="group" aria-label={`Chi tiết hóa đơn của ${data.child_name}`}>
      <table className="w-full text-content">
        <tbody>
          {data.items.map((item) => (
            <tr key={item.id} className="border-t border-border">
              <td className="px-3 py-1">{item.description}</td>
              <td className="px-3 py-1 text-text-secondary">{item.basis_note ?? ''}</td>
              <td className="px-3 py-1 text-right">{formatMoney(item.amount)}</td>
            </tr>
          ))}
          {data.discounts.map((discount) => (
            <tr key={discount.id} className="border-t border-border">
              <td className="px-3 py-1">Miễn giảm: {discount.discount_type_name}</td>
              <td className="px-3 py-1 text-text-secondary">
                {discount.basis}{' '}
                <StatusBadge tone={toneOf(discount.status)} label={FEE_DOCUMENT_STATUS_LABELS[discount.status]} />
                {discount.status === 'pending' && discount.requires_principal ? ' Cần Hiệu trưởng duyệt' : ''}
                {discount.reject_reason ? ` (${discount.reject_reason})` : ''}
              </td>
              <td className="px-3 py-1 text-right">−{formatMoney(discount.applied_amount)}</td>
            </tr>
          ))}
          {data.adjustments.map((adjustment) => (
            <tr key={adjustment.id} className="border-t border-border">
              <td className="px-3 py-1">Điều chỉnh {adjustment.code}</td>
              <td className="px-3 py-1 text-text-secondary">
                {adjustment.reason}{' '}
                <StatusBadge tone={toneOf(adjustment.status)} label={FEE_DOCUMENT_STATUS_LABELS[adjustment.status]} />
                {adjustment.reject_reason ? ` (${adjustment.reject_reason})` : ''}
              </td>
              <td className="px-3 py-1 text-right">{formatMoney(adjustment.amount)}</td>
            </tr>
          ))}
          <tr className="border-t border-border font-semibold">
            <td className="px-3 py-1">Số phải nộp</td>
            <td className="px-3 py-1 text-text-secondary">Tính miễn giảm và điều chỉnh đã duyệt</td>
            <td className="px-3 py-1 text-right">{formatMoney(data.payable_amount)}</td>
          </tr>
        </tbody>
      </table>
      {action.error ? <Alert tone="danger">{messageOf(action.error)}</Alert> : null}
      {canDiscount ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-label font-medium text-text">
            Loại miễn giảm
            <select
              value={discountForm.typeId}
              onChange={(event) => setDiscountForm({ ...discountForm, typeId: event.target.value })}
              className="mt-1 block rounded-lg border border-border bg-card px-3 py-2 text-content font-normal"
            >
              <option value="">Chọn loại</option>
              {(discountTypes.data ?? [])
                .filter((type) => type.status === 'active')
                .map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
            </select>
          </label>
          <TextField
            label="Căn cứ miễn giảm"
            value={discountForm.basis}
            onChange={(event) => setDiscountForm({ ...discountForm, basis: event.target.value })}
          />
          <Button disabled={action.isPending} onClick={() => action.mutate('discount')}>
            Lập miễn giảm
          </Button>
          {data.invoice_kind === 'main' ? (
            <Button variant="text" disabled={action.isPending} onClick={() => action.mutate('copy')}>
              Chép miễn giảm kỳ trước
            </Button>
          ) : null}
        </div>
      ) : null}
      {canAdjust && data.status === 'issued' ? (
        <div className="flex flex-wrap items-end gap-3">
          <TextField
            label="Số tiền điều chỉnh (âm là giảm)"
            type="number"
            value={adjustmentForm.amount}
            onChange={(event) => setAdjustmentForm({ ...adjustmentForm, amount: event.target.value })}
          />
          <TextField
            label="Lý do điều chỉnh"
            value={adjustmentForm.reason}
            onChange={(event) => setAdjustmentForm({ ...adjustmentForm, reason: event.target.value })}
          />
          <Button disabled={action.isPending} onClick={() => action.mutate('adjustment')}>
            Lập phiếu điều chỉnh
          </Button>
        </div>
      ) : null}
    </div>
  );
}
