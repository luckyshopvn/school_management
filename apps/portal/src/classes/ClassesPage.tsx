import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  CLASS_AGE_GROUPS,
  CLASS_STAGE_LABELS,
  PERMISSION_CODES,
  classAgeGroupLabel,
  isMenuPathVisible,
  type ClassStage,
} from '@school-management/shared';
import {
  Alert,
  Button,
  ConfirmDeleteDialog,
  ConfirmDialog,
  DataGrid,
  resolveVisibleColumns,
  StatusBadge,
  TextField,
  Toast,
  type DataGridColumn,
} from '@school-management/ui';
import { listGradeLevels } from '../catalogs/catalogs-api.js';
import { useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { useCurrentPermissions, useHasPermission } from '../session/permissions.js';
import { ClassForm } from './ClassForm.js';
import {
  addAssignment,
  ASSIGNMENT_ROLE_LABELS,
  bulkUpdateClasses,
  deleteClasses,
  endAssignment,
  exportClasses,
  listStaff,
  searchClasses,
  updateClass,
  type AssignmentRole,
  type BulkClassResult,
  type ClassFilter,
  type ClassRecord,
} from './classes-api.js';

// MH-03 2.1. Hồ sơ lớp học theo Sở (DT-15 phần 15b, YCTD-111): lưới dữ liệu chung (khóa `classes`) với cột theo thứ tự cột
// của Sở, tìm theo tên hoặc mã lớp, mở rộng tìm kiếm, Thêm mới, Xuất Excel; Sửa mở biểu mẫu theo khối ngay dưới dòng.
// Phân công giáo viên (P02-05, YCTD-44) ở nút "Giáo viên" của dòng; giải thể lớp là đóng lớp, không xóa (BR-02). DT-16
// phần 16e thêm ô chọn dòng, Xóa lớp (lớp chưa phát sinh dữ liệu), giải thể và thay đổi hàng loạt các lớp đã chọn.
// YCTD-339 (thiết kế lại cổng quản trị, theo mẫu YCTD-333): thanh công cụ chỉ còn Nhập từ Excel (mở 2.2), Thêm mới; Thay
// đổi, Giải thể lớp đã chọn, Xóa lớp hiện ở thanh "Đã chọn" khi chọn dòng; Xuất Excel ở menu Thêm; cột mặc định còn Tên
// lớp, Khối, Giáo viên chủ nhiệm, Số học sinh, Điểm trường, Phòng học (cột khác bật ở Cấu hình cột hiển thị); đầu trang
// có liên kết sang 3.3 Phân công phụ trách lớp
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const selectClass = 'mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
const YES_NO = [
  { value: 'true', label: 'Có' },
  { value: 'false', label: 'Không' },
];
const yes = (value: boolean) => (value ? 'Có' : '');

// Mã cột trùng mã cột tệp Excel của máy chủ; thứ tự cột theo màn hình 2.1 của Sở, 50 dòng mỗi trang (tài liệu 46 mục 9.8,
// YCTD-117). Cột hiện mặc định theo thiết kế cổng quản trị (YCTD-339): Tên lớp, Khối, Giáo viên chủ nhiệm, Số học sinh,
// Điểm trường, Phòng học; các cột khác ẩn mặc định, bật lại ở Cấu hình cột hiển thị
const SO_PAGE_SIZE = 50;
const COLUMNS: Array<DataGridColumn<ClassRecord>> = [
  {
    id: 'branch',
    header: 'Phân hiệu',
    hiddenByDefault: true,
    cell: (row) => (row.org_unit_type === 'phan_hieu' ? row.org_unit_name : ''),
  },
  { id: 'code', header: 'Mã lớp', hiddenByDefault: true, cell: (row) => row.code },
  { id: 'name', header: 'Tên lớp', alwaysVisible: true, className: 'font-medium', cell: (row) => row.name },
  { id: 'grade', header: 'Khối', cell: (row) => row.grade_name },
  {
    id: 'stage',
    header: 'Nhóm lớp',
    hiddenByDefault: true,
    cell: (row) => (row.stage ? CLASS_STAGE_LABELS[row.stage] : ''),
  },
  {
    id: 'nursery_group',
    header: 'Nhóm trẻ',
    hiddenByDefault: true,
    cell: (row) => (row.stage === 'nhom_tre' && row.age_group ? classAgeGroupLabel(row.age_group) : ''),
  },
  {
    id: 'age_group',
    header: 'Nhóm tuổi',
    hiddenByDefault: true,
    cell: (row) => (row.stage === 'mau_giao' && row.age_group ? classAgeGroupLabel(row.age_group) : ''),
  },
  { id: 'sort_order', header: 'Thứ tự', hiddenByDefault: true, cell: (row) => row.sort_order ?? '' },
  { id: 'homeroom', header: 'Giáo viên chủ nhiệm', cell: (row) => row.homeroom_names },
  { id: 'enrolled', header: 'Số học sinh', cell: (row) => `${row.enrolled_count}/${row.max_size}` },
  {
    id: 'two_sessions_per_day',
    header: 'Học 2 buổi/ngày',
    hiddenByDefault: true,
    cell: (row) => yes(row.two_sessions_per_day),
  },
  {
    id: 'mixed_age',
    header: 'Lớp mẫu giáo ghép 2 hoặc 3 độ tuổi',
    hiddenByDefault: true,
    cell: (row) => (row.mixed_age_count ? `Ghép ${row.mixed_age_count} độ tuổi` : ''),
  },
  { id: 'is_combined', header: 'Lớp ghép', hiddenByDefault: true, cell: (row) => yes(row.is_combined) },
  { id: 'combined_into', header: 'Ghép vào lớp', hiddenByDefault: true, cell: (row) => row.combined_into_name ?? '' },
  { id: 'boarding', header: 'Lớp bán trú', hiddenByDefault: true, cell: (row) => yes(row.boarding) },
  {
    id: 'dissolved',
    header: 'Lớp giải thể',
    hiddenByDefault: true,
    cell: (row) => (row.status === 'closed' ? <StatusBadge tone="neutral" label="Đã giải thể" /> : ''),
  },
  {
    id: 'school_site',
    header: 'Điểm trường',
    cell: (row) => (row.org_unit_type === 'diem_truong' ? row.org_unit_name : ''),
  },
  { id: 'room', header: 'Phòng học', cell: (row) => row.room_name ?? '' },
  { id: 'max_size', header: 'Sĩ số tối đa', hiddenByDefault: true, cell: (row) => row.max_size },
];

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

export function StaffPanel({
  classRecord,
  canManage,
  onChanged,
}: {
  classRecord: ClassRecord;
  canManage: boolean;
  onChanged(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [role, setRole] = useState<AssignmentRole>('homeroom');
  const [staffUserId, setStaffUserId] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const staff = useQuery({
    queryKey: ['staff-directory', role, classRecord.org_unit_id],
    queryFn: () => listStaff(role === 'homeroom' ? 'VT-07' : 'VT-08', classRecord.org_unit_id),
    enabled: canManage && classRecord.status === 'active',
  });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['classes'] });
    await queryClient.invalidateQueries({ queryKey: ['class-assignments'] });
  };
  const add = useMutation({
    mutationFn: () =>
      addAssignment(classRecord.id, {
        staff_user_id: staffUserId,
        assignment_role: role,
        subject_name: role === 'subject' ? subjectName : null,
      }),
    onSuccess: async () => {
      setStaffUserId('');
      setSubjectName('');
      await refresh();
      onChanged('Đã phân công giáo viên');
    },
  });
  const end = useMutation({
    mutationFn: (assignmentId: string) => endAssignment(classRecord.id, assignmentId),
    onSuccess: async () => {
      await refresh();
      onChanged('Đã kết thúc phân công');
    },
  });
  const errors =
    add.error instanceof ApiError
      ? Object.fromEntries(add.error.details.map((detail) => [detail.field, detail.message]))
      : {};

  return (
    <div
      className="flex flex-col gap-3 rounded-lg bg-page p-3"
      aria-label={`Giáo viên lớp ${classRecord.name}`}
      role="region"
    >
      {classRecord.staff.length === 0 ? (
        <p className="text-label text-text-secondary">Chưa phân công giáo viên.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {classRecord.staff.map((assignment) => (
            <li key={assignment.id} className="flex flex-wrap items-center gap-3">
              <span className="font-medium">{assignment.staff_name}</span>
              <StatusBadge tone="info" label={ASSIGNMENT_ROLE_LABELS[assignment.assignment_role]} />
              {assignment.subject_name ? <span className="text-label">{assignment.subject_name}</span> : null}
              <span className="text-label text-text-secondary">từ {assignment.from_date}</span>
              {canManage ? (
                <Button variant="text" disabled={end.isPending} onClick={() => end.mutate(assignment.id)}>
                  Kết thúc phân công
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {end.error ? <Alert tone="danger">{messageOf(end.error)}</Alert> : null}
      {canManage && classRecord.status === 'active' ? (
        <div className="flex flex-col gap-2">
          {add.error ? <Alert tone="danger">{messageOf(add.error)}</Alert> : null}
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-2 text-label font-medium text-text">
              Vai trò trong lớp
              <select
                value={role}
                onChange={(event) => {
                  setRole(event.target.value as AssignmentRole);
                  setStaffUserId('');
                }}
                className="rounded-lg border border-border bg-card px-3 py-2 text-content font-normal"
              >
                <option value="homeroom">Chủ nhiệm</option>
                <option value="subject">Bộ môn</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-label font-medium text-text">
              Giáo viên
              <select
                value={staffUserId}
                onChange={(event) => setStaffUserId(event.target.value)}
                className="rounded-lg border border-border bg-card px-3 py-2 text-content font-normal"
              >
                <option value="">Chọn giáo viên</option>
                {(staff.data ?? []).map((entry) => (
                  <option key={entry.user_id} value={entry.user_id}>
                    {entry.full_name}
                  </option>
                ))}
              </select>
              {errors.staff_user_id ? <span className="text-label text-danger">{errors.staff_user_id}</span> : null}
            </label>
            {role === 'subject' ? (
              <TextField
                label="Môn dạy"
                value={subjectName}
                error={errors.subject_name}
                onChange={(event) => setSubjectName(event.target.value)}
              />
            ) : null}
            <Button disabled={add.isPending || staffUserId === ''} onClick={() => add.mutate()}>
              Phân công
            </Button>
          </div>
          {staff.isError ? <Alert tone="danger">{messageOf(staff.error)}</Alert> : null}
        </div>
      ) : null}
    </div>
  );
}

type OpenPanel = { id: string; kind: 'edit' | 'staff' };
// Thao tác trên các lớp đã chọn (DT-16 phần 16e): Xóa lớp theo hộp xác nhận của Sở, giải thể, thay đổi hàng loạt
type BulkAction = { kind: 'delete' | 'dissolve' | 'change'; rows: ClassRecord[] };
type FlagChoice = '' | 'true' | 'false';

// Số lớp làm được và không làm được của thao tác hàng loạt
function bulkMessage(result: BulkClassResult, done: string): string {
  const parts = [result.succeeded.length > 0 ? `${done} ${result.succeeded.length} lớp` : ''];
  if (result.failed.length > 0) {
    parts.push(`${result.failed.length} lớp không làm được`);
  }
  return parts.filter(Boolean).join('; ');
}

export function ClassesPage() {
  const canManage = useHasPermission(PERMISSION_CODES.classManage);
  const canExport = useHasPermission(PERMISSION_CODES.dataExport);
  // Liên kết sang 2.2 và 3.3 hiện theo đúng điều kiện quyền của mục menu tương ứng
  const permissions = useCurrentPermissions();
  const canImport = isMenuPathVisible('/class-imports', (code) => permissions.has(code));
  const canOpenAssignments = isMenuPathVisible('/class-assignments', (code) => permissions.has(code));
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const grid = useGridSettings('classes', SO_PAGE_SIZE);
  const [filter, setFilter] = useState<ClassFilter>({});
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<OpenPanel>();
  const [closing, setClosing] = useState<ClassRecord>();
  const [bulk, setBulk] = useState<BulkAction>();
  const [bulkFailures, setBulkFailures] = useState<BulkClassResult['failed']>([]);
  const [twoSessionsChoice, setTwoSessionsChoice] = useState<FlagChoice>('');
  const [boardingChoice, setBoardingChoice] = useState<FlagChoice>('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);

  const activeFilter: ClassFilter = { ...filter, q: search.trim() || undefined };
  const classes = useQuery({ queryKey: ['classes', 'grid', activeFilter], queryFn: () => searchClasses(activeFilter) });
  const gradeLevels = useQuery({ queryKey: ['grade-levels'], queryFn: listGradeLevels });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['classes'] });
  const changeStatus = useMutation({
    mutationFn: ({ classRecord, status }: { classRecord: ClassRecord; status: 'active' | 'closed' }) =>
      updateClass(classRecord.id, { status }),
    onSuccess: async (_saved, { status }) => {
      setClosing(undefined);
      await refresh();
      setToastMessage(status === 'closed' ? 'Đã giải thể lớp' : 'Đã mở lại lớp');
    },
    onError: () => setClosing(undefined),
  });
  const runBulk = useMutation({
    mutationFn: (action: BulkAction) => {
      const ids = action.rows.map((row) => row.id);
      if (action.kind === 'delete') {
        return deleteClasses(ids);
      }
      if (action.kind === 'dissolve') {
        return bulkUpdateClasses(ids, { status: 'closed' });
      }
      return bulkUpdateClasses(ids, {
        ...(twoSessionsChoice ? { two_sessions_per_day: twoSessionsChoice === 'true' } : {}),
        ...(boardingChoice ? { boarding: boardingChoice === 'true' } : {}),
      });
    },
    onSuccess: async (result, action) => {
      setBulk(undefined);
      setBulkFailures(result.failed);
      await refresh();
      setToastMessage(
        bulkMessage(
          result,
          action.kind === 'delete' ? 'Đã xóa' : action.kind === 'dissolve' ? 'Đã giải thể' : 'Đã cập nhật',
        ),
      );
    },
    onError: () => setBulk(undefined),
  });
  const openBulk = (kind: BulkAction['kind'], rows: ClassRecord[]) => {
    setBulkFailures([]);
    setTwoSessionsChoice('');
    setBoardingChoice('');
    setBulk({ kind, rows });
  };
  const change = (key: keyof ClassFilter, value: string) =>
    setFilter((current) => ({ ...current, [key]: value || undefined }));
  const toggle = (id: string, kind: OpenPanel['kind']) => {
    setCreating(false);
    setOpen(open?.id === id && open.kind === kind ? undefined : { id, kind });
  };

  const runExport = async () => {
    setExportError(undefined);
    setExporting(true);
    try {
      await exportClasses(
        activeFilter,
        resolveVisibleColumns(COLUMNS, grid.settings.columns).map((column) => column.id),
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
      <FilterSelect
        label="Nhóm lớp"
        value={filter.stage ?? ''}
        onChange={(value) => change('stage', value)}
        options={(Object.keys(CLASS_STAGE_LABELS) as ClassStage[]).map((stage) => ({
          value: stage,
          label: CLASS_STAGE_LABELS[stage],
        }))}
      />
      <FilterSelect
        label="Nhóm tuổi"
        value={filter.age_group ?? ''}
        onChange={(value) => change('age_group', value)}
        options={CLASS_AGE_GROUPS.map((group) => ({ value: group.key, label: group.label }))}
      />
      <FilterSelect
        label="Học 2 buổi/ngày"
        value={filter.two_sessions_per_day ?? ''}
        onChange={(value) => change('two_sessions_per_day', value)}
        options={YES_NO}
      />
      <FilterSelect
        label="Lớp bán trú"
        value={filter.boarding ?? ''}
        onChange={(value) => change('boarding', value)}
        options={YES_NO}
      />
      <FilterSelect
        label="Lớp ghép"
        value={filter.is_combined ?? ''}
        onChange={(value) => change('is_combined', value)}
        options={YES_NO}
      />
      <FilterSelect
        label="Trạng thái"
        value={filter.status ?? ''}
        onChange={(value) => change('status', value)}
        options={[
          { value: 'active', label: 'Đang dùng' },
          { value: 'closed', label: 'Đã giải thể' },
        ]}
      />
    </div>
  );

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-page-title font-bold text-text">{menuPageTitle('/classes')}</h1>
          {canOpenAssignments ? (
            <Link
              to="/class-assignments"
              className="flex min-h-11 items-center rounded-lg border border-border bg-card px-4 text-label font-medium text-link hover:bg-selected"
            >
              Phân công phụ trách lớp
            </Link>
          ) : null}
        </div>
        {!unitChoice.isPending && unitChoice.units.length === 0 ? (
          <Alert tone="warning">Chưa có đơn vị. Hãy mở năm học và tạo cây đơn vị trước.</Alert>
        ) : null}
        {creating && unitChoice.selectedId ? (
          <section className="rounded-xl border border-border bg-card p-4">
            <ClassForm
              units={unitChoice.units}
              defaultUnitId={filter.org_unit_id ?? unitChoice.selectedId}
              onCancel={() => setCreating(false)}
              onSaved={(saved) => {
                setCreating(false);
                void refresh();
                setToastMessage(`Đã tạo lớp ${saved.name}`);
              }}
            />
          </section>
        ) : null}
        {classes.isError ? <Alert tone="danger">{messageOf(classes.error)}</Alert> : null}
        {changeStatus.error ? <Alert tone="danger">{messageOf(changeStatus.error)}</Alert> : null}
        {runBulk.error ? <Alert tone="danger">{messageOf(runBulk.error)}</Alert> : null}
        {bulkFailures.length > 0 ? (
          <Alert tone="warning">
            <ul className="flex flex-col gap-1">
              {bulkFailures.map((failure) => (
                <li key={failure.id}>
                  Lớp {failure.name}: {failure.message}
                </li>
              ))}
            </ul>
          </Alert>
        ) : null}
        {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
        {exportError ? <Alert tone="danger">{exportError}</Alert> : null}
        <DataGrid
          label="Danh sách lớp"
          columns={COLUMNS}
          rows={classes.data ?? []}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.name}
          getRowAriaLabel={(row) => `Lớp ${row.name}`}
          loading={classes.isPending}
          emptyText="Không có lớp nào."
          search={{ label: 'Tìm theo tên, mã lớp', value: search, onChange: setSearch }}
          advancedSearch={advancedSearch}
          selectable={canManage}
          toolbar={
            canManage ? (
              <>
                {canImport ? (
                  <Link
                    to="/class-imports"
                    className="rounded-lg border border-border-strong bg-card px-4 py-2 text-label font-medium text-text hover:bg-selected"
                  >
                    Nhập từ Excel
                  </Link>
                ) : null}
                {unitChoice.selectedId ? (
                  <Button
                    variant="primary"
                    onClick={() => {
                      setCreating(true);
                      setOpen(undefined);
                    }}
                  >
                    Thêm mới
                  </Button>
                ) : null}
              </>
            ) : null
          }
          selectionActions={
            canManage
              ? (selectedRows) => (
                  <>
                    <Button onClick={() => openBulk('change', selectedRows)}>Thay đổi</Button>
                    <Button onClick={() => openBulk('dissolve', selectedRows)}>Giải thể lớp đã chọn</Button>
                    <Button variant="danger" onClick={() => openBulk('delete', selectedRows)}>
                      Xóa lớp
                    </Button>
                  </>
                )
              : undefined
          }
          moreActions={
            canExport ? [{ label: 'Xuất Excel', disabled: exporting, onSelect: () => void runExport() }] : undefined
          }
          rowActions={(row) => (
            <span className="flex flex-wrap justify-end gap-1">
              {canManage ? (
                <Button variant="text" onClick={() => toggle(row.id, 'edit')}>
                  Sửa
                </Button>
              ) : null}
              <Button variant="text" onClick={() => toggle(row.id, 'staff')}>
                {open?.id === row.id && open.kind === 'staff' ? 'Ẩn giáo viên' : 'Giáo viên'}
              </Button>
              {canManage ? (
                row.status === 'active' ? (
                  <Button variant="text" onClick={() => setClosing(row)}>
                    Giải thể lớp
                  </Button>
                ) : (
                  <Button
                    variant="text"
                    disabled={changeStatus.isPending}
                    onClick={() => changeStatus.mutate({ classRecord: row, status: 'active' })}
                  >
                    Mở lại
                  </Button>
                )
              ) : null}
            </span>
          )}
          activeRowId={open?.id}
          renderRowDetail={(row) => {
            if (open?.id !== row.id) {
              return null;
            }
            return open.kind === 'staff' ? (
              <StaffPanel classRecord={row} canManage={canManage} onChanged={setToastMessage} />
            ) : (
              <ClassForm
                key={row.id}
                classRecord={row}
                units={unitChoice.units}
                defaultUnitId={row.org_unit_id}
                onCancel={() => setOpen(undefined)}
                onSaved={(saved) => {
                  setOpen(undefined);
                  void refresh();
                  setToastMessage(`Đã ghi lớp ${saved.name}`);
                }}
              />
            );
          }}
          settings={grid.settings}
          onSettingsChange={grid.update}
          exportPdf={canExport ? (columnIds) => exportClasses(activeFilter, columnIds, 'pdf') : undefined}
        />
      </div>
      <ConfirmDeleteDialog
        open={bulk?.kind === 'delete'}
        title="Xóa lớp"
        subject={bulk?.kind === 'delete' ? `${bulk.rows.length} lớp đã chọn` : ''}
        busy={runBulk.isPending}
        onCancel={() => setBulk(undefined)}
        onConfirm={() => bulk && runBulk.mutate(bulk)}
      >
        Chỉ xóa được lớp chưa phát sinh dữ liệu (chưa có học sinh, điểm danh, sổ, thực đơn…) và không có lớp khác ghép
        vào; phân công giáo viên của lớp bị xóa theo. Lớp đã có dữ liệu thì giải thể. Lớp đã chọn:{' '}
        {bulk?.rows.map((row) => row.name).join(', ')}.
      </ConfirmDeleteDialog>
      {bulk?.kind === 'dissolve' ? (
        <ConfirmDialog
          open
          title={`Giải thể ${bulk.rows.length} lớp đã chọn?`}
          confirmLabel="Giải thể lớp"
          busy={runBulk.isPending}
          onCancel={() => setBulk(undefined)}
          onConfirm={() => runBulk.mutate(bulk)}
        >
          Lớp không bị xóa, vẫn giữ lịch sử. Lớp còn học sinh đang học không giải thể được. Lớp đã chọn:{' '}
          {bulk.rows.map((row) => row.name).join(', ')}.
        </ConfirmDialog>
      ) : null}
      {bulk?.kind === 'change' ? (
        <ConfirmDialog
          open
          title={`Thay đổi ${bulk.rows.length} lớp đã chọn`}
          confirmLabel="Ghi"
          busy={runBulk.isPending || (twoSessionsChoice === '' && boardingChoice === '')}
          onCancel={() => setBulk(undefined)}
          onConfirm={() => runBulk.mutate(bulk)}
        >
          <div className="flex flex-col gap-3">
            <label className="text-label font-medium text-text">
              Học 2 buổi/ngày
              <select
                value={twoSessionsChoice}
                onChange={(event) => setTwoSessionsChoice(event.target.value as FlagChoice)}
                className={selectClass}
              >
                <option value="">Không đổi</option>
                <option value="true">Có</option>
                <option value="false">Không</option>
              </select>
            </label>
            <label className="text-label font-medium text-text">
              Lớp bán trú
              <select
                value={boardingChoice}
                onChange={(event) => setBoardingChoice(event.target.value as FlagChoice)}
                className={selectClass}
              >
                <option value="">Không đổi</option>
                <option value="true">Có</option>
                <option value="false">Không</option>
              </select>
            </label>
          </div>
        </ConfirmDialog>
      ) : null}
      {closing ? (
        <ConfirmDialog
          open
          title={`Giải thể lớp ${closing.name}?`}
          confirmLabel="Giải thể lớp"
          busy={changeStatus.isPending}
          onCancel={() => setClosing(undefined)}
          onConfirm={() => changeStatus.mutate({ classRecord: closing, status: 'closed' })}
        >
          Lớp không bị xóa, vẫn giữ lịch sử, nhưng không phân công thêm giáo viên và không phân thêm học sinh. Có thể mở
          lại khi năm học còn mở.
        </ConfirmDialog>
      ) : null}
    </AppShell>
  );
}
