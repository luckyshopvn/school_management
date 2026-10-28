import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import ExcelJS from 'exceljs';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { findTimetableConflicts, type TimetableLessonInput } from './timetable-rules.js';
import { parseLessonCells, parsePeriodSlots, readWeekdayText } from './timetables.js';

// Thời khoá biểu phần khung (DT-20 phần 22c1, YCTD-160): khung giờ tiết, bản thời khoá biểu, xung đột, ban hành, nhập Excel,
// xem theo lớp, giáo viên, phòng, lịch dạy của giáo viên, thời khoá biểu của con
const lesson = (overrides: Partial<TimetableLessonInput>): TimetableLessonInput => ({
  class_id: 'L1',
  class_name: '1A',
  weekday: 1,
  period_no: 1,
  subject_id: 'TV',
  subject_name: 'Tiếng Việt',
  teacher_user_id: 'GV1',
  teacher_name: 'Cô An',
  room_id: null,
  room_name: null,
  ...overrides,
});

describe('Kiểm tra dữ liệu và xung đột thời khoá biểu', () => {
  it('CT-22c1-1: khung giờ không trùng, không chồng giờ; ô tiết hợp lệ; thứ trong tệp; xung đột cứng, mềm', () => {
    assert.deepEqual(
      parsePeriodSlots({
        slots: [
          { period_no: 2, session: 'morning', start_time: '07:55', end_time: '08:30' },
          { period_no: 1, session: 'morning', start_time: '07:15', end_time: '07:50' },
        ],
      }).map((slot) => slot.period_no),
      [1, 2],
    );
    for (const slots of [
      [{ period_no: 1, session: 'morning', start_time: '08:00', end_time: '07:50' }],
      [{ period_no: 16, session: 'morning', start_time: '07:15', end_time: '07:50' }],
      [
        { period_no: 1, session: 'morning', start_time: '07:15', end_time: '07:50' },
        { period_no: 1, session: 'morning', start_time: '08:15', end_time: '08:50' },
      ],
      [
        { period_no: 1, session: 'morning', start_time: '07:15', end_time: '07:50' },
        { period_no: 2, session: 'morning', start_time: '07:45', end_time: '08:20' },
      ],
      [{ period_no: 1, session: 'evening', start_time: '07:15', end_time: '07:50' }],
    ]) {
      assert.throws(() => parsePeriodSlots({ slots }), { code: 'ERR_VALIDATION' }, JSON.stringify(slots));
    }
    const subject = randomUUID();
    assert.equal(parseLessonCells({ lessons: [{ weekday: 1, period_no: 1, subject_id: subject }] })[0]?.room_id, null);
    assert.throws(
      () =>
        parseLessonCells({
          lessons: [
            { weekday: 1, period_no: 1, subject_id: subject },
            { weekday: 1, period_no: 1, subject_id: subject },
          ],
        }),
      { code: 'ERR_VALIDATION' },
    );
    assert.throws(() => parseLessonCells({ lessons: [{ weekday: 8, period_no: 1, subject_id: subject }] }), {
      code: 'ERR_VALIDATION',
    });
    assert.deepEqual(['2', '7', 'CN', 'cn', '8', '1', 'x'].map(readWeekdayText), [1, 6, 7, 7, 7, null, null]);

    const context = {
      periods: [1, 2, 3, 4],
      school_days: [1, 2, 3, 4, 5],
      planned: new Map([
        ['L1', new Map([['TV', { subject_name: 'Tiếng Việt', periods: 2 }]])],
        ['L2', new Map([['TV', { subject_name: 'Tiếng Việt', periods: 1 }]])],
      ]),
      assigned: new Map([
        ['L1:TV', 'GV1'],
        ['L2:TV', 'GV2'],
      ]),
    };
    const clean = findTimetableConflicts(
      [
        lesson({}),
        lesson({ period_no: 2 }),
        lesson({ class_id: 'L2', class_name: '1B', teacher_user_id: 'GV2', teacher_name: 'Cô Bình' }),
      ],
      context,
    );
    assert.deepEqual(clean, []);
    const conflicts = findTimetableConflicts(
      [
        lesson({ room_id: 'P1', room_name: 'P.101' }),
        lesson({ period_no: 6 }),
        lesson({ weekday: 6, period_no: 2 }),
        lesson({ weekday: 2, subject_id: 'TOAN', subject_name: 'Toán' }),
        // Cô An dạy lớp 1B cùng tiết với lớp 1A, cùng phòng P.101; không phải giáo viên được phân công môn của 1B
        lesson({ class_id: 'L2', class_name: '1B', room_id: 'P1', room_name: 'P.101' }),
        lesson({ class_id: 'L2', class_name: '1B', weekday: 3, teacher_user_id: null, teacher_name: null }),
      ],
      context,
    );
    const codes = conflicts.map((conflict) => `${conflict.severity}:${conflict.code}`).sort();
    assert.deepEqual(codes, [
      'hard:day_outside_week',
      'hard:period_outside_frame',
      'hard:room_clash',
      'hard:subject_outside_curriculum',
      'hard:teacher_clash',
      'soft:missing_teacher',
      'soft:periods_mismatch',
      'soft:periods_mismatch',
      'soft:teacher_not_assigned',
    ]);
    assert.match(
      conflicts.find((conflict) => conflict.code === 'teacher_clash')?.message ?? '',
      /Cô An dạy 2 lớp cùng Thứ 2 tiết 1: 1A, 1B/,
    );
  });
});

