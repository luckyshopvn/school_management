import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  listPortalMenuEntries,
  PORTAL_WORKSPACES,
  portalMenuPathsOutsideLevels,
  portalWorkspacesForLevels,
  portalWorkspacesWithoutLevelName,
  SCHOOL_LEVEL_TERMS,
  schoolLevelTerms,
  workingSchoolLevels,
} from '@school-management/shared';
import { CurrentUser } from '../authentication/current-user.js';
import type { Databases } from '../common/databases.js';
import { SchoolLevelResolver } from '../common/school-levels.js';
import { sendJson, startApiTestEnvironment, type ApiTestEnvironment, type LoggedInUser } from '../test-support.js';

// Menu và phân hệ theo cấp học (DT-19 phần 19c, YCTD-153): thuộc tính cấp ở cây menu, nhãn thuật ngữ, cấp đang làm việc,
// tham số cấp dùng chung, lối tắt và ngữ cảnh trường theo cấp bật
const LEVEL_NAMES = { MN: 'Mầm non', TH: 'Tiểu học', THCS: 'Trung học cơ sở', THPT: 'Trung học phổ thông' } as const;
const levelsOf = (...codes: Array<keyof typeof LEVEL_NAMES>) =>
  codes.map((code) => ({ code, display_name: LEVEL_NAMES[code] }));
const PRESCHOOL_ONLY_PATHS = [
  '/growth',
  '/growth-report',
  '/program-completion',
  '/entry-admissions/final-year',
  '/emis',
  '/emis/send',
  '/emis/end-of-year',
  '/emis/preschool-end-of-year',
];
// Mục chỉ của Tiểu học (DT-20 phần 20a, 20b): trường chỉ có Mầm non không thấy, các mục khác giữ y hệt
const PRIMARY_ONLY_PATHS = [
  '/subjects',
  '/teaching-assignments',
  '/boarding',
  '/conduct',
  // Nội quy, phân công giám thị (YCTD-391)
  '/supervision',
  // Thời khoá biểu phần khung (DT-20 phần 22c1)
  '/period-slots',
  '/timetables',
  // Đánh giá học sinh (DT-20 phần 20c)
  '/student-assessments',
  // Sổ đầu bài, chuyên cần theo tiết (DT-20 phần 20d)
  '/class-logs',
  '/period-attendance',
  // Học bạ, khen thưởng, lên lớp (DT-20 phần 20e)
  '/learning-records',
  // Máy xếp, dạy thay, đổi tiết, báo cáo (DT-20 phần 22c2)
  '/timetable-generator',
  '/timetable-changes',
  '/timetable-reports',
  // Báo cáo, thống kê, EMIS Tiểu học (DT-20 phần 20f)
  '/primary-reports',
  // Học tập trực tuyến của Tiểu học, THCS, THPT (DT-28 phần 28b)
  '/online-classes',
  '/course-templates',
  '/online-teaching',
  '/online-learning-reports',
  '/online-discussion-safety',
  '/online-homework',
];
// Mục chỉ của THCS, THPT (DT-21 phần 21a; kiểm tra, đánh giá phần đề 22g1): trường chỉ có Mầm non hay Tiểu học không thấy
const SECONDARY_ONLY_PATHS = [
  '/subject-combinations',
  '/subject-teams',
  '/scores',
  '/graduation',
  '/question-bank',
  '/exam-matrices',
  '/assessment-plans',
  '/exams',
  // Chấm bài kiểm tra, báo cáo (DT-21 phần 22g2)
  '/exam-grading',
  '/exam-reports',
  // Sơ đồ chỗ ngồi (DT-21 phần 21d)
  '/seating-charts',
  // Báo cáo, thống kê, EMIS THCS, THPT (DT-21 phần 21g)
  '/secondary-reports',
];

