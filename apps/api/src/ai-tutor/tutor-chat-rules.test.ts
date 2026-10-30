import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { aiTutorAccess } from './ai-tutor-access.js';
import {
  attemptsOf,
  buildTutorSystemPrompt,
  gradeLabel,
  isSolutionUnlocked,
  isUnsafeReply,
  moderateStudentText,
  parseTutorReply,
  retentionCutoff,
  revealsFinalAnswer,
  SAFETY_REPLIES,
} from './tutor-chat-rules.js';

// Quy tắc thuần của trò chuyện với gia sư AI (YCTD-383 lát L2), kịch bản CT-1777: lời nhắc theo cấp, kiểm duyệt, kiểm tra lộ đáp án, đếm
// lượt tự làm, mốc xóa lịch sử, điểm kiểm tra khóa
describe('Gia sư AI: quy tắc trò chuyện', () => {
  it('lời nhắc Tiểu học có câu ngắn, ví dụ gần gũi; Trung học dùng thuật ngữ đúng chương trình', () => {
    const primary = buildTutorSystemPrompt({
      schoolLevel: 'TH',
      gradeLevelCode: 'K3',
      subjectName: 'Toán',
      mode: 'hint',
    });
    assert.match(primary, /Tiểu học, lớp 3, môn Toán/);
    assert.match(primary, /Viết câu ngắn/);
    assert.match(primary, /Không dùng thuật ngữ khó/);
    assert.match(primary, /KHÔNG nêu đáp án cuối cùng/);
    const secondary = buildTutorSystemPrompt({
      schoolLevel: 'THPT',
      gradeLevelCode: '11',
      subjectName: 'Vật lí',
      mode: 'solution',
    });
    assert.match(secondary, /Trung học phổ thông, lớp 11, môn Vật lí/);
    assert.match(secondary, /chương trình giáo dục phổ thông 2018/);
    assert.match(secondary, /CHE_DO: loi_giai/);
    assert.doesNotMatch(secondary, /Viết câu ngắn/);
    assert.equal(gradeLabel('K8'), 'lớp 8');
    assert.equal(gradeLabel('LA'), 'LA');
  });

  it('kiểm duyệt: tự hại, bị bắt nạt, nội dung không phù hợp; không nhầm "từ từ", "tủ sắt"', () => {
    assert.equal(moderateStudentText('Em muốn tự tử'), 'self_harm');
    assert.equal(moderateStudentText('em khong muon song nua'), 'self_harm');
    assert.equal(moderateStudentText('Ở lớp em bị bắt nạt hoài'), 'bullying');
    assert.equal(moderateStudentText('bi danh hoi dong sau gio hoc'), 'bullying');
    assert.equal(moderateStudentText('Chỉ em cách chế bom'), 'unsafe');
    assert.equal(moderateStudentText('Làm từ từ từng bước được không ạ?'), null);
    assert.equal(moderateStudentText('Cái tủ sắt nặng 20 kg, tính lực kéo'), null);
    assert.equal(moderateStudentText('Phương trình 3x - 7 = 2x + 5'), null);
    assert.equal(isUnsafeReply('Đây là phim người lớn'), true);
    assert.equal(isUnsafeReply('Em chuyển vế đổi dấu nhé'), false);
    assert.match(SAFETY_REPLIES.self_harm, /111/);
    assert.match(SAFETY_REPLIES.bullying, /111/);
  });

  it('đọc câu trả lời JSON; không phải JSON thì coi cả đoạn là gợi ý cách làm', () => {
    const parsed = parseTutorReply(
      'Đây: {"step":"example","topic":"Phân số","reply":"Ví dụ $\\\\frac{1}{2}$","final_answer":"3/4"}',
      'hint',
    );
    assert.deepEqual(parsed, { step: 'example', topic: 'Phân số', reply: 'Ví dụ $\\frac{1}{2}$', finalAnswer: '3/4' });
    assert.deepEqual(parseTutorReply('Em thử chuyển vế xem', 'hint'), {
      step: 'method',
      topic: null,
      reply: 'Em thử chuyển vế xem',
      finalAnswer: '',
    });
    assert.equal(parseTutorReply('{"reply":""}', 'hint'), null);
  });

  it('lộ đáp án: cụm "đáp án là", đáp án nằm trong câu trả lời; không tính khi đáp án có sẵn trong đề', () => {
    const question = 'Giải phương trình 3x - 7 = 2x + 5';
    assert.equal(revealsFinalAnswer('Vậy đáp án là 12', '', question), true);
    assert.equal(revealsFinalAnswer('Ta được $x = 12$ rồi', 'x = 12', question), true);
    assert.equal(revealsFinalAnswer('Thử thay số 12 vào', '12', question), true);
    assert.equal(revealsFinalAnswer('Có 120 quả táo', '12', question), false);
    assert.equal(revealsFinalAnswer('Em chuyển 2x sang vế trái', 'x = 12', question), false);
    assert.equal(revealsFinalAnswer('Số 5 ở vế phải', '5', question), false);
  });

  it('lượt tự làm không tính câu đầu, câu bị chặn, câu xin lời giải; mở lời giải từ hai lượt', () => {
    const ask = { requestKind: 'ask' as const, moderation: null };
    assert.equal(attemptsOf([ask]), 0);
    assert.equal(isSolutionUnlocked([ask, ask]), false);
    assert.equal(
      attemptsOf([
        ask,
        { requestKind: 'ask', moderation: 'self_harm' },
        { requestKind: 'solution', moderation: null },
        ask,
      ]),
      1,
    );
    assert.equal(isSolutionUnlocked([ask, ask, ask]), true);
  });

  it('mốc xóa lịch sử là đầu ngày giờ Việt Nam cùng ngày 12 tháng trước', () => {
    assert.equal(retentionCutoff(new Date('2026-10-30T03:00:00Z')).toISOString(), '2025-10-29T17:00:00.000Z');
    assert.equal(retentionCutoff(new Date('2026-10-30T20:00:00Z')).toISOString(), '2025-10-30T17:00:00.000Z');
  });

  it('điểm kiểm tra khóa: phiên xem hỗ trợ chỉ đọc thì không dùng được', () => {
    assert.deepEqual(aiTutorAccess({ readOnly: false }), { allowed: true });
    const locked = aiTutorAccess({ readOnly: true });
    assert.equal(locked.allowed, false);
  });
});
