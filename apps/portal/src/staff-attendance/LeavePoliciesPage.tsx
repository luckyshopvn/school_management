import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, TextField, Toast } from '@school-management/ui';
import { listJobTitles } from '../catalogs/catalogs-api.js';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  adjustLeaveBalance,
  createLeavePolicy,
  listLeaveBalances,
  listLeavePolicies,
  updateLeavePolicy,
  type LeavePolicy,
} from './staff-attendance-api.js';

// MH-52 Quy định phép năm và số ngày phép (P08-11, BR-41, YCTD-59): phòng nhân sự gán ở Trường chính lập quy định chung toàn
// trường theo chức danh và thâm niên; phòng nhân sự đơn vị chỉnh số ngày được cấp của từng người kèm lý do
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const selectClass = 'mt-2 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';

function describeRange(policy: Pick<LeavePolicy, 'seniority_from_years' | 'seniority_to_years'>): string {
  return policy.seniority_to_years === null
    ? `Từ ${policy.seniority_from_years} năm trở lên`
    : `Từ ${policy.seniority_from_years} đến dưới ${policy.seniority_to_years} năm`;
}

function PolicyForm({ onSaved }: { onSaved(message: string): void }) {
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
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
        <label className="text-label font-medium text-text">
          Chức danh
          <select value={jobTitleId} onChange={(event) => setJobTitleId(event.target.value)} className={selectClass}>
            <option value="">Chọn chức danh</option>
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
          label="Thâm niên từ (năm)"
          type="number"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
        <TextField
          label="Đến dưới (năm, để trống là trở lên)"
          type="number"
          value={to}
          onChange={(event) => setTo(event.target.value)}
        />
        <TextField label="Số ngày phép" type="number" value={days} onChange={(event) => setDays(event.target.value)} />
      </div>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <div>
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Thêm quy định
        </Button>
      </div>
    </form>
  );
}

function PolicyRow({
  policy,
  canManage,
  onChanged,
}: {
  policy: LeavePolicy;
  canManage: boolean;
  onChanged(message: string): void;
}) {
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
    <tr className="border-t border-border" aria-label={`Quy định ${policy.job_title_name} ${describeRange(policy)}`}>
      <td className="px-3 py-2">{policy.unit_name}</td>
      <td className="px-3 py-2 font-medium">{policy.job_title_name}</td>
      <td className="px-3 py-2">{describeRange(policy)}</td>
      <td className="px-3 py-2">{policy.entitled_days}</td>
      <td className="px-3 py-2">{policy.status === 'active' ? 'Đang dùng' : 'Ngừng dùng'}</td>
      <td className="px-3 py-2 text-right">
        {canManage ? (
          <Button variant="text" disabled={toggle.isPending} onClick={() => toggle.mutate()}>
            {policy.status === 'active' ? 'Ngừng dùng' : 'Dùng lại'}
          </Button>
        ) : null}
        {toggle.error ? <p className="text-label text-danger">{messageOf(toggle.error)}</p> : null}
      </td>
    </tr>
  );
}

