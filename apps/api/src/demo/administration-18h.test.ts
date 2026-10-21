import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import {
  createDatabase,
  createEmptyDatabase,
  dropDatabaseIfExists,
  listDatabasesWithPrefix,
  migrateToLatest,
  readConnectionString,
  replaceDatabaseName,
  type IdentityDatabase,
  type SystemDatabase,
} from '@school-management/database';
import { createTestUser, postJson } from '@school-management/identity/testing';
import type { Kysely } from 'kysely';
import { ExportJobs } from '../exports/export-jobs.js';
import { MemoryFileStorage } from '../files/file-storage.js';
import { readZipEntries, ZipWriter } from '../school-data-export/zip-writer.js';
import { isSecretColumn, toCsv } from '../school-data-export/school-data-archive.js';
import { RecordingSmsGateway } from '../notifications/sms-gateway.js';
import { openTestAcademicYear, sendJson, startApiTestEnvironment, type ApiTestEnvironment } from '../test-support.js';
import { DemoAwareSmsGateway, DemoMode } from './demo-mode.js';
import { DemoGuardError, resetDemoEnvironment } from './demo-seed.js';
import { DEMO_USERS } from './demo-data.js';

// Quản trị và trình diễn (DT-18 phần 18h, YCTD-145): đăng nhập thay, gói ZIP toàn bộ dữ liệu, bản trình diễn. Kịch bản
// CT-18h-1 đến CT-18h-9
const errorOf = (body: Record<string, unknown>) =>
  (body.error ?? {}) as { code?: string; rule_code?: string; message?: string };

