import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
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
import { coversZone, defaultRuleItems, vietnamMoment } from './supervision-calc.js';

// Giám thị và rèn luyện từng học sinh, lát L1 (YCTD-391): khu vực, danh mục nội quy, phân công trực, tra người đang trực;
// kịch bản CT-391-1 đến CT-391-6
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const errorOf = (body: Record<string, unknown>) =>
  (body.error ?? {}) as { code?: string; rule_code?: string; fields?: Array<{ field: string }> };

describe('Phần tính của giám thị', () => {
  it('CT-391-1: giờ Việt Nam, thứ trong tuần; phân công phủ khu vực theo thứ, giờ, ngày hiệu lực; bộ nội quy mặc định theo cấp', () => {
    // 00:30 giờ UTC thứ năm là 07:30 thứ năm giờ Việt Nam; 17:30 UTC thứ năm là 00:30 thứ sáu
    assert.deepEqual(vietnamMoment(new Date('2026-10-29T00:30:00Z')), {
      date: '2026-10-29',
      weekday: 4,
      time: '07:30',
    });
    assert.deepEqual(vietnamMoment(new Date('2026-10-29T17:30:00Z')), {
      date: '2026-10-30',
      weekday: 5,
      time: '00:30',
    });
    assert.equal(vietnamMoment(new Date('2026-11-01T03:00:00Z')).weekday, 7);
    const window = {
      zone_ids: ['a'],
      weekdays: [1, 2, 3, 4, 5],
      start_time: '06:30',
      end_time: '11:30',
      from_date: '2026-09-05',
      to_date: null,
    };
    const thursday = { date: '2026-10-29', weekday: 4, time: '07:30' };
    assert.equal(coversZone(window, 'a', thursday), true);
    assert.equal(coversZone(window, 'b', thursday), false);
    assert.equal(coversZone({ ...window, zone_ids: [] }, 'b', thursday), true);
    assert.equal(coversZone(window, 'a', { ...thursday, time: '11:30' }), false);
    assert.equal(coversZone(window, 'a', { ...thursday, time: '06:30' }), true);
    assert.equal(coversZone(window, 'a', { ...thursday, weekday: 6 }), false);
    assert.equal(coversZone(window, 'a', { ...thursday, date: '2026-09-04' }), false);
    assert.equal(coversZone({ ...window, to_date: '2026-10-28' }, 'a', thursday), false);
    const primary = defaultRuleItems('TH').map((item) => item.code);
    assert.ok(!primary.includes('HUT_THUOC'));
    assert.ok(defaultRuleItems('THPT').some((item) => item.code === 'HUT_THUOC' && item.parent_notice === 'immediate'));
    assert.ok(primary.includes('GIUP_BAN'));
  });
});

