import { Injectable } from '@nestjs/common';
import type { IdentityDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  validationError,
  type AccessTokenClaims,
  type FieldError,
} from '@school-management/server';
import { WHOLE_SCHOOL_ROLE_CODES } from '@school-management/shared';
import type { Transaction } from 'kysely';
import { hashPassword } from '../authentication/password.js';
import { Infrastructure } from '../common/infrastructure.js';
import {
  canGrantOnCreate,
  canManageAccount,
  forbidden,
  hasAnyAccountAuthority,
  resolveAuthority,
  type AccountAuthority,
} from './account-authority.js';
import { loadAssignments, type AssignmentWithPermissions } from './assignments.js';
import { writeIdentityAuditLog } from './identity-audit-log.js';
import { OrganizationDirectory, type OrgUnitSummary } from './organization-directory.js';
import { generateTemporaryPassword } from './temporary-password.js';

// Quản lý tài khoản (P01-06) và gán vai trò (P01-07) theo PQ-03, PQ-05, PQ-08, PQ-13, BM-56, BM-68
export interface RoleGrant {
  role_code: string;
  org_unit_id: string | null;
}

export interface AccountInput {
  full_name: string;
  phone: string | null;
  username: string | null;
  valid_until: string | null;
  roles: RoleGrant[];
}

export interface AccountChanges {
  full_name?: string;
  phone?: string | null;
  username?: string | null;
  valid_until?: string | null;
  status?: 'active' | 'locked';
}

export interface AccountView {
  id: string;
  full_name: string;
  phone: string | null;
  username: string | null;
  status: 'active' | 'locked';
  must_change_password: boolean;
  valid_until: string | null;
  last_login_at: Date | null;
  locked_until: Date | null;
  assignments: Array<Omit<AssignmentWithPermissions, 'permissions'>>;
}

export interface ListQuery {
  q?: string;
  status?: 'active' | 'locked';
  role_code?: string;
  page: number;
  page_size: number;
}

export interface CallerContext {
  claims: AccessTokenClaims;
  accessToken: string;
  ipAddress: string | null;
}

const USER_COLUMNS = [
  'id',
  'full_name',
  'phone',
  'username',
  'status',
  'must_change_password',
  'valid_until',
  'last_login_at',
  'locked_until',
] as const;

function notFound(): ApplicationError {
  return new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy tài khoản', [{ field: 'entity', message: 'user' }]);
}

function toView(user: Omit<AccountView, 'assignments'>, assignments: AssignmentWithPermissions[] = []): AccountView {
  return {
    ...user,
    assignments: assignments.map(({ assignment_id, role_code, role_name, org_unit_id }) => ({
      assignment_id,
      role_code,
      role_name,
      org_unit_id,
    })),
  };
}

@Injectable()
export class AccountsService {
  constructor(
    private readonly infrastructure: Infrastructure,
    private readonly organizationDirectory: OrganizationDirectory,
    private readonly clock: Clock,
  ) {}

  private get database() {
    return this.infrastructure.database;
  }

  // Quyền quản lý tài khoản của người gọi; đọc cây đơn vị khi cần biết Trường chính
  async authority(caller: CallerContext): Promise<{ authority: AccountAuthority; units: OrgUnitSummary[] }> {
    const assignments = (await loadAssignments(this.database, [caller.claims.userId])).get(caller.claims.userId) ?? [];
    const preliminary = resolveAuthority(caller.claims.userId, assignments, null);
    if (!hasAnyAccountAuthority(preliminary)) {
      throw forbidden('Bạn không có quyền quản lý tài khoản');
    }
    const units = await this.organizationDirectory.listUnits(caller.accessToken);
    const authority = resolveAuthority(caller.claims.userId, assignments, units);
    return { authority, units };
  }

  async list(caller: CallerContext, query: ListQuery) {
    const { authority } = await this.authority(caller);
    let selection = this.database.selectFrom('users').select(USER_COLUMNS);
    if (query.q) {
      const pattern = `%${query.q.toLowerCase()}%`;
      selection = selection.where((expression) =>
        expression.or([
          expression(expression.fn('lower', ['full_name']), 'like', pattern),
          expression('phone', 'like', pattern),
          expression(expression.fn('lower', ['username']), 'like', pattern),
        ]),
      );
    }
    if (query.status) {
      selection = selection.where('status', '=', query.status);
    }
    const users = await selection.orderBy('full_name').execute();
    const assignments = await loadAssignments(
      this.database,
      users.map((user) => user.id),
    );
    const visible = users
      .map((user) => toView(user, assignments.get(user.id)))
      .filter(
        (view) => !query.role_code || view.assignments.some((assignment) => assignment.role_code === query.role_code),
      )
      .filter((view) => canManageAccount(authority, assignments.get(view.id) ?? []));
    const start = (query.page - 1) * query.page_size;
    return {
      items: visible.slice(start, start + query.page_size),
      page: query.page,
      page_size: query.page_size,
      total: visible.length,
      total_pages: Math.max(1, Math.ceil(visible.length / query.page_size)),
    };
  }

