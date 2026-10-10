import { Fragment, useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, StatusBadge, TextField, Toast } from '@school-management/ui';
import { listDepartments, listJobTitles } from '../catalogs/catalogs-api.js';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { createStaff, listStaff } from './staff-api.js';
import { StaffDetailPanel } from './StaffDetailPanel.js';

// MH-12 Hồ sơ nhân sự và hợp đồng (P07-01, P07-02, P07-04; BR-37, BR-38; YCTD-58): danh sách theo đơn vị, tìm theo tên
// hoặc mã; phòng nhân sự tạo hồ sơ, liên kết tài khoản, lập và chấm dứt hợp đồng
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

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Hồ sơ nhân sự</h1>
        <div className="flex flex-wrap items-end gap-4">
          <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
          <div className="w-64">
            <TextField
              label="Tìm theo tên hoặc mã"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
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
        <section
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
          aria-label="Danh sách nhân sự"
        >
          {staff.data && rows.length === 0 ? (
            <p className="text-content text-text-secondary">Chưa có hồ sơ nhân sự.</p>
          ) : null}
          {rows.length > 0 ? (
            <table className="w-full text-content">
              <thead className="text-left text-label font-medium text-text-secondary">
                <tr>
                  <th className="px-3 py-2">Mã</th>
                  <th className="px-3 py-2">Họ tên</th>
                  <th className="px-3 py-2">Phòng ban</th>
                  <th className="px-3 py-2">Chức danh</th>
                  <th className="px-3 py-2">Tài khoản</th>
                  <th className="px-3 py-2">Trạng thái</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <Fragment key={row.id}>
                    <tr className="border-t border-border" aria-label={`Nhân sự ${row.full_name}`}>
                      <td className="px-3 py-2">{row.code}</td>
                      <td className="px-3 py-2 font-medium">{row.full_name}</td>
                      <td className="px-3 py-2">{row.department_name ?? ''}</td>
                      <td className="px-3 py-2">{row.job_title_name ?? ''}</td>
                      <td className="px-3 py-2">{row.has_account ? 'Đã liên kết' : 'Chưa có'}</td>
                      <td className="px-3 py-2">
                        <StatusBadge
                          tone={row.status === 'active' ? 'success' : 'neutral'}
                          label={row.status === 'active' ? 'Đang làm' : 'Đã nghỉ'}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button variant="text" onClick={() => setOpenId(openId === row.id ? undefined : row.id)}>
                          {openId === row.id ? 'Ẩn' : 'Chi tiết'}
                        </Button>
                      </td>
                    </tr>
                    {openId === row.id ? (
                      <tr>
                        <td colSpan={7} className="px-3 pb-3">
                          <StaffDetailPanel staffId={row.id} onChanged={setToastMessage} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
