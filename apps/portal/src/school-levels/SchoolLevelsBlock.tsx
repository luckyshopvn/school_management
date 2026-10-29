import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, FORM_CONTROL_CLASS } from '@school-management/ui';
import { ApiError } from '../session/api-client.js';
import {
  listSchoolLevels,
  saveSchoolLevels,
  type SchoolLevelInput,
  type SchoolLevelListItem,
} from './school-levels-api.js';

// Thẻ "Cấp học của trường" ở 1.4 Cấu hình trường (DT-19 phần 19a, YCTD-151): bật, tắt, thứ tự, tên hiển thị, thuật ngữ gọi
// người học, nhãn ô ngữ cảnh của bốn cấp cố định. Cấp không xóa được; tắt cấp đang có lớp chỉ ẩn, dữ liệu giữ nguyên (BR-154).
// Máy chủ kiểm tra giá trị và quyền P01.school-level.manage
function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

export function SchoolLevelsBlock({ editable, onSaved }: { editable: boolean; onSaved(message: string): void }) {
  const levels = useQuery({ queryKey: ['school-levels'], queryFn: listSchoolLevels });
  if (levels.isPending) {
    return <div className="h-40 animate-pulse rounded bg-border" aria-hidden="true" />;
  }
  if (levels.isError) {
    return null;
  }
  return <SchoolLevelsForm levels={levels.data.levels} editable={editable} onSaved={onSaved} />;
}

// Giá trị ban đầu lấy một lần khi đã tải xong để lần tải lại không xóa chữ người dùng đang nhập
function SchoolLevelsForm({
  levels,
  editable,
  onSaved,
}: {
  levels: SchoolLevelListItem[];
  editable: boolean;
  onSaved(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<Array<SchoolLevelInput & { order_text: string; class_count: number }>>(() =>
    levels.map((level) => ({
      code: level.code,
      is_enabled: level.is_enabled,
      order_no: level.order_no,
      order_text: String(level.order_no),
      display_name: level.display_name,
      learner_term: level.learner_term,
      context_label: level.context_label,
      class_count: level.class_count,
    })),
  );
  const change = (code: string, changes: Partial<(typeof rows)[number]>) =>
    setRows((current) => current.map((row) => (row.code === code ? { ...row, ...changes } : row)));
  const save = useMutation({
    mutationFn: () =>
      saveSchoolLevels(
        rows.map((row) => ({
          code: row.code,
          is_enabled: row.is_enabled,
          order_no: Number(row.order_text),
          display_name: row.display_name,
          learner_term: row.learner_term,
          context_label: row.context_label,
        })),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['school-levels'] });
      await queryClient.invalidateQueries({ queryKey: ['portal-context'] });
      onSaved('Đã ghi cấp học của trường');
    },
  });
  const fieldError = (index: number, field: string) =>
    save.error instanceof ApiError
      ? save.error.details.find((detail) => detail.field === `levels[${index}].${field}`)?.message
      : undefined;
  const hiddenWithClasses = rows.filter((row) => !row.is_enabled && row.class_count > 0);
  return (
    <section
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
      aria-label="Cấp học của trường"
    >
      {save.error &&
      !(save.error instanceof ApiError && save.error.details.some((detail) => detail.field !== 'levels')) ? (
        <Alert tone="danger">
          {save.error instanceof ApiError && save.error.details.length > 0
            ? save.error.details.map((detail) => detail.message).join('; ')
            : messageOf(save.error)}
        </Alert>
      ) : null}
      <div>
        <h3 className="text-content font-semibold text-text">Cấp học của trường</h3>
        <p className="text-label text-text-secondary">
          Bật ít nhất một cấp. Cấp không xóa được; tắt cấp chỉ ẩn, lớp và học sinh giữ nguyên.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-content">
          <thead>
            <tr className="text-left text-label text-text-secondary">
              <th className="px-3 py-2">Bật</th>
              <th className="px-3 py-2">Mã</th>
              <th className="px-3 py-2">Thứ tự</th>
              <th className="px-3 py-2">Tên hiển thị</th>
              <th className="px-3 py-2">Gọi người học</th>
              <th className="px-3 py-2">Nhãn ô ngữ cảnh</th>
              <th className="px-3 py-2">Số lớp năm học này</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.code} className="border-t border-border" data-testid={`school-level-${row.code}`}>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    aria-label={`Bật cấp ${row.code}`}
                    checked={row.is_enabled}
                    disabled={!editable}
                    onChange={(event) => change(row.code, { is_enabled: event.target.checked })}
                  />
                </td>
                <td className="px-3 py-2 font-medium">{row.code}</td>
                <td className="px-3 py-2">
                  <input
                    className={`${FORM_CONTROL_CLASS} w-20`}
                    aria-label={`Thứ tự cấp ${row.code}`}
                    inputMode="numeric"
                    value={row.order_text}
                    disabled={!editable}
                    onChange={(event) => change(row.code, { order_text: event.target.value })}
                  />
                  {fieldError(index, 'order_no') ? (
                    <p className="text-label text-danger">{fieldError(index, 'order_no')}</p>
                  ) : null}
                </td>
                {(['display_name', 'learner_term', 'context_label'] as const).map((field) => (
                  <td key={field} className="px-3 py-2">
                    <input
                      className={FORM_CONTROL_CLASS}
                      aria-label={`${field === 'display_name' ? 'Tên hiển thị' : field === 'learner_term' ? 'Gọi người học' : 'Nhãn ô ngữ cảnh'} cấp ${row.code}`}
                      value={row[field]}
                      disabled={!editable}
                      onChange={(event) => change(row.code, { [field]: event.target.value })}
                    />
                    {fieldError(index, field) ? (
                      <p className="text-label text-danger">{fieldError(index, field)}</p>
                    ) : null}
                  </td>
                ))}
                <td className="px-3 py-2">{row.class_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hiddenWithClasses.length > 0 ? (
        <Alert tone="warning">
          {hiddenWithClasses.map((row) => `Cấp ${row.code} đang có ${row.class_count} lớp`).join('; ')}. Tắt cấp chỉ ẩn
          cấp đó, lớp và học sinh giữ nguyên.
        </Alert>
      ) : null}
      {editable ? (
        <div>
          <Button variant="primary" onClick={() => save.mutate()} disabled={save.isPending}>
            Ghi cấp học
          </Button>
        </div>
      ) : null}
    </section>
  );
}
