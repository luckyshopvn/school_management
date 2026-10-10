import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { openTestAcademicYear, sendJson, startApiTestEnvironment, type ApiTestEnvironment } from '../test-support.js';

const rows = <Row = Record<string, unknown>>(body: unknown) => body as Row[];

// Các danh mục của P01; ca kiểm thử theo 27_BO_CA_KIEM_THU_CHI_TIET/01_DINH_DANH_VA_P01.md mục 4.3, 4.4, 4.9, 4.10
describe('Phòng ban, chức danh, danh mục dùng chung, hạn mức phê duyệt, phòng học, bậc học', () => {
  let environment: ApiTestEnvironment;
  let principal: string;
  const units: Record<string, string> = {};
  const unit = (code: string) => units[code] ?? null;

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = (await environment.loginAs('VT-02', null)).accessToken;
    await openTestAcademicYear(environment, principal, '2026–2027', {
      first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    });
    for (const [code, type] of [
      ['TC', 'truong_chinh'],
      ['PH-A', 'phan_hieu'],
      ['ĐT-A1', 'diem_truong'],
      ['PH-B', 'phan_hieu'],
    ] as const) {
      const created = await sendJson('POST', `${environment.baseUrl}/org-units`, principal, {
        code,
        name: code,
        unit_type: type,
      });
      units[code] = created.body.id as string;
    }
  });

  after(async () => {
    await environment.close();
  });

  const post = (path: string, accessToken: string, body: unknown) =>
    sendJson('POST', `${environment.baseUrl}${path}`, accessToken, body);
  const patch = (path: string, accessToken: string, body: unknown) =>
    sendJson('PATCH', `${environment.baseUrl}${path}`, accessToken, body);
  const get = (path: string, accessToken: string) => sendJson('GET', `${environment.baseUrl}${path}`, accessToken);

  describe('P01-03 Phòng ban và P01-04 Chức danh', () => {
    it('CTC-P01-020: NS-A tạo phòng ban "Tổ chuyên môn" thuộc PH-A có phòng ban cha', async () => {
      const staffOfficer = await environment.loginWithRoles([
        { roleCode: 'VT-06', orgUnitId: unit('PH-A') },
        { roleCode: 'VT-06', orgUnitId: unit('ĐT-A1') },
      ]);
      const parent = await post('/departments', staffOfficer.accessToken, {
        org_unit_id: unit('PH-A'),
        name: 'Khối chuyên môn',
      });
      assert.equal(parent.status, 201, JSON.stringify(parent.body));
      const child = await post('/departments', staffOfficer.accessToken, {
        org_unit_id: unit('PH-A'),
        parent_id: parent.body.id,
        name: 'Tổ chuyên môn',
      });
      assert.equal(child.status, 201, JSON.stringify(child.body));
      const listed = await get(`/departments?org_unit_id=${unit('PH-A')}`, staffOfficer.accessToken);
      const names = rows(listed.body).map((row) => row.name);
      assert.deepEqual(names.sort(), ['Khối chuyên môn', 'Tổ chuyên môn']);

      // Phòng ban cha khác đơn vị, chọn phòng ban con làm cha, ngừng phòng ban còn con đang hoạt động
      const other = await post('/departments', principal, { org_unit_id: unit('ĐT-A1'), name: 'Văn phòng' });
      assert.equal(
        (await post('/departments', principal, { org_unit_id: unit('PH-A'), parent_id: other.body.id, name: 'X' }))
          .status,
        422,
      );
      assert.equal(
        (await patch(`/departments/${parent.body.id}`, principal, { parent_id: child.body.id })).status,
        422,
      );
      assert.equal((await patch(`/departments/${parent.body.id}`, principal, { status: 'inactive' })).status, 422);
      assert.equal((await patch(`/departments/${child.body.id}`, principal, { status: 'inactive' })).status, 200);
      assert.equal((await patch(`/departments/${parent.body.id}`, principal, { status: 'inactive' })).status, 200);
    });

    it('CTC-P01-021: NS-A gán ở nhóm A không tạo được phòng ban thuộc PH-B', async () => {
      const staffOfficer = await environment.loginAs('VT-06', unit('PH-A'));
      const response = await post('/departments', staffOfficer.accessToken, {
        org_unit_id: unit('PH-B'),
        name: 'Tổ B',
      });
      assert.equal(response.status, 403);
    });

    it('CTC-P01-022: GV-A1 gọi POST /departments bị từ chối', async () => {
      const teacher = await environment.loginAs('VT-07', unit('ĐT-A1'));
      const response = await post('/departments', teacher.accessToken, { org_unit_id: unit('ĐT-A1'), name: 'Tổ' });
      assert.equal(response.status, 403);
    });

    it('CTC-P01-024: NS-A tạo chức danh "Giáo viên mầm non hạng III" kèm cấp bậc; tên trùng trả ERR_CONFLICT', async () => {
      const staffOfficer = await environment.loginAs('VT-06', unit('PH-A'));
      const body = { org_unit_id: unit('PH-A'), name: 'Giáo viên mầm non hạng III', level: 'Hạng III' };
      const created = await post('/job-titles', staffOfficer.accessToken, body);
      assert.equal(created.status, 201, JSON.stringify(created.body));
      assert.equal(created.body.level, 'Hạng III');
      const duplicate = await post('/job-titles', staffOfficer.accessToken, body);
      assert.equal(duplicate.status, 409);
      assert.equal((duplicate.body.error as { code: string }).code, 'ERR_CONFLICT');
      const stopped = await patch(`/job-titles/${created.body.id}`, staffOfficer.accessToken, { status: 'inactive' });
      assert.equal(stopped.body.status, 'inactive');
    });

    it('CTC-P01-025: KT-A gọi POST /job-titles bị từ chối; vẫn xem được chức danh của đơn vị mình', async () => {
      const accountant = await environment.loginAs('VT-04', unit('PH-A'));
      assert.equal(
        (await post('/job-titles', accountant.accessToken, { org_unit_id: unit('PH-A'), name: 'Kế toán viên' })).status,
        403,
      );
      assert.equal((await get(`/job-titles?org_unit_id=${unit('PH-A')}`, accountant.accessToken)).status, 200);
      assert.equal((await get(`/job-titles?org_unit_id=${unit('PH-B')}`, accountant.accessToken)).status, 403);
    });
  });

  describe('P01-05 Danh mục dùng chung', () => {
    it('CTC-P01-026: HT tạo mục mới trong loại Quan hệ với trẻ; mục chọn được khi lọc mục đang dùng', async () => {
      const types = await get('/catalog-types', principal);
      assert.deepEqual(
        rows(types.body).map((type) => type.code),
        ['parent_relationship', 'leave_type', 'contract_type', 'asset_category'],
      );
      const created = await post('/catalog-items', principal, {
        catalog_type: 'parent_relationship',
        code: 'MA_01',
        name: 'Mẹ',
        order_no: 1,
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      const teacher = await environment.loginAs('VT-07', unit('ĐT-A1'));
      const active = await get('/catalog-items?catalog_type=parent_relationship&status=active', teacher.accessToken);
      assert.deepEqual(
        rows(active.body).map((item) => item.name),
        ['Mẹ'],
      );

      // BR-75: ngừng sử dụng thì không còn trong danh sách mục đang dùng nhưng vẫn đọc được
      await patch(`/catalog-items/${created.body.id}`, principal, { status: 'inactive' });
      assert.equal(
        rows((await get('/catalog-items?catalog_type=parent_relationship&status=active', principal)).body).length,
        0,
      );
      assert.equal(rows((await get('/catalog-items?catalog_type=parent_relationship', principal)).body).length, 1);
      await patch(`/catalog-items/${created.body.id}`, principal, { status: 'active' });
    });

    it('CTC-P01-028: tạo mục trùng mã "MA_01" trong cùng loại trả ERR_CONFLICT; khác loại thì được', async () => {
      const duplicate = await post('/catalog-items', principal, {
        catalog_type: 'parent_relationship',
        code: 'MA_01',
        name: 'Bố',
      });
      assert.equal(duplicate.status, 409);
      assert.equal((duplicate.body.error as { code: string }).code, 'ERR_CONFLICT');
      const otherType = await post('/catalog-items', principal, {
        catalog_type: 'leave_type',
        code: 'MA_01',
        name: 'Nghỉ phép năm',
        attributes: { is_paid: true, deducts_annual_leave: true, insurance_paid: false },
      });
      assert.equal(otherType.status, 201);
      assert.deepEqual(otherType.body.attributes, { is_paid: true, deducts_annual_leave: true, insurance_paid: false });
      const unknownType = await post('/catalog-items', principal, {
        catalog_type: 'ethnicity',
        code: 'KINH',
        name: 'Kinh',
      });
      assert.equal(unknownType.status, 400);
    });

    it('YCTD-59: loại nghỉ phép bắt buộc khai thuộc tính tính công, không được trái nhau', async () => {
      const missing = await post('/catalog-items', principal, {
        catalog_type: 'leave_type',
        code: 'THIEU',
        name: 'Nghỉ thiếu thuộc tính',
      });
      assert.equal(missing.status, 400);
      const conflicting = await post('/catalog-items', principal, {
        catalog_type: 'leave_type',
        code: 'BHXH',
        name: 'Nghỉ hưởng chế độ bảo hiểm xã hội',
        attributes: { is_paid: true, deducts_annual_leave: false, insurance_paid: true },
      });
      assert.equal(conflicting.status, 400);
      const created = await post('/catalog-items', principal, {
        catalog_type: 'leave_type',
        code: 'BHXH',
        name: 'Nghỉ hưởng chế độ bảo hiểm xã hội',
        attributes: { is_paid: false, deducts_annual_leave: false, insurance_paid: true },
      });
      assert.equal(created.status, 201);
      const changed = await patch(`/catalog-items/${created.body.id}`, principal, {
        attributes: { is_paid: false, deducts_annual_leave: false, insurance_paid: false },
      });
      assert.equal(changed.status, 200);
      assert.equal((changed.body.attributes as { insurance_paid: boolean }).insurance_paid, false);
      const relationship = await post('/catalog-items', principal, {
        catalog_type: 'parent_relationship',
        code: 'CHU',
        name: 'Chú',
        attributes: { is_paid: true },
      });
      assert.deepEqual(relationship.body.attributes, {});
    });

    it('CTC-P01-029: QL-A tạo mục danh mục dùng chung bị từ chối', async () => {
      const manager = await environment.loginAs('VT-03', unit('PH-A'));
      const response = await post('/catalog-items', manager.accessToken, {
        catalog_type: 'leave_type',
        code: 'OM',
        name: 'Nghỉ ốm',
      });
      assert.equal(response.status, 403);
    });
  });

  describe('P01-10 Hạn mức phê duyệt', () => {
    const save = (accessToken: string, body: unknown) =>
      sendJson('PUT', `${environment.baseUrl}/approval-thresholds`, accessToken, body);

    it('CTC-P01-059: HT đặt hạn mức phiếu chi của PH-A là 10 000 000; đổi thì bản cũ hết hiệu lực', async () => {
      const saved = await save(principal, {
        org_unit_id: unit('PH-A'),
        document_type: 'payment',
        threshold_amount: 10_000_000,
      });
      assert.equal(saved.status, 200, JSON.stringify(saved.body));
      const listed = await get(`/approval-thresholds?org_unit_id=${unit('PH-A')}`, principal);
      assert.deepEqual(
        rows(listed.body).map((row) => [row.document_type, row.threshold_amount]),
        [['payment', 10_000_000]],
      );
      assert.match(rows<{ effective_from: string }>(listed.body)[0]?.effective_from ?? '', /^\d{4}-\d{2}-\d{2}$/);

      await save(principal, { org_unit_id: unit('PH-A'), document_type: 'payment', threshold_amount: 12_000_000.5 });
      const changed = await get(`/approval-thresholds?org_unit_id=${unit('PH-A')}`, principal);
      assert.equal(rows(changed.body).length, 1);
      assert.equal(rows<{ threshold_amount: number }>(changed.body)[0]?.threshold_amount, 12_000_000.5);

      // Hạn mức không kế thừa: PH-B chưa cấu hình thì không có hạn mức
      assert.equal(rows((await get(`/approval-thresholds?org_unit_id=${unit('PH-B')}`, principal)).body).length, 0);

      const logs = await get(`/audit-logs?entity_name=approval_thresholds`, principal);
      assert.equal((logs.body as { total: number }).total, 2);

      // Gửi null là gỡ hạn mức, loại chứng từ đó trở lại do Hiệu trưởng phê duyệt
      await save(principal, { org_unit_id: unit('PH-A'), document_type: 'payment', threshold_amount: null });
      assert.equal(rows((await get(`/approval-thresholds?org_unit_id=${unit('PH-A')}`, principal)).body).length, 0);
      await save(principal, { org_unit_id: unit('PH-A'), document_type: 'payment', threshold_amount: 10_000_000 });
    });

    it('Hạn mức sai: loại chứng từ không áp dụng, số âm, quá hai chữ số thập phân', async () => {
      for (const body of [
        { org_unit_id: unit('PH-A'), document_type: 'leave_request', threshold_amount: 1000 },
        { org_unit_id: unit('PH-A'), document_type: 'payment', threshold_amount: -1 },
        { org_unit_id: unit('PH-A'), document_type: 'payment', threshold_amount: 10.123 },
        { org_unit_id: unit('PH-A'), document_type: 'payment' },
      ]) {
        assert.equal((await save(principal, body)).status, 400, JSON.stringify(body));
      }
    });

    it('CTC-P01-067: QL-A và KTT gọi PUT /approval-thresholds bị từ chối; PHT-A và QL-A chỉ xem đơn vị mình', async () => {
      const manager = await environment.loginAs('VT-03', unit('PH-A'));
      const chiefAccountant = await environment.loginAs('VT-05', unit('PH-A'));
      for (const accessToken of [manager.accessToken, chiefAccountant.accessToken]) {
        const response = await save(accessToken, {
          org_unit_id: unit('PH-A'),
          document_type: 'payment',
          threshold_amount: 1,
        });
        assert.equal(response.status, 403);
      }
      const deputy = await environment.loginAs('VT-15', unit('PH-B'));
      assert.equal(rows((await get('/approval-thresholds', deputy.accessToken)).body).length, 0);
      assert.equal(rows((await get('/approval-thresholds', manager.accessToken)).body).length, 1);
      assert.equal((await get(`/approval-thresholds?org_unit_id=${unit('PH-A')}`, deputy.accessToken)).status, 403);
    });
  });

  describe('P01-11 Phòng học và P01-12 Bậc học', () => {
    it('CTC-P01-069: QL-A tạo phòng "P101" sức chứa 30 thuộc ĐT-A1; mã trùng trong đơn vị trả ERR_CONFLICT', async () => {
      const manager = await environment.loginWithRoles([
        { roleCode: 'VT-03', orgUnitId: unit('PH-A') },
        { roleCode: 'VT-03', orgUnitId: unit('ĐT-A1') },
      ]);
      const body = { org_unit_id: unit('ĐT-A1'), code: 'P101', name: 'Phòng 101', capacity: 30 };
      const created = await post('/rooms', manager.accessToken, body);
      assert.equal(created.status, 201, JSON.stringify(created.body));
      assert.equal(created.body.capacity, 30);
      assert.equal((await post('/rooms', manager.accessToken, body)).status, 409);
      assert.equal((await post('/rooms', manager.accessToken, { ...body, org_unit_id: unit('PH-A') })).status, 201);
      assert.equal((await post('/rooms', manager.accessToken, { ...body, code: 'P102', capacity: 0 })).status, 400);
      const stopped = await patch(`/rooms/${created.body.id}`, manager.accessToken, { status: 'inactive' });
      assert.equal(stopped.body.status, 'inactive');
    });

    it('CTC-P01-072: QL-A tạo phòng thuộc PH-B bị từ chối; nhân sự không tạo được phòng', async () => {
      const manager = await environment.loginAs('VT-03', unit('PH-A'));
      const body = { org_unit_id: unit('PH-B'), code: 'B101', name: 'Phòng B101', capacity: 25 };
      assert.equal((await post('/rooms', manager.accessToken, body)).status, 403);
      const staffOfficer = await environment.loginAs('VT-06', unit('PH-B'));
      assert.equal((await post('/rooms', staffOfficer.accessToken, body)).status, 403);
    });

    it('CTC-P01-073: HT tạo bậc học "Mầm" độ tuổi 48 đến 59 tháng; mã không đổi được', async () => {
      const created = await post('/grade-levels', principal, {
        code: 'MAM',
        name: 'Mầm',
        age_from_months: 48,
        age_to_months: 59,
        order_no: 3,
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      const teacher = await environment.loginAs('VT-07', unit('ĐT-A1'));
      const listed = await get('/grade-levels?status=active', teacher.accessToken);
      assert.deepEqual(
        rows(listed.body).map((level) => level.code),
        ['MAM'],
      );
      assert.equal((await patch(`/grade-levels/${created.body.id}`, principal, { code: 'MAM2' })).status, 400);
      assert.equal((await patch(`/grade-levels/${created.body.id}`, principal, { age_to_months: 40 })).status, 400);
      assert.equal(
        (await post('/grade-levels', principal, { code: 'MAM', name: 'Trùng', age_from_months: 1, age_to_months: 2 }))
          .status,
        409,
      );
    });

    it('CTC-P01-075: QL-A tạo bậc học bị từ chối', async () => {
      const manager = await environment.loginAs('VT-03', unit('PH-A'));
      const response = await post('/grade-levels', manager.accessToken, {
        code: 'CHOI',
        name: 'Chồi',
        age_from_months: 60,
        age_to_months: 71,
      });
      assert.equal(response.status, 403);
    });
  });

  it('QĐ-17: mở năm học mới thì các danh mục chuyển sang, giữ nguyên mã định danh', async () => {
    const before = {
      departments: (await get(`/departments?org_unit_id=${unit('PH-A')}`, principal)).body,
      jobTitles: (await get(`/job-titles?org_unit_id=${unit('PH-A')}`, principal)).body,
      catalogItems: (await get('/catalog-items', principal)).body,
      thresholds: (await get('/approval-thresholds', principal)).body,
      rooms: (await get(`/rooms?org_unit_id=${unit('ĐT-A1')}`, principal)).body,
      gradeLevels: (await get('/grade-levels', principal)).body,
    };
    await openTestAcademicYear(environment, principal, '2027–2028', {
      first_term: { start_date: '2027-09-06', end_date: '2028-01-14' },
      second_term: { start_date: '2028-01-17', end_date: '2028-05-26' },
    });
    assert.deepEqual((await get(`/departments?org_unit_id=${unit('PH-A')}`, principal)).body, before.departments);
    assert.deepEqual((await get(`/job-titles?org_unit_id=${unit('PH-A')}`, principal)).body, before.jobTitles);
    assert.deepEqual((await get('/catalog-items', principal)).body, before.catalogItems);
    assert.deepEqual((await get('/approval-thresholds', principal)).body, before.thresholds);
    assert.deepEqual((await get(`/rooms?org_unit_id=${unit('ĐT-A1')}`, principal)).body, before.rooms);
    assert.deepEqual((await get('/grade-levels', principal)).body, before.gradeLevels);
    assert.equal(rows(before.departments).length, 2);
  });
});
