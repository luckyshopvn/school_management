import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import ExcelJS from 'exceljs';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import { hashForTesting, TEST_PASSWORD } from '@school-management/identity/testing';
import type { Kysely } from 'kysely';
import { IMPORT_COLUMNS } from '../imports/imports.service.js';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';

// Điểm danh, chốt ngày, báo vắng; ca kiểm thử theo 27_BO_CA_KIEM_THU_CHI_TIET/02_P02_VA_P04.md mục 4.1, 4.2
const PAST_DAY = '2026-10-05';
const OTHER_PAST_DAY = '2026-10-06';
const randomPhone = () => `09${randomInt(0, 100_000_000).toString().padStart(8, '0')}`;
const errorOf = (body: Record<string, unknown>) => (body.error ?? {}) as { code?: string; rule_code?: string };
type Sheet = {
  day_status: string;
  children: Array<{
    child_id: string;
    full_name: string;
    status: string | null;
    saved: boolean;
    is_backfilled: boolean;
  }>;
  summary: { meal_count: number; unmarked: number };
  skipped_child_ids?: string[];
};

// Ngày học kế tiếp sau hôm nay theo giờ Việt Nam, để báo vắng trước giờ học
function nextWeekdays(count: number): string[] {
  const dates: string[] = [];
  let cursor = new Date(
    `${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())}T00:00:00Z`,
  );
  while (dates.length < count) {
    cursor = new Date(cursor.getTime() + 86_400_000);
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      dates.push(cursor.toISOString().slice(0, 10));
    }
  }
  return dates;
}

