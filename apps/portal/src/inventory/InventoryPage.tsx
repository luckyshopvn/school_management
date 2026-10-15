import { useCallback, useState, type ReactNode } from 'react';
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
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { matchesSearch } from '../pages/grid-search.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
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
// P13-04, P13-06 đến P13-10; BR-61, BR-62, BR-63; YCTD-77). Giao diện chung theo Sở (DT-15 phần 15f3, YCTD-115): mỗi danh
// sách là một lưới dữ liệu chung (khóa `stock-items`, `stock-transactions`, `purchase-orders`, `assets`, `asset-damages`,
// `stock-counts`, `suppliers`); thêm mới và ghi phiếu bằng biểu mẫu theo khối có nút Ghi; thao tác trên từng dòng
type Tab = 'stock' | 'orders' | 'assets' | 'counts' | 'suppliers';
type Notify = (message: string) => void;
const filterClass = `mt-1 ${FORM_CONTROL_CLASS}`;
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
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/inventory')}</h1>
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

// Các lựa chọn mặt hàng đang dùng cho ô chọn mặt hàng
function itemOptions(items: StockItem[], optional?: boolean): ReactNode {
  return (
    <>
      <option value="">{optional ? 'Không nhập kho' : 'Chọn mặt hàng'}</option>
      {items
        .filter((item) => item.status === 'active')
        .map((item) => (
          <option key={item.id} value={item.id}>
            {item.code} {item.name}
          </option>
        ))}
    </>
  );
}

// Nút Ghi và Hủy dưới biểu mẫu theo khối
function FormButtons({ busy, disabled, onCancel }: { busy: boolean; disabled?: boolean; onCancel(): void }) {
  return (
    <div className="flex gap-2">
      <Button type="submit" variant="primary" disabled={busy || disabled}>
        Ghi
      </Button>
      <Button variant="text" onClick={onCancel}>
        Hủy
      </Button>
    </div>
  );
}

// Khung bao biểu mẫu mở từ nút trên thanh công cụ của lưới
function FormPanel({ children }: { children: ReactNode }) {
  return <section className="rounded-xl border border-border bg-card p-4">{children}</section>;
}

const STOCK_ITEM_COLUMNS: Array<DataGridColumn<StockItem>> = [
  { id: 'code', header: 'Mã', alwaysVisible: true, className: 'font-medium', cell: (item) => item.code },
  { id: 'name', header: 'Mặt hàng', cell: (item) => item.name },
  {
    id: 'current_qty',
    header: 'Tồn',
    cell: (item) => `${item.current_qty} ${item.unit}${item.below_minimum ? ' (dưới tối thiểu)' : ''}`,
  },
  { id: 'min_qty', header: 'Tối thiểu', cell: (item) => item.min_qty },
  {
    id: 'status',
    header: 'Trạng thái',
    hiddenByDefault: true,
    cell: (item) => (item.status === 'active' ? 'Đang dùng' : 'Ngừng dùng'),
  },
];

const TRANSACTION_COLUMNS: Array<DataGridColumn<StockTransaction>> = [
  { id: 'code', header: 'Phiếu', alwaysVisible: true, className: 'font-medium', cell: (row) => row.code },
  { id: 'transaction_date', header: 'Ngày', cell: (row) => row.transaction_date },
  { id: 'transaction_type', header: 'Loại', cell: (row) => TRANSACTION_LABELS[row.transaction_type] },
  { id: 'item_name', header: 'Mặt hàng', cell: (row) => row.item_name },
  { id: 'quantity', header: 'Số lượng', cell: (row) => row.quantity },
  { id: 'balance_after', header: 'Tồn sau', cell: (row) => row.balance_after },
  { id: 'note', header: 'Ghi chú', hiddenByDefault: true, cell: (row) => row.note ?? '' },
];

function StockItemForm({ orgUnitId, onSaved, onCancel }: { orgUnitId: string; onSaved: Notify; onCancel(): void }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [minimum, setMinimum] = useState('0');
  const createItem = useMutation({
    mutationFn: () =>
      postJson<StockItem>('/api/v1/stock-items', {
        org_unit_id: orgUnitId,
        code,
        name,
        unit,
        min_qty: toNumber(minimum || '0'),
      }),
    onSuccess: (item) => onSaved(`Đã thêm mặt hàng ${item.code}`),
  });
  return (
    <form
      aria-label="Thêm mặt hàng"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        createItem.mutate();
      }}
    >
      {createItem.error ? <Alert tone="danger">{messageOf(createItem.error)}</Alert> : null}
      <FormBlock title="Thêm mặt hàng">
        <FormRow label="Mã mặt hàng">
          <input className={FORM_CONTROL_CLASS} value={code} onChange={(event) => setCode(event.target.value)} />
        </FormRow>
        <FormRow label="Tên mặt hàng">
          <input className={FORM_CONTROL_CLASS} value={name} onChange={(event) => setName(event.target.value)} />
        </FormRow>
        <FormRow label="Đơn vị tính">
          <input className={FORM_CONTROL_CLASS} value={unit} onChange={(event) => setUnit(event.target.value)} />
        </FormRow>
        <FormRow label="Tồn tối thiểu">
          <input className={FORM_CONTROL_CLASS} value={minimum} onChange={(event) => setMinimum(event.target.value)} />
        </FormRow>
      </FormBlock>
      <FormButtons busy={createItem.isPending} disabled={!code || !name || !unit} onCancel={onCancel} />
    </form>
  );
}

