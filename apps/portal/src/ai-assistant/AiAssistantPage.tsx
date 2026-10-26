import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, FORM_CONTROL_CLASS, StatusBadge, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import {
  AI_DRAFT_NOTICE,
  AI_KIND_LABELS,
  AI_STATUS_LABELS,
  aiAdminStatus,
  checkAi,
  listAiRequests,
  removeAiKey,
  saveAiKey,
  saveAiSettings,
  type AiAdminStatus,
  type AiSettings,
} from './ai-api.js';

// 3.8. Trợ lý AI (DT-23 phần 23d, YCTD-214; P01.integration.manage): quản trị trường bật tắt trợ lý AI soạn nháp (mặc định tắt), chọn
// cấu hình khóa (trường tự nhập khóa nhà cung cấp, miễn phí; hoặc nền tảng cấp khóa, trả phí theo gói và theo token), mã mô hình, hạn mức
// mỗi người, thời hạn giữ nhật ký; xem hạn mức còn lại, số token đã dùng và tạm tính phí kỳ hiện tại, nhật ký yêu cầu. Nhật ký không lưu
// toàn văn lời nhắc. Khóa nhập qua ô mật khẩu, máy chủ lưu mã hóa và không trả lại (chỉ bốn ký tự cuối)
export const AI_ENABLE_NOTICE =
  'Khi bật, giáo viên có quyền soạn câu hỏi hoặc dùng kho học liệu có thể nhờ trợ lý AI soạn bản nháp. Chỉ nội dung chương trình được gửi cho nhà cung cấp AI (một bên xử lý bên ngoài nhà trường, có thể đặt máy chủ ở nước ngoài); hệ thống không gửi họ tên, số điện thoại, thư điện tử, số định danh, bài làm, điểm, nhận xét hay ảnh của học sinh, phụ huynh, cán bộ, và chặn yêu cầu có các thông tin đó. Nhà trường chịu trách nhiệm cho giáo viên biết điều này, và kiểm tra nội dung AI soạn (đúng chuyên môn, không chép nội dung có bản quyền) trước khi dùng.';

const messageOf = (error: unknown) =>
  error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';

const number = (value: number) => value.toLocaleString('vi-VN');

interface Form {
  enabled: boolean;
  key_mode: 'school' | 'platform';
  provider: string;
  model: string;
  per_user_daily_requests: string;
  log_retention_months: string;
}

const formOf = (settings: AiSettings): Form => ({
  enabled: settings.enabled,
  key_mode: settings.key_mode,
  provider: settings.provider,
  model: settings.model ?? '',
  per_user_daily_requests: settings.per_user_daily_requests === null ? '' : String(settings.per_user_daily_requests),
  log_retention_months: String(settings.log_retention_months),
});

