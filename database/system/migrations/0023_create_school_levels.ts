import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Cấp học của trường (DT-19 phần 19a, YCTD-151; tài liệu 47 mục 10.4): một nguồn duy nhất cho "trường này có những cấp
// nào". Bốn mã cố định theo Luật Giáo dục (MN, TH, THCS, THPT), thêm cấp phải sửa mã, không thêm dòng; trường liên cấp là
// trường bật nhiều mã. Mỗi dòng lưu bật hay tắt, thứ tự, tên hiển thị, thuật ngữ gọi người học và nhãn ô ngữ cảnh ở thanh
// đầu trang. Nạp sẵn Mầm non bật, ba cấp còn lại tắt: trường hiện có tự nhận cấp Mầm non, không cần thao tác. Cột
// website_settings.school_levels (18f) giữ làm dự phòng, website đọc cấp từ bảng này
const LEVELS = [
  { code: 'MN', enabled: true, order: 1, name: 'Mầm non', learner: 'Trẻ', label: 'Cấp MN' },
  { code: 'TH', enabled: false, order: 2, name: 'Tiểu học', learner: 'Học sinh', label: 'Cấp TH' },
  { code: 'THCS', enabled: false, order: 3, name: 'Trung học cơ sở', learner: 'Học sinh', label: 'Cấp THCS' },
  { code: 'THPT', enabled: false, order: 4, name: 'Trung học phổ thông', learner: 'Học sinh', label: 'Cấp THPT' },
];

export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('school_levels')
      .addColumn('code', 'text', (column) => column.primaryKey())
      .addColumn('is_enabled', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('order_no', 'smallint', (column) => column.notNull())
      .addColumn('display_name', 'text', (column) => column.notNull())
      .addColumn('learner_term', 'text', (column) => column.notNull())
      .addColumn('context_label', 'text', (column) => column.notNull())
      .addColumn('updated_by_name', 'text')
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('school_levels_code_check', sql`code in ('MN', 'TH', 'THCS', 'THPT')`)
      .addCheckConstraint('school_levels_order_check', sql`order_no between 1 and 99`)
      .addCheckConstraint(
        'school_levels_text_check',
        sql`length(trim(display_name)) between 1 and 100 and length(trim(learner_term)) between 1 and 50
          and length(trim(context_label)) between 1 and 30`,
      )
      .execute();
    for (const level of LEVELS) {
      await sql`insert into school_levels (code, is_enabled, order_no, display_name, learner_term, context_label)
        values (${level.code}, ${level.enabled}, ${level.order}, ${level.name}, ${level.learner}, ${level.label})
        on conflict (code) do nothing`.execute(database);
    }
  },
  async down(database) {
    await database.schema.dropTable('school_levels').execute();
  },
};
