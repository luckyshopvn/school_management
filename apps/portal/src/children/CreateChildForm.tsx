import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, TextField } from '@school-management/ui';
import { listCatalogItems } from '../catalogs/catalogs-api.js';
import { listStaff } from '../classes/classes-api.js';
import type { OrgUnit } from '../org-units/org-units-api.js';
import { ApiError } from '../session/api-client.js';
import {
  createChild,
  PHOTO_CONSENT_LABELS,
  uploadFile,
  type ChildDetail,
  type ChildInput,
  type GuardianInput,
  type PhotoConsent,
} from './children-api.js';

// Biểu mẫu hồ sơ trẻ bốn khối: định danh, phụ huynh, sức khỏe, cờ và ghi chú (QT-01 mục 11).
// Giao diện chỉ chuyển dữ liệu; máy chủ kiểm tra trường bắt buộc, trùng số định danh và phạm vi đơn vị
const STAFF_ROLES = [
  { code: 'VT-07', label: 'Giáo viên chủ nhiệm' },
  { code: 'VT-08', label: 'Giáo viên bộ môn' },
  { code: 'VT-03', label: 'Quản lý đơn vị' },
  { code: 'VT-04', label: 'Kế toán' },
  { code: 'VT-06', label: 'Nhân sự' },
  { code: 'VT-09', label: 'Nhân viên y tế' },
  { code: 'VT-10', label: 'Nhân viên bếp' },
  { code: 'VT-12', label: 'Nhân viên tuyển sinh' },
];

const emptyGuardian = (isPrimary: boolean): GuardianInput => ({
  full_name: '',
  phone: '',
  relationship_item_id: '',
  is_primary: isPrimary,
  occupation: '',
});

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  error?: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-label font-medium text-text">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-border bg-card px-3 py-2 text-content font-normal"
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <span className="text-label text-danger">{error}</span> : null}
    </label>
  );
}

