import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  createDatabase,
  createMigratedTestDatabase,
  dropDatabaseIfExists,
  migrateToLatest,
  readConnectionString,
  replaceDatabaseName,
  type SystemDatabase,
} from '@school-management/database';
import type { Kysely } from 'kysely';
import {
  activateAiTutorSubscription,
  aiTutorTurnBalance,
  captureAiTutorTurn,
  createAiTutorSubscription,
  holdAiTutorTurn,
  releaseAiTutorTurn,
  releaseStaleAiTutorHolds,
  type AiTutorPurchaseInput,
} from './ai-tutor-turns.js';

// Đăng ký gói và sổ lượt của gia sư AI trả phí (YCTD-383 lát L0) trên cơ sở dữ liệu hệ thống tạm: chặn mua trùng gói tháng giữa trường
// bán và nền tảng bán (kể cả hai lần mua đồng thời), tạm giữ, trừ, hoàn lượt, thứ tự gói tháng trước lượt mua thêm, hai yêu cầu hỏi đồng
// thời khi chỉ còn một lượt. Dữ liệu bịa
describe('Gia sư AI: đăng ký gói và sổ lượt', () => {
  const baseSystemUrl = readConnectionString('system');
  const databaseName = `school_system_test_${randomUUID().replaceAll('-', '').slice(0, 10)}`;
  const NOW = new Date('2026-10-30T03:00:00Z');
  let system: Kysely<SystemDatabase>;
  let childId = '';

  const plan = (overrides: Partial<AiTutorPurchaseInput['plan']> = {}): AiTutorPurchaseInput['plan'] => ({
    source: 'school',
    id: randomUUID(),
    kind: 'monthly',
    name: 'Cơ bản',
    price: 79000,
    turns: 100,
    allowImages: false,
    schoolLevels: ['TH', 'THCS', 'THPT'],
    status: 'active',
    ...overrides,
  });
  const purchase = (overrides: Partial<AiTutorPurchaseInput> = {}): AiTutorPurchaseInput => ({
    childId,
    childSchoolLevel: 'THCS',
    plan: plan(),
    periodMonth: '2026-10-01',
    buyerUserId: randomUUID(),
    buyerName: 'Phụ huynh thử',
    pendingExpiresAt: null,
    ...overrides,
  });
  const buyActive = async (input: AiTutorPurchaseInput, at = NOW) => {
    const result = await createAiTutorSubscription(system, input, at);
    assert.equal(result.ok, true);
    const id = (result as { subscriptionId: string }).subscriptionId;
    assert.equal(await activateAiTutorSubscription(system, id, at, 'thu-nghiem'), true);
    return id;
  };
  const counters = (id: string) =>
    system
      .selectFrom('ai_tutor_subscriptions')
      .select(['used_turns', 'held_turns', 'valid_from', 'valid_until', 'status'])
      .where('id', '=', id)
      .executeTakeFirstOrThrow();

  before(async () => {
    await createMigratedTestDatabase(baseSystemUrl, databaseName, 'system');
    const url = replaceDatabaseName(baseSystemUrl, databaseName);
    const migration = await migrateToLatest('system', url);
    if (migration.error) {
      throw migration.error;
    }
    system = createDatabase<SystemDatabase>(url);
  });

  after(async () => {
    await system.destroy();
    await dropDatabaseIfExists(baseSystemUrl, databaseName);
  });

  beforeEach(() => {
    childId = randomUUID();
  });

  it('mua gói tháng của trường, kích hoạt: khoảng dùng là tháng 10 giờ Việt Nam; kích hoạt lần hai không đổi gì', async () => {
    const result = await createAiTutorSubscription(system, purchase(), NOW);
    assert.equal(result.ok, true);
    const id = (result as { subscriptionId: string }).subscriptionId;
    assert.equal((await counters(id)).status, 'pending');
    assert.equal(await activateAiTutorSubscription(system, id, NOW, 'dong-thu-1'), true);
    const row = await counters(id);
    assert.equal(row.status, 'active');
    assert.deepEqual(row.valid_from, new Date('2026-09-30T17:00:00Z'));
    assert.deepEqual(row.valid_until, new Date('2026-10-31T17:00:00Z'));
    assert.equal(await activateAiTutorSubscription(system, id, NOW, 'dong-thu-2'), false);
  });

  it('đã có gói tháng của trường thì nền tảng không bán gói tháng cùng tháng; tháng sau và gói lượt vẫn mua được', async () => {
    await buyActive(purchase());
    const platformMonthly = await createAiTutorSubscription(
      system,
      purchase({ plan: plan({ source: 'platform', name: 'Cơ bản tháng', price: 89000 }) }),
      NOW,
    );
    assert.deepEqual(platformMonthly, {
      ok: false,
      block: { code: 'monthly_exists', source: 'school', status: 'active' },
    });
    const nextMonth = await createAiTutorSubscription(
      system,
      purchase({ plan: plan({ source: 'platform' }), periodMonth: '2026-11-01' }),
      NOW,
    );
    assert.equal(nextMonth.ok, true);
    const topUp = await createAiTutorSubscription(
      system,
      purchase({ plan: plan({ source: 'platform', kind: 'top_up', turns: 50 }), periodMonth: null }),
      NOW,
    );
    assert.equal(topUp.ok, true);
  });

  it('dòng chờ thanh toán của nền tảng quá hạn thì bị hủy, trường bán được; còn hạn thì chặn', async () => {
    const pending = await createAiTutorSubscription(
      system,
      purchase({ plan: plan({ source: 'platform' }), pendingExpiresAt: new Date('2026-10-30T03:15:00Z') }),
      NOW,
    );
    assert.equal(pending.ok, true);
    const tooEarly = await createAiTutorSubscription(system, purchase(), new Date('2026-10-30T03:14:59Z'));
    assert.deepEqual(tooEarly, { ok: false, block: { code: 'monthly_exists', source: 'platform', status: 'pending' } });
    const afterExpiry = await createAiTutorSubscription(system, purchase(), new Date('2026-10-30T03:15:00Z'));
    assert.equal(afterExpiry.ok, true);
    const old = await counters((pending as { subscriptionId: string }).subscriptionId);
    assert.equal(old.status, 'cancelled');
  });

  it('cơ sở dữ liệu chặn mua trùng kể cả khi ghi thẳng, bỏ qua quy tắc', async () => {
    await buyActive(purchase());
    await assert.rejects(
      system
        .insertInto('ai_tutor_subscriptions')
        .values({
          child_id: childId,
          plan_source: 'platform',
          plan_id: randomUUID(),
          plan_kind: 'monthly',
          plan_name: 'Ghi thẳng',
          price: 0,
          allow_images: false,
          period_month: '2026-10-01',
          buyer_user_id: randomUUID(),
          buyer_name: 'Phụ huynh thử',
          turns: 10,
        })
        .execute(),
      /ai_tutor_subscriptions_one_monthly/,
    );
  });

  it('hai lần mua gói tháng đồng thời (trường và nền tảng) cho cùng một con: đúng một lần thành công', async () => {
    const results = await Promise.all([
      createAiTutorSubscription(system, purchase(), NOW),
      createAiTutorSubscription(system, purchase({ plan: plan({ source: 'platform' }) }), NOW),
    ]);
    assert.equal(results.filter((result) => result.ok).length, 1);
    const failed = results.find((result) => !result.ok) as { block: { code: string } };
    assert.equal(failed.block.code, 'monthly_exists');
    const rows = await system
      .selectFrom('ai_tutor_subscriptions')
      .select('id')
      .where('child_id', '=', childId)
      .where('status', 'in', ['pending', 'active'])
      .execute();
    assert.equal(rows.length, 1);
  });

  it('tạm giữ, trừ, hoàn lượt; chốt lần hai không đổi gì', async () => {
    const id = await buyActive(purchase({ plan: plan({ turns: 3 }) }));
    const first = await holdAiTutorTurn(system, childId, NOW);
    const second = await holdAiTutorTurn(system, childId, NOW);
    assert.equal(first.ok && second.ok, true);
    assert.deepEqual(await aiTutorTurnBalance(system, childId, NOW), { monthly: 1, topUp: 0 });
    const firstEntry = (first as { entryId: string }).entryId;
    const secondEntry = (second as { entryId: string }).entryId;
    assert.equal(await captureAiTutorTurn(system, firstEntry, NOW), true);
    assert.equal(await releaseAiTutorTurn(system, secondEntry, 'Lỗi nhà cung cấp', NOW), true);
    assert.equal(await captureAiTutorTurn(system, firstEntry, NOW), false);
    assert.equal(await releaseAiTutorTurn(system, firstEntry, 'Lần hai', NOW), false);
    assert.equal(await captureAiTutorTurn(system, secondEntry, NOW), false);
    const row = await counters(id);
    assert.equal(row.used_turns, 1);
    assert.equal(row.held_turns, 0);
    assert.deepEqual(await aiTutorTurnBalance(system, childId, NOW), { monthly: 2, topUp: 0 });
    const ledger = await system
      .selectFrom('ai_tutor_turn_ledger')
      .select(['status', 'release_reason'])
      .where('subscription_id', '=', id)
      .orderBy('status')
      .execute();
    assert.deepEqual(ledger, [
      { status: 'captured', release_reason: null },
      { status: 'released', release_reason: 'Lỗi nhà cung cấp' },
    ]);
  });

  it('dùng hết lượt gói tháng mới trừ lượt mua thêm; hết cả hai thì báo hết lượt', async () => {
    const topUp = await buyActive(
      purchase({ plan: plan({ kind: 'top_up', turns: 1 }), periodMonth: null }),
      new Date('2026-10-02T03:00:00Z'),
    );
    const monthly = await buyActive(purchase({ plan: plan({ turns: 1 }) }));
    const first = await holdAiTutorTurn(system, childId, NOW);
    assert.deepEqual(first.ok && first.subscriptionId, monthly);
    const second = await holdAiTutorTurn(system, childId, NOW);
    assert.deepEqual(second.ok && second.subscriptionId, topUp);
    assert.deepEqual(await holdAiTutorTurn(system, childId, NOW), { ok: false, reason: 'no_turns' });
  });

  it('sang tháng mới: lượt gói tháng cũ hết hạn, lượt mua thêm còn trong 12 tháng; hết 12 tháng thì không dùng được', async () => {
    await buyActive(purchase({ plan: plan({ turns: 5 }) }));
    const topUp = await buyActive(purchase({ plan: plan({ kind: 'top_up', turns: 2 }), periodMonth: null }));
    const november = new Date('2026-11-01T00:00:00Z');
    assert.deepEqual(await aiTutorTurnBalance(system, childId, november), { monthly: 0, topUp: 2 });
    const held = await holdAiTutorTurn(system, childId, november);
    assert.deepEqual(held.ok && held.subscriptionId, topUp);
    const row = await counters(topUp);
    assert.deepEqual(row.valid_until, new Date('2027-10-30T03:00:00Z'));
    assert.deepEqual(await holdAiTutorTurn(system, childId, new Date('2027-10-30T03:00:00Z')), {
      ok: false,
      reason: 'no_turns',
    });
  });

  it('hai yêu cầu hỏi đồng thời khi chỉ còn một lượt: đúng một yêu cầu được giữ lượt', async () => {
    const id = await buyActive(purchase({ plan: plan({ turns: 1 }) }));
    const results = await Promise.all([holdAiTutorTurn(system, childId, NOW), holdAiTutorTurn(system, childId, NOW)]);
    assert.equal(results.filter((result) => result.ok).length, 1);
    assert.deepEqual(
      results.find((result) => !result.ok),
      { ok: false, reason: 'no_turns' },
    );
    const row = await counters(id);
    assert.equal(row.held_turns, 1);
  });

  it('hai yêu cầu đồng thời khi gói tháng còn một lượt và có lượt mua thêm: yêu cầu sau chuyển sang lượt mua thêm', async () => {
    const monthly = await buyActive(purchase({ plan: plan({ turns: 1 }) }));
    const topUp = await buyActive(purchase({ plan: plan({ kind: 'top_up', turns: 5 }), periodMonth: null }));
    const results = await Promise.all([holdAiTutorTurn(system, childId, NOW), holdAiTutorTurn(system, childId, NOW)]);
    const used = results.map((result) => (result.ok ? result.subscriptionId : 'het')).sort();
    assert.deepEqual(used, [monthly, topUp].sort());
  });

  it('lượt tạm giữ quá 10 phút được hoàn; lượt mới giữ thì chưa', async () => {
    const id = await buyActive(purchase({ plan: plan({ turns: 5 }) }));
    const old = await holdAiTutorTurn(system, childId, new Date('2026-10-30T02:49:59Z'));
    const fresh = await holdAiTutorTurn(system, childId, new Date('2026-10-30T02:55:00Z'));
    assert.equal(old.ok && fresh.ok, true);
    const released = await releaseStaleAiTutorHolds(system, NOW);
    assert.ok(released >= 1);
    const statuses = await system
      .selectFrom('ai_tutor_turn_ledger')
      .select(['id', 'status'])
      .where('subscription_id', '=', id)
      .execute();
    const byId = new Map(statuses.map((entry) => [entry.id, entry.status]));
    assert.equal(byId.get((old as { entryId: string }).entryId), 'released');
    assert.equal(byId.get((fresh as { entryId: string }).entryId), 'held');
    assert.equal((await counters(id)).held_turns, 1);
  });

  it('cơ sở dữ liệu từ chối gói lượt có tháng, gói tháng ngày giữa tháng, gói lượt cho gửi ảnh, cấp học lạ', async () => {
    const base = {
      child_id: childId,
      plan_source: 'school' as const,
      plan_id: randomUUID(),
      plan_name: 'Sai',
      price: 0,
      allow_images: false,
      buyer_user_id: randomUUID(),
      buyer_name: 'Phụ huynh thử',
      turns: 10,
    };
    await assert.rejects(
      system
        .insertInto('ai_tutor_subscriptions')
        .values({ ...base, plan_kind: 'top_up', period_month: '2026-10-01' })
        .execute(),
      /ai_tutor_subscriptions_period_check/,
    );
    await assert.rejects(
      system
        .insertInto('ai_tutor_subscriptions')
        .values({ ...base, plan_kind: 'monthly', period_month: '2026-10-15' })
        .execute(),
      /ai_tutor_subscriptions_period_check/,
    );
    const planBase = {
      name: 'Sai',
      price: 0,
      turns: 10,
      created_by: randomUUID(),
      created_by_name: 'Quản trị thử',
    };
    await assert.rejects(
      system
        .insertInto('ai_tutor_plans')
        .values({ ...planBase, kind: 'top_up', allow_images: true, school_levels: ['THCS'] })
        .execute(),
      /ai_tutor_plans_images_check/,
    );
    await assert.rejects(
      system
        .insertInto('ai_tutor_plans')
        .values({ ...planBase, kind: 'monthly', school_levels: ['MN' as 'TH'] })
        .execute(),
      /ai_tutor_plans_levels_check/,
    );
    await assert.rejects(
      system
        .insertInto('ai_tutor_plans')
        .values({ ...planBase, kind: 'monthly', school_levels: [] })
        .execute(),
      /ai_tutor_plans_levels_check/,
    );
  });
});
