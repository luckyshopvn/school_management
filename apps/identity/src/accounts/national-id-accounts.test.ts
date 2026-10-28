import assert from 'node:assert/strict';
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { hash, parseOptions } from '@node-rs/argon2';
import { maskLoginIdentifier, nationalIdProblem } from '@school-management/shared';
import { passwordHashParameters, passwordNeedsRehash } from '../authentication/password.js';
import { OrganizationDirectory, type OrgUnitSummary } from './organization-directory.js';
import { accountKindsOf } from './national-id.js';
import {
  createTestUser,
  errorCode,
  getJson,
  postJson,
  startTestApplication,
  TEST_PASSWORD,
  type TestContext,
} from '../test-support.js';

// Quy tắc tài khoản trường theo số CCCD, loại tài khoản theo kênh, mật khẩu mặc định có hạn, băm argon2id tường minh (YCTD-311);
// kịch bản CT-1511 đến CT-1518. Mật khẩu mặc định là giá trị thử sinh ngẫu nhiên, không phải giá trị thật của môi trường chạy
const DEFAULT_INITIAL_PASSWORD = `Thu${randomBytes(4).toString('hex')}9`;
const branchA = randomUUID();

class FakeOrganizationDirectory extends OrganizationDirectory {
  async listUnits(): Promise<OrgUnitSummary[]> {
    return [{ id: branchA, name: 'Phân hiệu A', unit_type: 'phan_hieu', status: 'active' }];
  }
}

// Số CCCD ngẫu nhiên hợp lệ: mã tỉnh 001 (Hà Nội), số thứ 4 là 0 (nam, thế kỷ 20), sinh năm 1985
function randomNationalId(): string {
  return `001085${randomInt(0, 1_000_000).toString().padStart(6, '0')}`;
}

describe('Quy tắc số CCCD và nhận diện (thuần)', () => {
  it('CT-1511: kiểm 12 chữ số, mã tỉnh, năm sinh; che 4 số cuối', () => {
    assert.equal(nationalIdProblem('001085123456'), null);
    assert.equal(nationalIdProblem('001085123456', 1985), null);
    assert.match(nationalIdProblem('00108512345') ?? '', /12 chữ số/);
    assert.match(nationalIdProblem('00108512345a') ?? '', /12 chữ số/);
    assert.match(nationalIdProblem('003085123456') ?? '', /mã tỉnh 003/);
    assert.match(nationalIdProblem('001085123456', 2001) ?? '', /năm sinh/);
    // Số thứ 4 là 2 hoặc 3 là thế kỷ 21
    assert.equal(nationalIdProblem('079322123456', 2022), null);
    assert.equal(maskLoginIdentifier('001085123456'), '********3456');
    assert.equal(maskLoginIdentifier('gv.toan'), 'gv.toan');
    assert.equal(maskLoginIdentifier(null), null);
  });

  it('CT-1512: loại tài khoản theo vai trò; một người vừa là giáo viên vừa là phụ huynh có hai loại', () => {
    assert.deepEqual([...accountKindsOf(['VT-07', 'VT-14'], 'VT-21')].sort(), ['parent', 'staff']);
    assert.deepEqual([...accountKindsOf(['VT-21'], 'VT-21')], ['student']);
    assert.equal(accountKindsOf([], 'VT-21').size, 0);
  });

  it('CT-1513: tham số argon2id tường minh; giá trị băm tham số cũ yếu hơn thì cần băm lại', async () => {
    const parameters = passwordHashParameters();
    assert.ok(parameters.memoryCost >= 19_456 && parameters.timeCost >= 2);
    const weak = await hash('MatKhau2026', { memoryCost: 19_456, timeCost: 2, parallelism: 1 });
    assert.equal(passwordNeedsRehash(weak), true);
    const current = await hash('MatKhau2026', parameters);
    assert.equal(passwordNeedsRehash(current), false);
    assert.equal(passwordNeedsRehash('khong-phai-argon2'), false);
  });
});

