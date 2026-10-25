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
  Req,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import {
  appliedMigration,
  maintenanceNoticesFor,
  recordSchoolMetrics,
  recordSupportAction,
  schemaSizeMb,
  SUPPORT_USERNAME,
  writeAudit,
  type IdentityDatabase,
  type PlatformDatabase,
  type SupportScope,
  type TenancyRuntime,
} from '@school-management/database';
import { ApplicationError, Clock, currentTenant, isMultiTenantMode, validationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request, Response } from 'express';
import { throwError, type Observable } from 'rxjs';
import type { Kysely } from 'kysely';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { actorNameOf, originOf, writeAuditLog } from '../common/audit-log.js';
import { API_CONFIGURATION, TENANCY_RUNTIME, type ApiConfiguration } from '../common/configuration.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { JobScheduler } from '../common/job-scheduler.js';
import { countActiveStudents, usedStorageMb } from '../common/plan-limits.js';

// Bảng điều khiển nền tảng ở máy chủ API (DT-SaaS phần S4, YCTD-197; tài liệu 32 mục 14.5 "S4"). Claude tự chọn theo ủy quyền của
// Eric ngày 2026-10-11:
// - việc định kỳ `school-metrics` (mặc định mỗi giờ, SCHOOL_METRICS_INTERVAL_SECONDS) chạy trong ngữ cảnh từng trường: đếm tài khoản
//   (không tính tài khoản hỗ trợ nền tảng), học sinh đang học, dung lượng tệp, dung lượng cơ sở dữ liệu, lần đăng nhập gần nhất, tên
//   tệp thay đổi cấu trúc mới nhất đã chạy ở từng cơ sở dữ liệu; ghi vào school_metrics của cơ sở dữ liệu nền tảng. Không đọc nội dung
//   dữ liệu của trường;
// - thông báo bảo trì và phiên hỗ trợ đang mở cho người dùng của trường (GET /platform-notices);
// - quản trị của trường bật, rút cho phép hỗ trợ (P01.account.manage): có hạn 1 đến 168 giờ (mặc định 24), phạm vi chỉ đọc hoặc
//   toàn quyền, ghi lý do; rút thì phiên hỗ trợ đang mở kết thúc và phiên đăng nhập của tài khoản hỗ trợ bị thu hồi ngay.
export const SCHOOL_METRICS_JOB = 'school-metrics';
export const SUPPORT_RULE_CODE = 'YCTD-197';
const MAX_GRANT_HOURS = 168;

function notFound(): ApplicationError {
  return new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy');
}

@Injectable()
export class SchoolMetricsService implements OnApplicationBootstrap {
  constructor(
    @Inject(API_CONFIGURATION) private readonly configuration: ApiConfiguration,
    private readonly databases: Databases,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly clock: Clock,
    @Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null = null,
    @Optional() @Inject(JobScheduler) private readonly scheduler: JobScheduler | null = null,
  ) {}

  onApplicationBootstrap() {
    if (isMultiTenantMode()) {
      this.scheduler?.register({
        name: SCHOOL_METRICS_JOB,
        intervalSeconds: this.configuration.schoolMetricsIntervalSeconds ?? 3600,
        run: () => this.capture(),
      });
    }
  }

