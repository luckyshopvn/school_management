import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, ConfirmDialog, StatusBadge, TextField } from '@school-management/ui';
import {
  closeStocktake,
  CONDITION_LABELS,
  formatDate,
  listStocktakes,
  readStocktake,
  resolveStocktake,
  scanStocktake,
  startStocktake,
  type ScanResult,
  type Stocktake,
  type StocktakeItem,
} from './library-api.js';
import {
  EmptyRow,
  ErrorAlert,
  HEAD_CLASS,
  LibraryFrame,
  Panel,
  ReasonDialog,
  SELECT_CLASS,
  TH_CLASS,
  toggleId,
  useToast,
} from './library-common.js';

// Kiểm kê thư viện (DT-22 phần 22a, tài liệu 32 mục 13.4, YCTD-181): mở đợt cho cả kho hoặc một kệ, quét mã từng bản sao
// (cảnh báo bản quét trùng, bản ngoài kệ), đối chiếu với sổ ra bản thiếu, thừa, hỏng; đóng đợt rồi xử lý bản thiếu bằng cách
// đánh dấu mất hoặc thanh lý, có lý do

function ItemTable({
  title,
  items,
  selectable,
  selected,
  onToggle,
}: {
  title: string;
  items: StocktakeItem[];
  selectable?: boolean;
  selected?: string[];
  onToggle?(id: string): void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-section-title font-semibold text-text">
        {title} ({items.length})
      </h3>
      <table className="w-full text-content" aria-label={title}>
        <thead className={HEAD_CLASS}>
          <tr>
            {selectable ? <th className={TH_CLASS} /> : null}
            <th className={TH_CLASS}>Số đăng ký</th>
            <th className={TH_CLASS}>Nhan đề</th>
            <th className={TH_CLASS}>Kệ</th>
            <th className={TH_CLASS}>Tình trạng</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? <EmptyRow columns={selectable ? 5 : 4} message="Không có" /> : null}
          {items.map((item) => (
            <tr key={item.id} className="border-t border-border">
              {selectable ? (
                <td className={TH_CLASS}>
                  <input
                    type="checkbox"
                    aria-label={`Chọn bản ${item.copy_no}`}
                    checked={selected?.includes(item.id) ?? false}
                    onChange={() => onToggle?.(item.id)}
                  />
                </td>
              ) : null}
              <td className={TH_CLASS}>{item.copy_no}</td>
              <td className={TH_CLASS}>
                {item.title}
                {item.on_loan ? ' (đang cho mượn)' : ''}
              </td>
              <td className={TH_CLASS}>{item.shelf ?? ''}</td>
              <td className={TH_CLASS}>{CONDITION_LABELS[item.condition]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StocktakeDetail({
  stocktake,
  onChanged,
  onDone,
}: {
  stocktake: Stocktake;
  onChanged(): void;
  onDone(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [scans, setScans] = useState<ScanResult[]>([]);
  const [closing, setClosing] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [action, setAction] = useState<'lost' | 'dispose'>('lost');
  const [resolving, setResolving] = useState(false);
  const report = useQuery({
    queryKey: ['library-stocktake', stocktake.id],
    queryFn: () => readStocktake(stocktake.id),
  });
  const isOpen = stocktake.status === 'open';
  const scan = useMutation({
    mutationFn: () => scanStocktake(stocktake.id, code.trim()),
    onSuccess: (result) => {
      setScans([result, ...scans].slice(0, 30));
      setCode('');
      onChanged();
    },
  });
  const close = useMutation({
    mutationFn: () => closeStocktake(stocktake.id),
    onSuccess: async () => {
      setClosing(false);
      await queryClient.invalidateQueries({ queryKey: ['library-stocktake', stocktake.id] });
      onChanged();
      onDone('Đã đóng đợt kiểm kê');
    },
    onError: () => setClosing(false),
  });
  const resolve = useMutation({
    mutationFn: (reason: string) => resolveStocktake(stocktake.id, { copy_ids: selected, action, reason }),
    onSuccess: async () => {
      setResolving(false);
      setSelected([]);
      await queryClient.invalidateQueries({ queryKey: ['library-stocktake', stocktake.id] });
      await queryClient.invalidateQueries({ queryKey: ['library-titles'] });
      onDone(action === 'lost' ? 'Đã đánh dấu mất các bản thiếu' : 'Đã thanh lý các bản thiếu');
    },
    onError: () => setResolving(false),
  });
  const data = report.data;
  // Bản thiếu còn được xử lý khi chưa mất, chưa thanh lý
  const processable = (data?.missing ?? []).filter((item) => item.condition === 'good' || item.condition === 'damaged');
  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-section-title font-semibold text-text">
          {stocktake.name}
          {stocktake.shelf ? ` (kệ ${stocktake.shelf})` : ' (cả kho)'}
        </h2>
        <StatusBadge tone={isOpen ? 'info' : 'neutral'} label={isOpen ? 'Đang kiểm kê' : 'Đã đóng'} />
      </div>
      {isOpen ? (
        <>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (code.trim() !== '') {
                scan.mutate();
              }
            }}
          >
            <TextField
              label="Quét hoặc nhập mã bản sao rồi nhấn Enter"
              value={code}
              autoFocus
              onChange={(event) => setCode(event.target.value)}
            />
            <Button type="submit" variant="primary" disabled={scan.isPending || code.trim() === ''}>
              Ghi nhận
            </Button>
            <Button disabled={close.isPending} onClick={() => setClosing(true)}>
              Đóng đợt kiểm kê
            </Button>
          </form>
          <ErrorAlert error={scan.error ?? close.error} />
          <p className="text-content text-text-secondary">Đã quét {scans[0]?.scanned ?? stocktake.scanned} bản.</p>
          <ul className="flex flex-col gap-1 text-content">
            {scans.map((item, index) => (
              <li key={`${item.copy_no}-${index}`}>
                <span className="font-semibold">{item.copy_no}</span> {item.title}
                {item.duplicate ? <span className="ml-2 text-warning">Quét trùng</span> : null}
                {item.outside_shelf ? (
                  <span className="ml-2 text-warning">
                    Ngoài kệ {stocktake.shelf}, đang ở kệ {item.shelf ?? 'chưa gán'}
                  </span>
                ) : null}
                {item.on_loan ? <span className="ml-2 text-info">Đang cho mượn</span> : null}
                {item.condition !== 'good' ? (
                  <span className="ml-2 text-danger">{CONDITION_LABELS[item.condition]}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={report.isFetching} onClick={() => void report.refetch()}>
          Làm mới kết quả
        </Button>
        {data ? (
          <span className="text-content text-text-secondary">
            Theo sổ {data.expected} bản, tìm thấy {data.found}, thiếu {data.missing.length}, thừa {data.surplus.length},
            hỏng {data.damaged.length}
            {isOpen ? ' (kết quả tạm, chưa đóng đợt)' : ''}
          </span>
        ) : null}
      </div>
      <ErrorAlert error={report.error ?? resolve.error} />
      {data ? (
        <>
          {isOpen ? (
            <Alert tone="info">Bản đang cho mượn không tính là thiếu. Đóng đợt rồi mới xử lý được bản thiếu.</Alert>
          ) : null}
          {!isOpen ? (
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-2 text-label font-medium text-text">
                Xử lý bản thiếu đã chọn
                <select
                  value={action}
                  onChange={(event) => setAction(event.target.value as 'lost' | 'dispose')}
                  className={SELECT_CLASS}
                >
                  <option value="lost">Đánh dấu mất</option>
                  <option value="dispose">Thanh lý</option>
                </select>
              </label>
              <Button
                variant="primary"
                disabled={selected.length === 0 || resolve.isPending}
                onClick={() => setResolving(true)}
              >
                Xử lý ({selected.length})
              </Button>
              <Button
                onClick={() =>
                  setSelected(selected.length === processable.length ? [] : processable.map((item) => item.id))
                }
              >
                {selected.length === processable.length && processable.length > 0
                  ? 'Bỏ chọn hết'
                  : 'Chọn hết bản thiếu'}
              </Button>
            </div>
          ) : null}
          <ItemTable
            title="Bản thiếu"
            items={data.missing}
            selectable={!isOpen}
            selected={selected}
            onToggle={(id) => setSelected(toggleId(selected, id))}
          />
          <ItemTable title="Bản thừa (đã quét nhưng đang cho mượn, đã mất hoặc đã thanh lý)" items={data.surplus} />
          <ItemTable title="Bản hỏng" items={data.damaged} />
        </>
      ) : null}
      <ConfirmDialog
        open={closing}
        title="Đóng đợt kiểm kê"
        confirmLabel="Đóng đợt"
        busy={close.isPending}
        onConfirm={() => close.mutate()}
        onCancel={() => setClosing(false)}
      >
        Đóng đợt {stocktake.name} thì không quét thêm được nữa. Bản chưa quét được tính là thiếu.
      </ConfirmDialog>
      <ReasonDialog
        open={resolving}
        title={action === 'lost' ? 'Đánh dấu mất bản thiếu' : 'Thanh lý bản thiếu'}
        description={`Xử lý ${selected.length} bản thiếu đã chọn của đợt ${stocktake.name}.`}
        confirmLabel={action === 'lost' ? 'Đánh dấu mất' : 'Thanh lý'}
        busy={resolve.isPending}
        onConfirm={(reason) => resolve.mutate(reason)}
        onCancel={() => setResolving(false)}
      />
    </Panel>
  );
}

export function LibraryStocktakesPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [shelf, setShelf] = useState('');
  const [openId, setOpenId] = useState<string>();
  const stocktakes = useQuery({ queryKey: ['library-stocktakes'], queryFn: listStocktakes });
  const create = useMutation({
    mutationFn: () => startStocktake(name.trim(), shelf.trim() || null),
    onSuccess: async (created) => {
      setName('');
      setShelf('');
      setOpenId(created.id);
      await queryClient.invalidateQueries({ queryKey: ['library-stocktakes'] });
      toast.show('Đã mở đợt kiểm kê');
    },
  });
  const current = stocktakes.data?.find((item) => item.id === openId);
  return (
    <LibraryFrame path="/library/stocktakes" toast={toast}>
      <Panel>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim() !== '') {
              create.mutate();
            }
          }}
        >
          <TextField label="Tên đợt kiểm kê" value={name} onChange={(event) => setName(event.target.value)} />
          <TextField label="Kệ (trống là cả kho)" value={shelf} onChange={(event) => setShelf(event.target.value)} />
          <Button type="submit" variant="primary" disabled={create.isPending || name.trim() === ''}>
            Mở đợt kiểm kê
          </Button>
        </form>
        <ErrorAlert error={create.error ?? stocktakes.error} />
        <table className="w-full text-content" aria-label="Các đợt kiểm kê">
          <thead className={HEAD_CLASS}>
            <tr>
              <th className={TH_CLASS}>Đợt</th>
              <th className={TH_CLASS}>Phạm vi</th>
              <th className={TH_CLASS}>Bắt đầu</th>
              <th className={TH_CLASS}>Đã quét</th>
              <th className={TH_CLASS}>Trạng thái</th>
              <th className={TH_CLASS} />
            </tr>
          </thead>
          <tbody>
            {stocktakes.data && stocktakes.data.length === 0 ? (
              <EmptyRow columns={6} message="Chưa có đợt kiểm kê" />
            ) : null}
            {(stocktakes.data ?? []).map((item) => (
              <tr key={item.id} className="border-t border-border">
                <td className={`${TH_CLASS} font-semibold`}>{item.name}</td>
                <td className={TH_CLASS}>{item.shelf ? `Kệ ${item.shelf}` : 'Cả kho'}</td>
                <td className={TH_CLASS}>
                  {formatDate(item.started_at)}, {item.started_by_name}
                </td>
                <td className={TH_CLASS}>{item.scanned}</td>
                <td className={TH_CLASS}>
                  <StatusBadge
                    tone={item.status === 'open' ? 'info' : 'neutral'}
                    label={item.status === 'open' ? 'Đang kiểm kê' : 'Đã đóng'}
                  />
                </td>
                <td className={TH_CLASS}>
                  <Button aria-label={`Mở ${item.name}`} onClick={() => setOpenId(item.id)}>
                    {item.status === 'open' ? 'Quét, xem' : 'Xem kết quả'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      {current ? (
        <StocktakeDetail
          key={current.id}
          stocktake={current}
          onChanged={() => void queryClient.invalidateQueries({ queryKey: ['library-stocktakes'] })}
          onDone={toast.show}
        />
      ) : null}
    </LibraryFrame>
  );
}
