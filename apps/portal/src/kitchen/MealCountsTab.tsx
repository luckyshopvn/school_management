import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, TextField } from '@school-management/ui';
import { readKitchenMealCounts, type KitchenDay } from '../reports/attendance-meals-api.js';
import { messageOf, vietnamToday } from './kitchen-api.js';

// Suất ăn theo lớp và khối cho bếp (YCTD-100): số trẻ có mặt những ngày ăn của một ngày hoặc một tuần, cùng số liệu với
// báo cáo điểm danh và suất ăn. Hôm nay tính theo điểm danh đã lưu đến lúc xem, kèm số trẻ chưa điểm danh để bếp dự tính
export function MealCountsTab({ orgUnitId }: { orgUnitId: string }) {
  const [period, setPeriod] = useState<'day' | 'week'>('day');
  const [date, setDate] = useState(vietnamToday());
  const counts = useQuery({
    queryKey: ['kitchen-meal-counts', orgUnitId, period, date],
    queryFn: () => readKitchenMealCounts({ org_unit_id: orgUnitId, period, date }),
    enabled: date !== '',
    retry: false,
  });
  const data = counts.data;
  const days = (data?.days ?? []).filter((day) => day.counted);
  const cell = (day: KitchenDay | undefined, date: string) => {
    if (!day) {
      return '';
    }
    if (date === data?.today && day.pending > 0) {
      return `${day.meal_count} (+${day.pending} chưa điểm danh)`;
    }
    return String(day.meal_count);
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-2" role="group" aria-label="Xem suất ăn theo">
          {(
            [
              ['day', 'Một ngày'],
              ['week', 'Cả tuần'],
            ] as const
          ).map(([code, label]) => (
            <Button
              key={code}
              type="button"
              aria-pressed={period === code}
              variant={period === code ? 'primary' : 'secondary'}
              onClick={() => setPeriod(code)}
            >
              {label}
            </Button>
          ))}
        </div>
        <TextField label="Ngày" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </div>
      {counts.error ? <Alert tone="danger">{messageOf(counts.error)}</Alert> : null}
      {data?.note ? <Alert tone="info">{data.note}</Alert> : null}
      {data && days.length === 0 ? (
        <p className="text-content text-text-secondary">Không có ngày ăn nào trong kỳ đã chọn.</p>
      ) : null}
      {data && days.length > 0 ? (
        <table className="w-full text-content" aria-label="Suất ăn theo lớp và khối">
          <thead>
            <tr className="text-left text-text-secondary">
              <th className="py-2">Lớp, khối</th>
              {days.map((day) => (
                <th key={day.date} className="whitespace-nowrap">
                  {day.weekday} {day.date.slice(8, 10)}/{day.date.slice(5, 7)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.classes.map((row) => (
              <tr key={row.class_id} className="border-t border-border">
                <td className="py-2">{row.class_name}</td>
                {days.map((day) => (
                  <td key={day.date}>
                    {cell(
                      row.days.find((item) => item.date === day.date),
                      day.date,
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {[...data.groups, { kind: 'unit', key: 'all', label: 'Cả đơn vị', days: data.totals.days }].map((group) => (
              <tr key={`${group.kind}-${group.key}`} className="border-t border-border font-semibold">
                <td className="py-2">{group.label}</td>
                {days.map((day) => (
                  <td key={day.date}>
                    {cell(
                      group.days.find((item) => item.date === day.date),
                      day.date,
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
