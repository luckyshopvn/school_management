import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Lập phiếu đảo phiếu chi kèm lý do (P06-04; QT-05 bước 8; BR-29; YCTD-56). Duyệt dùng `P06.payment.approve`
export const PAYMENT_REVERSAL_CREATE_PERMISSION = 'P06.payment-reversal.create';
const ROLE_CODES = ['VT-04', 'VT-05'];

export const migration: Migration = {
  async up(database) {
    await sql`insert into permissions (code, module_code, description)
      values (${PAYMENT_REVERSAL_CREATE_PERMISSION}, 'P06', 'Lập phiếu đảo phiếu chi kèm lý do trong phạm vi đơn vị')`.execute(
      database,
    );
    await sql`insert into role_permissions (role_id, permission_id)
      select roles.id, permissions.id from roles, permissions
      where roles.code in (${sql.join(ROLE_CODES)}) and permissions.code = ${PAYMENT_REVERSAL_CREATE_PERMISSION}`.execute(
      database,
    );
  },
  async down(database) {
    await sql`delete from role_permissions where permission_id in
      (select id from permissions where code = ${PAYMENT_REVERSAL_CREATE_PERMISSION})`.execute(database);
    await sql`delete from permissions where code = ${PAYMENT_REVERSAL_CREATE_PERMISSION}`.execute(database);
  },
};
