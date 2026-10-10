import type { IdentityDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import { forbidden } from './account-authority.js';
import type { CallerContext } from './accounts.service.js';
import { loadAssignments } from './assignments.js';
import type { OrganizationDirectory } from './organization-directory.js';

// Người gọi phải có một trong các quyền ở đơn vị đó; gán ở Trường chính hoặc toàn trường thì có phạm vi toàn trường (QĐ-23)
export async function assertPermissionAtUnit(
  database: Kysely<IdentityDatabase>,
  organizationDirectory: OrganizationDirectory,
  caller: CallerContext,
  permissionCodes: string[],
  orgUnitId: string,
  deniedMessage: string,
): Promise<{ rootId: string | null }> {
  const assignments = (await loadAssignments(database, [caller.claims.userId])).get(caller.claims.userId) ?? [];
  const holders = assignments.filter((assignment) =>
    assignment.permissions.some((permission) => permissionCodes.includes(permission)),
  );
  if (holders.length === 0) {
    throw forbidden(deniedMessage);
  }
  const rootId =
    (await organizationDirectory.listUnits(caller.accessToken)).find((unit) => unit.unit_type === 'truong_chinh')?.id ??
    null;
  const wholeSchool = holders.some(
    (assignment) => assignment.org_unit_id === null || assignment.org_unit_id === rootId,
  );
  if (!wholeSchool && !holders.some((assignment) => assignment.org_unit_id === orgUnitId)) {
    throw forbidden('Đơn vị này nằm ngoài phạm vi của bạn');
  }
  return { rootId };
}
