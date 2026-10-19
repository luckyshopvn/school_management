import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-17 phần 17d (YCTD-135; khảo sát mục 10.2.4): phân hệ Tuyển sinh đầu cấp phần 2, bản chạy nội bộ. Dùng lại đợt và hồ sơ
// tuyển sinh của phân hệ Tuyển sinh (YCTD-86):
// - `admission_campaigns`: loại hình (đại trà, tiên tiến, khảo sát) và năm học nhận trẻ (mã năm học ở cơ sở dữ liệu hệ thống);
// - `admission_applications`: nguồn "phân tuyến" (nhập từ Excel thay kết nối phân tuyến của Sở); diện cư trú, nơi ở hiện tại,
//   tổ, khu phố, phường/xã, tỉnh; phường/xã và trường cuối cấp; họ tên cha, mẹ; giấy tờ đã nộp; phụ huynh đồng ý, từ chối
//   nhập học; tiêu chí, kết quả học tập và thành tích, trạng thái trường duyệt và xã/phường đồng ý của hồ sơ trường tiên
//   tiến; nội dung thông báo riêng; loại hồ sơ (có tài khoản, tự do), điểm trường nhận; mã gói tin, mã GUID, kết quả chuyển
//   sang hồ sơ học sinh; trạng thái mới "đã hủy nhập học";
// - `admission_application_files`: giấy khai sinh, ảnh cư trú VNeID, minh chứng của hồ sơ, tệp ở bảng tệp dùng chung với mục
//   đích admission_document;
// - `admission_transfer_results`: kết quả từng hồ sơ của mỗi lần chuyển sang CSDL (1.6) và mỗi lần hủy nhập học (1.7);
// - `entry_admission_contacts`: học sinh ngoài hệ thống nhập từ Excel để nhận thông báo tuyển sinh (1.5);
// - `entry_admission_notices`, `entry_admission_notice_recipients`: thông báo tuyển sinh đã gửi và trạng thái theo người nhận
const PREVIOUS_PURPOSES = `'birth_certificate', 'photo_consent', 'import', 'pickup_photo', 'payment_voucher', 'medicine_photo', 'prescription', 'activity_photo', 'content_file', 'candidate_cv', 'final_year_document'`;
const PREVIOUS_STATUSES = `'submitted', 'received', 'passed', 'rejected', 'converted'`;
const DOCUMENTS = `'admission_notice', 'declaration', 'birth_certificate_copy', 'primary_transcript', 'primary_completion'`;
const REVIEWS = `'pending', 'admitted', 'not_admitted'`;

