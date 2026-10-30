import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, FormRow, TextField, Toast } from '@school-management/ui';
import { fetchCurrentUser, ApiError } from '../session/api-client.js';
import { listOrgUnits } from '../org-units/org-units-api.js';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import { SchoolLevelsBlock } from '../school-levels/SchoolLevelsBlock.js';
import { useHasPreschool } from '../school-levels/working-level.js';
import { ConductSettingsBlock } from '../conduct/ConductSettingsBlock.js';
import { TeachingToolsSettingsBlock } from './TeachingToolsSettingsBlock.js';
import {
  readIdentitySettings,
  readSettings,
  saveIdentitySettings,
  saveSettings,
  type EffectiveSetting,
  type SettingSource,
} from './settings-api.js';
import { groupElementId, SETTING_GROUPS, unitSettingGroup, type SettingGroupKey } from './settings-groups.js';

// Cấu hình theo đơn vị (P01-08, YCTD-40) và cấu hình chung của tài khoản (PQ-07); giao diện chỉ hiển thị, máy chủ kiểm tra giá trị.
// Bố cục theo thiết kế "Cổng quản trị trường" (YCTD-335): ô Đơn vị cạnh tiêu đề, các khối chia theo nhóm ở settings-groups.ts,
// danh sách nhóm ở bên trái từ 1280 px (hẹp hơn thì ở trên cùng); nguồn của giá trị ghi gọn sau giá trị đang áp dụng
const SOURCE_TEXT: Record<Exclude<SettingSource, 'missing'>, string> = {
  unit: 'riêng của đơn vị',
  truong_chinh: 'theo Trường chính',
  default: 'mặc định',
};

// Gợi ý nhập theo kiểu giá trị, hiện dưới tên mục khi được sửa (giữ quy tắc nhập ngày của đoạn giải thích cũ)
const INPUT_HINTS: Partial<Record<EffectiveSetting['value_type'], string>> = {
  closing_day: 'Số từ 1 đến 28, "cuối tháng" hoặc "mùng 1 tháng sau"',
  day_of_month: 'Số từ 1 đến 28 hoặc "cuối tháng"',
  day_list: 'Các số ngày tăng dần, cách nhau bằng dấu phẩy',
  time_of_day: 'Giờ dạng HH:MM, ví dụ 07:30',
  minutes: 'Số phút từ 0 đến 480',
  percent: 'Phần trăm từ 100 đến 1000',
};

// Dòng gợi ý ngắn của nhóm, hiện dưới tên nhóm
const GROUP_HINTS: Partial<Record<SettingGroupKey, string>> = {
  staff: 'Ngày chốt công cố định mùng 1 tháng sau.',
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

// Chữ trong ô của một mục: mục Bật/Tắt là "" (kế thừa), "bat", "tat"
function originalText(setting: EffectiveSetting): string {
  if (setting.value_type === 'boolean') {
    return setting.unit_value === null ? '' : setting.unit_value ? 'bat' : 'tat';
  }
  return toText(setting);
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
    case 'minutes':
    case 'percent':
      return Number(trimmed);
    case 'time_of_day':
    case 'text':
      return trimmed;
    case 'boolean':
      return trimmed === 'bat';
    case 'teaching_tool_list':
      return trimmed.split(',').map((part) => part.trim());
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

// Giá trị đang áp dụng kèm nguồn, ví dụ "25 · mặc định"; chưa có ở đâu thì "Chưa cấu hình"
function describeApplied(setting: EffectiveSetting): string {
  if (setting.source === 'missing') {
    return 'Chưa cấu hình';
  }
  return `${describeValue(setting)} · ${SOURCE_TEXT[setting.source]}`;
}

// Cấu hình theo đơn vị đang chọn: chữ người dùng sửa giữ theo đơn vị (đổi đơn vị thì bỏ), một nút Lưu cấu hình ghi mọi mục đã sửa
// ở mọi nhóm
function useUnitSettings(orgUnitId: string | undefined, onSaved: () => void) {
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ['settings', orgUnitId],
    queryFn: () => readSettings(orgUnitId as string),
    enabled: orgUnitId !== undefined,
  });
  const [edits, setEdits] = useState<{ orgUnitId?: string; values: Record<string, string> }>({ values: {} });
  const currentEdits = edits.orgUnitId === orgUnitId ? edits.values : {};
  const unitSettings = (settings.data ?? []).filter((setting) => !setting.school);
  const textOf = (setting: EffectiveSetting) => currentEdits[setting.key] ?? originalText(setting);
  const edit = (key: string, text: string) => setEdits({ orgUnitId, values: { ...currentEdits, [key]: text } });
  const save = useMutation({
    mutationFn: (unitId: string) => {
      const values: Record<string, unknown> = {};
      for (const setting of unitSettings) {
        const text = textOf(setting);
        if (text !== originalText(setting)) {
          values[setting.key] = fromText(setting, text);
        }
      }
      return saveSettings(unitId, values);
    },
    onSuccess: async (_data, unitId) => {
      await queryClient.invalidateQueries({ queryKey: ['settings', unitId] });
      setEdits({ values: {} });
      onSaved();
    },
  });
  const { reset } = save;
  useEffect(() => {
    reset();
  }, [orgUnitId, reset]);
  const fieldErrors: Record<string, string> =
    save.error instanceof ApiError
      ? Object.fromEntries(save.error.details.map((detail) => [detail.field, detail.message]))
      : {};
  return { settings, unitSettings, textOf, edit, save, fieldErrors };
}

