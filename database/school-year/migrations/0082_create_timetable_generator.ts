import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-20 phần 22c2 (YCTD-164): máy xếp thời khoá biểu, dạy thay, đổi tiết, mã tra cứu. Claude tự chọn theo ủy quyền của Eric
// ngày 2026-10-11:
// - `timetable_generator_settings`: mức quan trọng của ràng buộc mềm (0 đến 10), giới hạn thời gian, số phương án theo cấp;
// - `timetable_subject_rules`: quy tắc xếp của môn (tiết đôi, tránh tiết cuối buổi, số tiết tối đa một ngày, phòng riêng như
//   phòng Tin học);
// - `timetable_teacher_busy`: tiết giáo viên báo bận trong tuần (ràng buộc cứng của máy xếp);
// - `timetable_generation_runs`, `timetable_generation_variants`: lần xếp chạy nền và các phương án; phương án chọn thành bản
//   nháp `timetable_versions` (source = 'generator'), ban hành theo luồng phiên bản của 22c1;
// - `timetable_changes`: dạy thay, đổi tiết theo ngày; không sửa bản đã ban hành. Một lớp một tiết một ngày chỉ một thay
//   đổi; đổi tiết là hai dòng cùng `pair_id`;
// - `timetable_lookup_codes`: mã tra cứu thời khoá biểu của lớp hoặc giáo viên in thành mã QR; thu hồi được.
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('timetable_generator_settings')
      .addColumn('school_level', 'text', (column) =>
        column.primaryKey().check(sql`school_level in ('MN', 'TH', 'THCS', 'THPT')`),
      )
      .addColumn('weights', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn('time_limit_seconds', 'integer', (column) =>
        column
          .notNull()
          .defaultTo(60)
          .check(sql`time_limit_seconds between 5 and 600`),
      )
      .addColumn('variant_count', 'smallint', (column) =>
        column
          .notNull()
          .defaultTo(3)
          .check(sql`variant_count between 1 and 5`),
      )
      .addColumn('updated_by', 'uuid')
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createTable('timetable_subject_rules')
      .addColumn('subject_id', 'uuid', (column) => column.primaryKey().references('subjects.id').onDelete('cascade'))
      .addColumn('double_period', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('avoid_last_period', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('max_per_day', 'smallint', (column) => column.check(sql`max_per_day between 1 and 10`))
      .addColumn('room_id', 'uuid', (column) => column.references('rooms.id').onDelete('set null'))
      .addColumn('updated_by', 'uuid')
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createTable('timetable_teacher_busy')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('teacher_user_id', 'uuid', (column) => column.notNull())
      .addColumn('teacher_name', 'text', (column) => column.notNull())
      .addColumn('weekday', 'smallint', (column) => column.notNull().check(sql`weekday between 1 and 7`))
      .addColumn('period_no', 'smallint', (column) => column.notNull().check(sql`period_no between 1 and 15`))
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('timetable_teacher_busy_unique', ['teacher_user_id', 'weekday', 'period_no'])
      .execute();

    await database.schema
      .createTable('timetable_generation_runs')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('school_level', 'text', (column) =>
        column.notNull().check(sql`school_level in ('MN', 'TH', 'THCS', 'THPT')`),
      )
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('queued'))
      .addColumn('weights', 'jsonb', (column) => column.notNull())
      .addColumn('time_limit_seconds', 'integer', (column) => column.notNull())
      .addColumn('variant_count', 'smallint', (column) => column.notNull())
      .addColumn('percent', 'smallint', (column) => column.notNull().defaultTo(0))
      .addColumn('best_score', 'numeric')
      .addColumn('best_hard', 'integer')
      .addColumn('message', 'text')
      .addColumn('issues', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('created_by', 'uuid')
      .addColumn('created_by_name', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('finished_at', 'timestamptz')
      .addCheckConstraint(
        'timetable_generation_runs_status_check',
        sql`status in ('queued', 'running', 'completed', 'failed', 'cancelled')`,
      )
      .execute();

    await database.schema
      .createTable('timetable_generation_variants')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('run_id', 'uuid', (column) =>
        column.notNull().references('timetable_generation_runs.id').onDelete('cascade'),
      )
      .addColumn('variant_no', 'smallint', (column) => column.notNull())
      .addColumn('score', 'numeric', (column) => column.notNull())
      .addColumn('hard_count', 'integer', (column) => column.notNull())
      .addColumn('soft', 'jsonb', (column) => column.notNull())
      .addColumn('violations', 'jsonb', (column) => column.notNull())
      .addColumn('placements', 'jsonb', (column) => column.notNull())
      .addColumn('version_id', 'uuid', (column) => column.references('timetable_versions.id').onDelete('set null'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('timetable_generation_variants_unique', ['run_id', 'variant_no'])
      .execute();

    await database.schema
      .createTable('timetable_changes')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('change_date', 'date', (column) => column.notNull())
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('period_no', 'smallint', (column) => column.notNull().check(sql`period_no between 1 and 15`))
      .addColumn('kind', 'text', (column) => column.notNull().check(sql`kind in ('substitute', 'swap')`))
      .addColumn('pair_id', 'uuid')
      .addColumn('subject_id', 'uuid', (column) => column.notNull().references('subjects.id'))
      .addColumn('teacher_user_id', 'uuid')
      .addColumn('teacher_name', 'text')
      .addColumn('room_id', 'uuid', (column) => column.references('rooms.id'))
      .addColumn('original_subject_id', 'uuid', (column) => column.references('subjects.id'))
      .addColumn('original_teacher_user_id', 'uuid')
      .addColumn('original_teacher_name', 'text')
      .addColumn('reason', 'text', (column) => column.check(sql`char_length(reason) <= 500`))
      .addColumn('created_by', 'uuid')
      .addColumn('created_by_name', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('timetable_changes_slot_unique', ['change_date', 'class_id', 'period_no'])
      .execute();
    await database.schema
      .createIndex('timetable_changes_teacher_index')
      .on('timetable_changes')
      .columns(['change_date', 'teacher_user_id'])
      .execute();

    await database.schema
      .createTable('timetable_lookup_codes')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('kind', 'text', (column) => column.notNull().check(sql`kind in ('class', 'teacher')`))
      .addColumn('target_id', 'uuid', (column) => column.notNull())
      .addColumn('target_name', 'text', (column) => column.notNull())
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('revoked_at', 'timestamptz')
      .execute();
    await sql`create unique index timetable_lookup_codes_active_unique on timetable_lookup_codes (kind, target_id)
      where revoked_at is null`.execute(database);
  },
  async down(database) {
    await database.schema.dropTable('timetable_lookup_codes').execute();
    await database.schema.dropTable('timetable_changes').execute();
    await database.schema.dropTable('timetable_generation_variants').execute();
    await database.schema.dropTable('timetable_generation_runs').execute();
    await database.schema.dropTable('timetable_teacher_busy').execute();
    await database.schema.dropTable('timetable_subject_rules').execute();
    await database.schema.dropTable('timetable_generator_settings').execute();
  },
};
