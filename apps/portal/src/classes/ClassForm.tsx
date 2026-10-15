import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CLASS_AGE_GROUPS, classAgeGroupLabel, type ClassAgeGroupKey } from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, FormBlock, FormRow } from '@school-management/ui';
import { listGradeLevels, listRooms } from '../catalogs/catalogs-api.js';
import type { OrgUnit } from '../org-units/org-units-api.js';
import { ApiError } from '../session/api-client.js';
import { readSettings } from '../settings/settings-api.js';
import { createClass, listClasses, updateClass, type ClassRecord } from './classes-api.js';

// Biểu mẫu lớp học theo mục 2.1 của Sở (DT-15 phần 15b, YCTD-111): khối Thông tin chung, Thông tin khác theo thứ tự ô của
// Sở; phòng học, sĩ số tối đa là thông tin riêng của trường nên ở khối cuối. Nhóm tuổi để trống là theo khối (bậc học).
// Giáo viên chủ nhiệm phân công ở nút "Giáo viên" của dòng hoặc màn hình 3.3
interface ClassFormValues {
  org_unit_id: string;
  code: string;
  name: string;
  grade_level: string;
  age_group: string;
  sort_order: string;
  two_sessions_per_day: boolean;
  mixed_age_count: string;
  is_combined: boolean;
  combined_into_class_id: string;
  boarding: boolean;
  room_id: string;
  max_size: string;
}

const CHECKBOX_CLASS = 'h-4 w-4';

function valuesOf(classRecord: ClassRecord | undefined, orgUnitId: string): ClassFormValues {
  return {
    org_unit_id: classRecord?.org_unit_id ?? orgUnitId,
    code: classRecord?.code ?? '',
    name: classRecord?.name ?? '',
    grade_level: classRecord?.grade_level ?? '',
    age_group: classRecord && !classRecord.age_group_from_grade ? classRecord.age_group : '',
    sort_order: classRecord?.sort_order === null || !classRecord ? '' : String(classRecord.sort_order),
    two_sessions_per_day: classRecord?.two_sessions_per_day ?? false,
    mixed_age_count: classRecord?.mixed_age_count ? String(classRecord.mixed_age_count) : '',
    is_combined: classRecord?.is_combined ?? false,
    combined_into_class_id: classRecord?.combined_into_class_id ?? '',
    boarding: classRecord?.boarding ?? false,
    room_id: classRecord?.room_id ?? '',
    max_size: classRecord ? String(classRecord.max_size) : '',
  };
}

const toNumber = (text: string) => (text.trim() === '' ? Number.NaN : Number(text));

