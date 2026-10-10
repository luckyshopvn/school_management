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

// Tính học phí, phát hành hóa đơn chính và bổ sung; ca kiểm thử theo 27_BO_CA_KIEM_THU_CHI_TIET/03_P05.md mục 6, 7 và
// CTC-P05-015, 017, 018. Kỳ tính là tháng trước tháng hiện tại để mọi ngày học đều đã qua và chốt được điểm danh
const randomPhone = () => `09${randomInt(0, 100_000_000).toString().padStart(8, '0')}`;
const errorOf = (body: Record<string, unknown>) =>
  (body.error ?? {}) as { code?: string; rule_code?: string; details?: Array<{ field: string; message: string }> };
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

function shiftMonth(offset: number) {
  const base = new Date(Date.UTC(Number(vietnamToday.slice(0, 4)), Number(vietnamToday.slice(5, 7)) - 1 + offset, 1));
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth() + 1;
  const period = `${year}-${String(month).padStart(2, '0')}`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { period, first: `${period}-01`, last: `${period}-${String(lastDay).padStart(2, '0')}` };
}

// Ngày học là thứ hai đến thứ sáu, năm học kiểm thử không có tuần nghỉ
function weekdays(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      days.push(day);
    }
  }
  return days;
}

type Invoice = {
  id: string;
  code: string | null;
  child_id: string;
  invoice_kind: string;
  status: string;
  total_amount: number;
  review_flags: string[];
};
type InvoiceDetail = Invoice & {
  items: Array<{ item_type: string; service_id: string | null; quantity: number; amount: number }>;
};

