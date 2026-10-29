import { Controller, Get, Inject, Injectable, Optional, Req } from '@nestjs/common';
import type { TenancyRuntime } from '@school-management/database';
import { Clock } from '@school-management/server';
import {
  checkState,
  SLOW_MILLISECONDS,
  timedCheck,
  WORKER_STALE_SECONDS,
  type ApiStatusRecord,
  type CheckResult,
} from '@school-management/server/service-status';
import { GENERATION_QUEUE_KEY } from '@school-management/server/timetable-generation';
import { operatorRolesFor } from '@school-management/shared';
import type { Request } from 'express';
import { sql } from 'kysely';
import { IDENTITY_CONFIGURATION, TENANCY_RUNTIME, type IdentityConfiguration } from '../common/configuration.js';
import { Infrastructure } from '../common/infrastructure.js';
import { PlatformSchoolsService } from './platform-schools.js';

// Khối "Tình trạng dịch vụ" của trang Bảo trì (YCTD-376, ĐX-CN-1, phương án A Eric duyệt ngày 2026-10-29). Chỉ đo khi người vận hành
// bấm Kiểm lại (không tự làm mới, Q3), không lưu, không ghi nhật ký. Năm mục:
// - dịch vụ định danh: cơ sở dữ liệu (nền tảng ở chế độ nhiều trường) và Redis;
// - máy chủ API: GET /api/v1/health công khai (hết 3 giây là không phản hồi) và kết quả tự kiểm cơ sở dữ liệu ở khóa Redis;
// - tiến trình nền: tín hiệu còn sống, quá 90 giây là đã dừng;
// - lưu trữ tệp: kết quả tự kiểm của máy chủ API;
// - hàng đợi: số việc chờ của máy xếp thời khoá biểu.
// Ngưỡng Chậm 1 giây cho mọi mục (Q2). Chỉ trả trạng thái, thời gian, giờ; không trả nội dung lỗi
export type ServiceKey = 'identity' | 'api' | 'worker' | 'storage' | 'queue';
export type ServiceState = 'ok' | 'slow' | 'error' | 'unknown';

export interface ServiceStatusItem {
  key: ServiceKey;
  state: ServiceState;
  milliseconds: number | null;
  detail: string;
  // Giờ của số liệu (tự kiểm của API, tín hiệu cuối của tiến trình nền); null là đo ngay lúc gọi
  observed_at: string | null;
}

export interface ServiceStatusReply {
  checked_at: string;
  slow_milliseconds: number;
  items: ServiceStatusItem[];
}

export const API_HEALTH_TIMEOUT_MILLISECONDS = 3000;

export interface ServiceStatusProbes {
  now: Date;
  checkDatabase: () => Promise<unknown>;
  ping: () => Promise<unknown>;
  readWorkerHeartbeat: () => Promise<string | null>;
  readApiStatus: () => Promise<string | null>;
  queueLength: () => Promise<number>;
  // Gọi GET /api/v1/health của máy chủ API; lỗi hoặc quá hạn thì ném lỗi
  checkApiHealth: () => Promise<unknown>;
}

function worst(...states: ServiceState[]): ServiceState {
  for (const state of ['error', 'unknown', 'slow'] as const) {
    if (states.includes(state)) {
      return state;
    }
  }
  return 'ok';
}

function readApiRecord(value: string | null): ApiStatusRecord | null {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value) as ApiStatusRecord;
  } catch {
    return null;
  }
}

function describe(result: CheckResult, what: string): string {
  return result.ok ? `${what} ${result.milliseconds} ms` : `${what} lỗi`;
}

