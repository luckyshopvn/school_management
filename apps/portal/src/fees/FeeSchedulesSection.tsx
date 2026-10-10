import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, StatusBadge, TextField } from '@school-management/ui';
import { listGradeLevels } from '../catalogs/catalogs-api.js';
import { ApiError } from '../session/api-client.js';
import {
  createFeeSchedule,
  deleteFeeSchedule,
  formatMoney,
  listFeeSchedules,
  replaceFeeSchedule,
  type FeeSchedule,
  type FeeScheduleItem,
  type Service,
} from './fees-api.js';

// Biểu phí theo phiên bản trong MH-04 (P05-01, BR-17, BR-18): lưới bậc học nhân khoản phí; phiên bản chưa tới ngày hiệu lực
// sửa và xóa được, phiên bản đã có hiệu lực chỉ xem
const TUITION = 'tuition';

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const cellKey = (gradeLevel: string, column: string) => `${gradeLevel}|${column}`;

function toCells(items: FeeScheduleItem[]): Record<string, string> {
  return Object.fromEntries(
    items.map((item) => [cellKey(item.grade_level, item.service_id ?? TUITION), String(item.amount)]),
  );
}

function toItems(cells: Record<string, string>): FeeScheduleItem[] {
  return Object.entries(cells)
    .filter(([, value]) => value.trim() !== '')
    .map(([key, value]) => {
      const [gradeLevel = '', column = ''] = key.split('|');
      return {
        grade_level: gradeLevel,
        fee_type: column === TUITION ? 'tuition' : 'service',
        service_id: column === TUITION ? null : column,
        amount: Number(value),
      };
    });
}

