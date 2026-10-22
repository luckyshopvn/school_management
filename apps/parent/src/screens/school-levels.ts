import { useEffect, useState } from 'react';
import { SCHOOL_LEVELS, levelOf, type SchoolLevelCode } from '@school-management/shared';
import { requestJson } from '../session/api-client.js';

// Tên cấp học hiển thị (DT-19 phần 19e): lấy tên trường đặt ở 1.4 Cấu hình trường; chưa tải được thì dùng tên cấp mặc định
export function useSchoolLevelNames(): (level: unknown) => string {
  const [names, setNames] = useState<Partial<Record<SchoolLevelCode, string>>>({});
  useEffect(() => {
    requestJson<{ school_levels: Array<{ code: SchoolLevelCode; display_name: string }> }>(
      '/api/v1/portal-context/school-levels',
    )
      .then((result) =>
        setNames(Object.fromEntries(result.school_levels.map((level) => [level.code, level.display_name]))),
      )
      .catch(() => setNames({}));
  }, []);
  return (level) => {
    const code = levelOf(level);
    return names[code] ?? SCHOOL_LEVELS.find((item) => item.value === code)?.label ?? code;
  };
}
