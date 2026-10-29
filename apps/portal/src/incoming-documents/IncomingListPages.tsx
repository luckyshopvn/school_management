import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import {
  INCOMING_DOCUMENT_STATUS_LABELS,
  INCOMING_ROLE_LABELS,
  INCOMING_ROLE_TAGS,
  type DataGridKey,
  type PortalQuickLinkPath,
} from '@school-management/shared';
import {
  Alert,
  Button,
  ConfirmDialog,
  DataGrid,
  FORM_CONTROL_CLASS,
  StatusBadge,
  Toast,
  type DataGridColumn,
} from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { formatDate, messageOf, selectClass } from '../archives/archive-ui.js';
import { ArchiveDialog, IncomingDocumentDetail } from './IncomingDocumentDetail.js';
import { IncomingDocumentForm } from './IncomingDocumentForm.js';
import { UrgencyBadge } from './UrgencyBadge.js';
import {
  archiveMany,
  completeMany,
  listBooks,
  listCatalog,
  listIncoming,
  setFlags,
  type BatchResult,
  type IncomingFilter,
  type IncomingListItem,
  type IncomingListView,
  type IncomingRoleFilter,
} from './incoming-api.js';

// Danh sách văn bản đến theo VNPT iOffice (DT-18 phần 18a, YCTD-138): tìm theo trích yếu, "Tìm kiếm nâng cao" (số ký hiệu,
// số đến, đơn vị ban hành, ngày đến, sổ, hình thức, độ khẩn, quá hạn, đến hạn), lọc theo vai trò (Xử lý chính, Phối hợp,
// Xem, Tất cả); thao tác hàng loạt Kết thúc hàng loạt, Lưu hồ sơ hàng loạt, Đánh dấu. Bấm một dòng mở chi tiết văn bản ngay
// dưới dòng. Bản gọn theo thiết kế "Cổng quản trị trường" (YCTD-336): bỏ dòng chú thích màu, độ khẩn và văn bản chỉ đạo ghi
// bằng nhãn chữ trong ô trích yếu, ký hiệu [XLC], [PH], [QH], [ĐH] có tên đầy đủ khi trỏ chuột; lọc vai trò là một ô chọn;
// nút hàng loạt chỉ hiện khi đã chọn dòng
const ROLE_FILTERS: Array<{ value: IncomingRoleFilter; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'main', label: 'Xử lý chính' },
  { value: 'coordinate', label: 'Phối hợp' },
  { value: 'view', label: 'Xem' },
];

interface Tab {
  view: IncomingListView;
  label: string;
}

interface ListPageOptions {
  path: PortalQuickLinkPath;
  gridKey: DataGridKey;
  tabs: Tab[];
  roleFilter?: boolean;
  create?: 'register' | 'interconnect';
  notice?: string;
}

