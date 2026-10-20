import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import { CurrentSchoolYearResolver } from './common/current-school-year.js';
import { openTestAcademicYear, sendJson, startApiTestEnvironment, type ApiTestEnvironment } from './test-support.js';

// Quản trị hệ thống đủ theo Sở (DT-16 phần 16d): 1.1 sửa, xóa, hiệu lực nhóm người dùng; 1.2 phân hệ của nhóm; 1.4 lọc
// mã định danh, hạn mật khẩu, mã nhân sự, mã Bộ, Phân nhóm quyền, Cấp mật khẩu, Lấy danh sách CBQL/GV, Xuất Excel; 1.6 tài
// khoản đồng bộ của Bộ, của Sở. Kịch bản CT-16d-1 đến CT-16d-10. Cơ sở dữ liệu định danh dùng chung giữa các tệp kiểm thử
// nên tài khoản, nhóm tạo ở đây mang nhãn riêng và được xóa khi xong
describe('Quản trị hệ thống đủ theo Sở', () => {
  let environment: ApiTestEnvironment;
  let principal: string;
  let principalId: string;
  let identityUrl = '';
  let schoolYear: Kysely<SchoolYearDatabase>;
  const units: Record<string, string> = {};
  const tag = `Qt16d${randomUUID().replaceAll('-', '').slice(0, 8)}`;
  const createdUsers: string[] = [];
  const createdRoles: string[] = [];

  async function roleId(code: string): Promise<string> {
    const row = await environment.identity.database
      .selectFrom('roles')
      .select('id')
      .where('code', '=', code)
      .executeTakeFirstOrThrow();
    return row.id;
  }

  async function insertUser(key: string, roles: Array<{ roleCode: string; unit: string | null }>) {
    const database = environment.identity.database;
    const user = await database
      .insertInto('users')
      .values({
        full_name: `${tag} ${key}`,
        username: `${tag.toLowerCase()}_${key.toLowerCase()}`,
        password_hash: null,
        must_change_password: false,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    for (const role of roles) {
      await database
        .insertInto('user_roles')
        .values({
          user_id: user.id,
          role_id: await roleId(role.roleCode),
          org_unit_id: role.unit ? (units[role.unit] ?? null) : null,
        })
        .execute();
    }
    createdUsers.push(user.id);
    return user.id;
  }

  async function createRole(code: string) {
    const response = await sendJson('POST', `${identityUrl}/roles`, principal, { code, name: `${tag} ${code}` });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    createdRoles.push(response.body.id as string);
    return response.body as unknown as { id: string; code: string; is_active: boolean; workspaces: string[] };
  }

  async function insertStaff(
    code: string,
    options: { unit: string; userId?: string | null; moet?: string; phone?: string },
  ) {
    const row = await schoolYear
      .insertInto('staff')
      .values({
        org_unit_id: units[options.unit] ?? '',
        code,
        full_name: `${tag} NS ${code}`,
        start_date: '2026-09-01',
        user_id: options.userId ?? null,
        phone: options.phone ?? null,
        moet_staff_code: options.moet ?? null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return row.id;
  }

  before(async () => {
    environment = await startApiTestEnvironment();
    identityUrl = environment.identity.baseUrl;
    const login = await environment.loginAs('VT-02', null);
    principal = login.accessToken;
    principalId = login.userId;
    await openTestAcademicYear(environment, principal, '2026–2027', {
      first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    });
    for (const [code, type] of [
      ['TC', 'truong_chinh'],
      ['PH-A', 'phan_hieu'],
      ['PH-B', 'phan_hieu'],
    ] as const) {
      const created = await sendJson('POST', `${environment.baseUrl}/org-units`, principal, {
        code,
        name: code,
        unit_type: type,
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      units[code] = created.body.id as string;
    }
    schoolYear = (await environment.api.get(CurrentSchoolYearResolver).require()).database;
  });

  after(async () => {
    const database = environment.identity.database;
    const usernames = await database.selectFrom('users').select('id').where('full_name', 'like', `${tag}%`).execute();
    const ids = [...new Set([...createdUsers, ...usernames.map((row) => row.id)])];
    if (ids.length > 0) {
      await database.deleteFrom('sessions').where('user_id', 'in', ids).execute();
      await database.deleteFrom('user_roles').where('user_id', 'in', ids).execute();
      await database.deleteFrom('users').where('id', 'in', ids).execute();
    }
    if (createdRoles.length > 0) {
      await database.deleteFrom('user_roles').where('role_id', 'in', createdRoles).execute();
      await database.deleteFrom('role_permissions').where('role_id', 'in', createdRoles).execute();
      await database.deleteFrom('role_workspace_exclusions').where('role_id', 'in', createdRoles).execute();
      await database.deleteFrom('roles').where('id', 'in', createdRoles).execute();
    }
    await environment.close();
  });

  it('CT-16d-1: sửa tên, hiệu lực nhóm; không ngừng hiệu lực, không xóa nhóm hệ thống hoặc nhóm đang có người dùng', async () => {
    const role = await createRole(`T${tag.slice(-6).toUpperCase()}A`);
    assert.equal(role.is_active, true);
    const renamed = await sendJson('PATCH', `${identityUrl}/roles/${role.id}`, principal, {
      name: `${tag} Đổi tên`,
      is_active: false,
    });
    assert.equal(renamed.status, 200, JSON.stringify(renamed.body));
    assert.equal(renamed.body.name, `${tag} Đổi tên`);
    assert.equal(renamed.body.is_active, false);

    const systemRole = await roleId('VT-07');
    const deactivate = await sendJson('PATCH', `${identityUrl}/roles/${systemRole}`, principal, { is_active: false });
    assert.equal(deactivate.status, 422);
    assert.equal(deactivate.body.error?.code, 'ERR_RULE_VIOLATION');
    assert.equal(deactivate.body.error?.rule_code, 'YCTD-120');
    const deleteSystem = await sendJson('DELETE', `${identityUrl}/roles/${systemRole}`, principal);
    assert.equal(deleteSystem.status, 422);

    await insertUser('R1', [{ roleCode: role.code, unit: 'PH-A' }]);
    const deleteUsed = await sendJson('DELETE', `${identityUrl}/roles/${role.id}`, principal);
    assert.equal(deleteUsed.status, 422);
    assert.match(String(deleteUsed.body.error?.message), /đang có 1 người dùng/);

    const unused = await createRole(`T${tag.slice(-6).toUpperCase()}B`);
    const deleted = await sendJson('DELETE', `${identityUrl}/roles/${unused.id}`, principal);
    assert.equal(deleted.status, 204);
    const roles = await sendJson('GET', `${identityUrl}/roles`, principal);
    assert.ok(!(roles.body as unknown as Array<{ id: string }>).some((item) => item.id === unused.id));
    const listed = (roles.body as unknown as Array<{ id: string; user_count: number }>).find(
      (item) => item.id === role.id,
    );
    assert.equal(listed?.user_count, 1);

    // Quản lý đơn vị không sửa được nhóm
    const manager = await environment.loginAs('VT-03', units['PH-A'] ?? null);
    const forbidden = await sendJson('PATCH', `${identityUrl}/roles/${role.id}`, manager.accessToken, { name: 'X' });
    assert.equal(forbidden.status, 403);
  });

  it('CT-16d-2: nhóm hết hiệu lực không cấp quyền cho tài khoản; có hiệu lực lại thì có quyền ngay', async () => {
    const role = await createRole(`T${tag.slice(-6).toUpperCase()}C`);
    const saved = await sendJson('PUT', `${identityUrl}/roles/${role.id}/permissions`, principal, {
      permission_codes: ['P01.view'],
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const member = await environment.loginWithRoles([{ roleCode: role.code, orgUnitId: units['PH-A'] ?? null }]);
    createdUsers.push(member.userId);
    const me = async () =>
      (await sendJson('GET', `${identityUrl}/auth/me`, member.accessToken)).body as unknown as {
        assignments: Array<{ role_code: string; permissions: string[] }>;
        workspaces: string[];
      };
    assert.deepEqual((await me()).assignments.find((item) => item.role_code === role.code)?.permissions, ['P01.view']);
    assert.ok((await me()).workspaces.includes('system'));

    await sendJson('PATCH', `${identityUrl}/roles/${role.id}`, principal, { is_active: false });
    const inactive = await me();
    assert.equal(inactive.assignments.length, 0);
    assert.deepEqual(inactive.workspaces, []);
    // Máy chủ API cũng không còn thấy quyền
    const apiDenied = await sendJson('GET', `${environment.baseUrl}/audit-logs`, member.accessToken);
    assert.equal(apiDenied.status, 403);

    await sendJson('PATCH', `${identityUrl}/roles/${role.id}`, principal, { is_active: true });
    assert.deepEqual((await me()).assignments.find((item) => item.role_code === role.code)?.permissions, ['P01.view']);
  });

  it('CT-16d-3: phân hệ của nhóm quyết định phân hệ của tài khoản; Phụ huynh không có phân hệ nào', async () => {
    const first = await createRole(`T${tag.slice(-6).toUpperCase()}D`);
    const second = await createRole(`T${tag.slice(-6).toUpperCase()}E`);
    assert.equal(first.workspaces.length, 15);
    const saved = await sendJson('PUT', `${identityUrl}/roles/${first.id}/workspaces`, principal, {
      workspace_keys: ['system', 'education'],
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    // Theo thứ tự của cây menu
    assert.deepEqual(saved.body.workspaces, ['education', 'system']);
    await sendJson('PUT', `${identityUrl}/roles/${second.id}/workspaces`, principal, { workspace_keys: ['finance'] });

    const member = await environment.loginWithRoles([
      { roleCode: first.code, orgUnitId: units['PH-A'] ?? null },
      { roleCode: second.code, orgUnitId: units['PH-A'] ?? null },
    ]);
    createdUsers.push(member.userId);
    const me = await sendJson('GET', `${identityUrl}/auth/me`, member.accessToken);
    assert.deepEqual(me.body.workspaces, ['education', 'system', 'finance']);

    const parent = await environment.loginAs('VT-14', null);
    createdUsers.push(parent.userId);
    assert.deepEqual((await sendJson('GET', `${identityUrl}/auth/me`, parent.accessToken)).body.workspaces, []);
    const principalMe = await sendJson('GET', `${identityUrl}/auth/me`, principal);
    assert.equal((principalMe.body.workspaces as string[]).length, 15);

    const invalid = await sendJson('PUT', `${identityUrl}/roles/${first.id}/workspaces`, principal, {
      workspace_keys: ['khong-co'],
    });
    assert.equal(invalid.status, 400);
  });

  it('CT-16d-4: danh sách người dùng lọc theo mã tài khoản và ngày hết hạn mật khẩu, có ngày hết hạn từng dòng', async () => {
    const database = environment.identity.database;
    const withPassword = await insertUser('P1', [{ roleCode: 'VT-07', unit: 'PH-A' }]);
    const parentOnly = await insertUser('P2', [{ roleCode: 'VT-14', unit: null }]);
    await database
      .updateTable('users')
      .set({ password_hash: 'x', password_changed_at: new Date('2026-08-01T03:00:00Z') })
      .where('id', 'in', [withPassword, parentOnly])
      .execute();
    const policy = (await sendJson('GET', `${identityUrl}/auth/settings/password-policy`, principal)).body;
    try {
      const set = await sendJson('PUT', `${identityUrl}/auth/settings/password-policy`, principal, {
        password_max_age_days: 90,
        password_expiry_warning_days: 7,
      });
      assert.equal(set.status, 200, JSON.stringify(set.body));
      const listed = await sendJson(
        'GET',
        `${identityUrl}/users?user_ids=${withPassword},${parentOnly}&page_size=50`,
        principal,
      );
      assert.equal(listed.status, 200, JSON.stringify(listed.body));
      const items = listed.body.items as Array<{ id: string; password_expires_at: string | null }>;
      assert.equal(items.length, 2);
      // 01/08/2026 + 90 ngày = 30/10/2026; tài khoản chỉ là phụ huynh không có hạn
      assert.equal(items.find((item) => item.id === withPassword)?.password_expires_at, '2026-10-30T03:00:00.000Z');
      assert.equal(items.find((item) => item.id === parentOnly)?.password_expires_at, null);

      const inRange = await sendJson(
        'GET',
        `${identityUrl}/users?full_name=${tag}&password_expires_from=2026-10-30&password_expires_to=2026-10-30`,
        principal,
      );
      assert.deepEqual(
        (inRange.body.items as Array<{ id: string }>).map((item) => item.id),
        [withPassword],
      );
      const outOfRange = await sendJson(
        'GET',
        `${identityUrl}/users?full_name=${tag}&password_expires_to=2026-10-29`,
        principal,
      );
      assert.equal(outOfRange.body.total, 0);
      const bad = await sendJson('GET', `${identityUrl}/users?user_ids=khong-phai-ma`, principal);
      assert.equal(bad.status, 400);
    } finally {
      await sendJson('PUT', `${identityUrl}/auth/settings/password-policy`, principal, policy);
    }
  });

  it('CT-16d-5: cấp mật khẩu hàng loạt: mỗi tài khoản một mật khẩu tạm, bắt đổi; bỏ qua chính mình và ngoài phạm vi', async () => {
    const first = await insertUser('M1', [{ roleCode: 'VT-07', unit: 'PH-A' }]);
    const outside = await insertUser('M2', [{ roleCode: 'VT-07', unit: 'PH-B' }]);
    const manager = await environment.loginAs('VT-03', units['PH-A'] ?? null);
    const response = await sendJson('POST', `${identityUrl}/users/bulk-reset-password`, manager.accessToken, {
      user_ids: [first, outside, manager.userId],
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const items = response.body.items as Array<{
      user_id: string;
      temporary_password: string | null;
      skipped_reason: string | null;
    }>;
    const issued = items.find((item) => item.user_id === first);
    assert.match(issued?.temporary_password ?? '', /^[A-Za-z0-9]{12}$/);
    assert.equal(items.find((item) => item.user_id === outside)?.skipped_reason, 'Tài khoản nằm ngoài phạm vi của bạn');
    assert.match(items.find((item) => item.user_id === manager.userId)?.skipped_reason ?? '', /đang đăng nhập/);
    const row = await environment.identity.database
      .selectFrom('users')
      .select(['must_change_password', 'password_hash'])
      .where('id', '=', first)
      .executeTakeFirstOrThrow();
    assert.equal(row.must_change_password, true);
    assert.ok(row.password_hash);
    // Đăng nhập được bằng mật khẩu tạm và bị bắt đổi
    const login = await sendJson('POST', `${identityUrl}/auth/login`, undefined, {
      login: `${tag.toLowerCase()}_m1`,
      password: issued?.temporary_password,
      channel: 'portal',
    });
    assert.equal(login.status, 200, JSON.stringify(login.body));
    assert.equal(login.body.password_change_required, true);
    const empty = await sendJson('POST', `${identityUrl}/users/bulk-reset-password`, principal, { user_ids: [] });
    assert.equal(empty.status, 400);
  });

  it('CT-16d-6: phân nhóm quyền hàng loạt gán thêm nhóm, bỏ qua tài khoản đã có; quản lý đơn vị không làm được', async () => {
    const first = await insertUser('G1', [{ roleCode: 'VT-07', unit: 'PH-A' }]);
    const already = await insertUser('G2', [{ roleCode: 'VT-09', unit: 'PH-A' }]);
    const response = await sendJson('POST', `${identityUrl}/users/bulk-roles`, principal, {
      user_ids: [first, already],
      role: { role_code: 'VT-09', org_unit_id: units['PH-A'] },
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const items = response.body.items as Array<{ user_id: string; added: boolean; skipped_reason: string | null }>;
    assert.equal(items.find((item) => item.user_id === first)?.added, true);
    assert.equal(items.find((item) => item.user_id === already)?.added, false);
    const roles = await environment.identity.database
      .selectFrom('user_roles')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .select('roles.code')
      .where('user_roles.user_id', '=', first)
      .execute();
    assert.deepEqual(roles.map((role) => role.code).sort(), ['VT-07', 'VT-09']);
    const manager = await environment.loginAs('VT-03', units['PH-A'] ?? null);
    const forbidden = await sendJson('POST', `${identityUrl}/users/bulk-roles`, manager.accessToken, {
      user_ids: [first],
      role: { role_code: 'VT-09', org_unit_id: units['PH-A'] },
    });
    assert.equal(forbidden.status, 403);
  });

  it('CT-16d-7: danh sách người dùng ở máy chủ API có mã nhân sự, mã Bộ; lọc theo mã định danh', async () => {
    const linked = await insertUser('S1', [{ roleCode: 'VT-07', unit: 'PH-A' }]);
    await insertUser('S2', [{ roleCode: 'VT-07', unit: 'PH-A' }]);
    await insertStaff(`${tag}NS1`, { unit: 'PH-A', userId: linked, moet: `MB${tag}` });
    const all = await sendJson('GET', `${environment.baseUrl}/account-directory?full_name=${tag} S`, principal);
    assert.equal(all.status, 200, JSON.stringify(all.body));
    const items = all.body.items as Array<{ id: string; staff_code: string | null; moet_staff_code: string | null }>;
    assert.equal(items.length, 2);
    const row = items.find((item) => item.id === linked);
    assert.equal(row?.staff_code, `${tag}NS1`);
    assert.equal(row?.moet_staff_code, `MB${tag}`);
    // Mã định danh khớp một phần mã Bộ hoặc mã nhân sự, không phân biệt hoa thường
    for (const identifier of [`mb${tag}`.toLowerCase(), `${tag}ns1`.toLowerCase()]) {
      const filtered = await sendJson(
        'GET',
        `${environment.baseUrl}/account-directory?identifier=${encodeURIComponent(identifier)}`,
        principal,
      );
      assert.deepEqual(
        (filtered.body.items as Array<{ id: string }>).map((item) => item.id),
        [linked],
      );
    }
    const none = await sendJson(
      'GET',
      `${environment.baseUrl}/account-directory?identifier=khongcoai${tag}`,
      principal,
    );
    assert.equal(none.body.total, 0);
    const teacher = await environment.loginAs('VT-07', units['PH-A'] ?? null);
    const forbidden = await sendJson('GET', `${environment.baseUrl}/account-directory`, teacher.accessToken);
    assert.equal(forbidden.status, 403);
  });

  it('CT-16d-8: lấy danh sách CBQL/GV tạo tài khoản cho nhân sự chưa có, liên kết hồ sơ, mật khẩu tạm bắt đổi', async () => {
    const first = await insertStaff(`${tag}GV1`, { unit: 'PH-A', phone: '0912000161' });
    const second = await insertStaff(`${tag}GV2`, { unit: 'PH-B' });
    const waiting = await sendJson('GET', `${environment.baseUrl}/account-directory/staff-without-account`, principal);
    assert.equal(waiting.status, 200, JSON.stringify(waiting.body));
    const listed = waiting.body as unknown as Array<{ id: string; suggested_username: string | null }>;
    assert.equal(listed.find((item) => item.id === first)?.suggested_username, `${tag}gv1`.toLowerCase());
    assert.ok(listed.some((item) => item.id === second));

    const created = await sendJson('POST', `${environment.baseUrl}/account-directory/staff-accounts`, principal, {
      staff_ids: [first, second],
      role_code: 'VT-07',
    });
    assert.equal(created.status, 200, JSON.stringify(created.body));
    const items = created.body.items as Array<{
      staff_id: string;
      temporary_password: string | null;
      error: string | null;
    }>;
    assert.ok(
      items.every((item) => item.error === null && item.temporary_password),
      JSON.stringify(items),
    );
    const staff = await schoolYear
      .selectFrom('staff')
      .select(['id', 'user_id'])
      .where('id', 'in', [first, second])
      .execute();
    const userIds = staff.map((row) => row.user_id).filter((id): id is string => id !== null);
    assert.equal(userIds.length, 2);
    createdUsers.push(...userIds);
    const user = await environment.identity.database
      .selectFrom('users')
      .select(['username', 'phone', 'must_change_password'])
      .where('id', '=', staff.find((row) => row.id === first)?.user_id ?? '')
      .executeTakeFirstOrThrow();
    assert.equal(user.username, `${tag}gv1`.toLowerCase());
    assert.equal(user.phone, '0912000161');
    assert.equal(user.must_change_password, true);
    const assignment = await environment.identity.database
      .selectFrom('user_roles')
      .select('org_unit_id')
      .where('user_id', '=', staff.find((row) => row.id === second)?.user_id ?? '')
      .executeTakeFirstOrThrow();
    assert.equal(assignment.org_unit_id, units['PH-B']);

    // Lần sau nhân sự đã có tài khoản thì báo lỗi từng dòng, không tạo trùng
    const again = await sendJson('POST', `${environment.baseUrl}/account-directory/staff-accounts`, principal, {
      staff_ids: [first],
      role_code: 'VT-07',
    });
    assert.equal((again.body.items as Array<{ error: string }>)[0]?.error, 'Nhân sự đã có tài khoản');
    // Quản lý đơn vị PH-A không tạo được cho nhân sự PH-B
    const third = await insertStaff(`${tag}GV3`, { unit: 'PH-B' });
    const manager = await environment.loginAs('VT-03', units['PH-A'] ?? null);
    const outside = await sendJson(
      'POST',
      `${environment.baseUrl}/account-directory/staff-accounts`,
      manager.accessToken,
      {
        staff_ids: [third],
        role_code: 'VT-07',
      },
    );
    assert.equal((outside.body.items as Array<{ error: string }>)[0]?.error, 'Nhân sự nằm ngoài phạm vi của bạn');
  });

  it('CT-16d-9: xuất Excel danh sách người dùng theo bộ lọc, ghi nhật ký xuất; không có quyền xuất thì bị từ chối', async () => {
    await insertUser('X1', [{ roleCode: 'VT-07', unit: 'PH-A' }]);
    const response = await fetch(`${environment.baseUrl}/account-directory/export`, {
      method: 'POST',
      headers: { authorization: `Bearer ${principal}`, 'content-type': 'application/json' },
      body: JSON.stringify({ full_name: `${tag} X1`, columns: ['login', 'full_name', 'staff_code'] }),
    });
    assert.equal(response.status, 200, await response.clone().text());
    assert.match(response.headers.get('content-type') ?? '', /spreadsheetml/);
    assert.ok((await response.arrayBuffer()).byteLength > 1000);
    const log = await schoolYear
      .selectFrom('export_logs')
      .select(['report_code', 'row_count', 'user_id'])
      .where('report_code', '=', 'accounts')
      .orderBy('exported_at', 'desc')
      .executeTakeFirstOrThrow();
    assert.equal(log.row_count, 1);
    assert.equal(log.user_id, principalId);
    const manager = await environment.loginAs('VT-03', units['PH-A'] ?? null);
    const denied = await sendJson('POST', `${environment.baseUrl}/account-directory/export`, manager.accessToken, {});
    assert.equal(denied.status, 403);
    const badColumn = await sendJson('POST', `${environment.baseUrl}/account-directory/export`, principal, {
      columns: ['khong-co'],
    });
    assert.equal(badColumn.status, 400);
  });

  it('CT-16d-10: tài khoản đồng bộ của Bộ, của Sở lưu mật khẩu mã hóa, không trả mật khẩu; chỉ người có quyền xem', async () => {
    const empty = await sendJson('GET', `${environment.baseUrl}/sync-accounts`, principal);
    assert.equal(empty.status, 200);
    assert.deepEqual(
      (empty.body as unknown as Array<{ target: string; password_configured: boolean; sync_available: boolean }>).map(
        (item) => [item.target, item.password_configured, item.sync_available],
      ),
      [
        ['moet', false, false],
        ['doet', false, false],
      ],
    );
    const missingPassword = await sendJson('PUT', `${environment.baseUrl}/sync-accounts/moet`, principal, {
      username: 'truong.thu',
    });
    assert.equal(missingPassword.status, 400);
    const testPassword = `Thu-${randomUUID()}`;
    const saved = await sendJson('PUT', `${environment.baseUrl}/sync-accounts/moet`, principal, {
      username: 'truong.thu',
      password: testPassword,
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.username, 'truong.thu');
    assert.equal(saved.body.password_configured, true);
    assert.ok(!JSON.stringify(saved.body).includes(testPassword));
    const stored = await environment.system
      .selectFrom('integration_credentials')
      .select(['account_username', 'account_secret_encrypted'])
      .where('connector', '=', 'moet_sync')
      .executeTakeFirstOrThrow();
    assert.ok(stored.account_secret_encrypted && !stored.account_secret_encrypted.includes(testPassword));
    // Để trống mật khẩu thì giữ mật khẩu đã lưu
    const renamed = await sendJson('PUT', `${environment.baseUrl}/sync-accounts/moet`, principal, {
      username: 'truong.thu2',
      password: '',
    });
    assert.equal(renamed.status, 200);
    const after = await environment.system
      .selectFrom('integration_credentials')
      .select(['account_username', 'account_secret_encrypted'])
      .where('connector', '=', 'moet_sync')
      .executeTakeFirstOrThrow();
    assert.equal(after.account_username, 'truong.thu2');
    assert.equal(after.account_secret_encrypted, stored.account_secret_encrypted);
    const listed = await sendJson('GET', `${environment.baseUrl}/sync-accounts`, principal);
    assert.ok(!JSON.stringify(listed.body).includes(testPassword));
    assert.ok(!JSON.stringify(listed.body).includes(stored.account_secret_encrypted ?? '-'));

    const manager = await environment.loginAs('VT-03', units['PH-A'] ?? null);
    assert.equal((await sendJson('GET', `${environment.baseUrl}/sync-accounts`, manager.accessToken)).status, 403);
    assert.equal((await sendJson('PUT', `${environment.baseUrl}/sync-accounts/khac`, principal, {})).status, 404);
    const removed = await sendJson('DELETE', `${environment.baseUrl}/sync-accounts/moet`, principal);
    assert.equal(removed.status, 204);
    const gone = await sendJson('GET', `${environment.baseUrl}/sync-accounts`, principal);
    assert.equal((gone.body as unknown as Array<{ username: string | null }>)[0]?.username, null);
  });
});
