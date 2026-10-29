import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { OrganizationDirectory, type OrgUnitSummary } from './organization-directory.js';
import { createTestUser, postJson, startTestApplication, type TestContext, type TestUser } from '../test-support.js';

// Phạm vi đơn vị của tài khoản đích khi cấp lại mật khẩu học sinh và khi khóa tài khoản do chấm dứt hợp đồng (YCTD-378);
// kịch bản CT-1714, CT-1715
const rootUnit = randomUUID();
const branchA = randomUUID();
const branchB = randomUUID();

class FakeOrganizationDirectory extends OrganizationDirectory {
  async listUnits(): Promise<OrgUnitSummary[]> {
    return [
      { id: rootUnit, name: 'Trường chính', unit_type: 'truong_chinh', status: 'active' },
      { id: branchA, name: 'Phân hiệu A', unit_type: 'phan_hieu', status: 'active' },
      { id: branchB, name: 'Phân hiệu B', unit_type: 'phan_hieu', status: 'active' },
    ];
  }
}

describe('Phạm vi đơn vị của tài khoản đích (YCTD-378)', () => {
  let context: TestContext;

  const tokenOf = async (user: TestUser) =>
    (
      await postJson(`${context.baseUrl}/auth/login`, {
        login: user.username,
        password: user.password,
        channel: 'portal',
      })
    ).body.access_token as string;
  const syncStudent = (token: string, username: string, orgUnitId: string) =>
    postJson(
      `${context.baseUrl}/users/student-accounts/sync`,
      { accounts: [{ username, full_name: 'Học sinh thử', password: 'Abcd1234', org_unit_id: orgUnitId }] },
      token,
    );
  const studentUnitOf = async (username: string) =>
    (
      await context.database
        .selectFrom('users')
        .innerJoin('user_roles', 'user_roles.user_id', 'users.id')
        .innerJoin('roles', 'roles.id', 'user_roles.role_id')
        .select('user_roles.org_unit_id')
        .where('users.username', '=', username)
        .where('roles.code', '=', 'VT-21')
        .executeTakeFirstOrThrow()
    ).org_unit_id;
  const statusOf = async (userId: string) =>
    (await context.database.selectFrom('users').select('status').where('id', '=', userId).executeTakeFirstOrThrow())
      .status;

  before(async () => {
    context = await startTestApplication({ organizationDirectory: new FakeOrganizationDirectory() });
  });

  after(async () => {
    await context.close();
  });

  it('CT-1714: người quản lý tài khoản ở một đơn vị chỉ cấp lại mật khẩu, chuyển đơn vị cho học sinh thuộc đơn vị mình', async () => {
    const managerA = await createTestUser(context.database, { roles: [{ roleCode: 'VT-03', orgUnitId: branchA }] });
    const managerB = await createTestUser(context.database, { roles: [{ roleCode: 'VT-03', orgUnitId: branchB }] });
    const principal = await createTestUser(context.database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
    const tokenA = await tokenOf(managerA);
    const tokenB = await tokenOf(managerB);
    const username = `hs.${randomUUID().slice(0, 8)}`;

    // Đơn vị B tạo tài khoản học sinh của mình
    const created = await syncStudent(tokenB, username, branchB);
    assert.equal(created.status, 200, JSON.stringify(created.body));
    const before = await context.database
      .selectFrom('users')
      .select('password_hash')
      .where('username', '=', username)
      .executeTakeFirstOrThrow();

    // Đơn vị A không cấp lại mật khẩu, không chuyển được học sinh của đơn vị B về đơn vị mình
    const refused = await syncStudent(tokenA, username, branchA);
    assert.equal(refused.status, 403, JSON.stringify(refused.body));
    assert.equal(await studentUnitOf(username), branchB);
    const after = await context.database
      .selectFrom('users')
      .select('password_hash')
      .where('username', '=', username)
      .executeTakeFirstOrThrow();
    assert.equal(after.password_hash, before.password_hash);

    // Đơn vị B cấp lại mật khẩu cho học sinh của mình
    assert.equal((await syncStudent(tokenB, username, branchB)).status, 200);
    // Đơn vị B không chuyển học sinh sang đơn vị A khi không có quyền ở đơn vị A
    assert.equal((await syncStudent(tokenB, username, branchA)).status, 403);
    assert.equal(await studentUnitOf(username), branchB);
    // Người có phạm vi toàn trường chuyển được
    assert.equal((await syncStudent(await tokenOf(principal), username, branchA)).status, 200);
    assert.equal(await studentUnitOf(username), branchA);
  });

  it('CT-1715: chấm dứt hợp đồng chỉ khóa tài khoản có vai trò nhân sự trong phạm vi người thao tác', async () => {
    const staffManagerA = await createTestUser(context.database, {
      roles: [{ roleCode: 'VT-06', orgUnitId: branchA }],
    });
    const teacherA = await createTestUser(context.database, { roles: [{ roleCode: 'VT-07', orgUnitId: branchA }] });
    const teacherB = await createTestUser(context.database, { roles: [{ roleCode: 'VT-07', orgUnitId: branchB }] });
    const parentOnly = await createTestUser(context.database, { roles: [{ roleCode: 'VT-14', orgUnitId: branchA }] });
    const token = await tokenOf(staffManagerA);
    const terminate = (userId: string) =>
      postJson(`${context.baseUrl}/users/${userId}/terminate-employment`, { org_unit_id: branchA }, token);

    // Tài khoản ở đơn vị khác: bị từ chối dù gửi đơn vị của người thao tác
    assert.equal((await terminate(teacherB.id)).status, 403);
    assert.equal(await statusOf(teacherB.id), 'active');
    // Tài khoản không có vai trò nhân sự: bị từ chối
    const parentRefused = await terminate(parentOnly.id);
    assert.equal(parentRefused.status, 422, JSON.stringify(parentRefused.body));
    assert.equal(await statusOf(parentOnly.id), 'active');
    // Giáo viên trong đơn vị: khóa được
    const locked = await terminate(teacherA.id);
    assert.equal(locked.status, 200, JSON.stringify(locked.body));
    assert.equal(await statusOf(teacherA.id), 'locked');
  });
});
