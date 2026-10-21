import type { AddressInfo } from 'node:net';
import {
  createDatabase,
  createEmptyDatabase,
  dropDatabaseIfExists,
  migrateToLatest,
  replaceDatabaseName,
  type IdentityDatabase,
  type SystemDatabase,
} from '@school-management/database';
import { sql, type Kysely } from 'kysely';
import type { ApiConfiguration } from '../common/configuration.js';
import { createApplication } from '../create-application.js';
import type { FileStorage } from '../files/file-storage.js';
import {
  DEMO_SEED_VERSION,
  DEMO_USERS,
  demoAcademicYear,
  demoAccountList,
  seedDemoData,
  type DemoSeedReport,
} from './demo-data.js';
import { DEMO_PASSWORD_HASH, DemoIdentityClient, DemoTokenIssuer } from './demo-identity.js';

// Tạo và đặt lại bản trình diễn (DT-18 phần 18h, YCTD-145). Chỉ chạy trên cơ sở dữ liệu trống hoặc đã là bản trình diễn,
// không bao giờ trên dữ liệu thật:
// 1. kiểm tra: cơ sở dữ liệu hệ thống có dấu demo_environment, hoặc chưa có năm học nào; cơ sở dữ liệu định danh có cấu
//    hình demo_environment, hoặc chưa có tài khoản nào ngoài Quản trị nền tảng; không đạt thì dừng, không xóa gì;
// 2. xóa các cơ sở dữ liệu năm học đã đăng ký, xóa và tạo lại cơ sở dữ liệu hệ thống rồi chạy tệp thay đổi cấu trúc; ở cơ
//    sở dữ liệu định danh xóa tài khoản, phiên, nhật ký, nhóm tự tạo (giữ vai trò, quyền của hệ thống);
// 3. tạo tài khoản trình diễn (mật khẩu chung), chạy máy chủ API trong tiến trình và tạo dữ liệu giả bằng các điểm cuối;
// 4. ghi dấu bản trình diễn và lần đặt lại tới.
// Tệp đã tải lên ở kho tệp của lần trước không bị xóa (kho tệp chưa có lệnh liệt kê); dung lượng nhỏ vì dữ liệu mẫu ít tệp.
export interface DemoResetOptions {
  configuration: ApiConfiguration;
  identityDatabaseUrl: string;
  resetIntervalHours: number;
  now?: Date;
  fileStorage?: FileStorage;
  log?(message: string): void;
}

export interface DemoResetResult {
  report: DemoSeedReport;
  nextResetAt: Date;
}

export class DemoGuardError extends Error {}

const DEMO_SETTING_KEY = 'demo_environment';
const PLATFORM_ADMIN_ROLE = 'VT-01';

function vietnamDate(moment: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(moment);
}

// Kiểm tra trước khi xóa: đây là bản trình diễn hoặc cơ sở dữ liệu mới
export async function assertDemoTarget(
  system: Kysely<SystemDatabase>,
  identity: Kysely<IdentityDatabase>,
): Promise<void> {
  const marked = await system.selectFrom('demo_environment').select('id').executeTakeFirst();
  if (!marked) {
    const years = await system.selectFrom('academic_years').select('id').executeTakeFirst();
    if (years) {
      throw new DemoGuardError(
        'Cơ sở dữ liệu hệ thống đã có năm học mà chưa đánh dấu là bản trình diễn; không tạo dữ liệu trình diễn trên dữ liệu thật',
      );
    }
  }
  const identityMarked = await identity
    .selectFrom('identity_settings')
    .select('value')
    .where('key', '=', DEMO_SETTING_KEY)
    .executeTakeFirst();
  if (identityMarked?.value !== true) {
    const others = await identity
      .selectFrom('users')
      .select('users.id')
      .where((expression) =>
        expression.not(
          expression.exists(
            expression
              .selectFrom('user_roles')
              .innerJoin('roles', 'roles.id', 'user_roles.role_id')
              .select('user_roles.id')
              .whereRef('user_roles.user_id', '=', 'users.id')
              .where('roles.code', '=', PLATFORM_ADMIN_ROLE),
          ),
        ),
      )
      .executeTakeFirst();
    if (others) {
      throw new DemoGuardError(
        'Cơ sở dữ liệu định danh đã có tài khoản mà chưa đánh dấu là bản trình diễn; không tạo dữ liệu trình diễn trên dữ liệu thật',
      );
    }
  }
}

