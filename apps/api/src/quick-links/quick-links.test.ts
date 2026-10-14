import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  MAX_QUICK_LINKS,
  PORTAL_QUICK_LINK_PATHS,
  PORTAL_WORKSPACES,
  listPortalMenuEntries,
  type PortalMenuNode,
} from '@school-management/shared';
import { sendJson, startApiTestEnvironment, type ApiTestEnvironment, type LoggedInUser } from '../test-support.js';
import { parseQuickLinks } from './quick-links.js';

// Truy cập nhanh trên trang chủ cổng quản trị (DT-14 phần 14b, YCTD-102); kịch bản CT-14b-1 đến CT-14b-8
const errorOf = (body: Record<string, unknown>) =>
  (body.error ?? {}) as { code?: string; details?: Array<{ field: string; message: string }> };

describe('Kiểm tra danh sách lối tắt', () => {
  it('nhận danh sách hợp lệ, cắt khoảng trắng nhãn và giữ thứ tự gửi lên', () => {
    assert.deepEqual(
      parseQuickLinks({
        links: [
          { path: '/children', label: ' Hồ sơ trẻ ' },
          { path: '/attendance', label: 'Điểm danh' },
        ],
      }),
      [
        { path: '/children', label: 'Hồ sơ trẻ' },
        { path: '/attendance', label: 'Điểm danh' },
      ],
    );
    assert.deepEqual(parseQuickLinks({ links: [] }), []);
  });

  it('từ chối đường dẫn ngoài danh sách cho phép, đường dẫn trùng và nhãn rỗng', () => {
    for (const links of [
      [{ path: '/khong-co', label: 'Lạ' }],
      [{ path: 'https://example.com', label: 'Ngoài' }],
      [{ path: '/', label: 'Trang chủ' }],
      [{ path: '/change-password', label: 'Đổi mật khẩu' }],
      [
        { path: '/children', label: 'A' },
        { path: '/children', label: 'B' },
      ],
      [{ path: '/children', label: '   ' }],
      [{ path: '/children', label: 'x'.repeat(101) }],
      [{ path: 42, label: 'Số' }],
    ]) {
      assert.throws(() => parseQuickLinks({ links }), { code: 'ERR_VALIDATION' });
    }
    assert.throws(() => parseQuickLinks({}), { code: 'ERR_VALIDATION' });
    assert.throws(() => parseQuickLinks(undefined), { code: 'ERR_VALIDATION' });
  });

  it(`không quá ${MAX_QUICK_LINKS} lối tắt`, () => {
    const links = PORTAL_QUICK_LINK_PATHS.slice(0, MAX_QUICK_LINKS + 1).map((path) => ({ path, label: path }));
    assert.throws(() => parseQuickLinks({ links }), { code: 'ERR_VALIDATION' });
    assert.equal(parseQuickLinks({ links: links.slice(0, MAX_QUICK_LINKS) }).length, MAX_QUICK_LINKS);
  });
});

// Cây menu ngang của cổng quản trị (DT-15 phần 15a): mỗi trang chỉ ở một chỗ, ghim được vào Truy cập nhanh, số thứ bậc
// của mục con nối tiếp số của mục cha
describe('Cây menu cổng quản trị', () => {
  it('mỗi trang chỉ có ở một mục menu và đều ghim được vào Truy cập nhanh', () => {
    const paths = listPortalMenuEntries().map((entry) => entry.node.path);
    assert.equal(new Set(paths).size, paths.length);
    for (const path of paths) {
      assert.ok((PORTAL_QUICK_LINK_PATHS as readonly string[]).includes(path), path);
    }
  });

  it('số thứ bậc dạng 1., 1.1., 1.1.1. nối tiếp mục cha, không trùng trong một phân hệ; nhóm có mục con, lá có đường dẫn', () => {
    const check = (nodes: PortalMenuNode[], parent: string, seen: Set<string>) => {
      for (const node of nodes) {
        assert.match(node.number, /^(\d+\.)+$/);
        assert.ok(node.number.startsWith(parent), node.number);
        assert.equal(node.number.split('.').length, parent.split('.').length + 1, node.number);
        assert.ok(!seen.has(node.number), node.number);
        seen.add(node.number);
        assert.ok(Boolean(node.path) !== Boolean(node.children?.length), node.number);
        check(node.children ?? [], node.number, seen);
      }
    };
    for (const workspace of PORTAL_WORKSPACES) {
      check(workspace.menu, '', new Set());
    }
    assert.equal(new Set(PORTAL_WORKSPACES.map((workspace) => workspace.key)).size, PORTAL_WORKSPACES.length);
  });
});

