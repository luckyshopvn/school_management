import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-20 phần 20a (YCTD-158): nền Tiểu học. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - `subjects`: môn học và hoạt động giáo dục theo cấp (mã duy nhất trong trường, loại môn, cách đánh giá); danh mục trống,
//   trường nạp bộ mẫu Tiểu học theo Chương trình giáo dục phổ thông 2018 rồi sửa;
// - `curriculum_subjects`: số tiết mỗi tuần của từng môn theo khối trong một chương trình (`curricula` của 19b), môn tự
//   chọn hay bắt buộc ở khối đó;
// - `class_staff_assignments.subject_id`, `periods_per_week`: phân công giáo viên bộ môn theo môn của danh mục; phân công
//   cũ (Mầm non, môn ghi tên tự do) giữ nguyên, môn trống. Một môn của một lớp chỉ một giáo viên đang dạy; một giáo viên dạy
//   được nhiều môn của cùng lớp;
// - `child_elective_subjects`: môn tự chọn học sinh đăng ký (hồ sơ học sinh Tiểu học).
const SCHOOL_LEVELS = `'MN', 'TH', 'THCS', 'THPT'`;

export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('subjects')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) =>
        column
          .notNull()
          .unique()
          .check(sql`char_length(code) between 1 and 30`),
      )
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 200`))
      .addColumn('school_level', 'text', (column) =>
        column.notNull().check(sql.raw(`school_level in (${SCHOOL_LEVELS})`)),
      )
      .addColumn('kind', 'text', (column) => column.notNull().defaultTo('subject'))
      .addColumn('assessment', 'text', (column) => column.notNull().defaultTo('comment'))
      .addColumn('order_no', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('created_by', 'uuid')
      .addCheckConstraint('subjects_kind_check', sql`kind in ('subject', 'activity')`)
      .addCheckConstraint('subjects_assessment_check', sql`assessment in ('comment', 'comment_and_score')`)
      .addCheckConstraint('subjects_status_check', sql`status in ('active', 'inactive')`)
      .execute();

    await database.schema
      .createTable('curriculum_subjects')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('curriculum_id', 'uuid', (column) => column.notNull().references('curricula.id').onDelete('cascade'))
      .addColumn('subject_id', 'uuid', (column) => column.notNull().references('subjects.id'))
      .addColumn('grade_level_code', 'text', (column) => column.notNull())
      .addColumn('periods_per_week', 'numeric(4, 1)', (column) =>
        column.notNull().check(sql`periods_per_week > 0 and periods_per_week <= 40`),
      )
      .addColumn('is_elective', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('curriculum_subjects_unique', ['curriculum_id', 'subject_id', 'grade_level_code'])
      .execute();

    await database.schema
      .alterTable('class_staff_assignments')
      .addColumn('subject_id', 'uuid', (column) => column.references('subjects.id'))
      .addColumn('periods_per_week', 'numeric(4, 1)', (column) =>
        column.check(sql`periods_per_week is null or (periods_per_week > 0 and periods_per_week <= 40)`),
      )
      .execute();
    // Một giáo viên dạy nhiều môn của cùng lớp: chỉ chặn trùng người, vai trò và môn; phân công cũ không có môn giữ đúng quy
    // tắc cũ (một người một vai trò mỗi lớp)
    await sql`drop index class_staff_assignments_single_active`.execute(database);
    await sql`create unique index class_staff_assignments_single_active on class_staff_assignments
      (class_id, staff_user_id, assignment_role, coalesce(subject_id, '00000000-0000-0000-0000-000000000000'::uuid))
      where status = 'active'`.execute(database);
    await sql`create unique index class_staff_assignments_single_subject on class_staff_assignments
      (class_id, subject_id) where status = 'active' and subject_id is not null`.execute(database);

    await database.schema
      .createTable('child_elective_subjects')
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id').onDelete('cascade'))
      .addColumn('subject_id', 'uuid', (column) => column.notNull().references('subjects.id'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('created_by', 'uuid')
      .addPrimaryKeyConstraint('child_elective_subjects_pkey', ['child_id', 'subject_id'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('child_elective_subjects').execute();
    await sql`drop index class_staff_assignments_single_subject`.execute(database);
    await sql`drop index class_staff_assignments_single_active`.execute(database);
    await sql`create unique index class_staff_assignments_single_active on class_staff_assignments
      (class_id, staff_user_id, assignment_role) where status = 'active'`.execute(database);
    await database.schema
      .alterTable('class_staff_assignments')
      .dropColumn('subject_id')
      .dropColumn('periods_per_week')
      .execute();
    await database.schema.dropTable('curriculum_subjects').execute();
    await database.schema.dropTable('subjects').execute();
  },
};
