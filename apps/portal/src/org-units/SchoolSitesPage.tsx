import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES, type DataGridKey, type PortalQuickLinkPath } from '@school-management/shared';
import {
  Alert,
  Button,
  ConfirmDialog,
  DataGrid,
  FORM_CONTROL_CLASS,
  FormBlock,
  FormRow,
  StatusBadge,
  Toast,
  type DataGridColumn,
} from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { createOrgUnit, listOrgUnits, readOrgUnitTree, updateOrgUnit, type OrgUnit } from './org-units-api.js';

// 1.2. Quản lý phân hiệu và 1.3. Quản lý điểm trường theo Sở (DT-15 phần 15b, YCTD-111): danh sách đơn vị cấp 2 của cây
// đơn vị (BR-01, QĐ-23) theo từng loại, cột mã, tên, địa chỉ, khoảng cách đến cơ sở chính, diện tích, điện thoại; Thêm mới,
// Sửa bằng biểu mẫu theo khối với nút Ghi. Đơn vị không xóa mà ngừng sử dụng như ở Cây đơn vị
type SiteType = 'phan_hieu' | 'diem_truong';

const SITE_SCREENS: Record<SiteType, { path: PortalQuickLinkPath; gridKey: DataGridKey; noun: string }> = {
  phan_hieu: { path: '/branches', gridKey: 'branches', noun: 'phân hiệu' },
  diem_truong: { path: '/school-sites', gridKey: 'school-sites', noun: 'điểm trường' },
};

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const selectClass = 'mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
const formatNumber = (value: number | null) => (value === null ? '' : value.toLocaleString('vi-VN'));

const COLUMNS: Array<DataGridColumn<OrgUnit>> = [
  { id: 'code', header: 'Mã', cell: (row) => row.code },
  { id: 'name', header: 'Tên', alwaysVisible: true, className: 'font-medium', cell: (row) => row.name },
  { id: 'address', header: 'Địa chỉ', cell: (row) => row.address ?? '' },
  { id: 'distance_km', header: 'Khoảng cách đến cơ sở chính (km)', cell: (row) => formatNumber(row.distance_km) },
  { id: 'area_m2', header: 'Diện tích (m²)', cell: (row) => formatNumber(row.area_m2) },
  { id: 'phone', header: 'Điện thoại', cell: (row) => row.phone ?? '' },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: (row) =>
      row.status === 'active' ? (
        <StatusBadge tone="success" label="Đang dùng" />
      ) : (
        <StatusBadge tone="neutral" label="Ngừng sử dụng" />
      ),
  },
];

// Ô số nhận dấu phẩy thập phân; chữ không đọc được gửi nguyên để máy chủ báo lỗi ở đúng ô
function numberOrText(text: string): number | string | null {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') {
    return null;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : text;
}

