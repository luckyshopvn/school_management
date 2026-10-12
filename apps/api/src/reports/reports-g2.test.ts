import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import ExcelJS from 'exceljs';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { OPERATIONS_SECTION_PROVIDERS, type OperationsSectionProvider } from './operations-report.js';

// Báo cáo giai đoạn 2 (DT-10 phần 10j, YCTD-83): P17-10 báo cáo hoạt động và công việc, P17-11 báo cáo hợp nhất nhiều đơn
// vị, P17-12 xuất dữ liệu; BR-01, BR-74; kịch bản CT-10j-1 đến CT-10j-6 (người điều phối đánh số CT chính thức)
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const currentMonth = vietnamToday.slice(0, 7);
const [year, month] = currentMonth.split('-').map(Number) as [number, number];
const dayOne = addDays(vietnamToday, -2);
const dayTwo = addDays(vietnamToday, -1);
const range = `from=${addDays(vietnamToday, -10)}&to=${vietnamToday}`;

interface Section {
  code: string;
  rows: Array<Record<string, string | number | null>>;
}

describe('Báo cáo giai đoạn 2: hoạt động, hợp nhất, xuất dữ liệu', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let academicYearId = '';
  const units: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const classes: Record<string, string> = {};
  const children: Record<string, string> = {};

  const token = (name: string) => users[name]?.accessToken ?? '';
  const get = (path: string, accessToken: string) => sendJson('GET', `${environment.baseUrl}${path}`, accessToken);
  const exportReport = async (code: string, accessToken: string, body: unknown) => {
    const response = await fetch(`${environment.baseUrl}/reports/${code}/export`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    });
    return { status: response.status, headers: response.headers, body: Buffer.from(await response.arrayBuffer()) };
  };
  const readWorkbook = async (body: Buffer) => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(body as unknown as ArrayBuffer);
    return workbook;
  };
  const sheetValues = (workbook: ExcelJS.Workbook, name: string) => {
    const sheet = workbook.getWorksheet(name);
    assert.ok(sheet, `Thiếu trang ${name}`);
    const rows: unknown[][] = [];
    sheet.eachRow((row) => rows.push((row.values as unknown[]).slice(1)));
    return rows;
  };
  const section = (body: Record<string, unknown>, code: string) => {
    const found = (body.sections as Section[]).find((item) => item.code === code);
    assert.ok(found, `Thiếu mục ${code}`);
    return found;
  };

  const addChild = async (name: string, orgUnitId: string, classId: string) => {
    const child = await schoolYear
      .insertInto('children')
      .values({
        org_unit_id: orgUnitId,
        full_name: name,
        dob: '2022-03-15',
        gender: 'female',
        national_id_encrypted: 'ma-hoa',
        national_id_hash: randomUUID(),
        national_id_last4: '1234',
        photo_consent: 'pending',
        status: 'active',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('class_enrollments')
      .values({ child_id: child.id, class_id: classId, from_date: addDays(vietnamToday, -60) })
      .execute();
    return child.id;
  };

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    const firstStart = addDays(vietnamToday, -100);
    const firstEnd = addDays(vietnamToday, 120);
    const startYear = Number(firstStart.slice(0, 4));
    academicYearId = await openTestAcademicYear(environment, principal.accessToken, `${startYear}–${startYear + 1}`, {
      first_term: { start_date: firstStart, end_date: firstEnd },
      second_term: { start_date: addDays(firstEnd, 3), end_date: addDays(firstEnd, 120) },
    });
    const yearDatabase = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, yearDatabase.database_name),
    );
    for (const [code, type] of [
      ['TC', 'truong_chinh'],
      ['ĐT-A1', 'diem_truong'],
      ['ĐT-B1', 'diem_truong'],
    ] as const) {
      units[code] = (
        await sendJson('POST', `${environment.baseUrl}/org-units`, principal.accessToken, {
          code,
          name: code,
          unit_type: type,
        })
      ).body.id as string;
    }
    users.manager = await environment.loginAs('VT-03', units['ĐT-A1'] ?? null);
    users.accountant = await environment.loginAs('VT-04', units['ĐT-A1'] ?? null);
    users.personnel = await environment.loginAs('VT-06', units['ĐT-A1'] ?? null);
    users.teacher = await environment.loginAs('VT-07', units['ĐT-A1'] ?? null);
    users.upper = await environment.loginAs('VT-19', null);
    for (const [code, unit] of [
      ['MAM1', 'ĐT-A1'],
      ['MAM2', 'ĐT-A1'],
      ['CHOI1', 'ĐT-B1'],
    ] as const) {
      classes[code] = (
        await schoolYear
          .insertInto('classes')
          .values({
            org_unit_id: units[unit] ?? '',
            academic_year_id: academicYearId,
            code,
            name: code,
            grade_level: code.startsWith('MAM') ? 'MAM' : 'CHOI',
            max_size: 30,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    children.an = await addChild('Nguyễn An', units['ĐT-A1'] ?? '', classes.MAM1 ?? '');
    children.chi = await addChild('Lê Chi', units['ĐT-A1'] ?? '', classes.MAM1 ?? '');
    children.binh = await addChild('Trần Bình', units['ĐT-A1'] ?? '', classes.MAM2 ?? '');
    children.dung = await addChild('Phạm Dũng', units['ĐT-B1'] ?? '', classes.CHOI1 ?? '');
    const teacherId = users.teacher?.userId ?? '';
    // Điểm danh hai ngày gần nhất: Mầm 1 có 3 lượt đi học trên 4, Mầm 2 vắng 1, Chồi 1 đi học 1
    const recordedAt = new Date();
    const record = (
      childId: string,
      classId: string,
      unit: string,
      date: string,
      status: 'present' | 'absent_notified',
    ) => ({
      child_id: childId,
      class_id: classId,
      org_unit_id: units[unit] ?? '',
      attendance_date: date,
      status,
      source: 'teacher' as const,
      recorded_by: teacherId,
      recorded_at: recordedAt,
    });
    await schoolYear
      .insertInto('attendance_records')
      .values([
        record(children.an, classes.MAM1 ?? '', 'ĐT-A1', dayOne, 'present'),
        record(children.an, classes.MAM1 ?? '', 'ĐT-A1', dayTwo, 'present'),
        record(children.chi, classes.MAM1 ?? '', 'ĐT-A1', dayOne, 'present'),
        record(children.chi, classes.MAM1 ?? '', 'ĐT-A1', dayTwo, 'absent_notified'),
        record(children.binh, classes.MAM2 ?? '', 'ĐT-A1', dayOne, 'absent_notified'),
        record(children.dung, classes.CHOI1 ?? '', 'ĐT-B1', dayOne, 'present'),
      ])
      .execute();
    // Sổ liên lạc Mầm 1: hai bản đã công bố (một bản sửa sau công bố), một bản nháp
    const journal = (childId: string, date: string, published: boolean) => ({
      child_id: childId,
      class_id: classes.MAM1 ?? '',
      journal_date: date,
      meal_note: 'Ăn hết suất',
      status: published ? ('published' as const) : ('draft' as const),
      published_at: published ? new Date() : null,
      published_by: published ? teacherId : null,
      updated_by: teacherId,
    });
    const journals = await schoolYear
      .insertInto('daily_journals')
      .values([
        journal(children.an, dayOne, true),
        journal(children.an, dayTwo, true),
        journal(children.chi, dayOne, false),
      ])
      .returning('id')
      .execute();
    await schoolYear
      .insertInto('journal_amendments')
      .values({
        journal_id: journals[0]?.id ?? '',
        reason: 'Ghi nhầm bữa ăn',
        before_data: JSON.stringify({ meal_note: 'Ăn hết suất' }),
        after_data: JSON.stringify({ meal_note: 'Ăn nửa suất' }),
        amended_by: teacherId,
      })
      .execute();
    // Y tế: một sự kiện mức nặng của An, một lượt chăm sóc của Chi
    await schoolYear
      .insertInto('medical_events')
      .values({
        child_id: children.an,
        org_unit_id: units['ĐT-A1'] ?? '',
        occurred_at: new Date(),
        symptoms: 'Sốt cao',
        handling: 'Chườm mát',
        handler_name: 'Y tế',
        severity: 'severe',
        recorded_by: teacherId,
      })
      .execute();
    await schoolYear
      .insertInto('daily_care_logs')
      .values({
        child_id: children.chi,
        care_date: dayTwo,
        recorded_at: new Date(),
        temperature: '37.5',
        recorded_by: teacherId,
      })
      .execute();
    // Dặn thuốc: một yêu cầu đang cho uống, một liều đã cho uống và một liều bỏ
    const medication = await schoolYear
      .insertInto('medication_requests')
      .values({
        child_id: children.an,
        org_unit_id: units['ĐT-A1'] ?? '',
        class_id: classes.MAM1 ?? '',
        requested_by: randomUUID(),
        medicine_name: 'Siro ho',
        dosage: '5ml',
        times: ['09:00'],
        from_date: dayOne,
        to_date: vietnamToday,
        allergy_note: 'Không',
        medicine_photo_ids: [randomUUID()],
        assigned_role: 'nurse',
        status: 'administering',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('medication_administrations')
      .values([
        {
          request_id: medication.id,
          scheduled_date: dayOne,
          scheduled_time: '09:00',
          administered_at: new Date(),
          administered_by: teacherId,
        },
        {
          request_id: medication.id,
          scheduled_date: dayTwo,
          scheduled_time: '09:00',
          administered_by: teacherId,
          is_skipped: true,
          skip_reason: 'Trẻ ngủ',
        },
      ])
      .execute();
    await schoolYear
      .insertInto('notifications')
      .values({
        org_unit_id: units['ĐT-A1'] ?? '',
        template_code: 'GENERAL',
        title: 'Họp phụ huynh',
        body: 'Họp phụ huynh cuối tuần',
        target_type: 'org_unit',
        target_id: units['ĐT-A1'] ?? '',
      })
      .execute();
    // Học phí tháng này: ĐT-A1 hai hóa đơn 3 000 000 và 2 000 000, ĐT-B1 một hóa đơn 4 000 000
    for (const [childId, unit, amount] of [
      [children.an, 'ĐT-A1', 3_000_000],
      [children.binh, 'ĐT-A1', 2_000_000],
      [children.dung, 'ĐT-B1', 4_000_000],
    ] as const) {
      await schoolYear
        .insertInto('invoices')
        .values({
          code: `HD-${randomInt(100_000, 999_999)}`,
          child_id: childId,
          org_unit_id: units[unit] ?? '',
          period_year: year,
          period_month: month,
          invoice_kind: 'main',
          status: 'issued',
          total_amount: amount,
          basis: '{}',
          due_date: addDays(vietnamToday, 20),
        })
        .execute();
    }
    const category = await schoolYear
      .insertInto('cashflow_categories')
      .values({ code: 'KHAC', name: 'Thu khác', group_name: 'Thu', flow_type: 'income' })
      .returning('id')
      .executeTakeFirstOrThrow();
    const account = await schoolYear
      .insertInto('cash_accounts')
      .values({
        org_unit_id: units['ĐT-A1'] ?? '',
        account_type: 'cash',
        name: 'Quỹ A1',
        opening_balance: 0,
        current_balance: 0,
        created_by: users.accountant?.userId ?? '',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('receipts')
      .values({
        code: 'PT-900001',
        org_unit_id: units['ĐT-A1'] ?? '',
        child_id: children.binh,
        payer_name: 'Phụ huynh Trần Bình',
        amount: 700_000,
        method: 'cash',
        account_id: account.id,
        category_id: category.id,
        receipt_date: vietnamToday,
        request_key: randomUUID(),
        created_by: users.accountant?.userId ?? '',
      })
      .execute();
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-10j-1, P17-10: quản lý đơn vị xem báo cáo hoạt động của các lớp trong đơn vị được gán', async () => {
    const response = await get(`/reports/activities?${range}`, token('manager'));
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.deepEqual(
      (response.body.sections as Section[]).map((item) => item.code),
      ['attendance', 'journals', 'health', 'medication', 'notifications'],
    );
    const attendance = section(response.body, 'attendance');
    assert.deepEqual(
      attendance.rows.map((row) => [row.class_name, row.children_count, row.present, row.total, row.rate_percent]),
      [
        ['MAM1', 2, 3, 4, 75],
        ['MAM2', 1, 0, 1, 0],
      ],
    );
    const journals = section(response.body, 'journals').rows[0];
    assert.equal(journals?.published_count, 2);
    assert.equal(journals?.draft_count, 1);
    assert.equal(journals?.amendment_count, 1);
    assert.equal(journals?.coverage_percent, 66.7);
    const health = section(response.body, 'health').rows[0];
    assert.deepEqual([health?.medical_event_count, health?.severe_event_count, health?.daily_care_count], [1, 1, 1]);
    const medication = section(response.body, 'medication').rows[0];
    assert.deepEqual([medication?.request_count, medication?.given_count, medication?.skipped_count], [1, 1, 1]);
    assert.deepEqual(
      section(response.body, 'notifications').rows.map((row) => [row.org_unit_name, row.notification_count]),
      [['ĐT-A1', 1]],
    );
    const filtered = await get(`/reports/activities?${range}&class_id=${classes.MAM2}`, token('manager'));
    assert.deepEqual(
      section(filtered.body, 'attendance').rows.map((row) => row.class_name),
      ['MAM2'],
    );
  });

  it('CT-10j-2, P17-10, BR-01: đơn vị hoặc lớp ngoài phạm vi, vai trò không có quyền và khoảng ngày quá dài bị từ chối', async () => {
    assert.equal(
      (await get(`/reports/activities?${range}&org_unit_id=${units['ĐT-B1']}`, token('manager'))).status,
      403,
    );
    assert.equal((await get(`/reports/activities?${range}&class_id=${classes.CHOI1}`, token('manager'))).status, 403);
    assert.equal((await get(`/reports/activities?${range}`, token('teacher'))).status, 403);
    assert.equal((await get(`/reports/activities?${range}`, token('accountant'))).status, 403);
    assert.equal((await get(`/reports/activities?${range}`, token('upper'))).status, 403);
    const tooLong = await get(
      `/reports/activities?from=${addDays(vietnamToday, -400)}&to=${vietnamToday}`,
      token('manager'),
    );
    assert.equal(tooLong.status, 400);
  });

  it('P17-10: nguồn số liệu mới (ví dụ hoạt động P14, công việc P09) gắn thêm vào báo cáo không phải sửa dịch vụ', async () => {
    const providers = environment.api.get<OperationsSectionProvider[]>(OPERATIONS_SECTION_PROVIDERS);
    const extra: OperationsSectionProvider = {
      code: 'activities',
      title: 'Hoạt động',
      build: async (context) => ({
        columns: [{ key: 'class_name', label: 'Lớp' }],
        rows: context.classes.map((row) => ({ class_name: row.name, published_count: 0 })),
      }),
    };
    providers.push(extra);
    try {
      const response = await get(`/reports/activities?${range}`, token('manager'));
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal(section(response.body, 'activities').rows.length, 2);
    } finally {
      providers.splice(providers.indexOf(extra), 1);
    }
  });

  it('CT-10j-3, P17-11: cán bộ quản lý cấp trên xem báo cáo hợp nhất chỉ có số liệu tổng hợp', async () => {
    const response = await get(`/reports/consolidated?month=${currentMonth}`, token('upper'));
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const rows = response.body.units as Array<Record<string, number | string | null>>;
    assert.deepEqual(
      rows.map((row) => [row.org_unit_code, row.children_count, row.classes_count, row.tuition_payable_amount]),
      [
        ['TC', 0, 0, 0],
        ['ĐT-A1', 3, 2, 5_000_000],
        ['ĐT-B1', 1, 1, 4_000_000],
      ],
    );
    const unitA = rows.find((row) => row.org_unit_code === 'ĐT-A1');
    assert.equal(unitA?.attendance_rate_percent, 60);
    assert.equal(unitA?.income_amount, 700_000);
    assert.equal(unitA?.debt_outstanding_amount, 5_000_000);
    const totals = response.body.totals as Record<string, number>;
    assert.equal(totals.children_count, 4);
    assert.equal(totals.tuition_payable_amount, 9_000_000);
    assert.equal(totals.attendance_rate_percent, 66.7);
    // Không có dữ liệu cá nhân: không tên trẻ, tên người nộp, mã trẻ
    const text = JSON.stringify(response.body);
    for (const value of ['Nguyễn An', 'Lê Chi', 'Trần Bình', 'Phạm Dũng', 'Phụ huynh', children.an ?? '']) {
      assert.ok(!text.includes(value), `Lộ dữ liệu cá nhân: ${value}`);
    }
    const chosen = await get(
      `/reports/consolidated?month=${currentMonth}&org_unit_ids=${units['ĐT-A1']},${units['ĐT-B1']}`,
      principal.accessToken,
    );
    assert.equal(chosen.status, 200, JSON.stringify(chosen.body));
    assert.equal((chosen.body.units as unknown[]).length, 2);
  });

  it('CT-10j-4, P17-11, BR-01: cán bộ quản lý cấp trên không xem được báo cáo có dữ liệu cá nhân; quản lý đơn vị không xem báo cáo hợp nhất', async () => {
    for (const path of [
      `/reports/debts`,
      `/reports/attendance?${range}`,
      `/dashboard/birthdays?month=${currentMonth}`,
      `/reports/cash-flow?${range}`,
      `/reports/staff-attendance?month=${currentMonth}`,
    ]) {
      assert.equal((await get(path, token('upper'))).status, 403, path);
    }
    assert.equal((await get(`/reports/consolidated?month=${currentMonth}`, token('manager'))).status, 403);
    assert.equal(
      (await get(`/reports/consolidated?month=${currentMonth}&org_unit_ids=khong-hop-le`, principal.accessToken))
        .status,
      400,
    );
  });

  it('CT-10j-5, P17-12, BR-74: kế toán xuất báo cáo công nợ ra Excel, hệ thống ghi nhật ký xuất', async () => {
    const response = await exportReport('debts', token('accountant'), { org_unit_id: units['ĐT-A1'] });
    assert.equal(response.status, 200, response.body.toString());
    assert.match(response.headers.get('content-type') ?? '', /spreadsheetml/);
    assert.match(response.headers.get('content-disposition') ?? '', /bao-cao-debts-.*\.xlsx/);
    const workbook = await readWorkbook(response.body);
    const children = sheetValues(workbook, 'Theo trẻ');
    assert.deepEqual(children[0]?.slice(0, 3), ['Trẻ', 'Lớp', 'Còn nợ']);
    assert.deepEqual(
      children
        .slice(1)
        .map((row) => row[0])
        .sort(),
      ['Nguyễn An', 'Trần Bình'],
    );
    const log = await schoolYear
      .selectFrom('export_logs')
      .selectAll()
      .where('id', '=', response.headers.get('x-export-log-id') ?? '')
      .executeTakeFirstOrThrow();
    assert.equal(log.report_code, 'debts');
    assert.equal(log.user_id, users.accountant?.userId);
    assert.equal(log.contains_personal_data, true);
    assert.equal(log.row_count, 4);
    assert.deepEqual(log.org_unit_ids, [units['ĐT-A1']]);
    assert.deepEqual(log.filters_data, { org_unit_id: units['ĐT-A1'] });

    const staff = await exportReport('staff-attendance', token('personnel'), { month: currentMonth });
    assert.equal(staff.status, 200, staff.body.toString());
    const consolidated = await exportReport('consolidated', principal.accessToken, { month: currentMonth });
    assert.equal(consolidated.status, 200, consolidated.body.toString());
    const unitsSheet = sheetValues(await readWorkbook(consolidated.body), 'Theo đơn vị');
    assert.equal(unitsSheet.length, 5);
    assert.deepEqual(unitsSheet[4]?.slice(1, 3), ['Tổng các đơn vị', 4]);
    const consolidatedLog = await schoolYear
      .selectFrom('export_logs')
      .selectAll()
      .where('report_code', '=', 'consolidated')
      .executeTakeFirstOrThrow();
    assert.equal(consolidatedLog.contains_personal_data, false);
    assert.equal(consolidatedLog.org_unit_ids.length, 3);
  });

  it('CT-10j-6, P17-12, BR-74: không có quyền xuất hoặc không có quyền xem báo cáo thì không xuất được và không ghi nhật ký', async () => {
    const before = await schoolYear
      .selectFrom('export_logs')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    assert.equal((await exportReport('debts', token('teacher'), {})).status, 403);
    assert.equal((await exportReport('debts', token('manager'), {})).status, 403);
    assert.equal((await exportReport('consolidated', token('upper'), { month: currentMonth })).status, 403);
    // Kế toán có quyền xuất nhưng không có quyền xem báo cáo điểm danh, báo cáo hợp nhất, hoặc đơn vị khác
    assert.equal(
      (await exportReport('attendance', token('accountant'), { from: dayOne, to: vietnamToday })).status,
      403,
    );
    assert.equal((await exportReport('consolidated', token('accountant'), { month: currentMonth })).status, 403);
    assert.equal((await exportReport('debts', token('accountant'), { org_unit_id: units['ĐT-B1'] })).status, 403);
    assert.equal((await exportReport('khong-co', token('accountant'), {})).status, 404);
    assert.equal((await exportReport('tuition', token('accountant'), { month: '2026-13' })).status, 400);
    const after = await schoolYear
      .selectFrom('export_logs')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    assert.equal(after.count, before.count);
  });

  it('P17-12: nhật ký xuất, Hiệu trưởng xem mọi lần xuất, kế toán chỉ xem lần xuất của mình', async () => {
    const logRange = `from=${addDays(vietnamToday, -1)}&to=${addDays(vietnamToday, 1)}`;
    const principalView = await get(`/reports/export-logs?${logRange}`, principal.accessToken);
    assert.equal(principalView.status, 200, JSON.stringify(principalView.body));
    const all = principalView.body as unknown as Array<{ report_code: string; user_id: string }>;
    assert.deepEqual([...new Set(all.map((row) => row.report_code))].sort(), [
      'consolidated',
      'debts',
      'staff-attendance',
    ]);
    const own = (await get(`/reports/export-logs?${logRange}`, token('accountant'))).body as unknown as Array<{
      user_id: string;
    }>;
    assert.ok(own.length >= 1);
    assert.ok(own.every((row) => row.user_id === users.accountant?.userId));
    assert.equal((await get(`/reports/export-logs?${logRange}`, token('manager'))).status, 403);
  });
});