// Phân hệ Thi trực tuyến (DT-23 phần 23a) có từ Tiểu học trở lên: trường chỉ có Mầm non không thấy
const ONLINE_EXAM_PATHS = ['/online-exams', '/online-exams/monitor', '/online-exams/settings'];
// Phân hệ Gia sư trực tuyến (DT-27 phần 27b, thu chi ở 27c) cũng từ Tiểu học trở lên
const TUTORING_PATHS = [
  '/tutoring',
  '/tutoring/sessions',
  '/tutoring/exemptions',
  '/tutoring/rules',
  '/tutoring/finance',
];

describe('Cây menu và nhãn theo cấp học', () => {
  it('CT-19c-1: trường chỉ có Mầm non giữ y hệt cây menu (tên phân hệ, số thứ bậc, thứ tự, mục)', () => {
    const preschool = portalWorkspacesForLevels(levelsOf('MN'));
    assert.deepEqual(
      listPortalMenuEntries(preschool).map((entry) => [entry.workspace.key, entry.node.number, entry.node.path]),
      listPortalMenuEntries(PORTAL_WORKSPACES)
        .filter(
          (entry) =>
            ![...PRIMARY_ONLY_PATHS, ...SECONDARY_ONLY_PATHS, ...ONLINE_EXAM_PATHS, ...TUTORING_PATHS].includes(
              entry.node.path,
            ),
        )
        .map((entry) => [entry.workspace.key, entry.node.number, entry.node.path]),
    );
    assert.deepEqual(
      preschool.map((workspace) => workspace.label),
      PORTAL_WORKSPACES.filter((workspace) => workspace.key !== 'online-exam' && workspace.key !== 'tutoring').map(
        (workspace) => workspace.label,
      ),
    );
    assert.deepEqual(
      [...portalMenuPathsOutsideLevels(['MN'])].sort(),
      [...PRIMARY_ONLY_PATHS, ...SECONDARY_ONLY_PATHS, ...ONLINE_EXAM_PATHS, ...TUTORING_PATHS].sort(),
    );
    assert.deepEqual([...portalMenuPathsOutsideLevels(['MN', 'TH'])].sort(), [...SECONDARY_ONLY_PATHS].sort());
    assert.equal(portalMenuPathsOutsideLevels(['MN', 'TH', 'THCS', 'THPT']).size, 0);
  });

  it('CT-19c-2: cấp khác ẩn mục chỉ của Mầm non, nhóm rỗng bỏ; tên phân hệ theo cấp, nhiều cấp là "Quản lý giáo dục"', () => {
    const primary = portalWorkspacesForLevels(levelsOf('TH'));
    const paths = listPortalMenuEntries(primary).map((entry) => entry.node.path);
    for (const path of PRESCHOOL_ONLY_PATHS) {
      assert.ok(!paths.includes(path as never), path);
    }
    assert.ok(paths.includes('/children'));
    assert.ok(paths.includes('/emis/facilities'));
    assert.deepEqual(
      [...portalMenuPathsOutsideLevels(['TH'])].sort(),
      [...PRESCHOOL_ONLY_PATHS, ...SECONDARY_ONLY_PATHS].sort(),
    );
    const education = (workspaces: typeof primary) => workspaces.find((workspace) => workspace.key === 'education');
    assert.equal(education(primary)?.label, 'Quản lý giáo dục Tiểu học');
    // Nhóm 4.3 Cân nặng, chiều cao bỏ hẳn; số của mục còn lại giữ nguyên số của Sở
    const students = education(primary)?.menu.find((node) => node.number === '4.');
    assert.deepEqual(
      students?.children?.map((node) => node.number),
      ['4.1.', '4.2.', '4.5.', '4.6.', '4.7.', '4.8.', '4.9.', '4.10.'],
    );
    const emis = primary.find((workspace) => workspace.key === 'emis');
    assert.deepEqual(
      emis?.menu.map((node) => [node.number, node.children?.map((child) => child.number)]),
      [
        ['1.', ['1.2.', '1.3.']],
        ['2.', ['2.2.', '2.3.']],
      ],
    );
    assert.equal(education(portalWorkspacesForLevels(levelsOf('MN', 'TH')))?.label, 'Quản lý giáo dục');
    assert.deepEqual(portalWorkspacesForLevels(levelsOf('MN', 'TH')).length, PORTAL_WORKSPACES.length);
    // Tên cấp lấy từ school_levels, không ghi cứng
    assert.equal(
      education(portalWorkspacesForLevels([{ code: 'MN', display_name: 'Mầm non (nhà trẻ, mẫu giáo)' }]))?.label,
      'Quản lý giáo dục Mầm non (nhà trẻ, mẫu giáo)',
    );
  });

  it('CT-19c-10 (YCTD-388): tên phân hệ cho từng trường hợp cấp; chưa biết cấp thì không gắn tên cấp nào', () => {
    const education = (workspaces: ReturnType<typeof portalWorkspacesForLevels>) =>
      workspaces.find((workspace) => workspace.key === 'education')?.label;
    assert.equal(education(portalWorkspacesForLevels(levelsOf('MN'))), 'Quản lý giáo dục Mầm non');
    assert.equal(education(portalWorkspacesForLevels(levelsOf('TH'))), 'Quản lý giáo dục Tiểu học');
    assert.equal(education(portalWorkspacesForLevels(levelsOf('THCS'))), 'Quản lý giáo dục Trung học cơ sở');
    assert.equal(education(portalWorkspacesForLevels(levelsOf('THPT'))), 'Quản lý giáo dục Trung học phổ thông');
    assert.equal(education(portalWorkspacesForLevels(levelsOf('THCS', 'THPT'))), 'Quản lý giáo dục');
    // Đang tải ngữ cảnh trường: giữ cây, phân hệ đặt tên theo cấp chỉ còn "Quản lý giáo dục"; phân hệ khác giữ tên
    const preschool = portalWorkspacesForLevels(levelsOf('MN'));
    const loading = portalWorkspacesWithoutLevelName(preschool);
    assert.equal(education(loading), 'Quản lý giáo dục');
    assert.deepEqual(
      loading.filter((workspace) => workspace.key !== 'education').map((workspace) => workspace.label),
      preschool.filter((workspace) => workspace.key !== 'education').map((workspace) => workspace.label),
    );
    assert.deepEqual(
      listPortalMenuEntries(loading).map((entry) => entry.node.path),
      listPortalMenuEntries(preschool).map((entry) => entry.node.path),
    );
  });

  it('CT-19c-3: nhãn thuật ngữ theo cấp; thuật ngữ trường đặt ở 1.4 thay chữ "Trẻ"; nhiều cấp khác nhau dùng "Học sinh"', () => {
    assert.deepEqual(schoolLevelTerms([{ code: 'MN' }]), {
      learner: 'Trẻ',
      learnerProfile: 'Hồ sơ trẻ',
      classGroup: 'Nhóm lớp',
    });
    assert.deepEqual(schoolLevelTerms([{ code: 'MN', learner_term: 'Trẻ' }]), SCHOOL_LEVEL_TERMS.MN);
    assert.deepEqual(schoolLevelTerms([]), SCHOOL_LEVEL_TERMS.MN);
    assert.deepEqual(schoolLevelTerms([{ code: 'TH', learner_term: 'Học sinh' }]), {
      learner: 'Học sinh',
      learnerProfile: 'Hồ sơ học sinh',
      classGroup: 'Lớp',
    });
    assert.equal(schoolLevelTerms([{ code: 'MN', learner_term: 'Cháu' }]).learnerProfile, 'Hồ sơ cháu');
    assert.deepEqual(schoolLevelTerms([{ code: 'MN' }, { code: 'TH' }]), SCHOOL_LEVEL_TERMS.TH);
    assert.deepEqual(schoolLevelTerms([{ code: 'TH' }, { code: 'THCS' }]), SCHOOL_LEVEL_TERMS.TH);
  });

  it('CT-19c-4: cấp đang làm việc: cấp đã chọn còn được xem thì chỉ cấp đó, còn lại là mọi cấp được xem', () => {
    assert.deepEqual(workingSchoolLevels(['MN'], null), ['MN']);
    assert.deepEqual(workingSchoolLevels(['MN'], 'TH'), ['MN']);
    assert.deepEqual(workingSchoolLevels(['MN', 'TH'], null), ['MN', 'TH']);
    assert.deepEqual(workingSchoolLevels(['MN', 'TH'], 'TH'), ['TH']);
    assert.deepEqual(workingSchoolLevels(['MN', 'TH'], 'THPT'), ['MN', 'TH']);
    assert.deepEqual(workingSchoolLevels(['MN', 'TH'], 'all'), ['MN', 'TH']);
  });
});

