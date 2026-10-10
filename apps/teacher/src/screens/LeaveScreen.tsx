import { useEffect, useState } from 'react';
import { Alert, ApplicationHeader, Button, TextField } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// MG-10 Đơn nghỉ phép của tôi (P08-03, BR-40, BR-41, YCTD-59): xem số ngày phép năm còn lại, gửi đơn, hủy đơn còn chờ
// duyệt. Ngày đầu hoặc ngày cuối chọn được nửa ngày; số ngày do máy chủ tính theo ngày làm việc
interface LeaveRequest {
  id: string;
  leave_type_name: string;
  from_date: string;
  to_date: string;
  days: number | string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reject_reason: string | null;
}

interface MyLeave {
  balance: { year: number; policy_missing: boolean; remaining_days: number | null; entitled_days: number | null };
  requests: LeaveRequest[];
}

const STATUS_LABELS: Record<LeaveRequest['status'], string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Bị từ chối',
  cancelled: 'Đã hủy',
};
const selectClass = 'mt-2 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ';
}

export function LeaveScreen({ onBack }: { onBack(): void }) {
  const [mine, setMine] = useState<MyLeave>();
  const [leaveTypes, setLeaveTypes] = useState<Array<{ id: string; name: string; status: string }>>([]);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [firstHalf, setFirstHalf] = useState('');
  const [reason, setReason] = useState('');

  const load = () =>
    requestJson<MyLeave>('/api/v1/me/leave-requests')
      .then(setMine)
      .catch((error: unknown) => setErrorMessage(messageOf(error)));

  useEffect(() => {
    void load();
    requestJson<Array<{ id: string; name: string; status: string }>>('/api/v1/catalog-items?catalog_type=leave_type')
      .then((items) => setLeaveTypes(items.filter((item) => item.status === 'active')))
      .catch(() => setLeaveTypes([]));
  }, []);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setErrorMessage(undefined);
    try {
      await action();
      await load();
    } catch (error) {
      setErrorMessage(messageOf(error));
    } finally {
      setBusy(false);
    }
  };

  const singleDay = !toDate || toDate === fromDate;
  const submit = () =>
    run(async () => {
      await requestJson('/api/v1/leave-requests', {
        method: 'POST',
        body: JSON.stringify({
          leave_type_id: leaveTypeId,
          from_date: fromDate,
          to_date: toDate || fromDate,
          first_day_half: firstHalf || null,
          last_day_half: null,
          reason,
        }),
      });
      setReason('');
    });
  const balance = mine?.balance;

  return (
    <div className="min-h-screen">
      <ApplicationHeader title="Đơn nghỉ phép" />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
        <div>
          <Button variant="text" onClick={onBack}>
            Quay lại
          </Button>
        </div>
        {balance ? (
          <p className="text-content text-text">
            {balance.policy_missing
              ? `Năm ${balance.year} chưa có quy định phép năm cho bạn.`
              : `Phép năm ${balance.year} còn ${balance.remaining_days ?? 0} ngày.`}
          </p>
        ) : null}
        {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
        <form
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
          aria-label="Gửi đơn nghỉ"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label className="text-label font-medium text-text">
            Loại nghỉ
            <select
              value={leaveTypeId}
              onChange={(event) => setLeaveTypeId(event.target.value)}
              className={selectClass}
            >
              <option value="">Chọn loại nghỉ</option>
              {leaveTypes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="Từ ngày"
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
          <TextField label="Đến ngày" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          <label className="text-label font-medium text-text">
            {singleDay ? 'Buổi nghỉ' : 'Ngày đầu'}
            <select value={firstHalf} onChange={(event) => setFirstHalf(event.target.value)} className={selectClass}>
              <option value="">Cả ngày</option>
              {singleDay ? <option value="morning">Buổi sáng</option> : null}
              <option value="afternoon">Buổi chiều</option>
            </select>
          </label>
          <TextField label="Lý do nghỉ" value={reason} onChange={(event) => setReason(event.target.value)} />
          <Button type="submit" variant="primary" disabled={busy}>
            Gửi đơn nghỉ
          </Button>
        </form>
        <ul className="flex flex-col gap-2" aria-label="Đơn nghỉ của tôi">
          {(mine?.requests ?? []).map((request) => (
            <li key={request.id} className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
              <span className="text-content font-semibold">
                {request.leave_type_name}: {request.from_date}
                {request.to_date === request.from_date ? '' : ` đến ${request.to_date}`} ({Number(request.days)} ngày)
              </span>
              <span className="text-label text-text-secondary">
                {STATUS_LABELS[request.status]}
                {request.reject_reason ? `: ${request.reject_reason}` : ''}
              </span>
              {request.status === 'pending' ? (
                <Button
                  disabled={busy}
                  onClick={() =>
                    void run(() => requestJson(`/api/v1/leave-requests/${request.id}/cancel`, { method: 'POST' }))
                  }
                >
                  Hủy đơn
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
