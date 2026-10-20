import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import type { AcademicYearTransitionStep } from '../academic-years/academic-year-transition.js';

// Mở năm học mới thì chuyển hồ sơ trường, danh mục thiết bị dạy học và số lượng hiện có sang năm mới (YCTD-102); phòng
// học kèm khối phòng, hiện trạng chuyển ở bước danh mục. Chạy sau bước chuyển danh mục và trước bước chuyển kho, vì tài sản
// tham chiếu thiết bị:
// - danh mục thiết bị năm mới thay bằng danh mục của năm cũ (giữ mã định danh, kể cả chỉnh sửa của Hiệu trưởng);
// - số hiện có chuyển theo đơn vị: số nhập theo lớp cộng vào dòng của đơn vị vì lớp không chuyển sang năm mới; nhu cầu bổ
//   sung năm sau bỏ trống để nhập lại;
// - nơi để thiết bị chuyển nguyên (DT-18 phần 18g); lô của đơn vị giữ nơi để và mã tem, lô theo lớp gộp vào lô của đơn vị
//   nên tem của lô theo lớp phải in lại; tài sản giữ nơi để, mã tem ở bước chuyển kho. Đợt kiểm kê tra ở năm cũ
export const facilitiesTransitionStep: AcademicYearTransitionStep = {
  name: 'facilities',
  async carryOver(context) {
    if (!context.previousDatabase) {
      return;
    }
    const previous = context.previousDatabase as Kysely<SchoolYearDatabase>;
    const next = context.newDatabase as Kysely<SchoolYearDatabase>;
    const locations = await previous
      .selectFrom('equipment_locations')
      .selectAll()
      .orderBy((eb) => eb.case().when('parent_id', 'is', null).then(0).else(1).end())
      .execute();
    for (const row of locations) {
      await next.insertInto('equipment_locations').values(row).execute();
    }
    const items = await previous.selectFrom('equipment_items').selectAll().execute();
    await next.deleteFrom('equipment_items').execute();
    for (const row of items) {
      await next.insertInto('equipment_items').values(row).execute();
    }
    const holdings = await previous.selectFrom('equipment_holdings').selectAll().execute();
    const totals = new Map<
      string,
      {
        equipment_item_id: string;
        org_unit_id: string;
        quantity: number;
        note: string | null;
        updated_by: string;
        location_id: string | null;
        qr_code: string | null;
      }
    >();
    for (const row of holdings) {
      const key = `${row.equipment_item_id}:${row.org_unit_id}`;
      const entry = totals.get(key) ?? {
        equipment_item_id: row.equipment_item_id,
        org_unit_id: row.org_unit_id,
        quantity: 0,
        note: null,
        updated_by: row.updated_by,
        location_id: null,
        qr_code: null,
      };
      entry.quantity = Math.round((entry.quantity + Number(row.quantity)) * 100) / 100;
      if (row.class_id === null) {
        entry.note = row.note;
        entry.location_id = row.location_id;
        entry.qr_code = row.qr_code;
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
