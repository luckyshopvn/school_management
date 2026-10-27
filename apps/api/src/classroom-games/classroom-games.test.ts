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
import { correctRate, judgeAnswer, readGameSession } from './classroom-games.js';

// Trò chơi kiến thức và thẻ đáp án giấy (DT-23 phần 23c, YCTD-213), kịch bản CT-23c-4 đến CT-23c-6: kiểm tra dữ liệu gửi lên, chấm
// lại theo đáp án trong ngân hàng, chỉ câu đã duyệt của khối của lớp, ghi lịch sử sử dụng câu hỏi kèm tỷ lệ đúng, chống trùng khi
// gửi lại, phạm vi lớp của giáo viên. Học sinh, câu hỏi là dữ liệu giả
describe('Kiểm tra dữ liệu trò chơi', () => {
  it('CT-23c-4: lượt chơi hợp lệ; sai thì báo lỗi nhập liệu; chấm lại câu trắc nghiệm; tỷ lệ đúng', () => {
    const question = randomUUID();
    const body = {
      client_id: randomUUID(),
      class_id: randomUUID(),
      kind: 'answer_cards',
      title: 'Thẻ đáp án',
      question_ids: [question],
      answers: [{ question_id: question, child_id: randomUUID(), answer: 'b' }],
      group_scores: { 'Nhóm 1': 3.4, '': 5, 'Nhóm 2': 'x' },
    };
    const parsed = readGameSession(body);
    assert.deepEqual(parsed.group_scores, { 'Nhóm 1': 3 });
    for (const wrong of [
      { ...body, kind: 'co-tuong' },
      { ...body, question_ids: [] },
      { ...body, answers: [{ question_id: randomUUID(), group_name: 'A', correct: true }] },
      { ...body, answers: [{ question_id: question, child_id: randomUUID(), group_name: 'A' }] },
      { ...body, client_id: 'x' },
    ]) {
      assert.throws(() => readGameSession(wrong), { code: 'ERR_VALIDATION' }, JSON.stringify(wrong));
    }
    const mc = { question_type: 'multiple_choice' as const, answer: ['B'] };
    assert.equal(
      judgeAnswer(mc, { question_id: question, child_id: null, group_name: null, answer: 'b', correct: false }),
      true,
    );
    assert.equal(
      judgeAnswer(mc, { question_id: question, child_id: null, group_name: null, answer: 'C', correct: true }),
      false,
    );
    const short = { question_type: 'short_answer' as const, answer: ['Hà Nội'] };
    assert.equal(
      judgeAnswer(short, { question_id: question, child_id: null, group_name: 'N1', answer: null, correct: true }),
      true,
    );
    assert.equal(correctRate([true, false, null, true]), 66.67);
    assert.equal(correctRate([null]), null);
  });
});

