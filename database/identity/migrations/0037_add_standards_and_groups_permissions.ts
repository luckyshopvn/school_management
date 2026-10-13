import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Quyền của DT-14 phần 14c (YCTD-102): hoàn thành chương trình giáo dục mầm non, nhóm trẻ, đánh giá chuẩn nghề nghiệp
const PERMISSIONS = [
  {
    code: 'P02.program-completion.manage',
    module: 'P02',
    description:
      'Ghi kết quả hoàn thành chương trình giáo dục mầm non của trẻ mẫu giáo 5-6 tuổi (giáo viên chỉ lớp chủ nhiệm)',
    roleCodes: ['VT-03', 'VT-07'],
  },
  {
    code: 'P02.program-completion.approve',
    module: 'P02',
    description: 'Xác nhận, hủy xác nhận danh sách hoàn thành chương trình của lớp',
    roleCodes: ['VT-02', 'VT-15'],
  },
  {
    code: 'P02.child-group.manage',
    module: 'P02',
    description: 'Lập nhóm trẻ trong đơn vị, thêm, bớt trẻ của nhóm',
    roleCodes: ['VT-02', 'VT-15', 'VT-03'],
  },
  {
    code: 'P07.professional-standard.manage',
    module: 'P07',
    description: 'Sửa danh mục tiêu chuẩn, tiêu chí chuẩn nghề nghiệp; đánh giá chuẩn hiệu trưởng',
    roleCodes: ['VT-02'],
  },
  {
    code: 'P07.professional-standard.assess',
    module: 'P07',
    description: 'Mở phiếu và đánh giá chuẩn nghề nghiệp giáo viên trong đơn vị',
    roleCodes: ['VT-02', 'VT-03'],
  },
];

export const migration: Migration = {
  async up(database) {
    for (const permission of PERMISSIONS) {
      await sql`insert into permissions (code, module_code, description)
        values (${permission.code}, ${permission.module}, ${permission.description})`.execute(database);
      await sql`insert into role_permissions (role_id, permission_id)
        select roles.id, permissions.id from roles, permissions
        where roles.code in (${sql.join(permission.roleCodes)}) and permissions.code = ${permission.code}`.execute(
        database,
      );
    }
  },
  async down(database) {
    for (const permission of PERMISSIONS) {
      await sql`delete from role_permissions where permission_id in (select id from permissions where code = ${permission.code})`.execute(
        database,
      );
      await sql`delete from permissions where code = ${permission.code}`.execute(database);
    }
  },
};
