import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, TextField, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { useHasPermission } from '../session/permissions.js';
import { AssetEquipmentLink, useEquipmentNames } from './AssetEquipmentLink.js';
import {
  ASSET_STATUS_LABELS,
  COUNT_STATUS_LABELS,
  formatMoney,
  getJson,
  messageOf,
  postJson,
  TRANSACTION_LABELS,
  vietnamToday,
  type Asset,
  type AssetDamage,
  type PurchaseOrder,
  type PurchaseRequest,
  type StockCount,
  type StockItem,
  type StockTransaction,
  type Supplier,
} from './inventory-api.js';

// MH-20 Tài sản, mượn trả, hỏng và mất; MH-21 phiếu mua hàng, nhà cung cấp; MH-22 nhập xuất tồn kho và kiểm kê (P13-01 đến
// P13-04, P13-06 đến P13-10; BR-61, BR-62, BR-63; YCTD-77)
type Tab = 'stock' | 'orders' | 'assets' | 'counts' | 'suppliers';
type Notify = (message: string) => void;
const selectClass = 'mt-2 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
const toNumber = (value: string) => Number(value.replace(',', '.'));
const toMoney = (value: string) => Number(value.replace(/\D/g, ''));

export function InventoryPage() {
  const canManageAssets = useHasPermission(PERMISSION_CODES.assetManage);
  const canOrder = useHasPermission(PERMISSION_CODES.purchaseOrderManage);
  const canApproveCount = useHasPermission(PERMISSION_CODES.stocktakeApprove);
  const canApproveRequests = useHasPermission(PERMISSION_CODES.purchaseRequestApprove);
  const canManagePayments = useHasPermission(PERMISSION_CODES.paymentManage);
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId ?? '';
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const tabs: Array<[Tab, string, boolean]> = [
    ['stock', 'Mặt hàng và tồn kho', canManageAssets || canOrder || canApproveCount],
    ['orders', 'Phiếu mua hàng', canOrder || canManagePayments],
    ['assets', 'Tài sản', canManageAssets || canApproveRequests],
    ['counts', 'Kiểm kê', canManageAssets || canApproveCount],
    ['suppliers', 'Nhà cung cấp', canManageAssets || canOrder],
  ];
  const visible = tabs.filter(([, , allowed]) => allowed);
  const [chosen, setChosen] = useState<Tab>();
  const tab = chosen ?? visible[0]?.[0];
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">Kho và tài sản</h1>
        <UnitSelect units={unitChoice.units} selectedId={unitChoice.selectedId} onSelect={unitChoice.select} />
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Kho và tài sản">
          {visible.map(([code, label]) => (
            <Button
              key={code}
              role="tab"
              aria-selected={tab === code}
              variant={tab === code ? 'secondary' : 'text'}
              onClick={() => setChosen(code)}
            >
              {label}
            </Button>
          ))}
        </div>
        {orgUnitId && tab === 'stock' ? (
          <StockTab orgUnitId={orgUnitId} canManage={canManageAssets} onDone={setToastMessage} />
        ) : null}
        {orgUnitId && tab === 'orders' ? (
          <OrdersTab orgUnitId={orgUnitId} canOrder={canOrder} onDone={setToastMessage} />
        ) : null}
        {orgUnitId && tab === 'assets' ? (
          <AssetsTab
            orgUnitId={orgUnitId}
            canManage={canManageAssets}
            canApprove={canApproveRequests}
            onDone={setToastMessage}
          />
        ) : null}
        {orgUnitId && tab === 'counts' ? (
          <CountsTab
            orgUnitId={orgUnitId}
            canManage={canManageAssets}
            canApprove={canApproveCount}
            onDone={setToastMessage}
          />
        ) : null}
        {orgUnitId && tab === 'suppliers' ? <SuppliersTab orgUnitId={orgUnitId} onDone={setToastMessage} /> : null}
      </div>
    </AppShell>
  );
}

