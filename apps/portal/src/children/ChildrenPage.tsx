import { useCallback, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import {
  Alert,
  Button,
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

// MH-02 4.1.1. Quản lý hồ sơ học sinh theo hệ thống của Sở (DT-15 phần 15c, YCTD-108; trước là Hồ sơ trẻ, P02-01, P02-02,
// QT-01): lưới dữ liệu chung có tìm theo họ tên, mở rộng tìm kiếm theo các bộ lọc của mục 4.1.4, cột theo danh sách của
// Sở, sắp xếp A–Z theo tên; Thêm mới, Cập nhật hàng loạt học 2 buổi/ngày và bán trú (4.1.12), Xuất Excel; Hồ sơ mở ngay
// dưới dòng. Ô mã định danh Bộ tô đỏ khi trống (AC-201)
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
    { id: 'full_name', header: 'Họ tên', alwaysVisible: true, className: 'font-medium', cell: (row) => row.full_name },
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

export function ChildrenPage() {
  const canManage = useHasPermission(PERMISSION_CODES.childManage);
  const canApprove = useHasPermission(PERMISSION_CODES.childApprove);
  const canExport = useHasPermission(PERMISSION_CODES.dataExport);
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const grid = useGridSettings('children');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StudentFilter>({});
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [bulkRows, setBulkRows] = useState<ChildListItem[]>();
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
      await exportChildren(
        activeFilter,
        resolveVisibleColumns(columns, grid.settings.columns).map((column) => column.id),
      );
    } catch (error) {
      setExportError(messageOf(error));
    } finally {
      setExporting(false);
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
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/children')}</h1>
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
              {canManage || canApprove ? (
                <Button disabled={selected.length === 0} onClick={() => setBulkRows(selected)}>
                  Cập nhật hàng loạt
                </Button>
              ) : null}
              {canExport ? (
                <Button disabled={exporting} onClick={() => void runExport()}>
                  Xuất Excel
                </Button>
              ) : null}
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
            openId === row.id ? (
              <ChildDetailPanel key={row.id} childId={row.id} onChanged={setToastMessage} />
            ) : null
          }
          settings={grid.settings}
          onSettingsChange={grid.update}
          serverPagination={{ page, total: children.data?.total ?? 0, onPageChange: setPage }}
        />
        {openId && !(children.data?.items ?? []).some((row) => row.id === openId) ? (
          <section className="rounded-xl border border-border bg-card p-4">
            <ChildDetailPanel key={openId} childId={openId} onChanged={setToastMessage} />
          </section>
        ) : null}
      </div>
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
