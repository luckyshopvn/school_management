import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import ExcelJS from 'exceljs';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import { IMPORT_COLUMNS } from '../imports/imports.service.js';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';

// Hồ sơ nhân sự, hợp đồng lao động, liên kết tài khoản, chấm dứt hợp đồng, nhập nhân sự từ Excel (DT-06 phần 6a, YCTD-58);
// ca kiểm thử CTC-P08-043, CTC-P08-059, CTC-P01-082 và các quy tắc BR-05, BR-37, BR-38, BR-46
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const randomCode = (prefix: string) => `${prefix}-${randomInt(100_000, 999_999)}`;

describe('Hồ sơ nhân sự và hợp đồng lao động', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  const units: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const staffIds: Record<string, string> = {};
  const contracts: Record<string, string> = {};
  let departmentId = '';
  let jobTitleId = '';

  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);
  const usernameOf = async (userId: string) =>
    (
      await environment.identity.database
        .selectFrom('users')
        .select('username')
        .where('id', '=', userId)
        .executeTakeFirstOrThrow()
    ).username ?? '';
  const createStaff = (accessToken: string, body: Record<string, unknown>) =>
    api('POST', '/staff', accessToken, {
      org_unit_id: units['ĐT-A1'],
      code: randomCode('NS'),
      full_name: 'Nguyễn Thị Lan',
      start_date: '2026-08-01',
      ...body,
    });

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
      first_term: { start_date: '2026-09-01', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
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
      units[code] = (await api('POST', '/org-units', principal.accessToken, { code, name: code, unit_type: type })).body
        .id as string;
    }
    const unitA = units['ĐT-A1'] ?? null;
    users.personnel = await environment.loginAs('VT-06', unitA);
    users.manager = await environment.loginAs('VT-03', unitA);
    users.accountant = await environment.loginAs('VT-04', unitA);
    users.teacher = await environment.loginAs('VT-07', unitA);
    users.otherTeacher = await environment.loginAs('VT-07', unitA);
    users.parent = await environment.loginAs('VT-14', unitA);
    departmentId = (
      await api('POST', '/departments', token('personnel'), { org_unit_id: unitA, name: 'Tổ chuyên môn' })
    ).body.id as string;
    jobTitleId = (await api('POST', '/job-titles', token('personnel'), { org_unit_id: unitA, name: 'Giáo viên' })).body
      .id as string;
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  describe('P07-01 Hồ sơ nhân sự', () => {
    it('phòng nhân sự tạo hồ sơ kèm phòng ban, chức danh; số định danh chỉ hiện bốn số cuối; trùng mã bị từ chối', async () => {
      const code = randomCode('GV');
      const created = await createStaff(token('personnel'), {
        code,
        full_name: 'Trần Thị Mai',
        gender: 'female',
        phone: '0912345678',
        id_number: '079188001234',
        department_id: departmentId,
        job_title_id: jobTitleId,
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      assert.equal(created.body.department_name, 'Tổ chuyên môn');
      assert.equal(created.body.job_title_name, 'Giáo viên');
      assert.equal(created.body.id_number_masked, '********1234');
      assert.ok(!JSON.stringify(created.body).includes('079188001234'));
      staffIds.teacher = created.body.id as string;
      assert.equal((await createStaff(token('personnel'), { code })).status, 409);
      staffIds.other = (await createStaff(token('personnel'), { full_name: 'Lê Văn Hùng' })).body.id as string;
    });

    it('phòng ban của đơn vị khác, nhân sự đơn vị A lập hồ sơ cho đơn vị B, quản lý đơn vị lập hồ sơ đều bị từ chối', async () => {
      const otherDepartment = await api('POST', '/departments', principal.accessToken, {
        org_unit_id: units['ĐT-B1'],
        name: 'Văn phòng B',
      });
      assert.equal((await createStaff(token('personnel'), { department_id: otherDepartment.body.id })).status, 400);
      assert.equal((await createStaff(token('personnel'), { org_unit_id: units['ĐT-B1'] })).status, 403);
      assert.equal((await createStaff(token('manager'), {})).status, 403);
    });

    it('P07-04: quản lý đơn vị và kế toán xem danh sách; giáo viên bị từ chối; lọc theo tên', async () => {
      const listed = await api('GET', `/staff?org_unit_id=${units['ĐT-A1']}&search=Mai`, token('manager'));
      assert.equal(listed.status, 200);
      assert.deepEqual(
        (listed.body as unknown as Array<{ id: string }>).map((row) => row.id),
        [staffIds.teacher],
      );
      assert.equal((await api('GET', '/staff', token('accountant'))).status, 200);
      assert.equal((await api('GET', '/staff', token('teacher'))).status, 403);
      assert.equal((await api('GET', `/staff?org_unit_id=${units['ĐT-B1']}`, token('manager'))).status, 403);
    });
  });

  describe('Liên kết tài khoản', () => {
    it('phòng nhân sự gắn tài khoản giáo viên theo tên đăng nhập; tài khoản chỉ là phụ huynh bị từ chối; một tài khoản không gắn hai hồ sơ', async () => {
      const linked = await api('POST', `/staff/${staffIds.teacher}/account`, token('personnel'), {
        login: await usernameOf(users.teacher?.userId ?? ''),
      });
      assert.equal(linked.status, 200, JSON.stringify(linked.body));
      assert.equal(linked.body.user_id, users.teacher?.userId);
      assert.equal(linked.body.has_account, true);
      const parentOnly = await api('POST', `/staff/${staffIds.other}/account`, token('personnel'), {
        login: await usernameOf(users.parent?.userId ?? ''),
      });
      assert.equal(parentOnly.status, 422);
      const twice = await api('POST', `/staff/${staffIds.other}/account`, token('personnel'), {
        login: await usernameOf(users.teacher?.userId ?? ''),
      });
      assert.equal(twice.status, 422);
      const unknown = await api('POST', `/staff/${staffIds.other}/account`, token('personnel'), {
        login: 'khong_co_tai_khoan_nay',
      });
      assert.equal(unknown.status, 404);
    });
  });

  describe('P07-02 Hợp đồng lao động', () => {
    it('hợp đồng có thời hạn thiếu ngày kết thúc bị chặn; lập được hợp đồng; trùng thời gian hoặc trùng số hợp đồng bị chặn', async () => {
      const missingEnd = await api('POST', `/staff/${staffIds.teacher}/contracts`, token('personnel'), {
        contract_no: randomCode('HDLD'),
        contract_type: 'fixed_term',
        start_date: '2026-08-01',
        base_salary: 12_000_000,
      });
      assert.equal(missingEnd.status, 400);
      const contractNo = randomCode('HDLD');
      const created = await api('POST', `/staff/${staffIds.teacher}/contracts`, token('personnel'), {
        contract_no: contractNo,
        contract_type: 'fixed_term',
        start_date: '2026-08-01',
        end_date: addDays(vietnamToday, 10),
        base_salary: 12_000_000,
        allowances: [{ name: 'Phụ cấp trách nhiệm', amount: 500_000 }],
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      assert.equal(created.body.base_salary, 12_000_000);
      contracts.teacher = created.body.id as string;
      const overlap = await api('POST', `/staff/${staffIds.teacher}/contracts`, token('personnel'), {
        contract_no: randomCode('HDLD'),
        contract_type: 'indefinite',
        start_date: vietnamToday,
        base_salary: 13_000_000,
      });
      assert.equal(overlap.status, 422);
      const sameNumber = await api('POST', `/staff/${staffIds.other}/contracts`, token('personnel'), {
        contract_no: contractNo,
        contract_type: 'indefinite',
        start_date: '2026-08-01',
        base_salary: 9_000_000,
      });
      assert.equal(sameNumber.status, 409);
    });

    it('BR-46: giáo viên xem hồ sơ và hợp đồng của chính mình, hồ sơ người khác bị từ chối; quản lý đơn vị không thấy hợp đồng, kế toán thấy', async () => {
      const own = await api('GET', '/staff/me', token('teacher'));
      assert.equal(own.status, 200, JSON.stringify(own.body));
      assert.equal((own.body.contracts as Array<{ base_salary: number }>)[0]?.base_salary, 12_000_000);
      assert.equal((await api('GET', `/staff/${staffIds.other}`, token('teacher'))).status, 403);
      assert.equal((await api('GET', `/staff/${staffIds.teacher}`, token('manager'))).body.contracts, null);
      const forAccountant = await api('GET', `/staff/${staffIds.teacher}`, token('accountant'));
      assert.equal((forAccountant.body.contracts as unknown[]).length, 1);
    });

    it('CTC-P08-059: hợp đồng còn 10 ngày và cấu hình cảnh báo 15 ngày thì phòng nhân sự thấy cảnh báo sắp hết hạn', async () => {
      const none = await api('GET', '/staff/expiring-contracts', token('personnel'));
      assert.equal((none.body as unknown as unknown[]).length, 0);
      const saved = await api('PUT', '/settings', principal.accessToken, {
        org_unit_id: units['ĐT-A1'],
        values: { contract_expiry_warning_days: 15 },
      });
      assert.equal(saved.status, 200, JSON.stringify(saved.body));
      const expiring = await api('GET', '/staff/expiring-contracts', token('personnel'));
      const rows = expiring.body as unknown as Array<{ id: string; full_name: string }>;
      assert.deepEqual(
        rows.map((row) => row.id),
        [contracts.teacher],
      );
      assert.equal((await api('GET', '/staff/expiring-contracts', token('teacher'))).status, 403);
    });

    it('CTC-P08-043: chấm dứt hợp đồng thì tài khoản bị khóa ngay, hồ sơ chuyển đã nghỉ, kế toán nhận thông báo lập bảng quyết toán', async () => {
      const withoutReason = await api(
        'POST',
        `/employment-contracts/${contracts.teacher}/terminate`,
        token('personnel'),
        {
          terminated_on: vietnamToday,
        },
      );
      assert.equal(withoutReason.status, 400);
      const terminated = await api('POST', `/employment-contracts/${contracts.teacher}/terminate`, token('personnel'), {
        terminated_on: vietnamToday,
        reason: 'Xin nghỉ việc',
      });
      assert.equal(terminated.status, 200, JSON.stringify(terminated.body));
      assert.equal(terminated.body.status, 'terminated');
      const account = await environment.identity.database
        .selectFrom('users')
        .select('status')
        .where('id', '=', users.teacher?.userId ?? '')
        .executeTakeFirstOrThrow();
      assert.equal(account.status, 'locked');
      const staff = await schoolYear
        .selectFrom('staff')
        .select(['status', 'end_date'])
        .where('id', '=', staffIds.teacher ?? '')
        .executeTakeFirstOrThrow();
      assert.equal(staff.status, 'terminated');
      assert.equal(staff.end_date, vietnamToday);
      const notice = await schoolYear
        .selectFrom('notifications')
        .innerJoin('notification_recipients', 'notification_recipients.notification_id', 'notifications.id')
        .select('notification_recipients.role_code')
        .where('notifications.template_code', '=', 'contract_terminated')
        .executeTakeFirstOrThrow();
      assert.equal(notice.role_code, 'VT-04');
      const again = await api('POST', `/employment-contracts/${contracts.teacher}/terminate`, token('personnel'), {
        terminated_on: vietnamToday,
        reason: 'Lần hai',
      });
      assert.equal(again.status, 422);
    });
  });

  describe('P01-13 Nhập nhân sự từ Excel', () => {
    async function upload(accessToken: string, rows: Array<Record<string, string>>) {
      const book = new ExcelJS.Workbook();
      const worksheet = book.addWorksheet('Nhân sự');
      worksheet.addRow(IMPORT_COLUMNS.staff.map((column) => column.header));
      for (const row of rows) {
        worksheet.addRow(IMPORT_COLUMNS.staff.map((column) => row[column.key] ?? ''));
      }
      const form = new FormData();
      form.set('type', 'staff');
      form.set('file', new Blob([Buffer.from(await book.xlsx.writeBuffer())]), 'nhan-su.xlsx');
      const response = await fetch(`${environment.baseUrl}/imports`, {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}` },
        body: form,
      });
      return {
        status: response.status,
        body: (await response.json()) as { id: string; status: string; errors: Array<{ row: number; column: string }> },
      };
    }

    it('CTC-P01-082: nhân sự tải tệp nhân sự được nhận và ghi; tệp có dòng lỗi thì báo đúng dòng; kế toán tải tệp nhân sự bị từ chối', async () => {
      const codes = [randomCode('NV'), randomCode('NV')];
      const failed = await upload(token('personnel'), [
        { unit_code: 'ĐT-A1', code: codes[0] ?? '', full_name: 'Phạm Văn An', start_date: '2026-09-01' },
        { unit_code: 'ĐT-A1', code: codes[0] ?? '', full_name: 'Trùng mã', start_date: '2026-09-01' },
        { unit_code: 'ĐT-B1', code: randomCode('NV'), full_name: 'Đơn vị khác', start_date: '2026-09-01' },
        {
          unit_code: 'ĐT-A1',
          code: randomCode('NV'),
          full_name: 'Sai phòng ban',
          department: 'Không có',
          start_date: '2026-09-01',
        },
      ]);
      assert.equal(failed.status, 201, JSON.stringify(failed.body));
      assert.equal(failed.body.status, 'failed');
      assert.deepEqual([...new Set(failed.body.errors.map((error) => error.row))].sort(), [3, 4, 5]);

      const valid = await upload(token('personnel'), [
        {
          unit_code: 'ĐT-A1',
          code: codes[0] ?? '',
          full_name: 'Phạm Văn An',
          gender: 'Nam',
          department: 'Tổ chuyên môn',
          job_title: 'Giáo viên',
          start_date: '01/09/2026',
        },
        { unit_code: 'ĐT-A1', code: codes[1] ?? '', full_name: 'Võ Thị Bình', start_date: '2026-09-01' },
      ]);
      assert.equal(valid.body.status, 'validated', JSON.stringify(valid.body));
      const commit = await api('POST', `/imports/${valid.body.id}/commit`, token('personnel'));
      assert.equal(commit.status, 200, JSON.stringify(commit.body));
      const imported = await schoolYear
        .selectFrom('staff')
        .select(['code', 'department_id', 'start_date'])
        .where('code', 'in', codes)
        .orderBy('code')
        .execute();
      assert.equal(imported.length, 2);
      assert.ok(imported.some((row) => row.department_id === departmentId && row.start_date === '2026-09-01'));
      assert.equal((await upload(token('accountant'), [])).status, 403);
    });
  });
});