function BalancesSection({ canAdjust, onChanged }: { canAdjust: boolean; onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const [year, setYear] = useState(() => new Date().getFullYear());
  const balances = useQuery({
    queryKey: ['leave-balances', orgUnitId, year],
    queryFn: () => listLeaveBalances(orgUnitId ?? '', year),
    enabled: Boolean(orgUnitId),
  });
  const [staffId, setStaffId] = useState('');
  const [days, setDays] = useState('');
  const [reason, setReason] = useState('');
  const adjust = useMutation({
    mutationFn: () => adjustLeaveBalance({ staff_id: staffId, year, entitled_days: Number(days), reason }),
    onSuccess: async () => {
      setReason('');
      await queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      onChanged('Đã chỉnh số ngày phép');
    },
  });
  const rows = balances.data ?? [];

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label="Số ngày phép năm">
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
      {canAdjust && rows.length > 0 ? (
        <form
          className="grid grid-cols-1 items-end gap-3 md:grid-cols-4"
          aria-label="Chỉnh số ngày phép"
          onSubmit={(event) => {
            event.preventDefault();
            adjust.mutate();
          }}
        >
          <label className="text-label font-medium text-text">
            Nhân sự
            <select value={staffId} onChange={(event) => setStaffId(event.target.value)} className={selectClass}>
              <option value="">Chọn nhân sự</option>
              {rows.map((row) => (
                <option key={row.staff_id} value={row.staff_id}>
                  {row.code} – {row.full_name}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="Số ngày được cấp"
            type="number"
            value={days}
            onChange={(event) => setDays(event.target.value)}
          />
          <TextField label="Lý do chỉnh" value={reason} onChange={(event) => setReason(event.target.value)} />
          <div>
            <Button type="submit" variant="primary" disabled={adjust.isPending}>
              Chỉnh số ngày
            </Button>
          </div>
        </form>
      ) : null}
      {adjust.error ? <Alert tone="danger">{messageOf(adjust.error)}</Alert> : null}
      {rows.length > 0 ? (
        <table className="w-full text-content">
          <thead className="text-left text-label font-medium text-text-secondary">
            <tr>
              <th className="px-3 py-2">Nhân sự</th>
              <th className="px-3 py-2">Được cấp</th>
              <th className="px-3 py-2">Đã nghỉ</th>
              <th className="px-3 py-2">Còn lại</th>
              <th className="px-3 py-2">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.staff_id} className="border-t border-border" aria-label={`Phép năm của ${row.full_name}`}>
                <td className="px-3 py-2 font-medium">{row.full_name}</td>
                <td className="px-3 py-2">{row.entitled_days ?? ''}</td>
                <td className="px-3 py-2">{row.used_days}</td>
                <td className="px-3 py-2">{row.remaining_days ?? ''}</td>
                <td className="px-3 py-2">
                  {row.policy_missing
                    ? 'Chưa có quy định phù hợp'
                    : row.granted
                      ? (row.adjust_reason ?? '')
                      : 'Chưa cấp, tính theo quy định'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}

export function LeavePoliciesPage() {
  const canManagePolicies = useHasPermission(PERMISSION_CODES.leavePolicyManage);
  const canAdjust = useHasPermission(PERMISSION_CODES.staffAttendanceManage);
  const canApprove = useHasPermission(PERMISSION_CODES.leaveApprove);
  const canView = useHasPermission(PERMISSION_CODES.staffAttendanceView);
  const queryClient = useQueryClient();
  const policies = useQuery({ queryKey: ['leave-policies'], queryFn: listLeavePolicies });
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['leave-policies'] });
    await queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
    setToastMessage(message);
  };
  const rows = policies.data ?? [];

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Quy định phép năm</h1>
        <p className="text-content text-text-secondary">
          Phép năm tính theo năm dương lịch. Thâm niên tính bằng năm tròn từ ngày vào làm đến ngày 1 tháng 1 của năm đó.
        </p>
        <section
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
          aria-label="Quy định theo chức danh"
        >
          <h2 className="text-section-title font-semibold text-text">Quy định theo chức danh và thâm niên</h2>
          {canManagePolicies ? <PolicyForm onSaved={refresh} /> : null}
          {policies.error ? <Alert tone="danger">{messageOf(policies.error)}</Alert> : null}
          {policies.data && rows.length === 0 ? (
            <p className="text-content text-text-secondary">Chưa có quy định phép năm.</p>
          ) : null}
          {rows.length > 0 ? (
            <table className="w-full text-content">
              <thead className="text-left text-label font-medium text-text-secondary">
                <tr>
                  <th className="px-3 py-2">Đơn vị của chức danh</th>
                  <th className="px-3 py-2">Chức danh</th>
                  <th className="px-3 py-2">Thâm niên</th>
                  <th className="px-3 py-2">Số ngày phép</th>
                  <th className="px-3 py-2">Trạng thái</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((policy) => (
                  <PolicyRow key={policy.id} policy={policy} canManage={canManagePolicies} onChanged={refresh} />
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
        {canView || canApprove ? <BalancesSection canAdjust={canAdjust} onChanged={setToastMessage} /> : null}
      </div>
    </AppShell>
  );
}
