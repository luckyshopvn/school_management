import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import type { KpiRuleConfig } from '@school-management/shared';
import ExcelJS from 'exceljs';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { buildDocx } from './kpi-documents.js';
import {
  evaluationTotals,
  excellentQuota,
  lateWorkingDays,
  progressPercentFor,
  suggestRank,
  taskMeasure,
  taskScores,
  validateRuleConfig,
  type KpiTaskForTotal,
} from './kpi-engine.js';

// Phân hệ KPI (DT-18 phần 18d, YCTD-139); kịch bản đề xuất CT-667 đến CT-684. Dữ liệu mẫu là dữ liệu giả
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const errorOf = (body: Record<string, unknown>) => (body.error ?? {}) as { code?: string; rule_code?: string };

// Cấu hình mẫu để kiểm thử máy chấm, cùng tham số với hai bộ quy tắc mặc định
const progressConfig = {
  scoring_mode: 'progress_quality',
  total_max: 100,
  general: { max: 0, groups: [] },
  task_part: { max: 70 },
  axes: [{ code: '1', name: 'Trục 1' }],
  task_types: [{ code: 'regular', name: 'Thường xuyên', standard_score: 10 }],
  difficulty_levels: [
    { code: '100', label: '100%', weight: 1 },
    { code: '120', label: '120%', weight: 1.2 },
  ],
  weights: { progress: 30, quality: 70 },
  progress_levels: [
    { max_late_days: 0, percent: 100, label: 'Đúng hạn' },
    { max_late_days: 3, percent: 80, label: 'Chậm 1-3' },
    { max_late_days: 5, percent: 60, label: 'Chậm 4-5' },
    { max_late_days: null, percent: 0, label: 'Chậm trên 5' },
  ],
  quality_levels: [
    { code: 'q100', label: '100', percent: 100 },
    { code: 'q75', label: '75', percent: 75 },
    { code: 'q50', label: '50', percent: 50 },
    { code: 'q25', label: '25', percent: 25 },
    { code: 'q0', label: '0', percent: 0 },
  ],
  result_levels: [],
  bonus: { rate_percent: 5, max_total: 7 },
  ranks: [
    { code: 'excellent', label: 'Xuất sắc', min_score: 90, require_all_on_time: true, min_exceeding_percent: 30 },
    { code: 'good', label: 'Tốt', min_score: 70, require_all_on_time: true },
    { code: 'pass', label: 'Hoàn thành', min_score: 50, max_zero_progress_percent: 20 },
    { code: 'fail', label: 'Không hoàn thành', min_score: 0 },
  ],
  exclusions: [{ code: 'discipline', label: 'Kỷ luật' }],
  excellent_quota: { percent: 20, base: 'good_or_better', exclude_heads: true, by_group: false },
  deadlines: { approval_days: 3, grading_days: 7, max_returns: 1 },
  subject_groups: [
    { code: 'leader', label: 'Lãnh đạo' },
    { code: 'staff', label: 'Cán bộ' },
  ],
  job_positions: [],
  indicator_targets: {},
  forms: ['task_sheet'],
} as KpiRuleConfig;

const levelConfig = {
  ...progressConfig,
  scoring_mode: 'level_scale',
  result_levels: [
    { code: 'exceed', label: 'Vượt mức', percent: 100, on_time: true, exceeded: true },
    { code: 'full', label: 'Đạt đầy đủ, đúng hạn', percent: 80, on_time: true },
    { code: 'none', label: 'Không thực hiện', percent: 0, zero_progress: true },
  ],
} as KpiRuleConfig;

const doneTask = (overrides: Partial<KpiTaskForTotal> = {}): KpiTaskForTotal => ({
  inPlan: true,
  counted: true,
  graded: true,
  maxConverted: 10,
  converted: 10,
  bonus: 0,
  onTime: true,
  exceeded: false,
  zeroProgress: false,
  ...overrides,
});

