import { useCallback, useEffect, useState } from 'react';
import {
  disablePush,
  enablePush,
  onServiceWorkerMessage,
  readPushState,
  syncPush,
  type PushApplication,
  type PushRequest,
} from './push-client.js';
import { nativePush } from './native-push.js';
import type { PushState } from './push-state.js';

// Khối "Cài đặt thông báo" của ứng dụng giáo viên, phụ huynh, học sinh (DT-26 phần 26b, YCTD-239): bật, tắt đẩy trên máy này (chỉ
// hỏi quyền khi người dùng bấm), tắt theo nhóm loại thông báo, danh sách máy đã đăng ký và nút gỡ. iPhone, iPad chưa cài lên màn
// hình chính thì hướng dẫn cài thay cho nút bật. Thông báo khẩn của trường vẫn đến dù tắt nhóm (máy chủ quyết định)
interface PushGroupPreference {
  code: string;
  label: string;
  push_enabled: boolean;
}

interface PushDevice {
  id: string;
  app: string;
  device_label: string | null;
  last_seen_at: string;
}

export interface PushSettingsProperties {
  application: PushApplication;
  // import.meta.env.BASE_URL của ứng dụng (phạm vi service worker)
  base: string;
  request: PushRequest;
}

const STATE_TEXT: Record<Exclude<PushState, 'on' | 'off'>, string> = {
  unsupported:
    'Trình duyệt này không nhận được thông báo đẩy. Nếu đang mở trong Zalo hoặc Facebook, hãy mở bằng Chrome hoặc Safari.',
  'needs-install':
    'Trên iPhone, iPad, thông báo đẩy chỉ nhận được khi đã cài ứng dụng lên màn hình chính: chạm nút Chia sẻ, chọn "Thêm vào MH chính", rồi mở ứng dụng từ biểu tượng mới và bật ở đây.',
  'no-service-worker':
    'Ứng dụng chưa sẵn sàng nhận thông báo đẩy trên máy này (có thể trường đang tắt chế độ ngoại tuyến của ứng dụng giáo viên). Tải lại trang rồi thử lại; thông báo vẫn hiện trong ứng dụng.',
  'server-disabled': 'Hệ thống chưa bật thông báo đẩy. Thông báo vẫn hiện trong ứng dụng và qua tin nhắn như trước.',
  denied:
    'Trình duyệt đang chặn thông báo của trang này. Mở cài đặt của trình duyệt (biểu tượng ổ khóa cạnh địa chỉ trang), cho phép thông báo rồi tải lại trang.',
};

// Trong ứng dụng cài đặt (26g): quyền thông báo mở lại ở cài đặt của máy, không phải của trình duyệt
const NATIVE_DENIED_TEXT =
  'Máy đang chặn thông báo của ứng dụng. Mở Cài đặt của máy, chọn Ứng dụng → School Management → Thông báo, cho phép rồi quay lại đây.';

const BUTTON_CLASS = 'min-h-11 rounded-lg px-4 py-2 text-label font-medium disabled:opacity-60';

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

