import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, FORM_CONTROL_CLASS } from '@school-management/ui';
import { errorText, marketRequest, type Child } from './market-api.js';

// Khu phụ huynh của chợ gia sư (DT-27 phần 27f): hồ sơ con tối thiểu (tên hiển thị, năm sinh, cấp, lớp), đồng ý của cha mẹ theo phiên bản
// cho từng con, rút đồng ý, liên kết với trường bằng mã lấy ở ứng dụng phụ huynh của trường
const LEVELS = [
  { value: 'TH', label: 'Tiểu học', grades: [1, 2, 3, 4, 5] },
  { value: 'THCS', label: 'Trung học cơ sở', grades: [6, 7, 8, 9] },
  { value: 'THPT', label: 'Trung học phổ thông', grades: [10, 11, 12] },
] as const;

interface ChildrenView {
  parent_consent: { id: string; version: number; title: string } | null;
  children: Child[];
}

export function ParentArea() {
  const [view, setView] = useState<ChildrenView>();
  const [form, setForm] = useState({
    display_name: '',
    birth_year: '',
    school_level: 'THCS',
    grade: '6',
    consent: false,
  });
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const load = useCallback(() => {
    marketRequest<ChildrenView>('GET', '/children')
      .then(setView)
      .catch((caught: unknown) => setError(errorText(caught)));
  }, []);
  useEffect(load, [load]);
  const run = (work: Promise<unknown>) =>
    work
      .then(() => {
        setError(undefined);
        load();
      })
      .catch((caught: unknown) => setError(errorText(caught)));
  const consent = view?.parent_consent;
  const level = LEVELS.find((row) => row.value === form.school_level) ?? LEVELS[1];

  return (
    <section aria-label="Hồ sơ con" className="flex flex-col gap-3">
      <h2 className="text-section-title font-semibold">Hồ sơ con</h2>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <p className="text-label text-text-secondary">
        Chợ chỉ giữ tên hiển thị, năm sinh, cấp học và lớp của con; không cần tên thật, không thu số định danh hay ảnh.
        Con không có tài khoản riêng.
      </p>
      <ul className="flex flex-col gap-2">
        {(view?.children ?? []).map((child) => (
          <li
            key={child.id}
            className="flex flex-col gap-1 rounded-lg border p-2"
            aria-label={`Hồ sơ ${child.display_name}`}
          >
            <strong>
              {child.display_name} · sinh năm {child.birth_year} · lớp {child.grade}
            </strong>
            <span>{child.consent_current ? 'Đã đồng ý cho hồ sơ con' : 'Chưa đồng ý (con chưa học được ở chợ)'}</span>
            <span>
              {child.school_link
                ? `Đã liên kết với trường ${child.school_link.school_code}`
                : 'Chưa liên kết với trường'}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {child.consent_current ? (
                <Button onClick={() => void run(marketRequest('POST', `/children/${child.id}/consent/withdraw`))}>
                  Rút đồng ý cho {child.display_name}
                </Button>
              ) : consent ? (
                <Button
                  onClick={() =>
                    void run(
                      marketRequest('POST', `/children/${child.id}/consent`, { consent_document_id: consent.id }),
                    )
                  }
                >
                  Đồng ý lại cho {child.display_name}
                </Button>
              ) : null}
              <Button onClick={() => void run(marketRequest('DELETE', `/children/${child.id}`))}>
                Xóa hồ sơ {child.display_name}
              </Button>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col">
                Mã liên kết lấy ở ứng dụng phụ huynh của trường
                <input
                  className={FORM_CONTROL_CLASS}
                  value={codes[child.id] ?? ''}
                  onChange={(event) => setCodes({ ...codes, [child.id]: event.target.value })}
                />
              </label>
              <Button
                onClick={() =>
                  void run(marketRequest('POST', `/children/${child.id}/school-link`, { code: codes[child.id] ?? '' }))
                }
              >
                Liên kết {child.display_name} với trường
              </Button>
              {child.school_link ? (
                <Button onClick={() => void run(marketRequest('DELETE', `/children/${child.id}/school-link`))}>
                  Bỏ liên kết
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <form
        aria-label="Thêm hồ sơ con"
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void run(
            marketRequest('POST', '/children', {
              display_name: form.display_name,
              birth_year: Number(form.birth_year),
              school_level: form.school_level,
              grade: Number(form.grade),
              ...(form.consent && consent ? { consent_document_id: consent.id } : {}),
            }).then(() => setForm({ ...form, display_name: '', birth_year: '', consent: false })),
          );
        }}
      >
        <h3 className="font-semibold">Thêm hồ sơ con</h3>
        <label className="flex flex-col">
          Tên hiển thị của con
          <input
            className={FORM_CONTROL_CLASS}
            value={form.display_name}
            onChange={(event) => setForm({ ...form, display_name: event.target.value })}
          />
        </label>
        <label className="flex flex-col">
          Năm sinh
          <input
            className={FORM_CONTROL_CLASS}
            inputMode="numeric"
            value={form.birth_year}
            onChange={(event) => setForm({ ...form, birth_year: event.target.value })}
          />
        </label>
        <label className="flex flex-col">
          Cấp học
          <select
            className={FORM_CONTROL_CLASS}
            value={form.school_level}
            onChange={(event) => {
              const next = LEVELS.find((row) => row.value === event.target.value) ?? LEVELS[1];
              setForm({ ...form, school_level: next.value, grade: String(next.grades[0]) });
            }}
          >
            {LEVELS.map((row) => (
              <option key={row.value} value={row.value}>
                {row.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col">
          Lớp
          <select
            className={FORM_CONTROL_CLASS}
            value={form.grade}
            onChange={(event) => setForm({ ...form, grade: event.target.value })}
          >
            {level.grades.map((grade) => (
              <option key={grade} value={grade}>
                Lớp {grade}
              </option>
            ))}
          </select>
        </label>
        {consent ? (
          <label>
            <input
              type="checkbox"
              checked={form.consent}
              onChange={(event) => setForm({ ...form, consent: event.target.checked })}
            />{' '}
            Tôi là cha mẹ hoặc người giám hộ và đồng ý {consent.title} (phiên bản {consent.version})
          </label>
        ) : (
          <Alert tone="warning">Chợ chưa đăng văn bản đồng ý của cha mẹ.</Alert>
        )}
        <Button type="submit" variant="primary">
          Thêm hồ sơ con
        </Button>
      </form>
    </section>
  );
}
