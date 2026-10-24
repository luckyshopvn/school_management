import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-21 phần 21d (YCTD-171): quyền xếp sơ đồ chỗ ngồi mọi lớp (giáo viên chủ nhiệm xếp lớp mình không cần quyền này) và
// quyền cấu hình quy tắc xếp loại tiết ở sổ đầu bài theo cấp. Đội sao đỏ dùng quyền quản lý thi đua lớp có sẵn
// (`P02.conduct.manage`). Vai trò nhận quyền do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: Ban Giám hiệu
const PERMISSIONS = [
  {
    code: 'P02.seating.manage',
    module: 'P02',
    description: 'Xếp sơ đồ chỗ ngồi của mọi lớp (giáo viên chủ nhiệm xếp lớp mình)',
    roles: ['VT-02', 'VT-15'],
  },
  {
    code: 'P02.class-log.settings',
    module: 'P02',
    description: 'Cấu hình quy tắc xếp loại tiết ở sổ đầu bài theo cấp và điểm thi đua theo xếp loại tiết',
    roles: ['VT-02', 'VT-15'],
  },
];

export const migration: Migration = {
  async up(database) {
    for (const permission of PERMISSIONS) {
      await sql`insert into permissions (code, module_code, description)
        values (${permission.code}, ${permission.module}, ${permission.description})
        on conflict (code) do nothing`.execute(database);
      await sql`insert into role_permissions (role_id, permission_id)
        select roles.id, permissions.id from roles, permissions
        where roles.code in (${sql.join(permission.roles)}) and permissions.code = ${permission.code}
        on conflict do nothing`.execute(database);
    }
  },
  async down(database) {
    const codes = PERMISSIONS.map((permission) => permission.code);
    await sql`delete from role_permissions where permission_id in
      (select id from permissions where code in (${sql.join(codes)}))`.execute(database);
    await sql`delete from permissions where code in (${sql.join(codes)})`.execute(database);
  },
};
