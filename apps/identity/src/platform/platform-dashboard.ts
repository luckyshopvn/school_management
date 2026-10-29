import { Body, Controller, Get, HttpCode, Inject, Injectable, Optional, Param, Post, Query, Req } from '@nestjs/common';
import {
  writeAudit,
  type MaintenanceSeverity,
  type PlatformDatabase,
  type TenancyRuntime,
} from '@school-management/database';
import { ApplicationError, Clock, validationError } from '@school-management/server';
import type { Request } from 'express';
import { sql, type Kysely } from 'kysely';
import { IDENTITY_CONFIGURATION, TENANCY_RUNTIME, type IdentityConfiguration } from '../common/configuration.js';
import { PlatformSchoolsService } from './platform-schools.js';
import { operatorRolesFor } from '@school-management/shared';

// Bảng điều khiển nền tảng (DT-SaaS phần S4, YCTD-197; tài liệu 47 mục 14.5 "S4"). Claude tự chọn theo ủy quyền của Eric ngày
// 2026-10-11:
// - danh sách trường kèm trạng thái, gói dịch vụ đang áp dụng (S5a), dung lượng, số tài khoản, số học sinh đang học, lần đăng nhập
//   gần nhất, phiên bản cấu trúc dữ liệu: đọc lần thu số liệu mới nhất (school_metrics, máy chủ API thu mỗi giờ), không truy vấn cơ
//   sở dữ liệu của từng trường khi mở trang;
// - lỗi theo trường: số lỗi 5xx gom theo giờ (school_error_counts), 24 giờ gần nhất; việc chạy định kỳ đang lỗi (scheduler_state);
// - cảnh báo: lỗi trong một giờ vượt ngưỡng (PLATFORM_ERROR_ALERT_PER_HOUR, mặc định 20), cấu trúc dữ liệu chưa mới nhất, gần chạm
//   giới hạn gói (từ 90%), số liệu cũ quá 3 giờ ở trường đang phục vụ, việc định kỳ lỗi;
// - thông báo bảo trì: người vận hành tạo (tiêu đề, nội dung, mức độ, thời gian, mọi trường hoặc danh sách trường), hủy được; người
//   dùng của trường thấy biểu ngữ từ 72 giờ trước khi bắt đầu đến khi kết thúc.
export const DEFAULT_ERROR_ALERT_PER_HOUR = 20;
const STALE_METRICS_HOURS = 3;
const NEAR_LIMIT_RATIO = 0.9;
const SERVING_STATUSES = ['trial', 'active', 'read_only'];
const SEVERITIES: MaintenanceSeverity[] = ['info', 'warning', 'critical'];

function notFound(): ApplicationError {
  return new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy');
}

export interface DashboardAlert {
  kind: 'errors' | 'schema' | 'storage' | 'students' | 'stale-metrics' | 'jobs';
  message: string;
}

@Injectable()
export class PlatformDashboardService {
  constructor(
    @Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null,
    @Inject(IDENTITY_CONFIGURATION) private readonly configuration: IdentityConfiguration,
    private readonly clock: Clock,
  ) {}

  private get platform(): Kysely<PlatformDatabase> {
    if (!this.tenancy) {
      throw notFound();
    }
    return this.tenancy.platform;
  }

  private get errorThreshold(): number {
    return this.configuration.errorAlertPerHour ?? DEFAULT_ERROR_ALERT_PER_HOUR;
  }

