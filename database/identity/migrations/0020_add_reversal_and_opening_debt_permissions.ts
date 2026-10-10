import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Lập và duyệt phiếu đảo phiếu thu, nhập công nợ đầu kỳ từ Excel (P06-03, P01-13; BR-29, BR-77; YCTD-54)
export const RECEIPT_REVERSAL_CREATE_PERMISSION = 'P06.receipt-reversal.create';
export const RECEIPT_REVERSAL_APPROVE_PERMISSION = 'P06.receipt-reversal.approve';
export const OPENING_DEBT_IMPORT_PERMISSION = 'P05.opening-debt.import';

const PERMISSIONS = [
  {
    code: RECEIPT_REVERSAL_CREATE_PERMISSION,
    moduleCode: 'P06',
    description: 'Lập phiếu đảo phiếu thu kèm lý do trong phạm vi đơn vị',
    roleCodes: ['VT-04', 'VT-05'],
  },
  {
    code: RECEIPT_REVERSAL_APPROVE_PERMISSION,
    moduleCode: 'P06',
    description: 'Duyệt phiếu đảo phiếu thu theo hạn mức trong phạm vi đơn vị',
    roleCodes: ['VT-02', 'VT-15'],
  },
  {
    code: OPENING_DEBT_IMPORT_PERMISSION,
    moduleCode: 'P05',
    description: 'Nhập công nợ đầu kỳ của trẻ từ tệp Excel trong phạm vi đơn vị',
    roleCodes: ['VT-04'],
  },
];

export const migration: Migration = {
  async up(database) {
    for (const permission of PERMISSIONS) {
      await sql`insert into permissions (code, module_code, description)
        values (${permission.code}, ${permission.moduleCode}, ${permission.description})`.execute(database);
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
