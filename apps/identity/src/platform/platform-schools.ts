import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Optional,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {
  addConsent,
  addHosting,
  cancelDeletion,
  changeDataClass,
  DEFAULT_LIFECYCLE_SETTINGS,
  findInvitation,
  lifecycleEnvironmentOf,
  LifecycleError,
  loadCurrentPlan,
  markInvitationUsed,
  reissueInvitation,
  requestCustomDomain,
  requestDeletion,
  resumeSchool,
  rollbackProvisioningJob,
  runProvisioningJob,
  SCHOOL_LIFECYCLE_RULE_CODE,
  startProvisioning,
  suspendSchool,
  verifyCustomDomain,
  vietnamDate,
  writeAudit,
  type Actor,
  type ConsentInput,
  type HostingInput,
  type LifecycleEnvironment,
  type PlatformDatabase,
  type PlatformOperatorRole,
  type SchoolDataClassValue,
  type SchoolSetupInput,
  type TenancyRuntime,
} from '@school-management/database';
import {
  ApplicationError,
  Clock,
  currentTenant,
  readBearerToken,
  ruleViolationError,
  unauthenticatedError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { isPlanModuleKey, PAID_PLAN_MODULES, planModuleLabel } from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely } from 'kysely';
import { checkPasswordPolicy, hashPassword } from '../authentication/password.js';
import { recordPasswordHistory } from '../authentication/password-history.js';
import { LoginRateLimiter } from '../authentication/login-rate-limiter.js';
import { TokenService } from '../authentication/token.service.js';
import { IDENTITY_CONFIGURATION, TENANCY_RUNTIME, type IdentityConfiguration } from '../common/configuration.js';
import { Infrastructure } from '../common/infrastructure.js';
import { PlatformOperatorsService } from './platform-operators.js';

// Quản lý trường ở cổng vận hành nền tảng (DT-SaaS phần S2, YCTD-193; tài liệu 32 mục 14.5): danh sách, bước setup khởi tạo,
// tạm dừng, mở lại, yêu cầu xóa, hồ sơ đồng ý, vùng máy chủ, tên miền riêng. Chỉ phục vụ ở tên miền của cổng nền tảng và cần mã
// phiên vận hành. Xóa vĩnh viễn chạy bằng lệnh theo lịch sau thời gian chờ, không có nút ở cổng
function notFound(): ApplicationError {
  return new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy');
}

function toApplicationError(error: unknown): unknown {
  if (!(error instanceof LifecycleError)) {
    return error;
  }
  if (error.code === 'validation') {
    return validationError(error.problems);
  }
  if (error.code === 'not_found') {
    return notFound();
  }
  return ruleViolationError(SCHOOL_LIFECYCLE_RULE_CODE, error.message, error.problems);
}

export async function mapped<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw toApplicationError(error);
  }
}

function reasonOf(body: Record<string, unknown> | undefined): string | null {
  const value = body?.reason;
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string' || value.trim().length > 500) {
    throw validationError([{ field: 'reason', message: 'Lý do tối đa 500 ký tự' }]);
  }
  return value.trim();
}

@Injectable()
export class PlatformSchoolsService {
  constructor(
    @Inject(IDENTITY_CONFIGURATION) private readonly configuration: IdentityConfiguration,
    @Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null,
    private readonly operators: PlatformOperatorsService,
    private readonly tokenService: TokenService,
  ) {}

  private lifecycleSettings() {
    return this.configuration.platformLifecycle ?? DEFAULT_LIFECYCLE_SETTINGS;
  }

  private runtime(): TenancyRuntime {
    if (!this.tenancy) {
      throw notFound();
    }
    return this.tenancy;
  }

  environment(): LifecycleEnvironment {
    try {
      return lifecycleEnvironmentOf(this.runtime(), this.lifecycleSettings());
    } catch (error) {
      throw ruleViolationError(SCHOOL_LIFECYCLE_RULE_CODE, error instanceof Error ? error.message : String(error));
    }
  }

