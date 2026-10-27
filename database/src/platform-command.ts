import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { CATALOG_QUALITY_FLAGS, importSchoolCatalog } from './school-catalog.js';
import { generateVapidKeyPair, rotateVapidKeys } from './push-keys.js';
import { parseApnsKey, parseFcmServiceAccount, retireNativePushKey, storeNativePushKey } from './native-push-keys.js';
import { adoptExistingSchool, hostFromSiteSetting } from './adopt-existing.js';
import { createDatabase } from './connection.js';
import { readConnectionString } from './environment.js';
import { migrateToLatest } from './migrate.js';
import { lifecycleEnvironmentOf, lifecycleSettingsFrom } from './lifecycle-environment.js';
import {
  cancelDeletion,
  dueDeletions,
  LifecycleError,
  migrateSchools,
  purgeSchool,
  reissueInvitation,
  requestDeletion,
  resumeSchool,
  rollbackProvisioningJob,
  runProvisioningJob,
  startProvisioning,
  suspendSchool,
  verifyCustomDomain,
  type Actor,
  type LifecycleEnvironment,
  type SchoolSetupInput,
} from './school-lifecycle.js';
import { rewrapMasterKey, rotateChildKeys } from './key-rotation.js';
import { createSchoolDatabaseLayout } from './school-database-layout.js';
import { relayoutSchool } from './school-relayout.js';
import {
  backupSchool,
  drillRestore,
  latestBackupFile,
  pruneBackups,
  restoreSchool,
  verifyBackup,
  type BackupScope,
} from './school-backup.js';
import { moveSchoolToCluster } from './school-cluster-move.js';
import { readMasterKey, readTenancyConfiguration, TenancyRuntime } from './tenancy-runtime.js';
import { applyPlanLifecycle } from './school-plans.js';
import type { PlatformDatabase } from '../platform/schema.js';

