import { ApplicationError } from '@school-management/server';
import { PERMISSION_CODES, ROLE_CODES_RESERVED_FOR_PRINCIPAL } from '@school-management/shared';
import type { AssignmentWithPermissions } from './assignments.js';
import type { OrgUnitSummary } from './organization-directory.js';

// Quyền quản lý tài khoản của người đang thao tác (PQ-13)
export interface AccountAuthority {
  actorUserId: string;
  // VT-01, VT-02: quản lý mọi tài khoản, gán vai trò, sửa ma trận quyền
  manageAll: boolean;
  // VT-03: chỉ trong các đơn vị được gán; gán ở Trường chính là toàn trường
  manageInUnitWholeSchool: boolean;
  manageInUnitIds: Set<string>;
}

export function forbidden(message: string): ApplicationError {
  return new ApplicationError('ERR_FORBIDDEN', message);
}

export function resolveAuthority(
  actorUserId: string,
  assignments: AssignmentWithPermissions[],
  units: OrgUnitSummary[] | null,
): AccountAuthority {
  const manageAll = assignments.some((assignment) => assignment.permissions.includes(PERMISSION_CODES.accountManage));
  const inUnit = assignments.filter((assignment) =>
    assignment.permissions.includes(PERMISSION_CODES.accountManageInUnit),
  );
  const rootId = units?.find((unit) => unit.unit_type === 'truong_chinh')?.id;
  return {
    actorUserId,
    manageAll,
    manageInUnitWholeSchool: inUnit.some(
      (assignment) => assignment.org_unit_id === null || assignment.org_unit_id === rootId,
    ),
    manageInUnitIds: new Set(
      inUnit.map((assignment) => assignment.org_unit_id).filter((id): id is string => id !== null),
    ),
  };
}

export function hasAnyAccountAuthority(authority: AccountAuthority): boolean {
  return authority.manageAll || authority.manageInUnitWholeSchool || authority.manageInUnitIds.size > 0;
}

function unitInScope(authority: AccountAuthority, orgUnitId: string | null): boolean {
  if (authority.manageAll || authority.manageInUnitWholeSchool) {
    return true;
  }
  return orgUnitId !== null && authority.manageInUnitIds.has(orgUnitId);
}

// Người thao tác được cấp một vai trò ở một đơn vị khi tạo tài khoản không (PQ-13)
export function canGrantOnCreate(authority: AccountAuthority, roleCode: string, orgUnitId: string | null): boolean {
  if (authority.manageAll) {
    return true;
  }
  if ((ROLE_CODES_RESERVED_FOR_PRINCIPAL as readonly string[]).includes(roleCode)) {
    return false;
  }
  return unitInScope(authority, orgUnitId);
}

// Người thao tác quản lý được tài khoản đích không: VT-03 chỉ quản lý tài khoản có mọi vai trò nằm trong đơn vị của mình
export function canManageAccount(authority: AccountAuthority, targetAssignments: AssignmentWithPermissions[]): boolean {
  if (authority.manageAll) {
    return true;
  }
  if (targetAssignments.length === 0) {
    return false;
  }
  return targetAssignments.every(
    (assignment) =>
      !(ROLE_CODES_RESERVED_FOR_PRINCIPAL as readonly string[]).includes(assignment.role_code) &&
      unitInScope(authority, assignment.org_unit_id),
  );
}
