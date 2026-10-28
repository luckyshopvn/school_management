import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PERMISSION_CODES,
  RATING_LABELS,
  SCORE_TERM_LABELS,
  SUBJECT_PASS_LABELS,
  termAverage,
  type RatingCode,
  type SchoolLevelCode,
  type ScoreConfig,
} from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, StatusBadge, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { listClasses } from '../classes/classes-api.js';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import {
  lockScores,
  downloadScoreFile,
  importScoreSheet,
  messageOf,
  readScoreConfig,
  readScoreLocks,
  readScoreOverview,
  readScoreSheet,
  readScoreSummary,
  saveScoreConfig,
  saveScoreRatings,
  saveScoreSheet,
  unlockScores,
  type RatingTerm,
  type ScoreOverview,
  type ScoreRow,
  type TermType,
} from './scores-api.js';

// 7.14 Sổ điểm (DT-21 phần 21c, YCTD-170) theo Thông tư 22/2021: nhập điểm đánh giá thường xuyên, giữa kỳ, cuối kỳ và kết quả
// môn nhận xét theo môn của lớp; tổng hợp điểm trung bình, gợi ý và xác nhận xếp loại học tập, rèn luyện; khoá điểm; cấu hình
// hệ số, ngưỡng (Ban Giám hiệu). Máy chủ kiểm tra quyền nhập theo phân công, hạn nhập, khoá điểm
type Tab = 'entry' | 'summary' | 'locks' | 'config';
const TAB_LABELS: Record<Tab, string> = {
  entry: 'Nhập điểm',
  summary: 'Tổng hợp, xếp loại',
  locks: 'Khoá điểm',
  config: 'Cấu hình',
};
const SELECT_CLASS = 'rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
const CELL_INPUT = 'w-16 rounded border border-border bg-card px-2 py-1 text-content';
const RATING_OPTIONS = Object.entries(RATING_LABELS) as Array<[RatingCode, string]>;
// Ô điểm trong sổ: căn giữa; ô bắt buộc còn trống viền cam (theo mẫu thiết kế sổ điểm)
const scoreInputClass = (missing: boolean) =>
  `w-14 rounded border px-2 py-1 text-center text-content tabular-nums ${missing ? 'border-warning bg-warning/10' : 'border-border bg-card'}`;
// Viền ô tiêu đề, ô dữ liệu của bảng sổ điểm
const HEAD_CELL = 'border-b border-border py-2 font-semibold';
const GROUP_CELL = 'border-b border-l border-border py-2 font-semibold';
const BODY_CELL = 'border-b border-l border-border px-1.5 py-1.5 text-center';
const isBlank = (text: string) => text.trim() === '';
const formatWeight = (value: number) => String(value).replace('.', ',');

// Chú thích công thức điểm trung bình môn học kỳ theo hệ số đang cấu hình (cùng công thức termAverage)
function averageFormula(config: ScoreConfig): string {
  const { regular, mid, final } = config.weights;
  const times = (label: string, weight: number) => (weight === 1 ? label : `${label} × ${formatWeight(weight)}`);
  return (
    `TB môn học kỳ = (${times('tổng điểm TX', regular)} + ${times('Giữa kỳ', mid)} + ${times('Cuối kỳ', final)}) ÷ ` +
    `(${times('số cột TX', regular)} + ${formatWeight(mid + final)}). Tự tính khi đủ điểm giữa kỳ, cuối kỳ.`
  );
}

// Thẻ tiến độ nhập điểm: đếm học sinh còn thiếu điểm theo bản nháp đang nhập
function progressChip(label: string, missing: number, doneText: string) {
  return (
    <StatusBadge
      key={label}
      tone={missing === 0 ? 'success' : 'warning'}
      label={missing === 0 ? `${label}: ${doneText}` : `${label}: còn ${missing} học sinh`}
    />
  );
}

interface Draft {
  regular: string[];
  mid: string;
  final: string;
  result: string;
  comment: string;
}

