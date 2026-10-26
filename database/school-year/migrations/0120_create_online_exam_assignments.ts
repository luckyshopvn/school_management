import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-23 phần 23a (YCTD-211): thi trực tuyến cho học sinh, phần giao đề. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - `online_exam_settings`: công tắc cho học sinh tự đăng nhập theo cấp học (GD-105 Eric chốt 2026-10-26: bật ở mọi cấp, kể cả
//   Tiểu học; trường tắt theo cấp); chưa có dòng của cấp nào nghĩa là bật;
// - `exam_assignments`: giao một đề đã khoá của 22g1 (câu trong đề đã có bản chụp nên đổi ngân hàng câu hỏi không đổi bài đã
//   giao): giờ mở, giờ đóng, thời lượng, số lần làm, cách tính các lần, đảo câu và đáp án, phát mã đề, chế độ hiện kết quả,
//   khóa toàn màn hình và số lần rời bài, camera và cách xử lý khi không có camera, cách xử lý phiên đăng nhập thứ hai (GD-106
//   Eric chốt 2026-10-26); cấu hình bài kiểm tra của lớp (học kỳ, loại điểm, lần) để chuyển điểm theo luồng 22g2;
// - `exam_assignment_targets`: giao cho cả lớp hoặc cho từng học sinh;
// - chế độ thi (Eric chốt 2026-10-26: mặc định chỉ thi tại trường): `exam_assignments.exam_mode` là `at-school` (mặc định, học sinh
//   vào bài bằng mã phòng thi do giám thị mở, và từ dải mạng của trường nếu trường cấu hình) hoặc `remote` (tắt mặc định, trường
//   phải bật); `online_exam_school_settings` giữ mặc định chế độ thi, cho phép `remote`, dải mạng, thời hạn mã phòng;
//   `exam_rooms` là phòng thi (mã ngắn hạn, mở, đóng) và `exam_room_students` là danh sách học sinh được vào phòng.
// Ảnh chụp định kỳ (tắt mặc định, chỉ bật khi có văn bản đồng ý của cha mẹ) chưa làm ở phần này nên chưa có cột
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('online_exam_settings')
      .addColumn('school_level', 'text', (column) =>
        column.primaryKey().check(sql`school_level in ('MN', 'TH', 'THCS', 'THPT')`),
      )
      .addColumn('student_login_enabled', 'boolean', (column) => column.notNull().defaultTo(true))
      .addColumn('updated_by', 'uuid')
      .addColumn('updated_by_name', 'text')
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createTable('online_exam_school_settings')
      .addColumn('id', 'boolean', (column) =>
        column
          .primaryKey()
          .defaultTo(true)
          .check(sql`id`),
      )
      .addColumn('default_exam_mode', 'text', (column) =>
        column
          .notNull()
          .defaultTo('at-school')
          .check(sql`default_exam_mode in ('at-school', 'remote')`),
      )
      .addColumn('allow_remote', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('allowed_networks', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('room_code_minutes', 'integer', (column) =>
        column
          .notNull()
          .defaultTo(60)
          .check(sql`room_code_minutes between 5 and 720`),
      )
      .addColumn('updated_by', 'uuid')
      .addColumn('updated_by_name', 'text')
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createTable('exam_assignments')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('exam_id', 'uuid', (column) => column.notNull().references('exams.id'))
      .addColumn('school_level', 'text', (column) =>
        column.notNull().check(sql`school_level in ('MN', 'TH', 'THCS', 'THPT')`),
      )
      .addColumn('title', 'text', (column) => column.notNull().check(sql`char_length(title) between 1 and 300`))
      .addColumn('opens_at', 'timestamptz', (column) => column.notNull())
      .addColumn('closes_at', 'timestamptz', (column) => column.notNull())
      .addColumn('duration_minutes', 'integer', (column) =>
        column.notNull().check(sql`duration_minutes between 5 and 300`),
      )
      .addColumn('max_attempts', 'smallint', (column) =>
        column
          .notNull()
          .defaultTo(1)
          .check(sql`max_attempts between 1 and 5`),
      )
      .addColumn('attempt_policy', 'text', (column) =>
        column
          .notNull()
          .defaultTo('best')
          .check(sql`attempt_policy in ('best', 'last')`),
      )
      .addColumn('shuffle_questions', 'boolean', (column) => column.notNull().defaultTo(true))
      .addColumn('shuffle_options', 'boolean', (column) => column.notNull().defaultTo(true))
      .addColumn('variant_mode', 'text', (column) =>
        column
          .notNull()
          .defaultTo('random')
          .check(sql`variant_mode in ('random', 'fixed')`),
      )
      .addColumn('fixed_variant_code', 'text')
      .addColumn('result_mode', 'text', (column) =>
        column
          .notNull()
          .defaultTo('after_close')
          .check(sql`result_mode in ('immediate', 'after_close', 'teacher_release')`),
      )
      .addColumn('results_released_at', 'timestamptz')
      .addColumn('fullscreen_required', 'boolean', (column) => column.notNull().defaultTo(true))
      .addColumn('max_violations', 'smallint', (column) =>
        column
          .notNull()
          .defaultTo(3)
          .check(sql`max_violations between 0 and 20`),
      )
      .addColumn('violation_action', 'text', (column) =>
        column
          .notNull()
          .defaultTo('flag')
          .check(sql`violation_action in ('flag', 'auto_submit')`),
      )
      .addColumn('camera_enabled', 'boolean', (column) => column.notNull().defaultTo(true))
      .addColumn('camera_fallback', 'text', (column) =>
        column
          .notNull()
          .defaultTo('flag')
          .check(sql`camera_fallback in ('block', 'flag')`),
      )
      .addColumn('single_session_mode', 'text', (column) =>
        column
          .notNull()
          .defaultTo('reject_new')
          .check(sql`single_session_mode in ('reject_new', 'close_old')`),
      )
      .addColumn('term_type', 'text', (column) =>
        column
          .notNull()
          .defaultTo('first_term')
          .check(sql`term_type in ('first_term', 'second_term')`),
      )
      .addColumn('score_kind', 'text', (column) =>
        column
          .notNull()
          .defaultTo('regular')
          .check(sql`score_kind in ('regular', 'mid', 'final')`),
      )
      .addColumn('score_seq', 'smallint', (column) =>
        column
          .notNull()
          .defaultTo(1)
          .check(sql`score_seq between 1 and 20`),
      )
      .addColumn('true_false_rule', 'text', (column) =>
        column
          .notNull()
          .defaultTo('tiered')
          .check(sql`true_false_rule in ('tiered', 'proportional')`),
      )
      .addColumn('absent_policy', 'text', (column) =>
        column
          .notNull()
          .defaultTo('skip')
          .check(sql`absent_policy in ('skip', 'zero')`),
      )
      .addColumn('exam_mode', 'text', (column) =>
        column
          .notNull()
          .defaultTo('at-school')
          .check(sql`exam_mode in ('at-school', 'remote')`),
      )
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('published')
          .check(sql`status in ('published', 'cancelled')`),
      )
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('exam_assignments_window_check', sql`closes_at > opens_at`)
      .execute();
    await database.schema.createIndex('exam_assignments_exam_index').on('exam_assignments').column('exam_id').execute();

    await database.schema
      .createTable('exam_assignment_targets')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('assignment_id', 'uuid', (column) =>
        column.notNull().references('exam_assignments.id').onDelete('cascade'),
      )
      .addColumn('kind', 'text', (column) => column.notNull().check(sql`kind in ('class', 'student')`))
      .addColumn('class_id', 'uuid', (column) => column.references('classes.id'))
      .addColumn('child_id', 'uuid', (column) => column.references('children.id'))
      .addCheckConstraint(
        'exam_assignment_targets_shape_check',
        sql`(kind = 'class' and class_id is not null and child_id is null)
          or (kind = 'student' and child_id is not null and class_id is null)`,
      )
      .execute();
    await database.schema
      .createIndex('exam_assignment_targets_assignment_index')
      .on('exam_assignment_targets')
      .column('assignment_id')
      .execute();

    await database.schema
      .createTable('exam_rooms')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('assignment_id', 'uuid', (column) =>
        column.notNull().references('exam_assignments.id').onDelete('cascade'),
      )
      .addColumn('code', 'text', (column) => column.notNull().check(sql`code ~ '^[0-9]{6}$'`))
      .addColumn('opened_by', 'uuid', (column) => column.notNull())
      .addColumn('opened_by_name', 'text', (column) => column.notNull())
      .addColumn('opened_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('expires_at', 'timestamptz', (column) => column.notNull())
      .addColumn('closed_at', 'timestamptz')
      .addColumn('closed_by_name', 'text')
      .execute();
    await database.schema.createIndex('exam_rooms_assignment_index').on('exam_rooms').column('assignment_id').execute();
    await sql`create unique index exam_rooms_open_code_index on exam_rooms (code) where closed_at is null`.execute(
      database,
    );

    await database.schema
      .createTable('exam_room_students')
      .addColumn('room_id', 'uuid', (column) => column.notNull().references('exam_rooms.id').onDelete('cascade'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('entered_at', 'timestamptz')
      .addPrimaryKeyConstraint('exam_room_students_pkey', ['room_id', 'child_id'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('exam_room_students').execute();
    await database.schema.dropTable('exam_rooms').execute();
    await database.schema.dropTable('exam_assignment_targets').execute();
    await database.schema.dropTable('exam_assignments').execute();
    await database.schema.dropTable('online_exam_settings').execute();
    await database.schema.dropTable('online_exam_school_settings').execute();
  },
};
