import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-28 phần 28e (YCTD-275): quyền xử lý hàng chờ báo cáo vi phạm ở thảo luận, hỏi đáp, không gian học nhóm (ẩn nội dung, tạm khóa
// quyền viết, ghi kết quả). Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: Hiệu trưởng, Phó Hiệu trưởng xử lý mọi báo cáo;
// giáo viên chủ nhiệm xử lý báo cáo của lớp mình (máy chủ lọc theo lớp chủ nhiệm). Trường có người tư vấn tâm lý học đường thì
// gán quyền này cho vai trò của người đó ở phân quyền nhóm. Giáo viên của lớp học trực tuyến ẩn nội dung ở lớp mình không cần quyền
const PERMISSIONS = [
  {
    code: 'P02.discussion.moderate',
    description: 'Xử lý báo cáo vi phạm ở thảo luận, hỏi đáp, không gian học nhóm: ẩn nội dung, tạm khóa quyền viết',
    roles: ['VT-02', 'VT-15', 'VT-07'],
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
  },
  async down(database) {
    for (const permission of PERMISSIONS) {
      await sql`delete from role_permissions where permission_id in
        (select id from permissions where code = ${permission.code})`.execute(database);
      await sql`delete from permissions where code = ${permission.code}`.execute(database);
    }
  },
};
