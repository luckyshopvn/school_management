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
import { isoWeekday, parseClassLogInput, weekStartOf } from './class-logs.js';

// Sổ đầu bài và điểm danh theo tiết (DT-20 phần 20d, YCTD-162): ghi tiết theo thời khoá biểu đã ban hành, giáo viên ký tiết,
// Ban giám hiệu ký sổ tuần, phụ huynh xem điểm danh theo tiết, tổng hợp chuyên cần đối chiếu báo vắng theo ngày
describe('Kiểm tra dữ liệu sổ đầu bài', () => {
  it('CT-20d-1: thứ theo ISO, đầu tuần; dữ liệu tiết hợp lệ; điểm danh không trùng học sinh, đúng trạng thái', () => {
    assert.deepEqual(['2026-10-19', '2026-10-24', '2026-10-25'].map(isoWeekday), [1, 6, 7]);
    assert.deepEqual(['2026-10-19', '2026-10-25', '2026-11-01'].map(weekStartOf), [
      '2026-10-19',
      '2026-10-19',
      '2026-10-26',
    ]);
    const child = randomUUID();
    const valid = {
      class_id: randomUUID(),
      lesson_date: '2026-10-19',
      period_no: 1,
      lesson_title: '  Bài 5: Chữ a  ',
      rating: '',
      attendance: [{ child_id: child, status: 'late', note: ' ' }],
    };
    const parsed = parseClassLogInput(valid);
    assert.equal(parsed.lesson_title, 'Bài 5: Chữ a');
    assert.equal(parsed.rating, null);
    assert.deepEqual(parsed.attendance, [{ child_id: child, status: 'late', note: null }]);
    for (const body of [
      { ...valid, lesson_title: ' ' },
      { ...valid, period_no: 16 },
      { ...valid, lesson_date: '19/10/2026' },
      { ...valid, rating: 'E' },
      { ...valid, attendance: [{ child_id: child, status: 'sick' }] },
      {
        ...valid,
        attendance: [
          { child_id: child, status: 'present' },
          { child_id: child, status: 'late' },
        ],
      },
    ]) {
      assert.throws(() => parseClassLogInput(body), { code: 'ERR_VALIDATION' }, JSON.stringify(body));
    }
  });
});

