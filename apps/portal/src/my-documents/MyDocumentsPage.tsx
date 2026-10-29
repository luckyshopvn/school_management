import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { PERMISSION_CODES, isMenuPathVisible } from '@school-management/shared';
import { Alert, Button, DataGrid, StatusBadge, Toast, type DataGridColumn } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { formatDate, messageOf } from '../archives/archive-ui.js';
import { useCurrentPermissions, useHasPermission } from '../session/permissions.js';
import { IncomingDocumentDetail } from '../incoming-documents/IncomingDocumentDetail.js';
import { listIncoming, type IncomingListItem } from '../incoming-documents/incoming-api.js';
import { OutgoingDocumentDetail } from '../outgoing-documents/OutgoingDocumentDetail.js';
import { listOutgoing, type OutgoingListItem } from '../outgoing-documents/outgoing-api.js';
import { UrgencyBadge } from '../incoming-documents/UrgencyBadge.js';

// Công văn của tôi (YCTD-336, thiết kế "Cổng quản trị trường" Eric duyệt ngày 2026-10-28): gom việc văn bản của người dùng
// vào một chỗ. Thẻ "Cần tôi xử lý" gồm văn bản đến chờ tôi xử lý (thẻ Chờ xử lý của 1.1) và văn bản đi chờ tôi cho ý kiến
// hoặc ký (thẻ Chờ xử lý của 3.1); thẻ "Dự thảo của tôi" là thẻ Dự thảo của 3.1. Bấm một dòng mở chi tiết văn bản ngay dưới
// dòng như ở 1.1, 3.1. Nút Vào sổ văn bản đến, Soạn văn bản đi mở sẵn ô nhập của 1.2, 3.1 và chỉ hiện khi có quyền; máy chủ
// vẫn kiểm tra quyền ở mọi yêu cầu

// Máy chủ nhận tối đa 200 dòng mỗi trang: gộp hai danh sách nên lấy một trang 200 dòng mỗi loại rồi phân trang ở lưới
const FETCH_PAGE_SIZE = 200;

type MyDocumentRow =
  { key: string; kind: 'incoming'; item: IncomingListItem } | { key: string; kind: 'outgoing'; item: OutgoingListItem };

type MyDocumentsTab = 'todo' | 'drafts';

const TABS: Array<{ value: MyDocumentsTab; label: string }> = [
  { value: 'todo', label: 'Cần tôi xử lý' },
  { value: 'drafts', label: 'Dự thảo của tôi' },
];

const incomingRow = (item: IncomingListItem): MyDocumentRow => ({ key: `incoming-${item.id}`, kind: 'incoming', item });
const outgoingRow = (item: OutgoingListItem): MyDocumentRow => ({ key: `outgoing-${item.id}`, kind: 'outgoing', item });

function rowSymbol(row: MyDocumentRow): string {
  return row.kind === 'incoming' ? row.item.symbol : (row.item.symbol ?? `eOffice ${row.item.eoffice_number}`);
}

const COLUMNS: Array<DataGridColumn<MyDocumentRow>> = [
  { id: 'kind', header: 'Loại', cell: (row) => (row.kind === 'incoming' ? 'Đến' : 'Đi') },
  {
    id: 'number',
    header: 'Số',
    cell: (row) => (row.kind === 'incoming' ? (row.item.arrival_number ?? '') : row.item.eoffice_number),
  },
  { id: 'symbol', header: 'Số ký hiệu', cell: (row) => row.item.symbol ?? '' },
  {
    id: 'summary',
    header: 'Trích yếu',
    alwaysVisible: true,
    cell: (row) => (
      <span className="flex flex-wrap items-center gap-1">
        <UrgencyBadge level={row.item.urgency_level} name={row.item.urgency_name} />
        <span className={`text-text ${row.kind === 'incoming' && row.item.unread ? 'font-bold' : 'font-medium'}`}>
          {row.item.summary}
        </span>
      </span>
    ),
  },
  {
    id: 'sender',
    header: 'Nơi gửi',
    cell: (row) =>
      row.kind === 'incoming' ? row.item.issuer_name : (row.item.drafting_unit_name ?? row.item.drafter_name),
  },
  {
    id: 'deadline',
    header: 'Hạn xử lý',
    cell: (row) =>
      row.kind === 'incoming' ? (
        <span className="flex flex-wrap items-center gap-1">
          {formatDate(row.item.effective_deadline)}
          {row.item.overdue ? <StatusBadge tone="danger" label="Quá hạn" /> : null}
          {row.item.due_soon ? <StatusBadge tone="warning" label="Đến hạn" /> : null}
        </span>
      ) : (
        ''
      ),
  },
];

