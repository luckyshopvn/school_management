import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-28 phần 28a (YCTD-271): dời bản chia nhóm của công cụ lớp học 23b (`classroom_groupings`, nhóm lưu jsonb) sang bộ nhóm
// mục đích `classroom`, cách chia `manual`. Bảng cũ giữ nguyên một bản phát hành: máy chủ còn ghi song song để bản ứng dụng cũ
// và kiểm thử của 23b đọc được, nhưng chỉ đọc từ bộ nhóm. Học sinh không còn trong lớp hoặc tên nhóm trùng bị bỏ qua
interface LegacyGroup {
  name?: unknown;
  child_ids?: unknown;
}

export const migration: Migration = {
  async up(database) {
    const rows = await sql<{
      class_id: string;
      org_unit_id: string;
      owner_user_id: string;
      owner_name: string | null;
      groups: unknown;
      updated_at: Date;
    }>`select classroom_groupings.class_id, classes.org_unit_id, classroom_groupings.owner_user_id,
        (select staff.full_name from staff where staff.user_id = classroom_groupings.owner_user_id limit 1) as owner_name,
        classroom_groupings.groups, classroom_groupings.updated_at
      from classroom_groupings
      inner join classes on classes.id = classroom_groupings.class_id`.execute(database);
    for (const row of rows.rows) {
      const groups = Array.isArray(row.groups) ? (row.groups as LegacyGroup[]) : [];
      const set = await sql<{ id: string }>`insert into group_sets
          (org_unit_id, class_id, name, purpose, method, params, owner_user_id, owner_name, created_at, updated_at)
        values (${row.org_unit_id}, ${row.class_id}, 'Chia nhóm công cụ lớp học', 'classroom', 'manual',
          '{"source":"classroom_groupings"}'::jsonb, ${row.owner_user_id}, ${row.owner_name ?? 'Giáo viên'},
          ${row.updated_at}, ${row.updated_at})
        returning id`.execute(database);
      const setId = set.rows[0]?.id;
      if (!setId) {
        continue;
      }
      const seenNames = new Set<string>();
      const seenChildren = new Set<string>();
      let position = 0;
      for (const group of groups) {
        const name = typeof group.name === 'string' ? group.name.trim().slice(0, 60) : '';
        if (name === '' || seenNames.has(name)) {
          continue;
        }
        seenNames.add(name);
        position += 1;
        const created = await sql<{ id: string }>`insert into child_groups
            (org_unit_id, name, created_by, group_set_id, class_id, position)
          values (${row.org_unit_id}, ${name}, ${row.owner_user_id}, ${setId}, ${row.class_id}, ${position})
          returning id`.execute(database);
        const groupId = created.rows[0]?.id;
        const childIds = Array.isArray(group.child_ids)
          ? group.child_ids.filter((id): id is string => typeof id === 'string' && !seenChildren.has(id))
          : [];
        for (const childId of childIds) {
          const inserted = await sql`insert into child_group_members (group_id, child_id, added_by)
            select ${groupId}, class_enrollments.child_id, ${row.owner_user_id}
            from class_enrollments
            where class_enrollments.class_id = ${row.class_id} and class_enrollments.child_id = ${childId}
            limit 1`.execute(database);
          if (Number(inserted.numAffectedRows ?? 0) > 0) {
            seenChildren.add(childId);
          }
        }
      }
    }
  },
  async down(database) {
    const sets = sql`select id from group_sets where params ->> 'source' = 'classroom_groupings'`;
    await sql`delete from child_group_members where group_id in
      (select id from child_groups where group_set_id in (${sets}))`.execute(database);
    await sql`delete from child_groups where group_set_id in (${sets})`.execute(database);
    await sql`delete from group_sets where id in (${sets})`.execute(database);
  },
};
