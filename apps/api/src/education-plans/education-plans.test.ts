import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import {
  createDatabase,
  createEmptyDatabase,
  migrateToLatest,
  replaceDatabaseName,
  type SchoolYearDatabase,
} from '@school-management/database';
import {
  diffEducationPlans,
  diffLines,
  EDUCATION_PLAN_DEFAULT_TEMPLATES,
  PROFESSIONAL_DEFAULT_FOLDERS,
  type EducationPlanSection,
  type MyWorkItem,
} from '@school-management/shared';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { educationPlansTransitionStep } from './education-plans-transition.js';

// Kế hoạch giáo dục (DT-18 phần 22i, YCTD-147); kịch bản CT-22i-1 đến CT-22i-9 (kiểm thử giao diện là CT-22i-10). Dữ liệu mẫu
// là dữ liệu giả
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const errorOf = (body: Record<string, unknown>) =>
  (body.error ?? {}) as { code?: string; rule_code?: string; details?: Array<{ field: string }> };

describe('Kế hoạch giáo dục: so sánh khác biệt', () => {
  it('CT-22i-1: so theo dòng (giữ, thêm, bỏ), theo mục (thêm, bỏ, đổi, như cũ), bảng so theo dòng bảng', () => {
    assert.deepEqual(diffLines(['a', 'b', 'c'], ['a', 'c', 'd']), [
      { op: 'same', text: 'a' },
      { op: 'removed', text: 'b' },
      { op: 'same', text: 'c' },
      { op: 'added', text: 'd' },
    ]);
    const before: EducationPlanSection[] = [
      { key: 'muc_tieu', title: 'Mục tiêu', kind: 'text' },
      { key: 'bo', title: 'Mục bỏ', kind: 'text' },
      {
        key: 'bang',
        title: 'Bảng',
        kind: 'table',
        columns: [
          { key: 'a', label: 'A' },
          { key: 'b', label: 'B' },
        ],
      },
    ];
    const after: EducationPlanSection[] = [before[0]!, before[2]!, { key: 'moi', title: 'Mục mới', kind: 'text' }];
    const result = diffEducationPlans(
      { sections: before, content: { muc_tieu: 'Giữ nguyên', bo: 'Dòng bỏ', bang: [['1', 'x']] } },
      { sections: after, content: { muc_tieu: 'Giữ nguyên', bang: [['1', 'y']], moi: 'Dòng mới' } },
    );
    assert.deepEqual(
      result.map((section) => [section.key, section.state]),
      [
        ['muc_tieu', 'same'],
        ['bang', 'changed'],
        ['moi', 'added'],
        ['bo', 'removed'],
      ],
    );
    assert.deepEqual(result[1]?.lines, [
      { op: 'removed', text: '1 | x' },
      { op: 'added', text: '1 | y' },
    ]);
  });
});