describe('Điểm cuối truy cập nhanh', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let accountant: LoggedInUser;
  const url = () => `${environment.baseUrl}/me/quick-links`;

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    accountant = await environment.loginAs('VT-02', null);
  });

  after(async () => {
    await environment.close();
  });

  it('CT-14b-1: chưa đăng nhập thì bị từ chối', async () => {
    assert.equal((await sendJson('GET', url(), undefined)).status, 401);
    assert.equal((await sendJson('PUT', url(), undefined, { links: [] })).status, 401);
  });

  it('CT-14b-2: tài khoản mới chưa có lối tắt', async () => {
    const response = await sendJson('GET', url(), principal.accessToken);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, []);
  });

  it('CT-14b-3: lưu rồi đọc lại đúng thứ tự, vị trí đánh từ 0', async () => {
    const saved = await sendJson('PUT', url(), principal.accessToken, {
      links: [
        { path: '/attendance', label: 'Điểm danh' },
        { path: '/children', label: 'Hồ sơ trẻ' },
        { path: '/reports', label: 'Báo cáo' },
      ],
    });
    assert.equal(saved.status, 200);
    const read = await sendJson('GET', url(), principal.accessToken);
    assert.deepEqual(read.body, [
      { path: '/attendance', label: 'Điểm danh', position: 0 },
      { path: '/children', label: 'Hồ sơ trẻ', position: 1 },
      { path: '/reports', label: 'Báo cáo', position: 2 },
    ]);
  });

  it('CT-14b-4: đổi thứ tự và bỏ một lối tắt bằng cách gửi lại cả danh sách', async () => {
    const saved = await sendJson('PUT', url(), principal.accessToken, {
      links: [
        { path: '/reports', label: 'Báo cáo' },
        { path: '/attendance', label: 'Điểm danh' },
      ],
    });
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.body, [
      { path: '/reports', label: 'Báo cáo', position: 0 },
      { path: '/attendance', label: 'Điểm danh', position: 1 },
    ]);
  });

  it('CT-14b-5: lối tắt riêng từng tài khoản', async () => {
    const other = await sendJson('GET', url(), accountant.accessToken);
    assert.deepEqual(other.body, []);
    await sendJson('PUT', url(), accountant.accessToken, { links: [{ path: '/debts', label: 'Công nợ' }] });
    const mine = await sendJson('GET', url(), principal.accessToken);
    assert.equal((mine.body as unknown as unknown[]).length, 2);
  });

  it('CT-14b-6: đường dẫn ngoài danh sách cho phép bị từ chối, dữ liệu cũ giữ nguyên', async () => {
    const rejected = await sendJson('PUT', url(), principal.accessToken, {
      links: [{ path: '/../admin', label: 'Lạ' }],
    });
    assert.equal(rejected.status, 400);
    assert.equal(errorOf(rejected.body).code, 'ERR_VALIDATION');
    assert.equal(errorOf(rejected.body).details?.[0]?.field, 'links[0].path');
    const read = await sendJson('GET', url(), principal.accessToken);
    assert.equal((read.body as unknown as unknown[]).length, 2);
  });

  it(`CT-14b-7: quá ${MAX_QUICK_LINKS} lối tắt hoặc trùng trang bị từ chối`, async () => {
    const tooMany = PORTAL_QUICK_LINK_PATHS.slice(0, MAX_QUICK_LINKS + 1).map((path) => ({ path, label: path }));
    assert.equal((await sendJson('PUT', url(), principal.accessToken, { links: tooMany })).status, 400);
    const duplicated = await sendJson('PUT', url(), principal.accessToken, {
      links: [
        { path: '/debts', label: 'Công nợ' },
        { path: '/debts', label: 'Công nợ 2' },
      ],
    });
    assert.equal(duplicated.status, 400);
  });

  it('CT-14b-8: gửi danh sách rỗng xóa hết lối tắt', async () => {
    const cleared = await sendJson('PUT', url(), principal.accessToken, { links: [] });
    assert.equal(cleared.status, 200);
    assert.deepEqual(cleared.body, []);
  });
});