function StockMoveForm({
  orgUnitId,
  items,
  onSaved,
  onCancel,
}: {
  orgUnitId: string;
  items: StockItem[];
  onSaved: Notify;
  onCancel(): void;
}) {
  const [kind, setKind] = useState<'receipt' | 'issue' | 'opening'>('receipt');
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(vietnamToday);
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
      onSaved(`Đã ghi phiếu ${result.code}`);
    },
  });
  return (
    <form
      aria-label="Ghi phiếu kho"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        move.mutate();
      }}
    >
      {move.error ? <Alert tone="danger">{messageOf(move.error)}</Alert> : null}
      <FormBlock title="Ghi phiếu kho">
        <FormRow label="Loại phiếu">
          <select
            className={FORM_CONTROL_CLASS}
            value={kind}
            onChange={(event) => setKind(event.target.value as typeof kind)}
          >
            <option value="receipt">Phiếu nhập</option>
            <option value="issue">Phiếu xuất</option>
            <option value="opening">Tồn kho ban đầu</option>
          </select>
        </FormRow>
        <FormRow label="Mặt hàng">
          <select className={FORM_CONTROL_CLASS} value={itemId} onChange={(event) => setItemId(event.target.value)}>
            {itemOptions(items)}
          </select>
        </FormRow>
        <FormRow label="Số lượng">
          <input
            className={FORM_CONTROL_CLASS}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </FormRow>
        <FormRow label="Đơn giá">
          <input className={FORM_CONTROL_CLASS} value={price} onChange={(event) => setPrice(event.target.value)} />
        </FormRow>
        <FormRow label="Ngày">
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </FormRow>
      </FormBlock>
      <FormButtons
        busy={move.isPending}
        disabled={!itemId || !quantity || (kind === 'opening' && !price)}
        onCancel={onCancel}
      />
    </form>
  );
}

