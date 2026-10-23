import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import type { AcademicYearTransitionStep } from '../academic-years/academic-year-transition.js';

// Mở năm học mới thì chuyển cấu hình nề nếp (bật, điểm nền) và bộ tiêu chí sang; điểm đã ghi ở lại năm cũ (YCTD-159)
export const conductTransitionStep: AcademicYearTransitionStep = {
  name: 'conduct',
  async carryOver(context) {
    if (!context.previousDatabase) {
      return;
    }
    const previous = context.previousDatabase as Kysely<SchoolYearDatabase>;
    const next = context.newDatabase as Kysely<SchoolYearDatabase>;
    const settings = await previous.selectFrom('conduct_settings').selectAll().executeTakeFirst();
    if (settings) {
      await next
        .insertInto('conduct_settings')
        .values(settings)
        .onConflict((conflict) =>
          conflict.column('id').doUpdateSet({
            enabled: settings.enabled,
            base_points: settings.base_points,
            updated_by_name: settings.updated_by_name,
            updated_at: settings.updated_at,
          }),
        )
        .execute();
    }
    for (const row of await previous.selectFrom('conduct_criteria').selectAll().execute()) {
      await next.insertInto('conduct_criteria').values(row).execute();
    }
  },
};
