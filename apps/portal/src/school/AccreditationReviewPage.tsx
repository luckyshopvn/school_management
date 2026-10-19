import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ACCREDITATION_LEVELS,
  NATIONAL_STANDARD_LEVELS,
  PERMISSION_CODES,
  SCHOOL_OWNERSHIP_TYPES,
} from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, FormBlock, FormRow, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  collectAccreditationFigures,
  readAccreditationReview,
  saveAccreditationReview,
  type AccreditationFigures,
} from './school-api.js';

// 1.7. Rà soát thông tin kiểm định chất lượng giáo dục theo Sở (DT-16 phần 16e; đủ ô như Sở ở DT-17 phần 17e, khảo sát mục
// 10.5): biểu mẫu theo khối, nhãn bên trái, thứ tự ô như Sở. "Lấy dữ liệu" điền thông tin trường, chuẩn quốc gia, kiểm định
// từ hồ sơ trường và số tính từ lớp, phòng, học sinh (chưa ghi); người dùng sửa được rồi bấm "Ghi" để lưu bản rà soát của
// năm học
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

type FieldKey = Exclude<keyof AccreditationFigures, 'education_level'>;
type FieldKind = 'text' | 'choice' | 'integer' | 'decimal' | 'date';

interface Field {
  key: FieldKey;
  label: string;
  kind: FieldKind;
  required?: boolean;
  maxLength?: number;
  options?: ReadonlyArray<{ value: string; label: string }>;
}

// Ghi chú tối đa 500 ký tự như Sở
const MAXIMUM_NOTE_LENGTH = 500;

// Các khối theo thứ tự ô của Sở; cấp học chỉ có Mầm non nên hiển thị cố định giữa loại hình và số lớp
const SCHOOL_FIELDS: Field[] = [
  { key: 'school_name', label: 'Tên trường', kind: 'text', required: true, maxLength: 200 },
  { key: 'school_code', label: 'Mã trường', kind: 'text', required: true, maxLength: 20 },
  { key: 'ownership_type', label: 'Loại hình', kind: 'choice', required: true, options: SCHOOL_OWNERSHIP_TYPES },
];

const BLOCKS: Array<{ title: string; fields: Field[] }> = [
  {
    title: 'Chuẩn quốc gia',
    fields: [
      { key: 'national_standard_year', label: 'Năm công nhận chuẩn quốc gia', kind: 'integer' },
      { key: 'national_standard_date', label: 'Ngày công nhận chuẩn quốc gia', kind: 'date' },
      { key: 'national_standard_level', label: 'Mức độ', kind: 'choice', options: NATIONAL_STANDARD_LEVELS },
    ],
  },
  {
    title: 'Kiểm định chất lượng giáo dục',
    fields: [
      { key: 'accreditation_year', label: 'Năm công nhận kiểm định CLGD', kind: 'integer' },
      { key: 'accreditation_date', label: 'Ngày công nhận kiểm định CLGD', kind: 'date' },
      { key: 'accreditation_level', label: 'Cấp độ', kind: 'choice', options: ACCREDITATION_LEVELS },
    ],
  },
  {
    title: 'Cơ sở vật chất và học sinh',
    fields: [
      { key: 'classroom_count', label: 'Số phòng học', kind: 'integer' },
      { key: 'subject_room_count', label: 'Số phòng bộ môn', kind: 'integer' },
      { key: 'land_area_m2', label: 'Diện tích đất (m²)', kind: 'decimal' },
      { key: 'floor_area_m2', label: 'Diện tích sàn xây dựng (m²)', kind: 'decimal' },
      { key: 'child_count', label: 'Số học sinh', kind: 'integer' },
      { key: 'area_per_child_m2', label: 'Diện tích đất/Học sinh (m²)', kind: 'decimal' },
      { key: 'floor_area_per_child_m2', label: 'Diện tích sàn xây dựng/Học sinh (m²)', kind: 'decimal' },
      {
        key: 'national_standard_registration',
        label: 'Thời điểm đăng ký chuẩn quốc gia',
        kind: 'text',
        maxLength: 100,
      },
    ],
  },
];

const CLASS_COUNT: Field = { key: 'class_count', label: 'Số lớp', kind: 'integer' };
const ALL_FIELDS: Field[] = [...SCHOOL_FIELDS, CLASS_COUNT, ...BLOCKS.flatMap((block) => block.fields)];

type Values = Record<FieldKey, string>;

const EMPTY = Object.fromEntries(ALL_FIELDS.map((field) => [field.key, ''])) as Values;

const toText = (figures: AccreditationFigures): Values =>
  Object.fromEntries(
    ALL_FIELDS.map((field) => [field.key, figures[field.key] === null ? '' : String(figures[field.key])]),
  ) as Values;

// Số gửi dạng số; chữ không phải số gửi nguyên để máy chủ báo lỗi ở đúng ô
function toPayload(field: Field, text: string): string | number | null {
  const trimmed = text.trim();
  if (trimmed === '') {
    return null;
  }
  if (field.kind === 'integer' || field.kind === 'decimal') {
    const number = Number(trimmed.replace(',', '.'));
    return Number.isNaN(number) ? trimmed : number;
  }
  return trimmed;
}