describe('Điểm cuối sổ đầu bài', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let viewer: LoggedInUser;
  let unitId = '';
  const teachers: LoggedInUser[] = [];
  const parents: LoggedInUser[] = [];
  const classes: Record<string, string> = {};
  const subjects: Record<string, string> = {};
  const children: string[] = [];
  let logId = '';
  // Thứ Hai đã qua trong học kỳ I; bản thời khoá biểu áp dụng từ 07/09/2026
  const monday = '2026-10-19';
  const url = (path: string) => `${environment.baseUrl}${path}`;
  const api = (method: string, path: string, token: string, body?: unknown) => sendJson(method, url(path), token, body);
  const lessonBody = (overrides: Record<string, unknown> = {}) => ({
    class_id: classes['1A'],
    lesson_date: monday,
    period_no: 1,
    lesson_title: 'Bài 5: Chữ a',
    content: 'Đọc, viết chữ a',
    comment: 'Lớp chú ý',
    rating: 'A',
    attendance: [
      { child_id: children[0], status: 'late', note: 'Đến muộn 10 phút' },
      { child_id: children[1], status: 'absent_excused' },
    ],
    ...overrides,
  });

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    const academicYearId = await openTestAcademicYear(environment, principal.accessToken, '2026-2027', {
      first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    });
    const registry = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .where('academic_year_id', '=', academicYearId)
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, registry.database_name),
    );
    unitId = (
      await api('POST', '/org-units', principal.accessToken, {
        code: 'TH-20D',
        name: 'Trường tiểu học thử',
        unit_type: 'truong_chinh',
      })
    ).body.id as string;
    const current = await api('GET', '/school-levels', principal.accessToken);
    const levels = (current.body.levels as Array<Record<string, unknown>>).map(
      ({ code, order_no, display_name, learner_term, context_label }) => ({
        code,
        is_enabled: code === 'MN' || code === 'TH',
        order_no,
        display_name,
        learner_term,
        context_label,
      }),
    );
    assert.equal((await api('PUT', '/school-levels', principal.accessToken, { levels })).status, 200);
    assert.equal(
      (await api('POST', '/grade-levels/templates', principal.accessToken, { school_level: 'TH' })).status,
      200,
    );
    assert.equal((await api('POST', '/subjects/templates', principal.accessToken, { school_level: 'TH' })).status, 200);
    const subjectRows = (await api('GET', '/subjects?school_level=TH', principal.accessToken)).body as unknown as Array<
      Record<string, unknown>
    >;
    for (const row of subjectRows) {
      subjects[row.code as string] = row.id as string;
    }
    viewer = await environment.loginAs('VT-07', unitId);
    teachers.push(await environment.loginAs('VT-08', unitId), await environment.loginAs('VT-08', unitId));
    parents.push(await environment.loginAs('VT-14', unitId), await environment.loginAs('VT-14', unitId));
    classes['1A'] = (
      await schoolYear
        .insertInto('classes')
        .values({
          org_unit_id: unitId,
          academic_year_id: academicYearId,
          code: '1A',
          name: 'Lớp 1A',
          grade_level: 'K1',
          school_level: 'TH',
          max_size: 35,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    // Cô thứ nhất dạy Tiếng Việt tiết 1, cô thứ hai dạy Toán tiết 2 thứ Hai của lớp 1A
    for (const [subject, teacher] of [
      ['TH-TV', 0],
      ['TH-TOAN', 1],
    ] as const) {
      const assigned = await api('POST', `/classes/${classes['1A']}/staff-assignments`, principal.accessToken, {
        staff_user_id: teachers[teacher]?.userId,
        assignment_role: 'subject',
        subject_id: subjects[subject],
      });
      assert.equal(assigned.status, 201, JSON.stringify(assigned.body));
    }
    const slots = [1, 2].map((period) => ({
      period_no: period,
      session: 'morning',
      start_time: `${String(6 + period).padStart(2, '0')}:00`,
      end_time: `${String(6 + period).padStart(2, '0')}:35`,
    }));
    assert.equal((await api('PUT', '/period-slots', principal.accessToken, { school_level: 'TH', slots })).status, 200);
    const version = await api('POST', '/timetable-versions', principal.accessToken, {
      school_level: 'TH',
      name: 'Học kỳ I',
      effective_from: '2026-09-07',
    });
    assert.equal(version.status, 201, JSON.stringify(version.body));
    const versionId = version.body.id as string;
    const lessons = await api(
      'PUT',
      `/timetable-versions/${versionId}/classes/${classes['1A']}/lessons`,
      principal.accessToken,
      {
        lessons: [
          { weekday: 1, period_no: 1, subject_id: subjects['TH-TV'] },
          { weekday: 1, period_no: 2, subject_id: subjects['TH-TOAN'] },
        ],
      },
    );
    assert.equal(lessons.status, 200, JSON.stringify(lessons.body));
    const published = await api('POST', `/timetable-versions/${versionId}/publish`, principal.accessToken);
    assert.equal(published.status, 200, JSON.stringify(published.body));

    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: 'ME', name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    for (const name of ['Học sinh An', 'Học sinh Bình']) {
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitId,
          full_name: name,
          dob: '2020-03-01',
          gender: 'female',
          national_id_encrypted: 'ma-hoa',
          national_id_hash: randomUUID(),
          national_id_last4: '0000',
          photo_consent: 'granted',
          status: 'active',
          enroll_date: '2026-09-05',
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      children.push(child.id);
      await schoolYear
        .insertInto('class_enrollments')
        .values({ child_id: child.id, class_id: classes['1A'] ?? '', from_date: '2026-09-05' })
        .execute();
    }
    const guardian = await schoolYear
      .insertInto('guardians')
      .values({ full_name: 'Mẹ học sinh An', phone: '0901234568', user_id: parents[0]?.userId ?? null })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('child_guardians')
      .values({
        child_id: children[0] ?? '',
        guardian_id: guardian.id,
        relationship_item_id: relationship.id,
        is_primary: true,
      })
      .execute();
    // Phụ huynh báo vắng cho học sinh Bình ngày thứ Hai
    await schoolYear
      .insertInto('absence_records')
      .values({
        child_id: children[1] ?? '',
        org_unit_id: unitId,
        absence_date: monday,
        reason: 'Ốm',
        is_advised: true,
        advised_at: new Date(),
        source: 'parent',
        reported_by: parents[1]?.userId ?? '',
      })
      .execute();
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-20d-2: giáo viên thấy tiết của mình theo thời khoá biểu; mặc định có mặt, có báo vắng thì vắng có phép', async () => {
    const mine = await api('GET', `/class-logs/mine?date=${monday}`, teachers[0]?.accessToken ?? '');
    assert.equal(mine.status, 200, JSON.stringify(mine.body));
    assert.deepEqual(
      (mine.body.lessons as Array<Record<string, unknown>>).map((lesson) => [lesson.period_no, lesson.log]),
      [[1, null]],
    );
    const empty = await api('GET', '/class-logs/mine?date=2026-10-20', teachers[0]?.accessToken ?? '');
    assert.deepEqual(empty.body.lessons, []);
    const detail = await api(
      'GET',
      `/class-logs/lesson?class_id=${classes['1A']}&date=${monday}&period_no=1`,
      teachers[0]?.accessToken ?? '',
    );
    assert.equal(detail.status, 200, JSON.stringify(detail.body));
    assert.equal(detail.body.can_edit, true);
    assert.deepEqual(
      (detail.body.students as Array<Record<string, unknown>>).map((student) => [
        student.full_name,
        student.status,
        student.absence_reason,
      ]),
      [
        ['Học sinh An', 'present', null],
        ['Học sinh Bình', 'absent_excused', 'Ốm'],
      ],
    );
    const missing = await api(
      'GET',
      `/class-logs/lesson?class_id=${classes['1A']}&date=${monday}&period_no=5`,
      teachers[0]?.accessToken ?? '',
    );
    assert.equal(missing.status, 404);
  });

  it('CT-20d-3: chỉ giáo viên dạy tiết ghi, ký; không ghi trước ngày dạy; học sinh phải thuộc lớp; ký rồi không sửa', async () => {
    const other = await api('PUT', '/class-logs', teachers[1]?.accessToken ?? '', lessonBody());
    assert.equal(other.status, 403);
    const future = await api(
      'PUT',
      '/class-logs',
      teachers[0]?.accessToken ?? '',
      lessonBody({ lesson_date: '2027-01-04' }),
    );
    assert.equal(future.status, 422);
    const stranger = await api(
      'PUT',
      '/class-logs',
      teachers[0]?.accessToken ?? '',
      lessonBody({ attendance: [{ child_id: randomUUID(), status: 'present' }] }),
    );
    assert.equal(stranger.status, 400);
    const noLesson = await api('PUT', '/class-logs', teachers[0]?.accessToken ?? '', lessonBody({ period_no: 3 }));
    assert.equal(noLesson.status, 422);

    const saved = await api('PUT', '/class-logs', teachers[0]?.accessToken ?? '', lessonBody());
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    logId = saved.body.id as string;
    assert.equal(saved.body.status, 'draft');
    const resaved = await api('PUT', '/class-logs', teachers[0]?.accessToken ?? '', lessonBody({ rating: 'B' }));
    assert.equal(resaved.body.id, logId);
    assert.equal(resaved.body.rating, 'B');

    assert.equal((await api('POST', `/class-logs/${logId}/sign`, teachers[1]?.accessToken ?? '')).status, 403);
    const signed = await api('POST', `/class-logs/${logId}/sign`, teachers[0]?.accessToken ?? '');
    assert.equal(signed.status, 200, JSON.stringify(signed.body));
    assert.equal(signed.body.status, 'signed');
    assert.equal((await api('PUT', '/class-logs', teachers[0]?.accessToken ?? '', lessonBody())).status, 422);
    assert.equal((await api('POST', `/class-logs/${logId}/sign`, teachers[0]?.accessToken ?? '')).status, 422);
  });

  it('CT-20d-4: xem sổ theo tuần; chỉ Ban giám hiệu ký sổ tuần, ký một lần, ký rồi khoá ghi tiết trong tuần', async () => {
    const week = await api('GET', `/class-logs/week?class_id=${classes['1A']}&date=2026-10-22`, viewer.accessToken);
    assert.equal(week.status, 200, JSON.stringify(week.body));
    assert.equal(week.body.week_start, monday);
    const days = week.body.days as Array<{ date: string; lessons: Array<Record<string, unknown>> }>;
    assert.deepEqual(
      days.map((day) => day.date),
      [monday],
    );
    assert.deepEqual(
      days[0]?.lessons.map((lesson) => [
        lesson.period_no,
        (lesson.log as Record<string, unknown> | null)?.status ?? null,
        lesson.absent_count,
        lesson.late_count,
      ]),
      [
        [1, 'signed', 1, 1],
        [2, null, 0, 0],
      ],
    );
    assert.equal(
      (await api('GET', `/class-logs/week?class_id=${classes['1A']}&date=${monday}`, parents[0]?.accessToken ?? ''))
        .status,
      403,
    );
    const body = { class_id: classes['1A'], date: monday, comment: 'Ghi đủ, sạch' };
    assert.equal((await api('POST', '/class-logs/reviews', teachers[0]?.accessToken ?? '', body)).status, 403);
    const review = await api('POST', '/class-logs/reviews', principal.accessToken, body);
    assert.equal(review.status, 201, JSON.stringify(review.body));
    assert.equal(review.body.lessons, 2);
    assert.equal(review.body.unsigned_lessons, 1);
    assert.equal((await api('POST', '/class-logs/reviews', principal.accessToken, body)).status, 422);
    const locked = await api(
      'PUT',
      '/class-logs',
      teachers[1]?.accessToken ?? '',
      lessonBody({ period_no: 2, attendance: [] }),
    );
    assert.equal(locked.status, 422);
    const after = await api('GET', `/class-logs/week?class_id=${classes['1A']}&date=${monday}`, viewer.accessToken);
    assert.equal((after.body.review as Record<string, unknown>).comment, 'Ghi đủ, sạch');
  });

  it('CT-20d-5: phụ huynh xem điểm danh theo tiết của con mình; tổng hợp chuyên cần đối chiếu báo vắng theo ngày', async () => {
    const own = await api(
      'GET',
      `/children/${children[0]}/period-attendance?month=2026-10`,
      parents[0]?.accessToken ?? '',
    );
    assert.equal(own.status, 200, JSON.stringify(own.body));
    assert.equal((own.body.counts as Record<string, number>).late, 1);
    assert.deepEqual(
      (own.body.records as Array<Record<string, unknown>>).map((record) => [record.lesson_date, record.status]),
      [[monday, 'late']],
    );
    assert.equal(
      (await api('GET', `/children/${children[0]}/period-attendance?month=2026-10`, parents[1]?.accessToken ?? ''))
        .status,
      403,
    );
    const summary = await api(
      'GET',
      `/period-attendance/summary?class_id=${classes['1A']}&from=2026-10-01&to=2026-10-31`,
      viewer.accessToken,
    );
    assert.equal(summary.status, 200, JSON.stringify(summary.body));
    assert.equal(summary.body.lessons, 1);
    const rows = summary.body.students as Array<Record<string, unknown>>;
    assert.deepEqual(
      rows.map((row) => [
        row.full_name,
        row.late,
        row.absent_excused,
        row.absent_days,
        row.notice_days,
        row.absent_without_notice_days,
      ]),
      [
        ['Học sinh An', 1, 0, 0, 0, 0],
        ['Học sinh Bình', 0, 1, 1, 1, 0],
      ],
    );
  });
});
