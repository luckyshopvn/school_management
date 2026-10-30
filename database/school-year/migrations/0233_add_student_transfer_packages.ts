import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Gói chuyển trường, lát L1 (YCTD-390). Chuyển đi ghi gói đã lập lần gần nhất: mã gói, mã băm tệp gói, các phần đã gửi và đồng ý
// của phụ huynh cho phần thêm. Chuyển đến ghi gói đã tiếp nhận (mỗi mã gói tiếp nhận một lần) và phần không có bảng riêng ở trường
// đến (khen thưởng, môn lựa chọn, nhu cầu đặc biệt) để xem lại. Học bạ, kết quả học kỳ nhận từ trường khác lưu chỉ đọc ở
// `received_learning_records`, tệp PDF đã ký giữ nguyên bản trong kho tệp
export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('student_transfers')
      .addColumn('package_code', 'text')
      .addColumn('package_sha256', 'text')
      .addColumn('package_parts', 'jsonb')
      .addColumn('package_created_at', 'timestamptz')
      .addColumn('package_created_by_name', 'text')
      .addColumn('partner_school_code', 'text')
      .addColumn('received_data', 'jsonb')
      .execute();
    await sql`create unique index student_transfers_received_package_unique on student_transfers (package_code)
      where direction = 'in' and package_code is not null`.execute(database);

    await database.schema
      .createTable('received_learning_records')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('transfer_id', 'uuid', (column) =>
        column.notNull().references('student_transfers.id').onDelete('cascade'),
      )
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id').onDelete('cascade'))
      .addColumn('package_code', 'text', (column) => column.notNull())
      .addColumn('source_school_name', 'text', (column) => column.notNull())
      // learning_record: học bạ một năm học đã ký; term_results: kết quả năm học đang học khi chuyển giữa năm
      .addColumn('kind', 'text', (column) => column.notNull().check(sql`kind in ('learning_record', 'term_results')`))
      .addColumn('academic_year_name', 'text', (column) => column.notNull())
      .addColumn('class_name', 'text')
      .addColumn('grade_level', 'text')
      .addColumn('school_level', 'text')
      .addColumn('content', 'jsonb', (column) => column.notNull())
      .addColumn('storage_key', 'text')
      .addColumn('file_sha256', 'text')
      .addColumn('signer_name', 'text')
      .addColumn('signed_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('received_learning_records_child_index')
      .on('received_learning_records')
      .column('child_id')
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('received_learning_records').execute();
    await sql`drop index if exists student_transfers_received_package_unique`.execute(database);
    await database.schema
      .alterTable('student_transfers')
      .dropColumn('package_code')
      .dropColumn('package_sha256')
      .dropColumn('package_parts')
      .dropColumn('package_created_at')
      .dropColumn('package_created_by_name')
      .dropColumn('partner_school_code')
      .dropColumn('received_data')
      .execute();
  },
};
