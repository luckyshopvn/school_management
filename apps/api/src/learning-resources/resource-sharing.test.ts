import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
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
import {
  buildPackage,
  PACKAGE_FORMAT,
  parseRubric,
  readPackage,
  rubricMaxScore,
  sha256,
  topicGaps,
  type PackageItem,
} from './resource-sharing-rules.js';

// Kho học liệu số, phần câu hỏi và chia sẻ (DT-22 phần 22h2, YCTD-184), kịch bản CT-22h2-1 đến CT-22h2-5. Dữ liệu giả
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const PDF = Buffer.from('%PDF-1.4\n% phieu hoc tap chia se\n%%EOF\n');
const PDF_OTHER = Buffer.from('%PDF-1.4\n% hoc lieu truong ban\n%%EOF\n');

const packageItem = (extra: Partial<PackageItem> = {}): PackageItem => ({
  title: 'Phiếu học tập của trường bạn',
  description: null,
  type_code: 'worksheet',
  school_level: 'THCS',
  grade_level_code: 'K6',
  subject_code: 'THCS-TOAN-22H2',
  subject_name: 'Toán',
  keywords: ['phân số'],
  author_name: 'Tác giả giả',
  language: 'vi',
  duration_minutes: null,
  license_code: 'CC-BY',
  license_source: null,
  origin: null,
  kind: 'file',
  file_name: 'phieu.pdf',
  content_type: 'application/pdf',
  sha256: sha256(PDF_OTHER),
  data: PDF_OTHER.toString('base64'),
  url: null,
  link_title: null,
  ...extra,
});

describe('Quy tắc rubric, gói chia sẻ', () => {
  it('CT-22h2-1: rubric hợp lệ, điểm tối đa; rubric sai; gói đọc lại được; mã băm sai báo lỗi; chỗ trống chủ đề', () => {
    const rubric = parseRubric({
      name: ' Rubric thuyết trình ',
      levels: [
        { label: 'Chưa đạt', score: 0 },
        { label: 'Đạt', score: 1 },
        { label: 'Tốt', score: 2 },
      ],
      criteria: [
        { name: 'Nội dung', weight: 2, descriptors: ['Sai', 'Đúng một phần', 'Đúng đủ'] },
        { name: 'Trình bày', descriptors: ['Lộn xộn', 'Rõ', 'Rõ, cuốn hút'] },
      ],
    });
    assert.equal(rubric.name, 'Rubric thuyết trình');
    assert.equal(rubric.criteria[1]?.weight, 1);
    assert.equal(rubric.visibility, 'school');
    assert.equal(rubricMaxScore(rubric.levels, rubric.criteria), 6);
    for (const body of [
      { name: 'A', levels: [{ label: 'Một', score: 1 }], criteria: [{ name: 'X', descriptors: ['a'] }] },
      {
        name: 'A',
        levels: [
          { label: 'Cao', score: 2 },
          { label: 'Thấp', score: 1 },
        ],
        criteria: [{ name: 'X', descriptors: ['a', 'b'] }],
      },
      {
        name: 'A',
        levels: [
          { label: 'Một', score: 1 },
          { label: 'Hai', score: 2 },
        ],
        criteria: [{ name: 'X', descriptors: ['chỉ một mô tả'] }],
      },
      { name: '', levels: [], criteria: [] },
    ]) {
      assert.throws(() => parseRubric(body), { code: 'ERR_VALIDATION' }, JSON.stringify(body));
    }

    const manifest = {
      format: PACKAGE_FORMAT,
      package_code: 'GOI-THU',
      source_school: 'Trường THCS Thử',
      created_at: '2026-10-25T00:00:00.000Z',
      items: [packageItem(), packageItem({ sha256: 'sai' }), packageItem({ kind: 'link', url: null, data: null })],
    };
    const read = readPackage(buildPackage(manifest));
    assert.equal(read.manifest.package_code, 'GOI-THU');
    assert.deepEqual(
      read.problems.map((problem) => problem.index),
      [1, 2],
    );
    assert.match(read.problems[0]?.message ?? '', /Mã băm/);
    assert.throws(() => readPackage(Buffer.from('khong phai gzip')), { code: 'ERR_VALIDATION' });
    assert.throws(() => readPackage(buildPackage({ ...manifest, format: 'khac' })), { code: 'ERR_VALIDATION' });

    assert.deepEqual(
      topicGaps(
        [
          { key: 'a', name: 'Phân số' },
          { key: 'b', name: 'Hình học' },
          { key: 'c', name: 'Số tự nhiên' },
        ],
        new Map([
          ['a', 2],
          ['c', 1],
        ]),
        new Map([['a', 3]]),
      ),
      [
        { name: 'Hình học', resources: 0, questions: 0 },
        { name: 'Số tự nhiên', resources: 1, questions: 0 },
      ],
    );
  });
});

