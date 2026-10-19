import { useState, type FormEvent, type ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CHILD_POLICY_BENEFITS, ETHNIC_GROUPS } from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, FormBlock, FormRow, StatusBadge } from '@school-management/ui';
import { ApiError } from '../session/api-client.js';
import { CHILD_STATUS_LABELS, setSmsGuardian, updateChild, type ChildDetail } from './children-api.js';

// Hồ sơ học sinh theo thứ tự ô nhập của Sở (DT-15 phần 15c, YCTD-108): khối Thông tin chung, Địa chỉ, Thông tin khác,
// Thông tin gia đình; nhãn bên trái, nút Ghi. Dân tộc, diện chính sách, khuyết tật, biết bơi ghi ở cột CSDL ngành, người xem
// được thì sửa được (DT-16 phần 16g); người không xem được thấy "Chưa có". Sửa
// thông tin định danh của học sinh đã duyệt cần nhập lý do (QT-01 E7); máy chủ kiểm tra quyền và trạng thái
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

interface ProfileValues {
  moet_student_code: string;
  full_name: string;
  dob: string;
  gender: 'male' | 'female';
  place_of_birth: string;
  address: string;
  two_sessions_per_day: boolean;
  boarding: boolean;
  policy_benefits: string[];
  sms_guardian_id: string;
  ethnicity: string;
  policy_target: string;
  disability_type: string;
  can_swim: boolean;
}

export const valuesOf = (child: ChildDetail): ProfileValues => ({
  moet_student_code: child.moet_student_code ?? '',
  full_name: child.full_name,
  dob: child.dob,
  gender: child.gender,
  place_of_birth: child.place_of_birth ?? '',
  address: child.address ?? '',
  two_sessions_per_day: child.two_sessions_per_day,
  boarding: child.boarding,
  policy_benefits: child.policy_benefits ?? [],
  sms_guardian_id: child.guardians.find((guardian) => guardian.receives_sms)?.id ?? '',
  ethnicity: child.moet_fields?.ethnicity ?? '',
  policy_target: child.moet_fields?.policy_target ?? '',
  disability_type: child.moet_fields?.disability_type ?? '',
  can_swim: child.moet_fields?.can_swim ?? false,
});

const MOET_FIELD_KEYS = ['ethnicity', 'policy_target', 'disability_type', 'can_swim'] as const;

const IDENTITY_KEYS = ['full_name', 'dob', 'gender', 'place_of_birth', 'address'] as const;

