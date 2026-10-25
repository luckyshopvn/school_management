import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button } from '@school-management/ui';
import { ApiError } from '../session/api-client.js';
import { readPasswordPolicy, savePasswordPolicy } from './accounts-api.js';

// Chính sách mật khẩu ở màn hình Danh sách người dùng (DT-15 phần 15g, YCTD-110): số ngày tối đa dùng một mật khẩu (0 là
// không giới hạn) và số ngày báo trước khi hết hạn; chỉ áp cho tài khoản nhân sự, không áp cho tài khoản phụ huynh. Chỉ
// người có quyền quản lý mọi tài khoản thấy khối này; máy chủ kiểm tra lại quyền
const FIELDS = [
  { key: 'password_max_age_days', label: 'Số ngày hết hạn mật khẩu', hint: '0 là không giới hạn' },
  { key: 'password_expiry_warning_days', label: 'Số ngày báo trước khi hết hạn', hint: '0 là không báo trước' },
  { key: 'password_min_length', label: 'Độ dài mật khẩu tối thiểu', hint: 'Từ 8 đến 64 ký tự' },
  { key: 'login_max_failed_attempts', label: 'Số lần nhập sai thì tạm khóa', hint: 'Từ 3 đến 10 lần' },
  { key: 'login_lock_minutes', label: 'Số phút tạm khóa', hint: 'Từ 1 đến 1440 phút' },
] as const;

type FieldKey = (typeof FIELDS)[number]['key'];

export function PasswordPolicySection({ onSaved }: { onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const policy = useQuery({ queryKey: ['password-policy'], queryFn: readPasswordPolicy });
  const [values, setValues] = useState<Record<FieldKey, string>>({
    password_max_age_days: '',
    password_expiry_warning_days: '',
    password_min_length: '',
    login_max_failed_attempts: '',
    login_lock_minutes: '',
  });
  useEffect(() => {
    if (policy.data) {
      setValues({
        password_max_age_days: String(policy.data.password_max_age_days),
        password_expiry_warning_days: String(policy.data.password_expiry_warning_days),
        password_min_length: String(policy.data.password_min_length),
        login_max_failed_attempts: String(policy.data.login_max_failed_attempts),
        login_lock_minutes: String(policy.data.login_lock_minutes),
      });
    }
  }, [policy.data]);
  const save = useMutation({
    mutationFn: () =>
      savePasswordPolicy({
        password_max_age_days: Number(values.password_max_age_days),
        password_expiry_warning_days: Number(values.password_expiry_warning_days),
        password_min_length: Number(values.password_min_length),
        login_max_failed_attempts: Number(values.login_max_failed_attempts),
        login_lock_minutes: Number(values.login_lock_minutes),
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(['password-policy'], saved);
      onSaved('Đã lưu chính sách mật khẩu');
    },
  });
  const fieldErrors: Partial<Record<string, string>> =
    save.error instanceof ApiError
      ? Object.fromEntries(save.error.details.map((detail) => [detail.field, detail.message]))
      : {};

  if (policy.isError) {
    return null;
  }
  return (
    <section
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
      aria-label="Chính sách mật khẩu"
    >
      <h2 className="text-section-title font-semibold text-text">Chính sách mật khẩu</h2>
      <p className="text-label text-text-secondary">
        Áp dụng cho tài khoản nhân sự; tài khoản phụ huynh không bị hết hạn mật khẩu. Hết hạn thì người dùng phải đổi
        mật khẩu khi đăng nhập.
      </p>
      {save.error ? (
        <Alert tone="danger">
          {save.error instanceof ApiError ? save.error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại'}
        </Alert>
      ) : null}
      <form
        className="flex flex-col gap-3"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        {FIELDS.map((field) => (
          <div
            key={field.key}
            className="grid grid-cols-1 gap-1 md:grid-cols-[16rem_10rem_1fr] md:items-center md:gap-3"
          >
            <label htmlFor={`chinh-sach-${field.key}`} className="text-label font-medium text-text">
              {field.label}
            </label>
            <input
              id={`chinh-sach-${field.key}`}
              inputMode="numeric"
              aria-invalid={fieldErrors[field.key] ? true : undefined}
              className={`rounded-lg border bg-card px-3 py-2 text-content text-text ${fieldErrors[field.key] ? 'border-danger' : 'border-border'}`}
              value={values[field.key]}
              onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
            />
            <span className={`text-label ${fieldErrors[field.key] ? 'text-danger' : 'text-text-secondary'}`}>
              {fieldErrors[field.key] ?? field.hint}
            </span>
          </div>
        ))}
        <div>
          <Button type="submit" disabled={save.isPending || policy.isPending}>
            Ghi
          </Button>
        </div>
      </form>
    </section>
  );
}