describe('Máy chấm KPI', () => {
  it('CT-667: tiến độ theo ngày làm việc chậm, điểm thực hiện 30% tiến độ + 70% kết quả, điểm quy đổi theo hệ số độ khó', () => {
    // Thứ bảy, chủ nhật không phải ngày làm việc: hạn thứ sáu 2026-10-16, xong thứ hai 2026-10-19 là chậm 1 ngày
    const weekday = (date: string) => ![0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay());
    assert.equal(lateWorkingDays('2026-10-16', '2026-10-19', weekday), 1);
    assert.equal(lateWorkingDays('2026-10-16', '2026-10-16', weekday), 0);
    assert.equal(lateWorkingDays('2026-10-16', '2026-10-26', weekday), 6);
    assert.deepEqual(
      [0, 1, 3, 4, 5, 6, null].map((days) => progressPercentFor(progressConfig, days)),
      [100, 80, 80, 60, 60, 0, 0],
    );
    const measure = taskMeasure(progressConfig, { progressPercent: 80, qualityCode: 'q75', resultCode: null });
    assert.equal(measure.percent, 76.5);
    assert.equal(measure.canExceed, false);
    assert.deepEqual(
      taskScores(progressConfig, { standardScore: 10, difficultyWeight: 1.2, percent: 76.5, bonusApproved: true }),
      {
        maxConverted: 12,
        execution: 7.65,
        converted: 9.18,
        bonus: 0.46,
      },
    );
    // Bộ quy tắc theo thang mức: "đạt đầy đủ, đúng hạn" 0,8 điểm chuẩn; chỉ mức "vượt" mới được coi là vượt yêu cầu
    const level = taskMeasure(levelConfig, { progressPercent: null, qualityCode: null, resultCode: 'full' });
    assert.deepEqual(level, { percent: 80, onTime: true, zeroProgress: false, canExceed: false });
    assert.equal(
      taskScores(levelConfig, { standardScore: 10, difficultyWeight: 1, percent: 80, bonusApproved: false }).converted,
      8,
    );
  });

  it('CT-668: điểm phần công việc = min(70, 70 × B / A), thưởng tối đa 7, tổng tối đa 100; xếp loại theo ngưỡng và điều kiện', () => {
    const tasks = [
      doneTask({ exceeded: true, bonus: 5 }),
      doneTask({ exceeded: true, bonus: 5 }),
      doneTask(),
      doneTask({ inPlan: false, converted: 8 }),
      doneTask({ counted: false, converted: 0 }),
    ];
    const totals = evaluationTotals(progressConfig, 30, tasks);
    assert.equal(totals.planMax, 30);
    assert.equal(totals.actualTotal, 38);
    assert.equal(totals.taskScore, 70);
    assert.equal(totals.bonus, 7);
    assert.equal(totals.total, 100);
    assert.equal(totals.exceedingPercent, 50);
    assert.equal(suggestRank(progressConfig, totals, []), 'excellent');
    assert.equal(suggestRank(progressConfig, totals, ['discipline']), 'fail');
    // Không đủ 30% việc vượt yêu cầu thì chỉ là hoàn thành tốt; có việc chậm hạn thì chỉ là hoàn thành
    const noExceed = evaluationTotals(progressConfig, 30, [doneTask(), doneTask(), doneTask()]);
    assert.equal(suggestRank(progressConfig, noExceed, []), 'good');
    const late = evaluationTotals(progressConfig, 30, [doneTask(), doneTask({ onTime: false, converted: 7 })]);
    assert.equal(late.taskScore, 59.5);
    assert.equal(suggestRank(progressConfig, late, []), 'pass');
    const zero = evaluationTotals(progressConfig, 20, [
      doneTask({ converted: 3 }),
      doneTask({ zeroProgress: true, onTime: false, converted: 0 }),
    ]);
    assert.equal(suggestRank(progressConfig, zero, []), 'fail');
  });

  it('CT-669: tỷ lệ xuất sắc tối đa 20% số người từ hoàn thành tốt trở lên, không tính người đứng đầu', () => {
    const rows = [
      ...Array.from({ length: 8 }, () => ({ rank: 'good', isHead: false, group: 'staff' as const })),
      { rank: 'excellent', isHead: false, group: 'staff' as const },
      { rank: 'excellent', isHead: false, group: 'staff' as const },
      { rank: 'excellent', isHead: true, group: 'leader' as const },
    ];
    assert.deepEqual(excellentQuota(progressConfig, rows), [
      { group: 'all', base: 10, limit: 2, excellent: 2, exceeded: false },
    ]);
    assert.equal(
      excellentQuota(progressConfig, [...rows, { rank: 'excellent', isHead: false, group: 'staff' }])[0]?.exceeded,
      true,
    );
  });

  it('CT-670: kiểm tra cấu hình bộ quy tắc trước khi ghi; tệp Word là gói nén Office', () => {
    assert.deepEqual(validateRuleConfig(progressConfig), []);
    const broken = validateRuleConfig({ ...progressConfig, scoring_mode: 'other', quality_levels: [] });
    assert.ok(broken.some((error) => error.field === 'scoring_mode'));
    const docx = buildDocx([{ kind: 'paragraph', text: 'Thử <đậm> & nghiêng' }], { title: 'Thử' });
    assert.equal(docx.subarray(0, 4).toString('latin1'), 'PK\u0003\u0004');
    assert.ok(docx.includes(Buffer.from('word/document.xml')));
    assert.ok(docx.includes(Buffer.from('Thử &lt;đậm&gt; &amp; nghiêng')));
  });
});

