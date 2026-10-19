import assert from 'node:assert/strict';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import ExcelJS from 'exceljs';
import type { Kysely } from 'kysely';
import { ChildDataProtection } from '../common/child-data-protection.js';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';

// DT-17 phần 17b (YCTD-133): kí hồ sơ theo bốn mẫu thật của Sở, tệp dữ liệu XML, danh sách nhà phát hành, kiểu chữ ký,
// quyền xem số định danh với hồ sơ nhân sự, học sinh. Kịch bản CT-17b-1 đến CT-17b-8. Dữ liệu là dữ liệu giả
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const STAFF_ID = '079090001234';
const INSURANCE = '7900123456';
const CHILD_ID = `079${String(Date.now() % 1_000_000).padStart(6, '0')}${randomInt(100, 999)}`;
const CITIZEN_ID = '079321009876';
const randomPhone = () => `09${randomInt(0, 100_000_000).toString().padStart(8, '0')}`;
const errorOf = (body: Record<string, unknown>) =>
  (body.error ?? {}) as { code?: string; rule_code?: string; details?: Array<{ field: string; message: string }> };
const sha256 = (body: Buffer) => createHash('sha256').update(body).digest('hex');

interface Item {
  key: string;
  label: string;
  value: string;
}
interface Section {
  key: string;
  title: string;
  items?: Item[];
  table?: { columns: Array<{ key: string; label: string }>; rows: Array<Record<string, string>> };
}
interface ObjectRow {
  object_id: string;
  object_label: string;
  code: string | null;
  principal_name: string | null;
  stage: string | null;
  dob: string | null;
  person_status: string | null;
  job_position: string | null;
  class_name: string | null;
  create_error: string | null;
  dossier: null | {
    id: string;
    code: string;
    status: string;
    xml_file_name: string | null;
    xml_sha256: string | null;
    note: string | null;
    change_summary: string | null;
  };
}

