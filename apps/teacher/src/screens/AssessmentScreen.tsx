import { useCallback, useEffect, useState } from 'react';
import { Alert, ApplicationHeader, Button } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';
import type { MyClass } from './ClassesScreen.js';

// Đánh giá học sinh của lớp Tiểu học (DT-20 phần 20c, YCTD-161): chọn kỳ và môn mình được phân công (giáo viên chủ nhiệm có
// thêm phẩm chất, năng lực), nhập mức đạt, điểm bài kiểm tra định kỳ, nhận xét. Máy chủ kiểm tra phân công, hạn, khoá số liệu
interface Overview {
  access: { subject_ids: string[]; competency: boolean };
  subjects: Array<{ subject_id: string; subject_name: string }>;
  periods: Array<{ id: string; name: string; locked: unknown }>;
  levels: Array<{ scale: string; code: string; name: string }>;
}

interface Row {
  child_id: string;
  full_name: string;
  level_code: string;
  score: string;
  comment: string;
}

interface SubjectSheet {
  has_test: boolean;
  can_edit: boolean;
  rows: Array<{
    child_id: string;
    full_name: string;
    result: { level_code: string | null; score: number | null; comment: string | null } | null;
  }>;
}

interface CompetencySheet {
  can_edit: boolean;
  items: Array<{ id: string; name: string }>;
  rows: Array<{ child_id: string; full_name: string; results: Array<{ item_id: string; level_code: string | null }> }>;
}

const COMPETENCY = 'competency';

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join(': ')
    : 'Không kết nối được tới máy chủ';
}

