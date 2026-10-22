import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import {
  createDatabase,
  createEmptyDatabase,
  migrateToLatest,
  replaceDatabaseName,
  type SchoolYearDatabase,
} from '@school-management/database';
import {
  agreePercent,
  consecutiveYearsBefore,
  EMULATION_DEFAULT_TITLES,
  emulationScore,
  type EmulationCheck,
  type MyWorkItem,
} from '@school-management/shared';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { emulationTransitionStep } from './emulation-transition.js';

// Thi đua, khen thưởng (DT-18 phần 22d, YCTD-148); kịch bản CT-22d-1 đến CT-22d-9 (kiểm thử giao diện là CT-22d-10). Dữ liệu
// mẫu là dữ liệu giả
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const errorOf = (body: Record<string, unknown>) =>
  (body.error ?? {}) as { code?: string; rule_code?: string; details?: Array<{ field: string }> };
const checkOf = (body: Record<string, unknown>, code: string) =>
  (body.eligibility as EmulationCheck[]).find((check) => check.code === code);

describe('Thi đua, khen thưởng: cách tính', () => {
  it('CT-22d-1: điểm tiêu chí quy về thang 100 theo trọng số, kẹp trong điểm tối đa; năm liên tục liền trước; tỉ lệ đồng ý trên tổng thành viên', () => {
    const criteria = [
      { code: 'a', title: 'A', weight: 60, max_score: 10 },
      { code: 'b', title: 'B', weight: 40, max_score: 5 },
    ];
    assert.equal(emulationScore(criteria, { a: 10, b: 5 }), 100);
    assert.equal(emulationScore(criteria, { a: 5, b: 2.5 }), 50);
    assert.equal(emulationScore(criteria, { a: 20, b: -1 }), 60);
    assert.equal(emulationScore([], {}), 0);
    assert.equal(consecutiveYearsBefore([2023, 2024, 2025], 2026), 3);
    assert.equal(consecutiveYearsBefore([2022, 2024, 2025, 2026], 2026), 2);
    assert.equal(consecutiveYearsBefore([2024], 2026), 0);
    assert.equal(agreePercent(2, 3), 66.67);
    assert.equal(agreePercent(0, 0), 0);
  });
});

