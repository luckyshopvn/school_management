import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import type { MyWorkItem } from '@school-management/shared';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import {
  detectResourceFileType,
  needsSchoolReview,
  normalizeFileName,
  parseExternalLink,
  parseLearningResource,
  submitProblems,
} from './learning-resource-rules.js';

// Kho học liệu số (DT-22 phần 22h1, YCTD-183): danh mục, tải lên, liên kết ngoài, giấy phép bắt buộc, kiểm duyệt phân luồng
// theo rủi ro, phạm vi xem, phiên bản, bộ sưu tập, báo lỗi, thống kê
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const PDF = Buffer.from('%PDF-1.4\n% hoc lieu thu\n%%EOF\n');
const PDF_TWO = Buffer.from('%PDF-1.4\n% phien ban hai\n%%EOF\n');

describe('Quy tắc kho học liệu', () => {
  it('CT-22h1-1: đọc metadata; liên kết http, https; định dạng tệp theo chữ ký; tên tệp; phân luồng; điều kiện gửi duyệt', () => {
    const typeId = '00000000-0000-4000-8000-000000000001';
    const parsed = parseLearningResource({
      title: '  Phiếu học tập phân số ',
      type_id: typeId,
      school_level: 'TH',
      keywords: ['phân số', ' phân số ', 'toán'],
      visibility: 'school',
    });
    assert.equal(parsed.title, 'Phiếu học tập phân số');
    assert.deepEqual(parsed.keywords, ['phân số', 'toán']);
    assert.equal(parsed.language, 'vi');
    for (const body of [
      { title: '', type_id: typeId },
      { title: 'A', type_id: 'x' },
      { title: 'A', type_id: typeId, school_level: 'DH' },
      { title: 'A', type_id: typeId, visibility: 'network' },
      { title: 'A', type_id: typeId, week_no: 70 },
    ]) {
      assert.throws(() => parseLearningResource(body), { code: 'ERR_VALIDATION' }, JSON.stringify(body));
    }
    assert.equal(parseExternalLink(' https://example.org/bai-giang '), 'https://example.org/bai-giang');
    for (const value of ['ftp://example.org/a', 'javascript:alert(1)', 'khong phai dia chi', 42]) {
      assert.throws(() => parseExternalLink(value), { code: 'ERR_VALIDATION' }, String(value));
    }
    const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]);
    const mp4 = Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]);
    assert.deepEqual(
      [
        detectResourceFileType('a.pdf', PDF),
        detectResourceFileType('bai.pptx', zip),
        detectResourceFileType('video.mp4', mp4),
        detectResourceFileType('gia.pdf', Buffer.from('khong phai pdf')),
        detectResourceFileType('a.exe', zip),
      ],
      [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'video/mp4',
        undefined,
        undefined,
      ],
    );
    assert.equal(normalizeFileName('C:\\tai lieu\\bai  1:<x>.pdf'), 'bai 1x.pdf');
    assert.equal(normalizeFileName('///'), 'hoc-lieu');
    const route = {
      typeCode: 'worksheet',
      typeRequiresSchool: false,
      versionKind: 'file' as const,
      licenseRequiresGrant: false,
    };
    assert.deepEqual(
      [
        needsSchoolReview(route),
        needsSchoolReview({ ...route, versionKind: 'link' }),
        needsSchoolReview({ ...route, typeCode: 'video' }),
        needsSchoolReview({ ...route, licenseRequiresGrant: true }),
        needsSchoolReview({ ...route, typeRequiresSchool: true }),
      ],
      [false, true, true, true, true],
    );
    const license = { blocked: false, private_only: false, requires_grant_source: false, status: 'active' };
    assert.deepEqual(submitProblems({ hasVersion: true, visibility: 'school', license, licenseSource: null }), []);
    assert.equal(
      submitProblems({
        hasVersion: false,
        visibility: 'private',
        license: { ...license, blocked: true, private_only: true, requires_grant_source: true },
        licenseSource: null,
      }).length,
      5,
    );
    assert.deepEqual(submitProblems({ hasVersion: true, visibility: 'unit', license: null, licenseSource: null }), [
      'Chưa chọn giấy phép',
    ]);
  });
});

