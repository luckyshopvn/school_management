import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { parseAnnouncementInput, parseAppLinks } from './portal-shell.js';

// Khung trang cổng quản trị theo Sở (DT-16 phần 16c): thông báo hệ thống, ứng dụng liên kết, ngữ cảnh trường, trang đăng
// nhập, nhắc mã định danh tổ chức theo NĐ 69, hồ sơ nhân sự cá nhân
const fieldsOf = (body: Record<string, unknown>) =>
  (((body.error ?? {}) as { details?: Array<{ field: string }> }).details ?? []).map((detail) => detail.field).sort();

function vietnamDate(offsetDays: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(
    new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000),
  );
}

describe('Kiểm tra dữ liệu thông báo hệ thống và ứng dụng liên kết', () => {
  it('CT-16c-9: thông báo cần tiêu đề, nội dung, từ ngày; đến ngày không trước từ ngày; mặc định đang bật', () => {
    assert.deepEqual(parseAnnouncementInput({ title: ' Bảo trì ', content: 'Nội dung', valid_from: '2026-10-16' }), {
      title: 'Bảo trì',
      content: 'Nội dung',
      valid_from: '2026-10-16',
      valid_until: null,
      is_active: true,
    });
    for (const body of [
      { title: '', content: 'a', valid_from: '2026-10-16' },
      { title: 'a', content: 'a', valid_from: '2026-02-30' },
      { title: 'a', content: 'a', valid_from: '2026-10-16', valid_until: '2026-10-15' },
      { title: 'a'.repeat(201), content: 'a', valid_from: '2026-10-16' },
      { title: 'a', content: 'a', valid_from: '2026-10-16', is_active: 'có' },
      undefined,
    ]) {
      assert.throws(() => parseAnnouncementInput(body), { code: 'ERR_VALIDATION' });
    }
  });

  it('CT-16c-10: ứng dụng liên kết cần tên và đường dẫn http, https; tối đa 20 mục', () => {
    assert.deepEqual(parseAppLinks({ links: [{ name: ' Ứng dụng giáo viên ', url: 'https://gv.vi-du.vn' }] }), [
      { name: 'Ứng dụng giáo viên', url: 'https://gv.vi-du.vn', description: null },
    ]);
    assert.throws(() => parseAppLinks({ links: [{ name: 'a', url: 'javascript:alert(1)' }] }), {
      code: 'ERR_VALIDATION',
    });
    assert.throws(() => parseAppLinks({ links: [{ name: '', url: 'https://a.vn' }] }), { code: 'ERR_VALIDATION' });
    assert.throws(
      () => parseAppLinks({ links: Array.from({ length: 21 }, () => ({ name: 'a', url: 'https://a.vn' })) }),
      {
        code: 'ERR_VALIDATION',
      },
    );
    assert.throws(() => parseAppLinks({}), { code: 'ERR_VALIDATION' });
  });
});