function StockTab({ orgUnitId, canManage, onDone }: { orgUnitId: string; canManage: boolean; onDone: Notify }) {
  const queryClient = useQueryClient();
  const itemGrid = useGridSettings('stock-items');
  const transactionGrid = useGridSettings('stock-transactions');
  const items = useStockItems(orgUnitId);
  const transactions = useQuery({
    queryKey: ['stock-transactions', orgUnitId],
    queryFn: () => getJson<StockTransaction[]>(`/api/v1/stock-transactions?org_unit_id=${orgUnitId}`),
  });
  const [openForm, setOpenForm] = useState<'item' | 'move'>();
  const [itemSearch, setItemSearch] = useState('');
  const [belowOnly, setBelowOnly] = useState(false);
  const [transactionSearch, setTransactionSearch] = useState('');
  const [transactionType, setTransactionType] = useState<StockTransaction['transaction_type'] | ''>('');
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['stock-items'] });
    await queryClient.invalidateQueries({ queryKey: ['stock-transactions'] });
    onDone(message);
  };
  const error = [items.error, transactions.error, itemGrid.error, transactionGrid.error].find(Boolean);
  const itemRows = (items.data ?? []).filter(
    (item) => (!belowOnly || item.below_minimum) && matchesSearch(itemSearch, item.code, item.name),
  );
  const transactionRows = (transactions.data ?? []).filter(
    (row) =>
      (transactionType === '' || row.transaction_type === transactionType) &&
      matchesSearch(transactionSearch, row.code, row.item_code, row.item_name),
  );
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {canManage && openForm === 'item' ? (
        <FormPanel>
          <StockItemForm
            orgUnitId={orgUnitId}
            onCancel={() => setOpenForm(undefined)}
            onSaved={(message) => {
              setOpenForm(undefined);
              void refresh(message);
            }}
          />
        </FormPanel>
      ) : null}
      {canManage && openForm === 'move' ? (
        <FormPanel>
          <StockMoveForm
            orgUnitId={orgUnitId}
            items={items.data ?? []}
            onCancel={() => setOpenForm(undefined)}
            onSaved={(message) => void refresh(message)}
          />
        </FormPanel>
      ) : null}
      <DataGrid
        label="Tồn kho"
        columns={STOCK_ITEM_COLUMNS}
        rows={itemRows}
        getRowId={(item) => item.id}
        getRowLabel={(item) => `mặt hàng ${item.code}`}
        loading={items.isPending}
        emptyText="Đơn vị chưa có mặt hàng."
        search={{ label: 'Tìm theo mã, tên mặt hàng', value: itemSearch, onChange: setItemSearch }}
        advancedSearch={
          <label className="flex items-center gap-2 text-label font-medium text-text">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={belowOnly}
              onChange={(event) => setBelowOnly(event.target.checked)}
            />
            Chỉ mặt hàng dưới tồn tối thiểu
          </label>
        }
        toolbar={
          canManage ? (
            <>
              <Button variant="primary" onClick={() => setOpenForm('item')}>
                Thêm mới
              </Button>
              <Button onClick={() => setOpenForm('move')}>Ghi phiếu kho</Button>
            </>
          ) : null
        }
        settings={itemGrid.settings}
        onSettingsChange={itemGrid.update}
      />
      <h2 className="text-section-title font-semibold text-text">Sổ kho</h2>
      <DataGrid
        label="Sổ kho"
        columns={TRANSACTION_COLUMNS}
        rows={transactionRows}
        getRowId={(row) => row.id}
        getRowLabel={(row) => `phiếu ${row.code}`}
        loading={transactions.isPending}
        emptyText="Chưa có phiếu kho."
        search={{ label: 'Tìm theo số phiếu, mặt hàng', value: transactionSearch, onChange: setTransactionSearch }}
        advancedSearch={
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-label font-medium text-text">
              Lọc theo loại phiếu
              <select
                value={transactionType}
                onChange={(event) => setTransactionType(event.target.value as typeof transactionType)}
                className={filterClass}
              >
                <option value="">Tất cả</option>
                {Object.entries(TRANSACTION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
        settings={transactionGrid.settings}
        onSettingsChange={transactionGrid.update}
      />
    </div>
  );
}

const ORDER_COLUMNS: Array<DataGridColumn<PurchaseOrder>> = [
  { id: 'code', header: 'Mã', alwaysVisible: true, className: 'font-medium', cell: (order) => order.code },
  { id: 'request_code', header: 'Đề nghị', cell: (order) => order.request_code },
  { id: 'supplier_name', header: 'Nhà cung cấp', cell: (order) => order.supplier_name },
  { id: 'order_date', header: 'Ngày lập', hiddenByDefault: true, cell: (order) => order.order_date },
  { id: 'total_amount', header: 'Giá trị', cell: (order) => formatMoney(order.total_amount) },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: (order) => (order.status === 'received' ? 'Đã nhận hàng' : 'Chờ nhận hàng'),
  },
  {
    id: 'payment_status',
    header: 'Thanh toán',
    cell: (order) => (order.payment_status === 'paid' ? `Đã chi ${order.payment_code ?? ''}` : 'Chờ thanh toán'),
  },
];

