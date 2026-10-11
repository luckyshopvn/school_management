import { useEffect, useState } from 'react';
import { Alert, ApplicationHeader, Button, TextField } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';
import type { MyClass } from './ClassesScreen.js';

// MG-03 Nhật ký của bé theo ngày (P04-04, P04-05; BR-15; QT-09; YCTD-65): giáo viên chủ nhiệm ghi ăn, ngủ, vệ sinh, tâm
// trạng, hoạt động cho từng trẻ rồi công bố cả lớp; sửa nhật ký đã công bố phải ghi lý do
interface Journal {
  meal_note: string | null;
  sleep_note: string | null;
  hygiene_note: string | null;
  mood: string | null;
  activity_note: string | null;
  status: 'draft' | 'published';
}

interface ClassDay {
  can_write: boolean;
  children: Array<{ child_id: string; full_name: string; journal: Journal | null }>;
}

const MOODS: Array<[string, string]> = [
  ['', 'Chưa chọn'],
  ['happy', 'Vui vẻ'],
  ['normal', 'Bình thường'],
  ['tired', 'Mệt'],
  ['sad', 'Buồn'],
  ['unwell', 'Không khỏe'],
];
const selectClass = 'mt-2 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join(': ')
    : 'Không kết nối được tới máy chủ';
}

function ChildJournal({
  childId,
  fullName,
  date,
  journal,
  canWrite,
  onSaved,
}: {
  childId: string;
  fullName: string;
  date: string;
  journal: Journal | null;
  canWrite: boolean;
  onSaved(): void;
}) {
  const [values, setValues] = useState({
    meal_note: journal?.meal_note ?? '',
    sleep_note: journal?.sleep_note ?? '',
    hygiene_note: journal?.hygiene_note ?? '',
    mood: journal?.mood ?? '',
    activity_note: journal?.activity_note ?? '',
    reason: '',
  });
  const [errorMessage, setErrorMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const published = journal?.status === 'published';
  const field = (key: keyof typeof values, label: string) => (
    <TextField
      label={label}
      value={values[key]}
      onChange={(event) => setValues({ ...values, [key]: event.target.value })}
    />
  );
  const save = async () => {
    setBusy(true);
    setErrorMessage(undefined);
    try {
      await requestJson(`/api/v1/children/${childId}/journals/${date}`, {
        method: 'PUT',
        body: JSON.stringify({ ...values, mood: values.mood || null, reason: values.reason || null }),
      });
      onSaved();
    } catch (error) {
      setErrorMessage(messageOf(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4"
      aria-label={`Nhật ký của ${fullName}`}
    >
      <h2 className="text-content font-semibold">
        {fullName} — {journal ? (published ? 'Đã công bố' : 'Nháp') : 'Chưa ghi'}
      </h2>
      {canWrite ? (
        <>
          {field('meal_note', 'Ăn')}
          {field('sleep_note', 'Ngủ')}
          {field('hygiene_note', 'Vệ sinh')}
          <label className="text-label font-medium text-text">
            Tâm trạng
            <select
              value={values.mood}
              onChange={(event) => setValues({ ...values, mood: event.target.value })}
              className={selectClass}
            >
              {MOODS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {field('activity_note', 'Hoạt động')}
          {published ? field('reason', 'Lý do sửa') : null}
          {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
          <Button disabled={busy} onClick={() => void save()}>
            Lưu nhật ký
          </Button>
        </>
      ) : (
        <p className="text-content text-text-secondary">{journal?.meal_note ?? ''}</p>
      )}
    </section>
  );
}

export function JournalScreen({ myClass, onBack }: { myClass: MyClass; onBack(): void }) {
  const [date, setDate] = useState(today());
  const [data, setData] = useState<ClassDay>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    setData(undefined);
    requestJson<ClassDay>(`/api/v1/classes/${myClass.id}/journals?date=${date}`)
      .then(setData)
      .catch((error: unknown) => setErrorMessage(messageOf(error)));
  }, [myClass.id, date, version]);

  const publish = async (confirm: boolean) => {
    setErrorMessage(undefined);
    try {
      await requestJson(`/api/v1/classes/${myClass.id}/journals/publish`, {
        method: 'POST',
        body: JSON.stringify({ date, confirm }),
      });
      setNotice('Đã công bố nhật ký cho phụ huynh');
      setVersion(version + 1);
    } catch (error) {
      if (!confirm && error instanceof ApiError && error.status === 422 && error.details.length > 0) {
        if (window.confirm(`${messageOf(error)}. Vẫn công bố?`)) {
          await publish(true);
        }
        return;
      }
      setErrorMessage(messageOf(error));
    }
  };

  return (
    <div className="min-h-screen">
      <ApplicationHeader title={`Nhật ký lớp ${myClass.name}`} />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
        <div>
          <Button variant="text" onClick={onBack}>
            Quay lại
          </Button>
        </div>
        <TextField
          label="Ngày"
          type="date"
          value={date}
          max={today()}
          onChange={(event) => setDate(event.target.value)}
        />
        {notice ? <Alert tone="success">{notice}</Alert> : null}
        {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
        {(data?.children ?? []).map((child) => (
          <ChildJournal
            key={`${child.child_id}-${date}-${version}`}
            childId={child.child_id}
            fullName={child.full_name}
            date={date}
            journal={child.journal}
            canWrite={data?.can_write ?? false}
            onSaved={() => {
              setNotice(`Đã lưu nhật ký của ${child.full_name}`);
              setVersion(version + 1);
            }}
          />
        ))}
        {data?.can_write ? (
          <Button variant="primary" onClick={() => void publish(false)}>
            Công bố nhật ký
          </Button>
        ) : null}
      </main>
    </div>
  );
}
