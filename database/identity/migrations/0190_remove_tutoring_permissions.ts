import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Bỏ chương trình gia sư trong trường DT-27 (YCTD-384 lát L3, quyết định của Eric ngày 2026-10-30): gỡ đúng những gì 0172 thêm, gồm
// quyền P02.tutoring.manage, P02.tutoring.teach, phần gán quyền cho vai trò và việc ẩn phân hệ `tutoring` với Phụ huynh (VT-14), Học
// sinh (VT-21). Đây là cấu hình nạp sẵn, tạo lại được từ 0172, không phải dữ liệu người dùng nên không cần sao lưu. Bước lùi nạp lại
// như 0172.
const WORKSPACE_KEY = 'tutoring';
const PERMISSIONS = [
  {
    code: 'P02.tutoring.manage',
    description:
      'Gia sư trong trường: duyệt chương trình, duyệt đơn đăng ký, quyết định tăng thời lượng của Sở, quy định dạy thêm',
    roles: ['VT-02', 'VT-15'],
  },
  {
    code: 'P02.tutoring.teach',
    description:
      'Gia sư trong trường: lập chương trình, xếp buổi học, điểm danh, duyệt đơn của lớp chủ nhiệm, nhắn cha mẹ',
    roles: ['VT-02', 'VT-07', 'VT-08', 'VT-15', 'VT-17'],
  },
];
const CODES = PERMISSIONS.map((permission) => permission.code);

export const migration: Migration = {
  async up(database) {
    await sql`delete from role_workspace_exclusions where workspace_key = ${WORKSPACE_KEY}`.execute(database);
    await sql`delete from role_permissions where permission_id in
      (select id from permissions where code in (${sql.join(CODES)}))`.execute(database);
    await sql`delete from permissions where code in (${sql.join(CODES)})`.execute(database);
  },
  async down(database) {
    for (const permission of PERMISSIONS) {
      await sql`insert into permissions (code, module_code, description)
        values (${permission.code}, 'P02', ${permission.description})
        on conflict (code) do nothing`.execute(database);
      await sql`insert into role_permissions (role_id, permission_id)
        select roles.id, permissions.id from roles, permissions
        where roles.code in (${sql.join(permission.roles)}) and permissions.code = ${permission.code}
        on conflict do nothing`.execute(database);
    }
    await sql`insert into role_workspace_exclusions (role_id, workspace_key)
      select roles.id, ${WORKSPACE_KEY} from roles where roles.code in ('VT-14', 'VT-21')
      on conflict do nothing`.execute(database);
  },
};
