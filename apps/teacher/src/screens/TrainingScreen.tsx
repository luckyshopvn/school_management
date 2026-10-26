import { useCallback, useEffect, useState } from 'react';
import {
  TRAINING_REGISTRATION_STATUS_LABELS,
  TRAINING_RESULT_LABELS,
  type StaffCertificateKind,
  type TrainingRegistrationStatus,
  type TrainingResult,
} from '@school-management/shared';
import { Alert, ApplicationHeader, Button } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Bồi dưỡng của tôi (DT-22 phần 22e, YCTD-182): số tiết đã có so với định mức năm, khoá đang mở để đăng ký, khoá đã đăng ký
// và kết quả, chứng nhận do trường cấp kèm mã tra cứu. Nhập chứng chỉ, tự đánh giá năng lực số ở cổng quản trị
interface OpenCourse {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  periods: number;
  status: 'open' | 'closed' | 'completed';
  registration_deadline: string | null;
  my_registration: { status: TrainingRegistrationStatus } | null;
}

interface MyTraining {
  year_name: string;
  required_periods: number;
  total_periods: number;
  missing_periods: number;
  registrations: Array<{
    id: string;
    course_name: string;
    status: TrainingRegistrationStatus;
    result: TrainingResult | null;
    credited_periods: number | null;
  }>;
  certificates: Array<{
    id: string;
    name: string;
    kind: StaffCertificateKind;
    issued_date: string;
    lookup_code: string | null;
    revoked_at: string | null;
  }>;
}

const dateText = (date: string) => date.split('-').reverse().join('/');
const messageOf = (error: unknown) =>
  error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ';

export function TrainingScreen({ onBack }: { onBack(): void }) {
  const [mine, setMine] = useState<MyTraining>();
  const [courses, setCourses] = useState<OpenCourse[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [doneMessage, setDoneMessage] = useState<string>();

  const load = useCallback(() => {
    requestJson<MyTraining>('/api/v1/training/mine')
      .then(setMine)
      .catch((error: unknown) => setErrorMessage(messageOf(error)));
    requestJson<OpenCourse[]>('/api/v1/training/courses?status=open')
      .then(setCourses)
      .catch((error: unknown) => setErrorMessage(messageOf(error)));
  }, []);
  useEffect(load, [load]);

  const register = async (course: OpenCourse) => {
    setErrorMessage(undefined);
    try {
      await requestJson(`/api/v1/training/courses/${course.id}/registrations`, { method: 'POST', body: '{}' });
      setDoneMessage(`Đã đăng ký khoá ${course.name}`);
      load();
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  };

  const open = courses.filter(
    (course) => !course.my_registration || ['cancelled', 'rejected'].includes(course.my_registration.status),
  );
  return (
    <div className="min-h-screen">
      <ApplicationHeader title="Bồi dưỡng của tôi" />
      <main className="mx-auto flex max-w-md flex-col md:max-w-3xl gap-4 px-4 py-6">
        <div>
          <Button variant="text" onClick={onBack}>
            Quay lại
          </Button>
        </div>
        {doneMessage ? <Alert tone="success">{doneMessage}</Alert> : null}
        {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
        {mine ? (
          <Alert tone={mine.missing_periods > 0 ? 'info' : 'success'}>
            Năm học {mine.year_name}: {mine.total_periods}/{mine.required_periods} tiết
            {mine.missing_periods > 0 ? `, còn thiếu ${mine.missing_periods} tiết` : ', đủ định mức'}
          </Alert>
        ) : null}
        <section className="flex flex-col gap-2" aria-label="Khoá đang mở đăng ký">
          <h2 className="text-section-title font-semibold text-text">Khoá đang mở đăng ký</h2>
          {open.length === 0 ? <p className="text-content text-text-secondary">Không có khoá nào đang mở.</p> : null}
          {open.map((course) => (
            <div key={course.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
              <span className="text-content font-semibold">{course.name}</span>
              <span className="text-label text-text-secondary">
                {dateText(course.start_date)} – {dateText(course.end_date)} · {course.periods} tiết
                {course.registration_deadline ? ` · hạn ${dateText(course.registration_deadline)}` : ''}
              </span>
              <div>
                <Button variant="primary" onClick={() => void register(course)}>
                  Đăng ký {course.name}
                </Button>
              </div>
            </div>
          ))}
        </section>
        <section className="flex flex-col gap-2" aria-label="Khoá đã đăng ký">
          <h2 className="text-section-title font-semibold text-text">Khoá đã đăng ký</h2>
          <ul className="flex flex-col gap-1 text-content">
            {(mine?.registrations ?? []).map((registration) => (
              <li key={registration.id} className="rounded-lg border border-border bg-card p-3">
                {registration.course_name}: {TRAINING_REGISTRATION_STATUS_LABELS[registration.status]}
                {registration.result
                  ? ` · ${TRAINING_RESULT_LABELS[registration.result]} (${registration.credited_periods ?? 0} tiết)`
                  : ''}
              </li>
            ))}
          </ul>
        </section>
        <section className="flex flex-col gap-2" aria-label="Chứng nhận của tôi">
          <h2 className="text-section-title font-semibold text-text">Chứng nhận của tôi</h2>
          <ul className="flex flex-col gap-1 text-content">
            {(mine?.certificates ?? [])
              .filter((certificate) => certificate.kind === 'school' && !certificate.revoked_at)
              .map((certificate) => (
                <li key={certificate.id} className="rounded-lg border border-border bg-card p-3">
                  {certificate.name} · cấp {dateText(certificate.issued_date)} · mã tra cứu {certificate.lookup_code}
                </li>
              ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
