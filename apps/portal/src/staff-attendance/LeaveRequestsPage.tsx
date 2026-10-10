import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, StatusBadge, TextField, Toast, type StatusTone } from '@school-management/ui';
import { listCatalogItems } from '../catalogs/catalogs-api.js';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { listStaff } from '../staff/staff-api.js';
import {
  approveLeaveRequest,
  cancelLeaveRequest,
  createLeaveRequest,
  describeLeaveDates,
  LEAVE_STATUS_LABELS,
  listLeaveRequests,
  readMyLeave,
  rejectLeaveRequest,
  type DayHalf,
  type LeaveRequest,
  type LeaveRequestStatus,
} from './staff-attendance-api.js';

// MH-44 và MH-13 Đơn nghỉ phép (P08-03, BR-40, BR-41, YCTD-59): nhân sự tự gửi đơn, xem số ngày phép năm còn lại;
// phòng nhân sự lập hộ; Hiệu trưởng, Phó Hiệu trưởng duyệt hoặc từ chối đơn của đơn vị
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const selectClass = 'mt-2 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
const STATUS_TONES: Record<LeaveRequestStatus, StatusTone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
};

function LeaveForm({
  label,
  staffOptions,
  onSaved,
}: {
  label: string;
  staffOptions?: Array<{ id: string; label: string }>;
  onSaved(message: string): void;
}) {
  const leaveTypes = useQuery({
    queryKey: ['catalog-items', 'leave_type'],
    queryFn: () => listCatalogItems('leave_type'),
  });
  const [staffId, setStaffId] = useState('');
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [firstHalf, setFirstHalf] = useState('');
  const [lastHalf, setLastHalf] = useState('');
  const [reason, setReason] = useState('');
  const singleDay = !toDate || toDate === fromDate;
  const save = useMutation({
    mutationFn: () =>
      createLeaveRequest({
        ...(staffOptions ? { staff_id: staffId } : {}),
        leave_type_id: leaveTypeId,
        from_date: fromDate,
        to_date: toDate || fromDate,
        first_day_half: (firstHalf || null) as DayHalf | null,
        last_day_half: singleDay ? null : ((lastHalf || null) as DayHalf | null),
        reason,
      }),
    onSuccess: (request) => {
      setReason('');
      onSaved(`Đã gửi đơn nghỉ ${request.days} ngày`);
    },
  });

  return (
    <form
      className="flex flex-col gap-3"
      aria-label={label}
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {staffOptions ? (
          <label className="text-label font-medium text-text">
            Nhân sự nghỉ
            <select value={staffId} onChange={(event) => setStaffId(event.target.value)} className={selectClass}>
              <option value="">Chọn nhân sự</option>
              {staffOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="text-label font-medium text-text">
          Loại nghỉ
          <select value={leaveTypeId} onChange={(event) => setLeaveTypeId(event.target.value)} className={selectClass}>
            <option value="">Chọn loại nghỉ</option>
            {(leaveTypes.data ?? [])
              .filter((item) => item.status === 'active')
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
          </select>
        </label>
        <TextField label="Từ ngày" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
        <TextField label="Đến ngày" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        <label className="text-label font-medium text-text">
          {singleDay ? 'Buổi nghỉ' : 'Ngày đầu'}
          <select value={firstHalf} onChange={(event) => setFirstHalf(event.target.value)} className={selectClass}>
            <option value="">Cả ngày</option>
            {singleDay ? <option value="morning">Buổi sáng</option> : null}
            <option value="afternoon">Buổi chiều</option>
          </select>
        </label>
        {singleDay ? null : (
          <label className="text-label font-medium text-text">
            Ngày cuối
            <select value={lastHalf} onChange={(event) => setLastHalf(event.target.value)} className={selectClass}>
              <option value="">Cả ngày</option>
              <option value="morning">Buổi sáng</option>
            </select>
          </label>
        )}
        <TextField label="Lý do nghỉ" value={reason} onChange={(event) => setReason(event.target.value)} />
      </div>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <div>
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Gửi đơn nghỉ
        </Button>
      </div>
    </form>
  );
}

function RequestRow({
  request,
  showStaff,
  canApprove,
  canCancel,
  onChanged,
}: {
  request: LeaveRequest;
  showStaff: boolean;
  canApprove: boolean;
  canCancel: boolean;
  onChanged(message: string): void;
}) {
  const [rejectReason, setRejectReason] = useState('');
  const approve = useMutation({
    mutationFn: () => approveLeaveRequest(request.id),
    onSuccess: () => onChanged('Đã duyệt đơn nghỉ'),
  });
  const reject = useMutation({
    mutationFn: () => rejectLeaveRequest(request.id, rejectReason),
    onSuccess: () => onChanged('Đã từ chối đơn nghỉ'),
  });
  const cancel = useMutation({
    mutationFn: () => cancelLeaveRequest(request.id),
    onSuccess: () => onChanged('Đã hủy đơn nghỉ'),
  });
  const pending = request.status === 'pending';
  const error = approve.error ?? reject.error ?? cancel.error;

  return (
    <tr
      className="border-t border-border align-top"
      aria-label={`Đơn nghỉ của ${request.full_name} ${request.from_date}`}
    >
      {showStaff ? <td className="px-3 py-2 font-medium">{request.full_name}</td> : null}
      <td className="px-3 py-2">{request.leave_type_name}</td>
      <td className="px-3 py-2">{describeLeaveDates(request)}</td>
      <td className="px-3 py-2">{Number(request.days)}</td>
      <td className="px-3 py-2">{request.reason}</td>
      <td className="px-3 py-2">
        <StatusBadge tone={STATUS_TONES[request.status]} label={LEAVE_STATUS_LABELS[request.status]} />
        {request.reject_reason ? <p className="text-label text-text-secondary">{request.reject_reason}</p> : null}
      </td>
      <td className="px-3 py-2">
        {pending ? (
          <div className="flex flex-col items-end gap-2">
            {canApprove ? (
              <>
                <Button variant="primary" disabled={approve.isPending} onClick={() => approve.mutate()}>
                  Duyệt
                </Button>
                <TextField
                  label="Lý do từ chối"
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                />
                <Button variant="danger" disabled={reject.isPending} onClick={() => reject.mutate()}>
                  Từ chối
                </Button>
              </>
            ) : null}
            {canCancel ? (
              <Button variant="text" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
                Hủy đơn
              </Button>
            ) : null}
          </div>
        ) : null}
        {error ? <p className="text-label text-danger">{messageOf(error)}</p> : null}
      </td>
    </tr>
  );
}

function RequestTable({
  requests,
  showStaff,
  canApprove,
  canCancel,
  onChanged,
}: {
  requests: LeaveRequest[];
  showStaff: boolean;
  canApprove: boolean;
  canCancel: boolean;
  onChanged(message: string): void;
}) {
  if (requests.length === 0) {
    return <p className="text-content text-text-secondary">Chưa có đơn nghỉ.</p>;
  }
  return (
    <table className="w-full text-content">
      <thead className="text-left text-label font-medium text-text-secondary">
        <tr>
          {showStaff ? <th className="px-3 py-2">Nhân sự</th> : null}
          <th className="px-3 py-2">Loại nghỉ</th>
          <th className="px-3 py-2">Thời gian</th>
          <th className="px-3 py-2">Số ngày</th>
          <th className="px-3 py-2">Lý do</th>
          <th className="px-3 py-2">Trạng thái</th>
          <th className="px-3 py-2" />
        </tr>
      </thead>
      <tbody>
        {requests.map((request) => (
          <RequestRow
            key={request.id}
            request={request}
            showStaff={showStaff}
            canApprove={canApprove}
            canCancel={canCancel}
            onChanged={onChanged}
          />
        ))}
      </tbody>
    </table>
  );
}

function MyLeaveSection({ onChanged }: { onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const mine = useQuery({ queryKey: ['my-leave'], queryFn: readMyLeave, retry: false });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['my-leave'] });
    await queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
    onChanged(message);
  };
  if (mine.error instanceof ApiError && mine.error.status === 404) {
    return null;
  }
  const balance = mine.data?.balance;
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label="Đơn nghỉ của tôi">
      <h2 className="text-section-title font-semibold text-text">Đơn nghỉ của tôi</h2>
      {mine.error ? <Alert tone="danger">{messageOf(mine.error)}</Alert> : null}
      {balance ? (
        <p className="text-content text-text">
          {balance.policy_missing
            ? `Năm ${balance.year} chưa có quy định phép năm cho bạn.`
            : `Phép năm ${balance.year}: được ${balance.entitled_days ?? 0} ngày, đã nghỉ ${balance.used_days}, còn ${balance.remaining_days ?? 0} ngày.`}
        </p>
      ) : null}
      <LeaveForm label="Gửi đơn nghỉ của tôi" onSaved={refresh} />
      {mine.data ? (
        <RequestTable
          requests={mine.data.requests}
          showStaff={false}
          canApprove={false}
          canCancel
          onChanged={refresh}
        />
      ) : null}
    </section>
  );
}

function UnitLeaveSection({ onChanged }: { onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const [status, setStatus] = useState<LeaveRequestStatus | ''>('pending');
  const requests = useQuery({
    queryKey: ['leave-requests', orgUnitId, status],
    queryFn: () => listLeaveRequests(orgUnitId ?? '', status),
    enabled: Boolean(orgUnitId),
  });
  const canManage = requests.data?.can_manage ?? false;
  const staff = useQuery({
    queryKey: ['staff', orgUnitId, ''],
    queryFn: () => listStaff(orgUnitId ?? '', ''),
    enabled: Boolean(orgUnitId) && canManage,
  });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
    await queryClient.invalidateQueries({ queryKey: ['my-leave'] });
    onChanged(message);
  };

  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      aria-label="Đơn nghỉ của đơn vị"
    >
      <h2 className="text-section-title font-semibold text-text">Đơn nghỉ của đơn vị</h2>
      <div className="flex flex-wrap items-end gap-4">
        <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
        <label className="text-label font-medium text-text">
          Trạng thái đơn
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as LeaveRequestStatus | '')}
            className={selectClass}
          >
            <option value="">Tất cả</option>
            {(Object.keys(LEAVE_STATUS_LABELS) as LeaveRequestStatus[]).map((value) => (
              <option key={value} value={value}>
                {LEAVE_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {requests.error ? <Alert tone="danger">{messageOf(requests.error)}</Alert> : null}
      {canManage && staff.data ? (
        <LeaveForm
          key={orgUnitId}
          label="Lập đơn nghỉ hộ"
          staffOptions={staff.data
            .filter((row) => row.status === 'active')
            .map((row) => ({ id: row.id, label: `${row.code} – ${row.full_name}` }))}
          onSaved={refresh}
        />
      ) : null}
      {requests.data ? (
        <RequestTable
          requests={requests.data.requests}
          showStaff
          canApprove={requests.data.can_approve}
          canCancel={canManage}
          onChanged={refresh}
        />
      ) : null}
    </section>
  );
}

export function LeaveRequestsPage() {
  const canApprove = useHasPermission(PERMISSION_CODES.leaveApprove);
  const canViewAttendance = useHasPermission(PERMISSION_CODES.staffAttendanceView);
  const canSeeUnit = canApprove || canViewAttendance;
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Đơn nghỉ phép</h1>
        <MyLeaveSection onChanged={setToastMessage} />
        {canSeeUnit ? <UnitLeaveSection onChanged={setToastMessage} /> : null}
      </div>
    </AppShell>
  );
}
