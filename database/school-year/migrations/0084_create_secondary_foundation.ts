import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-21 phần 21a (YCTD-167): nền THCS, THPT. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - `subjects.assessment` thêm giá trị `score` (môn đánh giá bằng điểm số, Thông tư 22/2021) và cột `option_group` (nhóm môn
//   học lựa chọn của THPT); môn cũ giữ nguyên, nhóm trống;
// - `subject_combinations`, `subject_combination_subjects`: tổ hợp môn của THPT do trường xây dựng từ các môn lựa chọn;
// - `child_subject_combinations`: tổ hợp học sinh đăng ký, mỗi học sinh một dòng; đổi tổ hợp đã duyệt thì chờ duyệt
//   (`pending`), giữ tổ hợp cũ ở `previous_combination_id` cho đến khi duyệt;
// - `subject_teams`, `subject_team_subjects`, `subject_team_members`: tổ bộ môn (tổ chuyên môn) gồm các môn, tổ trưởng,
//   thành viên (người trong tổ chọn từ giáo viên bộ môn của đơn vị).
const levelCheck = sql`school_level in ('THCS', 'THPT')`;
const statusCheck = sql`status in ('active', 'inactive')`;

export const migration: Migration = {
  async up(database) {
    await sql`alter table subjects drop constraint subjects_assessment_check`.execute(database);
    await sql`alter table subjects add constraint subjects_assessment_check
      check (assessment in ('comment', 'comment_and_score', 'score'))`.execute(database);
    await database.schema
      .alterTable('subjects')
      .addColumn('option_group', 'text', (column) =>
        column.check(
          sql`option_group is null or option_group in ('social_science', 'natural_science', 'technology_arts')`,
        ),
      )
      .execute();

    await database.schema
      .createTable('subject_combinations')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) =>
        column
          .notNull()
          .unique()
          .check(sql`char_length(code) between 1 and 30`),
      )
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 200`))
      .addColumn('school_level', 'text', (column) => column.notNull().check(levelCheck))
      .addColumn('order_no', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active').check(statusCheck))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('created_by', 'uuid')
      .execute();

    await database.schema
      .createTable('subject_combination_subjects')
      .addColumn('combination_id', 'uuid', (column) =>
        column.notNull().references('subject_combinations.id').onDelete('cascade'),
      )
      .addColumn('subject_id', 'uuid', (column) => column.notNull().references('subjects.id'))
      .addPrimaryKeyConstraint('subject_combination_subjects_pkey', ['combination_id', 'subject_id'])
      .execute();

    await database.schema
      .createTable('child_subject_combinations')
      .addColumn('child_id', 'uuid', (column) => column.primaryKey().references('children.id').onDelete('cascade'))
      .addColumn('combination_id', 'uuid', (column) => column.notNull().references('subject_combinations.id'))
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('approved')
          .check(sql`status in ('pending', 'approved')`),
      )
      .addColumn('previous_combination_id', 'uuid', (column) => column.references('subject_combinations.id'))
      .addColumn('requested_by', 'uuid')
      .addColumn('approved_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createTable('subject_teams')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) =>
        column
          .notNull()
          .unique()
          .check(sql`char_length(code) between 1 and 30`),
      )
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 200`))
      .addColumn('school_level', 'text', (column) => column.notNull().check(levelCheck))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active').check(statusCheck))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('created_by', 'uuid')
      .execute();

    await database.schema
      .createTable('subject_team_subjects')
      .addColumn('team_id', 'uuid', (column) => column.notNull().references('subject_teams.id').onDelete('cascade'))
      .addColumn('subject_id', 'uuid', (column) => column.notNull().references('subjects.id'))
      .addPrimaryKeyConstraint('subject_team_subjects_pkey', ['team_id', 'subject_id'])
      .execute();

    await database.schema
      .createTable('subject_team_members')
      .addColumn('team_id', 'uuid', (column) => column.notNull().references('subject_teams.id').onDelete('cascade'))
      .addColumn('staff_user_id', 'uuid', (column) => column.notNull())
      .addColumn('staff_name', 'text', (column) => column.notNull())
      .addColumn('role', 'text', (column) =>
        column
          .notNull()
          .defaultTo('member')
          .check(sql`role in ('head', 'member')`),
      )
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addPrimaryKeyConstraint('subject_team_members_pkey', ['team_id', 'staff_user_id'])
      .execute();
    // Mỗi tổ một tổ trưởng
    await sql`create unique index subject_team_members_single_head on subject_team_members (team_id)
      where role = 'head'`.execute(database);
  },
  async down(database) {
    await database.schema.dropTable('subject_team_members').execute();
    await database.schema.dropTable('subject_team_subjects').execute();
    await database.schema.dropTable('subject_teams').execute();
    await database.schema.dropTable('child_subject_combinations').execute();
    await database.schema.dropTable('subject_combination_subjects').execute();
    await database.schema.dropTable('subject_combinations').execute();
    await database.schema.alterTable('subjects').dropColumn('option_group').execute();
    await sql`alter table subjects drop constraint subjects_assessment_check`.execute(database);
    await sql`alter table subjects add constraint subjects_assessment_check
      check (assessment in ('comment', 'comment_and_score'))`.execute(database);
  },
};
