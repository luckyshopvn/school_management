import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import {
  createDatabase,
  MEAL_SERVICE_ID,
  replaceDatabaseName,
  type SchoolYearDatabase,
} from '@school-management/database';
import { hasLevelFeature } from '@school-management/shared';
import type { Kysely } from 'kysely';
import { conductPeriod, mondayOf, rankClasses } from '../conduct/conduct-calc.js';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { boardingMealDays, unclosedBoardingDays } from './boarding-roster.js';

// Bán trú Tiểu học; nề nếp, thi đua lớp (DT-20 phần 20b, YCTD-159); kịch bản CT-20b-1 đến CT-20b-6
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const weekdayOf = (date: string) => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
};
// Ngày học gần nhất không sau hôm nay, ngày học trước đó và ngày học kế tiếp sau hôm nay (thứ hai đến thứ sáu)
let schoolDay = vietnamToday;
while (weekdayOf(schoolDay) > 5) {
  schoolDay = addDays(schoolDay, -1);
}
let previousDay = addDays(schoolDay, -1);
while (weekdayOf(previousDay) > 5) {
  previousDay = addDays(previousDay, -1);
}
let nextDay = addDays(vietnamToday, 1);
while (weekdayOf(nextDay) > 5) {
  nextDay = addDays(nextDay, 1);
}
const errorOf = (body: Record<string, unknown>) => (body.error ?? {}) as { code?: string; rule_code?: string };

describe('Tổng hợp nề nếp và chức năng bán trú theo cấp', () => {
  it('CT-20b-1: tuần từ thứ hai; tháng, học kỳ lấy trung bình điểm tuần; bằng điểm cùng hạng; bán trú chỉ ở Tiểu học', () => {
    assert.equal(mondayOf('2026-10-25'), '2026-10-19');
    assert.equal(mondayOf('2026-10-19'), '2026-10-19');
    const week = conductPeriod('week', '2026-10-22');
    assert.deepEqual(week, { from: '2026-10-19', to: '2026-10-25', weeks: ['2026-10-19'] });
    const month = conductPeriod('month', '2026-02-10');
    assert.equal(month.to, '2026-02-28');
    assert.deepEqual(month.weeks, ['2026-02-02', '2026-02-09', '2026-02-16', '2026-02-23']);
    const term = conductPeriod('range', '2026-10-01', { from: '2026-09-05', to: '2026-09-30' });
    assert.deepEqual(term.weeks, ['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28']);
    const classes = [
      { class_id: 'a', class_name: '1A', grade_level: 'K1' },
      { class_id: 'b', class_name: '1B', grade_level: 'K1' },
      { class_id: 'c', class_name: '1C', grade_level: 'K1' },
    ];
    const ranked = rankClasses(
      classes,
      [
        { class_id: 'a', entry_date: '2026-02-03', points: -4 },
        { class_id: 'b', entry_date: '2026-02-04', points: 3 },
        { class_id: 'b', entry_date: '2026-02-05', points: -3 },
        // Ngoài kỳ thì không tính
        { class_id: 'a', entry_date: '2026-03-02', points: -10 },
      ],
      month,
      100,
    );
    assert.deepEqual(
      ranked.map((row) => [row.class_name, row.score, row.rank, row.plus_points, row.minus_points]),
      [
        ['1B', 100, 1, 3, 3],
        ['1C', 100, 1, 0, 0],
        ['1A', 99, 3, 0, 4],
      ],
    );
    assert.equal(hasLevelFeature('TH', 'boarding_meal'), true);
    assert.equal(hasLevelFeature('MN', 'boarding_meal'), false);
    assert.equal(hasLevelFeature('TH', 'meal_report'), false);
  });
});

