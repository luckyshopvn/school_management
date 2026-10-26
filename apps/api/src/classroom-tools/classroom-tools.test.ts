import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, vietnamDate, type SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import {
  clampClientTime,
  parseCallsInput,
  parseGroupsInput,
  parseScoreEventsInput,
  splitConductQuantity,
  tallyScores,
} from './classroom-tools.js';

// Công cụ lớp học (DT-23 phần 23b, YCTD-212): kiểm tra dữ liệu gửi lên, danh sách lớp gọn, ghi lượt gọi và dòng điểm chống trùng,
// bản chia nhóm, chuyển điểm vào nề nếp (DT-21) có xác nhận. Học sinh, giáo viên là dữ liệu giả
describe('Kiểm tra dữ liệu công cụ lớp học', () => {
  it('CT-23b-5: lượt gọi, nhóm, dòng điểm hợp lệ; sai thì báo lỗi nhập liệu', () => {
    const classId = randomUUID();
    const childA = randomUUID();
    const childB = randomUUID();
    const calls = parseCallsInput({
      class_id: classId,
      calls: [{ client_id: randomUUID(), child_id: childA, called_at: '2026-10-26T01:00:00.000Z' }],
    });
    assert.equal(calls.calls.length, 1);
    for (const body of [
      { class_id: classId, calls: [] },
      { class_id: classId, calls: [{ client_id: 'x', child_id: childA }] },
      { class_id: classId, calls: [{ client_id: randomUUID(), child_id: childA, called_at: 'hôm qua' }] },
      { class_id: 'x', calls: [{ client_id: randomUUID(), child_id: childA }] },
    ]) {
      assert.throws(() => parseCallsInput(body), { code: 'ERR_VALIDATION' }, JSON.stringify(body));
    }

    assert.deepEqual(
      parseGroupsInput({
        groups: [
          { name: ' Nhóm 1 ', child_ids: [childA] },
          { name: 'Nhóm 2', child_ids: [childB] },
        ],
      }).map((group) => group.name),
      ['Nhóm 1', 'Nhóm 2'],
    );
    for (const body of [
      { groups: [] },
      { groups: [{ name: '', child_ids: [childA] }] },
      {
        groups: [
          { name: 'A', child_ids: [childA] },
          { name: 'A', child_ids: [childB] },
        ],
      },
      {
        groups: [
          { name: 'A', child_ids: [childA] },
          { name: 'B', child_ids: [childA] },
        ],
      },
    ]) {
      assert.throws(() => parseGroupsInput(body), { code: 'ERR_VALIDATION' }, JSON.stringify(body));
    }

    const events = parseScoreEventsInput({
      class_id: classId,
      session_key: randomUUID(),
      events: [
        { client_id: randomUUID(), target_kind: 'group', group_name: 'Nhóm 1', delta: 2 },
        { client_id: randomUUID(), target_kind: 'student', child_id: childA, delta: -1, note: ' nói chuyện ' },
      ],
    });
    assert.equal(events.events[1]?.note, 'nói chuyện');
    for (const delta of [0, 51, 1.5, '2']) {
      assert.throws(
        () =>
          parseScoreEventsInput({
            class_id: classId,
            session_key: randomUUID(),
            events: [{ client_id: randomUUID(), target_kind: 'group', group_name: 'A', delta }],
          }),
        { code: 'ERR_VALIDATION' },
        `delta ${String(delta)}`,
      );
    }
    assert.throws(
      () =>
        parseScoreEventsInput({
          class_id: classId,
          session_key: randomUUID(),
          events: [{ client_id: randomUUID(), target_kind: 'student', delta: 1 }],
        }),
      { code: 'ERR_VALIDATION' },
    );
  });

  it('CT-23b-6: giờ bấm trên máy chỉ tin trong khoảng hợp lý; tổng điểm; tách dòng nề nếp quá 50 lần', () => {
    const now = new Date('2026-10-26T03:00:00.000Z');
    assert.equal(clampClientTime(null, now), now);
    assert.equal(clampClientTime('2026-10-26T02:00:00.000Z', now).toISOString(), '2026-10-26T02:00:00.000Z');
    assert.equal(clampClientTime('2026-10-26T03:02:00.000Z', now).toISOString(), '2026-10-26T03:02:00.000Z');
    assert.equal(clampClientTime('2026-10-26T04:00:00.000Z', now), now, 'giờ máy ở tương lai xa thì lấy giờ máy chủ');
    assert.equal(clampClientTime('2026-10-01T00:00:00.000Z', now), now, 'quá cũ thì lấy giờ máy chủ');

    const totals = tallyScores([
      { target_kind: 'group', group_name: 'N1', child_id: null, delta: 3, confirmed: true },
      { target_kind: 'group', group_name: 'N1', child_id: null, delta: -1, confirmed: false },
    ]);
    assert.deepEqual(totals, [{ target_kind: 'group', key: 'N1', total: 2, pending: -1 }]);

    assert.deepEqual(splitConductQuantity(7), [7]);
    assert.deepEqual(splitConductQuantity(50), [50]);
    assert.deepEqual(splitConductQuantity(120), [50, 50, 20]);
  });
});

