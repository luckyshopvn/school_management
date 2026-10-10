import { useEffect, useState } from 'react';
import { Alert, Button } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// MG-10 Chấm công hôm nay (P08-01, YCTD-59): nhân sự có hồ sơ liên kết tài khoản bấm vào ca, ra ca; giờ lấy theo máy
// chủ nên cần có mạng, không lưu tạm khi mất mạng. Tài khoản chưa gắn hồ sơ nhân sự thì không hiện thẻ này
interface TodayAttendance {
  today: string;
  staff: { status: 'active' | 'terminated' };
  today_log: { check_in: string; check_out: string | null } | null;
}

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, cần có mạng để chấm công';
}

export function CheckInCard() {
  const [attendance, setAttendance] = useState<TodayAttendance | null>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()).slice(0, 7);
    requestJson<TodayAttendance>(`/api/v1/me/attendance-logs?month=${month}`)
      .then(setAttendance)
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 404) {
          setAttendance(null);
          return;
        }
        setErrorMessage(messageOf(error));
      });
  }, []);

  const press = async (path: 'check-in' | 'check-out') => {
    setBusy(true);
    setErrorMessage(undefined);
    try {
      setAttendance(await requestJson<TodayAttendance>(`/api/v1/me/attendance-logs/${path}`, { method: 'POST' }));
    } catch (error) {
      setErrorMessage(messageOf(error));
    } finally {
      setBusy(false);
    }
  };

  if (attendance === null) {
    return null;
  }
  const log = attendance?.today_log ?? null;
  const active = attendance?.staff.status === 'active';
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label="Chấm công hôm nay">
      <h2 className="text-section-title font-semibold text-text">Chấm công hôm nay</h2>
      {attendance ? (
        <p className="text-content text-text">
          {log ? `Vào ca ${log.check_in}${log.check_out ? `, ra ca ${log.check_out}` : ', chưa ra ca'}` : 'Chưa vào ca'}
        </p>
      ) : null}
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      <div className="flex gap-3">
        <Button
          variant="primary"
          disabled={busy || !attendance || Boolean(log) || !active}
          onClick={() => void press('check-in')}
        >
          Vào ca
        </Button>
        <Button disabled={busy || !log || !active} onClick={() => void press('check-out')}>
          Ra ca
        </Button>
      </div>
    </section>
  );
}
