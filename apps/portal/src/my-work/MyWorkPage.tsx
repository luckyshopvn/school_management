import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { MY_WORK_SOURCE_LABELS, type MyWorkItem, type MyWorkSourceCode } from '@school-management/shared';
import { Alert, DataGrid, StatusBadge, type DataGridColumn } from '@school-management/ui';
import { formatDateTime, Page, Tabs } from '../directives/directive-ui.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { formatDate, messageOf, selectClass } from '../archives/archive-ui.js';
import { listMyWork } from '../professional-records/professional-api.js';

// Việc của tôi (DT-18 phần 18e, YCTD-142): mọi việc đang chờ người dùng ở văn bản đến, văn bản đi, giao việc, phòng họp,
// KPI, hồ sơ chuyên môn, kế hoạch bài dạy, kí hồ sơ, nghỉ phép; quá hạn lên đầu, tô đỏ; lọc theo nguồn, theo hạn, tìm chữ.
// Bấm "Mở" đến màn hình xử lý của phân hệ
type StateFilter = 'all' | 'overdue' | 'due_soon';

const deadlineText = (value: string | null) =>
  value ? (/^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDate(value) : formatDateTime(value)) : '';

const COLUMNS: Array<DataGridColumn<MyWorkItem>> = [
  {
    id: 'source',
    header: 'Phân hệ',
    cell: (row) => MY_WORK_SOURCE_LABELS[row.source],
  },
  { id: 'kind', header: 'Việc cần làm', cell: (row) => row.kind },
  { id: 'title', header: 'Nội dung', alwaysVisible: true, className: 'font-medium', cell: (row) => row.title },
  { id: 'detail', header: 'Chi tiết', cell: (row) => row.detail ?? '' },
  {
    id: 'deadline',
    header: 'Hạn',
    cell: (row) => (
      <span className="flex flex-wrap items-center gap-1">
        {deadlineText(row.deadline)}
        {row.overdue ? <StatusBadge tone="danger" label="Quá hạn" /> : null}
        {row.due_soon ? <StatusBadge tone="warning" label="Sắp đến hạn" /> : null}
      </span>
    ),
  },
  {
    id: 'received_at',
    header: 'Nhận lúc',
    hiddenByDefault: true,
    cell: (row) => (row.received_at ? deadlineText(row.received_at) : ''),
  },
];

export function MyWorkPage() {
  const grid = useGridSettings('my-work');
  const [source, setSource] = useState<MyWorkSourceCode | ''>('');
  const [state, setState] = useState<StateFilter>('all');
  const [search, setSearch] = useState('');
  // Lấy đủ một lần rồi lọc ở máy khách để số theo nguồn luôn là số của toàn bộ việc
  const work = useQuery({ queryKey: ['my-work', 'list'], queryFn: () => listMyWork({}), refetchInterval: 60_000 });
  const all = work.data?.items ?? [];
  const text = search.trim().toLowerCase();
  const rows = all.filter(
    (row) =>
      (!source || row.source === source) &&
      (state === 'all' || row[state]) &&
      (!text || `${row.title} ${row.detail ?? ''} ${row.kind}`.toLowerCase().includes(text)),
  );
  const count = work.data?.count;
  const sources = (Object.keys(MY_WORK_SOURCE_LABELS) as MyWorkSourceCode[]).filter(
    (code) => (count?.by_source[code] ?? 0) > 0,
  );
  return (
    <Page path="/my-work">
      {work.error ? <Alert tone="danger">{messageOf(work.error)}</Alert> : null}
      {work.data?.failed_sources.length ? (
        <Alert tone="warning">
          Chưa đọc được việc của {work.data.failed_sources.map((code) => MY_WORK_SOURCE_LABELS[code]).join(', ')}; mở
          phân hệ đó để xem.
        </Alert>
      ) : null}
      <p className="text-content text-text" data-testid="my-work-summary">
        {count ? (
          <>
            Đang chờ <strong>{count.total}</strong> việc
            {count.overdue ? (
              <>
                , trong đó <strong className="text-danger">{count.overdue}</strong> việc quá hạn
              </>
            ) : null}
            .
          </>
        ) : null}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <Tabs<StateFilter>
          label="Lọc theo hạn"
          value={state}
          options={[
            { value: 'all', label: 'Tất cả' },
            { value: 'overdue', label: `Quá hạn (${count?.overdue ?? 0})` },
            { value: 'due_soon', label: 'Sắp đến hạn' },
          ]}
          onChange={setState}
        />
        <label className="text-label font-medium text-text">
          Phân hệ
          <select
            className={selectClass}
            value={source}
            onChange={(event) => setSource(event.target.value as MyWorkSourceCode | '')}
          >
            <option value="">Tất cả phân hệ ({count?.total ?? 0})</option>
            {sources.map((code) => (
              <option key={code} value={code}>
                {MY_WORK_SOURCE_LABELS[code]} ({count?.by_source[code] ?? 0})
              </option>
            ))}
          </select>
        </label>
      </div>
      <DataGrid
        label="Việc của tôi"
        columns={COLUMNS}
        rows={rows}
        getRowId={(row) => `${row.source}:${row.kind}:${row.title}:${row.received_at ?? ''}:${row.detail ?? ''}`}
        getRowLabel={(row) => row.title}
        loading={!work.data && !work.error}
        emptyText="Không có việc nào đang chờ."
        search={{ label: 'Tìm theo nội dung', value: search, onChange: setSearch }}
        rowActions={(row) => (
          <Link to={row.link} className="text-label font-medium text-brand-strong underline">
            Mở
          </Link>
        )}
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </Page>
  );
}
