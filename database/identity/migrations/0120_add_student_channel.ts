import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-23 phần 23a (YCTD-211): kênh đăng nhập `student` của học sinh (GD-105 Eric chốt 2026-10-26: học sinh tự đăng nhập mọi cấp
// học, trường có công tắc tắt theo cấp) và vai trò hệ thống VT-21 "Học sinh". Claude tự chọn theo ủy quyền của Eric ngày
// 2026-10-11:
// - kênh student cùng cơ chế phiên với ba kênh còn lại nhưng cookie riêng, hạn mã làm mới riêng, tuyến máy chủ API riêng
//   (/student/*); tài khoản có vai trò VT-21 chỉ đăng nhập được ở kênh này, kênh này chỉ nhận tài khoản có vai trò VT-21;
// - quyền P02.exam.take (làm bài thi trực tuyến) chỉ của VT-21; học sinh không có quyền nào khác;
// - quyền P02.exam.assign (giao đề thi trực tuyến, theo dõi bài làm, cấu hình thi trực tuyến) cho người chấm bài kiểm tra:
//   Hiệu trưởng, Phó Hiệu trưởng, giáo viên chủ nhiệm, giáo viên bộ môn, tổ trưởng chuyên môn;
// - phân hệ "Thi trực tuyến" của cổng quản trị không hiện cho Phụ huynh (VT-14); học sinh (VT-21) không dùng cổng quản trị nên
//   không có phân hệ nào.
const WORKSPACE_KEY = 'online-exam';
const ALL_WORKSPACE_KEYS = [
  'education',
  'facilities',
  'entry-admissions',
  'emis',
  'signing',
  'documents',
  'system',
  'finance',
  'personnel',
  'logistics',
  'interaction',
  'teaching',
  'admissions',
  'reports',
  'kpi',
  'website',
  'professional-records',
  'emulation',
  'quality-assurance',
  'library',
  'learning-resources',
  WORKSPACE_KEY,
];
const STUDENT_ROLE = { code: 'VT-21', name: 'Học sinh' };
const PERMISSIONS = [
  {
    code: 'P02.exam.assign',
    description:
      'Thi trực tuyến: giao đề đã khoá cho lớp, học sinh; theo dõi bài làm; cấu hình thi trực tuyến theo cấp',
    roles: ['VT-02', 'VT-07', 'VT-08', 'VT-15', 'VT-17'],
  },
  {
    code: 'P02.exam.take',
    description: 'Thi trực tuyến: học sinh làm bài được giao ở kênh đăng nhập của học sinh',
    roles: [STUDENT_ROLE.code],
  },
];

export const migration: Migration = {
  async up(database) {
    await sql`alter table sessions drop constraint if exists sessions_channel_check`.execute(database);
    await sql`alter table sessions add constraint sessions_channel_check
      check (channel in ('portal', 'teacher', 'parent', 'student'))`.execute(database);
    await sql`insert into roles (code, name, is_system)
      values (${STUDENT_ROLE.code}, ${STUDENT_ROLE.name}, true)`.execute(database);
    for (const permission of PERMISSIONS) {
      await sql`insert into permissions (code, module_code, description)
        values (${permission.code}, 'P02', ${permission.description})`.execute(database);
      await sql`insert into role_permissions (role_id, permission_id)
        select roles.id, permissions.id from roles, permissions
        where roles.code in (${sql.join(permission.roles)}) and permissions.code = ${permission.code}`.execute(
        database,
      );
    }
    await sql`insert into role_workspace_exclusions (role_id, workspace_key)
      select roles.id, ${WORKSPACE_KEY} from roles where roles.code = 'VT-14'
      on conflict do nothing`.execute(database);
    for (const key of ALL_WORKSPACE_KEYS) {
      await sql`insert into role_workspace_exclusions (role_id, workspace_key)
        select roles.id, ${key} from roles where roles.code = ${STUDENT_ROLE.code}
        on conflict do nothing`.execute(database);
    }
  },
  async down(database) {
    await sql`delete from role_workspace_exclusions where workspace_key = ${WORKSPACE_KEY}`.execute(database);
    await sql`delete from role_workspace_exclusions where role_id in
      (select id from roles where code = ${STUDENT_ROLE.code})`.execute(database);
    const codes = PERMISSIONS.map((permission) => permission.code);
    await sql`delete from role_permissions where permission_id in
      (select id from permissions where code in (${sql.join(codes)}))`.execute(database);
    await sql`delete from permissions where code in (${sql.join(codes)})`.execute(database);
    await sql`delete from user_roles where role_id in (select id from roles where code = ${STUDENT_ROLE.code})`.execute(
      database,
    );
    await sql`delete from roles where code = ${STUDENT_ROLE.code}`.execute(database);
    await sql`delete from sessions where channel = 'student'`.execute(database);
    await sql`alter table sessions drop constraint if exists sessions_channel_check`.execute(database);
    await sql`alter table sessions add constraint sessions_channel_check
      check (channel in ('portal', 'teacher', 'parent'))`.execute(database);
  },
};
