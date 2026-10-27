import { useCallback, useEffect, useState } from 'react';
import { Alert, ApplicationHeader, Button, TextField } from '@school-management/ui';
import { ApiError, fetchWithSession, requestJson } from '../session/api-client.js';
import type { MyClass } from './ClassesScreen.js';

// MG-09 phần dặn thuốc của lớp (P10-03, P10-04; BR-49, BR-50, BR-86; YCTD-75): giáo viên chủ nhiệm xem yêu cầu dặn thuốc
// của lớp; khi đơn vị bật "không có nhân viên y tế" thì nhận thuốc, từ chối, ghi liều hoặc bỏ liều kèm lý do; khi tắt thì máy
// chủ trả lỗi không có quyền và màn hình chỉ để xem
type RequestStatus = 'pending' | 'administering' | 'completed' | 'rejected';

interface MedicationRequest {
  id: string;
  full_name: string;
  medicine_name: string;
  dosage: string;
  times: string[];
  from_date: string;
  to_date: string;
  allergy_note: string;
  note: string | null;
  medicine_photo_ids: string[];
  prescription_photo_id: string | null;
  status: RequestStatus;
}

interface ScheduleRow {
  request_id: string;
  full_name: string;
  medicine_name: string;
  dosage: string;
  scheduled_date: string;
  scheduled_time: string;
  can_administer: boolean;
  administration: {
    administered_at: string | null;
    is_skipped: boolean;
    skip_reason: string | null;
    parent_acknowledged_at: string | null;
  } | null;
}

const STATUS_LABELS: Record<RequestStatus, string> = {
  pending: 'Chờ nhận thuốc',
  administering: 'Đang cho uống',
  completed: 'Hoàn thành',
  rejected: 'Từ chối',
};

const timeOf = (value: string) =>
  new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join(': ')
    : 'Không kết nối được tới máy chủ';
}

async function openFile(fileId: string) {
  const response = await fetchWithSession(`/api/v1/files/${fileId}`);
  if (!response.ok) {
    throw new ApiError(response.status, 'ERR_FORBIDDEN', 'Không mở được ảnh');
  }
  window.open(URL.createObjectURL(await response.blob()), '_blank', 'noopener');
}

