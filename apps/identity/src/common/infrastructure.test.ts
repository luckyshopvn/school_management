import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { setMultiTenantMode } from '@school-management/server';
import type { IdentityConfiguration } from './configuration.js';
import { Infrastructure } from './infrastructure.js';
import { MEMORY_STORE_URL } from './memory-store.js';

// Khóa cấp nền tảng của lớp hạ tầng (YCTD-376), kịch bản CT-376-7: yêu cầu của cổng vận hành không thuộc trường nên scopedCache báo
// thiếu ngữ cảnh trường; platformCache vẫn đọc được, khóa có tiền tố `platform:`
describe('lớp hạ tầng: khóa cấp nền tảng', () => {
  const infrastructure = new Infrastructure({
    redisUrl: MEMORY_STORE_URL,
    redisKeyPrefix: 'identity',
    databaseUrl: 'postgres://khong-dung@127.0.0.1:1/khong-co',
  } as IdentityConfiguration);

  after(async () => {
    setMultiTenantMode(false);
    await infrastructure.onModuleDestroy();
  });

  it('CT-376-7: không có trường vẫn đọc được; khóa có tiền tố platform:', async () => {
    setMultiTenantMode(true);
    assert.throws(() => infrastructure.scopedCache('service-status').get('api'), /ngữ cảnh trường/);
    await infrastructure.redis.set('platform:service-status:api', '{"ok":true}', 'EX', 60);
    await infrastructure.redis.set('platform:worker:heartbeat', '2030-01-02T03:04:05.000Z', 'EX', 60);
    assert.equal(await infrastructure.platformCache('service-status').get('api'), '{"ok":true}');
    assert.equal(await infrastructure.platformCache('worker').get('heartbeat'), '2030-01-02T03:04:05.000Z');
    assert.equal(await infrastructure.ping(), 'PONG');
  });
});
