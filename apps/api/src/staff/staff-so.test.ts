import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import { STAFF_PROFILE_BLOCKS } from '@school-management/shared';
import ExcelJS from 'exceljs';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { EDITABLE_PROFILE_KINDS } from './staff-profile.js';

// Nhân sự theo hệ thống của Sở (DT-15 phần 15d, YCTD-112): lưới 3.1.1 có bộ lọc mở rộng của mục 3.1.4 và sắp xếp A–Z,
// cột hợp đồng theo quyền xem hợp đồng (BR-46), xuất Excel có nhật ký xuất, ghi hồ sơ theo biểu mẫu của Sở
const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const randomCode = (prefix: string) => `${prefix}-${randomInt(100_000, 999_999)}`;
let idCounter = randomInt(0, 1_000_000);
const nextIdNumber = () =>
  `079${String(Date.now() % 1_000_000).padStart(6, '0')}${String(++idCounter % 1000).padStart(3, '0')}`;
type Item = Record<string, unknown> & { id: string; full_name: string };

// Tuổi tròn tính đến hôm nay như máy chủ
function ageOf(dob: string, today: string): number {
  const [year, month, day] = dob.split('-').map(Number) as [number, number, number];
  const [nowYear, nowMonth, nowDay] = today.split('-').map(Number) as [number, number, number];
  return nowYear - year - (nowMonth < month || (nowMonth === month && nowDay < day) ? 1 : 0);
}

