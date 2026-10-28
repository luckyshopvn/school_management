import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { PERMISSION_CODES } from '@school-management/shared';
import {
  Alert,
  Button,
  ConfirmDeleteDialog,
  DataGrid,
  FORM_CONTROL_CLASS,
  FormBlock,
  FormRow,
  resolveVisibleColumns,
  StatusBadge,
  Toast,
  type DataGridColumn,
} from '@school-management/ui';
import { listDepartments, listJobTitles } from '../catalogs/catalogs-api.js';
import { useUnitChoice } from '../catalogs/UnitSelect.js';
import { formatMoney } from '../fees/fees-api.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  CONTRACT_TYPE_LABELS,
  createStaff,
  exportStaff,
  searchStaff,
  STAFF_STATUS_LABELS,
  type StaffFilter,
  type StaffListItem,
} from './staff-api.js';
import {
  deleteStaff,
  exportMinistryErrors,
  exportMinistryFile,
  ID_VERIFICATION_LABELS,
  type DeleteResult,
} from './staff-so-api.js';

// MH-12 3.1.1. Hồ sơ cán bộ, giáo viên theo hệ thống của Sở (DT-15 phần 15d, YCTD-112; trước là Hồ sơ nhân sự, P07-01,
// P07-02, P07-04; BR-37, BR-38; YCTD-58): lưới dữ liệu chung phân trang ở máy chủ, tìm theo họ tên hoặc mã, mở rộng tìm
// kiếm theo các bộ lọc của mục 3.1.4, cột theo danh sách của Sở, sắp xếp A–Z theo tên; Thêm mới, Xuất Excel; Hồ sơ mở ngay
// dưới dòng. Ô mã định danh Bộ tô đỏ khi trống như danh sách học sinh. Cột hợp đồng, lương chỉ hiện cho người xem được
// hợp đồng (BR-46). DT-16 phần 16f thêm Thay đổi (mở hồ sơ dòng đã chọn), Xóa (chỉ hồ sơ chưa có dữ liệu liên quan), Xuất tệp
// theo mẫu Bộ kèm kiểm tra dữ liệu, Xuất file lỗi (bản chạy nội bộ của "Đồng bộ hồ sơ lên CSDL Bộ", không gửi đi), lọc xã
// ĐBKK, trạng thái xác thực số định danh
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const selectClass = 'mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
const formatDate = (value: string | null) => (value ? value.split('-').reverse().join('/') : '');

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="text-label font-medium text-text">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className={selectClass}>
        <option value="">Tất cả</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterText({
  label,
  value,
  onChange,
  numeric,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  numeric?: boolean;
}) {
  return (
    <label className="text-label font-medium text-text">
      {label}
      <input
        value={value}
        inputMode={numeric ? 'numeric' : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={selectClass}
      />
    </label>
  );
}

// Cột theo danh sách cán bộ, giáo viên của Sở (3.1.1: mã định danh Bộ, họ tên, ngày sinh, giới tính, trạng thái, dân tộc,
// điện thoại, vị trí việc làm, nhóm chức vụ, hình thức hợp đồng, trình độ chuyên môn) và mã nhân sự của trường; cột còn
// lại ẩn mặc định. Mã cột trùng mã cột của tệp Excel ở máy chủ
function staffColumns(contractVisible: boolean): Array<DataGridColumn<StaffListItem>> {
  return [
    {
      id: 'moet_staff_code',
      header: 'Mã định danh Bộ GD&ĐT',
      cell: (row) => (
        <span className={row.moet_staff_code ? '' : 'rounded bg-danger/10 px-2 text-danger'}>
          {row.moet_staff_code ?? 'Chưa có'}
        </span>
      ),
    },
    { id: 'code', header: 'Mã nhân sự', cell: (row) => row.code },
    { id: 'full_name', header: 'Họ tên', alwaysVisible: true, className: 'font-medium', cell: (row) => row.full_name },
    { id: 'dob', header: 'Ngày sinh', cell: (row) => formatDate(row.dob) },
    {
      id: 'gender',
      header: 'Giới tính',
      cell: (row) => (row.gender === 'male' ? 'Nam' : row.gender === 'female' ? 'Nữ' : ''),
    },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: (row) => (
        <StatusBadge tone={row.status === 'active' ? 'success' : 'neutral'} label={STAFF_STATUS_LABELS[row.status]} />
      ),
    },
    { id: 'ethnicity', header: 'Dân tộc', cell: (row) => row.ethnicity ?? '' },
    { id: 'phone', header: 'Điện thoại', cell: (row) => row.phone ?? '' },
    { id: 'job_position', header: 'Vị trí việc làm', cell: (row) => row.job_position ?? '' },
    { id: 'position_group', header: 'Nhóm chức vụ', cell: (row) => row.position_group ?? '' },
    { id: 'contract_form', header: 'Hình thức hợp đồng', cell: (row) => row.contract_form ?? '' },
    {
      id: 'professional_qualification',
      header: 'Trình độ chuyên môn',
      cell: (row) => row.professional_qualification ?? '',
    },
    { id: 'department', header: 'Phòng ban', hiddenByDefault: true, cell: (row) => row.department_name ?? '' },
    { id: 'job_title', header: 'Chức danh', hiddenByDefault: true, cell: (row) => row.job_title_name ?? '' },
    { id: 'party_member', header: 'Đảng viên', hiddenByDefault: true, cell: (row) => (row.party_member ? 'Có' : '') },
    { id: 'email', header: 'Email', hiddenByDefault: true, cell: (row) => row.email ?? '' },
    { id: 'start_date', header: 'Ngày vào làm', hiddenByDefault: true, cell: (row) => formatDate(row.start_date) },
    { id: 'id_number', header: 'Số định danh', hiddenByDefault: true, cell: (row) => row.id_number_masked ?? '' },
    {
      id: 'account',
      header: 'Tài khoản',
      hiddenByDefault: true,
      cell: (row) => (row.has_account ? 'Đã liên kết' : 'Chưa có'),
    },
    { id: 'unit', header: 'Đơn vị', hiddenByDefault: true, cell: (row) => row.unit_name },
    {
      id: 'special_difficulty_commune',
      header: 'Xã ĐBKK',
      hiddenByDefault: true,
      cell: (row) => (row.special_difficulty_commune ? 'Có' : ''),
    },
    {
      id: 'id_verification',
      header: 'Xác thực số định danh',
      hiddenByDefault: true,
      cell: (row) => ID_VERIFICATION_LABELS[row.id_verification_status],
    },
    {
      id: 'bank_account',
      header: 'Tài khoản ngân hàng',
      hiddenByDefault: true,
      cell: (row) => row.bank_account_number ?? '',
    },
    { id: 'tax_code', header: 'Mã số thuế', hiddenByDefault: true, cell: (row) => row.tax_code ?? '' },
    ...(contractVisible
      ? ([
          {
            id: 'contract_no',
            header: 'Số hợp đồng',
            hiddenByDefault: true,
            cell: (row) =>
              row.contract_no
                ? `${row.contract_no}${row.contract_type ? ` (${CONTRACT_TYPE_LABELS[row.contract_type]})` : ''}`
                : '',
          },
          {
            id: 'contract_end_date',
            header: 'Hợp đồng đến ngày',
            hiddenByDefault: true,
            cell: (row) => formatDate(row.contract_end_date),
          },
          {
            id: 'base_salary',
            header: 'Lương thỏa thuận',
            hiddenByDefault: true,
            cell: (row) => (row.base_salary === null ? '' : formatMoney(row.base_salary)),
          },
        ] satisfies Array<DataGridColumn<StaffListItem>>)
      : []),
  ];
}

