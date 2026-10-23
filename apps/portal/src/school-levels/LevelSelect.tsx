import { useState } from 'react';
import type { SchoolLevelCode } from '@school-management/shared';
import { FORM_CONTROL_CLASS } from '@school-management/ui';
import { useEnabledSchoolLevels } from './enabled-levels.js';
import { useWorkingSchoolLevels } from './working-level.js';

// Cấp lọc của thống kê, báo cáo (DT-19 phần 19d, YCTD-154): chọn riêng ở trang, chưa chọn thì theo cấp đang làm việc ở thanh
// đầu trang (19c); trả giá trị gửi lên API qua tham số cấp dùng chung, chuỗi rỗng là mọi cấp người dùng được xem
export function useReportLevel(): {
  value: SchoolLevelCode | '';
  setValue(value: SchoolLevelCode | ''): void;
  effective: SchoolLevelCode | '';
} {
  const [value, setValue] = useState<SchoolLevelCode | ''>('');
  const working = useWorkingSchoolLevels();
  return { value, setValue, effective: value || working.parameter || '' };
}

// Bộ chọn cấp của thống kê, báo cáo, biểu phí: chỉ hiện ở trường bật từ hai cấp; trống là theo cấp đang làm việc (hoặc mọi cấp
// khi thanh đầu trang chọn "Tất cả"). Trường một cấp không thấy bộ chọn nên màn hình giữ như cũ
export function LevelSelect({
  value,
  onChange,
  allLabel,
}: {
  value: SchoolLevelCode | '';
  onChange(value: SchoolLevelCode | ''): void;
  // null là không có lựa chọn trống (biểu mẫu biểu phí); không truyền là nhãn theo cấp đang làm việc
  allLabel?: string | null;
}) {
  const { levels, multiLevel } = useEnabledSchoolLevels();
  const working = useWorkingSchoolLevels();
  if (!multiLevel) {
    return null;
  }
  const workingName = working.working.length === 1 && working.selected ? working.working[0]?.display_name : null;
  const emptyLabel = allLabel ?? (workingName ? `Theo cấp đang làm việc (${workingName})` : 'Tất cả cấp');
  return (
    <label className="flex flex-col gap-2 text-label font-medium text-text">
      Cấp học
      <select
        className={FORM_CONTROL_CLASS}
        value={value}
        onChange={(event) => onChange(event.target.value as SchoolLevelCode | '')}
      >
        {allLabel === null ? null : <option value="">{emptyLabel}</option>}
        {levels.map((level) => (
          <option key={level.value} value={level.value}>
            {level.label}
          </option>
        ))}
      </select>
    </label>
  );
}
