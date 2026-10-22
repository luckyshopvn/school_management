import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-18 phần 22f (YCTD-149). Bảo đảm chất lượng là phân hệ riêng của cổng quản trị, quyền thuộc P09 (công việc, kế hoạch,
// đánh giá). Vai trò nhận quyền do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - tham gia tự đánh giá: mọi cán bộ, giáo viên, nhân viên dùng cổng quản trị; người có quyền chỉ thấy đợt mình là thành viên
//   hội đồng hoặc nhóm công tác, soạn phiếu và thêm minh chứng cho tiêu chí được phân công cho nhóm mình;
// - quản lý: bộ tiêu chuẩn, đợt tự đánh giá, hội đồng, nhóm công tác, duyệt phiếu, kế hoạch cải tiến, báo cáo, công nhận:
//   Ban Giám hiệu.
// Phụ huynh (VT-14) không có phân hệ "Bảo đảm chất lượng" ở 1.2 Phân quyền nhóm theo phần mềm
const WORKSPACE_KEY = 'quality-assurance';
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
    code: 'P09.quality.use',
    description:
      'Tham gia tự đánh giá chất lượng: soạn phiếu đánh giá tiêu chí, thêm minh chứng cho tiêu chí của nhóm công tác của mình',
    roles: STAFF_ROLES,
  },
  {
    code: 'P09.quality.manage',
    description:
      'Quản lý bảo đảm chất lượng: bộ tiêu chuẩn, đợt tự đánh giá, hội đồng, nhóm công tác, duyệt phiếu, kế hoạch cải tiến, báo cáo, công nhận',
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
