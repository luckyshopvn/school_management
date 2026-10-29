import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Hồ sơ con do phụ huynh tạo ở chợ gia sư (DT-27 phần 27f, YCTD-256; tài liệu 47 mục 19.3 "trẻ em trước"): dữ liệu tối thiểu là tên
// hiển thị, năm sinh, cấp học, lớp; không thu số định danh, ngày sinh đầy đủ, ảnh của trẻ. Trẻ không có tài khoản (GD-135). Liên kết
// tùy chọn với trường (`market_school_links`) chỉ giữ mã trường, mã học sinh dạng băm và lớp, có đồng ý của phụ huynh
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('market_children')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('parent_account_id', 'uuid', (column) =>
        column.notNull().references('market_accounts.id').onDelete('cascade'),
      )
      .addColumn('display_name', 'text', (column) => column.notNull())
      .addColumn('birth_year', 'smallint', (column) => column.notNull())
      .addColumn('school_level', 'text', (column) => column.notNull())
      .addColumn('grade', 'smallint', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('market_children_display_name_check', sql`length(display_name) between 1 and 40`)
      .addCheckConstraint('market_children_birth_year_check', sql`birth_year between 2000 and 2100`)
      .addCheckConstraint('market_children_school_level_check', sql`school_level in ('TH', 'THCS', 'THPT')`)
      .addCheckConstraint('market_children_grade_check', sql`grade between 1 and 12`)
      .execute();
    await database.schema
      .createIndex('market_children_parent_index')
      .on('market_children')
      .column('parent_account_id')
      .execute();
    await database.schema
      .alterTable('market_consents')
      .addForeignKeyConstraint('market_consents_child_fkey', ['child_id'], 'market_children', ['id'], (constraint) =>
        constraint.onDelete('cascade'),
      )
      .execute();

    await database.schema
      .createTable('market_school_links')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('market_children.id').onDelete('cascade'))
      .addColumn('school_code', 'text', (column) => column.notNull())
      .addColumn('student_hash', 'text', (column) => column.notNull())
      .addColumn('grade', 'smallint', (column) => column.notNull())
      .addColumn('linked_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('revoked_at', 'timestamptz')
      .addCheckConstraint('market_school_links_grade_check', sql`grade between 1 and 12`)
      .execute();
    await sql`create unique index market_school_links_active_unique on market_school_links (child_id) where revoked_at is null`.execute(
      database,
    );
  },
  async down(database) {
    await database.schema.dropTable('market_school_links').execute();
    await database.schema.alterTable('market_consents').dropConstraint('market_consents_child_fkey').execute();
    await database.schema.dropTable('market_children').execute();
  },
};
