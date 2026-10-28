import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAX_SUBMISSION_COMMENT, appendComment, replyProblem } from './submission-thread-logic.ts';

// Trao đổi trên bài nộp ở ứng dụng giáo viên (YCTD-346): kiểm lời trả lời ở máy khách và ghép lời vừa gửi vào luồng
describe('Trả lời trao đổi trên bài nộp', () => {
  it('CT-28c-17: lời trả lời rỗng, chỉ khoảng trắng, quá dài bị chặn; đúng giới hạn thì hợp lệ', () => {
    assert.equal(replyProblem(''), 'Nhập nội dung trả lời trước khi gửi');
    assert.equal(replyProblem('   \n '), 'Nhập nội dung trả lời trước khi gửi');
    assert.equal(replyProblem('Cô đã xem, em làm tốt'), null);
    assert.equal(replyProblem(`  ${'a'.repeat(MAX_SUBMISSION_COMMENT)}  `), null, 'khoảng trắng hai đầu không tính');
    assert.match(replyProblem('a'.repeat(MAX_SUBMISSION_COMMENT + 1)) ?? '', /tối đa 2000 ký tự/);
  });

  it('CT-28c-17: lời vừa gửi nối cuối luồng, không lặp khi đã có', () => {
    const thread = [{ id: '1', author_name: 'Học sinh An', author_kind: 'student' as const, body: 'Em hỏi cô' }];
    const reply = { id: '2', author_name: 'Cô Lan', author_kind: 'teacher' as const, body: 'Cô trả lời' };
    const next = appendComment(thread, reply);
    assert.deepEqual(
      next.map((comment) => comment.id),
      ['1', '2'],
    );
    assert.equal(appendComment(next, reply), next);
    assert.equal(thread.length, 1, 'không sửa mảng cũ');
  });
});
