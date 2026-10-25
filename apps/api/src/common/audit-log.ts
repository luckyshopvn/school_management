import type { SchoolYearDatabase } from '@school-management/database';
import type { Request } from 'express';
import type { Kysely, Transaction } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';

// Người thực hiện thao tác, ghi vào nhật ký thao tác kèm tên tại thời điểm thao tác
export interface ChangeOrigin {
  actorUserId: string;
  actorName: string;
  ipAddress: string | null;
}

export function originOf(request: Request, currentUser: CurrentUser): ChangeOrigin {
  return { actorUserId: currentUser.id, actorName: actorNameOf(currentUser), ipAddress: request.ip ?? null };
}

// Đang đăng nhập thay thì tên người thực hiện ghi kèm người đăng nhập thay (DT-18 phần 18h)
export function actorNameOf(currentUser: CurrentUser): string {
  const impersonation = currentUser.description.impersonation;
  // Phiên hỗ trợ của nhân viên nền tảng (DT-SaaS phần S4): ghi kèm tên nhân viên
  const support = currentUser.description.support;
  if (support) {
    return `${currentUser.description.full_name} (${support.operator_name})`;
  }
  return impersonation
    ? `${currentUser.description.full_name} (đăng nhập thay bởi ${impersonation.impersonator_name})`
    : currentUser.description.full_name;
}

// Mọi thao tác thay đổi dữ liệu ghi nhật ký thao tác kèm giá trị trước và sau (QU-04, PQ-05)
export interface AuditLogEntry {
  origin: ChangeOrigin;
  orgUnitId: string | null;
  entityName: string;
  entityId: string;
  action: 'create' | 'update' | 'delete';
  before: unknown;
  after: unknown;
}

export async function writeAuditLog(
  executor: Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>,
  entry: AuditLogEntry,
): Promise<void> {
  await executor
    .insertInto('audit_logs')
    .values({
      actor_user_id: entry.origin.actorUserId,
      actor_name: entry.origin.actorName,
      org_unit_id: entry.orgUnitId,
      entity_name: entry.entityName,
      entity_id: entry.entityId,
      action: entry.action,
      before_data: entry.before === null || entry.before === undefined ? null : JSON.stringify(entry.before),
      after_data: entry.after === null || entry.after === undefined ? null : JSON.stringify(entry.after),
      ip_address: entry.origin.ipAddress,
    })
    .execute();
}
