import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import type { AcademicYearTransitionStep } from '../academic-years/academic-year-transition.js';

// Mở năm học mới thì chuyển cấu hình của các đơn vị và mẫu thông báo toàn trường sang (12_KIEN_TRUC_HE_THONG.md mục 3,
// YCTD-64, YCTD-69); chạy sau bước chuyển cây đơn vị
export const settingsTransitionStep: AcademicYearTransitionStep = {
  name: 'settings',
  async carryOver(context) {
    if (!context.previousDatabase) {
      return;
    }
    const previous = context.previousDatabase as Kysely<SchoolYearDatabase>;
    const next = context.newDatabase as Kysely<SchoolYearDatabase>;
    const rows = await previous.selectFrom('settings').selectAll().execute();
    for (const row of rows) {
      await next
        .insertInto('settings')
        .values({ ...row, value: JSON.stringify(row.value) })
        .execute();
    }
    for (const row of await previous.selectFrom('notification_templates').selectAll().execute()) {
      await next.insertInto('notification_templates').values(row).execute();
    }
  },
};
