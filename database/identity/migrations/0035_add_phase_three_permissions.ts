import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Quyền của đợt DT-11 (giai đoạn 3): 11a tuyển sinh (P16), 11b tuyển dụng (P18), 11c sổ kế toán kép (N5), 11d đối soát
// sao kê tự động (N4), 11e kết nối Facebook và Zalo; cấp trước trong một tệp để các phần làm song song không cùng thêm tệp
// thay đổi cấu trúc định danh (YCTD-85)
const PERMISSIONS = [
  {
    code: 'P16.admission-campaign.manage',
    module: 'P16',
    description: 'Mở, đóng đợt tuyển sinh của đơn vị, chỉ tiêu, thời gian nhận hồ sơ',
    roleCodes: ['VT-12', 'VT-03'],
  },
  {
    code: 'P16.application.manage',
    module: 'P16',
    description: 'Tiếp nhận, kiểm tra hồ sơ tuyển sinh, chuyển hồ sơ đã đạt thành hồ sơ trẻ',
    roleCodes: ['VT-12', 'VT-03'],
  },
  {
    code: 'P16.application.review',
    module: 'P16',
    description: 'Xét duyệt hồ sơ tuyển sinh: đạt hoặc không đạt kèm lý do',
    roleCodes: ['VT-03'],
  },
  {
    code: 'P16.admission-post.manage',
    module: 'P16',
    description: 'Soạn và công bố tin tuyển sinh gắn với đợt tuyển sinh',
    roleCodes: ['VT-12'],
  },
  {
    code: 'P18.recruitment-request.create',
    module: 'P18',
    description: 'Lập đề nghị tuyển dụng trình Ban Giám hiệu',
    roleCodes: ['VT-06', 'VT-03'],
  },
  {
    code: 'P18.recruitment-request.approve',
    module: 'P18',
    description: 'Duyệt hoặc từ chối đề nghị tuyển dụng',
    roleCodes: ['VT-02', 'VT-15'],
  },
  {
    code: 'P18.recruitment.manage',
    module: 'P18',
    description: 'Soạn và công bố tin tuyển dụng, tiếp nhận và sàng lọc ứng viên',
    roleCodes: ['VT-06'],
  },
  {
    code: 'P18.interview.manage',
    module: 'P18',
    description: 'Lên lịch phỏng vấn, ghi đánh giá và kết quả tuyển dụng',
    roleCodes: ['VT-06', 'VT-03'],
  },
  {
    code: 'P06.ledger.manage',
    module: 'P06',
    description: 'Quản lý hệ thống tài khoản kế toán, lập bút toán thủ công, ghi sổ bút toán tự động',
    roleCodes: ['VT-05', 'VT-04'],
  },
  {
    code: 'P06.ledger.view',
    module: 'P06',
    description: 'Xem sổ nhật ký chung, sổ cái, bảng cân đối số phát sinh',
    roleCodes: ['VT-02', 'VT-15', 'VT-04', 'VT-05', 'VT-20'],
  },
  {
    code: 'P06.bank-statement.import',
    module: 'P06',
    description: 'Nhập tệp sao kê ngân hàng và chạy đối soát tự động',
    roleCodes: ['VT-04', 'VT-05'],
  },
  {
    code: 'P14.facebook.manage',
    module: 'P14',
    description: 'Liên kết Fanpage và đăng nội dung đã duyệt lên Fanpage',
    roleCodes: ['VT-03', 'VT-02'],
  },
  {
    code: 'P01.integration.manage',
    module: 'P01',
    description: 'Cấu hình kết nối ngoài: Zalo Official Account, Facebook, cổng thanh toán',
    roleCodes: ['VT-02'],
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
