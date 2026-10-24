import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import type { MyWorkItem } from '@school-management/shared';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import {
  certificateVerificationText,
  competencyGaps,
  creditedPeriods,
  parseTrainingCourse,
  parseTrainingResults,
} from './training.js';

// Hồ sơ bồi dưỡng giáo viên (DT-22 phần 22e, YCTD-182): danh mục, khoá, đăng ký và duyệt hai cấp, kết quả, chứng nhận có mã
// tra cứu công khai, chứng chỉ nhập tay, tổng số tiết so với định mức, năng lực số và khoảng trống gợi ý chuyên đề
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

describe('Kiểm tra dữ liệu bồi dưỡng', () => {
  it('CT-22e-1: dữ liệu khoá, kết quả hợp lệ; số tiết ghi nhận; khoảng trống năng lực theo ngưỡng; nội dung mã QR', () => {
    const course = {
      name: '  Bồi dưỡng chương trình 1 ',
      organizer_kind: 'school',
      start_date: '2026-10-01',
      end_date: '2026-10-03',
      periods: 12,
      issues_certificate: true,
    };
    const parsed = parseTrainingCourse(course);
    assert.equal(parsed.name, 'Bồi dưỡng chương trình 1');
    assert.equal(parsed.mode, 'in_person');
    assert.equal(parsed.sessions, 1);
    assert.equal(parsed.quota, null);
    for (const body of [
      { ...course, end_date: '2026-09-30' },
      { ...course, organizer_kind: 'external' },
      { ...course, periods: undefined },
      { ...course, mode: 'video' },
      { ...course, topic_id: 'abc' },
    ]) {
      assert.throws(() => parseTrainingCourse(body), { code: 'ERR_VALIDATION' }, JSON.stringify(body));
    }
    const id = '00000000-0000-4000-8000-000000000001';
    assert.deepEqual(parseTrainingResults({ results: [{ registration_id: id, result: 'passed' }] })[0], {
      registration_id: id,
      attended_sessions: null,
      result: 'passed',
      credited_periods: null,
      comment: null,
    });
    for (const body of [
      { results: [] },
      { results: [{ registration_id: id }, { registration_id: id }] },
      { results: [{ registration_id: id, result: 'ok' }] },
      { results: [{ registration_id: id, credited_periods: -1 }] },
    ]) {
      assert.throws(() => parseTrainingResults(body), { code: 'ERR_VALIDATION' }, JSON.stringify(body));
    }
    assert.deepEqual(
      [creditedPeriods('passed', null, 12), creditedPeriods('passed', 8, 12), creditedPeriods('failed', 8, 12)],
      [12, 8, 0],
    );
    assert.equal(creditedPeriods(null, null, 12), null);
    const topics = [
      { code: 'T1', competency_domain_code: 'NLS-1' },
      { code: 'T6', competency_domain_code: 'NLS-6' },
      { code: 'BD-1', competency_domain_code: null },
    ];
    const gaps = competencyGaps(
      [
        { domain_code: 'NLS-1', domain_name: 'Một', self_level: 1, confirmed_level: 2 },
        { domain_code: 'NLS-6', domain_name: 'Sáu', self_level: 2, confirmed_level: 1 },
        { domain_code: 'NLS-3', domain_name: 'Ba', self_level: 1, confirmed_level: null },
      ],
      2,
      topics,
    );
    assert.deepEqual(
      gaps.map((gap) => [gap.domain_code, gap.level, gap.topics.map((topic) => topic.code)]),
      [
        ['NLS-6', 1, ['T6']],
        ['NLS-3', 1, []],
      ],
    );
    assert.equal(
      certificateVerificationText('ABCDEFGH2345', 'https://truong.example'),
      'https://truong.example/tra-cuu-chung-nhan?ma=ABCDEFGH2345',
    );
    assert.equal(certificateVerificationText('ABCDEFGH2345', 'javascript:alert(1)'), 'ABCDEFGH2345');
  });
});

