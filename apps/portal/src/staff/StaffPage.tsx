import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, DataGrid, StatusBadge, TextField, Toast, type DataGridColumn } from '@school-management/ui';
import { listDepartments, listJobTitles } from '../catalogs/catalogs-api.js';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { createStaff, listStaff, type Staff } from './staff-api.js';
import { StaffDetailPanel } from './StaffDetailPanel.js';

// MH-12 Hồ sơ nhân sự và hợp đồng (P07-01, P07-02, P07-04; BR-37, BR-38; YCTD-58): danh sách theo đơn vị, tìm theo tên
// hoặc mã; phòng nhân sự tạo hồ sơ, liên kết tài khoản, lập và chấm dứt hợp đồng. Danh sách dùng lưới dữ liệu chung
// (DT-15 phần 15a)
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const selectClass = 'mt-2 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';

function StaffForm({ orgUnitId, onCreated }: { orgUnitId: string; onCreated(message: string): void }) {
  const departments = useQuery({ queryKey: ['departments', orgUnitId], queryFn: () => listDepartments(orgUnitId) });
  const jobTitles = useQuery({ queryKey: ['job-titles', orgUnitId], queryFn: () => listJobTitles(orgUnitId) });
  const [code, setCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [jobTitleId, setJobTitleId] = useState('');
  const [startDate, setStartDate] = useState('');
  const save = useMutation({
    mutationFn: () =>
      createStaff({
        org_unit_id: orgUnitId,
        code,
        full_name: fullName,
        start_date: startDate,
        ...(phone ? { phone } : {}),
        ...(idNumber ? { id_number: idNumber } : {}),
        ...(departmentId ? { department_id: departmentId } : {}),
        ...(jobTitleId ? { job_title_id: jobTitleId } : {}),
      }),
    onSuccess: (staff) => {
      setCode('');
      setFullName('');
      setPhone('');
      setIdNumber('');
      onCreated(`Đã tạo hồ sơ ${staff.full_name}`);
    },
  });

  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      aria-label="Thêm hồ sơ nhân sự"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <h2 className="text-section-title font-semibold text-text">Thêm hồ sơ nhân sự</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <TextField label="Mã nhân sự" value={code} onChange={(event) => setCode(event.target.value)} />
        <TextField label="Họ tên" value={fullName} onChange={(event) => setFullName(event.target.value)} />
        <TextField label="Điện thoại" value={phone} onChange={(event) => setPhone(event.target.value)} />
        <TextField
          label="Số định danh cá nhân"
          value={idNumber}
          onChange={(event) => setIdNumber(event.target.value)}
        />
        <label className="text-label font-medium text-text">
          Phòng ban
          <select
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
            className={selectClass}
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
        </label>
        <label className="text-label font-medium text-text">
          Chức danh
          <select value={jobTitleId} onChange={(event) => setJobTitleId(event.target.value)} className={selectClass}>
            <option value="">Không chọn</option>
            {(jobTitles.data ?? [])
              .filter((jobTitle) => jobTitle.status === 'active')
              .map((jobTitle) => (
                <option key={jobTitle.id} value={jobTitle.id}>
                  {jobTitle.name}
                </option>
              ))}
          </select>
        </label>
        <TextField
          label="Ngày vào làm"
          type="date"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
        />
      </div>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <div>
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Thêm hồ sơ
        </Button>
      </div>
    </form>
  );
}

export function StaffPage() {
  const canManage = useHasPermission(PERMISSION_CODES.staffManage);
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const staff = useQuery({
    queryKey: ['staff', orgUnitId, search],
    queryFn: () => listStaff(orgUnitId ?? '', search),
    enabled: Boolean(orgUnitId),
  });
  const [openId, setOpenId] = useState<string>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const rows = staff.data ?? [];
  const grid = useGridSettings('staff');

  // Cột chính theo hồ sơ cán bộ, giáo viên của Sở (3.1.1); cột ẩn mặc định bật ở "Cấu hình cột hiển thị". Đổi cột theo
  // đúng danh sách của Sở làm ở phần 15d
  const columns: Array<DataGridColumn<Staff>> = [
    { id: 'code', header: 'Mã', cell: (row) => row.code },
    { id: 'full_name', header: 'Họ tên', alwaysVisible: true, className: 'font-medium', cell: (row) => row.full_name },
    { id: 'department', header: 'Phòng ban', cell: (row) => row.department_name ?? '' },
    { id: 'job_title', header: 'Chức danh', cell: (row) => row.job_title_name ?? '' },
    { id: 'account', header: 'Tài khoản', cell: (row) => (row.has_account ? 'Đã liên kết' : 'Chưa có') },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: (row) => (
        <StatusBadge
          tone={row.status === 'active' ? 'success' : 'neutral'}
          label={row.status === 'active' ? 'Đang làm' : 'Đã nghỉ'}
        />
      ),
    },
    { id: 'dob', header: 'Ngày sinh', hiddenByDefault: true, cell: (row) => row.dob ?? '' },
    {
      id: 'gender',
      header: 'Giới tính',
      hiddenByDefault: true,
      cell: (row) => (row.gender === 'male' ? 'Nam' : row.gender === 'female' ? 'Nữ' : ''),
    },
    { id: 'phone', header: 'Điện thoại', hiddenByDefault: true, cell: (row) => row.phone ?? '' },
    { id: 'email', header: 'Email', hiddenByDefault: true, cell: (row) => row.email ?? '' },
    { id: 'start_date', header: 'Ngày vào làm', hiddenByDefault: true, cell: (row) => row.start_date },
    { id: 'unit', header: 'Đơn vị', hiddenByDefault: true, cell: (row) => row.unit_name },
  ];

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Hồ sơ nhân sự</h1>
        <div className="flex flex-wrap items-end gap-4">
          <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
        </div>
        {canManage && orgUnitId ? (
          <StaffForm
            key={orgUnitId}
            orgUnitId={orgUnitId}
            onCreated={async (message) => {
              await queryClient.invalidateQueries({ queryKey: ['staff'] });
              setToastMessage(message);
            }}
          />
        ) : null}
        {staff.error ? <Alert tone="danger">{messageOf(staff.error)}</Alert> : null}
        {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
        <DataGrid
          label="Danh sách nhân sự"
          columns={columns}
          rows={rows}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.full_name}
          getRowAriaLabel={(row) => `Nhân sự ${row.full_name}`}
          loading={Boolean(orgUnitId) && staff.isPending}
          emptyText="Chưa có hồ sơ nhân sự."
          search={{ label: 'Tìm theo tên hoặc mã', value: search, onChange: setSearch }}
          selectable
          rowActions={(row) => (
            <Button variant="text" onClick={() => setOpenId(openId === row.id ? undefined : row.id)}>
              {openId === row.id ? 'Ẩn' : 'Chi tiết'}
            </Button>
          )}
          renderRowDetail={(row) =>
            openId === row.id ? <StaffDetailPanel staffId={row.id} onChanged={setToastMessage} /> : null
          }
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
      </div>
    </AppShell>
  );
}
