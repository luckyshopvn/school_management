import { Inject, Injectable } from '@nestjs/common';
import type { IdentityDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type AccessTokenClaims,
  type FieldError,
} from '@school-management/server';
import {
  ROLE_CODES_RESERVED_FOR_PRINCIPAL,
  SCHOOL_LEVEL_CODES,
  WHOLE_SCHOOL_ROLE_CODES,
} from '@school-management/shared';
import { sql, type Kysely, type Transaction } from 'kysely';
import { hashPassword } from '../authentication/password.js';
import { IdentitySettingsService } from '../settings/identity-settings.service.js';
import { Infrastructure } from '../common/infrastructure.js';
import { IDENTITY_CONFIGURATION, type IdentityConfiguration } from '../common/configuration.js';
import {
  isNationalIdShaped,
  isSchoolAdminRole,
  maskLoginIdentifier,
  schoolAdminIdentityProblems,
} from './national-id.js';
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

const PARENT_ROLE_CODE = 'VT-14';

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

// Dòng của 1.4 Danh sách người dùng: thêm ngày hết hạn mật khẩu theo chính sách (YCTD-110); null khi không áp dụng
export interface AccountListItem extends AccountView {
  password_expires_at: Date | null;
}

export interface ListQuery {
  q?: string;
  status?: 'active' | 'locked';
  role_code?: string;
  login?: string;
  full_name?: string;
  must_change_password?: boolean;
  // Lọc theo danh sách mã tài khoản: máy chủ API đổi "Mã định danh" (mã nhân sự, mã Bộ) thành mã tài khoản (DT-16 phần 16d)
  user_ids?: string[];
  // Ngày hết hạn mật khẩu từ, đến (YYYY-MM-DD, giờ Việt Nam)
  password_expires_from?: string;
  password_expires_to?: string;
  page: number;
  page_size: number;
}

const DAY_MILLISECONDS = 86_400_000;

function vietnamDayStart(date: string): Date {
  return new Date(`${date}T00:00:00+07:00`);
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
  'password_changed_at',
  'locked_until',
] as const;