  private get platform(): Kysely<PlatformDatabase> {
    return this.runtime().platform;
  }

  // Cổng nền tảng và mã phiên vận hành còn hiệu lực; roles (YCTD-311) giới hạn thao tác theo vai trò nhân viên vận hành, trống là
  // mọi vai trò
  async actor(
    request: Request,
    roles?: readonly PlatformOperatorRole[],
  ): Promise<Actor & { role: PlatformOperatorRole }> {
    this.operators.assertConsoleHost(request);
    const operatorId = await this.tokenService.verifyOperatorToken(readBearerToken(request.header('authorization')));
    const row = await this.platform
      .selectFrom('platform_operators')
      .select(['id', 'full_name', 'status', 'role'])
      .where('id', '=', operatorId)
      .executeTakeFirst();
    if (!row || row.status !== 'active') {
      throw unauthenticatedError();
    }
    if (roles && !roles.includes(row.role)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Vai trò vận hành của bạn không được làm thao tác này');
    }
    return { type: 'operator', id: row.id, name: row.full_name, role: row.role };
  }

  // Trạng thái trường đổi thì bộ phân giải của tiến trình này đọc lại ngay; tiến trình khác đọc lại sau TENANT_CACHE_SECONDS
  refresh(): void {
    this.runtime().registry.invalidate();
  }

  settings() {
    const environment = this.environment();
    return {
      system_domain: environment.systemDomain,
      ingress_host: environment.ingressHost ?? null,
      domain_provider: environment.domainProvider?.kind ?? 'dns-check',
      deletion_grace_days: this.lifecycleSettings().deletionGraceDays,
      data_policy: environment.dataPolicy ?? 'any',
    };
  }

  async list() {
    const schools = await this.platform
      .selectFrom('schools')
      .select(['id', 'code', 'name', 'status', 'data_class', 'legacy', 'created_at', 'delete_after'])
      .orderBy('code')
      .execute();
    const domains = await this.platform.selectFrom('school_domains').select(['school_id', 'host', 'status']).execute();
    return {
      items: schools.map((school) => ({
        ...school,
        domains: domains
          .filter((domain) => domain.school_id === school.id)
          .map(({ host, status }) => ({ host, status })),
      })),
    };
  }

