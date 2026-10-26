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
} from '../test-support.js';

// Điểm cuối của lõi hệ thống quản lý học tập (DT-28 phần 28b, YCTD-272): lớp học trực tuyến tự sinh từ phân công giảng dạy,
// chương, hoạt động, điều kiện mở, kết quả, tiến độ, kế hoạch theo tuần, khoá học mẫu qua duyệt rồi đẩy xuống lớp, quyết định
// dạy thay thế và nội quy theo Thông tư 09/2021/TT-BGDĐT, phụ huynh xem việc học của con. Người, lớp, môn là dữ liệu giả
describe('Điểm cuối lõi hệ thống quản lý học tập', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let mathTeacher: LoggedInUser;
  let otherTeacher: LoggedInUser;
  let parent: LoggedInUser;
  let unitId = '';
  let academicYearId = '';
  const classes: Record<string, string> = {};
  const subjects: Record<string, string> = {};
  const children: string[] = [];
  const url = (path: string) => `${environment.baseUrl}${path}`;
  const api = (method: string, path: string, token: string, body?: unknown) => sendJson(method, url(path), token, body);
  const list = (body: unknown) => body as unknown as Array<Record<string, unknown>>;
  const errorOf = (body: Record<string, unknown>) => (body.error ?? {}) as { code?: string };

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
        code: 'THCS-28B',
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
    for (const row of list((await api('GET', '/subjects?school_level=THCS', principal.accessToken)).body)) {
      subjects[row.code as string] = row.id as string;
    }
    mathTeacher = await environment.loginAs('VT-08', unitId);
    otherTeacher = await environment.loginAs('VT-08', unitId);
    parent = await environment.loginAs('VT-14', unitId);
    for (const code of ['7A', '7B']) {
      classes[code] = (
        await schoolYear
          .insertInto('classes')
          .values({
            org_unit_id: unitId,
            academic_year_id: academicYearId,
            code,
            name: `Lớp ${code}`,
            grade_level: 'K7',
            school_level: 'THCS',
            max_size: 45,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
      const assigned = await api('POST', `/classes/${classes[code]}/staff-assignments`, principal.accessToken, {
        staff_user_id: mathTeacher.userId,
        assignment_role: 'subject',
        subject_id: subjects['THCS-TOAN'],
      });
      assert.equal(assigned.status, 201, JSON.stringify(assigned.body));
    }
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: 'ME', name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    for (const [index, name] of ['Học sinh An', 'Học sinh Bình'].entries()) {
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitId,
          full_name: name,
          dob: '2014-03-01',
          gender: index === 0 ? 'female' : 'male',
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
        .values({ child_id: child.id, class_id: classes['7A'] ?? '', from_date: '2026-09-05', order_number: index + 1 })
        .execute();
    }
    const guardian = await schoolYear
      .insertInto('guardians')
      .values({ full_name: 'Mẹ của An', phone: '0901280001', user_id: parent.userId })
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
  });

  after(async () => {
    await schoolYear?.destroy();
    await environment?.close();
  });

  let spaceA = '';
  let spaceB = '';
  let sectionId = '';
  let readingId = '';
  let practiceId = '';

  it('CT-28b-8: giáo viên mở danh sách thấy lớp học trực tuyến tự sinh từ phân công; giáo viên khác không thấy, không mở được', async () => {
    const mine = await api('GET', '/learning/spaces', mathTeacher.accessToken);
    assert.equal(mine.status, 200, JSON.stringify(mine.body));
    const spaces = list(mine.body);
    assert.deepEqual(
      spaces.map((space) => space.title),
      ['Toán - Lớp 7A', 'Toán - Lớp 7B'],
    );
    assert.equal(spaces[0]?.visible_to_students, false, 'lớp tự sinh ẩn với học sinh đến khi giáo viên mở (GD-154)');
    spaceA = spaces[0]?.id as string;
    spaceB = spaces[1]?.id as string;
    const again = await api('POST', '/learning/spaces/sync', principal.accessToken);
    assert.equal(again.status, 200);
    assert.equal(again.body.created, 0, 'đồng bộ lại không tạo trùng');
    assert.equal(list((await api('GET', '/learning/spaces', otherTeacher.accessToken)).body).length, 0);
    assert.equal((await api('GET', `/learning/spaces/${spaceA}`, otherTeacher.accessToken)).status, 403);
    assert.equal((await api('POST', '/learning/spaces/sync', mathTeacher.accessToken)).status, 403);
    const all = await api('GET', '/learning/spaces?scope=all', principal.accessToken);
    assert.equal(list(all.body).length, 2, 'Ban Giám hiệu thấy mọi lớp');
  });

  it('CT-28b-9: chương, hoạt động trang và liên kết; điều kiện mở trỏ vào hoạt động cùng lớp; học liệu chưa công bố bị chặn', async () => {
    const section = await api('POST', `/learning/spaces/${spaceA}/sections`, mathTeacher.accessToken, {
      title: 'Chương 1. Số hữu tỉ',
      planned_week: 1,
    });
    assert.equal(section.status, 201, JSON.stringify(section.body));
    sectionId = section.body.id as string;
    const reading = await api('POST', `/learning/spaces/${spaceA}/activities`, mathTeacher.accessToken, {
      section_id: sectionId,
      kind: 'page',
      title: 'Đọc: số hữu tỉ là gì',
      settings: { body: 'Số hữu tỉ là số viết được dưới dạng phân số.' },
      due_at: '2026-09-20T17:00:00+07:00',
    });
    assert.equal(reading.status, 201, JSON.stringify(reading.body));
    readingId = reading.body.id as string;
    const practice = await api('POST', `/learning/spaces/${spaceA}/activities`, mathTeacher.accessToken, {
      section_id: sectionId,
      kind: 'link',
      title: 'Luyện tập trên trang của trường',
      settings: { url: 'https://hoc.truong-thu.example/bai-1' },
      open_rules: { mode: 'all', rules: [{ type: 'after_activity', activity_id: readingId }] },
      planned_week: 2,
    });
    assert.equal(practice.status, 201, JSON.stringify(practice.body));
    practiceId = practice.body.id as string;
    const foreign = await api('POST', `/learning/spaces/${spaceB}/activities`, mathTeacher.accessToken, {
      section_id: sectionId,
      kind: 'page',
      title: 'Sai chương',
      settings: { body: 'x' },
    });
    assert.equal(foreign.status, 422, 'chương của lớp khác');
    const crossRule = await api('PATCH', `/learning/activities/${practiceId}`, mathTeacher.accessToken, {
      open_rules: { mode: 'all', rules: [{ type: 'after_activity', activity_id: practiceId }] },
    });
    assert.equal(crossRule.status, 422, 'không trỏ vào chính nó');
    const resource = await api('POST', `/learning/spaces/${spaceA}/activities`, mathTeacher.accessToken, {
      section_id: sectionId,
      kind: 'resource',
      title: 'Video bài giảng',
      settings: { resource_id: randomUUID() },
    });
    assert.equal(resource.status, 422, JSON.stringify(resource.body));
    const unknown = await api('POST', `/learning/spaces/${spaceA}/activities`, mathTeacher.accessToken, {
      section_id: sectionId,
      kind: 'assignment',
      title: 'Bài tập',
    });
    assert.equal(unknown.status, 400, 'loại của phần sau chưa đăng ký');
    assert.equal(
      (
        await api('POST', `/learning/spaces/${spaceA}/sections`, otherTeacher.accessToken, {
          title: 'Không phải lớp mình',
        })
      ).status,
      403,
    );
  });

  it('CT-28b-10: dạy thay thế bị chặn khi chưa có quyết định; Hiệu trưởng quyết định cho lớp 7A thì dùng được, thu hồi được', async () => {
    const blocked = await api('PATCH', `/learning/activities/${readingId}`, mathTeacher.accessToken, {
      teaching_mode: 'replace',
    });
    assert.equal(blocked.status, 422);
    assert.equal(errorOf(blocked.body).code, 'ERR_RULE_VIOLATION');
    const forbidden = await api('POST', '/learning/decisions', mathTeacher.accessToken, {
      decision_no: '01/QĐ-THCS',
      decision_date: '2026-09-10',
      reason: 'Bão',
      starts_on: '2026-09-10',
      ends_on: '2099-09-30',
    });
    assert.equal(forbidden.status, 403);
    const decision = await api('POST', '/learning/decisions', principal.accessToken, {
      decision_no: '01/QĐ-THCS',
      decision_date: '2026-09-10',
      reason: 'Học sinh không đến trường do bão (lý do bất khả kháng)',
      class_ids: [classes['7A']],
      starts_on: '2026-09-10',
      ends_on: '2099-09-30',
    });
    assert.equal(decision.status, 201, JSON.stringify(decision.body));
    const allowed = await api('PATCH', `/learning/activities/${readingId}`, mathTeacher.accessToken, {
      teaching_mode: 'replace',
    });
    assert.equal(allowed.status, 200, JSON.stringify(allowed.body));
    const detailB = await api('GET', `/learning/spaces/${spaceB}`, mathTeacher.accessToken);
    assert.equal(detailB.body.replace_allowed_today, false, 'quyết định chỉ cho lớp 7A');
    const revoked = await api(
      'POST',
      `/learning/decisions/${decision.body.id as string}/revoke`,
      principal.accessToken,
    );
    assert.equal(revoked.status, 200);
    assert.equal(
      (await api('GET', `/learning/spaces/${spaceA}`, mathTeacher.accessToken)).body.replace_allowed_today,
      false,
    );
  });

  it('CT-28b-11: phụ huynh chỉ thấy lớp đã mở và hoạt động đã giao; hoạt động khóa nêu lý do; kết quả của giáo viên mở hoạt động sau', async () => {
    const hidden = await api('GET', `/learning/children/${children[0]}`, parent.accessToken);
    assert.equal(hidden.status, 200);
    assert.deepEqual(hidden.body.spaces, [], 'lớp chưa mở cho học sinh');
    assert.equal(
      (await api('PATCH', `/learning/spaces/${spaceA}`, mathTeacher.accessToken, { visible_to_students: true })).status,
      200,
    );
    for (const id of [readingId, practiceId]) {
      assert.equal((await api('POST', `/learning/activities/${id}/publish`, mathTeacher.accessToken)).status, 200);
    }
    const view = await api('GET', `/learning/children/${children[0]}`, parent.accessToken);
    const space = (view.body.spaces as Array<Record<string, unknown>>)[0];
    assert.equal(space?.title, 'Toán - Lớp 7A');
    const activities = ((space?.sections as Array<Record<string, unknown>>)[0]?.activities ?? []) as Array<
      Record<string, unknown>
    >;
    assert.deepEqual(
      activities.map((activity) => [activity.title, activity.open]),
      [
        ['Đọc: số hữu tỉ là gì', true],
        ['Luyện tập trên trang của trường', false],
      ],
    );
    assert.deepEqual(activities[1]?.locked_reasons, ['Hoàn thành "Đọc: số hữu tỉ là gì" để mở']);
    assert.equal(activities[1]?.instructions, null, 'hoạt động khóa không lộ hướng dẫn');
    assert.equal(
      (await api('GET', `/learning/children/${children[1]}`, parent.accessToken)).status,
      403,
      'phụ huynh không xem được con người khác',
    );
    const marked = await api('POST', `/learning/activities/${readingId}/results`, mathTeacher.accessToken, {
      child_id: children[0],
      status: 'completed',
    });
    assert.equal(marked.status, 200, JSON.stringify(marked.body));
    const after = await api('GET', `/learning/children/${children[0]}`, parent.accessToken);
    const unlocked = ((
      (after.body.spaces as Array<Record<string, unknown>>)[0]?.sections as Array<Record<string, unknown>>
    )[0]?.activities ?? []) as Array<Record<string, unknown>>;
    assert.equal(unlocked[1]?.open, true);
    assert.deepEqual((after.body.spaces as Array<Record<string, unknown>>)[0]?.summary, {
      required: 2,
      done: 1,
      overdue: 0,
      percent: 50,
    });
  });

  it('CT-28b-12: tiến độ lớp, kế hoạch theo tuần, nhật ký học tập; mở riêng cho học sinh có lý do', async () => {
    const progress = await api('GET', `/learning/spaces/${spaceA}/progress`, mathTeacher.accessToken);
    assert.equal(progress.status, 200);
    const students = progress.body.students as Array<Record<string, unknown>>;
    assert.deepEqual(
      students.map((student) => [student.full_name, (student.summary as Record<string, number>).done]),
      [
        ['Học sinh An', 1],
        ['Học sinh Bình', 0],
      ],
    );
    const plan = await api('GET', `/learning/spaces/${spaceA}/plan`, mathTeacher.accessToken);
    assert.deepEqual(
      (plan.body.weeks as Array<Record<string, unknown>>).map((week) => week.week),
      [1, 2],
    );
    const exception = await api('POST', `/learning/activities/${practiceId}/exceptions`, mathTeacher.accessToken, {
      child_id: children[1],
      reason: 'Học sinh hòa nhập, mở trước',
    });
    assert.equal(exception.status, 200, JSON.stringify(exception.body));
    const events = await api('GET', `/learning/spaces/${spaceA}/events`, mathTeacher.accessToken);
    assert.deepEqual(
      new Set(list(events.body).map((event) => event.verb)),
      new Set(['published', 'completed', 'unlocked']),
    );
    const outsider = await api('POST', `/learning/activities/${readingId}/results`, mathTeacher.accessToken, {
      child_id: randomUUID(),
      status: 'completed',
    });
    assert.equal(outsider.status, 422, 'học sinh không thuộc lớp');
  });

  it('CT-28b-13: khoá học mẫu qua duyệt tổ rồi Ban Giám hiệu; chỉ bản đã duyệt đẩy xuống lớp; nhận cập nhật giữ phần giáo viên đã sửa', async () => {
    const content = {
      sections: [
        {
          key: 'chuong-1',
          title: 'Chương 1. Số hữu tỉ (mẫu của tổ)',
          planned_week: 1,
          items: [{ key: 'doc-1', kind: 'page', title: 'Đọc hiểu', settings: { body: 'Nội dung mẫu' } }],
        },
      ],
    };
    const created = await api('POST', '/learning/templates', mathTeacher.accessToken, {
      title: 'Toán 7, học kỳ I',
      school_level: 'THCS',
      subject_id: subjects['THCS-TOAN'],
      grade_level_code: 'K7',
      content,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const templateId = created.body.id as string;
    const early = await api('POST', `/learning/templates/${templateId}/apply`, mathTeacher.accessToken, {
      space_ids: [spaceB],
    });
    assert.equal(early.status, 422, 'chưa duyệt thì chưa đẩy được');
    assert.equal((await api('POST', `/learning/templates/${templateId}/submit`, mathTeacher.accessToken)).status, 200);
    const selfReview = await api('POST', `/learning/templates/${templateId}/review`, mathTeacher.accessToken, {
      decision: 'approve',
    });
    assert.equal(selfReview.status, 403, 'người soạn không tự duyệt');
    const unit = await api('POST', `/learning/templates/${templateId}/review`, principal.accessToken, {
      decision: 'approve',
    });
    assert.equal(unit.body.status, 'pending_school', JSON.stringify(unit.body));
    const school = await api('POST', `/learning/templates/${templateId}/review`, principal.accessToken, {
      decision: 'approve',
    });
    assert.equal(school.body.status, 'published');
    const applied = await api('POST', `/learning/templates/${templateId}/apply`, mathTeacher.accessToken, {
      space_ids: [spaceB],
    });
    assert.equal(applied.status, 200, JSON.stringify(applied.body));
    assert.deepEqual((applied.body.spaces as Array<Record<string, unknown>>)[0], {
      space_id: spaceB,
      created: 1,
      updated: 0,
      kept_local: 0,
    });
    const detail = await api('GET', `/learning/spaces/${spaceB}`, mathTeacher.accessToken);
    const activity = (detail.body.activities as Array<Record<string, unknown>>)[0];
    assert.equal(activity?.template_item_key, 'doc-1');
    assert.equal(
      (
        await api('PATCH', `/learning/activities/${activity?.id as string}`, mathTeacher.accessToken, {
          title: 'Đọc hiểu (lớp 7B)',
        })
      ).status,
      200,
    );
    const reapplied = await api('POST', `/learning/templates/${templateId}/apply`, mathTeacher.accessToken, {
      space_ids: [spaceB],
    });
    assert.equal((reapplied.body.spaces as Array<Record<string, unknown>>)[0]?.kept_local, 1);
    const kept = await api('GET', `/learning/spaces/${spaceB}`, mathTeacher.accessToken);
    assert.equal((kept.body.activities as Array<Record<string, unknown>>)[0]?.title, 'Đọc hiểu (lớp 7B)');
    const outsider = await api('POST', `/learning/templates/${templateId}/apply`, otherTeacher.accessToken, {
      space_ids: [spaceB],
    });
    assert.equal(outsider.status, 403, 'không đẩy vào lớp mình không dạy');
  });

  it('CT-28b-14: nội quy dạy học trực tuyến do Hiệu trưởng ban hành có phiên bản; phụ huynh xác nhận thay học sinh', async () => {
    assert.equal((await api('POST', '/learning/rules', mathTeacher.accessToken, { content: 'Nội quy' })).status, 403);
    const published = await api('POST', '/learning/rules', principal.accessToken, {
      content: 'Vào lớp đúng giờ, bật tên thật, tôn trọng bạn và thầy cô.',
    });
    assert.equal(published.status, 201, JSON.stringify(published.body));
    assert.equal(published.body.version, 1);
    const view = await api('GET', `/learning/children/${children[0]}`, parent.accessToken);
    assert.equal((view.body.rules as Record<string, unknown>).acknowledged_at, null);
    assert.equal(
      (await api('POST', `/learning/children/${children[0]}/rules/acknowledge`, parent.accessToken)).status,
      200,
    );
    const rules = await api('GET', '/learning/rules', principal.accessToken);
    assert.equal(rules.body.acknowledged, 1);
    const second = await api('POST', '/learning/rules', principal.accessToken, { content: 'Nội quy sửa đổi.' });
    assert.equal(second.body.version, 2);
    const again = await api('GET', `/learning/children/${children[0]}`, parent.accessToken);
    assert.equal((again.body.rules as Record<string, unknown>).acknowledged_at, null, 'phiên bản mới cần xác nhận lại');
  });

  it('CT-28b-17: học sinh tự học ở kênh student: thấy lớp của mình, mở hoạt động đang mở thì hoàn thành, hoạt động khóa bị chặn, xác nhận nội quy', async () => {
    // Tài khoản học của Bình nối người dùng kênh student (như 23a cấp ở 4.1.10)
    const student = await createTestUser(environment.identity.database, {
      roles: [{ roleCode: 'VT-21', orgUnitId: unitId }],
    });
    await schoolYear
      .insertInto('student_learning_accounts')
      .values({
        child_id: children[1] ?? '',
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
    const token = login.body.access_token as string;
    const studentApi = (method: string, path: string) => api(method, `/student/learning${path}`, token);

    // Bài ôn mở sau bài đọc; bài luyện tập đã được giáo viên mở riêng cho Bình ở CT-28b-12
    const review = await api('POST', `/learning/spaces/${spaceA}/activities`, mathTeacher.accessToken, {
      section_id: sectionId,
      kind: 'page',
      title: 'Ôn tập số hữu tỉ',
      settings: { body: 'Ôn lại cách viết phân số.' },
      open_rules: { mode: 'all', rules: [{ type: 'after_activity', activity_id: readingId }] },
    });
    assert.equal(review.status, 201, JSON.stringify(review.body));
    const reviewId = review.body.id as string;
    assert.equal((await api('POST', `/learning/activities/${reviewId}/publish`, mathTeacher.accessToken)).status, 200);

    const view = await studentApi('GET', '');
    assert.equal(view.status, 200, JSON.stringify(view.body));
    const space = (view.body.spaces as Array<Record<string, unknown>>).find((row) => row.title === 'Toán - Lớp 7A');
    const activities = ((space?.sections as Array<Record<string, unknown>>)[0]?.activities ?? []) as Array<
      Record<string, unknown>
    >;
    const byTitle = (title: string) => activities.find((activity) => activity.title === title);
    assert.equal(byTitle('Đọc: số hữu tỉ là gì')?.open, true);
    assert.equal(byTitle('Ôn tập số hữu tỉ')?.open, false);

    const locked = await studentApi('POST', `/activities/${reviewId}/open`);
    assert.equal(locked.status, 422, 'hoạt động còn khóa không mở được');
    const opened = await studentApi('POST', `/activities/${readingId}/open`);
    assert.equal(opened.status, 200, JSON.stringify(opened.body));
    assert.equal(opened.body.body, 'Số hữu tỉ là số viết được dưới dạng phân số.');
    const result = await schoolYear
      .selectFrom('activity_results')
      .select('status')
      .where('activity_id', '=', readingId)
      .where('child_id', '=', children[1] ?? '')
      .executeTakeFirst();
    assert.equal(result?.status, 'completed', 'hoạt động "xem xong" hoàn thành khi học sinh mở');
    const unlocked = await studentApi('POST', `/activities/${reviewId}/open`);
    assert.equal(unlocked.status, 200, 'mở xong bài đọc thì bài ôn mở');
    assert.equal(unlocked.body.body, 'Ôn lại cách viết phân số.');
    const link = await studentApi('POST', `/activities/${practiceId}/open`);
    assert.equal(link.status, 200, JSON.stringify(link.body));
    assert.equal(link.body.url, 'https://hoc.truong-thu.example/bai-1');

    assert.equal((await studentApi('POST', '/rules/acknowledge')).status, 200);
    const acknowledged = await studentApi('GET', '');
    assert.notEqual((acknowledged.body.rules as Record<string, unknown>).acknowledged_at, null);

    // Kênh, tuyến đi cặp: cán bộ, phụ huynh không vào tuyến học sinh; học sinh không vào tuyến của cán bộ
    assert.equal((await api('GET', '/student/learning', parent.accessToken)).status, 403);
    assert.equal((await api('GET', '/student/learning', mathTeacher.accessToken)).status, 403);
    assert.equal((await api('GET', '/learning/spaces', token)).status, 403);
  });
});
