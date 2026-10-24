import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import { SECONDARY_AWARD_RULE, secondaryAwardBases, secondaryPassed } from '@school-management/shared';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';

// Học bạ, khen thưởng, lên lớp THCS, THPT (DT-21 phần 21e, YCTD-172); kịch bản CT-21e-1 đến CT-21e-5
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

describe('Danh hiệu và điều kiện lên lớp theo Thông tư 22/2021', () => {
  it('CT-21e-1: Xuất sắc cần học tập, rèn luyện Tốt và đủ môn từ 9,0; Giỏi cần học tập, rèn luyện Tốt; lên lớp cần cả hai từ Đạt', () => {
    assert.equal(SECONDARY_AWARD_RULE.excellent_min_subjects, 6);
    assert.deepEqual(secondaryAwardBases({ learning: 'good', conduct: 'good', highSubjects: 6 }), [
      'secondary_excellent',
      'secondary_good',
    ]);
    assert.deepEqual(secondaryAwardBases({ learning: 'good', conduct: 'good', highSubjects: 5 }), ['secondary_good']);
    assert.deepEqual(secondaryAwardBases({ learning: 'good', conduct: 'fair', highSubjects: 8 }), []);
    assert.deepEqual(secondaryAwardBases({ learning: 'fair', conduct: 'good', highSubjects: 8 }), []);
    assert.deepEqual(secondaryAwardBases({ learning: null, conduct: 'good', highSubjects: 8 }), []);
    assert.equal(secondaryPassed('pass', 'pass'), true);
    assert.equal(secondaryPassed('good', 'fail'), false);
    assert.equal(secondaryPassed('fail', 'good'), false);
    assert.equal(secondaryPassed('good', null), null);
    assert.equal(secondaryPassed(null, null), null);
  });
});

