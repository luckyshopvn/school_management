import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import type { AcademicYearTransitionStep } from '../academic-years/academic-year-transition.js';

// Mở năm học mới thì chép kho thư viện sang (DT-22 phần 22a, YCTD-181): thiết lập, quy định mượn, chỉ tiêu, phân loại, ấn
// phẩm, tệp số, bản sao (kể cả đã mất, thanh lý để giữ sổ đăng ký cá biệt), thẻ bạn đọc còn người trong năm mới, lượt mượn
// đang mở, lượt đặt trước đang chờ, bộ sách giáo khoa, bộ đếm số. Lượt mượn đã đóng, đợt kiểm kê ở lại năm cũ. Chạy sau các
// bước chép môn học, cán bộ, học sinh vì có khóa ngoại tới các bảng đó
export const libraryTransitionStep: AcademicYearTransitionStep = {
  name: 'library',
  async carryOver(context) {
    if (!context.previousDatabase) {
      return;
    }
    const previous = context.previousDatabase as Kysely<SchoolYearDatabase>;
    const next = context.newDatabase as Kysely<SchoolYearDatabase>;

    const settings = await previous.selectFrom('library_settings').selectAll().executeTakeFirst();
    if (settings) {
      await next
        .updateTable('library_settings')
        .set({
          student_levels: settings.student_levels,
          hold_days: settings.hold_days,
          updated_by_name: settings.updated_by_name,
          updated_at: settings.updated_at,
        })
        .where('id', '=', 1)
        .execute();
    }
    for (const rule of await previous.selectFrom('library_loan_rules').selectAll().execute()) {
      await next.updateTable('library_loan_rules').set(rule).where('reader_kind', '=', rule.reader_kind).execute();
    }
    for (const indicator of await previous.selectFrom('library_indicators').selectAll().execute()) {
      await next
        .updateTable('library_indicators')
        .set({ threshold: indicator.threshold, enabled: indicator.enabled })
        .where('code', '=', indicator.code)
        .execute();
    }

    // Phân loại: bộ mặc định của năm mới thay bằng bộ của năm cũ để ấn phẩm giữ nguyên mã phân loại
    await next.deleteFrom('library_categories').execute();
    for (const row of await previous.selectFrom('library_categories').selectAll().execute()) {
      await next.insertInto('library_categories').values(row).execute();
    }
    const subjectIds = new Set((await next.selectFrom('subjects').select('id').execute()).map((row) => row.id));
    for (const row of await previous.selectFrom('library_titles').selectAll().execute()) {
      await next
        .insertInto('library_titles')
        .values({ ...row, subject_id: row.subject_id && subjectIds.has(row.subject_id) ? row.subject_id : null })
        .execute();
    }
    for (const row of await previous.selectFrom('library_title_files').selectAll().execute()) {
      await next.insertInto('library_title_files').values(row).execute();
    }
    for (const row of await previous.selectFrom('library_copies').selectAll().execute()) {
      await next.insertInto('library_copies').values(row).execute();
    }

    const staffIds = new Set((await next.selectFrom('staff').select('id').execute()).map((row) => row.id));
    const childIds = new Set((await next.selectFrom('children').select('id').execute()).map((row) => row.id));
    const classIds = new Set((await next.selectFrom('classes').select('id').execute()).map((row) => row.id));
    const readerIds = new Set<string>();
    for (const row of await previous.selectFrom('library_readers').selectAll().execute()) {
      const present = row.staff_id ? staffIds.has(row.staff_id) : row.child_id ? childIds.has(row.child_id) : false;
      if (!present) {
        continue;
      }
      await next.insertInto('library_readers').values(row).execute();
      readerIds.add(row.id);
    }
    for (const row of await previous.selectFrom('library_loans').selectAll().where('status', '=', 'open').execute()) {
      if (!readerIds.has(row.reader_id)) {
        continue;
      }
      await next
        .insertInto('library_loans')
        .values({ ...row, class_id: row.class_id && classIds.has(row.class_id) ? row.class_id : null })
        .execute();
    }
    for (const row of await previous
      .selectFrom('library_reservations')
      .selectAll()
      .where('status', 'in', ['waiting', 'ready'])
      .execute()) {
      if (readerIds.has(row.reader_id)) {
        await next.insertInto('library_reservations').values(row).execute();
      }
    }
    for (const row of await previous.selectFrom('library_textbook_sets').selectAll().execute()) {
      await next.insertInto('library_textbook_sets').values(row).execute();
    }
    for (const row of await previous.selectFrom('library_textbook_set_titles').selectAll().execute()) {
      await next.insertInto('library_textbook_set_titles').values(row).execute();
    }
    for (const row of await previous.selectFrom('library_counters').selectAll().execute()) {
      await next
        .insertInto('library_counters')
        .values(row)
        .onConflict((conflict) => conflict.column('name').doUpdateSet({ value: row.value }))
        .execute();
    }
  },
};
