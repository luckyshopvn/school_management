import { join } from 'node:path';
import { sql } from 'kysely';
import type { PlatformDatabase } from '../platform/schema.js';
import type { SystemDatabase } from '../system/schema.js';
import { createDatabase } from './connection.js';
import { readConnectionString, replaceDatabaseName } from './environment.js';
import { lifecycleEnvironmentOf, lifecycleSettingsFrom } from './lifecycle-environment.js';
import { schoolYearDatabasesToMigrate } from './migrate.js';
import { backupTablesBeforeRemoval, recordRemovedDataBackup } from './removed-data-backup.js';
import {
  backupTutoringDatabase,
  schoolYearConnectionsToMigrate,
  TUTORING_FEATURE,
  type TutoringBackupResult,
} from './removed-tutoring-backup.js';
import { assertIdentifier } from './school-database-layout.js';
import { readTenancyConfiguration, TenancyRuntime } from './tenancy-runtime.js';

// Sao lưu rồi xóa dữ liệu của chức năng đã bỏ (YCTD-384):
//   pnpm --filter @school-management/database xoa-du-lieu-da-bo -- --tinh-nang cho-gia-su [--xoa-co-so-du-lieu]
//   pnpm --filter @school-management/database xoa-du-lieu-da-bo -- --tinh-nang gia-su-trong-truong
// Chợ gia sư đã tách thành sản phẩm riêng, dữ liệu không chuyển (quyết định của Eric ngày 2026-10-30). Lệnh:
//   (1) sao lưu mọi bảng của cơ sở dữ liệu chợ (MARKETPLACE_DATABASE_URL, nếu có) kèm cấu hình khóa `market` của platform_settings
//       vào <BACKUP_DIR>/removed/cho-gia-su/, mã hóa bằng BACKUP_ENCRYPTION_PASSPHRASE, đọc lại kiểm tra;
//   (2) ghi số dòng, tổng kiểm từng bảng vào removed_data_backups của cơ sở dữ liệu nền tảng (PLATFORM_DATABASE_URL);
//   (3) có --xoa-co-so-du-lieu thì xóa cơ sở dữ liệu và vai trò của chợ bằng PLATFORM_ADMIN_DATABASE_URL.
// Database migration nền tảng 0255 xóa khóa `market` chỉ khi đã có bản ghi của bước (2). Không in mật khẩu, khóa ra màn hình.
// Chương trình gia sư trong trường DT-27 cũng bỏ (lát L3): với `gia-su-trong-truong`, lệnh sao lưu các bảng gia sư của mọi cơ sở dữ
// liệu năm học sẽ chạy database migration 0235 (nhiều trường khi có PLATFORM_DATABASE_URL: mọi trường không ở trạng thái đang khởi
// tạo, đã xóa, năm học không chỉ đọc; một trường: năm học đang dùng của SYSTEM_DATABASE_URL) vào
// <BACKUP_DIR>/removed[/<mã trường>]/gia-su-trong-truong/, ghi số dòng vào removed_data_backups của chính cơ sở dữ liệu đó. Năm đã
// đóng giữ nguyên cấu trúc (QU-11) nên không bị xóa bảng, không cần sao lưu
export const MARKET_FEATURE = 'cho-gia-su';

function readOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name}`);
  }
  return value;
}

function backupDirectory(): string {
  const base = process.env.BACKUP_DIR?.trim() || '/var/backups/school-management/schools';
  return `${base.replace(/[\\/]+$/, '')}/removed`;
}

function backupPassphrase(): string {
  const passphrase = process.env.BACKUP_ENCRYPTION_PASSPHRASE ?? '';
  if (passphrase.length < 16) {
    throw new Error('Cần BACKUP_ENCRYPTION_PASSPHRASE (ít nhất 16 ký tự) để mã hóa bản sao lưu');
  }
  return passphrase;
}

function printTutoringResult(label: string, result: TutoringBackupResult): void {
  const links = Object.entries(result.extraRows)
    .map(([key, rows]) => `${key} ${rows}`)
    .join(', ');
  if (!result.backup) {
    console.log(`${label}: không còn dữ liệu gia sư; đã ghi nhận đã xử lý`);
    return;
  }
  const rows = result.backup.totals.reduce((sum, total) => sum + total.rows, 0);
  console.log(
    `${label}: đã sao lưu ${result.backup.totals.length} bảng, ${rows} dòng${links ? `, dòng liên kết: ${links}` : ''} vào ${result.backup.file}`,
  );
  console.log(`${label}: mã băm SHA-256 của tệp: ${result.backup.sha256}`);
}

async function backupInSchoolTutoring(): Promise<void> {
  const passphrase = backupPassphrase();
  const directory = backupDirectory();
  const configuration = readTenancyConfiguration(process.env);
  if (configuration) {
    const runtime = new TenancyRuntime(configuration);
    try {
      const environment = lifecycleEnvironmentOf(runtime, lifecycleSettingsFrom(process.env));
      const targets = await schoolYearConnectionsToMigrate(environment);
      for (const target of targets) {
        const result = await backupTutoringDatabase({
          connectionString: target.connectionString,
          databaseName: target.databaseName,
          directory: join(directory, target.schoolCode),
          passphrase,
        });
        printTutoringResult(`${target.schoolCode} ${target.databaseName}`, result);
      }
      console.log(`Đã xử lý ${targets.length} cơ sở dữ liệu năm học`);
    } finally {
      await runtime.close();
    }
    return;
  }
  const systemUrl = readConnectionString('system');
  const system = createDatabase<SystemDatabase>(systemUrl, { max: 1 });
  let names: string[];
  try {
    names = await schoolYearDatabasesToMigrate(system);
  } finally {
    await system.destroy();
  }
  for (const name of names) {
    const result = await backupTutoringDatabase({
      connectionString: replaceDatabaseName(systemUrl, name),
      directory,
      passphrase,
    });
    printTutoringResult(name, result);
  }
  console.log(`Đã xử lý ${names.length} cơ sở dữ liệu năm học`);
}

async function removeMarketplace(args: string[]): Promise<void> {
  const passphrase = backupPassphrase();
  const platform = createDatabase<PlatformDatabase>(required('PLATFORM_DATABASE_URL'), { max: 1 });
  try {
    const setting = await platform
      .selectFrom('platform_settings')
      .select('value')
      .where('key', '=', 'market')
      .executeTakeFirst();
    const marketUrl = process.env.MARKETPLACE_DATABASE_URL?.trim();
    const directory = backupDirectory();
    let databaseName = '(không có cơ sở dữ liệu chợ)';
    let backup = null;
    if (marketUrl) {
      databaseName = decodeURIComponent(new URL(marketUrl).pathname.slice(1));
      backup = await backupTablesBeforeRemoval({
        connectionString: marketUrl,
        feature: MARKET_FEATURE,
        tables: 'all',
        directory,
        passphrase,
        extra: setting ? { platform_settings_market: setting.value } : {},
      });
    }
    await recordRemovedDataBackup(platform as never, { feature: MARKET_FEATURE, databaseName, backup });
    if (backup) {
      const rows = backup.totals.reduce((sum, total) => sum + total.rows, 0);
      console.log(`Đã sao lưu ${backup.totals.length} bảng, ${rows} dòng của ${databaseName} vào ${backup.file}`);
      console.log(`Mã băm SHA-256 của tệp: ${backup.sha256}`);
    } else {
      console.log('Không có dữ liệu chợ gia sư để sao lưu; đã ghi nhận chức năng đã xử lý');
    }
    if (args.includes('--xoa-co-so-du-lieu') && marketUrl) {
      const admin = createDatabase<unknown>(required('PLATFORM_ADMIN_DATABASE_URL'), { max: 1 });
      try {
        const roleName = decodeURIComponent(new URL(marketUrl).username);
        assertIdentifier(databaseName, 'Tên cơ sở dữ liệu');
        assertIdentifier(roleName, 'Tên vai trò');
        await sql`drop database if exists ${sql.id(databaseName)} with (force)`.execute(admin);
        await sql`drop role if exists ${sql.id(roleName)}`.execute(admin);
        console.log(
          `Đã xóa cơ sở dữ liệu ${databaseName} và vai trò ${roleName}; gỡ MARKETPLACE_DATABASE_URL khỏi tệp môi trường`,
        );
      } finally {
        await admin.destroy();
      }
    }
  } finally {
    await platform.destroy();
  }
}

const args = process.argv.slice(2);
const feature = readOption(args, 'tinh-nang');
try {
  if (feature === MARKET_FEATURE) {
    await removeMarketplace(args);
  } else if (feature === TUTORING_FEATURE) {
    await backupInSchoolTutoring();
  } else {
    throw new Error(`--tinh-nang phải là: ${MARKET_FEATURE}, ${TUTORING_FEATURE}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