// Biểu mẫu Thêm mới theo khối như hồ sơ: Thông tin chung của Sở, Thông tin riêng của trường; nút Ghi
function CreateStaffForm({
  units,
  defaultUnitId,
  onCreated,
  onCancel,
}: {
  units: Array<{ id: string; name: string }>;
  defaultUnitId: string | undefined;
  onCreated(staff: { id: string; full_name: string }): void;
  onCancel(): void;
}) {
  const [values, setValues] = useState({
    org_unit_id: defaultUnitId ?? units[0]?.id ?? '',
    code: '',
    full_name: '',
    dob: '',
    gender: '',
    id_number: '',
    phone: '',
    email: '',
    department_id: '',
    job_title_id: '',
    start_date: '',
  });
  const set = (key: keyof typeof values, value: string) =>
    setValues((current) => ({
      ...current,
      [key]: value,
      ...(key === 'org_unit_id' ? { department_id: '', job_title_id: '' } : {}),
    }));
  const departments = useQuery({
    queryKey: ['departments', values.org_unit_id],
    queryFn: () => listDepartments(values.org_unit_id),
    enabled: Boolean(values.org_unit_id),
  });
  const jobTitles = useQuery({
    queryKey: ['job-titles', values.org_unit_id],
    queryFn: () => listJobTitles(values.org_unit_id),
    enabled: Boolean(values.org_unit_id),
  });
  const save = useMutation({
    mutationFn: () =>
      createStaff({
        org_unit_id: values.org_unit_id,
        code: values.code,
        full_name: values.full_name,
        start_date: values.start_date,
        ...(values.dob ? { dob: values.dob } : {}),
        ...(values.gender ? { gender: values.gender as 'male' | 'female' } : {}),
        ...(values.phone ? { phone: values.phone } : {}),
        ...(values.email ? { email: values.email } : {}),
        ...(values.id_number ? { id_number: values.id_number } : {}),
        ...(values.department_id ? { department_id: values.department_id } : {}),
        ...(values.job_title_id ? { job_title_id: values.job_title_id } : {}),
      }),
    onSuccess: onCreated,
  });
  const errors =
    save.error instanceof ApiError
      ? Object.fromEntries(save.error.details.map((detail) => [detail.field, detail.message]))
      : {};
  const input = (key: keyof typeof values, type = 'text') => (
    <input
      type={type}
      value={values[key]}
      onChange={(event) => set(key, event.target.value)}
      className={FORM_CONTROL_CLASS}
    />
  );

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      aria-label="Thêm hồ sơ nhân sự"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <h2 className="text-section-title font-semibold text-text">Thêm mới cán bộ, giáo viên</h2>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title="Thông tin chung">
        <FormRow label="Họ tên" error={errors.full_name}>
          {input('full_name')}
        </FormRow>
        <FormRow label="Giới tính" error={errors.gender}>
          <select
            value={values.gender}
            onChange={(event) => set('gender', event.target.value)}
            className={FORM_CONTROL_CLASS}
          >
            <option value="">Chưa chọn</option>
            <option value="male">Nam</option>
            <option value="female">Nữ</option>
          </select>
        </FormRow>
        <FormRow label="Ngày sinh" error={errors.dob}>
          {input('dob', 'date')}
        </FormRow>
        <FormRow label="Số định danh cá nhân" error={errors.id_number}>
          {input('id_number')}
        </FormRow>
        <FormRow label="Email" error={errors.email}>
          {input('email')}
        </FormRow>
        <FormRow label="Điện thoại" error={errors.phone}>
          {input('phone')}
        </FormRow>
      </FormBlock>
      <FormBlock title="Thông tin riêng của trường">
        <FormRow label="Đơn vị" error={errors.org_unit_id}>
          <select
            value={values.org_unit_id}
            onChange={(event) => set('org_unit_id', event.target.value)}
            className={FORM_CONTROL_CLASS}
          >
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Mã nhân sự" error={errors.code}>
          {input('code')}
        </FormRow>
        <FormRow label="Phòng ban" error={errors.department_id}>
          <select
            value={values.department_id}
            onChange={(event) => set('department_id', event.target.value)}
            className={FORM_CONTROL_CLASS}
          >
            <option value="">Không chọn</option>
            {(departments.data ?? [])
              .filter((department) => department.status === 'active')
              .map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
          </select>
        </FormRow>
        <FormRow label="Chức danh" error={errors.job_title_id}>
          <select
            value={values.job_title_id}
            onChange={(event) => set('job_title_id', event.target.value)}
            className={FORM_CONTROL_CLASS}
          >
            <option value="">Không chọn</option>
            {(jobTitles.data ?? [])
              .filter((jobTitle) => jobTitle.status === 'active')
              .map((jobTitle) => (
                <option key={jobTitle.id} value={jobTitle.id}>
                  {jobTitle.name}
                </option>
              ))}
          </select>
        </FormRow>
        <FormRow label="Ngày vào làm" error={errors.start_date}>
          {input('start_date', 'date')}
        </FormRow>
      </FormBlock>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Ghi
        </Button>
        <Button type="button" onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </form>
  );
}

