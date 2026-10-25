import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { dashboardApi, PlatformValidationError, type MaintenanceNotice } from './platform-api.js';

// Thông báo bảo trì (DT-SaaS phần S4, YCTD-197): người vận hành tạo thông báo cho mọi trường hoặc một số trường; người dùng của trường
// thấy biểu ngữ từ 72 giờ trước khi bắt đầu đến khi kết thúc; hủy được
const SEVERITY_LABELS: Record<MaintenanceNotice['severity'], string> = {
  info: 'Thông tin',
  warning: 'Cảnh báo',
  critical: 'Nghiêm trọng',
};
const STATE_LABELS: Record<MaintenanceNotice['state'], string> = {
  scheduled: 'Sắp tới',
  active: 'Đang diễn ra',
  ended: 'Đã kết thúc',
  cancelled: 'Đã hủy',
};

function messageOf(caught: unknown): string {
  if (caught instanceof PlatformValidationError && caught.problems.length) {
    return caught.problems.map((problem) => problem.message).join('; ');
  }
  return caught instanceof Error ? caught.message : 'Không thực hiện được';
}

export function MaintenancePage({ token }: { token: string }) {
  const [items, setItems] = useState<MaintenanceNotice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [severity, setSeverity] = useState<MaintenanceNotice['severity']>('info');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [schoolCodes, setSchoolCodes] = useState('');

  const load = useCallback(() => {
    dashboardApi
      .notices(token)
      .then((reply) => setItems(reply.items))
      .catch((caught: unknown) => setError(messageOf(caught)));
  }, [token]);
  useEffect(load, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const codes = schoolCodes
      .split(/[\s,;]+/)
      .map((code) => code.trim())
      .filter(Boolean);
    try {
      await dashboardApi.createNotice(token, {
        title,
        body,
        severity,
        starts_at: startsAt ? new Date(startsAt).toISOString() : '',
        ends_at: endsAt ? new Date(endsAt).toISOString() : '',
        audience: codes.length ? 'schools' : 'all',
        school_codes: codes,
      });
      setNotice('Đã tạo thông báo bảo trì');
      setTitle('');
      setBody('');
      setSchoolCodes('');
      load();
    } catch (caught) {
      setError(messageOf(caught));
    }
  }

  async function cancel(id: string) {
    setError(null);
    try {
      await dashboardApi.cancelNotice(token, id);
      setNotice('Đã hủy thông báo');
      load();
    } catch (caught) {
      setError(messageOf(caught));
    }
  }

  return (
    <section>
      <h2>Thông báo bảo trì</h2>
      {error ? <p role="alert">{error}</p> : null}
      {notice ? <p className="notice">{notice}</p> : null}
      <form className="wizard" aria-label="Tạo thông báo bảo trì" onSubmit={(event) => void submit(event)}>
        <label>
          Tiêu đề
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required />
        </label>
        <label>
          Nội dung
          <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} rows={3} required />
        </label>
        <label>
          Mức độ
          <select
            value={severity}
            onChange={(event) => setSeverity(event.target.value as MaintenanceNotice['severity'])}
          >
            {Object.entries(SEVERITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Bắt đầu
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            required
          />
        </label>
        <label>
          Kết thúc
          <input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} required />
        </label>
        <label>
          Mã trường nhận (để trống là mọi trường; cách nhau bằng dấu phẩy)
          <input value={schoolCodes} onChange={(event) => setSchoolCodes(event.target.value)} />
        </label>
        <button type="submit">Tạo thông báo</button>
      </form>
      <table aria-label="Danh sách thông báo bảo trì">
        <thead>
          <tr>
            <th>Tiêu đề</th>
            <th>Mức độ</th>
            <th>Thời gian</th>
            <th>Trường nhận</th>
            <th>Trạng thái</th>
            <th>Người tạo</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <strong>{item.title}</strong>
                <div>{item.body}</div>
              </td>
              <td>{SEVERITY_LABELS[item.severity]}</td>
              <td>
                {new Date(item.starts_at).toLocaleString('vi-VN')} đến {new Date(item.ends_at).toLocaleString('vi-VN')}
              </td>
              <td>{item.audience === 'all' ? 'Mọi trường' : item.school_codes.join(', ')}</td>
              <td>{STATE_LABELS[item.state]}</td>
              <td>{item.created_by_name}</td>
              <td>
                {item.state === 'scheduled' || item.state === 'active' ? (
                  <button type="button" onClick={() => void cancel(item.id)}>
                    Hủy
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
