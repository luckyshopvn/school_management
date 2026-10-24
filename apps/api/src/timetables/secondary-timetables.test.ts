import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import ExcelJS from 'exceljs';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import { hasLevelFeature, listPortalMenuEntries, portalWorkspacesForLevels } from '@school-management/shared';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { findTimetableConflicts, type TimetableContext, type TimetableLessonInput } from './timetable-rules.js';
import { parseLessonCells } from './timetables.js';

// Thời khoá biểu THCS, THPT (DT-21 phần 21b, YCTD-169): nhóm học, tiết đôi, phòng bộ môn; kịch bản CT-21b-1 đến CT-21b-6
const lesson = (overrides: Partial<TimetableLessonInput>): TimetableLessonInput => ({
  class_id: 'L1',
  class_name: '10A',
  weekday: 1,
  period_no: 1,
  subject_id: 'TOAN',
  subject_name: 'Toán',
  teacher_user_id: 'GV1',
  teacher_name: 'Cô An',
  room_id: null,
  room_name: null,
  group_no: 0,
  ...overrides,
});

const context: TimetableContext = {
  periods: [1, 2, 3, 4, 5],
  school_days: [1, 2, 3, 4, 5],
  planned: new Map([
    [
      'L1',
      new Map([
        ['TOAN', { subject_name: 'Toán', periods: 2 }],
        ['VL', { subject_name: 'Vật lí', periods: 2, elective: true }],
        ['DL', { subject_name: 'Địa lí', periods: 2, elective: true }],
      ]),
    ],
  ]),
  assigned: new Map([
    ['L1:TOAN', 'GV1'],
    ['L1:VL', 'GV2'],
    ['L1:DL', 'GV3'],
  ]),
};
const codesOf = (conflicts: ReturnType<typeof findTimetableConflicts>) =>
  conflicts.map((conflict) => `${conflict.severity}:${conflict.code}`).sort();