function useStockItems(orgUnitId: string) {
  return useQuery({
    queryKey: ['stock-items', orgUnitId],
    queryFn: () => getJson<StockItem[]>(`/api/v1/stock-items?org_unit_id=${orgUnitId}`),
  });
}

function ItemSelect({
  label,
  items,
  value,
  onChange,
  optional,
}: {
  label: string;
  items: StockItem[];
  value: string;
  onChange(value: string): void;
  optional?: boolean;
}) {
  return (
    <label className="text-label font-medium text-text">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className={selectClass}>
        <option value="">{optional ? 'Không nhập kho' : 'Chọn mặt hàng'}</option>
        {items
          .filter((item) => item.status === 'active')
          .map((item) => (
            <option key={item.id} value={item.id}>
              {item.code} {item.name}
            </option>
          ))}
      </select>
    </label>
  );
}

function StockTab({ orgUnitId, canManage, onDone }: { orgUnitId: string; canManage: boolean; onDone: Notify }) {
  const queryClient = useQueryClient();
  const items = useStockItems(orgUnitId);
  const transactions = useQuery({
    queryKey: ['stock-transactions', orgUnitId],
    queryFn: () => getJson<StockTransaction[]>(`/api/v1/stock-transactions?org_unit_id=${orgUnitId}`),
  });
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [minimum, setMinimum] = useState('0');
  const [kind, setKind] = useState<'receipt' | 'issue' | 'opening'>('receipt');
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(vietnamToday);
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['stock-items'] });
    await queryClient.invalidateQueries({ queryKey: ['stock-transactions'] });
    onDone(message);
  };
  const createItem = useMutation({
    mutationFn: () =>
      postJson<StockItem>('/api/v1/stock-items', {
        org_unit_id: orgUnitId,
        code,
        name,
        unit,
        min_qty: toNumber(minimum || '0'),
      }),
    onSuccess: (item) => {
      setCode('');
      setName('');
      setUnit('');
      return refresh(`Đã thêm mặt hàng ${item.code}`);
    },
  });
  const move = useMutation({
    mutationFn: () => {
      const line = {
        stock_item_id: itemId,
        quantity: toNumber(quantity),
        ...(price ? { unit_price: toMoney(price) } : {}),
      };
      return kind === 'opening'
        ? postJson<{ code: string }>('/api/v1/stock-opening-balances', {
            org_unit_id: orgUnitId,
            balance_date: date,
            lines: [line],
          })
        : postJson<{ code: string }>('/api/v1/stock-transactions', {
            org_unit_id: orgUnitId,
            transaction_type: kind,
            transaction_date: date,
            lines: [line],
          });
    },
    onSuccess: (result) => {
      setQuantity('');
      setPrice('');
      return refresh(`Đã ghi phiếu ${result.code}`);
    },
  });
  const error = [items.error, transactions.error, createItem.error, move.error].find(Boolean);
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {canManage ? (
        <>
          <form
            aria-label="Thêm mặt hàng"
            className="grid grid-cols-1 gap-3 rounded-lg bg-card p-4 md:grid-cols-5"
            onSubmit={(event) => {
              event.preventDefault();
              createItem.mutate();
            }}
          >
            <TextField label="Mã mặt hàng" value={code} onChange={(event) => setCode(event.target.value)} />
            <TextField label="Tên mặt hàng" value={name} onChange={(event) => setName(event.target.value)} />
            <TextField label="Đơn vị tính" value={unit} onChange={(event) => setUnit(event.target.value)} />
            <TextField label="Tồn tối thiểu" value={minimum} onChange={(event) => setMinimum(event.target.value)} />
            <div className="flex items-end">
              <Button type="submit" variant="primary" disabled={createItem.isPending || !code || !name || !unit}>
                Thêm mặt hàng
              </Button>
            </div>
          </form>
          <form
            aria-label="Ghi phiếu kho"
            className="grid grid-cols-1 gap-3 rounded-lg bg-card p-4 md:grid-cols-6"
            onSubmit={(event) => {
              event.preventDefault();
              move.mutate();
            }}
          >
            <label className="text-label font-medium text-text">
              Loại phiếu
              <select
                value={kind}
                onChange={(event) => setKind(event.target.value as typeof kind)}
                className={selectClass}
              >
                <option value="receipt">Phiếu nhập</option>
                <option value="issue">Phiếu xuất</option>
                <option value="opening">Tồn kho ban đầu</option>
              </select>
            </label>
            <ItemSelect label="Mặt hàng" items={items.data ?? []} value={itemId} onChange={setItemId} />
            <TextField label="Số lượng" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            <TextField label="Đơn giá" value={price} onChange={(event) => setPrice(event.target.value)} />
            <TextField label="Ngày" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            <div className="flex items-end">
              <Button
                type="submit"
                variant="primary"
                disabled={move.isPending || !itemId || !quantity || (kind === 'opening' && !price)}
              >
                Ghi phiếu
              </Button>
            </div>
          </form>
        </>
      ) : null}
      <table className="w-full text-content" aria-label="Tồn kho">
        <thead>
          <tr className="text-left text-text-secondary">
            <th className="py-2">Mã</th>
            <th>Mặt hàng</th>
            <th>Tồn</th>
            <th>Tối thiểu</th>
          </tr>
        </thead>
        <tbody>
          {(items.data ?? []).map((item) => (
            <tr key={item.id} className="border-t border-border">
              <td className="py-2">{item.code}</td>
              <td>{item.name}</td>
              <td>
                {item.current_qty} {item.unit}
                {item.below_minimum ? ' (dưới tối thiểu)' : ''}
              </td>
              <td>{item.min_qty}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 className="text-section-title font-semibold text-text">Sổ kho</h2>
      <table className="w-full text-content" aria-label="Sổ kho">
        <thead>
          <tr className="text-left text-text-secondary">
            <th className="py-2">Phiếu</th>
            <th>Ngày</th>
            <th>Loại</th>
            <th>Mặt hàng</th>
            <th>Số lượng</th>
            <th>Tồn sau</th>
          </tr>
        </thead>
        <tbody>
          {(transactions.data ?? []).map((row) => (
            <tr key={row.id} className="border-t border-border">
              <td className="py-2">{row.code}</td>
              <td>{row.transaction_date}</td>
              <td>{TRANSACTION_LABELS[row.transaction_type]}</td>
              <td>{row.item_name}</td>
              <td>{row.quantity}</td>
              <td>{row.balance_after}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrdersTab({ orgUnitId, canOrder, onDone }: { orgUnitId: string; canOrder: boolean; onDone: Notify }) {
  const queryClient = useQueryClient();
  const items = useStockItems(orgUnitId);
  const [requestId, setRequestId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [lines, setLines] = useState<Record<string, { stockItemId: string; price: string }>>({});
  const approved = useQuery({
    queryKey: ['purchase-requests', 'approved', orgUnitId],
    queryFn: () => getJson<PurchaseRequest[]>(`/api/v1/purchase-requests?view=approved&org_unit_id=${orgUnitId}`),
    enabled: canOrder,
  });
  const detail = useQuery({
    queryKey: ['purchase-request', requestId],
    queryFn: () => getJson<PurchaseRequest>(`/api/v1/purchase-requests/${requestId}`),
    enabled: Boolean(requestId),
  });
  const suppliers = useQuery({
    queryKey: ['suppliers', orgUnitId],
    queryFn: () => getJson<Supplier[]>(`/api/v1/suppliers?org_unit_id=${orgUnitId}`),
    enabled: canOrder,
  });
  const orders = useQuery({
    queryKey: ['purchase-orders', orgUnitId],
    queryFn: () => getJson<PurchaseOrder[]>(`/api/v1/purchase-orders?org_unit_id=${orgUnitId}`),
  });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    await queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
    await queryClient.invalidateQueries({ queryKey: ['stock-items'] });
    onDone(message);
  };
  const create = useMutation({
    mutationFn: () =>
      postJson<PurchaseOrder>('/api/v1/purchase-orders', {
        request_id: requestId,
        supplier_id: supplierId,
        order_date: vietnamToday(),
        items: (detail.data?.items ?? []).map((item) => ({
          item_name: item.item_name,
          stock_item_id: lines[item.id]?.stockItemId || null,
          quantity: item.quantity,
          unit_price: toMoney(lines[item.id]?.price ?? String(item.estimated_price)),
        })),
      }),
    onSuccess: (order) => {
      setRequestId('');
      setLines({});
      return refresh(`Đã lập phiếu mua hàng ${order.code}`);
    },
  });
  const receive = useMutation({
    mutationFn: (orderId: string) =>
      postJson<PurchaseOrder>(`/api/v1/purchase-orders/${orderId}/receive`, { received_date: vietnamToday() }),
    onSuccess: (order) => refresh(`Đã nhận hàng của phiếu ${order.code} vào kho`),
  });
  const error = [approved.error, suppliers.error, orders.error, create.error, receive.error].find(Boolean);
  const setLine = (itemId: string, field: 'stockItemId' | 'price', value: string) =>
    setLines((previous) => ({
      ...previous,
      [itemId]: { stockItemId: '', price: '', ...previous[itemId], [field]: value },
    }));
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {canOrder ? (
        <form
          aria-label="Lập phiếu mua hàng"
          className="flex flex-col gap-3 rounded-lg bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-label font-medium text-text">
              Đề nghị đã duyệt
              <select value={requestId} onChange={(event) => setRequestId(event.target.value)} className={selectClass}>
                <option value="">Chọn đề nghị</option>
                {(approved.data ?? []).map((request) => (
                  <option key={request.id} value={request.id}>
                    {request.code} {request.reason}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-label font-medium text-text">
              Nhà cung cấp
              <select
                value={supplierId}
                onChange={(event) => setSupplierId(event.target.value)}
                className={selectClass}
              >
                <option value="">Chọn nhà cung cấp</option>
                {(suppliers.data ?? [])
                  .filter((supplier) => supplier.status === 'active')
                  .map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          {(detail.data?.items ?? []).map((item) => (
            <fieldset key={item.id} className="grid grid-cols-1 gap-3 md:grid-cols-3" aria-label={item.item_name}>
              <span className="self-end text-content text-text">
                {item.item_name}: {item.quantity} {item.unit}
              </span>
              <ItemSelect
                label="Nhập vào mặt hàng kho"
                items={items.data ?? []}
                value={lines[item.id]?.stockItemId ?? ''}
                onChange={(value) => setLine(item.id, 'stockItemId', value)}
                optional
              />
              <TextField
                label="Đơn giá mua"
                value={lines[item.id]?.price ?? String(item.estimated_price)}
                onChange={(event) => setLine(item.id, 'price', event.target.value)}
              />
            </fieldset>
          ))}
          <div>
            <Button
              type="submit"
              variant="primary"
              disabled={create.isPending || !requestId || !supplierId || !detail.data}
            >
              Lập phiếu mua hàng
            </Button>
          </div>
        </form>
      ) : null}
      <table className="w-full text-content" aria-label="Phiếu mua hàng">
        <thead>
          <tr className="text-left text-text-secondary">
            <th className="py-2">Mã</th>
            <th>Đề nghị</th>
            <th>Nhà cung cấp</th>
            <th>Giá trị</th>
            <th>Trạng thái</th>
            <th>Thanh toán</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(orders.data ?? []).map((order) => (
            <tr key={order.id} className="border-t border-border">
              <td className="py-2">{order.code}</td>
              <td>{order.request_code}</td>
              <td>{order.supplier_name}</td>
              <td>{formatMoney(order.total_amount)}</td>
              <td>{order.status === 'received' ? 'Đã nhận hàng' : 'Chờ nhận hàng'}</td>
              <td>{order.payment_status === 'paid' ? `Đã chi ${order.payment_code ?? ''}` : 'Chờ thanh toán'}</td>
              <td>
                {canOrder && order.status === 'ordered' ? (
                  <Button disabled={receive.isPending} onClick={() => receive.mutate(order.id)}>
                    Nhận hàng
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AssetsTab({
  orgUnitId,
  canManage,
  canApprove,
  onDone,
}: {
  orgUnitId: string;
  canManage: boolean;
  canApprove: boolean;
  onDone: Notify;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ code: '', name: '', category: '', unit: 'chiếc', cost: '', date: vietnamToday() });
  const [selectedId, setSelectedId] = useState('');
  const [holder, setHolder] = useState('');
  const [dueDate, setDueDate] = useState(vietnamToday);
  const [description, setDescription] = useState('');
  const canLinkEquipment = useHasPermission(PERMISSION_CODES.equipmentManage);
  const equipmentNames = useEquipmentNames(canLinkEquipment);
  const assets = useQuery({
    queryKey: ['assets', orgUnitId],
    queryFn: () => getJson<Asset[]>(`/api/v1/assets?org_unit_id=${orgUnitId}`),
  });
  const damages = useQuery({
    queryKey: ['asset-damages', orgUnitId],
    queryFn: () => getJson<AssetDamage[]>(`/api/v1/asset-damages?org_unit_id=${orgUnitId}&status=pending`),
  });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['assets'] });
    await queryClient.invalidateQueries({ queryKey: ['asset-damages'] });
    onDone(message);
  };
  const create = useMutation({
    mutationFn: () =>
      postJson<Asset>('/api/v1/assets', {
        org_unit_id: orgUnitId,
        code: form.code,
        name: form.name,
        category: form.category,
        unit: form.unit,
        original_cost: toMoney(form.cost),
        purchase_date: form.date,
      }),
    onSuccess: (asset) => {
      setForm((previous) => ({ ...previous, code: '', name: '', cost: '' }));
      return refresh(`Đã thêm tài sản ${asset.code}`);
    },
  });
  const action = useMutation({
    mutationFn: async (kind: 'assign' | 'lend' | 'return' | 'damage') => {
      const detail = await getJson<{
        assignments: Array<{ id: string; returned_on: string | null }>;
        loans: Array<{ id: string; status: string }>;
      }>(`/api/v1/assets/${selectedId}`);
      const today = vietnamToday();
      if (kind === 'assign') {
        await postJson('/api/v1/asset-assignments', {
          asset_id: selectedId,
          assigned_to_type: 'room',
          assigned_to_name: holder,
          received_by_name: holder,
          assigned_on: today,
        });
        return 'Đã cấp phát tài sản';
      }
      if (kind === 'lend') {
        await postJson('/api/v1/asset-loans', {
          asset_id: selectedId,
          borrower_name: holder,
          from_date: today,
          due_date: dueDate,
        });
        return 'Đã ghi phiếu mượn';
      }
      if (kind === 'damage') {
        await postJson('/api/v1/asset-damages', {
          asset_id: selectedId,
          incident_type: 'damaged',
          severity: 'major',
          description,
          occurred_on: today,
          proposed_handling: 'Sửa chữa hoặc thanh lý',
        });
        return 'Đã ghi nhận hỏng, chờ Ban Giám hiệu duyệt';
      }
      const assignment = detail.assignments.find((row) => row.returned_on === null);
      if (assignment) {
        await postJson(`/api/v1/asset-assignments/${assignment.id}/return`, {
          returned_on: today,
          returned_by_name: holder || 'Người sử dụng',
        });
        return 'Đã thu hồi tài sản';
      }
      const loan = detail.loans.find((row) => row.status === 'open');
      if (loan) {
        await postJson(`/api/v1/asset-loans/${loan.id}/return`, { returned_on: today });
        return 'Đã nhận trả tài sản';
      }
      return 'Tài sản đang ở trong kho';
    },
    onSuccess: (message) => refresh(message),
  });
  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      postJson(
        `/api/v1/asset-damages/${id}/${approve ? 'approve' : 'reject'}`,
        approve ? {} : { note: 'Không đồng ý' },
      ),
    onSuccess: () => refresh('Đã xử lý ghi nhận hỏng mất'),
  });
  const error = [assets.error, damages.error, create.error, action.error, decide.error].find(Boolean);
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {canManage ? (
        <form
          aria-label="Thêm tài sản"
          className="grid grid-cols-1 gap-3 rounded-lg bg-card p-4 md:grid-cols-6"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <TextField
            label="Mã tài sản"
            value={form.code}
            onChange={(event) => setForm({ ...form, code: event.target.value })}
          />
          <TextField
            label="Tên tài sản"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <TextField
            label="Nhóm"
            value={form.category}
            onChange={(event) => setForm({ ...form, category: event.target.value })}
          />
          <TextField
            label="Nguyên giá"
            value={form.cost}
            onChange={(event) => setForm({ ...form, cost: event.target.value })}
          />
          <TextField
            label="Ngày nhập"
            type="date"
            value={form.date}
            onChange={(event) => setForm({ ...form, date: event.target.value })}
          />
          <div className="flex items-end">
            <Button
              type="submit"
              variant="primary"
              disabled={create.isPending || !form.code || !form.name || !form.category || !form.cost}
            >
              Thêm tài sản
            </Button>
          </div>
        </form>
      ) : null}
      {canManage ? (
        <div className="grid grid-cols-1 gap-3 rounded-lg bg-card p-4 md:grid-cols-4" aria-label="Thao tác tài sản">
          <label className="text-label font-medium text-text">
            Tài sản
            <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className={selectClass}>
              <option value="">Chọn tài sản</option>
              {(assets.data ?? []).map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.code} {asset.name}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="Nơi nhận hoặc người mượn"
            value={holder}
            onChange={(event) => setHolder(event.target.value)}
          />
          <TextField label="Hạn trả" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          <TextField label="Mô tả hỏng" value={description} onChange={(event) => setDescription(event.target.value)} />
          <div className="flex flex-wrap gap-2 md:col-span-4">
            <Button disabled={!selectedId || !holder || action.isPending} onClick={() => action.mutate('assign')}>
              Cấp phát
            </Button>
            <Button disabled={!selectedId || !holder || action.isPending} onClick={() => action.mutate('lend')}>
              Cho mượn
            </Button>
            <Button disabled={!selectedId || action.isPending} onClick={() => action.mutate('return')}>
              Thu hồi hoặc nhận trả
            </Button>
            <Button disabled={!selectedId || !description || action.isPending} onClick={() => action.mutate('damage')}>
              Ghi nhận hỏng
            </Button>
          </div>
        </div>
      ) : null}
      {canLinkEquipment ? <AssetEquipmentLink assets={assets.data ?? []} onDone={onDone} /> : null}
      <table className="w-full text-content" aria-label="Danh mục tài sản">
        <thead>
          <tr className="text-left text-text-secondary">
            <th className="py-2">Mã</th>
            <th>Tên</th>
            <th>Nhóm</th>
            <th>Nguyên giá</th>
            <th>Vị trí</th>
            <th>Trạng thái</th>
            {canLinkEquipment ? <th>Thiết bị dạy học</th> : null}
          </tr>
        </thead>
        <tbody>
          {(assets.data ?? []).map((asset) => (
            <tr key={asset.id} className="border-t border-border">
              <td className="py-2">{asset.code}</td>
              <td>{asset.name}</td>
              <td>{asset.category}</td>
              <td>{formatMoney(asset.original_cost)}</td>
              <td>{asset.location_name ?? 'Kho'}</td>
              <td>{ASSET_STATUS_LABELS[asset.status]}</td>
              {canLinkEquipment ? (
                <td>{asset.equipment_item_id ? (equipmentNames.get(asset.equipment_item_id) ?? '') : ''}</td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      <h2 className="text-section-title font-semibold text-text">Hỏng và mất chờ duyệt</h2>
      <ul className="flex flex-col gap-2 text-content text-text">
        {(damages.data ?? []).map((damage) => (
          <li key={damage.id} className="flex flex-wrap items-center gap-2">
            {damage.code} {damage.asset_code} {damage.asset_name}: {damage.description}. Đề xuất:{' '}
            {damage.proposed_handling}
            {canApprove ? (
              <>
                <Button disabled={decide.isPending} onClick={() => decide.mutate({ id: damage.id, approve: true })}>
                  Duyệt xử lý
                </Button>
                <Button
                  variant="text"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ id: damage.id, approve: false })}
                >
                  Từ chối
                </Button>
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CountsTab({
  orgUnitId,
  canManage,
  canApprove,
  onDone,
}: {
  orgUnitId: string;
  canManage: boolean;
  canApprove: boolean;
  onDone: Notify;
}) {
  const queryClient = useQueryClient();
  const items = useStockItems(orgUnitId);
  const [actual, setActual] = useState<Record<string, string>>({});
  const [countId, setCountId] = useState('');
  const [reason, setReason] = useState('');
  const counts = useQuery({
    queryKey: ['stock-counts', orgUnitId],
    queryFn: () => getJson<StockCount[]>(`/api/v1/stock-counts?org_unit_id=${orgUnitId}`),
  });
  const detail = useQuery({
    queryKey: ['stock-count', countId],
    queryFn: () => getJson<StockCount>(`/api/v1/stock-counts/${countId}`),
    enabled: Boolean(countId),
  });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['stock-counts'] });
    await queryClient.invalidateQueries({ queryKey: ['stock-count'] });
    await queryClient.invalidateQueries({ queryKey: ['stock-items'] });
    onDone(message);
  };
  const create = useMutation({
    mutationFn: () =>
      postJson<StockCount>('/api/v1/stock-counts', {
        org_unit_id: orgUnitId,
        count_date: vietnamToday(),
        lines: Object.entries(actual)
          .filter(([, value]) => value !== '')
          .map(([stockItemId, value]) => ({ stock_item_id: stockItemId, actual_qty: toNumber(value) })),
      }),
    onSuccess: (count) => {
      setActual({});
      setCountId(count.id);
      return refresh(`Đã lập biên bản ${count.code}: ${COUNT_STATUS_LABELS[count.status]}`);
    },
  });
  const decide = useMutation({
    mutationFn: (approve: boolean) =>
      postJson<StockCount>(
        `/api/v1/stock-counts/${countId}/${approve ? 'approve' : 'reject'}`,
        approve ? {} : { reason },
      ),
    onSuccess: (count) => refresh(`Biên bản ${count.code}: ${COUNT_STATUS_LABELS[count.status]}`),
  });
  const error = [items.error, counts.error, create.error, decide.error].find(Boolean);
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {canManage ? (
        <form
          aria-label="Lập biên bản kiểm kê"
          className="flex flex-col gap-3 rounded-lg bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          {(items.data ?? [])
            .filter((item) => item.status === 'active')
            .map((item) => (
              <TextField
                key={item.id}
                label={`Thực tế ${item.code} ${item.name} (hệ thống ${item.current_qty} ${item.unit})`}
                value={actual[item.id] ?? ''}
                onChange={(event) => setActual((previous) => ({ ...previous, [item.id]: event.target.value }))}
              />
            ))}
          <div>
            <Button
              type="submit"
              variant="primary"
              disabled={create.isPending || Object.values(actual).every((value) => value === '')}
            >
              Lập biên bản kiểm kê
            </Button>
          </div>
        </form>
      ) : null}
      <label className="text-label font-medium text-text">
        Biên bản
        <select value={countId} onChange={(event) => setCountId(event.target.value)} className={selectClass}>
          <option value="">Chọn biên bản</option>
          {(counts.data ?? []).map((count) => (
            <option key={count.id} value={count.id}>
              {count.code} ngày {count.count_date}: {COUNT_STATUS_LABELS[count.status]}
            </option>
          ))}
        </select>
      </label>
      {detail.data ? (
        <section className="flex flex-col gap-2" aria-label="Chi tiết biên bản kiểm kê">
          <table className="w-full text-content">
            <thead>
              <tr className="text-left text-text-secondary">
                <th className="py-2">Mặt hàng</th>
                <th>Hệ thống</th>
                <th>Thực tế</th>
                <th>Chênh lệch</th>
              </tr>
            </thead>
            <tbody>
              {(detail.data.lines ?? []).map((line) => (
                <tr key={line.stock_item_id} className="border-t border-border">
                  <td className="py-2">
                    {line.item_code} {line.item_name}
                  </td>
                  <td>{line.system_qty}</td>
                  <td>{line.actual_qty}</td>
                  <td>{line.difference}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {canApprove && detail.data.status === 'pending' ? (
            <div className="flex flex-wrap items-end gap-2">
              <Button variant="primary" disabled={decide.isPending} onClick={() => decide.mutate(true)}>
                Duyệt điều chỉnh tồn
              </Button>
              <TextField label="Lý do từ chối" value={reason} onChange={(event) => setReason(event.target.value)} />
              <Button variant="text" disabled={decide.isPending || !reason} onClick={() => decide.mutate(false)}>
                Từ chối
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function SuppliersTab({ orgUnitId, onDone }: { orgUnitId: string; onDone: Notify }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', tax_code: '', phone: '', payment_terms: '' });
  const suppliers = useQuery({
    queryKey: ['suppliers', orgUnitId],
    queryFn: () => getJson<Supplier[]>(`/api/v1/suppliers?org_unit_id=${orgUnitId}`),
  });
  const create = useMutation({
    mutationFn: () => postJson<Supplier>('/api/v1/suppliers', { org_unit_id: orgUnitId, ...form }),
    onSuccess: async (supplier) => {
      setForm({ name: '', tax_code: '', phone: '', payment_terms: '' });
      await queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      onDone(`Đã thêm nhà cung cấp ${supplier.name}`);
    },
  });
  return (
    <div className="flex flex-col gap-4">
      {suppliers.error || create.error ? (
        <Alert tone="danger">{messageOf(suppliers.error ?? create.error)}</Alert>
      ) : null}
      <form
        aria-label="Thêm nhà cung cấp"
        className="grid grid-cols-1 gap-3 rounded-lg bg-card p-4 md:grid-cols-5"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <TextField
          label="Tên nhà cung cấp"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        <TextField
          label="Mã số thuế"
          value={form.tax_code}
          onChange={(event) => setForm({ ...form, tax_code: event.target.value })}
        />
        <TextField
          label="Điện thoại"
          value={form.phone}
          onChange={(event) => setForm({ ...form, phone: event.target.value })}
        />
        <TextField
          label="Điều khoản"
          value={form.payment_terms}
          onChange={(event) => setForm({ ...form, payment_terms: event.target.value })}
        />
        <div className="flex items-end">
          <Button type="submit" variant="primary" disabled={create.isPending || !form.name}>
            Thêm nhà cung cấp
          </Button>
        </div>
      </form>
      <table className="w-full text-content" aria-label="Nhà cung cấp">
        <thead>
          <tr className="text-left text-text-secondary">
            <th className="py-2">Tên</th>
            <th>Mã số thuế</th>
            <th>Điện thoại</th>
            <th>Điều khoản</th>
          </tr>
        </thead>
        <tbody>
          {(suppliers.data ?? []).map((supplier) => (
            <tr key={supplier.id} className="border-t border-border">
              <td className="py-2">{supplier.name}</td>
              <td>{supplier.tax_code}</td>
              <td>{supplier.phone}</td>
              <td>{supplier.payment_terms}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
