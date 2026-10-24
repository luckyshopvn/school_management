import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-21 phần 21f (YCTD-174): xét tốt nghiệp THCS, THPT và hồ sơ thi. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - `graduation_configs`: quy tắc theo cấp dạng JSON (bài thi, hệ số, điểm đạt, điểm liệt, tiền tố); chưa có dòng thì dùng bộ
//   mặc định của gói dùng chung. Quy chế thi đổi theo năm nên sửa ở đây, không sửa mã;
// - `graduation_sessions`: kỳ xét (THCS) hoặc kỳ thi (THPT) của năm học; `graduation_candidates`: học sinh khối cuối cấp, đủ
//   điều kiện hay không (đọc xếp loại cả năm của sổ điểm 21c), số báo danh, bài thi đăng ký, miễn thi, điểm ưu tiên, khuyến
//   khích, điểm trung bình các năm; `graduation_rooms`: phòng thi, giám thị; `graduation_scores`: điểm bài thi;
// - `graduation_decisions`: kết quả đề xuất rồi xác nhận của hội đồng, số giấy chứng nhận; `graduation_minutes`: biên bản;
// - `graduation_submissions`: tệp xuất theo bố cục của Bộ, Sở và trạng thái đã gửi do người dùng đánh dấu (bản chạy nội bộ,
//   nối hệ thống thật sau); `transfer_dossiers`: hồ sơ chuyển cấp lên THPT của học sinh tốt nghiệp THCS
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('graduation_configs')
      .addColumn('school_level', 'text', (column) => column.primaryKey().check(sql`school_level in ('THCS', 'THPT')`))
      .addColumn('config', 'jsonb', (column) => column.notNull())
      .addColumn('updated_by', 'uuid')
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createTable('graduation_sessions')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('school_level', 'text', (column) => column.notNull().check(sql`school_level in ('THCS', 'THPT')`))
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 200`))
      .addColumn('academic_year_name', 'text', (column) => column.notNull())
      .addColumn('exam_date', 'date')
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('open')
          .check(sql`status in ('open', 'finalized')`),
      )
      .addColumn('created_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('graduation_sessions_level_year_unique', ['school_level', 'academic_year_name'])
      .execute();

    await database.schema
      .createTable('graduation_rooms')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('session_id', 'uuid', (column) =>
        column.notNull().references('graduation_sessions.id').onDelete('cascade'),
      )
      .addColumn('code', 'text', (column) => column.notNull().check(sql`char_length(code) between 1 and 30`))
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 200`))
      .addColumn('capacity', 'integer', (column) => column.notNull().check(sql`capacity between 1 and 100`))
      .addColumn('proctors', 'text', (column) => column.check(sql`char_length(proctors) <= 500`))
      .addUniqueConstraint('graduation_rooms_code_unique', ['session_id', 'code'])
      .execute();

    await database.schema
      .createTable('graduation_candidates')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('session_id', 'uuid', (column) =>
        column.notNull().references('graduation_sessions.id').onDelete('cascade'),
      )
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('exam_number', 'text')
      .addColumn('eligible', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('eligibility_note', 'text')
      .addColumn('priority_points', 'numeric(3, 2)', (column) =>
        column
          .notNull()
          .defaultTo(0)
          .check(sql`priority_points between 0 and 10`),
      )
      .addColumn('incentive_points', 'numeric(3, 2)', (column) =>
        column
          .notNull()
          .defaultTo(0)
          .check(sql`incentive_points between 0 and 10`),
      )
      .addColumn('grade_averages', 'jsonb')
      .addColumn('exam_subjects', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('exempt_subjects', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('room_id', 'uuid', (column) => column.references('graduation_rooms.id').onDelete('set null'))
      .addUniqueConstraint('graduation_candidates_child_unique', ['session_id', 'child_id'])
      .execute();
    await sql`create unique index graduation_candidates_exam_number_unique on graduation_candidates
      (session_id, exam_number) where exam_number is not null`.execute(database);

    await database.schema
      .createTable('graduation_scores')
      .addColumn('candidate_id', 'uuid', (column) =>
        column.notNull().references('graduation_candidates.id').onDelete('cascade'),
      )
      .addColumn('subject_code', 'text', (column) => column.notNull())
      .addColumn('score', 'numeric(3, 1)', (column) => column.notNull().check(sql`score between 0 and 10`))
      .addColumn('updated_by_name', 'text', (column) => column.notNull())
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addPrimaryKeyConstraint('graduation_scores_pkey', ['candidate_id', 'subject_code'])
      .execute();

    await database.schema
      .createTable('graduation_decisions')
      .addColumn('candidate_id', 'uuid', (column) =>
        column.primaryKey().references('graduation_candidates.id').onDelete('cascade'),
      )
      .addColumn('outcome', 'text', (column) => column.notNull().check(sql`outcome in ('graduated', 'not_graduated')`))
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('proposed')
          .check(sql`status in ('proposed', 'confirmed')`),
      )
      .addColumn('exam_average', 'numeric(4, 2)')
      .addColumn('score', 'numeric(4, 2)')
      .addColumn('note', 'text')
      .addColumn('certificate_no', 'text', (column) => column.unique())
      .addColumn('decided_by_name', 'text')
      .addColumn('decided_at', 'timestamptz')
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createTable('graduation_minutes')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('session_id', 'uuid', (column) =>
        column.notNull().references('graduation_sessions.id').onDelete('cascade'),
      )
      .addColumn('kind', 'text', (column) => column.notNull().check(sql`kind in ('council', 'exam_room', 'scoring')`))
      .addColumn('title', 'text', (column) => column.notNull().check(sql`char_length(title) between 1 and 200`))
      .addColumn('content', 'text', (column) => column.notNull().check(sql`char_length(content) between 1 and 8000`))
      .addColumn('created_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createTable('graduation_submissions')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('session_id', 'uuid', (column) =>
        column.notNull().references('graduation_sessions.id').onDelete('cascade'),
      )
      .addColumn('kind', 'text', (column) => column.notNull().check(sql`kind in ('candidates', 'results')`))
      .addColumn('file_name', 'text', (column) => column.notNull())
      .addColumn('exported_by_name', 'text', (column) => column.notNull())
      .addColumn('exported_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('exported')
          .check(sql`status in ('exported', 'sent')`),
      )
      .addColumn('sent_by_name', 'text')
      .addColumn('sent_at', 'timestamptz')
      .addColumn('note', 'text', (column) => column.check(sql`char_length(note) <= 500`))
      .execute();

    await database.schema
      .createTable('transfer_dossiers')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('session_id', 'uuid', (column) =>
        column.notNull().references('graduation_sessions.id').onDelete('cascade'),
      )
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('destination', 'text', (column) => column.check(sql`char_length(destination) <= 300`))
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('prepared')
          .check(sql`status in ('prepared', 'sent')`),
      )
      .addColumn('prepared_by_name', 'text', (column) => column.notNull())
      .addColumn('prepared_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('sent_at', 'timestamptz')
      .addUniqueConstraint('transfer_dossiers_child_unique', ['session_id', 'child_id'])
      .execute();
  },
  async down(database) {
    for (const table of [
      'transfer_dossiers',
      'graduation_submissions',
      'graduation_minutes',
      'graduation_decisions',
      'graduation_scores',
      'graduation_candidates',
      'graduation_rooms',
      'graduation_sessions',
      'graduation_configs',
    ]) {
      await database.schema.dropTable(table).execute();
    }
  },
};