describe('Điểm danh, chốt ngày và báo vắng', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let yearId = '';
  let savedDefaultPassword: Array<{ key: string; value: unknown; updated_by: string | null }> = [];
  const units: Record<string, string> = {};
  const classes: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  let children: Array<{ child_id: string; full_name: string }> = [];
  let parentToken = '';
  const parentPhone = randomPhone();

  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, token: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, token, body);
  const sheet = async (token: string, classCode: string, date: string) =>
    api('GET', `/classes/${classes[classCode]}/attendance?date=${date}`, token);
  const save = (token: string, classCode: string, body: Record<string, unknown>) =>
    api('PUT', `/classes/${classes[classCode]}/attendance`, token, body);
  const allPresent = (date: string) => ({
    date,
    entries: children.map((child) => ({ child_id: child.child_id, status: 'present' })),
  });

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    savedDefaultPassword = await environment.identity.database
      .selectFrom('identity_settings')
      .select(['key', 'value', 'updated_by'])
      .where('key', '=', 'parent_default_password_hash')
      .execute();
    await sendJson('PUT', `${environment.identity.baseUrl}/auth/settings`, principal.accessToken, {
      parent_default_password: 'PhuHuynh2026',
    });
    yearId = await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
      first_term: { start_date: '2026-09-01', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
      summer_term: { start_date: '2027-06-01', end_date: '2027-07-31' },
    });
    const databaseRow = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .where('academic_year_id', '=', yearId)
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, databaseRow.database_name),
    );
    for (const [code, type] of [
      ['TC', 'truong_chinh'],
      ['ĐT-A1', 'diem_truong'],
    ] as const) {
      units[code] = (await api('POST', '/org-units', principal.accessToken, { code, name: code, unit_type: type })).body
        .id as string;
    }
    await api('POST', '/grade-levels', principal.accessToken, {
      code: 'MAM',
      name: 'Mầm',
      age_from_months: 48,
      age_to_months: 59,
    });
    await api('POST', '/catalog-items', principal.accessToken, {
      catalog_type: 'parent_relationship',
      code: 'ME',
      name: 'Mẹ',
    });
    for (const code of ['L-A1', 'L-A2']) {
      classes[code] = (
        await api('POST', '/classes', principal.accessToken, {
          org_unit_id: units['ĐT-A1'],
          code,
          name: code,
          grade_level: 'MAM',
          max_size: 25,
        })
      ).body.id as string;
    }
    const unit = units['ĐT-A1'] ?? null;
    users.teacher = await environment.loginAs('VT-07', unit);
    users.otherTeacher = await environment.loginAs('VT-07', unit);
    users.subject = await environment.loginAs('VT-08', unit);
    users.manager = await environment.loginAs('VT-03', unit);
    users.accountant = await environment.loginAs('VT-04', unit);
    users.kitchen = await environment.loginAs('VT-10', unit);
    for (const [teacher, classCode, role] of [
      ['teacher', 'L-A1', 'homeroom'],
      ['otherTeacher', 'L-A2', 'homeroom'],
      ['subject', 'L-A1', 'subject'],
    ] as const) {
      await api('POST', `/classes/${classes[classCode]}/staff-assignments`, principal.accessToken, {
        staff_user_id: users[teacher]?.userId,
        assignment_role: role,
        subject_name: role === 'subject' ? 'Âm nhạc' : undefined,
        from_date: '2026-09-01',
      });
    }

    // Ba trẻ đang học lớp L-A1 nhập từ Excel; trẻ đầu tiên có phụ huynh dùng để đăng nhập kiểm thử
    const book = new ExcelJS.Workbook();
    const worksheet = book.addWorksheet('Trẻ');
    worksheet.addRow(IMPORT_COLUMNS.children.map((column) => column.header));
    for (const [index, name] of ['An', 'Bình', 'Chi'].entries()) {
      const row: Record<string, string> = {
        unit_code: 'ĐT-A1',
        class_code: 'L-A1',
        full_name: `Trẻ ${name}`,
        dob: '2022-04-18',
        gender: 'Nam',
        national_id: `081${String(Date.now() % 1_000_000).padStart(6, '0')}${String(randomInt(0, 100) * 10 + index).padStart(3, '0')}`,
        allergies: 'Không',
        enroll_date: '2026-09-01',
        guardian1_name: `Mẹ ${name}`,
        guardian1_relationship: 'Mẹ',
        guardian1_phone: index === 0 ? parentPhone : randomPhone(),
      };
      worksheet.addRow(IMPORT_COLUMNS.children.map((column) => row[column.key] ?? ''));
    }
    const form = new FormData();
    form.set('type', 'children');
    form.set('file', new Blob([Buffer.from(await book.xlsx.writeBuffer())]), 'tre.xlsx');
    const uploaded = (await (
      await fetch(`${environment.baseUrl}/imports`, {
        method: 'POST',
        headers: { authorization: `Bearer ${principal.accessToken}` },
        body: form,
      })
    ).json()) as { id: string; status: string };
    assert.equal(uploaded.status, 'validated', JSON.stringify(uploaded));
    const committed = await api('POST', `/imports/${uploaded.id}/commit`, principal.accessToken);
    assert.equal(committed.status, 200, JSON.stringify(committed.body));
    children = ((await sheet(token('teacher'), 'L-A1', PAST_DAY)).body as unknown as Sheet).children;
    assert.equal(children.length, 3);

    await environment.identity.database
      .updateTable('users')
      .set({ password_hash: await hashForTesting(TEST_PASSWORD), must_change_password: false })
      .where('phone', '=', parentPhone)
      .execute();
    parentToken = (
      await sendJson('POST', `${environment.identity.baseUrl}/auth/login`, undefined, {
        login: parentPhone,
        password: TEST_PASSWORD,
        channel: 'parent',
      })
    ).body.access_token as string;
  });

  after(async () => {
    const identity = environment.identity.database;
    await identity.deleteFrom('identity_settings').where('key', '=', 'parent_default_password_hash').execute();
    for (const row of savedDefaultPassword) {
      await identity
        .insertInto('identity_settings')
        .values({ key: row.key, value: JSON.stringify(row.value), updated_by: row.updated_by })
        .execute();
    }
    await schoolYear.destroy();
    await environment.close();
  });

  const recordCount = async (date: string) =>
    Number(
      (
        await schoolYear
          .selectFrom('attendance_records')
          .select((expression) => expression.fn.countAll<string>().as('count'))
          .where('attendance_date', '=', date)
          .executeTakeFirstOrThrow()
      ).count,
    );

  describe('P04-01 Điểm danh', () => {
    it('CTC-P04-001, CTC-P04-002, CTC-P04-003: bảng ban đầu chưa đánh dấu; lưu tạo mỗi trẻ một bản ghi; lưu lại không tăng bản ghi', async () => {
      const opened = (await sheet(token('teacher'), 'L-A1', PAST_DAY)).body as unknown as Sheet;
      assert.ok(opened.children.every((child) => child.status === null && !child.saved));
      assert.equal(opened.summary.unmarked, 3);
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const saved = await save(token('teacher'), 'L-A1', allPresent(PAST_DAY));
        assert.equal(saved.status, 200, JSON.stringify(saved.body));
      }
      assert.equal(await recordCount(PAST_DAY), 3);
    });

    it('CTC-P04-004, CTC-P04-005: giáo viên lớp khác không lưu được; giáo viên bộ môn xem được nhưng không lưu được', async () => {
      assert.equal((await save(token('otherTeacher'), 'L-A1', allPresent(PAST_DAY))).status, 403);
      assert.equal((await sheet(token('subject'), 'L-A1', PAST_DAY)).status, 200);
      assert.equal((await save(token('subject'), 'L-A1', allPresent(PAST_DAY))).status, 403);
      assert.equal((await sheet(token('otherTeacher'), 'L-A1', PAST_DAY)).status, 403);
    });

    it('CTC-P04-006, CTC-P04-044, CTC-P04-045: ngoài năm học, thứ bảy, tuần nghỉ không có bảng điểm danh; kỳ hè chỉ có trẻ đăng ký học hè', async () => {
      const weeks = (await api('GET', `/academic-years/${yearId}/weeks`, principal.accessToken))
        .body as unknown as Array<{
        week_no: number;
        start_date: string;
      }>;
      const offWeek = weeks.find((week) => week.start_date === '2027-03-08');
      await api('PATCH', `/academic-years/${yearId}/weeks`, principal.accessToken, {
        weeks: [{ week_no: offWeek?.week_no, is_off: true, note: 'Nghỉ giữa kỳ' }],
      });
      for (const date of ['2027-08-15', '2026-10-10', '2027-03-09']) {
        const response = await sheet(token('teacher'), 'L-A1', date);
        assert.equal(response.status, 422, date);
        assert.equal(errorOf(response.body).rule_code, 'BR-91');
      }
      // Chưa trẻ nào đăng ký học hè tháng 6 nên bảng ngày hè trống (BR-92, YCTD-50)
      const summer = await sheet(token('teacher'), 'L-A1', '2027-06-02');
      assert.equal(summer.status, 200, JSON.stringify(summer.body));
      assert.equal((summer.body as unknown as Sheet).children.length, 0);
    });

    it('CTC-P04-009, CTC-P04-010: bản ghi gửi bù được đánh dấu nhập bù; trẻ không thuộc lớp bị bỏ qua kèm cảnh báo', async () => {
      const outsider = (await api('GET', '/children?page_size=1', principal.accessToken)).body.items as Array<{
        id: string;
      }>;
      assert.ok(outsider.length > 0);
      const saved = await save(token('teacher'), 'L-A1', {
        date: OTHER_PAST_DAY,
        offline_recorded_at: `${OTHER_PAST_DAY}T08:00:00+07:00`,
        entries: [
          ...children.map((child) => ({ child_id: child.child_id, status: 'present' })),
          { child_id: '00000000-0000-4000-8000-000000000001', status: 'present' },
        ],
      });
      assert.equal(saved.status, 200, JSON.stringify(saved.body));
      const body = saved.body as unknown as Sheet;
      assert.deepEqual(body.skipped_child_ids, ['00000000-0000-4000-8000-000000000001']);
      assert.ok(body.children.every((child) => child.is_backfilled));
    });
  });

  describe('P04-06 Chốt điểm danh ngày', () => {
    it('BR-12, CTC-P04-011, CTC-P04-016, CTC-P04-017: còn trẻ chưa đánh dấu thì không chốt; chốt xong báo bếp và kế toán; suất ăn tính cả đi muộn, về sớm', async () => {
      const date = '2026-10-07';
      await save(token('teacher'), 'L-A1', {
        date,
        entries: [{ child_id: children[0]?.child_id, status: 'late' }],
      });
      const refused = await api('POST', `/classes/${classes['L-A1']}/attendance/lock`, token('teacher'), {
        date,
      });
      assert.equal(refused.status, 422);
      await save(token('teacher'), 'L-A1', {
        date,
        entries: [
          { child_id: children[1]?.child_id, status: 'early_leave' },
          { child_id: children[2]?.child_id, status: 'absent_notified', note: 'Ốm' },
        ],
      });
      const locked = await api('POST', `/classes/${classes['L-A1']}/attendance/lock`, token('teacher'), {
        date,
      });
      assert.equal(locked.status, 200, JSON.stringify(locked.body));
      const body = locked.body as unknown as Sheet;
      assert.equal(body.day_status, 'locked');
      assert.equal(body.summary.meal_count, 2);
      const roles = await schoolYear
        .selectFrom('notifications')
        .innerJoin('notification_recipients', 'notification_recipients.notification_id', 'notifications.id')
        .select('notification_recipients.role_code')
        .where('notifications.template_code', '=', 'attendance_locked')
        .execute();
      assert.deepEqual(roles.map((row) => row.role_code).sort(), ['VT-04', 'VT-10']);
    });

    it('CTC-P04-012: sửa ngày đã chốt không có lý do bị chặn; có lý do thì sửa được và có nhật ký', async () => {
      const date = '2026-10-07';
      const change = { date, entries: [{ child_id: children[2]?.child_id, status: 'present' }] };
      assert.equal((await save(token('teacher'), 'L-A1', change)).status, 400);
      const fixed = await save(token('teacher'), 'L-A1', {
        ...change,
        reason: 'Phụ huynh đưa trẻ đến muộn sau giờ chốt',
      });
      assert.equal(fixed.status, 200);
      const log = await api(
        'GET',
        `/audit-logs?entity_name=attendance_records&entity_id=${children[2]?.child_id}`,
        principal.accessToken,
      );
      const entry = (
        log.body.items as Array<{ before_data: { status: string }; after_data: { status: string; reason: string } }>
      )[0];
      assert.equal(entry?.before_data.status, 'absent_notified');
      assert.equal(entry?.after_data.reason, 'Phụ huynh đưa trẻ đến muộn sau giờ chốt');
    });

    it('CTC-P04-013, CTC-P04-014: quản lý đơn vị chốt thay và sửa sau khi chốt kèm lý do', async () => {
      const date = '2026-10-08';
      assert.equal((await save(token('manager'), 'L-A1', allPresent(date))).status, 200);
      const locked = await api('POST', `/classes/${classes['L-A1']}/attendance/lock`, token('manager'), {
        date,
      });
      assert.equal(locked.status, 200);
      const edited = await save(token('manager'), 'L-A1', {
        date,
        reason: 'Giáo viên báo nhầm',
        entries: [{ child_id: children[0]?.child_id, status: 'late' }],
      });
      assert.equal(edited.status, 200);
      const unlocked = await api('POST', `/classes/${classes['L-A1']}/attendance/unlock`, token('manager'), {
        date,
        reason: 'Mở lại để rà soát',
      });
      assert.equal((unlocked.body as unknown as Sheet).day_status, 'open');
    });

    it('CTC-P04-015: kế toán và bếp không chốt, không mở lại được', async () => {
      for (const user of [users.accountant, users.kitchen]) {
        assert.equal(
          (
            await api('POST', `/classes/${classes['L-A1']}/attendance/lock`, user?.accessToken ?? '', {
              date: PAST_DAY,
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await api('POST', `/classes/${classes['L-A1']}/attendance/unlock`, user?.accessToken ?? '', {
              date: PAST_DAY,
              reason: 'Thử',
            })
          ).status,
          403,
        );
      }
    });
  });

  describe('P04-02 Báo vắng', () => {
    it('CTC-P04-018, CTC-P04-022: phụ huynh báo vắng trước giờ học cho ba ngày tới; bảng điểm danh hiện nghỉ có báo; giáo viên nhận thông báo', async () => {
      const days = nextWeekdays(3);
      const reported = await api('POST', '/absences', parentToken, {
        child_id: children[0]?.child_id,
        from_date: days[0],
        to_date: days[2],
        reason: 'Về quê',
      });
      assert.equal(reported.status, 201, JSON.stringify(reported.body));
      const records = reported.body as unknown as Array<{ absence_date: string; is_advised: boolean }>;
      assert.ok(records.length >= 1);
      assert.ok(records.every((record) => record.is_advised));
      const opened = (await sheet(token('teacher'), 'L-A1', days[0] ?? '')).body as unknown as Sheet;
      assert.equal(
        opened.children.find((child) => child.child_id === children[0]?.child_id)?.status,
        'absent_notified',
      );
      const notified = await schoolYear
        .selectFrom('notifications')
        .innerJoin('notification_recipients', 'notification_recipients.notification_id', 'notifications.id')
        .select('notification_recipients.user_id')
        .where('notifications.template_code', '=', 'absence_reported')
        .execute();
      assert.ok(notified.some((row) => row.user_id === users.teacher?.userId));
    });

    it('CTC-P04-019: báo vắng sau giờ học được ghi nhận nhưng đánh dấu báo muộn', async () => {
      const reported = await api('POST', '/absences', parentToken, {
        child_id: children[0]?.child_id,
        from_date: PAST_DAY,
      });
      assert.equal(reported.status, 201);
      assert.equal((reported.body as unknown as Array<{ is_advised: boolean }>)[0]?.is_advised, false);
    });

    it('CTC-P04-020, CTC-P04-021: phụ huynh không báo vắng được cho trẻ khác; giáo viên ghi thay thì nguồn là giáo viên', async () => {
      assert.equal(
        (
          await api('POST', '/absences', parentToken, {
            child_id: children[1]?.child_id,
            from_date: nextWeekdays(1)[0],
          })
        ).status,
        403,
      );
      const recorded = await api('POST', '/absences', token('teacher'), {
        child_id: children[1]?.child_id,
        from_date: nextWeekdays(1)[0],
        reason: 'Phụ huynh gọi điện',
      });
      assert.equal(recorded.status, 201);
      assert.equal((recorded.body as unknown as Array<{ source: string }>)[0]?.source, 'teacher');
    });

    it('CTC-P04-023: chốt ngày có trẻ vắng không báo thì phụ huynh nhận thông báo trong ứng dụng và tin nhắn', async () => {
      const date = '2026-10-09';
      await save(token('teacher'), 'L-A1', {
        date,
        entries: children.map((child, index) => ({
          child_id: child.child_id,
          status: index === 0 ? 'absent_unnotified' : 'present',
        })),
      });
      await api('POST', `/classes/${classes['L-A1']}/attendance/lock`, token('teacher'), { date });
      const channels = await schoolYear
        .selectFrom('notifications')
        .innerJoin('notification_recipients', 'notification_recipients.notification_id', 'notifications.id')
        .select('notification_recipients.channel')
        .where('notifications.template_code', '=', 'child_absent_unnotified')
        .where('notifications.target_id', '=', children[0]?.child_id ?? '')
        .execute();
      assert.deepEqual(channels.map((row) => row.channel).sort(), ['in_app', 'sms']);
    });

    it('MP-02: phụ huynh xem điểm danh của con theo tháng; không xem được của trẻ khác', async () => {
      const own = await api('GET', `/children/${children[0]?.child_id}/attendance?month=2026-10`, parentToken);
      assert.equal(own.status, 200);
      assert.ok((own.body.records as unknown[]).length >= 3);
      assert.equal(
        (await api('GET', `/children/${children[1]?.child_id}/attendance?month=2026-10`, parentToken)).status,
        403,
      );
    });
  });
});
