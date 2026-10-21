import { generateKeyPairSync, randomUUID } from 'node:crypto';
import type { IdentityDatabase } from '@school-management/database';
import {
  ACCESS_TOKEN_LIFETIME_SECONDS,
  TOKEN_AUDIENCE,
  TOKEN_ISSUER,
  TOKEN_SIGNING_ALGORITHM,
  unauthenticatedError,
} from '@school-management/server';
import { decodeJwt, importPKCS8, SignJWT } from 'jose';
import type { Kysely } from 'kysely';
import {
  IdentityClient,
  type GuardianAccountResult,
  type StaffAccountResult,
  type StaffDirectoryEntry,
} from '../authentication/identity-client.js';
import type { ApiConfiguration } from '../common/configuration.js';
import type { CurrentUserDescription } from '../authentication/current-user.js';

// Lệnh tạo dữ liệu trình diễn (DT-18 phần 18h) chạy máy chủ API trong tiến trình và gọi đúng các điểm cuối như người dùng.
// Không cần dịch vụ định danh đang chạy: lệnh tự ký mã phiên bằng cặp khóa tạm và đọc vai trò, quyền thẳng từ cơ sở dữ liệu
// định danh. Mã phiên này chỉ dùng được với máy chủ API trong tiến trình của lệnh (khóa công khai tạm), không dùng được ở
// máy chủ thật

// Băm argon2id sẵn của DEMO_PASSWORD (mật khẩu chung công khai của bản trình diễn); máy chủ API không có thư viện argon2
export const DEMO_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$AB+kGJXBwZO+tH0uknvfyA$JzDBQPhEazlhqAYzhxX6G0xlI3BCv1hQ3AQk9DGa4K8';

export class DemoTokenIssuer {
  readonly publicKeyPem: string;
  private readonly privateKeyPem: string;

  constructor() {
    const pair = generateKeyPairSync('ed25519');
    this.publicKeyPem = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    this.privateKeyPem = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  }

  async sign(userId: string, now: Date): Promise<string> {
    const issuedAt = Math.floor(now.getTime() / 1000);
    return new SignJWT({ sid: randomUUID(), channel: 'portal', password_change_required: false })
      .setProtectedHeader({ alg: TOKEN_SIGNING_ALGORITHM })
      .setSubject(userId)
      .setIssuer(TOKEN_ISSUER)
      .setAudience(TOKEN_AUDIENCE)
      .setIssuedAt(issuedAt)
      // Lệnh chạy lâu hơn 15 phút thì vẫn dùng được mã
      .setExpirationTime(issuedAt + ACCESS_TOKEN_LIFETIME_SECONDS * 8)
      .sign(await importPKCS8(this.privateKeyPem, TOKEN_SIGNING_ALGORITHM));
  }
}

// Thay IdentityClient của máy chủ API trong tiến trình của lệnh: tra tài khoản, vai trò, quyền ở cơ sở dữ liệu định danh
export class DemoIdentityClient extends IdentityClient {
  constructor(
    configuration: ApiConfiguration,
    private readonly identity: Kysely<IdentityDatabase>,
  ) {
    super(configuration);
  }

  override async describeCurrentUser(accessToken: string): Promise<CurrentUserDescription> {
    const userId = decodeJwt(accessToken).sub;
    const user = userId
      ? await this.identity.selectFrom('users').select(['id', 'full_name']).where('id', '=', userId).executeTakeFirst()
      : undefined;
    if (!user) {
      throw unauthenticatedError();
    }
    const rows = await this.identity
      .selectFrom('user_roles')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .leftJoin('role_permissions', 'role_permissions.role_id', 'roles.id')
      .leftJoin('permissions', 'permissions.id', 'role_permissions.permission_id')
      .select([
        'user_roles.id as assignment_id',
        'roles.code as role_code',
        'roles.name as role_name',
        'user_roles.org_unit_id',
        'permissions.code as permission_code',
      ])
      .where('user_roles.user_id', '=', user.id)
      .execute();
    const assignments = new Map<string, CurrentUserDescription['assignments'][number]>();
    for (const row of rows) {
      const assignment = assignments.get(row.assignment_id) ?? {
        role_code: row.role_code,
        role_name: row.role_name,
        org_unit_id: row.org_unit_id,
        permissions: [],
      };
      assignments.set(row.assignment_id, assignment);
      if (row.permission_code) {
        assignment.permissions.push(row.permission_code);
      }
    }
    return { id: user.id, full_name: user.full_name, assignments: [...assignments.values()], impersonation: null };
  }

  // Phân công giáo viên cho lớp đọc danh bạ nhân sự theo vai trò và đơn vị
  override async listStaff(_accessToken: string, roleCode: string, orgUnitId: string): Promise<StaffDirectoryEntry[]> {
    const rows = await this.identity
      .selectFrom('user_roles')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .innerJoin('users', 'users.id', 'user_roles.user_id')
      .select(['users.id as user_id', 'users.full_name', 'roles.code as role_code', 'user_roles.org_unit_id'])
      .where('roles.code', '=', roleCode)
      .where((expression) =>
        expression.or([expression('user_roles.org_unit_id', '=', orgUnitId), expression('user_roles.org_unit_id', 'is', null)]),
      )
      .execute();
    return rows;
  }

  // Gắn tài khoản cho hồ sơ nhân sự: tìm theo tên đăng nhập hoặc số điện thoại
  override async lookupStaffAccount(
    _accessToken: string,
    input: { login: string; org_unit_id: string },
  ): Promise<StaffAccountResult> {
    const user = await this.identity
      .selectFrom('users')
      .select(['id', 'full_name', 'username', 'phone', 'status'])
      .where((expression) => expression.or([expression('username', '=', input.login), expression('phone', '=', input.login)]))
      .executeTakeFirst();
    if (!user) {
      throw new Error(`Không có tài khoản trình diễn ${input.login}`);
    }
    return { user_id: user.id, full_name: user.full_name, username: user.username, phone: user.phone, status: user.status };
  }

  // Duyệt hồ sơ trẻ tạo tài khoản phụ huynh (QT-01 bước 9): tạo thẳng ở cơ sở dữ liệu định danh với mật khẩu trình diễn
  override async ensureGuardianAccount(
    _accessToken: string,
    input: { phone: string; full_name: string; org_unit_id: string },
  ): Promise<GuardianAccountResult> {
    let user = await this.identity.selectFrom('users').select('id').where('phone', '=', input.phone).executeTakeFirst();
    const created = !user;
    user ??= await this.identity
      .insertInto('users')
      .values({ full_name: input.full_name, phone: input.phone, username: null, password_hash: DEMO_PASSWORD_HASH })
      .returning('id')
      .executeTakeFirstOrThrow();
    const role = await this.identity.selectFrom('roles').select('id').where('code', '=', 'VT-14').executeTakeFirstOrThrow();
    const existing = await this.identity
      .selectFrom('user_roles')
      .select('id')
      .where('user_id', '=', user.id)
      .where('role_id', '=', role.id)
      .where('org_unit_id', '=', input.org_unit_id)
      .executeTakeFirst();
    if (!existing) {
      await this.identity
        .insertInto('user_roles')
        .values({ user_id: user.id, role_id: role.id, org_unit_id: input.org_unit_id })
        .execute();
    }
    return { user_id: user.id, created, role_added: !existing };
  }
}
