import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import {
  isValidScore,
  requiredRegularCount,
  roundScore,
  SCORE_DEFAULTS,
  suggestLearningRating,
  termAverage,
  validateScoreConfig,
  yearAverage,
  type RatingSubject,
  type ScoreConfig,
} from '@school-management/shared';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';

// Sổ điểm THCS, THPT theo Thông tư 22/2021 (DT-21 phần 21c, YCTD-170); kịch bản CT-21c-1 đến CT-21c-6
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const config = SCORE_DEFAULTS.THCS as ScoreConfig;

describe('Tính điểm trung bình môn và gợi ý xếp loại học tập', () => {
  it('CT-21c-1: trung bình học kỳ có hệ số 1, 2, 3; cả năm hệ số 1, 2; làm tròn; số lần đánh giá thường xuyên; xếp loại', () => {
    assert.equal(termAverage({ regular: [8, 9], mid: 7, final: 8 }, config), 7.9);
    assert.equal(termAverage({ regular: [10], mid: 10, final: 10 }, config), 10);
    assert.equal(termAverage({ regular: [6.5, 6.5], mid: 6.5, final: 6.5 }, config), 6.5);
    // Làm tròn nửa lên: (7 + 2 × 6 + 3 × 6.5) / 6 = 6.4166 → 6.4; (5 + 2 × 6 + 3 × 7.5) / 6 = 6.6
    assert.equal(termAverage({ regular: [7], mid: 6, final: 6.5 }, config), 6.4);
    assert.equal(termAverage({ regular: [5], mid: 6, final: 7.5 }, config), 6.6);
    // Thiếu giữa kỳ, cuối kỳ hoặc thường xuyên thì chưa tính được
    assert.equal(termAverage({ regular: [8], mid: null, final: 8 }, config), null);
    assert.equal(termAverage({ regular: [8], mid: 8, final: null }, config), null);
    assert.equal(termAverage({ regular: [], mid: 8, final: 8 }, config), null);
    assert.equal(yearAverage(8, 9, config), 8.7);
    assert.equal(yearAverage(6.5, 7, config), 6.8);
    assert.equal(yearAverage(null, 9, config), null);
    assert.equal(roundScore(6.25), 6.3);
    assert.deepEqual(
      [0, 10, 7.5, 7.55, -1, 10.1, '8', Number.NaN].map((value) => isValidScore(value)),
      [true, true, true, false, false, false, false, false],
    );
    // Số tiết cả năm của môn: ≤ 35 tiết 2 lần, ≤ 70 tiết 3 lần, trên 70 tiết 4 lần (35 tuần)
    assert.deepEqual(
      [1, 1.5, 2, 3, 4].map((periodsPerWeek) => requiredRegularCount(periodsPerWeek, config)),
      [2, 3, 3, 4, 4],
    );

    const subject = (code: string, average: number | null): RatingSubject => ({
      code,
      mode: 'score',
      average,
      passed: null,
    });
    const eight = ['THCS-NV', 'THCS-TOAN', 'THCS-NN1', 'THCS-GDCD', 'THCS-KHTN', 'THCS-CN', 'THCS-LSDL', 'THCS-TIN'];
    const all = (average: number) => eight.map((code) => subject(code, average));
    assert.equal(suggestLearningRating(all(8), config), 'good');
    assert.equal(suggestLearningRating(all(7), config), 'fair');
    assert.equal(suggestLearningRating(all(5), config), 'pass');
    assert.equal(suggestLearningRating(all(4), config), 'fail');
    // Một môn dưới ngưỡng thấp nhất hạ mức: 8 điểm các môn nhưng một môn 6.0 (< 6.5) thì không Tốt
    assert.equal(
      suggestLearningRating([...all(8).filter((item) => item.code !== 'THCS-CN'), subject('THCS-CN', 6)], config),
      'fair',
    );
    // Môn chủ chốt (Toán, Ngữ văn) cùng dưới ngưỡng thì không đạt mức đó
    assert.equal(
      suggestLearningRating(
        [subject('THCS-NV', 7), subject('THCS-TOAN', 7), ...eight.slice(2).map((code) => subject(code, 9))],
        config,
      ),
      'fair',
    );
    // Thiếu điểm trung bình thì chưa gợi ý; môn nhận xét Chưa đạt thì Chưa đạt; môn nhận xét chưa nhập thì chưa gợi ý
    assert.equal(suggestLearningRating([...all(9).slice(1), subject('THCS-NV', null)], config), null);
    const comment = (passed: 'pass' | 'fail' | null): RatingSubject => ({
      code: 'THCS-GDTC',
      mode: 'comment',
      average: null,
      passed,
    });
    assert.equal(suggestLearningRating([...all(9), comment('pass')], config), 'good');
    assert.equal(suggestLearningRating([...all(9), comment('fail')], config), 'fail');
    assert.equal(suggestLearningRating([...all(9), comment(null)], config), null);
    assert.equal(suggestLearningRating([], config), null);

    assert.deepEqual(validateScoreConfig(config), []);
    assert.ok(validateScoreConfig({ ...config, weights: { regular: 0, mid: 2, final: 3 } }).length > 0);
    assert.ok(validateScoreConfig({ ...config, learning_rules: config.learning_rules.slice(0, 2) }).length > 0);
    assert.ok(validateScoreConfig({ ...config, regular_counts: [{ max_periods: 35, count: 2 }] }).length > 0);
    assert.ok(validateScoreConfig(null).length > 0);
  });
});

