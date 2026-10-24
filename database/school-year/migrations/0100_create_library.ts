import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-22 phần 22a (YCTD-181): thư viện trường học. Bảng mới có tiền tố `library_`, không dùng `library_items`,
// `library_albums` (kho nội dung cho phụ huynh ở Mầm non) và `asset_loans` (mượn thiết bị). Claude tự chọn theo ủy quyền của
// Eric ngày 2026-10-11:
// - toàn bộ ở cơ sở dữ liệu năm học vì cần khóa ngoại tới `children`, `staff`, `classes`, `subjects`; mở năm học mới thì
//   chép danh mục, bản sao, thẻ bạn đọc, bản đang mượn sang (số hệ thống 0040 giữ sẵn, không dùng);
// - `library_titles` là ấn phẩm (nhan đề), `library_copies` là bản sao có số đăng ký cá biệt (mã vạch, mã QR là chính số này);
//   tình trạng bản sao (tốt, hỏng, mất, thanh lý) ghi ở bản sao, bản đang mượn suy ra từ `library_loans`;
// - `library_readers`: thẻ bạn đọc của cán bộ hoặc học sinh (đúng một trong hai), khóa khi nghỉ; `library_loan_rules`:
//   quy định mượn theo loại bạn đọc; `library_settings`: một dòng, cấp có học sinh mượn, số ngày giữ chỗ đặt trước;
// - `library_loans`: mỗi lần mượn một bản; `kind` là mượn thường hay sách giáo khoa cấp đầu năm; một bản chỉ một lần mượn mở;
// - `library_reservations`: đặt trước theo nhan đề, đến lượt thì giữ một bản trong `hold_days` ngày;
// - `library_textbook_sets` và `library_textbook_set_titles`: bộ sách giáo khoa theo khối để phát cho lớp;
// - `library_stocktakes` và `library_stocktake_items`: đợt kiểm kê, bản đã quét;
// - `library_indicators`: chỉ tiêu báo cáo theo chuẩn thư viện, ngưỡng để trống đến khi đọc văn bản gốc;
// - `library_counters`: bộ đếm cấp số đăng ký cá biệt và số thẻ;
// - `library_title_files`: tệp tài liệu số đính vào nhan đề (kho tệp riêng, không qua bảng `files`)
const SCHOOL_LEVELS = `'MN', 'TH', 'THCS', 'THPT'`;