function SiteForm({
  unit,
  siteType,
  onSaved,
  onCancel,
}: {
  unit?: OrgUnit;
  siteType: SiteType;
  onSaved(saved: OrgUnit): void;
  onCancel(): void;
}) {
  const [values, setValues] = useState({
    code: unit?.code ?? '',
    name: unit?.name ?? '',
    address: unit?.address ?? '',
    distance_km: unit?.distance_km === null || !unit ? '' : String(unit.distance_km),
    area_m2: unit?.area_m2 === null || !unit ? '' : String(unit.area_m2),
    phone: unit?.phone ?? '',
  });
  const set = (key: keyof typeof values, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const save = useMutation({
    mutationFn: () => {
      const fields = {
        code: values.code,
        name: values.name,
        address: values.address || null,
        phone: values.phone || null,
        // Kiểu số ở giao diện; chữ sai vẫn gửi để máy chủ trả lỗi của ô
        distance_km: numberOrText(values.distance_km) as number | null,
        area_m2: numberOrText(values.area_m2) as number | null,
      };
      return unit ? updateOrgUnit(unit.id, fields) : createOrgUnit({ ...fields, unit_type: siteType });
    },
    onSuccess: onSaved,
  });
  const fieldErrors =
    save.error instanceof ApiError
      ? Object.fromEntries(save.error.details.map((detail) => [detail.field, detail.message]))
      : {};
  const noun = SITE_SCREENS[siteType].noun;
  const title = unit ? `Sửa ${noun} ${unit.name}` : `Thêm mới ${noun}`;
  const text = (key: keyof typeof values, label: string, numeric = false) => (
    <FormRow label={label} error={fieldErrors[key]}>
      <input
        className={FORM_CONTROL_CLASS}
        inputMode={numeric ? 'decimal' : undefined}
        value={values[key]}
        onChange={(event) => set(key, event.target.value)}
      />
    </FormRow>
  );
  return (
    <form
      noValidate
      aria-label={title}
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <h2 className="text-section-title font-semibold text-text">{title}</h2>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title="Thông tin chung">
        {text('code', 'Mã')}
        {text('name', 'Tên')}
        {text('address', 'Địa chỉ')}
        {text('distance_km', 'Khoảng cách đến cơ sở chính (km)', true)}
        {text('area_m2', 'Diện tích (m²)', true)}
        {text('phone', 'Điện thoại')}
      </FormBlock>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Ghi
        </Button>
        <Button variant="text" onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </form>
  );
}

function SchoolSitesScreen({ siteType }: { siteType: SiteType }) {
  const screen = SITE_SCREENS[siteType];
  const canManage = useHasPermission(PERMISSION_CODES.orgUnitManage);
  const queryClient = useQueryClient();
  const grid = useGridSettings(screen.gridKey);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [stopping, setStopping] = useState<OrgUnit>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const units = useQuery({ queryKey: ['org-units', 'flat', siteType], queryFn: () => listOrgUnits(siteType) });
  const tree = useQuery({ queryKey: ['org-units', 'tree'], queryFn: readOrgUnitTree });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['org-units'] });
  const changeStatus = useMutation({
    mutationFn: ({ unit, next }: { unit: OrgUnit; next: 'active' | 'inactive' }) =>
      updateOrgUnit(unit.id, { status: next }),
    onSuccess: async (_saved, { next }) => {
      setStopping(undefined);
      await refresh();
      setToastMessage(next === 'inactive' ? 'Đã ngừng sử dụng đơn vị' : 'Đã dùng lại đơn vị');
    },
    onError: () => setStopping(undefined),
  });
  const keyword = search.trim().toLocaleLowerCase('vi');
  const rows = (units.data ?? []).filter(
    (unit) =>
      (status === '' || unit.status === status) &&
      (keyword === '' ||
        unit.name.toLocaleLowerCase('vi').includes(keyword) ||
        unit.code.toLocaleLowerCase('vi').includes(keyword)),
  );

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle(screen.path)}</h1>
        {!tree.isPending && !tree.data ? (
          <Alert tone="warning">Chưa có Trường chính. Hãy tạo Trường chính ở màn hình Cây đơn vị trước.</Alert>
        ) : null}
        {creating ? (
          <section className="rounded-xl border border-border bg-card p-4">
            <SiteForm
              siteType={siteType}
              onCancel={() => setCreating(false)}
              onSaved={(saved) => {
                setCreating(false);
                void refresh();
                setToastMessage(`Đã tạo ${screen.noun} ${saved.name}`);
              }}
            />
          </section>
        ) : null}
        {units.isError ? <Alert tone="danger">{messageOf(units.error)}</Alert> : null}
        {changeStatus.error ? <Alert tone="danger">{messageOf(changeStatus.error)}</Alert> : null}
        {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
        <DataGrid
          label={`Danh sách ${screen.noun}`}
          columns={COLUMNS}
          rows={rows}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.name}
          loading={units.isPending}
          emptyText={`Chưa có ${screen.noun} nào.`}
          search={{ label: 'Tìm theo tên, mã', value: search, onChange: setSearch }}
          advancedSearch={
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="text-label font-medium text-text">
                Trạng thái
                <select value={status} onChange={(event) => setStatus(event.target.value)} className={selectClass}>
                  <option value="">Tất cả</option>
                  <option value="active">Đang dùng</option>
                  <option value="inactive">Ngừng sử dụng</option>
                </select>
              </label>
            </div>
          }
          toolbar={
            canManage && tree.data ? (
              <Button
                variant="primary"
                onClick={() => {
                  setCreating(true);
                  setEditingId(undefined);
                }}
              >
                Thêm mới
              </Button>
            ) : null
          }
          rowActions={
            canManage
              ? (row) => (
                  <span className="flex flex-wrap justify-end gap-1">
                    <Button
                      variant="text"
                      onClick={() => {
                        setCreating(false);
                        setEditingId(editingId === row.id ? undefined : row.id);
                      }}
                    >
                      Sửa
                    </Button>
                    {row.status === 'active' ? (
                      <Button variant="text" onClick={() => setStopping(row)}>
                        Ngừng sử dụng
                      </Button>
                    ) : (
                      <Button
                        variant="text"
                        disabled={changeStatus.isPending}
                        onClick={() => changeStatus.mutate({ unit: row, next: 'active' })}
                      >
                        Dùng lại
                      </Button>
                    )}
                  </span>
                )
              : undefined
          }
          activeRowId={editingId}
          renderRowDetail={(row) =>
            editingId === row.id ? (
              <SiteForm
                key={row.id}
                unit={row}
                siteType={siteType}
                onCancel={() => setEditingId(undefined)}
                onSaved={(saved) => {
                  setEditingId(undefined);
                  void refresh();
                  setToastMessage(`Đã ghi ${screen.noun} ${saved.name}`);
                }}
              />
            ) : null
          }
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
      </div>
      {stopping ? (
        <ConfirmDialog
          open
          title={`Ngừng sử dụng ${stopping.name}?`}
          confirmLabel="Ngừng sử dụng"
          busy={changeStatus.isPending}
          onCancel={() => setStopping(undefined)}
          onConfirm={() => changeStatus.mutate({ unit: stopping, next: 'inactive' })}
        >
          Đơn vị không bị xóa và vẫn giữ dữ liệu cũ, nhưng không chọn được khi tạo lớp mới. Có thể dùng lại sau.
        </ConfirmDialog>
      ) : null}
    </AppShell>
  );
}

export function BranchesPage() {
  return <SchoolSitesScreen siteType="phan_hieu" />;
}

export function SchoolSitesPage() {
  return <SchoolSitesScreen siteType="diem_truong" />;
}
