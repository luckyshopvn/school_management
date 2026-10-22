import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-18 phần 22d (YCTD-148): thi đua, khen thưởng cán bộ, giáo viên. Cơ sở dữ liệu năm học nên đợt thi đua tự tách theo năm
// học; năm mới chép danh mục danh hiệu (bước chuyển năm học, giữ mã định danh), khen thưởng năm cũ ở lại và được đọc lại khi
// xét danh hiệu cần nhiều năm liên tục. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - `emulation_titles`: danh mục danh hiệu thi đua và hình thức khen thưởng do trường cấu hình (không ghi cứng): đối tượng
//   cá nhân hoặc tập thể, cấp trường quyết định hay đề nghị cấp trên, mức KPI tối thiểu (mã xếp loại của 18d), cần sáng kiến,
//   danh hiệu tiền đề và số năm liên tục, tỉ lệ tối đa, tỉ lệ phiếu đồng ý tối thiểu, tiêu chí có trọng số; sửa tiêu chí thì
//   tăng số hiệu, hồ sơ đã lập giữ tiêu chí đã chụp lại;
// - `emulation_campaigns`: đợt (phong trào) thi đua, phát động, hạn đăng ký, hạn nộp hồ sơ, kỳ KPI làm đầu vào, số ngày nhận
//   phúc khảo, khiếu nại sau khi công bố kết quả bình xét;
// - `emulation_registrations`: đăng ký thi đua đầu năm của cá nhân, tập thể (tổ chuyên môn);
// - `emulation_nominations`: hồ sơ đề nghị (báo cáo thành tích, tự chấm tiêu chí, kết quả KPI chụp lại, kết quả kiểm tra điều
//   kiện, kết quả bỏ phiếu); `emulation_nomination_evidence`: minh chứng lấy từ kho hồ sơ chuyên môn (18e);
// - `emulation_council_members`, `emulation_meetings`, `emulation_votes`: hội đồng thi đua, phiên họp, phiếu kín của từng
//   thành viên; biên bản PDF lưu ở tệp;
// - `emulation_appeals`: phúc khảo, khiếu nại có hạn;
// - `emulation_decisions`: quyết định khen thưởng của trường hoặc tờ trình đề nghị cấp trên, nối văn bản đi (18b);
// - `emulation_awards`: sổ khen thưởng (từ quyết định hoặc nhập tay khen thưởng các năm trước), mã tra cứu công khai.
// Tệp biên bản, quyết định dùng mục đích tệp 'professional_record' như kế hoạch giáo dục, không thêm mục đích tệp mới
const SCHOOL_LEVELS = `'MN', 'TH', 'THCS', 'THPT'`;
const TARGETS = `'individual', 'collective'`;