describe('Điểm cuối câu hỏi, rubric, gói chia sẻ của kho', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let teacher: LoggedInUser;
  let teacher2: LoggedInUser;
  let parent: LoggedInUser;
  let subjectId = '';
  let topicId = '';
  let collectionId = '';
  const questions: Record<string, string> = {};
  let examId = '';
  let matrixId = '';
  const url = (path: string) => `${environment.baseUrl}${path}`;
  const api = (method: string, path: string, user: LoggedInUser, body?: unknown) =>
    sendJson(method, url(path), user.accessToken, body);
  const list = (body: unknown) => body as unknown as Array<Record<string, unknown>>;
  const download = async (path: string, user: LoggedInUser) => {
    const response = await fetch(url(path), { headers: { authorization: `Bearer ${user.accessToken}` } });
    return { status: response.status, body: Buffer.from(await response.arrayBuffer()) };
  };
  const upload = async (path: string, user: LoggedInUser, file: Buffer, fileName: string) => {
    const form = new FormData();
    form.append('file', new Blob([file]), fileName);
    const response = await fetch(url(path), {
      method: 'POST',
      headers: { authorization: `Bearer ${user.accessToken}` },
      body: form,
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  };

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    const firstStart = addDays(vietnamToday, -100);
    const firstEnd = addDays(vietnamToday, 120);
    const year = Number(firstStart.slice(0, 4));
    await openTestAcademicYear(environment, principal.accessToken, `${year}–${year + 1}`, {
      first_term: { start_date: firstStart, end_date: firstEnd },
      second_term: { start_date: addDays(firstEnd, 3), end_date: addDays(firstEnd, 120) },
    });
    const registry = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, registry.database_name),
    );
    const unitId = (
      await api('POST', '/org-units', principal, { code: 'THCS-22H2', name: 'Trường thử', unit_type: 'truong_chinh' })
    ).body.id as string;
    teacher = await environment.loginAs('VT-07', unitId);
    teacher2 = await environment.loginAs('VT-07', unitId);
    parent = await environment.loginAs('VT-14', unitId);
    subjectId = (
      await schoolYear
        .insertInto('subjects')
        .values({
          code: 'THCS-TOAN-22H2',
          name: 'Toán',
          school_level: 'THCS',
          kind: 'subject',
          assessment: 'comment_and_score',
          order_no: 1,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    topicId = (
      await schoolYear
        .insertInto('question_topics')
        .values({ subject_id: subjectId, grade_level_code: 'K6', name: 'Phân số' })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    await schoolYear
      .insertInto('question_topics')
      .values({ subject_id: subjectId, grade_level_code: 'K6', name: 'Hình học' })
      .execute();
    for (const [key, type, status, level] of [
      ['approved', 'multiple_choice', 'approved', 'recognition'],
      ['essay', 'essay', 'approved', 'application'],
      ['draft', 'multiple_choice', 'draft', 'recognition'],
    ] as const) {
      questions[key] = (
        await schoolYear
          .insertInto('questions')
          .values({
            school_level: 'THCS',
            subject_id: subjectId,
            grade_level_code: 'K6',
            topic_id: topicId,
            cognitive_level: level,
            question_type: type,
            content: `Câu ${key} về phân số`,
            options: JSON.stringify([]),
            answer: JSON.stringify(type === 'essay' ? [] : ['A']),
            score: 2,
            status,
            author_user_id: teacher.userId,
            author_name: 'Giáo viên Toán',
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    examId = (
      await schoolYear
        .insertInto('exams')
        .values({
          school_level: 'THCS',
          subject_id: subjectId,
          grade_level_code: 'K6',
          title: 'Kiểm tra phân số',
          status: 'locked',
          author_user_id: teacher.userId,
          author_name: 'Giáo viên Toán',
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    matrixId = (
      await schoolYear
        .insertInto('exam_matrices')
        .values({
          school_level: 'THCS',
          subject_id: subjectId,
          grade_level_code: 'K6',
          name: 'Ma trận phân số',
          target_ratios: JSON.stringify({ recognition: 40, comprehension: 30, application: 20, high_application: 10 }),
          rows: JSON.stringify([]),
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    // Lịch sử dùng câu: 22g1 ghi khi khoá đề, 22g2 ghi số bài, độ khó
    await schoolYear
      .insertInto('question_usages')
      .values([
        {
          question_id: questions.approved as string,
          exam_id: examId,
          used_on: vietnamToday,
          attempts: 30,
          difficulty: 0.8,
        },
        {
          question_id: questions.essay as string,
          exam_id: examId,
          used_on: vietnamToday,
          attempts: 10,
          difficulty: 0.4,
        },
      ])
      .execute();
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-22h2-2: câu hỏi, đề, ma trận của ngân hàng hiện trong kho theo quyền của 22g1; bộ sưu tập chứa bằng tham chiếu', async () => {
    assert.equal((await api('GET', '/resource-sharing/bank', parent)).status, 403);
    const mine = list((await api('GET', '/resource-sharing/bank?kind=question', teacher)).body);
    assert.equal(mine.length, 3, 'người soạn thấy cả câu nháp của mình');
    const approved = mine.find((row) => row.id === questions.approved);
    assert.deepEqual(
      [approved?.exams, approved?.attempts, approved?.difficulty, approved?.link],
      [1, 30, 0.8, '/question-bank'],
    );
    const others = list((await api('GET', '/resource-sharing/bank?kind=question', teacher2)).body);
    assert.deepEqual(others.map((row) => row.id).sort(), [questions.approved, questions.essay].sort());
    assert.equal(
      list((await api('GET', '/resource-sharing/bank?kind=question&cognitive_level=application', teacher2)).body)
        .length,
      1,
    );
    assert.equal((await api('GET', '/resource-sharing/bank?kind=x', teacher)).status, 400);
    assert.equal(list((await api('GET', '/resource-sharing/bank?kind=exam', teacher)).body).length, 1);
    assert.equal(list((await api('GET', '/resource-sharing/bank?kind=exam', teacher2)).body).length, 0, 'đề chưa giao');
    assert.equal(list((await api('GET', '/resource-sharing/bank?kind=matrix&q=phân', teacher2)).body).length, 1);
    // Kho không có bảng câu hỏi thứ hai: số câu hỏi ở ngân hàng không đổi
    const before = await schoolYear
      .selectFrom('questions')
      .select((expression) => expression.fn.countAll().as('n'))
      .executeTakeFirstOrThrow();

    const collection = await api('POST', '/learning-resources/collections', teacher, {
      name: 'Ôn tập phân số',
      visibility: 'school',
    });
    assert.equal(collection.status, 201, JSON.stringify(collection.body));
    collectionId = collection.body.id as string;
    const items = [
      { kind: 'question', id: questions.approved },
      { kind: 'exam', id: examId },
      { kind: 'matrix', id: matrixId },
    ];
    assert.equal(
      (await api('PUT', `/resource-sharing/collections/${collectionId}/items`, teacher2, { items })).status,
      403,
    );
    assert.equal(
      (
        await api('PUT', `/resource-sharing/collections/${collectionId}/items`, teacher, {
          items: [...items, { kind: 'question', id: questions.approved }],
        })
      ).status,
      400,
    );
    const saved = await api('PUT', `/resource-sharing/collections/${collectionId}/items`, teacher, { items });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.deepEqual(
      list(saved.body).map((row) => [row.kind, row.link]),
      [
        ['question', '/question-bank'],
        ['exam', '/exams'],
        ['matrix', '/exam-matrices'],
      ],
    );
    // Người xem khác không thấy đề chưa giao cho mình trong bộ sưu tập
    assert.deepEqual(
      list((await api('GET', `/resource-sharing/collections/${collectionId}/items`, teacher2)).body).map(
        (row) => row.kind,
      ),
      ['question', 'matrix'],
    );
    const afterCount = await schoolYear
      .selectFrom('questions')
      .select((expression) => expression.fn.countAll().as('n'))
      .executeTakeFirstOrThrow();
    assert.equal(Number(afterCount.n), Number(before.n));
  });

  it('CT-22h2-3: thống kê sử dụng câu hỏi theo môn, chủ đề, mức nhận thức; chỗ trống chủ đề', async () => {
    const statistics = await api('GET', '/resource-sharing/statistics', teacher);
    assert.equal(statistics.status, 200, JSON.stringify(statistics.body));
    assert.equal(statistics.body.questions, 2);
    assert.equal(statistics.body.used_questions, 2);
    assert.deepEqual(list(statistics.body.questions_by_subject), [{ label: 'Toán', total: 2 }]);
    const levels = list(statistics.body.questions_by_level);
    assert.deepEqual(
      levels.map((row) => [row.level, row.questions, row.attempts, row.difficulty]),
      [
        ['recognition', 1, 30, 0.8],
        ['comprehension', 0, 0, null],
        ['application', 1, 10, 0.4],
        ['high_application', 0, 0, null],
      ],
    );
    assert.deepEqual(
      list(statistics.body.gaps).map((row) => [row.name, row.resources, row.questions]),
      [
        ['Toán: Hình học', 0, 0],
        ['Toán: Phân số', 0, 2],
      ],
    );
  });

  it('CT-22h2-4: rubric: tạo, nối câu tự luận, sai thì từ chối, nhân bản, in, phạm vi cá nhân, lưu trữ', async () => {
    const body = {
      name: 'Rubric bài tự luận phân số',
      question_id: questions.essay,
      subject_id: subjectId,
      levels: [
        { label: 'Chưa đạt', score: 0 },
        { label: 'Đạt', score: 1 },
        { label: 'Tốt', score: 2 },
      ],
      criteria: [
        { name: 'Lập luận', weight: 1.5, descriptors: ['Sai', 'Đúng một phần', 'Chặt chẽ'] },
        { name: 'Tính toán', descriptors: ['Sai', 'Còn lỗi nhỏ', 'Đúng'] },
      ],
    };
    assert.equal((await api('POST', '/resource-sharing/rubrics', parent, body)).status, 403);
    assert.equal(
      (await api('POST', '/resource-sharing/rubrics', teacher, { ...body, question_id: questions.approved })).status,
      400,
      'chỉ nối câu tự luận',
    );
    const created = await api('POST', '/resource-sharing/rubrics', teacher, body);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.max_score, 5);
    const id = created.body.id as string;
    assert.equal((await api('PUT', `/resource-sharing/rubrics/${id}`, teacher2, body)).status, 403);
    const clone = await api('POST', `/resource-sharing/rubrics/${id}/clone`, teacher2);
    assert.equal(clone.status, 201, JSON.stringify(clone.body));
    assert.equal(clone.body.name, 'Bản sao của Rubric bài tự luận phân số');
    assert.equal(clone.body.visibility, 'private');
    assert.equal(clone.body.source_rubric_id, id);
    assert.ok(
      !list((await api('GET', '/resource-sharing/rubrics', teacher)).body).some((row) => row.id === clone.body.id),
    );
    const pdf = await download(`/resource-sharing/rubrics/${id}/print`, teacher2);
    assert.equal(pdf.status, 200);
    assert.equal(pdf.body.subarray(0, 4).toString(), '%PDF');
    assert.equal((await api('POST', `/resource-sharing/rubrics/${id}/archive`, teacher2)).status, 403);
    assert.equal((await api('POST', `/resource-sharing/rubrics/${id}/archive`, teacher)).body.status, 'archived');
  });

  it('CT-22h2-5: gói chia sẻ: xuất bộ sưu tập (bỏ học liệu chưa công bố, giấy phép không rõ); nhập gói có kiểm, loại trùng, chờ duyệt', async () => {
    const catalog = (await api('GET', '/learning-resources/catalog', teacher)).body;
    const type = list(catalog.types).find((row) => row.code === 'worksheet')?.id;
    const license = (code: string) => list(catalog.licenses).find((row) => row.code === code)?.id;
    const ids: string[] = [];
    for (const [title, licenseCode, publish] of [
      ['Phiếu phân số đã duyệt', 'SELF', true],
      ['Phiếu nháp', 'SELF', false],
      ['Phiếu không rõ nguồn', 'UNKNOWN', false],
    ] as const) {
      const created = await api('POST', '/learning-resources', teacher, {
        title,
        type_id: type,
        school_level: 'THCS',
        license_id: license(licenseCode),
        visibility: licenseCode === 'UNKNOWN' ? 'private' : 'school',
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      const id = created.body.id as string;
      ids.push(id);
      const file = await upload(
        `/learning-resources/${id}/files`,
        teacher,
        publish ? PDF : Buffer.from(`%PDF-1.4\n% ${title}\n%%EOF\n`),
        'phieu.pdf',
      );
      assert.equal(file.status, 201, JSON.stringify(file.body));
      if (publish) {
        assert.equal((await api('POST', `/learning-resources/${id}/submit`, teacher)).status, 200);
        const reviewed = await api('POST', `/learning-resources/${id}/review`, principal, { decision: 'approve' });
        assert.equal(reviewed.body.status, 'published', JSON.stringify(reviewed.body));
      }
    }
    assert.equal(
      (await api('PUT', `/learning-resources/collections/${collectionId}/items`, teacher, { resource_ids: ids }))
        .status,
      200,
    );
    assert.equal(
      (await api('GET', `/resource-sharing/packages/preview?collection_id=${collectionId}`, teacher)).status,
      403,
    );
    const preview = await api('GET', `/resource-sharing/packages/preview?collection_id=${collectionId}`, principal);
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    assert.equal(list(preview.body.exportable).length, 1);
    assert.deepEqual(
      list(preview.body.skipped).map((row) => row.reason),
      ['Chưa công bố hoặc đang ẩn, ngừng dùng', 'Chưa công bố hoặc đang ẩn, ngừng dùng'],
    );
    assert.equal(
      (await download(`/resource-sharing/packages/export?collection_id=${collectionId}`, principal)).status,
      400,
    );
    const exported = await download(
      `/resource-sharing/packages/export?collection_id=${collectionId}&source_school=${encodeURIComponent('Trường THCS Thử')}`,
      principal,
    );
    assert.equal(exported.status, 200);
    const manifest = JSON.parse(gunzipSync(exported.body).toString('utf8'));
    assert.equal(manifest.items.length, 1);
    assert.equal(manifest.items[0].sha256, sha256(PDF));
    assert.ok(!JSON.stringify(manifest).includes('Giáo viên Toán'), 'không có người sở hữu trong gói');

    // Nhập lại chính gói: trùng mã băm nên bỏ qua
    const again = await upload('/resource-sharing/packages/import', principal, exported.body, 'goi.hoclieu.gz');
    assert.equal(again.status, 200, JSON.stringify(again.body));
    assert.equal(again.body.imported_count, 0);
    assert.match(JSON.stringify(again.body.skipped), /Trùng học liệu/);
    // Gói của trường khác: một học liệu tốt, một mã băm sai, một giấy phép không rõ
    const foreign = buildPackage({
      format: PACKAGE_FORMAT,
      package_code: 'GOI-BAN',
      source_school: 'Trường THCS Bạn',
      created_at: '2026-10-20T00:00:00.000Z',
      items: [
        packageItem(),
        packageItem({ title: 'Tệp hỏng', sha256: 'abc' }),
        packageItem({ title: 'Không rõ', license_code: 'UNKNOWN' }),
      ],
    });
    assert.equal((await upload('/resource-sharing/packages/import', teacher, foreign, 'goi.gz')).status, 403);
    const imported = await upload('/resource-sharing/packages/import', principal, foreign, 'goi.gz');
    assert.equal(imported.status, 200, JSON.stringify(imported.body));
    assert.equal(imported.body.imported_count, 1);
    assert.equal(list(imported.body.skipped).length, 2);
    const resourceId = list(imported.body.resource_ids)[0] as unknown as string;
    const detail = await api('GET', `/learning-resources/${resourceId}`, principal);
    const resource = detail.body.resource as Record<string, unknown>;
    assert.equal(resource.status, 'pending_school', 'vào kho ở trạng thái chờ duyệt');
    assert.match(String(resource.origin), /Gói GOI-BAN của Trường THCS Bạn/);
    assert.equal(resource.subject_code, 'THCS-TOAN-22H2');
    const log = list((await api('GET', '/resource-sharing/packages/imports', principal)).body);
    assert.deepEqual(
      log.map((row) => [row.package_code, row.imported_count]),
      [
        ['GOI-BAN', 1],
        [manifest.package_code, 0],
      ],
    );
  });
});
