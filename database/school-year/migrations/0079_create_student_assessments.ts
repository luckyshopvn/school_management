import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-20 phần 20c (YCTD-161): đánh giá học sinh theo Thông tư 27/2020/TT-BGDĐT. Claude tự chọn theo ủy quyền của Eric ngày
// 2026-10-11:
// - cấu hình theo cấp, không ghi cứng: mức đạt (`assessment_levels`: thang môn học và thang phẩm chất, năng lực; hạng 1 là
//   mức cao nhất, hạng lớn nhất là mức chưa đạt), danh mục phẩm chất, năng lực (`competency_items`), kỳ đánh giá định kỳ
//   (`assessment_periods`: giữa, cuối học kỳ I, II; kỳ cuối năm), môn, khối có bài kiểm tra định kỳ theo kỳ
//   (`assessment_tests`), thư viện câu nhận xét (`comment_templates`). Trường nạp bộ mặc định của Thông tư rồi sửa;
// - kết quả định kỳ theo kỳ, học sinh: môn học, hoạt động (`subject_results`: mức, điểm bài kiểm tra 1 đến 10, nhận xét),
//   phẩm chất, năng lực (`competency_results`); nhận xét thường xuyên theo ngày (`regular_comments`);
// - khoá số liệu theo kỳ và lớp (`assessment_locks`), tổng hợp cuối năm của học sinh (`year_results`: gợi ý của máy theo
//   Điều 9 của Thông tư, kết quả giáo viên chủ nhiệm xác nhận). Học bạ (20e), EMIS (20f) đọc các bảng này
const SCHOOL_LEVELS = `'MN', 'TH', 'THCS', 'THPT'`;
const YEAR_RESULTS = `'excellent', 'good', 'completed', 'not_completed'`;

