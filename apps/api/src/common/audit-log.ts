import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely, Transaction } from 'kysely';

// Mọi thao tác thay đổi dữ liệu ghi nhật ký thao tác kèm giá trị trước và sau (QU-04, PQ-05)
export interface AuditLogEntry {
  actorUserId: string;
  orgUnitId: string | null;
  entityName: string;
  entityId: string;
  action: 'create' | 'update';
  before: unknown;
  after: unknown;
  ipAddress: string | null;
}

export async function writeAuditLog(
  executor: Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>,
  entry: AuditLogEntry,
): Promise<void> {
  await executor
    .insertInto('audit_logs')
    .values({
      actor_user_id: entry.actorUserId,
      org_unit_id: entry.orgUnitId,
      entity_name: entry.entityName,
      entity_id: entry.entityId,
      action: entry.action,
      before_data: entry.before === null || entry.before === undefined ? null : JSON.stringify(entry.before),
      after_data: entry.after === null || entry.after === undefined ? null : JSON.stringify(entry.after),
      ip_address: entry.ipAddress,
    })
    .execute();
}
