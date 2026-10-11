import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import type { AcademicYearTransitionStep } from '../academic-years/academic-year-transition.js';

// Mở năm học mới thì chuyển tiêu chuẩn sức khỏe và chỉ số theo lần đo của trẻ đã được chuyển để theo dõi tăng trưởng liên
// tục; đợt khám, kết quả khám, sự kiện y tế, chăm sóc hằng ngày, yêu cầu báo cáo tra ở năm cũ (YCTD-74). Chạy sau bước
// chuyển trẻ
export const healthTransitionStep: AcademicYearTransitionStep = {
  name: 'health',
  async carryOver(context) {
    if (!context.previousDatabase) {
      return;
    }
    const previous = context.previousDatabase as Kysely<SchoolYearDatabase>;
    const next = context.newDatabase as Kysely<SchoolYearDatabase>;
    for (const row of await previous.selectFrom('health_standards').selectAll().execute()) {
      await next.insertInto('health_standards').values(row).execute();
    }
    const carried = (await next.selectFrom('children').select('id').execute()).map((row) => row.id);
    if (carried.length === 0) {
      return;
    }
    for (const row of await previous
      .selectFrom('health_measurements')
      .selectAll()
      .where('child_id', 'in', carried)
      .execute()) {
      await next.insertInto('health_measurements').values(row).execute();
    }
  },
};