export function FeeSchedulesSection({
  services,
  canManage,
  onChanged,
}: {
  services: Service[];
  canManage: boolean;
  onChanged(message: string): void;
}) {
  const queryClient = useQueryClient();
  const schedules = useQuery({ queryKey: ['fee-schedules'], queryFn: listFeeSchedules });
  const gradeLevels = useQuery({ queryKey: ['grade-levels'], queryFn: listGradeLevels });
  const [form, setForm] = useState<{
    editingId?: string;
    name: string;
    month: string;
    cells: Record<string, string>;
  }>();
  const activeServices = services.filter((service) => service.status === 'active');
  const columns = [{ id: TUITION, label: 'Học phí chính khóa (tháng)' }].concat(
    activeServices.map((service) => ({ id: service.id, label: `${service.name} (${service.unit})` })),
  );
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['fee-schedules'] });

  const save = useMutation({
    mutationFn: async () => {
      if (!form) {
        return;
      }
      const items = toItems(form.cells);
      if (form.editingId) {
        await replaceFeeSchedule(form.editingId, { name: form.name, items });
      } else {
        await createFeeSchedule({ name: form.name, effective_from: `${form.month}-01`, items });
      }
    },
    onSuccess: async () => {
      setForm(undefined);
      await refresh();
      onChanged('Đã lưu biểu phí');
    },
  });
  const remove = useMutation({
    mutationFn: (schedule: FeeSchedule) => deleteFeeSchedule(schedule.id),
    onSuccess: async () => {
      await refresh();
      onChanged('Đã xóa phiên bản biểu phí');
    },
  });

  const latest = schedules.data?.[0];
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4" aria-label="Biểu phí">
      <div className="flex items-center justify-between">
        <h2 className="text-section-title font-semibold text-text">Biểu phí</h2>
        {canManage && !form ? (
          <Button
            variant="primary"
            onClick={() => setForm({ name: '', month: '', cells: latest ? toCells(latest.items) : {} })}
          >
            Tạo phiên bản biểu phí
          </Button>
        ) : null}
      </div>
      <p className="text-label text-text-secondary">
        Dùng chung cho mọi đơn vị. Phiên bản mới có hiệu lực từ ngày 1 của tháng chọn; phiên bản trước tự kết thúc. Biểu
        phí đã có hiệu lực không sửa được.
      </p>
      {form ? (
        <div
          className="flex flex-col gap-3 rounded-lg border border-border p-3"
          role="group"
          aria-label="Biểu mẫu biểu phí"
        >
          {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <TextField
              label="Tên biểu phí"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
            {form.editingId ? null : (
              <TextField
                label="Hiệu lực từ tháng"
                type="month"
                value={form.month}
                onChange={(event) => setForm({ ...form, month: event.target.value })}
              />
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-content">
              <thead className="text-left text-label font-medium text-text-secondary">
                <tr>
                  <th className="px-2 py-2">Bậc học</th>
                  {columns.map((column) => (
                    <th key={column.id} className="px-2 py-2">
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(gradeLevels.data ?? [])
                  .filter((grade) => grade.status === 'active')
                  .map((grade) => (
                    <tr key={grade.code} className="border-t border-border">
                      <td className="px-2 py-2 font-medium">{grade.name}</td>
                      {columns.map((column) => (
                        <td key={column.id} className="px-2 py-2">
                          <input
                            type="number"
                            min={0}
                            aria-label={`${column.label} ${grade.name}`}
                            value={form.cells[cellKey(grade.code, column.id)] ?? ''}
                            onChange={(event) =>
                              setForm({
                                ...form,
                                cells: { ...form.cells, [cellKey(grade.code, column.id)]: event.target.value },
                              })
                            }
                            className="w-32 rounded-lg border border-border bg-card px-2 py-1 text-content"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
              Lưu biểu phí
            </Button>
            <Button variant="text" onClick={() => setForm(undefined)}>
              Hủy
            </Button>
          </div>
        </div>
      ) : null}
      {schedules.error ? <Alert tone="danger">{messageOf(schedules.error)}</Alert> : null}
      {remove.error ? <Alert tone="danger">{messageOf(remove.error)}</Alert> : null}
      {schedules.data && schedules.data.length === 0 ? (
        <p className="text-content text-text-secondary">Chưa có biểu phí.</p>
      ) : null}
      {(schedules.data ?? []).map((schedule) => (
        <article
          key={schedule.id}
          className="flex flex-col gap-2 rounded-lg border border-border p-3"
          aria-label={`Biểu phí ${schedule.name}`}
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold">{schedule.name}</span>
            <span className="text-label text-text-secondary">
              Từ {schedule.effective_from}
              {schedule.effective_to ? ` đến ${schedule.effective_to}` : ''}
            </span>
            <StatusBadge
              tone={schedule.is_editable ? 'info' : 'success'}
              label={schedule.is_editable ? 'Chưa hiệu lực' : 'Đã có hiệu lực'}
            />
            {canManage && schedule.is_editable ? (
              <>
                <Button
                  variant="text"
                  onClick={() =>
                    setForm({
                      editingId: schedule.id,
                      name: schedule.name,
                      month: schedule.effective_from.slice(0, 7),
                      cells: toCells(schedule.items),
                    })
                  }
                >
                  Sửa
                </Button>
                {schedule.effective_to === null ? (
                  <Button variant="text" disabled={remove.isPending} onClick={() => remove.mutate(schedule)}>
                    Xóa
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
          <table className="w-full text-content">
            <thead className="text-left text-label font-medium text-text-secondary">
              <tr>
                <th className="px-2 py-1">Bậc học</th>
                <th className="px-2 py-1">Khoản phí</th>
                <th className="px-2 py-1 text-right">Mức phí</th>
              </tr>
            </thead>
            <tbody>
              {schedule.items.map((item) => (
                <tr key={cellKey(item.grade_level, item.service_id ?? TUITION)} className="border-t border-border">
                  <td className="px-2 py-1">
                    {gradeLevels.data?.find((grade) => grade.code === item.grade_level)?.name ?? item.grade_level}
                  </td>
                  <td className="px-2 py-1">
                    {item.fee_type === 'tuition' ? 'Học phí chính khóa' : item.service_name}
                  </td>
                  <td className="px-2 py-1 text-right">{formatMoney(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      ))}
    </section>
  );
}
