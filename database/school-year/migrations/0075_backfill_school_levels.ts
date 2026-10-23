import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-19 phần 19f (YCTD-156): chuyển dữ liệu Mầm non sang cấu trúc đa cấp, chạy lặp được (chạy lại không đổi kết quả). Các cột
// cấp của 0072, 0073 đã có mặc định MN; tệp này vá phần còn thiếu ở dữ liệu ghi thẳng hoặc ghi trước khi có cấp:
// - đơn vị chưa có dòng cấp nhận MN;
// - lớp lệch cấp với khối lấy lại cấp theo khối;
// - cấp Mầm non chưa có chương trình mặc định thì nạp "Chương trình giáo dục mầm non" (nếu mã chưa dùng) hoặc đặt chương trình
//   Mầm non đang dùng đầu tiên làm mặc định.
// Chỉ ghi cột cấp, không đổi nội dung nghiệp vụ. Năm học đã đóng giữ nguyên cấu trúc (QU-11) nên không chạy tệp này; lệnh kiểm
// đối chiếu (level-check) đọc được cả năm đã đóng. Danh mục có cột cấp để trống nghĩa là mọi cấp (KPI, kế hoạch giáo dục, thi
// đua, bảo đảm chất lượng) giữ nguyên
export const migration: Migration = {
  async up(database) {
    await sql`insert into org_unit_levels (org_unit_id, school_level)
      select org_units.id, 'MN' from org_units
      where not exists (select 1 from org_unit_levels where org_unit_levels.org_unit_id = org_units.id)
      on conflict do nothing`.execute(database);
    await sql`update classes set school_level = grade_levels.school_level
      from grade_levels
      where grade_levels.code = classes.grade_level and classes.school_level <> grade_levels.school_level`.execute(
      database,
    );
    await sql`insert into curricula (code, name, school_level, is_default)
      select 'CT-GDMN', 'Chương trình giáo dục mầm non', 'MN', true
      where not exists (select 1 from curricula where school_level = 'MN' and is_default)
        and not exists (select 1 from curricula where code = 'CT-GDMN')`.execute(database);
    await sql`update curricula set is_default = true
      where id = (select id from curricula where school_level = 'MN' and status = 'active' order by code limit 1)
        and not exists (select 1 from curricula where school_level = 'MN' and is_default)`.execute(database);
  },
  // Tệp chỉ vá dữ liệu cho khớp cấu trúc đã có; quay lui không xóa dữ liệu cấp đã đúng
  async down() {},
};
