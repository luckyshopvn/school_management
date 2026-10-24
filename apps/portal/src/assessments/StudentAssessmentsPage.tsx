import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { COMPETENCY_GROUP_LABELS, PERMISSION_CODES, YEAR_RESULT_LABELS } from '@school-management/shared';
import { Alert, Button, StatusBadge, TextField, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { listClasses } from '../classes/classes-api.js';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import {
  addComment,
  confirmYearResults,
  loadDefaults,
  lockPeriod,
  messageOf,
  readComments,
  readCompetencySheet,
  readConfig,
  readLocks,
  readOverview,
  readSubjectSheet,
  readSummary,
  readYearResults,
  saveCompetencySheet,
  saveSubjectSheet,
  unlockPeriod,
  updatePeriod,
  type ClassOverview,
  type YearResultCode,
} from './assessments-api.js';

// 7.3 Đánh giá học sinh (DT-20 phần 20c, YCTD-161) theo Thông tư 27/2020: nhập kết quả định kỳ (môn học, hoạt động: mức,
// điểm bài kiểm tra; phẩm chất, năng lực), nhận xét thường xuyên, bảng tổng hợp cuối kỳ, tổng hợp cuối năm, khoá số liệu và
// cấu hình (Ban Giám hiệu). Máy chủ kiểm tra quyền nhập theo phân công, hạn nhập, khoá số liệu
type Tab = 'entry' | 'comments' | 'summary' | 'year' | 'locks' | 'config';
const TAB_LABELS: Record<Tab, string> = {
  entry: 'Nhập kết quả',
  comments: 'Nhận xét thường xuyên',
  summary: 'Tổng hợp cuối kỳ',
  year: 'Cuối năm',
  locks: 'Khoá số liệu',
  config: 'Cấu hình',
};
const SELECT_CLASS = 'rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
const COMPETENCY = 'competency';

const vietnamToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

function EntryTab({
  overview,
  periodId,
  onSaved,
}: {
  overview: ClassOverview;
  periodId: string;
  onSaved(m: string): void;
}) {
  const [target, setTarget] = useState(overview.subjects[0]?.subject_id ?? COMPETENCY);
  const classId = overview.class.id;
  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-label font-medium text-text">
        Nội dung đánh giá
        <select value={target} onChange={(event) => setTarget(event.target.value)} className={SELECT_CLASS}>
          {overview.subjects.map((subject) => (
            <option key={subject.subject_id} value={subject.subject_id}>
              {subject.subject_name}
            </option>
          ))}
          <option value={COMPETENCY}>Phẩm chất, năng lực</option>
        </select>
      </label>
      {target === COMPETENCY ? (
        <CompetencyEntry key={`${classId}-${periodId}`} overview={overview} periodId={periodId} onSaved={onSaved} />
      ) : (
        <SubjectEntry
          key={`${classId}-${periodId}-${target}`}
          overview={overview}
          periodId={periodId}
          subjectId={target}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

function SubjectEntry({
  overview,
  periodId,
  subjectId,
  onSaved,
}: {
  overview: ClassOverview;
  periodId: string;
  subjectId: string;
  onSaved(message: string): void;
}) {
  const classId = overview.class.id;
  const sheet = useQuery({
    queryKey: ['assessment-subject', classId, subjectId, periodId],
    queryFn: () => readSubjectSheet(classId, subjectId, periodId),
    retry: false,
  });
  const [draft, setDraft] = useState<Record<string, { level_code: string; score: string; comment: string }>>({});
  useEffect(() => {
    if (sheet.data) {
      setDraft(
        Object.fromEntries(
          sheet.data.rows.map((row) => [
            row.child_id,
            {
              level_code: row.result?.level_code ?? '',
              score: row.result?.score === null || row.result?.score === undefined ? '' : String(row.result.score),
              comment: row.result?.comment ?? '',
            },
          ]),
        ),
      );
    }
  }, [sheet.data]);
  const save = useMutation({
    mutationFn: () =>
      saveSubjectSheet(
        classId,
        subjectId,
        periodId,
        (sheet.data?.rows ?? []).map((row) => {
          const value = draft[row.child_id];
          return {
            child_id: row.child_id,
            level_code: value?.level_code || null,
            score: value?.score ? Number(value.score) : null,
            comment: value?.comment || null,
          };
        }),
      ),
    onSuccess: () => onSaved('Đã lưu kết quả môn học'),
  });
  const levels = overview.levels.filter((level) => level.scale === 'subject');
  const templates = overview.templates.filter((item) => item.target !== 'competency');
  if (sheet.error) {
    return <Alert tone="warning">{messageOf(sheet.error)}</Alert>;
  }
  const data = sheet.data;
  if (!data) {
    return null;
  }
  const set = (childId: string, field: 'level_code' | 'score' | 'comment', value: string) =>
    setDraft({
      ...draft,
      [childId]: { ...(draft[childId] ?? { level_code: '', score: '', comment: '' }), [field]: value },
    });
  return (
    <section className="flex flex-col gap-3" aria-label="Bảng nhập kết quả môn học">
      <p className="text-label text-text-secondary">
        {data.locked ? `Đã khoá số liệu (${data.locked.locked_by_name}). ` : ''}
        {data.deadline ? `Hạn nhập ${data.deadline.split('-').reverse().join('/')}. ` : ''}
        {data.has_test ? 'Kỳ này có bài kiểm tra định kỳ (điểm 1 đến 10).' : 'Kỳ này không có bài kiểm tra định kỳ.'}
        {data.can_edit ? '' : ' Bạn chỉ xem.'}
      </p>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <table className="w-full text-content">
        <thead className="text-left text-label font-medium text-text-secondary">
          <tr>
            <th className="px-2 py-2">Học sinh</th>
            <th className="px-2 py-2">Mức đạt</th>
            {data.has_test ? <th className="px-2 py-2">Điểm KTĐK</th> : null}
            <th className="px-2 py-2">Nhận xét</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={row.child_id} className="border-t border-border">
              <td className="px-2 py-2 font-medium">{row.full_name}</td>
              <td className="px-2 py-2">
                <select
                  aria-label={`Mức đạt của ${row.full_name}`}
                  value={draft[row.child_id]?.level_code ?? ''}
                  disabled={!data.can_edit}
                  onChange={(event) => set(row.child_id, 'level_code', event.target.value)}
                  className="rounded-lg border border-border bg-card px-2 py-1"
                >
                  <option value="">Chưa nhập</option>
                  {levels.map((level) => (
                    <option key={level.code} value={level.code}>
                      {level.name}
                    </option>
                  ))}
                </select>
              </td>
              {data.has_test ? (
                <td className="px-2 py-2">
                  <input
                    aria-label={`Điểm của ${row.full_name}`}
                    inputMode="numeric"
                    className="w-16 rounded-lg border border-border bg-card px-2 py-1"
                    value={draft[row.child_id]?.score ?? ''}
                    disabled={!data.can_edit}
                    onChange={(event) => set(row.child_id, 'score', event.target.value.replace(/\D/g, '').slice(0, 2))}
                  />
                </td>
              ) : null}
              <td className="px-2 py-2">
                <input
                  aria-label={`Nhận xét của ${row.full_name}`}
                  list="assessment-templates"
                  className="w-full rounded-lg border border-border bg-card px-2 py-1"
                  value={draft[row.child_id]?.comment ?? ''}
                  disabled={!data.can_edit}
                  onChange={(event) => set(row.child_id, 'comment', event.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <datalist id="assessment-templates">
        {templates.map((item) => (
          <option key={item.id} value={item.content} />
        ))}
      </datalist>
      {data.can_edit ? (
        <div>
          <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
            Lưu kết quả
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function CompetencyEntry({
  overview,
  periodId,
  onSaved,
}: {
  overview: ClassOverview;
  periodId: string;
  onSaved(message: string): void;
}) {
  const classId = overview.class.id;
  const sheet = useQuery({
    queryKey: ['assessment-competency', classId, periodId],
    queryFn: () => readCompetencySheet(classId, periodId),
    retry: false,
  });
  const [draft, setDraft] = useState<Record<string, string>>({});
  useEffect(() => {
    if (sheet.data) {
      setDraft(
        Object.fromEntries(
          sheet.data.rows.flatMap((row) =>
            row.results.map((result) => [`${row.child_id}:${result.item_id}`, result.level_code ?? '']),
          ),
        ),
      );
    }
  }, [sheet.data]);
  const save = useMutation({
    mutationFn: () =>
      saveCompetencySheet(
        classId,
        periodId,
        (sheet.data?.rows ?? []).flatMap((row) =>
          (sheet.data?.items ?? []).map((item) => ({
            child_id: row.child_id,
            item_id: item.id,
            level_code: draft[`${row.child_id}:${item.id}`] || null,
            comment: row.results.find((result) => result.item_id === item.id)?.comment ?? null,
          })),
        ),
      ),
    onSuccess: () => onSaved('Đã lưu phẩm chất, năng lực'),
  });
  if (sheet.error) {
    return <Alert tone="warning">{messageOf(sheet.error)}</Alert>;
  }
  const data = sheet.data;
  if (!data) {
    return null;
  }
  const levels = overview.levels.filter((level) => level.scale === 'competency');
  return (
    <section className="flex flex-col gap-3 overflow-x-auto" aria-label="Bảng nhập phẩm chất, năng lực">
      <p className="text-label text-text-secondary">
        {data.locked ? `Đã khoá số liệu (${data.locked.locked_by_name}). ` : ''}
        Mức: {levels.map((level) => `${level.code} = ${level.name}`).join(', ')}.{data.can_edit ? '' : ' Bạn chỉ xem.'}
      </p>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <table className="text-content">
        <thead className="text-left text-label font-medium text-text-secondary">
          <tr>
            <th className="px-2 py-2">Học sinh</th>
            {data.items.map((item) => (
              <th key={item.id} className="px-2 py-2" title={COMPETENCY_GROUP_LABELS[item.group_code]}>
                {item.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={row.child_id} className="border-t border-border">
              <td className="whitespace-nowrap px-2 py-2 font-medium">{row.full_name}</td>
              {data.items.map((item) => (
                <td key={item.id} className="px-2 py-2">
                  <select
                    aria-label={`${item.name} của ${row.full_name}`}
                    value={draft[`${row.child_id}:${item.id}`] ?? ''}
                    disabled={!data.can_edit}
                    onChange={(event) => setDraft({ ...draft, [`${row.child_id}:${item.id}`]: event.target.value })}
                    className="rounded-lg border border-border bg-card px-1 py-1"
                  >
                    <option value="">-</option>
                    {levels.map((level) => (
                      <option key={level.code} value={level.code}>
                        {level.code}
                      </option>
                    ))}
                  </select>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.can_edit ? (
        <div>
          <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
            Lưu phẩm chất, năng lực
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function CommentsTab({ overview, onSaved }: { overview: ClassOverview; onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const classId = overview.class.id;
  const today = vietnamToday();
  const from = `${today.slice(0, 7)}-01`;
  const comments = useQuery({
    queryKey: ['assessment-comments', classId, from],
    queryFn: () => readComments(classId, from, today),
  });
  const overviewStudents = useQuery({
    queryKey: ['assessment-competency-students', classId],
    queryFn: () => readCompetencySheet(classId, overview.periods[0]?.id ?? ''),
    enabled: overview.periods.length > 0,
    retry: false,
  });
  const students = overviewStudents.data?.rows ?? [];
  const [childId, setChildId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [content, setContent] = useState('');
  const selectedChild = childId || students[0]?.child_id || '';
  const add = useMutation({
    mutationFn: () =>
      addComment(classId, { child_id: selectedChild, subject_id: subjectId || null, date: today, content }),
    onSuccess: async () => {
      setContent('');
      await queryClient.invalidateQueries({ queryKey: ['assessment-comments', classId] });
      onSaved('Đã ghi nhận xét');
    },
  });
  const nameOf = (id: string) => students.find((row) => row.child_id === id)?.full_name ?? '';
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-2 text-label font-medium text-text">
          Học sinh
          <select value={selectedChild} onChange={(event) => setChildId(event.target.value)} className={SELECT_CLASS}>
            {students.map((row) => (
              <option key={row.child_id} value={row.child_id}>
                {row.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-label font-medium text-text">
          Môn học
          <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)} className={SELECT_CLASS}>
            <option value="">Chung</option>
            {overview.subjects.map((subject) => (
              <option key={subject.subject_id} value={subject.subject_id}>
                {subject.subject_name}
              </option>
            ))}
          </select>
        </label>
        <TextField label="Nhận xét" value={content} onChange={(event) => setContent(event.target.value)} />
        <Button
          variant="primary"
          disabled={add.isPending || content.trim() === '' || selectedChild === ''}
          onClick={() => add.mutate()}
        >
          Ghi nhận xét
        </Button>
      </div>
      {add.error ? <Alert tone="danger">{messageOf(add.error)}</Alert> : null}
      <ul className="flex flex-col gap-2 text-content" aria-label="Nhận xét thường xuyên trong tháng">
        {(comments.data ?? []).map((comment) => (
          <li key={comment.id} className="border-t border-border pt-2">
            <span className="font-medium">{nameOf(comment.child_id)}</span> ·{' '}
            {comment.comment_date.split('-').reverse().join('/')}
            {comment.subject_name ? ` · ${comment.subject_name}` : ''}: {comment.content}{' '}
            <span className="text-label text-text-secondary">({comment.author_name})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SummaryTab({ classId, periodId }: { classId: string; periodId: string }) {
  const summary = useQuery({
    queryKey: ['assessment-summary', classId, periodId],
    queryFn: () => readSummary(classId, periodId),
    retry: false,
  });
  if (summary.error) {
    return <Alert tone="warning">{messageOf(summary.error)}</Alert>;
  }
  const data = summary.data;
  if (!data) {
    return null;
  }
  const subjectLevels = data.levels.filter((level) => level.scale === 'subject');
  const competencyLevels = data.levels.filter((level) => level.scale === 'competency');
  return (
    <div className="flex flex-col gap-4 overflow-x-auto">
      <p className="text-content text-text-secondary">Sĩ số {data.student_count} học sinh.</p>
      <table className="text-content" aria-label="Tổng hợp môn học">
        <thead className="text-left text-label font-medium text-text-secondary">
          <tr>
            <th className="px-2 py-2">Môn học, hoạt động</th>
            {subjectLevels.map((level) => (
              <th key={level.code} className="px-2 py-2">
                {level.name}
              </th>
            ))}
            <th className="px-2 py-2">Chưa nhập</th>
            <th className="px-2 py-2">Điểm KTĐK (9-10 / 7-8 / 5-6 / dưới 5)</th>
          </tr>
        </thead>
        <tbody>
          {data.subjects.map((subject) => (
            <tr key={subject.subject_id} className="border-t border-border">
              <td className="px-2 py-2">{subject.subject_name}</td>
              {subjectLevels.map((level) => (
                <td key={level.code} className="px-2 py-2">
                  {subject.by_level[level.code] ?? 0}
                </td>
              ))}
              <td className="px-2 py-2">{subject.missing}</td>
              <td className="px-2 py-2">{subject.scores ? Object.values(subject.scores).join(' / ') : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="text-content" aria-label="Tổng hợp phẩm chất, năng lực">
        <thead className="text-left text-label font-medium text-text-secondary">
          <tr>
            <th className="px-2 py-2">Phẩm chất, năng lực</th>
            {competencyLevels.map((level) => (
              <th key={level.code} className="px-2 py-2">
                {level.name}
              </th>
            ))}
            <th className="px-2 py-2">Chưa nhập</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item) => (
            <tr key={item.id} className="border-t border-border">
              <td className="px-2 py-2">{item.name}</td>
              {competencyLevels.map((level) => (
                <td key={level.code} className="px-2 py-2">
                  {item.by_level[level.code] ?? 0}
                </td>
              ))}
              <td className="px-2 py-2">{item.missing}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function YearTab({ classId, onSaved }: { classId: string; onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const year = useQuery({
    queryKey: ['assessment-year', classId],
    queryFn: () => readYearResults(classId),
    retry: false,
  });
  const [draft, setDraft] = useState<Record<string, YearResultCode | ''>>({});
  useEffect(() => {
    if (year.data) {
      setDraft(
        Object.fromEntries(year.data.rows.map((row) => [row.child_id, row.confirmed?.result ?? row.suggested ?? ''])),
      );
    }
  }, [year.data]);
  const confirm = useMutation({
    mutationFn: () =>
      confirmYearResults(
        classId,
        (year.data?.rows ?? [])
          .filter((row) => draft[row.child_id])
          .map((row) => ({ child_id: row.child_id, result: draft[row.child_id] as YearResultCode, note: null })),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['assessment-year', classId] });
      onSaved('Đã xác nhận kết quả cuối năm');
    },
  });
  if (year.error) {
    return <Alert tone="warning">{messageOf(year.error)}</Alert>;
  }
  const data = year.data;
  if (!data) {
    return null;
  }
  return (
    <section className="flex flex-col gap-3" aria-label="Tổng hợp cuối năm">
      <p className="text-label text-text-secondary">
        Gợi ý theo Điều 9 Thông tư 27/2020 từ kết quả kỳ cuối năm; giáo viên chủ nhiệm xác nhận.
        {data.locked ? ` Đã khoá số liệu (${data.locked.locked_by_name}).` : ''}
      </p>
      {confirm.error ? <Alert tone="danger">{messageOf(confirm.error)}</Alert> : null}
      <table className="w-full text-content">
        <thead className="text-left text-label font-medium text-text-secondary">
          <tr>
            <th className="px-2 py-2">Học sinh</th>
            <th className="px-2 py-2">Gợi ý</th>
            <th className="px-2 py-2">Kết quả</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={row.child_id} className="border-t border-border">
              <td className="px-2 py-2 font-medium">{row.full_name}</td>
              <td className="px-2 py-2">{row.suggested ? YEAR_RESULT_LABELS[row.suggested] : 'Chưa đủ kết quả'}</td>
              <td className="px-2 py-2">
                <select
                  aria-label={`Kết quả cuối năm của ${row.full_name}`}
                  value={draft[row.child_id] ?? ''}
                  disabled={!data.can_confirm}
                  onChange={(event) => setDraft({ ...draft, [row.child_id]: event.target.value as YearResultCode })}
                  className="rounded-lg border border-border bg-card px-2 py-1"
                >
                  <option value="">Chưa xác nhận</option>
                  {(Object.keys(YEAR_RESULT_LABELS) as YearResultCode[]).map((code) => (
                    <option key={code} value={code}>
                      {YEAR_RESULT_LABELS[code]}
                    </option>
                  ))}
                </select>
                {row.confirmed ? (
                  <span className="ml-2 text-label text-text-secondary">({row.confirmed.confirmed_by_name})</span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.can_confirm ? (
        <div>
          <Button variant="primary" disabled={confirm.isPending} onClick={() => confirm.mutate()}>
            Xác nhận kết quả cuối năm
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function LocksTab({ periodId, onSaved }: { periodId: string; onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const locks = useQuery({ queryKey: ['assessment-locks', periodId], queryFn: () => readLocks(periodId) });
  const [reason, setReason] = useState('');
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['assessment-locks', periodId] });
    await queryClient.invalidateQueries({ queryKey: ['assessment-overview'] });
    onSaved(message);
  };
  const lockAll = useMutation({
    mutationFn: () => lockPeriod(periodId, null),
    onSuccess: (result) => refresh(`Đã khoá số liệu ${result.locked_class_count} lớp`),
  });
  const unlock = useMutation({
    mutationFn: (classId: string) => unlockPeriod(periodId, classId, reason),
    onSuccess: () => refresh('Đã mở khoá số liệu của lớp'),
  });
  const error = lockAll.error ?? unlock.error;
  return (
    <div className="flex flex-col gap-3">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <div className="flex flex-wrap items-end gap-3">
        <Button variant="primary" disabled={lockAll.isPending} onClick={() => lockAll.mutate()}>
          Khoá số liệu mọi lớp
        </Button>
        <TextField label="Lý do mở khoá" value={reason} onChange={(event) => setReason(event.target.value)} />
      </div>
      <table className="w-full text-content" aria-label="Khoá số liệu theo lớp">
        <tbody>
          {(locks.data?.classes ?? []).map((row) => (
            <tr key={row.class_id} className="border-t border-border">
              <td className="px-2 py-2">{row.class_name}</td>
              <td className="px-2 py-2">
                <StatusBadge
                  tone={row.locked_by_name ? 'success' : 'info'}
                  label={row.locked_by_name ? `Đã khoá (${row.locked_by_name})` : 'Chưa khoá'}
                />
              </td>
              <td className="px-2 py-2">
                {row.locked_by_name ? (
                  <Button
                    aria-label={`Mở khoá ${row.class_name}`}
                    disabled={unlock.isPending || reason.trim() === ''}
                    onClick={() => unlock.mutate(row.class_id)}
                  >
                    Mở khoá
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConfigTab({ onSaved }: { onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const config = useQuery({ queryKey: ['assessment-config'], queryFn: readConfig });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['assessment-config'] });
    await queryClient.invalidateQueries({ queryKey: ['assessment-overview'] });
    onSaved(message);
  };
  const defaults = useMutation({
    mutationFn: loadDefaults,
    onSuccess: () => refresh('Đã nạp cấu hình đánh giá theo Thông tư 27/2020'),
  });
  const deadline = useMutation({
    mutationFn: (input: { periodId: string; value: string }) =>
      updatePeriod(input.periodId, { entry_deadline: input.value || null }),
    onSuccess: () => refresh('Đã lưu hạn nhập'),
  });
  const data = config.data;
  return (
    <div className="flex flex-col gap-4">
      {(defaults.error ?? deadline.error) ? (
        <Alert tone="danger">{messageOf(defaults.error ?? deadline.error)}</Alert>
      ) : null}
      <div>
        <Button disabled={defaults.isPending} onClick={() => defaults.mutate()}>
          Nạp cấu hình mặc định (Thông tư 27/2020)
        </Button>
      </div>
      {data ? (
        <>
          <section aria-label="Mức đạt" className="text-content">
            <h3 className="font-semibold">Mức đạt</h3>
            <p>
              Môn học, hoạt động:{' '}
              {data.levels
                .filter((level) => level.scale === 'subject')
                .map((level) => level.name)
                .join(', ') || 'chưa có'}
            </p>
            <p>
              Phẩm chất, năng lực:{' '}
              {data.levels
                .filter((level) => level.scale === 'competency')
                .map((level) => level.name)
                .join(', ') || 'chưa có'}
            </p>
          </section>
          <section aria-label="Phẩm chất, năng lực" className="text-content">
            <h3 className="font-semibold">Phẩm chất, năng lực</h3>
            {(['quality', 'general', 'specific'] as const).map((group) => (
              <p key={group}>
                {COMPETENCY_GROUP_LABELS[group]}:{' '}
                {data.items
                  .filter((item) => item.group_code === group && item.status === 'active')
                  .map((item) => item.name)
                  .join(', ')}
              </p>
            ))}
          </section>
          <table className="w-full text-content" aria-label="Kỳ đánh giá">
            <thead className="text-left text-label font-medium text-text-secondary">
              <tr>
                <th className="px-2 py-2">Kỳ</th>
                <th className="px-2 py-2">Bài kiểm tra định kỳ</th>
                <th className="px-2 py-2">Hạn nhập (trống là cuối học kỳ)</th>
              </tr>
            </thead>
            <tbody>
              {data.periods.map((period) => (
                <tr key={period.id} className="border-t border-border">
                  <td className="px-2 py-2">{period.name}</td>
                  <td className="px-2 py-2">
                    {[
                      ...new Set(
                        data.tests.filter((test) => test.period_id === period.id).map((test) => test.subject_name),
                      ),
                    ].join(', ')}
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="date"
                      aria-label={`Hạn nhập ${period.name}`}
                      defaultValue={period.entry_deadline ?? ''}
                      className="rounded-lg border border-border bg-card px-2 py-1"
                      onBlur={(event) => {
                        if (event.target.value !== (period.entry_deadline ?? '')) {
                          deadline.mutate({ periodId: period.id, value: event.target.value });
                        }
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </div>
  );
}

export function StudentAssessmentsPage() {
  const canManage = useHasPermission(PERMISSION_CODES.assessmentManage);
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const [tab, setTab] = useState<Tab>('entry');
  const [classId, setClassId] = useState('');
  const [periodId, setPeriodId] = useState('');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const classes = useQuery({
    queryKey: ['classes', orgUnitId],
    queryFn: () => listClasses(orgUnitId ?? ''),
    enabled: orgUnitId !== undefined,
  });
  const primaryClasses = (classes.data ?? []).filter((item) => item.status === 'active' && item.school_level === 'TH');
  const selectedClassId = classId || primaryClasses[0]?.id || '';
  const overview = useQuery({
    queryKey: ['assessment-overview', selectedClassId],
    queryFn: () => readOverview(selectedClassId),
    enabled: selectedClassId !== '',
    retry: false,
  });
  const periods = overview.data?.periods ?? [];
  const selectedPeriodId = periodId || periods[0]?.id || '';
  const tabs = (Object.keys(TAB_LABELS) as Tab[]).filter(
    (code) => canManage || (code !== 'locks' && code !== 'config'),
  );
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/student-assessments')}</h1>
        <div className="flex flex-wrap items-end gap-4">
          <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
          <label className="flex flex-col gap-2 text-label font-medium text-text">
            Lớp
            <select
              value={selectedClassId}
              onChange={(event) => setClassId(event.target.value)}
              className={SELECT_CLASS}
            >
              {primaryClasses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-label font-medium text-text">
            Kỳ đánh giá
            <select
              value={selectedPeriodId}
              onChange={(event) => setPeriodId(event.target.value)}
              className={SELECT_CLASS}
            >
              {periods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.name}
                  {period.locked ? ' (đã khoá)' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Đánh giá học sinh">
          {tabs.map((code) => (
            <Button
              key={code}
              role="tab"
              aria-selected={tab === code}
              variant={tab === code ? 'primary' : 'secondary'}
              onClick={() => setTab(code)}
            >
              {TAB_LABELS[code]}
            </Button>
          ))}
        </div>
        {classes.data && primaryClasses.length === 0 ? <Alert tone="info">Đơn vị chưa có lớp Tiểu học.</Alert> : null}
        {overview.error ? <Alert tone="warning">{messageOf(overview.error)}</Alert> : null}
        {overview.data && periods.length === 0 && tab !== 'config' ? (
          <Alert tone="info">Chưa có kỳ đánh giá. Ban Giám hiệu nạp cấu hình ở thẻ Cấu hình.</Alert>
        ) : null}
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
          {tab === 'config' ? <ConfigTab onSaved={setToastMessage} /> : null}
          {tab === 'locks' && selectedPeriodId ? (
            <LocksTab periodId={selectedPeriodId} onSaved={setToastMessage} />
          ) : null}
          {overview.data && selectedPeriodId && tab === 'entry' ? (
            <EntryTab overview={overview.data} periodId={selectedPeriodId} onSaved={setToastMessage} />
          ) : null}
          {overview.data && tab === 'comments' ? (
            <CommentsTab overview={overview.data} onSaved={setToastMessage} />
          ) : null}
          {overview.data && selectedPeriodId && tab === 'summary' ? (
            <SummaryTab classId={selectedClassId} periodId={selectedPeriodId} />
          ) : null}
          {overview.data && tab === 'year' ? <YearTab classId={selectedClassId} onSaved={setToastMessage} /> : null}
        </section>
      </div>
    </AppShell>
  );
}
