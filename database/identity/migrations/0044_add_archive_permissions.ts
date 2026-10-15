import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-15 phần 15h2 (YCTD-117). Văn thư lưu trữ (mục 5.10 của Sở) thuộc phân hệ P09 Công việc, kế hoạch, đánh giá; quyền
// tách theo thao tác: xem hồ sơ, phông, thông tin và báo cáo lưu trữ; quản lý (thêm, sửa, xóa, đính kèm tệp); xuất Excel.
// Trường mầm non thường giao văn thư cho kế toán hoặc nhân viên hành chính nên VT-04, VT-06 có đủ ba quyền như Hiệu
// trưởng; Phó Hiệu trưởng xem và xuất; Quản lý đơn vị chỉ xem
const PERMISSIONS = [
  {
    code: 'P09.archive.view',
    description: 'Xem hồ sơ tài liệu, phông lưu trữ, thông tin lưu trữ và báo cáo lưu trữ',
    roles: ['VT-02', 'VT-15', 'VT-03', 'VT-04', 'VT-06'],
  },
  {
    code: 'P09.archive.manage',
    description: 'Thêm, sửa, xóa hồ sơ tài liệu, phông lưu trữ, thông tin lưu trữ và tệp đính kèm của hồ sơ',
    roles: ['VT-02', 'VT-04', 'VT-06'],
  },
  {
    code: 'P09.archive.export',
    description: 'Xuất Excel danh sách hồ sơ tài liệu và báo cáo lưu trữ',
    roles: ['VT-02', 'VT-15', 'VT-04', 'VT-06'],
  },
];

export const migration: Migration = {
  async up(database) {
    for (const permission of PERMISSIONS) {
      await sql`insert into permissions (code, module_code, description)
        values (${permission.code}, 'P09', ${permission.description})`.execute(database);
      await sql`insert into role_permissions (role_id, permission_id)
        select roles.id, permissions.id from roles, permissions
        where roles.code in (${sql.join(permission.roles)}) and permissions.code = ${permission.code}`.execute(
        database,
      );
    }
  },
  async down(database) {
    const codes = PERMISSIONS.map((permission) => permission.code);
    await sql`delete from role_permissions where permission_id in
      (select id from permissions where code in (${sql.join(codes)}))`.execute(database);
    await sql`delete from permissions where code in (${sql.join(codes)})`.execute(database);
  },
};
