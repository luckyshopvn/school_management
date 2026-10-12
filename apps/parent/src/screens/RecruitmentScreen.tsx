import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, TextField } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// MH-65 Trang tuyển dụng công khai (P18-02, P18-03; BR-69; YCTD-87): người ngoài không cần tài khoản xem tin tuyển dụng
// đã công bố còn hạn nộp và nộp hồ sơ kèm hồ sơ xin việc (ảnh hoặc PDF tối đa 10 MB). Mở bằng địa chỉ #tuyen-dung, từ
// liên kết trên màn hình đăng nhập
export const RECRUITMENT_HASH = '#tuyen-dung';

interface PublicJobPost {
  id: string;
  title: string;
  description: string;
  requirements: string;
  deadline: string;
  position: string;
  quantity: number;
  unit_name: string;
}

const emptyForm = { full_name: '', phone: '', email: '', dob: '', address: '', cover_letter: '' };

// Theo dõi phần sau dấu # của địa chỉ để mở trang công khai mà không cần đăng nhập
export function useRecruitmentRoute(): boolean {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const update = () => setHash(window.location.hash);
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  return hash === RECRUITMENT_HASH;
}

export function RecruitmentScreen() {
  const [posts, setPosts] = useState<PublicJobPost[]>();
  const [loadError, setLoadError] = useState<string>();
  const [selected, setSelected] = useState<PublicJobPost>();

  useEffect(() => {
    requestJson<PublicJobPost[]>('/api/v1/public/job-posts')
      .then(setPosts)
      .catch((error: unknown) =>
        setLoadError(error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại'),
      );
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 px-4 py-8">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-page-title font-bold text-text">Tuyển dụng giáo viên và nhân viên</h1>
        <a href="#" className="text-label font-medium text-text underline">
          Về trang đăng nhập
        </a>
      </div>
      {loadError ? <Alert tone="danger">{loadError}</Alert> : null}
      {posts && posts.length === 0 ? (
        <p className="text-content text-text-secondary">Hiện nhà trường chưa có tin tuyển dụng nào</p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {(posts ?? []).map((post) => (
          <li key={post.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
            <h2 className="text-section-title font-semibold text-text">{post.title}</h2>
            <p className="text-label text-text-secondary">
              {post.unit_name}. Vị trí {post.position}, cần {post.quantity} người. Hạn nộp {post.deadline}
            </p>
            <p className="whitespace-pre-line text-content text-text">{post.description}</p>
            <p className="whitespace-pre-line text-content text-text">Yêu cầu: {post.requirements}</p>
            <div>
              <Button variant="secondary" onClick={() => setSelected(post)}>
                Ứng tuyển {post.title}
              </Button>
            </div>
            {selected?.id === post.id ? <ApplyForm post={post} /> : null}
          </li>
        ))}
      </ul>
    </main>
  );
}

function ApplyForm({ post }: { post: PublicJobPost }) {
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState<File>();
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(undefined);
    setFieldErrors({});
    setSubmitting(true);
    try {
      const body = new FormData();
      for (const [key, value] of Object.entries(form)) {
        if (value.trim()) {
          body.append(key, value.trim());
        }
      }
      body.append('consent', consent ? 'true' : 'false');
      if (file) {
        body.append('cv', file);
      }
      const result = await requestJson<{ message: string }>(`/api/v1/public/job-posts/${post.id}/applications`, {
        method: 'POST',
        body,
      });
      setMessage(result.message);
      setForm(emptyForm);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
        setFieldErrors(Object.fromEntries(error.details.map((detail) => [detail.field, detail.message])));
      } else {
        setErrorMessage('Không kết nối được tới máy chủ, vui lòng thử lại');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (message) {
    return <Alert tone="success">{message}</Alert>;
  }
  return (
    <form aria-label={`Nộp hồ sơ ${post.title}`} noValidate onSubmit={submit} className="flex flex-col gap-3">
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      <TextField
        label="Họ và tên"
        value={form.full_name}
        onChange={(event) => setForm({ ...form, full_name: event.target.value })}
        error={fieldErrors.full_name}
      />
      <TextField
        label="Số điện thoại"
        type="tel"
        inputMode="tel"
        value={form.phone}
        onChange={(event) => setForm({ ...form, phone: event.target.value })}
        error={fieldErrors.phone}
      />
      <TextField
        label="Thư điện tử"
        type="email"
        value={form.email}
        onChange={(event) => setForm({ ...form, email: event.target.value })}
        error={fieldErrors.email}
      />
      <TextField
        label="Ngày sinh"
        type="date"
        value={form.dob}
        onChange={(event) => setForm({ ...form, dob: event.target.value })}
        error={fieldErrors.dob}
      />
      <TextField
        label="Địa chỉ"
        value={form.address}
        onChange={(event) => setForm({ ...form, address: event.target.value })}
        error={fieldErrors.address}
      />
      <TextField
        label="Giới thiệu bản thân"
        value={form.cover_letter}
        onChange={(event) => setForm({ ...form, cover_letter: event.target.value })}
        error={fieldErrors.cover_letter}
      />
      <label className="flex flex-col gap-1 text-label font-medium text-text">
        Hồ sơ xin việc (PDF hoặc ảnh, tối đa 10 MB)
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          onChange={(event) => setFile(event.target.files?.[0])}
        />
        {fieldErrors.cv || fieldErrors.file ? (
          <span className="text-danger">{fieldErrors.cv ?? fieldErrors.file}</span>
        ) : null}
      </label>
      <label className="flex items-start gap-2 text-label text-text">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
        Tôi đồng ý cho nhà trường lưu và xử lý thông tin cá nhân trong hồ sơ này để tuyển dụng
      </label>
      {fieldErrors.consent ? <span className="text-label text-danger">{fieldErrors.consent}</span> : null}
      <Button type="submit" variant="primary" disabled={submitting}>
        {submitting ? 'Đang gửi…' : 'Gửi hồ sơ'}
      </Button>
    </form>
  );
}