function PendingRequest({
  request,
  onMessage,
}: {
  request: MedicationRequest;
  onMessage(message: string, failed?: boolean): void;
}) {
  const [receivedQuantity, setReceivedQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const act = async (path: string, body: unknown, message: string) => {
    setBusy(true);
    try {
      await requestJson(`/api/v1/medication-requests/${request.id}/${path}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      onMessage(message);
    } catch (error) {
      onMessage(messageOf(error), true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <TextField
        label="Thuốc thực nhận"
        value={receivedQuantity}
        onChange={(event) => setReceivedQuantity(event.target.value)}
      />
      <Button
        variant="primary"
        disabled={busy}
        onClick={() =>
          void act('receive', { received_quantity: receivedQuantity || null }, `Đã nhận thuốc của ${request.full_name}`)
        }
      >
        Nhận thuốc
      </Button>
      <TextField label="Lý do từ chối" value={reason} onChange={(event) => setReason(event.target.value)} />
      <Button
        disabled={busy}
        onClick={() => void act('reject', { reason }, `Đã từ chối thuốc của ${request.full_name}`)}
      >
        Từ chối
      </Button>
    </div>
  );
}

function DoseRow({ row, onMessage }: { row: ScheduleRow; onMessage(message: string, failed?: boolean): void }) {
  const [skipReason, setSkipReason] = useState('');
  const [busy, setBusy] = useState(false);

  const record = async (skipped: boolean) => {
    setBusy(true);
    try {
      await requestJson('/api/v1/medication-administrations', {
        method: 'POST',
        body: JSON.stringify({
          request_id: row.request_id,
          scheduled_date: row.scheduled_date,
          scheduled_time: row.scheduled_time,
          is_skipped: skipped,
          skip_reason: skipped ? skipReason : null,
        }),
      });
      onMessage(skipped ? `Đã ghi bỏ liều của ${row.full_name}` : `Đã ghi liều của ${row.full_name}`);
    } catch (error) {
      onMessage(messageOf(error), true);
    } finally {
      setBusy(false);
    }
  };

  const dose = row.administration;
  return (
    <li
      className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4"
      aria-label={`Liều ${row.scheduled_time} ${row.full_name}`}
    >
      <span className="text-content font-semibold">
        {row.scheduled_time} {row.full_name}
      </span>
      <span className="text-content">
        {row.medicine_name}, {row.dosage}
      </span>
      {dose ? (
        <span className="text-content text-text-secondary">
          {dose.is_skipped
            ? `Bỏ liều: ${dose.skip_reason ?? ''}. ${dose.parent_acknowledged_at ? 'Phụ huynh đã biết' : 'Phụ huynh chưa xác nhận'}`
            : `Đã cho uống lúc ${dose.administered_at ? timeOf(dose.administered_at) : ''}`}
        </span>
      ) : row.can_administer ? (
        <>
          <Button variant="primary" disabled={busy} onClick={() => void record(false)}>
            Đã cho uống
          </Button>
          <TextField label="Lý do bỏ liều" value={skipReason} onChange={(event) => setSkipReason(event.target.value)} />
          <Button disabled={busy} onClick={() => void record(true)}>
            Bỏ liều
          </Button>
        </>
      ) : (
        <span className="text-content text-text-secondary">Y tế ghi liều</span>
      )}
    </li>
  );
}

export function MedicationScreen({ myClass, onBack }: { myClass: MyClass; onBack(): void }) {
  const [requests, setRequests] = useState<MedicationRequest[]>([]);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [notice, setNotice] = useState<{ message: string; failed: boolean }>();

  const load = useCallback(async () => {
    try {
      const [listed, today] = await Promise.all([
        requestJson<MedicationRequest[]>(`/api/v1/medication-requests?class_id=${myClass.id}`),
        requestJson<ScheduleRow[]>(`/api/v1/medication-schedules?class_id=${myClass.id}`),
      ]);
      setRequests(listed);
      setSchedule(today);
    } catch (error) {
      setNotice({ message: messageOf(error), failed: true });
    }
  }, [myClass.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onMessage = (message: string, failed = false) => {
    setNotice({ message, failed });
    void load();
  };

  const active = requests.filter((request) => request.status === 'pending' || request.status === 'administering');

  return (
    <div className="min-h-screen">
      <ApplicationHeader title="Ứng dụng giáo viên" />
      <main className="mx-auto flex max-w-md flex-col md:max-w-3xl gap-4 px-4 py-6">
        <div>
          <Button onClick={onBack}>Quay lại</Button>
        </div>
        <h1 className="text-page-title font-bold text-text">Dặn thuốc lớp {myClass.name}</h1>
        {notice ? <Alert tone={notice.failed ? 'danger' : 'success'}>{notice.message}</Alert> : null}

        <h2 className="text-section-title font-semibold text-text">Cho uống hôm nay</h2>
        {schedule.length === 0 ? (
          <p className="text-content text-text-secondary">Không có liều cần cho uống hôm nay.</p>
        ) : null}
        <ul className="flex flex-col gap-2">
          {schedule.map((row) => (
            <DoseRow key={`${row.request_id}:${row.scheduled_time}`} row={row} onMessage={onMessage} />
          ))}
        </ul>

        <h2 className="text-section-title font-semibold text-text">Yêu cầu dặn thuốc</h2>
        {active.length === 0 ? (
          <p className="text-content text-text-secondary">Chưa có yêu cầu dặn thuốc đang thực hiện.</p>
        ) : null}
        <ul className="flex flex-col gap-2">
          {active.map((request) => (
            <li
              key={request.id}
              className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-content"
              aria-label={`Dặn thuốc ${request.full_name}`}
            >
              <span className="font-semibold">{request.full_name}</span>
              <span>
                {request.medicine_name}, {request.dosage}, lúc {request.times.join(', ')}
              </span>
              <span>
                Từ {request.from_date} đến {request.to_date}. Dị ứng: {request.allergy_note}
              </span>
              {request.note ? <span>Ghi chú: {request.note}</span> : null}
              <span>{STATUS_LABELS[request.status]}</span>
              <div className="flex flex-wrap gap-2">
                {request.medicine_photo_ids.map((fileId, index) => (
                  <Button
                    key={fileId}
                    onClick={() => void openFile(fileId).catch((error: unknown) => onMessage(messageOf(error), true))}
                  >
                    Ảnh thuốc {index + 1}
                  </Button>
                ))}
                {request.prescription_photo_id ? (
                  <Button
                    onClick={() =>
                      void openFile(request.prescription_photo_id ?? '').catch((error: unknown) =>
                        onMessage(messageOf(error), true),
                      )
                    }
                  >
                    Đơn thuốc
                  </Button>
                ) : null}
              </div>
              {request.status === 'pending' ? <PendingRequest request={request} onMessage={onMessage} /> : null}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