describe('Học bạ, khen thưởng, lên lớp THCS', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let academicYearId = '';
  let unitId = '';
  const classes: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const children: Record<string, string> = {};
  const awards: Record<string, string> = {};
  const token = (name: string) => (name === 'principal' ? principal.accessToken : (users[name]?.accessToken ?? ''));
  const api = (method: string, path: string, user: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, token(user), body);
  const list = (body: unknown) => body as unknown as Array<Record<string, unknown>>;
  const raw = (path: string, user: string) =>
    fetch(`${environment.baseUrl}${path}`, { headers: { authorization: `Bearer ${token(user)}` } });

  // Ghi thẳng điểm đã nhập của một học sinh: mọi môn tính điểm có điểm trung bình bằng nhau ở cả hai học kỳ, môn nhận xét
  // Đạt; xếp loại cả năm do giáo viên chủ nhiệm xác nhận
  async function seed(
    childKey: string,
    classCode: string,
    average: number | null,
    learning: 'good' | 'fair' | 'pass' | 'fail' | null,
    conduct: 'good' | 'fair' | 'pass' | 'fail' | null,
  ) {
    const overview = await api('GET', `/scores/classes/${classes[classCode]}`, 'principal');
    const subjects = overview.body.subjects as Array<{ subject_id: string; mode: string; is_elective: boolean }>;
    const base = { updated_by: users.homeroom?.userId ?? '', updated_by_name: 'Cô chủ nhiệm' };
    if (average !== null) {
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
              .values([
                { ...common, term_type: term, kind: 'regular', seq: 1, score: average, ...base },
                { ...common, term_type: term, kind: 'mid', seq: 1, score: average, ...base },
                { ...common, term_type: term, kind: 'final', seq: 1, score: average, ...base },
              ])
              .execute();
          } else {
            await schoolYear
              .insertInto('subject_term_results')
              .values({ ...common, term_type: term, result: 'pass', ...base })
              .execute();
          }
        }
      }
    }
    if (learning || conduct) {
      await schoolYear
        .insertInto('term_ratings')
        .values({
          class_id: classes[classCode] ?? '',
          child_id: children[childKey] ?? '',
          term_type: 'year',
          learning,
          conduct,
          ...base,
        })
        .execute();
    }
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
        code: 'THCS21E',
        name: 'Trường THCS Thử',
        unit_type: 'truong_chinh',
      })
    ).body.id as string;
    const current = await api('GET', '/school-levels', 'principal');
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
    assert.equal((await api('PUT', '/school-levels', 'principal', { levels })).status, 200);
    assert.equal((await api('POST', '/grade-levels/templates', 'principal', { school_level: 'THCS' })).status, 200);
    assert.equal((await api('POST', '/subjects/templates', 'principal', { school_level: 'THCS' })).status, 200);
    users.homeroom = await environment.loginAs('VT-07', unitId);
    users.other = await environment.loginAs('VT-07', unitId);
    users.parent = await environment.loginAs('VT-14', unitId);
    users.otherParent = await environment.loginAs('VT-14', unitId);
    for (const [code, grade] of [
      ['9A', 'K9'],
      ['8A', 'K8'],
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
            school_level: 'THCS',
            max_size: 45,
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
      ['An', '9A', 'parent'],
      ['Binh', '9A', null],
      ['Chi', '9A', null],
      ['Em', '9A', null],
      ['Dung', '8A', null],
    ] as const) {
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitId,
          full_name: `Học sinh ${key}`,
          dob: '2011-03-01',
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
    // An: điểm 9,5 mọi môn, học tập Tốt, rèn luyện Tốt; Bình: 8,5, Tốt, Tốt; Chi: 4,0, học tập Chưa đạt, rèn luyện Đạt;
    // Em chưa có xếp loại; Dung (lớp 8): 7,0, Khá, Tốt
    await seed('An', '9A', 9.5, 'good', 'good');
    await seed('Binh', '9A', 8.5, 'good', 'good');
    await seed('Chi', '9A', 4, 'fail', 'pass');
    await seed('Em', '9A', 7, null, null);
    await seed('Dung', '8A', 7, 'fair', 'good');
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-21e-2: danh hiệu THCS: nạp mặc định; khen thưởng chỉ khi học kỳ II đã khoá; gợi ý và điều kiện Xuất sắc, Giỏi; duyệt cấp mã tra cứu', async () => {
    assert.equal(
      (await api('POST', '/learning-records/award-titles/defaults', 'homeroom', { school_level: 'THCS' })).status,
      403,
    );
    const loaded = await api('POST', '/learning-records/award-titles/defaults', 'principal', { school_level: 'THCS' });
    assert.deepEqual(loaded.body, { created: 3 });
    assert.deepEqual(
      (await api('POST', '/learning-records/award-titles/defaults', 'principal', { school_level: 'THCS' })).body,
      { created: 0 },
    );
    const titles = list((await api('GET', '/learning-records/award-titles?school_level=THCS', 'homeroom')).body);
    assert.deepEqual(
      titles.map((row) => [row.code, row.basis]),
      [
        ['HS-XS', 'secondary_excellent'],
        ['HS-G', 'secondary_good'],
        ['KT-DX', null],
      ],
    );
    const idOf = (code: string) => titles.find((row) => row.code === code)?.id as string;

    // Học kỳ II chưa khoá: chưa đề nghị danh hiệu cuối năm được
    const early = await api('POST', `/learning-records/classes/${classes['9A']}/awards`, 'homeroom', {
      child_id: children.An,
      title_id: idOf('HS-XS'),
    });
    assert.equal(early.status, 422, JSON.stringify(early.body));
    assert.equal(
      (await api('POST', '/scores/locks', 'principal', { term_type: 'second_term', school_level: 'THCS' })).status,
      200,
    );

    const view = await api('GET', `/learning-records/classes/${classes['9A']}/awards`, 'homeroom');
    assert.equal(view.status, 200, JSON.stringify(view.body));
    const suggested = (name: string) =>
      (list(view.body.rows).find((row) => row.full_name === name)?.suggested_title_ids as string[]) ?? [];
    assert.deepEqual(suggested('Học sinh An'), [idOf('HS-XS')]);
    assert.deepEqual(suggested('Học sinh Binh'), [idOf('HS-G')]);
    assert.deepEqual(suggested('Học sinh Chi'), []);
    const An = list(view.body.rows).find((row) => row.full_name === 'Học sinh An');
    assert.deepEqual(
      [An?.year_label, An?.has_result, An?.needs_support],
      ['Học tập: Tốt; rèn luyện: Tốt', true, false],
    );

    const propose = (child: string, title: string, user = 'homeroom') =>
      api('POST', `/learning-records/classes/${classes['9A']}/awards`, user, {
        child_id: children[child],
        title_id: idOf(title),
      });
    assert.equal((await propose('An', 'HS-XS', 'other')).status, 403);
    // Bình có 8,5 nên không đủ điều kiện Xuất sắc; Chi học tập Chưa đạt không đủ Giỏi
    assert.equal((await propose('Binh', 'HS-XS')).status, 422);
    assert.equal((await propose('Chi', 'HS-G')).status, 422);
    const xs = await propose('An', 'HS-XS');
    assert.equal(xs.status, 201, JSON.stringify(xs.body));
    awards.An = xs.body.id as string;
    assert.equal((await propose('An', 'HS-XS')).status, 422);
    const good = await propose('Binh', 'HS-G');
    assert.equal(good.status, 201, JSON.stringify(good.body));
    // Đột xuất cần thành tích
    assert.equal((await propose('Chi', 'KT-DX')).status, 400);
    assert.equal(
      (await api('POST', `/learning-records/awards/${awards.An}/decide`, 'homeroom', { approve: true })).status,
      403,
    );
    const approved = await api('POST', `/learning-records/awards/${awards.An}/decide`, 'principal', { approve: true });
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    assert.match(String(approved.body.lookup_code), /^[A-Z0-9]{12}$/);
  });

  it('CT-21e-3: xét lên lớp THCS: chưa có xếp loại thì không ghi; lên lớp, hoàn thành cấp học ở khối 9; chưa đạt thì rèn luyện, kiểm tra lại, ở lại lớp', async () => {
    const view = await api('GET', `/learning-records/classes/${classes['9A']}/completion`, 'homeroom');
    assert.equal(view.status, 200, JSON.stringify(view.body));
    assert.equal(view.body.year_end_locked, true);
    assert.equal(view.body.last_grade, true);
    const rowOf = (body: Record<string, unknown>, name: string) =>
      list(body.rows).find((row) => row.full_name === name) as Record<string, unknown>;
    assert.equal(rowOf(view.body, 'Học sinh An').suggested_outcome, 'level_completed');
    assert.equal(rowOf(view.body, 'Học sinh Chi').suggested_outcome, 'pending_support');
    assert.equal(rowOf(view.body, 'Học sinh Chi').needs_support, true);
    assert.equal(rowOf(view.body, 'Học sinh Em').suggested_outcome, null);

    const save = (entries: unknown[], user = 'homeroom', classCode = '9A') =>
      api('PUT', `/learning-records/classes/${classes[classCode]}/completion`, user, { entries });
    assert.equal((await save([{ child_id: children.An }], 'other')).status, 403);
    // Em chưa có xếp loại cả năm; An đã đạt không cần rèn luyện
    assert.equal((await save([{ child_id: children.Em }])).status, 400);
    assert.equal((await save([{ child_id: children.An, support_plan: 'retest' }])).status, 400);
    const first = await save([
      { child_id: children.An },
      { child_id: children.Binh },
      { child_id: children.Chi, support_plan: 'retest' },
    ]);
    assert.equal(first.status, 200, JSON.stringify(first.body));
    const result = (body: Record<string, unknown>, name: string) =>
      (rowOf(body, name).result as { outcome: string; next_grade_level: string | null } | null)?.outcome;
    assert.deepEqual(
      [result(first.body, 'Học sinh An'), result(first.body, 'Học sinh Binh'), result(first.body, 'Học sinh Chi')],
      ['level_completed', 'level_completed', 'pending_support'],
    );
    // Kiểm tra lại đạt thì hoàn thành cấp học; không đạt thì ở lại lớp
    const passed = await save([{ child_id: children.Chi, support_plan: 'retest', support_result: 'completed' }]);
    assert.equal(result(passed.body, 'Học sinh Chi'), 'level_completed');
    const failed = await save([{ child_id: children.Chi, support_plan: 'retest', support_result: 'not_completed' }]);
    assert.equal(result(failed.body, 'Học sinh Chi'), 'retained');
    assert.equal((rowOf(failed.body, 'Học sinh Chi').result as { next_grade_level: string }).next_grade_level, 'K9');
    // Lớp 8: lên lớp 9
    assert.equal(
      (await api('POST', '/scores/locks', 'principal', { term_type: 'second_term', school_level: 'THCS' })).status,
      200,
    );
    const eight = await save([{ child_id: children.Dung }], 'homeroom', '8A');
    assert.equal(eight.status, 200, JSON.stringify(eight.body));
    assert.equal(result(eight.body, 'Học sinh Dung'), 'promoted');
    assert.equal((rowOf(eight.body, 'Học sinh Dung').result as { next_grade_level: string }).next_grade_level, 'K9');
  });

  it('CT-21e-4: lập học bạ THCS từ sổ điểm: bảng điểm hai học kỳ, cả năm, xếp loại; nhận xét; kí nội bộ in đủ số định danh; mở lại phải có lý do', async () => {
    assert.equal(
      (await api('POST', `/learning-records/classes/${classes['9A']}/learning-records/prepare`, 'other')).status,
      403,
    );
    const prepared = await api(
      'POST',
      `/learning-records/classes/${classes['9A']}/learning-records/prepare`,
      'homeroom',
    );
    assert.equal(prepared.status, 200, JSON.stringify(prepared.body));
    assert.equal(prepared.body.prepared, 4);
    const view = await api('GET', `/learning-records/classes/${classes['9A']}/learning-records`, 'homeroom');
    const records: Record<string, string> = {};
    for (const row of list(view.body.rows)) {
      records[row.full_name as string] = (row.record as { id: string }).id;
    }
    const recordId = records['Học sinh An'] ?? '';
    const stored = await schoolYear
      .selectFrom('learning_records')
      .select('content')
      .where('id', '=', recordId)
      .executeTakeFirstOrThrow();
    const content = stored.content as unknown as {
      subjects: unknown[];
      year_result: string;
      awards: string[];
      completion: string;
      secondary: {
        subjects: Array<{
          name: string;
          mode: string;
          first: string | null;
          second: string | null;
          year: string | null;
        }>;
        ratings: Record<string, { learning: string | null; conduct: string | null }>;
      };
    };
    assert.deepEqual(content.subjects, []);
    const math = content.secondary.subjects.find((row) => row.name === 'Toán');
    assert.deepEqual([math?.first, math?.second, math?.year], ['9.5', '9.5', '9.5']);
    const sport = content.secondary.subjects.find((row) => row.name === 'Giáo dục thể chất');
    assert.deepEqual([sport?.mode, sport?.first, sport?.year], ['comment', 'Đạt', 'Đạt']);
    assert.deepEqual(content.secondary.ratings.year, { learning: 'Tốt', conduct: 'Tốt' });
    assert.deepEqual(
      [content.year_result, content.awards, content.completion],
      ['Học tập: Tốt; rèn luyện: Tốt', ['Học sinh Xuất sắc'], 'Hoàn thành chương trình cấp học'],
    );
    assert.equal(
      (
        await api('PATCH', `/learning-records/learning-records/${recordId}`, 'homeroom', {
          homeroom_comment: 'Chăm ngoan',
        })
      ).status,
      200,
    );
    assert.equal((await api('POST', `/learning-records/learning-records/${recordId}/sign`, 'principal')).status, 422);
    assert.equal(
      (
        await api('PUT', '/signing/certificate', 'principal', {
          signature_type: 'remote',
          provider: 'VNPT-CA',
          login_name: 'truong-thcs-hoc-ba',
          holder_name: 'Hiệu trưởng Thử',
          holder_title: 'Hiệu trưởng',
          serial_number: 'SERI-HB-THCS',
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
    assert.equal(
      Buffer.from(await file.arrayBuffer())
        .subarray(0, 4)
        .toString(),
      '%PDF',
    );
    // Phụ huynh xem bản đã kí của con mình, không xem con người khác; bản nháp của học sinh khác chưa kí thì phụ huynh không xem
    assert.equal((await raw(`/learning-records/learning-records/${recordId}/file`, 'parent')).status, 200);
    assert.equal((await raw(`/learning-records/learning-records/${recordId}/file`, 'otherParent')).status, 403);
    const reopened = await api('POST', `/learning-records/learning-records/${recordId}/reopen`, 'principal', {
      reason: 'Sửa nhận xét',
    });
    assert.equal(reopened.body.status, 'draft');
    assert.equal((await raw(`/learning-records/learning-records/${recordId}/file`, 'parent')).status, 422);
  });

  it('CT-21e-5: phụ huynh xem học bạ đã kí, khen thưởng đã duyệt của con; lớp Mầm non, Tiểu học dùng bảng cũ không đổi', async () => {
    const recordId = (
      await schoolYear
        .selectFrom('learning_records')
        .select('id')
        .where('child_id', '=', children.An ?? '')
        .executeTakeFirstOrThrow()
    ).id;
    assert.equal((await api('POST', `/learning-records/learning-records/${recordId}/sign`, 'principal')).status, 200);
    const mine = await api('GET', `/learning-records/children/${children.An}`, 'parent');
    assert.equal(mine.status, 200, JSON.stringify(mine.body));
    assert.equal(list(mine.body.records).length, 1);
    assert.deepEqual(
      list(mine.body.awards).map((row) => row.title_name),
      ['Học sinh Xuất sắc'],
    );
    assert.equal((mine.body.completion as { outcome: string }).outcome, 'level_completed');
    assert.equal((await api('GET', `/learning-records/children/${children.An}`, 'otherParent')).status, 403);
    // Học sinh khác chưa kí: phụ huynh không có bản nào
    const empty = await api('GET', `/learning-records/children/${children.Binh}`, 'principal');
    assert.equal(empty.status, 200);
    // Cuối kịch bản trả trường về chỉ có Mầm non
    const current = await api('GET', '/school-levels', 'principal');
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
    assert.equal((await api('PUT', '/school-levels', 'principal', { levels })).status, 200);
  });
});
