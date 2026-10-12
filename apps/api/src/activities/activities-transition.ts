import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import type { AcademicYearTransitionStep } from '../academic-years/academic-year-transition.js';

// Mở năm học mới thì chuyển danh mục hoạt động, danh mục tin tức, chủ đề thư viện, album và nội dung thư viện, hình tô màu
// kèm dòng tệp (nội dung tệp ở kho dùng chung). Nội dung theo lớp hoặc theo trẻ không chuyển vì lớp và trẻ đổi theo năm
// học; hoạt động của lớp, tin tức, bình luận, ngoại khóa và đăng ký tra ở năm cũ (YCTD-78). Chạy sau bước chuyển kho
export const activitiesTransitionStep: AcademicYearTransitionStep = {
  name: 'activities',
  async carryOver(context) {
    if (!context.previousDatabase) {
      return;
    }
    const previous = context.previousDatabase as Kysely<SchoolYearDatabase>;
    const next = context.newDatabase as Kysely<SchoolYearDatabase>;
    for (const table of ['activity_categories', 'news_categories', 'library_topics'] as const) {
      for (const row of await previous.selectFrom(table).selectAll().execute()) {
        await next.insertInto(table).values(row).execute();
      }
    }
    const albums = await previous.selectFrom('library_albums').selectAll().execute();
    const items = await previous
      .selectFrom('library_items')
      .selectAll()
      .where('scope_type', 'in', ['school', 'unit'])
      .execute();
    const pages = await previous
      .selectFrom('coloring_pages')
      .selectAll()
      .where('scope_type', 'in', ['school', 'unit'])
      .execute();
    const fileIds = new Set<string>();
    for (const id of [
      ...albums.map((row) => row.cover_file_id),
      ...items.map((row) => row.file_id),
      ...pages.map((row) => row.file_id),
    ]) {
      if (id) {
        fileIds.add(id);
      }
    }
    if (fileIds.size > 0) {
      for (const row of await previous
        .selectFrom('files')
        .selectAll()
        .where('id', 'in', [...fileIds])
        .execute()) {
        await next
          .insertInto('files')
          .values(row)
          .onConflict((conflict) => conflict.column('id').doNothing())
          .execute();
      }
    }
    for (const row of albums) {
      await next.insertInto('library_albums').values(row).execute();
    }
    for (const row of items) {
      await next.insertInto('library_items').values(row).execute();
    }
    for (const row of pages) {
      await next.insertInto('coloring_pages').values(row).execute();
    }
  },
};
