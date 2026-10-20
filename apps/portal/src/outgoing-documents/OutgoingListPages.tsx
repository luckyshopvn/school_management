import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  OUTGOING_DOCUMENT_STATUS_LABELS,
  OUTGOING_RECIPIENT_TYPE_LABELS,
  OUTGOING_SEND_STATUS_LABELS,
  type DataGridKey,
  type OutgoingSendStatus,
  type PortalQuickLinkPath,
} from '@school-management/shared';
import { Alert, Button, DataGrid, StatusBadge, Toast, type DataGridColumn } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { formatDate, messageOf, selectClass } from '../archives/archive-ui.js';
import { listBooks, listCatalog } from '../incoming-documents/incoming-api.js';
import { OutgoingDocumentDetail } from './OutgoingDocumentDetail.js';
import { OutgoingDocumentForm } from './OutgoingDocumentForm.js';
import {
  listOutgoing,
  listRecipients,
  type OutgoingFilter,
  type OutgoingListItem,
  type OutgoingListView,
  type RecipientRow,
} from './outgoing-api.js';

// Danh sách văn bản đi theo VNPT iOffice (DT-18 phần 18b, YCTD-140): 3.1 Văn bản đi (Dự thảo, Chờ xử lý, Đã xử lý), 3.2 Quản
// lý văn bản đi của văn thư (Chờ cấp số, Đã ban hành), 3.3 Liên thông văn bản đi (đơn vị nhận theo trạng thái gửi), 3.4 Tra
// cứu. Tìm theo trích yếu, tìm nâng cao (số ký hiệu, số đi, người ký, ngày ban hành, sổ, hình thức, độ khẩn, đã public).
// Bấm một dòng mở chi tiết ngay dưới dòng
interface Tab {
  view: OutgoingListView;
  label: string;
}

function summaryClass(row: OutgoingListItem): string {
  if ((row.urgency_level ?? 0) >= 2) {
    return 'text-danger';
  }
  return (row.urgency_level ?? 0) === 1 ? 'text-warning' : 'text-text';
}

const COLUMNS: Array<DataGridColumn<OutgoingListItem>> = [
  { id: 'eoffice_number', header: 'Số eOffice', cell: (row) => row.eoffice_number },
  { id: 'symbol', header: 'Số ký hiệu', cell: (row) => row.symbol ?? '' },
  { id: 'issue_date', header: 'Ngày ban hành', cell: (row) => formatDate(row.issue_date) },
  {
    id: 'summary',
    header: 'Trích yếu',
    alwaysVisible: true,
    cell: (row) => (
      <span className="flex flex-wrap items-center gap-1">
        <span className={`${summaryClass(row)} font-medium`}>{row.summary}</span>
        {row.priority ? <StatusBadge tone="warning" label="Ưu tiên" /> : null}
        {row.published ? <StatusBadge tone="info" label="Đã public" /> : null}
        {row.frozen ? <StatusBadge tone="neutral" label="Đóng băng" /> : null}
      </span>
    ),
  },
  { id: 'form_name', header: 'Hình thức', cell: (row) => row.form_name ?? '' },
  { id: 'urgency_name', header: 'Độ khẩn', cell: (row) => row.urgency_name ?? '' },
  { id: 'drafter_name', header: 'Người soạn thảo', cell: (row) => row.drafter_name },
  {
    id: 'drafting_unit_name',
    header: 'Đơn vị soạn thảo',
    hiddenByDefault: true,
    cell: (row) => row.drafting_unit_name ?? '',
  },
  { id: 'signer_name', header: 'Người ký', cell: (row) => row.signer_name ?? '' },
  { id: 'status', header: 'Trạng thái', cell: (row) => OUTGOING_DOCUMENT_STATUS_LABELS[row.status] },
  { id: 'copies', header: 'Số bản', hiddenByDefault: true, cell: (row) => row.copies ?? '' },
  { id: 'book_name', header: 'Sổ văn bản', hiddenByDefault: true, cell: (row) => row.book_name ?? '' },
  {
    id: 'pending_recipients',
    header: 'Chờ gửi',
    hiddenByDefault: true,
    cell: (row) => (row.pending_recipients ? row.pending_recipients : ''),
  },
];

