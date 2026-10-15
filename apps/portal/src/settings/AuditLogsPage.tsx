import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, DataGrid, type DataGridColumn } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { listAuditLogs, type AuditLogEntry, type AuditLogFilter } from './settings-api.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';

// MH-31 Nhật ký thao tác (P01-09): thẻ nghiệp vụ đọc máy chủ API, thẻ tài khoản và quyền đọc dịch vụ định danh
type Source = 'business' | 'identity';

const ENTITY_LABELS: Record<string, string> = {
  org_units: 'Đơn vị',
  settings: 'Cấu hình',
  departments: 'Phòng ban',
  job_titles: 'Chức danh',
  catalog_items: 'Danh mục dùng chung',
  approval_thresholds: 'Hạn mức phê duyệt',
  rooms: 'Phòng học',
  grade_levels: 'Bậc học',
  users: 'Tài khoản',
  user_roles: 'Vai trò của tài khoản',
  roles: 'Vai trò',
  identity_settings: 'Cấu hình tài khoản',
};

const BUSINESS_ENTITIES = [
  'org_units',
  'settings',
  'departments',
  'job_titles',
  'catalog_items',
  'approval_thresholds',
  'rooms',
  'grade_levels',
];

const ACTION_LABELS: Record<string, string> = {
  create: 'Tạo',
  update: 'Sửa',
  lock: 'Khóa',
  unlock: 'Mở khóa',
  reset_password: 'Đặt lại mật khẩu',
  assign_role: 'Gán vai trò',
  remove_role: 'Gỡ vai trò',
  replace_permissions: 'Sửa quyền',
};

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value));
}

function show(value: unknown): string {
  if (value === null || value === undefined) {
    return 'trống';
  }
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

// Chỉ hiện các trường thay đổi để dễ đọc; bỏ qua mã định danh và mốc thời gian
const HIDDEN_FIELDS = new Set(['id', 'created_at', 'updated_at', 'created_by', 'updated_by']);

function describeChange(entry: AuditLogEntry): string[] {
  const before = (entry.before_data ?? {}) as Record<string, unknown>;
  const after = (entry.after_data ?? {}) as Record<string, unknown>;
  if (typeof before !== 'object' || typeof after !== 'object') {
    return [`${show(entry.before_data)} → ${show(entry.after_data)}`];
  }
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => !HIDDEN_FIELDS.has(key));
  const lines: string[] = [];
  for (const key of keys) {
    const previous = show(before[key]);
    const next = show(after[key]);
    if (entry.before_data === null) {
      if (after[key] !== null && after[key] !== undefined) {
        lines.push(`${key}: ${next}`);
      }
    } else if (previous !== next) {
      lines.push(`${key}: ${previous} → ${next}`);
    }
  }
  return lines;
}

const FILTER_CONTROL_CLASS = 'w-full rounded-lg border border-border bg-card px-3 py-2 text-content';

