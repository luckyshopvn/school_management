import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ADMISSION_SUPPORT_STATUS_LABELS,
  ADMISSION_SUPPORT_STATUSES,
  PERMISSION_CODES,
} from '@school-management/shared';
import {
  Alert,
  Button,
  ConfirmDeleteDialog,
  ConfirmDialog,
  DataGrid,
  FORM_CONTROL_CLASS,
  FormBlock,
  FormRow,
  StatusBadge,
  Toast,
  type DataGridColumn,
} from '@school-management/ui';
import {
  exportAccounts,
  listAccountDirectory,
  listRoles,
  EMPTY_ACCOUNT_FILTER,
  type DirectoryAccount,
  type Role,
} from '../accounts/accounts-api.js';
import { SelectBox } from '../facilities/facilities-ui.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import {
  confirmSchoolMap,
  exportCompletion,
  exportEntryStaff,
  exportSchoolServices,
  exportStatistics,
  exportSupportRequests,
  formatDate,
  formatDateTime,
  listCompletion,
  listEntryClasses,
  listEntryStaff,
  listSchoolServices,
  listStatistics,
  listSupportRequests,
  messageOf,
  notifySupportRequests,
  openMap,
  readSchoolMap,
  removeSchoolServices,
  replySupportRequest,
  saveCompletion,
  saveSchoolMap,
  saveSchoolService,
  type CompletionRow,
  type EntryClass,
  type EntryStaff,
  type MapUnit,
  type SchoolService,
  type StatisticsRow,
  type SupportRequest,
} from './entry-admissions-api.js';

// Các màn hình còn lại của phân hệ Tuyển sinh đầu cấp phần 1 (DT-17 phần 17c, khảo sát mục 10.2.3 và 10.2.5): 1.2, 4.1, 1.8,
// 2.1, 3.1 đến 3.4, 5.1. Dùng chung cơ sở dữ liệu nên 3.1 đến 3.4 không có "Đồng bộ dữ liệu"; thêm, sửa nhóm người dùng,
// người dùng làm ở phân hệ Quản trị hệ thống
function useToast() {
  const [message, setMessage] = useState<string>();
  const close = useCallback(() => setMessage(undefined), []);
  return { message, setMessage, element: <Toast message={message} onClose={close} /> };
}

function Page({ path, children }: { path: Parameters<typeof menuPageTitle>[0]; children: React.ReactNode }) {
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle(path)}</h1>
        {children}
      </div>
    </AppShell>
  );
}