export function StaffPage() {
  const canManage = useHasPermission(PERMISSION_CODES.staffManage);
  const canExport = useHasPermission(PERMISSION_CODES.dataExport);
  const unitChoice = useUnitChoice();
  const queryClient = useQueryClient();
  const grid = useGridSettings('staff');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StaffFilter>({});
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  // Hồ sơ một người mở ở trang riêng chia thẻ (YCTD-297), lưới dùng toàn chiều rộng
  const openProfile = (staffId: string) => void navigate({ to: '/staff/$staffId', params: { staffId } });
  const [creating, setCreating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string>();
  const [exportError, setExportError] = useState<string>();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState<StaffListItem[]>([]);
  const [deleteResult, setDeleteResult] = useState<DeleteResult>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const departments = useQuery({
    queryKey: ['departments', filter.org_unit_id],
    queryFn: () => listDepartments(filter.org_unit_id ?? ''),
    enabled: Boolean(filter.org_unit_id),
  });
  const activeFilter: StaffFilter = { ...filter, q: search || undefined };
  const pageSize = grid.settings.pageSize;
  const staff = useQuery({
    queryKey: ['staff', 'search', activeFilter, page, pageSize],
    queryFn: () => searchStaff({ ...activeFilter, page, pageSize }),
    enabled: grid.ready,
  });
  const columns = staffColumns(staff.data?.contract_fields_visible === true);

  const change = (key: keyof StaffFilter, value: string) => {
    setFilter((current) => ({
      ...current,
      [key]: value || undefined,
      ...(key === 'org_unit_id' ? { department_id: undefined } : {}),
    }));
    setPage(1);
  };
  const runExport = async () => {
    setExportError(undefined);
    setExporting(true);
    try {
      const notice = await exportStaff(
        activeFilter,
        resolveVisibleColumns(columns, grid.settings.columns).map((column) => column.id),
      );
      if (notice) {
        setToastMessage(notice);
      }
    } catch (error) {
      setExportError(messageOf(error));
    } finally {
      setExporting(false);
    }
  };

  // Tệp theo mẫu Bộ, tệp lỗi theo bộ lọc đang chọn
  const runFile = async (build: (filter: StaffFilter) => Promise<void>) => {
    setExportError(undefined);
    setExporting(true);
    try {
      await build(activeFilter);
    } catch (error) {
      setExportError(messageOf(error));
    } finally {
      setExporting(false);
    }
  };
  const remove = useMutation({
    mutationFn: () => deleteStaff(deleting.map((row) => row.id)),
    onSuccess: async (result) => {
      setDeleting([]);
      setDeleteResult(result);
      if (result.deleted_count > 0) {
        setToastMessage(`Đã xóa ${result.deleted_count} hồ sơ`);
      }
      await queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });
  const refused = (deleteResult?.results ?? []).filter((result) => !result.deleted);

  const advancedSearch = (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-4">
      <FilterSelect
        label="Đơn vị"
        value={filter.org_unit_id ?? ''}
        onChange={(value) => change('org_unit_id', value)}
        options={unitChoice.units.map((unit) => ({ value: unit.id, label: unit.name }))}
      />
      {filter.org_unit_id ? (
        <FilterSelect
          label="Phòng ban"
          value={filter.department_id ?? ''}
          onChange={(value) => change('department_id', value)}
          options={(departments.data ?? []).map((department) => ({ value: department.id, label: department.name }))}
        />
      ) : null}
      <FilterSelect
        label="Trạng thái"
        value={filter.status ?? ''}
        onChange={(value) => change('status', value)}
        options={(Object.keys(STAFF_STATUS_LABELS) as Array<keyof typeof STAFF_STATUS_LABELS>).map((key) => ({
          value: key,
          label: STAFF_STATUS_LABELS[key],
        }))}
      />
      <FilterSelect
        label="Giới tính"
        value={filter.gender ?? ''}
        onChange={(value) => change('gender', value)}
        options={[
          { value: 'male', label: 'Nam' },
          { value: 'female', label: 'Nữ' },
        ]}
      />
      <FilterText
        label="Vị trí việc làm"
        value={filter.job_position ?? ''}
        onChange={(value) => change('job_position', value)}
      />
      <FilterSelect
        label="Đảng viên"
        value={filter.party_member ?? ''}
        onChange={(value) => change('party_member', value)}
        options={[
          { value: 'true', label: 'Có' },
          { value: 'false', label: 'Không' },
        ]}
      />
      <FilterText
        label="Tuổi từ"
        numeric
        value={filter.age_from ?? ''}
        onChange={(value) => change('age_from', value)}
      />
      <FilterText label="Tuổi đến" numeric value={filter.age_to ?? ''} onChange={(value) => change('age_to', value)} />
      <FilterText
        label="Mã định danh Bộ GD&ĐT"
        value={filter.moet_staff_code ?? ''}
        onChange={(value) => change('moet_staff_code', value)}
      />
      <FilterText
        label="Số định danh cá nhân"
        numeric
        value={filter.id_number ?? ''}
        onChange={(value) => change('id_number', value)}
      />
      <FilterSelect
        label="Xã ĐBKK"
        value={filter.special_difficulty_commune ?? ''}
        onChange={(value) => change('special_difficulty_commune', value)}
        options={[
          { value: 'true', label: 'Có' },
          { value: 'false', label: 'Không' },
        ]}
      />
      <FilterSelect
        label="Xác thực số định danh"
        value={filter.id_verification ?? ''}
        onChange={(value) => change('id_verification', value)}
        options={(Object.keys(ID_VERIFICATION_LABELS) as Array<keyof typeof ID_VERIFICATION_LABELS>).map((key) => ({
          value: key,
          label: ID_VERIFICATION_LABELS[key],
        }))}
      />
    </div>
  );

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/staff')}</h1>
        {creating ? (
          <section className="rounded-xl border border-border bg-card p-4" aria-label="Thêm mới cán bộ, giáo viên">
            <CreateStaffForm
              units={unitChoice.units}
              defaultUnitId={filter.org_unit_id ?? unitChoice.selectedId}
              onCancel={() => setCreating(false)}
              onCreated={(created) => {
                setCreating(false);
                void queryClient.invalidateQueries({ queryKey: ['staff'] });
                openProfile(created.id);
              }}
            />
          </section>
        ) : null}
        {staff.isError ? <Alert tone="danger">{messageOf(staff.error)}</Alert> : null}
        {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
        {exportError ? <Alert tone="danger">{exportError}</Alert> : null}
        {remove.error ? <Alert tone="danger">{messageOf(remove.error)}</Alert> : null}
        {refused.length > 0 ? (
          <Alert tone="warning">
            <span>Không xóa được {refused.length} hồ sơ:</span>
            <ul className="ml-4 list-disc" aria-label="Hồ sơ không xóa được">
              {refused.map((result) => (
                <li key={result.id}>
                  {result.full_name}: {result.reason}
                </li>
              ))}
            </ul>
          </Alert>
        ) : null}
        <ConfirmDeleteDialog
          open={deleting.length > 0}
          subject={
            deleting.length === 1
              ? `hồ sơ ${deleting[0]?.full_name ?? ''}`
              : `${deleting.length} hồ sơ cán bộ, giáo viên`
          }
          busy={remove.isPending}
          onConfirm={() => remove.mutate()}
          onCancel={() => setDeleting([])}
        >
          <p className="text-content text-text-secondary">
            Chỉ xóa được hồ sơ nhập nhầm chưa có tài khoản, hợp đồng, chấm công, lương hay dữ liệu liên quan khác. Hồ sơ
            đã có dữ liệu liên quan được giữ lại; cho nghỉ việc bằng chấm dứt hợp đồng.
          </p>
        </ConfirmDeleteDialog>
        <DataGrid
          label="Danh sách nhân sự"
          columns={columns}
          rows={staff.data?.items ?? []}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.full_name}
          getRowAriaLabel={(row) => `Nhân sự ${row.full_name}`}
          loading={!staff.data && !staff.isError}
          emptyText="Chưa có hồ sơ nhân sự."
          search={{
            label: 'Tìm theo tên hoặc mã',
            value: search,
            onChange: (value) => {
              setSearch(value);
              setPage(1);
            },
          }}
          advancedSearch={advancedSearch}
          toolbar={(selectedRows) => (
            <>
              {canManage ? (
                <Button variant="primary" onClick={() => setCreating(true)}>
                  Thêm mới
                </Button>
              ) : null}
              <Button
                disabled={selectedRows.length !== 1}
                title={selectedRows.length !== 1 ? 'Chọn một hồ sơ để thay đổi' : undefined}
                onClick={() => {
                  const selected = selectedRows[0];
                  if (selected) {
                    openProfile(selected.id);
                  }
                }}
              >
                Thay đổi
              </Button>
              {canManage ? (
                <Button
                  variant="danger"
                  disabled={selectedRows.length === 0}
                  onClick={() => {
                    setDeleteResult(undefined);
                    setDeleting(selectedRows);
                  }}
                >
                  Xóa
                </Button>
              ) : null}
              {canExport ? (
                <>
                  <Button disabled={exporting} onClick={() => void runExport()}>
                    Xuất Excel
                  </Button>
                  <Button
                    disabled={exporting}
                    title="Tệp 75 cột theo mẫu CSDL ngành kèm trang kiểm tra dữ liệu; trường tự nộp tệp, hệ thống không gửi đi"
                    onClick={() => void runFile(exportMinistryFile)}
                  >
                    Xuất tệp theo mẫu Bộ
                  </Button>
                  <Button disabled={exporting} onClick={() => void runFile(exportMinistryErrors)}>
                    Xuất file lỗi
                  </Button>
                </>
              ) : null}
            </>
          )}
          selectable
          rowActions={(row) => (
            <Link
              to="/staff/$staffId"
              params={{ staffId: row.id }}
              className="flex min-h-11 items-center px-2 text-content font-medium text-link hover:underline"
            >
              Hồ sơ
            </Link>
          )}
          onRowClick={(row) => openProfile(row.id)}
          settings={grid.settings}
          onSettingsChange={grid.update}
          exportPdf={canExport ? (columnIds) => exportStaff(activeFilter, columnIds, 'pdf') : undefined}
          serverPagination={{ page, total: staff.data?.total ?? 0, onPageChange: setPage }}
        />
      </div>
    </AppShell>
  );
}
