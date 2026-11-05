import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Minh chứng của cá nhân (YCTD-396 lát L6, Q-396-11, Q-396-12): mỗi minh chứng có chủ thể là nhà trường (trống) hoặc một cán
// bộ; mã ở bộ của cá nhân duy nhất theo bộ và người được đánh giá, nên mã lưu kèm chủ thể và ràng buộc duy nhất tính cả chủ thể
const NO_SUBJECT = sql`'00000000-0000-0000-0000-000000000000'::uuid`;

export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('evidence_items')
      .addColumn('subject_user_id', 'uuid')
      .addColumn('subject_name', 'text', (column) => column.check(sql`char_length(subject_name) <= 200`))
      .execute();
    await database.schema
      .createIndex('evidence_items_subject_index')
      .on('evidence_items')
      .column('subject_user_id')
      .execute();
    await database.schema.alterTable('evidence_codes').addColumn('subject_user_id', 'uuid').execute();
    await database.schema.alterTable('evidence_codes').dropConstraint('evidence_codes_code_unique').execute();
    await sql`create unique index evidence_codes_code_unique
      on evidence_codes (framework_id, coalesce(subject_user_id, ${NO_SUBJECT}), code)`.execute(database);
  },
  async down(database) {
    await sql`drop index evidence_codes_code_unique`.execute(database);
    // Mã trùng giữa các cá nhân thì giữ một: xóa mã của bộ cá nhân trước khi khôi phục ràng buộc cũ
    await sql`delete from evidence_codes where subject_user_id is not null`.execute(database);
    await database.schema
      .alterTable('evidence_codes')
      .addUniqueConstraint('evidence_codes_code_unique', ['framework_id', 'code'])
      .execute();
    await database.schema.alterTable('evidence_codes').dropColumn('subject_user_id').execute();
    await database.schema.dropIndex('evidence_items_subject_index').execute();
    await database.schema
      .alterTable('evidence_items')
      .dropColumn('subject_name')
      .dropColumn('subject_user_id')
      .execute();
  },
};