export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('assessment_levels')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('school_level', 'text', (column) =>
        column.notNull().check(sql.raw(`school_level in (${SCHOOL_LEVELS})`)),
      )
      .addColumn('scale', 'text', (column) => column.notNull())
      .addColumn('code', 'text', (column) => column.notNull().check(sql`char_length(code) between 1 and 10`))
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 100`))
      .addColumn('rank', 'smallint', (column) => column.notNull().check(sql`rank between 1 and 9`))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('assessment_levels_scale_check', sql`scale in ('subject', 'competency')`)
      .addUniqueConstraint('assessment_levels_code_unique', ['school_level', 'scale', 'code'])
      .addUniqueConstraint('assessment_levels_rank_unique', ['school_level', 'scale', 'rank'])
      .execute();

    await database.schema
      .createTable('competency_items')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('school_level', 'text', (column) =>
        column.notNull().check(sql.raw(`school_level in (${SCHOOL_LEVELS})`)),
      )
      .addColumn('group_code', 'text', (column) => column.notNull())
      .addColumn('code', 'text', (column) => column.notNull().check(sql`char_length(code) between 1 and 30`))
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 200`))
      .addColumn('order_no', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('competency_items_group_check', sql`group_code in ('quality', 'general', 'specific')`)
      .addCheckConstraint('competency_items_status_check', sql`status in ('active', 'inactive')`)
      .addUniqueConstraint('competency_items_code_unique', ['school_level', 'code'])
      .execute();

    await database.schema
      .createTable('assessment_periods')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('school_level', 'text', (column) =>
        column.notNull().check(sql.raw(`school_level in (${SCHOOL_LEVELS})`)),
      )
      .addColumn('code', 'text', (column) => column.notNull().check(sql`char_length(code) between 1 and 20`))
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 100`))
      .addColumn('term_type', 'text', (column) => column.notNull())
      .addColumn('kind', 'text', (column) => column.notNull())
      // Kỳ cuối năm: dùng cho tổng hợp cuối năm (hoàn thành chương trình lớp học)
      .addColumn('is_year_end', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('order_no', 'integer', (column) => column.notNull().defaultTo(0))
      // Hạn nhập; trống là theo ngày kết thúc học kỳ của lịch năm học của cấp
      .addColumn('entry_deadline', 'date')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('assessment_periods_term_check', sql`term_type in ('first_term', 'second_term')`)
      .addCheckConstraint('assessment_periods_kind_check', sql`kind in ('mid', 'end')`)
      .addUniqueConstraint('assessment_periods_code_unique', ['school_level', 'code'])
      .execute();

    await database.schema
      .createTable('assessment_tests')
      .addColumn('period_id', 'uuid', (column) =>
        column.notNull().references('assessment_periods.id').onDelete('cascade'),
      )
      .addColumn('subject_id', 'uuid', (column) => column.notNull().references('subjects.id'))
      .addColumn('grade_level_code', 'text', (column) => column.notNull())
      .addPrimaryKeyConstraint('assessment_tests_pkey', ['period_id', 'subject_id', 'grade_level_code'])
      .execute();

    await database.schema
      .createTable('comment_templates')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('school_level', 'text', (column) =>
        column.notNull().check(sql.raw(`school_level in (${SCHOOL_LEVELS})`)),
      )
      .addColumn('target', 'text', (column) => column.notNull())
      .addColumn('content', 'text', (column) => column.notNull().check(sql`char_length(content) between 1 and 500`))
      .addColumn('order_no', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('comment_templates_target_check', sql`target in ('subject', 'competency', 'general')`)
      .addCheckConstraint('comment_templates_status_check', sql`status in ('active', 'inactive')`)
      .execute();

    await database.schema
      .createTable('subject_results')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('period_id', 'uuid', (column) => column.notNull().references('assessment_periods.id'))
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('subject_id', 'uuid', (column) => column.notNull().references('subjects.id'))
      .addColumn('level_code', 'text')
      .addColumn('score', 'smallint', (column) => column.check(sql`score is null or score between 1 and 10`))
      .addColumn('comment', 'text', (column) => column.check(sql`char_length(comment) <= 1000`))
      .addColumn('updated_by', 'uuid', (column) => column.notNull())
      .addColumn('updated_by_name', 'text', (column) => column.notNull())
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('subject_results_unique', ['period_id', 'child_id', 'subject_id'])
      .execute();
    await database.schema
      .createIndex('subject_results_class_index')
      .on('subject_results')
      .columns(['class_id', 'period_id'])
      .execute();

    await database.schema
      .createTable('competency_results')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('period_id', 'uuid', (column) => column.notNull().references('assessment_periods.id'))
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('item_id', 'uuid', (column) => column.notNull().references('competency_items.id'))
      .addColumn('level_code', 'text')
      .addColumn('comment', 'text', (column) => column.check(sql`char_length(comment) <= 1000`))
      .addColumn('updated_by', 'uuid', (column) => column.notNull())
      .addColumn('updated_by_name', 'text', (column) => column.notNull())
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('competency_results_unique', ['period_id', 'child_id', 'item_id'])
      .execute();
    await database.schema
      .createIndex('competency_results_class_index')
      .on('competency_results')
      .columns(['class_id', 'period_id'])
      .execute();

    await database.schema
      .createTable('regular_comments')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('subject_id', 'uuid', (column) => column.references('subjects.id'))
      .addColumn('item_id', 'uuid', (column) => column.references('competency_items.id'))
      .addColumn('comment_date', 'date', (column) => column.notNull())
      .addColumn('content', 'text', (column) => column.notNull().check(sql`char_length(content) between 1 and 1000`))
      .addColumn('author_id', 'uuid', (column) => column.notNull())
      .addColumn('author_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('regular_comments_child_index')
      .on('regular_comments')
      .columns(['child_id', 'comment_date'])
      .execute();

    await database.schema
      .createTable('assessment_locks')
      .addColumn('period_id', 'uuid', (column) => column.notNull().references('assessment_periods.id'))
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('locked_by', 'uuid', (column) => column.notNull())
      .addColumn('locked_by_name', 'text', (column) => column.notNull())
      .addColumn('locked_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addPrimaryKeyConstraint('assessment_locks_pkey', ['period_id', 'class_id'])
      .execute();

    await database.schema
      .createTable('year_results')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('suggested', 'text', (column) =>
        column.check(sql.raw(`suggested is null or suggested in (${YEAR_RESULTS})`)),
      )
      .addColumn('result', 'text', (column) => column.notNull().check(sql.raw(`result in (${YEAR_RESULTS})`)))
      .addColumn('note', 'text', (column) => column.check(sql`char_length(note) <= 1000`))
      .addColumn('confirmed_by', 'uuid', (column) => column.notNull())
      .addColumn('confirmed_by_name', 'text', (column) => column.notNull())
      .addColumn('confirmed_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('year_results_class_child_unique', ['class_id', 'child_id'])
      .execute();
  },
  async down(database) {
    for (const table of [
      'year_results',
      'assessment_locks',
      'regular_comments',
      'competency_results',
      'subject_results',
      'comment_templates',
      'assessment_tests',
      'assessment_periods',
      'competency_items',
      'assessment_levels',
    ]) {
      await database.schema.dropTable(table).execute();
    }
  },
};