describe('Điểm cuối khung trang cổng quản trị', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let teacher: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  const url = (path: string) => `${environment.baseUrl}${path}`;

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    teacher = await environment.loginAs('VT-07', null);
  });

  after(async () => {
    await schoolYear?.destroy();
    await environment.close();
  });

  it('CT-16c-11: trước khi có năm học, trang đăng nhập và ngữ cảnh không có tên trường; chưa đăng nhập bị từ chối', async () => {
    const info = await sendJson('GET', url('/public/login-info'), undefined);
    assert.equal(info.status, 200);
    assert.deepEqual(info.body, { school_name: null, school_code: null, academic_year: null });
    assert.equal((await sendJson('GET', url('/portal-context'), undefined)).status, 401);
    assert.equal((await sendJson('GET', url('/system-announcements/active'), undefined)).status, 401);
    assert.equal((await sendJson('GET', url('/app-links'), undefined)).status, 401);
  });

  it('CT-16c-12: Hiệu trưởng soạn, sửa, xóa thông báo; mọi người chỉ thấy thông báo đang bật và còn hiệu lực', async () => {
    const create = (body: Record<string, unknown>, token = principal.accessToken) =>
      sendJson('POST', url('/system-announcements'), token, body);
    assert.equal(
      (await create({ title: 'Không có quyền', content: 'a', valid_from: vietnamDate(0) }, teacher.accessToken)).status,
      403,
    );
    const invalid = await create({ title: '', content: '', valid_from: 'hôm nay' });
    assert.equal(invalid.status, 400);
    assert.deepEqual(fieldsOf(invalid.body), ['content', 'title', 'valid_from']);

    const current = await create({ title: 'Bảo trì hệ thống', content: 'Tối thứ Bảy', valid_from: vietnamDate(-1) });
    assert.equal(current.status, 201);
    assert.equal(current.body.created_by, principal.userId);
    const future = await create({ title: 'Sắp tới', content: 'a', valid_from: vietnamDate(3) });
    const expired = await create({
      title: 'Đã hết hạn',
      content: 'a',
      valid_from: vietnamDate(-5),
      valid_until: vietnamDate(-1),
    });
    const hidden = await create({ title: 'Đang tắt', content: 'a', valid_from: vietnamDate(0), is_active: false });
    for (const response of [future, expired, hidden]) {
      assert.equal(response.status, 201);
    }

    const active = await sendJson('GET', url('/system-announcements/active'), teacher.accessToken);
    assert.equal(active.status, 200);
    assert.deepEqual(
      (active.body as unknown as Array<{ title: string }>).map((item) => item.title),
      ['Bảo trì hệ thống'],
    );
    assert.equal((await sendJson('GET', url('/system-announcements'), teacher.accessToken)).status, 403);
    const all = await sendJson('GET', url('/system-announcements'), principal.accessToken);
    assert.equal((all.body as unknown as unknown[]).length, 4);

    const updated = await sendJson(
      'PUT',
      url(`/system-announcements/${hidden.body.id as string}`),
      principal.accessToken,
      {
        title: 'Đã bật',
        content: 'b',
        valid_from: vietnamDate(0),
        valid_until: vietnamDate(0),
      },
    );
    assert.equal(updated.status, 200);
    assert.equal(updated.body.is_active, true);
    const afterUpdate = await sendJson('GET', url('/system-announcements/active'), teacher.accessToken);
    assert.equal((afterUpdate.body as unknown as unknown[]).length, 2);

    assert.equal(
      (await sendJson('DELETE', url(`/system-announcements/${current.body.id as string}`), teacher.accessToken)).status,
      403,
    );
    assert.equal(
      (await sendJson('DELETE', url(`/system-announcements/${current.body.id as string}`), principal.accessToken))
        .status,
      204,
    );
    assert.equal(
      (await sendJson('DELETE', url(`/system-announcements/${current.body.id as string}`), principal.accessToken))
        .status,
      404,
    );
  });

  it('CT-16c-13: ứng dụng liên kết do quản trị cấu hình, mọi người đọc theo thứ tự', async () => {
    const links = [
      { name: 'Ứng dụng giáo viên', url: 'https://giao-vien.vi-du.vn', description: 'Điểm danh, nhật ký lớp' },
      { name: 'Ứng dụng phụ huynh', url: 'https://phu-huynh.vi-du.vn' },
    ];
    assert.equal((await sendJson('PUT', url('/app-links'), teacher.accessToken, { links })).status, 403);
    const invalid = await sendJson('PUT', url('/app-links'), principal.accessToken, {
      links: [{ name: 'Sai', url: 'ftp://a.vn' }],
    });
    assert.deepEqual(fieldsOf(invalid.body), ['links[0].url']);
    const saved = await sendJson('PUT', url('/app-links'), principal.accessToken, { links });
    assert.equal(saved.status, 200);
    const read = await sendJson('GET', url('/app-links'), teacher.accessToken);
    assert.deepEqual(
      (read.body as unknown as Array<{ name: string; position: number; description: string | null }>).map((link) => [
        link.name,
        link.position,
        link.description,
      ]),
      [
        ['Ứng dụng giáo viên', 0, 'Điểm danh, nhật ký lớp'],
        ['Ứng dụng phụ huynh', 1, null],
      ],
    );
    assert.equal((await sendJson('PUT', url('/app-links'), principal.accessToken, { links: [] })).status, 200);
    assert.deepEqual((await sendJson('GET', url('/app-links'), teacher.accessToken)).body, []);
  });

  it('CT-16c-14: có năm học thì trang đăng nhập hiện tên, mã trường; người cập nhật hồ sơ trường được nhắc mã NĐ 69', async () => {
    const yearId = await openTestAcademicYear(environment, principal.accessToken, '2026-2027', {
      first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    });
    const yearDatabase = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .where('academic_year_id', '=', yearId)
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, yearDatabase.database_name),
    );
    const root = await sendJson('POST', url('/org-units'), principal.accessToken, {
      code: 'MN-HOA-MAI',
      name: 'Trường Mầm non Hoa Mai',
      unit_type: 'truong_chinh',
    });
    assert.equal(root.status, 201, JSON.stringify(root.body));

    const info = await sendJson('GET', url('/public/login-info'), undefined);
    assert.deepEqual(info.body, {
      school_name: 'Trường Mầm non Hoa Mai',
      school_code: 'MN-HOA-MAI',
      academic_year: '2026-2027',
    });
    const context = await sendJson('GET', url('/portal-context'), principal.accessToken);
    assert.deepEqual(context.body, {
      school_name: 'Trường Mầm non Hoa Mai',
      school_code: 'MN-HOA-MAI',
      academic_year: '2026-2027',
      education_level: 'Cấp MN',
      organization_id_reminder: true,
    });
    const teacherContext = await sendJson('GET', url('/portal-context'), teacher.accessToken);
    assert.equal(teacherContext.body.organization_id_reminder, false);

    const wrong = await sendJson('PUT', url('/school-profile'), principal.accessToken, {
      general: { electronic_id_code: '12345' },
    });
    assert.equal(wrong.status, 400);
    assert.deepEqual(fieldsOf(wrong.body), ['general.electronic_id_code']);
    const saved = await sendJson('PUT', url('/school-profile'), principal.accessToken, {
      general: { electronic_id_code: '079123456789', moet_code: '79000101' },
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const updated = await sendJson('GET', url('/portal-context'), principal.accessToken);
    assert.equal(updated.body.organization_id_reminder, false);
    assert.equal(updated.body.school_code, '79000101');
  });

  it('CT-16c-15: người dùng tự sửa thông tin liên hệ trên hồ sơ nhân sự của mình, có ghi nhật ký', async () => {
    assert.equal(
      (await sendJson('PATCH', url('/staff/me/contact'), teacher.accessToken, { phone: '0901234567' })).status,
      404,
    );
    const unit = await schoolYear
      .selectFrom('org_units')
      .select('id')
      .where('unit_type', '=', 'truong_chinh')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('staff')
      .values({
        org_unit_id: unit.id,
        code: 'NV-16C',
        full_name: 'Giáo viên kiểm thử',
        start_date: '2026-08-01',
        user_id: teacher.userId,
      })
      .execute();
    const invalid = await sendJson('PATCH', url('/staff/me/contact'), teacher.accessToken, {
      phone: '12ab',
      email: 'khong-phai-thu',
    });
    assert.deepEqual(fieldsOf(invalid.body), ['email', 'phone']);
    const saved = await sendJson('PATCH', url('/staff/me/contact'), teacher.accessToken, {
      phone: '0901234567',
      email: 'gv.kiemthu@vi-du.vn',
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.phone, '0901234567');
    assert.equal(saved.body.email, 'gv.kiemthu@vi-du.vn');
    assert.equal(saved.body.address, null);
    const log = await schoolYear
      .selectFrom('audit_logs')
      .select(['actor_user_id', 'after_data'])
      .where('entity_name', '=', 'staff')
      .where('actor_user_id', '=', teacher.userId)
      .executeTakeFirstOrThrow();
    assert.deepEqual(log.after_data, { phone: '0901234567', email: 'gv.kiemthu@vi-du.vn' });
  });
});
