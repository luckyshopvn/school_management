import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES, TIMETABLE_WEEKDAY_LABELS, type SchoolLevelCode } from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, StatusBadge, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError, requestJson } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { useEnabledSchoolLevels } from '../school-levels/enabled-levels.js';
import { readClassTeaching } from '../subjects/subjects-api.js';
import { checkClassLessons } from './timetable-generator-api.js';
import { lessonTone } from './lesson-tone.js';
import {
  createTimetableVersion,
  deleteTimetableVersion,
  downloadTimetableTemplate,
  exportTimetableVersion,
  importTimetable,
  listTimetableVersions,
  publishTimetable,
  readConflicts,
  readVersionLessons,
  saveClassLessons,
  type PeriodSlot,
  type TimetableLesson,
  type TimetableVersion,
} from './timetables-api.js';

// 7.4 Thời khoá biểu (DT-20 phần 22c1, YCTD-160): bản thời khoá biểu theo cấp (nháp, đã ban hành, đang áp dụng); lưới thứ ×
// tiết xem theo lớp, giáo viên hoặc phòng; bản nháp sửa theo lớp (chọn môn của khối lớp, giáo viên theo phân công), nhập
// Excel, kiểm tra xung đột, ban hành. Bản đã ban hành chỉ đọc; tạo bản nháp mới chép từ bản cũ để sửa. Máy xếp tự động là 22c2
const messageOf = (error: unknown) =>
  error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';

const DAYS = [1, 2, 3, 4, 5, 6];
const SOURCE_LABELS: Record<TimetableVersion['source'], string> = {
  manual: 'Nhập tay',
  import: 'Nhập Excel',
  generator: 'Máy xếp',
};

interface ClassOption {
  id: string;
  name: string;
  school_level: SchoolLevelCode;
  status: string;
}

