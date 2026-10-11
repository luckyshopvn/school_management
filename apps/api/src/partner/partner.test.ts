import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
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

// Khóa API cho đối tác chỉ đọc (DT-07 phần 7b, YCTD-63); kịch bản CT-151, CT-152, CT-167 và quy tắc BM-65, BM-66
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

describe('Khóa API cho đối tác', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  const createdClientIds: string[] = [];

  const createKey = async (accessToken: string, body: Record<string, unknown>) => {
    const response = await sendJson('POST', `${environment.identity.baseUrl}/api-clients`, accessToken, {
      name: 'Phòng Giáo dục quận',
      partner_type: 'Cơ quan quản lý',
      allowed_ips: ['127.0.0.1', '::1'],
      valid_until: addDays(vietnamToday, 90),
      ...body,
    });
    if (response.status === 201) {
      createdClientIds.push(response.body.id as string);
    }
    return response;
  };
  const partnerGet = async (path: string, key: string | null) => {
    const response = await fetch(`${environment.baseUrl}/partner${path}`, {
      headers: key ? { 'x-api-key': key } : {},
    });
    return { status: response.status, body: (await response.json()) as unknown };
  };

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
      first_term: { start_date: addDays(vietnamToday, -30), end_date: addDays(vietnamToday, 90) },
      second_term: { start_date: addDays(vietnamToday, 95), end_date: addDays(vietnamToday, 200) },
    });
    const yearDatabase = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, yearDatabase.database_name),
    );
    const unit = await sendJson('POST', `${environment.baseUrl}/org-units`, principal.accessToken, {
      code: 'TC',
      name: 'Trường chính',
      unit_type: 'truong_chinh',
    });
    await schoolYear
      .insertInto('children')
      .values({
        org_unit_id: unit.body.id as string,
        full_name: 'Nguyễn An',
        dob: '2022-05-01',
        gender: 'male',
        national_id_encrypted: 'ma-hoa',
        national_id_hash: randomUUID(),
        national_id_last4: '9999',
        photo_consent: 'pending',
        status: 'active',
      })
      .execute();
  });

  after(async () => {
    // Trả lại dữ liệu dùng chung của cơ sở dữ liệu định danh
    if (createdClientIds.length > 0) {
      await environment.identity.database
        .deleteFrom('identity_audit_logs')
        .where('entity_id', 'in', createdClientIds)
        .execute();
      await environment.identity.database.deleteFrom('api_clients').where('id', 'in', createdClientIds).execute();
    }
    await schoolYear.destroy();
    await environment.close();
  });

  it('BM-65: chỉ Hiệu trưởng cấp khóa; phạm vi dữ liệu cá nhân bắt buộc căn cứ pháp lý; khóa chỉ hiện một lần', async () => {
    const manager = await environment.loginAs('VT-03', null);
    assert.equal((await createKey(manager.accessToken, { scopes: ['reports'] })).status, 403);
    assert.equal((await createKey(principal.accessToken, { scopes: ['children'] })).status, 400);
    assert.equal(
      (await createKey(principal.accessToken, { scopes: ['reports'], valid_until: vietnamToday })).status,
      400,
    );
    const created = await createKey(principal.accessToken, { scopes: ['reports'] });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.match(created.body.api_key as string, /^sm_/);
    const listed = await sendJson('GET', `${environment.identity.baseUrl}/api-clients`, principal.accessToken);
    const text = JSON.stringify(listed.body);
    assert.ok(!text.includes(created.body.api_key as string));
    assert.ok(!text.includes('key_hash'));
  });

  it('CT-151: khóa phạm vi báo cáo đọc được báo cáo tổng hợp, gọi danh sách trẻ bị từ chối; thiếu khóa bị từ chối', async () => {
    const key = (await createKey(principal.accessToken, { scopes: ['reports'] })).body.api_key as string;
    const summary = await partnerGet('/reports/summary', key);
    assert.equal(summary.status, 200, JSON.stringify(summary.body));
    assert.equal((summary.body as { children_count: number }).children_count, 1);
    assert.equal((await partnerGet('/children', key)).status, 403);
    assert.equal((await partnerGet('/reports/summary', null)).status, 401);
    assert.equal((await partnerGet('/reports/summary', 'sm_khong_ton_tai')).status, 401);
  });

  it('CT-152: khóa phạm vi danh sách trẻ đọc dữ liệu thì có nhật ký kèm khóa và căn cứ pháp lý', async () => {
    const created = await createKey(principal.accessToken, {
      scopes: ['children', 'staff'],
      legal_basis: 'Công văn số 12 của Phòng Giáo dục',
    });
    const key = created.body.api_key as string;
    const children = await partnerGet('/children', key);
    assert.equal(children.status, 200, JSON.stringify(children.body));
    const rows = children.body as Array<{ full_name: string; guardians: unknown[] }>;
    assert.equal(rows[0]?.full_name, 'Nguyễn An');
    assert.ok(!JSON.stringify(rows).includes('ma-hoa'));
    assert.equal((await partnerGet('/staff', key)).status, 200);
    const logs = await schoolYear
      .selectFrom('data_access_logs')
      .select(['api_client_id', 'scope', 'record_count', 'purpose'])
      .where('api_client_id', '=', created.body.id as string)
      .orderBy('created_at')
      .execute();
    assert.deepEqual(
      logs.map((row) => [row.scope, row.record_count, row.purpose]),
      [
        ['partner:children', 1, 'Công văn số 12 của Phòng Giáo dục'],
        ['partner:staff', 0, 'Công văn số 12 của Phòng Giáo dục'],
      ],
    );
  });

  it('CT-167, BM-65: khóa thu hồi, sai địa chỉ mạng đều bị từ chối ngay; vượt 60 yêu cầu mỗi phút bị chặn', async () => {
    const created = await createKey(principal.accessToken, { scopes: ['reports', 'finance'] });
    const key = created.body.api_key as string;
    const finance = await partnerGet(`/finance?from=${addDays(vietnamToday, -30)}&to=${vietnamToday}`, key);
    assert.equal(finance.status, 200, JSON.stringify(finance.body));
    const revoked = await sendJson(
      'POST',
      `${environment.identity.baseUrl}/api-clients/${created.body.id}/revoke`,
      principal.accessToken,
    );
    assert.equal(revoked.status, 200);
    assert.equal((await partnerGet('/reports/summary', key)).status, 401);

    const remote = await createKey(principal.accessToken, { scopes: ['reports'], allowed_ips: ['10.0.0.1'] });
    assert.equal((await partnerGet('/reports/summary', remote.body.api_key as string)).status, 401);

    const limited = (await createKey(principal.accessToken, { scopes: ['reports'] })).body.api_key as string;
    let lastStatus = 0;
    for (let index = 0; index < 61; index += 1) {
      lastStatus = (await partnerGet('/reports/summary', limited)).status;
    }
    assert.equal(lastStatus, 429);
  });
});
