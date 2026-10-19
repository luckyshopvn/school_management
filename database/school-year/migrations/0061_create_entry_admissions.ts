import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-17 phần 17c (YCTD-134; khảo sát mục 10.2): phân hệ Tuyển sinh đầu cấp phần 1, bản chạy nội bộ.
// - `final_year_records`: hồ sơ cuối cấp của trẻ năm cuối cấp (Mầm non: lớp mẫu giáo 5–6 tuổi), mỗi trẻ một hồ sơ trong năm
//   học; trạng thái hồ sơ sáu giá trị theo luồng trường gửi, phụ huynh xác nhận hoặc đề xuất sửa, trường chỉnh sửa, phụ huynh
//   xác nhận lại; trạng thái duyệt; thông tin cư trú, liên hệ, vị trí, phân tuyến nhập tay (không có kết nối phân tuyến của Sở);
// - `final_year_record_files`: giấy khai sinh, ảnh thông tin cư trú trên VNeID, minh chứng do trường hoặc phụ huynh tải lên;
//   tệp lưu ở bảng tệp dùng chung với mục đích final_year_document;
// - `final_year_record_events`: lịch sử trạng thái và thao tác trên hồ sơ;
// - `final_year_class_confirmations`: 1.2 xác nhận hoàn thành hồ sơ cuối cấp theo lớp (đánh dấu tay, người, ngày);
// - `admission_support_requests`: 5.1 yêu cầu hỗ trợ tuyển sinh của phụ huynh và câu trả lời của trường;
// - `school_services`: 2.1 dịch vụ được đăng ký tại trường (mã, tên, thứ tự);
// - `org_units`: 1.8 vĩ độ, kinh độ, tỉnh/thành phố, phường/xã, khu phố của trường và từng điểm trường, lần xác nhận
const PREVIOUS_PURPOSES = `'birth_certificate', 'photo_consent', 'import', 'pickup_photo', 'payment_voucher', 'medicine_photo', 'prescription', 'activity_photo', 'content_file', 'candidate_cv'`;
const STATUSES = `'parent_pending', 'awaiting_school_edit', 'awaiting_parent_reconfirm', 'parent_confirmed', 'school_edited', 'parent_confirmed_after_edit'`;

