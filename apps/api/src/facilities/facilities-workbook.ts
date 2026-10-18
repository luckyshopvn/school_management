import type { SchoolYearDatabase } from '@school-management/database';
import type { Response } from 'express';
import type { Kysely } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import { buildTableFile, CONTENT_TYPES, withExtension, type TableFileFormat } from '../exports/table-file.js';

// Tệp Excel của thiết bị dạy học, cơ sở vật chất và báo cáo EMIS (YCTD-102). Người xem được báo cáo thì xuất được; mỗi lần
// xuất ghi một dòng nhật ký xuất (BR-74) rồi mới trả tệp, tệp không lưu lại trên hệ thống. Từ DT-16 phần 16a dựng bằng tệp
// bảng dùng chung nên xuất được cả PDF
export const XLSX_TYPE = CONTENT_TYPES.xlsx;

export interface WorkbookColumn {
  key: string;
  label: string;
  width?: number;
}

export interface WorkbookSheet {
  title: string;
  // Dòng tiêu đề, ghi chú trên bảng (ví dụ tên trường, năm học)
  heading?: string[];
  columns: WorkbookColumn[];
  rows: Array<Record<string, unknown>>;
}

export interface ExportedFile {
  buffer: Buffer;
  fileName: string;
  logId: string;
  // Bỏ trống là Excel
  contentType?: string;
  rowCount?: number;
}

export async function buildFacilitiesWorkbook(input: {
  database: Kysely<SchoolYearDatabase>;
  currentUser: CurrentUser;
  reportCode: string;
  fileName: string;
  filters: Record<string, unknown>;
  orgUnitIds: string[];
  sheets: WorkbookSheet[];
  ipAddress: string | null;
  createdAt: Date;
  format?: TableFileFormat;
}): Promise<ExportedFile> {
  const format = input.format ?? 'xlsx';
  const buffer = await buildTableFile(format, input.sheets, input.createdAt);
  const rowCount = input.sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0);
  const fileName = withExtension(input.fileName, format);
  const log = await input.database
    .insertInto('export_logs')
    .values({
      user_id: input.currentUser.id,
      actor_name: input.currentUser.description.full_name,
      report_code: input.reportCode,
      filters_data: JSON.stringify(format === 'xlsx' ? input.filters : { ...input.filters, format }),
      org_unit_ids: input.orgUnitIds,
      row_count: rowCount,
      contains_personal_data: false,
      file_name: fileName,
      ip_address: input.ipAddress,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return { buffer, fileName, logId: log.id, contentType: CONTENT_TYPES[format], rowCount };
}

export function sendWorkbook(response: Response, file: ExportedFile): void {
  response.setHeader('content-type', file.contentType ?? XLSX_TYPE);
  response.setHeader('content-disposition', `attachment; filename="${file.fileName}"`);
  response.setHeader('x-export-log-id', file.logId);
  response.setHeader('cache-control', 'no-store');
  response.send(file.buffer);
}

export function fileStamp(date: Date): string {
  return date.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
}
