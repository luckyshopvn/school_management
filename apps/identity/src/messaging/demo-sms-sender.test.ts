import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Clock, currentTenant, runAsSchool, type TenantContext } from '@school-management/server';
import type { Infrastructure } from '../common/infrastructure.js';
import { DemoAwareSmsSender } from './demo-sms-sender.js';
import { SmsSender } from './sms-sender.js';

// Cờ bản trình diễn của dịch vụ định danh đệm riêng từng trường (YCTD-382); kịch bản CT-1728
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

class RecordingSmsSender extends SmsSender {
  readonly sent: string[] = [];

  async send(phone: string): Promise<void> {
    this.sent.push(phone);
  }
}

describe('Gửi tin nhắn khi có trường trình diễn', () => {
  it('CT-1728: trường trình diễn đọc trước thì mã gửi cho trường thật vẫn được gửi thật', async () => {
    const query = {
      select: () => query,
      where: () => query,
      executeTakeFirst: async () => (currentTenant()?.code === 'tc-demo' ? { value: true } : undefined),
    };
    const infrastructure = { database: { selectFrom: () => query } } as unknown as Infrastructure;
    const inner = new RecordingSmsSender();
    const sender = new DemoAwareSmsSender(inner, infrastructure, new FixedClock());
    await runAsSchool(school('tc-demo'), () => sender.send('0900000001', 'Mã: 111111'));
    await runAsSchool(school('truong-that'), () => sender.send('0900000002', 'Mã: 222222'));
    assert.deepEqual(inner.sent, ['0900000002']);
  });
});