export const migration: Migration = {
  async up(database) {
    await sql`alter table files drop constraint files_purpose_check`.execute(database);
    await sql`alter table files add constraint files_purpose_check
      check (purpose in (${sql.raw(PREVIOUS_PURPOSES)}, 'admission_document'))`.execute(database);

    await database.schema
      .alterTable('admission_campaigns')
      .addColumn('program_type', 'text', (column) =>
        column
          .notNull()
          .defaultTo('general')
          .check(sql`program_type in ('general', 'advanced', 'survey')`),
      )
      .addColumn('target_academic_year_id', 'uuid')
      .execute();

    await sql`alter table admission_applications drop constraint admission_applications_source_check`.execute(database);
    await sql`alter table admission_applications add constraint admission_applications_source_check
      check (source in ('online', 'staff', 'routing'))`.execute(database);
    await sql`alter table admission_applications drop constraint admission_applications_status_check`.execute(database);
    await sql`alter table admission_applications add constraint admission_applications_status_check
      check (status in (${sql.raw(PREVIOUS_STATUSES)}, 'cancelled'))`.execute(database);
    await database.schema
      .alterTable('admission_applications')
      .addColumn('residence_type', 'text', (column) =>
        column.check(sql`residence_type in ('permanent', 'temporary', 'other')`),
      )
      .addColumn('current_residence', 'text', (column) => column.check(sql`char_length(current_residence) <= 300`))
      .addColumn('residential_group', 'text')
      .addColumn('quarter', 'text')
      .addColumn('ward', 'text')
      .addColumn('province', 'text')
      .addColumn('place_of_birth', 'text')
      .addColumn('final_year_ward', 'text')
      .addColumn('final_year_school', 'text')
      .addColumn('father_name', 'text')
      .addColumn('mother_name', 'text')
      .addColumn('routed', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('submitted_documents', sql`text[]`, (column) =>
        column
          .notNull()
          .defaultTo(sql`'{}'::text[]`)
          .check(sql.raw(`submitted_documents <@ array[${DOCUMENTS}]::text[]`)),
      )
      .addColumn('admission_decision', 'text', (column) =>
        column
          .notNull()
          .defaultTo('pending')
          .check(sql`admission_decision in ('pending', 'accepted', 'declined')`),
      )
      .addColumn('admission_decision_at', 'timestamptz')
      .addColumn('advanced_criteria', 'text', (column) => column.check(sql`char_length(advanced_criteria) <= 1000`))
      .addColumn('advanced_achievements', 'text', (column) =>
        column.check(sql`char_length(advanced_achievements) <= 2000`),
      )
      .addColumn('registered_at', 'date')
      .addColumn('school_review', 'text', (column) =>
        column
          .notNull()
          .defaultTo('pending')
          .check(sql.raw(`school_review in (${REVIEWS})`)),
      )
      .addColumn('school_reviewed_by_name', 'text')
      .addColumn('school_reviewed_at', 'timestamptz')
      .addColumn('ward_review', 'text', (column) =>
        column
          .notNull()
          .defaultTo('pending')
          .check(sql.raw(`ward_review in (${REVIEWS})`)),
      )
      .addColumn('notice_content', 'text', (column) => column.check(sql`char_length(notice_content) <= 1000`))
      .addColumn('record_type', 'text', (column) =>
        column
          .notNull()
          .defaultTo('free')
          .check(sql`record_type in ('account', 'free')`),
      )
      .addColumn('target_org_unit_id', 'uuid', (column) => column.references('org_units.id'))
      .addColumn('transfer_package_code', 'text')
      .addColumn('transfer_guid', 'uuid', (column) => column.unique())
      .addColumn('transferred_by_name', 'text')
      .addColumn('cancelled_at', 'timestamptz')
      .addColumn('cancelled_by_name', 'text')
      .execute();

    await database.schema
      .createTable('admission_application_files')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('application_id', 'uuid', (column) =>
        column.notNull().references('admission_applications.id').onDelete('cascade'),
      )
      .addColumn('file_id', 'uuid', (column) => column.notNull().unique().references('files.id'))
      .addColumn('kind', 'text', (column) =>
        column.notNull().check(sql`kind in ('birth_certificate', 'residence', 'evidence')`),
      )
      .addColumn('uploaded_by', 'uuid', (column) => column.notNull())
      .addColumn('uploaded_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('admission_application_files_application_index')
      .on('admission_application_files')
      .column('application_id')
      .execute();

    await database.schema
      .createTable('admission_transfer_results')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('kind', 'text', (column) => column.notNull().check(sql`kind in ('transfer', 'cancel')`))
      .addColumn('package_code', 'text', (column) => column.notNull())
      .addColumn('application_id', 'uuid', (column) =>
        column.notNull().references('admission_applications.id').onDelete('cascade'),
      )
      .addColumn('guid', 'uuid')
      .addColumn('child_id', 'uuid')
      .addColumn('succeeded', 'boolean', (column) => column.notNull())
      .addColumn('note', 'text')
      .addColumn('actor_user_id', 'uuid', (column) => column.notNull())
      .addColumn('actor_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('admission_transfer_results_package_index')
      .on('admission_transfer_results')
      .columns(['kind', 'package_code'])
      .execute();

    await database.schema
      .createTable('entry_admission_contacts')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('campaign_id', 'uuid', (column) => column.notNull().references('admission_campaigns.id'))
      .addColumn('full_name', 'text', (column) => column.notNull())
      .addColumn('dob', 'date')
      .addColumn('gender', 'text', (column) => column.check(sql`gender in ('male', 'female')`))
      .addColumn('national_id_encrypted', 'text')
      .addColumn('national_id_last4', 'text')
      .addColumn('phone', 'text')
      .addColumn('final_year_school', 'text')
      .addColumn('notice_content', 'text', (column) => column.check(sql`char_length(notice_content) <= 1000`))
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createTable('entry_admission_notices')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('campaign_id', 'uuid', (column) => column.notNull().references('admission_campaigns.id'))
      .addColumn('content', 'text', (column) => column.notNull().check(sql`char_length(content) <= 1000`))
      .addColumn('sent_by', 'uuid', (column) => column.notNull())
      .addColumn('sent_by_name', 'text', (column) => column.notNull())
      .addColumn('sent_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createTable('entry_admission_notice_recipients')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('notice_id', 'uuid', (column) =>
        column.notNull().references('entry_admission_notices.id').onDelete('cascade'),
      )
      .addColumn('application_id', 'uuid', (column) =>
        column.references('admission_applications.id').onDelete('cascade'),
      )
      .addColumn('contact_id', 'uuid', (column) => column.references('entry_admission_contacts.id').onDelete('cascade'))
      .addColumn('phone', 'text')
      .addColumn('content', 'text', (column) => column.notNull())
      .addColumn('channels', 'text')
      .addColumn('delivered', 'boolean', (column) => column.notNull())
      .addColumn('note', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'entry_admission_notice_recipients_target_check',
        sql`(application_id is null) <> (contact_id is null)`,
      )
      .execute();
    await database.schema
      .createIndex('entry_admission_notice_recipients_application_index')
      .on('entry_admission_notice_recipients')
      .column('application_id')
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('entry_admission_notice_recipients').execute();
    await database.schema.dropTable('entry_admission_notices').execute();
    await database.schema.dropTable('entry_admission_contacts').execute();
    await database.schema.dropTable('admission_transfer_results').execute();
    await database.schema.dropTable('admission_application_files').execute();
    await sql`update admission_applications set status = 'passed' where status = 'cancelled' and created_child_id is null`.execute(
      database,
    );
    await sql`update admission_applications set status = 'converted' where status = 'cancelled'`.execute(database);
    await sql`update admission_applications set source = 'staff' where source = 'routing'`.execute(database);
    await database.schema
      .alterTable('admission_applications')
      .dropColumn('residence_type')
      .dropColumn('current_residence')
      .dropColumn('residential_group')
      .dropColumn('quarter')
      .dropColumn('ward')
      .dropColumn('province')
      .dropColumn('place_of_birth')
      .dropColumn('final_year_ward')
      .dropColumn('final_year_school')
      .dropColumn('father_name')
      .dropColumn('mother_name')
      .dropColumn('routed')
      .dropColumn('submitted_documents')
      .dropColumn('admission_decision')
      .dropColumn('admission_decision_at')
      .dropColumn('advanced_criteria')
      .dropColumn('advanced_achievements')
      .dropColumn('registered_at')
      .dropColumn('school_review')
      .dropColumn('school_reviewed_by_name')
      .dropColumn('school_reviewed_at')
      .dropColumn('ward_review')
      .dropColumn('notice_content')
      .dropColumn('record_type')
      .dropColumn('target_org_unit_id')
      .dropColumn('transfer_package_code')
      .dropColumn('transfer_guid')
      .dropColumn('transferred_by_name')
      .dropColumn('cancelled_at')
      .dropColumn('cancelled_by_name')
      .execute();
    await sql`alter table admission_applications drop constraint admission_applications_status_check`.execute(database);
    await sql`alter table admission_applications add constraint admission_applications_status_check
      check (status in (${sql.raw(PREVIOUS_STATUSES)}))`.execute(database);
    await sql`alter table admission_applications drop constraint admission_applications_source_check`.execute(database);
    await sql`alter table admission_applications add constraint admission_applications_source_check
      check (source in ('online', 'staff'))`.execute(database);
    await database.schema
      .alterTable('admission_campaigns')
      .dropColumn('program_type')
      .dropColumn('target_academic_year_id')
      .execute();
    await sql`delete from files where purpose = 'admission_document'`.execute(database);
    await sql`alter table files drop constraint files_purpose_check`.execute(database);
    await sql`alter table files add constraint files_purpose_check
      check (purpose in (${sql.raw(PREVIOUS_PURPOSES)}))`.execute(database);
  },
};
