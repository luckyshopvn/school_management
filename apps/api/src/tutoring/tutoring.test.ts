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

// Gia sư trong trường (DT-27 phần 27b, YCTD-252), kịch bản CT-27b-3 đến CT-27b-7: chương trình và duyệt, buổi học không trùng thời khoá
// biểu và không quá 2 tiết/tuần/môn, đơn của cha mẹ, điểm danh và báo vắng, nhắn tin luôn qua cha mẹ. Dữ liệu giả, cấp THCS
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const weekdayOf = (date: string) => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
};
// Thứ Hai của tuần sau, để buổi học luôn ở tương lai và trong một tuần trọn
const nextMonday = addDays(vietnamToday, 8 - weekdayOf(vietnamToday));

type Json = Record<string, unknown>;

describe('Gia sư trong trường', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let teacher: LoggedInUser;
  let homeroom: LoggedInUser;
  let parent: LoggedInUser;
  let otherParent: LoggedInUser;
  let unitId = '';
  let classId = '';
  let otherClassId = '';
  let mathId = '';
  let programId = '';
  const children: Record<string, string> = {};
  const url = (path: string) => `${environment.baseUrl}${path}`;
  const api = (method: string, path: string, user: LoggedInUser, body?: unknown) =>
    sendJson(method, url(path), user.accessToken, body);
  const ruleCodes = (body: Json) =>
    ((body.error as Json | undefined)?.details as Array<{ field: string }> | undefined)?.map((detail) => detail.field) ?? [];

  const programBody = (changes: Json = {}) => ({
    name: 'Phụ đạo Toán 6 cho học sinh chưa đạt',
    school_level: 'THCS',
    subject_id: mathId,
    content_type: 'curriculum',
    audience: 'below_standard',
    charges_fee: false,
    delivery: 'live_video',
    registration_form: 'Tôi là cha mẹ học sinh, tự nguyện đăng ký cho con học phụ đạo môn Toán trong nhà trường, không thu tiền.',
    starts_on: nextMonday,
    ends_on: addDays(nextMonday, 27),
    class_ids: [classId],
    ...changes,
  });

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
    schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(environment.systemDatabaseUrl, registry.database_name));
    unitId = (await api('POST', '/org-units', principal, { code: 'THCS-27B', name: 'Trường THCS thử', unit_type: 'truong_chinh' }))
      .body.id as string;
    const current = await api('GET', '/school-levels', principal);
    const levels = (current.body.levels as Json[]).map(({ code, order_no, display_name, learner_term, context_label }) => ({
      code,
      is_enabled: code === 'TH' || code === 'THCS',
      order_no,
      display_name,
      learner_term,
      context_label,
    }));
    assert.equal((await api('PUT', '/school-levels', principal, { levels })).status, 200);
    assert.equal((await api('POST', '/grade-levels/templates', principal, { school_level: 'THCS' })).status, 200);
    assert.equal((await api('POST', '/subjects/templates', principal, { school_level: 'THCS' })).status, 200);
    mathId = ((await api('GET', '/subjects?school_level=THCS', principal)).body as unknown as Json[]).find(
      (row) => row.code === 'THCS-TOAN',
    )?.id as string;
    teacher = await environment.loginAs('VT-08', unitId);
    homeroom = await environment.loginAs('VT-07', unitId);
    parent = await environment.loginAs('VT-14', unitId);
    otherParent = await environment.loginAs('VT-14', unitId);
    for (const code of ['6A', '6B']) {
      const id = (
        await schoolYear
          .insertInto('classes')
          .values({
            org_unit_id: unitId,
            academic_year_id: academicYearId,
            code,
            name: code,
            grade_level: 'K6',
            school_level: 'THCS',
            max_size: 45,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
      if (code === '6A') classId = id;
      else otherClassId = id;
    }
    await schoolYear
      .insertInto('class_staff_assignments')
      .values([
        {
          class_id: classId,
          staff_user_id: teacher.userId,
          staff_name: 'Cô Toán',
          assignment_role: 'subject',
          subject_name: 'Toán',
          subject_id: mathId,
          from_date: addDays(vietnamToday, -60),
        },
        {
          class_id: classId,
          staff_user_id: homeroom.userId,
          staff_name: 'Thầy Chủ nhiệm',
          assignment_role: 'homeroom',
          subject_name: null,
          from_date: addDays(vietnamToday, -60),
        },
      ])
      .execute();
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: 'ME', name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    for (const [key, targetClass, guardianUser] of [
      ['An', classId, parent],
      ['Binh', classId, otherParent],
      ['Dung', otherClassId, otherParent],
    ] as const) {
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitId,
          full_name: `Học sinh ${key}`,
          dob: '2014-03-01',
          gender: 'female',
          national_id_encrypted: 'ma-hoa',
          national_id_hash: randomUUID(),
          national_id_last4: '0000',
          photo_consent: 'granted',
          status: 'active',
          enroll_date: addDays(vietnamToday, -60),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      children[key] = child.id;
      await schoolYear
        .insertInto('class_enrollments')
        .values({ child_id: child.id, class_id: targetClass, from_date: addDays(vietnamToday, -60) })
        .execute();
      const guardian = await schoolYear
        .insertInto('guardians')
        .values({ full_name: `Mẹ của ${key}`, phone: null, user_id: guardianUser.userId })
        .returning('id')
        .executeTakeFirstOrThrow();
      await schoolYear
        .insertInto('child_guardians')
        .values({ child_id: child.id, guardian_id: guardian.id, relationship_item_id: relationship.id, is_primary: true })
        .execute();
    }
    // Khung giờ tiết và thời khoá biểu chính khoá: 6A học tiết 1 (07:00–07:45) thứ Hai với Cô Toán
    await environment.system
      .insertInto('period_slots')
      .values([1, 2].map((periodNo) => ({
        academic_year_id: academicYearId,
        school_level: 'THCS' as const,
        period_no: periodNo,
        session: 'morning' as const,
        start_time: periodNo === 1 ? '07:00' : '07:50',
        end_time: periodNo === 1 ? '07:45' : '08:35',
      })))
      .execute();
    const version = await schoolYear
      .insertInto('timetable_versions')
      .values({ school_level: 'THCS', name: 'TKB học kỳ I', effective_from: addDays(vietnamToday, -30), status: 'published', source: 'manual' })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('timetable_lessons')
      .values({ version_id: version.id, class_id: classId, weekday: 1, period_no: 1, subject_id: mathId, teacher_user_id: teacher.userId, teacher_name: 'Cô Toán' })
      .execute();
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-27b-3: chương trình môn học không thu tiền, có nhóm đối tượng, không cho Tiểu học; giáo viên nộp, Ban Giám hiệu duyệt', async () => {
    const fee = await api('POST', '/tutoring/programs', teacher, programBody({ charges_fee: true }));
    assert.equal(fee.status, 422, JSON.stringify(fee.body));
    assert.deepEqual(ruleCodes(fee.body), ['curriculum_fee']);
    const noAudience = await api('POST', '/tutoring/programs', teacher, programBody({ audience: null }));
    assert.deepEqual(ruleCodes(noAudience.body), ['curriculum_audience']);
    const primary = await api('POST', '/tutoring/programs', teacher, programBody({ school_level: 'TH', subject_id: null, class_ids: [] }));
    assert.deepEqual(ruleCodes(primary.body), ['curriculum_subject', 'curriculum_level']);
    const enrichment = await api('POST', '/tutoring/programs', teacher, programBody({
      name: 'Câu lạc bộ cờ vua Tiểu học',
      school_level: 'TH',
      subject_id: null,
      content_type: 'enrichment',
      audience: null,
      charges_fee: true,
      class_ids: [],
    }));
    assert.equal(enrichment.status, 201, 'bổ trợ ngoài chương trình không chịu khóa');

    const created = await api('POST', '/tutoring/programs', teacher, programBody());
    assert.equal(created.status, 201, JSON.stringify(created.body));
    programId = created.body.id as string;
    assert.equal((await api('POST', `/tutoring/programs/${programId}/approve`, teacher)).status, 409, 'chưa nộp');
    assert.equal((await api('POST', `/tutoring/programs/${programId}/submit`, teacher)).status, 200);
    assert.equal((await api('POST', `/tutoring/programs/${programId}/approve`, teacher)).status, 403);
    assert.equal((await api('POST', `/tutoring/programs/${programId}/approve`, principal)).status, 200);
    const detail = await api('GET', `/tutoring/programs/${programId}`, homeroom);
    assert.equal(detail.status, 200, 'giáo viên chủ nhiệm lớp đối tượng thấy chương trình');
    assert.equal(detail.body.charges_fee, false);
  });

  it('CT-27b-4: buổi học không trùng thời khoá biểu chính khoá, không quá 2 tiết/tuần/môn trừ khi có quyết định của Sở', async () => {
    const clash = await api('POST', `/tutoring/programs/${programId}/sessions`, teacher, {
      session_date: nextMonday,
      start_time: '07:15',
      end_time: '08:00',
    });
    assert.equal(clash.status, 422, JSON.stringify(clash.body));
    assert.deepEqual(ruleCodes(clash.body), ['timetable_teacher']);
    const weekly = await api('POST', `/tutoring/programs/${programId}/sessions`, teacher, {
      weekly: { from: nextMonday, to: addDays(nextMonday, 13), weekdays: [2, 4] },
      start_time: '16:30',
      end_time: '17:15',
      location: 'Phòng 6A',
    });
    assert.equal(weekly.status, 201, JSON.stringify(weekly.body));
    assert.deepEqual(weekly.body, { count: 4, periods: 1 });

    // An đăng ký và được duyệt: mỗi tuần 2 tiết; thêm buổi thứ Sáu tuần đầu là 3 tiết, bị chặn
    const registered = await api('POST', `/children/${children.An}/tutoring/registrations`, parent, { program_id: programId, agree: true });
    assert.equal(registered.status, 201, JSON.stringify(registered.body));
    assert.equal((await api('POST', `/tutoring/registrations/${registered.body.id as string}/approve`, homeroom)).status, 200);
    const extra = { session_date: addDays(nextMonday, 4), start_time: '16:30', end_time: '17:15' };
    const over = await api('POST', `/tutoring/programs/${programId}/sessions`, teacher, extra);
    assert.equal(over.status, 422, JSON.stringify(over.body));
    assert.deepEqual(ruleCodes(over.body), ['weekly_periods']);
    const exemption = await api('POST', '/tutoring/exemptions', principal, {
      decision_no: '123/QĐ-SGDĐT',
      decision_date: vietnamToday,
      subject_id: mathId,
      max_periods_per_week: 3,
      child_ids: [children.An],
    });
    assert.equal(exemption.status, 201, JSON.stringify(exemption.body));
    assert.equal((await api('POST', '/tutoring/exemptions', teacher, {})).status, 403);
    assert.equal((await api('POST', `/tutoring/programs/${programId}/sessions`, teacher, extra)).status, 201, 'có quyết định của Sở');
  });

  it('CT-27b-5: cha mẹ gửi đơn có xác nhận, không trùng đơn, chỉ cho con mình và chương trình mở cho lớp; rút đơn', async () => {
    assert.equal(
      (await api('POST', `/children/${children.Binh}/tutoring/registrations`, otherParent, { program_id: programId })).status,
      400,
      'phải xác nhận nội dung đơn',
    );
    const binh = await api('POST', `/children/${children.Binh}/tutoring/registrations`, otherParent, { program_id: programId, agree: true });
    assert.equal(binh.status, 201);
    assert.equal(
      (await api('POST', `/children/${children.Binh}/tutoring/registrations`, otherParent, { program_id: programId, agree: true })).status,
      409,
    );
    assert.equal((await api('GET', `/children/${children.Binh}/tutoring`, parent)).status, 403, 'không phải cha mẹ của học sinh');
    assert.equal(
      (await api('POST', `/children/${children.Dung}/tutoring/registrations`, otherParent, { program_id: programId, agree: true })).status,
      404,
      'lớp 6B không thuộc chương trình',
    );
    const overview = await api('GET', `/children/${children.Binh}/tutoring`, otherParent);
    assert.equal((overview.body.programs as Json[])[0]?.registered, true);
    const stored = await schoolYear.selectFrom('tutoring_registrations').select(['form_text']).where('id', '=', binh.body.id as string).executeTakeFirstOrThrow();
    assert.match(stored.form_text, /tự nguyện đăng ký/);
    assert.equal(
      (await api('POST', `/children/${children.Binh}/tutoring/registrations/${binh.body.id as string}/withdraw`, otherParent)).status,
      200,
    );
    const again = await api('POST', `/children/${children.Binh}/tutoring/registrations`, otherParent, { program_id: programId, agree: true });
    assert.equal(again.status, 201, 'rút rồi gửi lại được');
    assert.equal((await api('POST', `/tutoring/registrations/${again.body.id as string}/reject`, homeroom, {})).status, 400, 'cần lý do');
    assert.equal((await api('POST', `/tutoring/registrations/${again.body.id as string}/approve`, homeroom)).status, 200);
  });

  it('CT-27b-6: điểm danh gợi ý từ nhật ký phòng, giáo viên xác nhận, vắng báo cha mẹ một lần; hủy buổi báo cha mẹ', async () => {
    const sessions = await api('GET', `/tutoring/sessions?from=${nextMonday}&to=${addDays(nextMonday, 6)}`, teacher);
    const first = (sessions.body as unknown as Json[])[0] as Json;
    const date = first.session_date as string;
    const events = await api('POST', `/tutoring/sessions/${first.id as string}/room-events`, teacher, {
      events: [{ child_id: children.An, kind: 'join', at: `${date}T16:50:00+07:00` }],
    });
    assert.equal(events.status, 200, JSON.stringify(events.body));
    const suggested = await api('GET', `/tutoring/sessions/${first.id as string}/attendance`, teacher);
    const an = (suggested.body.students as Json[]).find((row) => row.child_id === children.An) as Json;
    assert.equal(an.status, 'late');
    assert.equal(an.source, 'room_log');
    assert.equal((await api('GET', `/children/${children.An}/tutoring`, parent)).body.sessions !== undefined, true);

    const confirm = await api('PUT', `/tutoring/sessions/${first.id as string}/attendance`, teacher, {
      entries: [
        { child_id: children.An, status: 'late' },
        { child_id: children.Binh, status: 'absent' },
      ],
    });
    assert.deepEqual(confirm.body, { confirmed: 2, notified: 1 });
    const again = await api('PUT', `/tutoring/sessions/${first.id as string}/attendance`, teacher, {
      entries: [{ child_id: children.Binh, status: 'absent' }],
    });
    assert.equal(again.body.notified, 0, 'báo vắng một lần');
    assert.equal(
      (await api('PUT', `/tutoring/sessions/${first.id as string}/attendance`, teacher, { entries: [{ child_id: children.Dung, status: 'absent' }] })).status,
      400,
      'học sinh không đăng ký',
    );
    const notices = await schoolYear
      .selectFrom('notifications')
      .select('template_code')
      .where('template_code', 'in', ['tutoring_absent', 'tutoring_registration_decided'])
      .execute();
    assert.equal(notices.filter((row) => row.template_code === 'tutoring_absent').length, 1);
    const view = await api('GET', `/children/${children.An}/tutoring`, parent);
    assert.equal((view.body.sessions as Json[]).find((row) => row.id === first.id)?.attendance, 'late');

    const second = (sessions.body as unknown as Json[])[1] as Json;
    assert.equal((await api('POST', `/tutoring/sessions/${second.id as string}/cancel`, teacher, { reason: 'Giáo viên đi tập huấn' })).status, 200);
    const cancelled = await schoolYear.selectFrom('notifications').select('id').where('template_code', '=', 'tutoring_session_cancelled').execute();
    assert.equal(cancelled.length, 1);
    assert.equal((await api('GET', `/tutoring/sessions/${second.id as string}/attendance`, homeroom)).status, 403, 'không dạy chương trình');
  });

  it('CT-27b-7: nhắn tin của chương trình luôn qua luồng với cha mẹ của học sinh; quy định dạy thêm là dữ liệu có ngày hiệu lực', async () => {
    const message = await api('POST', `/tutoring/programs/${programId}/messages`, teacher, { child_id: children.An, content: 'Con cần làm thêm bài tập trang 12' });
    assert.equal(message.status, 201, JSON.stringify(message.body));
    const thread = await schoolYear
      .selectFrom('message_threads')
      .select(['child_id', 'guardian_user_id'])
      .where('id', '=', message.body.thread_id as string)
      .executeTakeFirstOrThrow();
    assert.deepEqual(thread, { child_id: children.An, guardian_user_id: parent.userId });
    assert.equal(
      (await api('POST', `/tutoring/programs/${programId}/messages`, teacher, { child_id: children.Dung, content: 'Xin chào' })).status,
      404,
    );
    const rules = await api('GET', '/tutoring/rules', teacher);
    assert.equal((rules.body.current as Json).maxCurriculumPeriodsPerWeek, 2);
    assert.equal((await api('POST', '/tutoring/rules', teacher, {})).status, 403);
    const changed = await api('POST', '/tutoring/rules', principal, {
      effective_from: addDays(vietnamToday, 400),
      max_curriculum_periods_per_week: 3,
      curriculum_blocked_levels: ['TH'],
      legal_basis: 'Văn bản giả định sửa quy định dạy thêm',
    });
    assert.equal(changed.status, 201, JSON.stringify(changed.body));
    assert.equal(((await api('GET', '/tutoring/rules', teacher)).body.current as Json).maxCurriculumPeriodsPerWeek, 2, 'chưa đến ngày hiệu lực');
  });
});
