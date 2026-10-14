import type { SchoolYearDatabase } from '@school-management/database';
import ExcelJS from 'exceljs';
import type { Kysely } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import type { ExportedFile } from '../facilities/facilities-workbook.js';

export { fileStamp, sendWorkbook } from '../facilities/facilities-workbook.js';

// Tệp Excel của danh sách học sinh và biến động học sinh (DT-15 phần 15c, YCTD-108): một bảng tính có dòng tiêu đề, cột
// theo thứ tự người dùng chọn. Tệp có tên học sinh nên ghi nhật ký xuất có dữ liệu cá nhân trước khi trả tệp (BR-74); tệp
// không lưu lại trên hệ thống
export async function buildStudentWorkbook(input: {
  database: Kysely<SchoolYearDatabase>;
  currentUser: CurrentUser;
  reportCode: string;
  title: string;
  fileName: string;
  filters: Record<string, unknown>;
  orgUnitIds: string[];
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, unknown>>;
  ipAddress: string | null;
  createdAt: Date;
}): Promise<ExportedFile> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'School Management';
  workbook.created = input.createdAt;
  const worksheet = workbook.addWorksheet(input.title.slice(0, 31));
  worksheet.addRow(['STT', ...input.columns.map((column) => column.label)]).font = { bold: true };
  input.rows.forEach((row, index) => {
    worksheet.addRow([index + 1, ...input.columns.map((column) => row[column.key] ?? '')]);
  });
  worksheet.getColumn(1).width = 6;
  input.columns.forEach((_column, index) => {
    worksheet.getColumn(index + 2).width = 22;
  });
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const log = await input.database
    .insertInto('export_logs')
    .values({
      user_id: input.currentUser.id,
      actor_name: input.currentUser.description.full_name,
      report_code: input.reportCode,
      filters_data: JSON.stringify(input.filters),
      org_unit_ids: input.orgUnitIds,
      row_count: input.rows.length,
      contains_personal_data: true,
      file_name: input.fileName,
      ip_address: input.ipAddress,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return { buffer, fileName: input.fileName, logId: log.id };
}