function OutgoingListPage({
  path,
  gridKey,
  tabs,
  create,
}: {
  path: PortalQuickLinkPath;
  gridKey: DataGridKey;
  tabs: Tab[];
  create?: boolean;
}) {
  const queryClient = useQueryClient();
  const grid = useGridSettings(gridKey);
  const [view, setView] = useState<OutgoingListView>(tabs[0]?.view ?? 'drafts');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Omit<OutgoingFilter, 'view' | 'q'>>({});
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const catalog = useQuery({ queryKey: ['document-catalogs'], queryFn: () => listCatalog() });
  const books = useQuery({
    queryKey: ['document-books', 'outgoing'],
    queryFn: () => listBooks(undefined, 'outgoing'),
    retry: false,
  });
  const pageSize = grid.settings.pageSize;
  const activeFilter: OutgoingFilter = { ...filter, view, q: search.trim() || undefined };
  const documents = useQuery({
    queryKey: ['outgoing-documents', activeFilter, page, pageSize],
    queryFn: () => listOutgoing({ ...activeFilter, page, pageSize }),
    enabled: grid.ready,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['outgoing-documents'] });
  const change = <Key extends keyof typeof filter>(key: Key, value: (typeof filter)[Key]) => {
    setFilter((current) => ({ ...current, [key]: value || undefined }));
    setPage(1);
  };
  const select = (
    key: 'book_id' | 'form_id' | 'urgency_id',
    label: string,
    options: Array<{ id: string; name: string }>,
  ) => (
    <label className="text-label font-medium text-text">
      {label}
      <select value={filter[key] ?? ''} onChange={(event) => change(key, event.target.value)} className={selectClass}>
        <option value="">Tất cả</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
  const input = (
    key: 'symbol' | 'issue_number' | 'signer' | 'issue_from' | 'issue_to',
    label: string,
    type = 'text',
  ) => (
    <label className="text-label font-medium text-text">
      {label}
      <input
        type={type}
        value={filter[key] ?? ''}
        onChange={(event) => change(key, event.target.value)}
        className={selectClass}
      />
    </label>
  );
  const failure = documents.error ?? grid.error;

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle(path)}</h1>
        {tabs.length > 1 ? (
          <div role="tablist" aria-label="Danh sách văn bản đi" className="flex flex-wrap gap-1 border-b border-border">
            {tabs.map((tab) => (
              <button
                key={tab.view}
                type="button"
                role="tab"
                aria-selected={view === tab.view}
                onClick={() => {
                  setView(tab.view);
                  setPage(1);
                  setOpenId(undefined);
                }}
                className={`-mb-px rounded-t-lg border border-b-0 px-3 py-2 text-content ${
                  view === tab.view
                    ? 'border-border bg-card font-semibold text-text'
                    : 'border-transparent text-text-secondary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : null}
        <p className="text-label text-text-secondary" aria-label="Chú thích màu">
          <span className="text-danger">Đỏ: Hỏa tốc</span>; <span className="text-warning">Cam: Khẩn</span>
        </p>
        {creating ? (
          <section className="rounded-xl border border-border bg-card p-4">
            <OutgoingDocumentForm
              onCancel={() => setCreating(false)}
              onSaved={(saved) => {
                setCreating(false);
                void refresh();
                setToastMessage(`Đã tạo dự thảo số eOffice ${saved.eoffice_number}`);
                setView('drafts');
                setOpenId(saved.id);
              }}
            />
          </section>
        ) : null}
        {failure ? <Alert tone="danger">{messageOf(failure)}</Alert> : null}
        <DataGrid
          label="Danh sách văn bản đi"
          columns={COLUMNS}
          rows={documents.data?.items ?? []}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.symbol ?? String(row.eoffice_number)}
          getRowAriaLabel={(row) => `Văn bản đi ${row.symbol ?? `eOffice ${row.eoffice_number}`}`}
          loading={!documents.data && !documents.isError}
          emptyText="Không có văn bản nào."
          search={{
            label: 'Tìm theo trích yếu',
            value: search,
            onChange: (value) => {
              setSearch(value);
              setPage(1);
            },
          }}
          advancedSearch={
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {input('symbol', 'Số ký hiệu')}
              {input('issue_number', 'Số đi')}
              {input('signer', 'Người ký')}
              {input('issue_from', 'Ngày ban hành từ', 'date')}
              {input('issue_to', 'Ngày ban hành đến', 'date')}
              {select(
                'book_id',
                'Sổ văn bản',
                (books.data ?? []).map((book) => ({ id: book.id, name: `${book.name} (${book.year})` })),
              )}
              {select(
                'form_id',
                'Hình thức',
                (catalog.data ?? []).filter((item) => item.kind === 'form'),
              )}
              {select(
                'urgency_id',
                'Độ khẩn',
                (catalog.data ?? []).filter((item) => item.kind === 'urgency'),
              )}
              <label className="flex items-center gap-2 text-label font-medium text-text">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={filter.published === true}
                  onChange={(event) => change('published', event.target.checked)}
                />
                Chỉ văn bản đã public lên cổng TTĐT
              </label>
            </div>
          }
          toolbar={
            create ? (
              <Button variant="primary" onClick={() => setCreating(true)}>
                Thêm mới
              </Button>
            ) : null
          }
          rowActions={(row) => (
            <Button variant="text" onClick={() => setOpenId(openId === row.id ? undefined : row.id)}>
              {openId === row.id ? 'Đóng' : 'Xem'}
            </Button>
          )}
          activeRowId={openId}
          renderRowDetail={(row) =>
            openId === row.id ? (
              <OutgoingDocumentDetail
                documentId={row.id}
                onChanged={() => void refresh()}
                onDeleted={() => {
                  setOpenId(undefined);
                  setToastMessage('Đã đóng văn bản');
                }}
              />
            ) : null
          }
          settings={grid.settings}
          onSettingsChange={grid.update}
          serverPagination={{ page, total: documents.data?.total ?? 0, onPageChange: setPage }}
        />
      </div>
    </AppShell>
  );
}

// 3.1. Văn bản đi: dự thảo của mình, chờ mình cho ý kiến hoặc ký, đã xử lý
export function OutgoingPage() {
  return (
    <OutgoingListPage
      path="/outgoing-documents"
      gridKey="outgoing-documents"
      create
      tabs={[
        { view: 'drafts', label: 'Dự thảo' },
        { view: 'pending', label: 'Chờ xử lý' },
        { view: 'processed', label: 'Đã xử lý' },
      ]}
    />
  );
}

// 3.2. Quản lý văn bản đi (văn thư): chờ cấp số, đã ban hành
export function OutgoingManagePage() {
  return (
    <OutgoingListPage
      path="/outgoing-documents/manage"
      gridKey="outgoing-manage"
      tabs={[
        { view: 'to_issue', label: 'Chờ cấp số' },
        { view: 'issued', label: 'Đã ban hành' },
      ]}
    />
  );
}

export function OutgoingSearchPage() {
  return (
    <OutgoingListPage
      path="/outgoing-documents/search"
      gridKey="outgoing-documents"
      tabs={[{ view: 'search', label: 'Tra cứu văn bản đi' }]}
    />
  );
}

// 3.3. Liên thông văn bản đi, bản chạy nội bộ: đơn vị nhận của văn bản đã ban hành theo trạng thái gửi
const RECIPIENT_TABS: Array<{ value: OutgoingSendStatus | 'all'; label: string }> = [
  { value: 'pending', label: 'Chờ gửi' },
  { value: 'sent', label: 'Đã đánh dấu gửi' },
  { value: 'delivered', label: 'Liên thông nội bộ' },
  { value: 'all', label: 'Tất cả' },
];

const RECIPIENT_COLUMNS: Array<DataGridColumn<RecipientRow>> = [
  { id: 'symbol', header: 'Số ký hiệu', cell: (row) => row.symbol },
  { id: 'issue_date', header: 'Ngày ban hành', cell: (row) => formatDate(row.issue_date) },
  { id: 'summary', header: 'Trích yếu', alwaysVisible: true, cell: (row) => row.summary },
  { id: 'name', header: 'Đơn vị nhận', cell: (row) => row.name },
  { id: 'type', header: 'Loại', cell: (row) => OUTGOING_RECIPIENT_TYPE_LABELS[row.recipient_type] },
  {
    id: 'electronic_code',
    header: 'Mã định danh điện tử',
    hiddenByDefault: true,
    cell: (row) => row.electronic_code ?? '',
  },
  { id: 'status', header: 'Trạng thái liên thông', cell: (row) => OUTGOING_SEND_STATUS_LABELS[row.send_status] },
  {
    id: 'sent',
    header: 'Gửi lúc',
    cell: (row) => (row.sent_at ? new Date(row.sent_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : ''),
  },
  { id: 'reference', header: 'Ghi chú', cell: (row) => row.reference ?? '' },
];

export function OutgoingInterconnectPage() {
  const queryClient = useQueryClient();
  const grid = useGridSettings('outgoing-recipients');
  const [status, setStatus] = useState<OutgoingSendStatus | 'all'>('pending');
  const [openId, setOpenId] = useState<string>();
  const rows = useQuery({ queryKey: ['outgoing-recipients', status], queryFn: () => listRecipients(status) });
  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/outgoing-documents/interconnect')}</h1>
        <Alert tone="info">
          Chưa kết nối trục liên thông văn bản: văn thư gửi văn bản đã ký tới đơn vị bên ngoài bằng cách khác (thư điện
          tử, bưu điện) rồi đánh dấu đã gửi. Đơn vị trong trường nhận ngay khi phát hành, văn bản vào danh sách chờ vào
          sổ văn bản đến.
        </Alert>
        <div role="tablist" aria-label="Trạng thái liên thông" className="flex flex-wrap gap-1 border-b border-border">
          {RECIPIENT_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={status === tab.value}
              onClick={() => {
                setStatus(tab.value);
                setOpenId(undefined);
              }}
              className={`-mb-px rounded-t-lg border border-b-0 px-3 py-2 text-content ${
                status === tab.value
                  ? 'border-border bg-card font-semibold text-text'
                  : 'border-transparent text-text-secondary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {rows.error ? <Alert tone="danger">{messageOf(rows.error)}</Alert> : null}
        <DataGrid
          label="Đơn vị nhận văn bản đi"
          columns={RECIPIENT_COLUMNS}
          rows={rows.data ?? []}
          getRowId={(row) => row.id}
          getRowLabel={(row) => `${row.symbol} – ${row.name}`}
          loading={!rows.data && !rows.error}
          emptyText="Không có đơn vị nhận nào."
          rowActions={(row) => (
            <Button variant="text" onClick={() => setOpenId(openId === row.id ? undefined : row.id)}>
              {openId === row.id ? 'Đóng' : 'Xem'}
            </Button>
          )}
          activeRowId={openId}
          renderRowDetail={(row) =>
            openId === row.id ? (
              <OutgoingDocumentDetail
                documentId={row.document_id}
                onChanged={() => void queryClient.invalidateQueries({ queryKey: ['outgoing-recipients'] })}
              />
            ) : null
          }
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
      </div>
    </AppShell>
  );
}