describe('Điểm cuối công cụ lớp học', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let teacher: LoggedInUser;
  let otherTeacher: LoggedInUser;
  let parent: LoggedInUser;
  let unitId = '';
  let classId = '';
  const children: Array<{ id: string; name: string }> = [];
  const criteria: Record<string, string> = {};
  const url = (path: string) => `${environment.baseUrl}${path}`;
  const api = (method: string, path: string, token: string, body?: unknown) => sendJson(method, url(path), token, body);

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
        code: 'TH-23B',
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
    teacher = await environment.loginAs('VT-07', unitId);
    otherTeacher = await environment.loginAs('VT-07', unitId);
    parent = await environment.loginAs('VT-14', unitId);
    classId = (
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
    const assigned = await api('POST', `/classes/${classId}/staff-assignments`, principal.accessToken, {
      staff_user_id: teacher.userId,
      assignment_role: 'homeroom',
    });
    assert.equal(assigned.status, 201, JSON.stringify(assigned.body));
    // Số thứ tự cố định: An 2, Bình 1, Chi không có (xếp theo tên sau cùng)
    for (const [name, order] of [
      ['Học sinh An', 2],
      ['Học sinh Bình', 1],
      ['Học sinh Chi', null],
    ] as const) {
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
          moet_student_code: `M-${order ?? 'x'}`,
          photo_consent: 'granted',
          status: 'active',
          enroll_date: '2026-09-05',
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      children.push({ id: child.id, name });
      await schoolYear
        .insertInto('class_enrollments')
        .values({ child_id: child.id, class_id: classId, from_date: '2026-09-05', order_number: order })
        .execute();
    }
    // Nề nếp, thi đua lớp bật với một tiêu chí cộng, một tiêu chí trừ của Tiểu học
    assert.equal(
      (await api('PUT', '/conduct/settings', principal.accessToken, { enabled: true, base_points: 100 })).status,
      200,
    );
    for (const [code, kind] of [
      ['CONG', 'plus'],
      ['TRU', 'minus'],
    ] as const) {
      const created = await api('POST', '/conduct/criteria', principal.accessToken, {
        code,
        name: kind === 'plus' ? 'Tích cực phát biểu' : 'Nói chuyện riêng',
        kind,
        points: 2,
        school_level: 'TH',
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      criteria[code] = created.body.id as string;
    }
  });

  after(async () => {
    await schoolYear?.destroy();
    await environment?.close();
  });

  const child = (index: number) => children[index]?.id ?? '';

  it('CT-23b-7: cấu hình công cụ: ngoại tuyến bật, giữ 24 giờ mặc định; trường đổi thì theo trường', async () => {
    const initial = await api('GET', '/classroom-tools/config', teacher.accessToken);
    assert.equal(initial.status, 200);
    assert.deepEqual(initial.body, { offline_enabled: true, roster_ttl_hours: 24, conduct_enabled: true });
    await schoolYear
      .insertInto('settings')
      .values([
        { org_unit_id: unitId, key: 'classroom_offline_enabled', value: JSON.stringify(false) },
        { org_unit_id: unitId, key: 'classroom_roster_ttl_hours', value: JSON.stringify(6) },
      ])
      .execute();
    const changed = await api('GET', '/classroom-tools/config', teacher.accessToken);
    assert.deepEqual(changed.body, { offline_enabled: false, roster_ttl_hours: 6, conduct_enabled: true });
    await schoolYear
      .deleteFrom('settings')
      .where('key', 'in', ['classroom_offline_enabled', 'classroom_roster_ttl_hours'])
      .execute();
  });

  it('CT-23b-8: danh sách lớp gọn theo số thứ tự, kèm mã; vắng hôm nay đánh dấu; người ngoài lớp bị chặn', async () => {
    const today = vietnamDate(new Date());
    await schoolYear
      .insertInto('attendance_records')
      .values({
        child_id: child(0),
        class_id: classId,
        org_unit_id: unitId,
        attendance_date: today,
        status: 'absent_unnotified',
        source: 'teacher',
        recorded_by: teacher.userId,
        recorded_at: new Date(),
      })
      .execute();
    const roster = await api('GET', `/classroom-tools/classes/${classId}/roster`, teacher.accessToken);
    assert.equal(roster.status, 200, JSON.stringify(roster.body));
    const students = roster.body.students as Array<Record<string, unknown>>;
    assert.deepEqual(
      students.map((student) => [student.order_no, student.full_name, student.code, student.absent_today]),
      [
        [1, 'Học sinh Bình', 'M-1', false],
        [2, 'Học sinh An', 'M-2', true],
        [3, 'Học sinh Chi', 'M-x', false],
      ],
    );
    // Bản chụp gọn: không điểm, nhận xét, thông tin phụ huynh, ngày sinh, số định danh
    for (const student of students) {
      assert.deepEqual(Object.keys(student).sort(), ['absent_today', 'code', 'full_name', 'id', 'order_no']);
    }
    assert.equal(
      (await api('GET', `/classroom-tools/classes/${classId}/roster`, otherTeacher.accessToken)).status,
      403,
    );
    assert.equal((await api('GET', `/classroom-tools/classes/${classId}/roster`, parent.accessToken)).status, 403);
    assert.equal(
      (await api('GET', `/classroom-tools/classes/${randomUUID()}/roster`, teacher.accessToken)).status,
      404,
    );
  });

  it('CT-23b-9: ghi lượt gọi chống trùng khi gửi lại, xem lại, xóa của mình', async () => {
    const first = randomUUID();
    const second = randomUUID();
    const body = {
      class_id: classId,
      calls: [
        { client_id: first, child_id: child(0), called_at: new Date(Date.now() - 60_000).toISOString() },
        { client_id: second, child_id: child(1) },
      ],
    };
    const saved = await api('POST', '/classroom-tools/calls', teacher.accessToken, body);
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.deepEqual(saved.body, { saved: 2, duplicates: 0 });
    const again = await api('POST', '/classroom-tools/calls', teacher.accessToken, body);
    assert.deepEqual(again.body, { saved: 0, duplicates: 2 }, 'gửi lại từ hàng đợi ngoại tuyến không tạo dòng trùng');
    const unknown = await api('POST', '/classroom-tools/calls', teacher.accessToken, {
      class_id: classId,
      calls: [{ client_id: randomUUID(), child_id: randomUUID() }],
    });
    assert.equal(unknown.status, 400);
    assert.equal(
      (await api('POST', '/classroom-tools/calls', otherTeacher.accessToken, body)).status,
      403,
      'giáo viên không phụ trách lớp không ghi được',
    );
    const list = await api('GET', `/classroom-tools/classes/${classId}/calls`, teacher.accessToken);
    const rows = list.body as unknown as Array<Record<string, unknown>>;
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.full_name, 'Học sinh Bình', 'lượt mới nhất ở đầu');
    const removed = await api(
      'DELETE',
      `/classroom-tools/classes/${classId}/calls/${rows[0]?.id as string}`,
      teacher.accessToken,
    );
    assert.deepEqual(removed.body, { deleted: 1 });
    const cleared = await api('DELETE', `/classroom-tools/classes/${classId}/calls`, teacher.accessToken);
    assert.deepEqual(cleared.body, { deleted: 1 });
    assert.equal(
      (await api('DELETE', `/classroom-tools/classes/${classId}/calls/${randomUUID()}`, teacher.accessToken)).status,
      404,
    );
  });

  it('CT-23b-10: giữ bản chia nhóm gần nhất của giáo viên; mỗi học sinh một nhóm, đúng học sinh của lớp', async () => {
    const empty = await api('GET', `/classroom-tools/classes/${classId}/grouping`, teacher.accessToken);
    assert.deepEqual(empty.body, { groups: [], updated_at: null });
    const groups = [
      { name: 'Nhóm 1', child_ids: [child(0), child(1)] },
      { name: 'Nhóm 2', child_ids: [child(2)] },
    ];
    const saved = await api('PUT', `/classroom-tools/classes/${classId}/grouping`, teacher.accessToken, { groups });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.deepEqual(saved.body.groups, groups);
    const replaced = await api('PUT', `/classroom-tools/classes/${classId}/grouping`, teacher.accessToken, {
      groups: [{ name: 'Nhóm 1', child_ids: [child(2)] }],
    });
    assert.equal(replaced.status, 200);
    assert.equal(
      (await schoolYear.selectFrom('classroom_groupings').select('id').where('class_id', '=', classId).execute())
        .length,
      1,
      'một dòng mỗi lớp và giáo viên',
    );
    assert.equal(
      (
        await api('PUT', `/classroom-tools/classes/${classId}/grouping`, teacher.accessToken, {
          groups: [{ name: 'Nhóm 1', child_ids: [randomUUID()] }],
        })
      ).status,
      400,
    );
    const other = await api('GET', `/classroom-tools/classes/${classId}/grouping`, principal.accessToken);
    assert.deepEqual(other.body.groups, [], 'bản chia của giáo viên khác không lẫn vào');
  });

  it('CT-23b-11: bảng điểm nhanh: ghi chống trùng, cộng theo nhóm và học sinh, bỏ buổi', async () => {
    const session = randomUUID();
    const eventA = randomUUID();
    const body = {
      class_id: classId,
      session_key: session,
      events: [
        { client_id: eventA, target_kind: 'group', group_name: 'Nhóm 1', delta: 5 },
        { client_id: randomUUID(), target_kind: 'group', group_name: 'Nhóm 1', delta: -2 },
        { client_id: randomUUID(), target_kind: 'student', child_id: child(1), delta: 1 },
      ],
    };
    assert.deepEqual((await api('POST', '/classroom-tools/scores', teacher.accessToken, body)).body, {
      saved: 3,
      duplicates: 0,
    });
    assert.deepEqual((await api('POST', '/classroom-tools/scores', teacher.accessToken, body)).body, {
      saved: 0,
      duplicates: 3,
    });
    const view = await api(
      'GET',
      `/classroom-tools/classes/${classId}/scores?session_key=${session}`,
      teacher.accessToken,
    );
    assert.deepEqual(view.body.totals, [
      { target_kind: 'group', key: 'Nhóm 1', total: 3, pending: 3 },
      { target_kind: 'student', key: child(1), total: 1, pending: 1 },
    ]);
    const stranger = await api(
      'GET',
      `/classroom-tools/classes/${classId}/scores?session_key=${session}`,
      principal.accessToken,
    );
    assert.deepEqual(stranger.body.totals, [], 'dòng điểm của giáo viên khác không hiện');
    const discarded = await api('DELETE', `/classroom-tools/classes/${classId}/scores/${session}`, teacher.accessToken);
    assert.deepEqual(discarded.body, { deleted: 3 });
    const bad = await api('POST', '/classroom-tools/scores', teacher.accessToken, {
      class_id: classId,
      session_key: randomUUID(),
      events: [{ client_id: randomUUID(), target_kind: 'student', child_id: randomUUID(), delta: 1 }],
    });
    assert.equal(bad.status, 400);
  });

  it('CT-23b-12: chuyển điểm vào nề nếp chỉ khi giáo viên chọn tiêu chí và xác nhận; đúng chiều, không chuyển đôi', async () => {
    const session = randomUUID();
    await api('POST', '/classroom-tools/scores', teacher.accessToken, {
      class_id: classId,
      session_key: session,
      events: [
        { client_id: randomUUID(), target_kind: 'group', group_name: 'Nhóm 1', delta: 4 },
        { client_id: randomUUID(), target_kind: 'student', child_id: child(1), delta: 2 },
      ],
    });
    const confirmPath = `/classroom-tools/classes/${classId}/scores/${session}/confirm`;
    // Chưa xác nhận thì chưa có dòng nề nếp nào
    assert.equal(
      (await schoolYear.selectFrom('conduct_entries').select('id').where('class_id', '=', classId).execute()).length,
      0,
    );
    const wrongWay = await api('POST', confirmPath, teacher.accessToken, { criterion_id: criteria.TRU });
    assert.equal(wrongWay.status, 422, JSON.stringify(wrongWay.body));
    assert.equal(
      (
        await schoolYear
          .selectFrom('classroom_score_events')
          .select('id')
          .where('confirmed_at', 'is not', null)
          .execute()
      ).length,
      0,
      'xác nhận lỗi thì trả lại dòng điểm',
    );
    const confirmed = await api('POST', confirmPath, teacher.accessToken, {
      criterion_id: criteria.CONG,
      date: '2026-10-26',
    });
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
    assert.equal(confirmed.body.net, 6);
    assert.equal(confirmed.body.quantity, 6);
    const entries = await schoolYear
      .selectFrom('conduct_entries')
      .selectAll()
      .where('class_id', '=', classId)
      .execute();
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.quantity, 6);
    assert.equal(entries[0]?.points, 12, 'điểm theo tiêu chí: 2 điểm một lần, 6 lần');
    assert.match(entries[0]?.note ?? '', /^Bảng điểm nhanh: Nhóm 1 \(\+4\), Học sinh Bình \(\+2\)$/);
    assert.equal(entries[0]?.recorded_by, teacher.userId);
    const again = await api('POST', confirmPath, teacher.accessToken, { criterion_id: criteria.CONG });
    assert.equal(again.status, 422, 'không chuyển lần hai');
    assert.equal(
      (await schoolYear.selectFrom('conduct_entries').select('id').where('class_id', '=', classId).execute()).length,
      1,
    );
    // Bỏ buổi đã xác nhận không xóa dòng đã chuyển
    const discard = await api('DELETE', `/classroom-tools/classes/${classId}/scores/${session}`, teacher.accessToken);
    assert.deepEqual(discard.body, { deleted: 0 });
  });

  it('CT-23b-13: tổng lớn tách nhiều dòng nề nếp; nề nếp tắt thì không chuyển và dòng điểm được trả lại', async () => {
    const session = randomUUID();
    await api('POST', '/classroom-tools/scores', teacher.accessToken, {
      class_id: classId,
      session_key: session,
      events: Array.from({ length: 4 }, () => ({
        client_id: randomUUID(),
        target_kind: 'group',
        group_name: 'Nhóm 2',
        delta: 30,
      })),
    });
    const confirmPath = `/classroom-tools/classes/${classId}/scores/${session}/confirm`;
    const before = (
      await schoolYear.selectFrom('conduct_entries').select('id').where('class_id', '=', classId).execute()
    ).length;
    assert.equal(
      (await api('PUT', '/conduct/settings', principal.accessToken, { enabled: false, base_points: 100 })).status,
      200,
    );
    const disabled = await api('POST', confirmPath, teacher.accessToken, { criterion_id: criteria.CONG });
    assert.equal(disabled.status, 422, JSON.stringify(disabled.body));
    assert.equal(
      (
        await schoolYear
          .selectFrom('classroom_score_events')
          .select('id')
          .where('session_key', '=', session)
          .where('confirmed_at', 'is', null)
          .execute()
      ).length,
      4,
    );
    assert.equal(
      (await api('PUT', '/conduct/settings', principal.accessToken, { enabled: true, base_points: 100 })).status,
      200,
    );
    const done = await api('POST', confirmPath, teacher.accessToken, {
      criterion_id: criteria.CONG,
      targets: [{ kind: 'group', key: 'Nhóm 2' }],
    });
    assert.equal(done.status, 200, JSON.stringify(done.body));
    assert.equal(done.body.quantity, 120);
    const after = await schoolYear
      .selectFrom('conduct_entries')
      .select('quantity')
      .where('class_id', '=', classId)
      .execute();
    assert.equal(after.length - before, 3, '120 lần tách thành 50, 50, 20');
    assert.equal(
      (await api('POST', confirmPath, otherTeacher.accessToken, { criterion_id: criteria.CONG })).status,
      403,
    );
  });
});