describe('Điểm cuối thời khoá biểu', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let viewer: LoggedInUser;
  let unitId = '';
  let versionId = '';
  const teachers: LoggedInUser[] = [];
  const parents: LoggedInUser[] = [];
  const classes: Record<string, string> = {};
  const subjects: Record<string, string> = {};
  let childId = '';
  const url = (path: string) => `${environment.baseUrl}${path}`;
  const api = (method: string, path: string, token: string, body?: unknown) => sendJson(method, url(path), token, body);
  const list = (body: unknown) => body as unknown as Array<Record<string, unknown>>;
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
  const workbook = async (rows: string[][]) => {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('Thời khoá biểu');
    sheet.addRow(['Mã lớp', 'Thứ', 'Tiết', 'Mã môn', 'Mã phòng']);
    for (const row of rows) {
      sheet.addRow(row);
    }
    return Buffer.from(await book.xlsx.writeBuffer());
  };

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
        code: 'TH-22C',
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
    for (const row of list((await api('GET', '/subjects?school_level=TH', principal.accessToken)).body)) {
      subjects[row.code as string] = row.id as string;
    }
    viewer = await environment.loginAs('VT-07', unitId);
    teachers.push(await environment.loginAs('VT-08', unitId), await environment.loginAs('VT-08', unitId));
    parents.push(await environment.loginAs('VT-14', unitId), await environment.loginAs('VT-14', unitId));
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
    await schoolYear
      .insertInto('rooms')
      .values({ org_unit_id: unitId, code: 'P101', name: 'Phòng 101', capacity: 40 })
      .execute();
    // Cô thứ nhất dạy Tiếng Việt cả hai lớp; cô thứ hai dạy Toán lớp 1A
    for (const [classCode, subject, teacher] of [
      ['1A', 'TH-TV', 0],
      ['1B', 'TH-TV', 0],
      ['1A', 'TH-TOAN', 1],
    ] as const) {
      const assigned = await api('POST', `/classes/${classes[classCode]}/staff-assignments`, principal.accessToken, {
        staff_user_id: teachers[teacher]?.userId,
        assignment_role: 'subject',
        subject_id: subjects[subject],
      });
      assert.equal(assigned.status, 201, JSON.stringify(assigned.body));
    }
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: 'ME', name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    const child = await schoolYear
      .insertInto('children')
      .values({
        org_unit_id: unitId,
        full_name: 'Học sinh lớp 1A',
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
    childId = child.id;
    await schoolYear
      .insertInto('class_enrollments')
      .values({ child_id: child.id, class_id: classes['1A'] ?? '', from_date: '2026-09-05' })
      .execute();
    const guardian = await schoolYear
      .insertInto('guardians')
      .values({ full_name: 'Mẹ học sinh', phone: '0901234567', user_id: parents[0]?.userId ?? null })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('child_guardians')
      .values({ child_id: child.id, guardian_id: guardian.id, relationship_item_id: relationship.id, is_primary: true })
      .execute();
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-22c1-2: khung giờ tiết: người có quyền ghi, mọi người xem; tạo bản nháp; sửa tiết của lớp, giáo viên theo phân công', async () => {
    const slots = [1, 2, 3, 4].map((period) => ({
      period_no: period,
      session: 'morning',
      start_time: `${String(6 + period).padStart(2, '0')}:00`,
      end_time: `${String(6 + period).padStart(2, '0')}:35`,
    }));
    assert.equal((await api('PUT', '/period-slots', viewer.accessToken, { school_level: 'TH', slots })).status, 403);
    const saved = await api('PUT', '/period-slots', principal.accessToken, { school_level: 'TH', slots });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(list((await api('GET', '/period-slots?school_level=TH', viewer.accessToken)).body).length, 4);

    assert.equal(
      (
        await api('POST', '/timetable-versions', viewer.accessToken, {
          school_level: 'TH',
          name: 'X',
          effective_from: '2026-09-07',
        })
      ).status,
      403,
    );
    const created = await api('POST', '/timetable-versions', principal.accessToken, {
      school_level: 'TH',
      name: 'Học kỳ I',
      effective_from: '2026-09-07',
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    versionId = created.body.id as string;
    assert.equal(created.body.status, 'draft');

    const saveA = await api(
      'PUT',
      `/timetable-versions/${versionId}/classes/${classes['1A']}/lessons`,
      principal.accessToken,
      {
        lessons: [
          { weekday: 1, period_no: 1, subject_id: subjects['TH-TV'] },
          { weekday: 1, period_no: 2, subject_id: subjects['TH-TOAN'] },
          { weekday: 1, period_no: 6, subject_id: subjects['TH-TV'] },
        ],
      },
    );
    assert.equal(saveA.status, 200, JSON.stringify(saveA.body));
    assert.deepEqual(
      list(saveA.body).map((row) => [row.period_no, row.teacher_user_id]),
      [
        [1, teachers[0]?.userId],
        [2, teachers[1]?.userId],
        [6, teachers[0]?.userId],
      ],
    );
    // Môn của cấp khác, lớp khác cấp bị từ chối
    assert.equal(
      (
        await api('PUT', `/timetable-versions/${versionId}/classes/${classes['1A']}/lessons`, principal.accessToken, {
          lessons: [{ weekday: 1, period_no: 1, subject_id: randomUUID() }],
        })
      ).status,
      400,
    );
  });

  it('CT-22c1-3: xung đột chặn ban hành; sửa xong ban hành; bản đã ban hành chỉ đọc; chép sang bản nháp mới', async () => {
    // Lớp 1B học Tiếng Việt tiết 1 thứ Hai cùng cô với lớp 1A
    await api('PUT', `/timetable-versions/${versionId}/classes/${classes['1B']}/lessons`, principal.accessToken, {
      lessons: [{ weekday: 1, period_no: 1, subject_id: subjects['TH-TV'] }],
    });
    const conflicts = list((await api('GET', `/timetable-versions/${versionId}/conflicts`, viewer.accessToken)).body);
    const hard = conflicts
      .filter((conflict) => conflict.severity === 'hard')
      .map((conflict) => conflict.code)
      .sort();
    assert.deepEqual(hard, ['period_outside_frame', 'teacher_clash']);
    const blocked = await api('POST', `/timetable-versions/${versionId}/publish`, principal.accessToken);
    assert.equal(blocked.status, 422);
    await api('PUT', `/timetable-versions/${versionId}/classes/${classes['1A']}/lessons`, principal.accessToken, {
      lessons: [
        { weekday: 1, period_no: 1, subject_id: subjects['TH-TV'] },
        { weekday: 1, period_no: 2, subject_id: subjects['TH-TOAN'] },
      ],
    });
    await api('PUT', `/timetable-versions/${versionId}/classes/${classes['1B']}/lessons`, principal.accessToken, {
      lessons: [{ weekday: 1, period_no: 3, subject_id: subjects['TH-TV'] }],
    });
    const soft = list((await api('GET', `/timetable-versions/${versionId}/conflicts`, viewer.accessToken)).body);
    assert.ok(soft.length > 0 && soft.every((conflict) => conflict.severity === 'soft'));
    const published = await api('POST', `/timetable-versions/${versionId}/publish`, principal.accessToken);
    assert.equal(published.status, 200, JSON.stringify(published.body));
    assert.equal(published.body.status, 'published');
    const locked = await api(
      'PUT',
      `/timetable-versions/${versionId}/classes/${classes['1B']}/lessons`,
      principal.accessToken,
      {
        lessons: [],
      },
    );
    assert.equal(locked.status, 422);
    assert.equal((await api('DELETE', `/timetable-versions/${versionId}`, principal.accessToken)).status, 422);

    const copy = await api('POST', '/timetable-versions', principal.accessToken, {
      school_level: 'TH',
      name: 'Học kỳ I sửa',
      effective_from: '2027-01-04',
      copy_from_id: versionId,
    });
    assert.equal(copy.status, 201);
    const copied = await api('GET', `/timetable-versions/${copy.body.id}/lessons`, viewer.accessToken);
    assert.equal(list(copied.body.lessons).length, 3);
    const versions = list((await api('GET', '/timetable-versions?school_level=TH', viewer.accessToken)).body);
    assert.deepEqual(
      versions.map((version) => [version.name, version.status, version.is_current]),
      [
        ['Học kỳ I sửa', 'draft', false],
        ['Học kỳ I', 'published', true],
      ],
    );
    assert.equal((await api('DELETE', `/timetable-versions/${copy.body.id}`, principal.accessToken)).status, 204);
  });

  it('CT-22c1-4: xem bản đang áp dụng theo lớp, giáo viên; lịch dạy của tôi; thời khoá biểu của con chỉ phụ huynh của con', async () => {
    const byClass = await api('GET', `/timetables?class_id=${classes['1A']}`, viewer.accessToken);
    assert.equal(byClass.status, 200, JSON.stringify(byClass.body));
    assert.deepEqual(
      list(byClass.body.lessons).map((row) => row.subject_code),
      ['TH-TV', 'TH-TOAN'],
    );
    assert.equal(((byClass.body.slots as Record<string, unknown[]>).TH ?? []).length, 4);
    const byTeacher = await api('GET', `/timetables?teacher_user_id=${teachers[0]?.userId}`, viewer.accessToken);
    assert.deepEqual(
      list(byTeacher.body.lessons).map((row) => row.class_name),
      ['Lớp 1A', 'Lớp 1B'],
    );
    assert.equal(
      (await api('GET', `/timetables?class_id=${classes['1A']}`, parents[0]?.accessToken ?? '')).status,
      403,
    );
    const mine = await api('GET', '/timetables/mine', teachers[1]?.accessToken ?? '');
    assert.deepEqual(
      list(mine.body.lessons).map((row) => [row.class_name, row.subject_name]),
      [['Lớp 1A', 'Toán']],
    );
    const ownChild = await api('GET', `/children/${childId}/timetable`, parents[0]?.accessToken ?? '');
    assert.equal(ownChild.status, 200, JSON.stringify(ownChild.body));
    assert.equal(list(ownChild.body.lessons).length, 2);
    assert.equal((await api('GET', `/children/${childId}/timetable`, parents[1]?.accessToken ?? '')).status, 403);
  });

  it('YCTD-317: xuất Excel bản thời khoá biểu theo lớp, theo giáo viên; phụ huynh không xuất được', async () => {
    const download = async (query: string, token: string) => {
      const response = await fetch(url(`/timetable-versions/${versionId}/export${query}`), {
        headers: { authorization: `Bearer ${token}` },
      });
      return { status: response.status, body: Buffer.from(await response.arrayBuffer()) };
    };
    const all = await download('', viewer.accessToken);
    assert.equal(all.status, 200);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(all.body as unknown as ArrayBuffer);
    assert.deepEqual(
      book.worksheets.map((sheet) => sheet.name),
      ['Lớp 1A', 'Lớp 1B'],
    );
    const text = (sheet: ExcelJS.Worksheet) =>
      sheet
        .getSheetValues()
        .flat()
        .filter((value): value is string => typeof value === 'string')
        .join('\n');
    assert.match(text(book.worksheets[0] as ExcelJS.Worksheet), /Thứ Hai/);
    assert.match(text(book.worksheets[0] as ExcelJS.Worksheet), /Toán/);

    const byTeacher = await download(`?teacher_user_id=${teachers[0]?.userId}`, viewer.accessToken);
    assert.equal(byTeacher.status, 200);
    const teacherBook = new ExcelJS.Workbook();
    await teacherBook.xlsx.load(byTeacher.body as unknown as ArrayBuffer);
    assert.equal(teacherBook.worksheets.length, 1);
    assert.match(text(teacherBook.worksheets[0] as ExcelJS.Worksheet), /Lớp 1A/);

    assert.equal((await download('', parents[0]?.accessToken ?? '')).status, 403);
  });

  it('CT-22c1-5: nhập Excel vào bản nháp: dòng lỗi báo theo dòng, không ghi; tệp đúng thay tiết của lớp có trong tệp', async () => {
    const draft = await api('POST', '/timetable-versions', principal.accessToken, {
      school_level: 'TH',
      name: 'Bản nhập Excel',
      effective_from: '2027-01-04',
      copy_from_id: versionId,
    });
    const id = draft.body.id as string;
    const wrong = await upload(
      `/timetable-versions/${id}/import`,
      principal.accessToken,
      await workbook([
        ['1A', '2', '1', 'TH-TV', ''],
        ['9Z', '2', '2', 'TH-TV', ''],
        ['1A', '9', '2', 'TH-XX', 'P999'],
        ['1A', '2', '1', 'TH-TOAN', ''],
      ]),
    );
    assert.equal(wrong.status, 200, JSON.stringify(wrong.body));
    assert.deepEqual(
      (wrong.body.errors as Array<{ row: number; column: string }>).map((error) => [error.row, error.column]),
      [
        [3, 'Mã lớp'],
        [4, 'Thứ'],
        [4, 'Mã môn'],
        [4, 'Mã phòng'],
        [5, 'Tiết'],
      ],
    );
    assert.equal(
      list(
        (await api('GET', `/timetable-versions/${id}/lessons?class_id=${classes['1A']}`, viewer.accessToken)).body
          .lessons,
      ).length,
      2,
    );
    const right = await upload(
      `/timetable-versions/${id}/import`,
      principal.accessToken,
      await workbook([
        ['1A', '3', '1', 'TH-TV', 'P101'],
        ['1A', '3', '2', 'TH-TV', ''],
        ['1A', 'CN', '1', 'TH-TOAN', ''],
      ]),
    );
    assert.deepEqual([right.body.imported, right.body.classes, right.body.errors], [3, 1, []]);
    const lessons = list((await api('GET', `/timetable-versions/${id}/lessons`, viewer.accessToken)).body.lessons);
    assert.deepEqual(
      lessons.map((row) => [row.class_name, row.weekday, row.period_no, row.room_name]),
      [
        ['Lớp 1B', 1, 3, null],
        ['Lớp 1A', 2, 1, 'Phòng 101'],
        ['Lớp 1A', 2, 2, null],
        ['Lớp 1A', 7, 1, null],
      ],
    );
    const versions = list((await api('GET', '/timetable-versions?school_level=TH', viewer.accessToken)).body);
    assert.equal(versions.find((version) => version.id === id)?.source, 'import');
    // Chủ nhật không phải ngày học: xung đột cứng
    const conflicts = list((await api('GET', `/timetable-versions/${id}/conflicts`, viewer.accessToken)).body);
    assert.ok(conflicts.some((conflict) => conflict.code === 'day_outside_week'));
  });
});
