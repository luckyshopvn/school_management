import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import { sql, type Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { addDays, isoWeekday, parseChange } from './timetable-changes.js';
import {
  InProcessTimetableGenerationQueue,
  parseBusySlots,
  parseGeneratorSettings,
  parseSubjectRules,
  TimetableGenerationQueue,
} from './timetable-generator.js';

// Máy xếp thời khoá biểu, dạy thay, đổi tiết, báo cáo, mã tra cứu (DT-20 phần 22c2, YCTD-164); kịch bản CT-22c2-8 đến
// CT-22c2-13. Không có Redis nên máy xếp chạy ngay trong máy chủ API với cùng giao thức hàng đợi
describe('Kiểm tra dữ liệu gửi lên máy xếp', () => {
  it('CT-22c2-8: mức quan trọng 0 đến 10, giới hạn thời gian, số phương án; quy tắc môn; tiết bận; dạy thay, đổi tiết', () => {
    const settings = parseGeneratorSettings({
      weights: { double_period: 0, class_gaps: 10 },
      time_limit_seconds: 30,
      variant_count: 2,
    });
    assert.equal(settings.weights.double_period, 0);
    assert.equal(settings.weights.class_gaps, 10);
    assert.equal(settings.weights.spread_week, 6);
    for (const body of [
      { weights: { class_gaps: 11 }, time_limit_seconds: 30, variant_count: 2 },
      { weights: { class_gaps: 2.5 }, time_limit_seconds: 30, variant_count: 2 },
      { weights: {}, time_limit_seconds: 4, variant_count: 2 },
      { weights: {}, time_limit_seconds: 30, variant_count: 6 },
    ]) {
      assert.throws(() => parseGeneratorSettings(body), { code: 'ERR_VALIDATION' }, JSON.stringify(body));
    }
    assert.throws(() => parseSubjectRules({ rules: [{ subject_id: 'x' }] }), { code: 'ERR_VALIDATION' });
    assert.throws(
      () => parseSubjectRules({ rules: [{ subject_id: '00000000-0000-4000-8000-000000000000', max_per_day: 11 }] }),
      { code: 'ERR_VALIDATION' },
    );
    assert.deepEqual(
      parseBusySlots({
        slots: [
          { weekday: 1, period_no: 1 },
          { weekday: 1, period_no: 1 },
          { weekday: 2, period_no: 3 },
        ],
      }),
      [
        { weekday: 1, period_no: 1 },
        { weekday: 2, period_no: 3 },
      ],
    );
    assert.throws(() => parseBusySlots({ slots: [{ weekday: 8, period_no: 1 }] }), { code: 'ERR_VALIDATION' });
    const classId = '00000000-0000-4000-8000-000000000001';
    assert.throws(() => parseChange({ kind: 'substitute', date: '2026-09-14', class_id: classId, period_no: 1 }), {
      code: 'ERR_VALIDATION',
    });
    assert.throws(
      () =>
        parseChange({
          kind: 'swap',
          date: '2026-09-14',
          class_id: classId,
          period_no: 1,
          target_date: '2026-09-14',
          target_period_no: 1,
        }),
      { code: 'ERR_VALIDATION' },
    );
    assert.equal(isoWeekday('2026-09-13'), 7);
    assert.equal(isoWeekday('2026-09-14'), 1);
    assert.equal(addDays('2026-12-30', 3), '2027-01-02');
  });
});

describe('Điểm cuối máy xếp thời khoá biểu', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let viewer: LoggedInUser;
  let unitId = '';
  let roomId = '';
  let versionId = '';
  // Số tiết mỗi tuần của một lớp khối 1 theo chương trình mẫu
  let lessonsPerClass = 0;
  const teachers: LoggedInUser[] = [];
  const classes: Record<string, string> = {};
  const subjects: Record<string, string> = {};
  const url = (path: string) => `${environment.baseUrl}${path}`;
  const api = (method: string, path: string, token: string, body?: unknown) => sendJson(method, url(path), token, body);
  const list = (body: unknown) => body as unknown as Array<Record<string, unknown>>;
  const queue = () => environment.api.get(TimetableGenerationQueue) as InProcessTimetableGenerationQueue;
  // Ngày trong 7 ngày tới (để thay đổi hiện ở trang tra cứu) mà lớp 1A có tiết Tiếng Việt của giáo viên 1; tìm ở CT-22c2-12
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  let schoolDay = today;

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
        code: 'TH-22C2',
        name: 'Trường tiểu học thử máy xếp',
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
    for (const row of list((await api('GET', '/subjects?school_level=TH', principal.accessToken)).body)) {
      subjects[row.code as string] = row.id as string;
    }
    viewer = await environment.loginAs('VT-07', unitId);
    teachers.push(
      await environment.loginAs('VT-08', unitId),
      await environment.loginAs('VT-08', unitId),
      await environment.loginAs('VT-08', unitId),
    );
    for (const code of ['1A', '1B']) {
      classes[code] = (
        await schoolYear
          .insertInto('classes')
          .values({
            org_unit_id: unitId,
            academic_year_id: academicYearId,
            code,
            name: `Lớp ${code}`,
            grade_level: 'K1',
            school_level: 'TH',
            max_size: 35,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    roomId = (
      await schoolYear
        .insertInto('rooms')
        .values({ org_unit_id: unitId, code: 'P-AN', name: 'Phòng Âm nhạc', capacity: 40 })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    // Giáo viên 1 dạy Tiếng Việt lớp 1A, giáo viên 2 dạy Tiếng Việt lớp 1B; giáo viên 3 dạy Toán, Âm nhạc cả hai lớp
    for (const [classCode, subject, teacher] of [
      ['1A', 'TH-TV', 0],
      ['1B', 'TH-TV', 1],
      ['1A', 'TH-TOAN', 2],
      ['1B', 'TH-TOAN', 2],
      ['1A', 'TH-AN', 2],
      ['1B', 'TH-AN', 2],
    ] as const) {
      const assigned = await api('POST', `/classes/${classes[classCode]}/staff-assignments`, principal.accessToken, {
        staff_user_id: teachers[teacher]?.userId,
        assignment_role: 'subject',
        subject_id: subjects[subject],
      });
      assert.equal(assigned.status, 201, JSON.stringify(assigned.body));
    }
    const slots = [
      ...[1, 2, 3, 4].map((period) => ({ period_no: period, session: 'morning' })),
      ...[5, 6, 7].map((period) => ({ period_no: period, session: 'afternoon' })),
    ].map((slot) => ({
      ...slot,
      start_time: `${String(6 + slot.period_no).padStart(2, '0')}:00`,
      end_time: `${String(6 + slot.period_no).padStart(2, '0')}:40`,
    }));
    assert.equal((await api('PUT', '/period-slots', principal.accessToken, { school_level: 'TH', slots })).status, 200);
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-22c2-9: cài đặt ràng buộc, quy tắc môn, tiết bận; chỉ người lập thời khoá biểu; kiểm tra dữ liệu trước khi xếp', async () => {
    assert.equal((await api('GET', '/timetable-generator/settings?school_level=TH', viewer.accessToken)).status, 403);
    const defaults = await api('GET', '/timetable-generator/settings?school_level=TH', principal.accessToken);
    assert.equal(defaults.status, 200);
    assert.equal(defaults.body.time_limit_seconds, 60);
    assert.equal((defaults.body.soft_constraints as unknown[]).length, 5);
    const saved = await api('PUT', '/timetable-generator/settings', principal.accessToken, {
      school_level: 'TH',
      weights: { double_period: 8, avoid_last_period: 5, spread_week: 6, teacher_gaps: 2, class_gaps: 9 },
      time_limit_seconds: 5,
      variant_count: 2,
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal((saved.body.weights as Record<string, number>).class_gaps, 9);

    const rules = await api('PUT', '/timetable-generator/subject-rules', principal.accessToken, {
      school_level: 'TH',
      rules: [
        { subject_id: subjects['TH-TV'], double_period: true, avoid_last_period: false, max_per_day: 4 },
        { subject_id: subjects['TH-AN'], double_period: false, avoid_last_period: true, room_id: roomId },
      ],
    });
    assert.equal(rules.status, 200, JSON.stringify(rules.body));
    const music = list(rules.body.subjects).find((row) => row.subject_id === subjects['TH-AN']);
    assert.equal(music?.room_id, roomId);
    assert.equal(music?.avoid_last_period, true);

    const busyList = await api('GET', '/timetable-generator/teacher-busy?school_level=TH', principal.accessToken);
    assert.equal((busyList.body.teachers as unknown[]).length, 3);
    const busy = await api('PUT', `/timetable-generator/teacher-busy/${teachers[2]?.userId}`, principal.accessToken, {
      slots: [1, 2, 3, 4].map((period_no) => ({ weekday: 1, period_no })),
    });
    assert.equal(busy.status, 200, JSON.stringify(busy.body));

    const precheck = await api('GET', '/timetable-generator/precheck?school_level=TH', principal.accessToken);
    assert.equal(precheck.status, 200);
    assert.equal(precheck.body.classes, 2);
    assert.equal(precheck.body.teachers, 3);
    assert.equal(precheck.body.slots, 35);
    lessonsPerClass = (precheck.body.lessons as number) / 2;
    assert.ok(lessonsPerClass > 20 && lessonsPerClass <= 35);
    assert.deepEqual(
      list(precheck.body.issues).map((issue) => issue.code),
      ['missing_teacher'],
    );
  });

  it('CT-22c2-10: xếp chạy nền, nhiều phương án không vi phạm bắt buộc; chọn phương án thành bản nháp, ban hành', async () => {
    const started = await api('POST', '/timetable-generations', principal.accessToken, { school_level: 'TH' });
    assert.equal(started.status, 201, JSON.stringify(started.body));
    const runId = started.body.id as string;
    assert.equal(started.body.status, 'queued');
    await queue().settle(runId);
    const run = await api('GET', `/timetable-generations/${runId}`, principal.accessToken);
    assert.equal(run.status, 200);
    assert.equal(run.body.status, 'completed', JSON.stringify(run.body));
    assert.equal(run.body.percent, 100);
    const variants = list(run.body.variants);
    assert.ok(variants.length >= 1);
    assert.equal(variants[0]?.hard_count, 0, JSON.stringify(variants[0]?.violations));

    const detail = await api('GET', `/timetable-generations/${runId}/variants/1`, principal.accessToken);
    const lessons = list(detail.body.lessons);
    assert.equal(lessons.filter((lesson) => lesson.class_id === classes['1A']).length, lessonsPerClass);
    // Giáo viên 3 báo bận cả buổi sáng thứ Hai; Âm nhạc ở phòng riêng; Toán, Âm nhạc của giáo viên 3 không trùng tiết
    const third = lessons.filter((lesson) => lesson.teacher_user_id === teachers[2]?.userId);
    assert.ok(third.every((lesson) => !(lesson.weekday === 1 && (lesson.period_no as number) <= 4)));
    assert.equal(new Set(third.map((lesson) => `${lesson.weekday}:${lesson.period_no}`)).size, third.length);
    assert.ok(
      lessons.filter((lesson) => lesson.subject_id === subjects['TH-AN']).every((lesson) => lesson.room_id === roomId),
    );

    const applied = await api('POST', `/timetable-generations/${runId}/variants/1/apply`, principal.accessToken, {
      name: 'Bản máy xếp',
      effective_from: '2026-09-07',
    });
    assert.equal(applied.status, 200, JSON.stringify(applied.body));
    versionId = applied.body.id as string;
    assert.equal(applied.body.source, 'generator');
    assert.equal(applied.body.status, 'draft');
    const conflicts = list(
      (await api('GET', `/timetable-versions/${versionId}/conflicts`, principal.accessToken)).body,
    );
    assert.deepEqual(
      conflicts.filter((conflict) => conflict.severity === 'hard'),
      [],
    );
    const published = await api('POST', `/timetable-versions/${versionId}/publish`, principal.accessToken);
    assert.equal(published.status, 200, JSON.stringify(published.body));
    const listed = list((await api('GET', '/timetable-generations?school_level=TH', principal.accessToken)).body);
    assert.equal(listed[0]?.id, runId);
    const reread = list((await api('GET', `/timetable-generations/${runId}`, principal.accessToken)).body.variants);
    assert.equal(reread[0]?.version_id, versionId);
  });

  it('CT-22c2-11: chỉnh tay có kiểm tra ngay, không ghi; huỷ lần xếp', async () => {
    const draft = await api('POST', '/timetable-versions', principal.accessToken, {
      school_level: 'TH',
      name: 'Bản sửa tay',
      effective_from: '2027-01-18',
      copy_from_id: versionId,
    });
    const draftId = draft.body.id as string;
    const lessonsB = list(
      (await api('GET', `/timetable-versions/${draftId}/lessons?class_id=${classes['1B']}`, principal.accessToken)).body
        .lessons,
    );
    const lessonsA = list(
      (await api('GET', `/timetable-versions/${draftId}/lessons?class_id=${classes['1A']}`, principal.accessToken)).body
        .lessons,
    );
    // Đặt Toán của lớp 1A vào đúng tiết Toán của lớp 1B: giáo viên 3 trùng tiết
    const mathB = lessonsB.find((lesson) => lesson.subject_id === subjects['TH-TOAN']);
    const cells = lessonsA
      .filter((lesson) => !(lesson.weekday === mathB?.weekday && lesson.period_no === mathB?.period_no))
      .map((lesson) => ({ weekday: lesson.weekday, period_no: lesson.period_no, subject_id: lesson.subject_id }));
    cells.push({ weekday: mathB?.weekday, period_no: mathB?.period_no, subject_id: subjects['TH-TOAN'] });
    assert.equal(
      (
        await api('POST', `/timetable-versions/${draftId}/classes/${classes['1A']}/check`, viewer.accessToken, {
          lessons: cells,
        })
      ).status,
      403,
    );
    const checked = await api(
      'POST',
      `/timetable-versions/${draftId}/classes/${classes['1A']}/check`,
      principal.accessToken,
      {
        lessons: cells,
      },
    );
    assert.equal(checked.status, 200, JSON.stringify(checked.body));
    assert.ok(
      list(checked.body).some(
        (conflict) =>
          conflict.code === 'teacher_clash' &&
          conflict.weekday === mathB?.weekday &&
          conflict.period_no === mathB?.period_no,
      ),
    );
    // Không ghi: bản nháp vẫn không có xung đột cứng
    const conflicts = list((await api('GET', `/timetable-versions/${draftId}/conflicts`, principal.accessToken)).body);
    assert.equal(conflicts.filter((conflict) => conflict.severity === 'hard').length, 0);

    // Cấp đang có lần xếp chưa xong thì không mở lần khác; lần xếp chưa được nhận sau 10 phút thì ghi lỗi
    const stuck = await schoolYear
      .insertInto('timetable_generation_runs')
      .values({ school_level: 'TH', weights: '{}', time_limit_seconds: 5, variant_count: 1 })
      .returning('id')
      .executeTakeFirstOrThrow();
    const blocked = await api('POST', '/timetable-generations', principal.accessToken, { school_level: 'TH' });
    assert.equal(blocked.status, 422, JSON.stringify(blocked.body));
    await sql`update timetable_generation_runs set created_at = now() - interval '11 minutes'
      where id = ${stuck.id}`.execute(schoolYear);
    const failed = await api('GET', `/timetable-generations/${stuck.id}`, principal.accessToken);
    assert.equal(failed.body.status, 'failed');
    assert.match(failed.body.message as string, /chưa nhận lần xếp sau 10 phút/);

    // Huỷ lần xếp đang chờ
    const started = await api('POST', '/timetable-generations', principal.accessToken, { school_level: 'TH' });
    const runId = started.body.id as string;
    const cancelled = await api('POST', `/timetable-generations/${runId}/cancel`, principal.accessToken);
    assert.equal(cancelled.status, 200);
    await queue().settle(runId);
    const run = await api('GET', `/timetable-generations/${runId}`, principal.accessToken);
    assert.equal(run.body.status, 'cancelled', JSON.stringify(run.body));
  });

  it('CT-22c2-12: dạy thay, đổi tiết theo ngày, không sửa bản ban hành; chặn giáo viên trùng tiết; báo cáo tiết dạy, phòng', async () => {
    let day: Array<Record<string, unknown>> = [];
    for (let offset = 0; offset < 7; offset += 1) {
      schoolDay = addDays(today, offset);
      day = list(
        (await api('GET', `/timetable-changes/day?date=${schoolDay}&class_id=${classes['1A']}`, viewer.accessToken))
          .body,
      );
      if (day.some((lesson) => lesson.teacher_user_id === teachers[0]?.userId)) {
        break;
      }
    }
    assert.ok(day.length > 0);
    const tv = day.find((lesson) => lesson.teacher_user_id === teachers[0]?.userId) as Record<string, unknown>;
    // Giáo viên 2 đang dạy lớp 1B cùng tiết thì không dạy thay được
    const busyAtSamePeriod = list(
      (await api('GET', `/timetable-changes/day?date=${schoolDay}&class_id=${classes['1B']}`, viewer.accessToken)).body,
    ).find((lesson) => lesson.period_no === tv.period_no && lesson.teacher_user_id === teachers[1]?.userId);
    const substitute = busyAtSamePeriod ? teachers[2] : teachers[1];
    const blockedTeacher = busyAtSamePeriod ? teachers[1] : undefined;
    if (blockedTeacher) {
      const blocked = await api('POST', '/timetable-changes', principal.accessToken, {
        kind: 'substitute',
        date: schoolDay,
        class_id: classes['1A'],
        period_no: tv.period_no,
        teacher_user_id: blockedTeacher.userId,
      });
      assert.equal(blocked.status, 422, JSON.stringify(blocked.body));
    }
    assert.equal(
      (
        await api('POST', '/timetable-changes', viewer.accessToken, {
          kind: 'substitute',
          date: schoolDay,
          class_id: classes['1A'],
          period_no: tv.period_no,
          teacher_user_id: substitute?.userId,
        })
      ).status,
      403,
    );
    // Giáo viên dạy thay phải rảnh: chọn tiết mà người dạy thay không có tiết
    const substituteLessons = list(
      (
        await api(
          'GET',
          `/timetable-changes/day?date=${schoolDay}&teacher_user_id=${substitute?.userId}`,
          viewer.accessToken,
        )
      ).body,
    );
    const free = day.find(
      (lesson) =>
        lesson.teacher_user_id === teachers[0]?.userId &&
        !substituteLessons.some((other) => other.period_no === lesson.period_no),
    ) as Record<string, unknown>;
    const created = await api('POST', '/timetable-changes', principal.accessToken, {
      kind: 'substitute',
      date: schoolDay,
      class_id: classes['1A'],
      period_no: free.period_no,
      teacher_user_id: substitute?.userId,
      reason: 'Cô ốm',
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const duplicate = await api('POST', '/timetable-changes', principal.accessToken, {
      kind: 'substitute',
      date: schoolDay,
      class_id: classes['1A'],
      period_no: free.period_no,
      teacher_user_id: substitute?.userId,
    });
    assert.equal(duplicate.status, 422);
    const after = list(
      (await api('GET', `/timetable-changes/day?date=${schoolDay}&class_id=${classes['1A']}`, viewer.accessToken)).body,
    );
    const changed = after.find((lesson) => lesson.period_no === free.period_no);
    assert.equal(changed?.teacher_user_id, substitute?.userId);
    assert.equal((changed?.change as Record<string, unknown>).kind, 'substitute');
    // Sổ đầu bài (20d): lịch dạy của người dạy thay có tiết này, của giáo viên gốc không còn
    const mine = async (user: LoggedInUser | undefined) =>
      list((await api('GET', `/class-logs/mine?date=${schoolDay}`, user?.accessToken ?? '')).body.lessons);
    assert.ok(
      (await mine(substitute)).some(
        (lesson) => lesson.class_id === classes['1A'] && lesson.period_no === free.period_no,
      ),
    );
    assert.ok(
      !(await mine(teachers[0])).some(
        (lesson) => lesson.class_id === classes['1A'] && lesson.period_no === free.period_no,
      ),
    );
    // Bản ban hành giữ nguyên
    const published = list(
      (await api('GET', `/timetable-versions/${versionId}/lessons?class_id=${classes['1A']}`, viewer.accessToken)).body
        .lessons,
    );
    assert.equal(
      published.find((lesson) => lesson.weekday === isoWeekday(schoolDay) && lesson.period_no === free.period_no)
        ?.teacher_user_id,
      teachers[0]?.userId,
    );

    // Đổi tiết: hai tiết khác môn của lớp 1B trong cùng ngày; tránh giáo viên 3 (dạy cả lớp 1A) và người vừa dạy thay để không vướng tiết của lớp
    // khác
    const dayB = list(
      (await api('GET', `/timetable-changes/day?date=${schoolDay}&class_id=${classes['1B']}`, viewer.accessToken)).body,
    ).filter(
      (lesson) =>
        lesson.teacher_user_id !== teachers[2]?.userId &&
        lesson.teacher_user_id !== substitute?.userId &&
        !lesson.change,
    );
    const first = dayB[0] as Record<string, unknown>;
    const second = dayB.find((lesson) => lesson.subject_name !== first.subject_name) as Record<string, unknown>;
    const swap = await api('POST', '/timetable-changes', principal.accessToken, {
      kind: 'swap',
      date: schoolDay,
      class_id: classes['1B'],
      period_no: first.period_no,
      target_date: schoolDay,
      target_period_no: second.period_no,
    });
    assert.equal(swap.status, 201, JSON.stringify(swap.body));
    assert.equal(list(swap.body).length, 2);
    const swapped = list(
      (await api('GET', `/timetable-changes/day?date=${schoolDay}&class_id=${classes['1B']}`, viewer.accessToken)).body,
    );
    assert.equal(swapped.find((lesson) => lesson.period_no === first.period_no)?.subject_name, second.subject_name);
    assert.equal(swapped.find((lesson) => lesson.period_no === second.period_no)?.subject_name, first.subject_name);

    const changes = list(
      (await api('GET', `/timetable-changes?from=${schoolDay}&to=${schoolDay}`, viewer.accessToken)).body,
    );
    assert.equal(changes.length, 3);

    const report = await api(
      'GET',
      `/timetable-reports/teaching?from=${schoolDay}&to=${schoolDay}`,
      viewer.accessToken,
    );
    assert.equal(report.status, 200);
    const rows = list(report.body.teachers);
    const firstTeacher = rows.find((row) => row.teacher_user_id === teachers[0]?.userId);
    assert.equal(firstTeacher?.substituted_away, 1);
    assert.equal(firstTeacher?.actual, (firstTeacher?.planned as number) - 1);
    assert.equal(rows.find((row) => row.teacher_user_id === substitute?.userId)?.substitute_taught, 1);
    assert.equal(
      (await api('GET', '/timetable-reports/teaching?from=2026-09-01&to=2026-12-31', viewer.accessToken)).status,
      400,
    );

    const rooms = await api('GET', '/timetable-reports/rooms', viewer.accessToken);
    assert.equal(rooms.status, 200);
    const music = list(rooms.body.rooms).find((room) => room.room_id === roomId);
    assert.equal(music?.periods, 2);
    assert.equal(rooms.body.slot_count, 35);

    // Xoá đổi tiết xoá cả cặp
    const swapRow = changes.find((change) => change.kind === 'swap') as Record<string, unknown>;
    assert.equal((await api('DELETE', `/timetable-changes/${swapRow.id}`, principal.accessToken)).status, 204);
    assert.equal(
      list((await api('GET', `/timetable-changes?from=${schoolDay}&to=${schoolDay}`, viewer.accessToken)).body).length,
      1,
    );
  });

  it('CT-22c2-13: mã tra cứu của lớp, giáo viên: trang công khai không cần đăng nhập; thu hồi thì hết hiệu lực', async () => {
    assert.equal(
      (
        await api('POST', '/timetable-lookup-codes', viewer.accessToken, {
          kind: 'class',
          target_id: classes['1A'],
        })
      ).status,
      403,
    );
    const created = await api('POST', '/timetable-lookup-codes', principal.accessToken, {
      kind: 'class',
      target_id: classes['1A'],
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const code = created.body.code as string;
    assert.match(code, /^[A-Za-z0-9_-]{12}$/);
    const again = await api('POST', '/timetable-lookup-codes', principal.accessToken, {
      kind: 'class',
      target_id: classes['1A'],
    });
    assert.equal(again.body.code, code);
    const teacherCode = await api('POST', '/timetable-lookup-codes', principal.accessToken, {
      kind: 'teacher',
      target_id: teachers[2]?.userId,
    });
    assert.equal(teacherCode.status, 201);

    const publicView = await fetch(url(`/public/timetable-lookup/${code}`));
    assert.equal(publicView.status, 200);
    const body = (await publicView.json()) as Record<string, unknown>;
    assert.equal(body.kind, 'class');
    assert.equal(body.target_name, 'Lớp 1A');
    assert.equal((body.lessons as unknown[]).length, lessonsPerClass);
    assert.equal((body.changes as unknown[]).length, 1);
    const teacherView = (await (
      await fetch(url(`/public/timetable-lookup/${teacherCode.body.code}`))
    ).json()) as Record<string, unknown>;
    assert.ok((teacherView.lessons as Array<Record<string, unknown>>).every((lesson) => lesson.class_name));

    assert.equal(
      (await api('DELETE', `/timetable-lookup-codes/${created.body.id}`, principal.accessToken)).status,
      204,
    );
    assert.equal((await fetch(url(`/public/timetable-lookup/${code}`))).status, 404);
    assert.equal((await fetch(url('/public/timetable-lookup/khong-hop-le!'))).status, 404);
    assert.equal(list((await api('GET', '/timetable-lookup-codes', principal.accessToken)).body).length, 1);
  });
});
