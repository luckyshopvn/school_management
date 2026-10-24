import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import {
  assignRoomIndexes,
  examNumber,
  GRADUATION_DEFAULTS,
  graduationEligibility,
  graduationScore,
  schoolAverage,
  validateGraduationConfig,
} from '@school-management/shared';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';

// Xét tốt nghiệp THCS, THPT và hồ sơ thi (DT-21 phần 21f, YCTD-174); kịch bản CT-21f-1 đến CT-21f-5
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const thpt = GRADUATION_DEFAULTS.THPT;

describe('Điểm xét tốt nghiệp, điều kiện, số báo danh, phòng thi', () => {
  it('CT-21f-1: trung bình các năm hệ số 1, 2, 3; điểm xét có khuyến khích, ưu tiên; điểm liệt; điều kiện; số báo danh; chia phòng; cấu hình', () => {
    assert.equal(schoolAverage({ g10: 8, g11: 8.5, g12: 9 }, thpt.grade_weights), 8.67);
    assert.equal(schoolAverage({ g10: 8, g11: null, g12: 9 }, thpt.grade_weights), null);
    // (8,63 + 1) × 7 và 8,67 × 3 chia 10 = 9,34; cộng ưu tiên 0,5 = 9,84
    const passed = graduationScore(
      { examScores: [9, 8, 9, 8.5], incentive: 1, priority: 0.5, schoolAverage: 8.67 },
      thpt,
    );
    assert.deepEqual(passed, { exam_average: 8.63, score: 9.84, passed: true, reason: null });
    assert.equal(
      graduationScore({ examScores: [10, 10, 10, 10], incentive: 4, priority: 2, schoolAverage: 10 }, thpt).score,
      10,
    );
    assert.deepEqual(
      graduationScore({ examScores: [1, 9, 9, 9], incentive: 0, priority: 0, schoolAverage: 9 }, thpt).reason,
      'Có bài thi bị điểm liệt',
    );
    const low = graduationScore({ examScores: [4, 4, 4, 4], incentive: 0, priority: 0, schoolAverage: 4 }, thpt);
    assert.deepEqual([low.passed, low.score, low.reason], [false, 4, 'Điểm xét tốt nghiệp chưa đạt']);
    assert.equal(graduationScore({ examScores: [], incentive: 0, priority: 0, schoolAverage: 8 }, thpt).score, null);
    assert.equal(
      graduationScore({ examScores: [8], incentive: 0, priority: 0, schoolAverage: null }, thpt).score,
      null,
    );
    assert.equal(graduationEligibility('good', 'pass').eligible, true);
    assert.equal(graduationEligibility('fail', 'good').eligible, false);
    assert.equal(graduationEligibility(null, null).eligible, false);
    assert.equal(examNumber('TN', 7), 'TN0007');
    assert.deepEqual(assignRoomIndexes(5, [2, 2, 2]), [0, 0, 1, 1, 2]);
    assert.equal(assignRoomIndexes(5, [2, 2]), null);
    assert.deepEqual(assignRoomIndexes(0, []), []);
    assert.deepEqual(validateGraduationConfig(thpt, 'THPT'), []);
    assert.ok(validateGraduationConfig({ ...thpt, weights: { exam: 0, school: 0 } }, 'THPT').length > 0);
    assert.ok(validateGraduationConfig({ ...thpt, elective_count: 20 }, 'THPT').length > 0);
    assert.ok(validateGraduationConfig({ ...thpt, pass_score: 11 }, 'THPT').length > 0);
    assert.ok(validateGraduationConfig(null, 'THPT').length > 0);
  });
});

