import { sql, type Kysely } from 'kysely';
import type { PlatformDatabase, SupportScope } from '../platform/schema.js';
import { identityMigrations } from '../identity/index.js';
import { schoolYearMigrations } from '../school-year/index.js';
import { systemMigrations } from '../system/index.js';

// Bảng điều khiển nền tảng (DT-SaaS phần S4, YCTD-197; tài liệu 47 mục 14.5 "S4"): hàm dùng chung cho máy chủ API (thu số liệu, gom
// lỗi, thông báo bảo trì, ghi thao tác trong phiên hỗ trợ) và dịch vụ định danh (cổng nền tảng, phiên hỗ trợ). Không đọc nội dung
// dữ liệu của trường: chỉ đếm, đo dung lượng, tên tệp thay đổi cấu trúc mới nhất.
export const SUPPORT_USERNAME = 'ho-tro-nen-tang';
export const SUPPORT_DISPLAY_NAME = 'Nhân viên hỗ trợ nền tảng';
export const METRICS_RETENTION_DAYS = 30;
export const ERROR_COUNTS_RETENTION_DAYS = 30;

export type MigrationKind = 'identity' | 'system' | 'school-year';

// Tên tệp thay đổi cấu trúc mới nhất mà mã đang chạy biết, theo loại cơ sở dữ liệu
export function latestMigrationName(kind: MigrationKind): string {
  const names = Object.keys(
    kind === 'identity' ? identityMigrations : kind === 'system' ? systemMigrations : schoolYearMigrations,
  ).sort();
  return names.at(-1) ?? '';
}

// Tên tệp thay đổi cấu trúc mới nhất đã chạy ở một cơ sở dữ liệu của trường (bảng kysely_migration của Kysely)
export async function appliedMigration<Schema>(database: Kysely<Schema>): Promise<string | null> {
  const result = await sql<{ name: string | null }>`select max(name) as name from kysely_migration`.execute(database);
  return result.rows[0]?.name ?? null;
}

// Dung lượng (MB) các bảng của lược đồ hiện tại: bố cục database là public, bố cục schema là lược đồ riêng của trường
export async function schemaSizeMb<Schema>(database: Kysely<Schema>): Promise<number> {
  const result = await sql<{ bytes: string | null }>`
    select coalesce(sum(pg_total_relation_size(c.oid)), 0) as bytes
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = current_schema() and c.relkind in ('r', 'm')`.execute(database);
  return Math.round((Number(result.rows[0]?.bytes ?? 0) / 1024 / 1024) * 100) / 100;
}

export interface SchoolMetricsInput {
  usersTotal: number;
  usersActive: number;
  activeStudents: number | null;
  storageMb: number | null;
  databaseMb: number | null;
  lastLoginAt: Date | null;
  schemaVersions: Record<string, string | null>;
}

// Ghi một lần thu số liệu; phiên bản cấu trúc khớp mã đang chạy thì schema_current đúng. Xóa số liệu cũ quá hạn giữ
export async function recordSchoolMetrics(
  platform: Kysely<PlatformDatabase>,
  schoolId: string,
  metrics: SchoolMetricsInput,
  now = new Date(),
): Promise<void> {
  const expected: Record<string, string> = {
    identity: latestMigrationName('identity'),
    system: latestMigrationName('system'),
    'school-year': latestMigrationName('school-year'),
  };
  const current = Object.entries(metrics.schemaVersions).every(([key, value]) => {
    const kind = key.split(':')[0] ?? key;
    return !expected[kind] || value === expected[kind];
  });
  await platform
    .insertInto('school_metrics')
    .values({
      school_id: schoolId,
      captured_at: now,
      users_total: metrics.usersTotal,
      users_active: metrics.usersActive,
      active_students: metrics.activeStudents,
      storage_mb: metrics.storageMb,
      database_mb: metrics.databaseMb,
      last_login_at: metrics.lastLoginAt,
      schema_versions: JSON.stringify(metrics.schemaVersions),
      schema_current: current,
    })
    .execute();
  await platform
    .deleteFrom('school_metrics')
    .where('school_id', '=', schoolId)
    .where('captured_at', '<', new Date(now.getTime() - METRICS_RETENTION_DAYS * 86_400_000))
    .execute();
}

// Mẫu đường dẫn không có tham số: mã định danh, số, mã băm thay bằng :id (nhật ký lỗi không chứa dữ liệu của trường)
export function normalizeRoute(path: string): string {
  const pathname = path.split('?')[0] ?? '/';
  return (
    pathname
      .split('/')
      .map((segment) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment) ||
        /^\d+$/.test(segment) ||
        /^[0-9a-f]{16,}$/i.test(segment) ||
        segment.length > 40
          ? ':id'
          : segment,
      )
      .join('/')
      .slice(0, 200) || '/'
  );
}

export interface ServerErrorEntry {
  schoolId: string | null;
  service: 'api' | 'identity';
  route: string;
  status: number;
  code: string | null;
  at: Date;
}

// Gom lỗi 5xx trong bộ nhớ theo trường, giờ, tuyến, mã trạng thái; flush ghi cộng dồn vào school_error_counts
export class ErrorCountBuffer {
  private readonly entries = new Map<string, ServerErrorEntry & { count: number; bucket: Date }>();

