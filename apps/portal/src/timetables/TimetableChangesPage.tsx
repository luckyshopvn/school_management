import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES, type SchoolLevelCode } from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { useEnabledSchoolLevels } from '../school-levels/enabled-levels.js';
import {
  createChange,
  deleteChange,
  listChanges,
  listSubstituteTeachers,
  readDay,
  type EffectiveLesson,
} from './timetable-generator-api.js';
import { listLevelClasses } from './TimetableGeneratorPage.js';

// 7.6 Dạy thay, đổi tiết (DT-20 phần 22c2, YCTD-164): ghi theo ngày, không sửa bản đã ban hành. Dạy thay: chọn ngày, lớp,
// tiết, giáo viên dạy thay; đổi tiết: đổi chỗ hai tiết của cùng lớp (cùng ngày hoặc khác ngày). Máy chủ chặn khi giáo viên
// đang có tiết khác cùng lúc. Danh sách thay đổi từ hôm nay trở đi 14 ngày (sổ đầu bài 20d ghi người dạy thực tế theo đây)
const messageOf = (error: unknown) =>
  error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';

const todayText = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const plusDays = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
const dateText = (date: string) => date.split('-').reverse().join('/');
const lessonText = (lesson: EffectiveLesson) =>
  `Tiết ${lesson.period_no}: ${lesson.subject_name}${lesson.teacher_name ? ` (${lesson.teacher_name})` : ''}${lesson.change ? ' · đã có thay đổi' : ''}`;