describe('Nhân sự theo hệ thống của Sở (YCTD-112)', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  const units: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const staff: Record<string, string> = {};
  const codes: Record<string, string> = {};
  const dobs: Record<string, string> = {};
  let departmentId = '';
  let jobTitleId = '';
  let idNumber = '';
  const today = VIETNAM_DATE.format(new Date());

  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);
  const items = (body: Record<string, unknown>) => body.items as Item[];
  const names = (body: Record<string, unknown>) => {
    assert.ok(Array.isArray(body.items), JSON.stringify(body));
    return items(body).map((item) => item.full_name);
  };
  const search = (query: string, accessToken = principal.accessToken) =>
    api('GET', `/staff/search?org_unit_id=${units.A}&page_size=50${query}`, accessToken);

  async function download(path: string, accessToken: string, body: unknown) {
    const response = await fetch(`${environment.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    if (response.status !== 200) {
      return { status: response.status, rows: [] as string[][], logId: null, body: JSON.parse(buffer.toString()) };
    }
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const rows: string[][] = [];
    workbook.worksheets[0]?.eachRow((row) => {
      rows.push(Array.from((row.values as unknown[]).slice(1), (value) => String(value ?? '')));
    });
    return { status: 200, rows, logId: response.headers.get('x-export-log-id'), body: null };
  }

  async function createStaff(
    key: string,
    unit: string,
    fullName: string,
    gender: 'male' | 'female',
    dob: string,
    extra: Record<string, unknown> = {},
    creator = 'personnel',
  ) {
    codes[key] = randomCode('NS');
    dobs[key] = dob;
    const created = await api('POST', '/staff', token(creator), {
      org_unit_id: units[unit],
      code: codes[key],
      full_name: fullName,
      gender,
      dob,
      start_date: '2020-08-01',
      ...extra,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    staff[key] = created.body.id as string;
  }

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
    for (const [key, code, type] of [
      ['TC', 'TC', 'truong_chinh'],
      ['A', 'ĐT-A', 'diem_truong'],
      ['B', 'ĐT-B', 'diem_truong'],
    ] as const) {
      const created = await api('POST', '/org-units', principal.accessToken, { code, name: code, unit_type: type });
      units[key] = created.body.id as string;
    }
    users.personnel = await environment.loginAs('VT-06', units.A ?? null);
    users.otherPersonnel = await environment.loginAs('VT-06', units.B ?? null);
    users.manager = await environment.loginAs('VT-03', units.A ?? null);
    users.teacher = await environment.loginAs('VT-07', units.A ?? null);
    departmentId = (
      await api('POST', '/departments', token('personnel'), { org_unit_id: units.A, name: 'Tổ chuyên môn' })
    ).body.id as string;
    jobTitleId = (await api('POST', '/job-titles', token('personnel'), { org_unit_id: units.A, name: 'Bảo mẫu' })).body
      .id as string;
    idNumber = nextIdNumber();
    // Tên khác nhau ở từ cuối để kiểm tra sắp xếp theo tên rồi theo họ
    await createStaff('An', 'A', 'Trần Thị An', 'female', '1990-05-01', { id_number: idNumber, phone: '0912000111' });
    await createStaff('An2', 'A', 'Bùi Văn An', 'male', '1980-01-01', { department_id: departmentId });
    await createStaff('Anh', 'A', 'Nguyễn Minh Ánh', 'female', '1995-03-02');
    await createStaff('Bao', 'A', 'Lê Gia Bảo', 'male', '1975-11-20', { job_title_id: jobTitleId });
    await createStaff('Dung', 'B', 'Phạm Đức Dũng', 'male', '1985-07-07', {}, 'otherPersonnel');
    // Cột CSDL ngành của một nhân sự (YCTD-100)
    await schoolYear
      .updateTable('staff')
      .set({
        moet_staff_code: `BO-${randomInt(100_000, 999_999)}`,
        moet_profile: JSON.stringify({
          ethnicity: 'Tày',
          job_position: 'Giáo viên mẫu giáo',
          position_group: 'Giáo viên',
          contract_form: 'Viên chức HĐLV không xác định thời hạn',
          professional_qualification: 'Đại học',
          party_member: true,
        }),
      })
      .where('id', '=', staff.Anh ?? '')
      .execute();
    const contract = await api('POST', `/staff/${staff.Bao}/contracts`, token('personnel'), {
      contract_no: randomCode('HD'),
      contract_type: 'fixed_term',
      start_date: '2026-08-01',
      end_date: '2027-07-31',
      base_salary: 9_000_000,
      allowances: [],
    });
    assert.equal(contract.status, 201, JSON.stringify(contract.body));
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  describe('Danh sách và bộ lọc mở rộng (3.1.1, 3.1.4)', () => {
    it('CT-15d-1: sắp xếp A–Z theo tên rồi theo họ; cột của Sở lấy từ CSDL ngành, vị trí việc làm trống thì lấy chức danh', async () => {
      const response = await search('');
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.deepEqual(names(response.body), ['Bùi Văn An', 'Trần Thị An', 'Nguyễn Minh Ánh', 'Lê Gia Bảo']);
      assert.equal(response.body.total, 4);
      const anh = items(response.body).find((item) => item.id === staff.Anh);
      assert.equal(anh?.ethnicity, 'Tày');
      assert.equal(anh?.job_position, 'Giáo viên mẫu giáo');
      assert.equal(anh?.position_group, 'Giáo viên');
      assert.equal(anh?.contract_form, 'Viên chức HĐLV không xác định thời hạn');
      assert.equal(anh?.professional_qualification, 'Đại học');
      assert.equal(anh?.party_member, true);
      assert.match(String(anh?.moet_staff_code), /^BO-/);
      const bao = items(response.body).find((item) => item.id === staff.Bao);
      assert.equal(bao?.job_position, 'Bảo mẫu');
      assert.equal(bao?.contract_form, 'Có thời hạn');
      const an = items(response.body).find((item) => item.id === staff.An);
      assert.equal(an?.id_number_masked, `********${idNumber.slice(-4)}`);
      assert.ok(!JSON.stringify(response.body).includes(idNumber));
      // Hiệu trưởng toàn trường thấy cả đơn vị B khi không chọn đơn vị
      const all = await api('GET', '/staff/search?page_size=200&q=Phạm Đức', principal.accessToken);
      assert.deepEqual(names(all.body), ['Phạm Đức Dũng']);
    });

    it('CT-15d-2: lọc theo giới tính, trạng thái, mã định danh Bộ, số định danh, Đảng viên, tuổi, vị trí việc làm, phòng ban', async () => {
      assert.deepEqual(names((await search('&gender=female')).body), ['Trần Thị An', 'Nguyễn Minh Ánh']);
      assert.deepEqual(names((await search('&status=terminated')).body), []);
      assert.deepEqual(names((await search('&moet_staff_code=BO-')).body), ['Nguyễn Minh Ánh']);
      assert.deepEqual(names((await search(`&id_number=${idNumber}`)).body), ['Trần Thị An']);
      const otherId = `${idNumber.slice(0, 8)}${idNumber.slice(-4)}`;
      if (otherId !== idNumber) {
        assert.deepEqual(names((await search(`&id_number=${otherId}`)).body), []);
      }
      assert.deepEqual(names((await search('&party_member=true')).body), ['Nguyễn Minh Ánh']);
      assert.equal(items((await search('&party_member=false')).body).length, 3);
      const expected = ['An2', 'An', 'Anh', 'Bao']
        .filter((key) => {
          const age = ageOf(dobs[key] ?? '', today);
          return age >= 40 && age <= 60;
        })
        .map((key) => staff[key]);
      assert.deepEqual(
        items((await search('&age_from=40&age_to=60')).body).map((item) => item.id),
        expected,
      );
      assert.deepEqual(names((await search('&job_position=bảo mẫu')).body), ['Lê Gia Bảo']);
      assert.deepEqual(names((await search(`&department_id=${departmentId}`)).body), ['Bùi Văn An']);
      assert.deepEqual(names((await search(`&q=${codes.Anh}`)).body), ['Nguyễn Minh Ánh']);
    });

    it('CT-15d-3: bộ lọc sai trả lỗi dữ liệu; giáo viên và đơn vị ngoài phạm vi bị từ chối', async () => {
      const invalid = await api(
        'GET',
        '/staff/search?gender=x&id_number=123&age_from=50&age_to=40&party_member=co&page_size=300',
        principal.accessToken,
      );
      assert.equal(invalid.status, 400);
      const fields = ((invalid.body.error as { details: Array<{ field: string }> }).details ?? []).map(
        (detail) => detail.field,
      );
      for (const field of ['gender', 'id_number', 'age_to', 'party_member', 'page_size']) {
        assert.ok(fields.includes(field), field);
      }
      assert.equal((await api('GET', '/staff/search', token('teacher'))).status, 403);
      assert.equal((await api('GET', `/staff/search?org_unit_id=${units.B}`, token('personnel'))).status, 403);
      const own = await api('GET', '/staff/search?page_size=200', token('personnel'));
      assert.ok(!names(own.body).includes('Phạm Đức Dũng'));
    });

    it('CT-15d-4: cột hợp đồng, lương chỉ người xem được hợp đồng thấy (BR-46)', async () => {
      const personnel = await search('&q=Gia Bảo', token('personnel'));
      assert.equal(personnel.body.contract_fields_visible, true);
      const row = items(personnel.body)[0];
      assert.equal(row?.base_salary, 9_000_000);
      assert.equal(row?.contract_type, 'fixed_term');
      assert.equal(row?.contract_end_date, '2027-07-31');
      const manager = await search('&q=Gia Bảo', token('manager'));
      assert.equal(manager.status, 200, JSON.stringify(manager.body));
      assert.equal(manager.body.contract_fields_visible, false);
      const hidden = items(manager.body)[0];
      assert.equal(hidden?.base_salary, null);
      assert.equal(hidden?.contract_no, null);
      assert.equal(hidden?.contract_form, null);
    });
  });

  describe('Xuất Excel', () => {
    it('CT-15d-5: Hiệu trưởng xuất đúng cột đang hiện theo thứ tự và bộ lọc; ghi nhật ký xuất có dữ liệu cá nhân', async () => {
      const file = await download('/staff/export', principal.accessToken, {
        org_unit_id: units.A,
        gender: 'male',
        columns: ['full_name', 'job_position', 'base_salary', 'dob'],
      });
      assert.equal(file.status, 200, JSON.stringify(file.body));
      assert.deepEqual(file.rows, [
        ['STT', 'Họ tên', 'Vị trí việc làm', 'Lương thỏa thuận', 'Ngày sinh'],
        ['1', 'Bùi Văn An', '', '', '01/01/1980'],
        ['2', 'Lê Gia Bảo', 'Bảo mẫu', '9000000', '20/11/1975'],
      ]);
      const log = await schoolYear
        .selectFrom('export_logs')
        .selectAll()
        .where('id', '=', file.logId ?? '')
        .executeTakeFirstOrThrow();
      assert.equal(log.report_code, 'staff');
      assert.equal(log.row_count, 2);
      assert.equal(log.contains_personal_data, true);
      assert.deepEqual(log.org_unit_ids, [units.A]);
    });

    it('CT-15d-6: không có quyền xuất bị từ chối; cột lạ, cột trùng lỗi dữ liệu; không gửi cột thì xuất cột mặc định', async () => {
      assert.equal((await download('/staff/export', token('manager'), {})).status, 403);
      assert.equal(
        (await download('/staff/export', principal.accessToken, { columns: ['full_name', 'x'] })).status,
        400,
      );
      assert.equal((await download('/staff/export', principal.accessToken, { columns: ['dob', 'dob'] })).status, 400);
      const defaults = await download('/staff/export', principal.accessToken, {
        org_unit_id: units.A,
        id_number: idNumber,
      });
      assert.deepEqual(defaults.rows[0], [
        'STT',
        'Mã định danh Bộ GD&ĐT',
        'Mã nhân sự',
        'Họ tên',
        'Ngày sinh',
        'Giới tính',
        'Trạng thái',
        'Dân tộc',
        'Điện thoại',
        'Vị trí việc làm',
        'Nhóm chức vụ',
        'Hình thức hợp đồng',
        'Trình độ chuyên môn',
      ]);
      assert.deepEqual(defaults.rows.slice(1), [
        ['1', '', codes.An ?? '', 'Trần Thị An', '01/05/1990', 'Nữ', 'Đang làm việc', '', '0912000111', '', '', '', ''],
      ]);
      const log = await schoolYear
        .selectFrom('export_logs')
        .select('filters_data')
        .where('id', '=', defaults.logId ?? '')
        .executeTakeFirstOrThrow();
      assert.ok(!JSON.stringify(log.filters_data).includes(idNumber));
    });
  });

  describe('Hồ sơ theo biểu mẫu của Sở', () => {
    it('CT-15d-7: phòng nhân sự ghi ô của Sở, ô có cột riêng và thông tin riêng của trường; lưới và nhật ký thao tác đổi theo', async () => {
      const saved = await api('PATCH', `/staff/${staff.An}/profile`, token('personnel'), {
        moet_staff_code: 'BO-TEST-AN',
        phone: '0912000222',
        department_id: departmentId,
        moet_profile: {
          ethnicity: 'Kinh',
          party_member: true,
          party_official_date: '2015-02-03',
          job_position: 'Giáo viên nhà trẻ',
          permanent_province: 'Thành phố Hồ Chí Minh',
          social_insurance_number: '7912345678',
        },
      });
      assert.equal(saved.status, 200, JSON.stringify(saved.body));
      assert.equal(saved.body.moet_staff_code, 'BO-TEST-AN');
      assert.equal(saved.body.phone, '0912000222');
      assert.equal(saved.body.department_name, 'Tổ chuyên môn');
      const fields = saved.body.moet_fields as Record<string, unknown>;
      assert.equal(fields.ethnicity, 'Kinh');
      assert.equal(fields.party_member, true);
      assert.equal(fields.party_official_date, '2015-02-03');
      assert.equal(fields.permanent_province, 'Thành phố Hồ Chí Minh');
      assert.equal(fields.social_insurance_number, '********5678');
      assert.ok(!JSON.stringify(saved.body).includes('7912345678'));
      // Bỏ Đảng viên và xóa ô dân tộc
      const cleared = await api('PATCH', `/staff/${staff.An}/profile`, token('personnel'), {
        moet_profile: { party_member: false, ethnicity: null },
      });
      assert.equal(cleared.status, 200, JSON.stringify(cleared.body));
      const clearedFields = cleared.body.moet_fields as Record<string, unknown>;
      assert.equal(clearedFields.party_member, undefined);
      assert.equal(clearedFields.ethnicity, undefined);
      assert.equal(clearedFields.job_position, 'Giáo viên nhà trẻ');
      const listed = items((await search('&job_position=nhà trẻ')).body);
      assert.deepEqual(
        listed.map((item) => item.full_name),
        ['Trần Thị An'],
      );
      const audit = await schoolYear
        .selectFrom('audit_logs')
        .select(['before_data', 'after_data'])
        .where('entity_id', '=', staff.An ?? '')
        .where('entity_name', '=', 'staff')
        .where('action', '=', 'update')
        .orderBy('created_at', 'asc')
        .execute();
      const first = audit[0]?.after_data as Record<string, unknown>;
      assert.equal(first['moet_profile.ethnicity'], 'Kinh');
      assert.equal(first.phone, '0912000222');
      assert.ok(!JSON.stringify(audit).includes('7912345678'));
    });

    it('CT-15d-8: ô lạ, ngày sai, giá trị sai, không đổi gì trả lỗi dữ liệu; trùng mã định danh Bộ 409; quản lý, giáo viên bị từ chối', async () => {
      const invalid = await api('PATCH', `/staff/${staff.Bao}/profile`, token('personnel'), {
        full_name: '',
        gender: 'x',
        moet_profile: { salary: '1', party_official_date: '31/12/2020', party_member: 'có', ethnicity: 5 },
      });
      assert.equal(invalid.status, 400);
      const fields = ((invalid.body.error as { details: Array<{ field: string }> }).details ?? []).map(
        (detail) => detail.field,
      );
      for (const field of [
        'full_name',
        'gender',
        'moet_profile.salary',
        'moet_profile.party_official_date',
        'moet_profile.party_member',
        'moet_profile.ethnicity',
      ]) {
        assert.ok(fields.includes(field), field);
      }
      assert.equal((await api('PATCH', `/staff/${staff.Bao}/profile`, token('personnel'), {})).status, 400);
      const duplicate = await api('PATCH', `/staff/${staff.Bao}/profile`, token('personnel'), {
        moet_staff_code: 'BO-TEST-AN',
      });
      assert.equal(duplicate.status, 409, JSON.stringify(duplicate.body));
      const otherDepartment = await api('PATCH', `/staff/${staff.Bao}/profile`, token('personnel'), {
        department_id: '00000000-0000-4000-8000-000000000000',
      });
      assert.equal(otherDepartment.status, 400);
      for (const name of ['manager', 'teacher', 'otherPersonnel']) {
        const denied = await api('PATCH', `/staff/${staff.Bao}/profile`, token(name), { phone: '0912000333' });
        assert.equal(denied.status, 403, name);
      }
    });

    it('CT-15d-9: biểu mẫu có đủ mọi ô của tệp CSDL ngành, đúng kiểu, không trùng, theo đúng khóa máy chủ nhận', () => {
      const fields = STAFF_PROFILE_BLOCKS.flatMap((block) => block.fields);
      const keys = fields.map((field) => field.key);
      assert.equal(new Set(keys).size, keys.length);
      const profileFields = fields.filter((field) => !field.core);
      assert.deepEqual(profileFields.map((field) => field.key).sort(), [...EDITABLE_PROFILE_KINDS.keys()].sort());
      for (const field of profileFields) {
        assert.equal(field.kind, EDITABLE_PROFILE_KINDS.get(field.key), field.key);
      }
    });
  });
});
