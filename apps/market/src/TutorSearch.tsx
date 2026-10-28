import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, FORM_CONTROL_CLASS } from '@school-management/ui';
import { errorText, marketRequest } from '@school-management/market-client';

// Tìm gia sư và trang công khai của gia sư theo Mẫu 02 (DT-27 phần 27g, YCTD-257): chỉ gia sư đã duyệt, đã xác minh danh tính và lý lịch
// tư pháp; không có số điện thoại, địa chỉ của gia sư. Đặt buổi là của 27h
const LEVEL_LABELS: Record<string, string> = { TH: 'Tiểu học', THCS: 'Trung học cơ sở', THPT: 'Trung học phổ thông' };
const KIND_LABELS: Record<string, string> = {
  curriculum: 'Môn của chương trình phổ thông',
  enrichment: 'Năng khiếu, kỹ năng, ngoại ngữ tăng cường',
};
const WEEKDAYS = ['', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'];
const BADGE_LABELS: Record<string, string> = {
  identity: 'Đã xác minh danh tính',
  degree: 'Đã xác minh bằng cấp',
  criminal_record: 'Đã xác minh lý lịch tư pháp',
  business_registration: 'Có đăng ký kinh doanh',
  school_teacher: 'Giáo viên đang dạy ở trường',
};

interface SubjectRow {
  subject: string;
  school_level: string;
  grade_from: number;
  grade_to: number;
  content_kind: string;
  price_per_session: number;
}

interface TutorCard {
  id: string;
  display_name: string;
  headline: string;
  teaching_language: string;
  min_price: number;
  subjects: SubjectRow[];
  badges: Record<string, boolean>;
}

interface TutorPage {
  id: string;
  display_name: string;
  headline: string;
  bio: string;
  teaching_language: string;
  badges: Record<string, boolean>;
  form02: {
    provider_name: string;
    provider_kind: string;
    business_registration_no: string | null;
    place: string;
    form: string;
    teachers: string[];
    subjects: Array<{
      subject: string;
      school_level: string;
      grades: string;
      content_kind: string;
      session_minutes: number;
      price_per_session: number;
    }>;
    schedule: Array<{ weekday: number; start_minute: number; end_minute: number }>;
  };
}

const money = (value: number) => `${value.toLocaleString('vi-VN')} đồng`;
const time = (value: number) =>
  `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;

function Badges({ badges }: { badges: Record<string, boolean> }) {
  return (
    <ul className="flex flex-wrap gap-2 text-label" aria-label="Huy hiệu xác minh">
      {Object.entries(BADGE_LABELS)
        .filter(([key]) => badges[key])
        .map(([key, label]) => (
          <li key={key} className="rounded-full border px-2">
            {label}
          </li>
        ))}
    </ul>
  );
}

function TutorDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [page, setPage] = useState<TutorPage>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    marketRequest<TutorPage>('GET', `/public/tutors/${id}`)
      .then(setPage)
      .catch((caught: unknown) => setError(errorText(caught)));
  }, [id]);
  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!page) return <p>Đang tải…</p>;
  const form = page.form02;
  return (
    <article aria-label={`Gia sư ${page.display_name}`} className="flex flex-col gap-2">
      <Button onClick={onBack}>Quay lại danh sách</Button>
      <h2 className="text-section-title font-semibold">{page.display_name}</h2>
      <p>{page.headline}</p>
      <Badges badges={page.badges} />
      <p className="whitespace-pre-wrap">{page.bio}</p>
      <section aria-label="Thông tin công khai theo Mẫu 02" className="flex flex-col gap-1 rounded-lg border p-3">
        <h3 className="font-semibold">Thông tin công khai của cơ sở dạy thêm (Mẫu 02)</h3>
        <p>
          Cơ sở: {form.provider_name} ({form.provider_kind === 'organization' ? 'tổ chức' : 'cá nhân'})
          {form.business_registration_no ? `, đăng ký kinh doanh số ${form.business_registration_no}` : ''}
        </p>
        <p>
          Địa điểm: {form.place}. Hình thức: {form.form}. Ngôn ngữ dạy: {page.teaching_language}
        </p>
        <p>Người dạy: {form.teachers.join(', ')}</p>
        <table aria-label="Môn, thời lượng, mức thu" className="w-full text-label">
          <thead>
            <tr className="text-left">
              <th>Môn</th>
              <th>Khối lớp</th>
              <th>Loại nội dung</th>
              <th>Thời lượng</th>
              <th>Mức thu mỗi buổi</th>
            </tr>
          </thead>
          <tbody>
            {form.subjects.map((item, index) => (
              <tr key={index}>
                <td>{item.subject}</td>
                <td>
                  {LEVEL_LABELS[item.school_level]} {item.grades}
                </td>
                <td>{KIND_LABELS[item.content_kind]}</td>
                <td>{item.session_minutes} phút</td>
                <td>{money(item.price_per_session)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Thời gian:{' '}
          {form.schedule
            .map((slot) => `${WEEKDAYS[slot.weekday]} ${time(slot.start_minute)}–${time(slot.end_minute)}`)
            .join('; ')}
        </p>
      </section>
      <p className="text-text-secondary">Đặt buổi học sẽ mở ở bước tiếp theo của chợ.</p>
    </article>
  );
}

export function TutorSearch() {
  const [filters, setFilters] = useState({
    subject: '',
    school_level: '',
    grade: '',
    content_kind: '',
    max_price: '',
    sort: 'price_asc',
  });
  const [tutors, setTutors] = useState<TutorCard[]>();
  const [open, setOpen] = useState<string>();
  const [error, setError] = useState<string>();
  const search = useCallback((current: typeof filters) => {
    const query = new URLSearchParams(Object.entries(current).filter(([, value]) => value !== ''));
    marketRequest<{ tutors: TutorCard[] }>('GET', `/public/tutors?${query.toString()}`)
      .then((result) => {
        setError(undefined);
        setTutors(result.tutors);
      })
      .catch((caught: unknown) => setError(errorText(caught)));
  }, []);
  useEffect(
    () => search({ subject: '', school_level: '', grade: '', content_kind: '', max_price: '', sort: 'price_asc' }),
    [search],
  );

  if (open) return <TutorDetail id={open} onBack={() => setOpen(undefined)} />;
  return (
    <section aria-label="Tìm gia sư" className="flex flex-col gap-3">
      <h2 className="text-section-title font-semibold">Tìm gia sư</h2>
      <form
        aria-label="Lọc gia sư"
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          search(filters);
        }}
      >
        <label className="flex flex-col">
          Môn
          <input
            className={FORM_CONTROL_CLASS}
            value={filters.subject}
            onChange={(event) => setFilters({ ...filters, subject: event.target.value })}
          />
        </label>
        <label className="flex flex-col">
          Cấp
          <select
            className={FORM_CONTROL_CLASS}
            value={filters.school_level}
            onChange={(event) => setFilters({ ...filters, school_level: event.target.value })}
          >
            <option value="">Mọi cấp</option>
            {Object.entries(LEVEL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col">
          Lớp
          <input
            className={FORM_CONTROL_CLASS}
            type="number"
            min={1}
            max={12}
            value={filters.grade}
            onChange={(event) => setFilters({ ...filters, grade: event.target.value })}
          />
        </label>
        <label className="flex flex-col">
          Giá tối đa mỗi buổi
          <input
            className={FORM_CONTROL_CLASS}
            type="number"
            min={0}
            step={10000}
            value={filters.max_price}
            onChange={(event) => setFilters({ ...filters, max_price: event.target.value })}
          />
        </label>
        <label className="flex flex-col">
          Sắp xếp
          <select
            className={FORM_CONTROL_CLASS}
            value={filters.sort}
            onChange={(event) => setFilters({ ...filters, sort: event.target.value })}
          >
            <option value="price_asc">Giá thấp trước</option>
            <option value="price_desc">Giá cao trước</option>
            <option value="newest">Mới duyệt</option>
          </select>
        </label>
        <Button type="submit" variant="primary">
          Tìm
        </Button>
      </form>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {tutors && tutors.length === 0 ? <p className="text-text-secondary">Chưa có gia sư phù hợp.</p> : null}
      <ul className="flex flex-col gap-2" aria-label="Danh sách gia sư">
        {(tutors ?? []).map((tutor) => (
          <li
            key={tutor.id}
            aria-label={`Gia sư ${tutor.display_name}`}
            className="flex flex-col gap-1 rounded-lg border p-3"
          >
            <strong>{tutor.display_name}</strong>
            <span>{tutor.headline}</span>
            <span className="text-label">
              {tutor.subjects
                .map(
                  (item) => `${item.subject} (${LEVEL_LABELS[item.school_level]} ${item.grade_from}–${item.grade_to})`,
                )
                .join('; ')}
            </span>
            <span>Từ {money(tutor.min_price)} mỗi buổi</span>
            <Badges badges={tutor.badges} />
            <Button onClick={() => setOpen(tutor.id)}>Xem gia sư {tutor.display_name}</Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