// Danh sách nhật ký trên lưới dữ liệu chung, phân trang ở máy chủ; bộ lọc đối tượng (nhật ký nghiệp vụ) và khoảng ngày ở
// "Mở rộng tìm kiếm" (DT-15 phần 15e)
function AuditLogTable({ source }: { source: Source }) {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<AuditLogFilter>({ entityName: '', fromDate: '', toDate: '' });
  const grid = useGridSettings('audit-logs');
  const pageSize = grid.settings.pageSize;
  const logs = useQuery({
    queryKey: ['audit-logs', source, page, pageSize, filter],
    queryFn: () => listAuditLogs(source, page, pageSize, filter),
    enabled: grid.ready,
    placeholderData: keepPreviousData,
  });
  const changeFilter = (changes: Partial<AuditLogFilter>) => {
    setFilter((current) => ({ ...current, ...changes }));
    setPage(1);
  };

  const columns: Array<DataGridColumn<AuditLogEntry>> = [
    {
      id: 'created_at',
      header: 'Thời điểm',
      alwaysVisible: true,
      className: 'whitespace-nowrap',
      cell: (entry) => formatTime(entry.created_at),
    },
    { id: 'actor', header: 'Người thực hiện', cell: (entry) => entry.actor_name ?? entry.actor_user_id },
    { id: 'entity', header: 'Đối tượng', cell: (entry) => ENTITY_LABELS[entry.entity_name] ?? entry.entity_name },
    { id: 'action', header: 'Thao tác', cell: (entry) => ACTION_LABELS[entry.action] ?? entry.action },
    {
      id: 'changes',
      header: 'Nội dung thay đổi',
      className: 'text-label text-text-secondary',
      cell: (entry) => (
        <ul>
          {describeChange(entry).map((line) => (
            <li key={line} className="break-all">
              {line}
            </li>
          ))}
        </ul>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {logs.isError ? (
        <Alert tone="danger">{logs.error instanceof ApiError ? logs.error.message : 'Không tải được nhật ký'}</Alert>
      ) : null}
      {grid.error ? <Alert tone="danger">{grid.error.message}</Alert> : null}
      <DataGrid
        label={source === 'business' ? 'Nhật ký nghiệp vụ' : 'Nhật ký tài khoản và quyền'}
        columns={columns}
        rows={logs.data?.items ?? []}
        getRowId={(entry) => entry.id}
        getRowLabel={(entry) => `${formatTime(entry.created_at)} ${ACTION_LABELS[entry.action] ?? entry.action}`}
        loading={logs.isPending}
        emptyText="Chưa có nhật ký."
        advancedSearch={
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {source === 'business' ? (
              <div className="flex flex-col gap-2">
                <label htmlFor="audit-entity" className="text-label font-medium text-text">
                  Đối tượng
                </label>
                <select
                  id="audit-entity"
                  value={filter.entityName}
                  onChange={(event) => changeFilter({ entityName: event.target.value })}
                  className={FILTER_CONTROL_CLASS}
                >
                  <option value="">Tất cả</option>
                  {BUSINESS_ENTITIES.map((entity) => (
                    <option key={entity} value={entity}>
                      {ENTITY_LABELS[entity]}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="flex flex-col gap-2">
              <label htmlFor={`audit-from-${source}`} className="text-label font-medium text-text">
                Từ ngày
              </label>
              <input
                id={`audit-from-${source}`}
                type="date"
                value={filter.fromDate}
                onChange={(event) => changeFilter({ fromDate: event.target.value })}
                className={FILTER_CONTROL_CLASS}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor={`audit-to-${source}`} className="text-label font-medium text-text">
                Đến ngày
              </label>
              <input
                id={`audit-to-${source}`}
                type="date"
                value={filter.toDate}
                onChange={(event) => changeFilter({ toDate: event.target.value })}
                className={FILTER_CONTROL_CLASS}
              />
            </div>
          </div>
        }
        settings={grid.settings}
        onSettingsChange={(next) => {
          grid.update(next);
          setPage(1);
        }}
        serverPagination={{ page, total: logs.data?.total ?? 0, onPageChange: setPage }}
      />
    </div>
  );
}

export function AuditLogsPage() {
  const canSeeAccountLogs = useHasPermission(PERMISSION_CODES.accountManage);
  const [source, setSource] = useState<Source>('business');

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/audit-logs')}</h1>
        <div className="flex gap-2" role="tablist" aria-label="Nguồn nhật ký">
          <Button
            role="tab"
            aria-selected={source === 'business'}
            variant={source === 'business' ? 'secondary' : 'text'}
            onClick={() => setSource('business')}
          >
            Nghiệp vụ
          </Button>
          {canSeeAccountLogs ? (
            <Button
              role="tab"
              aria-selected={source === 'identity'}
              variant={source === 'identity' ? 'secondary' : 'text'}
              onClick={() => setSource('identity')}
            >
              Tài khoản và quyền
            </Button>
          ) : null}
        </div>
        <section className="rounded-xl border border-border bg-card p-4">
          <AuditLogTable key={source} source={source} />
        </section>
      </div>
    </AppShell>
  );
}