  // Thu số liệu của trường đang chạy (trong ngữ cảnh trường của bộ lập lịch)
  async capture(): Promise<void> {
    const tenant = currentTenant();
    if (!this.tenancy || !tenant) {
      return;
    }
    const identity = this.tenancy.connections.database<IdentityDatabase>(tenant, 'identity', 'identity');
    const system = this.databases.system;
    const support = await identity
      .selectFrom('users')
      .select('id')
      .where('username', '=', SUPPORT_USERNAME)
      .executeTakeFirst();
    const users = await identity
      .selectFrom('users')
      .select((eb) => [
        eb.fn.countAll<string>().as('total'),
        eb.fn.count<string>(eb.case().when('status', '=', 'active').then(1).end()).as('active'),
      ])
      .$if(Boolean(support), (query) => query.where('id', '!=', support?.id ?? ''))
      .executeTakeFirstOrThrow();
    const lastLogin = await identity
      .selectFrom('sessions')
      .select((eb) => eb.fn.max('issued_at').as('at'))
      .$if(Boolean(support), (query) => query.where('user_id', '!=', support?.id ?? ''))
      .executeTakeFirst();
    const current = await this.currentSchoolYear.find();
    const years = await system.selectFrom('academic_year_databases').select('database_name').execute();
    const schemaVersions: Record<string, string | null> = {
      identity: await appliedMigration(identity),
      system: await appliedMigration(system),
    };
    let databaseMb = (await schemaSizeMb(identity)) + (await schemaSizeMb(system));
    for (const year of years) {
      try {
        const database = this.databases.schoolYear<unknown>(year.database_name);
        schemaVersions[`school-year:${year.database_name}`] = await appliedMigration(database);
        databaseMb += await schemaSizeMb(database);
      } catch {
        schemaVersions[`school-year:${year.database_name}`] = null;
      }
    }
    await recordSchoolMetrics(
      this.tenancy.platform,
      tenant.schoolId,
      {
        usersTotal: Number(users.total),
        usersActive: Number(users.active),
        activeStudents: current ? await countActiveStudents(current.database) : null,
        storageMb: await usedStorageMb(system, current?.database ?? null),
        databaseMb: Math.round(databaseMb * 100) / 100,
        lastLoginAt: lastLogin?.at ? new Date(lastLogin.at as unknown as string) : null,
        schemaVersions,
      },
      this.clock.now(),
    );
  }
}

@Injectable()
export class SupportAccessService {
  constructor(
    private readonly databases: Databases,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly clock: Clock,
    @Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null = null,
  ) {}

  private platform(): Kysely<PlatformDatabase> | null {
    return this.tenancy && currentTenant() ? this.tenancy.platform : null;
  }

  async notices(currentUser: CurrentUser) {
    const platform = this.platform();
    const tenant = currentTenant();
    if (!platform || !tenant) {
      return { maintenance: [], support: null };
    }
    const now = this.clock.now();
    const maintenance = await maintenanceNoticesFor(platform, tenant.code, now);
    // Phiên hỗ trợ đang mở: báo cho quản trị tài khoản của trường và cho chính nhân viên hỗ trợ
    const canSee =
      currentUser.hasPermission(PERMISSION_CODES.accountManage) || Boolean(currentUser.description.support);
    const support = canSee
      ? await platform
          .selectFrom('support_sessions')
          .select(['operator_name', 'scope', 'expires_at', 'started_at'])
          .where('school_id', '=', tenant.schoolId)
          .where('ended_at', 'is', null)
          .where('started_at', 'is not', null)
          .where('expires_at', '>', now)
          .orderBy('started_at', 'desc')
          .executeTakeFirst()
      : undefined;
    return { maintenance, support: support ?? null };
  }

  async overview() {
    const platform = this.platform();
    const tenant = currentTenant();
    const grants = await this.databases.system
      .selectFrom('support_access_grants')
      .selectAll()
      .orderBy('created_at', 'desc')
      .limit(20)
      .execute();
    const sessions =
      platform && tenant
        ? await platform
            .selectFrom('support_sessions')
            .select([
              'id',
              'operator_name',
              'scope',
              'reason',
              'created_at',
              'started_at',
              'expires_at',
              'ended_at',
              'end_reason',
            ])
            .where('school_id', '=', tenant.schoolId)
            .where('started_at', 'is not', null)
            .orderBy('started_at', 'desc')
            .limit(20)
            .execute()
        : [];
    const actions =
      platform && sessions.length
        ? await platform
            .selectFrom('support_session_actions')
            .select(['support_session_id', 'service', 'method', 'route', 'status', 'at'])
            .where(
              'support_session_id',
              'in',
              sessions.map((session) => session.id),
            )
            .orderBy('at', 'desc')
            .limit(200)
            .execute()
        : [];
    const now = this.clock.now();
    return {
      available: platform !== null,
      active_grant: grants.find((grant) => !grant.revoked_at && grant.expires_at > now) ?? null,
      grants,
      sessions: sessions.map((session) => ({
        ...session,
        actions: actions.filter((action) => action.support_session_id === session.id),
      })),
    };
  }