export function PushSettings({ application, base, request }: PushSettingsProperties) {
  const [state, setState] = useState<PushState>();
  const [groups, setGroups] = useState<PushGroupPreference[]>();
  const [devices, setDevices] = useState<PushDevice[]>();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();

  const load = useCallback(async () => {
    setState(await readPushState(base));
    try {
      const [preferences, subscriptions] = await Promise.all([
        request<{ groups: PushGroupPreference[] }>('/api/v1/push/preferences'),
        request<{ items: PushDevice[] }>('/api/v1/push/subscriptions'),
      ]);
      setGroups(preferences.groups);
      setDevices(subscriptions.items);
    } catch {
      setGroups(undefined);
      setDevices(undefined);
    }
  }, [base, request]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setProblem(undefined);
    try {
      await action();
    } catch {
      setProblem('Không lưu được, vui lòng thử lại');
    } finally {
      setBusy(false);
      await load();
    }
  };

  // Ô chọn đổi ngay khi bấm; lưu xong (hoặc lỗi) thì tải lại từ máy chủ
  const toggleGroup = (code: string, value: boolean) => {
    setGroups((current) => current?.map((group) => (group.code === code ? { ...group, push_enabled: value } : group)));
    return run(() =>
      request('/api/v1/push/preferences', { method: 'PUT', body: JSON.stringify({ groups: { [code]: value } }) }),
    );
  };

  return (
    <section
      aria-label="Cài đặt thông báo"
      className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3 text-label text-text"
    >
      <h2 className="text-section-title font-semibold">Cài đặt thông báo</h2>
      {state === undefined ? <p className="text-text-secondary">Đang kiểm tra máy này…</p> : null}
      {state === 'on' || state === 'off' ? (
        <div className="flex flex-wrap items-center gap-2">
          <span>{state === 'on' ? 'Máy này đang nhận thông báo đẩy.' : 'Máy này chưa nhận thông báo đẩy.'}</span>
          {state === 'on' ? (
            <button
              type="button"
              className={`${BUTTON_CLASS} border border-border-strong bg-card`}
              disabled={busy}
              onClick={() => void run(() => disablePush(base, request))}
            >
              Tắt trên máy này
            </button>
          ) : (
            <button
              type="button"
              className={`${BUTTON_CLASS} bg-brand text-white`}
              disabled={busy}
              onClick={() => void run(() => enablePush(base, application, request))}
            >
              Bật thông báo trên máy này
            </button>
          )}
        </div>
      ) : null}
      {state && state !== 'on' && state !== 'off' ? (
        <p className="text-text-secondary">
          {state === 'denied' && nativePush() ? NATIVE_DENIED_TEXT : STATE_TEXT[state]}
        </p>
      ) : null}
      {problem ? (
        <p role="alert" className="text-danger">
          {problem}
        </p>
      ) : null}
      {groups ? (
        <fieldset className="flex flex-col gap-1">
          <legend className="font-medium">Nhận thông báo đẩy về</legend>
          {groups.map((group) => (
            <label key={group.code} className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                className="size-5"
                checked={group.push_enabled}
                disabled={busy}
                onChange={(event) => void toggleGroup(group.code, event.target.checked)}
              />
              {group.label}
            </label>
          ))}
          <p className="text-text-secondary">Thông báo khẩn của trường vẫn được gửi dù tắt nhóm.</p>
        </fieldset>
      ) : null}
      {devices && devices.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="font-medium">Máy đã bật thông báo đẩy</p>
          <ul className="flex flex-col gap-1">
            {devices.map((device) => (
              <li key={device.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {device.device_label ?? 'Máy không tên'}{' '}
                  <span className="text-text-secondary">(dùng lần cuối {formatTime(device.last_seen_at)})</span>
                </span>
                <button
                  type="button"
                  className={`${BUTTON_CLASS} text-link`}
                  disabled={busy}
                  aria-label={`Gỡ ${device.device_label ?? 'máy không tên'}`}
                  onClick={() =>
                    void run(() => request(`/api/v1/push/subscriptions/${device.id}`, { method: 'DELETE' }))
                  }
                >
                  Gỡ
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

// Khối gập "Cài đặt thông báo" đặt ở trang đầu của từng ứng dụng: chỉ kiểm tra máy và gọi máy chủ khi người dùng mở
export function PushSettingsPanel(properties: PushSettingsProperties) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        className={`${BUTTON_CLASS} self-start border border-border-strong bg-card text-text`}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? 'Đóng cài đặt thông báo' : 'Cài đặt thông báo'}
      </button>
      {open ? <PushSettings {...properties} /> : null}
    </div>
  );
}

// Khi đã đăng nhập: báo lại đăng ký của máy cho máy chủ, và đăng ký lại khi trình duyệt tự đổi đăng ký
export function usePushSync(application: PushApplication, base: string, request: PushRequest, signedIn: boolean) {
  useEffect(() => {
    if (!signedIn) {
      return;
    }
    void syncPush(base, application, request);
    return onServiceWorkerMessage((message) => {
      if (message.type === 'PUSH_SUBSCRIPTION_CHANGED') {
        void syncPush(base, application, request);
      }
    });
  }, [application, base, request, signedIn]);
}
