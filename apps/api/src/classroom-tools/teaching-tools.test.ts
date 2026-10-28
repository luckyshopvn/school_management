import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TEACHING_TOOLS, teachingToolsFor } from '@school-management/shared';

// Danh mục Hộp công cụ giảng dạy ở gói chung (DT-29, YCTD-325): lọc theo cấp, công cụ trường tắt, tính năng của gói
describe('Hộp công cụ giảng dạy: danh mục công cụ', () => {
  const keys = (level: unknown, options: { disabled?: string[]; planModules?: string[] | null } = {}) =>
    teachingToolsFor({ level, ...options }).map((tool) => tool.key);

  it('CT-29a-2: lọc theo cấp: Mầm non không có trò chơi, sổ đầu bài, lớp học trực tuyến; cấp phổ thông có đủ', () => {
    assert.deepEqual(keys('MN'), [
      'call',
      'group',
      'timer',
      'scoreboard',
      'whiteboard',
      'dice',
      'visual-timer',
      'noise-light',
      'star-board',
      'shapes-colors',
      'counting',
      'alphabet',
      'lesson-plans',
    ]);
    assert.deepEqual(keys('THCS'), [
      'call',
      'group',
      'timer',
      'scoreboard',
      'games',
      'whiteboard',
      'dice',
      'lesson-plans',
      'class-log',
      'online-classes',
    ]);
    // Bản chụp danh sách lớp cũ chưa có cấp: không lọc theo cấp
    assert.equal(keys(null).length, TEACHING_TOOLS.length);
  });

  it('CT-29b-4: mini app Mầm non chỉ ở lớp Mầm non; đồng hồ hình ảnh, đèn trật tự, bảng sao ở Mầm non và Tiểu học', () => {
    for (const key of ['shapes-colors', 'counting', 'alphabet']) {
      assert.equal(keys('TH').includes(key), false, key);
    }
    for (const key of ['visual-timer', 'noise-light', 'star-board']) {
      assert.equal(keys('TH').includes(key), true, key);
      assert.equal(keys('THPT').includes(key), false, key);
    }
  });

  it('CT-29a-3: bỏ công cụ trường tắt và công cụ thuộc tính năng gói chưa bật', () => {
    assert.equal(keys('TH', { disabled: ['games', 'timer'] }).includes('games'), false);
    assert.equal(keys('TH', { disabled: ['games', 'timer'] }).includes('timer'), false);
    assert.equal(keys('TH', { planModules: ['students'] }).includes('online-classes'), false);
    assert.equal(keys('TH', { planModules: ['online-learning'] }).includes('online-classes'), true);
    assert.equal(keys('TH', { planModules: null }).includes('online-classes'), true);
  });
});