describe('Thi đua, khen thưởng', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let yearStart = 0;
  let principal: LoggedInUser;
  const users: Record<string, LoggedInUser> = {};
  const staff: Record<string, string> = {};
  const departments: Record<string, string> = {};
  const titles: Record<string, string> = {};
  const nominations: Record<string, string> = {};
  let rootUnit = '';
  let campaignId = '';
  let kpiPeriodId = '';
  let meetingId = '';

  const token = (name: string) => (name === 'principal' ? principal.accessToken : (users[name]?.accessToken ?? ''));
  const api = (method: string, path: string, name: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, token(name), body);
  const myWork = async (name: string) =>
    ((await api('GET', '/my-work?source=emulation', name)).body as unknown as { items: MyWorkItem[] }).items;
  const download = async (path: string, name: string) => {
    const response = await fetch(`${environment.baseUrl}${path}`, {
      headers: { authorization: `Bearer ${token(name)}` },
    });
    return {
      status: response.status,
      type: response.headers.get('content-type'),
      body: Buffer.from(await response.arrayBuffer()),
    };
  };

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    const firstStart = addDays(vietnamToday, -100);
    const firstEnd = addDays(vietnamToday, 120);
    yearStart = Number(firstStart.slice(0, 4));
    await openTestAcademicYear(environment, principal.accessToken, `${yearStart}–${yearStart + 1}`, {
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
      await api('POST', '/org-units', 'principal', { code: 'TC', name: 'Trường thử', unit_type: 'truong_chinh' })
    ).body.id as string;
    for (const name of ['Tổ Lá', 'Tổ Chồi']) {
      departments[name] = (
        await schoolYear
          .insertInto('departments')
          .values({ org_unit_id: rootUnit, name })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    users.vice = await environment.loginAs('VT-15', null);
    users.leader = await environment.loginAs('VT-17', rootUnit);
    users.teacher = await environment.loginAs('VT-07', rootUnit);
    users.teacher2 = await environment.loginAs('VT-07', rootUnit);
    users.parent = await environment.loginAs('VT-14', rootUnit);
    for (const [key, name, department] of [
      ['principal', 'Hiệu Trưởng Giả', null],
      ['vice', 'Phó Hiệu Trưởng Giả', null],
      ['leader', 'Tổ Trưởng Lá', 'Tổ Lá'],
      ['teacher', 'Giáo Viên Một', 'Tổ Lá'],
      ['teacher2', 'Giáo Viên Hai', 'Tổ Chồi'],
    ] as const) {
      staff[key] = (
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
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    // Kỳ KPI năm học: Giáo viên Một xếp loại hoàn thành tốt, Giáo viên Hai hoàn thành xuất sắc
    const version = await schoolYear
      .selectFrom('kpi_rule_set_versions')
      .select('id')
      .where('status', '=', 'published')
      .executeTakeFirstOrThrow();
    kpiPeriodId = (
      await schoolYear
        .insertInto('kpi_periods')
        .values({
          code: `KPI-${yearStart}`,
          name: `Năm học ${yearStart}–${yearStart + 1}`,
          period_type: 'year',
          start_date: firstStart,
          end_date: addDays(firstEnd, 120),
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    for (const [key, rank, score] of [
      ['teacher', 'good', 78],
      ['teacher2', 'excellent', 95],
    ] as const) {
      await schoolYear
        .insertInto('kpi_evaluations')
        .values({
          period_id: kpiPeriodId,
          staff_id: staff[key] ?? '',
          org_unit_id: rootUnit,
          rule_set_version_id: version.id,
          subject_group: 'staff',
          status: 'concluded',
          total_score: score,
          final_rank: rank,
        })
        .execute();
    }
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-22d-2: nạp danh mục mặc định không trùng; chỉ người quản lý sửa danh mục; danh hiệu sai điều kiện bị từ chối; phụ huynh không vào được', async () => {
    assert.equal((await api('GET', '/emulation/titles', 'parent')).status, 403);
    assert.equal((await api('POST', '/emulation/titles/defaults', 'teacher')).status, 403);
    const loaded = await api('POST', '/emulation/titles/defaults', 'principal');
    assert.deepEqual(loaded.body, { created: EMULATION_DEFAULT_TITLES.length, skipped: 0 });
    const again = await api('POST', '/emulation/titles/defaults', 'vice');
    assert.deepEqual(again.body, { created: 0, skipped: EMULATION_DEFAULT_TITLES.length });
    const list = (await api('GET', '/emulation/titles', 'teacher')).body as unknown as Array<{
      id: string;
      code: string;
      criteria: unknown[];
    }>;
    for (const title of list) {
      titles[title.code] = title.id;
    }
    assert.ok(list.every((title) => title.criteria.length > 0));
    const invalid = await api('POST', '/emulation/titles', 'principal', {
      code: 'SAI',
      name: 'Danh hiệu sai',
      kind: 'title',
      target: 'individual',
      decision_level: 'school',
      quota_percent: 10,
      prerequisite_code: 'LDTT',
      consecutive_years: 0,
      criteria: [{ code: 'A', title: '', weight: 0, max_score: 10 }],
    });
    assert.equal(invalid.status, 400);
    const fields = (errorOf(invalid.body).details ?? []).map((detail) => detail.field);
    assert.ok(
      ['quota_base_code', 'consecutive_years', 'criteria.0.code', 'criteria.0.title', 'criteria.0.weight'].every(
        (field) => fields.includes(field),
      ),
      JSON.stringify(fields),
    );
    const unknown = await api('POST', '/emulation/titles', 'principal', {
      code: 'MOI',
      name: 'Danh hiệu mới',
      kind: 'award',
      target: 'individual',
      decision_level: 'school',
      quota_percent: 5,
      quota_base_code: 'KHONG-CO',
    });
    assert.deepEqual(
      (errorOf(unknown.body).details ?? []).map((detail) => detail.field),
      ['quota_base_code'],
    );
  });

  it('CT-22d-3: phát động đợt có kỳ KPI; cá nhân đăng ký cho mình, tổ trưởng đăng ký cho tổ mình; trùng, tổ khác bị chặn; người quản lý duyệt, trả lại có lý do; Việc của tôi', async () => {
    const created = await api('POST', '/emulation/campaigns', 'principal', {
      code: `TD-${yearStart}`,
      name: `Thi đua năm học ${yearStart}–${yearStart + 1}`,
      kind: 'regular',
      description: 'Phát động phong trào thi đua dạy tốt, học tốt.',
      title_ids: [titles.LDTT, titles.CSTDCS, titles['CSTD-TINH'], titles['TT-LDTT']],
      kpi_period_id: kpiPeriodId,
      registration_deadline: addDays(vietnamToday, 10),
      nomination_deadline: addDays(vietnamToday, 60),
      appeal_days: 5,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    campaignId = created.body.id as string;
    const early = await api('POST', '/emulation/registrations', 'teacher', {
      campaign_id: campaignId,
      title_id: titles.LDTT,
      target: 'individual',
    });
    assert.equal(errorOf(early.body).rule_code, 'YCTD-148');
    assert.equal((await api('POST', `/emulation/campaigns/${campaignId}/launch`, 'principal')).body.status, 'launched');
    const launchPdf = await download(`/emulation/campaigns/${campaignId}/launch-document?format=pdf`, 'teacher');
    assert.equal(launchPdf.type, 'application/pdf');
    const own = await api('POST', '/emulation/registrations', 'teacher', {
      campaign_id: campaignId,
      title_id: titles.LDTT,
      target: 'individual',
      commitment: 'Hoàn thành tốt nhiệm vụ được giao',
    });
    assert.equal(own.status, 201, JSON.stringify(own.body));
    assert.equal(own.body.subject_name, 'Giáo Viên Một');
    assert.equal(own.body.title_name, 'Lao động tiên tiến');
    const duplicate = await api('POST', '/emulation/registrations', 'teacher', {
      campaign_id: campaignId,
      title_id: titles.LDTT,
      target: 'individual',
    });
    assert.equal(errorOf(duplicate.body).rule_code, 'YCTD-148');
    const other = await api('POST', '/emulation/registrations', 'teacher', {
      campaign_id: campaignId,
      title_id: titles.LDTT,
      target: 'individual',
      staff_id: staff.teacher2,
    });
    assert.equal(other.status, 403);
    const wrongTarget = await api('POST', '/emulation/registrations', 'leader', {
      campaign_id: campaignId,
      title_id: titles.LDTT,
      target: 'collective',
      department_id: departments['Tổ Lá'],
    });
    assert.equal(wrongTarget.status, 400);
    const team = await api('POST', '/emulation/registrations', 'leader', {
      campaign_id: campaignId,
      title_id: titles['TT-LDTT'],
      target: 'collective',
      department_id: departments['Tổ Lá'],
    });
    assert.equal(team.status, 201, JSON.stringify(team.body));
    const otherTeam = await api('POST', '/emulation/registrations', 'leader', {
      campaign_id: campaignId,
      title_id: titles['TT-LDTT'],
      target: 'collective',
      department_id: departments['Tổ Chồi'],
    });
    assert.equal(otherTeam.status, 403);
    const second = await api('POST', '/emulation/registrations', 'teacher2', {
      campaign_id: campaignId,
      title_id: titles.CSTDCS,
      target: 'individual',
    });
    assert.equal(second.status, 201);
    assert.ok((await myWork('vice')).some((work) => work.kind === 'Đăng ký thi đua chờ duyệt'));
    const noNote = await api('POST', '/emulation/registrations/review', 'principal', {
      ids: [team.body.id],
      accept: false,
    });
    assert.equal(noNote.status, 400);
    assert.deepEqual(
      (
        await api('POST', '/emulation/registrations/review', 'principal', {
          ids: [own.body.id, second.body.id, team.body.id],
          accept: true,
        })
      ).body,
      { updated: 3 },
    );
    const mine = (await api('GET', `/emulation/registrations?campaign_id=${campaignId}`, 'teacher'))
      .body as unknown as Array<{
      status: string;
    }>;
    assert.deepEqual(
      mine.map((row) => row.status),
      ['accepted'],
    );
  });

  it('CT-22d-4: hồ sơ đề nghị lấy KPI làm đầu vào, tự chấm tiêu chí, minh chứng từ kho hồ sơ chuyên môn; nộp, trả lại, nộp lại, tiếp nhận; người ngoài không xem được', async () => {
    const created = await api('POST', '/emulation/nominations', 'teacher', {
      campaign_id: campaignId,
      title_id: titles.LDTT,
      target: 'individual',
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    nominations.ldtt = created.body.id as string;
    assert.equal(created.body.achievements, 'Hoàn thành tốt nhiệm vụ được giao');
    assert.equal(checkOf(created.body, 'registration')?.state, 'ok');
    assert.equal(checkOf(created.body, 'kpi')?.state, 'ok');
    assert.equal(checkOf(created.body, 'score')?.state, 'failed');
    assert.equal((await api('GET', `/emulation/nominations/${nominations.ldtt}`, 'teacher2')).status, 404);
    const tooHigh = await api('PUT', `/emulation/nominations/${nominations.ldtt}`, 'teacher', {
      achievements: 'Thành tích',
      scores: { nhiem_vu: 11 },
    });
    assert.deepEqual(
      (errorOf(tooHigh.body).details ?? []).map((detail) => detail.field),
      ['scores.nhiem_vu'],
    );
    const saved = await api('PUT', `/emulation/nominations/${nominations.ldtt}`, 'teacher', {
      achievements: 'Chủ nhiệm lớp Lá đạt chuyên đề cấp trường.',
      scores: { nhiem_vu: 9, pham_chat: 10, phong_trao: 8, boi_duong: 7 },
    });
    assert.equal(saved.body.total_score, '86.00');
    assert.equal(checkOf(saved.body, 'score')?.state, 'ok');
    // Minh chứng: hồ sơ trong kho hồ sơ chuyên môn của chính giáo viên
    assert.equal(
      (await api('POST', '/professional-folders/defaults', 'principal', { school_level: 'MN' })).status,
      200,
    );
    const folder = await schoolYear
      .selectFrom('professional_folders')
      .select(['id', 'branch'])
      .where('branch', '=', 'personal')
      .executeTakeFirstOrThrow();
    const insertDocument = async (owner: 'teacher' | 'teacher2', title: string) =>
      (
        await schoolYear
          .insertInto('professional_documents')
          .values({
            folder_id: folder.id,
            branch: 'personal',
            org_unit_id: rootUnit,
            owner_user_id: users[owner]?.userId ?? '',
            owner_staff_id: staff[owner] ?? null,
            owner_name: owner,
            title,
            approval_flow: 'none',
            status: 'approved',
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    const evidenceId = await insertDocument('teacher', 'Chuyên đề cấp trường');
    const foreignId = await insertDocument('teacher2', 'Hồ sơ của người khác');
    const options = (await api('GET', `/emulation/nominations/${nominations.ldtt}/evidence-options`, 'teacher'))
      .body as unknown as Array<{ id: string }>;
    assert.deepEqual(
      options.map((option) => option.id),
      [evidenceId],
    );
    assert.equal(
      (await api('POST', `/emulation/nominations/${nominations.ldtt}/evidence`, 'teacher', { document_id: foreignId }))
        .status,
      400,
    );
    const linked = await api('POST', `/emulation/nominations/${nominations.ldtt}/evidence`, 'teacher', {
      document_id: evidenceId,
      note: 'Giấy chứng nhận',
    });
    assert.equal((linked.body.evidence as unknown[]).length, 1);
    const noFile = await download(
      `/emulation/nominations/${nominations.ldtt}/evidence/${(linked.body.evidence as Array<{ id: string }>)[0]?.id}/file`,
      'teacher',
    );
    assert.equal(noFile.status, 404);
    const submitted = await api('POST', `/emulation/nominations/${nominations.ldtt}/submit`, 'teacher');
    assert.equal(submitted.body.status, 'submitted', JSON.stringify(submitted.body));
    assert.equal(submitted.body.kpi_rank, 'good');
    assert.equal(submitted.body.kpi_rank_label, 'Hoàn thành tốt nhiệm vụ');
    assert.equal(
      (await api('PUT', `/emulation/nominations/${nominations.ldtt}`, 'teacher', { achievements: 'Sửa' })).status,
      422,
    );
    assert.equal((await api('POST', `/emulation/nominations/${nominations.ldtt}/accept`, 'teacher')).status, 403);
    assert.ok((await myWork('principal')).some((work) => work.kind === 'Hồ sơ đề nghị chờ tiếp nhận'));
    const returned = await api('POST', `/emulation/nominations/${nominations.ldtt}/return`, 'vice', {
      note: 'Bổ sung minh chứng chuyên đề',
    });
    assert.equal(returned.body.status, 'returned');
    assert.ok((await myWork('teacher')).some((work) => work.kind === 'Hồ sơ đề nghị khen thưởng bị trả lại'));
    await api('POST', `/emulation/nominations/${nominations.ldtt}/submit`, 'teacher');
    assert.equal(
      (await api('POST', `/emulation/nominations/${nominations.ldtt}/accept`, 'vice')).body.status,
      'accepted',
    );
    const report = await download(`/emulation/nominations/${nominations.ldtt}/report?format=docx`, 'teacher');
    assert.equal(report.status, 200);
    assert.equal(report.body.subarray(0, 2).toString(), 'PK');
    // Giáo viên Hai: Chiến sĩ thi đua cơ sở; tổ Lá: Tập thể lao động tiên tiến
    for (const [key, name, body] of [
      ['cstd', 'teacher2', { title_id: titles.CSTDCS, target: 'individual' }],
      ['team', 'leader', { title_id: titles['TT-LDTT'], target: 'collective', department_id: departments['Tổ Lá'] }],
    ] as const) {
      const row = await api('POST', '/emulation/nominations', name, { campaign_id: campaignId, ...body });
      assert.equal(row.status, 201, JSON.stringify(row.body));
      nominations[key] = row.body.id as string;
      await api('PUT', `/emulation/nominations/${nominations[key]}`, name, {
        achievements: 'Thành tích tiêu biểu trong năm học.',
        scores:
          key === 'team'
            ? { nhiem_vu: 10, phong_trao: 10, noi_bo: 10 }
            : { nhiem_vu: 10, pham_chat: 10, phong_trao: 10, boi_duong: 10 },
      });
      assert.equal((await api('POST', `/emulation/nominations/${nominations[key]}/submit`, name)).status, 200);
      assert.equal(
        (await api('POST', `/emulation/nominations/${nominations[key]}/accept`, 'principal')).body.status,
        'accepted',
      );
    }
    const cstd = await api('GET', `/emulation/nominations/${nominations.cstd}`, 'principal');
    assert.equal(checkOf(cstd.body, 'kpi')?.state, 'ok');
    // Tỉ lệ tối đa 10% số Lao động tiên tiến: có 1 hồ sơ Lao động tiên tiến nên tối đa 0 Chiến sĩ thi đua cơ sở
    assert.equal(checkOf(cstd.body, 'quota')?.state, 'failed');
  });

  it('CT-22d-5: danh hiệu cần nhiều năm liên tục đọc sổ khen thưởng của mọi năm học, gồm khen thưởng nhập tay các năm trước', async () => {
    const previousName = `${environment.schoolYearDatabasePrefix}emulation_previous`;
    await createEmptyDatabase(environment.systemDatabaseUrl, previousName);
    const previousUrl = replaceDatabaseName(environment.systemDatabaseUrl, previousName);
    assert.equal((await migrateToLatest('school-year', previousUrl)).error, undefined);
    const previous = createDatabase<SchoolYearDatabase>(previousUrl);
    try {
      for (const row of await schoolYear.selectFrom('org_units').selectAll().execute()) {
        await previous.insertInto('org_units').values(row).execute();
      }
      for (const row of await schoolYear.selectFrom('departments').selectAll().execute()) {
        await previous.insertInto('departments').values(row).execute();
      }
      for (const row of await schoolYear.selectFrom('staff').selectAll().execute()) {
        await previous
          .insertInto('staff')
          .values({ ...row, moet_profile: row.moet_profile ? JSON.stringify(row.moet_profile) : null })
          .execute();
      }
      // Bước chuyển năm học chép danh mục, giữ mã định danh
      await emulationTransitionStep.carryOver?.({
        previousDatabase: schoolYear as Kysely<unknown>,
        newDatabase: previous as Kysely<unknown>,
        academicYear: { id: 'previous', startDate: vietnamToday },
        actorUserId: principal.userId,
      });
      const carried = await previous.selectFrom('emulation_titles').select('id').execute();
      assert.equal(carried.length, EMULATION_DEFAULT_TITLES.length);
      assert.ok(carried.some((row) => row.id === titles.LDTT));
      // Hai năm học trước có Chiến sĩ thi đua cơ sở trong sổ của năm học đó
      for (const start of [yearStart - 1, yearStart - 2]) {
        await previous
          .insertInto('emulation_awards')
          .values({
            source: 'decision',
            year_name: `${start}–${start + 1}`,
            year_start: start,
            title_code: 'CSTDCS',
            title_name: 'Chiến sĩ thi đua cơ sở',
            title_kind: 'title',
            target: 'individual',
            staff_id: staff.teacher2 ?? '',
            subject_name: 'Giáo Viên Hai',
            decision_number: `${start}/QĐ-TĐ`,
            lookup_code: `CU${start}ABCDEF`.slice(0, 12),
          })
          .execute();
      }
      const fakeYear = await environment.system
        .insertInto('academic_years')
        .values({
          name: 'Năm học trước thử',
          start_date: addDays(vietnamToday, -500),
          end_date: addDays(vietnamToday, -150),
          status: 'closed',
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await environment.system
        .insertInto('academic_year_databases')
        .values({
          academic_year_id: fakeYear.id,
          database_name: previousName,
          status: 'read_only',
          opened_at: new Date(),
        })
        .execute();
    } finally {
      await previous.destroy();
    }
    const nomination = await api('POST', '/emulation/nominations', 'teacher2', {
      campaign_id: campaignId,
      title_id: titles['CSTD-TINH'],
      target: 'individual',
    });
    assert.equal(nomination.status, 201, JSON.stringify(nomination.body));
    nominations.province = nomination.body.id as string;
    assert.equal(checkOf(nomination.body, 'consecutive')?.state, 'failed');
    assert.equal(checkOf(nomination.body, 'initiative')?.state, 'failed');
    // Năm thứ ba nhập tay; giáo viên không nhập được
    const manual = {
      year_name: `${yearStart - 3}-${yearStart - 2}`,
      title_code: 'CSTDCS',
      title_name: 'Chiến sĩ thi đua cơ sở',
      target: 'individual',
      staff_id: staff.teacher2,
      decision_number: '12/QĐ-PGD',
      decision_date: `${yearStart - 2}-05-20`,
      issuer: 'Phòng Giáo dục và Đào tạo',
    };
    assert.equal((await api('POST', '/emulation/history', 'teacher2', manual)).status, 403);
    const future = await api('POST', '/emulation/history', 'principal', {
      ...manual,
      year_name: `${yearStart + 1}-${yearStart + 2}`,
    });
    assert.equal(future.status, 400);
    const added = await api('POST', '/emulation/history', 'principal', manual);
    assert.equal(added.status, 201, JSON.stringify(added.body));
    assert.equal(added.body.year_name, `${yearStart - 3}–${yearStart - 2}`);
    await api('PUT', `/emulation/nominations/${nominations.province}`, 'teacher2', {
      achievements: 'Ba năm liên tục Chiến sĩ thi đua cơ sở.',
      initiative: 'Sáng kiến tổ chức hoạt động trải nghiệm',
      scores: { nhiem_vu: 10, pham_chat: 10, phong_trao: 10, boi_duong: 10 },
    });
    const view = await api('GET', `/emulation/nominations/${nominations.province}`, 'teacher2');
    assert.equal(checkOf(view.body, 'consecutive')?.state, 'ok', JSON.stringify(view.body.eligibility));
    assert.equal(checkOf(view.body, 'initiative')?.state, 'ok');
    await api('POST', `/emulation/nominations/${nominations.province}/submit`, 'teacher2');
    await api('POST', `/emulation/nominations/${nominations.province}/accept`, 'principal');
    // Sổ theo dõi nhiều năm: giáo viên chỉ thấy của mình, người quản lý thấy mọi người; xuất Excel
    const history = (await api('GET', `/emulation/history?staff_id=${staff.teacher2}`, 'principal'))
      .body as unknown as Array<{
      year_start: number;
      source: string;
    }>;
    assert.deepEqual(
      history.map((row) => row.year_start),
      [yearStart - 1, yearStart - 2, yearStart - 3],
    );
    assert.equal(((await api('GET', '/emulation/history', 'teacher')).body as unknown as unknown[]).length, 0);
    const file = await download('/emulation/history/export?format=xlsx', 'principal');
    assert.equal(file.status, 200);
    assert.equal(file.body.subarray(0, 2).toString(), 'PK');
  });

  it('CT-22d-6: hội đồng bỏ phiếu kín: chỉ thành viên bỏ phiếu, đang bỏ phiếu không lộ số phiếu; đóng phiên tính tỉ lệ trên tổng thành viên, dựng biên bản', async () => {
    const noChair = await api('PUT', `/emulation/campaigns/${campaignId}/council`, 'principal', {
      members: [{ user_id: principal.userId, position: 'member' }],
    });
    assert.equal(noChair.status, 400);
    const council = await api('PUT', `/emulation/campaigns/${campaignId}/council`, 'principal', {
      members: [
        { user_id: principal.userId, position: 'chair' },
        { user_id: users.vice?.userId, position: 'vice_chair' },
        { user_id: users.leader?.userId, position: 'secretary' },
      ],
    });
    assert.equal(council.status, 200, JSON.stringify(council.body));
    assert.equal(council.body.waiting_count, 4);
    const opened = await api('POST', `/emulation/campaigns/${campaignId}/meetings`, 'principal', {
      held_at: `${vietnamToday}T14:00`,
      location: 'Phòng họp',
    });
    assert.equal(opened.status, 201, JSON.stringify(opened.body));
    meetingId = opened.body.id as string;
    assert.equal((opened.body.nominations as unknown[]).length, 4);
    assert.equal(
      (await api('PUT', `/emulation/campaigns/${campaignId}/council`, 'principal', { members: [] })).status,
      422,
    );
    const ballot = (choice: Record<string, string>) => ({
      votes: Object.entries(choice).map(([key, value]) => ({ nomination_id: nominations[key], choice: value })),
    });
    assert.equal(
      (await api('PUT', `/emulation/meetings/${meetingId}/votes`, 'teacher', ballot({ ldtt: 'agree' }))).status,
      403,
    );
    assert.ok((await myWork('leader')).some((work) => work.kind === 'Bỏ phiếu bình xét thi đua'));
    await api(
      'PUT',
      `/emulation/meetings/${meetingId}/votes`,
      'principal',
      ballot({ ldtt: 'agree', cstd: 'agree', team: 'agree', province: 'agree' }),
    );
    await api(
      'PUT',
      `/emulation/meetings/${meetingId}/votes`,
      'vice',
      ballot({ ldtt: 'agree', cstd: 'disagree', team: 'agree', province: 'agree' }),
    );
    // Thư ký đổi phiếu: phiếu sau ghi đè phiếu trước
    await api(
      'PUT',
      `/emulation/meetings/${meetingId}/votes`,
      'leader',
      ballot({ ldtt: 'disagree', cstd: 'disagree' }),
    );
    const voting = await api(
      'PUT',
      `/emulation/meetings/${meetingId}/votes`,
      'leader',
      ballot({ ldtt: 'agree', province: 'agree' }),
    );
    const rows = voting.body.nominations as Array<{ id: string; my_choice: string | null; agree_count: number | null }>;
    assert.equal(rows.find((row) => row.id === nominations.ldtt)?.my_choice, 'agree');
    assert.equal(rows.find((row) => row.id === nominations.cstd)?.my_choice, 'disagree');
    assert.ok(rows.every((row) => row.agree_count === null));
    assert.equal(voting.body.voted_members, 3);
    assert.equal((await api('POST', `/emulation/meetings/${meetingId}/close`, 'leader', {})).status, 403);
    const closed = await api('POST', `/emulation/meetings/${meetingId}/close`, 'principal', {
      attendee_count: 3,
      conclusion: 'Hội đồng thống nhất kết quả.',
    });
    assert.equal(closed.body.status, 'closed', JSON.stringify(closed.body));
    const result = Object.fromEntries(
      (closed.body.nominations as Array<{ id: string; status: string; agree_percent: string }>).map((row) => [
        row.id,
        [row.status, row.agree_percent],
      ]),
    );
    assert.deepEqual(result[nominations.ldtt ?? ''], ['passed', '100.00']);
    assert.deepEqual(result[nominations.cstd ?? ''], ['failed', '33.33']);
    // Tổ: hai trên ba thành viên đồng ý, thư ký không bỏ phiếu
    assert.deepEqual(result[nominations.team ?? ''], ['passed', '66.67']);
    assert.deepEqual(result[nominations.province ?? ''], ['passed', '100.00']);
    const minutes = await download(`/emulation/meetings/${meetingId}/minutes`, 'leader');
    assert.equal(minutes.type, 'application/pdf');
    assert.equal(minutes.body.subarray(0, 4).toString(), '%PDF');
  });

  it('CT-22d-7: công bố kết quả mở hạn phúc khảo; chỉ người được đề nghị phúc khảo hồ sơ của mình; chấp nhận thì bỏ phiếu lại; hết hạn bị chặn', async () => {
    const appealEarly = await api('POST', '/emulation/appeals', 'teacher2', {
      campaign_id: campaignId,
      nomination_id: nominations.cstd,
      kind: 'review',
      content: 'Đề nghị xem lại',
    });
    assert.equal(errorOf(appealEarly.body).rule_code, 'YCTD-148');
    const published = await api('POST', `/emulation/campaigns/${campaignId}/publish`, 'principal');
    assert.equal(published.body.status, 'published');
    assert.equal(published.body.appeal_deadline, addDays(vietnamToday, 5));
    const notMine = await api('POST', '/emulation/appeals', 'teacher', {
      campaign_id: campaignId,
      nomination_id: nominations.cstd,
      kind: 'review',
      content: 'Phúc khảo hộ',
    });
    assert.equal(notMine.status, 403);
    const appeal = await api('POST', '/emulation/appeals', 'teacher2', {
      campaign_id: campaignId,
      nomination_id: nominations.cstd,
      kind: 'review',
      content: 'Đã có sáng kiến được công nhận, đề nghị bình xét lại',
    });
    assert.equal(appeal.status, 201, JSON.stringify(appeal.body));
    assert.ok((await myWork('vice')).some((work) => work.kind === 'Phúc khảo chờ giải quyết'));
    // Hồ sơ có phúc khảo chờ thì chưa đưa vào quyết định; không kết thúc đợt khi còn phúc khảo
    assert.equal((await api('POST', `/emulation/campaigns/${campaignId}/close`, 'principal')).status, 422);
    const resolved = await api('POST', `/emulation/appeals/${appeal.body.id}/resolve`, 'principal', {
      accept: true,
      response: 'Chấp nhận, đưa ra hội đồng bỏ phiếu lại',
    });
    assert.equal(resolved.body.status, 'accepted');
    const reopened = await api('GET', `/emulation/nominations/${nominations.cstd}`, 'teacher2');
    assert.equal(reopened.body.status, 'accepted');
    assert.equal(reopened.body.agree_count, null);
    const revote = await api('POST', `/emulation/campaigns/${campaignId}/meetings`, 'principal', {
      held_at: `${vietnamToday}T16:00`,
    });
    assert.deepEqual(
      (revote.body.nominations as Array<{ id: string }>).map((row) => row.id),
      [nominations.cstd],
    );
    for (const name of ['principal', 'vice']) {
      await api('PUT', `/emulation/meetings/${revote.body.id}/votes`, name, {
        votes: [{ nomination_id: nominations.cstd, choice: 'agree' }],
      });
    }
    await api('POST', `/emulation/meetings/${revote.body.id}/close`, 'principal', {});
    assert.equal((await api('GET', `/emulation/nominations/${nominations.cstd}`, 'teacher2')).body.status, 'passed');
    await api('POST', `/emulation/campaigns/${campaignId}/publish`, 'principal');
    await schoolYear
      .updateTable('emulation_campaigns')
      .set({ appeal_deadline: addDays(vietnamToday, -1) })
      .where('id', '=', campaignId)
      .execute();
    const late = await api('POST', '/emulation/appeals', 'teacher', {
      campaign_id: campaignId,
      kind: 'complaint',
      content: 'Khiếu nại muộn',
    });
    assert.equal(errorOf(late.body).rule_code, 'YCTD-148');
  });

  it('CT-22d-8: quyết định của trường chỉ nhận danh hiệu cấp trường; Hiệu trưởng ban hành ghi sổ có mã tra cứu; giấy khen PDF; tra cứu công khai; tờ trình cấp trên ghi kết quả', async () => {
    const wrongLevel = await api('POST', '/emulation/decisions', 'principal', {
      campaign_id: campaignId,
      kind: 'decision',
      title: 'Quyết định công nhận danh hiệu thi đua',
      nomination_ids: [nominations.ldtt, nominations.province],
    });
    assert.deepEqual(
      (errorOf(wrongLevel.body).details ?? []).map((detail) => detail.field),
      ['nomination_ids.1'],
    );
    const decision = await api('POST', '/emulation/decisions', 'vice', {
      campaign_id: campaignId,
      kind: 'decision',
      title: 'Quyết định công nhận danh hiệu thi đua năm học',
      basis: 'Căn cứ Luật Thi đua, khen thưởng năm 2022;\nCăn cứ biên bản họp Hội đồng thi đua, khen thưởng.',
      signer_name: 'Hiệu Trưởng Giả',
      nomination_ids: [nominations.ldtt, nominations.cstd, nominations.team],
    });
    assert.equal(decision.status, 201, JSON.stringify(decision.body));
    const decisionId = decision.body.id as string;
    const word = await download(`/emulation/decisions/${decisionId}/document?format=docx`, 'vice');
    assert.equal(word.body.subarray(0, 2).toString(), 'PK');
    assert.equal((await api('GET', '/emulation/decisions', 'teacher')).status, 403);
    assert.equal((await api('POST', `/emulation/decisions/${decisionId}/issue`, 'vice', {})).status, 403);
    const noNumber = await api('POST', `/emulation/decisions/${decisionId}/issue`, 'principal', {});
    assert.equal(noNumber.status, 400);
    const issued = await api('POST', `/emulation/decisions/${decisionId}/issue`, 'principal', {
      number: '25/QĐ-MN',
      issue_date: vietnamToday,
    });
    assert.equal(issued.body.status, 'issued', JSON.stringify(issued.body));
    const lines = issued.body.lines as Array<{
      id: string;
      status: string;
      award: { id: string; lookup_code: string } | null;
    }>;
    assert.ok(lines.every((line) => line.status === 'awarded' && line.award !== null));
    const award = lines.find((line) => line.id === nominations.ldtt)?.award;
    assert.match(award?.lookup_code ?? '', /^[A-Z0-9]{12}$/);
    const certificate = await download(`/emulation/awards/${award?.id}/certificate`, 'teacher');
    assert.equal(certificate.type, 'application/pdf');
    assert.equal((await download(`/emulation/awards/${award?.id}/certificate`, 'teacher2')).status, 404);
    const verified = await fetch(
      `${environment.baseUrl}/public/emulation-awards/verify?code=${award?.lookup_code.toLowerCase()}`,
    );
    const verifiedBody = (await verified.json()) as Record<string, unknown>;
    assert.equal(verifiedBody.subject_name, 'Giáo Viên Một');
    assert.equal(verifiedBody.title_name, 'Lao động tiên tiến');
    assert.equal(verifiedBody.decision_number, '25/QĐ-MN');
    assert.equal((await fetch(`${environment.baseUrl}/public/emulation-awards/verify?code=SAI`)).status, 400);
    // Tờ trình đề nghị cấp trên: Chiến sĩ thi đua cấp tỉnh; kết quả của cấp trên ghi tay
    const proposal = await api('POST', '/emulation/decisions', 'principal', {
      campaign_id: campaignId,
      kind: 'proposal',
      title: 'Tờ trình đề nghị tặng danh hiệu Chiến sĩ thi đua cấp tỉnh',
      nomination_ids: [nominations.province],
    });
    assert.equal(proposal.status, 201, JSON.stringify(proposal.body));
    const sent = await api('POST', `/emulation/decisions/${proposal.body.id}/issue`, 'principal', {
      number: '30/TTr-MN',
      issue_date: vietnamToday,
    });
    assert.equal((sent.body.lines as Array<{ status: string }>)[0]?.status, 'proposed');
    const upper = await api('POST', `/emulation/decisions/${proposal.body.id}/upper-result`, 'principal', {
      number: '99/QĐ-UBND',
      date: vietnamToday,
      issuer: 'Ủy ban nhân dân tỉnh',
      awarded_ids: [nominations.province],
    });
    assert.equal((upper.body.lines as Array<{ status: string }>)[0]?.status, 'awarded');
    const history = (await api('GET', `/emulation/history?staff_id=${staff.teacher2}`, 'teacher2'))
      .body as unknown as Array<{
      title_code: string;
      year_start: number;
      issuer: string | null;
    }>;
    assert.deepEqual(
      history
        .filter((row) => row.year_start === yearStart)
        .map((row) => row.title_code)
        .sort(),
      ['CSTD-TINH', 'CSTDCS'],
    );
    const report = await api('GET', `/emulation/campaigns/${campaignId}/report`, 'principal');
    const ldtt = (report.body.by_title as Array<{ code: string; registered: number; awarded: number }>).find(
      (row) => row.code === 'LDTT',
    );
    assert.deepEqual([ldtt?.registered, ldtt?.awarded], [1, 1]);
    const reportFile = await download(`/emulation/campaigns/${campaignId}/report/export?format=xlsx`, 'principal');
    assert.equal(reportFile.body.subarray(0, 2).toString(), 'PK');
  });

  it('CT-22d-9: dự thảo văn bản đi từ quyết định (18b) cần quyền soạn văn bản đi; ban hành lấy số, ngày của văn bản đi đã phát hành; kết thúc đợt', async () => {
    const extra = await api('POST', '/emulation/nominations', 'teacher', {
      campaign_id: campaignId,
      title_id: titles.CSTDCS,
      target: 'individual',
    });
    // Đợt đã công bố thì không lập hồ sơ mới
    assert.equal(errorOf(extra.body).rule_code, 'YCTD-148');
    const draft = await schoolYear
      .insertInto('emulation_decisions')
      .values({
        campaign_id: campaignId,
        kind: 'decision',
        title: 'Quyết định khen thưởng bổ sung',
        created_by: principal.userId,
        created_by_name: 'Hiệu Trưởng Giả',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const outgoing = await api('POST', `/emulation/decisions/${draft.id}/outgoing`, 'principal');
    assert.equal(outgoing.status, 200, JSON.stringify(outgoing.body));
    const document = outgoing.body.outgoing as { id: string; status: string; summary: string };
    assert.equal(document.summary, 'Quyết định khen thưởng bổ sung');
    assert.equal(
      errorOf((await api('POST', `/emulation/decisions/${draft.id}/outgoing`, 'principal')).body).rule_code,
      'YCTD-148',
    );
    // Văn bản đi chưa phát hành: ban hành phải nhập số, ngày; quyết định chưa có hồ sơ không ban hành được
    const noNumber = await api('POST', `/emulation/decisions/${draft.id}/issue`, 'principal', {});
    assert.equal(noNumber.status, 400);
    const empty = await api('POST', `/emulation/decisions/${draft.id}/issue`, 'principal', {
      number: '40/QĐ-MN',
      issue_date: vietnamToday,
    });
    assert.equal(errorOf(empty.body).rule_code, 'YCTD-148');
    await schoolYear.deleteFrom('emulation_decisions').where('id', '=', draft.id).execute();
    const closed = await api('POST', `/emulation/campaigns/${campaignId}/close`, 'principal');
    assert.equal(closed.body.status, 'closed', JSON.stringify(closed.body));
    assert.equal(
      (
        await api('PUT', `/emulation/campaigns/${campaignId}`, 'principal', {
          code: 'X',
          name: 'X',
          title_ids: [titles.LDTT],
        })
      ).status,
      422,
    );
  });
});
