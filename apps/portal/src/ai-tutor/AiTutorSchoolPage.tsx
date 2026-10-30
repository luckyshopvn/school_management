import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, FORM_CONTROL_CLASS, StatusBadge, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError, requestJson } from '../session/api-client.js';
import { AiTutorSchoolReport } from './AiTutorSchoolReport.js';

// Cài đặt Gia sư AI của trường (YCTD-383 lát L1a; bản mẫu MH-599): bật theo cấp học, khung giờ khóa (mặc định 22:00 đến 6:00), tạo,
// sửa, ngừng bán gói tháng và gói lượt, xem các lần mua của phụ huynh. Máy chủ giữ quy tắc; trang chỉ hiện và gửi
type Level = 'TH' | 'THCS' | 'THPT';
const LEVELS: Array<{ code: Level; name: string }> = [
  { code: 'TH', name: 'Tiểu học' },
  { code: 'THCS', name: 'Trung học cơ sở' },
  { code: 'THPT', name: 'Trung học phổ thông' },
];

interface Plan {
  id: string;
  kind: 'monthly' | 'top_up';
  name: string;
  price: number;
  turns: number;
  allow_images: boolean;
  school_levels: Level[];
  status: 'active' | 'archived';
  active_count: number;
}

interface Overview {
  settings: { enabled_levels: Level[]; quiet_start: string; quiet_end: string };
  // Lý do chưa bán được gói của trường (gói dịch vụ chưa đặt đơn giá AI, YCTD-383 lát L3); máy chủ cũ không trả thì coi như bán được
  sales_block_reason?: string | null;
  plans: Plan[];
}

interface Purchases {
  purchases: Array<{
    id: string;
    child_name: string | null;
    class_name: string | null;
    plan_kind: 'monthly' | 'top_up';
    plan_name: string;
    period_month: string | null;
    price: number;
    status: 'pending' | 'active' | 'cancelled' | 'refunded';
    used_turns: number;
    turns: number;
    buyer_name: string;
    created_at: string;
    invoiced: boolean;
  }>;
  upgrades: Array<{
    id: string;
    child_name: string | null;
    from_plan_name: string;
    to_plan_name: string;
    price_difference: number;
    extra_turns: number;
    remaining_days: number;
    days_in_month: number;
    buyer_name: string;
    created_at: string;
    invoiced: boolean;
  }>;
}

interface PlanForm {
  id?: string;
  kind: 'monthly' | 'top_up';
  name: string;
  price: string;
  turns: string;
  allow_images: boolean;
  school_levels: Level[];
  status: 'active' | 'archived';
}

const API = '/api/v1/ai-tutor/school';
const EMPTY_FORM: PlanForm = {
  kind: 'monthly',
  name: '',
  price: '',
  turns: '',
  allow_images: false,
  school_levels: ['TH', 'THCS', 'THPT'],
  status: 'active',
};
const money = (value: number) => `${value.toLocaleString('vi-VN')} đ`;
const vietnamDate = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short' }).format(new Date(value));
const STATUS_LABELS = { pending: 'Chờ thanh toán', active: 'Đang dùng', cancelled: 'Đã hủy', refunded: 'Đã hoàn tiền' };

