import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Người được ủy quyền đón trẻ, yêu cầu phụ huynh xác nhận người đón ngoài danh sách và nhật ký đón trả
// (P02-04, P04-03; QT-02 bước 6, 7, E6; BR-11, BR-56; YCTD-48)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('authorized_pickups')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('full_name', 'text', (column) => column.notNull())
      .addColumn('relationship', 'text', (column) => column.notNull())
      .addColumn('phone', 'text', (column) => column.notNull())
      .addColumn('valid_from', 'date', (column) => column.notNull())
      // Trống là không thời hạn
      .addColumn('valid_to', 'date')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('source', 'text', (column) => column.notNull())
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('revoked_by', 'uuid')
      .addColumn('revoked_at', 'timestamptz')
      .addCheckConstraint('authorized_pickups_status_check', sql`status in ('active', 'revoked')`)
      .addCheckConstraint('authorized_pickups_source_check', sql`source in ('parent', 'staff')`)
      .addCheckConstraint('authorized_pickups_valid_range_check', sql`valid_to is null or valid_to >= valid_from`)
      .execute();
    await database.schema
      .createIndex('authorized_pickups_child_id_index')
      .on('authorized_pickups')
      .column('child_id')
      .execute();

    // Yêu cầu phụ huynh xác nhận người đón ngoài danh sách; chỉ có hiệu lực cho trẻ, người đón và ngày đó
    await database.schema
      .createTable('pickup_confirmation_requests')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('pickup_date', 'date', (column) => column.notNull())
      .addColumn('person_name', 'text', (column) => column.notNull())
      .addColumn('relationship', 'text', (column) => column.notNull())
      .addColumn('phone', 'text')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('pending'))
      .addColumn('requested_by', 'uuid', (column) => column.notNull())
      .addColumn('requested_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('responded_by', 'uuid')
      .addColumn('responded_at', 'timestamptz')
      .addCheckConstraint(
        'pickup_confirmation_requests_status_check',
        sql`status in ('pending', 'confirmed', 'refused')`,
      )
      .execute();
    await database.schema
      .createIndex('pickup_confirmation_requests_child_date_index')
      .on('pickup_confirmation_requests')
      .columns(['child_id', 'pickup_date'])
      .execute();

    await database.schema
      .createTable('pickup_records')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('pickup_date', 'date', (column) => column.notNull())
      // Bàn giao chiều của giáo viên hoặc bảo vệ xác nhận người đón tại cổng
      .addColumn('pickup_type', 'text', (column) => column.notNull())
      .addColumn('person_kind', 'text', (column) => column.notNull())
      .addColumn('person_name', 'text', (column) => column.notNull())
      .addColumn('relationship', 'text', (column) => column.notNull())
      .addColumn('phone', 'text')
      .addColumn('guardian_id', 'uuid', (column) => column.references('guardians.id'))
      .addColumn('authorized_pickup_id', 'uuid', (column) => column.references('authorized_pickups.id'))
      .addColumn('confirmation_request_id', 'uuid', (column) => column.references('pickup_confirmation_requests.id'))
      .addColumn('photo_file_id', 'uuid', (column) => column.references('files.id'))
      .addColumn('recorded_by', 'uuid', (column) => column.notNull())
      .addColumn('recorded_at', 'timestamptz', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('pickup_records_type_check', sql`pickup_type in ('handover', 'gate_check')`)
      .addCheckConstraint(
        'pickup_records_person_kind_check',
        sql`person_kind in ('guardian', 'authorized', 'parent_confirmed')`,
      )
      .execute();
    // Mỗi trẻ được bàn giao một lần mỗi ngày; bảo vệ xác nhận được nhiều lần
    await sql`create unique index pickup_records_handover_unique on pickup_records (child_id, pickup_date)
      where pickup_type = 'handover'`.execute(database);
    await database.schema
      .createIndex('pickup_records_class_date_index')
      .on('pickup_records')
      .columns(['class_id', 'pickup_date'])
      .execute();

    await sql`alter table files drop constraint files_purpose_check`.execute(database);
    await sql`alter table files add constraint files_purpose_check
      check (purpose in ('birth_certificate', 'photo_consent', 'import', 'pickup_photo'))`.execute(database);
  },
  async down(database) {
    for (const table of ['pickup_records', 'pickup_confirmation_requests', 'authorized_pickups']) {
      await database.schema.dropTable(table).execute();
    }
    await sql`delete from files where purpose = 'pickup_photo'`.execute(database);
    await sql`alter table files drop constraint files_purpose_check`.execute(database);
    await sql`alter table files add constraint files_purpose_check
      check (purpose in ('birth_certificate', 'photo_consent', 'import'))`.execute(database);
  },
};