describe('Luật xung đột thời khoá biểu THCS, THPT', () => {
  it('CT-21b-1: nhóm học cùng ô không xung đột; tiết cả lớp cùng ô với tiết nhóm xung đột cứng; giáo viên trùng giữa các nhóm', () => {
    const groups = [
      lesson({ subject_id: 'TOAN' }),
      lesson({
        weekday: 1,
        period_no: 2,
        subject_id: 'VL',
        subject_name: 'Vật lí',
        teacher_user_id: 'GV2',
        teacher_name: 'Thầy Bình',
        group_no: 1,
      }),
      lesson({
        weekday: 1,
        period_no: 2,
        subject_id: 'DL',
        subject_name: 'Địa lí',
        teacher_user_id: 'GV3',
        teacher_name: 'Cô Chi',
        group_no: 2,
      }),
      lesson({ weekday: 2, period_no: 1, subject_id: 'TOAN' }),
    ];
    // Môn lựa chọn học theo nhóm nên không so số tiết cả lớp với chương trình; Toán đủ 2 tiết
    assert.deepEqual(findTimetableConflicts(groups, context), []);
    const clash = findTimetableConflicts(
      [
        ...groups,
        lesson({ weekday: 1, period_no: 2, subject_id: 'TOAN', teacher_user_id: 'GV4', teacher_name: 'Cô Dung' }),
      ],
      context,
    );
    assert.ok(codesOf(clash).includes('hard:class_group_clash'));
    // Cùng một giáo viên dạy hai nhóm cùng ô thì trùng giáo viên
    const teacherClash = findTimetableConflicts(
      [
        lesson({
          subject_id: 'VL',
          subject_name: 'Vật lí',
          teacher_user_id: 'GV2',
          teacher_name: 'Thầy Bình',
          group_no: 1,
        }),
        lesson({
          subject_id: 'DL',
          subject_name: 'Địa lí',
          teacher_user_id: 'GV2',
          teacher_name: 'Thầy Bình',
          group_no: 2,
        }),
      ],
      context,
    );
    assert.ok(codesOf(teacherClash).includes('hard:teacher_clash'));
    assert.ok(!codesOf(teacherClash).includes('hard:class_group_clash'));
  });

  it('CT-21b-2: môn có quy tắc tiết đôi cần hai tiết liền nhau trong ngày; môn có phòng bộ môn cần dùng phòng đó', () => {
    const rules: TimetableContext = {
      ...context,
      subject_rules: new Map([
        ['TOAN', { double_period: true, room_id: null, room_name: null }],
        ['VL', { double_period: false, room_id: 'PTN', room_name: 'Phòng thí nghiệm' }],
      ]),
    };
    const split = findTimetableConflicts([lesson({}), lesson({ weekday: 3, period_no: 1 })], rules);
    assert.deepEqual(codesOf(split), ['soft:double_period_split']);
    const paired = findTimetableConflicts([lesson({}), lesson({ period_no: 2 })], rules);
    assert.deepEqual(codesOf(paired), []);
    const wrongRoom = findTimetableConflicts(
      [
        lesson({ weekday: 2 }),
        lesson({ weekday: 2, period_no: 2 }),
        lesson({
          subject_id: 'VL',
          subject_name: 'Vật lí',
          teacher_user_id: 'GV2',
          teacher_name: 'Thầy Bình',
          group_no: 1,
          room_id: 'P101',
          room_name: 'P.101',
        }),
      ],
      rules,
    );
    assert.deepEqual(codesOf(wrongRoom), ['soft:room_not_subject_room']);
    const rightRoom = findTimetableConflicts(
      [
        lesson({ weekday: 2 }),
        lesson({ weekday: 2, period_no: 2 }),
        lesson({
          subject_id: 'VL',
          subject_name: 'Vật lí',
          teacher_user_id: 'GV2',
          teacher_name: 'Thầy Bình',
          group_no: 1,
          room_id: 'PTN',
          room_name: 'Phòng thí nghiệm',
        }),
      ],
      rules,
    );
    assert.deepEqual(codesOf(rightRoom), []);
    // Ô nhập: nhóm mặc định 0, ngoài 0 đến 9 bị từ chối, cùng ô cùng nhóm bị từ chối
    const subject = randomUUID();
    assert.equal(parseLessonCells({ lessons: [{ weekday: 1, period_no: 1, subject_id: subject }] })[0]?.group_no, 0);
    assert.throws(
      () => parseLessonCells({ lessons: [{ weekday: 1, period_no: 1, subject_id: subject, group_no: 10 }] }),
      {
        code: 'ERR_VALIDATION',
      },
    );
    assert.equal(
      parseLessonCells({
        lessons: [
          { weekday: 1, period_no: 1, subject_id: subject, group_no: 1 },
          { weekday: 1, period_no: 1, subject_id: subject, group_no: 2 },
        ],
      }).length,
      2,
    );
    assert.throws(
      () =>
        parseLessonCells({
          lessons: [
            { weekday: 1, period_no: 1, subject_id: subject, group_no: 1 },
            { weekday: 1, period_no: 1, subject_id: subject, group_no: 1 },
          ],
        }),
      { code: 'ERR_VALIDATION' },
    );
  });

  it('CT-21b-3: menu thời khoá biểu dùng chung ba cấp; chức năng ứng dụng theo cấp', () => {
    const paths = ['/period-slots', '/timetables', '/timetable-generator', '/timetable-changes', '/timetable-reports'];
    for (const level of ['TH', 'THCS', 'THPT'] as const) {
      const shown = listPortalMenuEntries(portalWorkspacesForLevels([{ code: level, display_name: level }])).map(
        (entry) => entry.node.path,
      );
      for (const path of paths) {
        assert.ok(shown.includes(path as never), `${level} thiếu ${path}`);
      }
      assert.equal(hasLevelFeature(level, 'period_timetable'), true);
    }
    const preschool = listPortalMenuEntries(portalWorkspacesForLevels([{ code: 'MN', display_name: 'MN' }])).map(
      (entry) => entry.node.path,
    );
    for (const path of paths) {
      assert.ok(!preschool.includes(path as never), `MN không có ${path}`);
    }
  });
});

