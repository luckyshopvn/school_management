import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import { createTestUser, postJson } from '@school-management/identity/testing';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../../test-support.js';

// Điểm cuối huy hiệu, chứng nhận hoàn thành (DT-28 phần 28i, YCTD-279): tắt mặc định, chỉ Ban Giám hiệu bật; huy hiệu tự động khi
// xong chương, khoá; giáo viên trao kèm lý do, thu hồi; học sinh, phụ huynh thấy huy hiệu của em, phụ huynh khác không; chứng nhận chỉ
// cho khoá tự chọn đã hoàn thành, PDF, trang kiểm tra công khai chỉ có tên viết tắt, thu hồi. Người, lớp là dữ liệu giả
describe('Điểm cuối huy hiệu, chứng nhận', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let teacher: LoggedInUser;
  let otherTeacher: LoggedInUser;
  let parent: LoggedInUser;
  let otherParent: LoggedInUser;
  let unitId = '';
  let academicYearId = '';
  let electiveId = '';
  let sectionId = '';
  let pageId = '';
  let childId = '';
  let studentToken = '';
  let certificateId = '';
  let certificateCode = '';
  const url = (path: string) => `${environment.baseUrl}${path}`;
  const api = (method: string, path: string, token: string, body?: unknown) => sendJson(method, url(path), token, body);
  const rows = (body: unknown) => body as unknown as Array<Record<string, unknown>>;

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
        code: 'THCS-28I',
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
    teacher = await environment.loginAs('VT-08', unitId);
    otherTeacher = await environment.loginAs('VT-08', unitId);
    parent = await environment.loginAs('VT-14', unitId);
    otherParent = await environment.loginAs('VT-14', unitId);
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
    const child = await schoolYear
      .insertInto('children')
      .values({
        org_unit_id: unitId,
        full_name: 'Nguyễn Văn An',
        dob: '2014-03-01',
        gender: 'male',
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
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: 'ME', name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    const guardian = await schoolYear
      .insertInto('guardians')
      .values({ full_name: 'Mẹ của An', phone: '0901281001', user_id: parent.userId })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('child_guardians')
      .values({ child_id: childId, guardian_id: guardian.id, relationship_item_id: relationship.id, is_primary: true })
      .execute();
    const elective = await api('POST', '/learning/spaces', principal.accessToken, {
      title: 'Câu lạc bộ lập trình',
      school_level: 'THCS',
      teacher_user_ids: [teacher.userId],
    });
    assert.equal(elective.status, 201, JSON.stringify(elective.body));
    electiveId = elective.body.id as string;
    // Giáo viên thử chưa có hồ sơ nhân sự nên gắn thẳng vào khoá
    await schoolYear
      .insertInto('course_space_teachers')
      .values({ space_id: electiveId, user_id: teacher.userId, user_name: 'Giáo viên thử', source: 'manual' })
      .onConflict((conflict) => conflict.doNothing())
      .execute();
    const enrolled = await api('POST', `/learning/spaces/${electiveId}/enrollments`, teacher.accessToken, {
      child_ids: [childId],
    });
    assert.ok([200, 201].includes(enrolled.status), JSON.stringify(enrolled.body));
    assert.equal(
      (await api('PATCH', `/learning/spaces/${electiveId}`, teacher.accessToken, { visible_to_students: true })).status,
      200,
    );
    sectionId = (
      await api('POST', `/learning/spaces/${electiveId}/sections`, teacher.accessToken, { title: 'Làm quen' })
    ).body.id as string;
    const page = await api('POST', `/learning/spaces/${electiveId}/activities`, teacher.accessToken, {
      section_id: sectionId,
      kind: 'page',
      title: 'Bài 1: khối lệnh',
      settings: { body: 'Đọc và làm theo' },
    });
    assert.equal(page.status, 201, JSON.stringify(page.body));
    pageId = page.body.id as string;
    assert.equal((await api('POST', `/learning/activities/${pageId}/publish`, teacher.accessToken, {})).status, 200);
  });

  after(async () => {
    await schoolYear?.destroy();
    await environment?.close();
  });

  it('CT-28i-3: tắt mặc định: học sinh, phụ huynh không thấy gì, giáo viên không trao được; chỉ Ban Giám hiệu bật', async () => {
    const mine = await api('GET', '/student/recognition', studentToken);
    assert.equal(mine.status, 200, JSON.stringify(mine.body));
    assert.deepEqual(mine.body, { badges_enabled: false, certificates_enabled: false, badges: [], certificates: [] });
    const award = await api('POST', `/learning/spaces/${electiveId}/badges`, teacher.accessToken, {
      child_id: childId,
      title: 'Ý tưởng hay',
      reason: 'Đề xuất cách làm mới',
    });
    assert.equal(award.status, 422);
    assert.equal(
      (
        await api('PUT', '/learning/recognition/config', teacher.accessToken, {
          badges_enabled: true,
          certificates_enabled: true,
        })
      ).status,
      403,
    );
    const saved = await api('PUT', '/learning/recognition/config', principal.accessToken, {
      badges_enabled: true,
      certificates_enabled: true,
      certificate: { signer_name: 'Trần Thị Hiệu Trưởng' },
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal((saved.body.certificate as Record<string, unknown>).signer_name, 'Trần Thị Hiệu Trưởng');
  });

  it('CT-28i-4: huy hiệu tự động khi xong chương, khoá; giáo viên trao kèm lý do, thu hồi; phụ huynh khác 403; không bảng xếp hạng', async () => {
    // Giáo viên chỉ dạy khoá tự chọn (trường chưa phân công môn nào) vẫn xem được danh sách lớp học trực tuyến của mình
    const spaces = await api('GET', '/learning/spaces', teacher.accessToken);
    assert.equal(spaces.status, 200, JSON.stringify(spaces.body));
    assert.ok(rows(spaces.body).some((space) => space.id === electiveId));
    const issueEarly = await api('POST', `/learning/spaces/${electiveId}/certificates`, teacher.accessToken, {
      child_id: childId,
    });
    assert.equal(issueEarly.status, 422, 'chưa hoàn thành khoá');
    assert.equal(
      (await api('POST', `/student/learning/activities/${pageId}/open`, studentToken, {})).status,
      200,
      'mở trang nội dung là xem xong',
    );
    const mine = await api('GET', '/student/recognition', studentToken);
    assert.deepEqual(
      rows(mine.body.badges)
        .map((badge) => badge.kind)
        .sort(),
      ['course_complete', 'section_complete'],
    );
    const again = await api('GET', '/student/recognition', studentToken);
    assert.equal(rows(again.body.badges).length, 2, 'mỗi tiêu chí chỉ một lần');
    const award = await api('POST', `/learning/spaces/${electiveId}/badges`, teacher.accessToken, {
      child_id: childId,
      title: 'Ý tưởng hay',
      reason: 'Đề xuất cách làm mới cho bài 1',
    });
    assert.equal(award.status, 201, JSON.stringify(award.body));
    assert.equal(
      (
        await api('POST', `/learning/spaces/${electiveId}/badges`, teacher.accessToken, {
          child_id: childId,
          title: 'Thiếu lý do',
        })
      ).status,
      422,
    );
    assert.equal(
      (
        await api('POST', `/learning/spaces/${electiveId}/badges`, otherTeacher.accessToken, {
          child_id: childId,
          title: 'x',
          reason: 'y',
        })
      ).status,
      403,
    );
    const child = await api('GET', `/learning/children/${childId}/recognition`, parent.accessToken);
    assert.equal(child.status, 200, JSON.stringify(child.body));
    assert.equal(rows(child.body.badges).length, 3);
    assert.equal(
      rows(child.body.badges).find((badge) => badge.kind === 'teacher_award')?.reason,
      'Đề xuất cách làm mới cho bài 1',
    );
    assert.equal((await api('GET', `/learning/children/${childId}/recognition`, otherParent.accessToken)).status, 403);
    const space = await api('GET', `/learning/spaces/${electiveId}/recognition`, teacher.accessToken);
    assert.equal(space.status, 200, JSON.stringify(space.body));
    const student = rows(space.body.students)[0] as Record<string, unknown>;
    assert.equal(student.completed, true);
    assert.equal((student.badges as unknown[]).length, 3);
    assert.ok(!('rank' in student) && !('badge_count' in student), 'không có xếp hạng, không đếm');
    const revoked = await api('DELETE', `/learning/badges/${award.body.id as string}`, teacher.accessToken, {
      reason: 'Trao nhầm học sinh',
    });
    assert.equal(revoked.status, 200, JSON.stringify(revoked.body));
    assert.equal(rows((await api('GET', '/student/recognition', studentToken)).body.badges).length, 2);
  });

  it('CT-28i-5: chứng nhận khoá tự chọn: cấp, không cấp trùng, PDF, trang kiểm tra công khai chỉ có tên viết tắt, thu hồi', async () => {
    const issued = await api('POST', `/learning/spaces/${electiveId}/certificates`, teacher.accessToken, {
      child_id: childId,
    });
    assert.equal(issued.status, 201, JSON.stringify(issued.body));
    certificateId = issued.body.id as string;
    certificateCode = issued.body.code as string;
    assert.match(certificateCode, /^CN-[A-Z0-9]{10}$/);
    assert.equal(
      (await api('POST', `/learning/spaces/${electiveId}/certificates`, teacher.accessToken, { child_id: childId }))
        .status,
      409,
    );
    const pdf = await fetch(url(`/learning/certificates/${certificateId}/pdf`), {
      headers: { authorization: `Bearer ${parent.accessToken}` },
    });
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers.get('content-type'), 'application/pdf');
    assert.equal(
      Buffer.from(await pdf.arrayBuffer())
        .subarray(0, 4)
        .toString(),
      '%PDF',
    );
    const studentPdf = await fetch(url(`/student/recognition/certificates/${certificateId}/pdf`), {
      headers: { authorization: `Bearer ${studentToken}` },
    });
    assert.equal(studentPdf.status, 200);
    const otherPdf = await fetch(url(`/learning/certificates/${certificateId}/pdf`), {
      headers: { authorization: `Bearer ${otherParent.accessToken}` },
    });
    assert.equal(otherPdf.status, 403);
    const verify = await fetch(url(`/public/certificates/${certificateCode}`));
    assert.equal(verify.status, 200);
    const html = await verify.text();
    assert.match(html, /Chứng nhận hợp lệ/);
    assert.match(html, /N\. V\. An/);
    assert.match(html, /Câu lạc bộ lập trình/);
    assert.ok(!html.includes('Nguyễn Văn An'), 'trang công khai không có họ tên đầy đủ');
    assert.equal((await fetch(url('/public/certificates/CN-KHONGCOMA1'))).status, 404);
    assert.equal(
      (await api('POST', `/learning/certificates/${certificateId}/revoke`, teacher.accessToken, {})).status,
      422,
      'thu hồi cần lý do',
    );
    assert.equal(
      (
        await api('POST', `/learning/certificates/${certificateId}/revoke`, teacher.accessToken, {
          reason: 'Cấp nhầm khoá',
        })
      ).status,
      200,
    );
    assert.match(await (await fetch(url(`/public/certificates/${certificateCode}`))).text(), /đã bị thu hồi/);
    const reissued = await api('POST', `/learning/spaces/${electiveId}/certificates`, teacher.accessToken, {
      child_id: childId,
    });
    assert.equal(reissued.status, 201, 'thu hồi rồi cấp lại được');
  });
});
