import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { matchStaffCatalog, STAFF_CATALOGS, STAFF_PROFILE_BLOCKS, type StaffField } from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, FormBlock, FormRow } from '@school-management/ui';
import { ApiError } from '../session/api-client.js';
import { updateStaffProfile, type StaffDetail } from './staff-api.js';

// Hồ sơ cán bộ, giáo viên theo thứ tự ô nhập của Sở (DT-15 phần 15d, YCTD-112): các khối Thông tin chung, Địa chỉ, Đoàn
// Đảng, Tuyển dụng công tác, Lương phụ cấp theo ngạch bậc, Trình độ, Đánh giá khen thưởng; nhãn bên trái, nút Ghi. Ô bí
// mật (số định danh, số sổ BHXH) hiện số đã che, nhập số mới để thay. Chỉ gửi các ô đã đổi; máy chủ kiểm tra quyền
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

type Values = Record<string, string | boolean>;

const FIELDS = STAFF_PROFILE_BLOCKS.flatMap((block) => block.fields);

// Giá trị ban đầu của biểu mẫu; ô bí mật để trống (giữ số cũ khi không nhập)
export function staffProfileValues(staff: StaffDetail): Values {
  const values: Values = {};
  const coreValues: Record<string, string | null> = {
    moet_staff_code: staff.moet_staff_code ?? null,
    full_name: staff.full_name,
    gender: staff.gender,
    dob: staff.dob,
    email: staff.email,
    phone: staff.phone,
    address: staff.address,
    bank_account_number: staff.bank_account_number ?? null,
    bank_name: staff.bank_name ?? null,
    tax_code: staff.tax_code ?? null,
  };
  for (const field of FIELDS) {
    if (field.kind === 'secret') {
      values[field.key] = '';
    } else if (field.core && field.kind === 'flag') {
      values[field.key] = (staff as unknown as Record<string, unknown>)[field.key] === true;
    } else if (field.core) {
      values[field.key] = coreValues[field.key] ?? '';
    } else {
      values[field.key] = staff.moet_fields?.[field.key] ?? (field.kind === 'flag' ? false : '');
    }
  }
  return values;
}

function maskedOf(staff: StaffDetail, field: StaffField): string {
  if (field.key === 'id_number') {
    return staff.id_number_masked ?? '';
  }
  const value = staff.moet_fields?.[field.key];
  return typeof value === 'string' ? value : '';
}

export function StaffProfileForm({
  staff,
  editable,
  onSaved,
}: {
  staff: StaffDetail;
  // Người xem có quyền quản lý hồ sơ nhân sự của đơn vị
  editable: boolean;
  onSaved(message: string): void;
}) {
  const initial = staffProfileValues(staff);
  const [values, setValues] = useState<Values>(initial);
  const [notice, setNotice] = useState<string>();
  const update = (key: string, value: string | boolean) => setValues((current) => ({ ...current, [key]: value }));

  const save = useMutation({
    mutationFn: async () => {
      const changes: Record<string, unknown> = {};
      const profile: Record<string, unknown> = {};
      for (const field of FIELDS) {
        const value = values[field.key];
        if (value === initial[field.key]) {
          continue;
        }
        const sent = typeof value === 'string' ? value.trim() || null : value;
        if (field.core) {
          changes[field.key] = sent;
        } else {
          profile[field.key] = sent;
        }
      }
      if (Object.keys(profile).length > 0) {
        changes.moet_profile = profile;
      }
      if (Object.keys(changes).length === 0) {
        return false;
      }
      await updateStaffProfile(staff.id, changes);
      return true;
    },
    onSuccess: (changed) => {
      if (changed) {
        onSaved('Đã ghi hồ sơ cán bộ, giáo viên');
      } else {
        setNotice('Không có thông tin nào thay đổi');
      }
    },
  });
  const errors =
    save.error instanceof ApiError
      ? Object.fromEntries(
          save.error.details.map((detail) => [detail.field.replace(/^moet_profile\./, ''), detail.message]),
        )
      : {};

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(undefined);
    save.mutate();
  }

  function control(field: StaffField) {
    const value = values[field.key];
    if (field.kind === 'flag') {
      return (
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={value === true}
          disabled={!editable}
          onChange={(event) => update(field.key, event.target.checked)}
        />
      );
    }
    if (field.kind === 'gender') {
      return (
        <select
          value={String(value)}
          disabled={!editable}
          onChange={(event) => update(field.key, event.target.value)}
          className={FORM_CONTROL_CLASS}
        >
          <option value="">Chưa chọn</option>
          <option value="male">Nam</option>
          <option value="female">Nữ</option>
        </select>
      );
    }
    // Ô theo danh mục của Bộ (DT-16 phần 16f): giá trị cũ ngoài danh mục vẫn hiện, ghi kèm "giá trị cũ"
    if (field.catalog) {
      const current = String(value);
      const legacy = current !== '' && !matchStaffCatalog(field.catalog, current);
      return (
        <select
          value={legacy ? current : (matchStaffCatalog(field.catalog, current) ?? '')}
          disabled={!editable}
          onChange={(event) => update(field.key, event.target.value)}
          className={FORM_CONTROL_CLASS}
        >
          <option value="">Chưa chọn</option>
          {legacy ? <option value={current}>{`${current} (giá trị cũ, ngoài danh mục)`}</option> : null}
          {STAFF_CATALOGS[field.catalog].items.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      );
    }
    const missingCode = field.key === 'moet_staff_code' && !value;
    return (
      <input
        type={field.kind === 'date' ? 'date' : 'text'}
        value={String(value)}
        disabled={!editable}
        inputMode={field.kind === 'secret' ? 'numeric' : undefined}
        placeholder={
          field.kind === 'secret' ? maskedOf(staff, field) || 'Chưa có' : missingCode ? 'Chưa có' : undefined
        }
        onChange={(event) => update(field.key, event.target.value)}
        className={`${FORM_CONTROL_CLASS} ${missingCode ? 'border-danger bg-danger/10 text-danger' : ''}`}
      />
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4" aria-label="Hồ sơ cán bộ, giáo viên theo Sở">
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      {notice ? <Alert tone="info">{notice}</Alert> : null}
      {STAFF_PROFILE_BLOCKS.map((block) => (
        <FormBlock key={block.title} title={block.title}>
          {block.fields.map((field) => (
            <FormRow key={field.key} label={field.label} error={errors[field.key]}>
              {control(field)}
            </FormRow>
          ))}
        </FormBlock>
      ))}
      {editable ? (
        <div>
          <Button type="submit" variant="primary" disabled={save.isPending}>
            {save.isPending ? 'Đang ghi…' : 'Ghi'}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
