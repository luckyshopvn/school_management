import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import type { OrgUnitSummary } from '../accounts/organization-directory.js';
import { OrganizationDirectory } from '../accounts/organization-directory.js';
import {
  createTestUser,
  errorCode,
  getJson,
  postJson,
  startTestApplication,
  TEST_PASSWORD,
  type TestContext,
} from '../test-support.js';

// Mật khẩu mặc định và mã một lần của phụ huynh; ca kiểm thử theo 27_BO_CA_KIEM_THU_CHI_TIET/01_DINH_DANH_VA_P01.md mục 3.2, 3.3
const DEFAULT_PASSWORD = 'PhuHuynh2026';
const NEW_DEFAULT_PASSWORD = 'MacDinh2027';
const PARENT_SETTING_KEYS = [
  'parent_default_password_hash',
  'one_time_code_lifetime_minutes',
  'one_time_code_maximum_attempts',
  'one_time_code_maximum_sends_per_hour',
];
const branchA = randomUUID();

class FakeOrganizationDirectory extends OrganizationDirectory {
  async listUnits(): Promise<OrgUnitSummary[]> {
    return [{ id: branchA, name: 'Phân hiệu A', unit_type: 'phan_hieu', status: 'active' }];
  }
}

async function putJson(url: string, body: unknown, accessToken: string) {
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : {}) as Record<string, unknown> };
}

