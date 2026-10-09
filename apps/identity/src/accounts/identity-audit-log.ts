import type { IdentityDatabase } from '@school-management/database';
import type { Kysely, Transaction } from 'kysely';

// Nhật ký thao tác của dịch vụ định danh kèm giá trị trước và sau (PQ-05, YCTD-39)
export interface IdentityAuditEntry {
  actorUserId: string;
  entityName: 'users' | 'user_roles' | 'roles' | 'identity_settings';
  entityId: string;
  action: string;
  before: unknown;
  after: unknown;
  ipAddress: string | null;
}

export async function writeIdentityAuditLog(
  executor: Kysely<IdentityDatabase> | Transaction<IdentityDatabase>,
  entry: IdentityAuditEntry,
): Promise<void> {
  // Ghi kèm tên người thực hiện tại thời điểm thao tác để tra nhật ký không phụ thuộc tài khoản về sau
  const actor = await executor
    .selectFrom('users')
    .select('full_name')
    .where('id', '=', entry.actorUserId)
    .executeTakeFirst();
  await executor
    .insertInto('identity_audit_logs')
    .values({
      actor_user_id: entry.actorUserId,
      actor_name: actor?.full_name ?? null,
      entity_name: entry.entityName,
      entity_id: entry.entityId,
      action: entry.action,
      before_data: entry.before === null || entry.before === undefined ? null : JSON.stringify(entry.before),
      after_data: entry.after === null || entry.after === undefined ? null : JSON.stringify(entry.after),
      ip_address: entry.ipAddress,
    })
    .execute();
}
