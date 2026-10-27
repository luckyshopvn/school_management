import { Fragment, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button.js';
import { TextField } from './TextField.js';
import { DIALOG_NARROW_FULL_SCREEN_CLASS } from './dialog.js';

// Lưới dữ liệu dùng chung của cổng quản trị theo mẫu màn hình danh sách của Sở (DT-15 phần 15a): thanh công cụ có ô tìm
// kiếm, "Mở rộng tìm kiếm", nút riêng của màn hình; ô chọn từng dòng và chọn cả trang; thao tác trên dòng; cấu hình cột
// hiển thị (ẩn, hiện, thứ tự); số dòng mỗi trang 10–200 và phân trang. Cấu hình do màn hình truyền vào để nhớ theo người
// dùng ở máy chủ

// Khớp DATA_GRID_PAGE_SIZES ở @school-management/shared
export const DATA_GRID_PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200] as const;

export interface DataGridColumn<Row> {
  id: string;
  header: string;
  cell(row: Row): ReactNode;
  // Cột luôn hiện, không bỏ được trong Cấu hình cột hiển thị
  alwaysVisible?: boolean;
  // Mặc định ẩn, người dùng tự bật trong Cấu hình cột hiển thị
  hiddenByDefault?: boolean;
  // Cột chính (mã, tên) làm tiêu đề thẻ ở khổ hẹp (DT-26 phần 26e); không khai báo thì lấy cột đầu đang hiện
  primary?: boolean;
  className?: string;
}

// Khổ từ 768 px hiện bảng (cuộn ngang trong khung, cột đầu cố định); hẹp hơn hiện dạng thẻ. Đọc theo matchMedia để chỉ dựng một
// dạng (dựng cả hai rồi ẩn bằng CSS thì mỗi ô có hai bản trong trang)
const WIDE_LAYOUT_QUERY = '(min-width: 768px)';