export function MyDocumentsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const grid = useGridSettings('my-documents');
  const [tab, setTab] = useState<MyDocumentsTab>('todo');
  const [openKey, setOpenKey] = useState<string>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const canRegister = useHasPermission(PERMISSION_CODES.incomingDocumentRegister);
  const canDraft = useHasPermission(PERMISSION_CODES.outgoingDocumentDraft);
  // Chỉ đọc danh sách của trang người dùng được thấy (1.1 Văn bản đến, 3.1 Văn bản đi) theo cùng điều kiện của menu
  const permissions = useCurrentPermissions();
  const has = (code: string) => permissions.has(code);
  const seesIncoming = isMenuPathVisible('/incoming-documents', has);
  const seesOutgoing = isMenuPathVisible('/outgoing-documents', has);
  const incoming = useQuery({
    queryKey: ['incoming-documents', 'my-documents', 'inbox'],
    queryFn: () => listIncoming({ view: 'inbox', page: 1, pageSize: FETCH_PAGE_SIZE }),
    enabled: seesIncoming,
  });
  const pending = useQuery({
    queryKey: ['outgoing-documents', 'my-documents', 'pending'],
    queryFn: () => listOutgoing({ view: 'pending', page: 1, pageSize: FETCH_PAGE_SIZE }),
    enabled: seesOutgoing,
  });
  const drafts = useQuery({
    queryKey: ['outgoing-documents', 'my-documents', 'drafts'],
    queryFn: () => listOutgoing({ view: 'drafts', page: 1, pageSize: FETCH_PAGE_SIZE }),
    enabled: seesOutgoing,
  });
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['incoming-documents'] }),
      queryClient.invalidateQueries({ queryKey: ['outgoing-documents'] }),
    ]);
  const sources = tab === 'todo' ? [incoming, pending] : [drafts];
  const rows =
    tab === 'todo'
      ? [...(incoming.data?.items ?? []).map(incomingRow), ...(pending.data?.items ?? []).map(outgoingRow)]
      : (drafts.data?.items ?? []).map(outgoingRow);
  // Danh sách chưa bật (không có quyền) có isLoading là false nên không làm lưới chờ mãi
  const loading = sources.some((source) => source.isLoading);
  const failure = grid.error ?? sources.find((source) => source.error)?.error;
  const truncated =
    tab === 'todo'
      ? (incoming.data?.total ?? 0) > FETCH_PAGE_SIZE || (pending.data?.total ?? 0) > FETCH_PAGE_SIZE
      : (drafts.data?.total ?? 0) > FETCH_PAGE_SIZE;
  const counts: Record<MyDocumentsTab, number | undefined> = {
    todo: incoming.data || pending.data ? (incoming.data?.total ?? 0) + (pending.data?.total ?? 0) : undefined,
    drafts: drafts.data?.total,
  };
  const toggle = (row: MyDocumentRow) => setOpenKey((current) => (current === row.key ? undefined : row.key));

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-page-title font-bold text-text">{menuPageTitle('/my-documents')}</h1>
          {canRegister || canDraft ? (
            <div className="flex flex-wrap gap-2">
              {canRegister ? (
                <Button
                  variant="primary"
                  onClick={() => void navigate({ to: '/incoming-documents/manage', search: { create: true } })}
                >
                  Vào sổ văn bản đến
                </Button>
              ) : null}
              {canDraft ? (
                <Button
                  variant={canRegister ? 'secondary' : 'primary'}
                  onClick={() => void navigate({ to: '/outgoing-documents', search: { create: true } })}
                >
                  Soạn văn bản đi
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div role="tablist" aria-label="Công văn của tôi" className="flex flex-wrap gap-1 border-b border-border">
          {TABS.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={tab === item.value}
              onClick={() => {
                setTab(item.value);
                setOpenKey(undefined);
              }}
              className={`-mb-px rounded-t-lg border border-b-0 px-3 py-2 text-content ${
                tab === item.value
                  ? 'border-border bg-card font-semibold text-text'
                  : 'border-transparent text-text-secondary'
              }`}
            >
              {item.label}
              {counts[item.value] ? ` (${counts[item.value]})` : ''}
            </button>
          ))}
        </div>
        {failure ? <Alert tone="danger">{messageOf(failure)}</Alert> : null}
        {truncated ? (
          <Alert tone="info">
            Đang hiện {FETCH_PAGE_SIZE} văn bản đầu của mỗi danh sách; xem đủ ở 1.1. Văn bản đến hoặc 3.1. Văn bản đi.
          </Alert>
        ) : null}
        <DataGrid
          label="Công văn của tôi"
          columns={COLUMNS}
          rows={rows}
          getRowId={(row) => row.key}
          getRowLabel={rowSymbol}
          getRowAriaLabel={(row) => `${row.kind === 'incoming' ? 'Văn bản đến' : 'Văn bản đi'} ${rowSymbol(row)}`}
          loading={loading}
          emptyText={tab === 'todo' ? 'Không có văn bản nào chờ bạn xử lý.' : 'Bạn không có dự thảo nào.'}
          onRowClick={toggle}
          rowActions={(row) => (
            <Button variant="text" onClick={() => toggle(row)}>
              {openKey === row.key ? 'Đóng' : 'Xem'}
            </Button>
          )}
          activeRowId={openKey}
          renderRowDetail={(row) =>
            openKey !== row.key ? null : row.kind === 'incoming' ? (
              <IncomingDocumentDetail
                documentId={row.item.id}
                onChanged={() => void refresh()}
                onDeleted={() => {
                  setOpenKey(undefined);
                  setToastMessage(`Đã xóa văn bản ${row.item.symbol}`);
                }}
              />
            ) : (
              <OutgoingDocumentDetail
                documentId={row.item.id}
                onChanged={() => void refresh()}
                onDeleted={() => {
                  setOpenKey(undefined);
                  setToastMessage('Đã đóng văn bản');
                }}
              />
            )
          }
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
      </div>
    </AppShell>
  );
}