function Settings({ status, onMessage }: { status: AiAdminStatus; onMessage(message: string): void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form>(formOf(status.settings));
  const [acknowledged, setAcknowledged] = useState(status.settings.enabled);
  useEffect(() => {
    setForm(formOf(status.settings));
    setAcknowledged(status.settings.enabled);
  }, [status.settings]);
  const save = useMutation({
    mutationFn: () =>
      saveAiSettings({
        enabled: form.enabled,
        key_mode: form.key_mode,
        provider: form.provider,
        model: form.model.trim() || null,
        per_user_daily_requests:
          form.per_user_daily_requests.trim() === '' ? null : Number(form.per_user_daily_requests),
        log_retention_months: Number(form.log_retention_months),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ai-admin'] });
      await queryClient.invalidateQueries({ queryKey: ['ai-status'] });
      onMessage('Đã lưu thiết lập trợ lý AI');
    },
  });
  const enabling = form.enabled && !status.settings.enabled;
  return (
    <form
      className="flex flex-col gap-3 rounded-lg bg-card p-4"
      aria-label="Thiết lập trợ lý AI"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <h2 className="text-section-title font-semibold text-text">Thiết lập</h2>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <label className="flex items-center gap-2 text-label font-medium text-text">
        <input
          type="checkbox"
          aria-label="Bật trợ lý AI"
          checked={form.enabled}
          onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
        />
        Bật trợ lý AI cho trường (mặc định tắt)
      </label>
      {enabling ? (
        <div className="flex flex-col gap-2">
          <Alert tone="info">{AI_ENABLE_NOTICE}</Alert>
          <label className="flex items-center gap-2 text-label font-medium text-text">
            <input
              type="checkbox"
              aria-label="Đã đọc thông báo bật AI"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />
            Tôi đã đọc thông báo trên và sẽ thông báo cho giáo viên
          </label>
        </div>
      ) : null}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-label font-medium text-text">Cấu hình khóa</legend>
        <label className="flex items-center gap-2 text-content text-text">
          <input
            type="radio"
            name="key-mode"
            aria-label="Trường tự nhập khóa"
            checked={form.key_mode === 'school'}
            onChange={() => setForm({ ...form, key_mode: 'school' })}
          />
          Trường tự nhập khóa nhà cung cấp AI của mình (miễn phí, trường tự trả chi phí cho nhà cung cấp)
        </label>
        <label className="flex items-center gap-2 text-content text-text">
          <input
            type="radio"
            name="key-mode"
            aria-label="Nền tảng cấp khóa"
            checked={form.key_mode === 'platform'}
            disabled={!status.multi_tenant}
            onChange={() => setForm({ ...form, key_mode: 'platform' })}
          />
          Nền tảng cấp khóa (trả phí theo gói dịch vụ và số token sử dụng)
          {status.multi_tenant ? '' : ' (chỉ có ở nền tảng nhiều trường)'}
        </label>
      </fieldset>
      {form.key_mode === 'platform' && status.platform ? (
        status.platform.available ? (
          <Alert tone="info">
            Khóa nền tảng đã sẵn sàng (mô hình {status.platform.model}). Mỗi kỳ trường có{' '}
            {number(status.platform.free_tokens ?? 0)} token miễn phí, phần vượt tính phí theo đơn giá của gói và hiện
            thành dòng phí AI trên hóa đơn dịch vụ.
          </Alert>
        ) : (
          <Alert tone="danger">{status.platform.reason}</Alert>
        )
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-label font-medium text-text">
          Nhà cung cấp
          <select
            aria-label="Nhà cung cấp AI"
            className={`mt-2 block ${FORM_CONTROL_CLASS}`}
            value={form.provider}
            disabled={form.key_mode === 'platform'}
            onChange={(event) => setForm({ ...form, provider: event.target.value })}
          >
            {status.providers.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>
        </label>
        <label className="text-label font-medium text-text">
          Mã mô hình (trống là {status.default_model})
          <input
            aria-label="Mã mô hình AI"
            className={`mt-2 block ${FORM_CONTROL_CLASS}`}
            disabled={form.key_mode === 'platform'}
            value={form.model}
            onChange={(event) => setForm({ ...form, model: event.target.value })}
          />
        </label>
        <label className="text-label font-medium text-text">
          Yêu cầu mỗi người mỗi ngày (trống là không giới hạn)
          <input
            aria-label="Yêu cầu mỗi người mỗi ngày"
            className={`mt-2 block w-24 ${FORM_CONTROL_CLASS}`}
            inputMode="numeric"
            value={form.per_user_daily_requests}
            onChange={(event) => setForm({ ...form, per_user_daily_requests: event.target.value })}
          />
        </label>
        <label className="text-label font-medium text-text">
          Giữ nhật ký (tháng)
          <input
            aria-label="Số tháng giữ nhật ký"
            className={`mt-2 block w-24 ${FORM_CONTROL_CLASS}`}
            inputMode="numeric"
            value={form.log_retention_months}
            onChange={(event) => setForm({ ...form, log_retention_months: event.target.value })}
          />
        </label>
      </div>
      <div>
        <Button type="submit" variant="primary" disabled={save.isPending || (enabling && !acknowledged)}>
          Lưu thiết lập
        </Button>
      </div>
    </form>
  );
}

function KeyForm({ status, onMessage }: { status: AiAdminStatus; onMessage(message: string): void }) {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState('');
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['ai-admin'] });
    await queryClient.invalidateQueries({ queryKey: ['ai-status'] });
  };
  const save = useMutation({
    mutationFn: () => saveAiKey({ enabled: true, api_key: apiKey.trim() }),
    onSuccess: async () => {
      setApiKey('');
      await refresh();
      onMessage('Đã lưu khóa AI của trường');
    },
  });
  const remove = useMutation({
    mutationFn: removeAiKey,
    onSuccess: async () => {
      await refresh();
      onMessage('Đã xóa khóa AI của trường');
    },
  });
  const test = useMutation({ mutationFn: checkAi, onSuccess: async () => queryClientInvalidate(queryClient) });
  const hint = status.key.fields.find((field) => field.name === 'api_key')?.value;
  return (
    <section className="flex flex-col gap-3 rounded-lg bg-card p-4" aria-label="Khóa AI của trường">
      <h2 className="text-section-title font-semibold text-text">Khóa nhà cung cấp AI của trường</h2>
      <p className="text-content text-text-secondary">
        {status.key.configured ? `Đã nhập khóa ${hint ?? ''}.` : 'Chưa nhập khóa.'} Khóa lưu mã hóa theo trường và không
        bao giờ hiện lại; chỉ cần khi chọn cấu hình trường tự nhập khóa.
      </p>
      {save.error || remove.error || test.error ? (
        <Alert tone="danger">{messageOf(save.error ?? remove.error ?? test.error)}</Alert>
      ) : null}
      {test.data ? <Alert tone="success">{test.data.detail}</Alert> : null}
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-label font-medium text-text">
          Khóa API mới
          <input
            type="password"
            autoComplete="off"
            aria-label="Khóa API của nhà cung cấp AI"
            className={`mt-2 block ${FORM_CONTROL_CLASS}`}
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
          />
        </label>
        <Button disabled={!apiKey.trim() || save.isPending} onClick={() => save.mutate()}>
          Lưu khóa
        </Button>
        <Button disabled={!status.ready || test.isPending} onClick={() => test.mutate()}>
          Kiểm tra kết nối
        </Button>
        {status.key.configured ? (
          <Button variant="text" disabled={remove.isPending} onClick={() => remove.mutate()}>
            Xóa khóa
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function queryClientInvalidate(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: ['ai-requests'] });
}

function Usage({ status }: { status: AiAdminStatus }) {
  const { usage, limits, estimate } = status;
  const remaining = (limit: number | null, used: number) =>
    limit === null ? 'không giới hạn' : `còn ${number(Math.max(limit - used, 0))}`;
  return (
    <section className="flex flex-col gap-2 rounded-lg bg-card p-4" aria-label="Mức dùng tháng này">
      <h2 className="text-section-title font-semibold text-text">Mức dùng tháng này</h2>
      <ul className="text-content text-text">
        <li>
          Yêu cầu: {number(usage.requests)} (hạn mức của gói: {remaining(limits.max_requests, usage.requests)})
        </li>
        <li>
          Token: {number(usage.tokens)} gồm {number(usage.input_tokens)} vào, {number(usage.output_tokens)} ra (hạn mức
          của gói: {remaining(limits.max_tokens, usage.tokens)})
        </li>
        <li>
          Mỗi người mỗi ngày:{' '}
          {limits.per_user_daily_requests === null
            ? 'không giới hạn'
            : `${number(limits.per_user_daily_requests)} yêu cầu`}
        </li>
      </ul>
      {estimate ? (
        <p className="text-content text-text">
          Tạm tính phí AI kỳ {estimate.period_start} đến {estimate.period_end}: {number(estimate.amount)} đồng cho{' '}
          {number(estimate.total_tokens)} token (đã trừ {number(estimate.free_tokens)} token miễn phí mỗi kỳ).
          {estimate.applies ? '' : ' Cấu hình hiện tại là trường tự nhập khóa nên không thu phí AI.'} Số chính thức theo
          hóa đơn dịch vụ khi chốt kỳ.
        </p>
      ) : null}
    </section>
  );
}

function Requests() {
  const [filter, setFilter] = useState('');
  const rows = useQuery({ queryKey: ['ai-requests', filter], queryFn: () => listAiRequests(filter || undefined) });
  return (
    <section className="flex flex-col gap-3" aria-label="Nhật ký yêu cầu AI">
      <h2 className="text-section-title font-semibold text-text">Nhật ký yêu cầu</h2>
      <p className="text-content text-text-secondary">
        Nhật ký giữ người yêu cầu, loại, môn, khối, chủ đề, số token, nhà cung cấp, mô hình và kết quả; không lưu toàn
        văn lời nhắc.
      </p>
      <label className="text-label font-medium text-text">
        Lọc kết quả
        <select
          aria-label="Lọc nhật ký theo kết quả"
          className={`mt-2 block ${FORM_CONTROL_CLASS}`}
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="">Tất cả</option>
          {Object.entries(AI_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="overflow-x-auto">
        <table className="w-full text-content" aria-label="Yêu cầu AI">
          <thead className="text-left text-label font-medium text-text-secondary">
            <tr>
              <th className="px-3 py-2">Lúc</th>
              <th className="px-3 py-2">Người yêu cầu</th>
              <th className="px-3 py-2">Loại</th>
              <th className="px-3 py-2">Nội dung</th>
              <th className="px-3 py-2">Kết quả</th>
              <th className="px-3 py-2">Token vào, ra</th>
              <th className="px-3 py-2">Mô hình</th>
              <th className="px-3 py-2">Khóa</th>
            </tr>
          </thead>
          <tbody>
            {(rows.data ?? []).map((row) => (
              <tr key={row.id} className="border-t border-border align-top">
                <td className="px-3 py-2">{new Date(row.created_at).toLocaleString('vi-VN')}</td>
                <td className="px-3 py-2">{row.user_name}</td>
                <td className="px-3 py-2">{AI_KIND_LABELS[row.kind]}</td>
                <td className="px-3 py-2">
                  {[row.subject_name, row.grade_level_code, row.topic].filter(Boolean).join(' · ')}
                  {row.result_count > 0 ? ` · ${row.result_count} bản nháp` : ''}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge
                    tone={row.status === 'success' ? 'success' : 'neutral'}
                    label={AI_STATUS_LABELS[row.status]}
                  />
                  {row.error ? <span className="block text-label text-danger">{row.error}</span> : null}
                </td>
                <td className="px-3 py-2">
                  {number(row.input_tokens)} · {number(row.output_tokens)}
                </td>
                <td className="px-3 py-2">{row.model}</td>
                <td className="px-3 py-2">{row.key_mode === 'platform' ? 'Nền tảng' : 'Trường'}</td>
              </tr>
            ))}
            {rows.data && rows.data.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-2 text-text-secondary">
                  Chưa có yêu cầu.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function AiAssistantPage() {
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const status = useQuery({ queryKey: ['ai-admin'], queryFn: aiAdminStatus });
  const admin = status.data && 'settings' in status.data ? status.data : null;
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/ai-assistant')}</h1>
        <Alert tone="info">{AI_DRAFT_NOTICE}</Alert>
        {status.error ? <Alert tone="danger">{messageOf(status.error)}</Alert> : null}
        {admin ? (
          <>
            <Alert tone={admin.ready ? 'success' : 'info'}>
              {admin.ready ? 'Trợ lý AI đang bật và sẵn sàng.' : `Trợ lý AI chưa dùng được: ${admin.reason ?? ''}`}
            </Alert>
            <Settings status={admin} onMessage={setToastMessage} />
            <KeyForm status={admin} onMessage={setToastMessage} />
            <Usage status={admin} />
            <Requests />
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