  async overview() {
    const now = this.clock.now();
    const today = now.toISOString().slice(0, 10);
    const dayAgo = new Date(now.getTime() - 24 * 3_600_000);
    const hourAgo = new Date(now.getTime() - 3_600_000);
    const [schools, metrics, plans, errors, jobs, support] = await Promise.all([
      this.platform
        .selectFrom('schools')
        .select(['id', 'code', 'name', 'status', 'data_class', 'created_at'])
        .orderBy('code')
        .execute(),
      sql<{
        school_id: string;
        captured_at: Date;
        users_total: number;
        users_active: number;
        active_students: number | null;
        storage_mb: string | null;
        database_mb: string | null;
        last_login_at: Date | null;
        schema_versions: Record<string, string | null>;
        schema_current: boolean;
      }>`select distinct on (school_id) school_id, captured_at, users_total, users_active, active_students, storage_mb,
           database_mb, last_login_at, schema_versions, schema_current
         from school_metrics order by school_id, captured_at desc`
        .execute(this.platform)
        .then((result) => result.rows),
      this.platform
        .selectFrom('school_plans')
        .innerJoin('plans', 'plans.id', 'school_plans.plan_id')
        .select([
          'school_plans.school_id',
          'school_plans.effective_from',
          'plans.code',
          'plans.name',
          'plans.max_active_students',
          'plans.max_storage_mb',
        ])
        .where('school_plans.effective_from', '<=', today)
        .where((eb) =>
          eb.or([eb('school_plans.effective_to', 'is', null), eb('school_plans.effective_to', '>=', today)]),
        )
        .orderBy('school_plans.effective_from', 'desc')
        .execute(),
      this.platform
        .selectFrom('school_error_counts')
        .select((eb) => [
          'school_id',
          eb.fn.sum<string>('count').as('last_day'),
          eb.fn
            .sum<string>(
              sql`case when bucket >= ${new Date(Math.floor(hourAgo.getTime() / 3_600_000) * 3_600_000)} then count else 0 end`,
            )
            .as('last_hour'),
          eb.fn.max('last_at').as('last_at'),
        ])
        .where('bucket', '>=', dayAgo)
        .groupBy('school_id')
        .execute(),
      this.platform
        .selectFrom('scheduler_state')
        .select(['school_id', 'job', 'last_run_at', 'last_error'])
        .where('last_status', '=', 'error')
        .execute(),
      this.platform
        .selectFrom('support_sessions')
        .select(['school_id', 'operator_name', 'scope', 'expires_at'])
        .where('ended_at', 'is', null)
        .where('started_at', 'is not', null)
        .where('expires_at', '>', now)
        .execute(),
    ]);
    const threshold = this.errorThreshold;
    const items = schools.map((school) => {
      const metric = metrics.find((row) => row.school_id === school.id) ?? null;
      const plan = plans.find((row) => row.school_id === school.id) ?? null;
      const error = errors.find((row) => row.school_id === school.id);
      const failingJobs = jobs.filter((row) => row.school_id === school.id);
      const storageMb =
        metric?.storage_mb === null || metric?.storage_mb === undefined ? null : Number(metric.storage_mb);
      const errorsLastHour = Number(error?.last_hour ?? 0);
      const alerts: DashboardAlert[] = [];
      if (errorsLastHour >= threshold) {
        alerts.push({ kind: 'errors', message: `${errorsLastHour} lỗi máy chủ trong một giờ (ngưỡng ${threshold})` });
      }
      if (metric && !metric.schema_current) {
        alerts.push({ kind: 'schema', message: 'Cấu trúc dữ liệu chưa ở phiên bản mới nhất' });
      }
      if (plan?.max_storage_mb && storageMb !== null && storageMb >= plan.max_storage_mb * NEAR_LIMIT_RATIO) {
        alerts.push({ kind: 'storage', message: `Dung lượng tệp ${storageMb} MB / ${plan.max_storage_mb} MB của gói` });
      }
      if (
        plan?.max_active_students &&
        metric?.active_students != null &&
        metric.active_students >= plan.max_active_students * NEAR_LIMIT_RATIO
      ) {
        alerts.push({
          kind: 'students',
          message: `Học sinh đang học ${metric.active_students} / ${plan.max_active_students} của gói`,
        });
      }
      if (
        SERVING_STATUSES.includes(school.status) &&
        (!metric || metric.captured_at.getTime() < now.getTime() - STALE_METRICS_HOURS * 3_600_000)
      ) {
        alerts.push({ kind: 'stale-metrics', message: 'Chưa có số liệu mới trong 3 giờ gần nhất' });
      }
      if (failingJobs.length) {
        alerts.push({
          kind: 'jobs',
          message: `Việc định kỳ đang lỗi: ${failingJobs.map((job) => job.job).join(', ')}`,
        });
      }
      return {
        ...school,
        plan: plan
          ? {
              code: plan.code,
              name: plan.name,
              max_active_students: plan.max_active_students,
              max_storage_mb: plan.max_storage_mb,
            }
          : null,
        metrics: metric
          ? {
              captured_at: metric.captured_at,
              users_total: metric.users_total,
              users_active: metric.users_active,
              active_students: metric.active_students,
              storage_mb: storageMb,
              database_mb: metric.database_mb === null ? null : Number(metric.database_mb),
              last_login_at: metric.last_login_at,
              schema_versions: metric.schema_versions,
              schema_current: metric.schema_current,
            }
          : null,
        errors: { last_hour: errorsLastHour, last_day: Number(error?.last_day ?? 0), last_at: error?.last_at ?? null },
        failing_jobs: failingJobs.map(({ job, last_run_at, last_error }) => ({ job, last_run_at, last_error })),
        support: support.find((row) => row.school_id === school.id) ?? null,
        alerts,
      };
    });
    const platformErrors = errors.find((row) => row.school_id === null);
    return {
      generated_at: now,
      error_alert_per_hour: threshold,
      totals: {
        schools: items.length,
        serving: items.filter((item) => SERVING_STATUSES.includes(item.status)).length,
        with_alerts: items.filter((item) => item.alerts.length > 0).length,
        users: items.reduce((sum, item) => sum + (item.metrics?.users_total ?? 0), 0),
        active_students: items.reduce((sum, item) => sum + (item.metrics?.active_students ?? 0), 0),
        storage_mb: Math.round(items.reduce((sum, item) => sum + (item.metrics?.storage_mb ?? 0), 0) * 100) / 100,
        errors_last_day: errors.reduce((sum, row) => sum + Number(row.last_day), 0),
        platform_errors_last_day: Number(platformErrors?.last_day ?? 0),
      },
      items,
    };
  }

