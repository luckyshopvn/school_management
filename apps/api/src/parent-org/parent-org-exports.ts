import {
  Body,
  Controller,
  Get,
  Inject,
  Injectable,
  Optional,
  Param,
  Post,
  Req,
  Res,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import {
  AGGREGATE_CATEGORY_LABELS,
  aggregateForUnit,
  isAggregateCategory,
  subtreeUnitIds,
  writeAudit,
  type AggregateCategory,
  type PlatformDatabase,
  type TenancyRuntime,
} from '@school-management/database';
import { ApplicationError, Clock, validationError, type FieldError } from '@school-management/server';
import type { Request, Response } from 'express';
import { sql, type Kysely } from 'kysely';
import { PublicEndpoint } from '../authentication/authentication.guard.js';
import { API_CONFIGURATION, TENANCY_RUNTIME, type ApiConfiguration } from '../common/configuration.js';
import { buildTableFile, CONTENT_TYPES } from '../exports/table-file.js';
import { FileStorage } from '../files/file-storage.js';
import { TenantFileStorage } from '../school-settings/tenant-connectors.js';
import { aggregateSheets, notFound, ParentOrgDataService, type AggregateLayout } from './parent-org.js';

// Xuất báo cáo chạy nền cho tài khoản cấp trên (YCTD-367; giao diện trang Xuất báo cáo của YCTD-363). Claude tự chọn theo ủy quyền của
// Eric ngày 2026-10-11:
// - mỗi lần xuất là một việc ở `parent_org_exports`: một tệp gồm các nhóm số liệu đã chọn (mỗi nhóm một trang tính), bố cục "tổng hợp
//   theo đơn vị" hoặc "so sánh từng trường", Excel hoặc PDF; số liệu và quy tắc ẩn ô nhỏ như trên màn hình (aggregateForUnit);
// - việc định kỳ của máy chủ API (PARENT_ORG_EXPORT_INTERVAL_SECONDS, mặc định 30; 0 là tắt) chiếm việc chờ bằng `for update skip locked`
//   nên nhiều bản máy chủ không dựng trùng; tạo việc xong thì chạy ngay một lượt;
// - tệp lưu ở kho tệp chung của bản triển khai, thư mục của đơn vị cấp trên `platform/parent-org-exports/<đơn vị>/<việc>`; giữ
//   PARENT_ORG_EXPORT_RETENTION_DAYS ngày (mặc định 7) rồi việc định kỳ xóa tệp, việc chuyển sang `expired`;
// - quyền: chỉ tài khoản cấp trên tạo việc mới thấy và tải tệp của mình; đơn vị phải còn trong phạm vi lúc tạo và lúc tải; mỗi lần tạo,
//   tải ghi nhật ký nền tảng. Không dùng vai trò vận hành (tài khoản cấp trên có quyền riêng theo cây đơn vị);
// - mỗi tài khoản có tối đa 3 việc đang chờ hoặc đang dựng; việc dựng quá 15 phút (máy chủ dừng giữa chừng) được dựng lại, lỗi 3 lần thì
//   ghi lỗi.
const LAYOUTS: readonly AggregateLayout[] = ['summary', 'compare'];
const LAYOUT_LABELS: Record<AggregateLayout, string> = {
  summary: 'Tổng hợp theo đơn vị',
  compare: 'So sánh từng trường',
};
const FORMATS = ['xlsx', 'pdf'] as const;
type ExportFormat = (typeof FORMATS)[number];
const MAX_ACTIVE_PER_USER = 3;
const MAX_ATTEMPTS = 3;
const STALE_RUNNING_MS = 15 * 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parentOrgExportKey(unitId: string, exportId: string, format: ExportFormat): string {
  return `platform/parent-org-exports/${unitId}/${exportId}.${format}`;
}

@Injectable()
export class ParentOrgExportsService implements OnApplicationBootstrap, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private running: Promise<{ built: number; expired: number }> | null = null;

  constructor(
    @Inject(API_CONFIGURATION) private readonly configuration: ApiConfiguration,
    private readonly clock: Clock,
    private readonly data: ParentOrgDataService,
    private readonly files: FileStorage,
    @Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null = null,
  ) {}

  private get platform(): Kysely<PlatformDatabase> {
    if (!this.tenancy) throw notFound();
    return this.tenancy.platform;
  }

  private get storage(): FileStorage | null {
    // Kho chung của bản triển khai: việc xuất không có ngữ cảnh trường nên không đọc kho riêng của trường
    if (!(this.files instanceof TenantFileStorage)) return this.files;
    return this.files.hasDeploymentStorage() ? this.files.deploymentStorage() : null;
  }

  private get retentionDays(): number {
    return this.configuration.parentOrgExportRetentionDays ?? 7;
  }

  onApplicationBootstrap(): void {
    const seconds = this.configuration.parentOrgExportIntervalSeconds ?? 30;
    if (!this.tenancy || seconds <= 0) return;
    this.timer = setInterval(() => {
      void this.runDue().catch(() => undefined);
    }, seconds * 1000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async create(request: Request, body: Record<string, unknown> | undefined) {
    const user = await this.data.user(request);
    const storage = this.storage;
    if (!storage) {
      throw new ApplicationError('ERR_RULE_VIOLATION', 'Bản triển khai chưa có kho tệp để xuất chạy nền; dùng tải trực tiếp');
    }
    const unitId = typeof body?.unit_id === 'string' && body.unit_id ? body.unit_id : user.unit_id;
    const categories: AggregateCategory[] = Array.isArray(body?.categories)
      ? [...new Set(body.categories.filter(isAggregateCategory))]
      : [];
    const layout = LAYOUTS.find((item) => item === body?.layout);
    const format = FORMATS.find((item) => item === body?.format);
    const errors: FieldError[] = [];
    if (!categories.length) errors.push({ field: 'categories', message: 'Chọn ít nhất một nhóm số liệu' });
    if (!layout) errors.push({ field: 'layout', message: 'Chọn bố cục tổng hợp hoặc so sánh' });
    if (!format) errors.push({ field: 'format', message: 'Chọn Excel hoặc PDF' });
    if (errors.length || !layout || !format) throw validationError(errors);
    const scope = await subtreeUnitIds(this.platform, user.unit_id);
    if (!scope.includes(unitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Nút không thuộc phạm vi của đơn vị');
    }
    const unit = await this.platform
      .selectFrom('admin_units')
      .select('name')
      .where('id', '=', unitId)
      .executeTakeFirstOrThrow();
    const active = await this.platform
      .selectFrom('parent_org_exports')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .where('user_id', '=', user.id)
      .where('status', 'in', ['queued', 'running'])
      .executeTakeFirstOrThrow();
    if (Number(active.count) >= MAX_ACTIVE_PER_USER) {
      throw new ApplicationError('ERR_CONFLICT', `Đang có ${MAX_ACTIVE_PER_USER} tệp đang tạo; chờ xong rồi tạo tiếp`);
    }
    const created = await this.platform
      .insertInto('parent_org_exports')
      .values({
        user_id: user.id,
        admin_unit_id: unitId,
        unit_name: unit.name,
        categories: JSON.stringify(categories),
        layout,
        format,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await writeAudit(this.platform, {
      actorType: 'system',
      action: 'parent-org.export-requested',
      details: { user_id: user.id, export_id: created.id, unit_id: unitId, categories, layout, format },
    });
    void this.runDue().catch(() => undefined);
    return this.describe(created.id);
  }

  async list(request: Request) {
    const user = await this.data.user(request);
    const rows = await this.platform
      .selectFrom('parent_org_exports')
      .select(['id'])
      .where('user_id', '=', user.id)
      .orderBy('created_at', 'desc')
      .limit(30)
      .execute();
    return {
      background_available: this.storage !== null,
      retention_days: this.retentionDays,
      exports: await Promise.all(rows.map((row) => this.describe(row.id))),
    };
  }

  private async describe(id: string) {
    const row = await this.platform
      .selectFrom('parent_org_exports')
      .select([
        'id',
        'admin_unit_id',
        'unit_name',
        'categories',
        'layout',
        'format',
        'status',
        'file_name',
        'size_bytes',
        'error',
        'created_at',
        'finished_at',
        'expires_at',
      ])
      .where('id', '=', id)
      .executeTakeFirstOrThrow();
    return {
      ...row,
      layout_label: LAYOUT_LABELS[row.layout],
      category_labels: row.categories.map((key) => AGGREGATE_CATEGORY_LABELS[key]),
    };
  }

  async download(request: Request, id: string) {
    const user = await this.data.user(request);
    if (!UUID.test(id)) throw notFound();
    const row = await this.platform
      .selectFrom('parent_org_exports')
      .selectAll()
      .where('id', '=', id)
      .where('user_id', '=', user.id)
      .executeTakeFirst();
    const storage = this.storage;
    if (!row || !storage) throw notFound();
    if (row.status !== 'done' || !row.storage_key || !row.file_name) {
      throw new ApplicationError('ERR_CONFLICT', 'Tệp chưa tạo xong hoặc đã hết hạn');
    }
    const scope = await subtreeUnitIds(this.platform, user.unit_id);
    if (!scope.includes(row.admin_unit_id)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Đơn vị của tệp không còn thuộc phạm vi của bạn');
    }
    const body = await storage.get(row.storage_key);
    await writeAudit(this.platform, {
      actorType: 'system',
      action: 'parent-org.export-downloaded',
      details: { user_id: user.id, export_id: id },
    });
    return { body, fileName: row.file_name, contentType: CONTENT_TYPES[row.format] };
  }

  // Một lượt của việc định kỳ: dựng các việc chờ, xóa tệp quá hạn. Lượt đang chạy thì lượt gọi sau chờ lượt đó
  runDue(): Promise<{ built: number; expired: number }> {
    if (!this.running) {
      this.running = this.runOnce().finally(() => {
        this.running = null;
      });
    }
    return this.running;
  }

  private async runOnce(): Promise<{ built: number; expired: number }> {
    const storage = this.storage;
    if (!this.tenancy || !storage) return { built: 0, expired: 0 };
    let built = 0;
    for (;;) {
      const job = await this.claim();
      if (!job) break;
      await this.build(job.id, storage);
      built += 1;
    }
    return { built, expired: await this.expire(storage) };
  }

  private async claim(): Promise<{ id: string } | undefined> {
    const now = this.clock.now();
    const stale = new Date(now.getTime() - STALE_RUNNING_MS);
    const result = await sql<{ id: string }>`
      update parent_org_exports set status = 'running', started_at = ${now}, attempts = attempts + 1
      where id = (
        select id from parent_org_exports
        where (status = 'queued' or (status = 'running' and started_at < ${stale})) and attempts < ${MAX_ATTEMPTS}
        order by created_at
        limit 1
        for update skip locked
      )
      returning id`.execute(this.platform);
    if (result.rows[0]) return result.rows[0];
    // Việc đã thử đủ số lần mà vẫn dừng giữa chừng: ghi lỗi để người dùng tạo lại
    await this.platform
      .updateTable('parent_org_exports')
      .set({ status: 'failed', error: 'Không tạo được tệp sau nhiều lần thử', finished_at: now })
      .where('status', '=', 'running')
      .where('started_at', '<', stale)
      .where('attempts', '>=', MAX_ATTEMPTS)
      .execute();
    return undefined;
  }

  private async build(id: string, storage: FileStorage): Promise<void> {
    const job = await this.platform
      .selectFrom('parent_org_exports')
      .innerJoin('parent_org_users', 'parent_org_users.id', 'parent_org_exports.user_id')
      .innerJoin('admin_units as home', 'home.id', 'parent_org_users.admin_unit_id')
      .select([
        'parent_org_exports.admin_unit_id',
        'parent_org_exports.categories',
        'parent_org_exports.layout',
        'parent_org_exports.format',
        'parent_org_users.status as user_status',
        'parent_org_users.admin_unit_id as home_unit_id',
        'home.level',
      ])
      .where('parent_org_exports.id', '=', id)
      .executeTakeFirstOrThrow();
    try {
      // Kiểm lại lúc dựng: tài khoản bị khóa hoặc đơn vị ra khỏi phạm vi sau khi tạo việc thì không dựng
      const scope = await subtreeUnitIds(this.platform, job.home_unit_id);
      if (job.user_status !== 'active' || !scope.includes(job.admin_unit_id)) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Tài khoản bị khóa hoặc đơn vị không còn thuộc phạm vi');
      }
      const minGroup = this.configuration.parentOrgMinGroup ?? 5;
      const sheets = [];
      let unitCode = '';
      for (const category of job.categories) {
        const view = await aggregateForUnit(this.platform, job.admin_unit_id, job.level, category, minGroup);
        unitCode = view.unit.code;
        sheets.push(...aggregateSheets(view, job.layout, AGGREGATE_CATEGORY_LABELS[category]));
      }
      const now = this.clock.now();
      const buffer = await buildTableFile(job.format, sheets, now);
      const key = parentOrgExportKey(job.admin_unit_id, id, job.format);
      await storage.put(key, buffer, CONTENT_TYPES[job.format]);
      await this.platform
        .updateTable('parent_org_exports')
        .set({
          status: 'done',
          storage_key: key,
          file_name: `${job.layout === 'compare' ? 'so-sanh' : 'tong-hop'}-${unitCode}-${now.toISOString().slice(0, 10)}.${job.format}`,
          size_bytes: buffer.length,
          error: null,
          finished_at: now,
          expires_at: new Date(now.getTime() + this.retentionDays * 86_400_000),
        })
        .where('id', '=', id)
        .execute();
    } catch (caught) {
      await this.platform
        .updateTable('parent_org_exports')
        .set({
          status: 'failed',
          error: caught instanceof ApplicationError ? caught.message : 'Không tạo được tệp',
          finished_at: this.clock.now(),
        })
        .where('id', '=', id)
        .execute();
    }
  }

  private async expire(storage: FileStorage): Promise<number> {
    const due = await this.platform
      .selectFrom('parent_org_exports')
      .select(['id', 'storage_key'])
      .where('status', '=', 'done')
      .where('expires_at', '<=', this.clock.now())
      .limit(200)
      .execute();
    for (const row of due) {
      if (row.storage_key) await storage.delete(row.storage_key).catch(() => undefined);
      await this.platform
        .updateTable('parent_org_exports')
        .set({ status: 'expired', storage_key: null })
        .where('id', '=', row.id)
        .execute();
    }
    return due.length;
  }
}

@Controller('parent-org/exports')
@PublicEndpoint()
export class ParentOrgExportsController {
  constructor(private readonly exports: ParentOrgExportsService) {}

  @Get()
  list(@Req() request: Request) {
    return this.exports.list(request);
  }

  @Post()
  create(@Body() body: Record<string, unknown> | undefined, @Req() request: Request) {
    return this.exports.create(request, body);
  }

  @Get(':id/file')
  async file(@Param('id') id: string, @Req() request: Request, @Res() response: Response) {
    const file = await this.exports.download(request, id);
    response.setHeader('content-type', file.contentType);
    response.setHeader('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
    response.setHeader('cache-control', 'no-store');
    response.send(file.body);
  }
}
