import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';

// Tương tác và đồ bị mất (DT-10 phần 10f, YCTD-79); kịch bản CT-073, CT-074, CT-075, CT-107, CT-108, CT-109
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const errorOf = (body: Record<string, unknown>) =>
  (body.error ?? {}) as { code?: string; rule_code?: string; message?: string };
const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();

describe('Tương tác với phụ huynh và đồ bị mất', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let academicYearId = '';
  const units: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const classes: Record<string, string> = {};
  const children: Record<string, string> = {};
  let pollId = '';

  const token = (name: string) => users[name]?.accessToken ?? '';
  const userId = (name: string) => users[name]?.userId ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);
  const notified = async (targetId: string, recipient: string) =>
    (
      await schoolYear
        .selectFrom('notification_recipients')
        .innerJoin('notifications', 'notifications.id', 'notification_recipients.notification_id')
        .select('notifications.id')
        .where('notifications.target_id', '=', targetId)
        .where('notification_recipients.user_id', '=', recipient)
        .execute()
    ).length > 0;

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    academicYearId = await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
      first_term: { start_date: addDays(vietnamToday, -60), end_date: addDays(vietnamToday, 90) },
      second_term: { start_date: addDays(vietnamToday, 95), end_date: addDays(vietnamToday, 200) },
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
      ['ĐT-A1', 'diem_truong'],
      ['ĐT-B1', 'diem_truong'],
    ] as const) {
      units[code] = (await api('POST', '/org-units', principal.accessToken, { code, name: code, unit_type: type })).body
        .id as string;
    }
    const unitA = units['ĐT-A1'] ?? '';
    users.manager = await environment.loginAs('VT-03', unitA);
    users.otherManager = await environment.loginAs('VT-03', units['ĐT-B1'] ?? null);
    users.homeroom = await environment.loginAs('VT-07', unitA);
    users.otherTeacher = await environment.loginAs('VT-07', unitA);
    users.parentA = await environment.loginAs('VT-14', unitA);
    users.parentB = await environment.loginAs('VT-14', unitA);
    users.parentOther = await environment.loginAs('VT-14', unitA);

    for (const code of ['MAM-1', 'MAM-2']) {
      classes[code] = (
        await schoolYear
          .insertInto('classes')
          .values({
            org_unit_id: unitA,
            academic_year_id: academicYearId,
            code,
            name: code,
            grade_level: 'MAM',
            max_size: 25,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    for (const [teacher, classCode] of [
      ['homeroom', 'MAM-1'],
      ['otherTeacher', 'MAM-2'],
    ] as const) {
      await schoolYear
        .insertInto('class_staff_assignments')
        .values({
          class_id: classes[classCode] ?? '',
          staff_user_id: userId(teacher),
          staff_name: teacher,
          assignment_role: 'homeroom',
          from_date: addDays(vietnamToday, -60),
        })
        .execute();
    }
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: 'ME', name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    for (const [key, parent, classCode] of [
      ['A', 'parentA', 'MAM-1'],
      ['B', 'parentB', 'MAM-1'],
      ['C', 'parentOther', 'MAM-2'],
    ] as const) {
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitA,
          full_name: `Trẻ ${key}`,
          dob: addDays(vietnamToday, -3 * 365),
          gender: 'female',
          national_id_encrypted: 'ma-hoa',
          national_id_hash: randomUUID(),
          national_id_last4: '0000',
          photo_consent: 'pending',
          status: 'active',
          enroll_date: addDays(vietnamToday, -60),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      children[key] = child.id;
      await schoolYear
        .insertInto('class_enrollments')
        .values({ child_id: child.id, class_id: classes[classCode] ?? '', from_date: addDays(vietnamToday, -60) })
        .execute();
      const guardian = await schoolYear
        .insertInto('guardians')
        .values({
          full_name: `Mẹ ${key}`,
          phone: `090${Math.floor(Math.random() * 9_000_000 + 1_000_000)}`,
          user_id: userId(parent),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await schoolYear
        .insertInto('child_guardians')
        .values({
          child_id: child.id,
          guardian_id: guardian.id,
          relationship_item_id: relationship.id,
          is_primary: true,
        })
        .execute();
    }
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('P15-01: phụ huynh nhắn giáo viên chủ nhiệm; giáo viên thấy, trả lời; người ngoài luồng bị từ chối', async () => {
    const started = await api('POST', '/message-threads', token('parentA'), {
      child_id: children.A,
      content: 'Cô ơi hôm nay bé có ăn hết suất không ạ?',
    });
    assert.equal(started.status, 201, JSON.stringify(started.body));
    const threadId = started.body.thread_id as string;
    assert.ok(await notified(threadId, userId('homeroom')));

    const teacherThreads = await api('GET', '/message-threads', token('homeroom'));
    const listed = teacherThreads.body as unknown as Array<{ id: string; unread_count: number; child_name: string }>;
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.unread_count, 1);
    assert.equal(listed[0]?.child_name, 'Trẻ A');
    assert.equal(
      ((await api('GET', '/message-threads', token('otherTeacher'))).body as unknown as unknown[]).length,
      0,
    );
    assert.equal((await api('GET', `/message-threads/${threadId}/messages`, token('otherTeacher'))).status, 403);
    assert.equal((await api('GET', `/message-threads/${threadId}/messages`, token('parentB'))).status, 403);
    assert.equal((await api('GET', `/message-threads/${threadId}/messages`, token('otherManager'))).status, 403);

    assert.equal((await api('POST', `/message-threads/${threadId}/read`, token('homeroom'))).body.marked, 1);
    const reply = await api('POST', `/message-threads/${threadId}/messages`, token('homeroom'), {
      content: 'Bé ăn hết ạ',
    });
    assert.equal(reply.status, 201, JSON.stringify(reply.body));
    assert.ok(await notified(threadId, userId('parentA')));

    const parentView = await api('GET', `/message-threads/${threadId}/messages`, token('parentA'));
    const messages = parentView.body.messages as Array<{
      sender_side: string;
      content: string;
      read_at: string | null;
    }>;
    assert.deepEqual(
      messages.map((message) => message.sender_side),
      ['guardian', 'staff'],
    );
    assert.ok(messages[0]?.read_at);
    const parentThreads = (await api('GET', '/message-threads', token('parentA'))).body as unknown as Array<{
      unread_count: number;
    }>;
    assert.equal(parentThreads[0]?.unread_count, 1);

    // Quản lý đơn vị xem và nhắn trong đơn vị; giáo viên lớp khác không mở được luồng với trẻ ngoài lớp
    assert.equal(((await api('GET', '/message-threads', token('manager'))).body as unknown as unknown[]).length, 1);
    assert.equal(
      (await api('POST', '/message-threads', token('otherTeacher'), { child_id: children.A, content: 'Chào' })).status,
      403,
    );
    const fromTeacher = await api('POST', '/message-threads', token('homeroom'), {
      child_id: children.B,
      content: 'Nhắc phụ huynh mang áo khoác cho bé',
    });
    assert.equal(fromTeacher.status, 201, JSON.stringify(fromTeacher.body));
    assert.ok(await notified(fromTeacher.body.thread_id as string, userId('parentB')));
  });

  it('P15-02: góp ý ẩn danh; người xử lý không thấy người gửi; ghi kết quả và báo người gửi', async () => {
    const submitted = await api('POST', '/feedbacks', token('parentA'), {
      child_id: children.A,
      category: 'meal',
      content: 'Đề nghị thêm rau trong bữa trưa',
      privacy_level: 'anonymous',
    });
    assert.equal(submitted.status, 201, JSON.stringify(submitted.body));
    assert.equal(
      (await api('POST', '/feedbacks', token('parentB'), { child_id: children.A, content: 'Không phải con tôi' }))
        .status,
      403,
    );
    const managerList = (await api('GET', '/feedbacks', token('manager'))).body as unknown as Array<{
      submitter_name: string;
      submitted_by_user_id: string | null;
    }>;
    assert.equal(managerList.length, 1);
    assert.equal(managerList[0]?.submitter_name, 'Ẩn danh');
    assert.equal(managerList[0]?.submitted_by_user_id, null);
    assert.equal(((await api('GET', '/feedbacks', token('otherManager'))).body as unknown as unknown[]).length, 0);

    const id = submitted.body.id as string;
    assert.equal((await api('POST', `/feedbacks/${id}/handle`, token('homeroom'), { status: 'resolved' })).status, 403);
    assert.equal((await api('POST', `/feedbacks/${id}/handle`, token('manager'), { status: 'resolved' })).status, 400);
    const resolved = await api('POST', `/feedbacks/${id}/handle`, token('manager'), {
      status: 'resolved',
      handling_note: 'Bếp đã bổ sung rau từ tuần sau',
    });
    assert.equal(resolved.status, 200, JSON.stringify(resolved.body));
    assert.ok(await notified(id, userId('parentA')));
    const again = await api('POST', `/feedbacks/${id}/handle`, token('manager'), { status: 'in_progress' });
    assert.equal(errorOf(again.body).rule_code, 'P15-02');
    const mine = (await api('GET', '/feedbacks', token('parentA'))).body as unknown as Array<{
      status: string;
      handling_note: string;
    }>;
    assert.equal(mine[0]?.status, 'resolved');
    assert.equal(((await api('GET', '/feedbacks', token('parentB'))).body as unknown as unknown[]).length, 0);
  });

  it('P15-03, CT-073: mỗi tài khoản một phiếu; phiếu thứ hai bị từ chối', async () => {
    const created = await api('POST', '/polls', token('manager'), {
      org_unit_id: units['ĐT-A1'],
      poll_type: 'poll',
      title: 'Chọn ngày tổ chức Trung thu',
      start_at: hoursFromNow(-1),
      end_at: hoursFromNow(48),
      options: ['Thứ Sáu', 'Thứ Bảy'],
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    pollId = created.body.id as string;
    assert.equal(
      (
        await api('POST', '/polls', token('homeroom'), {
          org_unit_id: units['ĐT-A1'],
          poll_type: 'poll',
          title: 'x',
          start_at: hoursFromNow(-1),
          end_at: hoursFromNow(2),
          options: ['a', 'b'],
        })
      ).status,
      403,
    );
    // Bản nháp chưa hiện với phụ huynh
    assert.equal(((await api('GET', '/polls', token('parentA'))).body as unknown as unknown[]).length, 0);
    const published = await api('POST', `/polls/${pollId}/publish`, token('manager'));
    assert.equal(published.status, 200, JSON.stringify(published.body));

    const open = (await api('GET', '/polls?open=true', token('parentA'))).body as unknown as Array<{
      id: string;
      can_respond: boolean;
    }>;
    assert.equal(open.length, 1);
    assert.equal(open[0]?.can_respond, true);
    const detail = await api('GET', `/polls/${pollId}`, token('parentA'));
    const options = (detail.body.questions as Array<{ options: Array<{ id: string }> }>)[0]?.options ?? [];
    const first = await api('POST', `/polls/${pollId}/responses`, token('parentA'), { option_id: options[0]?.id });
    assert.equal(first.status, 201, JSON.stringify(first.body));
    const second = await api('POST', `/polls/${pollId}/responses`, token('parentA'), { option_id: options[1]?.id });
    assert.equal(second.status, 422);
    assert.equal(errorOf(second.body).rule_code, 'BR-67');
    assert.equal(
      (await api('POST', `/polls/${pollId}/responses`, token('parentB'), { option_id: randomUUID() })).status,
      400,
    );

    const results = await api('GET', `/polls/${pollId}/results`, token('manager'));
    assert.equal(results.body.response_count, 1);
    const counted = (results.body.questions as Array<{ options: Array<{ count: number }> }>)[0]?.options;
    assert.deepEqual(
      counted?.map((option) => option.count),
      [1, 0],
    );
    assert.equal((await api('GET', `/polls/${pollId}/results`, token('parentA'))).status, 403);
    assert.equal((await api('POST', `/polls/${pollId}/publish-results`, token('manager'))).status, 200);
    assert.equal((await api('GET', `/polls/${pollId}/results`, token('parentA'))).status, 200);
    assert.equal((await api('GET', `/polls/${pollId}`, token('otherManager'))).status, 403);
  });

  it('P15-04, CT-074: gửi phiếu biểu quyết sau khi hết thời gian bị từ chối, báo đã hết thời gian', async () => {
    const created = await api('POST', '/polls', token('manager'), {
      org_unit_id: units['ĐT-A1'],
      poll_type: 'vote',
      title: 'Biểu quyết mức đóng quỹ lớp',
      class_id: classes['MAM-1'],
      start_at: hoursFromNow(-2),
      end_at: hoursFromNow(1),
      options: ['Đồng ý', 'Không đồng ý'],
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const voteId = created.body.id as string;
    assert.equal((await api('POST', `/polls/${voteId}/publish`, token('manager'))).status, 200);
    // Phụ huynh lớp khác không là đối tượng
    assert.equal(
      ((await api('GET', '/polls?poll_type=vote', token('parentOther'))).body as unknown as unknown[]).length,
      0,
    );
    await schoolYear
      .updateTable('polls')
      .set({ end_at: new Date(Date.now() - 60_000) })
      .where('id', '=', voteId)
      .execute();
    const detail = await api('GET', `/polls/${voteId}`, token('parentB'));
    const option = (detail.body.questions as Array<{ options: Array<{ id: string }> }>)[0]?.options[0];
    const late = await api('POST', `/polls/${voteId}/responses`, token('parentB'), { option_id: option?.id });
    assert.equal(late.status, 422);
    assert.equal(errorOf(late.body).rule_code, 'BR-68');
    assert.match(errorOf(late.body).message ?? '', /hết thời gian/);
  });

  it('P15-05: danh mục khảo sát; khảo sát chép câu hỏi từ mẫu; trả lời nhiều loại câu hỏi; tổng hợp', async () => {
    const template = await api('POST', '/survey-templates', token('manager'), {
      name: 'Khảo sát hài lòng cuối kỳ',
      questions: [
        { question_text: 'Mức hài lòng chung', answer_type: 'rating' },
        {
          question_text: 'Điều phụ huynh thích',
          answer_type: 'multiple_choice',
          options: ['Bữa ăn', 'Giáo viên', 'Sân chơi'],
        },
        { question_text: 'Ý kiến khác', answer_type: 'text', is_required: false },
      ],
    });
    assert.equal(template.status, 201, JSON.stringify(template.body));
    assert.equal((await api('POST', '/survey-templates', token('parentA'), { name: 'x', questions: [] })).status, 403);
    const survey = await api('POST', '/polls', token('manager'), {
      org_unit_id: units['ĐT-A1'],
      poll_type: 'survey',
      title: 'Khảo sát học kỳ I',
      survey_template_id: template.body.id,
      is_anonymous: true,
      start_at: hoursFromNow(-1),
      end_at: hoursFromNow(24),
    });
    assert.equal(survey.status, 201, JSON.stringify(survey.body));
    const surveyId = survey.body.id as string;
    await api('POST', `/polls/${surveyId}/publish`, token('manager'));
    const detail = await api('GET', `/polls/${surveyId}`, token('parentA'));
    const questions = detail.body.questions as Array<{ id: string; options: Array<{ id: string }> }>;
    assert.equal(questions.length, 3);
    const [rating, choice, text] = questions;
    const missing = await api('POST', `/polls/${surveyId}/responses`, token('parentA'), {
      answers: [{ question_id: rating?.id, number: 4 }],
    });
    assert.equal(missing.status, 400);
    const answered = await api('POST', `/polls/${surveyId}/responses`, token('parentA'), {
      answers: [
        { question_id: rating?.id, number: 4 },
        { question_id: choice?.id, option_ids: [choice?.options[0]?.id, choice?.options[1]?.id] },
        { question_id: text?.id, text: 'Cảm ơn cô' },
      ],
    });
    assert.equal(answered.status, 201, JSON.stringify(answered.body));
    const results = await api('GET', `/polls/${surveyId}/results`, token('manager'));
    const summary = results.body.questions as Array<{
      average: number | null;
      texts: string[];
      options: Array<{ count: number }>;
    }>;
    assert.equal(summary[0]?.average, 4);
    assert.deepEqual(
      summary[1]?.options.map((option) => option.count),
      [1, 1, 0],
    );
    assert.deepEqual(summary[2]?.texts, ['Cảm ơn cô']);
    assert.equal(results.body.respondents, null);
  });

  it('P15-06, CT-075: xử lý bình luận tiêu cực; bình luận còn nguyên, có bản ghi xử lý; lượt thích', async () => {
    const comment = await api('POST', '/interaction-comments', token('parentA'), {
      target_type: 'poll',
      target_id: pollId,
      content: 'Nhà trường tổ chức quá tệ',
    });
    assert.equal(comment.status, 201, JSON.stringify(comment.body));
    const commentId = comment.body.id as string;
    assert.equal(
      (
        await api('POST', '/interaction-comments', token('otherManager'), {
          target_type: 'poll',
          target_id: pollId,
          content: 'x',
        })
      ).status,
      403,
    );
    const like = await api('POST', '/interaction-likes', token('parentB'), {
      target_type: 'comment',
      target_id: commentId,
    });
    assert.deepEqual(like.body, { liked: true, like_count: 1 });
    const pollLike = await api('POST', '/interaction-likes', token('parentB'), {
      target_type: 'poll',
      target_id: pollId,
    });
    assert.equal(pollLike.body.like_count, 1);
    const unlike = await api('POST', '/interaction-likes', token('parentB'), {
      target_type: 'poll',
      target_id: pollId,
    });
    assert.deepEqual(unlike.body, { liked: false, like_count: 0 });

    const reported = await api('POST', `/interaction-comments/${commentId}/report`, token('parentB'), {
      reason: 'Lời lẽ tiêu cực',
    });
    assert.equal(reported.status, 200, JSON.stringify(reported.body));
    const roleNotice = await schoolYear
      .selectFrom('notification_recipients')
      .innerJoin('notifications', 'notifications.id', 'notification_recipients.notification_id')
      .select('notification_recipients.role_code')
      .where('notifications.target_id', '=', commentId)
      .executeTakeFirst();
    assert.equal(roleNotice?.role_code, 'VT-03');
    const queue = (await api('GET', '/interaction-comments/reported', token('manager'))).body as unknown as unknown[];
    assert.equal(queue.length, 1);

    assert.equal(
      (
        await api('POST', `/interaction-comments/${commentId}/moderate`, token('homeroom'), {
          action: 'hide',
          reason: 'x',
        })
      ).status,
      403,
    );
    assert.equal(
      (await api('POST', `/interaction-comments/${commentId}/moderate`, token('manager'), { action: 'hide' })).status,
      400,
    );
    const hidden = await api('POST', `/interaction-comments/${commentId}/moderate`, token('manager'), {
      action: 'hide',
      reason: 'Ngôn từ không phù hợp, đã liên hệ phụ huynh trao đổi riêng',
    });
    assert.equal(hidden.status, 201, JSON.stringify(hidden.body));
    // Không có thao tác xóa bình luận (BR-66)
    assert.equal((await api('DELETE', `/interaction-comments/${commentId}`, token('manager'))).status, 404);

    const stored = await schoolYear
      .selectFrom('interaction_comments')
      .selectAll()
      .where('id', '=', commentId)
      .executeTakeFirstOrThrow();
    assert.equal(stored.content, 'Nhà trường tổ chức quá tệ');
    assert.ok(stored.hidden_at);
    const moderations = await schoolYear
      .selectFrom('comment_moderations')
      .selectAll()
      .where('comment_id', '=', commentId)
      .execute();
    assert.equal(moderations.length, 1);
    assert.equal(moderations[0]?.action, 'hide');
    assert.equal(moderations[0]?.handled_by, userId('manager'));

    const forOthers = (await api('GET', `/interaction-comments?target_type=poll&target_id=${pollId}`, token('parentB')))
      .body as unknown as unknown[];
    assert.equal(forOthers.length, 0);
    const forAuthor = (await api('GET', `/interaction-comments?target_type=poll&target_id=${pollId}`, token('parentA')))
      .body as unknown as Array<{ is_hidden: boolean; content: string }>;
    assert.equal(forAuthor[0]?.is_hidden, true);
    const forManager = (
      await api('GET', `/interaction-comments?target_type=poll&target_id=${pollId}`, token('manager'))
    ).body as unknown as Array<{ moderations: unknown[] }>;
    assert.equal(forManager[0]?.moderations.length, 1);
  });

  it('P02-11, CT-107: phụ huynh báo mất đồ của con; phiếu đã báo; giáo viên chủ nhiệm nhận thông báo', async () => {
    const reported = await api('POST', '/lost-items', token('parentA'), {
      child_id: children.A,
      description: 'Áo khoác màu xanh có thêu tên bé',
      noticed_on: vietnamToday,
    });
    assert.equal(reported.status, 201, JSON.stringify(reported.body));
    assert.equal(reported.body.status, 'reported');
    assert.match(reported.body.code as string, /^DBM-\d{6}$/);
    assert.ok(await notified(reported.body.id as string, userId('homeroom')));
    assert.equal(await notified(reported.body.id as string, userId('otherTeacher')), false);
    const classItems = (await api('GET', `/lost-items?class_id=${classes['MAM-1']}`, token('homeroom')))
      .body as unknown as unknown[];
    assert.equal(classItems.length, 1);
    assert.equal(((await api('GET', '/lost-items', token('otherTeacher'))).body as unknown as unknown[]).length, 0);
    assert.equal(
      (await api('POST', '/lost-items', token('parentB'), { child_id: children.A, description: 'Mũ' })).status,
      403,
    );
    assert.equal(
      (
        await api('POST', '/lost-items', token('parentA'), {
          child_id: children.A,
          description: 'Mũ',
          noticed_on: addDays(vietnamToday, 1),
        })
      ).status,
      400,
    );
    // Giáo viên ghi nhận đồ nhặt được của lớp
    const found = await api('POST', '/lost-items', token('homeroom'), {
      report_type: 'found',
      class_id: classes['MAM-1'],
      description: 'Bình nước màu hồng',
    });
    assert.equal(found.status, 201, JSON.stringify(found.body));
    assert.equal(found.body.status, 'found');
    assert.equal(
      (
        await api('POST', '/lost-items', token('parentA'), {
          report_type: 'found',
          class_id: classes['MAM-1'],
          description: 'x',
        })
      ).status,
      403,
    );
  });

  it('P02-11, CT-108: phụ huynh trẻ A gọi phiếu đồ bị mất của trẻ B bị từ chối', async () => {
    const ofB = await api('POST', '/lost-items', token('parentB'), { child_id: children.B, description: 'Giày đỏ' });
    assert.equal(ofB.status, 201, JSON.stringify(ofB.body));
    const denied = await api('GET', `/lost-items/${ofB.body.id}`, token('parentA'));
    assert.equal(denied.status, 403);
    assert.equal(errorOf(denied.body).code, 'ERR_FORBIDDEN');
    assert.equal((await api('GET', `/lost-items?child_id=${children.B}`, token('parentA'))).status, 403);
    const own = (await api('GET', '/lost-items', token('parentA'))).body as unknown as Array<{ child_id: string }>;
    assert.ok(own.length > 0 && own.every((item) => item.child_id === children.A));
    assert.equal((await api('GET', `/lost-items/${ofB.body.id}`, token('parentB'))).status, 200);
    assert.equal((await api('GET', `/lost-items/${ofB.body.id}`, token('homeroom'))).status, 200);
  });

  it('P02-11, CT-109: xóa phiếu đồ bị mất đã đóng bị chặn; phiếu đang báo hủy được', async () => {
    const item = await api('POST', '/lost-items', token('parentA'), { child_id: children.A, description: 'Kẹp tóc' });
    const itemId = item.body.id as string;
    assert.equal(
      (await api('POST', `/lost-items/${itemId}/close`, token('otherTeacher'), { result: 'returned' })).status,
      403,
    );
    assert.equal(
      (await api('POST', `/lost-items/${itemId}/found`, token('homeroom'), { found_note: 'Ở góc đồ chơi' })).status,
      200,
    );
    const closed = await api('POST', `/lost-items/${itemId}/close`, token('homeroom'), {
      result: 'returned',
      result_note: 'Đã trả khi đón chiều',
    });
    assert.equal(closed.status, 200, JSON.stringify(closed.body));
    assert.ok(await notified(itemId, userId('parentA')));
    const blocked = await api('DELETE', `/lost-items/${itemId}`, token('parentA'));
    assert.equal(blocked.status, 422);
    assert.equal(errorOf(blocked.body).rule_code, 'BR-75');
    assert.equal((await api('DELETE', `/lost-items/${itemId}`, token('manager'))).status, 422);
    const still = await schoolYear
      .selectFrom('lost_items')
      .select('status')
      .where('id', '=', itemId)
      .executeTakeFirst();
    assert.equal(still?.status, 'returned');

    const pending = await api('POST', '/lost-items', token('parentA'), { child_id: children.A, description: 'Khăn' });
    const cancelled = await api('DELETE', `/lost-items/${pending.body.id}`, token('parentA'));
    assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));
    assert.equal(cancelled.body.status, 'cancelled');
  });
});
