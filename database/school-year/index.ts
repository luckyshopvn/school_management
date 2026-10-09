import type { Migration } from 'kysely/migration';
import { migration as setTimezone } from './migrations/0001_set_timezone.js';

// Danh sách tệp thay đổi cấu trúc của cơ sở dữ liệu năm học, theo số thứ tự (QU-01, QU-11)
export const schoolYearMigrations: Record<string, Migration> = {
  '0001_set_timezone': setTimezone,
};
