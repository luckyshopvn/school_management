import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import type { AcademicYearTransitionStep } from '../academic-years/academic-year-transition.js';

// Mở năm học mới thì chuyển hồ sơ trường, danh mục thiết bị dạy học và số lượng hiện có sang năm mới (YCTD-102); phòng
// học kèm khối phòng, hiện trạng chuyển ở bước danh mục. Chạy sau bước chuyển danh mục và trước bước chuyển kho, vì tài sản
// tham chiếu thiết bị:
// - danh mục thiết bị năm mới thay bằng danh mục của năm cũ (giữ mã định danh, kể cả chỉnh sửa của Hiệu trưởng);
// - số hiện có chuyển theo đơn vị: số nhập theo lớp cộng vào dòng của đơn vị vì lớp không chuyển sang năm mới; nhu cầu bổ
//   sung năm sau bỏ trống để nhập lại
export const facilitiesTransitionStep: AcademicYearTransitionStep = {
  name: 'facilities',
  async carryOver(context) {
    if (!context.previousDatabase) {
      return;
    }
    const previous = context.previousDatabase as Kysely<SchoolYearDatabase>;
    const next = context.newDatabase as Kysely<SchoolYearDatabase>;
    const items = await previous.selectFrom('equipment_items').selectAll().execute();
    await next.deleteFrom('equipment_items').execute();
    for (const row of items) {
      await next.insertInto('equipment_items').values(row).execute();
    }
    const holdings = await previous.selectFrom('equipment_holdings').selectAll().execute();
    const totals = new Map<
      string,
      { equipment_item_id: string; org_unit_id: string; quantity: number; note: string | null; updated_by: string }
    >();
    for (const row of holdings) {
      const key = `${row.equipment_item_id}:${row.org_unit_id}`;
      const entry = totals.get(key) ?? {
        equipment_item_id: row.equipment_item_id,
        org_unit_id: row.org_unit_id,
        quantity: 0,
        note: null,
        updated_by: row.updated_by,
      };
      entry.quantity = Math.round((entry.quantity + Number(row.quantity)) * 100) / 100;
      if (row.class_id === null) {
        entry.note = row.note;
      }
      totals.set(key, entry);
    }
    for (const entry of totals.values()) {
      await next
        .insertInto('equipment_holdings')
        .values({ ...entry, class_id: null, next_year_need: null })
        .execute();
    }
    for (const row of await previous.selectFrom('school_profiles').selectAll().execute()) {
      await next
        .insertInto('school_profiles')
        .values({
          ...row,
          general: JSON.stringify(row.general),
          other_info: JSON.stringify(row.other_info),
          foreign_elements: JSON.stringify(row.foreign_elements),
          internet: JSON.stringify(row.internet),
          it_infrastructure: JSON.stringify(row.it_infrastructure),
          office_accounts: JSON.stringify(row.office_accounts),
        })
        .execute();
    }
  },
};