  async detail(code: string) {
    const school = await this.platform.selectFrom('schools').selectAll().where('code', '=', code).executeTakeFirst();
    if (!school) {
      throw notFound();
    }
    const [domains, consents, hosting, jobs, events, invitations, backups] = await Promise.all([
      this.platform
        .selectFrom('school_domains')
        .select([
          'host',
          'kind',
          'status',
          'provider',
          'verification_token',
          'cname_target',
          'last_checked_at',
          'check_error',
        ])
        .where('school_id', '=', school.id)
        .orderBy('host')
        .execute(),
      this.platform
        .selectFrom('school_consents')
        .selectAll()
        .where('school_id', '=', school.id)
        .orderBy('created_at')
        .execute(),
      this.platform
        .selectFrom('school_hosting')
        .selectAll()
        .where('school_id', '=', school.id)
        .orderBy('started_on')
        .execute(),
      this.platform
        .selectFrom('provisioning_jobs')
        .select(['id', 'kind', 'status', 'current_step', 'completed_steps', 'error', 'created_at', 'finished_at'])
        .where('school_id', '=', school.id)
        .orderBy('created_at', 'desc')
        .execute(),
      this.platform
        .selectFrom('school_lifecycle_events')
        .selectAll()
        .where('school_id', '=', school.id)
        .orderBy('at', 'desc')
        .limit(50)
        .execute(),
      this.platform
        .selectFrom('school_admin_invitations')
        .select(['login', 'full_name', 'expires_at', 'used_at', 'created_at'])
        .where('school_id', '=', school.id)
        .orderBy('created_at', 'desc')
        .execute(),
      // Sao lưu, khôi phục, diễn tập, chuyển cụm gần nhất (DT-SaaS phần S7b); khóa giải mã không nằm ở đây
      this.platform
        .selectFrom('backup_runs')
        .select([
          'id',
          'kind',
          'status',
          'file_name',
          'file_bytes',
          'tables',
          'rows',
          'details',
          'error',
          'started_at',
          'finished_at',
        ])
        .where('school_code', '=', school.code)
        .orderBy('started_at', 'desc')
        .limit(20)
        .execute(),
    ]);
    return {
      id: school.id,
      code: school.code,
      name: school.name,
      address: school.address,
      status: school.status,
      data_class: school.data_class,
      legacy: school.legacy,
      school_levels: school.school_levels,
      first_academic_year: school.first_academic_year,
      suspended_at: school.suspended_at,
      deletion_requested_at: school.deletion_requested_at,
      delete_after: school.delete_after,
      deleted_at: school.deleted_at,
      deletion_record: school.deletion_record,
      created_at: school.created_at,
      // Mã Bộ của đơn vị trong danh mục toàn quốc (DT-24)
      moet_code: school.moet_code,
      // Gói hiện hành và tính năng trả phí bật riêng cho trường (YCTD-314)
      plan: await this.planSummary(school.id),
      addon_modules: school.addon_modules,
      paid_modules: PAID_PLAN_MODULES.map((key) => ({ key, label: planModuleLabel(key) })),
      domains,
      consents,
      hosting,
      jobs,
      events,
      invitations,
      backups,
    };
  }

  // Bước setup: ghi trường rồi chạy ngay các bước khởi tạo (vài giây đến vài chục giây). Lỗi thì trả việc ở trạng thái `failed`
  // để người vận hành chạy tiếp hoặc hoàn tác
  async provision(input: SchoolSetupInput, actor: Actor) {
    const environment = this.environment();
    const started = await mapped(() => startProvisioning(environment, input, actor));
    const result = await runProvisioningJob(environment, started.jobId);
    this.refresh();
    return this.provisionResponse(started.schoolId, result);
  }

  async resumeJob(jobId: string) {
    const environment = this.environment();
    const job = await this.platform
      .selectFrom('provisioning_jobs')
      .select('school_id')
      .where('id', '=', jobId)
      .executeTakeFirst();
    const result = await mapped(() => runProvisioningJob(environment, jobId));
    this.refresh();
    return this.provisionResponse(job?.school_id ?? null, result);
  }

  async rollbackJob(jobId: string, actor: Actor) {
    await mapped(() => rollbackProvisioningJob(this.environment(), jobId, actor));
    this.refresh();
    return { status: 'rolled_back' };
  }

  private async provisionResponse(
    schoolId: string | null,
    result: { jobId: string; status: string; error: string | null; activationToken: string | null },
  ) {
    const school = schoolId
      ? await this.platform
          .selectFrom('schools')
          .select(['code', 'status'])
          .where('id', '=', schoolId)
          .executeTakeFirst()
      : undefined;
    const domain = schoolId
      ? await this.platform
          .selectFrom('school_domains')
          .select('host')
          .where('school_id', '=', schoolId)
          .where('status', '=', 'active')
          .orderBy('created_at')
          .executeTakeFirst()
      : undefined;
    return {
      job_id: result.jobId,
      status: result.status,
      error: result.error,
      school: school ?? null,
      // Đường kích hoạt chỉ trả một lần; chỉ lưu mã băm
      activation: result.activationToken
        ? { path: `/activate?token=${result.activationToken}`, host: domain?.host ?? null }
        : null,
    };
  }

