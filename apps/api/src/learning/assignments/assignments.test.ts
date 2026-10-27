import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import { createTestUser, postJson } from '@school-management/identity/testing';
import type { Kysely } from 'kysely';
import { AI_PROVIDERS } from '../../ai-assistant/ai-assistant.js';
import { MockAiProvider, type AiProviderRegistry } from '../../ai-assistant/ai-provider.js';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../../test-support.js';

// Điểm cuối bài tập trực tuyến (DT-28 phần 28c, YCTD-273): soạn bài từ câu đã duyệt của 22g1, phát hành chốt danh sách, học sinh
// làm và nộp ở kênh student (nháp có khóa lạc quan, ảnh bỏ EXIF), máy chấm trắc nghiệm, giáo viên chấm, gợi ý nhận xét AI không
// có bài làm (GD-142), trả bài ghi kết quả hoạt động; bài nhóm do nhóm trưởng nộp, đánh giá đóng góp, điều chỉnh điểm cá nhân;
// nộp muộn, miễn, đóng bài; phụ huynh xem nhận xét. Người, lớp, câu hỏi là dữ liệu giả
describe('Điểm cuối bài tập trực tuyến', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let mock: MockAiProvider;
  let principal: LoggedInUser;
  let teacher: LoggedInUser;
  let otherTeacher: LoggedInUser;
  let parent: LoggedInUser;
  let otherParent: LoggedInUser;
  let unitId = '';
  let academicYearId = '';
  let classId = '';
  let spaceId = '';
  let sectionId = '';
  const subjects: Record<string, string> = {};
  const children: string[] = [];
  const studentTokens: string[] = [];
  const names = ['Học sinh An', 'Học sinh Bình', 'Học sinh Chi'];
  const url = (path: string) => `${environment.baseUrl}${path}`;
  const api = (method: string, path: string, token: string, body?: unknown) => sendJson(method, url(path), token, body);
  const errorOf = (body: Record<string, unknown>) => (body.error ?? {}) as { code?: string; message?: string };
  const rows = (body: unknown) => body as unknown as Array<Record<string, unknown>>;

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

  async function question(subjectId: string, status: 'approved' | 'draft', content: string) {
    return (
      await schoolYear
        .insertInto('questions')
        .values({
          school_level: 'THCS',
          subject_id: subjectId,
          grade_level_code: 'K7',
          topic_id: null,
          cognitive_level: 'recognition',
          question_type: 'multiple_choice',
          content,
          options: JSON.stringify([
            { key: 'A', content: '4' },
            { key: 'B', content: '7' },
          ]),
          answer: JSON.stringify(['B']),
          guidance: 'Hướng dẫn chấm bí mật',
          score: 1,
          status,
          author_user_id: teacher.userId,
          author_name: 'Giáo viên thử',
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
  }

  async function assignmentActivity(title: string, extra: Record<string, unknown> = {}) {
    const created = await api('POST', `/learning/spaces/${spaceId}/activities`, teacher.accessToken, {
      section_id: sectionId,
      kind: 'assignment',
      title,
      instructions: 'Làm bài và nộp đúng hạn',
      ...extra,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    return created.body.id as string;
  }

  before(async () => {
    environment = await startApiTestEnvironment();
    mock = (environment.api.get(AI_PROVIDERS) as AiProviderRegistry).get('mock') as MockAiProvider;
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
        code: 'THCS-28C',
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
    assert.equal(
      (await api('POST', '/grade-levels/templates', principal.accessToken, { school_level: 'THCS' })).status,
      200,
    );
    assert.equal(
      (await api('POST', '/subjects/templates', principal.accessToken, { school_level: 'THCS' })).status,
      200,
    );
    for (const row of rows((await api('GET', '/subjects?school_level=THCS', principal.accessToken)).body)) {
      subjects[row.code as string] = row.id as string;
    }
    teacher = await environment.loginAs('VT-08', unitId);
    otherTeacher = await environment.loginAs('VT-08', unitId);
    parent = await environment.loginAs('VT-14', unitId);
    otherParent = await environment.loginAs('VT-14', unitId);
    classId = (
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
    for (const [index, name] of names.entries()) {
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitId,
          full_name: name,
          dob: '2014-03-01',
          gender: index === 1 ? 'male' : 'female',
          national_id_encrypted: 'ma-hoa',
          national_id_hash: randomUUID(),
          national_id_last4: '0000',
          photo_consent: 'granted',
          status: 'active',
          enroll_date: '2026-09-05',
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      children.push(child.id);
      await schoolYear
        .insertInto('class_enrollments')
        .values({ child_id: child.id, class_id: classId, from_date: '2026-09-05', order_number: index + 1 })
        .execute();
      const student = await createTestUser(environment.identity.database, {
        roles: [{ roleCode: 'VT-21', orgUnitId: unitId }],
      });
      await schoolYear
        .insertInto('student_learning_accounts')
        .values({
          child_id: child.id,
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
      studentTokens.push(login.body.access_token as string);
    }
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: 'ME', name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    const guardian = await schoolYear
      .insertInto('guardians')
      .values({ full_name: 'Mẹ của An', phone: '0901280002', user_id: parent.userId })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('child_guardians')
      .values({
        child_id: children[0] ?? '',
        guardian_id: guardian.id,
        relationship_item_id: relationship.id,
        is_primary: true,
      })
      .execute();
    const spaces = rows((await api('GET', '/learning/spaces', teacher.accessToken)).body);
    spaceId = spaces[0]?.id as string;
    assert.equal(
      (await api('PATCH', `/learning/spaces/${spaceId}`, teacher.accessToken, { visible_to_students: true })).status,
      200,
    );
    const section = await api('POST', `/learning/spaces/${spaceId}/sections`, teacher.accessToken, {
      title: 'Chương 1. Số hữu tỉ',
    });
    assert.equal(section.status, 201, JSON.stringify(section.body));
    sectionId = section.body.id as string;
  });

  after(async () => {
    await schoolYear?.destroy();
    await environment?.close();
  });

  let activityId = '';
  let items: Array<Record<string, unknown>> = [];

  it('CT-28c-11: giáo viên soạn bài từ câu đã duyệt, tự luận, ảnh; câu chưa duyệt, khác môn bị chặn; giáo viên khác 403; phát hành chốt danh sách', async () => {
    const approved = await question(subjects['THCS-TOAN'] ?? '', 'approved', 'Số nào là số nguyên tố?');
    const draft = await question(subjects['THCS-TOAN'] ?? '', 'draft', 'Câu đang soạn');
    const literature = await question(subjects['THCS-NV'] ?? '', 'approved', 'Câu của môn Văn');
    activityId = await assignmentActivity('Bài tập số nguyên tố', { completion_rule: 'pass', pass_score: 5 });
    const bank = await api('GET', `/learning/activities/${activityId}/assignment/questions`, teacher.accessToken);
    assert.equal(bank.status, 200, JSON.stringify(bank.body));
    assert.deepEqual(
      rows(bank.body).map((row) => row.id),
      [approved],
      'chỉ câu đã duyệt, cùng môn của lớp',
    );
    const body = (questionId: string) => ({
      grading: 'score',
      items: [
        { kind: 'question', question_id: questionId, score: 2 },
        { kind: 'essay', prompt: 'Giải thích vì sao 7 là số nguyên tố', score: 4 },
        { kind: 'upload', prompt: 'Chụp ảnh bài làm trên giấy', score: 4 },
      ],
    });
    for (const blocked of [draft, literature]) {
      const response = await api(
        'PUT',
        `/learning/activities/${activityId}/assignment`,
        teacher.accessToken,
        body(blocked),
      );
      assert.equal(response.status, 422, JSON.stringify(response.body));
    }
    assert.equal(
      (await api('PUT', `/learning/activities/${activityId}/assignment`, otherTeacher.accessToken, body(approved)))
        .status,
      403,
    );
    const saved = await api(
      'PUT',
      `/learning/activities/${activityId}/assignment`,
      teacher.accessToken,
      body(approved),
    );
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    items = saved.body.items as Array<Record<string, unknown>>;
    assert.equal(items.length, 3);
    // Sửa câu ở ngân hàng sau khi lưu bài không đổi bản chụp trong bài
    await schoolYear
      .updateTable('questions')
      .set({ content: 'Đã sửa ở ngân hàng' })
      .where('id', '=', approved)
      .execute();
    const released = await api('POST', `/learning/activities/${activityId}/assignment/release`, teacher.accessToken);
    assert.equal(released.status, 200, JSON.stringify(released.body));
    assert.equal(released.body.recipient_count, 3);
    const again = await api(
      'PUT',
      `/learning/activities/${activityId}/assignment`,
      teacher.accessToken,
      body(approved),
    );
    assert.equal(again.status, 422, 'bài đã phát hành không đổi câu');
    const activity = await schoolYear
      .selectFrom('course_activities')
      .select('status')
      .where('id', '=', activityId)
      .executeTakeFirstOrThrow();
    assert.equal(activity.status, 'published', 'phát hành là giao hoạt động cho học sinh');
  });

  it('CT-28c-12: học sinh làm bài không thấy đáp án; nháp có khóa lạc quan; ảnh bỏ EXIF; tệp lạ bị chặn; nộp một lần; bạn khác không xem được tệp', async () => {
    const [an, binh] = studentTokens as [string, string];
    const view = await api('GET', `/student/assignments/${activityId}`, an);
    assert.equal(view.status, 200, JSON.stringify(view.body));
    const text = JSON.stringify(view.body);
    assert.ok(!text.includes('Hướng dẫn chấm bí mật') && !text.includes('"answer"'), 'không lộ đáp án, hướng dẫn chấm');
    assert.ok(text.includes('Số nào là số nguyên tố?') && !text.includes('Đã sửa ở ngân hàng'), 'đề là bản chụp');
    assert.equal(view.body.can_submit, true);
    assert.equal((await api('GET', `/learning/activities/${activityId}/assignment`, an)).status, 403);
    const [choice, essay, photo] = items.map((item) => item.id as string) as [string, string, string];
    const answers = { [choice]: { choices: ['B'] }, [essay]: { text: 'Vì 7 chỉ chia hết cho 1 và 7' } };
    const first = await api('PUT', `/student/assignments/${activityId}/draft`, an, { answers });
    assert.equal(first.status, 200, JSON.stringify(first.body));
    const stale = await api('PUT', `/student/assignments/${activityId}/draft`, an, { answers, version: 1 });
    assert.equal(stale.status, 409, 'gửi bản đã cũ thì báo tải lại');

    const exif = Buffer.from('Exif\u0000\u0000GPS 21.0285 105.8542', 'latin1');
    const jpeg = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0, exif.length + 2]),
      exif,
      Buffer.from([0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0xd9]),
    ]);
    const stored = await upload(`/student/assignments/${activityId}/items/${photo}/files`, an, jpeg, 'bai-lam.jpg');
    assert.equal(stored.status, 201, JSON.stringify(stored.body));
    const strange = await upload(
      `/student/assignments/${activityId}/items/${photo}/files`,
      an,
      Buffer.from('<html></html>'),
      'trang.html',
    );
    assert.equal(strange.status, 422);
    const fileId = stored.body.id as string;
    const own = await fetch(url(`/student/assignments/files/${fileId}`), {
      headers: { authorization: `Bearer ${an}` },
    });
    assert.equal(own.status, 200);
    assert.ok(
      !Buffer.from(await own.arrayBuffer())
        .toString('latin1')
        .includes('GPS'),
      'máy chủ bỏ khối EXIF',
    );
    const other = await fetch(url(`/student/assignments/files/${fileId}`), {
      headers: { authorization: `Bearer ${binh}` },
    });
    assert.equal(other.status, 404);

    const submitted = await api('POST', `/student/assignments/${activityId}/submit`, an, {});
    assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
    assert.equal(submitted.body.late, false);
    const twice = await api('POST', `/student/assignments/${activityId}/submit`, an, {});
    assert.equal(twice.status, 422, 'bài chỉ cho nộp một lần');
    const result = await schoolYear
      .selectFrom('activity_results')
      .select(['status', 'score'])
      .where('activity_id', '=', activityId)
      .where('child_id', '=', children[0] ?? '')
      .executeTakeFirstOrThrow();
    assert.deepEqual(result, { status: 'in_progress', score: null }, 'cách tính "đạt điểm": nộp xong là đang chờ chấm');
    const after = await api('GET', `/student/assignments/${activityId}`, an);
    const attempt = (after.body.attempts as Array<Record<string, unknown>>)[0];
    assert.equal(attempt?.score, null, 'chưa trả thì chưa hiện điểm');
  });

  it('CT-28c-13: giáo viên chấm, gợi ý nhận xét AI không có bài làm và tên học sinh, trả bài; học sinh, phụ huynh thấy nhận xét; phụ huynh khác 403', async () => {
    const list = await api('GET', `/learning/activities/${activityId}/assignment/submissions`, teacher.accessToken);
    assert.equal(list.status, 200, JSON.stringify(list.body));
    const row = rows(list.body.rows).find((candidate) => candidate.child_id === children[0]);
    const submissionId = (row?.latest as Record<string, unknown>).id as string;
    const detail = await api('GET', `/learning/submissions/${submissionId}`, teacher.accessToken);
    assert.equal(detail.status, 200, JSON.stringify(detail.body));
    assert.equal((detail.body.objective as Record<string, unknown>).objective, 2, 'máy chấm câu trắc nghiệm đúng');
    const [, essay, photo] = items.map((item) => item.id as string) as [string, string, string];
    const graded = await api('POST', `/learning/submissions/${submissionId}/grade`, teacher.accessToken, {
      item_scores: { [essay]: 3, [photo]: 3 },
    });
    assert.equal(graded.status, 200, JSON.stringify(graded.body));
    assert.equal(graded.body.score, 8);
    const tooHigh = await api('POST', `/learning/submissions/${submissionId}/grade`, teacher.accessToken, {
      item_scores: { [essay]: 5 },
    });
    assert.equal(tooHigh.status, 422);

    assert.equal(
      (
        await api('PUT', '/ai/settings', principal.accessToken, {
          enabled: true,
          key_mode: 'school',
          provider: 'mock',
          per_user_daily_requests: null,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await api('PUT', '/school-settings/integrations/ai', principal.accessToken, {
          enabled: true,
          values: { api_key: 'khoa-gia-lap-28c-0000' },
        })
      ).status,
      200,
    );
    const before = mock.received.length;
    const suggestion = await api('POST', `/learning/submissions/${submissionId}/ai-feedback`, teacher.accessToken, {
      note: 'Trình bày còn vội',
    });
    assert.equal(suggestion.status, 200, JSON.stringify(suggestion.body));
    assert.ok(String(suggestion.body.comment).length > 0);
    assert.equal(mock.received.length, before + 1);
    const prompt = JSON.stringify(mock.received.at(-1));
    assert.ok(prompt.includes('Giải thích vì sao 7 là số nguyên tố') && prompt.includes('Điểm 8/10'), prompt);
    assert.ok(!prompt.includes('Vì 7 chỉ chia hết cho 1 và 7'), 'không gửi bài làm cho nhà cung cấp AI (GD-142)');
    assert.ok(!prompt.includes('Học sinh An'), 'không gửi tên học sinh');
    const named = await api('POST', `/learning/submissions/${submissionId}/ai-feedback`, teacher.accessToken, {
      note: 'Học sinh An làm tốt',
    });
    assert.equal(named.status, 422, 'ghi chú có tên học sinh bị từ chối, không gửi đi');

    const feedback = await api('POST', `/learning/submissions/${submissionId}/grade`, teacher.accessToken, {
      feedback: String(suggestion.body.comment),
      feedback_ai_assisted: true,
    });
    assert.equal(feedback.status, 200, JSON.stringify(feedback.body));
    const returned = await api('POST', `/learning/activities/${activityId}/assignment/return`, teacher.accessToken, {});
    assert.equal(returned.status, 200, JSON.stringify(returned.body));
    assert.equal(returned.body.returned, 1);
    const result = await schoolYear
      .selectFrom('activity_results')
      .select(['status', 'score', 'source'])
      .where('activity_id', '=', activityId)
      .where('child_id', '=', children[0] ?? '')
      .executeTakeFirstOrThrow();
    assert.deepEqual(result, { status: 'passed', score: '8.00', source: 'assignment' });

    const student = await api('GET', `/student/assignments/${activityId}`, studentTokens[0] ?? '');
    const attempt = (student.body.attempts as Array<Record<string, unknown>>)[0];
    assert.equal(attempt?.score, 8);
    assert.equal(attempt?.feedback_ai_assisted, true, 'nhận xét đã trả ghi có AI hỗ trợ');
    assert.deepEqual(attempt?.correct, { [items[0]?.id as string]: true });
    const comment = await api(
      'POST',
      `/student/assignments/${activityId}/submissions/${submissionId}/comments`,
      studentTokens[0] ?? '',
      { body: 'Em cảm ơn cô, em sẽ trình bày kỹ hơn' },
    );
    assert.equal(comment.status, 201, JSON.stringify(comment.body));
    const comments = (await api('GET', `/learning/submissions/${submissionId}`, teacher.accessToken)).body
      .comments as Array<Record<string, unknown>>;
    assert.equal(comments[0]?.author_kind, 'student');

    const forParent = await api(
      'GET',
      `/learning/children/${children[0]}/assignments/${activityId}`,
      parent.accessToken,
    );
    assert.equal(forParent.status, 200, JSON.stringify(forParent.body));
    assert.equal((forParent.body.attempts as Array<Record<string, unknown>>)[0]?.score, 8);
    assert.equal(
      (await api('GET', `/learning/children/${children[0]}/assignments/${activityId}`, otherParent.accessToken)).status,
      403,
    );
  });

  it('CT-28c-14: bài nhóm: nhóm trưởng nộp, nháp chung của nhóm, đánh giá đóng góp chỉ giáo viên thấy, điều chỉnh điểm cá nhân có lý do', async () => {
    const set = await schoolYear
      .insertInto('group_sets')
      .values({
        org_unit_id: unitId,
        class_id: classId,
        subject_id: subjects['THCS-TOAN'] ?? null,
        name: 'Nhóm Toán',
        purpose: 'subject',
        method: 'manual',
        owner_user_id: teacher.userId,
        owner_name: 'Giáo viên thử',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const groups: string[] = [];
    for (const [position, members] of [[children[0], children[1]], [children[2]]].entries()) {
      const group = await schoolYear
        .insertInto('child_groups')
        .values({
          org_unit_id: unitId,
          name: `Nhóm ${position + 1}`,
          created_by: teacher.userId,
          group_set_id: set.id,
          class_id: classId,
          position: position + 1,
          leader_child_id: members[0] ?? null,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      groups.push(group.id);
      for (const childId of members) {
        await schoolYear
          .insertInto('child_group_members')
          .values({ group_id: group.id, child_id: childId ?? '', added_by: teacher.userId })
          .execute();
      }
    }
    const groupActivity = await assignmentActivity('Dự án nhóm: đo chiều cao cây');
    const saved = await api('PUT', `/learning/activities/${groupActivity}/assignment`, teacher.accessToken, {
      work_mode: 'group',
      group_set_id: set.id,
      grading: 'score',
      items: [{ kind: 'essay', prompt: 'Báo cáo kết quả đo của nhóm', score: 10 }],
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const essay = (saved.body.items as Array<Record<string, unknown>>)[0]?.id as string;
    assert.equal(
      (await api('POST', `/learning/activities/${groupActivity}/assignment/release`, teacher.accessToken)).status,
      200,
    );
    const [an, binh] = studentTokens as [string, string];
    const draft = await api('PUT', `/student/assignments/${groupActivity}/draft`, binh, {
      answers: { [essay]: { text: 'Cây cao 2,5 mét' } },
    });
    assert.equal(draft.status, 200, JSON.stringify(draft.body));
    const shared = await api('GET', `/student/assignments/${groupActivity}`, an);
    assert.deepEqual((shared.body.draft as Record<string, unknown>).answers, { [essay]: { text: 'Cây cao 2,5 mét' } });
    assert.equal((shared.body.group as Record<string, unknown>).is_leader, true);
    assert.equal((await api('POST', `/student/assignments/${groupActivity}/submit`, binh, {})).status, 422);
    const submitted = await api('POST', `/student/assignments/${groupActivity}/submit`, an, {});
    assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
    const rated = await api('POST', `/student/assignments/${groupActivity}/contribution`, binh, {
      self_rating: 3,
      peers: { [children[0] ?? '']: 5 },
    });
    assert.equal(rated.status, 200, JSON.stringify(rated.body));
    const outsider = await api('POST', `/student/assignments/${groupActivity}/contribution`, binh, {
      peers: { [children[2] ?? '']: 1 },
    });
    assert.equal(outsider.status, 422, 'chỉ đánh giá bạn cùng nhóm');
    const forAn = await api('GET', `/student/assignments/${groupActivity}`, an);
    assert.ok(!JSON.stringify(forAn.body).includes('"peer_ratings":{"'), 'em không thấy bạn đánh giá mình');

    const list = await api('GET', `/learning/activities/${groupActivity}/assignment/submissions`, teacher.accessToken);
    const group = rows(list.body.rows).find((row) => row.group_id === groups[0]);
    const submissionId = (group?.latest as Record<string, unknown>).id as string;
    assert.equal(
      (
        await api('POST', `/learning/submissions/${submissionId}/grade`, teacher.accessToken, {
          item_scores: { [essay]: 8 },
        })
      ).status,
      200,
    );
    const noReason = await api(
      'POST',
      `/learning/submissions/${submissionId}/contributions/${children[1]}`,
      teacher.accessToken,
      { score: 6 },
    );
    assert.equal(noReason.status, 422, 'điều chỉnh điểm cá nhân phải có lý do');
    const adjusted = await api(
      'POST',
      `/learning/submissions/${submissionId}/contributions/${children[1]}`,
      teacher.accessToken,
      { score: 6, reason: 'Em tham gia đo ít hơn các bạn' },
    );
    assert.equal(adjusted.status, 200, JSON.stringify(adjusted.body));
    const detail = await api('GET', `/learning/submissions/${submissionId}`, teacher.accessToken);
    assert.equal(rows(detail.body.contributions).find((row) => row.child_id === children[1])?.self_rating, 3);
    assert.equal(
      (await api('POST', `/learning/activities/${groupActivity}/assignment/return`, teacher.accessToken, {})).body
        .returned,
      1,
    );
    const results = await schoolYear
      .selectFrom('activity_results')
      .select(['child_id', 'score'])
      .where('activity_id', '=', groupActivity)
      .execute();
    const scoreOf = (childId: string | undefined) => results.find((row) => row.child_id === childId)?.score;
    assert.equal(scoreOf(children[0]), '8.00');
    assert.equal(scoreOf(children[1]), '6.00');
  });

  it('CT-28c-15: hạn đã qua: chặn nộp muộn thì không nộp được, cho nộp muộn thì nộp có đánh dấu; miễn bài; đóng bài; ngân hàng nhận xét', async () => {
    const lateActivity = await assignmentActivity('Bài luyện tập muộn', {
      due_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    });
    const saved = await api('PUT', `/learning/activities/${lateActivity}/assignment`, teacher.accessToken, {
      late_policy: 'block',
      grading: 'completion',
      items: [{ kind: 'essay', prompt: 'Viết lại quy tắc cộng hai số hữu tỉ', score: 0 }],
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(
      (await api('POST', `/learning/activities/${lateActivity}/assignment/release`, teacher.accessToken)).status,
      200,
    );
    const [an, binh, chi] = studentTokens as [string, string, string];
    const blocked = await api('POST', `/student/assignments/${lateActivity}/submit`, an, {});
    assert.equal(blocked.status, 422);
    assert.match(String(errorOf(blocked.body).message), /quá hạn/);
    assert.equal(
      (
        await api('PATCH', `/learning/activities/${lateActivity}/assignment`, teacher.accessToken, {
          late_policy: 'allow',
        })
      ).status,
      200,
    );
    const late = await api('POST', `/student/assignments/${lateActivity}/submit`, an, {});
    assert.equal(late.status, 200, JSON.stringify(late.body));
    assert.equal(late.body.late, true, 'nộp muộn được đánh dấu, không trừ điểm (GD-147)');
    const excused = await api(
      'PATCH',
      `/learning/activities/${lateActivity}/assignment/recipients/${children[2]}`,
      teacher.accessToken,
      { excused: true, excuse_reason: 'Em nghỉ ốm có phép' },
    );
    assert.equal(excused.status, 200, JSON.stringify(excused.body));
    const result = await schoolYear
      .selectFrom('activity_results')
      .select('status')
      .where('activity_id', '=', lateActivity)
      .where('child_id', '=', children[2] ?? '')
      .executeTakeFirstOrThrow();
    assert.equal(result.status, 'excused');
    assert.match(
      String(errorOf((await api('POST', `/student/assignments/${lateActivity}/submit`, chi, {})).body).message),
      /miễn/,
    );
    assert.equal(
      (await api('POST', `/learning/activities/${lateActivity}/assignment/close`, teacher.accessToken, {})).status,
      200,
    );
    assert.match(
      String(errorOf((await api('POST', `/student/assignments/${lateActivity}/submit`, binh, {})).body).message),
      /đóng bài/,
    );

    const added = await api('POST', '/learning/assignment-comments', teacher.accessToken, {
      content: 'Em làm bài cẩn thận, tiếp tục phát huy',
    });
    assert.equal(added.status, 201, JSON.stringify(added.body));
    const bank = await api('GET', `/learning/activities/${lateActivity}/assignment/comment-bank`, teacher.accessToken);
    assert.equal(bank.status, 200, JSON.stringify(bank.body));
    assert.deepEqual(
      rows(bank.body.own).map((row) => row.content),
      ['Em làm bài cẩn thận, tiếp tục phát huy'],
    );
    assert.equal(
      (await api('DELETE', `/learning/assignment-comments/${added.body.id}`, otherTeacher.accessToken)).status,
      404,
      'chỉ xóa được câu của mình',
    );
  });
});
