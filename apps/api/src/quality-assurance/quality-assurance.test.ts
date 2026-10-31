import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import {
  createDatabase,
  createMigratedTestDatabase,
  migrateToLatest,
  replaceDatabaseName,
  type SchoolYearDatabase,
} from '@school-management/database';
import {
  formatEvidenceCode,
  QUALITY_DEFAULT_FRAMEWORKS,
  recognitionValidUntil,
  suggestCriterionLevel,
  summarizeQualityLevels,
} from '@school-management/shared';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { qualityAssuranceTransitionStep } from './quality-assurance-transition.js';

// Bảo đảm chất lượng, tự đánh giá (DT-18 phần 22f, YCTD-149); kịch bản CT-22f-1 đến CT-22f-8 (kiểm thử giao diện là
// CT-22f-9). Dữ liệu mẫu là dữ liệu giả
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const errorOf = (body: Record<string, unknown>) =>
  (body.error ?? {}) as { code?: string; rule_code?: string; details?: Array<{ field: string }> };
const MN_CRITERIA = QUALITY_DEFAULT_FRAMEWORKS.MN[0]?.standards.flatMap((standard) => standard.criteria).length ?? 0;
// Tệp PDF tối giản để kiểm thử tải tệp minh chứng
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

describe('Bảo đảm chất lượng: hàm dùng chung', () => {
  it('CT-22f-1: mã minh chứng theo hộp và tiêu chí; mức gợi ý theo chỉ báo; tổng hợp mức; hạn hiệu lực công nhận', () => {
    assert.equal(formatEvidenceCode(1, '1.1', 1), 'H1-1.1-01');
    assert.equal(formatEvidenceCode(5, '5.4', 12), 'H5-5.4-12');
    const indicators = [
      { id: 'a1', level: 1 },
      { id: 'b1', level: 1 },
      { id: 'a2', level: 2 },
      { id: 'a3', level: 3 },
    ];
    assert.equal(suggestCriterionLevel([], {}), null);
    assert.equal(suggestCriterionLevel(indicators, { a1: true }), 0);
    assert.equal(suggestCriterionLevel(indicators, { a1: true, b1: true, a3: true }), 1);
    assert.equal(suggestCriterionLevel(indicators, { a1: true, b1: true, a2: true }), 2);
    assert.equal(suggestCriterionLevel(indicators, { a1: true, b1: true, a2: true, a3: true }), 3);
    assert.deepEqual(summarizeQualityLevels([2, 3, null]), {
      total: 3,
      assessed: 2,
      by_level: [0, 0, 1, 1, 0],
      suggested: null,
    });
    assert.equal(summarizeQualityLevels([2, 3, 1]).suggested, 1);
    assert.equal(recognitionValidUntil('2024-05-20', null), '2029-05-20');
    assert.equal(recognitionValidUntil('2024-05-20', '2027-01-01'), '2027-01-01');
    assert.equal(recognitionValidUntil(null, null), null);
  });
});