  async changeStatus(code: string, action: string, body: Record<string, unknown> | undefined, actor: Actor) {
    const environment = this.environment();
    const reason = reasonOf(body);
    const school = await mapped(() => {
      switch (action) {
        case 'suspend':
          return suspendSchool(environment, code, actor, reason);
        case 'resume':
          return resumeSchool(environment, code, actor, reason);
        case 'request-deletion':
          return requestDeletion(environment, code, actor, reason, this.lifecycleSettings().deletionGraceDays);
        case 'cancel-deletion':
          return cancelDeletion(environment, code, actor, reason);
        default:
          throw notFound();
      }
    });
    this.refresh();
    return { code: school.code, status: school.status };
  }

  async reissue(code: string, actor: Actor) {
    const token = await mapped(() => reissueInvitation(this.environment(), code, actor));
    return { activation: { path: `/activate?token=${token}` } };
  }

  async addConsent(code: string, input: ConsentInput, actor: Actor) {
    await mapped(() => addConsent(this.environment(), code, input, actor));
    return this.detail(code);
  }

  async addHosting(code: string, input: HostingInput, actor: Actor) {
    await mapped(() => addHosting(this.environment(), code, input, actor));
    return this.detail(code);
  }

  async changeDataClass(code: string, dataClass: SchoolDataClassValue, actor: Actor) {
    await mapped(() => changeDataClass(this.environment(), code, dataClass, actor));
    this.refresh();
    return this.detail(code);
  }

  async addDomain(code: string, host: string, actor: Actor) {
    const environment = this.environment();
    const school = await this.platform.selectFrom('schools').select('id').where('code', '=', code).executeTakeFirst();
    if (!school) {
      throw notFound();
    }
    const row = await mapped(() => requestCustomDomain(environment, school.id, host));
    await writeAudit(this.platform, {
      actorType: 'operator',
      ...(actor.id ? { actorId: actor.id } : {}),
      action: 'school.domain-requested',
      schoolId: school.id,
      details: { host: row.host },
    });
    return row;
  }

  private async planSummary(schoolId: string) {
    const plan = await loadCurrentPlan(this.platform, schoolId, vietnamDate(new Date()));
    return plan ? { code: plan.code, name: plan.name, modules: plan.modules } : null;
  }

  // Bật, tắt tính năng trả phí riêng cho một trường (YCTD-314): cộng vào phân hệ của gói hiện hành; trường chưa gán gói (không giới
  // hạn) không bị ảnh hưởng. Ghi nhật ký nền tảng; bộ phân giải trường đọc lại ngay
  async setAddonModules(code: string, body: Body, actor: Actor) {
    const modules = body?.modules;
    if (!Array.isArray(modules) || modules.some((module) => !isPlanModuleKey(module))) {
      throw validationError([{ field: 'modules', message: 'Danh sách mã phân hệ, tính năng không hợp lệ' }]);
    }
    const school = await this.platform
      .selectFrom('schools')
      .select(['id', 'addon_modules'])
      .where('code', '=', code)
      .executeTakeFirst();
    if (!school) {
      throw notFound();
    }
    const after = [...new Set(modules as string[])].sort();
    await this.platform
      .updateTable('schools')
      .set({ addon_modules: JSON.stringify(after), updated_at: new Date() })
      .where('id', '=', school.id)
      .execute();
    await writeAudit(this.platform, {
      actorType: 'operator',
      ...(actor.id ? { actorId: actor.id } : {}),
      action: 'school.addon-modules-changed',
      schoolId: school.id,
      details: { before: school.addon_modules, after },
    });
    this.refresh();
    return { addon_modules: after, plan: await this.planSummary(school.id) };
  }

  async verifyDomain(code: string, host: string, actor: Actor) {
    const school = await this.platform.selectFrom('schools').select('id').where('code', '=', code).executeTakeFirst();
    const domain = school
      ? await this.platform
          .selectFrom('school_domains')
          .select('host')
          .where('school_id', '=', school.id)
          .where('host', '=', host)
          .executeTakeFirst()
      : undefined;
    if (!domain) {
      throw notFound();
    }
    const result = await mapped(() => verifyCustomDomain(this.environment(), host, actor));
    this.refresh();
    return result;
  }
}