// Lệnh quản trị nền tảng nhiều trường (DT-SaaS phần S1a, tài liệu 32 mục 14.5):
//   generate-master-key         in khóa gốc mới (32 byte, base64) để đặt vào PLATFORM_MASTER_KEY của nền tảng
//   migrate                     chạy tệp thay đổi cấu trúc của cơ sở dữ liệu nền tảng (PLATFORM_DATABASE_URL)
//   adopt-existing --code <mã> --name <tên> [--domains a,b]
//                               nhận bản triển khai đang chạy làm trường số 1: dùng lại cơ sở dữ liệu hiện có (không đổi tên,
//                               không chép dữ liệu); khóa dữ liệu trẻ lấy từ CHILD_DATA_ENCRYPTION_KEY, CHILD_DATA_HASH_KEY;
//                               tên miền lấy từ --domains hoặc PORTAL_SITE, PARENT_SITE, TEACHER_SITE, API_SITE; chạy lặp được
// Khởi tạo và vòng đời trường (DT-SaaS phần S2, YCTD-193; cần PLATFORM_ADMIN_DATABASE_URL):
//   provision --file <setup.json>      khởi tạo trường theo bước setup (cùng định dạng với biểu mẫu ở cổng nền tảng); in đường
//                                      liên kết kích hoạt quản trị viên đầu tiên một lần
//   provision-resume --job <mã việc>   chạy tiếp việc khởi tạo lỗi từ bước dở
//   provision-rollback --job <mã việc> hoàn tác việc khởi tạo lỗi, xóa sạch cơ sở dữ liệu, vai trò
//   suspend | resume | request-deletion | cancel-deletion --code <mã> [--reason <lý do>]
//   purge-due [--code <mã>]            xóa vĩnh viễn trường đã quá hạn chờ (cơ sở dữ liệu, vai trò, khóa, tên miền; tệp và khóa
//                                      Redis xóa bằng lệnh school-lifecycle purge của máy chủ API)
//   reissue-invitation --code <mã>     cấp lại đường liên kết kích hoạt quản trị viên đầu tiên
//   verify-domain --host <tên miền>    kiểm tra DNS của tên miền riêng đang chờ
//   migrate-schools [--canary <mã>] [--continue]
//                                      migrate cuốn chiếu mọi trường, ghi kết quả vào school_migrations
//   plan-lifecycle              chuyển trạng thái trường theo hạn dùng thử, hạn đã trả phí (S5a): chỉ đọc, tạm ngưng; in trường cần
//                               nhắc; chạy lặp được trong ngày
// Khóa (DT-SaaS phần S3, YCTD-195):
//   rotate-child-key --code <mã>       đổi khóa mã hóa dữ liệu trẻ của trường đang tạm dừng: mã hóa lại từng bước, làm tiếp được khi
//                                      chạy lại, ghi nhật ký; xong thì dùng lệnh resume để mở lại trường
//   rewrap-master-key                  bọc lại khóa của mọi trường bằng khóa gốc mới (PLATFORM_NEW_MASTER_KEY)
// Chuyển trường sang nền tảng hoặc bố cục khác (DT-SaaS phần S9, YCTD-203):
//   relayout --school <mã> --to database|schema
//                                      chép trường (đang tạm dừng hoặc chỉ đọc) sang nền tảng đích đặt bằng TARGET_PLATFORM_DATABASE_URL,
//                                      TARGET_PLATFORM_MASTER_KEY, TARGET_PLATFORM_ADMIN_DATABASE_URL (tạo cơ sở dữ liệu, vai trò),
//                                      TARGET_PLATFORM_SHARED_DATABASE (bố cục schema); so số dòng, tổng kiểm từng bảng
// Sao lưu, khôi phục, chuyển cụm theo từng trường (DT-SaaS phần S7b, YCTD-199); khóa mã hóa BACKUP_ENCRYPTION_PASSPHRASE, thư mục
// BACKUP_DIR (mặc định /var/backups/school-management/schools):
//   backup-school (--school <mã> | --all) [--scope all|active] [--keep-days 30]
//                                      BACKUP_SOURCE_HOST, BACKUP_SOURCE_PORT: đọc ở bản khôi phục tạm của cụm (PITR.md)
//                                      sao lưu logic từng trường vào <BACKUP_DIR>/<mã>/<thời điểm>-<phạm vi>.sbak, đọc lại kiểm tra
//   verify-backup --file <tệp>         kiểm tra mã xác thực, cấu trúc, số dòng của tệp sao lưu
//   restore-school --file <tệp> (--in-place | --as <mã mới>)
//                                      khôi phục vào chính trường (đang tạm dừng) hoặc thành trường mới (tạm dừng, để xem lại)
//   restore-drill (--file <tệp> | --school <mã> | --all)
//                                      khôi phục thử bản mới nhất vào trường tạm, kiểm tra rồi gỡ; ghi kết quả vào backup_runs
//   move-school --school <mã> [--drop-source]
//                                      chuyển trường sang cụm đặt bằng TARGET_CLUSTER_ADMIN_URL (TARGET_CLUSTER_LAYOUT,
//                                      TARGET_CLUSTER_SHARED_DATABASE); tạm dừng trong lúc chép, so số dòng, tổng kiểm
// Danh mục đơn vị toàn quốc (DT-24, YCTD-220; tài liệu 32 mục 16.6):
//   catalog-import --units <tệp.csv> [--communes <tệp.csv>] [--source <tên nguồn>] [--dry-run] [--deactivate-missing]
//                                      nhập hoặc cập nhật danh mục (so theo mã Bộ), in báo cáo thêm, sửa, giữ nguyên, bỏ qua
// Thông báo đẩy Web Push (DT-26 phần 26b, YCTD-232):
//   generate-vapid-keys --subject mailto:<thư> [--print-only]
//                                      sinh cặp khóa VAPID của nền tảng, lưu khóa riêng mã hóa bằng khóa gốc ở cơ sở dữ liệu nền tảng
//                                      (thay khóa đang dùng; đăng ký đẩy cũ phải đăng ký lại), in khóa công khai; --print-only in cả
//                                      hai khóa để đặt vào VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY của bản một trường, không ghi cơ sở dữ liệu
// Thông báo đẩy gốc FCM, APNs (DT-26 phần 26g, YCTD-237):
//   set-native-push-key --provider fcm --file <tệp tài khoản dịch vụ Firebase .json>
//   set-native-push-key --provider apns --file <tệp .p8> --key-id <mã khóa> --team-id <mã đội> --bundle-id <mã gói>
//                       [--environment sandbox|production]
//                                      lưu khóa của nền tảng mã hóa bằng khóa gốc (thay khóa đang dùng), in phần không bí mật
//   retire-native-push-key --provider fcm|apns
//                                      thôi dùng khóa: bộ nối đó tắt, kênh khác chạy như cũ
//   catalog-seed                       máy phát triển: nạp từ CATALOG_UNITS_FILE, CATALOG_COMMUNES_FILE (mặc định tệp khảo sát ở
//                                      ../.claude/logs-khaosat-csdl-moet và ../.claude/logs-khaosat-smis); không có tệp thì bỏ qua

function readOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

function readKey32(name: string): Buffer {
  const value = process.env[name]?.trim();
  const key = value ? Buffer.from(value, 'base64') : Buffer.alloc(0);
  if (key.length !== 32) {
    throw new Error(`Biến môi trường ${name} phải là 32 byte mã hóa base64`);
  }
  return key;
}

const [command, ...args] = process.argv.slice(2);

const CLI_ACTOR: Actor = { type: 'cli', name: process.env.PLATFORM_CLI_ACTOR?.trim() || 'Dòng lệnh nền tảng' };
const LIFECYCLE_SETTINGS = lifecycleSettingsFrom(process.env);

function backupPassphrase(): string {
  const value = process.env.BACKUP_ENCRYPTION_PASSPHRASE ?? '';
  if (value.length < 16) {
    throw new Error('Cần BACKUP_ENCRYPTION_PASSPHRASE (ít nhất 16 ký tự) để mã hóa, giải mã bản sao lưu');
  }
  return value;
}

function backupDirectory(): string {
  return process.env.BACKUP_DIR?.trim() || '/var/backups/school-management/schools';
}

async function servingSchoolCodes(environment: LifecycleEnvironment): Promise<string[]> {
  const rows = await environment.platform
    .selectFrom('schools')
    .select('code')
    .where('status', 'not in', ['provisioning', 'deleted'])
    .orderBy('code')
    .execute();
  return rows.map((row) => row.code);
}