  // Chi tiết lỗi gom theo giờ; lọc theo trường (mã trường) hoặc lỗi không thuộc trường nào (school=-)
  async errors(schoolCode: string | undefined, hoursInput: string | undefined) {
    const hours = Math.min(Math.max(Number(hoursInput) || 24, 1), 24 * 30);
    const since = new Date(this.clock.now().getTime() - hours * 3_600_000);
    let query = this.platform
      .selectFrom('school_error_counts')
      .leftJoin('schools', 'schools.id', 'school_error_counts.school_id')
      .select([
        'schools.code as school_code',
        'school_error_counts.service',
        'school_error_counts.bucket',
        'school_error_counts.route',
        'school_error_counts.status',
        'school_error_counts.count',
        'school_error_counts.last_code',
        'school_error_counts.last_at',
      ])
      .where('school_error_counts.bucket', '>=', since);
    if (schoolCode === '-') {
      query = query.where('school_error_counts.school_id', 'is', null);
    } else if (schoolCode) {
      query = query.where('schools.code', '=', schoolCode);
    }
    const items = await query
      .orderBy('school_error_counts.bucket', 'desc')
      .orderBy('school_error_counts.count', 'desc')
      .limit(500)
      .execute();
    return { hours, items };
  }

  async notices() {
    const items = await this.platform
      .selectFrom('maintenance_notices')
      .selectAll()
      .orderBy('starts_at', 'desc')
      .limit(100)
      .execute();
    const now = this.clock.now();
    return {
      items: items.map((item) => ({
        ...item,
        state: item.cancelled_at
          ? 'cancelled'
          : item.ends_at <= now
            ? 'ended'
            : item.starts_at <= now
              ? 'active'
              : 'scheduled',
      })),
    };
  }

