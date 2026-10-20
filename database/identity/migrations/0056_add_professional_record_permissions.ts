import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-18 phần 18e (YCTD-142). Hồ sơ chuyên môn là phân hệ riêng của cổng quản trị, quyền thuộc P09 như các phần khác của
// DT-18, tách theo thao tác. Vai trò nhận quyền do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - dùng kho: tải hồ sơ cá nhân, hồ sơ của tổ, nhóm mình, nộp theo đợt: mọi cán bộ, giáo viên, nhân viên dùng cổng quản trị
//   (như quyền hồ sơ công việc của 18c);
// - duyệt cấp tổ: Tổ trưởng chuyên môn, chỉ hồ sơ của tổ mình (trưởng nhóm công tác duyệt hồ sơ của nhóm mình khi có quyền
//   này hoặc quyền dùng kho);
// - duyệt cấp trường và kí nội bộ: Ban Giám hiệu (Hiệu trưởng, Phó Hiệu trưởng phụ trách chuyên môn);
// - quản lý kho: cây thư mục, luồng duyệt của thư mục, đợt nộp, nhóm công tác, thống kê, khóa năm học: Ban Giám hiệu.
// Phụ huynh (VT-14) không có phân hệ "Hồ sơ chuyên môn" ở 1.2 Phân quyền nhóm theo phần mềm
const WORKSPACE_KEY = 'professional-records';
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
    code: 'P09.professional-record.use',
    description: 'Dùng kho hồ sơ chuyên môn: tải hồ sơ cá nhân, hồ sơ của tổ, nhóm mình, nộp hồ sơ theo đợt',
    roles: STAFF_ROLES,
  },
  {
    code: 'P09.professional-record.review',
    description: 'Duyệt hồ sơ chuyên môn cấp tổ (tổ trưởng chuyên môn), trả lại hồ sơ của tổ mình',
    roles: ['VT-17'],
  },
  {
    code: 'P09.professional-record.approve',
    description: 'Duyệt hồ sơ chuyên môn cấp trường, kí nội bộ, trả lại hồ sơ',
    roles: ['VT-02', 'VT-15'],
  },
  {
    code: 'P09.professional-record.manage',
    description: 'Quản lý kho hồ sơ chuyên môn: thư mục, luồng duyệt, đợt nộp, nhóm công tác, thống kê, khóa năm học',
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
    await sql`insert into role_workspace_exclusions (role_id, workspace_key)
      select roles.id, ${WORKSPACE_KEY} from roles where roles.code = 'VT-14'
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