export function AssessmentScreen({ myClass, onBack }: { myClass: MyClass; onBack(): void }) {
  const [overview, setOverview] = useState<Overview>();
  const [periodId, setPeriodId] = useState('');
  const [target, setTarget] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [hasTest, setHasTest] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [competency, setCompetency] = useState<CompetencySheet>();
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ text: string; failed: boolean }>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    requestJson<Overview>(`/api/v1/assessment/classes/${myClass.id}`)
      .then((loaded) => {
        setOverview(loaded);
        setPeriodId(loaded.periods[0]?.id ?? '');
        const own = loaded.subjects.filter((subject) => loaded.access.subject_ids.includes(subject.subject_id));
        setTarget(own[0]?.subject_id ?? (loaded.access.competency ? COMPETENCY : ''));
      })
      .catch((error: unknown) => setMessage({ text: messageOf(error), failed: true }));
  }, [myClass.id]);

  const load = useCallback(async () => {
    if (!periodId || !target) {
      return;
    }
    try {
      if (target === COMPETENCY) {
        const sheet = await requestJson<CompetencySheet>(
          `/api/v1/assessment/classes/${myClass.id}/competencies?period_id=${periodId}`,
        );
        setCompetency(sheet);
        setCanEdit(sheet.can_edit);
        setMarks(
          Object.fromEntries(
            sheet.rows.flatMap((row) =>
              row.results.map((result) => [`${row.child_id}:${result.item_id}`, result.level_code ?? '']),
            ),
          ),
        );
      } else {
        const sheet = await requestJson<SubjectSheet>(
          `/api/v1/assessment/classes/${myClass.id}/subjects/${target}?period_id=${periodId}`,
        );
        setCompetency(undefined);
        setHasTest(sheet.has_test);
        setCanEdit(sheet.can_edit);
        setRows(
          sheet.rows.map((row) => ({
            child_id: row.child_id,
            full_name: row.full_name,
            level_code: row.result?.level_code ?? '',
            score: row.result?.score ? String(row.result.score) : '',
            comment: row.result?.comment ?? '',
          })),
        );
      }
    } catch (error) {
      setMessage({ text: messageOf(error), failed: true });
    }
  }, [myClass.id, periodId, target]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    try {
      if (target === COMPETENCY && competency) {
        await requestJson(`/api/v1/assessment/classes/${myClass.id}/competencies`, {
          method: 'PUT',
          body: JSON.stringify({
            period_id: periodId,
            entries: competency.rows.flatMap((row) =>
              competency.items.map((item) => ({
                child_id: row.child_id,
                item_id: item.id,
                level_code: marks[`${row.child_id}:${item.id}`] || null,
              })),
            ),
          }),
        });
      } else {
        await requestJson(`/api/v1/assessment/classes/${myClass.id}/subjects/${target}`, {
          method: 'PUT',
          body: JSON.stringify({
            period_id: periodId,
            entries: rows.map((row) => ({
              child_id: row.child_id,
              level_code: row.level_code || null,
              score: row.score ? Number(row.score) : null,
              comment: row.comment || null,
            })),
          }),
        });
      }
      setMessage({ text: 'Đã lưu đánh giá', failed: false });
      await load();
    } catch (error) {
      setMessage({ text: messageOf(error), failed: true });
    } finally {
      setBusy(false);
    }
  };

  const subjects = (overview?.subjects ?? []).filter((subject) =>
    overview?.access.subject_ids.includes(subject.subject_id),
  );
  const levels = (overview?.levels ?? []).filter(
    (level) => level.scale === (target === COMPETENCY ? 'competency' : 'subject'),
  );
  const update = (childId: string, field: 'level_code' | 'score' | 'comment', value: string) =>
    setRows(rows.map((row) => (row.child_id === childId ? { ...row, [field]: value } : row)));

  return (
    <div className="min-h-screen bg-page">
      <ApplicationHeader title={`Đánh giá lớp ${myClass.name}`} />
      <main className="mx-auto flex max-w-xl flex-col gap-4 p-4">
        <div>
          <Button variant="text" onClick={onBack}>
            Quay lại
          </Button>
        </div>
        {message ? <Alert tone={message.failed ? 'danger' : 'success'}>{message.text}</Alert> : null}
        {overview ? (
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-label font-medium text-text">
              Kỳ đánh giá
              <select
                value={periodId}
                onChange={(event) => setPeriodId(event.target.value)}
                className="rounded-lg border border-border bg-card px-3 py-2"
              >
                {overview.periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.name}
                    {period.locked ? ' (đã khoá)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-label font-medium text-text">
              Môn học
              <select
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                className="rounded-lg border border-border bg-card px-3 py-2"
              >
                {subjects.map((subject) => (
                  <option key={subject.subject_id} value={subject.subject_id}>
                    {subject.subject_name}
                  </option>
                ))}
                {overview.access.competency ? <option value={COMPETENCY}>Phẩm chất, năng lực</option> : null}
              </select>
            </label>
          </div>
        ) : null}
        {overview && overview.periods.length === 0 ? (
          <Alert tone="info">Nhà trường chưa cấu hình kỳ đánh giá.</Alert>
        ) : null}
        {target && target !== COMPETENCY ? (
          <ul className="flex flex-col gap-3" aria-label="Đánh giá học sinh">
            {rows.map((row) => (
              <li key={row.child_id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
                <span className="font-medium">{row.full_name}</span>
                <div className="flex gap-2">
                  <select
                    aria-label={`Mức đạt của ${row.full_name}`}
                    value={row.level_code}
                    disabled={!canEdit}
                    onChange={(event) => update(row.child_id, 'level_code', event.target.value)}
                    className="rounded-lg border border-border bg-card px-2 py-1"
                  >
                    <option value="">Chưa nhập</option>
                    {levels.map((level) => (
                      <option key={level.code} value={level.code}>
                        {level.name}
                      </option>
                    ))}
                  </select>
                  {hasTest ? (
                    <input
                      aria-label={`Điểm của ${row.full_name}`}
                      inputMode="numeric"
                      placeholder="Điểm"
                      className="w-20 rounded-lg border border-border bg-card px-2 py-1"
                      value={row.score}
                      disabled={!canEdit}
                      onChange={(event) =>
                        update(row.child_id, 'score', event.target.value.replace(/\D/g, '').slice(0, 2))
                      }
                    />
                  ) : null}
                </div>
                <input
                  aria-label={`Nhận xét của ${row.full_name}`}
                  placeholder="Nhận xét"
                  className="rounded-lg border border-border bg-card px-2 py-1"
                  value={row.comment}
                  disabled={!canEdit}
                  onChange={(event) => update(row.child_id, 'comment', event.target.value)}
                />
              </li>
            ))}
          </ul>
        ) : null}
        {target === COMPETENCY && competency ? (
          <ul className="flex flex-col gap-3" aria-label="Phẩm chất, năng lực">
            {competency.rows.map((row) => (
              <li key={row.child_id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
                <span className="font-medium">{row.full_name}</span>
                {competency.items.map((item) => (
                  <label key={item.id} className="flex items-center justify-between gap-2 text-label">
                    {item.name}
                    <select
                      aria-label={`${item.name} của ${row.full_name}`}
                      value={marks[`${row.child_id}:${item.id}`] ?? ''}
                      disabled={!canEdit}
                      onChange={(event) => setMarks({ ...marks, [`${row.child_id}:${item.id}`]: event.target.value })}
                      className="rounded-lg border border-border bg-card px-2 py-1"
                    >
                      <option value="">-</option>
                      {levels.map((level) => (
                        <option key={level.code} value={level.code}>
                          {level.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </li>
            ))}
          </ul>
        ) : null}
        {canEdit ? (
          <Button variant="primary" disabled={busy} onClick={() => void save()}>
            Lưu đánh giá
          </Button>
        ) : null}
      </main>
    </div>
  );
}
