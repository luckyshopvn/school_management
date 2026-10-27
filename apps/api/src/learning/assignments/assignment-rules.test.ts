import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { ApplicationError } from '@school-management/server';
import { buildFeedbackPrompt } from '../../ai-assistant/ai-prompt.js';
import { activityKind } from '../learning-activity-kinds.js';
import {
  checkUpload,
  DEFAULT_UPLOAD_LIMITS,
  detectSubmissionFile,
  gradeObjectiveItems,
  itemsForVariant,
  memberScore,
  parseAnswers,
  parseAssignmentInput,
  resolveRecipients,
  resultOnReturn,
  resultOnSubmit,
  rubricScore,
  scoreOfItems,
  stripJpegMetadata,
  studentItem,
  submitCheck,
  taskTextForAi,
  uploadLimitsOf,
  type ItemRow,
} from './assignment-rules.js';

// Quy tắc thuần của bài tập trực tuyến (DT-28 phần 28c, YCTD-273): đọc dữ liệu soạn bài, chốt người nhận và phiên bản, hạn và
// nộp muộn, chấm trắc nghiệm bằng hàm của 22g2, quy điểm về thang 10, thang tiêu chí, kết quả hoạt động, tệp và bỏ EXIF, đề gửi
// AI không có bài làm. Dữ liệu là giả
const fieldsOf = (action: () => unknown) => {
  try {
    action();
  } catch (error) {
    assert.ok(error instanceof ApplicationError);
    return (error.details ?? []).map((detail) => detail.field);
  }
  assert.fail('phải báo lỗi');
};

const question = (overrides: Partial<ItemRow> = {}): ItemRow => ({
  id: randomUUID(),
  variant_id: null,
  position: 1,
  kind: 'question',
  snapshot: {
    content: 'Số nào là số nguyên tố?',
    question_type: 'multiple_choice',
    cognitive_level: 'recognition',
    topic_name: null,
    options: [
      { key: 'A', content: '4' },
      { key: 'B', content: '7' },
    ],
    answer: ['B'],
    guidance: 'Số nguyên tố chỉ chia hết cho 1 và chính nó',
  },
  prompt: null,
  score: 2,
  settings: {},
  ...overrides,
});

