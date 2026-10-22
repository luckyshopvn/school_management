import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-18 phần 22d (YCTD-148). Thi đua, khen thưởng là phân hệ riêng của cổng quản trị, quyền thuộc P09 như các phần khác của
// DT-18, tách theo thao tác. Vai trò nhận quyền do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - tham gia: đăng ký thi đua, lập hồ sơ đề nghị của mình (tổ trưởng lập cho tổ), gửi phúc khảo, khiếu nại; thành viên hội
//   đồng do người quản lý chọn trong số người có quyền này: mọi cán bộ, giáo viên, nhân viên dùng cổng quản trị;
// - quản lý (thường trực hội đồng): danh mục danh hiệu, đợt thi đua, duyệt đăng ký, tiếp nhận hồ sơ, hội đồng, phiên họp,
//   công bố kết quả, giải quyết phúc khảo, khiếu nại, dự thảo quyết định, sổ theo dõi, báo cáo: Ban Giám hiệu;
// - ban hành quyết định khen thưởng, tờ trình đề nghị cấp trên: Hiệu trưởng.
// Phụ huynh (VT-14) không có phân hệ "Thi đua, khen thưởng" ở 1.2 Phân quyền nhóm theo phần mềm
const WORKSPACE_KEY = 'emulation';
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
    code: 'P09.emulation.use',
    description:
      'Tham gia thi đua: đăng ký thi đua, lập hồ sơ đề nghị khen thưởng của mình (tổ trưởng lập cho tổ), bỏ phiếu khi là thành viên hội đồng, phúc khảo, khiếu nại',
    roles: STAFF_ROLES,
  },
  {
    code: 'P09.emulation.manage',
    description:
      'Quản lý thi đua, khen thưởng: danh mục danh hiệu, đợt thi đua, duyệt đăng ký, tiếp nhận hồ sơ, hội đồng, phiên họp, công bố kết quả, giải quyết phúc khảo, khiếu nại, sổ theo dõi, báo cáo',
    roles: ['VT-02', 'VT-15'],
  },
  {
    code: 'P09.emulation.decide',
    description: 'Ban hành quyết định khen thưởng, tờ trình đề nghị cấp trên khen thưởng',
    roles: ['VT-02'],
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
