import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-22 phần 22e (YCTD-182): hồ sơ bồi dưỡng giáo viên theo năm học. Chỉ phần quản trị (ghi nhận, theo dõi, cấp chứng
// nhận), không làm lớp học trực tuyến. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - Khoá, đợt bồi dưỡng (`training_courses`): do trường tổ chức hoặc ghi nhận khoá của cấp trên, đơn vị ngoài; chuyên đề lấy
//   ở danh mục hệ thống (lưu kèm tên, chương trình để đọc lại khi danh mục đổi); số tiết, chỉ tiêu, hạn đăng ký; trạng thái
//   đang mở đăng ký, đã đóng đăng ký, đã kết thúc (ghi kết quả).
// - Đăng ký (`training_registrations`): giáo viên đăng ký; tổ trưởng duyệt cấp tổ (tùy chọn), Ban Giám hiệu duyệt; điểm danh
//   số buổi có mặt; kết quả đạt, không đạt, số tiết được ghi nhận, nhận xét; chứng nhận do trường cấp gắn ở đây.
// - Chứng chỉ ở một bảng `staff_certificates` (không bảng thứ hai): thêm cột loại (nhập tay, sinh từ khoá, chứng nhận do
//   trường cấp), tệp bản sao, khoá liên quan, số tiết, mã tra cứu công khai, thu hồi; cột cũ giữ nguyên, dữ liệu cũ là
//   loại nhập tay.
// - Tự đánh giá năng lực số theo kỳ (`digital_competency_assessments`, `digital_competency_scores`): mỗi miền một mức tự đánh
//   giá, mức xác nhận của tổ trưởng hoặc Ban Giám hiệu, đổi mức thì có lý do
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('training_courses')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 300`))
      .addColumn('topic_id', 'uuid')
      .addColumn('topic_name', 'text')
      .addColumn('program_no', 'smallint', (column) => column.check(sql`program_no between 1 and 3`))
      .addColumn('competency_domain_code', 'text')
      .addColumn('organizer_kind', 'text', (column) =>
        column.notNull().check(sql`organizer_kind in ('school', 'external')`),
      )
      .addColumn('organizer_name', 'text')
      .addColumn('mode', 'text', (column) =>
        column.notNull().defaultTo('in_person').check(sql`mode in ('in_person', 'online', 'self_study')`),
      )
      .addColumn('location', 'text')
      .addColumn('start_date', 'date', (column) => column.notNull())
      .addColumn('end_date', 'date', (column) => column.notNull())
      .addColumn('periods', 'integer', (column) => column.notNull().check(sql`periods between 1 and 1000`))
      .addColumn('sessions', 'integer', (column) => column.notNull().defaultTo(1).check(sql`sessions between 1 and 200`))
      .addColumn('quota', 'integer', (column) => column.check(sql`quota is null or quota >= 1`))
      .addColumn('registration_deadline', 'date')
      .addColumn('issues_certificate', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('status', 'text', (column) =>
        column.notNull().defaultTo('open').check(sql`status in ('open', 'closed', 'completed')`),
      )
      .addColumn('note', 'text')
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('training_courses_range_check', sql`end_date >= start_date`)
      .execute();

    await database.schema
      .createTable('training_registrations')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('course_id', 'uuid', (column) => column.notNull().references('training_courses.id').onDelete('cascade'))
      .addColumn('staff_id', 'uuid', (column) => column.notNull().references('staff.id'))
      .addColumn('staff_name', 'text', (column) => column.notNull())
      .addColumn('department_id', 'uuid')
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('pending')
          .check(sql`status in ('pending', 'team_approved', 'approved', 'rejected', 'cancelled')`),
      )
      .addColumn('note', 'text')
      .addColumn('team_reviewed_by_name', 'text')
      .addColumn('team_reviewed_at', 'timestamptz')
      .addColumn('reviewed_by_name', 'text')
      .addColumn('reviewed_at', 'timestamptz')
      .addColumn('review_note', 'text')
      .addColumn('attended_sessions', 'integer', (column) => column.check(sql`attended_sessions >= 0`))
      .addColumn('result', 'text', (column) => column.check(sql`result in ('passed', 'failed')`))
      .addColumn('credited_periods', 'integer', (column) => column.check(sql`credited_periods between 0 and 1000`))
      .addColumn('result_comment', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('training_registrations_unique', ['course_id', 'staff_id'])
      .execute();
    await database.schema
      .createIndex('training_registrations_staff_index')
      .on('training_registrations')
      .column('staff_id')
      .execute();

    await database.schema
      .alterTable('staff_certificates')
      .addColumn('kind', 'text', (column) =>
        column.notNull().defaultTo('manual').check(sql`kind in ('manual', 'course', 'school')`),
      )
      .addColumn('file_id', 'uuid')
      .addColumn('course_id', 'uuid', (column) => column.references('training_courses.id').onDelete('set null'))
      .addColumn('registration_id', 'uuid', (column) =>
        column.references('training_registrations.id').onDelete('set null'),
      )
      .addColumn('periods', 'integer', (column) => column.check(sql`periods between 0 and 1000`))
      .addColumn('lookup_code', 'text', (column) => column.unique())
      .addColumn('revoked_at', 'timestamptz')
      .addColumn('revoke_reason', 'text')
      .execute();

    await database.schema
      .createTable('digital_competency_assessments')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('staff_id', 'uuid', (column) => column.notNull().references('staff.id'))
      .addColumn('staff_name', 'text', (column) => column.notNull())
      .addColumn('department_id', 'uuid')
      .addColumn('term', 'text', (column) => column.notNull().check(sql`term in ('term_1', 'term_2', 'year')`))
      .addColumn('status', 'text', (column) =>
        column.notNull().defaultTo('submitted').check(sql`status in ('submitted', 'confirmed')`),
      )
      .addColumn('confirmed_by_name', 'text')
      .addColumn('confirmed_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('digital_competency_assessments_unique', ['staff_id', 'term'])
      .execute();
    await database.schema
      .createTable('digital_competency_scores')
      .addColumn('assessment_id', 'uuid', (column) =>
        column.notNull().references('digital_competency_assessments.id').onDelete('cascade'),
      )
      .addColumn('domain_code', 'text', (column) => column.notNull())
      .addColumn('domain_name', 'text', (column) => column.notNull())
      .addColumn('self_level', 'smallint', (column) => column.notNull().check(sql`self_level between 1 and 10`))
      .addColumn('confirmed_level', 'smallint', (column) => column.check(sql`confirmed_level between 1 and 10`))
      .addColumn('reason', 'text')
      .addPrimaryKeyConstraint('digital_competency_scores_pk', ['assessment_id', 'domain_code'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('digital_competency_scores').execute();
    await database.schema.dropTable('digital_competency_assessments').execute();
    await database.schema
      .alterTable('staff_certificates')
      .dropColumn('revoke_reason')
      .dropColumn('revoked_at')
      .dropColumn('lookup_code')
      .dropColumn('periods')
      .dropColumn('registration_id')
      .dropColumn('course_id')
      .dropColumn('file_id')
      .dropColumn('kind')
      .execute();
    await database.schema.dropTable('training_registrations').execute();
    await database.schema.dropTable('training_courses').execute();
  },
};
