import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { operatorCan, type OperatorRole } from '@school-management/shared';
import { dashboardApi, type MaintenanceNotice } from './platform-api.js';
import {
  ConfirmDialog,
  EmptyState,
  errorMessage,
  fieldError,
  LoadError,
  OutcomeBanner,
  Skeleton,
  useBusy,
  type Outcome,
} from './platform-ui.js';

// Thông báo bảo trì (DT-SaaS phần S4, YCTD-197): người vận hành tạo thông báo cho mọi trường hoặc một số trường; người dùng của trường
// thấy biểu ngữ từ 72 giờ trước khi bắt đầu đến khi kết thúc; hủy được. Giao diện theo bảng vẽ Bảo trì (YCTD-370): danh sách bên trái,
// thẻ tạo bên phải chỉ cho vai trò có maintenance.manage; hủy hỏi xác nhận
const SEVERITY: Record<MaintenanceNotice['severity'], { label: string; tone: string }> = {
  info: { label: 'Thông tin', tone: 'info' },
  warning: { label: 'Cảnh báo', tone: 'warn' },
  critical: { label: 'Nghiêm trọng', tone: 'danger' },
};
const STATE: Record<MaintenanceNotice['state'], { label: string; tone: string }> = {
  scheduled: { label: 'Sắp tới', tone: 'info' },
  active: { label: 'Đang diễn ra', tone: 'ok' },
  ended: { label: 'Đã kết thúc', tone: 'idle' },
  cancelled: { label: 'Đã hủy', tone: 'idle' },
};

