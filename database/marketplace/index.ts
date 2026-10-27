import type { Migration } from 'kysely/migration';
import { migrations } from './migrations.generated.js';

// Tệp thay đổi cấu trúc của cơ sở dữ liệu chợ gia sư (DT-27 phần 27f, YCTD-256): mọi tệp trong thư mục migrations/, Kysely chạy theo
// thứ tự tên; chỉ mục migrations.generated.ts do database/sinh-chi-muc.mjs sinh khi dựng (YCTD-294)
export const marketplaceMigrations: Record<string, Migration> = migrations;
