import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-18 phần 18c (YCTD-141). Giao việc, lịch đơn vị, phòng họp, hồ sơ công việc, báo cáo theo VNPT iOffice thuộc phân hệ
// Quản lý văn bản và điều hành (P09); quyền tách theo thao tác, vai trò nhận quyền do Claude tự chọn theo ủy quyền của Eric
// ngày 2026-10-11:
// - giao việc theo cây đơn vị, phê duyệt kết quả, nhắc việc định kì: Ban Giám hiệu, Quản lý đơn vị, Nhân sự (văn thư) trong
//   phạm vi đơn vị được gán. Việc được giao thì người nhận xử lý không cần quyền này;
// - xem lịch đơn vị, lịch họp, đăng ký sử dụng phòng họp; hồ sơ công việc: mọi cán bộ, nhân viên dùng cổng quản trị như quyền
//   xem văn bản đến của 18a;
// - đăng ký, công bố lịch đơn vị, mẫu lịch: Ban Giám hiệu, Quản lý đơn vị, Nhân sự;
// - danh mục phòng họp, duyệt đăng ký phòng họp: Ban Giám hiệu, Nhân sự;
// - báo cáo xử lý văn bản đến, báo cáo tổng hợp, thống kê: Ban Giám hiệu, Nhân sự toàn trường, Quản lý đơn vị trong đơn vị
const STAFF_ROLES = [
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
];
const PERMISSIONS = [
  {
    code: 'P09.task.direct',
    description: 'Giao việc theo cây đơn vị (xử lý chính, phối hợp, theo dõi), phê duyệt kết quả, nhắc việc định kì',
    roles: ['VT-02', 'VT-15', 'VT-03', 'VT-06'],
  },
  {
    code: 'P09.schedule.view',
    description: 'Xem lịch đơn vị, lịch họp; đăng ký sử dụng phòng họp',
    roles: STAFF_ROLES,
  },
  {
    code: 'P09.schedule.manage',
    description: 'Đăng ký, sửa, công bố lịch đơn vị theo tuần; mẫu lịch',
    roles: ['VT-02', 'VT-15', 'VT-03', 'VT-06'],
  },
  {
    code: 'P09.meeting-room.manage',
    description: 'Danh mục phòng họp; phê duyệt, từ chối đăng ký sử dụng phòng họp',
    roles: ['VT-02', 'VT-15', 'VT-06'],
  },
  {
    code: 'P09.work-file.use',
    description: 'Hồ sơ công việc cá nhân, chia sẻ, chuyển giao, nộp lưu',
    roles: STAFF_ROLES,
  },
  {
    code: 'P09.document-report.view',
    description: 'Báo cáo thực hiện văn bản đến, báo cáo tổng hợp, thống kê số liệu trong đơn vị',
    roles: ['VT-02', 'VT-15', 'VT-03', 'VT-06'],
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
