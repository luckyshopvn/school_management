import { Injectable } from '@nestjs/common';
import { ApplicationError, ruleViolationError, validationError } from '@school-management/server';
import { PORTAL_WORKSPACES } from '@school-management/shared';
import { Infrastructure } from '../common/infrastructure.js';
import { forbidden } from './account-authority.js';
import { AccountsService, type CallerContext } from './accounts.service.js';
import { writeIdentityAuditLog } from './identity-audit-log.js';

// Vai trò và ma trận quyền (P01-07); VT-01, VT-02 tạo vai trò và sửa quyền (PQ-13). DT-16 phần 16d theo màn hình 1.1
// Nhóm người dùng, 1.2 Phân quyền nhóm theo phần mềm của Sở: sửa tên, hiệu lực, xóa nhóm chưa có người dùng, chọn phân hệ
// của cổng quản trị cho nhóm. Phân hệ chỉ quyết định ô chọn phân hệ và menu hiện gì; máy chủ vẫn kiểm tra quyền theo thao
// tác ở mọi yêu cầu (ma trận quyền ở 1.3)
export interface RoleView {
  id: string;
  code: string;
  name: string;
  is_system: boolean;
  is_active: boolean;
  // Số tài khoản đang gán nhóm này
  user_count: number;
  permissions: string[];
  // Phân hệ của cổng quản trị nhóm được dùng, theo thứ tự PORTAL_WORKSPACES
  workspaces: string[];
}

export const ROLE_RULE_CODE = 'YCTD-120';
const ROLE_CODE_PATTERN = /^[A-Z0-9-]{2,20}$/;
export const WORKSPACE_KEYS: string[] = PORTAL_WORKSPACES.map((workspace) => workspace.key);

@Injectable()
export class RolesService {
  constructor(
    private readonly infrastructure: Infrastructure,
    private readonly accountsService: AccountsService,
  ) {}

  private get database() {
    return this.infrastructure.database;
  }

  async listRoles(caller: CallerContext): Promise<RoleView[]> {
    await this.accountsService.authority(caller);
    return this.readRoles();
  }

  async listPermissions(caller: CallerContext) {
    await this.accountsService.authority(caller);
    return this.database
      .selectFrom('permissions')
      .select(['code', 'module_code', 'description'])
      .orderBy('module_code')
      .orderBy('code')
      .execute();
  }

