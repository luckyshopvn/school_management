import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// YCTD-341: ma trận quyền (tài liệu 08 mục 3) ghi Hiệu trưởng (VT-02), Phó Hiệu trưởng (VT-15) được phê duyệt ở P16 Tuyển sinh,
// nhưng 0035 chỉ cấp quyền xét duyệt hồ sơ cho VT-03 nên Ban Giám hiệu mở 1. Tuyển sinh bị 403. Cấp `P16.application.review`
// (xem đợt, hồ sơ, xét đạt hoặc không đạt) cho VT-02, VT-15; lập đợt, tiếp nhận hồ sơ vẫn của VT-12, VT-03
const PERMISSION_CODE = 'P16.application.review';
const ROLE_CODES = ['VT-02', 'VT-15'];

export const migration: Migration = {
  async up(database) {
    await sql`insert into role_permissions (role_id, permission_id)
      select roles.id, permissions.id from roles, permissions
      where roles.code in (${sql.join(ROLE_CODES)}) and permissions.code = ${PERMISSION_CODE}
      on conflict do nothing`.execute(database);
  },
  async down(database) {
    await sql`delete from role_permissions
      where role_id in (select id from roles where code in (${sql.join(ROLE_CODES)}))
      and permission_id in (select id from permissions where code = ${PERMISSION_CODE})`.execute(database);
  },
};
