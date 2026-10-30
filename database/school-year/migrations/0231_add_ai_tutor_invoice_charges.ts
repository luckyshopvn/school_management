import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Dòng thu Gia sư AI trên hóa đơn học phí của kỳ, lát L1a trường bán (YCTD-383). Lần tính học phí của kỳ lập dòng `ai_tutor` cho mỗi
// lần mua gói của trường và mỗi lần nâng gói chưa thu; `ai_tutor_invoice_charges` ghi lần mua hoặc lần nâng nào đã thu ở dòng nào để
// không thu trùng, xóa theo dòng khi tính lại hóa đơn nháp. Lần mua, lần nâng ở cơ sở dữ liệu hệ thống nên không có khóa ngoại
export const migration: Migration = {
  async up(database) {
    await sql`alter table invoice_items drop constraint invoice_items_type_check`.execute(database);
    await sql`alter table invoice_items add constraint invoice_items_type_check
      check (item_type in ('tuition', 'service', 'opening', 'extracurricular', 'tutoring', 'ai_tutor'))`.execute(
      database,
    );

    await database.schema
      .createTable('ai_tutor_invoice_charges')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('invoice_item_id', 'uuid', (column) =>
        column.notNull().references('invoice_items.id').onDelete('cascade'),
      )
      .addColumn('child_id', 'uuid', (column) => column.notNull())
      // Lần mua ở `ai_tutor_subscriptions` (cơ sở dữ liệu hệ thống)
      .addColumn('subscription_id', 'uuid', (column) => column.notNull())
      // Lần nâng ở `ai_tutor_upgrades`; trống là dòng thu của lần mua
      .addColumn('upgrade_id', 'uuid')
      .addColumn('amount', sql`numeric(14, 2)`, (column) => column.notNull().check(sql`amount >= 0`))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await sql`create unique index ai_tutor_invoice_charges_subscription_unique on ai_tutor_invoice_charges
      (subscription_id) where upgrade_id is null`.execute(database);
    await sql`create unique index ai_tutor_invoice_charges_upgrade_unique on ai_tutor_invoice_charges
      (upgrade_id) where upgrade_id is not null`.execute(database);
    await database.schema
      .createIndex('ai_tutor_invoice_charges_item_index')
      .on('ai_tutor_invoice_charges')
      .column('invoice_item_id')
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('ai_tutor_invoice_charges').execute();
    await sql`delete from invoice_items where item_type = 'ai_tutor'`.execute(database);
    await sql`alter table invoice_items drop constraint invoice_items_type_check`.execute(database);
    await sql`alter table invoice_items add constraint invoice_items_type_check
      check (item_type in ('tuition', 'service', 'opening', 'extracurricular', 'tutoring'))`.execute(database);
  },
};
