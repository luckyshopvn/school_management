import type { SchoolYearDatabase } from '@school-management/database';
import ExcelJS from 'exceljs';
import type { Response } from 'express';
import type { Kysely } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';

// Tệp Excel của thiết bị dạy học, cơ sở vật chất và báo cáo EMIS (YCTD-102). Người xem được báo cáo thì xuất được; mỗi lần
// xuất ghi một dòng nhật ký xuất (BR-74) rồi mới trả tệp, tệp không lưu lại trên hệ thống
export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

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
}): Promise<ExportedFile> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'School Management';
  workbook.created = input.createdAt;
  let rowCount = 0;
  for (const sheet of input.sheets) {
    // Tên bảng tính tối đa 31 ký tự, không có ký tự đặc biệt
    const worksheet = workbook.addWorksheet(sheet.title.replace(/[\\/*?:[\]]/g, ' ').slice(0, 31));
    for (const line of sheet.heading ?? []) {
      worksheet.addRow([line]).font = { bold: true };
    }
    if (sheet.heading?.length) {
      worksheet.addRow([]);
    }
    const header = worksheet.addRow(sheet.columns.map((column) => column.label));
    header.font = { bold: true };
    for (const row of sheet.rows) {
      worksheet.addRow(sheet.columns.map((column) => row[column.key] ?? ''));
    }
    rowCount += sheet.rows.length;
    sheet.columns.forEach((column, index) => {
      worksheet.getColumn(index + 1).width = column.width ?? 18;
    });
  }
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const log = await input.database
    .insertInto('export_logs')
    .values({
      user_id: input.currentUser.id,
      actor_name: input.currentUser.description.full_name,
      report_code: input.reportCode,
      filters_data: JSON.stringify(input.filters),
      org_unit_ids: input.orgUnitIds,
      row_count: rowCount,
      contains_personal_data: false,
      file_name: input.fileName,
      ip_address: input.ipAddress,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return { buffer, fileName: input.fileName, logId: log.id };
}

export function sendWorkbook(response: Response, file: ExportedFile): void {
  response.setHeader('content-type', XLSX_TYPE);
  response.setHeader('content-disposition', `attachment; filename="${file.fileName}"`);
  response.setHeader('x-export-log-id', file.logId);
  response.setHeader('cache-control', 'no-store');
  response.send(file.buffer);
}

export function fileStamp(date: Date): string {
  return date.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
}
