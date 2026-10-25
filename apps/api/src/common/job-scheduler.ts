import { timingSafeEqual } from 'node:crypto';
import {
  Controller,
  Headers,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  Post,
  Req,
  UnauthorizedException,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { SchoolRunResult, TenancyRuntime } from '@school-management/database';
import { sql } from 'kysely';
import type { Request } from 'express';
import { AdmissionsRateLimiter } from '../admissions/public-rate-limit.js';
import { PublicEndpoint } from '../authentication/authentication.guard.js';
import { API_CONFIGURATION, TENANCY_RUNTIME, type ApiConfiguration } from './configuration.js';

export interface ScheduledJob {
  name: string;
  intervalSeconds: number;
  // Việc khởi động của tiến trình (như đăng ký biểu vào bộ nhớ): chạy một lần cho mỗi trường ở lượt đầu mà tiến trình thấy trường đó,
  // không chiếm qua cơ sở dữ liệu nền tảng vì kết quả chỉ nằm trong bộ nhớ của tiến trình này
  perProcess?: boolean;
  run(): Promise<void>;
}

// Một việc đến hạn khi lần chạy gần nhất cách đây ít nhất khoảng này (tỉ lệ của chu kỳ): chu kỳ của bộ hẹn giờ trong tiến trình
// hoặc của nơi gọi tick bên ngoài lệch chút thì việc vẫn chạy đúng nhịp
const DUE_RATIO = 0.9;

// Bộ lập lịch việc nền theo từng trường (DT-SaaS phần S1b, tài liệu 32 mục 14.5). Chế độ một trường không dùng: mỗi lớp việc nền tự
// hẹn giờ như trước. Chế độ nhiều trường: mỗi lớp đăng ký việc ở đây; mỗi lượt tick duyệt các trường đang phục vụ (đồng thời có
// giới hạn, lệch ngẫu nhiên), chiếm việc đến hạn của từng trường bằng một câu lệnh nguyên tử trên `scheduler_state` ở cơ sở dữ liệu nền
// tảng nên nhiều bản máy chủ hay tick gọi muộn, gọi trùng đều không chạy trùng, và máy chủ ngủ rồi dậy thì bù ngay lượt đến hạn.
// Việc chạy trong ngữ cảnh của trường; trường lỗi không chặn trường khác
@Injectable()
export class JobScheduler implements OnModuleDestroy {
  private readonly logger = new Logger(JobScheduler.name);
  private readonly jobs = new Map<string, ScheduledJob>();
  private timer: NodeJS.Timeout | null = null;
  private ticking: Promise<SchoolRunResult[]> | null = null;
  private readonly started = new Set<string>();

  constructor(
    @Inject(API_CONFIGURATION) private readonly configuration: ApiConfiguration,
    @Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null = null,
  ) {}

  get enabled(): boolean {
    return this.tenancy !== null;
  }

  register(job: ScheduledJob): void {
    if (!this.tenancy || job.intervalSeconds <= 0) {
      return;
    }
    this.jobs.set(job.name, job);
    const period = this.configuration.schedulerIntervalSeconds ?? 15;
    if (!this.timer && period > 0) {
      this.timer = setInterval(() => void this.tick(), period * 1000);
      this.timer.unref();
      // Lượt đầu ngay sau khi khởi động, để việc khởi động theo trường (như đăng ký biểu EMIS) xong trước yêu cầu đầu tiên
      const first = setTimeout(() => void this.tick(), 1000);
      first.unref();
    }
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  jobNames(): string[] {
    return [...this.jobs.keys()].sort();
  }

  // Một lượt: lượt đang chạy thì dùng lại kết quả của nó (tick gọi dồn không chồng lượt)
  tick(): Promise<SchoolRunResult[]> {
    if (!this.tenancy || this.jobs.size === 0) {
      return Promise.resolve([]);
    }
    if (!this.ticking) {
      const runtime = this.tenancy;
      this.ticking = runtime
        .forEachServingSchool(
          async (tenant) => {
            for (const job of this.jobs.values()) {
              if (job.perProcess) {
                const key = `${job.name}:${tenant.schoolId}`;
                if (!this.started.has(key)) {
                  await job.run();
                  this.started.add(key);
                }
                continue;
              }
              await this.runIfDue(runtime, tenant.schoolId, job);
            }
          },
          { concurrency: this.configuration.schedulerConcurrency ?? 2, jitterMilliseconds: 500 },
        )
        .catch((error: unknown) => {
          this.logger.error('Bộ lập lịch lỗi', error instanceof Error ? error.stack : String(error));
          return [];
        })
        .finally(() => {
          this.ticking = null;
        });
    }
    return this.ticking;
  }

  private async runIfDue(runtime: TenancyRuntime, schoolId: string, job: ScheduledJob): Promise<void> {
    const claimed = await sql<{ run_count: string }>`
      insert into scheduler_state (school_id, job, last_run_at, run_count)
      values (${schoolId}, ${job.name}, now(), 1)
      on conflict (school_id, job) do update
        set last_run_at = now(), run_count = scheduler_state.run_count + 1
        where scheduler_state.last_run_at <= now() - make_interval(secs => ${job.intervalSeconds * DUE_RATIO}::double precision)
      returning run_count`.execute(runtime.platform);
    if (claimed.rows.length === 0) {
      return;
    }
    const started = Date.now();
    let error: string | null = null;
    try {
      await job.run();
    } catch (cause) {
      error = (cause instanceof Error ? cause.message : String(cause)).slice(0, 500);
      this.logger.error(`Việc nền ${job.name} lỗi`, cause instanceof Error ? cause.stack : String(cause));
    }
    await sql`
      update scheduler_state
      set last_status = ${error ? 'error' : 'ok'}, last_duration_ms = ${Date.now() - started}, last_error = ${error}
      where school_id = ${schoolId} and job = ${job.name}`
      .execute(runtime.platform)
      .catch(() => undefined);
  }
}

// Điểm gọi cho nơi hẹn giờ bên ngoài (cron của nền tảng, GitHub Actions, Cloudflare Cron) khi máy chủ được phép ngủ khi rảnh (hồ sơ
// miễn phí): mỗi lần gọi chạy các việc đến hạn của mọi trường. Không cần trường (đi qua địa chỉ nội bộ), đòi bí mật dùng chung
// INTERNAL_JOB_TOKEN; chưa đặt bí mật thì điểm này không tồn tại (404)
@Controller('internal/jobs')
@PublicEndpoint()
export class InternalJobsController {
  constructor(
    @Inject(API_CONFIGURATION) private readonly configuration: ApiConfiguration,
    private readonly scheduler: JobScheduler,
    private readonly limiter: AdmissionsRateLimiter,
  ) {}

  @Post('tick')
  async tick(@Headers('x-internal-job-token') secret: string | undefined, @Req() request: Request) {
    const expected = this.configuration.schedulerSecret;
    if (!expected || !this.scheduler.enabled) {
      throw new NotFoundException();
    }
    this.limiter.hit('read', request.ip);
    const given = Buffer.from(secret ?? '');
    const wanted = Buffer.from(expected);
    if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) {
      throw new UnauthorizedException();
    }
    const results = await this.scheduler.tick();
    return {
      jobs: this.scheduler.jobNames(),
      schools: results.length,
      failed: results.filter((result) => !result.ok).map((result) => result.schoolCode),
    };
  }
}