describe('Kí hồ sơ theo bốn mẫu của Sở (DT-17 phần 17b)', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let clerk: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let protection: ChildDataProtection;
  let classId = '';
  let childId = '';
  let staffId = '';
  let incompleteStaffId = '';
  let clerkRoleId = '';
  const units: Record<string, string> = {};

  const api = (method: string, path: string, token: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, token, body);
  const objects = async (type: string, token = principal.accessToken) => {
    const response = await api('GET', `/signing/objects?object_type=${type}`, token);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    return response.body.items as ObjectRow[];
  };
  const rowOf = async (type: string, objectId: string) =>
    (await objects(type)).find((row) => row.object_id === objectId);
  async function download(path: string, token = principal.accessToken) {
    const response = await fetch(`${environment.baseUrl}${path}`, { headers: { authorization: `Bearer ${token}` } });
    return { status: response.status, body: Buffer.from(await response.arrayBuffer()), headers: response.headers };
  }
  const create = (type: string, ids: string[], token = principal.accessToken, note?: string) =>
    api('POST', '/signing/dossiers', token, { object_type: type, object_ids: ids, ...(note ? { note } : {}) });
  const view = async (id: string, token = principal.accessToken) => api('GET', `/signing/dossiers/${id}/view`, token);
  const itemsOf = (section: Section | undefined) =>
    Object.fromEntries((section?.items ?? []).map((item) => [item.label, item.value]));

  async function createChild(fullName: string) {
    const form = new FormData();
    form.set('org_unit_id', units.TC ?? '');
    form.set('purpose', 'birth_certificate');
    form.set('file', new Blob([PNG]), 'giay-khai-sinh.png');
    const file = (await (
      await fetch(`${environment.baseUrl}/files`, {
        method: 'POST',
        headers: { authorization: `Bearer ${principal.accessToken}` },
        body: form,
      })
    ).json()) as { id: string };
    const relationships: Record<string, string> = {};
    for (const [code, name] of [
      ['CHA', 'Cha'],
      ['ME', 'Mẹ'],
    ] as const) {
      const created = await api('POST', '/catalog-items', principal.accessToken, {
        catalog_type: 'parent_relationship',
        code: `${code}${randomInt(100, 999)}`,
        name,
      });
      relationships[code] = created.body.id as string;
    }
    const created = await api('POST', '/children', principal.accessToken, {
      org_unit_id: units.TC,
      full_name: fullName,
      dob: '2021-03-04',
      gender: 'female',
      national_id: CHILD_ID,
      birth_certificate_file_id: file.id,
      photo_consent: 'pending',
      health: { has_allergies: false },
      guardians: [
        { full_name: 'Mẹ Thử Nghiệm', phone: randomPhone(), relationship_item_id: relationships.ME, is_primary: true },
        { full_name: 'Cha Thử Nghiệm', phone: randomPhone(), relationship_item_id: relationships.CHA },
      ],
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    return created.body.id as string;
  }

  async function insertStaff(code: string, fullName: string, withDob: boolean) {
    const row = await schoolYear
      .insertInto('staff')
      .values({
        org_unit_id: units.TC ?? '',
        code,
        full_name: fullName,
        dob: withDob ? '1990-05-01' : null,
        gender: 'female',
        start_date: '2020-08-01',
        id_number_encrypted: protection.encrypt(STAFF_ID),
        id_number_last4: STAFF_ID.slice(-4),
        moet_profile: JSON.stringify({
          staff_status: 'Đang làm việc',
          job_position: 'Giáo viên mẫu giáo',
          ethnicity: 'Kinh',
          party_member: true,
          permanent_province: 'Thành phố Hồ Chí Minh',
          salary_coefficient: '2,34',
          main_foreign_language: 'Tiếng Anh',
          language_framework_level: 'Bậc 3',
          social_insurance_number_encrypted: protection.encrypt(INSURANCE),
          social_insurance_number_last4: INSURANCE.slice(-4),
        }),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return row.id;
  }

  before(async () => {
    environment = await startApiTestEnvironment();
    protection = environment.api.get(ChildDataProtection);
    principal = await environment.loginAs('VT-02', null);
    // Vai trò thử chỉ có quyền xem, lập hồ sơ kí, không có quyền xem số định danh
    const role = await environment.identity.database
      .insertInto('roles')
      .values({ code: `KT17B-${randomUUID().slice(0, 8)}`, name: 'Văn thư kiểm thử 17b' })
      .returning(['id', 'code'])
      .executeTakeFirstOrThrow();
    clerkRoleId = role.id;
    const permissions = await environment.identity.database
      .selectFrom('permissions')
      .select('id')
      .where('code', 'in', ['P01.signing.view', 'P01.signing.manage'])
      .execute();
    await environment.identity.database
      .insertInto('role_permissions')
      .values(permissions.map((permission) => ({ role_id: role.id, permission_id: permission.id })))
      .execute();
    clerk = await environment.loginAs(role.code, null);
    const yearId = await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
      first_term: { start_date: '2026-09-07', end_date: '2027-01-15' },
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
    const root = await api('POST', '/org-units', principal.accessToken, {
      code: 'TC',
      name: 'Trường Mầm non Mẫu Sở',
      unit_type: 'truong_chinh',
      address: '1 Đường Thử Nghiệm',
    });
    units.TC = root.body.id as string;
    const point = await api('POST', '/org-units', principal.accessToken, {
      code: 'DT1',
      name: 'Điểm trường Hoa Cúc',
      unit_type: 'diem_truong',
      parent_id: units.TC,
      address: '2 Đường Thử Nghiệm',
      area_m2: 450,
      distance_km: 1.5,
    });
    assert.equal(point.status, 201, JSON.stringify(point.body));
    await schoolYear
      .insertInto('school_profiles')
      .values({
        org_unit_id: units.TC,
        general: JSON.stringify({
          moet_code: '79000001',
          principal_name: 'Hiệu Trưởng Mẫu',
          email: 'truong@example.test',
          website: 'https://truong.example.test',
          ownership_type: 'public',
          land_area_m2: 2500,
        }),
        other_info: JSON.stringify({ grid_electricity: true, has_internet: false, party_cell: true }),
        foreign_elements: JSON.stringify({}),
        internet: JSON.stringify({}),
        it_infrastructure: JSON.stringify({}),
        office_accounts: JSON.stringify([]),
        updated_by: principal.userId,
      })
      .execute();
    await api('POST', '/grade-levels', principal.accessToken, {
      code: 'LA',
      name: 'Lá',
      age_from_months: 60,
      age_to_months: 71,
    });
    const created = await api('POST', '/classes', principal.accessToken, {
      org_unit_id: units.TC,
      code: 'LA1',
      name: 'Lớp Lá 1',
      grade_level: 'LA',
      max_size: 25,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    classId = created.body.id as string;
    childId = await createChild('Học Sinh Mẫu Sở');
    await schoolYear
      .updateTable('children')
      .set({
        status: 'active',
        moet_profile: JSON.stringify({
          ethnicity: 'Kinh',
          nationality: 'Việt Nam',
          citizen_id_encrypted: protection.encrypt(CITIZEN_ID),
          citizen_id_last4: CITIZEN_ID.slice(-4),
          hometown_province: 'Tỉnh Thử Nghiệm',
        }),
      })
      .where('id', '=', childId)
      .execute();
    await schoolYear
      .insertInto('class_enrollments')
      .values({ child_id: childId, class_id: classId, from_date: '2026-09-07', to_date: null, reason: null })
      .execute();
    staffId = await insertStaff('NS01', 'Giáo Viên Mẫu', true);
    incompleteStaffId = await insertStaff('NS02', 'Giáo Viên Thiếu Ngày Sinh', false);
    await schoolYear
      .insertInto('staff_certificates')
      .values({
        staff_id: staffId,
        name: 'Bồi dưỡng thường xuyên',
        issued_by: 'Phòng GD&ĐT',
        issued_date: '2025-07-01',
        created_by: principal.userId,
      })
      .execute();
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.identity.database.deleteFrom('user_roles').where('role_id', '=', clerkRoleId).execute();
    await environment.identity.database.deleteFrom('role_permissions').where('role_id', '=', clerkRoleId).execute();
    await environment.identity.database.deleteFrom('roles').where('id', '=', clerkRoleId).execute();
    await environment.close();
  });

  it('CT-17b-1: chứng thư số: kiểu chữ ký hai giá trị, nhà phát hành trong năm giá trị; giá trị cũ ngoài danh sách phải chọn lại; 1.1 hiện thông tin trường và lịch sử đăng ký', async () => {
    const hsm = await api('PUT', '/signing/certificate', principal.accessToken, { signature_type: 'hsm' });
    assert.equal(hsm.status, 400);
    const other = await api('PUT', '/signing/certificate', principal.accessToken, {
      signature_type: 'remote',
      provider: 'Nhà cung cấp khác',
    });
    assert.equal(other.status, 400);
    assert.ok(errorOf(other.body).details?.some((detail) => detail.field === 'provider'));
    const saved = await api('PUT', '/signing/certificate', principal.accessToken, {
      signature_type: 'usb_token',
      provider: 'BkavCA',
      login_name: 'truong-mau',
      holder_name: 'Hiệu Trưởng Mẫu',
      valid_to: '2099-12-31',
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.deepEqual(saved.body.school, {
      code: '79000001',
      name: 'Trường Mầm non Mẫu Sở',
      principal_name: 'Hiệu Trưởng Mẫu',
      email: 'truong@example.test',
      website: 'https://truong.example.test',
    });
    // Nhà phát hành nhập tự do ở bản 16k
    await environment.system.updateTable('signing_certificates').set({ provider: 'CA cũ' }).execute();
    const legacy = await api('GET', '/signing/certificate', principal.accessToken);
    assert.equal(legacy.body.provider, 'CA cũ');
    assert.equal(legacy.body.provider_in_list, false);
    const refused = await api('POST', '/signing/certificate/register', principal.accessToken, {});
    assert.equal(refused.status, 422);
    assert.equal(errorOf(refused.body).rule_code, 'YCTD-133');
    await api('PUT', '/signing/certificate', principal.accessToken, {
      signature_type: 'remote',
      provider: 'VNPT-CA',
      login_name: 'truong-mau',
      holder_name: 'Hiệu Trưởng Mẫu',
      valid_to: '2099-12-31',
    });
    const registered = await api('POST', '/signing/certificate/register', principal.accessToken, {
      reason: 'Đăng ký lần đầu',
    });
    assert.equal(registered.status, 200, JSON.stringify(registered.body));
    const event = (registered.body.events as Array<{ action: string; note: string }>).find(
      (item) => item.action === 'certificate_register',
    );
    assert.equal(event?.note, 'REMOTE SIGNING – VNPT-CA – truong-mau – Đăng ký lần đầu');
  });

  it('CT-17b-2: hồ sơ trường: phần "Thông tin chung" theo mục của Sở, mỗi điểm trường một phần; tệp XML gốc HO_SO_TRUONG kèm mã băm', async () => {
    const [school] = await objects('school');
    assert.equal(school?.code, '79000001');
    assert.equal(school?.principal_name, 'Hiệu Trưởng Mẫu');
    const created = await create('school', [units.TC ?? ''], principal.accessToken, 'Nộp lần đầu');
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const row = await rowOf('school', units.TC ?? '');
    assert.equal(row?.dossier?.status, 'created');
    assert.equal(row?.dossier?.note, 'Nộp lần đầu');
    const shown = await view(row?.dossier?.id ?? '');
    assert.equal(shown.status, 200, JSON.stringify(shown.body));
    assert.equal(shown.body.root, 'HO_SO_TRUONG');
    assert.equal(shown.body.signature, null);
    const sections = (shown.body.document as { sections: Section[] }).sections;
    assert.deepEqual(
      sections.map((section) => section.title),
      ['Thông tin chung', 'Thông tin điểm trường: Điểm trường Hoa Cúc'],
    );
    const general = sections[0]?.items ?? [];
    assert.deepEqual(
      general.slice(0, 4).map((item) => item.label),
      ['Tên trường', 'Mã trường', 'Mã định danh tổ chức (NĐ 69)', 'Điện thoại'],
    );
    assert.equal(general.length, 32);
    const values = itemsOf(sections[0]);
    assert.equal(values['Loại hình trường'], 'Công lập');
    assert.equal(values['Chi bộ đảng'], 'Có');
    assert.equal(values['Kết nối Internet'], 'Không');
    assert.equal(values['Diện tích (m²)'], '2.500');
    assert.equal(itemsOf(sections[1])['Diện tích (m²)'], '450');
    assert.equal(itemsOf(sections[1])['Khoảng cách đến trường chính (km)'], '1,5');
    const xml = await download(`/signing/dossiers/${row?.dossier?.id}/file?version=xml`);
    assert.equal(xml.status, 200);
    assert.match(xml.headers.get('content-type') ?? '', /application\/xml/);
    assert.equal(sha256(xml.body), row?.dossier?.xml_sha256);
    const text = xml.body.toString('utf8');
    assert.match(text, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<HO_SO_TRUONG ma_dinh_danh_ho_so="KHS-\d{6}"/);
    assert.match(text, /<TEN_TRUONG nhan="Tên trường">Trường Mầm non Mẫu Sở<\/TEN_TRUONG>/);
    assert.match(text, /<DIEN_TICH_M2 nhan="Diện tích \(m²\)">2\.500<\/DIEN_TICH_M2>/);
    assert.match(text, /<THONG_TIN_DIEM_TRUONG_1 ten="Thông tin điểm trường: Điểm trường Hoa Cúc">/);
  });

  it('CT-17b-3: hồ sơ lớp: thông tin lớp và các ô chương trình, không có danh sách học sinh, giáo viên; khối theo nhóm lớp', async () => {
    const row = await rowOf('class', classId);
    assert.equal(row?.stage, 'mau_giao');
    assert.equal((await create('class', [classId])).status, 201);
    const shown = await view((await rowOf('class', classId))?.dossier?.id ?? '');
    assert.equal(shown.body.root, 'HO_SO_LOP');
    const sections = (shown.body.document as { sections: Section[] }).sections;
    assert.deepEqual(
      sections.map((section) => section.title),
      ['Thông tin lớp'],
    );
    const values = itemsOf(sections[0]);
    assert.equal(values['Khối'], 'Lớp mẫu giáo');
    assert.equal(values['Mã trường'], '79000001');
    assert.equal(values['Lớp ghép'], 'Không');
    assert.ok(!JSON.stringify(shown.body.document).includes('Học Sinh Mẫu Sở'));
  });

  it('CT-17b-4: hồ sơ nhân sự mười hai phần, in đủ số CCCD, sổ BHXH; thiếu ngày sinh thì không tạo, ghi lý do và tải file lỗi', async () => {
    const listed = await rowOf('staff', staffId);
    assert.equal(listed?.dob, '1990-05-01');
    assert.equal(listed?.person_status, 'Đang làm việc');
    assert.equal(listed?.job_position, 'Giáo viên mẫu giáo');
    const created = await create('staff', [staffId, incompleteStaffId]);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.created, 1);
    assert.deepEqual(
      (created.body.errors as Array<{ object_id: string; reason: string }>).map((error) => [
        error.object_id,
        error.reason,
      ]),
      [[incompleteStaffId, 'Thiếu mục bắt buộc: Ngày sinh']],
    );
    assert.equal((await rowOf('staff', incompleteStaffId))?.create_error, 'Thiếu mục bắt buộc: Ngày sinh');
    const onlyIncomplete = await create('staff', [incompleteStaffId]);
    assert.equal(onlyIncomplete.status, 422);
    assert.equal(errorOf(onlyIncomplete.body).rule_code, 'YCTD-133');
    const errorFile = await download('/signing/create-errors/file?object_type=staff');
    assert.equal(errorFile.status, 200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(errorFile.body as unknown as ArrayBuffer);
    const sheet = workbook.worksheets[0];
    const cells = (sheet?.getRows(1, sheet.rowCount) ?? []).map((row) => (row.values as unknown[]).slice(1));
    assert.ok(cells.some((row) => row[0] === 'Giáo Viên Thiếu Ngày Sinh' && row[1] === 'Thiếu mục bắt buộc: Ngày sinh'));

    const shown = await view((await rowOf('staff', staffId))?.dossier?.id ?? '');
    assert.equal(shown.body.root, 'HO_SO_NHAN_SU');
    const sections = (shown.body.document as { sections: Section[] }).sections;
    assert.deepEqual(
      sections.map((section) => section.title),
      [
        'Thông tin chung',
        'Vị trí việc làm, tiêu chuẩn chức danh',
        'Phụ cấp',
        'Quy trình đào tạo',
        'Đánh giá, phân loại',
        'Đánh giá chuẩn nghề nghiệp',
        'Quá trình lương',
        'Quá trình bồi dưỡng',
        'Quá trình ngoại ngữ',
        'Quá trình khen thưởng',
        'Quan hệ gia đình',
        'Quá trình công tác',
      ],
    );
    const general = itemsOf(sections[0]);
    assert.equal(general['Số CMND/CCCD'], STAFF_ID);
    assert.equal(general['Số định danh cá nhân'], STAFF_ID);
    assert.equal(general['Số sổ BHXH'], INSURANCE);
    assert.equal(general['Đảng viên'], 'Có');
    assert.equal(itemsOf(sections[2])['Hệ số lương'], '2,34');
    assert.deepEqual(sections[7]?.table?.rows.map((row) => row.NOI_DUNG_BOI_DUONG), ['Bồi dưỡng thường xuyên']);
    assert.deepEqual(sections[8]?.table?.rows.map((row) => row.KHUNG_NANG_LUC), ['Bậc 3']);
    const xml = (await download(`/signing/dossiers/${(await rowOf('staff', staffId))?.dossier?.id}/file?version=xml`))
      .body.toString('utf8');
    assert.match(xml, /<HO_SO_NHAN_SU /);
    assert.match(xml, new RegExp(`<SO_CMND_CCCD nhan="Số CMND/CCCD">${STAFF_ID}</SO_CMND_CCCD>`));
    assert.match(xml, /<QUA_TRINH_BOI_DUONG ten="Quá trình bồi dưỡng">\n {4}<DONG stt="1">/);
  });

  it('CT-17b-5: hồ sơ học sinh hai phần, in đủ số định danh, CCCD; thông tin gia đình theo quan hệ cha, mẹ', async () => {
    const listed = await rowOf('child', childId);
    assert.equal(listed?.class_name, 'Lớp Lá 1');
    assert.equal(listed?.person_status, 'Đang học');
    assert.equal(listed?.stage, 'mau_giao');
    assert.equal((await create('child', [childId])).status, 201);
    const shown = await view((await rowOf('child', childId))?.dossier?.id ?? '');
    assert.equal(shown.body.root, 'HO_SO_HOC_SINH');
    const sections = (shown.body.document as { sections: Section[] }).sections;
    assert.deepEqual(
      sections.map((section) => section.title),
      ['Thông tin chung', 'Thông tin gia đình'],
    );
    const general = itemsOf(sections[0]);
    assert.equal(general['Số định danh cá nhân'], CHILD_ID);
    assert.equal(general['Số CMND/CCCD'], CITIZEN_ID);
    assert.equal(general['Khối'], 'Lớp mẫu giáo');
    assert.equal(general['Tên lớp'], 'Lớp Lá 1');
    assert.equal(general['Quê quán – tỉnh/thành phố'], 'Tỉnh Thử Nghiệm');
    const family = itemsOf(sections[1]);
    assert.equal(family['Họ tên cha'], 'Cha Thử Nghiệm');
    assert.equal(family['Họ tên mẹ'], 'Mẹ Thử Nghiệm');
    assert.equal(family['Họ tên người đỡ đầu'], '');
    const logs = await schoolYear
      .selectFrom('export_logs')
      .select(['report_code', 'contains_personal_data'])
      .where('report_code', '=', 'signing-dossier-view')
      .execute();
    assert.ok(logs.length >= 2);
    assert.ok(logs.every((log) => log.contains_personal_data));
  });

  it('CT-17b-6: người không có quyền xem số định danh không tạo, xem, tải, tải thông tin thay đổi được hồ sơ nhân sự, học sinh; hồ sơ trường, lớp vẫn được; nội dung thay đổi không ghi số định danh', async () => {
    assert.equal((await create('staff', [staffId], clerk.accessToken)).status, 403);
    assert.equal((await create('child', [childId], clerk.accessToken)).status, 403);
    const staffDossier = (await rowOf('staff', staffId))?.dossier?.id ?? '';
    assert.equal((await view(staffDossier, clerk.accessToken)).status, 403);
    assert.equal((await download(`/signing/dossiers/${staffDossier}/file`, clerk.accessToken)).status, 403);
    assert.equal((await download(`/signing/dossiers/${staffDossier}/file?version=xml`, clerk.accessToken)).status, 403);
    const check = await api('POST', '/signing/dossiers/check-changes', clerk.accessToken, { ids: [staffDossier] });
    assert.equal(check.status, 403);
    const schoolDossier = (await rowOf('school', units.TC ?? ''))?.dossier?.id ?? '';
    assert.equal((await view(schoolDossier, clerk.accessToken)).status, 200);
    assert.equal((await download(`/signing/dossiers/${schoolDossier}/file`, clerk.accessToken)).status, 200);
    // Danh sách nhân sự vẫn xem được (họ tên, ngày sinh) để biết trạng thái hồ sơ
    assert.equal((await objects('staff', clerk.accessToken)).length, 2);

    const changedId = '079090009999';
    await schoolYear
      .updateTable('staff')
      .set({ id_number_encrypted: protection.encrypt(changedId), id_number_last4: changedId.slice(-4) })
      .where('id', '=', staffId)
      .execute();
    const changed = await api('POST', '/signing/dossiers/check-changes', principal.accessToken, {
      ids: [staffDossier],
    });
    const summary = (changed.body.items as Array<{ change_summary: string }>)[0]?.change_summary ?? '';
    assert.match(summary, /Số CMND\/CCCD: đã thay đổi/);
    assert.ok(!summary.includes(STAFF_ID) && !summary.includes(changedId));
  });

  it('CT-17b-7: xem hồ sơ đã kí có khung "Thông tin chữ ký số": người kí, thời điểm, chứng thư, mã băm tệp gốc và tệp đã kí', async () => {
    const dossier = (await rowOf('class', classId))?.dossier;
    const signed = await api('POST', '/signing/dossiers/sign', principal.accessToken, { ids: [dossier?.id] });
    assert.equal(signed.status, 200, JSON.stringify(signed.body));
    const shown = await view(dossier?.id ?? '');
    const signature = shown.body.signature as Record<string, unknown>;
    assert.equal(signature.method, 'internal');
    assert.equal(signature.digital, false);
    assert.equal(signature.signature_type, 'remote');
    assert.equal(signature.provider, 'VNPT-CA');
    assert.equal(signature.holder_name, 'Hiệu Trưởng Mẫu');
    assert.ok(signature.signed_by_name);
    assert.match(String(signature.original_sha256), /^[0-9a-f]{64}$/);
    assert.match(String(signature.signed_sha256), /^[0-9a-f]{64}$/);
    assert.equal(shown.body.xml_schema, 'school-management/ho-so-ki/1');
    // Nhà phát hành ngoài danh sách thì không kí được dù đã đăng ký từ trước
    const other = (await rowOf('school', units.TC ?? ''))?.dossier?.id;
    await environment.system.updateTable('signing_certificates').set({ provider: 'CA cũ' }).execute();
    const refused = await api('POST', '/signing/dossiers/sign', principal.accessToken, { ids: [other] });
    assert.equal(refused.status, 422);
    assert.equal(errorOf(refused.body).rule_code, 'YCTD-133');
    await environment.system.updateTable('signing_certificates').set({ provider: 'VNPT-CA' }).execute();
  });

  it('CT-17b-8: hồ sơ lập trước 17b (chỉ có bảng PDF, không có tệp XML) vẫn xem được; tải XML báo lỗi; tải thông tin thay đổi báo mẫu cũ', async () => {
    const academicYearId = (
      await environment.system
        .selectFrom('signing_dossiers')
        .select('academic_year_id')
        .where('object_id', '=', classId)
        .executeTakeFirstOrThrow()
    ).academic_year_id;
    const old = await environment.system
      .insertInto('signing_dossiers')
      .values({
        academic_year_id: academicYearId,
        code: `KHS-OLD-${randomInt(1000, 9999)}`,
        object_type: 'class_log',
        object_id: classId,
        period: '2026-09',
        object_label: 'Lớp Lá 1 – tháng 09/2026',
        snapshot: JSON.stringify({
          title: 'Sổ đầu bài: Lớp Lá 1 – tháng 09/2026',
          sheets: [
            {
              title: 'Thông tin',
              columns: [
                { key: 'item', label: 'Mục' },
                { key: 'value', label: 'Nội dung' },
              ],
              rows: [{ item: 'Tên lớp', value: 'Lớp Lá 1' }],
            },
          ],
        }),
        content_hash: 'cu',
        file_name: 'cu.pdf',
        storage_key: 'signing-dossier/khong-co',
        file_sha256: 'cu',
        size_bytes: 1,
        created_by: principal.userId,
        created_by_name: 'Người lập cũ',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const shown = await view(old.id);
    assert.equal(shown.status, 200, JSON.stringify(shown.body));
    const sections = (shown.body.document as { root: string; sections: Section[] }).sections;
    assert.equal(itemsOf(sections[0])['Tên lớp'], 'Lớp Lá 1');
    const xml = await download(`/signing/dossiers/${old.id}/file?version=xml`);
    assert.equal(xml.status, 422);
    const checked = await api('POST', '/signing/dossiers/check-changes', principal.accessToken, { ids: [old.id] });
    assert.match(
      (checked.body.items as Array<{ change_summary: string }>)[0]?.change_summary ?? '',
      /Hồ sơ lập theo mẫu cũ/,
    );
  });
});
