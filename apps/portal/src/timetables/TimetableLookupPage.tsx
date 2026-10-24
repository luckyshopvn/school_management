import { useQuery } from '@tanstack/react-query';
import { TIMETABLE_WEEKDAY_LABELS } from '@school-management/shared';
import { Alert } from '@school-management/ui';
import { ApiError } from '../session/api-client.js';
import { readPublicLookup } from './timetable-generator-api.js';

// Trang tra cứu công khai của mã QR thời khoá biểu (DT-20 phần 22c2, YCTD-164): không cần đăng nhập; hiện thời khoá biểu đang
// áp dụng của lớp hoặc giáo viên gắn với mã và dạy thay, đổi tiết 7 ngày tới. Mã bị thu hồi thì báo không đúng
const codeOf = () => new URLSearchParams(window.location.search).get('ma')?.trim() ?? '';
const dateText = (date: string) => date.split('-').reverse().join('/');

export function TimetableLookupPage() {
  const code = codeOf();
  const lookup = useQuery({
    queryKey: ['timetable-lookup', code],
    queryFn: () => readPublicLookup(code),
    enabled: code.length > 0,
    retry: false,
  });
  const data = lookup.data;
  const slots = Object.values(data?.slots ?? {}).flat();
  const periods = [
    ...new Set([...slots.map((slot) => slot.period_no), ...(data?.lessons ?? []).map((lesson) => lesson.period_no)]),
  ].sort((left, right) => left - right);
  const days = [...new Set((data?.lessons ?? []).map((lesson) => lesson.weekday))].sort((left, right) => left - right);
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-4 bg-page p-4">
      <h1 className="text-page-title font-bold text-text">
        Thời khoá biểu{data ? ` ${data.kind === 'class' ? '' : 'giáo viên '}${data.target_name}` : ''}
      </h1>
      {!code ? <Alert tone="info">Quét mã QR thời khoá biểu do nhà trường cấp để xem.</Alert> : null}
      {lookup.error ? (
        <Alert tone="danger">
          {lookup.error instanceof ApiError ? lookup.error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại'}
        </Alert>
      ) : null}
      {data ? (
        <>
          {data.versions.length === 0 || data.lessons.length === 0 ? (
            <Alert tone="info">Chưa có thời khoá biểu đang áp dụng.</Alert>
          ) : (
            <>
              <p className="text-label text-text-secondary">
                {data.versions
                  .map((version) => `${version.name}, áp dụng từ ${dateText(version.effective_from)}`)
                  .join('; ')}
              </p>
              <div className="overflow-x-auto">
                <table className="text-content" aria-label="Thời khoá biểu tra cứu">
                  <thead className="text-left text-label font-medium text-text-secondary">
                    <tr>
                      <th className="px-3 py-2">Tiết</th>
                      {days.map((day) => (
                        <th key={day} className="px-3 py-2">
                          {TIMETABLE_WEEKDAY_LABELS[day]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map((period) => (
                      <tr key={period} className="border-t border-border">
                        <th scope="row" className="px-3 py-2 text-left font-medium">
                          Tiết {period}
                          <span className="block text-label text-text-secondary">
                            {slots.find((slot) => slot.period_no === period)?.start_time ?? ''}
                          </span>
                        </th>
                        {days.map((day) => (
                          <td key={day} className="px-3 py-2 align-top">
                            {data.lessons
                              .filter((lesson) => lesson.weekday === day && lesson.period_no === period)
                              .map((lesson, index) => (
                                <span key={index} className="block">
                                  {data.kind === 'class'
                                    ? lesson.subject_name
                                    : `${lesson.class_name} · ${lesson.subject_name}`}
                                  <span className="block text-label text-text-secondary">
                                    {[data.kind === 'class' ? lesson.teacher_name : null, lesson.room_name]
                                      .filter(Boolean)
                                      .join(' · ')}
                                  </span>
                                </span>
                              ))}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <section className="flex flex-col gap-2" aria-label="Thay đổi 7 ngày tới">
            <h2 className="text-section-title font-semibold text-text">Dạy thay, đổi tiết 7 ngày tới</h2>
            {data.changes.length === 0 ? (
              <p className="text-content text-text-secondary">Không có thay đổi.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-content">
                {data.changes.map((change, index) => (
                  <li key={index}>
                    {dateText(change.change_date)}, lớp {change.class_name}, tiết {change.period_no}:{' '}
                    {change.kind === 'substitute' ? 'dạy thay' : 'đổi tiết'} — {change.subject_name}
                    {change.teacher_name ? ` (${change.teacher_name})` : ''}, thay cho {change.original_subject_name}
                    {change.original_teacher_name ? ` (${change.original_teacher_name})` : ''}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
