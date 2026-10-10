import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, StatusBadge, TextField, Toast, type StatusTone } from '@school-management/ui';
import { fetchCurrentUser, ApiError } from '../session/api-client.js';
import { listOrgUnits } from '../org-units/org-units-api.js';
import { AppShell } from '../pages/AppShell.js';
import { useHasPermission } from '../session/permissions.js';
import {
  readIdentitySettings,
  readSettings,
  saveIdentitySettings,
  saveSettings,
  type EffectiveSetting,
  type SettingSource,
} from './settings-api.js';

// Cấu hình theo đơn vị (P01-08, YCTD-40) và cấu hình chung của tài khoản (PQ-07); giao diện chỉ hiển thị, máy chủ kiểm tra giá trị
const SOURCE_LABELS: Record<SettingSource, { label: string; tone: StatusTone }> = {
  unit: { label: 'Riêng của đơn vị', tone: 'info' },
  truong_chinh: { label: 'Theo Trường chính', tone: 'neutral' },
  default: { label: 'Mặc định', tone: 'neutral' },
  missing: { label: 'Chưa cấu hình', tone: 'warning' },
};

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

function toText(setting: EffectiveSetting): string {
  const value = setting.unit_value;
  if (value === null || value === undefined) {
    return '';
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (value === 'next_month_first') {
    return 'mùng 1 tháng sau';
  }
  if (value === 'last') {
    return 'cuối tháng';
  }
  return String(value);
}

function fromText(setting: EffectiveSetting, text: string): unknown {
  const trimmed = text.trim();
  if (trimmed === '') {
    return null;
  }
  switch (setting.value_type) {
    case 'closing_day':
      if (trimmed === 'mùng 1 tháng sau' || trimmed === 'next_month_first') {
        return 'next_month_first';
      }
      return trimmed === 'cuối tháng' || trimmed === 'last' ? 'last' : Number(trimmed);
    case 'day_of_month':
      return trimmed === 'cuối tháng' || trimmed === 'last' ? 'last' : Number(trimmed);
    case 'day_list':
      return trimmed.split(',').map((part) => Number(part.trim()));
    case 'positive_integer':
      return Number(trimmed);
    case 'time_of_day':
      return trimmed;
    case 'boolean':
      return trimmed === 'bat';
  }
}

function describeValue(setting: EffectiveSetting): string {
  if (setting.value === null || setting.value === undefined) {
    return 'Chưa có giá trị';
  }
  if (setting.value_type === 'boolean') {
    return setting.value ? 'Bật' : 'Tắt';
  }
  if (setting.value === 'next_month_first') {
    return 'Mùng 1 tháng sau';
  }
  if (setting.value === 'last') {
    return 'Ngày cuối tháng';
  }
  return Array.isArray(setting.value) ? setting.value.join(', ') : String(setting.value);
}

function UnitSettingsForm({ orgUnitId, editable, onSaved }: { orgUnitId: string; editable: boolean; onSaved(): void }) {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['settings', orgUnitId], queryFn: () => readSettings(orgUnitId) });
  const [draft, setDraft] = useState<Record<string, string>>({});
  useEffect(() => {
    if (settings.data) {
      setDraft(
        Object.fromEntries(
          settings.data.map((setting) => [
            setting.key,
            setting.value_type === 'boolean'
              ? setting.unit_value === null
                ? ''
                : setting.unit_value
                  ? 'bat'
                  : 'tat'
              : toText(setting),
          ]),
        ),
      );
    }
  }, [settings.data]);
  const save = useMutation({
    mutationFn: () => {
      const values: Record<string, unknown> = {};
      for (const setting of settings.data ?? []) {
        const original =
          setting.value_type === 'boolean'
            ? setting.unit_value === null
              ? ''
              : setting.unit_value
                ? 'bat'
                : 'tat'
            : toText(setting);
        if ((draft[setting.key] ?? '') !== original) {
          values[setting.key] = fromText(setting, draft[setting.key] ?? '');
        }
      }
      return saveSettings(orgUnitId, values);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings', orgUnitId] });
      onSaved();
    },
  });
  const fieldErrors =
    save.error instanceof ApiError
      ? Object.fromEntries(save.error.details.map((detail) => [detail.field, detail.message]))
      : {};

  if (settings.isPending) {
    return <div className="h-60 animate-pulse rounded bg-border" aria-hidden="true" />;
  }
  if (settings.isError) {
    return <Alert tone="danger">{messageOf(settings.error)}</Alert>;
  }
  return (
    <div className="flex flex-col gap-4">
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <table className="w-full text-content">
        <thead className="text-left text-label font-medium text-text-secondary">
          <tr>
            <th className="px-3 py-2">Mục cấu hình</th>
            <th className="px-3 py-2">Đang áp dụng</th>
            <th className="px-3 py-2">Nguồn</th>
            {editable ? <th className="px-3 py-2">Giá trị riêng của đơn vị</th> : null}
          </tr>
        </thead>
        <tbody>
          {settings.data.map((setting) => (
            <tr key={setting.key} className="border-t border-border align-top">
              <td className="px-3 py-2 font-medium">{setting.label}</td>
              <td className="px-3 py-2">{describeValue(setting)}</td>
              <td className="px-3 py-2">
                <StatusBadge {...SOURCE_LABELS[setting.source]} />
              </td>
              {editable ? (
                <td className="px-3 py-2">
                  {setting.value_type === 'boolean' ? (
                    <select
                      aria-label={setting.label}
                      value={draft[setting.key] ?? ''}
                      onChange={(event) => setDraft({ ...draft, [setting.key]: event.target.value })}
                      className="rounded-lg border border-border bg-card px-3 py-2"
                    >
                      <option value="">Kế thừa</option>
                      <option value="bat">Bật</option>
                      <option value="tat">Tắt</option>
                    </select>
                  ) : (
                    <input
                      aria-label={setting.label}
                      value={draft[setting.key] ?? ''}
                      placeholder="Để trống là kế thừa"
                      onChange={(event) => setDraft({ ...draft, [setting.key]: event.target.value })}
                      className="w-48 rounded-lg border border-border bg-card px-3 py-2"
                    />
                  )}
                  {fieldErrors[`values.${setting.key}`] ? (
                    <p className="mt-1 text-label text-danger">{fieldErrors[`values.${setting.key}`]}</p>
                  ) : null}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {editable ? (
        <div>
          <Button variant="primary" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Đang lưu…' : 'Lưu cấu hình'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

// Cấu hình chung của tài khoản: số ngày tự khóa (PQ-07), mật khẩu mặc định của phụ huynh và mã một lần (YCTD-43)
const NUMBER_FIELDS = [
  { key: 'account_inactivity_lock_days', label: 'Số ngày không đăng nhập thì tự khóa tài khoản' },
  { key: 'one_time_code_lifetime_minutes', label: 'Số phút mã một lần còn hiệu lực' },
  { key: 'one_time_code_maximum_attempts', label: 'Số lần nhập sai mã tối đa' },
  { key: 'one_time_code_maximum_sends_per_hour', label: 'Số lần gửi mã tối đa mỗi giờ cho một số điện thoại' },
] as const;

type NumberFieldKey = (typeof NUMBER_FIELDS)[number]['key'];

function AccountLockSettings({ onSaved }: { onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['identity-settings'], queryFn: readIdentitySettings });
  const [numbers, setNumbers] = useState<Record<NumberFieldKey, string>>({
    account_inactivity_lock_days: '',
    one_time_code_lifetime_minutes: '',
    one_time_code_maximum_attempts: '',
    one_time_code_maximum_sends_per_hour: '',
  });
  const [defaultPassword, setDefaultPassword] = useState('');
  useEffect(() => {
    if (settings.data) {
      const data = settings.data;
      setNumbers({
        account_inactivity_lock_days: String(data.account_inactivity_lock_days),
        one_time_code_lifetime_minutes: String(data.one_time_code_lifetime_minutes),
        one_time_code_maximum_attempts: String(data.one_time_code_maximum_attempts),
        one_time_code_maximum_sends_per_hour: String(data.one_time_code_maximum_sends_per_hour),
      });
    }
  }, [settings.data]);
  const onSuccess = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['identity-settings'] });
    onSaved(message);
  };
  const save = useMutation({
    mutationFn: () =>
      saveIdentitySettings(Object.fromEntries(NUMBER_FIELDS.map((field) => [field.key, Number(numbers[field.key])]))),
    onSuccess: () => onSuccess('Đã lưu cấu hình tài khoản'),
  });
  const savePassword = useMutation({
    mutationFn: () => saveIdentitySettings({ parent_default_password: defaultPassword }),
    onSuccess: async () => {
      setDefaultPassword('');
      await onSuccess('Đã đặt mật khẩu mặc định của phụ huynh');
    },
  });
  const passwordErrors =
    savePassword.error instanceof ApiError
      ? savePassword.error.details.map((detail) => detail.message).join('; ')
      : undefined;
  if (settings.isError) {
    return null;
  }
  return (
    <section
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
      aria-label="Cấu hình tài khoản"
    >
      <h2 className="text-section-title font-semibold text-text">Tài khoản</h2>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {NUMBER_FIELDS.map((field) => (
          <TextField
            key={field.key}
            label={field.label}
            inputMode="numeric"
            value={numbers[field.key]}
            onChange={(event) => setNumbers({ ...numbers, [field.key]: event.target.value })}
          />
        ))}
      </div>
      <div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          Lưu
        </Button>
      </div>
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <h3 className="text-content font-semibold text-text">Mật khẩu mặc định của phụ huynh</h3>
        <p className="text-label text-text-secondary">
          {settings.data?.parent_default_password_configured
            ? 'Đã đặt. Hệ thống chỉ lưu dạng mã hóa nên không xem lại được; nhập mật khẩu mới để thay. Phụ huynh chưa kích hoạt sẽ dùng mật khẩu mới.'
            : 'Chưa đặt. Cần đặt trước khi tạo tài khoản phụ huynh.'}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <TextField
            label="Mật khẩu mặc định mới"
            type="password"
            autoComplete="new-password"
            value={defaultPassword}
            error={passwordErrors}
            onChange={(event) => setDefaultPassword(event.target.value)}
          />
          <Button onClick={() => savePassword.mutate()} disabled={savePassword.isPending || defaultPassword === ''}>
            Đặt mật khẩu mặc định
          </Button>
        </div>
      </div>
    </section>
  );
}

export function SettingsPage() {
  const canManage = useHasPermission(PERMISSION_CODES.settingManage);
  const currentUser = useQuery({ queryKey: ['current-user'], queryFn: fetchCurrentUser });
  const units = useQuery({ queryKey: ['org-units', 'flat', ''], queryFn: () => listOrgUnits() });
  const [orgUnitId, setOrgUnitId] = useState<string>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const selectedId =
    orgUnitId ?? units.data?.find((unit) => unit.unit_type === 'truong_chinh')?.id ?? units.data?.[0]?.id;
  const wholeSchoolSettingManager =
    currentUser.data?.assignments.some(
      (assignment) =>
        assignment.org_unit_id === null && assignment.permissions.includes(PERMISSION_CODES.settingManage),
    ) ?? false;

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Cấu hình</h1>
        <section
          className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
          aria-label="Cấu hình theo đơn vị"
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-2">
              <label htmlFor="settings-unit" className="text-label font-medium text-text">
                Đơn vị
              </label>
              <select
                id="settings-unit"
                value={selectedId ?? ''}
                onChange={(event) => setOrgUnitId(event.target.value)}
                className="rounded-lg border border-border bg-card px-3 py-2 text-content"
              >
                {(units.data ?? []).map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-label text-text-secondary">
              Mục để trống thì dùng giá trị của Trường chính, nếu Trường chính cũng trống thì dùng mặc định. Ngày trong
              tháng ghi số từ 1 đến 28 hoặc "cuối tháng"; ngày chốt học phí ghi thêm được "mùng 1 tháng sau"; ngày chốt
              công cố định mùng 1 tháng sau; mốc nhắc nợ ghi các số cách nhau bằng dấu phẩy.
            </p>
          </div>
          {selectedId ? (
            <UnitSettingsForm
              key={selectedId}
              orgUnitId={selectedId}
              editable={canManage}
              onSaved={() => setToastMessage('Đã lưu cấu hình')}
            />
          ) : (
            <Alert tone="warning">Chưa có đơn vị. Hãy mở năm học và tạo cây đơn vị trước.</Alert>
          )}
        </section>
        {wholeSchoolSettingManager ? <AccountLockSettings onSaved={setToastMessage} /> : null}
      </div>
    </AppShell>
  );
}
