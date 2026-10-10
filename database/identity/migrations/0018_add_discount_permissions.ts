import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Lập miễn giảm, lập phiếu điều chỉnh hóa đơn, Ban Giám hiệu duyệt theo hạn mức (P05-07, P05-08; Q-112, Q-134; YCTD-52).
// Không dùng `P05.approve` vì kế toán và kế toán trưởng cũng có quyền này
export const DISCOUNT_MANAGE_PERMISSION = 'P05.discount.manage';
export const INVOICE_ADJUSTMENT_CREATE_PERMISSION = 'P05.invoice-adjustment.create';
export const FEE_DOCUMENT_APPROVE_PERMISSION = 'P05.fee-document.approve';

const PERMISSIONS = [
  {
    code: DISCOUNT_MANAGE_PERMISSION,
    description: 'Lập miễn giảm trên hóa đơn trong phạm vi đơn vị',
    roleCodes: ['VT-04'],
  },
  {
    code: INVOICE_ADJUSTMENT_CREATE_PERMISSION,
    description: 'Lập phiếu điều chỉnh hóa đơn đã phát hành trong phạm vi đơn vị',
    roleCodes: ['VT-04', 'VT-05'],
  },
  {
    code: FEE_DOCUMENT_APPROVE_PERMISSION,
    description: 'Duyệt miễn giảm và phiếu điều chỉnh hóa đơn theo hạn mức trong phạm vi đơn vị',
    roleCodes: ['VT-02', 'VT-15'],
  },
];

export const migration: Migration = {
  async up(database) {
    for (const permission of PERMISSIONS) {
      await sql`insert into permissions (code, module_code, description)
        values (${permission.code}, 'P05', ${permission.description})`.execute(database);
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
