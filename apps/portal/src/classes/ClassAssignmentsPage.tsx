import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
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
import { useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { StaffPanel } from './ClassesPage.js';
import {
  ASSIGNMENT_ROLE_LABELS,
  endAssignment,
  exportClassAssignments,
  listClassAssignments,
  searchClasses,
  type AssignmentRole,
  type ClassAssignmentFilter,
  type ClassAssignmentRow,
} from './classes-api.js';

// 3.3. Phân công phụ trách lớp theo Sở (DT-15 phần 15b, YCTD-111): danh sách giáo viên và lớp phụ trách lấy từ phân công
// giáo viên của lớp (P02-05), lưới dữ liệu chung (khóa `class-assignments`), tìm theo tên giáo viên, mở rộng tìm kiếm theo
// đơn vị và vai trò, Xuất Excel. Thêm mới chọn lớp rồi phân công như ở 2.1; kết thúc phân công trên từng dòng. Theo Sở
// (DT-16 phần 16e) lưới hiện cả giáo viên chưa phụ trách lớp nào (dòng để trống lớp, ghi "Chưa phân công"), lọc theo tình
// trạng phân công
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const selectClass = 'mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
const formatDate = (value: string) => value.split('-').reverse().join('/');

const COLUMNS: Array<DataGridColumn<ClassAssignmentRow>> = [
  {
    id: 'staff_name',
    header: 'Giáo viên',
    alwaysVisible: true,
    className: 'font-medium',
    cell: (row) => row.staff_name,
  },
  {
    id: 'assignment_role',
    header: 'Vai trò trong lớp',
    cell: (row) =>
      row.assignment_role === null ? (
        <StatusBadge tone="warning" label="Chưa phân công" />
      ) : (
        ASSIGNMENT_ROLE_LABELS[row.assignment_role]
      ),
  },
  { id: 'subject_name', header: 'Môn dạy', cell: (row) => row.subject_name ?? '' },
  { id: 'class_name', header: 'Lớp', cell: (row) => row.class_name },
  { id: 'grade_name', header: 'Khối', cell: (row) => row.grade_name },
  { id: 'org_unit_name', header: 'Đơn vị', cell: (row) => row.org_unit_name },
  { id: 'from_date', header: 'Từ ngày', cell: (row) => (row.from_date ? formatDate(row.from_date) : '') },
];

function NewAssignment({ onChanged, onClose }: { onChanged(message: string): void; onClose(): void }) {
  const [classId, setClassId] = useState('');
  const classes = useQuery({
    queryKey: ['classes', 'grid', { status: 'active' }],
    queryFn: () => searchClasses({ status: 'active' }),
  });
  const chosen = (classes.data ?? []).find((item) => item.id === classId);
  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      aria-label="Thêm mới phân công"
    >
      <h2 className="text-section-title font-semibold text-text">Thêm mới phân công</h2>
      <FormBlock title="Lớp phụ trách">
        <FormRow label="Lớp">
          <select className={FORM_CONTROL_CLASS} value={classId} onChange={(event) => setClassId(event.target.value)}>
            <option value="">Chọn lớp</option>
            {(classes.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.org_unit_name})
              </option>
            ))}
          </select>
        </FormRow>
      </FormBlock>
      {chosen ? <StaffPanel classRecord={chosen} canManage onChanged={onChanged} /> : null}
      <div>
        <Button variant="text" onClick={onClose}>
          Đóng
        </Button>
      </div>
    </section>
  );
}

