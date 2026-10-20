import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-18 phần 18c (YCTD-141): lịch đơn vị, phòng họp và hồ sơ công việc theo VNPT iOffice (quyết định của Eric ngày
// 2026-10-19). Đặt ở cơ sở dữ liệu hệ thống để giữ qua các năm học như văn bản đến của 18a; mã người dùng là mã ở dịch vụ
// định danh, mã đơn vị là mã ở năm học (khác cơ sở dữ liệu nên không có khóa ngoại), tên ghi lại tại thời điểm thao tác.
// Chi tiết do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - meeting_rooms: danh mục phòng họp (tên, địa điểm, sức chứa, trang thiết bị);
// - room_bookings: đăng ký sử dụng phòng họp, trạng thái chờ phê duyệt, phê duyệt, bị từ chối, đã hủy; hai lượt đã duyệt
//   hoặc đang chờ của cùng một phòng không được chồng giờ (kiểm tra ở dịch vụ, khóa theo phòng);
// - unit_schedule_entries, unit_schedule_attendees: lịch tuần của đơn vị theo ngày và buổi sáng, chiều (chủ trì, thành phần,
//   địa điểm, ghi chú), bản nháp chỉ người đăng ký lịch thấy, công bố thì mọi người thấy; người tham dự để lọc "Lịch của
//   tôi"; lịch có phòng họp thì kèm một lượt đăng ký phòng;
// - unit_schedule_templates: mẫu lịch tuần, áp vào một tuần thành các dòng nháp;
// - work_files, work_file_shares, work_file_items, work_file_events: hồ sơ công việc cá nhân, chia sẻ (xem hoặc cập nhật),
//   chuyển giao, gồm văn bản đến, công việc, ghi chú; nộp lưu sang văn thư lưu trữ (15h2) thành hồ sơ tài liệu
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('meeting_rooms')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('name', 'text', (column) => column.notNull().unique())
      .addColumn('location', 'text')
      .addColumn('capacity', 'integer')
      .addColumn('equipment', 'text')
      .addColumn('sort_order', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('active', 'boolean', (column) => column.notNull().defaultTo(true))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('meeting_rooms_capacity_check', sql`capacity is null or capacity between 1 and 10000`)
      .execute();

    await database.schema
      .createTable('room_bookings')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('room_id', 'uuid', (column) => column.notNull().references('meeting_rooms.id'))
      .addColumn('title', 'text', (column) => column.notNull())
      .addColumn('chair_name', 'text')
      .addColumn('participants', 'text')
      .addColumn('starts_at', 'timestamptz', (column) => column.notNull())
      .addColumn('ends_at', 'timestamptz', (column) => column.notNull())
      .addColumn('note', 'text')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('pending'))
      .addColumn('requested_by', 'uuid', (column) => column.notNull())
      .addColumn('requested_by_name', 'text', (column) => column.notNull())
      .addColumn('decided_by', 'uuid')
      .addColumn('decided_by_name', 'text')
      .addColumn('decided_at', 'timestamptz')
      .addColumn('decision_note', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'room_bookings_status_check',
        sql`status in ('pending', 'approved', 'rejected', 'cancelled')`,
      )
      .addCheckConstraint('room_bookings_time_check', sql`ends_at > starts_at`)
      .execute();
    await database.schema
      .createIndex('room_bookings_room_index')
      .on('room_bookings')
      .columns(['room_id', 'starts_at'])
      .execute();

    await database.schema
      .createTable('unit_schedule_entries')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid')
      .addColumn('entry_date', 'date', (column) => column.notNull())
      .addColumn('session', 'text', (column) => column.notNull())
      .addColumn('start_time', 'text')
      .addColumn('end_time', 'text')
      .addColumn('content', 'text', (column) => column.notNull())
      .addColumn('chair_name', 'text')
      .addColumn('participants', 'text')
      .addColumn('location', 'text')
      .addColumn('note', 'text')
      .addColumn('room_booking_id', 'uuid', (column) => column.references('room_bookings.id').onDelete('set null'))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('draft'))
      .addColumn('published_at', 'timestamptz')
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('unit_schedule_entries_session_check', sql`session in ('morning', 'afternoon')`)
      .addCheckConstraint('unit_schedule_entries_status_check', sql`status in ('draft', 'published')`)
      .addCheckConstraint(
        'unit_schedule_entries_time_check',
        sql`(start_time is null or start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
          and (end_time is null or (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and start_time is not null
            and end_time > start_time))`,
      )
      .execute();
    await database.schema
      .createIndex('unit_schedule_entries_date_index')
      .on('unit_schedule_entries')
      .columns(['entry_date', 'session'])
      .execute();
    await database.schema
      .createTable('unit_schedule_attendees')
      .addColumn('entry_id', 'uuid', (column) =>
        column.notNull().references('unit_schedule_entries.id').onDelete('cascade'),
      )
      .addColumn('user_id', 'uuid', (column) => column.notNull())
      .addColumn('user_name', 'text', (column) => column.notNull())
      .addPrimaryKeyConstraint('unit_schedule_attendees_pk', ['entry_id', 'user_id'])
      .execute();
    await database.schema
      .createIndex('unit_schedule_attendees_user_index')
      .on('unit_schedule_attendees')
      .column('user_id')
      .execute();

    await database.schema
      .createTable('unit_schedule_templates')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('name', 'text', (column) => column.notNull().unique())
      .addColumn('org_unit_id', 'uuid')
      .addColumn('items', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createTable('work_files')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull())
      .addColumn('title', 'text', (column) => column.notNull())
      .addColumn('year', 'integer', (column) => column.notNull())
      .addColumn('description', 'text')
      .addColumn('org_unit_id', 'uuid')
      .addColumn('owner_user_id', 'uuid', (column) => column.notNull())
      .addColumn('owner_name', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('open'))
      .addColumn('retention', 'text', (column) => column.notNull().defaultTo('limited'))
      .addColumn('retention_years', 'integer')
      .addColumn('opened_on', 'date', (column) => column.notNull())
      .addColumn('closed_on', 'date')
      .addColumn('transferred_from_user_id', 'uuid')
      .addColumn('transferred_from_name', 'text')
      .addColumn('transferred_at', 'timestamptz')
      .addColumn('transfer_note', 'text')
      .addColumn('submitted_at', 'timestamptz')
      .addColumn('return_note', 'text')
      .addColumn('archive_record_id', 'uuid', (column) => column.references('archive_records.id').onDelete('set null'))
      .addColumn('archived_on', 'date')
      .addColumn('archived_by_name', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('work_files_owner_code_unique', ['owner_user_id', 'year', 'code'])
      .addCheckConstraint(
        'work_files_status_check',
        sql`status in ('open', 'closed', 'submitted', 'returned', 'archived')`,
      )
      .addCheckConstraint(
        'work_files_retention_check',
        sql`(retention = 'permanent' and retention_years is null)
          or (retention = 'limited' and (retention_years is null or retention_years between 1 and 100))`,
      )
      .addCheckConstraint('work_files_year_check', sql`year between 1900 and 2200`)
      .execute();
    await database.schema
      .createIndex('work_files_owner_index')
      .on('work_files')
      .columns(['owner_user_id', 'year'])
      .execute();
    await database.schema
      .createTable('work_file_shares')
      .addColumn('file_id', 'uuid', (column) => column.notNull().references('work_files.id').onDelete('cascade'))
      .addColumn('user_id', 'uuid', (column) => column.notNull())
      .addColumn('user_name', 'text', (column) => column.notNull())
      .addColumn('permission', 'text', (column) => column.notNull().defaultTo('view'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addPrimaryKeyConstraint('work_file_shares_pk', ['file_id', 'user_id'])
      .addCheckConstraint('work_file_shares_permission_check', sql`permission in ('view', 'edit')`)
      .execute();
    await database.schema
      .createIndex('work_file_shares_user_index')
      .on('work_file_shares')
      .column('user_id')
      .execute();
    await database.schema
      .createTable('work_file_items')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('file_id', 'uuid', (column) => column.notNull().references('work_files.id').onDelete('cascade'))
      .addColumn('item_type', 'text', (column) => column.notNull())
      .addColumn('incoming_document_id', 'uuid', (column) =>
        column.references('incoming_documents.id').onDelete('cascade'),
      )
      .addColumn('task_id', 'uuid')
      .addColumn('title', 'text', (column) => column.notNull())
      .addColumn('note', 'text')
      .addColumn('added_by', 'uuid', (column) => column.notNull())
      .addColumn('added_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'work_file_items_type_check',
        sql`(item_type = 'incoming_document' and incoming_document_id is not null)
          or (item_type = 'task' and task_id is not null)
          or (item_type = 'note' and incoming_document_id is null and task_id is null)`,
      )
      .execute();
    await database.schema.createIndex('work_file_items_file_index').on('work_file_items').column('file_id').execute();
    await database.schema
      .createTable('work_file_events')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('file_id', 'uuid', (column) => column.notNull().references('work_files.id').onDelete('cascade'))
      .addColumn('action', 'text', (column) => column.notNull())
      .addColumn('note', 'text')
      .addColumn('actor_id', 'uuid', (column) => column.notNull())
      .addColumn('actor_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('work_file_events_file_index')
      .on('work_file_events')
      .columns(['file_id', 'created_at'])
      .execute();
  },
  async down(database) {
    for (const table of [
      'work_file_events',
      'work_file_items',
      'work_file_shares',
      'work_files',
      'unit_schedule_templates',
      'unit_schedule_attendees',
      'unit_schedule_entries',
      'room_bookings',
      'meeting_rooms',
    ]) {
      await database.schema.dropTable(table).execute();
    }
  },
};