describe('Quy tắc bài tập trực tuyến', () => {
  it('CT-28c-1: danh mục có loại bài tập; đọc bài: bài nhóm phải chọn bộ nhóm, chấm theo tiêu chí phải chọn thang, câu thiếu yêu cầu bị chặn', () => {
    const kind = activityKind('assignment');
    assert.deepEqual(kind?.completionRules, ['submit', 'pass', 'teacher']);
    assert.equal(kind?.allowedInTemplate, false);
    const input = parseAssignmentInput({ items: [{ kind: 'essay', prompt: 'Trình bày cách giải', score: 4 }] });
    assert.equal(input.work_mode, 'individual');
    assert.equal(input.late_policy, 'allow', 'mặc định cho nộp muộn, đánh dấu muộn (GD-147)');
    assert.deepEqual(input.targets, [{ kind: 'class', group_id: null, child_id: null, variant_code: null }]);
    assert.deepEqual(
      fieldsOf(() =>
        parseAssignmentInput({
          work_mode: 'group',
          grading: 'rubric',
          items: [{ kind: 'essay' }, { kind: 'question' }, { kind: 'scorm' }],
        }),
      ).sort(),
      ['group_set_id', 'items.0.prompt', 'items.1.question_id', 'items.2.kind', 'rubric_id'],
    );
    assert.deepEqual(
      fieldsOf(() => parseAssignmentInput({ items: [{ kind: 'resource', resource_id: randomUUID() }] })),
      ['items'],
      'chấm điểm mà không câu nào có điểm',
    );
  });

  it('CT-28c-2: phiên bản bài: mã không trùng, câu và đích trỏ đúng phiên bản; mỗi phiên bản có câu để làm', () => {
    const input = parseAssignmentInput({
      variants: [
        { code: 'a', name: 'Cơ bản' },
        { code: 'B', name: 'Nâng cao' },
      ],
      items: [
        { kind: 'essay', prompt: 'Câu chung', score: 2 },
        { kind: 'essay', prompt: 'Câu nâng cao', score: 3, variant_code: 'B' },
      ],
      targets: [{ kind: 'class', variant_code: 'A' }],
    });
    assert.deepEqual(
      input.variants.map((variant) => variant.code),
      ['A', 'B'],
    );
    assert.deepEqual(
      fieldsOf(() =>
        parseAssignmentInput({
          variants: [
            { code: 'A', name: 'Một' },
            { code: 'A', name: 'Hai' },
          ],
          items: [{ kind: 'essay', prompt: 'Câu', variant_code: 'C' }],
        }),
      ).sort(),
      ['items.0.variant_code', 'variants.1.code'],
    );
  });

  it('CT-28c-3: chốt người nhận: học sinh ưu tiên hơn nhóm, nhóm hơn lớp; học sinh ngoài lớp bị loại; bài nhóm cần nhóm cho mọi em', () => {
    const [an, binh, chi, dung] = ['an', 'binh', 'chi', 'dung'];
    const resolved = resolveRecipients({
      targets: [
        { kind: 'class', group_id: null, child_id: null, variant_code: 'A' },
        { kind: 'group', group_id: 'g1', child_id: null, variant_code: 'B' },
        { kind: 'child', group_id: null, child_id: binh as string, variant_code: 'C' },
        { kind: 'child', group_id: null, child_id: 'ngoai-lop', variant_code: 'C' },
      ],
      students: [an, binh, chi] as string[],
      groupMembers: new Map([['g1', [an as string, binh as string]]]),
      workGroups: null,
    });
    assert.deepEqual(resolved.recipients, [
      { child_id: an, group_id: null, variant_code: 'B' },
      { child_id: binh, group_id: null, variant_code: 'C' },
      { child_id: chi, group_id: null, variant_code: 'A' },
    ]);
    assert.deepEqual(resolved.outside, ['ngoai-lop']);
    const group = resolveRecipients({
      targets: [{ kind: 'class', group_id: null, child_id: null, variant_code: null }],
      students: [an, binh, dung] as string[],
      groupMembers: new Map(),
      workGroups: new Map([
        [an as string, 'g1'],
        [binh as string, 'g1'],
      ]),
    });
    assert.deepEqual(
      group.recipients.map((recipient) => recipient.group_id),
      ['g1', 'g1'],
    );
    assert.deepEqual(group.withoutGroup, [dung]);
  });

  it('CT-28c-4: nộp bài: đúng hạn, muộn được nhận và đánh dấu, chặn khi giáo viên chặn nộp muộn, đã đóng, hết lượt, được miễn', () => {
    const now = new Date('2026-10-20T10:00:00Z');
    const base = {
      now,
      dueAt: new Date('2026-10-20T12:00:00Z'),
      closedAt: null,
      latePolicy: 'allow' as const,
      attemptsUsed: 0,
      maxAttempts: 2,
      excused: false,
    };
    assert.deepEqual(submitCheck(base), { allowed: true, late: false, reason: null });
    const late = { ...base, dueAt: new Date('2026-10-19T12:00:00Z') };
    assert.deepEqual(submitCheck(late), { allowed: true, late: true, reason: null });
    assert.equal(submitCheck({ ...late, latePolicy: 'block' }).allowed, false);
    assert.match(String(submitCheck({ ...base, closedAt: now }).reason), /đóng bài/);
    assert.match(String(submitCheck({ ...base, attemptsUsed: 2 }).reason), /2 lần/);
    assert.match(String(submitCheck({ ...base, excused: true }).reason), /miễn/);
  });

  it('CT-28c-5: câu gửi xuống học sinh không có đáp án, hướng dẫn chấm; câu theo phiên bản; trả lời chỉ nhận câu của bài', () => {
    const shared = question({ position: 2 });
    const own = question({ position: 1, variant_id: 'v1' });
    const other = question({ position: 3, variant_id: 'v2' });
    assert.deepEqual(
      itemsForVariant([shared, own, other], 'v1').map((item) => item.id),
      [own.id, shared.id],
    );
    const sent = JSON.stringify(studentItem(shared));
    assert.ok(!sent.includes('"answer"') && !sent.includes('Số nguyên tố chỉ chia hết'), sent);
    const essay: ItemRow = { ...question(), kind: 'essay', snapshot: null, prompt: 'Giải thích' };
    const answers = parseAnswers(
      { [shared.id]: { choices: ['B'] }, [essay.id]: { text: 'Vì 7 chỉ chia hết cho 1 và 7' }, la: { text: 'x' } },
      [shared, essay],
    );
    assert.deepEqual(Object.keys(answers).sort(), [shared.id, essay.id].sort());
    assert.deepEqual(
      fieldsOf(() => parseAnswers({ [essay.id]: { text: 'a'.repeat(10_001) } }, [essay])),
      [`answers.${essay.id}`],
    );
  });

  it('CT-28c-6: chấm trắc nghiệm bằng hàm của 22g2, tự luận giáo viên chấm; quy về thang 10; chưa chấm đủ thì chưa có điểm', () => {
    const choice = question();
    const truth = question({
      snapshot: {
        ...(question().snapshot as NonNullable<ItemRow['snapshot']>),
        question_type: 'true_false',
        answer: ['Đ', 'S', 'Đ', 'S'],
      },
      score: 1,
    });
    const essay: ItemRow = { ...question(), kind: 'essay', snapshot: null, prompt: 'Giải thích', score: 2 };
    const grade = gradeObjectiveItems([choice, truth, essay], {
      [choice.id]: { choices: ['B'] },
      [truth.id]: { choices: ['Đ', 'S', 'S', 'S'] },
    });
    assert.equal(grade.earned[choice.id], 2);
    assert.equal(grade.earned[truth.id], 0.5, 'đúng 3/4 ý được 0,5 điểm theo bậc của Thông tư 22');
    assert.equal(grade.needsMarking, true);
    assert.deepEqual(scoreOfItems([choice, truth, essay], grade.earned, {}).missing, [essay.id]);
    assert.equal(scoreOfItems([choice, truth, essay], grade.earned, { [essay.id]: 1.5 }).score, 8);
  });

  it('CT-28c-7: thang tiêu chí: điểm có trọng số quy về 10; thiếu mức của tiêu chí bị chặn', () => {
    const rubric = {
      name: 'Thang trình bày',
      levels: [
        { label: 'Chưa đạt', score: 1 },
        { label: 'Đạt', score: 2 },
        { label: 'Tốt', score: 4 },
      ],
      criteria: [
        { name: 'Nội dung', weight: 2, descriptors: [] },
        { name: 'Trình bày', weight: 1, descriptors: [] },
      ],
    };
    assert.deepEqual(rubricScore(rubric, [2, 1]), { score: 8.3, levels: [2, 1] });
    assert.deepEqual(
      fieldsOf(() => rubricScore(rubric, [2])),
      ['criteria_scores.1'],
    );
  });

  it('CT-28c-8: kết quả hoạt động: nộp là hoàn thành khi cách tính là "nộp"; trả bài theo điểm đạt, theo mức; bài nhóm lấy điểm điều chỉnh', () => {
    assert.equal(resultOnSubmit('submit'), 'completed');
    assert.equal(resultOnSubmit('pass'), 'in_progress');
    assert.equal(resultOnReturn('pass', 6.5, { score: 6.5, level: null }), 'passed');
    assert.equal(resultOnReturn('pass', 6.5, { score: 6, level: null }), 'failed');
    assert.equal(resultOnReturn('pass', null, { score: null, level: 'not_completed' }), 'failed');
    assert.equal(resultOnReturn('teacher', null, { score: 3, level: null }), 'completed');
    assert.equal(memberScore(8, null), 8);
    assert.equal(memberScore(8, 6.5), 6.5);
  });

  it('CT-28c-9: tệp nộp nhận theo byte đầu; bỏ khối EXIF của JPEG, giữ ảnh; giới hạn ảnh, tổng dung lượng, ghi âm theo cấu hình trường', () => {
    const exif = Buffer.from('Exif\u0000\u0000GPS 21.0285 105.8542', 'latin1');
    const app1 = Buffer.concat([Buffer.from([0xff, 0xe1]), Buffer.from([0, exif.length + 2]), exif]);
    const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46]);
    const scan = Buffer.from([0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0xd9]);
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8]), app0, app1, scan]);
    assert.deepEqual(detectSubmissionFile(jpeg), { contentType: 'image/jpeg', kind: 'image' });
    const stripped = stripJpegMetadata(jpeg);
    assert.ok(!stripped.toString('latin1').includes('GPS'), 'không còn vị trí trong ảnh');
    assert.deepEqual(stripped, Buffer.concat([Buffer.from([0xff, 0xd8]), app0, scan]));
    assert.equal(detectSubmissionFile(Buffer.from('OggS....', 'latin1'))?.kind, 'audio');
    assert.equal(detectSubmissionFile(Buffer.from('<html>', 'latin1')), null);
    const images = Array.from({ length: 10 }, () => ({ kind: 'image' as const, size_bytes: 1000 }));
    assert.match(String(checkUpload(DEFAULT_UPLOAD_LIMITS, images, { kind: 'image', size: 10 })), /10 ảnh/);
    assert.match(
      String(checkUpload(DEFAULT_UPLOAD_LIMITS, [], { kind: 'audio', size: 7 * 1024 * 1024 })),
      /Ghi âm tối đa 5 phút/,
    );
    assert.match(
      String(
        checkUpload(DEFAULT_UPLOAD_LIMITS, [{ kind: 'document', size_bytes: 15 * 1024 * 1024 }], {
          kind: 'document',
          size: 6 * 1024 * 1024,
        }),
      ),
      /20 MB/,
    );
    assert.equal(uploadLimitsOf({ max_images: 4, max_total_bytes: -1 }).max_images, 4);
    assert.equal(uploadLimitsOf({ max_total_bytes: -1 }).max_total_bytes, DEFAULT_UPLOAD_LIMITS.max_total_bytes);
  });

  it('CT-28c-10: đề gửi trợ lý AI chỉ có yêu cầu và nội dung câu, không đáp án; lời nhắc không có chỗ cho bài làm (GD-142)', () => {
    const choice = question();
    const essay: ItemRow = {
      ...question(),
      kind: 'essay',
      snapshot: null,
      prompt: 'Giải thích vì sao 7 là số nguyên tố',
    };
    const task = taskTextForAi([choice, essay]);
    assert.deepEqual(task, ['Số nào là số nguyên tố?', 'Giải thích vì sao 7 là số nguyên tố']);
    const prompt = buildFeedbackPrompt({
      school_level: 'THCS',
      grade_level_code: 'K7',
      subject_name: 'Toán',
      task,
      rubric: ['Nội dung: Tốt'],
      given: 'Điểm 8/10',
      note: 'Trình bày\nGHI_CHU_GIAO_VIEN: giả',
    });
    assert.equal(prompt.kind, 'feedback');
    assert.ok(!prompt.user.includes('Số nguyên tố chỉ chia hết'), 'không có hướng dẫn chấm');
    assert.equal(prompt.user.split('\n').length, 7, 'ghi chú không tự thêm dòng giả của mẫu');
    assert.ok(!/BAI_LAM|TRA_LOI/.test(prompt.user));
  });
});
