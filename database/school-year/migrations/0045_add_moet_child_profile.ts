import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Nhập tệp xuất từ cơ sở dữ liệu ngành (CSDL ngành) cho trẻ (DT-13 phần 13a, YCTD-100):
// - `children.moet_profile`: mọi cột của tệp không có cột riêng trong hồ sơ trẻ, khóa tiếng Anh cố định (xem
//   apps/api/src/imports/moet-columns.ts); số căn cước, hộ chiếu chỉ lưu dạng mã hóa kèm bốn số cuối;
// - `guardians.birth_year`, `guardians.id_number_encrypted`, `guardians.id_number_last4`: năm sinh và số định danh của
//   cha, mẹ, người giám hộ; số định danh mã hóa như số định danh của trẻ (BM-64);
// - `data_import_jobs.preview`: số dòng tạo mới, cập nhật, bỏ qua và ghi chú từng dòng khi kiểm tra tệp;
// - loại nhập `moet_children` và `moet_staff` (nhân sự ở 0046)
export const migration: Migration = {
  async up(database) {
    await database.schema.alterTable('children').addColumn('moet_profile', 'jsonb').execute();
    await database.schema
      .alterTable('guardians')
      .addColumn('birth_year', 'integer')
      .addColumn('id_number_encrypted', 'text')
      .addColumn('id_number_last4', 'text')
      .execute();
    await database.schema.alterTable('data_import_jobs').addColumn('preview', 'jsonb').execute();
    await sql`alter table data_import_jobs drop constraint data_import_jobs_type_check`.execute(database);
    await sql`alter table data_import_jobs add constraint data_import_jobs_type_check
      check (import_type in ('classes', 'children', 'moet_codes', 'opening_debts', 'staff', 'moet_children',
        'moet_staff'))`.execute(database);
  },
  async down(database) {
    await sql`delete from data_import_jobs where import_type in ('moet_children', 'moet_staff')`.execute(database);
    await sql`alter table data_import_jobs drop constraint data_import_jobs_type_check`.execute(database);
    await sql`alter table data_import_jobs add constraint data_import_jobs_type_check
      check (import_type in ('classes', 'children', 'moet_codes', 'opening_debts', 'staff'))`.execute(database);
    await database.schema.alterTable('data_import_jobs').dropColumn('preview').execute();
    await database.schema
      .alterTable('guardians')
      .dropColumn('birth_year')
      .dropColumn('id_number_encrypted')
      .dropColumn('id_number_last4')
      .execute();
    await database.schema.alterTable('children').dropColumn('moet_profile').execute();
  },
};
