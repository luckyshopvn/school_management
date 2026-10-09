import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { postJson } from '@school-management/identity/testing';
import { openTestAcademicYear, sendJson, startApiTestEnvironment, type ApiTestEnvironment } from './test-support.js';

// Quản lý tài khoản, vai trò, quyền do dịch vụ định danh phục vụ, đọc cây đơn vị thật qua máy chủ API
// Ca kiểm thử theo 27_BO_CA_KIEM_THU_CHI_TIET/01_DINH_DANH_VA_P01.md mục 3.6, 4.5, 4.6 (PQ-13, YCTD-39)
describe('Tài khoản, vai trò và quyền', () => {
  let environment: ApiTestEnvironment;
  let principal: string;
  const units: Record<string, string> = {};
  let identityUrl = '';

  before(async () => {
    environment = await startApiTestEnvironment();
    identityUrl = environment.identity.baseUrl;
    principal = (await environment.loginAs('VT-02', null)).accessToken;
    await openTestAcademicYear(environment, principal, '2026–2027', {
      first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    });
    for (const [code, type] of [
      ['TC', 'truong_chinh'],
      ['PH-A', 'phan_hieu'],
      ['PH-B', 'phan_hieu'],
      ['DT-A1', 'diem_truong'],
      ['DT-A2', 'diem_truong'],
      ['DT-B1', 'diem_truong'],
    ] as const) {
      const created = await sendJson('POST', `${environment.baseUrl}/org-units`, principal, {
        code,
        name: code,
        unit_type: type,
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      units[code] = created.body.id as string;
    }
  });

  after(async () => {
    await environment.close();
  });

  const randomPhone = () =>
    `09${Math.floor(Math.random() * 100_000_000)
      .toString()
      .padStart(8, '0')}`;

  async function login(loginIdentifier: string, password: string) {
    return postJson(`${identityUrl}/auth/login`, { login: loginIdentifier, password, channel: 'portal' });
  }

  async function createAccount(
    accessToken: string,
    roles: Array<{ role_code: string; org_unit_id: string | null }>,
    extra = {},
  ) {
    return sendJson('POST', `${identityUrl}/users`, accessToken, {
      full_name: 'Nhân viên kiểm thử',
      phone: randomPhone(),
      roles,
      ...extra,
    });
  }

  async function groupAManager() {
    return environment.loginWithRoles(
      ['PH-A', 'DT-A1', 'DT-A2'].map((code) => ({ roleCode: 'VT-03', orgUnitId: units[code] ?? null })),
    );
  }

  it('CTC-P01-030: HT tạo tài khoản giáo viên ở ĐT-A1; đăng nhập bằng mật khẩu tạm và phải đổi mật khẩu', async () => {
    const created = await createAccount(principal, [{ role_code: 'VT-07', org_unit_id: units['DT-A1'] ?? null }]);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const account = created.body.account as { phone: string; must_change_password: boolean };
    assert.equal(account.must_change_password, true);
    const loggedIn = await login(account.phone, created.body.temporary_password as string);
    assert.equal(loggedIn.status, 200);
    assert.equal(loggedIn.body.password_change_required, true);
  });

  it('CTC-P01-031, PQ-13: QL-A tạo tài khoản ở ĐT-A1 với vai trò nhân viên hoặc Phó Hiệu trưởng; không tạo được VT-02', async () => {
    const { accessToken } = await groupAManager();
    assert.equal(
      (await createAccount(accessToken, [{ role_code: 'VT-07', org_unit_id: units['DT-A1'] ?? null }])).status,
      201,
    );
    assert.equal(
      (await createAccount(accessToken, [{ role_code: 'VT-15', org_unit_id: units['PH-A'] ?? null }])).status,
      201,
    );
    assert.equal((await createAccount(accessToken, [{ role_code: 'VT-02', org_unit_id: null }])).status, 403);
  });

  it('CTC-P01-032: QL-A không tạo được tài khoản thuộc PH-B', async () => {
    const { accessToken } = await groupAManager();
    const response = await createAccount(accessToken, [{ role_code: 'VT-07', org_unit_id: units['PH-B'] ?? null }]);
    assert.equal(response.status, 403);
  });

  it('PQ-13: Phó Hiệu trưởng không quản lý tài khoản', async () => {
    const { accessToken } = await environment.loginAs('VT-15', units['PH-A'] ?? null);
    assert.equal((await sendJson('GET', `${identityUrl}/users`, accessToken)).status, 403);
  });

  it('CTC-P01-033: số điện thoại đã thuộc tài khoản khác trả ERR_CONFLICT', async () => {
    const phone = randomPhone();
    const roles = [{ role_code: 'VT-06', org_unit_id: units['PH-A'] ?? null }];
    assert.equal((await createAccount(principal, roles, { phone })).status, 201);
    const duplicate = await createAccount(principal, roles, { phone });
    assert.equal(duplicate.status, 409);
  });

  it('CTC-P01-038, BM-68: vai trò theo đơn vị thiếu đơn vị và VT-20 thiếu ngày hết hiệu lực trả ERR_VALIDATION', async () => {
    assert.equal((await createAccount(principal, [{ role_code: 'VT-04', org_unit_id: null }])).status, 400);
    assert.equal((await createAccount(principal, [{ role_code: 'VT-20', org_unit_id: null }])).status, 400);
    assert.equal(
      (await createAccount(principal, [{ role_code: 'VT-20', org_unit_id: null }], { valid_until: '2027-06-30' }))
        .status,
      201,
    );
  });

  it('CTC-P01-034, CTC-P01-037: khóa thì không đăng nhập được, mở khóa thì đăng nhập lại; nhật ký ghi trạng thái trước và sau', async () => {
    const created = await createAccount(principal, [{ role_code: 'VT-07', org_unit_id: units['DT-A1'] ?? null }]);
    const account = created.body.account as { id: string; phone: string };
    const password = created.body.temporary_password as string;

    const locked = await sendJson('PATCH', `${identityUrl}/users/${account.id}`, principal, { status: 'locked' });
    assert.equal(locked.status, 200);
    assert.equal((await login(account.phone, password)).status, 401);
    const unlocked = await sendJson('PATCH', `${identityUrl}/users/${account.id}`, principal, { status: 'active' });
    assert.equal(unlocked.status, 200);
    assert.equal((await login(account.phone, password)).status, 200);

    const logs = await environment.identity.database
      .selectFrom('identity_audit_logs')
      .select(['action', 'before_data', 'after_data'])
      .where('entity_id', '=', account.id)
      .where('action', 'in', ['lock', 'unlock'])
      .orderBy('created_at')
      .execute();
    assert.deepEqual(
      logs.map((log) => [
        log.action,
        (log.before_data as { status: string }).status,
        (log.after_data as { status: string }).status,
      ]),
      [
        ['lock', 'active', 'locked'],
        ['unlock', 'locked', 'active'],
      ],
    );
  });

  it('CTC-P01-035: đặt lại mật khẩu; mật khẩu cũ hết dùng; phiên bằng mật khẩu tạm chỉ đổi được mật khẩu; đổi xong dùng bình thường', async () => {
    const created = await createAccount(principal, [{ role_code: 'VT-07', org_unit_id: units['DT-A1'] ?? null }]);
    const account = created.body.account as { id: string; phone: string };
    const first = await login(account.phone, created.body.temporary_password as string);
    await postJson(
      `${identityUrl}/auth/change-password`,
      { current_password: created.body.temporary_password, new_password: 'MatKhauRieng2026' },
      first.body.access_token as string,
    );

    const reset = await sendJson('POST', `${identityUrl}/users/${account.id}/reset-password`, principal);
    assert.equal(reset.status, 200);
    assert.equal((await login(account.phone, 'MatKhauRieng2026')).status, 401);
    const temporary = await login(account.phone, reset.body.temporary_password as string);
    assert.equal(temporary.body.password_change_required, true);
    const temporaryToken = temporary.body.access_token as string;
    assert.equal((await sendJson('GET', `${environment.baseUrl}/org-units`, temporaryToken)).status, 403);

    const changed = await postJson(
      `${identityUrl}/auth/change-password`,
      { current_password: reset.body.temporary_password, new_password: 'MatKhauMoi2027' },
      temporaryToken,
    );
    assert.equal(changed.status, 200);
    assert.equal(
      (await sendJson('GET', `${environment.baseUrl}/org-units`, changed.body.access_token as string)).status,
      200,
    );
  });

  it('CTC-P01-039, CTC-P01-042: HT gán VT-04 ở PH-A; QL-A không gán được vai trò', async () => {
    const created = await createAccount(principal, [{ role_code: 'VT-06', org_unit_id: units['PH-A'] ?? null }]);
    const accountId = (created.body.account as { id: string }).id;
    const assigned = await sendJson('POST', `${identityUrl}/users/${accountId}/roles`, principal, {
      role_code: 'VT-04',
      org_unit_id: units['PH-A'],
    });
    assert.equal(assigned.status, 200);
    const assignments = assigned.body.assignments as Array<{ role_code: string; org_unit_id: string }>;
    assert.ok(assignments.some((item) => item.role_code === 'VT-04' && item.org_unit_id === units['PH-A']));

    const { accessToken } = await groupAManager();
    const forbidden = await sendJson('POST', `${identityUrl}/users/${accountId}/roles`, accessToken, {
      role_code: 'VT-07',
      org_unit_id: units['PH-A'],
    });
    assert.equal(forbidden.status, 403);
  });

  it('CTC-DD-035: gỡ vai trò thì yêu cầu kế tiếp bị từ chối ngay và mã làm mới cũ bị thu hồi', async () => {
    const created = await createAccount(principal, [{ role_code: 'VT-03', org_unit_id: units['PH-A'] ?? null }]);
    const account = created.body.account as {
      id: string;
      phone: string;
      assignments: Array<{ assignment_id: string }>;
    };
    const first = await login(account.phone, created.body.temporary_password as string);
    const changed = await postJson(
      `${identityUrl}/auth/change-password`,
      { current_password: created.body.temporary_password, new_password: 'QuanLy2026A' },
      first.body.access_token as string,
    );
    const accessToken = changed.body.access_token as string;
    assert.equal((await sendJson('GET', `${environment.baseUrl}/org-units`, accessToken)).status, 200);

    const removed = await sendJson(
      'DELETE',
      `${identityUrl}/users/${account.id}/roles/${account.assignments[0]?.assignment_id}`,
      principal,
    );
    assert.equal(removed.status, 200);
    assert.equal((await sendJson('GET', `${environment.baseUrl}/org-units`, accessToken)).status, 401);
    const refreshed = await postJson(`${identityUrl}/auth/refresh`, {}, undefined, first.refreshToken);
    assert.equal(refreshed.status, 401);
  });

  it('CTC-P01-041: thêm quyền vào VT-04 có hiệu lực ở yêu cầu kế tiếp; nhật ký ghi danh sách quyền trước và sau', async () => {
    const roles = (await sendJson('GET', `${identityUrl}/roles`, principal)).body as unknown as Array<{
      id: string;
      code: string;
      permissions: string[];
    }>;
    const accountant = roles.find((role) => role.code === 'VT-04');
    assert.ok(accountant);
    const original = [...accountant.permissions];
    const user = await environment.loginAs('VT-04', units['PH-A'] ?? null);
    try {
      const updated = await sendJson('PUT', `${identityUrl}/roles/${accountant.id}/permissions`, principal, {
        permission_codes: [...original, 'P13.edit'],
      });
      assert.equal(updated.status, 200);
      const me = await sendJson('GET', `${identityUrl}/auth/me`, user.accessToken);
      const permissions = (me.body.assignments as Array<{ permissions: string[] }>)[0]?.permissions ?? [];
      assert.ok(permissions.includes('P13.edit'));
      const log = await environment.identity.database
        .selectFrom('identity_audit_logs')
        .select(['before_data', 'after_data'])
        .where('entity_id', '=', accountant.id)
        .where('action', '=', 'replace_permissions')
        .orderBy('created_at', 'desc')
        .executeTakeFirstOrThrow();
      assert.ok(!(log.before_data as { permissions: string[] }).permissions.includes('P13.edit'));
      assert.ok((log.after_data as { permissions: string[] }).permissions.includes('P13.edit'));
    } finally {
      // Trả lại quyền gốc vì cơ sở dữ liệu định danh dùng chung với môi trường phát triển
      await sendJson('PUT', `${identityUrl}/roles/${accountant.id}/permissions`, principal, {
        permission_codes: original,
      });
    }
  });

  it('CTC-DD-039, CTC-DD-040: giáo viên không sửa được tài khoản khác; không ai tự đổi số điện thoại của mình', async () => {
    const teacher = await environment.loginAs('VT-07', units['DT-A1'] ?? null);
    const staff = await createAccount(principal, [{ role_code: 'VT-06', org_unit_id: units['PH-A'] ?? null }]);
    const staffId = (staff.body.account as { id: string }).id;
    assert.equal(
      (await sendJson('PATCH', `${identityUrl}/users/${staffId}`, teacher.accessToken, { full_name: 'Đổi' })).status,
      403,
    );
    assert.equal(
      (await sendJson('PATCH', `${identityUrl}/users/${teacher.userId}`, teacher.accessToken, { phone: randomPhone() }))
        .status,
      403,
    );
  });

  it('Danh sách tài khoản của QL-A chỉ gồm tài khoản có mọi vai trò trong nhóm A', async () => {
    const { accessToken } = await groupAManager();
    const created = await createAccount(principal, [{ role_code: 'VT-07', org_unit_id: units['DT-B1'] ?? null }]);
    const outsiderId = (created.body.account as { id: string }).id;
    const list = await sendJson('GET', `${identityUrl}/users?page_size=100`, accessToken);
    assert.equal(list.status, 200);
    const items = list.body.items as Array<{ id: string; assignments: Array<{ org_unit_id: string | null }> }>;
    assert.ok(!items.some((item) => item.id === outsiderId));
    const groupA = new Set(['PH-A', 'DT-A1', 'DT-A2'].map((code) => units[code]));
    assert.ok(items.every((item) => item.assignments.every((assignment) => groupA.has(assignment.org_unit_id ?? ''))));
  });
});
