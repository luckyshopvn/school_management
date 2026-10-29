import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Thu phí chương trình gia sư trong trường (DT-27 phần 27c, YCTD-253; tài liệu 47 mục 19.5). Claude tự chọn theo ủy quyền của Eric
// ngày 2026-10-11 ở chỗ kế hoạch chưa chốt:
// - giá đặt ở chương trình `enrichment` có thu: theo buổi (`per_session`, thu các buổi chưa hủy đến hết kỳ) hoặc trọn gói
//   (`per_program`, thu một lần); `curriculum` không có giá (ràng buộc của bảng và hàm thuần ở máy chủ);
// - khoản thu là dòng `tutoring` trên hóa đơn chính của kỳ, do lần tính học phí của kỳ lập (cùng cách phí ngoại khóa); bảng
//   `tutoring_charge_sessions` ghi buổi nào đã thu ở dòng nào để không thu trùng, xóa theo dòng khi tính lại nháp;
// - buổi bị hủy sau khi đã thu thành khoản trừ (`tutoring_credits`): mặc định trừ vào khoản gia sư kỳ sau
//   (`tutoring_credit_applications`), hoặc theo cấu hình của chương trình lập điều chỉnh giảm chờ duyệt trên hóa đơn còn nợ (luồng
//   điều chỉnh hóa đơn hiện có); khoản trừ không còn kỳ sau để trừ thì kế toán hoàn qua luồng phiếu chi hoàn hiện có rồi đóng.
export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('tutoring_programs')
      .addColumn('fee_basis', 'text')
      .addColumn('fee_amount', 'bigint')
      .addColumn('cancel_refund', 'text', (column) => column.notNull().defaultTo('deduct_next'))
      .execute();
    await sql`alter table tutoring_programs
      add constraint tutoring_programs_fee_basis_check check (fee_basis is null or fee_basis in ('per_session', 'per_program')),
      add constraint tutoring_programs_fee_check check ((fee_basis is null) = (fee_amount is null)
        and (fee_amount is null or fee_amount > 0) and (charges_fee or fee_amount is null)),
      add constraint tutoring_programs_cancel_refund_check check (cancel_refund in ('deduct_next', 'adjust_invoice'))`.execute(
      database,
    );

    await sql`alter table invoice_items drop constraint invoice_items_type_check`.execute(database);
    await sql`alter table invoice_items add constraint invoice_items_type_check
      check (item_type in ('tuition', 'service', 'opening', 'extracurricular', 'tutoring'))`.execute(database);
    await database.schema
      .alterTable('invoice_items')
      .addColumn('tutoring_registration_id', 'uuid', (column) => column.references('tutoring_registrations.id'))
      .execute();

    await database.schema
      .createTable('tutoring_charge_sessions')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('invoice_item_id', 'uuid', (column) =>
        column.notNull().references('invoice_items.id').onDelete('cascade'),
      )
      .addColumn('registration_id', 'uuid', (column) => column.notNull().references('tutoring_registrations.id'))
      .addColumn('session_id', 'uuid', (column) => column.references('tutoring_sessions.id'))
      .addColumn('amount', 'bigint', (column) => column.notNull())
      // Trọn gói: số buổi chưa hủy lúc thu, để chia khoản trừ khi có buổi bị hủy
      .addColumn('sessions_total', 'integer')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('tutoring_charge_sessions_amount_check', sql`amount >= 0`)
      .addCheckConstraint(
        'tutoring_charge_sessions_total_check',
        sql`(session_id is null) = (sessions_total is not null) and (sessions_total is null or sessions_total > 0)`,
      )
      .execute();
    await sql`create unique index tutoring_charge_sessions_session_unique on tutoring_charge_sessions
      (registration_id, session_id) where session_id is not null`.execute(database);
    await sql`create unique index tutoring_charge_sessions_program_unique on tutoring_charge_sessions
      (registration_id) where session_id is null`.execute(database);
    await database.schema
      .createIndex('tutoring_charge_sessions_item_index')
      .on('tutoring_charge_sessions')
      .column('invoice_item_id')
      .execute();

    await database.schema
      .createTable('tutoring_credits')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('registration_id', 'uuid', (column) => column.notNull().references('tutoring_registrations.id'))
      .addColumn('session_id', 'uuid', (column) => column.notNull().references('tutoring_sessions.id'))
      .addColumn('charged_invoice_id', 'uuid', (column) => column.notNull().references('invoices.id'))
      .addColumn('amount', 'bigint', (column) => column.notNull())
      .addColumn('reason', 'text', (column) => column.notNull())
      .addColumn('mode', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('open'))
      .addColumn('invoice_adjustment_id', 'uuid', (column) => column.references('invoice_adjustments.id'))
      .addColumn('closed_note', 'text')
      .addColumn('closed_by_name', 'text')
      .addColumn('closed_at', 'timestamptz')
      .addColumn('created_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('tutoring_credits_amount_check', sql`amount > 0`)
      .addCheckConstraint('tutoring_credits_mode_check', sql`mode in ('deduct_next', 'adjust_invoice')`)
      .addCheckConstraint('tutoring_credits_status_check', sql`status in ('open', 'adjusted', 'closed')`)
      .addCheckConstraint(
        'tutoring_credits_adjusted_check',
        sql`(status = 'adjusted') = (invoice_adjustment_id is not null)`,
      )
      .addUniqueConstraint('tutoring_credits_session_unique', ['registration_id', 'session_id'])
      .execute();
    await database.schema
      .createIndex('tutoring_credits_child_index')
      .on('tutoring_credits')
      .column('child_id')
      .execute();

    await database.schema
      .createTable('tutoring_credit_applications')
      .addColumn('credit_id', 'uuid', (column) =>
        column.notNull().references('tutoring_credits.id').onDelete('cascade'),
      )
      .addColumn('invoice_item_id', 'uuid', (column) =>
        column.notNull().references('invoice_items.id').onDelete('cascade'),
      )
      .addColumn('amount', 'bigint', (column) => column.notNull())
      .addPrimaryKeyConstraint('tutoring_credit_applications_pkey', ['credit_id', 'invoice_item_id'])
      .addCheckConstraint('tutoring_credit_applications_amount_check', sql`amount > 0`)
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('tutoring_credit_applications').execute();
    await database.schema.dropTable('tutoring_credits').execute();
    await database.schema.dropTable('tutoring_charge_sessions').execute();
    await sql`delete from invoice_items where item_type = 'tutoring'`.execute(database);
    await database.schema.alterTable('invoice_items').dropColumn('tutoring_registration_id').execute();
    await sql`alter table invoice_items drop constraint invoice_items_type_check`.execute(database);
    await sql`alter table invoice_items add constraint invoice_items_type_check
      check (item_type in ('tuition', 'service', 'opening', 'extracurricular'))`.execute(database);
    await sql`alter table tutoring_programs drop constraint tutoring_programs_cancel_refund_check,
      drop constraint tutoring_programs_fee_check, drop constraint tutoring_programs_fee_basis_check,
      drop column cancel_refund, drop column fee_amount, drop column fee_basis`.execute(database);
  },
};
