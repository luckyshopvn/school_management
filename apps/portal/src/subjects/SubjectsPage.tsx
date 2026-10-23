import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PERMISSION_CODES,
  SUBJECT_ASSESSMENT_LABELS,
  SUBJECT_KIND_LABELS,
  type SchoolLevelCode,
  type SubjectAssessment,
  type SubjectKind,
} from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, StatusBadge, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { useEnabledSchoolLevels } from '../school-levels/enabled-levels.js';
import { listCurricula, listGradeLevels } from '../catalogs/catalogs-api.js';
import {
  createSubject,
  listCurriculumSubjects,
  listSubjects,
  loadSubjectTemplate,
  saveCurriculumSubjects,
  updateSubject,
  type Subject,
} from './subjects-api.js';

// 7.1 Môn học và hoạt động giáo dục (DT-20 phần 20a, YCTD-158): danh mục môn của cấp, nạp bộ mẫu Tiểu học theo Chương trình
// giáo dục phổ thông 2018, bảng số tiết mỗi tuần theo khối của một chương trình. Mọi người xem; người quản lý danh mục
// (P01.catalog.manage) sửa. Cấp xem được là các cấp đang bật ngoài Mầm non
const messageOf = (error: unknown) =>
  error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';

function SubjectForm({ level, onSaved }: { level: SchoolLevelCode; onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState<SubjectKind>('subject');
  const [assessment, setAssessment] = useState<SubjectAssessment>('comment');
  const create = useMutation({
    mutationFn: () => createSubject({ code, name, school_level: level, kind, assessment, order_no: 100 }),
    onSuccess: async (subject) => {
      setCode('');
      setName('');
      await queryClient.invalidateQueries({ queryKey: ['subjects'] });
      onSaved(`Đã thêm môn ${subject.name}`);
    },
  });
  return (
    <form
      aria-label="Thêm môn học"
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      <label className="text-label font-medium text-text">
        Mã môn
        <input
          className={`mt-2 block ${FORM_CONTROL_CLASS}`}
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
      </label>
      <label className="text-label font-medium text-text">
        Tên môn
        <input
          className={`mt-2 block ${FORM_CONTROL_CLASS}`}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="text-label font-medium text-text">
        Loại
        <select
          className={`mt-2 block ${FORM_CONTROL_CLASS}`}
          value={kind}
          onChange={(event) => setKind(event.target.value as SubjectKind)}
        >
          {Object.entries(SUBJECT_KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-label font-medium text-text">
        Cách đánh giá
        <select
          className={`mt-2 block ${FORM_CONTROL_CLASS}`}
          value={assessment}
          onChange={(event) => setAssessment(event.target.value as SubjectAssessment)}
        >
          {Object.entries(SUBJECT_ASSESSMENT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" variant="primary" disabled={!code || !name || create.isPending}>
        Thêm môn
      </Button>
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
    </form>
  );
}

function SubjectList({
  level,
  canManage,
  onChanged,
}: {
  level: SchoolLevelCode;
  canManage: boolean;
  onChanged(message: string): void;
}) {
  const queryClient = useQueryClient();
  const subjects = useQuery({ queryKey: ['subjects', level], queryFn: () => listSubjects(level) });
  const load = useMutation({
    mutationFn: () => loadSubjectTemplate(level),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['subjects'] });
      await queryClient.invalidateQueries({ queryKey: ['curricula'] });
      await queryClient.invalidateQueries({ queryKey: ['curriculum-subjects'] });
      onChanged(`Đã nạp ${result.created_subjects.length} môn mẫu, ${result.created_periods} dòng số tiết theo khối`);
    },
  });
  const toggle = useMutation({
    mutationFn: (subject: Subject) =>
      updateSubject(subject.id, { status: subject.status === 'active' ? 'inactive' : 'active' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['subjects'] });
    },
  });
  return (
    <section className="flex flex-col gap-3" aria-label="Danh mục môn học">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-section-title font-semibold text-text">Danh mục môn học và hoạt động giáo dục</h2>
        {canManage ? (
          <Button disabled={load.isPending} onClick={() => load.mutate()}>
            Nạp môn mẫu
          </Button>
        ) : null}
      </div>
      <p className="text-label text-text-secondary">
        Bộ mẫu theo Chương trình giáo dục phổ thông 2018; nhà trường đối chiếu kế hoạch giáo dục của trường rồi sửa. Môn
        đã có mã giữ nguyên khi nạp lại.
      </p>
      {load.error ? <Alert tone="danger">{messageOf(load.error)}</Alert> : null}
      {subjects.error ? <Alert tone="danger">{messageOf(subjects.error)}</Alert> : null}
      <table className="w-full text-content" aria-label="Môn học">
        <thead className="text-left text-label font-medium text-text-secondary">
          <tr>
            <th className="px-3 py-2">Mã</th>
            <th className="px-3 py-2">Tên môn</th>
            <th className="px-3 py-2">Loại</th>
            <th className="px-3 py-2">Cách đánh giá</th>
            <th className="px-3 py-2">Trạng thái</th>
            {canManage ? <th className="px-3 py-2" /> : null}
          </tr>
        </thead>
        <tbody>
          {(subjects.data ?? []).map((subject) => (
            <tr key={subject.id} className="border-t border-border">
              <td className="px-3 py-2">{subject.code}</td>
              <td className="px-3 py-2">{subject.name}</td>
              <td className="px-3 py-2">{SUBJECT_KIND_LABELS[subject.kind]}</td>
              <td className="px-3 py-2">{SUBJECT_ASSESSMENT_LABELS[subject.assessment]}</td>
              <td className="px-3 py-2">
                <StatusBadge
                  tone={subject.status === 'active' ? 'success' : 'neutral'}
                  label={subject.status === 'active' ? 'Đang dùng' : 'Ngừng dùng'}
                />
              </td>
              {canManage ? (
                <td className="px-3 py-2 text-right">
                  <Button variant="text" onClick={() => toggle.mutate(subject)}>
                    {subject.status === 'active' ? 'Ngừng dùng' : 'Dùng lại'}
                  </Button>
                </td>
              ) : null}
            </tr>
          ))}
          {subjects.data && subjects.data.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-3 py-2 text-text-secondary">
                Chưa có môn nào. Bấm "Nạp môn mẫu" để bắt đầu.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      {canManage ? <SubjectForm level={level} onSaved={onChanged} /> : null}
    </section>
  );
}

type Cell = { periods: string; elective: boolean };

// Bảng số tiết mỗi tuần: hàng là môn, cột là khối của cấp; ô trống là khối không học môn đó
function PeriodsMatrix({
  level,
  canManage,
  onChanged,
}: {
  level: SchoolLevelCode;
  canManage: boolean;
  onChanged(message: string): void;
}) {
  const queryClient = useQueryClient();
  const curricula = useQuery({ queryKey: ['curricula'], queryFn: listCurricula });
  const grades = useQuery({ queryKey: ['grade-levels'], queryFn: listGradeLevels });
  const subjects = useQuery({ queryKey: ['subjects', level], queryFn: () => listSubjects(level) });
  const levelCurricula = (curricula.data ?? []).filter(
    (item) => item.school_level === level && item.status === 'active',
  );
  const [chosen, setChosen] = useState('');
  const curriculum =
    levelCurricula.find((item) => item.id === chosen) ?? levelCurricula.find((item) => item.is_default);
  const rows = useQuery({
    queryKey: ['curriculum-subjects', curriculum?.id],
    queryFn: () => listCurriculumSubjects(curriculum?.id ?? ''),
    enabled: Boolean(curriculum),
  });
  const columns = useMemo(
    () =>
      (grades.data ?? [])
        .filter((grade) => grade.school_level === level && grade.status === 'active')
        .filter(
          (grade) =>
            !curriculum ||
            curriculum.grade_level_codes.length === 0 ||
            curriculum.grade_level_codes.includes(grade.code),
        )
        .sort((left, right) => left.order_no - right.order_no),
    [grades.data, level, curriculum],
  );
  const [cells, setCells] = useState<Record<string, Cell>>({});
  useEffect(() => {
    setCells(
      Object.fromEntries(
        (rows.data ?? []).map((row) => [
          `${row.subject_id}:${row.grade_level_code}`,
          { periods: String(row.periods_per_week), elective: row.is_elective },
        ]),
      ),
    );
  }, [rows.data]);
  const save = useMutation({
    mutationFn: () =>
      saveCurriculumSubjects(
        curriculum?.id ?? '',
        Object.entries(cells)
          .filter(([, cell]) => cell.periods.trim() !== '')
          .map(([key, cell]) => {
            const [subjectId, grade] = key.split(':');
            return {
              subject_id: subjectId ?? '',
              grade_level_code: grade ?? '',
              periods_per_week: Number(cell.periods.replace(',', '.')),
              is_elective: cell.elective,
            };
          }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['curriculum-subjects'] });
      onChanged('Đã ghi số tiết theo khối');
    },
  });
  const activeSubjects = (subjects.data ?? []).filter((subject) => subject.status === 'active');
  const total = (grade: string) =>
    activeSubjects.reduce((sum, subject) => {
      const cell = cells[`${subject.id}:${grade}`];
      return sum + (cell && !cell.elective ? Number(cell.periods.replace(',', '.')) || 0 : 0);
    }, 0);

  return (
    <section className="flex flex-col gap-3" aria-label="Số tiết theo khối">
      <h2 className="text-section-title font-semibold text-text">Số tiết mỗi tuần theo khối</h2>
      {levelCurricula.length === 0 ? (
        <p className="text-content text-text-secondary">
          Cấp này chưa có chương trình. Bấm "Nạp môn mẫu" để tạo chương trình mặc định, hoặc thêm ở Danh mục, Chương
          trình.
        </p>
      ) : (
        <label className="text-label font-medium text-text">
          Chương trình
          <select
            className={`mt-2 block ${FORM_CONTROL_CLASS}`}
            aria-label="Chương trình"
            value={curriculum?.id ?? ''}
            onChange={(event) => setChosen(event.target.value)}
          >
            {levelCurricula.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.is_default ? ' (mặc định)' : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      {curriculum && columns.length === 0 ? (
        <p className="text-content text-text-secondary">Chưa có khối của cấp này; nạp khối mẫu ở Danh mục, Bậc học.</p>
      ) : null}
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      {curriculum && columns.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="text-content" aria-label="Bảng số tiết theo khối">
            <thead className="text-left text-label font-medium text-text-secondary">
              <tr>
                <th className="px-3 py-2">Môn học</th>
                {columns.map((grade) => (
                  <th key={grade.code} className="px-3 py-2">
                    {grade.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeSubjects.map((subject) => (
                <tr key={subject.id} className="border-t border-border">
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    {subject.name}
                  </th>
                  {columns.map((grade) => {
                    const key = `${subject.id}:${grade.code}`;
                    const cell = cells[key] ?? { periods: '', elective: false };
                    return (
                      <td key={grade.code} className="px-3 py-2">
                        <span className="flex items-center gap-1">
                          <input
                            className={`w-16 ${FORM_CONTROL_CLASS}`}
                            inputMode="decimal"
                            aria-label={`Số tiết ${subject.name} ${grade.name}`}
                            disabled={!canManage}
                            value={cell.periods}
                            onChange={(event) =>
                              setCells((current) => ({ ...current, [key]: { ...cell, periods: event.target.value } }))
                            }
                          />
                          <label className="flex items-center gap-1 text-label" title="Môn tự chọn ở khối này">
                            <input
                              type="checkbox"
                              aria-label={`Tự chọn ${subject.name} ${grade.name}`}
                              disabled={!canManage}
                              checked={cell.elective}
                              onChange={(event) =>
                                setCells((current) => ({
                                  ...current,
                                  [key]: { ...cell, elective: event.target.checked },
                                }))
                              }
                            />
                            TC
                          </label>
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-t border-border font-semibold">
                <th scope="row" className="px-3 py-2 text-left">
                  Tổng tiết bắt buộc
                </th>
                {columns.map((grade) => (
                  <td key={grade.code} className="px-3 py-2" data-testid={`periods-total-${grade.code}`}>
                    {total(grade.code)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}
      {canManage && curriculum && columns.length > 0 ? (
        <div>
          <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
            Ghi số tiết
          </Button>
        </div>
      ) : null}
    </section>
  );
}

export function SubjectsPage() {
  const canManage = useHasPermission(PERMISSION_CODES.catalogManage);
  const enabled = useEnabledSchoolLevels();
  const levels = enabled.levels.filter((level) => level.value !== 'MN');
  const [chosen, setChosen] = useState<SchoolLevelCode>();
  const level = levels.find((item) => item.value === chosen)?.value ?? levels[0]?.value;
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/subjects')}</h1>
        {!level ? (
          <Alert tone="info">Trường chưa bật cấp Tiểu học, THCS hoặc THPT; bật cấp học ở 1.4 Cấu hình trường.</Alert>
        ) : (
          <>
            {levels.length > 1 ? (
              <label className="text-label font-medium text-text">
                Cấp học
                <select
                  className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                  aria-label="Cấp học"
                  value={level}
                  onChange={(event) => setChosen(event.target.value as SchoolLevelCode)}
                >
                  {levels.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <SubjectList level={level} canManage={canManage} onChanged={setToastMessage} />
            <PeriodsMatrix level={level} canManage={canManage} onChanged={setToastMessage} />
          </>
        )}
      </div>
    </AppShell>
  );
}
