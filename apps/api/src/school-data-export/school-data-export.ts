import { randomUUID } from 'node:crypto';
import { Controller, Get, HttpCode, Injectable, Post, Req } from '@nestjs/common';
import { ApplicationError, Clock, readBearerToken, ruleViolationError } from '@school-management/server';
import type { Request } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { IdentityClient } from '../authentication/identity-client.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { storageKey } from '../common/resource-names.js';
import { ExportJobs, type ExportJobView } from '../exports/export-jobs.js';
import { FileStorage } from '../files/file-storage.js';
import { buildSchoolDataArchive, schoolArchiveSources } from './school-data-archive.js';

// Xuất toàn bộ dữ liệu của trường thành gói ZIP (DT-18 phần 18h, YCTD-145; tài liệu 32 mục 9.4: tác vụ xuất nền của 16a,
// ghi export_logs). Bấm xuất thì lấy ngay phần dữ liệu của dịch vụ định danh bằng mã phiên của người bấm (lưu tạm ở kho
// tệp), rồi tạo tác vụ nền; tiến trình nền dựng gói và lưu ở kho tệp. Chỉ người tạo tải được, hạn tải 48 giờ, mỗi lần tải
// ghi export_job_downloads. Màn hình hỏi lại danh sách tác vụ và báo khi gói đã xong. Mỗi người chỉ một gói đang tạo
export const SCHOOL_DATA_REPORT_CODE = 'school-data-zip';
export const SCHOOL_DATA_RULE_CODE = 'YCTD-145';
import { SCHOOL_DATA_RETENTION_HOURS } from '@school-management/shared';
const PERMISSION = 'P01.data.export-all';

export interface SchoolDataExportView extends ExportJobView {
  user_name: string;
  download_count: number;
  last_downloaded_at: Date | null;
}

@Injectable()
export class SchoolDataExportService {
  constructor(
    private readonly databases: Databases,
    private readonly fileStorage: FileStorage,
    private readonly identityClient: IdentityClient,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly exportJobs: ExportJobs,
    private readonly clock: Clock,
  ) {
    exportJobs.register(SCHOOL_DATA_REPORT_CODE, {
      title: 'Toàn bộ dữ liệu của trường',
      retentionHours: SCHOOL_DATA_RETENTION_HOURS,
      run: (currentUser, parameters, context) => this.build(currentUser, parameters, context.ipAddress),
    });
  }

  async request(currentUser: CurrentUser, accessToken: string, ipAddress: string | null): Promise<ExportJobView> {
    if (currentUser.description.impersonation) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Đang đăng nhập thay, không xuất toàn bộ dữ liệu được');
    }
    const running = await this.databases.system
      .selectFrom('export_jobs')
      .select('id')
      .where('report_code', '=', SCHOOL_DATA_REPORT_CODE)
      .where('user_id', '=', currentUser.id)
      .where('status', 'in', ['pending', 'running'])
      .executeTakeFirst();
    if (running) {
      throw ruleViolationError(SCHOOL_DATA_RULE_CODE, 'Đang tạo một gói dữ liệu, hãy chờ gói đó xong');
    }
    const snapshot = await this.identityClient.exportIdentityData(accessToken);
    const identityKey = storageKey('school-data-export', 'staging', randomUUID());
    await this.fileStorage.put(identityKey, Buffer.from(JSON.stringify(snapshot)), 'application/json');
    return this.exportJobs.queue(currentUser, SCHOOL_DATA_REPORT_CODE, { identity_key: identityKey }, 'zip', ipAddress);
  }

  // Các gói đã tạo của trường (ai tạo, lúc nào, số lần tải) cho người có quyền xuất toàn bộ dữ liệu
  async list(): Promise<SchoolDataExportView[]> {
    const rows = await this.databases.system
      .selectFrom('export_jobs')
      .leftJoin('export_job_downloads', 'export_job_downloads.export_job_id', 'export_jobs.id')
      .select((expression) => [
        'export_jobs.id',
        'export_jobs.report_code',
        'export_jobs.title',
        'export_jobs.format',
        'export_jobs.status',
        'export_jobs.row_count',
        'export_jobs.file_name',
        'export_jobs.size_bytes',
        'export_jobs.error_message',
        'export_jobs.created_at',
        'export_jobs.finished_at',
        'export_jobs.expires_at',
        'export_jobs.user_name',
        expression.fn.count<string>('export_job_downloads.id').as('download_count'),
        expression.fn.max('export_job_downloads.downloaded_at').as('last_downloaded_at'),
      ])
      .where('export_jobs.report_code', '=', SCHOOL_DATA_REPORT_CODE)
      .groupBy('export_jobs.id')
      .orderBy('export_jobs.created_at', 'desc')
      .limit(50)
      .execute();
    return rows.map((row) => ({ ...row, download_count: Number(row.download_count) }));
  }

  private async build(currentUser: CurrentUser, parameters: Record<string, unknown>, ipAddress: string | null) {
    const identityKey = typeof parameters.identity_key === 'string' ? parameters.identity_key : null;
    try {
      const identity = identityKey
        ? (JSON.parse((await this.fileStorage.get(identityKey)).toString('utf8')) as {
            tables: Record<string, Array<Record<string, unknown>>>;
          })
        : null;
      const now = this.clock.now();
      const archive = await buildSchoolDataArchive({
        sources: await schoolArchiveSources(this.databases),
        identityTables: identity?.tables,
        fileStorage: this.fileStorage,
        generatedAt: now,
        generatedBy: { user_id: currentUser.id, full_name: currentUser.description.full_name },
      });
      const fileName = `du-lieu-truong-${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now)}.zip`;
      // Nhật ký xuất ở năm học đang dùng (BR-74); chưa có năm học thì chỉ còn tác vụ xuất và nhật ký tải
      const current = await this.currentSchoolYear.find();
      const log = current
        ? await current.database
            .insertInto('export_logs')
            .values({
              user_id: currentUser.id,
              actor_name: currentUser.description.full_name,
              report_code: SCHOOL_DATA_REPORT_CODE,
              filters_data: JSON.stringify({ format: 'zip', tables: archive.manifest.tables.length }),
              org_unit_ids: [],
              row_count: archive.rowCount,
              contains_personal_data: true,
              file_name: fileName,
              ip_address: ipAddress,
            })
            .returning('id')
            .executeTakeFirstOrThrow()
        : { id: randomUUID() };
      return {
        buffer: archive.buffer,
        fileName,
        logId: log.id,
        contentType: 'application/zip',
        rowCount: archive.rowCount,
      };
    } finally {
      if (identityKey) {
        await this.fileStorage.delete(identityKey);
      }
    }
  }
}

@Controller('school-data-exports')
@RequirePermission(PERMISSION)
export class SchoolDataExportController {
  constructor(private readonly service: SchoolDataExportService) {}

  @Get()
  async list() {
    return { items: await this.service.list() };
  }

  @Post()
  @HttpCode(202)
  async request(@Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return {
      job: await this.service.request(currentUser, readBearerToken(request.header('authorization')), request.ip ?? null),
    };
  }
}
