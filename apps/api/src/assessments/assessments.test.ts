import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import { suggestYearResult } from '@school-management/shared';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';

// Đánh giá học sinh theo Thông tư 27/2020 (DT-20 phần 20c, YCTD-161); kịch bản CT-20c-1 đến CT-20c-6
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const errorOf = (body: Record<string, unknown>) => (body.error ?? {}) as { code?: string; rule_code?: string };
const thresholds = { excellent: 9, good: 7, completed: 5 };

describe('Gợi ý kết quả cuối năm theo Điều 9', () => {
  it('CT-20c-1: xuất sắc, tốt, hoàn thành, chưa hoàn thành; thiếu kết quả thì không gợi ý', () => {
    const base = { subjectWorstRank: 3, competencyWorstRank: 3, thresholds };
    const top = { ...base, subjectRanks: [1, 1], competencyRanks: [1, 1] };
    assert.equal(suggestYearResult({ ...top, scores: [9, 10] }), 'excellent');
    assert.equal(suggestYearResult({ ...top, scores: [9, 8] }), 'good');
    assert.equal(suggestYearResult({ ...top, scores: [6] }), 'completed');
    assert.equal(
      suggestYearResult({ ...base, subjectRanks: [1, 2], competencyRanks: [1, 2], scores: [10] }),
      'completed',
    );
    assert.equal(
      suggestYearResult({ ...base, subjectRanks: [1, 3], competencyRanks: [1], scores: [10] }),
      'not_completed',
    );
    assert.equal(
      suggestYearResult({ ...base, subjectRanks: [1], competencyRanks: [3], scores: [10] }),
      'not_completed',
    );
    assert.equal(suggestYearResult({ ...top, scores: [4] }), 'not_completed');
    assert.equal(suggestYearResult({ ...top, scores: [null] }), null);
    assert.equal(suggestYearResult({ ...base, subjectRanks: [1, null], competencyRanks: [1], scores: [] }), null);
    // Không có bài kiểm tra (môn chỉ nhận xét) thì xét mức đạt
    assert.equal(suggestYearResult({ ...top, scores: [] }), 'excellent');
  });
});

