import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-23 phần 23a (YCTD-211): lượt làm bài trực tuyến. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - `exam_attempts`: một lượt làm của một học sinh: mã đề được phát, cách xếp câu và lựa chọn của lượt (`layout`), hạn nộp tính
//   theo đồng hồ máy chủ lúc bắt đầu (`deadline_at`, kể cả khi học sinh tải lại trang), phiên đăng nhập đang làm bài, câu trả
//   lời lưu nháp từng câu (`answers`, theo khoá lựa chọn của mã đề để chấm bằng hàm chấm của 22g2), điểm trắc nghiệm và tự luận,
//   cờ cần giáo viên xét, tình trạng camera lúc vào bài; `sheet_synced` cho biết bài đã vào phiếu chấm của 22g2 chưa;
// - `exam_attempt_events`: sự kiện rời bài, sự kiện camera, phiên thứ hai (chỉ loại và thời điểm, không có hình hay video);
//   sự kiện chỉ là căn cứ để giáo viên xét, không tự trừ điểm.
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('exam_attempts')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('assignment_id', 'uuid', (column) => column.notNull().references('exam_assignments.id'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('attempt_no', 'smallint', (column) => column.notNull())
      .addColumn('variant_code', 'text', (column) => column.notNull())
      .addColumn('layout', 'jsonb', (column) => column.notNull())
      .addColumn('started_at', 'timestamptz', (column) => column.notNull())
      .addColumn('deadline_at', 'timestamptz', (column) => column.notNull())
      .addColumn('submitted_at', 'timestamptz')
      .addColumn('submit_reason', 'text', (column) =>
        column.check(sql`submit_reason in ('manual', 'timeout', 'violation', 'teacher')`),
      )
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('in_progress')
          .check(sql`status in ('in_progress', 'submitted')`),
      )
      .addColumn('session_id', 'text', (column) => column.notNull())
      .addColumn('answers', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn('essay_marks', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn('last_saved_at', 'timestamptz')
      .addColumn('objective_score', 'numeric')
      .addColumn('essay_score', 'numeric')
      .addColumn('total_score', 'numeric')
      .addColumn('max_score', 'numeric')
      .addColumn('results', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('needs_marking', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('flagged', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('flag_reasons', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('camera_state', 'text', (column) =>
        column
          .notNull()
          .defaultTo('off')
          .check(sql`camera_state in ('off', 'granted', 'denied', 'unavailable')`),
      )
      .addColumn('sheet_synced', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('exam_attempts_unique', ['assignment_id', 'child_id', 'attempt_no'])
      .execute();
    await database.schema
      .createIndex('exam_attempts_child_index')
      .on('exam_attempts')
      .columns(['child_id', 'assignment_id'])
      .execute();
    await database.schema
      .createIndex('exam_attempts_assignment_index')
      .on('exam_attempts')
      .columns(['assignment_id', 'status'])
      .execute();

    await database.schema
      .createTable('exam_attempt_events')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('attempt_id', 'uuid', (column) => column.notNull().references('exam_attempts.id').onDelete('cascade'))
      .addColumn('event_type', 'text', (column) =>
        column.notNull().check(
          sql`event_type in ('fullscreen_exit', 'page_hidden', 'window_blur', 'camera_denied', 'camera_unavailable',
            'camera_lost', 'no_face', 'multiple_faces', 'second_session')`,
        ),
      )
      .addColumn('occurred_at', 'timestamptz', (column) => column.notNull())
      .addColumn('client_at', 'timestamptz')
      .addColumn('detail', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('exam_attempt_events_attempt_index')
      .on('exam_attempt_events')
      .columns(['attempt_id', 'occurred_at'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('exam_attempt_events').execute();
    await database.schema.dropTable('exam_attempts').execute();
  },
};
