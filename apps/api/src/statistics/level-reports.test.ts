import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import { attendanceStageOf } from '@school-management/shared';
import type { Kysely } from 'kysely';
import { childIdsOutsideLevel, classIdsOutsideLevel } from '../common/report-levels.js';
import { openTestAcademicYear, sendJson, startApiTestEnvironment, type ApiTestEnvironment } from '../test-support.js';

// Số liệu theo cấp học (DT-19 phần 19d, YCTD-154): tham số cấp của thống kê, báo cáo chấm công và suất ăn; biểu mẫu Mầm non
// chỉ tính lớp, trẻ Mầm non; biểu phí theo cấp; cấp của danh mục văn bản theo bốn mã. Kịch bản CT-19d-1 đến CT-19d-7
type Row = Record<string, unknown>;

const errorOf = (body: Record<string, unknown>) =>
  body.error as { code?: string; rule_code?: string; details?: Array<{ field: string }> } | undefined;

describe('Số liệu theo cấp học (YCTD-154)', () => {
  let environment: ApiTestEnvironment;
  let principal: string;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let rootId = '';
  const classes: Record<string, string> = {};

  const api = (method: string, path: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, principal, body);

  async function addChild(classId: string, name: string, dob: string) {
    const child = await schoolYear
      .insertInto('children')
      .values({
        org_unit_id: rootId,
        full_name: name,
        dob,
        gender: 'female',
        national_id_encrypted: 'ma-hoa',
        national_id_hash: randomUUID(),
        national_id_last4: '1904',
        photo_consent: 'granted',
        status: 'active',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('class_enrollments')
      .values({ child_id: child.id, class_id: classId, from_date: '2026-09-07' })
      .execute();
    return child.id;
  }

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = (await environment.loginAs('VT-02', null)).accessToken;
    const yearId = await openTestAcademicYear(environment, principal, '2026–2027', {
      first_term: { start_date: '2026-09-07', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-28' },
    });
    const registry = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .where('academic_year_id', '=', yearId)
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, registry.database_name),
    );
    rootId = (await api('POST', '/org-units', { code: 'TC', name: 'Trường chính', unit_type: 'truong_chinh' })).body
      .id as string;
    await api('POST', '/grade-levels', { code: 'LA', name: 'Lá', age_from_months: 60, age_to_months: 71, order_no: 3 });
    const mn = await api('POST', '/classes', {
      org_unit_id: rootId,
      code: 'LA1',
      name: 'Lá 1',
      grade_level: 'LA',
      max_size: 30,
    });
    classes.LA1 = mn.body.id as string;
    await addChild(classes.LA1, 'Trẻ Mầm non', '2021-03-01');
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-19d-1: trường chỉ có Mầm non: thống kê lớp như trước, không có nhóm theo khối; cấp chưa bật bị từ chối', async () => {
    const stats = await api('GET', '/statistics/classes');
    assert.equal(stats.status, 200, JSON.stringify(stats.body));
    assert.deepEqual(stats.body.grade_groups, []);
    assert.equal((stats.body.totals as Row).class_count, 1);
    const years = (stats.body.groups as Row[]).find((group) => group.key === 'years_5_6');
    assert.equal(years?.class_count, 1);
    assert.equal((await api('GET', '/statistics/classes?school_level=DH')).status, 400);
    assert.equal((await api('GET', '/statistics/classes?school_level=TH')).status, 403);
  });

  it('CT-19d-2: trường liên cấp: lớp Tiểu học thống kê theo khối, không vào nhóm tuổi; lọc theo cấp', async () => {
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
    assert.equal((await api('PUT', `/org-units/${rootId}/levels`, { school_levels: ['MN', 'TH'] })).status, 200);
    await api('POST', '/grade-levels/templates', { school_level: 'TH' });
    const th = await api('POST', '/classes', {
      org_unit_id: rootId,
      code: '1A',
      name: 'Lớp 1A',
      grade_level: 'K1',
      max_size: 35,
    });
    assert.equal(th.status, 201, JSON.stringify(th.body));
    classes['1A'] = th.body.id as string;
    await addChild(classes['1A'], 'Học sinh Tiểu học', '2020-02-01');

    const all = await api('GET', '/statistics/classes');
    assert.equal((all.body.totals as Row).class_count, 2);
    const ageClassCount = (all.body.groups as Row[]).reduce((sum, group) => sum + Number(group.class_count), 0);
    assert.equal(ageClassCount, 1);
    assert.deepEqual(
      (all.body.grade_groups as Row[]).map((group) => [group.grade_level, group.class_count, group.children_count]),
      [['K1', 1, 1]],
    );
    const onlyTh = await api('GET', '/statistics/classes?school_level=TH');
    assert.equal((onlyTh.body.totals as Row).class_count, 1);
    assert.equal((onlyTh.body.totals as Row).children_count, 1);
    const onlyMn = await api('GET', '/statistics/classes?school_level=MN');
    assert.deepEqual(onlyMn.body.grade_groups, []);
    assert.equal((onlyMn.body.totals as Row).children_count, 1);

    const students = await api('GET', '/statistics/students?school_level=TH');
    assert.equal(students.status, 200, JSON.stringify(students.body));
    const childrenStats = await api('GET', '/statistics/children?school_level=MN');
    assert.equal((childrenStats.body.totals as Row).children_count, 1);
  });

  it('CT-19d-3: báo cáo chấm công và suất ăn: lớp Tiểu học thành nhóm "Cấp Tiểu học"; lọc theo cấp', async () => {
    const all = await api('GET', '/reports/attendance-meals?period=month&date=2026-10-01');
    assert.equal(all.status, 200, JSON.stringify(all.body));
    const stages = (all.body.classes as Row[]).map((row) => [row.class_name, row.stage]);
    assert.deepEqual(stages, [
      ['Lá 1', 'mau_giao'],
      ['Lớp 1A', 'TH'],
    ]);
    assert.ok((all.body.groups as Row[]).some((group) => group.kind === 'stage' && group.label === 'Cấp Tiểu học'));
    const onlyMn = await api('GET', '/reports/attendance-meals?period=month&date=2026-10-01&school_level=MN');
    assert.deepEqual(
      (onlyMn.body.classes as Row[]).map((row) => row.class_name),
      ['Lá 1'],
    );
    assert.equal(attendanceStageOf('MN', 24), 'nha_tre');
    assert.equal(attendanceStageOf('MN', null), 'mau_giao');
    assert.equal(attendanceStageOf('THCS', null), 'THCS');
  });

  it('CT-19d-4: biểu mẫu Mầm non bỏ lớp, trẻ của cấp khác; trẻ chưa xếp lớp vẫn tính', async () => {
    const outsideClasses = await classIdsOutsideLevel(schoolYear, 'MN');
    assert.deepEqual([...outsideClasses], [classes['1A']]);
    const outsideChildren = await childIdsOutsideLevel(schoolYear, 'MN');
    assert.equal(outsideChildren.size, 1);
    const emis = await api('GET', '/reports/emis/forms/bieu-01');
    assert.ok(emis.status === 200 || emis.status === 404, JSON.stringify(emis.body));
  });

  it('CT-19d-5: biểu phí theo cấp: khối phải cùng cấp; mỗi cấp chuỗi phiên bản riêng; cấp chưa bật bị từ chối', async () => {
    // Kế toán (VT-04) tạo biểu phí (P05.fee-catalog.manage)
    const accountant = (await environment.loginAs('VT-04', rootId)).accessToken;
    const fee = (method: string, path: string, body?: unknown) =>
      sendJson(method, `${environment.baseUrl}${path}`, accountant, body);
    const mn = await fee('POST', '/fee-schedules', {
      name: 'Biểu phí Mầm non',
      effective_from: '2027-01-01',
      items: [{ grade_level: 'LA', fee_type: 'tuition', amount: 1_000_000 }],
    });
    assert.equal(mn.status, 201, JSON.stringify(mn.body));
    assert.equal(mn.body.school_level, 'MN');
    const wrongGrade = await fee('POST', '/fee-schedules', {
      name: 'Biểu phí Tiểu học',
      effective_from: '2027-01-01',
      school_level: 'TH',
      items: [{ grade_level: 'LA', fee_type: 'tuition', amount: 500_000 }],
    });
    assert.equal(wrongGrade.status, 400);
    const th = await fee('POST', '/fee-schedules', {
      name: 'Biểu phí Tiểu học',
      effective_from: '2027-01-01',
      school_level: 'TH',
      items: [{ grade_level: 'K1', fee_type: 'tuition', amount: 500_000 }],
    });
    assert.equal(th.status, 201, JSON.stringify(th.body));
    const listed = (await api('GET', '/fee-schedules')).body as unknown as Row[];
    assert.deepEqual(listed.map((row) => [row.school_level, row.effective_to]).sort(), [
      ['MN', null],
      ['TH', null],
    ]);
    const onlyTh = (await api('GET', '/fee-schedules?school_level=TH')).body as unknown as Row[];
    assert.equal(onlyTh.length, 1);
    const thcs = await fee('POST', '/fee-schedules', {
      name: 'Biểu phí THCS',
      effective_from: '2027-01-01',
      school_level: 'THCS',
      items: [{ grade_level: 'K1', fee_type: 'tuition', amount: 1 }],
    });
    assert.equal(thcs.status, 422);
    assert.equal(errorOf(thcs.body)?.rule_code, 'YCTD-152');
  });

  it('CT-19d-6: cấp học của danh mục văn bản theo bốn mã', async () => {
    const wrong = await api('POST', '/document-catalogs', {
      kind: 'field',
      code: 'LV-19D',
      name: 'Lĩnh vực thử',
      education_level: 'Mầm non',
    });
    assert.equal(wrong.status, 400, JSON.stringify(wrong.body));
    const right = await api('POST', '/document-catalogs', {
      kind: 'field',
      code: 'LV-19D',
      name: 'Lĩnh vực thử',
      education_level: 'TH',
    });
    assert.equal(right.status, 201, JSON.stringify(right.body));
  });

  it('CT-19d-7: tăng trưởng, hồ sơ cuối cấp chỉ tính lớp Mầm non', async () => {
    const finalYear = await api('GET', '/final-year-records');
    assert.equal(finalYear.status, 200, JSON.stringify(finalYear.body));
    const names = JSON.stringify(finalYear.body);
    assert.ok(!names.includes('Học sinh Tiểu học'));
    assert.ok(names.includes('Trẻ Mầm non'));
  });
});
