import {
  Controller,
  Get,
  Inject,
  Injectable,
  Logger,
  Param,
  Res,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { ExportJobFormat, ExportJobStatus } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError } from '@school-management/server';
import type { Response } from 'express';
import { sql } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import { CurrentUser, type CurrentUserDescription } from '../authentication/current-user.js';
import { API_CONFIGURATION, type ApiConfiguration } from '../common/configuration.js';
import { Databases } from '../common/databases.js';
import { notFoundError } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { sendWorkbook, type ExportedFile } from '../facilities/facilities-workbook.js';
import { FileStorage } from '../files/file-storage.js';
import type { TableFileFormat } from './table-file.js';

// Tác vụ xuất nền và "Tệp đã tạo" (DT-16 phần 16a, khảo sát mục 2.3 của Sở: "xuất tệp lớn tạo tác vụ, danh sách Tệp đã
// tạo"). Lần xuất vượt số dòng xuất trực tiếp (mặc định 10 000) không báo lỗi mà tạo tác vụ; tiến trình nền chạy trong máy
// chủ API như tiến trình gửi thông báo, nhận từng tác vụ bằng khóa dòng (nhiều máy chủ không nhận trùng), dựng tệp bằng
// đúng hàm xuất của màn hình với vai trò, quyền của người tạo tại thời điểm tạo (vẫn ghi nhật ký xuất, BR-74), lưu tệp ở kho
// tệp. Chỉ người tạo xem và tải tệp của mình; tệp giữ 7 ngày rồi xóa khỏi kho tệp, tác vụ chuyển "Hết hạn"
export const EXPORT_RULE_CODE = 'YCTD-121';
export const DEFAULT_SYNC_EXPORT_ROW_LIMIT = 10_000;
// Tác vụ nền cũng có giới hạn để một tệp không làm chậm cả máy chủ
export const BACKGROUND_EXPORT_ROW_LIMIT = 200_000;
export const EXPORT_FILE_RETENTION_DAYS = 7;
// Tác vụ đang chạy quá 30 phút coi như bị gián đoạn (máy chủ khởi động lại)
const STALE_RUNNING_MILLISECONDS = 30 * 60_000;
const MAXIMUM_ATTEMPTS = 3;
const LIST_LIMIT = 100;
const DAY_MILLISECONDS = 24 * 60 * 60_000;

export interface ExportRequestContext {
  format: TableFileFormat;
  ipAddress: string | null;
  // Số dòng tối đa của lần xuất này; hàm xuất vượt thì báo lỗi
  rowLimit: number;
}

// Màn hình đăng ký hàm xuất theo mã báo cáo để tiến trình nền gọi lại với cùng tham số
export interface ExportJobHandler {
  title: string;
  run(
    currentUser: CurrentUser,
    parameters: Record<string, unknown>,
    context: ExportRequestContext,
  ): Promise<ExportedFile>;
}

export interface ExportJobView {
  id: string;
  report_code: string;
  title: string;
  format: ExportJobFormat;
  status: ExportJobStatus;
  row_count: number | null;
  file_name: string | null;
  size_bytes: number | null;
  error_message: string | null;
  created_at: Date;
  finished_at: Date | null;
  expires_at: Date | null;
}

// Kết quả của một lần bấm Xuất: tệp trả ngay, hoặc tác vụ nền khi danh sách lớn
export type ExportOutcome = { kind: 'file'; file: ExportedFile } | { kind: 'job'; job: ExportJobView };

const JOB_COLUMNS = [
  'id',
  'report_code',
  'title',
  'format',
  'status',
  'row_count',
  'file_name',
  'size_bytes',
  'error_message',
  'created_at',
  'finished_at',
  'expires_at',
] as const;

// Lỗi vượt số dòng của hàm xuất trực tiếp; dịch vụ tác vụ bắt lỗi này để tạo tác vụ nền
export class ExportTooLargeError extends Error {
  constructor(readonly total: number) {
    super(`Danh sách có ${total} dòng, vượt số dòng xuất trực tiếp`);
  }
}

// Gửi kết quả xuất: tệp thì trả tệp, tác vụ thì trả 202 kèm tác vụ để màn hình báo "đang tạo tệp, xem ở Tệp đã tạo"
export function sendExportOutcome(response: Response, outcome: ExportOutcome): void {
  if (outcome.kind === 'file') {
    sendWorkbook(response, outcome.file);
    return;
  }
  response.status(202).json({ job: outcome.job });
}

