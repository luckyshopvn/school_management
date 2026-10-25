import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Bảng điều khiển nền tảng (DT-SaaS phần S4, YCTD-197):
// - school_metrics: số liệu từng trường do bộ lập lịch thu (chỉ số lượng, không đọc nội dung dữ liệu): tài khoản, học sinh đang học,
//   dung lượng tệp, dung lượng cơ sở dữ liệu, lần đăng nhập cuối, phiên bản cấu trúc từng cơ sở dữ liệu;
// - school_error_counts: lỗi 5xx gom theo trường, dịch vụ, giờ, tuyến (mẫu đường dẫn, không tham số), mã trạng thái; không nội dung
//   dữ liệu cá nhân;
// - maintenance_notices: thông báo bảo trì tới người dùng của mọi trường hoặc một số trường;
// - support_sessions, support_session_actions: phiên hỗ trợ của nhân viên nền tảng khi trường cho phép (quyền cho phép lưu ở cơ sở
//   dữ liệu hệ thống của trường, tệp hệ thống 0053) và từng thao tác trong phiên (phương thức, mẫu đường dẫn, mã trạng thái)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('school_metrics')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('school_id', 'uuid', (column) => column.notNull().references('schools.id').onDelete('cascade'))
      .addColumn('captured_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('users_total', 'integer', (column) => column.notNull())
      .addColumn('users_active', 'integer', (column) => column.notNull())
      .addColumn('active_students', 'integer')
      .addColumn('storage_mb', 'numeric(14, 2)')
      .addColumn('database_mb', 'numeric(14, 2)')
      .addColumn('last_login_at', 'timestamptz')
      .addColumn('schema_versions', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn('schema_current', 'boolean', (column) => column.notNull().defaultTo(true))
      .execute();
    await database.schema
      .createIndex('school_metrics_school_index')
      .on('school_metrics')
      .columns(['school_id', 'captured_at'])
      .execute();

    await database.schema
      .createTable('school_error_counts')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('school_id', 'uuid', (column) => column.references('schools.id').onDelete('cascade'))
      .addColumn('service', 'text', (column) => column.notNull())
      .addColumn('bucket', 'timestamptz', (column) => column.notNull())
      .addColumn('route', 'text', (column) => column.notNull())
      .addColumn('status', 'integer', (column) => column.notNull())
      .addColumn('count', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('last_code', 'text')
      .addColumn('last_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('school_error_counts_service_check', sql`service in ('api', 'identity')`)
      .execute();
    await sql`create unique index school_error_counts_key on school_error_counts
      (school_id, service, bucket, route, status) nulls not distinct`.execute(database);

    await database.schema
      .createTable('maintenance_notices')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('title', 'text', (column) => column.notNull().check(sql`char_length(title) between 1 and 200`))
      .addColumn('body', 'text', (column) => column.notNull().check(sql`char_length(body) between 1 and 2000`))
      .addColumn('severity', 'text', (column) => column.notNull().defaultTo('info'))
      .addColumn('starts_at', 'timestamptz', (column) => column.notNull())
      .addColumn('ends_at', 'timestamptz', (column) => column.notNull())
      .addColumn('audience', 'text', (column) => column.notNull().defaultTo('all'))
      .addColumn('school_codes', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('created_by', 'uuid')
      .addColumn('created_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('cancelled_at', 'timestamptz')
      .addCheckConstraint('maintenance_notices_severity_check', sql`severity in ('info', 'warning', 'critical')`)
      .addCheckConstraint('maintenance_notices_audience_check', sql`audience in ('all', 'schools')`)
      .addCheckConstraint('maintenance_notices_period_check', sql`ends_at > starts_at`)
      .execute();

    await database.schema
      .createTable('support_sessions')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('school_id', 'uuid', (column) => column.notNull().references('schools.id').onDelete('cascade'))
      .addColumn('operator_id', 'uuid', (column) => column.notNull())
      .addColumn('operator_name', 'text', (column) => column.notNull())
      .addColumn('grant_id', 'uuid', (column) => column.notNull())
      .addColumn('scope', 'text', (column) => column.notNull())
      .addColumn('reason', 'text', (column) => column.notNull().check(sql`char_length(reason) between 1 and 500`))
      .addColumn('handoff_token_hash', 'text', (column) => column.notNull().unique())
      .addColumn('handoff_expires_at', 'timestamptz', (column) => column.notNull())
      .addColumn('identity_session_id', 'uuid')
      .addColumn('expires_at', 'timestamptz', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('started_at', 'timestamptz')
      .addColumn('ended_at', 'timestamptz')
      .addColumn('end_reason', 'text')
      .addCheckConstraint('support_sessions_scope_check', sql`scope in ('read', 'full')`)
      .execute();
    await database.schema
      .createIndex('support_sessions_identity_session_index')
      .on('support_sessions')
      .column('identity_session_id')
      .execute();
    await database.schema
      .createTable('support_session_actions')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('support_session_id', 'uuid', (column) =>
        column.notNull().references('support_sessions.id').onDelete('cascade'),
      )
      .addColumn('service', 'text', (column) => column.notNull())
      .addColumn('method', 'text', (column) => column.notNull())
      .addColumn('route', 'text', (column) => column.notNull())
      .addColumn('status', 'integer', (column) => column.notNull())
      .addColumn('at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('support_session_actions_session_index')
      .on('support_session_actions')
      .columns(['support_session_id', 'at'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('support_session_actions').execute();
    await database.schema.dropTable('support_sessions').execute();
    await database.schema.dropTable('maintenance_notices').execute();
    await database.schema.dropTable('school_error_counts').execute();
    await database.schema.dropTable('school_metrics').execute();
  },
};
