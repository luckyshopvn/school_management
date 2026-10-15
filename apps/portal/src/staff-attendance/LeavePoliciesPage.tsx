import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import {
  Alert,
  Button,
  DataGrid,
  FORM_CONTROL_CLASS,
  FormBlock,
  FormRow,
  TextField,
  Toast,
  type DataGridColumn,
} from '@school-management/ui';
import { listJobTitles } from '../catalogs/catalogs-api.js';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  adjustLeaveBalance,
  createLeavePolicy,
  listLeaveBalances,
  listLeavePolicies,
  updateLeavePolicy,
  type LeaveBalance,
  type LeavePolicy,
} from './staff-attendance-api.js';

// MH-52 Quy định phép năm và số ngày phép (P08-11, BR-41, YCTD-59): phòng nhân sự gán ở Trường chính lập quy định chung toàn
// trường theo chức danh và thâm niên; phòng nhân sự đơn vị chỉnh số ngày được cấp của từng người kèm lý do. Giao diện
// chung theo Sở (DT-15 phần 15f2): lưới quy định (khóa `leave-policies`) và lưới số ngày phép (khóa `leave-balances`);
// Thêm mới và chỉnh số ngày bằng biểu mẫu theo khối có nút Ghi
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

type BalanceRow = LeaveBalance & { staff_id: string; code: string; full_name: string };

const filterClass = `mt-1 ${FORM_CONTROL_CLASS}`;

function describeRange(policy: Pick<LeavePolicy, 'seniority_from_years' | 'seniority_to_years'>): string {
  return policy.seniority_to_years === null
    ? `Từ ${policy.seniority_from_years} năm trở lên`
    : `Từ ${policy.seniority_from_years} đến dưới ${policy.seniority_to_years} năm`;
}

const POLICY_COLUMNS: Array<DataGridColumn<LeavePolicy>> = [
  { id: 'unit_name', header: 'Đơn vị của chức danh', cell: (row) => row.unit_name },
  {
    id: 'job_title_name',
    header: 'Chức danh',
    alwaysVisible: true,
    className: 'font-medium',
    cell: (row) => row.job_title_name,
  },
  { id: 'seniority', header: 'Thâm niên', cell: (row) => describeRange(row) },
  { id: 'entitled_days', header: 'Số ngày phép', cell: (row) => row.entitled_days },
  { id: 'status', header: 'Trạng thái', cell: (row) => (row.status === 'active' ? 'Đang dùng' : 'Ngừng dùng') },
];

const BALANCE_COLUMNS: Array<DataGridColumn<BalanceRow>> = [
  { id: 'code', header: 'Mã nhân sự', hiddenByDefault: true, cell: (row) => row.code },
  { id: 'full_name', header: 'Nhân sự', alwaysVisible: true, className: 'font-medium', cell: (row) => row.full_name },
  { id: 'entitled_days', header: 'Được cấp', cell: (row) => row.entitled_days ?? '' },
  { id: 'used_days', header: 'Đã nghỉ', cell: (row) => row.used_days },
  { id: 'remaining_days', header: 'Còn lại', cell: (row) => row.remaining_days ?? '' },
  {
    id: 'note',
    header: 'Ghi chú',
    cell: (row) =>
      row.policy_missing
        ? 'Chưa có quy định phù hợp'
        : row.granted
          ? (row.adjust_reason ?? '')
          : 'Chưa cấp, tính theo quy định',
  },
];