async function backupCommand(): Promise<void> {
  if (command === 'verify-backup') {
    const contents = await verifyBackup(required('file'), backupPassphrase());
    console.log(
      `Tệp hợp lệ: trường ${contents.header.school.code}, lúc ${contents.header.created_at}, ${contents.header.databases.length} cơ sở dữ liệu, ${contents.tables} bảng, ${contents.rows} dòng`,
    );
    return;
  }
  await withLifecycle(async (environment) => {
    if (command === 'backup-school') {
      const scope = (readOption(args, 'scope') ?? 'all') as BackupScope;
      if (scope !== 'all' && scope !== 'active') {
        throw new Error('--scope là all hoặc active');
      }
      const keepDays = Number(readOption(args, 'keep-days') ?? 30);
      const codes = args.includes('--all') ? await servingSchoolCodes(environment) : [required('school')];
      let failed = 0;
      for (const code of codes) {
        try {
          const summary = await backupSchool({
            platform: environment.platform,
            masterKey: environment.masterKey,
            code,
            passphrase: backupPassphrase(),
            directory: backupDirectory(),
            scope,
            actor: CLI_ACTOR,
            sourceHost: process.env.BACKUP_SOURCE_HOST?.trim()
              ? {
                  host: process.env.BACKUP_SOURCE_HOST.trim(),
                  port: Number(process.env.BACKUP_SOURCE_PORT ?? 5432),
                }
              : null,
          });
          const removed = await pruneBackups(backupDirectory(), code, keepDays, scope);
          console.log(
            `${code}: ${summary.tables} bảng, ${summary.rows} dòng, ${summary.bytes} byte -> ${summary.file}${removed ? `; xóa ${removed} bản cũ` : ''}`,
          );
        } catch (error) {
          failed += 1;
          console.error(`${code}: LỖI ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      if (failed > 0) {
        process.exitCode = 1;
      }
      return;
    }
    const restoreEnvironment = {
      platform: environment.platform,
      masterKey: environment.masterKey,
      layout: environment.layout,
      systemDomain: environment.systemDomain,
    };
    if (command === 'restore-school') {
      const newCode = readOption(args, 'as');
      if (!newCode && !args.includes('--in-place')) {
        throw new Error('Chọn --in-place (khôi phục vào chính trường, trường phải đang tạm dừng) hoặc --as <mã mới>');
      }
      const result = await restoreSchool({
        environment: restoreEnvironment,
        file: required('file'),
        passphrase: backupPassphrase(),
        target: newCode ? { mode: 'new', code: newCode } : { mode: 'in-place' },
        actor: CLI_ACTOR,
      });
      console.log(
        `Đã khôi phục trường ${result.code}: ${result.databases} cơ sở dữ liệu, ${result.tables} bảng, ${result.rows} dòng trong ${Math.round(result.durationMilliseconds / 1000)} giây; trường đang tạm dừng, mở lại sau khi kiểm tra`,
      );
      return;
    }
    if (command === 'restore-drill') {
      const files: string[] = [];
      const file = readOption(args, 'file');
      if (file) {
        files.push(file);
      } else {
        const codes = args.includes('--all') ? await servingSchoolCodes(environment) : [required('school')];
        for (const code of codes) {
          const latest = await latestBackupFile(backupDirectory(), code);
          if (latest) {
            files.push(latest);
          } else {
            console.error(`${code}: chưa có bản sao lưu ở ${backupDirectory()}`);
            process.exitCode = 1;
          }
        }
      }
      for (const item of files) {
        try {
          const result = await drillRestore({
            environment: restoreEnvironment,
            file: item,
            passphrase: backupPassphrase(),
            actor: CLI_ACTOR,
          });
          console.log(
            `Diễn tập đạt: ${item}: ${result.tables} bảng, ${result.rows} dòng khớp; khôi phục mất ${Math.round(result.durationMilliseconds / 1000)} giây`,
          );
        } catch (error) {
          process.exitCode = 1;
          console.error(`Diễn tập LỖI: ${item}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      return;
    }
    // move-school
    const targetAdminUrl = process.env.TARGET_CLUSTER_ADMIN_URL?.trim();
    if (!targetAdminUrl) {
      throw new Error('Cần TARGET_CLUSTER_ADMIN_URL (tài khoản tạo cơ sở dữ liệu, vai trò ở cụm đích)');
    }
    const targetLayoutKind = (process.env.TARGET_CLUSTER_LAYOUT?.trim() || environment.layout.kind) as
      'database' | 'schema';
    const sharedDatabase = process.env.TARGET_CLUSTER_SHARED_DATABASE?.trim();
    const result = await moveSchoolToCluster({
      platform: environment.platform,
      masterKey: environment.masterKey,
      code: required('school'),
      sourceLayout: environment.layout,
      targetLayout: createSchoolDatabaseLayout(targetLayoutKind, {
        adminUrl: targetAdminUrl,
        ...(sharedDatabase ? { sharedDatabase } : {}),
      }),
      actor: CLI_ACTOR,
      dropSource: args.includes('--drop-source'),
      onProgress: (line) => console.log(line),
    });
    console.log(
      `Đã chuyển trường ${result.code} sang cụm ${result.cluster}: ${result.tables} bảng, ${result.rows} dòng khớp, ${Math.round(result.durationMilliseconds / 1000)} giây`,
    );
  });
}

async function withLifecycle(work: (environment: LifecycleEnvironment) => Promise<void>): Promise<void> {
  const configuration = readTenancyConfiguration(process.env);
  if (!configuration) {
    throw new Error('Thiếu PLATFORM_DATABASE_URL');
  }
  const runtime = new TenancyRuntime(configuration);
  try {
    await work(lifecycleEnvironmentOf(runtime, LIFECYCLE_SETTINGS));
  } finally {
    await runtime.close();
  }
}

function required(name: string): string {
  const value = readOption(args, name);
  if (!value) {
    throw new Error(`Cần --${name}`);
  }
  return value;
}

function activationPath(token: string): string {
  return `/activate?token=${token}`;
}

async function lifecycleCommand(): Promise<boolean> {
  const reason = readOption(args, 'reason') ?? null;
  switch (command) {
    case 'provision':
      await withLifecycle(async (environment) => {
        const input = JSON.parse(await readFile(required('file'), 'utf8')) as SchoolSetupInput;
        const { jobId } = await startProvisioning(environment, input, CLI_ACTOR);
        const result = await runProvisioningJob(environment, jobId);
        console.log(`Việc khởi tạo ${jobId}: ${result.status}${result.error ? ` (${result.error})` : ''}`);
        if (result.activationToken) {
          console.log(
            `Đường kích hoạt quản trị viên (chỉ in một lần, hạn 72 giờ): ${activationPath(result.activationToken)}`,
          );
        }
      });
      return true;
    case 'provision-resume':
      await withLifecycle(async (environment) => {
        const result = await runProvisioningJob(environment, required('job'));
        console.log(`Việc khởi tạo: ${result.status}${result.error ? ` (${result.error})` : ''}`);
        if (result.activationToken) {
          console.log(`Đường kích hoạt quản trị viên (chỉ in một lần): ${activationPath(result.activationToken)}`);
        }
      });
      return true;
    case 'provision-rollback':
      await withLifecycle((environment) => rollbackProvisioningJob(environment, required('job'), CLI_ACTOR));
      console.log('Đã hoàn tác việc khởi tạo');
      return true;
    case 'suspend':
    case 'resume':
    case 'request-deletion':
    case 'cancel-deletion':
      await withLifecycle(async (environment) => {
        const code = required('code');
        const school =
          command === 'suspend'
            ? await suspendSchool(environment, code, CLI_ACTOR, reason)
            : command === 'resume'
              ? await resumeSchool(environment, code, CLI_ACTOR, reason)
              : command === 'request-deletion'
                ? await requestDeletion(environment, code, CLI_ACTOR, reason, LIFECYCLE_SETTINGS.deletionGraceDays)
                : await cancelDeletion(environment, code, CLI_ACTOR, reason);
        console.log(`Trường ${code}: ${school.status}`);
      });
      return true;
    case 'purge-due':
      await withLifecycle(async (environment) => {
        const only = readOption(args, 'code');
        const codes = (await dueDeletions(environment)).filter((code) => !only || code === only);
        for (const code of codes) {
          await purgeSchool(environment, code, CLI_ACTOR);
          console.log(`Đã xóa vĩnh viễn trường ${code}`);
        }
        console.log(`${codes.length} trường đã xóa`);
      });
      return true;
    case 'reissue-invitation':
      await withLifecycle(async (environment) => {
        const token = await reissueInvitation(environment, required('code'), CLI_ACTOR);
        console.log(`Đường kích hoạt mới (chỉ in một lần): ${activationPath(token)}`);
      });
      return true;
    case 'verify-domain':
      await withLifecycle(async (environment) => {
        const result = await verifyCustomDomain(environment, required('host'), CLI_ACTOR);
        console.log(result.verified ? `${result.host}: đã xác nhận` : `${result.host}: ${result.problems.join('; ')}`);
      });
      return true;
    case 'rotate-child-key':
      await withLifecycle(async (environment) => {
        const result = await rotateChildKeys(environment, required('code'), CLI_ACTOR, {
          onProgress: (line) => console.log(line),
        });
        console.log(
          `Đổi khóa ${result.rotationId}: ${result.status}, ${result.rowsDone} dòng${result.resumed ? ' (làm tiếp)' : ''}; ` +
            'mở lại trường bằng lệnh resume',
        );
      });
      return true;
    case 'rewrap-master-key':
      // Khóa gốc cũ lấy từ PLATFORM_MASTER_KEY, khóa gốc mới từ PLATFORM_NEW_MASTER_KEY; xong thì đặt khóa mới vào PLATFORM_MASTER_KEY
      await withLifecycle(async (environment) => {
        const result = await rewrapMasterKey(
          environment.platform,
          environment.masterKey,
          readKey32('PLATFORM_NEW_MASTER_KEY'),
          CLI_ACTOR,
        );
        console.log(
          `Đã bọc lại ${result.keys} bộ khóa trường, ${result.passwords} mật khẩu kết nối, ${result.rotations} lần đổi khóa đang dở bằng khóa gốc mới; ` +
            'đặt PLATFORM_NEW_MASTER_KEY vào PLATFORM_MASTER_KEY ở mọi tiến trình',
        );
      });
      return true;
    case 'backup-school':
    case 'verify-backup':
    case 'restore-school':
    case 'restore-drill':
    case 'move-school':
      await backupCommand();
      return true;
    case 'relayout': {
      const code = required('school');
      const to = required('to');
      if (to !== 'database' && to !== 'schema') {
        throw new Error('--to là database hoặc schema');
      }
      const targetAdminUrl = process.env.TARGET_PLATFORM_ADMIN_DATABASE_URL?.trim();
      const targetPlatformUrl = process.env.TARGET_PLATFORM_DATABASE_URL?.trim();
      if (!targetAdminUrl || !targetPlatformUrl) {
        throw new Error(
          'Cần TARGET_PLATFORM_DATABASE_URL, TARGET_PLATFORM_ADMIN_DATABASE_URL, TARGET_PLATFORM_MASTER_KEY',
        );
      }
      const sharedDatabase = process.env.TARGET_PLATFORM_SHARED_DATABASE?.trim();
      const sourceConfiguration = readTenancyConfiguration(process.env);
      if (!sourceConfiguration) {
        throw new Error('Thiếu PLATFORM_DATABASE_URL của nền tảng nguồn');
      }
      const source = createDatabase<PlatformDatabase>(sourceConfiguration.platformDatabaseUrl, { max: 2 });
      const target = createDatabase<PlatformDatabase>(targetPlatformUrl, { max: 2 });
      try {
        const report = await relayoutSchool({
          source: { platform: source, masterKey: sourceConfiguration.masterKey },
          target: {
            platform: target,
            masterKey: readMasterKey({ PLATFORM_MASTER_KEY: process.env.TARGET_PLATFORM_MASTER_KEY }),
            layout: createSchoolDatabaseLayout(to, {
              adminUrl: targetAdminUrl,
              ...(sharedDatabase ? { sharedDatabase } : {}),
            }),
          },
          code,
          actor: CLI_ACTOR,
          onProgress: (line) => console.log(line),
        });
        console.log(
          `Đã chuyển trường ${code}: ${report.databases.length} cơ sở dữ liệu, ${report.tables.length} bảng khớp số dòng và tổng kiểm`,
        );
      } finally {
        await source.destroy();
        await target.destroy();
      }
      return true;
    }
    case 'migrate-schools':
      await withLifecycle(async (environment) => {
        const result = await migrateSchools(environment, {
          canaryCode: readOption(args, 'canary') ?? null,
          continueOnError: args.includes('--continue'),
          onProgress: (line) => console.log(line),
        });
        console.log(
          `Làn sóng ${result.waveId}: ${result.schools} trường, ${result.failed.length} lỗi${result.stopped ? ', đã dừng' : ''}`,
        );
        if (result.failed.length > 0) {
          process.exitCode = 1;
        }
      });
      return true;
    default:
      return false;
  }
}

async function readOptionalFile(path: string | undefined): Promise<string | null> {
  if (!path) {
    return null;
  }
  return existsSync(path) ? readFile(path, 'utf8') : null;
}

async function catalogCommand(): Promise<void> {
  let unitsPath: string | undefined;
  let communesPath: string | undefined;
  if (command === 'catalog-seed') {
    unitsPath =
      process.env.CATALOG_UNITS_FILE?.trim() || '../.claude/logs-khaosat-csdl-moet/danh_sach_truong_csdl_moet.csv';
    communesPath =
      process.env.CATALOG_COMMUNES_FILE?.trim() || '../.claude/logs-khaosat-smis/danh_muc_phuong_xa_smis.csv';
  } else {
    unitsPath = readOption(args, 'units');
    communesPath = readOption(args, 'communes');
    if (!unitsPath && !communesPath) {
      throw new Error('Cần --units <tệp đơn vị.csv> hoặc --communes <tệp phường, xã.csv>');
    }
  }
  const unitsCsv = await readOptionalFile(unitsPath);
  const communesCsv = await readOptionalFile(communesPath);
  if (command === 'catalog-seed' && !unitsCsv && !communesCsv) {
    console.log(`Không có tệp danh mục ở ${unitsPath} hoặc ${communesPath}: bỏ qua nạp danh mục`);
    return;
  }
  if (command === 'catalog-import' && ((unitsPath && !unitsCsv) || (communesPath && !communesCsv))) {
    throw new Error('Không đọc được tệp danh mục đã chỉ');
  }
  const platform = createDatabase<PlatformDatabase>(readConnectionString('platform'), { max: 2 });
  try {
    const report = await importSchoolCatalog(platform, {
      unitsCsv,
      communesCsv,
      source: readOption(args, 'source') ?? (command === 'catalog-seed' ? 'catalog-seed' : 'catalog-import'),
      fileName: unitsPath ? basename(unitsPath) : communesPath ? basename(communesPath) : null,
      dryRun: args.includes('--dry-run'),
      deactivateMissing: args.includes('--deactivate-missing'),
      actor: CLI_ACTOR,
    });
    const totals = report.totals;
    console.log(
      `${report.dry_run ? 'Chạy thử (chưa ghi): ' : ''}đọc ${totals.rows_read} dòng; sở thêm ${totals.departments_inserted}, sửa ${totals.departments_updated}; phường xã thêm ${totals.communes_inserted}, sửa ${totals.communes_updated}; đơn vị thêm ${totals.units_inserted}, sửa ${totals.units_updated}, giữ nguyên ${totals.units_unchanged}, bỏ qua ${totals.units_skipped}, gắn cờ ${totals.units_flagged}, không còn trong tệp ${totals.units_missing}, chuyển ngừng hoạt động ${totals.units_deactivated}`,
    );
    for (const [flag, count] of Object.entries(report.flags)) {
      console.log(`  cờ ${flag}: ${count} (${CATALOG_QUALITY_FLAGS[flag] ?? ''})`);
    }
    for (const row of report.skipped.slice(0, 20)) {
      console.log(`  bỏ qua dòng ${row.line}: ${row.reason}${row.code ? ` [${row.code}]` : ''}`);
    }
    if (report.skipped.length > 20) {
      console.log(`  ... và ${report.skipped.length - 20} dòng bỏ qua khác (xem catalog_import_runs ${report.run_id})`);
    }
  } finally {
    await platform.destroy();
  }
}

async function main(): Promise<void> {
  if (command === 'generate-master-key') {
    console.log(randomBytes(32).toString('base64'));
    return;
  }
  if (command === 'migrate') {
    const { error, results } = await migrateToLatest('platform', readConnectionString('platform'));
    for (const result of results ?? []) {
      console.log(`platform: ${result.migrationName} ${result.status}`);
    }
    if (error) {
      throw error;
    }
    console.log('platform: đã ở phiên bản cấu trúc mới nhất');
    return;
  }
  if (command === 'generate-vapid-keys') {
    if (args.includes('--print-only')) {
      const pair = generateVapidKeyPair();
      console.log(`VAPID_PUBLIC_KEY=${pair.publicKey}`);
      console.log(`VAPID_PRIVATE_KEY=${pair.privateKey}`);
      return;
    }
    const platform = createDatabase<PlatformDatabase>(readConnectionString('platform'), { max: 2 });
    try {
      const { publicKey } = await rotateVapidKeys(platform, readMasterKey(process.env), required('subject'));
      console.log(`Đã sinh khóa VAPID mới của nền tảng; khóa công khai: ${publicKey}`);
    } finally {
      await platform.destroy();
    }
    return;
  }
  if (command === 'set-native-push-key' || command === 'retire-native-push-key') {
    const provider = required('provider');
    if (provider !== 'fcm' && provider !== 'apns') {
      throw new Error('--provider là fcm hoặc apns');
    }
    const platform = createDatabase<PlatformDatabase>(readConnectionString('platform'), { max: 2 });
    try {
      if (command === 'retire-native-push-key') {
        const retired = await retireNativePushKey(platform, provider);
        console.log(retired ? `Đã thôi dùng khóa ${provider}` : `Không có khóa ${provider} đang dùng`);
        return;
      }
      const text = await readFile(required('file'), 'utf8');
      const credentials =
        provider === 'fcm'
          ? parseFcmServiceAccount(text)
          : parseApnsKey({
              privateKey: text,
              keyId: required('key-id'),
              teamId: required('team-id'),
              bundleId: required('bundle-id'),
              environment: readOption(args, 'environment') ?? 'production',
            });
      const summary = await storeNativePushKey(platform, readMasterKey(process.env), provider, credentials);
      console.log(`Đã lưu khóa ${provider} của nền tảng: ${JSON.stringify(summary)}`);
    } finally {
      await platform.destroy();
    }
    return;
  }
  if (command === 'catalog-import' || command === 'catalog-seed') {
    await catalogCommand();
    return;
  }
  if (command === 'plan-lifecycle') {
    const platform = createDatabase<PlatformDatabase>(readConnectionString('platform'), { max: 2 });
    try {
      const { changes, reminders } = await applyPlanLifecycle(platform, new Date(), { type: 'cli' });
      for (const change of changes) {
        console.log(`${change.code}: ${change.from} → ${change.to} (hạn ${change.dueOn ?? '—'})`);
      }
      for (const reminder of reminders) {
        console.log(`${reminder.code}: còn ${reminder.daysLeft} ngày (hạn ${reminder.dueOn})`);
      }
      console.log(`Đã chuyển trạng thái ${changes.length} trường, ${reminders.length} trường cần nhắc`);
    } finally {
      await platform.destroy();
    }
    return;
  }
  if (command === 'adopt-existing') {
    const code = readOption(args, 'code');
    const name = readOption(args, 'name');
    if (!code || !name) {
      throw new Error('Cần --code <mã trường> và --name <tên trường>');
    }
    const fromArgs = readOption(args, 'domains')?.split(',') ?? [];
    const fromEnvironment = ['PORTAL_SITE', 'PARENT_SITE', 'TEACHER_SITE', 'API_SITE'].map((variable) =>
      hostFromSiteSetting(process.env[variable]),
    );
    const domains = [...fromArgs, ...fromEnvironment].filter((value): value is string => Boolean(value));
    const platform = createDatabase<PlatformDatabase>(readConnectionString('platform'), { max: 2 });
    try {
      const result = await adoptExistingSchool({
        platform,
        masterKey: readMasterKey(process.env),
        code,
        name,
        domains,
        identityUrl: readConnectionString('identity'),
        systemUrl: readConnectionString('system'),
        yearDatabasePrefix: process.env.SCHOOL_YEAR_DATABASE_PREFIX ?? 'school_year_',
        childEncryptionKey: readKey32('CHILD_DATA_ENCRYPTION_KEY'),
        childHashKey: readKey32('CHILD_DATA_HASH_KEY'),
      });
      console.log(
        `${result.created ? 'Đã nhận' : 'Đã cập nhật'} bản đang chạy làm trường ${code}: ${result.databases.length} cơ sở dữ liệu, tên miền ${result.domains.join(', ')}`,
      );
    } finally {
      await platform.destroy();
    }
    return;
  }
  if (await lifecycleCommand()) {
    return;
  }
  throw new Error(
    'Lệnh: generate-master-key | migrate | adopt-existing | provision | provision-resume | provision-rollback | suspend | resume | request-deletion | cancel-deletion | purge-due | reissue-invitation | verify-domain | migrate-schools | relayout | backup-school | verify-backup | restore-school | restore-drill | move-school | catalog-import | catalog-seed | generate-vapid-keys | set-native-push-key | retire-native-push-key',
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  if (error instanceof LifecycleError) {
    for (const problem of error.problems) {
      console.error(`  ${problem.field}: ${problem.message}`);
    }
  }
  process.exitCode = 1;
});
