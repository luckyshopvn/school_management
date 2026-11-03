import { useCallback, useEffect, useState } from 'react';
import { Alert, ApplicationHeader, Button } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';
import type { MyClass } from './ClassesScreen.js';
import { useWideLayout } from '../shell/use-wide-layout.js';

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

const CELL_INPUT_CLASS =
  'min-h-11 w-16 rounded-lg border border-border bg-card px-2 text-center disabled:bg-page aria-invalid:border-2 aria-invalid:border-danger';

// Bảng nhập theo ô khổ máy tính (TD-29, YCTD-395 lát L4): cột họ tên và hàng tiêu đề dính khi cuộn, ô 44 px; tên đọc của ô như thẻ ở
// điện thoại ("Điểm thường xuyên 1 của …"), Tab đi theo dòng
function ScoreTable({
  sheet,
  drafts,
  isScore,
  onChange,
}: {
  sheet: Sheet;
  drafts: Record<string, Draft>;
  isScore: boolean;
  onChange(childId: string, patch: Partial<Draft>): void;
}) {
  const regularCount = Math.max(0, ...Object.values(drafts).map((draft) => draft.regular.length));
  const header = 'sticky top-0 z-10 border-b border-border bg-page px-2 py-2.5 text-label font-semibold text-text';
  const invalid = (text: string) => (parse(text) === undefined ? true : undefined);
  return (
    <div className="relative max-h-[70vh] overflow-auto rounded-xl border border-border bg-card">
      <table className="w-full border-separate border-spacing-0 text-content text-text">
        <caption className="sr-only">Bảng điểm</caption>
        <thead>
          <tr>
            <th scope="col" className={`${header} left-0 z-20 min-w-60 text-left`}>
              Học sinh
            </th>
            {isScore ? (
              <>
                {Array.from({ length: regularCount }, (_unused, index) => (
                  <th key={index} scope="col" className={header}>
                    TX{index + 1}
                  </th>
                ))}
                <th scope="col" className={header}>
                  Giữa kỳ
                </th>
                <th scope="col" className={header}>
                  Cuối kỳ
                </th>
                <th scope="col" className={header}>
                  TB môn
                </th>
              </>
            ) : (
              <th scope="col" className={`${header} text-left`}>
                Kết quả
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {sheet.rows.map((row) => {
            const draft = drafts[row.child_id];
            if (!draft) {
              return null;
            }
            return (
              <tr key={row.child_id}>
                <th
                  scope="row"
                  className="sticky left-0 z-[1] border-b border-border bg-card px-4 py-1.5 text-left font-semibold"
                >
                  {row.full_name}
                </th>
                {isScore ? (
                  <>
                    {Array.from({ length: regularCount }, (_unused, index) => (
                      <td key={index} className="border-b border-border px-1.5 py-1.5 text-center">
                        {index < draft.regular.length ? (
                          <input
                            aria-label={`Điểm thường xuyên ${index + 1} của ${row.full_name}`}
                            aria-invalid={invalid(draft.regular[index] ?? '')}
                            inputMode="decimal"
                            className={CELL_INPUT_CLASS}
                            value={draft.regular[index]}
                            disabled={!sheet.can_edit}
                            onChange={(event) => {
                              const next = [...draft.regular];
                              next[index] = event.target.value;
                              onChange(row.child_id, { regular: next });
                            }}
                          />
                        ) : null}
                      </td>
                    ))}
                    <td className="border-b border-border px-1.5 py-1.5 text-center">
                      <input
                        aria-label={`Giữa kỳ của ${row.full_name}`}
                        aria-invalid={invalid(draft.mid)}
                        inputMode="decimal"
                        className={CELL_INPUT_CLASS}
                        value={draft.mid}
                        disabled={!sheet.can_edit}
                        onChange={(event) => onChange(row.child_id, { mid: event.target.value })}
                      />
                    </td>
                    <td className="border-b border-border px-1.5 py-1.5 text-center">
                      <input
                        aria-label={`Cuối kỳ của ${row.full_name}`}
                        aria-invalid={invalid(draft.final)}
                        inputMode="decimal"
                        className={CELL_INPUT_CLASS}
                        value={draft.final}
                        disabled={!sheet.can_edit}
                        onChange={(event) => onChange(row.child_id, { final: event.target.value })}
                      />
                    </td>
                    <td className="border-b border-border px-3 py-1.5 text-center font-bold">{row.average ?? '—'}</td>
                  </>
                ) : (
                  <td className="border-b border-border px-3 py-1.5">
                    <select
                      aria-label={`Kết quả của ${row.full_name}`}
                      value={draft.result}
                      disabled={!sheet.can_edit}
                      onChange={(event) => onChange(row.child_id, { result: event.target.value })}
                      className="min-h-11 rounded-lg border border-border bg-card px-2"
                    >
                      <option value="">Chưa nhập</option>
                      <option value="pass">Đạt</option>
                      <option value="fail">Chưa đạt</option>
                    </select>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ScoreScreen({ myClass, onBack }: { myClass: MyClass; onBack(): void }) {
  const [overview, setOverview] = useState<Overview>();
  const [term, setTerm] = useState('first_term');
  const [subjectId, setSubjectId] = useState('');
  const [sheet, setSheet] = useState<Sheet>();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [message, setMessage] = useState<{ text: string; failed: boolean }>();
  const [busy, setBusy] = useState(false);
  // Khổ máy tính (YCTD-395 lát L4): bảng nhập theo ô TD-29; điện thoại mỗi học sinh một thẻ như trước
  const wide = useWideLayout();

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
      <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 lg:max-w-[78rem] lg:px-7">
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
        {sheet && wide ? <ScoreTable sheet={sheet} drafts={drafts} isScore={isScore} onChange={change} /> : null}
        {sheet && !wide ? (
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
          <Button variant="primary" className="lg:self-start" disabled={busy || invalid} onClick={() => void save()}>
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
