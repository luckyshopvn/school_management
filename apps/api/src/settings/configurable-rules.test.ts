import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';

// Sĩ số tối đa theo cấu hình (BR-04), ghi nhật ký truy cập theo cấu hình (BR-73), báo cáo thu chi theo nhóm và theo tháng
// (P06-08) (DT-09 phần 9e, YCTD-70); ca kiểm thử CTC-P01-050, 055, 056, 057, CTC-P06-048, CT-011, CT-112
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');
const errorOf = (body: Record<string, unknown>) =>
  (body.error ?? {}) as { code?: string; rule_code?: string; details?: Array<{ field: string; message: string }> };

describe('Quy tắc theo cấu hình đơn vị', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let manager: LoggedInUser;
  let accountant: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let academicYearId = '';
  let unitA = '';
  const classes: Record<string, string> = {};
  const children: Record<string, string> = {};

  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);
  const writeSettings = (values: Record<string, unknown>) =>
    api('PUT', '/settings', principal.accessToken, { org_unit_id: unitA, values });

  async function accessLogsOf(childId: string) {
    const response = await api('GET', `/data-access-logs?entity_id=${childId}&page_size=100`, principal.accessToken);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    return response.body.items as Array<{ scope: string; actor_user_id: string }>;
  }

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    academicYearId = await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
      first_term: { start_date: addDays(vietnamToday, -60), end_date: addDays(vietnamToday, 90) },
      second_term: { start_date: addDays(vietnamToday, 95), end_date: addDays(vietnamToday, 200) },
    });
    const registry = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, registry.database_name),
    );
    await api('POST', '/org-units', principal.accessToken, {
      code: 'TC',
      name: 'Trường chính',
      unit_type: 'truong_chinh',
    });
    unitA = (
      await api('POST', '/org-units', principal.accessToken, { code: 'PH-A', name: 'PH-A', unit_type: 'phan_hieu' })
    ).body.id as string;
    manager = await environment.loginAs('VT-03', unitA);
    accountant = await environment.loginAs('VT-04', unitA);

    for (const code of ['L-1', 'L-2']) {
      classes[code] = (
        await schoolYear
          .insertInto('classes')
          .values({
            org_unit_id: unitA,
            academic_year_id: academicYearId,
            code,
            name: code,
            grade_level: 'MAM',
            max_size: 25,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    const relationship = (
      await api('POST', '/catalog-items', principal.accessToken, {
        catalog_type: 'parent_relationship',
        code: 'ME',
        name: 'Mẹ',
      })
    ).body.id as string;
    for (const [key, classCode] of [
      ['T1', 'L-1'],
      ['T2', 'L-1'],
      ['T3', 'L-2'],
    ] as const) {
      const form = new FormData();
      form.set('org_unit_id', unitA);
      form.set('purpose', 'birth_certificate');
      form.set('file', new Blob([PDF]), 'giay-khai-sinh.pdf');
      const file = (await (
        await fetch(`${environment.baseUrl}/files`, {
          method: 'POST',
          headers: { authorization: `Bearer ${principal.accessToken}` },
          body: form,
        })
      ).json()) as { id: string };
      const created = await api('POST', '/children', principal.accessToken, {
        org_unit_id: unitA,
        full_name: `Trẻ ${key}`,
        dob: '2022-04-18',
        gender: 'female',
        national_id: `079${String(randomInt(0, 1_000_000_000)).padStart(9, '0')}`,
        birth_certificate_file_id: file.id,
        photo_consent: 'pending',
        health: { has_allergies: false },
        guardians: [
          {
            full_name: `Mẹ của ${key}`,
            phone: `09${randomInt(0, 100_000_000).toString().padStart(8, '0')}`,
            relationship_item_id: relationship,
            is_primary: true,
          },
        ],
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      children[key] = created.body.id as string;
      await schoolYear
        .updateTable('children')
        .set({ status: 'active', enroll_date: addDays(vietnamToday, -30) })
        .where('id', '=', children[key] ?? '')
        .execute();
      await schoolYear
        .insertInto('class_enrollments')
        .values({
          child_id: children[key] ?? '',
          class_id: classes[classCode] ?? '',
          from_date: addDays(vietnamToday, -30),
        })
        .execute();
    }
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CTC-P01-050, CT-011: sĩ số tối đa của đơn vị nhỏ hơn sĩ số của lớp thì lớp đủ sĩ số theo cấu hình, cần xác nhận', async () => {
    assert.equal((await writeSettings({ max_class_size: 2 })).status, 200);
    const transfer = (confirm: boolean) =>
      api('POST', `/children/${children.T3}/transfer-class`, manager.accessToken, {
        class_id: classes['L-1'],
        reason: 'Chuyển lớp',
        confirm_over_capacity: confirm,
      });
    const blocked = await transfer(false);
    assert.equal(blocked.status, 422, JSON.stringify(blocked.body));
    assert.equal(errorOf(blocked.body).rule_code, 'BR-04');
    assert.equal(errorOf(blocked.body).details?.find((detail) => detail.field === 'max_size')?.message, '2');
    const confirmed = await transfer(true);
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
  });

  it('BR-04: chưa cấu hình sĩ số tối đa thì dùng sĩ số của lớp', async () => {
    assert.equal((await writeSettings({ max_class_size: null })).status, 200);
    const moved = await api('POST', `/children/${children.T3}/transfer-class`, manager.accessToken, {
      class_id: classes['L-2'],
      reason: 'Chuyển lại',
    });
    assert.equal(moved.status, 200, JSON.stringify(moved.body));
  });

  it('CTC-P01-055: bật ghi nhật ký truy cập thì kế toán đọc tài chính của trẻ có bản ghi', async () => {
    assert.equal((await writeSettings({ data_access_logging: true })).status, 200);
    assert.equal((await api('GET', `/children/${children.T1}/debt`, accountant.accessToken)).status, 200);
    assert.equal((await api('GET', `/children/${children.T1}/receipts`, accountant.accessToken)).status, 200);
    assert.equal((await api('GET', `/children/${children.T1}`, manager.accessToken)).status, 200);
    const logs = await accessLogsOf(children.T1 ?? '');
    assert.deepEqual(logs.map((row) => row.scope).sort(), ['child_profile', 'finance', 'finance']);
    assert.ok(logs.some((row) => row.actor_user_id === accountant.userId));
    const forbidden = await api('GET', '/data-access-logs', accountant.accessToken);
    assert.equal(forbidden.status, 403);
  });

  it('CTC-P01-056, CTC-P01-057: tắt ghi nhật ký thì đọc tài chính không ghi; xem đầy đủ số định danh vẫn ghi', async () => {
    assert.equal((await writeSettings({ data_access_logging: false })).status, 200);
    const before = (await accessLogsOf(children.T1 ?? '')).length;
    assert.equal((await api('GET', `/children/${children.T1}/debt`, accountant.accessToken)).status, 200);
    assert.equal((await accessLogsOf(children.T1 ?? '')).length, before);
    const full = await api('GET', `/children/${children.T1}/national-id`, manager.accessToken);
    assert.equal(full.status, 200, JSON.stringify(full.body));
    const logs = await accessLogsOf(children.T1 ?? '');
    assert.equal(logs.length, before + 1);
    assert.equal(logs[0]?.scope, 'national_id');
  });

  it('CTC-P06-048, CT-112: báo cáo thu chi tổng hợp theo nhóm và theo tháng, tổng các nhóm bằng tổng kỳ', async () => {
    const category = async (code: string, group: string, flowType: 'income' | 'expense') =>
      (
        await schoolYear
          .insertInto('cashflow_categories')
          .values({ code, name: code, group_name: group, flow_type: flowType })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    const tuition = await category('THU-HP', 'Học phí', 'income');
    const meals = await category('THU-AN', 'Học phí', 'income');
    const other = await category('THU-KHAC', 'Thu khác', 'income');
    const supplies = await category('CHI-VPP', 'Chi hoạt động', 'expense');
    const account = await schoolYear
      .insertInto('cash_accounts')
      .values({
        org_unit_id: unitA,
        account_type: 'cash',
        name: 'Quỹ PH-A',
        opening_balance: 0,
        current_balance: 0,
        created_by: accountant.userId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const lastMonth = `${addDays(`${vietnamToday.slice(0, 7)}-01`, -1).slice(0, 7)}-15`;
    const thisMonth = `${vietnamToday.slice(0, 7)}-01`;
    for (const [categoryId, amount, date] of [
      [tuition, 1_000_000, lastMonth],
      [meals, 400_000, thisMonth],
      [other, 100_000, thisMonth],
    ] as const) {
      await schoolYear
        .insertInto('receipts')
        .values({
          code: `PT-${randomUUID().slice(0, 8)}`,
          org_unit_id: unitA,
          child_id: children.T1 ?? '',
          payer_name: 'Phụ huynh',
          amount,
          method: 'cash',
          account_id: account.id,
          category_id: categoryId,
          receipt_date: date,
          request_key: randomUUID(),
          created_by: accountant.userId,
        })
        .execute();
    }
    await schoolYear
      .insertInto('payments')
      .values({
        code: `PC-${randomUUID().slice(0, 8)}`,
        org_unit_id: unitA,
        payment_type: 'regular',
        payee_name: 'Nhà sách',
        amount: 300_000,
        content: 'Mua văn phòng phẩm',
        account_id: account.id,
        category_id: supplies,
        payment_date: thisMonth,
        status: 'issued',
        request_key: randomUUID(),
        created_by: accountant.userId,
      })
      .execute();

    const response = await api(
      'GET',
      `/reports/cash-flow?from=${lastMonth.slice(0, 8)}01&to=${thisMonth.slice(0, 8)}28&org_unit_id=${unitA}`,
      accountant.accessToken,
    );
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const body = response.body as {
      groups: Array<{ flow_type: string; group_name: string; count: number; amount: number }>;
      periods: Array<{ period: string; income_amount: number; expense_amount: number }>;
      totals: { income_amount: number; expense_amount: number };
    };
    assert.deepEqual(
      [...body.groups].sort((left, right) => left.group_name.localeCompare(right.group_name)),
      [
        { flow_type: 'expense', group_name: 'Chi hoạt động', count: 1, amount: 300_000 },
        { flow_type: 'income', group_name: 'Học phí', count: 2, amount: 1_400_000 },
        { flow_type: 'income', group_name: 'Thu khác', count: 1, amount: 100_000 },
      ],
    );
    const incomeGroups = body.groups.filter((group) => group.flow_type === 'income');
    assert.equal(
      incomeGroups.reduce((sum, group) => sum + group.amount, 0),
      body.totals.income_amount,
    );
    assert.deepEqual(body.periods, [
      { period: lastMonth.slice(0, 7), income_amount: 1_000_000, expense_amount: 0 },
      { period: thisMonth.slice(0, 7), income_amount: 500_000, expense_amount: 300_000 },
    ]);
  });
});