function columnsOf(view: IncomingListView): Array<DataGridColumn<IncomingListItem>> {
  const interconnect = view === 'interconnect';
  return [
    ...(interconnect
      ? [
          {
            id: 'received_at',
            header: 'Nhận lúc',
            cell: (row: IncomingListItem) =>
              row.received_at
                ? new Date(row.received_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
                : '',
          },
        ]
      : [
          { id: 'arrival_number', header: 'Số đến', cell: (row: IncomingListItem) => row.arrival_number ?? '' },
          { id: 'arrival_date', header: 'Ngày đến', cell: (row: IncomingListItem) => formatDate(row.arrival_date) },
        ]),
    { id: 'symbol', header: 'Số ký hiệu', cell: (row) => row.symbol },
    {
      id: 'summary',
      header: 'Trích yếu',
      alwaysVisible: true,
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-1">
          {row.my_role && INCOMING_ROLE_TAGS[row.my_role] ? (
            <abbr title={INCOMING_ROLE_LABELS[row.my_role]} className="text-label font-semibold no-underline">
              [{INCOMING_ROLE_TAGS[row.my_role]}]
            </abbr>
          ) : null}
          {row.overdue ? (
            <abbr title="Quá hạn" className="text-label font-semibold text-danger no-underline">
              [QH]
            </abbr>
          ) : null}
          {row.due_soon ? (
            <abbr title="Đến hạn" className="text-label font-semibold text-warning no-underline">
              [ĐH]
            </abbr>
          ) : null}
          <UrgencyBadge level={row.urgency_level} name={row.urgency_name} />
          {row.directed ? <StatusBadge tone="info" label="Chỉ đạo" /> : null}
          <span className={`text-text ${row.unread ? 'font-bold' : 'font-medium'}`}>{row.summary}</span>
          {row.restricted ? <StatusBadge tone="neutral" label="Hạn chế xem" /> : null}
          {row.starred ? <span aria-label="Đã đánh dấu">★</span> : null}
        </span>
      ),
    },
    { id: 'issuer_name', header: 'Đơn vị ban hành', cell: (row) => row.issuer_name },
    { id: 'document_date', header: 'Ngày văn bản', cell: (row) => formatDate(row.document_date) },
    { id: 'form_name', header: 'Hình thức', cell: (row) => row.form_name ?? '' },
    { id: 'urgency_name', header: 'Độ khẩn', cell: (row) => row.urgency_name ?? '' },
    { id: 'secrecy_name', header: 'Độ mật', hiddenByDefault: true, cell: (row) => row.secrecy_name ?? '' },
    {
      id: 'deadline',
      header: 'Hạn xử lý',
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-1">
          {formatDate(row.effective_deadline)}
          {row.overdue ? <StatusBadge tone="danger" label="Quá hạn" /> : null}
          {row.due_soon ? <StatusBadge tone="warning" label="Đến hạn" /> : null}
        </span>
      ),
    },
    ...(interconnect
      ? [
          {
            id: 'acknowledged',
            header: 'Tiếp nhận',
            cell: (row: IncomingListItem) =>
              row.interconnect_status === 'acknowledged' ? `Đã đánh dấu (${row.acknowledged_by_name ?? ''})` : 'Chưa',
          },
        ]
      : [
          {
            id: 'my_role',
            header: 'Vai trò',
            cell: (row: IncomingListItem) => (row.my_role ? INCOMING_ROLE_LABELS[row.my_role] : ''),
          },
          { id: 'main_handler', header: 'Xử lý chính', cell: (row: IncomingListItem) => row.main_handler_name ?? '' },
          {
            id: 'status',
            header: 'Trạng thái',
            cell: (row: IncomingListItem) => INCOMING_DOCUMENT_STATUS_LABELS[row.status],
          },
        ]),
    { id: 'book_name', header: 'Sổ văn bản', hiddenByDefault: true, cell: (row) => row.book_name ?? '' },
    { id: 'file_count', header: 'Tệp', hiddenByDefault: true, cell: (row) => row.file_count || '' },
  ];
}

function batchText(action: string, results: BatchResult[]): string {
  const done = results.filter((result) => result.ok).length;
  const failed = results.filter((result) => !result.ok);
  return failed.length === 0
    ? `Đã ${action} ${done} văn bản`
    : `Đã ${action} ${done}/${results.length} văn bản; không làm được: ${failed
        .map((result) => result.message)
        .filter(Boolean)
        .join('; ')}`;
}

