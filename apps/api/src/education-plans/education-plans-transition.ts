import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import type { AcademicYearTransitionStep } from '../academic-years/academic-year-transition.js';

// Mở năm học mới thì chép thư viện mẫu kế hoạch giáo dục, giữ nguyên mã định danh để kế hoạch năm trước sao chép sang dùng
// đúng mẫu năm nay (DT-18 phần 22i, YCTD-147). Kế hoạch ở lại năm cũ để sao chép và so sánh. Chạy sau bước hồ sơ chuyên môn
// vì mẫu tham chiếu thư mục lưu kho; thư mục không còn thì bỏ liên kết
export const educationPlansTransitionStep: AcademicYearTransitionStep = {
  name: 'education-plans',
  async carryOver(context) {
    if (!context.previousDatabase) {
      return;
    }
    const previous = context.previousDatabase as Kysely<SchoolYearDatabase>;
    const next = context.newDatabase as Kysely<SchoolYearDatabase>;
    const folders = new Set(
      (await next.selectFrom('professional_folders').select('id').execute()).map((row) => row.id),
    );
    for (const template of await previous.selectFrom('education_plan_templates').selectAll().execute()) {
      await next
        .insertInto('education_plan_templates')
        .values({
          ...template,
          sections: JSON.stringify(template.sections),
          archive_folder_id:
            template.archive_folder_id && folders.has(template.archive_folder_id) ? template.archive_folder_id : null,
        })
        .execute();
    }
  },
};
