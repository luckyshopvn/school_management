import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Văn bản đến theo hệ thống quản lý văn bản và điều hành VNPT iOffice (DT-18 phần 18a, YCTD-138; quyết định của Eric ngày
// 2026-10-19). Đặt ở cơ sở dữ liệu hệ thống để giữ qua các năm học; mã người dùng là mã ở dịch vụ định danh (khác cơ sở dữ
// liệu nên không có khóa ngoại), tên người ghi lại tại thời điểm thao tác:
// - document_catalog_items: danh mục cấu hình được của văn bản: hình thức, độ khẩn, độ mật, lĩnh vực. Độ khẩn, độ mật có
//   mức (0 thường, 1 khẩn hoặc mật, 2 hỏa tốc hoặc tối mật) để tô màu, sắp xếp; cột cấp học trống là dùng cho mọi cấp;
// - external_units, external_unit_groups, external_unit_group_members: Đơn vị bên ngoài và nhóm đơn vị ban hành; mã định
//   danh điện tử để dành cho trục liên thông văn bản;
// - document_books, document_book_members: sổ văn bản theo năm và đơn vị áp dụng (chiều đến; chiều đi để dành cho phần
//   18b), số bắt đầu, ngày áp dụng, người theo dõi, người quản trị;
// - document_leaders: lãnh đạo nhận văn bản trình (danh sách chọn khi Trình lãnh đạo, Chuyển lãnh đạo);
// - incoming_documents: văn bản đến theo biểu mẫu THÔNG TIN VĂN BẢN ĐẾN; văn bản nhận qua liên thông chờ vào sổ chưa có số
//   đến. Trạng thái: chờ vào sổ, đã vào sổ, đang xử lý, đã kết thúc;
// - incoming_document_files: tệp quét hoặc tải lên và tệp của văn bản liên quan, ở kho tệp kèm mã băm SHA-256;
// - incoming_document_relations: văn bản liên quan là văn bản đến khác;
// - incoming_document_assignments: luồng xử lý, mỗi dòng là một lần chuyển cho một người với vai trò lãnh đạo, xử lý chính,
//   phối hợp hoặc xem để biết; parent_id là dòng của người chuyển (trống là văn thư chuyển) để vẽ sơ đồ luồng, lấy lại,
//   trả lại; xin gia hạn ghi trên dòng của người xin;
// - incoming_document_flags: đánh dấu và theo dõi của từng người;
// - incoming_document_events: lịch sử tham mưu, thao tác của từng văn bản
const ROLES = `'leader', 'main', 'coordinate', 'view'`;

export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('document_catalog_items')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('kind', 'text', (column) => column.notNull())
      .addColumn('code', 'text', (column) => column.notNull())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('level', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('education_level', 'text')
      .addColumn('sort_order', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('active', 'boolean', (column) => column.notNull().defaultTo(true))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('document_catalog_items_kind_code_unique', ['kind', 'code'])
      .addCheckConstraint('document_catalog_items_kind_check', sql`kind in ('form', 'urgency', 'secrecy', 'field')`)
      .addCheckConstraint('document_catalog_items_level_check', sql`level between 0 and 2`)
      .execute();

    await database.schema
      .createTable('external_units')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('address', 'text')
      .addColumn('phone', 'text')
      .addColumn('email', 'text')
      .addColumn('electronic_code', 'text')
      .addColumn('sort_order', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('active', 'boolean', (column) => column.notNull().defaultTo(true))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createTable('external_unit_groups')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('name', 'text', (column) => column.notNull().unique())
      .addColumn('note', 'text')
      .addColumn('sort_order', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createTable('external_unit_group_members')
      .addColumn('group_id', 'uuid', (column) =>
        column.notNull().references('external_unit_groups.id').onDelete('cascade'),
      )
      .addColumn('unit_id', 'uuid', (column) => column.notNull().references('external_units.id').onDelete('cascade'))
      .addPrimaryKeyConstraint('external_unit_group_members_pk', ['group_id', 'unit_id'])
      .execute();

    await database.schema
      .createTable('document_books')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('direction', 'text', (column) => column.notNull())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('org_unit_id', 'uuid')
      .addColumn('year', 'integer', (column) => column.notNull())
      .addColumn('start_number', 'integer', (column) => column.notNull().defaultTo(1))
      .addColumn('start_date', 'date', (column) => column.notNull())
      .addColumn('end_date', 'date')
      .addColumn('sort_order', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('document_books_name_unique', ['direction', 'year', 'name'])
      .addCheckConstraint('document_books_direction_check', sql`direction in ('incoming', 'outgoing')`)
      .addCheckConstraint('document_books_start_number_check', sql`start_number >= 1`)
      .addCheckConstraint('document_books_dates_check', sql`end_date is null or end_date >= start_date`)
      .execute();
    await database.schema
      .createTable('document_book_members')
      .addColumn('book_id', 'uuid', (column) => column.notNull().references('document_books.id').onDelete('cascade'))
      .addColumn('user_id', 'uuid', (column) => column.notNull())
      .addColumn('user_name', 'text', (column) => column.notNull())
      .addColumn('role', 'text', (column) => column.notNull())
      .addPrimaryKeyConstraint('document_book_members_pk', ['book_id', 'user_id', 'role'])
      .addCheckConstraint('document_book_members_role_check', sql`role in ('follower', 'admin')`)
      .execute();

    await database.schema
      .createTable('document_leaders')
      .addColumn('user_id', 'uuid', (column) => column.primaryKey())
      .addColumn('user_name', 'text', (column) => column.notNull())
      .addColumn('title', 'text')
      .addColumn('sort_order', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createTable('incoming_documents')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('book_id', 'uuid', (column) => column.references('document_books.id'))
      .addColumn('arrival_number', 'integer')
      .addColumn('arrival_date', 'date')
      .addColumn('summary', 'text', (column) => column.notNull())
      .addColumn('symbol', 'text', (column) => column.notNull())
      .addColumn('issuer_unit_id', 'uuid', (column) => column.references('external_units.id').onDelete('set null'))
      .addColumn('issuer_name', 'text', (column) => column.notNull())
      .addColumn('document_date', 'date', (column) => column.notNull())
      .addColumn('form_id', 'uuid', (column) => column.references('document_catalog_items.id'))
      .addColumn('urgency_id', 'uuid', (column) => column.references('document_catalog_items.id'))
      .addColumn('secrecy_id', 'uuid', (column) => column.references('document_catalog_items.id'))
      .addColumn('field_id', 'uuid', (column) => column.references('document_catalog_items.id'))
      .addColumn('deadline', 'date')
      .addColumn('authority', 'text', (column) => column.notNull().defaultTo('normal'))
      .addColumn('document_kind', 'text', (column) => column.notNull().defaultTo('new'))
      .addColumn('transfer_method', 'text', (column) => column.notNull().defaultTo('hand'))
      .addColumn('copy_type', 'text', (column) => column.notNull().defaultTo('original'))
      .addColumn('has_paper', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('processing_note', 'text')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('registered'))
      .addColumn('restricted', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('restricted_at', 'timestamptz')
      .addColumn('restricted_by_name', 'text')
      .addColumn('source', 'text', (column) => column.notNull().defaultTo('manual'))
      .addColumn('interconnect_status', 'text')
      .addColumn('interconnect_reference', 'text')
      .addColumn('received_at', 'timestamptz')
      .addColumn('acknowledged_at', 'timestamptz')
      .addColumn('acknowledged_by_name', 'text')
      .addColumn('reply_symbol', 'text')
      .addColumn('reply_date', 'date')
      .addColumn('reply_note', 'text')
      .addColumn('replied_at', 'timestamptz')
      .addColumn('replied_by_name', 'text')
      .addColumn('archive_record_id', 'uuid', (column) => column.references('archive_records.id').onDelete('set null'))
      .addColumn('archived_at', 'timestamptz')
      .addColumn('archived_by_name', 'text')
      .addColumn('completed_at', 'timestamptz')
      .addColumn('completed_by', 'uuid')
      .addColumn('completed_by_name', 'text')
      .addColumn('completion_note', 'text')
      .addColumn('registered_at', 'timestamptz')
      .addColumn('registered_by', 'uuid')
      .addColumn('registered_by_name', 'text')
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'incoming_documents_status_check',
        sql`status in ('pending_registration', 'registered', 'processing', 'completed')`,
      )
      .addCheckConstraint(
        'incoming_documents_registration_check',
        sql`(status = 'pending_registration') = (arrival_number is null)
          and (arrival_number is null) = (book_id is null)
          and (arrival_number is null) = (arrival_date is null)`,
      )
      .addCheckConstraint('incoming_documents_authority_check', sql`authority in ('normal', 'outside')`)
      .addCheckConstraint('incoming_documents_kind_check', sql`document_kind in ('new', 'revoke', 'replace')`)
      .addCheckConstraint(
        'incoming_documents_transfer_check',
        sql`transfer_method in ('hand', 'post', 'email', 'interconnect')`,
      )
      .addCheckConstraint(
        'incoming_documents_copy_check',
        sql`copy_type in ('original', 'certified_copy', 'transcribed_copy', 'extract_copy')`,
      )
      .addCheckConstraint('incoming_documents_source_check', sql`source in ('manual', 'interconnect')`)
      .addCheckConstraint(
        'incoming_documents_interconnect_check',
        sql`interconnect_status is null or interconnect_status in ('received', 'acknowledged')`,
      )
      .execute();
    await sql`create unique index incoming_documents_book_number_unique
      on incoming_documents (book_id, arrival_number) where arrival_number is not null`.execute(database);
    await database.schema
      .createIndex('incoming_documents_status_index')
      .on('incoming_documents')
      .columns(['status', 'arrival_date'])
      .execute();

    await database.schema
      .createTable('incoming_document_files')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('document_id', 'uuid', (column) =>
        column.notNull().references('incoming_documents.id').onDelete('cascade'),
      )
      .addColumn('kind', 'text', (column) => column.notNull().defaultTo('main'))
      .addColumn('file_name', 'text', (column) => column.notNull())
      .addColumn('content_type', 'text', (column) => column.notNull())
      .addColumn('size_bytes', 'integer', (column) => column.notNull())
      .addColumn('sha256', 'text', (column) => column.notNull())
      .addColumn('storage_key', 'text', (column) => column.notNull())
      .addColumn('scanned', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('incoming_document_files_kind_check', sql`kind in ('main', 'related')`)
      .execute();
    await database.schema
      .createIndex('incoming_document_files_document_index')
      .on('incoming_document_files')
      .column('document_id')
      .execute();

    await database.schema
      .createTable('incoming_document_relations')
      .addColumn('document_id', 'uuid', (column) =>
        column.notNull().references('incoming_documents.id').onDelete('cascade'),
      )
      .addColumn('related_id', 'uuid', (column) =>
        column.notNull().references('incoming_documents.id').onDelete('cascade'),
      )
      .addPrimaryKeyConstraint('incoming_document_relations_pk', ['document_id', 'related_id'])
      .addCheckConstraint('incoming_document_relations_self_check', sql`document_id <> related_id`)
      .execute();

    await database.schema
      .createTable('incoming_document_assignments')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('document_id', 'uuid', (column) =>
        column.notNull().references('incoming_documents.id').onDelete('cascade'),
      )
      .addColumn('parent_id', 'uuid', (column) =>
        column.references('incoming_document_assignments.id').onDelete('cascade'),
      )
      .addColumn('user_id', 'uuid', (column) => column.notNull())
      .addColumn('user_name', 'text', (column) => column.notNull())
      .addColumn('user_title', 'text')
      .addColumn('role', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('pending'))
      .addColumn('deadline', 'date')
      .addColumn('note', 'text')
      .addColumn('result_note', 'text')
      .addColumn('assigned_by', 'uuid', (column) => column.notNull())
      .addColumn('assigned_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('read_at', 'timestamptz')
      .addColumn('finished_at', 'timestamptz')
      .addColumn('extension_until', 'date')
      .addColumn('extension_reason', 'text')
      .addColumn('extension_status', 'text')
      .addColumn('extension_decided_at', 'timestamptz')
      .addColumn('extension_decided_by_name', 'text')
      .addCheckConstraint('incoming_document_assignments_role_check', sql.raw(`role in (${ROLES})`))
      .addCheckConstraint(
        'incoming_document_assignments_status_check',
        sql`status in ('pending', 'forwarded', 'done', 'returned', 'revoked', 'refused', 'closed')`,
      )
      .addCheckConstraint(
        'incoming_document_assignments_extension_check',
        sql`extension_status is null or extension_status in ('requested', 'approved', 'rejected')`,
      )
      .execute();
    await database.schema
      .createIndex('incoming_document_assignments_document_index')
      .on('incoming_document_assignments')
      .columns(['document_id', 'created_at'])
      .execute();
    await database.schema
      .createIndex('incoming_document_assignments_user_index')
      .on('incoming_document_assignments')
      .columns(['user_id', 'status'])
      .execute();

    await database.schema
      .createTable('incoming_document_flags')
      .addColumn('document_id', 'uuid', (column) =>
        column.notNull().references('incoming_documents.id').onDelete('cascade'),
      )
      .addColumn('user_id', 'uuid', (column) => column.notNull())
      .addColumn('starred', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('followed', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addPrimaryKeyConstraint('incoming_document_flags_pk', ['document_id', 'user_id'])
      .execute();

    await database.schema
      .createTable('incoming_document_events')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('document_id', 'uuid', (column) =>
        column.notNull().references('incoming_documents.id').onDelete('cascade'),
      )
      .addColumn('action', 'text', (column) => column.notNull())
      .addColumn('note', 'text')
      .addColumn('actor_id', 'uuid', (column) => column.notNull())
      .addColumn('actor_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('incoming_document_events_document_index')
      .on('incoming_document_events')
      .columns(['document_id', 'created_at'])
      .execute();

    // Danh mục mặc định theo biểu mẫu thêm mới văn bản đến của VNPT iOffice (khảo sát ngày 2026-10-19); trường sửa, ẩn,
    // thêm ở 2.4 Danh mục văn bản
    const items: Array<[string, string, string, number]> = [];
    FORMS.forEach((name, index) => items.push(['form', `HT${String(index + 1).padStart(2, '0')}`, name, 0]));
    URGENCIES.forEach(([code, name], level) => items.push(['urgency', code, name, level]));
    SECRECIES.forEach(([code, name], level) => items.push(['secrecy', code, name, level]));
    FIELDS.forEach((name, index) => items.push(['field', `LV${String(index + 1).padStart(2, '0')}`, name, 0]));
    for (const [index, [kind, code, name, level]] of items.entries()) {
      await sql`insert into document_catalog_items (kind, code, name, level, sort_order)
        values (${kind}, ${code}, ${name}, ${level}, ${index + 1})`.execute(database);
    }
  },
  async down(database) {
    for (const table of [
      'incoming_document_events',
      'incoming_document_flags',
      'incoming_document_assignments',
      'incoming_document_relations',
      'incoming_document_files',
      'incoming_documents',
      'document_leaders',
      'document_book_members',
      'document_books',
      'external_unit_group_members',
      'external_unit_groups',
      'external_units',
      'document_catalog_items',
    ]) {
      await database.schema.dropTable(table).execute();
    }
  },
};

const FORMS = [
  'Công văn',
  'Báo cáo',
  'Biên bản',
  'Công điện',
  'Hướng dẫn',
  'Kế hoạch',
  'Nghị định',
  'Kết luận',
  'Nghị quyết',
  'Quy định',
  'Quyết định',
  'Thông báo',
  'Thông tư',
  'Thông tư liên tịch',
  'Tờ trình',
  'Chương trình',
  'Hợp đồng',
  'Hợp đồng lao động',
  'Báo cáo tuần',
  'Phiếu trình',
  'Giấy xác nhận',
  'Giấy ủy quyền',
  'Chỉ thị',
  'Thư mời',
  'Giấy mời',
  'Giấy phép',
  'Phiếu chuyển',
  'Đề án',
  'Phiếu đề xuất',
  'Giấy đi đường',
  'Lệnh điều xe',
  'Giấy giới thiệu',
  'Danh sách',
  'Phương án',
  'Kết luận thanh tra',
  'Khác',
];
const URGENCIES: Array<[string, string]> = [
  ['THUONG', 'Thường'],
  ['KHAN', 'Khẩn'],
  ['HOATOC', 'Hỏa tốc'],
];
const SECRECIES: Array<[string, string]> = [
  ['THUONG', 'Thường'],
  ['MAT', 'Mật'],
  ['TOIMAT', 'Tối mật'],
];
// Lĩnh vực của sổ văn bản đến; khảo sát chưa ghi danh sách nên Claude tự đặt theo các mảng việc của trường
const FIELDS = [
  'Chuyên môn',
  'Tổ chức cán bộ',
  'Tài chính',
  'Cơ sở vật chất',
  'Y tế, an toàn thực phẩm',
  'Tuyển sinh',
  'Thi đua, khen thưởng',
  'Khác',
];
