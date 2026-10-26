import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Đăng nhập bằng nhà cung cấp định danh bên ngoài ở màn hình Danh sách người dùng (DT-25 bước 25b, YCTD-225): nhà cung cấp do nền
// tảng khai (ví dụ VNeID qua Trung tâm RAR); trường bật tắt, chọn nhóm vai trò được dùng, có coi là đạt xác thực hai lớp, có thể dùng mã
// ứng dụng và khóa riêng (khóa lưu mã hóa, không hiện lại). Chỉ người quản lý mọi tài khoản thấy khối này; máy chủ kiểm tra lại quyền.
// Nền tảng chưa khai nhà cung cấp nào thì không hiện gì
interface ProviderSettings {
  code: string;
  profile: 'oidc' | 'vneid';
  display_name: string;
  platform_client_configured: boolean;
  enabled: boolean;
  client_id: string | null;
  client_secret_set: boolean;
  allowed_roles: string[] | null;
  satisfies_mfa: boolean;
  linked_accounts: number;
}

interface SettingsReply {
  pending_rar_documentation: string[];
  providers: ProviderSettings[];
}

interface Draft {
  enabled: boolean;
  satisfies_mfa: boolean;
  client_id: string;
  client_secret: string;
  clear_secret: boolean;
  allowed_roles: string;
}

function draftOf(provider: ProviderSettings): Draft {
  return {
    enabled: provider.enabled,
    satisfies_mfa: provider.satisfies_mfa,
    client_id: provider.client_id ?? '',
    client_secret: '',
    clear_secret: false,
    allowed_roles: (provider.allowed_roles ?? []).join(', '),
  };
}

function readSettings(): Promise<SettingsReply> {
  return requestJson<SettingsReply>('/api/v1/auth/external/settings');
}

function saveSettings(code: string, draft: Draft): Promise<ProviderSettings> {
  const roles = draft.allowed_roles
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  return requestJson<ProviderSettings>(`/api/v1/auth/external/settings/${encodeURIComponent(code)}`, {
    method: 'PUT',
    body: JSON.stringify({
      enabled: draft.enabled,
      satisfies_mfa: draft.satisfies_mfa,
      client_id: draft.client_id.trim() || null,
      allowed_roles: roles.length > 0 ? roles : null,
      ...(draft.clear_secret
        ? { client_secret: null }
        : draft.client_secret
          ? { client_secret: draft.client_secret }
          : {}),
    }),
  });
}

export function ExternalProvidersSection({ onSaved }: { onSaved(message: string): void }) {
  const settings = useQuery({ queryKey: ['external-identity-settings'], queryFn: readSettings });
  if (settings.isError || !settings.data || settings.data.providers.length === 0) {
    return null;
  }
  return (
    <section
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
      aria-label="Đăng nhập bằng nhà cung cấp định danh"
    >
      <h2 className="text-section-title font-semibold text-text">Đăng nhập bằng nhà cung cấp định danh</h2>
      <p className="text-label text-text-secondary">
        Người dùng đã có tài khoản tự liên kết ở mục Tài khoản của tôi (nhập lại mật khẩu), rồi đăng nhập bằng nhà cung
        cấp. Hệ thống không tự tạo tài khoản, chỉ lưu mã liên kết, không lưu số định danh hay căn cước. Người dưới 14
        tuổi không tự đăng nhập bằng cách này.
      </p>
      {settings.data.providers.map((provider) => (
        <ProviderForm
          key={provider.code}
          provider={provider}
          pending={provider.profile === 'vneid' ? settings.data.pending_rar_documentation : []}
          onSaved={onSaved}
        />
      ))}
    </section>
  );
}

