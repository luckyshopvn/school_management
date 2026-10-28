import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { teachingToolsFor } from '@school-management/shared';

// Danh mục Hộp công cụ giảng dạy ở gói chung (DT-29, YCTD-325): lọc theo cấp, công cụ trường tắt, tính năng của gói
describe('Hộp công cụ giảng dạy: danh mục công cụ', () => {
  const keys = (level: unknown, options: { disabled?: string[]; planModules?: string[] | null } = {}) =>
    teachingToolsFor({ level, ...options }).map((tool) => tool.key);

  it('CT-29a-2: lọc theo cấp: Mầm non không có trò chơi, sổ đầu bài, lớp học trực tuyến; cấp phổ thông có đủ', () => {
    assert.deepEqual(keys('MN'), ['call', 'group', 'timer', 'scoreboard', 'lesson-plans']);
    assert.deepEqual(keys('THCS'), [
      'call',
      'group',
      'timer',
      'scoreboard',
      'games',
      'lesson-plans',
      'class-log',
      'online-classes',
    ]);
    // Bản chụp danh sách lớp cũ chưa có cấp: không lọc theo cấp
    assert.equal(keys(null).length, keys('TH').length);
  });

  it('CT-29a-3: bỏ công cụ trường tắt và công cụ thuộc tính năng gói chưa bật', () => {
    assert.equal(keys('TH', { disabled: ['games', 'timer'] }).includes('games'), false);
    assert.equal(keys('TH', { disabled: ['games', 'timer'] }).includes('timer'), false);
    assert.equal(keys('TH', { planModules: ['students'] }).includes('online-classes'), false);
    assert.equal(keys('TH', { planModules: ['online-learning'] }).includes('online-classes'), true);
    assert.equal(keys('TH', { planModules: null }).includes('online-classes'), true);
  });
});
