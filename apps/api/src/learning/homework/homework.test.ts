import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import { Clock } from '@school-management/server';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../../test-support.js';
import { HomeworkService } from './homework.js';
import { vietnamDate } from './homework-rules.js';

// Điểm cuối bài về nhà (DT-28 phần 28f, YCTD-276): giao từ sổ đầu bài (gắn tiết, hạn mặc định), giữ ngữ cảnh khi soạn tiếp, quy tắc
// khối lượng do Ban Giám hiệu đặt (cảnh báo cần xác nhận, chặn chỉ vượt khi Ban Giám hiệu cho, có lý do), lịch khối lượng của lớp,
// phụ huynh xem bài của con, "Đã xem cùng con", nộp thay khi con chưa có tài khoản, trao đổi trên bài, gợi ý gia hạn khi vắng có
// phép, việc nền nhắc có giờ yên lặng và gộp nhiều bài. Người, lớp là dữ liệu giả
describe('Điểm cuối bài về nhà', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let teacher: LoggedInUser;
  let otherTeacher: LoggedInUser;
  let parent: LoggedInUser;
  let otherParent: LoggedInUser;
  let unitId = '';
  let academicYearId = '';
  let classId = '';
  let classLogId = '';
  const subjects: Record<string, string> = {};
  const children: string[] = [];
  const names = ['Học sinh An', 'Học sinh Bình', 'Học sinh Chi'];
  const url = (path: string) => `${environment.baseUrl}${path}`;
  const api = (method: string, path: string, token: string, body?: unknown) => sendJson(method, url(path), token, body);
  const errorOf = (body: Record<string, unknown>) =>
    (body.error ?? {}) as { code?: string; rule_code?: string; details?: Array<{ field: string }> };
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

  // Bài về nhà mới từ tiết, soạn một câu tự luận và một câu chụp vở
  async function homeworkFromLesson(title: string, minutes?: number) {
    const created = await api('POST', `/learning/homework/class-logs/${classLogId}`, teacher.accessToken, {
      title,
      ...(minutes ? { estimated_minutes: minutes } : {}),
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const activityId = created.body.activity_id as string;
    const saved = await api('PUT', `/learning/activities/${activityId}/assignment`, teacher.accessToken, {
      grading: 'score',
      ...(minutes ? { estimated_minutes: minutes } : {}),
      items: [
        { kind: 'essay', prompt: 'Trình bày lời giải', score: 5 },
        { kind: 'upload', prompt: 'Chụp ảnh vở bài làm', score: 5 },
      ],
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    return { activityId, created: created.body, saved: saved.body };
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
        code: 'THCS-28F',
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
      // An chưa có tài khoản học (phụ huynh nộp thay); Bình, Chi đã có
      if (index > 0) {
        await schoolYear
          .insertInto('student_learning_accounts')
          .values({
            child_id: child.id,
            username: `hs28f${index}`,
            password_hash: 'khong-dung',
            issued_at: new Date(),
            issued_by_name: 'Hiệu trưởng thử',
            identity_user_id: randomUUID(),
          })
          .execute();
      }
    }
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: 'ME', name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    for (const [index, user] of [parent, otherParent].entries()) {
      const guardian = await schoolYear
        .insertInto('guardians')
        .values({ full_name: `Mẹ của ${names[index]}`, phone: `090128100${index}`, user_id: user.userId })
        .returning('id')
        .executeTakeFirstOrThrow();
      await schoolYear
        .insertInto('child_guardians')
        .values({
          child_id: children[index] ?? '',
          guardian_id: guardian.id,
          relationship_item_id: relationship.id,
          is_primary: true,
        })
        .execute();
    }
    const spaces = rows((await api('GET', '/learning/spaces', teacher.accessToken)).body);
    const spaceId = spaces[0]?.id as string;
    assert.equal(
      (await api('PATCH', `/learning/spaces/${spaceId}`, teacher.accessToken, { visible_to_students: true })).status,
      200,
    );
    classLogId = (
      await schoolYear
        .insertInto('class_logs')
        .values({
          class_id: classId,
          lesson_date: '2026-11-02',
          period_no: 2,
          subject_id: subjects['THCS-TOAN'] ?? '',
          teacher_user_id: teacher.userId,
          teacher_name: 'Giáo viên thử',
          lesson_title: 'Cộng hai số hữu tỉ',
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
  });

  after(async () => {
    await schoolYear?.destroy();
    await environment?.close();
  });

  let first = '';

  it('CT-28f-5: giáo viên giao bài về nhà từ tiết của sổ đầu bài; hạn mặc định; soạn tiếp vẫn là bài về nhà; giáo viên khác 403', async () => {
    assert.equal(
      (await api('POST', `/learning/homework/class-logs/${classLogId}`, otherTeacher.accessToken, {})).status,
      403,
    );
    const empty = await api('GET', `/learning/homework/class-logs/${classLogId}`, teacher.accessToken);
    assert.equal(empty.status, 200, JSON.stringify(empty.body));
    assert.equal(empty.body.can_assign, true);
    assert.deepEqual(empty.body.items, []);
    const made = await homeworkFromLesson('Bài 1 trang 12', 20);
    first = made.activityId;
    // Lớp chưa có thời khoá biểu: hạn là 7 giờ sáng sau 7 ngày kể từ ngày của tiết
    assert.equal(made.created.due_basis, 'default');
    assert.equal(new Date(made.created.due_at as string).toISOString(), '2026-11-09T00:00:00.000Z');
    const editor = await api('GET', `/learning/activities/${first}/assignment`, teacher.accessToken);
    const assignment = editor.body.assignment as Record<string, unknown>;
    assert.equal(assignment.context, 'homework', 'màn hình soạn không gửi ngữ cảnh thì giữ bài về nhà');
    assert.equal(assignment.class_log_id, classLogId);
    assert.equal(assignment.group_no, 0);
    const listed = await api('GET', `/learning/homework/class-logs/${classLogId}`, teacher.accessToken);
    assert.deepEqual(
      rows(listed.body.items).map((item) => [item.activity_id, item.released]),
      [[first, false]],
    );
  });

  it('CT-28f-6: Ban Giám hiệu đặt quy tắc; cảnh báo cần xác nhận; chặn chỉ phát hành khi Ban Giám hiệu cho vượt có lý do; lịch khối lượng', async () => {
    assert.equal((await api('GET', '/learning/homework/policies', teacher.accessToken)).status, 403);
    const none = await api('POST', `/learning/activities/${first}/assignment/release`, teacher.accessToken, {});
    assert.equal(none.status, 200, 'trường chưa đặt quy tắc thì không chặn');
    assert.deepEqual(none.body.policy_warnings, []);
    const warn = await api('PUT', '/learning/homework/policies', principal.accessToken, {
      school_level: 'THCS',
      grade: 7,
      max_items_per_day: 1,
      max_minutes_per_day: 30,
      action: 'warn',
      basis: 'Quy định thử của trường',
    });
    assert.equal(warn.status, 200, JSON.stringify(warn.body));
    const second = await homeworkFromLesson('Bài 2 trang 13', 15);
    const workload = await api(
      'GET',
      `/learning/homework/activities/${second.activityId}/workload`,
      teacher.accessToken,
    );
    assert.equal(workload.status, 200, JSON.stringify(workload.body));
    const check = workload.body.check as { action: string; violations: string[] };
    assert.equal(check.action, 'warn');
    assert.equal(check.violations.length, 2, check.violations.join(' | '));
    const day = rows(workload.body.days).find((item) => item.date === '2026-11-09');
    assert.equal(day?.count, 1);
    assert.equal((day?.items as unknown[]).length, 2);
    const warned = await api(
      'POST',
      `/learning/activities/${second.activityId}/assignment/release`,
      teacher.accessToken,
      {},
    );
    assert.equal(warned.status, 422, JSON.stringify(warned.body));
    assert.equal(errorOf(warned.body).details?.[0]?.field, 'confirm_warnings');
    const confirmed = await api(
      'POST',
      `/learning/activities/${second.activityId}/assignment/release`,
      teacher.accessToken,
      {
        confirm_warnings: true,
      },
    );
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
    assert.equal((confirmed.body.policy_warnings as string[]).length, 2);

    assert.equal(
      (
        await api('PUT', '/learning/homework/policies', principal.accessToken, {
          school_level: 'THCS',
          grade: 7,
          max_items_per_day: 2,
          action: 'block',
        })
      ).status,
      200,
    );
    const third = await homeworkFromLesson('Bài 3 trang 14');
    const blocked = await api(
      'POST',
      `/learning/activities/${third.activityId}/assignment/release`,
      teacher.accessToken,
      {
        confirm_warnings: true,
      },
    );
    assert.equal(blocked.status, 422, JSON.stringify(blocked.body));
    assert.equal(errorOf(blocked.body).details?.[0]?.field, 'override_reason');
    assert.equal(
      (
        await api('POST', `/learning/homework/activities/${third.activityId}/override`, teacher.accessToken, {
          reason: 'Tự cho vượt',
        })
      ).status,
      403,
    );
    const approved = await api(
      'POST',
      `/learning/homework/activities/${third.activityId}/override`,
      principal.accessToken,
      {
        reason: 'Ôn tập trước kiểm tra giữa kỳ',
      },
    );
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    const released = await api(
      'POST',
      `/learning/activities/${third.activityId}/assignment/release`,
      teacher.accessToken,
      {},
    );
    assert.equal(released.status, 200, JSON.stringify(released.body));
    const stored = await schoolYear
      .selectFrom('assignments')
      .select(['policy_override_reason', 'policy_override_by'])
      .where('activity_id', '=', third.activityId)
      .executeTakeFirstOrThrow();
    assert.equal(stored.policy_override_reason, 'Ôn tập trước kiểm tra giữa kỳ');
    assert.equal(stored.policy_override_by, principal.userId);

    const classView = await api(
      'GET',
      `/learning/homework/workload?class_id=${classId}&from=2026-11-06`,
      principal.accessToken,
    );
    assert.equal(classView.status, 200, JSON.stringify(classView.body));
    const ninth = rows(classView.body.days).find((item) => item.date === '2026-11-09');
    assert.equal(ninth?.count, 3);
    assert.equal(ninth?.minutes, 35);
    assert.equal(
      (await api('GET', `/learning/homework/workload?class_id=${classId}`, otherTeacher.accessToken)).status,
      403,
    );
    const policies = await api('GET', '/learning/homework/policies', principal.accessToken);
    assert.equal(rows(policies.body.policies).length, 1);
    assert.equal(policies.body.reminder_time, '19:00');
  });

  it('CT-28f-7: phụ huynh xem bài của con, đã xem cùng con, nộp thay khi con chưa có tài khoản; con có tài khoản thì không nộp thay', async () => {
    const [an, binh] = children as [string, string];
    const list = await api('GET', `/learning/children/${an}/homework`, parent.accessToken);
    assert.equal(list.status, 200, JSON.stringify(list.body));
    assert.equal(list.body.has_student_account, false);
    const items = rows(list.body.items);
    assert.equal(items.length, 3);
    const mine = items.find((item) => item.activity_id === first);
    assert.equal(mine?.status, 'pending');
    assert.equal(mine?.can_proxy, true);
    assert.ok(mine?.subject_name, 'có tên môn');
    assert.equal((await api('GET', `/learning/children/${an}/homework`, otherParent.accessToken)).status, 403);

    const acknowledged = await api(
      'POST',
      `/learning/children/${an}/homework/${first}/acknowledge`,
      parent.accessToken,
    );
    assert.equal(acknowledged.status, 200, JSON.stringify(acknowledged.body));
    const again = await api('GET', `/learning/children/${an}/homework`, parent.accessToken);
    assert.equal(rows(again.body.items).find((item) => item.activity_id === first)?.acknowledged_by_me, true);

    const view = await api('GET', `/learning/children/${an}/homework/${first}`, parent.accessToken);
    assert.equal(view.status, 200, JSON.stringify(view.body));
    assert.equal(view.body.can_proxy, true);
    const viewItems = rows(view.body.items);
    const essay = viewItems.find((item) => item.kind === 'essay')?.id as string;
    const photo = viewItems.find((item) => item.kind === 'upload')?.id as string;
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
    const uploaded = await upload(
      `/learning/children/${an}/homework/${first}/items/${photo}/files`,
      parent.accessToken,
      png,
      'vo-bai-lam.png',
    );
    assert.equal(uploaded.status, 201, JSON.stringify(uploaded.body));
    const submitted = await api('POST', `/learning/children/${an}/homework/${first}/submit`, parent.accessToken, {
      answers: { [essay]: { text: 'Con làm theo hướng dẫn của cô' } },
    });
    assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
    const row = await schoolYear
      .selectFrom('assignment_submissions')
      .select(['submitted_by', 'submitted_by_kind', 'status'])
      .where('id', '=', submitted.body.id as string)
      .executeTakeFirstOrThrow();
    assert.deepEqual(row, { submitted_by: parent.userId, submitted_by_kind: 'guardian', status: 'submitted' });
    const comment = await api(
      'POST',
      `/learning/children/${an}/homework/${first}/submissions/${submitted.body.id as string}/comments`,
      parent.accessToken,
      { body: 'Con làm bài này mất khoảng 25 phút' },
    );
    assert.equal(comment.status, 201, JSON.stringify(comment.body));
    assert.equal(comment.body.author_kind, 'guardian');
    const after = await api('GET', `/learning/children/${an}/homework`, parent.accessToken);
    const done = rows(after.body.items).find((item) => item.activity_id === first);
    assert.equal(done?.status, 'submitted');
    assert.equal(done?.submitted_by_kind, 'guardian');

    const blocked = await api('GET', `/learning/children/${binh}/homework/${first}`, otherParent.accessToken);
    assert.equal(blocked.status, 200, JSON.stringify(blocked.body));
    assert.equal(blocked.body.can_proxy, false);
    assert.equal(blocked.body.proxy_blocked_reason, 'Con đã có tài khoản học, con tự nộp bài');
    const refused = await api(
      'POST',
      `/learning/children/${binh}/homework/${first}/submit`,
      otherParent.accessToken,
      {},
    );
    assert.equal(refused.status, 422);
    assert.equal((await api('GET', `/learning/children/${an}/homework/${first}`, otherParent.accessToken)).status, 403);
  });

  it('CT-28f-8: học sinh vắng có phép ngày giao được gợi ý gia hạn; giáo viên miễn thì không gợi ý nữa', async () => {
    const chi = children[2] ?? '';
    const releasedOn = await schoolYear
      .selectFrom('assignments')
      .select('released_at')
      .where('activity_id', '=', first)
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('absence_records')
      .values({
        child_id: chi,
        org_unit_id: unitId,
        absence_date: vietnamDate(releasedOn.released_at ?? new Date()),
        reason: 'Ốm',
        is_advised: true,
        advised_at: new Date(),
        source: 'parent',
        reported_by: otherParent.userId,
      })
      .execute();
    const suggested = await api('GET', `/learning/homework/activities/${first}/absences`, teacher.accessToken);
    assert.equal(suggested.status, 200, JSON.stringify(suggested.body));
    assert.deepEqual(
      rows(suggested.body.students).map((item) => [item.child_id, item.suggestion]),
      [[chi, 'extend']],
    );
    assert.equal(
      (
        await api('PATCH', `/learning/activities/${first}/assignment/recipients/${chi}`, teacher.accessToken, {
          excused: true,
          excuse_reason: 'Ốm cả tuần',
        })
      ).status,
      200,
    );
    const after = await api('GET', `/learning/homework/activities/${first}/absences`, teacher.accessToken);
    assert.equal(rows(after.body.students)[0]?.suggestion, null);
  });

  it('CT-28f-9: nhắc bài về nhà: giờ yên lặng không gửi, gộp nhiều bài một em, không nhắc lại, phụ huynh có tin đẩy', async () => {
    const service = environment.api.get(HomeworkService);
    const clock = environment.api.get(Clock);
    const realNow = clock.now.bind(clock);
    // Ba bài phát hành 10:00 ngày 8/11 (giờ Việt Nam), hạn 7:00 ngày 9/11
    await schoolYear
      .updateTable('assignments')
      .set({ released_at: new Date('2026-11-08T03:00:00Z') })
      .where('context', '=', 'homework')
      .execute();
    const run = async (at: string) => {
      clock.now = () => new Date(at);
      try {
        return await service.sendReminders();
      } finally {
        clock.now = realNow;
      }
    };
    const notifications = async (template: string) =>
      schoolYear
        .selectFrom('notifications')
        .innerJoin('notification_recipients', 'notification_recipients.notification_id', 'notifications.id')
        .select([
          'notifications.title',
          'notifications.target_id',
          'notification_recipients.user_id',
          'notification_recipients.channel',
        ])
        .where('notifications.template_code', '=', template)
        .execute();
    // 22:00 ngày 8/11: giờ yên lặng
    assert.equal(await run('2026-11-08T15:00:00Z'), 0);
    // 18:00 ngày 8/11: nhắc đã giao, mỗi em một thông báo gộp ba bài (Chi được miễn bài đầu nên hai bài)
    assert.equal(await run('2026-11-08T11:00:00Z'), 3);
    const assigned = await notifications('homework_assigned');
    const an = assigned.filter((row) => row.target_id === children[0]);
    assert.ok(an.some((row) => row.title === 'Học sinh An có 3 bài về nhà mới'));
    assert.deepEqual(
      an.map((row) => row.channel).sort(),
      ['in_app', 'push'],
      'An chưa có tài khoản học: chỉ phụ huynh nhận',
    );
    assert.equal(
      assigned.filter((row) => row.target_id === children[1]).length,
      3,
      'phụ huynh hai kênh, Bình trong ứng dụng',
    );
    assert.ok(assigned.some((row) => row.title === 'Học sinh Chi có 2 bài về nhà mới'));
    // 19:30 ngày 8/11: sắp đến hạn, An đã nộp bài đầu nên còn hai bài; lượt chạy lại không gửi trùng
    assert.equal(await run('2026-11-08T12:30:00Z'), 3);
    assert.equal(await run('2026-11-08T12:45:00Z'), 0);
    const dueSoon = await notifications('homework_due_soon');
    assert.ok(dueSoon.some((row) => row.title === 'Học sinh An có 2 bài về nhà đến hạn ngày mai'));
    // 8:00 ngày 9/11: chưa nộp đã quá hạn
    assert.equal(await run('2026-11-09T01:00:00Z'), 3);
    const missing = await notifications('homework_missing');
    assert.ok(missing.some((row) => row.title === 'Học sinh Bình chưa nộp 3 bài về nhà đã quá hạn'));
  });
});