describe('Điểm cuối thời khoá biểu THPT', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let viewer: LoggedInUser;
  let unitId = '';
  let academicYearId = '';
  let versionId = '';
  const teachers: LoggedInUser[] = [];
  const classes: Record<string, string> = {};
  const subjects: Record<string, string> = {};
  const children: Record<string, string> = {};
  const combinations: Record<string, string> = {};
  const url = (path: string) => `${environment.baseUrl}${path}`;
  const api = (method: string, path: string, token: string, body?: unknown) => sendJson(method, url(path), token, body);
  const list = (body: unknown) => body as unknown as Array<Record<string, unknown>>;
  const errorOf = (body: Record<string, unknown>) =>
    (body.error ?? {}) as { code?: string; details?: Array<{ field: string }> };
  const upload = async (path: string, token: string, file: Buffer) => {
    const form = new FormData();
    form.set('file', new Blob([file]), 'thoi-khoa-bieu.xlsx');
    const response = await fetch(url(path), {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: form,
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  };

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
        code: 'THPT-21B',
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
    assert.equal(
      (await api('POST', '/grade-levels/templates', principal.accessToken, { school_level: 'THPT' })).status,
      200,
    );
    assert.equal(
      (await api('POST', '/subjects/templates', principal.accessToken, { school_level: 'THPT' })).status,
      200,
    );
    for (const row of list((await api('GET', '/subjects?school_level=THPT', principal.accessToken)).body)) {
      subjects[row.code as string] = row.id as string;
    }
    viewer = await environment.loginAs('VT-07', unitId);
    teachers.push(
      await environment.loginAs('VT-08', unitId),
      await environment.loginAs('VT-08', unitId),
      await environment.loginAs('VT-08', unitId),
    );
    classes['10A'] = (
      await schoolYear
        .insertInto('classes')
        .values({
          org_unit_id: unitId,
          academic_year_id: academicYearId,
          code: '10A',
          name: 'Lớp 10A',
          grade_level: 'K10',
          school_level: 'THPT',
          max_size: 45,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
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
    // Hai tổ hợp: khoa học tự nhiên (có Vật lí), khoa học xã hội (có Địa lí)
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
    for (const [key, combination] of [
      ['TN', 'TH-TN'],
      ['XH', 'TH-XH'],
      ['none', null],
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
        .values({ child_id: child.id, class_id: classes['10A'] ?? '', from_date: '2026-09-05' })
        .execute();
      if (combination) {
        const registered = await api('PUT', `/children/${child.id}/subject-combination`, principal.accessToken, {
          combination_id: combinations[combination],
        });
        assert.equal(registered.status, 200, JSON.stringify(registered.body));
      }
    }
    const slots = [1, 2, 3, 4, 5].map((period) => ({
      period_no: period,
      session: 'morning',
      start_time: `${String(6 + period).padStart(2, '0')}:00`,
      end_time: `${String(6 + period).padStart(2, '0')}:45`,
    }));
    assert.equal(
      (await api('PUT', '/period-slots', principal.accessToken, { school_level: 'THPT', slots })).status,
      200,
    );
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-21b-4: tiết nhóm: ghi, xung đột với tiết cả lớp chặn ban hành; ban hành; học sinh chỉ thấy tiết của tổ hợp mình', async () => {
    const created = await api('POST', '/timetable-versions', principal.accessToken, {
      school_level: 'THPT',
      name: 'Học kỳ I',
      effective_from: '2026-09-07',
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    versionId = created.body.id as string;
    const put = (lessons: unknown[]) =>
      api('PUT', `/timetable-versions/${versionId}/classes/${classes['10A']}/lessons`, principal.accessToken, {
        lessons,
      });
    const base = [
      { weekday: 1, period_no: 1, subject_id: subjects['THPT-TOAN'] },
      { weekday: 1, period_no: 2, subject_id: subjects['THPT-VL'], group_no: 1 },
      { weekday: 1, period_no: 2, subject_id: subjects['THPT-DL'], group_no: 2 },
    ];
    const saved = await put(base);
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.deepEqual(
      list(saved.body).map((row) => [row.period_no, row.group_no, row.teacher_user_id]),
      [
        [1, 0, teachers[0]?.userId],
        [2, 1, teachers[1]?.userId],
        [2, 2, teachers[2]?.userId],
      ],
    );
    // Thêm tiết cả lớp vào ô đã có tiết nhóm: kiểm tra ngay báo xung đột cứng, ban hành bị chặn
    const withClash = [...base, { weekday: 1, period_no: 2, subject_id: subjects['THPT-TOAN'] }];
    const check = await api(
      'POST',
      `/timetable-versions/${versionId}/classes/${classes['10A']}/check`,
      principal.accessToken,
      { lessons: withClash },
    );
    assert.equal(check.status, 200, JSON.stringify(check.body));
    assert.ok(list(check.body).some((row) => row.code === 'class_group_clash' && row.severity === 'hard'));
    assert.equal((await put(withClash)).status, 200);
    const blocked = await api('POST', `/timetable-versions/${versionId}/publish`, principal.accessToken);
    assert.equal(blocked.status, 422, JSON.stringify(blocked.body));
    assert.ok(errorOf(blocked.body).details?.some((detail) => detail.field === 'class_group_clash'));
    assert.equal((await put(base)).status, 200);
    const published = await api('POST', `/timetable-versions/${versionId}/publish`, principal.accessToken);
    assert.equal(published.status, 200, JSON.stringify(published.body));
    // Môn lựa chọn học theo nhóm nên không báo thiếu số tiết cả lớp
    const conflicts = await api('GET', `/timetable-versions/${versionId}/conflicts`, principal.accessToken);
    assert.ok(
      !list(conflicts.body).some((row) => /Vật lí|Địa lí/.test(String(row.message)) && row.code === 'periods_mismatch'),
    );
    // Thời khoá biểu của con theo tổ hợp
    const subjectsOf = async (key: string) =>
      list(
        ((await api('GET', `/children/${children[key]}/timetable`, viewer.accessToken)).body as { lessons: unknown })
          .lessons,
      )
        .map((row) => row.subject_code)
        .sort();
    assert.deepEqual(await subjectsOf('TN'), ['THPT-TOAN', 'THPT-VL']);
    assert.deepEqual(await subjectsOf('XH'), ['THPT-DL', 'THPT-TOAN']);
    assert.deepEqual(await subjectsOf('none'), ['THPT-TOAN']);
    // Xem theo lớp (nhân sự) thấy mọi nhóm
    const view = await api('GET', `/timetables?class_id=${classes['10A']}`, viewer.accessToken);
    assert.equal(list((view.body as { lessons: unknown }).lessons).length, 3);
  });

  it('CT-21b-5: nhập Excel có cột Nhóm; nhóm sai báo lỗi theo dòng; tệp mẫu có cột Nhóm', async () => {
    const created = await api('POST', '/timetable-versions', principal.accessToken, {
      school_level: 'THPT',
      name: 'Bản nhập',
      effective_from: '2027-01-18',
    });
    const draft = created.body.id as string;
    const book = async (rows: string[][]) => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Thời khoá biểu');
      sheet.addRow(['Mã lớp', 'Thứ', 'Tiết', 'Mã môn', 'Mã phòng', 'Nhóm']);
      for (const row of rows) {
        sheet.addRow(row);
      }
      return Buffer.from(await workbook.xlsx.writeBuffer());
    };
    const template = await fetch(url(`/timetable-versions/${draft}/import-template`), {
      headers: { authorization: `Bearer ${principal.accessToken}` },
    });
    assert.equal(template.status, 200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await template.arrayBuffer());
    assert.ok(workbook.worksheets[0]?.getRow(1).values?.toString().includes('Nhóm'));
    const bad = await upload(
      `/timetable-versions/${draft}/import`,
      principal.accessToken,
      await book([['10A', '2', '1', 'THPT-VL', '', '12']]),
    );
    assert.equal(bad.status, 200, JSON.stringify(bad.body));
    assert.equal(bad.body.imported, 0);
    assert.equal((bad.body.errors as Array<{ column: string }>)[0]?.column, 'Nhóm');
    const good = await upload(
      `/timetable-versions/${draft}/import`,
      principal.accessToken,
      await book([
        ['10A', '2', '1', 'THPT-TOAN', '', ''],
        ['10A', '2', '2', 'THPT-VL', '', '1'],
        ['10A', '2', '2', 'THPT-DL', '', '2'],
      ]),
    );
    assert.equal(good.status, 200, JSON.stringify(good.body));
    assert.equal(good.body.imported, 3, JSON.stringify(good.body));
    const dup = await upload(
      `/timetable-versions/${draft}/import`,
      principal.accessToken,
      await book([
        ['10A', '2', '2', 'THPT-VL', '', '1'],
        ['10A', '2', '2', 'THPT-DL', '', '1'],
      ]),
    );
    assert.equal(dup.body.imported, 0);
    const lessons = await api('GET', `/timetable-versions/${draft}/lessons`, principal.accessToken);
    assert.deepEqual(
      list((lessons.body as { lessons: unknown }).lessons)
        .map((row) => row.group_no)
        .sort(),
      [0, 1, 2],
    );
    // Chép bản giữ nhóm
    const copy = await api('POST', '/timetable-versions', principal.accessToken, {
      school_level: 'THPT',
      name: 'Bản chép',
      effective_from: '2027-02-01',
      copy_from_id: draft,
    });
    const copied = await api('GET', `/timetable-versions/${copy.body.id}/lessons`, principal.accessToken);
    assert.deepEqual(
      list((copied.body as { lessons: unknown }).lessons)
        .map((row) => row.group_no)
        .sort(),
      [0, 1, 2],
    );
  });

  it('CT-21b-6: dạy thay chỉ cho tiết cả lớp, tiết nhóm bị từ chối; quy tắc tiết đôi, phòng bộ môn hiện ở xung đột; máy xếp kiểm trước cho THPT', async () => {
    // Bản đang áp dụng từ 2026-09-07 (thứ Hai); ngày thứ Hai 2026-09-14
    const teacherOptions = list((await api('GET', '/timetable-changes/teachers', principal.accessToken)).body);
    const other = teacherOptions.find((row) => row.teacher_user_id === teachers[2]?.userId);
    assert.ok(other);
    const group = await api('POST', '/timetable-changes', principal.accessToken, {
      kind: 'substitute',
      date: '2026-09-14',
      class_id: classes['10A'],
      period_no: 2,
      teacher_user_id: teachers[0]?.userId,
      reason: 'Nhóm',
    });
    assert.equal(group.status, 422, JSON.stringify(group.body));
    assert.match(String((group.body.error as { message: string }).message), /tiết học nhóm/);
    const whole = await api('POST', '/timetable-changes', principal.accessToken, {
      kind: 'substitute',
      date: '2026-09-14',
      class_id: classes['10A'],
      period_no: 1,
      teacher_user_id: teachers[2]?.userId,
      reason: 'Cô vắng',
    });
    assert.equal(whole.status, 201, JSON.stringify(whole.body));
    const day = list(
      (await api('GET', `/timetable-changes/day?date=2026-09-14&class_id=${classes['10A']}`, principal.accessToken))
        .body,
    );
    assert.deepEqual(day.map((row) => [row.period_no, row.group_no]).sort(), [
      [1, 0],
      [2, 1],
      [2, 2],
    ]);
    // Quy tắc tiết đôi cho Toán, phòng bộ môn cho Vật lí
    const room = await schoolYear
      .insertInto('rooms')
      .values({ org_unit_id: unitId, code: 'PTN', name: 'Phòng thí nghiệm', capacity: 40 })
      .returning('id')
      .executeTakeFirstOrThrow();
    const rules = await api('PUT', '/timetable-generator/subject-rules', principal.accessToken, {
      school_level: 'THPT',
      rules: [
        { subject_id: subjects['THPT-TOAN'], double_period: true },
        { subject_id: subjects['THPT-VL'], room_id: room.id },
      ],
    });
    assert.equal(rules.status, 200, JSON.stringify(rules.body));
    const draft = (
      await api('POST', '/timetable-versions', principal.accessToken, {
        school_level: 'THPT',
        name: 'Quy tắc',
        effective_from: '2027-03-01',
      })
    ).body.id as string;
    const saved = await api(
      'PUT',
      `/timetable-versions/${draft}/classes/${classes['10A']}/lessons`,
      principal.accessToken,
      {
        lessons: [
          { weekday: 1, period_no: 1, subject_id: subjects['THPT-TOAN'] },
          { weekday: 3, period_no: 1, subject_id: subjects['THPT-TOAN'] },
          { weekday: 2, period_no: 2, subject_id: subjects['THPT-VL'], group_no: 1 },
        ],
      },
    );
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const conflicts = list((await api('GET', `/timetable-versions/${draft}/conflicts`, principal.accessToken)).body);
    const codes = conflicts.map((row) => row.code);
    assert.ok(codes.includes('double_period_split'), codes.join(','));
    assert.ok(codes.includes('room_not_subject_room'), codes.join(','));
    // Máy xếp: kiểm trước cho THPT bỏ qua môn học lựa chọn
    const precheck = await api('GET', '/timetable-generator/precheck?school_level=THPT', principal.accessToken);
    assert.equal(precheck.status, 200, JSON.stringify(precheck.body));
    assert.equal(precheck.body.classes, 1);
  });
});
