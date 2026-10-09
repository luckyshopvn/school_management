import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import type { AcademicYearTransitionStep } from '../academic-years/academic-year-transition.js';

// Mở năm học mới thì chuyển cả cây đơn vị sang, giữ nguyên mã định danh (QĐ-17)
export const orgUnitsTransitionStep: AcademicYearTransitionStep = {
  name: 'org_units',
  async carryOver(context) {
    if (!context.previousDatabase) {
      return;
    }
    const previous = context.previousDatabase as Kysely<SchoolYearDatabase>;
    const next = context.newDatabase as Kysely<SchoolYearDatabase>;
    const units = await previous.selectFrom('org_units').selectAll().execute();
    // Trường chính có parent_id trống nên được chép trước các đơn vị cấp 2
    const ordered = [
      ...units.filter((unit) => unit.parent_id === null),
      ...units.filter((unit) => unit.parent_id !== null),
    ];
    for (const unit of ordered) {
      await next.insertInto('org_units').values(unit).execute();
    }
  },
};
