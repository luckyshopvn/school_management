import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import {
  administrativeNameKey,
  createDatabase,
  replaceDatabaseName,
  type SchoolYearDatabase,
} from '@school-management/database';
import ExcelJS from 'exceljs';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { AddressCatalog, type CatalogUnit } from './address-catalog.js';
import { MAPPING_COLUMNS } from './administrative-units.js';

// 4.1.11. Cập nhật địa danh hành chính (DT-15 phần 15h1, YCTD-116): khóa so khớp tên, danh mục TP.HCM gieo sẵn, danh sách
// địa chỉ còn theo địa danh cũ, chuyển hàng loạt, nhập bảng đối chiếu từ Excel
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const randomPhone = () => `09${randomInt(0, 100_000_000).toString().padStart(8, '0')}`;
let nationalIdCounter = randomInt(0, 1_000_000);
const nextNationalId = () =>
  `079${String(Date.now() % 1_000_000).padStart(6, '0')}${String(++nationalIdCounter % 1000).padStart(3, '0')}`;
const errorOf = (body: Record<string, unknown>) =>
  (body.error ?? {}) as { code?: string; rule_code?: string; details?: Array<{ field: string; message: string }> };
const HCM = 'Thành phố Hồ Chí Minh';

interface Row {
  id: string;
  child_id: string;
  full_name: string;
  address_type: string;
  old_province: string;
  old_district: string;
  old_ward: string;
  suggestion: string;
  candidates: Array<{ id: string; ward_name: string; province_name: string; code: string | null }>;
}

describe('Khóa so khớp tên đơn vị hành chính', () => {
  it('CT-15h1-1: bỏ tiền tố loại đơn vị, dấu câu, hoa thường; dấu thanh kiểu cũ và mới như nhau; giữ dấu phân biệt tên', () => {
    assert.equal(administrativeNameKey('Phường Bến Nghé'), administrativeNameKey('p. bến  nghé'));
    assert.equal(administrativeNameKey('Xã Hoà Phú'), administrativeNameKey('Xã Hòa Phú'));
    assert.equal(administrativeNameKey('TP. Hồ Chí Minh'), administrativeNameKey(HCM));
    assert.equal(administrativeNameKey('TP HCM'), administrativeNameKey(HCM));
    assert.equal(administrativeNameKey('Phường 01'), '1');
    assert.equal(administrativeNameKey('Quận 1'), administrativeNameKey('Phường 1'));
    assert.notEqual(administrativeNameKey('Xã Thanh An'), administrativeNameKey('Xã Thạnh An'));
    assert.equal(administrativeNameKey('Tỉnh Bà Rịa - Vũng Tàu'), administrativeNameKey('Bà Rịa – Vũng Tàu'));
  });

  it('CT-15h1-2: đối chiếu theo đơn vị cha; thiếu quận/huyện chỉ nhận khi tên xã không trùng; huyện không có cấp xã', () => {
    const unit = (
      id: string,
      period: 'old' | 'new',
      level: CatalogUnit['level'],
      name: string,
      parent: string | null,
    ) => ({
      id,
      period,
      level,
      code: null,
      name,
      name_key: administrativeNameKey(name),
      parent_id: parent,
    });
    const catalog = new AddressCatalog(
      [
        unit('p-old', 'old', 'province', 'Tỉnh Mẫu', null),
        unit('d1', 'old', 'district', 'Huyện Một', 'p-old'),
        unit('d2', 'old', 'district', 'Huyện Hai', 'p-old'),
        unit('d3', 'old', 'district', 'Huyện Đảo', 'p-old'),
        unit('w1', 'old', 'ward', 'Xã Đông', 'd1'),
        unit('w2', 'old', 'ward', 'Xã Đông', 'd2'),
        unit('w3', 'old', 'ward', 'Xã Tây', 'd2'),
        unit('p-new', 'new', 'province', 'Tỉnh Mới', null),
        unit('n1', 'new', 'ward', 'Xã Bình Minh', 'p-new'),
        unit('n2', 'new', 'ward', 'Xã Hoàng Hôn', 'p-new'),
        unit('n3', 'new', 'ward', 'Đặc khu Đảo Xa', 'p-new'),
      ],
      [
        { old_unit_id: 'w1', new_unit_id: 'n1' },
        { old_unit_id: 'w2', new_unit_id: 'n1' },
        { old_unit_id: 'w2', new_unit_id: 'n2' },
        { old_unit_id: 'w3', new_unit_id: 'n2' },
        { old_unit_id: 'd3', new_unit_id: 'n3' },
      ],
    );
    const names = (address: { province: string; district: string; ward: string }) => {
      const result = catalog.classify(address);
      return result.status === 'old' ? result.candidates.map((candidate) => candidate.ward_name) : result.status;
    };
    assert.deepEqual(names({ province: 'Tỉnh Mẫu', district: 'Huyện Một', ward: 'Xã Đông' }), ['Xã Bình Minh']);
    assert.deepEqual(names({ province: 'Tỉnh Mẫu', district: 'Huyện Hai', ward: 'Xã Đông' }), [
      'Xã Bình Minh',
      'Xã Hoàng Hôn',
    ]);
    assert.deepEqual(names({ province: 'Tỉnh Mẫu', district: '', ward: 'Xã Tây' }), ['Xã Hoàng Hôn']);
    assert.deepEqual(names({ province: 'Tỉnh Mẫu', district: '', ward: 'Xã Đông' }), []);
    assert.deepEqual(names({ province: 'Tỉnh Mẫu', district: 'Huyện Đảo', ward: '' }), ['Đặc khu Đảo Xa']);
    assert.equal(names({ province: 'Tỉnh Mới', district: '', ward: 'Xã Bình Minh' }), 'new');
    assert.equal(names({ province: 'Tỉnh Mới', district: '', ward: '' }), 'new');
    assert.deepEqual(names({ province: 'Tỉnh Mới', district: 'Huyện Một', ward: 'Xã Bình Minh' }), ['Xã Bình Minh']);
    assert.equal(names({ province: 'Tỉnh Khác', district: '', ward: 'Xã Nào Đó' }), 'unknown');
    assert.deepEqual(names({ province: 'Tỉnh Khác', district: 'Huyện Nào', ward: 'Xã Nào Đó' }), []);
    assert.equal(names({ province: '', district: '', ward: '' }), 'unknown');
  });
});

