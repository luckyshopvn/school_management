import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, FORM_CONTROL_CLASS, StatusBadge } from '@school-management/ui';
import { ApiError, fetchWithSession, requestJson } from '../session/api-client.js';

// Tiến độ và bảng điểm hoạt động của một lớp học trực tuyến (DT-28 phần 28d, YCTD-274): từng em (phần trăm hoạt động bắt buộc đã
// xong, quá hạn, chờ chấm), danh sách cần chú ý, bảng điểm hoạt động (trung bình chỉ tham khảo), tải Excel. Đưa vào sổ: THCS, THPT
// chọn hoạt động, cách gộp, học kỳ, lần đánh giá thường xuyên, xem trước rồi ghi sổ điểm; Tiểu học xem gợi ý mức đạt môn và nhận
// xét, sửa rồi ghi sổ nhận xét (GD-141). Không có gì tự ghi; không có thứ hạng
interface Grid {
  space: { id: string; title: string; school_level: string };
  students: Array<{
    child_id: string;
    full_name: string;
    summary: { required: number; done: number; overdue: number; pending_grading: number; percent: number };
    attention: string[];
  }>;
}

interface Gradebook {
  notice: string;
  gradebook_enabled: boolean;
  can_transfer: boolean;
  activities: Array<{ id: string; title: string; weight: number }>;
  rows: Array<{
    child_id: string;
    full_name: string;
    cells: Record<string, { status: string; score: number | null; level: string | null } | null>;
    average: number | null;
    levels: { excellent: number; completed: number; not_completed: number } | null;
  }>;
}

interface ScorePreview {
  rows: Array<{
    child_id: string;
    full_name: string;
    score: number | null;
    reason: string | null;
    current: { score: number } | null;
  }>;
}

interface CommentPreview {
  periods: Array<{ id: string; name: string }>;
  rows: Array<{ child_id: string; full_name: string; level_code: string | null; comment: string; feedback: string[] }>;
}

const LEVELS: Record<string, string> = { excellent: 'Tốt', completed: 'Hoàn thành', not_completed: 'Chưa hoàn thành' };
const messageOf = (error: unknown) => (error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ');
const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) });

