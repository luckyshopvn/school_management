import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, StatusBadge, TextField, Toast } from '@school-management/ui';
import { useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { ChildDetailPanel } from './ChildDetailPanel.js';
import { CHILD_STATUS_LABELS, listChildren, type ChildStatus } from './children-api.js';
import { CreateChildForm } from './CreateChildForm.js';

// MH-02 Danh sách trẻ và hồ sơ trẻ (P02-01, P02-02, QT-01); ô mã ngành tô đỏ khi trống (AC-201)
function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

export function ChildrenPage() {
  const canManage = useHasPermission(PERMISSION_CODES.childManage);
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const [orgUnitId, setOrgUnitId] = useState('');
  const [status, setStatus] = useState<ChildStatus | ''>('');
  const [search, setSearch] = useState('');
  const [missingCertificate, setMissingCertificate] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);

  const children = useQuery({
    queryKey: ['children', orgUnitId, status, search, missingCertificate, page],
    queryFn: () =>
      listChildren({
        orgUnitId: orgUnitId || undefined,
        status: status || undefined,
        q: search || undefined,
        missingBirthCertificate: missingCertificate,
        page,
      }),
  });

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-page-title font-bold text-text">Hồ sơ trẻ</h1>
          {canManage ? (
            <Button
              variant="primary"
              className="ml-auto"
              onClick={() => {
                setCreating(true);
                setSelectedId(undefined);
              }}
            >
              Tạo hồ sơ mới
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-2 text-label font-medium text-text">
            Đơn vị
            <select
              value={orgUnitId}
              onChange={(event) => {
                setOrgUnitId(event.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-border bg-card px-3 py-2 text-content font-normal"
            >
              <option value="">Tất cả trong phạm vi</option>
              {unitChoice.units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-label font-medium text-text">
            Trạng thái
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as ChildStatus | '');
                setPage(1);
              }}
              className="rounded-lg border border-border bg-card px-3 py-2 text-content font-normal"
            >
              <option value="">Tất cả</option>
              {(Object.keys(CHILD_STATUS_LABELS) as ChildStatus[]).map((key) => (
                <option key={key} value={key}>
                  {CHILD_STATUS_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 pb-2 text-label">
            <input
              type="checkbox"
              checked={missingCertificate}
              onChange={(event) => {
                setMissingCertificate(event.target.checked);
                setPage(1);
              }}
            />
            Thiếu giấy khai sinh
          </label>
          <TextField
            label="Tìm theo họ tên"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_480px]">
          <section className="rounded-xl border border-border bg-card p-4" aria-label="Danh sách trẻ">
            {children.isPending ? <div className="h-40 animate-pulse rounded bg-border" aria-hidden="true" /> : null}
            {children.isError ? <Alert tone="danger">{messageOf(children.error)}</Alert> : null}
            {children.data && children.data.items.length === 0 ? (
              <p className="text-content text-text-secondary">Không có hồ sơ nào.</p>
            ) : null}
            {children.data && children.data.items.length > 0 ? (
              <>
                <table className="w-full text-content">
                  <thead className="text-left text-label font-medium text-text-secondary">
                    <tr>
                      <th className="px-3 py-2">Họ tên</th>
                      <th className="px-3 py-2">Ngày sinh</th>
                      <th className="px-3 py-2">Lớp</th>
                      <th className="px-3 py-2">Mã ngành</th>
                      <th className="px-3 py-2">Số định danh</th>
                      <th className="px-3 py-2">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {children.data.items.map((child) => (
                      <tr
                        key={child.id}
                        className={`cursor-pointer border-t border-border hover:bg-selected ${child.id === selectedId ? 'bg-selected' : ''}`}
                        onClick={() => {
                          setSelectedId(child.id);
                          setCreating(false);
                        }}
                      >
                        <td className="px-3 py-2 font-medium">{child.full_name}</td>
                        <td className="px-3 py-2">{child.dob}</td>
                        <td className="px-3 py-2">{child.class_name ?? ''}</td>
                        <td className={`px-3 py-2 ${child.moet_student_code ? '' : 'bg-danger/10 text-danger'}`}>
                          {child.moet_student_code ?? 'Chưa có'}
                        </td>
                        <td className="px-3 py-2">{child.national_id_masked}</td>
                        <td className="px-3 py-2">
                          <StatusBadge
                            tone={
                              child.status === 'active' ? 'success' : child.status === 'pending' ? 'warning' : 'neutral'
                            }
                            label={CHILD_STATUS_LABELS[child.status]}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-3 flex items-center gap-3 text-label">
                  <Button variant="text" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    Trang trước
                  </Button>
                  <span>
                    Trang {children.data.page}/{children.data.total_pages} · {children.data.total} trẻ
                  </span>
                  <Button variant="text" disabled={page >= children.data.total_pages} onClick={() => setPage(page + 1)}>
                    Trang sau
                  </Button>
                </div>
              </>
            ) : null}
          </section>
          <aside className="rounded-xl border border-border bg-card p-4">
            {creating ? (
              <CreateChildForm
                units={unitChoice.units}
                defaultUnitId={unitChoice.selectedId}
                onCancel={() => setCreating(false)}
                onCreated={(child) => {
                  setCreating(false);
                  setSelectedId(child.id);
                  setToastMessage(`Đã tạo hồ sơ nháp của ${child.full_name}`);
                  void queryClient.invalidateQueries({ queryKey: ['children'] });
                }}
              />
            ) : selectedId ? (
              <ChildDetailPanel key={selectedId} childId={selectedId} onChanged={setToastMessage} />
            ) : (
              <p className="text-content text-text-secondary">Chọn một trẻ để xem hồ sơ.</p>
            )}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
