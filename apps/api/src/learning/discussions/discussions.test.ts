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

// Điểm cuối giao tiếp trong lớp và nhóm (DT-28 phần 28e, YCTD-275): thông báo lớp tới học sinh, phụ huynh; diễn đàn, hỏi đáp có câu
// hỏi riêng và xác nhận câu trả lời; lọc thông tin liên lạc, từ ngữ; giờ mở; báo cáo vi phạm và hàng chờ của trường (ẩn, tạm khóa
// quyền viết); không gian học nhóm (bảng tin, việc, ghi chú có phiên bản, tệp); phụ huynh xem theo GD-145; lịch học tập. Người, lớp,
// nhóm là dữ liệu giả
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

describe('Điểm cuối giao tiếp trong lớp và nhóm', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let teacher: LoggedInUser;
  let homeroom: LoggedInUser;
  let otherHomeroom: LoggedInUser;
  let parent: LoggedInUser;
  let otherParent: LoggedInUser;
  let unitId = '';
  let classId = '';
  let spaceId = '';
  let activityId = '';
  const groups: string[] = [];
  const children: string[] = [];
  const tokens: string[] = [];
  const names = ['Học sinh An', 'Học sinh Bình', 'Học sinh Chi'];
  const url = (path: string) => `${environment.baseUrl}${path}`;
  const api = (method: string, path: string, token: string, body?: unknown) => sendJson(method, url(path), token, body);
  const rows = (body: unknown) => body as unknown as Array<Record<string, unknown>>;
  const messageOf = (body: Record<string, unknown>) =>
    String((body.error as Record<string, unknown> | undefined)?.message);
  const setSetting = async (key: string, value: unknown) => {
    await schoolYear.deleteFrom('settings').where('key', '=', key).execute();
    if (value !== null) {
      await schoolYear
        .insertInto('settings')
        .values({ org_unit_id: unitId, key, value_type: 'text', value: JSON.stringify(value) })
        .execute();
    }
  };

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    const academicYearId = await openTestAcademicYear(environment, principal.accessToken, '2026-2027', {
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
        code: 'THCS-28E',
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
    const subjects = rows((await api('GET', '/subjects?school_level=THCS', principal.accessToken)).body);
    const math = subjects.find((row) => row.code === 'THCS-TOAN')?.id as string;
    teacher = await environment.loginAs('VT-08', unitId);
    homeroom = await environment.loginAs('VT-07', unitId);
    otherHomeroom = await environment.loginAs('VT-07', unitId);
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
    for (const [role, user] of [
      ['subject', teacher],
      ['homeroom', homeroom],
    ] as const) {
      const assigned = await api('POST', `/classes/${classId}/staff-assignments`, principal.accessToken, {
        staff_user_id: user.userId,
        assignment_role: role,
        ...(role === 'subject' ? { subject_id: math } : {}),
      });
      assert.equal(assigned.status, 201, JSON.stringify(assigned.body));
    }
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
      tokens.push(login.body.access_token as string);
    }
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: 'ME', name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    const guardian = await schoolYear
      .insertInto('guardians')
      .values({ full_name: 'Mẹ của An', phone: '0901280005', user_id: parent.userId })
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
    spaceId = rows((await api('GET', '/learning/spaces', teacher.accessToken)).body)[0]?.id as string;
    assert.equal(
      (await api('PATCH', `/learning/spaces/${spaceId}`, teacher.accessToken, { visible_to_students: true })).status,
      200,
    );
    const section = await api('POST', `/learning/spaces/${spaceId}/sections`, teacher.accessToken, {
      title: 'Chương 1',
    });
    const due = new Date(Date.now() + 86_400_000).toISOString();
    const activity = await api('POST', `/learning/spaces/${spaceId}/activities`, teacher.accessToken, {
      section_id: section.body.id,
      kind: 'page',
      title: 'Đọc bài 1',
      settings: { body: 'Nội dung' },
      due_at: due,
    });
    activityId = activity.body.id as string;
    assert.equal((await api('POST', `/learning/activities/${activityId}/publish`, teacher.accessToken)).status, 200);
    const set = await schoolYear
      .insertInto('group_sets')
      .values({
        org_unit_id: unitId,
        class_id: classId,
        subject_id: math,
        name: 'Nhóm Toán',
        purpose: 'subject',
        method: 'manual',
        owner_user_id: teacher.userId,
        owner_name: 'Giáo viên thử',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
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
  });

  after(async () => {
    await schoolYear?.destroy();
    await environment?.close();
  });

  it('CT-28e-5: thông báo lớp tới học sinh, phụ huynh qua hàng đợi thông báo (tin đẩy không có nội dung); học sinh không đăng, không trả lời thông báo', async () => {
    const [an] = tokens as [string];
    const created = await api('POST', `/learning/spaces/${spaceId}/threads`, teacher.accessToken, {
      kind: 'announcement',
      title: 'Lịch kiểm tra',
      body: 'Thứ Sáu kiểm tra 15 phút bài 1',
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const notifications = await schoolYear
      .selectFrom('notifications')
      .innerJoin('notification_recipients', 'notification_recipients.notification_id', 'notifications.id')
      .select([
        'notifications.template_code',
        'notifications.body',
        'notification_recipients.channel',
        'notification_recipients.user_id',
      ])
      .where('notifications.target_id', '=', created.body.id as string)
      .execute();
    const inApp = notifications.filter((row) => row.channel === 'in_app').map((row) => row.user_id);
    assert.ok(inApp.includes(parent.userId), 'phụ huynh nhận thông báo');
    assert.equal(inApp.length, 4, 'phụ huynh và ba tài khoản học sinh');
    const push = notifications.filter((row) => row.channel === 'push');
    assert.equal(push.length, 1);
    assert.ok(!String(push[0]?.body).includes('kiểm tra'), 'tin đẩy không có nội dung thông báo');
    const list = await api('GET', `/student/discussions/spaces/${spaceId}?kind=announcement`, an);
    assert.equal(rows(list.body.threads).length, 1, JSON.stringify(list.body));
    assert.equal(
      (await api('POST', `/student/discussions/threads/${created.body.id}/posts`, an, { body: 'Dạ' })).status,
      422,
    );
    assert.equal(
      (
        await api('POST', `/student/discussions/spaces/${spaceId}/threads`, an, {
          kind: 'announcement',
          title: 'x',
          body: 'y',
        })
      ).status,
      400,
    );
    const forParent = await api('GET', `/learning/children/${children[0]}/announcements`, parent.accessToken);
    assert.deepEqual(
      rows(forParent.body).map((row) => row.title),
      ['Lịch kiểm tra'],
    );
    assert.equal(
      (await api('GET', `/learning/children/${children[0]}/announcements`, otherParent.accessToken)).status,
      403,
    );
  });

  let anPostId = '';
  let forumId = '';

  it('CT-28e-6: diễn đàn: học sinh mở chủ đề khi giáo viên cho; chữ có số điện thoại bị che; từ ngữ của trường gửi hàng chờ; ngoài giờ mở chỉ đọc', async () => {
    const [an, binh] = tokens as [string, string];
    const topic = { kind: 'forum', title: 'Hỏi về bài 1', body: 'Các bạn hiểu câu 2 chưa?' };
    const blocked = await api('POST', `/student/discussions/spaces/${spaceId}/threads`, an, topic);
    assert.equal(blocked.status, 422);
    assert.match(messageOf(blocked.body), /chưa cho học sinh mở chủ đề/);
    assert.equal(
      (
        await api('PUT', `/learning/spaces/${spaceId}/discussion-settings`, teacher.accessToken, {
          students_can_post_topics: true,
        })
      ).status,
      200,
    );
    const opened = await api('POST', `/student/discussions/spaces/${spaceId}/threads`, an, topic);
    assert.equal(opened.status, 201, JSON.stringify(opened.body));
    forumId = opened.body.id as string;
    const masked = await api('POST', `/student/discussions/threads/${forumId}/posts`, an, {
      body: 'Gọi mình 0912 345 678 nhé',
    });
    assert.equal(masked.status, 201, JSON.stringify(masked.body));
    assert.equal(masked.body.body, 'Gọi mình *** nhé');
    assert.equal(masked.body.masked, true);
    anPostId = masked.body.id as string;
    await setSetting('discussion_blocked_words', ['đồ ngốc']);
    const rude = await api('POST', `/student/discussions/threads/${forumId}/posts`, binh, { body: 'Đồ ngốc' });
    assert.equal(rude.body.body, '***');
    const filterReport = await schoolYear
      .selectFrom('discussion_reports')
      .select(['source', 'status'])
      .where('post_id', '=', rude.body.id as string)
      .executeTakeFirstOrThrow();
    assert.deepEqual(filterReport, { source: 'filter', status: 'open' });
    await setSetting('discussion_blocked_words', null);
    const hour = new Date(Date.now() + 7 * 3_600_000).getUTCHours();
    const closedWindow = {
      from: `${String((hour + 2) % 24).padStart(2, '0')}:00`,
      to: `${String((hour + 3) % 24).padStart(2, '0')}:00`,
    };
    await setSetting('discussion_open_hours', { school_days: closedWindow, weekend: closedWindow });
    const outside = await api('POST', `/student/discussions/threads/${forumId}/posts`, an, { body: 'Mình hỏi thêm' });
    assert.equal(outside.status, 422);
    assert.match(messageOf(outside.body), /Ngoài giờ mở/);
    assert.equal(
      (await api('POST', `/learning/threads/${forumId}/posts`, teacher.accessToken, { body: 'Cô trả lời' })).status,
      201,
    );
    await setSetting('discussion_open_hours', null);
    // Ban Giám hiệu tự cấu hình giờ mở và từ ngữ lọc (GD-144 chưa chốt); giáo viên không đổi được
    const saved = await api('PUT', '/learning/discussion-config', principal.accessToken, {
      open_hours: { school_days: { from: '06:00', to: '21:00' } },
      blocked_words: ['đồ ngốc', 'x'],
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.deepEqual(saved.body.blocked_words, ['đồ ngốc']);
    assert.equal((await api('PUT', '/learning/discussion-config', teacher.accessToken, {})).status, 403);
    await setSetting('discussion_open_hours', null);
    await setSetting('discussion_blocked_words', null);
  });

  it('CT-28e-7: hỏi đáp: câu hỏi riêng chỉ người hỏi và giáo viên thấy; hàng chờ câu chưa trả lời; giáo viên trả lời, xác nhận câu trả lời', async () => {
    const [an, binh] = tokens as [string, string];
    const question = await api('POST', `/student/discussions/spaces/${spaceId}/threads`, an, {
      kind: 'question',
      title: 'Em chưa hiểu phân số',
      body: 'Vì sao 2/4 bằng 1/2 ạ?',
      private: true,
      activity_id: activityId,
    });
    assert.equal(question.status, 201, JSON.stringify(question.body));
    const questionId = question.body.id as string;
    assert.equal((await api('GET', `/student/discussions/threads/${questionId}`, binh)).status, 404);
    const binhList = await api('GET', `/student/discussions/spaces/${spaceId}?kind=question`, binh);
    assert.equal(rows(binhList.body.threads).length, 0);
    const pending = await api('GET', `/learning/spaces/${spaceId}/questions/pending`, teacher.accessToken);
    assert.deepEqual(
      rows(pending.body).map((row) => row.id),
      [questionId],
    );
    const reply = await api('POST', `/learning/threads/${questionId}/posts`, teacher.accessToken, {
      body: 'Chia cả tử và mẫu cho 2',
    });
    assert.equal(reply.status, 201);
    const accepted = await api('POST', `/learning/threads/${questionId}/accept`, teacher.accessToken, {
      post_id: reply.body.id,
    });
    assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
    assert.equal(
      rows((await api('GET', `/learning/spaces/${spaceId}/questions/pending`, teacher.accessToken)).body).length,
      0,
    );
    const forAn = await api('GET', `/student/discussions/threads/${questionId}`, an);
    assert.equal((forAn.body.thread as Record<string, unknown>).accepted_post_id, reply.body.id);
  });

  it('CT-28e-8: báo cáo vi phạm vào hàng chờ; chủ nhiệm lớp thấy, chủ nhiệm khác không; xử lý ẩn nội dung và tạm khóa quyền viết', async () => {
    const [an, binh] = tokens as [string, string];
    const reported = await api('POST', `/student/discussions/threads/${forumId}/reports`, binh, {
      post_id: anPostId,
      reason: 'Bạn đưa số điện thoại',
    });
    assert.equal(reported.status, 201, JSON.stringify(reported.body));
    const queue = await api('GET', '/learning/discussion-reports', homeroom.accessToken);
    assert.equal(queue.status, 200, JSON.stringify(queue.body));
    const row = rows(queue.body).find((item) => item.id === reported.body.id);
    assert.ok(row, 'chủ nhiệm lớp thấy báo cáo');
    assert.ok(
      !rows((await api('GET', '/learning/discussion-reports', otherHomeroom.accessToken)).body).some(
        (item) => item.id === reported.body.id,
      ),
    );
    assert.equal((await api('GET', '/learning/discussion-reports', teacher.accessToken)).status, 403);
    const resolved = await api('PATCH', `/learning/discussion-reports/${reported.body.id}`, principal.accessToken, {
      status: 'resolved',
      resolution: 'Nhắc em không đưa thông tin liên lạc',
      hide: true,
      ban_days: 3,
    });
    assert.equal(resolved.status, 200, JSON.stringify(resolved.body));
    const banned = await api('POST', `/student/discussions/threads/${forumId}/posts`, an, { body: 'Em xin lỗi' });
    assert.equal(banned.status, 422);
    assert.match(messageOf(banned.body), /tạm không viết được/);
    const forStudents = await api('GET', `/student/discussions/threads/${forumId}`, binh);
    assert.ok(!rows(forStudents.body.posts).some((post) => post.id === anPostId), 'học sinh không thấy nội dung đã ẩn');
    const forTeacher = await api('GET', `/learning/threads/${forumId}`, teacher.accessToken);
    assert.equal(rows(forTeacher.body.posts).find((post) => post.id === anPostId)?.hidden, true, 'giáo viên vẫn thấy');
    await schoolYear.deleteFrom('discussion_write_bans').execute();
  });

  it('CT-28e-9: không gian học nhóm: bảng tin, việc, ghi chú có phiên bản, tệp; nhóm khác không vào được; giáo viên thấy; phụ huynh THCS không đọc thảo luận', async () => {
    const [an, binh, chi] = tokens as [string, string, string];
    const mine = await api('GET', '/student/groups', an);
    assert.deepEqual(
      rows(mine.body).map((row) => row.id),
      [groups[0]],
    );
    const board = await api('POST', `/student/groups/${groups[0]}/threads`, an, {
      title: 'Chia việc',
      body: 'Mình làm phần đo',
    });
    assert.equal(board.status, 201, JSON.stringify(board.body));
    const task = await api('POST', `/student/groups/${groups[0]}/tasks`, an, {
      title: 'Đo chiều cao cây',
      assignee_child_id: children[1],
      due_on: '2026-11-05',
    });
    assert.equal(task.status, 201, JSON.stringify(task.body));
    assert.equal(
      (
        await api('POST', `/student/groups/${groups[0]}/tasks`, an, {
          title: 'Việc lạ',
          assignee_child_id: children[2],
        })
      ).status,
      422,
      'người làm phải trong nhóm',
    );
    assert.equal(
      (await api('PATCH', `/student/group-tasks/${task.body.id}`, binh, { status: 'done' })).body.status,
      'done',
    );
    const first = await api('PUT', `/student/groups/${groups[0]}/note`, an, { content: 'Ghi chú 1', version: 0 });
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(first.body.version, 1);
    assert.equal(
      (await api('PUT', `/student/groups/${groups[0]}/note`, binh, { content: 'Bản cũ', version: 0 })).status,
      409,
    );
    const form = new FormData();
    form.append('file', new Blob([PNG]), 'so-do.png');
    const upload = await fetch(url(`/student/groups/${groups[0]}/files`), {
      method: 'POST',
      headers: { authorization: `Bearer ${an}` },
      body: form,
    });
    assert.equal(upload.status, 201);
    assert.equal((await api('GET', `/student/groups/${groups[0]}`, chi)).status, 404, 'nhóm khác không vào được');
    const workspace = await api('GET', `/learning/groups/${groups[0]}/workspace`, teacher.accessToken);
    assert.equal(workspace.status, 200, JSON.stringify(workspace.body));
    assert.equal(rows(workspace.body.threads).length, 1);
    assert.equal(rows(workspace.body.files).length, 1);
    const forParent = await api('GET', `/learning/children/${children[0]}/groups`, parent.accessToken);
    assert.equal(forParent.status, 200, JSON.stringify(forParent.body));
    const parentView = rows(forParent.body)[0] as Record<string, unknown>;
    assert.deepEqual(parentView.view, { discussions: false, notes: false });
    assert.equal(rows(parentView.threads).length, 0, 'phụ huynh THCS không đọc thảo luận (GD-145)');
    assert.equal(rows(parentView.tasks).length, 1, 'phụ huynh thấy việc, hạn');
  });

  it('CT-28e-10: lịch học tập của học sinh có hạn hoạt động trong tuần; phụ huynh xem lịch của con; phụ huynh khác bị chặn', async () => {
    const [an] = tokens as [string];
    const calendar = await api('GET', '/student/calendar', an);
    assert.equal(calendar.status, 200, JSON.stringify(calendar.body));
    const due = new Date(Date.now() + 86_400_000);
    const dueDay = new Date(due.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
    const week = await api('GET', `/student/calendar?from=${dueDay}`, an);
    assert.ok(rows(week.body.items).some((item) => item.kind === 'due' && item.title === 'Đọc bài 1'));
    assert.equal(
      (await api('GET', `/learning/children/${children[0]}/calendar?from=${dueDay}`, parent.accessToken)).status,
      200,
    );
    assert.equal((await api('GET', `/learning/children/${children[0]}/calendar`, otherParent.accessToken)).status, 403);
  });
});