function TextFilter({ label, value, onChange }: { label: string; value: string; onChange(value: string): void }) {
  return (
    <label className="flex flex-col gap-2 text-label font-medium text-text">
      {label}
      <input className={FORM_CONTROL_CLASS} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

// 1.2 Gửi xác nhận hoàn thành hồ sơ cuối cấp lên cấp trên: ô xác nhận theo lớp, Ghi là trạng thái đánh dấu tay; xuất tệp
// danh sách để nộp cho cấp trên
export function FinalYearCompletionPage() {
  const canManage = useHasPermission(PERMISSION_CODES.finalYearManage);
  const queryClient = useQueryClient();
  const grid = useGridSettings('final-year-completion');
  const toast = useToast();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string>();
  const list = useQuery({ queryKey: ['final-year', 'completion'], queryFn: listCompletion });
  useEffect(() => {
    setChecked(Object.fromEntries((list.data?.items ?? []).map((row) => [row.class_id, row.confirmed])));
  }, [list.data]);
  const save = useMutation({
    mutationFn: () =>
      saveCompletion(
        (list.data?.items ?? []).map((row) => ({ class_id: row.class_id, confirmed: !!checked[row.class_id] })),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['final-year'] });
      toast.setMessage('Đã ghi xác nhận hoàn thành hồ sơ cuối cấp');
    },
    onError: (reason) => setError(messageOf(reason)),
  });
  const columns: Array<DataGridColumn<CompletionRow>> = [
    { id: 'class', header: 'Lớp', alwaysVisible: true, className: 'font-medium', cell: (row) => row.class_name },
    { id: 'unit', header: 'Đơn vị', hiddenByDefault: true, cell: (row) => row.org_unit_name },
    { id: 'total', header: 'Tổng số hồ sơ cuối cấp', cell: (row) => row.total },
    { id: 'ratio', header: 'Số hồ sơ đủ thông tin/Tổng số', cell: (row) => `${row.complete}/${row.total}` },
    { id: 'missing', header: 'Hồ sơ thiếu thông tin', cell: (row) => row.missing },
    {
      id: 'confirmed',
      header: 'Xác nhận hoàn thành hồ sơ cuối cấp',
      cell: (row) => (
        <input
          type="checkbox"
          aria-label={`Xác nhận hoàn thành ${row.class_name}`}
          disabled={!canManage}
          checked={!!checked[row.class_id]}
          onChange={(event) => setChecked((current) => ({ ...current, [row.class_id]: event.target.checked }))}
        />
      ),
    },
    { id: 'by', header: 'Người xác nhận', cell: (row) => row.confirmed_by_name ?? '' },
    { id: 'at', header: 'Ngày xác nhận', cell: (row) => formatDateTime(row.confirmed_at) },
  ];
  return (
    <Page path="/entry-admissions/completion">
      {toast.element}
      <Alert tone="info">
        Phần mềm không gửi lên hệ thống của cấp trên: tích "Xác nhận hoàn thành" rồi bấm Ghi để đánh dấu, bấm "Xuất
        Excel" để lấy danh sách nộp cho cấp trên.
      </Alert>
      {list.isError ? <Alert tone="danger">{messageOf(list.error)}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <DataGrid
        label="Xác nhận hoàn thành hồ sơ cuối cấp theo lớp"
        columns={columns}
        rows={list.data?.items ?? []}
        getRowId={(row) => row.class_id}
        getRowLabel={(row) => row.class_name}
        loading={list.isPending}
        emptyText="Chưa có lớp năm cuối cấp."
        toolbar={
          <>
            {canManage ? (
              <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
                Ghi
              </Button>
            ) : null}
            <Button onClick={() => exportCompletion().catch((reason: unknown) => setError(messageOf(reason)))}>
              Xuất Excel
            </Button>
          </>
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </Page>
  );
}

// 4.1 Thống kê hồ sơ cuối cấp theo đơn vị
export function FinalYearStatisticsPage() {
  const grid = useGridSettings('final-year-statistics');
  const [error, setError] = useState<string>();
  const list = useQuery({ queryKey: ['final-year', 'statistics'], queryFn: listStatistics });
  const columns: Array<DataGridColumn<StatisticsRow>> = [
    { id: 'unit', header: 'Đơn vị', alwaysVisible: true, className: 'font-medium', cell: (row) => row.org_unit_name },
    { id: 'total', header: 'Tổng số hồ sơ cuối cấp đã lấy sang TSDC', cell: (row) => row.total },
    { id: 'missing', header: 'Tổng số hồ sơ thiếu thông tin', cell: (row) => row.missing },
    {
      id: 'rate',
      header: 'Tỷ lệ số hồ sơ đủ thông tin/tổng hồ sơ cuối cấp (%)',
      cell: (row) => row.complete_rate.toLocaleString('vi-VN'),
    },
  ];
  return (
    <Page path="/entry-admissions/statistics">
      {list.isError ? <Alert tone="danger">{messageOf(list.error)}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <DataGrid
        label="Thống kê hồ sơ cuối cấp"
        columns={columns}
        rows={list.data?.items ?? []}
        getRowId={(row) => row.org_unit_id}
        getRowLabel={(row) => row.org_unit_name}
        loading={list.isPending}
        emptyText="Chưa có đơn vị."
        toolbar={
          <Button onClick={() => exportStatistics().catch((reason: unknown) => setError(messageOf(reason)))}>
            Xuất excel
          </Button>
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </Page>
  );
}

type MapForm = Record<'latitude' | 'longitude' | 'province' | 'ward' | 'quarter' | 'phone' | 'address', string>;
const mapFormOf = (unit: MapUnit | null | undefined): MapForm => ({
  latitude: unit?.latitude?.toString() ?? '',
  longitude: unit?.longitude?.toString() ?? '',
  province: unit?.province ?? '',
  ward: unit?.ward ?? '',
  quarter: unit?.quarter ?? '',
  phone: unit?.phone ?? '',
  address: unit?.address ?? '',
});
const mapInputOf = (form: MapForm) =>
  Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim() === '' ? null : value.trim()]));

// 1.8 Thông tin trường tuyển sinh theo bản đồ GIS
export function SchoolMapPage() {
  const canManage = useHasPermission(PERMISSION_CODES.finalYearManage);
  const queryClient = useQueryClient();
  const grid = useGridSettings('entry-school-sites');
  const toast = useToast();
  const [form, setForm] = useState<MapForm>(mapFormOf(null));
  const [site, setSite] = useState<MapUnit>();
  const [siteForm, setSiteForm] = useState<MapForm>(mapFormOf(null));
  const [error, setError] = useState<string>();
  const map = useQuery({ queryKey: ['entry-school-map'], queryFn: readSchoolMap });
  useEffect(() => setForm(mapFormOf(map.data?.school)), [map.data]);
  const done = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['entry-school-map'] });
    toast.setMessage(message);
  };
  const run = (work: () => Promise<unknown>, message: string) => {
    setError(undefined);
    work()
      .then(() => done(message))
      .catch((reason: unknown) => setError(messageOf(reason)));
  };
  const school = map.data?.school;
  const set = (key: keyof MapForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const columns: Array<DataGridColumn<MapUnit>> = [
    { id: 'code', header: 'Mã điểm trường', cell: (row) => row.code },
    { id: 'name', header: 'Tên điểm trường', alwaysVisible: true, className: 'font-medium', cell: (row) => row.name },
    { id: 'address', header: 'Địa chỉ', cell: (row) => row.address ?? '' },
    { id: 'longitude', header: 'Kinh tuyến', cell: (row) => row.longitude ?? '' },
    { id: 'latitude', header: 'Vĩ tuyến', cell: (row) => row.latitude ?? '' },
    {
      id: 'view',
      header: 'Xem vị trí',
      cell: (row) =>
        row.latitude !== null && row.longitude !== null ? (
          <Button variant="text" onClick={() => openMap(row.latitude as number, row.longitude as number)}>
            Xem vị trí
          </Button>
        ) : (
          ''
        ),
    },
    {
      id: 'check',
      header: 'Trạng thái kiểm dò',
      cell: (row) => <StatusBadge tone={row.missing.length ? 'warning' : 'success'} label={row.check_text} />,
    },
  ];
  return (
    <Page path="/entry-admissions/school-map">
      {toast.element}
      {map.isError ? <Alert tone="danger">{messageOf(map.error)}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {school ? (
        <FormBlock title="Thông tin trường">
          <FormRow label="Tên trường">
            <span>{school.name}</span>
          </FormRow>
          {(
            [
              ['latitude', 'Vĩ độ'],
              ['longitude', 'Kinh độ'],
              ['province', 'Tỉnh/Thành phố (*)'],
              ['ward', 'Phường/Xã (*)'],
              ['quarter', 'Khu phố (*)'],
              ['phone', 'Điện thoại'],
              ['address', 'Địa chỉ'],
            ] as const
          ).map(([key, label]) => (
            <FormRow key={key} label={label}>
              <input
                className={FORM_CONTROL_CLASS}
                value={form[key]}
                disabled={!canManage}
                onChange={(event) => set(key, event.target.value)}
              />
            </FormRow>
          ))}
          <FormRow label="Trạng thái">
            <span>
              {school.check_text}
              {school.map_confirmed_at
                ? `; đã xác nhận ${formatDateTime(school.map_confirmed_at)} (${school.map_confirmed_by_name ?? ''})`
                : '; chưa xác nhận'}
            </span>
          </FormRow>
          <div className="flex flex-wrap gap-2">
            {canManage ? (
              <>
                <Button
                  variant="primary"
                  onClick={() => run(() => saveSchoolMap(school.id, mapInputOf(form)), 'Đã cập nhật thông tin trường')}
                >
                  Cập nhật
                </Button>
                <Button onClick={() => run(confirmSchoolMap, 'Đã xác nhận thông tin trường')}>Xác nhận</Button>
              </>
            ) : null}
            {school.latitude !== null && school.longitude !== null ? (
              <Button variant="text" onClick={() => openMap(school.latitude as number, school.longitude as number)}>
                Xem vị trí
              </Button>
            ) : null}
          </div>
        </FormBlock>
      ) : null}
      <DataGrid
        label="Danh sách điểm trường"
        columns={columns}
        rows={map.data?.sites ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.name}
        loading={map.isPending}
        emptyText="Chưa có điểm trường."
        rowActions={(row) =>
          canManage ? (
            <Button
              variant="text"
              onClick={() => {
                setSite(row);
                setSiteForm(mapFormOf(row));
              }}
            >
              Cập nhật
            </Button>
          ) : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
      {site ? (
        <ConfirmDialog
          open
          title={`Tọa độ ${site.name}`}
          confirmLabel="Ghi"
          onCancel={() => setSite(undefined)}
          onConfirm={() =>
            run(async () => {
              await saveSchoolMap(site.id, mapInputOf(siteForm));
              setSite(undefined);
            }, `Đã cập nhật ${site.name}`)
          }
        >
          <span className="flex flex-col gap-3">
            {(
              [
                ['latitude', 'Vĩ tuyến'],
                ['longitude', 'Kinh tuyến'],
                ['province', 'Tỉnh/Thành phố'],
                ['ward', 'Phường/Xã'],
                ['quarter', 'Khu phố'],
                ['address', 'Địa chỉ'],
              ] as const
            ).map(([key, label]) => (
              <FormRow key={key} label={label}>
                <input
                  className={FORM_CONTROL_CLASS}
                  value={siteForm[key]}
                  onChange={(event) => setSiteForm((current) => ({ ...current, [key]: event.target.value }))}
                />
              </FormRow>
            ))}
          </span>
        </ConfirmDialog>
      ) : null}
    </Page>
  );
}

// 2.1 Các dịch vụ được đăng ký tại trường
export function SchoolServicesPage() {
  const canManage = useHasPermission(PERMISSION_CODES.finalYearManage);
  const queryClient = useQueryClient();
  const grid = useGridSettings('entry-school-services');
  const toast = useToast();
  const [draft, setDraft] = useState({ code: '', name: '' });
  const [filter, setFilter] = useState({ code: '', name: '' });
  const [editing, setEditing] = useState<{ id: string | null; code: string; name: string; sort_order: string }>();
  const [removing, setRemoving] = useState<SchoolService[]>();
  const [error, setError] = useState<string>();
  const list = useQuery({ queryKey: ['school-services', filter], queryFn: () => listSchoolServices(filter) });
  const save = useMutation({
    mutationFn: (input: NonNullable<typeof editing>) =>
      saveSchoolService(input.id, {
        code: input.code.trim(),
        name: input.name.trim(),
        sort_order: Number(input.sort_order) || 0,
      }),
    onSuccess: async () => {
      setEditing(undefined);
      await queryClient.invalidateQueries({ queryKey: ['school-services'] });
      toast.setMessage('Đã ghi dịch vụ');
    },
    onError: (reason) => setError(messageOf(reason)),
  });
  const remove = useMutation({
    mutationFn: (rows: SchoolService[]) => removeSchoolServices(rows.map((row) => row.id)),
    onSuccess: async (result) => {
      setRemoving(undefined);
      await queryClient.invalidateQueries({ queryKey: ['school-services'] });
      toast.setMessage(`Đã xóa ${result.removed} dịch vụ`);
    },
    onError: (reason) => setError(messageOf(reason)),
  });
  const columns: Array<DataGridColumn<SchoolService>> = [
    { id: 'code', header: 'Mã dịch vụ', alwaysVisible: true, cell: (row) => row.code },
    { id: 'name', header: 'Tên dịch vụ', className: 'font-medium', cell: (row) => row.name },
    { id: 'order', header: 'Thứ tự', cell: (row) => row.sort_order },
    { id: 'finance', header: 'Dịch vụ tài chính cùng mã', cell: (row) => row.finance_service_name ?? '' },
  ];
  return (
    <Page path="/entry-admissions/services">
      {toast.element}
      {list.isError ? <Alert tone="danger">{messageOf(list.error)}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <form
        className="grid grid-cols-1 gap-4 md:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          setFilter(draft);
        }}
      >
        <TextFilter
          label="Mã dịch vụ"
          value={draft.code}
          onChange={(code) => setDraft((current) => ({ ...current, code }))}
        />
        <TextFilter
          label="Tên dịch vụ"
          value={draft.name}
          onChange={(name) => setDraft((current) => ({ ...current, name }))}
        />
        <div className="flex items-end">
          <Button type="submit" variant="primary">
            Tìm kiếm
          </Button>
        </div>
      </form>
      <DataGrid
        label="Danh sách dịch vụ đăng ký tại trường"
        columns={columns}
        rows={list.data?.items ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.name}
        loading={list.isPending}
        emptyText="Chưa có dịch vụ."
        selectable={canManage}
        toolbar={(selected) => (
          <>
            {canManage ? (
              <>
                <Button variant="primary" onClick={() => setEditing({ id: null, code: '', name: '', sort_order: '0' })}>
                  Thêm mới
                </Button>
                <Button disabled={selected.length === 0} onClick={() => setRemoving(selected)}>
                  Xóa
                </Button>
              </>
            ) : null}
            <Button
              onClick={() => exportSchoolServices(filter).catch((reason: unknown) => setError(messageOf(reason)))}
            >
              Xuất Excel
            </Button>
          </>
        )}
        rowActions={(row) =>
          canManage ? (
            <Button
              variant="text"
              onClick={() =>
                setEditing({ id: row.id, code: row.code, name: row.name, sort_order: String(row.sort_order) })
              }
            >
              Sửa
            </Button>
          ) : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
      {editing ? (
        <ConfirmDialog
          open
          title={editing.id ? 'Sửa dịch vụ' : 'Thêm dịch vụ'}
          confirmLabel="Ghi"
          busy={save.isPending}
          onCancel={() => setEditing(undefined)}
          onConfirm={() => save.mutate(editing)}
        >
          <span className="flex flex-col gap-3">
            {(
              [
                ['code', 'Mã dịch vụ'],
                ['name', 'Tên dịch vụ'],
                ['sort_order', 'Thứ tự'],
              ] as const
            ).map(([key, label]) => (
              <FormRow key={key} label={label}>
                <input
                  className={FORM_CONTROL_CLASS}
                  value={editing[key]}
                  onChange={(event) => setEditing({ ...editing, [key]: event.target.value })}
                />
              </FormRow>
            ))}
          </span>
        </ConfirmDialog>
      ) : null}
      {removing ? (
        <ConfirmDeleteDialog
          open
          subject={`${removing.length} dịch vụ`}
          busy={remove.isPending}
          onCancel={() => setRemoving(undefined)}
          onConfirm={() => remove.mutate(removing)}
        />
      ) : null}
    </Page>
  );
}

// 3.1 Nhóm người dùng: hiển thị nhóm người dùng của hệ thống; sửa, phân quyền ở Quản trị hệ thống
export function EntryRolesPage() {
  const grid = useGridSettings('entry-roles');
  const roles = useQuery({ queryKey: ['roles'], queryFn: listRoles });
  const columns: Array<DataGridColumn<Role>> = [
    { id: 'code', header: 'Mã', cell: (row) => row.code },
    { id: 'name', header: 'Tên', alwaysVisible: true, className: 'font-medium', cell: (row) => row.name },
    { id: 'active', header: 'Hiệu lực', cell: (row) => (row.is_active ? 'Có' : 'Không') },
    {
      id: 'admin',
      header: 'Là nhóm quản trị',
      cell: (row) => (row.permissions.includes(PERMISSION_CODES.accountManage) ? 'Có' : 'Không'),
    },
  ];
  return (
    <Page path="/entry-admissions/roles">
      <Alert tone="info">
        Phân hệ dùng chung nhóm người dùng của hệ thống. Thêm mới, sửa, phân quyền, xóa nhóm ở "Quản trị hệ thống › Nhóm
        người dùng".
      </Alert>
      {roles.isError ? <Alert tone="danger">{messageOf(roles.error)}</Alert> : null}
      <DataGrid
        label="Danh sách nhóm người dùng"
        columns={columns}
        rows={roles.data ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.name}
        loading={roles.isPending}
        emptyText="Chưa có nhóm người dùng."
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </Page>
  );
}

// 3.2 Danh sách người dùng: lọc mã nhân sự, họ tên, nhóm quyền; "Tài khoản gốc" là tài khoản của Hiệu trưởng hoặc quản trị
// nền tảng
export function EntryUsersPage() {
  const grid = useGridSettings('entry-users');
  const [draft, setDraft] = useState({ identifier: '', fullName: '', roleCode: '' });
  const [filter, setFilter] = useState(draft);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string>();
  const roles = useQuery({ queryKey: ['roles'], queryFn: listRoles });
  const accountFilter = { ...EMPTY_ACCOUNT_FILTER, ...filter };
  const users = useQuery({
    queryKey: ['entry-users', filter, page, grid.settings.pageSize],
    queryFn: () => listAccountDirectory({ ...accountFilter, page, pageSize: grid.settings.pageSize }),
    enabled: grid.ready,
  });
  const columns: Array<DataGridColumn<DirectoryAccount>> = [
    { id: 'staff_code', header: 'Mã nhân sự', cell: (row) => row.moet_staff_code ?? row.staff_code ?? '' },
    { id: 'name', header: 'Họ tên', alwaysVisible: true, className: 'font-medium', cell: (row) => row.full_name },
    { id: 'login', header: 'Tên đăng nhập', cell: (row) => row.username ?? row.phone ?? '' },
    { id: 'roles', header: 'Nhóm quyền', cell: (row) => row.assignments.map((item) => item.role_name).join(', ') },
    {
      id: 'root',
      header: 'Tài khoản gốc',
      cell: (row) => (row.assignments.some((item) => ['VT-01', 'VT-02'].includes(item.role_code)) ? 'Có' : ''),
    },
  ];
  return (
    <Page path="/entry-admissions/users">
      <Alert tone="info">
        Phân hệ dùng chung tài khoản của hệ thống. Phân nhóm quyền, khóa, xóa tài khoản ở "Quản trị hệ thống › Danh sách
        người dùng".
      </Alert>
      {users.isError ? <Alert tone="danger">{messageOf(users.error)}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <form
        className="grid grid-cols-1 gap-4 md:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setFilter(draft);
        }}
      >
        <TextFilter
          label="Mã nhân sự"
          value={draft.identifier}
          onChange={(identifier) => setDraft({ ...draft, identifier })}
        />
        <TextFilter label="Họ tên" value={draft.fullName} onChange={(fullName) => setDraft({ ...draft, fullName })} />
        <SelectBox
          label="Nhóm quyền"
          value={draft.roleCode}
          emptyLabel="Tất cả"
          options={(roles.data ?? []).map((role) => ({ value: role.code, label: role.name }))}
          onChange={(roleCode) => setDraft({ ...draft, roleCode })}
        />
        <div className="flex items-end">
          <Button type="submit" variant="primary">
            Tìm kiếm
          </Button>
        </div>
      </form>
      <DataGrid
        label="Danh sách người dùng"
        columns={columns}
        rows={users.data?.items ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.full_name}
        loading={users.isPending}
        emptyText="Không có người dùng."
        serverPagination={{ page, total: users.data?.total ?? 0, onPageChange: setPage }}
        toolbar={
          <Button
            onClick={() =>
              exportAccounts(accountFilter, ['staff_code', 'full_name', 'login', 'roles']).catch((reason: unknown) =>
                setError(messageOf(reason)),
              )
            }
          >
            Xuất Excel
          </Button>
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </Page>
  );
}

// 3.3 Danh sách nhân sự
export function EntryStaffPage() {
  const grid = useGridSettings('entry-staff');
  const [draft, setDraft] = useState({ code: '', name: '', phone: '' });
  const [filter, setFilter] = useState(draft);
  const [error, setError] = useState<string>();
  const staff = useQuery({ queryKey: ['entry-staff', filter], queryFn: () => listEntryStaff(filter) });
  const columns: Array<DataGridColumn<EntryStaff>> = [
    { id: 'identifier', header: 'Mã định danh', cell: (row) => row.identifier },
    { id: 'name', header: 'Họ tên', alwaysVisible: true, className: 'font-medium', cell: (row) => row.full_name },
    { id: 'dob', header: 'Ngày sinh', cell: (row) => formatDate(row.dob) },
    {
      id: 'gender',
      header: 'Giới tính',
      cell: (row) => (row.gender === 'male' ? 'Nam' : row.gender === 'female' ? 'Nữ' : ''),
    },
    { id: 'phone', header: 'Điện thoại', cell: (row) => row.phone ?? '' },
    { id: 'title', header: 'Chức vụ', cell: (row) => row.job_title ?? '' },
  ];
  return (
    <Page path="/entry-admissions/staff">
      {staff.isError ? <Alert tone="danger">{messageOf(staff.error)}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <form
        className="grid grid-cols-1 gap-4 md:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          setFilter(draft);
        }}
      >
        <TextFilter label="Mã định danh" value={draft.code} onChange={(code) => setDraft({ ...draft, code })} />
        <TextFilter label="Họ tên" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} />
        <TextFilter label="Điện thoại" value={draft.phone} onChange={(phone) => setDraft({ ...draft, phone })} />
        <div className="flex items-end">
          <Button type="submit" variant="primary">
            Tìm kiếm
          </Button>
        </div>
      </form>
      <DataGrid
        label="Danh sách nhân sự"
        columns={columns}
        rows={staff.data?.items ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.full_name}
        loading={staff.isPending}
        emptyText="Không có nhân sự."
        toolbar={
          <Button onClick={() => exportEntryStaff(filter).catch((reason: unknown) => setError(messageOf(reason)))}>
            Xuất Excel
          </Button>
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </Page>
  );
}

// 3.4 Danh sách lớp
export function EntryClassesPage() {
  const grid = useGridSettings('entry-classes');
  const [gradeLevel, setGradeLevel] = useState('');
  const classes = useQuery({ queryKey: ['entry-classes', gradeLevel], queryFn: () => listEntryClasses(gradeLevel) });
  const columns: Array<DataGridColumn<EntryClass>> = [
    { id: 'name', header: 'Tên lớp', alwaysVisible: true, className: 'font-medium', cell: (row) => row.name },
    { id: 'grade', header: 'Khối', cell: (row) => row.grade_level_name },
    { id: 'order', header: 'Thứ tự', cell: (row) => row.sort_order ?? '' },
    { id: 'teacher', header: 'Giáo viên chủ nhiệm', cell: (row) => row.homeroom_teachers },
  ];
  return (
    <Page path="/entry-admissions/classes">
      {classes.isError ? <Alert tone="danger">{messageOf(classes.error)}</Alert> : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SelectBox
          label="Khối"
          value={gradeLevel}
          emptyLabel="Tất cả"
          options={(classes.data?.grade_levels ?? []).map((item) => ({ value: item.code, label: item.name }))}
          onChange={setGradeLevel}
        />
      </div>
      <DataGrid
        label="Danh sách lớp"
        columns={columns}
        rows={classes.data?.items ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.name}
        loading={classes.isPending}
        emptyText="Không có lớp."
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </Page>
  );
}

// 5.1 Danh sách hỗ trợ tuyển sinh: "Cập nhật" ghi câu trả lời; "Gửi email" gửi câu trả lời qua ứng dụng phụ huynh (và thư
// điện tử khi có cấu hình gửi thư)
export function SupportRequestsPage() {
  const canReply = useHasPermission(PERMISSION_CODES.admissionSupportReply);
  const queryClient = useQueryClient();
  const grid = useGridSettings('admission-support-requests');
  const toast = useToast();
  const [draft, setDraft] = useState({ q: '', national_id: '', status: '' });
  const [filter, setFilter] = useState(draft);
  const [replying, setReplying] = useState<{ row: SupportRequest; reply: string }>();
  const [error, setError] = useState<string>();
  const list = useQuery({ queryKey: ['admission-support', filter], queryFn: () => listSupportRequests(filter) });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['admission-support'] });
    toast.setMessage(message);
  };
  const reply = useMutation({
    mutationFn: (input: NonNullable<typeof replying>) => replySupportRequest(input.row.id, input.reply.trim() || null),
    onSuccess: async () => {
      setReplying(undefined);
      await refresh('Đã ghi câu trả lời');
    },
    onError: (reason) => setError(messageOf(reason)),
  });
  const notify = useMutation({
    mutationFn: (rows: SupportRequest[]) => notifySupportRequests(rows.map((row) => row.id)),
    onSuccess: (result) =>
      refresh(
        `Đã gửi câu trả lời cho ${result.sent} phụ huynh qua ứng dụng phụ huynh` +
          (result.email_available ? '' : ' (chưa cấu hình gửi thư điện tử)') +
          (result.skipped.length
            ? `; bỏ qua ${result.skipped.length}: ${result.skipped.map((item) => item.reason).join('; ')}`
            : ''),
      ),
    onError: (reason) => setError(messageOf(reason)),
  });
  const columns: Array<DataGridColumn<SupportRequest>> = [
    {
      id: 'name',
      header: 'Họ tên',
      alwaysVisible: true,
      className: 'font-medium',
      cell: (row) => row.child_name ?? row.requester_name,
    },
    { id: 'dob', header: 'Ngày sinh', cell: (row) => formatDate(row.child_dob) },
    { id: 'national_id', header: 'Mã số ĐDCN', cell: (row) => row.national_id ?? '' },
    { id: 'email', header: 'Địa chỉ email', cell: (row) => row.email ?? '' },
    { id: 'phone', header: 'Điện thoại', cell: (row) => row.phone ?? '' },
    { id: 'content', header: 'Nội dung đề xuất', cell: (row) => row.content },
    { id: 'sent', header: 'Ngày gửi', cell: (row) => formatDateTime(row.created_at) },
    { id: 'reply', header: 'Nội dung câu trả lời', cell: (row) => row.reply ?? '' },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: (row) => (
        <StatusBadge
          tone={row.status === 'answered' ? 'success' : 'warning'}
          label={ADMISSION_SUPPORT_STATUS_LABELS[row.status] + (row.notified_at ? ', đã gửi' : '')}
        />
      ),
    },
    { id: 'replied_by', header: 'Người trả lời', cell: (row) => row.replied_by_name ?? '' },
    { id: 'replied_at', header: 'Thời gian trả lời', cell: (row) => formatDateTime(row.replied_at) },
  ];
  return (
    <Page path="/entry-admissions/support">
      {toast.element}
      {list.isError ? <Alert tone="danger">{messageOf(list.error)}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <form
        className="grid grid-cols-1 gap-4 md:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          setFilter(draft);
        }}
      >
        <TextFilter label="Họ và tên" value={draft.q} onChange={(q) => setDraft({ ...draft, q })} />
        <TextFilter
          label="Số ĐDCN"
          value={draft.national_id}
          onChange={(nationalId) => setDraft({ ...draft, national_id: nationalId })}
        />
        <SelectBox
          label="Trạng thái"
          value={draft.status}
          emptyLabel="Tất cả"
          options={ADMISSION_SUPPORT_STATUSES}
          onChange={(status) => setDraft({ ...draft, status })}
        />
        <div className="flex items-end">
          <Button type="submit" variant="primary">
            Tìm kiếm
          </Button>
        </div>
      </form>
      <DataGrid
        label="Danh sách hỗ trợ tuyển sinh"
        columns={columns}
        rows={list.data?.items ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.child_name ?? row.requester_name}
        loading={list.isPending}
        emptyText="Chưa có yêu cầu hỗ trợ."
        selectable={canReply}
        toolbar={(selected) => (
          <>
            {canReply ? (
              <Button variant="primary" disabled={selected.length === 0} onClick={() => notify.mutate(selected)}>
                Gửi email
              </Button>
            ) : null}
            <Button
              onClick={() => exportSupportRequests(filter).catch((reason: unknown) => setError(messageOf(reason)))}
            >
              Xuất Excel
            </Button>
          </>
        )}
        rowActions={(row) =>
          canReply ? (
            <Button variant="text" onClick={() => setReplying({ row, reply: row.reply ?? '' })}>
              Cập nhật
            </Button>
          ) : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
      {replying ? (
        <ConfirmDialog
          open
          title={`Trả lời yêu cầu của ${replying.row.requester_name}`}
          confirmLabel="Ghi"
          busy={reply.isPending}
          onCancel={() => setReplying(undefined)}
          onConfirm={() => reply.mutate(replying)}
        >
          <span className="flex flex-col gap-3">
            <span>{replying.row.content}</span>
            <label className="flex flex-col gap-2 text-label font-medium text-text">
              Nội dung câu trả lời
              <textarea
                className={FORM_CONTROL_CLASS}
                rows={4}
                value={replying.reply}
                onChange={(event) => setReplying({ ...replying, reply: event.target.value })}
              />
            </label>
          </span>
        </ConfirmDialog>
      ) : null}
    </Page>
  );
}
