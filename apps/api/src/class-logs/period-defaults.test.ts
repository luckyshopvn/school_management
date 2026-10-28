import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { periodDefault } from './period-defaults.js';

// Điểm danh theo tiết lấy mặc định từ điểm danh đầu ngày (YCTD-350)
describe('Trạng thái mặc định của tiết', () => {
  it('lấy theo điểm danh đầu ngày; về sớm vẫn có mặt; vắng có báo là vắng có phép', () => {
    assert.deepEqual(periodDefault('present', false), { status: 'present', source: 'daily' });
    assert.deepEqual(periodDefault('late', false), { status: 'late', source: 'daily' });
    assert.deepEqual(periodDefault('early_leave', false), { status: 'present', source: 'daily' });
    assert.deepEqual(periodDefault('late_and_early_leave', false), { status: 'late', source: 'daily' });
    assert.deepEqual(periodDefault('absent_notified', false), { status: 'absent_excused', source: 'daily' });
    // Điểm danh đầu ngày đã ghi thì đứng trước báo vắng
    assert.deepEqual(periodDefault('absent_unnotified', true), { status: 'absent_unexcused', source: 'daily' });
  });

  it('chưa điểm danh đầu ngày: có báo vắng là vắng có phép, không có là có mặt', () => {
    assert.deepEqual(periodDefault(null, true), { status: 'absent_excused', source: 'absence' });
    assert.deepEqual(periodDefault(null, false), { status: 'present', source: 'default' });
  });
});
