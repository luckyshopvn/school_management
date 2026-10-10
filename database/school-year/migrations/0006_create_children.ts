import { sql, type CreateTableBuilder } from 'kysely';
import type { Migration } from 'kysely/migration';

// Hồ sơ trẻ, phụ huynh, sức khỏe cơ bản, lịch sử lớp, tệp, nhật ký truy cập, hàng đợi thông báo (QT-01, YCTD-45)
function withRecordColumns<Table extends string>(table: CreateTableBuilder<Table>) {
  return table
    .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('created_by', 'uuid');
}

export const migration: Migration = {
  async up(database) {
    await withRecordColumns(database.schema.createTable('files'))
      .addColumn('org_unit_id', 'uuid', (column) => column.references('org_units.id'))
      .addColumn('purpose', 'text', (column) => column.notNull())
      .addColumn('file_name', 'text', (column) => column.notNull())
      .addColumn('content_type', 'text', (column) => column.notNull())
      .addColumn('size_bytes', 'integer', (column) => column.notNull())
      .addColumn('storage_key', 'text', (column) => column.notNull().unique())
      .addCheckConstraint('files_purpose_check', sql`purpose in ('birth_certificate', 'photo_consent')`)
      .execute();

    await withRecordColumns(database.schema.createTable('children'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('full_name', 'text', (column) => column.notNull())
      .addColumn('dob', 'date', (column) => column.notNull())
      .addColumn('gender', 'text', (column) => column.notNull())
      .addColumn('place_of_birth', 'text')
      .addColumn('address', 'text')
      // Số định danh cá nhân lưu mã hóa; băm có khóa để kiểm tra trùng; bốn số cuối để hiển thị dạng che (BM-64)
      .addColumn('national_id_encrypted', 'text', (column) => column.notNull())
      .addColumn('national_id_hash', 'text', (column) => column.notNull().unique())
      .addColumn('national_id_last4', 'text', (column) => column.notNull())
      .addColumn('moet_student_code', 'text', (column) => column.unique())
      .addColumn('birth_certificate_file_id', 'uuid', (column) => column.notNull().references('files.id'))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('draft'))
      .addColumn('is_staff_child', 'boolean', (column) => column.notNull().defaultTo(false))
      // Tạm là tài khoản nhân sự đến khi có hồ sơ nhân sự (YCTD-44)
      .addColumn('related_staff_user_id', 'uuid')
      .addColumn('related_staff_name', 'text')
      .addColumn('special_needs_note', 'text')
      .addColumn('photo_consent', 'text', (column) => column.notNull())
      .addColumn('photo_consent_method', 'text')
      .addColumn('photo_consent_by', 'uuid')
      .addColumn('photo_consent_at', 'timestamptz')
      .addColumn('photo_consent_file_id', 'uuid', (column) => column.references('files.id'))
      .addColumn('enroll_date', 'date')
      .addColumn('leave_date', 'date')
      .addColumn('leave_reason', 'text')
      .addColumn('note', 'text')
      .addColumn('reject_reason', 'text')
      .addColumn('submitted_by', 'uuid')
      .addColumn('submitted_at', 'timestamptz')
      .addColumn('approved_by', 'uuid')
      .addColumn('approved_at', 'timestamptz')
      .addCheckConstraint('children_gender_check', sql`gender in ('male', 'female')`)
      .addCheckConstraint(
        'children_status_check',
        sql`status in ('draft', 'pending', 'active', 'paused', 'withdrawn', 'graduated')`,
      )
      .addCheckConstraint('children_photo_consent_check', sql`photo_consent in ('pending', 'granted', 'refused')`)
      .addCheckConstraint(
        'children_photo_consent_method_check',
        sql`photo_consent_method is null or photo_consent_method in ('paper', 'app')`,
      )
      .execute();
    await database.schema.createIndex('children_org_unit_id_index').on('children').column('org_unit_id').execute();
    await database.schema
      .createIndex('children_name_dob_index')
      .on('children')
      .columns(['org_unit_id', 'dob'])
      .execute();

    await withRecordColumns(database.schema.createTable('health_profiles'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().unique().references('children.id'))
      .addColumn('blood_type', 'text')
      // Trống là chưa khai báo; sai là đã chọn không có dị ứng (BR-06)
      .addColumn('has_allergies', 'boolean')
      .addColumn('allergies', 'text')
      .addColumn('chronic_conditions', 'text')
      .addColumn('note', 'text')
      .execute();

    await withRecordColumns(database.schema.createTable('guardians'))
      .addColumn('full_name', 'text', (column) => column.notNull())
      .addColumn('phone', 'text', (column) => column.unique())
      .addColumn('email', 'text')
      .addColumn('occupation', 'text')
      .addColumn('address', 'text')
      .addColumn('user_id', 'uuid')
      .execute();
    await database.schema.createIndex('guardians_user_id_index').on('guardians').column('user_id').execute();

    await withRecordColumns(database.schema.createTable('child_guardians'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('guardian_id', 'uuid', (column) => column.notNull().references('guardians.id'))
      .addColumn('relationship_item_id', 'uuid', (column) => column.notNull().references('catalog_items.id'))
      .addColumn('is_primary', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('can_pickup', 'boolean', (column) => column.notNull().defaultTo(true))
      .addUniqueConstraint('child_guardians_pair_unique', ['child_id', 'guardian_id'])
      .execute();
    await sql`create unique index child_guardians_single_primary on child_guardians (child_id) where is_primary`.execute(
      database,
    );
    await database.schema
      .createIndex('child_guardians_guardian_id_index')
      .on('child_guardians')
      .column('guardian_id')
      .execute();

    await withRecordColumns(database.schema.createTable('class_enrollments'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('from_date', 'date', (column) => column.notNull())
      .addColumn('to_date', 'date')
      .addColumn('reason', 'text')
      .addColumn('is_current', 'boolean', (column) => column.notNull().defaultTo(true))
      .execute();
    // Một trẻ thuộc đúng một lớp tại một thời điểm (BR-03)
    await sql`create unique index class_enrollments_single_current on class_enrollments (child_id) where is_current`.execute(
      database,
    );
    await database.schema
      .createIndex('class_enrollments_class_id_index')
      .on('class_enrollments')
      .column('class_id')
      .execute();

    await database.schema
      .createTable('photo_consent_histories')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('action', 'text', (column) => column.notNull())
      .addColumn('method', 'text')
      .addColumn('file_id', 'uuid', (column) => column.references('files.id'))
      .addColumn('actor_user_id', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('photo_consent_histories_action_check', sql`action in ('pending', 'granted', 'refused')`)
      .execute();

    await database.schema
      .createTable('data_access_logs')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('actor_user_id', 'uuid')
      .addColumn('actor_name', 'text')
      .addColumn('api_client_id', 'uuid')
      .addColumn('org_unit_id', 'uuid')
      .addColumn('entity_name', 'text', (column) => column.notNull())
      .addColumn('entity_id', 'uuid', (column) => column.notNull())
      .addColumn('scope', 'text', (column) => column.notNull())
      .addColumn('record_count', 'integer', (column) => column.notNull().defaultTo(1))
      .addColumn('purpose', 'text')
      .addColumn('ip_address', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('data_access_logs_entity_index')
      .on('data_access_logs')
      .columns(['entity_name', 'entity_id'])
      .execute();

    // Hàng đợi thông báo; gửi thật làm ở phân hệ thông báo (YCTD-44)
    await database.schema
      .createTable('notifications')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid')
      .addColumn('template_code', 'text', (column) => column.notNull())
      .addColumn('title', 'text', (column) => column.notNull())
      .addColumn('body', 'text', (column) => column.notNull())
      .addColumn('target_type', 'text', (column) => column.notNull())
      .addColumn('target_id', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('notifications_target_index')
      .on('notifications')
      .columns(['target_type', 'target_id'])
      .execute();
    await database.schema
      .createTable('notification_recipients')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('notification_id', 'uuid', (column) => column.notNull().references('notifications.id'))
      .addColumn('user_id', 'uuid', (column) => column.notNull())
      .addColumn('channel', 'text', (column) => column.notNull())
      .addColumn('is_read', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('read_at', 'timestamptz')
      .addColumn('channel_status', 'text', (column) => column.notNull().defaultTo('pending'))
      .addColumn('sent_at', 'timestamptz')
      .addCheckConstraint('notification_recipients_channel_check', sql`channel in ('in_app', 'sms')`)
      .addCheckConstraint('notification_recipients_status_check', sql`channel_status in ('pending', 'sent', 'failed')`)
      .execute();
    await database.schema
      .createIndex('notification_recipients_user_id_index')
      .on('notification_recipients')
      .column('user_id')
      .execute();
  },
  async down(database) {
    for (const table of [
      'notification_recipients',
      'notifications',
      'data_access_logs',
      'photo_consent_histories',
      'class_enrollments',
      'child_guardians',
      'guardians',
      'health_profiles',
      'children',
      'files',
    ]) {
      await database.schema.dropTable(table).execute();
    }
  },
};