export function ClassAssignmentsPage() {
  const canManage = useHasPermission(PERMISSION_CODES.classManage);
  const canExport = useHasPermission(PERMISSION_CODES.dataExport);
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const grid = useGridSettings('class-assignments');
  const [filter, setFilter] = useState<ClassAssignmentFilter>({});
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [ending, setEnding] = useState<ClassAssignmentRow>();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const activeFilter: ClassAssignmentFilter = { ...filter, q: search.trim() || undefined };
  const rows = useQuery({
    queryKey: ['class-assignments', activeFilter],
    queryFn: () => listClassAssignments(activeFilter),
  });
  const end = useMutation({
    mutationFn: (row: ClassAssignmentRow) => endAssignment(row.class_id ?? '', row.id),
    onSuccess: async () => {
      setEnding(undefined);
      await queryClient.invalidateQueries({ queryKey: ['class-assignments'] });
      await queryClient.invalidateQueries({ queryKey: ['classes'] });
      setToastMessage('Đã kết thúc phân công');
    },
    onError: () => setEnding(undefined),
  });
  const change = (key: keyof ClassAssignmentFilter, value: string) =>
    setFilter((current) => ({ ...current, [key]: value || undefined }));

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/class-assignments')}</h1>
        {creating ? (
          <NewAssignment
            onClose={() => setCreating(false)}
            onChanged={(message) => {
              setToastMessage(message);
              void queryClient.invalidateQueries({ queryKey: ['class-assignments'] });
            }}
          />
        ) : null}
        {rows.isError ? <Alert tone="danger">{messageOf(rows.error)}</Alert> : null}
        {end.error ? <Alert tone="danger">{messageOf(end.error)}</Alert> : null}
        {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
        {exportError ? <Alert tone="danger">{exportError}</Alert> : null}
        <DataGrid
          label="Danh sách phân công phụ trách lớp"
          columns={COLUMNS}
          rows={rows.data ?? []}
          getRowId={(row) => row.id}
          getRowLabel={(row) => `${row.staff_name} ${row.class_name}`}
          loading={rows.isPending}
          emptyText="Không có giáo viên nào."
          search={{ label: 'Tìm theo tên giáo viên', value: search, onChange: setSearch }}
          advancedSearch={
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="text-label font-medium text-text">
                Đơn vị
                <select
                  value={filter.org_unit_id ?? ''}
                  onChange={(event) => change('org_unit_id', event.target.value)}
                  className={selectClass}
                >
                  <option value="">Tất cả</option>
                  {unitChoice.units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-label font-medium text-text">
                Vai trò trong lớp
                <select
                  value={filter.assignment_role ?? ''}
                  onChange={(event) => change('assignment_role', event.target.value)}
                  className={selectClass}
                >
                  <option value="">Tất cả</option>
                  {(Object.keys(ASSIGNMENT_ROLE_LABELS) as AssignmentRole[]).map((role) => (
                    <option key={role} value={role}>
                      {ASSIGNMENT_ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-label font-medium text-text">
                Tình trạng phân công
                <select
                  value={filter.assignment ?? ''}
                  onChange={(event) => change('assignment', event.target.value)}
                  className={selectClass}
                >
                  <option value="">Tất cả</option>
                  <option value="assigned">Đã phân công</option>
                  <option value="unassigned">Chưa phân công</option>
                </select>
              </label>
            </div>
          }
          toolbar={
            <>
              {canManage ? (
                <Button variant="primary" onClick={() => setCreating(true)}>
                  Thêm mới
                </Button>
              ) : null}
              {canExport ? (
                <Button
                  disabled={exporting}
                  onClick={() => {
                    setExportError(undefined);
                    setExporting(true);
                    exportClassAssignments(activeFilter)
                      .catch((error: unknown) => setExportError(messageOf(error)))
                      .finally(() => setExporting(false));
                  }}
                >
                  Xuất Excel
                </Button>
              ) : null}
            </>
          }
          rowActions={
            canManage
              ? (row) =>
                  row.class_id === null ? null : (
                    <Button variant="text" onClick={() => setEnding(row)}>
                      Kết thúc phân công
                    </Button>
                  )
              : undefined
          }
          settings={grid.settings}
          onSettingsChange={grid.update}
          exportPdf={canExport ? () => exportClassAssignments(activeFilter, 'pdf') : undefined}
        />
      </div>
      {ending ? (
        <ConfirmDialog
          open
          title={`Kết thúc phân công ${ending.staff_name}?`}
          confirmLabel="Kết thúc phân công"
          busy={end.isPending}
          onCancel={() => setEnding(undefined)}
          onConfirm={() => end.mutate(ending)}
        >
          Giáo viên thôi phụ trách lớp {ending.class_name} từ hôm nay; lịch sử phân công vẫn được giữ.
        </ConfirmDialog>
      ) : null}
    </AppShell>
  );
}