function OrderForm({
  orgUnitId,
  onSaved,
  onCancel,
}: {
  orgUnitId: string;
  onSaved(message: string): void;
  onCancel(): void;
}) {
  const items = useStockItems(orgUnitId);
  const [requestId, setRequestId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [lines, setLines] = useState<Record<string, { stockItemId: string; price: string }>>({});
  const approved = useQuery({
    queryKey: ['purchase-requests', 'approved', orgUnitId],
    queryFn: () => getJson<PurchaseRequest[]>(`/api/v1/purchase-requests?view=approved&org_unit_id=${orgUnitId}`),
  });
  const detail = useQuery({
    queryKey: ['purchase-request', requestId],
    queryFn: () => getJson<PurchaseRequest>(`/api/v1/purchase-requests/${requestId}`),
    enabled: Boolean(requestId),
  });
  const suppliers = useQuery({
    queryKey: ['suppliers', orgUnitId],
    queryFn: () => getJson<Supplier[]>(`/api/v1/suppliers?org_unit_id=${orgUnitId}`),
  });
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
    onSuccess: (order) => onSaved(`Đã lập phiếu mua hàng ${order.code}`),
  });
  const error = [approved.error, suppliers.error, items.error, create.error].find(Boolean);
  const setLine = (itemId: string, field: 'stockItemId' | 'price', value: string) =>
    setLines((previous) => ({
      ...previous,
      [itemId]: { stockItemId: '', price: '', ...previous[itemId], [field]: value },
    }));
  return (
    <form
      aria-label="Lập phiếu mua hàng"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <FormBlock title="Lập phiếu mua hàng">
        <FormRow label="Đề nghị đã duyệt">
          <select
            className={FORM_CONTROL_CLASS}
            value={requestId}
            onChange={(event) => setRequestId(event.target.value)}
          >
            <option value="">Chọn đề nghị</option>
            {(approved.data ?? []).map((request) => (
              <option key={request.id} value={request.id}>
                {request.code} {request.reason}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Nhà cung cấp">
          <select
            className={FORM_CONTROL_CLASS}
            value={supplierId}
            onChange={(event) => setSupplierId(event.target.value)}
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
        </FormRow>
      </FormBlock>
      {(detail.data?.items ?? []).map((item) => (
        <FormBlock key={item.id} title={`${item.item_name}: ${item.quantity} ${item.unit}`}>
          <FormRow label="Nhập vào mặt hàng kho">
            <select
              className={FORM_CONTROL_CLASS}
              value={lines[item.id]?.stockItemId ?? ''}
              onChange={(event) => setLine(item.id, 'stockItemId', event.target.value)}
            >
              {itemOptions(items.data ?? [], true)}
            </select>
          </FormRow>
          <FormRow label="Đơn giá mua">
            <input
              className={FORM_CONTROL_CLASS}
              value={lines[item.id]?.price ?? String(item.estimated_price)}
              onChange={(event) => setLine(item.id, 'price', event.target.value)}
            />
          </FormRow>
        </FormBlock>
      ))}
      <FormButtons busy={create.isPending} disabled={!requestId || !supplierId || !detail.data} onCancel={onCancel} />
    </form>
  );
}

function OrdersTab({ orgUnitId, canOrder, onDone }: { orgUnitId: string; canOrder: boolean; onDone: Notify }) {
  const queryClient = useQueryClient();
  const grid = useGridSettings('purchase-orders');
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PurchaseOrder['status'] | ''>('');
  const [payment, setPayment] = useState<PurchaseOrder['payment_status'] | ''>('');
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
  const receive = useMutation({
    mutationFn: (orderId: string) =>
      postJson<PurchaseOrder>(`/api/v1/purchase-orders/${orderId}/receive`, { received_date: vietnamToday() }),
    onSuccess: (order) => refresh(`Đã nhận hàng của phiếu ${order.code} vào kho`),
  });
  const error = [orders.error, receive.error, grid.error].find(Boolean);
  const rows = (orders.data ?? []).filter(
    (order) =>
      (status === '' || order.status === status) &&
      (payment === '' || order.payment_status === payment) &&
      matchesSearch(search, order.code, order.request_code, order.supplier_name),
  );
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {canOrder && creating ? (
        <FormPanel>
          <OrderForm
            orgUnitId={orgUnitId}
            onCancel={() => setCreating(false)}
            onSaved={(message) => {
              setCreating(false);
              void refresh(message);
            }}
          />
        </FormPanel>
      ) : null}
      <DataGrid
        label="Phiếu mua hàng"
        columns={ORDER_COLUMNS}
        rows={rows}
        getRowId={(order) => order.id}
        getRowLabel={(order) => `phiếu ${order.code}`}
        loading={orders.isPending}
        emptyText="Chưa có phiếu mua hàng."
        search={{ label: 'Tìm theo mã phiếu, đề nghị, tên NCC', value: search, onChange: setSearch }}
        advancedSearch={
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-label font-medium text-text">
              Trạng thái nhận hàng
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as typeof status)}
                className={filterClass}
              >
                <option value="">Tất cả</option>
                <option value="ordered">Chờ nhận hàng</option>
                <option value="received">Đã nhận hàng</option>
              </select>
            </label>
            <label className="text-label font-medium text-text">
              Trạng thái thanh toán
              <select
                value={payment}
                onChange={(event) => setPayment(event.target.value as typeof payment)}
                className={filterClass}
              >
                <option value="">Tất cả</option>
                <option value="awaiting_payment">Chờ thanh toán</option>
                <option value="paid">Đã chi</option>
              </select>
            </label>
          </div>
        }
        toolbar={
          canOrder ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Thêm mới
            </Button>
          ) : null
        }
        rowActions={(order) =>
          canOrder && order.status === 'ordered' ? (
            <Button disabled={receive.isPending} onClick={() => receive.mutate(order.id)}>
              Nhận hàng
            </Button>
          ) : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </div>
  );
}

const ASSET_COLUMNS: Array<DataGridColumn<Asset>> = [
  { id: 'code', header: 'Mã', alwaysVisible: true, className: 'font-medium', cell: (asset) => asset.code },
  { id: 'name', header: 'Tên', cell: (asset) => asset.name },
  { id: 'category', header: 'Nhóm', cell: (asset) => asset.category },
  { id: 'unit', header: 'Đơn vị tính', hiddenByDefault: true, cell: (asset) => asset.unit },
  { id: 'original_cost', header: 'Nguyên giá', cell: (asset) => formatMoney(asset.original_cost) },
  { id: 'purchase_date', header: 'Ngày nhập', hiddenByDefault: true, cell: (asset) => asset.purchase_date },
  { id: 'location_name', header: 'Vị trí', cell: (asset) => asset.location_name ?? 'Kho' },
  { id: 'status', header: 'Trạng thái', cell: (asset) => ASSET_STATUS_LABELS[asset.status] },
];

