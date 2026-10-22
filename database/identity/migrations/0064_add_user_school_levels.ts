import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-19 phần 19a (YCTD-151). Phạm vi cấp học của người dùng: người phụ trách một cấp ở trường liên cấp (ví dụ Phó Hiệu
// trưởng phụ trách Tiểu học) chỉ xem dữ liệu của cấp mình, không tạo vai trò mới theo cấp (tài liệu 32 mục 10.5). Không có
// dòng nào nghĩa là mọi cấp, nên mọi tài khoản hiện có giữ nguyên quyền; phạm vi cấp chỉ thu hẹp thêm, không cấp thêm quyền.
// Người quản lý tài khoản (P01.account.manage, P01.account.manage-in-unit trong phạm vi đơn vị) đặt phạm vi cấp.
// Quyền mới "Cấu hình cấp học của trường" (bật, tắt, thứ tự, tên, thuật ngữ ở 1.4 Cấu hình trường): Hiệu trưởng, do Claude
// tự chọn theo ủy quyền của Eric ngày 2026-10-11 (cấu hình toàn trường như cấu hình website; Quản trị nền tảng không có
// quyền nghiệp vụ, PQ-10)
const PERMISSION = {
  code: 'P01.school-level.manage',
  description: 'Cấu hình cấp học của trường: bật, tắt, thứ tự, tên hiển thị, thuật ngữ gọi người học',
  roles: ['VT-02'],
};

export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('user_school_levels')
      .addColumn('user_id', 'uuid', (column) => column.notNull().references('users.id').onDelete('cascade'))
      .addColumn('school_level', 'text', (column) => column.notNull())
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addPrimaryKeyConstraint('user_school_levels_pkey', ['user_id', 'school_level'])
      .addCheckConstraint('user_school_levels_level_check', sql`school_level in ('MN', 'TH', 'THCS', 'THPT')`)
      .execute();
    await sql`insert into permissions (code, module_code, description)
      values (${PERMISSION.code}, 'P01', ${PERMISSION.description})`.execute(database);
    await sql`insert into role_permissions (role_id, permission_id)
      select roles.id, permissions.id from roles, permissions
      where roles.code in (${sql.join(PERMISSION.roles)}) and permissions.code = ${PERMISSION.code}`.execute(database);
  },
  async down(database) {
    await sql`delete from role_permissions where permission_id in
      (select id from permissions where code = ${PERMISSION.code})`.execute(database);
    await sql`delete from permissions where code = ${PERMISSION.code}`.execute(database);
    await database.schema.dropTable('user_school_levels').execute();
  },
};
