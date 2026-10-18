import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, ConfirmDialog } from '@school-management/ui';
import { listChildren } from '../children/children-api.js';
import { searchClasses } from '../classes/classes-api.js';
import { messageOf } from '../imports/import-api.js';
import { ApiError } from '../session/api-client.js';
import { bulkTransferClass } from './students-api.js';

// Chuyển lớp hàng loạt (mục 4.2 của Sở "chọn nhanh lớp mới cho nhiều trẻ", DT-16 phần 16g): chọn lớp hiện tại, mỗi học sinh
// chọn lớp mới cùng đơn vị (hoặc áp một lớp cho tất cả), ngày hiệu lực, lý do; vượt sĩ số thì hỏi xác nhận như chuyển từng
// học sinh (BR-04)
const selectClass = 'mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';

export function BulkTransferDialog({ onDone, onCancel }: { onDone(message: string): void; onCancel(): void }) {
  const [sourceId, setSourceId] = useState('');
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [fromDate, setFromDate] = useState('');
  const classes = useQuery({
    queryKey: ['classes', 'search', 'active'],
    queryFn: () => searchClasses({ status: 'active' }),
  });
  const source = classes.data?.find((item) => item.id === sourceId);
  const sameUnit = (classes.data ?? []).filter(
    (item) => item.org_unit_id === source?.org_unit_id && item.id !== sourceId,
  );
  const students = useQuery({
    queryKey: ['children', 'bulk-transfer', sourceId],
    queryFn: () => listChildren({ class_id: sourceId, status: 'active', page: 1, pageSize: 200 }),
    enabled: Boolean(sourceId),
  });
  const items = Object.entries(targets)
    .filter(([, classId]) => classId)
    .map(([childId, classId]) => ({ child_id: childId, class_id: classId }));
  const save = useMutation({
    mutationFn: (confirmOver: boolean) =>
      bulkTransferClass({
        items,
        reason: reason.trim(),
        from_date: fromDate || undefined,
        confirm_over_capacity: confirmOver,
      }),
    onSuccess: (result) => onDone(`Đã chuyển lớp cho ${result.transferred} học sinh`),
  });
  // Lỗi vượt sĩ số (BR-04) hỏi xác nhận rồi gửi lại
  const overCapacity = save.error instanceof ApiError && save.error.message.includes('sĩ số');

  return (
    <ConfirmDialog
      open
      title="Chuyển lớp hàng loạt"
      confirmLabel={overCapacity ? 'Vẫn chuyển lớp' : 'Chuyển lớp'}
      busy={save.isPending || items.length === 0 || !reason.trim()}
      onCancel={onCancel}
      onConfirm={() => save.mutate(overCapacity)}
    >
      <div className="flex flex-col gap-3">
        <label className="text-label font-medium text-text">
          Lớp hiện tại
          <select
            aria-label="Lớp hiện tại"
            value={sourceId}
            onChange={(event) => {
              setSourceId(event.target.value);
              setTargets({});
            }}
            className={selectClass}
          >
            <option value="">Chọn lớp</option>
            {(classes.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} – {item.org_unit_name}
              </option>
            ))}
          </select>
        </label>
        {sourceId ? (
          <label className="text-label font-medium text-text">
            Áp dụng lớp mới cho tất cả
            <select
              aria-label="Áp dụng lớp mới cho tất cả"
              value=""
              onChange={(event) =>
                setTargets(Object.fromEntries((students.data?.items ?? []).map((row) => [row.id, event.target.value])))
              }
              className={selectClass}
            >
              <option value="">Chọn lớp mới</option>
              {sameUnit.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {sourceId ? (
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-content" aria-label="Học sinh chuyển lớp">
              <thead className="text-left text-label font-medium text-text-secondary">
                <tr>
                  <th className="px-3 py-1">Họ tên</th>
                  <th className="px-3 py-1">Lớp mới</th>
                </tr>
              </thead>
              <tbody>
                {(students.data?.items ?? []).map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-3 py-1">{row.full_name}</td>
                    <td className="px-3 py-1">
                      <select
                        aria-label={`Lớp mới của ${row.full_name}`}
                        value={targets[row.id] ?? ''}
                        onChange={(event) => setTargets((current) => ({ ...current, [row.id]: event.target.value }))}
                        className={selectClass}
                      >
                        <option value="">Giữ nguyên</option>
                        {sameUnit.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <label className="text-label font-medium text-text">
          Ngày hiệu lực (để trống là hôm nay)
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className={selectClass}
          />
        </label>
        <label className="text-label font-medium text-text">
          Lý do
          <input value={reason} onChange={(event) => setReason(event.target.value)} className={selectClass} />
        </label>
        {save.error ? <Alert tone={overCapacity ? 'warning' : 'danger'}>{messageOf(save.error)}</Alert> : null}
      </div>
    </ConfirmDialog>
  );
}
