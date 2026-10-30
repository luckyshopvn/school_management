import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import type { PlatformDatabase } from '../platform/schema.js';
import { adoptExistingSchool } from './adopt-existing.js';
import { createDatabase } from './connection.js';
import { readConnectionString } from './environment.js';
import { linkDemoCatalogUnit, readEnvironmentValue, updateEnvironmentText } from './local-multi-school.js';
import { migrateToLatest } from './migrate.js';
import { provisionOwnedDatabase } from './owned-database.js';
import { CATALOG_QUALITY_FLAGS, importSchoolCatalog } from './school-catalog.js';
import { testAdminDatabaseUrl } from './test-admin.js';

// Dựng bản nhiều trường trên máy phát triển, song song với bản một trường (YCTD-310; hướng dẫn ở tai_lieu/47 mục 16.10). Chạy lặp được:
//   pnpm --filter @school-management/database nhieu-truong-cuc-bo --school-code <mã> --school-name <tên> [tùy chọn]
// Các bước: (1) tạo vai trò platform_local và cơ sở dữ liệu nền tảng riêng (mật khẩu sinh mới, giữ nguyên khi chạy lại); (2) migrate;
// (3) ghi tệp môi trường riêng (mặc định ../.env.nhieu-truong, phải nằm trong
// .gitignore): địa chỉ nền tảng, khóa gốc sinh mới, tên miền chung, tên miền cổng nền tảng, cổng riêng; (4) nạp danh mục đơn vị từ tệp
// CSV chỉ bằng tham số; (5) nhận bản một trường làm trường của nền tảng (adopt-existing: dùng lại cơ sở dữ liệu, không chép); (6) gắn
// trường demo vào danh mục ở sở, phường chỉ định để chọn được trên trang đăng nhập.
// Việc nền chạy theo giờ bật mặc định; còn chạy bản một trường trên cùng cơ sở dữ liệu thì thêm --tat-viec-nen để không chạy trùng.
// Tùy chọn:
//   --env-out <tệp>               tệp môi trường của bản nhiều trường (mặc định ../.env.nhieu-truong)
//   --database <tên>              cơ sở dữ liệu nền tảng (mặc định school_platform)
//   --tat-viec-nen                tắt việc nền chạy theo giờ (khi bản một trường còn chạy trên cùng cơ sở dữ liệu)
//   --root-domain <tên miền>      tên miền chung có ô chọn đơn vị (mặc định truong.localhost)
//   --api-port, --identity-port   cổng máy chủ API, dịch vụ định danh (mặc định 3100, 3101)
//   --units <tệp.csv> [--communes <tệp.csv>]   danh mục đơn vị, phường xã (cột như tài liệu 47 mục 16.6); bỏ qua thì không nạp
//   --school-domain <tên miền>    tên miền của trường demo (mặc định <mã chữ thường>.<tên miền chung>)
//   --demo-moet-code <mã> --demo-department <mã sở> --demo-commune <mã phường xã> [--demo-levels MN,TH]
//                                 đơn vị của trường demo trong danh mục (nguồn demo-local)
// Không in mật khẩu, khóa ra màn hình.

const args = process.argv.slice(2);

function option(name: string, fallback?: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  const value = index >= 0 ? args[index + 1] : undefined;
  return value && !value.startsWith('--') ? value : fallback;
}

function required(name: string): string {
  const value = option(name);
  if (!value) {
    throw new Error(`Thiếu --${name}`);
  }
  return value;
}

function port(name: string, fallback: number): number {
  const value = Number(option(name, String(fallback)));
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`--${name} phải là số cổng`);
  }
  return value;
}

function key32(name: string): Buffer {
  const key = Buffer.from(process.env[name]?.trim() ?? '', 'base64');
  if (key.length !== 32) {
    throw new Error(`Biến môi trường ${name} của bản một trường phải là 32 byte mã hóa base64`);
  }
  return key;
}

