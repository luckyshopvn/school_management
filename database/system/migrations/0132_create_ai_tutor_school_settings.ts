import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Cài đặt gia sư AI của trường, lát L1a trường bán (YCTD-383; bản mẫu MH-599). Một dòng duy nhất ở cơ sở dữ liệu hệ thống vì gói và
// lần mua đi qua ranh giới năm học: cấp học được dùng (chưa bật cấp nào thì phụ huynh không mua được gói của trường), khung giờ khóa
// theo giờ Việt Nam (mặc định 22:00 đến 6:00; lát L3 dùng để khóa). Chưa có dòng thì coi như tắt và khung giờ mặc định
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('ai_tutor_school_settings')
      .addColumn('id', 'integer', (column) => column.primaryKey().defaultTo(1))
      .addColumn('enabled_levels', sql`text[]`, (column) => column.notNull().defaultTo(sql`array[]::text[]`))
      .addColumn('quiet_start', 'text', (column) => column.notNull().defaultTo('22:00'))
      .addColumn('quiet_end', 'text', (column) => column.notNull().defaultTo('06:00'))
      .addColumn('updated_by', 'uuid')
      .addColumn('updated_by_name', 'text')
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('ai_tutor_school_settings_single_check', sql`id = 1`)
      .addCheckConstraint(
        'ai_tutor_school_settings_levels_check',
        sql`enabled_levels <@ array['TH', 'THCS', 'THPT']::text[]`,
      )
      .addCheckConstraint(
        'ai_tutor_school_settings_quiet_check',
        sql`quiet_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and quiet_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`,
      )
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('ai_tutor_school_settings').execute();
  },
};
