import { useCallback, useEffect, useState } from 'react';
import { Alert, ApplicationHeader, Button } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';
import type { MyClass } from './ClassesScreen.js';

// Sổ điểm lớp THCS, THPT (DT-21 phần 21c, YCTD-170): chọn học kỳ và môn mình được phân công, nhập điểm đánh giá thường xuyên,
// giữa kỳ, cuối kỳ (môn nhận xét: Đạt, Chưa đạt). Máy chủ kiểm tra phân công, hạn nhập, khoá điểm
interface Overview {
  access: { subject_ids: string[] };
  subjects: Array<{ subject_id: string; subject_name: string; required_regular: number }>;
}

interface Sheet {
  can_edit: boolean;
  locked: { locked_by_name: string } | null;
  subject: { mode: 'score' | 'comment'; required_regular: number };
  rows: Array<{
    child_id: string;
    full_name: string;
    regular: number[];
    mid: number | null;
    final: number | null;
    average: number | null;
    result: 'pass' | 'fail' | null;
    comment: string | null;
  }>;
}

interface Draft {
  regular: string[];
  mid: string;
  final: string;
  result: string;
}

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join(': ')
    : 'Không kết nối được tới máy chủ';
}

const parse = (text: string): number | null | undefined => {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') {
    return null;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
};

