import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import { createTestUser, postJson } from '@school-management/identity/testing';
import type { Kysely } from 'kysely';
import { ZipWriter } from '../../school-data-export/zip-writer.js';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../../test-support.js';

// Điểm cuối gói SCORM và gói khoá học (DT-28 phần 28h, YCTD-278): tải gói lên học liệu loại SCORM của kho 22h1 (kiểm bản kê,
// đường dẫn, loại tệp), xem trước, phát tệp ở nguồn gốc riêng (CSP sandbox, không chặn khung chung, bộ chuyển API gắn vào trang
// SCO), mã truy cập sửa thì 404; hoạt động loại SCORM trỏ tới học liệu đã công bố, học sinh mở bài và gửi giá trị, kết quả hoạt
// động; xuất, nhập gói khoá học. Người, lớp, gói là dữ liệu giả
const MANIFEST = `<?xml version="1.0"?>
<manifest identifier="goi-phan-so"><metadata><schemaversion>1.2</schemaversion></metadata>
<organizations default="O"><organization identifier="O"><title>Phân số</title>
<item identifier="BAI1" identifierref="R1"><title>Bài 1</title></item></organization></organizations>
<resources><resource identifier="R1" adlcp:scormtype="sco" href="index.html"/></resources></manifest>`;

function scormZip(extra: Record<string, string> = {}) {
  const writer = new ZipWriter();
  writer.add('imsmanifest.xml', MANIFEST);
  writer.add(
    'index.html',
    '<!DOCTYPE html><html><head><title>Bài 1</title><script src="bai.js"></script></head><body></body></html>',
  );
  writer.add('bai.js', 'window.ok = true;');
  for (const [name, content] of Object.entries(extra)) writer.add(name, content);
  return writer.finish();
}

