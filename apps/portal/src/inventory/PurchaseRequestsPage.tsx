import { useCallback, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, TextField, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
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
// chờ duyệt trong phạm vi, Phó Hiệu trưởng chỉ thấy đề nghị dưới hạn mức, duyệt hoặc từ chối kèm lý do
type Tab = 'mine' | 'pending';
interface Line {
  item_name: string;
  quantity: string;
  unit: string;
  estimated_price: string;
}
const emptyLine = (): Line => ({ item_name: '', quantity: '1', unit: '', estimated_price: '' });

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
        <h1 className="text-page-title font-bold text-text">Đề nghị mua hàng</h1>
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

function MineTab({ onDone }: { onDone(message: string): void }) {
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const [neededBy, setNeededBy] = useState(vietnamToday);
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const mine = useQuery({
    queryKey: ['purchase-requests', 'mine'],
    queryFn: () => getJson<PurchaseRequest[]>('/api/v1/purchase-requests?view=mine'),
  });
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
    onSuccess: async (created) => {
      setReason('');
      setLines([emptyLine()]);
      await queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
      onDone(
        `Đã gửi đề nghị ${created.code}${created.requires_principal ? ', chờ Hiệu trưởng duyệt' : ', chờ Ban Giám hiệu duyệt'}`,
      );
    },
  });
  const update = (index: number, field: keyof Line, value: string) =>
    setLines((previous) => previous.map((line, position) => (position === index ? { ...line, [field]: value } : line)));
  const complete =
    reason !== '' && lines.every((line) => line.item_name && line.unit && line.quantity && line.estimated_price);

  return (
    <div className="flex flex-col gap-4">
      {mine.error || create.error ? <Alert tone="danger">{messageOf(mine.error ?? create.error)}</Alert> : null}
      <form
        aria-label="Lập đề nghị mua hàng"
        className="flex flex-col gap-3 rounded-lg bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <UnitSelect units={unitChoice.units} selectedId={unitChoice.selectedId} onSelect={unitChoice.select} />
          <TextField
            label="Thời hạn cần"
            type="date"
            value={neededBy}
            onChange={(event) => setNeededBy(event.target.value)}
          />
          <TextField label="Lý do" value={reason} onChange={(event) => setReason(event.target.value)} />
        </div>
        {lines.map((line, index) => (
          <fieldset key={index} className="grid grid-cols-1 gap-3 md:grid-cols-4" aria-label={`Mặt hàng ${index + 1}`}>
            <TextField
              label="Tên mặt hàng"
              value={line.item_name}
              onChange={(event) => update(index, 'item_name', event.target.value)}
            />
            <TextField
              label="Số lượng"
              value={line.quantity}
              onChange={(event) => update(index, 'quantity', event.target.value)}
            />
            <TextField
              label="Đơn vị tính"
              value={line.unit}
              onChange={(event) => update(index, 'unit', event.target.value)}
            />
            <TextField
              label="Đơn giá dự kiến"
              value={line.estimated_price}
              onChange={(event) => update(index, 'estimated_price', event.target.value)}
            />
          </fieldset>
        ))}
        <div className="flex gap-2">
          <Button variant="text" onClick={() => setLines((previous) => [...previous, emptyLine()])}>
            Thêm mặt hàng
          </Button>
          <Button type="submit" variant="primary" disabled={create.isPending || !complete || !unitChoice.selectedId}>
            Gửi đề nghị
          </Button>
        </div>
      </form>
      <RequestTable rows={mine.data ?? []} />
    </div>
  );
}

function PendingTab({ onDone }: { onDone(message: string): void }) {
  const queryClient = useQueryClient();
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
  return (
    <div className="flex flex-col gap-4">
      {pending.error || decide.error ? <Alert tone="danger">{messageOf(pending.error ?? decide.error)}</Alert> : null}
      <RequestTable
        rows={pending.data ?? []}
        actions={(row) => (
          <div className="flex flex-wrap items-end gap-2">
            <Button
              variant="primary"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ id: row.id, approve: true })}
            >
              Duyệt
            </Button>
            <TextField
              label="Lý do từ chối"
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
      />
    </div>
  );
}

function RequestTable({ rows, actions }: { rows: PurchaseRequest[]; actions?: (row: PurchaseRequest) => ReactNode }) {
  if (rows.length === 0) {
    return <p className="text-content text-text-secondary">Chưa có đề nghị nào</p>;
  }
  return (
    <table className="w-full text-content">
      <thead>
        <tr className="text-left text-text-secondary">
          <th className="py-2">Mã</th>
          <th>Người đề nghị</th>
          <th>Lý do</th>
          <th>Thời hạn cần</th>
          <th>Giá trị</th>
          <th>Trạng thái</th>
          {actions ? <th /> : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-t border-border">
            <td className="py-2">{row.code}</td>
            <td>{row.requester_name}</td>
            <td>{row.reason}</td>
            <td>{row.needed_by}</td>
            <td>{formatMoney(row.total_amount)}</td>
            <td>
              {REQUEST_STATUS_LABELS[row.status]}
              {row.status === 'pending' && row.requires_principal ? ' (Hiệu trưởng duyệt)' : ''}
              {row.reject_reason ? `. Lý do: ${row.reject_reason}` : ''}
            </td>
            {actions ? <td>{actions(row)}</td> : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
