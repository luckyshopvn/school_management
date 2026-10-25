import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addDays, daysBetween, decideLifecycle, DEFAULT_PLAN_LIFECYCLE } from './school-plans.js';

// Chuyển trạng thái trường theo hạn của gói dịch vụ (DT-SaaS phần S5a, YCTD-194), kịch bản CT-S5a-1
describe('chuyển trạng thái theo hạn dùng thử, hạn đã trả phí', () => {
  const today = '2026-11-20';
  const decide = (status: 'trial' | 'active' | 'read_only' | 'suspended', dueOffset: number | null, paid = false) =>
    decideLifecycle(
      {
        status,
        trialEndsOn: !paid && dueOffset !== null ? addDays(today, dueOffset) : null,
        paidUntil: paid && dueOffset !== null ? addDays(today, dueOffset) : null,
      },
      today,
      DEFAULT_PLAN_LIFECYCLE,
    );

  it('CT-S5a-1: nhắc trước 15, 7, 1 ngày; chỉ đọc sau hạn 7 ngày; tạm ngưng sau 30 ngày; không hạn thì giữ nguyên', () => {
    assert.equal(daysBetween('2026-11-20', '2026-12-05'), 15);
    assert.deepEqual(
      [15, 14, 7, 1, 0].map((offset) => decide('trial', offset).remind),
      [true, false, true, true, false],
    );
    assert.equal(decide('trial', 15).daysLeft, 15);
    assert.equal(decide('trial', -7).next, null, 'quá hạn đúng 7 ngày vẫn dùng được');
    assert.equal(decide('trial', -8).next, 'read_only');
    assert.equal(decide('active', -8, true).next, 'read_only');
    assert.equal(decide('read_only', -8, true).next, null, 'đã chỉ đọc thì giữ');
    assert.equal(decide('read_only', -31, true).next, 'suspended');
    assert.equal(decide('trial', -31).next, 'suspended');
    assert.equal(decide('suspended', -100, true).next, null, 'tạm ngưng không tự đổi');
    assert.equal(decide('active', null).next, null, 'hoạt động không có hạn trả phí thì không hết hạn');
    assert.equal(decide('active', null).dueOn, null);
    const custom = decideLifecycle({ status: 'trial', trialEndsOn: addDays(today, -3), paidUntil: null }, today, {
      ...DEFAULT_PLAN_LIFECYCLE,
      readOnlyAfterDays: 2,
    });
    assert.equal(custom.next, 'read_only', 'hạn chuyển cấu hình được');
  });
});
