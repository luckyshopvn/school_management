import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { sql } from 'kysely';
import { openTestAcademicYear, sendJson, startApiTestEnvironment, type ApiTestEnvironment } from './test-support.js';

// Danh sách người dùng lọc, đếm và phân trang ngay trong câu truy vấn của dịch vụ định danh (DT-15 phần 15e, YCTD-109);
// kịch bản CT-15e-5 đến CT-15e-9. Cơ sở dữ liệu định danh dùng chung giữa các tệp kiểm thử nên mọi tài khoản ở đây mang
// một nhãn riêng trong họ tên và các ca lọc theo nhãn đó
describe('Danh sách người dùng phân trang trong câu truy vấn', () => {
  let environment: ApiTestEnvironment;
  let principal: string;
  let identityUrl = '';
  const units: Record<string, string> = {};
  const tag = `Luoi15e${randomUUID().replaceAll('-', '').slice(0, 8)}`;
  const accounts: Record<string, string> = {};

  interface ListBody {
    items: Array<{
      id: string;
      full_name: string;
      must_change_password: boolean;
      assignments: Array<{ role_code: string }>;
    }>;
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  }

  async function list(accessToken: string, parameters: Record<string, string>) {
    const response = await sendJson(
      'GET',
      `${identityUrl}/users?${new URLSearchParams(parameters).toString()}`,
      accessToken,
    );
    assert.equal(response.status, 200, JSON.stringify(response.body));
    return response.body as unknown as ListBody;
  }

  // Thêm thẳng tài khoản vào cơ sở dữ liệu định danh: họ tên mang nhãn, kèm các vai trò ở đơn vị cho trước
  async function insertAccount(
    key: string,
    options: {
      status?: 'active' | 'locked';
      mustChangePassword?: boolean;
      username?: string;
      roles?: Array<{ roleCode: string; unit: string | null }>;
    } = {},
  ) {
    const database = environment.identity.database;
    const user = await database
      .insertInto('users')
      .values({
        full_name: `${tag} ${key}`,
        username: options.username ?? `${tag.toLowerCase()}_${key.toLowerCase()}`,
        password_hash: null,
        status: options.status ?? 'active',
        must_change_password: options.mustChangePassword ?? false,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    for (const role of options.roles ?? []) {
      const roleRow = await database
        .selectFrom('roles')
        .select('id')
        .where('code', '=', role.roleCode)
        .executeTakeFirstOrThrow();
      await database
        .insertInto('user_roles')
        .values({ user_id: user.id, role_id: roleRow.id, org_unit_id: role.unit ? (units[role.unit] ?? null) : null })
        .execute();
    }
    accounts[key] = user.id;
  }

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
    ] as const) {
      const created = await sendJson('POST', `${environment.baseUrl}/org-units`, principal, {
        code,
        name: code,
        unit_type: type,
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      units[code] = created.body.id as string;
    }
    // A01..A05 giáo viên ở PH-A; B01 ở PH-B; AB01 ở cả hai; HT01 Hiệu trưởng; KVT01 chưa có vai trò; PH01 phụ huynh
    for (const index of [1, 2, 3, 4, 5]) {
      await insertAccount(`A0${index}`, {
        roles: [{ roleCode: 'VT-07', unit: 'PH-A' }],
        status: index === 5 ? 'locked' : 'active',
        mustChangePassword: index === 4,
      });
    }
    await insertAccount('B01', { roles: [{ roleCode: 'VT-07', unit: 'PH-B' }] });
    await insertAccount('AB01', {
      roles: [
        { roleCode: 'VT-07', unit: 'PH-A' },
        { roleCode: 'VT-06', unit: 'PH-B' },
      ],
    });
    await insertAccount('HT01', { roles: [{ roleCode: 'VT-02', unit: null }] });
    await insertAccount('KVT01');
    await insertAccount('PH01', { roles: [{ roleCode: 'VT-14', unit: null }], username: `${tag.toLowerCase()}_x%_` });
  });

  after(async () => {
    const database = environment.identity.database;
    const ids = Object.values(accounts);
    if (ids.length > 0) {
      await database.deleteFrom('user_roles').where('user_id', 'in', ids).execute();
      await database.deleteFrom('users').where('id', 'in', ids).execute();
    }
    await environment.close();
  });

  it('CT-15e-5: lọc theo tên nhân sự, sắp theo họ tên, tổng số và số trang đúng; trang 2 nối tiếp trang 1', async () => {
    const first = await list(principal, { full_name: tag, page: '1', page_size: '4' });
    assert.equal(first.total, 10);
    assert.equal(first.total_pages, 3);
    assert.deepEqual(
      first.items.map((item) => item.full_name),
      ['A01', 'A02', 'A03', 'A04'].map((key) => `${tag} ${key}`),
    );
    const second = await list(principal, { full_name: tag, page: '2', page_size: '4' });
    assert.deepEqual(
      second.items.map((item) => item.full_name),
      ['A05', 'AB01', 'B01', 'HT01'].map((key) => `${tag} ${key}`),
    );
    const third = await list(principal, { full_name: tag, page: '3', page_size: '4' });
    assert.equal(third.items.length, 2);
    // Trang vượt quá thì trống nhưng vẫn trả tổng số
    const beyond = await list(principal, { full_name: tag, page: '9', page_size: '4' });
    assert.equal(beyond.items.length, 0);
    assert.equal(beyond.total, 10);
    // Mỗi dòng vẫn kèm vai trò như trước
    assert.deepEqual(
      second.items.find((item) => item.id === accounts.AB01)?.assignments.map((assignment) => assignment.role_code),
      ['VT-06', 'VT-07'],
    );
  });

  it('CT-15e-6: lọc theo nhóm người dùng, trạng thái, trạng thái đổi mật khẩu, tên đăng nhập, từ khóa', async () => {
    const ids = (body: ListBody) => body.items.map((item) => item.id).sort();
    const pick = (...keys: string[]) => keys.map((key) => accounts[key]).sort();
    assert.deepEqual(
      ids(await list(principal, { full_name: tag, role_code: 'VT-07' })),
      pick('A01', 'A02', 'A03', 'A04', 'A05', 'AB01', 'B01'),
    );
    assert.deepEqual(ids(await list(principal, { full_name: tag, status: 'locked' })), pick('A05'));
    assert.deepEqual(ids(await list(principal, { full_name: tag, must_change_password: 'true' })), pick('A04'));
    assert.equal((await list(principal, { full_name: tag, must_change_password: 'false' })).total, 9);
    assert.deepEqual(ids(await list(principal, { login: `${tag.toLowerCase()}_b01` })), pick('B01'));
    // Ký tự "%" và "_" trong từ khóa được tìm nguyên văn
    assert.deepEqual(ids(await list(principal, { login: `${tag.toLowerCase()}_x%` })), pick('PH01'));
    assert.deepEqual(ids(await list(principal, { q: `${tag} hT01` })), pick('HT01'));
    assert.deepEqual(
      ids(await list(principal, { full_name: tag, role_code: 'VT-07', status: 'active', page_size: '2' })).length,
      2,
    );
    assert.equal((await list(principal, { full_name: tag, role_code: 'VT-07', status: 'active' })).total, 6);
  });

  it('CT-15e-7: quản lý theo đơn vị chỉ thấy tài khoản có mọi vai trò trong đơn vị của mình, tổng số tính sau phạm vi', async () => {
    const manager = await environment.loginAs('VT-03', units['PH-A'] ?? null);
    const body = await list(manager.accessToken, { full_name: tag, page_size: '2' });
    assert.equal(body.total, 5);
    assert.equal(body.total_pages, 3);
    const all = await list(manager.accessToken, { full_name: tag });
    assert.deepEqual(
      all.items.map((item) => item.id).sort(),
      ['A01', 'A02', 'A03', 'A04', 'A05'].map((key) => accounts[key]).sort(),
    );
    // Quản lý toàn trường (gán ở Trường chính) thấy mọi tài khoản có vai trò, trừ VT-01, VT-02
    const wholeSchool = await environment.loginAs('VT-03', units.TC ?? null);
    const visible = await list(wholeSchool.accessToken, { full_name: tag });
    assert.deepEqual(
      visible.items.map((item) => item.id).sort(),
      ['A01', 'A02', 'A03', 'A04', 'A05', 'AB01', 'B01', 'PH01'].map((key) => accounts[key]).sort(),
    );
    // Hiệu trưởng thấy cả tài khoản chưa có vai trò
    assert.equal((await list(principal, { full_name: tag })).total, 10);
  });

  it('CT-15e-8: tham số sai trả ERR_VALIDATION', async () => {
    for (const query of ['must_change_password=co', 'page=0', 'page_size=201', 'status=khac']) {
      const response = await sendJson('GET', `${identityUrl}/users?${query}`, principal);
      assert.equal(response.status, 400, query);
    }
  });

  it('CT-15e-9: với khoảng 30 nghìn tài khoản, một trang danh sách trả về nhanh', async () => {
    const database = environment.identity.database;
    const parentRole = await database
      .selectFrom('roles')
      .select('id')
      .where('code', '=', 'VT-14')
      .executeTakeFirstOrThrow();
    const bulkName = `${tag} Bulk`;
    const inserted = await sql<{ id: string }>`
      insert into users (full_name, username, password_hash, must_change_password)
      select ${bulkName} || ' ' || lpad(number::text, 5, '0'), ${`${tag.toLowerCase()}_bulk_`} || number, null, true
      from generate_series(1, 30000) as number
      returning id`.execute(database);
    const bulkIds = inserted.rows.map((row) => row.id);
    try {
      await sql`
        insert into user_roles (user_id, role_id, org_unit_id)
        select id, ${parentRole.id}, null from users where full_name like ${`${bulkName} %`}`.execute(database);
      await sql`analyze users`.execute(database);
      await sql`analyze user_roles`.execute(database);
      // Lần đầu làm nóng kết nối; đo lần sau
      await list(principal, { page_size: '20' });
      const started = performance.now();
      const body = await list(principal, { page: '2', page_size: '50', role_code: 'VT-14' });
      const elapsed = performance.now() - started;
      assert.ok(body.total >= 30000);
      assert.equal(body.items.length, 50);
      assert.ok(elapsed < 1500, `${elapsed} ms`);
      // Bulk 29990 đến Bulk 29999
      const searched = await list(principal, { full_name: `${bulkName} 2999`, page_size: '20' });
      assert.equal(searched.total, 10);
    } finally {
      for (let start = 0; start < bulkIds.length; start += 5000) {
        const chunk = bulkIds.slice(start, start + 5000);
        await database.deleteFrom('user_roles').where('user_id', 'in', chunk).execute();
        await database.deleteFrom('users').where('id', 'in', chunk).execute();
      }
    }
  });
});
