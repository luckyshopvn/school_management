import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { currentTenant, runAsSchool, type TenantContext } from '@school-management/server';
import type { Databases } from './databases.js';
import { SchoolLevelResolver } from './school-levels.js';

// Bộ nhớ đệm cấp học riêng từng trường ở chế độ nhiều trường (YCTD-382); kịch bản CT-1726
const school = (code: string): TenantContext => ({
  schoolId: code,
  code,
  name: code,
  status: 'active',
  dataClass: 'synthetic',
  keyPrefix: code,
  yearDatabasePrefix: code,
});

const levelRow = (code: string, isEnabled: boolean, orderNo: number) => ({
  code,
  is_enabled: isEnabled,
  order_no: orderNo,
  display_name: code,
  learner_term: 'Học sinh',
  context_label: `Cấp ${code}`,
  updated_by_name: null,
  updated_at: new Date('2026-10-01T00:00:00Z'),
});

// Cơ sở dữ liệu hệ thống giả: trả bảng cấp học của trường đang trong ngữ cảnh
function systemDatabases(levels: Record<string, ReturnType<typeof levelRow>[]>): Databases {
  const query = {
    selectAll: () => query,
    orderBy: () => query,
    execute: async () => levels[currentTenant()?.code ?? ''] ?? [],
  };
  return { system: { selectFrom: () => query } } as unknown as Databases;
}

describe('Bộ nhớ đệm cấp học theo trường', () => {
  it('CT-1726: trường chỉ có Mầm non đọc trước không làm trường THCS, THPT nhận cấp của trường kia', async () => {
    const resolver = new SchoolLevelResolver(
      systemDatabases({
        'mam-non': [levelRow('MN', true, 1), levelRow('THCS', false, 2)],
        'trung-hoc': [levelRow('MN', false, 1), levelRow('THCS', true, 2), levelRow('THPT', true, 3)],
      }),
    );
    assert.deepEqual(await runAsSchool(school('mam-non'), () => resolver.enabled()), ['MN']);
    assert.deepEqual(await runAsSchool(school('trung-hoc'), () => resolver.enabled()), ['THCS', 'THPT']);
    assert.equal(await runAsSchool(school('trung-hoc'), () => resolver.defaultLevel()), 'THCS');
    // Xóa đệm của một trường không ảnh hưởng trường khác
    runAsSchool(school('mam-non'), () => resolver.invalidate());
    assert.deepEqual(await runAsSchool(school('mam-non'), () => resolver.enabled()), ['MN']);
  });
});
