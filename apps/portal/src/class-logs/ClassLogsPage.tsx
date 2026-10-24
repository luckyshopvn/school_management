import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PERIOD_ATTENDANCE_LABELS,
  PERMISSION_CODES,
  TIMETABLE_WEEKDAY_LABELS,
  type SchoolLevelCode,
} from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, StatusBadge, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError, requestJson } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { useEnabledSchoolLevels } from '../school-levels/enabled-levels.js';
import {
  readClassLogDetail,
  readClassLogWeek,
  readPeriodAttendanceSummary,
  signClassLogWeek,
} from './class-logs-api.js';

// 7.6 Sổ đầu bài, 7.7 Chuyên cần theo tiết (DT-20 phần 20d, YCTD-162): xem sổ đầu bài của lớp theo tuần (tiết theo thời khoá
// biểu đang áp dụng, tiết đã ghi, số học sinh vắng, đi muộn), mở một tiết xem nội dung và điểm danh; Ban giám hiệu ký sổ tuần.
// Giáo viên ghi, ký tiết ở ứng dụng giáo viên. Trang chuyên cần tổng hợp theo học sinh, đối chiếu báo vắng theo ngày
const messageOf = (error: unknown) =>
  error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';

const todayInVietnam = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const dateText = (date: string) => date.split('-').reverse().join('/');

interface ClassOption {
  id: string;
  name: string;
}

function useLevelClasses() {
  const enabled = useEnabledSchoolLevels();
  const levels = enabled.levels.filter((level) => level.value !== 'MN').map((level) => level.value);
  return useQuery({
    queryKey: ['classes', 'period-levels', levels.join(',')],
    queryFn: async () => {
      const lists = await Promise.all(
        levels.map((level: SchoolLevelCode) =>
          requestJson<ClassOption[]>(`/api/v1/classes?school_level=${level}&status=active`),
        ),
      );
      return lists.flat();
    },
    enabled: levels.length > 0,
  });
}

