import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import type { AcademicYearTransitionStep } from '../academic-years/academic-year-transition.js';

// Mở năm học mới thì chuyển quá trình công tác, chứng chỉ, khoản thưởng và khấu trừ (theo bảng lương được chuyển), chỉ
// số và phiếu đánh giá, việc chưa xong (bỏ liên kết kế hoạch) kèm cập nhật tiến độ, giữ nguyên mã định danh; kế hoạch tra
// ở năm cũ (YCTD-81); việc giao theo cây đơn vị chuyển kèm phân công, tệp (YCTD-141). Chạy sau bước nhân sự và bảng
// lương vì tham chiếu hồ sơ nhân sự và danh mục lương
export const workTransitionStep: AcademicYearTransitionStep = {
  name: 'work',
  async carryOver(context) {
    if (!context.previousDatabase) {
      return;
    }
    const previous = context.previousDatabase as Kysely<SchoolYearDatabase>;
    const next = context.newDatabase as Kysely<SchoolYearDatabase>;
    for (const table of ['staff_work_history', 'staff_certificates', 'staff_bonus_deductions'] as const) {
      for (const row of await previous.selectFrom(table).selectAll().execute()) {
        await next.insertInto(table).values(row).execute();
      }
    }
    for (const row of await previous.selectFrom('evaluation_criteria').selectAll().execute()) {
      await next.insertInto('evaluation_criteria').values(row).execute();
    }
    // Phiếu được thay thế phải chuyển trước phiếu thay nó
    for (const row of await previous.selectFrom('evaluations').selectAll().orderBy('created_at').execute()) {
      await next.insertInto('evaluations').values(row).execute();
    }
    for (const row of await previous.selectFrom('evaluation_scores').selectAll().execute()) {
      await next.insertInto('evaluation_scores').values(row).execute();
    }
    const openTasks = await previous
      .selectFrom('tasks')
      .selectAll()
      .where('status', 'in', ['todo', 'in_progress'])
      .execute();
    for (const row of openTasks) {
      await next
        .insertInto('tasks')
        .values({ ...row, plan_item_id: null })
        .execute();
    }
    if (openTasks.length > 0) {
      const taskIds = openTasks.map((task) => task.id);
      // Phân công thực hiện, tệp đính kèm của việc giao theo cây đơn vị (DT-18 phần 18c); dòng phân công tiếp chuyển sau
      // dòng của đơn vị vì tham chiếu dòng đó
      for (const row of await previous
        .selectFrom('task_assignments')
        .selectAll()
        .where('task_id', 'in', taskIds)
        .orderBy('created_at')
        .execute()) {
        await next.insertInto('task_assignments').values(row).execute();
      }
      for (const row of await previous.selectFrom('task_files').selectAll().where('task_id', 'in', taskIds).execute()) {
        await next.insertInto('task_files').values(row).execute();
      }
      for (const row of await previous
        .selectFrom('task_updates')
        .selectAll()
        .where(
          'task_id',
          'in',
          openTasks.map((task) => task.id),
        )
        .execute()) {
        await next.insertInto('task_updates').values(row).execute();
      }
    }
  },
};
