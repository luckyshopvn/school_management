import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-20 phần 20e (YCTD-163): học bạ số, khen thưởng cuối năm, hoàn thành chương trình lớp học, chương trình tiểu học; lên
// lớp, rèn luyện trong hè, kiểm tra lại. Đọc kết quả đánh giá đã khoá của 20c. Claude tự chọn theo ủy quyền của Eric ngày
// 2026-10-11:
// - `student_award_titles`: danh hiệu khen thưởng học sinh theo cấp, cấu hình được (căn cứ gợi ý: kết quả cuối năm hoàn
//   thành xuất sắc, hoàn thành tốt kèm đề nghị, hoặc không gợi ý); `student_awards`: đề nghị, duyệt, mã tra cứu giấy khen;
// - `completion_results`: kết quả hoàn thành chương trình của học sinh trong lớp (lên lớp, hoàn thành chương trình cấp học ở
//   khối cuối cấp, chưa hoàn thành đang rèn luyện trong hè hoặc kiểm tra lại, ở lại lớp), khối năm sau theo 19b;
// - `learning_records`: học bạ của học sinh theo năm học, nội dung chốt dạng JSON lúc lập (đọc từ kết quả đã khoá), nhận xét
//   của giáo viên chủ nhiệm, xác nhận và kí của Hiệu trưởng (tệp đã kí ở kho tệp). Học bạ các năm trước chép sang năm học
//   mới khi chuyển năm nên mỗi năm học có đủ học bạ của học sinh đang học. 20f (EMIS) đọc các bảng này
const SCHOOL_LEVELS = `'MN', 'TH', 'THCS', 'THPT'`;

export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('student_award_titles')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('school_level', 'text', (column) =>
        column.notNull().check(sql.raw(`school_level in (${SCHOOL_LEVELS})`)),
      )
      .addColumn('code', 'text', (column) => column.notNull().check(sql`char_length(code) between 1 and 30`))
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 200`))
      .addColumn('kind', 'text', (column) => column.notNull())
      .addColumn('basis', 'text')
      .addColumn('order_no', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('student_award_titles_kind_check', sql`kind in ('year_end', 'special')`)
      .addCheckConstraint(
        'student_award_titles_basis_check',
        sql`basis is null or basis in ('excellent', 'outstanding')`,
      )
      .addCheckConstraint('student_award_titles_status_check', sql`status in ('active', 'inactive')`)
      .addUniqueConstraint('student_award_titles_code_unique', ['school_level', 'code'])
      .execute();

    await database.schema
      .createTable('student_awards')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('title_id', 'uuid', (column) => column.notNull().references('student_award_titles.id'))
      .addColumn('title_name', 'text', (column) => column.notNull())
      .addColumn('achievement', 'text', (column) => column.check(sql`char_length(achievement) <= 1000`))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('proposed'))
      .addColumn('proposed_by', 'uuid', (column) => column.notNull())
      .addColumn('proposed_by_name', 'text', (column) => column.notNull())
      .addColumn('proposed_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('decided_by', 'uuid')
      .addColumn('decided_by_name', 'text')
      .addColumn('decided_at', 'timestamptz')
      .addColumn('decision_note', 'text', (column) => column.check(sql`char_length(decision_note) <= 1000`))
      .addColumn('lookup_code', 'text', (column) => column.unique())
      .addCheckConstraint('student_awards_status_check', sql`status in ('proposed', 'approved', 'rejected')`)
      .execute();
    await sql`create unique index student_awards_active_unique on student_awards (child_id, title_id)
      where status <> 'rejected'`.execute(database);

    await database.schema
      .createTable('completion_results')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('grade_level', 'text', (column) => column.notNull())
      .addColumn('year_result', 'text', (column) => column.notNull())
      .addColumn('outcome', 'text', (column) => column.notNull())
      .addColumn('support_plan', 'text')
      .addColumn('support_result', 'text')
      .addColumn('support_note', 'text', (column) => column.check(sql`char_length(support_note) <= 1000`))
      .addColumn('next_grade_level', 'text')
      .addColumn('confirmed_by', 'uuid', (column) => column.notNull())
      .addColumn('confirmed_by_name', 'text', (column) => column.notNull())
      .addColumn('confirmed_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'completion_results_outcome_check',
        sql`outcome in ('promoted', 'level_completed', 'pending_support', 'retained')`,
      )
      .addCheckConstraint(
        'completion_results_support_check',
        sql`(support_plan is null or support_plan in ('summer_training', 'retest'))
          and (support_result is null or support_result in ('completed', 'not_completed'))`,
      )
      .addUniqueConstraint('completion_results_class_child_unique', ['class_id', 'child_id'])
      .execute();

    await database.schema
      .createTable('learning_records')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('academic_year_name', 'text', (column) => column.notNull())
      // Lớp của năm học đang mở; học bạ chép từ năm trước không trỏ tới lớp
      .addColumn('class_id', 'uuid', (column) => column.references('classes.id'))
      .addColumn('class_name', 'text', (column) => column.notNull())
      .addColumn('grade_level', 'text', (column) => column.notNull())
      .addColumn('school_level', 'text', (column) =>
        column.notNull().check(sql.raw(`school_level in (${SCHOOL_LEVELS})`)),
      )
      .addColumn('content', 'jsonb', (column) => column.notNull())
      .addColumn('homeroom_comment', 'text', (column) => column.check(sql`char_length(homeroom_comment) <= 2000`))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('draft'))
      .addColumn('signed_storage_key', 'text')
      .addColumn('signed_at', 'timestamptz')
      .addColumn('signer_name', 'text')
      .addColumn('signature_method', 'text')
      .addColumn('prepared_by_name', 'text', (column) => column.notNull())
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('learning_records_status_check', sql`status in ('draft', 'signed')`)
      .addUniqueConstraint('learning_records_child_year_unique', ['child_id', 'academic_year_name'])
      .execute();
  },
  async down(database) {
    for (const table of ['learning_records', 'completion_results', 'student_awards', 'student_award_titles']) {
      await database.schema.dropTable(table).execute();
    }
  },
};
