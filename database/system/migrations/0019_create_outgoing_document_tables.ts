import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Văn bản đi theo hệ thống quản lý văn bản và điều hành VNPT iOffice (DT-18 phần 18b, YCTD-140; quyết định của Eric ngày
// 2026-10-19). Dùng chung sổ văn bản (chiều đi), danh mục văn bản, đơn vị bên ngoài, lãnh đạo nhận văn bản của phần 18a; mã
// người dùng là mã ở dịch vụ định danh (khác cơ sở dữ liệu nên không có khóa ngoại), tên người ghi lại lúc thao tác:
// - outgoing_documents: văn bản đi theo biểu mẫu của iOffice. Trạng thái: dự thảo, đang lấy ý kiến, chờ ký, đã ký (chờ cấp
//   số), đã ban hành. Cấp số theo sổ văn bản đi (số đi, số ký hiệu, ngày ban hành, số bản); mã tra cứu của mã QR; công bố
//   lên website trường (phần 18f đọc cột published); đóng băng; lưu hồ sơ; văn bản trả lời cho một văn bản đến;
// - outgoing_document_files: tệp dự thảo, phiếu trình, văn bản gửi kèm và bản đã ký (lập khi ký nội bộ);
// - outgoing_document_links: văn bản liên quan, văn bản gốc (văn bản đi hoặc văn bản đến khác);
// - outgoing_document_opinions: lấy ý kiến, mỗi dòng là một người được hỏi trong một đợt;
// - outgoing_document_recipients: đơn vị dự kiến nhận: đơn vị bên ngoài (gửi qua trục liên thông là bản chạy nội bộ, trạng
//   thái đánh dấu tay) hoặc đơn vị trong trường (khi phát hành tự tạo văn bản đến chờ vào sổ);
// - outgoing_document_events: lịch sử thao tác.
// Văn bản đến thêm cột văn bản đi nguồn và đơn vị nhận để biết văn bản nhận qua liên thông nội bộ
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('outgoing_documents')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('eoffice_number', 'integer', (column) => column.notNull().unique())
      .addColumn('submission_number', 'text')
      .addColumn('summary', 'text', (column) => column.notNull())
      .addColumn('form_id', 'uuid', (column) => column.references('document_catalog_items.id'))
      .addColumn('urgency_id', 'uuid', (column) => column.references('document_catalog_items.id'))
      .addColumn('secrecy_id', 'uuid', (column) => column.references('document_catalog_items.id'))
      .addColumn('field_id', 'uuid', (column) => column.references('document_catalog_items.id'))
      .addColumn('document_kind', 'text', (column) => column.notNull().defaultTo('new'))
      .addColumn('priority', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('meeting_at', 'timestamptz')
      .addColumn('meeting_place', 'text')
      .addColumn('insert_qr', 'boolean', (column) => column.notNull().defaultTo(true))
      .addColumn('drafter_id', 'uuid', (column) => column.notNull())
      .addColumn('drafter_name', 'text', (column) => column.notNull())
      .addColumn('drafting_unit_id', 'uuid')
      .addColumn('drafting_unit_name', 'text')
      .addColumn('signer_id', 'uuid')
      .addColumn('signer_name', 'text')
      .addColumn('signer_title', 'text')
      .addColumn('content_note', 'text')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('draft'))
      .addColumn('return_note', 'text')
      .addColumn('returned_at', 'timestamptz')
      .addColumn('returned_by_name', 'text')
      .addColumn('submitted_at', 'timestamptz')
      .addColumn('signed_at', 'timestamptz')
      .addColumn('signature_method', 'text')
      .addColumn('verification_code', 'text', (column) => column.unique())
      .addColumn('book_id', 'uuid', (column) => column.references('document_books.id'))
      .addColumn('issue_number', 'integer')
      .addColumn('symbol', 'text')
      .addColumn('issue_date', 'date')
      .addColumn('copies', 'integer')
      .addColumn('issued_at', 'timestamptz')
      .addColumn('issued_by', 'uuid')
      .addColumn('issued_by_name', 'text')
      .addColumn('published', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('published_at', 'timestamptz')
      .addColumn('published_by_name', 'text')
      .addColumn('frozen', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('frozen_at', 'timestamptz')
      .addColumn('frozen_by_name', 'text')
      .addColumn('archive_record_id', 'uuid', (column) => column.references('archive_records.id').onDelete('set null'))
      .addColumn('archived_at', 'timestamptz')
      .addColumn('archived_by_name', 'text')
      .addColumn('reply_to_id', 'uuid', (column) => column.references('incoming_documents.id').onDelete('set null'))
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'outgoing_documents_status_check',
        sql`status in ('draft', 'consulting', 'pending_signature', 'signed', 'issued')`,
      )
      .addCheckConstraint('outgoing_documents_kind_check', sql`document_kind in ('new', 'revoke', 'replace')`)
      .addCheckConstraint(
        'outgoing_documents_issue_check',
        sql`(status = 'issued') = (issue_number is not null)
          and (issue_number is null) = (book_id is null)
          and (issue_number is null) = (issue_date is null)
          and (issue_number is null) = (symbol is null)`,
      )
      .addCheckConstraint(
        'outgoing_documents_signer_check',
        sql`status in ('draft', 'consulting') or signer_id is not null`,
      )
      .addCheckConstraint('outgoing_documents_copies_check', sql`copies is null or copies >= 1`)
      .addCheckConstraint('outgoing_documents_published_check', sql`not published or status = 'issued'`)
      .addCheckConstraint('outgoing_documents_frozen_check', sql`not frozen or status = 'issued'`)
      .execute();
    await sql`create unique index outgoing_documents_book_number_unique
      on outgoing_documents (book_id, issue_number) where issue_number is not null`.execute(database);
    await database.schema
      .createIndex('outgoing_documents_status_index')
      .on('outgoing_documents')
      .columns(['status', 'issue_date'])
      .execute();

    await database.schema
      .createTable('outgoing_document_files')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('document_id', 'uuid', (column) =>
        column.notNull().references('outgoing_documents.id').onDelete('cascade'),
      )
      .addColumn('kind', 'text', (column) => column.notNull().defaultTo('draft'))
      .addColumn('file_name', 'text', (column) => column.notNull())
      .addColumn('content_type', 'text', (column) => column.notNull())
      .addColumn('size_bytes', 'integer', (column) => column.notNull())
      .addColumn('sha256', 'text', (column) => column.notNull())
      .addColumn('storage_key', 'text', (column) => column.notNull())
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'outgoing_document_files_kind_check',
        sql`kind in ('draft', 'submission', 'attachment', 'signed')`,
      )
      .execute();
    await database.schema
      .createIndex('outgoing_document_files_document_index')
      .on('outgoing_document_files')
      .column('document_id')
      .execute();

    await database.schema
      .createTable('outgoing_document_links')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('document_id', 'uuid', (column) =>
        column.notNull().references('outgoing_documents.id').onDelete('cascade'),
      )
      .addColumn('link_type', 'text', (column) => column.notNull())
      .addColumn('outgoing_id', 'uuid', (column) => column.references('outgoing_documents.id').onDelete('cascade'))
      .addColumn('incoming_id', 'uuid', (column) => column.references('incoming_documents.id').onDelete('cascade'))
      .addCheckConstraint('outgoing_document_links_type_check', sql`link_type in ('related', 'original')`)
      .addCheckConstraint(
        'outgoing_document_links_target_check',
        sql`(outgoing_id is null) <> (incoming_id is null) and outgoing_id is distinct from document_id`,
      )
      .execute();
    await sql`create unique index outgoing_document_links_unique
      on outgoing_document_links (document_id, link_type, coalesce(outgoing_id, incoming_id))`.execute(database);

    await database.schema
      .createTable('outgoing_document_opinions')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('document_id', 'uuid', (column) =>
        column.notNull().references('outgoing_documents.id').onDelete('cascade'),
      )
      .addColumn('round', 'integer', (column) => column.notNull())
      .addColumn('user_id', 'uuid', (column) => column.notNull())
      .addColumn('user_name', 'text', (column) => column.notNull())
      .addColumn('user_title', 'text')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('pending'))
      .addColumn('deadline', 'date')
      .addColumn('request_note', 'text')
      .addColumn('opinion', 'text')
      .addColumn('answered_at', 'timestamptz')
      .addColumn('requested_by', 'uuid', (column) => column.notNull())
      .addColumn('requested_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('finished_at', 'timestamptz')
      .addCheckConstraint(
        'outgoing_document_opinions_status_check',
        sql`status in ('pending', 'answered', 'finished', 'closed')`,
      )
      .addUniqueConstraint('outgoing_document_opinions_round_user_unique', ['document_id', 'round', 'user_id'])
      .execute();
    await database.schema
      .createIndex('outgoing_document_opinions_user_index')
      .on('outgoing_document_opinions')
      .columns(['user_id', 'status'])
      .execute();

    await database.schema
      .createTable('outgoing_document_recipients')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('document_id', 'uuid', (column) =>
        column.notNull().references('outgoing_documents.id').onDelete('cascade'),
      )
      .addColumn('recipient_type', 'text', (column) => column.notNull())
      .addColumn('external_unit_id', 'uuid', (column) => column.references('external_units.id').onDelete('set null'))
      .addColumn('org_unit_id', 'uuid')
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('electronic_code', 'text')
      .addColumn('send_status', 'text', (column) => column.notNull().defaultTo('pending'))
      .addColumn('sent_at', 'timestamptz')
      .addColumn('sent_by_name', 'text')
      .addColumn('reference', 'text')
      .addColumn('incoming_document_id', 'uuid', (column) =>
        column.references('incoming_documents.id').onDelete('set null'),
      )
      .addColumn('sort_order', 'integer', (column) => column.notNull().defaultTo(0))
      .addCheckConstraint(
        'outgoing_document_recipients_type_check',
        sql`(recipient_type = 'external' and org_unit_id is null)
          or (recipient_type = 'internal' and org_unit_id is not null and external_unit_id is null)`,
      )
      .addCheckConstraint(
        'outgoing_document_recipients_status_check',
        sql`send_status in ('pending', 'sent', 'delivered')`,
      )
      .execute();
    await database.schema
      .createIndex('outgoing_document_recipients_document_index')
      .on('outgoing_document_recipients')
      .column('document_id')
      .execute();

    await database.schema
      .createTable('outgoing_document_events')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('document_id', 'uuid', (column) =>
        column.notNull().references('outgoing_documents.id').onDelete('cascade'),
      )
      .addColumn('action', 'text', (column) => column.notNull())
      .addColumn('note', 'text')
      .addColumn('actor_id', 'uuid', (column) => column.notNull())
      .addColumn('actor_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('outgoing_document_events_document_index')
      .on('outgoing_document_events')
      .columns(['document_id', 'created_at'])
      .execute();

    // Liên thông nội bộ: văn bản đến tạo từ văn bản đi của trường gửi đơn vị trong trường, chờ văn thư vào sổ
    await database.schema
      .alterTable('incoming_documents')
      .addColumn('outgoing_document_id', 'uuid', (column) =>
        column.references('outgoing_documents.id').onDelete('set null'),
      )
      .addColumn('recipient_org_unit_id', 'uuid')
      .addColumn('recipient_org_unit_name', 'text')
      .execute();
    await sql`alter table incoming_documents drop constraint incoming_documents_source_check`.execute(database);
    await sql`alter table incoming_documents add constraint incoming_documents_source_check
      check (source in ('manual', 'interconnect', 'internal'))`.execute(database);
  },
  async down(database) {
    await sql`delete from incoming_documents where source = 'internal'`.execute(database);
    await sql`alter table incoming_documents drop constraint incoming_documents_source_check`.execute(database);
    await sql`alter table incoming_documents add constraint incoming_documents_source_check
      check (source in ('manual', 'interconnect'))`.execute(database);
    await database.schema
      .alterTable('incoming_documents')
      .dropColumn('outgoing_document_id')
      .dropColumn('recipient_org_unit_id')
      .dropColumn('recipient_org_unit_name')
      .execute();
    for (const table of [
      'outgoing_document_events',
      'outgoing_document_recipients',
      'outgoing_document_opinions',
      'outgoing_document_links',
      'outgoing_document_files',
      'outgoing_documents',
    ]) {
      await database.schema.dropTable(table).execute();
    }
  },
};
