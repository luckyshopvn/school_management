import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Hồ sơ học sinh đủ theo hệ thống của Sở (DT-16 phần 16g):
// - `class_enrollments.order_number`: số thứ tự cố định của học sinh trong lớp (mục 4.1.3 "Sắp xếp học sinh"); đặt trên
//   dòng lớp đang học nên chuyển lớp thì học sinh về cuối lớp mới, chuyển năm học cùng dòng lớp;
// - `children.deleted_at`, `deleted_by`: xóa hồ sơ nháp, hồ sơ bị từ chối theo nút "Xóa" của Sở; không xóa cứng, hồ sơ
//   đã xóa không hiện ở mọi danh sách;
// - `children.national_id_verified_*`, `residence_change_note`: thu thập, xác thực số định danh với CSDLQG chạy nội bộ
//   (mục 4.1.8–4.1.9): đánh dấu đã xác thực kèm ngày, người; biến động cư trú ghi tay;
// - `student_learning_accounts`: tài khoản học và thi của học sinh (mục 4.1.10) lưu nội bộ, mật khẩu chỉ lưu giá trị băm;
// - `student_transfers`: chuyển đi (chờ duyệt, đã duyệt, từ chối) và tiếp nhận chuyển đến giữa các trường chạy nội bộ (mục
//   4.2), hồ sơ chuyển là tệp theo mẫu của Bộ
// - loại nhập mới của `data_import_jobs`: điện thoại nhận tin, số định danh, địa chỉ mới của học sinh. Danh sách giữ cả loại
//   `professional_ratings` của phần 16f (tệp 0055) vì hai tệp chạy được theo thứ tự bất kỳ
const IMPORT_TYPES_BEFORE = [
  'classes',
  'children',
  'moet_codes',
  'opening_debts',
  'staff',
  'moet_children',
  'moet_staff',
  'professional_ratings',
];
const IMPORT_TYPES_AFTER = [...IMPORT_TYPES_BEFORE, 'sms_phones', 'national_ids', 'student_addresses'];

const typeList = (types: string[]) => sql.raw(types.map((type) => `'${type}'`).join(', '));

export const migration: Migration = {
  async up(database) {
    await database.schema.alterTable('class_enrollments').addColumn('order_number', 'integer').execute();
    await database.schema
      .alterTable('children')
      .addColumn('deleted_at', 'timestamptz')
      .addColumn('deleted_by', 'uuid')
      .addColumn('national_id_verified_at', 'timestamptz')
      .addColumn('national_id_verified_by', 'uuid')
      .addColumn('national_id_verified_by_name', 'text')
      .addColumn('residence_change_note', 'text')
      .execute();

    await database.schema
      .createTable('student_learning_accounts')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('child_id', 'uuid', (column) => column.notNull().unique().references('children.id'))
      .addColumn('username', 'text', (column) => column.notNull().unique())
      .addColumn('password_hash', 'text', (column) => column.notNull())
      .addColumn('issued_at', 'timestamptz', (column) => column.notNull())
      .addColumn('issued_by_name', 'text', (column) => column.notNull())
      .addColumn('reset_count', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('created_by', 'uuid')
      .execute();

    await database.schema
      .createTable('student_transfers')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('direction', 'text', (column) => column.notNull().check(sql`direction in ('out', 'in')`))
      .addColumn('status', 'text', (column) =>
        column.notNull().check(sql`status in ('pending', 'approved', 'rejected', 'received')`),
      )
      .addColumn('child_id', 'uuid', (column) => column.references('children.id'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('full_name', 'text', (column) => column.notNull())
      .addColumn('dob', 'date')
      .addColumn('school_name', 'text', (column) => column.notNull())
      .addColumn('province_name', 'text')
      .addColumn('ward_name', 'text')
      .addColumn('transfer_date', 'date', (column) => column.notNull())
      .addColumn('reason', 'text')
      .addColumn('requested_by_name', 'text', (column) => column.notNull())
      .addColumn('decided_by', 'uuid')
      .addColumn('decided_by_name', 'text')
      .addColumn('decided_at', 'timestamptz')
      .addColumn('decision_note', 'text')
      .addColumn('file_id', 'uuid', (column) => column.references('files.id'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('created_by', 'uuid')
      .execute();
    await database.schema
      .createIndex('student_transfers_direction_date_index')
      .on('student_transfers')
      .columns(['direction', 'transfer_date'])
      .execute();
    // Mỗi học sinh có tối đa một đề nghị chuyển đi đang chờ duyệt
    await sql`create unique index student_transfers_pending_out_unique on student_transfers (child_id)
      where direction = 'out' and status = 'pending'`.execute(database);

    await sql`alter table data_import_jobs drop constraint data_import_jobs_type_check`.execute(database);
    await sql`alter table data_import_jobs add constraint data_import_jobs_type_check
      check (import_type in (${typeList(IMPORT_TYPES_AFTER)}))`.execute(database);
  },
  async down(database) {
    await sql`delete from data_import_jobs where import_type in ('sms_phones', 'national_ids', 'student_addresses')`.execute(
      database,
    );
    await sql`alter table data_import_jobs drop constraint data_import_jobs_type_check`.execute(database);
    await sql`alter table data_import_jobs add constraint data_import_jobs_type_check
      check (import_type in (${typeList(IMPORT_TYPES_BEFORE)}))`.execute(database);
    await database.schema.dropTable('student_transfers').execute();
    await database.schema.dropTable('student_learning_accounts').execute();
    await database.schema
      .alterTable('children')
      .dropColumn('deleted_at')
      .dropColumn('deleted_by')
      .dropColumn('national_id_verified_at')
      .dropColumn('national_id_verified_by')
      .dropColumn('national_id_verified_by_name')
      .dropColumn('residence_change_note')
      .execute();
    await database.schema.alterTable('class_enrollments').dropColumn('order_number').execute();
  },
};
