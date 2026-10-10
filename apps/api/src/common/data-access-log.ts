import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import type { ChangeOrigin } from './audit-log.js';

// Nhật ký truy cập dữ liệu nhạy cảm; xem đầy đủ số định danh và giấy khai sinh luôn ghi, không tắt được (BR-73, BR-81)
export async function writeDataAccessLog(
  database: Kysely<SchoolYearDatabase>,
  entry: { origin: ChangeOrigin; orgUnitId: string; entityName: string; entityId: string; scope: string },
): Promise<void> {
  await database
    .insertInto('data_access_logs')
    .values({
      actor_user_id: entry.origin.actorUserId,
      actor_name: entry.origin.actorName,
      org_unit_id: entry.orgUnitId,
      entity_name: entry.entityName,
      entity_id: entry.entityId,
      scope: entry.scope,
      ip_address: entry.origin.ipAddress,
    })
    .execute();
}
