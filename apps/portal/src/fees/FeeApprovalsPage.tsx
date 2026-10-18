import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, StatusBadge, TextField, Toast, type DataGridColumn } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { ApprovalQueueGrid } from '../finance/ApprovalQueueGrid.js';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { formatMoney } from './fees-api.js';
import { decideDocument, listPendingApprovals, type PendingApprovals } from './invoices-api.js';

// MH-07 Miễn giảm và học phí đặc biệt: Ban Giám hiệu duyệt miễn giảm và phiếu điều chỉnh theo hạn mức
// (P05-07, P05-08; BR-77; Q-112; YCTD-52). Phó Hiệu trưởng chỉ thấy khoản dưới hạn mức. Hai danh sách chờ duyệt dùng lưới
// dữ liệu chung (DT-15 phần 15f1)
function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

type PendingDiscount = PendingApprovals['discounts'][number];
type PendingAdjustment = PendingApprovals['adjustments'][number];

const principalBadge = (required: boolean) =>
  required ? <StatusBadge tone="warning" label="Cần Hiệu trưởng duyệt" /> : null;

const DISCOUNT_COLUMNS: Array<DataGridColumn<PendingDiscount>> = [
  {
    id: 'child_name',
    header: 'Học sinh',
    alwaysVisible: true,
    className: 'font-medium',
    cell: (row) => row.child_name,
  },
  { id: 'discount_type_name', header: 'Loại miễn giảm', cell: (row) => row.discount_type_name },
  { id: 'period', header: 'Kỳ', cell: (row) => `${row.period_month}/${row.period_year}` },
  { id: 'applied_amount', header: 'Số tiền', className: 'text-right', cell: (row) => formatMoney(row.applied_amount) },
  { id: 'basis', header: 'Căn cứ', cell: (row) => row.basis },
  { id: 'requires_principal', header: 'Cấp duyệt', cell: (row) => principalBadge(row.requires_principal) },
];

const ADJUSTMENT_COLUMNS: Array<DataGridColumn<PendingAdjustment>> = [
  { id: 'code', header: 'Số phiếu', alwaysVisible: true, className: 'font-medium', cell: (row) => row.code },
  { id: 'invoice_code', header: 'Hóa đơn', cell: (row) => row.invoice_code ?? '' },
  { id: 'child_name', header: 'Học sinh', cell: (row) => row.child_name },
  { id: 'amount', header: 'Số tiền', className: 'text-right', cell: (row) => formatMoney(row.amount) },
  { id: 'reason', header: 'Lý do', cell: (row) => row.reason },
  { id: 'requires_principal', header: 'Cấp duyệt', cell: (row) => principalBadge(row.requires_principal) },
];

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
    <>
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
    </>
  );
  const loading = Boolean(orgUnitId) && pending.isPending;

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/fee-approvals')}</h1>
        <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
        {pending.error ? <Alert tone="danger">{messageOf(pending.error)}</Alert> : null}
        {decide.error ? <Alert tone="danger">{messageOf(decide.error)}</Alert> : null}
        <h2 className="text-section-title font-semibold text-text">Miễn giảm chờ duyệt</h2>
        <ApprovalQueueGrid
          label="Miễn giảm chờ duyệt"
          gridKey="fee-approval-discounts"
          rows={pending.data?.discounts ?? []}
          loading={loading}
          columns={DISCOUNT_COLUMNS}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.child_name}
          searchText={(row) => `${row.child_name} ${row.discount_type_name}`}
          searchLabel="Tìm theo học sinh, loại miễn giảm"
          emptyText="Không có miễn giảm chờ duyệt."
          groupLabel={(row) => `Miễn giảm của ${row.child_name}`}
          renderActions={(row) => actions('discounts', row.id, row.child_name)}
        />
        <h2 className="text-section-title font-semibold text-text">Phiếu điều chỉnh chờ duyệt</h2>
        <ApprovalQueueGrid
          label="Phiếu điều chỉnh chờ duyệt"
          gridKey="fee-approval-adjustments"
          rows={pending.data?.adjustments ?? []}
          loading={loading}
          columns={ADJUSTMENT_COLUMNS}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.code}
          searchText={(row) => `${row.code} ${row.invoice_code ?? ''} ${row.child_name}`}
          searchLabel="Tìm theo số phiếu, hóa đơn, học sinh"
          emptyText="Không có phiếu điều chỉnh chờ duyệt."
          groupLabel={(row) => `Phiếu ${row.code}`}
          renderActions={(row) => actions('invoice-adjustments', row.id, row.code)}
        />
      </div>
    </AppShell>
  );
}
