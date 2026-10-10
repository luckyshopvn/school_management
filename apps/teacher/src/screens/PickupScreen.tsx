import { useCallback, useEffect, useState } from 'react';
import { Alert, ApplicationHeader, Button, StatusBadge } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';
import type { MyClass } from './ClassesScreen.js';

// MG-04 Đón trả trẻ (P04-03, QT-02 bước 7, E6): chọn người đón theo danh sách; người ngoài danh sách chờ phụ huynh xác nhận
interface PickupChild {
  child_id: string;
  full_name: string;
  attendance_status: string | null;
  is_present: boolean;
  guardians: Array<{ guardian_id: string; full_name: string; relationship: string; phone: string | null }>;
  authorized_pickups: Array<{
    id: string;
    full_name: string;
    relationship: string;
    phone: string;
    is_valid_today: boolean;
  }>;
  handover: { person_name: string; relationship: string; person_kind: string; recorded_at: string } | null;
  confirmation_requests: Array<{ id: string; person_name: string; relationship: string; status: string }>;
}

interface ClassPickups {
  org_unit_id: string;
  can_hand_over: boolean;
  children: PickupChild[];
}

const OTHER_PERSON = 'other';
const REQUEST_LABELS: Record<string, { tone: 'warning' | 'success' | 'danger'; label: string }> = {
  pending: { tone: 'warning', label: 'Chờ phụ huynh xác nhận' },
  confirmed: { tone: 'success', label: 'Phụ huynh đã xác nhận' },
  refused: { tone: 'danger', label: 'Phụ huynh từ chối' },
};

function today(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ';
}

function timeOf(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }).format(
    new Date(value),
  );
}

