import { useEffect, useState } from 'react';
import { Alert, TextField } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// MP-03 Nhật ký của con (P04-04, P04-05; BR-15; YCTD-65): nhật ký đã công bố theo tháng
interface Journal {
  id: string;
  journal_date: string;
  meal_note: string | null;
  sleep_note: string | null;
  hygiene_note: string | null;
  mood: string | null;
  activity_note: string | null;
}

const MOOD_LABELS: Record<string, string> = {
  happy: 'Vui vẻ',
  normal: 'Bình thường',
  tired: 'Mệt',
  sad: 'Buồn',
  unwell: 'Không khỏe',
};

export function JournalPanel({ child }: { child: { id: string; full_name: string } }) {
  const [month, setMonth] = useState(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()).slice(0, 7),
  );
  const [journals, setJournals] = useState<Journal[]>();
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    requestJson<{ journals: Journal[] }>(`/api/v1/children/${child.id}/journals?month=${month}`)
      .then((result) => setJournals(result.journals))
      .catch((error: unknown) => setErrorMessage(error instanceof ApiError ? error.message : 'Không tải được nhật ký'));
  }, [child.id, month]);

  return (
    <section className="flex flex-col gap-2" aria-label={`Nhật ký của ${child.full_name}`}>
      <TextField label="Tháng nhật ký" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {journals && journals.length === 0 ? (
        <p className="text-content text-text-secondary">Chưa có nhật ký trong tháng này.</p>
      ) : null}
      {(journals ?? []).map((journal) => (
        <article key={journal.id} className="rounded-lg border border-border p-3 text-content">
          <p className="font-semibold">Ngày {journal.journal_date}</p>
          {journal.meal_note ? <p>Ăn: {journal.meal_note}</p> : null}
          {journal.sleep_note ? <p>Ngủ: {journal.sleep_note}</p> : null}
          {journal.hygiene_note ? <p>Vệ sinh: {journal.hygiene_note}</p> : null}
          {journal.mood ? <p>Tâm trạng: {MOOD_LABELS[journal.mood] ?? journal.mood}</p> : null}
          {journal.activity_note ? <p>Hoạt động: {journal.activity_note}</p> : null}
        </article>
      ))}
    </section>
  );
}