export async function collectServiceStatus(probes: ServiceStatusProbes): Promise<ServiceStatusReply> {
  const redisCheck: { result: CheckResult; value: string | null; apiRecord: string | null; queue: number | null } = {
    result: { ok: false, milliseconds: 0 },
    value: null,
    apiRecord: null,
    queue: null,
  };
  const [database, api] = await Promise.all([
    timedCheck(probes.checkDatabase),
    timedCheck(probes.checkApiHealth),
    (async () => {
      redisCheck.result = await timedCheck(async () => {
        await probes.ping();
        const [heartbeat, record, queue] = await Promise.all([
          probes.readWorkerHeartbeat(),
          probes.readApiStatus(),
          probes.queueLength(),
        ]);
        redisCheck.value = heartbeat;
        redisCheck.apiRecord = record;
        redisCheck.queue = queue;
      });
    })(),
  ]);
  const redis = redisCheck.result;
  const items: ServiceStatusItem[] = [];

  items.push({
    key: 'identity',
    state: worst(checkState(database), checkState(redis)),
    milliseconds: Math.max(database.milliseconds, redis.milliseconds),
    detail: `${describe(database, 'Cơ sở dữ liệu')}; ${describe(redis, 'Redis')}`,
    observed_at: null,
  });

  // Không đọc được Redis thì không biết tình trạng các mục dựa vào khóa Redis
  const unknownFromRedis = (key: ServiceKey): ServiceStatusItem => ({
    key,
    state: 'unknown',
    milliseconds: null,
    detail: 'Không đọc được Redis',
    observed_at: null,
  });

  const record = readApiRecord(redisCheck.apiRecord);
  const apiHealth: ServiceState = api.ok ? checkState(api) : 'error';
  if (!api.ok) {
    items.push({
      key: 'api',
      state: 'error',
      milliseconds: null,
      detail: `Không phản hồi trong ${API_HEALTH_TIMEOUT_MILLISECONDS / 1000} giây`,
      observed_at: null,
    });
  } else if (!redis.ok) {
    items.push({
      ...unknownFromRedis('api'),
      state: apiHealth,
      milliseconds: api.milliseconds,
      detail: `Phản hồi ${api.milliseconds} ms; không đọc được kết quả tự kiểm`,
    });
  } else if (!record) {
    items.push({
      key: 'api',
      state: 'unknown',
      milliseconds: api.milliseconds,
      detail: `Phản hồi ${api.milliseconds} ms; chưa có kết quả tự kiểm trong 3 phút`,
      observed_at: null,
    });
  } else {
    items.push({
      key: 'api',
      state: worst(apiHealth, checkState(record.database)),
      milliseconds: api.milliseconds,
      detail: `Phản hồi ${api.milliseconds} ms; ${describe(record.database, 'cơ sở dữ liệu')}`,
      observed_at: record.checked_at,
    });
  }

  if (!redis.ok) {
    items.push(unknownFromRedis('worker'));
  } else if (!redisCheck.value) {
    items.push({ key: 'worker', state: 'error', milliseconds: null, detail: 'Chưa có tín hiệu', observed_at: null });
  } else {
    const ageSeconds = (probes.now.getTime() - new Date(redisCheck.value).getTime()) / 1000;
    const alive = ageSeconds <= WORKER_STALE_SECONDS;
    items.push({
      key: 'worker',
      state: alive ? 'ok' : 'error',
      milliseconds: null,
      detail: alive ? 'Đang chạy' : 'Không có tín hiệu',
      observed_at: redisCheck.value,
    });
  }

  if (!redis.ok) {
    items.push(unknownFromRedis('storage'));
  } else if (!record) {
    items.push({
      key: 'storage',
      state: 'unknown',
      milliseconds: null,
      detail: 'Chưa có kết quả tự kiểm của máy chủ API',
      observed_at: null,
    });
  } else if (!record.storage) {
    items.push({
      key: 'storage',
      state: 'unknown',
      milliseconds: null,
      detail: 'Bản triển khai không dùng lưu trữ tệp dùng chung',
      observed_at: record.checked_at,
    });
  } else {
    items.push({
      key: 'storage',
      state: checkState(record.storage),
      milliseconds: record.storage.ok ? record.storage.milliseconds : null,
      detail: describe(record.storage, 'Thùng chứa'),
      observed_at: record.checked_at,
    });
  }

  items.push(
    redis.ok
      ? {
          key: 'queue',
          state: 'ok',
          milliseconds: null,
          detail: `${redisCheck.queue ?? 0} việc xếp thời khoá biểu đang chờ`,
          observed_at: null,
        }
      : unknownFromRedis('queue'),
  );

  return { checked_at: probes.now.toISOString(), slow_milliseconds: SLOW_MILLISECONDS, items };
}

@Injectable()
export class PlatformServiceStatusService {
  constructor(
    private readonly infrastructure: Infrastructure,
    @Inject(IDENTITY_CONFIGURATION) private readonly configuration: IdentityConfiguration,
    private readonly clock: Clock,
    @Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null = null,
  ) {}

  status(): Promise<ServiceStatusReply> {
    return collectServiceStatus({
      now: this.clock.now(),
      checkDatabase: () => sql`select 1`.execute(this.tenancy ? this.tenancy.platform : this.infrastructure.database),
      ping: () => this.infrastructure.ping(),
      readWorkerHeartbeat: () => this.infrastructure.platformCache('worker').get('heartbeat'),
      readApiStatus: () => this.infrastructure.platformCache('service-status').get('api'),
      queueLength: () => this.infrastructure.queueLength(GENERATION_QUEUE_KEY),
      checkApiHealth: async () => {
        const response = await fetch(`${this.configuration.apiBaseUrl}/api/v1/health`, {
          signal: AbortSignal.timeout(API_HEALTH_TIMEOUT_MILLISECONDS),
        });
        if (!response.ok) {
          throw new Error(String(response.status));
        }
      },
    });
  }
}

@Controller('auth/platform')
export class PlatformServiceStatusController {
  constructor(
    private readonly serviceStatus: PlatformServiceStatusService,
    private readonly schools: PlatformSchoolsService,
  ) {}

  @Get('service-status')
  async status(@Req() request: Request) {
    await this.schools.actor(request, operatorRolesFor('maintenance.view'));
    return this.serviceStatus.status();
  }
}