describe('Tính học phí và phát hành hóa đơn', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let savedDefaultPassword: Array<{ key: string; value: unknown; updated_by: string | null }> = [];
  const units: Record<string, string> = {};
  const classes: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const children: Record<string, string> = {};
  const parentPhones = { T1: randomPhone(), T2: randomPhone() };
  const parentTokens: Record<string, string> = {};
  const serviceIds: Record<string, string> = {};
  const billed = shiftMonth(-1);
  const schoolDays = weekdays(billed.first, billed.last);
  const days = schoolDays.length;
  const t3EnrollIndex = 10;
  const lateStartIndex = 5;

  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);
  const calculate = (accessToken: string, unit: string) =>
    api('POST', '/fee-calculations', accessToken, { org_unit_id: units[unit], period: billed.period });
  const invoicesOf = async (accessToken: string, query: string) =>
    (await api('GET', `/invoices?${query}`, accessToken)).body as unknown as Invoice[];
  const detail = async (accessToken: string, invoiceId: string) =>
    (await api('GET', `/invoices/${invoiceId}`, accessToken)).body as unknown as InvoiceDetail;
  const approveLate = async (child: string, service: string, chargeMethod: 'full_month' | 'actual_days') => {
    const registered = await api('POST', '/service-registrations', parentTokens[child] ?? '', {
      child_id: children[child],
      period: billed.period,
      service_id: serviceIds[service],
      service_start_date: schoolDays[lateStartIndex],
    });
    assert.equal(registered.body.status, 'pending_late', JSON.stringify(registered.body));
    const approved = await api(
      'POST',
      `/service-registrations/${registered.body.id}/approve-late`,
      token('vicePrincipal'),
      {
        charge_method: chargeMethod,
      },
    );
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
  };

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
    const yearId = await openTestAcademicYear(environment, principal.accessToken, 'Năm học kiểm thử', {
      first_term: { start_date: shiftMonth(-2).first, end_date: shiftMonth(3).last },
      second_term: { start_date: shiftMonth(4).first, end_date: shiftMonth(5).last },
      summer_term: { start_date: shiftMonth(6).first, end_date: shiftMonth(7).last },
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
    for (const [code, name] of [
      ['MAM', 'Mầm'],
      ['LA', 'Lá'],
    ] as const) {
      await api('POST', '/grade-levels', principal.accessToken, { code, name, age_from_months: 36, age_to_months: 71 });
    }
    await api('POST', '/catalog-items', principal.accessToken, {
      catalog_type: 'parent_relationship',
      code: 'ME',
      name: 'Mẹ',
    });
    for (const [code, unit, grade] of [
      ['L-A1', 'ĐT-A1', 'MAM'],
      ['L-B1', 'ĐT-B1', 'LA'],
    ] as const) {
      classes[code] = (
        await api('POST', '/classes', principal.accessToken, {
          org_unit_id: units[unit],
          code,
          name: code,
          grade_level: grade,
          max_size: 25,
        })
      ).body.id as string;
    }
    users.accountant = await environment.loginAs('VT-04', units['ĐT-A1'] ?? null);
    users.accountantB = await environment.loginAs('VT-04', units['ĐT-B1'] ?? null);
    users.manager = await environment.loginAs('VT-03', units['ĐT-A1'] ?? null);
    users.managerB = await environment.loginAs('VT-03', units['ĐT-B1'] ?? null);
    users.vicePrincipal = await environment.loginAs('VT-15', units['ĐT-A1'] ?? null);
    for (const [code, name] of [
      ['STEM', 'STEM'],
      ['ANH_VAN', 'Anh văn'],
      ['VE', 'Vẽ'],
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
    const schedule = await api('POST', '/fee-schedules', token('accountant'), {
      name: 'Biểu phí kiểm thử',
      effective_from: shiftMonth(-2).first,
      items: [
        { grade_level: 'MAM', fee_type: 'tuition', amount: 2_200_000 },
        { grade_level: 'MAM', fee_type: 'service', service_id: MEAL_SERVICE_ID, amount: 35_000 },
        { grade_level: 'MAM', fee_type: 'service', service_id: serviceIds.STEM, amount: 440_000 },
        { grade_level: 'MAM', fee_type: 'service', service_id: serviceIds.ANH_VAN, amount: 550_000 },
        { grade_level: 'MAM', fee_type: 'service', service_id: serviceIds.VE, amount: 300_000 },
      ],
    });
    assert.equal(schedule.status, 201, JSON.stringify(schedule.body));

    const book = new ExcelJS.Workbook();
    const worksheet = book.addWorksheet('Trẻ');
    worksheet.addRow(IMPORT_COLUMNS.children.map((column) => column.header));
    for (const [index, [name, unit, classCode]] of [
      ['T1', 'ĐT-A1', 'L-A1'],
      ['T2', 'ĐT-A1', 'L-A1'],
      ['T3', 'ĐT-A1', 'L-A1'],
      ['T4', 'ĐT-B1', 'L-B1'],
    ].entries()) {
      const row: Record<string, string> = {
        unit_code: unit ?? '',
        class_code: classCode ?? '',
        full_name: `Trẻ ${name}`,
        dob: '2022-04-18',
        gender: 'Nam',
        national_id: `084${String(Date.now() % 1_000_000).padStart(6, '0')}${String(randomInt(0, 100) * 10 + index).padStart(3, '0')}`,
        allergies: 'Không',
        enroll_date: shiftMonth(-2).first,
        guardian1_name: `Mẹ ${name}`,
        guardian1_relationship: 'Mẹ',
        guardian1_phone: parentPhones[name as 'T1' | 'T2'] ?? randomPhone(),
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
    // T3 nhập học giữa kỳ tính (BR-23)
    await schoolYear
      .updateTable('children')
      .set({ enroll_date: schoolDays[t3EnrollIndex] })
      .where('id', '=', children.T3 ?? '')
      .execute();
    for (const [child, phone] of Object.entries(parentPhones)) {
      await environment.identity.database
        .updateTable('users')
        .set({ password_hash: await hashForTesting(TEST_PASSWORD), must_change_password: false })
        .where('phone', '=', phone)
        .execute();
      parentTokens[child] = (
        await sendJson('POST', `${environment.identity.baseUrl}/auth/login`, undefined, {
          login: phone,
          password: TEST_PASSWORD,
          channel: 'parent',
        })
      ).body.access_token as string;
    }
    // T1 đăng ký STEM đúng hạn từ trước kỳ (kỳ tính đã qua ngày chốt nên ghi thẳng dữ liệu chuẩn bị)
    await schoolYear
      .insertInto('service_registrations')
      .values({
        child_id: children.T1 ?? '',
        org_unit_id: units['ĐT-A1'] ?? '',
        period_year: Number(billed.period.slice(0, 4)),
        period_month: Number(billed.period.slice(5, 7)),
        service_id: serviceIds.STEM ?? '',
        status: 'active',
        source: 'parent',
      })
      .execute();
    // T2 đăng ký STEM trễ, Ban Giám hiệu duyệt thu theo ngày thực tế (CTC-P05-015)
    await approveLate('T2', 'STEM', 'actual_days');
    for (const [unit, name] of [
      ['ĐT-A1', 'accountant'],
      ['ĐT-B1', 'accountantB'],
    ] as const) {
      const locked = await api('POST', '/service-registrations/lock', token(name), {
        org_unit_id: units[unit],
        period: billed.period,
      });
      assert.equal(locked.status, 200, JSON.stringify(locked.body));
    }
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

  describe('P05-05 Tính học phí kỳ', () => {
    it('CTC-P05-031: còn ngày chưa chốt điểm danh thì chặn và liệt kê lớp, ngày', async () => {
      const response = await calculate(token('accountant'), 'ĐT-A1');
      assert.equal(response.status, 422, JSON.stringify(response.body));
      assert.equal(errorOf(response.body).rule_code, 'Q-151');
      const details = errorOf(response.body).details ?? [];
      assert.equal(details.length, days);
      assert.ok(details.every((detail) => detail.field === 'L-A1'));
    });

    it('CTC-P05-030: bậc học chưa có biểu phí hiệu lực thì chặn và chỉ rõ bậc học thiếu', async () => {
      const response = await calculate(token('accountantB'), 'ĐT-B1');
      assert.equal(response.status, 422, JSON.stringify(response.body));
      assert.equal(errorOf(response.body).rule_code, 'BR-17');
      assert.deepEqual(errorOf(response.body).details, [{ field: 'grade_level', message: 'LA' }]);
    });

    it('CTC-P05-033: kế toán đơn vị A không tính học phí cho đơn vị B; quản lý đơn vị không chạy tính được', async () => {
      assert.equal((await calculate(token('accountant'), 'ĐT-B1')).status, 403);
      assert.equal((await calculate(token('manager'), 'ĐT-A1')).status, 403);
    });

    it('CTC-P05-023 đến 026, CTC-P05-015, CTC-P05-034: chốt đủ điểm danh rồi tính đúng từng khoản và đánh dấu trẻ vắng nhiều', async () => {
      for (const [index, day] of schoolDays.entries()) {
        const entries = [
          { child_id: children.T1, status: index < 2 ? 'late' : 'present' },
          { child_id: children.T2, status: index < 6 ? 'absent_unnotified' : 'present' },
          { child_id: children.T3, status: index < t3EnrollIndex ? 'absent_notified' : 'present' },
        ];
        const saved = await api('PUT', `/classes/${classes['L-A1']}/attendance`, token('manager'), {
          date: day,
          entries,
        });
        assert.equal(saved.status, 200, JSON.stringify(saved.body));
        const locked = await api('POST', `/classes/${classes['L-A1']}/attendance/lock`, token('manager'), {
          date: day,
        });
        assert.equal(locked.status, 200, JSON.stringify(locked.body));
      }
      const response = await calculate(token('accountant'), 'ĐT-A1');
      assert.equal(response.status, 201, JSON.stringify(response.body));
      assert.equal(response.body.status, 'succeeded');
      assert.equal(response.body.child_count, 3);

      const invoices = await invoicesOf(token('accountant'), `org_unit_id=${units['ĐT-A1']}&period=${billed.period}`);
      assert.equal(invoices.length, 3);
      assert.ok(invoices.every((invoice) => invoice.status === 'draft' && invoice.code === null));
      const byChild = (child: string) => invoices.find((invoice) => invoice.child_id === children[child]);
      const amountOf = (invoice: InvoiceDetail, serviceId: string | null) =>
        invoice.items.find((item) => item.service_id === serviceId)?.amount;

      // T1: đủ tháng, đi muộn hai ngày vẫn tính ngày ăn (CTC-P05-023, 025)
      const t1 = await detail(token('accountant'), byChild('T1')?.id ?? '');
      assert.equal(amountOf(t1, null), 2_200_000);
      assert.equal(amountOf(t1, MEAL_SERVICE_ID), 35_000 * days);
      assert.equal(amountOf(t1, serviceIds.STEM ?? ''), 440_000);
      assert.equal(t1.total_amount, 2_200_000 + 35_000 * days + 440_000);

      // T2: vắng sáu ngày, tiền ăn theo ngày có mặt; STEM trễ thu theo ngày từ ngày bắt đầu (CTC-P05-024, 015, 034)
      const t2 = await detail(token('accountant'), byChild('T2')?.id ?? '');
      assert.equal(amountOf(t2, MEAL_SERVICE_ID), 35_000 * (days - 6));
      assert.equal(amountOf(t2, serviceIds.STEM ?? ''), Math.round((440_000 * (days - lateStartIndex)) / days));
      assert.ok(byChild('T2')?.review_flags.includes('absent_many'));

      // T3: nhập học giữa kỳ, học phí chính khóa theo ngày học trong thời gian đang học (CTC-P05-026, BR-23)
      const t3 = await detail(token('accountant'), byChild('T3')?.id ?? '');
      assert.equal(amountOf(t3, null), Math.round((2_200_000 * (days - t3EnrollIndex)) / days));
      assert.equal(amountOf(t3, MEAL_SERVICE_ID), 35_000 * (days - t3EnrollIndex));
    });

    it('CTC-P05-029: chạy lại tính không sinh khoản phải thu trùng, kết quả thay bằng lần tính mới', async () => {
      const before = await invoicesOf(token('accountant'), `org_unit_id=${units['ĐT-A1']}&period=${billed.period}`);
      const response = await calculate(token('accountant'), 'ĐT-A1');
      assert.equal(response.status, 201, JSON.stringify(response.body));
      const after = await invoicesOf(token('accountant'), `org_unit_id=${units['ĐT-A1']}&period=${billed.period}`);
      assert.deepEqual(after.map((invoice) => invoice.id).sort(), before.map((invoice) => invoice.id).sort());
      const runs = await schoolYear
        .selectFrom('fee_calculation_runs')
        .select('status')
        .where('org_unit_id', '=', units['ĐT-A1'] ?? '')
        .execute();
      assert.deepEqual(
        runs.map((run) => run.status),
        ['succeeded', 'succeeded'],
      );
    });
  });

  describe('P05-06 Phát hành khoản phải thu', () => {
    it('CTC-P05-042, CTC-P05-036: ngày đến hạn trước ngày phát hành bị từ chối; kế toán đơn vị khác không phát hành được', async () => {
      const early = await api('POST', '/invoices/issue', token('accountant'), {
        org_unit_id: units['ĐT-A1'],
        period: billed.period,
        due_date: addDays(vietnamToday, -1),
      });
      assert.equal(early.status, 400);
      const other = await api('POST', '/invoices/issue', token('accountantB'), {
        org_unit_id: units['ĐT-A1'],
        period: billed.period,
        due_date: addDays(vietnamToday, 10),
      });
      assert.equal(other.status, 403);
    });

    it('CTC-P05-035: phát hành cấp số cho mỗi hóa đơn chính, khóa kỳ, phụ huynh nhận thông báo trong ứng dụng và tin nhắn', async () => {
      const issued = await api('POST', '/invoices/issue', token('accountant'), {
        org_unit_id: units['ĐT-A1'],
        period: billed.period,
        due_date: addDays(vietnamToday, 10),
      });
      assert.equal(issued.status, 200, JSON.stringify(issued.body));
      const invoices = issued.body as unknown as Invoice[];
      assert.ok(invoices.every((invoice) => invoice.status === 'issued' && /^HD-\d{6}$/.test(invoice.code ?? '')));
      assert.equal(new Set(invoices.map((invoice) => invoice.code)).size, 3);
      const channels = await schoolYear
        .selectFrom('notification_recipients')
        .innerJoin('notifications', 'notifications.id', 'notification_recipients.notification_id')
        .select('notification_recipients.channel')
        .where('notifications.template_code', '=', 'invoice_issued')
        .where('notifications.target_id', '=', invoices.find((invoice) => invoice.child_id === children.T1)?.id ?? '')
        .execute();
      assert.deepEqual(channels.map((row) => row.channel).sort(), ['in_app', 'sms']);
    });

    it('CTC-P05-037, CTC-P05-039, QT-03 E2: kỳ đã phát hành không tính lại, không sửa trực tiếp hóa đơn', async () => {
      const rerun = await calculate(token('accountant'), 'ĐT-A1');
      assert.equal(rerun.status, 422);
      assert.equal(errorOf(rerun.body).rule_code, 'BR-25');
      const [invoice] = await invoicesOf(token('accountant'), `org_unit_id=${units['ĐT-A1']}&period=${billed.period}`);
      const edited = await api('PATCH', `/invoices/${invoice?.id}`, token('accountant'), { total_amount: 1 });
      assert.equal(edited.status, 422);
      assert.equal(errorOf(edited.body).rule_code, 'BR-25');
    });

    it('CTC-P05-038, CTC-P05-040: đăng ký trễ được duyệt sau phát hành lập hóa đơn bổ sung; hóa đơn chính giữ nguyên', async () => {
      const main = (await invoicesOf(token('accountant'), `child_id=${children.T1}&period=${billed.period}`)).find(
        (invoice) => invoice.invoice_kind === 'main',
      );
      await approveLate('T1', 'ANH_VAN', 'full_month');
      const first = await api('POST', '/invoices/supplementary', token('accountant'), {
        child_id: children.T1,
        period: billed.period,
        due_date: addDays(vietnamToday, 10),
      });
      assert.equal(first.status, 201, JSON.stringify(first.body));
      assert.equal(first.body.invoice_kind, 'supplementary');
      assert.equal(first.body.total_amount, 550_000);
      await approveLate('T1', 'VE', 'full_month');
      const second = await api('POST', '/invoices/supplementary', token('accountant'), {
        child_id: children.T1,
        period: billed.period,
        due_date: addDays(vietnamToday, 10),
      });
      assert.equal(second.body.total_amount, 300_000);
      const nothing = await api('POST', '/invoices/supplementary', token('accountant'), {
        child_id: children.T1,
        period: billed.period,
        due_date: addDays(vietnamToday, 10),
      });
      assert.equal(nothing.status, 422);
      const all = await invoicesOf(token('accountant'), `child_id=${children.T1}&period=${billed.period}`);
      assert.equal(all.filter((invoice) => invoice.invoice_kind === 'supplementary').length, 2);
      assert.equal(all.find((invoice) => invoice.invoice_kind === 'main')?.total_amount, main?.total_amount);
    });

    it('CTC-P05-041: phụ huynh chỉ thấy hóa đơn của con mình; nhân sự đơn vị khác không xem được', async () => {
      const mine = await invoicesOf(parentTokens.T1 ?? '', '');
      assert.equal(mine.length, 3);
      assert.ok(mine.every((invoice) => invoice.child_id === children.T1));
      const t2Invoice = (await invoicesOf(token('accountant'), `child_id=${children.T2}`))[0];
      assert.equal((await api('GET', `/invoices/${t2Invoice?.id}`, parentTokens.T1 ?? '')).status, 403);
      assert.equal((await api('GET', `/invoices?org_unit_id=${units['ĐT-A1']}`, parentTokens.T1 ?? '')).status, 403);
      assert.equal((await api('GET', `/invoices?org_unit_id=${units['ĐT-A1']}`, token('accountantB'))).status, 403);
      assert.equal((await api('GET', `/invoices?org_unit_id=${units['ĐT-A1']}`, token('manager'))).status, 200);
    });
  });

  describe('BR-33 Chặn đăng ký khi nợ quá hạn', () => {
    it('CTC-P05-017, CTC-P05-018: đơn vị bật chặn thì phụ huynh của trẻ có hóa đơn quá hạn không đăng ký thêm được; tắt thì được', async () => {
      await schoolYear
        .updateTable('invoices')
        .set({ due_date: addDays(vietnamToday, -1) })
        .where('child_id', '=', children.T1 ?? '')
        .where('invoice_kind', '=', 'main')
        .execute();
      const settings = (values: Record<string, unknown>) =>
        api('PUT', '/settings', token('manager'), { org_unit_id: units['ĐT-A1'], values });
      assert.equal((await settings({ block_service_registration_when_overdue: true })).status, 200);
      // Dịch vụ mới để không trùng với Anh văn, Vẽ đã tự giữ từ kỳ tính
      const music = await api('POST', '/services', token('accountant'), {
        code: 'NHAC',
        name: 'Âm nhạc',
        unit: 'tháng',
        calculation_method: 'monthly',
      });
      const body = { child_id: children.T1, period: shiftMonth(2).period, service_id: music.body.id };
      const blocked = await api('POST', '/service-registrations', parentTokens.T1 ?? '', body);
      assert.equal(blocked.status, 422, JSON.stringify(blocked.body));
      assert.equal(errorOf(blocked.body).rule_code, 'BR-33');
      // Trẻ còn nợ vẫn được điểm danh bình thường
      assert.equal(
        (await api('GET', `/classes/${classes['L-A1']}/attendance?date=${schoolDays[0]}`, token('manager'))).status,
        200,
      );
      assert.equal((await settings({ block_service_registration_when_overdue: false })).status, 200);
      const allowed = await api('POST', '/service-registrations', parentTokens.T1 ?? '', body);
      assert.equal(allowed.status, 201, JSON.stringify(allowed.body));
    });
  });
});
