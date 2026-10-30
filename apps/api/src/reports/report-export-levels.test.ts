import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import ExcelJS from 'exceljs';
import { openTestAcademicYear, sendJson, startApiTestEnvironment, type ApiTestEnvironment } from '../test-support.js';

// Nhãn người học trong tệp xuất báo cáo theo cấp (YCTD-394): trường chỉ Mầm non giữ "trẻ"; trường liên cấp ghi theo tham số
// school_level, không gửi là các cấp người dùng được xem. Kịch bản CT-1970, CT-1971
type Row = Record<string, unknown>;

describe('Tệp xuất báo cáo ghi người học theo cấp (YCTD-394)', () => {
  let environment: ApiTestEnvironment;
  let principal: string;

  const api = (method: string, path: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, principal, body);

  const exportDebts = async (body: Row) => {
    const response = await fetch(`${environment.baseUrl}/reports/debts/export`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${principal}` },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: Buffer.from(await response.arrayBuffer()) };
  };

  // Tên các trang và dòng tiêu đề trang thứ hai (Theo người học) của tệp công nợ
  const sheetsOf = async (body: Buffer) => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(body as unknown as ArrayBuffer);
    const names = workbook.worksheets.map((sheet) => sheet.name);
    const header = (workbook.worksheets[2]?.getRow(1).values as unknown[] | undefined)?.slice(1, 2);
    return { names, header };
  };

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = (await environment.loginAs('VT-02', null)).accessToken;
    await openTestAcademicYear(environment, principal, '2026–2027', {
      first_term: { start_date: '2026-09-07', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-28' },
    });
    await api('POST', '/org-units', { code: 'TC', name: 'Trường chính', unit_type: 'truong_chinh' });
  });

  after(async () => {
    await environment.close();
  });

  it('CT-1970: trường chỉ có Mầm non: tệp xuất giữ chữ "trẻ" như trước', async () => {
    const response = await exportDebts({});
    assert.equal(response.status, 200, response.body.toString());
    const { names, header } = await sheetsOf(response.body);
    assert.deepEqual(names, ['Thông tin', 'Theo lớp', 'Theo trẻ']);
    assert.deepEqual(header, ['Trẻ']);
  });

  it('CT-1971: trường liên cấp: chọn Tiểu học ghi "học sinh", chọn Mầm non ghi "trẻ", "Tất cả" ghi "học sinh"; cấp chưa bật bị từ chối', async () => {
    const levels = (await api('GET', '/school-levels')).body.levels as Row[];
    const saved = await api('PUT', '/school-levels', {
      levels: levels.map((level) => ({
        code: level.code,
        is_enabled: level.code === 'MN' || level.code === 'TH',
        order_no: level.order_no,
        display_name: level.display_name,
        learner_term: level.learner_term,
        context_label: level.context_label,
      })),
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));

    const primary = await sheetsOf((await exportDebts({ school_level: 'TH' })).body);
    assert.deepEqual(primary.names, ['Thông tin', 'Theo lớp', 'Theo học sinh']);
    assert.deepEqual(primary.header, ['Học sinh']);
    const preschool = await sheetsOf((await exportDebts({ school_level: 'MN' })).body);
    assert.deepEqual(preschool.header, ['Trẻ']);
    const all = await sheetsOf((await exportDebts({})).body);
    assert.deepEqual(all.header, ['Học sinh']);
    assert.equal((await exportDebts({ school_level: 'THCS' })).status, 403);
  });
});