describe('Phân hệ KPI', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  const users: Record<string, LoggedInUser> = {};
  const staff: Record<string, string> = {};
  const units: Record<string, string> = {};
  const ruleSets: Record<string, { id: string; version_id: string }> = {};
  let periodId = '';
  let monthPeriodId = '';

  const token = (name: string) => (name === 'principal' ? principal.accessToken : (users[name]?.accessToken ?? ''));
  const api = (method: string, path: string, name: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, token(name), body);
  async function upload(name: string, path: string, fields: Record<string, string>, file: Buffer, fileName: string) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      form.set(key, value);
    }
    form.set('file', new Blob([file]), fileName);
    const response = await fetch(`${environment.baseUrl}${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token(name)}` },
      body: form,
    });
    const text = await response.text();
    return {
      status: response.status,
      body: (response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : {}) as Record<string, unknown>,
    };
  }
  async function download(name: string, path: string) {
    const response = await fetch(`${environment.baseUrl}${path}`, {
      headers: { authorization: `Bearer ${token(name)}` },
    });
    return {
      status: response.status,
      type: response.headers.get('content-type') ?? '',
      body: Buffer.from(await response.arrayBuffer()),
    };
  }
  const taskOf = (id: string) =>
    schoolYear.selectFrom('kpi_tasks').selectAll().where('id', '=', id).executeTakeFirstOrThrow();

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    const firstStart = addDays(vietnamToday, -100);
    const firstEnd = addDays(vietnamToday, 120);
    const startYear = Number(firstStart.slice(0, 4));
    await openTestAcademicYear(environment, principal.accessToken, `${startYear}–${startYear + 1}`, {
      first_term: { start_date: firstStart, end_date: firstEnd },
      second_term: { start_date: addDays(firstEnd, 3), end_date: addDays(firstEnd, 120) },
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
      ['ĐT-A', 'diem_truong'],
      ['ĐT-B', 'diem_truong'],
    ] as const) {
      units[code] = (await api('POST', '/org-units', 'principal', { code, name: code, unit_type: type })).body
        .id as string;
    }
    users.manager = await environment.loginAs('VT-03', units['ĐT-A'] ?? null);
    users.otherManager = await environment.loginAs('VT-03', units['ĐT-B'] ?? null);
    users.teacher = await environment.loginAs('VT-07', units['ĐT-A'] ?? null);
    users.teacher2 = await environment.loginAs('VT-07', units['ĐT-A'] ?? null);
    users.vice = await environment.loginAs('VT-15', units['ĐT-A'] ?? null);
    for (const [key, name, user, unit] of [
      ['principal', 'Hiệu Trưởng Giả', 'principal', 'TC'],
      ['manager', 'Quản Lý Giả', 'manager', 'ĐT-A'],
      ['teacher', 'Giáo Viên Một', 'teacher', 'ĐT-A'],
      ['teacher2', 'Giáo Viên Hai', 'teacher2', 'ĐT-A'],
      ['vice', 'Phó Hiệu Trưởng Giả', 'vice', 'ĐT-A'],
    ] as const) {
      staff[key] = (
        await schoolYear
          .insertInto('staff')
          .values({
            org_unit_id: units[unit] ?? '',
            code: `NS-${randomInt(100_000, 999_999)}`,
            full_name: name,
            start_date: addDays(vietnamToday, -200),
            user_id: user === 'principal' ? principal.userId : (users[user]?.userId ?? null),
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-671: hai bộ quy tắc mặc định có phiên bản đã ban hành, cấu hình hợp lệ; bản đã ban hành không sửa, bản nháp sửa rồi ban hành', async () => {
    const sets = await api('GET', '/kpi/rule-sets', 'principal');
    assert.equal(sets.status, 200);
    const list = sets.body as unknown as Array<{
      id: string;
      code: string;
      is_default: boolean;
      versions: Array<{ id: string; status: string }>;
    }>;
    assert.deepEqual(
      list.map((set) => set.code),
      ['BQT-1', 'BQT-2'],
    );
    assert.equal(list.find((set) => set.is_default)?.code, 'BQT-2');
    for (const set of list) {
      ruleSets[set.code] = { id: set.id, version_id: set.versions[0]!.id };
      const version = await api('GET', `/kpi/rule-versions/${set.versions[0]!.id}`, 'teacher');
      assert.equal(version.status, 200);
      assert.deepEqual(validateRuleConfig(version.body.config), []);
    }
    const config1 = (await api('GET', `/kpi/rule-versions/${ruleSets['BQT-1']!.version_id}`, 'principal')).body
      .config as KpiRuleConfig;
    assert.deepEqual(config1.weights, { progress: 30, quality: 70 });
    assert.equal(config1.quality_levels.length, 5);
    assert.deepEqual(
      config1.ranks.map((rank) => rank.min_score),
      [90, 70, 50, 0],
    );
    assert.deepEqual(config1.deadlines, { approval_days: 3, grading_days: 7, max_returns: 1 });
    assert.equal(
      config1.general.groups.flatMap((group) => group.items).filter((item) => item.subject_groups.includes('staff'))
        .length,
      16,
    );
    const config2 = (await api('GET', `/kpi/rule-versions/${ruleSets['BQT-2']!.version_id}`, 'principal')).body
      .config as KpiRuleConfig;
    assert.equal(config2.result_levels.length, 6);
    assert.deepEqual(config2.indicator_targets, { MN: 48, TH: 65, THCS: 66, THPT: 66 });

    const locked = await api('PATCH', `/kpi/rule-versions/${ruleSets['BQT-1']!.version_id}`, 'principal', {
      note: 'Sửa',
    });
    assert.equal(errorOf(locked.body).rule_code, 'YCTD-139');
    const draft = await api('POST', `/kpi/rule-sets/${ruleSets['BQT-1']!.id}/versions`, 'principal', { note: 'Thử' });
    assert.equal(draft.status, 201);
    const invalid = await api('PATCH', `/kpi/rule-versions/${draft.body.id}`, 'principal', {
      config: { ...config1, weights: { progress: 300, quality: 70 } },
    });
    assert.equal(invalid.status, 400);
    const saved = await api('PATCH', `/kpi/rule-versions/${draft.body.id}`, 'principal', {
      config: { ...config1, bonus: { rate_percent: 5, max_total: 6 } },
    });
    assert.equal(saved.status, 200);
    assert.equal((await api('POST', `/kpi/rule-versions/${draft.body.id}/publish`, 'principal')).status, 200);
    assert.equal((await api('POST', `/kpi/rule-sets/${ruleSets['BQT-1']!.id}/versions`, 'teacher', {})).status, 403);
    // Kỳ mới dùng phiên bản mới nhất; quay về phiên bản 1 để kiểm thử theo tham số mặc định
    ruleSets['BQT-1']!.version_id = draft.body.id as string;
  });

  it('CT-672: đối tượng đánh giá theo bộ quy tắc, nhóm lãnh đạo hoặc cán bộ, cấp học, vị trí, cấp trên trực tiếp; kỳ áp phiên bản mới nhất', async () => {
    const save = (staffIds: string[], body: Record<string, unknown>) =>
      api('PUT', '/kpi/profiles', 'principal', { staff_ids: staffIds, ...body });
    assert.equal(
      (
        await save([staff.teacher!], {
          rule_set_id: ruleSets['BQT-1']!.id,
          subject_group: 'staff',
          superior_staff_id: staff.manager,
        })
      ).status,
      200,
    );
    assert.equal(
      (await save([staff.manager!, staff.vice!], { rule_set_id: ruleSets['BQT-1']!.id, subject_group: 'leader' }))
        .status,
      200,
    );
    assert.equal(
      (
        await save([staff.teacher2!], {
          rule_set_id: ruleSets['BQT-2']!.id,
          subject_group: 'staff',
          school_level: 'MN',
          job_position: 'gv-mau-giao',
          superior_staff_id: staff.manager,
        })
      ).status,
      200,
    );
    assert.equal(
      (await save([staff.teacher!], { rule_set_id: ruleSets['BQT-1']!.id, superior_staff_id: staff.teacher })).status,
      400,
    );
    const profiles = await api('GET', `/kpi/profiles?org_unit_id=${units['ĐT-A']}`, 'principal');
    assert.equal((profiles.body as unknown as unknown[]).length, 4);

    const created = await api('POST', '/kpi/periods', 'principal', {
      code: 'Q4-2026',
      name: 'Quý IV năm 2026',
      period_type: 'quarter',
      start_date: addDays(vietnamToday, -30),
      end_date: addDays(vietnamToday, 60),
      register_from: addDays(vietnamToday, -30),
      register_to: addDays(vietnamToday, 10),
      self_from: addDays(vietnamToday, 40),
      self_to: addDays(vietnamToday, 45),
    });
    assert.equal(created.status, 201);
    periodId = created.body.id as string;
    const periods = (await api('GET', '/kpi/periods', 'teacher')).body as unknown as Array<{
      id: string;
      rule_versions: Array<{ rule_set_version_id: string }>;
    }>;
    const versions = periods
      .find((period) => period.id === periodId)
      ?.rule_versions.map((row) => row.rule_set_version_id);
    assert.ok(versions?.includes(ruleSets['BQT-1']!.version_id));
    assert.ok(versions?.includes(ruleSets['BQT-2']!.version_id));
    assert.equal(
      (
        await api('POST', '/kpi/periods', 'principal', {
          code: 'Q4-2026',
          name: 'Trùng',
          period_type: 'quarter',
          start_date: vietnamToday,
          end_date: vietnamToday,
        })
      ).status,
      409,
    );
    const month = await api('POST', '/kpi/periods', 'principal', {
      code: 'T-THANG',
      name: 'Tháng này',
      period_type: 'month',
      start_date: addDays(vietnamToday, -5),
      end_date: addDays(vietnamToday, 20),
    });
    monthPeriodId = month.body.id as string;
  });

  it('CT-673: danh mục công việc chuẩn chung và của đơn vị; cán bộ đề xuất, quản lý duyệt; nhập Excel có lỗi thì không ghi dòng nào', async () => {
    const common = await api('POST', '/kpi/catalog', 'principal', {
      org_unit_id: null,
      rule_set_id: ruleSets['BQT-1']!.id,
      code: 'CV-01',
      name: 'Lập kế hoạch hoạt động tháng',
      output_result: 'Kế hoạch',
      axis_code: '1',
      difficulty_code: '110',
      is_required: true,
    });
    assert.equal(common.status, 201);
    assert.equal(
      (await api('POST', '/kpi/catalog', 'manager', { org_unit_id: null, code: 'CV-02', name: 'X', axis_code: '1' }))
        .status,
      403,
    );
    const unitItem = await api('POST', '/kpi/catalog', 'manager', {
      org_unit_id: units['ĐT-A'],
      rule_set_id: ruleSets['BQT-1']!.id,
      code: 'CV-02',
      name: 'Tổ chức sinh hoạt chuyên môn',
      axis_code: '3',
    });
    assert.equal(unitItem.status, 201);
    assert.equal(
      (
        await api('POST', '/kpi/catalog', 'manager', {
          org_unit_id: units['ĐT-A'],
          rule_set_id: ruleSets['BQT-1']!.id,
          code: 'CV-03',
          name: 'Sai trục',
          axis_code: '9',
        })
      ).status,
      400,
    );
    const proposal = await api('POST', '/kpi/catalog/proposals', 'teacher', {
      rule_set_id: ruleSets['BQT-1']!.id,
      code: 'DX-01',
      name: 'Làm đồ dùng dạy học',
      axis_code: '3',
    });
    assert.equal(proposal.status, 201);
    assert.equal(proposal.body.status, 'proposed');
    assert.equal(proposal.body.org_unit_id, units['ĐT-A']);
    assert.equal(
      (await api('POST', `/kpi/catalog/${proposal.body.id}/decision`, 'manager', { approve: false })).status,
      400,
    );
    const approved = await api('POST', `/kpi/catalog/${proposal.body.id}/decision`, 'manager', { approve: true });
    assert.equal(approved.body.status, 'active');

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Danh mục công việc');
    sheet.addRow([
      'Mã công việc',
      'Tên công việc',
      'Kết quả đầu ra',
      'Trục',
      'Loại công việc',
      'Hệ số độ khó',
      'Minh chứng dự kiến',
      'Thời hạn hoàn thành',
      'Cấp học',
      'Vị trí việc làm',
      'Bắt buộc đăng ký',
      'Mật',
    ]);
    sheet.addRow(['NK-01', 'Báo cáo tháng', 'Báo cáo', '1', '', '120', '', 'Hằng tháng', '', '', 'x', '']);
    sheet.addRow(['NK-02', 'Sai trục', '', '8', '', '', '', '', 'XX', '', '', '']);
    const withErrors = await upload(
      'manager',
      '/kpi/catalog/import',
      { org_unit_id: units['ĐT-A']!, rule_set_id: ruleSets['BQT-1']!.id },
      Buffer.from(await workbook.xlsx.writeBuffer()),
      'dm.xlsx',
    );
    assert.equal(withErrors.status, 200);
    assert.equal(withErrors.body.created, 0);
    assert.equal((withErrors.body.errors as unknown[]).length, 2);
    sheet.spliceRows(3, 1);
    const imported = await upload(
      'manager',
      '/kpi/catalog/import',
      { org_unit_id: units['ĐT-A']!, rule_set_id: ruleSets['BQT-1']!.id },
      Buffer.from(await workbook.xlsx.writeBuffer()),
      'dm.xlsx',
    );
    assert.equal(imported.body.created, 1);
    const listed = (await api('GET', '/kpi/catalog?status=active', 'teacher')).body as unknown as Array<{
      code: string;
    }>;
    assert.deepEqual(listed.map((item) => item.code).sort(), ['CV-01', 'CV-02', 'DX-01', 'NK-01']);
    const otherList = (await api('GET', '/kpi/catalog', 'otherManager')).body as unknown as Array<{ code: string }>;
    assert.deepEqual(
      otherList.map((item) => item.code),
      ['CV-01'],
    );
    const progress = (await api('GET', '/kpi/catalog/indicator-progress', 'principal')).body as unknown as Array<{
      school_level: string;
      target: number;
      entered: number;
    }>;
    assert.deepEqual(
      progress.find((row) => row.school_level === 'MN'),
      { ...progress.find((row) => row.school_level === 'MN'), target: 48, entered: 0 },
    );
  });

  let assignedId = '';
  let registeredId = '';

  it('CT-674: giao việc từ danh mục; người được giao chuyển trả tối đa 1 lần có lý do, xác nhận; quá hạn xác nhận thì tự vào danh mục', async () => {
    const item = ((await api('GET', '/kpi/catalog?q=CV-01', 'manager')).body as unknown as Array<{ id: string }>)[0]!;
    const assigned = await api('POST', '/kpi/tasks/assign', 'manager', {
      period_id: periodId,
      staff_ids: [staff.teacher],
      catalog_item_id: item.id,
      deadline: vietnamToday,
    });
    assert.equal(assigned.status, 201);
    assignedId = (assigned.body.ids as string[])[0]!;
    const task = await taskOf(assignedId);
    assert.equal(task.status, 'assigned');
    assert.equal(Number(task.difficulty_weight), 1.1);
    assert.equal(task.in_plan, true);
    assert.equal(
      (
        await api('POST', '/kpi/tasks/assign', 'otherManager', {
          period_id: periodId,
          staff_ids: [staff.teacher],
          name: 'Ngoài phạm vi',
          axis_code: '1',
          deadline: vietnamToday,
        })
      ).status,
      403,
    );
    assert.equal((await api('POST', `/kpi/tasks/${assignedId}/return`, 'teacher', {})).status, 400);
    assert.equal(
      (await api('POST', `/kpi/tasks/${assignedId}/return`, 'teacher', { reason: 'Không thuộc nhiệm vụ' })).body.status,
      'returned_to_assigner',
    );
    const reassigned = await api('PATCH', `/kpi/tasks/${assignedId}`, 'manager', {
      name: 'Lập kế hoạch hoạt động tháng (giao lại)',
    });
    assert.equal(reassigned.body.status, 'assigned');
    const again = await api('POST', `/kpi/tasks/${assignedId}/return`, 'teacher', { reason: 'Lần hai' });
    assert.equal(errorOf(again.body).rule_code, 'YCTD-139');
    assert.equal((await api('POST', `/kpi/tasks/${assignedId}/accept`, 'teacher')).body.status, 'in_progress');

    const second = await api('POST', '/kpi/tasks/assign', 'manager', {
      period_id: periodId,
      staff_ids: [staff.teacher],
      name: 'Việc tự vào danh mục',
      axis_code: '2',
      deadline: vietnamToday,
    });
    const secondId = (second.body.ids as string[])[0]!;
    await schoolYear
      .updateTable('kpi_tasks')
      .set({ approval_due_at: new Date(Date.now() - 60_000) })
      .where('id', '=', secondId)
      .execute();
    const mine = (await api('GET', `/kpi/tasks/mine?period_id=${periodId}`, 'teacher')).body as unknown as Array<{
      id: string;
      status: string;
      auto_approved: boolean;
    }>;
    assert.deepEqual(
      mine.filter((row) => row.id === secondId).map((row) => [row.status, row.auto_approved]),
      [['in_progress', true]],
    );
  });

  it('CT-675: cán bộ tự đăng ký việc, cấp trên duyệt (chỉnh hệ số độ khó) hoặc không duyệt có lý do; quá 3 ngày không duyệt thì tự duyệt và ghi sổ trách nhiệm', async () => {
    const registered = await api('POST', '/kpi/tasks/register', 'teacher', {
      period_id: periodId,
      name: 'Viết sáng kiến',
      axis_code: '3',
      deadline: vietnamToday,
    });
    assert.equal(registered.status, 201);
    registeredId = registered.body.id as string;
    assert.equal(registered.body.status, 'pending_approval');
    assert.equal((await api('POST', `/kpi/tasks/${registeredId}/decision`, 'teacher', { approve: true })).status, 422);
    const approved = await api('POST', `/kpi/tasks/${registeredId}/decision`, 'manager', {
      approve: true,
      difficulty_code: '120',
    });
    assert.equal(approved.body.status, 'in_progress');
    assert.equal(Number(approved.body.difficulty_weight), 1.2);
    const rejected = await api('POST', '/kpi/tasks/register', 'teacher', {
      period_id: periodId,
      name: 'Việc không duyệt',
      axis_code: '1',
      deadline: vietnamToday,
    });
    assert.equal(
      (await api('POST', `/kpi/tasks/${rejected.body.id}/decision`, 'manager', { approve: false })).status,
      400,
    );
    assert.equal(
      (await api('POST', `/kpi/tasks/${rejected.body.id}/decision`, 'manager', { approve: false, note: 'Trùng việc' }))
        .body.status,
      'rejected',
    );
    const overdue = await api('POST', '/kpi/tasks/register', 'teacher', {
      period_id: periodId,
      name: 'Việc quá hạn duyệt',
      axis_code: '1',
      deadline: vietnamToday,
    });
    await schoolYear
      .updateTable('kpi_tasks')
      .set({ approval_due_at: new Date(Date.now() - 60_000) })
      .where('id', '=', overdue.body.id as string)
      .execute();
    await api('GET', `/kpi/tasks?period_id=${periodId}`, 'manager');
    assert.equal((await taskOf(overdue.body.id as string)).status, 'in_progress');
    const actions = await schoolYear
      .selectFrom('kpi_manager_actions')
      .selectAll()
      .where('task_id', '=', overdue.body.id as string)
      .execute();
    assert.deepEqual(
      actions.map((row) => [row.action, row.on_time, row.automatic, row.manager_staff_id]),
      [['approve', false, true, staff.manager]],
    );
    // Quá hạn duyệt rồi thì việc tự vào danh mục; hủy để không tính điểm
    assert.equal(
      (await api('POST', `/kpi/tasks/${overdue.body.id}/cancel`, 'manager', { reason: 'Không cần làm' })).body.status,
      'cancelled',
    );
  });

  it('CT-676: minh chứng có số ký hiệu văn bản ghi chữ tự do và tệp; xin gia hạn; tự đánh giá; quản lý chấm, không tự chấm việc của mình', async () => {
    const evidence = await api('PUT', `/kpi/tasks/${assignedId}/evidence`, 'teacher', {
      actual_finish_date: vietnamToday,
      evidence_text: 'Đã ban hành kế hoạch',
      document_number: '12/KH-TRƯỜNG ngày 01/10/2026',
    });
    assert.equal(evidence.body.document_number, '12/KH-TRƯỜNG ngày 01/10/2026');
    const file = await upload(
      'teacher',
      `/kpi/tasks/${assignedId}/files`,
      {},
      Buffer.from('%PDF-1.4 thử'),
      'minh-chung.pdf',
    );
    assert.equal(file.status, 201);
    assert.equal(
      (await upload('teacher', `/kpi/tasks/${assignedId}/files`, {}, Buffer.from('không phải tệp'), 'x.exe')).status,
      400,
    );
    const read = await api('GET', `/kpi/tasks/${assignedId}`, 'manager');
    assert.equal((read.body.files as unknown[]).length, 1);
    assert.equal((await download('manager', `/kpi/tasks/${assignedId}/files/${file.body.id}`)).status, 200);
    assert.equal((await api('GET', `/kpi/tasks/${assignedId}`, 'teacher2')).status, 403);

    const extension = await api('POST', `/kpi/tasks/${registeredId}/extension`, 'teacher', {
      requested_deadline: addDays(vietnamToday, 5),
      reason: 'Chờ số liệu',
    });
    assert.equal(extension.body.extension_status, 'pending');
    assert.equal(
      (await api('POST', `/kpi/tasks/${registeredId}/extension/decision`, 'manager', { approve: true })).body.deadline,
      addDays(vietnamToday, 5),
    );

    assert.equal(
      (await api('POST', `/kpi/tasks/${assignedId}/self-assess`, 'teacher', { quality_code: 'x' })).status,
      400,
    );
    const self = await api('POST', `/kpi/tasks/${assignedId}/self-assess`, 'teacher', {
      quality_code: 'q75',
      bonus_proposed: true,
      bonus_reason: 'Sáng kiến',
    });
    assert.equal(self.body.status, 'self_assessed');
    assert.equal(
      (await api('POST', `/kpi/tasks/${assignedId}/grade`, 'teacher', { quality_code: 'q100' })).status,
      422,
    );
    assert.equal(
      (await api('POST', `/kpi/tasks/${assignedId}/grade`, 'otherManager', { quality_code: 'q100' })).status,
      403,
    );
    const graded = await api('POST', `/kpi/tasks/${assignedId}/grade`, 'manager', {
      quality_code: 'q100',
      exceeded: true,
      bonus_approved: true,
      comment: 'Tốt',
    });
    assert.equal(graded.status, 200);
    assert.deepEqual(
      [
        graded.body.progress_percent,
        graded.body.task_percent,
        graded.body.execution_score,
        graded.body.converted_score,
        graded.body.bonus_score,
        graded.body.exceeded,
      ].map(String),
      ['100.00', '100.00', '10.00', '11.00', '0.55', 'true'],
    );
    const action = await schoolYear
      .selectFrom('kpi_manager_actions')
      .selectAll()
      .where('task_id', '=', assignedId)
      .where('action', '=', 'grade')
      .executeTakeFirstOrThrow();
    assert.equal(action.on_time, true);
  });

  it('CT-677: ủy quyền chấm vượt cấp; quá 7 ngày không chấm thì lấy kết quả tự đánh giá', async () => {
    await api('PUT', `/kpi/tasks/${registeredId}/evidence`, 'teacher', { actual_finish_date: vietnamToday });
    await api('POST', `/kpi/tasks/${registeredId}/self-assess`, 'teacher', { quality_code: 'q50' });
    assert.equal((await api('POST', `/kpi/tasks/${registeredId}/grade`, 'vice', { quality_code: 'q100' })).status, 200);
    // Phó Hiệu trưởng có phạm vi đơn vị nên chấm được; ủy quyền cho người ngoài phạm vi rồi để quá hạn
    const delegated = await api('POST', '/kpi/tasks/delegate', 'principal', {
      task_ids: [registeredId],
      evaluator_staff_id: staff.vice,
      note: 'Chấm thay',
    });
    assert.equal(errorOf(delegated.body).rule_code, 'YCTD-139');
    const auto = (await api('GET', `/kpi/tasks/mine?period_id=${periodId}`, 'teacher')).body as unknown as Array<{
      id: string;
      name: string;
      status: string;
    }>;
    const pending = auto.find((row) => row.name === 'Việc tự vào danh mục')!;
    await api('PUT', `/kpi/tasks/${pending.id}/evidence`, 'teacher', { actual_finish_date: vietnamToday });
    await api('POST', `/kpi/tasks/${pending.id}/self-assess`, 'teacher', { quality_code: 'q75' });
    assert.equal(
      (
        await api('POST', '/kpi/tasks/delegate', 'principal', {
          task_ids: [pending.id],
          evaluator_staff_id: staff.vice,
        })
      ).status,
      200,
    );
    assert.equal((await taskOf(pending.id)).evaluator_staff_id, staff.vice);
    await schoolYear
      .updateTable('kpi_tasks')
      .set({ grading_due_at: new Date(Date.now() - 60_000) })
      .where('id', '=', pending.id)
      .execute();
    await api('GET', `/kpi/tasks/mine?period_id=${periodId}`, 'teacher');
    const autoGraded = await taskOf(pending.id);
    assert.deepEqual([autoGraded.status, autoGraded.auto_graded, autoGraded.quality_code], ['graded', true, 'q75']);
    const actions = await schoolYear
      .selectFrom('kpi_manager_actions')
      .selectAll()
      .where('task_id', '=', pending.id)
      .execute();
    assert.deepEqual(
      actions.map((row) => [row.action, row.automatic, row.manager_staff_id]),
      [['grade', true, staff.vice]],
    );
  });

  let evaluationId = '';

  it('CT-678: tự đánh giá tiêu chí chung theo Mẫu 01-B (cán bộ), phần công việc tự tính A, B; nộp kèm mức tự đề xuất', async () => {
    const mine = await api('GET', `/kpi/evaluations/mine?period_id=${periodId}`, 'teacher');
    assert.equal(mine.status, 200);
    evaluationId = mine.body.id as string;
    const groups = mine.body.criteria as Array<{ code: string; items: Array<{ code: string; max_score: number }> }>;
    assert.deepEqual(
      groups.map((group) => group.items.length),
      [9, 3, 4],
    );
    assert.deepEqual(
      groups[1]!.items.map((item) => item.max_score),
      [2, 1, 1],
    );
    assert.equal(mine.body.general_score, 30);
    // A = 11 (việc giao đầu kỳ) + 12 (việc đăng ký, hệ số 1,2) + 10 (việc tự vào danh mục) = 33; B = 11 + 12 + 8,25
    assert.equal(mine.body.plan_max, 33);
    assert.equal(mine.body.actual_total, 31.25);
    assert.equal(mine.body.task_score, 66.29);
    assert.equal(mine.body.bonus_score, 0.55);
    const saved = await api('PUT', '/kpi/evaluations/mine', 'teacher', {
      period_id: periodId,
      criteria: [{ code: '3.4', satisfied: false, note: 'Chưa đạt' }],
      self_rank: 'good',
      self_comment: 'Hoàn thành tốt',
    });
    assert.equal(saved.body.general_score, 28);
    assert.equal(saved.body.total_score, 94.84);
    assert.equal(saved.body.suggested_rank, 'excellent');
    assert.equal(
      (
        await api('PUT', '/kpi/evaluations/mine', 'teacher', {
          period_id: periodId,
          criteria: [{ code: '9.9', satisfied: true }],
        })
      ).status,
      400,
    );
    assert.equal(
      (await api('POST', '/kpi/evaluations/mine/submit', 'teacher', { period_id: periodId })).body.status,
      'submitted',
    );
    assert.equal(
      (await api('PUT', '/kpi/evaluations/mine', 'teacher', { period_id: periodId, criteria: [] })).status,
      422,
    );
  });

  it('CT-679: cấp trên trả lại hoặc kết luận (điều chỉnh tiêu chí chung, trường hợp loại trừ); không tự kết luận cho mình', async () => {
    const managerSelf = await api('GET', `/kpi/evaluations/mine?period_id=${periodId}`, 'manager');
    assert.equal(
      (await api('POST', `/kpi/evaluations/${managerSelf.body.id}/conclude`, 'manager', { rank: 'good' })).status,
      422,
    );
    assert.equal(
      (await api('POST', `/kpi/evaluations/${evaluationId}/conclude`, 'teacher2', { rank: 'good' })).status,
      403,
    );
    const returned = await api('POST', `/kpi/evaluations/${evaluationId}/return`, 'manager', {
      reason: 'Bổ sung minh chứng',
    });
    assert.equal(returned.body.status, 'returned');
    await api('POST', '/kpi/evaluations/mine/submit', 'teacher', { period_id: periodId });
    const excluded = await api('POST', `/kpi/evaluations/${evaluationId}/conclude`, 'manager', {
      rank: 'good',
      exclusions: ['discipline'],
    });
    assert.equal(errorOf(excluded.body).rule_code, 'YCTD-139');
    const concluded = await api('POST', `/kpi/evaluations/${evaluationId}/conclude`, 'manager', {
      rank: 'good',
      criteria: [{ code: '3.4', satisfied: true }],
      comment: 'Đồng ý',
    });
    assert.equal(concluded.status, 200);
    assert.deepEqual(
      [concluded.body.status, concluded.body.superior_rank, concluded.body.general_score],
      ['concluded', 'good', 30],
    );
    const list = (await api('GET', `/kpi/evaluations?period_id=${periodId}`, 'manager')).body as unknown as Array<{
      staff_id: string;
      status: string;
    }>;
    assert.equal(list.find((row) => row.staff_id === staff.teacher)?.status, 'concluded');
    assert.equal(list.find((row) => row.staff_id === staff.teacher2)?.status, 'draft');
  });

  it('CT-680: bộ quy tắc 2 chấm chỉ báo theo thang 6 mức; phiếu theo dõi tháng có ví dụ tính điểm', async () => {
    const assigned = await api('POST', '/kpi/tasks/assign', 'manager', {
      period_id: monthPeriodId,
      staff_ids: [staff.teacher2],
      name: 'Tổ chức hoạt động góc',
      axis_code: 'chuyen-mon',
      deadline: vietnamToday,
    });
    const id = (assigned.body.ids as string[])[0]!;
    await api('POST', `/kpi/tasks/${id}/accept`, 'teacher2');
    await api('PUT', `/kpi/tasks/${id}/evidence`, 'teacher2', { actual_finish_date: vietnamToday });
    assert.equal((await api('POST', `/kpi/tasks/${id}/self-assess`, 'teacher2', { quality_code: 'q100' })).status, 400);
    await api('POST', `/kpi/tasks/${id}/self-assess`, 'teacher2', { result_code: 'full' });
    const graded = await api('POST', `/kpi/tasks/${id}/grade`, 'manager', { result_code: 'full' });
    assert.deepEqual([graded.body.task_percent, graded.body.converted_score].map(String), ['80.00', '8.00']);
    const mine = await api('GET', `/kpi/evaluations/mine?period_id=${monthPeriodId}`, 'teacher2');
    assert.equal(mine.body.task_score, 56);
    assert.equal(mine.body.total_score, 86);
    const sheet = await download('teacher2', `/kpi/reports/evaluations/${mine.body.id}/monthly-sheet?format=docx`);
    assert.equal(sheet.status, 200);
    assert.equal(sheet.type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    assert.equal(
      (await download('teacher2', `/kpi/reports/evaluations/${mine.body.id}/monthly-sheet?format=pdf`)).body
        .subarray(0, 4)
        .toString(),
      '%PDF',
    );
  });

  it('CT-681: tham mưu đề xuất mức, biểu quyết; khóa kỳ chốt mức theo biểu quyết, giữ phiên bản; kỳ khóa không sửa; mở lại phải ghi lý do', async () => {
    const advisory = await api('GET', `/kpi/advisory?period_id=${periodId}`, 'principal');
    assert.equal(advisory.status, 200);
    assert.equal((await api('GET', `/kpi/advisory?period_id=${periodId}`, 'teacher')).status, 403);
    const savedAdvisory = await api('PUT', '/kpi/advisory', 'principal', {
      period_id: periodId,
      items: [{ evaluation_id: evaluationId, rank: 'good', comment: 'Đề xuất' }],
    });
    assert.equal(savedAdvisory.status, 200);
    const voting = (await api('GET', `/kpi/voting?period_id=${periodId}`, 'vice')).body as unknown as Array<{
      id: string;
    }>;
    assert.ok(voting.some((row) => row.id === evaluationId));
    assert.equal(
      (
        await api('PUT', '/kpi/voting', 'vice', {
          period_id: periodId,
          votes: [{ evaluation_id: evaluationId, rank: 'pass' }],
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await api('PUT', '/kpi/voting', 'principal', {
          period_id: periodId,
          votes: [{ evaluation_id: evaluationId, rank: 'pass' }],
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await api('PUT', '/kpi/voting', 'teacher', {
          period_id: periodId,
          votes: [{ evaluation_id: evaluationId, rank: 'pass' }],
        })
      ).status,
      403,
    );
    assert.equal((await api('POST', `/kpi/periods/${periodId}/lock`, 'principal', { note: 'Chốt kỳ' })).status, 200);
    const evaluation = await schoolYear
      .selectFrom('kpi_evaluations')
      .selectAll()
      .where('id', '=', evaluationId)
      .executeTakeFirstOrThrow();
    assert.equal(evaluation.final_rank, 'pass');
    assert.equal(evaluation.rule_set_version_id, ruleSets['BQT-1']!.version_id);
    const blocked = await api('POST', '/kpi/tasks/register', 'teacher', {
      period_id: periodId,
      name: 'Sau khóa',
      axis_code: '1',
      deadline: vietnamToday,
    });
    assert.equal(errorOf(blocked.body).rule_code, 'YCTD-139');
    assert.equal((await api('POST', `/kpi/periods/${periodId}/reopen`, 'principal', {})).status, 400);
    assert.equal(
      (await api('POST', `/kpi/periods/${periodId}/reopen`, 'principal', { note: 'Điều chỉnh' })).status,
      200,
    );
  });

  it('CT-682: mẫu báo cáo xuất Excel, Word, PDF có ghi nhật ký xuất; quy chế của đơn vị sinh từ cấu hình theo cấp học', async () => {
    const sheet = await download('teacher', `/kpi/reports/evaluations/${evaluationId}/task-sheet?format=xlsx`);
    assert.equal(sheet.status, 200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(sheet.body as unknown as ArrayBuffer);
    assert.equal(workbook.worksheets[0]?.getRow(1).getCell(1).text, 'BẢNG TÍNH ĐIỂM KPI');
    for (const format of ['docx', 'pdf']) {
      const self = await download(
        'manager',
        `/kpi/reports/evaluations/${evaluationId}/self-evaluation?format=${format}`,
      );
      assert.equal(self.status, 200);
    }
    assert.equal((await download('teacher2', `/kpi/reports/evaluations/${evaluationId}/self-evaluation`)).status, 403);
    for (const format of ['xlsx', 'pdf', 'docx']) {
      assert.equal(
        (await download('principal', `/kpi/reports/periods/${periodId}/unit-summary?format=${format}`)).status,
        200,
      );
    }
    const actions = await api('GET', `/kpi/reports/periods/${periodId}/manager-actions`, 'principal');
    const rows = actions.body as unknown as Array<{
      manager_name: string;
      action: string;
      total: number;
      automatic: number;
    }>;
    assert.ok(
      rows.some((row) => row.manager_name === 'Quản Lý Giả' && row.action === 'approve' && row.automatic === 1),
    );
    assert.equal((await download('principal', `/kpi/reports/periods/${periodId}/manager-actions/export`)).status, 200);
    const regulation = await download(
      'principal',
      `/kpi/reports/regulation?rule_set_version_id=${ruleSets['BQT-2']!.version_id}&school_level=MN`,
    );
    assert.equal(regulation.status, 200);
    assert.ok(regulation.body.includes(Buffer.from('48 chỉ báo')));
    const annual = await api('POST', '/kpi/periods', 'principal', {
      code: 'NAM',
      name: 'Năm học',
      period_type: 'year',
      start_date: addDays(vietnamToday, -60),
      end_date: addDays(vietnamToday, 200),
    });
    assert.equal(
      (await download('manager', `/kpi/reports/periods/${annual.body.id}/annual-sheet?staff_id=${staff.teacher2}`))
        .status,
      200,
    );
    const logs = await schoolYear
      .selectFrom('export_logs')
      .select('report_code')
      .where('report_code', 'like', 'kpi-%')
      .execute();
    assert.ok(logs.length >= 9);
  });

  it('CT-683: chuyển dữ liệu từ tệp sao lưu của hệ thống KPI cũ; xem trước không ghi, chạy lại không nhân đôi, người không ghép được thì báo', async () => {
    const path = join(tmpdir(), `kpi-test-${randomUUID()}.db`);
    const source = new DatabaseSync(path);
    source.exec(`
      create table users (id text, username text, full_name text, role text);
      create table periods (id text, code text, name text, start_date text, end_date text, is_locked integer);
      create table standard_tasks (id text, task_name text, output_result text, axis_code text, difficulty_weight real, status text);
      create table assigned_tasks (id text, period_id text, user_id text, standard_task_id text, task_name text, axis_code text,
        deadline text, status text, difficulty_weight real, progress_pct real, quality_pct real, execution_score real,
        converted_score real, bonus_score real, actual_finish_date text, origin text);
      create table evaluations (id text, period_id text, user_id text, part1_score real, rank_proposed text, superior_rank text, status text);
      insert into users values ('u1', 'gv1', 'Giáo Viên Một', 'cbnv'), ('u2', 'gv9', 'Người Không Có', 'cbnv'), ('u3', 'ad', 'Quản trị', 'admin');
      insert into periods values ('p1', 'Q3-2026', 'Quý III/2026', '2026-07-01', '2026-09-30', 1);
      insert into standard_tasks values ('s1', 'Báo cáo quý', 'Báo cáo', 'TRUC_2', 1.1, 'Hoạt động');
      insert into assigned_tasks values ('t1', 'p1', 'u1', 's1', 'Báo cáo quý', 'TRUC_2', '2026-09-15', 'approved', 1.1, 1, 0.75, 8.25, 9.08, 0, '2026-09-15', 'assigned'),
        ('t2', 'p1', 'u2', 's1', 'Không ghép', 'TRUC_1', '2026-09-15', 'approved', 1, 1, 1, 10, 10, 0, '2026-09-15', 'assigned');
      insert into evaluations values ('e1', 'p1', 'u1', 28, 'Hoàn thành tốt nhiệm vụ', 'Hoàn thành tốt nhiệm vụ', 'approved');
    `);
    source.close();
    const { readFileSync } = await import('node:fs');
    const body = readFileSync(path);
    rmSync(path, { force: true });
    assert.equal((await upload('teacher', '/kpi/legacy-import', {}, body, 'kpi.db')).status, 403);
    assert.equal(
      (await upload('principal', '/kpi/legacy-import', {}, Buffer.from('không phải sqlite'), 'kpi.db')).status,
      400,
    );
    const preview = await upload('principal', '/kpi/legacy-import', {}, body, 'kpi.db');
    assert.equal(preview.status, 200);
    assert.deepEqual(
      [
        preview.body.preview,
        preview.body.periods,
        preview.body.catalog_items,
        preview.body.tasks,
        preview.body.evaluations,
        preview.body.skipped_tasks,
      ],
      [true, 1, 1, 1, 1, 1],
    );
    assert.deepEqual(preview.body.unmatched_people, ['Người Không Có']);
    assert.equal(
      (await schoolYear.selectFrom('kpi_periods').select('id').where('legacy_id', '=', 'p1').execute()).length,
      0,
    );
    const run = await upload('principal', '/kpi/legacy-import', { preview: 'false' }, body, 'kpi.db');
    assert.equal(run.body.tasks, 1);
    const period = await schoolYear
      .selectFrom('kpi_periods')
      .selectAll()
      .where('legacy_id', '=', 'p1')
      .executeTakeFirstOrThrow();
    assert.equal(period.status, 'locked');
    const evaluation = await schoolYear
      .selectFrom('kpi_evaluations')
      .selectAll()
      .where('legacy_id', '=', 'e1')
      .executeTakeFirstOrThrow();
    assert.deepEqual(
      [Number(evaluation.general_score), evaluation.final_rank, Number(evaluation.actual_total)],
      [28, 'good', 9.08],
    );
    const rerun = await upload('principal', '/kpi/legacy-import', { preview: 'false' }, body, 'kpi.db');
    assert.deepEqual([rerun.body.periods, rerun.body.tasks, rerun.body.evaluations], [0, 0, 0]);
  });

  it('CT-684: tệp minh chứng và khóa kho tệp tạo qua hàm đặt tên chung', async () => {
    const files = await schoolYear
      .selectFrom('files')
      .select('storage_key')
      .where('purpose', '=', 'kpi_evidence')
      .execute();
    assert.ok(files.length > 0);
    assert.ok(files.every((file) => /^kpi-evidence\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/.test(file.storage_key)));
  });
});