  // Nhóm mới có hiệu lực và được dùng mọi phân hệ; chọn lại ở 1.2
  async createRole(caller: CallerContext, code: string, name: string): Promise<RoleView> {
    await this.requireManageAll(caller);
    if (!ROLE_CODE_PATTERN.test(code)) {
      throw validationError([
        { field: 'code', message: 'Mã vai trò gồm 2 đến 20 ký tự chữ in hoa, số hoặc dấu gạch ngang' },
      ]);
    }
    const existing = await this.database.selectFrom('roles').select('id').where('code', '=', code).executeTakeFirst();
    if (existing) {
      throw new ApplicationError('ERR_CONFLICT', 'Mã vai trò đã tồn tại', [{ field: 'code', message: existing.id }]);
    }
    const role = await this.database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('roles')
        .values({ code, name, is_system: false, created_by: caller.claims.userId })
        .returning(['id', 'code', 'name'])
        .executeTakeFirstOrThrow();
      await writeIdentityAuditLog(transaction, {
        actorUserId: caller.claims.userId,
        entityName: 'roles',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
        ipAddress: caller.ipAddress,
      });
      return created;
    });
    return { ...role, is_system: false, is_active: true, user_count: 0, permissions: [], workspaces: WORKSPACE_KEYS };
  }

  // Sửa tên và hiệu lực; mã nhóm không đổi. Nhóm hệ thống không ngừng hiệu lực được để không khóa người quản trị ra ngoài
  async updateRole(
    caller: CallerContext,
    roleId: string,
    changes: { name?: string; is_active?: boolean },
  ): Promise<RoleView> {
    await this.requireManageAll(caller);
    const before = await this.findRole(roleId);
    if (changes.is_active === false && before.is_system) {
      throw ruleViolationError(ROLE_RULE_CODE, 'Không ngừng hiệu lực được nhóm hệ thống');
    }
    await this.database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('roles')
        .set({ name: changes.name, is_active: changes.is_active, updated_at: new Date() })
        .where('id', '=', roleId)
        .execute();
      await writeIdentityAuditLog(transaction, {
        actorUserId: caller.claims.userId,
        entityName: 'roles',
        entityId: roleId,
        action: 'update',
        before: { name: before.name, is_active: before.is_active },
        after: { name: changes.name ?? before.name, is_active: changes.is_active ?? before.is_active },
        ipAddress: caller.ipAddress,
      });
    });
    return this.findRole(roleId);
  }

  // Xóa nhóm: không xóa nhóm hệ thống hoặc nhóm đang có người dùng (báo lỗi quy tắc); quyền, phân hệ của nhóm xóa theo
  async deleteRole(caller: CallerContext, roleId: string): Promise<void> {
    await this.requireManageAll(caller);
    const role = await this.findRole(roleId);
    if (role.is_system) {
      throw ruleViolationError(ROLE_RULE_CODE, `Không xóa được nhóm hệ thống ${role.code}`);
    }
    if (role.user_count > 0) {
      throw ruleViolationError(
        ROLE_RULE_CODE,
        `Nhóm ${role.code} đang có ${role.user_count} người dùng; gỡ nhóm khỏi các tài khoản hoặc ngừng hiệu lực thay vì xóa`,
      );
    }
    await this.database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('role_permissions').where('role_id', '=', roleId).execute();
      await transaction.deleteFrom('role_workspace_exclusions').where('role_id', '=', roleId).execute();
      await transaction.deleteFrom('roles').where('id', '=', roleId).execute();
      await writeIdentityAuditLog(transaction, {
        actorUserId: caller.claims.userId,
        entityName: 'roles',
        entityId: roleId,
        action: 'delete',
        before: { code: role.code, name: role.name, permissions: role.permissions, workspaces: role.workspaces },
        after: null,
        ipAddress: caller.ipAddress,
      });
    });
  }

  // 1.2 Phân quyền nhóm theo phần mềm: thay toàn bộ phân hệ nhóm được dùng; lưu phần bị bỏ để phân hệ thêm sau này mặc
  // định hiện với mọi nhóm
  async replaceWorkspaces(caller: CallerContext, roleId: string, workspaceKeys: string[]): Promise<RoleView> {
    await this.requireManageAll(caller);
    const unknown = workspaceKeys.filter((key) => !WORKSPACE_KEYS.includes(key));
    if (unknown.length > 0) {
      throw validationError(unknown.map((key) => ({ field: 'workspace_keys', message: `Không có phân hệ ${key}` })));
    }
    const before = await this.findRole(roleId);
    const allowed = new Set(workspaceKeys);
    const excluded = WORKSPACE_KEYS.filter((key) => !allowed.has(key));
    await this.database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('role_workspace_exclusions').where('role_id', '=', roleId).execute();
      if (excluded.length > 0) {
        await transaction
          .insertInto('role_workspace_exclusions')
          .values(excluded.map((key) => ({ role_id: roleId, workspace_key: key })))
          .execute();
      }
      await writeIdentityAuditLog(transaction, {
        actorUserId: caller.claims.userId,
        entityName: 'roles',
        entityId: roleId,
        action: 'replace_workspaces',
        before: { workspaces: before.workspaces },
        after: { workspaces: WORKSPACE_KEYS.filter((key) => allowed.has(key)) },
        ipAddress: caller.ipAddress,
      });
    });
    return this.findRole(roleId);
  }

  // Quyền mới có hiệu lực ở yêu cầu kế tiếp vì máy chủ API hỏi quyền hiện hành mỗi yêu cầu (QĐ-20, CTC-P01-041)
  async replacePermissions(caller: CallerContext, roleId: string, permissionCodes: string[]): Promise<RoleView> {
    await this.requireManageAll(caller);
    const before = await this.findRole(roleId);
    const uniqueCodes = [...new Set(permissionCodes)];
    const permissions = uniqueCodes.length
      ? await this.database.selectFrom('permissions').select(['id', 'code']).where('code', 'in', uniqueCodes).execute()
      : [];
    const unknown = uniqueCodes.filter((code) => !permissions.some((permission) => permission.code === code));
    if (unknown.length > 0) {
      throw validationError(unknown.map((code) => ({ field: 'permission_codes', message: `Không có quyền ${code}` })));
    }
    await this.database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('role_permissions').where('role_id', '=', roleId).execute();
      for (const permission of permissions) {
        await transaction
          .insertInto('role_permissions')
          .values({ role_id: roleId, permission_id: permission.id })
          .execute();
      }
      await writeIdentityAuditLog(transaction, {
        actorUserId: caller.claims.userId,
        entityName: 'roles',
        entityId: roleId,
        action: 'replace_permissions',
        before: { permissions: before.permissions },
        after: { permissions: [...uniqueCodes].sort() },
        ipAddress: caller.ipAddress,
      });
    });
    return this.findRole(roleId);
  }

  private async requireManageAll(caller: CallerContext): Promise<void> {
    const { authority } = await this.accountsService.authority(caller);
    if (!authority.manageAll) {
      throw forbidden('Chỉ Hiệu trưởng và quản trị nền tảng sửa được vai trò và quyền');
    }
  }

  private async findRole(roleId: string): Promise<RoleView> {
    const role = (await this.readRoles(roleId)).find((item) => item.id === roleId);
    if (!role) {
      throw new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy vai trò', [{ field: 'entity', message: 'role' }]);
    }
    return role;
  }

  private async readRoles(roleId?: string): Promise<RoleView[]> {
    let selection = this.database
      .selectFrom('roles')
      .leftJoin('role_permissions', 'role_permissions.role_id', 'roles.id')
      .leftJoin('permissions', 'permissions.id', 'role_permissions.permission_id')
      .select([
        'roles.id',
        'roles.code',
        'roles.name',
        'roles.is_system',
        'roles.is_active',
        'permissions.code as permission_code',
      ]);
    if (roleId) {
      selection = selection.where('roles.id', '=', roleId);
    }
    const rows = await selection.orderBy('roles.code').orderBy('permissions.code').execute();
    const roleIds = [...new Set(rows.map((row) => row.id))];
    const counts =
      roleIds.length > 0
        ? await this.database
            .selectFrom('user_roles')
            .select(['role_id', (expression) => expression.fn.count<string>('user_id').distinct().as('count')])
            .where('role_id', 'in', roleIds)
            .groupBy('role_id')
            .execute()
        : [];
    const exclusions =
      roleIds.length > 0
        ? await this.database
            .selectFrom('role_workspace_exclusions')
            .select(['role_id', 'workspace_key'])
            .where('role_id', 'in', roleIds)
            .execute()
        : [];
    const roles = new Map<string, RoleView>();
    for (const row of rows) {
      let role = roles.get(row.id);
      if (!role) {
        const excluded = new Set(
          exclusions.filter((item) => item.role_id === row.id).map((item) => item.workspace_key),
        );
        role = {
          id: row.id,
          code: row.code,
          name: row.name,
          is_system: row.is_system,
          is_active: row.is_active,
          user_count: Number(counts.find((item) => item.role_id === row.id)?.count ?? 0),
          permissions: [],
          workspaces: WORKSPACE_KEYS.filter((key) => !excluded.has(key)),
        };
        roles.set(row.id, role);
      }
      if (row.permission_code) {
        role.permissions.push(row.permission_code);
      }
    }
    return [...roles.values()];
  }
}
