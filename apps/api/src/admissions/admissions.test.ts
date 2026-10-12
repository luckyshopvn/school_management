import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  createDatabase,
  createEmptyDatabase,
  migrateToLatest,
  replaceDatabaseName,
  type SchoolYearDatabase,
} from '@school-management/database';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { admissionsTransitionStep } from './admissions-transition.js';
import { PublicRateLimiter } from './public-rate-limit.js';

// Tuyển sinh trực tuyến (DT-11 phần 11a, YCTD-86): đợt tuyển sinh, tin tuyển sinh, hồ sơ nộp trực tuyến không cần tài
// khoản, tiếp nhận, xét duyệt, chuyển thành hồ sơ trẻ; kịch bản CT-076, CT-077, CT-124
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const errorOf = (body: Record<string, unknown>) =>
  (body.error ?? {}) as { code?: string; rule_code?: string; details?: Array<{ field: string; message: string }> };
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const DEFAULT_PASSWORD = 'PhuHuynh2026';
const randomPhone = () => `09${randomInt(0, 100_000_000).toString().padStart(8, '0')}`;
let nationalIdCounter = randomInt(0, 1_000_000);
const nextNationalId = () =>
  `079${String(Date.now() % 1_000_000).padStart(6, '0')}${String(++nationalIdCounter % 1000).padStart(3, '0')}`;

