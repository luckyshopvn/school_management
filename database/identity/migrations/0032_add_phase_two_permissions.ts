import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Quyền của các phần 10b (thuốc, YCTD-75), 10c (bếp, YCTD-76), 10d (kho, tài sản, mua hàng, YCTD-77) của đợt DT-10,
// cấp trước trong một tệp để các phần làm song song không cùng thêm tệp thay đổi cấu trúc định danh (YCTD-73)
const PERMISSIONS = [
  {
    code: 'P10.medicine.manage',
    module: 'P10',
    description: 'Quản lý danh mục thuốc, nhà thuốc, đề nghị mua thuốc, phiếu mua thuốc và cấp thuốc trong đơn vị',
    roleCodes: ['VT-09'],
  },
  {
    code: 'P10.medication.administer',
    module: 'P10',
    description:
      'Nhận thuốc, từ chối, ghi liều và bỏ liều theo yêu cầu dặn thuốc; giáo viên chủ nhiệm chỉ khi đơn vị bật không có nhân viên y tế',
    roleCodes: ['VT-09', 'VT-07'],
  },
  {
    code: 'P10.medicine-purchase.approve',
    module: 'P10',
    description: 'Duyệt đề nghị mua thuốc theo hạn mức đề nghị mua hàng',
    roleCodes: ['VT-02', 'VT-15'],
  },
  {
    code: 'P12.kitchen.manage',
    module: 'P12',
    description:
      'Quản lý món ăn, thực đơn tuần, định lượng, suất ăn theo ngày, buffet, nhà cung cấp thực phẩm, phiếu đi chợ của đơn vị',
    roleCodes: ['VT-10'],
  },
  {
    code: 'P12.menu.approve',
    module: 'P12',
    description: 'Duyệt và công bố thực đơn tuần, duyệt buffet theo dịp của đơn vị',
    roleCodes: ['VT-03'],
  },
  {
    code: 'P12.meal-report.submit',
    module: 'P12',
    description: 'Báo cơm của lớp mình chủ nhiệm',
    roleCodes: ['VT-07'],
  },
  {
    code: 'P17.report.kitchen',
    module: 'P17',
    description: 'Xem báo cáo ăn và bếp của đơn vị',
    roleCodes: ['VT-10', 'VT-04'],
  },
  {
    code: 'P13.asset.manage',
    module: 'P13',
    description:
      'Quản lý tài sản, cấp phát, thu hồi, mượn trả, hỏng mất, nhập xuất tồn, kiểm kê, tồn kho ban đầu, nhà cung cấp của đơn vị',
    roleCodes: ['VT-11'],
  },
  {
    code: 'P13.purchase-request.create',
    module: 'P13',
    description: 'Lập đề nghị mua hàng',
    roleCodes: [
      'VT-02',
      'VT-15',
      'VT-03',
      'VT-04',
      'VT-05',
      'VT-06',
      'VT-07',
      'VT-08',
      'VT-09',
      'VT-10',
      'VT-11',
      'VT-12',
      'VT-16',
      'VT-17',
      'VT-18',
    ],
  },
  {
    code: 'P13.purchase-request.approve',
    module: 'P13',
    description: 'Duyệt đề nghị mua hàng theo hạn mức (BR-63)',
    roleCodes: ['VT-02', 'VT-15'],
  },
  {
    code: 'P13.purchase-order.manage',
    module: 'P13',
    description: 'Lập phiếu mua hàng từ đề nghị đã duyệt, nhận hàng vào kho',
    roleCodes: ['VT-11', 'VT-04'],
  },
  {
    code: 'P13.stocktake.approve',
    module: 'P13',
    description: 'Duyệt biên bản kiểm kê có chênh lệch',
    roleCodes: ['VT-05'],
  },
];

export const migration: Migration = {
  async up(database) {
    for (const permission of PERMISSIONS) {
      await sql`insert into permissions (code, module_code, description)
        values (${permission.code}, ${permission.module}, ${permission.description})`.execute(database);
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