function messageOf(error: unknown): string {
  if (error instanceof ApiError) {
    const details = error.details?.map((detail) => detail.message).filter(Boolean) ?? [];
    return details.length > 0 ? details.join('; ') : error.message;
  }
  return 'Không thực hiện được, vui lòng thử lại';
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

function SettingsForm({ overview, notify }: { overview: Overview; notify(message: string): void }) {
  const queryClient = useQueryClient();
  const [levels, setLevels] = useState<Level[]>(overview.settings.enabled_levels);
  const [quietStart, setQuietStart] = useState(overview.settings.quiet_start);
  const [quietEnd, setQuietEnd] = useState(overview.settings.quiet_end);
  const save = useMutation({
    mutationFn: () =>
      requestJson(
        `${API}/settings`,
        json('PUT', { enabled_levels: levels, quiet_start: quietStart, quiet_end: quietEnd }),
      ),
    onSuccess: async () => {
      notify('Đã lưu cài đặt Gia sư AI');
      await queryClient.invalidateQueries({ queryKey: ['ai-tutor-school'] });
    },
  });
  const enabledNames = LEVELS.filter((level) => overview.settings.enabled_levels.includes(level.code)).map(
    (level) => level.name,
  );
  return (
    <form
      aria-label="Cài đặt Gia sư AI"
      className="flex flex-col gap-3 rounded-lg border border-border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <Alert tone="info">
        {enabledNames.length > 0 ? `Đang bật cho ${enabledNames.join(', ')}.` : 'Chưa bật cho cấp học nào.'} Khóa AI của
        nền tảng: token của gói trường bán tính lên hóa đơn dịch vụ. Phụ huynh vẫn có thể mua trực tiếp từ nền tảng.
      </Alert>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <fieldset className="flex flex-wrap gap-4">
        <legend className="text-label text-text-secondary">Bật cho cấp học</legend>
        {LEVELS.map((level) => (
          <label key={level.code} className="flex items-center gap-2 text-content">
            <input
              type="checkbox"
              checked={levels.includes(level.code)}
              onChange={(event) =>
                setLevels(
                  event.target.checked
                    ? LEVELS.map((item) => item.code).filter((code) => code === level.code || levels.includes(code))
                    : levels.filter((code) => code !== level.code),
                )
              }
            />
            {level.name}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col text-label">
          Khóa từ
          <input
            type="time"
            className={FORM_CONTROL_CLASS}
            value={quietStart}
            onChange={(event) => setQuietStart(event.target.value)}
          />
        </label>
        <label className="flex flex-col text-label">
          Mở lại lúc
          <input
            type="time"
            className={FORM_CONTROL_CLASS}
            value={quietEnd}
            onChange={(event) => setQuietEnd(event.target.value)}
          />
        </label>
      </div>
      <p className="text-label text-text-secondary">
        Khung giờ khóa theo giờ Việt Nam; giờ khóa lớn hơn giờ mở lại là khung qua nửa đêm (mặc định 22:00 đến 6:00).
        Khóa khi làm bài kiểm tra: luôn bật. Bài tập giáo viên đánh dấu Không dùng AI: khóa đến khi em nộp bài hoặc bài
        đóng. Lưu lịch sử trò chuyện: 12 tháng. Câu có dấu hiệu tự hại, bị bắt nạt: báo giáo viên chủ nhiệm; lớp chưa có
        giáo viên chủ nhiệm thì báo Ban Giám hiệu; cha mẹ cũng nhận thông báo (không có câu em gửi).
      </p>
      <div>
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Lưu cài đặt
        </Button>
      </div>
    </form>
  );
}

function PlanEditor({ initial, onDone }: { initial: PlanForm; onDone(message: string): void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PlanForm>(initial);
  useEffect(() => setForm(initial), [initial]);
  const save = useMutation({
    mutationFn: () => {
      const body = {
        kind: form.kind,
        name: form.name,
        price: Number(form.price),
        turns: Number(form.turns),
        allow_images: form.kind === 'monthly' && form.allow_images,
        school_levels: form.school_levels,
        status: form.status,
      };
      return form.id
        ? requestJson(`${API}/plans/${form.id}`, json('PUT', body))
        : requestJson(`${API}/plans`, json('POST', body));
    },
    onSuccess: async () => {
      onDone(form.id ? `Đã lưu gói ${form.name}` : `Đã tạo gói ${form.name}`);
      await queryClient.invalidateQueries({ queryKey: ['ai-tutor-school'] });
    },
  });
  return (
    <form
      aria-label={form.id ? `Sửa gói ${initial.name}` : 'Tạo gói'}
      className="flex flex-col gap-3 rounded-lg border border-border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <h2 className="text-section-title font-semibold text-text">{form.id ? `Sửa gói ${initial.name}` : 'Tạo gói'}</h2>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col text-label">
          Loại gói
          <select
            className={FORM_CONTROL_CLASS}
            value={form.kind}
            disabled={form.id !== undefined}
            onChange={(event) => setForm({ ...form, kind: event.target.value as PlanForm['kind'] })}
          >
            <option value="monthly">Gói tháng</option>
            <option value="top_up">Gói lượt mua thêm</option>
          </select>
        </label>
        <label className="flex flex-col text-label">
          Tên gói
          <input
            className={FORM_CONTROL_CLASS}
            value={form.name}
            maxLength={80}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </label>
        <label className="flex flex-col text-label">
          {form.kind === 'monthly' ? 'Giá tháng (đồng)' : 'Giá (đồng)'}
          <input
            inputMode="numeric"
            className={FORM_CONTROL_CLASS}
            value={form.price}
            onChange={(event) => setForm({ ...form, price: event.target.value })}
          />
        </label>
        <label className="flex flex-col text-label">
          {form.kind === 'monthly' ? 'Số lượt mỗi tháng' : 'Số lượt'}
          <input
            inputMode="numeric"
            className={FORM_CONTROL_CLASS}
            value={form.turns}
            onChange={(event) => setForm({ ...form, turns: event.target.value })}
          />
        </label>
      </div>
      {form.kind === 'monthly' ? (
        <label className="flex items-center gap-2 text-content">
          <input
            type="checkbox"
            checked={form.allow_images}
            onChange={(event) => setForm({ ...form, allow_images: event.target.checked })}
          />
          Cho gửi ảnh bài tập
        </label>
      ) : null}
      <fieldset className="flex flex-wrap gap-4">
        <legend className="text-label text-text-secondary">Cấp học được mua</legend>
        {LEVELS.map((level) => (
          <label key={level.code} className="flex items-center gap-2 text-content">
            <input
              type="checkbox"
              checked={form.school_levels.includes(level.code)}
              onChange={(event) =>
                setForm({
                  ...form,
                  school_levels: event.target.checked
                    ? LEVELS.map((item) => item.code).filter(
                        (code) => code === level.code || form.school_levels.includes(code),
                      )
                    : form.school_levels.filter((code) => code !== level.code),
                })
              }
            />
            {level.name}
          </label>
        ))}
      </fieldset>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={save.isPending}>
          {form.id ? 'Lưu gói' : 'Tạo gói'}
        </Button>
        {form.id ? (
          <Button onClick={() => onDone('')} disabled={save.isPending}>
            Bỏ sửa
          </Button>
        ) : null}
      </div>
    </form>
  );
}

// Cờ cảnh báo của lớp chưa có giáo viên chủ nhiệm (YCTD-383 lát L3): Hiệu trưởng, Phó Hiệu trưởng nhận thay và đánh dấu đã xử lý.
// Máy chủ chỉ trả cờ người xem được thấy; không có cờ thì ẩn mục
interface SafetyFlag {
  id: string;
  child_name: string;
  class_name: string | null;
  kind_label: string;
  created_at: string;
  excerpt: string;
  resolved: boolean;
  resolved_by_name: string | null;
}

const FLAGS_API = '/api/v1/ai-tutor/safety-flags';
const formatTime = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(
    new Date(value),
  );

function SafetyFlagsSection({ notify }: { notify(message: string): void }) {
  const queryClient = useQueryClient();
  const flags = useQuery({
    queryKey: ['ai-tutor-safety-flags'],
    queryFn: () => requestJson<{ pending_count: number; flags: SafetyFlag[] }>(FLAGS_API),
  });
  const resolve = useMutation({
    mutationFn: (flag: SafetyFlag) => requestJson(`${FLAGS_API}/${flag.id}/resolve`, json('POST', {})),
    onSuccess: async (_result, flag) => {
      notify(`Đã đánh dấu đã xử lý cờ của ${flag.child_name}`);
      await queryClient.invalidateQueries({ queryKey: ['ai-tutor-safety-flags'] });
    },
  });
  if (!flags.data || flags.data.flags.length === 0) {
    return null;
  }
  return (
    <section className="flex flex-col gap-3" aria-label="Cờ cần xử lý">
      <h2 className="text-section-title font-semibold text-text">
        Cờ cần xử lý của lớp chưa có giáo viên chủ nhiệm ({flags.data.pending_count})
      </h2>
      {resolve.error ? <Alert tone="danger">{messageOf(resolve.error)}</Alert> : null}
      <ul className="flex flex-col gap-2">
        {flags.data.flags.map((flag) => (
          <li key={flag.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex-1 text-content font-semibold">
                {flag.child_name}
                {flag.class_name ? (
                  <span className="ml-2 text-label text-text-secondary">Lớp {flag.class_name}</span>
                ) : null}
              </span>
              <StatusBadge tone={flag.resolved ? 'neutral' : 'danger'} label={flag.kind_label} />
            </div>
            <p className="text-label text-text-secondary">{formatTime(flag.created_at)}</p>
            <blockquote className="border-l-4 border-border pl-3 text-content">{flag.excerpt}</blockquote>
            {flag.resolved ? (
              <p className="text-label text-text-secondary">
                Đã xử lý{flag.resolved_by_name ? ` bởi ${flag.resolved_by_name}` : ''}
              </p>
            ) : (
              <div>
                <Button variant="primary" disabled={resolve.isPending} onClick={() => resolve.mutate(flag)}>
                  Đã xử lý
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AiTutorSchoolPage() {
  const queryClient = useQueryClient();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const [editing, setEditing] = useState<PlanForm>(EMPTY_FORM);
  const [month, setMonth] = useState('');
  const overview = useQuery({ queryKey: ['ai-tutor-school'], queryFn: () => requestJson<Overview>(API) });
  const purchases = useQuery({
    queryKey: ['ai-tutor-school', 'purchases', month],
    queryFn: () => requestJson<Purchases>(`${API}/purchases${month ? `?month=${month}` : ''}`),
  });
  const toggle = useMutation({
    mutationFn: (plan: Plan) =>
      requestJson(
        `${API}/plans/${plan.id}`,
        json('PUT', {
          name: plan.name,
          price: plan.price,
          turns: plan.turns,
          allow_images: plan.allow_images,
          school_levels: plan.school_levels,
          status: plan.status === 'active' ? 'archived' : 'active',
        }),
      ),
    onSuccess: async () => {
      setToastMessage('Đã đổi trạng thái gói');
      await queryClient.invalidateQueries({ queryKey: ['ai-tutor-school'] });
    },
  });
  const finishEdit = (message: string) => {
    setEditing(EMPTY_FORM);
    if (message) {
      setToastMessage(message);
    }
  };
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/ai-tutor')}</h1>
        {overview.error ? <Alert tone="danger">{messageOf(overview.error)}</Alert> : null}
        {toggle.error ? <Alert tone="danger">{messageOf(toggle.error)}</Alert> : null}
        {overview.data?.sales_block_reason ? (
          <Alert tone="warning">
            <strong>Chưa bán được gói của trường.</strong> {overview.data.sales_block_reason} Học sinh đã mua trước đó
            vẫn dùng bình thường.
          </Alert>
        ) : null}
        {overview.data ? (
          <SettingsForm
            key={JSON.stringify(overview.data.settings)}
            overview={overview.data}
            notify={setToastMessage}
          />
        ) : null}
        <SafetyFlagsSection notify={setToastMessage} />
        <section className="flex flex-col gap-3" aria-label="Gói của trường">
          <h2 className="text-section-title font-semibold text-text">Gói của trường</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-content">
              <thead>
                <tr className="text-left text-label text-text-secondary">
                  <th className="p-2">Gói</th>
                  <th className="p-2 text-right">Giá</th>
                  <th className="p-2 text-right">Lượt</th>
                  <th className="p-2">Ảnh</th>
                  <th className="p-2 text-right">Đang dùng</th>
                  <th className="p-2">Trạng thái</th>
                  <th className="p-2">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {(overview.data?.plans ?? []).map((plan) => (
                  <tr key={plan.id} className="border-t border-border" aria-label={plan.name}>
                    <td className="p-2">
                      {plan.name}
                      <span className="block text-label text-text-secondary">
                        {plan.kind === 'monthly' ? 'Gói tháng' : 'Gói lượt'} · {plan.school_levels.join(', ')}
                      </span>
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {money(plan.price)}
                      {plan.kind === 'monthly' ? '/tháng' : ''}
                    </td>
                    <td className="p-2 text-right tabular-nums">{plan.turns}</td>
                    <td className="p-2">
                      {plan.kind === 'top_up' ? 'Theo gói tháng' : plan.allow_images ? 'Có' : 'Không'}
                    </td>
                    <td className="p-2 text-right tabular-nums">{plan.active_count}</td>
                    <td className="p-2">
                      <StatusBadge
                        tone={plan.status === 'active' ? 'success' : 'neutral'}
                        label={plan.status === 'active' ? 'Đang bán' : 'Ngừng bán'}
                      />
                    </td>
                    <td className="p-2">
                      <div className="flex gap-2">
                        <Button
                          variant="text"
                          onClick={() =>
                            setEditing({
                              id: plan.id,
                              kind: plan.kind,
                              name: plan.name,
                              price: String(plan.price),
                              turns: String(plan.turns),
                              allow_images: plan.allow_images,
                              school_levels: plan.school_levels,
                              status: plan.status,
                            })
                          }
                        >
                          Sửa
                        </Button>
                        <Button variant="text" disabled={toggle.isPending} onClick={() => toggle.mutate(plan)}>
                          {plan.status === 'active' ? 'Ngừng bán' : 'Bán lại'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {overview.data && overview.data.plans.length === 0 ? (
            <p className="text-content text-text-secondary">Chưa có gói nào</p>
          ) : null}
        </section>
        <PlanEditor initial={editing} onDone={finishEdit} />
        <AiTutorSchoolReport />
        <section className="flex flex-col gap-3" aria-label="Các lần mua">
          <h2 className="text-section-title font-semibold text-text">Các lần mua</h2>
          <label className="flex max-w-xs flex-col text-label">
            Tháng mua
            <input
              type="month"
              className={FORM_CONTROL_CLASS}
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </label>
          {purchases.error ? <Alert tone="danger">{messageOf(purchases.error)}</Alert> : null}
          <div className="overflow-x-auto">
            <table className="w-full text-content">
              <thead>
                <tr className="text-left text-label text-text-secondary">
                  <th className="p-2">Ngày mua</th>
                  <th className="p-2">Học sinh</th>
                  <th className="p-2">Gói</th>
                  <th className="p-2 text-right">Số tiền</th>
                  <th className="p-2 text-right">Đã dùng</th>
                  <th className="p-2">Trạng thái</th>
                  <th className="p-2">Người mua</th>
                </tr>
              </thead>
              <tbody>
                {(purchases.data?.purchases ?? []).map((row) => (
                  <tr key={row.id} className="border-t border-border" aria-label={`Lần mua ${row.plan_name}`}>
                    <td className="p-2">{vietnamDate(row.created_at)}</td>
                    <td className="p-2">
                      {row.child_name ?? 'Học sinh không còn ở năm học này'}
                      {row.class_name ? (
                        <span className="block text-label text-text-secondary">{row.class_name}</span>
                      ) : null}
                    </td>
                    <td className="p-2">
                      {row.plan_name}
                      <span className="block text-label text-text-secondary">
                        {row.period_month
                          ? `Tháng ${row.period_month.slice(5, 7)}/${row.period_month.slice(0, 4)}`
                          : 'Gói lượt'}
                      </span>
                    </td>
                    <td className="p-2 text-right tabular-nums">{money(row.price)}</td>
                    <td className="p-2 text-right tabular-nums">
                      {row.used_turns}/{row.turns}
                    </td>
                    <td className="p-2">
                      {STATUS_LABELS[row.status]}
                      {row.invoiced ? (
                        <span className="block text-label text-text-secondary">Đã lên hóa đơn học phí</span>
                      ) : null}
                    </td>
                    <td className="p-2">{row.buyer_name}</td>
                  </tr>
                ))}
                {(purchases.data?.upgrades ?? []).map((row) => (
                  <tr key={row.id} className="border-t border-border" aria-label={`Nâng gói ${row.to_plan_name}`}>
                    <td className="p-2">{vietnamDate(row.created_at)}</td>
                    <td className="p-2">{row.child_name ?? 'Học sinh không còn ở năm học này'}</td>
                    <td className="p-2">
                      Nâng {row.from_plan_name} lên {row.to_plan_name}
                      <span className="block text-label text-text-secondary">
                        {row.remaining_days}/{row.days_in_month} ngày còn lại, cộng {row.extra_turns} lượt
                      </span>
                    </td>
                    <td className="p-2 text-right tabular-nums">{money(row.price_difference)}</td>
                    <td className="p-2" />
                    <td className="p-2">{row.invoiced ? 'Đã lên hóa đơn học phí' : 'Chờ lên hóa đơn'}</td>
                    <td className="p-2">{row.buyer_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {purchases.data && purchases.data.purchases.length === 0 && purchases.data.upgrades.length === 0 ? (
            <p className="text-content text-text-secondary">Chưa có lần mua nào</p>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
