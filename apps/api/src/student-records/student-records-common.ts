import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Kysely, Transaction } from 'kysely';
import type { CurrentUser, OrganizationScope } from '../authentication/current-user.js';
import type { ExportedFile } from '../facilities/facilities-workbook.js';
import type { OrganizationScopes } from '../organization/organization-scopes.js';

// Dùng chung cho các chức năng hồ sơ học sinh theo hệ thống của Sở (DT-16 phần 16g)
export const STUDENT_RECORDS_RULE_CODE = 'YCTD-126';
export const BULK_LIMIT = 500;
export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

// Phạm vi đơn vị của người lập hoặc duyệt hồ sơ: gộp phạm vi của hai quyền người dùng có
export async function studentEditScope(
  organizationScopes: OrganizationScopes,
  currentUser: CurrentUser,
): Promise<OrganizationScope> {
  const codes = [PERMISSION_CODES.childManage, PERMISSION_CODES.childApprove].filter((code) =>
    currentUser.hasPermission(code),
  );
  const scopes = await Promise.all(codes.map((code) => organizationScopes.resolve(currentUser, code)));
  return {
    wholeSchool: scopes.some((scope) => scope.wholeSchool),
    orgUnitIds: [...new Set(scopes.flatMap((scope) => scope.orgUnitIds))],
  };
}

export const inScope = (scope: OrganizationScope, orgUnitId: string) =>
  scope.wholeSchool || scope.orgUnitIds.includes(orgUnitId);

export function assertInScope(scope: OrganizationScope, orgUnitId: string, message: string): void {
  if (!inScope(scope, orgUnitId)) {
    throw new ApplicationError('ERR_FORBIDDEN', message);
  }
}

// Tệp dựng riêng (không qua tệp bảng) vẫn ghi nhật ký xuất trước khi trả tệp (BR-74)
export async function logExportedFile(
  database: Executor,
  currentUser: CurrentUser,
  input: {
    reportCode: string;
    fileName: string;
    buffer: Buffer;
    rowCount: number;
    orgUnitIds: string[];
    filters: Record<string, unknown>;
    ipAddress: string | null;
    contentType?: string;
  },
): Promise<ExportedFile> {
  const log = await database
    .insertInto('export_logs')
    .values({
      user_id: currentUser.id,
      actor_name: currentUser.description.full_name,
      report_code: input.reportCode,
      filters_data: JSON.stringify(input.filters),
      org_unit_ids: input.orgUnitIds,
      row_count: input.rowCount,
      contains_personal_data: true,
      file_name: input.fileName,
      ip_address: input.ipAddress,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return {
    buffer: input.buffer,
    fileName: input.fileName,
    logId: log.id,
    contentType: input.contentType ?? XLSX_TYPE,
    rowCount: input.rowCount,
  };
}
