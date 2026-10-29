import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Khởi tạo và vòng đời trường (DT-SaaS phần S2, YCTD-193; tài liệu 47 mục 14.5). Claude tự chọn theo ủy quyền của Eric ngày
// 2026-10-11:
// - `schools` thêm thông tin của bước setup (địa chỉ, cấp học, năm học đầu) và mốc vòng đời (tạm dừng, yêu cầu xóa, hạn xóa,
//   đã xóa, bản ghi chứng minh đã xóa). Xóa vĩnh viễn giữ lại đúng hàng của trường ở trạng thái `deleted` làm bằng chứng;
// - `provisioning_jobs`: tiến trình khởi tạo, xóa có bước; mỗi bước xong ghi vào `completed_steps`, lỗi giữa chừng thì chạy
//   lại tiếp từ bước dở hoặc hoàn tác; `input` chỉ giữ dữ liệu không bí mật;
// - `school_lifecycle_events`: lịch sử đổi trạng thái (ai, khi nào, lý do);
// - `school_admin_invitations`: đường liên kết kích hoạt một lần cho quản trị viên đầu tiên (chỉ lưu mã băm của mã kích hoạt);
// - `school_migrations`: kết quả migrate cuốn chiếu từng cơ sở dữ liệu của từng trường
export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('schools')
      .addColumn('address', 'text')
      .addColumn('school_levels', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('first_academic_year', 'text')
      .addColumn('suspended_at', 'timestamptz')
      .addColumn('deletion_requested_at', 'timestamptz')
      .addColumn('delete_after', 'timestamptz')
      .addColumn('deleted_at', 'timestamptz')
      .addColumn('deletion_record', 'jsonb')
      .execute();

    await database.schema
      .createTable('provisioning_jobs')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('school_id', 'uuid', (column) => column.references('schools.id').onDelete('set null'))
      .addColumn('school_code', 'text', (column) => column.notNull())
      .addColumn('kind', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('pending'))
      .addColumn('current_step', 'text')
      .addColumn('completed_steps', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('input', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn('error', 'text')
      .addColumn('actor_type', 'text', (column) => column.notNull())
      .addColumn('actor_id', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('finished_at', 'timestamptz')
      .addCheckConstraint('provisioning_jobs_kind_check', sql`kind in ('provision', 'purge')`)
      .addCheckConstraint(
        'provisioning_jobs_status_check',
        sql`status in ('pending', 'running', 'failed', 'done', 'rolled_back')`,
      )
      .execute();
    await database.schema
      .createIndex('provisioning_jobs_school_index')
      .on('provisioning_jobs')
      .columns(['school_code', 'created_at'])
      .execute();

    await database.schema
      .createTable('school_lifecycle_events')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('school_id', 'uuid', (column) => column.notNull().references('schools.id').onDelete('cascade'))
      .addColumn('event', 'text', (column) => column.notNull())
      .addColumn('from_status', 'text')
      .addColumn('to_status', 'text')
      .addColumn('reason', 'text', (column) => column.check(sql`char_length(reason) <= 500`))
      .addColumn('actor_type', 'text', (column) => column.notNull())
      .addColumn('actor_id', 'uuid')
      .addColumn('at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createTable('school_admin_invitations')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('school_id', 'uuid', (column) => column.notNull().references('schools.id').onDelete('cascade'))
      .addColumn('user_id', 'uuid', (column) => column.notNull())
      .addColumn('login', 'text', (column) => column.notNull())
      .addColumn('full_name', 'text', (column) => column.notNull())
      // SHA-256 của mã kích hoạt; mã gốc chỉ hiện một lần cho người vận hành khi tạo
      .addColumn('token_hash', 'text', (column) => column.notNull().unique())
      .addColumn('expires_at', 'timestamptz', (column) => column.notNull())
      .addColumn('used_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createTable('school_migrations')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('school_id', 'uuid', (column) => column.notNull().references('schools.id').onDelete('cascade'))
      .addColumn('wave_id', 'uuid', (column) => column.notNull())
      .addColumn('database_kind', 'text', (column) => column.notNull())
      .addColumn('database_name', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull())
      .addColumn('applied', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('error', 'text')
      .addColumn('canary', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('school_migrations_status_check', sql`status in ('done', 'failed', 'skipped')`)
      .execute();
  },
  async down(database) {
    for (const table of [
      'school_migrations',
      'school_admin_invitations',
      'school_lifecycle_events',
      'provisioning_jobs',
    ]) {
      await database.schema.dropTable(table).execute();
    }
    await database.schema
      .alterTable('schools')
      .dropColumn('address')
      .dropColumn('school_levels')
      .dropColumn('first_academic_year')
      .dropColumn('suspended_at')
      .dropColumn('deletion_requested_at')
      .dropColumn('delete_after')
      .dropColumn('deleted_at')
      .dropColumn('deletion_record')
      .execute();
  },
};
