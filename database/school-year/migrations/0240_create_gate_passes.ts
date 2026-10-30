import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Điểm danh bằng thẻ ở cổng, lát L1 (YCTD-389):
// - gate_cards: thẻ QR của học sinh; mã ngẫu nhiên không chứa thông tin cá nhân, mỗi học sinh một thẻ còn hiệu lực, cấp lại thì
//   thu hồi thẻ cũ;
// - gate_passes: lượt qua cổng (vào, ra). Lượt từ thẻ có độ tin cậy 1; trạng thái xem lại dành cho lượt từ camera ở lát sau.
//   `external_id` chống ghi trùng khi thiết bị gửi lại (lát L2).
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('gate_cards')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id').onDelete('cascade'))
      .addColumn('code', 'text', (column) =>
        column
          .notNull()
          .unique()
          .check(sql`code ~ '^[A-Z2-7]{16}$'`),
      )
      .addColumn('issued_by', 'uuid', (column) => column.notNull())
      .addColumn('issued_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('revoked_at', 'timestamptz')
      .addColumn('revoked_by', 'uuid')
      .execute();
    await sql`create unique index gate_cards_active_child on gate_cards (child_id) where revoked_at is null`.execute(
      database,
    );

    await database.schema
      .createTable('gate_passes')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id').onDelete('cascade'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull())
      .addColumn('direction', 'text', (column) => column.notNull().check(sql`direction in ('in', 'out')`))
      .addColumn('passed_at', 'timestamptz', (column) => column.notNull())
      .addColumn('method', 'text', (column) =>
        column.notNull().check(sql`method in ('qr', 'rfid', 'device', 'camera')`),
      )
      .addColumn('confidence', sql`numeric(4, 3)`, (column) =>
        column
          .notNull()
          .defaultTo(1)
          .check(sql`confidence > 0 and confidence <= 1`),
      )
      .addColumn('review_status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('confirmed')
          .check(sql`review_status in ('confirmed', 'needs_review', 'rejected')`),
      )
      .addColumn('gate_card_id', 'uuid', (column) => column.references('gate_cards.id'))
      .addColumn('recorded_by', 'uuid')
      .addColumn('external_id', 'text', (column) => column.unique())
      .addColumn('reviewed_by', 'uuid')
      .addColumn('reviewed_at', 'timestamptz')
      .addColumn('review_note', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('gate_passes_child_time')
      .on('gate_passes')
      .columns(['child_id', 'passed_at'])
      .execute();
    await database.schema
      .createIndex('gate_passes_unit_time')
      .on('gate_passes')
      .columns(['org_unit_id', 'passed_at'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('gate_passes').execute();
    await database.schema.dropTable('gate_cards').execute();
  },
};
