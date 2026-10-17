import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, DataGrid, Toast, type DataGridColumn } from '@school-management/ui';
import { useUnitChoice } from '../catalogs/UnitSelect.js';
import { messageOf } from '../imports/import-api.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import {
  assignBranches,
  branchesFromTeaching,
  listStaffBranches,
  unassignBranches,
  type StaffBranchRow,
} from './staff-so-api.js';

// 3.1.2. Nhân sự phân hiệu (DT-16 phần 16f, mục 3.1.2 của Sở): danh sách nhân sự đang làm việc với đơn vị chính và các phân
// hiệu, điểm trường đã gán; chọn nhân sự rồi "Gán phân hiệu", "Bỏ gán" theo phân hiệu chọn ở ô bên cạnh, hoặc "Lấy theo phân
// hiệu giảng dạy" (đơn vị của các lớp đang phân công ở 3.3)
const selectClass = 'mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';

const columns: Array<DataGridColumn<StaffBranchRow>> = [
  { id: 'code', header: 'Mã nhân sự', cell: (row) => row.code },
  { id: 'full_name', header: 'Họ tên', alwaysVisible: true, className: 'font-medium', cell: (row) => row.full_name },
  { id: 'unit', header: 'Đơn vị chính', cell: (row) => row.unit_name },
  {
    id: 'branches',
    header: 'Phân hiệu, điểm trường',
    cell: (row) =>
      row.branches.length === 0
        ? 'Chưa gán'
        : row.branches
            .map((branch) => (branch.source === 'teaching' ? `${branch.name} (theo giảng dạy)` : branch.name))
            .join('; '),
  },
  {
    id: 'account',
    header: 'Tài khoản',
    hiddenByDefault: true,
    cell: (row) => (row.has_account ? 'Đã liên kết' : 'Chưa có'),
  },
];

export function StaffBranchesPage() {
  const canManage = useHasPermission(PERMISSION_CODES.staffManage);
  const unitChoice = useUnitChoice();
  const queryClient = useQueryClient();
  const grid = useGridSettings('staff-branches');
  const [search, setSearch] = useState('');
  const [orgUnitId, setOrgUnitId] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [branchId, setBranchId] = useState('');
  const [page, setPage] = useState(1);
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const pageSize = grid.settings.pageSize;
  const list = useQuery({
    queryKey: ['staff-branches', orgUnitId, branchFilter, search, page, pageSize],
    queryFn: () =>
      listStaffBranches({
        org_unit_id: orgUnitId || undefined,
        branch_id: branchFilter || undefined,
        q: search || undefined,
        page,
        page_size: pageSize,
      }),
    enabled: grid.ready,
  });
  const branchUnits = list.data?.branch_units ?? [];
  const done = async (message: string) => {
    setToastMessage(message);
    await queryClient.invalidateQueries({ queryKey: ['staff-branches'] });
  };
  const assign = useMutation({
    mutationFn: (staffIds: string[]) => assignBranches(staffIds, [branchId]),
    onSuccess: (result) => done(`Đã gán ${result.assigned_count} phân hiệu`),
  });
  const unassign = useMutation({
    mutationFn: (staffIds: string[]) => unassignBranches(staffIds, [branchId]),
    onSuccess: (result) => done(`Đã bỏ gán ${result.removed_count} phân hiệu`),
  });
  const fromTeaching = useMutation({
    mutationFn: (staffIds: string[]) => branchesFromTeaching(staffIds),
    onSuccess: (result) =>
      done(
        `Đã lấy ${result.assigned_count} phân hiệu theo giảng dạy${result.without_account_count > 0 ? `; ${result.without_account_count} nhân sự chưa có tài khoản nên chưa có phân công` : ''}`,
      ),
  });
  const error = list.error ?? grid.error ?? assign.error ?? unassign.error ?? fromTeaching.error;
  const busy = assign.isPending || unassign.isPending || fromTeaching.isPending;

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/staff-branches')}</h1>
        {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
        <DataGrid
          label="Danh sách nhân sự phân hiệu"
          columns={columns}
          rows={list.data?.items ?? []}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.full_name}
          getRowAriaLabel={(row) => `Nhân sự ${row.full_name}`}
          loading={!list.data && !list.isError}
          emptyText="Không có nhân sự."
          search={{
            label: 'Tìm theo tên hoặc mã',
            value: search,
            onChange: (value) => {
              setSearch(value);
              setPage(1);
            },
          }}
          advancedSearch={
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="text-label font-medium text-text">
                Đơn vị chính
                <select
                  value={orgUnitId}
                  onChange={(event) => {
                    setOrgUnitId(event.target.value);
                    setPage(1);
                  }}
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
                Đã gán phân hiệu
                <select
                  value={branchFilter}
                  onChange={(event) => {
                    setBranchFilter(event.target.value);
                    setPage(1);
                  }}
                  className={selectClass}
                >
                  <option value="">Tất cả</option>
                  {branchUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          }
          toolbar={(selectedRows) =>
            canManage ? (
              <>
                <label className="flex items-center gap-2 text-label font-medium text-text">
                  Phân hiệu
                  <select
                    value={branchId}
                    onChange={(event) => setBranchId(event.target.value)}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-content font-normal"
                  >
                    <option value="">Chọn phân hiệu</option>
                    {branchUnits.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  variant="primary"
                  disabled={busy || !branchId || selectedRows.length === 0}
                  onClick={() => assign.mutate(selectedRows.map((row) => row.id))}
                >
                  Gán phân hiệu
                </Button>
                <Button
                  disabled={busy || !branchId || selectedRows.length === 0}
                  onClick={() => unassign.mutate(selectedRows.map((row) => row.id))}
                >
                  Bỏ gán
                </Button>
                <Button
                  disabled={busy || (list.data?.items.length ?? 0) === 0}
                  title="Chọn nhân sự, không chọn thì lấy cho mọi nhân sự trong trang"
                  onClick={() =>
                    fromTeaching.mutate(
                      (selectedRows.length > 0 ? selectedRows : (list.data?.items ?? [])).map((row) => row.id),
                    )
                  }
                >
                  Lấy theo phân hiệu giảng dạy
                </Button>
              </>
            ) : null
          }
          selectable
          settings={grid.settings}
          onSettingsChange={grid.update}
          serverPagination={{ page, total: list.data?.total ?? 0, onPageChange: setPage }}
        />
      </div>
    </AppShell>
  );
}