@Injectable()
export class ExportJobs implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('ExportJobs');
  private readonly handlers = new Map<string, ExportJobHandler>();
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(API_CONFIGURATION) private readonly configuration: ApiConfiguration,
    private readonly databases: Databases,
    private readonly fileStorage: FileStorage,
    private readonly clock: Clock,
  ) {}

  get syncRowLimit(): number {
    return this.configuration.syncExportRowLimit ?? DEFAULT_SYNC_EXPORT_ROW_LIMIT;
  }

  register(reportCode: string, handler: ExportJobHandler): void {
    this.handlers.set(reportCode, handler);
  }

  onApplicationBootstrap() {
    const seconds = this.configuration.exportJobIntervalSeconds ?? 15;
    if (seconds > 0) {
      this.timer = setInterval(() => void this.tick(), seconds * 1000);
      this.timer.unref();
    }
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  // Xuất trực tiếp; danh sách vượt số dòng xuất trực tiếp thì tạo tác vụ nền với cùng tham số
  async exportOrQueue(
    currentUser: CurrentUser,
    reportCode: string,
    parameters: Record<string, unknown>,
    format: TableFileFormat,
    ipAddress: string | null,
  ): Promise<ExportOutcome> {
    const handler = this.requireHandler(reportCode);
    try {
      const file = await handler.run(currentUser, parameters, { format, ipAddress, rowLimit: this.syncRowLimit });
      return { kind: 'file', file };
    } catch (error) {
      if (!(error instanceof ExportTooLargeError)) {
        throw error;
      }
      if (error.total > BACKGROUND_EXPORT_ROW_LIMIT) {
        throw ruleViolationError(
          EXPORT_RULE_CODE,
          `Danh sách có ${error.total} dòng, vượt ${BACKGROUND_EXPORT_ROW_LIMIT} dòng của tác vụ xuất nền; hãy thu hẹp bộ lọc`,
        );
      }
      return {
        kind: 'job',
        job: await this.create(currentUser, reportCode, handler.title, parameters, format, ipAddress),
      };
    }
  }

  private async create(
    currentUser: CurrentUser,
    reportCode: string,
    title: string,
    parameters: Record<string, unknown>,
    format: TableFileFormat,
    ipAddress: string | null,
  ): Promise<ExportJobView> {
    return this.databases.system
      .insertInto('export_jobs')
      .values({
        user_id: currentUser.id,
        user_name: currentUser.description.full_name,
        user_snapshot: JSON.stringify(currentUser.description),
        report_code: reportCode,
        title,
        format,
        parameters: JSON.stringify(parameters),
        ip_address: ipAddress,
      })
      .returning(JOB_COLUMNS)
      .executeTakeFirstOrThrow();
  }

  // "Tệp đã tạo" của người đang đăng nhập, mới nhất trước
  list(currentUser: CurrentUser): Promise<ExportJobView[]> {
    return this.databases.system
      .selectFrom('export_jobs')
      .select(JOB_COLUMNS)
      .where('user_id', '=', currentUser.id)
      .orderBy('created_at', 'desc')
      .limit(LIST_LIMIT)
      .execute();
  }

  async download(currentUser: CurrentUser, jobId: string): Promise<ExportedFile> {
    const job = await this.databases.system
      .selectFrom('export_jobs')
      .selectAll()
      .where('id', '=', jobId)
      .where('user_id', '=', currentUser.id)
      .executeTakeFirst();
    if (!job) {
      throw notFoundError('Không tìm thấy tệp đã tạo', 'export_job');
    }
    const expired = job.status === 'expired' || (job.expires_at !== null && job.expires_at <= this.clock.now());
    if (job.status !== 'done' || expired || !job.storage_key || !job.file_name) {
      throw ruleViolationError(
        EXPORT_RULE_CODE,
        expired ? 'Tệp đã hết hạn tải về; hãy xuất lại' : 'Tệp chưa tạo xong hoặc tạo lỗi, chưa tải về được',
      );
    }
    return {
      buffer: await this.fileStorage.get(job.storage_key),
      fileName: job.file_name,
      logId: job.id,
      contentType: job.content_type ?? undefined,
    };
  }

  // Một lượt của tiến trình nền: xóa tệp hết hạn, trả tác vụ bị gián đoạn, chạy các tác vụ đang chờ; lượt trước chưa xong
  // thì bỏ qua lượt này
  async tick(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      await this.expireFiles();
      await this.recoverStale();
      for (;;) {
        const job = await this.claim();
        if (!job) {
          break;
        }
        await this.runJob(job);
      }
    } catch (error) {
      this.logger.error('Tiến trình xuất nền lỗi', error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }

  private async claim() {
    const now = this.clock.now();
    const result = await sql<{
      id: string;
      report_code: string;
      format: ExportJobFormat;
      parameters: Record<string, unknown>;
      user_snapshot: CurrentUserDescription;
      ip_address: string | null;
    }>`update export_jobs set status = 'running', started_at = ${now}, attempts = attempts + 1
      where id = (
        select id from export_jobs where status = 'pending' order by created_at limit 1 for update skip locked
      )
      returning id, report_code, format, parameters, user_snapshot, ip_address`.execute(this.databases.system);
    return result.rows[0];
  }

  private async runJob(job: NonNullable<Awaited<ReturnType<ExportJobs['claim']>>>): Promise<void> {
    const handler = this.handlers.get(job.report_code);
    try {
      if (!handler) {
        throw new Error('Không có hàm xuất cho loại tệp này');
      }
      const file = await handler.run(new CurrentUser(job.user_snapshot), job.parameters, {
        format: job.format,
        ipAddress: job.ip_address,
        rowLimit: BACKGROUND_EXPORT_ROW_LIMIT,
      });
      const storageKey = `export/${job.id}`;
      const contentType = file.contentType ?? 'application/octet-stream';
      await this.fileStorage.put(storageKey, file.buffer, contentType);
      const finishedAt = this.clock.now();
      await this.databases.system
        .updateTable('export_jobs')
        .set({
          status: 'done',
          storage_key: storageKey,
          file_name: file.fileName,
          content_type: contentType,
          size_bytes: file.buffer.length,
          row_count: file.rowCount ?? null,
          finished_at: finishedAt,
          expires_at: new Date(finishedAt.getTime() + EXPORT_FILE_RETENTION_DAYS * DAY_MILLISECONDS),
          error_message: null,
        })
        .where('id', '=', job.id)
        .execute();
    } catch (error) {
      this.logger.warn(`Tác vụ xuất ${job.id} lỗi: ${error instanceof Error ? error.message : String(error)}`);
      await this.databases.system
        .updateTable('export_jobs')
        .set({
          status: 'failed',
          finished_at: this.clock.now(),
          // Thông báo lỗi nghiệp vụ hiện cho người dùng; lỗi khác chỉ ghi chung để không lộ chi tiết máy chủ
          error_message:
            error instanceof ExportTooLargeError || error instanceof ApplicationError
              ? error.message.slice(0, 500)
              : 'Không tạo được tệp, vui lòng thử xuất lại',
        })
        .where('id', '=', job.id)
        .execute();
    }
  }

  private async recoverStale(): Promise<void> {
    const before = new Date(this.clock.now().getTime() - STALE_RUNNING_MILLISECONDS);
    // Còn lượt thử thì chạy lại, hết lượt thì báo lỗi
    await this.databases.system
      .updateTable('export_jobs')
      .set({ status: 'pending' })
      .where('status', '=', 'running')
      .where('started_at', '<', before)
      .where('attempts', '<', MAXIMUM_ATTEMPTS)
      .execute();
    await this.databases.system
      .updateTable('export_jobs')
      .set({ status: 'failed', finished_at: this.clock.now(), error_message: 'Tác vụ bị gián đoạn, vui lòng xuất lại' })
      .where('status', '=', 'running')
      .where('started_at', '<', before)
      .execute();
  }

  private async expireFiles(): Promise<void> {
    const expired = await this.databases.system
      .selectFrom('export_jobs')
      .select(['id', 'storage_key'])
      .where('status', '=', 'done')
      .where('expires_at', '<=', this.clock.now())
      .execute();
    for (const job of expired) {
      if (job.storage_key) {
        await this.fileStorage.delete(job.storage_key);
      }
      await this.databases.system
        .updateTable('export_jobs')
        .set({ status: 'expired', storage_key: null })
        .where('id', '=', job.id)
        .execute();
    }
  }

  private requireHandler(reportCode: string): ExportJobHandler {
    const handler = this.handlers.get(reportCode);
    if (!handler) {
      throw new Error(`Chưa đăng ký hàm xuất ${reportCode}`);
    }
    return handler;
  }
}

// "Tệp đã tạo": mọi người đăng nhập xem và tải tệp xuất nền của chính mình
@Controller('export-jobs')
export class ExportJobsController {
  constructor(private readonly exportJobs: ExportJobs) {}

  @Get()
  async list(@AuthenticatedUser() currentUser: CurrentUser) {
    return { items: await this.exportJobs.list(currentUser) };
  }

  @Get(':id/file')
  async download(
    @Param('id', uuidParameter('Mã tác vụ không hợp lệ')) jobId: string,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    sendWorkbook(response, await this.exportJobs.download(currentUser, jobId));
  }
}
