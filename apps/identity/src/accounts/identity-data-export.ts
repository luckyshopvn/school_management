import { Injectable } from '@nestjs/common';
import { ApplicationError, Clock, unauthenticatedError, type AccessTokenClaims } from '@school-management/server';
import { sql } from 'kysely';
import { Infrastructure } from '../common/infrastructure.js';
import { writeIdentityAuditLog } from './identity-audit-log.js';

// Phần dữ liệu của dịch vụ định danh trong gói ZIP toàn bộ dữ liệu của trường (DT-18 phần 18h, YCTD-145). Máy chủ API gọi
// lúc người dùng bấm xuất, bằng mã phiên của người đó, rồi đưa vào gói khi tác vụ nền chạy. Không xuất mật khẩu, mã làm
// mới, mã một lần, khóa API và mật khẩu mặc định chung; không xuất phiên đăng nhập, mã một lần, lịch sử mật khẩu
export const EXPORT_ALL_PERMISSION = 'P01.data.export-all';
const EXPORTED_TABLES = [
  'users',
  'roles',
  'permissions',
  'role_permissions',
  'role_workspace_exclusions',
  'user_roles',
  'identity_settings',
  'api_clients',
  'impersonations',
  'identity_audit_logs',
  'security_events',
] as const;
// Cột bí mật bỏ khỏi gói
const SECRET_COLUMNS = new Set(['password_hash', 'refresh_token_hash', 'code_hash', 'key_hash', 'key_prefix']);
const SECRET_SETTING_PATTERN = /password|secret|hash/i;

export interface IdentityExportSnapshot {
  generated_at: string;
  tables: Record<string, Array<Record<string, unknown>>>;
}

@Injectable()
export class IdentityDataExportService {
  constructor(
    private readonly infrastructure: Infrastructure,
    private readonly clock: Clock,
  ) {}

  async snapshot(claims: AccessTokenClaims): Promise<IdentityExportSnapshot> {
    const database = this.infrastructure.database;
    const now = this.clock.now();
    const session = await database
      .selectFrom('sessions')
      .select(['revoked_at', 'expires_at', 'impersonation_id'])
      .where('id', '=', claims.sessionId)
      .executeTakeFirst();
    if (!session || session.revoked_at !== null || session.expires_at <= now) {
      throw unauthenticatedError();
    }
    const allowed = await database
      .selectFrom('user_roles')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .innerJoin('role_permissions', 'role_permissions.role_id', 'roles.id')
      .innerJoin('permissions', 'permissions.id', 'role_permissions.permission_id')
      .select('user_roles.id')
      .where('user_roles.user_id', '=', claims.userId)
      .where('roles.is_active', '=', true)
      .where('permissions.code', '=', EXPORT_ALL_PERMISSION)
      .executeTakeFirst();
    if (!allowed) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xuất toàn bộ dữ liệu của trường');
    }
    if (session.impersonation_id !== null) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Đang đăng nhập thay, không xuất toàn bộ dữ liệu được');
    }
    const tables: IdentityExportSnapshot['tables'] = {};
    for (const table of EXPORTED_TABLES) {
      const result = await sql<Record<string, unknown>>`select * from ${sql.table(table)}`.execute(database);
      tables[table] = result.rows
        .filter((row) => table !== 'identity_settings' || !SECRET_SETTING_PATTERN.test(String(row.key)))
        .map((row) => Object.fromEntries(Object.entries(row).filter(([column]) => !SECRET_COLUMNS.has(column))));
    }
    await writeIdentityAuditLog(database, {
      actorUserId: claims.userId,
      entityName: 'users',
      entityId: claims.userId,
      action: 'export_all_data',
      before: null,
      after: { tables: EXPORTED_TABLES.length },
      ipAddress: null,
    });
    return { generated_at: now.toISOString(), tables };
  }
}
