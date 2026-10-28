import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  flushQueue,
  isExpired,
  isNetworkFailure,
  orderedQueue,
  recordKey,
  type QueuedOperation,
} from './offline-rules.ts';

// Quy tắc thuần của học khi mạng yếu (DT-28 phần 28j, YCTD-280)
const operation = (id: string, kind: QueuedOperation['kind'], created_at: number): QueuedOperation => ({
  id,
  kind,
  activity_id: 'a',
  item_id: kind === 'upload' ? 'i' : null,
  client_key: id,
  client_submitted_at: null,
  created_at,
});

describe('Học khi mạng yếu', () => {
  it('CT-28j-1: khóa không có tên học sinh; quá hạn theo số ngày của trường, tối đa 7; hàng đợi theo thứ tự, tệp trước lần nộp', () => {
    assert.equal(recordKey('draft', 'hoat-dong-1'), 'draft:hoat-dong-1');
    const day = 86_400_000;
    assert.equal(isExpired(0, 2 * day, 3), false);
    assert.equal(isExpired(0, 4 * day, 3), true);
    assert.equal(isExpired(0, 8 * day, 30), true, 'trường đặt quá 7 ngày vẫn tính 7');
    assert.equal(isExpired(5 * day, 0, 7), true, 'đồng hồ máy lùi quá một ngày thì xoá');
    assert.deepEqual(
      orderedQueue([operation('n', 'submit', 5), operation('t', 'upload', 5), operation('c', 'upload', 1)]).map(
        (item) => item.id,
      ),
      ['c', 't', 'n'],
    );
    assert.equal(isNetworkFailure(new TypeError('Failed to fetch')), true);
    assert.equal(isNetworkFailure({ status: 503 }), true);
    assert.equal(isNetworkFailure({ status: 422 }), false);
  });

  it('CT-28j-2: gửi hàng đợi: thành công thì xoá; mạng lỗi thì dừng giữ phần còn lại; máy chủ từ chối thì bỏ, ghi lý do', async () => {
    const removed: string[] = [];
    const outcome = await flushQueue(
      [operation('a', 'upload', 1), operation('b', 'submit', 2), operation('c', 'submit', 3)],
      async (item) => {
        if (item.id === 'b') throw Object.assign(new Error('Bài đã đóng'), { status: 422 });
        if (item.id === 'c') throw new TypeError('Failed to fetch');
      },
      async (item) => {
        removed.push(item.id);
      },
    );
    assert.deepEqual(outcome, { sent: 1, dropped: [{ id: 'b', reason: 'Bài đã đóng' }], stopped: true });
    assert.deepEqual(removed, ['a', 'b'], 'c còn trong hàng đợi');
  });
});
