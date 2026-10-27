import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-28 phần 28c (YCTD-273): giao bài cho lớp, nhóm, từng học sinh. `assignment_targets` là lựa chọn của giáo viên (đích và
// phiên bản); `assignment_recipients` là danh sách chốt khi phát hành (học sinh, nhóm khi bài nhóm, phiên bản, hạn riêng, miễn),
// nên học sinh chuyển lớp hay đổi nhóm sau khi phát hành không làm đổi bài đã giao. Thứ tự ưu tiên phiên bản: học sinh, nhóm, lớp
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('assignment_targets')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('assignment_id', 'uuid', (column) => column.notNull().references('assignments.id').onDelete('cascade'))
      .addColumn('target_kind', 'text', (column) =>
        column.notNull().check(sql`target_kind in ('class', 'group', 'child')`),
      )
      .addColumn('group_id', 'uuid', (column) => column.references('child_groups.id'))
      .addColumn('child_id', 'uuid', (column) => column.references('children.id'))
      .addColumn('variant_id', 'uuid', (column) => column.references('assignment_variants.id').onDelete('cascade'))
      .addCheckConstraint(
        'assignment_targets_kind_check',
        sql`(target_kind = 'class' and group_id is null and child_id is null)
          or (target_kind = 'group' and group_id is not null and child_id is null)
          or (target_kind = 'child' and child_id is not null and group_id is null)`,
      )
      .execute();

    await database.schema
      .createTable('assignment_recipients')
      .addColumn('assignment_id', 'uuid', (column) => column.notNull().references('assignments.id').onDelete('cascade'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('group_id', 'uuid', (column) => column.references('child_groups.id'))
      .addColumn('variant_id', 'uuid', (column) => column.references('assignment_variants.id'))
      .addColumn('due_at', 'timestamptz')
      .addColumn('excused', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('excuse_reason', 'text', (column) =>
        column.check(sql`excuse_reason is null or char_length(excuse_reason) <= 500`),
      )
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addPrimaryKeyConstraint('assignment_recipients_pkey', ['assignment_id', 'child_id'])
      .execute();
    await database.schema
      .createIndex('assignment_recipients_child_index')
      .on('assignment_recipients')
      .column('child_id')
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('assignment_recipients').execute();
    await database.schema.dropTable('assignment_targets').execute();
  },
};
