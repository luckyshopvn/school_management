import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import ExcelJS from 'exceljs';
import {
  createDatabase,
  MEAL_SERVICE_ID,
  replaceDatabaseName,
  type SchoolYearDatabase,
} from '@school-management/database';
import { hashForTesting, TEST_PASSWORD } from '@school-management/identity/testing';
import type { Kysely } from 'kysely';
import { IMPORT_COLUMNS } from '../imports/imports.service.js';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';

// Miễn giảm và phiếu điều chỉnh hóa đơn, duyệt theo hạn mức; ca kiểm thử theo 27_BO_CA_KIEM_THU_CHI_TIET/03_P05.md
// mục 8, 9, 10. Hóa đơn ghi sẵn theo dữ liệu dùng chung của tệp đó (học phí 2 200 000, bán trú 35 000 một ngày, STEM
// 440 000, Anh văn 550 000; hạn mức miễn giảm và phiếu điều chỉnh của đơn vị A đều là 1 000 000)
const randomPhone = () => `09${randomInt(0, 100_000_000).toString().padStart(8, '0')}`;
const errorOf = (body: Record<string, unknown>) => (body.error ?? {}) as { code?: string; rule_code?: string };

type InvoiceView = {
  status: string;
  total_amount: number;
  discount_amount: number;
  adjustment_amount: number;
  payable_amount: number;
  discounts: Array<{ id: string; status: string; applied_amount: number; decided_by: string | null }>;
  adjustments: Array<{ id: string; status: string; amount: number }>;
};