  // Nhật ký tài khoản và quyền chỉ VT-01, VT-02 xem (P01-09, YCTD-40)
  async listAuditLogs(
    caller: CallerContext,
    query: {
      entity_id?: string;
      actor_user_id?: string;
      from_date?: string;
      to_date?: string;
      page: number;
      page_size: number;
    },
  ) {
    const { authority } = await this.authority(caller);
    if (!authority.manageAll) {
      throw forbidden('Chỉ Hiệu trưởng và quản trị nền tảng xem được nhật ký tài khoản và quyền');
    }
    let selection = this.database.selectFrom('identity_audit_logs');
    if (query.entity_id) {
      selection = selection.where('entity_id', '=', query.entity_id);
    }
    if (query.actor_user_id) {
      selection = selection.where('actor_user_id', '=', query.actor_user_id);
    }
    if (query.from_date) {
      selection = selection.where('created_at', '>=', new Date(`${query.from_date}T00:00:00+07:00`));
    }
    if (query.to_date) {
      selection = selection.where(
        'created_at',
        '<',
        new Date(new Date(`${query.to_date}T00:00:00+07:00`).getTime() + 86_400_000),
      );
    }
    const total = Number(
      (await selection.select((expression) => expression.fn.countAll<string>().as('count')).executeTakeFirstOrThrow())
        .count,
    );
    const items = await selection
      .selectAll()
      .orderBy('created_at', 'desc')
      .limit(query.page_size)
      .offset((query.page - 1) * query.page_size)
      .execute();
    return {
      items,
      page: query.page,
      page_size: query.page_size,
      total,
      total_pages: Math.max(1, Math.ceil(total / query.page_size)),
    };
  }

  async get(caller: CallerContext, userId: string): Promise<AccountView> {
    const { authority } = await this.authority(caller);
    const { view, assignments } = await this.findAccount(userId);
    if (!canManageAccount(authority, assignments)) {
      throw forbidden('Tài khoản này nằm ngoài phạm vi của bạn');
    }
    return view;
  }

  // Tạo tài khoản kèm vai trò; hệ thống sinh mật khẩu tạm, bắt buộc đổi ở lần đăng nhập đầu (PQ-13, PQ-14)
  async create(
    caller: CallerContext,
    input: AccountInput,
  ): Promise<{ account: AccountView; temporary_password: string }> {
    const { authority, units } = await this.authority(caller);
    const roles = await this.validateGrants(input.roles, input.valid_until, units, 'roles');
    for (const grant of input.roles) {
      if (!canGrantOnCreate(authority, grant.role_code, grant.org_unit_id)) {
        throw forbidden(`Bạn không được cấp vai trò ${grant.role_code} ở đơn vị này`);
      }
    }
    await this.assertUnique(input.phone, input.username, null);

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    const userId = await this.database.transaction().execute(async (transaction) => {
      const user = await transaction
        .insertInto('users')
        .values({
          full_name: input.full_name,
          phone: input.phone,
          username: input.username,
          valid_until: input.valid_until,
          password_hash: passwordHash,
          must_change_password: true,
          created_by: caller.claims.userId,
        })
        .returning(USER_COLUMNS)
        .executeTakeFirstOrThrow();
      for (const grant of input.roles) {
        await transaction
          .insertInto('user_roles')
          .values({
            user_id: user.id,
            role_id: roles.get(grant.role_code) ?? '',
            org_unit_id: grant.org_unit_id,
            created_by: caller.claims.userId,
          })
          .execute();
      }
      await writeIdentityAuditLog(transaction, {
        actorUserId: caller.claims.userId,
        entityName: 'users',
        entityId: user.id,
        action: 'create',
        before: null,
        after: { ...user, roles: input.roles },
        ipAddress: caller.ipAddress,
      });
      return user.id;
    });
    return { account: (await this.findAccount(userId)).view, temporary_password: temporaryPassword };
  }