describe('Đăng nhập thay và gói toàn bộ dữ liệu', () => {
  let environment: ApiTestEnvironment;
  let principal: { userId: string; accessToken: string };
  let unitId: string;
  const api = (method: string, path: string, token: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, token, body);
  const identity = (method: string, path: string, token: string, body?: unknown) =>
    sendJson(method, `${environment.identity.baseUrl}${path}`, token, body);

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
      first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    });
    await api('POST', '/org-units', principal.accessToken, {
      code: 'TC',
      name: 'Trường chính',
      unit_type: 'truong_chinh',
    });
    unitId = (
      await api('POST', '/org-units', principal.accessToken, { code: 'DT-A', name: 'Điểm A', unit_type: 'diem_truong' })
    ).body.id as string;
  });

  after(async () => {
    await environment.close();
  });

  async function impersonate(actorToken: string, targetId: string, reason = 'Hỗ trợ người dùng xem lỗi') {
    return identity('POST', '/auth/impersonation', actorToken, { user_id: targetId, reason });
  }

  it('CT-18h-1: Hiệu trưởng đăng nhập thay giáo viên: phiên mới của giáo viên có thông tin đăng nhập thay, thao tác ghi nhật ký kèm người đăng nhập thay, thoát thì quay về phiên của Hiệu trưởng', async () => {
    const teacher = await environment.loginAs('VT-03', unitId);
    const started = await impersonate(principal.accessToken, teacher.userId);
    assert.equal(started.status, 200, JSON.stringify(started.body));
    const token = started.body.access_token as string;
    const me = await identity('GET', '/auth/me', token);
    assert.equal(me.body.id, teacher.userId);
    const info = me.body.impersonation as { impersonator_id: string; impersonator_name: string; expires_at: string };
    assert.equal(info.impersonator_id, principal.userId);
    assert.ok(new Date(info.expires_at).getTime() - Date.now() <= 60 * 60_000);

    const created = await api('POST', '/rooms', token, {
      org_unit_id: unitId,
      code: 'P-HT',
      name: 'Phòng hỗ trợ',
      capacity: 20,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const actions = await environment.system
      .selectFrom('impersonation_actions')
      .selectAll()
      .where('impersonation_id', '=', started.body.impersonation_id as string)
      .execute();
    assert.equal(actions.length, 1);
    assert.equal(actions[0]?.method, 'POST');
    assert.equal(actions[0]?.path, '/api/v1/rooms');
    assert.equal(actions[0]?.status_code, 201);
    assert.equal(actions[0]?.impersonator_user_id, principal.userId);

    const exited = await identity('POST', '/auth/impersonation/exit', token);
    assert.equal(exited.status, 200, JSON.stringify(exited.body));
    assert.equal(exited.body.signed_out, false);
    const back = await identity('GET', '/auth/me', exited.body.access_token as string);
    assert.equal(back.body.id, principal.userId);
    assert.equal(back.body.impersonation, null);
    assert.equal((await identity('GET', '/auth/me', token)).status, 401);

    const log = await identity('GET', '/auth/impersonations', exited.body.access_token as string);
    assert.equal(log.status, 200);
    const row = (log.body.items as Array<{ id: string; status: string; reason: string }>).find(
      (item) => item.id === started.body.impersonation_id,
    );
    assert.equal(row?.status, 'exit');
    assert.equal(row?.reason, 'Hỗ trợ người dùng xem lỗi');
    const listed = await api('GET', `/impersonation-actions?impersonation_id=${row?.id ?? ''}`, principal.accessToken);
    assert.equal((listed.body.items as unknown[]).length, 1);
  });

  it('CT-18h-2: không đăng nhập thay tài khoản có quyền cao hơn, quản trị khác, Quản trị nền tảng, chính mình; người không có quyền bị từ chối; phải ghi lý do; không lồng nhau', async () => {
    const otherPrincipal = await environment.loginAs('VT-02', null);
    const platform = await environment.loginAs('VT-01', null);
    const teacher = await environment.loginAs('VT-07', unitId);
    for (const target of [otherPrincipal.userId, platform.userId, principal.userId]) {
      const refused = await impersonate(principal.accessToken, target);
      assert.equal(refused.status, 422, JSON.stringify(refused.body));
      assert.equal(errorOf(refused.body).rule_code, 'YCTD-145');
    }
    const manager = await environment.loginAs('VT-03', unitId);
    assert.equal((await impersonate(manager.accessToken, teacher.userId)).status, 403);
    assert.equal((await impersonate(principal.accessToken, teacher.userId, 'ab')).status, 400);
    // Nhóm tự tạo chỉ có quyền đăng nhập thay xếp ngang vai trò thường: không vào được tài khoản giáo viên (ngang hàng)
    const database = environment.identity.database;
    const role = await database
      .insertInto('roles')
      .values({ code: `NHOM-HO-TRO-${randomUUID().slice(0, 8)}`, name: 'Nhóm hỗ trợ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    const permission = await database
      .selectFrom('permissions')
      .select('id')
      .where('code', '=', 'P01.account.impersonate')
      .executeTakeFirstOrThrow();
    await database.insertInto('role_permissions').values({ role_id: role.id, permission_id: permission.id }).execute();
    const helperUser = await createTestUser(database);
    await database
      .insertInto('user_roles')
      .values({ user_id: helperUser.id, role_id: role.id, org_unit_id: null })
      .execute();
    const helper = await postJson(`${environment.identity.baseUrl}/auth/login`, {
      login: helperUser.username,
      password: helperUser.password,
      channel: 'portal',
    });
    const higher = await impersonate(helper.body.access_token as string, teacher.userId);
    assert.equal(higher.status, 422, JSON.stringify(higher.body));
    assert.match(errorOf(higher.body).message ?? '', /ngang hoặc cao hơn/);
    // Hiệu trưởng vào được tài khoản Quản lý đơn vị dù vai trò đó có quyền nghiệp vụ Hiệu trưởng không có
    const unitManager = await environment.loginAs('VT-03', unitId);
    const allowed = await impersonate(principal.accessToken, unitManager.userId);
    assert.equal(allowed.status, 200, JSON.stringify(allowed.body));
    await identity('POST', '/auth/impersonation/exit', allowed.body.access_token as string);
    const deputy = await environment.loginAs('VT-15', unitId);
    const started = await impersonate(principal.accessToken, deputy.userId);
    assert.equal(started.status, 200);
    const nested = await impersonate(started.body.access_token as string, teacher.userId);
    assert.ok([403, 422].includes(nested.status), JSON.stringify(nested.body));
    await identity('POST', '/auth/impersonation/exit', started.body.access_token as string);
  });

  it('CT-18h-3: trong phiên đăng nhập thay không đổi được mật khẩu, không đặt lại mật khẩu, không thao tác chứng thư số, không xuất toàn bộ dữ liệu', async () => {
    // Tài khoản thuộc nhóm tự tạo có quyền chứng thư số (Hiệu trưởng cũng có nên không phải quyền cao hơn)
    const database = environment.identity.database;
    const role = await database
      .insertInto('roles')
      .values({ code: `NHOM-KY-SO-${randomUUID().slice(0, 8)}`, name: 'Nhóm kí số' })
      .returning('id')
      .executeTakeFirstOrThrow();
    for (const code of ['P01.signing.certificate', 'P01.signing.view']) {
      const permission = await database
        .selectFrom('permissions')
        .select('id')
        .where('code', '=', code)
        .executeTakeFirstOrThrow();
      await database
        .insertInto('role_permissions')
        .values({ role_id: role.id, permission_id: permission.id })
        .execute();
    }
    const manager = await environment.loginAs('VT-03', unitId);
    await database
      .insertInto('user_roles')
      .values({ user_id: manager.userId, role_id: role.id, org_unit_id: null })
      .execute();
    const started = await impersonate(principal.accessToken, manager.userId);
    assert.equal(started.status, 200, JSON.stringify(started.body));
    const token = started.body.access_token as string;
    const changed = await identity('POST', '/auth/change-password', token, {
      current_password: 'MatKhau2026',
      new_password: 'MatKhauMoi2026',
    });
    assert.equal(changed.status, 403);
    assert.match(errorOf(changed.body).message ?? '', /Đang đăng nhập thay/);
    assert.equal((await identity('POST', `/users/${manager.userId}/reset-password`, token)).status, 403);
    const certificate = await api('PUT', '/signing/certificate', token, { provider: 'VNPT-CA' });
    assert.equal(certificate.status, 403);
    assert.match(errorOf(certificate.body).message ?? '', /Đang đăng nhập thay/);
    assert.equal((await api('POST', '/school-data-exports', token)).status, 403);
    const blocked = await environment.system
      .selectFrom('impersonation_actions')
      .select('status_code')
      .where('impersonation_id', '=', started.body.impersonation_id as string)
      .execute();
    assert.equal(blocked.length, 0, 'thao tác bị chặn trước khi tới phân hệ thì không ghi là thao tác');
    await identity('POST', '/auth/impersonation/exit', token);
  });

  it('CT-18h-4: đăng xuất trong lúc đăng nhập thay kết thúc đăng nhập thay và đăng xuất cả phiên của quản trị', async () => {
    const admin = await environment.loginAs('VT-02', null);
    const teacher = await environment.loginAs('VT-07', unitId);
    const started = await impersonate(admin.accessToken, teacher.userId);
    const token = started.body.access_token as string;
    assert.equal((await postJson(`${environment.identity.baseUrl}/auth/logout`, {}, token)).status, 204);
    assert.equal((await identity('GET', '/auth/me', admin.accessToken)).status, 401);
    const row = await environment.identity.database
      .selectFrom('impersonations')
      .select('end_reason')
      .where('id', '=', started.body.impersonation_id as string)
      .executeTakeFirstOrThrow();
    assert.equal(row.end_reason, 'logout');
  });

  it('CT-18h-5: gói ZIP toàn bộ dữ liệu: tạo tác vụ nền, tiến trình nền dựng gói có CSV các cơ sở dữ liệu, tệp đính kèm, dữ liệu tài khoản không có mật khẩu; chỉ người tạo tải được, hạn 48 giờ, ghi nhật ký xuất và nhật ký tải', async () => {
    const manager = await environment.loginAs('VT-03', unitId);
    assert.equal((await api('POST', '/school-data-exports', manager.accessToken)).status, 403);
    const requested = await api('POST', '/school-data-exports', principal.accessToken);
    assert.equal(requested.status, 202, JSON.stringify(requested.body));
    const job = requested.body.job as { id: string; status: string };
    assert.equal(job.status, 'pending');
    const again = await api('POST', '/school-data-exports', principal.accessToken);
    assert.equal(again.status, 422);
    await environment.api.get(ExportJobs).tick();
    const listed = await api('GET', '/school-data-exports', principal.accessToken);
    const done = (
      listed.body.items as Array<{
        id: string;
        status: string;
        expires_at: string;
        finished_at: string;
        download_count: number;
      }>
    ).find((item) => item.id === job.id);
    assert.equal(done?.status, 'done', JSON.stringify(listed.body));
    assert.equal(new Date(done.expires_at).getTime() - new Date(done.finished_at).getTime(), 48 * 60 * 60_000);

    const other = await environment.loginAs('VT-02', null);
    assert.equal(
      (
        await fetch(`${environment.baseUrl}/export-jobs/${job.id}/file`, {
          headers: { authorization: `Bearer ${other.accessToken}` },
        })
      ).status,
      404,
    );
    const response = await fetch(`${environment.baseUrl}/export-jobs/${job.id}/file`, {
      headers: { authorization: `Bearer ${principal.accessToken}` },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/zip');
    const entries = await readZipEntries(Buffer.from(await response.arrayBuffer()));
    assert.ok(entries.has('manifest.json'));
    assert.ok(entries.has('DOC_TRUOC.txt'));
    assert.ok(entries.has('du-lieu/he-thong/academic_years.csv'));
    assert.ok(
      [...entries.keys()].some(
        (name) => name.startsWith('du-lieu/nam-hoc-2026-2027/') && name.endsWith('org_units.csv'),
      ),
    );
    const users = entries.get('du-lieu/dinh-danh/users.csv')?.toString('utf8') ?? '';
    assert.match(users, /full_name/);
    assert.doesNotMatch(users, /password_hash|\$argon2/);
    const manifest = JSON.parse(entries.get('manifest.json')?.toString('utf8') ?? '{}') as {
      tables: Array<{ source: string; table: string; omitted_columns: string[] }>;
    };
    assert.ok(
      manifest.tables.find((table) => table.table === 'children')?.omitted_columns.includes('national_id_encrypted'),
    );

    const downloads = await environment.system
      .selectFrom('export_job_downloads')
      .select(['user_id'])
      .where('export_job_id', '=', job.id)
      .execute();
    assert.deepEqual(downloads, [{ user_id: principal.userId }]);
    const relisted = await api('GET', '/school-data-exports', principal.accessToken);
    assert.equal(
      (relisted.body.items as Array<{ id: string; download_count: number }>).find((item) => item.id === job.id)
        ?.download_count,
      1,
    );
  });
});

describe('Ghi gói ZIP, CSV, chặn gửi khi là bản trình diễn', () => {
  it('CT-18h-6: tệp ZIP đọc lại đúng tên tiếng Việt và nội dung; CSV thoát dấu phẩy, ngoặc kép, xuống dòng; cột bí mật không xuất', async () => {
    const zip = new ZipWriter(new Date('2026-10-21T03:00:00Z'));
    zip.add('du-lieu/Bảng thử.csv', 'a,b\r\n1,2\r\n');
    zip.add('tep/anh.png', Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const entries = await readZipEntries(zip.finish());
    assert.equal(entries.get('du-lieu/Bảng thử.csv')?.toString('utf8'), 'a,b\r\n1,2\r\n');
    assert.deepEqual([...(entries.get('tep/anh.png') ?? [])], [0x89, 0x50, 0x4e, 0x47]);
    const csv = toCsv(
      ['ten', 'ghi_chu', 'du_lieu'],
      [{ ten: 'Nguyễn, An', ghi_chu: 'nói "xin chào"\nxuống dòng', du_lieu: { a: 1 } }],
    );
    assert.equal(csv, '﻿ten,ghi_chu,du_lieu\r\n"Nguyễn, An","nói ""xin chào""\nxuống dòng","{""a"":1}"\r\n');
    for (const column of [
      'password_hash',
      'national_id_encrypted',
      'access_token_encrypted',
      'key_hash',
      'national_id_hash',
    ]) {
      assert.equal(isSecretColumn(column), true, column);
    }
    assert.equal(isSecretColumn('full_name'), false);
  });

  it('CT-18h-7: bản trình diễn không gửi tin nhắn thật; không phải bản trình diễn thì gửi như thường', async () => {
    const inner = new RecordingSmsGateway();
    let demo = true;
    const mode = { isEnabled: async () => demo } as unknown as DemoMode;
    const gateway = new DemoAwareSmsGateway(inner, mode);
    await gateway.send('0900000001', 'Tin thử');
    assert.equal(inner.messages.length, 0);
    demo = false;
    await gateway.send('0900000001', 'Tin thử');
    assert.equal(inner.messages.length, 1);
  });
});

describe('Bản trình diễn', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
  const baseUrl = readConnectionString('system');
  const systemName = `school_system_demo_${suffix}`;
  const identityName = `school_identity_demo_${suffix}`;
  const yearPrefix = `school_year_demo_${suffix}_`;
  const systemUrl = replaceDatabaseName(baseUrl, systemName);
  const identityUrl = replaceDatabaseName(baseUrl, identityName);
  let identity: Kysely<IdentityDatabase>;
  const configuration = () => ({
    tokenPublicKeyPem: '',
    identityBaseUrl: 'http://127.0.0.1:9',
    systemDatabaseUrl: systemUrl,
    schoolYearDatabasePrefix: yearPrefix,
    childDataEncryptionKey: randomBytes(32),
    childDataHashKey: randomBytes(32),
    objectStorage: null,
  });

  before(async () => {
    await createEmptyDatabase(baseUrl, systemName);
    await createEmptyDatabase(baseUrl, identityName);
    for (const [kind, url] of [
      ['system', systemUrl],
      ['identity', identityUrl],
    ] as const) {
      const migration = await migrateToLatest(kind, url);
      if (migration.error) {
        throw migration.error;
      }
    }
    identity = createDatabase<IdentityDatabase>(identityUrl);
  });

  after(async () => {
    await identity.destroy();
    for (const name of await listDatabasesWithPrefix(baseUrl, yearPrefix)) {
      await dropDatabaseIfExists(baseUrl, name);
    }
    await dropDatabaseIfExists(baseUrl, systemName);
    await dropDatabaseIfExists(baseUrl, identityName);
  });

  it('CT-18h-8: lệnh tạo dữ liệu trình diễn chạy trên cơ sở dữ liệu trống: tạo đủ các bước, đánh dấu bản trình diễn, trang chọn vai có tài khoản; đặt lại lần hai xóa dữ liệu cũ và tạo lại', async () => {
    const logs: string[] = [];
    const first = await resetDemoEnvironment({
      configuration: configuration(),
      identityDatabaseUrl: identityUrl,
      resetIntervalHours: 24,
      fileStorage: new MemoryFileStorage(),
      log: (message) => logs.push(message),
    });
    assert.deepEqual(
      first.report.steps.filter((item) => !item.ok),
      [],
      logs.join('\n'),
    );
    const system = createDatabase<SystemDatabase>(systemUrl);
    try {
      const marker = await system.selectFrom('demo_environment').selectAll().executeTakeFirstOrThrow();
      assert.equal(marker.reset_interval_hours, 24);
      assert.ok(marker.accounts.some((account) => account.login === 'demo.hieutruong'));
      const login = await identity
        .selectFrom('users')
        .select('id')
        .where('username', '=', 'demo.giaovien1')
        .executeTakeFirst();
      assert.ok(login);
    } finally {
      await system.destroy();
    }
    const firstUsers = await identity.selectFrom('users').select('id').execute();
    const second = await resetDemoEnvironment({
      configuration: configuration(),
      identityDatabaseUrl: identityUrl,
      resetIntervalHours: 12,
      fileStorage: new MemoryFileStorage(),
      log: () => undefined,
    });
    assert.ok(second.report.steps.every((item) => item.ok));
    const secondUsers = await identity.selectFrom('users').select('id').execute();
    assert.equal(secondUsers.length, firstUsers.length);
    assert.ok(!secondUsers.some((row) => firstUsers.some((old) => old.id === row.id)), 'tài khoản cũ đã bị xóa');
    assert.ok(DEMO_USERS.length > 0);
  });

  it('CT-18h-9: lệnh từ chối chạy trên cơ sở dữ liệu có dữ liệu mà chưa đánh dấu bản trình diễn, không xóa gì', async () => {
    const otherSystem = `school_system_real_${suffix}`;
    const otherIdentity = `school_identity_real_${suffix}`;
    await createEmptyDatabase(baseUrl, otherSystem);
    await createEmptyDatabase(baseUrl, otherIdentity);
    const otherSystemUrl = replaceDatabaseName(baseUrl, otherSystem);
    const otherIdentityUrl = replaceDatabaseName(baseUrl, otherIdentity);
    try {
      await migrateToLatest('system', otherSystemUrl);
      await migrateToLatest('identity', otherIdentityUrl);
      const realIdentity = createDatabase<IdentityDatabase>(otherIdentityUrl);
      try {
        await createTestUser(realIdentity, { roles: [{ roleCode: 'VT-07', orgUnitId: null }] });
        await assert.rejects(
          resetDemoEnvironment({
            configuration: { ...configuration(), systemDatabaseUrl: otherSystemUrl },
            identityDatabaseUrl: otherIdentityUrl,
            resetIntervalHours: 24,
            fileStorage: new MemoryFileStorage(),
            log: () => undefined,
          }),
          DemoGuardError,
        );
        assert.equal((await realIdentity.selectFrom('users').select('id').execute()).length, 1);
      } finally {
        await realIdentity.destroy();
      }
    } finally {
      await dropDatabaseIfExists(baseUrl, otherSystem);
      await dropDatabaseIfExists(baseUrl, otherIdentity);
    }
  });
});
