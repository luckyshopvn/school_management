import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import {
  Alert,
  Button,
  DataGrid,
  FORM_CONTROL_CLASS,
  FormBlock,
  FormRow,
  Toast,
  type DataGridColumn,
} from '@school-management/ui';
import { useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { FormButtons, FormPanel } from '../pages/FormPanel.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { matchesSearch } from '../pages/grid-search.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import {
  formatMoney,
  getJson,
  messageOf,
  postJson,
  REQUEST_STATUS_LABELS,
  vietnamToday,
  type PurchaseRequest,
} from './inventory-api.js';

// MH-21 Đề nghị mua hàng (P13-05; BR-63; YCTD-77): mọi nhân sự lập và xem đề nghị của mình; Ban Giám hiệu thấy đề nghị
// chờ duyệt trong phạm vi, Phó Hiệu trưởng chỉ thấy đề nghị dưới hạn mức, duyệt hoặc từ chối kèm lý do. Giao diện chung
// theo Sở (DT-15 phần 15f3, YCTD-115): lưới đề nghị của tôi (khóa `my-purchase-requests`) và lưới chờ duyệt (khóa
// `purchase-requests`); Thêm mới mở biểu mẫu theo khối có nút Ghi
type Tab = 'mine' | 'pending';
interface Line {
  item_name: string;
  quantity: string;
  unit: string;
  estimated_price: string;
}
const emptyLine = (): Line => ({ item_name: '', quantity: '1', unit: '', estimated_price: '' });
const filterClass = `mt-1 ${FORM_CONTROL_CLASS}`;

const REQUEST_COLUMNS: Array<DataGridColumn<PurchaseRequest>> = [
  { id: 'code', header: 'Mã', alwaysVisible: true, className: 'font-medium', cell: (row) => row.code },
  { id: 'requester_name', header: 'Người đề nghị', cell: (row) => row.requester_name },
  { id: 'reason', header: 'Lý do', cell: (row) => row.reason },
  { id: 'needed_by', header: 'Thời hạn cần', cell: (row) => row.needed_by },
  { id: 'total_amount', header: 'Giá trị', cell: (row) => formatMoney(row.total_amount) },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: (row) =>
      `${REQUEST_STATUS_LABELS[row.status]}${row.status === 'pending' && row.requires_principal ? ' (Hiệu trưởng duyệt)' : ''}${row.reject_reason ? `. Lý do: ${row.reject_reason}` : ''}`,
  },
];

export function PurchaseRequestsPage() {
  const canCreate = useHasPermission(PERMISSION_CODES.purchaseRequestCreate);
  const canApprove = useHasPermission(PERMISSION_CODES.purchaseRequestApprove);
  const [tab, setTab] = useState<Tab>('mine');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const tabs: Array<[Tab, string]> = [
    ...(canCreate ? [['mine', 'Đề nghị của tôi'] as [Tab, string]] : []),
    ...(canApprove ? [['pending', 'Chờ duyệt'] as [Tab, string]] : []),
  ];
  const current = canCreate ? tab : 'pending';
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/purchase-requests')}</h1>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Đề nghị mua hàng">
          {tabs.map(([code, label]) => (
            <Button
              key={code}
              role="tab"
              aria-selected={current === code}
              variant={current === code ? 'secondary' : 'text'}
              onClick={() => setTab(code)}
            >
              {label}
            </Button>
          ))}
        </div>
        {current === 'mine' ? <MineTab onDone={setToastMessage} /> : null}
        {current === 'pending' ? <PendingTab onDone={setToastMessage} /> : null}
      </div>
    </AppShell>
  );
}

