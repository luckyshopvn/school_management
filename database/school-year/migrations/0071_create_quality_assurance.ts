import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-18 phần 22f (YCTD-149): bảo đảm chất lượng, tự đánh giá. Cơ sở dữ liệu năm học nên đợt tự đánh giá, phiếu, minh chứng
// tự tách theo năm học; năm mới chép bộ tiêu chuẩn giữ mã định danh (bước chuyển năm học) để minh chứng năm trước kế thừa
// đúng tiêu chí. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - `quality_frameworks`, `quality_standards`, `quality_criteria`, `quality_indicators`: bộ tiêu chuẩn cấu hình được theo
//   cấp học (tiêu chuẩn, tiêu chí, chỉ báo theo mức đạt, gợi ý minh chứng);
// - `quality_assessments`: đợt tự đánh giá của một bộ tiêu chuẩn: quyết định thành lập hội đồng, thời gian, ba trạng thái,
//   phần đặt vấn đề và kết luận của báo cáo, mức tự đánh giá của trường, kết quả công nhận (nối mục 1.7), kế hoạch công
//   việc của kế hoạch cải tiến;
// - `quality_council_members`, `quality_work_groups`, `quality_work_group_members`: hội đồng tự đánh giá và nhóm công tác;
// - `quality_criterion_reports`: phiếu đánh giá tiêu chí (hiện trạng, điểm mạnh, điểm yếu, kế hoạch cải tiến, kết quả chỉ báo,
//   mức tự đánh giá), một phiếu mỗi tiêu chí của đợt, nhóm công tác được phân công;
// - `quality_evidences`, `quality_evidence_criteria`: minh chứng có mã theo hộp và tiêu chí, bốn trạng thái, nguồn là tệp tải
//   lên, hồ sơ của kho hồ sơ chuyên môn (18e), văn bản đến (18a) hoặc văn bản đi (18b) ở cơ sở dữ liệu hệ thống; dùng chung cho
//   nhiều tiêu chí; kế thừa từ năm trước giữ mã cũ.
// Tệp tải lên dùng mục đích tệp 'professional_record' của kho hồ sơ chuyên môn, không thêm mục đích tệp mới
const SCHOOL_LEVELS = `'MN', 'TH', 'THCS', 'THPT'`;

