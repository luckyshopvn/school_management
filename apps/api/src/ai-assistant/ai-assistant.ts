import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  aiPricingReady,
  computeAiCharges,
  loadBillingPlan,
  periodContaining,
  readPlanAiPricingByCode,
  readPlatformAiKey,
  readPlatformAiSettings,
  recordAiTokenUsage,
  vietnamDate,
  type AiKeyMode,
  type AiPricing,
  type AiRequestKind,
  type AiRequestStatus,
  type SchoolYearDatabase,
  type TenancyRuntime,
} from '@school-management/database';
import {
  ApplicationError,
  Clock,
  currentTenant,
  isMultiTenantMode,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import { sql, type Kysely } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import { actorNameOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { TENANCY_RUNTIME } from '../common/configuration.js';
import { Databases } from '../common/databases.js';
import { notFoundError, type RequestBody } from '../common/request-fields.js';
import { parseQuestion } from '../exams/exam-inputs.js';
import { ExamsService } from '../exams/exams.js';
import { LearningResourcesService } from '../learning-resources/learning-resources.js';
import { SchoolSettings } from '../school-settings/school-settings.js';
import {
  AI_RULE_CODE,
  buildLessonPlanPrompt,
  buildNameIndex,
  buildQuestionPrompt,
  lessonPlanFreeText,
  lessonPlanMarkdown,
  lessonPlanOf,
  parseLessonPlanRequest,
  parseQuestionDraftRequest,
  personalDataMessage,
  promptHash,
  questionFreeText,
  rawQuestionsOf,
  scanPersonalData,
} from './ai-prompt.js';
import {
  AiProviderError,
  AiProviderRegistry,
  type AiPrompt,
  type AiProvider,
  type AiProviderSettings,
} from './ai-provider.js';

// Trợ lý AI soạn câu hỏi nháp và kế hoạch bài dạy nháp (DT-23 phần 23d, YCTD-214; tài liệu 32 mục 15). Claude tự chọn theo ủy quyền của
// Eric ngày 2026-10-11 (Eric chốt hai cấu hình và thu phí theo token ngày 2026-10-26, GD-102, GD-103):
// - bật tắt theo trường (`ai_settings.enabled`, mặc định tắt); thiếu khóa hoặc tắt thì điểm cuối soạn trả lỗi rõ ràng, phần còn lại của
//   hệ thống chạy như cũ;
// - hai cấu hình khóa: `school` (khóa ở `integration_secrets` của trường, miễn phí) và `platform` (khóa ở cơ sở dữ liệu nền tảng, chỉ
//   dùng khi gói của trường đã đặt đơn giá AI; số token thành dòng phí AI trên hóa đơn dịch vụ). Thiếu ngữ cảnh trường thì cơ sở dữ liệu
//   hệ thống không truy cập được nên bộ nối đóng chặt, không rơi về khóa của trường khác;
// - lời nhắc dựng từ mẫu cố định, chữ do người dùng nhập bị quét dữ liệu cá nhân ở máy chủ (`ai-prompt.ts`); yêu cầu bị từ chối vẫn ghi
//   nhật ký (trạng thái `rejected`, chỉ mã băm của chữ đã quét, không toàn văn);
// - hạn mức: số yêu cầu và số token mỗi tháng của gói (`plans.ai_max_*`, áp cho cả hai cấu hình), số yêu cầu mỗi người mỗi ngày
//   (`ai_settings`); vượt thì chặn và ghi nhật ký `blocked`;
// - kết quả luôn là bản nháp: câu hỏi vào ngân hàng ở trạng thái nháp với cờ `ai_generated` (chỉ dùng được trong đề sau khi người
//   khác thẩm định theo luồng 22g1), kế hoạch bài dạy vào kho học liệu ở trạng thái nháp riêng tư (kiểm duyệt 22h1 trước khi chia sẻ);
// - nhật ký ở cơ sở dữ liệu hệ thống của trường: không lưu toàn văn lời nhắc, chỉ mã băm; token lấy từ phản hồi của nhà cung cấp; yêu cầu
//   nhà cung cấp đã trả lời nhưng kết quả không dùng được vẫn tính token (đã tốn) với trạng thái `success` và 0 kết quả.

export const AI_PROVIDERS = Symbol('AI_PROVIDERS');
export const DEFAULT_AI_MODEL = 'claude-sonnet-5-5';
const MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$/;
const DEFAULT_PER_USER_DAILY = 30;

type SystemDatabase = Databases['system'];
const ZONE_OFFSET = '+07:00';

export interface AiSettingsView {
  enabled: boolean;
  key_mode: AiKeyMode;
  provider: string;
  model: string | null;
  per_user_daily_requests: number | null;
  log_retention_months: number;
}

export interface AiSettingsInput {
  enabled: boolean;
  key_mode: AiKeyMode;
  provider: string;
  model: string | null;
  per_user_daily_requests: number | null;
  log_retention_months: number;
}

const DEFAULT_SETTINGS: AiSettingsView = {
  enabled: false,
  key_mode: 'school',
  provider: 'anthropic',
  model: null,
  per_user_daily_requests: DEFAULT_PER_USER_DAILY,
  log_retention_months: 12,
};

interface Resolved {
  mode: AiKeyMode;
  provider: AiProvider;
  credentials: AiProviderSettings;
}

interface RequestContext {
  user: CurrentUser;
  kind: AiRequestKind;
  schoolLevel: string | null;
  gradeLevelCode: string | null;
  subjectName: string | null;
  topic: string | null;
}

export function parseAiSettings(body: RequestBody, providerCodes: string[]): AiSettingsInput {
  const errors: FieldError[] = [];
  if (typeof body?.enabled !== 'boolean') {
    errors.push({ field: 'enabled', message: 'Chọn bật hoặc tắt' });
  }
  const mode = body?.key_mode;
  if (mode !== 'school' && mode !== 'platform') {
    errors.push({ field: 'key_mode', message: 'Cấu hình khóa là school hoặc platform' });
  }
  const provider = body?.provider;
  if (typeof provider !== 'string' || !providerCodes.includes(provider)) {
    errors.push({ field: 'provider', message: `Nhà cung cấp là ${providerCodes.join(', ')}` });
  }
  let model: string | null = null;
  if (body?.model !== undefined && body.model !== null && body.model !== '') {
    if (typeof body.model !== 'string' || !MODEL_PATTERN.test(body.model.trim())) {
      errors.push({ field: 'model', message: 'Mã mô hình không hợp lệ' });
    } else {
      model = body.model.trim();
    }
  }
  let perUser: number | null = null;
  if (body?.per_user_daily_requests !== undefined && body.per_user_daily_requests !== null && body.per_user_daily_requests !== '') {
    const value = body.per_user_daily_requests;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 10_000) {
      errors.push({ field: 'per_user_daily_requests', message: 'Số nguyên từ 0 đến 10.000, để trống là không giới hạn' });
    } else {
      perUser = value;
    }
  }
  const retention = body?.log_retention_months ?? 12;
  if (typeof retention !== 'number' || !Number.isInteger(retention) || retention < 1 || retention > 120) {
    errors.push({ field: 'log_retention_months', message: 'Số tháng giữ nhật ký từ 1 đến 120' });
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return {
    enabled: body?.enabled === true,
    key_mode: mode as AiKeyMode,
    provider: provider as string,
    model,
    per_user_daily_requests: perUser,
    log_retention_months: retention as number,
  };
}

@Injectable()
export class AiAssistantService {
  constructor(
    private readonly databases: Databases,
    private readonly schoolSettings: SchoolSettings,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly exams: ExamsService,
    private readonly resources: LearningResourcesService,
    private readonly clock: Clock,
    @Inject(AI_PROVIDERS) private readonly providers: AiProviderRegistry,
    @Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null = null,
  ) {}

  private get system(): SystemDatabase {
    return this.databases.system;
  }

  // ---------- Thiết lập của trường

  async settings(): Promise<AiSettingsView> {
    const row = await this.system.selectFrom('ai_settings').selectAll().where('id', '=', 1).executeTakeFirst();
    return row
      ? {
          enabled: row.enabled,
          key_mode: row.key_mode,
          provider: row.provider,
          model: row.model,
          per_user_daily_requests: row.per_user_daily_requests,
          log_retention_months: row.log_retention_months,
        }
      : DEFAULT_SETTINGS;
  }

  async saveSettings(input: AiSettingsInput, currentUser: CurrentUser, origin: ChangeOrigin) {
    if (input.key_mode === 'platform' && !this.tenancy) {
      throw ruleViolationError(AI_RULE_CODE, 'Cấu hình do nền tảng cấp khóa chỉ có ở nền tảng nhiều trường');
    }
    const before = await this.settings();
    const values = {
      enabled: input.enabled,
      key_mode: input.key_mode,
      provider: input.provider,
      model: input.model,
      per_user_daily_requests: input.per_user_daily_requests,
      log_retention_months: input.log_retention_months,
      updated_by_name: actorNameOf(currentUser),
    };
    await this.system
      .insertInto('ai_settings')
      .values({ id: 1, ...values })
      .onConflict((conflict) => conflict.column('id').doUpdateSet({ ...values, updated_at: new Date() }))
      .execute();
    const current = await this.currentSchoolYear.find();
    if (current) {
      await writeAuditLog(current.database, {
        origin,
        orgUnitId: null,
        entityName: 'ai_settings',
        entityId: '00000000-0000-4000-8000-000000000001',
        action: 'update',
        before,
        after: input,
      });
    }
    return this.status(currentUser, true);
  }

  // ---------- Khóa, trạng thái sẵn sàng

  // Trường hợp không dùng được (lý do bằng tiếng Việt) hoặc null khi sẵn sàng
  private async unavailableReason(settings: AiSettingsView): Promise<string | null> {
    if (!settings.enabled) {
      return 'Trường chưa bật trợ lý AI';
    }
    if (!this.providers.get(settings.provider) && settings.key_mode === 'school') {
      return 'Nhà cung cấp AI đã chọn chưa được hỗ trợ ở bản triển khai này';
    }
    if (settings.key_mode === 'school') {
      return (await this.schoolSettings.active('ai')) ? null : 'Trường chưa nhập hoặc chưa bật khóa AI';
    }
    return (await this.platformReadiness()).reason;
  }

  private async platformReadiness(): Promise<{
    reason: string | null;
    pricing: AiPricing | null;
    provider: string;
    model: string;
    endpoint: string | null;
    apiKey: string;
  }> {
    const blank = { pricing: null, provider: '', model: '', endpoint: null, apiKey: '' };
    const tenant = currentTenant();
    if (!this.tenancy || !tenant) {
      return { ...blank, reason: 'Cấu hình do nền tảng cấp khóa chỉ có ở nền tảng nhiều trường' };
    }
    if (!tenant.plan) {
      return { ...blank, reason: 'Trường chưa được gán gói dịch vụ nên chưa thu phí AI theo gói được' };
    }
    const platform = this.tenancy.platform;
    const [pricing, key, settings] = await Promise.all([
      readPlanAiPricingByCode(platform, tenant.plan.code),
      readPlatformAiKey(platform, this.tenancy.configuration.masterKey),
      readPlatformAiSettings(platform),
    ]);
    if (!aiPricingReady(pricing)) {
      return { ...blank, pricing, reason: 'Gói dịch vụ của trường chưa thiết lập đơn giá AI' };
    }
    if (!key?.enabled) {
      return { ...blank, pricing, reason: 'Nền tảng chưa bật khóa AI dùng chung' };
    }
    return {
      reason: null,
      pricing,
      provider: settings.provider,
      model: settings.model,
      endpoint: settings.endpoint,
      apiKey: key.apiKey,
    };
  }

  private async resolve(settings: AiSettingsView): Promise<Resolved> {
    if (!settings.enabled) {
      throw ruleViolationError(AI_RULE_CODE, 'Trường chưa bật trợ lý AI; quản trị trường bật ở màn hình Trợ lý AI');
    }
    if (settings.key_mode === 'school') {
      const stored = await this.schoolSettings.active('ai');
      if (!stored) {
        throw ruleViolationError(AI_RULE_CODE, 'Trường chưa nhập hoặc chưa bật khóa AI');
      }
      const provider = this.providers.get(settings.provider);
      if (!provider) {
        throw ruleViolationError(AI_RULE_CODE, 'Nhà cung cấp AI đã chọn chưa được hỗ trợ ở bản triển khai này');
      }
      return {
        mode: 'school',
        provider,
        credentials: {
          apiKey: stored.values.api_key ?? '',
          model: settings.model ?? DEFAULT_AI_MODEL,
          endpoint: stored.values.endpoint ?? null,
        },
      };
    }
    const platform = await this.platformReadiness();
    if (platform.reason) {
      throw ruleViolationError(AI_RULE_CODE, platform.reason);
    }
    const provider = this.providers.get(platform.provider);
    if (!provider) {
      throw ruleViolationError(AI_RULE_CODE, 'Nhà cung cấp AI của nền tảng chưa được hỗ trợ ở bản triển khai này');
    }
    return {
      mode: 'platform',
      provider,
      credentials: { apiKey: platform.apiKey, model: platform.model, endpoint: platform.endpoint },
    };
  }

  // ---------- Hạn mức, nhật ký

  private monthStart(): string {
    return `${vietnamDate(this.clock.now()).slice(0, 7)}-01T00:00:00${ZONE_OFFSET}`;
  }

  private dayStart(): string {
    return `${vietnamDate(this.clock.now())}T00:00:00${ZONE_OFFSET}`;
  }

  async monthUsage() {
    const row = await this.system
      .selectFrom('ai_requests')
      .select([
        sql<string>`count(*)`.as('requests'),
        sql<string>`coalesce(sum(input_tokens + output_tokens), 0)`.as('tokens'),
        sql<string>`coalesce(sum(input_tokens), 0)`.as('input_tokens'),
        sql<string>`coalesce(sum(output_tokens), 0)`.as('output_tokens'),
      ])
      .where('status', '=', 'success')
      .where('created_at', '>=', new Date(this.monthStart()))
      .executeTakeFirstOrThrow();
    return {
      requests: Number(row.requests),
      tokens: Number(row.tokens),
      input_tokens: Number(row.input_tokens),
      output_tokens: Number(row.output_tokens),
    };
  }

  private async assertQuota(settings: AiSettingsView, currentUser: CurrentUser): Promise<void> {
    const plan = currentTenant()?.plan;
    const month = await this.monthUsage();
    const limits: Array<[number | null | undefined, number, string]> = [
      [plan?.aiMaxRequests, month.requests, 'yêu cầu'],
      [plan?.aiMaxTokens, month.tokens, 'token'],
    ];
    for (const [limit, used, unit] of limits) {
      if (limit !== null && limit !== undefined && used >= limit) {
        throw new ApplicationError(
          'PLAN_LIMIT_EXCEEDED',
          `Gói dịch vụ cho phép tối đa ${limit.toLocaleString('vi-VN')} ${unit} AI mỗi tháng; trường đã dùng ${used.toLocaleString('vi-VN')}`,
          [{ field: unit === 'token' ? 'ai_max_tokens' : 'ai_max_requests', message: String(limit) }],
        );
      }
    }
    if (settings.per_user_daily_requests !== null) {
      const today = await this.system
        .selectFrom('ai_requests')
        .select(sql<string>`count(*)`.as('requests'))
        .where('user_id', '=', currentUser.id)
        .where('status', 'in', ['success', 'failed'])
        .where('created_at', '>=', new Date(this.dayStart()))
        .executeTakeFirstOrThrow();
      if (Number(today.requests) >= settings.per_user_daily_requests) {
        throw new ApplicationError(
          'PLAN_LIMIT_EXCEEDED',
          `Mỗi người được tối đa ${settings.per_user_daily_requests} yêu cầu AI mỗi ngày; bạn đã dùng hết hôm nay`,
          [{ field: 'per_user_daily_requests', message: String(settings.per_user_daily_requests) }],
        );
      }
    }
  }

  private async log(
    context: RequestContext,
    values: {
      status: AiRequestStatus;
      mode: AiKeyMode;
      provider: string;
      model: string;
      promptSha256: string;
      promptChars?: number;
      responseChars?: number;
      inputTokens?: number;
      outputTokens?: number;
      resultIds?: string[];
      error?: string | null;
      durationMs?: number;
    },
  ): Promise<string> {
    const row = await this.system
      .insertInto('ai_requests')
      .values({
        user_id: context.user.id,
        user_name: context.user.description.full_name,
        kind: context.kind,
        school_level: context.schoolLevel,
        grade_level_code: context.gradeLevelCode,
        subject_name: context.subjectName,
        topic: context.topic,
        status: values.status,
        key_mode: values.mode,
        provider: values.provider,
        model: values.model,
        prompt_sha256: values.promptSha256,
        prompt_chars: values.promptChars ?? 0,
        response_chars: values.responseChars ?? 0,
        input_tokens: values.inputTokens ?? 0,
        output_tokens: values.outputTokens ?? 0,
        result_count: values.resultIds?.length ?? 0,
        result_ids: JSON.stringify(values.resultIds ?? []),
        error: values.error ?? null,
        duration_ms: values.durationMs ?? 0,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return row.id;
  }

  private async finishLog(id: string, resultIds: string[], error: string | null) {
    await this.system
      .updateTable('ai_requests')
      .set({ result_ids: JSON.stringify(resultIds), result_count: resultIds.length, error })
      .where('id', '=', id)
      .execute();
  }

  // Chạy một yêu cầu qua nhà cung cấp: quét dữ liệu cá nhân → hạn mức → gọi → ghi nhật ký. Trả bản hoàn thành và mã nhật ký
  private async run(
    context: RequestContext,
    settings: AiSettingsView,
    resolved: Resolved,
    prompt: AiPrompt,
    freeText: string[],
    names: Set<string>,
  ) {
    const meta = {
      mode: resolved.mode,
      provider: resolved.provider.code,
      model: resolved.credentials.model,
      promptSha256: promptHash(prompt),
      promptChars: prompt.system.length + prompt.user.length,
    };
    const findings = [...new Set(freeText.flatMap((text) => scanPersonalData(text, names)))];
    if (findings.length > 0) {
      const message = personalDataMessage(findings);
      await this.log(context, { ...meta, status: 'rejected', error: `Có ${findings.join(', ')}` });
      throw ruleViolationError(AI_RULE_CODE, message);
    }
    try {
      await this.assertQuota(settings, context.user);
    } catch (error) {
      await this.log(context, {
        ...meta,
        status: 'blocked',
        error: error instanceof ApplicationError ? error.message : 'Vượt hạn mức',
      });
      throw error;
    }
    const started = Date.now();
    try {
      const completion = await resolved.provider.complete(prompt, resolved.credentials);
      const id = await this.log(context, {
        ...meta,
        model: completion.model,
        status: 'success',
        responseChars: completion.text.length,
        inputTokens: completion.inputTokens,
        outputTokens: completion.outputTokens,
        durationMs: Date.now() - started,
      });
      return { completion, logId: id };
    } catch (error) {
      const message = error instanceof AiProviderError ? error.message : 'Nhà cung cấp AI không trả được kết quả';
      await this.log(context, { ...meta, status: 'failed', error: message, durationMs: Date.now() - started });
      throw ruleViolationError(AI_RULE_CODE, message);
    }
  }

  // Tên đầy đủ của học sinh, phụ huynh, cán bộ để so với chữ người dùng nhập; chỉ so ở máy chủ, không gửi đi
  private async nameIndex(database: Kysely<SchoolYearDatabase>): Promise<Set<string>> {
    const [children, guardians, staff] = await Promise.all([
      database.selectFrom('children').select('full_name').execute(),
      database.selectFrom('guardians').select('full_name').execute(),
      database.selectFrom('staff').select('full_name').execute(),
    ]);
    return buildNameIndex([...children, ...guardians, ...staff].map((row) => row.full_name));
  }

  private async assertSubject(
    database: Kysely<SchoolYearDatabase>,
    where: { id?: string; code?: string },
    level: string,
    grade: string,
  ) {
    let query = database.selectFrom('subjects').select(['id', 'code', 'name', 'school_level']);
    query = where.id ? query.where('id', '=', where.id) : query.where('code', '=', where.code ?? '');
    const [subject, gradeRow] = await Promise.all([
      query.executeTakeFirst(),
      database.selectFrom('grade_levels').select(['code', 'school_level']).where('code', '=', grade).executeTakeFirst(),
    ]);
    const errors: FieldError[] = [];
    if (subject?.school_level !== level) {
      errors.push({ field: where.id ? 'subject_id' : 'subject_code', message: 'Môn không có hoặc không cùng cấp' });
    }
    if (gradeRow?.school_level !== level) {
      errors.push({ field: 'grade_level_code', message: 'Khối không có hoặc không cùng cấp' });
    }
    if (errors.length > 0 || !subject) {
      throw validationError(errors);
    }
    return subject;
  }

  // ---------- Soạn câu hỏi nháp

  async draftQuestions(currentUser: CurrentUser, body: RequestBody, origin: ChangeOrigin) {
    const request = parseQuestionDraftRequest(body);
    const settings = await this.settings();
    const resolved = await this.resolve(settings);
    const { database } = await this.currentSchoolYear.require();
    const subject = await this.assertSubject(database, { id: request.subject_id }, request.school_level, request.grade_level_code);
    let topicName: string | null = null;
    if (request.topic_id) {
      const topic = await database
        .selectFrom('question_topics')
        .select(['name', 'subject_id'])
        .where('id', '=', request.topic_id)
        .executeTakeFirst();
      if (topic?.subject_id !== request.subject_id) {
        throw validationError([{ field: 'topic_id', message: 'Chủ đề không thuộc môn đã chọn' }]);
      }
      topicName = topic.name;
    }
    const prompt = buildQuestionPrompt(request, subject.name, topicName);
    const context: RequestContext = {
      user: currentUser,
      kind: 'questions',
      schoolLevel: request.school_level,
      gradeLevelCode: request.grade_level_code,
      subjectName: subject.name,
      topic: topicName ?? request.topic_text,
    };
    const { completion, logId } = await this.run(
      context,
      settings,
      resolved,
      prompt,
      questionFreeText(request),
      await this.nameIndex(database),
    );
    const created: Array<Awaited<ReturnType<ExamsService['createQuestion']>>> = [];
    let skipped = 0;
    for (const raw of rawQuestionsOf(completion.text)) {
      try {
        const input = parseQuestion({
          ...raw,
          school_level: request.school_level,
          subject_id: request.subject_id,
          grade_level_code: request.grade_level_code,
          topic_id: request.topic_id,
        });
        created.push(await this.exams.createQuestion(currentUser, input, origin, { requestId: logId }));
      } catch (error) {
        if (error instanceof ApplicationError && error.code === 'ERR_VALIDATION') {
          skipped += 1;
          continue;
        }
        throw error;
      }
    }
    await this.finishLog(
      logId,
      created.map((question) => question.id),
      created.length === 0 ? 'Kết quả của nhà cung cấp không đúng định dạng câu hỏi' : null,
    );
    if (created.length === 0) {
      throw ruleViolationError(AI_RULE_CODE, 'Trợ lý AI trả kết quả không dùng được, hãy thử lại hoặc đổi mô tả');
    }
    return {
      request_id: logId,
      questions: created,
      skipped,
      tokens: { input: completion.inputTokens, output: completion.outputTokens },
      notice: 'Câu hỏi do AI soạn đang ở trạng thái nháp: kiểm tra, sửa rồi gửi thẩm định; chỉ dùng trong đề sau khi được duyệt',
    };
  }

  // ---------- Soạn kế hoạch bài dạy nháp

  async draftLessonPlan(currentUser: CurrentUser, body: RequestBody) {
    const request = parseLessonPlanRequest(body);
    const settings = await this.settings();
    const resolved = await this.resolve(settings);
    const { database } = await this.currentSchoolYear.require();
    const subject = await this.assertSubject(database, { code: request.subject_code }, request.school_level, request.grade_level_code);
    const prompt = buildLessonPlanPrompt(request, subject.name);
    const context: RequestContext = {
      user: currentUser,
      kind: 'lesson_plan',
      schoolLevel: request.school_level,
      gradeLevelCode: request.grade_level_code,
      subjectName: subject.name,
      topic: request.topic_text,
    };
    const { completion, logId } = await this.run(
      context,
      settings,
      resolved,
      prompt,
      lessonPlanFreeText(request),
      await this.nameIndex(database),
    );
    const plan = lessonPlanOf(completion.text);
    if (!plan) {
      await this.finishLog(logId, [], 'Kết quả của nhà cung cấp không đúng định dạng kế hoạch bài dạy');
      throw ruleViolationError(AI_RULE_CODE, 'Trợ lý AI trả kết quả không dùng được, hãy thử lại hoặc đổi mô tả');
    }
    const resource = await this.resources.createAiLessonPlanDraft(currentUser, {
      title: plan.title,
      markdown: lessonPlanMarkdown(plan, {
        subject: subject.name,
        grade: request.grade_level_code,
        minutes: request.duration_minutes,
      }),
      school_level: request.school_level,
      grade_level_code: request.grade_level_code,
      subject_code: subject.code,
      duration_minutes: request.duration_minutes,
      requestId: logId,
    });
    await this.finishLog(logId, [resource.id], null);
    return {
      request_id: logId,
      resource,
      tokens: { input: completion.inputTokens, output: completion.outputTokens },
      notice: 'Kế hoạch bài dạy do AI soạn là bản nháp riêng tư: kiểm tra, điền giấy phép rồi gửi duyệt trước khi chia sẻ',
    };
  }

  // ---------- Kiểm tra kết nối, trạng thái, nhật ký

  async check(currentUser: CurrentUser) {
    const settings = await this.settings();
    const resolved = await this.resolve({ ...settings, enabled: true });
    const context: RequestContext = {
      user: currentUser,
      kind: 'check',
      schoolLevel: null,
      gradeLevelCode: null,
      subjectName: null,
      topic: null,
    };
    const sha = promptHash({ kind: 'check', system: 'check', user: 'check', maxTokens: 8 });
    try {
      const result = await resolved.provider.check(resolved.credentials);
      await this.log(context, {
        status: 'success',
        mode: resolved.mode,
        provider: resolved.provider.code,
        model: resolved.credentials.model,
        promptSha256: sha,
      });
      return { ...result, key_mode: resolved.mode, provider: resolved.provider.code, model: resolved.credentials.model };
    } catch (error) {
      const message = error instanceof AiProviderError ? error.message : 'Không kiểm tra được kết nối AI';
      await this.log(context, {
        status: 'failed',
        mode: resolved.mode,
        provider: resolved.provider.code,
        model: resolved.credentials.model,
        promptSha256: sha,
        error: message,
      });
      throw ruleViolationError(AI_RULE_CODE, message);
    }
  }

  // Cho nút "Soạn nháp bằng AI" (chỉ cần biết sẵn sàng hay không) và màn hình quản trị (đủ chi tiết khi `admin`)
  async status(currentUser: CurrentUser, admin: boolean) {
    const settings = await this.settings();
    const reason = await this.unavailableReason(settings);
    const base = { enabled: settings.enabled, ready: reason === null, reason };
    if (!admin) {
      return base;
    }
    const tenant = currentTenant();
    const plan = tenant?.plan ?? null;
    const [usage, key, platform] = await Promise.all([
      this.monthUsage(),
      this.schoolSettings.view('ai'),
      this.tenancy && tenant ? this.platformReadiness() : Promise.resolve(null),
    ]);
    const estimate = await this.estimate(settings, platform?.pricing ?? null);
    return {
      ...base,
      settings,
      providers: this.providers.codes(),
      default_model: DEFAULT_AI_MODEL,
      key,
      multi_tenant: isMultiTenantMode(),
      platform: platform
        ? {
            available: platform.reason === null,
            reason: platform.reason,
            provider: platform.provider || null,
            model: platform.model || null,
            free_tokens: platform.pricing?.freeTokens ?? null,
          }
        : null,
      usage,
      limits: {
        max_requests: plan?.aiMaxRequests ?? null,
        max_tokens: plan?.aiMaxTokens ?? null,
        per_user_daily_requests: settings.per_user_daily_requests,
      },
      estimate,
      requested_by: currentUser.description.full_name,
    };
  }

  // Tạm tính phí AI của kỳ thu hiện tại ở cấu hình `platform` từ nhật ký của chính trường (trước khi chốt kỳ)
  private async estimate(settings: AiSettingsView, pricing: AiPricing | null) {
    const tenant = currentTenant();
    if (!this.tenancy || !tenant || !aiPricingReady(pricing)) {
      return null;
    }
    const today = vietnamDate(this.clock.now());
    const plan = await loadBillingPlan(this.tenancy.platform, tenant.schoolId, today);
    const range = periodContaining(today, plan?.rule.period ?? 'monthly');
    const rows = await this.system
      .selectFrom('ai_requests')
      .select([
        'model',
        sql<string>`count(*)`.as('requests'),
        sql<string>`sum(input_tokens)`.as('input_tokens'),
        sql<string>`sum(output_tokens)`.as('output_tokens'),
      ])
      .where('status', '=', 'success')
      .where('key_mode', '=', 'platform')
      .where('created_at', '>=', new Date(`${range.start}T00:00:00${ZONE_OFFSET}`))
      .where('created_at', '<', new Date(Date.parse(`${range.end}T00:00:00${ZONE_OFFSET}`) + 86_400_000))
      .groupBy('model')
      .execute();
    const usage = rows.map((row) => ({
      model: row.model,
      requests: Number(row.requests),
      inputTokens: Number(row.input_tokens),
      outputTokens: Number(row.output_tokens),
    }));
    const charges = computeAiCharges(pricing, usage);
    return {
      applies: settings.key_mode === 'platform',
      period_start: range.start,
      period_end: range.end,
      total_tokens: charges.totalTokens,
      free_tokens: pricing.freeTokens,
      amount: charges.lines.reduce((sum, line) => sum + line.amount, 0),
      lines: charges.lines,
    };
  }

  async requests(filter: { limit: number; status?: string | undefined }) {
    let query = this.system.selectFrom('ai_requests').selectAll().orderBy('created_at', 'desc').limit(filter.limit);
    if (filter.status) {
      query = query.where('status', '=', filter.status as AiRequestStatus);
    }
    return query.execute();
  }

  async requestById(id: string) {
    const row = await this.system.selectFrom('ai_requests').selectAll().where('id', '=', id).executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy yêu cầu AI', 'ai_request');
    }
    return row;
  }

  // ---------- Việc nền theo trường: tổng hợp token lên nền tảng để tính phí; xóa nhật ký quá hạn giữ

  async syncUsage(): Promise<number> {
    const tenant = currentTenant();
    if (!this.tenancy || !tenant) {
      return 0;
    }
    const rows = await sql<{
      usage_date: string;
      model: string;
      key_mode: AiKeyMode;
      requests: string;
      input_tokens: string;
      output_tokens: string;
    }>`select to_char(created_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') as usage_date, model, key_mode,
        count(*) as requests, sum(input_tokens) as input_tokens, sum(output_tokens) as output_tokens
      from ai_requests
      where status = 'success'
      group by 1, 2, 3`.execute(this.system);
    await recordAiTokenUsage(
      this.tenancy.platform,
      tenant.schoolId,
      rows.rows.map((row) => ({
        usageDate: row.usage_date,
        model: row.model,
        config: row.key_mode,
        requests: Number(row.requests),
        inputTokens: Number(row.input_tokens),
        outputTokens: Number(row.output_tokens),
      })),
    );
    return rows.rows.length;
  }

  // Xóa theo ngày trọn vẹn (mốc là đầu ngày giờ Việt Nam) để lượt tổng hợp sau không ghi đè một ngày đã bị xóa một phần
  async purgeExpired(): Promise<number> {
    const settings = await this.settings();
    const result = await sql`delete from ai_requests
      where created_at < (date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh') - make_interval(months => ${settings.log_retention_months}))
        at time zone 'Asia/Ho_Chi_Minh'`.execute(this.system);
    return Number(result.numAffectedRows ?? 0);
  }
}

export const AI_PERMISSIONS = {
  questions: PERMISSION_CODES.questionAuthor,
  lessonPlans: PERMISSION_CODES.learningResourceUse,
  manage: PERMISSION_CODES.integrationManage,
};