describe('Miễn giảm và phiếu điều chỉnh hóa đơn', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let savedDefaultPassword: Array<{ key: string; value: unknown; updated_by: string | null }> = [];
  const units: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const children: Record<string, string> = {};
  const invoices: Record<string, string> = {};
  const types: Record<string, string> = {};
  const serviceIds: Record<string, string> = {};
  const parentPhone = randomPhone();
  let parentToken = '';

  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);
  const invoiceView = async (invoice: string, accessToken = token('accountant')) =>
    (await api('GET', `/invoices/${invoices[invoice]}`, accessToken)).body as unknown as InvoiceView;
  const discount = (invoice: string, type: string, accessToken = token('accountant')) =>
    api('POST', `/invoices/${invoices[invoice]}/discounts`, accessToken, {
      discount_type_id: types[type],
      basis: `Căn cứ ${type}`,
    });

  // Hóa đơn ghi sẵn với các dòng cho trước
  async function seedInvoice(
    child: string,
    unit: string,
    period: { year: number; month: number },
    status: 'draft' | 'issued',
    items: Array<{ type: 'tuition' | 'service'; serviceId?: string; amount: number }>,
  ): Promise<string> {
    const total = items.reduce((sum, item) => sum + item.amount, 0);
    const invoice = await schoolYear
      .insertInto('invoices')
      .values({
        code: status === 'issued' ? `HD-${randomInt(100_000, 999_999)}` : null,
        child_id: children[child] ?? '',
        org_unit_id: units[unit] ?? '',
        period_year: period.year,
        period_month: period.month,
        invoice_kind: 'main',
        status,
        total_amount: total,
        basis: JSON.stringify({}),
        review_flags: JSON.stringify([]),
        due_date: status === 'issued' ? '2099-12-31' : null,
        issued_at: status === 'issued' ? new Date() : null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('invoice_items')
      .values(
        items.map((item) => ({
          invoice_id: invoice.id,
          item_type: item.type,
          service_id: item.serviceId ?? null,
          description: item.type === 'tuition' ? 'Học phí chính khóa' : 'Dịch vụ',
          quantity: 1,
          unit_price: item.amount,
          amount: item.amount,
        })),
      )
      .execute();
    return invoice.id;
  }

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    savedDefaultPassword = await environment.identity.database
      .selectFrom('identity_settings')
      .select(['key', 'value', 'updated_by'])
      .where('key', '=', 'parent_default_password_hash')
      .execute();
    await sendJson('PUT', `${environment.identity.baseUrl}/auth/settings`, principal.accessToken, {
      parent_default_password: 'PhuHuynh2026',
    });
    const yearId = await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
      first_term: { start_date: '2026-09-01', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    });
    const databaseRow = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .where('academic_year_id', '=', yearId)
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, databaseRow.database_name),
    );
    for (const [code, type] of [
      ['TC', 'truong_chinh'],
      ['ĐT-A1', 'diem_truong'],
      ['ĐT-B1', 'diem_truong'],
    ] as const) {
      units[code] = (await api('POST', '/org-units', principal.accessToken, { code, name: code, unit_type: type })).body
        .id as string;
    }
    await api('POST', '/grade-levels', principal.accessToken, {
      code: 'MAM',
      name: 'Mầm',
      age_from_months: 48,
      age_to_months: 59,
    });
    await api('POST', '/catalog-items', principal.accessToken, {
      catalog_type: 'parent_relationship',
      code: 'ME',
      name: 'Mẹ',
    });
    for (const [code, unit] of [
      ['L-A1', 'ĐT-A1'],
      ['L-B1', 'ĐT-B1'],
    ] as const) {
      await api('POST', '/classes', principal.accessToken, {
        org_unit_id: units[unit],
        code,
        name: code,
        grade_level: 'MAM',
        max_size: 25,
      });
    }
    const unitA = units['ĐT-A1'] ?? null;
    users.accountant = await environment.loginAs('VT-04', unitA);
    users.chiefAccountant = await environment.loginAs('VT-05', unitA);
    users.manager = await environment.loginAs('VT-03', unitA);
    users.vicePrincipal = await environment.loginAs('VT-15', unitA);
    users.teacher = await environment.loginAs('VT-07', unitA);
    users.accountantB = await environment.loginAs('VT-04', units['ĐT-B1'] ?? null);
    for (const [code, name] of [
      ['STEM', 'STEM'],
      ['ANH_VAN', 'Anh văn'],
    ] as const) {
      serviceIds[code] = (
        await api('POST', '/services', token('accountant'), {
          code,
          name,
          unit: 'tháng',
          calculation_method: 'monthly',
        })
      ).body.id as string;
    }
    for (const [code, method, value, appliesTo] of [
      ['CON_NHAN_SU', 'percent', 50, ['tuition']],
      ['ANH_CHI_EM', 'percent', 10, [MEAL_SERVICE_ID]],
      ['CO_DINH', 'amount', 200_000, ['tuition']],
      ['LON', 'amount', 1_600_000, ['tuition']],
      ['NHO', 'amount', 50_000, ['tuition']],
      ['BO_SUNG', 'amount', 100_000, ['tuition']],
    ] as const) {
      const created = await api('POST', '/discount-types', token('accountant'), {
        code,
        name: code,
        calculation_method: method,
        value,
        applies_to: appliesTo,
      });
      types[code] = created.body.id as string;
    }
    for (const documentType of ['tuition_discount', 'invoice_adjustment']) {
      const saved = await api('PUT', '/approval-thresholds', principal.accessToken, {
        org_unit_id: units['ĐT-A1'],
        document_type: documentType,
        threshold_amount: 1_000_000,
      });
      assert.equal(saved.status, 200, JSON.stringify(saved.body));
    }

    const book = new ExcelJS.Workbook();
    const worksheet = book.addWorksheet('Trẻ');
    worksheet.addRow(IMPORT_COLUMNS.children.map((column) => column.header));
    for (const [index, [name, unit, classCode]] of [
      ['T1', 'ĐT-A1', 'L-A1'],
      ['T2', 'ĐT-A1', 'L-A1'],
      ['T6', 'ĐT-A1', 'L-A1'],
      ['T4', 'ĐT-B1', 'L-B1'],
    ].entries()) {
      const row: Record<string, string> = {
        unit_code: unit ?? '',
        class_code: classCode ?? '',
        full_name: `Trẻ ${name}`,
        dob: '2022-04-18',
        gender: 'Nam',
        national_id: `085${String(Date.now() % 1_000_000).padStart(6, '0')}${String(randomInt(0, 100) * 10 + index).padStart(3, '0')}`,
        allergies: 'Không',
        enroll_date: '2026-09-01',
        guardian1_name: `Mẹ ${name}`,
        guardian1_relationship: 'Mẹ',
        guardian1_phone: name === 'T1' ? parentPhone : randomPhone(),
      };
      worksheet.addRow(IMPORT_COLUMNS.children.map((column) => row[column.key] ?? ''));
    }
    const form = new FormData();
    form.set('type', 'children');
    form.set('file', new Blob([Buffer.from(await book.xlsx.writeBuffer())]), 'tre.xlsx');
    const uploaded = (await (
      await fetch(`${environment.baseUrl}/imports`, {
        method: 'POST',
        headers: { authorization: `Bearer ${principal.accessToken}` },
        body: form,
      })
    ).json()) as { id: string; status: string };
    assert.equal(uploaded.status, 'validated', JSON.stringify(uploaded));
    assert.equal((await api('POST', `/imports/${uploaded.id}/commit`, principal.accessToken)).status, 200);
    for (const row of await schoolYear.selectFrom('children').select(['id', 'full_name']).execute()) {
      children[row.full_name.replace('Trẻ ', '')] = row.id;
    }
    await environment.identity.database
      .updateTable('users')
      .set({ password_hash: await hashForTesting(TEST_PASSWORD), must_change_password: false })
      .where('phone', '=', parentPhone)
      .execute();
    parentToken = (
      await sendJson('POST', `${environment.identity.baseUrl}/auth/login`, undefined, {
        login: parentPhone,
        password: TEST_PASSWORD,
        channel: 'parent',
      })
    ).body.access_token as string;

    const october = { year: 2026, month: 10 };
    invoices.T1 = await seedInvoice('T1', 'ĐT-A1', october, 'issued', [
      { type: 'tuition', amount: 2_200_000 },
      { type: 'service', serviceId: MEAL_SERVICE_ID, amount: 770_000 },
      { type: 'service', serviceId: serviceIds.STEM, amount: 440_000 },
      { type: 'service', serviceId: serviceIds.ANH_VAN, amount: 550_000 },
    ]);
    invoices.T2 = await seedInvoice('T2', 'ĐT-A1', october, 'issued', [
      { type: 'tuition', amount: 2_200_000 },
      { type: 'service', serviceId: MEAL_SERVICE_ID, amount: 630_000 },
    ]);
    invoices.T6 = await seedInvoice('T6', 'ĐT-A1', october, 'draft', [{ type: 'tuition', amount: 1_500_000 }]);
    invoices.T4 = await seedInvoice('T4', 'ĐT-B1', october, 'issued', [{ type: 'tuition', amount: 2_200_000 }]);
    invoices.T1November = await seedInvoice('T1', 'ĐT-A1', { year: 2026, month: 11 }, 'draft', [
      { type: 'tuition', amount: 2_200_000 },
    ]);
  });

  after(async () => {
    const identity = environment.identity.database;
    await identity.deleteFrom('identity_settings').where('key', '=', 'parent_default_password_hash').execute();
    for (const row of savedDefaultPassword) {
      await identity
        .insertInto('identity_settings')
        .values({ key: row.key, value: JSON.stringify(row.value), updated_by: row.updated_by })
        .execute();
    }
    await schoolYear.destroy();
    await environment.close();
  });

  describe('P05-07 Miễn giảm', () => {
    it('CTC-P05-046: loại miễn giảm không có trong danh mục trả ERR_VALIDATION', async () => {
      const response = await api('POST', `/invoices/${invoices.T1}/discounts`, token('accountant'), {
        discount_type_id: '00000000-0000-4000-8000-000000000000',
        basis: 'Không có',
      });
      assert.equal(response.status, 400);
    });

    it('CTC-P05-047: con nhân sự giảm 50% học phí bằng 1 100 000, từ hạn mức trở lên nên Phó Hiệu trưởng bị từ chối, Hiệu trưởng duyệt được', async () => {
      const created = await discount('T1', 'CON_NHAN_SU');
      assert.equal(created.status, 201, JSON.stringify(created.body));
      assert.equal(created.body.applied_amount, 1_100_000);
      assert.equal(created.body.requires_principal, true);
      assert.equal((await api('POST', `/discounts/${created.body.id}/approve`, token('vicePrincipal'))).status, 403);
      const approved = await api('POST', `/discounts/${created.body.id}/approve`, principal.accessToken);
      assert.equal(approved.status, 200, JSON.stringify(approved.body));
      assert.equal(approved.body.status, 'approved');
      assert.equal(approved.body.decided_by, principal.userId);
    });

    it('CTC-P05-048, CTC-P05-051: anh chị em ruột giảm 10% tiền bán trú 630 000 bằng 63 000, dưới hạn mức nên Phó Hiệu trưởng duyệt', async () => {
      const created = await discount('T2', 'ANH_CHI_EM');
      assert.equal(created.body.base_amount, 630_000);
      assert.equal(created.body.applied_amount, 63_000);
      assert.equal(created.body.requires_principal, false);
      const approved = await api('POST', `/discounts/${created.body.id}/approve`, token('vicePrincipal'));
      assert.equal(approved.status, 200, JSON.stringify(approved.body));
    });

    it('CTC-P05-049: loại số tiền cố định lưu cả căn cứ, cách tính và kết quả 200 000', async () => {
      const created = await discount('T2', 'CO_DINH');
      assert.equal(created.body.basis, 'Căn cứ CO_DINH');
      assert.equal(created.body.calculation_method, 'amount');
      assert.equal(created.body.rate_value, 200_000);
      assert.equal(created.body.applied_amount, 200_000);
    });

    it('CTC-P05-050: hóa đơn 1 500 000 lập giảm trừ 1 600 000 bị chặn', async () => {
      const response = await discount('T6', 'LON');
      assert.equal(response.status, 422);
      assert.equal(errorOf(response.body).rule_code, 'BR-22');
    });

    it('CTC-P05-052: đơn vị chưa đặt hạn mức thì miễn giảm 50 000 chuyển Hiệu trưởng', async () => {
      const created = await discount('T4', 'NHO', token('accountantB'));
      assert.equal(created.status, 201, JSON.stringify(created.body));
      assert.equal(created.body.requires_principal, true);
    });

    it('CTC-P05-053: quản lý đơn vị và kế toán trưởng không duyệt được miễn giảm', async () => {
      const pending = await discount('T2', 'NHO');
      for (const name of ['manager', 'chiefAccountant', 'accountant']) {
        assert.equal((await api('POST', `/discounts/${pending.body.id}/approve`, token(name))).status, 403, name);
      }
    });

    it('CTC-P05-054: Phó Hiệu trưởng từ chối kèm lý do; thiếu lý do bị từ chối; miễn giảm không áp dụng', async () => {
      const view = await invoiceView('T2');
      const pending = view.discounts.find((row) => row.status === 'pending' && row.applied_amount === 50_000);
      assert.equal((await api('POST', `/discounts/${pending?.id}/reject`, token('vicePrincipal'), {})).status, 400);
      const rejected = await api('POST', `/discounts/${pending?.id}/reject`, token('vicePrincipal'), {
        reason: 'Không đủ căn cứ',
      });
      assert.equal(rejected.body.status, 'rejected');
      assert.equal(rejected.body.reject_reason, 'Không đủ căn cứ');
      const logged = await schoolYear
        .selectFrom('audit_logs')
        .select('actor_user_id')
        .where('entity_name', '=', 'discounts')
        .where('entity_id', '=', pending?.id ?? '')
        .where('action', '=', 'update')
        .executeTakeFirst();
      assert.equal(logged?.actor_user_id, users.vicePrincipal?.userId);
    });

    it('CTC-P05-060: số phải nộp trừ miễn giảm đã duyệt, không trừ miễn giảm chờ duyệt; phụ huynh chỉ thấy miễn giảm đã duyệt', async () => {
      await discount('T1', 'BO_SUNG');
      const view = await invoiceView('T1');
      assert.equal(view.total_amount, 3_960_000);
      assert.equal(view.discount_amount, 1_100_000);
      assert.equal(view.payable_amount, 2_860_000);
      const parentView = await invoiceView('T1', parentToken);
      assert.equal(parentView.payable_amount, 2_860_000);
      assert.ok(parentView.discounts.every((row) => row.status === 'approved'));
      assert.equal(parentView.discounts.length, 1);
    });

    it('Chép miễn giảm đã duyệt của kỳ trước sang hóa đơn kỳ này, bản chép chờ duyệt', async () => {
      const copied = await api('POST', `/invoices/${invoices.T1November}/discounts/copy-previous`, token('accountant'));
      assert.equal(copied.status, 201, JSON.stringify(copied.body));
      const rows = copied.body as unknown as Array<{ status: string; applied_amount: number; copied_from_id: string }>;
      assert.equal(rows.length, 1);
      assert.equal(rows[0]?.status, 'pending');
      assert.equal(rows[0]?.applied_amount, 1_100_000);
    });
  });

  describe('DT-09 phần 9a: ngừng loại miễn giảm', () => {
    it('CTC-P05-045: ngừng loại miễn giảm đã dùng thì miễn giảm cũ giữ nguyên, miễn giảm mới không chọn được loại đó', async () => {
      const stopped = await api('PATCH', `/discount-types/${types.CO_DINH}`, token('accountant'), {
        status: 'inactive',
      });
      assert.equal(stopped.status, 200, JSON.stringify(stopped.body));
      const old = await schoolYear
        .selectFrom('discounts')
        .select(['discount_type_id', 'status'])
        .where('discount_type_id', '=', types.CO_DINH ?? '')
        .execute();
      assert.ok(old.length > 0);
      const fresh = await discount('T1', 'CO_DINH');
      assert.equal(fresh.status, 400, JSON.stringify(fresh.body));
    });
  });

  describe('P05-08 Điều chỉnh hóa đơn', () => {
    let small = '';
    let large = '';

    it('CTC-P05-055, CTC-P05-056: kế toán lập phiếu giảm 70 000, kế toán trưởng lập phiếu 1 200 000; phiếu có số và liên kết hóa đơn gốc', async () => {
      const before = await invoiceView('T2');
      const created = await api('POST', '/invoice-adjustments', token('accountant'), {
        invoice_id: invoices.T2,
        amount: -70_000,
        reason: 'Ghi nhầm tiền ăn',
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      assert.match(created.body.code as string, /^DC-\d{6}$/);
      assert.equal(created.body.invoice_id, invoices.T2);
      small = created.body.id as string;
      const chief = await api('POST', '/invoice-adjustments', token('chiefAccountant'), {
        invoice_id: invoices.T2,
        amount: -1_200_000,
        reason: 'Hoàn học phí',
      });
      assert.equal(chief.status, 201, JSON.stringify(chief.body));
      large = chief.body.id as string;
      const after = await invoiceView('T2');
      assert.equal(after.total_amount, before.total_amount);
      assert.equal(after.payable_amount, before.payable_amount);
    });

    it('CTC-P05-057: Phó Hiệu trưởng duyệt phiếu 70 000; phiếu 1 200 000 cần Hiệu trưởng', async () => {
      assert.equal((await api('POST', `/invoice-adjustments/${small}/approve`, token('vicePrincipal'))).status, 200);
      assert.equal((await api('POST', `/invoice-adjustments/${large}/approve`, token('vicePrincipal'))).status, 403);
      const pending = (await api('GET', '/fee-approvals/pending', token('vicePrincipal'))).body as unknown as {
        adjustments: Array<{ id: string }>;
      };
      assert.ok(!pending.adjustments.some((row) => row.id === large));
      const principalPending = (await api('GET', '/fee-approvals/pending', principal.accessToken)).body as unknown as {
        adjustments: Array<{ id: string }>;
      };
      assert.ok(principalPending.adjustments.some((row) => row.id === large));
      assert.equal((await api('POST', `/invoice-adjustments/${large}/approve`, principal.accessToken)).status, 200);
    });

    it('CTC-P05-058: công nợ phản ánh khoản điều chỉnh đã duyệt; hóa đơn gốc giữ nguyên', async () => {
      const view = await invoiceView('T2');
      assert.equal(view.total_amount, 2_830_000);
      assert.equal(view.adjustment_amount, -1_270_000);
      assert.equal(view.payable_amount, 2_830_000 - 63_000 - 1_270_000);
    });

    it('CTC-P05-059: quản lý đơn vị và giáo viên không lập được phiếu điều chỉnh; hóa đơn nháp không lập được', async () => {
      const body = { invoice_id: invoices.T2, amount: -10_000, reason: 'Thử' };
      assert.equal((await api('POST', '/invoice-adjustments', token('manager'), body)).status, 403);
      assert.equal((await api('POST', '/invoice-adjustments', token('teacher'), body)).status, 403);
      const draft = await api('POST', '/invoice-adjustments', token('accountant'), {
        ...body,
        invoice_id: invoices.T6,
      });
      assert.equal(draft.status, 422);
      assert.equal(errorOf(draft.body).rule_code, 'BR-25');
    });

    it('CTC-P01-052: tra nhật ký theo phiếu điều chỉnh có người thực hiện, thời điểm, giá trị trước và sau', async () => {
      const response = await api(
        'GET',
        `/audit-logs?entity_name=invoice_adjustments&entity_id=${small}`,
        principal.accessToken,
      );
      assert.equal(response.status, 200, JSON.stringify(response.body));
      const items = (
        response.body as {
          items: Array<{
            actor_user_id: string;
            created_at: string;
            action: string;
            before_data: unknown;
            after_data: Record<string, unknown> | null;
          }>;
        }
      ).items;
      const created = items.find((row) => row.action === 'create');
      assert.equal(created?.actor_user_id, users.accountant?.userId);
      assert.ok(created?.created_at);
      assert.equal(created?.after_data?.amount, -70_000);
      const decided = items.find((row) => row.action === 'update');
      assert.ok(decided?.before_data && decided.after_data);
    });

    it('Điều chỉnh giảm vượt số phải nộp bị chặn', async () => {
      const response = await api('POST', '/invoice-adjustments', token('accountant'), {
        invoice_id: invoices.T2,
        amount: -5_000_000,
        reason: 'Quá số',
      });
      assert.equal(response.status, 422);
      assert.equal(errorOf(response.body).rule_code, 'BR-22');
    });
  });
});
