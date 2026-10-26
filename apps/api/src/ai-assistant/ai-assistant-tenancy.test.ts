import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  aiUsageBetween,
  computeAiCharges,
  savePlanAiPricing,
  savePlatformAiKey,
  savePlatformAiSettings,
  type SchoolDatabaseLayoutValue,
  type SystemDatabase,
} from '@school-management/database';
import { runAsSchool } from '@school-management/server';
import type { Kysely } from 'kysely';
import { BillingCycleJob } from '../billing/billing.js';
import { startMultiTenantApi, type MultiTenantApi } from '../tenant-test-support.js';
import { AI_PROVIDERS, AiAssistantService } from './ai-assistant.js';
import { MockAiProvider, type AiProviderRegistry } from './ai-provider.js';

// Trợ lý AI ở nền tảng nhiều trường (DT-23 phần 23d, YCTD-214), kịch bản CT-23d-8 đến CT-23d-11: khóa AI của từng trường cách ly (trường
// này không dùng được khóa của trường kia, thiếu khóa thì đóng chặt, không rơi về khóa nơi khác), cấu hình do nền tảng cấp khóa chỉ dùng khi
// gói có đơn giá, token của kỳ thành dòng phí AI trên hóa đơn dịch vụ, hạn mức của gói chặn ở máy chủ. Chỉ dùng bộ giả lập `mock`
const operator = { type: 'operator' as const, id: '00000000-0000-4000-8000-000000000002' };