function useWideLayout(): boolean {
  const [wide, setWide] = useState(() =>
    typeof window === 'undefined' || typeof window.matchMedia !== 'function'
      ? true
      : window.matchMedia(WIDE_LAYOUT_QUERY).matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const media = window.matchMedia(WIDE_LAYOUT_QUERY);
    const update = () => setWide(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return wide;
}

// Ở dạng thẻ hiện ngay tối đa ngần này cột phụ, các cột còn lại thu vào "Xem thêm"
const CARD_VISIBLE_SECONDARY_COLUMNS = 3;

export interface DataGridViewSettings {
  // Mã cột hiển thị theo thứ tự; null là theo mặc định của lưới
  columns: string[] | null;
  pageSize: number;
}

export interface DataGridProperties<Row> {
  label: string;
  columns: Array<DataGridColumn<Row>>;
  rows: Row[];
  getRowId(row: Row): string;
  // Tên dòng dùng cho ô chọn ("Chọn …") và nút thao tác
  getRowLabel(row: Row): string;
  // Nhãn đọc của cả dòng, bỏ trống thì không đặt
  getRowAriaLabel?(row: Row): string;
  loading?: boolean;
  emptyText?: string;
  search?: { label?: string; value: string; onChange(value: string): void };
  // Nội dung bộ lọc mở rộng, hiện khi bấm "Mở rộng tìm kiếm"
  advancedSearch?: ReactNode;
  // Nút riêng của màn hình (Thêm mới, Xuất Excel…); dạng hàm nhận các dòng đang chọn
  toolbar?: ReactNode | ((selectedRows: Row[]) => ReactNode);
  selectable?: boolean;
  rowActions?(row: Row): ReactNode;
  // Dòng chi tiết mở ngay dưới dòng dữ liệu; trả null thì không có
  renderRowDetail?(row: Row): ReactNode;
  onRowClick?(row: Row): void;
  activeRowId?: string;
  settings: DataGridViewSettings;
  onSettingsChange(next: DataGridViewSettings): void;
  // Phân trang ở máy chủ: lưới hiện đúng các dòng được truyền vào, tổng số dòng do máy chủ trả
  serverPagination?: { page: number; total: number; onPageChange(page: number): void };
  // Xuất PDF (DT-16 phần 16a): có thì lưới hiện nút "Xuất PDF" cạnh nút của màn hình; nhận mã các cột đang hiện theo thứ tự
  // để máy chủ xuất đúng cột như Xuất Excel. Trả chuỗi thì lưới hiện thành thông báo (ví dụ đã tạo tác vụ xuất nền); lỗi thì
  // lưới hiện nội dung lỗi
  exportPdf?(visibleColumnIds: string[]): Promise<string | void>;
}

// Cột đang hiển thị theo cấu hình; cột luôn hiện mà cấu hình thiếu thì thêm vào cuối
export function resolveVisibleColumns<Row>(
  columns: Array<DataGridColumn<Row>>,
  configured: string[] | null,
): Array<DataGridColumn<Row>> {
  if (!configured) {
    return columns.filter((column) => !column.hiddenByDefault);
  }
  const byId = new Map(columns.map((column) => [column.id, column]));
  const visible = configured.flatMap((id) => {
    const column = byId.get(id);
    return column ? [column] : [];
  });
  for (const column of columns) {
    if (column.alwaysVisible && !visible.includes(column)) {
      visible.push(column);
    }
  }
  return visible;
}

function ColumnSettingsDialog<Row>({
  open,
  columns,
  visibleIds,
  onSave,
  onCancel,
}: {
  open: boolean;
  columns: Array<DataGridColumn<Row>>;
  visibleIds: string[];
  onSave(columns: string[] | null): void;
  onCancel(): void;
}) {
  const dialogReference = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // Thứ tự: cột đang hiện theo thứ tự hiện, sau đó các cột đang ẩn
  const initialOrder = () => [
    ...visibleIds,
    ...columns.map((column) => column.id).filter((id) => !visibleIds.includes(id)),
  ];
  const [order, setOrder] = useState<string[]>(initialOrder);
  const [shown, setShown] = useState<Set<string>>(() => new Set(visibleIds));

  useEffect(() => {
    const dialog = dialogReference.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const byId = new Map(columns.map((column) => [column.id, column]));
  const move = (index: number, offset: number) => {
    const target = index + offset;
    if (target < 0 || target >= order.length) {
      return;
    }
    const next = [...order];
    const [item] = next.splice(index, 1);
    if (item !== undefined) {
      next.splice(target, 0, item);
      setOrder(next);
    }
  };
  const defaults = columns.filter((column) => !column.hiddenByDefault).map((column) => column.id);

  return (
    <dialog
      ref={dialogReference}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className={`m-auto w-full max-w-lg rounded-xl border border-border bg-card p-6 text-text shadow-lg backdrop:bg-text/40 ${DIALOG_NARROW_FULL_SCREEN_CLASS}`}
    >
      <h2 id={titleId} className="text-section-title font-semibold">
        Cấu hình cột hiển thị
      </h2>
      <p className="mt-1 text-label text-text-secondary">Tích để hiện cột; dùng nút lên, xuống để đổi thứ tự.</p>
      <ol className="mt-3 flex max-h-[60vh] flex-col gap-1 overflow-y-auto" aria-label="Danh sách cột">
        {order.map((id, index) => {
          const column = byId.get(id);
          if (!column) {
            return null;
          }
          return (
            <li key={id} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-selected">
              <label className="flex flex-1 items-center gap-2 text-content">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={column.alwaysVisible === true || shown.has(id)}
                  disabled={column.alwaysVisible}
                  onChange={(event) => {
                    const next = new Set(shown);
                    if (event.target.checked) {
                      next.add(id);
                    } else {
                      next.delete(id);
                    }
                    setShown(next);
                  }}
                />
                {column.header}
              </label>
              <button
                type="button"
                className="rounded px-1.5 text-label text-text-secondary hover:bg-card disabled:opacity-40"
                aria-label={`Đưa cột ${column.header} lên`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="rounded px-1.5 text-label text-text-secondary hover:bg-card disabled:opacity-40"
                aria-label={`Đưa cột ${column.header} xuống`}
                disabled={index === order.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
            </li>
          );
        })}
      </ol>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button
          variant="text"
          onClick={() => {
            setOrder([...defaults, ...columns.map((column) => column.id).filter((id) => !defaults.includes(id))]);
            setShown(new Set(defaults));
          }}
        >
          Mặc định
        </Button>
        <Button onClick={onCancel}>Hủy</Button>
        <Button
          variant="primary"
          disabled={!order.some((id) => shown.has(id) || byId.get(id)?.alwaysVisible)}
          onClick={() => {
            const next = order.filter((id) => shown.has(id) || byId.get(id)?.alwaysVisible);
            // Trùng mặc định thì lưu null để lưới theo mặc định cả khi thêm cột mới
            onSave(next.join('|') === defaults.join('|') ? null : next);
          }}
        >
          Ghi
        </Button>
      </div>
    </dialog>
  );
}

// Dạng thẻ dưới 768 px (DT-26 phần 26e): mỗi dòng một thẻ, cột chính làm tiêu đề, vài cột phụ đầu tiên hiện ngay, các cột còn lại thu vào
// "Xem thêm"; ô chọn, thao tác, dòng chi tiết giữ như ở bảng. Ô chọn bọc trong nhãn 44 × 44 px cho dễ chạm
function GridCards<Row>({
  label,
  rows,
  primaryColumn,
  secondaryColumns,
  emptyText,
  getRowId,
  getRowLabel,
  getRowAriaLabel,
  selectable,
  selectedIds,
  onToggleRow,
  allPageSelected,
  canSelectPage,
  onTogglePage,
  rowActions,
  renderRowDetail,
  onRowClick,
  activeRowId,
}: {
  label: string;
  rows: Row[];
  primaryColumn: DataGridColumn<Row> | undefined;
  secondaryColumns: Array<DataGridColumn<Row>>;
  emptyText: string;
  getRowId(row: Row): string;
  getRowLabel(row: Row): string;
  getRowAriaLabel?(row: Row): string;
  selectable?: boolean;
  selectedIds: Set<string>;
  onToggleRow(id: string, checked: boolean): void;
  allPageSelected: boolean;
  canSelectPage: boolean;
  onTogglePage(checked: boolean): void;
  rowActions?(row: Row): ReactNode;
  renderRowDetail?(row: Row): ReactNode;
  onRowClick?(row: Row): void;
  activeRowId?: string;
}) {
  const shown = secondaryColumns.slice(0, CARD_VISIBLE_SECONDARY_COLUMNS);
  const more = secondaryColumns.slice(CARD_VISIBLE_SECONDARY_COLUMNS);
  const fields = (row: Row, items: Array<DataGridColumn<Row>>) => (
    <dl className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] gap-x-3 gap-y-1 text-label">
      {items.map((column) => (
        <Fragment key={column.id}>
          <dt className="text-text-secondary">{column.header}</dt>
          <dd className="min-w-0 break-words text-text">{column.cell(row)}</dd>
        </Fragment>
      ))}
    </dl>
  );
  return (
    <div className="flex flex-col gap-2">
      {selectable && canSelectPage ? (
        <label className="flex min-h-11 items-center gap-2 text-label text-text">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={allPageSelected}
            onChange={(event) => onTogglePage(event.target.checked)}
          />
          Chọn tất cả dòng trên trang
        </label>
      ) : null}
      {rows.length === 0 ? <p className="px-1 py-4 text-content text-text-secondary">{emptyText}</p> : null}
      <ul aria-label={label} className="flex flex-col gap-2">
        {rows.map((row) => {
          const id = getRowId(row);
          const detail = renderRowDetail?.(row);
          return (
            <li
              key={id}
              aria-label={getRowAriaLabel?.(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`flex flex-col gap-2 rounded-lg border border-border p-3 ${id === activeRowId ? 'bg-selected' : 'bg-card'} ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              <div className="flex items-start gap-1">
                {selectable ? (
                  <label
                    className="-my-2 -ml-2 flex h-11 w-11 shrink-0 items-center justify-center"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      aria-label={`Chọn ${getRowLabel(row)}`}
                      checked={selectedIds.has(id)}
                      onChange={(event) => onToggleRow(id, event.target.checked)}
                    />
                  </label>
                ) : null}
                <div className="min-w-0 flex-1 break-words text-content font-semibold text-text">
                  {primaryColumn?.cell(row)}
                </div>
              </div>
              {shown.length > 0 ? fields(row, shown) : null}
              {more.length > 0 ? (
                <details onClick={(event) => event.stopPropagation()}>
                  <summary className="flex min-h-11 cursor-pointer items-center text-label font-medium text-link">
                    Xem thêm {more.length} cột
                  </summary>
                  {fields(row, more)}
                </details>
              ) : null}
              {rowActions ? (
                <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                  {rowActions(row)}
                </div>
              ) : null}
              {detail ? <div>{detail}</div> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function DataGrid<Row>({
  label,
  columns,
  rows,
  getRowId,
  getRowLabel,
  getRowAriaLabel,
  loading,
  emptyText = 'Không có dữ liệu.',
  search,
  advancedSearch,
  toolbar,
  selectable,
  rowActions,
  renderRowDetail,
  onRowClick,
  activeRowId,
  settings,
  onSettingsChange,
  serverPagination,
  exportPdf,
}: DataGridProperties<Row>) {
  const [clientPage, setClientPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [configuring, setConfiguring] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfMessage, setPdfMessage] = useState<{ tone: 'info' | 'danger'; text: string }>();
  const advancedId = useId();
  const pageSizeId = useId();
  const selectAllReference = useRef<HTMLInputElement>(null);

  const visibleColumns = useMemo(() => resolveVisibleColumns(columns, settings.columns), [columns, settings.columns]);
  const wide = useWideLayout();
  const primaryColumn = visibleColumns.find((column) => column.primary) ?? visibleColumns[0];
  // Cột đầu (sau ô chọn) dính bên trái khi bảng cuộn ngang; ô chọn rộng 2,5rem nên cột đầu dịch theo
  const stickyFirst = (index: number) =>
    index === 0 ? `sticky z-[1] bg-inherit ${selectable ? 'left-10 max-xl:left-11' : 'left-0'}` : '';
  const pageSize = settings.pageSize;
  const total = serverPagination ? serverPagination.total : rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(serverPagination ? serverPagination.page : clientPage, totalPages);
  const pageRows = serverPagination ? rows : rows.slice((page - 1) * pageSize, page * pageSize);
  // Phân trang ở máy chủ chỉ có dữ liệu của trang đang xem nên đổi trang thì bỏ lựa chọn; phân trang tại chỗ giữ lựa chọn
  const goTo = (next: number) => {
    if (serverPagination) {
      setSelectedIds(new Set());
      serverPagination.onPageChange(next);
    } else {
      setClientPage(next);
    }
  };

  // Chỉ giữ lựa chọn của dòng còn trong danh sách
  const rowIds = new Set(rows.map(getRowId));
  const selectedRows = rows.filter((row) => selectedIds.has(getRowId(row)));
  const pageIds = pageRows.map(getRowId);
  const pageSelectedCount = pageIds.filter((id) => selectedIds.has(id)).length;
  const allPageSelected = pageIds.length > 0 && pageSelectedCount === pageIds.length;

  useEffect(() => {
    if (selectAllReference.current) {
      selectAllReference.current.indeterminate = pageSelectedCount > 0 && !allPageSelected;
    }
  }, [pageSelectedCount, allPageSelected]);

  const toggleRow = (id: string, checked: boolean) => {
    const next = new Set([...selectedIds].filter((selected) => rowIds.has(selected)));
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    setSelectedIds(next);
  };
  const togglePage = (checked: boolean) => {
    const next = new Set([...selectedIds].filter((selected) => rowIds.has(selected)));
    for (const id of pageIds) {
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
    }
    setSelectedIds(next);
  };

  const columnCount = visibleColumns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0);
  const toolbarContent = typeof toolbar === 'function' ? toolbar(selectedRows) : toolbar;
  const runPdfExport = async () => {
    if (!exportPdf) {
      return;
    }
    setPdfBusy(true);
    setPdfMessage(undefined);
    try {
      const notice = await exportPdf(visibleColumns.map((column) => column.id));
      setPdfMessage(notice ? { tone: 'info', text: notice } : undefined);
    } catch (error) {
      setPdfMessage({ tone: 'danger', text: error instanceof Error ? error.message : 'Không xuất được tệp PDF' });
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label={label}>
      <div className="flex flex-wrap items-end gap-3">
        {search ? (
          <TextField
            label={search.label ?? 'Tìm kiếm'}
            type="search"
            value={search.value}
            onChange={(event) => {
              search.onChange(event.target.value);
              goTo(1);
            }}
            className="min-w-56 flex-1"
          />
        ) : null}
        {advancedSearch ? (
          <Button
            aria-expanded={advancedOpen}
            aria-controls={advancedId}
            onClick={() => setAdvancedOpen(!advancedOpen)}
          >
            Mở rộng tìm kiếm
          </Button>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {toolbarContent}
          {exportPdf ? (
            <Button disabled={pdfBusy} onClick={() => void runPdfExport()}>
              Xuất PDF
            </Button>
          ) : null}
          <Button onClick={() => setConfiguring(true)}>Cấu hình cột hiển thị</Button>
        </div>
      </div>
      {pdfMessage ? (
        <p
          role={pdfMessage.tone === 'danger' ? 'alert' : 'status'}
          className={`text-label ${pdfMessage.tone === 'danger' ? 'text-danger' : 'text-text-secondary'}`}
        >
          {pdfMessage.text}
        </p>
      ) : null}
      {advancedSearch ? (
        <div
          id={advancedId}
          role="region"
          aria-label="Mở rộng tìm kiếm"
          hidden={!advancedOpen}
          className="rounded-lg border border-border bg-page p-3"
        >
          {advancedSearch}
        </div>
      ) : null}
      {selectable ? (
        <p className="text-label text-text-secondary" aria-live="polite">
          {selectedRows.length > 0 ? `Đã chọn ${selectedRows.length} dòng` : ''}
        </p>
      ) : null}
      {loading ? (
        <div className="h-40 animate-pulse rounded bg-border" aria-hidden="true" />
      ) : !wide ? (
        <GridCards
          label={label}
          rows={pageRows}
          primaryColumn={primaryColumn}
          secondaryColumns={visibleColumns.filter((column) => column !== primaryColumn)}
          emptyText={emptyText}
          getRowId={getRowId}
          getRowLabel={getRowLabel}
          getRowAriaLabel={getRowAriaLabel}
          selectable={selectable}
          selectedIds={selectedIds}
          onToggleRow={toggleRow}
          allPageSelected={allPageSelected}
          canSelectPage={pageIds.length > 0}
          onTogglePage={togglePage}
          rowActions={rowActions}
          renderRowDetail={renderRowDetail}
          onRowClick={onRowClick}
          activeRowId={activeRowId}
        />
      ) : (
        <div className="relative overflow-x-auto">
          {/* relative: phần tử ẩn định vị tuyệt đối trong bảng (sr-only) nhận khung cuộn làm khối chứa, không kéo rộng cả trang */}
          <table className="w-full text-content">
            <caption className="sr-only">{label}</caption>
            <thead className="bg-card text-left text-label font-medium text-text-secondary">
              <tr className="bg-card">
                {selectable ? (
                  <th scope="col" className="sticky left-0 z-[1] w-10 bg-inherit px-3 py-2 max-xl:w-11 max-xl:p-0">
                    <label className="flex items-center justify-center max-xl:h-11 max-xl:w-11">
                      <input
                        ref={selectAllReference}
                        type="checkbox"
                        className="h-4 w-4"
                        aria-label="Chọn tất cả dòng trên trang"
                        checked={allPageSelected}
                        disabled={pageIds.length === 0}
                        onChange={(event) => togglePage(event.target.checked)}
                      />
                    </label>
                  </th>
                ) : null}
                {visibleColumns.map((column, index) => (
                  <th key={column.id} scope="col" className={`whitespace-nowrap px-3 py-2 ${stickyFirst(index)}`}>
                    {column.header}
                  </th>
                ))}
                {rowActions ? (
                  <th scope="col" className="px-3 py-2 text-right">
                    <span className="sr-only">Thao tác</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr className="border-t border-border">
                  <td colSpan={columnCount} className="px-3 py-4 text-text-secondary">
                    {emptyText}
                  </td>
                </tr>
              ) : null}
              {pageRows.map((row) => {
                const id = getRowId(row);
                const detail = renderRowDetail?.(row);
                return (
                  <Fragment key={id}>
                    <tr
                      aria-label={getRowAriaLabel?.(row)}
                      aria-selected={selectable ? selectedIds.has(id) : undefined}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      className={`border-t border-border ${onRowClick ? 'cursor-pointer hover:bg-selected' : ''} ${id === activeRowId ? 'bg-selected' : 'bg-card'}`}
                    >
                      {selectable ? (
                        <td
                          className="sticky left-0 z-[1] bg-inherit px-3 py-2 max-xl:p-0"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <label className="flex items-center justify-center max-xl:h-11 max-xl:w-11">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              aria-label={`Chọn ${getRowLabel(row)}`}
                              checked={selectedIds.has(id)}
                              onChange={(event) => toggleRow(id, event.target.checked)}
                            />
                          </label>
                        </td>
                      ) : null}
                      {visibleColumns.map((column, index) => (
                        <td key={column.id} className={`px-3 py-2 ${stickyFirst(index)} ${column.className ?? ''}`}>
                          {column.cell(row)}
                        </td>
                      ))}
                      {rowActions ? (
                        <td
                          className="whitespace-nowrap px-3 py-2 text-right"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {rowActions(row)}
                        </td>
                      ) : null}
                    </tr>
                    {detail ? (
                      <tr>
                        <td colSpan={columnCount} className="px-3 pb-3">
                          {detail}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 text-label text-text-secondary">
        <span>{loading ? 'Đang tải…' : `Tổng ${total} dòng`}</span>
        <label htmlFor={pageSizeId} className="ml-auto">
          Số dòng mỗi trang
        </label>
        <select
          id={pageSizeId}
          value={pageSize}
          onChange={(event) => {
            onSettingsChange({ ...settings, pageSize: Number(event.target.value) });
            goTo(1);
          }}
          className="rounded-lg border border-border bg-card px-2 py-1 text-content text-text"
        >
          {DATA_GRID_PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <nav aria-label={`Phân trang ${label}`} className="flex items-center gap-2">
          <Button disabled={page <= 1} onClick={() => goTo(page - 1)}>
            Trang trước
          </Button>
          <span aria-live="polite">
            Trang {page} / {totalPages}
          </span>
          <Button disabled={page >= totalPages} onClick={() => goTo(page + 1)}>
            Trang sau
          </Button>
        </nav>
      </div>
      {configuring ? (
        <ColumnSettingsDialog
          open
          columns={columns}
          visibleIds={visibleColumns.map((column) => column.id)}
          onCancel={() => setConfiguring(false)}
          onSave={(next) => {
            setConfiguring(false);
            onSettingsChange({ ...settings, columns: next });
          }}
        />
      ) : null}
    </section>
  );
}

// "Cấu hình hiển thị lưới" ở menu người dùng: số dòng mỗi trang mặc định cho mọi lưới chưa cấu hình riêng
export function GridDisplaySettingsDialog({
  open,
  pageSize,
  busy,
  error,
  onSave,
  onCancel,
}: {
  open: boolean;
  pageSize: number;
  busy?: boolean;
  error?: string;
  onSave(pageSize: number): void;
  onCancel(): void;
}) {
  const dialogReference = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const selectId = useId();
  const [value, setValue] = useState(pageSize);

  useEffect(() => {
    const dialog = dialogReference.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogReference}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className={`m-auto w-full max-w-md rounded-xl border border-border bg-card p-6 text-text shadow-lg backdrop:bg-text/40 ${DIALOG_NARROW_FULL_SCREEN_CLASS}`}
    >
      <h2 id={titleId} className="text-section-title font-semibold">
        Cấu hình hiển thị lưới
      </h2>
      <p className="mt-1 text-label text-text-secondary">
        Áp dụng cho các lưới dữ liệu bạn chưa chọn số dòng riêng; lưu theo tài khoản nên dùng được trên mọi máy.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <label htmlFor={selectId} className="text-label font-medium text-text">
          Số dòng mỗi trang mặc định
        </label>
        <select
          id={selectId}
          value={value}
          onChange={(event) => setValue(Number(event.target.value))}
          className="rounded-lg border border-border bg-card px-3 py-2 text-content"
        >
          {DATA_GRID_PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-label text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-6 flex justify-end gap-3">
        <Button onClick={onCancel} disabled={busy}>
          Hủy
        </Button>
        <Button variant="primary" onClick={() => onSave(value)} disabled={busy}>
          Ghi
        </Button>
      </div>
    </dialog>
  );
}