function ProviderForm({
  provider,
  pending,
  onSaved,
}: {
  provider: ProviderSettings;
  pending: string[];
  onSaved(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => draftOf(provider));
  useEffect(() => setDraft(draftOf(provider)), [provider]);
  const save = useMutation({
    mutationFn: () => saveSettings(provider.code, draft),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['external-identity-settings'] });
      onSaved(`Đã lưu cấu hình đăng nhập bằng ${provider.display_name}`);
    },
  });
  const fieldErrors: Partial<Record<string, string>> =
    save.error instanceof ApiError
      ? Object.fromEntries(save.error.details.map((detail) => [detail.field, detail.message]))
      : {};
  const id = (field: string) => `ben-ngoai-${provider.code}-${field}`;

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border border-border p-3"
      aria-label={`Cấu hình ${provider.display_name}`}
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <h3 className="text-content font-semibold text-text">
        {provider.display_name}{' '}
        <span className="text-label font-normal text-text-secondary">
          ({provider.linked_accounts} tài khoản đã liên kết)
        </span>
      </h3>
      {pending.length > 0 ? (
        <Alert tone="warning">
          Chờ tài liệu kỹ thuật của Trung tâm RAR: các thông số ({pending.join(', ')}) đang là giả định theo chuẩn OIDC
          ở cấu hình của nền tảng.
        </Alert>
      ) : null}
      {save.error && Object.keys(fieldErrors).length === 0 ? (
        <Alert tone="danger">
          {save.error instanceof ApiError ? save.error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại'}
        </Alert>
      ) : null}
      <label className="flex items-center gap-2 text-label text-text">
        <input
          type="checkbox"
          checked={draft.enabled}
          onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
        />
        Bật đăng nhập bằng {provider.display_name}
      </label>
      <label className="flex items-center gap-2 text-label text-text">
        <input
          type="checkbox"
          checked={draft.satisfies_mfa}
          onChange={(event) => setDraft({ ...draft, satisfies_mfa: event.target.checked })}
        />
        Coi là đạt xác thực hai lớp (khi mức đảm bảo nền tảng chấp nhận)
      </label>
      <div className="grid grid-cols-1 gap-1 md:grid-cols-[16rem_1fr] md:items-center md:gap-3">
        <label htmlFor={id('roles')} className="text-label font-medium text-text">
          Nhóm vai trò được dùng
        </label>
        <input
          id={id('roles')}
          className="rounded-lg border border-border bg-card px-3 py-2 text-content text-text"
          placeholder="Trống là mặc định: mọi vai trò trừ học sinh"
          value={draft.allowed_roles}
          onChange={(event) => setDraft({ ...draft, allowed_roles: event.target.value })}
        />
        <label htmlFor={id('client')} className="text-label font-medium text-text">
          Mã ứng dụng riêng của trường
        </label>
        <input
          id={id('client')}
          className="rounded-lg border border-border bg-card px-3 py-2 text-content text-text"
          placeholder={
            provider.platform_client_configured
              ? 'Trống là dùng mã của nền tảng'
              : 'Nền tảng chưa cấp mã, nhập mã của trường'
          }
          value={draft.client_id}
          onChange={(event) => setDraft({ ...draft, client_id: event.target.value })}
        />
        <label htmlFor={id('secret')} className="text-label font-medium text-text">
          Khóa bí mật riêng
        </label>
        <input
          id={id('secret')}
          type="password"
          autoComplete="off"
          className="rounded-lg border border-border bg-card px-3 py-2 text-content text-text"
          placeholder={provider.client_secret_set ? 'Đã đặt, để trống là giữ nguyên' : 'Chưa đặt'}
          value={draft.client_secret}
          onChange={(event) => setDraft({ ...draft, client_secret: event.target.value })}
        />
      </div>
      {provider.client_secret_set ? (
        <label className="flex items-center gap-2 text-label text-text">
          <input
            type="checkbox"
            checked={draft.clear_secret}
            onChange={(event) => setDraft({ ...draft, clear_secret: event.target.checked })}
          />
          Xóa khóa bí mật riêng
        </label>
      ) : null}
      {Object.entries(fieldErrors).map(([field, message]) => (
        <p key={field} className="text-label text-danger">
          {message}
        </p>
      ))}
      <div>
        <Button type="submit" disabled={save.isPending}>
          Ghi
        </Button>
      </div>
    </form>
  );
}
