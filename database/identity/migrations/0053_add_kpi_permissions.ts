import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-18 phần 18d (YCTD-139). Phân hệ KPI thuộc P09 Công việc, kế hoạch và đánh giá, quyền tách theo thao tác:
// - tham gia: đăng ký việc, xác nhận hoặc chuyển trả việc được giao, nộp minh chứng, tự đánh giá, xem kết quả của mình;
// - quản lý: giao việc, duyệt đăng ký, chấm điểm, trả lại, ủy quyền chấm, kết luận xếp loại, danh mục của đơn vị, trong
//   phạm vi đơn vị được gán;
// - tham mưu: tổng hợp, đề xuất mức xếp loại toàn trường, báo cáo tổng hợp;
// - biểu quyết: biểu quyết mức xếp loại;
// - cấu hình: bộ quy tắc, kỳ (mở, khóa, mở lại), đối tượng đánh giá, danh mục chung, nhập dữ liệu hệ thống cũ.
// Vai trò nhận quyền do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: mọi vai trò nhân sự tham gia; Ban Giám hiệu,
// Quản lý đơn vị, Tổ trưởng chuyên môn quản lý; Ban Giám hiệu và Nhân sự tham mưu; Ban Giám hiệu biểu quyết; Hiệu trưởng và
// Nhân sự cấu hình
const PERMISSIONS = [
  {
    code: 'P09.kpi.participate',
    description: 'Tham gia KPI: đăng ký việc, xác nhận việc được giao, nộp minh chứng, tự đánh giá',
    roles: ['VT-02', 'VT-15', 'VT-03', 'VT-04', 'VT-05', 'VT-06', 'VT-07', 'VT-08', 'VT-09', 'VT-10', 'VT-11', 'VT-12', 'VT-16', 'VT-17', 'VT-18'],
  },
  {
    code: 'P09.kpi.manage',
    description: 'Giao việc, duyệt đăng ký, chấm điểm, ủy quyền chấm, kết luận xếp loại KPI trong phạm vi đơn vị',
    roles: ['VT-02', 'VT-15', 'VT-03', 'VT-17'],
  },
  {
    code: 'P09.kpi.advise',
    description: 'Tổng hợp, tham mưu mức xếp loại KPI và xem báo cáo tổng hợp',
    roles: ['VT-02', 'VT-15', 'VT-06'],
  },
  {
    code: 'P09.kpi.vote',
    description: 'Biểu quyết mức xếp loại KPI',
    roles: ['VT-02', 'VT-15'],
  },
  {
    code: 'P09.kpi.configure',
    description: 'Cấu hình bộ quy tắc chấm, kỳ đánh giá, đối tượng đánh giá, danh mục chung, nhập dữ liệu KPI cũ',
    roles: ['VT-02', 'VT-06'],
  },
];

export const migration: Migration = {
  async up(database) {
    for (const permission of PERMISSIONS) {
      await sql`insert into permissions (code, module_code, description)
        values (${permission.code}, 'P09', ${permission.description})`.execute(database);
      await sql`insert into role_permissions (role_id, permission_id)
        select roles.id, permissions.id from roles, permissions
        where roles.code in (${sql.join(permission.roles)}) and permissions.code = ${permission.code}`.execute(
        database,
      );
    }
  },
  async down(database) {
    const codes = PERMISSIONS.map((permission) => permission.code);
    await sql`delete from role_permissions where permission_id in
      (select id from permissions where code in (${sql.join(codes)}))`.execute(database);
    await sql`delete from permissions where code in (${sql.join(codes)})`.execute(database);
  },
};
