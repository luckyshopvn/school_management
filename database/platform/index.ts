import type { Migration } from 'kysely/migration';
import { migrations } from './migrations.generated.js';

// Tệp thay đổi cấu trúc của cơ sở dữ liệu nền tảng: mọi tệp trong thư mục migrations/, Kysely chạy theo thứ tự tên (QU-01). Thêm tệp
// mới vào thư mục là đủ, không sửa danh sách nào; chỉ mục migrations.generated.ts do database/sinh-chi-muc.mjs sinh khi dựng (YCTD-294)
export const platformMigrations: Record<string, Migration> = migrations;