function ClassPicker({ value, onChange }: { value: string; onChange(value: string): void }) {
  const classes = useLevelClasses();
  return (
    <label className="text-label font-medium text-text">
      Lớp
      <select
        aria-label="Lớp"
        className={`mt-2 block ${FORM_CONTROL_CLASS}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Chọn lớp</option>
        {(classes.data ?? []).map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function LessonDetail({ classId, date, periodNo }: { classId: string; date: string; periodNo: number }) {
  const detail = useQuery({
    queryKey: ['class-log-detail', classId, date, periodNo],
    queryFn: () => readClassLogDetail(classId, date, periodNo),
  });
  if (detail.error) {
    return <Alert tone="danger">{messageOf(detail.error)}</Alert>;
  }
  const data = detail.data;
  if (!data) {
    return null;
  }
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border p-3" aria-label="Chi tiết tiết dạy">
      <h3 className="text-content font-semibold">
        {dateText(data.lesson_date)} tiết {data.period_no}: {data.subject_name ?? ''}
      </h3>
      {data.log ? (
        <dl className="grid grid-cols-1 gap-1 text-content md:grid-cols-2">
          <dt className="text-text-secondary">Tên bài</dt>
          <dd>{data.log.lesson_title}</dd>
          <dt className="text-text-secondary">Nội dung</dt>
          <dd>{data.log.content ?? ''}</dd>
          <dt className="text-text-secondary">Nhận xét tiết</dt>
          <dd>{data.log.comment ?? ''}</dd>
          <dt className="text-text-secondary">Xếp loại tiết</dt>
          <dd>{data.log.rating ?? ''}</dd>
        </dl>
      ) : (
        <p className="text-content text-text-secondary">Giáo viên chưa ghi tiết này.</p>
      )}
      <ul className="flex flex-col gap-1 text-content" aria-label="Điểm danh tiết">
        {data.students
          .filter((student) => student.status !== 'present')
          .map((student) => (
            <li key={student.child_id}>
              {student.full_name}: {PERIOD_ATTENDANCE_LABELS[student.status]}
              {student.note ? ` (${student.note})` : ''}
            </li>
          ))}
      </ul>
    </section>
  );
}

export function ClassLogsPage() {
  const canReview = useHasPermission(PERMISSION_CODES.classLogReview);
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(todayInVietnam());
  const [opened, setOpened] = useState<{ date: string; period: number }>();
  const [comment, setComment] = useState('');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const week = useQuery({
    queryKey: ['class-log-week', classId, date],
    queryFn: () => readClassLogWeek(classId, date),
    enabled: Boolean(classId),
  });
  const sign = useMutation({
    mutationFn: () => signClassLogWeek(classId, date, comment),
    onSuccess: async () => {
      setComment('');
      await queryClient.invalidateQueries({ queryKey: ['class-log-week'] });
      setToastMessage('Đã ký sổ đầu bài tuần này');
    },
  });
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/class-logs')}</h1>
        <div className="flex flex-wrap items-end gap-3">
          <ClassPicker value={classId} onChange={setClassId} />
          <label className="text-label font-medium text-text">
            Ngày trong tuần
            <input
              type="date"
              aria-label="Ngày trong tuần"
              className={`mt-2 block ${FORM_CONTROL_CLASS}`}
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
        </div>
        {week.error ? <Alert tone="danger">{messageOf(week.error)}</Alert> : null}
        {week.data ? (
          <section className="flex flex-col gap-3" aria-label="Sổ đầu bài tuần">
            <h2 className="text-section-title font-semibold text-text">
              Tuần từ {dateText(week.data.week_start)} · {week.data.class.name}
            </h2>
            {week.data.days.length === 0 ? (
              <p className="text-content text-text-secondary">
                Tuần này lớp chưa có tiết theo thời khoá biểu đang áp dụng.
              </p>
            ) : null}
            <table className="w-full text-content" aria-label="Các tiết trong tuần">
              <thead className="text-left text-label font-medium text-text-secondary">
                <tr>
                  <th className="px-3 py-2">Ngày</th>
                  <th className="px-3 py-2">Tiết</th>
                  <th className="px-3 py-2">Môn</th>
                  <th className="px-3 py-2">Giáo viên</th>
                  <th className="px-3 py-2">Tên bài</th>
                  <th className="px-3 py-2">Vắng, muộn</th>
                  <th className="px-3 py-2">Trạng thái</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {week.data.days.flatMap((day) =>
                  day.lessons.map((lesson) => (
                    <tr key={`${day.date}:${lesson.period_no}`} className="border-t border-border">
                      <td className="px-3 py-2">
                        {TIMETABLE_WEEKDAY_LABELS[day.weekday]} {dateText(day.date)}
                      </td>
                      <td className="px-3 py-2">{lesson.period_no}</td>
                      <td className="px-3 py-2">{lesson.subject_name ?? ''}</td>
                      <td className="px-3 py-2">{lesson.teacher_name ?? ''}</td>
                      <td className="px-3 py-2">{lesson.log?.lesson_title ?? ''}</td>
                      <td className="px-3 py-2">
                        {lesson.log ? `${lesson.absent_count} vắng, ${lesson.late_count} muộn` : ''}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge
                          tone={lesson.log?.status === 'signed' ? 'success' : lesson.log ? 'info' : 'neutral'}
                          label={lesson.log?.status === 'signed' ? 'Đã ký' : lesson.log ? 'Đã ghi' : 'Chưa ghi'}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button variant="text" onClick={() => setOpened({ date: day.date, period: lesson.period_no })}>
                          Xem
                        </Button>
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
            {opened ? <LessonDetail classId={classId} date={opened.date} periodNo={opened.period} /> : null}
            {week.data.review ? (
              <Alert tone="success">
                Ban giám hiệu đã ký sổ tuần: {week.data.review.reviewer_name}
                {week.data.review.comment ? ` – ${week.data.review.comment}` : ''}
              </Alert>
            ) : canReview ? (
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-label font-medium text-text">
                  Nhận xét của Ban giám hiệu
                  <input
                    aria-label="Nhận xét của Ban giám hiệu"
                    className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                  />
                </label>
                <Button variant="primary" disabled={sign.isPending} onClick={() => sign.mutate()}>
                  Ký sổ tuần
                </Button>
              </div>
            ) : null}
            {sign.error ? <Alert tone="danger">{messageOf(sign.error)}</Alert> : null}
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}

export function PeriodAttendancePage() {
  const [classId, setClassId] = useState('');
  const [from, setFrom] = useState(`${todayInVietnam().slice(0, 7)}-01`);
  const [to, setTo] = useState(todayInVietnam());
  const summary = useQuery({
    queryKey: ['period-attendance-summary', classId, from, to],
    queryFn: () => readPeriodAttendanceSummary(classId, from, to),
    enabled: Boolean(classId && from && to),
  });
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/period-attendance')}</h1>
        <div className="flex flex-wrap items-end gap-3">
          <ClassPicker value={classId} onChange={setClassId} />
          <label className="text-label font-medium text-text">
            Từ ngày
            <input
              type="date"
              aria-label="Từ ngày"
              className={`mt-2 block ${FORM_CONTROL_CLASS}`}
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <label className="text-label font-medium text-text">
            Đến ngày
            <input
              type="date"
              aria-label="Đến ngày"
              className={`mt-2 block ${FORM_CONTROL_CLASS}`}
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
        </div>
        {summary.error ? <Alert tone="danger">{messageOf(summary.error)}</Alert> : null}
        {summary.data ? (
          <section className="flex flex-col gap-2" aria-label="Chuyên cần theo tiết">
            <p className="text-content">Số tiết đã ghi sổ: {summary.data.lessons}</p>
            <table className="w-full text-content" aria-label="Chuyên cần theo học sinh">
              <thead className="text-left text-label font-medium text-text-secondary">
                <tr>
                  <th className="px-3 py-2">Học sinh</th>
                  <th className="px-3 py-2">Có mặt</th>
                  <th className="px-3 py-2">Đi muộn</th>
                  <th className="px-3 py-2">Vắng có phép</th>
                  <th className="px-3 py-2">Vắng không phép</th>
                  <th className="px-3 py-2">Ngày có vắng</th>
                  <th className="px-3 py-2">Ngày báo vắng</th>
                  <th className="px-3 py-2">Vắng không báo (ngày)</th>
                  <th className="px-3 py-2">Báo vắng nhưng có mặt (ngày)</th>
                </tr>
              </thead>
              <tbody>
                {summary.data.students.map((student) => (
                  <tr key={student.child_id} className="border-t border-border">
                    <td className="px-3 py-2">{student.full_name}</td>
                    <td className="px-3 py-2">{student.present}</td>
                    <td className="px-3 py-2">{student.late}</td>
                    <td className="px-3 py-2">{student.absent_excused}</td>
                    <td className="px-3 py-2">{student.absent_unexcused}</td>
                    <td className="px-3 py-2">{student.absent_days}</td>
                    <td className="px-3 py-2">{student.notice_days}</td>
                    <td className="px-3 py-2">{student.absent_without_notice_days}</td>
                    <td className="px-3 py-2">{student.notice_but_present_days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