for (const layout of ['database', 'schema'] as SchoolDatabaseLayoutValue[]) {
  describe(`trợ lý AI ở máy chủ API nhiều trường, bố cục ${layout}`, () => {
    let environment: MultiTenantApi;
    let mock: MockAiProvider;
    let planId = '';
    const call = (name: string, method: string, path: string, body?: unknown) =>
      environment.call(name, method, path, body);
    const systemOf = async (name: string) =>
      environment.apiRuntime.connections.database<SystemDatabase>(await environment.tenantOf(name), 'system', 'system');
    const asSchool = async <T>(name: string, action: () => Promise<T>) =>
      runAsSchool(await environment.tenantOf(name), action);

    // Năm học đang mở, cấp THCS và môn Toán để soạn kế hoạch bài dạy nháp
    async function prepareSchool(name: string) {
      const created = await call(name, 'POST', '/academic-years', { name: '2026-2027' });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      const id = created.body.id as string;
      const calendar = {
        first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
        second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
      };
      assert.equal((await call(name, 'PUT', `/academic-years/${id}/calendar`, calendar)).status, 200);
      assert.equal((await call(name, 'POST', `/academic-years/${id}/open`)).status, 200);
      await call(name, 'POST', '/org-units', { code: 'TRUONG', name: `Trường ${name}`, unit_type: 'truong_chinh' });
      const current = await call(name, 'GET', '/school-levels');
      const levels = (current.body.levels as Array<Record<string, unknown>>).map(
        ({ code, order_no, display_name, learner_term, context_label }) => ({
          code,
          is_enabled: code === 'MN' || code === 'THCS',
          order_no,
          display_name,
          learner_term,
          context_label,
        }),
      );
      assert.equal((await call(name, 'PUT', '/school-levels', { levels })).status, 200);
      assert.equal((await call(name, 'POST', '/grade-levels/templates', { school_level: 'THCS' })).status, 200);
      const subject = await call(name, 'POST', '/subjects', {
        school_level: 'THCS',
        code: 'THCS-TOAN',
        name: 'Toán',
        kind: 'subject',
        assessment: 'comment_and_score',
      });
      assert.equal(subject.status, 201, JSON.stringify(subject.body));
    }

    const lesson = (name: string) =>
      call(name, 'POST', '/ai/lesson-plan-drafts', {
        school_level: 'THCS',
        subject_code: 'THCS-TOAN',
        grade_level_code: 'K6',
        topic_text: 'Phép cộng số nguyên',
        duration_minutes: 45,
      });

    before(async () => {
      environment = await startMultiTenantApi({ label: `ai_${layout}`, layout, configuration: { aiMock: true } });
      mock = (environment.api.get(AI_PROVIDERS) as AiProviderRegistry).get('mock') as MockAiProvider;
      const platform = environment.platform.platform;
      const rule = await platform
        .insertInto('price_rules')
        .values({
          code: 'theo-truong-ai',
          name: 'Theo trường',
          components: JSON.stringify(['per_school']),
          school_fee: 2_000_000,
          period: 'monthly',
          vat_percent: 0,
          due_days: 10,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      const plan = await platform
        .insertInto('plans')
        .values({ code: 'goi-ai', name: 'Gói có AI', price_rule_id: rule.id })
        .returning('id')
        .executeTakeFirstOrThrow();
      planId = plan.id;
      for (const name of ['alpha', 'beta']) {
        const tenant = await environment.tenantOf(name);
        await platform
          .insertInto('school_plans')
          .values({ school_id: tenant.schoolId, plan_id: plan.id, effective_from: '2026-01-01' })
          .execute();
      }
      environment.apiRuntime.registry.invalidate();
      await prepareSchool('alpha');
      await prepareSchool('beta');
    });

    after(async () => {
      await environment?.close();
    });

    it('CT-23d-8: khóa AI lưu theo trường, trường này không dùng được khóa của trường kia, thiếu khóa thì đóng chặt', async () => {
      for (const [name, key] of [
        ['alpha', 'khoa-alpha-aaaa'],
        ['beta', 'khoa-beta-bbbb'],
      ] as const) {
        const saved = await call(name, 'PUT', '/school-settings/integrations/ai', {
          enabled: true,
          values: { api_key: key },
        });
        assert.equal(saved.status, 200, JSON.stringify(saved.body));
        const settings = await call(name, 'PUT', '/ai/settings', {
          enabled: true,
          key_mode: 'school',
          provider: 'mock',
          per_user_daily_requests: null,
        });
        assert.equal(settings.status, 200, JSON.stringify(settings.body));
      }
      const alpha = await call('alpha', 'POST', '/ai/check');
      assert.equal(alpha.status, 200, JSON.stringify(alpha.body));
      assert.match(String(alpha.body.detail), /••••aaaa/);
      assert.equal(mock.keysSeen.at(-1), 'khoa-alpha-aaaa');
      const beta = await call('beta', 'POST', '/ai/check');
      assert.match(String(beta.body.detail), /••••bbbb/);
      assert.equal(mock.keysSeen.at(-1), 'khoa-beta-bbbb');
      // Mỗi trường thấy trạng thái và gợi ý khóa của mình
      assert.ok(JSON.stringify((await call('alpha', 'GET', '/ai/status')).body).includes('••••aaaa'));
      assert.ok(!JSON.stringify((await call('alpha', 'GET', '/ai/status')).body).includes('bbbb'));

      // Khóa chỉ có ở cơ sở dữ liệu của chính trường, mã hóa; cơ sở dữ liệu nền tảng không giữ khóa của trường
      const alphaSystem = await systemOf('alpha');
      const rows = await alphaSystem
        .selectFrom('integration_secrets')
        .selectAll()
        .where('connector', '=', 'ai')
        .execute();
      assert.equal(rows.length, 1);
      assert.ok(!rows[0]?.values_encrypted.includes('khoa-alpha-aaaa'));
      const platformRows = await environment.platform.platform
        .selectFrom('platform_integration_secrets')
        .selectAll()
        .execute();
      assert.equal(platformRows.length, 0, 'khóa của trường không nằm ở nền tảng');

      // Beta xóa khóa: không rơi về khóa của alpha
      assert.equal((await call('beta', 'DELETE', '/school-settings/integrations/ai')).status, 200);
      const after = await call('beta', 'POST', '/ai/check');
      assert.equal(after.status, 422);
      assert.match(String(after.body.error && (after.body.error as Record<string, unknown>).message), /khóa AI/);
      assert.equal(mock.keysSeen.at(-1), 'khoa-beta-bbbb', 'bộ giả lập không nhận khóa nào khác sau khi xóa');
      assert.equal((await call('alpha', 'POST', '/ai/check')).status, 200);
      // Không có ngữ cảnh trường thì cơ sở dữ liệu hệ thống không truy cập được: bộ nối đóng chặt
      await assert.rejects(() => environment.api.get(AiAssistantService).settings());
    });

    it('CT-23d-9: cấu hình do nền tảng cấp khóa chỉ dùng khi gói có đơn giá và nền tảng bật khóa chung', async () => {
      const platform = environment.platform.platform;
      const choose = (name: string) =>
        call(name, 'PUT', '/ai/settings', {
          enabled: true,
          key_mode: 'platform',
          provider: 'mock',
          per_user_daily_requests: null,
        });
      assert.equal((await choose('alpha')).status, 200);
      const noPricing = await call('alpha', 'GET', '/ai/status');
      assert.equal(noPricing.body.ready, false);
      assert.match(String(noPricing.body.reason), /đơn giá AI/);
      assert.equal((await call('alpha', 'POST', '/ai/check')).status, 422);

      await savePlanAiPricing(
        platform,
        planId,
        {
          freeTokens: 100_000,
          inputPricePer1k: 100,
          outputPricePer1k: 500,
          modelPrices: {},
          minimumFee: 0,
          roundingStep: 100,
        },
        operator,
      );
      const noKey = await call('alpha', 'GET', '/ai/status');
      assert.match(String(noKey.body.reason), /khóa AI dùng chung/);

      await savePlatformAiSettings(platform, { provider: 'mock', model: 'mock-model', endpoint: null }, operator);
      await savePlatformAiKey(
        platform,
        environment.platform.masterKey,
        { enabled: true, apiKey: 'khoa-nen-tang-9999' },
        operator,
      );
      const ready = await call('alpha', 'GET', '/ai/status');
      assert.equal(ready.body.ready, true, JSON.stringify(ready.body));
      const check = await call('alpha', 'POST', '/ai/check');
      assert.equal(check.status, 200, JSON.stringify(check.body));
      assert.match(String(check.body.detail), /••••9999/);
      assert.equal(check.body.key_mode, 'platform');
      assert.equal(mock.keysSeen.at(-1), 'khoa-nen-tang-9999');
      // Trường dùng cấu hình `school` ở beta vẫn dùng khóa của riêng mình, không dùng khóa nền tảng
      await call('beta', 'PUT', '/school-settings/integrations/ai', {
        enabled: true,
        values: { api_key: 'khoa-beta-bbbb' },
      });
      await call('beta', 'POST', '/ai/check');
      assert.equal(mock.keysSeen.at(-1), 'khoa-beta-bbbb');
      // Soạn ở cấu hình nền tảng chạy được và ghi nhật ký với cấu hình dùng
      const drafted = await lesson('alpha');
      assert.equal(drafted.status, 201, JSON.stringify(drafted.body));
      const rows = await (
        await systemOf('alpha')
      )
        .selectFrom('ai_requests')
        .select(['key_mode', 'model', 'kind'])
        .where('kind', '=', 'lesson_plan')
        .execute();
      assert.deepEqual(rows, [{ key_mode: 'platform', model: 'mock-model', kind: 'lesson_plan' }]);
      // Khóa nền tảng không bao giờ xuống cơ sở dữ liệu trường
      const alphaSecrets = await (
        await systemOf('alpha')
      )
        .selectFrom('integration_secrets')
        .select('connector')
        .execute();
      assert.ok(!alphaSecrets.some((row) => row.connector === 'ai' && JSON.stringify(row).includes('9999')));
    });

    it('CT-23d-10: token của kỳ ở cấu hình nền tảng thành dòng phí AI trên hóa đơn; cấu hình trường không thu phí', async () => {
      const seed = async (name: string, mode: 'school' | 'platform') => {
        const system: Kysely<SystemDatabase> = await systemOf(name);
        await system
          .insertInto('ai_requests')
          .values({
            user_id: '00000000-0000-4000-8000-0000000000aa',
            user_name: 'Người dùng thử',
            kind: 'lesson_plan',
            status: 'success',
            key_mode: mode,
            provider: 'mock',
            model: 'mock-model',
            prompt_sha256: 'b'.repeat(64),
            input_tokens: 1_000_000,
            output_tokens: 500_000,
          })
          .execute();
        await system
          .updateTable('ai_requests')
          .set({ created_at: new Date('2026-10-15T05:00:00Z') } as never)
          .where('prompt_sha256', '=', 'b'.repeat(64))
          .execute();
      };
      await seed('alpha', 'platform');
      await seed('beta', 'school');
      for (const name of ['alpha', 'beta']) {
        environment.apiRuntime.registry.invalidate();
        await asSchool(name, () => environment.api.get(BillingCycleJob).run(new Date('2026-11-01T03:00:00Z')));
      }
      const alpha = await call('alpha', 'GET', '/billing/invoices');
      const alphaInvoice = (alpha.body.invoices as Array<Record<string, unknown>>)[0];
      assert.ok(alphaInvoice, JSON.stringify(alpha.body));
      // 1.000.000 token vào × 100 + 500.000 token ra × 500, trừ 100.000 token miễn phí theo tỷ lệ, làm tròn lên bội 100 đồng
      const detail = await call('alpha', 'GET', `/billing/invoices/${String(alphaInvoice.id)}`);
      const lines = detail.body.lines as Array<Record<string, unknown>>;
      const ai = lines.filter((line) => line.kind === 'ai');
      assert.equal(ai.length, 1, JSON.stringify(lines));
      // Kỳ tháng 10 còn có yêu cầu thật ở CT-23d-9 (token của bộ giả lập): số tiền đúng bằng hàm tính trên toàn bộ token của kỳ
      const tenantAlpha = await environment.tenantOf('alpha');
      const periodUsage = await aiUsageBetween(
        environment.platform.platform,
        tenantAlpha.schoolId,
        '2026-10-01',
        '2026-10-31',
        'platform',
      );
      assert.ok(periodUsage.reduce((sum, row) => sum + row.inputTokens, 0) >= 1_000_000);
      const expected = computeAiCharges(
        {
          freeTokens: 100_000,
          inputPricePer1k: 100,
          outputPricePer1k: 500,
          modelPrices: {},
          minimumFee: 0,
          roundingStep: 100,
        },
        periodUsage,
      ).lines.reduce((sum, line) => sum + line.amount, 0);
      assert.ok(expected >= 326_700 && expected < 330_000, String(expected));
      assert.equal(ai[0]?.amount, expected);
      assert.match(String(ai[0]?.description), /mock-model/);
      assert.equal(detail.body.total, 2_000_000 + expected);

      const beta = await call('beta', 'GET', '/billing/invoices');
      const betaInvoice = (beta.body.invoices as Array<Record<string, unknown>>)[0];
      assert.equal(betaInvoice?.total, 2_000_000, 'cấu hình school miễn phí, không có dòng AI');

      // Việc tổng hợp ghi lặp không cộng trùng; bảng đo giữ cả hai cấu hình riêng
      await asSchool('alpha', () => environment.api.get(AiAssistantService).syncUsage());
      const tenant = await environment.tenantOf('alpha');
      const usage = await environment.platform.platform
        .selectFrom('ai_token_usage')
        .select(['config', 'requests', 'input_tokens', 'output_tokens'])
        .where('school_id', '=', tenant.schoolId)
        .where('usage_date', '=', '2026-10-15')
        .execute();
      assert.deepEqual(usage, [{ config: 'platform', requests: 1, input_tokens: '1000000', output_tokens: '500000' }]);
      const betaTenant = await environment.tenantOf('beta');
      const betaUsage = await environment.platform.platform
        .selectFrom('ai_token_usage')
        .select(['config'])
        .where('school_id', '=', betaTenant.schoolId)
        .execute();
      // Beta dùng cấu hình school (cả lần kiểm tra kết nối): chỉ có dòng của cấu hình school, không có dòng thu phí
      assert.ok(betaUsage.length >= 1);
      assert.ok(betaUsage.every((row) => row.config === 'school'));
      // Trường xem tạm tính của kỳ hiện tại (tháng 10, đồng hồ thật còn trong kỳ) từ nhật ký của chính mình: khớp số trên hóa đơn
      const status = await call('alpha', 'GET', '/ai/status');
      const estimate = status.body.estimate as Record<string, unknown>;
      assert.equal(typeof estimate.amount, 'number');
      assert.match(String(estimate.period_start), /^\d{4}-\d{2}-01$/);
      if (String(estimate.period_start) === '2026-10-01') {
        assert.equal(estimate.amount, expected);
      }
    });

    it('CT-23d-11: hạn mức yêu cầu và token của gói chặn ở máy chủ cho cả hai cấu hình; 0 là gói không dùng AI', async () => {
      const platform = environment.platform.platform;
      const setLimits = async (requests: number | null, tokens: number | null) => {
        await platform
          .updateTable('plans')
          .set({ ai_max_requests: requests, ai_max_tokens: tokens })
          .where('id', '=', planId)
          .execute();
        environment.apiRuntime.registry.invalidate();
      };
      // Tháng này alpha đã có một yêu cầu thật ở CT-23d-9 và tổng token nhỏ
      await setLimits(1, null);
      const blockedByRequests = await lesson('alpha');
      assert.equal(blockedByRequests.status, 422, JSON.stringify(blockedByRequests.body));
      assert.equal((blockedByRequests.body.error as Record<string, unknown>).code, 'PLAN_LIMIT_EXCEEDED');
      await setLimits(null, 1);
      const blockedByTokens = await lesson('alpha');
      assert.equal((blockedByTokens.body.error as Record<string, unknown>).code, 'PLAN_LIMIT_EXCEEDED');
      // Beta (cấu hình school) cũng bị giới hạn của gói áp ở máy chủ (chống lạm dụng)
      await call('beta', 'PUT', '/ai/settings', {
        enabled: true,
        key_mode: 'school',
        provider: 'mock',
        per_user_daily_requests: null,
      });
      await (
        await systemOf('beta')
      )
        .insertInto('ai_requests')
        .values({
          user_id: '00000000-0000-4000-8000-0000000000bb',
          user_name: 'Người dùng thử',
          kind: 'lesson_plan',
          status: 'success',
          key_mode: 'school',
          provider: 'mock',
          model: 'm',
          prompt_sha256: 'c'.repeat(64),
          input_tokens: 10,
          output_tokens: 10,
        })
        .execute();
      assert.equal(((await lesson('beta')).body.error as Record<string, unknown>).code, 'PLAN_LIMIT_EXCEEDED');
      await setLimits(0, null);
      assert.equal(((await lesson('alpha')).body.error as Record<string, unknown>).code, 'PLAN_LIMIT_EXCEEDED');
      const blockedRows = await (
        await systemOf('alpha')
      )
        .selectFrom('ai_requests')
        .select('id')
        .where('status', '=', 'blocked')
        .execute();
      assert.ok(blockedRows.length >= 3, 'yêu cầu bị chặn vẫn ghi nhật ký');
      await setLimits(null, null);
      assert.equal((await lesson('alpha')).status, 201);
      // Giới hạn hiện ở màn hình quản trị AI của trường
      await setLimits(50, 100_000);
      const status = await call('alpha', 'GET', '/ai/status');
      assert.deepEqual(
        {
          requests: (status.body.limits as Record<string, unknown>).max_requests,
          tokens: (status.body.limits as Record<string, unknown>).max_tokens,
        },
        { requests: 50, tokens: 100_000 },
      );
      await setLimits(null, null);
    });
  });
}
