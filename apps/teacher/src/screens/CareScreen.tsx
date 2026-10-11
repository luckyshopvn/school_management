import { useEffect, useState } from 'react';
import { Alert, ApplicationHeader, Button, TextField } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';
import type { MyClass } from './ClassesScreen.js';

// MG-09 Chăm sóc hằng ngày và sự kiện y tế của lớp (P10-07, P10-12; BR-52, BR-87; YCTD-74): giáo viên chủ nhiệm ghi nhiệt
// độ, tình trạng, chăm sóc đặc biệt theo lưu ý của phụ huynh; ghi sự kiện y tế thì phụ huynh nhận thông báo ngay
interface ChildRow {
  id: string;
  full_name: string;
}

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join(': ')
    : 'Không kết nối được tới máy chủ';
}

function ChildCare({ child, onMessage }: { child: ChildRow; onMessage(message: string, failed?: boolean): void }) {
  const [temperature, setTemperature] = useState('');
  const [condition, setCondition] = useState('');
  const [special, setSpecial] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [handling, setHandling] = useState('');
  const [showEvent, setShowEvent] = useState(false);
  const [busy, setBusy] = useState(false);

  const saveCare = async () => {
    setBusy(true);
    try {
      await requestJson('/api/v1/daily-care-logs', {
        method: 'POST',
        body: JSON.stringify({
          child_id: child.id,
          temperature: temperature === '' ? null : Number(temperature.replace(',', '.')),
          condition_note: condition || null,
          special_care_note: special || null,
        }),
      });
      setTemperature('');
      setCondition('');
      setSpecial('');
      onMessage(`Đã ghi chăm sóc cho ${child.full_name}`);
    } catch (error) {
      onMessage(messageOf(error), true);
    } finally {
      setBusy(false);
    }
  };

  const saveEvent = async () => {
    setBusy(true);
    try {
      await requestJson('/api/v1/medical-events', {
        method: 'POST',
        body: JSON.stringify({
          child_id: child.id,
          occurred_at: new Date().toISOString(),
          symptoms,
          handling,
          severity: 'mild',
        }),
      });
      setSymptoms('');
      setHandling('');
      setShowEvent(false);
      onMessage(`Đã ghi sự kiện y tế của ${child.full_name} và báo phụ huynh`);
    } catch (error) {
      onMessage(messageOf(error), true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li
      className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4"
      aria-label={`Chăm sóc ${child.full_name}`}
    >
      <span className="text-content font-semibold">{child.full_name}</span>
      <TextField label="Nhiệt độ" value={temperature} onChange={(event) => setTemperature(event.target.value)} />
      <TextField label="Tình trạng" value={condition} onChange={(event) => setCondition(event.target.value)} />
      <TextField label="Chăm sóc đặc biệt" value={special} onChange={(event) => setSpecial(event.target.value)} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          disabled={busy || (temperature === '' && condition === '' && special === '')}
          onClick={() => void saveCare()}
        >
          Ghi chăm sóc
        </Button>
        <Button onClick={() => setShowEvent(!showEvent)}>Sự kiện y tế</Button>
      </div>
      {showEvent ? (
        <div className="flex flex-col gap-2">
          <TextField label="Triệu chứng" value={symptoms} onChange={(event) => setSymptoms(event.target.value)} />
          <TextField label="Đã xử lý" value={handling} onChange={(event) => setHandling(event.target.value)} />
          <Button
            variant="primary"
            disabled={busy || symptoms === '' || handling === ''}
            onClick={() => void saveEvent()}
          >
            Ghi sự kiện và báo phụ huynh
          </Button>
        </div>
      ) : null}
    </li>
  );
}

export function CareScreen({ myClass, onBack }: { myClass: MyClass; onBack(): void }) {
  const [children, setChildren] = useState<ChildRow[]>();
  const [message, setMessage] = useState<{ text: string; failed: boolean }>();

  useEffect(() => {
    requestJson<{ items: ChildRow[] }>(`/api/v1/children?class_id=${myClass.id}&status=active&page_size=100`)
      .then((page) => setChildren(page.items))
      .catch((error: unknown) => setMessage({ text: messageOf(error), failed: true }));
  }, [myClass.id]);

  return (
    <div className="min-h-screen bg-page">
      <ApplicationHeader title={`Chăm sóc lớp ${myClass.name}`} />
      <main className="mx-auto flex max-w-xl flex-col gap-4 p-4">
        <div>
          <Button variant="text" onClick={onBack}>
            Quay lại
          </Button>
        </div>
        {message ? <Alert tone={message.failed ? 'danger' : 'success'}>{message.text}</Alert> : null}
        <ul className="flex flex-col gap-3">
          {(children ?? []).map((child) => (
            <ChildCare
              key={child.id}
              child={child}
              onMessage={(text, failed = false) => setMessage({ text, failed })}
            />
          ))}
        </ul>
      </main>
    </div>
  );
}