function PolicyForm({ onSaved, onCancel }: { onSaved(message: string): void; onCancel(): void }) {
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const jobTitles = useQuery({
    queryKey: ['job-titles', orgUnitId],
    queryFn: () => listJobTitles(orgUnitId ?? ''),
    enabled: Boolean(orgUnitId),
  });
  const [jobTitleId, setJobTitleId] = useState('');
  const [from, setFrom] = useState('0');
  const [to, setTo] = useState('');
  const [days, setDays] = useState('');
  const save = useMutation({
    mutationFn: () =>
      createLeavePolicy({
        job_title_id: jobTitleId,
        seniority_from_years: Number(from),
        seniority_to_years: to === '' ? null : Number(to),
        entitled_days: Number(days),
      }),
    onSuccess: () => onSaved('Đã thêm quy định phép năm'),
  });
  return (
    <form
      className="flex flex-col gap-3"
      aria-label="Thêm quy định phép năm"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title="Thêm quy định phép năm">
        <FormRow label="Đơn vị">
          <select
            className={FORM_CONTROL_CLASS}
            value={orgUnitId ?? ''}
            onChange={(event) => unitChoice.select(event.target.value)}
          >
            {unitChoice.units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Chức danh">
          <select
            className={FORM_CONTROL_CLASS}
            value={jobTitleId}
            onChange={(event) => setJobTitleId(event.target.value)}
          >
            <option value="">Chọn chức danh</option>
            {(jobTitles.data ?? [])
              .filter((jobTitle) => jobTitle.status === 'active')
              .map((jobTitle) => (
                <option key={jobTitle.id} value={jobTitle.id}>
                  {jobTitle.name}
                </option>
              ))}
          </select>
        </FormRow>
        <FormRow label="Thâm niên từ (năm)">
          <input
            type="number"
            className={FORM_CONTROL_CLASS}
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </FormRow>
        <FormRow label="Đến dưới (năm, để trống là trở lên)">
          <input
            type="number"
            className={FORM_CONTROL_CLASS}
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </FormRow>
        <FormRow label="Số ngày phép">
          <input
            type="number"
            className={FORM_CONTROL_CLASS}
            value={days}
            onChange={(event) => setDays(event.target.value)}
          />
        </FormRow>
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

function PolicyActions({ policy, onChanged }: { policy: LeavePolicy; onChanged(message: string): void }) {
  const toggle = useMutation({
    mutationFn: () =>
      updateLeavePolicy(policy.id, {
        job_title_id: policy.job_title_id,
        seniority_from_years: policy.seniority_from_years,
        seniority_to_years: policy.seniority_to_years,
        entitled_days: policy.entitled_days,
        status: policy.status === 'active' ? 'inactive' : 'active',
      }),
    onSuccess: () => onChanged('Đã cập nhật quy định'),
  });
  return (
    <span className="flex flex-col items-end gap-1">
      <Button variant="text" disabled={toggle.isPending} onClick={() => toggle.mutate()}>
        {policy.status === 'active' ? 'Ngừng dùng' : 'Dùng lại'}
      </Button>
      {toggle.error ? <span className="text-label text-danger">{messageOf(toggle.error)}</span> : null}
    </span>
  );
}

// Chỉnh số ngày được cấp của một nhân sự trong năm, mở ngay dưới dòng của người đó
function AdjustForm({
  row,
  year,
  onSaved,
  onCancel,
}: {
  row: BalanceRow;
  year: number;
  onSaved(): void;
  onCancel(): void;
}) {
  const [days, setDays] = useState(row.entitled_days === null ? '' : String(row.entitled_days));
  const [reason, setReason] = useState('');
  const adjust = useMutation({
    mutationFn: () => adjustLeaveBalance({ staff_id: row.staff_id, year, entitled_days: Number(days), reason }),
    onSuccess: onSaved,
  });
  return (
    <form
      className="flex flex-col gap-3"
      aria-label={`Chỉnh số ngày phép của ${row.full_name}`}
      onSubmit={(event) => {
        event.preventDefault();
        adjust.mutate();
      }}
    >
      {adjust.error ? <Alert tone="danger">{messageOf(adjust.error)}</Alert> : null}
      <FormBlock title={`Chỉnh số ngày phép năm ${year} của ${row.full_name}`}>
        <FormRow label="Số ngày được cấp">
          <input
            type="number"
            className={FORM_CONTROL_CLASS}
            value={days}
            onChange={(event) => setDays(event.target.value)}
          />
        </FormRow>
        <FormRow label="Lý do chỉnh">
          <input className={FORM_CONTROL_CLASS} value={reason} onChange={(event) => setReason(event.target.value)} />
        </FormRow>
      </FormBlock>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={adjust.isPending}>
          Ghi
        </Button>
        <Button variant="text" onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </form>
  );
}

function BalancesSection({ canAdjust, onChanged }: { canAdjust: boolean; onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const grid = useGridSettings('leave-balances');
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string>();
  const balances = useQuery({
    queryKey: ['leave-balances', orgUnitId, year],
    queryFn: () => listLeaveBalances(orgUnitId ?? '', year),
    enabled: Boolean(orgUnitId),
  });
  const keyword = search.trim().toLocaleLowerCase('vi');
  const rows = (balances.data ?? []).filter(
    (row) =>
      keyword === '' ||
      row.full_name.toLocaleLowerCase('vi').includes(keyword) ||
      row.code.toLocaleLowerCase('vi').includes(keyword),
  );

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-section-title font-semibold text-text">Số ngày phép năm</h2>
      <div className="flex flex-wrap items-end gap-4">
        <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
        <div className="w-32">
          <TextField
            label="Năm"
            type="number"
            value={String(year)}
            onChange={(event) => setYear(Number(event.target.value))}
          />
        </div>
      </div>
      {balances.error ? <Alert tone="danger">{messageOf(balances.error)}</Alert> : null}
      {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
      <DataGrid
        label="Số ngày phép năm"
        columns={BALANCE_COLUMNS}
        rows={rows}
        getRowId={(row) => row.staff_id}
        getRowLabel={(row) => row.full_name}
        getRowAriaLabel={(row) => `Phép năm của ${row.full_name}`}
        loading={Boolean(orgUnitId) && balances.isPending}
        emptyText="Đơn vị chưa có nhân sự."
        search={{ label: 'Tìm theo tên, mã nhân sự', value: search, onChange: setSearch }}
        rowActions={
          canAdjust
            ? (row) => (
                <Button
                  variant="text"
                  onClick={() => setEditingId(editingId === row.staff_id ? undefined : row.staff_id)}
                >
                  Chỉnh số ngày
                </Button>
              )
            : undefined
        }
        activeRowId={editingId}
        renderRowDetail={(row) =>
          editingId === row.staff_id ? (
            <AdjustForm
              key={`${row.staff_id}-${year}`}
              row={row}
              year={year}
              onCancel={() => setEditingId(undefined)}
              onSaved={async () => {
                setEditingId(undefined);
                await queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
                onChanged('Đã chỉnh số ngày phép');
              }}
            />
          ) : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </div>
  );
}

export function LeavePoliciesPage() {
  const canManagePolicies = useHasPermission(PERMISSION_CODES.leavePolicyManage);
  const canAdjust = useHasPermission(PERMISSION_CODES.staffAttendanceManage);
  const canApprove = useHasPermission(PERMISSION_CODES.leaveApprove);
  const canView = useHasPermission(PERMISSION_CODES.staffAttendanceView);
  const queryClient = useQueryClient();
  const grid = useGridSettings('leave-policies');
  const policies = useQuery({ queryKey: ['leave-policies'], queryFn: listLeavePolicies });
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<LeavePolicy['status'] | ''>('');
  const [creating, setCreating] = useState(false);
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['leave-policies'] });
    await queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
    setToastMessage(message);
  };
  const keyword = search.trim().toLocaleLowerCase('vi');
  const rows = (policies.data ?? []).filter(
    (policy) =>
      (status === '' || policy.status === status) &&
      (keyword === '' || policy.job_title_name.toLocaleLowerCase('vi').includes(keyword)),
  );

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/leave-policies')}</h1>
        <p className="text-content text-text-secondary">
          Phép năm tính theo năm dương lịch. Thâm niên tính bằng năm tròn từ ngày vào làm đến ngày 1 tháng 1 của năm đó.
        </p>
        <div className="flex flex-col gap-3">
          <h2 className="text-section-title font-semibold text-text">Quy định theo chức danh và thâm niên</h2>
          {creating ? (
            <section className="rounded-xl border border-border bg-card p-4">
              <PolicyForm
                onCancel={() => setCreating(false)}
                onSaved={(message) => {
                  setCreating(false);
                  void refresh(message);
                }}
              />
            </section>
          ) : null}
          {policies.error ? <Alert tone="danger">{messageOf(policies.error)}</Alert> : null}
          {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
          <DataGrid
            label="Quy định theo chức danh"
            columns={POLICY_COLUMNS}
            rows={rows}
            getRowId={(row) => row.id}
            getRowLabel={(row) => `quy định ${row.job_title_name} ${describeRange(row)}`}
            getRowAriaLabel={(row) => `Quy định ${row.job_title_name} ${describeRange(row)}`}
            loading={policies.isPending}
            emptyText="Chưa có quy định phép năm."
            search={{ label: 'Tìm theo chức danh', value: search, onChange: setSearch }}
            advancedSearch={
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="text-label font-medium text-text">
                  Trạng thái
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value as LeavePolicy['status'] | '')}
                    className={filterClass}
                  >
                    <option value="">Tất cả</option>
                    <option value="active">Đang dùng</option>
                    <option value="inactive">Ngừng dùng</option>
                  </select>
                </label>
              </div>
            }
            toolbar={
              canManagePolicies ? (
                <Button variant="primary" onClick={() => setCreating(true)}>
                  Thêm mới
                </Button>
              ) : null
            }
            rowActions={canManagePolicies ? (row) => <PolicyActions policy={row} onChanged={refresh} /> : undefined}
            settings={grid.settings}
            onSettingsChange={grid.update}
          />
        </div>
        {canView || canApprove ? <BalancesSection canAdjust={canAdjust} onChanged={setToastMessage} /> : null}
      </div>
    </AppShell>
  );
}