export function AccreditationReviewPage() {
  const canManage = useHasPermission(PERMISSION_CODES.schoolProfileManage);
  const queryClient = useQueryClient();
  const review = useQuery({ queryKey: ['accreditation-review'], queryFn: readAccreditationReview });
  const [values, setValues] = useState<Values>(EMPTY);
  const [note, setNote] = useState('');
  const [collected, setCollected] = useState(false);
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  useEffect(() => {
    if (review.data?.saved) {
      setValues(toText(review.data.saved));
      setNote(review.data.saved.note ?? '');
    }
  }, [review.data]);
  const collect = useMutation({
    mutationFn: collectAccreditationFigures,
    onSuccess: (figures) => {
      setValues(toText(figures));
      setCollected(true);
      setToastMessage('Đã lấy dữ liệu, kiểm tra rồi bấm Ghi để lưu');
    },
  });
  const save = useMutation({
    mutationFn: () =>
      saveAccreditationReview({
        ...(Object.fromEntries(
          ALL_FIELDS.map((field) => [field.key, toPayload(field, values[field.key])]),
        ) as unknown as Omit<AccreditationFigures, 'education_level'>),
        note: note.trim() === '' ? null : note,
        collected,
      }),
    onSuccess: async () => {
      setCollected(false);
      await queryClient.invalidateQueries({ queryKey: ['accreditation-review'] });
      setToastMessage('Đã ghi bản rà soát');
    },
  });
  const fieldError = (key: string) =>
    save.error instanceof ApiError ? save.error.details.find((detail) => detail.field === key)?.message : undefined;
  const saved = review.data?.saved;

  const renderField = (field: Field) => (
    <FormRow key={field.key} label={field.label} error={fieldError(field.key)}>
      {field.kind === 'choice' ? (
        <select
          className={FORM_CONTROL_CLASS}
          value={values[field.key]}
          required={field.required}
          disabled={!canManage}
          onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
        >
          <option value="">Chọn</option>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          className={FORM_CONTROL_CLASS}
          type={field.kind === 'date' ? 'date' : 'text'}
          inputMode={field.kind === 'decimal' ? 'decimal' : field.kind === 'integer' ? 'numeric' : undefined}
          maxLength={field.maxLength}
          required={field.required}
          value={values[field.key]}
          disabled={!canManage}
          onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
        />
      )}
    </FormRow>
  );

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/accreditation-review')}</h1>
        {review.isError ? <Alert tone="danger">{messageOf(review.error)}</Alert> : null}
        {collect.error ? <Alert tone="danger">{messageOf(collect.error)}</Alert> : null}
        {save.error && !(save.error instanceof ApiError && save.error.details.length > 0) ? (
          <Alert tone="danger">{messageOf(save.error)}</Alert>
        ) : null}
        <section
          className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
          aria-label="Thông tin kiểm định chất lượng giáo dục"
        >
          <FormBlock title="Thông tin trường">
            {SCHOOL_FIELDS.map(renderField)}
            <FormRow label="Cấp học">
              <input className={FORM_CONTROL_CLASS} value={saved?.education_level ?? 'Mầm non'} disabled />
            </FormRow>
            {renderField(CLASS_COUNT)}
          </FormBlock>
          {BLOCKS.map((block) => (
            <FormBlock key={block.title} title={block.title}>
              {block.fields.map(renderField)}
            </FormBlock>
          ))}
          <FormBlock title="Ghi chú">
            <FormRow
              label="Trường chưa đạt tiêu chí nào, lý do và nội dung đề nghị hỗ trợ để đạt chuẩn"
              error={fieldError('note')}
            >
              <textarea
                className={FORM_CONTROL_CLASS}
                rows={4}
                maxLength={MAXIMUM_NOTE_LENGTH}
                value={note}
                disabled={!canManage}
                onChange={(event) => setNote(event.target.value)}
              />
            </FormRow>
            <p className="text-label text-text-secondary">
              {note.length}/{MAXIMUM_NOTE_LENGTH} ký tự
            </p>
          </FormBlock>
          <p className="text-label text-text-secondary">
            Lấy dữ liệu: tên trường ở cây đơn vị; mã trường là mã định danh, loại hình, chuẩn quốc gia, kiểm định CLGD,
            diện tích đất, diện tích sàn xây dựng ở 1.1 Hồ sơ trường (chưa nhập diện tích sàn xây dựng thì lấy tổng diện
            tích các phòng đang dùng); số lớp đang dùng; phòng học là phòng sinh hoạt chung, phòng bộ môn là phòng giáo
            dục thể chất, nghệ thuật, đa chức năng, tiếng Anh, tin học (khai báo ở Cơ sở vật chất 1.1); số học sinh đang
            học; diện tích trên học sinh là diện tích chia số học sinh.
            {saved
              ? ` Đã ghi lúc ${new Date(saved.updated_at).toLocaleString('vi-VN')}${saved.collected_at ? `, lấy dữ liệu lúc ${new Date(saved.collected_at).toLocaleString('vi-VN')}` : ''}.`
              : ' Chưa ghi bản rà soát của năm học.'}
          </p>
          {canManage ? (
            <div className="flex flex-wrap gap-3">
              <Button disabled={collect.isPending} onClick={() => collect.mutate()}>
                Lấy dữ liệu
              </Button>
              <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
                Ghi
              </Button>
            </div>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