type Body = Record<string, unknown> | undefined;

@Controller('auth/platform/schools')
export class PlatformSchoolsController {
  constructor(private readonly schools: PlatformSchoolsService) {}

  @Get()
  async list(@Req() request: Request) {
    await this.schools.actor(request);
    return this.schools.list();
  }

  @Get('settings')
  async settings(@Req() request: Request) {
    await this.schools.actor(request);
    return this.schools.settings();
  }

  @Get(':code')
  async detail(@Param('code') code: string, @Req() request: Request) {
    await this.schools.actor(request);
    return this.schools.detail(code);
  }

  @Post()
  @HttpCode(200)
  async provision(@Body() body: Body, @Req() request: Request) {
    const actor = await this.schools.actor(request);
    return this.schools.provision((body ?? {}) as unknown as SchoolSetupInput, actor);
  }

  @Put(':code/addon-modules')
  async setAddonModules(@Param('code') code: string, @Body() body: Body, @Req() request: Request) {
    const actor = await this.schools.actor(request, ['quan_tri', 'ke_toan']);
    return this.schools.setAddonModules(code, body, actor);
  }

  @Post('jobs/:id/resume')
  @HttpCode(200)
  async resumeJob(@Param('id') id: string, @Req() request: Request) {
    await this.schools.actor(request);
    return this.schools.resumeJob(id);
  }

  @Post('jobs/:id/rollback')
  @HttpCode(200)
  async rollbackJob(@Param('id') id: string, @Req() request: Request) {
    return this.schools.rollbackJob(id, await this.schools.actor(request));
  }

  @Post(':code/suspend')
  @HttpCode(200)
  async suspend(@Param('code') code: string, @Body() body: Body, @Req() request: Request) {
    return this.schools.changeStatus(code, 'suspend', body, await this.schools.actor(request));
  }

  @Post(':code/resume')
  @HttpCode(200)
  async resume(@Param('code') code: string, @Body() body: Body, @Req() request: Request) {
    return this.schools.changeStatus(code, 'resume', body, await this.schools.actor(request));
  }

  @Post(':code/request-deletion')
  @HttpCode(200)
  async requestDeletion(@Param('code') code: string, @Body() body: Body, @Req() request: Request) {
    return this.schools.changeStatus(code, 'request-deletion', body, await this.schools.actor(request));
  }

  @Post(':code/cancel-deletion')
  @HttpCode(200)
  async cancelDeletion(@Param('code') code: string, @Body() body: Body, @Req() request: Request) {
    return this.schools.changeStatus(code, 'cancel-deletion', body, await this.schools.actor(request));
  }

  @Post(':code/invitation')
  @HttpCode(200)
  async reissue(@Param('code') code: string, @Req() request: Request) {
    return this.schools.reissue(code, await this.schools.actor(request));
  }

  @Post(':code/consents')
  @HttpCode(200)
  async addConsent(@Param('code') code: string, @Body() body: Body, @Req() request: Request) {
    return this.schools.addConsent(code, (body ?? {}) as unknown as ConsentInput, await this.schools.actor(request));
  }

  @Post(':code/hosting')
  @HttpCode(200)
  async addHosting(@Param('code') code: string, @Body() body: Body, @Req() request: Request) {
    return this.schools.addHosting(code, (body ?? {}) as unknown as HostingInput, await this.schools.actor(request));
  }

  @Post(':code/data-class')
  @HttpCode(200)
  async changeDataClass(@Param('code') code: string, @Body() body: Body, @Req() request: Request) {
    const value = body?.data_class;
    if (value !== 'synthetic' && value !== 'consented' && value !== 'production') {
      throw validationError([{ field: 'data_class', message: 'Loại dữ liệu là synthetic, consented hoặc production' }]);
    }
    return this.schools.changeDataClass(code, value, await this.schools.actor(request));
  }