describe('Xét tốt nghiệp, hồ sơ thi', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let academicYearId = '';
  let unitId = '';
  const classes: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const children: Record<string, string> = {};
  const candidates: Record<string, string> = {};
  const ids: Record<string, string> = {};
  const token = (name: string) => (name === 'principal' ? principal.accessToken : (users[name]?.accessToken ?? ''));
  const api = (method: string, path: string, user: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, token(user), body);
  const raw = (path: string, user: string) =>
    fetch(`${environment.baseUrl}${path}`, { headers: { authorization: `Bearer ${token(user)}` } });
  const list = (body: unknown) => body as unknown as Array<Record<string, unknown>>;

  // Dữ liệu đã nhập ở sổ điểm: mọi môn không tự chọn có điểm trung bình `average` ở cả hai học kỳ, môn nhận xét Đạt; xếp loại cả
  // năm của lớp
  async function seed(childKey: string, classCode: string, average: number, learning: string, conduct: string) {
    const overview = await api('GET', `/scores/classes/${classes[classCode]}`, 'principal');
    const subjects = overview.body.subjects as Array<{ subject_id: string; mode: string; is_elective: boolean }>;
    const base = { updated_by: users.homeroom?.userId ?? '', updated_by_name: 'Cô chủ nhiệm' };
    for (const term of ['first_term', 'second_term'] as const) {
      for (const subject of subjects.filter((item) => !item.is_elective)) {
        const common = {
          class_id: classes[classCode] ?? '',
          child_id: children[childKey] ?? '',
          subject_id: subject.subject_id,
        };
        if (subject.mode === 'score') {
          await schoolYear
            .insertInto('score_entries')
            .values(
              (['regular', 'mid', 'final'] as const).map((kind) => ({
                ...common,
                term_type: term,
                kind,
                seq: 1,
                score: average,
                ...base,
              })),
            )
            .execute();
        } else {
          await schoolYear
            .insertInto('subject_term_results')
            .values({ ...common, term_type: term, result: 'pass', ...base })
            .execute();
        }
      }
    }
    await schoolYear
      .insertInto('term_ratings')
      .values({
        class_id: classes[classCode] ?? '',
        child_id: children[childKey] ?? '',
        term_type: 'year',
        learning: learning as 'good',
        conduct: conduct as 'good',
        ...base,
      })
      .execute();
  }

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    academicYearId = await openTestAcademicYear(environment, principal.accessToken, '2026-2027', {
      first_term: { start_date: addDays(vietnamToday, -60), end_date: addDays(vietnamToday, 90) },
      second_term: { start_date: addDays(vietnamToday, 95), end_date: addDays(vietnamToday, 200) },
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
      await api('POST', '/org-units', 'principal', {
        code: 'LC21F',
        name: 'Trường THCS, THPT Thử',
        unit_type: 'truong_chinh',
      })
    ).body.id as string;
    const current = await api('GET', '/school-levels', 'principal');
    const levels = (current.body.levels as Array<Record<string, unknown>>).map(
      ({ code, order_no, display_name, learner_term, context_label }) => ({
        code,
        is_enabled: code === 'MN' || code === 'THCS' || code === 'THPT',
        order_no,
        display_name,
        learner_term,
        context_label,
      }),
    );
    assert.equal((await api('PUT', '/school-levels', 'principal', { levels })).status, 200);
    for (const level of ['THCS', 'THPT']) {
      assert.equal((await api('POST', '/grade-levels/templates', 'principal', { school_level: level })).status, 200);
      assert.equal((await api('POST', '/subjects/templates', 'principal', { school_level: level })).status, 200);
    }
    users.homeroom = await environment.loginAs('VT-07', unitId);
    users.manager = await environment.loginAs('VT-03', unitId);
    users.parent = await environment.loginAs('VT-14', unitId);
    for (const [code, grade, level] of [
      ['12A', 'K12', 'THPT'],
      ['9A', 'K9', 'THCS'],
    ] as const) {
      classes[code] = (
        await schoolYear
          .insertInto('classes')
          .values({
            org_unit_id: unitId,
            academic_year_id: academicYearId,
            code,
            name: code,
            grade_level: grade,
            school_level: level,
            max_size: 45,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    for (const [key, classCode] of [
      ['An', '12A'],
      ['Binh', '12A'],
      ['Chi', '12A'],
      ['Dung', '9A'],
      ['Em', '9A'],
    ] as const) {
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitId,
          full_name: `Học sinh ${key}`,
          dob: '2008-03-01',
          gender: 'female',
          place_of_birth: 'Hà Nội',
          national_id_encrypted: 'ma-hoa-thu',
          national_id_hash: randomUUID(),
          national_id_last4: '4321',
          photo_consent: 'granted',
          status: 'active',
          enroll_date: addDays(vietnamToday, -60),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      children[key] = child.id;
      await schoolYear
        .insertInto('class_enrollments')
        .values({ child_id: child.id, class_id: classes[classCode] ?? '', from_date: addDays(vietnamToday, -60) })
        .execute();
    }
    // An: điểm 9,0, học tập, rèn luyện Tốt; Bình: 7,0, Khá, Tốt; Chi: học tập Chưa đạt; Dũng (lớp 9) Tốt; Em (lớp 9) Chưa đạt
    await seed('An', '12A', 9, 'good', 'good');
    await seed('Binh', '12A', 7, 'fair', 'good');
    await seed('Chi', '12A', 4, 'fail', 'pass');
    await seed('Dung', '9A', 8, 'good', 'good');
    await seed('Em', '9A', 4, 'fail', 'good');
    // Học bạ lớp 10, 11 đã chép của An: điểm trung bình các năm 8,0 và 8,5
    for (const [grade, year, value] of [
      ['K10', '2024-2025', '8'],
      ['K11', '2025-2026', '8.5'],
    ] as const) {
      await schoolYear
        .insertInto('learning_records')
        .values({
          child_id: children.An ?? '',
          academic_year_name: year,
          class_name: grade,
          grade_level: grade,
          school_level: 'THPT',
          content: JSON.stringify({ secondary: { subjects: [{ name: 'Toán', mode: 'score', year: value }] } }),
          prepared_by_name: 'Cô chủ nhiệm',
        })
        .execute();
    }
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-21f-2: cấu hình xét tốt nghiệp và tạo kỳ: mặc định theo cấp; sửa chỉ Ban Giám hiệu; cấu hình sai bị từ chối; mỗi năm một kỳ mỗi cấp', async () => {
    const defaults = await api('GET', '/graduation/config?school_level=THPT', 'manager');
    assert.equal(defaults.status, 200, JSON.stringify(defaults.body));
    assert.deepEqual((defaults.body.config as { weights: unknown }).weights, { exam: 7, school: 3 });
    assert.equal((await api('GET', '/graduation/config?school_level=TH', 'manager')).status, 400);
    assert.equal((await api('GET', '/graduation/config?school_level=THPT', 'parent')).status, 403);
    assert.equal(
      (await api('PUT', '/graduation/config', 'manager', { school_level: 'THPT', config: thpt })).status,
      403,
    );
    assert.equal(
      (
        await api('PUT', '/graduation/config', 'principal', {
          school_level: 'THPT',
          config: { ...thpt, pass_score: 11 },
        })
      ).status,
      400,
    );
    assert.equal(
      (await api('PUT', '/graduation/config', 'principal', { school_level: 'THPT', config: thpt })).status,
      200,
    );

    assert.equal(
      (await api('POST', '/graduation/sessions', 'manager', { school_level: 'THPT', name: 'Kỳ thi' })).status,
      403,
    );
    assert.equal(
      (await api('POST', '/graduation/sessions', 'principal', { school_level: 'THPT', name: '' })).status,
      400,
    );
    const session = await api('POST', '/graduation/sessions', 'principal', {
      school_level: 'THPT',
      name: 'Kỳ thi tốt nghiệp THPT 2026-2027',
      exam_date: '2027-06-26',
    });
    assert.equal(session.status, 201, JSON.stringify(session.body));
    ids.thpt = session.body.id as string;
    assert.equal(
      (await api('POST', '/graduation/sessions', 'principal', { school_level: 'THPT', name: 'Trùng' })).status,
      422,
    );
    const thcs = await api('POST', '/graduation/sessions', 'principal', {
      school_level: 'THCS',
      name: 'Xét công nhận tốt nghiệp THCS 2026-2027',
    });
    assert.equal(thcs.status, 201, JSON.stringify(thcs.body));
    ids.thcs = thcs.body.id as string;
    const listed = await api('GET', '/graduation/sessions?school_level=THPT', 'manager');
    assert.deepEqual(
      list(listed.body).map((row) => [row.id, row.status]),
      [[ids.thpt, 'open']],
    );
  });

  it('CT-21f-3: thí sinh THPT: lập danh sách đọc xếp loại, điểm các năm; đăng ký bài thi; số báo danh; phòng thi; điểm thi', async () => {
    assert.equal((await api('POST', `/graduation/sessions/${ids.thpt}/candidates/generate`, 'manager')).status, 403);
    const generated = await api('POST', `/graduation/sessions/${ids.thpt}/candidates/generate`, 'principal');
    assert.equal(generated.status, 200, JSON.stringify(generated.body));
    assert.deepEqual([generated.body.created, generated.body.classes], [3, 1]);
    const again = await api('POST', `/graduation/sessions/${ids.thpt}/candidates/generate`, 'principal');
    assert.deepEqual([again.body.created, again.body.updated], [0, 3]);
    const view = await api('GET', `/graduation/sessions/${ids.thpt}`, 'manager');
    assert.equal(view.status, 200, JSON.stringify(view.body));
    const rows = list(view.body.candidates);
    const rowOf = (name: string) => rows.find((row) => row.full_name === `Học sinh ${name}`) as Record<string, unknown>;
    for (const name of ['An', 'Binh', 'Chi']) {
      candidates[name] = rowOf(name).id as string;
    }
    assert.deepEqual([rowOf('An').eligible, rowOf('Binh').eligible, rowOf('Chi').eligible], [true, true, false]);
    assert.equal(rowOf('Chi').eligibility_note, 'Học tập hoặc rèn luyện cả năm Chưa đạt');
    assert.deepEqual(rowOf('An').grades, { g10: 8, g11: 8.5, g12: 9 });
    assert.equal(rowOf('An').school_average, 8.67);
    assert.equal(rowOf('Binh').school_average, null);

    const patch = (name: string, body: unknown, user = 'principal') =>
      api('PATCH', `/graduation/candidates/${candidates[name]}`, user, body);
    assert.equal((await patch('An', { priority_points: 0.5 }, 'manager')).status, 403);
    assert.equal((await patch('An', { priority_points: 3 })).status, 400);
    assert.equal((await patch('An', { incentive_points: 5 })).status, 400);
    assert.equal((await patch('An', { exam_subjects: ['THPT-TOAN', 'THPT-NV'] })).status, 400);
    assert.equal((await patch('An', { exam_subjects: ['THPT-TOAN', 'THPT-NV', 'THPT-VL', 'THPT-GDTC'] })).status, 400);
    assert.equal((await patch('Chi', { exam_subjects: ['THPT-TOAN', 'THPT-NV', 'THPT-VL', 'THPT-HH'] })).status, 400);
    const subjects = ['THPT-TOAN', 'THPT-NV', 'THPT-VL', 'THPT-HH'];
    assert.equal(
      (await patch('An', { exam_subjects: subjects, priority_points: 0.5, incentive_points: 1 })).status,
      200,
    );
    assert.equal((await patch('An', { exempt_subjects: ['THPT-DL'] })).status, 400);
    assert.equal((await patch('Binh', { exam_subjects: subjects, grades: { g10: 7, g11: 7 } })).status, 200);

    assert.equal((await api('POST', `/graduation/sessions/${ids.thpt}/rooms/assign`, 'principal')).status, 422);
    const numbers = await api('POST', `/graduation/sessions/${ids.thpt}/exam-numbers`, 'principal');
    assert.deepEqual(numbers.body, { assigned: 2 });
    assert.deepEqual((await api('POST', `/graduation/sessions/${ids.thpt}/exam-numbers`, 'principal')).body, {
      assigned: 0,
    });
    const room = (code: string, capacity: number) =>
      api('POST', `/graduation/sessions/${ids.thpt}/rooms`, 'principal', {
        code,
        name: `Phòng ${code}`,
        capacity,
        proctors: 'Cô A, Thầy B',
      });
    assert.equal((await room('P01', 1)).status, 201);
    assert.equal((await room('P01', 1)).status, 409);
    assert.equal((await api('POST', `/graduation/sessions/${ids.thpt}/rooms/assign`, 'principal')).status, 422);
    assert.equal((await room('P02', 1)).status, 201);
    assert.deepEqual((await api('POST', `/graduation/sessions/${ids.thpt}/rooms/assign`, 'principal')).body, {
      assigned: 2,
    });
    const assigned = list((await api('GET', `/graduation/sessions/${ids.thpt}`, 'manager')).body.candidates);
    const numberOf = (name: string) => assigned.find((row) => row.full_name === `Học sinh ${name}`)?.exam_number;
    assert.deepEqual([numberOf('An'), numberOf('Binh'), numberOf('Chi')], ['TN0001', 'TN0002', null]);
    assert.notEqual(
      assigned.find((row) => row.full_name === 'Học sinh An')?.room_id,
      assigned.find((row) => row.full_name === 'Học sinh Binh')?.room_id,
    );

    const score = (name: string, scores: Array<{ subject_code: string; score: number | null }>, user = 'principal') =>
      api('PUT', `/graduation/candidates/${candidates[name]}/scores`, user, { scores });
    assert.equal((await score('An', [{ subject_code: 'THPT-TOAN', score: 9 }], 'manager')).status, 403);
    assert.equal((await score('An', [{ subject_code: 'THPT-DL', score: 9 }])).status, 400);
    assert.equal((await score('An', [{ subject_code: 'THPT-TOAN', score: 10.5 }])).status, 400);
    assert.equal((await score('Chi', [{ subject_code: 'THPT-TOAN', score: 9 }])).status, 400);
    assert.equal(
      (
        await score('An', [
          { subject_code: 'THPT-TOAN', score: 9 },
          { subject_code: 'THPT-NV', score: 8 },
          { subject_code: 'THPT-VL', score: 9 },
        ])
      ).status,
      200,
    );
    // Chưa đủ điểm: xét kết quả chưa có đề xuất cho An
    assert.deepEqual((await api('POST', `/graduation/sessions/${ids.thpt}/evaluate`, 'principal')).body, {
      proposed: 1,
      incomplete: 2,
    });
    assert.equal((await score('An', [{ subject_code: 'THPT-HH', score: 8.5 }])).status, 200);
    assert.equal(
      (
        await score('Binh', [
          { subject_code: 'THPT-TOAN', score: 1 },
          { subject_code: 'THPT-NV', score: 7 },
          { subject_code: 'THPT-VL', score: 7 },
          { subject_code: 'THPT-HH', score: 7 },
        ])
      ).status,
      200,
    );
  });

  it('CT-21f-4: xét, công nhận tốt nghiệp THPT: đề xuất theo điểm xét và điểm liệt; công nhận cần biên bản hội đồng; số giấy chứng nhận; kỳ khoá', async () => {
    const evaluated = await api('POST', `/graduation/sessions/${ids.thpt}/evaluate`, 'principal');
    assert.deepEqual(evaluated.body, { proposed: 3, incomplete: 0 });
    const decisions = async () => {
      const rows = list((await api('GET', `/graduation/sessions/${ids.thpt}`, 'manager')).body.candidates);
      return (name: string) =>
        rows.find((row) => row.full_name === `Học sinh ${name}`)?.decision as {
          outcome: string;
          status: string;
          score: string | null;
          note: string | null;
          certificate_no: string | null;
        };
    };
    const proposed = await decisions();
    const expected = graduationScore(
      { examScores: [9, 8, 9, 8.5], incentive: 1, priority: 0.5, schoolAverage: 8.67 },
      thpt,
    );
    assert.deepEqual(
      [proposed('An').outcome, proposed('An').status, Number(proposed('An').score)],
      ['graduated', 'proposed', expected.score],
    );
    assert.deepEqual([proposed('Binh').outcome, proposed('Binh').note], ['not_graduated', 'Có bài thi bị điểm liệt']);
    assert.deepEqual(
      [proposed('Chi').outcome, proposed('Chi').note],
      ['not_graduated', 'Học tập hoặc rèn luyện cả năm Chưa đạt'],
    );

    assert.equal((await api('POST', `/graduation/sessions/${ids.thpt}/confirm`, 'manager')).status, 403);
    assert.equal((await api('POST', `/graduation/sessions/${ids.thpt}/confirm`, 'principal')).status, 422);
    assert.equal(
      (
        await api('POST', `/graduation/sessions/${ids.thpt}/minutes`, 'principal', {
          kind: 'khac',
          title: 'x',
          content: 'y',
        })
      ).status,
      400,
    );
    const minutes = await api('POST', `/graduation/sessions/${ids.thpt}/minutes`, 'principal', {
      kind: 'council',
      title: 'Họp hội đồng xét tốt nghiệp',
      content: 'Hội đồng xem xét danh sách, thống nhất công nhận tốt nghiệp theo điểm xét.',
    });
    assert.equal(minutes.status, 201, JSON.stringify(minutes.body));
    ids.minutes = minutes.body.id as string;
    const confirmed = await api('POST', `/graduation/sessions/${ids.thpt}/confirm`, 'principal');
    assert.deepEqual(confirmed.body, { graduated: 1, total: 3 });
    const final = await decisions();
    assert.deepEqual([final('An').status, final('An').certificate_no], ['confirmed', 'TN-THPT-2026-2027-00001']);
    assert.equal(final('Binh').certificate_no, null);
    const view = await api('GET', `/graduation/sessions/${ids.thpt}`, 'manager');
    assert.equal((view.body.session as { status: string }).status, 'finalized');
    // Kỳ đã công nhận: không sửa, không xét lại, không cấp lại
    assert.equal(
      (await api('PATCH', `/graduation/candidates/${candidates.An}`, 'principal', { incentive_points: 0 })).status,
      422,
    );
    assert.equal((await api('POST', `/graduation/sessions/${ids.thpt}/evaluate`, 'principal')).status, 422);
    assert.equal((await api('POST', `/graduation/sessions/${ids.thpt}/confirm`, 'principal')).status, 422);

    const certificate = await raw(`/graduation/candidates/${candidates.An}/certificate`, 'manager');
    assert.equal(certificate.status, 200);
    assert.equal(certificate.headers.get('content-type'), 'application/pdf');
    assert.equal(
      Buffer.from(await certificate.arrayBuffer())
        .subarray(0, 4)
        .toString(),
      '%PDF',
    );
    assert.equal((await raw(`/graduation/candidates/${candidates.Binh}/certificate`, 'manager')).status, 422);
    assert.equal((await raw(`/graduation/candidates/${candidates.An}/certificate`, 'parent')).status, 403);
    const file = await raw(`/graduation/minutes/${ids.minutes}/file`, 'manager');
    assert.equal(file.status, 200);
    assert.equal(file.headers.get('content-type'), 'application/pdf');
  });

  it('CT-21f-5: tệp xuất theo bố cục chung và đánh dấu đã gửi; xét tốt nghiệp THCS; hồ sơ chuyển cấp cần học bạ đã kí', async () => {
    assert.equal((await raw(`/graduation/sessions/${ids.thpt}/export?kind=results`, 'manager')).status, 403);
    assert.equal((await raw(`/graduation/sessions/${ids.thpt}/export?kind=khac`, 'principal')).status, 400);
    const results = await raw(`/graduation/sessions/${ids.thpt}/export?kind=results`, 'principal');
    assert.equal(results.status, 200);
    assert.match(String(results.headers.get('content-type')), /spreadsheetml/);
    assert.equal(
      Buffer.from(await results.arrayBuffer())
        .subarray(0, 2)
        .toString(),
      'PK',
    );
    assert.equal((await raw(`/graduation/sessions/${ids.thpt}/export?kind=candidates`, 'principal')).status, 200);
    const submissions = list((await api('GET', `/graduation/sessions/${ids.thpt}`, 'manager')).body.submissions);
    assert.deepEqual(
      submissions.map((row) => row.status),
      ['exported', 'exported'],
    );
    const submissionId = submissions[0]?.id as string;
    assert.equal((await api('POST', `/graduation/submissions/${submissionId}/mark-sent`, 'manager', {})).status, 403);
    assert.equal(
      (
        await api('POST', `/graduation/submissions/${submissionId}/mark-sent`, 'principal', {
          note: 'Gửi qua cổng của Sở',
        })
      ).status,
      200,
    );
    assert.equal((await api('POST', `/graduation/submissions/${submissionId}/mark-sent`, 'principal', {})).status, 422);

    // THCS: Dũng đủ điều kiện, Em học tập Chưa đạt
    const generated = await api('POST', `/graduation/sessions/${ids.thcs}/candidates/generate`, 'principal');
    assert.deepEqual([generated.body.created, generated.body.classes], [2, 1]);
    assert.equal((await api('POST', `/graduation/sessions/${ids.thcs}/exam-numbers`, 'principal')).status, 422);
    assert.deepEqual((await api('POST', `/graduation/sessions/${ids.thcs}/evaluate`, 'principal')).body, {
      proposed: 2,
      incomplete: 0,
    });
    assert.equal(
      (await api('POST', `/graduation/sessions/${ids.thcs}/transfer-dossiers`, 'principal', {})).status,
      422,
    );
    await api('POST', `/graduation/sessions/${ids.thcs}/minutes`, 'principal', {
      kind: 'council',
      title: 'Họp hội đồng THCS',
      content: 'Công nhận tốt nghiệp THCS cho học sinh đủ điều kiện.',
    });
    assert.deepEqual((await api('POST', `/graduation/sessions/${ids.thcs}/confirm`, 'principal')).body, {
      graduated: 1,
      total: 2,
    });
    const rows = list((await api('GET', `/graduation/sessions/${ids.thcs}`, 'manager')).body.candidates);
    const dung = rows.find((row) => row.full_name === 'Học sinh Dung') as { decision: { certificate_no: string } };
    assert.equal(dung.decision.certificate_no, 'TN-THCS-2026-2027-00001');
    // Hồ sơ chuyển cấp: Dũng chưa có học bạ đã kí nên bị bỏ qua; có học bạ đã kí thì lập được
    const none = await api('POST', `/graduation/sessions/${ids.thcs}/transfer-dossiers`, 'principal', {});
    assert.equal(none.status, 200, JSON.stringify(none.body));
    assert.deepEqual([none.body.created, list(none.body.skipped).length], [0, 1]);
    await schoolYear
      .insertInto('learning_records')
      .values({
        child_id: children.Dung ?? '',
        academic_year_name: '2026-2027',
        class_id: classes['9A'] ?? '',
        class_name: '9A',
        grade_level: 'K9',
        school_level: 'THCS',
        content: JSON.stringify({}),
        status: 'signed',
        prepared_by_name: 'Cô chủ nhiệm',
      })
      .execute();
    const made = await api('POST', `/graduation/sessions/${ids.thcs}/transfer-dossiers`, 'principal', {
      destination: 'Trường THPT Thử',
    });
    assert.deepEqual([made.body.created, list(made.body.skipped).length], [1, 0]);
    const dossiers = list((await api('GET', `/graduation/sessions/${ids.thcs}`, 'manager')).body.dossiers);
    assert.deepEqual(
      dossiers.map((row) => [row.full_name, row.destination, row.status]),
      [['Học sinh Dung', 'Trường THPT Thử', 'prepared']],
    );
    const dossierId = dossiers[0]?.id as string;
    assert.equal((await api('POST', `/graduation/transfer-dossiers/${dossierId}/mark-sent`, 'manager')).status, 403);
    assert.equal((await api('POST', `/graduation/transfer-dossiers/${dossierId}/mark-sent`, 'principal')).status, 200);
    assert.equal((await api('POST', `/graduation/transfer-dossiers/${dossierId}/mark-sent`, 'principal')).status, 422);
    // Cuối kịch bản trả trường về chỉ có Mầm non
    const current = await api('GET', '/school-levels', 'principal');
    const restored = (current.body.levels as Array<Record<string, unknown>>).map(
      ({ code, order_no, display_name, learner_term, context_label }) => ({
        code,
        is_enabled: code === 'MN',
        order_no,
        display_name,
        learner_term,
        context_label,
      }),
    );
    assert.equal((await api('PUT', '/school-levels', 'principal', { levels: restored })).status, 200);
  });
});
