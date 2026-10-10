import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { Controller, Get } from '@nestjs/common';
import { getJson } from '@school-management/identity/testing';
import { createApplication } from '../create-application.js';
import { MemoryFileStorage } from '../files/file-storage.js';
import { startApiTestEnvironment, type ApiTestEnvironment } from '../test-support.js';
import { AuthenticatedUser, RequirePermission } from './authentication.guard.js';
import type { CurrentUser } from './current-user.js';

// Điểm cuối chỉ dùng trong kiểm thử để kiểm tra lớp vai trò và lớp đơn vị
@Controller('test-authorization')
class AuthorizationProbeController {
  @Get('children')
  @RequirePermission('P02.view')
  readChildren(@AuthenticatedUser() currentUser: CurrentUser) {
    return currentUser.organizationScope('P02.view');
  }

  @Get('child-approval')
  @RequirePermission('P02.approve')
  approveChild() {
    return { approved: true };
  }
}

// Ca kiểm thử theo 27_BO_CA_KIEM_THU_CHI_TIET/01_DINH_DANH_VA_P01.md
describe('Máy chủ API: kiểm tra mã phiên và quyền', () => {
  let environment: ApiTestEnvironment;
  let apiBaseUrl: string;
  const branchA = randomUUID();

  before(async () => {
    environment = await startApiTestEnvironment({ additionalControllers: [AuthorizationProbeController] });
    apiBaseUrl = environment.baseUrl;
  });

  after(async () => {
    await environment.close();
  });

  async function loginAs(roleCode: string, orgUnitId: string | null, mustChangePassword = false) {
    const user = await environment.loginAs(roleCode, orgUnitId, mustChangePassword);
    return { user: { id: user.userId }, accessToken: user.accessToken };
  }

  it('GET /api/v1/health không cần mã phiên', async () => {
    const response = await getJson(`${apiBaseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { status: 'ok', service: 'api' });
  });

  it('Thiếu mã phiên trả ERR_UNAUTHENTICATED', async () => {
    const response = await getJson(`${apiBaseUrl}/test-authorization/children`);
    assert.equal(response.status, 401);
    assert.equal((response.body.error as Record<string, unknown>).code, 'ERR_UNAUTHENTICATED');
  });

  it('CTC-DD-037: mã phiên sửa chữ ký bị từ chối, mã hợp lệ được xử lý', async () => {
    const { accessToken } = await loginAs('VT-03', branchA);
    const [header, payload, signature] = accessToken.split('.');
    const tampered = `${header}.${payload}.${signature?.startsWith('A') ? 'B' : 'A'}${signature?.slice(1)}`;
    assert.equal((await getJson(`${apiBaseUrl}/test-authorization/children`, tampered)).status, 401);
    assert.equal((await getJson(`${apiBaseUrl}/test-authorization/children`, accessToken)).status, 200);
  });

  it('CTC-DD-035: thu hồi vai trò thì yêu cầu kế tiếp bị từ chối ngay, không chờ phiên hết hạn', async () => {
    const { user, accessToken } = await loginAs('VT-03', branchA);
    assert.equal((await getJson(`${apiBaseUrl}/test-authorization/child-approval`, accessToken)).status, 200);
    await environment.identity.database.deleteFrom('user_roles').where('user_id', '=', user.id).execute();
    const rejected = await getJson(`${apiBaseUrl}/test-authorization/child-approval`, accessToken);
    assert.equal(rejected.status, 403);
    assert.equal((rejected.body.error as Record<string, unknown>).code, 'ERR_FORBIDDEN');
  });

  it('CTC-DD-036: khóa tài khoản thì yêu cầu kế tiếp bị từ chối ngay', async () => {
    const { user, accessToken } = await loginAs('VT-07', branchA);
    assert.equal((await getJson(`${apiBaseUrl}/test-authorization/children`, accessToken)).status, 200);
    await environment.identity.database
      .updateTable('users')
      .set({ status: 'locked' })
      .where('id', '=', user.id)
      .execute();
    assert.equal((await getJson(`${apiBaseUrl}/test-authorization/children`, accessToken)).status, 401);
  });

  it('CTC-DD-041: quản trị nền tảng VT-01 không đọc được dữ liệu nghiệp vụ', async () => {
    const { accessToken } = await loginAs('VT-01', null);
    const response = await getJson(`${apiBaseUrl}/test-authorization/children`, accessToken);
    assert.equal(response.status, 403);
  });

  it('BM-07: mã phiên còn bắt buộc đổi mật khẩu bị từ chối ở máy chủ API', async () => {
    const { accessToken } = await loginAs('VT-02', null, true);
    const response = await getJson(`${apiBaseUrl}/test-authorization/children`, accessToken);
    assert.equal(response.status, 403);
  });

  it('Lớp đơn vị: vai trò gán cho đơn vị chỉ có phạm vi đơn vị đó; Hiệu trưởng có phạm vi toàn trường', async () => {
    const manager = await loginAs('VT-03', branchA);
    const managerScope = await getJson(`${apiBaseUrl}/test-authorization/children`, manager.accessToken);
    assert.deepEqual(managerScope.body, { wholeSchool: false, orgUnitIds: [branchA] });

    const principal = await loginAs('VT-02', null);
    const principalScope = await getJson(`${apiBaseUrl}/test-authorization/children`, principal.accessToken);
    assert.deepEqual(principalScope.body, { wholeSchool: true, orgUnitIds: [] });
  });

  it('Không liên lạc được với dịch vụ định danh thì trả ERR_INTERNAL', async () => {
    const { accessToken } = await loginAs('VT-02', null);
    const isolatedApi = await createApplication(
      {
        tokenPublicKeyPem: environment.identity.tokenPublicKeyPem,
        identityBaseUrl: 'http://127.0.0.1:9',
        systemDatabaseUrl: environment.systemDatabaseUrl,
        schoolYearDatabasePrefix: environment.schoolYearDatabasePrefix,
        childDataEncryptionKey: Buffer.alloc(32),
        childDataHashKey: Buffer.alloc(32),
        objectStorage: null,
      },
      { additionalControllers: [AuthorizationProbeController], fileStorage: new MemoryFileStorage() },
    );
    await isolatedApi.listen(0);
    const port = (isolatedApi.getHttpServer().address() as AddressInfo).port;
    try {
      const response = await getJson(`http://127.0.0.1:${port}/api/v1/test-authorization/children`, accessToken);
      assert.equal(response.status, 500);
      assert.equal((response.body.error as Record<string, unknown>).code, 'ERR_INTERNAL');
    } finally {
      await isolatedApi.close();
    }
  });
});
