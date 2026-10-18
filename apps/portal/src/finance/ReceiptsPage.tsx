import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import {
  Alert,
  Button,
  DataGrid,
  FORM_CONTROL_CLASS,
  StatusBadge,
  TextField,
  Toast,
  type DataGridColumn,
} from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { formatMoney } from '../fees/fees-api.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { ApprovalQueueGrid } from './ApprovalQueueGrid.js';
import { OnlineTransfersSection } from './OnlineTransfersSection.js';
import {
  decideReversal,
  listPendingReversals,
  listReceipts,
  METHOD_LABELS,
  reverseReceipt,
  type Receipt,
  type ReceiptReversal,
} from './finance-api.js';

// MH-09 Danh sách phiếu thu (P06-01, P06-03; BR-28, BR-29, BR-77; YCTD-53, YCTD-54): lọc theo đơn vị và khoảng ngày;
// lập phiếu đảo kèm lý do; Ban Giám hiệu duyệt phiếu đảo theo hạn mức. Phiếu thu lập từ chi tiết công nợ của trẻ. Danh
// sách phiếu thu và phiếu đảo chờ duyệt dùng lưới dữ liệu chung, khoảng ngày ở Mở rộng tìm kiếm (DT-15 phần 15f1)
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const STATUS_LABELS = { issued: 'Đã phát hành', pending_reversal: 'Chờ duyệt đảo', reversed: 'Đã đảo' } as const;

const RECEIPT_COLUMNS: Array<DataGridColumn<Receipt>> = [
  { id: 'code', header: 'Số phiếu', alwaysVisible: true, className: 'font-medium', cell: (row) => row.code },
  { id: 'receipt_date', header: 'Ngày thu', cell: (row) => row.receipt_date },
  { id: 'child_name', header: 'Học sinh', cell: (row) => row.child_name },
  { id: 'payer_name', header: 'Người nộp', cell: (row) => row.payer_name },
  { id: 'method', header: 'Phương thức', cell: (row) => METHOD_LABELS[row.method] },
  { id: 'account_name', header: 'Tài khoản nhận', cell: (row) => row.account_name },
  { id: 'amount', header: 'Số tiền', className: 'text-right', cell: (row) => formatMoney(row.amount) },
  {
    id: 'allocated_amount',
    header: 'Đã phân bổ',
    className: 'text-right',
    cell: (row) => formatMoney(row.allocated_amount),
  },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: (row) => (
      <StatusBadge tone={row.status === 'issued' ? 'success' : 'warning'} label={STATUS_LABELS[row.status]} />
    ),
  },
];

const REVERSAL_COLUMNS: Array<DataGridColumn<ReceiptReversal>> = [
  { id: 'code', header: 'Số phiếu đảo', alwaysVisible: true, className: 'font-medium', cell: (row) => row.code },
  { id: 'receipt_code', header: 'Phiếu thu gốc', cell: (row) => row.receipt_code },
  { id: 'child_name', header: 'Học sinh', cell: (row) => row.child_name },
  { id: 'amount', header: 'Số tiền', className: 'text-right', cell: (row) => formatMoney(row.amount) },
  { id: 'reason', header: 'Lý do', cell: (row) => row.reason },
  {
    id: 'requires_principal',
    header: 'Cấp duyệt',
    cell: (row) => (row.requires_principal ? <StatusBadge tone="warning" label="Cần Hiệu trưởng duyệt" /> : null),
  },
];

export function ReceiptsPage() {
  const canReverse = useHasPermission(PERMISSION_CODES.receiptReversalCreate);
  const canApprove = useHasPermission(PERMISSION_CODES.receiptReversalApprove);
  const canCollect = useHasPermission(PERMISSION_CODES.receiptManage);
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const queryClient = useQueryClient();
  const grid = useGridSettings('receipts');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
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
  const allRows = receipts.data ?? [];
  const keyword = search.trim().toLocaleLowerCase('vi');
  const rows = allRows.filter(
    (row) =>
      (status === '' || row.status === status) &&
      (keyword === '' || `${row.code} ${row.child_name} ${row.payer_name}`.toLocaleLowerCase('vi').includes(keyword)),
  );

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/receipts')}</h1>
        <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
        <p className="text-content text-text-secondary">
          Lập phiếu thu tại màn hình Công nợ, mục chi tiết của học sinh.
        </p>
        {receipts.error ? <Alert tone="danger">{messageOf(receipts.error)}</Alert> : null}
        {reverse.error ? <Alert tone="danger">{messageOf(reverse.error)}</Alert> : null}
        {decide.error ? <Alert tone="danger">{messageOf(decide.error)}</Alert> : null}
        {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
        {canCollect ? <OnlineTransfersSection onResolved={setToastMessage} /> : null}
        {canApprove ? (
          <div className="flex flex-col gap-3">
            <h2 className="text-section-title font-semibold text-text">Phiếu đảo chờ duyệt</h2>
            <ApprovalQueueGrid
              label="Phiếu đảo chờ duyệt"
              gridKey="receipt-reversals"
              rows={pending.data ?? []}
              loading={Boolean(orgUnitId) && pending.isPending}
              columns={REVERSAL_COLUMNS}
              getRowId={(row) => row.id}
              getRowLabel={(row) => row.code}
              searchText={(row) => `${row.code} ${row.receipt_code} ${row.child_name}`}
              searchLabel="Tìm theo số phiếu, học sinh"
              emptyText="Không có phiếu đảo chờ duyệt."
              groupLabel={(row) => `Phiếu đảo ${row.code}`}
              renderActions={(reversal) => (
                <>
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
                </>
              )}
            />
          </div>
        ) : null}
        <div className="flex flex-wrap gap-4 text-content">
          <span>{allRows.length} phiếu</span>
          <span>Tổng thu {formatMoney(allRows.reduce((sum, row) => sum + row.amount, 0))}</span>
        </div>
        <DataGrid
          label="Danh sách phiếu thu"
          columns={RECEIPT_COLUMNS}
          rows={rows}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.code}
          getRowAriaLabel={(row) => `Phiếu thu ${row.code}`}
          loading={Boolean(orgUnitId) && receipts.isPending}
          emptyText="Chưa có phiếu thu."
          search={{ label: 'Tìm theo số phiếu, học sinh, người nộp', value: search, onChange: setSearch }}
          advancedSearch={
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <TextField label="Từ ngày" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
              <TextField label="Đến ngày" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
              <label className="text-label font-medium text-text">
                Trạng thái
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className={`mt-1 ${FORM_CONTROL_CLASS}`}
                >
                  <option value="">Tất cả</option>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          }
          rowActions={
            canReverse
              ? (row) =>
                  row.status === 'issued' ? (
                    <Button variant="text" onClick={() => setReversingId(reversingId === row.id ? undefined : row.id)}>
                      Lập phiếu đảo
                    </Button>
                  ) : null
              : undefined
          }
          activeRowId={reversingId}
          renderRowDetail={(row) =>
            reversingId === row.id ? (
              <div className="flex flex-wrap items-end gap-2">
                <TextField
                  label={`Lý do đảo ${row.code}`}
                  value={reasons[row.id] ?? ''}
                  onChange={(event) => setReasons({ ...reasons, [row.id]: event.target.value })}
                />
                <Button variant="primary" disabled={reverse.isPending} onClick={() => reverse.mutate(row.id)}>
                  Gửi duyệt phiếu đảo
                </Button>
              </div>
            ) : null
          }
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
      </div>
    </AppShell>
  );
}
