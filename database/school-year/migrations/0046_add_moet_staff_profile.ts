import type { Migration } from 'kysely/migration';

// Nhập tệp xuất từ cơ sở dữ liệu ngành cho nhân sự (DT-13 phần 13a, YCTD-100):
// - `staff.moet_staff_code`: mã định danh Bộ GD&ĐT, không trùng, dùng để nhận ra nhân sự khi nhập lại;
// - `staff.moet_profile`: mọi cột của tệp không có cột riêng trong hồ sơ nhân sự (vị trí việc làm, ngạch hạng, bậc lương,
//   hệ số, phụ cấp, trình độ, đánh giá...), khóa tiếng Anh cố định (xem apps/api/src/imports/moet-columns.ts); số sổ bảo
//   hiểm xã hội chỉ lưu dạng mã hóa kèm bốn số cuối
export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('staff')
      .addColumn('moet_staff_code', 'text', (column) => column.unique())
      .addColumn('moet_profile', 'jsonb')
      .execute();
  },
  async down(database) {
    await database.schema.alterTable('staff').dropColumn('moet_profile').dropColumn('moet_staff_code').execute();
  },
};
