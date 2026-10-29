import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import { createTestUser, postJson, solvedCaptcha } from '@school-management/identity/testing';
import type { Kysely } from 'kysely';
import { FileStorage } from '../files/file-storage.js';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { ExamProctoringService } from './exam-proctoring.js';

// Thi trực tuyến cho học sinh (DT-23 phần 23a, YCTD-211), kịch bản CT-23a-2 đến CT-23a-9 và CT-23a-11; giám thị camera (phần 23e,
// YCTD-215) CT-23e-1 đến CT-23e-4. Dữ liệu giả, cấp THCS
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

type Json = Record<string, unknown>;
interface Spec {
  type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
  level: 'recognition' | 'comprehension' | 'application' | 'high_application';
  score: number;
  answer: string[];
  options: Array<{ key: string; content: string }>;
}
interface Student {
  childId: string;
  username: string;
  password: string;
  accessToken: string;
}

describe('Thi trực tuyến cho học sinh', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let math: LoggedInUser;
  let other: LoggedInUser;
  let parent: LoggedInUser;
  let unitId = '';
  let classId = '';
  let otherClassId = '';
  let subjectId = '';
  let essayExamId = '';
  let plainExamId = '';
  let draftExamId = '';
  const essayQuestionIds: string[] = [];
  const children: Record<string, string> = {};
  const students: Record<string, Student> = {};
  const url = (path: string) => `${environment.baseUrl}${path}`;
  const api = (method: string, path: string, token: string, body?: unknown) => sendJson(method, url(path), token, body);
  const as = (user: LoggedInUser) => user.accessToken;
  const list = (body: unknown) => body as unknown as Json[];
  const identityUrl = (path: string) => `${environment.identity.baseUrl}${path}`;

  // Đề mẫu: nhiều lựa chọn 2 điểm (mã 101 đáp án B), đúng sai 2 điểm, trả lời ngắn 2 điểm, tự luận 4 điểm (nếu có)
  async function insertExam(title: string, status: 'locked' | 'approved', withEssay: boolean) {
    const specs: Spec[] = [
      {
        type: 'multiple_choice',
        level: 'recognition',
        score: 2,
        answer: ['B'],
        options: ['A', 'B', 'C', 'D'].map((key) => ({ key, content: `Phương án ${key}` })),
      },
      {
        type: 'true_false',
        level: 'comprehension',
        score: 2,
        answer: ['Đ', 'S', 'Đ', 'S'],
        options: ['a', 'b', 'c', 'd'].map((key) => ({ key, content: `Ý ${key}` })),
      },
      { type: 'short_answer', level: 'application', score: 2, answer: ['12,5'], options: [] },
      ...(withEssay
        ? [{ type: 'essay' as const, level: 'high_application' as const, score: 4, answer: [], options: [] }]
        : []),
    ];
    const exam = await schoolYear
      .insertInto('exams')
      .values({
        school_level: 'THCS',
        subject_id: subjectId,
        grade_level_code: 'K6',
        title,
        status,
        author_user_id: math.userId,
        author_name: 'Giáo viên Toán',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const ids: string[] = [];
    for (const [index, spec] of specs.entries()) {
      const question = await schoolYear
        .insertInto('questions')
        .values({
          school_level: 'THCS',
          subject_id: subjectId,
          grade_level_code: 'K6',
          cognitive_level: spec.level,
          question_type: spec.type,
          content: `Câu ${spec.type} của ${title}`,
          options: JSON.stringify(spec.options),
          answer: JSON.stringify(spec.answer),
          score: spec.score,
          status: 'approved',
          author_user_id: math.userId,
          author_name: 'Giáo viên Toán',
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      ids.push(question.id);
      await schoolYear
        .insertInto('exam_questions')
        .values({
          exam_id: exam.id,
          question_id: question.id,
          order_no: index + 1,
          score: spec.score,
          snapshot: JSON.stringify({
            content: `Câu ${spec.type} của ${title}`,
            question_type: spec.type,
            cognitive_level: spec.level,
            topic_name: 'Số tự nhiên',
            options: spec.options,
            answer: spec.answer,
            guidance: spec.type === 'essay' ? 'Hướng dẫn chấm bí mật' : null,
          }),
        })
        .execute();
    }
    if (status === 'locked') {
      const items = (key: string) =>
        JSON.stringify(
          specs.map((spec, index) => ({
            question_id: ids[index],
            number: index + 1,
            option_order: spec.type === 'multiple_choice' ? ['A', 'B', 'C', 'D'] : [],
            answer: spec.type === 'multiple_choice' ? [key] : spec.answer,
          })),
        );
      await schoolYear
        .insertInto('exam_variants')
        .values([
          { exam_id: exam.id, code: '101', items: items('B') },
          { exam_id: exam.id, code: '102', items: items('C') },
        ])
        .execute();
    }
    return { id: exam.id, questionIds: ids };
  }

  const assignmentBody = (examId: string, changes: Json = {}) => ({
    exam_id: examId,
    opens_at: minutesFromNow(-5),
    closes_at: minutesFromNow(180),
    duration_minutes: 30,
    max_attempts: 1,
    shuffle_questions: false,
    shuffle_options: false,
    variant_mode: 'fixed',
    fixed_variant_code: '101',
    result_mode: 'immediate',
    class_ids: [classId],
    exam_mode: 'remote',
    camera_enabled: true,
    camera_fallback: 'flag',
    ...changes,
  });
  const createAssignment = async (examId: string, changes: Json = {}, token = as(math)) => {
    const created = await api('POST', '/online-exams/assignments', token, assignmentBody(examId, changes));
    assert.equal(created.status, 201, JSON.stringify(created.body));
    return created.body.id as string;
  };

  // Học sinh cấp tài khoản qua "Khởi tạo" ở 4.1.10, đổi mật khẩu lần đầu, đăng nhập ở kênh student
  async function signInStudent(key: string, password = 'MatKhau2026'): Promise<string> {
    const student = students[key] as Student;
    const response = await postJson(identityUrl('/auth/login'), {
      login: student.username,
      password,
      channel: 'student',
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    return response.body.access_token as string;
  }

  const studentApi = (method: string, path: string, token: string, body?: unknown) =>
    sendJson(method, url(`/student${path}`), token, body);
  const startAttempt = async (token: string, assignmentId: string, camera = 'granted') =>
    studentApi('POST', `/exams/${assignmentId}/start`, token, { camera_state: camera });

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
      await api('POST', '/org-units', as(principal), {
        code: 'THCS-23A',
        name: 'Trường THCS thử',
        unit_type: 'truong_chinh',
      })
    ).body.id as string;
    const current = await api('GET', '/school-levels', as(principal));
    const levels = (current.body.levels as Json[]).map(
      ({ code, order_no, display_name, learner_term, context_label }) => ({
        code,
        is_enabled: code === 'MN' || code === 'THCS',
        order_no,
        display_name,
        learner_term,
        context_label,
      }),
    );
    assert.equal((await api('PUT', '/school-levels', as(principal), { levels })).status, 200);
    assert.equal((await api('POST', '/grade-levels/templates', as(principal), { school_level: 'THCS' })).status, 200);
    assert.equal((await api('POST', '/subjects/templates', as(principal), { school_level: 'THCS' })).status, 200);
    subjectId = list((await api('GET', '/subjects?school_level=THCS', as(principal))).body).find(
      (row) => row.code === 'THCS-TOAN',
    )?.id as string;
    math = await environment.loginAs('VT-07', unitId);
    other = await environment.loginAs('VT-07', unitId);
    parent = await environment.loginAs('VT-14', unitId);
    for (const [code, grade] of [
      ['6A', 'K6'],
      ['7A', 'K7'],
    ] as const) {
      const id = (
        await schoolYear
          .insertInto('classes')
          .values({
            org_unit_id: unitId,
            academic_year_id: academicYearId,
            code,
            name: code,
            grade_level: grade,
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
      .values({
        class_id: classId,
        staff_user_id: math.userId,
        staff_name: 'Giáo viên Toán',
        assignment_role: 'subject',
        subject_name: 'Toán',
        subject_id: subjectId,
        from_date: addDays(vietnamToday, -60),
      })
      .execute();
    for (const [key, targetClass] of [
      ['An', classId],
      ['Binh', classId],
      ['Chi', classId],
      ['Dung', otherClassId],
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
    }
    const essayExam = await insertExam('Kiểm tra có tự luận', 'locked', true);
    essayExamId = essayExam.id;
    essayQuestionIds.push(...essayExam.questionIds);
    plainExamId = (await insertExam('Kiểm tra trắc nghiệm', 'locked', false)).id;
    draftExamId = (await insertExam('Đề chưa khoá', 'approved', false)).id;
    // Trường bật thi từ xa để các kịch bản làm bài dùng; chế độ mặc định (tại trường) kiểm ở CT-23a-11
    const enabled = await api('PUT', '/online-exams/school-settings', as(principal), {
      default_exam_mode: 'at-school',
      allow_remote: true,
      allowed_networks: [],
      room_code_minutes: 60,
    });
    assert.equal(enabled.status, 200, JSON.stringify(enabled.body));
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-23a-2: cấp tài khoản, đăng nhập kênh student, đổi mật khẩu lần đầu, kênh và tuyến đi cặp với nhau', async () => {
    const issued = await api('POST', '/learning-accounts/issue', as(principal), {
      child_ids: Object.values(children),
      mode: 'create',
    });
    assert.equal(issued.status, 200, JSON.stringify(issued.body));
    for (const item of list(issued.body.items)) {
      const key = Object.entries(children).find(([, id]) => id === item.child_id)?.[0] as string;
      students[key] = {
        childId: item.child_id as string,
        username: item.username as string,
        password: item.password as string,
        accessToken: '',
      };
    }
    const linked = await schoolYear
      .selectFrom('student_learning_accounts')
      .select(['child_id', 'identity_user_id'])
      .execute();
    assert.equal(linked.length, 4);
    assert.ok(
      linked.every((row) => row.identity_user_id !== null),
      'mỗi tài khoản nối đúng một người dùng định danh',
    );
    assert.equal(new Set(linked.map((row) => row.identity_user_id)).size, 4);

    const an = students.An as Student;
    // Chỉ vào được ở kênh student
    for (const channel of ['portal', 'teacher', 'parent']) {
      const wrong = await postJson(identityUrl('/auth/login'), { login: an.username, password: an.password, channel });
      assert.equal(wrong.status, 401, `học sinh không đăng nhập được ở kênh ${channel}`);
    }
    const staff = await createTestUser(environment.identity.database, {
      roles: [{ roleCode: 'VT-07', orgUnitId: unitId }],
    });
    const staffOnStudent = await postJson(identityUrl('/auth/login'), {
      login: staff.username,
      password: staff.password,
      channel: 'student',
    });
    assert.equal(staffOnStudent.status, 401, 'tài khoản cán bộ không vào kênh student');
    // Ba lần thử ở kênh khác tính như nhập sai (sai kênh báo như sai mật khẩu), đủ ngưỡng nên lần vào đúng kênh phải kèm mã xác nhận
    // (YCTD-353, YCTD-354); đăng nhập đúng thì xóa bộ đếm
    const first = await postJson(identityUrl('/auth/login'), {
      login: an.username,
      password: an.password,
      channel: 'student',
      ...(await solvedCaptcha(environment.identity)),
    });
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(first.body.password_change_required, true, 'mật khẩu do trường cấp phải đổi ở lần đầu');
    const firstToken = first.body.access_token as string;
    assert.equal((await studentApi('GET', '/profile', firstToken)).status, 403, 'chưa đổi mật khẩu thì chưa dùng được');
    for (const key of ['An', 'Binh', 'Chi', 'Dung']) {
      const student = students[key] as Student;
      const login = await postJson(identityUrl('/auth/login'), {
        login: student.username,
        password: student.password,
        channel: 'student',
      });
      const changed = await sendJson('POST', identityUrl('/auth/change-password'), login.body.access_token as string, {
        current_password: student.password,
        new_password: 'MatKhau2026',
      });
      assert.equal(changed.status, 200, JSON.stringify(changed.body));
      student.accessToken = changed.body.access_token as string;
    }
    const profile = await studentApi('GET', '/profile', an.accessToken);
    assert.equal(profile.status, 200, JSON.stringify(profile.body));
    assert.deepEqual([profile.body.full_name, profile.body.class_name], ['Học sinh An', '6A']);
    const me = await sendJson('GET', identityUrl('/auth/me'), an.accessToken);
    assert.deepEqual(me.body.workspaces, [], 'học sinh không có phân hệ nào của cổng quản trị');
    assert.deepEqual(
      (me.body.assignments as Json[]).map((assignment) => [assignment.role_code, assignment.permissions]),
      [['VT-21', ['P02.exam.take', 'P02.learning.study']]],
      'học sinh chỉ có quyền làm bài thi, tự học ở lớp học trực tuyến (28b)',
    );
    // Học sinh không với tới tuyến của cán bộ; cán bộ, phụ huynh không vào tuyến của học sinh
    assert.equal((await api('GET', '/children', an.accessToken)).status, 403);
    assert.equal((await api('GET', '/exam-grading/sessions?school_level=THCS', an.accessToken)).status, 403);
    assert.equal((await api('GET', '/student/profile', as(math))).status, 403);
    assert.equal((await api('GET', '/student/exams', as(parent))).status, 403);
    assert.equal((await api('GET', '/student/exams', undefined as unknown as string)).status, 401);
    assert.equal((await studentApi('GET', '/exams', an.accessToken)).status, 200);
    const refreshed = await postJson(identityUrl('/auth/refresh'), { channel: 'student' });
    assert.equal(refreshed.status, 401, 'không có cookie thì không làm mới được');
  });

  it('CT-23a-3: giao đề: ai giao được, đề chưa khoá, lớp khác khối, đề có tự luận chỉ một lần, danh sách của học sinh', async () => {
    const body = assignmentBody(plainExamId);
    assert.equal((await api('POST', '/online-exams/assignments', as(parent), body)).status, 403);
    assert.equal((await api('POST', '/online-exams/assignments', as(other), body)).status, 403, 'không dạy lớp 6A');
    assert.equal((await api('POST', '/online-exams/assignments', as(math), assignmentBody(draftExamId))).status, 422);
    assert.equal(
      (await api('POST', '/online-exams/assignments', as(principal), { ...body, class_ids: [otherClassId] })).status,
      400,
      'lớp khác khối của đề',
    );
    assert.equal(
      (await api('POST', '/online-exams/assignments', as(math), { ...body, closes_at: minutesFromNow(-1) })).status,
      400,
    );
    assert.equal(
      (await api('POST', '/online-exams/assignments', as(math), { ...body, class_ids: [], child_ids: [] })).status,
      400,
    );
    assert.equal(
      (
        await api('POST', '/online-exams/assignments', as(math), {
          ...body,
          variant_mode: 'fixed',
          fixed_variant_code: '999',
        })
      ).status,
      400,
    );
    assert.equal(
      (await api('POST', '/online-exams/assignments', as(math), assignmentBody(essayExamId, { max_attempts: 2 })))
        .status,
      422,
      'đề có tự luận chỉ cho làm một lần',
    );
    const future = await createAssignment(plainExamId, {
      title: 'Kiểm tra chưa mở',
      opens_at: minutesFromNow(60),
      closes_at: minutesFromNow(240),
    });
    const listed = list((await api('GET', '/online-exams/assignments?school_level=THCS', as(math))).body);
    assert.deepEqual(
      listed.map((row) => [row.title, row.students]),
      [['Kiểm tra chưa mở', 3]],
    );
    assert.equal(list((await api('GET', '/online-exams/assignments?school_level=THCS', as(other))).body).length, 0);
    assert.equal((await api('GET', `/online-exams/assignments/${future}`, as(other))).status, 403);
    const an = students.An as Student;
    const mine = await studentApi('GET', '/exams', an.accessToken);
    assert.deepEqual(
      list(mine.body.items).map((row) => [row.title, row.state]),
      [['Kiểm tra chưa mở', 'upcoming']],
    );
    assert.equal((await startAttempt(an.accessToken, future)).status, 422, 'chưa đến giờ mở');
    const dung = students.Dung as Student;
    assert.equal(
      list((await studentApi('GET', '/exams', dung.accessToken)).body.items).length,
      0,
      'lớp khác không thấy',
    );
    assert.equal((await startAttempt(dung.accessToken, future)).status, 404);
    assert.equal(
      (await api('PATCH', `/online-exams/assignments/${future}`, as(math), { closes_at: minutesFromNow(-5) })).status,
      400,
    );
    const moved = await api('PATCH', `/online-exams/assignments/${future}`, as(math), { title: 'Kiểm tra đổi tên' });
    assert.equal(moved.body.title, 'Kiểm tra đổi tên');
    const cancelled = await api('POST', `/online-exams/assignments/${future}/cancel`, as(math));
    assert.equal(cancelled.body.status, 'cancelled');
    assert.equal(list((await studentApi('GET', '/exams', an.accessToken)).body.items).length, 0);
  });

  it('CT-23a-4: làm bài: không có đáp án, lưu nháp từng câu, tải lại, nộp, chấm tự động, nhiều lượt lấy điểm cao nhất, vào phiếu 22g2', async () => {
    const assignmentId = await createAssignment(plainExamId, { max_attempts: 2, camera_fallback: 'block' });
    const an = students.An as Student;
    const binh = students.Binh as Student;
    const blocked = await startAttempt(binh.accessToken, assignmentId, 'denied');
    assert.equal(blocked.status, 422, 'yêu cầu camera, không cho vào khi bị từ chối');
    assert.match(JSON.stringify(blocked.body), /camera/);
    const started = await startAttempt(an.accessToken, assignmentId);
    assert.equal(started.status, 200, JSON.stringify(started.body));
    const text = JSON.stringify(started.body);
    assert.doesNotMatch(
      text,
      /"answer"|correct_answer|guidance|Hướng dẫn chấm/,
      'đáp án đúng không xuống máy học sinh',
    );
    const attemptId = started.body.id as string;
    const questions = list(started.body.questions);
    assert.deepEqual(
      questions.map((row) => [row.position, row.type]),
      [
        [1, 'multiple_choice'],
        [2, 'true_false'],
        [3, 'short_answer'],
      ],
    );
    assert.deepEqual(
      list(questions[0]?.options).map((option) => option.label),
      ['A', 'B', 'C', 'D'],
    );
    assert.equal(list(questions[1]?.statements).length, 4);
    assert.ok(
      (started.body.remaining_seconds as number) > 25 * 60 && (started.body.remaining_seconds as number) <= 30 * 60,
    );
    // Lưu nháp từng câu, câu khác giữ nguyên, tải lại vẫn còn
    assert.equal(
      (await studentApi('PUT', `/attempts/${attemptId}/answers`, an.accessToken, { answers: { 1: ['b'] } })).status,
      200,
    );
    assert.equal(
      (
        await studentApi('PUT', `/attempts/${attemptId}/answers`, an.accessToken, {
          answers: { 2: ['Đ', 'S', 'Đ', 'S'] },
        })
      ).status,
      200,
    );
    const bad = await studentApi('PUT', `/attempts/${attemptId}/answers`, an.accessToken, { answers: { 9: ['A'] } });
    assert.equal(bad.status, 400);
    assert.equal(
      (await studentApi('PUT', `/attempts/${attemptId}/answers`, an.accessToken, { answers: { 1: ['Z'] } })).status,
      400,
    );
    const reload = await studentApi('GET', `/attempts/${attemptId}`, an.accessToken);
    assert.deepEqual((reload.body.answers as Json)['1'], ['B']);
    assert.deepEqual((reload.body.answers as Json)['2'], ['Đ', 'S', 'Đ', 'S']);
    // Học sinh khác không xem được lượt của bạn
    assert.equal((await studentApi('GET', `/attempts/${attemptId}`, binh.accessToken)).status, 404);
    assert.equal(
      (await studentApi('PUT', `/attempts/${attemptId}/answers`, binh.accessToken, { answers: {} })).status,
      404,
    );
    // Nộp kèm câu cuối: 2 + 2 + 2 = 6 điểm; chế độ hiện ngay
    const submitted = await studentApi('POST', `/attempts/${attemptId}/submit`, an.accessToken, {
      answers: { 3: [' 12.5 '] },
    });
    assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
    assert.deepEqual(
      [submitted.body.status, submitted.body.visible, submitted.body.total_score, submitted.body.max_score],
      ['submitted', true, 6, 6],
    );
    assert.equal(
      (await studentApi('PUT', `/attempts/${attemptId}/answers`, an.accessToken, { answers: { 1: ['A'] } })).status,
      422,
      'đã nộp thì không lưu thêm',
    );
    // Phiếu chấm của 22g2 được tạo cho lớp, nguồn "online", đủ điểm
    const session = await schoolYear
      .selectFrom('exam_sessions')
      .select(['id', 'status', 'class_id', 'score_kind'])
      .where('exam_id', '=', plainExamId)
      .executeTakeFirstOrThrow();
    assert.deepEqual([session.status, session.class_id], ['grading', classId]);
    const sheet = await schoolYear
      .selectFrom('exam_sheets')
      .select(['total_score', 'source', 'attempt_id', 'variant_code'])
      .where('session_id', '=', session.id)
      .where('child_id', '=', children.An as string)
      .executeTakeFirstOrThrow();
    assert.deepEqual(
      [Number(sheet.total_score), sheet.source, sheet.attempt_id, sheet.variant_code],
      [6, 'online', attemptId, '101'],
    );
    // Lượt hai làm sai hết: điểm cao nhất vẫn là lượt một; hết lượt thì không vào nữa
    const second = await startAttempt(an.accessToken, assignmentId);
    assert.equal(second.status, 200);
    const secondId = second.body.id as string;
    assert.equal(
      (await studentApi('POST', `/attempts/${secondId}/submit`, an.accessToken, { answers: { 1: ['A'] } })).body
        .total_score,
      0,
    );
    const afterSecond = await schoolYear
      .selectFrom('exam_sheets')
      .select(['total_score', 'attempt_id'])
      .where('session_id', '=', session.id)
      .where('child_id', '=', children.An as string)
      .executeTakeFirstOrThrow();
    assert.deepEqual([Number(afterSecond.total_score), afterSecond.attempt_id], [6, attemptId]);
    const third = await startAttempt(an.accessToken, assignmentId);
    assert.equal(third.status, 422, 'hết số lần làm bài');
    const mine = list((await studentApi('GET', '/exams', an.accessToken)).body.items);
    assert.deepEqual([mine[0]?.state, mine[0]?.attempts_used], ['closed', 2]);
    assert.deepEqual((mine[0]?.result as Json).total_score, 6);
    // Giáo viên theo dõi: hai lượt, số điểm
    const detail = await api('GET', `/online-exams/assignments/${assignmentId}`, as(math));
    const anRow = list(detail.body.students).find((row) => row.child_id === children.An) as Json;
    assert.deepEqual(
      list(anRow.attempts).map((row) => [row.attempt_no, row.status, row.total_score, row.sheet_synced]),
      [
        [1, 'submitted', 6, true],
        [2, 'submitted', 0, false],
      ],
    );
    const attemptDetail = await api('GET', `/online-exams/attempts/${attemptId}`, as(math));
    assert.equal(attemptDetail.status, 200);
    assert.deepEqual(
      list(attemptDetail.body.questions).map((row) => row.correct_answer),
      [['B'], ['Đ', 'S', 'Đ', 'S'], ['12,5']],
    );
    assert.equal((await api('GET', `/online-exams/attempts/${attemptId}`, as(other))).status, 403);
  });

  it('CT-23a-5: một phiên mỗi lượt: phiên thứ hai bị từ chối hoặc đóng phiên cũ; hết giờ máy chủ tự chốt', async () => {
    const reject = await createAssignment(plainExamId, { camera_enabled: false });
    const binh = students.Binh as Student;
    const started = await startAttempt(binh.accessToken, reject, 'off');
    assert.equal(started.status, 200, JSON.stringify(started.body));
    const attemptId = started.body.id as string;
    const secondToken = await signInStudent('Binh');
    const refused = await startAttempt(secondToken, reject, 'off');
    assert.equal(refused.status, 422);
    assert.match(JSON.stringify(refused.body), /replaced/);
    assert.equal(
      (await studentApi('GET', `/attempts/${attemptId}`, secondToken)).status,
      422,
      'phiên khác không đọc được lượt',
    );
    assert.equal(
      (await studentApi('PUT', `/attempts/${attemptId}/answers`, binh.accessToken, { answers: { 1: ['C'] } })).status,
      200,
    );
    const events = await schoolYear
      .selectFrom('exam_attempt_events')
      .select('event_type')
      .where('attempt_id', '=', attemptId)
      .execute();
    assert.deepEqual(
      events.map((row) => row.event_type),
      ['second_session'],
    );
    // Hết giờ: đặt hạn nộp về quá khứ, yêu cầu kế tiếp chốt lượt, điểm chốt theo câu đã lưu
    await schoolYear
      .updateTable('exam_attempts')
      .set({ deadline_at: new Date(Date.now() - 120_000) })
      .where('id', '=', attemptId)
      .execute();
    const expired = await studentApi('GET', `/attempts/${attemptId}`, binh.accessToken);
    assert.equal(expired.body.status, 'submitted');
    const row = await schoolYear
      .selectFrom('exam_attempts')
      .select(['status', 'submit_reason', 'total_score'])
      .where('id', '=', attemptId)
      .executeTakeFirstOrThrow();
    assert.deepEqual([row.status, row.submit_reason, Number(row.total_score)], ['submitted', 'timeout', 0]);
    // Đóng phiên cũ: phiên mới làm tiếp, phiên cũ bị báo đã bị thay
    const takeover = await createAssignment(plainExamId, { camera_enabled: false, single_session_mode: 'close_old' });
    const chi = students.Chi as Student;
    const oldStart = await startAttempt(chi.accessToken, takeover, 'off');
    const newToken = await signInStudent('Chi');
    const resumed = await startAttempt(newToken, takeover, 'off');
    assert.equal(resumed.status, 200, JSON.stringify(resumed.body));
    assert.equal(resumed.body.id, oldStart.body.id, 'làm tiếp đúng lượt đang làm');
    const replaced = await studentApi('PUT', `/attempts/${oldStart.body.id}/answers`, chi.accessToken, {
      answers: { 1: ['A'] },
    });
    assert.equal(replaced.status, 422);
    assert.match(JSON.stringify(replaced.body), /replaced/);
    assert.equal(
      (await studentApi('PUT', `/attempts/${oldStart.body.id}/answers`, newToken, { answers: { 1: ['A'] } })).status,
      200,
    );
  });

  it('CT-23a-6: sự kiện rời bài: gộp liền nhau, quá số lần thì đánh dấu hoặc tự nộp; camera chỉ là căn cứ', async () => {
    const flag = await createAssignment(plainExamId, {
      max_violations: 1,
      violation_action: 'flag',
      camera_enabled: true,
    });
    const auto = await createAssignment(plainExamId, {
      max_violations: 1,
      violation_action: 'auto_submit',
      camera_enabled: false,
    });
    const an = students.An as Student;
    const binh = students.Binh as Student;
    const startedFlag = await startAttempt(an.accessToken, flag, 'unavailable');
    assert.equal(startedFlag.status, 200, 'không có camera: cho vào và đánh dấu');
    const flagId = startedFlag.body.id as string;
    const first = await studentApi('POST', `/attempts/${flagId}/events`, an.accessToken, {
      events: [
        { type: 'fullscreen_exit', client_at: new Date().toISOString() },
        { type: 'window_blur', detail: { duration_ms: 1200 } },
        { type: 'no_face', detail: { duration_ms: 6000, faces: 0 } },
        { type: 'multiple_faces', detail: { faces: 2, note: 'bỏ' } },
      ],
    });
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.deepEqual(
      [first.body.violations, first.body.outcome],
      [1, 'warn'],
      'hai sự kiện liền nhau là một lần; camera không tính',
    );
    const stored = await schoolYear
      .selectFrom('exam_attempt_events')
      .select(['event_type', 'detail'])
      .where('attempt_id', '=', flagId)
      .execute();
    assert.ok(
      stored.every((row) => JSON.stringify(row.detail).indexOf('note') === -1),
      'chỉ nhận các số đo cho phép',
    );
    assert.equal(
      (await studentApi('POST', `/attempts/${flagId}/events`, an.accessToken, { events: [{ type: 'second_session' }] }))
        .status,
      400,
      'học sinh không tự báo phiên thứ hai',
    );
    assert.equal((await studentApi('POST', `/attempts/${flagId}/events`, an.accessToken, { events: [] })).status, 400);
    // Lần rời bài thứ hai cách xa lần đầu: vượt số lần cho phép (1), bài này chỉ đánh dấu
    await schoolYear
      .updateTable('exam_attempt_events')
      .set({ occurred_at: new Date(Date.now() - 60_000) })
      .where('attempt_id', '=', flagId)
      .execute();
    const second = await studentApi('POST', `/attempts/${flagId}/events`, an.accessToken, {
      events: [{ type: 'page_hidden' }],
    });
    assert.deepEqual([second.body.violations, second.body.outcome, second.body.status], [2, 'flag', 'in_progress']);
    const row = await schoolYear
      .selectFrom('exam_attempts')
      .select(['flagged', 'flag_reasons', 'camera_state'])
      .where('id', '=', flagId)
      .executeTakeFirstOrThrow();
    assert.deepEqual(
      [row.flagged, row.flag_reasons, row.camera_state],
      [true, ['camera_not_available', 'violation_limit'], 'unavailable'],
    );
    const monitor = await api('GET', `/online-exams/assignments/${flag}`, as(math));
    const anRow = list(monitor.body.students).find((item) => item.child_id === children.An) as Json;
    assert.equal(anRow.violations, 2);
    assert.deepEqual(Object.entries(anRow.event_counts as Json).sort(), [
      ['camera_unavailable', 1],
      ['fullscreen_exit', 1],
      ['multiple_faces', 1],
      ['no_face', 1],
      ['page_hidden', 1],
      ['window_blur', 1],
    ]);
    const detail = await api('GET', `/online-exams/attempts/${flagId}`, as(math));
    assert.equal(detail.body.flagged, true);
    assert.ok(list(detail.body.events).some((event) => event.label === 'Thoát toàn màn hình'));
    // Tự nộp khi vượt số lần cho phép
    const startedAuto = await startAttempt(binh.accessToken, auto, 'off');
    const autoId = startedAuto.body.id as string;
    await schoolYear
      .insertInto('exam_attempt_events')
      .values({ attempt_id: autoId, event_type: 'page_hidden', occurred_at: new Date(Date.now() - 60_000) })
      .execute();
    await studentApi('PUT', `/attempts/${autoId}/answers`, binh.accessToken, { answers: { 1: ['B'] } });
    const forced = await studentApi('POST', `/attempts/${autoId}/events`, binh.accessToken, {
      events: [{ type: 'fullscreen_exit' }],
    });
    assert.deepEqual([forced.body.outcome, forced.body.status], ['auto_submit', 'submitted']);
    const autoRow = await schoolYear
      .selectFrom('exam_attempts')
      .select(['submit_reason', 'total_score', 'flagged'])
      .where('id', '=', autoId)
      .executeTakeFirstOrThrow();
    assert.deepEqual([autoRow.submit_reason, Number(autoRow.total_score), autoRow.flagged], ['violation', 2, true]);
    // Giáo viên nộp thay lượt đang làm
    const startedForce = await createAssignment(plainExamId, { camera_enabled: false });
    const chi = students.Chi as Student;
    const chiAttempt = await startAttempt(chi.accessToken, startedForce, 'off');
    assert.equal(
      (await api('POST', `/online-exams/attempts/${chiAttempt.body.id}/force-submit`, as(other))).status,
      403,
    );
    const forcedByTeacher = await api('POST', `/online-exams/attempts/${chiAttempt.body.id}/force-submit`, as(math));
    assert.equal(forcedByTeacher.body.submit_reason, 'teacher');
    assert.equal(
      (await api('POST', `/online-exams/attempts/${chiAttempt.body.id}/force-submit`, as(math))).status,
      422,
    );
  });

  it('CT-23a-7: tự luận, giáo viên chấm, công bố kết quả, khoá điểm và chuyển vào sổ điểm theo luồng 22g2', async () => {
    const assignmentId = await createAssignment(essayExamId, { result_mode: 'teacher_release', camera_enabled: false });
    const an = students.An as Student;
    const binh = students.Binh as Student;
    const essayId = essayQuestionIds[3] as string;
    const take = async (student: Student, answers: Json) => {
      const started = await startAttempt(student.accessToken, assignmentId, 'off');
      assert.equal(started.status, 200, JSON.stringify(started.body));
      const submitted = await studentApi('POST', `/attempts/${started.body.id}/submit`, student.accessToken, {
        answers,
      });
      assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
      return { id: started.body.id as string, submitted };
    };
    const anAttempt = await take(an, { 1: ['B'], 2: ['Đ', 'S', 'Đ', 'S'], 3: ['12,5'], 4: ['Bài tự luận của An'] });
    const binhAttempt = await take(binh, { 1: ['A'], 2: ['Đ', 'S', 'Đ', 'S'], 3: ['12,5'], 4: ['Bài của Bình'] });
    assert.deepEqual(
      [anAttempt.submitted.body.visible, anAttempt.submitted.body.total_score],
      [false, null],
      'chế độ giáo viên công bố: chưa xem được',
    );
    const pending = await api('GET', `/online-exams/attempts/${anAttempt.id}`, as(math));
    assert.deepEqual(
      [pending.body.needs_marking, pending.body.total_score, pending.body.objective_score],
      [true, null, 6],
    );
    const essay = list(pending.body.questions).find((row) => row.type === 'essay') as Json;
    assert.deepEqual(essay.student_answer, ['Bài tự luận của An']);
    assert.equal(essay.guidance, 'Hướng dẫn chấm bí mật', 'giáo viên thấy hướng dẫn chấm');
    // Điểm tự luận: không quá điểm câu, đúng câu tự luận, đúng người
    const markPath = (id: string) => `/online-exams/attempts/${id}/essay-marks`;
    assert.equal((await api('PUT', markPath(anAttempt.id), as(math), { marks: { [essayId]: 5 } })).status, 400);
    assert.equal(
      (await api('PUT', markPath(anAttempt.id), as(math), { marks: { [essayQuestionIds[0] as string]: 1 } })).status,
      400,
    );
    assert.equal((await api('PUT', markPath(anAttempt.id), as(other), { marks: { [essayId]: 3 } })).status, 403);
    const marked = await api('PUT', markPath(anAttempt.id), as(math), { marks: { [essayId]: 3 } });
    assert.equal(marked.status, 200, JSON.stringify(marked.body));
    assert.deepEqual([marked.body.needs_marking, marked.body.total_score, marked.body.essay_score], [false, 9, 3]);
    assert.equal(
      (await api('PUT', markPath(binhAttempt.id), as(math), { marks: { [essayId]: 2 } })).body.total_score,
      6,
    );
    const hidden = await studentApi('GET', `/attempts/${anAttempt.id}/result`, an.accessToken);
    assert.deepEqual([hidden.body.visible, hidden.body.total_score], [false, null]);
    assert.equal(
      (await api('POST', `/online-exams/assignments/${assignmentId}/release-results`, as(other))).status,
      403,
    );
    await api('POST', `/online-exams/assignments/${assignmentId}/release-results`, as(math));
    const shown = await studentApi('GET', `/attempts/${anAttempt.id}/result`, an.accessToken);
    assert.deepEqual([shown.body.visible, shown.body.total_score, shown.body.max_score], [true, 9, 10]);
    assert.ok(
      list(shown.body.questions)
        .filter((row) => row.type !== 'essay')
        .every((row) => row.correct_answer === null),
      'còn trong giờ mở nên chưa hiện đáp án đúng',
    );
    // Luồng 22g2: phiếu của An, Bình do hệ thống ghi; Chi vắng do giáo viên ghi; khoá điểm; giáo viên xác nhận chuyển
    const session = await schoolYear
      .selectFrom('exam_sessions')
      .select(['id', 'status'])
      .where('exam_id', '=', essayExamId)
      .executeTakeFirstOrThrow();
    const sheets = await schoolYear
      .selectFrom('exam_sheets')
      .select(['child_id', 'total_score', 'source'])
      .where('session_id', '=', session.id)
      .execute();
    assert.deepEqual(
      sheets.map((row) => [row.child_id === children.An ? 'An' : 'Binh', Number(row.total_score), row.source]).sort(),
      [
        ['An', 9, 'online'],
        ['Binh', 6, 'online'],
      ],
    );
    const absent = await api('PUT', `/exam-grading/sessions/${session.id}/sheets/${children.Chi}`, as(math), {
      absent: true,
      variant_code: null,
    });
    assert.equal(absent.status, 200, JSON.stringify(absent.body));
    assert.equal((await api('POST', `/exam-grading/sessions/${session.id}/lock`, as(principal))).status, 200);
    const moved = await api('POST', `/exam-grading/sessions/${session.id}/transfer`, as(math));
    assert.equal(moved.status, 200, JSON.stringify(moved.body));
    const entries = await schoolYear
      .selectFrom('score_entries')
      .select(['child_id', 'score', 'source'])
      .where('subject_id', '=', subjectId)
      .execute();
    const scoreOf = (key: string) => entries.find((row) => row.child_id === children[key]);
    assert.deepEqual([Number(scoreOf('An')?.score), scoreOf('An')?.source], [9, 'exam']);
    assert.equal(Number(scoreOf('Binh')?.score), 6);
    assert.equal(scoreOf('Chi'), undefined, 'học sinh vắng bỏ qua theo cấu hình của bài');
    // Đã khoá điểm: lượt làm muộn không ghi đè phiếu
    assert.equal((await api('PUT', markPath(anAttempt.id), as(math), { marks: { [essayId]: 4 } })).status, 200);
    const frozen = await schoolYear
      .selectFrom('exam_sheets')
      .select('total_score')
      .where('session_id', '=', session.id)
      .where('child_id', '=', children.An as string)
      .executeTakeFirstOrThrow();
    assert.equal(Number(frozen.total_score), 9, 'phiếu đã khoá điểm không bị ghi đè');
  });

  it('CT-23a-8: công tắc theo cấp học, học sinh nghỉ học, học sinh chỉ thấy bài của mình, tải lưu nháp đồng thời', async () => {
    const an = students.An as Student;
    assert.equal((await api('GET', '/online-exams/settings', as(math))).status, 200);
    const before = list((await api('GET', '/online-exams/settings', as(principal))).body);
    assert.deepEqual(
      before.map((row) => [row.school_level, row.student_login_enabled]),
      [
        ['TH', true],
        ['THCS', true],
        ['THPT', true],
      ],
      'mặc định bật ở mọi cấp, kể cả Tiểu học',
    );
    assert.equal(
      (await api('PUT', '/online-exams/settings/THCS', as(math), { student_login_enabled: false })).status,
      403,
    );
    assert.equal(
      (await api('PUT', '/online-exams/settings/THCS', as(principal), { student_login_enabled: 'x' })).status,
      400,
    );
    assert.equal(
      (await api('PUT', '/online-exams/settings/MN', as(principal), { student_login_enabled: false })).status,
      400,
    );
    const off = await api('PUT', '/online-exams/settings/THCS', as(principal), { student_login_enabled: false });
    assert.equal(off.status, 200);
    assert.equal(
      (await studentApi('GET', '/exams', an.accessToken)).status,
      403,
      'cấp đã tắt: học sinh không dùng được',
    );
    assert.equal((await api('POST', '/online-exams/assignments', as(math), assignmentBody(plainExamId))).status, 422);
    await api('PUT', '/online-exams/settings/THCS', as(principal), { student_login_enabled: true });
    assert.equal((await studentApi('GET', '/exams', an.accessToken)).status, 200);
    // Tải: 45 yêu cầu lưu nháp cùng lúc vào cùng một lượt vẫn nhất quán
    const load = await createAssignment(plainExamId, { camera_enabled: false });
    const started = await startAttempt(an.accessToken, load, 'off');
    const attemptId = started.body.id as string;
    const t0 = Date.now();
    const results = await Promise.all(
      Array.from({ length: 45 }, (_unused, index) =>
        studentApi('PUT', `/attempts/${attemptId}/answers`, an.accessToken, {
          answers: { 3: [String(index)] },
        }),
      ),
    );
    assert.ok(results.every((row) => row.status === 200));
    assert.ok(Date.now() - t0 < 20_000);
    // Học sinh nghỉ học thì tài khoản bị tắt
    await schoolYear
      .updateTable('children')
      .set({ status: 'withdrawn' })
      .where('id', '=', children.An as string)
      .execute();
    const closed = await studentApi('GET', '/exams', an.accessToken);
    assert.equal(closed.status, 403);
    assert.match(JSON.stringify(closed.body), /không còn đang học/);
    await schoolYear
      .updateTable('children')
      .set({ status: 'active' })
      .where('id', '=', children.An as string)
      .execute();
    assert.equal((await studentApi('GET', '/exams', an.accessToken)).status, 200);
  });

  it('CT-23a-9: cấp lại mật khẩu thu hồi phiên cũ; mật khẩu cũ không còn dùng được', async () => {
    const chi = students.Chi as Student;
    const reissued = await api('POST', '/learning-accounts/issue', as(principal), {
      child_ids: [children.Chi],
      mode: 'reset',
    });
    assert.equal(reissued.status, 200, JSON.stringify(reissued.body));
    const item = list(reissued.body.items)[0] as Json;
    assert.equal(item.username, chi.username);
    assert.equal((await studentApi('GET', '/profile', chi.accessToken)).status, 401, 'phiên cũ bị thu hồi');
    const old = await postJson(identityUrl('/auth/login'), {
      login: chi.username,
      password: 'MatKhau2026',
      channel: 'student',
    });
    assert.equal(old.status, 401);
    const fresh = await postJson(identityUrl('/auth/login'), {
      login: chi.username,
      password: item.password as string,
      channel: 'student',
    });
    assert.equal(fresh.status, 200);
    assert.equal(fresh.body.password_change_required, true);
    const links = await schoolYear
      .selectFrom('student_learning_accounts')
      .select(['child_id', 'identity_user_id', 'reset_count'])
      .where('child_id', '=', children.Chi as string)
      .executeTakeFirstOrThrow();
    assert.equal(links.reset_count, 1);
    assert.ok(links.identity_user_id);
  });

  it('CT-23a-11: chế độ thi: mặc định tại trường, mã phòng thi, danh sách học sinh, dải mạng, đóng phòng, bật thi từ xa', async () => {
    const an = students.An as Student;
    const binh = students.Binh as Student;
    // Cấu hình: chỉ người quản lý đặt; dải mạng sai, mặc định từ xa khi chưa bật bị từ chối
    const settingsBody = {
      default_exam_mode: 'at-school',
      allow_remote: true,
      allowed_networks: [],
      room_code_minutes: 60,
    };
    assert.equal((await api('GET', '/online-exams/school-settings', as(math))).status, 200);
    assert.equal((await api('PUT', '/online-exams/school-settings', as(math), settingsBody)).status, 403);
    assert.equal(
      (
        await api('PUT', '/online-exams/school-settings', as(principal), {
          ...settingsBody,
          allowed_networks: ['10.0.0.0/33'],
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await api('PUT', '/online-exams/school-settings', as(principal), {
          ...settingsBody,
          allow_remote: false,
          default_exam_mode: 'remote',
        })
      ).status,
      400,
    );
    // Chưa bật thi từ xa thì giao bài từ xa bị từ chối; không nêu chế độ thì là tại trường
    assert.equal(
      (await api('PUT', '/online-exams/school-settings', as(principal), { ...settingsBody, allow_remote: false }))
        .status,
      200,
    );
    assert.equal((await api('POST', '/online-exams/assignments', as(math), assignmentBody(plainExamId))).status, 422);
    const atSchool = await api('POST', '/online-exams/assignments', as(math), {
      ...assignmentBody(plainExamId, { camera_enabled: false }),
      exam_mode: undefined,
    });
    assert.equal(atSchool.status, 201, JSON.stringify(atSchool.body));
    assert.equal(atSchool.body.exam_mode, 'at-school');
    const assignmentId = atSchool.body.id as string;
    assert.equal((await api('PUT', '/online-exams/school-settings', as(principal), settingsBody)).status, 200);

    // Chưa có phòng thi: không vào được; mã sai, thiếu mã cũng không
    const noCode = await startAttempt(an.accessToken, assignmentId, 'off');
    assert.equal(noCode.status, 422);
    assert.match(JSON.stringify(noCode.body), /room_code/);
    const startWith = (token: string, roomCode: string) =>
      studentApi('POST', `/exams/${assignmentId}/start`, token, { camera_state: 'off', room_code: roomCode });
    assert.equal((await startWith(an.accessToken, '000000')).status, 422);
    // Giám thị mở phòng chỉ cho An; người không dạy lớp, phụ huynh không mở được
    assert.equal((await api('POST', `/online-exams/assignments/${assignmentId}/rooms`, as(other), {})).status, 403);
    assert.equal((await api('POST', `/online-exams/assignments/${assignmentId}/rooms`, as(parent), {})).status, 403);
    assert.equal(
      (await api('POST', `/online-exams/assignments/${assignmentId}/rooms`, as(math), { child_ids: [children.Dung] }))
        .status,
      400,
      'học sinh ngoài danh sách được giao',
    );
    const opened = await api('POST', `/online-exams/assignments/${assignmentId}/rooms`, as(math), {
      child_ids: [children.An],
    });
    assert.equal(opened.status, 201, JSON.stringify(opened.body));
    const room = list(opened.body.rooms)[0] as Json;
    const code = room.code as string;
    assert.match(code, /^\d{6}$/);
    assert.deepEqual([room.open, room.students, room.entered], [true, 1, 0]);
    assert.equal((await startWith(binh.accessToken, code)).status, 422, 'Bình không có tên trong phòng');
    // Dải mạng: ngoài dải thì 403, trong dải (địa chỉ máy thử) thì vào được
    const ranged = (networks: string[]) =>
      api('PUT', '/online-exams/school-settings', as(principal), { ...settingsBody, allowed_networks: networks });
    assert.equal((await ranged(['10.0.0.0/8'])).status, 200);
    const outside = await startWith(an.accessToken, code);
    assert.equal(outside.status, 403, JSON.stringify(outside.body));
    assert.match(JSON.stringify(outside.body), /mạng của nhà trường/);
    assert.equal((await ranged(['127.0.0.0/8', '::1/128'])).status, 200);
    const entered = await startWith(an.accessToken, code);
    assert.equal(entered.status, 200, JSON.stringify(entered.body));
    const attemptId = entered.body.id as string;
    const roomRow = await schoolYear
      .selectFrom('exam_room_students')
      .select('entered_at')
      .where('child_id', '=', children.An as string)
      .executeTakeFirstOrThrow();
    assert.ok(roomRow.entered_at, 'ghi lúc học sinh vào phòng');
    // Đóng phòng: không vào được nữa, lượt đang làm vẫn lưu và nộp được
    assert.equal((await api('POST', `/online-exams/rooms/${room.id}/close`, as(other))).status, 403);
    const closed = await api('POST', `/online-exams/rooms/${room.id}/close`, as(math));
    assert.equal(closed.status, 200);
    assert.equal(list(closed.body.rooms)[0]?.open, false);
    assert.equal((await api('POST', `/online-exams/rooms/${room.id}/close`, as(math))).status, 422);
    assert.equal((await startWith(an.accessToken, code)).status, 422, 'phòng đã đóng');
    assert.equal(
      (await studentApi('PUT', `/attempts/${attemptId}/answers`, an.accessToken, { answers: { 1: ['B'] } })).status,
      200,
    );
    assert.equal((await studentApi('POST', `/attempts/${attemptId}/submit`, an.accessToken, {})).status, 200);
    // Bài từ xa không có phòng thi
    const remote = await createAssignment(plainExamId, { camera_enabled: false });
    assert.equal((await api('POST', `/online-exams/assignments/${remote}/rooms`, as(math), {})).status, 422);
    assert.equal((await startAttempt(binh.accessToken, remote, 'off')).status, 200, 'từ xa không cần mã phòng');
  });

  // ----- Giám thị camera (DT-23 phần 23e, YCTD-215): CT-23e-1 đến CT-23e-4 -----
  let proctoredId = '';
  let proctoredAttemptId = '';
  const WEBM = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x02, 0x03, 0x04]);
  const settingsWith = (changes: Json) => ({
    default_exam_mode: 'at-school',
    allow_remote: true,
    allowed_networks: [],
    room_code_minutes: 60,
    ...changes,
  });
  const authHeader = (token: string) => ({ authorization: `Bearer ${token}` });
  const uploadChunk = async (token: string, attemptId: string, seq: number, body: Buffer) => {
    const form = new FormData();
    form.append('chunk', new Blob([new Uint8Array(body)]), 'chunk.webm');
    form.append('seq', String(seq));
    const response = await fetch(url(`/student/attempts/${attemptId}/recording/chunks`), {
      method: 'POST',
      headers: authHeader(token),
      body: form,
    });
    return { status: response.status, body: (await response.json()) as Json };
  };
  const setConsentBody = (user: LoggedInUser, childId: string, scope: string, granted: boolean) =>
    api('PUT', '/online-exams/proctor/consents', as(user), {
      child_id: childId,
      scope,
      granted,
      guardian_name: granted ? 'Nguyễn Thị Mẹ An' : undefined,
    });
  const proctoredStart = (token: string, notice: boolean) =>
    studentApi('POST', `/exams/${proctoredId}/start`, token, { camera_state: 'granted', proctor_notice: notice });

  it('CT-23e-1: giám sát bằng camera mặc định tắt: trường bật rồi giáo viên bật theo bài giao', async () => {
    const before = await api('GET', '/online-exams/school-settings', as(principal));
    assert.deepEqual(
      [before.body.allow_live_proctoring, before.body.allow_recording, before.body.recording_retention_days],
      [false, false, 30],
    );
    const blocked = await api(
      'POST',
      '/online-exams/assignments',
      as(math),
      assignmentBody(plainExamId, { proctor_live: true }),
    );
    assert.equal(blocked.status, 422, 'trường chưa bật xem camera trực tiếp');
    assert.match(JSON.stringify(blocked.body), /proctor_live/);
    assert.equal(
      (await api('PUT', '/online-exams/school-settings', as(math), settingsWith({ allow_live_proctoring: true })))
        .status,
      403,
    );
    assert.equal(
      (
        await api(
          'PUT',
          '/online-exams/school-settings',
          as(principal),
          settingsWith({ allow_live_proctoring: true, recording_retention_days: 3 }),
        )
      ).status,
      400,
      'thời hạn giữ bản ghi từ 7 đến 90 ngày',
    );
    const enabled = await api(
      'PUT',
      '/online-exams/school-settings',
      as(principal),
      settingsWith({ allow_live_proctoring: true, allow_recording: true, recording_retention_days: 14 }),
    );
    assert.equal(enabled.status, 200, JSON.stringify(enabled.body));
    assert.deepEqual(
      [enabled.body.allow_live_proctoring, enabled.body.allow_recording, enabled.body.recording_retention_days],
      [true, true, 14],
    );
    const noCamera = await api(
      'POST',
      '/online-exams/assignments',
      as(math),
      assignmentBody(plainExamId, { proctor_live: true, camera_enabled: false }),
    );
    assert.equal(noCamera.status, 400, 'giám sát cần bật camera');
    proctoredId = await createAssignment(plainExamId, { proctor_live: true, proctor_record: true });
    const detail = await api('GET', `/online-exams/assignments/${proctoredId}`, as(math));
    assert.deepEqual([detail.body.proctor_live, detail.body.proctor_record], [true, true]);
    const listed = list((await studentApi('GET', '/exams', await signInStudent('An'))).body.items) as Json[];
    const mine = listed.find((row) => row.id === proctoredId);
    assert.deepEqual([mine?.proctor_live, mine?.proctor_record], [true, true]);
    // Tắt công tắc của trường thì cấu hình cũ giữ nguyên khi chỉ sửa chế độ thi
    const kept = await api('PUT', '/online-exams/school-settings', as(principal), settingsWith({}));
    assert.deepEqual([kept.body.allow_live_proctoring, kept.body.allow_recording], [true, true]);
  });

  it('CT-23e-2: thông báo trước khi vào thi, cha mẹ đồng ý theo từng loại (dưới 16 tuổi), trường ghi nhận, thu hồi', async () => {
    const an = students.An as Student;
    const binh = students.Binh as Student;
    an.accessToken = await signInStudent('An');
    binh.accessToken = await signInStudent('Binh');
    const noNotice = await proctoredStart(an.accessToken, false);
    assert.equal(noNotice.status, 422);
    assert.match(JSON.stringify(noNotice.body), /proctor_notice/);
    const noConsent = await proctoredStart(an.accessToken, true);
    assert.equal(noConsent.status, 422);
    assert.match(JSON.stringify(noConsent.body), /proctor_consent/);
    // Giáo viên không quản lý đề không ghi nhận đồng ý thay cha mẹ; người quản lý ghi nhận văn bản
    const consentBody = (scope: string, granted: boolean) => ({
      child_id: children.An,
      scope,
      granted,
      guardian_name: 'Nguyễn Thị Mẹ An',
      note: 'Giấy đồng ý ngày 2026-10-20',
    });
    assert.equal((await api('PUT', '/online-exams/proctor/consents', as(math), consentBody('live', true))).status, 403);
    assert.equal(
      (
        await api('PUT', '/online-exams/proctor/consents', as(principal), {
          ...consentBody('live', true),
          guardian_name: '',
        })
      ).status,
      400,
      'phải nêu người đồng ý',
    );
    const recorded = await api('PUT', '/online-exams/proctor/consents', as(principal), consentBody('live', true));
    assert.equal(recorded.status, 200, JSON.stringify(recorded.body));
    assert.ok((recorded.body.live as Json | null)?.granted_at);
    assert.equal(recorded.body.record, null);
    const stillMissing = await proctoredStart(an.accessToken, true);
    assert.equal(stillMissing.status, 422, 'còn thiếu đồng ý ghi hình');
    assert.match(JSON.stringify(stillMissing.body), /record/);
    // Phụ huynh đồng ý trên ứng dụng: chỉ thấy và chỉ đặt được cho con mình
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: 'ME-23E', name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    const guardian = await schoolYear
      .insertInto('guardians')
      .values({ full_name: 'Nguyễn Thị Mẹ An', phone: '0901234567', user_id: parent.userId })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('child_guardians')
      .values({
        child_id: children.An as string,
        guardian_id: guardian.id,
        relationship_item_id: relationship.id,
        is_primary: true,
      })
      .execute();
    const mine = await api('GET', '/parent/exam-proctor-consents', as(parent));
    assert.equal(mine.status, 200);
    assert.deepEqual(
      list(mine.body.items).map((row) => row.child_id),
      [children.An],
    );
    assert.equal(list(mine.body.items)[0]?.needs_parent_consent, true);
    const setByParent = (token: string, childId: string, scope: string, granted: boolean) =>
      api('PUT', '/parent/exam-proctor-consents', token, { child_id: childId, scope, granted });
    assert.equal((await setByParent(as(parent), children.Binh as string, 'record', true)).status, 403);
    assert.equal(
      (await setByParent(as(math), children.An as string, 'record', true)).status,
      403,
      'không phải phụ huynh của học sinh',
    );
    assert.equal((await setByParent(as(parent), children.An as string, 'video', true)).status, 400);
    const granted = await setByParent(as(parent), children.An as string, 'record', true);
    assert.equal(granted.status, 200, JSON.stringify(granted.body));
    assert.equal((granted.body.record as Json).source, 'parent');
    // Binh chưa có đồng ý nên không vào được; An vào được và lượt làm ghi lúc xác nhận thông báo
    assert.equal((await proctoredStart(binh.accessToken, true)).status, 422);
    const started = await proctoredStart(an.accessToken, true);
    assert.equal(started.status, 200, JSON.stringify(started.body));
    proctoredAttemptId = started.body.id as string;
    assert.deepEqual(
      [(started.body.policy as Json).proctor_live, (started.body.policy as Json).proctor_record],
      [true, true],
    );
    const row = await schoolYear
      .selectFrom('exam_attempts')
      .select('proctor_notice_at')
      .where('id', '=', proctoredAttemptId)
      .executeTakeFirstOrThrow();
    assert.ok(row.proctor_notice_at);
    // Bài không bật giám sát thì không cần thông báo, đồng ý
    const plain = await createAssignment(plainExamId, { camera_enabled: false });
    assert.equal((await startAttempt(binh.accessToken, plain, 'off')).status, 200);
  });

  it('CT-23e-3: xem trực tiếp: báo hiệu WebRTC qua máy chủ, phân quyền, nhật ký người xem, thu hồi đồng ý có hiệu lực ngay', async () => {
    const an = students.An as Student;
    const binh = students.Binh as Student;
    const attemptId = proctoredAttemptId;
    assert.equal((await api('POST', `/online-exams/attempts/${attemptId}/proctor/views`, as(other))).status, 403);
    assert.equal((await api('POST', `/online-exams/attempts/${attemptId}/proctor/views`, as(parent))).status, 403);
    const view = await api('POST', `/online-exams/attempts/${attemptId}/proctor/views`, as(math));
    assert.equal(view.status, 200, JSON.stringify(view.body));
    const viewId = view.body.view_id as string;
    assert.equal((await api('GET', '/online-exams/proctor/ice', as(math))).status, 200);
    assert.ok(Array.isArray((await studentApi('GET', '/proctor/ice', an.accessToken)).body.ice_servers));
    // Giáo viên gửi offer; chỉ offer và ice, người khác không dùng được phiên này
    assert.equal(
      (await api('POST', `/online-exams/proctor/views/${viewId}/signals`, as(math), { kind: 'answer', payload: 'x' }))
        .status,
      400,
    );
    assert.equal(
      (await api('POST', `/online-exams/proctor/views/${viewId}/signals`, as(other), { kind: 'offer', payload: 'x' }))
        .status,
      404,
    );
    assert.equal(
      (
        await api('POST', `/online-exams/proctor/views/${viewId}/signals`, as(math), {
          kind: 'offer',
          payload: 'sdp-offer',
        })
      ).status,
      200,
    );
    // Học sinh hỏi định kỳ: thấy một người đang xem và nhận offer; học sinh khác không hỏi được bài này
    const polled = await studentApi('GET', `/attempts/${attemptId}/proctor?after=0`, an.accessToken);
    assert.equal(polled.status, 200, JSON.stringify(polled.body));
    assert.deepEqual([polled.body.active, polled.body.watching], [true, 1]);
    const signals = list(polled.body.signals);
    assert.deepEqual([signals[0]?.kind, signals[0]?.payload, signals[0]?.view_id], ['offer', 'sdp-offer', viewId]);
    assert.equal((await studentApi('GET', `/attempts/${attemptId}/proctor`, binh.accessToken)).status, 404);
    const again = await studentApi('GET', `/attempts/${attemptId}/proctor?after=${polled.body.cursor}`, an.accessToken);
    assert.equal(list(again.body.signals).length, 0, 'thông điệp đã nhận không gửi lại');
    // Học sinh trả lời; không gửi được offer hay trả lời vào phiên không có thật
    const answer = (kind: string, id = viewId) =>
      studentApi('POST', `/attempts/${attemptId}/proctor/signals`, an.accessToken, {
        view_id: id,
        kind,
        payload: 'sdp-answer',
      });
    assert.equal((await answer('offer')).status, 400);
    assert.equal((await answer('answer', randomUUID())).status, 422);
    assert.equal((await answer('answer')).status, 200);
    const received = await api('GET', `/online-exams/proctor/views/${viewId}/signals?after=0`, as(math));
    assert.equal(received.status, 200);
    assert.equal(received.body.ended, false);
    assert.deepEqual(
      list(received.body.signals).map((signal) => [signal.kind, signal.payload]),
      [['answer', 'sdp-answer']],
    );
    // Kết thúc phiên: giáo viên và học sinh cùng thấy đã ngắt
    assert.equal((await api('DELETE', `/online-exams/proctor/views/${viewId}`, as(math))).status, 200);
    assert.equal((await api('GET', `/online-exams/proctor/views/${viewId}/signals`, as(math))).body.ended, true);
    assert.equal((await studentApi('GET', `/attempts/${attemptId}/proctor`, an.accessToken)).body.watching, 0);
    assert.equal((await answer('answer')).status, 422);
    // Nhật ký người xem
    const log = await api('GET', `/online-exams/attempts/${attemptId}/proctor`, as(math));
    assert.equal(log.status, 200);
    const views = list(log.body.views);
    assert.equal(views.length, 1);
    assert.deepEqual([views[0]?.kind, views[0]?.viewer_name !== undefined], ['live', true]);
    assert.equal((await api('GET', `/online-exams/attempts/${attemptId}/proctor`, as(other))).status, 403);
    // Thu hồi đồng ý xem trực tiếp: không mở được phiên mới
    const revoke = await api('PUT', '/online-exams/proctor/consents', as(principal), {
      child_id: children.An,
      scope: 'live',
      granted: false,
    });
    assert.equal(revoke.status, 200);
    const refused = await api('POST', `/online-exams/attempts/${attemptId}/proctor/views`, as(math));
    assert.equal(refused.status, 422);
    assert.match(JSON.stringify(refused.body), /đồng ý/);
    // Người quản lý tắt xem trực tiếp cho cả trường cũng chặn
    await api('PUT', '/online-exams/proctor/consents', as(principal), {
      ...{ child_id: children.An, scope: 'live', granted: true, guardian_name: 'Nguyễn Thị Mẹ An' },
    });
    assert.equal(
      (await api('PUT', '/online-exams/school-settings', as(principal), settingsWith({ allow_live_proctoring: false })))
        .status,
      200,
    );
    assert.equal((await api('POST', `/online-exams/attempts/${attemptId}/proctor/views`, as(math))).status, 422);
    assert.equal(
      (await api('PUT', '/online-exams/school-settings', as(principal), settingsWith({ allow_live_proctoring: true })))
        .status,
      200,
    );
    assert.equal((await api('POST', `/online-exams/attempts/${attemptId}/proctor/views`, as(math))).status, 200);
  });

  it('CT-23e-4: ghi hình: tải từng đoạn đã mã hoá, chỉ người giao bài và quản lý xem lại, nhật ký, hết hạn thì xoá', async () => {
    const an = students.An as Student;
    const binh = students.Binh as Student;
    const attemptId = proctoredAttemptId;
    const first = Buffer.concat([WEBM, Buffer.from('doan-dau')]);
    const second = Buffer.from('doan-hai');
    assert.equal((await uploadChunk(an.accessToken, attemptId, 0, Buffer.from('khong-phai-webm'))).status, 400);
    assert.equal(
      (await uploadChunk(binh.accessToken, attemptId, 0, first)).status,
      404,
      'không tải vào bài người khác',
    );
    const stored = await uploadChunk(an.accessToken, attemptId, 0, first);
    assert.deepEqual([stored.status, stored.body.stored], [200, true]);
    assert.equal((await uploadChunk(an.accessToken, attemptId, 0, first)).body.stored, false, 'gửi lại thì bỏ qua');
    assert.equal((await uploadChunk(an.accessToken, attemptId, 1, second)).body.stored, true);
    // Tệp ở kho đã mã hoá
    const storage = environment.api.get(FileStorage);
    const raw = await storage.get(`exam-recordings/${attemptId}/0`);
    assert.ok(!raw.includes(Buffer.from('doan-dau')), 'bản ghi lưu dạng mã hoá');
    // Xem lại: người giao bài xem được; giáo viên khác, phụ huynh không
    const watch = (token: string) =>
      fetch(url(`/online-exams/attempts/${attemptId}/recording`), { headers: authHeader(token) });
    assert.equal((await watch(as(other))).status, 403);
    assert.equal((await watch(as(parent))).status, 403);
    const played = await watch(as(math));
    assert.equal(played.status, 200);
    assert.equal(played.headers.get('content-type'), 'video/webm');
    assert.match(played.headers.get('cache-control') ?? '', /no-store/);
    assert.equal(played.headers.get('content-disposition'), 'inline');
    assert.deepEqual(Buffer.from(await played.arrayBuffer()), Buffer.concat([first, second]));
    const principalWatch = await watch(as(principal));
    assert.equal(principalWatch.status, 200, 'người quản lý xem được');
    await principalWatch.arrayBuffer();
    const info = await api('GET', `/online-exams/attempts/${attemptId}/proctor`, as(math));
    assert.deepEqual([(info.body.recording as Json).chunks, info.body.can_watch_recording], [2, true]);
    assert.equal(list(info.body.views).filter((row) => row.kind === 'recording').length, 2, 'mỗi lần xem ghi nhật ký');
    // Thu hồi đồng ý ghi hình có hiệu lực ngay; trường tắt ghi hình cũng chặn
    assert.equal((await setConsentBody(principal, children.An as string, 'record', false)).status, 200);
    assert.equal((await uploadChunk(an.accessToken, attemptId, 2, second)).status, 422);
    assert.equal((await setConsentBody(principal, children.An as string, 'record', true)).status, 200);
    assert.equal((await uploadChunk(an.accessToken, attemptId, 2, second)).body.stored, true);
    assert.equal(
      (await api('PUT', '/online-exams/school-settings', as(principal), settingsWith({ allow_recording: false })))
        .status,
      200,
    );
    assert.equal((await uploadChunk(an.accessToken, attemptId, 3, second)).status, 422);
    assert.equal(
      (await api('PUT', '/online-exams/school-settings', as(principal), settingsWith({ allow_recording: true })))
        .status,
      200,
    );
    // Nộp bài rồi thì không nhận thêm đoạn; hết hạn thì xoá cả tệp ở kho
    assert.equal((await studentApi('POST', `/attempts/${attemptId}/submit`, an.accessToken, {})).status, 200);
    assert.equal((await uploadChunk(an.accessToken, attemptId, 3, second)).status, 422);
    await schoolYear
      .updateTable('exam_recording_chunks')
      .set({ expires_at: new Date(Date.now() - 1000) })
      .where('attempt_id', '=', attemptId)
      .execute();
    assert.equal((await watch(as(math))).status, 404, 'hết hạn giữ thì không xem lại được');
    const purged = await environment.api.get(ExamProctoringService).purgeExpired();
    assert.equal(purged.chunks, 3);
    await assert.rejects(storage.get(`exam-recordings/${attemptId}/0`));
    assert.equal(
      (await schoolYear.selectFrom('exam_recording_chunks').select('seq').where('attempt_id', '=', attemptId).execute())
        .length,
      0,
    );
  });

  // Đích nhóm của bộ nhóm (DT-28 phần 28a, YCTD-271): thành viên lúc giao được giao như học sinh, đổi nhóm sau đó không đổi bài
  it('CT-28a-14: giao đề cho nhóm của bộ nhóm: chỉ thành viên lúc giao làm bài; nhóm của bộ đã lưu trữ bị từ chối', async () => {
    const addSet = async (status: 'active' | 'archived') =>
      (
        await schoolYear
          .insertInto('group_sets')
          .values({
            org_unit_id: unitId,
            class_id: classId,
            name: `Bộ nhóm thi ${status}`,
            purpose: 'subject',
            method: 'manual',
            status,
            owner_user_id: math.userId,
            owner_name: 'Giáo viên Toán',
            replaces_id: null,
            archived_at: null,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    const addGroup = async (setId: string, name: string, members: string[]) => {
      const group = await schoolYear
        .insertInto('child_groups')
        .values({
          org_unit_id: unitId,
          name,
          created_by: math.userId,
          group_set_id: setId,
          class_id: classId,
          position: 1,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await schoolYear
        .insertInto('child_group_members')
        .values(members.map((childId) => ({ group_id: group.id, child_id: childId, added_by: math.userId })))
        .execute();
      return group.id;
    };
    const star = await addGroup(await addSet('active'), 'Nhóm Sao', [children.An as string, children.Binh as string]);
    const old = await addGroup(await addSet('archived'), 'Nhóm cũ', [children.Chi as string]);
    const assignment = await createAssignment(plainExamId, {
      title: 'Kiểm tra theo nhóm',
      class_ids: [],
      group_ids: [star],
    });
    const detail = await api('GET', `/online-exams/assignments/${assignment}`, as(math));
    assert.equal(detail.status, 200, JSON.stringify(detail.body));
    assert.deepEqual(detail.body.targets, [{ kind: 'group', label: 'Nhóm Sao' }]);
    const rows = await schoolYear
      .selectFrom('exam_assignment_targets')
      .select(['kind', 'child_id', 'group_id'])
      .where('assignment_id', '=', assignment)
      .execute();
    assert.equal(rows.filter((row) => row.kind === 'group').length, 1);
    assert.deepEqual(
      rows
        .filter((row) => row.kind === 'student')
        .map((row) => row.child_id)
        .sort(),
      [children.An, children.Binh].sort(),
    );
    assert.ok(rows.every((row) => row.group_id === star));
    // Đổi nhóm sau khi giao không đổi danh sách làm bài
    await schoolYear
      .deleteFrom('child_group_members')
      .where('group_id', '=', star)
      .where('child_id', '=', children.Binh as string)
      .execute();
    const again = await api('GET', `/online-exams/assignments/${assignment}`, as(math));
    assert.equal((again.body.students as unknown[]).length, 2);
    const an = students.An as Student;
    const mine = list((await studentApi('GET', '/exams', an.accessToken)).body.items);
    assert.ok(mine.some((row) => row.title === 'Kiểm tra theo nhóm'));
    assert.equal(
      (
        await api(
          'POST',
          '/online-exams/assignments',
          as(math),
          assignmentBody(plainExamId, { class_ids: [], group_ids: [old] }),
        )
      ).status,
      404,
      'nhóm của bộ đã lưu trữ',
    );
  });
});