  @Post(':code/domains')
  @HttpCode(200)
  async addDomain(@Param('code') code: string, @Body() body: Body, @Req() request: Request) {
    const host = typeof body?.host === 'string' ? body.host : '';
    return this.schools.addDomain(code, host, await this.schools.actor(request));
  }

  @Post(':code/domains/:host/verify')
  @HttpCode(200)
  async verifyDomain(@Param('code') code: string, @Param('host') host: string, @Req() request: Request) {
    return this.schools.verifyDomain(code, host, await this.schools.actor(request));
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Kích hoạt quản trị viên đầu tiên ở tên miền của trường
// ---------------------------------------------------------------------------------------------------------------------

const INVALID_INVITATION = 'Đường kích hoạt không đúng, đã dùng hoặc đã hết hạn; liên hệ nhà vận hành để cấp lại';

@Injectable()
export class SchoolActivationService {
  constructor(
    @Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null,
    private readonly infrastructure: Infrastructure,
    private readonly clock: Clock,
  ) {}

  private async invitation(token: string) {
    const tenant = currentTenant();
    if (!this.tenancy || !tenant || !token) {
      throw notFound();
    }
    const row = await findInvitation(this.tenancy.platform, tenant.schoolId, token, this.clock.now());
    if (!row) {
      throw unauthenticatedError(INVALID_INVITATION);
    }
    return row;
  }

  async preview(token: string) {
    const row = await this.invitation(token);
    return { login: row.login, full_name: row.full_name, expires_at: row.expires_at };
  }

  // Đặt mật khẩu theo chính sách (BM-03), đánh dấu lời mời đã dùng; lời mời chỉ dùng được một lần kể cả hai yêu cầu cùng lúc
  async activate(token: string, newPassword: string) {
    const policyErrors = checkPasswordPolicy('new_password', newPassword);
    if (policyErrors.length > 0) {
      throw validationError(policyErrors);
    }
    const row = await this.invitation(token);
    const platform = (this.tenancy as TenancyRuntime).platform;
    const now = this.clock.now();
    if (!(await markInvitationUsed(platform, row.id, now))) {
      throw unauthenticatedError(INVALID_INVITATION);
    }
    const hash = await hashPassword(newPassword);
    await this.infrastructure.database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('users')
        .set({ password_hash: hash, password_changed_at: now, must_change_password: false, updated_at: now })
        .where('id', '=', row.user_id)
        .execute();
      await recordPasswordHistory(transaction, row.user_id, hash, now);
    });
    await writeAudit(platform, {
      actorType: 'system',
      action: 'school.admin-activated',
      schoolId: row.school_id,
      details: { login: row.login },
    });
    return { login: row.login, message: 'Đã kích hoạt tài khoản, vui lòng đăng nhập bằng mật khẩu vừa đặt' };
  }
}

@Controller('auth/activate')
export class SchoolActivationController {
  constructor(
    private readonly activation: SchoolActivationService,
    private readonly loginRateLimiter: LoginRateLimiter,
  ) {}

  @Get()
  preview(@Query('token') token: string | undefined) {
    return this.activation.preview(token ?? '');
  }

  @Post()
  @HttpCode(200)
  async activate(@Body() body: Body, @Req() request: Request) {
    await this.loginRateLimiter.check(request.ip ?? 'unknown');
    const errors: FieldError[] = [];
    const token = typeof body?.token === 'string' ? body.token : '';
    const password = typeof body?.new_password === 'string' ? body.new_password : '';
    if (!token) {
      errors.push({ field: 'token', message: 'Bắt buộc nhập' });
    }
    if (!password) {
      errors.push({ field: 'new_password', message: 'Bắt buộc nhập' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.activation.activate(token, password);
  }
}