export function StudentProfileForm({
  child,
  editable,
  nationalId,
  onSaved,
}: {
  child: ChildDetail;
  // Người xem sửa được hồ sơ ở trạng thái hiện tại
  editable: boolean;
  // Ô số định danh (che bốn số cuối, nút xem đầy đủ) do khung hồ sơ dựng
  nationalId: ReactNode;
  onSaved(message: string): void;
}) {
  const initial = valuesOf(child);
  const [values, setValues] = useState<ProfileValues>(initial);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState<string>();
  const profile = (key: string) => child.moet_profile?.find((entry) => entry.key === key)?.value ?? '';
  const update = (changes: Partial<ProfileValues>) => setValues((current) => ({ ...current, ...changes }));

  const save = useMutation({
    mutationFn: async () => {
      const changes: Record<string, unknown> = {};
      for (const key of [...IDENTITY_KEYS, 'moet_student_code', 'two_sessions_per_day', 'boarding'] as const) {
        if (values[key] !== initial[key]) {
          changes[key] = typeof values[key] === 'string' ? (values[key] as string).trim() || null : values[key];
        }
      }
      if (
        [...values.policy_benefits].sort().join(',') !== [...initial.policy_benefits].sort().join(',')
      ) {
        changes.policy_benefits = values.policy_benefits;
      }
      if (child.moet_fields) {
        for (const key of MOET_FIELD_KEYS) {
          if (values[key] !== initial[key]) {
            changes[key] = typeof values[key] === 'string' ? (values[key] as string).trim() || null : values[key];
          }
        }
      }
      const identityChanged = IDENTITY_KEYS.some((key) => key in changes);
      if (identityChanged && child.status !== 'draft') {
        changes.reason = reason.trim() || null;
      }
      const smsChanged = values.sms_guardian_id !== initial.sms_guardian_id;
      if (Object.keys(changes).length === 0 && !smsChanged) {
        return false;
      }
      if (Object.keys(changes).length > 0) {
        await updateChild(child.id, changes);
      }
      if (smsChanged) {
        await setSmsGuardian(child.id, values.sms_guardian_id || null);
      }
      return true;
    },
    onSuccess: (changed) => {
      if (changed) {
        setReason('');
        onSaved('Đã ghi hồ sơ học sinh');
      } else {
        setNotice('Không có thông tin nào thay đổi');
      }
    },
  });
  const errors =
    save.error instanceof ApiError
      ? Object.fromEntries(save.error.details.map((detail) => [detail.field, detail.message]))
      : {};

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(undefined);
    save.mutate();
  }

  const smsOptions = child.guardians.filter((guardian) => guardian.phone);

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4" aria-label="Hồ sơ học sinh theo Sở">
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      {notice ? <Alert tone="info">{notice}</Alert> : null}
      <FormBlock title="Thông tin chung">
        <FormRow label="Mã định danh Bộ GD&ĐT" error={errors.moet_student_code}>
          <input
            data-testid="moet-code"
            value={values.moet_student_code}
            disabled={!editable}
            placeholder="Chưa có"
            onChange={(event) => update({ moet_student_code: event.target.value })}
            className={`${FORM_CONTROL_CLASS} ${values.moet_student_code ? '' : 'border-danger bg-danger/10 text-danger'}`}
          />
        </FormRow>
        <FormRow label="Họ tên" error={errors.full_name}>
          <input
            value={values.full_name}
            disabled={!editable}
            onChange={(event) => update({ full_name: event.target.value })}
            className={FORM_CONTROL_CLASS}
          />
        </FormRow>
        <FormRow label="Ngày sinh" error={errors.dob}>
          <input
            type="date"
            value={values.dob}
            disabled={!editable}
            onChange={(event) => update({ dob: event.target.value })}
            className={FORM_CONTROL_CLASS}
          />
        </FormRow>
        <FormRow label="Giới tính" error={errors.gender}>
          <select
            value={values.gender}
            disabled={!editable}
            onChange={(event) => update({ gender: event.target.value as 'male' | 'female' })}
            className={FORM_CONTROL_CLASS}
          >
            <option value="male">Nam</option>
            <option value="female">Nữ</option>
          </select>
        </FormRow>
        <FormRow label="Trạng thái">
          <span>
            <StatusBadge
              tone={child.status === 'active' ? 'success' : child.status === 'pending' ? 'warning' : 'neutral'}
              label={CHILD_STATUS_LABELS[child.status]}
            />
          </span>
        </FormRow>
        <FormRow label="Dân tộc" error={errors.ethnicity}>
          {child.moet_fields ? (
            <select
              value={values.ethnicity}
              disabled={!editable}
              onChange={(event) => update({ ethnicity: event.target.value })}
              className={FORM_CONTROL_CLASS}
            >
              <option value="">Chưa có</option>
              {values.ethnicity && !(ETHNIC_GROUPS as readonly string[]).includes(values.ethnicity) ? (
                <option value={values.ethnicity}>{values.ethnicity}</option>
              ) : null}
              {ETHNIC_GROUPS.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-content">{profile('ethnicity') || 'Chưa có'}</span>
          )}
        </FormRow>
        <FormRow label="Số định danh cá nhân">{nationalId}</FormRow>
        <FormRow label="Lớp">
          <span className="text-content">{child.current_class?.class_name ?? 'Chưa xếp lớp'}</span>
        </FormRow>
      </FormBlock>

      <FormBlock title="Địa chỉ">
        <FormRow label="Nơi sinh" error={errors.place_of_birth}>
          <input
            value={values.place_of_birth}
            disabled={!editable}
            onChange={(event) => update({ place_of_birth: event.target.value })}
            className={FORM_CONTROL_CLASS}
          />
        </FormRow>
        <FormRow label="Chỗ ở hiện nay" error={errors.address}>
          <input
            value={values.address}
            disabled={!editable}
            onChange={(event) => update({ address: event.target.value })}
            className={FORM_CONTROL_CLASS}
          />
        </FormRow>
      </FormBlock>

      <FormBlock title="Thông tin khác">
        <FormRow label="Học 2 buổi/ngày">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={values.two_sessions_per_day}
            disabled={!editable}
            onChange={(event) => update({ two_sessions_per_day: event.target.checked })}
          />
        </FormRow>
        <FormRow label="Học sinh lớp bán trú">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={values.boarding}
            disabled={!editable}
            onChange={(event) => update({ boarding: event.target.checked })}
          />
        </FormRow>
        {/* Chỉ tiêu 112–116 của Biểu 01.ĐN-MN (DT-17 phần 17a) */}
        <FormRow label="Đối tượng chính sách theo nghị định">
          <div className="flex flex-col gap-1">
            {CHILD_POLICY_BENEFITS.map((benefit) => (
              <label key={benefit.value} className="flex items-center gap-2 text-content">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={values.policy_benefits.includes(benefit.value)}
                  disabled={!editable}
                  onChange={(event) =>
                    update({
                      policy_benefits: event.target.checked
                        ? [...values.policy_benefits, benefit.value]
                        : values.policy_benefits.filter((value) => value !== benefit.value),
                    })
                  }
                />
                {benefit.label}
              </label>
            ))}
          </div>
        </FormRow>
        {child.moet_fields ? (
          <>
            <FormRow label="Diện chính sách" error={errors.policy_target}>
              <input
                value={values.policy_target}
                disabled={!editable}
                placeholder="Không"
                maxLength={100}
                onChange={(event) => update({ policy_target: event.target.value })}
                className={FORM_CONTROL_CLASS}
              />
            </FormRow>
            <FormRow label="Khuyết tật" error={errors.disability_type}>
              <input
                value={values.disability_type}
                disabled={!editable}
                placeholder="Không"
                maxLength={100}
                onChange={(event) => update({ disability_type: event.target.value })}
                className={FORM_CONTROL_CLASS}
              />
            </FormRow>
            <FormRow label="Biết bơi">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={values.can_swim}
                disabled={!editable}
                onChange={(event) => update({ can_swim: event.target.checked })}
              />
            </FormRow>
          </>
        ) : (
          <>
            <FormRow label="Diện chính sách">
              <span className="text-content">{profile('policy_target') || 'Không'}</span>
            </FormRow>
            <FormRow label="Khuyết tật">
              <span className="text-content">{profile('disability_type') || 'Không'}</span>
            </FormRow>
          </>
        )}
      </FormBlock>

      <FormBlock title="Thông tin gia đình">
        <ul className="flex flex-col gap-1" aria-label="Phụ huynh">
          {child.guardians.map((guardian) => (
            <li key={guardian.id} className="flex flex-wrap items-center gap-2 text-content">
              <span className="font-medium">{guardian.full_name}</span>
              <span>{guardian.relationship}</span>
              <span className="text-text-secondary">{guardian.phone ?? 'Không có số điện thoại'}</span>
              {guardian.is_primary ? <StatusBadge tone="info" label="Liên hệ chính" /> : null}
              {guardian.has_account ? <StatusBadge tone="success" label="Đã có tài khoản" /> : null}
            </li>
          ))}
        </ul>
        <FormRow label="Điện thoại nhận tin" error={errors.guardian_id}>
          <select
            value={values.sms_guardian_id}
            disabled={!editable}
            onChange={(event) => update({ sms_guardian_id: event.target.value })}
            className={FORM_CONTROL_CLASS}
          >
            <option value="">Chưa chọn (gửi mọi phụ huynh có tài khoản)</option>
            {smsOptions.map((guardian) => (
              <option key={guardian.id} value={guardian.id}>
                {guardian.phone} — {guardian.full_name} ({guardian.relationship})
              </option>
            ))}
          </select>
        </FormRow>
      </FormBlock>

      {editable ? (
        <div className="flex flex-col gap-3">
          {child.status !== 'draft' ? (
            <FormRow label="Lý do sửa thông tin định danh" error={errors.reason}>
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className={FORM_CONTROL_CLASS}
              />
            </FormRow>
          ) : null}
          <div>
            <Button type="submit" variant="primary" disabled={save.isPending}>
              {save.isPending ? 'Đang ghi…' : 'Ghi'}
            </Button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
