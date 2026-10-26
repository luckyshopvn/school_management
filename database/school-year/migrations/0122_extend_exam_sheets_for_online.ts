import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-23 phần 23a (YCTD-211): bài làm trực tuyến vào phiếu chấm của 22g2 (một đường duy nhất vào sổ điểm): phiếu có nguồn
// 'online' và trỏ về lượt làm đang được tính; giáo viên chấm tự luận, khoá điểm, chuyển điểm bằng màn hình 22g2 như phiếu nhập tay
export const migration: Migration = {
  async up(database) {
    await sql`alter table exam_sheets drop constraint if exists exam_sheets_source_check`.execute(database);
    await sql`alter table exam_sheets add constraint exam_sheets_source_check
      check (source in ('manual', 'import', 'online'))`.execute(database);
    await database.schema
      .alterTable('exam_sheets')
      .addColumn('attempt_id', 'uuid', (column) => column.references('exam_attempts.id').onDelete('set null'))
      .execute();
  },
  async down(database) {
    await database.schema.alterTable('exam_sheets').dropColumn('attempt_id').execute();
    await sql`alter table exam_sheets drop constraint if exists exam_sheets_source_check`.execute(database);
    await sql`alter table exam_sheets add constraint exam_sheets_source_check
      check (source in ('manual', 'import'))`.execute(database);
  },
};
