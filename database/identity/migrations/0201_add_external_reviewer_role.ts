import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Đoàn đánh giá ngoài (YCTD-396 lát L8, Q-396-9 B): vai trò mẫu VT-23 và quyền chỉ đọc kho minh chứng trong phạm vi bộ tiêu chí
// được giao, có thời hạn. Tài khoản của vai này bắt buộc có ngày hết hiệu lực như kiểm toán viên (VT-20); tự khóa khi hết hạn
const REVIEWER_ROLE = { code: 'VT-23', name: 'Đoàn đánh giá ngoài' };
const REVIEW_PERMISSION = {
  code: 'P09.evidence.review',
  description:
    'Kho minh chứng: đoàn đánh giá ngoài xem, tải minh chứng của bộ tiêu chí được giao trong thời hạn giao (chỉ đọc)',
};

export const migration: Migration = {
  async up(database) {
    await sql`insert into roles (code, name, is_system)
      values (${REVIEWER_ROLE.code}, ${REVIEWER_ROLE.name}, true)`.execute(database);
    await sql`insert into permissions (code, module_code, description)
      values (${REVIEW_PERMISSION.code}, 'P09', ${REVIEW_PERMISSION.description})`.execute(database);
    await sql`insert into role_permissions (role_id, permission_id)
      select roles.id, permissions.id from roles, permissions
      where roles.code = ${REVIEWER_ROLE.code} and permissions.code = ${REVIEW_PERMISSION.code}`.execute(database);
  },
  async down(database) {
    await sql`delete from user_roles where role_id in (select id from roles where code = ${REVIEWER_ROLE.code})`.execute(
      database,
    );
    await sql`delete from role_permissions where role_id in (select id from roles where code = ${REVIEWER_ROLE.code})
      or permission_id in (select id from permissions where code = ${REVIEW_PERMISSION.code})`.execute(database);
    await sql`delete from permissions where code = ${REVIEW_PERMISSION.code}`.execute(database);
    await sql`delete from roles where code = ${REVIEWER_ROLE.code}`.execute(database);
  },
};
