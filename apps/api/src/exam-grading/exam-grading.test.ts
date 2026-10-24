import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import ExcelJS from 'exceljs';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { parseAnswerCell } from './exam-grading.js';
import {
  gradeObjective,
  gradeSheet,
  groupRates,
  questionStats,
  scoreDistribution,
  type GradedQuestion,
} from './grading-rules.js';

// Chấm bài kiểm tra (DT-21 phần 22g2, YCTD-173), kịch bản CT-22g2-1 đến CT-22g2-6. Dữ liệu giả, cấp THCS
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

const question = (id: string, type: GradedQuestion['question_type'], score: number, topic = 'Số'): GradedQuestion => ({
  question_id: id,
  question_type: type,
  cognitive_level: type === 'essay' ? 'application' : 'recognition',
  topic_name: topic,
  score,
});

describe('Chấm phiếu, thống kê câu hỏi', () => {
  it('CT-22g2-1: chấm từng dạng câu, đúng sai bậc thang và tỉ lệ, tự luận hai người chấm, độ khó, độ phân biệt', () => {
    assert.equal(gradeObjective('multiple_choice', ['B'], ['b'], 0.25, 'tiered'), 0.25);
    assert.equal(gradeObjective('multiple_choice', ['B'], ['B', 'C'], 0.25, 'tiered'), 0);
    assert.equal(gradeObjective('multiple_choice', ['B'], [], 0.25, 'tiered'), 0);
    // Đúng sai 4 ý: 1 ý 0,1; 2 ý 0,25; 3 ý 0,5; 4 ý đủ điểm
    const key = ['Đ', 'S', 'Đ', 'S'];
    assert.deepEqual(
      [
        ['S', 'Đ', 'S', 'Đ'],
        ['Đ', 'Đ', 'S', 'Đ'],
        ['Đ', 'S', 'S', 'Đ'],
        ['Đ', 'S', 'Đ', 'Đ'],
        ['T', 'F', 'T', 'F'],
      ].map((given) => gradeObjective('true_false', key, given, 1, 'tiered')),
      [0, 0.1, 0.25, 0.5, 1],
    );
    assert.equal(gradeObjective('true_false', key, ['Đ', 'S', 'Đ', 'Đ'], 1, 'proportional'), 0.75);
    assert.equal(gradeObjective('true_false', ['Đ', 'S'], ['Đ', 'Đ'], 1, 'tiered'), 0.5, 'khác 4 ý tính tỉ lệ');
    assert.equal(gradeObjective('short_answer', ['12,5'], [' 12.5 '], 0.5, 'tiered'), 0.5);
    assert.equal(gradeObjective('short_answer', ['x+1'], ['X + 1'], 0.5, 'tiered'), 0.5);
    assert.equal(gradeObjective('essay', [], ['bất kỳ'], 3, 'tiered'), null);

    const questions = [
      question('q1', 'multiple_choice', 2),
      question('q2', 'true_false', 2),
      question('q3', 'essay', 6, 'Hình'),
    ];
    const items = [
      { question_id: 'q1', number: 1, option_order: ['A', 'B', 'C', 'D'], answer: ['B'] },
      { question_id: 'q2', number: 2, option_order: [], answer: key },
      { question_id: 'q3', number: 3, option_order: [], answer: [] },
    ];
    const options = { rule: 'tiered' as const, doubleMarking: true, tolerance: 1 };
    const missing = gradeSheet(
      items,
      questions,
      { answers: { 1: ['B'] }, essay: { q3: { first: 4, second: null } } },
      options,
    );
    assert.equal(missing.missing_essay, 1, 'chấm hai người cần đủ hai điểm');
    const review = gradeSheet(items, questions, { answers: {}, essay: { q3: { first: 5, second: 3 } } }, options);
    assert.equal(review.needs_review, true);
    const full = gradeSheet(
      items,
      questions,
      { answers: { 1: ['B'], 2: ['Đ', 'S', 'S', 'S'] }, essay: { q3: { first: 4.5, second: 4 } } },
      options,
    );
    assert.deepEqual([full.objective, full.essay, full.total, full.needs_review], [3, 4.25, 7.3, false]);
    assert.deepEqual(
      full.results.map((row) => [row.number, row.earned, row.correct]),
      [
        [1, 2, true],
        [2, 1, false],
        [3, 4.25, null],
      ],
    );

    // 10 bài: nhóm 27% là 3 bài cao nhất và 3 bài thấp nhất
    const papers = Array.from({ length: 10 }, (_unused, index) => ({
      total: index,
      results: [
        { question_id: 'q1', number: 1, earned: index >= 5 ? 2 : 0, correct: index >= 5 },
        { question_id: 'q2', number: 2, earned: 2, correct: true },
      ],
    }));
    const stats = questionStats(papers, questions.slice(0, 2));
    assert.deepEqual(
      stats.map((row) => [row.question_id, row.attempts, row.difficulty, row.discrimination, row.review]),
      [
        ['q1', 10, 0.5, 1, false],
        ['q2', 10, 1, 0, true],
      ],
    );
    assert.equal(questionStats(papers.slice(0, 4), questions.slice(0, 1))[0]?.discrimination, null, 'dưới 10 bài');
    assert.deepEqual(
      groupRates(papers, questions, (row) => row.topic_name ?? '').map((row) => [row.key, row.max, row.rate]),
      [
        ['Số', 4, 0.75],
        ['Hình', 6, 0],
      ],
    );
    assert.deepEqual(scoreDistribution([0, 4.9, 5, 9.5, 10]), [1, 0, 0, 0, 1, 1, 0, 0, 0, 2]);
    assert.deepEqual(parseAnswerCell('true_false', 'ĐSĐĐ'), ['Đ', 'S', 'Đ', 'Đ']);
    assert.deepEqual(parseAnswerCell('true_false', 'Đ, S'), ['Đ', 'S']);
    assert.deepEqual(parseAnswerCell('multiple_choice', 'AB'), ['A', 'B']);
    assert.deepEqual(parseAnswerCell('short_answer', '12, 5'), ['12, 5']);
  });
});