  add(entry: ServerErrorEntry): void {
    const bucket = new Date(Math.floor(entry.at.getTime() / 3_600_000) * 3_600_000);
    const route = normalizeRoute(entry.route);
    const key = [entry.schoolId ?? '-', entry.service, bucket.toISOString(), route, entry.status].join('|');
    const existing = this.entries.get(key);
    if (existing) {
      existing.count += 1;
      existing.code = entry.code ?? existing.code;
      existing.at = entry.at;
    } else {
      this.entries.set(key, { ...entry, route, bucket, count: 1 });
    }
  }

  get size(): number {
    return this.entries.size;
  }

  async flush(platform: Kysely<PlatformDatabase>): Promise<number> {
    const entries = [...this.entries.values()];
    this.entries.clear();
    for (const entry of entries) {
      await sql`
        insert into school_error_counts (school_id, service, bucket, route, status, count, last_code, last_at)
        values (${entry.schoolId}, ${entry.service}, ${entry.bucket}, ${entry.route}, ${entry.status}, ${entry.count},
          ${entry.code}, ${entry.at})
        on conflict (school_id, service, bucket, route, status)
        do update set count = school_error_counts.count + excluded.count, last_code = excluded.last_code,
          last_at = excluded.last_at`.execute(platform);
    }
    await platform
      .deleteFrom('school_error_counts')
      .where('bucket', '<', new Date(Date.now() - ERROR_COUNTS_RETENTION_DAYS * 86_400_000))
      .execute();
    return entries.length;
  }
}

export interface ActiveSupportSession {
  id: string;
  schoolId: string;
  scope: SupportScope;
  operatorName: string;
  expiresAt: Date;
  // Phiên Admin vào thẳng (YCTD-315): quản trị nền tảng (vai trò `quan_tri` hiện hành của nhân viên) theo chính sách nền tảng, toàn
  // quyền; dịch vụ định danh cấp mọi mã quyền của trường cho phiên này
  fullAccess: boolean;
}

// Phiên hỗ trợ đang mở gắn với một phiên đăng nhập của trường (mã phiên `sid`); hết hạn hoặc đã kết thúc thì null
export async function activeSupportSession(
  platform: Kysely<PlatformDatabase>,
  identitySessionId: string,
  now = new Date(),
): Promise<ActiveSupportSession | null> {
  const row = await platform
    .selectFrom('support_sessions')
    .leftJoin('platform_operators', 'platform_operators.id', 'support_sessions.operator_id')
    .select([
      'support_sessions.id',
      'support_sessions.school_id',
      'support_sessions.scope',
      'support_sessions.operator_name',
      'support_sessions.expires_at',
      'support_sessions.access_basis',
      'support_sessions.requester_kind',
      'platform_operators.role as operator_role',
      'platform_operators.status as operator_status',
    ])
    .where('support_sessions.identity_session_id', '=', identitySessionId)
    .where('support_sessions.ended_at', 'is', null)
    .where('support_sessions.expires_at', '>', now)
    .executeTakeFirst();
  return row
    ? {
        id: row.id,
        schoolId: row.school_id,
        scope: row.scope,
        operatorName: row.operator_name,
        expiresAt: row.expires_at,
        fullAccess:
          row.requester_kind === 'operator' &&
          row.access_basis === 'platform_policy' &&
          row.scope === 'full' &&
          row.operator_role === 'quan_tri' &&
          row.operator_status === 'active',
      }
    : null;
}

// Ghi một thao tác trong phiên hỗ trợ (phương thức, mẫu đường dẫn, mã trạng thái); không ghi nội dung yêu cầu
export async function recordSupportAction(
  platform: Kysely<PlatformDatabase>,
  supportSessionId: string,
  entry: { service: 'api' | 'identity'; method: string; route: string; status: number },
): Promise<void> {
  await platform
    .insertInto('support_session_actions')
    .values({
      support_session_id: supportSessionId,
      service: entry.service,
      method: entry.method.toUpperCase().slice(0, 10),
      route: normalizeRoute(entry.route),
      status: entry.status,
    })
    .execute();
}

export interface MaintenanceNoticeView {
  id: string;
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'critical';
  starts_at: Date;
  ends_at: Date;
}

// Thông báo bảo trì đang hiệu lực (hoặc sắp tới trong 72 giờ) cho người dùng của một trường
export async function maintenanceNoticesFor(
  platform: Kysely<PlatformDatabase>,
  schoolCode: string,
  now = new Date(),
): Promise<MaintenanceNoticeView[]> {
  const rows = await platform
    .selectFrom('maintenance_notices')
    .select(['id', 'title', 'body', 'severity', 'starts_at', 'ends_at', 'audience', 'school_codes'])
    .where('cancelled_at', 'is', null)
    .where('ends_at', '>', now)
    .where('starts_at', '<', new Date(now.getTime() + 72 * 3_600_000))
    .orderBy('starts_at')
    .execute();
  return rows
    .filter((row) => row.audience === 'all' || (row.school_codes ?? []).includes(schoolCode))
    .map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      severity: row.severity,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
    }));
}
