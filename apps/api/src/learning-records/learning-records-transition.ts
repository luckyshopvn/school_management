import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import type { AcademicYearTransitionStep } from '../academic-years/academic-year-transition.js';

// Kết chuyển sang năm học mới (DT-20 phần 20e, YCTD-163), chạy sau bước học sinh: danh hiệu khen thưởng chuyển sang; học bạ
// của mọi năm chép sang (không trỏ lớp) để năm học mới có đủ học bạ các năm của học sinh; học sinh hoàn thành chương trình
// cấp học ở khối cuối cấp chuyển trạng thái "Hoàn thành chương trình" ở năm học mới và thôi xếp lớp. Lên lớp, ở lại lớp
// giữ khối năm sau ở `completion_results` của năm cũ để xếp lớp năm mới; khen thưởng, kết quả ở lại năm cũ
export const learningRecordsTransitionStep: AcademicYearTransitionStep = {
  name: 'learning-records',
  async carryOver(context) {
    if (!context.previousDatabase) {
      return;
    }
    const previous = context.previousDatabase as Kysely<SchoolYearDatabase>;
    const next = context.newDatabase as Kysely<SchoolYearDatabase>;
    for (const row of await previous.selectFrom('student_award_titles').selectAll().execute()) {
      await next.insertInto('student_award_titles').values(row).execute();
    }
    const carried = new Set((await next.selectFrom('children').select('id').execute()).map((row) => row.id));
    for (const row of await previous.selectFrom('learning_records').selectAll().execute()) {
      if (!carried.has(row.child_id)) {
        continue;
      }
      await next
        .insertInto('learning_records')
        .values({ ...row, class_id: null, content: JSON.stringify(row.content) })
        .execute();
    }
    const completed = (
      await previous
        .selectFrom('completion_results')
        .select('child_id')
        .where('outcome', '=', 'level_completed')
        .execute()
    ).map((row) => row.child_id);
    const graduates = completed.filter((childId) => carried.has(childId));
    if (graduates.length > 0) {
      await next
        .updateTable('children')
        .set({
          status: 'graduated',
          leave_date: context.academicYear.startDate,
          leave_reason: 'Hoàn thành chương trình',
        })
        .where('id', 'in', graduates)
        .execute();
      await next
        .updateTable('class_enrollments')
        .set({ is_current: false })
        .where('child_id', 'in', graduates)
        .where('is_current', '=', true)
        .execute();
    }
  },
};
