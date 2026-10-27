import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-28 phần 28d (YCTD-274): nguồn `activity` cho điểm đánh giá thường xuyên lấy từ kết quả hoạt động học trực tuyến (giáo viên
// chọn hoạt động và xác nhận; GD-141) và cho lượt dùng câu hỏi trong bài tập trực tuyến (`question_usages`, tỷ lệ đúng của lớp)
export const migration: Migration = {
  async up(database) {
    await sql`alter table score_entries drop constraint if exists score_entries_source_check`.execute(database);
    await sql`alter table score_entries add constraint score_entries_source_check
      check (source in ('manual', 'import', 'exam', 'activity'))`.execute(database);

    await database.schema
      .alterTable('question_usages')
      .addColumn('activity_id', 'uuid', (column) => column.references('course_activities.id').onDelete('cascade'))
      .execute();
    await sql`alter table question_usages drop constraint question_usages_source_check`.execute(database);
    await sql`alter table question_usages add constraint question_usages_source_check
      check ((source = 'exam' and exam_id is not null and game_session_id is null and activity_id is null)
        or (source = 'game' and game_session_id is not null and exam_id is null and activity_id is null)
        or (source = 'activity' and activity_id is not null and exam_id is null and game_session_id is null))`.execute(
      database,
    );
    await sql`create unique index question_usages_activity_unique on question_usages (question_id, activity_id)
      where activity_id is not null`.execute(database);
  },
  async down(database) {
    await sql`delete from question_usages where source = 'activity'`.execute(database);
    await sql`drop index if exists question_usages_activity_unique`.execute(database);
    await sql`alter table question_usages drop constraint question_usages_source_check`.execute(database);
    await sql`alter table question_usages add constraint question_usages_source_check
      check ((source = 'exam' and exam_id is not null and game_session_id is null)
        or (source = 'game' and game_session_id is not null and exam_id is null))`.execute(database);
    await database.schema.alterTable('question_usages').dropColumn('activity_id').execute();
    await sql`update score_entries set source = 'manual' where source = 'activity'`.execute(database);
    await sql`alter table score_entries drop constraint score_entries_source_check`.execute(database);
    await sql`alter table score_entries add constraint score_entries_source_check
      check (source in ('manual', 'import', 'exam'))`.execute(database);
  },
};