describe('Điểm cuối sổ điểm THCS', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let unitId = '';
  let classId = '';
  let preschoolClassId = '';
  const users: Record<string, LoggedInUser> = {};
  const children: Record<string, string> = {};
  const subjects: Record<string, string> = {};
  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);
  const list = (body: unknown) => body as unknown as Array<Record<string, unknown>>;
  const sheetPath = (code: string, term = 'first_term') =>
    `/scores/classes/${classId}/subjects/${subjects[code]}${term ? `?term_type=${term}` : ''}`;
  const scoreSubjects = [
    'THCS-NV',
    'THCS-TOAN',
    'THCS-NN1',
    'THCS-GDCD',
    'THCS-LSDL',
    'THCS-KHTN',
    'THCS-CN',
    'THCS-TIN',
  ];
  const commentSubjects = ['THCS-GDTC', 'THCS-AN', 'THCS-MT', 'THCS-HDTN', 'THCS-GDDP'];

  const save = (code: string, term: string, accessToken: string, entries: unknown[]) =>
    api('PUT', `/scores/classes/${classId}/subjects/${subjects[code]}`, accessToken, { term_type: term, entries });
  const fill = async (childKey: string, average: number, term = 'first_term') => {
    for (const code of scoreSubjects) {
      const response = await save(code, term, token('principal'), [
        { child_id: children[childKey], regular: [average, average], mid: average, final: average },
      ]);
      assert.equal(response.status, 200, JSON.stringify(response.body));
    }
    for (const code of commentSubjects) {
      const response = await save(code, term, token('principal'), [{ child_id: children[childKey], result: 'pass' }]);
      assert.equal(response.status, 200, JSON.stringify(response.body));
    }
  };

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    users.principal = principal;
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
        code: 'THCS21C',
        name: 'Trường THCS',
        unit_type: 'truong_chinh',
      })
    ).body.id as string;
    const current = await api('GET', '/school-levels', principal.accessToken);
    const levels = (current.body.levels as Array<Record<string, unknown>>).map(
      ({ code, order_no, display_name, learner_term, context_label }) => ({
        code,
        is_enabled: code === 'MN' || code === 'THCS',
        order_no,
        display_name,
        learner_term,
        context_label,
      }),
    );
    assert.equal((await api('PUT', '/school-levels', principal.accessToken, { levels })).status, 200);
    assert.equal(
      (await api('POST', '/grade-levels/templates', principal.accessToken, { school_level: 'THCS' })).status,
      200,
    );
    await api('POST', '/grade-levels', principal.accessToken, {
      code: 'MAM',
      name: 'Mầm',
      age_from_months: 36,
      age_to_months: 71,
    });
    const loaded = await api('POST', '/subjects/templates', principal.accessToken, { school_level: 'THCS' });
    assert.equal(loaded.status, 200, JSON.stringify(loaded.body));
    for (const row of list((await api('GET', '/subjects?school_level=THCS', principal.accessToken)).body)) {
      subjects[row.code as string] = row.id as string;
    }
    users.homeroom = await environment.loginAs('VT-07', unitId);
    users.math = await environment.loginAs('VT-07', unitId);
    users.other = await environment.loginAs('VT-07', unitId);
    users.manager = await environment.loginAs('VT-03', unitId);
    users.parent = await environment.loginAs('VT-14', unitId);
    users.otherParent = await environment.loginAs('VT-14', unitId);
    for (const [code, grade, level] of [
      ['6A', 'K6', 'THCS'],
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
            max_size: 45,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
      if (code === '6A') {
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
          staff_name: 'Chủ nhiệm 6A',
          assignment_role: 'homeroom',
          from_date: addDays(vietnamToday, -60),
        },
        {
          class_id: classId,
          staff_user_id: users.math?.userId ?? '',
          staff_name: 'Giáo viên Toán',
          assignment_role: 'subject',
          subject_name: 'Toán',
          subject_id: subjects['THCS-TOAN'] ?? null,
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
          dob: '2014-03-01',
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

  it('CT-21c-2: cấu hình sổ điểm: mặc định theo cấp; giáo viên không sửa; cấu hình sai bị từ chối; lưu rồi đọc lại', async () => {
    const defaults = await api('GET', '/scores/config?school_level=THCS', token('homeroom'));
    assert.equal(defaults.status, 200, JSON.stringify(defaults.body));
    assert.deepEqual((defaults.body.config as ScoreConfig).weights, { regular: 1, mid: 2, final: 3 });
    assert.equal((await api('GET', '/scores/config?school_level=TH', token('homeroom'))).status, 400);
    const changed = { ...config, weeks_per_year: 37 };
    assert.equal(
      (await api('PUT', '/scores/config', token('homeroom'), { school_level: 'THCS', config: changed })).status,
      403,
    );
    assert.equal(
      (
        await api('PUT', '/scores/config', principal.accessToken, {
          school_level: 'THCS',
          config: { ...config, weights: { regular: 0, mid: 2, final: 3 } },
        })
      ).status,
      400,
    );
    const saved = await api('PUT', '/scores/config', principal.accessToken, { school_level: 'THCS', config: changed });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal((saved.body.config as ScoreConfig).weeks_per_year, 37);
    // Trả về cấu hình mặc định để các ca sau tính theo 35 tuần
    assert.equal(
      (await api('PUT', '/scores/config', principal.accessToken, { school_level: 'THCS', config })).status,
      200,
    );
  });

  it('CT-21c-3: nhập điểm theo phân công: lớp Mầm non bị từ chối; giáo viên môn khác bị chặn; điểm sai 400; tính trung bình; xóa điểm', async () => {
    const overview = await api('GET', `/scores/classes/${classId}`, token('math'));
    assert.equal(overview.status, 200, JSON.stringify(overview.body));
    assert.deepEqual((overview.body.access as { subject_ids: string[] }).subject_ids, [subjects['THCS-TOAN']]);
    const math = (overview.body.subjects as Array<Record<string, unknown>>).find(
      (row) => row.subject_code === 'THCS-TOAN',
    );
    assert.deepEqual([math?.mode, math?.required_regular], ['score', 4]);
    assert.equal((await api('GET', `/scores/classes/${preschoolClassId}`, principal.accessToken)).status, 422);
    assert.equal((await api('GET', `/scores/classes/${classId}`, token('parent'))).status, 403);

    const entry = { child_id: children.An, regular: [8, 9], mid: 7, final: 8 };
    assert.equal((await save('THCS-TOAN', 'first_term', token('other'), [entry])).status, 403);
    assert.equal((await save('THCS-NV', 'first_term', token('math'), [entry])).status, 403);
    for (const bad of [{ regular: [11] }, { mid: 7.55 }, { final: -1 }, { regular: ['x'] }]) {
      assert.equal((await save('THCS-TOAN', 'first_term', token('math'), [{ ...entry, ...bad }])).status, 400);
    }
    assert.equal(
      (await save('THCS-TOAN', 'first_term', token('math'), [{ ...entry, child_id: randomUUID() }])).status,
      400,
    );
    // Môn nhận xét không nhập điểm; môn tính điểm không có Đạt, Chưa đạt
    assert.equal((await save('THCS-GDTC', 'first_term', principal.accessToken, [entry])).status, 400);
    assert.equal((await save('THCS-TOAN', 'first_term', token('math'), [{ ...entry, result: 'pass' }])).status, 400);
    const saved = await save('THCS-TOAN', 'first_term', token('math'), [entry]);
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const rowOf = (body: Record<string, unknown>, key: string) =>
      list(body.rows).find((row) => row.child_id === children[key]) as Record<string, unknown>;
    assert.deepEqual(
      [
        rowOf(saved.body, 'An').regular,
        rowOf(saved.body, 'An').mid,
        rowOf(saved.body, 'An').final,
        rowOf(saved.body, 'An').average,
      ],
      [[8, 9], 7, 8, 7.9],
    );
    assert.equal(rowOf(saved.body, 'Binh').average, null);
    // Sửa điểm: bỏ điểm thường xuyên thứ hai, đổi giữa kỳ; xóa điểm cuối kỳ thì chưa có trung bình
    const edited = await save('THCS-TOAN', 'first_term', token('math'), [
      { child_id: children.An, regular: [8], mid: 9, final: null, comment: 'Tiến bộ' },
    ]);
    assert.deepEqual(
      [
        rowOf(edited.body, 'An').regular,
        rowOf(edited.body, 'An').mid,
        rowOf(edited.body, 'An').final,
        rowOf(edited.body, 'An').average,
        rowOf(edited.body, 'An').comment,
      ],
      [[8], 9, null, null, 'Tiến bộ'],
    );
    // Môn nhận xét: kết quả Đạt; người quản lý nhập thay
    const comment = await save('THCS-GDTC', 'first_term', principal.accessToken, [
      { child_id: children.An, result: 'pass' },
    ]);
    assert.equal(comment.status, 200, JSON.stringify(comment.body));
    assert.equal(rowOf(comment.body, 'An').result, 'pass');
    // Giáo viên môn xem được bảng nhưng không nhập môn khác
    const view = await api('GET', sheetPath('THCS-NV'), token('math'));
    assert.equal(view.status, 200, JSON.stringify(view.body));
    assert.equal(view.body.can_edit, false);
    assert.equal((await api('GET', sheetPath('THCS-TOAN', ''), token('math'))).status, 400);
    assert.equal((await api('GET', sheetPath('THCS-TOAN', 'third_term'), token('math'))).status, 400);
  });

  it('YCTD-318: tải tệp mẫu kèm học sinh; nhập từ Excel ghi điểm, có dòng lỗi thì không ghi; in sổ ra PDF; môn khác bị chặn', async () => {
    const filePath = (code: string, kind: 'template' | 'print') =>
      `${environment.baseUrl}/scores/classes/${classId}/subjects/${subjects[code]}/${kind}?term_type=second_term`;
    const download = async (code: string, kind: 'template' | 'print') => {
      const response = await fetch(filePath(code, kind), { headers: { authorization: `Bearer ${token('math')}` } });
      return {
        status: response.status,
        type: response.headers.get('content-type') ?? '',
        body: Buffer.from(await response.arrayBuffer()),
      };
    };
    const template = await download('THCS-TOAN', 'template');
    assert.equal(template.status, 200);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(template.body as unknown as ArrayBuffer);
    const sheet = book.worksheets[0] as ExcelJS.Worksheet;
    assert.deepEqual((sheet.getRow(1).values as unknown[]).slice(1, 5), ['Mã hệ thống', 'STT', 'Họ và tên', 'TX1']);
    const anRow = sheet.getRows(2, sheet.rowCount - 1)?.find((row) => row.getCell(1).text === children.An);
    assert.ok(anRow, 'tệp mẫu có dòng của học sinh An');
    const upload = async (file: Buffer, code = 'THCS-TOAN') => {
      const form = new FormData();
      form.set('term_type', 'second_term');
      form.set('file', new Blob([file]), 'so-diem.xlsx');
      const response = await fetch(
        `${environment.baseUrl}/scores/classes/${classId}/subjects/${subjects[code]}/import`,
        {
          method: 'POST',
          headers: { authorization: `Bearer ${token('math')}` },
          body: form,
        },
      );
      return { status: response.status, body: (await response.json()) as Record<string, unknown> };
    };
    const headers = (sheet.getRow(1).values as unknown[]).map((value) => String(value ?? ''));
    const column = (header: string) => headers.indexOf(header);
    // Dòng lỗi: điểm ngoài 0–10; không ghi dòng nào
    anRow.getCell(column('TX1')).value = '11';
    const rejected = await upload(Buffer.from(await book.xlsx.writeBuffer()));
    assert.equal(rejected.status, 200, JSON.stringify(rejected.body));
    assert.equal(rejected.body.saved, 0);
    assert.deepEqual(
      (rejected.body.errors as Array<Record<string, unknown>>).map((error) => error.column),
      ['TX1'],
    );
    anRow.getCell(column('TX1')).value = '7,5';
    anRow.getCell(column('Giữa kỳ')).value = 8;
    const imported = await upload(Buffer.from(await book.xlsx.writeBuffer()));
    assert.equal(imported.status, 200, JSON.stringify(imported.body));
    assert.deepEqual(imported.body.errors, []);
    const reread = await api('GET', sheetPath('THCS-TOAN', 'second_term'), token('math'));
    const an = (reread.body.rows as Array<Record<string, unknown>>).find((row) => row.child_id === children.An);
    assert.deepEqual([an?.regular, an?.mid], [[7.5], 8]);
    // Giáo viên không được phân công môn khác thì nhập bị chặn
    const otherTemplate = await download('THCS-NV', 'template');
    assert.equal(otherTemplate.status, 200);
    assert.equal((await upload(otherTemplate.body, 'THCS-NV')).status, 403);

    const printed = await download('THCS-TOAN', 'print');
    assert.equal(printed.status, 200);
    assert.match(printed.type, /application\/pdf/);
    assert.equal(printed.body.subarray(0, 4).toString(), '%PDF');
  });

  it('CT-21c-4: tổng hợp học kỳ, cả năm: gợi ý xếp loại; chủ nhiệm xác nhận; giáo viên môn không xác nhận', async () => {
    await fill('An', 8.5);
    await fill('Binh', 6);
    await fill('An', 9, 'second_term');
    const summary = await api('GET', `/scores/classes/${classId}/summary?term_type=first_term`, token('homeroom'));
    assert.equal(summary.status, 200, JSON.stringify(summary.body));
    assert.equal(summary.body.can_rate, true);
    const row = (body: Record<string, unknown>, key: string) =>
      list(body.rows).find((item) => item.child_id === children[key]) as Record<string, unknown>;
    assert.equal(row(summary.body, 'An').suggested, 'good');
    assert.equal(row(summary.body, 'Binh').suggested, 'pass');
    const toan = (row(summary.body, 'An').subjects as Array<Record<string, unknown>>).find(
      (item) => item.subject_id === subjects['THCS-TOAN'],
    );
    assert.equal(toan?.average, 8.5);
    // Cả năm: học kỳ II mới có điểm của An (9), Binh chưa có học kỳ II
    const year = await api('GET', `/scores/classes/${classId}/summary?term_type=year`, token('homeroom'));
    const yearToan = (row(year.body, 'An').subjects as Array<Record<string, unknown>>).find(
      (item) => item.subject_id === subjects['THCS-TOAN'],
    );
    assert.equal(yearToan?.average, 8.8);
    assert.equal(row(year.body, 'An').suggested, 'good');
    assert.equal(row(year.body, 'Binh').suggested, null);

    const ratings = (term = 'first_term') => ({
      term_type: term,
      entries: [{ child_id: children.An, learning: 'good', conduct: 'good', comment: 'Ngoan, học tốt' }],
    });
    assert.equal((await api('PUT', `/scores/classes/${classId}/ratings`, token('math'), ratings())).status, 403);
    assert.equal(
      (
        await api('PUT', `/scores/classes/${classId}/ratings`, token('homeroom'), {
          term_type: 'first_term',
          entries: [{ child_id: children.An, learning: 'xuat-sac' }],
        })
      ).status,
      400,
    );
    const confirmed = await api('PUT', `/scores/classes/${classId}/ratings`, token('homeroom'), ratings());
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
    assert.deepEqual(
      [row(confirmed.body, 'An').learning, row(confirmed.body, 'An').conduct, row(confirmed.body, 'An').comment],
      ['good', 'good', 'Ngoan, học tốt'],
    );
    const saved = await schoolYear
      .selectFrom('term_ratings')
      .select(['learning_suggested', 'learning'])
      .where('child_id', '=', children.An ?? '')
      .where('term_type', '=', 'first_term')
      .executeTakeFirstOrThrow();
    assert.deepEqual([saved.learning_suggested, saved.learning], ['good', 'good']);
    const yearRating = await api('PUT', `/scores/classes/${classId}/ratings`, token('homeroom'), ratings('year'));
    assert.equal(yearRating.status, 200, JSON.stringify(yearRating.body));
  });

  it('CT-21c-5: khoá điểm theo học kỳ và lớp: giáo viên không khoá; khoá thì không sửa; quản lý mở khoá kèm lý do; quá hạn', async () => {
    assert.equal(
      (await api('POST', '/scores/locks', token('homeroom'), { term_type: 'first_term', school_level: 'THCS' })).status,
      403,
    );
    assert.equal((await api('POST', '/scores/locks', principal.accessToken, { term_type: 'first_term' })).status, 400);
    const locked = await api('POST', '/scores/locks', principal.accessToken, {
      term_type: 'first_term',
      school_level: 'THCS',
    });
    assert.equal(locked.status, 200, JSON.stringify(locked.body));
    assert.equal(locked.body.locked_class_count, 1);
    const entry = { child_id: children.An, regular: [8], mid: 9, final: 9 };
    const blocked = await save('THCS-TOAN', 'first_term', token('math'), [entry]);
    assert.equal(blocked.status, 422);
    assert.equal(
      (await save('THCS-TOAN', 'first_term', principal.accessToken, [entry])).status,
      422,
      'khoá thì người quản lý cũng phải mở khoá trước',
    );
    // Học kỳ II chưa khoá nên vẫn nhập được; xếp loại học kỳ I bị chặn
    assert.equal((await save('THCS-TOAN', 'second_term', token('math'), [entry])).status, 200);
    assert.equal(
      (
        await api('PUT', `/scores/classes/${classId}/ratings`, token('homeroom'), {
          term_type: 'first_term',
          entries: [{ child_id: children.An, learning: 'good' }],
        })
      ).status,
      422,
    );
    const state = await api('GET', '/scores/locks?term_type=first_term&school_level=THCS', principal.accessToken);
    assert.deepEqual(
      list(state.body.classes).map((row) => [row.class_name, row.locked_by_name !== null]),
      [['6A', true]],
    );
    assert.equal(
      (
        await api('POST', '/scores/locks/unlock', token('homeroom'), {
          term_type: 'first_term',
          class_id: classId,
          reason: 'Nhập nhầm',
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await api('POST', '/scores/locks/unlock', principal.accessToken, {
          term_type: 'first_term',
          class_id: classId,
          reason: 'x',
        })
      ).status,
      400,
    );
    const unlocked = await api('POST', '/scores/locks/unlock', principal.accessToken, {
      term_type: 'first_term',
      class_id: classId,
      reason: 'Nhập nhầm điểm Toán',
    });
    assert.equal(unlocked.status, 200, JSON.stringify(unlocked.body));
    assert.equal(
      (
        await api('POST', '/scores/locks/unlock', principal.accessToken, {
          term_type: 'first_term',
          class_id: classId,
          reason: 'Nhập nhầm điểm Toán',
        })
      ).status,
      422,
    );
    assert.equal((await save('THCS-TOAN', 'first_term', token('math'), [entry])).status, 200);
    const audit = await schoolYear
      .selectFrom('audit_logs')
      .select('action')
      .where('entity_name', '=', 'score_locks')
      .execute();
    assert.deepEqual(audit.map((row) => row.action).sort(), ['create', 'delete']);
    // Quá hạn: học kỳ I đã kết thúc thì giáo viên không nhập được, người quản lý vẫn nhập được
    await environment.system
      .updateTable('academic_terms')
      .set({ end_date: addDays(vietnamToday, -1) })
      .where('term_type', '=', 'first_term')
      .execute();
    assert.equal((await save('THCS-TOAN', 'first_term', token('math'), [entry])).status, 422);
    assert.equal((await save('THCS-TOAN', 'first_term', principal.accessToken, [entry])).status, 200);
  });

  it('CT-21c-6: phụ huynh chỉ xem điểm đã khoá của con mình', async () => {
    const before = await api('GET', `/scores/children/${children.An}`, token('parent'));
    assert.equal(before.status, 200, JSON.stringify(before.body));
    assert.deepEqual(before.body.terms, []);
    assert.equal((await api('GET', `/scores/children/${children.An}`, token('otherParent'))).status, 403);
    assert.equal(
      (await api('POST', '/scores/locks', principal.accessToken, { term_type: 'first_term', school_level: 'THCS' }))
        .status,
      200,
    );
    const view = await api('GET', `/scores/children/${children.An}`, token('parent'));
    assert.equal(view.status, 200, JSON.stringify(view.body));
    const terms = list(view.body.terms);
    assert.deepEqual(
      terms.map((term) => term.term_type),
      ['first_term'],
    );
    const toan = (terms[0]?.subjects as Array<Record<string, unknown>>).find((row) => row.subject_name === 'Toán');
    assert.deepEqual([toan?.regular, toan?.mid, toan?.final, toan?.average], [[8], 9, 9, 8.8]);
    assert.equal((terms[0]?.rating as { learning: string } | null)?.learning, 'good');
    assert.equal(view.body.year_rating, null);
    // Cuối kịch bản trả trường về chỉ có Mầm non
    const current = await api('GET', '/school-levels', principal.accessToken);
    const levels = (current.body.levels as Array<Record<string, unknown>>).map(
      ({ code, order_no, display_name, learner_term, context_label }) => ({
        code,
        is_enabled: code === 'MN',
        order_no,
        display_name,
        learner_term,
        context_label,
      }),
    );
    assert.equal((await api('PUT', '/school-levels', principal.accessToken, { levels })).status, 200);
  });
});
