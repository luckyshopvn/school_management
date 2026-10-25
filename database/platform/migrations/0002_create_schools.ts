import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Cơ sở dữ liệu nền tảng (DT-SaaS phần S1a, tài liệu 32 mục 14.4): danh sách trường, tên miền, cụm cơ sở dữ liệu, mô tả kết
// nối cơ sở dữ liệu của từng trường và khóa mã hóa dữ liệu trẻ của từng trường. Mật khẩu kết nối và khóa đều được mã hóa
// AES-256-GCM bằng khóa gốc của nền tảng (PLATFORM_MASTER_KEY), cơ sở dữ liệu không giữ bản rõ
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('school_clusters')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('name', 'text', (column) => column.notNull().unique())
      .addColumn('host', 'text', (column) => column.notNull())
      .addColumn('port', 'integer', (column) => column.notNull().defaultTo(5432))
      .addColumn('role', 'text', (column) => column.notNull().defaultTo('primary'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('school_clusters_role_check', sql`role in ('primary', 'replica')`)
      .addCheckConstraint('school_clusters_port_check', sql`port between 1 and 65535`)
      .execute();

    await database.schema
      .createTable('schools')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      // Mã trường: tên miền con và tiền tố khóa; không đổi sau khi tạo
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('provisioning'))
      .addColumn('data_class', 'text', (column) => column.notNull().defaultTo('synthetic'))
      .addColumn('cluster_id', 'uuid', (column) => column.references('school_clusters.id'))
      // Trống ở trường số 1 (bản triển khai hiện có) để khóa Redis, tệp hiện có còn đúng
      .addColumn('key_prefix', 'text', (column) => column.notNull().defaultTo(''))
      // Tiền tố tên cơ sở dữ liệu năm học của trường (trường số 1 giữ SCHOOL_YEAR_DATABASE_PREFIX hiện có)
      .addColumn('year_database_prefix', 'text', (column) => column.notNull())
      // Trường số 1 nhận từ bản đang chạy bằng lệnh adopt-existing
      .addColumn('legacy', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('notes', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('schools_code_check', sql`code ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$'`)
      .addCheckConstraint(
        'schools_status_check',
        sql`status in ('provisioning', 'trial', 'active', 'read_only', 'suspended', 'pending_deletion', 'deleted')`,
      )
      .addCheckConstraint('schools_data_class_check', sql`data_class in ('synthetic', 'consented', 'production')`)
      .execute();
    // Mỗi tiền tố khóa và tiền tố tên cơ sở dữ liệu thuộc đúng một trường, kể cả tiền tố trống của trường số 1
    await sql`create unique index schools_key_prefix_key on schools (key_prefix)`.execute(database);
    await sql`create unique index schools_year_database_prefix_key on schools (year_database_prefix)`.execute(database);

    await database.schema
      .createTable('school_domains')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('school_id', 'uuid', (column) => column.notNull().references('schools.id').onDelete('cascade'))
      // Tên miền chữ thường, không cổng; một tên miền thuộc đúng một trường
      .addColumn('host', 'text', (column) => column.notNull().unique())
      .addColumn('kind', 'text', (column) => column.notNull().defaultTo('system'))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('pending'))
      .addColumn('verified_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'school_domains_host_check',
        sql`host = lower(host) and host ~ '^[a-z0-9][a-z0-9.-]*[a-z0-9]$'`,
      )
      .addCheckConstraint('school_domains_kind_check', sql`kind in ('system', 'custom')`)
      .addCheckConstraint('school_domains_status_check', sql`status in ('pending', 'verified', 'active', 'disabled')`)
      .execute();
    await database.schema.createIndex('school_domains_school_idx').on('school_domains').column('school_id').execute();

    await database.schema
      .createTable('school_databases')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('school_id', 'uuid', (column) => column.notNull().references('schools.id').onDelete('cascade'))
      // Loại: identity, system hoặc school-year; tên logic: 'identity', 'system' hoặc tên cơ sở dữ liệu năm học
      .addColumn('kind', 'text', (column) => column.notNull())
      .addColumn('name', 'text', (column) => column.notNull())
      // database: mỗi cơ sở dữ liệu riêng; schema: mỗi lược đồ riêng trong một cơ sở dữ liệu (hồ sơ thử nghiệm)
      .addColumn('layout', 'text', (column) => column.notNull().defaultTo('database'))
      .addColumn('host', 'text', (column) => column.notNull())
      .addColumn('port', 'integer', (column) => column.notNull().defaultTo(5432))
      .addColumn('database_name', 'text', (column) => column.notNull())
      .addColumn('schema_name', 'text')
      .addColumn('role_name', 'text', (column) => column.notNull())
      .addColumn('password_encrypted', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('school_databases_school_kind_name_key', ['school_id', 'kind', 'name'])
      .addCheckConstraint('school_databases_kind_check', sql`kind in ('identity', 'system', 'school-year')`)
      .addCheckConstraint('school_databases_layout_check', sql`layout in ('database', 'schema')`)
      .addCheckConstraint('school_databases_status_check', sql`status in ('active', 'read_only', 'dropped')`)
      .addCheckConstraint('school_databases_schema_check', sql`(layout = 'schema') = (schema_name is not null)`)
      .execute();

    await database.schema
      .createTable('school_keys')
      .addColumn('school_id', 'uuid', (column) => column.primaryKey().references('schools.id').onDelete('cascade'))
      .addColumn('child_encryption_key_encrypted', 'text', (column) => column.notNull())
      .addColumn('child_hash_key_encrypted', 'text', (column) => column.notNull())
      .addColumn('wrapped_with', 'text', (column) => column.notNull().defaultTo('master-v1'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('rotated_at', 'timestamptz')
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('school_keys').execute();
    await database.schema.dropTable('school_databases').execute();
    await database.schema.dropTable('school_domains').execute();
    await database.schema.dropTable('schools').execute();
    await database.schema.dropTable('school_clusters').execute();
  },
};
