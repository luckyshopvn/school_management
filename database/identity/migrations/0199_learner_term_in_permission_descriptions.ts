import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Mô tả quyền ghi người học theo cấp (YCTD-394 lát L2): chữ "trẻ" thành chỗ giữ "{người học}", "Trẻ" thành "{Người học}"; trang
// 1.3 Phân quyền điền theo các cấp trường đã bật (trường chỉ có Mầm non vẫn thấy "trẻ"). Chỉ đổi dòng còn đúng mô tả cũ để
// không ghi đè mô tả đã sửa ở nơi khác. Giữ "trẻ" ở hai quyền chỉ của Mầm non: hoàn thành chương trình giáo dục mầm non
// (P02.program-completion.manage) và báo cáo cân nặng, chiều cao theo kênh tăng trưởng (P17.report.growth)
const DESCRIPTIONS: Array<{ code: string; before: string; after: string }> = [
  {
    code: 'P01.import.children',
    before: 'Nhập dữ liệu ban đầu về lớp, trẻ và phụ huynh từ tệp Excel',
    after: 'Nhập dữ liệu ban đầu về lớp, {người học} và phụ huynh từ tệp Excel',
  },
  {
    code: 'P02.approve',
    before: 'Phê duyệt: Trẻ, phụ huynh, lớp học',
    after: 'Phê duyệt: {Người học}, phụ huynh, lớp học',
  },
  {
    code: 'P02.authorized-pickup.manage',
    before: 'Khai báo và hủy người được ủy quyền đón trẻ trong phạm vi đơn vị',
    after: 'Khai báo và hủy người được ủy quyền đón {người học} trong phạm vi đơn vị',
  },
  {
    code: 'P02.child-group.manage',
    before: 'Lập nhóm trẻ trong đơn vị, thêm, bớt trẻ của nhóm',
    after: 'Lập nhóm {người học} trong đơn vị, thêm, bớt {người học} của nhóm',
  },
  {
    code: 'P02.child.manage',
    before: 'Tạo, sửa hồ sơ trẻ ở trạng thái nháp và chờ duyệt, gửi trình duyệt',
    after: 'Tạo, sửa hồ sơ {người học} ở trạng thái nháp và chờ duyệt, gửi trình duyệt',
  },
  {
    code: 'P02.edit',
    before: 'Tạo và sửa: Trẻ, phụ huynh, lớp học',
    after: 'Tạo và sửa: {Người học}, phụ huynh, lớp học',
  },
  {
    code: 'P02.lost-item.manage',
    before: 'Tiếp nhận và xử lý phiếu báo đồ bị mất của trẻ',
    after: 'Tiếp nhận và xử lý phiếu báo đồ bị mất của {người học}',
  },
  {
    code: 'P02.national-id.view',
    before: 'Xem đầy đủ số định danh cá nhân và giấy khai sinh của trẻ',
    after: 'Xem đầy đủ số định danh cá nhân và giấy khai sinh của {người học}',
  },
  {
    code: 'P02.view',
    before: 'Xem: Trẻ, phụ huynh, lớp học',
    after: 'Xem: {Người học}, phụ huynh, lớp học',
  },
  {
    code: 'P03.progress.record',
    before: 'Ghi tiến độ học tập của trẻ trong lớp được phân công',
    after: 'Ghi tiến độ học tập của {người học} trong lớp được phân công',
  },
  {
    code: 'P05.debt.view',
    before: 'Xem công nợ phải thu của trẻ trong phạm vi đơn vị',
    after: 'Xem công nợ phải thu của {người học} trong phạm vi đơn vị',
  },
  {
    code: 'P05.opening-debt.import',
    before: 'Nhập công nợ đầu kỳ của trẻ từ tệp Excel trong phạm vi đơn vị',
    after: 'Nhập công nợ đầu kỳ của {người học} từ tệp Excel trong phạm vi đơn vị',
  },
  {
    code: 'P05.overdue-debt.propose',
    before: 'Lập đề xuất xử lý công nợ quá hạn của trẻ',
    after: 'Lập đề xuất xử lý công nợ quá hạn của {người học}',
  },
  {
    code: 'P05.registration.manage',
    before: 'Đăng ký dịch vụ, đăng ký học hè cho trẻ và chốt danh sách đăng ký của kỳ trong phạm vi đơn vị',
    after: 'Đăng ký dịch vụ, đăng ký học hè cho {người học} và chốt danh sách đăng ký của kỳ trong phạm vi đơn vị',
  },
  {
    code: 'P10.daily-care.record',
    before: 'Ghi chăm sóc hằng ngày của trẻ; giáo viên chỉ ghi cho trẻ của lớp mình chủ nhiệm',
    after: 'Ghi chăm sóc hằng ngày của {người học}; giáo viên chỉ ghi cho {người học} của lớp mình chủ nhiệm',
  },
  {
    code: 'P10.health.manage',
    before:
      'Ghi chỉ số sức khỏe, quản lý tiêu chuẩn sức khỏe, đợt khám, lịch khám, kết quả khám, trả lời yêu cầu báo cáo sức khỏe của trẻ trong đơn vị',
    after:
      'Ghi chỉ số sức khỏe, quản lý tiêu chuẩn sức khỏe, đợt khám, lịch khám, kết quả khám, trả lời yêu cầu báo cáo sức khỏe của {người học} trong đơn vị',
  },
  {
    code: 'P10.medical-event.record',
    before: 'Ghi sự kiện y tế của trẻ; giáo viên chỉ ghi cho trẻ của lớp mình chủ nhiệm',
    after: 'Ghi sự kiện y tế của {người học}; giáo viên chỉ ghi cho {người học} của lớp mình chủ nhiệm',
  },
  {
    code: 'P15.message.send',
    before: 'Trao đổi hai chiều với phụ huynh của trẻ trong lớp được phân công hoặc trong đơn vị',
    after: 'Trao đổi hai chiều với phụ huynh của {người học} trong lớp được phân công hoặc trong đơn vị',
  },
  {
    code: 'P16.application.manage',
    before: 'Tiếp nhận, kiểm tra hồ sơ tuyển sinh, chuyển hồ sơ đã đạt thành hồ sơ trẻ',
    after: 'Tiếp nhận, kiểm tra hồ sơ tuyển sinh, chuyển hồ sơ đã đạt thành hồ sơ {người học}',
  },
  {
    code: 'P17.birthday.view',
    before: 'Xem sinh nhật trẻ trong tháng của đơn vị',
    after: 'Xem sinh nhật {người học} trong tháng của đơn vị',
  },
  {
    code: 'P17.report.attendance',
    before: 'Xem báo cáo điểm danh và trẻ vắng của đơn vị',
    after: 'Xem báo cáo điểm danh và {người học} vắng của đơn vị',
  },
];

export const migration: Migration = {
  async up(database) {
    for (const item of DESCRIPTIONS) {
      await sql`update permissions set description = ${item.after}
        where code = ${item.code} and description = ${item.before}`.execute(database);
    }
  },
  async down(database) {
    for (const item of DESCRIPTIONS) {
      await sql`update permissions set description = ${item.before}
        where code = ${item.code} and description = ${item.after}`.execute(database);
    }
  },
};