export function ClassForm({
  classRecord,
  units,
  defaultUnitId,
  onSaved,
  onCancel,
}: {
  // Không truyền là thêm mới
  classRecord?: ClassRecord;
  units: OrgUnit[];
  defaultUnitId: string;
  onSaved(saved: ClassRecord, created: boolean): void;
  onCancel(): void;
}) {
  const [values, setValues] = useState<ClassFormValues>(() => valuesOf(classRecord, defaultUnitId));
  const set = <Key extends keyof ClassFormValues>(key: Key, value: ClassFormValues[Key]) =>
    setValues((current) => ({ ...current, [key]: value }));
  const orgUnitId = values.org_unit_id;
  const gradeLevels = useQuery({ queryKey: ['grade-levels'], queryFn: listGradeLevels });
  const rooms = useQuery({
    queryKey: ['rooms', orgUnitId],
    queryFn: () => listRooms(orgUnitId),
    enabled: orgUnitId !== '',
  });
  const sameUnitClasses = useQuery({
    queryKey: ['classes', orgUnitId],
    queryFn: () => listClasses(orgUnitId),
    enabled: orgUnitId !== '',
  });
  const settings = useQuery({
    queryKey: ['settings', orgUnitId],
    queryFn: () => readSettings(orgUnitId),
    enabled: orgUnitId !== '' && !classRecord,
  });
  // Thêm mới thì điền sẵn sĩ số tối đa theo cấu hình của đơn vị (BR-04); người dùng vẫn sửa được
  const configuredMaxSize = settings.data?.find((setting) => setting.key === 'max_class_size')?.value;
  useEffect(() => {
    if (!classRecord && typeof configuredMaxSize === 'number') {
      setValues((current) => (current.max_size === '' ? { ...current, max_size: String(configuredMaxSize) } : current));
    }
  }, [classRecord, configuredMaxSize]);

  const save = useMutation({
    mutationFn: () => {
      const common = {
        code: values.code,
        name: values.name,
        grade_level: values.grade_level,
        room_id: values.room_id || null,
        max_size: toNumber(values.max_size),
        age_group: (values.age_group || null) as ClassAgeGroupKey | null,
        sort_order: values.sort_order.trim() === '' ? null : toNumber(values.sort_order),
        two_sessions_per_day: values.two_sessions_per_day,
        mixed_age_count: values.mixed_age_count ? Number(values.mixed_age_count) : null,
        is_combined: values.is_combined,
        combined_into_class_id: values.is_combined ? values.combined_into_class_id || null : null,
        boarding: values.boarding,
      };
      return classRecord
        ? updateClass(classRecord.id, common)
        : createClass({ ...common, org_unit_id: values.org_unit_id });
    },
    onSuccess: (saved) => onSaved(saved, !classRecord),
  });
  const error = save.error;
  const fieldErrors =
    error instanceof ApiError ? Object.fromEntries(error.details.map((detail) => [detail.field, detail.message])) : {};
  const activeGrades = (gradeLevels.data ?? []).filter(
    (level) => level.status === 'active' || level.code === values.grade_level,
  );
  const gradeName = activeGrades.find((level) => level.code === values.grade_level)?.name;
  const combineTargets = (sameUnitClasses.data ?? []).filter(
    (item) => item.id !== classRecord?.id && item.status === 'active' && !item.is_combined,
  );
  const title = classRecord ? `Sửa lớp ${classRecord.name}` : 'Thêm mới lớp học';

  return (
    <form
      noValidate
      aria-label={title}
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <h2 className="text-section-title font-semibold text-text">{title}</h2>
      {error ? (
        <Alert tone="danger">
          {error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại'}
        </Alert>
      ) : null}
      <FormBlock title="Thông tin chung">
        <FormRow label="Đơn vị" error={fieldErrors.org_unit_id}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.org_unit_id}
            disabled={Boolean(classRecord)}
            onChange={(event) => setValues({ ...values, org_unit_id: event.target.value, room_id: '' })}
          >
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Mã lớp" error={fieldErrors.code}>
          <input
            className={FORM_CONTROL_CLASS}
            value={values.code}
            onChange={(event) => set('code', event.target.value)}
          />
        </FormRow>
        <FormRow label="Tên lớp" error={fieldErrors.name}>
          <input
            className={FORM_CONTROL_CLASS}
            value={values.name}
            onChange={(event) => set('name', event.target.value)}
          />
        </FormRow>
        <FormRow label="Khối" error={fieldErrors.grade_level}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.grade_level}
            onChange={(event) => set('grade_level', event.target.value)}
          >
            <option value="">Chọn khối</option>
            {activeGrades.map((level) => (
              <option key={level.code} value={level.code}>
                {level.name}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Nhóm tuổi" error={fieldErrors.age_group}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.age_group}
            onChange={(event) => set('age_group', event.target.value)}
          >
            <option value="">{gradeName ? `Theo khối ${gradeName}` : 'Theo khối'}</option>
            {CLASS_AGE_GROUPS.map((group) => (
              <option key={group.key} value={group.key}>
                {group.stage === 'nhom_tre' ? 'Nhóm trẻ' : 'Mẫu giáo'} {classAgeGroupLabel(group.key)}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Thứ tự" error={fieldErrors.sort_order}>
          <input
            className={FORM_CONTROL_CLASS}
            inputMode="numeric"
            value={values.sort_order}
            onChange={(event) => set('sort_order', event.target.value)}
          />
        </FormRow>
        {classRecord ? (
          <FormRow label="Giáo viên chủ nhiệm">
            <span className="text-content text-text">{classRecord.homeroom_names || 'Chưa phân công'}</span>
          </FormRow>
        ) : null}
      </FormBlock>
      <FormBlock title="Thông tin khác">
        <FormRow label="Học 2 buổi/ngày">
          <input
            type="checkbox"
            className={CHECKBOX_CLASS}
            checked={values.two_sessions_per_day}
            onChange={(event) => set('two_sessions_per_day', event.target.checked)}
          />
        </FormRow>
        <FormRow label="Lớp mẫu giáo ghép 2 hoặc 3 độ tuổi" error={fieldErrors.mixed_age_count}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.mixed_age_count}
            onChange={(event) => set('mixed_age_count', event.target.value)}
          >
            <option value="">Không ghép</option>
            <option value="2">Ghép 2 độ tuổi</option>
            <option value="3">Ghép 3 độ tuổi</option>
          </select>
        </FormRow>
        <FormRow label="Lớp ghép">
          <input
            type="checkbox"
            className={CHECKBOX_CLASS}
            checked={values.is_combined}
            onChange={(event) => set('is_combined', event.target.checked)}
          />
        </FormRow>
        <FormRow label="Ghép vào lớp" error={fieldErrors.combined_into_class_id}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.is_combined ? values.combined_into_class_id : ''}
            disabled={!values.is_combined}
            onChange={(event) => set('combined_into_class_id', event.target.value)}
          >
            <option value="">Không chọn</option>
            {combineTargets.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Lớp bán trú">
          <input
            type="checkbox"
            className={CHECKBOX_CLASS}
            checked={values.boarding}
            onChange={(event) => set('boarding', event.target.checked)}
          />
        </FormRow>
      </FormBlock>
      <FormBlock title="Thông tin riêng của trường">
        <FormRow label="Phòng học" error={fieldErrors.room_id}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.room_id}
            onChange={(event) => set('room_id', event.target.value)}
          >
            <option value="">Chưa chọn</option>
            {(rooms.data ?? [])
              .filter((room) => room.status === 'active' || room.id === values.room_id)
              .map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
          </select>
        </FormRow>
        <FormRow label="Sĩ số tối đa" error={fieldErrors.max_size}>
          <input
            className={FORM_CONTROL_CLASS}
            inputMode="numeric"
            value={values.max_size}
            onChange={(event) => set('max_size', event.target.value)}
          />
        </FormRow>
      </FormBlock>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Ghi
        </Button>
        <Button variant="text" onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </form>
  );
}