export function CreateChildForm({
  units,
  defaultUnitId,
  onCreated,
  onCancel,
}: {
  units: OrgUnit[];
  defaultUnitId: string | undefined;
  onCreated(child: ChildDetail): void;
  onCancel(): void;
}) {
  const [form, setForm] = useState<ChildInput>({
    org_unit_id: defaultUnitId ?? '',
    full_name: '',
    dob: '',
    gender: '',
    place_of_birth: null,
    address: null,
    national_id: '',
    moet_student_code: null,
    birth_certificate_file_id: '',
    special_needs_note: null,
    note: null,
    is_staff_child: false,
    related_staff_user_id: null,
    related_staff_role_code: 'VT-07',
    photo_consent: '',
    photo_consent_file_id: null,
    health: { has_allergies: null, allergies: null, chronic_conditions: null },
    guardians: [emptyGuardian(true)],
    confirm_possible_duplicate: false,
  });
  const [uploadMessage, setUploadMessage] = useState<string>();
  const [duplicates, setDuplicates] = useState<string[]>([]);
  const relationships = useQuery({
    queryKey: ['catalog-items', 'parent_relationship'],
    queryFn: () => listCatalogItems('parent_relationship'),
  });
  const staff = useQuery({
    queryKey: ['staff-directory', form.related_staff_role_code, form.org_unit_id],
    queryFn: () => listStaff(form.related_staff_role_code ?? 'VT-07', form.org_unit_id),
    enabled: form.is_staff_child && form.org_unit_id !== '',
  });
  const update = (changes: Partial<ChildInput>) => setForm((current) => ({ ...current, ...changes }));
  const updateGuardian = (index: number, changes: Partial<GuardianInput>) =>
    setForm((current) => ({
      ...current,
      guardians: current.guardians.map((guardian, position) =>
        position === index
          ? { ...guardian, ...changes }
          : changes.is_primary
            ? { ...guardian, is_primary: false }
            : guardian,
      ),
    }));

  const upload = useMutation({
    mutationFn: ({ purpose, file }: { purpose: 'birth_certificate' | 'photo_consent'; file: File }) =>
      uploadFile(form.org_unit_id, purpose, file),
    onSuccess: (stored, { purpose }) => {
      setUploadMessage(undefined);
      update(
        purpose === 'birth_certificate'
          ? { birth_certificate_file_id: stored.id }
          : { photo_consent_file_id: stored.id },
      );
    },
    onError: (error) => setUploadMessage(error instanceof ApiError ? error.message : 'Không tải được tệp'),
  });
  const create = useMutation({
    mutationFn: (confirm: boolean) =>
      createChild({
        ...form,
        confirm_possible_duplicate: confirm,
        guardians: form.guardians.map((guardian) => ({
          ...guardian,
          phone: guardian.phone?.trim() || null,
          occupation: guardian.occupation?.trim() || null,
        })),
      }),
    onSuccess: onCreated,
    onError: (error) => {
      if (error instanceof ApiError && error.details.some((detail) => detail.field === 'possible_duplicates')) {
        setDuplicates(error.details.map((detail) => detail.message));
      }
    },
  });
  const errors =
    create.error instanceof ApiError
      ? Object.fromEntries(create.error.details.map((detail) => [detail.field, detail.message]))
      : {};
  const relationshipOptions = (relationships.data ?? [])
    .filter((item) => item.status === 'active')
    .map((item) => ({ value: item.id, label: item.name }));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDuplicates([]);
    create.mutate(false);
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5" aria-label="Biểu mẫu hồ sơ trẻ">
      <h2 className="text-section-title font-semibold text-text">Tạo hồ sơ trẻ</h2>
      {create.error && duplicates.length === 0 ? (
        <Alert tone="danger">{create.error instanceof ApiError ? create.error.message : 'Không lưu được hồ sơ'}</Alert>
      ) : null}
      {duplicates.length > 0 ? (
        <Alert tone="warning">
          Đã có {duplicates.length} hồ sơ trùng họ tên và ngày sinh trong đơn vị. Kiểm tra trước khi tiếp tục.{' '}
          <Button variant="text" onClick={() => create.mutate(true)}>
            Vẫn lưu hồ sơ
          </Button>
        </Alert>
      ) : null}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-content font-semibold text-text">Định danh</legend>
        <SelectField
          label="Đơn vị"
          value={form.org_unit_id}
          onChange={(value) =>
            update({ org_unit_id: value, birth_certificate_file_id: '', photo_consent_file_id: null })
          }
          options={units.map((unit) => ({ value: unit.id, label: unit.name }))}
          error={errors.org_unit_id}
        />
        <TextField
          label="Họ tên trẻ"
          value={form.full_name}
          error={errors.full_name}
          onChange={(event) => update({ full_name: event.target.value })}
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <TextField
            label="Ngày sinh"
            type="date"
            value={form.dob}
            error={errors.dob}
            onChange={(event) => update({ dob: event.target.value })}
          />
          <SelectField
            label="Giới tính"
            value={form.gender}
            onChange={(value) => update({ gender: value as ChildInput['gender'] })}
            options={[
              { value: 'male', label: 'Nam' },
              { value: 'female', label: 'Nữ' },
            ]}
            placeholder="Chọn giới tính"
            error={errors.gender}
          />
        </div>
        <TextField
          label="Nơi sinh"
          value={form.place_of_birth ?? ''}
          onChange={(event) => update({ place_of_birth: event.target.value || null })}
        />
        <TextField
          label="Địa chỉ"
          value={form.address ?? ''}
          onChange={(event) => update({ address: event.target.value || null })}
        />
        <TextField
          label="Số định danh cá nhân"
          inputMode="numeric"
          maxLength={12}
          value={form.national_id}
          error={errors.national_id}
          onChange={(event) => update({ national_id: event.target.value })}
        />
        <TextField
          label="Mã định danh ngành"
          value={form.moet_student_code ?? ''}
          error={errors.moet_student_code}
          onChange={(event) => update({ moet_student_code: event.target.value || null })}
        />
        <label className="flex flex-col gap-2 text-label font-medium text-text">
          Bản chụp giấy khai sinh (ảnh hoặc PDF, tối đa 10 MB)
          <input
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            disabled={!form.org_unit_id}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                upload.mutate({ purpose: 'birth_certificate', file });
              }
            }}
          />
          {form.birth_certificate_file_id ? <span className="text-label text-success">Đã tải lên</span> : null}
          {errors.birth_certificate_file_id ? (
            <span className="text-label text-danger">{errors.birth_certificate_file_id}</span>
          ) : null}
        </label>
        {uploadMessage ? <Alert tone="danger">{uploadMessage}</Alert> : null}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-content font-semibold text-text">Phụ huynh</legend>
        {errors.guardians ? <p className="text-label text-danger">{errors.guardians}</p> : null}
        {form.guardians.map((guardian, index) => (
          <div
            key={index}
            className="grid grid-cols-1 gap-3 rounded-lg bg-page p-3 md:grid-cols-2"
            aria-label={`Phụ huynh ${index + 1}`}
            role="group"
          >
            <TextField
              label="Họ tên phụ huynh"
              value={guardian.full_name}
              error={errors[`guardians.${index}.full_name`]}
              onChange={(event) => updateGuardian(index, { full_name: event.target.value })}
            />
            <SelectField
              label="Quan hệ"
              value={guardian.relationship_item_id}
              onChange={(value) => updateGuardian(index, { relationship_item_id: value })}
              options={relationshipOptions}
              placeholder="Chọn quan hệ"
              error={errors[`guardians.${index}.relationship_item_id`]}
            />
            <TextField
              label="Số điện thoại"
              inputMode="tel"
              value={guardian.phone ?? ''}
              error={errors[`guardians.${index}.phone`]}
              onChange={(event) => updateGuardian(index, { phone: event.target.value })}
            />
            <TextField
              label="Nghề nghiệp"
              value={guardian.occupation ?? ''}
              onChange={(event) => updateGuardian(index, { occupation: event.target.value })}
            />
            <label className="flex items-center gap-2 text-label">
              <input
                type="radio"
                name="primary-guardian"
                checked={guardian.is_primary}
                onChange={() => updateGuardian(index, { is_primary: true })}
              />
              Liên hệ chính
            </label>
            {form.guardians.length > 1 ? (
              <Button
                variant="text"
                onClick={() => update({ guardians: form.guardians.filter((_item, position) => position !== index) })}
              >
                Bỏ phụ huynh này
              </Button>
            ) : null}
          </div>
        ))}
        <div>
          <Button onClick={() => update({ guardians: [...form.guardians, emptyGuardian(false)] })}>
            Thêm phụ huynh
          </Button>
        </div>
        {relationshipOptions.length === 0 && !relationships.isPending ? (
          <Alert tone="warning">
            Danh mục "Quan hệ với trẻ" chưa có mục nào; Hiệu trưởng thêm ở màn hình Danh mục dùng chung.
          </Alert>
        ) : null}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-content font-semibold text-text">Sức khỏe</legend>
        <div className="flex flex-wrap gap-4 text-label" role="radiogroup" aria-label="Dị ứng">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="allergies"
              checked={form.health.has_allergies === false}
              onChange={() => update({ health: { ...form.health, has_allergies: false, allergies: null } })}
            />
            Không có dị ứng
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="allergies"
              checked={form.health.has_allergies === true}
              onChange={() => update({ health: { ...form.health, has_allergies: true } })}
            />
            Có dị ứng
          </label>
        </div>
        {form.health.has_allergies ? (
          <TextField
            label="Dị ứng gì"
            value={form.health.allergies ?? ''}
            error={errors['health.allergies']}
            onChange={(event) => update({ health: { ...form.health, allergies: event.target.value || null } })}
          />
        ) : null}
        <TextField
          label="Bệnh nền"
          value={form.health.chronic_conditions ?? ''}
          onChange={(event) => update({ health: { ...form.health, chronic_conditions: event.target.value || null } })}
        />
        <TextField
          label="Nhu cầu đặc biệt và lưu ý chăm sóc"
          value={form.special_needs_note ?? ''}
          onChange={(event) => update({ special_needs_note: event.target.value || null })}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-content font-semibold text-text">Cờ và ghi chú</legend>
        <SelectField
          label="Đồng ý sử dụng hình ảnh"
          value={form.photo_consent}
          onChange={(value) => update({ photo_consent: value as PhotoConsent })}
          options={(Object.keys(PHOTO_CONSENT_LABELS) as PhotoConsent[]).map((key) => ({
            value: key,
            label: PHOTO_CONSENT_LABELS[key],
          }))}
          placeholder="Chọn"
          error={errors.photo_consent}
        />
        {form.photo_consent === 'granted' ? (
          <label className="flex flex-col gap-2 text-label font-medium text-text">
            Bản chụp giấy đồng ý ký tay
            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  upload.mutate({ purpose: 'photo_consent', file });
                }
              }}
            />
            {form.photo_consent_file_id ? <span className="text-label text-success">Đã tải lên</span> : null}
            {errors.photo_consent_file_id ? (
              <span className="text-label text-danger">{errors.photo_consent_file_id}</span>
            ) : null}
          </label>
        ) : null}
        <label className="flex items-center gap-2 text-label">
          <input
            type="checkbox"
            checked={form.is_staff_child}
            onChange={(event) => update({ is_staff_child: event.target.checked })}
          />
          Trẻ là con của nhân sự trong trường
        </label>
        {form.is_staff_child ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <SelectField
              label="Vai trò của nhân sự"
              value={form.related_staff_role_code ?? 'VT-07'}
              onChange={(value) => update({ related_staff_role_code: value, related_staff_user_id: null })}
              options={STAFF_ROLES.map((role) => ({ value: role.code, label: role.label }))}
            />
            <SelectField
              label="Nhân sự liên quan"
              value={form.related_staff_user_id ?? ''}
              onChange={(value) => update({ related_staff_user_id: value || null })}
              options={(staff.data ?? []).map((entry) => ({ value: entry.user_id, label: entry.full_name }))}
              placeholder="Chọn nhân sự"
              error={errors.related_staff_user_id}
            />
          </div>
        ) : null}
        <TextField
          label="Ghi chú"
          value={form.note ?? ''}
          onChange={(event) => update({ note: event.target.value || null })}
        />
      </fieldset>

      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={create.isPending || upload.isPending}>
          {create.isPending ? 'Đang lưu…' : 'Lưu hồ sơ nháp'}
        </Button>
        <Button variant="text" onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </form>
  );
}