describe('Điểm cuối chấm bài kiểm tra', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let math: LoggedInUser;
  let other: LoggedInUser;
  let parent: LoggedInUser;
  let classId = '';
  let otherClassId = '';
  let subjectId = '';
  let examId = '';
  let draftExamId = '';
  let sessionId = '';
  const questionIds: string[] = [];
  const children: Record<string, string> = {};
  const url = (path: string) => `${environment.baseUrl}${path}`;
  const api = (method: string, path: string, user: LoggedInUser, body?: unknown) =>
    sendJson(method, url(path), user.accessToken, body);
  const list = (body: unknown) => body as unknown as Array<Record<string, unknown>>;
  const download = (path: string, user: LoggedInUser) =>
    fetch(url(path), { headers: { authorization: `Bearer ${user.accessToken}` } });
  const upload = async (path: string, user: LoggedInUser, file: Buffer) => {
    const form = new FormData();
    form.set('file', new Blob([file]), 'ket-qua-quet.xlsx');
    const response = await fetch(url(path), {
      method: 'POST',
      headers: { authorization: `Bearer ${user.accessToken}` },
      body: form,
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  };
  const workbook = async (rows: string[][]) => {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('Kết quả quét phiếu');
    sheet.addRow(['Mã hệ thống', 'Họ và tên', 'Mã đề', 'Vắng', 'Câu 1', 'Câu 2', 'Câu 3', 'Câu 4']);
    for (const row of rows) sheet.addRow(row);
    return Buffer.from(await book.xlsx.writeBuffer());
  };
  const studentRow = (body: Record<string, unknown>, key: string) =>
    list(body.students).find((row) => row.child_id === children[key]) as Record<string, unknown>;
  const sheetOf = (body: Record<string, unknown>, key: string) =>
    studentRow(body, key).sheet as Record<string, unknown>;

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
    const unitId = (
      await api('POST', '/org-units', principal, {
        code: 'THCS-22G2',
        name: 'Trường THCS thử',
        unit_type: 'truong_chinh',
      })
    ).body.id as string;
    const current = await api('GET', '/school-levels', principal);
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
    assert.equal((await api('PUT', '/school-levels', principal, { levels })).status, 200);
    assert.equal((await api('POST', '/grade-levels/templates', principal, { school_level: 'THCS' })).status, 200);
    assert.equal((await api('POST', '/subjects/templates', principal, { school_level: 'THCS' })).status, 200);
    subjectId = list((await api('GET', '/subjects?school_level=THCS', principal)).body).find(
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
    for (const key of ['An', 'Binh', 'Chi']) {
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
        .values({ child_id: child.id, class_id: classId, from_date: addDays(vietnamToday, -60) })
        .execute();
    }
    // Đề đã khoá của 22g1 (chèn thẳng): nhiều lựa chọn 2 điểm, đúng sai 2 điểm, trả lời ngắn 2 điểm, tự luận 4 điểm; hai mã
    const specs = [
      { type: 'multiple_choice', level: 'recognition', topic: 'Số tự nhiên', score: 2, answer: ['B'] },
      { type: 'true_false', level: 'comprehension', topic: 'Số tự nhiên', score: 2, answer: ['Đ', 'S', 'Đ', 'S'] },
      { type: 'short_answer', level: 'application', topic: 'Phân số', score: 2, answer: ['12,5'] },
      { type: 'essay', level: 'high_application', topic: 'Phân số', score: 4, answer: [] },
    ] as const;
    for (const spec of specs) {
      const row = await schoolYear
        .insertInto('questions')
        .values({
          school_level: 'THCS',
          subject_id: subjectId,
          grade_level_code: 'K6',
          cognitive_level: spec.level,
          question_type: spec.type,
          content: `Câu ${spec.type}`,
          options: JSON.stringify([]),
          answer: JSON.stringify(spec.answer),
          score: spec.score,
          status: 'approved',
          author_user_id: math.userId,
          author_name: 'Giáo viên Toán',
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      questionIds.push(row.id);
    }
    for (const status of ['locked', 'approved'] as const) {
      const exam = await schoolYear
        .insertInto('exams')
        .values({
          school_level: 'THCS',
          subject_id: subjectId,
          grade_level_code: 'K6',
          title: status === 'locked' ? 'Kiểm tra giữa học kỳ I' : 'Đề chưa khoá',
          status,
          author_user_id: math.userId,
          author_name: 'Giáo viên Toán',
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      if (status === 'approved') {
        draftExamId = exam.id;
        continue;
      }
      examId = exam.id;
      await schoolYear
        .insertInto('exam_questions')
        .values(
          specs.map((spec, index) => ({
            exam_id: examId,
            question_id: questionIds[index] as string,
            order_no: index + 1,
            score: spec.score,
            snapshot: JSON.stringify({
              content: `Câu ${spec.type}`,
              question_type: spec.type,
              cognitive_level: spec.level,
              topic_name: spec.topic,
              options: [],
              answer: spec.answer,
              guidance: null,
            }),
          })),
        )
        .execute();
      const items = (firstAnswer: string) =>
        JSON.stringify(
          specs.map((spec, index) => ({
            question_id: questionIds[index],
            number: index + 1,
            option_order: spec.type === 'multiple_choice' ? ['A', 'B', 'C', 'D'] : [],
            answer: spec.type === 'multiple_choice' ? [firstAnswer] : spec.answer,
          })),
        );
      await schoolYear
        .insertInto('exam_variants')
        .values([
          { exam_id: examId, code: '101', items: items('B') },
          { exam_id: examId, code: '102', items: items('C') },
        ])
        .execute();
      await schoolYear
        .insertInto('question_usages')
        .values(questionIds.map((id) => ({ question_id: id, exam_id: examId, used_on: vietnamToday })))
        .execute();
    }
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-22g2-2: tạo bài kiểm tra của lớp từ đề đã khoá; ai tạo được; lớp khác khối; trùng', async () => {
    const exams = list((await api('GET', '/exam-grading/exams?school_level=THCS', math)).body);
    assert.deepEqual(
      exams.map((row) => row.id),
      [examId],
    );
    assert.equal((await api('GET', '/exam-grading/exams?school_level=THCS', parent)).status, 403);
    assert.deepEqual(
      list((await api('GET', `/exam-grading/classes?exam_id=${examId}`, math)).body).map((row) => row.name),
      ['6A'],
    );
    assert.equal(list((await api('GET', `/exam-grading/classes?exam_id=${examId}`, other)).body).length, 0);
    const body = {
      exam_id: examId,
      class_id: classId,
      term_type: 'first_term',
      score_kind: 'mid',
      double_marking: true,
      mark_tolerance: 1,
      absent_policy: 'zero',
    };
    assert.equal((await api('POST', '/exam-grading/sessions', other, body)).status, 403);
    assert.equal((await api('POST', '/exam-grading/sessions', math, { ...body, exam_id: draftExamId })).status, 422);
    assert.equal(
      (await api('POST', '/exam-grading/sessions', principal, { ...body, class_id: otherClassId })).status,
      400,
    );
    assert.equal((await api('POST', '/exam-grading/sessions', math, { ...body, score_kind: 'x' })).status, 400);
    const created = await api('POST', '/exam-grading/sessions', math, body);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    sessionId = created.body.id as string;
    assert.equal(created.body.total_score, 10);
    assert.equal(created.body.status, 'grading');
    assert.equal(list(created.body.variants).length, 2);
    assert.equal(list(created.body.students).length, 3);
    assert.equal((await api('POST', '/exam-grading/sessions', math, body)).status, 422, 'mỗi đề một lần cho mỗi lớp');
    assert.deepEqual(
      list((await api('GET', '/exam-grading/sessions?school_level=THCS', math)).body).map((row) => row.id),
      [sessionId],
    );
    assert.equal(list((await api('GET', '/exam-grading/sessions?school_level=THCS', other)).body).length, 0);
    assert.equal((await api('GET', `/exam-grading/sessions/${sessionId}`, other)).status, 403);
  });

  it('CT-22g2-3: phiếu trả lời; nhập bài tay; nhập tệp quét (lỗi thì không ghi dòng nào); chấm hai người lệch ngưỡng', async () => {
    const pdf = await download(`/exam-grading/sessions/${sessionId}/answer-sheet`, math);
    assert.equal(pdf.status, 200);
    assert.equal(
      Buffer.from(await pdf.arrayBuffer())
        .subarray(0, 4)
        .toString(),
      '%PDF',
    );
    const template = await download(`/exam-grading/sessions/${sessionId}/import-template`, math);
    assert.equal(template.status, 200);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(await template.arrayBuffer());
    assert.equal(book.worksheets[0]?.getRow(1).getCell(8).text, 'Câu 4');
    assert.equal(book.worksheets[0]?.rowCount, 4, 'tiêu đề và 3 học sinh');

    const [essayId] = questionIds.slice(3);
    const sheet = {
      variant_code: '101',
      answers: { 1: ['B'], 2: ['Đ', 'S', 'Đ', 'S'], 3: ['12.5'] },
      essay: { [essayId as string]: { first: 3, second: 1 } },
    };
    assert.equal(
      (await api('PUT', `/exam-grading/sessions/${sessionId}/sheets/${children.An}`, other, sheet)).status,
      403,
    );
    assert.equal(
      (
        await api('PUT', `/exam-grading/sessions/${sessionId}/sheets/${children.An}`, math, {
          ...sheet,
          variant_code: '999',
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await api('PUT', `/exam-grading/sessions/${sessionId}/sheets/${children.An}`, math, {
          ...sheet,
          essay: { [essayId as string]: { first: 5, second: null } },
        })
      ).status,
      400,
      'điểm tự luận quá điểm câu',
    );
    const saved = await api('PUT', `/exam-grading/sessions/${sessionId}/sheets/${children.An}`, math, sheet);
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(sheetOf(saved.body, 'An').needs_review, true);
    assert.equal(sheetOf(saved.body, 'An').total_score, 8, '2 + 2 + 2 + (3 + 1) / 2');

    const bad = await upload(
      `/exam-grading/sessions/${sessionId}/import`,
      math,
      await workbook([
        [children.Binh as string, 'Học sinh Binh', '102', '', 'A', 'Đ,S,S,S', '12,5', '2'],
        [children.Chi as string, 'Học sinh Chi', '102', '', 'X', '', '', ''],
      ]),
    );
    assert.equal(bad.status, 200, JSON.stringify(bad.body));
    assert.equal(bad.body.imported, 0);
    assert.match(JSON.stringify(bad.body.errors), /Chỉ ghi A, B, C, D/);
    const good = await upload(
      `/exam-grading/sessions/${sessionId}/import`,
      math,
      await workbook([
        [children.Binh as string, 'Học sinh Binh', '102', '', 'A', 'Đ,S,S,S', '12,5', '2'],
        [children.Chi as string, 'Học sinh Chi', '', 'x', '', '', '', ''],
      ]),
    );
    assert.equal(good.body.imported, 2, JSON.stringify(good.body));
    const detail = (await api('GET', `/exam-grading/sessions/${sessionId}`, math)).body;
    const binh = sheetOf(detail, 'Binh');
    assert.equal(binh.source, 'import');
    assert.equal(binh.objective_score, 3, 'mã 102 đáp án C: câu 1 sai; đúng sai 3 ý 1 điểm; trả lời ngắn 2');
    assert.equal(binh.total_score, null, 'chấm hai người còn thiếu điểm người thứ hai');
    assert.equal(sheetOf(detail, 'Chi').absent, true);
    const blockers = detail.blockers as Record<string, string[]>;
    assert.deepEqual(
      [blockers.missing, blockers.review, blockers.incomplete],
      [[], ['Học sinh An'], ['Học sinh Binh']],
    );
  });

  it('CT-22g2-4: khoá điểm khi đủ bài; ghi độ khó vào lịch sử dùng câu; khoá rồi không sửa; mở khoá có lý do', async () => {
    assert.equal((await api('POST', `/exam-grading/sessions/${sessionId}/lock`, math)).status, 403);
    const blocked = await api('POST', `/exam-grading/sessions/${sessionId}/lock`, principal);
    assert.equal(blocked.status, 422);
    assert.match(JSON.stringify(blocked.body), /Học sinh An/);
    const [essayId] = questionIds.slice(3);
    await api('PUT', `/exam-grading/sessions/${sessionId}/sheets/${children.An}`, math, {
      variant_code: '101',
      answers: { 1: ['B'], 2: ['Đ', 'S', 'Đ', 'S'], 3: ['12.5'] },
      essay: { [essayId as string]: { first: 3, second: 3.5 } },
    });
    await api('PUT', `/exam-grading/sessions/${sessionId}/sheets/${children.Binh}`, math, {
      variant_code: '102',
      answers: { 1: ['A'], 2: ['Đ', 'S', 'S', 'S'], 3: ['12,5'] },
      essay: { [essayId as string]: { first: 2, second: 2 } },
    });
    const locked = await api('POST', `/exam-grading/sessions/${sessionId}/lock`, principal);
    assert.equal(locked.status, 200, JSON.stringify(locked.body));
    assert.equal(locked.body.status, 'locked');
    assert.equal(sheetOf(locked.body, 'An').total_score, 9.3);
    assert.equal(sheetOf(locked.body, 'Binh').total_score, 5);
    const usages = await schoolYear
      .selectFrom('question_usages')
      .select(['question_id', 'attempts', 'difficulty'])
      .where('exam_id', '=', examId)
      .execute();
    const usageOf = (index: number) => usages.find((row) => row.question_id === questionIds[index]);
    assert.equal(usageOf(0)?.attempts, 2);
    assert.equal(Number(usageOf(0)?.difficulty), 0.5);
    assert.equal(Number(usageOf(2)?.difficulty), 1);
    assert.equal(
      (await api('PUT', `/exam-grading/sessions/${sessionId}/sheets/${children.An}`, math, { absent: true })).status,
      422,
    );
    assert.equal((await api('POST', `/exam-grading/sessions/${sessionId}/unlock`, principal, {})).status, 400);
    const unlocked = await api('POST', `/exam-grading/sessions/${sessionId}/unlock`, principal, {
      reason: 'Phúc khảo',
    });
    assert.equal(unlocked.body.status, 'grading');
    assert.equal((await api('POST', `/exam-grading/sessions/${sessionId}/lock`, principal)).body.status, 'locked');
  });

  it('CT-22g2-5: chuyển điểm vào sổ điểm 21c qua một cửa; vắng ghi 0 theo cấu hình; đã chuyển không mở khoá', async () => {
    assert.equal((await api('POST', `/exam-grading/sessions/${sessionId}/transfer`, other)).status, 403);
    const moved = await api('POST', `/exam-grading/sessions/${sessionId}/transfer`, math);
    assert.equal(moved.status, 200, JSON.stringify(moved.body));
    assert.equal(moved.body.status, 'transferred');
    assert.equal(moved.body.written, 3);
    const entries = await schoolYear
      .selectFrom('score_entries')
      .select(['child_id', 'kind', 'seq', 'score', 'source', 'term_type'])
      .where('subject_id', '=', subjectId)
      .execute();
    const scoreOf = (key: string) => entries.find((row) => row.child_id === children[key]);
    assert.deepEqual(
      ['An', 'Binh', 'Chi'].map((key) => [Number(scoreOf(key)?.score), scoreOf(key)?.kind, scoreOf(key)?.source]),
      [
        [9.3, 'mid', 'exam'],
        [5, 'mid', 'exam'],
        [0, 'mid', 'exam'],
      ],
    );
    const book = await api('GET', `/scores/classes/${classId}/subjects/${subjectId}?term_type=first_term`, math);
    assert.equal(book.status, 200, JSON.stringify(book.body));
    assert.equal(
      (list(book.body.rows).find((row) => row.child_id === children.An) as Record<string, unknown>).mid,
      9.3,
    );
    assert.equal((await api('POST', `/exam-grading/sessions/${sessionId}/transfer`, math)).status, 422);
    assert.equal(
      (await api('POST', `/exam-grading/sessions/${sessionId}/unlock`, principal, { reason: 'Sửa' })).status,
      422,
    );
  });

  it('CT-22g2-6: báo cáo theo câu, chủ đề, mức nhận thức, lớp, phân bố điểm; xuất Excel, PDF; phụ huynh không xem', async () => {
    assert.equal((await api('GET', `/exam-grading/reports/${examId}`, parent)).status, 403);
    const report = await api('GET', `/exam-grading/reports/${examId}`, principal);
    assert.equal(report.status, 200, JSON.stringify(report.body));
    assert.equal(report.body.papers, 2);
    assert.equal(report.body.average, 7.2);
    assert.deepEqual(
      list(report.body.questions).map((row) => [row.number, row.difficulty]),
      [
        [1, 0.5],
        [2, 0.75],
        [3, 1],
        [4, 0.66],
      ],
    );
    assert.deepEqual(
      list(report.body.topics).map((row) => [row.key, row.rate]),
      [
        ['Số tự nhiên', 0.63],
        ['Phân số', 0.77],
      ],
    );
    assert.equal(list(report.body.levels).find((row) => row.key === 'recognition')?.label, 'Nhận biết');
    assert.deepEqual(
      list(report.body.classes).map((row) => [row.class_name, row.papers, row.average, row.pass_rate]),
      [['6A', 2, 7.2, 1]],
    );
    assert.deepEqual(report.body.distribution, [0, 0, 0, 0, 0, 1, 0, 0, 0, 1]);
    assert.equal(list((await api('GET', `/exam-grading/reports/${examId}`, other)).body.questions).length, 4);
    assert.equal((await api('GET', `/exam-grading/reports/${examId}`, other)).body.papers, 0, 'không dạy lớp nào');
    const excel = await download(`/exam-grading/reports/${examId}/export?format=xlsx`, principal);
    assert.equal(excel.status, 200);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(await excel.arrayBuffer());
    assert.deepEqual(
      book.worksheets.map((sheet) => sheet.name),
      ['Theo câu', 'Theo chủ đề', 'Theo mức nhận thức', 'Theo lớp', 'Phân bố điểm'],
    );
    const pdf = await download(`/exam-grading/reports/${examId}/export?format=pdf`, math);
    assert.equal(pdf.status, 200);
    assert.equal(
      Buffer.from(await pdf.arrayBuffer())
        .subarray(0, 4)
        .toString(),
      '%PDF',
    );
  });
});
