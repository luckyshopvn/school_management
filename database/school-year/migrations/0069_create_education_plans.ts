import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-18 phần 22i (YCTD-147): kế hoạch giáo dục. Cơ sở dữ liệu năm học nên kế hoạch tự tách theo năm học; năm mới chép thư
// viện mẫu (bước chuyển năm học), kế hoạch năm cũ ở lại để sao chép và so sánh. Claude tự chọn theo ủy quyền của Eric ngày
// 2026-10-11:
// - `education_plan_templates`: thư viện mẫu theo cấp học; các mục (văn bản hoặc bảng có cột) lưu dạng JSON để trường tự cấu
//   hình; các bước duyệt chọn trong tổ trưởng, Phó Hiệu trưởng, Hiệu trưởng; có cần kí nội bộ hay không; thư mục của kho hồ sơ
//   chuyên môn (18e) nhận bản đã duyệt;
// - `education_plans`: kế hoạch của trường, tổ chuyên môn hoặc nhóm công tác, nhóm lớp, cá nhân; chụp lại mẫu (mục, bước duyệt)
//   lúc tạo để sửa mẫu không đổi kế hoạch đã lập; bốn trạng thái, bước đang chờ; sao chép từ năm trước giữ bản gốc để so sánh;
// - `education_plan_versions`: mỗi lần trình duyệt chụp lại nội dung thành một phiên bản để so sánh;
// - `education_plan_events`: lịch sử tạo, trình, duyệt từng bước, trả lại, kí, lưu kho, tạo kế hoạch công việc.
// Tệp đã kí và bản lưu kho dùng mục đích tệp 'professional_record' của kho hồ sơ chuyên môn, không thêm mục đích tệp mới
const SCHOOL_LEVELS = `'MN', 'TH', 'THCS', 'THPT'`;
const SCOPES = `'school', 'group', 'class', 'personal'`;
const PERIODS = `'year', 'semester', 'month', 'week', 'none'`;
const STEPS = `'leader', 'vice_principal', 'principal'`;