// Tệp chứa mật khẩu, khóa gốc phải được git bỏ qua; ngoài kho git thì không kiểm được, chỉ cảnh báo
function assertIgnored(path: string): void {
  const result = spawnSync('git', ['check-ignore', '-q', basename(path)], { cwd: dirname(path) });
  if (result.status === 1) {
    throw new Error(`${path} không nằm trong .gitignore: không ghi mật khẩu, khóa vào tệp có thể bị đưa lên kho`);
  }
  if (result.status !== 0) {
    console.warn(`Cảnh báo: không kiểm được ${path} có nằm trong .gitignore không`);
  }
}

async function main(): Promise<void> {
  const schoolCode = required('school-code');
  const schoolName = required('school-name');
  const envPath = resolve(option('env-out', '../.env.nhieu-truong') as string);
  const databaseName = option('database', 'school_platform') as string;
  const rootDomain = (option('root-domain', 'truong.localhost') as string).toLowerCase();
  const apiPort = port('api-port', 3100);
  const identityPort = port('identity-port', 3101);
  const schoolDomain = (option('school-domain') ?? `${schoolCode.toLowerCase()}.${rootDomain}`).toLowerCase();

  assertIgnored(envPath);
  const existing = existsSync(envPath) ? await readFile(envPath, 'utf8') : '';
  const existingUrl = readEnvironmentValue(existing, 'PLATFORM_DATABASE_URL');
  const rolePassword = existingUrl
    ? decodeURIComponent(new URL(existingUrl).password)
    : randomBytes(24).toString('base64url');
  const masterKey = readEnvironmentValue(existing, 'PLATFORM_MASTER_KEY') ?? randomBytes(32).toString('base64');

  const platformUrl = await provisionOwnedDatabase({
    adminUrl: testAdminDatabaseUrl(process.env),
    databaseName,
    roleName: 'platform_local',
    rolePassword,
  });
  const migration = await migrateToLatest('platform', platformUrl);
  if (migration.error) {
    throw migration.error;
  }
  console.log(`Cơ sở dữ liệu nền tảng ${databaseName}: đã ở phiên bản cấu trúc mới nhất`);

  const header = existing
    ? existing
    : '# Bản nhiều trường trên máy (YCTD-310), sinh bởi lệnh nhieu-truong-cuc-bo; chứa mật khẩu, khóa: không đưa lên kho.\n' +
      '# Chạy kèm tệp .env của bản một trường: biến ở đây đè biến cùng tên ở .env\n';
  const redisUrl = process.env.REDIS_URL?.trim() || 'redis://127.0.0.1:6379';
  // Bản một trường còn chạy trên cùng cơ sở dữ liệu thì tắt việc nền theo giờ ở bản nhiều trường (--tat-viec-nen) để không chạy trùng;
  // mặc định bật (Eric dừng bản một trường ngày 2026-10-28)
  const jobsOff = args.includes('--tat-viec-nen');
  await writeFile(
    envPath,
    updateEnvironmentText(header, {
      PLATFORM_DATABASE_URL: platformUrl,
      PLATFORM_MASTER_KEY: masterKey,
      PLATFORM_ROOT_DOMAIN: rootDomain,
      // Cổng nền tảng: đăng nhập tài khoản vận hành, mở phiên quản trị vào trường bất kỳ
      PLATFORM_CONSOLE_HOST: `platform.${rootDomain}`,
      TENANT_HOST_SOURCE: 'host',
      TENANT_CACHE_SECONDS: '5',
      API_PORT: String(apiPort),
      IDENTITY_PORT: String(identityPort),
      API_BASE_URL: `http://127.0.0.1:${apiPort}`,
      IDENTITY_BASE_URL: `http://127.0.0.1:${identityPort}`,
      // localhost trên một số máy Windows trỏ IPv6 và cổng chuyển tiếp IPv6 của Docker có thể treo
      REDIS_URL: redisUrl.replace('://localhost', '://127.0.0.1'),
      SCHEDULER_MODE: jobsOff ? 'external' : null,
      SCHOOL_METRICS_INTERVAL_SECONDS: jobsOff ? '0' : null,
      AGGREGATE_SNAPSHOT_INTERVAL_SECONDS: jobsOff ? '0' : null,
      // Chợ gia sư đã tách thành sản phẩm riêng (YCTD-393): gỡ biến cũ khỏi tệp môi trường khi chạy lại
      MARKETPLACE_DATABASE_URL: null,
      MARKET_LINK_SECRET: null,
      MARKET_FILES_KEY: null,
      // Tên miền của trường demo để tập lệnh chạy in bảng địa chỉ
      NHIEU_TRUONG_TEN_MIEN_TRUONG_DEMO: schoolDomain,
    }),
    { encoding: 'utf8', mode: 0o600 },
  );
  console.log(`Đã ghi ${envPath}`);

  const platform = createDatabase<PlatformDatabase>(platformUrl, { max: 2 });
  try {
    const unitsPath = option('units');
    const communesPath = option('communes');
    if (unitsPath || communesPath) {
      const report = await importSchoolCatalog(platform, {
        unitsCsv: unitsPath ? await readFile(unitsPath, 'utf8') : null,
        communesCsv: communesPath ? await readFile(communesPath, 'utf8') : null,
        source: 'nhieu-truong-cuc-bo',
        fileName: basename(unitsPath ?? communesPath ?? ''),
        actor: { type: 'cli', name: 'Dựng bản nhiều trường trên máy' },
      });
      const totals = report.totals;
      console.log(
        `Danh mục: đọc ${totals.rows_read} dòng; đơn vị thêm ${totals.units_inserted}, sửa ${totals.units_updated}, giữ nguyên ${totals.units_unchanged}, bỏ qua ${totals.units_skipped}; phường xã thêm ${totals.communes_inserted}`,
      );
      for (const [flag, count] of Object.entries(report.flags)) {
        console.log(`  cờ ${flag}: ${count} (${CATALOG_QUALITY_FLAGS[flag] ?? ''})`);
      }
    }

    const adopted = await adoptExistingSchool({
      platform,
      masterKey: Buffer.from(masterKey, 'base64'),
      code: schoolCode,
      name: schoolName,
      domains: [schoolDomain],
      identityUrl: readConnectionString('identity'),
      systemUrl: readConnectionString('system'),
      yearDatabasePrefix: process.env.SCHOOL_YEAR_DATABASE_PREFIX ?? 'school_year_',
      childEncryptionKey: key32('CHILD_DATA_ENCRYPTION_KEY'),
      childHashKey: key32('CHILD_DATA_HASH_KEY'),
      dataClass: 'synthetic',
    });
    console.log(
      `${adopted.created ? 'Đã nhận' : 'Đã cập nhật'} trường ${schoolCode} (dùng lại ${adopted.databases.length} cơ sở dữ liệu của bản một trường), tên miền ${adopted.domains.join(', ')}`,
    );

    const demoMoetCode = option('demo-moet-code');
    if (demoMoetCode) {
      const linked = await linkDemoCatalogUnit(platform, {
        schoolCode,
        moetCode: demoMoetCode,
        name: schoolName,
        departmentCode: required('demo-department'),
        communeCode: required('demo-commune'),
        levels: (option('demo-levels', 'MN') as string).split(','),
      });
      console.log(
        `Đã gắn trường ${schoolCode} với đơn vị ${demoMoetCode} ở Sở GD&ĐT ${linked.departmentName}, ${linked.communeName}`,
      );
    }
  } finally {
    await platform.destroy();
  }
  console.log(`Trang đăng nhập theo đơn vị: http://${rootDomain}:<cổng cổng quản trị>/ (xem tài liệu 47 mục 16.10)`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