describe('Điểm cuối trò chơi ở màn hình lớp', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let teacher: LoggedInUser;
  let otherTeacher: LoggedInUser;
  let classId = '';
  let subjectId = '';
  const children: string[] = [];
  const approved: string[] = [];
  let draftId = '';
  let otherGradeId = '';
  const url = (path: string) => `${environment.baseUrl}${path}`;
  const api = (method: string, path: string, token: string, body?: unknown) => sendJson(method, url(path), token, body);

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
    const unitId = (
      await api('POST', '/org-units', principal.accessToken, {
        code: 'TH-23C',
        name: 'Trường tiểu học thử',
        unit_type: 'truong_chinh',
      })
    ).body.id as string;
    const current = await api('GET', '/school-levels', principal.accessToken);
    const levels = (current.body.levels as Array<Record<string, unknown>>).map(
      ({ code, order_no, display_name, learner_term, context_label }) => ({
        code,
        is_enabled: code === 'MN' || code === 'TH',
        order_no,
        display_name,
        learner_term,
        context_label,
      }),
    );
    assert.equal((await api('PUT', '/school-levels', principal.accessToken, { levels })).status, 200);
    assert.equal(
      (await api('POST', '/grade-levels/templates', principal.accessToken, { school_level: 'TH' })).status,
      200,
    );
    teacher = await environment.loginAs('VT-07', unitId);
    otherTeacher = await environment.loginAs('VT-07', unitId);
    classId = (
      await schoolYear
        .insertInto('classes')
        .values({
          org_unit_id: unitId,
          academic_year_id: academicYearId,
          code: '3A',
          name: 'Lớp 3A',
          grade_level: 'K3',
          school_level: 'TH',
          max_size: 35,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    const assigned = await api('POST', `/classes/${classId}/staff-assignments`, principal.accessToken, {
      staff_user_id: teacher.userId,
      assignment_role: 'homeroom',
    });
    assert.equal(assigned.status, 201, JSON.stringify(assigned.body));
    for (const [index, name] of ['Học sinh An', 'Học sinh Bình', 'Học sinh Chi'].entries()) {
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitId,
          full_name: name,
          dob: '2018-03-01',
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
      children.push(child.id);
      await schoolYear
        .insertInto('class_enrollments')
        .values({ child_id: child.id, class_id: classId, from_date: '2026-09-05', order_number: index + 1 })
        .execute();
    }
    const subjects = (await api('GET', '/subjects?school_level=TH', principal.accessToken)).body as unknown as Array<{
      id: string;
    }>;
    subjectId = (Array.isArray(subjects) ? subjects : (subjects as { items: Array<{ id: string }> }).items)[0]
      ?.id as string;
    // Chưa có môn Tiểu học theo mẫu thì tạo một môn giả
    subjectId ||= (
      await schoolYear
        .insertInto('subjects')
        .values({ code: 'TH-THU-23C', name: 'Môn thử', school_level: 'TH' })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    const question = (values: {
      type: 'multiple_choice' | 'short_answer';
      grade: string;
      status: 'approved' | 'draft';
      answer: string[];
    }) =>
      schoolYear
        .insertInto('questions')
        .values({
          school_level: 'TH',
          subject_id: subjectId,
          grade_level_code: values.grade,
          cognitive_level: 'recognition',
          question_type: values.type,
          content: `Câu ${values.type} ${values.grade} ${values.status}`,
          options: JSON.stringify(
            values.type === 'multiple_choice'
              ? ['A', 'B', 'C', 'D'].map((key) => ({ key, content: `Lựa chọn ${key}` }))
              : [],
          ),
          answer: JSON.stringify(values.answer),
          score: 1,
          status: values.status,
          author_user_id: principal.userId,
          author_name: 'Giáo viên giả',
        })
        .returning('id')
        .executeTakeFirstOrThrow();
    approved.push((await question({ type: 'multiple_choice', grade: 'K3', status: 'approved', answer: ['B'] })).id);
    approved.push((await question({ type: 'short_answer', grade: 'K3', status: 'approved', answer: ['Hà Nội'] })).id);
    draftId = (await question({ type: 'multiple_choice', grade: 'K3', status: 'draft', answer: ['A'] })).id;
    otherGradeId = (await question({ type: 'multiple_choice', grade: 'K4', status: 'approved', answer: ['A'] })).id;
  });

  after(async () => {
    await schoolYear?.destroy();
    await environment?.close();
  });

  it('CT-23c-5: chỉ câu đã duyệt của khối của lớp; giáo viên không phụ trách lớp bị từ chối', async () => {
    const catalog = await api('GET', `/classroom-games/classes/${classId}/catalog`, teacher.accessToken);
    assert.equal(catalog.status, 200, JSON.stringify(catalog.body));
    const subject = (catalog.body.subjects as Array<{ id: string; counts: Record<string, number> }>).find(
      (item) => item.id === subjectId,
    );
    assert.deepEqual(subject?.counts, { multiple_choice: 1, short_answer: 1 });
    const list = await api(
      'GET',
      `/classroom-games/classes/${classId}/questions?subject_id=${subjectId}&types=multiple_choice,short_answer&limit=10`,
      teacher.accessToken,
    );
    assert.equal(list.status, 200);
    const ids = (list.body.items as Array<{ id: string }>).map((item) => item.id).sort();
    assert.deepEqual(ids, [...approved].sort());
    assert.ok(!ids.includes(draftId) && !ids.includes(otherGradeId));
    assert.equal(
      (await api('GET', `/classroom-games/classes/${classId}/catalog`, otherTeacher.accessToken)).status,
      403,
    );
    assert.equal((await api('GET', `/classroom-games/classes/${classId}/questions`, teacher.accessToken)).status, 400);
  });

  it('CT-23c-6: lưu lượt chơi: chấm lại theo ngân hàng, ghi lịch sử sử dụng câu hỏi kèm tỷ lệ đúng; gửi lại không trùng; câu nháp bị từ chối', async () => {
    const clientId = randomUUID();
    const body = {
      client_id: clientId,
      class_id: classId,
      kind: 'answer_cards',
      title: 'Thẻ đáp án giấy (1 câu)',
      started_at: new Date(Date.now() - 600_000).toISOString(),
      finished_at: new Date().toISOString(),
      question_ids: [approved[0]],
      // Máy gửi `correct` sai: máy chủ chấm lại theo đáp án B
      answers: [
        { question_id: approved[0], child_id: children[0], answer: 'B', correct: false },
        { question_id: approved[0], child_id: children[1], answer: 'B', correct: false },
        { question_id: approved[0], child_id: children[2], answer: 'D', correct: true },
      ],
    };
    const saved = await api('POST', '/classroom-games/sessions', teacher.accessToken, body);
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.duplicate, false);
    const again = await api('POST', '/classroom-games/sessions', teacher.accessToken, body);
    assert.equal(again.body.id, saved.body.id);
    assert.equal(again.body.duplicate, true);
    const usages = await schoolYear
      .selectFrom('question_usages')
      .select(['question_id', 'source', 'exam_id', 'attempts', 'correct_rate'])
      .where('game_session_id', '=', saved.body.id as string)
      .execute();
    assert.deepEqual(
      usages.map((row) => ({ ...row, correct_rate: Number(row.correct_rate) })),
      [{ question_id: approved[0], source: 'game', exam_id: null, attempts: 3, correct_rate: 66.67 }],
    );
    const question = await schoolYear
      .selectFrom('questions')
      .select(['use_count', 'last_used_at'])
      .where('id', '=', approved[0] as string)
      .executeTakeFirstOrThrow();
    assert.equal(question.use_count, 1);
    assert.ok(question.last_used_at);

    // Hỏi đáp theo nhóm: câu trả lời ngắn theo đánh giá của giáo viên
    const quiz = await api('POST', '/classroom-games/sessions', teacher.accessToken, {
      client_id: randomUUID(),
      class_id: classId,
      kind: 'quiz_rounds',
      title: 'Hỏi đáp theo vòng',
      question_ids: [approved[1]],
      group_scores: { 'Nhóm 1': 2, 'Nhóm 2': 0 },
      answers: [
        { question_id: approved[1], group_name: 'Nhóm 1', correct: true },
        { question_id: approved[1], group_name: 'Nhóm 2', correct: false },
      ],
    });
    assert.equal(quiz.status, 200, JSON.stringify(quiz.body));
    const detail = await api('GET', `/classroom-games/sessions/${quiz.body.id as string}`, teacher.accessToken);
    assert.equal((detail.body.questions as Array<{ correct_rate: number }>)[0]?.correct_rate, 50);
    const history = await api('GET', `/classroom-games/classes/${classId}/sessions`, teacher.accessToken);
    assert.equal((history.body.items as unknown[]).length, 2);

    const rejected = await api('POST', '/classroom-games/sessions', teacher.accessToken, {
      ...body,
      client_id: randomUUID(),
      question_ids: [draftId],
      answers: [],
    });
    assert.equal(rejected.status, 400);
    const strange = await api('POST', '/classroom-games/sessions', teacher.accessToken, {
      ...body,
      client_id: randomUUID(),
      answers: [{ question_id: approved[0], child_id: randomUUID(), answer: 'A' }],
    });
    assert.equal(strange.status, 400, 'học sinh không thuộc lớp');
    assert.equal(
      (await api('POST', '/classroom-games/sessions', otherTeacher.accessToken, { ...body, client_id: randomUUID() }))
        .status,
      403,
    );
    // Bảng đề thi cũ của 22g2 vẫn ghi được (ràng buộc nguồn của question_usages)
    const examUsage = await schoolYear
      .selectFrom('question_usages')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .where('source', '=', 'exam')
      .executeTakeFirstOrThrow();
    assert.equal(Number(examUsage.count), 0);
  });
});
