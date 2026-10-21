import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-18 phần 22i (YCTD-147). Kế hoạch giáo dục là nhóm 5 của phân hệ Hồ sơ chuyên môn (không thêm phân hệ, phụ huynh đã bị
// loại khỏi phân hệ này ở 0056), quyền thuộc P09 tách theo bước duyệt. Vai trò nhận quyền do Claude tự chọn theo ủy quyền của
// Eric ngày 2026-10-11:
// - lập kế hoạch cá nhân, của nhóm lớp mình phụ trách: mọi cán bộ, giáo viên, nhân viên dùng cổng quản trị (như hồ sơ chuyên
//   môn); kế hoạch của tổ do tổ trưởng (hoặc trưởng nhóm công tác) lập;
// - duyệt bước tổ trưởng: Tổ trưởng chuyên môn, chỉ kế hoạch của tổ mình;
// - duyệt bước Phó Hiệu trưởng: Phó Hiệu trưởng trong phạm vi đơn vị được gán (Hiệu trưởng cũng có để duyệt thay);
// - duyệt bước Hiệu trưởng (phê duyệt cuối, kí nội bộ): Hiệu trưởng;
// - quản lý: thư viện mẫu, kế hoạch của trường, bảng tiến độ duyệt: Ban Giám hiệu
const STAFF_ROLES = [
  'VT-02',
  'VT-15',
  'VT-03',
  'VT-04',
  'VT-05',
  'VT-06',
  'VT-07',
  'VT-08',
  'VT-09',
  'VT-10',
  'VT-11',
  'VT-12',
  'VT-16',
  'VT-17',
];
const PERMISSIONS = [
  {
    code: 'P09.education-plan.use',
    description: 'Lập kế hoạch giáo dục cá nhân, của nhóm lớp phụ trách, của tổ khi là tổ trưởng; trình duyệt',
    roles: STAFF_ROLES,
  },
  {
    code: 'P09.education-plan.review',
    description: 'Duyệt kế hoạch giáo dục ở bước tổ trưởng (kế hoạch của tổ mình), trả lại',
    roles: ['VT-17'],
  },
  {
    code: 'P09.education-plan.approve',
    description: 'Duyệt kế hoạch giáo dục ở bước Phó Hiệu trưởng trong phạm vi đơn vị, trả lại',
    roles: ['VT-02', 'VT-15'],
  },
  {
    code: 'P09.education-plan.finalize',
    description: 'Phê duyệt kế hoạch giáo dục ở bước Hiệu trưởng, kí nội bộ, trả lại',
    roles: ['VT-02'],
  },
  {
    code: 'P09.education-plan.manage',
    description: 'Quản lý thư viện mẫu kế hoạch, lập kế hoạch của trường, xem tiến độ duyệt',
    roles: ['VT-02', 'VT-15'],
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
