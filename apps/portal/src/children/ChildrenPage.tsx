import { useCallback, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { PERMISSION_CODES } from '@school-management/shared';
import {
  Alert,
  Button,
  ConfirmDeleteDialog,
  ConfirmDialog,
  DataGrid,
  resolveVisibleColumns,
  StatusBadge,
  Toast,
  type DataGridColumn,
} from '@school-management/ui';
import { listGradeLevels } from '../catalogs/catalogs-api.js';
import { useUnitChoice } from '../catalogs/UnitSelect.js';
import { listChildGroups } from '../child-groups/child-groups-api.js';
import { listClasses } from '../classes/classes-api.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { ChildDetailPanel } from './ChildDetailPanel.js';
import {
  bulkUpdateChildren,
  CHILD_STATUS_LABELS,
  exportChildren,
  listChildren,
  type ChildListItem,
  type ChildStatus,
  type StudentFilter,
} from './children-api.js';
import { CreateChildForm } from './CreateChildForm.js';
import { assignMoetCodes, deleteChild, downloadErrorFile, downloadMoetFile } from '../students/students-api.js';

// MH-02 4.1.1. Quản lý hồ sơ học sinh theo hệ thống của Sở (DT-15 phần 15c, YCTD-108; trước là Hồ sơ trẻ, P02-01, P02-02,
// QT-01): lưới dữ liệu chung có tìm theo họ tên, mở rộng tìm kiếm theo các bộ lọc của mục 4.1.4, cột theo danh sách của
// Sở, sắp xếp A–Z theo tên; Thêm mới, Cập nhật hàng loạt học 2 buổi/ngày và bán trú (4.1.12), Xuất Excel; Hồ sơ mở ngay
// dưới dòng. Ô mã định danh Bộ tô đỏ khi trống (AC-201). Từ DT-16 phần 16g đủ nút của Sở: Thay đổi (mở hồ sơ để sửa), Xóa
// (hồ sơ nháp), Cấp mã định danh Bộ (nhập tay mã do Bộ cấp, xuất tệp theo mẫu Bộ cho học sinh chưa có mã), Xuất file lỗi
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const selectClass = 'mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
const formatDate = (value: string) => value.split('-').reverse().join('/');
const yes = (value: boolean | null) => (value ? 'Có' : '');

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

const YES_NO = [
  { value: 'true', label: 'Có' },
  { value: 'false', label: 'Không' },
];

// Chữ viết tắt trên ảnh đại diện: chữ đầu của họ và của tên
function initialsOf(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

// Thẻ trạng thái phía trên lưới theo mẫu thiết kế: cùng bộ lọc "Trạng thái" ở Mở rộng tìm kiếm; số lượng chỉ hiện ở thẻ đang
// chọn vì máy chủ chỉ trả tổng số dòng của bộ lọc hiện tại
const STATUS_TABS: Array<{ value: ChildStatus | ''; label: string }> = [
  { value: '', label: 'Tất cả' },
  ...(Object.keys(CHILD_STATUS_LABELS) as ChildStatus[]).map((key) => ({
    value: key,
    label: CHILD_STATUS_LABELS[key],
  })),
];
const formatCount = (value: number) => value.toLocaleString('vi-VN');

// Cột theo danh sách học sinh của Sở (4.1.1: mã định danh Bộ, họ tên, ngày sinh, giới tính, dân tộc, trạng thái, số điện
// thoại liên hệ; 4.1.4: khối, lớp); cột còn lại ẩn mặc định. Mã cột trùng mã cột của tệp Excel ở máy chủ
function studentColumns(): Array<DataGridColumn<ChildListItem>> {
  return [
    {
      id: 'moet_student_code',
      header: 'Mã định danh Bộ GD&ĐT',
      cell: (row) => (
        <span className={row.moet_student_code ? '' : 'rounded bg-danger/10 px-2 text-danger'}>
          {row.moet_student_code ?? 'Chưa có'}
        </span>
      ),
    },
    {
      id: 'full_name',
      header: 'Họ tên',
      alwaysVisible: true,
      cell: (row) => (
        <span className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-selected text-xs font-bold text-brand-strong"
          >
            {initialsOf(row.full_name)}
          </span>
          <span className="font-semibold text-text">{row.full_name}</span>
        </span>
      ),
    },
    { id: 'dob', header: 'Ngày sinh', cell: (row) => formatDate(row.dob) },
    { id: 'gender', header: 'Giới tính', cell: (row) => (row.gender === 'male' ? 'Nam' : 'Nữ') },
    { id: 'ethnicity', header: 'Dân tộc', cell: (row) => row.ethnicity ?? '' },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: (row) => (
        <StatusBadge
          tone={row.status === 'active' ? 'success' : row.status === 'pending' ? 'warning' : 'neutral'}
          label={CHILD_STATUS_LABELS[row.status]}
        />
      ),
    },
    { id: 'contact_phone', header: 'Số điện thoại liên hệ', cell: (row) => row.contact_phone ?? '' },
    { id: 'grade', header: 'Khối', cell: (row) => row.grade_name ?? row.grade_level ?? '' },
    { id: 'class', header: 'Lớp', cell: (row) => row.class_name ?? '' },
    { id: 'sms_phone', header: 'Điện thoại nhận tin', hiddenByDefault: true, cell: (row) => row.sms_phone ?? '' },
    {
      id: 'two_sessions_per_day',
      header: 'Học 2 buổi/ngày',
      hiddenByDefault: true,
      cell: (row) => yes(row.two_sessions_per_day),
    },
    { id: 'boarding', header: 'Bán trú', hiddenByDefault: true, cell: (row) => yes(row.boarding) },
    { id: 'policy_target', header: 'Diện chính sách', hiddenByDefault: true, cell: (row) => row.policy_target ?? '' },
    { id: 'disability_type', header: 'Khuyết tật', hiddenByDefault: true, cell: (row) => row.disability_type ?? '' },
    { id: 'can_swim', header: 'Biết bơi', hiddenByDefault: true, cell: (row) => yes(row.can_swim) },
    { id: 'national_id', header: 'Số định danh', hiddenByDefault: true, cell: (row) => row.national_id_masked },
    { id: 'org_unit', header: 'Đơn vị', hiddenByDefault: true, cell: (row) => row.org_unit_name },
  ];
}

// Hộp cập nhật hàng loạt (mục 4.1.12 của Sở): mỗi thông tin chọn giữ nguyên, có hoặc không
function BulkUpdateDialog({
  rows,
  onDone,
  onCancel,
}: {
  rows: ChildListItem[];
  onDone(message: string): void;
  onCancel(): void;
}) {
  const [twoSessions, setTwoSessions] = useState('');
  const [boarding, setBoarding] = useState('');
  const save = useMutation({
    mutationFn: () =>
      bulkUpdateChildren(
        rows.map((row) => row.id),
        {
          ...(twoSessions ? { two_sessions_per_day: twoSessions === 'true' } : {}),
          ...(boarding ? { boarding: boarding === 'true' } : {}),
        },
      ),
    onSuccess: (result) => onDone(`Đã cập nhật ${result.updated} học sinh`),
  });
  const choice = (label: string, value: string, onChange: (value: string) => void): ReactNode => (
    <label className="text-label font-medium text-text">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className={selectClass}>
        <option value="">Giữ nguyên</option>
        <option value="true">Có</option>
        <option value="false">Không</option>
      </select>
    </label>
  );
  return (
    <ConfirmDialog
      open
      title="Cập nhật hàng loạt"
      confirmLabel="Ghi"
      busy={save.isPending || (!twoSessions && !boarding)}
      onCancel={onCancel}
      onConfirm={() => save.mutate()}
    >
      <div className="flex flex-col gap-3">
        <p>Cập nhật cho {rows.length} học sinh đã chọn.</p>
        {choice('Học 2 buổi/ngày', twoSessions, setTwoSessions)}
        {choice('Học sinh lớp bán trú', boarding, setBoarding)}
        {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      </div>
    </ConfirmDialog>
  );
}

// "Cấp mã định danh Bộ" chạy nội bộ: chưa có giao diện lập trình của Bộ nên nhà trường xuất tệp theo mẫu của Bộ để nộp, rồi
// ghi mã Bộ cấp bằng tay ở đây hoặc nhập từ Excel ở 4.1.2 (Mã định danh ngành)
function MoetCodeDialog({
  rows,
  filter,
  canExport,
  onDone,
  onCancel,
}: {
  rows: ChildListItem[];
  filter: StudentFilter;
  canExport: boolean;
  onDone(message: string): void;
  onCancel(): void;
}) {
  const [codes, setCodes] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((row) => [row.id, row.moet_student_code ?? ''])),
  );
  const [fileError, setFileError] = useState<string>();
  const items = rows
    .map((row) => ({ child_id: row.id, moet_student_code: (codes[row.id] ?? '').trim() }))
    .filter((item) => item.moet_student_code !== '');
  const save = useMutation({
    mutationFn: () => assignMoetCodes(items),
    onSuccess: (result) => onDone(`Đã ghi mã định danh Bộ GD&ĐT cho ${result.assigned} học sinh`),
  });
  return (
    <ConfirmDialog
      open
      title="Cấp mã định danh Bộ"
      confirmLabel="Ghi mã đã cấp"
      busy={save.isPending || items.length === 0}
      onCancel={onCancel}
      onConfirm={() => save.mutate()}
    >
      <div className="flex flex-col gap-3">
        <Alert tone="info">
          Hệ thống chưa kết nối CSDL của Bộ. Xuất tệp theo mẫu của Bộ cho học sinh chưa có mã để nộp, rồi ghi mã Bộ cấp
          vào ô dưới đây hoặc nhập từ Excel ở mục 4.1.2 (Mã định danh ngành).
        </Alert>
        {canExport ? (
          <div>
            <Button
              onClick={() => {
                setFileError(undefined);
                downloadMoetFile({ ...filter, missing_moet_code: true }).catch((error: unknown) =>
                  setFileError(messageOf(error)),
                );
              }}
            >
              Xuất tệp theo mẫu Bộ (học sinh chưa có mã)
            </Button>
          </div>
        ) : null}
        {fileError ? <Alert tone="danger">{fileError}</Alert> : null}
        {rows.length > 0 ? (
          <table className="w-full text-content" aria-label="Mã định danh Bộ của học sinh đã chọn">
            <thead className="text-left text-label font-medium text-text-secondary">
              <tr>
                <th className="px-3 py-1">Họ tên</th>
                <th className="px-3 py-1">Mã định danh Bộ GD&ĐT</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-3 py-1">{row.full_name}</td>
                  <td className="px-3 py-1">
                    <input
                      aria-label={`Mã định danh Bộ của ${row.full_name}`}
                      value={codes[row.id] ?? ''}
                      maxLength={50}
                      onChange={(event) => setCodes((current) => ({ ...current, [row.id]: event.target.value }))}
                      className={selectClass}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-label text-text-secondary">Chọn học sinh trên lưới để ghi mã Bộ đã cấp.</p>
        )}
        {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      </div>
    </ConfirmDialog>
  );
}

export function ChildrenPage() {
  const canManage = useHasPermission(PERMISSION_CODES.childManage);
  const canApprove = useHasPermission(PERMISSION_CODES.childApprove);
  const canExport = useHasPermission(PERMISSION_CODES.dataExport);
  const canImport = useHasPermission(PERMISSION_CODES.importChildren);
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const grid = useGridSettings('children');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StudentFilter>({});
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [bulkRows, setBulkRows] = useState<ChildListItem[]>();
  const [deleting, setDeleting] = useState<ChildListItem>();
  const [codeRows, setCodeRows] = useState<ChildListItem[]>();
  const [toastMessage, setToastMessage] = useState<string>();
  const [exportError, setExportError] = useState<string>();
  const [exporting, setExporting] = useState(false);
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const groups = useQuery({ queryKey: ['child-groups', 'list', ''], queryFn: () => listChildGroups('') });
  const gradeLevels = useQuery({ queryKey: ['grade-levels'], queryFn: listGradeLevels });
  const classes = useQuery({
    queryKey: ['classes', filter.org_unit_id],
    queryFn: () => listClasses(filter.org_unit_id ?? ''),
    enabled: Boolean(filter.org_unit_id),
  });
  const activeFilter: StudentFilter = { ...filter, q: search || undefined };
  const pageSize = grid.settings.pageSize;
  const children = useQuery({
    queryKey: ['children', activeFilter, page, pageSize],
    queryFn: () => listChildren({ ...activeFilter, page, pageSize }),
    enabled: grid.ready,
  });
  const healthVisible = children.data?.health_fields_visible === true;
  const columns = studentColumns();
  // Dòng phụ dưới tiêu đề: tổng số hồ sơ theo bộ lọc đang chọn (máy chủ trả)
  const otherFilters = search !== '' || Object.entries(filter).some(([key, value]) => key !== 'status' && value);
  const subtitle = children.data
    ? [
        `${formatCount(children.data.total)} học sinh`,
        filter.status ? CHILD_STATUS_LABELS[filter.status as ChildStatus].toLowerCase() : '',
        otherFilters ? 'theo bộ lọc đang chọn' : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Đang tải…';

  const change = (key: keyof StudentFilter, value: string | boolean) => {
    setFilter((current) => ({
      ...current,
      [key]: value || undefined,
      ...(key === 'org_unit_id' ? { class_id: undefined } : {}),
    }));
    setPage(1);
  };
  const runExport = async () => {
    setExportError(undefined);
    setExporting(true);
    try {
      const notice = await exportChildren(
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

  const remove = useMutation({
    mutationFn: (row: ChildListItem) => deleteChild(row.id),
    onSuccess: async (_result, row) => {
      setDeleting(undefined);
      setOpenId(undefined);
      setToastMessage(`Đã xóa hồ sơ của ${row.full_name}`);
      await queryClient.invalidateQueries({ queryKey: ['children'] });
    },
  });
  const runErrorFile = async () => {
    setExportError(undefined);
    try {
      await downloadErrorFile(activeFilter);
    } catch (error) {
      setExportError(messageOf(error));
    }
  };

  const advancedSearch = (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-4">
      <FilterSelect
        label="Đơn vị"
        value={filter.org_unit_id ?? ''}
        onChange={(value) => change('org_unit_id', value)}
        options={unitChoice.units.map((unit) => ({ value: unit.id, label: unit.name }))}
      />
      <FilterSelect
        label="Khối"
        value={filter.grade_level ?? ''}
        onChange={(value) => change('grade_level', value)}
        options={(gradeLevels.data ?? []).map((grade) => ({ value: grade.code, label: grade.name }))}
      />
      {filter.org_unit_id ? (
        <FilterSelect
          label="Lớp"
          value={filter.class_id ?? ''}
          onChange={(value) => change('class_id', value)}
          options={(classes.data ?? []).map((item) => ({ value: item.id, label: item.name }))}
        />
      ) : null}
      <FilterSelect
        label="Trạng thái"
        value={filter.status ?? ''}
        onChange={(value) => change('status', value)}
        options={(Object.keys(CHILD_STATUS_LABELS) as ChildStatus[]).map((key) => ({
          value: key,
          label: CHILD_STATUS_LABELS[key],
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
      {healthVisible ? (
        <>
          <label className="text-label font-medium text-text">
            Dân tộc
            <input
              value={filter.ethnicity ?? ''}
              onChange={(event) => change('ethnicity', event.target.value)}
              className={selectClass}
            />
          </label>
          <FilterSelect
            label="Diện chính sách"
            value={filter.policy ?? ''}
            onChange={(value) => change('policy', value)}
            options={YES_NO}
          />
          <FilterSelect
            label="Khuyết tật"
            value={filter.disability ?? ''}
            onChange={(value) => change('disability', value)}
            options={YES_NO}
          />
        </>
      ) : null}
      <FilterSelect
        label="Học 2 buổi/ngày"
        value={filter.two_sessions_per_day ?? ''}
        onChange={(value) => change('two_sessions_per_day', value)}
        options={YES_NO}
      />
      <FilterSelect
        label="Bán trú"
        value={filter.boarding ?? ''}
        onChange={(value) => change('boarding', value)}
        options={YES_NO}
      />
      <FilterSelect
        label="Biết bơi"
        value={filter.can_swim ?? ''}
        onChange={(value) => change('can_swim', value)}
        options={YES_NO}
      />
      {(groups.data ?? []).length > 0 ? (
        <FilterSelect
          label="Nhóm học sinh"
          value={filter.group_id ?? ''}
          onChange={(value) => change('group_id', value)}
          options={(groups.data ?? [])
            .filter((group) => !filter.org_unit_id || group.org_unit_id === filter.org_unit_id)
            .map((group) => ({ value: group.id, label: group.name }))}
        />
      ) : null}
      <label className="text-label font-medium text-text">
        Mã định danh Bộ GD&ĐT
        <input
          value={filter.moet_student_code ?? ''}
          onChange={(event) => change('moet_student_code', event.target.value)}
          className={selectClass}
        />
      </label>
      <label className="text-label font-medium text-text">
        Số định danh cá nhân
        <input
          inputMode="numeric"
          maxLength={12}
          value={filter.national_id ?? ''}
          onChange={(event) => change('national_id', event.target.value)}
          className={selectClass}
        />
      </label>
      <label className="flex items-center gap-2 self-end pb-2 text-label">
        <input
          type="checkbox"
          checked={filter.missing_moet_code === true}
          onChange={(event) => change('missing_moet_code', event.target.checked)}
        />
        Chưa có mã định danh Bộ GD&ĐT
      </label>
      <label className="flex items-center gap-2 self-end pb-2 text-label">
        <input
          type="checkbox"
          checked={filter.missing_birth_certificate === true}
          onChange={(event) => change('missing_birth_certificate', event.target.checked)}
        />
        Thiếu giấy khai sinh
      </label>
    </div>
  );

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-page-title font-bold text-text">{menuPageTitle('/children')}</h1>
            <p className="mt-1 text-label text-text-secondary">{subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canImport ? (
              <Link
                to="/student-imports"
                className="inline-flex items-center rounded-lg border border-border-strong bg-card px-4 py-2 text-label font-medium text-text hover:bg-selected max-xl:min-h-11"
              >
                Nhập từ Excel
              </Link>
            ) : null}
            {canManage ? (
              <Button
                variant="primary"
                onClick={() => {
                  setCreating(true);
                  setOpenId(undefined);
                }}
              >
                Thêm mới
              </Button>
            ) : null}
          </div>
        </div>
        {creating ? (
          <section className="rounded-xl border border-border bg-card p-4" aria-label="Thêm mới học sinh">
            <CreateChildForm
              units={unitChoice.units}
              defaultUnitId={unitChoice.selectedId}
              onCancel={() => setCreating(false)}
              onCreated={(child) => {
                setCreating(false);
                setOpenId(child.id);
                setToastMessage(`Đã tạo hồ sơ nháp của ${child.full_name}`);
                void queryClient.invalidateQueries({ queryKey: ['children'] });
              }}
            />
          </section>
        ) : null}
        {children.isError ? <Alert tone="danger">{messageOf(children.error)}</Alert> : null}
        {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
        {exportError ? <Alert tone="danger">{exportError}</Alert> : null}
        {/* Thẻ trạng thái và lưới chung một khung trắng: bỏ viền, nền riêng của lưới */}
        <div className="flex min-w-0 flex-col rounded-xl border border-border bg-card [&>section]:rounded-none [&>section]:border-0 [&>section]:bg-transparent">
          <div
            role="tablist"
            aria-label="Lọc theo trạng thái hồ sơ"
            className="flex flex-wrap gap-1 border-b border-border px-3 pt-2"
          >
            {STATUS_TABS.map((item) => {
              const active = (filter.status ?? '') === item.value;
              return (
                <button
                  key={item.value || 'all'}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => change('status', item.value)}
                  className={`-mb-px min-h-11 border-b-2 px-3.5 text-label ${
                    active
                      ? 'border-brand font-semibold text-brand-strong'
                      : 'border-transparent font-medium text-text-secondary hover:text-text'
                  }`}
                >
                  {item.label}
                  {active && children.data ? (
                    <span className="ml-1.5 font-medium text-text-secondary">{formatCount(children.data.total)}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <DataGrid
            label="Danh sách học sinh"
            columns={columns}
            rows={children.data?.items ?? []}
            getRowId={(row) => row.id}
            getRowLabel={(row) => row.full_name}
            getRowAriaLabel={(row) => `Học sinh ${row.full_name}`}
            loading={!children.data && !children.isError}
            emptyText="Không có hồ sơ nào."
            search={{
              label: 'Tìm theo họ tên',
              value: search,
              onChange: (value) => {
                setSearch(value);
                setPage(1);
              },
            }}
            advancedSearch={advancedSearch}
            toolbar={(selected) => (
              <>
                {canManage || canApprove ? (
                  <Button
                    disabled={selected.length !== 1}
                    onClick={() => {
                      setOpenId(selected[0]?.id);
                      setCreating(false);
                    }}
                  >
                    Thay đổi
                  </Button>
                ) : null}
                {canManage ? (
                  <Button
                    disabled={selected.length !== 1 || selected[0]?.status !== 'draft'}
                    onClick={() => setDeleting(selected[0])}
                  >
                    Xóa
                  </Button>
                ) : null}
                {canManage || canApprove ? (
                  <Button disabled={selected.length === 0} onClick={() => setBulkRows(selected)}>
                    Cập nhật hàng loạt
                  </Button>
                ) : null}
                {canManage ? <Button onClick={() => setCodeRows(selected)}>Cấp mã định danh Bộ</Button> : null}
                {canExport ? (
                  <Button disabled={exporting} onClick={() => void runExport()}>
                    Xuất Excel
                  </Button>
                ) : null}
                {canExport ? <Button onClick={() => void runErrorFile()}>Xuất file lỗi</Button> : null}
              </>
            )}
            selectable
            rowActions={(row) => (
              <Button variant="text" onClick={() => setOpenId(openId === row.id ? undefined : row.id)}>
                {openId === row.id ? 'Ẩn' : 'Hồ sơ'}
              </Button>
            )}
            onRowClick={(row) => {
              setOpenId(row.id);
              setCreating(false);
            }}
            activeRowId={openId}
            renderRowDetail={(row) =>
              openId === row.id ? <ChildDetailPanel key={row.id} childId={row.id} onChanged={setToastMessage} /> : null
            }
            settings={grid.settings}
            onSettingsChange={grid.update}
            serverPagination={{ page, total: children.data?.total ?? 0, onPageChange: setPage }}
            exportPdf={canExport ? (columnIds) => exportChildren(activeFilter, columnIds, 'pdf') : undefined}
          />
        </div>
        {openId && !(children.data?.items ?? []).some((row) => row.id === openId) ? (
          <section className="rounded-xl border border-border bg-card p-4">
            <ChildDetailPanel key={openId} childId={openId} onChanged={setToastMessage} />
          </section>
        ) : null}
      </div>
      <ConfirmDeleteDialog
        open={Boolean(deleting)}
        subject={`hồ sơ nháp của ${deleting?.full_name ?? ''}`}
        busy={remove.isPending}
        onCancel={() => setDeleting(undefined)}
        onConfirm={() => {
          if (deleting) {
            remove.mutate(deleting);
          }
        }}
      >
        <p>Chỉ xóa được hồ sơ nháp; hồ sơ được giữ lại trong nhật ký, không hiện ở các danh sách.</p>
        {remove.error ? <Alert tone="danger">{messageOf(remove.error)}</Alert> : null}
      </ConfirmDeleteDialog>
      {codeRows ? (
        <MoetCodeDialog
          rows={codeRows}
          filter={activeFilter}
          canExport={canExport}
          onCancel={() => setCodeRows(undefined)}
          onDone={(message) => {
            setCodeRows(undefined);
            setToastMessage(message);
            void queryClient.invalidateQueries({ queryKey: ['children'] });
          }}
        />
      ) : null}
      {bulkRows ? (
        <BulkUpdateDialog
          rows={bulkRows}
          onCancel={() => setBulkRows(undefined)}
          onDone={(message) => {
            setBulkRows(undefined);
            setToastMessage(message);
            void queryClient.invalidateQueries({ queryKey: ['children'] });
            void queryClient.invalidateQueries({ queryKey: ['child'] });
          }}
        />
      ) : null}
    </AppShell>
  );
}
