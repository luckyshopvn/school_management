import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Gia sư AI trả phí, lát L2 trò chuyện bằng chữ (YCTD-383; bản mẫu MH-596, MH-597):
// - `ai_tutor_messages` thêm bậc gợi ý của câu trả lời (`step`), loại yêu cầu của câu hỏi (`request_kind`: hỏi gợi ý hoặc xem lời giải đầy
//   đủ), kết quả kiểm duyệt của câu hỏi (`moderation`; câu bị chặn và câu trả lời theo mẫu không gửi lại nhà cung cấp ở lượt sau), em báo
//   câu trả lời sai (`reported_at`, `report_note`);
// - `ai_tutor_safety_flags`: cờ cảnh báo khi câu hỏi có dấu hiệu tự hại hoặc bị bắt nạt; lát L3 báo giáo viên chủ nhiệm rồi ghi
//   `notified_at`. Xóa theo tin nhắn khi hết hạn giữ lịch sử 12 tháng
export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('ai_tutor_messages')
      .addColumn('step', 'text')
      .addColumn('request_kind', 'text')
      .addColumn('moderation', 'text')
      .addColumn('reported_at', 'timestamptz')
      .addColumn('report_note', 'text', (column) => column.check(sql`char_length(report_note) <= 500`))
      .execute();
    await sql`alter table ai_tutor_messages add constraint ai_tutor_messages_step_check
      check (step in ('concept', 'method', 'example', 'check', 'solution', 'refusal', 'safety'))`.execute(database);
    await sql`alter table ai_tutor_messages add constraint ai_tutor_messages_request_kind_check
      check (request_kind in ('ask', 'solution'))`.execute(database);
    await sql`alter table ai_tutor_messages add constraint ai_tutor_messages_moderation_check
      check (moderation in ('self_harm', 'bullying', 'unsafe', 'off_topic'))`.execute(database);
    // Câu hỏi của em có loại yêu cầu, câu trả lời của gia sư có bậc gợi ý; chỉ câu trả lời mới bị báo sai
    await sql`alter table ai_tutor_messages add constraint ai_tutor_messages_role_fields_check
      check (case when role = 'student'
        then request_kind is not null and step is null and reported_at is null
        else request_kind is null and moderation is null and step is not null end)`.execute(database);

    await database.schema
      .createTable('ai_tutor_safety_flags')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('child_id', 'uuid', (column) => column.notNull())
      .addColumn('conversation_id', 'uuid', (column) =>
        column.notNull().references('ai_tutor_conversations.id').onDelete('cascade'),
      )
      .addColumn('message_id', 'uuid', (column) =>
        column.notNull().references('ai_tutor_messages.id').onDelete('cascade'),
      )
      .addColumn('kind', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      // Lát L3 ghi khi đã báo giáo viên chủ nhiệm
      .addColumn('notified_at', 'timestamptz')
      .addCheckConstraint('ai_tutor_safety_flags_kind_check', sql`kind in ('self_harm', 'bullying')`)
      .execute();
    await sql`create index ai_tutor_safety_flags_pending_idx on ai_tutor_safety_flags (created_at)
      where notified_at is null`.execute(database);
  },
  async down(database) {
    await database.schema.dropTable('ai_tutor_safety_flags').execute();
    await sql`alter table ai_tutor_messages drop constraint ai_tutor_messages_role_fields_check`.execute(database);
    await database.schema
      .alterTable('ai_tutor_messages')
      .dropColumn('report_note')
      .dropColumn('reported_at')
      .dropColumn('moderation')
      .dropColumn('request_kind')
      .dropColumn('step')
      .execute();
  },
};
