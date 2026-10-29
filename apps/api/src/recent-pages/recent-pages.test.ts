import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { listPortalMenuEntries } from '@school-management/shared';
import { sendJson, startApiTestEnvironment, type ApiTestEnvironment, type LoggedInUser } from '../test-support.js';
import { parseSearchText } from '../global-search/global-search.js';
import { RECENT_PAGES_SHOWN, parseRecentPath } from './recent-pages.js';

// Nhóm "Hay dùng" và ô tìm chung học sinh, cán bộ của cổng quản trị (YCTD-337, GD-180); kịch bản CT-337-1 đến CT-337-6
describe('Kiểm tra đầu vào Hay dùng và tìm chung', () => {
  it('chỉ nhận đường dẫn là mục menu của cổng quản trị', () => {
    assert.equal(parseRecentPath('/children'), '/children');
    for (const path of ['/', '/khong-co', 'https://example.com', '/change-password', 42, undefined]) {
      assert.throws(() => parseRecentPath(path), { code: 'ERR_VALIDATION' });
    }
  });

  it('từ khóa tìm từ 2 đến 100 ký tự, cắt khoảng trắng', () => {
    assert.equal(parseSearchText('  Bảo '), 'Bảo');
    for (const text of ['', ' a ', 'x'.repeat(101), undefined, 7]) {
      assert.throws(() => parseSearchText(text), { code: 'ERR_VALIDATION' });
    }
  });
});

describe('Điểm cuối Hay dùng và tìm chung', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let teacher: LoggedInUser;
  const recentUrl = () => `${environment.baseUrl}/me/recent-pages`;
  const searchUrl = (text: string) => `${environment.baseUrl}/search?q=${encodeURIComponent(text)}`;

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    teacher = await environment.loginAs('VT-07', null);
  });

  after(async () => {
    await environment.close();
  });

  it('CT-337-1: chưa đăng nhập thì bị từ chối', async () => {
    assert.equal((await sendJson('GET', recentUrl(), undefined)).status, 401);
    assert.equal((await sendJson('POST', recentUrl(), undefined, { path: '/children' })).status, 401);
    assert.equal((await sendJson('GET', searchUrl('Bảo'), undefined)).status, 401);
  });

  it('CT-337-2: ghi trang vừa mở; mở lại thì lên đầu; hiện tối đa 8 trang mới nhất', async () => {
    assert.deepEqual((await sendJson('GET', recentUrl(), principal.accessToken)).body, []);
    const paths = [...new Set(listPortalMenuEntries().map((entry) => entry.node.path))]
      .filter((path) => path !== '/children')
      .slice(0, RECENT_PAGES_SHOWN + 1);
    for (const path of ['/children', ...paths]) {
      assert.equal((await sendJson('POST', recentUrl(), principal.accessToken, { path })).status, 204);
    }
    assert.equal((await sendJson('POST', recentUrl(), principal.accessToken, { path: '/children' })).status, 204);
    const read = (await sendJson('GET', recentUrl(), principal.accessToken)).body as Array<{ path: string }>;
    assert.equal(read.length, RECENT_PAGES_SHOWN);
    assert.equal(read[0]?.path, '/children');
    assert.equal(read[1]?.path, paths.at(-1));
  });

  it('CT-337-3: bỏ một trang khỏi danh sách; danh sách riêng từng tài khoản', async () => {
    assert.equal((await sendJson('DELETE', `${recentUrl()}?path=%2Fchildren`, principal.accessToken)).status, 204);
    const read = (await sendJson('GET', recentUrl(), principal.accessToken)).body as Array<{ path: string }>;
    assert.ok(!read.some((page) => page.path === '/children'));
    assert.deepEqual((await sendJson('GET', recentUrl(), teacher.accessToken)).body, []);
  });

  it('CT-337-4: đường dẫn không thuộc menu thì báo lỗi', async () => {
    const response = await sendJson('POST', recentUrl(), principal.accessToken, { path: '/khong-co' });
    assert.equal(response.status, 400);
    assert.equal((await sendJson('DELETE', `${recentUrl()}?path=%2F`, principal.accessToken)).status, 400);
  });

  it('CT-337-5: tìm chung trả học sinh, cán bộ chỉ gồm tên, lớp hoặc đơn vị, đường dẫn', async () => {
    const response = await sendJson('GET', searchUrl('khong-co-ai-ten-nay'), principal.accessToken);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { students: [], staff: [] });
    const any = (await sendJson('GET', searchUrl('Ng'), principal.accessToken)).body as {
      students: Array<Record<string, unknown>>;
      staff: Array<Record<string, unknown>>;
    };
    for (const hit of [...any.students, ...any.staff]) {
      assert.deepEqual(Object.keys(hit).sort(), ['detail', 'id', 'name', 'path']);
    }
    assert.ok(any.students.length <= 5 && any.staff.length <= 5);
    assert.equal((await sendJson('GET', searchUrl('a'), principal.accessToken)).status, 400);
  });

  it('CT-337-6: người không có quyền xem nhóm nào thì nhóm đó trống, không báo lỗi cả lần tìm', async () => {
    const response = await sendJson('GET', searchUrl('Ng'), teacher.accessToken);
    assert.equal(response.status, 200);
    const body = response.body as { students: unknown[]; staff: unknown[] };
    assert.ok(Array.isArray(body.students) && Array.isArray(body.staff));
  });
});