function IncomingListPage({ path, gridKey, tabs, roleFilter, create, notice }: ListPageOptions) {
  const queryClient = useQueryClient();
  const grid = useGridSettings(gridKey);
  const [view, setView] = useState<IncomingListView>(tabs[0]?.view ?? 'inbox');
  const [role, setRole] = useState<IncomingRoleFilter>('all');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Omit<IncomingFilter, 'view' | 'role' | 'q'>>({});
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string>();
  // Nút "Vào sổ văn bản đến" của trang Công văn của tôi (YCTD-336) mở trang này kèm ?create=true để mở sẵn ô vào sổ
  const linked: { create?: boolean } = useSearch({ strict: false });
  const [creating, setCreating] = useState(() => Boolean(create) && linked.create === true);
  const [toastMessage, setToastMessage] = useState<string>();
  const [bulk, setBulk] = useState<{ kind: 'complete' | 'archive'; ids: string[] }>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const catalog = useQuery({ queryKey: ['document-catalogs'], queryFn: () => listCatalog() });
  const books = useQuery({ queryKey: ['document-books'], queryFn: () => listBooks(), retry: false });
  const pageSize = grid.settings.pageSize;
  const activeFilter: IncomingFilter = {
    ...filter,
    view,
    role: roleFilter ? role : 'all',
    q: search.trim() || undefined,
  };
  const documents = useQuery({
    queryKey: ['incoming-documents', activeFilter, page, pageSize],
    queryFn: () => listIncoming({ ...activeFilter, page, pageSize }),
    enabled: grid.ready,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['incoming-documents'] });
  const flags = useMutation({
    mutationFn: (input: { ids: string[]; starred?: boolean; followed?: boolean }) => setFlags(input.ids, input),
    onSuccess: async (_result, input) => {
      await refresh();
      setToastMessage(`Đã cập nhật ${input.ids.length} văn bản`);
    },
  });
  const batch = useMutation({
    mutationFn: async (input: { kind: 'complete' | 'archive'; ids: string[]; note?: string; recordId?: string }) =>
      input.kind === 'complete'
        ? completeMany(input.ids, input.note || null)
        : archiveMany(input.ids, input.recordId as string),
    onSuccess: async (results, input) => {
      setBulk(undefined);
      await refresh();
      setToastMessage(batchText(input.kind === 'complete' ? 'kết thúc' : 'lưu hồ sơ', results));
    },
  });
  const change = <Key extends keyof typeof filter>(key: Key, value: (typeof filter)[Key]) => {
    setFilter((current) => ({ ...current, [key]: value || undefined }));
    setPage(1);
  };
  const columns = columnsOf(view);
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
    key: 'symbol' | 'arrival_number' | 'issuer' | 'arrival_from' | 'arrival_to',
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
  const failure = documents.error ?? flags.error ?? batch.error ?? grid.error;

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle(path)}</h1>
        {notice ? <Alert tone="info">{notice}</Alert> : null}
        {tabs.length > 1 ? (
          <div
            role="tablist"
            aria-label="Danh sách văn bản đến"
            className="flex flex-wrap gap-1 border-b border-border"
          >
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
        {roleFilter ? (
          <label className="flex w-full flex-col text-label font-medium text-text sm:w-56">
            Vai trò
            <select
              value={role}
              onChange={(event) => {
                setRole(event.target.value as IncomingRoleFilter);
                setPage(1);
              }}
              className={selectClass}
            >
              {ROLE_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {creating && create ? (
          <section className="rounded-xl border border-border bg-card p-4">
            <IncomingDocumentForm
              mode={create}
              onCancel={() => setCreating(false)}
              onSaved={(saved) => {
                setCreating(false);
                void refresh();
                setToastMessage(
                  saved.arrival_number
                    ? `Đã vào sổ văn bản số đến ${saved.arrival_number}`
                    : 'Đã nhập văn bản liên thông',
                );
                setOpenId(saved.id);
              }}
            />
          </section>
        ) : null}
        {failure ? <Alert tone="danger">{messageOf(failure)}</Alert> : null}
        <DataGrid
          label="Danh sách văn bản đến"
          columns={columns}
          rows={documents.data?.items ?? []}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.symbol}
          getRowAriaLabel={(row) => `Văn bản ${row.symbol}`}
          loading={!documents.data && !documents.isError}
          emptyText="Không có văn bản nào."
          selectable
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
              {input('arrival_number', 'Số đến')}
              {input('issuer', 'Đơn vị ban hành')}
              {input('arrival_from', 'Ngày đến từ', 'date')}
              {input('arrival_to', 'Ngày đến đến', 'date')}
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
                  checked={filter.overdue === true}
                  onChange={(event) => change('overdue', event.target.checked)}
                />
                Chỉ văn bản quá hạn
              </label>
              <label className="flex items-center gap-2 text-label font-medium text-text">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={filter.due_soon === true}
                  onChange={(event) => change('due_soon', event.target.checked)}
                />
                Chỉ văn bản đến hạn
              </label>
            </div>
          }
          toolbar={(selected) => {
            const ids = selected.map((row) => row.id);
            return (
              <>
                {create ? (
                  <Button variant="primary" onClick={() => setCreating(true)}>
                    {create === 'register' ? 'Thêm mới' : 'Nhập văn bản liên thông'}
                  </Button>
                ) : null}
                {/* Nút hàng loạt chỉ hiện khi đã chọn dòng (YCTD-336), không hiện mờ thường trực */}
                {view !== 'interconnect' && ids.length > 0 ? (
                  <>
                    <Button onClick={() => setBulk({ kind: 'complete', ids })}>Kết thúc hàng loạt</Button>
                    <Button onClick={() => setBulk({ kind: 'archive', ids })}>Lưu hồ sơ hàng loạt</Button>
                    <Button
                      disabled={flags.isPending}
                      onClick={() => flags.mutate({ ids, starred: view !== 'starred' })}
                    >
                      {view === 'starred' ? 'Bỏ đánh dấu' : 'Đánh dấu'}
                    </Button>
                    {view === 'followed' ? (
                      <Button onClick={() => flags.mutate({ ids, followed: false })}>Bỏ theo dõi</Button>
                    ) : null}
                  </>
                ) : null}
              </>
            );
          }}
          rowActions={(row) => (
            <Button variant="text" onClick={() => setOpenId(openId === row.id ? undefined : row.id)}>
              {openId === row.id ? 'Đóng' : 'Xem'}
            </Button>
          )}
          activeRowId={openId}
          renderRowDetail={(row) =>
            openId === row.id ? (
              <IncomingDocumentDetail
                documentId={row.id}
                onChanged={() => void refresh()}
                onDeleted={() => {
                  setOpenId(undefined);
                  setToastMessage(`Đã xóa văn bản ${row.symbol}`);
                }}
              />
            ) : null
          }
          settings={grid.settings}
          onSettingsChange={grid.update}
          serverPagination={{ page, total: documents.data?.total ?? 0, onPageChange: setPage }}
        />
      </div>
      {bulk?.kind === 'complete' ? (
        <BulkCompleteDialog
          count={bulk.ids.length}
          busy={batch.isPending}
          onCancel={() => setBulk(undefined)}
          onConfirm={(note) => batch.mutate({ kind: 'complete', ids: bulk.ids, note })}
        />
      ) : null}
      {bulk?.kind === 'archive' ? (
        <ArchiveDialog
          busy={batch.isPending}
          onCancel={() => setBulk(undefined)}
          onConfirm={(recordId) => batch.mutate({ kind: 'archive', ids: bulk.ids, recordId })}
        />
      ) : null}
    </AppShell>
  );
}

function BulkCompleteDialog({
  count,
  busy,
  onConfirm,
  onCancel,
}: {
  count: number;
  busy: boolean;
  onConfirm(note: string): void;
  onCancel(): void;
}) {
  const [note, setNote] = useState('');
  return (
    <ConfirmDialog
      open
      title="Kết thúc hàng loạt"
      confirmLabel="Kết thúc"
      busy={busy}
      onCancel={onCancel}
      onConfirm={() => onConfirm(note.trim())}
    >
      <p>Kết thúc {count} văn bản đã chọn; văn bản bạn không có quyền kết thúc sẽ được báo lại.</p>
      <label className="flex flex-col gap-1 text-label font-medium text-text">
        Ý kiến
        <textarea
          className={FORM_CONTROL_CLASS}
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
    </ConfirmDialog>
  );
}

// 1.1. Văn bản đến: văn bản được chuyển cho mình
export function IncomingInboxPage() {
  return (
    <IncomingListPage
      path="/incoming-documents"
      gridKey="incoming-documents"
      roleFilter
      tabs={[
        { view: 'inbox', label: 'Chờ xử lý' },
        { view: 'processed', label: 'Đã xử lý' },
      ]}
    />
  );
}

// 1.2. Quản lý văn bản đến (văn thư): Văn bản vào sổ, Chờ xử lý, Đã xử lý; Thêm mới là vào sổ
export function IncomingManagePage() {
  return (
    <IncomingListPage
      path="/incoming-documents/manage"
      gridKey="incoming-manage"
      create="register"
      tabs={[
        { view: 'registered', label: 'Văn bản vào sổ' },
        { view: 'processing', label: 'Chờ xử lý' },
        { view: 'completed', label: 'Đã xử lý' },
      ]}
    />
  );
}

export function IncomingForInformationPage() {
  return (
    <IncomingListPage
      path="/incoming-documents/for-information"
      gridKey="incoming-documents"
      tabs={[{ view: 'for_information', label: 'Văn bản xem để biết' }]}
    />
  );
}

export function IncomingStarredPage() {
  return (
    <IncomingListPage
      path="/incoming-documents/starred"
      gridKey="incoming-documents"
      tabs={[{ view: 'starred', label: 'Văn bản đánh dấu' }]}
    />
  );
}

export function IncomingFollowedPage() {
  return (
    <IncomingListPage
      path="/incoming-documents/followed"
      gridKey="incoming-documents"
      tabs={[{ view: 'followed', label: 'Văn bản theo dõi' }]}
    />
  );
}

export function IncomingSearchPage() {
  return (
    <IncomingListPage
      path="/incoming-documents/search"
      gridKey="incoming-documents"
      roleFilter
      tabs={[{ view: 'search', label: 'Tra cứu văn bản' }]}
    />
  );
}

// 1.7. Liên thông văn bản, bản chạy nội bộ: chưa kết nối trục liên thông
export function IncomingInterconnectPage() {
  return (
    <IncomingListPage
      path="/incoming-documents/interconnect"
      gridKey="incoming-interconnect"
      create="interconnect"
      notice="Chưa kết nối trục liên thông văn bản: văn thư nhập văn bản nhận được (thông tin và tệp), đánh dấu tiếp nhận bằng tay rồi vào sổ. Phần mềm không gửi báo nhận lên trục."
      tabs={[{ view: 'interconnect', label: 'Văn bản chờ vào sổ' }]}
    />
  );
}
