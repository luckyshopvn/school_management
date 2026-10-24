import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-22 phần 22h2 (YCTD-184): kho học liệu số, phần câu hỏi và chia sẻ. Câu hỏi, đề, ma trận chỉ nằm ở ngân hàng của 22g1 (năm
// học 0085); kho chỉ lưu tham chiếu. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - `resource_collection_questions`: câu hỏi, đề, ma trận trong bộ sưu tập của kho (bộ sưu tập ở cơ sở dữ liệu hệ thống 0042,
//   khoá `collection_id` không ràng buộc khác cơ sở dữ liệu); theo năm học vì câu hỏi ở năm học;
// - `rubrics`: mẫu rubric có cấu trúc (tiêu chí × mức, mô tả, điểm), tuỳ chọn nối câu hỏi tự luận của 22g1 bằng `question_id`;
//   nhân bản ghi `source_rubric_id`;
// - `resource_package_imports`: nhật ký nhập gói chia sẻ liên trường (mã gói, trường nguồn, số học liệu nhập, bỏ qua).
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('resource_collection_questions')
      .addColumn('collection_id', 'uuid', (column) => column.notNull())
      .addColumn('item_kind', 'text', (column) =>
        column.notNull().check(sql`item_kind in ('question', 'exam', 'matrix')`),
      )
      .addColumn('item_id', 'uuid', (column) => column.notNull())
      .addColumn('position', 'integer', (column) => column.notNull())
      .addColumn('added_by', 'uuid', (column) => column.notNull())
      .addColumn('added_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addPrimaryKeyConstraint('resource_collection_questions_pk', ['collection_id', 'item_kind', 'item_id'])
      .execute();

    await database.schema
      .createTable('rubrics')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 300`))
      .addColumn('description', 'text')
      .addColumn('school_level', 'text', (column) => column.check(sql`school_level in ('MN', 'TH', 'THCS', 'THPT')`))
      .addColumn('subject_id', 'uuid', (column) => column.references('subjects.id').onDelete('set null'))
      .addColumn('grade_level_code', 'text')
      .addColumn('question_id', 'uuid', (column) => column.references('questions.id').onDelete('set null'))
      .addColumn('levels', 'jsonb', (column) => column.notNull())
      .addColumn('criteria', 'jsonb', (column) => column.notNull())
      .addColumn('max_score', 'numeric', (column) => column.notNull())
      .addColumn('visibility', 'text', (column) =>
        column
          .notNull()
          .defaultTo('school')
          .check(sql`visibility in ('private', 'school')`),
      )
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('active')
          .check(sql`status in ('active', 'archived')`),
      )
      .addColumn('source_rubric_id', 'uuid')
      .addColumn('owner_user_id', 'uuid', (column) => column.notNull())
      .addColumn('owner_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createTable('resource_package_imports')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('package_code', 'text', (column) => column.notNull())
      .addColumn('source_school', 'text', (column) => column.notNull())
      .addColumn('package_created_at', 'timestamptz')
      .addColumn('imported_count', 'integer', (column) => column.notNull())
      .addColumn('skipped', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('resource_ids', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('imported_by', 'uuid', (column) => column.notNull())
      .addColumn('imported_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('resource_package_imports').execute();
    await database.schema.dropTable('rubrics').execute();
    await database.schema.dropTable('resource_collection_questions').execute();
  },
};
