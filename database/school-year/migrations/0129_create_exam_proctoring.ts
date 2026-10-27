import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-23 phần 23e (YCTD-215): giám thị camera cho thi trực tuyến. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - mặc định tắt cả hai: trường phải bật xem trực tiếp (`allow_live_proctoring`) và ghi hình (`allow_recording`) ở cấu hình thi
//   trực tuyến, rồi giáo viên bật theo từng bài giao (`exam_assignments.proctor_live`, `proctor_record`);
// - `exam_proctor_consents`: đồng ý của cha mẹ (học sinh dưới 16 tuổi) theo từng loại (xem trực tiếp, ghi hình), có người đồng
//   ý, cách ghi nhận (phụ huynh tự đồng ý trên ứng dụng hoặc trường ghi nhận văn bản), thời điểm, thu hồi; mỗi học sinh một
//   đồng ý còn hiệu lực cho mỗi loại;
// - `exam_attempts.proctor_notice_at`: thời điểm học sinh xác nhận đã đọc thông báo trước khi vào thi;
// - `exam_proctor_views`: nhật ký người xem (ai xem bài của học sinh nào, lúc nào, xem trực tiếp hay xem lại bản ghi);
// - `exam_proctor_signals`: thông điệp báo hiệu WebRTC (offer, answer, ice) giữa giáo viên và học sinh, sống ngắn, xóa khi
//   phiên xem kết thúc; hình ảnh đi thẳng giữa hai trình duyệt (qua máy chủ chuyển tiếp coturn khi cần), không qua máy chủ API;
// - `exam_recording_chunks`: các đoạn bản ghi đã mã hoá lưu ở kho tệp theo `storage_key`, có hạn (mặc định 30 ngày).
export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('online_exam_school_settings')
      .addColumn('allow_live_proctoring', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('allow_recording', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('recording_retention_days', 'integer', (column) =>
        column
          .notNull()
          .defaultTo(30)
          .check(sql`recording_retention_days between 7 and 90`),
      )
      .execute();

    await database.schema
      .alterTable('exam_assignments')
      .addColumn('proctor_live', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('proctor_record', 'boolean', (column) => column.notNull().defaultTo(false))
      .execute();

    await database.schema.alterTable('exam_attempts').addColumn('proctor_notice_at', 'timestamptz').execute();

    await database.schema
      .createTable('exam_proctor_consents')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('scope', 'text', (column) => column.notNull().check(sql`scope in ('live', 'record')`))
      .addColumn('source', 'text', (column) => column.notNull().check(sql`source in ('parent', 'school')`))
      .addColumn('granted_by', 'uuid', (column) => column.notNull())
      .addColumn('granted_by_name', 'text', (column) => column.notNull())
      .addColumn('note', 'text')
      .addColumn('granted_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('revoked_at', 'timestamptz')
      .addColumn('revoked_by_name', 'text')
      .execute();
    await sql`create unique index exam_proctor_consents_active_index on exam_proctor_consents (child_id, scope) where revoked_at is null`.execute(
      database,
    );

    await database.schema
      .createTable('exam_proctor_views')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('attempt_id', 'uuid', (column) => column.notNull().references('exam_attempts.id'))
      .addColumn('kind', 'text', (column) => column.notNull().check(sql`kind in ('live', 'recording')`))
      .addColumn('viewer_id', 'uuid', (column) => column.notNull())
      .addColumn('viewer_name', 'text', (column) => column.notNull())
      .addColumn('started_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('last_seen_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('ended_at', 'timestamptz')
      .execute();
    await database.schema
      .createIndex('exam_proctor_views_attempt_index')
      .on('exam_proctor_views')
      .column('attempt_id')
      .execute();

    await database.schema
      .createTable('exam_proctor_signals')
      .addColumn('id', 'bigserial', (column) => column.primaryKey())
      .addColumn('view_id', 'uuid', (column) =>
        column.notNull().references('exam_proctor_views.id').onDelete('cascade'),
      )
      .addColumn('direction', 'text', (column) =>
        column.notNull().check(sql`direction in ('to_student', 'to_teacher')`),
      )
      .addColumn('kind', 'text', (column) => column.notNull().check(sql`kind in ('offer', 'answer', 'ice')`))
      .addColumn('payload', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('exam_proctor_signals_view_index')
      .on('exam_proctor_signals')
      .columns(['view_id', 'direction', 'id'])
      .execute();

    await database.schema
      .createTable('exam_recording_chunks')
      .addColumn('attempt_id', 'uuid', (column) => column.notNull().references('exam_attempts.id'))
      .addColumn('seq', 'integer', (column) => column.notNull())
      .addColumn('storage_key', 'text', (column) => column.notNull())
      .addColumn('size_bytes', 'integer', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('expires_at', 'timestamptz', (column) => column.notNull())
      .addPrimaryKeyConstraint('exam_recording_chunks_pkey', ['attempt_id', 'seq'])
      .execute();
    await database.schema
      .createIndex('exam_recording_chunks_expires_index')
      .on('exam_recording_chunks')
      .column('expires_at')
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('exam_recording_chunks').execute();
    await database.schema.dropTable('exam_proctor_signals').execute();
    await database.schema.dropTable('exam_proctor_views').execute();
    await database.schema.dropTable('exam_proctor_consents').execute();
    await database.schema.alterTable('exam_attempts').dropColumn('proctor_notice_at').execute();
    await database.schema
      .alterTable('exam_assignments')
      .dropColumn('proctor_live')
      .dropColumn('proctor_record')
      .execute();
    await database.schema
      .alterTable('online_exam_school_settings')
      .dropColumn('allow_live_proctoring')
      .dropColumn('allow_recording')
      .dropColumn('recording_retention_days')
      .execute();
  },
};
