import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Hộp thư chuyển trường giữa các trường trên nền tảng, lát L2 (YCTD-390; BM-241, BM-242). Mỗi trường bật hay tắt nhận, gửi hồ sơ
// chuyển trường trong hệ thống (mặc định tắt); mỗi trường một cặp khóa X25519 để nhận gói và một cặp khóa Ed25519 để ký gói, khóa
// riêng bọc bằng khóa gốc của nền tảng. Hộp thư chỉ giữ gói đã mã hóa và phần mô tả, không có dữ liệu cá nhân dạng rõ; gói xóa
// sau 30 ngày kể từ khi tiếp nhận, từ chối, thu hồi, hoặc khi hết hạn chưa ai tải
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('school_transfer_settings')
      .addColumn('school_id', 'uuid', (column) => column.primaryKey().references('schools.id').onDelete('cascade'))
      .addColumn('enabled', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('updated_by_name', 'text')
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createTable('school_transfer_keys')
      .addColumn('school_id', 'uuid', (column) => column.primaryKey().references('schools.id').onDelete('cascade'))
      .addColumn('encryption_public_key', 'text', (column) => column.notNull())
      .addColumn('encryption_private_key_encrypted', 'text', (column) => column.notNull())
      .addColumn('signing_public_key', 'text', (column) => column.notNull())
      .addColumn('signing_private_key_encrypted', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createTable('transfer_mailbox')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('kind', 'text', (column) => column.notNull().check(sql`kind in ('student_transfer')`))
      .addColumn('package_code', 'text', (column) => column.notNull().unique())
      .addColumn('from_school_id', 'uuid', (column) => column.notNull().references('schools.id').onDelete('cascade'))
      .addColumn('to_school_id', 'uuid', (column) => column.notNull().references('schools.id').onDelete('cascade'))
      .addColumn('state', 'text', (column) =>
        column
          .notNull()
          .defaultTo('sent')
          .check(sql`state in ('sent', 'opened', 'accepted', 'rejected', 'revoked', 'expired')`),
      )
      // Gói đã mã hóa bằng mật khẩu ngẫu nhiên; mật khẩu bọc bằng khóa công khai của trường đến; trống khi đã xóa gói
      .addColumn('envelope', 'bytea')
      .addColumn('wrapped_secret', 'jsonb')
      .addColumn('envelope_sha256', 'text', (column) => column.notNull())
      .addColumn('signature', 'text', (column) => column.notNull())
      .addColumn('decision_note', 'text')
      .addColumn('sent_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('decided_at', 'timestamptz')
      .addColumn('expires_at', 'timestamptz', (column) => column.notNull())
      .addColumn('purge_after', 'timestamptz')
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('transfer_mailbox_to_index')
      .on('transfer_mailbox')
      .columns(['to_school_id', 'state'])
      .execute();
    await database.schema
      .createIndex('transfer_mailbox_from_index')
      .on('transfer_mailbox')
      .columns(['from_school_id', 'state'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('transfer_mailbox').execute();
    await database.schema.dropTable('school_transfer_keys').execute();
    await database.schema.dropTable('school_transfer_settings').execute();
  },
};
