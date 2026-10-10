import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Quyền nhập lớp, trẻ và phụ huynh từ Excel; chỉ Hiệu trưởng (P01-13, BM-63, YCTD-46)
export const IMPORT_CHILDREN_PERMISSION = 'P01.import.children';

export const migration: Migration = {
  async up(database) {
    const description = 'Nhập dữ liệu ban đầu về lớp, trẻ và phụ huynh từ tệp Excel';
    await sql`insert into permissions (code, module_code, description) values (${IMPORT_CHILDREN_PERMISSION}, 'P01', ${description})`.execute(
      database,
    );
    await sql`insert into role_permissions (role_id, permission_id)
      select roles.id, permissions.id from roles, permissions
      where roles.code = 'VT-02' and permissions.code = ${IMPORT_CHILDREN_PERMISSION}`.execute(database);
  },
  async down(database) {
    await sql`delete from role_permissions where permission_id in (select id from permissions where code = ${IMPORT_CHILDREN_PERMISSION})`.execute(
      database,
    );
    await sql`delete from permissions where code = ${IMPORT_CHILDREN_PERMISSION}`.execute(database);
  },
};
