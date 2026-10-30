import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Giám thị và rèn luyện từng học sinh, lát L1 (YCTD-391; Eric duyệt ngày 2026-10-30): vai trò mẫu VT-22 "Giám thị, nề nếp" và
// hai quyền mới. Trường đổi tên hiển thị của vai được (tổng phụ trách Đội ở Tiểu học, giám thị ở Trung học), hoặc gán các quyền
// này cho vai khác. Người ghi nhận vi phạm, khen: giám thị, giáo viên chủ nhiệm, giáo viên bộ môn (Eric chọn); Quản lý đơn vị
// cùng quyền như nề nếp lớp. Vai VT-22 nhận các quyền nền của nhân viên như Bảo vệ (VT-18) trừ quyền ở cổng đón trẻ, và quyền
// ghi điểm nề nếp lớp (giám thị trực tuần ghi thay đội sao đỏ)
const SUPERVISOR_ROLE = { code: 'VT-22', name: 'Giám thị, nề nếp' };
const SUPERVISOR_BASE_PERMISSIONS = [
  'P02.view',
  'P04.view',
  'P09.kpi.participate',
  'P13.purchase-request.create',
  'P19.view',
  'P02.conduct.record',
];
const PERMISSIONS = [
  {
    code: 'P02.supervision.record',
    description:
      'Rèn luyện học sinh: ghi nhận vi phạm, khen của học sinh trong phạm vi được phân công; xem danh mục nội quy',
    roles: ['VT-02', 'VT-15', 'VT-03', 'VT-07', 'VT-08', SUPERVISOR_ROLE.code],
  },
  {
    code: 'P02.supervision.manage',
    description: 'Rèn luyện học sinh: danh mục nội quy, khu vực trong trường, phân công giám thị trực',
    roles: ['VT-02', 'VT-15'],
  },
];

export const migration: Migration = {
  async up(database) {
    await sql`insert into roles (code, name, is_system)
      values (${SUPERVISOR_ROLE.code}, ${SUPERVISOR_ROLE.name}, true)`.execute(database);
    for (const permission of PERMISSIONS) {
      await sql`insert into permissions (code, module_code, description)
        values (${permission.code}, 'P02', ${permission.description})`.execute(database);
      await sql`insert into role_permissions (role_id, permission_id)
        select roles.id, permissions.id from roles, permissions
        where roles.code in (${sql.join(permission.roles)}) and permissions.code = ${permission.code}`.execute(
        database,
      );
    }
    await sql`insert into role_permissions (role_id, permission_id)
      select roles.id, permissions.id from roles, permissions
      where roles.code = ${SUPERVISOR_ROLE.code} and permissions.code in (${sql.join(SUPERVISOR_BASE_PERMISSIONS)})
      on conflict do nothing`.execute(database);
  },
  async down(database) {
    await sql`delete from role_permissions where role_id in (select id from roles where code = ${SUPERVISOR_ROLE.code})
      or permission_id in (select id from permissions where code in (${sql.join(PERMISSIONS.map((item) => item.code))}))`.execute(
      database,
    );
    await sql`delete from permissions where code in (${sql.join(PERMISSIONS.map((item) => item.code))})`.execute(
      database,
    );
    await sql`delete from roles where code = ${SUPERVISOR_ROLE.code}`.execute(database);
  },
};
