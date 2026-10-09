import type { Migration } from 'kysely/migration';
import { migration as setTimezone } from './migrations/0001_set_timezone.js';

// Danh sách tệp thay đổi cấu trúc của cơ sở dữ liệu định danh, theo số thứ tự (QU-01)
export const identityMigrations: Record<string, Migration> = {
  '0001_set_timezone': setTimezone,
};