export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('library_settings')
      .addColumn('id', 'smallint', (column) =>
        column
          .primaryKey()
          .defaultTo(1)
          .check(sql`id = 1`),
      )
      .addColumn('student_levels', sql`text[]`, (column) => column.notNull().defaultTo(sql`'{TH,THCS,THPT}'::text[]`))
      .addColumn('hold_days', 'integer', (column) =>
        column
          .notNull()
          .defaultTo(3)
          .check(sql`hold_days between 1 and 30`),
      )
      .addColumn('updated_by_name', 'text')
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'library_settings_levels_check',
        sql.raw(`student_levels <@ array[${SCHOOL_LEVELS}]::text[]`),
      )
      .execute();
    await sql`insert into library_settings (id) values (1) on conflict do nothing`.execute(database);

    await database.schema
      .createTable('library_loan_rules')
      .addColumn('reader_kind', 'text', (column) => column.primaryKey())
      .addColumn('max_items', 'integer', (column) => column.notNull().check(sql`max_items between 1 and 100`))
      .addColumn('loan_days', 'integer', (column) => column.notNull().check(sql`loan_days between 1 and 365`))
      .addColumn('max_renewals', 'integer', (column) => column.notNull().check(sql`max_renewals between 0 and 10`))
      .addColumn('fine_per_day', 'integer', (column) => column.notNull().defaultTo(0).check(sql`fine_per_day >= 0`))
      .addCheckConstraint('library_loan_rules_kind_check', sql`reader_kind in ('staff', 'student')`)
      .execute();
    await sql`insert into library_loan_rules (reader_kind, max_items, loan_days, max_renewals, fine_per_day)
      values ('staff', 10, 30, 2, 0), ('student', 3, 14, 1, 0) on conflict do nothing`.execute(database);

    await database.schema
      .createTable('library_categories')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) =>
        column
          .notNull()
          .unique()
          .check(sql`char_length(code) between 1 and 30`),
      )
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 200`))
      // Không cho mượn về (đọc tại chỗ): báo, tạp chí, tài liệu số
      .addColumn('lendable', 'boolean', (column) => column.notNull().defaultTo(true))
      .addColumn('order_no', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('library_categories_status_check', sql`status in ('active', 'inactive')`)
      .execute();
    await sql`insert into library_categories (code, name, lendable, order_no) values
      ('SGK', 'Sách giáo khoa', true, 1),
      ('SGV', 'Sách giáo viên', true, 2),
      ('STK', 'Sách tham khảo', true, 3),
      ('TRUYEN', 'Truyện, sách đọc thêm', true, 4),
      ('BAO', 'Báo, tạp chí', false, 5),
      ('TLS', 'Tài liệu số', false, 6) on conflict do nothing`.execute(database);

    await database.schema
      .createTable('library_titles')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('category_id', 'uuid', (column) => column.notNull().references('library_categories.id'))
      .addColumn('title', 'text', (column) => column.notNull().check(sql`char_length(title) between 1 and 300`))
      .addColumn('authors', 'text', (column) => column.check(sql`char_length(authors) <= 300`))
      .addColumn('publisher', 'text', (column) => column.check(sql`char_length(publisher) <= 200`))
      .addColumn('publish_year', 'smallint', (column) => column.check(sql`publish_year between 1000 and 2200`))
      .addColumn('isbn', 'text', (column) => column.check(sql`char_length(isbn) <= 20`))
      .addColumn('school_level', 'text', (column) => column.check(sql.raw(`school_level in (${SCHOOL_LEVELS})`)))
      .addColumn('grade_level', 'text')
      .addColumn('subject_id', 'uuid', (column) => column.references('subjects.id'))
      .addColumn('topic', 'text', (column) => column.check(sql`char_length(topic) <= 200`))
      .addColumn('language', 'text', (column) => column.notNull().defaultTo('vi'))
      .addColumn('shelf', 'text', (column) => column.check(sql`char_length(shelf) <= 50`))
      .addColumn('description', 'text', (column) => column.check(sql`char_length(description) <= 2000`))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('library_titles_status_check', sql`status in ('active', 'retired')`)
      .execute();
    await database.schema.createIndex('library_titles_category_index').on('library_titles').column('category_id').execute();
    await database.schema.createIndex('library_titles_grade_index').on('library_titles').column('grade_level').execute();

    await database.schema
      .createTable('library_title_files')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('title_id', 'uuid', (column) => column.notNull().references('library_titles.id'))
      .addColumn('file_name', 'text', (column) => column.notNull())
      .addColumn('content_type', 'text', (column) => column.notNull())
      .addColumn('size_bytes', 'integer', (column) => column.notNull().check(sql`size_bytes > 0`))
      .addColumn('storage_key', 'text', (column) => column.notNull())
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema.createIndex('library_title_files_title_index').on('library_title_files').column('title_id').execute();

    await database.schema
      .createTable('library_copies')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('title_id', 'uuid', (column) => column.notNull().references('library_titles.id'))
      // Số đăng ký cá biệt, cũng là nội dung mã vạch và mã QR của tem
      .addColumn('copy_no', 'text', (column) => column.notNull().unique())
      .addColumn('source', 'text', (column) => column.notNull().defaultTo('purchase'))
      .addColumn('price', 'integer', (column) => column.check(sql`price >= 0`))
      .addColumn('acquired_on', 'date')
      .addColumn('shelf', 'text', (column) => column.check(sql`char_length(shelf) <= 50`))
      .addColumn('condition', 'text', (column) => column.notNull().defaultTo('good'))
      .addColumn('note', 'text', (column) => column.check(sql`char_length(note) <= 500`))
      .addColumn('disposed_on', 'date')
      .addColumn('disposal_reason', 'text', (column) => column.check(sql`char_length(disposal_reason) <= 500`))
      .addColumn('disposed_by_name', 'text')
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('library_copies_source_check', sql`source in ('purchase', 'donation', 'supplied')`)
      .addCheckConstraint('library_copies_condition_check', sql`condition in ('good', 'damaged', 'lost', 'disposed')`)
      .execute();
    await database.schema.createIndex('library_copies_title_index').on('library_copies').column('title_id').execute();

    await database.schema
      .createTable('library_readers')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('reader_kind', 'text', (column) => column.notNull())
      .addColumn('staff_id', 'uuid', (column) => column.references('staff.id'))
      .addColumn('child_id', 'uuid', (column) => column.references('children.id'))
      .addColumn('card_no', 'text', (column) => column.notNull().unique())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('locked_reason', 'text', (column) => column.check(sql`char_length(locked_reason) <= 500`))
      .addColumn('issued_on', 'date', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('library_readers_kind_check', sql`reader_kind in ('staff', 'student')`)
      .addCheckConstraint('library_readers_status_check', sql`status in ('active', 'locked')`)
      .addCheckConstraint(
        'library_readers_person_check',
        sql`(reader_kind = 'staff' and staff_id is not null and child_id is null)
          or (reader_kind = 'student' and child_id is not null and staff_id is null)`,
      )
      .execute();
    await sql`create unique index library_readers_staff_unique on library_readers (staff_id) where staff_id is not null`.execute(
      database,
    );
    await sql`create unique index library_readers_child_unique on library_readers (child_id) where child_id is not null`.execute(
      database,
    );

    await database.schema
      .createTable('library_loans')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('copy_id', 'uuid', (column) => column.notNull().references('library_copies.id'))
      .addColumn('reader_id', 'uuid', (column) => column.notNull().references('library_readers.id'))
      .addColumn('class_id', 'uuid', (column) => column.references('classes.id'))
      .addColumn('kind', 'text', (column) => column.notNull().defaultTo('regular'))
      .addColumn('loaned_on', 'date', (column) => column.notNull())
      .addColumn('due_on', 'date', (column) => column.notNull())
      .addColumn('returned_on', 'date')
      .addColumn('renewals', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('open'))
      .addColumn('return_condition', 'text')
      .addColumn('fine_amount', 'integer', (column) => column.notNull().defaultTo(0).check(sql`fine_amount >= 0`))
      .addColumn('note', 'text', (column) => column.check(sql`char_length(note) <= 500`))
      .addColumn('loaned_by', 'uuid')
      .addColumn('loaned_by_name', 'text')
      .addColumn('received_by_name', 'text')
      .addColumn('reminded_on', 'date')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('library_loans_kind_check', sql`kind in ('regular', 'textbook')`)
      .addCheckConstraint('library_loans_status_check', sql`status in ('open', 'returned', 'lost')`)
      .addCheckConstraint('library_loans_range_check', sql`due_on >= loaned_on`)
      .addCheckConstraint(
        'library_loans_return_condition_check',
        sql`return_condition is null or return_condition in ('good', 'damaged', 'lost')`,
      )
      .execute();
    await sql`create unique index library_loans_open_unique on library_loans (copy_id) where status = 'open'`.execute(
      database,
    );
    await database.schema.createIndex('library_loans_reader_index').on('library_loans').column('reader_id').execute();
    await database.schema.createIndex('library_loans_due_index').on('library_loans').column('due_on').execute();

    await database.schema
      .createTable('library_reservations')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('title_id', 'uuid', (column) => column.notNull().references('library_titles.id'))
      .addColumn('reader_id', 'uuid', (column) => column.notNull().references('library_readers.id'))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('waiting'))
      .addColumn('copy_id', 'uuid', (column) => column.references('library_copies.id'))
      .addColumn('reserved_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('ready_on', 'date')
      .addColumn('expires_on', 'date')
      .addColumn('closed_at', 'timestamptz')
      .addColumn('created_by', 'uuid')
      .addCheckConstraint(
        'library_reservations_status_check',
        sql`status in ('waiting', 'ready', 'fulfilled', 'cancelled', 'expired')`,
      )
      .execute();
    await sql`create unique index library_reservations_open_unique on library_reservations (title_id, reader_id)
      where status in ('waiting', 'ready')`.execute(database);

    await database.schema
      .createTable('library_textbook_sets')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 200`))
      .addColumn('grade_level', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('library_textbook_sets_status_check', sql`status in ('active', 'inactive')`)
      .execute();
    await database.schema
      .createTable('library_textbook_set_titles')
      .addColumn('set_id', 'uuid', (column) => column.notNull().references('library_textbook_sets.id').onDelete('cascade'))
      .addColumn('title_id', 'uuid', (column) => column.notNull().references('library_titles.id'))
      .addPrimaryKeyConstraint('library_textbook_set_titles_pk', ['set_id', 'title_id'])
      .execute();

    await database.schema
      .createTable('library_stocktakes')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 200`))
      // Kiểm kê một kệ; trống là cả kho
      .addColumn('shelf', 'text')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('open'))
      .addColumn('started_by_name', 'text', (column) => column.notNull())
      .addColumn('started_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('closed_at', 'timestamptz')
      .addColumn('closed_by_name', 'text')
      .addCheckConstraint('library_stocktakes_status_check', sql`status in ('open', 'closed')`)
      .execute();
    await database.schema
      .createTable('library_stocktake_items')
      .addColumn('stocktake_id', 'uuid', (column) => column.notNull().references('library_stocktakes.id'))
      .addColumn('copy_id', 'uuid', (column) => column.notNull().references('library_copies.id'))
      .addColumn('scanned_by_name', 'text', (column) => column.notNull())
      .addColumn('scanned_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addPrimaryKeyConstraint('library_stocktake_items_pk', ['stocktake_id', 'copy_id'])
      .execute();

    await database.schema
      .createTable('library_indicators')
      .addColumn('code', 'text', (column) => column.primaryKey())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('threshold', sql`numeric(12,2)`)
      .addColumn('enabled', 'boolean', (column) => column.notNull().defaultTo(true))
      .addColumn('order_no', 'integer', (column) => column.notNull().defaultTo(0))
      .execute();
    await sql`insert into library_indicators (code, name, order_no) values
      ('textbooks_per_student', 'Số bản sách giáo khoa trên một học sinh', 1),
      ('reference_per_student', 'Số bản sách tham khảo trên một học sinh', 2),
      ('teacher_books_per_teacher', 'Số bản sách giáo viên, tham khảo trên một giáo viên', 3),
      ('titles_total', 'Tổng số đầu ấn phẩm đang dùng', 4),
      ('copies_per_student', 'Số bản sách trên một học sinh', 5),
      ('reader_rate', 'Tỉ lệ bạn đọc có mượn sách trong năm học (%)', 6),
      ('digital_titles', 'Số tài liệu số', 7) on conflict do nothing`.execute(database);

    await database.schema
      .createTable('library_counters')
      .addColumn('name', 'text', (column) => column.primaryKey())
      .addColumn('value', 'integer', (column) => column.notNull().defaultTo(0))
      .execute();
  },
  async down(database) {
    for (const table of [
      'library_counters',
      'library_indicators',
      'library_stocktake_items',
      'library_stocktakes',
      'library_textbook_set_titles',
      'library_textbook_sets',
      'library_reservations',
      'library_loans',
      'library_readers',
      'library_copies',
      'library_title_files',
      'library_titles',
      'library_categories',
      'library_loan_rules',
      'library_settings',
    ]) {
      await database.schema.dropTable(table).execute();
    }
  },
};
