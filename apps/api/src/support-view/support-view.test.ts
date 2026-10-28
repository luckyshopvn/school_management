import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import {
  createPlatformOperatorWithTotp,
  OPERATOR_TEST_PASSWORD,
  operatorOtp,
} from '@school-management/identity/testing';
import { startMultiTenantApi, sendWithHost, type MultiTenantApi } from '../tenant-test-support.js';

// Chế độ xem của nhân viên hỗ trợ ở ứng dụng phụ huynh, học sinh (YCTD-315b), kịch bản CT-315b-1: phiên Admin vào thẳng ở kênh phụ
// huynh, học sinh chỉ đọc; chọn lớp, học sinh qua /support-view; tiêu đề học sinh đang xem chỉ có tác dụng ở phiên Admin. Dữ liệu giả
const CONSOLE_HOST = 'platform.e2e.localhost';

describe('chế độ xem của nhân viên hỗ trợ ở máy chủ API', () => {
  let environment: MultiTenantApi;
  let operatorToken = '';

  before(async () => {
    environment = await startMultiTenantApi({ label: 'xem', schools: ['alpha'] });
    environment.identity.configuration.platformConsoleHost = CONSOLE_HOST;
    const login = `admin-${Math.random().toString(36).slice(2, 8)}`;
    const created = await createPlatformOperatorWithTotp(
      environment.platform.platform,
      environment.platform.masterKey,
      {
        login,
        fullName: 'Quản trị nền tảng giả',
        password: OPERATOR_TEST_PASSWORD,
        role: 'quan_tri',
      },
    );
    const reply = await sendWithHost(environment.identityOrigin, {
      path: '/api/v1/auth/platform/login',
      host: CONSOLE_HOST,
      body: {
        login,
        password: OPERATOR_TEST_PASSWORD,
        otp_code: await operatorOtp(
          environment.platform.platform,
          created.id,
          created.secret,
          environment.identity.clock.now(),
        ),
      },
    });
    operatorToken = reply.body.access_token as string;
    const year = await environment.call('alpha', 'POST', '/academic-years', { name: '2026-2027' });
    const calendar = {
      first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    };
    assert.equal(
      (await environment.call('alpha', 'PUT', `/academic-years/${year.body.id as string}/calendar`, calendar)).status,
      200,
    );
    assert.equal(year.status, 201, JSON.stringify(year.body));
    assert.equal(
      (await environment.call('alpha', 'POST', `/academic-years/${year.body.id as string}/open`)).status,
      200,
    );
  });

  after(async () => {
    await environment?.close();
  });

  async function adminToken(channel: 'parent' | 'student'): Promise<string> {
    const started = await sendWithHost(environment.identityOrigin, {
      path: `/api/v1/auth/platform/schools/${environment.platform.school('alpha').code}/support-sessions`,
      host: CONSOLE_HOST,
      token: operatorToken,
      body: {},
    });
    assert.equal(started.status, 200, JSON.stringify(started.body));
    const code = new URL((started.body.handoff as { path: string }).path, 'http://x').searchParams.get('code');
    const exchanged = await sendWithHost(environment.identityOrigin, {
      path: '/api/v1/auth/support/exchange',
      host: environment.hosts.alpha,
      body: { code, channel },
    });
    assert.equal(exchanged.status, 200, JSON.stringify(exchanged.body));
    return exchanged.body.access_token as string;
  }

  it('CT-315b-1: Admin chọn lớp, học sinh ở kênh phụ huynh, học sinh; chỉ đọc; người khác không dùng được chế độ xem', async () => {
    const parent = await adminToken('parent');
    const classes = await environment.call('alpha', 'GET', '/support-view/classes', undefined, parent);
    assert.equal(classes.status, 200, JSON.stringify(classes.body));
    assert.ok(Array.isArray(classes.body.items));
    // Kênh phụ huynh của phiên Admin chỉ đọc: yêu cầu ghi bị chặn
    const write = await environment.call(
      'alpha',
      'POST',
      '/org-units',
      { code: 'X', name: 'Thử', unit_type: 'truong_chinh' },
      parent,
    );
    assert.equal(write.status, 403, JSON.stringify(write.body));
    assert.match(String((write.body.error as { message: string }).message), /chỉ đọc/);
    // Tài khoản thường của trường không dùng được chế độ xem
    assert.equal((await environment.call('alpha', 'GET', '/support-view/classes')).status, 403);

    const student = await adminToken('student');
    const studentClasses = await environment.call('alpha', 'GET', '/student/support-view/classes', undefined, student);
    assert.equal(studentClasses.status, 200, JSON.stringify(studentClasses.body));
    // Chưa chọn học sinh, hoặc học sinh không có: trang đầu báo chưa nối học sinh, không lộ dữ liệu
    const profile = await sendWithHost(environment.apiOrigin, {
      path: '/api/v1/student/profile',
      host: environment.hosts.alpha,
      token: student,
      headers: { 'x-support-view-child': randomUUID() },
    });
    assert.equal(profile.status, 403, JSON.stringify(profile.body));
    // Kênh portal không gọi được nhóm /student/*
    const portal = await environment.call('alpha', 'GET', '/student/support-view/classes');
    assert.equal(portal.status, 403);
  });
});