function shortTime(value: string): string {
  return new Date(value).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function CreateNoticeForm({ token, onCreated }: { token: string; onCreated: (outcome: Outcome) => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [severity, setSeverity] = useState<MaintenanceNotice['severity']>('info');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [audience, setAudience] = useState<'all' | 'schools'>('all');
  const [schoolCodes, setSchoolCodes] = useState('');
  const [failure, setFailure] = useState<unknown>(null);
  const [busy, run] = useBusy();

  // Kết thúc trước bắt đầu: báo ngay tại ô (máy chủ vẫn kiểm)
  const endBeforeStart = startsAt !== '' && endsAt !== '' && new Date(endsAt) <= new Date(startsAt);
  const endError = endBeforeStart ? 'Giờ kết thúc phải sau giờ bắt đầu.' : fieldError(failure, 'ends_at');
  const codesError = fieldError(failure, 'school_codes');

  function submit(event: FormEvent) {
    event.preventDefault();
    if (endBeforeStart) {
      return;
    }
    void run(async () => {
      setFailure(null);
      const codes =
        audience === 'schools'
          ? schoolCodes
              .split(/[\s,;]+/)
              .map((code) => code.trim())
              .filter(Boolean)
          : [];
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
        setTitle('');
        setBody('');
        setSchoolCodes('');
        onCreated({ tone: 'ok', text: 'Đã tạo thông báo bảo trì.' });
      } catch (caught) {
        setFailure(caught);
        onCreated({ tone: 'danger', text: `Không tạo được thông báo: ${errorMessage(caught)}` });
      }
    });
  }

  return (
    <section className="card narrow" aria-labelledby="tao-thong-bao">
      <h2 id="tao-thong-bao">Tạo thông báo</h2>
      <form className="stack" aria-label="Tạo thông báo bảo trì" onSubmit={submit}>
        <label className="field">
          <span>
            Tiêu đề <span className="hint">tối đa 200 ký tự</span>
          </span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required />
        </label>
        <label className="field">
          <span>
            Nội dung <span className="hint">tối đa 2.000 ký tự</span>
          </span>
          <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} rows={3} required />
        </label>
        <label className="field">
          Mức độ
          <select
            value={severity}
            onChange={(event) => setSeverity(event.target.value as MaintenanceNotice['severity'])}
          >
            {Object.entries(SEVERITY).map(([value, item]) => (
              <option key={value} value={value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid-2">
          <label className="field">
            Bắt đầu
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              required
            />
          </label>
          <label className="field">
            Kết thúc
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
              required
              aria-invalid={endError ? true : undefined}
              aria-describedby={endError ? 'ket-thuc-loi' : undefined}
            />
            {endError ? (
              <span className="field-error" id="ket-thuc-loi">
                {endError}
              </span>
            ) : null}
          </label>
        </div>
        <fieldset className="stack" style={{ gap: '0.25rem', border: 0, margin: 0, padding: 0 }}>
          <legend className="field">Gửi tới</legend>
          <label className="check">
            <input
              type="radio"
              name="gui-toi"
              checked={audience === 'all'}
              onChange={() => setAudience('all')}
            />
            Mọi trường
          </label>
          <label className="check">
            <input
              type="radio"
              name="gui-toi"
              checked={audience === 'schools'}
              onChange={() => setAudience('schools')}
            />
            Một số trường
          </label>
        </fieldset>
        {audience === 'schools' ? (
          <label className="field">
            <span>
              Mã trường nhận <span className="hint">cách nhau bằng dấu phẩy hoặc xuống dòng</span>
            </span>
            <textarea
              value={schoolCodes}
              onChange={(event) => setSchoolCodes(event.target.value)}
              rows={2}
              required
              aria-invalid={codesError ? true : undefined}
            />
            {codesError ? <span className="field-error">{codesError}</span> : null}
          </label>
        ) : null}
        <div className="button-row">
          <button type="submit" className="button-primary button-large" disabled={busy} aria-busy={busy}>
            {busy ? 'Đang tạo…' : 'Tạo thông báo'}
          </button>
        </div>
      </form>
    </section>
  );
}

export function MaintenancePage({ token, role }: { token: string; role: OperatorRole }) {
  const canManage = operatorCan(role, 'maintenance.manage');
  const [items, setItems] = useState<MaintenanceNotice[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [cancelling, setCancelling] = useState<MaintenanceNotice | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [busy, run] = useBusy();

  const load = useCallback(() => {
    setLoadError(null);
    dashboardApi
      .notices(token)
      .then((reply) => setItems(reply.items))
      .catch((caught: unknown) =>
        setLoadError(`Không đọc được danh sách thông báo: ${errorMessage(caught)}. Bấm Tải lại; lỗi lặp lại thì báo nhóm kỹ thuật.`),
      );
  }, [token]);
  useEffect(load, [load]);

  function confirmCancel() {
    const target = cancelling;
    if (!target) {
      return;
    }
    void run(async () => {
      setCancelError(null);
      try {
        await dashboardApi.cancelNotice(token, target.id);
        setCancelling(null);
        setOutcome({ tone: 'ok', text: `Đã hủy thông báo "${target.title}".` });
        load();
      } catch (caught) {
        setCancelError(`Không hủy được: ${errorMessage(caught)}`);
      }
    });
  }

  return (
    <section aria-label="Bảo trì">
      <div className="page-head">
        <div>
          <h1>Bảo trì</h1>
          <p className="lead">
            Thông báo bảo trì gửi tới trường. Người dùng của trường thấy biểu ngữ từ 72 giờ trước giờ bắt đầu đến khi kết
            thúc.
          </p>
        </div>
      </div>
      <OutcomeBanner outcome={outcome} onClose={() => setOutcome(null)} />
      {loadError ? <LoadError message={loadError} onRetry={load} /> : null}
      <div className="columns">
        <section className="card wide" aria-labelledby="danh-sach-thong-bao">
          <h2 id="danh-sach-thong-bao">Thông báo bảo trì</h2>
          {items === null && !loadError ? <Skeleton lines={3} /> : null}
          {items?.length === 0 ? (
            <EmptyState title="Chưa có thông báo bảo trì">
              Thông báo đã tạo hiện ở đây kèm trạng thái Sắp tới, Đang diễn ra, Đã kết thúc, Đã hủy.
            </EmptyState>
          ) : null}
          {items && items.length > 0 ? (
            <div className="table-scroll">
              <table className="sticky-first" aria-label="Danh sách thông báo bảo trì" style={{ minWidth: 760 }}>
                <thead>
                  <tr>
                    <th scope="col">Thông báo</th>
                    <th scope="col">Mức độ</th>
                    <th scope="col">Thời gian</th>
                    <th scope="col">Trường nhận</th>
                    <th scope="col">Trạng thái</th>
                    <th scope="col">Người tạo</th>
                    {canManage ? (
                      <th scope="col">
                        <span className="visually-hidden">Thao tác</span>
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td style={{ minWidth: '14rem' }}>
                        <strong>{item.title}</strong>
                        <div className="muted">{item.body}</div>
                      </td>
                      <td>
                        <span className="status" data-tone={SEVERITY[item.severity].tone}>
                          {SEVERITY[item.severity].label}
                        </span>
                      </td>
                      <td>
                        <span className="nowrap">{shortTime(item.starts_at)}</span>
                        <br />
                        <span className="nowrap">đến {shortTime(item.ends_at)}</span>
                      </td>
                      <td>
                        {item.audience === 'all'
                          ? 'Mọi trường'
                          : item.school_codes.map((code, index) => (
                              <span key={code} className="nowrap">
                                {code}
                                {index < item.school_codes.length - 1 ? ', ' : ''}
                              </span>
                            ))}
                      </td>
                      <td>
                        <span className="status" data-tone={STATE[item.state].tone}>
                          {STATE[item.state].label}
                        </span>
                      </td>
                      <td>{item.created_by_name}</td>
                      {canManage ? (
                        <td>
                          {item.state === 'scheduled' || item.state === 'active' ? (
                            <button
                              type="button"
                              className="button-link danger"
                              aria-label={`Hủy thông báo ${item.title}`}
                              onClick={() => {
                                setCancelError(null);
                                setCancelling(item);
                              }}
                            >
                              Hủy
                            </button>
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
        {canManage ? (
          <CreateNoticeForm
            token={token}
            onCreated={(result) => {
              setOutcome(result);
              if (result.tone === 'ok') {
                load();
              }
            }}
          />
        ) : null}
      </div>
      {cancelling ? (
        <ConfirmDialog
          title={`Hủy thông báo "${cancelling.title}"?`}
          confirmLabel="Hủy thông báo"
          danger
          busy={busy}
          error={cancelError}
          onConfirm={confirmCancel}
          onCancel={() => setCancelling(null)}
        >
          <p style={{ margin: 0 }}>
            Biểu ngữ thôi hiện ở các trường nhận. Thông báo đã hủy không mở lại được; cần thì tạo thông báo mới.
          </p>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