function VersionForm({
  level,
  versions,
  onCreated,
}: {
  level: SchoolLevelCode;
  versions: TimetableVersion[];
  onCreated(version: TimetableVersion): void;
}) {
  const [name, setName] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [copyFrom, setCopyFrom] = useState('');
  const create = useMutation({
    mutationFn: () =>
      createTimetableVersion({
        school_level: level,
        name,
        effective_from: effectiveFrom,
        copy_from_id: copyFrom || null,
      }),
    onSuccess: (version) => {
      setName('');
      setEffectiveFrom('');
      setCopyFrom('');
      onCreated(version);
    },
  });
  return (
    <form
      aria-label="Tạo bản thời khoá biểu"
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      <label className="text-label font-medium text-text">
        Tên bản
        <input
          aria-label="Tên bản"
          className={`mt-2 block ${FORM_CONTROL_CLASS}`}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="text-label font-medium text-text">
        Áp dụng từ ngày
        <input
          type="date"
          aria-label="Áp dụng từ ngày"
          className={`mt-2 block ${FORM_CONTROL_CLASS}`}
          value={effectiveFrom}
          onChange={(event) => setEffectiveFrom(event.target.value)}
        />
      </label>
      <label className="text-label font-medium text-text">
        Chép từ bản
        <select
          aria-label="Chép từ bản"
          className={`mt-2 block ${FORM_CONTROL_CLASS}`}
          value={copyFrom}
          onChange={(event) => setCopyFrom(event.target.value)}
        >
          <option value="">Bản trống</option>
          {versions.map((version) => (
            <option key={version.id} value={version.id}>
              {version.name}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" variant="primary" disabled={!name || !effectiveFrom || create.isPending}>
        Tạo bản nháp
      </Button>
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
    </form>
  );
}

// Lưới thứ × tiết; ô hiện môn và giáo viên (xem theo lớp) hoặc lớp và môn (xem theo giáo viên, phòng)
export function ReadOnlyGrid({
  slots,
  lessons,
  mode,
}: {
  slots: PeriodSlot[];
  lessons: TimetableLesson[];
  mode: 'class' | 'teacher' | 'room';
}) {
  const periods =
    slots.length > 0 ? slots.map((slot) => slot.period_no) : [...new Set(lessons.map((lesson) => lesson.period_no))];
  const firstAfternoon = slots.find((slot) => slot.session === 'afternoon')?.period_no;
  const hasMorning = slots.some((slot) => slot.session === 'morning');
  return (
    <div className={GRID_FRAME_CLASS}>
      <table className="w-full min-w-[48rem] border-collapse text-content" aria-label="Lưới thời khoá biểu">
        <GridHead />
        <tbody>
          {periods.map((period) => {
            const slot = slots.find((item) => item.period_no === period);
            return (
              <Fragment key={period}>
                {/* Dải "Buổi chiều" ngăn hai buổi khi khung giờ có cả buổi sáng (mẫu thiết kế) */}
                {hasMorning && period === firstAfternoon ? <SessionBreak /> : null}
                <tr className="border-b border-border last:border-b-0">
                  <th scope="row" className="w-24 px-3 py-2.5 text-left align-top font-semibold">
                    Tiết {period}
                    {slot ? (
                      <span className="block text-label font-normal text-text-secondary">{slot.start_time}</span>
                    ) : null}
                  </th>
                  {DAYS.map((day) => (
                    <td key={day} className="border-l border-border p-1.5 align-top">
                      <div className="flex flex-col gap-1">
                        {lessons
                          .filter((lesson) => lesson.weekday === day && lesson.period_no === period)
                          .map((lesson) => (
                            <span
                              key={lesson.id}
                              className={`flex min-h-13 flex-col gap-0.5 rounded-lg px-2.5 py-1.5 ${lessonTone(lesson.subject_id)}`}
                            >
                              <span className="text-label font-semibold">
                                {lesson.group_no > 0 ? `Nhóm ${lesson.group_no} · ` : ''}
                                {mode === 'class'
                                  ? lesson.subject_name
                                  : `${lesson.class_name} · ${lesson.subject_name}`}
                              </span>
                              <span className="text-label text-text">
                                {mode === 'teacher'
                                  ? (lesson.room_name ?? '')
                                  : (lesson.teacher_name ?? 'Chưa có giáo viên')}
                              </span>
                            </span>
                          ))}
                      </div>
                    </td>
                  ))}
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Khung, đầu cột và dải ngăn buổi dùng chung cho lưới xem và lưới sửa (mẫu thiết kế Timetable.dc.html: thẻ trắng viền mảnh, đầu cột
// nền nhạt, kẻ dọc giữa các thứ, cuộn ngang khi màn hình hẹp)
const GRID_FRAME_CLASS = 'overflow-x-auto rounded-xl border border-border bg-card';

function GridHead() {
  return (
    <thead className="border-b border-border bg-page text-left">
      <tr>
        <th className="w-24 px-3 py-3 text-label font-semibold text-text-secondary">Tiết</th>
        {DAYS.map((day) => (
          <th key={day} className="border-l border-border px-3 py-3 text-label font-semibold text-text">
            {TIMETABLE_WEEKDAY_LABELS[day]}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function SessionBreak() {
  return (
    <tr className="border-b border-border bg-page">
      <td colSpan={DAYS.length + 1} className="px-3 py-1.5 text-label font-semibold text-text-secondary">
        Buổi chiều
      </td>
    </tr>
  );
}

interface GroupRow {
  weekday: number;
  period_no: number;
  group_no: number;
  subject_id: string;
}

// Tiết học nhóm của lớp (THCS, THPT, DT-21 phần 21b): một lớp có thể tách nhóm học môn lựa chọn khác nhau cùng tiết; mỗi
// dòng là một tiết của một nhóm; tiết cả lớp ở lưới trên không được trùng ô với tiết nhóm
function GroupRowsEditor({
  rows,
  setRows,
  slots,
  subjects,
}: {
  rows: GroupRow[];
  setRows(rows: GroupRow[]): void;
  slots: PeriodSlot[];
  subjects: Array<{ id: string; name: string }>;
}) {
  const update = (index: number, changes: Partial<GroupRow>) =>
    setRows(rows.map((row, position) => (position === index ? { ...row, ...changes } : row)));
  return (
    <section className="flex flex-col gap-2" aria-label="Tiết học nhóm">
      <h3 className="text-section-title font-semibold text-text">Tiết học nhóm</h3>
      <p className="text-label text-text-secondary">
        Dùng cho môn học lựa chọn: các nhóm của lớp học môn khác nhau cùng một tiết. Ô đã có tiết cả lớp ở lưới trên
        không thêm tiết nhóm được.
      </p>
      {rows.map((row, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2">
          <select
            className={FORM_CONTROL_CLASS}
            aria-label={`Thứ của tiết nhóm ${index + 1}`}
            value={row.weekday}
            onChange={(event) => update(index, { weekday: Number(event.target.value) })}
          >
            {DAYS.map((day) => (
              <option key={day} value={day}>
                {TIMETABLE_WEEKDAY_LABELS[day]}
              </option>
            ))}
          </select>
          <select
            className={FORM_CONTROL_CLASS}
            aria-label={`Tiết của tiết nhóm ${index + 1}`}
            value={row.period_no}
            onChange={(event) => update(index, { period_no: Number(event.target.value) })}
          >
            {slots.map((slot) => (
              <option key={slot.period_no} value={slot.period_no}>
                Tiết {slot.period_no}
              </option>
            ))}
          </select>
          <select
            className={FORM_CONTROL_CLASS}
            aria-label={`Nhóm của tiết nhóm ${index + 1}`}
            value={row.group_no}
            onChange={(event) => update(index, { group_no: Number(event.target.value) })}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((group) => (
              <option key={group} value={group}>
                Nhóm {group}
              </option>
            ))}
          </select>
          <select
            className={FORM_CONTROL_CLASS}
            aria-label={`Môn của tiết nhóm ${index + 1}`}
            value={row.subject_id}
            onChange={(event) => update(index, { subject_id: event.target.value })}
          >
            <option value="">Chọn môn</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
          <Button
            aria-label={`Xóa tiết nhóm ${index + 1}`}
            onClick={() => setRows(rows.filter((_, position) => position !== index))}
          >
            Xóa
          </Button>
        </div>
      ))}
      <div>
        <Button
          disabled={slots.length === 0}
          onClick={() =>
            setRows([
              ...rows,
              {
                weekday: 1,
                period_no: slots[0]?.period_no ?? 1,
                group_no: Math.min((rows.at(-1)?.group_no ?? 0) + 1, 9),
                subject_id: '',
              },
            ])
          }
        >
          Thêm tiết nhóm
        </Button>
      </div>
    </section>
  );
}

// Sửa tiết của một lớp trong bản nháp: mỗi ô chọn một môn của khối lớp theo chương trình
function ClassEditor({
  versionId,
  classId,
  className,
  slots,
  lessons,
  allowGroups,
  onSaved,
}: {
  versionId: string;
  classId: string;
  className: string;
  slots: PeriodSlot[];
  lessons: TimetableLesson[];
  // THCS, THPT: thêm tiết học nhóm (DT-21 phần 21b)
  allowGroups: boolean;
  onSaved(message: string): void;
}) {
  const queryClient = useQueryClient();
  const teaching = useQuery({ queryKey: ['class-teaching', classId], queryFn: () => readClassTeaching(classId) });
  const [cells, setCells] = useState<Record<string, string>>({});
  // Tiết học nhóm: nhiều nhóm cùng ô, mỗi nhóm một môn lựa chọn (21b)
  const [groupRows, setGroupRows] = useState<GroupRow[]>([]);
  useEffect(() => {
    setCells(
      Object.fromEntries(
        lessons
          .filter((lesson) => lesson.group_no === 0)
          .map((lesson) => [`${lesson.weekday}:${lesson.period_no}`, lesson.subject_id]),
      ),
    );
    setGroupRows(
      lessons
        .filter((lesson) => lesson.group_no > 0)
        .map((lesson) => ({
          weekday: lesson.weekday,
          period_no: lesson.period_no,
          group_no: lesson.group_no,
          subject_id: lesson.subject_id,
        })),
    );
  }, [lessons]);
  const roomOf = (weekday: number, period: number, groupNo: number, subjectId: string) => {
    const existing = lessons.find(
      (lesson) => lesson.weekday === weekday && lesson.period_no === period && lesson.group_no === groupNo,
    );
    return existing?.subject_id === subjectId ? existing.room_id : null;
  };
  const cellInputs = [
    ...Object.entries(cells)
      .filter(([, subjectId]) => subjectId)
      .map(([key, subjectId]) => {
        const [weekday, period] = key.split(':').map(Number);
        return {
          weekday: weekday ?? 1,
          period_no: period ?? 1,
          subject_id: subjectId,
          room_id: roomOf(weekday ?? 1, period ?? 1, 0, subjectId),
          group_no: 0,
        };
      }),
    ...groupRows
      .filter((row) => row.subject_id)
      .map((row) => ({
        weekday: row.weekday,
        period_no: row.period_no,
        subject_id: row.subject_id,
        room_id: roomOf(row.weekday, row.period_no, row.group_no, row.subject_id),
        group_no: row.group_no,
      })),
  ].sort(
    (left, right) => left.weekday - right.weekday || left.period_no - right.period_no || left.group_no - right.group_no,
  );
  const save = useMutation({
    mutationFn: () => saveClassLessons(versionId, classId, cellInputs),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['version-lessons'] });
      await queryClient.invalidateQueries({ queryKey: ['timetable-conflicts'] });
      onSaved('Đã ghi thời khoá biểu của lớp');
    },
  });
  const subjects = teaching.data?.subjects ?? [];
  const counts = (subjectId: string) =>
    new Set([
      ...Object.entries(cells)
        .filter(([, value]) => value === subjectId)
        .map(([key]) => key),
      ...groupRows.filter((row) => row.subject_id === subjectId).map((row) => `${row.weekday}:${row.period_no}`),
    ]).size;
  // Kiểm tra ngay khi chỉnh tay (22c2): gửi các ô đang sửa sau 0,4 giây không gõ thêm, máy chủ trả xung đột nếu ghi
  const [checkedCells, setCheckedCells] = useState<string>();
  const cellsKey = JSON.stringify(cellInputs);
  const dirty =
    cellsKey !==
    JSON.stringify(
      [...lessons]
        .sort(
          (left, right) =>
            left.weekday - right.weekday || left.period_no - right.period_no || left.group_no - right.group_no,
        )
        .map((lesson) => ({
          weekday: lesson.weekday,
          period_no: lesson.period_no,
          subject_id: lesson.subject_id,
          room_id: lesson.room_id,
          group_no: lesson.group_no,
        })),
    );
  useEffect(() => {
    const timer = setTimeout(() => setCheckedCells(cellsKey), 400);
    return () => clearTimeout(timer);
  }, [cellsKey]);
  const check = useQuery({
    queryKey: ['timetable-check', versionId, classId, checkedCells],
    queryFn: () => checkClassLessons(versionId, classId, JSON.parse(checkedCells ?? '[]') as typeof cellInputs),
    enabled: dirty && checkedCells === cellsKey,
  });
  const relevant = (check.data ?? []).filter(
    (conflict) => conflict.class_id === classId || (!conflict.class_id && conflict.message.includes(className)),
  );
  const hardCells = new Set(
    relevant
      .filter((conflict) => conflict.severity === 'hard' && conflict.weekday && conflict.period_no)
      .map((conflict) => `${conflict.weekday}:${conflict.period_no}`),
  );
  return (
    <section className="flex flex-col gap-3" aria-label="Sửa thời khoá biểu của lớp">
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      {slots.length === 0 ? (
        <Alert tone="info">Chưa có khung giờ tiết học của cấp; khai báo ở 7.3 Khung giờ tiết học.</Alert>
      ) : null}
      <div className={GRID_FRAME_CLASS}>
        <table className="w-full min-w-[48rem] border-collapse text-content" aria-label="Lưới sửa thời khoá biểu">
          <GridHead />
          <tbody>
            {slots.map((slot, index) => (
              <Fragment key={slot.period_no}>
                {slot.session === 'afternoon' && slots[index - 1]?.session === 'morning' ? <SessionBreak /> : null}
                <tr className="border-b border-border last:border-b-0">
                  <th scope="row" className="w-24 px-3 py-2 text-left align-top font-semibold">
                    Tiết {slot.period_no}
                    <span className="block text-label font-normal text-text-secondary">{slot.start_time}</span>
                  </th>
                  {DAYS.map((day) => {
                    const key = `${day}:${slot.period_no}`;
                    // Ô có xung đột phải sửa: nền đỏ nhạt, viền đỏ như ô trùng lịch của mẫu thiết kế
                    return (
                      <td
                        key={day}
                        className={`border-l border-border p-1.5${hardCells.has(key) ? ' bg-danger/10' : ''}`}
                      >
                        <select
                          className={`${FORM_CONTROL_CLASS}${hardCells.has(key) ? ' border-danger' : ''}`}
                          aria-invalid={hardCells.has(key) || undefined}
                          aria-label={`${TIMETABLE_WEEKDAY_LABELS[day]} tiết ${slot.period_no}`}
                          value={cells[key] ?? ''}
                          onChange={(event) => setCells((current) => ({ ...current, [key]: event.target.value }))}
                        >
                          <option value="">—</option>
                          {subjects.map((subject) => (
                            <option key={subject.subject_id} value={subject.subject_id}>
                              {subject.subject_name}
                            </option>
                          ))}
                        </select>
                      </td>
                    );
                  })}
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {allowGroups ? (
        <GroupRowsEditor
          rows={groupRows}
          setRows={setGroupRows}
          slots={slots}
          subjects={subjects.map((subject) => ({ id: subject.subject_id, name: subject.subject_name }))}
        />
      ) : null}
      <ul className="flex flex-wrap gap-3 text-label text-text-secondary" aria-label="Số tiết đã xếp theo môn">
        {subjects.map((subject) => (
          <li key={subject.subject_id}>
            {subject.subject_name}: {counts(subject.subject_id)}/{subject.periods_per_week}
            {subject.assignment ? '' : ' (chưa phân công)'}
          </li>
        ))}
      </ul>
      {dirty && check.data ? (
        <section aria-label="Kiểm tra ngay" className="flex flex-col gap-1">
          {relevant.length === 0 ? (
            <Alert tone="success">Các ô đang sửa không gây xung đột.</Alert>
          ) : (
            <ul className="flex flex-col gap-1 text-content">
              {relevant.map((conflict, index) => (
                <li key={index} className={conflict.severity === 'hard' ? 'text-danger' : 'text-text-secondary'}>
                  {conflict.severity === 'hard' ? 'Phải sửa: ' : 'Cảnh báo: '}
                  {conflict.message}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
      <div>
        <Button variant="primary" disabled={save.isPending || slots.length === 0} onClick={() => save.mutate()}>
          Ghi thời khoá biểu của lớp
        </Button>
      </div>
    </section>
  );
}

type ViewMode = 'class' | 'teacher' | 'room';
const VIEW_MODES: Array<{ value: ViewMode; label: string }> = [
  { value: 'class', label: 'Theo lớp' },
  { value: 'teacher', label: 'Theo giáo viên' },
  { value: 'room', label: 'Theo phòng' },
];
const VIEW_PANEL_ID = 'timetable-view';

// Cách xem dạng nút chuyển (mẫu thiết kế, thay ô chọn "Xem theo"): mũi tên trái, phải chuyển giữa các cách xem theo mẫu thẻ của ARIA
function ViewModeTabs({ mode, onChange }: { mode: ViewMode; onChange(mode: ViewMode): void }) {
  const move = (step: number) => {
    const index = VIEW_MODES.findIndex((item) => item.value === mode);
    const next = VIEW_MODES[(index + step + VIEW_MODES.length) % VIEW_MODES.length];
    if (next) {
      onChange(next.value);
      document.getElementById(`${VIEW_PANEL_ID}-${next.value}`)?.focus();
    }
  };
  return (
    <div
      role="tablist"
      aria-label="Xem theo"
      className="flex gap-1 rounded-xl bg-border p-1"
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault();
          move(event.key === 'ArrowRight' ? 1 : -1);
        }
      }}
    >
      {VIEW_MODES.map((item) => {
        const selected = item.value === mode;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={`${VIEW_PANEL_ID}-${item.value}`}
            aria-selected={selected}
            aria-controls={VIEW_PANEL_ID}
            tabIndex={selected ? 0 : -1}
            className={`rounded-lg px-3.5 py-2 text-label ${
              selected ? 'bg-card font-semibold text-brand-strong' : 'font-medium text-text-secondary hover:text-text'
            }`}
            onClick={() => onChange(item.value)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function TimetablesPage() {
  const canManage = useHasPermission(PERMISSION_CODES.timetableManage);
  const enabled = useEnabledSchoolLevels();
  const levels = enabled.levels.filter((level) => level.value !== 'MN');
  const [chosenLevel, setChosenLevel] = useState<SchoolLevelCode>();
  const level = levels.find((item) => item.value === chosenLevel)?.value ?? levels[0]?.value;
  const queryClient = useQueryClient();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const versions = useQuery({
    queryKey: ['timetable-versions', level],
    queryFn: () => listTimetableVersions(level ?? 'TH'),
    enabled: Boolean(level),
  });
  const [versionId, setVersionId] = useState('');
  const version =
    versions.data?.find((item) => item.id === versionId) ??
    versions.data?.find((item) => item.is_current) ??
    versions.data?.[0];
  const classes = useQuery({
    queryKey: ['classes', 'level', level],
    queryFn: () => requestJson<ClassOption[]>(`/api/v1/classes?school_level=${level ?? 'TH'}&status=active`),
    enabled: Boolean(level),
  });
  const [mode, setMode] = useState<ViewMode>('class');
  const [target, setTarget] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string>();
  const all = useQuery({
    queryKey: ['version-lessons', version?.id, 'all'],
    queryFn: () => readVersionLessons(version?.id ?? ''),
    enabled: Boolean(version),
  });
  const filtered = useMemo(() => {
    const lessons = all.data?.lessons ?? [];
    return lessons.filter((lesson) =>
      mode === 'class'
        ? lesson.class_id === target
        : mode === 'teacher'
          ? lesson.teacher_user_id === target
          : lesson.room_id === target,
    );
  }, [all.data, mode, target]);
  const teachers = [
    ...new Map(
      (all.data?.lessons ?? [])
        .filter((lesson) => lesson.teacher_user_id)
        .map((lesson) => [lesson.teacher_user_id as string, lesson.teacher_name ?? '']),
    ),
  ];
  const rooms = [
    ...new Map(
      (all.data?.lessons ?? [])
        .filter((lesson) => lesson.room_id)
        .map((lesson) => [lesson.room_id as string, lesson.room_name ?? '']),
    ),
  ];
  const conflicts = useQuery({
    queryKey: ['timetable-conflicts', version?.id],
    queryFn: () => readConflicts(version?.id ?? ''),
    enabled: false,
  });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['timetable-versions'] });
    await queryClient.invalidateQueries({ queryKey: ['version-lessons'] });
  };
  const publish = useMutation({
    mutationFn: () => publishTimetable(version?.id ?? ''),
    onSuccess: async () => {
      await refresh();
      setToastMessage('Đã ban hành thời khoá biểu');
    },
  });
  const remove = useMutation({
    mutationFn: () => deleteTimetableVersion(version?.id ?? ''),
    onSuccess: async () => {
      setVersionId('');
      await refresh();
      setToastMessage('Đã xoá bản nháp');
    },
  });
  const [file, setFile] = useState<File>();
  const upload = useMutation({
    mutationFn: () => importTimetable(version?.id ?? '', file as File),
    onSuccess: async (result) => {
      await refresh();
      if (result.errors.length === 0) {
        setToastMessage(`Đã nhập ${result.imported} tiết của ${result.classes} lớp`);
      }
    },
  });
  const isDraft = version?.status === 'draft';
  const targetName =
    mode === 'class'
      ? classes.data?.find((item) => item.id === target)?.name
      : (mode === 'teacher' ? teachers : rooms).find(([id]) => id === target)?.[1];
  const hardConflicts = (conflicts.data ?? []).filter((conflict) => conflict.severity === 'hard').length;
  // Dòng mô tả dưới tiêu đề (mẫu thiết kế): bản đang mở, ngày áp dụng, đối tượng đang xem và số tiết mỗi tuần
  const summary = version
    ? [
        version.name,
        `Áp dụng từ ${version.effective_from.split('-').reverse().join('/')}`,
        ...(target && targetName && all.data ? [targetName, `${filtered.length} tiết mỗi tuần`] : []),
      ].join(' · ')
    : null;

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-page-title font-bold text-text">{menuPageTitle('/timetables')}</h1>
            {summary ? <p className="text-label text-text-secondary">{summary}</p> : null}
          </div>
          {canManage && level ? (
            <Link
              to="/timetable-generator"
              className="inline-flex items-center rounded-lg border border-border-strong bg-card px-4 py-2 text-label font-medium text-text hover:bg-selected max-xl:min-h-11"
            >
              Xếp tự động
            </Link>
          ) : null}
        </div>
        {!level ? (
          <Alert tone="info">Trường chưa bật cấp Tiểu học, THCS hoặc THPT; bật cấp học ở 1.4 Cấu hình trường.</Alert>
        ) : (
          <>
            {levels.length > 1 ? (
              <label className="text-label font-medium text-text">
                Cấp học
                <select
                  aria-label="Cấp học"
                  className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                  value={level}
                  onChange={(event) => setChosenLevel(event.target.value as SchoolLevelCode)}
                >
                  {levels.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <section className="flex flex-col gap-3" aria-label="Các bản thời khoá biểu">
              <h2 className="text-section-title font-semibold text-text">Các bản thời khoá biểu</h2>
              <div className={GRID_FRAME_CLASS}>
                <table className="w-full text-content" aria-label="Bản thời khoá biểu">
                  <thead className="border-b border-border bg-page text-left text-label font-semibold text-text-secondary">
                    <tr>
                      <th className="px-3 py-2">Tên bản</th>
                      <th className="px-3 py-2">Áp dụng từ</th>
                      <th className="px-3 py-2">Trạng thái</th>
                      <th className="px-3 py-2">Nguồn</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {(versions.data ?? []).map((item) => (
                      <tr key={item.id} className="border-t border-border" aria-current={item.id === version?.id}>
                        <td className="px-3 py-2">{item.name}</td>
                        <td className="px-3 py-2">{item.effective_from.split('-').reverse().join('/')}</td>
                        <td className="px-3 py-2">
                          <StatusBadge
                            tone={item.status === 'published' ? 'success' : 'neutral'}
                            label={
                              item.status === 'published' ? (item.is_current ? 'Đang áp dụng' : 'Đã ban hành') : 'Nháp'
                            }
                          />
                        </td>
                        <td className="px-3 py-2">{SOURCE_LABELS[item.source]}</td>
                        <td className="px-3 py-2 text-right">
                          <Button variant="text" onClick={() => setVersionId(item.id)}>
                            Mở
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {versions.data && versions.data.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-2 text-text-secondary">
                          Chưa có bản thời khoá biểu nào.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              {canManage ? (
                <VersionForm
                  level={level}
                  versions={versions.data ?? []}
                  onCreated={async (created) => {
                    await refresh();
                    setVersionId(created.id);
                    setToastMessage(`Đã tạo bản nháp ${created.name}`);
                  }}
                />
              ) : null}
            </section>
            {version ? (
              <section className="flex flex-col gap-3" aria-label={`Bản ${version.name}`}>
                <h2 className="text-section-title font-semibold text-text">
                  {version.name} {isDraft ? '(nháp)' : '(đã ban hành)'}
                </h2>
                {canManage && isDraft ? (
                  <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-card p-3">
                    <Button onClick={() => void conflicts.refetch()}>Kiểm tra xung đột</Button>
                    <Button variant="primary" disabled={publish.isPending} onClick={() => publish.mutate()}>
                      Ban hành
                    </Button>
                    <Button onClick={() => void downloadTimetableTemplate(version.id)}>Tải mẫu Excel</Button>
                    <label className="text-label font-medium text-text">
                      Tệp thời khoá biểu
                      <input
                        type="file"
                        accept=".xlsx"
                        aria-label="Tệp thời khoá biểu"
                        className="mt-2 block text-label"
                        onChange={(event) => setFile(event.target.files?.[0])}
                      />
                    </label>
                    <Button disabled={!file || upload.isPending} onClick={() => upload.mutate()}>
                      Nhập Excel
                    </Button>
                    <Button variant="text" disabled={remove.isPending} onClick={() => remove.mutate()}>
                      Xoá bản nháp
                    </Button>
                  </div>
                ) : null}
                {publish.error ? <Alert tone="danger">{messageOf(publish.error)}</Alert> : null}
                {upload.error ? <Alert tone="danger">{messageOf(upload.error)}</Alert> : null}
                {upload.data && upload.data.errors.length > 0 ? (
                  <Alert tone="danger">
                    Tệp có {upload.data.errors.length} lỗi, chưa nhập:{' '}
                    {upload.data.errors
                      .slice(0, 10)
                      .map((error) => `dòng ${error.row}${error.column ? ` (${error.column})` : ''}: ${error.message}`)
                      .join('; ')}
                  </Alert>
                ) : null}
                {conflicts.data ? (
                  <section aria-label="Xung đột" className="flex flex-col gap-1">
                    {conflicts.data.length === 0 ? (
                      <Alert tone="success">Không có xung đột.</Alert>
                    ) : (
                      <ul className="flex flex-col gap-1 text-content">
                        {conflicts.data.map((conflict, index) => (
                          <li
                            key={index}
                            className={conflict.severity === 'hard' ? 'text-danger' : 'text-text-secondary'}
                          >
                            {conflict.severity === 'hard' ? 'Phải sửa: ' : 'Cảnh báo: '}
                            {conflict.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                ) : null}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <ViewModeTabs
                    mode={mode}
                    onChange={(next) => {
                      setMode(next);
                      setTarget('');
                    }}
                  />
                  {/* Tóm tắt xung đột phải sửa của lần kiểm tra gần nhất, cạnh cách xem như mẫu thiết kế; chi tiết ở vùng Xung đột */}
                  {hardConflicts > 0 ? (
                    <p className="flex items-center gap-2 rounded-lg bg-danger/10 px-3 py-2 text-label font-medium text-danger">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M12 9v4M12 17h.01" />
                        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                      </svg>
                      {hardConflicts} xung đột phải sửa
                    </p>
                  ) : null}
                </div>
                <div
                  role="tabpanel"
                  id={VIEW_PANEL_ID}
                  aria-labelledby={`${VIEW_PANEL_ID}-${mode}`}
                  className="flex flex-col gap-3"
                >
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="text-label font-medium text-text">
                      {mode === 'class' ? 'Lớp' : mode === 'teacher' ? 'Giáo viên' : 'Phòng'}
                      <select
                        aria-label={
                          mode === 'class' ? 'Chọn lớp' : mode === 'teacher' ? 'Chọn giáo viên' : 'Chọn phòng'
                        }
                        className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                        value={target}
                        onChange={(event) => setTarget(event.target.value)}
                      >
                        <option value="">Chọn</option>
                        {(mode === 'class'
                          ? (classes.data ?? []).map((item) => [item.id, item.name] as const)
                          : mode === 'teacher'
                            ? teachers
                            : rooms
                        ).map(([id, name]) => (
                          <option key={id} value={id}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {/* Xuất Excel đối tượng đang chọn; chưa chọn thì mọi lớp, mỗi lớp một trang (YCTD-317) */}
                    <Button
                      disabled={exporting}
                      onClick={() => {
                        setExportError(undefined);
                        setExporting(true);
                        exportTimetableVersion(version.id, {
                          ...(mode === 'class' && target ? { class_id: target } : {}),
                          ...(mode === 'teacher' && target ? { teacher_user_id: target } : {}),
                          ...(mode === 'room' && target ? { room_id: target } : {}),
                        })
                          .catch((error: unknown) =>
                            setExportError(error instanceof Error ? error.message : 'Không xuất được thời khoá biểu'),
                          )
                          .finally(() => setExporting(false));
                      }}
                    >
                      {target ? 'Xuất Excel' : 'Xuất Excel mọi lớp'}
                    </Button>
                  </div>
                  {exportError ? <Alert tone="danger">{exportError}</Alert> : null}
                  {target && all.data ? (
                    canManage && isDraft && mode === 'class' ? (
                      <ClassEditor
                        versionId={version.id}
                        classId={target}
                        className={classes.data?.find((item) => item.id === target)?.name ?? ''}
                        slots={all.data.slots}
                        lessons={filtered}
                        allowGroups={level === 'THCS' || level === 'THPT'}
                        onSaved={setToastMessage}
                      />
                    ) : (
                      <ReadOnlyGrid slots={all.data.slots} lessons={filtered} mode={mode} />
                    )
                  ) : null}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
