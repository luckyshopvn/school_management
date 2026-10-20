import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { KPI_PERIOD_TYPE_LABELS, type KpiRuleConfig } from '@school-management/shared';
import { FORM_CONTROL_CLASS } from '@school-management/ui';
import { listPeriods, readRuleVersion, type Period } from './kpi-api.js';

// Phần dùng chung của các trang KPI (DT-18 phần 18d): chọn kỳ (mặc định kỳ đang mở mới nhất), đọc cấu hình của phiên bản
// quy tắc để hiện tên mức, trục, hệ số
export const filterClass = `mt-1 ${FORM_CONTROL_CLASS}`;

export function usePeriodChoice(): {
  periods: Period[];
  period: Period | undefined;
  select(id: string): void;
  isPending: boolean;
  error: Error | null;
} {
  const periods = useQuery({ queryKey: ['kpi', 'periods'], queryFn: listPeriods });
  const [chosen, setChosen] = useState<string>();
  const list = periods.data ?? [];
  const period = list.find((item) => item.id === chosen) ?? list.find((item) => item.status === 'open') ?? list[0];
  return { periods: list, period, select: setChosen, isPending: periods.isPending, error: periods.error };
}

export function PeriodSelect({ choice }: { choice: ReturnType<typeof usePeriodChoice> }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1 md:max-w-md">
      <label htmlFor={id} className="text-label font-medium text-text">
        Kỳ đánh giá
      </label>
      <select
        id={id}
        className={FORM_CONTROL_CLASS}
        value={choice.period?.id ?? ''}
        onChange={(event) => choice.select(event.target.value)}
      >
        {choice.periods.map((period) => (
          <option key={period.id} value={period.id}>
            {period.name} ({KPI_PERIOD_TYPE_LABELS[period.period_type] ?? period.period_type}
            {period.status === 'locked' ? ', đã khóa' : ''})
          </option>
        ))}
      </select>
      {choice.periods.length === 0 && !choice.isPending ? (
        <span className="text-label text-text-secondary">Chưa có kỳ đánh giá.</span>
      ) : null}
    </div>
  );
}

export function useRuleConfig(versionId: string | null | undefined): KpiRuleConfig | undefined {
  const version = useQuery({
    queryKey: ['kpi', 'rule-version', versionId],
    queryFn: () => readRuleVersion(versionId!),
    enabled: Boolean(versionId),
    staleTime: 5 * 60_000,
  });
  return version.data?.config;
}

export const SUBJECT_GROUP_LABELS: Record<string, string> = { leader: 'Lãnh đạo, quản lý', staff: 'Cán bộ, viên chức' };

export function displayName(task: { name: string; is_confidential: boolean }): string {
  return task.is_confidential ? `(Mật) ${task.name}` : task.name;
}
