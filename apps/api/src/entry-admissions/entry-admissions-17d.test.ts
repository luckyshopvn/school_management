import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
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
import {
  applyIntakeFilter,
  EMPTY_FILTER,
  isIntakeRow,
  isTransferable,
  readIntakeFilter,
  type IntakeRow,
} from './entry-intake.js';

// DT-17 phần 17d (YCTD-135): Tuyển sinh đầu cấp phần 2 (khảo sát mục 10.2.4). Kịch bản CT-17d-1 đến CT-17d-10, CT-17d-12
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const randomPhone = () => `09${randomInt(0, 100_000_000).toString().padStart(8, '0')}`;
let nationalIdCounter = randomInt(0, 1_000_000);
const nextNationalId = () =>
  `080${String(Date.now() % 1_000_000).padStart(6, '0')}${String(++nationalIdCounter % 1000).padStart(3, '0')}`;
const errorOf = (body: Record<string, unknown>) =>
  (body.error ?? {}) as { code?: string; rule_code?: string; message?: string; details?: Array<{ message: string }> };
type Row = IntakeRow & Record<string, unknown>;

async function workbook(rows: unknown[][]): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Danh sách');
  for (const row of rows) {
    sheet.addRow(row);
  }
  return Buffer.from(await book.xlsx.writeBuffer());
}

const ROUTING_HEADERS = [
  'Họ và tên (*)',
  'Ngày sinh (*)',
  'Giới tính (*)',
  'Nơi sinh',
  'Số ĐDCN',
  'Diện cư trú',
  'Nơi ở hiện tại (VNEID)',
  'Tổ',
  'Khu phố',
  'Phường/Xã',
  'Thành phố (Tỉnh)',
  'Họ tên cha',
  'Họ tên mẹ',
  'Người liên hệ (*)',
  'Số điện thoại (*)',
  'Thư điện tử',
  'Quan hệ với học sinh',
  'Phường/Xã cuối cấp',
  'Trường cuối cấp',
  'Tiêu chí',
  'Kết quả học tập và thành tích',
  'Ngày đăng ký',
];

function routingRow(input: {
  name: string;
  nationalId: string;
  phone: string;
  gender?: string;
  quarter?: string;
  criteria?: string;
}) {
  return [
    input.name,
    '10/03/2022',
    input.gender ?? 'Nam',
    'Thành phố Hồ Chí Minh',
    input.nationalId,
    'Thường trú',
    'Số 1 đường Mẫu',
    'Tổ 1',
    input.quarter ?? 'Khu phố 1',
    'Phường Mẫu',
    'Thành phố Hồ Chí Minh',
    `Cha của ${input.name}`,
    `Mẹ của ${input.name}`,
    `Mẹ của ${input.name}`,
    input.phone,
    '',
    'Mẹ',
    'Phường Mẫu',
    'Trường Mầm non Mẫu',
    input.criteria ?? '',
    input.criteria ? 'Bé ngoan cấp trường' : '',
    input.criteria ? '01/04/2026' : '',
  ];
}

function sampleRow(overrides: Partial<IntakeRow>): IntakeRow {
  return {
    ...({
      id: 'x',
      code: 'TS-000001',
      campaign_id: 'c',
      program_type: 'general',
      source: 'routing',
      status: 'passed',
      full_name: 'Nguyễn Văn An',
      dob: '2022-03-10',
      national_id: '********1234',
      national_id_hash: 'h',
      submitted_documents: [],
      admission_decision: 'pending',
      school_review: 'pending',
      ward_review: 'pending',
      routed: true,
      guardian_phone: '0900000000',
      last_notice_at: null,
      transfer_guid: null,
      record_type: 'free',
      ward: 'Phường Mẫu',
      quarter: 'Khu phố 1',
      final_year_school: 'Trường Mẫu',
      residence_type: 'permanent',
      province: null,
      father_name: null,
      mother_name: null,
      transfer_package_code: null,
      student_code: null,
    } as unknown as IntakeRow),
    ...overrides,
  };
}

