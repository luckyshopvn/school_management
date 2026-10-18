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
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
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

// MH-06 Bảng tính học phí và phát hành khoản phải thu (P05-05, P05-06; QT-03 bước 4 đến 9; YCTD-51). Bảng tính dùng lưới
// dữ liệu chung: tìm theo học sinh, số hóa đơn; Mở rộng tìm kiếm theo loại, trạng thái; chi tiết mở dưới dòng (DT-15 phần
// 15f1)
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.slice(0, 10).map((detail) => `${detail.field} ${detail.message}`)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

function previousMonth(): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  return new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 2, 1)).toISOString().slice(0, 7);
}

const COLUMNS: Array<DataGridColumn<Invoice>> = [
  {
    id: 'child_name',
    header: 'Học sinh',
    alwaysVisible: true,
    className: 'font-medium',
    cell: (row) => row.child_name,
  },
  { id: 'invoice_kind', header: 'Loại', cell: (row) => (row.invoice_kind === 'main' ? 'Chính' : 'Bổ sung') },
  { id: 'code', header: 'Số hóa đơn', cell: (row) => row.code ?? <StatusBadge tone="warning" label="Nháp" /> },
  {
    id: 'days',
    header: 'Ngày học',
    cell: (row) => `${row.basis.present_days ?? '-'}/${row.basis.school_days ?? '-'}`,
  },
  { id: 'total_amount', header: 'Tổng', className: 'text-right', cell: (row) => formatMoney(row.total_amount) },
  { id: 'payable_amount', header: 'Phải nộp', className: 'text-right', cell: (row) => formatMoney(row.payable_amount) },
  {
    id: 'review_flags',
    header: 'Cần xem lại',
    cell: (row) => row.review_flags.map((flag) => REVIEW_FLAG_LABELS[flag] ?? flag).join(', '),
  },
];

export function InvoicesPage() {
  const canManage = useHasPermission(PERMISSION_CODES.feeCalculationManage);
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const grid = useGridSettings('invoices');
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
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('');
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

  const allRows = invoices.data ?? [];
  const hasDraft = allRows.some((row) => row.status === 'draft');
  const total = allRows.reduce((sum, row) => sum + row.total_amount, 0);
  const issuedMainChildren = new Set(
    allRows.filter((row) => row.invoice_kind === 'main' && row.status === 'issued').map((row) => row.child_id),
  );
  const keyword = search.trim().toLocaleLowerCase('vi');
  const rows = allRows.filter(
    (row) =>
      (kind === '' || row.invoice_kind === kind) &&
      (status === '' || row.status === status) &&
      (keyword === '' || `${row.child_name} ${row.code ?? ''}`.toLocaleLowerCase('vi').includes(keyword)),
  );

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/invoices')}</h1>
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
        {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
        <div className="flex flex-wrap items-center gap-3 text-content">
          <span>{allRows.length} hóa đơn</span>
          <span>Tổng {formatMoney(total)}</span>
          {hasDraft ? <StatusBadge tone="warning" label="Còn hóa đơn nháp" /> : null}
        </div>
        <DataGrid
          label="Bảng tính học phí"
          columns={COLUMNS}
          rows={rows}
          getRowId={(row) => row.id}
          getRowLabel={(row) => `${row.child_name} ${row.code ?? ''}`.trim()}
          getRowAriaLabel={(row) => `Hóa đơn ${row.child_name}`}
          loading={Boolean(orgUnitId && period) && invoices.isPending}
          emptyText="Chưa có hóa đơn của kỳ này."
          search={{ label: 'Tìm theo học sinh, số hóa đơn', value: search, onChange: setSearch }}
          advancedSearch={
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="text-label font-medium text-text">
                Loại hóa đơn
                <select
                  value={kind}
                  onChange={(event) => setKind(event.target.value)}
                  className={`mt-1 ${FORM_CONTROL_CLASS}`}
                >
                  <option value="">Tất cả</option>
                  <option value="main">Chính</option>
                  <option value="supplementary">Bổ sung</option>
                </select>
              </label>
              <label className="text-label font-medium text-text">
                Trạng thái
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className={`mt-1 ${FORM_CONTROL_CLASS}`}
                >
                  <option value="">Tất cả</option>
                  <option value="draft">Nháp</option>
                  <option value="issued">Đã phát hành</option>
                </select>
              </label>
            </div>
          }
          rowActions={(row) => (
            <span className="flex flex-wrap justify-end gap-1 whitespace-nowrap">
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
            </span>
          )}
          activeRowId={openId}
          renderRowDetail={(row) => (openId === row.id ? <InvoiceDetailPanel invoiceId={row.id} /> : null)}
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
      </div>
    </AppShell>
  );
}