export async function resetDemoEnvironment(options: DemoResetOptions): Promise<DemoResetResult> {
  const log = options.log ?? ((message: string) => console.log(message));
  const now = options.now ?? new Date();
  const systemUrl = options.configuration.systemDatabaseUrl;
  const systemName = new URL(systemUrl).pathname.slice(1);
  const identity = createDatabase<IdentityDatabase>(options.identityDatabaseUrl);
  try {
    let system = createDatabase<SystemDatabase>(systemUrl);
    let yearDatabases: string[];
    try {
      await assertDemoTarget(system, identity);
      yearDatabases = (await system.selectFrom('academic_year_databases').select('database_name').execute()).map(
        (row) => row.database_name,
      );
    } finally {
      await system.destroy();
    }

    log('Xóa dữ liệu trình diễn cũ');
    const maintenanceUrl = replaceDatabaseName(systemUrl, 'postgres');
    // Cả cơ sở dữ liệu năm học mà lần tạo này sẽ mở (còn sót khi cơ sở dữ liệu hệ thống bị tạo lại bên ngoài lệnh)
    const { startYear } = demoAcademicYear(vietnamDate(now));
    const nextYearDatabase = `${options.configuration.schoolYearDatabasePrefix}${startYear}_${startYear + 1}`;
    for (const name of new Set([...yearDatabases, nextYearDatabase])) {
      await dropDatabaseIfExists(maintenanceUrl, name);
    }
    await dropDatabaseIfExists(maintenanceUrl, systemName);
    await createEmptyDatabase(maintenanceUrl, systemName);
    const migration = await migrateToLatest('system', systemUrl);
    if (migration.error) {
      throw migration.error;
    }
    await wipeIdentity(identity);

    log('Tạo tài khoản trình diễn');
    const userIds = await createDemoAccounts(identity);

    // Đánh dấu trước khi tạo dữ liệu để mọi tin nhắn, thanh toán phát sinh lúc tạo đều bị chặn
    const nextResetAt = new Date(now.getTime() + options.resetIntervalHours * 60 * 60_000);
    system = createDatabase<SystemDatabase>(systemUrl);
    try {
      await system
        .insertInto('demo_environment')
        .values({
          seed_version: DEMO_SEED_VERSION,
          seeded_at: now,
          reset_interval_hours: options.resetIntervalHours,
          next_reset_at: nextResetAt,
          accounts: JSON.stringify(demoAccountList()),
        })
        .execute();
    } finally {
      await system.destroy();
    }
    await identity
      .insertInto('identity_settings')
      .values({ key: DEMO_SETTING_KEY, value: JSON.stringify(true), updated_by: null })
      .execute();

    log('Tạo dữ liệu giả bằng máy chủ API trong tiến trình');
    const issuer = new DemoTokenIssuer();
    const configuration: ApiConfiguration = {
      ...options.configuration,
      tokenPublicKeyPem: issuer.publicKeyPem,
      notificationDispatchIntervalSeconds: 0,
      exportJobIntervalSeconds: 0,
      paymentGateways: ['development'],
      facebookPublisher: 'development',
      zaloSender: 'development',
    };
    const application = await createApplication(configuration, {
      identityClient: new DemoIdentityClient(configuration, identity),
      fileStorage: options.fileStorage,
    });
    try {
      await application.listen(0, '127.0.0.1');
      const port = (application.getHttpServer().address() as AddressInfo).port;
      const sessions = Object.fromEntries(
        await Promise.all(
          Object.entries(userIds).map(
            async ([key, userId]) => [key, { userId, token: await issuer.sign(userId, now) }] as const,
          ),
        ),
      );
      const report = await seedDemoData({
        baseUrl: `http://127.0.0.1:${port}/api/v1`,
        sessions,
        today: vietnamDate(now),
        log,
        assignUnitRoles: (unitIds) => assignDemoRoles(identity, userIds, unitIds, false),
      });
      const failed = report.steps.filter((item) => !item.ok).length;
      log(`Đã tạo dữ liệu trình diễn: ${report.steps.length - failed}/${report.steps.length} bước đạt`);
      return { report, nextResetAt };
    } finally {
      await application.close();
    }
  } finally {
    await identity.destroy();
  }
}

// Xóa dữ liệu của tài khoản ở cơ sở dữ liệu định danh; giữ vai trò, quyền của hệ thống do tệp thay đổi cấu trúc tạo
async function wipeIdentity(identity: Kysely<IdentityDatabase>): Promise<void> {
  await identity.transaction().execute(async (transaction) => {
    for (const table of [
      'sessions',
      'impersonations',
      'one_time_codes',
      'password_history',
      'security_events',
      'identity_audit_logs',
      'api_clients',
      'user_roles',
      'identity_settings',
    ] as const) {
      await sql`delete from ${sql.table(table)}`.execute(transaction);
    }
    await sql`delete from role_permissions where role_id in (select id from roles where is_system = false)`.execute(
      transaction,
    );
    await sql`delete from role_workspace_exclusions where role_id in (select id from roles where is_system = false)`.execute(
      transaction,
    );
    await sql`delete from roles where is_system = false`.execute(transaction);
    await sql`delete from users`.execute(transaction);
  });
}

// Tài khoản trình diễn; vai trò toàn trường gán ngay, vai trò theo đơn vị gán sau khi có cây đơn vị (assignDemoRoles)
async function createDemoAccounts(identity: Kysely<IdentityDatabase>): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const demoUser of DEMO_USERS) {
    const user = await identity
      .insertInto('users')
      .values({
        full_name: demoUser.full_name,
        username: demoUser.login,
        phone: null,
        password_hash: DEMO_PASSWORD_HASH,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    ids[demoUser.key] = user.id;
  }
  await assignDemoRoles(identity, ids, {}, true);
  return ids;
}

// Vai trò của tài khoản trình diễn gắn theo đơn vị nên chỉ gán được sau khi máy chủ API tạo cây đơn vị
export async function assignDemoRoles(
  identity: Kysely<IdentityDatabase>,
  userIds: Record<string, string>,
  unitIds: Record<string, string>,
  wholeSchool: boolean,
): Promise<void> {
  for (const demoUser of DEMO_USERS.filter((item) => (item.unit === null) === wholeSchool)) {
    const role = await identity
      .selectFrom('roles')
      .select('id')
      .where('code', '=', demoUser.role_code)
      .executeTakeFirstOrThrow();
    await identity
      .insertInto('user_roles')
      .values({
        user_id: userIds[demoUser.key] ?? '',
        role_id: role.id,
        org_unit_id: demoUser.unit ? (unitIds[demoUser.unit] ?? null) : null,
      })
      .execute();
  }
}
