import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Quyền của các phần 10e (hoạt động, nội dung, YCTD-78), 10f (tương tác, đồ bị mất, YCTD-79), 10g (giảng dạy, YCTD-80)
// của đợt DT-10, cấp trước trong một tệp để các phần làm song song không cùng thêm tệp thay đổi cấu trúc định danh (YCTD-73)
const PERMISSIONS = [
  {
    code: 'P14.activity.create',
    module: 'P14',
    description: 'Lập hoạt động của lớp được phân công, tải hình ảnh, gửi duyệt',
    roleCodes: ['VT-07', 'VT-08'],
  },
  {
    code: 'P14.activity.approve',
    module: 'P14',
    description: 'Duyệt hoặc từ chối hoạt động và album trước khi công bố cho phụ huynh',
    roleCodes: ['VT-03', 'VT-15', 'VT-02'],
  },
  {
    code: 'P14.content.manage',
    module: 'P14',
    description: 'Quản lý danh mục hoạt động, tin tức và danh mục tin tức, album của đơn vị',
    roleCodes: ['VT-03'],
  },
  {
    code: 'P14.library.manage',
    module: 'P14',
    description: 'Quản lý thư viện, chủ đề thư viện, hình tô màu',
    roleCodes: ['VT-03', 'VT-07'],
  },
  {
    code: 'P14.extracurricular.manage',
    module: 'P14',
    description: 'Lập hoạt động ngoại khóa, chỉ tiêu, phí; xem danh sách đăng ký',
    roleCodes: ['VT-03', 'VT-07'],
  },
  {
    code: 'P14.comment.moderate',
    module: 'P14',
    description: 'Ẩn hoặc xử lý bình luận trên album, tin tức, thư viện',
    roleCodes: ['VT-03', 'VT-07'],
  },
  {
    code: 'P15.interaction.manage',
    module: 'P15',
    description: 'Lập bình chọn, biểu quyết, khảo sát, danh mục khảo sát; xem kết quả; xử lý góp ý và bình luận',
    roleCodes: ['VT-03', 'VT-02', 'VT-15'],
  },
  {
    code: 'P15.message.send',
    module: 'P15',
    description: 'Trao đổi hai chiều với phụ huynh của trẻ trong lớp được phân công hoặc trong đơn vị',
    roleCodes: ['VT-07', 'VT-03'],
  },
  {
    code: 'P02.lost-item.manage',
    module: 'P02',
    description: 'Tiếp nhận và xử lý phiếu báo đồ bị mất của trẻ',
    roleCodes: ['VT-07', 'VT-03'],
  },
  {
    code: 'P03.lesson.manage',
    module: 'P03',
    description: 'Soạn bài học và giáo án cho lớp được phân công',
    roleCodes: ['VT-07', 'VT-08'],
  },
  {
    code: 'P03.lesson-plan.review',
    module: 'P03',
    description: 'Duyệt hoặc góp ý giáo án',
    roleCodes: ['VT-17', 'VT-03'],
  },
  {
    code: 'P03.curriculum.manage',
    module: 'P03',
    description: 'Quản lý chủ đề, lĩnh vực và nhóm bài học, thời khóa biểu, kế hoạch giảng dạy, lịch hoạt động lớp',
    roleCodes: ['VT-03', 'VT-07'],
  },
  {
    code: 'P03.progress.record',
    module: 'P03',
    description: 'Ghi tiến độ học tập của trẻ trong lớp được phân công',
    roleCodes: ['VT-07'],
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