describe('Kế hoạch giáo dục', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let schoolYearName = '';
  let principal: LoggedInUser;
  const users: Record<string, LoggedInUser> = {};
  const staff: Record<string, string> = {};
  const units: Record<string, string> = {};
  const departments: Record<string, string> = {};
  const templates: Record<string, string> = {};
  const classes: Record<string, string> = {};
  const plans: Record<string, string> = {};

  const token = (name: string) => (name === 'principal' ? principal.accessToken : (users[name]?.accessToken ?? ''));
  const api = (method: string, path: string, name: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, token(name), body);
  async function create(name: string, body: Record<string, unknown>) {
    const created = await api('POST', '/education-plans', name, body);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    return created.body.id as string;
  }
  const myWork = async (name: string) =>
    ((await api('GET', '/my-work?source=education_plans', name)).body as unknown as { items: MyWorkItem[] }).items;
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

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    const firstStart = addDays(vietnamToday, -100);
    const firstEnd = addDays(vietnamToday, 120);
    const startYear = Number(firstStart.slice(0, 4));
    schoolYearName = `${startYear}–${startYear + 1}`;
    const academicYearId = await openTestAcademicYear(environment, principal.accessToken, schoolYearName, {
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
    for (const name of ['Tổ Mẫu giáo lớn', 'Tổ Nhà trẻ']) {
      departments[name] = (
        await schoolYear
          .insertInto('departments')
          .values({ org_unit_id: units['ĐT-A'] ?? '', name })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    users.vice = await environment.loginAs('VT-15', units['ĐT-A'] ?? null);
    users.leader = await environment.loginAs('VT-17', units['ĐT-A'] ?? null);
    users.leader2 = await environment.loginAs('VT-17', units['ĐT-A'] ?? null);
    users.teacher = await environment.loginAs('VT-07', units['ĐT-A'] ?? null);
    users.teacher2 = await environment.loginAs('VT-07', units['ĐT-A'] ?? null);
    users.parent = await environment.loginAs('VT-14', units['ĐT-A'] ?? null);
    // Quản lý đơn vị: có quyền lập kế hoạch công việc (P09-03)
    users.manager = await environment.loginAs('VT-03', units['ĐT-A'] ?? null);
    for (const [key, name, department] of [
      ['vice', 'Phó Hiệu Trưởng Giả', null],
      ['leader', 'Tổ Trưởng Một', 'Tổ Mẫu giáo lớn'],
      ['leader2', 'Tổ Trưởng Hai', 'Tổ Nhà trẻ'],
      ['teacher', 'Giáo Viên Một', 'Tổ Mẫu giáo lớn'],
      ['teacher2', 'Giáo Viên Hai', 'Tổ Nhà trẻ'],
    ] as const) {
      staff[key] = (
        await schoolYear
          .insertInto('staff')
          .values({
            org_unit_id: units['ĐT-A'] ?? '',
            code: `NS-${randomInt(100_000, 999_999)}`,
            full_name: name,
            start_date: addDays(vietnamToday, -200),
            department_id: department ? (departments[department] ?? null) : null,
            user_id: users[key]?.userId ?? null,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    for (const [key, name] of [
      ['la1', 'Lá 1'],
      ['choi1', 'Chồi 1'],
    ] as const) {
      classes[key] = (
        await schoolYear
          .insertInto('classes')
          .values({
            org_unit_id: units['ĐT-A'] ?? '',
            academic_year_id: academicYearId,
            code: key.toUpperCase(),
            name,
            grade_level: 'LA',
            max_size: 25,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    await schoolYear
      .insertInto('class_staff_assignments')
      .values({
        class_id: classes.la1 ?? '',
        staff_user_id: users.teacher?.userId ?? '',
        staff_name: 'Giáo Viên Một',
        assignment_role: 'homeroom',
        from_date: addDays(vietnamToday, -90),
      })
      .execute();
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-22i-2: nạp mẫu Mầm non không tạo trùng, nối thư mục kho hồ sơ; chỉ Ban Giám hiệu toàn trường sửa thư viện; mẫu sai cấu trúc bị từ chối; phụ huynh không vào được', async () => {
    assert.equal(
      (await api('POST', '/professional-folders/defaults', 'principal', { school_level: 'MN' })).status,
      200,
    );
    const forbidden = await api('POST', '/education-plan-templates/defaults', 'teacher', { school_level: 'MN' });
    assert.equal(forbidden.status, 403);
    assert.equal((await api('GET', '/education-plan-templates', 'parent')).status, 403);
    const empty = await api('POST', '/education-plan-templates/defaults', 'principal', { school_level: 'TH' });
    assert.equal(errorOf(empty.body).rule_code, 'YCTD-147');
    const loaded = await api('POST', '/education-plan-templates/defaults', 'principal', { school_level: 'MN' });
    assert.deepEqual(loaded.body, { created: EDUCATION_PLAN_DEFAULT_TEMPLATES.MN.length, skipped: 0 });
    // Thư viện mẫu dùng chung toàn trường: Phó Hiệu trưởng chỉ được gán một điểm trường không sửa được
    assert.equal((await api('POST', '/education-plan-templates/defaults', 'vice', { school_level: 'MN' })).status, 403);
    const again = await api('POST', '/education-plan-templates/defaults', 'principal', { school_level: 'MN' });
    assert.deepEqual(again.body, { created: 0, skipped: EDUCATION_PLAN_DEFAULT_TEMPLATES.MN.length });
    const list = (await api('GET', '/education-plan-templates?school_level=MN', 'teacher')).body as unknown as Array<{
      id: string;
      code: string;
      approval_steps: string[];
      requires_signing: boolean;
      archive_folder_name: string | null;
    }>;
    for (const template of list) {
      templates[template.code] = template.id;
    }
    const yearly = list.find((template) => template.code === 'MN-LOP-NAM');
    assert.deepEqual(yearly?.approval_steps, ['leader', 'vice_principal']);
    assert.equal(yearly?.archive_folder_name, PROFESSIONAL_DEFAULT_FOLDERS.MN[0]?.name);
    const invalid = await api('POST', '/education-plan-templates', 'principal', {
      code: 'SAI',
      name: 'Mẫu sai',
      scope: 'personal',
      period: 'year',
      approval_steps: ['principal', 'leader', 'khac'],
      sections: [
        { key: 'A', title: 'Mục', kind: 'text' },
        { key: 'b', title: 'Bảng', kind: 'table', columns: [] },
      ],
    });
    assert.equal(invalid.status, 400);
    const fields = (errorOf(invalid.body).details ?? []).map((detail) => detail.field);
    assert.ok(
      fields.includes('approval_steps') && fields.includes('sections.0.key') && fields.includes('sections.1.columns'),
    );
    const custom = await api('POST', '/education-plan-templates', 'principal', {
      code: 'MN-CHU-NHIEM',
      name: 'Kế hoạch công tác chủ nhiệm thử',
      scope: 'personal',
      period: 'semester',
      approval_steps: ['vice_principal', 'leader'],
      sections: [{ key: 'noi_dung', title: 'Nội dung', kind: 'text' }],
    });
    assert.equal(custom.status, 201, JSON.stringify(custom.body));
    assert.deepEqual(custom.body.approval_steps, ['leader', 'vice_principal']);
    const changed = await api('PUT', `/education-plan-templates/${custom.body.id as string}`, 'principal', {
      ...custom.body,
      sections: [
        { key: 'noi_dung', title: 'Nội dung', kind: 'text' },
        { key: 'ghi_chu', title: 'Ghi chú', kind: 'text' },
      ],
    });
    assert.equal(changed.body.revision, 2);
    assert.equal(
      (await api('DELETE', `/education-plan-templates/${custom.body.id as string}`, 'principal')).status,
      204,
    );
  });

  it('CT-22i-3: giáo viên lập kế hoạch năm của nhóm lớp được phân công; kiểm tra nội dung; tổ trưởng rồi Phó Hiệu trưởng duyệt, kí nội bộ, lưu vào kho hồ sơ; tổ khác không thấy', async () => {
    const notAssigned = await api('POST', '/education-plans', 'teacher', {
      template_id: templates['MN-LOP-NAM'],
      title: 'Kế hoạch năm lớp Chồi 1',
      class_id: classes.choi1,
    });
    assert.equal(errorOf(notAssigned.body).rule_code, 'YCTD-147');
    const id = await create('teacher', {
      template_id: templates['MN-LOP-NAM'],
      title: 'Kế hoạch giáo dục năm học lớp Lá 1',
      period_label: `Năm học ${schoolYearName}`,
      class_id: classes.la1,
    });
    plans.yearly = id;
    const empty = await api('POST', `/education-plans/${id}/submit`, 'teacher', {});
    assert.equal(errorOf(empty.body).rule_code, 'YCTD-147');
    const badDate = await api('PUT', `/education-plans/${id}`, 'teacher', {
      title: 'Kế hoạch giáo dục năm học lớp Lá 1',
      content: { chu_de: [['Trường mầm non', '4 tuần', '05/09']] },
    });
    assert.equal(badDate.status, 400);
    const saved = await api('PUT', `/education-plans/${id}`, 'teacher', {
      title: 'Kế hoạch giáo dục năm học lớp Lá 1',
      period_label: `Năm học ${schoolYearName}`,
      content: {
        dac_diem: 'Lớp có 25 trẻ 5-6 tuổi.\nĐa số trẻ đã học lớp Chồi.',
        muc_tieu: [
          ['Phát triển thể chất', 'Trẻ khỏe mạnh', 'Vận động cơ bản'],
          ['', '', ''],
        ],
        chu_de: [['Trường mầm non', '4 tuần', addDays(vietnamToday, 10)]],
        khong_co: 'bị bỏ qua',
      },
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal((saved.body.content as Record<string, unknown[]>).muc_tieu?.length, 1);
    assert.equal((saved.body.content as Record<string, unknown>).khong_co, undefined);
    const submitted = await api('POST', `/education-plans/${id}/submit`, 'teacher', {});
    assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
    assert.equal(submitted.body.status, 'pending');
    assert.equal(submitted.body.current_step, 'leader');
    assert.equal(submitted.body.version_no, 1);
    assert.equal((await api('GET', `/education-plans/${id}`, 'leader2')).status, 403);
    assert.equal((await api('GET', `/education-plans/${id}`, 'teacher2')).status, 403);
    const early = await api('POST', `/education-plans/${id}/approve`, 'vice', {});
    assert.equal(errorOf(early.body).rule_code, 'YCTD-147');
    const work = await myWork('leader');
    assert.ok(
      work.some((item) => item.title === 'Kế hoạch giáo dục năm học lớp Lá 1' && item.kind === 'Chờ Tổ trưởng duyệt'),
    );
    const review = (await api('GET', '/education-plans?view=review', 'leader')).body as unknown as Array<{
      id: string;
    }>;
    assert.ok(review.some((plan) => plan.id === id));
    const led = await api('POST', `/education-plans/${id}/approve`, 'leader', { note: 'Đạt' });
    assert.equal(led.body.current_step, 'vice_principal', JSON.stringify(led.body));
    // Chưa đăng ký chứng thư: bước cuối không kí được, kế hoạch vẫn chờ
    const blocked = await api('POST', `/education-plans/${id}/approve`, 'vice', {});
    assert.equal(errorOf(blocked.body).rule_code, 'YCTD-147');
    const saved2 = await api('PUT', '/signing/certificate', 'principal', {
      signature_type: 'remote',
      provider: 'VNPT-CA',
      login_name: 'truong-thu-ke-hoach',
      holder_name: 'Hiệu trưởng Thử',
      holder_title: 'Hiệu trưởng',
      serial_number: 'SERI-KHGD',
      valid_from: '2026-01-01',
      valid_to: '2099-12-31',
    });
    assert.equal(saved2.status, 200, JSON.stringify(saved2.body));
    assert.equal((await api('POST', '/signing/certificate/register', 'principal')).status, 200);
    const approved = await api('POST', `/education-plans/${id}/approve`, 'vice', {});
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    assert.equal(approved.body.status, 'approved');
    assert.equal(approved.body.signature_method, 'internal');
    assert.equal(
      (approved.body.archived_document as { folder_name: string }).folder_name,
      PROFESSIONAL_DEFAULT_FOLDERS.MN[0]?.name,
    );
    const archived = await schoolYear
      .selectFrom('professional_documents')
      .select(['status', 'owner_user_id', 'current_version'])
      .where('id', '=', (approved.body.archived_document as { id: string }).id)
      .executeTakeFirstOrThrow();
    assert.deepEqual(archived, { status: 'approved', owner_user_id: users.teacher?.userId, current_version: 1 });
    const signed = await download(`/education-plans/${id}/signed-file`, 'teacher');
    assert.equal(signed.status, 200);
    assert.equal(signed.body.subarray(0, 4).toString(), '%PDF');
    const events = (approved.body.events as Array<{ action: string; step: string | null }>).map(
      (event) => `${event.action}:${event.step ?? ''}`,
    );
    assert.deepEqual(events, [
      'create:',
      'submit:',
      'approve:leader',
      'approve:vice_principal',
      'sign:vice_principal',
      'archive:',
    ]);
  });

  it('CT-22i-4: trả lại, sửa, trình lại thành phiên bản 2; so sánh phiên bản; Việc của tôi báo bị trả lại; rút lại khi chưa ai duyệt', async () => {
    const id = await create('teacher', {
      template_id: templates['MN-LOP-THANG'],
      title: 'Kế hoạch tháng 10 lớp Lá 1',
      period_start: addDays(vietnamToday, 1),
      class_id: classes.la1,
    });
    const content = { chu_de: 'Chủ đề Gia đình', muc_tieu: [['Ngôn ngữ', 'Kể chuyện', 'Gia đình bé', 'Kể chuyện']] };
    await api('PUT', `/education-plans/${id}`, 'teacher', { title: 'Kế hoạch tháng 10 lớp Lá 1', content });
    await api('POST', `/education-plans/${id}/submit`, 'teacher', {});
    const withdrawn = await api('POST', `/education-plans/${id}/withdraw`, 'teacher', {});
    assert.equal(withdrawn.body.status, 'draft');
    await api('POST', `/education-plans/${id}/submit`, 'teacher', {});
    const missingNote = await api('POST', `/education-plans/${id}/return`, 'leader', {});
    assert.equal(missingNote.status, 400);
    const returned = await api('POST', `/education-plans/${id}/return`, 'leader', { note: 'Bổ sung hoạt động' });
    assert.equal(returned.body.status, 'returned');
    assert.ok((await myWork('teacher')).some((item) => item.kind === 'Kế hoạch bị trả lại'));
    await api('PUT', `/education-plans/${id}`, 'teacher', {
      title: 'Kế hoạch tháng 10 lớp Lá 1',
      content: { ...content, chuan_bi: 'Tranh ảnh gia đình' },
    });
    const again = await api('POST', `/education-plans/${id}/submit`, 'teacher', {});
    // Mỗi lần trình là một phiên bản: trình, rút lại, trình lần hai, bị trả lại, trình lần ba
    assert.equal(again.body.version_no, 3);
    const diff = await api('GET', `/education-plans/${id}/diff?from=2&to=3`, 'leader');
    assert.equal(diff.status, 200, JSON.stringify(diff.body));
    const sections = diff.body.sections as Array<{ key: string; state: string }>;
    assert.equal(sections.find((section) => section.key === 'chuan_bi')?.state, 'changed');
    assert.equal(sections.find((section) => section.key === 'chu_de')?.state, 'same');
    const approved = await api('POST', `/education-plans/${id}/approve`, 'leader', {});
    assert.equal(approved.body.status, 'approved');
    assert.equal(approved.body.signed_at, null);
  });

  it('CT-22i-5: kế hoạch của trường do Phó Hiệu trưởng lập bỏ bước của chính mình, Hiệu trưởng phê duyệt; mọi cán bộ xem được sau khi duyệt; xuất Word, PDF', async () => {
    const unauthorized = await api('POST', '/education-plans', 'teacher', {
      template_id: templates['MN-TRUONG-NAM'],
      title: 'Kế hoạch trường',
    });
    assert.equal(unauthorized.status, 403);
    const id = await create('vice', {
      template_id: templates['MN-TRUONG-NAM'],
      title: 'Kế hoạch giáo dục nhà trường năm học',
      org_unit_id: units['ĐT-A'],
    });
    plans.school = id;
    await api('PUT', `/education-plans/${id}`, 'vice', {
      title: 'Kế hoạch giáo dục nhà trường năm học',
      content: {
        muc_tieu: 'Nâng cao chất lượng chăm sóc, giáo dục trẻ.',
        ke_hoach_thang: [
          ['Tháng 9', 'Tổ chức ngày hội đến trường', 'Phó Hiệu trưởng', addDays(vietnamToday, 20)],
          ['Tháng 10', 'Hội thi giáo viên giỏi', 'Tổ chuyên môn', addDays(vietnamToday, 50)],
          ['Tháng 11', 'Không có hạn', '', ''],
        ],
      },
    });
    assert.equal((await api('GET', `/education-plans/${id}`, 'teacher')).status, 403);
    const submitted = await api('POST', `/education-plans/${id}/submit`, 'vice', {});
    assert.equal(submitted.body.current_step, 'principal', JSON.stringify(submitted.body));
    assert.ok((await myWork('principal')).some((item) => item.title === 'Kế hoạch giáo dục nhà trường năm học'));
    const approved = await api('POST', `/education-plans/${id}/approve`, 'principal', { note: 'Phê duyệt' });
    assert.equal(approved.body.status, 'approved');
    assert.ok(approved.body.signed_file_id);
    assert.equal((await api('GET', `/education-plans/${id}`, 'teacher')).status, 200);
    const school = (await api('GET', '/education-plans?view=school', 'teacher')).body as unknown as Array<{
      id: string;
    }>;
    assert.ok(school.some((plan) => plan.id === id));
    const word = await download(`/education-plans/${id}/export?format=docx`, 'teacher');
    assert.equal(word.status, 200);
    assert.match(word.type ?? '', /wordprocessingml/);
    assert.equal(word.body.subarray(0, 2).toString(), 'PK');
    const pdf = await download(`/education-plans/${id}/export?format=pdf`, 'teacher');
    assert.equal(pdf.body.subarray(0, 4).toString(), '%PDF');
  });

  it('CT-22i-6: kế hoạch của tổ do tổ trưởng lập, giáo viên trong tổ xem được, giáo viên không lập được; Hiệu trưởng duyệt thay bước Phó Hiệu trưởng thì bỏ bước của mình', async () => {
    const denied = await api('POST', '/education-plans', 'teacher', {
      template_id: templates['MN-TO-NAM'],
      title: 'Kế hoạch tổ',
    });
    assert.equal(errorOf(denied.body).rule_code, 'YCTD-147');
    const id = await create('leader', { template_id: templates['MN-TO-NAM'], title: 'Kế hoạch tổ Mẫu giáo lớn' });
    await api('PUT', `/education-plans/${id}`, 'leader', {
      title: 'Kế hoạch tổ Mẫu giáo lớn',
      content: { muc_tieu: '100% giáo viên dự giờ đủ tiết.' },
    });
    const submitted = await api('POST', `/education-plans/${id}/submit`, 'leader', {});
    assert.equal(submitted.body.current_step, 'vice_principal');
    assert.equal((await api('GET', `/education-plans/${id}`, 'teacher')).status, 200);
    assert.equal((await api('GET', `/education-plans/${id}`, 'teacher2')).status, 403);
    const groups = (await api('GET', '/education-plans?view=groups', 'teacher')).body as unknown as Array<{
      id: string;
    }>;
    assert.ok(groups.some((plan) => plan.id === id));
    const approved = await api('POST', `/education-plans/${id}/approve`, 'principal', {});
    assert.equal(approved.body.status, 'approved', JSON.stringify(approved.body));
    const processed = (await api('GET', '/education-plans?view=review&processed=true', 'principal'))
      .body as unknown as Array<{
      id: string;
    }>;
    assert.ok(processed.some((plan) => plan.id === id));
  });

  it('CT-22i-7: quản lý đơn vị tạo kế hoạch công việc nháp từ kế hoạch đã duyệt, dòng có ngày thành đầu việc; tạo lần hai bị chặn', async () => {
    const id = plans.school ?? '';
    const view = await api('GET', `/education-plans/${id}`, 'manager');
    assert.equal((view.body.actions as Record<string, boolean>).work_plan, true);
    assert.equal(
      ((await api('GET', `/education-plans/${id}`, 'teacher')).body.actions as Record<string, boolean>).work_plan,
      false,
    );
    const created = await api('POST', `/education-plans/${id}/work-plan`, 'manager', {});
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.items, 2);
    const workPlan = await schoolYear
      .selectFrom('plans')
      .select(['status', 'period_type', 'org_unit_id'])
      .where('id', '=', created.body.work_plan_id as string)
      .executeTakeFirstOrThrow();
    assert.deepEqual(workPlan, { status: 'draft', period_type: 'year', org_unit_id: units['ĐT-A'] });
    const items = await schoolYear
      .selectFrom('plan_items')
      .select(['content', 'owner_staff_id'])
      .where('plan_id', '=', created.body.work_plan_id as string)
      .orderBy('order_no')
      .execute();
    assert.equal(items[0]?.content, 'Tháng 9 – Tổ chức ngày hội đến trường – Phó Hiệu trưởng');
    assert.equal(items[0]?.owner_staff_id, staff.vice);
    const twice = await api('POST', `/education-plans/${id}/work-plan`, 'manager', {});
    assert.equal(errorOf(twice.body).rule_code, 'YCTD-147');
  });

  it('CT-22i-8: bảng tiến độ duyệt theo mẫu, theo tổ, theo bước; xuất Excel; giáo viên không xem được', async () => {
    const pendingId = await create('teacher', {
      template_id: templates['MN-LOP-TUAN'],
      title: 'Kế hoạch tuần 1 lớp Lá 1',
      class_id: classes.la1,
    });
    await api('PUT', `/education-plans/${pendingId}`, 'teacher', {
      title: 'Kế hoạch tuần 1 lớp Lá 1',
      content: { lich_tuan: [['Đón trẻ', 'Trò chuyện', '', '', '', '']] },
    });
    await api('POST', `/education-plans/${pendingId}/submit`, 'teacher', {});
    assert.equal((await api('GET', '/education-plans/progress', 'teacher')).status, 403);
    const progress = await api('GET', '/education-plans/progress', 'principal');
    assert.equal(progress.status, 200, JSON.stringify(progress.body));
    const totals = progress.body.totals as Record<string, number>;
    assert.equal(totals.approved, 4);
    assert.equal(totals.pending, 1);
    assert.equal((progress.body.by_step as Record<string, number>).leader, 1);
    const byDepartment = progress.body.by_department as Array<{ name: string; total: number }>;
    assert.ok(byDepartment.some((row) => row.name === 'Tổ Mẫu giáo lớn' && row.total === 4));
    const file = await download('/education-plans/progress/export?format=xlsx', 'principal');
    assert.equal(file.status, 200);
    assert.equal(file.body.subarray(0, 2).toString(), 'PK');
  });

  it('CT-22i-9: bước chuyển năm học chép thư viện mẫu; sao chép kế hoạch năm trước theo mẫu năm nay và so sánh với bản năm trước', async () => {
    const previousName = `${environment.schoolYearDatabasePrefix}education_plans_previous`;
    await createEmptyDatabase(environment.systemDatabaseUrl, previousName);
    const previousUrl = replaceDatabaseName(environment.systemDatabaseUrl, previousName);
    assert.equal((await migrateToLatest('school-year', previousUrl)).error, undefined);
    const previous = createDatabase<SchoolYearDatabase>(previousUrl);
    try {
      for (const row of await schoolYear.selectFrom('org_units').selectAll().execute()) {
        await previous.insertInto('org_units').values(row).execute();
      }
      for (const row of await schoolYear.selectFrom('departments').selectAll().execute()) {
        await previous.insertInto('departments').values(row).execute();
      }
      // Bước chuyển năm học chép mẫu (giữ mã định danh, bỏ liên kết thư mục không có ở năm mới)
      await educationPlansTransitionStep.carryOver?.({
        previousDatabase: schoolYear as Kysely<unknown>,
        newDatabase: previous as Kysely<unknown>,
        academicYear: { id: 'previous', startDate: vietnamToday },
        actorUserId: principal.userId,
      });
      const carried = await previous
        .selectFrom('education_plan_templates')
        .select(['id', 'archive_folder_id'])
        .execute();
      assert.equal(carried.length, EDUCATION_PLAN_DEFAULT_TEMPLATES.MN.length);
      assert.ok(carried.every((template) => template.archive_folder_id === null));
    } catch (error) {
      await previous.destroy();
      throw error;
    }
    // Cơ sở dữ liệu vừa tạo đóng vai năm học trước: kế hoạch tháng của giáo viên với mục cũ
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
      const sourceClass = await previous
        .insertInto('classes')
        .values({
          org_unit_id: units['ĐT-A'] ?? '',
          academic_year_id: fakeAcademicYear.id,
          code: 'LA1-CU',
          name: 'Lá 1 năm trước',
          grade_level: 'LA',
          max_size: 25,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      const source = await previous
        .insertInto('education_plans')
        .values({
          template_id: templates['MN-LOP-THANG'] ?? null,
          template_name: 'Kế hoạch tháng năm trước',
          template_revision: 1,
          scope: 'class',
          period: 'month',
          school_level: 'MN',
          title: 'Kế hoạch tháng 10 năm trước',
          org_unit_id: units['ĐT-A'] ?? '',
          department_id: departments['Tổ Mẫu giáo lớn'] ?? null,
          class_id: sourceClass.id,
          owner_user_id: users.teacher?.userId ?? '',
          owner_name: 'Giáo Viên Một',
          sections: JSON.stringify([
            { key: 'chu_de', title: 'I. Chủ đề', kind: 'text' },
            { key: 'cu', title: 'Mục đã bỏ', kind: 'text' },
          ]),
          content: JSON.stringify({ chu_de: 'Chủ đề Gia đình\nTuần 1: Bé và gia đình', cu: 'Không còn' }),
          approval_steps: ['leader'],
          status: 'approved',
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      const listed = await api('GET', '/education-plans/previous-year', 'teacher');
      assert.equal(listed.body.year_name, 'Năm học trước thử');
      assert.deepEqual(
        (listed.body.plans as Array<{ id: string }>).map((plan) => plan.id),
        [source.id],
      );
      assert.deepEqual(
        ((await api('GET', '/education-plans/previous-year', 'teacher2')).body.plans as unknown[]).length,
        0,
      );
      const noClass = await api('POST', '/education-plans/copy', 'teacher', { source_id: source.id });
      assert.equal(noClass.status, 400);
      const copied = await api('POST', '/education-plans/copy', 'teacher', {
        source_id: source.id,
        class_id: classes.la1,
        title: 'Kế hoạch tháng 10 năm nay',
      });
      assert.equal(copied.status, 201, JSON.stringify(copied.body));
      assert.equal(copied.body.template_id, templates['MN-LOP-THANG']);
      assert.equal(copied.body.source_year_name, 'Năm học trước thử');
      assert.equal((copied.body.content as Record<string, string>).chu_de, 'Chủ đề Gia đình\nTuần 1: Bé và gia đình');
      const id = copied.body.id as string;
      await api('PUT', `/education-plans/${id}`, 'teacher', {
        title: 'Kế hoạch tháng 10 năm nay',
        content: { chu_de: 'Chủ đề Gia đình\nTuần 1: Gia đình của bé' },
      });
      const diff = await api('GET', `/education-plans/${id}/diff?from=source`, 'teacher');
      assert.equal(diff.status, 200, JSON.stringify(diff.body));
      const sections = diff.body.sections as Array<{
        key: string;
        state: string;
        lines: Array<{ op: string; text: string }>;
      }>;
      const theme = sections.find((section) => section.key === 'chu_de');
      assert.equal(theme?.state, 'changed');
      assert.deepEqual(theme?.lines, [
        { op: 'same', text: 'Chủ đề Gia đình' },
        { op: 'removed', text: 'Tuần 1: Bé và gia đình' },
        { op: 'added', text: 'Tuần 1: Gia đình của bé' },
      ]);
      assert.equal(sections.find((section) => section.key === 'cu')?.state, 'removed');
      assert.equal(sections.find((section) => section.key === 'muc_tieu')?.state, 'added');
    } finally {
      await previous.destroy();
    }
  });
});