  // Sửa thông tin, khóa, mở khóa; không ai tự đổi tài khoản của mình qua điểm cuối này (PQ-08)
  async update(caller: CallerContext, userId: string, changes: AccountChanges): Promise<AccountView> {
    if (userId === caller.claims.userId) {
      throw forbidden('Không tự sửa tài khoản của mình ở đây; số điện thoại đăng nhập đổi qua nhà trường xác nhận');
    }
    const { authority } = await this.authority(caller);
    const { view: before, assignments } = await this.findAccount(userId);
    if (!canManageAccount(authority, assignments)) {
      throw forbidden('Tài khoản này nằm ngoài phạm vi của bạn');
    }
    const nextPhone = changes.phone !== undefined ? changes.phone : before.phone;
    const nextUsername = changes.username !== undefined ? changes.username : before.username;
    if (!nextPhone && !nextUsername) {
      throw validationError([{ field: 'phone', message: 'Tài khoản cần số điện thoại hoặc tên đăng nhập' }]);
    }
    const nextValidUntil = changes.valid_until !== undefined ? changes.valid_until : before.valid_until;
    if (assignments.some((assignment) => assignment.role_code === 'VT-20') && !nextValidUntil) {
      throw validationError([
        { field: 'valid_until', message: 'Tài khoản kiểm toán viên bắt buộc có ngày hết hiệu lực' },
      ]);
    }
    await this.assertUnique(
      changes.phone !== undefined ? changes.phone : null,
      changes.username !== undefined ? changes.username : null,
      userId,
    );

    const now = this.clock.now();
    await this.database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('users')
        .set({
          full_name: changes.full_name,
          phone: changes.phone,
          username: changes.username,
          valid_until: changes.valid_until,
          status: changes.status,
          ...(changes.status === 'active' ? { failed_login_count: 0, locked_until: null } : {}),
          updated_at: now,
        })
        .where('id', '=', userId)
        .execute();
      if (changes.status === 'locked' && before.status !== 'locked') {
        await this.revokeSessions(transaction, userId, now);
      }
      const after = await transaction
        .selectFrom('users')
        .select(USER_COLUMNS)
        .where('id', '=', userId)
        .executeTakeFirstOrThrow();
      await writeIdentityAuditLog(transaction, {
        actorUserId: caller.claims.userId,
        entityName: 'users',
        entityId: userId,
        action:
          changes.status && changes.status !== before.status
            ? changes.status === 'locked'
              ? 'lock'
              : 'unlock'
            : 'update',
        before: { ...before, assignments: undefined },
        after,
        ipAddress: caller.ipAddress,
      });
    });
    return (await this.findAccount(userId)).view;
  }

  // Đặt lại mật khẩu: sinh mật khẩu tạm, bắt buộc đổi, thu hồi mọi phiên (PQ-14, BM-07, BM-56)
  async resetPassword(caller: CallerContext, userId: string): Promise<{ temporary_password: string }> {
    const { authority } = await this.authority(caller);
    const { assignments } = await this.findAccount(userId);
    if (!canManageAccount(authority, assignments)) {
      throw forbidden('Tài khoản này nằm ngoài phạm vi của bạn');
    }
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    const now = this.clock.now();
    await this.database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('users')
        .set({
          password_hash: passwordHash,
          must_change_password: true,
          failed_login_count: 0,
          locked_until: null,
          updated_at: now,
        })
        .where('id', '=', userId)
        .execute();
      await this.revokeSessions(transaction, userId, now);
      await writeIdentityAuditLog(transaction, {
        actorUserId: caller.claims.userId,
        entityName: 'users',
        entityId: userId,
        action: 'reset_password',
        before: null,
        after: { must_change_password: true },
        ipAddress: caller.ipAddress,
      });
    });
    return { temporary_password: temporaryPassword };
  }

  // Gán vai trò sau khi tạo chỉ VT-01, VT-02 làm được (CTC-P01-042); thu hồi phiên vì quyền thay đổi (BM-56)
  async addRole(caller: CallerContext, userId: string, grant: RoleGrant): Promise<AccountView> {
    const { authority, units } = await this.authority(caller);
    if (!authority.manageAll) {
      throw forbidden('Chỉ Hiệu trưởng và quản trị nền tảng gán được vai trò');
    }
    const { view, assignments } = await this.findAccount(userId);
    const roles = await this.validateGrants([grant], view.valid_until, units, 'role');
    if (
      assignments.some(
        (assignment) => assignment.role_code === grant.role_code && assignment.org_unit_id === grant.org_unit_id,
      )
    ) {
      throw new ApplicationError('ERR_CONFLICT', 'Tài khoản đã có vai trò này ở đơn vị này');
    }
    const now = this.clock.now();
    await this.database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('user_roles')
        .values({
          user_id: userId,
          role_id: roles.get(grant.role_code) ?? '',
          org_unit_id: grant.org_unit_id,
          created_by: caller.claims.userId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await this.revokeSessions(transaction, userId, now);
      await writeIdentityAuditLog(transaction, {
        actorUserId: caller.claims.userId,
        entityName: 'user_roles',
        entityId: created.id,
        action: 'assign_role',
        before: null,
        after: { user_id: userId, ...grant },
        ipAddress: caller.ipAddress,
      });
    });
    return (await this.findAccount(userId)).view;
  }

  async removeRole(caller: CallerContext, userId: string, assignmentId: string): Promise<AccountView> {
    const { authority } = await this.authority(caller);
    if (!authority.manageAll) {
      throw forbidden('Chỉ Hiệu trưởng và quản trị nền tảng gỡ được vai trò');
    }
    const { assignments } = await this.findAccount(userId);
    const assignment = assignments.find((item) => item.assignment_id === assignmentId);
    if (!assignment) {
      throw new ApplicationError('ERR_NOT_FOUND', 'Tài khoản không có vai trò này', [
        { field: 'entity', message: 'user_role' },
      ]);
    }
    const now = this.clock.now();
    await this.database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('user_roles').where('id', '=', assignmentId).execute();
      await this.revokeSessions(transaction, userId, now);
      await writeIdentityAuditLog(transaction, {
        actorUserId: caller.claims.userId,
        entityName: 'user_roles',
        entityId: assignmentId,
        action: 'remove_role',
        before: { user_id: userId, role_code: assignment.role_code, org_unit_id: assignment.org_unit_id },
        after: null,
        ipAddress: caller.ipAddress,
      });
    });
    return (await this.findAccount(userId)).view;
  }

  private async findAccount(userId: string): Promise<{ view: AccountView; assignments: AssignmentWithPermissions[] }> {
    const user = await this.database
      .selectFrom('users')
      .select(USER_COLUMNS)
      .where('id', '=', userId)
      .executeTakeFirst();
    if (!user) {
      throw notFound();
    }
    const assignments = (await loadAssignments(this.database, [userId])).get(userId) ?? [];
    return { view: toView(user, assignments), assignments };
  }

  // Vai trò toàn trường không gắn đơn vị; vai trò khác bắt buộc có đơn vị đang hoạt động (PQ-03); VT-20 cần ngày hết hiệu lực (BM-68)
  private async validateGrants(
    grants: RoleGrant[],
    validUntil: string | null,
    units: OrgUnitSummary[],
    field: string,
  ): Promise<Map<string, string>> {
    const errors: FieldError[] = [];
    const codes = [...new Set(grants.map((grant) => grant.role_code))];
    const roles = codes.length
      ? await this.database.selectFrom('roles').select(['id', 'code']).where('code', 'in', codes).execute()
      : [];
    const roleIds = new Map(roles.map((role) => [role.code, role.id]));
    grants.forEach((grant, index) => {
      const prefix = `${field}[${index}]`;
      if (!roleIds.has(grant.role_code)) {
        errors.push({ field: `${prefix}.role_code`, message: `Không có vai trò ${grant.role_code}` });
        return;
      }
      const wholeSchool = (WHOLE_SCHOOL_ROLE_CODES as readonly string[]).includes(grant.role_code);
      if (wholeSchool && grant.org_unit_id !== null) {
        errors.push({
          field: `${prefix}.org_unit_id`,
          message: `Vai trò ${grant.role_code} có phạm vi toàn trường, không chọn đơn vị`,
        });
      }
      if (!wholeSchool) {
        if (grant.org_unit_id === null) {
          errors.push({
            field: `${prefix}.org_unit_id`,
            message: `Vai trò ${grant.role_code} bắt buộc chọn đơn vị (PQ-03)`,
          });
        } else if (!units.some((unit) => unit.id === grant.org_unit_id && unit.status === 'active')) {
          errors.push({ field: `${prefix}.org_unit_id`, message: 'Đơn vị không tồn tại hoặc đã ngừng sử dụng' });
        }
      }
      if (grant.role_code === 'VT-20' && !validUntil) {
        errors.push({
          field: 'valid_until',
          message: 'Tài khoản kiểm toán viên bắt buộc có ngày hết hiệu lực (BM-68)',
        });
      }
    });
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return roleIds;
  }

  private async assertUnique(
    phone: string | null,
    username: string | null,
    exceptUserId: string | null,
  ): Promise<void> {
    for (const [column, value] of [
      ['phone', phone],
      ['username', username],
    ] as const) {
      if (!value) {
        continue;
      }
      let query = this.database.selectFrom('users').select('id').where(column, '=', value);
      if (exceptUserId) {
        query = query.where('id', '!=', exceptUserId);
      }
      const duplicate = await query.executeTakeFirst();
      if (duplicate) {
        throw new ApplicationError(
          'ERR_CONFLICT',
          column === 'phone' ? 'Số điện thoại đã thuộc một tài khoản khác' : 'Tên đăng nhập đã tồn tại',
          [{ field: column, message: duplicate.id }],
        );
      }
    }
  }

  private async revokeSessions(transaction: Transaction<IdentityDatabase>, userId: string, now: Date): Promise<void> {
    await transaction
      .updateTable('sessions')
      .set({ revoked_at: now })
      .where('user_id', '=', userId)
      .where('revoked_at', 'is', null)
      .execute();
  }
}
