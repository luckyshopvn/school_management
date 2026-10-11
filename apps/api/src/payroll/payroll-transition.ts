import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import type { AcademicYearTransitionStep } from '../academic-years/academic-year-transition.js';

// Mở năm học mới thì chuyển danh mục lương, khoản gán, biểu thuế và bảng lương sang, giữ nguyên mã định danh (QĐ-17,
// YCTD-60). Biểu thuế mặc định đã có sẵn trong năm học mới nên bản của năm cũ ghi đè để giữ phần kế toán đã sửa
export const payrollTransitionStep: AcademicYearTransitionStep = {
  name: 'payroll',
  async carryOver(context) {
    if (!context.previousDatabase) {
      return;
    }
    const previous = context.previousDatabase as Kysely<SchoolYearDatabase>;
    const next = context.newDatabase as Kysely<SchoolYearDatabase>;
    for (const row of await previous.selectFrom('pay_item_types').selectAll().execute()) {
      await next.insertInto('pay_item_types').values(row).execute();
    }
    for (const row of await previous.selectFrom('staff_pay_items').selectAll().execute()) {
      await next.insertInto('staff_pay_items').values(row).execute();
    }
    for (const row of await previous.selectFrom('tax_tables').selectAll().execute()) {
      const values = { ...row, brackets: JSON.stringify(row.brackets) };
      await next
        .insertInto('tax_tables')
        .values(values)
        .onConflict((conflict) =>
          conflict.column('id').doUpdateSet({
            effective_from: values.effective_from,
            personal_deduction: values.personal_deduction,
            dependent_deduction: values.dependent_deduction,
            brackets: values.brackets,
          }),
        )
        .execute();
    }
    for (const row of await previous.selectFrom('payrolls').selectAll().execute()) {
      await next
        .insertInto('payrolls')
        .values({ ...row, skipped: JSON.stringify(row.skipped) })
        .execute();
    }
    for (const row of await previous.selectFrom('payslips').selectAll().execute()) {
      await next.insertInto('payslips').values(row).execute();
    }
    for (const row of await previous.selectFrom('payslip_lines').selectAll().execute()) {
      await next.insertInto('payslip_lines').values(row).execute();
    }
  },
};