export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('emulation_titles')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull().check(sql`char_length(code) between 1 and 50`))
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 200`))
      .addColumn('description', 'text', (column) => column.check(sql`char_length(description) <= 2000`))
      .addColumn('kind', 'text', (column) => column.notNull().check(sql`kind in ('title', 'award')`))
      .addColumn('target', 'text', (column) => column.notNull().check(sql.raw(`target in (${TARGETS})`)))
      .addColumn('decision_level', 'text', (column) =>
        column.notNull().check(sql`decision_level in ('school', 'upper')`),
      )
      .addColumn('school_level', 'text', (column) => column.check(sql.raw(`school_level in (${SCHOOL_LEVELS})`)))
      .addColumn('min_kpi_rank', 'text', (column) => column.check(sql`char_length(min_kpi_rank) <= 50`))
      .addColumn('requires_initiative', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('prerequisite_code', 'text', (column) => column.check(sql`char_length(prerequisite_code) <= 50`))
      .addColumn('consecutive_years', 'integer', (column) =>
        column
          .notNull()
          .defaultTo(0)
          .check(sql`consecutive_years between 0 and 10`),
      )
      .addColumn('quota_percent', 'numeric(5, 2)', (column) =>
        column.check(sql`quota_percent > 0 and quota_percent <= 100`),
      )
      .addColumn('quota_base_code', 'text', (column) => column.check(sql`char_length(quota_base_code) <= 50`))
      .addColumn('vote_threshold_percent', 'numeric(5, 2)', (column) =>
        column
          .notNull()
          .defaultTo(50)
          .check(sql`vote_threshold_percent > 0 and vote_threshold_percent <= 100`),
      )
      .addColumn('criteria', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('min_score', 'numeric(6, 2)', (column) => column.check(sql`min_score >= 0`))
      .addColumn('revision', 'integer', (column) => column.notNull().defaultTo(1))
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
      .addUniqueConstraint('emulation_titles_code_unique', ['code'])
      .addCheckConstraint('emulation_titles_quota_check', sql`(quota_percent is null) = (quota_base_code is null)`)
      .addCheckConstraint(
        'emulation_titles_prerequisite_check',
        sql`(prerequisite_code is null) = (consecutive_years = 0)`,
      )
      .execute();

    await database.schema
      .createTable('emulation_campaigns')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull().check(sql`char_length(code) between 1 and 50`))
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 300`))
      .addColumn('kind', 'text', (column) => column.notNull().check(sql`kind in ('regular', 'thematic')`))
      .addColumn('description', 'text', (column) => column.check(sql`char_length(description) <= 10000`))
      .addColumn('title_ids', sql`uuid[]`, (column) => column.notNull().defaultTo(sql`'{}'::uuid[]`))
      .addColumn('kpi_period_id', 'uuid', (column) => column.references('kpi_periods.id'))
      .addColumn('registration_deadline', 'date')
      .addColumn('nomination_deadline', 'date')
      .addColumn('appeal_days', 'integer', (column) =>
        column
          .notNull()
          .defaultTo(7)
          .check(sql`appeal_days between 1 and 60`),
      )
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('draft')
          .check(sql`status in ('draft', 'launched', 'published', 'closed')`),
      )
      .addColumn('launched_at', 'timestamptz')
      .addColumn('launched_by_name', 'text')
      .addColumn('published_at', 'timestamptz')
      .addColumn('appeal_deadline', 'date')
      .addColumn('closed_at', 'timestamptz')
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('emulation_campaigns_code_unique', ['code'])
      .execute();

    await database.schema
      .createTable('emulation_registrations')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('campaign_id', 'uuid', (column) =>
        column.notNull().references('emulation_campaigns.id').onDelete('cascade'),
      )
      .addColumn('title_id', 'uuid', (column) => column.notNull().references('emulation_titles.id'))
      .addColumn('target', 'text', (column) => column.notNull().check(sql.raw(`target in (${TARGETS})`)))
      .addColumn('staff_id', 'uuid', (column) => column.references('staff.id'))
      .addColumn('department_id', 'uuid', (column) => column.references('departments.id'))
      .addColumn('subject_name', 'text', (column) => column.notNull())
      .addColumn('commitment', 'text', (column) => column.check(sql`char_length(commitment) <= 4000`))
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('pending')
          .check(sql`status in ('pending', 'accepted', 'returned')`),
      )
      .addColumn('review_note', 'text', (column) => column.check(sql`char_length(review_note) <= 2000`))
      .addColumn('registered_by', 'uuid', (column) => column.notNull())
      .addColumn('registered_by_name', 'text', (column) => column.notNull())
      .addColumn('reviewed_by_name', 'text')
      .addColumn('reviewed_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'emulation_registrations_subject_check',
        sql`(target = 'individual' and staff_id is not null and department_id is null)
          or (target = 'collective' and department_id is not null and staff_id is null)`,
      )
      .execute();
    await sql`create unique index emulation_registrations_unique
      on emulation_registrations (campaign_id, title_id, coalesce(staff_id, department_id))`.execute(database);

    await database.schema
      .createTable('emulation_meetings')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('campaign_id', 'uuid', (column) =>
        column.notNull().references('emulation_campaigns.id').onDelete('cascade'),
      )
      .addColumn('held_at', 'timestamptz', (column) => column.notNull())
      .addColumn('location', 'text', (column) => column.check(sql`char_length(location) <= 300`))
      .addColumn('content', 'text', (column) => column.check(sql`char_length(content) <= 4000`))
      .addColumn('conclusion', 'text', (column) => column.check(sql`char_length(conclusion) <= 10000`))
      .addColumn('member_count', 'integer', (column) => column.notNull().check(sql`member_count >= 1`))
      .addColumn('attendee_count', 'integer', (column) => column.check(sql`attendee_count >= 0`))
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('voting')
          .check(sql`status in ('voting', 'closed')`),
      )
      .addColumn('closed_at', 'timestamptz')
      .addColumn('closed_by_name', 'text')
      .addColumn('minutes_file_id', 'uuid', (column) => column.references('files.id'))
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    // Mỗi đợt chỉ một phiên đang bỏ phiếu
    await sql`create unique index emulation_meetings_voting_unique
      on emulation_meetings (campaign_id) where status = 'voting'`.execute(database);

    await database.schema
      .createTable('emulation_decisions')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('campaign_id', 'uuid', (column) => column.notNull().references('emulation_campaigns.id'))
      .addColumn('kind', 'text', (column) => column.notNull().check(sql`kind in ('decision', 'proposal')`))
      .addColumn('title', 'text', (column) => column.notNull().check(sql`char_length(title) between 1 and 500`))
      .addColumn('basis', 'text', (column) => column.check(sql`char_length(basis) <= 4000`))
      .addColumn('signer_name', 'text', (column) => column.check(sql`char_length(signer_name) <= 200`))
      .addColumn('signer_title', 'text', (column) => column.check(sql`char_length(signer_title) <= 200`))
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('draft')
          .check(sql`status in ('draft', 'issued')`),
      )
      .addColumn('number', 'text', (column) => column.check(sql`char_length(number) <= 100`))
      .addColumn('issue_date', 'date')
      // Văn bản đi ở cơ sở dữ liệu hệ thống (18b), không có khóa ngoại giữa hai cơ sở dữ liệu
      .addColumn('outgoing_document_id', 'uuid')
      .addColumn('issued_at', 'timestamptz')
      .addColumn('issued_by_name', 'text')
      // Tờ trình đề nghị cấp trên: kết quả của cấp trên ghi tay
      .addColumn('upper_number', 'text', (column) => column.check(sql`char_length(upper_number) <= 100`))
      .addColumn('upper_date', 'date')
      .addColumn('upper_issuer', 'text', (column) => column.check(sql`char_length(upper_issuer) <= 300`))
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'emulation_decisions_issued_check',
        sql`status = 'draft' or (number is not null and issue_date is not null)`,
      )
      .execute();

    await database.schema
      .createTable('emulation_nominations')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('campaign_id', 'uuid', (column) =>
        column.notNull().references('emulation_campaigns.id').onDelete('cascade'),
      )
      .addColumn('title_id', 'uuid', (column) => column.notNull().references('emulation_titles.id'))
      .addColumn('title_code', 'text', (column) => column.notNull())
      .addColumn('title_name', 'text', (column) => column.notNull())
      .addColumn('title_revision', 'integer', (column) => column.notNull())
      .addColumn('criteria', 'jsonb', (column) => column.notNull())
      .addColumn('vote_threshold_percent', 'numeric(5, 2)', (column) => column.notNull())
      .addColumn('target', 'text', (column) => column.notNull().check(sql.raw(`target in (${TARGETS})`)))
      .addColumn('staff_id', 'uuid', (column) => column.references('staff.id'))
      .addColumn('department_id', 'uuid', (column) => column.references('departments.id'))
      .addColumn('subject_name', 'text', (column) => column.notNull())
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('registration_id', 'uuid', (column) => column.references('emulation_registrations.id'))
      .addColumn('owner_user_id', 'uuid', (column) => column.notNull())
      .addColumn('owner_name', 'text', (column) => column.notNull())
      .addColumn('achievements', 'text', (column) => column.check(sql`char_length(achievements) <= 20000`))
      .addColumn('initiative', 'text', (column) => column.check(sql`char_length(initiative) <= 4000`))
      .addColumn('scores', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn('total_score', 'numeric(7, 2)', (column) => column.notNull().defaultTo(0))
      // Kết quả KPI (18d) chụp lại lúc nộp
      .addColumn('kpi_evaluation_id', 'uuid', (column) => column.references('kpi_evaluations.id'))
      .addColumn('kpi_period_name', 'text')
      .addColumn('kpi_rank', 'text')
      .addColumn('kpi_rank_label', 'text')
      .addColumn('kpi_score', 'numeric(7, 2)')
      .addColumn('eligibility', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('draft')
          .check(
            sql`status in ('draft', 'submitted', 'returned', 'accepted', 'passed', 'failed', 'proposed', 'awarded',
              'not_awarded')`,
          ),
      )
      .addColumn('return_note', 'text', (column) => column.check(sql`char_length(return_note) <= 2000`))
      .addColumn('submitted_at', 'timestamptz')
      .addColumn('accepted_at', 'timestamptz')
      .addColumn('meeting_id', 'uuid', (column) => column.references('emulation_meetings.id'))
      .addColumn('agree_count', 'integer')
      .addColumn('disagree_count', 'integer')
      .addColumn('abstain_count', 'integer')
      .addColumn('agree_percent', 'numeric(5, 2)')
      .addColumn('council_note', 'text', (column) => column.check(sql`char_length(council_note) <= 2000`))
      .addColumn('decision_id', 'uuid', (column) => column.references('emulation_decisions.id').onDelete('set null'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'emulation_nominations_subject_check',
        sql`(target = 'individual' and staff_id is not null and department_id is null)
          or (target = 'collective' and department_id is not null and staff_id is null)`,
      )
      .execute();
    await sql`create unique index emulation_nominations_unique
      on emulation_nominations (campaign_id, title_id, coalesce(staff_id, department_id))`.execute(database);
    await database.schema
      .createIndex('emulation_nominations_status_index')
      .on('emulation_nominations')
      .columns(['campaign_id', 'status'])
      .execute();

    await database.schema
      .createTable('emulation_nomination_evidence')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('nomination_id', 'uuid', (column) =>
        column.notNull().references('emulation_nominations.id').onDelete('cascade'),
      )
      .addColumn('document_id', 'uuid', (column) => column.notNull().references('professional_documents.id'))
      .addColumn('note', 'text', (column) => column.check(sql`char_length(note) <= 500`))
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('emulation_nomination_evidence_unique', ['nomination_id', 'document_id'])
      .execute();

    await database.schema
      .createTable('emulation_council_members')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('campaign_id', 'uuid', (column) =>
        column.notNull().references('emulation_campaigns.id').onDelete('cascade'),
      )
      .addColumn('user_id', 'uuid', (column) => column.notNull())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('position', 'text', (column) =>
        column.notNull().check(sql`position in ('chair', 'vice_chair', 'secretary', 'member')`),
      )
      .addColumn('sort_order', 'integer', (column) => column.notNull().defaultTo(0))
      .addUniqueConstraint('emulation_council_members_unique', ['campaign_id', 'user_id'])
      .execute();

    // Phiếu kín: chỉ thành viên thấy phiếu của mình; kết quả chỉ ghi số phiếu
    await database.schema
      .createTable('emulation_votes')
      .addColumn('meeting_id', 'uuid', (column) =>
        column.notNull().references('emulation_meetings.id').onDelete('cascade'),
      )
      .addColumn('nomination_id', 'uuid', (column) =>
        column.notNull().references('emulation_nominations.id').onDelete('cascade'),
      )
      .addColumn('member_user_id', 'uuid', (column) => column.notNull())
      .addColumn('choice', 'text', (column) => column.notNull().check(sql`choice in ('agree', 'disagree', 'abstain')`))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addPrimaryKeyConstraint('emulation_votes_pkey', ['meeting_id', 'nomination_id', 'member_user_id'])
      .execute();

    await database.schema
      .createTable('emulation_appeals')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('campaign_id', 'uuid', (column) =>
        column.notNull().references('emulation_campaigns.id').onDelete('cascade'),
      )
      .addColumn('nomination_id', 'uuid', (column) => column.references('emulation_nominations.id').onDelete('cascade'))
      .addColumn('kind', 'text', (column) => column.notNull().check(sql`kind in ('review', 'complaint')`))
      .addColumn('content', 'text', (column) => column.notNull().check(sql`char_length(content) between 1 and 4000`))
      .addColumn('submitted_by', 'uuid', (column) => column.notNull())
      .addColumn('submitted_by_name', 'text', (column) => column.notNull())
      .addColumn('deadline', 'date', (column) => column.notNull())
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('pending')
          .check(sql`status in ('pending', 'accepted', 'rejected')`),
      )
      .addColumn('response', 'text', (column) => column.check(sql`char_length(response) <= 4000`))
      .addColumn('resolved_by_name', 'text')
      .addColumn('resolved_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('emulation_appeals_review_check', sql`kind <> 'review' or nomination_id is not null`)
      .execute();

    await database.schema
      .createTable('emulation_awards')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('source', 'text', (column) => column.notNull().check(sql`source in ('decision', 'manual')`))
      .addColumn('decision_id', 'uuid', (column) => column.references('emulation_decisions.id'))
      .addColumn('nomination_id', 'uuid', (column) => column.references('emulation_nominations.id'))
      .addColumn('year_name', 'text', (column) => column.notNull().check(sql`char_length(year_name) between 1 and 50`))
      .addColumn('year_start', 'integer', (column) => column.notNull().check(sql`year_start between 1990 and 2100`))
      .addColumn('title_code', 'text', (column) => column.notNull())
      .addColumn('title_name', 'text', (column) => column.notNull())
      .addColumn('title_kind', 'text', (column) => column.notNull().check(sql`title_kind in ('title', 'award')`))
      .addColumn('target', 'text', (column) => column.notNull().check(sql.raw(`target in (${TARGETS})`)))
      .addColumn('staff_id', 'uuid', (column) => column.references('staff.id'))
      .addColumn('department_id', 'uuid', (column) => column.references('departments.id'))
      .addColumn('subject_name', 'text', (column) => column.notNull())
      .addColumn('decision_number', 'text', (column) => column.check(sql`char_length(decision_number) <= 100`))
      .addColumn('decision_date', 'date')
      .addColumn('issuer', 'text', (column) => column.check(sql`char_length(issuer) <= 300`))
      .addColumn('lookup_code', 'text', (column) => column.notNull())
      .addColumn('note', 'text', (column) => column.check(sql`char_length(note) <= 1000`))
      .addColumn('created_by', 'uuid')
      .addColumn('created_by_name', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('emulation_awards_lookup_unique', ['lookup_code'])
      .addCheckConstraint(
        'emulation_awards_subject_check',
        sql`(target = 'individual' and staff_id is not null and department_id is null)
          or (target = 'collective' and department_id is not null and staff_id is null)`,
      )
      .execute();
    await database.schema
      .createIndex('emulation_awards_subject_index')
      .on('emulation_awards')
      .columns(['title_code', 'year_start'])
      .execute();
  },
  async down(database) {
    for (const table of [
      'emulation_awards',
      'emulation_appeals',
      'emulation_votes',
      'emulation_council_members',
      'emulation_nomination_evidence',
      'emulation_nominations',
      'emulation_decisions',
      'emulation_meetings',
      'emulation_registrations',
      'emulation_campaigns',
      'emulation_titles',
    ]) {
      await database.schema.dropTable(table).execute();
    }
  },
};
