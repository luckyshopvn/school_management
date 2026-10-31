import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Kho minh chứng dùng chung của trường (YCTD-396 lát L1). Ở cơ sở dữ liệu hệ thống để một minh chứng dùng cho nhiều năm học,
// nhiều bộ tiêu chí mà không chép (Q-396-2). Bộ tiêu chí lát này vẫn ở cơ sở dữ liệu năm học (22f); mã định danh của bộ, tiêu
// chí giữ nguyên khi chuyển năm học nên kho tham chiếu bằng mã định danh, không có khóa ngoại giữa hai cơ sở dữ liệu
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('evidence_items')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('title', 'text', (column) => column.notNull().check(sql`char_length(title) between 1 and 500`))
      .addColumn('document_number', 'text', (column) => column.check(sql`char_length(document_number) <= 100`))
      .addColumn('issued_date', 'date')
      .addColumn('issuer', 'text', (column) => column.check(sql`char_length(issuer) <= 300`))
      .addColumn('description', 'text', (column) => column.check(sql`char_length(description) <= 2000`))
      .addColumn('school_year_names', sql`text[]`, (column) => column.notNull().defaultTo(sql`'{}'`))
      .addColumn('valid_until', 'date')
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('missing')
          .check(sql`status in ('missing', 'collecting', 'sufficient', 'needs_update')`),
      )
      // Bản chụp có dữ liệu cá nhân thì chỉ người có quyền xem loại nguồn tải được (Q-396-5, BM-271)
      .addColumn('has_personal_data', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('personal_data_permission', 'text')
      .addColumn('owner_user_id', 'uuid')
      .addColumn('owner_name', 'text')
      // Khóa chuyển từ minh chứng của đợt 22f: "<cơ sở dữ liệu năm học>:<mã định danh cũ>", chạy lại không chép trùng
      .addColumn('import_key', 'text', (column) => column.unique())
      .addColumn('created_by', 'uuid')
      .addColumn('created_by_name', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createTable('evidence_versions')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('evidence_id', 'uuid', (column) =>
        column.notNull().references('evidence_items.id').onDelete('cascade'),
      )
      .addColumn('version_no', 'integer', (column) => column.notNull().check(sql`version_no >= 1`))
      .addColumn('source_kind', 'text', (column) => column.notNull().check(sql`source_kind in ('upload', 'record')`))
      .addColumn('record_type', 'text', (column) => column.check(sql`char_length(record_type) <= 50`))
      .addColumn('record_id', 'uuid')
      .addColumn('record_school_year', 'text')
      .addColumn('record_label', 'text', (column) => column.check(sql`char_length(record_label) <= 500`))
      .addColumn('record_updated_at', 'timestamptz')
      .addColumn('file_name', 'text')
      .addColumn('content_type', 'text')
      .addColumn('size_bytes', 'integer')
      .addColumn('sha256', 'text')
      .addColumn('storage_key', 'text')
      .addColumn('note', 'text', (column) => column.check(sql`char_length(note) <= 500`))
      .addColumn('created_by', 'uuid')
      .addColumn('created_by_name', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('evidence_versions_number_unique', ['evidence_id', 'version_no'])
      .addCheckConstraint(
        'evidence_versions_source_check',
        sql`(source_kind <> 'upload' or storage_key is not null)
          and (source_kind <> 'record' or (record_type is not null and record_id is not null))`,
      )
      .execute();

    await database.schema
      .createTable('evidence_codes')
      .addColumn('evidence_id', 'uuid', (column) =>
        column.notNull().references('evidence_items.id').onDelete('cascade'),
      )
      .addColumn('framework_id', 'uuid', (column) => column.notNull())
      .addColumn('primary_node_id', 'uuid', (column) => column.notNull())
      .addColumn('box', 'integer', (column) => column.notNull().check(sql`box between 1 and 99`))
      .addColumn('sequence', 'integer', (column) => column.notNull().check(sql`sequence between 1 and 999`))
      .addColumn('code', 'text', (column) => column.notNull().check(sql`char_length(code) between 1 and 50`))
      .addPrimaryKeyConstraint('evidence_codes_pkey', ['evidence_id', 'framework_id'])
      .addUniqueConstraint('evidence_codes_code_unique', ['framework_id', 'code'])
      .execute();

    await database.schema
      .createTable('evidence_node_links')
      .addColumn('evidence_id', 'uuid', (column) =>
        column.notNull().references('evidence_items.id').onDelete('cascade'),
      )
      .addColumn('framework_id', 'uuid', (column) => column.notNull())
      .addColumn('node_id', 'uuid', (column) => column.notNull())
      .addColumn('is_primary', 'boolean', (column) => column.notNull().defaultTo(false))
      .addPrimaryKeyConstraint('evidence_node_links_pkey', ['evidence_id', 'node_id'])
      .execute();
    await database.schema
      .createIndex('evidence_node_links_node_index')
      .on('evidence_node_links')
      .columns(['framework_id', 'node_id'])
      .execute();

    // Lịch sử và nhật ký truy cập; giữ cả khi minh chứng bị xóa nên không có khóa ngoại
    await database.schema
      .createTable('evidence_events')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('evidence_id', 'uuid', (column) => column.notNull())
      .addColumn('action', 'text', (column) =>
        column
          .notNull()
          .check(
            sql`action in ('create', 'update', 'add_version', 'link', 'unlink', 'delete', 'import', 'view_file', 'download_file')`,
          ),
      )
      .addColumn('version_no', 'integer')
      .addColumn('detail', 'text', (column) => column.check(sql`char_length(detail) <= 1000`))
      .addColumn('actor_id', 'uuid')
      .addColumn('actor_name', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('evidence_events_evidence_index')
      .on('evidence_events')
      .columns(['evidence_id', 'created_at'])
      .execute();

    // Cơ sở dữ liệu năm học đã chuyển minh chứng của đợt 22f sang kho
    await database.schema
      .createTable('evidence_imports')
      .addColumn('school_year_database', 'text', (column) => column.primaryKey())
      .addColumn('evidence_count', 'integer', (column) => column.notNull())
      .addColumn('imported_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
  },
  async down(database) {
    for (const table of [
      'evidence_imports',
      'evidence_events',
      'evidence_node_links',
      'evidence_codes',
      'evidence_versions',
      'evidence_items',
    ]) {
      await database.schema.dropTable(table).execute();
    }
  },
};