describe('Dịch vụ định danh: tài khoản theo số CCCD', () => {
  let context: TestContext;
  let principalToken: string;

  const login = (loginIdentifier: string, password: string, channel = 'portal') =>
    postJson(`${context.baseUrl}/auth/login`, { login: loginIdentifier, password, channel });
  const createAccount = (body: Record<string, unknown>) => postJson(`${context.baseUrl}/users`, body, principalToken);

  before(async () => {
    context = await startTestApplication({
      organizationDirectory: new FakeOrganizationDirectory(),
      defaultInitialPassword: DEFAULT_INITIAL_PASSWORD,
    });
    const principal = await createTestUser(context.database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
    principalToken = (await login(principal.username, principal.password)).body.access_token as string;
  });

  after(async () => {
    await context.close();
  });

  it('CT-1514: tạo tài khoản bằng số CCCD: tên đăng nhập là số CCCD, mật khẩu mặc định có hạn 7 ngày, nhật ký và danh sách chỉ hiện dạng che', async () => {
    const nationalId = randomNationalId();
    const created = await createAccount({
      full_name: 'Giáo viên CCCD',
      national_id: nationalId,
      roles: [{ role_code: 'VT-07', org_unit_id: branchA }],
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.temporary_password, null);
    assert.equal(created.body.uses_initial_password, true);
    const account = created.body.account as { id: string; username: string };
    assert.equal(account.username, nationalId);
    const row = await context.database
      .selectFrom('users')
      .select(['must_change_password', 'initial_password_expires_at', 'password_hash'])
      .where('id', '=', account.id)
      .executeTakeFirstOrThrow();
    assert.equal(row.must_change_password, true);
    const days = ((row.initial_password_expires_at?.getTime() ?? 0) - context.clock.now().getTime()) / 86_400_000;
    assert.ok(days > 6.9 && days <= 7, String(days));
    // Băm bằng tham số hiện hành, không lưu mật khẩu thô
    assert.equal(parseOptions(row.password_hash ?? '').memoryCost, passwordHashParameters().memoryCost);
    assert.ok(!(row.password_hash ?? '').includes(DEFAULT_INITIAL_PASSWORD));
    const audit = await context.database
      .selectFrom('identity_audit_logs')
      .select('after_data')
      .where('entity_id', '=', account.id)
      .where('action', '=', 'create')
      .executeTakeFirstOrThrow();
    assert.ok(!JSON.stringify(audit.after_data).includes(nationalId));

    const list = await getJson(`${context.baseUrl}/users?q=${encodeURIComponent('Giáo viên CCCD')}`, principalToken);
    const listed = (list.body.items as Array<{ id: string; username: string }>).find((item) => item.id === account.id);
    assert.equal(listed?.username, `********${nationalId.slice(-4)}`);

    // Gõ thẳng 12 chữ số vào ô tên đăng nhập cũng theo quy tắc CCCD
    const typed = await createAccount({
      full_name: 'Cán bộ gõ CCCD',
      username: randomNationalId(),
      roles: [{ role_code: 'VT-07', org_unit_id: branchA }],
    });
    assert.equal(typed.status, 201, JSON.stringify(typed.body));
    assert.equal(typed.body.uses_initial_password, true);
  });

  it('CT-1515: số CCCD sai rõ ràng bị từ chối; trùng số CCCD báo trùng', async () => {
    for (const nationalId of ['12345', '999085123456', '00108512345x']) {
      const rejected = await createAccount({
        full_name: 'Sai CCCD',
        national_id: nationalId,
        roles: [{ role_code: 'VT-07', org_unit_id: branchA }],
      });
      assert.equal(rejected.status, 400, nationalId);
      assert.equal(errorCode(rejected.body), 'ERR_VALIDATION');
    }
    const nationalId = randomNationalId();
    const input = {
      full_name: 'Trùng',
      national_id: nationalId,
      roles: [{ role_code: 'VT-07', org_unit_id: branchA }],
    };
    assert.equal((await createAccount(input)).status, 201);
    assert.equal((await createAccount(input)).status, 409);
  });

  it('CT-1516: đăng nhập lần đầu bằng mật khẩu mặc định phải đổi mật khẩu; quá hạn thì không vào được, quản trị đặt lại', async () => {
    const nationalId = randomNationalId();
    const created = await createAccount({
      full_name: 'Phụ huynh CCCD',
      national_id: nationalId,
      roles: [{ role_code: 'VT-14', org_unit_id: branchA }],
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const userId = (created.body.account as { id: string }).id;

    const first = await login(nationalId, DEFAULT_INITIAL_PASSWORD, 'parent');
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(first.body.password_change_required, true);

    // Quá hạn mà chưa đổi
    await context.database
      .updateTable('users')
      .set({ initial_password_expires_at: new Date(context.clock.now().getTime() - 1000) })
      .where('id', '=', userId)
      .execute();
    const expired = await login(nationalId, DEFAULT_INITIAL_PASSWORD, 'parent');
    assert.equal(expired.status, 401);
    assert.match(JSON.stringify(expired.body), /hết hạn/);
    const events = await context.database
      .selectFrom('security_events')
      .select(['event_type', 'login_identifier'])
      .where('user_id', '=', userId)
      .execute();
    assert.ok(events.some((event) => event.event_type === 'login_initial_password_expired'));
    assert.ok(events.every((event) => event.login_identifier === null || !event.login_identifier.includes(nationalId)));

    // Quản trị đặt lại: mật khẩu tạm không có hạn mật khẩu mặc định; đổi xong vào bình thường
    const reset = await postJson(`${context.baseUrl}/users/${userId}/reset-password`, {}, principalToken);
    assert.equal(reset.status, 200, JSON.stringify(reset.body));
    const temporary = reset.body.temporary_password as string;
    const again = await login(nationalId, temporary, 'parent');
    assert.equal(again.status, 200);
    const changed = await postJson(
      `${context.baseUrl}/auth/change-password`,
      { current_password: temporary, new_password: 'MatKhauMoi2027' },
      again.body.access_token as string,
    );
    assert.equal(changed.status, 200, JSON.stringify(changed.body));
    const row = await context.database
      .selectFrom('users')
      .select(['must_change_password', 'initial_password_expires_at'])
      .where('id', '=', userId)
      .executeTakeFirstOrThrow();
    assert.deepEqual(row, { must_change_password: false, initial_password_expires_at: null });
  });

  it('CT-1517: loại tài khoản theo ứng dụng: phụ huynh không vào cổng quản trị, cán bộ không vào ứng dụng phụ huynh, người có cả hai vào được cả hai', async () => {
    const parent = await createTestUser(context.database, { roles: [{ roleCode: 'VT-14', orgUnitId: branchA }] });
    const teacher = await createTestUser(context.database, { roles: [{ roleCode: 'VT-07', orgUnitId: branchA }] });
    const both = await createTestUser(context.database, {
      roles: [
        { roleCode: 'VT-07', orgUnitId: branchA },
        { roleCode: 'VT-14', orgUnitId: branchA },
      ],
    });
    assert.equal((await login(parent.username, TEST_PASSWORD, 'portal')).status, 401);
    assert.equal((await login(parent.username, TEST_PASSWORD, 'teacher')).status, 401);
    assert.equal((await login(parent.username, TEST_PASSWORD, 'parent')).status, 200);
    assert.equal((await login(teacher.username, TEST_PASSWORD, 'parent')).status, 401);
    assert.equal((await login(teacher.username, TEST_PASSWORD, 'teacher')).status, 200);
    for (const channel of ['portal', 'teacher', 'parent']) {
      assert.equal((await login(both.username, TEST_PASSWORD, channel)).status, 200, channel);
    }
    assert.equal((await login(both.username, TEST_PASSWORD, 'student')).status, 401);
  });

  it('CT-1518: đăng nhập đúng với giá trị băm tham số cũ thì băm lại bằng tham số hiện hành', async () => {
    const weak = await hash(TEST_PASSWORD, { memoryCost: 19_456, timeCost: 2, parallelism: 1 });
    const user = await createTestUser(context.database, {
      roles: [{ roleCode: 'VT-07', orgUnitId: branchA }],
      passwordHash: weak,
    });
    assert.equal((await login(user.username, TEST_PASSWORD)).status, 200);
    const row = await context.database
      .selectFrom('users')
      .select('password_hash')
      .where('id', '=', user.id)
      .executeTakeFirstOrThrow();
    assert.notEqual(row.password_hash, weak);
    assert.equal(passwordNeedsRehash(row.password_hash ?? ''), false);
    assert.equal((await login(user.username, TEST_PASSWORD)).status, 200);
  });
});