describe('Bảo đảm chất lượng', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  const users: Record<string, LoggedInUser> = {};
  const staff: Record<string, string> = {};
  const units: Record<string, string> = {};
  let frameworkId = '';
  let assessmentId = '';
  const criteria: Record<string, string> = {};
  const reports: Record<string, string> = {};
  const evidences: Record<string, string> = {};

  const token = (name: string) => (name === 'principal' ? principal.accessToken : (users[name]?.accessToken ?? ''));
  const api = (method: string, path: string, name: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, token(name), body);
  const download = async (path: string, name: string) => {
    const response = await fetch(`${environment.baseUrl}${path}`, {
      headers: { authorization: `Bearer ${token(name)}` },
    });
    return {
      status: response.status,
      type: response.headers.get('content-type'),
      body: Buffer.from(await response.arrayBuffer()),
    };
  };
  const upload = async (path: string, name: string, fileName: string, body: Buffer) => {
    const form = new FormData();
    form.append('file', new Blob([body]), fileName);
    const response = await fetch(`${environment.baseUrl}${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token(name)}` },
      body: form,
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  };
  const fill = (level: number) => ({
    current_state: 'Hiện trạng thử',
    strengths: 'Điểm mạnh thử',
    weaknesses: 'Điểm yếu thử',
    self_level: level,
  });

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
    ] as const) {
      units[code] = (await api('POST', '/org-units', 'principal', { code, name: code, unit_type: type })).body
        .id as string;
    }
    users.vice = await environment.loginAs('VT-15', units['ĐT-A'] ?? null);
    users.teacher = await environment.loginAs('VT-07', units['ĐT-A'] ?? null);
    users.teacher2 = await environment.loginAs('VT-07', units['ĐT-A'] ?? null);
    users.parent = await environment.loginAs('VT-14', units['ĐT-A'] ?? null);
    for (const [key, name] of [
      ['principal', 'Hiệu Trưởng Giả'],
      ['vice', 'Phó Hiệu Trưởng Giả'],
      ['teacher', 'Giáo Viên Một'],
      ['teacher2', 'Giáo Viên Hai'],
    ] as const) {
      staff[key] = (
        await schoolYear
          .insertInto('staff')
          .values({
            org_unit_id: units['ĐT-A'] ?? '',
            code: `NS-${randomInt(100_000, 999_999)}`,
            full_name: name,
            start_date: addDays(vietnamToday, -200),
            user_id: (key === 'principal' ? principal.userId : users[key]?.userId) ?? null,
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

  it('CT-22f-2: nạp bộ Mầm non không tạo trùng; cấp chưa có bộ mẫu báo quy tắc; chỉ Ban Giám hiệu toàn trường cấu hình; thêm chỉ báo theo mức, sai mức bị từ chối; phụ huynh không vào được', async () => {
    assert.equal((await api('GET', '/quality/frameworks', 'parent')).status, 403);
    assert.equal((await api('POST', '/quality/frameworks/defaults', 'teacher', { school_level: 'MN' })).status, 403);
    // Phó Hiệu trưởng chỉ được gán một điểm trường: không có phạm vi toàn trường
    assert.equal((await api('POST', '/quality/frameworks/defaults', 'vice', { school_level: 'MN' })).status, 403);
    const empty = await api('POST', '/quality/frameworks/defaults', 'principal', { school_level: 'TH' });
    assert.equal(errorOf(empty.body).rule_code, 'YCTD-149');
    const loaded = await api('POST', '/quality/frameworks/defaults', 'principal', { school_level: 'MN' });
    assert.deepEqual(loaded.body, { created: 1, skipped: 0 });
    const again = await api('POST', '/quality/frameworks/defaults', 'principal', { school_level: 'MN' });
    assert.deepEqual(again.body, { created: 0, skipped: 1 });
    const list = (await api('GET', '/quality/frameworks', 'teacher')).body as unknown as Array<{
      id: string;
      code: string;
      standard_count: number;
      criterion_count: number;
    }>;
    const framework = list.find((item) => item.code === 'MN-KDCL');
    assert.equal(framework?.standard_count, 5);
    assert.equal(framework?.criterion_count, MN_CRITERIA);
    assert.equal(MN_CRITERIA, 25);
    frameworkId = framework?.id ?? '';
    const tree = (await api('GET', `/quality/frameworks/${frameworkId}`, 'principal')).body as unknown as {
      standards: Array<{ id: string; code: string; criteria: Array<{ id: string; code: string }> }>;
    };
    for (const standard of tree.standards) {
      for (const item of standard.criteria) {
        criteria[item.code] = item.id;
      }
    }
    for (const [level, code, content] of [
      [1, 'a', 'Chỉ báo mức 1 thử a'],
      [1, 'b', 'Chỉ báo mức 1 thử b'],
      [2, 'a', 'Chỉ báo mức 2 thử'],
    ] as const) {
      const created = await api('POST', `/quality/criteria/${criteria['1.1']}/indicators`, 'principal', {
        level,
        code,
        content,
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
    }
    const tooHigh = await api('POST', `/quality/criteria/${criteria['1.1']}/indicators`, 'principal', {
      level: 4,
      code: 'a',
      content: 'Vượt mức của bộ',
    });
    assert.equal(tooHigh.status, 400);
    const duplicate = await api('POST', `/quality/criteria/${criteria['1.1']}/indicators`, 'principal', {
      level: 1,
      code: 'a',
      content: 'Trùng mã',
    });
    assert.equal(duplicate.status, 400);
    const badCode = await api('POST', `/quality/frameworks/${frameworkId}/standards`, 'principal', {
      code: 'Tiêu chuẩn 6',
      title: 'Mã có dấu cách',
    });
    assert.equal(badCode.status, 400);
    assert.ok((errorOf(badCode.body).details ?? []).some((detail) => detail.field === 'code'));
  });

  it('CT-22f-3: lập đợt có phiếu cho mọi tiêu chí; bắt đầu cần Chủ tịch hội đồng và đủ phân công; mỗi tiêu chí một nhóm; người ngoài đợt không xem được', async () => {
    const created = await api('POST', '/quality/assessments', 'principal', {
      framework_id: frameworkId,
      title: 'Tự đánh giá năm học thử',
      decision_number: '01/QĐ-THU',
      decision_date: addDays(vietnamToday, -10),
      start_date: addDays(vietnamToday, -10),
      end_date: addDays(vietnamToday, 60),
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assessmentId = created.body.id as string;
    assert.equal((await api('POST', '/quality/assessments', 'teacher', { framework_id: frameworkId })).status, 403);
    const noChair = await api('POST', `/quality/assessments/${assessmentId}/start`, 'principal');
    assert.equal(errorOf(noChair.body).rule_code, 'YCTD-149');
    const twoChairs = await api('PUT', `/quality/assessments/${assessmentId}/council`, 'principal', {
      members: [
        { staff_id: staff.principal, position: 'chair' },
        { staff_id: staff.vice, position: 'chair' },
      ],
    });
    assert.equal(twoChairs.status, 400);
    const council = await api('PUT', `/quality/assessments/${assessmentId}/council`, 'principal', {
      members: [
        { staff_id: staff.principal, position: 'chair', duty: 'Chỉ đạo chung' },
        { staff_id: staff.vice, position: 'vice_chair' },
      ],
    });
    assert.equal(council.status, 200, JSON.stringify(council.body));
    const allIds = Object.values(criteria);
    const standardOne = Object.entries(criteria)
      .filter(([code]) => code.startsWith('1.'))
      .map(([, id]) => id);
    const others = allIds.filter((id) => !standardOne.includes(id));
    const overlap = await api('PUT', `/quality/assessments/${assessmentId}/groups`, 'principal', {
      groups: [
        { name: 'Nhóm 1', member_staff_ids: [staff.teacher], criterion_ids: [criteria['1.1']] },
        { name: 'Nhóm 2', member_staff_ids: [staff.teacher2], criterion_ids: [criteria['1.1']] },
      ],
    });
    assert.equal(overlap.status, 400);
    const partial = await api('PUT', `/quality/assessments/${assessmentId}/groups`, 'principal', {
      groups: [{ name: 'Nhóm tiêu chuẩn 1', leader_staff_id: staff.teacher, criterion_ids: standardOne }],
    });
    assert.equal(partial.status, 200, JSON.stringify(partial.body));
    const unassigned = await api('POST', `/quality/assessments/${assessmentId}/start`, 'principal');
    assert.match(String((unassigned.body.error as { message?: string }).message), /chưa phân công/);
    const groups = await api('PUT', `/quality/assessments/${assessmentId}/groups`, 'principal', {
      groups: [
        { name: 'Nhóm tiêu chuẩn 1', leader_staff_id: staff.teacher, criterion_ids: standardOne },
        { name: 'Nhóm tiêu chuẩn 2 đến 5', member_staff_ids: [staff.vice], criterion_ids: others },
      ],
    });
    assert.equal(groups.status, 200);
    const detail = groups.body as unknown as {
      criteria: Array<{ criterion_id: string; report_id: string; work_group_name: string | null }>;
      groups: Array<{ criterion_ids: string[]; members: unknown[] }>;
    };
    assert.equal(detail.criteria.length, MN_CRITERIA);
    assert.equal(detail.groups[0]?.criterion_ids.length, standardOne.length);
    assert.equal(detail.groups[0]?.members.length, 1);
    for (const row of detail.criteria) {
      reports[Object.entries(criteria).find(([, id]) => id === row.criterion_id)?.[0] ?? ''] = row.report_id;
    }
    // Giáo viên Hai không thuộc hội đồng hay nhóm nào
    assert.equal((await api('GET', `/quality/assessments/${assessmentId}`, 'teacher2')).status, 403);
    assert.equal(((await api('GET', '/quality/assessments', 'teacher2')).body as unknown as unknown[]).length, 0);
    assert.equal(((await api('GET', '/quality/assessments', 'teacher')).body as unknown as unknown[]).length, 1);
    const started = await api('POST', `/quality/assessments/${assessmentId}/start`, 'principal');
    assert.equal(started.status, 200, JSON.stringify(started.body));
    assert.equal(started.body.status, 'in_progress');
  });

  it('CT-22f-4: phiếu tiêu chí: nhóm được phân công soạn, nộp thiếu nội dung bị từ chối, trả lại, duyệt; mức gợi ý theo chỉ báo; người nhóm khác không sửa được', async () => {
    const id = reports['1.1'] ?? '';
    const view = await api('GET', `/quality/reports/${id}`, 'teacher');
    assert.equal(view.status, 200, JSON.stringify(view.body));
    assert.equal(view.body.can_edit, true);
    const indicators = view.body.indicators as Array<{ id: string; level: number; code: string }>;
    assert.equal(indicators.length, 3);
    assert.equal((await api('GET', `/quality/reports/${id}`, 'teacher2')).status, 403);
    // Phó Hiệu trưởng thuộc hội đồng, nhóm khác: xem được, không sửa được
    assert.equal((await api('GET', `/quality/reports/${id}`, 'vice')).body.can_edit, false);
    assert.equal((await api('PUT', `/quality/reports/${id}`, 'vice', fill(1))).status, 403);
    const early = await api('POST', `/quality/reports/${id}/submit`, 'teacher');
    assert.equal(errorOf(early.body).rule_code, 'YCTD-149');
    const levelOne = Object.fromEntries(indicators.filter((item) => item.level === 1).map((item) => [item.id, true]));
    const saved = await api('PUT', `/quality/reports/${id}`, 'teacher', {
      ...fill(1),
      indicator_results: levelOne,
      improvement_actions: [
        {
          content: 'Rà soát kế hoạch chiến lược',
          owner_staff_id: staff.teacher,
          due_date: addDays(vietnamToday, 30),
          resources: 'Tổ văn phòng',
        },
        { content: 'Việc chưa có hạn', owner_staff_id: null, due_date: null },
      ],
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.suggested_level, 1);
    const wrongIndicator = await api('PUT', `/quality/reports/${id}`, 'teacher', {
      ...fill(1),
      indicator_results: { [criteria['1.2'] ?? '']: true },
    });
    assert.equal(wrongIndicator.status, 400);
    const tooHigh = await api('PUT', `/quality/reports/${id}`, 'teacher', fill(4));
    assert.equal(tooHigh.status, 400);
    assert.equal((await api('POST', `/quality/reports/${id}/submit`, 'teacher')).body.status, 'submitted');
    assert.equal((await api('PUT', `/quality/reports/${id}`, 'teacher', fill(2))).status, 422);
    assert.equal((await api('POST', `/quality/reports/${id}/approve`, 'teacher')).status, 403);
    const noNote = await api('POST', `/quality/reports/${id}/return`, 'principal', {});
    assert.equal(noNote.status, 400);
    const returned = await api('POST', `/quality/reports/${id}/return`, 'principal', { note: 'Bổ sung minh chứng' });
    assert.equal(returned.body.status, 'returned');
    assert.equal(returned.body.return_note, 'Bổ sung minh chứng');
    await api('POST', `/quality/reports/${id}/submit`, 'teacher');
    const approved = await api('POST', `/quality/reports/${id}/approve`, 'principal');
    assert.equal(approved.body.status, 'approved');
    const mine = (await api('GET', `/quality/reports?mine=true`, 'teacher')).body as unknown as Array<{ id: string }>;
    assert.equal(mine.length, 10);
  });

  it('CT-22f-5: minh chứng ở kho dùng chung (YCTD-396): mã tự đánh theo hộp và tiêu chí của bộ, dùng chung nhiều tiêu chí, phiên bản tải lên chuyển "Đã đủ", nguồn văn bản phải có thật; phiếu đọc minh chứng từ kho; xuất danh mục; xóa chỉ người quản lý kho, chặn khi tiêu chí đã có phiếu được duyệt', async () => {
    const base = { framework_id: frameworkId, node_id: criteria['1.1'] };
    const first = await api('POST', '/quality/evidences', 'teacher', {
      ...base,
      title: 'Kế hoạch chiến lược giai đoạn thử',
      document_number: '05/KH-THU',
      issued_date: addDays(vietnamToday, -300),
      issuer: 'Trường thử',
      status: 'missing',
      shared_node_ids: [criteria['1.8']],
    });
    assert.equal(first.status, 201, JSON.stringify(first.body));
    assert.equal(first.body.code, 'H1-1.1-01');
    assert.equal(first.body.display_code, '[H1-1.1-01]');
    evidences.first = first.body.id as string;
    const second = await api('POST', '/quality/evidences', 'teacher', { ...base, title: 'Nghị quyết thử' });
    assert.equal(second.body.code, 'H1-1.1-02');
    evidences.second = second.body.id as string;
    const boxed = await api('POST', '/quality/evidences', 'vice', {
      framework_id: frameworkId,
      node_id: criteria['3.1'],
      box: 7,
      title: 'Hồ sơ đất thử',
    });
    assert.equal(boxed.body.code, 'H7-3.1-01');
    evidences.boxed = boxed.body.id as string;
    assert.equal((await api('POST', '/quality/evidences', 'parent', { ...base, title: 'X' })).status, 403);
    const missingSource = await api('POST', '/quality/evidences', 'principal', {
      ...base,
      title: 'Văn bản không có',
      record_type: 'outgoing_document',
      record_id: '00000000-0000-4000-8000-000000000001',
    });
    assert.equal(missingSource.status, 400);
    const missingDocument = await api('POST', '/quality/evidences', 'principal', {
      ...base,
      title: 'Hồ sơ không có',
      record_type: 'professional_document',
    });
    assert.equal(missingDocument.status, 400);
    const uploaded = await upload(`/quality/evidences/${evidences.first}/versions`, 'teacher', 'ke-hoach.pdf', PDF);
    assert.equal(uploaded.status, 200, JSON.stringify(uploaded.body));
    assert.equal(uploaded.body.version_no, 1);
    assert.equal((await api('GET', `/quality/evidences/${evidences.first}`, 'teacher')).body.status, 'sufficient');
    const bad = await upload(`/quality/evidences/${evidences.second}/versions`, 'teacher', 'a.exe', Buffer.from('MZ'));
    assert.equal(bad.status, 400);
    const file = await download(`/quality/evidences/${evidences.first}/file`, 'vice');
    assert.equal(file.status, 200);
    assert.equal(file.body.subarray(0, 4).toString(), '%PDF');
    const shared = (
      await api('GET', `/quality/evidences?framework_id=${frameworkId}&node_id=${criteria['1.8']}`, 'teacher')
    ).body as unknown as Array<{ code: string }>;
    assert.deepEqual(
      shared.map((row) => row.code),
      ['H1-1.1-01'],
    );
    const report = await api('GET', `/quality/reports/${reports['1.8']}`, 'teacher');
    assert.equal((report.body.evidences as Array<{ shared: boolean }>)[0]?.shared, true);
    const sufficient = (await api('GET', `/quality/evidences?framework_id=${frameworkId}&status=sufficient`, 'vice'))
      .body as unknown as unknown[];
    assert.equal(sufficient.length, 1);
    const listFile = await download(`/quality/assessments/${assessmentId}/evidences/export?format=xlsx`, 'principal');
    assert.equal(listFile.status, 200);
    assert.equal(listFile.body.subarray(0, 2).toString(), 'PK');
    assert.equal((await api('DELETE', `/quality/evidences/${evidences.boxed}`, 'teacher')).status, 403);
    // Phiếu tiêu chí 1.1 đã được duyệt ở CT-22f-4
    assert.equal(
      errorOf((await api('DELETE', `/quality/evidences/${evidences.second}`, 'principal')).body).rule_code,
      'YCTD-396',
    );
    assert.equal((await api('DELETE', `/quality/evidences/${evidences.boxed}`, 'principal')).status, 204);
  });

  it('CT-22f-6: hoàn thành đợt khi mọi phiếu đã duyệt; kế hoạch cải tiến thành kế hoạch công việc một lần; báo cáo tự đánh giá Word, PDF', async () => {
    const early = await api('POST', `/quality/assessments/${assessmentId}/complete`, 'principal', { self_level: 1 });
    assert.match(String((early.body.error as { message?: string }).message), /chưa duyệt/);
    for (const [code, id] of Object.entries(reports)) {
      if (code === '1.1') {
        continue;
      }
      const editor = code.startsWith('1.') ? 'teacher' : 'vice';
      assert.equal((await api('PUT', `/quality/reports/${id}`, editor, fill(code === '5.4' ? 2 : 1))).status, 200);
      assert.equal((await api('POST', `/quality/reports/${id}/submit`, editor)).status, 200);
      assert.equal((await api('POST', `/quality/reports/${id}/approve`, 'principal')).status, 200);
    }
    const detail = await api('GET', `/quality/assessments/${assessmentId}`, 'principal');
    assert.deepEqual(detail.body.summary, {
      total: MN_CRITERIA,
      assessed: MN_CRITERIA,
      by_level: [0, MN_CRITERIA - 1, 1, 0, 0],
      suggested: 1,
    });
    const plan = await api('POST', `/quality/assessments/${assessmentId}/work-plan`, 'principal');
    assert.equal(plan.status, 201, JSON.stringify(plan.body));
    assert.equal(plan.body.items, 1);
    assert.equal(plan.body.plans, 1);
    const items = await schoolYear
      .selectFrom('plan_items')
      .select(['content', 'owner_staff_id'])
      .where('plan_id', '=', (plan.body.work_plan_ids as string[])[0] ?? '')
      .execute();
    assert.deepEqual(items, [{ content: 'Tiêu chí 1.1: Rà soát kế hoạch chiến lược', owner_staff_id: staff.teacher }]);
    assert.equal(
      errorOf((await api('POST', `/quality/assessments/${assessmentId}/work-plan`, 'principal')).body).rule_code,
      'YCTD-149',
    );
    const completed = await api('POST', `/quality/assessments/${assessmentId}/complete`, 'principal', {
      self_level: 1,
    });
    assert.equal(completed.status, 200, JSON.stringify(completed.body));
    assert.equal(completed.body.status, 'completed');
    assert.equal((await api('PUT', `/quality/reports/${reports['1.2']}`, 'teacher', fill(1))).status, 422);
    const docx = await download(`/quality/assessments/${assessmentId}/report?format=docx`, 'teacher');
    assert.equal(docx.status, 200);
    assert.equal(docx.body.subarray(0, 2).toString(), 'PK');
    const pdf = await download(`/quality/assessments/${assessmentId}/report?format=pdf`, 'principal');
    assert.equal(pdf.status, 200);
    assert.equal(pdf.type, 'application/pdf');
    assert.equal((await download(`/quality/assessments/${assessmentId}/report?format=pdf`, 'teacher2')).status, 403);
  });

  it('CT-22f-7: kết quả công nhận, hạn hiệu lực 5 năm, ghi cấp độ và ngày vào bản rà soát 1.7 khi đã có bản rà soát', async () => {
    const recognitionDate = addDays(vietnamToday, -30);
    const saved = await api('PUT', `/quality/assessments/${assessmentId}/recognition`, 'principal', {
      external_level: 2,
      recognition_decision: '99/QĐ-THU',
      recognition_date: recognitionDate,
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const noReview = await api('POST', `/quality/assessments/${assessmentId}/recognition/apply`, 'principal');
    assert.match(String((noReview.body.error as { message?: string }).message), /1\.7/);
    const root = await schoolYear
      .selectFrom('org_units')
      .select('id')
      .where('parent_id', 'is', null)
      .orderBy('created_at')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('accreditation_reviews')
      .values({ org_unit_id: root.id, school_name: 'Trường thử', updated_by: principal.userId })
      .execute();
    const applied = await api('POST', `/quality/assessments/${assessmentId}/recognition/apply`, 'principal');
    assert.equal(applied.status, 200, JSON.stringify(applied.body));
    assert.deepEqual(applied.body, {
      accreditation_level: '2',
      accreditation_date: recognitionDate,
      accreditation_year: Number(recognitionDate.slice(0, 4)),
    });
    const recognition = await api('GET', '/quality/recognition', 'vice');
    const review = recognition.body.review as { valid_until: string; state: string };
    assert.equal(review.valid_until, recognitionValidUntil(recognitionDate, null));
    assert.equal(review.state, 'valid');
    const records = recognition.body.records as Array<{ external_level_label: string; state: string }>;
    assert.equal(records[0]?.external_level_label, 'Mức 2');
  });

  it('CT-22f-8: bước chuyển năm học chép bộ tiêu chuẩn giữ mã; minh chứng của đợt năm trước chuyển sang kho một lần, giữ mã cũ và năm học', async () => {
    const previousName = `${environment.schoolYearDatabasePrefix}quality_previous`;
    await createMigratedTestDatabase(environment.systemDatabaseUrl, previousName, 'school-year');
    const previousUrl = replaceDatabaseName(environment.systemDatabaseUrl, previousName);
    assert.equal((await migrateToLatest('school-year', previousUrl)).error, undefined);
    const previous = createDatabase<SchoolYearDatabase>(previousUrl);
    try {
      for (const row of await schoolYear.selectFrom('org_units').selectAll().execute()) {
        await previous.insertInto('org_units').values(row).execute();
      }
      await qualityAssuranceTransitionStep.carryOver?.({
        previousDatabase: schoolYear as Kysely<unknown>,
        newDatabase: previous as Kysely<unknown>,
        academicYear: { id: 'previous', startDate: vietnamToday },
        actorUserId: principal.userId,
      });
      const carried = await previous.selectFrom('quality_criteria').select('id').execute();
      assert.equal(carried.length, MN_CRITERIA);
      assert.ok(carried.some((row) => row.id === criteria['1.1']));
      assert.equal((await previous.selectFrom('quality_indicators').select('id').execute()).length, 3);
      // Cơ sở dữ liệu vừa tạo đóng vai năm học trước: một đợt cùng bộ với hai minh chứng
      const old = await previous
        .insertInto('quality_assessments')
        .values({ framework_id: frameworkId, org_unit_id: units.TC ?? '', title: 'Đợt năm trước thử' })
        .returning('id')
        .executeTakeFirstOrThrow();
      for (const [criterion, box, sequence, title] of [
        ['1.2', 1, 1, 'Quyết định thành lập hội đồng trường năm trước'],
        ['2.2', 2, 3, 'Kết quả đánh giá chuẩn giáo viên năm trước'],
      ] as const) {
        await previous
          .insertInto('quality_evidences')
          .values({
            assessment_id: old.id,
            criterion_id: criteria[criterion] ?? '',
            box,
            sequence,
            code: formatEvidenceCode(box, criterion, sequence),
            title,
            status: 'sufficient',
            source_type: 'none',
          })
          .execute();
      }
    } catch (error) {
      await previous.destroy();
      throw error;
    }
    const fakeAcademicYear = await environment.system
      .insertInto('academic_years')
      .values({
        name: 'Năm học trước thử',
        start_date: addDays(vietnamToday, -500),
        end_date: addDays(vietnamToday, -150),
        status: 'closed',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await environment.system
      .insertInto('academic_year_databases')
      .values({
        academic_year_id: fakeAcademicYear.id,
        database_name: previousName,
        status: 'read_only',
        opened_at: new Date(),
      })
      .execute();
    try {
      // Kho chuyển minh chứng của năm học trước một lần, giữ mã cũ và năm học của minh chứng (YCTD-396 thay kế thừa)
      for (const round of [1, 2]) {
        const rows = (await api('GET', `/quality/evidences?framework_id=${frameworkId}`, 'principal'))
          .body as unknown as Array<{ code: string; school_year_names: string[] }>;
        const imported = rows.filter((row) => row.school_year_names.includes('Năm học trước thử'));
        assert.deepEqual(imported.map((row) => row.code).sort(), ['H1-1.2-01', 'H2-2.2-03'], `lượt ${round}`);
      }
      const marker = await environment.system
        .selectFrom('evidence_imports')
        .select('evidence_count')
        .where('school_year_database', '=', previousName)
        .executeTakeFirstOrThrow();
      assert.equal(marker.evidence_count, 2);
    } finally {
      await environment.system
        .deleteFrom('academic_year_databases')
        .where('academic_year_id', '=', fakeAcademicYear.id)
        .execute();
      await environment.system.deleteFrom('academic_years').where('id', '=', fakeAcademicYear.id).execute();
    }
  });
});
