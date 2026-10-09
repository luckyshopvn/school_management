import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { Controller, Get, Param } from '@nestjs/common';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { openTestAcademicYear, sendJson, startApiTestEnvironment, type ApiTestEnvironment } from '../test-support.js';
import { OrganizationScopes } from './organization-scopes.js';

// Điểm cuối chỉ dùng trong kiểm thử để kiểm tra lớp đơn vị của phân quyền
@Controller('test-scope')
class ScopeProbeController {
  constructor(private readonly organizationScopes: OrganizationScopes) {}

  @Get(':orgUnitId')
  @RequirePermission('P02.view')
  async read(@Param('orgUnitId') orgUnitId: string, @AuthenticatedUser() currentUser: CurrentUser) {
    await this.organizationScopes.assertCanAccess(currentUser, 'P02.view', orgUnitId);
    return { allowed: true };
  }
}

// Ca kiểm thử theo 27_BO_CA_KIEM_THU_CHI_TIET/01_DINH_DANH_VA_P01.md mục 4.1 (cây hai cấp, YCTD-38)
describe('Cây đơn vị hai cấp', () => {
  let environment: ApiTestEnvironment;
  let principal: string;
  let principalUserId: string;
  const units: Record<string, string> = {};

  before(async () => {
    environment = await startApiTestEnvironment({ additionalControllers: [ScopeProbeController] });
    const login = await environment.loginAs('VT-02', null);
    principal = login.accessToken;
    principalUserId = login.userId;
  });

  after(async () => {
    await environment.close();
  });

  const url = (path = '') => `${environment.baseUrl}/org-units${path}`;

  async function createUnit(code: string, name: string, unitType: string, parentId?: string) {
    return sendJson('POST', url(), principal, { code, name, unit_type: unitType, parent_id: parentId });
  }

  it('Chưa có năm học đang dùng thì không tạo được đơn vị', async () => {
    const response = await createUnit('TC', 'Trường chính', 'truong_chinh');
    assert.equal(response.status, 422);
    assert.equal(response.body.error?.rule_code, 'BR-93');
  });

  it('CTC-P01-001: Hiệu trưởng tạo Trường chính, đơn vị cha trống', async () => {
    await openTestAcademicYear(environment, principal, '2026–2027', {
      first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    });
    const response = await createUnit('TC', 'Trường chính', 'truong_chinh');
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.parent_id, null);
    units.TC = response.body.id as string;
  });

  it('CTC-P01-002: tạo Phân hiệu và Điểm trường dưới Trường chính; cây trả đúng quan hệ và loại', async () => {
    for (const [code, name, type] of [
      ['PH-A', 'Phân hiệu A', 'phan_hieu'],
      ['PH-B', 'Phân hiệu B', 'phan_hieu'],
      ['DT-A1', 'Điểm trường A1', 'diem_truong'],
      ['DT-A2', 'Điểm trường A2', 'diem_truong'],
      ['DT-B1', 'Điểm trường B1', 'diem_truong'],
    ] as const) {
      const response = await createUnit(code, name, type);
      assert.equal(response.status, 201, JSON.stringify(response.body));
      assert.equal(response.body.parent_id, units.TC);
      units[code] = response.body.id as string;
    }
    const teacher = (await environment.loginAs('VT-07', units['DT-A1'] ?? null)).accessToken;
    const tree = await sendJson('GET', url('/tree'), teacher);
    assert.equal(tree.status, 200);
    assert.equal(tree.body.id, units.TC);
    const children = tree.body.children as Array<{ code: string; unit_type: string }>;
    assert.equal(children.length, 5);
    assert.equal(children.find((child) => child.code === 'DT-A1')?.unit_type, 'diem_truong');
  });

  it('CTC-P01-003: tạo đơn vị dưới Điểm trường hoặc đổi cha của PH-A thành ĐT-A1 bị từ chối theo BR-01', async () => {
    const nested = await createUnit('CAP-3', 'Cấp ba', 'diem_truong', units['DT-A1']);
    assert.equal(nested.status, 422);
    assert.equal(nested.body.error?.rule_code, 'BR-01');
    const moved = await sendJson('PATCH', url(`/${units['PH-A']}`), principal, { parent_id: units['DT-A1'] });
    assert.equal(moved.status, 422);
    assert.equal(moved.body.error?.rule_code, 'BR-01');
    const tree = await sendJson('GET', url('/tree'), principal);
    assert.equal((tree.body.children as unknown[]).length, 5);
  });

  it('BR-01 ở tầng dữ liệu: ghi thẳng đơn vị dưới Điểm trường hoặc Trường chính thứ hai đều bị cơ sở dữ liệu chặn', async () => {
    const registry = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .where('status', '=', 'active')
      .executeTakeFirstOrThrow();
    const yearDatabase = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, registry.database_name),
    );
    try {
      await assert.rejects(
        yearDatabase
          .insertInto('org_units')
          .values({ code: 'TRUC-TIEP', name: 'Ghi thẳng', unit_type: 'diem_truong', parent_id: units['DT-A1'] ?? null })
          .execute(),
      );
      await assert.rejects(
        yearDatabase
          .insertInto('org_units')
          .values({ code: 'TC-THU-HAI', name: 'Trường chính 2', unit_type: 'truong_chinh', parent_id: null })
          .execute(),
      );
    } finally {
      await yearDatabase.destroy();
    }
  });

  it('CTC-P01-004: không tạo được Trường chính thứ hai, không đổi được loại giữa hai cấp', async () => {
    assert.equal((await createUnit('TC-2', 'Trường chính 2', 'truong_chinh')).status, 422);
    const retyped = await sendJson('PATCH', url(`/${units['PH-A']}`), principal, { unit_type: 'truong_chinh' });
    assert.equal(retyped.status, 422);
  });

  it('CTC-P01-005: danh sách phẳng lọc theo loại Điểm trường', async () => {
    const response = await sendJson('GET', url('?unit_type=diem_truong'), principal);
    assert.equal(response.status, 200);
    const codes = (response.body as unknown as Array<{ code: string }>).map((unit) => unit.code).sort();
    assert.deepEqual(codes, ['DT-A1', 'DT-A2', 'DT-B1']);
  });

  it('CTC-P01-007: ngừng sử dụng ĐT-A2, không xóa; không ngừng được Trường chính', async () => {
    const response = await sendJson('PATCH', url(`/${units['DT-A2']}`), principal, { status: 'inactive' });
    assert.equal(response.status, 200);
    assert.equal(response.body.status, 'inactive');
    const all = (await sendJson('GET', url(), principal)).body as unknown as Array<{ code: string }>;
    assert.ok(all.some((unit) => unit.code === 'DT-A2'));
    const root = await sendJson('PATCH', url(`/${units.TC}`), principal, { status: 'inactive' });
    assert.equal(root.status, 422);
    assert.equal(root.body.error?.rule_code, 'BR-01');
  });

  it('CTC-P01-008: QL-A và PHT-A không tạo, không sửa đơn vị', async () => {
    for (const roleCode of ['VT-03', 'VT-15']) {
      const { accessToken } = await environment.loginAs(roleCode, units['PH-A'] ?? null);
      assert.equal(
        (await sendJson('POST', url(), accessToken, { code: 'X', name: 'X', unit_type: 'diem_truong' })).status,
        403,
      );
      assert.equal((await sendJson('PATCH', url(`/${units['PH-A']}`), accessToken, { name: 'Đổi' })).status, 403);
    }
  });

  it('Mã đơn vị trùng trả ERR_CONFLICT', async () => {
    const response = await createUnit('PH-A', 'Trùng mã', 'phan_hieu');
    assert.equal(response.status, 409);
  });

  it('CTC-P01-012: đổi tên PH-B ghi nhật ký thao tác có người thực hiện, thời điểm, giá trị trước và sau', async () => {
    const response = await sendJson('PATCH', url(`/${units['PH-B']}`), principal, { name: 'Phân hiệu Bắc' });
    assert.equal(response.status, 200);
    const registry = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .where('status', '=', 'active')
      .executeTakeFirstOrThrow();
    const yearDatabase = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, registry.database_name),
    );
    try {
      const log = await yearDatabase
        .selectFrom('audit_logs')
        .selectAll()
        .where('entity_id', '=', units['PH-B'] ?? '')
        .where('action', '=', 'update')
        .executeTakeFirstOrThrow();
      assert.equal(log.actor_user_id, principalUserId);
      assert.ok(log.created_at instanceof Date);
      assert.equal((log.before_data as { name: string }).name, 'Phân hiệu B');
      assert.equal((log.after_data as { name: string }).name, 'Phân hiệu Bắc');
    } finally {
      await yearDatabase.destroy();
    }
  });

  it('CTC-P01-009: tài khoản gán ở Trường chính truy cập được ĐT-B1', async () => {
    const { accessToken } = await environment.loginAs('VT-03', units.TC ?? null);
    assert.equal(
      (await sendJson('GET', `${environment.baseUrl}/test-scope/${units['DT-B1']}`, accessToken)).status,
      200,
    );
  });

  it('CTC-P01-010: tài khoản gán ở ĐT-A1 không truy cập được PH-A và ĐT-A2', async () => {
    const { accessToken } = await environment.loginAs('VT-03', units['DT-A1'] ?? null);
    assert.equal(
      (await sendJson('GET', `${environment.baseUrl}/test-scope/${units['DT-A1']}`, accessToken)).status,
      200,
    );
    assert.equal(
      (await sendJson('GET', `${environment.baseUrl}/test-scope/${units['PH-A']}`, accessToken)).status,
      403,
    );
    assert.equal(
      (await sendJson('GET', `${environment.baseUrl}/test-scope/${units['DT-A2']}`, accessToken)).status,
      403,
    );
  });

  it('CTC-P01-011: tài khoản nhóm A truy cập PH-A, ĐT-A1, ĐT-A2, không truy cập PH-B, ĐT-B1', async () => {
    const { accessToken } = await environment.loginWithRoles(
      ['PH-A', 'DT-A1', 'DT-A2'].map((code) => ({ roleCode: 'VT-03', orgUnitId: units[code] ?? null })),
    );
    for (const code of ['PH-A', 'DT-A1', 'DT-A2']) {
      assert.equal(
        (await sendJson('GET', `${environment.baseUrl}/test-scope/${units[code]}`, accessToken)).status,
        200,
      );
    }
    for (const code of ['PH-B', 'DT-B1']) {
      assert.equal(
        (await sendJson('GET', `${environment.baseUrl}/test-scope/${units[code]}`, accessToken)).status,
        403,
      );
    }
  });

  it('QĐ-17: mở năm học mới chuyển cả cây đơn vị sang, giữ nguyên mã định danh', async () => {
    await openTestAcademicYear(environment, principal, '2027–2028', {
      first_term: { start_date: '2027-09-06', end_date: '2028-01-14' },
      second_term: { start_date: '2028-01-17', end_date: '2028-05-26' },
    });
    const listed = (await sendJson('GET', url(), principal)).body as unknown as Array<{
      id: string;
      code: string;
      name: string;
      status: string;
    }>;
    assert.equal(listed.length, 6);
    for (const [code, id] of Object.entries(units)) {
      assert.equal(listed.find((unit) => unit.code === code)?.id, id, code);
    }
    assert.equal(listed.find((unit) => unit.code === 'PH-B')?.name, 'Phân hiệu Bắc');
    assert.equal(listed.find((unit) => unit.code === 'DT-A2')?.status, 'inactive');
  });
});