export const migration: Migration = {
  async up(database) {
    await sql`alter table files drop constraint files_purpose_check`.execute(database);
    await sql`alter table files add constraint files_purpose_check
      check (purpose in (${sql.raw(PREVIOUS_PURPOSES)}, 'final_year_document'))`.execute(database);

    await database.schema
      .createTable('final_year_records')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('child_id', 'uuid', (column) => column.notNull().unique().references('children.id'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('parent_pending')
          .check(sql.raw(`status in (${STATUSES})`)),
      )
      .addColumn('review_status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('pending')
          .check(sql`review_status in ('pending', 'approved')`),
      )
      .addColumn('identity_type', 'text', (column) =>
        column
          .notNull()
          .defaultTo('has_id')
          .check(sql`identity_type in ('has_id', 'no_id', 'temporary_id')`),
      )
      .addColumn('residence_type', 'text', (column) =>
        column.check(sql`residence_type in ('permanent', 'temporary', 'other')`),
      )
      .addColumn('current_residence', 'text', (column) => column.check(sql`char_length(current_residence) <= 300`))
      .addColumn('house_number', 'text')
      .addColumn('street', 'text')
      .addColumn('residential_group', 'text')
      .addColumn('quarter', 'text')
      .addColumn('ward', 'text')
      .addColumn('province', 'text')
      .addColumn('contact_name', 'text')
      .addColumn('contact_phone', 'text')
      .addColumn('contact_email', 'text')
      .addColumn('latitude', 'numeric(9, 6)', (column) => column.check(sql`latitude between -90 and 90`))
      .addColumn('longitude', 'numeric(9, 6)', (column) => column.check(sql`longitude between -180 and 180`))
      .addColumn('routed_school', 'text')
      .addColumn('beneficiary', 'text')
      .addColumn('priority_form', 'text')
      .addColumn('registration_source', 'text', (column) =>
        column
          .notNull()
          .defaultTo('none')
          .check(sql`registration_source in ('parent', 'universal', 'none')`),
      )
      .addColumn('parent_proposal', 'text', (column) => column.check(sql`char_length(parent_proposal) <= 1000`))
      .addColumn('parent_proposed_at', 'timestamptz')
      .addColumn('confirmed_at', 'timestamptz')
      .addColumn('confirmed_by', 'uuid')
      .addColumn('confirmed_by_name', 'text')
      .addColumn('confirmed_by_school', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('school_edited_at', 'timestamptz')
      .addColumn('approved_at', 'timestamptz')
      .addColumn('approved_by', 'uuid')
      .addColumn('approved_by_name', 'text')
      .addColumn('admission_consent', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('admission_consent_at', 'timestamptz')
      .addColumn('created_by', 'uuid')
      .addColumn('updated_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('final_year_records_org_unit_index')
      .on('final_year_records')
      .column('org_unit_id')
      .execute();

    await database.schema
      .createTable('final_year_record_files')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('record_id', 'uuid', (column) =>
        column.notNull().references('final_year_records.id').onDelete('cascade'),
      )
      .addColumn('file_id', 'uuid', (column) => column.notNull().unique().references('files.id'))
      .addColumn('kind', 'text', (column) =>
        column.notNull().check(sql`kind in ('birth_certificate', 'residence', 'evidence')`),
      )
      .addColumn('uploaded_by', 'uuid', (column) => column.notNull())
      .addColumn('uploaded_by_name', 'text', (column) => column.notNull())
      .addColumn('uploaded_by_parent', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('final_year_record_files_record_index')
      .on('final_year_record_files')
      .column('record_id')
      .execute();

    await database.schema
      .createTable('final_year_record_events')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('record_id', 'uuid', (column) =>
        column.notNull().references('final_year_records.id').onDelete('cascade'),
      )
      .addColumn('action', 'text', (column) => column.notNull())
      .addColumn('from_status', 'text')
      .addColumn('to_status', 'text')
      .addColumn('note', 'text')
      .addColumn('actor_user_id', 'uuid', (column) => column.notNull())
      .addColumn('actor_name', 'text', (column) => column.notNull())
      .addColumn('by_parent', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('final_year_record_events_record_index')
      .on('final_year_record_events')
      .column('record_id')
      .execute();

    await database.schema
      .createTable('final_year_class_confirmations')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('class_id', 'uuid', (column) => column.notNull().unique().references('classes.id'))
      .addColumn('confirmed', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('confirmed_by', 'uuid')
      .addColumn('confirmed_by_name', 'text')
      .addColumn('confirmed_at', 'timestamptz')
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createTable('admission_support_requests')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('child_id', 'uuid', (column) => column.references('children.id'))
      .addColumn('requester_user_id', 'uuid', (column) => column.notNull())
      .addColumn('requester_name', 'text', (column) => column.notNull())
      .addColumn('email', 'text')
      .addColumn('phone', 'text')
      .addColumn('content', 'text', (column) => column.notNull().check(sql`char_length(content) <= 2000`))
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('pending')
          .check(sql`status in ('pending', 'answered')`),
      )
      .addColumn('reply', 'text', (column) => column.check(sql`char_length(reply) <= 2000`))
      .addColumn('replied_by', 'uuid')
      .addColumn('replied_by_name', 'text')
      .addColumn('replied_at', 'timestamptz')
      .addColumn('notified_at', 'timestamptz')
      .addColumn('notified_channels', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createTable('school_services')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) =>
        column
          .notNull()
          .unique()
          .check(sql`char_length(code) <= 50`),
      )
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) <= 200`))
      .addColumn('sort_order', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .alterTable('org_units')
      .addColumn('latitude', 'numeric(9, 6)', (column) => column.check(sql`latitude between -90 and 90`))
      .addColumn('longitude', 'numeric(9, 6)', (column) => column.check(sql`longitude between -180 and 180`))
      .addColumn('province', 'text')
      .addColumn('ward', 'text')
      .addColumn('quarter', 'text')
      .addColumn('map_confirmed_at', 'timestamptz')
      .addColumn('map_confirmed_by_name', 'text')
      .execute();
  },
  async down(database) {
    await database.schema
      .alterTable('org_units')
      .dropColumn('latitude')
      .dropColumn('longitude')
      .dropColumn('province')
      .dropColumn('ward')
      .dropColumn('quarter')
      .dropColumn('map_confirmed_at')
      .dropColumn('map_confirmed_by_name')
      .execute();
    await database.schema.dropTable('school_services').execute();
    await database.schema.dropTable('admission_support_requests').execute();
    await database.schema.dropTable('final_year_class_confirmations').execute();
    await database.schema.dropTable('final_year_record_events').execute();
    await database.schema.dropTable('final_year_record_files').execute();
    await database.schema.dropTable('final_year_records').execute();
    await sql`delete from files where purpose = 'final_year_document'`.execute(database);
    await sql`alter table files drop constraint files_purpose_check`.execute(database);
    await sql`alter table files add constraint files_purpose_check
      check (purpose in (${sql.raw(PREVIOUS_PURPOSES)}))`.execute(database);
  },
};
