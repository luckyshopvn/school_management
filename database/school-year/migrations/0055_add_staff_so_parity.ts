import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Nhân sự đủ tính năng theo hệ thống của Sở (DT-16 phần 16f):
// - `staff`: tài khoản ngân hàng, tên ngân hàng, mã số thuế (mục 5.9 của Sở); nhân sự ở xã đặc biệt khó khăn (lọc "xã ĐBKK"
//   của mục 3.1.4, tệp CSDL ngành không có thông tin này nên đánh dấu theo từng nhân sự); trạng thái xác thực số định danh
//   với CSDLQG về dân cư bản chạy nội bộ (mục 3.1.5): chưa xác thực, đã xác thực, sai thông tin, kèm ngày, người đánh dấu,
//   ghi chú. Cột riêng (không để ở `moet_profile`) vì nhập lại tệp CSDL ngành thay toàn bộ `moet_profile`;
// - `staff_branch_assignments`: phân hiệu, điểm trường nhân sự làm việc ngoài đơn vị chính (mục 3.1.2), gán tay hoặc lấy theo
//   lớp đang phân công giảng dạy;
// - `staff_movements`: biến động nhân sự (mục 3.5): tiếp nhận chuyển đến, chuyển đi, đi thỉnh giảng, đến thỉnh giảng. Chưa
//   liên thông giữa các trường nên mỗi trường tự ghi; `dossier` là bản chụp hồ sơ lúc lập (chuyển đi) hoặc nội dung đọc từ
//   tệp hồ sơ chuyển (chuyển đến);
// - loại nhập `professional_ratings`: nhập mức đánh giá chuẩn nghề nghiệp từ Excel (mục 3.2)
const IMPORT_TYPES_BEFORE = [
  'classes',
  'children',
  'moet_codes',
  'opening_debts',
  'staff',
  'moet_children',
  'moet_staff',
];

export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('staff')
      .addColumn('bank_account_number', 'text')
      .addColumn('bank_name', 'text')
      .addColumn('tax_code', 'text')
      .addColumn('special_difficulty_commune', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('id_verification_status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('unverified')
          .check(sql`id_verification_status in ('unverified', 'verified', 'invalid')`),
      )
      .addColumn('id_verified_at', 'timestamptz')
      .addColumn('id_verified_by', 'uuid')
      .addColumn('id_verified_by_name', 'text')
      .addColumn('id_verification_note', 'text')
      .execute();

    await database.schema
      .createTable('staff_branch_assignments')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('staff_id', 'uuid', (column) => column.notNull().references('staff.id').onDelete('cascade'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('source', 'text', (column) => column.notNull().check(sql`source in ('manual', 'teaching')`))
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('staff_branch_assignments_unique', ['staff_id', 'org_unit_id'])
      .execute();

    await database.schema
      .createTable('staff_movements')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('movement_type', 'text', (column) =>
        column.notNull().check(sql`movement_type in ('transfer_in', 'transfer_out', 'guest_out', 'guest_in')`),
      )
      .addColumn('status', 'text', (column) =>
        column.notNull().defaultTo('pending').check(sql`status in ('pending', 'approved', 'rejected')`),
      )
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('staff_id', 'uuid', (column) => column.references('staff.id').onDelete('set null'))
      .addColumn('full_name', 'text', (column) => column.notNull())
      .addColumn('dob', 'date')
      .addColumn('gender', 'text', (column) => column.check(sql`gender in ('male', 'female')`))
      .addColumn('other_province', 'text')
      .addColumn('other_ward', 'text')
      .addColumn('other_school', 'text')
      .addColumn('movement_date', 'date', (column) => column.notNull())
      .addColumn('end_date', 'date')
      .addColumn('subject', 'text')
      .addColumn('decision_no', 'text')
      .addColumn('reason', 'text')
      .addColumn('note', 'text')
      .addColumn('confirmed', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('confirmed_on', 'date')
      .addColumn('dossier', 'jsonb')
      .addColumn('decided_by', 'uuid')
      .addColumn('decided_by_name', 'text')
      .addColumn('decided_at', 'timestamptz')
      .addColumn('decision_note', 'text')
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('staff_movements_dates_check', sql`end_date is null or end_date >= movement_date`)
      .execute();
    await database.schema
      .createIndex('staff_movements_type_index')
      .on('staff_movements')
      .columns(['movement_type', 'movement_date'])
      .execute();

    await sql`alter table data_import_jobs drop constraint data_import_jobs_type_check`.execute(database);
    await sql`alter table data_import_jobs add constraint data_import_jobs_type_check
      check (import_type in (${sql.join([...IMPORT_TYPES_BEFORE, 'professional_ratings'].map((type) => sql.lit(type)))}))`.execute(
      database,
    );
  },
  async down(database) {
    await sql`delete from data_import_jobs where import_type = 'professional_ratings'`.execute(database);
    await sql`alter table data_import_jobs drop constraint data_import_jobs_type_check`.execute(database);
    await sql`alter table data_import_jobs add constraint data_import_jobs_type_check
      check (import_type in (${sql.join(IMPORT_TYPES_BEFORE.map((type) => sql.lit(type)))}))`.execute(database);
    await database.schema.dropTable('staff_movements').execute();
    await database.schema.dropTable('staff_branch_assignments').execute();
    await database.schema
      .alterTable('staff')
      .dropColumn('bank_account_number')
      .dropColumn('bank_name')
      .dropColumn('tax_code')
      .dropColumn('special_difficulty_commune')
      .dropColumn('id_verification_status')
      .dropColumn('id_verified_at')
      .dropColumn('id_verified_by')
      .dropColumn('id_verified_by_name')
      .dropColumn('id_verification_note')
      .execute();
  },
};
