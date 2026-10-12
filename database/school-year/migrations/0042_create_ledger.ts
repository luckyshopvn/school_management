import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Sổ kế toán kép theo chế độ kế toán hành chính, sự nghiệp (G3-06, N5; Q-01, Q-140; BR-95; YCTD-88): hệ thống tài khoản
// dùng chung toàn trường, quy tắc ghi sổ theo loại chứng từ và khoản mục thu chi, bút toán và dòng bút toán theo đơn vị.
// Danh mục tài khoản khởi tạo theo hệ thống tài khoản của Thông tư 24/2024/TT-BTC (tài khoản cấp 1 trong bảng, thêm vài
// tài khoản cấp 2 hay dùng); kế toán trưởng kiểm tra lại và thêm tài khoản chi tiết khi dùng
type NormalBalance = 'debit' | 'credit' | 'both';

export const DEFAULT_LEDGER_ACCOUNTS: Array<[code: string, name: string, normal: NormalBalance, parent?: string]> = [
  ['111', 'Tiền mặt', 'debit'],
  ['112', 'Tiền gửi ngân hàng, kho bạc', 'debit'],
  ['113', 'Tiền đang chuyển', 'debit'],
  ['121', 'Đầu tư tài chính', 'debit'],
  ['131', 'Phải thu khách hàng', 'both'],
  ['133', 'Thuế giá trị gia tăng được khấu trừ', 'debit'],
  ['136', 'Phải thu nội bộ', 'debit'],
  ['137', 'Tạm chi', 'debit'],
  ['138', 'Phải thu khác', 'debit'],
  ['141', 'Tạm ứng', 'debit'],
  ['152', 'Nguyên liệu, vật liệu', 'debit'],
  ['153', 'Công cụ, dụng cụ', 'debit'],
  ['154', 'Chi phí sản xuất, kinh doanh, dịch vụ dở dang', 'debit'],
  ['155', 'Sản phẩm', 'debit'],
  ['156', 'Hàng hóa', 'debit'],
  ['211', 'Tài sản cố định hữu hình', 'debit'],
  ['213', 'Tài sản cố định vô hình', 'debit'],
  ['214', 'Khấu hao và hao mòn lũy kế tài sản cố định', 'credit'],
  ['241', 'Xây dựng cơ bản dở dang', 'debit'],
  ['242', 'Chi phí trả trước', 'debit'],
  ['248', 'Đặt cọc, ký quỹ, ký cược', 'debit'],
  ['331', 'Phải trả cho người bán', 'both'],
  ['332', 'Các khoản phải nộp theo lương', 'credit'],
  ['333', 'Các khoản phải nộp nhà nước', 'credit'],
  ['3335', 'Thuế thu nhập cá nhân', 'credit', '333'],
  ['334', 'Phải trả người lao động', 'credit'],
  ['336', 'Phải trả nội bộ', 'credit'],
  ['337', 'Tạm thu', 'credit'],
  ['3371', 'Kinh phí hoạt động bằng tiền', 'credit', '337'],
  ['338', 'Phải trả khác', 'credit'],
  ['348', 'Nhận đặt cọc, ký quỹ, ký cược', 'credit'],
  ['353', 'Các quỹ đặc thù', 'credit'],
  ['366', 'Các khoản nhận trước chưa ghi thu', 'credit'],
  ['411', 'Nguồn vốn kinh doanh', 'credit'],
  ['421', 'Thặng dư (thâm hụt) lũy kế', 'both'],
  ['431', 'Các quỹ', 'credit'],
  ['468', 'Nguồn cải cách tiền lương', 'credit'],
  ['511', 'Thu hoạt động do ngân sách nhà nước cấp', 'credit'],
  ['512', 'Thu viện trợ, vay nợ nước ngoài', 'credit'],
  ['514', 'Thu phí được khấu trừ, để lại', 'credit'],
  ['515', 'Doanh thu tài chính', 'credit'],
  ['531', 'Doanh thu hoạt động sản xuất, kinh doanh, dịch vụ', 'credit'],
  ['611', 'Chi phí hoạt động', 'debit'],
  ['612', 'Chi phí từ nguồn viện trợ, vay nợ nước ngoài', 'debit'],
  ['614', 'Chi phí hoạt động thu phí', 'debit'],
  ['615', 'Chi phí tài chính', 'debit'],
  ['632', 'Giá vốn hàng bán', 'debit'],
  ['642', 'Chi phí quản lý của hoạt động sản xuất, kinh doanh, dịch vụ', 'debit'],
  ['652', 'Chi phí chưa xác định đối tượng chịu chi phí', 'debit'],
  ['711', 'Thu nhập khác', 'credit'],
  ['811', 'Chi phí khác', 'debit'],
  ['821', 'Chi phí thuế thu nhập doanh nghiệp', 'debit'],
  ['911', 'Xác định kết quả', 'both'],
];

// Quy tắc mặc định: [loại chứng từ, tài khoản Nợ, tài khoản Có]; null là tài khoản tiền của quỹ trên chứng từ (lấy theo
// quy tắc money_cash hoặc money_bank)
export const DEFAULT_POSTING_RULES: Array<[documentType: string, debit: string | null, credit: string | null]> = [
  ['money_cash', '111', null],
  ['money_bank', '112', null],
  ['receipt', null, '131'],
  ['receipt_staff', null, '334'],
  ['payment', '642', null],
  ['payment_refund', '131', null],
  ['payment_payroll', '334', null],
  ['invoice', '131', '531'],
  ['invoice_opening', '131', '421'],
  ['discount', '531', '131'],
  ['invoice_adjustment', '131', '531'],
  ['payroll_income', '642', '334'],
  ['payroll_deduction', '334', '332'],
  ['payroll_tax', '334', '3335'],
  ['settlement', '642', '334'],
];

