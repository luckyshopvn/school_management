import { Injectable } from '@nestjs/common';
import { ApplicationError, validationError } from '@school-management/server';
import { Infrastructure } from '../common/infrastructure.js';
import { forbidden } from './account-authority.js';
import { AccountsService, type CallerContext } from './accounts.service.js';
import { writeIdentityAuditLog } from './identity-audit-log.js';

// Vai trò và ma trận quyền (P01-07); VT-01, VT-02 tạo vai trò và sửa quyền (PQ-13)
export interface RoleView {
  id: string;
  code: string;
  name: string;
  is_system: boolean;
  permissions: string[];
}

const ROLE_CODE_PATTERN = /^[A-Z0-9-]{2,20}$/;

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
    return { ...role, is_system: false, permissions: [] };
  }

  // Quyền mới có hiệu lực ở yêu cầu kế tiếp vì máy chủ API hỏi quyền hiện hành mỗi yêu cầu (QĐ-20, CTC-P01-041)
  async replacePermissions(caller: CallerContext, roleId: string, permissionCodes: string[]): Promise<RoleView> {
    await this.requireManageAll(caller);
    const before = (await this.readRoles()).find((role) => role.id === roleId);
    if (!before) {
      throw new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy vai trò', [{ field: 'entity', message: 'role' }]);
    }
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
    const after = (await this.readRoles()).find((role) => role.id === roleId);
    if (!after) {
      throw new ApplicationError('ERR_INTERNAL', 'Không đọc lại được vai trò');
    }
    return after;
  }

  private async requireManageAll(caller: CallerContext): Promise<void> {
    const { authority } = await this.accountsService.authority(caller);
    if (!authority.manageAll) {
      throw forbidden('Chỉ Hiệu trưởng và quản trị nền tảng sửa được vai trò và quyền');
    }
  }

  private async readRoles(): Promise<RoleView[]> {
    const rows = await this.database
      .selectFrom('roles')
      .leftJoin('role_permissions', 'role_permissions.role_id', 'roles.id')
      .leftJoin('permissions', 'permissions.id', 'role_permissions.permission_id')
      .select(['roles.id', 'roles.code', 'roles.name', 'roles.is_system', 'permissions.code as permission_code'])
      .orderBy('roles.code')
      .orderBy('permissions.code')
      .execute();
    const roles = new Map<string, RoleView>();
    for (const row of rows) {
      let role = roles.get(row.id);
      if (!role) {
        role = { id: row.id, code: row.code, name: row.name, is_system: row.is_system, permissions: [] };
        roles.set(row.id, role);
      }
      if (row.permission_code) {
        role.permissions.push(row.permission_code);
      }
    }
    return [...roles.values()];
  }
}
