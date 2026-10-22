import { useQuery } from '@tanstack/react-query';
import { SCHOOL_LEVELS, type SchoolLevelCode } from '@school-management/shared';
import { listSchoolLevels } from './school-levels-api.js';

// Cấp đang bật của trường theo thứ tự (DT-19 phần 19b, YCTD-152), dùng chung khóa truy vấn với 1.4 Cấu hình trường. Chưa tải
// xong hoặc không đọc được thì coi trường chỉ có Mầm non để màn hình của trường mầm non giữ như cũ. multiLevel là trường bật
// từ hai cấp trở lên
export function useEnabledSchoolLevels(): {
  levels: Array<{ value: SchoolLevelCode; label: string }>;
  multiLevel: boolean;
} {
  const query = useQuery({ queryKey: ['school-levels'], queryFn: listSchoolLevels });
  const enabled = (query.data?.levels ?? []).filter((level) => level.is_enabled);
  const levels =
    enabled.length > 0
      ? enabled.map((level) => ({ value: level.code, label: level.display_name }))
      : SCHOOL_LEVELS.filter((level) => level.value === 'MN').map((level) => ({
          value: level.value,
          label: level.label,
        }));
  return { levels, multiLevel: levels.length > 1 };
}