describe('Điểm cuối kho học liệu', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  const users: Record<string, LoggedInUser> = {};
  const departments: Record<string, string> = {};
  const types: Record<string, string> = {};
  const licenses: Record<string, string> = {};
  const resources: Record<string, string> = {};
  let rootUnit = '';

  const token = (name: string) => (name === 'principal' ? principal.accessToken : (users[name]?.accessToken ?? ''));
  const api = (method: string, path: string, name: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, token(name), body);
  const list = (body: unknown) => body as unknown as Array<Record<string, unknown>>;
  const upload = async (id: string | undefined, name: string, file: Buffer, fileName = 'phieu-hoc-tap.pdf') => {
    const form = new FormData();
    form.append('file', new Blob([file], { type: 'application/pdf' }), fileName);
    const response = await fetch(`${environment.baseUrl}/learning-resources/${id ?? ''}/files`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token(name)}` },
      body: form,
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  };
  const download = async (path: string, name: string) => {
    const response = await fetch(`${environment.baseUrl}${path}`, {
      headers: { authorization: `Bearer ${token(name)}` },
    });
    return {
      status: response.status,
      type: response.headers.get('content-type') ?? '',
      body: Buffer.from(await response.arrayBuffer()),
    };
  };
  const searchTitles = async (name: string, query = '') =>
    list((await api('GET', `/learning-resources${query}`, name)).body).map((row) => row.title);
  const resource = (extra: Record<string, unknown> = {}) => ({
    title: 'Phiếu học tập phân số',
    type_id: types.worksheet,
    school_level: 'TH',
    keywords: ['phân số'],
    license_id: licenses.SELF,
    visibility: 'school',
    ...extra,
  });

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    const firstStart = addDays(vietnamToday, -100);
    const firstEnd = addDays(vietnamToday, 120);
    const year = Number(firstStart.slice(0, 4));
    await openTestAcademicYear(environment, principal.accessToken, `${year}–${year + 1}`, {
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
    rootUnit = (
      await api('POST', '/org-units', 'principal', { code: 'THL', name: 'Trường thử', unit_type: 'truong_chinh' })
    ).body.id as string;
    for (const name of ['Tổ Toán', 'Tổ Văn']) {
      departments[name] = (
        await schoolYear
          .insertInto('departments')
          .values({ org_unit_id: rootUnit, name })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    users.leader = await environment.loginAs('VT-17', rootUnit);
    users.leader2 = await environment.loginAs('VT-17', rootUnit);
    users.teacher = await environment.loginAs('VT-07', rootUnit);
    users.teacher2 = await environment.loginAs('VT-07', rootUnit);
    users.parent = await environment.loginAs('VT-14', rootUnit);
    for (const [key, name, department] of [
      ['principal', 'Hiệu Trưởng Giả', null],
      ['leader', 'Tổ Trưởng Toán', 'Tổ Toán'],
      ['leader2', 'Tổ Trưởng Văn', 'Tổ Văn'],
      ['teacher', 'Giáo Viên Toán', 'Tổ Toán'],
      ['teacher2', 'Giáo Viên Văn', 'Tổ Văn'],
    ] as const) {
      await schoolYear
        .insertInto('staff')
        .values({
          org_unit_id: rootUnit,
          code: `NS-${randomInt(100_000, 999_999)}`,
          full_name: name,
          start_date: addDays(vietnamToday, -800),
          department_id: department ? (departments[department] ?? null) : null,
          user_id: key === 'principal' ? principal.userId : (users[key]?.userId ?? null),
        })
        .execute();
    }
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-22h1-2: danh mục mặc định 8 loại, 10 giấy phép; chỉ thủ kho sửa loại, giấy phép; giáo viên thêm chủ đề', async () => {
    const catalog = await api('GET', '/learning-resources/catalog', 'teacher');
    assert.equal(catalog.status, 200, JSON.stringify(catalog.body));
    for (const row of list(catalog.body.types)) {
      types[row.code as string] = row.id as string;
    }
    for (const row of list(catalog.body.licenses)) {
      licenses[row.code as string] = row.id as string;
    }
    assert.equal(Object.keys(types).length, 8);
    assert.equal(Object.keys(licenses).length, 10);
    assert.equal(list(catalog.body.types).find((row) => row.code === 'video')?.requires_school_review, true);
    assert.equal(list(catalog.body.licenses).find((row) => row.code === 'UNKNOWN')?.private_only, true);
    assert.equal((await api('GET', '/learning-resources/catalog', 'parent')).status, 403);
    assert.equal((await api('POST', '/learning-resources/types', 'teacher', { code: 'X', name: 'X' })).status, 403);
    const blocked = await api('POST', '/learning-resources/licenses', 'principal', {
      code: 'BLOCKED',
      name: 'Nguồn trường chặn',
      blocked: true,
    });
    assert.equal(blocked.status, 201, JSON.stringify(blocked.body));
    licenses.BLOCKED = blocked.body.id as string;
    assert.equal(
      (await api('POST', '/learning-resources/licenses', 'principal', { code: 'BLOCKED', name: 'Trùng' })).status,
      409,
    );
    const topic = await api('POST', '/learning-resources/topics', 'teacher', {
      name: 'Phân số',
      grade_level_code: 'K4',
    });
    assert.equal(topic.status, 201, JSON.stringify(topic.body));
    assert.equal(
      (await api('PATCH', `/learning-resources/topics/${topic.body.id}`, 'teacher', { name: 'Đổi' })).status,
      403,
    );
  });

  it('CT-22h1-3: tải tệp, gửi duyệt; tổ trưởng cùng tổ duyệt thì công bố; liên kết ngoài thêm bước Ban Giám hiệu; trả lại có lý do', async () => {
    const created = await api('POST', '/learning-resources', 'teacher', resource());
    assert.equal(created.status, 201, JSON.stringify(created.body));
    resources.sheet = created.body.id as string;
    assert.equal(created.body.department_name, 'Tổ Toán');
    assert.equal((await api('POST', `/learning-resources/${resources.sheet}/submit`, 'teacher')).status, 422);
    assert.equal((await upload(resources.sheet, 'teacher', Buffer.from('MZ khong phai'), 'virus.exe')).status, 400);
    assert.equal((await upload(resources.sheet, 'teacher2', PDF)).status, 403);
    const file = await upload(resources.sheet, 'teacher', PDF);
    assert.equal(file.status, 201, JSON.stringify(file.body));
    assert.equal(file.body.version_no, 1);
    assert.equal(file.body.content_type, 'application/pdf');
    const submitted = await api('POST', `/learning-resources/${resources.sheet}/submit`, 'teacher');
    assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
    assert.equal(submitted.body.status, 'pending_unit');
    assert.equal(submitted.body.needs_school_review, false);
    assert.ok(!(await searchTitles('teacher2')).includes('Phiếu học tập phân số'));
    assert.equal(
      (await api('POST', `/learning-resources/${resources.sheet}/review`, 'leader2', { decision: 'approve' })).status,
      403,
    );
    const work = (await api('GET', '/my-work?source=learning_resources', 'leader')).body as unknown as {
      items: MyWorkItem[];
    };
    assert.deepEqual(
      work.items.map((entry) => entry.kind),
      ['Học liệu chờ tổ duyệt'],
    );
    const published = await api('POST', `/learning-resources/${resources.sheet}/review`, 'leader', {
      decision: 'approve',
    });
    assert.equal(published.status, 200, JSON.stringify(published.body));
    assert.equal(published.body.status, 'published');
    assert.equal(published.body.published_version, 1);

    const linked = await api(
      'POST',
      '/learning-resources',
      'teacher',
      resource({ title: 'Bài giảng phân số trên mạng', type_id: types.reference }),
    );
    resources.link = linked.body.id as string;
    assert.equal(
      (await api('POST', `/learning-resources/${resources.link}/links`, 'teacher', { url: 'ftp://x.org/a' })).status,
      400,
    );
    const link = await api('POST', `/learning-resources/${resources.link}/links`, 'teacher', {
      url: 'https://example.org/bai-giang-phan-so',
      link_title: 'Bài giảng mẫu',
    });
    assert.equal(link.status, 201, JSON.stringify(link.body));
    const pending = await api('POST', `/learning-resources/${resources.link}/submit`, 'teacher');
    assert.equal(pending.body.needs_school_review, true);
    const unit = await api('POST', `/learning-resources/${resources.link}/review`, 'leader', { decision: 'approve' });
    assert.equal(unit.body.status, 'pending_school');
    assert.equal(
      (await api('POST', `/learning-resources/${resources.link}/review`, 'leader', { decision: 'approve' })).status,
      403,
    );
    assert.equal(
      (await api('POST', `/learning-resources/${resources.link}/review`, 'principal', { decision: 'return' })).status,
      400,
    );
    const returned = await api('POST', `/learning-resources/${resources.link}/review`, 'principal', {
      decision: 'return',
      note: 'Ghi rõ nguồn của liên kết',
    });
    assert.equal(returned.body.status, 'returned');
    const ownerWork = (await api('GET', '/my-work?source=learning_resources', 'teacher')).body as unknown as {
      items: MyWorkItem[];
    };
    assert.deepEqual(
      ownerWork.items.map((entry) => [entry.kind, entry.detail]),
      [['Học liệu bị trả lại', 'Ghi rõ nguồn của liên kết']],
    );
    const again = await api('POST', `/learning-resources/${resources.link}/submit`, 'teacher');
    assert.equal(again.body.status, 'pending_unit');
    await api('POST', `/learning-resources/${resources.link}/review`, 'leader', { decision: 'approve' });
    const final = await api('POST', `/learning-resources/${resources.link}/review`, 'principal', {
      decision: 'approve',
    });
    assert.equal(final.body.status, 'published');
    const events = await api('GET', `/learning-resources/${resources.link}`, 'teacher');
    assert.deepEqual(
      list(events.body.events).map((row) => row.action),
      ['submit', 'unit_approve', 'return', 'submit', 'unit_approve', 'school_approve', 'publish'],
    );
  });

  it('CT-22h1-4: giấy phép bắt buộc: không rõ, bị chặn, có xin phép thiếu nơi cấp, phạm vi cá nhân không gửi duyệt; liên trường chưa bật', async () => {
    for (const [title, extra] of [
      ['Không rõ giấy phép', { license_id: licenses.UNKNOWN }],
      ['Bị chặn', { license_id: licenses.BLOCKED }],
      ['Có xin phép thiếu nơi cấp', { license_id: licenses.PERMISSION }],
      ['Cá nhân', { visibility: 'private' }],
      ['Chưa có giấy phép', { license_id: null }],
    ] as const) {
      const created = await api('POST', '/learning-resources', 'teacher', resource({ title, ...extra }));
      assert.equal(created.status, 201, JSON.stringify(created.body));
      await upload(created.body.id as string, 'teacher', PDF);
      const submitted = await api('POST', `/learning-resources/${created.body.id}/submit`, 'teacher');
      assert.equal(submitted.status, 422, title);
    }
    assert.equal(
      (await api('POST', '/learning-resources', 'teacher', resource({ visibility: 'network' }))).status,
      400,
    );
    const granted = await api(
      'POST',
      '/learning-resources',
      'teacher',
      resource({
        title: 'Tranh có xin phép',
        license_id: licenses.PERMISSION,
        license_source: 'Thư đồng ý của tác giả ngày 01/10',
      }),
    );
    await upload(granted.body.id as string, 'teacher', PDF);
    const submitted = await api('POST', `/learning-resources/${granted.body.id}/submit`, 'teacher');
    assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
    assert.equal(submitted.body.needs_school_review, true);
  });

  it('CT-22h1-5: phạm vi tổ chỉ người cùng tổ thấy; tải bản đã công bố, ghi lượt; phiên bản mới chờ duyệt vẫn giữ bản cũ; ngừng dùng', async () => {
    const unit = await api(
      'POST',
      '/learning-resources',
      'teacher',
      resource({ title: 'Đề ôn tập của tổ Toán', type_id: types.test_file, visibility: 'unit' }),
    );
    resources.unit = unit.body.id as string;
    await upload(resources.unit, 'teacher', PDF);
    await api('POST', `/learning-resources/${resources.unit}/submit`, 'teacher');
    await api('POST', `/learning-resources/${resources.unit}/review`, 'leader', { decision: 'approve' });
    assert.ok((await searchTitles('leader')).includes('Đề ôn tập của tổ Toán'));
    assert.ok(!(await searchTitles('teacher2')).includes('Đề ôn tập của tổ Toán'));
    assert.equal((await api('GET', `/learning-resources/${resources.unit}`, 'teacher2')).status, 404);
    assert.deepEqual(await searchTitles('teacher2', '?q=ph%C3%A2n%20s%E1%BB%91'), [
      'Bài giảng phân số trên mạng',
      'Phiếu học tập phân số',
    ]);

    const first = await download(`/learning-resources/${resources.sheet}/download`, 'teacher2');
    assert.equal(first.status, 200);
    assert.match(first.type, /application\/pdf/);
    assert.deepEqual(first.body, PDF);
    const link = await api('GET', `/learning-resources/${resources.link}/download`, 'teacher2');
    assert.equal(link.body.url, 'https://example.org/bai-giang-phan-so');

    const second = await upload(resources.sheet, 'teacher', PDF_TWO);
    assert.equal(second.body.version_no, 2);
    assert.equal(
      (await api('POST', `/learning-resources/${resources.sheet}/submit`, 'teacher')).body.status,
      'pending_unit',
    );
    assert.deepEqual((await download(`/learning-resources/${resources.sheet}/download`, 'teacher2')).body, PDF);
    assert.equal((await download(`/learning-resources/${resources.sheet}/download?version=2`, 'teacher2')).status, 404);
    assert.deepEqual((await download(`/learning-resources/${resources.sheet}/download`, 'teacher')).body, PDF_TWO);
    await api('POST', `/learning-resources/${resources.sheet}/review`, 'leader', { decision: 'approve' });
    assert.deepEqual((await download(`/learning-resources/${resources.sheet}/download`, 'teacher2')).body, PDF_TWO);
    const detail = await api('GET', `/learning-resources/${resources.sheet}`, 'teacher');
    assert.equal(detail.body.downloads, 2);
    assert.equal(list(detail.body.versions).length, 2);
    const othersView = await api('GET', `/learning-resources/${resources.sheet}`, 'teacher2');
    assert.equal(list(othersView.body.versions).length, 1);
    assert.deepEqual(othersView.body.events, []);

    assert.equal((await api('POST', `/learning-resources/${resources.unit}/retire`, 'teacher2')).status, 404);
    const retired = await api('POST', `/learning-resources/${resources.unit}/retire`, 'teacher');
    assert.equal(retired.body.status, 'retired');
    assert.ok(!(await searchTitles('leader')).includes('Đề ôn tập của tổ Toán'));
  });

  it('CT-22h1-6: bộ sưu tập chỉ chứa học liệu thấy được, xuất danh sách; báo lỗi, thủ kho ẩn tạm; thống kê', async () => {
    const collection = await api('POST', '/learning-resources/collections', 'teacher2', {
      name: 'Phân số lớp 4',
      visibility: 'school',
    });
    assert.equal(collection.status, 201, JSON.stringify(collection.body));
    const id = collection.body.id as string;
    assert.equal(
      (await api('PUT', `/learning-resources/collections/${id}/items`, 'teacher2', { resource_ids: [resources.unit] }))
        .status,
      400,
    );
    const items = await api('PUT', `/learning-resources/collections/${id}/items`, 'teacher2', {
      resource_ids: [resources.link, resources.sheet],
    });
    assert.equal(items.status, 200, JSON.stringify(items.body));
    assert.deepEqual(
      list(items.body.items).map((row) => row.title),
      ['Bài giảng phân số trên mạng', 'Phiếu học tập phân số'],
    );
    assert.equal(
      (await api('PUT', `/learning-resources/collections/${id}/items`, 'teacher', { resource_ids: [] })).status,
      403,
    );
    const exported = await download(`/learning-resources/collections/${id}/export`, 'teacher');
    assert.equal(exported.status, 200);
    assert.match(exported.type, /spreadsheetml/);

    const report = await api('POST', `/learning-resources/${resources.link}/reports`, 'teacher2', {
      kind: 'copyright',
      description: 'Liên kết dẫn tới trang chia sẻ sách giáo khoa không xin phép',
    });
    assert.equal(report.status, 201, JSON.stringify(report.body));
    assert.equal(
      (await api('POST', `/learning-resources/${resources.link}/reports`, 'teacher2', { kind: 'x', description: 'a' }))
        .status,
      400,
    );
    const managerWork = (await api('GET', '/my-work?source=learning_resources', 'principal')).body as unknown as {
      items: MyWorkItem[];
    };
    assert.ok(managerWork.items.some((entry) => entry.kind === 'Báo lỗi học liệu chờ xử lý'));
    assert.equal(list((await api('GET', '/learning-resources/reports', 'teacher')).body).length, 1);
    assert.equal(
      (
        await api('POST', `/learning-resources/reports/${report.body.id}/handle`, 'teacher', {
          status: 'resolved',
          response: 'x',
        })
      ).status,
      403,
    );
    const handled = await api('POST', `/learning-resources/reports/${report.body.id}/handle`, 'principal', {
      status: 'resolved',
      response: 'Đã ẩn tạm để kiểm tra nguồn',
      hide: true,
    });
    assert.equal(handled.status, 200, JSON.stringify(handled.body));
    assert.ok(!(await searchTitles('teacher2')).includes('Bài giảng phân số trên mạng'));
    const restored = await api('POST', `/learning-resources/${resources.link}/restore`, 'principal');
    assert.equal(restored.body.status, 'published');

    assert.equal((await api('GET', '/learning-resources/statistics', 'teacher')).status, 403);
    const statistics = await api('GET', '/learning-resources/statistics', 'principal');
    assert.equal(statistics.status, 200, JSON.stringify(statistics.body));
    assert.equal(statistics.body.published, 2);
    assert.ok((statistics.body.pending as number) >= 1);
    const byType = list(statistics.body.by_type);
    assert.ok(byType.some((row) => row.label === 'Phiếu học tập'));
    const top = list(statistics.body.top).find((row) => row.title === 'Bài giảng phân số trên mạng');
    assert.equal(top?.reports, 1);
    const leader = await api('GET', '/learning-resources/statistics', 'leader2');
    assert.equal(leader.body.total, 0);
  });
});
