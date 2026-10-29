import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Cấu hình kết nối ngoài riêng từng trường (DT-SaaS phần S3, YCTD-195, tài liệu 47 mục 14.5): thay các khóa ở biến môi trường của
// cả bản triển khai. Mỗi kết nối một dòng; toàn bộ giá trị (cả giá trị không bí mật) là một đối tượng JSON mã hóa AES-256-GCM bằng
// khóa mã hóa của trường; `hints` giữ gợi ý hiển thị (bốn ký tự cuối của giá trị bí mật, giá trị không bí mật), không bao giờ trả lại
// giá trị đã lưu. Nằm ở cơ sở dữ liệu hệ thống của chính trường nên đi theo dữ liệu của trường khi xuất, chuyển cụm và được mã hóa
// lại cùng khi đổi khóa mã hóa của trường (cột `*_encrypted`, có cột `id`)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('integration_secrets')
      .addColumn('connector', 'text', (column) => column.primaryKey())
      .addColumn('id', 'uuid', (column) =>
        column
          .notNull()
          .unique()
          .defaultTo(sql`gen_random_uuid()`),
      )
      .addColumn('enabled', 'boolean', (column) => column.notNull().defaultTo(true))
      .addColumn('values_encrypted', 'text', (column) => column.notNull())
      .addColumn('hints', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_by', 'uuid')
      .addColumn('updated_by_name', 'text')
      .addCheckConstraint(
        'integration_secrets_connector_check',
        sql`connector in ('payos', 'sepay', 'casso', 'vnpay', 'vietqr', 'esms', 'zalo', 'facebook', 'storage')`,
      )
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('integration_secrets').execute();
  },
};
