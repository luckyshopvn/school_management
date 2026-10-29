import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Đơn vị cấp trên (DT-SaaS phần S6, YCTD-202; tài liệu 47 mục 14.5 "S6"):
// - admin_units: cây đơn vị hành chính cấu hình được (Bộ, Sở, Phòng Văn hóa – Xã hội cấp xã), không ghi cứng địa danh trong mã;
//   gộp nút giữ lại nút cũ ở trạng thái `merged` kèm nút nhận để tra lịch sử;
// - schools.admin_unit_id: nút quản lý của trường (thường là Phòng của xã, phường; trường do Sở quản lý gắn thẳng vào Sở);
// - parent_org_users: tài khoản cấp trên, không thuộc trường nào, gắn một nút; phạm vi là cây con của nút; xác thực hai lớp bắt
//   buộc (parent_org_user_totp, parent_org_user_recovery_codes như tài khoản vận hành của S8b);
// - school_aggregate_consents: đồng ý của trường theo cấp và nhóm số liệu, mỗi lần bật là một dòng (bằng chứng: ai, lúc nào), rút
//   thì ghi thời điểm, người rút; đồng ý còn hiệu lực là dòng chưa rút;
// - aggregate_snapshots: bản chụp tổng hợp của từng trường theo nhóm số liệu (chỉ số lượng, tỉ lệ), không có dữ liệu cá nhân;
// - parent_org_access_requests: đề nghị xem chi tiết của cấp trên, trường duyệt hoặc từ chối, rút được; xem chi tiết đi qua phiên
//   hỗ trợ của S4 (support_sessions.requester_kind = 'parent_org').
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('admin_units')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('level', 'text', (column) => column.notNull())
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 200`))
      .addColumn('parent_id', 'uuid', (column) => column.references('admin_units.id').onDelete('restrict'))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('merged_into_id', 'uuid', (column) => column.references('admin_units.id').onDelete('set null'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('admin_units_level_check', sql`level in ('ministry', 'department', 'commune')`)
      .addCheckConstraint('admin_units_status_check', sql`status in ('active', 'inactive', 'merged')`)
      .addCheckConstraint('admin_units_code_check', sql`code ~ '^[a-z0-9][a-z0-9-]{0,62}$'`)
      .execute();
    await database.schema.createIndex('admin_units_parent_idx').on('admin_units').column('parent_id').execute();

    await database.schema
      .alterTable('schools')
      .addColumn('admin_unit_id', 'uuid', (column) => column.references('admin_units.id').onDelete('set null'))
      .execute();
    await database.schema.createIndex('schools_admin_unit_idx').on('schools').column('admin_unit_id').execute();

    await database.schema
      .createTable('parent_org_users')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('login', 'text', (column) => column.notNull().unique())
      .addColumn('full_name', 'text', (column) => column.notNull())
      .addColumn('password_hash', 'text', (column) => column.notNull())
      .addColumn('admin_unit_id', 'uuid', (column) =>
        column.notNull().references('admin_units.id').onDelete('restrict'),
      )
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('failed_login_count', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('locked_until', 'timestamptz')
      .addColumn('last_login_at', 'timestamptz')
      .addColumn('created_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('parent_org_users_status_check', sql`status in ('active', 'locked')`)
      .execute();
    await database.schema
      .createTable('parent_org_user_totp')
      .addColumn('user_id', 'uuid', (column) =>
        column.primaryKey().references('parent_org_users.id').onDelete('cascade'),
      )
      .addColumn('secret_encrypted', 'text', (column) => column.notNull())
      .addColumn('last_step', 'bigint')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createTable('parent_org_user_recovery_codes')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('user_id', 'uuid', (column) => column.notNull().references('parent_org_users.id').onDelete('cascade'))
      .addColumn('code_hash', 'text', (column) => column.notNull())
      .addColumn('used_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('parent_org_user_recovery_codes_unique', ['user_id', 'code_hash'])
      .execute();

    await database.schema
      .createTable('school_aggregate_consents')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('school_id', 'uuid', (column) => column.notNull().references('schools.id').onDelete('cascade'))
      .addColumn('level', 'text', (column) => column.notNull())
      .addColumn('category', 'text', (column) => column.notNull())
      .addColumn('granted_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('granted_by_user_id', 'uuid', (column) => column.notNull())
      .addColumn('granted_by_name', 'text', (column) => column.notNull())
      .addColumn('revoked_at', 'timestamptz')
      .addColumn('revoked_by_name', 'text')
      .addCheckConstraint('school_aggregate_consents_level_check', sql`level in ('ministry', 'department', 'commune')`)
      .addCheckConstraint(
        'school_aggregate_consents_category_check',
        sql`category in ('scale', 'attendance', 'learning', 'facilities', 'staff', 'emis')`,
      )
      .execute();
    // Mỗi trường, cấp, nhóm chỉ một đồng ý còn hiệu lực
    await sql`create unique index school_aggregate_consents_active on school_aggregate_consents (school_id, level, category)
      where revoked_at is null`.execute(database);

    await database.schema
      .createTable('aggregate_snapshots')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('school_id', 'uuid', (column) => column.notNull().references('schools.id').onDelete('cascade'))
      .addColumn('category', 'text', (column) => column.notNull())
      .addColumn('academic_year', 'text')
      .addColumn('metrics', 'jsonb', (column) => column.notNull())
      .addColumn('captured_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'aggregate_snapshots_category_check',
        sql`category in ('scale', 'attendance', 'learning', 'facilities', 'staff', 'emis')`,
      )
      .execute();
    await database.schema
      .createIndex('aggregate_snapshots_latest_idx')
      .on('aggregate_snapshots')
      .columns(['school_id', 'category', 'captured_at'])
      .execute();

    await database.schema
      .createTable('parent_org_access_requests')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('school_id', 'uuid', (column) => column.notNull().references('schools.id').onDelete('cascade'))
      .addColumn('user_id', 'uuid', (column) => column.notNull().references('parent_org_users.id').onDelete('cascade'))
      .addColumn('user_name', 'text', (column) => column.notNull())
      .addColumn('unit_name', 'text', (column) => column.notNull())
      .addColumn('categories', 'jsonb', (column) => column.notNull())
      .addColumn('reason', 'text', (column) => column.notNull().check(sql`char_length(reason) between 5 and 500`))
      .addColumn('hours', 'integer', (column) => column.notNull().check(sql`hours between 1 and 168`))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('pending'))
      .addColumn('decided_at', 'timestamptz')
      .addColumn('decided_by_name', 'text')
      .addColumn('expires_at', 'timestamptz')
      .addColumn('revoked_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'parent_org_access_requests_status_check',
        sql`status in ('pending', 'approved', 'rejected', 'revoked')`,
      )
      .execute();
    await database.schema
      .createIndex('parent_org_access_requests_school_idx')
      .on('parent_org_access_requests')
      .columns(['school_id', 'status'])
      .execute();

    await database.schema
      .alterTable('support_sessions')
      .addColumn('requester_kind', 'text', (column) => column.notNull().defaultTo('operator'))
      .execute();
    await sql`alter table support_sessions add constraint support_sessions_requester_kind_check
      check (requester_kind in ('operator', 'parent_org'))`.execute(database);
    // Phiên xem chi tiết của cấp trên không theo cho phép hỗ trợ của S4 mà theo đề nghị đã duyệt
    await sql`alter table support_sessions alter column grant_id drop not null`.execute(database);
    await database.schema
      .alterTable('support_sessions')
      .addColumn('access_request_id', 'uuid', (column) =>
        column.references('parent_org_access_requests.id').onDelete('set null'),
      )
      .execute();
  },
  async down(database) {
    await database.schema.alterTable('support_sessions').dropColumn('access_request_id').execute();
    await database.schema.alterTable('support_sessions').dropColumn('requester_kind').execute();
    await database.schema.dropTable('parent_org_access_requests').execute();
    await database.schema.dropTable('aggregate_snapshots').execute();
    await database.schema.dropTable('school_aggregate_consents').execute();
    await database.schema.dropTable('parent_org_user_recovery_codes').execute();
    await database.schema.dropTable('parent_org_user_totp').execute();
    await database.schema.dropTable('parent_org_users').execute();
    await database.schema.alterTable('schools').dropColumn('admin_unit_id').execute();
    await database.schema.dropTable('admin_units').execute();
  },
};
