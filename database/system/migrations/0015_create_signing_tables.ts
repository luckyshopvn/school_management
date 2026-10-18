import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Phân hệ Quản lý kí hồ sơ (mục 6 của Sở), bản chạy nội bộ (DT-16 phần 16k; quyết định của Eric ngày 2026-10-16: tính năng
// cần hệ thống bên ngoài làm bản chạy nội bộ, nút ghi đúng việc làm, không có chữ ký số thật):
// - signing_certificates: 1.1 Chứng thư số nhà trường, một dòng cho cả trường. Ghi thông tin chứng thư (kiểu chữ ký, nhà phát
//   hành, tên đăng nhập, người đứng tên, số sê-ri, hiệu lực), ảnh con dấu (ở kho tệp), trạng thái đăng ký kí nội bộ và trạng
//   thái đồng bộ với Bộ (2.1) do người dùng đánh dấu kèm ngày, người đánh dấu. Không lưu mật khẩu hay khóa bí mật nào;
// - signing_dossiers: 2.2, 2.3 hồ sơ của trường, lớp, nhân sự, học sinh, sổ đầu bài (lớp và tháng) theo năm học. Mỗi đối
//   tượng có tối đa một hồ sơ chưa hủy (chỉ mục duy nhất từng phần). Tệp PDF lập khi tạo hồ sơ và tệp PDF đã kí lưu ở kho tệp
//   kèm mã băm SHA-256; snapshot là số liệu dùng để lập tệp, để kí lại đúng nội dung đã tạo và để so khi tải thông tin thay
//   đổi; content_hash là mã băm của số liệu đó. Trạng thái: Đã tạo, Đã kí, Đã xác nhận hoàn thành, Đã gửi, Đã hủy;
// - signing_events: lịch sử thao tác của chứng thư và từng hồ sơ.
// Đặt ở cơ sở dữ liệu hệ thống để giữ qua các năm học; user_id là mã ở dịch vụ định danh (khác cơ sở dữ liệu nên không có
// khóa ngoại); tên người thao tác ghi lại tại thời điểm thao tác. Mã định danh hồ sơ cấp theo dãy số signing_dossier_code
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('signing_certificates')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('singleton', 'boolean', (column) => column.notNull().defaultTo(true).unique())
      .addColumn('signature_type', 'text', (column) => column.notNull().defaultTo('remote'))
      .addColumn('provider', 'text')
      .addColumn('login_name', 'text')
      .addColumn('holder_name', 'text')
      .addColumn('holder_title', 'text')
      .addColumn('serial_number', 'text')
      .addColumn('valid_from', 'date')
      .addColumn('valid_to', 'date')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('draft'))
      .addColumn('registered_at', 'timestamptz')
      .addColumn('registered_by', 'uuid')
      .addColumn('registered_by_name', 'text')
      .addColumn('sync_status', 'text', (column) => column.notNull().defaultTo('not_synced'))
      .addColumn('synced_on', 'date')
      .addColumn('sync_note', 'text')
      .addColumn('synced_by', 'uuid')
      .addColumn('synced_by_name', 'text')
      .addColumn('seal_file_name', 'text')
      .addColumn('seal_content_type', 'text')
      .addColumn('seal_storage_key', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_by', 'uuid')
      .addCheckConstraint('signing_certificates_singleton_check', sql`singleton`)
      .addCheckConstraint('signing_certificates_type_check', sql`signature_type in ('remote', 'usb_token', 'hsm')`)
      .addCheckConstraint('signing_certificates_status_check', sql`status in ('draft', 'registered', 'revoked')`)
      .addCheckConstraint('signing_certificates_sync_check', sql`sync_status in ('not_synced', 'synced')`)
      .execute();

    await sql`create sequence signing_dossier_code`.execute(database);
    await database.schema
      .createTable('signing_dossiers')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('academic_year_id', 'uuid', (column) => column.notNull().references('academic_years.id'))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('object_type', 'text', (column) => column.notNull())
      .addColumn('object_id', 'uuid', (column) => column.notNull())
      .addColumn('period', 'text', (column) => column.notNull().defaultTo(''))
      .addColumn('object_label', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('created'))
      .addColumn('snapshot', 'jsonb', (column) => column.notNull())
      .addColumn('content_hash', 'text', (column) => column.notNull())
      .addColumn('file_name', 'text', (column) => column.notNull())
      .addColumn('storage_key', 'text', (column) => column.notNull())
      .addColumn('file_sha256', 'text', (column) => column.notNull())
      .addColumn('size_bytes', 'integer', (column) => column.notNull())
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('signature_method', 'text')
      .addColumn('signed_file_name', 'text')
      .addColumn('signed_storage_key', 'text')
      .addColumn('signed_sha256', 'text')
      .addColumn('signed_size_bytes', 'integer')
      .addColumn('signed_at', 'timestamptz')
      .addColumn('signed_by', 'uuid')
      .addColumn('signed_by_name', 'text')
      .addColumn('changed_at', 'timestamptz')
      .addColumn('change_summary', 'text')
      .addColumn('checked_at', 'timestamptz')
      .addColumn('completed_at', 'timestamptz')
      .addColumn('completed_by', 'uuid')
      .addColumn('completed_by_name', 'text')
      .addColumn('sent_on', 'date')
      .addColumn('sent_note', 'text')
      .addColumn('sent_by', 'uuid')
      .addColumn('sent_by_name', 'text')
      .addColumn('marked_sent_at', 'timestamptz')
      .addColumn('cancelled_at', 'timestamptz')
      .addColumn('cancelled_by', 'uuid')
      .addColumn('cancelled_by_name', 'text')
      .addColumn('cancel_reason', 'text')
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'signing_dossiers_object_type_check',
        sql`object_type in ('school', 'class', 'staff', 'child', 'class_log')`,
      )
      .addCheckConstraint(
        'signing_dossiers_status_check',
        sql`status in ('created', 'signed', 'completed', 'sent', 'cancelled')`,
      )
      .addCheckConstraint(
        'signing_dossiers_period_check',
        sql`(object_type = 'class_log') = (period ~ '^\\d{4}-(0[1-9]|1[0-2])$')`,
      )
      .execute();
    await sql`create unique index signing_dossiers_active_object_unique
      on signing_dossiers (academic_year_id, object_type, object_id, period)
      where status <> 'cancelled'`.execute(database);
    await database.schema
      .createIndex('signing_dossiers_year_status_index')
      .on('signing_dossiers')
      .columns(['academic_year_id', 'status'])
      .execute();

    await database.schema
      .createTable('signing_events')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('dossier_id', 'uuid', (column) => column.references('signing_dossiers.id').onDelete('cascade'))
      .addColumn('action', 'text', (column) => column.notNull())
      .addColumn('note', 'text')
      .addColumn('actor_id', 'uuid', (column) => column.notNull())
      .addColumn('actor_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'signing_events_action_check',
        sql`action in ('certificate_save', 'certificate_register', 'certificate_revoke', 'seal_upload', 'seal_delete',
          'certificate_sync', 'certificate_unsync', 'create', 'sign', 'check_changes', 'cancel', 'complete', 'uncomplete',
          'mark_sent')`,
      )
      .execute();
    await database.schema
      .createIndex('signing_events_dossier_index')
      .on('signing_events')
      .columns(['dossier_id', 'created_at'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('signing_events').execute();
    await database.schema.dropTable('signing_dossiers').execute();
    await sql`drop sequence signing_dossier_code`.execute(database);
    await database.schema.dropTable('signing_certificates').execute();
  },
};