type UnitSettingsState = ReturnType<typeof useUnitSettings>;

// Các mục theo đơn vị của một nhóm, trong thẻ "Theo đơn vị"
function UnitSettingsCard({
  state,
  items,
  unitName,
  editable,
}: {
  state: UnitSettingsState;
  items: EffectiveSetting[];
  unitName: string;
  editable: boolean;
}) {
  return (
    <SettingsCard title="Theo đơn vị" subtitle={unitName}>
      <div className="overflow-x-auto">
        <table className="w-full text-content">
          <thead className="text-left text-label font-medium text-text-secondary">
            <tr>
              <th className="px-3 py-2">Mục cấu hình</th>
              <th className="px-3 py-2">Đang áp dụng</th>
              {editable ? <th className="px-3 py-2">Giá trị riêng của đơn vị</th> : null}
            </tr>
          </thead>
          <tbody>
            {items.map((setting) => {
              const error = state.fieldErrors[`values.${setting.key}`];
              const hint = editable ? INPUT_HINTS[setting.value_type] : undefined;
              return (
                <tr key={setting.key} className="border-t border-border align-top">
                  <td className="px-3 py-2">
                    <span className="font-medium text-text">{setting.label}</span>
                    {hint ? <p className="text-label text-text-secondary">{hint}</p> : null}
                  </td>
                  <td
                    className={`px-3 py-2 ${setting.source === 'missing' ? 'text-warning' : setting.source === 'unit' ? 'text-brand' : 'text-text'}`}
                  >
                    {describeApplied(setting)}
                  </td>
                  {editable ? (
                    <td className="px-3 py-2">
                      {setting.value_type === 'boolean' ? (
                        <select
                          aria-label={setting.label}
                          value={state.textOf(setting)}
                          onChange={(event) => state.edit(setting.key, event.target.value)}
                          className="rounded-lg border border-border bg-card px-3 py-2"
                        >
                          <option value="">Kế thừa</option>
                          <option value="bat">Bật</option>
                          <option value="tat">Tắt</option>
                        </select>
                      ) : (
                        <input
                          aria-label={setting.label}
                          value={state.textOf(setting)}
                          placeholder="Để trống là kế thừa"
                          onChange={(event) => state.edit(setting.key, event.target.value)}
                          className="w-48 rounded-lg border border-border bg-card px-3 py-2"
                        />
                      )}
                      {error ? <p className="mt-1 text-label text-danger">{error}</p> : null}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SettingsCard>
  );
}

// Thẻ trắng viền mảnh của một khối trên trang
function SettingsCard({
  title,
  subtitle,
  label,
  children,
}: {
  title: string;
  subtitle?: string;
  label?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4" aria-label={label}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h3 className="text-content font-semibold text-text">{title}</h3>
        {subtitle ? <span className="text-label text-text-secondary">{subtitle}</span> : null}
      </div>
      {children}
    </section>
  );
}

// Dòng gợi ý ngắn dưới một ô của FormRow, thẳng cột với ô nhập
function FieldHint({ children }: { children: ReactNode }) {
  return <p className="-mt-2 text-label text-text-secondary md:pl-[12.75rem]">{children}</p>;
}

// Khối "Cấu hình trường" theo mục 1.4 của Sở (DT-16 phần 16e): tên trường hiển thị (thanh đầu trang, trang đăng nhập), tên
// đơn vị hành chính, tính cân nặng/chiều cao cho trẻ suy dinh dưỡng thể nhẹ cân (4.3.2, chỉ hiện khi trường có cấp Mầm non,
// YCTD-394); đặt ở Trường chính, nút Ghi
function SchoolSettingsBlock({
  rootId,
  editable,
  onSaved,
}: {
  rootId: string;
  editable: boolean;
  onSaved(message: string): void;
}) {
  const settings = useQuery({ queryKey: ['settings', rootId], queryFn: () => readSettings(rootId) });
  if (settings.isPending) {
    return <div className="h-40 animate-pulse rounded bg-border" aria-hidden="true" />;
  }
  if (settings.isError || !settings.data.some((setting) => setting.key === 'school_display_name')) {
    return null;
  }
  return <SchoolSettingsForm rootId={rootId} settings={settings.data} editable={editable} onSaved={onSaved} />;
}

// Giá trị ban đầu lấy một lần khi đã tải xong để lần tải lại không xóa chữ người dùng đang nhập
function SchoolSettingsForm({
  rootId,
  settings,
  editable,
  onSaved,
}: {
  rootId: string;
  settings: EffectiveSetting[];
  editable: boolean;
  onSaved(message: string): void;
}) {
  const hasPreschool = useHasPreschool('visible');
  const queryClient = useQueryClient();
  const text = (key: string) => {
    const value = settings.find((setting) => setting.key === key)?.unit_value;
    return typeof value === 'string' ? value : '';
  };
  const [displayName, setDisplayName] = useState(() => text('school_display_name'));
  const [unitName, setUnitName] = useState(() => text('administrative_unit_name'));
  const [underweight, setUnderweight] = useState(
    () => settings.find((setting) => setting.key === 'underweight_growth_calculation')?.value !== false,
  );
  const save = useMutation({
    mutationFn: () =>
      saveSettings(rootId, {
        school_display_name: displayName.trim() === '' ? null : displayName,
        administrative_unit_name: unitName.trim() === '' ? null : unitName,
        underweight_growth_calculation: underweight,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings', rootId] });
      await queryClient.invalidateQueries({ queryKey: ['portal-context'] });
      onSaved('Đã ghi cấu hình trường');
    },
  });
  const fieldError = (key: string) =>
    save.error instanceof ApiError
      ? save.error.details.find((detail) => detail.field === `values.${key}`)?.message
      : undefined;
  return (
    <SettingsCard title="Cấu hình trường" subtitle="Cả trường" label="Cấu hình trường">
      {save.error && !(save.error instanceof ApiError && save.error.details.length > 0) ? (
        <Alert tone="danger">{messageOf(save.error)}</Alert>
      ) : null}
      <FormRow label="Tên trường hiển thị" error={fieldError('school_display_name')}>
        <input
          className={FORM_CONTROL_CLASS}
          value={displayName}
          disabled={!editable}
          placeholder="Để trống là tên Trường chính trong cây đơn vị"
          onChange={(event) => setDisplayName(event.target.value)}
        />
      </FormRow>
      <FieldHint>Hiện ở thanh đầu trang và trang đăng nhập.</FieldHint>
      <FormRow label="Tên đơn vị hành chính" error={fieldError('administrative_unit_name')}>
        <input
          className={FORM_CONTROL_CLASS}
          value={unitName}
          disabled={!editable}
          onChange={(event) => setUnitName(event.target.value)}
        />
      </FormRow>
      {hasPreschool ? (
        <>
          <FormRow label="Cân nặng, chiều cao">
            <label className="flex items-center gap-2 text-content text-text">
              <input
                type="checkbox"
                checked={underweight}
                disabled={!editable}
                onChange={(event) => setUnderweight(event.target.checked)}
              />
              Tính cân nặng/chiều cao cho trẻ suy dinh dưỡng thể nhẹ cân
            </label>
          </FormRow>
          <FieldHint>Bỏ tích thì trẻ nhẹ cân không xếp kênh gầy còm, thừa cân, béo phì ở 4.3.2.</FieldHint>
        </>
      ) : null}
      {editable ? (
        <div>
          <Button variant="primary" onClick={() => save.mutate()} disabled={save.isPending}>
            Ghi
          </Button>
        </div>
      ) : null}
    </SettingsCard>
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
    <SettingsCard title="Tài khoản" subtitle="Cả trường" label="Cấu hình tài khoản">
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
        <h4 className="text-content font-semibold text-text">Mật khẩu mặc định của phụ huynh</h4>
        <p className="text-label text-text-secondary">
          {settings.data?.parent_default_password_configured
            ? 'Đã đặt. Chỉ lưu dạng mã hóa nên không xem lại được; mật khẩu mới áp cho phụ huynh chưa kích hoạt.'
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
    </SettingsCard>
  );
}

// Đăng nhập và bảo mật của cổng quản trị (DT-16 phần 16c): mã xác nhận, lịch sử mật khẩu, đường dây nóng ở trang đăng nhập
function LoginSecuritySettings({ onSaved }: { onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['identity-settings'], queryFn: readIdentitySettings });
  const [threshold, setThreshold] = useState('');
  const [historyCount, setHistoryCount] = useState('');
  const [captchaAlways, setCaptchaAlways] = useState(false);
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [hotline, setHotline] = useState('');
  useEffect(() => {
    if (settings.data) {
      setThreshold(String(settings.data.captcha_failure_threshold));
      setHistoryCount(String(settings.data.password_history_count));
      setCaptchaAlways(settings.data.captcha_always);
      setTotpEnabled(settings.data.totp_enabled);
      setHotline(settings.data.login_hotline ?? '');
    }
  }, [settings.data]);
  const save = useMutation({
    mutationFn: () =>
      saveIdentitySettings({
        captcha_failure_threshold: Number(threshold),
        password_history_count: Number(historyCount),
        captcha_always: captchaAlways,
        totp_enabled: totpEnabled,
        login_hotline: hotline,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['identity-settings'] });
      onSaved('Đã lưu cấu hình đăng nhập');
    },
  });
  const fieldError = (field: string) =>
    save.error instanceof ApiError ? save.error.details.find((detail) => detail.field === field)?.message : undefined;
  if (settings.isError) {
    return null;
  }
  return (
    <SettingsCard title="Đăng nhập và bảo mật" subtitle="Cả trường" label="Đăng nhập và bảo mật">
      {save.error && !(save.error instanceof ApiError && save.error.details.length > 0) ? (
        <Alert tone="danger">{messageOf(save.error)}</Alert>
      ) : null}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <TextField
          label="Số lần nhập sai mật khẩu thì hiện mã xác nhận"
          inputMode="numeric"
          value={threshold}
          error={fieldError('captcha_failure_threshold')}
          onChange={(event) => setThreshold(event.target.value)}
        />
        <TextField
          label="Số mật khẩu gần nhất không được dùng lại (0 là không kiểm tra)"
          inputMode="numeric"
          value={historyCount}
          error={fieldError('password_history_count')}
          onChange={(event) => setHistoryCount(event.target.value)}
        />
        <TextField
          label="Đường dây nóng hiện ở trang đăng nhập"
          value={hotline}
          error={fieldError('login_hotline')}
          onChange={(event) => setHotline(event.target.value)}
        />
        <label className="flex items-center gap-2 self-end pb-2 text-label text-text">
          <input type="checkbox" checked={captchaAlways} onChange={(event) => setCaptchaAlways(event.target.checked)} />
          Luôn hiện mã xác nhận ở trang đăng nhập
        </label>
        <div className="flex flex-col gap-1 pb-2">
          <label className="flex items-center gap-2 text-label text-text">
            <input type="checkbox" checked={totpEnabled} onChange={(event) => setTotpEnabled(event.target.checked)} />
            Cho phép xác thực hai lớp
          </label>
          <p className="pl-6 text-label text-text-secondary">
            Mỗi người tự đăng ký bằng ứng dụng xác thực ở Hồ sơ của tôi.
          </p>
        </div>
      </div>
      <div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          Lưu đăng nhập và bảo mật
        </Button>
      </div>
    </SettingsCard>
  );
}

// Danh sách nhóm: từ 1280 px là cột bên trái, dính khi cuộn; hẹp hơn thì một hàng nút ở trên cùng. Bấm nhóm thì cuộn tới nhóm
function GroupNavigation({
  groups,
  active,
  onSelect,
}: {
  groups: ReadonlyArray<(typeof SETTING_GROUPS)[number]>;
  active: SettingGroupKey | undefined;
  onSelect(key: SettingGroupKey): void;
}) {
  return (
    <nav
      aria-label="Nhóm cấu hình"
      className="rounded-xl border border-border bg-card p-2 xl:sticky xl:top-20 xl:self-start"
    >
      <ul className="flex flex-wrap gap-1 xl:flex-col">
        {groups.map((group) => (
          <li key={group.key}>
            <button
              type="button"
              aria-current={active === group.key ? 'true' : undefined}
              onClick={() => onSelect(group.key)}
              className={`w-full rounded-lg px-3 py-2 text-left text-label font-medium ${
                active === group.key ? 'bg-selected text-brand' : 'text-text-secondary hover:bg-page hover:text-text'
              }`}
            >
              {group.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SettingsPage() {
  const canManage = useHasPermission(PERMISSION_CODES.settingManage);
  const canManageLevels = useHasPermission(PERMISSION_CODES.schoolLevelManage);
  const canManageConduct = useHasPermission(PERMISSION_CODES.conductManage);
  const currentUser = useQuery({ queryKey: ['current-user'], queryFn: fetchCurrentUser });
  const units = useQuery({ queryKey: ['org-units', 'flat', ''], queryFn: () => listOrgUnits() });
  const [orgUnitId, setOrgUnitId] = useState<string>();
  const [toastMessage, setToastMessage] = useState<string>();
  const [activeGroup, setActiveGroup] = useState<SettingGroupKey>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const rootId = units.data?.find((unit) => unit.unit_type === 'truong_chinh')?.id;
  const selectedId = orgUnitId ?? rootId ?? units.data?.[0]?.id;
  const selectedName = units.data?.find((unit) => unit.id === selectedId)?.name ?? '';
  const wholeSchoolSettingManager =
    currentUser.data?.assignments.some(
      (assignment) =>
        assignment.org_unit_id === null && assignment.permissions.includes(PERMISSION_CODES.settingManage),
    ) ?? false;
  const unitState = useUnitSettings(selectedId, () => setToastMessage('Đã lưu cấu hình'));
  const itemsOf = (group: SettingGroupKey) =>
    unitState.unitSettings.filter((setting) => unitSettingGroup(setting) === group);
  const unitCard = (group: SettingGroupKey) => {
    const items = itemsOf(group);
    return items.length > 0 ? (
      <UnitSettingsCard key="unit" state={unitState} items={items} unitName={selectedName} editable={canManage} />
    ) : null;
  };

  // Nội dung của từng nhóm; nhóm không có khối nào (ví dụ thiếu quyền) thì không hiện ở danh sách nhóm
  const content: Record<SettingGroupKey, ReactNode[]> = {
    general: [
      rootId ? (
        <SchoolSettingsBlock
          key="school"
          rootId={rootId}
          editable={canManage && wholeSchoolSettingManager}
          onSaved={setToastMessage}
        />
      ) : null,
      unitCard('general'),
    ],
    levels: [
      <SchoolLevelsBlock key="levels" editable={canManageLevels} onSaved={setToastMessage} />,
      rootId ? (
        <TeachingToolsSettingsBlock
          key="tools"
          rootId={rootId}
          editable={canManage && wholeSchoolSettingManager}
          onSaved={setToastMessage}
        />
      ) : null,
    ],
    fees: [unitCard('fees')],
    staff: [unitCard('staff')],
    health: [unitCard('health')],
    conduct: [
      canManageConduct ? <ConductSettingsBlock key="conduct" editable onSaved={setToastMessage} /> : null,
      unitCard('conduct'),
    ],
    security: [
      unitCard('security'),
      wholeSchoolSettingManager ? <AccountLockSettings key="account" onSaved={setToastMessage} /> : null,
      wholeSchoolSettingManager ? <LoginSecuritySettings key="login" onSaved={setToastMessage} /> : null,
    ],
  };
  const hasContent = (group: SettingGroupKey) => {
    switch (group) {
      case 'general':
        return rootId !== undefined || itemsOf(group).length > 0;
      case 'levels':
        return true;
      case 'conduct':
        return canManageConduct || itemsOf(group).length > 0;
      case 'security':
        return wholeSchoolSettingManager || itemsOf(group).length > 0;
      default:
        // Nhóm chỉ có mục theo đơn vị: còn đang tải thì vẫn hiện để danh sách nhóm không nhảy
        return unitState.settings.isPending || itemsOf(group).length > 0;
    }
  };
  const groups = SETTING_GROUPS.filter((group) => hasContent(group.key));
  const selectGroup = (key: SettingGroupKey) => {
    setActiveGroup(key);
    document.getElementById(groupElementId(key))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-page-title font-bold text-text">{menuPageTitle('/settings')}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-label font-medium text-text-secondary" aria-hidden="true">
              Áp dụng cho
            </span>
            <select
              aria-label="Đơn vị"
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
            {canManage && selectedId ? (
              <Button
                variant="primary"
                onClick={() => unitState.save.mutate(selectedId)}
                disabled={unitState.save.isPending || !unitState.settings.data}
              >
                {unitState.save.isPending ? 'Đang lưu…' : 'Lưu cấu hình'}
              </Button>
            ) : null}
          </div>
        </div>
        <p className="text-label text-text-secondary">
          Mục theo đơn vị để trống thì dùng giá trị của Trường chính, rồi đến mặc định; nút Lưu cấu hình ghi mọi mục
          theo đơn vị đã sửa. Khối áp cho cả trường có nút ghi riêng.
        </p>
        {units.isSuccess && !selectedId ? (
          <Alert tone="warning">Chưa có đơn vị. Hãy mở năm học và tạo cây đơn vị trước.</Alert>
        ) : null}
        {unitState.settings.isError ? <Alert tone="danger">{messageOf(unitState.settings.error)}</Alert> : null}
        {unitState.save.error ? <Alert tone="danger">{messageOf(unitState.save.error)}</Alert> : null}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[14rem_minmax(0,1fr)]">
          <GroupNavigation groups={groups} active={activeGroup} onSelect={selectGroup} />
          <div className="flex min-w-0 flex-col gap-8">
            {groups.map((group) => (
              <section
                key={group.key}
                id={groupElementId(group.key)}
                aria-labelledby={`${groupElementId(group.key)}-title`}
                className="flex scroll-mt-20 flex-col gap-3"
              >
                <div>
                  <h2 id={`${groupElementId(group.key)}-title`} className="text-section-title font-semibold text-text">
                    {group.label}
                  </h2>
                  {GROUP_HINTS[group.key] ? (
                    <p className="text-label text-text-secondary">{GROUP_HINTS[group.key]}</p>
                  ) : null}
                </div>
                {group.key !== 'levels' && group.key !== 'conduct' && unitState.settings.isPending && selectedId ? (
                  <div className="h-24 animate-pulse rounded bg-border" aria-hidden="true" />
                ) : null}
                {content[group.key]}
              </section>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
