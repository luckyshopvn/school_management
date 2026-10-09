import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, ConfirmDialog, StatusBadge, TextField, Toast } from '@school-management/ui';
import { listAcademicYears } from '../academic-years/academic-years-api.js';
import { AppShell } from '../pages/AppShell.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { OrgUnitForm } from './OrgUnitForm.js';
import {
  createOrgUnit,
  listOrgUnits,
  readOrgUnitTree,
  UNIT_TYPE_LABELS,
  updateOrgUnit,
  type OrgUnit,
  type OrgUnitType,
} from './org-units-api.js';

// MH-32 Cây đơn vị hai cấp: dạng cây mặc định, danh sách phẳng lọc theo loại (Q-119, QĐ-23)
type ViewMode = 'tree' | 'flat';

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

function OrgUnitRow({
  unit,
  canManage,
  indent,
  onChanged,
}: {
  unit: OrgUnit;
  canManage: boolean;
  indent: boolean;
  onChanged(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(unit.name);
  const [address, setAddress] = useState(unit.address ?? '');
  const [phone, setPhone] = useState(unit.phone ?? '');
  const [confirming, setConfirming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  const update = useMutation({
    mutationFn: (changes: Parameters<typeof updateOrgUnit>[1]) => updateOrgUnit(unit.id, changes),
    onSuccess: async (_updated, changes) => {
      setEditing(false);
      setConfirming(false);
      setErrorMessage(undefined);
      await queryClient.invalidateQueries({ queryKey: ['org-units'] });
      onChanged(changes.status ? 'Đã cập nhật trạng thái đơn vị' : 'Đã lưu đơn vị');
    },
    onError: (error) => {
      setConfirming(false);
      setErrorMessage(messageOf(error));
    },
  });

  return (
    <li className={`flex flex-col gap-2 border-t border-border py-3 first:border-t-0 ${indent ? 'pl-8' : ''}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-content font-medium text-text">{unit.name}</span>
        <span className="text-label text-text-secondary">{unit.code}</span>
        <StatusBadge tone="info" label={UNIT_TYPE_LABELS[unit.unit_type]} />
        {unit.status === 'inactive' ? <StatusBadge tone="neutral" label="Ngừng sử dụng" /> : null}
        {canManage && !editing ? (
          <div className="ml-auto flex gap-2">
            <Button variant="text" onClick={() => setEditing(true)}>
              Sửa
            </Button>
            {unit.unit_type !== 'truong_chinh' ? (
              unit.status === 'active' ? (
                <Button variant="text" onClick={() => setConfirming(true)}>
                  Ngừng sử dụng
                </Button>
              ) : (
                <Button variant="text" onClick={() => update.mutate({ status: 'active' })}>
                  Dùng lại
                </Button>
              )
            ) : null}
          </div>
        ) : null}
      </div>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {editing ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <TextField label="Tên đơn vị" value={name} onChange={(event) => setName(event.target.value)} />
          <TextField label="Địa chỉ" value={address} onChange={(event) => setAddress(event.target.value)} />
          <TextField label="Số điện thoại" value={phone} onChange={(event) => setPhone(event.target.value)} />
          <div className="flex gap-2 md:col-span-3">
            <Button
              disabled={update.isPending}
              onClick={() => update.mutate({ name, address: address || null, phone: phone || null })}
            >
              Lưu
            </Button>
            <Button variant="text" onClick={() => setEditing(false)}>
              Hủy
            </Button>
          </div>
        </div>
      ) : null}
      {confirming ? (
        <ConfirmDialog
          open={confirming}
          title={`Ngừng sử dụng ${unit.name}?`}
          confirmLabel="Ngừng sử dụng"
          busy={update.isPending}
          onCancel={() => setConfirming(false)}
          onConfirm={() => update.mutate({ status: 'inactive' })}
        >
          Đơn vị không bị xóa và vẫn giữ dữ liệu cũ, nhưng không chọn được khi tạo lớp mới. Có thể dùng lại sau.
        </ConfirmDialog>
      ) : null}
    </li>
  );
}

export function OrgUnitsPage() {
  const canManage = useHasPermission(PERMISSION_CODES.orgUnitManage);
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [typeFilter, setTypeFilter] = useState<OrgUnitType | ''>('');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);

  const academicYears = useQuery({ queryKey: ['academic-years'], queryFn: listAcademicYears });
  const tree = useQuery({ queryKey: ['org-units', 'tree'], queryFn: readOrgUnitTree });
  const flat = useQuery({
    queryKey: ['org-units', 'flat', typeFilter],
    queryFn: () => listOrgUnits(typeFilter || undefined),
    enabled: viewMode === 'flat',
  });
  const hasOpenYear = academicYears.data?.some((year) => year.status === 'open') ?? true;

  async function create(input: Parameters<typeof createOrgUnit>[0]) {
    const created = await createOrgUnit(input);
    await queryClient.invalidateQueries({ queryKey: ['org-units'] });
    setToastMessage(`Đã tạo ${UNIT_TYPE_LABELS[created.unit_type]} ${created.name}`);
  }

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-page-title font-bold text-text">Cây đơn vị</h1>
          <div className="ml-auto flex gap-2" role="group" aria-label="Cách hiển thị">
            <Button variant={viewMode === 'tree' ? 'secondary' : 'text'} onClick={() => setViewMode('tree')}>
              Dạng cây
            </Button>
            <Button variant={viewMode === 'flat' ? 'secondary' : 'text'} onClick={() => setViewMode('flat')}>
              Danh sách phẳng
            </Button>
          </div>
        </div>
        {!hasOpenYear ? (
          <Alert tone="warning">Chưa có năm học đang dùng. Hãy mở năm học trước khi tạo đơn vị.</Alert>
        ) : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <section className="rounded-xl border border-border bg-card p-4" aria-label="Danh sách đơn vị">
            {viewMode === 'tree' ? (
              tree.isPending ? (
                <div className="h-32 animate-pulse rounded bg-border" aria-hidden="true" />
              ) : tree.isError ? (
                <Alert tone="danger">{messageOf(tree.error)}</Alert>
              ) : tree.data ? (
                <ul>
                  <OrgUnitRow unit={tree.data} canManage={canManage} indent={false} onChanged={setToastMessage} />
                  {tree.data.children.map((child) => (
                    <OrgUnitRow key={child.id} unit={child} canManage={canManage} indent onChanged={setToastMessage} />
                  ))}
                </ul>
              ) : (
                <p className="text-content text-text-secondary">Chưa có đơn vị nào.</p>
              )
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <label htmlFor="org-unit-filter" className="text-label font-medium text-text">
                    Lọc theo loại
                  </label>
                  <select
                    id="org-unit-filter"
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value as OrgUnitType | '')}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-content"
                  >
                    <option value="">Tất cả</option>
                    {Object.entries(UNIT_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                {flat.isPending ? (
                  <div className="h-32 animate-pulse rounded bg-border" aria-hidden="true" />
                ) : flat.isError ? (
                  <Alert tone="danger">{messageOf(flat.error)}</Alert>
                ) : (
                  <ul>
                    {flat.data.map((unit) => (
                      <OrgUnitRow
                        key={unit.id}
                        unit={unit}
                        canManage={canManage}
                        indent={false}
                        onChanged={setToastMessage}
                      />
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          {canManage && hasOpenYear && !tree.isPending ? (
            <aside className="flex flex-col gap-3 self-start rounded-xl border border-border bg-card p-4">
              <h2 className="text-section-title font-semibold text-text">
                {tree.data ? 'Thêm Phân hiệu hoặc Điểm trường' : 'Tạo Trường chính'}
              </h2>
              <OrgUnitForm
                key={tree.data ? 'level-2' : 'root'}
                allowedTypes={tree.data ? ['phan_hieu', 'diem_truong'] : ['truong_chinh']}
                submitLabel={tree.data ? 'Thêm đơn vị' : 'Tạo Trường chính'}
                onSubmit={create}
              />
            </aside>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