export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('quality_frameworks')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull().check(sql`char_length(code) between 1 and 50`))
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 300`))
      .addColumn('school_level', 'text', (column) => column.check(sql.raw(`school_level in (${SCHOOL_LEVELS})`)))
      .addColumn('legal_basis', 'text', (column) => column.check(sql`char_length(legal_basis) <= 1000`))
      .addColumn('max_level', 'integer', (column) =>
        column
          .notNull()
          .defaultTo(3)
          .check(sql`max_level between 1 and 4`),
      )
      .addColumn('sort_order', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('active')
          .check(sql`status in ('active', 'inactive')`),
      )
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('quality_frameworks_code_unique', ['code'])
      .execute();

    await database.schema
      .createTable('quality_standards')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('framework_id', 'uuid', (column) =>
        column.notNull().references('quality_frameworks.id').onDelete('cascade'),
      )
      .addColumn('code', 'text', (column) => column.notNull().check(sql`char_length(code) between 1 and 20`))
      .addColumn('title', 'text', (column) => column.notNull().check(sql`char_length(title) between 1 and 500`))
      .addColumn('sort_order', 'integer', (column) => column.notNull().defaultTo(0))
      .addUniqueConstraint('quality_standards_code_unique', ['framework_id', 'code'])
      .execute();

    await database.schema
      .createTable('quality_criteria')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('framework_id', 'uuid', (column) =>
        column.notNull().references('quality_frameworks.id').onDelete('cascade'),
      )
      .addColumn('standard_id', 'uuid', (column) =>
        column.notNull().references('quality_standards.id').onDelete('cascade'),
      )
      .addColumn('code', 'text', (column) => column.notNull().check(sql`char_length(code) between 1 and 20`))
      .addColumn('title', 'text', (column) => column.notNull().check(sql`char_length(title) between 1 and 500`))
      .addColumn('evidence_hint', 'text', (column) => column.check(sql`char_length(evidence_hint) <= 2000`))
      .addColumn('sort_order', 'integer', (column) => column.notNull().defaultTo(0))
      .addUniqueConstraint('quality_criteria_code_unique', ['framework_id', 'code'])
      .execute();

    await database.schema
      .createTable('quality_indicators')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('criterion_id', 'uuid', (column) =>
        column.notNull().references('quality_criteria.id').onDelete('cascade'),
      )
      .addColumn('level', 'integer', (column) => column.notNull().check(sql`level between 1 and 4`))
      .addColumn('code', 'text', (column) => column.notNull().check(sql`char_length(code) between 1 and 10`))
      .addColumn('content', 'text', (column) => column.notNull().check(sql`char_length(content) between 1 and 2000`))
      .addColumn('sort_order', 'integer', (column) => column.notNull().defaultTo(0))
      .addUniqueConstraint('quality_indicators_code_unique', ['criterion_id', 'level', 'code'])
      .execute();

    await database.schema
      .createTable('quality_assessments')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('framework_id', 'uuid', (column) => column.notNull().references('quality_frameworks.id'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('title', 'text', (column) => column.notNull().check(sql`char_length(title) between 1 and 300`))
      .addColumn('decision_number', 'text', (column) => column.check(sql`char_length(decision_number) <= 100`))
      .addColumn('decision_date', 'date')
      .addColumn('start_date', 'date')
      .addColumn('end_date', 'date')
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('draft')
          .check(sql`status in ('draft', 'in_progress', 'completed')`),
      )
      .addColumn('introduction', 'text', (column) => column.check(sql`char_length(introduction) <= 20000`))
      .addColumn('conclusion', 'text', (column) => column.check(sql`char_length(conclusion) <= 20000`))
      .addColumn('self_level', 'integer', (column) => column.check(sql`self_level between 0 and 4`))
      .addColumn('completed_at', 'timestamptz')
      .addColumn('completed_by_name', 'text')
      // Kết quả đánh giá ngoài và công nhận (bản chạy nội bộ: nhập tay theo quyết định)
      .addColumn('external_level', 'integer', (column) => column.check(sql`external_level between 0 and 4`))
      .addColumn('recognition_decision', 'text', (column) => column.check(sql`char_length(recognition_decision) <= 200`))
      .addColumn('recognition_date', 'date')
      .addColumn('recognition_valid_until', 'date')
      .addColumn('work_plan_id', 'uuid', (column) => column.references('plans.id'))
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'quality_assessments_dates_check',
        sql`start_date is null or end_date is null or start_date <= end_date`,
      )
      .execute();

    await database.schema
      .createTable('quality_council_members')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('assessment_id', 'uuid', (column) =>
        column.notNull().references('quality_assessments.id').onDelete('cascade'),
      )
      .addColumn('staff_id', 'uuid', (column) => column.notNull().references('staff.id'))
      .addColumn('staff_name', 'text', (column) => column.notNull())
      .addColumn('position', 'text', (column) =>
        column.notNull().check(sql`position in ('chair', 'vice_chair', 'secretary', 'member')`),
      )
      .addColumn('duty', 'text', (column) => column.check(sql`char_length(duty) <= 500`))
      .addColumn('sort_order', 'integer', (column) => column.notNull().defaultTo(0))
      .addUniqueConstraint('quality_council_members_unique', ['assessment_id', 'staff_id'])
      .execute();

    await database.schema
      .createTable('quality_work_groups')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('assessment_id', 'uuid', (column) =>
        column.notNull().references('quality_assessments.id').onDelete('cascade'),
      )
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 200`))
      .addColumn('leader_staff_id', 'uuid', (column) => column.references('staff.id'))
      .addColumn('sort_order', 'integer', (column) => column.notNull().defaultTo(0))
      .execute();

    await database.schema
      .createTable('quality_work_group_members')
      .addColumn('group_id', 'uuid', (column) =>
        column.notNull().references('quality_work_groups.id').onDelete('cascade'),
      )
      .addColumn('staff_id', 'uuid', (column) => column.notNull().references('staff.id'))
      .addColumn('staff_name', 'text', (column) => column.notNull())
      .addPrimaryKeyConstraint('quality_work_group_members_pkey', ['group_id', 'staff_id'])
      .execute();

    await database.schema
      .createTable('quality_criterion_reports')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('assessment_id', 'uuid', (column) =>
        column.notNull().references('quality_assessments.id').onDelete('cascade'),
      )
      .addColumn('criterion_id', 'uuid', (column) => column.notNull().references('quality_criteria.id'))
      .addColumn('work_group_id', 'uuid', (column) => column.references('quality_work_groups.id').onDelete('set null'))
      .addColumn('current_state', 'text', (column) => column.check(sql`char_length(current_state) <= 20000`))
      .addColumn('strengths', 'text', (column) => column.check(sql`char_length(strengths) <= 20000`))
      .addColumn('weaknesses', 'text', (column) => column.check(sql`char_length(weaknesses) <= 20000`))
      .addColumn('improvement_actions', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('indicator_results', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn('self_level', 'integer', (column) => column.check(sql`self_level between 0 and 4`))
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('draft')
          .check(sql`status in ('draft', 'submitted', 'approved', 'returned')`),
      )
      .addColumn('submitted_at', 'timestamptz')
      .addColumn('submitted_by_name', 'text')
      .addColumn('reviewed_at', 'timestamptz')
      .addColumn('reviewed_by_name', 'text')
      .addColumn('return_note', 'text', (column) => column.check(sql`char_length(return_note) <= 2000`))
      .addColumn('updated_by_name', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('quality_criterion_reports_unique', ['assessment_id', 'criterion_id'])
      .execute();

    await database.schema
      .createTable('quality_evidences')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('assessment_id', 'uuid', (column) =>
        column.notNull().references('quality_assessments.id').onDelete('cascade'),
      )
      .addColumn('criterion_id', 'uuid', (column) => column.notNull().references('quality_criteria.id'))
      .addColumn('box', 'integer', (column) => column.notNull().check(sql`box between 1 and 99`))
      .addColumn('sequence', 'integer', (column) => column.notNull().check(sql`sequence between 1 and 999`))
      .addColumn('code', 'text', (column) => column.notNull())
      .addColumn('title', 'text', (column) => column.notNull().check(sql`char_length(title) between 1 and 500`))
      .addColumn('document_number', 'text', (column) => column.check(sql`char_length(document_number) <= 100`))
      .addColumn('issued_date', 'date')
      .addColumn('issuer', 'text', (column) => column.check(sql`char_length(issuer) <= 300`))
      .addColumn('description', 'text', (column) => column.check(sql`char_length(description) <= 2000`))
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('missing')
          .check(sql`status in ('missing', 'collecting', 'sufficient', 'needs_update')`),
      )
      .addColumn('source_type', 'text', (column) =>
        column
          .notNull()
          .defaultTo('none')
          .check(
            sql`source_type in ('upload', 'professional_document', 'incoming_document', 'outgoing_document', 'none')`,
          ),
      )
      .addColumn('file_id', 'uuid', (column) => column.references('files.id'))
      .addColumn('professional_document_id', 'uuid', (column) =>
        column.references('professional_documents.id').onDelete('set null'),
      )
      // Văn bản đến, đi ở cơ sở dữ liệu hệ thống nên không có khóa ngoại
      .addColumn('system_document_id', 'uuid')
      .addColumn('source_label', 'text', (column) => column.check(sql`char_length(source_label) <= 500`))
      .addColumn('inherited_code', 'text')
      .addColumn('inherited_year_name', 'text')
      .addColumn('created_by', 'uuid')
      .addColumn('created_by_name', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('quality_evidences_code_unique', ['assessment_id', 'code'])
      .addCheckConstraint(
        'quality_evidences_source_check',
        sql`(source_type <> 'upload' or file_id is not null)
          and (source_type not in ('incoming_document', 'outgoing_document') or system_document_id is not null)`,
      )
      .execute();
    await database.schema
      .createIndex('quality_evidences_criterion_index')
      .on('quality_evidences')
      .columns(['assessment_id', 'criterion_id'])
      .execute();

    await database.schema
      .createTable('quality_evidence_criteria')
      .addColumn('evidence_id', 'uuid', (column) =>
        column.notNull().references('quality_evidences.id').onDelete('cascade'),
      )
      .addColumn('criterion_id', 'uuid', (column) =>
        column.notNull().references('quality_criteria.id').onDelete('cascade'),
      )
      .addPrimaryKeyConstraint('quality_evidence_criteria_pkey', ['evidence_id', 'criterion_id'])
      .execute();
  },
  async down(database) {
    for (const table of [
      'quality_evidence_criteria',
      'quality_evidences',
      'quality_criterion_reports',
      'quality_work_group_members',
      'quality_work_groups',
      'quality_council_members',
      'quality_assessments',
      'quality_indicators',
      'quality_criteria',
      'quality_standards',
      'quality_frameworks',
    ]) {
      await database.schema.dropTable(table).execute();
    }
  },
};
