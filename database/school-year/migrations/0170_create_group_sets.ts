import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-28 phần 28a (YCTD-271): mô hình nhóm dùng chung. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - `group_sets`: bộ nhóm của một lớp (môn tuỳ chọn), mục đích (`subject`, `activity`, `classroom`), cách chia, tham số chia
//   (không chứa mức năng lực, GD-140), người lập, trạng thái `active` hoặc `archived`. Chia lại là bộ mới, bộ cũ lưu trữ để bài,
//   đề, không gian đã gắn bộ cũ giữ nguyên;
// - `child_groups` thêm `group_set_id`, `class_id`, `position`, `leader_child_id`. Nhóm của 4.1.6 (DT-14c) giữ `group_set_id`
//   trống. Ràng buộc tên duy nhất tách thành hai chỉ mục riêng phần: trong đơn vị khi không thuộc bộ, trong bộ khi thuộc bộ;
// - `child_group_members.role` (`member`, `leader`); `child_group_member_events` ghi thêm, bớt, chuyển nhóm, đổi nhóm trưởng
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('group_sets')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('subject_id', 'uuid', (column) => column.references('subjects.id'))
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 120`))
      .addColumn('purpose', 'text', (column) =>
        column.notNull().check(sql`purpose in ('subject', 'activity', 'classroom')`),
      )
      .addColumn('method', 'text', (column) =>
        column
          .notNull()
          .check(
            sql`method in ('manual', 'random', 'ability_mixed', 'ability_tiered', 'gender_balanced', 'timetable_group')`,
          ),
      )
      .addColumn('params', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('active')
          .check(sql`status in ('active', 'archived')`),
      )
      .addColumn('owner_user_id', 'uuid', (column) => column.notNull())
      .addColumn('owner_name', 'text', (column) => column.notNull())
      .addColumn('replaces_id', 'uuid', (column) => column.references('group_sets.id'))
      .addColumn('archived_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('group_sets_class_status_index')
      .on('group_sets')
      .columns(['class_id', 'status'])
      .execute();

    await database.schema
      .alterTable('child_groups')
      .addColumn('group_set_id', 'uuid', (column) => column.references('group_sets.id'))
      .addColumn('class_id', 'uuid', (column) => column.references('classes.id'))
      .addColumn('position', 'integer')
      .addColumn('leader_child_id', 'uuid', (column) => column.references('children.id'))
      .execute();
    await database.schema.alterTable('child_groups').dropConstraint('child_groups_unit_name_unique').execute();
    await sql`create unique index child_groups_unit_name_unique on child_groups (org_unit_id, name)
      where group_set_id is null`.execute(database);
    await sql`create unique index child_groups_set_name_unique on child_groups (group_set_id, name)
      where group_set_id is not null`.execute(database);
    await database.schema.createIndex('child_groups_set_index').on('child_groups').column('group_set_id').execute();

    await database.schema
      .alterTable('child_group_members')
      .addColumn('role', 'text', (column) =>
        column
          .notNull()
          .defaultTo('member')
          .check(sql`role in ('member', 'leader')`),
      )
      .execute();

    await database.schema
      .createTable('child_group_member_events')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('group_set_id', 'uuid', (column) => column.references('group_sets.id'))
      .addColumn('group_id', 'uuid', (column) => column.notNull().references('child_groups.id'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('event', 'text', (column) =>
        column.notNull().check(sql`event in ('added', 'removed', 'moved', 'leader_set', 'leader_unset')`),
      )
      .addColumn('from_group_id', 'uuid', (column) => column.references('child_groups.id'))
      .addColumn('actor_user_id', 'uuid', (column) => column.notNull())
      .addColumn('actor_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('child_group_member_events_set_index')
      .on('child_group_member_events')
      .columns(['group_set_id', 'created_at'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('child_group_member_events').execute();
    await database.schema.alterTable('child_group_members').dropColumn('role').execute();
    await sql`delete from child_group_members where group_id in (select id from child_groups where group_set_id is not null)`.execute(
      database,
    );
    await sql`delete from child_groups where group_set_id is not null`.execute(database);
    await sql`drop index child_groups_set_name_unique`.execute(database);
    await sql`drop index child_groups_unit_name_unique`.execute(database);
    await database.schema.dropIndex('child_groups_set_index').execute();
    await database.schema
      .alterTable('child_groups')
      .dropColumn('leader_child_id')
      .dropColumn('position')
      .dropColumn('class_id')
      .dropColumn('group_set_id')
      .execute();
    await database.schema
      .alterTable('child_groups')
      .addUniqueConstraint('child_groups_unit_name_unique', ['org_unit_id', 'name'])
      .execute();
    await database.schema.dropTable('group_sets').execute();
  },
};