  async createNotice(input: Record<string, unknown>, actor: { id: string; name: string }) {
    const errors: Array<{ field: string; message: string }> = [];
    const title = typeof input.title === 'string' ? input.title.trim() : '';
    const body = typeof input.body === 'string' ? input.body.trim() : '';
    const severity = (typeof input.severity === 'string' ? input.severity : 'info') as MaintenanceSeverity;
    const startsAt = typeof input.starts_at === 'string' ? new Date(input.starts_at) : null;
    const endsAt = typeof input.ends_at === 'string' ? new Date(input.ends_at) : null;
    const audience = input.audience === 'schools' ? 'schools' : 'all';
    const schoolCodes = Array.isArray(input.school_codes)
      ? [
          ...new Set(
            input.school_codes
              .filter((code): code is string => typeof code === 'string' && code.trim() !== '')
              .map((code) => code.trim()),
          ),
        ]
      : [];
    if (title.length < 1 || title.length > 200) errors.push({ field: 'title', message: 'Tiêu đề từ 1 đến 200 ký tự' });
    if (body.length < 1 || body.length > 2000) errors.push({ field: 'body', message: 'Nội dung từ 1 đến 2000 ký tự' });
    if (!SEVERITIES.includes(severity)) errors.push({ field: 'severity', message: 'Mức độ không hợp lệ' });
    if (!startsAt || Number.isNaN(startsAt.getTime()))
      errors.push({ field: 'starts_at', message: 'Thời gian bắt đầu không hợp lệ' });
    if (!endsAt || Number.isNaN(endsAt.getTime()))
      errors.push({ field: 'ends_at', message: 'Thời gian kết thúc không hợp lệ' });
    if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
      errors.push({ field: 'ends_at', message: 'Kết thúc phải sau bắt đầu' });
    }
    if (endsAt && endsAt.getTime() <= this.clock.now().getTime()) {
      errors.push({ field: 'ends_at', message: 'Kết thúc phải sau thời điểm hiện tại' });
    }
    if (audience === 'schools') {
      if (!schoolCodes.length) {
        errors.push({ field: 'school_codes', message: 'Chọn ít nhất một trường' });
      } else {
        const known = await this.platform
          .selectFrom('schools')
          .select('code')
          .where('code', 'in', schoolCodes)
          .execute();
        const unknown = schoolCodes.filter((code) => !known.some((row) => row.code === code));
        if (unknown.length) errors.push({ field: 'school_codes', message: `Không có trường: ${unknown.join(', ')}` });
      }
    }
    if (errors.length) {
      throw validationError(errors);
    }
    const notice = await this.platform
      .insertInto('maintenance_notices')
      .values({
        title,
        body,
        severity,
        starts_at: startsAt as Date,
        ends_at: endsAt as Date,
        audience,
        school_codes: JSON.stringify(audience === 'schools' ? schoolCodes : []),
        created_by: actor.id,
        created_by_name: actor.name,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    await writeAudit(this.platform, {
      actorType: 'operator',
      actorId: actor.id,
      action: 'maintenance.notice-created',
      details: { notice_id: notice.id, title, severity, audience, school_codes: notice.school_codes },
    });
    return notice;
  }

  async cancelNotice(id: string, actor: { id: string; name: string }) {
    const notice = await this.platform
      .selectFrom('maintenance_notices')
      .select(['id', 'cancelled_at'])
      .where('id', '=', id)
      .executeTakeFirst();
    if (!notice) {
      throw notFound();
    }
    if (!notice.cancelled_at) {
      await this.platform
        .updateTable('maintenance_notices')
        .set({ cancelled_at: this.clock.now() })
        .where('id', '=', id)
        .execute();
      await writeAudit(this.platform, {
        actorType: 'operator',
        actorId: actor.id,
        action: 'maintenance.notice-cancelled',
        details: { notice_id: id },
      });
    }
    return { id, cancelled: true };
  }
}

@Controller('auth/platform')
export class PlatformDashboardController {
  constructor(
    private readonly dashboard: PlatformDashboardService,
    private readonly schools: PlatformSchoolsService,
  ) {}

  @Get('dashboard')
  async overview(@Req() request: Request) {
    await this.schools.actor(request, operatorRolesFor('overview.view'));
    return this.dashboard.overview();
  }

  @Get('dashboard/errors')
  async errors(
    @Query('school') school: string | undefined,
    @Query('hours') hours: string | undefined,
    @Req() request: Request,
  ) {
    await this.schools.actor(request, operatorRolesFor('dashboard.errors'));
    return this.dashboard.errors(school, hours);
  }

  @Get('maintenance-notices')
  async notices(@Req() request: Request) {
    await this.schools.actor(request, operatorRolesFor('maintenance.view'));
    return this.dashboard.notices();
  }

  @Post('maintenance-notices')
  @HttpCode(200)
  async create(@Body() body: Record<string, unknown> | undefined, @Req() request: Request) {
    const actor = await this.schools.actor(request, operatorRolesFor('maintenance.manage'));
    return this.dashboard.createNotice(body ?? {}, { id: actor.id ?? '', name: actor.name });
  }

  @Post('maintenance-notices/:id/cancel')
  @HttpCode(200)
  async cancel(@Param('id') id: string, @Req() request: Request) {
    const actor = await this.schools.actor(request, operatorRolesFor('maintenance.manage'));
    return this.dashboard.cancelNotice(id, { id: actor.id ?? '', name: actor.name });
  }
}
