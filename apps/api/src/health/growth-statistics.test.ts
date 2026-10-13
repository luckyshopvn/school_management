import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
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

// Cân nặng, chiều cao theo đợt cân đo, tổng hợp, thống kê theo tiêu chí ngành và hồ sơ chưa nhập đủ (DT-14 phần 14a,
// YCTD-102); kịch bản CT-14a-4 đến CT-14a-10. Dữ liệu kiểm thử là dữ liệu giả
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const dobForMonths = (months: number) => addDays(vietnamToday, -Math.round(months * 30.4375));
const errorOf = (body: Record<string, unknown>) => (body.error ?? {}) as { code?: string; rule_code?: string };

interface GridRow {
  child_id: string;
  full_name: string;
  weight_kg: number | null;
  height_cm: number | null;
  assessment: { age_months: number; weight_status: string | null; height_status: string | null };
}

describe('Cân nặng, chiều cao, thống kê theo tiêu chí ngành', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let academicYearId = '';
  const units: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const classes: Record<string, string> = {};
  const children: Record<string, string> = {};
  const staff: Record<string, string> = {};
  let roundId = '';

  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);
  const upload = async (path: string, accessToken: string, buffer: Buffer) => {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(buffer)]), 'can-do.xlsx');
    const response = await fetch(`${environment.baseUrl}${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
      body: form,
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  };

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    academicYearId = await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
      first_term: { start_date: addDays(vietnamToday, -60), end_date: addDays(vietnamToday, 90) },
      second_term: { start_date: addDays(vietnamToday, 95), end_date: addDays(vietnamToday, 200) },
    });
    const registry = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, registry.database_name),
    );
    for (const [code, type] of [
      ['TC', 'truong_chinh'],
      ['ĐT-A1', 'diem_truong'],
      ['ĐT-B1', 'diem_truong'],
    ] as const) {
      units[code] = (await api('POST', '/org-units', principal.accessToken, { code, name: code, unit_type: type })).body
        .id as string;
    }
    const unitA = units['ĐT-A1'] ?? '';
    const unitB = units['ĐT-B1'] ?? '';
    users.nurse = await environment.loginAs('VT-09', unitA);
    users.otherNurse = await environment.loginAs('VT-09', unitB);
    users.homeroom = await environment.loginAs('VT-07', unitA);
    users.manager = await environment.loginAs('VT-03', unitA);
    users.otherManager = await environment.loginAs('VT-03', unitB);
    users.accountant = await environment.loginAs('VT-04', unitA);
    users.hr = await environment.loginAs('VT-06', unitA);
    users.parent = await environment.loginAs('VT-14', unitA);

    for (const [code, name, from, to, order] of [
      ['NT', 'Nhà trẻ 24-36 tháng', 24, 35, 1],
      ['MAM', 'Mầm', 36, 47, 2],
      ['LA', 'Lá', 60, 71, 3],
    ] as const) {
      await schoolYear
        .insertInto('grade_levels')
        .values({ code, name, age_from_months: from, age_to_months: to, order_no: order })
        .execute();
    }
    for (const [code, unit, grade] of [
      ['MAM-1', 'ĐT-A1', 'MAM'],
      ['LA-1', 'ĐT-A1', 'LA'],
      ['NT-B', 'ĐT-B1', 'NT'],
    ] as const) {
      classes[code] = (
        await schoolYear
          .insertInto('classes')
          .values({
            org_unit_id: units[unit] ?? '',
            academic_year_id: academicYearId,
            code,
            name: code,
            grade_level: grade,
            max_size: 25,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    await schoolYear
      .insertInto('class_staff_assignments')
      .values({
        class_id: classes['MAM-1'] ?? '',
        staff_user_id: users.homeroom?.userId ?? '',
        staff_name: 'Giáo viên chủ nhiệm',
        assignment_role: 'homeroom',
        subject_name: null,
        from_date: addDays(vietnamToday, -60),
      })
      .execute();
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: 'ME', name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    for (const [key, classCode, gender, months, profile] of [
      ['A', 'MAM-1', 'female', 40, { ethnicity: 'Kinh', religion: 'Không', can_swim: true }],
      ['B', 'MAM-1', 'male', 42, { ethnicity: 'Hoa', disability_type: 'Khuyết tật vận động', eye_disease: 'Cận thị' }],
      ['C', 'LA-1', 'female', 64, { ethnicity: 'Kinh', policy_target: 'Con hộ nghèo' }],
      ['D', 'NT-B', 'male', 30, null],
    ] as const) {
      const unit = classCode === 'NT-B' ? unitB : unitA;
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unit,
          full_name: `Học sinh ${key}`,
          dob: dobForMonths(months),
          gender,
          national_id_encrypted: 'ma-hoa',
          national_id_hash: randomUUID(),
          national_id_last4: '0000',
          photo_consent: 'pending',
          status: 'active',
          enroll_date: addDays(vietnamToday, -60),
          moet_profile: profile ? JSON.stringify(profile) : null,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      children[key] = child.id;
      await schoolYear
        .insertInto('class_enrollments')
        .values({ child_id: child.id, class_id: classes[classCode] ?? '', from_date: addDays(vietnamToday, -60) })
        .execute();
    }
    const guardian = await schoolYear
      .insertInto('guardians')
      .values({
        full_name: 'Mẹ A',
        phone: '0900000001',
        occupation: 'Giáo viên',
        user_id: users.parent?.userId ?? null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('child_guardians')
      .values({ child_id: children.A ?? '', guardian_id: guardian.id, relationship_item_id: relationship.id })
      .execute();

    for (const [key, unit, gender, profile] of [
      ['GV1', unitA, 'female', { professional_qualification: 'Đại học', job_position: 'Giáo viên mẫu giáo' }],
      ['GV2', unitA, 'female', { professional_qualification: 'Cao đẳng', contract_form: 'Viên chức' }],
      ['NV1', unitA, 'male', null],
      ['GVB', unitB, 'female', { professional_qualification: 'Đại học' }],
    ] as const) {
      staff[key] = (
        await schoolYear
          .insertInto('staff')
          .values({
            org_unit_id: unit,
            code: key,
            full_name: `Nhân sự ${key}`,
            dob: key === 'NV1' ? null : '1990-01-01',
            gender,
            phone: '0900000002',
            email: key === 'GV1' ? 'gv1@example.test' : null,
            address: null,
            id_number_encrypted: null,
            id_number_last4: null,
            start_date: addDays(vietnamToday, -300),
            moet_profile: profile ? JSON.stringify(profile) : null,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    await schoolYear
      .insertInto('employment_contracts')
      .values({
        staff_id: staff.NV1 ?? '',
        contract_no: 'HD-01',
        contract_type: 'indefinite',
        start_date: addDays(vietnamToday, -300),
        end_date: null,
        base_salary: 5_000_000,
        allowances: '[]',
      })
      .execute();
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-14a-4: y tế lập đợt cân đo; trùng tên, ngày sau hôm nay, y tế đơn vị khác bị từ chối', async () => {
    const create = (body: Record<string, unknown>, accessToken = token('nurse')) =>
      api('POST', '/growth-rounds', accessToken, {
        org_unit_id: units['ĐT-A1'],
        name: 'Cân đo tháng này',
        measured_on: vietnamToday,
        ...body,
      });
    const created = await create({});
    assert.equal(created.status, 201, JSON.stringify(created.body));
    roundId = created.body.id as string;
    const duplicate = await create({});
    assert.equal(duplicate.status, 422);
    assert.equal(errorOf(duplicate.body).rule_code, 'YCTD-102');
    assert.equal((await create({ name: 'Ngày mai', measured_on: addDays(vietnamToday, 1) })).status, 400);
    assert.equal((await create({ name: 'Khác' }, token('otherNurse'))).status, 403);
    assert.equal((await create({ name: 'Giáo viên' }, token('homeroom'))).status, 403);
    // Đợt lập nhầm, chưa có số đo thì xóa được
    const mistaken = await create({ name: 'Lập nhầm' });
    assert.equal((await api('DELETE', `/growth-rounds/${mistaken.body.id as string}`, token('nurse'))).status, 204);
    const listed = await api('GET', `/growth-rounds?org_unit_id=${units['ĐT-A1']}`, token('homeroom'));
    assert.equal(listed.status, 200, JSON.stringify(listed.body));
    assert.deepEqual(
      (listed.body as unknown as Array<{ name: string }>).map((round) => round.name),
      ['Cân đo tháng này'],
    );
    assert.equal((await api('GET', `/growth-rounds?org_unit_id=${units['ĐT-A1']}`, token('accountant'))).status, 200);
    assert.equal((await api('GET', `/growth-rounds?org_unit_id=${units['ĐT-A1']}`, token('parent'))).status, 403);
  });

  it('CT-14a-5: nhập số đo theo lớp, tính và lưu kênh tăng trưởng; giáo viên chỉ xem lớp mình', async () => {
    const path = `/growth-rounds/${roundId}/measurements`;
    const saved = await api('PUT', path, token('nurse'), {
      rows: [
        { child_id: children.A, weight_kg: '10,5', height_cm: 88 },
        { child_id: children.B, weight_kg: 15.2, height_cm: 100.4, note: 'Đo buổi sáng' },
      ],
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.saved_count, 2);
    const grid = await api('GET', `${path}?class_id=${classes['MAM-1']}`, token('homeroom'));
    assert.equal(grid.status, 200, JSON.stringify(grid.body));
    assert.equal(grid.body.can_edit, false);
    const rows = grid.body.rows as GridRow[];
    const childA = rows.find((row) => row.child_id === children.A);
    assert.equal(childA?.weight_kg, 10.5);
    assert.equal(childA?.assessment.age_months, 40);
    assert.equal(childA?.assessment.weight_status, 'underweight');
    assert.equal(childA?.assessment.height_status, 'stunted');
    assert.equal(rows.find((row) => row.child_id === children.B)?.assessment.weight_status, 'normal');
    // Giáo viên không ghi được; lớp khác không xem được
    assert.equal(
      (await api('PUT', path, token('homeroom'), { rows: [{ child_id: children.A, weight_kg: 11 }] })).status,
      403,
    );
    assert.equal((await api('GET', `${path}?class_id=${classes['LA-1']}`, token('homeroom'))).status, 403);
    // Trẻ đơn vị khác, số đo ngoài khoảng
    const otherUnit = await api('PUT', path, token('nurse'), { rows: [{ child_id: children.D, weight_kg: 12 }] });
    assert.ok([403, 422].includes(otherUnit.status), JSON.stringify(otherUnit.body));
    assert.equal(
      (await api('PUT', path, token('nurse'), { rows: [{ child_id: children.A, weight_kg: 500 }] })).status,
      400,
    );
    // Có số đo thì không xóa đợt được
    const remove = await api('DELETE', `/growth-rounds/${roundId}`, token('nurse'));
    assert.equal(remove.status, 422);
    assert.equal(errorOf(remove.body).rule_code, 'YCTD-102');
    // Để trống cả hai số đo là xóa số đo của trẻ trong đợt
    const cleared = await api('PUT', path, token('nurse'), {
      rows: [{ child_id: children.B, weight_kg: null, height_cm: null }],
    });
    assert.equal(cleared.body.removed_count, 1);
    // Biểu đồ của trẻ: phụ huynh xem con mình
    const chart = await api('GET', `/children/${children.A}/growth`, token('parent'));
    assert.equal(chart.status, 200, JSON.stringify(chart.body));
    assert.equal((chart.body.points as unknown[]).length, 1);
    assert.ok((chart.body.curves as { weight_for_age: unknown[] }).weight_for_age.length > 10);
  });

  it('CT-14a-6: tệp mẫu có danh sách lớp; nhập Excel có lỗi thì không lưu dòng nào, đúng thì lưu', async () => {
    const response = await fetch(
      `${environment.baseUrl}/growth-rounds/${roundId}/template?class_id=${classes['MAM-1']}`,
      { headers: { authorization: `Bearer ${token('nurse')}` } },
    );
    assert.equal(response.status, 200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()) as never);
    const sheet = workbook.getWorksheet('Cân đo');
    assert.equal(sheet?.rowCount, 3);
    // Dòng của học sinh B: sửa cân nặng sai; dòng thêm theo họ tên và ngày sinh không có mã
    const rowOf = (name: string) =>
      [2, 3].map((index) => sheet?.getRow(index)).find((row) => row?.getCell(2).value === name);
    const rowB = rowOf('Học sinh B');
    assert.ok(rowB);
    rowB.getCell(5).value = 'nặng';
    const broken = Buffer.from(await workbook.xlsx.writeBuffer());
    const failed = await upload(`/growth-rounds/${roundId}/import`, token('nurse'), broken);
    assert.equal(failed.status, 200, JSON.stringify(failed.body));
    assert.equal(failed.body.saved_count, 0);
    assert.equal((failed.body.errors as unknown[]).length, 1);
    rowB.getCell(5).value = 16;
    rowB.getCell(6).value = 101;
    rowB.getCell(1).value = '';
    const fixed = Buffer.from(await workbook.xlsx.writeBuffer());
    const imported = await upload(`/growth-rounds/${roundId}/import`, token('nurse'), fixed);
    assert.equal(imported.status, 200, JSON.stringify(imported.body));
    assert.equal(imported.body.saved_count, 2);
    assert.equal((await upload(`/growth-rounds/${roundId}/import`, token('homeroom'), fixed)).status, 403);
  });

  it('CT-14a-7: tổng hợp theo lớp, khối, lọc giới tính và kênh; xuất Excel ghi nhật ký; ngoài quyền bị từ chối', async () => {
    const report = await api('GET', `/reports/growth?round_id=${roundId}`, token('manager'));
    assert.equal(report.status, 200, JSON.stringify(report.body));
    const totals = report.body.totals as Record<string, number>;
    assert.equal(totals.enrolled, 3);
    assert.equal(totals.measured, 2);
    assert.equal(totals.underweight, 1);
    assert.equal(totals.underweight_female, 1);
    assert.deepEqual(
      (report.body.classes as Array<{ class_name: string; enrolled: number }>).map((row) => [
        row.class_name,
        row.enrolled,
      ]),
      [
        ['MAM-1', 2],
        ['LA-1', 1],
      ],
    );
    assert.equal((report.body.grades as unknown[]).length, 2);
    const month = vietnamToday.slice(0, 7);
    const principalReport = await sendJson(
      'GET',
      `${environment.baseUrl}/reports/growth?month=${month}&gender=female&channel=underweight`,
      principal.accessToken,
    );
    assert.equal(principalReport.status, 200, JSON.stringify(principalReport.body));
    assert.equal((principalReport.body.totals as Record<string, number>).enrolled, 2);
    assert.deepEqual(
      (principalReport.body.children as Array<{ full_name: string }>).map((row) => row.full_name),
      ['Học sinh A'],
    );
    assert.equal((await api('GET', '/reports/growth', token('manager'))).status, 400);
    assert.equal((await api('GET', `/reports/growth?round_id=${roundId}`, token('otherManager'))).status, 403);
    assert.equal((await api('GET', `/reports/growth?round_id=${roundId}`, token('accountant'))).status, 403);
    const exported = await fetch(`${environment.baseUrl}/reports/growth/export?round_id=${roundId}`, {
      headers: { authorization: `Bearer ${token('manager')}` },
    });
    assert.equal(exported.status, 200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(await exported.arrayBuffer()) as never);
    assert.deepEqual(
      workbook.worksheets.map((sheet) => sheet.name),
      ['Theo lớp', 'Theo khối', 'Danh sách học sinh'],
    );
    assert.equal(
      workbook.getWorksheet('Danh sách học sinh')?.getRow(2).getCell(15).value,
      'Suy dinh dưỡng thể nhẹ cân',
    );
    const log = await schoolYear
      .selectFrom('export_logs')
      .select(['report_code', 'row_count', 'contains_personal_data'])
      .where('id', '=', exported.headers.get('x-export-log-id') ?? '')
      .executeTakeFirstOrThrow();
    assert.deepEqual(log, { report_code: 'growth', row_count: 3, contains_personal_data: true });
  });

  it('CT-14a-8: thống kê lớp học theo nhóm tuổi và học sinh theo độ tuổi, dân tộc, khuyết tật, chính sách, biết bơi, mắt', async () => {
    const classStats = await api('GET', '/statistics/classes', principal.accessToken);
    assert.equal(classStats.status, 200, JSON.stringify(classStats.body));
    const groups = classStats.body.groups as Array<{ key: string; class_count: number; children_count: number }>;
    const group = (key: string) => groups.find((item) => item.key === key);
    assert.equal(group('months_25_36')?.class_count, 1);
    assert.equal(group('years_3_4')?.children_count, 2);
    assert.equal(group('years_5_6')?.class_count, 1);
    assert.equal((classStats.body.totals as Record<string, number>).class_count, 3);
    const unitStats = await api('GET', `/statistics/children?org_unit_id=${units['ĐT-A1']}`, token('manager'));
    assert.equal(unitStats.status, 200, JSON.stringify(unitStats.body));
    assert.deepEqual(unitStats.body.totals, { children_count: 3, female_count: 2 });
    const byAge = unitStats.body.by_age as Array<{ key: string; count: number }>;
    assert.equal(byAge.find((item) => item.key === 'years_3_4')?.count, 2);
    assert.equal(byAge.find((item) => item.key === 'years_5_6')?.count, 1);
    assert.deepEqual(
      (unitStats.body.by_ethnicity as Array<{ value: string; count: number }>).map((item) => [item.value, item.count]),
      [
        ['Kinh', 2],
        ['Hoa', 1],
      ],
    );
    assert.equal((unitStats.body.disability as { count: number }).count, 1);
    assert.equal((unitStats.body.policy as { count: number }).count, 1);
    assert.equal((unitStats.body.swimming as { count: number }).count, 1);
    assert.equal((unitStats.body.eye_disease as { count: number }).count, 1);
    assert.equal(
      (await api('GET', `/statistics/children?org_unit_id=${units['ĐT-A1']}`, token('otherManager'))).status,
      403,
    );
    assert.equal((await api('GET', '/statistics/children', token('homeroom'))).status, 403);
    assert.equal((await api('GET', '/statistics/children', token('hr'))).status, 403);
  });

  it('CT-14a-9: thống kê nhân sự theo trình độ, vị trí việc làm, hình thức hợp đồng', async () => {
    const stats = await api('GET', '/statistics/staff', token('hr'));
    assert.equal(stats.status, 200, JSON.stringify(stats.body));
    assert.deepEqual(stats.body.totals, { staff_count: 3, female_count: 2 });
    const pairs = (key: string) =>
      (stats.body[key] as Array<{ value: string; count: number }>).map((item) => [item.value, item.count]);
    assert.deepEqual(pairs('by_qualification'), [
      ['Cao đẳng', 1],
      ['Chưa nhập', 1],
      ['Đại học', 1],
    ]);
    assert.deepEqual(pairs('by_contract_form'), [
      ['Chưa nhập', 1],
      ['Hợp đồng không xác định thời hạn', 1],
      ['Viên chức', 1],
    ]);
    const whole = await api('GET', '/statistics/staff', principal.accessToken);
    assert.equal((whole.body.totals as Record<string, number>).staff_count, 4);
    assert.equal((await api('GET', '/statistics/staff', token('nurse'))).status, 403);
  });

  it('CT-14a-10: hồ sơ học sinh, nhân sự chưa nhập đủ: số lượng theo trường, danh sách khi chọn trường', async () => {
    const childFields = await api(
      'GET',
      `/statistics/missing-child-fields?org_unit_id=${units['ĐT-A1']}`,
      token('manager'),
    );
    assert.equal(childFields.status, 200, JSON.stringify(childFields.body));
    const count = (body: Record<string, unknown>, key: string) =>
      (body.fields as Array<{ key: string; missing_count: number }>).find((item) => item.key === key)?.missing_count;
    assert.equal(childFields.body.total, 3);
    assert.equal(count(childFields.body, 'religion'), 2);
    assert.equal(count(childFields.body, 'guardian_name'), 2);
    assert.equal(count(childFields.body, 'full_name'), 0);
    const religion = await api(
      'GET',
      `/statistics/missing-child-fields?org_unit_id=${units['ĐT-A1']}&field=religion`,
      token('manager'),
    );
    assert.deepEqual(
      (religion.body.records as Array<{ full_name: string; class_name: string }>).map((row) => [
        row.full_name,
        row.class_name,
      ]),
      [
        ['Học sinh C', 'LA-1'],
        ['Học sinh B', 'MAM-1'],
      ],
    );
    assert.equal((await api('GET', '/statistics/missing-child-fields?field=khong-co', token('manager'))).status, 400);
    const staffFields = await api('GET', '/statistics/missing-staff-fields?field=email', token('hr'));
    assert.equal(staffFields.status, 200, JSON.stringify(staffFields.body));
    assert.equal(count(staffFields.body, 'email'), 2);
    assert.equal(count(staffFields.body, 'contract'), 1);
    assert.equal(count(staffFields.body, 'dob'), 1);
    assert.deepEqual((staffFields.body.records as Array<{ code: string }>).map((row) => row.code).sort(), [
      'GV2',
      'NV1',
    ]);
    assert.equal((await api('GET', '/statistics/missing-staff-fields', token('homeroom'))).status, 403);
  });
});
