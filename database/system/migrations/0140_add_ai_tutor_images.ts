import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Gia sư AI trả phí, lát L4 ảnh bài tập (YCTD-383; bản mẫu MH-597; Q5 của Eric: chỉ gói Nâng cao, ảnh xóa sau 30 ngày):
// - `ai_tutor_message_images`: ảnh em gửi kèm câu hỏi. Tệp nằm ở kho tệp của trường (`storage_key`); việc nền xóa tệp sau 30 ngày rồi
//   xóa khóa tệp và ghi `deleted_at`, dòng còn lại để tin nhắn hiện "ảnh đã xóa sau 30 ngày". Xóa theo tin nhắn khi hết hạn 12 tháng;
// - `ai_tutor_messages.image_text`: đề bài gia sư chép từ ảnh, để các lượt sau hiểu ngữ cảnh mà không gửi lại ảnh;
// - kết quả kiểm duyệt thêm `personal_data`: ảnh có thông tin cá nhân thì không lưu ảnh, hoàn lượt, trả lời theo mẫu nhắc em
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('ai_tutor_message_images')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('message_id', 'uuid', (column) =>
        column.notNull().references('ai_tutor_messages.id').onDelete('cascade'),
      )
      .addColumn('child_id', 'uuid', (column) => column.notNull())
      .addColumn('position', 'smallint', (column) => column.notNull())
      .addColumn('storage_key', 'text')
      .addColumn('content_type', 'text', (column) => column.notNull())
      .addColumn('size_bytes', 'integer', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('deleted_at', 'timestamptz')
      .addCheckConstraint(
        'ai_tutor_message_images_content_type_check',
        sql`content_type in ('image/jpeg', 'image/png', 'image/webp')`,
      )
      .addCheckConstraint(
        'ai_tutor_message_images_storage_check',
        sql`(deleted_at is null) = (storage_key is not null)`,
      )
      .execute();
    await sql`create index ai_tutor_message_images_message_idx on ai_tutor_message_images (message_id)`.execute(
      database,
    );
    await sql`create index ai_tutor_message_images_pending_idx on ai_tutor_message_images (created_at)
      where deleted_at is null`.execute(database);

    await database.schema
      .alterTable('ai_tutor_messages')
      .addColumn('image_text', 'text', (column) => column.check(sql`char_length(image_text) <= 2000`))
      .execute();
    await sql`alter table ai_tutor_messages drop constraint ai_tutor_messages_moderation_check`.execute(database);
    await sql`alter table ai_tutor_messages add constraint ai_tutor_messages_moderation_check
      check (moderation in ('self_harm', 'bullying', 'unsafe', 'off_topic', 'personal_data'))`.execute(database);
  },
  async down(database) {
    await sql`update ai_tutor_messages set moderation = 'unsafe' where moderation = 'personal_data'`.execute(database);
    await sql`alter table ai_tutor_messages drop constraint ai_tutor_messages_moderation_check`.execute(database);
    await sql`alter table ai_tutor_messages add constraint ai_tutor_messages_moderation_check
      check (moderation in ('self_harm', 'bullying', 'unsafe', 'off_topic'))`.execute(database);
    await database.schema.alterTable('ai_tutor_messages').dropColumn('image_text').execute();
    await database.schema.dropTable('ai_tutor_message_images').execute();
  },
};