const DAMAGE_COLUMNS: Array<DataGridColumn<AssetDamage>> = [
  { id: 'code', header: 'Mã', alwaysVisible: true, className: 'font-medium', cell: (damage) => damage.code },
  { id: 'asset', header: 'Tài sản', cell: (damage) => `${damage.asset_code} ${damage.asset_name}` },
  { id: 'incident_type', header: 'Loại', cell: (damage) => (damage.incident_type === 'lost' ? 'Mất' : 'Hỏng') },
  { id: 'description', header: 'Mô tả', cell: (damage) => damage.description },
  { id: 'proposed_handling', header: 'Đề xuất', cell: (damage) => damage.proposed_handling },
];

function AssetForm({ orgUnitId, onSaved, onCancel }: { orgUnitId: string; onSaved: Notify; onCancel(): void }) {
  const [form, setForm] = useState({ code: '', name: '', category: '', unit: 'chiếc', cost: '', date: vietnamToday() });
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
    onSuccess: (asset) => onSaved(`Đã thêm tài sản ${asset.code}`),
  });
  return (
    <form
      aria-label="Thêm tài sản"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
      <FormBlock title="Thêm tài sản">
        <FormRow label="Mã tài sản">
          <input
            className={FORM_CONTROL_CLASS}
            value={form.code}
            onChange={(event) => setForm({ ...form, code: event.target.value })}
          />
        </FormRow>
        <FormRow label="Tên tài sản">
          <input
            className={FORM_CONTROL_CLASS}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </FormRow>
        <FormRow label="Nhóm">
          <input
            className={FORM_CONTROL_CLASS}
            value={form.category}
            onChange={(event) => setForm({ ...form, category: event.target.value })}
          />
        </FormRow>
        <FormRow label="Nguyên giá">
          <input
            className={FORM_CONTROL_CLASS}
            value={form.cost}
            onChange={(event) => setForm({ ...form, cost: event.target.value })}
          />
        </FormRow>
        <FormRow label="Ngày nhập">
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={form.date}
            onChange={(event) => setForm({ ...form, date: event.target.value })}
          />
        </FormRow>
      </FormBlock>
      <FormButtons
        busy={create.isPending}
        disabled={!form.code || !form.name || !form.category || !form.cost}
        onCancel={onCancel}
      />
    </form>
  );
}

