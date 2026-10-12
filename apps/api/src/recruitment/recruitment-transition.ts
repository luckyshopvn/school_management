import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import type { AcademicYearTransitionStep } from '../academic-years/academic-year-transition.js';

// Mở năm học mới thì chuyển đề nghị tuyển dụng đang chờ duyệt hoặc đã duyệt kèm mọi tin của đề nghị, ứng viên, dòng tệp
// hồ sơ xin việc (nội dung ở kho dùng chung) và lịch phỏng vấn, giữ nguyên mã định danh; đề nghị đã đóng hoặc bị từ chối
// tra ở năm cũ. Số thứ tự đề nghị tiếp nối năm cũ để mã đề nghị không trùng (YCTD-87). Chạy sau bước nhân sự vì ứng viên
// đã tuyển tham chiếu hồ sơ nhân sự
export const recruitmentTransitionStep: AcademicYearTransitionStep = {
  name: 'recruitment',
  async carryOver(context) {
    if (!context.previousDatabase) {
      return;
    }
    const previous = context.previousDatabase as Kysely<SchoolYearDatabase>;
    const next = context.newDatabase as Kysely<SchoolYearDatabase>;
    const sequence = await previous
      .selectFrom('document_sequences')
      .select('last_value')
      .where('document_type', '=', 'recruitment_request')
      .executeTakeFirst();
    const requests = await previous
      .selectFrom('recruitment_requests')
      .selectAll()
      .where('status', 'in', ['pending', 'approved'])
      .execute();
    if (sequence && requests.length > 0) {
      await next
        .insertInto('document_sequences')
        .values({ document_type: 'recruitment_request', last_value: sequence.last_value })
        .onConflict((conflict) => conflict.column('document_type').doUpdateSet({ last_value: sequence.last_value }))
        .execute();
    }
    if (requests.length === 0) {
      return;
    }
    for (const row of requests) {
      await next.insertInto('recruitment_requests').values(row).execute();
    }
    const postings = await previous
      .selectFrom('job_postings')
      .selectAll()
      .where(
        'request_id',
        'in',
        requests.map((request) => request.id),
      )
      .execute();
    for (const row of postings) {
      await next.insertInto('job_postings').values(row).execute();
    }
    if (postings.length === 0) {
      return;
    }
    const candidates = await previous
      .selectFrom('candidates')
      .selectAll()
      .where(
        'posting_id',
        'in',
        postings.map((posting) => posting.id),
      )
      .execute();
    const fileIds = candidates.map((candidate) => candidate.cv_file_id).filter((id): id is string => id !== null);
    if (fileIds.length > 0) {
      for (const row of await previous.selectFrom('files').selectAll().where('id', 'in', fileIds).execute()) {
        await next
          .insertInto('files')
          .values(row)
          .onConflict((conflict) => conflict.column('id').doNothing())
          .execute();
      }
    }
    // Hồ sơ nhân sự đã chuyển ở bước nhân sự; nếu không có thì bỏ liên kết để không gãy khóa ngoại
    const staffIds = new Set((await next.selectFrom('staff').select('id').execute()).map((staff) => staff.id));
    for (const row of candidates) {
      await next
        .insertInto('candidates')
        .values({ ...row, staff_id: row.staff_id && staffIds.has(row.staff_id) ? row.staff_id : null })
        .execute();
    }
    if (candidates.length > 0) {
      for (const row of await previous
        .selectFrom('interviews')
        .selectAll()
        .where(
          'candidate_id',
          'in',
          candidates.map((candidate) => candidate.id),
        )
        .execute()) {
        await next.insertInto('interviews').values(row).execute();
      }
    }
  },
};
