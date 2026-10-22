import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { nextGradeLevel, type GradeProgressionItem } from '@school-management/shared';
import { openTestAcademicYear, sendJson, startApiTestEnvironment, type ApiTestEnvironment } from '../test-support.js';

// Cấu trúc theo cấp học (DT-19 phần 19b, YCTD-152): khối, chương trình, lớp, đơn vị, học kỳ và tuần theo cấp. Kịch bản
// CT-19b-1 đến CT-19b-8
interface Row {
  [key: string]: unknown;
}

const errorOf = (body: Record<string, unknown>) =>
  body.error as { code?: string; rule_code?: string; details?: Array<{ field: string }> } | undefined;

describe('Cấu trúc theo cấp học (YCTD-152)', () => {
  let environment: ApiTestEnvironment;
  let principal: string;
  let academicYearId: string;
  const units: Record<string, string> = {};

  const api = (method: string, path: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, principal, body);
  const rows = (body: unknown) => body as unknown as Row[];

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = (await environment.loginAs('VT-02', null)).accessToken;
    academicYearId = await openTestAcademicYear(environment, principal, '2026–2027', {
      first_term: { start_date: '2026-09-07', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-28' },
    });
    for (const [code, type] of [
      ['TC', 'truong_chinh'],
      ['DT-A', 'diem_truong'],
    ] as const) {
      const created = await api('POST', '/org-units', { code, name: `Đơn vị ${code}`, unit_type: type });
      units[code] = created.body.id as string;
    }
    await api('POST', '/grade-levels', { code: 'LA', name: 'Lá', age_from_months: 60, age_to_months: 71, order_no: 3 });
  });

  after(async () => {
    await environment.close();
  });

  it('CT-19b-1: khối Mầm non bắt buộc tháng tuổi; khối Tiểu học bỏ trống được; cấp của khối không đổi', async () => {
    // Cấp chưa bật ở bảng cấp học của trường (19a) thì không tạo khối, không nạp khối mẫu
    const disabled = await api('POST', '/grade-levels', { code: 'K0', name: 'Khối 0', school_level: 'TH' });
    assert.equal(disabled.status, 422);
    assert.equal(errorOf(disabled.body)?.rule_code, 'YCTD-152');
    assert.equal((await api('POST', '/grade-levels/templates', { school_level: 'TH' })).status, 422);
    const levels = (await api('GET', '/school-levels')).body.levels as Row[];
    const enabled = await api('PUT', '/school-levels', {
      levels: levels.map((level) => ({
        code: level.code,
        is_enabled: level.code === 'MN' || level.code === 'TH',
        order_no: level.order_no,
        display_name: level.display_name,
        learner_term: level.learner_term,
        context_label: level.context_label,
      })),
    });
    assert.equal(enabled.status, 200, JSON.stringify(enabled.body));
    const missingAge = await api('POST', '/grade-levels', { code: 'CHOI', name: 'Chồi' });
    assert.equal(missingAge.status, 400);
    assert.deepEqual(
      errorOf(missingAge.body)
        ?.details?.map((detail) => detail.field)
        .sort(),
      ['age_from_months', 'age_to_months'],
    );
    const halfAge = await api('POST', '/grade-levels', {
      code: 'TH0',
      name: 'Lớp lá liên cấp',
      school_level: 'TH',
      age_from_months: 60,
    });
    assert.equal(halfAge.status, 400);
    const wrongLevel = await api('POST', '/grade-levels', { code: 'X', name: 'X', school_level: 'DH' });
    assert.equal(wrongLevel.status, 400);

    const listed = rows((await api('GET', '/grade-levels')).body);
    assert.equal(listed.find((grade) => grade.code === 'LA')?.school_level, 'MN');
    const la = listed.find((grade) => grade.code === 'LA');
    assert.equal((await api('PATCH', `/grade-levels/${la?.id as string}`, { school_level: 'TH' })).status, 400);
  });

  it('CT-19b-2: nạp khối mẫu Tiểu học K1 đến K5 không tháng tuổi; nạp lại bỏ qua mã đã có; Mầm non không có khối mẫu', async () => {
    const loaded = await api('POST', '/grade-levels/templates', { school_level: 'TH' });
    assert.equal(loaded.status, 200, JSON.stringify(loaded.body));
    assert.deepEqual(
      rows(loaded.body.created).map((grade) => grade.code),
      ['K1', 'K2', 'K3', 'K4', 'K5'],
    );
    assert.equal(rows(loaded.body.created)[0]?.age_from_months, null);
    const again = await api('POST', '/grade-levels/templates', { school_level: 'TH' });
    assert.deepEqual(again.body.skipped, ['K1', 'K2', 'K3', 'K4', 'K5']);
    const mn = await api('POST', '/grade-levels/templates', { school_level: 'MN' });
    assert.equal(mn.status, 422);
    assert.equal(errorOf(mn.body)?.rule_code, 'YCTD-152');
    const th = rows((await api('GET', '/grade-levels?school_level=TH')).body);
    assert.equal(th.length, 5);
  });

  it('CT-19b-3: chương trình mặc định Mầm non nạp sẵn; mỗi cấp một mặc định; khối áp dụng phải cùng cấp', async () => {
    const initial = rows((await api('GET', '/curricula')).body);
    assert.deepEqual(
      initial.map((item) => [item.code, item.school_level, item.is_default]),
      [['CT-GDMN', 'MN', true]],
    );
    const wrongGrade = await api('POST', '/curricula', {
      code: 'CT-TH-1',
      name: 'Chương trình Tiểu học',
      school_level: 'TH',
      grade_level_codes: ['LA'],
    });
    assert.equal(wrongGrade.status, 422);
    const first = await api('POST', '/curricula', {
      code: 'CT-TH',
      name: 'Chương trình giáo dục phổ thông cấp Tiểu học',
      school_level: 'TH',
      is_default: true,
    });
    assert.equal(first.status, 201, JSON.stringify(first.body));
    const second = await api('POST', '/curricula', {
      code: 'CT-TH-12',
      name: 'Chương trình khối 1, 2',
      school_level: 'TH',
      grade_level_codes: ['K1', 'K2'],
      is_default: true,
    });
    assert.equal(second.status, 201, JSON.stringify(second.body));
    const th = rows((await api('GET', '/curricula?school_level=TH')).body);
    assert.deepEqual(
      th.map((item) => [item.code, item.is_default]),
      [
        ['CT-TH', false],
        ['CT-TH-12', true],
      ],
    );
    const unsetDefault = await api('PATCH', `/curricula/${second.body.id as string}`, { is_default: false });
    assert.equal(unsetDefault.status, 422);
    const deactivate = await api('PATCH', `/curricula/${second.body.id as string}`, { status: 'inactive' });
    assert.equal(deactivate.status, 422);
    await api('PATCH', `/curricula/${first.body.id as string}`, { is_default: true });
  });

  it('CT-19b-4: lớp lấy cấp theo khối; lớp Tiểu học không có nhóm tuổi, ghép, học 2 buổi; chương trình cùng cấp', async () => {
    // Điểm trường A chỉ có Mầm non nên không mở được lớp Tiểu học
    const noLevel = await api('POST', '/classes', {
      org_unit_id: units['DT-A'],
      code: '1B',
      name: 'Lớp 1B',
      grade_level: 'K1',
      max_size: 35,
    });
    assert.equal(noLevel.status, 422);
    assert.equal(errorOf(noLevel.body)?.rule_code, 'YCTD-152');
    assert.equal((await api('PUT', `/org-units/${units.TC}/levels`, { school_levels: ['TH', 'MN'] })).status, 200);
    const withAgeGroup = await api('POST', '/classes', {
      org_unit_id: units.TC,
      code: '1A',
      name: 'Lớp 1A',
      grade_level: 'K1',
      max_size: 35,
      age_group: 'years_5_6',
      is_combined: true,
    });
    assert.equal(withAgeGroup.status, 422);
    assert.equal(errorOf(withAgeGroup.body)?.rule_code, 'YCTD-152');
    assert.deepEqual(
      errorOf(withAgeGroup.body)
        ?.details?.map((detail) => detail.field)
        .sort(),
      ['age_group', 'is_combined'],
    );
    const mnCurriculum = rows((await api('GET', '/curricula?school_level=MN')).body)[0];
    const wrongCurriculum = await api('POST', '/classes', {
      org_unit_id: units.TC,
      code: '1A',
      name: 'Lớp 1A',
      grade_level: 'K1',
      max_size: 35,
      curriculum_id: mnCurriculum?.id,
    });
    assert.equal(wrongCurriculum.status, 422);
    const created = await api('POST', '/classes', {
      org_unit_id: units.TC,
      code: '1A',
      name: 'Lớp 1A',
      grade_level: 'K1',
      max_size: 35,
      boarding: true,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.school_level, 'TH');
    const mnClass = await api('POST', '/classes', {
      org_unit_id: units.TC,
      code: 'LA1',
      name: 'Lá 1',
      grade_level: 'LA',
      max_size: 30,
    });
    assert.equal(mnClass.body.school_level, 'MN');

    const listed = rows((await api('GET', '/classes')).body);
    const th = listed.find((row) => row.code === '1A');
    const la = listed.find((row) => row.code === 'LA1');
    assert.equal(th?.age_group, null);
    assert.equal(th?.stage, null);
    assert.equal(th?.curriculum_name, 'Chương trình giáo dục phổ thông cấp Tiểu học');
    assert.equal(la?.age_group, 'years_5_6');
    assert.equal(la?.stage, 'mau_giao');
    assert.equal(la?.curriculum_name, 'Chương trình giáo dục mầm non');
    assert.deepEqual(
      rows((await api('GET', '/classes?school_level=TH')).body).map((row) => row.code),
      ['1A'],
    );
    // Đổi khối Mầm non sang khối Tiểu học thì lớp đổi cấp theo khối
    const moved = await api('PATCH', `/classes/${mnClass.body.id as string}`, { grade_level: 'K2' });
    assert.equal(moved.status, 200, JSON.stringify(moved.body));
    assert.equal(moved.body.school_level, 'TH');
    const twoSessions = await api('PATCH', `/classes/${mnClass.body.id as string}`, { two_sessions_per_day: true });
    assert.equal(twoSessions.status, 422);
  });

  it('CT-19b-5: đơn vị mới lấy cấp của Trường chính; không bỏ được cấp đang có lớp; phải chọn ít nhất một cấp', async () => {
    const levels = rows((await api('GET', '/org-units/levels')).body);
    assert.deepEqual(levels.find((row) => row.org_unit_id === units['DT-A'])?.school_levels, ['MN']);
    assert.deepEqual(levels.find((row) => row.org_unit_id === units.TC)?.school_levels, ['MN', 'TH']);
    const branch = await api('POST', '/org-units', { code: 'DT-B', name: 'Điểm trường B', unit_type: 'diem_truong' });
    const after = rows((await api('GET', '/org-units/levels')).body);
    assert.deepEqual(after.find((row) => row.org_unit_id === branch.body.id)?.school_levels, ['MN', 'TH']);
    const removeTh = await api('PUT', `/org-units/${units.TC}/levels`, { school_levels: ['MN'] });
    assert.equal(removeTh.status, 422);
    assert.equal((await api('PUT', `/org-units/${units.TC}/levels`, { school_levels: [] })).status, 400);
  });

  it('CT-19b-6: lịch riêng của cấp không đổi lịch chung; cấp chưa khai báo theo lịch chung; bỏ lịch riêng', async () => {
    const before = await api('GET', `/academic-years/${academicYearId}/calendar`);
    const inherited = await api('GET', `/academic-years/${academicYearId}/calendar?school_level=TH`);
    assert.equal(inherited.body.inherited, true);
    assert.deepEqual(inherited.body.first_term, before.body.first_term);
    const blocked = await api('PATCH', `/academic-years/${academicYearId}/weeks?school_level=TH`, {
      weeks: [{ week_no: 1, is_off: true }],
    });
    assert.equal(blocked.status, 422);

    const saved = await api('PUT', `/academic-years/${academicYearId}/calendar?school_level=TH`, {
      first_term: { start_date: '2026-09-05', end_date: '2027-01-10' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-31' },
      summer_term: null,
      school_days_of_week: [1, 2, 3, 4, 5, 6],
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.inherited, false);
    assert.deepEqual(saved.body.school_days_of_week, [1, 2, 3, 4, 5, 6]);
    const common = await api('GET', `/academic-years/${academicYearId}/calendar`);
    assert.deepEqual(common.body, before.body);
    const commonWeeks = rows((await api('GET', `/academic-years/${academicYearId}/weeks`)).body);
    assert.ok(commonWeeks.every((week) => week.school_level === null));
    const thWeeks = rows((await api('GET', `/academic-years/${academicYearId}/weeks?school_level=TH`)).body);
    assert.ok(thWeeks.length > 0 && thWeeks.every((week) => week.school_level === 'TH'));
    const marked = await api('PATCH', `/academic-years/${academicYearId}/weeks?school_level=TH`, {
      weeks: [{ week_no: 2, is_off: true, note: 'Nghỉ riêng Tiểu học' }],
    });
    assert.equal(marked.status, 200, JSON.stringify(marked.body));
    const commonAfter = rows((await api('GET', `/academic-years/${academicYearId}/weeks`)).body);
    assert.equal(commonAfter.find((week) => week.week_no === 2)?.is_off, false);

    const reset = await api('DELETE', `/academic-years/${academicYearId}/calendar?school_level=TH`);
    assert.equal(reset.status, 200, JSON.stringify(reset.body));
    assert.equal(reset.body.inherited, true);
  });

  it('CT-19b-7: khối kế tiếp trong cùng cấp; khối cuối cấp sang cấp kế đang bật, không thì hoàn thành cấp học', async () => {
    const next = await api('GET', '/grade-levels/next?code=K1');
    assert.deepEqual(next.body, { kind: 'grade', code: 'K2', school_level: 'TH' });
    const last = await api('GET', '/grade-levels/next?code=K5');
    assert.deepEqual(last.body, { kind: 'completed', school_level: 'TH' });
    const fromMn = await api('GET', '/grade-levels/next?code=LA');
    assert.deepEqual(fromMn.body, { kind: 'grade', code: 'K1', school_level: 'TH' });

    const grades: GradeProgressionItem[] = [
      { code: 'NT', school_level: 'MN', order_no: 1, status: 'active' },
      { code: 'LA', school_level: 'MN', order_no: 3, status: 'active' },
      { code: 'K5', school_level: 'TH', order_no: 105, status: 'active' },
      { code: 'K6', school_level: 'THCS', order_no: 106, status: 'active' },
    ];
    assert.deepEqual(nextGradeLevel(grades, ['MN'], 'LA'), { kind: 'completed', school_level: 'MN' });
    assert.deepEqual(nextGradeLevel(grades, ['MN', 'TH', 'THCS'], 'K5'), {
      kind: 'grade',
      code: 'K6',
      school_level: 'THCS',
    });
    assert.equal(nextGradeLevel(grades, ['MN'], 'KHONG'), null);
  });

  it('CT-19b-8: lịch chung của trường chỉ có Mầm non giữ nguyên: đọc lịch, tuần không có cấp riêng', async () => {
    const calendar = await api('GET', `/academic-years/${academicYearId}/calendar`);
    assert.equal(calendar.body.school_level, null);
    assert.equal(calendar.body.inherited, false);
    assert.deepEqual(calendar.body.first_term, { start_date: '2026-09-07', end_date: '2027-01-15' });
  });
});
