import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-29 phần 29e (YCTD-329): hai loại học liệu cho bài hát, câu chuyện do trường tải lên (tệp âm thanh, video, PDF, ảnh) để giáo
// viên phát trên lớp từ Hộp công cụ giảng dạy. Qua Ban Giám hiệu duyệt như video (kiểm bản quyền trước khi công bố)
export const migration: Migration = {
  async up(database) {
    await sql`insert into resource_types (code, name, requires_school_review, order_no)
      values ('song', 'Bài hát', true, 91), ('story', 'Câu chuyện', true, 92)
      on conflict (code) do nothing`.execute(database);
  },
  async down(database) {
    await sql`delete from resource_types
      where code in ('song', 'story')
        and not exists (select 1 from learning_resources where learning_resources.type_id = resource_types.id)`.execute(
      database,
    );
  },
};
