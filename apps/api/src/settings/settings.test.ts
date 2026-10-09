import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { openTestAcademicYear, sendJson, startApiTestEnvironment, type ApiTestEnvironment } from '../test-support.js';

// Cấu hình theo đơn vị và nhật ký thao tác; ca kiểm thử theo 27_BO_CA_KIEM_THU_CHI_TIET/01_DINH_DANH_VA_P01.md mục 4.7, 4.8
describe('Cấu hình theo đơn vị và nhật ký thao tác', () => {
  let environment: ApiTestEnvironment;
  let principal: string;
  const units: Record<string, string> = {};

  before(async () => {
    environment = await startApiTestEnvironment();
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
      units[code] = created.body.id as string;
    }
  });

  after(async () => {
    await environment.close();
  });

  const readSettings = async (accessToken: string, unit: string) =>
    sendJson('GET', `${environment.baseUrl}/settings?org_unit_id=${units[unit]}`, accessToken);
  const writeSettings = async (accessToken: string, unit: string, values: Record<string, unknown>) =>
    sendJson('PUT', `${environment.baseUrl}/settings`, accessToken, { org_unit_id: units[unit], values });
  const settingOf = (body: unknown, key: string) =>
    (body as Array<{ key: string; value: unknown; source: string }>).find((item) => item.key === key);

  it('CTC-P01-044: ngày chốt học phí mặc định mùng 1 tháng sau; không có mục ngày chốt công; mốc nhắc nợ 3, 7, 15', async () => {
    const response = await readSettings(principal, 'PH-A');
    assert.equal(response.status, 200);
    assert.equal(settingOf(response.body, 'tuition_closing_day')?.value, 'next_month_first');
    assert.equal(settingOf(response.body, 'tuition_closing_day')?.source, 'default');
    assert.equal(settingOf(response.body, 'attendance_closing_day'), undefined);
    assert.equal((await writeSettings(principal, 'PH-A', { attendance_closing_day: 25 })).status, 400);
    assert.deepEqual(settingOf(response.body, 'debt_reminder_days')?.value, [3, 7, 15]);
    assert.equal(settingOf(response.body, 'payment_due_day')?.source, 'missing');
    assert.equal(settingOf(response.body, 'max_class_size')?.source, 'missing');
  });

  it('YCTD-40: đơn vị chưa cấu hình lấy giá trị của Trường chính', async () => {
    assert.equal((await writeSettings(principal, 'TC', { payment_due_day: 10 })).status, 200);
    const response = await readSettings(principal, 'PH-A');
    assert.equal(settingOf(response.body, 'payment_due_day')?.value, 10);
    assert.equal(settingOf(response.body, 'payment_due_day')?.source, 'truong_chinh');
  });

  it('CTC-P01-045: QL-A đặt ngày chốt học phí của PH-A là 25; KT-A đọc thấy 25', async () => {
    const manager = await environment.loginAs('VT-03', units['PH-A'] ?? null);
    const written = await writeSettings(manager.accessToken, 'PH-A', { tuition_closing_day: 25 });
    assert.equal(written.status, 200, JSON.stringify(written.body));
    const accountant = await environment.loginAs('VT-04', units['PH-A'] ?? null);
    const response = await readSettings(accountant.accessToken, 'PH-A');
    assert.equal(response.status, 200);
    assert.equal(settingOf(response.body, 'tuition_closing_day')?.value, 25);
    assert.equal(settingOf(response.body, 'tuition_closing_day')?.source, 'unit');
  });

  it('CTC-P01-046, CTC-P01-047, PQ-15: QL-A không ghi PH-B; KT-A và PHT-A không ghi PH-A; KT-A không đọc PH-B', async () => {
    const manager = await environment.loginAs('VT-03', units['PH-A'] ?? null);
    assert.equal((await writeSettings(manager.accessToken, 'PH-B', { tuition_closing_day: 20 })).status, 403);
    const accountant = await environment.loginAs('VT-04', units['PH-A'] ?? null);
    assert.equal((await writeSettings(accountant.accessToken, 'PH-A', { tuition_closing_day: 20 })).status, 403);
    assert.equal((await readSettings(accountant.accessToken, 'PH-B')).status, 403);
    const deputy = await environment.loginAs('VT-15', units['PH-A'] ?? null);
    assert.equal((await writeSettings(deputy.accessToken, 'PH-A', { tuition_closing_day: 20 })).status, 403);
  });

  it('CTC-P01-048: không có mục tắt kiểm tra số dư quỹ tiền mặt; giá trị sai trả ERR_VALIDATION', async () => {
    const unknown = await writeSettings(principal, 'PH-A', { cash_balance_check: false });
    assert.equal(unknown.status, 400);
    assert.equal((await writeSettings(principal, 'PH-A', { tuition_closing_day: 31 })).status, 400);
    assert.equal((await writeSettings(principal, 'PH-A', { debt_reminder_days: [7, 3] })).status, 400);
    assert.equal((await writeSettings(principal, 'PH-A', { data_access_logging: 'co' })).status, 400);
  });

  it('Giá trị null xóa giá trị riêng của đơn vị để kế thừa lại', async () => {
    await writeSettings(principal, 'PH-B', { payment_due_day: 5 });
    assert.equal(settingOf((await readSettings(principal, 'PH-B')).body, 'payment_due_day')?.value, 5);
    await writeSettings(principal, 'PH-B', { payment_due_day: null });
    const response = await readSettings(principal, 'PH-B');
    assert.equal(settingOf(response.body, 'payment_due_day')?.source, 'truong_chinh');
  });

  it('CTC-P01-051, CTC-P01-053: nhật ký ghi đổi ngày chốt kèm giá trị trước và sau; QL-A chỉ thấy nhật ký của PH-A', async () => {
    const manager = await environment.loginAs('VT-03', units['PH-A'] ?? null);
    const response = await sendJson(
      'GET',
      `${environment.baseUrl}/audit-logs?entity_name=settings&page_size=100`,
      manager.accessToken,
    );
    assert.equal(response.status, 200);
    const items = response.body.items as Array<{
      org_unit_id: string;
      actor_name: string;
      before_data: Record<string, unknown>;
      after_data: Record<string, unknown>;
    }>;
    assert.ok(items.length > 0);
    assert.ok(items.every((item) => item.org_unit_id === units['PH-A']));
    const change = items.find((item) => item.after_data.tuition_closing_day === 25);
    assert.ok(change);
    assert.equal(change.before_data.tuition_closing_day, null);
    assert.ok(change.actor_name);

    const principalView = await sendJson(
      'GET',
      `${environment.baseUrl}/audit-logs?entity_name=settings&page_size=100`,
      principal,
    );
    const principalItems = principalView.body.items as Array<{ org_unit_id: string }>;
    assert.ok(principalItems.some((item) => item.org_unit_id === units.TC));
  });

  it('CTC-P01-054: giáo viên không tra được nhật ký thao tác', async () => {
    const teacher = await environment.loginAs('VT-07', units['PH-A'] ?? null);
    assert.equal((await sendJson('GET', `${environment.baseUrl}/audit-logs`, teacher.accessToken)).status, 403);
  });

  it('PQ-07, PQ-15: Hiệu trưởng đọc và sửa số ngày tự khóa; QL-A không sửa được; nhật ký tài khoản chỉ VT-01, VT-02 xem', async () => {
    const identityUrl = environment.identity.baseUrl;
    const current = await sendJson('GET', `${identityUrl}/auth/settings`, principal);
    assert.equal(current.status, 200);
    const original = current.body.account_inactivity_lock_days as number;
    try {
      const updated = await sendJson('PUT', `${identityUrl}/auth/settings`, principal, {
        account_inactivity_lock_days: 120,
      });
      assert.equal(updated.status, 200);
      assert.equal(updated.body.account_inactivity_lock_days, 120);
      const manager = await environment.loginAs('VT-03', units['PH-A'] ?? null);
      const forbidden = await sendJson('PUT', `${identityUrl}/auth/settings`, manager.accessToken, {
        account_inactivity_lock_days: 30,
      });
      assert.equal(forbidden.status, 403);
      assert.equal((await sendJson('GET', `${identityUrl}/users/audit-logs`, manager.accessToken)).status, 403);
      const logs = await sendJson('GET', `${identityUrl}/users/audit-logs?page_size=100`, principal);
      assert.equal(logs.status, 200);
      const entries = logs.body.items as Array<{ entity_name: string; after_data: Record<string, unknown> }>;
      assert.ok(
        entries.some(
          (entry) => entry.entity_name === 'identity_settings' && entry.after_data.account_inactivity_lock_days === 120,
        ),
      );
    } finally {
      // Trả lại giá trị gốc vì cơ sở dữ liệu định danh dùng chung với môi trường phát triển
      await sendJson('PUT', `${identityUrl}/auth/settings`, principal, { account_inactivity_lock_days: original });
    }
  });

  it('Mở năm học mới chuyển cấu hình của các đơn vị sang', async () => {
    await openTestAcademicYear(environment, principal, '2027–2028', {
      first_term: { start_date: '2027-09-06', end_date: '2028-01-14' },
      second_term: { start_date: '2028-01-17', end_date: '2028-05-26' },
    });
    const response = await readSettings(principal, 'PH-A');
    assert.equal(settingOf(response.body, 'tuition_closing_day')?.value, 25);
    assert.equal(settingOf(response.body, 'payment_due_day')?.source, 'truong_chinh');
  });
});
