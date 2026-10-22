import type { SchoolLevelCode } from '@school-management/shared';
import { FORM_CONTROL_CLASS } from '@school-management/ui';
import { useEnabledSchoolLevels } from './enabled-levels.js';

// Bộ chọn cấp của thống kê, báo cáo, biểu phí (DT-19 phần 19d, YCTD-154): chỉ hiện ở trường bật từ hai cấp; trống là mọi cấp
// người dùng được xem. Trường một cấp không thấy bộ chọn nên màn hình giữ như cũ
export function LevelSelect({
  value,
  onChange,
  allLabel = 'Tất cả cấp',
}: {
  value: SchoolLevelCode | '';
  onChange(value: SchoolLevelCode | ''): void;
  allLabel?: string | null;
}) {
  const { levels, multiLevel } = useEnabledSchoolLevels();
  if (!multiLevel) {
    return null;
  }
  return (
    <label className="flex flex-col gap-2 text-label font-medium text-text">
      Cấp học
      <select
        className={FORM_CONTROL_CLASS}
        value={value}
        onChange={(event) => onChange(event.target.value as SchoolLevelCode | '')}
      >
        {allLabel === null ? null : <option value="">{allLabel}</option>}
        {levels.map((level) => (
          <option key={level.value} value={level.value}>
            {level.label}
          </option>
        ))}
      </select>
    </label>
  );
}
