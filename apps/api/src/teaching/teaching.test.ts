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

// Giảng dạy (DT-10 phần 10g, YCTD-80): lĩnh vực, nhóm, bài học, giáo án hai bước duyệt, thời khóa biểu, lịch hoạt động,
// kế hoạch giảng dạy, tiến độ học tập; kịch bản CT-110
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
const nextMonday = addDays(vietnamToday, 8 - weekday(vietnamToday));
const errorOf = (body: Record<string, unknown>) => (body.error ?? {}) as { code?: string; rule_code?: string };
const list = <Row>(body: unknown) => body as Row[];

describe('Giảng dạy: bài học, giáo án, thời khóa biểu, tiến độ', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let academicYearId = '';
  const units: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const classes: Record<string, string> = {};
  const children: Record<string, string> = {};
  const lessons: Record<string, string> = {};
  const domains: Record<string, string> = {};

  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);

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
    users.leader = await environment.loginAs('VT-17', unitA);
    users.otherLeader = await environment.loginAs('VT-17', units['ĐT-B1'] ?? null);
    users.homeroom = await environment.loginAs('VT-07', unitA);
    users.otherTeacher = await environment.loginAs('VT-07', unitA);
    users.subjectTeacher = await environment.loginAs('VT-08', unitA);
    users.parent = await environment.loginAs('VT-14', unitA);

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
    for (const [teacher, classCode, role] of [
      ['homeroom', 'MAM-1', 'homeroom'],
      ['otherTeacher', 'MAM-2', 'homeroom'],
      ['subjectTeacher', 'MAM-1', 'subject'],
      ['subjectTeacher', 'MAM-2', 'subject'],
    ] as const) {
      await schoolYear
        .insertInto('class_staff_assignments')
        .values({
          class_id: classes[classCode] ?? '',
          staff_user_id: users[teacher]?.userId ?? '',
          staff_name: teacher,
          assignment_role: role,
          subject_name: role === 'subject' ? 'Âm nhạc' : null,
          from_date: addDays(vietnamToday, -60),
        })
        .execute();
    }
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: 'ME', name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    for (const [key, classCode] of [
      ['A', 'MAM-1'],
      ['C', 'MAM-2'],
    ] as const) {
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitA,
          full_name: `Trẻ ${key}`,
          dob: addDays(vietnamToday, -4 * 365),
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
    }
    const guardian = await schoolYear
      .insertInto('guardians')
      .values({ full_name: 'Mẹ A', phone: '0901234567', user_id: users.parent?.userId ?? null })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('child_guardians')
      .values({
        child_id: children.A ?? '',
        guardian_id: guardian.id,
        relationship_item_id: relationship.id,
        is_primary: true,
      })
      .execute();
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('P03-08, CT-110: lọc bài học theo lĩnh vực chỉ trả bài học thuộc lĩnh vực; bài học riêng chỉ người soạn thấy', async () => {
    for (const name of ['Phát triển nhận thức', 'Phát triển ngôn ngữ']) {
      const created = await api('POST', '/lesson-domains', token('manager'), { org_unit_id: units['ĐT-A1'], name });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      domains[name] = created.body.id as string;
    }
    const duplicate = await api('POST', '/lesson-domains', token('manager'), {
      org_unit_id: units['ĐT-A1'],
      name: 'Phát triển nhận thức',
    });
    assert.equal(duplicate.status, 409);
    assert.equal(
      (await api('POST', '/lesson-domains', token('manager'), { org_unit_id: units['ĐT-B1'], name: 'Khác' })).status,
      403,
    );
    const group = await api('POST', '/lesson-groups', token('homeroom'), {
      domain_id: domains['Phát triển nhận thức'],
      name: 'Làm quen với toán',
    });
    assert.equal(group.status, 201, JSON.stringify(group.body));
    const theme = await api('POST', '/themes', token('manager'), {
      org_unit_id: units['ĐT-A1'],
      name: 'Trường mầm non của bé',
      start_date: vietnamToday,
      end_date: addDays(vietnamToday, 30),
    });
    assert.equal(theme.status, 201, JSON.stringify(theme.body));

    const lesson = (body: Record<string, unknown>, accessToken = token('homeroom')) =>
      api('POST', '/lessons', accessToken, { objectives: 'Trẻ nhận biết', ...body });
    const counting = await lesson({
      name: 'Đếm đến 5',
      lesson_group_id: group.body.id,
      theme_id: theme.body.id,
      is_shared: true,
    });
    assert.equal(counting.status, 201, JSON.stringify(counting.body));
    assert.equal(counting.body.domain_id, domains['Phát triển nhận thức']);
    lessons.counting = counting.body.id as string;
    const poem = await lesson({ name: 'Thơ Bạn mới', domain_id: domains['Phát triển ngôn ngữ'] });
    assert.equal(poem.status, 201);
    lessons.poem = poem.body.id as string;
    lessons.free = (await lesson({ name: 'Chơi tự do' })).body.id as string;
    lessons.otherPrivate = (await lesson({ name: 'Bài riêng của cô khác' }, token('otherTeacher'))).body.id as string;
    const mismatch = await lesson({
      name: 'Sai nhóm',
      domain_id: domains['Phát triển ngôn ngữ'],
      lesson_group_id: group.body.id,
    });
    assert.equal(mismatch.status, 400);
    assert.equal((await lesson({ name: 'Không có quyền' }, token('manager'))).status, 403);

    const filtered = await api('GET', `/lessons?domain_id=${domains['Phát triển nhận thức']}`, token('manager'));
    assert.equal(filtered.status, 200, JSON.stringify(filtered.body));
    const names = list<{ name: string; domain_id: string }>(filtered.body);
    assert.deepEqual(
      names.map((row) => row.name),
      ['Đếm đến 5'],
    );
    assert.ok(names.every((row) => row.domain_id === domains['Phát triển nhận thức']));
    const otherView = list<{ name: string }>((await api('GET', '/lessons', token('otherTeacher'))).body).map(
      (row) => row.name,
    );
    assert.ok(otherView.includes('Đếm đến 5'));
    assert.ok(!otherView.includes('Thơ Bạn mới'));
    assert.equal(list((await api('GET', '/lessons', token('manager'))).body).length, 4);
    assert.equal((await api('GET', '/lessons', token('parent'))).status, 403);
    assert.equal(
      (await api('PATCH', `/lessons/${lessons.poem}`, token('otherTeacher'), { name: 'Sửa trộm' })).status,
      403,
    );
    const shared = await api('PATCH', `/lessons/${lessons.poem}`, token('homeroom'), { is_shared: true });
    assert.equal(shared.status, 200, JSON.stringify(shared.body));
  });

  it('P03-02: giáo viên soạn và gửi duyệt; tổ trưởng trả lại kèm góp ý, duyệt trước; quản lý đơn vị duyệt sau và công bố', async () => {
    const planInput = {
      lesson_id: lessons.counting,
      class_id: classes['MAM-1'],
      planned_date: addDays(vietnamToday, 2),
      activities: 'Ổn định lớp; đếm đồ chơi; trò chơi tìm số',
      duration_minutes: 30,
    };
    assert.equal((await api('POST', '/lesson-plans', token('otherTeacher'), planInput)).status, 403);
    assert.equal(
      (await api('POST', '/lesson-plans', token('homeroom'), { ...planInput, lesson_id: lessons.otherPrivate })).status,
      400,
    );
    const created = await api('POST', '/lesson-plans', token('homeroom'), planInput);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.status, 'draft');
    const planId = created.body.id as string;
    assert.equal((await api('POST', `/lesson-plans/${planId}/approve`, token('leader'))).status, 422);

    const submitted = await api('POST', `/lesson-plans/${planId}/submit`, token('homeroom'));
    assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
    assert.equal(submitted.body.status, 'submitted');
    const queued = await schoolYear
      .selectFrom('notification_recipients')
      .innerJoin('notifications', 'notifications.id', 'notification_recipients.notification_id')
      .select('notification_recipients.role_code')
      .where('notifications.target_id', '=', planId)
      .execute();
    assert.ok(queued.some((row) => row.role_code === 'VT-17'));

    const pending = list<{ id: string }>((await api('GET', '/lesson-plans?view=review', token('leader'))).body);
    assert.deepEqual(
      pending.map((row) => row.id),
      [planId],
    );
    assert.equal((await api('POST', `/lesson-plans/${planId}/approve`, token('otherLeader'))).status, 403);
    assert.equal((await api('POST', `/lesson-plans/${planId}/reject`, token('leader'), {})).status, 400);
    const returned = await api('POST', `/lesson-plans/${planId}/reject`, token('leader'), {
      comment: 'Bổ sung phần trò chơi củng cố',
    });
    assert.equal(returned.status, 200, JSON.stringify(returned.body));
    assert.equal(returned.body.status, 'returned');
    assert.equal(returned.body.review_comment, 'Bổ sung phần trò chơi củng cố');

    const edited = await api('PATCH', `/lesson-plans/${planId}`, token('homeroom'), {
      activities: 'Ổn định lớp; đếm đồ chơi; trò chơi tìm số; củng cố bằng trò chơi về đúng nhà',
    });
    assert.equal(edited.status, 200, JSON.stringify(edited.body));
    assert.equal((await api('POST', `/lesson-plans/${planId}/submit`, token('homeroom'))).status, 200);
    const leaderApproved = await api('POST', `/lesson-plans/${planId}/approve`, token('leader'), {});
    assert.equal(leaderApproved.status, 200, JSON.stringify(leaderApproved.body));
    assert.equal(leaderApproved.body.status, 'leader_approved');
    const again = await api('POST', `/lesson-plans/${planId}/approve`, token('leader'), {});
    assert.equal(again.status, 422);
    assert.equal(errorOf(again.body).rule_code, 'P03-02');
    const approved = await api('POST', `/lesson-plans/${planId}/approve`, token('manager'), {});
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    assert.equal(approved.body.status, 'approved');
    assert.equal(
      (await api('PATCH', `/lesson-plans/${planId}`, token('homeroom'), { duration_minutes: 40 })).status,
      422,
    );

    const detail = await api('GET', `/lesson-plans/${planId}`, token('leader'));
    assert.equal(detail.status, 200);
    const reviews = detail.body.reviews as Array<{ stage: string; decision: string }>;
    assert.deepEqual(
      reviews.map((row) => `${row.stage}:${row.decision}`),
      ['leader:returned', 'leader:approved', 'manager:approved'],
    );
    assert.equal(list((await api('GET', '/lesson-plans?view=review', token('leader'))).body).length, 0);
    const mine = list<{ status: string }>((await api('GET', '/lesson-plans?view=mine', token('homeroom'))).body);
    assert.deepEqual(
      mine.map((row) => row.status),
      ['approved'],
    );
    assert.equal((await api('GET', `/lesson-plans?class_id=${classes['MAM-1']}`, token('parent'))).status, 403);
  });

  it('P03-04: thời khóa biểu theo lớp không trùng khung giờ; giáo viên không trùng giờ ở lớp khác; phụ huynh chỉ thấy bản công bố', async () => {
    const slot = (
      weekdayNo: number,
      period: number,
      start: string,
      end: string,
      extra: Record<string, unknown> = {},
    ) => ({
      weekday: weekdayNo,
      period_no: period,
      start_time: start,
      end_time: end,
      activity_name: `Tiết ${period}`,
      ...extra,
    });
    const path = `/classes/${classes['MAM-1']}/timetable`;
    const overlapping = await api('PUT', path, token('homeroom'), {
      effective_from: nextMonday,
      slots: [slot(1, 1, '08:00', '08:30'), slot(1, 2, '08:20', '08:50')],
    });
    assert.equal(overlapping.status, 422, JSON.stringify(overlapping.body));
    assert.equal(errorOf(overlapping.body).rule_code, 'P03-04');
    assert.equal(
      (await api('PUT', path, token('homeroom'), { effective_from: addDays(nextMonday, 1), slots: [] })).status,
      400,
    );
    assert.equal(
      (
        await api('PUT', path, token('otherTeacher'), {
          effective_from: nextMonday,
          slots: [slot(1, 1, '08:00', '08:30')],
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await api('PUT', path, token('subjectTeacher'), {
          effective_from: nextMonday,
          slots: [slot(1, 1, '08:00', '08:30')],
        })
      ).status,
      403,
    );
    const saved = await api('PUT', path, token('homeroom'), {
      effective_from: nextMonday,
      slots: [
        slot(1, 1, '08:00', '08:30'),
        slot(1, 2, '09:00', '09:30', { teacher_id: users.subjectTeacher?.userId, activity_name: 'Âm nhạc' }),
        slot(2, 1, '08:00', '08:30'),
      ],
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.status, 'draft');
    assert.equal((saved.body.slots as unknown[]).length, 3);

    const clash = await api('PUT', `/classes/${classes['MAM-2']}/timetable`, token('otherTeacher'), {
      effective_from: nextMonday,
      slots: [slot(1, 1, '09:15', '09:45', { teacher_id: users.subjectTeacher?.userId })],
    });
    assert.equal(clash.status, 422, JSON.stringify(clash.body));
    assert.equal(
      (
        await api('PUT', `/classes/${classes['MAM-2']}/timetable`, token('otherTeacher'), {
          effective_from: nextMonday,
          slots: [slot(1, 1, '10:00', '10:30', { teacher_id: users.subjectTeacher?.userId })],
        })
      ).status,
      200,
    );

    const parentBefore = await api('GET', `${path}?week=${nextMonday}`, token('parent'));
    assert.equal(parentBefore.status, 200, JSON.stringify(parentBefore.body));
    assert.equal((parentBefore.body.slots as unknown[]).length, 0);
    assert.equal(
      (await api('GET', `/classes/${classes['MAM-2']}/timetable?week=${nextMonday}`, token('parent'))).status,
      403,
    );
    const published = await api('POST', `${path}/publish`, token('homeroom'), { effective_from: nextMonday });
    assert.equal(published.status, 200, JSON.stringify(published.body));
    const parentAfter = await api('GET', `${path}?week=${addDays(nextMonday, 3)}`, token('parent'));
    assert.equal((parentAfter.body.slots as unknown[]).length, 3);
    assert.equal(parentAfter.body.status, 'published');
    const locked = await api('PUT', path, token('homeroom'), { effective_from: nextMonday, slots: [] });
    assert.equal(locked.status, 422);
  });

  it('P03-07: lịch hoạt động lớp không trùng giờ; công bố cho phụ huynh; hủy hoạt động', async () => {
    const tomorrow = addDays(vietnamToday, 1);
    const path = `/classes/${classes['MAM-1']}/activity-schedules`;
    const created = await api('POST', path, token('homeroom'), {
      activity_date: tomorrow,
      start_time: '09:00',
      end_time: '10:00',
      activity_name: 'Tham quan vườn rau',
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const overlap = await api('POST', path, token('homeroom'), {
      activity_date: tomorrow,
      start_time: '09:30',
      end_time: '10:30',
      activity_name: 'Trùng giờ',
    });
    assert.equal(overlap.status, 422);
    assert.equal(
      (
        await api('POST', path, token('homeroom'), {
          activity_date: addDays(vietnamToday, -1),
          start_time: '09:00',
          end_time: '10:00',
          activity_name: 'Hôm qua',
        })
      ).status,
      422,
    );
    assert.equal(list((await api('GET', path, token('parent'))).body).length, 0);
    const published = await api('POST', `${path}/publish`, token('homeroom'), { from: vietnamToday, to: tomorrow });
    assert.equal(published.status, 200, JSON.stringify(published.body));
    assert.equal(published.body.published_count, 1);
    const seen = list<{ activity_name: string }>((await api('GET', path, token('parent'))).body);
    assert.deepEqual(
      seen.map((row) => row.activity_name),
      ['Tham quan vườn rau'],
    );
    assert.equal(
      (await api('PATCH', `/class-activity-schedules/${created.body.id}`, token('homeroom'), { activity_name: 'Đổi' }))
        .status,
      422,
    );
    const cancelled = await api('PATCH', `/class-activity-schedules/${created.body.id}`, token('homeroom'), {
      status: 'cancelled',
    });
    assert.equal(cancelled.status, 200);
    assert.equal(list((await api('GET', path, token('parent'))).body).length, 0);
  });

  it('P03-05: kế hoạch giảng dạy theo lớp và kỳ; trùng kỳ bị từ chối; tổ trưởng xem được', async () => {
    const input = {
      class_id: classes['MAM-1'],
      period_type: 'term',
      period_value: 'HK1',
      objectives: 'Trẻ phát triển toàn diện',
      content: 'Chủ đề trường mầm non, gia đình, nghề nghiệp',
    };
    const created = await api('POST', '/teaching-plans', token('homeroom'), input);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal((await api('POST', '/teaching-plans', token('manager'), input)).status, 409);
    assert.equal(
      (await api('POST', '/teaching-plans', token('homeroom'), { ...input, period_value: 'HK3' })).status,
      400,
    );
    const updated = await api('PATCH', `/teaching-plans/${created.body.id}`, token('homeroom'), {
      status: 'in_progress',
      progress_note: 'Đã xong chủ đề 1',
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.status, 'in_progress');
    const viewed = await api('GET', `/teaching-plans?class_id=${classes['MAM-1']}`, token('leader'));
    assert.equal(viewed.status, 200);
    assert.equal(list(viewed.body).length, 1);
    assert.equal((await api('GET', `/teaching-plans?class_id=${classes['MAM-1']}`, token('otherLeader'))).status, 403);
  });

  it('P03-06: giáo viên lớp được phân công ghi tiến độ; công bố thì phụ huynh xem được và không sửa được nữa', async () => {
    const path = `/children/${children.A}/progress`;
    const body = {
      period_type: 'term',
      period_value: 'HK1',
      items: [
        { indicator_code: 'Đếm được đến 5', level: 'achieved', domain_id: domains['Phát triển nhận thức'] },
        { indicator_code: 'Đọc thuộc bài thơ', level: 'developing', comment: 'Cần luyện thêm' },
      ],
    };
    assert.equal((await api('POST', path, token('otherTeacher'), body)).status, 403);
    assert.equal((await api('POST', path, token('subjectTeacher'), body)).status, 403);
    assert.equal((await api('POST', `/children/${children.C}/progress`, token('homeroom'), body)).status, 403);
    assert.equal((await api('POST', path, token('homeroom'), { ...body, items: [] })).status, 400);
    const recorded = await api('POST', path, token('homeroom'), body);
    assert.equal(recorded.status, 200, JSON.stringify(recorded.body));
    assert.equal(list(recorded.body).length, 2);
    const updated = await api('POST', path, token('homeroom'), {
      ...body,
      items: [{ indicator_code: 'Đọc thuộc bài thơ', level: 'achieved' }],
    });
    assert.equal(
      list<{ indicator_code: string; level: string }>(updated.body).find(
        (row) => row.indicator_code === 'Đọc thuộc bài thơ',
      )?.level,
      'achieved',
    );
    assert.equal(list((await api('GET', path, token('parent'))).body).length, 0);
    assert.equal((await api('GET', path, token('leader'))).status, 403);
    const published = await api('POST', `${path}/publish`, token('homeroom'), {
      period_type: 'term',
      period_value: 'HK1',
    });
    assert.equal(published.status, 200, JSON.stringify(published.body));
    assert.equal(published.body.published_count, 2);
    assert.equal(list((await api('GET', `${path}?period_type=term&period_value=HK1`, token('parent'))).body).length, 2);
    const locked = await api('POST', path, token('homeroom'), body);
    assert.equal(locked.status, 422);
    assert.equal(errorOf(locked.body).rule_code, 'P03-06');

    const learning = await api('GET', `/children/${children.A}/learning`, token('parent'));
    assert.equal(learning.status, 200, JSON.stringify(learning.body));
    assert.equal(learning.body.class_name, 'MAM-1');
    assert.equal((learning.body.progress as unknown[]).length, 2);
    assert.equal((await api('GET', `/children/${children.C}/learning`, token('parent'))).status, 403);
  });
});