describe('Tuyển sinh trực tuyến: đợt, tin, hồ sơ, xét duyệt, chuyển hồ sơ trẻ', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let savedDefaultPassword: Array<{ key: string; value: unknown; updated_by: string | null }> = [];
  const units: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const classes: Record<string, string> = {};
  let mother = '';
  let campaignId = '';
  let childSequence = 0;

  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string | undefined, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);
  const publicApi = (method: string, path: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}/public${path}`, undefined, body);

  async function upload(accessToken: string, orgUnitId: string) {
    const form = new FormData();
    form.set('org_unit_id', orgUnitId);
    form.set('purpose', 'birth_certificate');
    form.set('file', new Blob([PNG]), 'giay-khai-sinh.png');
    const response = await fetch(`${environment.baseUrl}/files`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
      body: form,
    });
    const body = (await response.json()) as Record<string, unknown>;
    assert.equal(response.status, 201, JSON.stringify(body));
    return body.id as string;
  }

  function applicationBody(overrides: Record<string, unknown> = {}) {
    return {
      campaign_id: campaignId,
      child_full_name: `Bé Tuyển Sinh ${(childSequence += 1)}`,
      child_dob: '2023-03-15',
      child_gender: 'female',
      child_has_allergies: false,
      guardian_full_name: 'Nguyễn Thị Mẹ',
      guardian_phone: randomPhone(),
      guardian_relationship_item_id: mother,
      ...overrides,
    };
  }

  // Nộp trực tuyến, tiếp nhận và xét đạt
  async function passedApplication(overrides: Record<string, unknown> = {}) {
    const body = applicationBody(overrides);
    const submitted = await publicApi('POST', '/admission-applications', body);
    assert.equal(submitted.status, 201, JSON.stringify(submitted.body));
    const list = await api('GET', `/admission-applications?q=${submitted.body.code}`, token('admissions'));
    const id = (list.body as unknown as Array<{ id: string }>)[0]?.id ?? '';
    const received = await api('POST', `/admission-applications/${id}/receive`, token('admissions'));
    assert.equal(received.status, 200, JSON.stringify(received.body));
    const approved = await api('POST', `/admission-applications/${id}/approve`, token('manager'), {});
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    return { id, code: submitted.body.code as string, phone: body.guardian_phone };
  }

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    const identityDatabase = environment.identity.database;
    savedDefaultPassword = await identityDatabase
      .selectFrom('identity_settings')
      .select(['key', 'value', 'updated_by'])
      .where('key', '=', 'parent_default_password_hash')
      .execute();
    const saved = await sendJson('PUT', `${environment.identity.baseUrl}/auth/settings`, principal.accessToken, {
      parent_default_password: DEFAULT_PASSWORD,
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const academicYearId = await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
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
    for (const [code, type] of [
      ['TC', 'truong_chinh'],
      ['ĐT-A1', 'diem_truong'],
      ['ĐT-B1', 'diem_truong'],
    ] as const) {
      units[code] = (await api('POST', '/org-units', principal.accessToken, { code, name: code, unit_type: type })).body
        .id as string;
    }
    const unitA = units['ĐT-A1'] ?? '';
    users.admissions = await environment.loginAs('VT-12', unitA);
    users.manager = await environment.loginAs('VT-03', unitA);
    users.otherManager = await environment.loginAs('VT-03', units['ĐT-B1'] ?? null);
    users.teacher = await environment.loginAs('VT-07', unitA);
    for (const [code, unit] of [
      ['MAM-1', 'ĐT-A1'],
      ['MAM-B', 'ĐT-B1'],
    ] as const) {
      classes[code] = (
        await schoolYear
          .insertInto('classes')
          .values({
            org_unit_id: units[unit] ?? '',
            academic_year_id: academicYearId,
            code,
            name: code,
            grade_level: 'MAM',
            max_size: 25,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    mother = (
      await api('POST', '/catalog-items', principal.accessToken, {
        catalog_type: 'parent_relationship',
        code: 'ME',
        name: 'Mẹ',
      })
    ).body.id as string;
  });

  // Mọi yêu cầu kiểm thử cùng một địa chỉ mạng; đếm lại từ đầu ở mỗi ca
  beforeEach(() => {
    environment.api.get(PublicRateLimiter).reset();
  });

  after(async () => {
    const identityDatabase = environment.identity.database;
    await identityDatabase.deleteFrom('identity_settings').where('key', '=', 'parent_default_password_hash').execute();
    for (const row of savedDefaultPassword) {
      await identityDatabase
        .insertInto('identity_settings')
        .values({ key: row.key, value: JSON.stringify(row.value), updated_by: row.updated_by })
        .execute();
    }
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-216 P16-01: lập đợt tuyển sinh ở trạng thái nháp, mở đợt; ngoài quyền hoặc ngoài đơn vị bị chặn', async () => {
    const body = {
      org_unit_id: units['ĐT-A1'],
      name: 'Tuyển sinh mầm 2027',
      quota: 3,
      open_from: addDays(vietnamToday, -1),
      open_to: addDays(vietnamToday, 30),
    };
    assert.equal((await api('POST', '/admission-campaigns', token('teacher'), body)).status, 403);
    assert.equal((await api('POST', '/admission-campaigns', token('otherManager'), body)).status, 403);
    const invalid = await api('POST', '/admission-campaigns', token('admissions'), {
      ...body,
      open_to: addDays(vietnamToday, -5),
    });
    assert.equal(invalid.status, 400);
    const created = await api('POST', '/admission-campaigns', token('admissions'), body);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.status, 'draft');
    campaignId = created.body.id as string;
    // Đợt nháp chưa nhận hồ sơ trực tuyến
    const early = await publicApi('POST', '/admission-applications', applicationBody());
    assert.equal(early.status, 422);
    assert.equal(errorOf(early.body).rule_code, 'P16-02');
    const opened = await api('POST', `/admission-campaigns/${campaignId}/open`, token('manager'));
    assert.equal(opened.status, 200, JSON.stringify(opened.body));
    assert.equal(opened.body.status, 'open');
    const otherList = await api('GET', '/admission-campaigns', token('otherManager'));
    assert.equal((otherList.body as unknown as unknown[]).length, 0);
  });

  it('CT-124: P16-05 danh sách tin tuyển sinh của đợt đang mở kèm thời hạn, không cần đăng nhập', async () => {
    const created = await api('POST', '/admission-posts', token('admissions'), {
      campaign_id: campaignId,
      title: 'Thông báo tuyển sinh lớp mầm',
      content: 'Nhà trường nhận hồ sơ trẻ sinh năm 2023.',
      publish_from: vietnamToday,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.publish_to, addDays(vietnamToday, 30));
    const draft = await api('POST', '/admission-posts', token('admissions'), {
      campaign_id: campaignId,
      title: 'Tin nháp',
      content: 'Chưa công bố',
      publish_from: vietnamToday,
    });
    // Quản lý đơn vị không có quyền soạn tin tuyển sinh
    assert.equal((await api('POST', `/admission-posts/${created.body.id}/publish`, token('manager'))).status, 403);
    const published = await api('POST', `/admission-posts/${created.body.id}/publish`, token('admissions'));
    assert.equal(published.status, 200, JSON.stringify(published.body));

    const listed = await publicApi('GET', '/admissions');
    assert.equal(listed.status, 200, JSON.stringify(listed.body));
    const campaigns = listed.body.campaigns as Array<{
      id: string;
      application_deadline: string;
      posts: Array<{ title: string; deadline: string }>;
    }>;
    const campaign = campaigns.find((item) => item.id === campaignId);
    assert.ok(campaign);
    assert.equal(campaign.application_deadline, addDays(vietnamToday, 30));
    assert.deepEqual(
      campaign.posts.map((post) => [post.title, post.deadline]),
      [['Thông báo tuyển sinh lớp mầm', addDays(vietnamToday, 30)]],
    );
    assert.ok((listed.body.relationships as Array<{ id: string }>).some((item) => item.id === mother));
    assert.ok(draft.body.id);

    const hidden = await api('POST', `/admission-posts/${created.body.id}/hide`, token('admissions'), {
      reason: 'Sửa nội dung',
    });
    assert.equal(hidden.status, 200);
    const afterHide = (await publicApi('GET', '/admissions')).body.campaigns as Array<{ id: string; posts: unknown[] }>;
    assert.equal(afterHide.find((item) => item.id === campaignId)?.posts.length, 0);
    assert.equal((await api('POST', `/admission-posts/${created.body.id}/publish`, token('admissions'))).status, 200);
  });

  it('CT-217 P16-02: phụ huynh nộp hồ sơ không cần tài khoản, nhận mã TS và tra cứu bằng mã cùng số điện thoại', async () => {
    const missing = await publicApi('POST', '/admission-applications', {
      ...applicationBody(),
      child_has_allergies: undefined,
      guardian_phone: '123',
    });
    assert.equal(missing.status, 400);
    const fields = errorOf(missing.body).details?.map((detail) => detail.field) ?? [];
    assert.ok(fields.includes('child_has_allergies') && fields.includes('guardian_phone'), JSON.stringify(fields));

    const body = applicationBody({ child_national_id: nextNationalId() });
    const submitted = await publicApi('POST', '/admission-applications', body);
    assert.equal(submitted.status, 201, JSON.stringify(submitted.body));
    assert.match(submitted.body.code as string, /^TS-\d{6}$/);
    assert.equal(submitted.body.status, 'submitted');
    const duplicate = await publicApi('POST', '/admission-applications', { ...body, child_national_id: undefined });
    assert.equal(duplicate.status, 409);

    const found = await publicApi(
      'GET',
      `/admission-applications/lookup?code=${submitted.body.code}&phone=${body.guardian_phone}`,
    );
    assert.equal(found.status, 200, JSON.stringify(found.body));
    assert.equal(found.body.status, 'submitted');
    assert.equal(found.body.child_full_name, body.child_full_name);
    const wrongPhone = await publicApi(
      'GET',
      `/admission-applications/lookup?code=${submitted.body.code}&phone=0900000000`,
    );
    assert.equal(wrongPhone.status, 404);

    // Nhân viên tuyển sinh thấy hồ sơ, số định danh đã che; người ngoài đơn vị không thấy
    const list = await api('GET', `/admission-applications?campaign_id=${campaignId}`, token('admissions'));
    const row = (list.body as unknown as Array<{ id: string; code: string }>).find(
      (item) => item.code === submitted.body.code,
    );
    assert.ok(row);
    const detail = await api('GET', `/admission-applications/${row.id}`, token('admissions'));
    assert.match(detail.body.child_national_id_masked as string, /^\*{8}\d{4}$/);
    assert.equal(detail.body.child_national_id_encrypted, undefined);
    assert.equal((await api('GET', `/admission-applications/${row.id}`, token('otherManager'))).status, 403);
    assert.equal((await api('GET', '/admission-applications', token('teacher'))).status, 403);
  });

  it('CT-218 P16-03: tiếp nhận rồi xét; nhân viên tuyển sinh không xét được; không đạt kèm lý do; đạt không vượt chỉ tiêu', async () => {
    const body = applicationBody();
    const submitted = await publicApi('POST', '/admission-applications', body);
    const id = (
      (await api('GET', `/admission-applications?q=${submitted.body.code}`, token('admissions')))
        .body as unknown as Array<{
        id: string;
      }>
    )[0]?.id;
    assert.equal(
      errorOf((await api('POST', `/admission-applications/${id}/approve`, token('manager'), {})).body).rule_code,
      'P16-03',
    );
    assert.equal((await api('POST', `/admission-applications/${id}/receive`, token('admissions'))).status, 200);
    assert.equal((await api('POST', `/admission-applications/${id}/approve`, token('admissions'), {})).status, 403);
    assert.equal((await api('POST', `/admission-applications/${id}/approve`, token('otherManager'), {})).status, 403);
    assert.equal((await api('POST', `/admission-applications/${id}/reject`, token('manager'), {})).status, 400);
    const rejected = await api('POST', `/admission-applications/${id}/reject`, token('manager'), {
      reason: 'Trẻ chưa đủ tuổi nhận',
    });
    assert.equal(rejected.status, 200, JSON.stringify(rejected.body));
    assert.equal(rejected.body.status, 'rejected');
    const found = await publicApi(
      'GET',
      `/admission-applications/lookup?code=${submitted.body.code}&phone=${body.guardian_phone}`,
    );
    assert.equal(found.body.status, 'rejected');
    assert.equal(found.body.reject_reason, 'Trẻ chưa đủ tuổi nhận');
  });

  it('CT-077: chuyển hồ sơ tuyển sinh chưa đạt bị từ chối', async () => {
    const body = applicationBody();
    const submitted = await publicApi('POST', '/admission-applications', body);
    const id = (
      (await api('GET', `/admission-applications?q=${submitted.body.code}`, token('admissions')))
        .body as unknown as Array<{
        id: string;
      }>
    )[0]?.id;
    const fileId = await upload(token('manager'), units['ĐT-A1'] ?? '');
    const convertBody = {
      class_id: classes['MAM-1'],
      national_id: nextNationalId(),
      birth_certificate_file_id: fileId,
    };
    const notReceived = await api('POST', `/admission-applications/${id}/convert`, token('manager'), convertBody);
    assert.equal(notReceived.status, 422);
    assert.equal(errorOf(notReceived.body).rule_code, 'P16-04');
    await api('POST', `/admission-applications/${id}/receive`, token('admissions'));
    await api('POST', `/admission-applications/${id}/reject`, token('manager'), { reason: 'Không đủ điều kiện' });
    const rejected = await api('POST', `/admission-applications/${id}/convert`, token('manager'), convertBody);
    assert.equal(rejected.status, 422);
    assert.equal(errorOf(rejected.body).rule_code, 'P16-04');
    const lookup = await publicApi(
      'GET',
      `/admission-applications/lookup?code=${submitted.body.code}&phone=${body.guardian_phone}`,
    );
    assert.equal(lookup.body.status, 'rejected');
    assert.equal(lookup.body.reject_reason, 'Không đủ điều kiện');
    const children = await schoolYear
      .selectFrom('children')
      .select('id')
      .where('full_name', '=', body.child_full_name)
      .execute();
    assert.equal(children.length, 0);
  });

  it('CT-076: chuyển hồ sơ tuyển sinh đã đạt sinh hồ sơ trẻ đang học, gắn phụ huynh, phân lớp', async () => {
    const passed = await passedApplication({
      child_national_id: nextNationalId(),
      child_has_allergies: true,
      child_allergies: 'Tôm',
    });
    const fileId = await upload(token('manager'), units['ĐT-A1'] ?? '');
    const converted = await api('POST', `/admission-applications/${passed.id}/convert`, token('manager'), {
      class_id: classes['MAM-1'],
      birth_certificate_file_id: fileId,
    });
    assert.equal(converted.status, 200, JSON.stringify(converted.body));
    const result = converted.body as {
      application: { status: string; created_child_id: string };
      child: {
        id: string;
        status: string;
        current_class: { class_id: string } | null;
        guardians: Array<{ phone: string; has_account: boolean; is_primary: boolean }>;
      };
      approval_error: string | null;
    };
    assert.equal(result.approval_error, null);
    assert.equal(result.application.status, 'converted');
    assert.equal(result.application.created_child_id, result.child.id);
    assert.equal(result.child.status, 'active');
    assert.equal(result.child.current_class?.class_id, classes['MAM-1']);
    assert.deepEqual(
      result.child.guardians.map((guardian) => [guardian.phone, guardian.has_account, guardian.is_primary]),
      [[passed.phone, true, true]],
    );
    // Hồ sơ trẻ là hồ sơ thường của QT-01: có hồ sơ sức khỏe, lịch sử lớp, xem được ở trang Hồ sơ trẻ
    const child = await api('GET', `/children/${result.child.id}`, token('manager'));
    assert.equal(child.status, 200);
    assert.equal((child.body.health as { allergies: string }).allergies, 'Tôm');
    assert.equal(
      (
        await api('POST', `/admission-applications/${passed.id}/convert`, token('manager'), {
          class_id: classes['MAM-1'],
          birth_certificate_file_id: fileId,
        })
      ).status,
      422,
    );
    const lookup = await publicApi('GET', `/admission-applications/lookup?code=${passed.code}&phone=${passed.phone}`);
    assert.equal(lookup.body.status, 'converted');
  });

  it('CT-220 P16-04: nhân viên tuyển sinh chuyển hồ sơ đạt thì hồ sơ trẻ chờ quản lý đơn vị duyệt; thiếu số định danh bị báo', async () => {
    const passed = await passedApplication();
    const fileId = await upload(token('admissions'), units['ĐT-A1'] ?? '');
    const missing = await api('POST', `/admission-applications/${passed.id}/convert`, token('admissions'), {
      class_id: classes['MAM-1'],
      birth_certificate_file_id: fileId,
    });
    assert.equal(missing.status, 400);
    assert.ok(errorOf(missing.body).details?.some((detail) => detail.field === 'national_id'));
    const otherUnitClass = await api('POST', `/admission-applications/${passed.id}/convert`, token('admissions'), {
      class_id: classes['MAM-B'],
      national_id: nextNationalId(),
      birth_certificate_file_id: fileId,
    });
    assert.equal(otherUnitClass.status, 400);
    const converted = await api('POST', `/admission-applications/${passed.id}/convert`, token('admissions'), {
      class_id: classes['MAM-1'],
      national_id: nextNationalId(),
      birth_certificate_file_id: fileId,
    });
    assert.equal(converted.status, 200, JSON.stringify(converted.body));
    const child = (converted.body as { child: { id: string; status: string } }).child;
    assert.equal(child.status, 'pending');
    const approved = await api('POST', `/children/${child.id}/approve`, token('manager'), {
      class_id: classes['MAM-1'],
    });
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    assert.equal(approved.body.status, 'active');
  });

  it('CT-219 P16-03: đủ chỉ tiêu thì không xét đạt thêm; đóng đợt thì thôi nhận hồ sơ trực tuyến', async () => {
    // Chỉ tiêu 3: đã đạt hoặc đã chuyển 2 hồ sơ ở các ca trước
    await passedApplication();
    const submitted = await publicApi('POST', '/admission-applications', applicationBody());
    const id = (
      (await api('GET', `/admission-applications?q=${submitted.body.code}`, token('admissions')))
        .body as unknown as Array<{
        id: string;
      }>
    )[0]?.id;
    await api('POST', `/admission-applications/${id}/receive`, token('admissions'));
    const overQuota = await api('POST', `/admission-applications/${id}/approve`, token('manager'), {});
    assert.equal(overQuota.status, 422);
    assert.equal(errorOf(overQuota.body).rule_code, 'P16-03');
    const lowered = await api('PATCH', `/admission-campaigns/${campaignId}`, token('admissions'), { quota: 2 });
    assert.equal(lowered.status, 422);
    assert.equal((await api('POST', `/admission-campaigns/${campaignId}/close`, token('admissions'))).status, 200);
    const closed = await publicApi('POST', '/admission-applications', applicationBody());
    assert.equal(closed.status, 422);
    const listed = (await publicApi('GET', '/admissions')).body.campaigns as Array<{ id: string }>;
    assert.ok(!listed.some((campaign) => campaign.id === campaignId));
  });

  it('Chuyển năm học: đợt còn mở cùng tin và hồ sơ chưa xong được chuyển, số hồ sơ đánh tiếp', async () => {
    const reopened = await api('POST', '/admission-campaigns', token('admissions'), {
      org_unit_id: units['ĐT-A1'],
      name: 'Tuyển sinh bổ sung',
      quota: 5,
      open_from: vietnamToday,
      open_to: addDays(vietnamToday, 10),
    });
    await api('POST', `/admission-campaigns/${reopened.body.id}/open`, token('admissions'));
    campaignId = reopened.body.id as string;
    const pending = await publicApi('POST', '/admission-applications', applicationBody());
    assert.equal(pending.status, 201);
    const nextName = `${environment.schoolYearDatabasePrefix}admissions_next`;
    await createEmptyDatabase(environment.systemDatabaseUrl, nextName);
    const nextUrl = replaceDatabaseName(environment.systemDatabaseUrl, nextName);
    const migrated = await migrateToLatest('school-year', nextUrl);
    assert.equal(migrated.error, undefined);
    const next = createDatabase<SchoolYearDatabase>(nextUrl);
    try {
      for (const row of await schoolYear.selectFrom('org_units').selectAll().execute()) {
        await next.insertInto('org_units').values(row).execute();
      }
      for (const row of await schoolYear.selectFrom('catalog_items').selectAll().execute()) {
        await next
          .insertInto('catalog_items')
          .values({ ...row, attributes: JSON.stringify(row.attributes) })
          .execute();
      }
      await admissionsTransitionStep.carryOver?.({
        previousDatabase: schoolYear as Kysely<unknown>,
        newDatabase: next as Kysely<unknown>,
        academicYear: { id: 'next', startDate: vietnamToday },
        actorUserId: principal.userId,
      });
      const campaigns = await next.selectFrom('admission_campaigns').select(['id', 'status']).execute();
      assert.deepEqual(campaigns, [{ id: campaignId, status: 'open' }]);
      const applications = await next.selectFrom('admission_applications').select(['code', 'status']).execute();
      assert.deepEqual(applications, [{ code: pending.body.code, status: 'submitted' }]);
      const sequence = await next
        .selectFrom('document_sequences')
        .select('last_value')
        .where('document_type', '=', 'admission_application')
        .executeTakeFirstOrThrow();
      assert.equal(sequence.last_value, Number(String(pending.body.code).slice(3)));
    } finally {
      await next.destroy();
    }
  });

  it('CT-221: điểm cuối công khai giới hạn số lần nộp hồ sơ trên một địa chỉ mạng', async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 12; attempt += 1) {
      statuses.push((await publicApi('POST', '/admission-applications', {})).status);
    }
    assert.ok(statuses.includes(429), JSON.stringify(statuses));
    const limited = await publicApi('POST', '/admission-applications', {});
    assert.equal(errorOf(limited.body).code, 'ERR_RATE_LIMIT');
  });
});
