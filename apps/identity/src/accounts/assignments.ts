import type { IdentityDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';

// Vai trò, đơn vị và quyền hiện hành của tài khoản
export interface AssignmentWithPermissions {
  assignment_id: string;
  role_code: string;
  role_name: string;
  org_unit_id: string | null;
  permissions: string[];
}

export async function loadAssignments(
  database: Kysely<IdentityDatabase>,
  userIds: string[],
): Promise<Map<string, AssignmentWithPermissions[]>> {
  const result = new Map<string, AssignmentWithPermissions[]>(userIds.map((id) => [id, []]));
  if (userIds.length === 0) {
    return result;
  }
  const rows = await database
    .selectFrom('user_roles')
    .innerJoin('roles', 'roles.id', 'user_roles.role_id')
    .leftJoin('role_permissions', 'role_permissions.role_id', 'roles.id')
    .leftJoin('permissions', 'permissions.id', 'role_permissions.permission_id')
    .select([
      'user_roles.user_id',
      'user_roles.id as assignment_id',
      'roles.code as role_code',
      'roles.name as role_name',
      'user_roles.org_unit_id',
      'permissions.code as permission_code',
    ])
    .where('user_roles.user_id', 'in', userIds)
    .orderBy('roles.code')
    .orderBy('permissions.code')
    .execute();

  const byAssignment = new Map<string, AssignmentWithPermissions>();
  for (const row of rows) {
    let assignment = byAssignment.get(row.assignment_id);
    if (!assignment) {
      assignment = {
        assignment_id: row.assignment_id,
        role_code: row.role_code,
        role_name: row.role_name,
        org_unit_id: row.org_unit_id,
        permissions: [],
      };
      byAssignment.set(row.assignment_id, assignment);
      result.get(row.user_id)?.push(assignment);
    }
    if (row.permission_code) {
      assignment.permissions.push(row.permission_code);
    }
  }
  return result;
}