describe('Điểm cuối theo cấp đang làm việc', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let teacher: LoggedInUser;
  const url = (path: string) => `${environment.baseUrl}${path}`;
  const identityUrl = (path: string) => `${environment.identity.baseUrl}${path}`;
  const setEnabled = async (codes: string[]) => {
    const current = await sendJson('GET', url('/school-levels'), principal.accessToken);
    const levels = (current.body.levels as Array<Record<string, unknown>>).map(
      ({ code, order_no, display_name, learner_term, context_label }) => ({
        code,
        is_enabled: codes.includes(code as string),
        order_no,
        display_name,
        learner_term,
        context_label,
      }),
    );
    const saved = await sendJson('PUT', url('/school-levels'), principal.accessToken, { levels });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
  };

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    teacher = await environment.loginAs('VT-07', null);
  });

  after(async () => {
    await environment.close();
  });

  it('CT-19c-5: cấp người dùng được xem ở /portal-context/school-levels; trường mầm non chỉ có Mầm non; ngữ cảnh cũ không đổi', async () => {
    const preschool = await sendJson('GET', url('/portal-context'), teacher.accessToken);
    assert.equal(preschool.status, 200);
    assert.equal(preschool.body.education_level, 'Cấp MN');
    assert.equal(preschool.body.school_levels, undefined);
    const levels = await sendJson('GET', url('/portal-context/school-levels'), teacher.accessToken);
    assert.equal(levels.status, 200);
    assert.equal((await sendJson('GET', url('/portal-context/school-levels'), undefined)).status, 401);
    assert.deepEqual(levels.body.school_levels, [
      { code: 'MN', display_name: 'Mầm non', learner_term: 'Trẻ', context_label: 'Cấp MN' },
    ]);
    await setEnabled(['MN', 'TH']);
    const both = await sendJson('GET', url('/portal-context/school-levels'), teacher.accessToken);
    assert.deepEqual(
      (both.body.school_levels as Array<{ code: string }>).map((level) => level.code),
      ['MN', 'TH'],
    );
    const scoped = await sendJson('PUT', identityUrl(`/users/${teacher.userId}/school-levels`), principal.accessToken, {
      school_levels: ['TH'],
    });
    assert.equal(scoped.status, 200);
    const narrowed = await sendJson('GET', url('/portal-context/school-levels'), teacher.accessToken);
    assert.deepEqual(
      (narrowed.body.school_levels as Array<{ code: string }>).map((level) => level.code),
      ['TH'],
    );
    await sendJson('PUT', identityUrl(`/users/${teacher.userId}/school-levels`), principal.accessToken, {
      school_levels: [],
    });
    await setEnabled(['MN']);
  });

  it('CT-19c-6: lưu cấp đang làm việc theo tài khoản; mã sai hoặc ngoài phạm vi cấp bị từ chối; trống là "Tất cả"', async () => {
    const initial = await sendJson('GET', identityUrl('/auth/me'), teacher.accessToken);
    assert.equal(initial.body.working_school_level, null);
    assert.equal(
      (await sendJson('PUT', identityUrl('/auth/me/working-school-level'), undefined, { school_level: 'TH' })).status,
      401,
    );
    const saved = await sendJson('PUT', identityUrl('/auth/me/working-school-level'), teacher.accessToken, {
      school_level: 'TH',
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.deepEqual(saved.body, { working_school_level: 'TH' });
    assert.equal((await sendJson('GET', identityUrl('/auth/me'), teacher.accessToken)).body.working_school_level, 'TH');
    // Riêng từng tài khoản
    assert.equal(
      (await sendJson('GET', identityUrl('/auth/me'), principal.accessToken)).body.working_school_level,
      null,
    );
    const invalid = await sendJson('PUT', identityUrl('/auth/me/working-school-level'), teacher.accessToken, {
      school_level: 'DH',
    });
    assert.equal(invalid.status, 400);
    await sendJson('PUT', identityUrl(`/users/${teacher.userId}/school-levels`), principal.accessToken, {
      school_levels: ['MN'],
    });
    const outside = await sendJson('PUT', identityUrl('/auth/me/working-school-level'), teacher.accessToken, {
      school_level: 'THCS',
    });
    assert.equal(outside.status, 400);
    const all = await sendJson('PUT', identityUrl('/auth/me/working-school-level'), teacher.accessToken, {
      school_level: null,
    });
    assert.deepEqual(all.body, { working_school_level: null });
    await sendJson('PUT', identityUrl(`/users/${teacher.userId}/school-levels`), principal.accessToken, {
      school_levels: [],
    });
  });

  it('CT-19c-7: tham số cấp dùng chung: không gửi hoặc "all" là mọi cấp được xem; mã sai 400; cấp chưa bật 403', async () => {
    const resolver = new SchoolLevelResolver({ system: environment.system } as unknown as Databases);
    const user = (school_levels: string[]) =>
      new CurrentUser({ id: teacher.userId, full_name: 'GV', assignments: [], school_levels });
    assert.deepEqual(await resolver.requested(user([]), undefined), ['MN']);
    assert.deepEqual(await resolver.requested(user([]), 'all'), ['MN']);
    assert.deepEqual(await resolver.requested(user([]), 'MN'), ['MN']);
    await assert.rejects(resolver.requested(user([]), 'DH'), { code: 'ERR_VALIDATION' });
    await assert.rejects(resolver.requested(user([]), 'TH'), { code: 'ERR_FORBIDDEN' });
    await setEnabled(['MN', 'TH']);
    resolver.invalidate();
    assert.deepEqual(await resolver.requested(user([]), ''), ['MN', 'TH']);
    assert.deepEqual(await resolver.requested(user([]), 'TH'), ['TH']);
    assert.deepEqual(await resolver.requested(user(['TH']), undefined), ['TH']);
    await assert.rejects(resolver.requested(user(['TH']), 'MN'), { code: 'ERR_FORBIDDEN' });
    await setEnabled(['MN']);
  });

  it('CT-19c-8: lối tắt tới mục của cấp chưa bật không hiện, vẫn giữ để hiện lại khi bật cấp', async () => {
    const links = [
      { path: '/children', label: 'Hồ sơ học sinh' },
      { path: '/growth', label: 'Cân đo' },
    ];
    const saved = await sendJson('PUT', url('/me/quick-links'), teacher.accessToken, { links });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.deepEqual(
      (saved.body as unknown as Array<{ path: string }>).map((link) => link.path),
      ['/children', '/growth'],
    );
    await setEnabled(['TH']);
    const primary = await sendJson('GET', url('/me/quick-links'), teacher.accessToken);
    assert.deepEqual(
      (primary.body as unknown as Array<{ path: string }>).map((link) => link.path),
      ['/children'],
    );
    await setEnabled(['MN', 'TH']);
    const both = await sendJson('GET', url('/me/quick-links'), teacher.accessToken);
    assert.deepEqual(
      (both.body as unknown as Array<{ path: string }>).map((link) => link.path),
      ['/children', '/growth'],
    );
    await setEnabled(['MN']);
  });
});