function PeriodSelect({
  label,
  date,
  classId,
  value,
  onChange,
}: {
  label: string;
  date: string;
  classId: string;
  value: string;
  onChange(value: string): void;
}) {
  const day = useQuery({
    queryKey: ['timetable-day', date, classId],
    queryFn: () => readDay(date, classId),
    enabled: Boolean(date && classId),
  });
  return (
    <label className="text-label font-medium text-text">
      {label}
      <select
        aria-label={label}
        className={`mt-2 block ${FORM_CONTROL_CLASS}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{day.data && day.data.length === 0 ? 'Ngày này lớp không có tiết' : 'Chọn tiết'}</option>
        {(day.data ?? []).map((lesson) => (
          <option key={lesson.period_no} value={lesson.period_no} disabled={Boolean(lesson.change)}>
            {lessonText(lesson)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TimetableChangesPage() {
  const canManage = useHasPermission(PERMISSION_CODES.timetableManage);
  const enabled = useEnabledSchoolLevels();
  const levels = enabled.levels.filter((level) => level.value !== 'MN');
  const [chosenLevel, setChosenLevel] = useState<SchoolLevelCode>();
  const level = levels.find((item) => item.value === chosenLevel)?.value ?? levels[0]?.value;
  const queryClient = useQueryClient();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const today = todayText();
  const classes = useQuery({
    queryKey: ['classes', 'level', level],
    queryFn: () => listLevelClasses(level ?? 'TH'),
    enabled: Boolean(level),
  });
  const teachers = useQuery({ queryKey: ['substitute-teachers'], queryFn: listSubstituteTeachers, enabled: canManage });
  const changes = useQuery({
    queryKey: ['timetable-changes', today],
    queryFn: () => listChanges(today, plusDays(today, 14)),
  });
  const [kind, setKind] = useState<'substitute' | 'swap'>('substitute');
  const [date, setDate] = useState(today);
  const [classId, setClassId] = useState('');
  const [period, setPeriod] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [targetDate, setTargetDate] = useState(today);
  const [targetPeriod, setTargetPeriod] = useState('');
  const [reason, setReason] = useState('');
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['timetable-changes'] });
    await queryClient.invalidateQueries({ queryKey: ['timetable-day'] });
  };
  const create = useMutation({
    mutationFn: () =>
      createChange({
        kind,
        date,
        class_id: classId,
        period_no: Number(period),
        reason: reason.trim() || null,
        ...(kind === 'substitute'
          ? { teacher_user_id: teacherId }
          : { target_date: targetDate, target_period_no: Number(targetPeriod) }),
      }),
    onSuccess: async () => {
      setPeriod('');
      setTargetPeriod('');
      setReason('');
      await refresh();
      setToastMessage(kind === 'substitute' ? 'Đã ghi dạy thay' : 'Đã ghi đổi tiết');
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteChange(id),
    onSuccess: async () => {
      await refresh();
      setToastMessage('Đã xoá thay đổi');
    },
  });
  const ready =
    classId && period && date && (kind === 'substitute' ? Boolean(teacherId) : Boolean(targetDate && targetPeriod));

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/timetable-changes')}</h1>
        {!level ? (
          <Alert tone="info">Trường chưa bật cấp Tiểu học, THCS hoặc THPT; bật cấp học ở 1.4 Cấu hình trường.</Alert>
        ) : (
          <>
            {canManage ? (
              <section className="flex flex-col gap-3" aria-label="Ghi thay đổi">
                <h2 className="text-section-title font-semibold text-text">Ghi dạy thay, đổi tiết</h2>
                {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
                <div className="flex flex-wrap items-end gap-3">
                  {levels.length > 1 ? (
                    <label className="text-label font-medium text-text">
                      Cấp học
                      <select
                        aria-label="Cấp học"
                        className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                        value={level}
                        onChange={(event) => {
                          setChosenLevel(event.target.value as SchoolLevelCode);
                          setClassId('');
                        }}
                      >
                        {levels.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label className="text-label font-medium text-text">
                    Loại
                    <select
                      aria-label="Loại thay đổi"
                      className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                      value={kind}
                      onChange={(event) => setKind(event.target.value as typeof kind)}
                    >
                      <option value="substitute">Dạy thay</option>
                      <option value="swap">Đổi tiết</option>
                    </select>
                  </label>
                  <label className="text-label font-medium text-text">
                    Ngày
                    <input
                      type="date"
                      aria-label="Ngày"
                      className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                      value={date}
                      onChange={(event) => {
                        setDate(event.target.value);
                        setPeriod('');
                      }}
                    />
                  </label>
                  <label className="text-label font-medium text-text">
                    Lớp
                    <select
                      aria-label="Lớp"
                      className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                      value={classId}
                      onChange={(event) => {
                        setClassId(event.target.value);
                        setPeriod('');
                        setTargetPeriod('');
                      }}
                    >
                      <option value="">Chọn lớp</option>
                      {(classes.data ?? []).map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <PeriodSelect label="Tiết" date={date} classId={classId} value={period} onChange={setPeriod} />
                  {kind === 'substitute' ? (
                    <label className="text-label font-medium text-text">
                      Giáo viên dạy thay
                      <select
                        aria-label="Giáo viên dạy thay"
                        className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                        value={teacherId}
                        onChange={(event) => setTeacherId(event.target.value)}
                      >
                        <option value="">Chọn giáo viên</option>
                        {(teachers.data ?? []).map((teacher) => (
                          <option key={teacher.teacher_user_id} value={teacher.teacher_user_id}>
                            {teacher.teacher_name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <>
                      <label className="text-label font-medium text-text">
                        Đổi với ngày
                        <input
                          type="date"
                          aria-label="Đổi với ngày"
                          className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                          value={targetDate}
                          onChange={(event) => {
                            setTargetDate(event.target.value);
                            setTargetPeriod('');
                          }}
                        />
                      </label>
                      <PeriodSelect
                        label="Đổi với tiết"
                        date={targetDate}
                        classId={classId}
                        value={targetPeriod}
                        onChange={setTargetPeriod}
                      />
                    </>
                  )}
                  <label className="text-label font-medium text-text">
                    Lý do
                    <input
                      aria-label="Lý do"
                      className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                      value={reason}
                      maxLength={500}
                      onChange={(event) => setReason(event.target.value)}
                    />
                  </label>
                  <Button variant="primary" disabled={!ready || create.isPending} onClick={() => create.mutate()}>
                    Ghi thay đổi
                  </Button>
                </div>
              </section>
            ) : null}
            <section className="flex flex-col gap-3" aria-label="Thay đổi 14 ngày tới">
              <h2 className="text-section-title font-semibold text-text">Thay đổi từ hôm nay đến 14 ngày tới</h2>
              {remove.error ? <Alert tone="danger">{messageOf(remove.error)}</Alert> : null}
              <div className="overflow-x-auto">
                <table className="w-full text-content" aria-label="Danh sách thay đổi">
                  <thead className="text-left text-label font-medium text-text-secondary">
                    <tr>
                      <th className="px-3 py-2">Ngày</th>
                      <th className="px-3 py-2">Lớp</th>
                      <th className="px-3 py-2">Tiết</th>
                      <th className="px-3 py-2">Loại</th>
                      <th className="px-3 py-2">Theo thời khoá biểu</th>
                      <th className="px-3 py-2">Thực tế</th>
                      <th className="px-3 py-2">Lý do</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {(changes.data ?? []).map((change) => (
                      <tr key={change.id} className="border-t border-border">
                        <td className="px-3 py-2">{dateText(change.change_date)}</td>
                        <td className="px-3 py-2">{change.class_name}</td>
                        <td className="px-3 py-2">{change.period_no}</td>
                        <td className="px-3 py-2">{change.kind === 'substitute' ? 'Dạy thay' : 'Đổi tiết'}</td>
                        <td className="px-3 py-2">
                          {change.original_subject_name} · {change.original_teacher_name ?? 'Chưa có giáo viên'}
                        </td>
                        <td className="px-3 py-2">
                          {change.subject_name} · {change.teacher_name ?? 'Chưa có giáo viên'}
                        </td>
                        <td className="px-3 py-2">{change.reason ?? ''}</td>
                        <td className="px-3 py-2 text-right">
                          {canManage ? (
                            <Button variant="text" disabled={remove.isPending} onClick={() => remove.mutate(change.id)}>
                              Xoá
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                    {changes.data && changes.data.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-2 text-text-secondary">
                          Chưa có dạy thay, đổi tiết nào.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
