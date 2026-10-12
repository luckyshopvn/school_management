import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import type { AcademicYearTransitionStep } from '../academic-years/academic-year-transition.js';

// Mở năm học mới thì chuyển cấu hình kết nối ngoài và liên kết Zalo của phụ huynh (theo số điện thoại, không phụ thuộc năm
// học); bài đăng Fanpage tra ở năm cũ (YCTD-90)
export const integrationsTransitionStep: AcademicYearTransitionStep = {
  name: 'integrations',
  async carryOver(context) {
    if (!context.previousDatabase) {
      return;
    }
    const previous = context.previousDatabase as Kysely<SchoolYearDatabase>;
    const next = context.newDatabase as Kysely<SchoolYearDatabase>;
    for (const row of await previous.selectFrom('integration_settings').selectAll().execute()) {
      await next
        .insertInto('integration_settings')
        .values({ ...row, config_data: JSON.stringify(row.config_data) })
        .execute();
    }
    for (const row of await previous.selectFrom('zalo_followers').selectAll().execute()) {
      await next.insertInto('zalo_followers').values(row).execute();
    }
  },
};
