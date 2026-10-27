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
} from '../../test-support.js';

// Điểm cuối tiến độ, bảng điểm hoạt động, sổ điểm, báo cáo (DT-28 phần 28d, YCTD-274): lưới tiến độ và danh sách cần chú ý, bảng
// điểm hoạt động và tệp Excel, đưa điểm thường xuyên vào sổ điểm (THCS) qua ScoresService, gợi ý mức đạt môn và nhận xét (Tiểu học)
// qua sổ nhận xét, báo cáo chủ nhiệm, tổ, toàn trường, giáo viên, báo cáo tổng kết học kỳ và hồ sơ dạy học trực tuyến (Thông tư 09),
// phụ huynh xem tóm tắt của con. Người, lớp, môn là dữ liệu giả
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(new Date(`${date}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);

describe('Điểm cuối tiến độ, bảng điểm hoạt động, sổ điểm, báo cáo', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let teacher: LoggedInUser;
  let homeroom: LoggedInUser;
  let otherTeacher: LoggedInUser;
  let parent: LoggedInUser;
  let otherParent: LoggedInUser;
  let unitId = '';
  const classes: Record<string, string> = {};
  const subjects: Record<string, string> = {};
  const children: Record<string, string> = {};
  const periods: Record<string, string> = {};
  const spaces: Record<string, string> = {};
  const activities: Record<string, string> = {};
  const url = (path: string) => `${environment.baseUrl}${path}`;
  const api = (method: string, path: string, token: string, body?: unknown) => sendJson(method, url(path), token, body);
  const rows = (body: unknown) => body as unknown as Array<Record<string, unknown>>;
  const download = async (path: string, token: string) => {
    const response = await fetch(url(path), { headers: { authorization: `Bearer ${token}` } });
    return {
      status: response.status,
      type: response.headers.get('content-type'),
      size: (await response.arrayBuffer()).byteLength,
    };
  };

  async function child(name: string, classId: string, order: number) {
    const row = await schoolYear
      .insertInto('children')
      .values({
        org_unit_id: unitId,
        full_name: name,
        dob: '2015-03-01',
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
    await schoolYear
      .insertInto('class_enrollments')
      .values({ child_id: row.id, class_id: classId, from_date: '2026-09-05', order_number: order })
      .execute();
    return row.id;
  }

  async function activity(spaceId: string, sectionId: string, title: string, extra: Record<string, unknown>) {
    const created = await api('POST', `/learning/spaces/${spaceId}/activities`, teacher.accessToken, {
      section_id: sectionId,
      kind: 'page',
      title,
      settings: { body: `Nội dung ${title}` },
      ...extra,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const id = created.body.id as string;
    assert.equal((await api('POST', `/learning/activities/${id}/publish`, teacher.accessToken)).status, 200);
    return id;
  }

  const result = async (activityId: string, childId: string, body: Record<string, unknown>) => {
    const response = await api('POST', `/learning/activities/${activityId}/results`, teacher.accessToken, {
      child_id: childId,
      ...body,
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
  };

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    const academicYearId = await openTestAcademicYear(environment, principal.accessToken, '2026-2027', {
      first_term: { start_date: addDays(vietnamToday, -60), end_date: addDays(vietnamToday, 90) },
      second_term: { start_date: addDays(vietnamToday, 95), end_date: addDays(vietnamToday, 200) },
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
        code: 'TRUONG-28D',
        name: 'Trường liên cấp thử',
        unit_type: 'truong_chinh',
      })
    ).body.id as string;
    const current = await api('GET', '/school-levels', principal.accessToken);
    const levels = (current.body.levels as Array<Record<string, unknown>>).map(
      ({ code, order_no, display_name, learner_term, context_label }) => ({
        code,
        is_enabled: code === 'MN' || code === 'TH' || code === 'THCS',
        order_no,
        display_name,
        learner_term,
        context_label,
      }),
    );
    assert.equal((await api('PUT', '/school-levels', principal.accessToken, { levels })).status, 200);
    for (const level of ['TH', 'THCS']) {
      assert.equal(
        (await api('POST', '/grade-levels/templates', principal.accessToken, { school_level: level })).status,
        200,
      );
      assert.equal(
        (await api('POST', '/subjects/templates', principal.accessToken, { school_level: level })).status,
        200,
      );
      for (const row of rows((await api('GET', `/subjects?school_level=${level}`, principal.accessToken)).body)) {
        subjects[row.code as string] = row.id as string;
      }
    }
    assert.equal(
      (await api('POST', '/assessment/config/defaults', principal.accessToken, { school_level: 'TH' })).status,
      200,
    );
    for (const period of rows(
      (await api('GET', '/assessment/config?school_level=TH', principal.accessToken)).body.periods,
    )) {
      periods[period.code as string] = period.id as string;
    }
    teacher = await environment.loginAs('VT-08', unitId);
    homeroom = await environment.loginAs('VT-07', unitId);
    otherTeacher = await environment.loginAs('VT-08', unitId);
    parent = await environment.loginAs('VT-14', unitId);
    otherParent = await environment.loginAs('VT-14', unitId);
    for (const [code, grade, level, subject] of [
      ['6A', 'K6', 'THCS', 'THCS-TOAN'],
      ['3A', 'K3', 'TH', 'TH-TOAN'],
    ] as const) {
      classes[code] = (
        await schoolYear
          .insertInto('classes')
          .values({
            org_unit_id: unitId,
            academic_year_id: academicYearId,
            code,
            name: `Lớp ${code}`,
            grade_level: grade,
            school_level: level,
            max_size: 40,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
      const assigned = await api('POST', `/classes/${classes[code]}/staff-assignments`, principal.accessToken, {
        staff_user_id: teacher.userId,
        assignment_role: 'subject',
        subject_id: subjects[subject],
      });
      assert.equal(assigned.status, 201, JSON.stringify(assigned.body));
    }
    const head = await api('POST', `/classes/${classes['6A']}/staff-assignments`, principal.accessToken, {
      staff_user_id: homeroom.userId,
      assignment_role: 'homeroom',
    });
    assert.equal(head.status, 201, JSON.stringify(head.body));
    children.an = await child('Học sinh An', classes['6A'] ?? '', 1);
    children.binh = await child('Học sinh Bình', classes['6A'] ?? '', 2);
    children.chi = await child('Học sinh Chi', classes['3A'] ?? '', 1);
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: 'ME', name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    const guardian = await schoolYear
      .insertInto('guardians')
      .values({ full_name: 'Mẹ của An', phone: '0901280004', user_id: parent.userId })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('child_guardians')
      .values({
        child_id: children.an,
        guardian_id: guardian.id,
        relationship_item_id: relationship.id,
        is_primary: true,
      })
      .execute();
    for (const row of rows((await api('GET', '/learning/spaces', teacher.accessToken)).body)) {
      spaces[(row.title as string).includes('6A') ? '6A' : '3A'] = row.id as string;
    }
    const past = new Date(Date.now() - 2 * 86_400_000).toISOString();
    for (const code of ['6A', '3A'] as const) {
      const spaceId = spaces[code] ?? '';
      assert.equal(
        (await api('PATCH', `/learning/spaces/${spaceId}`, teacher.accessToken, { visible_to_students: true })).status,
        200,
      );
      const section = await api('POST', `/learning/spaces/${spaceId}/sections`, teacher.accessToken, {
        title: 'Chương 1',
      });
      assert.equal(section.status, 201, JSON.stringify(section.body));
      const sectionId = section.body.id as string;
      if (code === '6A') {
        activities.reading = await activity(spaceId, sectionId, 'Đọc bài 1', { due_at: past });
        activities.review = await activity(spaceId, sectionId, 'Ôn tập bài 1', { due_at: past });
        activities.quiz = await activity(spaceId, sectionId, 'Bài kiểm tra nhanh', {
          graded: true,
          weight: 1,
          completion_rule: 'teacher',
        });
        activities.practice = await activity(spaceId, sectionId, 'Bài luyện tập', {
          graded: true,
          weight: 2,
          completion_rule: 'teacher',
        });
      } else {
        activities.primary = await activity(spaceId, sectionId, 'Bài đọc hiểu', {
          graded: true,
          completion_rule: 'teacher',
        });
      }
    }
    await result(activities.reading ?? '', children.an, { status: 'completed' });
    await result(activities.review ?? '', children.an, { status: 'completed' });
    await result(activities.quiz ?? '', children.an, { status: 'completed', score: 8 });
    await result(activities.practice ?? '', children.an, { status: 'completed', score: 9 });
    await result(activities.quiz ?? '', children.binh, { status: 'completed', score: 6 });
    await result(activities.primary ?? '', children.chi, { status: 'completed', level: 'excellent' });
  });

  after(async () => {
    await schoolYear?.destroy();
    await environment?.close();
  });

  it('CT-28d-6: lưới tiến độ từng em, theo chương; học sinh quá hạn từ 2 hoạt động vào danh sách cần chú ý; không có thứ hạng', async () => {
    const grid = await api('GET', `/learning/spaces/${spaces['6A']}/progress-grid`, teacher.accessToken);
    assert.equal(grid.status, 200, JSON.stringify(grid.body));
    const students = rows(grid.body.students);
    const an = students.find((row) => row.child_id === children.an);
    const binh = students.find((row) => row.child_id === children.binh);
    assert.deepEqual(an?.summary, { required: 4, done: 4, overdue: 0, pending_grading: 0, percent: 100 });
    assert.equal((binh?.summary as Record<string, unknown>).overdue, 2);
    const attention = rows(grid.body.attention);
    assert.ok(
      (attention.find((row) => row.child_id === children.binh)?.reasons as string[]).includes('Quá hạn 2 hoạt động'),
    );
    assert.ok(!JSON.stringify(grid.body).includes('rank'), 'không có thứ hạng');
    assert.equal(
      (await api('GET', `/learning/spaces/${spaces['6A']}/progress-grid`, otherTeacher.accessToken)).status,
      403,
    );
  });

  it('CT-28d-7: bảng điểm hoạt động có trung bình có trọng số (tham khảo) và tệp Excel; Tiểu học đếm mức', async () => {
    const book = await api('GET', `/learning/spaces/${spaces['6A']}/gradebook`, teacher.accessToken);
    assert.equal(book.status, 200, JSON.stringify(book.body));
    assert.deepEqual(
      rows(book.body.activities).map((row) => row.title),
      ['Bài kiểm tra nhanh', 'Bài luyện tập'],
    );
    assert.equal(rows(book.body.rows).find((row) => row.child_id === children.an)?.average, 8.7);
    assert.match(String(book.body.notice), /không phải điểm trung bình môn/);
    const file = await download(`/learning/spaces/${spaces['6A']}/gradebook/file?format=xlsx`, teacher.accessToken);
    assert.equal(file.status, 200);
    assert.match(String(file.type), /spreadsheetml/);
    const primary = await api('GET', `/learning/spaces/${spaces['3A']}/gradebook`, teacher.accessToken);
    assert.deepEqual(rows(primary.body.rows)[0]?.levels, { excellent: 1, completed: 0, not_completed: 0 });
  });

  it('CT-28d-8: đưa điểm thường xuyên vào sổ điểm: xem trước, xác nhận ghi nguồn activity; em chưa có điểm bỏ trống; trường tắt công tắc thì chặn', async () => {
    const body = {
      activity_ids: [activities.quiz, activities.practice],
      method: 'weighted',
      term_type: 'first_term',
      seq: 2,
    };
    const preview = await api('POST', `/learning/spaces/${spaces['6A']}/score-book/preview`, teacher.accessToken, body);
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    const previewRows = rows(preview.body.rows);
    assert.equal(previewRows.find((row) => row.child_id === children.an)?.score, 8.7);
    assert.equal(previewRows.find((row) => row.child_id === children.binh)?.score, null);
    assert.equal(
      (await api('POST', `/learning/spaces/${spaces['6A']}/score-book`, otherTeacher.accessToken, body)).status,
      403,
    );
    const committed = await api('POST', `/learning/spaces/${spaces['6A']}/score-book`, teacher.accessToken, body);
    assert.equal(committed.status, 200, JSON.stringify(committed.body));
    assert.deepEqual(committed.body, { written: 1, skipped: 1 });
    const entry = await schoolYear
      .selectFrom('score_entries')
      .select(['score', 'source', 'kind', 'seq'])
      .where('child_id', '=', children.an ?? '')
      .executeTakeFirstOrThrow();
    assert.deepEqual(entry, { score: '8.7', source: 'activity', kind: 'regular', seq: 2 });
    const transfers = await schoolYear.selectFrom('activity_score_transfers').select('written').execute();
    assert.deepEqual(transfers, [{ written: 1 }]);
    assert.equal(
      (
        await api('POST', `/learning/spaces/${spaces['3A']}/score-book/preview`, teacher.accessToken, {
          ...body,
          activity_ids: [activities.primary],
          method: 'single',
        })
      ).status,
      422,
      'Tiểu học không ghi điểm số',
    );
    await schoolYear
      .insertInto('settings')
      .values({
        org_unit_id: unitId,
        key: 'learning_gradebook_enabled',
        value_type: 'boolean',
        value: JSON.stringify(false),
      })
      .execute();
    const blocked = await api('POST', `/learning/spaces/${spaces['6A']}/score-book/preview`, teacher.accessToken, body);
    assert.equal(blocked.status, 422);
    await schoolYear.deleteFrom('settings').where('key', '=', 'learning_gradebook_enabled').execute();
  });

  it('CT-28d-9: Tiểu học: gợi ý mức đạt môn và nhận xét từ kết quả hoạt động, giáo viên xác nhận thì ghi sổ nhận xét', async () => {
    const preview = await api('POST', `/learning/spaces/${spaces['3A']}/comment-book/preview`, teacher.accessToken, {
      activity_ids: [activities.primary],
    });
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    const row = rows(preview.body.rows)[0];
    assert.equal(row?.level_code, 'T');
    assert.match(String(row?.comment), /hoàn thành 1\/1 hoạt động/);
    const committed = await api('POST', `/learning/spaces/${spaces['3A']}/comment-book`, teacher.accessToken, {
      period_id: periods.GK1,
      activity_ids: [activities.primary],
      items: [{ child_id: children.chi, level_code: 'T', comment: 'Em đọc hiểu tốt, hoàn thành các hoạt động.' }],
    });
    assert.equal(committed.status, 200, JSON.stringify(committed.body));
    assert.deepEqual(committed.body, { levels: 1, comments: 1 });
    const level = await schoolYear
      .selectFrom('subject_results')
      .select('level_code')
      .where('child_id', '=', children.chi ?? '')
      .executeTakeFirstOrThrow();
    assert.equal(level.level_code, 'T');
    const comment = await schoolYear
      .selectFrom('regular_comments')
      .select('content')
      .where('child_id', '=', children.chi ?? '')
      .executeTakeFirstOrThrow();
    assert.equal(comment.content, 'Em đọc hiểu tốt, hoàn thành các hoạt động.');
  });

  it('CT-28d-10: báo cáo chủ nhiệm, tổ chuyên môn, toàn trường, hoạt động dạy của giáo viên theo vai trò', async () => {
    const forHomeroom = await api('GET', `/learning/reports/homeroom?class_id=${classes['6A']}`, homeroom.accessToken);
    assert.equal(forHomeroom.status, 200, JSON.stringify(forHomeroom.body));
    assert.equal(rows(forHomeroom.body.spaces)[0]?.activity_count, 4);
    assert.ok(rows(forHomeroom.body.attention).some((row) => row.child_id === children.binh));
    assert.equal(
      (await api('GET', `/learning/reports/homeroom?class_id=${classes['6A']}`, otherTeacher.accessToken)).status,
      403,
    );
    const school = await api('GET', '/learning/reports/school', principal.accessToken);
    assert.equal(school.status, 200, JSON.stringify(school.body));
    assert.equal(school.body.spaces_in_use, 2);
    assert.equal(school.body.activities, 5);
    assert.equal((await api('GET', '/learning/reports/school', teacher.accessToken)).status, 403);
    const people = await api('GET', '/learning/reports/teachers', principal.accessToken);
    assert.equal(rows(people.body.teachers).find((row) => row.user_id === teacher.userId)?.activities, 5);
    assert.equal((await api('GET', '/learning/reports/department', teacher.accessToken)).status, 403);
    assert.equal((await api('GET', '/learning/reports/department', principal.accessToken)).status, 200);
  });

  it('CT-28d-11: báo cáo tổng kết dạy học trực tuyến học kỳ do Ban Giám hiệu lập, xuất PDF; hồ sơ dạy học trực tuyến của lớp xuất Excel', async () => {
    const saved = await api('PUT', '/learning/term-reports/first_term', principal.accessToken, {
      evaluation: 'Các lớp dùng lớp học trực tuyến đều đặn',
      difficulties: 'Một số học sinh thiếu thiết bị',
      causes: 'Gia đình chưa có máy tính',
      recommendations: 'Cho mượn máy tính bảng',
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const report = await api('GET', '/learning/term-reports/first_term', principal.accessToken);
    assert.equal((report.body.report as Record<string, unknown>).difficulties, 'Một số học sinh thiếu thiết bị');
    assert.equal((report.body.stats as Record<string, unknown>).activities, 5);
    assert.equal((await api('PUT', '/learning/term-reports/first_term', teacher.accessToken, {})).status, 403);
    assert.equal((await api('GET', '/learning/term-reports/year', principal.accessToken)).status, 422);
    const pdf = await download('/learning/term-reports/first_term/file?format=pdf', principal.accessToken);
    assert.equal(pdf.status, 200);
    assert.equal(pdf.type, 'application/pdf');
    const record = await download(
      `/learning/spaces/${spaces['6A']}/record?term_type=first_term&format=xlsx`,
      teacher.accessToken,
    );
    assert.equal(record.status, 200);
    assert.ok(record.size > 1000);
  });

  it('CT-28d-12: phụ huynh xem tóm tắt việc học của con (tiến độ, sắp đến hạn, nhận xét); phụ huynh khác bị chặn', async () => {
    const summary = await api('GET', `/learning/children/${children.an}/summary`, parent.accessToken);
    assert.equal(summary.status, 200, JSON.stringify(summary.body));
    assert.equal((rows(summary.body.spaces)[0]?.summary as Record<string, unknown>).done, 4);
    assert.equal((await api('GET', `/learning/children/${children.an}/summary`, otherParent.accessToken)).status, 403);
  });
});
