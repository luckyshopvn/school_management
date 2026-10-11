import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Lập và công bố lịch nghỉ, lịch công tác của nhân sự trong đơn vị (P08-02; YCTD-68)
const PERMISSION = {
  code: 'P08.work-schedule.manage',
  description: 'Lập, công bố, xóa lịch nghỉ và lịch công tác của nhân sự trong đơn vị',
  roleCodes: ['VT-06', 'VT-03'],
};

export const migration: Migration = {
  async up(database) {
    await sql`insert into permissions (code, module_code, description)
      values (${PERMISSION.code}, 'P08', ${PERMISSION.description})`.execute(database);
    await sql`insert into role_permissions (role_id, permission_id)
      select roles.id, permissions.id from roles, permissions
      where roles.code in (${sql.join(PERMISSION.roleCodes)}) and permissions.code = ${PERMISSION.code}`.execute(
      database,
    );
  },
  async down(database) {
    await sql`delete from role_permissions where permission_id in (select id from permissions where code = ${PERMISSION.code})`.execute(
      database,
    );
    await sql`delete from permissions where code = ${PERMISSION.code}`.execute(database);
  },
};
