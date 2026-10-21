import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import type { AcademicYearTransitionStep } from '../academic-years/academic-year-transition.js';

// Mở năm học mới thì chuyển cây thư mục hồ sơ chuyên môn (luồng duyệt, cần kí) và nhóm công tác kèm thành viên còn trong
// danh sách nhân sự, giữ nguyên mã định danh (DT-18 phần 18e, YCTD-142). Hồ sơ, đợt nộp ở lại kho của năm cũ; năm mới bắt
// đầu chưa khóa. Chạy sau bước nhân sự vì thành viên tham chiếu hồ sơ nhân sự
export const professionalRecordsTransitionStep: AcademicYearTransitionStep = {
  name: 'professional-records',
  async carryOver(context) {
    if (!context.previousDatabase) {
      return;
    }
    const previous = context.previousDatabase as Kysely<SchoolYearDatabase>;
    const next = context.newDatabase as Kysely<SchoolYearDatabase>;
    // Thư mục cha chuyển trước thư mục con
    const folders = await previous.selectFrom('professional_folders').selectAll().execute();
    const moved = new Set<string>();
    let pending = folders;
    while (pending.length > 0) {
      const ready = pending.filter((folder) => folder.parent_id === null || moved.has(folder.parent_id));
      if (ready.length === 0) {
        break;
      }
      for (const folder of ready) {
        await next.insertInto('professional_folders').values(folder).execute();
        moved.add(folder.id);
      }
      pending = pending.filter((folder) => !moved.has(folder.id));
    }
    for (const group of await previous.selectFrom('professional_work_groups').selectAll().execute()) {
      await next.insertInto('professional_work_groups').values(group).execute();
    }
    const staffIds = new Set((await next.selectFrom('staff').select('id').execute()).map((staff) => staff.id));
    for (const member of await previous.selectFrom('professional_work_group_members').selectAll().execute()) {
      if (staffIds.has(member.staff_id)) {
        await next.insertInto('professional_work_group_members').values(member).execute();
      }
    }
  },
};