// Thoát ký tự đại diện của LIKE để từ khóa có "%" hoặc "_" vẫn tìm đúng nguyên văn
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

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
    private readonly identitySettings: IdentitySettingsService,
    @Inject(IDENTITY_CONFIGURATION) private readonly configuration: IdentityConfiguration,
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

  // Lọc, đếm và cắt trang ngay trong câu truy vấn, chỉ đọc vai trò của các tài khoản trên trang (DT-15 phần 15e): trường
  // có khoảng 30 nghìn tài khoản phụ huynh nên không đọc cả bảng rồi mới cắt. Điều kiện phạm vi viết lại đúng như
  // canManageAccount: VT-03 chỉ thấy tài khoản có ít nhất một vai trò và mọi vai trò đều nằm trong đơn vị của mình, không
  // phải VT-01, VT-02
  async list(caller: CallerContext, query: ListQuery) {
    const { authority } = await this.authority(caller);
    let selection = this.database.selectFrom('users');
    if (query.q) {
      const pattern = `%${escapeLike(query.q.toLowerCase())}%`;
      selection = selection.where((expression) =>
        expression.or([
          expression(expression.fn('lower', ['users.full_name']), 'like', pattern),
          expression('users.phone', 'like', pattern),
          expression(expression.fn('lower', ['users.username']), 'like', pattern),
        ]),
      );
    }
    // Bộ lọc của danh sách người dùng theo Sở: tên đăng nhập (tên đăng nhập hoặc số điện thoại), tên nhân sự
    if (query.login) {
      const pattern = `%${escapeLike(query.login.toLowerCase())}%`;
      selection = selection.where((expression) =>
        expression.or([
          expression('users.phone', 'like', pattern),
          expression(expression.fn('lower', ['users.username']), 'like', pattern),
        ]),
      );
    }
    if (query.full_name) {
      selection = selection.where(
        (expression) => expression.fn('lower', ['users.full_name']),
        'like',
        `%${escapeLike(query.full_name.toLowerCase())}%`,
      );
    }
    if (query.status) {
      selection = selection.where('users.status', '=', query.status);
    }
    if (query.must_change_password !== undefined) {
      selection = selection.where('users.must_change_password', '=', query.must_change_password);
    }
    if (query.user_ids) {
      selection =
        query.user_ids.length > 0
          ? selection.where('users.id', 'in', query.user_ids)
          : selection.where(sql<boolean>`false`);
    }
    // Hạn mật khẩu chỉ áp dụng cho tài khoản nhân sự có mật khẩu riêng, khi chính sách có số ngày tối đa (như khi đăng nhập)
    const policy = await this.identitySettings.passwordPolicy();
    if (query.password_expires_from || query.password_expires_to) {
      if (policy.password_max_age_days === 0) {
        selection = selection.where(sql<boolean>`false`);
      } else {
        const expiresAt = sql<Date>`users.password_changed_at + make_interval(days => ${policy.password_max_age_days})`;
        selection = selection
          .where('users.password_hash', 'is not', null)
          .where(({ exists, selectFrom }) =>
            exists(
              selectFrom('user_roles')
                .innerJoin('roles', 'roles.id', 'user_roles.role_id')
                .select('user_roles.id')
                .whereRef('user_roles.user_id', '=', 'users.id')
                .where('roles.code', '!=', PARENT_ROLE_CODE),
            ),
          );
        if (query.password_expires_from) {
          selection = selection.where(expiresAt, '>=', vietnamDayStart(query.password_expires_from));
        }
        if (query.password_expires_to) {
          selection = selection.where(
            expiresAt,
            '<',
            new Date(vietnamDayStart(query.password_expires_to).getTime() + DAY_MILLISECONDS),
          );
        }
      }
    }
    if (query.role_code) {
      const roleCode = query.role_code;
      selection = selection.where(({ exists, selectFrom }) =>
        exists(
          selectFrom('user_roles')
            .innerJoin('roles', 'roles.id', 'user_roles.role_id')
            .select('user_roles.id')
            .whereRef('user_roles.user_id', '=', 'users.id')
            .where('roles.code', '=', roleCode),
        ),
      );
    }
    if (!authority.manageAll) {
      const unitIds = [...authority.manageInUnitIds];
      selection = selection
        .where(({ exists, selectFrom }) =>
          exists(selectFrom('user_roles').select('user_roles.id').whereRef('user_roles.user_id', '=', 'users.id')),
        )
        .where(({ exists, not, selectFrom }) =>
          not(
            exists(
              selectFrom('user_roles')
                .innerJoin('roles', 'roles.id', 'user_roles.role_id')
                .select('user_roles.id')
                .whereRef('user_roles.user_id', '=', 'users.id')
                .where((expression) => {
                  const outOfScope = [expression('roles.code', 'in', [...ROLE_CODES_RESERVED_FOR_PRINCIPAL])];
                  if (!authority.manageInUnitWholeSchool) {
                    outOfScope.push(expression('user_roles.org_unit_id', 'is', null));
                    outOfScope.push(
                      unitIds.length > 0
                        ? expression('user_roles.org_unit_id', 'not in', unitIds)
                        : expression.lit(true),
                    );
                  }
                  return expression.or(outOfScope);
                }),
            ),
          ),
        );
    }
    const total = Number(
      (await selection.select((expression) => expression.fn.countAll<string>().as('count')).executeTakeFirstOrThrow())
        .count,
    );
    const users = await selection
      .select(USER_COLUMNS.map((column) => `users.${column}` as const))
      .select(sql<boolean>`users.password_hash is not null`.as('has_own_password'))
      .orderBy('users.full_name')
      .orderBy('users.id')
      .limit(query.page_size)
      .offset((query.page - 1) * query.page_size)
      .execute();
    const assignments = await loadAssignments(
      this.database,
      users.map((user) => user.id),
    );
    const items: AccountListItem[] = users.map(({ has_own_password: hasOwnPassword, ...user }) => {
      const userAssignments = assignments.get(user.id) ?? [];
      const expires =
        hasOwnPassword &&
        policy.password_max_age_days > 0 &&
        userAssignments.some((assignment) => assignment.role_code !== PARENT_ROLE_CODE);
      return {
        ...toView(user, userAssignments),
        // Danh sách chỉ hiện số CCCD dạng che (YCTD-311); xem đủ ở chi tiết tài khoản
        username: maskLoginIdentifier(user.username),
        password_expires_at: expires
          ? new Date(user.password_changed_at.getTime() + policy.password_max_age_days * DAY_MILLISECONDS)
          : null,
      };
    });
    return {
      items,
      page: query.page,
      page_size: query.page_size,
      total,
      total_pages: Math.max(1, Math.ceil(total / query.page_size)),
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

  // Tạo tài khoản kèm vai trò; hệ thống sinh mật khẩu tạm, bắt buộc đổi ở lần đăng nhập đầu (PQ-13, PQ-14).
  // Tài khoản chỉ có vai trò phụ huynh dùng mật khẩu mặc định chung, không sinh mật khẩu tạm (PQ-06, YCTD-43)
  async create(
    caller: CallerContext,
    input: AccountInput,
  ): Promise<{
    account: AccountView;
    temporary_password: string | null;
    uses_default_password: boolean;
    uses_initial_password: boolean;
  }> {
    const { authority, units } = await this.authority(caller);
    const roles = await this.validateGrants(input.roles, input.valid_until, units, 'roles');
    for (const grant of input.roles) {
      if (!canGrantOnCreate(authority, grant.role_code, grant.org_unit_id)) {
        throw forbidden(`Bạn không được cấp vai trò ${grant.role_code} ở đơn vị này`);
      }
    }
    await this.assertUnique(input.phone, input.username, null);

    // Quy tắc số CCCD (YCTD-311): tên đăng nhập là số CCCD thì nhận mật khẩu mặc định của hệ thống (DEFAULT_INITIAL_PASSWORD), có hạn
    // theo cấu hình, kể cả tài khoản phụ huynh; chưa cấu hình mật khẩu mặc định thì sinh mật khẩu tạm như trước
    const nationalIdLogin = isNationalIdShaped(input.username);
    const initialPassword = nationalIdLogin ? (this.configuration.defaultInitialPassword ?? null) : null;
    const usesDefaultPassword =
      !nationalIdLogin && input.roles.length > 0 && input.roles.every((grant) => grant.role_code === PARENT_ROLE_CODE);
    if (usesDefaultPassword && (await this.identitySettings.parentDefaultPasswordHash()) === null) {
      throw ruleViolationError(
        'PQ-06',
        'Chưa đặt mật khẩu mặc định của phụ huynh; Hiệu trưởng đặt ở màn hình Cấu hình, phần Tài khoản',
      );
    }
    const temporaryPassword = usesDefaultPassword || initialPassword !== null ? null : generateTemporaryPassword();
    const passwordSource = initialPassword ?? temporaryPassword;
    const passwordHash = passwordSource === null ? null : await hashPassword(passwordSource);
    const initialPasswordExpiresAt = nationalIdLogin
      ? new Date(
          this.clock.now().getTime() + (await this.identitySettings.initialPasswordLifetimeDays()) * DAY_MILLISECONDS,
        )
      : null;
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
          initial_password_expires_at: initialPasswordExpiresAt,
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
        // Số CCCD chỉ ghi dạng che (YCTD-311)
        after: { ...user, username: maskLoginIdentifier(user.username), roles: input.roles },
        ipAddress: caller.ipAddress,
      });
      return user.id;
    });
    return {
      account: (await this.findAccount(userId)).view,
      temporary_password: temporaryPassword,
      uses_default_password: usesDefaultPassword,
      uses_initial_password: initialPassword !== null,
    };
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

  // Phạm vi cấp học của tài khoản (DT-19 phần 19a): người quản lý được tài khoản thì xem, đặt được; mảng trống là mọi cấp.
  // Phạm vi cấp chỉ thu hẹp quyền đã có, không cấp thêm quyền
  async schoolLevels(caller: CallerContext, userId: string): Promise<{ school_levels: string[] }> {
    const { authority } = await this.authority(caller);
    const { assignments } = await this.findAccount(userId);
    if (!canManageAccount(authority, assignments)) {
      throw forbidden('Tài khoản này nằm ngoài phạm vi của bạn');
    }
    return { school_levels: await this.readSchoolLevels(this.database, userId) };
  }

  async setSchoolLevels(caller: CallerContext, userId: string, levels: string[]): Promise<{ school_levels: string[] }> {
    const { authority } = await this.authority(caller);
    const { assignments } = await this.findAccount(userId);
    if (!canManageAccount(authority, assignments)) {
      throw forbidden('Tài khoản này nằm ngoài phạm vi của bạn');
    }
    const after = await this.database.transaction().execute(async (transaction) => {
      const before = await this.readSchoolLevels(transaction, userId);
      await transaction.deleteFrom('user_school_levels').where('user_id', '=', userId).execute();
      if (levels.length > 0) {
        await transaction
          .insertInto('user_school_levels')
          .values(levels.map((level) => ({ user_id: userId, school_level: level, created_by: caller.claims.userId })))
          .execute();
      }
      const result = await this.readSchoolLevels(transaction, userId);
      await writeIdentityAuditLog(transaction, {
        actorUserId: caller.claims.userId,
        entityName: 'user_school_levels',
        entityId: userId,
        action: 'update',
        before: { school_levels: before },
        after: { school_levels: result },
        ipAddress: caller.ipAddress,
      });
      return result;
    });
    return { school_levels: after };
  }

  private async readSchoolLevels(
    executor: Kysely<IdentityDatabase> | Transaction<IdentityDatabase>,
    userId: string,
  ): Promise<string[]> {
    const rows = await executor
      .selectFrom('user_school_levels')
      .select('school_level')
      .where('user_id', '=', userId)
      .execute();
    return SCHOOL_LEVEL_CODES.filter((code) => rows.some((row) => row.school_level === code));
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
          password_changed_at: now,
          must_change_password: true,
          initial_password_expires_at: null,
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

  // Cấp mật khẩu hàng loạt ở 1.4 Danh sách người dùng của Sở (DT-16 phần 16d): như đặt lại mật khẩu từng tài khoản, mỗi
  // tài khoản một mật khẩu tạm, bắt buộc đổi ở lần đăng nhập sau, thu hồi mọi phiên. Mật khẩu tạm chỉ trả một lần trong
  // phản hồi, không ghi vào nhật ký. Bỏ qua tài khoản của chính người thao tác và tài khoản ngoài phạm vi, kèm lý do
  async bulkResetPassword(caller: CallerContext, userIds: string[]) {
    const { authority } = await this.authority(caller);
    const users = await this.database
      .selectFrom('users')
      .select(['id', 'full_name', 'username', 'phone'])
      .where('id', 'in', userIds)
      .execute();
    const assignments = await loadAssignments(this.database, userIds);
    const now = this.clock.now();
    const results: Array<{
      user_id: string;
      full_name: string | null;
      login: string | null;
      temporary_password: string | null;
      skipped_reason: string | null;
    }> = [];
    for (const userId of userIds) {
      const user = users.find((item) => item.id === userId);
      const skip = (reason: string) =>
        results.push({
          user_id: userId,
          full_name: user?.full_name ?? null,
          login: user ? maskLoginIdentifier(user.username ?? user.phone) : null,
          temporary_password: null,
          skipped_reason: reason,
        });
      if (!user) {
        skip('Không tìm thấy tài khoản');
        continue;
      }
      if (userId === caller.claims.userId) {
        skip('Không cấp lại mật khẩu cho tài khoản đang đăng nhập; đổi ở menu người dùng');
        continue;
      }
      if (!canManageAccount(authority, assignments.get(userId) ?? [])) {
        skip('Tài khoản nằm ngoài phạm vi của bạn');
        continue;
      }
      const temporaryPassword = generateTemporaryPassword();
      const passwordHash = await hashPassword(temporaryPassword);
      await this.database.transaction().execute(async (transaction) => {
        await transaction
          .updateTable('users')
          .set({
            password_hash: passwordHash,
            password_changed_at: now,
            must_change_password: true,
            initial_password_expires_at: null,
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
          after: { must_change_password: true, bulk: true },
          ipAddress: caller.ipAddress,
        });
      });
      results.push({
        user_id: userId,
        full_name: user.full_name,
        login: maskLoginIdentifier(user.username ?? user.phone),
        temporary_password: temporaryPassword,
        skipped_reason: null,
      });
    }
    return { items: results };
  }

  // Phân nhóm quyền hàng loạt (DT-16 phần 16d): gán một nhóm ở một đơn vị cho nhiều tài khoản; như gán từng tài khoản,
  // chỉ VT-01, VT-02 làm được; tài khoản đã có nhóm ở đơn vị đó thì bỏ qua
  async bulkAddRole(caller: CallerContext, userIds: string[], grant: RoleGrant) {
    const { authority, units } = await this.authority(caller);
    if (!authority.manageAll) {
      throw forbidden('Chỉ Hiệu trưởng và quản trị nền tảng gán được vai trò');
    }
    const users = await this.database
      .selectFrom('users')
      .select(['id', 'full_name', 'valid_until'])
      .where('id', 'in', userIds)
      .execute();
    const assignments = await loadAssignments(this.database, userIds);
    // Ngày hết hiệu lực của VT-20 kiểm tra riêng từng tài khoản ở dưới
    const roles = await this.validateGrants([grant], 'bulk', units, 'role');
    const now = this.clock.now();
    const results: Array<{ user_id: string; full_name: string | null; added: boolean; skipped_reason: string | null }> =
      [];
    for (const userId of userIds) {
      const user = users.find((item) => item.id === userId);
      if (!user) {
        results.push({ user_id: userId, full_name: null, added: false, skipped_reason: 'Không tìm thấy tài khoản' });
        continue;
      }
      if (grant.role_code === 'VT-20' && !user.valid_until) {
        results.push({
          user_id: userId,
          full_name: user.full_name,
          added: false,
          skipped_reason: 'Tài khoản kiểm toán viên bắt buộc có ngày hết hiệu lực (BM-68)',
        });
        continue;
      }
      if (
        (assignments.get(userId) ?? []).some(
          (assignment) => assignment.role_code === grant.role_code && assignment.org_unit_id === grant.org_unit_id,
        )
      ) {
        results.push({
          user_id: userId,
          full_name: user.full_name,
          added: false,
          skipped_reason: 'Tài khoản đã có nhóm này ở đơn vị này',
        });
        continue;
      }
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
          after: { user_id: userId, ...grant, bulk: true },
          ipAddress: caller.ipAddress,
        });
      });
      results.push({ user_id: userId, full_name: user.full_name, added: true, skipped_reason: null });
    }
    return { items: results };
  }

  // Gán vai trò sau khi tạo chỉ VT-01, VT-02 làm được (CTC-P01-042); thu hồi phiên vì quyền thay đổi (BM-56)
  async addRole(caller: CallerContext, userId: string, grant: RoleGrant): Promise<AccountView> {
    const { authority, units } = await this.authority(caller);
    if (!authority.manageAll) {
      throw forbidden('Chỉ Hiệu trưởng và quản trị nền tảng gán được vai trò');
    }
    const { view, assignments } = await this.findAccount(userId);
    if (isSchoolAdminRole(grant.role_code)) {
      const problems = schoolAdminIdentityProblems({
        fullName: view.full_name,
        phone: view.phone,
        username: view.username,
      });
      if (problems.length > 0) {
        throw validationError(problems);
      }
    }
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