describe('Danh mục nội quy, khu vực, phân công giám thị trực', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let supervisor: LoggedInUser;
  let homeroom: LoggedInUser;
  let unitId = '';
  const staff: Record<string, string> = {};
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
        code: 'THCS',
        name: 'Trường trung học cơ sở',
        unit_type: 'truong_chinh',
      })
    ).body.id as string;
    const current = await api('GET', '/school-levels', principal.accessToken);
    const levels = (current.body.levels as Array<Record<string, unknown>>).map(
      ({ code, order_no, display_name, learner_term, context_label }) => ({
        code,
        is_enabled: code === 'TH' || code === 'THCS',
        order_no,
        display_name,
        learner_term,
        context_label,
      }),
    );
    assert.equal((await api('PUT', '/school-levels', principal.accessToken, { levels })).status, 200);
    supervisor = await environment.loginAs('VT-22', unitId);
    homeroom = await environment.loginAs('VT-07', unitId);
    for (const grade of [
      { code: 'K6', name: 'Khối 6', school_level: 'THCS' },
      { code: 'K1', name: 'Khối 1', school_level: 'TH' },
    ]) {
      const created = await api('POST', '/grade-levels', principal.accessToken, grade);
      assert.equal(created.status, 201, JSON.stringify(created.body));
    }
    for (const [name, userId] of [
      ['Giám thị Tuấn', supervisor.userId],
      ['Chưa có tài khoản', null],
    ] as const) {
      staff[name] = (
        await schoolYear
          .insertInto('staff')
          .values({
            org_unit_id: unitId,
            code: `NS-${randomInt(100_000, 999_999)}`,
            full_name: name,
            start_date: addDays(vietnamToday, -200),
            user_id: userId,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
  });

  after(async () => {
    await schoolYear?.destroy();
    await environment?.close();
  });

  it('CT-391-2: Ban giám hiệu tạo, sửa khu vực; trùng tên báo lỗi; giám thị và giáo viên chủ nhiệm chỉ đọc', async () => {
    const created = await api('POST', '/supervision/zones', principal.accessToken, { name: 'Sân trước', order_no: 1 });
    assert.equal(created.status, 201);
    const duplicate = await api('POST', '/supervision/zones', principal.accessToken, { name: 'Sân trước' });
    assert.equal(duplicate.status, 409);
    const renamed = await api('PATCH', `/supervision/zones/${created.body.id as string}`, principal.accessToken, {
      description: 'Khu chào cờ',
    });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.body.description, 'Khu chào cờ');
    assert.equal(renamed.body.name, 'Sân trước');
    assert.equal((await api('GET', '/supervision/zones', supervisor.accessToken)).status, 200);
    assert.equal((await api('GET', '/supervision/zones', homeroom.accessToken)).status, 200);
    assert.equal((await api('POST', '/supervision/zones', supervisor.accessToken, { name: 'Cổng sau' })).status, 403);
    assert.equal((await api('GET', '/supervision/assignments', homeroom.accessToken)).status, 403);
  });

  it('CT-391-3: nạp nội quy mặc định theo cấp, nạp lại bỏ qua mã đã có; không đổi mã, loại, cấp', async () => {
    const first = await api('POST', '/supervision/rule-items/defaults', principal.accessToken, {
      school_level: 'THCS',
    });
    assert.equal(first.status, 200);
    assert.ok((first.body.created as string[]).includes('HUT_THUOC'));
    const again = await api('POST', '/supervision/rule-items/defaults', principal.accessToken, {
      school_level: 'THCS',
    });
    assert.deepEqual(again.body.created, []);
    const mamNon = await api('POST', '/supervision/rule-items/defaults', principal.accessToken, { school_level: 'MN' });
    assert.equal(mamNon.status, 400);
    const items = (await api('GET', '/supervision/rule-items?school_level=THCS', supervisor.accessToken))
      .body as unknown as Array<{
      id: string;
      code: string;
      parent_notice: string;
    }>;
    const late = items.find((item) => item.code === 'DI_MUON');
    assert.equal(late?.parent_notice, 'daily_digest');
    const changeKind = await api('PATCH', `/supervision/rule-items/${late?.id ?? ''}`, principal.accessToken, {
      kind: 'commendation',
    });
    assert.equal(changeKind.status, 400);
    const notice = await api('PATCH', `/supervision/rule-items/${late?.id ?? ''}`, principal.accessToken, {
      parent_notice: 'none',
    });
    assert.equal(notice.body.parent_notice, 'none');
  });

  it('CT-391-4: mục nội quy gắn tiêu chí nề nếp lớp chỉ khi cùng cấp và đúng chiều cộng, trừ', async () => {
    const minus = (
      await api('POST', '/conduct/criteria', principal.accessToken, {
        code: 'TP',
        name: 'Trang phục',
        kind: 'minus',
        points: 2,
        school_level: 'THCS',
      })
    ).body.id as string;
    const plus = (
      await api('POST', '/conduct/criteria', principal.accessToken, {
        code: 'GB',
        name: 'Giúp bạn',
        kind: 'plus',
        points: 1,
        school_level: 'THCS',
      })
    ).body.id as string;
    const primaryMinus = (
      await api('POST', '/conduct/criteria', principal.accessToken, {
        code: 'TP1',
        name: 'Trang phục',
        kind: 'minus',
        points: 1,
        school_level: 'TH',
      })
    ).body.id as string;
    const linked = await api('POST', '/supervision/rule-items', principal.accessToken, {
      code: 'KHAN',
      name: 'Không đeo khăn quàng',
      kind: 'violation',
      school_level: 'THCS',
      class_criterion_id: minus,
    });
    assert.equal(linked.status, 201);
    assert.equal(linked.body.class_criterion_id, minus);
    const wrongSign = await api('POST', '/supervision/rule-items', principal.accessToken, {
      code: 'KHAN2',
      name: 'Không đeo khăn quàng',
      kind: 'violation',
      school_level: 'THCS',
      class_criterion_id: plus,
    });
    assert.equal(wrongSign.status, 422);
    assert.equal(errorOf(wrongSign.body).rule_code, 'YCTD-391');
    const wrongLevel = await api(
      'PATCH',
      `/supervision/rule-items/${linked.body.id as string}`,
      principal.accessToken,
      {
        class_criterion_id: primaryMinus,
      },
    );
    assert.equal(wrongLevel.status, 422);
    const unlinked = await api('PATCH', `/supervision/rule-items/${linked.body.id as string}`, principal.accessToken, {
      class_criterion_id: null,
    });
    assert.equal(unlinked.body.class_criterion_id, null);
  });

  it('CT-391-5: phân công trực kiểm nhân sự có tài khoản, khối cùng cấp, khu vực đang dùng, giờ hợp lệ', async () => {
    const zones = (await api('GET', '/supervision/zones', principal.accessToken)).body as unknown as Array<{
      id: string;
    }>;
    const zoneId = zones[0]?.id ?? '';
    const base = {
      staff_id: staff['Giám thị Tuấn'],
      school_level: 'THCS',
      grade_levels: ['K6'],
      zone_ids: [zoneId],
      weekdays: [1, 2, 3, 4, 5],
      start_time: '06:30',
      end_time: '11:30',
    };
    const options = (await api('GET', '/supervision/staff-options', principal.accessToken)).body as unknown as Array<{
      full_name: string;
    }>;
    assert.deepEqual(
      options.map((option) => option.full_name),
      ['Giám thị Tuấn'],
    );
    const noAccount = await api('POST', '/supervision/assignments', principal.accessToken, {
      ...base,
      staff_id: staff['Chưa có tài khoản'],
    });
    assert.equal(noAccount.status, 422);
    const wrongGrade = await api('POST', '/supervision/assignments', principal.accessToken, {
      ...base,
      grade_levels: ['K1'],
    });
    assert.equal(wrongGrade.status, 400);
    const badTime = await api('POST', '/supervision/assignments', principal.accessToken, {
      ...base,
      start_time: '11:30',
      end_time: '06:30',
    });
    assert.equal(badTime.status, 400);
    const noDays = await api('POST', '/supervision/assignments', principal.accessToken, { ...base, weekdays: [] });
    assert.equal(noDays.status, 400);
    const created = await api('POST', '/supervision/assignments', principal.accessToken, base);
    assert.equal(created.status, 201);
    assert.equal(created.body.staff_name, 'Giám thị Tuấn');
    assert.deepEqual(created.body.weekdays, [1, 2, 3, 4, 5]);
    const shortened = await api(
      'PATCH',
      `/supervision/assignments/${created.body.id as string}`,
      principal.accessToken,
      {
        end_time: '10:00',
      },
    );
    assert.equal(shortened.status, 200);
    assert.equal(shortened.body.start_time, '06:30');
    assert.equal(shortened.body.end_time, '10:00');
    const reversed = await api(
      'PATCH',
      `/supervision/assignments/${created.body.id as string}`,
      principal.accessToken,
      {
        start_time: '10:30',
      },
    );
    assert.equal(reversed.status, 400);
    const list = (await api('GET', '/supervision/assignments?school_level=THCS', principal.accessToken))
      .body as unknown as Array<{ id: string }>;
    assert.equal(list.length, 1);
  });

  it('CT-391-6: tra người đang trực khu vực theo thứ, giờ Việt Nam; ngừng phân công thì không còn ai trực', async () => {
    const zones = (await api('GET', '/supervision/zones', principal.accessToken)).body as unknown as Array<{
      id: string;
    }>;
    const zoneId = zones[0]?.id ?? '';
    const other = (await api('POST', '/supervision/zones', principal.accessToken, { name: 'Cổng sau' })).body
      .id as string;
    // Thứ năm 29/10/2026 lúc 07:30 giờ Việt Nam
    const thursdayMorning = '2026-10-29T00:30:00Z';
    const onDuty = await api(
      'GET',
      `/supervision/on-duty?zone_id=${zoneId}&at=${thursdayMorning}`,
      principal.accessToken,
    );
    assert.equal(onDuty.status, 200);
    assert.deepEqual(
      (onDuty.body as unknown as Array<{ full_name: string; user_id: string }>).map((row) => [
        row.full_name,
        row.user_id,
      ]),
      [['Giám thị Tuấn', supervisor.userId]],
    );
    const otherZone = await api(
      'GET',
      `/supervision/on-duty?zone_id=${other}&at=${thursdayMorning}`,
      principal.accessToken,
    );
    assert.deepEqual(otherZone.body, []);
    const saturday = await api(
      'GET',
      `/supervision/on-duty?zone_id=${zoneId}&at=2026-10-31T00:30:00Z`,
      principal.accessToken,
    );
    assert.deepEqual(saturday.body, []);
    const assignments = (await api('GET', '/supervision/assignments', principal.accessToken)).body as unknown as Array<{
      id: string;
    }>;
    await api('PATCH', `/supervision/assignments/${assignments[0]?.id ?? ''}`, principal.accessToken, {
      status: 'inactive',
    });
    const stopped = await api(
      'GET',
      `/supervision/on-duty?zone_id=${zoneId}&at=${thursdayMorning}`,
      principal.accessToken,
    );
    assert.deepEqual(stopped.body, []);
    assert.equal((await api('GET', `/supervision/on-duty?zone_id=${zoneId}`, supervisor.accessToken)).status, 403);
  });
});
