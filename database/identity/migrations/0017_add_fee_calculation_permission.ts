import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Kế toán chạy tính học phí, phát hành hóa đơn chính và hóa đơn bổ sung trong phạm vi đơn vị (P05-05, P05-06; YCTD-51)
export const FEE_CALCULATION_MANAGE_PERMISSION = 'P05.fee-calculation.manage';

export const migration: Migration = {
  async up(database) {
    const description = 'Chạy tính học phí, phát hành hóa đơn chính và hóa đơn bổ sung trong phạm vi đơn vị';
    await sql`insert into permissions (code, module_code, description)
      values (${FEE_CALCULATION_MANAGE_PERMISSION}, 'P05', ${description})`.execute(database);
    await sql`insert into role_permissions (role_id, permission_id)
      select roles.id, permissions.id from roles, permissions
      where roles.code = 'VT-04' and permissions.code = ${FEE_CALCULATION_MANAGE_PERMISSION}`.execute(database);
  },
  async down(database) {
    await sql`delete from role_permissions where permission_id in (select id from permissions where code = ${FEE_CALCULATION_MANAGE_PERMISSION})`.execute(
      database,
    );
    await sql`delete from permissions where code = ${FEE_CALCULATION_MANAGE_PERMISSION}`.execute(database);
  },
};