describe('Điểm cuối hồ sơ bồi dưỡng', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  const users: Record<string, LoggedInUser> = {};
  const departments: Record<string, string> = {};
  let rootUnit = '';
  let courseId = '';
  const registrations: Record<string, string> = {};
  let certificateId = '';
  let lookupCode = '';

  const token = (name: string) => (name === 'principal' ? principal.accessToken : (users[name]?.accessToken ?? ''));
  const api = (method: string, path: string, name: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, token(name), body);
  const list = (body: unknown) => body as unknown as Array<Record<string, unknown>>;
  const publicVerify = async (code: string) => {
    const response = await fetch(`${environment.baseUrl}/public/training-certificates/verify?code=${code}`);
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  };

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    const firstStart = addDays(vietnamToday, -100);
    const firstEnd = addDays(vietnamToday, 120);
    const year = Number(firstStart.slice(0, 4));
    await openTestAcademicYear(environment, principal.accessToken, `${year}–${year + 1}`, {
      first_term: { start_date: firstStart, end_date: firstEnd },
      second_term: { start_date: addDays(firstEnd, 3), end_date: addDays(firstEnd, 120) },
    });
    const registry = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, registry.database_name),
    );
    rootUnit = (
      await api('POST', '/org-units', 'principal', { code: 'TBD', name: 'Trường thử', unit_type: 'truong_chinh' })
    ).body.id as string;
    for (const name of ['Tổ Toán', 'Tổ Văn']) {
      departments[name] = (
        await schoolYear
          .insertInto('departments')
          .values({ org_unit_id: rootUnit, name })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    users.leader = await environment.loginAs('VT-17', rootUnit);
    users.teacher = await environment.loginAs('VT-07', rootUnit);
    users.teacher2 = await environment.loginAs('VT-07', rootUnit);
    users.teacher3 = await environment.loginAs('VT-07', rootUnit);
    users.parent = await environment.loginAs('VT-14', rootUnit);
    for (const [key, name, department] of [
      ['principal', 'Hiệu Trưởng Giả', null],
      ['leader', 'Tổ Trưởng Toán', 'Tổ Toán'],
      ['teacher', 'Giáo Viên Toán', 'Tổ Toán'],
      ['teacher2', 'Giáo Viên Văn', 'Tổ Văn'],
      ['teacher3', 'Giáo Viên Văn Hai', 'Tổ Văn'],
    ] as const) {
      await schoolYear
        .insertInto('staff')
        .values({
          org_unit_id: rootUnit,
          code: `NS-${randomInt(100_000, 999_999)}`,
          full_name: name,
          start_date: addDays(vietnamToday, -800),
          department_id: department ? (departments[department] ?? null) : null,
          user_id: key === 'principal' ? principal.userId : (users[key]?.userId ?? null),
        })
        .execute();
    }
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-22e-2: danh mục mặc định 120 tiết, 6 miền, 3 mức, chuyên đề theo chương trình; chỉ Ban Giám hiệu sửa', async () => {
    const catalog = await api('GET', '/training/catalog', 'teacher');
    assert.equal(catalog.status, 200, JSON.stringify(catalog.body));
    const settings = catalog.body.settings as Record<string, unknown>;
    assert.equal(settings.annual_required_periods, 120);
    assert.equal((catalog.body.domains as unknown[]).length, 6);
    assert.deepEqual(
      (catalog.body.levels as Array<Record<string, unknown>>).map((level) => level.name),
      ['Cơ bản', 'Thành thạo', 'Nâng cao'],
    );
    const topics = catalog.body.topics as Array<Record<string, unknown>>;
    assert.deepEqual(
      topics.slice(0, 3).map((topic) => [topic.code, topic.program_no]),
      [
        ['BD-1', 1],
        ['BD-2', 2],
        ['BD-3', 3],
      ],
    );
    assert.equal(topics.find((topic) => topic.code === 'BD-NLS-6')?.competency_domain_code, 'NLS-6');
    assert.equal((await api('GET', '/training/catalog', 'parent')).status, 403);
    assert.equal((await api('PUT', '/training/settings', 'teacher', { annual_required_periods: 100 })).status, 403);
    const saved = await api('PUT', '/training/settings', 'principal', { annual_required_periods: 100 });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.annual_required_periods, 100);
    assert.equal(saved.body.competency_gap_level, 2);
    const created = await api('POST', '/training/topics', 'principal', {
      code: 'BD-STEM',
      name: 'Giáo dục STEM',
      program_no: 3,
      default_periods: 15,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(
      (await api('POST', '/training/topics', 'principal', { code: 'BD-STEM', name: 'Trùng', program_no: 3 })).status,
      409,
    );
  });

  it('CT-22e-3: Ban Giám hiệu mở khoá; giáo viên đăng ký; tổ trưởng duyệt tổ mình; Ban Giám hiệu duyệt; hết chỉ tiêu, quá hạn', async () => {
    const body = {
      name: 'Bồi dưỡng chương trình 1 năm học',
      organizer_kind: 'school',
      start_date: addDays(vietnamToday, -10),
      end_date: addDays(vietnamToday, -8),
      periods: 8,
      sessions: 2,
      quota: 2,
      registration_deadline: addDays(vietnamToday, 5),
      issues_certificate: true,
    };
    assert.equal((await api('POST', '/training/courses', 'teacher', body)).status, 403);
    const created = await api('POST', '/training/courses', 'principal', body);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    courseId = created.body.id as string;
    assert.equal(created.body.status, 'open');

    const own = await api('POST', `/training/courses/${courseId}/registrations`, 'teacher', { note: 'Xin dự' });
    assert.equal(own.status, 201, JSON.stringify(own.body));
    registrations.teacher = own.body.id as string;
    assert.equal(own.body.status, 'pending');
    assert.equal((await api('POST', `/training/courses/${courseId}/registrations`, 'teacher')).status, 409);
    const other = await api('POST', `/training/courses/${courseId}/registrations`, 'teacher2');
    registrations.teacher2 = other.body.id as string;
    assert.equal((await api('POST', `/training/courses/${courseId}/registrations`, 'teacher3')).status, 422);
    assert.equal((await api('POST', `/training/courses/${courseId}/registrations`, 'parent')).status, 403);

    const leaderView = await api('GET', `/training/courses/${courseId}`, 'leader');
    assert.deepEqual(
      list(leaderView.body.registrations).map((row) => [row.staff_name, row.can_team_review]),
      [['Giáo Viên Toán', true]],
    );
    const teamApproved = await api('POST', `/training/registrations/${registrations.teacher}/review`, 'leader', {
      decision: 'approve',
    });
    assert.equal(teamApproved.status, 200, JSON.stringify(teamApproved.body));
    assert.equal(teamApproved.body.status, 'team_approved');
    assert.equal(
      (
        await api('POST', `/training/registrations/${registrations.teacher2}/review`, 'leader', {
          decision: 'approve',
        })
      ).status,
      403,
    );
    assert.equal(
      (await api('POST', `/training/registrations/${registrations.teacher}/review`, 'teacher', { decision: 'approve' }))
        .status,
      403,
    );
    const myWork = (await api('GET', '/my-work?source=training', 'principal')).body as unknown as {
      items: MyWorkItem[];
    };
    assert.equal(myWork.items.filter((entry) => entry.kind.startsWith('Đăng ký bồi dưỡng')).length, 2);
    for (const key of ['teacher', 'teacher2']) {
      const approved = await api('POST', `/training/registrations/${registrations[key]}/review`, 'principal', {
        decision: 'approve',
      });
      assert.equal(approved.status, 200, JSON.stringify(approved.body));
      assert.equal(approved.body.status, 'approved');
    }
    assert.equal((await api('POST', `/training/registrations/${registrations.teacher}/cancel`, 'teacher')).status, 422);
    const closed = await api('PATCH', `/training/courses/${courseId}`, 'principal', { status: 'closed' });
    assert.equal(closed.body.status, 'closed');
    assert.equal((await api('POST', `/training/courses/${courseId}/registrations`, 'teacher3')).status, 422);
    const courses = list((await api('GET', '/training/courses', 'teacher')).body);
    const mine = courses.find((row) => row.id === courseId);
    assert.equal(mine?.approved, 2);
    assert.equal((mine?.my_registration as Record<string, unknown>).status, 'approved');
  });

  it('CT-22e-4: kết quả, cấp chứng nhận có mã; tra cứu công khai chỉ trả trường tối thiểu; thu hồi, cấp lại; tải PDF', async () => {
    const invalid = await api('PUT', `/training/courses/${courseId}/results`, 'principal', {
      results: [{ registration_id: registrations.teacher, attended_sessions: 3, result: 'passed' }],
    });
    assert.equal(invalid.status, 400);
    const saved = await api('PUT', `/training/courses/${courseId}/results`, 'principal', {
      results: [
        { registration_id: registrations.teacher, attended_sessions: 2, result: 'passed' },
        { registration_id: registrations.teacher2, attended_sessions: 1, result: 'failed', comment: 'Vắng một buổi' },
      ],
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.deepEqual(
      list(saved.body).map((row) => [row.result, row.credited_periods]),
      [
        ['passed', 8],
        ['failed', 0],
      ],
    );
    assert.equal((await api('POST', `/training/courses/${courseId}/certificates`, 'teacher')).status, 403);
    const issued = await api('POST', `/training/courses/${courseId}/certificates`, 'principal');
    assert.equal(issued.status, 201, JSON.stringify(issued.body));
    assert.equal(issued.body.issued, 1);
    const certificate = list(issued.body.certificates)[0] as Record<string, unknown>;
    certificateId = certificate.id as string;
    lookupCode = certificate.lookup_code as string;
    assert.match(lookupCode, /^[A-Z0-9]{12}$/);
    assert.equal((await api('POST', `/training/courses/${courseId}/certificates`, 'principal')).status, 422);

    const verified = await publicVerify(lookupCode.toLowerCase());
    assert.equal(verified.status, 200, JSON.stringify(verified.body));
    assert.deepEqual(Object.keys(verified.body).sort(), [
      'certificate_name',
      'code',
      'course_name',
      'issued_by',
      'issued_date',
      'periods',
      'staff_name',
      'status',
    ]);
    assert.equal(verified.body.staff_name, 'Giáo Viên Toán');
    assert.equal(verified.body.status, 'valid');
    assert.equal((await publicVerify('ABC')).status, 400);
    assert.equal((await publicVerify('ZZZZZZZZZZZZ')).status, 404);

    const download = async (path: string, name: string) => {
      const response = await fetch(`${environment.baseUrl}${path}`, {
        headers: { authorization: `Bearer ${token(name)}`, origin: 'https://truong.example' },
      });
      return { status: response.status, type: response.headers.get('content-type') ?? '' };
    };
    const pdf = await download(`/training/certificates/${certificateId}/pdf`, 'teacher');
    assert.equal(pdf.status, 200);
    assert.match(pdf.type, /application\/pdf/);
    assert.equal((await download(`/training/certificates/${certificateId}/pdf`, 'teacher2')).status, 404);
    assert.equal((await download(`/training/courses/${courseId}/certificates.pdf`, 'principal')).status, 200);

    assert.equal((await api('POST', `/training/certificates/${certificateId}/revoke`, 'principal', {})).status, 400);
    const revoked = await api('POST', `/training/certificates/${certificateId}/revoke`, 'principal', {
      reason: 'Sai tên',
    });
    assert.equal(revoked.status, 200, JSON.stringify(revoked.body));
    assert.equal((await publicVerify(lookupCode)).body.status, 'revoked');
    const reissued = await api('POST', `/training/certificates/${certificateId}/reissue`, 'principal');
    assert.equal(reissued.status, 201, JSON.stringify(reissued.body));
    assert.notEqual(reissued.body.lookup_code, lookupCode);
    assert.equal((await publicVerify(reissued.body.lookup_code as string)).body.status, 'valid');
    certificateId = reissued.body.id as string;
  });

  it('CT-22e-5: chứng chỉ nhập tay cộng số tiết trong năm; định mức, thiếu tiết; sắp hết hạn; hồ sơ theo tổ, trường', async () => {
    const added = await api('POST', '/training/certificates', 'teacher', {
      name: 'Chứng chỉ tin học ứng dụng',
      issued_by: 'Trung tâm thử',
      issued_date: vietnamToday,
      expire_date: addDays(vietnamToday, 30),
      periods: 12,
    });
    assert.equal(added.status, 201, JSON.stringify(added.body));
    assert.equal(added.body.kind, 'manual');
    assert.equal(
      (
        await api('POST', '/training/certificates', 'teacher', {
          name: 'Sai ngày',
          issued_by: 'X',
          issued_date: vietnamToday,
          expire_date: addDays(vietnamToday, -1),
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await api('POST', '/training/certificates', 'teacher2', {
          name: 'Hộ',
          issued_by: 'X',
          issued_date: vietnamToday,
          staff_id: added.body.staff_id,
        })
      ).status,
      403,
    );
    assert.equal((await api('DELETE', `/training/certificates/${certificateId}`, 'teacher')).status, 422);
    const mine = await api('GET', '/training/mine', 'teacher');
    assert.equal(mine.status, 200, JSON.stringify(mine.body));
    assert.equal(mine.body.required_periods, 100);
    assert.equal(mine.body.total_periods, 20);
    assert.equal(mine.body.missing_periods, 80);
    const certificates = list(mine.body.certificates);
    assert.equal(certificates.find((row) => row.kind === 'manual')?.expiring_soon, true);
    assert.equal(certificates.filter((row) => row.kind === 'school').length, 2);
    const work = (await api('GET', '/my-work?source=training', 'teacher')).body as unknown as { items: MyWorkItem[] };
    assert.deepEqual(
      work.items.map((entry) => entry.kind),
      ['Chứng chỉ sắp hết hạn'],
    );

    assert.equal((await api('GET', '/training/records', 'teacher')).status, 403);
    const leader = await api('GET', '/training/records', 'leader');
    assert.equal(leader.status, 200, JSON.stringify(leader.body));
    assert.deepEqual(
      list(leader.body.rows).map((row) => row.full_name),
      ['Giáo Viên Toán', 'Tổ Trưởng Toán'],
    );
    const school = await api('GET', '/training/records', 'principal');
    const rows = list(school.body.rows);
    assert.equal(rows.length, 5);
    const teacher = rows.find((row) => row.full_name === 'Giáo Viên Toán');
    assert.deepEqual(
      [teacher?.courses, teacher?.course_periods, teacher?.manual_periods, teacher?.missing_periods],
      [1, 8, 12, 80],
    );
    assert.equal(rows.find((row) => row.full_name === 'Giáo Viên Văn')?.total_periods, 0);
    assert.deepEqual(school.body.plan, { courses: 1, completed: 0 });
    const byDepartment = await api('GET', `/training/records?department_id=${departments['Tổ Văn']}`, 'principal');
    assert.equal(list(byDepartment.body.rows).length, 2);
  });

  it('CT-22e-6: tự đánh giá năng lực số đủ miền; khoảng trống gợi ý chuyên đề; tổ trưởng xác nhận đổi mức có lý do; khoá sau xác nhận', async () => {
    const form = await api('GET', '/training/competency/mine?term=term_1', 'teacher');
    assert.equal(form.status, 200, JSON.stringify(form.body));
    const domains = (form.body.domains as Array<Record<string, unknown>>).map((domain) => domain.code as string);
    assert.equal(domains.length, 6);
    const partial = await api('PUT', '/training/competency/mine', 'teacher', {
      term: 'term_1',
      scores: [{ domain_code: 'NLS-1', level: 2 }],
    });
    assert.equal(partial.status, 400);
    const scores = domains.map((code) => ({ domain_code: code, level: code === 'NLS-6' ? 1 : 2 }));
    const submitted = await api('PUT', '/training/competency/mine', 'teacher', { term: 'term_1', scores });
    assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
    const assessmentId = submitted.body.id as string;
    const after = await api('GET', '/training/competency/mine?term=term_1', 'teacher');
    assert.deepEqual(
      (after.body.gaps as Array<Record<string, unknown>>).map((gap) => [
        gap.domain_code,
        (gap.topics as Array<Record<string, unknown>>).map((topic) => topic.code),
      ]),
      [['NLS-6', ['BD-NLS-6']]],
    );
    const mine = await api('GET', '/training/mine', 'teacher');
    assert.deepEqual(
      (mine.body.competency_gaps as Array<Record<string, unknown>>).map((gap) => gap.domain_code),
      ['NLS-6'],
    );

    const leaderTable = await api('GET', '/training/competency?term=term_1', 'leader');
    assert.equal(leaderTable.status, 200, JSON.stringify(leaderTable.body));
    assert.equal(list(leaderTable.body.rows).length, 1);
    assert.equal((await api('GET', '/training/competency?term=term_1', 'teacher')).status, 403);
    const noReason = await api('POST', `/training/competency/${assessmentId}/confirm`, 'leader', {
      scores: [{ domain_code: 'NLS-6', level: 2 }],
    });
    assert.equal(noReason.status, 400);
    const confirmed = await api('POST', `/training/competency/${assessmentId}/confirm`, 'leader', {
      scores: [{ domain_code: 'NLS-6', level: 2, reason: 'Đã dùng trợ lý AI soạn bài có kiểm chứng' }],
    });
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
    assert.equal(confirmed.body.status, 'confirmed');
    assert.equal((await api('PUT', '/training/competency/mine', 'teacher', { term: 'term_1', scores })).status, 422);
    const gaps = await api('GET', '/training/competency/mine?term=term_1', 'teacher');
    assert.deepEqual(gaps.body.gaps, []);
    const school = await api('GET', '/training/competency?term=term_1', 'principal');
    const averages = school.body.averages as Array<Record<string, unknown>>;
    assert.equal(averages.find((row) => row.domain_code === 'NLS-6')?.average, 2);
  });
});