// Cấp phát, cho mượn, thu hồi hoặc nhận trả, ghi nhận hỏng của một tài sản, mở ngay dưới dòng của tài sản
function AssetActions({ asset, onDone }: { asset: Asset; onDone(message: string): void }) {
  const [holder, setHolder] = useState('');
  const [dueDate, setDueDate] = useState(vietnamToday);
  const [description, setDescription] = useState('');
  const action = useMutation({
    mutationFn: async (kind: 'assign' | 'lend' | 'return' | 'damage') => {
      const detail = await getJson<{
        assignments: Array<{ id: string; returned_on: string | null }>;
        loans: Array<{ id: string; status: string }>;
      }>(`/api/v1/assets/${asset.id}`);
      const today = vietnamToday();
      if (kind === 'assign') {
        await postJson('/api/v1/asset-assignments', {
          asset_id: asset.id,
          assigned_to_type: 'room',
          assigned_to_name: holder,
          received_by_name: holder,
          assigned_on: today,
        });
        return 'Đã cấp phát tài sản';
      }
      if (kind === 'lend') {
        await postJson('/api/v1/asset-loans', {
          asset_id: asset.id,
          borrower_name: holder,
          from_date: today,
          due_date: dueDate,
        });
        return 'Đã ghi phiếu mượn';
      }
      if (kind === 'damage') {
        await postJson('/api/v1/asset-damages', {
          asset_id: asset.id,
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
    onSuccess: (message) => onDone(message),
  });
  return (
    <div className="flex flex-col gap-3" role="group" aria-label={`Thao tác tài sản ${asset.code}`}>
      {action.error ? <Alert tone="danger">{messageOf(action.error)}</Alert> : null}
      <FormBlock title={`Thao tác tài sản ${asset.code} ${asset.name}`}>
        <FormRow label="Nơi nhận hoặc người mượn">
          <input className={FORM_CONTROL_CLASS} value={holder} onChange={(event) => setHolder(event.target.value)} />
        </FormRow>
        <FormRow label="Hạn trả">
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </FormRow>
        <FormRow label="Mô tả hỏng">
          <input
            className={FORM_CONTROL_CLASS}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </FormRow>
      </FormBlock>
      <div className="flex flex-wrap gap-2">
        <Button disabled={!holder || action.isPending} onClick={() => action.mutate('assign')}>
          Cấp phát
        </Button>
        <Button disabled={!holder || action.isPending} onClick={() => action.mutate('lend')}>
          Cho mượn
        </Button>
        <Button disabled={action.isPending} onClick={() => action.mutate('return')}>
          Thu hồi hoặc nhận trả
        </Button>
        <Button disabled={!description || action.isPending} onClick={() => action.mutate('damage')}>
          Ghi nhận hỏng
        </Button>
      </div>
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
  const assetGrid = useGridSettings('assets');
  const damageGrid = useGridSettings('asset-damages');
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<Asset['status'] | ''>('');
  const [damageSearch, setDamageSearch] = useState('');
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
  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      postJson(
        `/api/v1/asset-damages/${id}/${approve ? 'approve' : 'reject'}`,
        approve ? {} : { note: 'Không đồng ý' },
      ),
    onSuccess: () => refresh('Đã xử lý ghi nhận hỏng mất'),
  });
  const error = [assets.error, damages.error, decide.error, assetGrid.error, damageGrid.error].find(Boolean);
  const assetRows = (assets.data ?? []).filter(
    (asset) =>
      (status === '' || asset.status === status) &&
      matchesSearch(search, asset.code, asset.name, asset.category, asset.location_name),
  );
  const damageRows = (damages.data ?? []).filter((damage) =>
    matchesSearch(damageSearch, damage.code, damage.asset_code, damage.asset_name, damage.description),
  );
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {canManage && creating ? (
        <FormPanel>
          <AssetForm
            orgUnitId={orgUnitId}
            onCancel={() => setCreating(false)}
            onSaved={(message) => {
              setCreating(false);
              void refresh(message);
            }}
          />
        </FormPanel>
      ) : null}
      <DataGrid
        label="Danh mục tài sản"
        columns={ASSET_COLUMNS}
        rows={assetRows}
        getRowId={(asset) => asset.id}
        getRowLabel={(asset) => `tài sản ${asset.code}`}
        loading={assets.isPending}
        emptyText="Đơn vị chưa có tài sản."
        search={{ label: 'Tìm theo mã, tên, nhóm, vị trí', value: search, onChange: setSearch }}
        advancedSearch={
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-label font-medium text-text">
              Trạng thái tài sản
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as typeof status)}
                className={filterClass}
              >
                <option value="">Tất cả</option>
                {Object.entries(ASSET_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
        toolbar={
          canManage ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Thêm mới
            </Button>
          ) : null
        }
        rowActions={
          canManage
            ? (asset) => (
                <Button variant="text" onClick={() => setSelectedId(selectedId === asset.id ? undefined : asset.id)}>
                  Thao tác
                </Button>
              )
            : undefined
        }
        activeRowId={selectedId}
        renderRowDetail={(asset) =>
          canManage && selectedId === asset.id ? (
            <AssetActions key={asset.id} asset={asset} onDone={(message) => void refresh(message)} />
          ) : null
        }
        settings={assetGrid.settings}
        onSettingsChange={assetGrid.update}
      />
      <h2 className="text-section-title font-semibold text-text">Hỏng và mất chờ duyệt</h2>
      <DataGrid
        label="Hỏng và mất chờ duyệt"
        columns={DAMAGE_COLUMNS}
        rows={damageRows}
        getRowId={(damage) => damage.id}
        getRowLabel={(damage) => `ghi nhận ${damage.code}`}
        loading={damages.isPending}
        emptyText="Không có ghi nhận hỏng, mất chờ duyệt."
        search={{ label: 'Tìm theo mã, tài sản, mô tả', value: damageSearch, onChange: setDamageSearch }}
        rowActions={
          canApprove
            ? (damage) => (
                <span className="flex flex-wrap justify-end gap-2">
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
                </span>
              )
            : undefined
        }
        settings={damageGrid.settings}
        onSettingsChange={damageGrid.update}
      />
    </div>
  );
}

const COUNT_COLUMNS: Array<DataGridColumn<StockCount>> = [
  { id: 'code', header: 'Biên bản', alwaysVisible: true, className: 'font-medium', cell: (count) => count.code },
  { id: 'count_date', header: 'Ngày kiểm kê', cell: (count) => count.count_date },
  { id: 'status', header: 'Trạng thái', cell: (count) => COUNT_STATUS_LABELS[count.status] },
  { id: 'reject_reason', header: 'Lý do từ chối', hiddenByDefault: true, cell: (count) => count.reject_reason ?? '' },
];

function CountForm({
  orgUnitId,
  items,
  onSaved,
  onCancel,
}: {
  orgUnitId: string;
  items: StockItem[];
  onSaved(count: StockCount): void;
  onCancel(): void;
}) {
  const [actual, setActual] = useState<Record<string, string>>({});
  const create = useMutation({
    mutationFn: () =>
      postJson<StockCount>('/api/v1/stock-counts', {
        org_unit_id: orgUnitId,
        count_date: vietnamToday(),
        lines: Object.entries(actual)
          .filter(([, value]) => value !== '')
          .map(([stockItemId, value]) => ({ stock_item_id: stockItemId, actual_qty: toNumber(value) })),
      }),
    onSuccess: onSaved,
  });
  return (
    <form
      aria-label="Lập biên bản kiểm kê"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
      <FormBlock title="Lập biên bản kiểm kê">
        {items
          .filter((item) => item.status === 'active')
          .map((item) => (
            <FormRow
              key={item.id}
              label={`Thực tế ${item.code} ${item.name} (hệ thống ${item.current_qty} ${item.unit})`}
            >
              <input
                className={FORM_CONTROL_CLASS}
                value={actual[item.id] ?? ''}
                onChange={(event) => setActual((previous) => ({ ...previous, [item.id]: event.target.value }))}
              />
            </FormRow>
          ))}
      </FormBlock>
      <FormButtons
        busy={create.isPending}
        disabled={Object.values(actual).every((value) => value === '')}
        onCancel={onCancel}
      />
    </form>
  );
}

// Chi tiết một biên bản kiểm kê và bước duyệt điều chỉnh tồn, mở ngay dưới dòng của biên bản
function CountDetail({
  countId,
  canApprove,
  onDecided,
}: {
  countId: string;
  canApprove: boolean;
  onDecided(count: StockCount): void;
}) {
  const [reason, setReason] = useState('');
  const detail = useQuery({
    queryKey: ['stock-count', countId],
    queryFn: () => getJson<StockCount>(`/api/v1/stock-counts/${countId}`),
  });
  const decide = useMutation({
    mutationFn: (approve: boolean) =>
      postJson<StockCount>(
        `/api/v1/stock-counts/${countId}/${approve ? 'approve' : 'reject'}`,
        approve ? {} : { reason },
      ),
    onSuccess: onDecided,
  });
  const error = detail.error ?? decide.error;
  return (
    <section className="flex flex-col gap-2" aria-label="Chi tiết biên bản kiểm kê">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {detail.data ? (
        <>
          <table className="w-full text-content">
            <thead className="text-left text-label font-medium text-text-secondary">
              <tr>
                <th className="px-3 py-2">Mặt hàng</th>
                <th className="px-3 py-2">Hệ thống</th>
                <th className="px-3 py-2">Thực tế</th>
                <th className="px-3 py-2">Chênh lệch</th>
              </tr>
            </thead>
            <tbody>
              {(detail.data.lines ?? []).map((line) => (
                <tr key={line.stock_item_id} className="border-t border-border">
                  <td className="px-3 py-2">
                    {line.item_code} {line.item_name}
                  </td>
                  <td className="px-3 py-2">{line.system_qty}</td>
                  <td className="px-3 py-2">{line.actual_qty}</td>
                  <td className="px-3 py-2">{line.difference}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {canApprove && detail.data.status === 'pending' ? (
            <div className="flex flex-col gap-3">
              <FormBlock title="Duyệt biên bản kiểm kê">
                <FormRow label="Lý do từ chối">
                  <input
                    className={FORM_CONTROL_CLASS}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </FormRow>
              </FormBlock>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" disabled={decide.isPending} onClick={() => decide.mutate(true)}>
                  Duyệt điều chỉnh tồn
                </Button>
                <Button variant="text" disabled={decide.isPending || !reason} onClick={() => decide.mutate(false)}>
                  Từ chối
                </Button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
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
  const grid = useGridSettings('stock-counts');
  const items = useStockItems(orgUnitId);
  const [creating, setCreating] = useState(false);
  const [countId, setCountId] = useState<string>();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StockCount['status'] | ''>('');
  const counts = useQuery({
    queryKey: ['stock-counts', orgUnitId],
    queryFn: () => getJson<StockCount[]>(`/api/v1/stock-counts?org_unit_id=${orgUnitId}`),
  });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['stock-counts'] });
    await queryClient.invalidateQueries({ queryKey: ['stock-count'] });
    await queryClient.invalidateQueries({ queryKey: ['stock-items'] });
    onDone(message);
  };
  const error = [items.error, counts.error, grid.error].find(Boolean);
  const rows = (counts.data ?? []).filter(
    (count) => (status === '' || count.status === status) && matchesSearch(search, count.code, count.count_date),
  );
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {canManage && creating ? (
        <FormPanel>
          <CountForm
            orgUnitId={orgUnitId}
            items={items.data ?? []}
            onCancel={() => setCreating(false)}
            onSaved={(count) => {
              setCreating(false);
              setCountId(count.id);
              void refresh(`Đã lập biên bản ${count.code}: ${COUNT_STATUS_LABELS[count.status]}`);
            }}
          />
        </FormPanel>
      ) : null}
      <DataGrid
        label="Biên bản kiểm kê"
        columns={COUNT_COLUMNS}
        rows={rows}
        getRowId={(count) => count.id}
        getRowLabel={(count) => `biên bản ${count.code}`}
        loading={counts.isPending}
        emptyText="Chưa có biên bản kiểm kê."
        search={{ label: 'Tìm theo mã biên bản, ngày', value: search, onChange: setSearch }}
        advancedSearch={
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-label font-medium text-text">
              Trạng thái biên bản
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as typeof status)}
                className={filterClass}
              >
                <option value="">Tất cả</option>
                {Object.entries(COUNT_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
        toolbar={
          canManage ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Thêm mới
            </Button>
          ) : null
        }
        rowActions={(count) => (
          <Button variant="text" onClick={() => setCountId(countId === count.id ? undefined : count.id)}>
            Xem chi tiết
          </Button>
        )}
        activeRowId={countId}
        renderRowDetail={(count) =>
          countId === count.id ? (
            <CountDetail
              countId={count.id}
              canApprove={canApprove}
              onDecided={(decided) => void refresh(`Biên bản ${decided.code}: ${COUNT_STATUS_LABELS[decided.status]}`)}
            />
          ) : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </div>
  );
}

const SUPPLIER_COLUMNS: Array<DataGridColumn<Supplier>> = [
  { id: 'name', header: 'Tên', alwaysVisible: true, className: 'font-medium', cell: (supplier) => supplier.name },
  { id: 'tax_code', header: 'Mã số thuế', cell: (supplier) => supplier.tax_code ?? '' },
  {
    id: 'contact_name',
    header: 'Người liên hệ',
    hiddenByDefault: true,
    cell: (supplier) => supplier.contact_name ?? '',
  },
  { id: 'phone', header: 'Điện thoại', cell: (supplier) => supplier.phone ?? '' },
  { id: 'payment_terms', header: 'Điều khoản', cell: (supplier) => supplier.payment_terms ?? '' },
  {
    id: 'status',
    header: 'Trạng thái',
    hiddenByDefault: true,
    cell: (supplier) => (supplier.status === 'active' ? 'Đang dùng' : 'Ngừng dùng'),
  },
];

function SupplierForm({ orgUnitId, onSaved, onCancel }: { orgUnitId: string; onSaved: Notify; onCancel(): void }) {
  const [form, setForm] = useState({ name: '', tax_code: '', phone: '', payment_terms: '' });
  const create = useMutation({
    mutationFn: () => postJson<Supplier>('/api/v1/suppliers', { org_unit_id: orgUnitId, ...form }),
    onSuccess: (supplier) => onSaved(`Đã thêm nhà cung cấp ${supplier.name}`),
  });
  return (
    <form
      aria-label="Thêm nhà cung cấp"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
      <FormBlock title="Thêm nhà cung cấp">
        <FormRow label="Tên nhà cung cấp">
          <input
            className={FORM_CONTROL_CLASS}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </FormRow>
        <FormRow label="Mã số thuế">
          <input
            className={FORM_CONTROL_CLASS}
            value={form.tax_code}
            onChange={(event) => setForm({ ...form, tax_code: event.target.value })}
          />
        </FormRow>
        <FormRow label="Điện thoại">
          <input
            className={FORM_CONTROL_CLASS}
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
        </FormRow>
        <FormRow label="Điều khoản">
          <input
            className={FORM_CONTROL_CLASS}
            value={form.payment_terms}
            onChange={(event) => setForm({ ...form, payment_terms: event.target.value })}
          />
        </FormRow>
      </FormBlock>
      <FormButtons busy={create.isPending} disabled={!form.name} onCancel={onCancel} />
    </form>
  );
}

function SuppliersTab({ orgUnitId, onDone }: { orgUnitId: string; onDone: Notify }) {
  const queryClient = useQueryClient();
  const grid = useGridSettings('suppliers');
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const suppliers = useQuery({
    queryKey: ['suppliers', orgUnitId],
    queryFn: () => getJson<Supplier[]>(`/api/v1/suppliers?org_unit_id=${orgUnitId}`),
  });
  const error = suppliers.error ?? grid.error;
  const rows = (suppliers.data ?? []).filter((supplier) =>
    matchesSearch(search, supplier.name, supplier.tax_code, supplier.phone),
  );
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {creating ? (
        <FormPanel>
          <SupplierForm
            orgUnitId={orgUnitId}
            onCancel={() => setCreating(false)}
            onSaved={async (message) => {
              setCreating(false);
              await queryClient.invalidateQueries({ queryKey: ['suppliers'] });
              onDone(message);
            }}
          />
        </FormPanel>
      ) : null}
      <DataGrid
        label="Nhà cung cấp"
        columns={SUPPLIER_COLUMNS}
        rows={rows}
        getRowId={(supplier) => supplier.id}
        getRowLabel={(supplier) => supplier.name}
        loading={suppliers.isPending}
        emptyText="Đơn vị chưa có nhà cung cấp."
        search={{ label: 'Tìm theo tên, mã số thuế, điện thoại', value: search, onChange: setSearch }}
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
