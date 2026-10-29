import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Clock, currentTenant, runAsSchool, type TenantContext } from '@school-management/server';
import type { Databases } from '../common/databases.js';
import { DemoMode } from './demo-mode.js';

// Cờ bản trình diễn đệm riêng từng trường ở chế độ nhiều trường (YCTD-382); kịch bản CT-1727
const school = (code: string): TenantContext => ({
  schoolId: code,
  code,
  name: code,
  status: 'active',
  dataClass: 'synthetic',
  keyPrefix: code,
  yearDatabasePrefix: code,
});

class FixedClock extends Clock {
  now(): Date {
    return new Date('2026-10-29T08:00:00Z');
  }
}

describe('Cờ bản trình diễn theo trường', () => {
  it('CT-1727: trường trình diễn đọc trước không làm trường thật bị coi là bản trình diễn và ngược lại', async () => {
    // Chỉ trường "tc-demo" có dấu bản trình diễn
    const query = {
      selectAll: () => query,
      executeTakeFirst: async () =>
        currentTenant()?.code === 'tc-demo'
          ? { seeded_at: null, next_reset_at: null, reset_interval_hours: null, accounts: [] }
          : undefined,
    };
    const databases = { system: { selectFrom: () => query } } as unknown as Databases;
    const demoMode = new DemoMode(databases, new FixedClock());
    assert.equal(await runAsSchool(school('tc-demo'), () => demoMode.isEnabled()), true);
    assert.equal(await runAsSchool(school('truong-that'), () => demoMode.isEnabled()), false);
    await runAsSchool(school('truong-that'), () => demoMode.assertLive('tạo mã thanh toán thật'));
    await assert.rejects(
      runAsSchool(school('tc-demo'), () => demoMode.assertLive('tạo mã thanh toán thật')),
      /Bản trình diễn/,
    );
  });
});
