import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { MEAL_SERVICE_ID } from '@school-management/database';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';

// Danh mục dịch vụ, biểu phí, loại miễn giảm, khoản mục thu chi; ca kiểm thử theo 27_BO_CA_KIEM_THU_CHI_TIET/03_P05.md
// mục 3, 4, 8 và 04_P06.md
const rows = <Row = Record<string, unknown>>(body: unknown) => body as Row[];
const errorOf = (body: Record<string, unknown>) => (body.error ?? {}) as { code?: string; rule_code?: string };

describe('Danh mục học phí và tài chính', () => {
  let environment: ApiTestEnvironment;
  let principal: string;
  const units: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const serviceIds: Record<string, string> = {};
  const token = (name: string) => users[name]?.accessToken ?? '';

  const post = (path: string, accessToken: string, body: unknown) =>
    sendJson('POST', `${environment.baseUrl}${path}`, accessToken, body);
  const patch = (path: string, accessToken: string, body: unknown) =>
    sendJson('PATCH', `${environment.baseUrl}${path}`, accessToken, body);
  const put = (path: string, accessToken: string, body: unknown) =>
    sendJson('PUT', `${environment.baseUrl}${path}`, accessToken, body);
  const remove = (path: string, accessToken: string) =>
    sendJson('DELETE', `${environment.baseUrl}${path}`, accessToken);
  const get = (path: string, accessToken: string) => sendJson('GET', `${environment.baseUrl}${path}`, accessToken);

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = (await environment.loginAs('VT-02', null)).accessToken;
    await openTestAcademicYear(environment, principal, '2026–2027', {
      first_term: { start_date: '2026-09-01', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    });
    for (const [code, type] of [
      ['TC', 'truong_chinh'],
      ['PH-A', 'phan_hieu'],
    ] as const) {
      units[code] = (await post('/org-units', principal, { code, name: code, unit_type: type })).body.id as string;
    }
    for (const [code, name] of [
      ['MAM', 'Mầm'],
      ['CHOI', 'Chồi'],
    ]) {
      await post('/grade-levels', principal, { code, name, age_from_months: 36, age_to_months: 59 });
    }
    const unitA = units['PH-A'] ?? null;
    users.accountant = await environment.loginAs('VT-04', unitA);
    users.chiefAccountant = await environment.loginAs('VT-05', unitA);
    users.manager = await environment.loginAs('VT-03', unitA);
    users.teacher = await environment.loginAs('VT-07', unitA);
    users.parent = await environment.loginAs('VT-14', null);
  });

  after(async () => {
    await environment.close();
  });

  describe('P05-02 Danh mục dịch vụ', () => {
    it('CTC-P05-006: bán trú có sẵn, bắt buộc, tính theo ngày có mặt; không ngừng và không đổi cách tính được', async () => {
      const services = rows<{ id: string; code: string; is_mandatory: boolean; calculation_method: string }>(
        (await get('/services', token('parent'))).body,
      );
      const meal = services.find((service) => service.id === MEAL_SERVICE_ID);
      assert.equal(meal?.code, 'BAN_TRU');
      assert.equal(meal?.is_mandatory, true);
      assert.equal(meal?.calculation_method, 'per_present_day');
      const stopped = await patch(`/services/${MEAL_SERVICE_ID}`, token('accountant'), { status: 'inactive' });
      assert.equal(stopped.status, 422);
      assert.equal(errorOf(stopped.body).rule_code, 'BR-83');
      assert.equal(
        (await patch(`/services/${MEAL_SERVICE_ID}`, token('accountant'), { calculation_method: 'monthly' })).status,
        422,
      );
      assert.equal(
        (await patch(`/services/${MEAL_SERVICE_ID}`, token('accountant'), { name: 'Bán trú cả ngày' })).status,
        200,
      );
    });

    it('CTC-P05-005: kế toán tạo dịch vụ STEM, Anh văn không bắt buộc, tính theo tháng; mã trùng trả ERR_CONFLICT', async () => {
      for (const [code, name] of [
        ['STEM', 'STEM'],
        ['ANH_VAN', 'Anh văn'],
      ] as const) {
        const created = await post('/services', token('accountant'), {
          code,
          name,
          unit: 'tháng',
          calculation_method: 'monthly',
        });
        assert.equal(created.status, 201, JSON.stringify(created.body));
        assert.equal(created.body.is_mandatory, false);
        serviceIds[code] = created.body.id as string;
      }
      const duplicate = await post('/services', token('accountant'), {
        code: 'STEM',
        name: 'Khác',
        unit: 'tháng',
        calculation_method: 'monthly',
      });
      assert.equal(duplicate.status, 409);
    });

    it('CTC-P05-008: phụ huynh, quản lý đơn vị, giáo viên không tạo được dịch vụ', async () => {
      const body = { code: 'VE', name: 'Vẽ', unit: 'tháng', calculation_method: 'monthly' };
      for (const name of ['parent', 'manager', 'teacher']) {
        assert.equal((await post('/services', token(name), body)).status, 403, name);
      }
    });
  });

  describe('P05-01 Biểu phí', () => {
    const items = (tuition: number) => [
      { grade_level: 'MAM', fee_type: 'tuition', amount: tuition },
      { grade_level: 'MAM', fee_type: 'service', service_id: MEAL_SERVICE_ID, amount: 35_000 },
      { grade_level: 'MAM', fee_type: 'service', service_id: serviceIds.STEM, amount: 440_000 },
      { grade_level: 'MAM', fee_type: 'service', service_id: serviceIds.ANH_VAN, amount: 550_000 },
    ];
    let firstId = '';

    it('CTC-P05-001: kế toán của PH-A tạo biểu phí khối Mầm từ 01/09/2026, dùng chung toàn trường', async () => {
      const created = await post('/fee-schedules', token('accountant'), {
        name: 'Biểu phí năm học 2026–2027',
        effective_from: '2026-09-01',
        items: items(2_200_000),
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      firstId = created.body.id as string;
      assert.equal(created.body.effective_to, null);
      assert.equal(created.body.is_editable, false);
      const stored = created.body.items as Array<{ fee_type: string; amount: number; service_name: string | null }>;
      assert.equal(stored.length, 4);
      assert.equal(stored.find((item) => item.fee_type === 'tuition')?.amount, 2_200_000);
      // Phụ huynh xem được mức phí
      assert.equal((await get('/fee-schedules', token('parent'))).status, 200);
    });

    it('BR-18: biểu phí đã có hiệu lực không sửa được; ngày hiệu lực phải là ngày 1 và sau phiên bản mới nhất', async () => {
      const edited = await put(`/fee-schedules/${firstId}`, token('accountant'), { name: 'Sửa', items: items(1) });
      assert.equal(edited.status, 422);
      assert.equal(errorOf(edited.body).rule_code, 'BR-18');
      const midMonth = await post('/fee-schedules', token('accountant'), {
        name: 'Giữa tháng',
        effective_from: '2026-11-15',
        items: items(1),
      });
      assert.equal(midMonth.status, 400);
      const earlier = await post('/fee-schedules', token('accountant'), {
        name: 'Trước',
        effective_from: '2026-08-01',
        items: items(1),
      });
      assert.equal(earlier.status, 422);
    });

    it('Phiên bản chưa tới ngày hiệu lực sửa được, xóa được; xóa thì phiên bản trước không còn ngày kết thúc', async () => {
      const future = await post('/fee-schedules', token('accountant'), {
        name: 'Dự kiến',
        effective_from: '2099-01-01',
        items: items(3_000_000),
      });
      assert.equal(future.status, 201, JSON.stringify(future.body));
      assert.equal(future.body.is_editable, true);
      assert.equal((await get(`/fee-schedules/${firstId}`, token('accountant'))).body.effective_to, '2098-12-31');
      const edited = await put(`/fee-schedules/${future.body.id}`, token('accountant'), {
        name: 'Dự kiến đã sửa',
        items: items(3_100_000),
      });
      assert.equal(edited.status, 200, JSON.stringify(edited.body));
      assert.equal(
        (edited.body.items as Array<{ fee_type: string; amount: number }>).find((item) => item.fee_type === 'tuition')
          ?.amount,
        3_100_000,
      );
      assert.equal((await remove(`/fee-schedules/${future.body.id}`, token('accountant'))).status, 200);
      assert.equal((await get(`/fee-schedules/${firstId}`, token('accountant'))).body.effective_to, null);
    });

    it('CTC-P05-002: phiên bản mới từ 01/11 với học phí 2 400 000 thì phiên bản cũ kết thúc 31/10', async () => {
      const created = await post('/fee-schedules', token('accountant'), {
        name: 'Biểu phí từ tháng 11',
        effective_from: '2026-11-01',
        items: items(2_400_000),
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      assert.equal((await get(`/fee-schedules/${firstId}`, token('accountant'))).body.effective_to, '2026-10-31');
      const listed = rows<{ effective_from: string }>((await get('/fee-schedules', token('teacher'))).body);
      assert.deepEqual(
        listed.map((schedule) => schedule.effective_from),
        ['2026-11-01', '2026-09-01'],
      );
    });

    it('Bậc học hoặc dịch vụ không có trong danh mục, giá trùng, số tiền âm trả ERR_VALIDATION', async () => {
      for (const bad of [
        [{ grade_level: 'LA', fee_type: 'tuition', amount: 1 }],
        [{ grade_level: 'MAM', fee_type: 'service', service_id: '00000000-0000-4000-8000-000000000000', amount: 1 }],
        [
          { grade_level: 'MAM', fee_type: 'tuition', amount: 1 },
          { grade_level: 'MAM', fee_type: 'tuition', amount: 2 },
        ],
        [{ grade_level: 'MAM', fee_type: 'tuition', amount: -1 }],
      ]) {
        const response = await post('/fee-schedules', token('accountant'), {
          name: 'Sai',
          effective_from: '2099-02-01',
          items: bad,
        });
        assert.equal(response.status, 400, JSON.stringify(response.body));
      }
    });

    it('CTC-P05-004: quản lý đơn vị và giáo viên không tạo được biểu phí', async () => {
      const body = { name: 'X', effective_from: '2099-03-01', items: items(1) };
      assert.equal((await post('/fee-schedules', token('manager'), body)).status, 403);
      assert.equal((await post('/fee-schedules', token('teacher'), body)).status, 403);
    });
  });

  describe('P05-11 Danh mục loại miễn giảm', () => {
    it('CTC-P05-043: kế toán tạo loại "Anh chị em ruột" giảm 10% tiền bán trú; Hiệu trưởng tạo "Con nhân sự" giảm 50% học phí', async () => {
      const sibling = await post('/discount-types', token('accountant'), {
        code: 'ANH_CHI_EM',
        name: 'Anh chị em ruột',
        calculation_method: 'percent',
        value: 10,
        applies_to: [MEAL_SERVICE_ID],
      });
      assert.equal(sibling.status, 201, JSON.stringify(sibling.body));
      assert.deepEqual(sibling.body.applies_to, [MEAL_SERVICE_ID]);
      const staffChild = await post('/discount-types', principal, {
        code: 'CON_NHAN_SU',
        name: 'Con nhân sự',
        calculation_method: 'percent',
        value: 50,
        applies_to: ['tuition'],
        condition_note: 'Trẻ có cờ con nhân sự',
      });
      assert.equal(staffChild.status, 201, JSON.stringify(staffChild.body));
    });

    it('CTC-P05-049 phần danh mục: loại số tiền cố định 200 000; phần trăm ngoài 1 đến 100 và khoản áp dụng lạ bị từ chối', async () => {
      const fixed = await post('/discount-types', token('accountant'), {
        code: 'HOC_BONG',
        name: 'Học bổng',
        calculation_method: 'amount',
        value: 200_000,
        applies_to: ['tuition', serviceIds.STEM],
      });
      assert.equal(fixed.status, 201, JSON.stringify(fixed.body));
      assert.equal(fixed.body.value, 200_000);
      for (const body of [
        { code: 'X1', name: 'X', calculation_method: 'percent', value: 120, applies_to: ['tuition'] },
        { code: 'X2', name: 'X', calculation_method: 'percent', value: 10, applies_to: ['khac'] },
        { code: 'X3', name: 'X', calculation_method: 'percent', value: 10, applies_to: [] },
      ]) {
        assert.equal((await post('/discount-types', token('accountant'), body)).status, 400, body.code);
      }
    });

    it('CTC-P05-045 phần danh mục: ngừng sử dụng loại miễn giảm thì lọc đang dùng không còn loại đó', async () => {
      const listed = rows<{ id: string; code: string }>((await get('/discount-types', token('accountant'))).body);
      const scholarship = listed.find((row) => row.code === 'HOC_BONG');
      assert.equal(
        (await patch(`/discount-types/${scholarship?.id}`, token('accountant'), { status: 'inactive' })).status,
        200,
      );
      const active = rows<{ code: string }>((await get('/discount-types?status=active', token('accountant'))).body);
      assert.ok(!active.some((row) => row.code === 'HOC_BONG'));
      assert.equal(
        (await patch(`/discount-types/${scholarship?.id}`, token('accountant'), { calculation_method: 'percent' }))
          .status,
        400,
      );
    });

    it('CTC-P05-044: quản lý đơn vị không tạo được loại miễn giảm; phụ huynh không xem được danh mục', async () => {
      const body = { code: 'Y', name: 'Y', calculation_method: 'percent', value: 5, applies_to: ['tuition'] };
      assert.equal((await post('/discount-types', token('manager'), body)).status, 403);
      assert.equal((await get('/discount-types', token('parent'))).status, 403);
      assert.equal((await get('/discount-types', token('manager'))).status, 200);
    });
  });

  describe('P06-10 Khoản mục và nhóm thu chi', () => {
    it('Kế toán trưởng tạo khoản mục thu, kế toán tạo khoản mục chi; lọc theo loại; mã trùng trả ERR_CONFLICT', async () => {
      const income = await post('/cashflow-categories', token('chiefAccountant'), {
        code: 'THU_HOC_PHI',
        name: 'Thu học phí',
        group_name: 'Thu từ hoạt động giáo dục',
        flow_type: 'income',
      });
      assert.equal(income.status, 201, JSON.stringify(income.body));
      const expense = await post('/cashflow-categories', token('accountant'), {
        code: 'CHI_THUC_PHAM',
        name: 'Chi mua thực phẩm',
        group_name: 'Chi bán trú',
        flow_type: 'expense',
      });
      assert.equal(expense.status, 201, JSON.stringify(expense.body));
      const incomes = rows<{ code: string }>(
        (await get('/cashflow-categories?flow_type=income', token('manager'))).body,
      );
      assert.deepEqual(
        incomes.map((row) => row.code),
        ['THU_HOC_PHI'],
      );
      assert.equal(
        (
          await post('/cashflow-categories', token('accountant'), {
            code: 'THU_HOC_PHI',
            name: 'X',
            group_name: 'X',
            flow_type: 'income',
          })
        ).status,
        409,
      );
      assert.equal(
        (await patch(`/cashflow-categories/${income.body.id}`, token('accountant'), { flow_type: 'expense' })).status,
        400,
      );
    });

    it('Quản lý đơn vị và Hiệu trưởng không tạo được khoản mục; phụ huynh không xem được', async () => {
      const body = { code: 'Z', name: 'Z', group_name: 'Z', flow_type: 'income' };
      assert.equal((await post('/cashflow-categories', token('manager'), body)).status, 403);
      assert.equal((await post('/cashflow-categories', principal, body)).status, 403);
      assert.equal((await get('/cashflow-categories', token('parent'))).status, 403);
    });
  });

  describe('Chuyển năm học', () => {
    it('Mở năm học mới chuyển dịch vụ, biểu phí, loại miễn giảm, khoản mục thu chi sang, giữ nguyên mã định danh', async () => {
      const before = {
        services: rows((await get('/services', principal)).body),
        schedules: rows((await get('/fee-schedules', principal)).body),
        discountTypes: rows((await get('/discount-types', principal)).body),
        categories: rows((await get('/cashflow-categories', principal)).body),
      };
      await openTestAcademicYear(environment, principal, '2027–2028', {
        first_term: { start_date: '2027-09-01', end_date: '2028-01-14' },
        second_term: { start_date: '2028-01-17', end_date: '2028-05-25' },
      });
      assert.deepEqual(rows((await get('/services', principal)).body), before.services);
      assert.deepEqual(rows((await get('/fee-schedules', principal)).body), before.schedules);
      assert.deepEqual(rows((await get('/discount-types', principal)).body), before.discountTypes);
      assert.deepEqual(rows((await get('/cashflow-categories', principal)).body), before.categories);
    });
  });
});