describe('Cập nhật địa danh hành chính (YCTD-116)', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let teacher: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  const units: Record<string, string> = {};
  const classes: Record<string, string> = {};
  const children: Record<string, string> = {};
  let savedDefaultPassword: Array<{ key: string; value: unknown; updated_by: string | null }> = [];
  let mother = '';

  const api = (method: string, path: string, token: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, token, body);
  const rows = async (query = '') => {
    const response = await api('GET', `/administrative-units/addresses?page_size=200${query}`, principal.accessToken);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    return response.body as { items: Row[]; total: number; counts: Record<string, number> };
  };
  const profileOf = async (key: string) =>
    (
      await schoolYear
        .selectFrom('children')
        .select('moet_profile')
        .where('id', '=', children[key] ?? '')
        .executeTakeFirstOrThrow()
    ).moet_profile as Record<string, unknown>;

  async function upload(path: string, token: string, rowsOfFile: string[][]) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Bảng đối chiếu');
    sheet.addRow(MAPPING_COLUMNS.map((column) => column.header));
    for (const row of rowsOfFile) {
      sheet.addRow(row);
    }
    const form = new FormData();
    form.set('file', new Blob([Buffer.from(await workbook.xlsx.writeBuffer())]), 'bang-doi-chieu.xlsx');
    const response = await fetch(`${environment.baseUrl}${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: form,
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  async function enrol(key: string, fullName: string, stage: 'draft' | 'pending' | 'active') {
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
    const created = await api('POST', '/children', principal.accessToken, {
      org_unit_id: units.A,
      full_name: fullName,
      dob: '2022-04-18',
      gender: 'female',
      national_id: nextNationalId(),
      birth_certificate_file_id: file.id,
      photo_consent: 'pending',
      health: { has_allergies: false },
      guardians: [
        { full_name: `Mẹ của ${fullName}`, phone: randomPhone(), relationship_item_id: mother, is_primary: true },
      ],
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    children[key] = created.body.id as string;
    if (stage === 'draft') {
      return;
    }
    const submitted = await api('POST', `/children/${children[key]}/submit`, principal.accessToken);
    assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
    if (stage === 'pending') {
      return;
    }
    const approved = await api('POST', `/children/${children[key]}/approve`, principal.accessToken, {
      class_id: classes.M1,
      confirm_over_capacity: true,
    });
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
  }

  async function setProfile(key: string, profile: Record<string, unknown>) {
    await schoolYear
      .updateTable('children')
      .set({ moet_profile: JSON.stringify(profile) })
      .where('id', '=', children[key] ?? '')
      .execute();
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
    ] as const) {
      const created = await api('POST', '/org-units', principal.accessToken, { code, name: code, unit_type: type });
      units[key] = created.body.id as string;
    }
    await api('POST', '/grade-levels', principal.accessToken, {
      code: 'MAM',
      name: 'Mầm',
      age_from_months: 36,
      age_to_months: 47,
    });
    const createdClass = await api('POST', '/classes', principal.accessToken, {
      org_unit_id: units.A,
      code: 'M1',
      name: 'Lớp M1',
      grade_level: 'MAM',
      max_size: 30,
    });
    classes.M1 = createdClass.body.id as string;
    const relationship = await api('POST', '/catalog-items', principal.accessToken, {
      catalog_type: 'parent_relationship',
      code: 'ME',
      name: 'Mẹ',
    });
    mother = relationship.body.id as string;
    teacher = await environment.loginAs('VT-07', units.A ?? null);
    await enrol('An', 'Trần Thị An', 'active');
    await enrol('Binh', 'Lê Văn Bình', 'draft');
    await enrol('Chi', 'Ngô Bảo Chi', 'pending');
    await enrol('Dung', 'Phạm Thị Dung', 'active');
    await setProfile('An', {
      ethnicity: 'Kinh',
      permanent_province: HCM,
      permanent_district: 'Quận 1',
      permanent_ward: 'Phường Bến Nghé',
      permanent_hamlet: 'Tổ 5',
      hometown_province: 'Tỉnh Mẫu Thử',
      hometown_district: 'Huyện Thử Nghiệm',
      hometown_ward: 'Xã Thử Một',
      birth_registration_province: 'Tỉnh Bà Rịa - Vũng Tàu',
      birth_registration_district: 'Huyện Côn Đảo',
      birthplace_province: 'Tỉnh Bình Dương',
      birthplace_district: 'Thành phố Thủ Dầu Một',
      birthplace_ward: 'Phường Hiệp Thành',
      current_province: HCM,
      current_ward: 'Phường Sài Gòn',
    });
    await setProfile('Binh', {
      permanent_province: 'TP. Hồ Chí Minh',
      permanent_district: 'Quận 12',
      permanent_ward: 'Phường Hiệp Thành',
    });
    await setProfile('Chi', { permanent_province: HCM, permanent_district: 'Quận 1', permanent_ward: 'Phường Đa Kao' });
    // Tỉnh không có trong danh mục, không ghi quận/huyện: không biết cũ hay mới nên không liệt kê
    await setProfile('Dung', { current_province: 'Thành phố Hà Nội', current_ward: 'Phường Hoàn Kiếm' });
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

  it('CT-15h1-3: danh mục TP.HCM gieo sẵn theo Nghị quyết 1685/NQ-UBTVQH15 và mã số của Cục Thống kê', async () => {
    const count = async (period: 'old' | 'new', level: 'province' | 'district' | 'ward') =>
      Number(
        (
          await environment.system
            .selectFrom('administrative_units')
            .select((expression) => expression.fn.countAll<string>().as('count'))
            .where('period', '=', period)
            .where('level', '=', level)
            .executeTakeFirstOrThrow()
        ).count,
      );
    assert.equal(await count('new', 'province'), 1);
    assert.equal(await count('new', 'ward'), 168);
    assert.equal(await count('old', 'province'), 3);
    assert.equal(await count('old', 'district'), 38);
    assert.equal(await count('old', 'ward'), 441);
    const mappings = await environment.system
      .selectFrom('administrative_unit_mappings')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    assert.equal(Number(mappings.count), 493);
    const saiGon = await environment.system
      .selectFrom('administrative_units')
      .select('code')
      .where('period', '=', 'new')
      .where('name', '=', 'Phường Sài Gòn')
      .executeTakeFirstOrThrow();
    assert.equal(saiGon.code, '26740');
    const response = await api('GET', '/administrative-units/mappings?q=Bến%20Nghé', principal.accessToken);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.deepEqual(
      (response.body.items as Array<Record<string, unknown>>).map((item) => [
        item.old_province,
        item.old_district,
        item.old_ward,
        item.new_ward,
        item.new_ward_code,
      ]),
      [[HCM, 'Quận 1', 'Phường Bến Nghé', 'Phường Sài Gòn', '26740']],
    );
    const conDao = await api('GET', '/administrative-units/mappings?q=Côn%20Đảo', principal.accessToken);
    assert.deepEqual(
      (conDao.body.items as Array<Record<string, unknown>>).map((item) => [
        item.old_district,
        item.old_ward,
        item.new_ward,
      ]),
      [['Huyện Côn Đảo', '', 'Đặc khu Côn Đảo']],
    );
  });

  it('CT-15h1-4: liệt kê địa chỉ còn theo địa danh cũ ở năm loại địa chỉ, đề xuất theo bảng đối chiếu, có bộ lọc', async () => {
    const all = await rows();
    assert.deepEqual(
      all.items.map((row) => [row.full_name, row.address_type, row.suggestion, row.candidates.map((c) => c.ward_name)]),
      [
        ['Trần Thị An', 'permanent', 'suggested', ['Phường Sài Gòn']],
        ['Trần Thị An', 'hometown', 'none', []],
        ['Trần Thị An', 'birth_registration', 'suggested', ['Đặc khu Côn Đảo']],
        ['Trần Thị An', 'birthplace', 'multiple', ['Phường Phú Lợi', 'Phường Thủ Dầu Một']],
        ['Lê Văn Bình', 'permanent', 'suggested', ['Phường Tân Thới Hiệp']],
        ['Ngô Bảo Chi', 'permanent', 'multiple', ['Phường Sài Gòn', 'Phường Tân Định']],
      ].sort((left, right) => {
        const order = ['Trần Thị An', 'Lê Văn Bình', 'Ngô Bảo Chi'];
        return order.indexOf(left[0] as string) - order.indexOf(right[0] as string);
      }),
    );
    assert.deepEqual(all.counts, { suggested: 3, multiple: 2, none: 1 });
    const first = all.items[0];
    assert.equal(first?.old_district, 'Quận 1');
    assert.equal(first?.candidates[0]?.province_name, HCM);
    assert.equal((await rows('&address_type=permanent')).total, 3);
    assert.equal((await rows('&suggestion=multiple')).total, 2);
    assert.deepEqual(
      (await rows('&q=Bình')).items.map((row) => row.full_name),
      ['Lê Văn Bình'],
    );
    const invalid = await api('GET', '/administrative-units/addresses?suggestion=x', principal.accessToken);
    assert.equal(invalid.status, 400);
  });

  it('CT-16b-1: xuất Excel lưới địa chỉ theo bộ lọc và cột đang hiện, ghi nhật ký xuất có dữ liệu cá nhân', async () => {
    const download = async (token: string, body: unknown) => {
      const response = await fetch(`${environment.baseUrl}/administrative-units/addresses/export`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const buffer = Buffer.from(await response.arrayBuffer());
      const sheetRows: string[][] = [];
      if (response.status === 200) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
        workbook.worksheets[0]?.eachRow((row) => {
          sheetRows.push(Array.from((row.values as unknown[]).slice(1), (value) => String(value ?? '')));
        });
      }
      return { status: response.status, rows: sheetRows, logId: response.headers.get('x-export-log-id') };
    };
    const file = await download(principal.accessToken, {
      suggestion: 'multiple',
      columns: ['full_name', 'address_type', 'old_ward', 'new_ward', 'suggestion'],
    });
    assert.equal(file.status, 200);
    assert.deepEqual(file.rows[0], ['STT', 'Họ tên', 'Loại địa chỉ', 'Xã/Phường cũ', 'Xã/Phường mới', 'Tình trạng']);
    assert.deepEqual(
      file.rows.slice(1).map((row) => [row[1], row[2], row[4], row[5]]),
      [
        ['Trần Thị An', 'Nơi sinh', 'Phường Phú Lợi; Phường Thủ Dầu Một', 'Nhiều xã/phường mới'],
        ['Ngô Bảo Chi', 'Thường trú', 'Phường Sài Gòn; Phường Tân Định', 'Nhiều xã/phường mới'],
      ],
    );
    const log = await schoolYear
      .selectFrom('export_logs')
      .select(['report_code', 'row_count', 'contains_personal_data'])
      .where('id', '=', file.logId ?? '')
      .executeTakeFirstOrThrow();
    assert.deepEqual(log, { report_code: 'administrative-addresses', row_count: 2, contains_personal_data: true });
    assert.equal((await download(principal.accessToken, {})).rows[0]?.length, 12);
    assert.equal((await download(principal.accessToken, { columns: ['full_name', 'salary'] })).status, 400);
    assert.equal((await download(teacher.accessToken, {})).status, 403);
  });

  it('CT-15h1-5: giáo viên không có quyền lập, duyệt hồ sơ học sinh thì không xem, không chuyển được', async () => {
    const list = await api('GET', '/administrative-units/addresses', teacher.accessToken);
    assert.equal(list.status, 403);
    const convert = await api('POST', '/administrative-units/addresses/convert', teacher.accessToken, {
      items: [{ child_id: children.An, address_type: 'permanent' }],
    });
    assert.equal(convert.status, 403);
    const imported = await upload('/administrative-units/mappings/import', teacher.accessToken, []);
    assert.equal(imported.status, 403);
  });

  it('CT-15h1-6: có địa chỉ không chuyển được (nhiều xã mới chưa chọn, chưa có đối chiếu, hồ sơ chờ duyệt) thì không chuyển địa chỉ nào', async () => {
    const before = await profileOf('An');
    const ambiguous = await api('POST', '/administrative-units/addresses/convert', principal.accessToken, {
      items: [
        { child_id: children.An, address_type: 'permanent' },
        { child_id: children.An, address_type: 'birthplace' },
        { child_id: children.An, address_type: 'hometown' },
        { child_id: children.An, address_type: 'current' },
      ],
    });
    assert.equal(ambiguous.status, 422, JSON.stringify(ambiguous.body));
    assert.equal(errorOf(ambiguous.body).rule_code, 'YCTD-116');
    assert.deepEqual(
      errorOf(ambiguous.body).details?.map((detail) => detail.message),
      [
        'Trần Thị An – Nơi sinh: xã cũ chia cho nhiều xã mới, cần chọn một xã mới',
        'Trần Thị An – Quê quán: chưa có trong bảng đối chiếu',
        'Trần Thị An – Chỗ ở hiện nay: địa chỉ không còn theo địa danh cũ',
      ],
    );
    const pending = await api('POST', '/administrative-units/addresses/convert', principal.accessToken, {
      items: [{ child_id: children.Chi, address_type: 'permanent' }],
    });
    assert.equal(pending.status, 422);
    assert.deepEqual(
      errorOf(pending.body).details?.map((detail) => detail.message),
      ['Ngô Bảo Chi'],
    );
    const wrongChoice = await api('POST', '/administrative-units/addresses/convert', principal.accessToken, {
      items: [{ child_id: children.An, address_type: 'permanent', new_unit_id: children.An }],
    });
    assert.equal(wrongChoice.status, 422);
    const empty = await api('POST', '/administrative-units/addresses/convert', principal.accessToken, { items: [] });
    assert.equal(empty.status, 400);
    assert.deepEqual(await profileOf('An'), before);
  });

  it('CT-15h1-7: chuyển hàng loạt: tỉnh, xã theo tên mới, bỏ quận/huyện cũ, giữ tổ/thôn; ghi nhật ký trước và sau', async () => {
    const list = await rows();
    const birthplace = list.items.find((row) => row.child_id === children.An && row.address_type === 'birthplace');
    const phuLoi = birthplace?.candidates.find((candidate) => candidate.ward_name === 'Phường Phú Lợi');
    assert.ok(phuLoi);
    const converted = await api('POST', '/administrative-units/addresses/convert', principal.accessToken, {
      items: [
        { child_id: children.An, address_type: 'permanent' },
        { child_id: children.An, address_type: 'birth_registration' },
        { child_id: children.An, address_type: 'birthplace', new_unit_id: phuLoi.id },
        { child_id: children.Binh, address_type: 'permanent' },
      ],
    });
    assert.equal(converted.status, 200, JSON.stringify(converted.body));
    assert.deepEqual(converted.body, { updated: 4, children: 2 });
    const profile = await profileOf('An');
    assert.equal(profile.permanent_province, HCM);
    assert.equal(profile.permanent_ward, 'Phường Sài Gòn');
    assert.equal(profile.permanent_district, undefined);
    assert.equal(profile.permanent_hamlet, 'Tổ 5');
    assert.equal(profile.birth_registration_ward, 'Đặc khu Côn Đảo');
    assert.equal(profile.birthplace_ward, 'Phường Phú Lợi');
    assert.equal(profile.birthplace_province, HCM);
    assert.equal(profile.ethnicity, 'Kinh');
    assert.equal(profile.hometown_district, 'Huyện Thử Nghiệm');
    assert.equal((await profileOf('Binh')).permanent_ward, 'Phường Tân Thới Hiệp');
    const log = await schoolYear
      .selectFrom('audit_logs')
      .select(['before_data', 'after_data'])
      .where('entity_name', '=', 'children')
      .where('entity_id', '=', children.An ?? '')
      .orderBy('created_at', 'desc')
      .executeTakeFirstOrThrow();
    const beforeData = log.before_data as { moet_profile_addresses: Record<string, Record<string, string>> };
    const afterData = log.after_data as { moet_profile_addresses: Record<string, Record<string, string>> };
    assert.deepEqual(beforeData.moet_profile_addresses.permanent, {
      province: HCM,
      district: 'Quận 1',
      ward: 'Phường Bến Nghé',
    });
    assert.deepEqual(afterData.moet_profile_addresses.permanent, {
      province: HCM,
      district: '',
      ward: 'Phường Sài Gòn',
      code: '26740',
    });
    const remaining = await rows();
    assert.deepEqual(
      remaining.items.map((row) => [row.full_name, row.address_type]),
      [
        ['Trần Thị An', 'hometown'],
        ['Ngô Bảo Chi', 'permanent'],
      ],
    );
  });

  it('CT-15h1-8: nhập bảng đối chiếu từ Excel: có dòng lỗi thì không ghi; dòng hợp lệ thêm đơn vị và đối chiếu, nhập lại không trùng', async () => {
    const bad = await upload('/administrative-units/mappings/import', principal.accessToken, [
      ['Tỉnh Mẫu Thử', 'Huyện Thử Nghiệm', 'Xã Thử Một', '', 'Tỉnh Mẫu Thử', 'Xã Thử Một', ''],
      ['Tỉnh Mẫu Thử', '', 'Xã Thử Hai', '123', 'Tỉnh Mẫu Thử', 'Xã Thử Ba', ''],
      [HCM, 'Quận 1', 'Phường Bến Nghé', '', HCM, 'Phường Sài Gòn', '26737'],
    ]);
    assert.equal(bad.status, 200, JSON.stringify(bad.body));
    assert.equal(bad.body.status, 'failed');
    assert.equal(bad.body.error_rows, 1);
    assert.deepEqual(
      (bad.body.errors as Array<{ row: number; column: string; message: string }>).map((error) => [
        error.row,
        error.column,
        error.message,
      ]),
      [
        [3, 'Quận/Huyện cũ', 'Bắt buộc nhập'],
        [3, 'Mã xã/phường cũ', 'Mã gồm 5 chữ số'],
      ],
    );
    const codeConflict = await upload('/administrative-units/mappings/import', principal.accessToken, [
      ['Tỉnh Mẫu Thử', 'Huyện Thử Nghiệm', 'Xã Thử Một', '', 'Tỉnh Mẫu Thử', 'Xã Thử Một', ''],
      [HCM, 'Quận 1', 'Phường Bến Nghé', '', HCM, 'Phường Sài Gòn', '26737'],
    ]);
    assert.equal(codeConflict.body.status, 'failed');
    assert.deepEqual(codeConflict.body.errors, [
      { row: 3, column: 'Xã/Phường mới', message: 'Mã 26737 đã dùng cho Phường Tân Định' },
    ]);
    const unitsBefore = await environment.system
      .selectFrom('administrative_units')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    assert.equal(Number(unitsBefore.count), 1 + 168 + 3 + 38 + 441);

    const good = await upload('/administrative-units/mappings/import', principal.accessToken, [
      ['Tỉnh Mẫu Thử', 'Huyện Thử Nghiệm', 'Xã Thử Một', '99001', 'Tỉnh Mẫu Thử', 'Xã Thử Một', '99002'],
      [HCM, 'Quận 1', 'Phường Bến Nghé', '', HCM, 'Phường Sài Gòn', '26740'],
    ]);
    assert.equal(good.status, 200, JSON.stringify(good.body));
    assert.deepEqual(
      [good.body.status, good.body.total_rows, good.body.created_units, good.body.created_mappings],
      ['committed', 2, 5, 1],
    );
    const again = await upload('/administrative-units/mappings/import', principal.accessToken, [
      ['Mẫu Thử', 'Thử Nghiệm', 'Thử Một', '', 'Mẫu Thử', 'Thử Một', ''],
    ]);
    assert.deepEqual([again.body.created_units, again.body.created_mappings], [0, 0]);
    const imported = await environment.system
      .selectFrom('administrative_units')
      .select(['name', 'code', 'source'])
      .where('source', '=', 'import')
      .orderBy('period')
      .orderBy('level')
      .execute();
    assert.equal(imported.length, 5);
    const hometown = (await rows()).items.find((row) => row.address_type === 'hometown');
    assert.equal(hometown?.suggestion, 'suggested');
    assert.deepEqual(
      hometown?.candidates.map((candidate) => [candidate.province_name, candidate.ward_name]),
      [['Tỉnh Mẫu Thử', 'Xã Thử Một']],
    );
    const log = await schoolYear
      .selectFrom('audit_logs')
      .select('after_data')
      .where('entity_name', '=', 'administrative_unit_mappings')
      .orderBy('created_at')
      .execute();
    // Mỗi lần nhập thành công một dòng nhật ký; lần nhập có dòng lỗi không ghi
    assert.deepEqual(
      log.map((entry) => entry.after_data),
      [
        { file_name: 'bang-doi-chieu.xlsx', total_rows: 2, created_units: 5, created_mappings: 1 },
        { file_name: 'bang-doi-chieu.xlsx', total_rows: 1, created_units: 0, created_mappings: 0 },
      ],
    );
    const template = await fetch(`${environment.baseUrl}/administrative-units/mappings/template`, {
      headers: { authorization: `Bearer ${principal.accessToken}` },
    });
    assert.equal(template.status, 200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await template.arrayBuffer()) as ArrayBuffer);
    assert.deepEqual(
      (workbook.worksheets[0]?.getRow(1).values as unknown[]).slice(1),
      MAPPING_COLUMNS.map((column) => column.header),
    );
  });
});
