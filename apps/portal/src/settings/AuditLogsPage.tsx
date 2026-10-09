import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { listAuditLogs, type AuditLogEntry } from './settings-api.js';

// MH-31 Nhật ký thao tác (P01-09): thẻ nghiệp vụ đọc máy chủ API, thẻ tài khoản và quyền đọc dịch vụ định danh
type Source = 'business' | 'identity';

const ENTITY_LABELS: Record<string, string> = {
  org_units: 'Đơn vị',
  settings: 'Cấu hình',
  users: 'Tài khoản',
  user_roles: 'Vai trò của tài khoản',
  roles: 'Vai trò',
  identity_settings: 'Cấu hình tài khoản',
};

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

function AuditLogTable({ source }: { source: Source }) {
  const [page, setPage] = useState(1);
  const [entityName, setEntityName] = useState('');
  const logs = useQuery({
    queryKey: ['audit-logs', source, page, entityName],
    queryFn: () => listAuditLogs(source, page, entityName),
  });

  return (
    <div className="flex flex-col gap-3">
      {source === 'business' ? (
        <div className="flex items-center gap-2">
          <label htmlFor="audit-entity" className="text-label font-medium text-text">
            Đối tượng
          </label>
          <select
            id="audit-entity"
            value={entityName}
            onChange={(event) => {
              setEntityName(event.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-border bg-card px-3 py-2 text-content"
          >
            <option value="">Tất cả</option>
            <option value="org_units">Đơn vị</option>
            <option value="settings">Cấu hình</option>
          </select>
        </div>
      ) : null}
      {logs.isError ? (
        <Alert tone="danger">{logs.error instanceof ApiError ? logs.error.message : 'Không tải được nhật ký'}</Alert>
      ) : logs.isPending ? (
        <div className="h-40 animate-pulse rounded bg-border" aria-hidden="true" />
      ) : logs.data.items.length === 0 ? (
        <p className="text-content text-text-secondary">Chưa có nhật ký.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-content">
            <thead className="text-left text-label font-medium text-text-secondary">
              <tr>
                <th className="px-3 py-2">Thời điểm</th>
                <th className="px-3 py-2">Người thực hiện</th>
                <th className="px-3 py-2">Đối tượng</th>
                <th className="px-3 py-2">Thao tác</th>
                <th className="px-3 py-2">Nội dung thay đổi</th>
              </tr>
            </thead>
            <tbody>
              {logs.data.items.map((entry: AuditLogEntry) => (
                <tr key={entry.id} className="border-t border-border align-top">
                  <td className="whitespace-nowrap px-3 py-2">{formatTime(entry.created_at)}</td>
                  <td className="px-3 py-2">{entry.actor_name ?? entry.actor_user_id}</td>
                  <td className="px-3 py-2">{ENTITY_LABELS[entry.entity_name] ?? entry.entity_name}</td>
                  <td className="px-3 py-2">{ACTION_LABELS[entry.action] ?? entry.action}</td>
                  <td className="px-3 py-2 text-label text-text-secondary">
                    <ul>
                      {describeChange(entry).map((line) => (
                        <li key={line} className="break-all">
                          {line}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {logs.data && logs.data.total_pages > 1 ? (
        <div className="flex items-center gap-3">
          <Button disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Trang trước
          </Button>
          <span className="text-label text-text-secondary">
            Trang {page} / {logs.data.total_pages}
          </span>
          <Button disabled={page >= logs.data.total_pages} onClick={() => setPage(page + 1)}>
            Trang sau
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function AuditLogsPage() {
  const canSeeAccountLogs = useHasPermission(PERMISSION_CODES.accountManage);
  const [source, setSource] = useState<Source>('business');

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Nhật ký thao tác</h1>
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