describe('Điểm cuối gói SCORM, gói khoá học', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let teacher: LoggedInUser;
  let otherTeacher: LoggedInUser;
  let unitId = '';
  let academicYearId = '';
  let spaceId = '';
  let sectionId = '';
  let childId = '';
  let studentToken = '';
  let resourceId = '';
  let packageId = '';
  let activityId = '';
  const subjects: Record<string, string> = {};
  const types: Record<string, string> = {};
  const licenses: Record<string, string> = {};
  const url = (path: string) => `${environment.baseUrl}${path}`;
  const root = () => new URL(environment.baseUrl).origin;
  const api = (method: string, path: string, token: string, body?: unknown) => sendJson(method, url(path), token, body);
  const rows = (body: unknown) => body as unknown as Array<Record<string, unknown>>;
  const ORIGIN = 'http://localhost:5173';

  async function upload(path: string, token: string, body: Buffer, fileName: string) {
    const form = new FormData();
    form.append('file', new Blob([body]), fileName);
    const response = await fetch(url(path), {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: form,
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  async function withOrigin(path: string, token: string, body: unknown = {}) {
    const response = await fetch(url(path), {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  async function createResource(typeCode: string, title: string) {
    const created = await api('POST', '/learning-resources', teacher.accessToken, {
      title,
      type_id: types[typeCode],
      school_level: 'THCS',
      keywords: [],
      license_id: licenses.SELF,
      visibility: 'school',
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    return created.body.id as string;
  }

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    academicYearId = await openTestAcademicYear(environment, principal.accessToken, '2026-2027', {
      first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    });
    const registry = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .where('academic_year_id', '=', academicYearId)
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, registry.database_name),
    );
    unitId = (
      await api('POST', '/org-units', principal.accessToken, {
        code: 'THCS-28H',
        name: 'Trường THCS thử',
        unit_type: 'truong_chinh',
      })
    ).body.id as string;
    const current = await api('GET', '/school-levels', principal.accessToken);
    const levels = (current.body.levels as Array<Record<string, unknown>>).map(
      ({ code, order_no, display_name, learner_term, context_label }) => ({
        code,
        is_enabled: code === 'MN' || code === 'THCS',
        order_no,
        display_name,
        learner_term,
        context_label,
      }),
    );
    assert.equal((await api('PUT', '/school-levels', principal.accessToken, { levels })).status, 200);
    for (const path of ['/grade-levels/templates', '/subjects/templates']) {
      assert.equal((await api('POST', path, principal.accessToken, { school_level: 'THCS' })).status, 200);
    }
    for (const row of rows((await api('GET', '/subjects?school_level=THCS', principal.accessToken)).body)) {
      subjects[row.code as string] = row.id as string;
    }
    teacher = await environment.loginAs('VT-08', unitId);
    otherTeacher = await environment.loginAs('VT-08', unitId);
    const classId = (
      await schoolYear
        .insertInto('classes')
        .values({
          org_unit_id: unitId,
          academic_year_id: academicYearId,
          code: '7A',
          name: 'Lớp 7A',
          grade_level: 'K7',
          school_level: 'THCS',
          max_size: 45,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    const assigned = await api('POST', `/classes/${classId}/staff-assignments`, principal.accessToken, {
      staff_user_id: teacher.userId,
      assignment_role: 'subject',
      subject_id: subjects['THCS-TOAN'],
    });
    assert.equal(assigned.status, 201, JSON.stringify(assigned.body));
    const child = await schoolYear
      .insertInto('children')
      .values({
        org_unit_id: unitId,
        full_name: 'Học sinh An',
        dob: '2014-03-01',
        gender: 'female',
        national_id_encrypted: 'ma-hoa',
        national_id_hash: randomUUID(),
        national_id_last4: '0000',
        photo_consent: 'granted',
        status: 'active',
        enroll_date: '2026-09-05',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    childId = child.id;
    await schoolYear
      .insertInto('class_enrollments')
      .values({ child_id: childId, class_id: classId, from_date: '2026-09-05', order_number: 1 })
      .execute();
    const student = await createTestUser(environment.identity.database, {
      roles: [{ roleCode: 'VT-21', orgUnitId: unitId }],
    });
    await schoolYear
      .insertInto('student_learning_accounts')
      .values({
        child_id: childId,
        username: student.username,
        password_hash: 'khong-dung',
        issued_at: new Date(),
        issued_by_name: 'Hiệu trưởng thử',
        identity_user_id: student.id,
      })
      .execute();
    const login = await postJson(`${environment.identity.baseUrl}/auth/login`, {
      login: student.username,
      password: student.password,
      channel: 'student',
    });
    assert.equal(login.status, 200, JSON.stringify(login.body));
    studentToken = login.body.access_token as string;
    const spaces = rows((await api('GET', '/learning/spaces', teacher.accessToken)).body);
    spaceId = spaces[0]?.id as string;
    assert.equal(
      (await api('PATCH', `/learning/spaces/${spaceId}`, teacher.accessToken, { visible_to_students: true })).status,
      200,
    );
    sectionId = (await api('POST', `/learning/spaces/${spaceId}/sections`, teacher.accessToken, { title: 'Chương 1' }))
      .body.id as string;
    const catalog = await api('GET', '/learning-resources/catalog', teacher.accessToken);
    for (const row of rows(catalog.body.types)) types[row.code as string] = row.id as string;
    for (const row of rows(catalog.body.licenses)) licenses[row.code as string] = row.id as string;
  });

  after(async () => {
    await schoolYear?.destroy();
    await environment?.close();
  });

  it('CT-28h-6: tải gói SCORM lên học liệu loại SCORM; gói sai, thoát thư mục, loại học liệu khác bị chặn; xem trước có CSP sandbox', async () => {
    assert.ok(types.scorm, 'danh mục có loại Gói bài giảng SCORM');
    resourceId = await createResource('scorm', 'Gói bài giảng phân số');
    const broken = await upload(
      `/learning-resources/${resourceId}/scorm`,
      teacher.accessToken,
      Buffer.from('x'),
      'goi.zip',
    );
    assert.equal(broken.status, 422, JSON.stringify(broken.body));
    const escape = await upload(
      `/learning-resources/${resourceId}/scorm`,
      teacher.accessToken,
      scormZip({ '../ngoai.html': 'x' }),
      'goi.zip',
    );
    assert.equal(escape.status, 422);
    const worksheet = await createResource('worksheet', 'Phiếu học tập');
    assert.equal(
      (await upload(`/learning-resources/${worksheet}/scorm`, teacher.accessToken, scormZip(), 'goi.zip')).status,
      422,
    );
    assert.equal(
      (await upload(`/learning-resources/${resourceId}/scorm`, otherTeacher.accessToken, scormZip(), 'goi.zip')).status,
      403,
    );
    const uploaded = await upload(
      `/learning-resources/${resourceId}/scorm`,
      teacher.accessToken,
      scormZip(),
      'phan-so.zip',
    );
    assert.equal(uploaded.status, 201, JSON.stringify(uploaded.body));
    assert.equal(uploaded.body.standard, '1.2');
    packageId = uploaded.body.id as string;
    const listed = await api('GET', `/learning-resources/${resourceId}/scorm`, teacher.accessToken);
    assert.equal(rows(listed.body).length, 1);

    const preview = await withOrigin(
      `/learning-resources/${resourceId}/scorm/${packageId}/preview`,
      teacher.accessToken,
    );
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    const sco = rows(preview.body.scos)[0] as { url: string };
    const page = await fetch(`${root()}${sco.url}`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-security-policy') ?? '', /^sandbox allow-scripts;/);
    assert.equal(page.headers.get('x-frame-options'), null);
    assert.equal(page.headers.get('cache-control'), 'no-store');
    const html = await page.text();
    assert.ok(html.indexOf('API_1484_11') > 0 && html.indexOf('API_1484_11') < html.indexOf('bai.js'));
    const script = await fetch(`${root()}${sco.url.replace('index.html', 'bai.js')}`);
    assert.equal(script.status, 200);
    assert.equal(await script.text(), 'window.ok = true;');
    const token = sco.url.split('/')[4] ?? '';
    const tampered = `${token.slice(0, -2)}${token.endsWith('A') ? 'B' : 'A'}${token.slice(-1)}`;
    assert.equal((await fetch(`${root()}${sco.url.replace(token, tampered)}`)).status, 404);
    assert.equal((await fetch(`${root()}${sco.url.replace('index.html', 'imsmanifest.xml')}`)).status, 200);
    assert.equal((await fetch(`${root()}${sco.url.replace('index.html', 'khong-co.html')}`)).status, 404);
  });

  it('CT-28h-7: hoạt động SCORM chỉ dùng học liệu đã công bố; học sinh mở bài, gửi giá trị; kết quả hoạt động, lượt chạy cho giáo viên', async () => {
    const unpublished = await api('POST', `/learning/spaces/${spaceId}/activities`, teacher.accessToken, {
      section_id: sectionId,
      kind: 'scorm',
      title: 'Bài giảng phân số',
      settings: { resource_id: resourceId },
    });
    assert.equal(unpublished.status, 422, 'học liệu chưa công bố');
    await environment.system
      .updateTable('learning_resources')
      .set({ status: 'published', published_version: 1, published_at: new Date() })
      .where('id', '=', resourceId)
      .execute();
    const created = await api('POST', `/learning/spaces/${spaceId}/activities`, teacher.accessToken, {
      section_id: sectionId,
      kind: 'scorm',
      title: 'Bài giảng phân số',
      completion_rule: 'pass',
      pass_score: 5,
      settings: { resource_id: resourceId },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    activityId = created.body.id as string;
    assert.equal(
      (await api('POST', `/learning/activities/${activityId}/publish`, teacher.accessToken, {})).status,
      200,
    );

    const launch = await withOrigin(`/student/scorm/activities/${activityId}/launch`, studentToken);
    assert.equal(launch.status, 200, JSON.stringify(launch.body));
    const sco = rows(launch.body.scos)[0] as { identifier: string; url: string; completion: string };
    assert.equal(sco.identifier, 'BAI1');
    assert.equal(sco.completion, 'not_attempted');
    const page = await (await fetch(`${root()}${sco.url}`)).text();
    assert.match(page, /"cmi\.core\.student_name":"Học sinh"/);
    assert.match(page, /"origin":"http:\/\/localhost:5173"/);

    const progress = await api('POST', `/student/scorm/activities/${activityId}/commit`, studentToken, {
      sco: 'BAI1',
      values: {
        'cmi.core.lesson_status': 'incomplete',
        'cmi.core.lesson_location': 'trang-2',
        'cmi.suspend_data': 'a=1',
      },
    });
    assert.equal(progress.status, 200, JSON.stringify(progress.body));
    assert.equal(progress.body.status, 'in_progress');
    const resumed = await (await fetch(`${root()}${sco.url}`)).text();
    assert.match(resumed, /"cmi\.core\.entry":"resume"/);
    const done = await api('POST', `/student/scorm/activities/${activityId}/commit`, studentToken, {
      sco: 'BAI1',
      finished: true,
      values: {
        'cmi.core.lesson_status': 'passed',
        'cmi.core.score.raw': '85',
        'cmi.core.session_time': '0000:05:00',
      },
    });
    assert.equal(done.status, 200, JSON.stringify(done.body));
    assert.equal(done.body.status, 'passed');
    assert.equal(done.body.score, 8.5);
    const result = await schoolYear
      .selectFrom('activity_results')
      .select(['status', 'score', 'source'])
      .where('activity_id', '=', activityId)
      .where('child_id', '=', childId)
      .executeTakeFirstOrThrow();
    assert.deepEqual({ ...result, score: Number(result.score) }, { status: 'passed', score: 8.5, source: 'scorm' });
    assert.equal(
      (
        await api('POST', `/student/scorm/activities/${activityId}/commit`, studentToken, {
          sco: 'KHAC',
          values: {},
        })
      ).status,
      422,
    );
    const attempts = await api('GET', `/learning/activities/${activityId}/scorm-attempts`, teacher.accessToken);
    assert.equal(attempts.status, 200, JSON.stringify(attempts.body));
    const mine = rows(attempts.body)[0] as { scos: Array<{ total_seconds: number; score: number }> };
    assert.equal(mine.scos[0]?.total_seconds, 300);
    assert.equal(
      (await api('GET', `/learning/activities/${activityId}/scorm-attempts`, otherTeacher.accessToken)).status,
      403,
    );
    const noOrigin = await api('POST', `/student/scorm/activities/${activityId}/launch`, studentToken, {});
    assert.equal(noOrigin.status, 422, 'thiếu nguồn gốc của trang mở bài');
  });

  it('CT-28h-8: xuất khoá mẫu thành gói khoá học kèm gói SCORM; nhập lại thành khoá mẫu nháp, học liệu trùng dùng lại', async () => {
    const leader = await environment.loginAs('VT-17', unitId);
    const template = await api('POST', '/learning/templates', leader.accessToken, {
      title: 'Khoá mẫu Toán 7',
      school_level: 'THCS',
      subject_id: subjects['THCS-TOAN'],
      content: {
        sections: [
          {
            key: 'chuong-1',
            title: 'Chương 1',
            items: [
              { key: 'goi', kind: 'scorm', title: 'Gói phân số', settings: { resource_id: resourceId } },
              { key: 'trang', kind: 'page', title: 'Hướng dẫn', settings: { body: 'Đọc trước bài' } },
            ],
          },
        ],
      },
    });
    assert.equal(template.status, 201, JSON.stringify(template.body));
    const templateId = template.body.id as string;
    const exported = await fetch(url(`/learning/templates/${templateId}/package`), {
      headers: { authorization: `Bearer ${leader.accessToken}` },
    });
    assert.equal(exported.status, 200);
    assert.equal(exported.headers.get('x-package-skipped'), '0');
    const body = Buffer.from(await exported.arrayBuffer());
    assert.equal(body[0], 0x1f, 'tệp gzip');
    const imported = await upload('/learning/template-packages', leader.accessToken, body, 'khoa.khoahoc.gz');
    assert.equal(imported.status, 201, JSON.stringify(imported.body));
    assert.equal(imported.body.reused, 1, 'gói SCORM đã có trong kho thì dùng lại');
    assert.deepEqual(imported.body.skipped, []);
    const copy = await api('GET', `/learning/templates/${imported.body.template_id as string}`, leader.accessToken);
    assert.equal(copy.body.status, 'draft');
    const items = (
      copy.body.content as { sections: Array<{ items: Array<{ kind: string; settings: Record<string, unknown> }> }> }
    ).sections[0]?.items;
    assert.equal(items?.[0]?.settings.resource_id, resourceId);
    assert.equal(
      (
        await upload(
          '/learning/template-packages',
          (await environment.loginAs('VT-14', unitId)).accessToken,
          body,
          'khoa.khoahoc.gz',
        )
      ).status,
      403,
      'người không soạn khoá mẫu thì không nhập',
    );
    assert.equal(
      (await upload('/learning/template-packages', leader.accessToken, Buffer.from('x'), 'x.gz')).status,
      400,
    );
    const transfers = await api('GET', '/learning/template-packages', leader.accessToken);
    assert.deepEqual(
      rows(transfers.body)
        .map((row) => row.direction)
        .sort(),
      ['export', 'import'],
    );
  });
});