describe('Bán trú Tiểu học, nề nếp và thi đua lớp', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let unitId = '';
  const users: Record<string, LoggedInUser> = {};
  const classes: Record<string, string> = {};
  const children: Record<string, string> = {};
  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);

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
        code: 'TLC',
        name: 'Trường liên cấp',
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
    users.homeroom = await environment.loginAs('VT-07', unitId);
    users.otherTeacher = await environment.loginAs('VT-07', unitId);
    users.manager = await environment.loginAs('VT-03', unitId);
    users.kitchen = await environment.loginAs('VT-10', unitId);
    users.parent = await environment.loginAs('VT-14', unitId);
    users.otherParent = await environment.loginAs('VT-14', unitId);
    await api('POST', '/grade-levels', principal.accessToken, {
      code: 'MAM',
      name: 'Mầm',
      age_from_months: 36,
      age_to_months: 71,
    });
    await api('POST', '/grade-levels', principal.accessToken, { code: 'K1', name: 'Khối 1', school_level: 'TH' });
    for (const [code, grade, level] of [
      ['MAM-1', 'MAM', 'MN'],
      ['1A', 'K1', 'TH'],
      ['1B', 'K1', 'TH'],
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
            max_size: 30,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    await schoolYear
      .insertInto('class_staff_assignments')
      .values({
        class_id: classes['1A'] ?? '',
        staff_user_id: users.homeroom?.userId ?? '',
        staff_name: 'Chủ nhiệm 1A',
        assignment_role: 'homeroom',
        from_date: addDays(vietnamToday, -60),
      })
      .execute();
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: 'ME', name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    // An, Bình đăng ký bán trú; Chi không đăng ký; Dung học lớp Mầm non
    for (const [key, classCode, parent, boarding] of [
      ['An', '1A', 'parent', true],
      ['Binh', '1A', 'otherParent', true],
      ['Chi', '1A', null, false],
      ['Dung', 'MAM-1', null, true],
    ] as const) {
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitId,
          full_name: `Học sinh ${key}`,
          dob: '2019-03-01',
          gender: 'female',
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
        .values({ child_id: child.id, class_id: classes[classCode] ?? '', from_date: addDays(vietnamToday, -60) })
        .execute();
      if (parent) {
        const guardian = await schoolYear
          .insertInto('guardians')
          .values({
            full_name: `Phụ huynh ${key}`,
            phone: `090${Math.floor(Math.random() * 9_000_000 + 1_000_000)}`,
            user_id: users[parent]?.userId ?? null,
          })
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
      if (boarding) {
        const months = new Set([previousDay, schoolDay, nextDay].map((date) => date.slice(0, 7)));
        for (const month of months) {
          await schoolYear
            .insertInto('service_registrations')
            .values({
              child_id: child.id,
              org_unit_id: unitId,
              period_year: Number(month.slice(0, 4)),
              period_month: Number(month.slice(5, 7)),
              service_id: MEAL_SERVICE_ID,
              status: 'active',
              source: 'system',
            })
            .execute();
        }
      }
    }
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-20b-2: danh sách ăn là học sinh đăng ký trừ cắt suất; lớp Mầm non không dùng; giáo viên lớp khác bị chặn', async () => {
    const roster = await api('GET', `/boarding/classes/${classes['1A']}/roster?date=${schoolDay}`, token('homeroom'));
    assert.equal(roster.status, 200, JSON.stringify(roster.body));
    assert.equal(roster.body.registered_count, 2);
    assert.equal(roster.body.headcount, 2);
    assert.equal(roster.body.closed, false);
    const preschool = await api(
      'GET',
      `/boarding/classes/${classes['MAM-1']}/roster?date=${schoolDay}`,
      principal.accessToken,
    );
    assert.equal(preschool.status, 422);
    assert.equal(errorOf(preschool.body).rule_code, 'YCTD-159');
    const other = await api(
      'GET',
      `/boarding/classes/${classes['1A']}/roster?date=${schoolDay}`,
      token('otherTeacher'),
    );
    assert.equal(other.status, 403);
    const cut = await api('POST', `/boarding/classes/${classes['1A']}/cuts`, token('homeroom'), {
      child_id: children.Binh,
      date: schoolDay,
      cut: true,
      reason: 'Về quê',
    });
    assert.equal(cut.status, 200, JSON.stringify(cut.body));
    assert.equal(cut.body.headcount, 1);
    const notRegistered = await api('POST', `/boarding/classes/${classes['1A']}/cuts`, token('homeroom'), {
      child_id: children.Chi,
      date: schoolDay,
      cut: true,
    });
    assert.equal(notRegistered.status, 422);
    const kitchen = await api('GET', `/classes/${classes['1A']}/meal-report?date=${schoolDay}`, token('homeroom'));
    assert.equal(kitchen.status, 200, JSON.stringify(kitchen.body));
    assert.deepEqual([kitchen.body.headcount, kitchen.body.source], [1, 'boarding_open']);
    const mealReport = await api('POST', `/classes/${classes['1A']}/meal-report`, token('homeroom'), {
      date: schoolDay,
      headcount: 5,
    });
    assert.equal(mealReport.status, 422);
    assert.equal(errorOf(mealReport.body).rule_code, 'YCTD-159');
  });

  it('CT-20b-3: chốt số suất cho bếp; đã chốt thì không cắt suất; mở lại phải có lý do; ngày ăn thực tế cho tiền ăn', async () => {
    const future = await api('POST', `/boarding/classes/${classes['1A']}/close`, token('homeroom'), { date: nextDay });
    assert.equal(future.status, 422);
    const closed = await api('POST', `/boarding/classes/${classes['1A']}/close`, token('homeroom'), {
      date: schoolDay,
    });
    assert.equal(closed.status, 200, JSON.stringify(closed.body));
    assert.deepEqual([closed.body.closed, closed.body.headcount], [true, 1]);
    const kitchen = await api('GET', `/classes/${classes['1A']}/meal-report?date=${schoolDay}`, token('homeroom'));
    assert.deepEqual(
      [kitchen.body.headcount, kitchen.body.source, kitchen.body.day_locked],
      [1, 'boarding_closed', true],
    );
    const late = await api('POST', `/boarding/classes/${classes['1A']}/cuts`, token('homeroom'), {
      child_id: children.An,
      date: schoolDay,
      cut: true,
    });
    assert.equal(late.status, 422);
    const withoutReason = await api('POST', `/boarding/classes/${classes['1A']}/reopen`, token('manager'), {
      date: schoolDay,
    });
    assert.equal(withoutReason.status, 400);
    const reopened = await api('POST', `/boarding/classes/${classes['1A']}/reopen`, token('manager'), {
      date: schoolDay,
      reason: 'Bếp báo nhầm',
    });
    assert.equal(reopened.status, 200, JSON.stringify(reopened.body));
    assert.equal(reopened.body.closed, false);
    assert.equal(
      (await api('POST', `/boarding/classes/${classes['1A']}/close`, token('manager'), { date: schoolDay })).status,
      200,
    );
    const roster = [
      { id: children.An ?? '', class_id: classes['1A'] ?? '' },
      { id: children.Binh ?? '', class_id: classes['1A'] ?? '' },
    ];
    const days = schoolDay === previousDay ? [schoolDay] : [previousDay, schoolDay];
    const meals = await boardingMealDays(schoolYear, roster, days);
    // Ngày trước chưa chốt nên chưa tính; ngày đã chốt An ăn, Bình cắt suất
    assert.deepEqual([meals.get(children.An ?? ''), meals.get(children.Binh ?? '')], [1, 0]);
    assert.deepEqual(await unclosedBoardingDays(schoolYear, [classes['1A'] ?? ''], days), [
      { class_id: classes['1A'], date: previousDay },
    ]);
  });

  it('CT-20b-4: phụ huynh báo, hủy cắt suất của con từ hôm nay trở đi; không báo cho con người khác', async () => {
    const cut = await api('POST', `/boarding/children/${children.An}/cuts`, token('parent'), {
      date: nextDay,
      reason: 'Đi khám răng',
    });
    assert.equal(cut.status, 200, JSON.stringify(cut.body));
    assert.equal(cut.body.registered, true);
    assert.deepEqual(
      (cut.body.cuts as Array<{ meal_date: string; source: string }>).map((row) => [row.meal_date, row.source]),
      [[nextDay, 'parent']],
    );
    const roster = await api('GET', `/boarding/classes/${classes['1A']}/roster?date=${nextDay}`, token('homeroom'));
    assert.equal(roster.body.headcount, 1);
    const past = await api('POST', `/boarding/children/${children.An}/cuts`, token('parent'), { date: previousDay });
    assert.equal(past.status, 422);
    const stranger = await api('POST', `/boarding/children/${children.An}/cuts`, token('otherParent'), {
      date: nextDay,
    });
    assert.equal(stranger.status, 403);
    const removed = await api('DELETE', `/boarding/children/${children.An}/cuts/${nextDay}`, token('parent'));
    assert.equal(removed.status, 200, JSON.stringify(removed.body));
    assert.deepEqual(removed.body.cuts, []);
  });

  it('CT-20b-5: nề nếp tuỳ trường; chưa bật thì không ghi điểm; chỉ quản lý bật, khai báo tiêu chí', async () => {
    const settings = await api('GET', '/conduct/settings', token('homeroom'));
    assert.deepEqual([settings.body.enabled, settings.body.base_points], [false, 100]);
    assert.equal(
      (await api('PUT', '/conduct/settings', token('homeroom'), { enabled: true, base_points: 100 })).status,
      403,
    );
    const defaults = await api('POST', '/conduct/criteria/defaults', principal.accessToken, { school_level: 'TH' });
    assert.equal(defaults.status, 200, JSON.stringify(defaults.body));
    assert.equal((defaults.body.created as string[]).length, 8);
    const again = await api('POST', '/conduct/criteria/defaults', principal.accessToken, { school_level: 'TH' });
    assert.equal((again.body.created as string[]).length, 0);
    const criteria = await api('GET', '/conduct/criteria?school_level=TH', token('homeroom'));
    const late = (criteria.body as unknown as Array<{ id: string; code: string }>).find(
      (item) => item.code === 'DI_MUON',
    );
    const disabled = await api('POST', '/conduct/entries', token('homeroom'), {
      class_id: classes['1A'],
      criterion_id: late?.id,
      date: schoolDay,
    });
    assert.equal(disabled.status, 422);
    assert.equal(errorOf(disabled.body).rule_code, 'YCTD-159');
    const enabled = await api('PUT', '/conduct/settings', principal.accessToken, { enabled: true, base_points: 100 });
    assert.equal(enabled.status, 200, JSON.stringify(enabled.body));
    assert.equal(enabled.body.enabled, true);
    const duplicate = await api('POST', '/conduct/criteria', principal.accessToken, {
      code: 'DI_MUON',
      name: 'Trùng mã',
      kind: 'minus',
      points: 1,
    });
    assert.equal(duplicate.status, 409);
  });

  it('CT-20b-6: giáo viên ghi điểm, ghi thay đội cờ đỏ; tiêu chí khác cấp bị chặn; xếp hạng lớp theo tuần', async () => {
    const criteria = (await api('GET', '/conduct/criteria?school_level=TH', token('homeroom')))
      .body as unknown as Array<{
      id: string;
      code: string;
    }>;
    const idOf = (code: string) => criteria.find((item) => item.code === code)?.id;
    const late = await api('POST', '/conduct/entries', token('otherTeacher'), {
      class_id: classes['1A'],
      criterion_id: idOf('DI_MUON'),
      date: schoolDay,
      quantity: 2,
      reported_by: 'Đội cờ đỏ lớp 5A',
    });
    assert.equal(late.status, 201, JSON.stringify(late.body));
    assert.deepEqual([late.body.points, late.body.reported_by], [-2, 'Đội cờ đỏ lớp 5A']);
    const good = await api('POST', '/conduct/entries', token('homeroom'), {
      class_id: classes['1B'],
      criterion_id: idOf('VIEC_TOT'),
      date: schoolDay,
    });
    assert.equal(good.status, 201, JSON.stringify(good.body));
    const preschool = await api('POST', '/conduct/entries', token('homeroom'), {
      class_id: classes['MAM-1'],
      criterion_id: idOf('VIEC_TOT'),
      date: schoolDay,
    });
    assert.equal(preschool.status, 422);
    const ranking = await api(
      'GET',
      `/conduct/ranking?period=week&date=${schoolDay}&school_level=TH`,
      token('homeroom'),
    );
    assert.equal(ranking.status, 200, JSON.stringify(ranking.body));
    assert.deepEqual(
      (ranking.body.classes as Array<{ class_name: string; score: number; rank: number }>).map((row) => [
        row.class_name,
        row.score,
        row.rank,
      ]),
      [
        ['1B', 103, 1],
        ['1A', 98, 2],
      ],
    );
    const entries = await api('GET', `/conduct/entries?from=${schoolDay}&to=${schoolDay}`, token('manager'));
    assert.equal((entries.body as unknown as unknown[]).length, 2);
    // Người ghi xóa được dòng của mình trong ngày; giáo viên khác không xóa được
    assert.equal((await api('DELETE', `/conduct/entries/${late.body.id}`, token('homeroom'))).status, 403);
    assert.equal((await api('DELETE', `/conduct/entries/${late.body.id}`, token('otherTeacher'))).status, 200);
  });
});