export function ScoreScreen({ myClass, onBack }: { myClass: MyClass; onBack(): void }) {
  const [overview, setOverview] = useState<Overview>();
  const [term, setTerm] = useState('first_term');
  const [subjectId, setSubjectId] = useState('');
  const [sheet, setSheet] = useState<Sheet>();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [message, setMessage] = useState<{ text: string; failed: boolean }>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    requestJson<Overview>(`/api/v1/scores/classes/${myClass.id}`)
      .then((loaded) => {
        setOverview(loaded);
        const own = loaded.subjects.filter((subject) => loaded.access.subject_ids.includes(subject.subject_id));
        setSubjectId((own[0] ?? loaded.subjects[0])?.subject_id ?? '');
      })
      .catch((error: unknown) => setMessage({ text: messageOf(error), failed: true }));
  }, [myClass.id]);

  const load = useCallback(async () => {
    if (!subjectId) {
      return;
    }
    try {
      const loaded = await requestJson<Sheet>(
        `/api/v1/scores/classes/${myClass.id}/subjects/${subjectId}?term_type=${term}`,
      );
      setSheet(loaded);
      const slots = loaded.subject.required_regular;
      setDrafts(
        Object.fromEntries(
          loaded.rows.map((row) => [
            row.child_id,
            {
              regular: Array.from({ length: Math.max(slots, row.regular.length) }, (_unused, index) =>
                row.regular[index] === undefined ? '' : String(row.regular[index]),
              ),
              mid: row.mid === null ? '' : String(row.mid),
              final: row.final === null ? '' : String(row.final),
              result: row.result ?? '',
            },
          ]),
        ),
      );
    } catch (error) {
      setMessage({ text: messageOf(error), failed: true });
    }
  }, [myClass.id, subjectId, term]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    setMessage(undefined);
    try {
      await requestJson(`/api/v1/scores/classes/${myClass.id}/subjects/${subjectId}`, {
        method: 'PUT',
        body: JSON.stringify({
          term_type: term,
          entries: Object.entries(drafts).map(([childId, draft]) => ({
            child_id: childId,
            regular: draft.regular.map((text) => parse(text) ?? null),
            mid: parse(draft.mid) ?? null,
            final: parse(draft.final) ?? null,
            result: draft.result || null,
          })),
        }),
      });
      setMessage({ text: 'Đã lưu điểm', failed: false });
      await load();
    } catch (error) {
      setMessage({ text: messageOf(error), failed: true });
    } finally {
      setBusy(false);
    }
  };

  const change = (childId: string, patch: Partial<Draft>) =>
    setDrafts((current) => ({ ...current, [childId]: { ...(current[childId] as Draft), ...patch } }));
  const isScore = sheet?.subject.mode === 'score';
  const invalid = Object.values(drafts).some((draft) =>
    [...draft.regular, draft.mid, draft.final].some((text) => parse(text) === undefined),
  );
  return (
    <div className="min-h-screen bg-page text-text">
      <ApplicationHeader title={`Sổ điểm lớp ${myClass.name}`} />
      <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
        <div>
          <Button variant="text" onClick={onBack}>
            Quay lại
          </Button>
        </div>
        {message ? <Alert tone={message.failed ? 'danger' : 'success'}>{message.text}</Alert> : null}
        {overview ? (
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-label font-medium text-text">
              Học kỳ
              <select
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                className="rounded-lg border border-border bg-card px-3 py-2"
              >
                <option value="first_term">Học kỳ I</option>
                <option value="second_term">Học kỳ II</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-label font-medium text-text">
              Môn học
              <select
                value={subjectId}
                onChange={(event) => setSubjectId(event.target.value)}
                className="rounded-lg border border-border bg-card px-3 py-2"
              >
                {overview.subjects.map((subject) => (
                  <option key={subject.subject_id} value={subject.subject_id}>
                    {subject.subject_name}
                    {overview.access.subject_ids.includes(subject.subject_id) ? '' : ' (chỉ xem)'}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
        {sheet?.locked ? <Alert tone="info">Học kỳ đã khoá điểm bởi {sheet.locked.locked_by_name}.</Alert> : null}
        {sheet ? (
          <ul className="flex flex-col gap-3" aria-label="Bảng điểm">
            {sheet.rows.map((row) => {
              const draft = drafts[row.child_id];
              if (!draft) {
                return null;
              }
              return (
                <li key={row.child_id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
                  <span className="font-medium">
                    {row.full_name}
                    {row.average !== null ? ` · TB ${row.average}` : ''}
                  </span>
                  {isScore ? (
                    <div className="flex flex-wrap gap-2">
                      {draft.regular.map((text, index) => (
                        <input
                          key={index}
                          aria-label={`Điểm thường xuyên ${index + 1} của ${row.full_name}`}
                          inputMode="decimal"
                          placeholder={`TX${index + 1}`}
                          className="w-16 rounded-lg border border-border bg-card px-2 py-1"
                          value={text}
                          disabled={!sheet.can_edit}
                          onChange={(event) => {
                            const next = [...draft.regular];
                            next[index] = event.target.value;
                            change(row.child_id, { regular: next });
                          }}
                        />
                      ))}
                      <input
                        aria-label={`Giữa kỳ của ${row.full_name}`}
                        inputMode="decimal"
                        placeholder="Giữa kỳ"
                        className="w-20 rounded-lg border border-border bg-card px-2 py-1"
                        value={draft.mid}
                        disabled={!sheet.can_edit}
                        onChange={(event) => change(row.child_id, { mid: event.target.value })}
                      />
                      <input
                        aria-label={`Cuối kỳ của ${row.full_name}`}
                        inputMode="decimal"
                        placeholder="Cuối kỳ"
                        className="w-20 rounded-lg border border-border bg-card px-2 py-1"
                        value={draft.final}
                        disabled={!sheet.can_edit}
                        onChange={(event) => change(row.child_id, { final: event.target.value })}
                      />
                    </div>
                  ) : (
                    <select
                      aria-label={`Kết quả của ${row.full_name}`}
                      value={draft.result}
                      disabled={!sheet.can_edit}
                      onChange={(event) => change(row.child_id, { result: event.target.value })}
                      className="rounded-lg border border-border bg-card px-2 py-1"
                    >
                      <option value="">Chưa nhập</option>
                      <option value="pass">Đạt</option>
                      <option value="fail">Chưa đạt</option>
                    </select>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
        {sheet?.can_edit ? (
          <Button variant="primary" disabled={busy || invalid} onClick={() => void save()}>
            Lưu điểm
          </Button>
        ) : null}
        {sheet && !sheet.can_edit && !sheet.locked ? (
          <Alert tone="info">Bạn chưa được phân công nhập môn này của lớp.</Alert>
        ) : null}
      </main>
    </div>
  );
}
