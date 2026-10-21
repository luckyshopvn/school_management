import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-18 phần 18e (YCTD-142): hồ sơ chuyên môn theo mô tả công khai của GIKIDI Nhà Trường (tài liệu 32 mục 9.4). Cơ sở dữ
// liệu năm học nên kho tự tách theo năm học. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - `professional_folders`: cây thư mục ba nhánh (cá nhân, tổ hoặc nhóm, trường); mỗi thư mục có luồng duyệt riêng (không
//   duyệt, tổ trưởng duyệt, tổ trưởng rồi Ban Giám hiệu duyệt) và có cần kí nội bộ hay không; cột cấp học để nạp danh mục
//   mặc định theo cấp;
// - `professional_work_groups`, `professional_work_group_members`: nhóm công tác ngoài tổ chuyên môn (phòng ban), có trưởng
//   nhóm duyệt thay tổ trưởng;
// - `professional_rounds`: đợt nộp có hạn trên một thư mục, nộp theo cá nhân hoặc theo tổ, nhóm; đối tượng là toàn trường
//   hoặc danh sách tổ;
// - `professional_documents`: hồ sơ của một người, một tổ hoặc nhóm, hoặc của trường; trạng thái theo luồng duyệt; nộp sau
//   hạn của đợt thì ghi nộp trễ;
// - `professional_document_versions`: mỗi lần tải tệp là một phiên bản, nộp lại sau khi bị trả lại giữ phiên bản cũ;
// - `professional_document_events`: lịch sử nộp, duyệt, trả lại, kí;
// - `professional_record_settings`: một dòng, khóa năm học (khóa thì không thêm, sửa, nộp, duyệt được nữa).
const PREVIOUS_PURPOSES = `'birth_certificate', 'photo_consent', 'import', 'pickup_photo', 'payment_voucher', 'medicine_photo', 'prescription', 'activity_photo', 'content_file', 'candidate_cv', 'final_year_document', 'admission_document', 'kpi_evidence'`;
const SCHOOL_LEVELS = `'MN', 'TH', 'THCS', 'THPT'`;