describe('Đánh giá học sinh Tiểu học', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let unitId = '';
  let classId = '';
  let preschoolClassId = '';
  const users: Record<string, LoggedInUser> = {};
  const children: Record<string, string> = {};
  const subjects: Record<string, string> = {};
  const periods: Record<string, string> = {};
  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);
  const list = (body: unknown) => body as unknown as Array<Record<string, unknown>>;

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    const academicYearId = await openTestAcademicYear(environment, principal.accessToken, '2026-2027', {
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
      await api('POST', '/org-units', principal.accessToken, {
        code: 'TH20C',
        name: 'Trường',
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
    await api('POST', '/grade-levels', principal.accessToken, {
      code: 'MAM',
      name: 'Mầm',
      age_from_months: 36,
      age_to_months: 71,
    });
    const loaded = await api('POST', '/subjects/templates', principal.accessToken, { school_level: 'TH' });
    assert.ok([200, 201].includes(loaded.status), JSON.stringify(loaded.body));
    for (const row of list((await api('GET', '/subjects?school_level=TH', principal.accessToken)).body)) {
      subjects[row.code as string] = row.id as string;
    }
    users.homeroom = await environment.loginAs('VT-07', unitId);
    users.math = await environment.loginAs('VT-07', unitId);
    users.manager = await environment.loginAs('VT-03', unitId);
    users.parent = await environment.loginAs('VT-14', unitId);
    users.otherParent = await environment.loginAs('VT-14', unitId);
    for (const [code, grade, level] of [
      ['4A', 'K4', 'TH'],
      ['MAM-1', 'MAM', 'MN'],
    ] as const) {
      const id = (
        await schoolYear
          .insertInto('classes')
          .values({
            org_unit_id: unitId,
            academic_year_id: academicYearId,
            code,
            name: code,
            grade_level: grade,
            school_level: level,
            max_size: 30,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
      if (code === '4A') {
        classId = id;
      } else {
        preschoolClassId = id;
      }
    }
    await schoolYear
      .insertInto('class_staff_assignments')
      .values([
        {
          class_id: classId,
          staff_user_id: users.homeroom?.userId ?? '',
          staff_name: 'Chủ nhiệm 4A',
          assignment_role: 'homeroom',
          from_date: addDays(vietnamToday, -60),
        },
        {
          class_id: classId,
          staff_user_id: users.math?.userId ?? '',
          staff_name: 'Giáo viên Toán',
          assignment_role: 'subject',
          subject_name: 'Toán',
          subject_id: subjects['TH-TOAN'] ?? null,
          from_date: addDays(vietnamToday, -60),
        },
      ])
      .execute();
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: 'ME', name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    for (const [key, parent] of [
      ['An', 'parent'],
      ['Binh', null],
    ] as const) {
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitId,
          full_name: `Học sinh ${key}`,
          dob: '2016-03-01',
          gender: 'male',
          national_id_encrypted: 'ma-hoa',
          national_id_hash: randomUUID(),
          national_id_last4: '0000',
          photo_consent: 'granted',
          status: 'active',
          enroll_date: addDays(vietnamToday, -60),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      children[key] = child.id;
      await schoolYear
        .insertInto('class_enrollments')
        .values({ child_id: child.id, class_id: classId, from_date: addDays(vietnamToday, -60) })
        .execute();
      if (parent) {
        const guardian = await schoolYear
          .insertInto('guardians')
          .values({ full_name: 'Phụ huynh An', phone: `09${Date.now() % 100_000_000}`, user_id: users[parent]?.userId })
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
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-20c-2: nạp cấu hình mặc định của Thông tư; bài kiểm tra giữa kỳ chỉ Tiếng Việt, Toán lớp 4, 5', async () => {
    assert.equal(
      (await api('POST', '/assessment/config/defaults', token('homeroom'), { school_level: 'TH' })).status,
      403,
    );
    const loaded = await api('POST', '/assessment/config/defaults', principal.accessToken, { school_level: 'TH' });
    assert.equal(loaded.status, 200, JSON.stringify(loaded.body));
    assert.deepEqual([loaded.body.levels, loaded.body.items, loaded.body.periods], [6, 15, 4]);
    const again = await api('POST', '/assessment/config/defaults', principal.accessToken, { school_level: 'TH' });
    assert.deepEqual([again.body.levels, again.body.items, again.body.periods, again.body.tests], [0, 0, 0, 0]);
    const config = await api('GET', '/assessment/config?school_level=TH', token('homeroom'));
    for (const period of list(config.body.periods)) {
      periods[period.code as string] = period.id as string;
    }
    const tests = list(config.body.tests);
    const midK4 = tests
      .filter((test) => test.period_id === periods.GK1 && test.grade_level_code === 'K4')
      .map((test) => test.subject_id)
      .sort();
    assert.deepEqual(midK4, [subjects['TH-TV'], subjects['TH-TOAN']].sort());
    assert.equal(
      tests.some((test) => test.period_id === periods.GK1 && test.grade_level_code === 'K3'),
      false,
    );
    const endK4 = tests.filter((test) => test.period_id === periods.CK1 && test.grade_level_code === 'K4');
    assert.ok(endK4.some((test) => test.subject_id === subjects['TH-KH']));
    assert.ok(!endK4.some((test) => test.subject_id === subjects['TH-DD']));
  });

  it('CT-20c-3: nhập theo phân công; điểm chỉ ở môn có bài kiểm tra; mức, điểm phải hợp lệ; lớp Mầm non bị từ chối', async () => {
    const homeroom = await api('GET', `/assessment/classes/${classId}`, token('homeroom'));
    assert.equal(homeroom.status, 200, JSON.stringify(homeroom.body));
    const access = homeroom.body.access as { subject_ids: string[]; competency: boolean };
    assert.equal(access.competency, true);
    assert.ok(access.subject_ids.includes(subjects['TH-TV'] ?? ''));
    assert.ok(!access.subject_ids.includes(subjects['TH-TOAN'] ?? ''));
    const math = (await api('GET', `/assessment/classes/${classId}`, token('math'))).body.access as {
      subject_ids: string[];
      competency: boolean;
    };
    assert.deepEqual([math.subject_ids, math.competency], [[subjects['TH-TOAN']], false]);
    const entry = (childId: string, level: string | null, score: number | null) => ({
      child_id: childId,
      level_code: level,
      score,
      comment: 'Tiến bộ',
    });
    const forbidden = await api(
      'PUT',
      `/assessment/classes/${classId}/subjects/${subjects['TH-TOAN']}`,
      token('homeroom'),
      {
        period_id: periods.GK1,
        entries: [entry(children.An ?? '', 'T', 9)],
      },
    );
    assert.equal(forbidden.status, 403);
    const saved = await api('PUT', `/assessment/classes/${classId}/subjects/${subjects['TH-TOAN']}`, token('math'), {
      period_id: periods.GK1,
      entries: [entry(children.An ?? '', 'T', 9), entry(children.Binh ?? '', 'H', 7)],
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.has_test, true);
    const noTest = await api('PUT', `/assessment/classes/${classId}/subjects/${subjects['TH-DD']}`, token('homeroom'), {
      period_id: periods.GK1,
      entries: [entry(children.An ?? '', 'T', 8)],
    });
    assert.equal(noTest.status, 400);
    for (const bad of [entry(children.An ?? '', 'X', null), entry(children.An ?? '', 'T', 11)]) {
      assert.equal(
        (
          await api('PUT', `/assessment/classes/${classId}/subjects/${subjects['TH-TV']}`, token('homeroom'), {
            period_id: periods.GK1,
            entries: [bad],
          })
        ).status,
        400,
      );
    }
    const competencies = await api(
      'GET',
      `/assessment/classes/${classId}/competencies?period_id=${periods.GK1}`,
      token('math'),
    );
    assert.equal(competencies.body.can_edit, false);
    const preschool = await api(
      'GET',
      `/assessment/classes/${preschoolClassId}/competencies?period_id=${periods.GK1}`,
      principal.accessToken,
    );
    assert.equal(preschool.status, 422);
    assert.equal(errorOf(preschool.body).rule_code, 'YCTD-161');
  });

  it('CT-20c-4: quá hạn chỉ người quản lý sửa; khoá thì không ai sửa; mở khoá phải có lý do', async () => {
    const body = {
      period_id: periods.GK1,
      entries: [{ child_id: children.An, level_code: 'T', score: 10, comment: null }],
    };
    const path = `/assessment/classes/${classId}/subjects/${subjects['TH-TV']}`;
    assert.equal(
      (
        await api('PATCH', `/assessment/config/periods/${periods.GK1}`, principal.accessToken, {
          entry_deadline: addDays(vietnamToday, -1),
        })
      ).status,
      200,
    );
    const late = await api('PUT', path, token('homeroom'), body);
    assert.equal(late.status, 422);
    assert.equal(errorOf(late.body).rule_code, 'YCTD-161');
    assert.equal((await api('PUT', path, principal.accessToken, body)).status, 200);
    await api('PATCH', `/assessment/config/periods/${periods.GK1}`, principal.accessToken, { entry_deadline: null });
    assert.equal((await api('POST', '/assessment/locks', token('homeroom'), { period_id: periods.GK1 })).status, 403);
    const locked = await api('POST', '/assessment/locks', principal.accessToken, { period_id: periods.GK1 });
    assert.equal(locked.status, 200, JSON.stringify(locked.body));
    assert.equal(locked.body.locked_class_count, 1);
    assert.equal((await api('PUT', path, token('homeroom'), body)).status, 422);
    assert.equal((await api('PUT', path, principal.accessToken, body)).status, 422);
    assert.equal(
      (
        await api('POST', '/assessment/locks/unlock', principal.accessToken, {
          period_id: periods.GK1,
          class_id: classId,
        })
      ).status,
      400,
    );
    const unlocked = await api('POST', '/assessment/locks/unlock', principal.accessToken, {
      period_id: periods.GK1,
      class_id: classId,
      reason: 'Sửa điểm nhập nhầm',
    });
    assert.equal(unlocked.status, 200, JSON.stringify(unlocked.body));
    assert.equal((await api('PUT', path, token('homeroom'), body)).status, 200);
  });

  it('CT-20c-5: tổng hợp cuối kỳ; gợi ý và xác nhận kết quả cuối năm', async () => {
    const overview = await api('GET', `/assessment/classes/${classId}`, token('homeroom'));
    const classSubjects = list(overview.body.subjects).map((row) => row.subject_id as string);
    const items = list(overview.body.items).map((row) => row.id as string);
    const tests = list(overview.body.tests).filter((test) => test.period_id === periods.CN);
    const hasTest = (subjectId: string) => tests.some((test) => test.subject_id === subjectId);
    for (const subjectId of classSubjects) {
      const user = subjectId === subjects['TH-TOAN'] ? 'math' : 'homeroom';
      const response = await api('PUT', `/assessment/classes/${classId}/subjects/${subjectId}`, token(user), {
        period_id: periods.CN,
        entries: [
          { child_id: children.An, level_code: 'T', score: hasTest(subjectId) ? 9 : null },
          {
            child_id: children.Binh,
            level_code: subjectId === subjects['TH-TOAN'] ? 'H' : 'T',
            score: hasTest(subjectId) ? 8 : null,
          },
        ],
      });
      assert.equal(response.status, 200, JSON.stringify(response.body));
    }
    const competency = await api('PUT', `/assessment/classes/${classId}/competencies`, token('homeroom'), {
      period_id: periods.CN,
      entries: [children.An, children.Binh].flatMap((childId) =>
        items.map((itemId) => ({ child_id: childId, item_id: itemId, level_code: 'T' })),
      ),
    });
    assert.equal(competency.status, 200, JSON.stringify(competency.body));
    const summary = await api(
      'GET',
      `/assessment/classes/${classId}/summary?period_id=${periods.CN}`,
      token('manager'),
    );
    assert.equal(summary.status, 200, JSON.stringify(summary.body));
    const math = list(summary.body.subjects).find((row) => row.subject_id === subjects['TH-TOAN']);
    assert.deepEqual(math?.by_level, { T: 1, H: 1, C: 0 });
    assert.deepEqual(math?.scores, { '9-10': 1, '7-8': 1, '5-6': 0, 'duoi-5': 0 });
    const year = await api('GET', `/assessment/classes/${classId}/year-results`, token('homeroom'));
    assert.equal(year.status, 200, JSON.stringify(year.body));
    const suggested = Object.fromEntries(list(year.body.rows).map((row) => [row.full_name, row.suggested]));
    assert.deepEqual(suggested, { 'Học sinh An': 'excellent', 'Học sinh Binh': 'completed' });
    const entries = [
      { child_id: children.An, result: 'excellent' },
      { child_id: children.Binh, result: 'good', note: 'Hội đồng xét' },
    ];
    assert.equal(
      (await api('PUT', `/assessment/classes/${classId}/year-results`, token('math'), { entries })).status,
      403,
    );
    const confirmed = await api('PUT', `/assessment/classes/${classId}/year-results`, token('homeroom'), { entries });
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
    const binh = list(confirmed.body.rows).find((row) => row.child_id === children.Binh);
    assert.deepEqual([binh?.suggested, (binh?.confirmed as { result: string }).result], ['completed', 'good']);
  });

  it('CT-20c-6: phụ huynh xem kết quả đã khoá, kết quả cuối năm, nhận xét thường xuyên; không xem con người khác', async () => {
    const comment = await api('POST', `/assessment/classes/${classId}/comments`, token('homeroom'), {
      child_id: children.An,
      subject_id: subjects['TH-TV'],
      date: vietnamToday,
      content: 'Đọc to, rõ ràng',
    });
    assert.equal(comment.status, 201, JSON.stringify(comment.body));
    assert.equal(
      (
        await api('POST', `/assessment/classes/${classId}/comments`, token('math'), {
          child_id: children.An,
          subject_id: subjects['TH-TV'],
          date: vietnamToday,
          content: 'Không phải môn mình',
        })
      ).status,
      403,
    );
    const before = await api('GET', `/assessment/children/${children.An}`, token('parent'));
    assert.equal(before.status, 200, JSON.stringify(before.body));
    assert.deepEqual([list(before.body.periods).length, before.body.year_result], [0, null]);
    assert.equal(list(before.body.comments).length, 1);
    assert.equal(
      (await api('POST', '/assessment/locks', principal.accessToken, { period_id: periods.CN })).status,
      200,
    );
    const afterLock = await api('GET', `/assessment/children/${children.An}`, token('parent'));
    const yearEnd = list(afterLock.body.periods).find((period) => period.id === periods.CN);
    assert.ok(yearEnd);
    assert.ok(list(yearEnd.subjects).some((row) => row.subject_name === 'Toán' && row.score === 9));
    assert.equal((afterLock.body.year_result as { result: string }).result, 'excellent');
    assert.equal((await api('GET', `/assessment/children/${children.An}`, token('otherParent'))).status, 403);
    assert.equal(
      (
        await api('PUT', `/assessment/classes/${classId}/year-results`, token('homeroom'), {
          entries: [{ child_id: children.An, result: 'good' }],
        })
      ).status,
      422,
    );
  });
});
