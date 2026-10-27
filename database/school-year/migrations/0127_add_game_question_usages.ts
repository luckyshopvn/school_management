import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-23 phần 23c (YCTD-213): lịch sử sử dụng câu hỏi (`question_usages`, 22g2) ghi thêm lượt dùng trong trò chơi ở lớp. Một dòng cho
// mỗi câu của mỗi lượt chơi (`game_session_id`, không có `exam_id`); `correct_rate` là tỷ lệ đúng của lớp (phần trăm) trên các câu
// trả lời đã ghi, để thống kê chất lượng câu cùng độ khó của đề (22g2)
export const migration: Migration = {
  async up(database) {
    await sql`alter table question_usages alter column exam_id drop not null`.execute(database);
    await database.schema
      .alterTable('question_usages')
      .addColumn('source', 'text', (column) => column.notNull().defaultTo('exam'))
      .addColumn('game_session_id', 'uuid', (column) =>
        column.references('classroom_game_sessions.id').onDelete('cascade'),
      )
      .addColumn('correct_rate', 'numeric(5, 2)')
      .execute();
    await sql`alter table question_usages add constraint question_usages_source_check
      check ((source = 'exam' and exam_id is not null and game_session_id is null)
        or (source = 'game' and game_session_id is not null and exam_id is null))`.execute(database);
    await sql`create unique index question_usages_game_unique on question_usages (question_id, game_session_id)
      where game_session_id is not null`.execute(database);
  },
  async down(database) {
    await sql`delete from question_usages where source = 'game'`.execute(database);
    await sql`drop index if exists question_usages_game_unique`.execute(database);
    await sql`alter table question_usages drop constraint question_usages_source_check`.execute(database);
    await database.schema
      .alterTable('question_usages')
      .dropColumn('correct_rate')
      .dropColumn('game_session_id')
      .dropColumn('source')
      .execute();
    await sql`alter table question_usages alter column exam_id set not null`.execute(database);
  },
};
