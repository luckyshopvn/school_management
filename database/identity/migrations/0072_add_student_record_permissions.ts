import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-20 phần 20e (YCTD-163): quyền duyệt khen thưởng học sinh, xác nhận hoàn thành chương trình, kí học bạ. Giáo viên chủ
// nhiệm đề nghị khen thưởng, ghi kết quả rèn luyện, lập học bạ của lớp mình bằng quyền nhập đánh giá (`P02.assessment.enter`)
// và phân công chủ nhiệm. Vai trò nhận quyền do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: Ban Giám hiệu
const PERMISSIONS = [
  {
    code: 'P02.student-record.approve',
    module: 'P02',
    description:
      'Duyệt khen thưởng học sinh, danh hiệu khen thưởng; xác nhận hoàn thành chương trình, lên lớp; xác nhận và kí học bạ',
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