function RequestForm({ onSaved, onCancel }: { onSaved(message: string): void; onCancel(): void }) {
  const unitChoice = useUnitChoice();
  const [neededBy, setNeededBy] = useState(vietnamToday);
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const create = useMutation({
    mutationFn: () =>
      postJson<PurchaseRequest>('/api/v1/purchase-requests', {
        org_unit_id: unitChoice.selectedId,
        needed_by: neededBy,
        reason,
        items: lines.map((line) => ({
          item_name: line.item_name,
          quantity: Number(line.quantity.replace(',', '.')),
          unit: line.unit,
          estimated_price: Number(line.estimated_price.replace(/\D/g, '')),
        })),
      }),
    onSuccess: (created) =>
      onSaved(
        `Đã gửi đề nghị ${created.code}${created.requires_principal ? ', chờ Hiệu trưởng duyệt' : ', chờ Ban Giám hiệu duyệt'}`,
      ),
  });
  const update = (index: number, field: keyof Line, value: string) =>
    setLines((previous) => previous.map((line, position) => (position === index ? { ...line, [field]: value } : line)));
  const complete =
    reason !== '' && lines.every((line) => line.item_name && line.unit && line.quantity && line.estimated_price);

  return (
    <form
      aria-label="Lập đề nghị mua hàng"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
      <FormBlock title="Lập đề nghị mua hàng">
        <FormRow label="Đơn vị">
          <select
            className={FORM_CONTROL_CLASS}
            value={unitChoice.selectedId ?? ''}
            onChange={(event) => unitChoice.select(event.target.value)}
          >
            {unitChoice.units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Thời hạn cần">
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={neededBy}
            onChange={(event) => setNeededBy(event.target.value)}
          />
        </FormRow>
        <FormRow label="Lý do">
          <input className={FORM_CONTROL_CLASS} value={reason} onChange={(event) => setReason(event.target.value)} />
        </FormRow>
      </FormBlock>
      {lines.map((line, index) => (
        <FormBlock key={index} title={`Mặt hàng ${index + 1}`}>
          <FormRow label="Tên mặt hàng">
            <input
              className={FORM_CONTROL_CLASS}
              value={line.item_name}
              onChange={(event) => update(index, 'item_name', event.target.value)}
            />
          </FormRow>
          <FormRow label="Số lượng">
            <input
              className={FORM_CONTROL_CLASS}
              value={line.quantity}
              onChange={(event) => update(index, 'quantity', event.target.value)}
            />
          </FormRow>
          <FormRow label="Đơn vị tính">
            <input
              className={FORM_CONTROL_CLASS}
              value={line.unit}
              onChange={(event) => update(index, 'unit', event.target.value)}
            />
          </FormRow>
          <FormRow label="Đơn giá dự kiến">
            <input
              className={FORM_CONTROL_CLASS}
              value={line.estimated_price}
              onChange={(event) => update(index, 'estimated_price', event.target.value)}
            />
          </FormRow>
        </FormBlock>
      ))}
      <FormButtons busy={create.isPending} disabled={!complete || !unitChoice.selectedId} onCancel={onCancel}>
        <Button variant="text" onClick={() => setLines((previous) => [...previous, emptyLine()])}>
          Thêm mặt hàng
        </Button>
      </FormButtons>
    </form>
  );
}

function MineTab({ onDone }: { onDone(message: string): void }) {
  const queryClient = useQueryClient();
  const grid = useGridSettings('my-purchase-requests');
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PurchaseRequest['status'] | ''>('');
  const mine = useQuery({
    queryKey: ['purchase-requests', 'mine'],
    queryFn: () => getJson<PurchaseRequest[]>('/api/v1/purchase-requests?view=mine'),
  });
  const error = mine.error ?? grid.error;
  const rows = (mine.data ?? []).filter(
    (row) => (status === '' || row.status === status) && matchesSearch(search, row.code, row.reason),
  );

  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {creating ? (
        <FormPanel>
          <RequestForm
            onCancel={() => setCreating(false)}
            onSaved={async (message) => {
              setCreating(false);
              await queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
              onDone(message);
            }}
          />
        </FormPanel>
      ) : null}
      <DataGrid
        label="Đề nghị của tôi"
        columns={REQUEST_COLUMNS}
        rows={rows}
        getRowId={(row) => row.id}
        getRowLabel={(row) => `đề nghị ${row.code}`}
        loading={mine.isPending}
        emptyText="Chưa có đề nghị nào"
        search={{ label: 'Tìm theo mã, nội dung đề nghị', value: search, onChange: setSearch }}
        advancedSearch={
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-label font-medium text-text">
              Trạng thái đề nghị
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as typeof status)}
                className={filterClass}
              >
                <option value="">Tất cả</option>
                {Object.entries(REQUEST_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
        toolbar={
          <Button variant="primary" onClick={() => setCreating(true)}>
            Thêm mới
          </Button>
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </div>
  );
}

function PendingTab({ onDone }: { onDone(message: string): void }) {
  const queryClient = useQueryClient();
  const grid = useGridSettings('purchase-requests');
  const [search, setSearch] = useState('');
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const pending = useQuery({
    queryKey: ['purchase-requests', 'pending'],
    queryFn: () => getJson<PurchaseRequest[]>('/api/v1/purchase-requests?view=pending'),
  });
  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      postJson<PurchaseRequest>(
        `/api/v1/purchase-requests/${id}/${approve ? 'approve' : 'reject'}`,
        approve ? {} : { reason: reasons[id] ?? '' },
      ),
    onSuccess: async (decided) => {
      await queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
      onDone(decided.status === 'approved' ? `Đã duyệt đề nghị ${decided.code}` : `Đã từ chối đề nghị ${decided.code}`);
    },
  });
  const error = pending.error ?? decide.error ?? grid.error;
  const rows = (pending.data ?? []).filter((row) => matchesSearch(search, row.code, row.requester_name, row.reason));
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <DataGrid
        label="Đề nghị chờ duyệt"
        columns={REQUEST_COLUMNS}
        rows={rows}
        getRowId={(row) => row.id}
        getRowLabel={(row) => `đề nghị ${row.code}`}
        loading={pending.isPending}
        emptyText="Chưa có đề nghị nào"
        search={{ label: 'Tìm theo mã, người đề nghị, nội dung', value: search, onChange: setSearch }}
        rowActions={(row) => (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="primary"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ id: row.id, approve: true })}
            >
              Duyệt
            </Button>
            <input
              aria-label="Lý do từ chối"
              placeholder="Lý do từ chối"
              className="w-40 rounded-lg border border-border bg-card px-3 py-2 text-content text-text"
              value={reasons[row.id] ?? ''}
              onChange={(event) => setReasons((previous) => ({ ...previous, [row.id]: event.target.value }))}
            />
            <Button
              variant="text"
              disabled={decide.isPending || !reasons[row.id]}
              onClick={() => decide.mutate({ id: row.id, approve: false })}
            >
              Từ chối
            </Button>
          </div>
        )}
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </div>
  );
}
