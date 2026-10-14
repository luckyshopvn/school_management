import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import ExcelJS from 'exceljs';
import type { Kysely } from 'kysely';
import { pickSmsRecipients, smsGuardianUserIds } from '../finance/receivables.js';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';

// Học sinh theo hệ thống của Sở (DT-15 phần 15c, YCTD-108): danh sách có bộ lọc mở rộng và sắp xếp A–Z, xuất Excel, cập
// nhật hàng loạt học 2 buổi/ngày và bán trú, điện thoại nhận tin, biến động học sinh
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const randomPhone = () => `09${randomInt(0, 100_000_000).toString().padStart(8, '0')}`;
let nationalIdCounter = randomInt(0, 1_000_000);
const nextNationalId = () =>
  `079${String(Date.now() % 1_000_000).padStart(6, '0')}${String(++nationalIdCounter % 1000).padStart(3, '0')}`;
const errorOf = (body: Record<string, unknown>) =>
  (body.error ?? {}) as { code?: string; rule_code?: string; details?: Array<{ field: string; message: string }> };
type Item = Record<string, unknown> & { id: string; full_name: string };

describe('Học sinh theo hệ thống của Sở (YCTD-108)', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  const units: Record<string, string> = {};
  const classes: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const children: Record<string, string> = {};
  const nationalIds: Record<string, string> = {};
  let savedDefaultPassword: Array<{ key: string; value: unknown; updated_by: string | null }> = [];
  let mother = '';
  let father = '';
  const today = VIETNAM_DATE.format(new Date());

  const api = (method: string, path: string, token: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, token, body);
  const items = (body: Record<string, unknown>) => body.items as Item[];

  async function download(path: string, token: string, body: unknown) {
    const response = await fetch(`${environment.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
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

  // Lập, gửi trình duyệt và duyệt vào lớp; phụ huynh đầu là mẹ có số điện thoại (liên hệ chính), sau là bố
  async function enrol(key: string, fullName: string, gender: 'male' | 'female', classCode: string, approve = true) {
    const form = new FormData();
    form.set('org_unit_id', units.A ?? '');
    form.set('purpose', 'birth_certificate');
    form.set('file', new Blob([PNG]), 'giay-khai-sinh.png');
    const file = (await (
      await fetch(`${environment.baseUrl}/files`, {
        method: 'POST',
        headers: { authorization: `Bearer ${principal.accessToken}` },
        body: form,
      })
    ).json()) as { id: string };
    nationalIds[key] = nextNationalId();
    const created = await api('POST', '/children', principal.accessToken, {
      org_unit_id: units.A,
      full_name: fullName,
      dob: '2022-04-18',
      gender,
      national_id: nationalIds[key],
      birth_certificate_file_id: file.id,
      photo_consent: 'pending',
      health: { has_allergies: false },
      guardians: [
        { full_name: `Mẹ của ${fullName}`, phone: randomPhone(), relationship_item_id: mother, is_primary: true },
        { full_name: `Bố của ${fullName}`, phone: null, relationship_item_id: father },
      ],
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    children[key] = created.body.id as string;
    if (!approve) {
      return;
    }
    const submitted = await api('POST', `/children/${children[key]}/submit`, principal.accessToken);
    assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
    const approved = await api('POST', `/children/${children[key]}/approve`, principal.accessToken, {
      class_id: classes[classCode],
      confirm_over_capacity: true,
    });
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
  }

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    // Duyệt hồ sơ tạo tài khoản phụ huynh bằng mật khẩu mặc định; giữ lại giá trị cũ để trả về sau khi chạy
    savedDefaultPassword = await environment.identity.database
      .selectFrom('identity_settings')
      .select(['key', 'value', 'updated_by'])
      .where('key', '=', 'parent_default_password_hash')
      .execute();
    const saved = await sendJson('PUT', `${environment.identity.baseUrl}/auth/settings`, principal.accessToken, {
      parent_default_password: 'PhuHuynh2026',
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const yearId = await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
      first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
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
    for (const [key, code, type] of [
      ['TC', 'TC', 'truong_chinh'],
      ['A', 'ĐT-A', 'diem_truong'],
      ['B', 'ĐT-B', 'diem_truong'],
    ] as const) {
      const created = await api('POST', '/org-units', principal.accessToken, { code, name: code, unit_type: type });
      units[key] = created.body.id as string;
    }
    for (const [code, name, from, to] of [
      ['MAM', 'Mầm', 36, 47],
      ['CHOI', 'Chồi', 48, 59],
    ] as const) {
      await api('POST', '/grade-levels', principal.accessToken, {
        code,
        name,
        age_from_months: from,
        age_to_months: to,
      });
    }
    for (const [code, unit, grade] of [
      ['M1', 'A', 'MAM'],
      ['M2', 'A', 'MAM'],
      ['C1', 'A', 'CHOI'],
      ['B1', 'B', 'MAM'],
    ] as const) {
      const created = await api('POST', '/classes', principal.accessToken, {
        org_unit_id: units[unit],
        code,
        name: `Lớp ${code}`,
        grade_level: grade,
        max_size: 30,
      });
      classes[code] = created.body.id as string;
    }
    for (const [code, name] of [
      ['ME', 'Mẹ'],
      ['BO', 'Bố'],
    ] as const) {
      const created = await api('POST', '/catalog-items', principal.accessToken, {
        catalog_type: 'parent_relationship',
        code,
        name,
      });
      if (code === 'ME') {
        mother = created.body.id as string;
      } else {
        father = created.body.id as string;
      }
    }
    users.admissions = await environment.loginAs('VT-12', units.A ?? null);
    users.teacher = await environment.loginAs('VT-07', units.A ?? null);
    // Tên khác nhau ở từ cuối để kiểm tra sắp xếp theo tên rồi theo họ
    await enrol('An', 'Trần Thị An', 'female', 'M1');
    await enrol('Bao', 'Lê Gia Bảo', 'male', 'M1');
    await enrol('Anh', 'Nguyễn Minh Ánh', 'female', 'C1');
    await enrol('An2', 'Bùi Văn An', 'male', 'M2');
    await enrol('Draft', 'Phạm Đức Dũng', 'male', 'M1', false);
    // Cột CSDL ngành của một học sinh (YCTD-100)
    await schoolYear
      .updateTable('children')
      .set({
        moet_profile: JSON.stringify({ ethnicity: 'Tày', policy_target: 'Con hộ nghèo', can_swim: true }),
      })
      .where('id', '=', children.Anh ?? '')
      .execute();
  });

  after(async () => {
    const identityDatabase = environment.identity.database;
    await identityDatabase.deleteFrom('identity_settings').where('key', '=', 'parent_default_password_hash').execute();
    for (const row of savedDefaultPassword) {
      await identityDatabase
        .insertInto('identity_settings')
        .values({ key: row.key, value: JSON.stringify(row.value), updated_by: row.updated_by })
        .execute();
    }
    await schoolYear.destroy();
    await environment.close();
  });

  describe('Danh sách và bộ lọc mở rộng (4.1.1, 4.1.4)', () => {
    it('CT-15c-1: sắp xếp A–Z theo tên rồi theo họ, thứ tự chữ cái tiếng Việt; trả khối, lớp, số điện thoại liên hệ', async () => {
      const response = await api('GET', `/children?org_unit_id=${units.A}&page_size=50`, principal.accessToken);
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.deepEqual(
        items(response.body).map((item) => item.full_name),
        ['Bùi Văn An', 'Trần Thị An', 'Nguyễn Minh Ánh', 'Lê Gia Bảo', 'Phạm Đức Dũng'],
      );
      const anh = items(response.body).find((item) => item.id === children.Anh);
      assert.equal(anh?.grade_name, 'Chồi');
      assert.equal(anh?.class_name, 'Lớp C1');
      assert.match(String(anh?.contact_phone), /^09\d{8}$/);
      assert.equal(anh?.sms_phone, null);
      assert.equal(anh?.ethnicity, 'Tày');
      assert.equal(anh?.two_sessions_per_day, false);
    });

    it('CT-15c-2: lọc theo khối, giới tính, dân tộc, diện chính sách, biết bơi, số định danh; cỡ trang 200', async () => {
      const names = async (query: string) => {
        const response = await api(
          'GET',
          `/children?org_unit_id=${units.A}&page_size=200&${query}`,
          principal.accessToken,
        );
        assert.equal(response.status, 200, JSON.stringify(response.body));
        return items(response.body).map((item) => item.full_name);
      };
      assert.deepEqual(await names('grade_level=CHOI'), ['Nguyễn Minh Ánh']);
      assert.deepEqual(await names('gender=female'), ['Trần Thị An', 'Nguyễn Minh Ánh']);
      assert.deepEqual(await names('ethnicity=t%C3%A0y'), ['Nguyễn Minh Ánh']);
      assert.deepEqual(await names('policy=true'), ['Nguyễn Minh Ánh']);
      assert.equal((await names('policy=false')).length, 4);
      assert.deepEqual(await names('can_swim=true'), ['Nguyễn Minh Ánh']);
      assert.deepEqual(await names(`national_id=${nationalIds.Bao}`), ['Lê Gia Bảo']);
      assert.deepEqual(await names(`class_id=${classes.M1}&status=active`), ['Trần Thị An', 'Lê Gia Bảo']);
    });

    it('CT-15c-3: bộ lọc sai trả lỗi dữ liệu; vai trò không xem sức khỏe lọc theo dân tộc bị từ chối, không thấy dân tộc', async () => {
      const invalid = await api(
        'GET',
        '/children?gender=x&policy=co&national_id=123&page_size=300',
        principal.accessToken,
      );
      assert.equal(invalid.status, 400);
      assert.deepEqual((errorOf(invalid.body).details ?? []).map((detail) => detail.field).sort(), [
        'gender',
        'national_id',
        'page_size',
        'policy',
      ]);
      const forbidden = await api('GET', '/children?ethnicity=T%C3%A0y', users.admissions?.accessToken ?? '');
      assert.equal(forbidden.status, 403);
      const visible = await api('GET', `/children?org_unit_id=${units.A}`, users.admissions?.accessToken ?? '');
      assert.equal(visible.status, 200);
      const anh = items(visible.body).find((item) => item.id === children.Anh);
      assert.equal(anh?.ethnicity, null);
      assert.equal(anh?.policy_target, null);
    });
  });

  describe('Học 2 buổi/ngày, bán trú (4.1.12)', () => {
    it('CT-15c-4: Hiệu trưởng cập nhật hàng loạt hai học sinh; lọc theo học 2 buổi, bán trú; sửa từng hồ sơ', async () => {
      const response = await api('POST', '/children/bulk-update', principal.accessToken, {
        child_ids: [children.An, children.Bao],
        two_sessions_per_day: true,
        boarding: true,
      });
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal(response.body.updated, 2);
      const twoSessions = await api('GET', '/children?two_sessions_per_day=true&boarding=true', principal.accessToken);
      assert.deepEqual(
        items(twoSessions.body).map((item) => item.full_name),
        ['Trần Thị An', 'Lê Gia Bảo'],
      );
      const patched = await api('PATCH', `/children/${children.Bao}`, principal.accessToken, { boarding: false });
      assert.equal(patched.status, 200, JSON.stringify(patched.body));
      assert.equal(patched.body.boarding, false);
      assert.equal(patched.body.two_sessions_per_day, true);
      const audit = await schoolYear
        .selectFrom('audit_logs')
        .select('after_data')
        .where('entity_id', '=', children.An ?? '')
        .where('entity_name', '=', 'children')
        .orderBy('created_at', 'desc')
        .executeTakeFirstOrThrow();
      assert.equal((audit.after_data as Record<string, unknown>).bulk_update, true);
    });

    it('CT-15c-5: hồ sơ chờ duyệt, danh sách rỗng, không chọn thông tin, giáo viên: bị từ chối, không học sinh nào đổi', async () => {
      const submitted = await api('POST', `/children/${children.Draft}/submit`, principal.accessToken);
      assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
      const pending = await api('POST', '/children/bulk-update', principal.accessToken, {
        child_ids: [children.Anh, children.Draft],
        boarding: true,
      });
      assert.equal(pending.status, 422);
      assert.equal(errorOf(pending.body).rule_code, 'YCTD-108');
      assert.deepEqual(
        errorOf(pending.body).details?.map((detail) => detail.message),
        ['Phạm Đức Dũng'],
      );
      const anh = await api('GET', `/children/${children.Anh}`, principal.accessToken);
      assert.equal(anh.body.boarding, false);
      const empty = await api('POST', '/children/bulk-update', principal.accessToken, { child_ids: [], boarding: 'x' });
      assert.equal(empty.status, 400);
      assert.deepEqual(
        errorOf(empty.body)
          .details?.map((detail) => detail.field)
          .sort(),
        ['boarding', 'child_ids'],
      );
      const nothing = await api('POST', '/children/bulk-update', principal.accessToken, { child_ids: [children.Anh] });
      assert.equal(nothing.status, 400);
      const teacher = await api('POST', '/children/bulk-update', users.teacher?.accessToken ?? '', {
        child_ids: [children.Anh],
        boarding: true,
      });
      assert.equal(teacher.status, 403);
    });
  });

  describe('Điện thoại nhận tin (4.1.5)', () => {
    it('CT-15c-6: chọn mẹ làm điện thoại nhận tin; hiện ở hồ sơ và danh sách; chọn lại bố không có số bị từ chối; bỏ chọn', async () => {
      const detail = await api('GET', `/children/${children.Anh}`, principal.accessToken);
      const guardians = detail.body.guardians as Array<{ id: string; full_name: string; phone: string | null }>;
      const motherRow = guardians.find((guardian) => guardian.phone !== null);
      const fatherRow = guardians.find((guardian) => guardian.phone === null);
      const chosen = await api('PUT', `/children/${children.Anh}/sms-guardian`, principal.accessToken, {
        guardian_id: motherRow?.id,
      });
      assert.equal(chosen.status, 200, JSON.stringify(chosen.body));
      assert.equal(chosen.body.sms_phone, motherRow?.phone);
      assert.equal(
        (chosen.body.guardians as Array<{ id: string; receives_sms: boolean }>).find((row) => row.receives_sms)?.id,
        motherRow?.id,
      );
      const list = await api('GET', `/children?q=${encodeURIComponent('Minh Ánh')}`, principal.accessToken);
      assert.equal(items(list.body)[0]?.sms_phone, motherRow?.phone);
      const noPhone = await api('PUT', `/children/${children.Anh}/sms-guardian`, principal.accessToken, {
        guardian_id: fatherRow?.id,
      });
      assert.equal(noPhone.status, 422);
      assert.equal(errorOf(noPhone.body).rule_code, 'YCTD-108');
      const otherChild = await api('GET', `/children/${children.Bao}`, principal.accessToken);
      const stranger = (otherChild.body.guardians as Array<{ id: string }>)[0]?.id;
      assert.equal(
        (await api('PUT', `/children/${children.Anh}/sms-guardian`, principal.accessToken, { guardian_id: stranger }))
          .status,
        404,
      );
      assert.equal(
        (
          await api('PUT', `/children/${children.Anh}/sms-guardian`, users.teacher?.accessToken ?? '', {
            guardian_id: null,
          })
        ).status,
        403,
      );
      assert.equal((await api('PUT', `/children/${children.Anh}/sms-guardian`, principal.accessToken, {})).status, 400);
      const cleared = await api('PUT', `/children/${children.Anh}/sms-guardian`, principal.accessToken, {
        guardian_id: null,
      });
      assert.equal(cleared.status, 200);
      assert.equal(cleared.body.sms_phone, null);
    });

    it('CT-15c-7: tin nhắn gửi phụ huynh được chọn khi có tài khoản; chưa chọn thì gửi mọi phụ huynh có tài khoản', async () => {
      assert.deepEqual(
        pickSmsRecipients([
          { user_id: 'u-me', receives_sms: false },
          { user_id: 'u-bo', receives_sms: true },
          { user_id: null, receives_sms: false },
        ]),
        ['u-bo'],
      );
      assert.deepEqual(
        pickSmsRecipients([
          { user_id: 'u-me', receives_sms: false },
          { user_id: null, receives_sms: true },
        ]),
        ['u-me'],
      );
      const detail = await api('GET', `/children/${children.An}`, principal.accessToken);
      const motherRow = (detail.body.guardians as Array<{ id: string; phone: string | null }>).find(
        (guardian) => guardian.phone !== null,
      );
      const before = await smsGuardianUserIds(schoolYear, children.An ?? '');
      assert.equal(before.length, 1, 'mẹ có tài khoản sau khi duyệt, bố không có số nên không có tài khoản');
      await api('PUT', `/children/${children.An}/sms-guardian`, principal.accessToken, { guardian_id: motherRow?.id });
      assert.deepEqual(await smsGuardianUserIds(schoolYear, children.An ?? ''), before);
    });
  });

  describe('Xuất Excel (4.1.1)', () => {
    it('CT-15c-8: Hiệu trưởng xuất đúng cột đang hiện theo thứ tự và bộ lọc; ghi nhật ký xuất có dữ liệu cá nhân', async () => {
      const file = await download('/children/export', principal.accessToken, {
        org_unit_id: units.A,
        grade_level: 'MAM',
        columns: ['full_name', 'class', 'two_sessions_per_day', 'gender'],
      });
      assert.equal(file.status, 200, JSON.stringify(file.body));
      assert.deepEqual(file.rows, [
        ['STT', 'Họ tên', 'Lớp', 'Học 2 buổi/ngày', 'Giới tính'],
        ['1', 'Bùi Văn An', 'Lớp M2', '', 'Nam'],
        ['2', 'Trần Thị An', 'Lớp M1', 'Có', 'Nữ'],
        ['3', 'Lê Gia Bảo', 'Lớp M1', 'Có', 'Nam'],
      ]);
      const log = await schoolYear
        .selectFrom('export_logs')
        .selectAll()
        .where('id', '=', file.logId ?? '')
        .executeTakeFirstOrThrow();
      assert.equal(log.report_code, 'children');
      assert.equal(log.row_count, 3);
      assert.equal(log.contains_personal_data, true);
      assert.deepEqual(log.org_unit_ids, [units.A]);
    });

    it('CT-15c-9: không có quyền xuất dữ liệu bị từ chối; cột lạ, cột trùng trả lỗi dữ liệu', async () => {
      const forbidden = await download('/children/export', users.admissions?.accessToken ?? '', {});
      assert.equal(forbidden.status, 403);
      const invalid = await download('/children/export', principal.accessToken, { columns: ['full_name', 'salary'] });
      assert.equal(invalid.status, 400);
      const duplicate = await download('/children/export', principal.accessToken, { columns: ['dob', 'dob'] });
      assert.equal(duplicate.status, 400);
      const defaults = await download('/children/export', principal.accessToken, { q: 'Minh Ánh' });
      assert.deepEqual(defaults.rows[0], [
        'STT',
        'Mã định danh Bộ GD&ĐT',
        'Họ tên',
        'Ngày sinh',
        'Giới tính',
        'Dân tộc',
        'Trạng thái',
        'Số điện thoại liên hệ',
        'Khối',
        'Lớp',
      ]);
      assert.deepEqual(defaults.rows[1]?.slice(2, 7), ['Nguyễn Minh Ánh', '18/04/2022', 'Nữ', 'Tày', 'Đang học']);
    });
  });

  describe('Biến động học sinh (4.2)', () => {
    it('CT-15c-10: nhập học, chuyển lớp, chuyển đơn vị, thôi học hiện theo khoảng ngày và loại', async () => {
      const moved = await api('POST', `/children/${children.Bao}/transfer-class`, principal.accessToken, {
        class_id: classes.M2,
        reason: 'Cân đối sĩ số',
      });
      assert.equal(moved.status, 200, JSON.stringify(moved.body));
      const unit = await api('POST', `/children/${children.An2}/transfer-unit`, principal.accessToken, {
        class_id: classes.B1,
        reason: 'Gần nhà',
      });
      assert.equal(unit.status, 200, JSON.stringify(unit.body));
      const withdrawn = await api('POST', `/children/${children.Anh}/withdraw`, principal.accessToken, {
        reason: 'Chuyển trường',
      });
      assert.equal(withdrawn.status, 200, JSON.stringify(withdrawn.body));

      const response = await api(
        'GET',
        `/student-movements?from=${today}&to=${today}&page_size=50`,
        principal.accessToken,
      );
      assert.equal(response.status, 200, JSON.stringify(response.body));
      const rows = items(response.body) as Array<Item & { kind: string; from_name: string; to_name: string }>;
      assert.deepEqual(response.body.counts, { enrolled: 4, class_transfer: 1, unit_transfer: 1, withdrawn: 1 });
      const transfer = rows.find((row) => row.kind === 'class_transfer');
      assert.equal(transfer?.full_name, 'Lê Gia Bảo');
      assert.equal(transfer?.from_name, 'Lớp M1');
      assert.equal(transfer?.to_name, 'Lớp M2');
      assert.equal(transfer?.reason, 'Cân đối sĩ số');
      const unitRow = rows.find((row) => row.kind === 'unit_transfer');
      assert.equal(unitRow?.from_name, 'Lớp M2 (ĐT-A)');
      assert.equal(unitRow?.to_name, 'Lớp B1 (ĐT-B)');
      const leave = rows.find((row) => row.kind === 'withdrawn');
      assert.equal(leave?.full_name, 'Nguyễn Minh Ánh');
      assert.equal(leave?.from_name, 'Lớp C1 (ĐT-A)');
      assert.equal(leave?.reason, 'Chuyển trường');

      const onlyWithdrawn = await api('GET', '/student-movements?kind=withdrawn', principal.accessToken);
      assert.deepEqual(
        items(onlyWithdrawn.body).map((row) => row.full_name),
        ['Nguyễn Minh Ánh'],
      );
      const earlier = await api('GET', '/student-movements?from=2020-01-01&to=2020-12-31', principal.accessToken);
      assert.equal(earlier.body.total, 0);
      const paged = await api('GET', `/student-movements?page_size=10&page=1&q=An`, principal.accessToken);
      assert.equal(
        items(paged.body).every((row) => row.full_name.includes('An')),
        true,
      );
    });

    it('CT-15c-11: bộ lọc sai trả lỗi dữ liệu; giáo viên không xem được; xuất Excel ghi nhật ký, không có quyền xuất bị từ chối', async () => {
      const invalid = await api(
        'GET',
        '/student-movements?from=2026-13-01&to=2020-01-01&kind=x&page_size=7',
        principal.accessToken,
      );
      assert.equal(invalid.status, 400);
      assert.equal((await api('GET', '/student-movements', users.teacher?.accessToken ?? '')).status, 403);
      const file = await download('/student-movements/export', principal.accessToken, { kind: 'class_transfer' });
      assert.equal(file.status, 200);
      assert.deepEqual(file.rows[0], [
        'STT',
        'Ngày',
        'Loại biến động',
        'Mã định danh Bộ GD&ĐT',
        'Họ tên',
        'Ngày sinh',
        'Giới tính',
        'Từ',
        'Đến',
        'Lý do',
      ]);
      assert.deepEqual(file.rows[1]?.slice(2, 5), ['Chuyển lớp', '', 'Lê Gia Bảo']);
      const log = await schoolYear
        .selectFrom('export_logs')
        .select(['report_code', 'row_count', 'contains_personal_data'])
        .where('id', '=', file.logId ?? '')
        .executeTakeFirstOrThrow();
      assert.deepEqual(log, { report_code: 'student-movements', row_count: 1, contains_personal_data: true });
      assert.equal((await download('/student-movements/export', users.admissions?.accessToken ?? '', {})).status, 403);
    });
  });
});
