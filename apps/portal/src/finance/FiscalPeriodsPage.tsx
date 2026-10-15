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
import {
  approvePeriodClose,
  FISCAL_STATUS_LABELS,
  listFiscalPeriods,
  rejectPeriodClose,
  requestPeriodClose,
  type FiscalPeriodRow,
  type FiscalPeriodStatus,
} from './finance-g2-api.js';

// MH-62 Chốt kỳ tài chính (P06-09; BR-25, BR-29, BR-77; Q-133; YCTD-82): kế toán trưởng đề nghị chốt tháng đã kết thúc,
// Hiệu trưởng duyệt hoặc từ chối; kỳ đã chốt khóa phiếu thu, phiếu chi, phiếu đảo, hóa đơn của kỳ. Danh sách kỳ dùng lưới
// dữ liệu chung (DT-15 phần 15f1)
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

const COLUMNS: Array<DataGridColumn<FiscalPeriodRow>> = [
  { id: 'period', header: 'Kỳ', alwaysVisible: true, className: 'font-medium', cell: (row) => row.period },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: (row) => <StatusBadge tone={STATUS_TONES[row.status]} label={FISCAL_STATUS_LABELS[row.status]} />,
  },
  {
    id: 'receipt_amount',
    header: 'Thu',
    className: 'text-right',
    cell: (row) => (row.summary ? formatMoney(row.summary.receipt_amount) : ''),
  },
  {
    id: 'payment_amount',
    header: 'Chi',
    className: 'text-right',
    cell: (row) => (row.summary ? formatMoney(row.summary.payment_amount) : ''),
  },
  {
    id: 'invoice_amount',
    header: 'Hóa đơn',
    className: 'text-right',
    cell: (row) => (row.summary ? formatMoney(row.summary.invoice_amount) : ''),
  },
  { id: 'note', header: 'Ghi chú', cell: (row) => row.reject_reason ?? row.request_note ?? '' },
];

export function FiscalPeriodsPage() {
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const canRequest = useHasPermission(PERMISSION_CODES.periodCloseRequest);
  const canApprove = useHasPermission(PERMISSION_CODES.periodCloseApprove);
  const queryClient = useQueryClient();
  const grid = useGridSettings('fiscal-periods');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
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
  const rows = (periods.data ?? []).filter(
    (row) => (status === '' || row.status === status) && (search.trim() === '' || row.period.includes(search.trim())),
  );
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
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/fiscal-periods')}</h1>
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
        {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
        <DataGrid
          label="Kỳ tài chính"
          columns={COLUMNS}
          rows={rows}
          getRowId={(row) => row.period}
          getRowLabel={(row) => row.period}
          loading={Boolean(orgUnitId) && periods.isPending}
          emptyText="Chưa có kỳ tài chính."
          search={{ label: 'Tìm theo kỳ', value: search, onChange: setSearch }}
          advancedSearch={
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="text-label font-medium text-text">
                Trạng thái
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className={`mt-1 ${FORM_CONTROL_CLASS}`}
                >
                  <option value="">Tất cả</option>
                  {Object.entries(FISCAL_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          }
          rowActions={actions}
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
      </div>
    </AppShell>
  );
}
