import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Hỏi đáp bài tập của chương trình gia sư (DT-27 phần 27e, YCTD-255; tài liệu 32 mục 19.5, YCTD-270). Câu hỏi, trả lời, xác nhận câu
// trả lời, lọc, báo cáo là của bộ máy hỏi đáp 28e (`discussion_threads` loại `question` ở khoá học ghi sẵn của chương trình, 27d1);
// phần này chỉ thêm phần riêng của gia sư. Số 0201: sau dải 0170 đến 0199 của DT-28 vì khoá ngoại tới bảng của 28e (0182); dải 0150
// đến 0169 của DT-27 (0158, 0159 của kế hoạch) chạy trước nên không dùng được. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - thời hạn trả lời theo chương trình (`tutoring_programs.answer_hours`, mặc định 48 giờ như hàng chờ của 28e);
// - học sinh đánh dấu đã hiểu hoặc còn chưa hiểu câu trả lời (`tutoring_question_marks`, một dòng mỗi câu hỏi);
// - câu trả lời giáo viên gửi từ bản nháp AI mang dấu "có AI hỗ trợ" (`tutoring_ai_answers`, trỏ tới nhật ký AI của 23d);
// - phụ huynh tắt, bật việc dùng AI cho câu hỏi của con (`tutoring_ai_consents`; chưa có dòng là theo mặc định của trường: cho phép)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('tutoring_programs')
      .addColumn('answer_hours', 'smallint', (column) =>
        column
          .notNull()
          .defaultTo(48)
          .check(sql`answer_hours between 1 and 336`),
      )
      .execute();

    await database.schema
      .createTable('tutoring_question_marks')
      .addColumn('thread_id', 'uuid', (column) =>
        column.primaryKey().references('discussion_threads.id').onDelete('cascade'),
      )
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('understood', 'boolean', (column) => column.notNull())
      .addColumn('marked_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createTable('tutoring_ai_answers')
      .addColumn('post_id', 'uuid', (column) =>
        column.primaryKey().references('discussion_posts.id').onDelete('cascade'),
      )
      .addColumn('thread_id', 'uuid', (column) =>
        column.notNull().references('discussion_threads.id').onDelete('cascade'),
      )
      .addColumn('ai_request_id', 'uuid', (column) => column.notNull())
      .addColumn('teacher_user_id', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createTable('tutoring_ai_consents')
      .addColumn('child_id', 'uuid', (column) => column.primaryKey().references('children.id'))
      .addColumn('allowed', 'boolean', (column) => column.notNull())
      .addColumn('decided_by_user_id', 'uuid', (column) => column.notNull())
      .addColumn('decided_by_name', 'text', (column) => column.notNull())
      .addColumn('decided_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('tutoring_ai_consents').execute();
    await database.schema.dropTable('tutoring_ai_answers').execute();
    await database.schema.dropTable('tutoring_question_marks').execute();
    await database.schema.alterTable('tutoring_programs').dropColumn('answer_hours').execute();
  },
};
