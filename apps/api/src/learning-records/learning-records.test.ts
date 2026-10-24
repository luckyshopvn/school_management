import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import { completionOutcome } from '@school-management/shared';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';

// Học bạ số, khen thưởng cuối năm, hoàn thành chương trình, lên lớp (DT-20 phần 20e, YCTD-163); kịch bản CT-20e-1 đến
// CT-20e-6
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const errorOf = (body: Record<string, unknown>) => (body.error ?? {}) as { code?: string; rule_code?: string };

describe('Kết quả hoàn thành chương trình theo Điều 11', () => {
  it('CT-20e-1: hoàn thành thì lên lớp hoặc hoàn thành cấp học; chưa hoàn thành thì rèn luyện, đạt lên lớp, không đạt ở lại', () => {
    assert.equal(completionOutcome({ yearResult: 'excellent', lastGrade: false, supportResult: null }), 'promoted');
    assert.equal(
      completionOutcome({ yearResult: 'completed', lastGrade: true, supportResult: null }),
      'level_completed',
    );
    assert.equal(
      completionOutcome({ yearResult: 'not_completed', lastGrade: false, supportResult: null }),
      'pending_support',
    );
    assert.equal(
      completionOutcome({ yearResult: 'not_completed', lastGrade: false, supportResult: 'completed' }),
      'promoted',
    );
    assert.equal(
      completionOutcome({ yearResult: 'not_completed', lastGrade: true, supportResult: 'completed' }),
      'level_completed',
    );
    assert.equal(
      completionOutcome({ yearResult: 'not_completed', lastGrade: false, supportResult: 'not_completed' }),
      'retained',
    );
  });
});