export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('education_plan_templates')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull().check(sql`char_length(code) between 1 and 50`))
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 200`))
      .addColumn('description', 'text', (column) => column.check(sql`char_length(description) <= 1000`))
      .addColumn('school_level', 'text', (column) => column.check(sql.raw(`school_level in (${SCHOOL_LEVELS})`)))
      .addColumn('scope', 'text', (column) => column.notNull().check(sql.raw(`scope in (${SCOPES})`)))
      .addColumn('period', 'text', (column) => column.notNull().check(sql.raw(`period in (${PERIODS})`)))
      .addColumn('sections', 'jsonb', (column) => column.notNull())
      .addColumn('approval_steps', sql`text[]`, (column) =>
        column.notNull().check(sql.raw(`approval_steps <@ array[${STEPS}]::text[]`)),
      )
      .addColumn('requires_signing', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('archive_folder_id', 'uuid', (column) => column.references('professional_folders.id'))
      // Tăng mỗi lần sửa mục; kế hoạch ghi phiên bản mẫu đã dùng
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
      .addUniqueConstraint('education_plan_templates_code_unique', ['code'])
      .execute();

    await database.schema
      .createTable('education_plans')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('template_id', 'uuid', (column) => column.references('education_plan_templates.id'))
      .addColumn('template_name', 'text', (column) => column.notNull())
      .addColumn('template_revision', 'integer', (column) => column.notNull())
      .addColumn('scope', 'text', (column) => column.notNull().check(sql.raw(`scope in (${SCOPES})`)))
      .addColumn('period', 'text', (column) => column.notNull().check(sql.raw(`period in (${PERIODS})`)))
      .addColumn('school_level', 'text', (column) => column.check(sql.raw(`school_level in (${SCHOOL_LEVELS})`)))
      .addColumn('title', 'text', (column) => column.notNull().check(sql`char_length(title) between 1 and 300`))
      .addColumn('period_label', 'text', (column) => column.check(sql`char_length(period_label) <= 100`))
      .addColumn('period_start', 'date')
      .addColumn('period_end', 'date')
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('department_id', 'uuid', (column) => column.references('departments.id'))
      .addColumn('work_group_id', 'uuid', (column) => column.references('professional_work_groups.id'))
      .addColumn('class_id', 'uuid', (column) => column.references('classes.id'))
      .addColumn('owner_user_id', 'uuid', (column) => column.notNull())
      .addColumn('owner_staff_id', 'uuid', (column) => column.references('staff.id'))
      .addColumn('owner_name', 'text', (column) => column.notNull())
      .addColumn('sections', 'jsonb', (column) => column.notNull())
      .addColumn('content', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn('approval_steps', sql`text[]`, (column) =>
        column.notNull().check(sql.raw(`approval_steps <@ array[${STEPS}]::text[]`)),
      )
      .addColumn('requires_signing', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('draft')
          .check(sql`status in ('draft', 'pending', 'approved', 'returned')`),
      )
      // Các bước còn phải duyệt của lần trình đang chờ, bước đầu là bước đang chờ
      .addColumn('remaining_steps', sql`text[]`, (column) => column.notNull().defaultTo(sql`'{}'::text[]`))
      .addColumn('current_step', 'text', (column) => column.check(sql.raw(`current_step in (${STEPS})`)))
      .addColumn('version_no', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('submitted_at', 'timestamptz')
      .addColumn('approved_at', 'timestamptz')
      .addColumn('approved_by', 'uuid')
      .addColumn('approved_by_name', 'text')
      .addColumn('return_note', 'text', (column) => column.check(sql`char_length(return_note) <= 2000`))
      .addColumn('signed_at', 'timestamptz')
      .addColumn('signature_method', 'text')
      .addColumn('signed_file_id', 'uuid', (column) => column.references('files.id'))
      // Sao chép từ năm trước: kế hoạch nguồn, tên năm học nguồn, mục và nội dung gốc để so sánh
      .addColumn('source_plan_id', 'uuid')
      .addColumn('source_year_name', 'text')
      .addColumn('source_sections', 'jsonb')
      .addColumn('source_content', 'jsonb')
      .addColumn('archived_document_id', 'uuid', (column) => column.references('professional_documents.id'))
      .addColumn('work_plan_id', 'uuid', (column) => column.references('plans.id'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'education_plans_owner_check',
        sql`(scope <> 'group' or department_id is not null or work_group_id is not null)
          and (scope <> 'class' or class_id is not null)`,
      )
      .addCheckConstraint(
        'education_plans_step_check',
        sql`(status = 'pending') = (current_step is not null)`,
      )
      .execute();
    await database.schema
      .createIndex('education_plans_status_index')
      .on('education_plans')
      .columns(['status', 'current_step'])
      .execute();
    await database.schema
      .createIndex('education_plans_owner_index')
      .on('education_plans')
      .column('owner_user_id')
      .execute();
    await database.schema
      .createIndex('education_plans_department_index')
      .on('education_plans')
      .column('department_id')
      .execute();

    await database.schema
      .createTable('education_plan_versions')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('plan_id', 'uuid', (column) => column.notNull().references('education_plans.id').onDelete('cascade'))
      .addColumn('version_no', 'integer', (column) => column.notNull().check(sql`version_no >= 1`))
      .addColumn('title', 'text', (column) => column.notNull())
      .addColumn('sections', 'jsonb', (column) => column.notNull())
      .addColumn('content', 'jsonb', (column) => column.notNull())
      .addColumn('note', 'text', (column) => column.check(sql`char_length(note) <= 2000`))
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('education_plan_versions_number_unique', ['plan_id', 'version_no'])
      .execute();

    await database.schema
      .createTable('education_plan_events')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('plan_id', 'uuid', (column) => column.notNull().references('education_plans.id').onDelete('cascade'))
      .addColumn('action', 'text', (column) =>
        column
          .notNull()
          .check(
            sql`action in ('create', 'copy', 'submit', 'withdraw', 'approve', 'return', 'sign', 'archive', 'work_plan')`,
          ),
      )
      .addColumn('step', 'text', (column) => column.check(sql.raw(`step in (${STEPS})`)))
      .addColumn('note', 'text', (column) => column.check(sql`char_length(note) <= 2000`))
      .addColumn('actor_id', 'uuid', (column) => column.notNull())
      .addColumn('actor_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('education_plan_events_plan_index')
      .on('education_plan_events')
      .columns(['plan_id', 'created_at'])
      .execute();
  },
  async down(database) {
    for (const table of [
      'education_plan_events',
      'education_plan_versions',
      'education_plans',
      'education_plan_templates',
    ]) {
      await database.schema.dropTable(table).execute();
    }
  },
};