describe('Tuyển sinh đầu cấp phần 2 (DT-17 phần 17d)', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let admissions: LoggedInUser;
  let manager: LoggedInUser;
  let teacher: LoggedInUser;
  let parent: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let yearId = '';
  let draftYearId = '';
  const units: Record<string, string> = {};
  const classes: Record<string, string> = {};
  const campaigns: Record<string, string> = {};
  const ids: Record<string, string> = {};
  const nationalIds: Record<string, string> = {};
  const phones: Record<string, string> = {};
  let savedDefaultPassword: Array<{ key: string; value: unknown; updated_by: string | null }> = [];

  const api = (method: string, path: string, token: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, token, body);
  const items = (body: Record<string, unknown>) => body.items as Row[];

  async function fetchFile(token: string, path: string, body: unknown) {
    const response = await fetch(`${environment.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      status: response.status,
      buffer,
      type: response.headers.get('content-type') ?? '',
      json: response.status === 200 ? null : (JSON.parse(buffer.toString()) as Record<string, unknown>),
    };
  }

  async function upload(token: string, path: string, fields: Record<string, string>, file: Buffer, name: string) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      form.set(key, value);
    }
    form.set('file', new Blob([file]), name);
    const response = await fetch(`${environment.baseUrl}${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: form,
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    const json = response.headers.get('content-type')?.includes('json')
      ? (JSON.parse(buffer.toString()) as Record<string, unknown>)
      : null;
    return { status: response.status, body: json ?? {}, buffer, type: response.headers.get('content-type') ?? '' };
  }

  async function sheetRows(buffer: Buffer): Promise<string[][]> {
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(buffer as unknown as ArrayBuffer);
    const rows: string[][] = [];
    book.worksheets[0]?.eachRow((row) => {
      rows.push(Array.from((row.values as unknown[]).slice(1), (value) => String(value ?? '')));
    });
    return rows;
  }

  async function list(screen: string, query = '', token = principal.accessToken) {
    const listed = await api('GET', `/entry-intake/applications?screen=${screen}${query}`, token);
    assert.equal(listed.status, 200, JSON.stringify(listed.body));
    return items(listed.body);
  }

  async function createCampaign(key: string, name: string, unitId: string) {
    const created = await schoolYear
      .insertInto('admission_campaigns')
      .values({
        org_unit_id: unitId,
        name,
        quota: 50,
        open_from: '2026-03-01',
        open_to: '2026-08-31',
        status: 'open',
        created_by: principal.userId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    campaigns[key] = created.id;
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
    yearId = await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
      first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    });
    const draft = await api('POST', '/academic-years', principal.accessToken, { name: '2027–2028' });
    draftYearId = draft.body.id as string;
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
      const created = await api('POST', '/org-units', principal.accessToken, {
        code,
        name: `Đơn vị ${code}`,
        unit_type: type,
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      units[key] = created.body.id as string;
    }
    await api('POST', '/grade-levels', principal.accessToken, {
      code: 'NHA',
      name: 'Nhà trẻ',
      age_from_months: 24,
      age_to_months: 35,
    });
    for (const [code, unit] of [
      ['NT1', 'A'],
      ['NT2', 'B'],
    ] as const) {
      const created = await api('POST', '/classes', principal.accessToken, {
        org_unit_id: units[unit],
        code,
        name: `Lớp ${code}`,
        grade_level: 'NHA',
        max_size: 30,
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      classes[code] = created.body.id as string;
    }
    const relationship = await api('POST', '/catalog-items', principal.accessToken, {
      catalog_type: 'parent_relationship',
      code: 'ME',
      name: 'Mẹ',
    });
    assert.equal(relationship.status, 201, JSON.stringify(relationship.body));
    await createCampaign('general', 'Tuyển sinh vào Mầm non năm học 2026 - 2027', units.TC ?? '');
    await createCampaign('advanced', 'Tuyển sinh trường tiên tiến 2026 - 2027', units.TC ?? '');
    await createCampaign('unitB', 'Tuyển sinh điểm trường B', units.B ?? '');
    admissions = await environment.loginAs('VT-12', null);
    manager = await environment.loginAs('VT-03', units.B ?? null);
    teacher = await environment.loginAs('VT-07', units.A ?? null);
    parent = await environment.loginAs('VT-14', units.A ?? null);
    for (const key of ['An', 'Binh', 'Cuong', 'Dung', 'Em']) {
      nationalIds[key] = nextNationalId();
      phones[key] = randomPhone();
    }
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

  it('CT-17d-1: Hồ sơ của 1.4, điều kiện chuyển hồ sơ và bộ lọc như Sở', () => {
    assert.equal(isIntakeRow({ source: 'routing', status: 'received' }), true);
    assert.equal(isIntakeRow({ source: 'online', status: 'received' }), false);
    assert.equal(isIntakeRow({ source: 'online', status: 'passed' }), true);
    const base = {
      status: 'passed',
      admission_decision: 'pending',
      program_type: 'general',
      school_review: 'pending',
    } as const;
    assert.equal(isTransferable(base), true);
    assert.equal(isTransferable({ ...base, admission_decision: 'declined' }), false);
    assert.equal(isTransferable({ ...base, program_type: 'advanced' }), false);
    assert.equal(isTransferable({ ...base, program_type: 'advanced', school_review: 'admitted' }), true);
    assert.equal(isTransferable({ ...base, status: 'converted' }), false);
    const rows = [
      sampleRow({ id: '1', submitted_documents: ['admission_notice'], admission_decision: 'accepted' }),
      sampleRow({ id: '2', quarter: 'Khu phố 2', national_id: '********5678', national_id_hash: 'other' }),
    ];
    const hash = (text: string) => (text.endsWith('1234') ? 'h' : 'none');
    const filter = (query: Record<string, unknown>) => {
      const errors: Array<{ field: string; message: string }> = [];
      const result = readIntakeFilter(query, errors);
      assert.deepEqual(errors, []);
      return result;
    };
    assert.deepEqual(
      applyIntakeFilter(rows, filter({ doc_admission_notice: 'yes' }), hash).map((row) => row.id),
      ['1'],
    );
    assert.deepEqual(
      applyIntakeFilter(rows, filter({ decision: 'not_accepted' }), hash).map((row) => row.id),
      ['2'],
    );
    assert.deepEqual(
      applyIntakeFilter(rows, filter({ quarter: 'khu phố 2' }), hash).map((row) => row.id),
      ['2'],
    );
    assert.deepEqual(
      applyIntakeFilter(rows, filter({ national_id: '5678' }), hash).map((row) => row.id),
      ['2'],
    );
    assert.deepEqual(
      applyIntakeFilter(rows, filter({ national_id: '079000001234' }), hash).map((row) => row.id),
      ['1'],
    );
    assert.equal(applyIntakeFilter(rows, EMPTY_FILTER, hash).length, 2);
    const errors: Array<{ field: string; message: string }> = [];
    readIntakeFilter({ routed: 'maybe', program_type: 'x' }, errors);
    assert.deepEqual(
      errors.map((error) => error.field),
      ['program_type', 'routed'],
    );
  });

  it('CT-17d-2: Đợt tuyển sinh thêm loại hình, năm học nhận trẻ; ngoài quyền bị chặn', async () => {
    const updated = await api('PUT', `/entry-intake/campaigns/${campaigns.advanced}`, principal.accessToken, {
      program_type: 'advanced',
      target_academic_year_id: draftYearId,
    });
    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    const invalid = await api('PUT', `/entry-intake/campaigns/${campaigns.general}`, principal.accessToken, {
      program_type: 'other',
    });
    assert.equal(invalid.status, 400);
    const listed = await api('GET', '/entry-intake/campaigns', principal.accessToken);
    const advanced = items(listed.body).find((item) => item.id === campaigns.advanced) as unknown as Record<
      string,
      unknown
    >;
    assert.equal(advanced.program_type, 'advanced');
    assert.equal(advanced.target_academic_year_id, draftYearId);
    // Quản lý đơn vị B chỉ thấy đợt của đơn vị mình và không sửa được đợt
    const managerList = await api('GET', '/entry-intake/campaigns', manager.accessToken);
    assert.deepEqual(
      items(managerList.body).map((item) => item.id),
      [campaigns.unitB],
    );
    assert.equal(
      (
        await api('PUT', `/entry-intake/campaigns/${campaigns.unitB}`, manager.accessToken, {
          program_type: 'survey',
        })
      ).status,
      403,
    );
    assert.equal((await api('GET', '/entry-intake/campaigns', teacher.accessToken)).status, 403);
    const options = await api('GET', '/entry-intake/options', principal.accessToken);
    assert.ok((options.body.academic_years as Array<{ id: string }>).some((year) => year.id === yearId));
  });

  it('CT-17d-3: Nhập danh sách phân tuyến từ Excel: có lỗi thì không ghi dòng nào, có tệp lỗi; đúng thì tạo hồ sơ', async () => {
    const bad = await workbook([
      ROUTING_HEADERS,
      routingRow({ name: 'Nguyễn Văn An', nationalId: nationalIds.An ?? '', phone: phones.An ?? '' }),
      routingRow({ name: 'Trần Thị Bình', nationalId: '123', phone: phones.Binh ?? '', gender: 'Khác' }),
      routingRow({ name: 'Lê Văn Cường', nationalId: nationalIds.An ?? '', phone: phones.Cuong ?? '' }),
    ]);
    const failed = await upload(
      admissions.accessToken,
      '/entry-intake/import',
      { campaign_id: campaigns.general ?? '' },
      bad,
      'phan-tuyen.xlsx',
    );
    assert.equal(failed.status, 200, JSON.stringify(failed.body));
    assert.equal(failed.body.created, 0);
    const messages = (failed.body.errors as Array<{ row: number; message: string }>).map(
      (error) => `${error.row}:${error.message}`,
    );
    assert.ok(messages.includes('3:Giới tính là Nam hoặc Nữ'), messages.join('|'));
    assert.ok(messages.includes('3:Số định danh cá nhân gồm 12 chữ số'));
    assert.ok(messages.includes('4:Số định danh đã có hồ sơ trong đợt tuyển sinh'));
    const errorFile = await upload(
      admissions.accessToken,
      '/entry-intake/import?error_file=true',
      { campaign_id: campaigns.general ?? '' },
      bad,
      'phan-tuyen.xlsx',
    );
    assert.match(errorFile.type, /spreadsheetml/);
    assert.ok((await sheetRows(errorFile.buffer))[0]?.includes('Nội dung lỗi'));
    assert.equal((await list('intake')).length, 0);

    const good = await workbook([
      ROUTING_HEADERS,
      routingRow({ name: 'Nguyễn Văn An', nationalId: nationalIds.An ?? '', phone: phones.An ?? '' }),
      routingRow({ name: 'Trần Thị Bình', nationalId: nationalIds.Binh ?? '', phone: phones.Binh ?? '', gender: 'Nữ' }),
      routingRow({
        name: 'Lê Văn Cường',
        nationalId: nationalIds.Cuong ?? '',
        phone: phones.Cuong ?? '',
        quarter: 'Khu phố 2',
      }),
    ]);
    const created = await upload(
      admissions.accessToken,
      '/entry-intake/import',
      { campaign_id: campaigns.general ?? '' },
      good,
      'phan-tuyen.xlsx',
    );
    assert.equal(created.body.created, 3, JSON.stringify(created.body));
    const advanced = await upload(
      admissions.accessToken,
      '/entry-intake/import',
      { campaign_id: campaigns.advanced ?? '' },
      await workbook([
        ROUTING_HEADERS,
        routingRow({
          name: 'Phạm Văn Dũng',
          nationalId: nationalIds.Dung ?? '',
          phone: phones.Dung ?? '',
          criteria: 'Con thương binh',
        }),
      ]),
      'tien-tien.xlsx',
    );
    assert.equal(advanced.body.created, 1, JSON.stringify(advanced.body));
    const rows = await list('intake');
    assert.equal(rows.length, 4);
    for (const row of rows) {
      assert.equal(row.source, 'routing');
      assert.equal(row.routed, true);
      assert.match(row.national_id, /^\*{8}\d{4}$/);
    }
    ids.An = rows.find((row) => row.full_name === 'Nguyễn Văn An')?.id ?? '';
    ids.Binh = rows.find((row) => row.full_name === 'Trần Thị Bình')?.id ?? '';
    ids.Cuong = rows.find((row) => row.full_name === 'Lê Văn Cường')?.id ?? '';
    ids.Dung = rows.find((row) => row.full_name === 'Phạm Văn Dũng')?.id ?? '';
    assert.equal(rows.find((row) => row.id === ids.An)?.status, 'passed');
    assert.equal(rows.find((row) => row.id === ids.Dung)?.status, 'received');
    assert.equal(rows.find((row) => row.id === ids.An)?.relationship_name, 'Mẹ');
    // Bộ lọc khu phố, số định danh đủ 12 số
    assert.deepEqual(
      (await list('intake', '&quarter=Khu%20ph%E1%BB%91%202')).map((row) => row.id),
      [ids.Cuong],
    );
    assert.deepEqual(
      (await list('intake', `&national_id=${nationalIds.Binh}`)).map((row) => row.id),
      [ids.Binh],
    );
    // Hồ sơ trực tuyến chưa đạt không có ở 1.4
    await schoolYear
      .insertInto('admission_applications')
      .values({
        code: 'TS-999001',
        campaign_id: campaigns.general ?? '',
        org_unit_id: units.TC ?? '',
        source: 'online',
        child_full_name: 'Hồ sơ trực tuyến chờ xét',
        child_dob: '2022-01-01',
        child_gender: 'male',
        guardian_full_name: 'Phụ huynh',
        guardian_phone: randomPhone(),
        status: 'received',
      })
      .execute();
    assert.equal((await list('intake')).length, 4);
    assert.equal(
      (
        await upload(
          teacher.accessToken,
          '/entry-intake/import',
          { campaign_id: campaigns.general ?? '' },
          good,
          'x.xlsx',
        )
      ).status,
      403,
    );
  });

  it('CT-17d-4: Lưu dữ liệu giấy tờ đã nộp, đồng ý nhập học; Cập nhật; Hủy nhập học hồ sơ chưa chuyển', async () => {
    const saved = await api('POST', '/entry-intake/save', admissions.accessToken, {
      items: [
        { id: ids.An, submitted_documents: ['admission_notice', 'declaration'], admission_decision: 'accepted' },
        { id: ids.Binh, submitted_documents: [], admission_decision: 'declined' },
      ],
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.done, 2);
    assert.equal(
      (
        await api('POST', '/entry-intake/save', admissions.accessToken, {
          items: [{ id: ids.An, submitted_documents: ['passport'], admission_decision: 'accepted' }],
        })
      ).status,
      400,
    );
    assert.deepEqual(
      (await list('intake', '&doc_admission_notice=yes&decision=accepted')).map((row) => row.id),
      [ids.An],
    );
    const updated = await api('PUT', `/entry-intake/applications/${ids.Cuong}`, admissions.accessToken, {
      child_has_allergies: false,
      father_name: 'Lê Văn Cha',
      national_id: nationalIds.Em,
    });
    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    assert.equal(updated.body.father_name, 'Lê Văn Cha');
    assert.equal(updated.body.national_id, `********${nationalIds.Em?.slice(-4)}`);
    assert.equal(
      (await api('PUT', `/entry-intake/applications/${ids.Cuong}`, admissions.accessToken, { national_id: '12' }))
        .status,
      400,
    );
    // Phụ huynh từ chối: không chuyển được; hủy nhập học hồ sơ chưa chuyển
    const cancelled = await api('POST', '/entry-intake/cancel', admissions.accessToken, { ids: [ids.Binh] });
    assert.equal(cancelled.body.done, 1);
    const again = await api('POST', '/entry-intake/cancel', admissions.accessToken, { ids: [ids.Binh] });
    assert.equal(again.body.done, 0);
    assert.equal((await list('intake')).find((row) => row.id === ids.Binh)?.status, 'cancelled');
    assert.equal(
      (await api('PUT', `/entry-intake/applications/${ids.Binh}`, admissions.accessToken, { father_name: 'X' })).status,
      422,
    );
    assert.equal((await api('POST', '/entry-intake/cancel', manager.accessToken, { ids: [ids.An] })).status, 403);
  });

  it('CT-17d-5: 1.3 Trường tiên tiến: xác nhận hồ sơ, không đồng ý, chưa xác nhận; minh chứng; xóa hồ sơ phân tuyến', async () => {
    const rows = await list('advanced');
    assert.deepEqual(
      rows.map((row) => row.id),
      [ids.Dung],
    );
    assert.equal(rows[0]?.advanced_criteria, 'Con thương binh');
    const notGeneral = await api('POST', '/entry-intake/review', admissions.accessToken, {
      ids: [ids.An],
      review: 'admitted',
    });
    assert.equal(notGeneral.body.done, 0);
    const rejected = await api('POST', '/entry-intake/review', admissions.accessToken, {
      ids: [ids.Dung],
      review: 'not_admitted',
    });
    assert.equal(rejected.body.done, 1);
    assert.equal((await list('advanced', '&school_review=not_admitted')).length, 1);
    assert.equal(
      (await list('transfer')).some((row) => row.id === ids.Dung),
      false,
    );
    const admitted = await api('POST', '/entry-intake/review', admissions.accessToken, {
      ids: [ids.Dung],
      review: 'admitted',
    });
    assert.equal(admitted.body.done, 1);
    const ward = await api('PUT', `/entry-intake/applications/${ids.Dung}`, admissions.accessToken, {
      ward_review: 'admitted',
    });
    assert.equal(ward.body.ward_review, 'admitted');
    const row = (await list('advanced'))[0];
    assert.equal(row?.status, 'passed');
    assert.equal(row?.school_reviewed_by_name !== null, true);
    assert.equal(
      (await list('transfer')).some((item) => item.id === ids.Dung),
      true,
    );
    const noEvidence = await fetchFile(principal.accessToken, '/entry-intake/evidence', { ids: [ids.Dung] });
    assert.equal(noEvidence.status, 422);
    const attached = await upload(
      admissions.accessToken,
      `/entry-intake/applications/${ids.Dung}/files`,
      { kind: 'evidence' },
      PNG,
      'minh-chung.png',
    );
    assert.equal(attached.status, 201, JSON.stringify(attached.body));
    const bad = await upload(
      admissions.accessToken,
      `/entry-intake/applications/${ids.Dung}/files`,
      { kind: 'evidence' },
      Buffer.from('not an image'),
      'x.txt',
    );
    assert.equal(bad.status, 400);
    const zip = await fetchFile(principal.accessToken, '/entry-intake/evidence', { ids: [ids.Dung] });
    assert.equal(zip.status, 200);
    assert.equal(zip.type, 'application/zip');
    assert.equal(zip.buffer.subarray(0, 2).toString(), 'PK');
    const pdf = await fetchFile(principal.accessToken, '/entry-intake/forms', {
      ids: [ids.Dung],
      kind: 'registration',
    });
    assert.equal(pdf.status, 200);
    assert.equal(pdf.buffer.subarray(0, 4).toString(), '%PDF');
    // Xóa: chỉ hồ sơ phân tuyến chưa chuyển; hồ sơ trực tuyến bỏ qua
    const online = await schoolYear
      .selectFrom('admission_applications')
      .select('id')
      .where('code', '=', 'TS-999001')
      .executeTakeFirstOrThrow();
    const removed = await api('POST', '/entry-intake/remove', admissions.accessToken, { ids: [online.id] });
    assert.equal(removed.body.done, 0);
  });

  it('CT-17d-6: 1.5 Gửi thông báo: sao chép nội dung, nhập từ Excel, học sinh ngoài hệ thống, trạng thái theo người', async () => {
    // Phụ huynh của An đã có tài khoản ứng dụng phụ huynh (cùng số điện thoại)
    const guardian = await schoolYear
      .insertInto('guardians')
      .values({ full_name: 'Mẹ của Nguyễn Văn An', phone: phones.An ?? '', user_id: parent.userId })
      .returning('id')
      .executeTakeFirstOrThrow();
    assert.ok(guardian.id);
    const recipients = await api(
      'GET',
      `/entry-intake/notices/recipients?campaign_id=${campaigns.general}`,
      admissions.accessToken,
    );
    assert.equal(recipients.status, 200, JSON.stringify(recipients.body));
    const general = items(recipients.body) as unknown as Array<Record<string, unknown>>;
    assert.equal(general.length, 3);
    assert.equal(general.find((item) => item.application_id === ids.An)?.has_parent_account, true);
    const contentFile = await workbook([
      ['Số ĐDCN', 'Mã hồ sơ', 'Họ và tên', 'Nội dung gửi (*)'],
      [nationalIds.An, '', 'Nguyễn Văn An', 'Mời phụ huynh nộp hồ sơ ngày 01/07'],
      ['', 'TS-000000', 'Không có', 'Nội dung'],
    ]);
    const contentFailed = await upload(
      admissions.accessToken,
      '/entry-intake/notices/import',
      { campaign_id: campaigns.general ?? '', kind: 'content' },
      contentFile,
      'noi-dung.xlsx',
    );
    assert.equal(contentFailed.body.updated, 0);
    assert.equal((contentFailed.body.errors as unknown[]).length, 1);
    const contentOk = await upload(
      admissions.accessToken,
      '/entry-intake/notices/import',
      { campaign_id: campaigns.general ?? '', kind: 'content' },
      await workbook([
        ['Số ĐDCN', 'Mã hồ sơ', 'Họ và tên', 'Nội dung gửi (*)'],
        [nationalIds.An, '', 'Nguyễn Văn An', 'Mời phụ huynh nộp hồ sơ ngày 01/07'],
      ]),
      'noi-dung.xlsx',
    );
    assert.equal(contentOk.body.updated, 1, JSON.stringify(contentOk.body));
    const external = await upload(
      admissions.accessToken,
      '/entry-intake/notices/import',
      { campaign_id: campaigns.general ?? '', kind: 'external' },
      await workbook([
        ['Họ và tên (*)', 'Ngày sinh', 'Giới tính', 'Số ĐDCN', 'Số điện thoại (*)', 'Cuối Cấp', 'Nội dung gửi'],
        ['Học sinh ngoài hệ thống', '01/02/2022', 'Nam', '', randomPhone(), 'Trường khác', ''],
      ]),
      'ngoai-he-thong.xlsx',
    );
    assert.equal(external.body.created, 1, JSON.stringify(external.body));
    const all = items(
      (await api('GET', `/entry-intake/notices/recipients?campaign_id=${campaigns.general}`, admissions.accessToken))
        .body,
    ) as unknown as Array<Record<string, unknown>>;
    assert.equal(all.length, 4);
    const contact = all.find((item) => item.external === true);
    const copied = await api('POST', '/entry-intake/notices/copy', admissions.accessToken, {
      campaign_id: campaigns.general,
      content: 'Thông báo chung về tuyển sinh',
      application_ids: [ids.Cuong],
      contact_ids: [contact?.contact_id],
    });
    assert.equal(copied.body.updated, 2);
    const sent = await api('POST', '/entry-intake/notices/send', admissions.accessToken, {
      campaign_id: campaigns.general,
      content: '',
      application_ids: [ids.An, ids.Cuong],
      contact_ids: [contact?.contact_id],
    });
    assert.equal(sent.status, 200, JSON.stringify(sent.body));
    assert.equal(sent.body.recipients, 3);
    assert.equal(sent.body.delivered, 1);
    const notification = await schoolYear
      .selectFrom('notifications')
      .innerJoin('notification_recipients', 'notification_recipients.notification_id', 'notifications.id')
      .select(['notifications.body', 'notification_recipients.channel', 'notification_recipients.user_id'])
      .where('notifications.target_id', '=', ids.An ?? '')
      .where('notifications.template_code', '=', 'entry_admission_notice')
      .execute();
    assert.deepEqual(notification.map((row) => row.channel).sort(), ['in_app', 'zalo']);
    assert.equal(notification[0]?.body, 'Mời phụ huynh nộp hồ sơ ngày 01/07');
    const logs = await schoolYear
      .selectFrom('entry_admission_notice_recipients')
      .select(['application_id', 'delivered', 'note', 'content'])
      .execute();
    assert.equal(logs.find((log) => log.application_id === ids.Cuong)?.delivered, false);
    assert.match(logs.find((log) => log.application_id === ids.Cuong)?.note ?? '', /SMS chờ kết nối/);
    assert.equal(logs.find((log) => log.application_id === ids.Cuong)?.content, 'Thông báo chung về tuyển sinh');
    const sentFilter = items(
      (
        await api(
          'GET',
          `/entry-intake/notices/recipients?campaign_id=${campaigns.general}&notice_sent=yes`,
          admissions.accessToken,
        )
      ).body,
    ) as unknown as Array<Record<string, unknown>>;
    assert.deepEqual(
      sentFilter.map((item) => item.application_id),
      [ids.An],
    );
    const empty = await api('POST', '/entry-intake/notices/send', admissions.accessToken, {
      campaign_id: campaigns.advanced,
      content: '',
      application_ids: [ids.Dung],
      contact_ids: [],
    });
    assert.equal(empty.status, 422);
  });

  it('CT-17d-7: 1.6 Chuyển hồ sơ: năm học nhận trẻ chưa mở bị chặn; thiếu giấy tờ ghi kết quả lỗi; đủ thì tạo hồ sơ học sinh', async () => {
    const blocked = await api('POST', '/entry-intake/transfers/run', principal.accessToken, { ids: [ids.Dung] });
    assert.equal(blocked.status, 422);
    assert.match(errorOf(blocked.body).message ?? '', /2027–2028 chưa mở/);
    const noYear = await api('POST', '/entry-intake/transfers/run', principal.accessToken, { ids: [ids.An] });
    assert.match(errorOf(noYear.body).message ?? '', /chưa chọn năm học nhận trẻ/);
    for (const key of ['general', 'advanced']) {
      await api('PUT', `/entry-intake/campaigns/${campaigns[key]}`, principal.accessToken, {
        program_type: key,
        target_academic_year_id: yearId,
      });
    }
    assert.equal(
      (await api('POST', '/entry-intake/transfers/run', admissions.accessToken, { ids: [ids.An] })).status,
      403,
    );
    const missing = await api('POST', '/entry-intake/transfers/run', principal.accessToken, {
      ids: [ids.An, ids.Binh],
    });
    assert.equal(missing.status, 200, JSON.stringify(missing.body));
    const results = missing.body.results as Array<{ application_id: string; succeeded: boolean; note: string }>;
    assert.match(missing.body.package_code as string, /^GT-/);
    assert.equal(results.find((item) => item.application_id === ids.An)?.succeeded, false);
    assert.match(results.find((item) => item.application_id === ids.An)?.note ?? '', /giấy khai sinh/);
    assert.match(results.find((item) => item.application_id === ids.An)?.note ?? '', /khai báo dị ứng/);
    assert.match(results.find((item) => item.application_id === ids.Binh)?.note ?? '', /từ chối nhập học/);
    // Bổ sung dị ứng, giấy khai sinh; điểm trường A
    await api('PUT', `/entry-intake/applications/${ids.An}`, admissions.accessToken, { child_has_allergies: false });
    await upload(
      admissions.accessToken,
      `/entry-intake/applications/${ids.An}/files`,
      { kind: 'birth_certificate' },
      PNG,
      'khai-sinh.png',
    );
    const updated = await api('PUT', '/entry-intake/transfers', principal.accessToken, {
      items: [{ id: ids.An, target_org_unit_id: units.A, record_type: 'account' }],
    });
    assert.equal(updated.body.done, 1, JSON.stringify(updated.body));
    const done = await api('POST', '/entry-intake/transfers/run', principal.accessToken, { ids: [ids.An] });
    const result = (done.body.results as Array<{ succeeded: boolean; guid: string; note: string }>)[0];
    assert.equal(result?.succeeded, true, JSON.stringify(done.body));
    assert.match(result?.guid ?? '', /^[0-9a-f-]{36}$/);
    const transferred = (await list('transfer', '&transferred=yes')).find((row) => row.id === ids.An);
    assert.equal(transferred?.status, 'converted');
    assert.equal(transferred?.transfer_guid, result?.guid);
    assert.equal(transferred?.record_type, 'account');
    const child = await schoolYear
      .selectFrom('children')
      .select(['status', 'org_unit_id', 'full_name'])
      .where('id', '=', transferred?.created_child_id ?? '')
      .executeTakeFirstOrThrow();
    assert.equal(child.status, 'pending');
    assert.equal(child.org_unit_id, units.A);
    const again = await api('POST', '/entry-intake/transfers/run', principal.accessToken, { ids: [ids.An] });
    assert.match((again.body.results as Array<{ note: string }>)[0]?.note ?? '', /đã chuyển/);
    const history = await api(
      'GET',
      `/entry-intake/transfers/results?kind=transfer&package_code=${done.body.package_code}`,
      principal.accessToken,
    );
    assert.equal(items(history.body).length, 1);
    assert.equal((history.body.packages as string[]).length, 1);
  });

  it('CT-17d-8: 5.11 Xếp lớp rồi chuyển: học sinh vào lớp đã xếp; hỏi xóa lớp đã xếp thì chờ xếp lớp', async () => {
    await api('PUT', `/entry-intake/applications/${ids.Dung}`, admissions.accessToken, { child_has_allergies: true });
    await upload(
      admissions.accessToken,
      `/entry-intake/applications/${ids.Dung}/files`,
      { kind: 'birth_certificate' },
      PNG,
      'khai-sinh.png',
    );
    const arranged = await api('POST', '/entry-intake/transfers/arrange', principal.accessToken, {
      ids: [ids.Dung, ids.Binh],
      class_id: classes.NT2,
    });
    assert.equal(arranged.body.done, 1, JSON.stringify(arranged.body));
    assert.equal((await list('transfer')).find((row) => row.id === ids.Dung)?.planned_class_name, 'Lớp NT2');
    const done = await api('POST', '/entry-intake/transfers/run', principal.accessToken, { ids: [ids.Dung] });
    const result = (done.body.results as Array<{ succeeded: boolean; note: string }>)[0];
    assert.equal(result?.succeeded, true, JSON.stringify(done.body));
    assert.match(result?.note ?? '', /xếp lớp Lớp NT2/);
    const row = (await list('transferred')).find((item) => item.id === ids.Dung);
    const enrolment = await schoolYear
      .selectFrom('class_enrollments')
      .select('class_id')
      .where('child_id', '=', row?.created_child_id ?? '')
      .where('is_current', '=', true)
      .executeTakeFirst();
    assert.equal(enrolment?.class_id, classes.NT2);
    // Cường xếp lớp NT1 rồi chọn xóa lớp đã xếp khi chuyển
    await upload(
      admissions.accessToken,
      `/entry-intake/applications/${ids.Cuong}/files`,
      { kind: 'birth_certificate' },
      PNG,
      'khai-sinh.png',
    );
    await api('POST', '/entry-intake/transfers/arrange', principal.accessToken, {
      ids: [ids.Cuong],
      class_id: classes.NT1,
    });
    const cleared = await api('POST', '/entry-intake/transfers/run', principal.accessToken, {
      ids: [ids.Cuong],
      clear_classes: true,
    });
    assert.equal(
      (cleared.body.results as Array<{ succeeded: boolean }>)[0]?.succeeded,
      true,
      JSON.stringify(cleared.body),
    );
    const cuong = (await list('transferred')).find((item) => item.id === ids.Cuong);
    assert.equal(cuong?.planned_class_id, null);
    assert.equal(cuong?.child_status, 'pending');
  });

  it('CT-17d-9: 1.7 Hủy nhập học chỉ với hồ sơ học sinh chưa phát sinh dữ liệu; kết quả hủy theo mã GUID', async () => {
    const rows = await list('transferred');
    assert.deepEqual(rows.map((row) => row.id).sort(), [ids.An, ids.Cuong, ids.Dung].sort());
    const dung = rows.find((row) => row.id === ids.Dung);
    assert.deepEqual(
      (await list('transferred', `&guid=${dung?.transfer_guid}`)).map((row) => row.id),
      [ids.Dung],
    );
    // Dũng đã có sổ theo dõi sức khỏe hằng ngày: đã phát sinh dữ liệu
    await schoolYear
      .insertInto('daily_care_logs')
      .values({
        child_id: dung?.created_child_id ?? '',
        care_date: '2026-09-10',
        recorded_at: new Date(),
        condition_note: 'Bình thường',
        recorded_by: principal.userId,
      })
      .execute();
    assert.equal(
      (await api('POST', '/entry-intake/transfers/cancel', admissions.accessToken, { ids: [ids.An] })).status,
      403,
    );
    const cancelled = await api('POST', '/entry-intake/transfers/cancel', principal.accessToken, {
      ids: [ids.An, ids.Dung],
    });
    assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));
    const results = cancelled.body.results as Array<{ application_id: string; succeeded: boolean; note: string }>;
    assert.equal(results.find((item) => item.application_id === ids.An)?.succeeded, true);
    assert.equal(results.find((item) => item.application_id === ids.Dung)?.succeeded, false);
    assert.match(results.find((item) => item.application_id === ids.Dung)?.note ?? '', /daily_care_logs/);
    const an = (await list('transferred')).find((row) => row.id === ids.An);
    assert.equal(an?.status, 'cancelled');
    const child = await schoolYear
      .selectFrom('children')
      .select(['deleted_at', 'national_id_hash'])
      .where('id', '=', an?.created_child_id ?? '')
      .executeTakeFirstOrThrow();
    assert.ok(child.deleted_at);
    assert.match(child.national_id_hash, /^deleted:/);
    const history = await api('GET', '/entry-intake/transfers/results?kind=cancel', principal.accessToken);
    assert.equal(items(history.body).length, 2);
  });

  it('CT-17d-10: Xuất Excel theo màn hình in đủ số định danh với người có quyền, ghi nhật ký xuất; giáo viên bị chặn', async () => {
    const exported = await fetchFile(principal.accessToken, '/entry-intake/export', {
      screen: 'transferred',
      filter: {},
    });
    assert.equal(exported.status, 200);
    const sheet = await sheetRows(exported.buffer);
    assert.ok(sheet.some((row) => row.includes('Mã GUID')));
    const hasFull = sheet.some((row) => row.includes(nationalIds.Dung ?? ''));
    const hasMasked = sheet.some((row) => row.some((cell) => cell === `********${nationalIds.Dung?.slice(-4)}`));
    assert.ok(hasFull || hasMasked);
    const log = await schoolYear
      .selectFrom('export_logs')
      .select('report_code')
      .where('report_code', '=', 'entry_intake_transferred')
      .executeTakeFirst();
    assert.ok(log);
    const intake = await fetchFile(admissions.accessToken, '/entry-intake/export', {
      screen: 'intake',
      filter: { campaign_id: campaigns.general },
    });
    const intakeRows = await sheetRows(intake.buffer);
    assert.ok(intakeRows.some((row) => row.includes('Giấy tờ đã nộp')));
    assert.equal((await api('GET', '/entry-intake/applications?screen=intake', teacher.accessToken)).status, 403);
    assert.equal((await api('GET', '/entry-intake/applications?screen=bad', principal.accessToken)).status, 400);
    const template = await fetch(`${environment.baseUrl}/entry-intake/import-template`, {
      headers: { authorization: `Bearer ${admissions.accessToken}` },
    });
    assert.equal(template.status, 200);
    const templateRows = await sheetRows(Buffer.from(await template.arrayBuffer()));
    assert.deepEqual(templateRows[0], ROUTING_HEADERS);
  });
  it('CT-17d-12: Mở năm học mới chuyển đợt, hồ sơ tiếp nhận chưa xong kèm giấy tờ sang năm mới để chuyển hồ sơ tiếp', async () => {
    const created = await upload(
      admissions.accessToken,
      '/entry-intake/import',
      { campaign_id: campaigns.unitB ?? '' },
      await workbook([
        ROUTING_HEADERS,
        routingRow({ name: 'Võ Thị Em', nationalId: nextNationalId(), phone: randomPhone(), gender: 'Nữ' }),
      ]),
      'phan-tuyen.xlsx',
    );
    assert.equal(created.body.created, 1, JSON.stringify(created.body));
    const em = (await list('intake', `&campaign_id=${campaigns.unitB}`))[0];
    const attached = await upload(
      admissions.accessToken,
      `/entry-intake/applications/${em?.id}/files`,
      { kind: 'birth_certificate' },
      PNG,
      'khai-sinh.png',
    );
    assert.equal(attached.status, 201, JSON.stringify(attached.body));
    await api('PUT', `/entry-intake/campaigns/${campaigns.unitB}`, principal.accessToken, {
      program_type: 'general',
      target_academic_year_id: draftYearId,
    });
    const saved = await api('PUT', `/academic-years/${draftYearId}/calendar`, principal.accessToken, {
      first_term: { start_date: '2027-09-05', end_date: '2028-01-15' },
      second_term: { start_date: '2028-01-18', end_date: '2028-05-25' },
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const opened = await api('POST', `/academic-years/${draftYearId}/open`, principal.accessToken);
    assert.equal(opened.status, 200, JSON.stringify(opened.body));
    const row = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .where('academic_year_id', '=', draftYearId)
      .executeTakeFirstOrThrow();
    const next = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, row.database_name),
    );
    try {
      const carried = await next
        .selectFrom('admission_applications')
        .select(['id', 'status', 'source', 'routed'])
        .where('id', '=', em?.id ?? '')
        .executeTakeFirstOrThrow();
      assert.equal(carried.status, 'passed');
      assert.equal(carried.source, 'routing');
      const files = await next
        .selectFrom('admission_application_files')
        .innerJoin('files', 'files.id', 'admission_application_files.file_id')
        .select(['admission_application_files.kind', 'files.purpose'])
        .where('admission_application_files.application_id', '=', em?.id ?? '')
        .execute();
      assert.deepEqual(files, [{ kind: 'birth_certificate', purpose: 'admission_document' }]);
      // Năm học nhận trẻ nay là năm học đang mở: 1.6 đọc được hồ sơ ở năm mới
      const transfer = await list('transfer', `&campaign_id=${campaigns.unitB}`);
      assert.equal(transfer[0]?.id, em?.id);
      assert.equal(transfer[0]?.files.length, 1);
    } finally {
      await next.destroy();
    }
  });
});