function ScoreBook({ spaceId, book, onDone }: { spaceId: string; book: Gradebook; onDone(text: string): void }) {
  const [chosen, setChosen] = useState<string[]>([]);
  const [term, setTerm] = useState<'first_term' | 'second_term'>('first_term');
  const [seq, setSeq] = useState(1);
  const [preview, setPreview] = useState<ScorePreview>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const body = () => ({
    activity_ids: chosen,
    method: chosen.length > 1 ? 'weighted' : 'single',
    term_type: term,
    seq,
  });
  const run = async (action: () => Promise<void>) => {
    setErrorMessage(undefined);
    try {
      await action();
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  };
  return (
    <section aria-label="Đưa vào sổ điểm" className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <h2 className="text-section-title font-semibold text-text">Đưa vào sổ điểm (điểm thường xuyên)</h2>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {book.activities.map((activity) => (
        <label key={activity.id} className="flex items-center gap-2 text-label">
          <input
            type="checkbox"
            checked={chosen.includes(activity.id)}
            onChange={(event) =>
              setChosen(event.target.checked ? [...chosen, activity.id] : chosen.filter((id) => id !== activity.id))
            }
          />
          {activity.title} (trọng số {activity.weight})
        </label>
      ))}
      <label className="text-label font-medium text-text">
        Học kỳ
        <select
          className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
          value={term}
          onChange={(event) => setTerm(event.target.value as typeof term)}
        >
          <option value="first_term">Học kỳ I</option>
          <option value="second_term">Học kỳ II</option>
        </select>
      </label>
      <label className="text-label font-medium text-text">
        Lần đánh giá thường xuyên
        <input
          type="number"
          min={1}
          max={10}
          className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
          value={seq}
          onChange={(event) => setSeq(Number(event.target.value))}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={chosen.length === 0}
          onClick={() =>
            void run(async () =>
              setPreview(
                await requestJson<ScorePreview>(`/api/v1/learning/spaces/${spaceId}/score-book/preview`, post(body())),
              ),
            )
          }
        >
          Xem trước
        </Button>
        {preview ? (
          <Button
            variant="primary"
            onClick={() =>
              void run(async () => {
                const result = await requestJson<{ written: number; skipped: number }>(
                  `/api/v1/learning/spaces/${spaceId}/score-book`,
                  post(body()),
                );
                setPreview(undefined);
                onDone(`Đã ghi ${result.written} điểm vào sổ, bỏ trống ${result.skipped} em`);
              })
            }
          >
            Ghi vào sổ điểm
          </Button>
        ) : null}
      </div>
      {preview ? (
        <ul className="flex flex-col gap-1 text-label" aria-label="Điểm sẽ ghi">
          {preview.rows.map((row) => (
            <li key={row.child_id}>
              {row.full_name}: {row.score ?? `bỏ trống (${row.reason ?? ''})`}
              {row.current ? ` · sổ đang có ${row.current.score}` : ''}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function CommentBook({ spaceId, onDone }: { spaceId: string; onDone(text: string): void }) {
  const [preview, setPreview] = useState<CommentPreview>();
  const [periodId, setPeriodId] = useState('');
  const [edits, setEdits] = useState<Record<string, { level_code: string; comment: string }>>({});
  const [errorMessage, setErrorMessage] = useState<string>();
  const load = async () => {
    setErrorMessage(undefined);
    try {
      const loaded = await requestJson<CommentPreview>(
        `/api/v1/learning/spaces/${spaceId}/comment-book/preview`,
        post({}),
      );
      setPreview(loaded);
      setPeriodId(loaded.periods[0]?.id ?? '');
      setEdits(
        Object.fromEntries(
          loaded.rows.map((row) => [row.child_id, { level_code: row.level_code ?? '', comment: row.comment }]),
        ),
      );
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  };
  const save = async () => {
    setErrorMessage(undefined);
    try {
      const result = await requestJson<{ levels: number; comments: number }>(
        `/api/v1/learning/spaces/${spaceId}/comment-book`,
        post({
          period_id: periodId,
          items: Object.entries(edits).map(([childId, edit]) => ({ child_id: childId, ...edit })),
        }),
      );
      setPreview(undefined);
      onDone(`Đã ghi ${result.levels} mức đạt môn và ${result.comments} nhận xét`);
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  };
  return (
    <section aria-label="Đưa vào sổ nhận xét" className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <h2 className="text-section-title font-semibold text-text">Gợi ý mức đạt môn và nhận xét (Tiểu học)</h2>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {!preview ? (
        <div>
          <Button variant="secondary" onClick={() => void load()}>
            Xem gợi ý
          </Button>
        </div>
      ) : (
        <>
          <label className="text-label font-medium text-text">
            Kỳ đánh giá
            <select
              className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
              value={periodId}
              onChange={(event) => setPeriodId(event.target.value)}
            >
              {preview.periods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.name}
                </option>
              ))}
            </select>
          </label>
          {preview.rows.map((row) => (
            <div key={row.child_id} className="flex flex-col gap-1 rounded-lg border border-border p-2 text-label">
              <span className="font-semibold">{row.full_name}</span>
              <label className="flex items-center gap-2">
                Mức đạt môn của {row.full_name}
                <select
                  className={FORM_CONTROL_CLASS}
                  value={edits[row.child_id]?.level_code ?? ''}
                  onChange={(event) =>
                    setEdits({
                      ...edits,
                      [row.child_id]: { comment: edits[row.child_id]?.comment ?? '', level_code: event.target.value },
                    })
                  }
                >
                  <option value="">Không ghi</option>
                  <option value="T">Hoàn thành tốt</option>
                  <option value="H">Hoàn thành</option>
                  <option value="C">Chưa hoàn thành</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                Nhận xét của {row.full_name}
                <textarea
                  className={FORM_CONTROL_CLASS}
                  rows={2}
                  value={edits[row.child_id]?.comment ?? ''}
                  onChange={(event) =>
                    setEdits({
                      ...edits,
                      [row.child_id]: {
                        level_code: edits[row.child_id]?.level_code ?? '',
                        comment: event.target.value,
                      },
                    })
                  }
                />
              </label>
              {row.feedback.length > 0 ? (
                <span className="text-text-secondary">Nhận xét bài tập đã trả: {row.feedback.join(' | ')}</span>
              ) : null}
            </div>
          ))}
          <div>
            <Button variant="primary" disabled={!periodId} onClick={() => void save()}>
              Ghi vào sổ nhận xét
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

export function LearningProgressScreen({ spaceId, onBack }: { spaceId: string; onBack(): void }) {
  const [grid, setGrid] = useState<Grid>();
  const [book, setBook] = useState<Gradebook>();
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>();
  const load = useCallback(() => {
    requestJson<Grid>(`/api/v1/learning/spaces/${spaceId}/progress-grid`)
      .then(setGrid)
      .catch((error: unknown) => setMessage({ tone: 'danger', text: messageOf(error) }));
    requestJson<Gradebook>(`/api/v1/learning/spaces/${spaceId}/gradebook`)
      .then(setBook)
      .catch((error: unknown) => setMessage({ tone: 'danger', text: messageOf(error) }));
  }, [spaceId]);
  useEffect(load, [load]);
  const exportFile = async () => {
    const response = await fetchWithSession(`/api/v1/learning/spaces/${spaceId}/gradebook/file?format=xlsx`);
    if (!response.ok) {
      setMessage({ tone: 'danger', text: 'Không tải được bảng điểm' });
      return;
    }
    const link = document.createElement('a');
    link.href = URL.createObjectURL(await response.blob());
    link.download = 'bang-diem-hoat-dong.xlsx';
    link.click();
  };
  const primary = grid?.space.school_level === 'TH';
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
      <div>
        <Button variant="text" onClick={onBack}>
          Quay lại
        </Button>
      </div>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      {grid ? (
        <>
          <h1 className="text-page-title font-bold text-text">Tiến độ: {grid.space.title}</h1>
          <ul className="flex flex-col gap-2" aria-label="Tiến độ từng em">
            {grid.students.map((student) => (
              <li key={student.child_id} className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3">
                <span className="flex items-center gap-2 text-content font-semibold">
                  {student.full_name}
                  {student.attention.length > 0 ? <StatusBadge tone="warning" label="Cần chú ý" /> : null}
                </span>
                <span className="text-label text-text-secondary">
                  Xong {student.summary.done}/{student.summary.required} ({student.summary.percent}%)
                  {student.summary.overdue > 0 ? ` · quá hạn ${student.summary.overdue}` : ''}
                  {student.summary.pending_grading > 0 ? ` · chờ chấm ${student.summary.pending_grading}` : ''}
                </span>
                {student.attention.length > 0 ? (
                  <span className="text-label text-text">{student.attention.join('; ')}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {book ? (
        <section aria-label="Bảng điểm hoạt động" className="flex flex-col gap-2">
          <h2 className="text-section-title font-semibold text-text">Bảng điểm hoạt động</h2>
          <p className="text-label text-text-secondary">{book.notice}</p>
          <ul className="flex flex-col gap-1 text-label">
            {book.rows.map((row) => (
              <li key={row.child_id}>
                {row.full_name}:{' '}
                {book.activities
                  .map((activity) => {
                    const cell = row.cells[activity.id];
                    return `${activity.title} ${cell ? (cell.score ?? (cell.level ? LEVELS[cell.level] : '-')) : '-'}`;
                  })
                  .join(' · ')}
                {row.average !== null ? ` · trung bình tham khảo ${row.average}` : ''}
              </li>
            ))}
          </ul>
          <div>
            <Button variant="secondary" onClick={() => void exportFile()}>
              Tải bảng điểm Excel
            </Button>
          </div>
          {book.can_transfer && book.gradebook_enabled ? (
            primary ? (
              <CommentBook spaceId={spaceId} onDone={(text) => setMessage({ tone: 'success', text })} />
            ) : (
              <ScoreBook
                spaceId={spaceId}
                book={book}
                onDone={(text) => {
                  setMessage({ tone: 'success', text });
                  load();
                }}
              />
            )
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