const toDraft = (row: ScoreRow, slots: number): Draft => ({
  regular: Array.from({ length: Math.max(slots, row.regular.length) }, (_unused, index) =>
    row.regular[index] === undefined ? '' : String(row.regular[index]),
  ),
  mid: row.mid === null ? '' : String(row.mid),
  final: row.final === null ? '' : String(row.final),
  result: row.result ?? '',
  comment: row.comment ?? '',
});

const parse = (text: string): number | null | undefined => {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') {
    return null;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
};

function EntryTab({ overview, term, onSaved }: { overview: ScoreOverview; term: TermType; onSaved(m: string): void }) {
  const queryClient = useQueryClient();
  const classId = overview.class.id;
  const [subjectId, setSubjectId] = useState(overview.subjects[0]?.subject_id ?? '');
  const sheet = useQuery({
    queryKey: ['score-sheet', classId, subjectId, term],
    queryFn: () => readScoreSheet(classId, subjectId, term),
    enabled: subjectId !== '',
    retry: false,
  });
  const slots = overview.subjects.find((item) => item.subject_id === subjectId)?.required_regular ?? 2;
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  useEffect(() => {
    if (sheet.data) {
      setDrafts(Object.fromEntries(sheet.data.rows.map((row) => [row.child_id, toDraft(row, slots)])));
    }
  }, [sheet.data, slots]);
  const invalid = Object.values(drafts).some((draft) =>
    [...draft.regular, draft.mid, draft.final].some((text) => parse(text) === undefined),
  );
  const save = useMutation({
    mutationFn: () =>
      saveScoreSheet(
        classId,
        subjectId,
        term,
        Object.entries(drafts).map(([childId, draft]) => ({
          child_id: childId,
          regular: draft.regular.map((text) => parse(text) ?? null),
          mid: parse(draft.mid) ?? null,
          final: parse(draft.final) ?? null,
          result: draft.result === 'pass' || draft.result === 'fail' ? draft.result : null,
          comment: draft.comment.trim() || null,
        })),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['score-sheet'] });
      await queryClient.invalidateQueries({ queryKey: ['score-summary'] });
      onSaved('Đã ghi điểm');
    },
  });
  // Nhập từ Excel, tải mẫu, in sổ (YCTD-318): tệp mẫu là bảng điểm đang có của môn; nhập ghi như nút Ghi điểm
  const [fileError, setFileError] = useState<string>();
  const [importErrors, setImportErrors] = useState<Array<{ row: number; column: string | null; message: string }>>([]);
  const fileAction = (run: () => Promise<void>) => {
    setFileError(undefined);
    run().catch((error: unknown) => setFileError(messageOf(error)));
  };
  const importFile = useMutation({
    mutationFn: (file: File) => importScoreSheet(classId, subjectId, term, file),
    onSuccess: async (result) => {
      setImportErrors(result.errors);
      if (result.errors.length === 0) {
        await queryClient.invalidateQueries({ queryKey: ['score-sheet'] });
        await queryClient.invalidateQueries({ queryKey: ['score-summary'] });
        onSaved(`Đã nhập điểm của ${result.saved} học sinh`);
      }
    },
  });
  const change = (childId: string, patch: Partial<Draft>) =>
    setDrafts((current) => ({ ...current, [childId]: { ...(current[childId] as Draft), ...patch } }));
  const data = sheet.data;
  const isScore = data?.subject.mode === 'score';
  // Số cột thường xuyên: tối thiểu theo môn, thêm cột nếu đã có học sinh nhiều điểm hơn
  const width = Math.max(slots, ...Object.values(drafts).map((d) => d.regular.length));
  const headRows = isScore ? 2 : 1;
  const rowDrafts = (data?.rows ?? []).flatMap((row) => (drafts[row.child_id] ? [drafts[row.child_id] as Draft] : []));
  const chips =
    rowDrafts.length === 0
      ? []
      : isScore
        ? [
            progressChip(
              'Thường xuyên',
              rowDrafts.filter((draft) => draft.regular.filter((text) => !isBlank(text)).length < slots).length,
              `đã nhập đủ ${slots} cột`,
            ),
            progressChip('Giữa kỳ', rowDrafts.filter((draft) => isBlank(draft.mid)).length, 'đã nhập đủ'),
            progressChip('Cuối kỳ', rowDrafts.filter((draft) => isBlank(draft.final)).length, 'đã nhập đủ'),
          ]
        : [progressChip('Kết quả', rowDrafts.filter((draft) => draft.result === '').length, 'đã nhập đủ')];
  return (
    <section className="flex flex-col gap-4" aria-label="Nhập điểm">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <label className="flex min-w-48 flex-1 flex-col gap-2 text-label font-medium text-text sm:max-w-sm">
          Môn
          <select
            aria-label="Môn"
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value)}
            className={SELECT_CLASS}
          >
            {overview.subjects.map((item) => (
              <option key={item.subject_id} value={item.subject_id}>
                {item.subject_name}
                {overview.access.subject_ids.includes(item.subject_id) ? '' : ' (chỉ xem)'}
              </option>
            ))}
          </select>
        </label>
        {chips.length > 0 ? (
          <div className="flex flex-[3_1_20rem] flex-wrap justify-end gap-2" aria-label="Tiến độ nhập điểm">
            {chips}
          </div>
        ) : null}
        {data ? (
          <div className="flex flex-wrap gap-2">
            {data.can_edit ? (
              <>
                <Button onClick={() => fileAction(() => downloadScoreFile(classId, subjectId, term, 'template'))}>
                  Tải mẫu Excel
                </Button>
                <label className="relative inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-border bg-card px-4 text-content font-medium text-text hover:bg-selected focus-within:outline focus-within:outline-2 focus-within:outline-brand">
                  Nhập từ Excel
                  <input
                    type="file"
                    accept=".xlsx"
                    aria-label="Tệp điểm từ Excel"
                    className="absolute inset-0 cursor-pointer opacity-0"
                    disabled={importFile.isPending}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      if (file) {
                        setImportErrors([]);
                        importFile.mutate(file);
                      }
                    }}
                  />
                </label>
              </>
            ) : null}
            <Button onClick={() => fileAction(() => downloadScoreFile(classId, subjectId, term, 'print'))}>
              In sổ
            </Button>
          </div>
        ) : null}
        {data?.can_edit ? (
          <Button variant="primary" disabled={invalid || save.isPending} onClick={() => save.mutate()}>
            Ghi điểm
          </Button>
        ) : null}
      </div>
      {sheet.error ? <Alert tone="danger">{messageOf(sheet.error)}</Alert> : null}
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      {fileError ? <Alert tone="danger">{fileError}</Alert> : null}
      {importFile.error ? <Alert tone="danger">{messageOf(importFile.error)}</Alert> : null}
      {importErrors.length > 0 ? (
        <Alert tone="danger">
          <p>Tệp có {importErrors.length} lỗi, chưa ghi điểm nào. Sửa tệp rồi nhập lại:</p>
          <ul className="mt-1 list-disc pl-5" aria-label="Lỗi trong tệp điểm">
            {importErrors.slice(0, 20).map((error) => (
              <li key={`${error.row}-${error.column ?? ''}`}>
                Dòng {error.row}
                {error.column ? `, cột ${error.column}` : ''}: {error.message}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}
      {data ? (
        <>
          <p className="text-label text-text-secondary">
            {isScore
              ? `Cần ít nhất ${slots} điểm đánh giá thường xuyên. Điểm từ 0 đến 10, một chữ số thập phân.`
              : 'Môn đánh giá bằng nhận xét: chọn Đạt hoặc Chưa đạt.'}
            {data.deadline ? ` Hạn nhập: ${data.deadline}.` : ''}
            {data.locked ? ` Đã khoá bởi ${data.locked.locked_by_name}.` : ''}
          </p>
          {data.can_edit ? null : (
            <Alert tone="info">Bạn không nhập được môn này ở học kỳ này (chưa được phân công hoặc đã khoá).</Alert>
          )}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-content tabular-nums" aria-label="Bảng điểm">
                <thead className="bg-page text-label text-text-secondary">
                  <tr>
                    <th rowSpan={headRows} className={`${HEAD_CELL} w-12 pr-2 pl-4 text-left`}>
                      STT
                    </th>
                    <th rowSpan={headRows} className={`${HEAD_CELL} px-2 text-left`}>
                      Học sinh
                    </th>
                    {isScore ? (
                      <>
                        <th colSpan={width} className={`${GROUP_CELL} px-2 text-center`}>
                          Đánh giá thường xuyên
                        </th>
                        <th rowSpan={headRows} className={`${GROUP_CELL} px-2 text-center`}>
                          Giữa kỳ
                        </th>
                        <th rowSpan={headRows} className={`${GROUP_CELL} px-2 text-center`}>
                          Cuối kỳ
                        </th>
                        <th rowSpan={headRows} className={`${GROUP_CELL} px-2 text-center`}>
                          TB môn HK
                        </th>
                      </>
                    ) : (
                      <th rowSpan={headRows} className={`${GROUP_CELL} px-2 text-center`}>
                        Kết quả
                      </th>
                    )}
                    <th rowSpan={headRows} className={`${GROUP_CELL} pr-4 pl-2 text-left`}>
                      Nhận xét
                    </th>
                  </tr>
                  {isScore ? (
                    <tr>
                      {Array.from({ length: width }).map((_unused, index) => (
                        <th key={index} className="border-b border-l border-border px-2 py-1.5 font-medium">
                          TX{index + 1}
                        </th>
                      ))}
                    </tr>
                  ) : null}
                </thead>
                <tbody>
                  {data.rows.map((row, position) => {
                    const draft = drafts[row.child_id];
                    if (!draft) {
                      return null;
                    }
                    const values = draft.regular.map(parse);
                    const mid = parse(draft.mid);
                    const final = parse(draft.final);
                    const average =
                      values.some((v) => v === undefined) || mid === undefined || final === undefined
                        ? null
                        : termAverage(
                            { regular: values.filter((v): v is number => v !== null), mid, final },
                            overview.config as ScoreConfig,
                          );
                    return (
                      <tr key={row.child_id}>
                        <td className="border-b border-border py-2 pr-2 pl-4 text-text-secondary">{position + 1}</td>
                        <td className="whitespace-nowrap border-b border-border px-2 py-2 font-medium">
                          {row.full_name}
                        </td>
                        {isScore ? (
                          <>
                            {Array.from({ length: width }).map((_unused, index) => (
                              <td key={index} className={BODY_CELL}>
                                <input
                                  aria-label={`Điểm thường xuyên ${index + 1} ${row.full_name}`}
                                  inputMode="decimal"
                                  className={scoreInputClass(index < slots && isBlank(draft.regular[index] ?? ''))}
                                  disabled={!data.can_edit}
                                  value={draft.regular[index] ?? ''}
                                  onChange={(event) => {
                                    const next = [...draft.regular];
                                    next[index] = event.target.value;
                                    change(row.child_id, { regular: next });
                                  }}
                                />
                              </td>
                            ))}
                            <td className={BODY_CELL}>
                              <input
                                aria-label={`Giữa kỳ ${row.full_name}`}
                                inputMode="decimal"
                                className={scoreInputClass(isBlank(draft.mid))}
                                disabled={!data.can_edit}
                                value={draft.mid}
                                onChange={(event) => change(row.child_id, { mid: event.target.value })}
                              />
                            </td>
                            <td className={BODY_CELL}>
                              <input
                                aria-label={`Cuối kỳ ${row.full_name}`}
                                inputMode="decimal"
                                className={scoreInputClass(isBlank(draft.final))}
                                disabled={!data.can_edit}
                                value={draft.final}
                                onChange={(event) => change(row.child_id, { final: event.target.value })}
                              />
                            </td>
                            <td className={`${BODY_CELL} font-semibold`} data-testid={`average-${row.child_id}`}>
                              {average === null ? '' : average}
                            </td>
                          </>
                        ) : (
                          <td className={BODY_CELL}>
                            <select
                              aria-label={`Kết quả ${row.full_name}`}
                              className={SELECT_CLASS}
                              disabled={!data.can_edit}
                              value={draft.result}
                              onChange={(event) => change(row.child_id, { result: event.target.value })}
                            >
                              <option value="">Chưa nhập</option>
                              {Object.entries(SUBJECT_PASS_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </td>
                        )}
                        <td className="border-b border-l border-border py-1.5 pr-4 pl-2">
                          <input
                            aria-label={`Nhận xét ${row.full_name}`}
                            className={`${FORM_CONTROL_CLASS} min-w-40`}
                            disabled={!data.can_edit}
                            value={draft.comment}
                            onChange={(event) => change(row.child_id, { comment: event.target.value })}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {isScore ? (
              <div className="flex flex-wrap justify-between gap-3 px-4 py-3 text-label text-text-secondary">
                <span>{averageFormula(overview.config)}</span>
                <span>Ô viền cam: chưa nhập điểm</span>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}

function SummaryTab({ overview, onSaved }: { overview: ScoreOverview; onSaved(m: string): void }) {
  const queryClient = useQueryClient();
  const classId = overview.class.id;
  const [term, setTerm] = useState<RatingTerm>('first_term');
  const summary = useQuery({
    queryKey: ['score-summary', classId, term],
    queryFn: () => readScoreSummary(classId, term),
    retry: false,
  });
  const [drafts, setDrafts] = useState<Record<string, { learning: string; conduct: string; comment: string }>>({});
  useEffect(() => {
    if (summary.data) {
      setDrafts(
        Object.fromEntries(
          summary.data.rows.map((row) => [
            row.child_id,
            { learning: row.learning ?? '', conduct: row.conduct ?? '', comment: row.comment ?? '' },
          ]),
        ),
      );
    }
  }, [summary.data]);
  const save = useMutation({
    mutationFn: () =>
      saveScoreRatings(
        classId,
        term,
        Object.entries(drafts).map(([childId, draft]) => ({
          child_id: childId,
          learning: (draft.learning || null) as RatingCode | null,
          conduct: (draft.conduct || null) as RatingCode | null,
          comment: draft.comment.trim() || null,
        })),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['score-summary'] });
      onSaved('Đã ghi xếp loại');
    },
  });
  const data = summary.data;
  const patch = (childId: string, change: Partial<{ learning: string; conduct: string; comment: string }>) =>
    setDrafts((current) => ({
      ...current,
      [childId]: { learning: '', conduct: '', comment: '', ...current[childId], ...change },
    }));
  return (
    <section className="flex flex-col gap-3" aria-label="Tổng hợp, xếp loại">
      <label className="flex max-w-sm flex-col gap-2 text-label font-medium text-text">
        Kỳ tổng hợp
        <select value={term} onChange={(event) => setTerm(event.target.value as RatingTerm)} className={SELECT_CLASS}>
          {(['first_term', 'second_term', 'year'] as const).map((value) => (
            <option key={value} value={value}>
              {SCORE_TERM_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      {summary.error ? <Alert tone="danger">{messageOf(summary.error)}</Alert> : null}
      {data ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-content" aria-label="Tổng hợp điểm">
              <thead className="text-left text-label font-medium text-text-secondary">
                <tr>
                  <th className="px-2 py-2">Học sinh</th>
                  {data.subjects.map((subject) => (
                    <th key={subject.subject_id} className="px-2 py-2">
                      {subject.subject_name}
                    </th>
                  ))}
                  <th className="px-2 py-2">Gợi ý học tập</th>
                  <th className="px-2 py-2">Học tập</th>
                  <th className="px-2 py-2">Rèn luyện</th>
                  <th className="px-2 py-2">Nhận xét</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => {
                  const draft = drafts[row.child_id] ?? { learning: '', conduct: '', comment: '' };
                  return (
                    <tr key={row.child_id} className="border-t border-border">
                      <td className="px-2 py-2">{row.full_name}</td>
                      {row.subjects.map((item) => (
                        <td key={item.subject_id} className="px-2 py-2">
                          {item.average !== null ? item.average : item.passed ? SUBJECT_PASS_LABELS[item.passed] : ''}
                        </td>
                      ))}
                      <td className="px-2 py-2" data-testid={`suggested-${row.child_id}`}>
                        {row.suggested ? RATING_LABELS[row.suggested] : ''}
                      </td>
                      {(['learning', 'conduct'] as const).map((field) => (
                        <td key={field} className="px-2 py-2">
                          <select
                            aria-label={`${field === 'learning' ? 'Xếp loại học tập' : 'Xếp loại rèn luyện'} ${row.full_name}`}
                            className={SELECT_CLASS}
                            disabled={!data.can_rate || data.locked !== null}
                            value={draft[field]}
                            onChange={(event) => patch(row.child_id, { [field]: event.target.value })}
                          >
                            <option value="">Chưa xếp loại</option>
                            {RATING_OPTIONS.map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </td>
                      ))}
                      <td className="px-2 py-2">
                        <input
                          aria-label={`Nhận xét chung ${row.full_name}`}
                          className={`${FORM_CONTROL_CLASS} min-w-40`}
                          disabled={!data.can_rate || data.locked !== null}
                          value={draft.comment}
                          onChange={(event) => patch(row.child_id, { comment: event.target.value })}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
          {data.can_rate && !data.locked ? (
            <div className="flex gap-2">
              <Button
                onClick={() =>
                  setDrafts(
                    (current) =>
                      Object.fromEntries(
                        data.rows.map((row) => [
                          row.child_id,
                          { ...(current[row.child_id] ?? { conduct: '', comment: '' }), learning: row.suggested ?? '' },
                        ]),
                      ) as typeof current,
                  )
                }
              >
                Lấy gợi ý học tập
              </Button>
              <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
                Ghi xếp loại
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function LocksTab({ level, onSaved }: { level: SchoolLevelCode; onSaved(m: string): void }) {
  const queryClient = useQueryClient();
  const [term, setTerm] = useState<TermType>('first_term');
  const [reason, setReason] = useState('');
  const locks = useQuery({ queryKey: ['score-locks', term, level], queryFn: () => readScoreLocks(term, level) });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['score-locks'] });
    await queryClient.invalidateQueries({ queryKey: ['score-overview'] });
    onSaved(message);
  };
  const lock = useMutation({ mutationFn: () => lockScores(term, level), onSuccess: () => refresh('Đã khoá điểm') });
  const unlock = useMutation({
    mutationFn: (classId: string) => unlockScores(term, classId, reason),
    onSuccess: () => refresh('Đã mở khoá điểm'),
  });
  return (
    <section className="flex flex-col gap-3" aria-label="Khoá điểm">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-2 text-label font-medium text-text">
          Học kỳ
          <select value={term} onChange={(event) => setTerm(event.target.value as TermType)} className={SELECT_CLASS}>
            <option value="first_term">{SCORE_TERM_LABELS.first_term}</option>
            <option value="second_term">{SCORE_TERM_LABELS.second_term}</option>
          </select>
        </label>
        <Button variant="primary" disabled={lock.isPending} onClick={() => lock.mutate()}>
          Khoá điểm mọi lớp
        </Button>
        <label className="flex flex-col gap-2 text-label font-medium text-text">
          Lý do mở khoá
          <input className={FORM_CONTROL_CLASS} value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
      </div>
      {lock.error ? <Alert tone="danger">{messageOf(lock.error)}</Alert> : null}
      {unlock.error ? <Alert tone="danger">{messageOf(unlock.error)}</Alert> : null}
      <table className="w-full text-content" aria-label="Trạng thái khoá điểm">
        <tbody>
          {(locks.data?.classes ?? []).map((row) => (
            <tr key={row.class_id} className="border-t border-border">
              <td className="px-2 py-2">{row.class_name}</td>
              <td className="px-2 py-2">
                {row.locked_by_name ? (
                  <StatusBadge tone="success" label={`Đã khoá bởi ${row.locked_by_name}`} />
                ) : (
                  <StatusBadge tone="neutral" label="Chưa khoá" />
                )}
              </td>
              <td className="px-2 py-2 text-right">
                {row.locked_by_name ? (
                  <Button
                    variant="text"
                    disabled={reason.trim().length < 3}
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
    </section>
  );
}

function ConfigTab({ level, onSaved }: { level: SchoolLevelCode; onSaved(m: string): void }) {
  const queryClient = useQueryClient();
  const config = useQuery({ queryKey: ['score-config', level], queryFn: () => readScoreConfig(level) });
  const [draft, setDraft] = useState<ScoreConfig>();
  useEffect(() => setDraft(config.data?.config), [config.data]);
  const save = useMutation({
    mutationFn: () => saveScoreConfig(level, draft as ScoreConfig),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['score-config'] });
      await queryClient.invalidateQueries({ queryKey: ['score-overview'] });
      onSaved('Đã ghi cấu hình sổ điểm');
    },
  });
  if (!draft) {
    return null;
  }
  const num = (value: string) => Number(value.replace(',', '.'));
  return (
    <section className="flex flex-col gap-3" aria-label="Cấu hình sổ điểm">
      <p className="text-label text-text-secondary">
        Hệ số, số tuần học và ngưỡng xếp loại học tập theo Thông tư 22/2021; đối chiếu văn bản gốc trước khi sửa.
      </p>
      <div className="flex flex-wrap gap-4">
        {(['regular', 'mid', 'final'] as const).map((kind) => (
          <label key={kind} className="flex flex-col gap-2 text-label font-medium text-text">
            {`Hệ số ${kind === 'regular' ? 'thường xuyên' : kind === 'mid' ? 'giữa kỳ' : 'cuối kỳ'}`}
            <input
              className={CELL_INPUT}
              value={draft.weights[kind]}
              onChange={(event) =>
                setDraft({ ...draft, weights: { ...draft.weights, [kind]: num(event.target.value) } })
              }
            />
          </label>
        ))}
        <label className="flex flex-col gap-2 text-label font-medium text-text">
          Số tuần học
          <input
            className={CELL_INPUT}
            value={draft.weeks_per_year}
            onChange={(event) => setDraft({ ...draft, weeks_per_year: num(event.target.value) })}
          />
        </label>
      </div>
      <table className="w-full text-content" aria-label="Ngưỡng xếp loại học tập">
        <thead className="text-left text-label font-medium text-text-secondary">
          <tr>
            <th className="px-2 py-2">Mức</th>
            <th className="px-2 py-2">Số môn tối thiểu</th>
            <th className="px-2 py-2">Điểm trung bình môn từ</th>
            <th className="px-2 py-2">Toán hoặc Ngữ văn từ</th>
            <th className="px-2 py-2">Không môn nào dưới</th>
          </tr>
        </thead>
        <tbody>
          {draft.learning_rules.map((rule, index) => (
            <tr key={rule.code} className="border-t border-border">
              <td className="px-2 py-2">{RATING_LABELS[rule.code]}</td>
              {(['min_subjects', 'min_average', 'key_min_average', 'floor_average'] as const).map((field) => (
                <td key={field} className="px-2 py-2">
                  <input
                    aria-label={`${RATING_LABELS[rule.code]} ${field}`}
                    className={CELL_INPUT}
                    value={rule[field]}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        learning_rules: draft.learning_rules.map((item, position) =>
                          position === index ? { ...item, [field]: num(event.target.value) } : item,
                        ),
                      })
                    }
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <div>
        <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
          Ghi cấu hình
        </Button>
      </div>
    </section>
  );
}

export function ScoresPage() {
  const canManage = useHasPermission(PERMISSION_CODES.assessmentManage);
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const [tab, setTab] = useState<Tab>('entry');
  const [classId, setClassId] = useState('');
  const [term, setTerm] = useState<TermType>('first_term');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const classes = useQuery({
    queryKey: ['classes', orgUnitId],
    queryFn: () => listClasses(orgUnitId ?? ''),
    enabled: orgUnitId !== undefined,
  });
  const secondaryClasses = (classes.data ?? []).filter(
    (item) => item.status === 'active' && (item.school_level === 'THCS' || item.school_level === 'THPT'),
  );
  const selectedClassId = classId || secondaryClasses[0]?.id || '';
  const overview = useQuery({
    queryKey: ['score-overview', selectedClassId],
    queryFn: () => readScoreOverview(selectedClassId),
    enabled: selectedClassId !== '',
    retry: false,
  });
  const level: SchoolLevelCode = overview.data?.class.school_level ?? 'THCS';
  const tabs = (Object.keys(TAB_LABELS) as Tab[]).filter(
    (code) => canManage || (code !== 'locks' && code !== 'config'),
  );
  const termInfo = overview.data?.terms.find((item) => item.term_type === term);
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-page-title font-bold text-text">{menuPageTitle('/scores')}</h1>
          <p className="mt-1 text-label text-text-secondary">
            {[
              overview.data ? `Sổ điểm lớp ${overview.data.class.name}` : '',
              SCORE_TERM_LABELS[term],
              'đánh giá theo Thông tư 22/2021',
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-4">
          <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
          <label className="flex flex-col gap-2 text-label font-medium text-text">
            Lớp
            <select
              value={selectedClassId}
              onChange={(event) => setClassId(event.target.value)}
              className={SELECT_CLASS}
              aria-label="Lớp THCS, THPT"
            >
              {secondaryClasses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-label font-medium text-text">
            Học kỳ
            <select value={term} onChange={(event) => setTerm(event.target.value as TermType)} className={SELECT_CLASS}>
              <option value="first_term">{SCORE_TERM_LABELS.first_term}</option>
              <option value="second_term">{SCORE_TERM_LABELS.second_term}</option>
            </select>
          </label>
          {termInfo?.locked ? <StatusBadge tone="success" label="Đã khoá điểm" /> : null}
        </div>
        {classes.data && secondaryClasses.length === 0 ? (
          <Alert tone="info">Đơn vị chưa có lớp THCS, THPT đang hoạt động.</Alert>
        ) : null}
        {overview.error ? <Alert tone="danger">{messageOf(overview.error)}</Alert> : null}
        {/* Thẻ chức năng dạng gạch chân theo mẫu thiết kế; nút chính của màn hình là Ghi điểm */}
        <div role="tablist" className="flex flex-wrap gap-1 border-b border-border">
          {tabs.map((code) => (
            <button
              key={code}
              type="button"
              role="tab"
              aria-selected={tab === code}
              onClick={() => setTab(code)}
              className={`-mb-px min-h-11 border-b-2 px-3.5 text-label ${
                tab === code
                  ? 'border-brand font-semibold text-brand-strong'
                  : 'border-transparent font-medium text-text-secondary hover:text-text'
              }`}
            >
              {TAB_LABELS[code]}
            </button>
          ))}
        </div>
        {tab === 'entry' && overview.data ? (
          <EntryTab key={`${selectedClassId}-${term}`} overview={overview.data} term={term} onSaved={setToastMessage} />
        ) : null}
        {tab === 'summary' && overview.data ? (
          <SummaryTab key={selectedClassId} overview={overview.data} onSaved={setToastMessage} />
        ) : null}
        {tab === 'locks' && canManage ? <LocksTab level={level} onSaved={setToastMessage} /> : null}
        {tab === 'config' && canManage ? <ConfigTab level={level} onSaved={setToastMessage} /> : null}
      </div>
    </AppShell>
  );
}
