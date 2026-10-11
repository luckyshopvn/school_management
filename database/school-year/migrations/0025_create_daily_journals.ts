import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Nhật ký của bé theo ngày và theo trẻ: ăn, ngủ, vệ sinh, tâm trạng, hoạt động; giáo viên chủ nhiệm ghi nháp rồi công bố
// cho phụ huynh; sửa sau khi công bố phải ghi lý do (P04-04, P04-05; BR-15; QT-09; YCTD-65)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('daily_journals')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('journal_date', 'date', (column) => column.notNull())
      .addColumn('meal_note', 'text')
      .addColumn('sleep_note', 'text')
      .addColumn('hygiene_note', 'text')
      .addColumn('mood', 'text')
      .addColumn('activity_note', 'text')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('draft'))
      .addColumn('published_at', 'timestamptz')
      .addColumn('published_by', 'uuid')
      .addColumn('updated_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('daily_journals_child_date_unique', ['child_id', 'journal_date'])
      .addCheckConstraint('daily_journals_status_check', sql`status in ('draft', 'published')`)
      .addCheckConstraint(
        'daily_journals_mood_check',
        sql`mood is null or mood in ('happy', 'normal', 'tired', 'sad', 'unwell')`,
      )
      .execute();
    await database.schema
      .createIndex('daily_journals_class_date_index')
      .on('daily_journals')
      .columns(['class_id', 'journal_date'])
      .execute();

    await database.schema
      .createTable('journal_amendments')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('journal_id', 'uuid', (column) => column.notNull().references('daily_journals.id'))
      .addColumn('reason', 'text', (column) => column.notNull())
      .addColumn('before_data', 'jsonb', (column) => column.notNull())
      .addColumn('after_data', 'jsonb', (column) => column.notNull())
      .addColumn('amended_by', 'uuid', (column) => column.notNull())
      .addColumn('amended_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('journal_amendments').execute();
    await database.schema.dropTable('daily_journals').execute();
  },
};
