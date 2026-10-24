import assert from 'node:assert/strict';
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

// Kiểm tra, đánh giá phần đề (DT-21 phần 22g1, YCTD-168), kịch bản CT-22g1-5 đến CT-22g1-8: ngân hàng câu hỏi, chủ đề, ma
// trận, kế hoạch, đề nhiều mã, thẩm định, khoá đề, xuất đề. Dữ liệu giả, cấp THCS
describe('Điểm cuối kiểm tra, đánh giá phần đề', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let head: LoggedInUser;
  let teacher: LoggedInUser;
  let otherTeacher: LoggedInUser;
  let parent: LoggedInUser;
  let subjectId = '';
  let topicA = '';
  let topicB = '';
  let matrixId = '';
  let planId = '';
  let examId = '';
  const url = (path: string) => `${environment.baseUrl}${path}`;
  const api = (method: string, path: string, user: LoggedInUser, body?: unknown) =>
    sendJson(method, url(path), user.accessToken, body);
  const list = (body: unknown) => body as unknown as Array<Record<string, unknown>>;
  const upload = async (path: string, user: LoggedInUser, file: Buffer) => {
    const form = new FormData();
    form.set('file', new Blob([file]), 'cau-hoi.xlsx');
    const response = await fetch(url(path), {
      method: 'POST',
      headers: { authorization: `Bearer ${user.accessToken}` },
      body: form,
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  };
  const question = (overrides: Record<string, unknown>) => ({
    school_level: 'THCS',
    subject_id: subjectId,
    grade_level_code: 'K6',
    topic_id: topicA,
    cognitive_level: 'recognition',
    question_type: 'multiple_choice',
    content: 'Câu hỏi thử',
    options: ['Một', 'Hai', 'Ba', 'Bốn'],
    answer: ['B'],
    score: 1,
    ...overrides,
  });
  // Soạn, gửi, duyệt một câu
  const approved = async (overrides: Record<string, unknown>) => {
    const created = await api('POST', '/questions', teacher, question(overrides));
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const id = created.body.id as string;
    assert.equal((await api('POST', `/questions/${id}/submit`, teacher)).status, 200);
    const reviewed = await api('POST', `/questions/${id}/review`, head, { decision: 'approve' });
    assert.equal(reviewed.body.status, 'approved');
    return id;
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
    const unitId = (
      await api('POST', '/org-units', principal, {
        code: 'THCS-22G',
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
    const subject = await api('POST', '/subjects', principal, {
      school_level: 'THCS',
      code: 'THCS-TOAN',
      name: 'Toán',
      kind: 'subject',
      assessment: 'comment_and_score',
    });
    assert.equal(subject.status, 201, JSON.stringify(subject.body));
    subjectId = subject.body.id as string;
    head = await environment.loginAs('VT-17', unitId);
    teacher = await environment.loginAs('VT-08', unitId);
    otherTeacher = await environment.loginAs('VT-08', unitId);
    parent = await environment.loginAs('VT-14', unitId);
    const classId = (
      await schoolYear
        .insertInto('classes')
        .values({
          org_unit_id: unitId,
          academic_year_id: academicYearId,
          code: '6A',
          name: 'Lớp 6A',
          grade_level: 'K6',
          school_level: 'THCS',
          max_size: 45,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    for (const user of [teacher, otherTeacher, head]) {
      const assigned = await api('POST', `/classes/${classId}/staff-assignments`, principal, {
        staff_user_id: user.userId,
        assignment_role: 'subject',
        subject_id: subjectId,
      });
      assert.ok([201, 422].includes(assigned.status), JSON.stringify(assigned.body));
      if (assigned.status === 422) {
        // Một môn của một lớp một giáo viên (20a): người sau phân công môn khác tên tự do
        await schoolYear
          .insertInto('class_staff_assignments')
          .values({
            class_id: classId,
            staff_user_id: user.userId,
            staff_name: `Giáo viên ${user.userId.slice(0, 4)}`,
            assignment_role: 'subject',
            subject_name: 'Hoạt động trải nghiệm',
            from_date: '2026-09-05',
          })
          .execute();
      }
    }
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-22g1-5: chủ đề, câu hỏi: soạn nháp, gửi, thẩm định, trả lại; ai thấy câu nào; nhập Excel; thống kê', async () => {
    assert.equal((await api('POST', '/question-topics', teacher, { subject_id: subjectId, name: 'X' })).status, 403);
    assert.equal((await api('GET', '/questions', parent)).status, 403);
    topicA = (
      await api('POST', '/question-topics', head, {
        subject_id: subjectId,
        grade_level_code: 'K6',
        name: 'Số tự nhiên',
      })
    ).body.id as string;
    topicB = (
      await api('POST', '/question-topics', head, { subject_id: subjectId, grade_level_code: 'K6', name: 'Hình học' })
    ).body.id as string;
    assert.equal(list((await api('GET', `/question-topics?subject_id=${subjectId}`, teacher)).body).length, 2);

    const draft = await api('POST', '/questions', teacher, question({ content: 'Số liền sau của 9 là?' }));
    assert.equal(draft.status, 201, JSON.stringify(draft.body));
    assert.equal(draft.body.status, 'draft');
    assert.equal(draft.body.topic_name, 'Số tự nhiên');
    const id = draft.body.id as string;
    assert.equal((await api('GET', `/questions/${id}`, otherTeacher)).status, 403);
    assert.ok(!list((await api('GET', '/questions', otherTeacher)).body).some((row) => row.id === id));
    assert.equal((await api('POST', `/questions/${id}/review`, teacher, { decision: 'approve' })).status, 403);
    assert.equal((await api('POST', `/questions/${id}/submit`, teacher)).status, 200);
    assert.equal(
      (await api('POST', `/questions/${id}/review`, head, { decision: 'return' })).status,
      400,
      'trả lại cần lý do',
    );
    const returned = await api('POST', `/questions/${id}/review`, head, { decision: 'return', note: 'Thêm đơn vị' });
    assert.equal(returned.body.status, 'draft');
    assert.equal(returned.body.review_note, 'Thêm đơn vị');
    const edited = await api('PUT', `/questions/${id}`, teacher, question({ content: 'Số liền sau của 9 là số nào?' }));
    assert.equal(edited.status, 200, JSON.stringify(edited.body));
    await api('POST', `/questions/${id}/submit`, teacher);
    assert.equal((await api('POST', `/questions/${id}/review`, head, { decision: 'approve' })).body.status, 'approved');
    assert.ok(list((await api('GET', '/questions', otherTeacher)).body).some((row) => row.id === id));
    // Câu đã duyệt người soạn không sửa; người thẩm định sửa thì về nháp
    assert.equal((await api('PUT', `/questions/${id}`, teacher, question({}))).status, 403);
    const headEdit = await api('PUT', `/questions/${id}`, head, question({ content: 'Số liền sau của 9?' }));
    assert.equal(headEdit.body.status, 'draft');
    await api('POST', `/questions/${id}/review`, head, { decision: 'approve' });
    // Chủ đề phải thuộc môn
    const wrongTopic = await api('POST', '/questions', teacher, question({ topic_id: subjectId }));
    assert.equal(wrongTopic.status, 400);

    // Nhập Excel: dòng sai thì không ghi; tệp đúng nhập thành câu nháp
    const template = await fetch(url('/questions/import-template?school_level=THCS'), {
      headers: { authorization: `Bearer ${teacher.accessToken}` },
    });
    assert.equal(template.status, 200);
    const workbook = async (rows: string[][]) => {
      const book = new ExcelJS.Workbook();
      const sheet = book.addWorksheet('Câu hỏi');
      sheet.addRow([
        'Mã môn',
        'Mã khối',
        'Chủ đề',
        'Mức',
        'Dạng',
        'Nội dung',
        'Lựa chọn 1',
        'Lựa chọn 2',
        'Lựa chọn 3',
        'Lựa chọn 4',
        'Đáp án',
        'Hướng dẫn chấm',
        'Điểm',
      ]);
      for (const row of rows) sheet.addRow(row);
      return Buffer.from(await book.xlsx.writeBuffer());
    };
    const bad = await upload(
      '/questions/import?school_level=THCS',
      teacher,
      await workbook([
        [
          'THCS-TOAN',
          'K6',
          'Số tự nhiên',
          'Nhận biết',
          'Nhiều lựa chọn',
          '2 + 2 = ?',
          '3',
          '4',
          '5',
          '6',
          'B',
          '',
          '0,25',
        ],
        ['THCS-VAN', 'K6', '', 'Nhận biết', 'Nhiều lựa chọn', 'X', '1', '2', '', '', 'A', '', ''],
        ['THCS-TOAN', 'K6', '', 'Rất khó', 'Tự luận', 'Y', '', '', '', '', '', 'Chấm ý', ''],
      ]),
    );
    assert.equal(bad.status, 200);
    assert.equal(bad.body.imported, 0);
    assert.deepEqual(
      list(bad.body.errors).map((error) => [error.row, error.column]),
      [
        [3, 'Mã môn'],
        [4, 'Mức'],
      ],
    );
    const good = await upload(
      '/questions/import?school_level=THCS',
      teacher,
      await workbook([
        [
          'THCS-TOAN',
          'K6',
          'Số tự nhiên',
          'Nhận biết',
          'Nhiều lựa chọn',
          '2 + 2 = ?',
          '3',
          '4',
          '5',
          '6',
          'B',
          '',
          '0,25',
        ],
        ['THCS-TOAN', 'K6', 'Hình học', 'Thông hiểu', 'Đúng sai', 'Xét các ý', 'Ý 1', 'Ý 2', '', '', 'Đ, S', '', '1'],
        ['THCS-TOAN', 'K6', '', 'Vận dụng', 'Tự luận', 'Chứng minh', '', '', '', '', '', 'Đủ ba bước', '2'],
      ]),
    );
    assert.equal(good.body.imported, 3, JSON.stringify(good.body));
    const imported = list((await api('GET', `/questions?subject_id=${subjectId}&status=draft`, teacher)).body);
    assert.equal(imported.length, 3);
    assert.ok(imported.some((row) => row.question_type === 'true_false' && JSON.stringify(row.answer) === '["Đ","S"]'));

    const stats = list((await api('GET', `/questions/stats?subject_id=${subjectId}&grade_level_code=K6`, head)).body);
    assert.deepEqual(
      stats.map((row) => [row.topic_name, row.cognitive_level, row.count]),
      [['Số tự nhiên', 'recognition', 1]],
    );
  });

  it('CT-22g1-6: ma trận và bảng đặc tả; kế hoạch kiểm tra gửi, duyệt', async () => {
    const body = {
      school_level: 'THCS',
      subject_id: subjectId,
      grade_level_code: 'K6',
      name: 'Giữa học kỳ I – Toán 6',
      target_ratios: { recognition: 40, comprehension: 0, application: 60, high_application: 0 },
      rows: [
        {
          topic_id: topicA,
          cognitive_level: 'recognition',
          question_type: 'multiple_choice',
          count: 4,
          score_each: 1,
          requirement: 'Nhận biết số liền trước, liền sau',
        },
        { topic_id: topicB, cognitive_level: 'application', question_type: 'essay', count: 2, score_each: 3 },
      ],
    };
    assert.equal((await api('POST', '/exam-matrices', teacher, body)).status, 403);
    const created = await api('POST', '/exam-matrices', head, body);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    matrixId = created.body.id as string;
    assert.deepEqual(created.body.issues, []);
    assert.equal((created.body.summary as Record<string, unknown>).count, 6);
    assert.equal(list(created.body.rows)[1]?.topic_name, 'Hình học');
    const skewed = await api('PUT', `/exam-matrices/${matrixId}`, head, {
      ...body,
      rows: [{ ...body.rows[0], count: 2 }, body.rows[1]],
    });
    assert.deepEqual(
      list(skewed.body.issues).map((issue) => issue.code),
      ['total_score', 'ratio', 'ratio'],
    );
    await api('PUT', `/exam-matrices/${matrixId}`, head, body);

    const plan = {
      school_level: 'THCS',
      term: 'HK1',
      grade_level_code: 'K6',
      subject_id: subjectId,
      kind: 'midterm',
      form: 'mixed',
      duration_minutes: 90,
      planned_date: '2026-11-02',
    };
    assert.equal((await api('POST', '/assessment-plans', teacher, plan)).status, 403);
    const createdPlan = await api('POST', '/assessment-plans', head, plan);
    assert.equal(createdPlan.status, 201, JSON.stringify(createdPlan.body));
    planId = createdPlan.body.id as string;
    assert.equal(
      (await api('POST', `/assessment-plans/${planId}/decide`, principal, { decision: 'approve' })).status,
      422,
    );
    await api('POST', `/assessment-plans/${planId}/submit`, head);
    assert.equal((await api('POST', `/assessment-plans/${planId}/decide`, head, { decision: 'approve' })).status, 403);
    const decided = await api('POST', `/assessment-plans/${planId}/decide`, principal, { decision: 'approve' });
    assert.equal(decided.body.status, 'approved');
    assert.equal((await api('PUT', `/assessment-plans/${planId}`, head, plan)).status, 422);
    const plans = list((await api('GET', '/assessment-plans?school_level=THCS', teacher)).body);
    assert.equal(plans[0]?.subject_name, 'Toán');
    assert.equal(plans[0]?.exam_count, 0);
  });

  it('CT-22g1-7: giao đề, bốc câu theo ma trận (thiếu câu báo dòng), trộn mã đề, thẩm định, khoá, mở khoá có lý do', async () => {
    const staff = list((await api('GET', '/exams/staff', principal)).body);
    assert.ok(staff.some((row) => row.user_id === teacher.userId));
    const assigned = await api('POST', '/exams', principal, {
      plan_id: planId,
      school_level: 'THCS',
      subject_id: subjectId,
      grade_level_code: 'K6',
      title: 'Kiểm tra giữa học kỳ I',
      matrix_id: matrixId,
      variant_count: 3,
      author_user_id: teacher.userId,
      reviewer_user_id: head.userId,
      due_date: '2026-10-30',
    });
    assert.equal(assigned.status, 201, JSON.stringify(assigned.body));
    examId = assigned.body.id as string;
    assert.equal(assigned.body.duration_minutes, 90);
    assert.equal((await api('GET', `/exams/${examId}`, otherTeacher)).status, 403);
    assert.ok(
      !list((await api('GET', '/exams?school_level=THCS', otherTeacher)).body).some((row) => row.id === examId),
    );
    assert.ok(list((await api('GET', '/exams?school_level=THCS', teacher)).body).some((row) => row.id === examId));

    const short = await api('POST', `/exams/${examId}/generate`, teacher, { seed: 1 });
    assert.equal(short.status, 422);
    assert.match(
      JSON.stringify(short.body.error?.details),
      /Dòng 1 \(Số tự nhiên, Nhận biết, Nhiều lựa chọn\) cần 4 câu, ngân hàng có 1 câu dùng được/,
    );
    for (let index = 0; index < 4; index += 1) {
      await approved({ content: `Câu nhận biết ${index}`, answer: [['A', 'B', 'C', 'D'][index] as string] });
    }
    for (let index = 0; index < 3; index += 1) {
      await approved({
        topic_id: topicB,
        cognitive_level: 'application',
        question_type: 'essay',
        content: `Bài toán ${index}`,
        options: [],
        answer: [],
        guidance: 'Chấm theo từng bước',
        score: 3,
      });
    }
    assert.equal((await api('POST', `/exams/${examId}/generate`, otherTeacher, { seed: 1 })).status, 403);
    const generated = await api('POST', `/exams/${examId}/generate`, teacher, { seed: 7 });
    assert.equal(generated.status, 200, JSON.stringify(generated.body));
    const questions = list(generated.body.questions);
    assert.equal(questions.length, 6);
    assert.equal(generated.body.total_score, 10);
    // Bản chụp: sửa câu ở ngân hàng không đổi đề
    const firstQuestion = questions[0] as Record<string, unknown>;
    const snapshotContent = (firstQuestion.snapshot as Record<string, unknown>).content;
    await api('PUT', `/questions/${firstQuestion.question_id}`, head, question({ content: 'Nội dung đã sửa' }));
    const reread = await api('GET', `/exams/${examId}`, teacher);
    assert.equal((list(reread.body.questions)[0]?.snapshot as Record<string, unknown>).content, snapshotContent);
    // Bỏ một câu tự luận, thêm lại câu tự luận còn lại
    const essay = questions.find((row) => (row.snapshot as Record<string, unknown>).question_type === 'essay');
    await api('DELETE', `/exams/${examId}/questions/${essay?.question_id}`, teacher);
    const spare = list(
      (await api('GET', `/questions?subject_id=${subjectId}&question_type=essay&status=approved`, teacher)).body,
    ).find((row) => !questions.some((item) => item.question_id === row.id) || row.id === essay?.question_id);
    const added = await api('POST', `/exams/${examId}/questions`, teacher, { question_id: spare?.id, score: 3 });
    assert.equal(list(added.body.questions).length, 6);

    assert.equal((await api('POST', `/exams/${examId}/submit`, teacher)).status, 422, 'chưa trộn mã đề');
    const variants = await api('POST', `/exams/${examId}/variants`, teacher, { seed: 11 });
    assert.deepEqual(
      list(variants.body.variants).map((variant) => variant.code),
      ['101', '102', '103'],
    );
    assert.equal(list(list(variants.body.variants)[0]?.answers).length, 6);
    assert.equal((await api('POST', `/exams/${examId}/submit`, teacher)).body.status, 'submitted');
    assert.equal((await api('POST', `/exams/${examId}/generate`, teacher, {})).status, 422, 'đã gửi không sửa');
    assert.equal((await api('POST', `/exams/${examId}/review`, otherTeacher, { decision: 'approve' })).status, 403);
    const returned = await api('POST', `/exams/${examId}/review`, head, { decision: 'return', note: 'Đổi câu 5' });
    assert.equal(returned.body.status, 'draft');
    await api('POST', `/exams/${examId}/submit`, teacher);
    assert.equal((await api('POST', `/exams/${examId}/review`, head, { decision: 'approve' })).body.status, 'approved');
    assert.equal((await api('POST', `/exams/${examId}/lock`, head)).status, 403);
    const locked = await api('POST', `/exams/${examId}/lock`, principal);
    assert.equal(locked.body.status, 'locked');
    const used = await schoolYear
      .selectFrom('question_usages')
      .select('question_id')
      .where('exam_id', '=', examId)
      .execute();
    assert.equal(used.length, 6);
    const usedQuestion = await schoolYear
      .selectFrom('questions')
      .select(['last_used_at', 'use_count'])
      .where('id', '=', used[0]?.question_id ?? '')
      .executeTakeFirstOrThrow();
    assert.equal(usedQuestion.use_count, 1);
    assert.ok(usedQuestion.last_used_at);
    assert.equal((await api('POST', `/exams/${examId}/unlock`, principal, {})).status, 400);
    assert.equal(
      (await api('POST', `/exams/${examId}/unlock`, principal, { reason: 'Sửa lỗi chính tả' })).body.status,
      'approved',
    );
    assert.equal((await api('POST', `/exams/${examId}/lock`, principal)).body.status, 'locked');
    const plans = list((await api('GET', '/assessment-plans?school_level=THCS', head)).body);
    assert.equal(plans[0]?.locked_count, 1);
  });

  it('CT-22g1-8: xuất đề từng mã, đáp án ra PDF, Word; người không được giao không tải được', async () => {
    const download = (user: LoggedInUser, query: string) =>
      fetch(url(`/exams/${examId}/export?${query}`), { headers: { authorization: `Bearer ${user.accessToken}` } });
    const pdf = await download(teacher, 'part=paper&code=102&format=pdf');
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers.get('content-type'), 'application/pdf');
    assert.match(pdf.headers.get('content-disposition') ?? '', /de-102\.pdf/);
    assert.equal(
      Buffer.from(await pdf.arrayBuffer())
        .subarray(0, 4)
        .toString(),
      '%PDF',
    );
    const docx = await download(head, 'part=answers&format=docx');
    assert.equal(docx.status, 200);
    assert.match(docx.headers.get('content-type') ?? '', /wordprocessingml/);
    assert.equal(
      Buffer.from(await docx.arrayBuffer())
        .subarray(0, 2)
        .toString(),
      'PK',
    );
    assert.equal((await download(otherTeacher, 'part=paper&format=pdf')).status, 403);
    const logs = await schoolYear
      .selectFrom('audit_logs')
      .select('after_data')
      .where('entity_name', '=', 'exams')
      .where('entity_id', '=', examId)
      .execute();
    assert.equal(logs.filter((log) => JSON.stringify(log.after_data).includes('downloaded')).length, 2);
  });
});