describe('Dịch vụ định danh: mật khẩu mặc định và mã một lần của phụ huynh', () => {
  let context: TestContext;
  let principalToken: string;
  // Cơ sở dữ liệu định danh dùng chung khi phát triển nên giữ lại cấu hình cũ để trả về sau kiểm thử
  let savedSettings: Array<{ key: string; value: unknown; updated_by: string | null }> = [];

  const login = (loginIdentifier: string, password: string, channel = 'parent') =>
    postJson(`${context.baseUrl}/auth/login`, { login: loginIdentifier, password, channel });
  const requestCode = (phone: string) => postJson(`${context.baseUrl}/auth/otp/request`, { phone });
  const loginWithCode = (phone: string, code: string) => postJson(`${context.baseUrl}/auth/otp/login`, { phone, code });
  const codeSentTo = (phone: string) => /(\d{6})/.exec(context.smsSender.lastTo(phone) ?? '')?.[1];
  const createParent = (usesDefaultPassword = true) =>
    createTestUser(context.database, { roles: [{ roleCode: 'VT-14', orgUnitId: branchA }], usesDefaultPassword });

  before(async () => {
    context = await startTestApplication({ organizationDirectory: new FakeOrganizationDirectory() });
    savedSettings = await context.database
      .selectFrom('identity_settings')
      .select(['key', 'value', 'updated_by'])
      .where('key', 'in', PARENT_SETTING_KEYS)
      .execute();
    await context.database.deleteFrom('identity_settings').where('key', 'in', PARENT_SETTING_KEYS).execute();
    const principal = await createTestUser(context.database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
    principalToken = (await login(principal.phone, principal.password, 'portal')).body.access_token as string;
  });

  after(async () => {
    await context.database.deleteFrom('identity_settings').where('key', 'in', PARENT_SETTING_KEYS).execute();
    for (const row of savedSettings) {
      await context.database
        .insertInto('identity_settings')
        .values({ key: row.key, value: JSON.stringify(row.value), updated_by: row.updated_by })
        .execute();
    }
    await context.close();
  });

  describe('Mật khẩu mặc định chung', () => {
    it('PQ-06: chưa đặt mật khẩu mặc định thì không tạo được tài khoản phụ huynh', async () => {
      const response = await postJson(
        `${context.baseUrl}/users`,
        {
          full_name: 'Phụ huynh A',
          phone: `09${Date.now().toString().slice(-8)}`,
          roles: [{ role_code: 'VT-14', org_unit_id: branchA }],
        },
        principalToken,
      );
      assert.equal(response.status, 422, JSON.stringify(response.body));
    });

    it('CTC-DD-014: HT đặt mật khẩu mặc định; đọc cấu hình không trả mật khẩu; cơ sở dữ liệu chỉ lưu giá trị băm', async () => {
      const weak = await putJson(
        `${context.baseUrl}/auth/settings`,
        { parent_default_password: '12345678' },
        principalToken,
      );
      assert.equal(weak.status, 400);
      const saved = await putJson(
        `${context.baseUrl}/auth/settings`,
        { parent_default_password: DEFAULT_PASSWORD },
        principalToken,
      );
      assert.equal(saved.status, 200, JSON.stringify(saved.body));
      const read = await getJson(`${context.baseUrl}/auth/settings`, principalToken);
      assert.equal(read.body.parent_default_password_configured, true);
      assert.ok(!JSON.stringify(read.body).includes(DEFAULT_PASSWORD));
      assert.equal(read.body.one_time_code_lifetime_minutes, 5);
      const stored = await context.database
        .selectFrom('identity_settings')
        .select('value')
        .where('key', '=', 'parent_default_password_hash')
        .executeTakeFirstOrThrow();
      assert.ok(String(stored.value).startsWith('$argon2id$'));
      const log = await context.database
        .selectFrom('identity_audit_logs')
        .select('after_data')
        .where('entity_name', '=', 'identity_settings')
        .orderBy('created_at', 'desc')
        .executeTakeFirstOrThrow();
      assert.ok(!JSON.stringify(log.after_data).includes(DEFAULT_PASSWORD));
      assert.ok(!JSON.stringify(log.after_data).includes('$argon2id$'));
    });

    it('PQ-15: quản lý đơn vị không đặt được mật khẩu mặc định chung', async () => {
      const manager = await createTestUser(context.database, { roles: [{ roleCode: 'VT-03', orgUnitId: branchA }] });
      const token = (await login(manager.phone, manager.password, 'portal')).body.access_token as string;
      const response = await putJson(
        `${context.baseUrl}/auth/settings`,
        { parent_default_password: 'KhacNua2026' },
        token,
      );
      assert.equal(response.status, 403);
    });

    it('PQ-06: tạo tài khoản phụ huynh dùng mật khẩu mặc định, không sinh mật khẩu tạm', async () => {
      const phone = `09${Date.now().toString().slice(-8)}`;
      const response = await postJson(
        `${context.baseUrl}/users`,
        { full_name: 'Phụ huynh B', phone, roles: [{ role_code: 'VT-14', org_unit_id: branchA }] },
        principalToken,
      );
      assert.equal(response.status, 201, JSON.stringify(response.body));
      assert.equal(response.body.temporary_password, null);
      assert.equal(response.body.uses_default_password, true);
      const signedIn = await login(phone, DEFAULT_PASSWORD);
      assert.equal(signedIn.status, 200);
      assert.equal(signedIn.body.password_change_required, true);
    });

    it('CTC-DD-010, CTC-DD-011: đăng nhập bằng mật khẩu mặc định chỉ dùng được điểm cuối đổi mật khẩu', async () => {
      const parent = await createParent();
      const response = await login(parent.phone, DEFAULT_PASSWORD);
      assert.equal(response.status, 200);
      assert.equal(response.body.password_change_required, true);
      const token = response.body.access_token as string;
      assert.equal((await getJson(`${context.baseUrl}/auth/me`, token)).status, 200);
      const blocked = await getJson(`${context.baseUrl}/users`, token);
      assert.equal(blocked.status, 403);
      assert.equal(errorCode(blocked.body), 'ERR_FORBIDDEN');
      // Làm mới vẫn là phiên hạn chế
      const refreshed = await postJson(
        `${context.baseUrl}/auth/refresh`,
        { channel: 'parent' },
        undefined,
        response.refreshToken,
      );
      assert.equal(refreshed.body.password_change_required, true);
    });

    it('CTC-DD-012: kích hoạt bằng đổi mật khẩu; mật khẩu mới dùng được, mật khẩu mặc định không dùng được nữa', async () => {
      const parent = await createParent();
      const token = (await login(parent.phone, DEFAULT_PASSWORD)).body.access_token as string;
      const same = await postJson(
        `${context.baseUrl}/auth/change-password`,
        { current_password: DEFAULT_PASSWORD, new_password: DEFAULT_PASSWORD },
        token,
      );
      assert.equal(same.status, 400);
      const changed = await postJson(
        `${context.baseUrl}/auth/change-password`,
        { current_password: DEFAULT_PASSWORD, new_password: 'RiengToi2026' },
        token,
      );
      assert.equal(changed.status, 200, JSON.stringify(changed.body));
      assert.equal(changed.body.password_change_required, false);
      const withNew = await login(parent.phone, 'RiengToi2026');
      assert.equal(withNew.status, 200);
      assert.equal(withNew.body.password_change_required, false);
      assert.equal((await login(parent.phone, DEFAULT_PASSWORD)).status, 401);
    });

    it('YCTD-43: đổi mật khẩu mặc định thì phụ huynh chưa kích hoạt dùng mật khẩu mới; tài khoản đã kích hoạt không bị ảnh hưởng', async () => {
      const waiting = await createParent();
      const activated = await createParent(false);
      await putJson(
        `${context.baseUrl}/auth/settings`,
        { parent_default_password: NEW_DEFAULT_PASSWORD },
        principalToken,
      );
      assert.equal((await login(waiting.phone, DEFAULT_PASSWORD)).status, 401);
      assert.equal((await login(waiting.phone, NEW_DEFAULT_PASSWORD)).status, 200);
      assert.equal((await login(activated.phone, TEST_PASSWORD)).status, 200);
      assert.equal((await login(activated.phone, NEW_DEFAULT_PASSWORD)).status, 401);
      await putJson(`${context.baseUrl}/auth/settings`, { parent_default_password: DEFAULT_PASSWORD }, principalToken);
    });
  });

  describe('Mã một lần', () => {
    it('CTC-DD-016, CTC-DD-017: yêu cầu mã thì nhận tin nhắn sáu chữ số, lưu dạng băm; đăng nhập bằng mã không cần mật khẩu', async () => {
      const parent = await createParent(false);
      const requested = await requestCode(parent.phone);
      assert.equal(requested.status, 200);
      assert.equal(requested.body.expires_in_seconds, 300);
      const code = codeSentTo(parent.phone);
      assert.match(code ?? '', /^\d{6}$/);
      const row = await context.database
        .selectFrom('one_time_codes')
        .select(['code_hash', 'purpose'])
        .where('user_id', '=', parent.id)
        .executeTakeFirstOrThrow();
      assert.equal(row.purpose, 'login');
      assert.ok(row.code_hash.startsWith('$argon2id$'));
      assert.ok(!row.code_hash.includes(code ?? ''));

      const signedIn = await loginWithCode(parent.phone, code ?? '');
      assert.equal(signedIn.status, 200, JSON.stringify(signedIn.body));
      assert.equal(signedIn.body.password_change_required, false);
      // Mã chỉ dùng một lần
      assert.equal((await loginWithCode(parent.phone, code ?? '')).status, 401);
    });

    it('CTC-DD-042, Q-147: phụ huynh còn mật khẩu mặc định đăng nhập bằng mã thì dùng bình thường, kể cả sau khi làm mới', async () => {
      const parent = await createParent();
      await requestCode(parent.phone);
      const signedIn = await loginWithCode(parent.phone, codeSentTo(parent.phone) ?? '');
      assert.equal(signedIn.status, 200);
      assert.equal(signedIn.body.password_change_required, false);
      const refreshed = await postJson(
        `${context.baseUrl}/auth/refresh`,
        { channel: 'parent' },
        undefined,
        signedIn.refreshToken,
      );
      assert.equal(refreshed.status, 200);
      assert.equal(refreshed.body.password_change_required, false);
      const withDefault = await login(parent.phone, DEFAULT_PASSWORD);
      assert.equal(withDefault.body.password_change_required, true);
    });

    it('AC-181: nhập sai đủ 5 lần thì mã hết hiệu lực; mã quá 5 phút cũng bị từ chối', async () => {
      const parent = await createParent(false);
      await requestCode(parent.phone);
      const code = codeSentTo(parent.phone) ?? '';
      const wrong = code === '000000' ? '111111' : '000000';
      for (let attempt = 0; attempt < 5; attempt += 1) {
        assert.equal((await loginWithCode(parent.phone, wrong)).status, 401);
      }
      assert.equal((await loginWithCode(parent.phone, code)).status, 401);

      context.clock.freeze();
      try {
        await requestCode(parent.phone);
        const fresh = codeSentTo(parent.phone) ?? '';
        context.clock.advanceMinutes(6);
        const expired = await loginWithCode(parent.phone, fresh);
        assert.equal(expired.status, 401);
        assert.equal((expired.body.error as { message: string }).message.includes('yêu cầu mã mới'), true);
      } finally {
        context.clock.advanceMinutes(-6);
      }
    });

    it('CTC-DD-022: yêu cầu mã lần thứ 6 trong một giờ trả ERR_RATE_LIMIT, không gửi tin; số không tồn tại cũng vậy', async () => {
      const parent = await createParent(false);
      const before = context.smsSender.messages.length;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        assert.equal((await requestCode(parent.phone)).status, 200);
      }
      const sixth = await requestCode(parent.phone);
      assert.equal(sixth.status, 429);
      assert.equal(errorCode(sixth.body), 'ERR_RATE_LIMIT');
      assert.equal(context.smsSender.messages.length - before, 5);

      const unknown = `08${Date.now().toString().slice(-8)}`;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await requestCode(unknown);
      }
      assert.equal((await requestCode(unknown)).status, 429);
    });

    it('CTC-DD-023, BM-61: số điện thoại của nhân sự hoặc không có trong hệ thống thì không nhận mã, phản hồi như nhau', async () => {
      const staff = await createTestUser(context.database, { roles: [{ roleCode: 'VT-06', orgUnitId: branchA }] });
      const before = context.smsSender.messages.length;
      const forStaff = await requestCode(staff.phone);
      const forUnknown = await requestCode('0900000000');
      assert.equal(forStaff.status, 200);
      assert.deepEqual(forStaff.body, forUnknown.body);
      assert.equal(context.smsSender.messages.length, before);
      assert.equal((await loginWithCode(staff.phone, '123456')).status, 401);

      // Người vừa là nhân sự vừa là phụ huynh cũng không đăng nhập bằng mã
      const both = await createTestUser(context.database, {
        roles: [
          { roleCode: 'VT-14', orgUnitId: branchA },
          { roleCode: 'VT-07', orgUnitId: branchA },
        ],
      });
      await requestCode(both.phone);
      assert.equal(context.smsSender.lastTo(both.phone), undefined);
    });

    it('BM-71, YCTD-43: mỗi kênh một cookie; phiên cổng quản trị không làm mới được ở kênh phụ huynh', async () => {
      const parent = await createParent(false);
      const signedIn = await login(parent.phone, TEST_PASSWORD);
      assert.match(signedIn.setCookie ?? '', /^refresh_token_parent=/);
      const portalUser = await createTestUser(context.database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
      const portal = await login(portalUser.phone, portalUser.password, 'portal');
      assert.match(portal.setCookie ?? '', /^refresh_token=/);
      const crossed = await postJson(
        `${context.baseUrl}/auth/refresh`,
        { channel: 'parent' },
        undefined,
        portal.refreshToken,
      );
      assert.equal(crossed.status, 401);
    });

    it('YCTD-43: Hiệu trưởng sửa thông số mã một lần', async () => {
      const saved = await putJson(
        `${context.baseUrl}/auth/settings`,
        {
          one_time_code_lifetime_minutes: 3,
          one_time_code_maximum_attempts: 3,
          one_time_code_maximum_sends_per_hour: 10,
        },
        principalToken,
      );
      assert.equal(saved.status, 200, JSON.stringify(saved.body));
      assert.equal(saved.body.one_time_code_lifetime_minutes, 3);
      const parent = await createParent(false);
      assert.equal((await requestCode(parent.phone)).body.expires_in_seconds, 180);
      const invalid = await putJson(
        `${context.baseUrl}/auth/settings`,
        { one_time_code_lifetime_minutes: 0 },
        principalToken,
      );
      assert.equal(invalid.status, 400);
    });
  });
});
