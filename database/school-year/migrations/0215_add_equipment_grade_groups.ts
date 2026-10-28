import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Danh mục thiết bị tối thiểu cho Tiểu học, THCS, THPT (YCTD-345): cột age_group của equipment_items nhận thêm mã khối K1 đến
// K12 (khối mẫu của DT-19, YCTD-152) để định mức của cấp phổ thông áp theo khối lớp; nhóm tuổi Mầm non giữ như cũ. Ràng buộc
// mới gắn nhóm với cấp: dòng Mầm non chỉ nhận nhóm tuổi, dòng cấp phổ thông chỉ nhận mã khối. Số 0215 để cách xa các số
// đang dùng của PR song song (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11)
const MN_GROUPS = sql`('nt_3_12', 'nt_12_24', 'nt_24_36', 'mg_3_4', 'mg_4_5', 'mg_5_6')`;

export const migration: Migration = {
  async up(database) {
    await sql`alter table equipment_items drop constraint equipment_items_age_group_check`.execute(database);
    await sql`alter table equipment_items add constraint equipment_items_age_group_check check (
      (school_level = 'MN' and age_group in ${MN_GROUPS})
      or (school_level = 'TH' and age_group in ('K1', 'K2', 'K3', 'K4', 'K5'))
      or (school_level = 'THCS' and age_group in ('K6', 'K7', 'K8', 'K9'))
      or (school_level = 'THPT' and age_group in ('K10', 'K11', 'K12'))
    )`.execute(database);
  },
  // Lùi lại chỉ được khi chưa có thiết bị của cấp phổ thông (ràng buộc cũ sẽ báo lỗi, không tự xóa dữ liệu của trường)
  async down(database) {
    await sql`alter table equipment_items drop constraint equipment_items_age_group_check`.execute(database);
    await sql`alter table equipment_items add constraint equipment_items_age_group_check
      check (age_group in ${MN_GROUPS})`.execute(database);
  },
};