describe('Học bạ, khen thưởng, hoàn thành chương trình', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let academicYearId = '';
  let unitId = '';
  const classes: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const children: Record<string, string> = {};
  const subjects: Record<string, string> = {};
  const periods: Record<string, string> = {};
  const awards: Record<string, string> = {};
  const records: Record<string, string> = {};
  const token = (name: string) => (name === 'principal' ? principal.accessToken : (users[name]?.accessToken ?? ''));
  const api = (method: string, path: string, user: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, token(user), body);
  const list = (body: unknown) => body as unknown as Array<Record<string, unknown>>;
  const raw = (path: string, user: string) =>
    fetch(`${environment.baseUrl}${path}`, { headers: { authorization: `Bearer ${token(user)}` } });

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
        code: 'TH20E',
        name: 'Trường Tiểu học Thử',
        unit_type: 'truong_chinh',
      })
    ).body.id as string;
    const current = await api('GET', '/school-levels', 'principal');
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
    assert.equal((await api('PUT', '/school-levels', 'principal', { levels })).status, 200);
    assert.equal((await api('POST', '/grade-levels/templates', 'principal', { school_level: 'TH' })).status, 200);
    await api('POST', '/subjects/templates', 'principal', { school_level: 'TH' });
    for (const row of list((await api('GET', '/subjects?school_level=TH', 'principal')).body)) {
      subjects[row.code as string] = row.id as string;
    }
    assert.equal((await api('POST', '/assessment/config/defaults', 'principal', { school_level: 'TH' })).status, 200);
    for (const period of list((await api('GET', '/assessment/config?school_level=TH', 'principal')).body.periods)) {
      periods[period.code as string] = period.id as string;
    }
    users.homeroom = await environment.loginAs('VT-07', unitId);
    users.other = await environment.loginAs('VT-07', unitId);
    users.parent = await environment.loginAs('VT-14', unitId);
    users.otherParent = await environment.loginAs('VT-14', unitId);
    for (const [code, grade] of [
      ['4A', 'K4'],
      ['5A', 'K5'],
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
            school_level: 'TH',
            max_size: 30,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
      await schoolYear
        .insertInto('class_staff_assignments')
        .values({
          class_id: classes[code] ?? '',
          staff_user_id: users.homeroom?.userId ?? '',
          staff_name: 'Cô chủ nhiệm',
          assignment_role: 'homeroom',
          from_date: addDays(vietnamToday, -60),
        })
        .execute();
    }
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: 'ME', name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    for (const [key, classCode, parent] of [
      ['An', '4A', 'parent'],
      ['Binh', '4A', null],
      ['Chi', '4A', null],
      ['Dung', '5A', null],
    ] as const) {
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitId,
          full_name: `Học sinh ${key}`,
          dob: '2016-03-01',
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
      if (parent) {
        const guardian = await schoolYear
          .insertInto('guardians')
          .values({ full_name: 'Mẹ của An', phone: `09${Date.now() % 100_000_000}`, user_id: users[parent]?.userId })
          .returning('id')
          .executeTakeFirstOrThrow();
        await schoolYear
          .insertInto('child_guardians')
          .values({
            child_id: child.id,
            guardian_id: guardian.id,
            relationship_item_id: relationship.id,
            is_primary: true,
          })
          .execute();
      }
    }
    // Kết quả kỳ cuối năm: An môn Tiếng Việt Hoàn thành tốt, điểm 9; kết quả cuối năm giáo viên chủ nhiệm xác nhận
    const tv = await api('PUT', `/assessment/classes/${classes['4A']}/subjects/${subjects['TH-TV']}`, 'homeroom', {
      period_id: periods.CN,
      entries: [{ child_id: children.An, level_code: 'T', score: 9, comment: 'Đọc tốt' }],
    });
    assert.equal(tv.status, 200, JSON.stringify(tv.body));
    for (const [classCode, entries] of [
      [
        '4A',
        [
          { child_id: children.An, result: 'excellent' },
          { child_id: children.Binh, result: 'good' },
          { child_id: children.Chi, result: 'not_completed' },
        ],
      ],
      ['5A', [{ child_id: children.Dung, result: 'completed' }]],
    ] as const) {
      const confirmed = await api('PUT', `/assessment/classes/${classes[classCode]}/year-results`, 'homeroom', {
        entries,
      });
      assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
    }
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-20e-2: danh hiệu cấu hình; khen thưởng theo kết quả cuối năm đã khoá; duyệt cấp mã tra cứu, giấy khen', async () => {
    assert.equal((await api('POST', '/learning-records/award-titles/defaults', 'homeroom', {})).status, 403);
    const loaded = await api('POST', '/learning-records/award-titles/defaults', 'principal', { school_level: 'TH' });
    assert.equal(loaded.body.created, 3);
    assert.equal(
      (await api('POST', '/learning-records/award-titles/defaults', 'principal', { school_level: 'TH' })).body.created,
      0,
    );
    const titles = Object.fromEntries(
      list((await api('GET', '/learning-records/award-titles?school_level=TH', 'homeroom')).body).map((row) => [
        row.code,
        row.id,
      ]),
    );
    const propose = (child: string, title: string, achievement?: string, user = 'homeroom') =>
      api('POST', `/learning-records/classes/${classes['4A']}/awards`, user, {
        child_id: children[child],
        title_id: titles[title],
        achievement,
      });
    const early = await propose('An', 'HS-XS');
    assert.equal(early.status, 422);
    assert.equal(errorOf(early.body).rule_code, 'YCTD-163');
    assert.equal((await api('POST', '/assessment/locks', 'principal', { period_id: periods.CN })).status, 200);
    const view = await api('GET', `/learning-records/classes/${classes['4A']}/awards`, 'homeroom');
    const binhRow = list(view.body.rows).find((row) => row.child_id === children.Binh);
    assert.deepEqual(binhRow?.suggested_title_ids, [titles['HS-TB']]);
    assert.equal((await propose('Binh', 'HS-XS')).status, 422);
    assert.equal((await propose('An', 'HS-XS', undefined, 'other')).status, 403);
    const excellent = await propose('An', 'HS-XS');
    assert.equal(excellent.status, 201, JSON.stringify(excellent.body));
    awards.An = excellent.body.id as string;
    assert.equal((await propose('An', 'HS-XS')).status, 422);
    assert.equal((await propose('Binh', 'HS-TB')).status, 400);
    assert.equal((await propose('Binh', 'HS-TB', 'Tiến bộ vượt bậc môn Toán')).status, 201);
    assert.equal((await propose('Chi', 'HS-TB', 'Chăm chỉ')).status, 422);
    assert.equal((await propose('Chi', 'KT-DX', 'Nhặt được của rơi trả người mất')).status, 201);
    assert.equal(
      (await api('POST', `/learning-records/awards/${awards.An}/decide`, 'homeroom', { approve: true })).status,
      403,
    );
    assert.equal(
      (await api('POST', `/learning-records/awards/${awards.An}/decide`, 'principal', { approve: false })).status,
      400,
    );
    const approved = await api('POST', `/learning-records/awards/${awards.An}/decide`, 'principal', { approve: true });
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    const code = approved.body.lookup_code as string;
    assert.match(code, /^[A-Z0-9]{12}$/);
    const certificate = await raw(`/learning-records/awards/${awards.An}/certificate`, 'parent');
    assert.equal(certificate.status, 200);
    assert.equal(certificate.headers.get('content-type'), 'application/pdf');
    assert.equal((await raw(`/learning-records/awards/${awards.An}/certificate`, 'otherParent')).status, 403);
    const verified = await sendJson('GET', `${environment.baseUrl}/public/student-awards/verify?code=${code}`, '');
    assert.deepEqual([verified.body.found, verified.body.student_name], [true, 'Học sinh An']);
  });

  it('CT-20e-3: hoàn thành chương trình lớp học, rèn luyện, kiểm tra lại, ở lại lớp; khối cuối cấp hoàn thành tiểu học', async () => {
    const view = await api('GET', `/learning-records/classes/${classes['4A']}/completion`, 'homeroom');
    assert.equal(view.status, 200, JSON.stringify(view.body));
    assert.deepEqual([view.body.last_grade, view.body.next_grade_level], [false, 'K5']);
    const suggested = Object.fromEntries(list(view.body.rows).map((row) => [row.full_name, row.suggested_outcome]));
    assert.deepEqual(suggested, {
      'Học sinh An': 'promoted',
      'Học sinh Binh': 'promoted',
      'Học sinh Chi': 'pending_support',
    });
    const save = (entries: unknown[], user = 'homeroom') =>
      api('PUT', `/learning-records/classes/${classes['4A']}/completion`, user, { entries });
    assert.equal((await save([{ child_id: children.An, support_plan: 'retest' }])).status, 400);
    assert.equal((await save([{ child_id: children.An }], 'other')).status, 403);
    const outcomeOf = (body: Record<string, unknown>, child: string) =>
      list(body.rows).find((row) => row.child_id === children[child])?.result as {
        outcome: string;
        next_grade_level: string;
      };
    let saved = await save([{ child_id: children.An }, { child_id: children.Chi, support_plan: 'summer_training' }]);
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.deepEqual(outcomeOf(saved.body, 'An'), {
      ...outcomeOf(saved.body, 'An'),
      outcome: 'promoted',
      next_grade_level: 'K5',
    });
    assert.deepEqual(
      [outcomeOf(saved.body, 'Chi').outcome, outcomeOf(saved.body, 'Chi').next_grade_level],
      ['pending_support', 'K4'],
    );
    saved = await save([{ child_id: children.Chi, support_plan: 'retest', support_result: 'not_completed' }]);
    assert.equal(outcomeOf(saved.body, 'Chi').outcome, 'retained');
    saved = await save([{ child_id: children.Chi, support_plan: 'retest', support_result: 'completed' }]);
    assert.deepEqual(
      [outcomeOf(saved.body, 'Chi').outcome, outcomeOf(saved.body, 'Chi').next_grade_level],
      ['promoted', 'K5'],
    );
    const last = await api('PUT', `/learning-records/classes/${classes['5A']}/completion`, 'homeroom', {
      entries: [{ child_id: children.Dung }],
    });
    assert.equal(last.status, 200, JSON.stringify(last.body));
    assert.equal(last.body.last_grade, true);
    assert.equal(outcomeOf(last.body, 'Dung').outcome, 'level_completed');
  });

  it('CT-20e-4: lập học bạ từ kết quả đã khoá; nhận xét; Hiệu trưởng kí nội bộ in đủ số định danh; mở lại phải có lý do', async () => {
    assert.equal(
      (await api('POST', `/learning-records/classes/${classes['4A']}/learning-records/prepare`, 'other')).status,
      403,
    );
    const prepared = await api(
      'POST',
      `/learning-records/classes/${classes['4A']}/learning-records/prepare`,
      'homeroom',
    );
    assert.equal(prepared.status, 200, JSON.stringify(prepared.body));
    assert.equal(prepared.body.prepared, 3);
    const view = await api('GET', `/learning-records/classes/${classes['4A']}/learning-records`, 'homeroom');
    for (const row of list(view.body.rows)) {
      records[row.full_name as string] = (row.record as { id: string }).id;
    }
    const recordId = records['Học sinh An'] ?? '';
    const stored = await schoolYear
      .selectFrom('learning_records')
      .select(['content', 'status'])
      .where('id', '=', recordId)
      .executeTakeFirstOrThrow();
    const content = stored.content as unknown as {
      subjects: Array<{ name: string; level: string; score: number }>;
      year_result: string;
      awards: string[];
      completion: string;
    };
    assert.ok(
      content.subjects.some((row) => row.name === 'Tiếng Việt' && row.level === 'Hoàn thành tốt' && row.score === 9),
    );
    assert.deepEqual(
      [content.year_result, content.awards, content.completion],
      ['Hoàn thành xuất sắc', ['Học sinh Xuất sắc'], 'Hoàn thành chương trình lớp học, lên lớp'],
    );
    assert.equal(
      (
        await api('PATCH', `/learning-records/learning-records/${recordId}`, 'homeroom', {
          homeroom_comment: 'Chăm ngoan',
        })
      ).status,
      200,
    );
    const noCertificate = await api('POST', `/learning-records/learning-records/${recordId}/sign`, 'principal');
    assert.equal(noCertificate.status, 422);
    assert.equal(
      (
        await api('PUT', '/signing/certificate', 'principal', {
          signature_type: 'remote',
          provider: 'VNPT-CA',
          login_name: 'truong-thu-hoc-ba',
          holder_name: 'Hiệu trưởng Thử',
          holder_title: 'Hiệu trưởng',
          serial_number: 'SERI-HB',
          valid_from: '2026-01-01',
          valid_to: '2099-12-31',
        })
      ).status,
      200,
    );
    assert.equal((await api('POST', '/signing/certificate/register', 'principal')).status, 200);
    assert.equal((await api('POST', `/learning-records/learning-records/${recordId}/sign`, 'homeroom')).status, 403);
    const signed = await api('POST', `/learning-records/learning-records/${recordId}/sign`, 'principal');
    assert.equal(signed.status, 200, JSON.stringify(signed.body));
    assert.deepEqual([signed.body.status, signed.body.signature_method], ['signed', 'internal']);
    assert.equal(
      (await api('PATCH', `/learning-records/learning-records/${recordId}`, 'homeroom', { homeroom_comment: 'Sửa' }))
        .status,
      422,
    );
    const logs = await schoolYear
      .selectFrom('data_access_logs')
      .select('id')
      .where('entity_id', '=', children.An ?? '')
      .where('scope', '=', 'national_id')
      .execute();
    assert.ok(logs.length >= 1);
    const file = await raw(`/learning-records/learning-records/${recordId}/file`, 'principal');
    assert.equal(file.status, 200);
    assert.equal(file.headers.get('content-type'), 'application/pdf');
    assert.equal((await raw(`/learning-records/learning-records/${recordId}/file`, 'parent')).status, 200);
    assert.equal((await raw(`/learning-records/learning-records/${recordId}/file`, 'otherParent')).status, 403);
    const again = await api('POST', `/learning-records/classes/${classes['4A']}/learning-records/prepare`, 'homeroom');
    assert.deepEqual([again.body.prepared, again.body.skipped_signed], [2, 1]);
    assert.equal(
      (await api('POST', `/learning-records/learning-records/${recordId}/reopen`, 'principal', {})).status,
      400,
    );
    const reopened = await api('POST', `/learning-records/learning-records/${recordId}/reopen`, 'principal', {
      reason: 'Sửa nhận xét',
    });
    assert.equal(reopened.body.status, 'draft');
    assert.equal((await raw(`/learning-records/learning-records/${recordId}/file`, 'parent')).status, 422);
    assert.equal((await api('POST', `/learning-records/learning-records/${recordId}/sign`, 'principal')).status, 200);
  });

  it('CT-20e-5: phụ huynh xem học bạ đã kí, khen thưởng đã duyệt của con; không xem con người khác', async () => {
    const own = await api('GET', `/learning-records/children/${children.An}`, 'parent');
    assert.equal(own.status, 200, JSON.stringify(own.body));
    assert.equal(list(own.body.records).length, 1);
    assert.deepEqual(
      list(own.body.awards).map((row) => row.title_name),
      ['Học sinh Xuất sắc'],
    );
    assert.equal((await api('GET', `/learning-records/children/${children.An}`, 'otherParent')).status, 403);
    const staff = await api('GET', `/learning-records/children/${children.Binh}`, 'principal');
    assert.equal(list(staff.body.records)[0]?.status, 'draft');
  });

  it('CT-20e-6: mở năm học mới kết chuyển học bạ, danh hiệu; học sinh hoàn thành tiểu học thôi học ở năm mới', async () => {
    const nextYearId = await openTestAcademicYear(environment, principal.accessToken, '2027-2028', {
      first_term: { start_date: addDays(vietnamToday, 230), end_date: addDays(vietnamToday, 360) },
      second_term: { start_date: addDays(vietnamToday, 365), end_date: addDays(vietnamToday, 500) },
    });
    const registry = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .where('academic_year_id', '=', nextYearId)
      .executeTakeFirstOrThrow();
    const nextYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, registry.database_name),
    );
    try {
      const carried = await nextYear
        .selectFrom('learning_records')
        .select(['child_id', 'class_id', 'status', 'academic_year_name'])
        .execute();
      assert.equal(carried.length, 3);
      assert.ok(carried.every((row) => row.class_id === null && row.academic_year_name === '2026-2027'));
      assert.equal((await nextYear.selectFrom('student_award_titles').select('id').execute()).length, 3);
      const dung = await nextYear
        .selectFrom('children')
        .select('status')
        .where('id', '=', children.Dung ?? '')
        .executeTakeFirst();
      assert.equal(dung?.status, 'graduated');
      const enrollment = await nextYear
        .selectFrom('class_enrollments')
        .select('is_current')
        .where('child_id', '=', children.Dung ?? '')
        .where('is_current', '=', true)
        .executeTakeFirst();
      assert.equal(enrollment, undefined);
      const an = await nextYear
        .selectFrom('children')
        .select('status')
        .where('id', '=', children.An ?? '')
        .executeTakeFirst();
      assert.equal(an?.status, 'active');
    } finally {
      await nextYear.destroy();
    }
  });
});
