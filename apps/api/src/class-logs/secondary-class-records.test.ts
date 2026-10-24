import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import {
  arrangeSeats,
  hasLevelFeature,
  lessonRatingIssue,
  listPortalMenuEntries,
  portalWorkspacesForLevels,
  rotateSeats,
  seatingIssues,
  type LessonRatingSettings,
} from '@school-management/shared';
import type { Kysely } from 'kysely';
import { defaultConductCriteria, rankClasses } from '../conduct/conduct-calc.js';
import { parseSeatingInput } from '../seating/seating.js';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { parseClassLogInput, parseRatingSettings } from './class-logs.js';

// Sổ đầu bài, điểm danh theo tiết THCS, THPT; sơ đồ chỗ ngồi; thi đua lớp, sao đỏ (DT-21 phần 21d, YCTD-171); kịch bản
// CT-21d-1 đến CT-21d-5
const secondary: LessonRatingSettings = {
  rating_mode: 'required',
  rating_labels: { A: 'Tốt', B: 'Khá', C: 'Trung bình', D: 'Chưa đạt' },
  low_rating_comment: true,
  conduct_points: { A: 2, B: 0, C: -2, D: -5 },
};

describe('Quy tắc sổ đầu bài, sơ đồ chỗ ngồi, thi đua lớp cấp THCS, THPT', () => {
  it('CT-21d-1: xếp loại tiết theo cấp; xếp, xoay vòng chỗ ngồi; tiêu chí mặc định; điểm tiết vào thi đua; menu theo cấp', () => {
    // Bắt buộc xếp loại chỉ kiểm lúc ký; tiết C, D phải có nhận xét; cấp không xếp loại thì không nhận xếp loại
    assert.equal(lessonRatingIssue(secondary, { rating: null, comment: null }, false), null);
    assert.equal(
      lessonRatingIssue(secondary, { rating: null, comment: null }, true),
      'Cần xếp loại tiết trước khi ký sổ',
    );
    assert.equal(
      lessonRatingIssue(secondary, { rating: 'C', comment: ' ' }, false),
      'Tiết xếp loại C cần ghi nhận xét tiết',
    );
    assert.equal(lessonRatingIssue(secondary, { rating: 'D', comment: 'Lớp ồn' }, true), null);
    assert.equal(
      lessonRatingIssue({ ...secondary, low_rating_comment: false }, { rating: 'C', comment: null }, true),
      null,
    );
    assert.equal(
      lessonRatingIssue({ ...secondary, rating_mode: 'off' }, { rating: 'A', comment: null }, false),
      'Cấp học này không xếp loại tiết',
    );
    // Nhóm học của tiết: mặc định 0, ngoài 0 đến 9 bị từ chối
    const base = {
      class_id: randomUUID(),
      lesson_date: '2026-10-19',
      period_no: 2,
      lesson_title: 'Bài 3',
      attendance: [],
    };
    assert.equal(parseClassLogInput(base).group_no, 0);
    assert.equal(parseClassLogInput({ ...base, group_no: 2 }).group_no, 2);
    assert.throws(() => parseClassLogInput({ ...base, group_no: 10 }), { code: 'ERR_VALIDATION' });
    assert.throws(
      () =>
        parseRatingSettings({
          school_level: 'MN',
          rating_mode: 'sometimes',
          rating_labels: { A: 'Tốt' },
          low_rating_comment: 'yes',
          conduct_points: { A: 50 },
        }),
      { code: 'ERR_VALIDATION' },
    );

    // Sơ đồ 2 dãy, 2 bàn, 2 chỗ: xếp theo danh sách lấp từng bàn đầu; xoay theo dãy, theo bàn; lỗi chỗ trùng, ngoài lưới
    const layout = { desk_columns: 2, desk_rows: 2, seats_per_desk: 2 };
    const arranged = arrangeSeats(['a', 'b', 'c', 'd', 'e'], layout);
    assert.deepEqual(
      arranged.map((seat) => [seat.child_id, seat.column_no, seat.row_no, seat.seat_no]),
      [
        ['a', 1, 1, 1],
        ['b', 1, 1, 2],
        ['c', 2, 1, 1],
        ['d', 2, 1, 2],
        ['e', 1, 2, 1],
      ],
    );
    assert.throws(() => arrangeSeats(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'], layout));
    assert.deepEqual(
      rotateSeats(arranged, layout, 'columns').map((seat) => [seat.child_id, seat.column_no, seat.row_no]),
      [
        ['a', 2, 1],
        ['b', 2, 1],
        ['c', 1, 1],
        ['d', 1, 1],
        ['e', 2, 2],
      ],
    );
    assert.deepEqual(
      rotateSeats(arranged, layout, 'rows').map((seat) => seat.row_no),
      [2, 2, 2, 2, 1],
    );
    assert.equal(seatingIssues(arranged, layout).length, 0);
    assert.equal(
      seatingIssues(
        [
          { child_id: 'a', column_no: 1, row_no: 1, seat_no: 1 },
          { child_id: 'b', column_no: 1, row_no: 1, seat_no: 1 },
          { child_id: 'c', column_no: 3, row_no: 1, seat_no: 1 },
        ],
        layout,
      ).length,
      2,
    );
    assert.throws(
      () =>
        parseSeatingInput({
          class_id: randomUUID(),
          effective_from: '2026-10-19',
          desk_columns: 2,
          desk_rows: 2,
          seats_per_desk: 2,
          assignments: [
            { child_id: randomUUID(), column_no: 1, row_no: 1, seat_no: 1 },
            { child_id: randomUUID(), column_no: 1, row_no: 1, seat_no: 1 },
          ],
        }),
      { code: 'ERR_VALIDATION' },
    );

    // Tiêu chí mặc định THCS, THPT mang tiền tố cấp (mã duy nhất toàn trường); Tiểu học giữ bộ của 20b
    assert.ok(defaultConductCriteria('THPT').every((item) => item.code.startsWith('THPT-')));
    assert.ok(defaultConductCriteria('TH').some((item) => item.code === 'DI_MUON'));
    // Điểm tiết cộng vào điểm tuần, tách riêng ở cột điểm tiết
    const week = { from: '2026-10-19', to: '2026-10-25', weeks: ['2026-10-19'] };
    const ranked = rankClasses(
      [
        { class_id: 'a', class_name: '10A', grade_level: 'K10' },
        { class_id: 'b', class_name: '10B', grade_level: 'K10' },
      ],
      [{ class_id: 'a', entry_date: '2026-10-20', points: -2 }],
      week,
      100,
      [
        { class_id: 'a', entry_date: '2026-10-19', points: 2 },
        { class_id: 'b', entry_date: '2026-10-19', points: -5 },
      ],
    );
    assert.deepEqual(
      ranked.map((row) => [row.class_name, row.score, row.lesson_points, row.rank]),
      [
        ['10A', 100, 2, 1],
        ['10B', 95, -5, 2],
      ],
    );

    // Menu: sổ đầu bài, chuyên cần, nề nếp dùng chung ba cấp; sơ đồ chỗ ngồi chỉ THCS, THPT; Mầm non không có
    const shown = (level: 'MN' | 'TH' | 'THCS' | 'THPT') =>
      listPortalMenuEntries(portalWorkspacesForLevels([{ code: level, display_name: level }])).map(
        (entry) => entry.node.path,
      );
    for (const level of ['THCS', 'THPT'] as const) {
      for (const path of ['/class-logs', '/period-attendance', '/conduct', '/seating-charts']) {
        assert.ok(shown(level).includes(path as never), `${level} thiếu ${path}`);
      }
      assert.equal(hasLevelFeature(level, 'period_attendance'), true);
    }
    assert.ok(shown('TH').includes('/class-logs'));
    assert.ok(!shown('TH').includes('/seating-charts'));
    for (const path of ['/class-logs', '/conduct', '/seating-charts']) {
      assert.ok(!shown('MN').includes(path as never), `MN không có ${path}`);
    }
  });
});

describe('Điểm cuối sổ đầu bài, sơ đồ chỗ ngồi, sao đỏ THPT', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let homeroom: LoggedInUser;
  let unitId = '';
  let academicYearId = '';
  const teachers: LoggedInUser[] = [];
  const classes: Record<string, string> = {};
  const subjects: Record<string, string> = {};
  const children: Record<string, string> = {};
  // Thứ Hai đã qua trong học kỳ I; bản thời khoá biểu áp dụng từ 07/09/2026
  const monday = '2026-10-19';
  const url = (path: string) => `${environment.baseUrl}${path}`;
  const api = (method: string, path: string, token: string, body?: unknown) => sendJson(method, url(path), token, body);
  const list = (body: unknown) => body as unknown as Array<Record<string, unknown>>;
  const errorOf = (body: Record<string, unknown>) => (body.error ?? {}) as { code?: string; message?: string };

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    academicYearId = await openTestAcademicYear(environment, principal.accessToken, '2026-2027', {
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
        code: 'THPT-21D',
        name: 'Trường THPT thử',
        unit_type: 'truong_chinh',
      })
    ).body.id as string;
    const current = await api('GET', '/school-levels', principal.accessToken);
    const levels = (current.body.levels as Array<Record<string, unknown>>).map(
      ({ code, order_no, display_name, learner_term, context_label }) => ({
        code,
        is_enabled: code === 'MN' || code === 'THPT',
        order_no,
        display_name,
        learner_term,
        context_label,
      }),
    );
    assert.equal((await api('PUT', '/school-levels', principal.accessToken, { levels })).status, 200);
    for (const path of ['/grade-levels/templates', '/subjects/templates']) {
      assert.equal((await api('POST', path, principal.accessToken, { school_level: 'THPT' })).status, 200);
    }
    for (const row of list((await api('GET', '/subjects?school_level=THPT', principal.accessToken)).body)) {
      subjects[row.code as string] = row.id as string;
    }
    homeroom = await environment.loginAs('VT-07', unitId);
    teachers.push(
      await environment.loginAs('VT-08', unitId),
      await environment.loginAs('VT-08', unitId),
      await environment.loginAs('VT-08', unitId),
    );
    for (const name of ['10A', '10B']) {
      classes[name] = (
        await schoolYear
          .insertInto('classes')
          .values({
            org_unit_id: unitId,
            academic_year_id: academicYearId,
            code: name,
            name: `Lớp ${name}`,
            grade_level: 'K10',
            school_level: 'THPT',
            max_size: 45,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    for (const [subject, teacher] of [
      ['THPT-TOAN', 0],
      ['THPT-VL', 1],
      ['THPT-DL', 2],
    ] as const) {
      const assigned = await api('POST', `/classes/${classes['10A']}/staff-assignments`, principal.accessToken, {
        staff_user_id: teachers[teacher]?.userId,
        assignment_role: 'subject',
        subject_id: subjects[subject],
      });
      assert.equal(assigned.status, 201, JSON.stringify(assigned.body));
    }
    const chu = await api('POST', `/classes/${classes['10A']}/staff-assignments`, principal.accessToken, {
      staff_user_id: homeroom.userId,
      assignment_role: 'homeroom',
    });
    assert.equal(chu.status, 201, JSON.stringify(chu.body));
    const combinations: Record<string, string> = {};
    for (const [code, codes] of [
      ['TH-TN', ['THPT-VL', 'THPT-HH', 'THPT-SH', 'THPT-TIN']],
      ['TH-XH', ['THPT-DL', 'THPT-GDKTPL', 'THPT-AN', 'THPT-MT']],
    ] as const) {
      const created = await api('POST', '/subject-combinations', principal.accessToken, {
        code,
        name: `Tổ hợp ${code}`,
        subject_ids: codes.map((subject) => subjects[subject]),
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      combinations[code] = created.body.id as string;
    }
    for (const [key, className, combination] of [
      ['TN', '10A', 'TH-TN'],
      ['XH', '10A', 'TH-XH'],
      ['none', '10A', null],
      ['saoDo', '10B', null],
    ] as const) {
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitId,
          full_name: `Học sinh ${key}`,
          dob: '2010-03-01',
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
      children[key] = child.id;
      await schoolYear
        .insertInto('class_enrollments')
        .values({ child_id: child.id, class_id: classes[className] ?? '', from_date: '2026-09-05' })
        .execute();
      if (combination) {
        const registered = await api('PUT', `/children/${child.id}/subject-combination`, principal.accessToken, {
          combination_id: combinations[combination],
        });
        assert.equal(registered.status, 200, JSON.stringify(registered.body));
      }
    }
    const slots = [1, 2, 3].map((period) => ({
      period_no: period,
      session: 'morning',
      start_time: `${String(6 + period).padStart(2, '0')}:00`,
      end_time: `${String(6 + period).padStart(2, '0')}:45`,
    }));
    assert.equal(
      (await api('PUT', '/period-slots', principal.accessToken, { school_level: 'THPT', slots })).status,
      200,
    );
    const version = await api('POST', '/timetable-versions', principal.accessToken, {
      school_level: 'THPT',
      name: 'Học kỳ I',
      effective_from: '2026-09-07',
    });
    assert.equal(version.status, 201, JSON.stringify(version.body));
    const versionId = version.body.id as string;
    const lessons = await api(
      'PUT',
      `/timetable-versions/${versionId}/classes/${classes['10A']}/lessons`,
      principal.accessToken,
      {
        lessons: [
          { weekday: 1, period_no: 1, subject_id: subjects['THPT-TOAN'] },
          { weekday: 1, period_no: 2, subject_id: subjects['THPT-VL'], group_no: 1 },
          { weekday: 1, period_no: 2, subject_id: subjects['THPT-DL'], group_no: 2 },
        ],
      },
    );
    assert.equal(lessons.status, 200, JSON.stringify(lessons.body));
    const published = await api('POST', `/timetable-versions/${versionId}/publish`, principal.accessToken);
    assert.equal(published.status, 200, JSON.stringify(published.body));
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-21d-2: tiết nhóm ghi sổ riêng, điểm danh học sinh có môn trong tổ hợp; tuần hiện từng nhóm', async () => {
    const physics = teachers[1]?.accessToken ?? '';
    const mine = await api('GET', `/class-logs/mine?date=${monday}`, physics);
    assert.equal(mine.status, 200, JSON.stringify(mine.body));
    assert.deepEqual(
      list(mine.body.lessons).map((lesson) => [lesson.period_no, lesson.group_no]),
      [[2, 1]],
    );
    const detail = await api(
      'GET',
      `/class-logs/lesson?class_id=${classes['10A']}&date=${monday}&period_no=2&group_no=1`,
      physics,
    );
    assert.equal(detail.status, 200, JSON.stringify(detail.body));
    assert.equal(detail.body.group_filtered, true);
    assert.deepEqual(
      list(detail.body.students).map((student) => student.child_id),
      [children.TN],
    );
    assert.equal((detail.body.rating as Record<string, unknown>).rating_mode, 'required');
    const saved = await api('PUT', '/class-logs', physics, {
      class_id: classes['10A'],
      lesson_date: monday,
      period_no: 2,
      group_no: 1,
      lesson_title: 'Bài 4: Chuyển động thẳng',
      rating: 'A',
      attendance: [{ child_id: children.TN, status: 'late' }],
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.group_no, 1);
    // Giáo viên Địa lí ghi nhóm 2 cùng tiết, không đụng sổ nhóm 1
    const geography = await api('PUT', '/class-logs', teachers[2]?.accessToken ?? '', {
      class_id: classes['10A'],
      lesson_date: monday,
      period_no: 2,
      group_no: 2,
      lesson_title: 'Bài 2: Bản đồ',
      rating: 'B',
      attendance: [{ child_id: children.XH, status: 'present' }],
    });
    assert.equal(geography.status, 200, JSON.stringify(geography.body));
    // Giáo viên Vật lí không ghi được nhóm 2
    const wrongGroup = await api('PUT', '/class-logs', physics, {
      class_id: classes['10A'],
      lesson_date: monday,
      period_no: 2,
      group_no: 2,
      lesson_title: 'Ghi nhầm',
      attendance: [],
    });
    assert.equal(wrongGroup.status, 403, JSON.stringify(wrongGroup.body));
    const week = await api('GET', `/class-logs/week?class_id=${classes['10A']}&date=${monday}`, principal.accessToken);
    assert.equal(week.status, 200, JSON.stringify(week.body));
    const day = list(week.body.days)[0] as { lessons: Array<Record<string, unknown>> };
    assert.deepEqual(
      day.lessons.map((lesson) => [
        lesson.period_no,
        lesson.group_no,
        (lesson.log as { lesson_title?: string })?.lesson_title ?? null,
      ]),
      [
        [1, 0, null],
        [2, 1, 'Bài 4: Chuyển động thẳng'],
        [2, 2, 'Bài 2: Bản đồ'],
      ],
    );
  });

  it('CT-21d-3: THPT bắt buộc xếp loại khi ký, tiết C phải nhận xét; Ban giám hiệu sửa quy tắc; xuất sổ tuần', async () => {
    const math = teachers[0]?.accessToken ?? '';
    const body = {
      class_id: classes['10A'],
      lesson_date: monday,
      period_no: 1,
      lesson_title: 'Bài 1: Mệnh đề',
      attendance: [{ child_id: children.none, status: 'absent_unexcused' }],
    };
    const lowWithoutComment = await api('PUT', '/class-logs', math, { ...body, rating: 'C' });
    assert.equal(lowWithoutComment.status, 422, JSON.stringify(lowWithoutComment.body));
    assert.equal(errorOf(lowWithoutComment.body).message, 'Tiết xếp loại C cần ghi nhận xét tiết');
    const draft = await api('PUT', '/class-logs', math, body);
    assert.equal(draft.status, 200, JSON.stringify(draft.body));
    const unsigned = await api('POST', `/class-logs/${draft.body.id}/sign`, math);
    assert.equal(unsigned.status, 422, JSON.stringify(unsigned.body));
    assert.equal(errorOf(unsigned.body).message, 'Cần xếp loại tiết trước khi ký sổ');
    assert.equal(
      (await api('PUT', '/class-logs', math, { ...body, rating: 'C', comment: 'Lớp mất trật tự' })).status,
      200,
    );
    assert.equal((await api('POST', `/class-logs/${draft.body.id}/sign`, math)).status, 200);

    // Giáo viên không sửa được quy tắc; Ban giám hiệu đổi nhãn và điểm thi đua của THPT, Tiểu học giữ mặc định
    const settingsBody = {
      school_level: 'THPT',
      rating_mode: 'required',
      rating_labels: { A: 'Giỏi', B: 'Khá', C: 'Trung bình', D: 'Yếu' },
      low_rating_comment: true,
      conduct_points: { A: 3, B: 1, C: -2, D: -5 },
    };
    assert.equal((await api('PUT', '/class-logs/settings', math, settingsBody)).status, 403);
    const updated = await api('PUT', '/class-logs/settings', principal.accessToken, settingsBody);
    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    const all = list((await api('GET', '/class-logs/settings', math)).body);
    assert.deepEqual(
      all.map((row) => [row.school_level, row.rating_mode, (row.rating_labels as Record<string, string>).A]),
      [
        ['TH', 'optional', 'Tốt'],
        ['THCS', 'required', 'Tốt'],
        ['THPT', 'required', 'Giỏi'],
      ],
    );
    const exported = await fetch(url(`/class-logs/week/export?class_id=${classes['10A']}&date=${monday}&format=xlsx`), {
      headers: { authorization: `Bearer ${principal.accessToken}` },
    });
    assert.equal(exported.status, 200);
    assert.match(exported.headers.get('content-disposition') ?? '', /so-dau-bai-2026-10-19/);
    assert.ok(exported.headers.get('x-export-log-id'));
  });

  it('CT-21d-4: chủ nhiệm xếp sơ đồ theo tên, xoay vòng theo dãy; giáo viên bộ môn chỉ xem; tiết kèm sơ đồ đang dùng; in PDF', async () => {
    const layout = { desk_columns: 2, desk_rows: 3, seats_per_desk: 2 };
    const subjectTeacher = teachers[1]?.accessToken ?? '';
    const denied = await api('POST', '/seating-charts', subjectTeacher, {
      class_id: classes['10A'],
      effective_from: '2026-09-07',
      mode: 'by_name',
      ...layout,
    });
    assert.equal(denied.status, 403, JSON.stringify(denied.body));
    const first = await api('POST', '/seating-charts', homeroom.accessToken, {
      class_id: classes['10A'],
      effective_from: '2026-09-07',
      mode: 'by_name',
      ...layout,
    });
    assert.equal(first.status, 201, JSON.stringify(first.body));
    // Theo tên: Học sinh none, Học sinh TN, Học sinh XH
    assert.deepEqual(
      list(first.body.assignments).map((seat) => [seat.full_name, seat.column_no, seat.row_no, seat.seat_no]),
      [
        ['Học sinh none', 1, 1, 1],
        ['Học sinh TN', 1, 1, 2],
        ['Học sinh XH', 2, 1, 1],
      ],
    );
    const rotated = await api('POST', '/seating-charts', homeroom.accessToken, {
      class_id: classes['10A'],
      effective_from: '2026-10-19',
      mode: 'rotate',
      from_chart_id: first.body.id,
      rotate: 'columns',
      ...layout,
    });
    assert.equal(rotated.status, 201, JSON.stringify(rotated.body));
    assert.deepEqual(
      list(rotated.body.assignments).map((seat) => [seat.full_name, seat.column_no]),
      [
        ['Học sinh XH', 1],
        ['Học sinh none', 2],
        ['Học sinh TN', 2],
      ],
    );
    // Cùng ngày áp dụng thì không lập thêm; học sinh lớp khác bị từ chối
    const duplicate = await api('POST', '/seating-charts', homeroom.accessToken, {
      class_id: classes['10A'],
      effective_from: '2026-10-19',
      mode: 'by_name',
      ...layout,
    });
    assert.equal(duplicate.status, 422, JSON.stringify(duplicate.body));
    const outsider = await api('PUT', `/seating-charts/${rotated.body.id}`, homeroom.accessToken, {
      effective_from: '2026-10-19',
      ...layout,
      assignments: [{ child_id: children.saoDo, column_no: 1, row_no: 1, seat_no: 1 }],
    });
    assert.equal(outsider.status, 400, JSON.stringify(outsider.body));
    const listed = await api('GET', `/seating-charts?class_id=${classes['10A']}&date=2026-10-20`, subjectTeacher);
    assert.equal(listed.status, 200, JSON.stringify(listed.body));
    assert.equal(listed.body.can_manage, false);
    assert.equal(listed.body.current_chart_id, rotated.body.id);
    // Tiết ngày trước khi xoay vòng dùng bản cũ
    const lesson = await api(
      'GET',
      `/class-logs/lesson?class_id=${classes['10A']}&date=2026-09-14&period_no=1`,
      teachers[0]?.accessToken ?? '',
    );
    assert.equal(lesson.status, 200, JSON.stringify(lesson.body));
    assert.equal((lesson.body.seating as Record<string, unknown>).id, first.body.id);
    const printed = await fetch(url(`/seating-charts/${rotated.body.id}/export?format=pdf`), {
      headers: { authorization: `Bearer ${homeroom.accessToken}` },
    });
    assert.equal(printed.status, 200);
    assert.equal(printed.headers.get('content-type'), 'application/pdf');
  });

  it('CT-21d-5: đội sao đỏ; sao đỏ báo lỗi lớp khác, không chấm lớp mình; xếp hạng THPT cộng điểm theo xếp loại tiết', async () => {
    assert.equal(
      (await api('PUT', '/conduct/settings', principal.accessToken, { enabled: true, base_points: 100 })).status,
      200,
    );
    const defaults = await api('POST', '/conduct/criteria/defaults', principal.accessToken, { school_level: 'THPT' });
    assert.equal(defaults.status, 200, JSON.stringify(defaults.body));
    const criteria = list((await api('GET', '/conduct/criteria?school_level=THPT', principal.accessToken)).body);
    const late = criteria.find((row) => row.code === 'THPT-DI_MUON');
    assert.ok(late);
    const member = await api('PUT', `/conduct/red-stars/${children.saoDo}`, principal.accessToken, {
      duty: 'Theo dõi khối 10',
    });
    assert.equal(member.status, 200, JSON.stringify(member.body));
    const team = list((await api('GET', '/conduct/red-stars?school_level=THPT', principal.accessToken)).body);
    assert.deepEqual(
      team.map((row) => [row.full_name, row.class_name, row.status]),
      [['Học sinh saoDo', 'Lớp 10B', 'active']],
    );
    const entry = (classId: string | undefined, reporter: string | undefined) =>
      api('POST', '/conduct/entries', principal.accessToken, {
        class_id: classId,
        criterion_id: late?.id,
        date: monday,
        reporter_child_id: reporter,
      });
    const recorded = await entry(classes['10A'], children.saoDo);
    assert.equal(recorded.status, 201, JSON.stringify(recorded.body));
    const ownClass = await entry(classes['10B'], children.saoDo);
    assert.equal(ownClass.status, 422, JSON.stringify(ownClass.body));
    assert.equal(errorOf(ownClass.body).message, 'Sao đỏ không chấm lớp mình');
    const notMember = await entry(classes['10B'], children.TN);
    assert.equal(notMember.status, 422, JSON.stringify(notMember.body));
    const entries = list(
      (await api('GET', `/conduct/entries?from=${monday}&class_id=${classes['10A']}`, principal.accessToken)).body,
    );
    assert.equal(entries[0]?.reporter_name, 'Học sinh saoDo');
    // Lớp 10A trong tuần: tiết A (3), B (1), C (-2) theo điểm đã sửa ở CT-21d-3, đi muộn -1: 100 + 2 - 1 = 101
    const ranking = await api(
      'GET',
      `/conduct/ranking?period=week&date=${monday}&school_level=THPT`,
      principal.accessToken,
    );
    assert.equal(ranking.status, 200, JSON.stringify(ranking.body));
    assert.deepEqual(
      list(ranking.body.classes).map((row) => [row.class_name, row.lesson_points, row.score, row.rank]),
      [
        ['Lớp 10A', 2, 101, 1],
        ['Lớp 10B', 0, 100, 2],
      ],
    );
    // Sao đỏ ngừng hoạt động thì không báo được nữa
    await api('PUT', `/conduct/red-stars/${children.saoDo}`, principal.accessToken, { status: 'inactive' });
    assert.equal((await entry(classes['10A'], children.saoDo)).status, 422);
  });
});