function HandoverForm({
  child,
  orgUnitId,
  date,
  onDone,
}: {
  child: PickupChild;
  orgUnitId: string;
  date: string;
  onDone(message: { tone: 'success' | 'warning' | 'danger'; text: string }): void;
}) {
  const [choice, setChoice] = useState('');
  const [person, setPerson] = useState({ full_name: '', relationship: '', phone: '' });
  const [photo, setPhoto] = useState<File>();
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!choice) {
      onDone({ tone: 'warning', text: 'Chọn người đón' });
      return;
    }
    setBusy(true);
    try {
      let photoFileId: string | undefined;
      if (photo) {
        const form = new FormData();
        form.set('org_unit_id', orgUnitId);
        form.set('purpose', 'pickup_photo');
        form.set('file', photo);
        photoFileId = (await requestJson<{ id: string }>('/api/v1/files', { method: 'POST', body: form })).id;
      }
      const [kind, id] = choice.split(':');
      await requestJson(`/api/v1/children/${child.child_id}/pickups`, {
        method: 'POST',
        body: JSON.stringify({
          pickup_type: 'handover',
          date,
          ...(kind === 'guardian' ? { guardian_id: id } : {}),
          ...(kind === 'authorized' ? { authorized_pickup_id: id } : {}),
          ...(kind === OTHER_PERSON
            ? {
                person: {
                  full_name: person.full_name,
                  relationship: person.relationship,
                  phone: person.phone.trim() || null,
                },
              }
            : {}),
          ...(photoFileId ? { photo_file_id: photoFileId } : {}),
        }),
      });
      onDone({ tone: 'success', text: `Đã bàn giao ${child.full_name}` });
    } catch (error) {
      onDone({
        tone: error instanceof ApiError && error.code === 'ERR_RULE_VIOLATION' ? 'warning' : 'danger',
        text: messageOf(error),
      });
    } finally {
      setBusy(false);
    }
  }

  const inputClass = 'rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-label font-medium text-text">
        Người đón
        <select className={inputClass} value={choice} onChange={(event) => setChoice(event.target.value)}>
          <option value="">Chọn người đón</option>
          {child.guardians.map((guardian) => (
            <option key={guardian.guardian_id} value={`guardian:${guardian.guardian_id}`}>
              {guardian.full_name} ({guardian.relationship})
            </option>
          ))}
          {child.authorized_pickups.map((authorized) => (
            <option key={authorized.id} value={`authorized:${authorized.id}`}>
              {authorized.full_name} ({authorized.relationship}){authorized.is_valid_today ? '' : ' - hết hiệu lực'}
            </option>
          ))}
          <option value={`${OTHER_PERSON}:`}>Người khác</option>
        </select>
      </label>
      {choice.startsWith(OTHER_PERSON) ? (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-label font-medium text-text">
            Họ tên người đón
            <input
              className={inputClass}
              value={person.full_name}
              onChange={(event) => setPerson({ ...person, full_name: event.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-label font-medium text-text">
            Quan hệ với trẻ
            <input
              className={inputClass}
              value={person.relationship}
              onChange={(event) => setPerson({ ...person, relationship: event.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-label font-medium text-text">
            Số điện thoại người đón
            <input
              className={inputClass}
              inputMode="tel"
              value={person.phone}
              onChange={(event) => setPerson({ ...person, phone: event.target.value })}
            />
          </label>
        </div>
      ) : null}
      <label className="flex flex-col gap-1 text-label font-medium text-text">
        Ảnh bàn giao (không bắt buộc)
        <input
          type="file"
          accept="image/jpeg,image/png"
          capture="environment"
          onChange={(event) => setPhoto(event.target.files?.[0])}
        />
      </label>
      <Button variant="primary" disabled={busy} onClick={() => void submit()}>
        Bàn giao
      </Button>
    </div>
  );
}

export function PickupScreen({ myClass, onBack }: { myClass: MyClass; onBack(): void }) {
  // Bàn giao ghi theo thời điểm thực nên màn hình chỉ làm việc với ngày hôm nay
  const date = today();
  const [data, setData] = useState<ClassPickups>();
  const [message, setMessage] = useState<{ tone: 'success' | 'warning' | 'danger'; text: string }>();

  const load = useCallback(async () => {
    try {
      setData(await requestJson<ClassPickups>(`/api/v1/classes/${myClass.id}/pickups?date=${date}`));
    } catch (error) {
      setMessage({ tone: 'danger', text: messageOf(error) });
    }
  }, [myClass.id, date]);

  useEffect(() => {
    setMessage(undefined);
    void load();
  }, [load]);

  async function afterHandover(next: { tone: 'success' | 'warning' | 'danger'; text: string }) {
    await load();
    setMessage(next);
  }

  return (
    <div className="min-h-screen">
      <ApplicationHeader title={`Đón trả lớp ${myClass.name}`} />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
        <div className="flex items-center gap-3">
          <Button variant="text" onClick={onBack}>
            Quay lại
          </Button>
          <h1 className="text-section-title font-bold text-text">Đón trả trẻ</h1>
        </div>
        <p className="text-label text-text-secondary">Ngày {date}</p>
        {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
        <div>
          <Button onClick={() => void load()}>Tải lại</Button>
        </div>
        {data ? (
          <ul className="flex flex-col gap-2" aria-label="Danh sách đón trả">
            {data.children.map((child) => (
              <li
                key={child.child_id}
                aria-label={child.full_name}
                className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-content font-semibold">{child.full_name}</span>
                  {child.handover ? (
                    <StatusBadge tone="success" label="Đã bàn giao" />
                  ) : child.is_present ? (
                    <StatusBadge tone="info" label="Chưa bàn giao" />
                  ) : (
                    <StatusBadge tone="neutral" label="Không có mặt" />
                  )}
                </div>
                {child.handover ? (
                  <p className="text-label text-text-secondary">
                    {child.handover.person_name} ({child.handover.relationship}) đón lúc{' '}
                    {timeOf(child.handover.recorded_at)}
                    {child.handover.person_kind === 'parent_confirmed' ? ', có xác nhận của phụ huynh' : ''}
                  </p>
                ) : null}
                {child.confirmation_requests.map((request) => (
                  <div key={request.id} className="flex flex-wrap items-center gap-2 text-label">
                    <span>
                      {request.person_name} ({request.relationship})
                    </span>
                    <StatusBadge
                      tone={REQUEST_LABELS[request.status]?.tone ?? 'neutral'}
                      label={REQUEST_LABELS[request.status]?.label ?? request.status}
                    />
                  </div>
                ))}
                {!child.handover && child.is_present && data.can_hand_over ? (
                  <HandoverForm child={child} orgUnitId={data.org_unit_id} date={date} onDone={afterHandover} />
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {data && !data.can_hand_over ? (
          <p className="text-label text-text-secondary">Chỉ giáo viên chủ nhiệm của lớp được bàn giao trẻ.</p>
        ) : null}
      </main>
    </div>
  );
}