  async grant(input: Record<string, unknown>, currentUser: CurrentUser, request: Request) {
    if (!this.platform()) {
      throw notFound();
    }
    if (currentUser.description.support) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Phiên hỗ trợ không tự cấp cho phép hỗ trợ');
    }
    const scope = input.scope === 'full' ? 'full' : input.scope === 'read' || input.scope === undefined ? 'read' : null;
    const hours = input.hours === undefined ? 24 : Number(input.hours);
    const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
    const errors: Array<{ field: string; message: string }> = [];
    if (!scope) errors.push({ field: 'scope', message: 'Phạm vi là chỉ đọc hoặc toàn quyền' });
    if (!Number.isInteger(hours) || hours < 1 || hours > MAX_GRANT_HOURS) {
      errors.push({ field: 'hours', message: `Thời hạn từ 1 đến ${MAX_GRANT_HOURS} giờ` });
    }
    if (reason.length < 5 || reason.length > 500) errors.push({ field: 'reason', message: 'Lý do từ 5 đến 500 ký tự' });
    if (errors.length) {
      throw validationError(errors);
    }
    const now = this.clock.now();
    // Mỗi lúc chỉ một cho phép còn hiệu lực: cho phép mới thay cho phép cũ (phiên đang mở theo cho phép cũ kết thúc)
    const previous = await this.databases.system
      .selectFrom('support_access_grants')
      .select('id')
      .where('revoked_at', 'is', null)
      .where('expires_at', '>', now)
      .execute();
    for (const item of previous) {
      await this.revoke(item.id, currentUser, request, 'replaced');
    }
    const grant = await this.databases.system
      .insertInto('support_access_grants')
      .values({
        granted_by_user_id: currentUser.id,
        granted_by_name: actorNameOf(currentUser),
        scope: scope as SupportScope,
        reason,
        expires_at: new Date(now.getTime() + hours * 3_600_000),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    await this.audit(request, currentUser, grant.id, 'create', null, grant);
    await writeAudit(this.tenancy!.platform, {
      actorType: 'system',
      action: 'support.access-granted',
      schoolId: currentTenant()!.schoolId,
      details: {
        grant_id: grant.id,
        scope: grant.scope,
        expires_at: grant.expires_at,
        granted_by: grant.granted_by_name,
      },
    });
    return grant;
  }

  async revoke(id: string, currentUser: CurrentUser, request: Request, reason = 'revoked') {
    const platform = this.platform();
    const grant = await this.databases.system
      .selectFrom('support_access_grants')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!platform || !grant) {
      throw notFound();
    }
    if (currentUser.description.support) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Phiên hỗ trợ không tự rút cho phép hỗ trợ');
    }
    const now = this.clock.now();
    if (!grant.revoked_at) {
      const after = await this.databases.system
        .updateTable('support_access_grants')
        .set({ revoked_at: now, revoked_by_name: actorNameOf(currentUser) })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.audit(request, currentUser, id, 'update', grant, after);
    }
    // Kết thúc phiên hỗ trợ theo cho phép này và thu hồi phiên đăng nhập của tài khoản hỗ trợ ngay
    const sessions = await platform
      .updateTable('support_sessions')
      .set({ ended_at: now, end_reason: reason })
      .where('grant_id', '=', id)
      .where('ended_at', 'is', null)
      .returning(['id', 'identity_session_id'])
      .execute();
    const identitySessions = sessions
      .map((session) => session.identity_session_id)
      .filter((value): value is string => Boolean(value));
    const tenant = currentTenant()!;
    if (identitySessions.length) {
      await this.tenancy!.connections.database<IdentityDatabase>(tenant, 'identity', 'identity')
        .updateTable('sessions')
        .set({ revoked_at: now })
        .where('id', 'in', identitySessions)
        .where('revoked_at', 'is', null)
        .execute();
    }
    await writeAudit(platform, {
      actorType: 'system',
      action: 'support.access-revoked',
      schoolId: tenant.schoolId,
      details: { grant_id: id, reason, ended_sessions: sessions.map((session) => session.id) },
    });
    return { id, revoked: true, ended_sessions: sessions.length };
  }

  private async audit(
    request: Request,
    currentUser: CurrentUser,
    id: string,
    action: 'create' | 'update',
    before: unknown,
    after: unknown,
  ) {
    const current = await this.currentSchoolYear.find();
    if (current) {
      await writeAuditLog(current.database, {
        origin: originOf(request, currentUser),
        orgUnitId: null,
        entityName: 'support_access_grants',
        entityId: id,
        action,
        before,
        after,
      });
    }
  }
}

