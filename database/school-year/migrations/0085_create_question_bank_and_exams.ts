import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-21 phần 22g1 (YCTD-168): kiểm tra, đánh giá phần đề. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - `question_topics`: chủ đề theo môn và khối (theo chương trình), dùng cho câu hỏi và dòng ma trận;
// - `questions`: ngân hàng câu hỏi là nguồn duy nhất (kho học liệu 22h2 tham chiếu, không chép): môn, khối, chủ đề, mức nhận
//   thức, dạng, nội dung (chữ và công thức dạng chữ), lựa chọn và đáp án, thang điểm, trạng thái nháp, chờ thẩm định, dùng
//   được, ngừng dùng; người soạn, người duyệt; lần dùng gần nhất;
// - `question_usages`: lịch sử dùng của từng câu theo đề (khi khoá đề); 22g2 ghi thêm kết quả chấm vào đây;
// - `exam_matrices`: ma trận đề kèm bảng đặc tả (các dòng chủ đề × mức × dạng, số câu, điểm, yêu cầu cần đạt), tổng điểm, tỉ lệ
//   mức nhận thức mẫu, sai số;
// - `assessment_plans`: kế hoạch kiểm tra theo học kỳ, khối, môn (thường xuyên, giữa kỳ, cuối kỳ), duyệt;
// - `exams`, `exam_questions`, `exam_variants`: đề được giao (người ra đề, người thẩm định, hạn nộp), câu của đề kèm bản chụp
//   nội dung lúc đưa vào đề (sửa câu ở ngân hàng không đổi đề), các mã đề đã trộn kèm đáp án; khoá đề.
export const migration: Migration = {
  async up(database) {
    const level = (column: string) => sql.raw(`${column} in ('MN', 'TH', 'THCS', 'THPT')`);
    await database.schema
      .createTable('question_topics')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('subject_id', 'uuid', (column) => column.notNull().references('subjects.id').onDelete('cascade'))
      .addColumn('grade_level_code', 'text')
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 300`))
      .addColumn('order_no', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('question_topics_status_check', sql`status in ('active', 'inactive')`)
      .execute();

    await database.schema
      .createTable('questions')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('school_level', 'text', (column) => column.notNull().check(level('school_level')))
      .addColumn('subject_id', 'uuid', (column) => column.notNull().references('subjects.id'))
      .addColumn('grade_level_code', 'text', (column) => column.notNull())
      .addColumn('topic_id', 'uuid', (column) => column.references('question_topics.id').onDelete('set null'))
      .addColumn('cognitive_level', 'text', (column) => column.notNull())
      .addColumn('question_type', 'text', (column) => column.notNull())
      .addColumn('content', 'text', (column) => column.notNull().check(sql`char_length(content) between 1 and 10000`))
      .addColumn('options', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('answer', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('guidance', 'text', (column) => column.check(sql`char_length(guidance) <= 10000`))
      .addColumn('score', 'numeric', (column) => column.notNull().defaultTo(1))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('draft'))
      .addColumn('review_note', 'text')
      .addColumn('author_user_id', 'uuid', (column) => column.notNull())
      .addColumn('author_name', 'text', (column) => column.notNull())
      .addColumn('reviewed_by', 'uuid')
      .addColumn('reviewed_by_name', 'text')
      .addColumn('reviewed_at', 'timestamptz')
      .addColumn('last_used_at', 'date')
      .addColumn('use_count', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'questions_level_check',
        sql`cognitive_level in ('recognition', 'comprehension', 'application', 'high_application')`,
      )
      .addCheckConstraint(
        'questions_type_check',
        sql`question_type in ('multiple_choice', 'true_false', 'short_answer', 'essay')`,
      )
      .addCheckConstraint('questions_status_check', sql`status in ('draft', 'review', 'approved', 'retired')`)
      .addCheckConstraint('questions_score_check', sql`score > 0 and score <= 10`)
      .execute();
    await database.schema
      .createIndex('questions_lookup_index')
      .on('questions')
      .columns(['subject_id', 'grade_level_code', 'status'])
      .execute();

    await database.schema
      .createTable('exam_matrices')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('school_level', 'text', (column) => column.notNull().check(level('school_level')))
      .addColumn('subject_id', 'uuid', (column) => column.notNull().references('subjects.id'))
      .addColumn('grade_level_code', 'text', (column) => column.notNull())
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 300`))
      .addColumn('total_score', 'numeric', (column) => column.notNull().defaultTo(10))
      .addColumn('target_ratios', 'jsonb', (column) => column.notNull())
      .addColumn('tolerance', 'numeric', (column) => column.notNull().defaultTo(5))
      .addColumn('rows', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_by', 'uuid')
      .addColumn('created_by_name', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('exam_matrices_status_check', sql`status in ('active', 'inactive')`)
      .execute();

    await database.schema
      .createTable('assessment_plans')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('school_level', 'text', (column) => column.notNull().check(level('school_level')))
      .addColumn('term', 'text', (column) => column.notNull().check(sql`term in ('HK1', 'HK2')`))
      .addColumn('grade_level_code', 'text', (column) => column.notNull())
      .addColumn('subject_id', 'uuid', (column) => column.notNull().references('subjects.id'))
      .addColumn('kind', 'text', (column) => column.notNull().check(sql`kind in ('regular', 'midterm', 'final')`))
      .addColumn('form', 'text', (column) =>
        column.notNull().check(sql`form in ('written', 'multiple_choice', 'mixed', 'practical', 'oral')`),
      )
      .addColumn('duration_minutes', 'integer', (column) =>
        column.notNull().check(sql`duration_minutes between 5 and 300`),
      )
      .addColumn('planned_date', 'date')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('draft'))
      .addColumn('note', 'text', (column) => column.check(sql`char_length(note) <= 1000`))
      .addColumn('review_note', 'text')
      .addColumn('reviewed_by_name', 'text')
      .addColumn('reviewed_at', 'timestamptz')
      .addColumn('created_by', 'uuid')
      .addColumn('created_by_name', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'assessment_plans_status_check',
        sql`status in ('draft', 'submitted', 'approved', 'rejected')`,
      )
      .execute();

    await database.schema
      .createTable('exams')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('plan_id', 'uuid', (column) => column.references('assessment_plans.id').onDelete('set null'))
      .addColumn('matrix_id', 'uuid', (column) => column.references('exam_matrices.id').onDelete('set null'))
      .addColumn('school_level', 'text', (column) => column.notNull().check(level('school_level')))
      .addColumn('subject_id', 'uuid', (column) => column.notNull().references('subjects.id'))
      .addColumn('grade_level_code', 'text', (column) => column.notNull())
      .addColumn('title', 'text', (column) => column.notNull().check(sql`char_length(title) between 1 and 300`))
      .addColumn('duration_minutes', 'integer', (column) => column.notNull().defaultTo(45))
      .addColumn('variant_count', 'smallint', (column) =>
        column
          .notNull()
          .defaultTo(4)
          .check(sql`variant_count between 1 and 24`),
      )
      .addColumn('avoid_recent_days', 'integer', (column) =>
        column
          .notNull()
          .defaultTo(0)
          .check(sql`avoid_recent_days between 0 and 3650`),
      )
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('draft'))
      .addColumn('author_user_id', 'uuid', (column) => column.notNull())
      .addColumn('author_name', 'text', (column) => column.notNull())
      .addColumn('reviewer_user_id', 'uuid')
      .addColumn('reviewer_name', 'text')
      .addColumn('due_date', 'date')
      .addColumn('review_note', 'text')
      .addColumn('submitted_at', 'timestamptz')
      .addColumn('reviewed_at', 'timestamptz')
      .addColumn('locked_at', 'timestamptz')
      .addColumn('locked_by_name', 'text')
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('exams_status_check', sql`status in ('draft', 'submitted', 'approved', 'locked')`)
      .execute();

    await database.schema
      .createTable('exam_questions')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('exam_id', 'uuid', (column) => column.notNull().references('exams.id').onDelete('cascade'))
      .addColumn('question_id', 'uuid', (column) => column.notNull().references('questions.id'))
      .addColumn('order_no', 'integer', (column) => column.notNull())
      .addColumn('score', 'numeric', (column) => column.notNull())
      .addColumn('snapshot', 'jsonb', (column) => column.notNull())
      .addUniqueConstraint('exam_questions_unique', ['exam_id', 'question_id'])
      .execute();

    await database.schema
      .createTable('exam_variants')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('exam_id', 'uuid', (column) => column.notNull().references('exams.id').onDelete('cascade'))
      .addColumn('code', 'text', (column) => column.notNull())
      .addColumn('items', 'jsonb', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('exam_variants_unique', ['exam_id', 'code'])
      .execute();

    await database.schema
      .createTable('question_usages')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('question_id', 'uuid', (column) => column.notNull().references('questions.id').onDelete('cascade'))
      .addColumn('exam_id', 'uuid', (column) => column.notNull().references('exams.id').onDelete('cascade'))
      .addColumn('used_on', 'date', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('question_usages_unique', ['question_id', 'exam_id'])
      .execute();
  },
  async down(database) {
    for (const table of [
      'question_usages',
      'exam_variants',
      'exam_questions',
      'exams',
      'assessment_plans',
      'exam_matrices',
      'questions',
      'question_topics',
    ]) {
      await database.schema.dropTable(table).execute();
    }
  },
};
