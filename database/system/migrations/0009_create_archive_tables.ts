import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Văn thư lưu trữ, mục 5.10 của Sở (DT-15 phần 15h2, YCTD-118). Đặt ở cơ sở dữ liệu hệ thống vì hồ sơ, phông lưu trữ không
// gắn với một năm học. archive_fonds: phông lưu trữ của trường. archive_holdings: thông tin lưu trữ của một phông theo giai
// đoạn (từ năm, đến năm), đã chỉnh lý hay chưa, còn hay hết giá trị, thời hạn bảo quản, số bó, số hộp, số mét giá, nơi bảo
// quản; Báo cáo lưu trữ cộng các dòng này. archive_records: hồ sơ tài liệu hoàn thành, chưa hoàn thành, có người giải
// quyết và thời hạn. archive_record_files: tệp đính kèm của hồ sơ, nội dung nằm ở kho tệp. created_by, updated_by là mã
// tài khoản ở dịch vụ định danh (khác cơ sở dữ liệu nên không có khóa ngoại)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('archive_fonds')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('note', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('created_by', 'uuid')
      .addColumn('updated_by', 'uuid')
      .addCheckConstraint('archive_fonds_code_check', sql`length(code) between 1 and 50`)
      .addCheckConstraint('archive_fonds_name_check', sql`length(name) between 1 and 200`)
      .execute();

    await database.schema
      .createTable('archive_holdings')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('fond_id', 'uuid', (column) => column.notNull().references('archive_fonds.id').onDelete('restrict'))
      .addColumn('period_from_year', 'integer', (column) => column.notNull())
      .addColumn('period_to_year', 'integer', (column) => column.notNull())
      .addColumn('arranged', 'boolean', (column) => column.notNull())
      .addColumn('expired', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('retention', 'text', (column) => column.notNull())
      .addColumn('retention_years', 'integer')
      .addColumn('bundle_count', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('box_count', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('shelf_meters', sql`numeric(10, 2)`, (column) => column.notNull().defaultTo(0))
      .addColumn('storage_location', 'text', (column) => column.notNull())
      .addColumn('note', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('created_by', 'uuid')
      .addColumn('updated_by', 'uuid')
      .addCheckConstraint(
        'archive_holdings_period_check',
        sql`period_from_year between 1900 and 2200 and period_to_year between period_from_year and 2200`,
      )
      .addCheckConstraint(
        'archive_holdings_retention_check',
        sql`(retention = 'permanent' and retention_years is null and not expired)
          or (retention = 'limited' and retention_years between 1 and 100)`,
      )
      .addCheckConstraint(
        'archive_holdings_quantity_check',
        sql`bundle_count >= 0 and box_count >= 0 and shelf_meters >= 0`,
      )
      .addCheckConstraint('archive_holdings_location_check', sql`length(storage_location) between 1 and 200`)
      .execute();
    await database.schema.createIndex('archive_holdings_fond_index').on('archive_holdings').column('fond_id').execute();

    await database.schema
      .createTable('archive_records')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('title', 'text', (column) => column.notNull())
      .addColumn('fond_id', 'uuid', (column) => column.references('archive_fonds.id').onDelete('restrict'))
      .addColumn('handler_name', 'text', (column) => column.notNull())
      .addColumn('opened_on', 'date', (column) => column.notNull())
      .addColumn('due_date', 'date')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('pending'))
      .addColumn('completed_on', 'date')
      .addColumn('retention', 'text', (column) => column.notNull())
      .addColumn('retention_years', 'integer')
      .addColumn('sheet_count', 'integer')
      .addColumn('note', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('created_by', 'uuid')
      .addColumn('updated_by', 'uuid')
      .addCheckConstraint('archive_records_code_check', sql`length(code) between 1 and 50`)
      .addCheckConstraint('archive_records_title_check', sql`length(title) between 1 and 500`)
      .addCheckConstraint('archive_records_handler_check', sql`length(handler_name) between 1 and 200`)
      .addCheckConstraint(
        'archive_records_status_check',
        sql`(status = 'pending' and completed_on is null)
          or (status = 'completed' and completed_on is not null and completed_on >= opened_on)`,
      )
      .addCheckConstraint('archive_records_due_check', sql`due_date is null or due_date >= opened_on`)
      .addCheckConstraint(
        'archive_records_retention_check',
        sql`(retention = 'permanent' and retention_years is null)
          or (retention = 'limited' and retention_years between 1 and 100)`,
      )
      .addCheckConstraint('archive_records_sheet_check', sql`sheet_count is null or sheet_count between 0 and 100000`)
      .execute();
    // Hai danh sách hoàn thành, chưa hoàn thành; chưa hoàn thành sắp theo thời hạn
    await database.schema
      .createIndex('archive_records_status_due_index')
      .on('archive_records')
      .columns(['status', 'due_date'])
      .execute();
    await database.schema.createIndex('archive_records_fond_index').on('archive_records').column('fond_id').execute();

    await database.schema
      .createTable('archive_record_files')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('record_id', 'uuid', (column) => column.notNull().references('archive_records.id').onDelete('cascade'))
      .addColumn('storage_key', 'text', (column) => column.notNull().unique())
      .addColumn('file_name', 'text', (column) => column.notNull())
      .addColumn('content_type', 'text', (column) => column.notNull())
      .addColumn('size', 'integer', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('created_by', 'uuid')
      .execute();
    await database.schema
      .createIndex('archive_record_files_record_index')
      .on('archive_record_files')
      .column('record_id')
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('archive_record_files').execute();
    await database.schema.dropTable('archive_records').execute();
    await database.schema.dropTable('archive_holdings').execute();
    await database.schema.dropTable('archive_fonds').execute();
  },
};
