import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';

// Nhật ký của bé (DT-08 phần 8b, YCTD-65); ca kiểm thử CTC-P04-032 đến 038, quy tắc BR-15, BR-16
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

describe('Nhật ký của bé', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  const units: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const classes: Record<string, string> = {};
  const children: Record<string, string> = {};

  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);
  const journal = {
    meal_note: 'Ăn hết suất',
    sleep_note: 'Ngủ trưa 2 giờ',
    hygiene_note: 'Bình thường',
    mood: 'happy',
    activity_note: 'Vẽ tranh',
  };

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    const academicYearId = await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
      first_term: { start_date: addDays(vietnamToday, -30), end_date: addDays(vietnamToday, 90) },
      second_term: { start_date: addDays(vietnamToday, 95), end_date: addDays(vietnamToday, 200) },
    });
    const yearDatabase = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, yearDatabase.database_name),
    );
    for (const [code, type] of [
      ['TC', 'truong_chinh'],
      ['ĐT-A1', 'diem_truong'],
    ] as const) {
      units[code] = (await api('POST', '/org-units', principal.accessToken, { code, name: code, unit_type: type })).body
        .id as string;
    }
    const unitA = units['ĐT-A1'] ?? '';
    users.teacher = await environment.loginAs('VT-07', unitA);
    users.otherTeacher = await environment.loginAs('VT-07', unitA);
    users.subjectTeacher = await environment.loginAs('VT-08', unitA);
    users.manager = await environment.loginAs('VT-03', unitA);
    users.parent = await environment.loginAs('VT-14', unitA);
    for (const code of ['L-A1', 'L-A2']) {
      classes[code] = (
        await schoolYear
          .insertInto('classes')
          .values({
            org_unit_id: unitA,
            academic_year_id: academicYearId,
            code,
            name: code,
            grade_level: 'MAM',
            max_size: 30,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    await schoolYear
      .insertInto('class_staff_assignments')
      .values([
        {
          class_id: classes['L-A1'] ?? '',
          staff_user_id: users.teacher?.userId ?? '',
          staff_name: 'GV-A1',
          assignment_role: 'homeroom',
          from_date: addDays(vietnamToday, -30),
        },
        {
          class_id: classes['L-A2'] ?? '',
          staff_user_id: users.otherTeacher?.userId ?? '',
          staff_name: 'GV-A2',
          assignment_role: 'homeroom',
          from_date: addDays(vietnamToday, -30),
        },
        {
          class_id: classes['L-A1'] ?? '',
          staff_user_id: users.subjectTeacher?.userId ?? '',
          staff_name: 'GVBM-A1',
          assignment_role: 'subject',
          subject_name: 'Âm nhạc',
          from_date: addDays(vietnamToday, -30),
        },
      ])
      .execute();
    for (const [key, name, classCode] of [
      ['T1', 'Nguyễn Một', 'L-A1'],
      ['T2', 'Trần Hai', 'L-A1'],
      ['T3', 'Lê Ba', 'L-A2'],
    ] as const) {
      children[key] = (
        await schoolYear
          .insertInto('children')
          .values({
            org_unit_id: unitA,
            full_name: name,
            dob: '2022-03-01',
            gender: 'female',
            national_id_encrypted: 'ma-hoa',
            national_id_hash: randomUUID(),
            national_id_last4: '0000',
            photo_consent: 'pending',
            status: 'active',
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
      await schoolYear
        .insertInto('class_enrollments')
        .values({
          child_id: children[key] ?? '',
          class_id: classes[classCode] ?? '',
          from_date: addDays(vietnamToday, -30),
        })
        .execute();
    }
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: 'ME', name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    const guardian = await schoolYear
      .insertInto('guardians')
      .values({ full_name: 'Mẹ của Một', phone: '0900000001', user_id: users.parent?.userId ?? null })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('child_guardians')
      .values({ child_id: children.T1 ?? '', guardian_id: guardian.id, relationship_item_id: relationship.id })
      .execute();
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CTC-P04-032: giáo viên chủ nhiệm ghi nhật ký ở trạng thái nháp, phụ huynh chưa thấy', async () => {
    const saved = await api('PUT', `/children/${children.T1}/journals/${vietnamToday}`, token('teacher'), journal);
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.status, 'draft');
    const parent = await api(
      'GET',
      `/children/${children.T1}/journals?month=${vietnamToday.slice(0, 7)}`,
      token('parent'),
    );
    assert.equal(parent.status, 200);
    assert.deepEqual(parent.body.journals, []);
    assert.equal(
      (await api('PUT', `/children/${children.T1}/journals/${addDays(vietnamToday, 1)}`, token('teacher'), journal))
        .status,
      400,
    );
    assert.equal(
      (await api('PUT', `/children/${children.T1}/journals/${vietnamToday}`, token('teacher'), {})).status,
      400,
    );
  });

  it('CTC-P04-037, CTC-P04-038: giáo viên lớp khác và giáo viên bộ môn ghi nhật ký bị từ chối', async () => {
    assert.equal(
      (await api('PUT', `/children/${children.T1}/journals/${vietnamToday}`, token('otherTeacher'), journal)).status,
      403,
    );
    assert.equal(
      (await api('PUT', `/children/${children.T1}/journals/${vietnamToday}`, token('subjectTeacher'), journal)).status,
      403,
    );
    assert.equal(
      (await api('PUT', `/children/${children.T1}/journals/${vietnamToday}`, token('manager'), journal)).status,
      403,
    );
  });

  it('CTC-P04-034, CTC-P04-033: còn trẻ chưa có nội dung thì cảnh báo; xác nhận thì công bố, phụ huynh nhận thông báo', async () => {
    const warned = await api('POST', `/classes/${classes['L-A1']}/journals/publish`, token('teacher'), {
      date: vietnamToday,
    });
    assert.equal(warned.status, 422);
    assert.match((warned.body.error as { details: Array<{ message: string }> }).details[0]?.message ?? '', /Trần Hai/);
    const published = await api('POST', `/classes/${classes['L-A1']}/journals/publish`, token('teacher'), {
      date: vietnamToday,
      confirm: true,
    });
    assert.equal(published.status, 201, JSON.stringify(published.body));
    const rows = published.body.children as Array<{ child_id: string; journal: { status: string } | null }>;
    assert.equal(rows.find((row) => row.child_id === children.T1)?.journal?.status, 'published');
    const notifications = await api('GET', '/notifications', token('parent'));
    assert.ok(
      (notifications.body.notifications as Array<{ title: string }>).some((row) => row.title === 'Nhật ký của bé'),
    );
    const manager = await api('GET', `/classes/${classes['L-A1']}/journals?date=${vietnamToday}`, token('manager'));
    assert.equal(manager.status, 200);
    assert.equal(manager.body.can_write, false);
  });

  it('CTC-P04-035, CTC-P04-036: phụ huynh chỉ thấy nhật ký đã công bố của con mình', async () => {
    const own = await api(
      'GET',
      `/children/${children.T1}/journals?month=${vietnamToday.slice(0, 7)}`,
      token('parent'),
    );
    assert.equal((own.body.journals as Array<{ meal_note: string }>)[0]?.meal_note, 'Ăn hết suất');
    assert.equal(
      (await api('GET', `/children/${children.T2}/journals?month=${vietnamToday.slice(0, 7)}`, token('parent'))).status,
      403,
    );
  });

  it('BR-15: sửa nhật ký đã công bố phải ghi lý do và lưu lịch sử sửa', async () => {
    const path = `/children/${children.T1}/journals/${vietnamToday}`;
    assert.equal((await api('PUT', path, token('teacher'), { ...journal, meal_note: 'Ăn nửa suất' })).status, 422);
    const amended = await api('PUT', path, token('teacher'), {
      ...journal,
      meal_note: 'Ăn nửa suất',
      reason: 'Ghi nhầm',
    });
    assert.equal(amended.status, 200, JSON.stringify(amended.body));
    assert.equal(amended.body.status, 'published');
    const history = await schoolYear.selectFrom('journal_amendments').select('reason').execute();
    assert.deepEqual(
      history.map((row) => row.reason),
      ['Ghi nhầm'],
    );
  });
});