export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('ledger_accounts')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('parent_id', 'uuid', (column) => column.references('ledger_accounts.id'))
      .addColumn('normal_balance', 'text', (column) => column.notNull())
      // Tài khoản khởi tạo theo chế độ kế toán: không đổi tên, không ngừng dùng; tài khoản chi tiết do kế toán thêm
      .addColumn('is_system', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('ledger_accounts_code_check', sql`code ~ '^[0-9]{3,12}$'`)
      .addCheckConstraint('ledger_accounts_normal_balance_check', sql`normal_balance in ('debit', 'credit', 'both')`)
      .addCheckConstraint('ledger_accounts_status_check', sql`status in ('active', 'inactive')`)
      .execute();

    await database.schema
      .createTable('ledger_posting_rules')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('document_type', 'text', (column) => column.notNull())
      // Trống là quy tắc chung của loại chứng từ; có khoản mục thì dùng riêng cho phiếu thu, phiếu chi của khoản mục đó
      .addColumn('category_id', 'uuid', (column) => column.references('cashflow_categories.id'))
      .addColumn('debit_account_id', 'uuid', (column) => column.references('ledger_accounts.id'))
      .addColumn('credit_account_id', 'uuid', (column) => column.references('ledger_accounts.id'))
      .addColumn('updated_by', 'uuid')
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'ledger_posting_rules_account_check',
        sql`debit_account_id is not null or credit_account_id is not null`,
      )
      .addUniqueConstraint(
        'ledger_posting_rules_type_category_unique',
        ['document_type', 'category_id'],
        (constraint) => constraint.nullsNotDistinct(),
      )
      .execute();

    await database.schema
      .createTable('journal_entries')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      // Dạng BT-000001, một dãy số toàn trường trong năm học
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('entry_date', 'date', (column) => column.notNull())
      .addColumn('description', 'text', (column) => column.notNull())
      .addColumn('entry_type', 'text', (column) => column.notNull())
      .addColumn('source_type', 'text')
      .addColumn('source_id', 'uuid')
      .addColumn('source_code', 'text')
      .addColumn('total_amount', 'bigint', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('posted'))
      .addColumn('request_key', 'uuid', (column) => column.unique())
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('voided_by', 'uuid')
      .addColumn('voided_at', 'timestamptz')
      .addColumn('void_reason', 'text')
      .addCheckConstraint('journal_entries_type_check', sql`entry_type in ('auto', 'manual', 'opening')`)
      .addCheckConstraint('journal_entries_status_check', sql`status in ('posted', 'voided')`)
      .addCheckConstraint('journal_entries_amount_check', sql`total_amount > 0`)
      .addCheckConstraint(
        'journal_entries_source_check',
        sql`(entry_type = 'manual') = (source_type is null) and (source_type is null) = (source_id is null)`,
      )
      .addCheckConstraint('journal_entries_void_check', sql`status = 'posted' or entry_type = 'manual'`)
      // Mỗi chứng từ ghi sổ một lần cho mỗi đơn vị (bảng lương toàn trường tách theo đơn vị của phiếu lương)
      .addUniqueConstraint('journal_entries_source_unique', ['source_type', 'source_id', 'org_unit_id'])
      .execute();
    await database.schema
      .createIndex('journal_entries_unit_date_index')
      .on('journal_entries')
      .columns(['org_unit_id', 'entry_date'])
      .execute();

    await database.schema
      .createTable('journal_lines')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('entry_id', 'uuid', (column) => column.notNull().references('journal_entries.id'))
      .addColumn('line_no', 'integer', (column) => column.notNull())
      .addColumn('account_id', 'uuid', (column) => column.notNull().references('ledger_accounts.id'))
      .addColumn('debit', 'bigint', (column) => column.notNull().defaultTo(0))
      .addColumn('credit', 'bigint', (column) => column.notNull().defaultTo(0))
      .addColumn('description', 'text')
      .addCheckConstraint('journal_lines_amount_check', sql`debit >= 0 and credit >= 0 and (debit = 0) <> (credit = 0)`)
      .addUniqueConstraint('journal_lines_entry_line_unique', ['entry_id', 'line_no'])
      .execute();
    await database.schema.createIndex('journal_lines_account_index').on('journal_lines').column('account_id').execute();

    const ids = new Map<string, string>();
    for (const [code, name, normal, parent] of DEFAULT_LEDGER_ACCOUNTS) {
      const row = await database
        .insertInto('ledger_accounts')
        .values({
          code,
          name,
          normal_balance: normal,
          parent_id: parent ? (ids.get(parent) ?? null) : null,
          is_system: true,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      ids.set(code, (row as { id: string }).id);
    }
    for (const [documentType, debit, credit] of DEFAULT_POSTING_RULES) {
      await database
        .insertInto('ledger_posting_rules')
        .values({
          document_type: documentType,
          debit_account_id: debit ? (ids.get(debit) ?? null) : null,
          credit_account_id: credit ? (ids.get(credit) ?? null) : null,
        })
        .execute();
    }
  },
  async down(database) {
    for (const table of ['journal_lines', 'journal_entries', 'ledger_posting_rules', 'ledger_accounts']) {
      await database.schema.dropTable(table).execute();
    }
  },
};
