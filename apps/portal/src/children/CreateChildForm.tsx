import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, FORM_CONTROL_CLASS, FormBlock, FormRow } from '@school-management/ui';
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

// Biểu mẫu thêm mới hồ sơ học sinh theo thứ tự ô nhập của Sở (YCTD-108): Thông tin chung, Địa chỉ, Thông tin gia đình; các
// ô riêng của trường (giấy khai sinh, sức khỏe, đồng ý hình ảnh, trẻ con nhân viên, ghi chú) ở khối cuối (QT-01 mục 11).
// Giao diện chỉ chuyển dữ liệu; máy chủ kiểm tra trường bắt buộc, trùng số định danh và phạm vi đơn vị
export const STAFF_ROLES = [
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
    <form onSubmit={submit} noValidate className="flex flex-col gap-4" aria-label="Biểu mẫu hồ sơ học sinh">
      <h2 className="text-section-title font-semibold text-text">Thêm mới hồ sơ học sinh</h2>
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

      <FormBlock title="Thông tin chung">
        <FormRow label="Mã định danh Bộ GD&ĐT" error={errors.moet_student_code}>
          <input
            value={form.moet_student_code ?? ''}
            onChange={(event) => update({ moet_student_code: event.target.value || null })}
            className={FORM_CONTROL_CLASS}
          />
        </FormRow>
        <FormRow label="Họ tên" error={errors.full_name}>
          <input
            value={form.full_name}
            onChange={(event) => update({ full_name: event.target.value })}
            className={FORM_CONTROL_CLASS}
          />
        </FormRow>
        <FormRow label="Ngày sinh" error={errors.dob}>
          <input
            type="date"
            value={form.dob}
            onChange={(event) => update({ dob: event.target.value })}
            className={FORM_CONTROL_CLASS}
          />
        </FormRow>
        <FormRow label="Giới tính" error={errors.gender}>
          <select
            value={form.gender}
            onChange={(event) => update({ gender: event.target.value as ChildInput['gender'] })}
            className={FORM_CONTROL_CLASS}
          >
            <option value="">Chọn giới tính</option>
            <option value="male">Nam</option>
            <option value="female">Nữ</option>
          </select>
        </FormRow>
        <FormRow label="Số định danh cá nhân" error={errors.national_id}>
          <input
            inputMode="numeric"
            maxLength={12}
            value={form.national_id}
            onChange={(event) => update({ national_id: event.target.value })}
            className={FORM_CONTROL_CLASS}
          />
        </FormRow>
        <FormRow label="Đơn vị" error={errors.org_unit_id}>
          <select
            value={form.org_unit_id}
            onChange={(event) =>
              update({ org_unit_id: event.target.value, birth_certificate_file_id: '', photo_consent_file_id: null })
            }
            className={FORM_CONTROL_CLASS}
          >
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </FormRow>
      </FormBlock>

      <FormBlock title="Địa chỉ">
        <FormRow label="Nơi sinh">
          <input
            value={form.place_of_birth ?? ''}
            onChange={(event) => update({ place_of_birth: event.target.value || null })}
            className={FORM_CONTROL_CLASS}
          />
        </FormRow>
        <FormRow label="Chỗ ở hiện nay">
          <input
            value={form.address ?? ''}
            onChange={(event) => update({ address: event.target.value || null })}
            className={FORM_CONTROL_CLASS}
          />
        </FormRow>
      </FormBlock>

      <FormBlock title="Thông tin gia đình">
        {errors.guardians ? <p className="text-label text-danger">{errors.guardians}</p> : null}
        {form.guardians.map((guardian, index) => (
          <div
            key={index}
            className="flex flex-col gap-3 rounded-lg bg-page p-3"
            aria-label={`Phụ huynh ${index + 1}`}
            role="group"
          >
            <FormRow label="Họ tên phụ huynh" error={errors[`guardians.${index}.full_name`]}>
              <input
                value={guardian.full_name}
                onChange={(event) => updateGuardian(index, { full_name: event.target.value })}
                className={FORM_CONTROL_CLASS}
              />
            </FormRow>
            <FormRow label="Quan hệ" error={errors[`guardians.${index}.relationship_item_id`]}>
              <select
                value={guardian.relationship_item_id}
                onChange={(event) => updateGuardian(index, { relationship_item_id: event.target.value })}
                className={FORM_CONTROL_CLASS}
              >
                <option value="">Chọn quan hệ</option>
                {relationshipOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Số điện thoại" error={errors[`guardians.${index}.phone`]}>
              <input
                inputMode="tel"
                value={guardian.phone ?? ''}
                onChange={(event) => updateGuardian(index, { phone: event.target.value })}
                className={FORM_CONTROL_CLASS}
              />
            </FormRow>
            <FormRow label="Nghề nghiệp">
              <input
                value={guardian.occupation ?? ''}
                onChange={(event) => updateGuardian(index, { occupation: event.target.value })}
                className={FORM_CONTROL_CLASS}
              />
            </FormRow>
            <div className="flex flex-wrap items-center gap-4 md:pl-[12.75rem]">
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
      </FormBlock>

      <FormBlock title="Thông tin riêng của trường">
        <FormRow label="Bản chụp giấy khai sinh (ảnh hoặc PDF, tối đa 10 MB)" error={errors.birth_certificate_file_id}>
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
        </FormRow>
        {form.birth_certificate_file_id ? <p className="text-label text-success md:pl-[12.75rem]">Đã tải lên</p> : null}
        {uploadMessage ? <Alert tone="danger">{uploadMessage}</Alert> : null}
        <FormRow label="Dị ứng" error={errors['health.has_allergies']}>
          <span className="flex flex-wrap gap-4 text-label" role="radiogroup" aria-label="Dị ứng">
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
          </span>
        </FormRow>
        {form.health.has_allergies ? (
          <FormRow label="Dị ứng gì" error={errors['health.allergies']}>
            <input
              value={form.health.allergies ?? ''}
              onChange={(event) => update({ health: { ...form.health, allergies: event.target.value || null } })}
              className={FORM_CONTROL_CLASS}
            />
          </FormRow>
        ) : null}
        <FormRow label="Bệnh nền">
          <input
            value={form.health.chronic_conditions ?? ''}
            onChange={(event) => update({ health: { ...form.health, chronic_conditions: event.target.value || null } })}
            className={FORM_CONTROL_CLASS}
          />
        </FormRow>
        <FormRow label="Nhu cầu đặc biệt và lưu ý chăm sóc">
          <input
            value={form.special_needs_note ?? ''}
            onChange={(event) => update({ special_needs_note: event.target.value || null })}
            className={FORM_CONTROL_CLASS}
          />
        </FormRow>
        <FormRow label="Đồng ý sử dụng hình ảnh" error={errors.photo_consent}>
          <select
            value={form.photo_consent}
            onChange={(event) => update({ photo_consent: event.target.value as PhotoConsent })}
            className={FORM_CONTROL_CLASS}
          >
            <option value="">Chọn</option>
            {(Object.keys(PHOTO_CONSENT_LABELS) as PhotoConsent[]).map((key) => (
              <option key={key} value={key}>
                {PHOTO_CONSENT_LABELS[key]}
              </option>
            ))}
          </select>
        </FormRow>
        {form.photo_consent === 'granted' ? (
          <FormRow label="Bản chụp giấy đồng ý ký tay" error={errors.photo_consent_file_id}>
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
          </FormRow>
        ) : null}
        {form.photo_consent === 'granted' && form.photo_consent_file_id ? (
          <p className="text-label text-success md:pl-[12.75rem]">Đã tải lên giấy đồng ý</p>
        ) : null}
        <FormRow label="Học sinh là con của nhân sự trong trường">
          <input
            type="checkbox"
            className="h-4 w-4 justify-self-start"
            checked={form.is_staff_child}
            onChange={(event) => update({ is_staff_child: event.target.checked })}
          />
        </FormRow>
        {form.is_staff_child ? (
          <>
            <FormRow label="Vai trò của nhân sự">
              <select
                value={form.related_staff_role_code ?? 'VT-07'}
                onChange={(event) =>
                  update({ related_staff_role_code: event.target.value, related_staff_user_id: null })
                }
                className={FORM_CONTROL_CLASS}
              >
                {STAFF_ROLES.map((role) => (
                  <option key={role.code} value={role.code}>
                    {role.label}
                  </option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Nhân sự liên quan" error={errors.related_staff_user_id}>
              <select
                value={form.related_staff_user_id ?? ''}
                onChange={(event) => update({ related_staff_user_id: event.target.value || null })}
                className={FORM_CONTROL_CLASS}
              >
                <option value="">Chọn nhân sự</option>
                {(staff.data ?? []).map((entry) => (
                  <option key={entry.user_id} value={entry.user_id}>
                    {entry.full_name}
                  </option>
                ))}
              </select>
            </FormRow>
          </>
        ) : null}
        <FormRow label="Ghi chú">
          <input
            value={form.note ?? ''}
            onChange={(event) => update({ note: event.target.value || null })}
            className={FORM_CONTROL_CLASS}
          />
        </FormRow>
      </FormBlock>

      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={create.isPending || upload.isPending}>
          {create.isPending ? 'Đang ghi…' : 'Ghi'}
        </Button>
        <Button variant="text" onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </form>
  );
}