// Mọi người dùng đã đăng nhập của trường đọc được thông báo bảo trì
@Controller('platform-notices')
export class PlatformNoticesController {
  constructor(private readonly support: SupportAccessService) {}

  @Get()
  notices(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.support.notices(currentUser);
  }
}

@Controller('support-access')
export class SupportAccessController {
  constructor(private readonly support: SupportAccessService) {}

  @Get()
  @RequirePermission(PERMISSION_CODES.accountManage)
  overview() {
    return this.support.overview();
  }

  @Post()
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.accountManage)
  grant(
    @Body() body: Record<string, unknown> | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Req() request: Request,
  ) {
    return this.support.grant(body ?? {}, currentUser, request);
  }

  @Post(':id/revoke')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.accountManage)
  revoke(@Param('id') id: string, @AuthenticatedUser() currentUser: CurrentUser, @Req() request: Request) {
    return this.support.revoke(id, currentUser, request);
  }
}

// Phiên hỗ trợ của nhân viên nền tảng (DT-SaaS phần S4): phiên chỉ đọc không gửi được yêu cầu ghi; mọi phiên không kí số, không thao
// tác chứng thư số, không xuất toàn bộ dữ liệu; mọi yêu cầu ghi vào support_session_actions (phương thức, mẫu đường dẫn, mã kết quả)
const SUPPORT_BLOCKED_PATHS = [
  /^\/api\/v1\/signing\//,
  /^\/api\/v1\/outgoing-documents\/[^/]+\/sign$/,
  /^\/api\/v1\/school-data-exports/,
  /^\/api\/v1\/support-access/,
];

@Injectable()
export class SupportSessionInterceptor implements NestInterceptor {
  constructor(@Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null = null) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { currentUser?: CurrentUser }>();
    const support = request.currentUser?.description.support;
    const tenancy = this.tenancy;
    if (!support || !tenancy) {
      return next.handle();
    }
    const method = request.method.toUpperCase();
    const route = `${request.baseUrl}${(request.route as { path?: string } | undefined)?.path ?? request.path}`;
    const writes = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    const record = (status: number) =>
      void recordSupportAction(tenancy.platform, support.id, { service: 'api', method, route, status }).catch(
        () => undefined,
      );
    if ((writes && support.scope === 'read') || SUPPORT_BLOCKED_PATHS.some((pattern) => pattern.test(request.path))) {
      record(403);
      return throwError(
        () =>
          new ApplicationError(
            'ERR_FORBIDDEN',
            support.scope === 'read'
              ? 'Phiên hỗ trợ chỉ đọc, không thay đổi dữ liệu được'
              : 'Phiên hỗ trợ không kí số, không thao tác chứng thư số, không xuất toàn bộ dữ liệu, không đổi cho phép hỗ trợ',
            [],
            undefined,
            SUPPORT_RULE_CODE,
          ),
      );
    }
    const response = http.getResponse<Response>();
    response.once('finish', () => record(response.statusCode));
    return next.handle();
  }
}
