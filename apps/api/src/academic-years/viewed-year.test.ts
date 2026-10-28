import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { VIEWED_ACADEMIC_YEAR_HEADER, translateViewedYearError } from '../common/viewed-school-year.js';
import { openTestAcademicYear, sendJson, startApiTestEnvironment, type ApiTestEnvironment } from '../test-support.js';

type Row = Record<string, unknown>;

// Xem năm học đã đóng ở cổng quản trị (BC-09, YCTD-342): yêu cầu đọc kèm tiêu đề năm học đang xem đọc cơ sở dữ liệu năm đó;
// yêu cầu ghi kèm năm đã đóng bị từ chối; quyền vẫn kiểm như thường
describe('Xem năm học đã đóng', () => {
  let environment: ApiTestEnvironment;
  let principal: string;
  let teacher: string;
  let oldYearId = '';
  let currentYearId = '';
  let draftYearId = '';
  let unitId = '';

  const call = async (method: string, path: string, accessToken: string, yearId?: string, body?: unknown) => {
    const response = await fetch(`${environment.baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${accessToken}`,
        ...(yearId !== undefined ? { [VIEWED_ACADEMIC_YEAR_HEADER]: yearId } : {}),
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    return { status: response.status, body: (text ? JSON.parse(text) : null) as Row & Row[] };
  };
  const codes = (rows: Row[]) => rows.map((row) => row.code).sort();
  const ruleOf = (body: Row) => (body.error as { rule_code?: string } | undefined)?.rule_code;

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = (await environment.loginAs('VT-02', null)).accessToken;
    oldYearId = await openTestAcademicYear(environment, principal, '2025–2026', {
      first_term: { start_date: '2025-09-05', end_date: '2026-01-15' },
      second_term: { start_date: '2026-01-18', end_date: '2026-05-25' },
    });
    unitId = (
      await sendJson('POST', `${environment.baseUrl}/org-units`, principal, {
        code: 'TC',
        name: 'Trường chính',
        unit_type: 'truong_chinh',
      })
    ).body.id as string;
    await sendJson('POST', `${environment.baseUrl}/grade-levels`, principal, {
      code: 'LA',
      name: 'Lá',
      age_from_months: 60,
      age_to_months: 71,
    });
    const created = await sendJson('POST', `${environment.baseUrl}/classes`, principal, {
      org_unit_id: unitId,
      code: 'LA-CU',
      name: 'Lá năm cũ',
      grade_level: 'LA',
      max_size: 25,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    currentYearId = await openTestAcademicYear(environment, principal, '2026–2027', {
      first_term: { start_date: '2026-09-07', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    });
    const draft = await sendJson('POST', `${environment.baseUrl}/academic-years`, principal, { name: '2027–2028' });
    draftYearId = draft.body.id as string;
    teacher = (await environment.loginAs('VT-07', unitId)).accessToken;
  });

  after(async () => {
    await environment.close();
  });

  it('CT-1620: không có tiêu đề thì đọc năm đang dùng; có tiêu đề năm đã đóng thì đọc dữ liệu năm đó', async () => {
    const current = await call('GET', '/classes', principal);
    assert.equal(current.status, 200, JSON.stringify(current.body));
    assert.deepEqual(codes(current.body), []);
    const old = await call('GET', '/classes', principal, oldYearId);
    assert.equal(old.status, 200, JSON.stringify(old.body));
    assert.deepEqual(codes(old.body), ['LA-CU']);
    // Tiêu đề trỏ năm đang dùng như không có tiêu đề, ghi được
    const sameYear = await call('GET', '/classes', principal, currentYearId);
    assert.deepEqual(codes(sameYear.body), []);
    const written = await call('POST', '/classes', principal, currentYearId, {
      org_unit_id: unitId,
      code: 'LA-MOI',
      name: 'Lá năm mới',
      grade_level: 'LA',
      max_size: 25,
    });
    assert.equal(written.status, 201, JSON.stringify(written.body));
    assert.deepEqual(codes((await call('GET', '/classes', principal, oldYearId)).body), ['LA-CU']);
  });

  it('CT-1621: ghi kèm năm đã đóng bị từ chối theo BR-93, dữ liệu năm cũ không đổi', async () => {
    const rejected = await call('POST', '/classes', principal, oldYearId, {
      org_unit_id: unitId,
      code: 'LA-CU-2',
      name: 'Lá ghi vào năm cũ',
      grade_level: 'LA',
      max_size: 25,
    });
    assert.equal(rejected.status, 422, JSON.stringify(rejected.body));
    assert.equal(ruleOf(rejected.body), 'BR-93');
    assert.match(String((rejected.body.error as Row).message), /đã đóng, chỉ xem/);
    assert.deepEqual(codes((await call('GET', '/classes', principal, oldYearId)).body), ['LA-CU']);
  });

  it('CT-1622: mã năm học sai dạng 400, không có hoặc còn nháp 404', async () => {
    assert.equal((await call('GET', '/classes', principal, 'khong-phai-ma')).status, 400);
    assert.equal((await call('GET', '/classes', principal, randomUUID())).status, 404);
    assert.equal((await call('GET', '/classes', principal, draftYearId)).status, 404);
  });

  it('CT-1623: xem năm cũ vẫn kiểm quyền: không đăng nhập 401, không có quyền 403', async () => {
    assert.equal((await call('GET', '/classes', '', oldYearId)).status, 401);
    assert.equal((await call('GET', '/facilities/rooms', teacher, oldYearId)).status, 403);
    assert.equal((await call('GET', '/facilities/rooms', principal, oldYearId)).status, 200);
  });

  it('CT-1624: lỗi ghi vào cơ sở dữ liệu chỉ đọc, thiếu cột hoặc bảng thành lỗi nghiệp vụ BR-93', () => {
    for (const code of ['25006', '42703', '42P01']) {
      const translated = translateViewedYearError(Object.assign(new Error('pg'), { code })) as { ruleCode?: string };
      assert.equal(translated.ruleCode, 'BR-93', code);
    }
    const other = new Error('khác');
    assert.equal(translateViewedYearError(other), other);
  });
});
