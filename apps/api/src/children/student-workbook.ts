import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import { buildTableFile, CONTENT_TYPES, withExtension, type TableFileFormat } from '../exports/table-file.js';
import type { ExportedFile } from '../facilities/facilities-workbook.js';

export { fileStamp, sendWorkbook } from '../facilities/facilities-workbook.js';

// Tệp Excel của danh sách học sinh và biến động học sinh (DT-15 phần 15c, YCTD-108): một bảng tính có dòng tiêu đề, cột
// theo thứ tự người dùng chọn. Tệp có tên học sinh nên ghi nhật ký xuất có dữ liệu cá nhân trước khi trả tệp (BR-74); tệp
// không lưu lại trên hệ thống. Xuất PDF (DT-16 phần 16a) cùng cột, cùng dòng, cùng cách ghi nhật ký
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
  format?: TableFileFormat;
}): Promise<ExportedFile> {
  const format = input.format ?? 'xlsx';
  const buffer = await buildTableFile(
    format,
    [{ title: input.title, heading: format === 'pdf' ? [input.title] : undefined, columns: input.columns, rows: input.rows, numbered: true }],
    input.createdAt,
  );
  const fileName = withExtension(input.fileName, format);
  const log = await input.database
    .insertInto('export_logs')
    .values({
      user_id: input.currentUser.id,
      actor_name: input.currentUser.description.full_name,
      report_code: input.reportCode,
      filters_data: JSON.stringify(format === 'xlsx' ? input.filters : { ...input.filters, format }),
      org_unit_ids: input.orgUnitIds,
      row_count: input.rows.length,
      contains_personal_data: true,
      file_name: fileName,
      ip_address: input.ipAddress,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return { buffer, fileName, logId: log.id, contentType: CONTENT_TYPES[format], rowCount: input.rows.length };
}
