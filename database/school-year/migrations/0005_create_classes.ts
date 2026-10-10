import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Lớp học và phân công giáo viên vào lớp (P02-05, BR-02, YCTD-44)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('classes')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('academic_year_id', 'uuid', (column) => column.notNull())
      .addColumn('code', 'text', (column) => column.notNull())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('grade_level', 'text', (column) => column.notNull())
      .addColumn('room_id', 'uuid', (column) => column.references('rooms.id'))
      .addColumn('max_size', 'integer', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('created_by', 'uuid')
      .addCheckConstraint('classes_status_check', sql`status in ('active', 'closed')`)
      .addCheckConstraint('classes_max_size_check', sql`max_size > 0`)
      .addUniqueConstraint('classes_unit_code_unique', ['org_unit_id', 'code'])
      .execute();
    await database.schema.createIndex('classes_org_unit_id_index').on('classes').column('org_unit_id').execute();

    await database.schema
      .createTable('class_staff_assignments')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      // Tạm là mã tài khoản ở dịch vụ định danh; chuyển sang hồ sơ nhân sự khi có P07 (YCTD-44)
      .addColumn('staff_user_id', 'uuid', (column) => column.notNull())
      // Họ tên lúc phân công để hiển thị mà không phải hỏi dịch vụ định danh
      .addColumn('staff_name', 'text', (column) => column.notNull())
      .addColumn('assignment_role', 'text', (column) => column.notNull())
      .addColumn('subject_name', 'text')
      .addColumn('from_date', 'date', (column) => column.notNull())
      .addColumn('to_date', 'date')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('created_by', 'uuid')
      .addCheckConstraint('class_staff_assignments_role_check', sql`assignment_role in ('homeroom', 'subject')`)
      .addCheckConstraint('class_staff_assignments_status_check', sql`status in ('active', 'ended')`)
      .addCheckConstraint(
        'class_staff_assignments_subject_check',
        sql`assignment_role = 'homeroom' or subject_name is not null`,
      )
      .execute();
    // Không gán trùng cùng người, cùng vai trò vào một lớp khi phân công còn hiệu lực
    await sql`create unique index class_staff_assignments_single_active on class_staff_assignments
      (class_id, staff_user_id, assignment_role) where status = 'active'`.execute(database);
    await database.schema
      .createIndex('class_staff_assignments_staff_user_id_index')
      .on('class_staff_assignments')
      .column('staff_user_id')
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('class_staff_assignments').execute();
    await database.schema.dropTable('classes').execute();
  },
};
