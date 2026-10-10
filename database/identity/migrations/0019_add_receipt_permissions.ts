import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Lập phiếu thu và phân bổ, khai báo quỹ và tài khoản ngân hàng, xem công nợ của trẻ (P06-01, P06-02, P06-05, P05-09; YCTD-53).
// Không dùng `P05.view` cho công nợ vì giáo viên có quyền xem học phí nhưng không được xem công nợ (CTC-P05-062)
export const RECEIPT_MANAGE_PERMISSION = 'P06.receipt.manage';
export const CASH_ACCOUNT_MANAGE_PERMISSION = 'P06.cash-account.manage';
export const DEBT_VIEW_PERMISSION = 'P05.debt.view';

const PERMISSIONS = [
  {
    code: RECEIPT_MANAGE_PERMISSION,
    moduleCode: 'P06',
    description: 'Lập phiếu thu và phân bổ vào hóa đơn trong phạm vi đơn vị; thủ quỹ chỉ lập phiếu thu tiền mặt',
    roleCodes: ['VT-04', 'VT-16'],
  },
  {
    code: CASH_ACCOUNT_MANAGE_PERMISSION,
    moduleCode: 'P06',
    description: 'Khai báo quỹ tiền mặt và tài khoản ngân hàng trong phạm vi đơn vị',
    roleCodes: ['VT-04', 'VT-05'],
  },
  {
    code: DEBT_VIEW_PERMISSION,
    moduleCode: 'P05',
    description: 'Xem công nợ phải thu của trẻ trong phạm vi đơn vị',
    roleCodes: ['VT-02', 'VT-15', 'VT-03', 'VT-04', 'VT-05', 'VT-16'],
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
