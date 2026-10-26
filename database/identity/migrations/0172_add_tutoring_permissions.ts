import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Gia sư trong trường (DT-27 phần 27b, YCTD-252): quyền và phân hệ "Gia sư trực tuyến" của cổng quản trị. Số 0172 lấy ở dải định
// danh của DT-27 (0170 đến 0179; 27a không dùng định danh), kho mã bật allowUnorderedMigrations. Claude tự chọn theo ủy quyền của
// Eric ngày 2026-10-11:
// - P02.tutoring.manage (duyệt chương trình, duyệt đơn, quyết định tăng thời lượng của Sở, quy định dạy thêm): Hiệu trưởng, Phó
//   Hiệu trưởng;
// - P02.tutoring.teach (lập chương trình, xếp buổi, điểm danh, duyệt đơn của lớp mình chủ nhiệm, nhắn cha mẹ): giáo viên chủ nhiệm,
//   giáo viên bộ môn, tổ trưởng chuyên môn và Ban Giám hiệu;
// - cha mẹ đăng ký trên ứng dụng phụ huynh theo quan hệ phụ huynh với học sinh, không cần quyền riêng; phân hệ không hiện cho Phụ
//   huynh (VT-14) và Học sinh (VT-21) ở cổng quản trị.
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

export const migration: Migration = {
  async up(database) {
    for (const permission of PERMISSIONS) {
      await sql`insert into permissions (code, module_code, description)
        values (${permission.code}, 'P02', ${permission.description})`.execute(database);
      await sql`insert into role_permissions (role_id, permission_id)
        select roles.id, permissions.id from roles, permissions
        where roles.code in (${sql.join(permission.roles)}) and permissions.code = ${permission.code}`.execute(
        database,
      );
    }
    await sql`insert into role_workspace_exclusions (role_id, workspace_key)
      select roles.id, ${WORKSPACE_KEY} from roles where roles.code in ('VT-14', 'VT-21')
      on conflict do nothing`.execute(database);
  },
  async down(database) {
    await sql`delete from role_workspace_exclusions where workspace_key = ${WORKSPACE_KEY}`.execute(database);
    const codes = PERMISSIONS.map((permission) => permission.code);
    await sql`delete from role_permissions where permission_id in
      (select id from permissions where code in (${sql.join(codes)}))`.execute(database);
    await sql`delete from permissions where code in (${sql.join(codes)})`.execute(database);
  },
};
