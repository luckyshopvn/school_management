import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Quyền của các phần 10h (công việc, đánh giá, quá trình công tác, thưởng và khấu trừ), 10i (nhắc nợ, công nợ quá hạn,
// sổ ngân hàng, công nợ phải trả, chốt kỳ tài chính), 10j (báo cáo vận hành, báo cáo hợp nhất, xuất dữ liệu) của đợt
// DT-10, cấp trước trong một tệp để các phần làm song song không cùng thêm tệp thay đổi cấu trúc định danh (YCTD-73)
const PERMISSIONS = [
  {
    code: 'P09.task.assign',
    module: 'P09',
    description: 'Giao việc cho nhân sự trong đơn vị được gán, theo dõi tiến độ việc đã giao',
    roleCodes: ['VT-03', 'VT-06'],
  },
  {
    code: 'P09.plan.manage',
    module: 'P09',
    description: 'Lập kế hoạch theo kỳ, đầu việc, người phụ trách và theo dõi tiến độ kế hoạch của đơn vị',
    roleCodes: ['VT-03'],
  },
  {
    code: 'P09.evaluation.manage',
    module: 'P09',
    description: 'Lập kỳ đánh giá, chỉ số, chấm điểm, nhận xét và công bố phiếu đánh giá nhân sự',
    roleCodes: ['VT-03', 'VT-06'],
  },
  {
    code: 'P07.work-history.manage',
    module: 'P07',
    description: 'Ghi quá trình công tác và chứng chỉ của nhân sự',
    roleCodes: ['VT-06'],
  },
  {
    code: 'P08.bonus-deduction.manage',
    module: 'P08',
    description: 'Ghi các khoản thưởng và khấu trừ của nhân sự vào bảng lương',
    roleCodes: ['VT-04', 'VT-05'],
  },
  {
    code: 'P05.debt-reminder.manage',
    module: 'P05',
    description: 'Xem danh sách công nợ quá hạn theo mốc và gửi nhắc nợ',
    roleCodes: ['VT-04', 'VT-03'],
  },
  {
    code: 'P05.overdue-debt.propose',
    module: 'P05',
    description: 'Lập đề xuất xử lý công nợ quá hạn của trẻ',
    roleCodes: ['VT-03', 'VT-04'],
  },
  {
    code: 'P05.overdue-debt.decide',
    module: 'P05',
    description: 'Ghi quyết định xử lý công nợ quá hạn',
    roleCodes: ['VT-15', 'VT-02'],
  },
  {
    code: 'P06.bank-transaction.manage',
    module: 'P06',
    description: 'Ghi giao dịch tài khoản ngân hàng, đối chiếu sổ ngân hàng với sao kê',
    roleCodes: ['VT-04', 'VT-05'],
  },
  {
    code: 'P06.payable.manage',
    module: 'P06',
    description: 'Ghi nhận và theo dõi công nợ phải trả nhà cung cấp',
    roleCodes: ['VT-04', 'VT-05'],
  },
  {
    code: 'P06.period-close.request',
    module: 'P06',
    description: 'Đề nghị chốt kỳ tài chính',
    roleCodes: ['VT-05'],
  },
  {
    code: 'P06.period-close.approve',
    module: 'P06',
    description: 'Phê duyệt chốt kỳ tài chính, khóa số liệu của kỳ',
    roleCodes: ['VT-02'],
  },
  {
    code: 'P17.report.operations',
    module: 'P17',
    description: 'Xem báo cáo hoạt động và công việc của đơn vị',
    roleCodes: ['VT-03'],
  },
  {
    code: 'P17.report.consolidated',
    module: 'P17',
    description: 'Xem báo cáo hợp nhất so sánh chỉ số giữa các đơn vị',
    roleCodes: ['VT-02', 'VT-19'],
  },
  {
    code: 'P17.data.export',
    module: 'P17',
    description: 'Xuất dữ liệu báo cáo ra tệp, có ghi nhật ký xuất',
    roleCodes: ['VT-02', 'VT-04', 'VT-06'],
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