export const migration: Migration = {
  async up(database) {
    await sql`alter table files drop constraint files_purpose_check`.execute(database);
    await sql`alter table files add constraint files_purpose_check
      check (purpose in (${sql.raw(PREVIOUS_PURPOSES)}, 'professional_record'))`.execute(database);

    await database.schema
      .createTable('professional_folders')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('parent_id', 'uuid', (column) => column.references('professional_folders.id'))
      .addColumn('branch', 'text', (column) => column.notNull().check(sql`branch in ('personal', 'group', 'school')`))
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 200`))
      .addColumn('description', 'text', (column) => column.check(sql`char_length(description) <= 1000`))
      .addColumn('school_level', 'text', (column) => column.check(sql.raw(`school_level in (${SCHOOL_LEVELS})`)))
      .addColumn('approval_flow', 'text', (column) =>
        column
          .notNull()
          .defaultTo('two_level')
          .check(sql`approval_flow in ('none', 'leader', 'two_level')`),
      )
      .addColumn('requires_signing', 'boolean', (column) => column.notNull().defaultTo(false))
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
      .execute();
    await database.schema
      .createIndex('professional_folders_parent_index')
      .on('professional_folders')
      .columns(['parent_id', 'sort_order'])
      .execute();

    await database.schema
      .createTable('professional_work_groups')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 200`))
      .addColumn('description', 'text', (column) => column.check(sql`char_length(description) <= 1000`))
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('active')
          .check(sql`status in ('active', 'inactive')`),
      )
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createTable('professional_work_group_members')
      .addColumn('group_id', 'uuid', (column) =>
        column.notNull().references('professional_work_groups.id').onDelete('cascade'),
      )
      .addColumn('staff_id', 'uuid', (column) => column.notNull().references('staff.id'))
      .addColumn('is_leader', 'boolean', (column) => column.notNull().defaultTo(false))
      .addPrimaryKeyConstraint('professional_work_group_members_pkey', ['group_id', 'staff_id'])
      .execute();

    await database.schema
      .createTable('professional_rounds')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('folder_id', 'uuid', (column) => column.notNull().references('professional_folders.id'))
      .addColumn('title', 'text', (column) => column.notNull().check(sql`char_length(title) between 1 and 300`))
      .addColumn('description', 'text', (column) => column.check(sql`char_length(description) <= 2000`))
      // Nộp theo cá nhân (mỗi người một hồ sơ) hoặc theo tổ, nhóm (mỗi tổ, nhóm một hồ sơ)
      .addColumn('submitter_kind', 'text', (column) =>
        column.notNull().check(sql`submitter_kind in ('staff', 'group')`),
      )
      // Trống là toàn trường
      .addColumn('org_unit_id', 'uuid', (column) => column.references('org_units.id'))
      .addColumn('department_ids', sql`uuid[]`)
      .addColumn('opens_on', 'date', (column) => column.notNull())
      .addColumn('due_at', 'timestamptz', (column) => column.notNull())
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('open')
          .check(sql`status in ('open', 'closed')`),
      )
      .addColumn('reminded_at', 'timestamptz')
      .addColumn('created_by', 'uuid')
      .addColumn('created_by_name', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createTable('professional_documents')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('folder_id', 'uuid', (column) => column.notNull().references('professional_folders.id'))
      .addColumn('round_id', 'uuid', (column) => column.references('professional_rounds.id'))
      .addColumn('branch', 'text', (column) => column.notNull().check(sql`branch in ('personal', 'group', 'school')`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('owner_user_id', 'uuid', (column) => column.notNull())
      .addColumn('owner_staff_id', 'uuid', (column) => column.references('staff.id'))
      .addColumn('owner_name', 'text', (column) => column.notNull())
      .addColumn('department_id', 'uuid', (column) => column.references('departments.id'))
      .addColumn('work_group_id', 'uuid', (column) => column.references('professional_work_groups.id'))
      .addColumn('title', 'text', (column) => column.notNull().check(sql`char_length(title) between 1 and 300`))
      .addColumn('description', 'text', (column) => column.check(sql`char_length(description) <= 2000`))
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('draft')
          .check(sql`status in ('draft', 'pending_leader', 'pending_approval', 'approved', 'returned')`),
      )
      .addColumn('approval_flow', 'text', (column) =>
        column.notNull().check(sql`approval_flow in ('none', 'leader', 'two_level')`),
      )
      .addColumn('requires_signing', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('current_version', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('submitted_at', 'timestamptz')
      .addColumn('submitted_late', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('leader_user_id', 'uuid')
      .addColumn('leader_name', 'text')
      .addColumn('leader_reviewed_at', 'timestamptz')
      .addColumn('approved_by', 'uuid')
      .addColumn('approved_by_name', 'text')
      .addColumn('approved_at', 'timestamptz')
      .addColumn('return_note', 'text', (column) => column.check(sql`char_length(return_note) <= 2000`))
      .addColumn('signed_at', 'timestamptz')
      .addColumn('signature_method', 'text')
      .addColumn('signed_file_id', 'uuid', (column) => column.references('files.id'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'professional_documents_owner_check',
        sql`(branch <> 'group' or department_id is not null or work_group_id is not null)`,
      )
      .execute();
    await database.schema
      .createIndex('professional_documents_folder_index')
      .on('professional_documents')
      .columns(['folder_id', 'status'])
      .execute();
    await database.schema
      .createIndex('professional_documents_round_index')
      .on('professional_documents')
      .column('round_id')
      .execute();
    await database.schema
      .createIndex('professional_documents_owner_index')
      .on('professional_documents')
      .column('owner_user_id')
      .execute();

    await database.schema
      .createTable('professional_document_versions')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('document_id', 'uuid', (column) =>
        column.notNull().references('professional_documents.id').onDelete('cascade'),
      )
      .addColumn('version_no', 'integer', (column) => column.notNull().check(sql`version_no >= 1`))
      .addColumn('file_id', 'uuid', (column) => column.notNull().references('files.id'))
      .addColumn('sha256', 'text', (column) => column.notNull())
      .addColumn('note', 'text', (column) => column.check(sql`char_length(note) <= 1000`))
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('professional_document_versions_number_unique', ['document_id', 'version_no'])
      .execute();

    await database.schema
      .createTable('professional_document_events')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('document_id', 'uuid', (column) =>
        column.notNull().references('professional_documents.id').onDelete('cascade'),
      )
      .addColumn('action', 'text', (column) =>
        column
          .notNull()
          .check(
            sql`action in ('create', 'upload', 'submit', 'leader_approve', 'approve', 'return', 'sign', 'withdraw')`,
          ),
      )
      .addColumn('note', 'text', (column) => column.check(sql`char_length(note) <= 2000`))
      .addColumn('actor_id', 'uuid', (column) => column.notNull())
      .addColumn('actor_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('professional_document_events_document_index')
      .on('professional_document_events')
      .columns(['document_id', 'created_at'])
      .execute();

    await database.schema
      .createTable('professional_record_settings')
      .addColumn('id', 'integer', (column) => column.primaryKey().check(sql`id = 1`))
      .addColumn('locked', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('locked_at', 'timestamptz')
      .addColumn('locked_by_name', 'text')
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await sql`insert into professional_record_settings (id) values (1)`.execute(database);
  },
  async down(database) {
    for (const table of [
      'professional_record_settings',
      'professional_document_events',
      'professional_document_versions',
      'professional_documents',
      'professional_rounds',
      'professional_work_group_members',
      'professional_work_groups',
      'professional_folders',
    ]) {
      await database.schema.dropTable(table).execute();
    }
    await sql`delete from files where purpose = 'professional_record'`.execute(database);
    await sql`alter table files drop constraint files_purpose_check`.execute(database);
    await sql`alter table files add constraint files_purpose_check
      check (purpose in (${sql.raw(PREVIOUS_PURPOSES)}))`.execute(database);
  },
};
