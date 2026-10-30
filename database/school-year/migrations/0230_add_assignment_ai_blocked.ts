import type { Migration } from 'kysely/migration';

// Gia sư AI trả phí, lát L0 (YCTD-383): giáo viên đánh dấu bài tập "không dùng AI"; gia sư AI khóa với bài này (lát L3)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('assignments')
      .addColumn('ai_blocked', 'boolean', (column) => column.notNull().defaultTo(false))
      .execute();
  },
  async down(database) {
    await database.schema.alterTable('assignments').dropColumn('ai_blocked').execute();
  },
};
