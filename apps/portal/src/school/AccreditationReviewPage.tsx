import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
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

// 1.7. Rà soát thông tin kiểm định chất lượng giáo dục theo Sở (DT-16 phần 16e, khảo sát mục 3.1 dòng 1.7): biểu mẫu theo
// khối, nhãn bên trái. "Lấy dữ liệu" điền số tính từ lớp, phòng, học sinh, hồ sơ trường (chưa ghi); người dùng sửa được rồi
// bấm "Ghi" để lưu bản rà soát của năm học
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

type FigureKey = keyof AccreditationFigures;

const FIELDS: Array<{ key: FigureKey; label: string; decimal: boolean }> = [
  { key: 'class_count', label: 'Số lớp', decimal: false },
  { key: 'classroom_count', label: 'Số phòng học', decimal: false },
  { key: 'subject_room_count', label: 'Số phòng bộ môn', decimal: false },
  { key: 'land_area_m2', label: 'Diện tích đất (m²)', decimal: true },
  { key: 'floor_area_m2', label: 'Diện tích sàn (m²)', decimal: true },
  { key: 'child_count', label: 'Số học sinh', decimal: false },
  { key: 'area_per_child_m2', label: 'Diện tích trên học sinh (m²/học sinh)', decimal: true },
];

const EMPTY: Record<FigureKey, string> = {
  class_count: '',
  classroom_count: '',
  subject_room_count: '',
  land_area_m2: '',
  floor_area_m2: '',
  child_count: '',
  area_per_child_m2: '',
};

const toText = (figures: AccreditationFigures): Record<FigureKey, string> =>
  Object.fromEntries(
    FIELDS.map((field) => [field.key, figures[field.key] === null ? '' : String(figures[field.key])]),
  ) as Record<FigureKey, string>;

export function AccreditationReviewPage() {
  const canManage = useHasPermission(PERMISSION_CODES.schoolProfileManage);
  const queryClient = useQueryClient();
  const review = useQuery({ queryKey: ['accreditation-review'], queryFn: readAccreditationReview });
  const [values, setValues] = useState<Record<FigureKey, string>>(EMPTY);
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
          FIELDS.map((field) => {
            const text = values[field.key].trim().replace(',', '.');
            // Chữ không phải số gửi nguyên để máy chủ báo lỗi ở đúng ô
            return [field.key, text === '' ? null : Number.isNaN(Number(text)) ? text : Number(text)];
          }),
        ) as unknown as AccreditationFigures),
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
          <FormBlock title="Thông tin kiểm định chất lượng giáo dục">
            {FIELDS.map((field) => (
              <FormRow key={field.key} label={field.label} error={fieldError(field.key)}>
                <input
                  className={FORM_CONTROL_CLASS}
                  inputMode={field.decimal ? 'decimal' : 'numeric'}
                  value={values[field.key]}
                  disabled={!canManage}
                  onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
                />
              </FormRow>
            ))}
            <FormRow label="Ghi chú" error={fieldError('note')}>
              <textarea
                className={FORM_CONTROL_CLASS}
                rows={3}
                value={note}
                disabled={!canManage}
                onChange={(event) => setNote(event.target.value)}
              />
            </FormRow>
          </FormBlock>
          <p className="text-label text-text-secondary">
            Lấy dữ liệu: số lớp đang dùng; phòng học là phòng sinh hoạt chung, phòng bộ môn là phòng giáo dục thể chất, nghệ
            thuật, đa chức năng, tiếng Anh, tin học (khai báo ở Cơ sở vật chất 1.1); diện tích đất ở 1.1 Hồ sơ trường; diện
            tích sàn là tổng diện tích các phòng đang dùng; số học sinh đang học; diện tích trên học sinh là diện tích đất
            chia số học sinh.
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
