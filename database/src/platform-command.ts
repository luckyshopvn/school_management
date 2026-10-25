import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { adoptExistingSchool, hostFromSiteSetting } from './adopt-existing.js';
import { createDatabase } from './connection.js';
import { readConnectionString } from './environment.js';
import { migrateToLatest } from './migrate.js';
import { deletionGraceDays, lifecycleEnvironmentOf } from './lifecycle-environment.js';
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
import { readMasterKey, readTenancyConfiguration, TenancyRuntime } from './tenancy-runtime.js';
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

async function withLifecycle(work: (environment: LifecycleEnvironment) => Promise<void>): Promise<void> {
  const configuration = readTenancyConfiguration(process.env);
  if (!configuration) {
    throw new Error('Thiếu PLATFORM_DATABASE_URL');
  }
  const runtime = new TenancyRuntime(configuration);
  try {
    await work(lifecycleEnvironmentOf(runtime));
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
                ? await requestDeletion(environment, code, CLI_ACTOR, reason, deletionGraceDays())
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
    'Lệnh: generate-master-key | migrate | adopt-existing | provision | provision-resume | provision-rollback | suspend | resume | request-deletion | cancel-deletion | purge-due | reissue-invitation | verify-domain | migrate-schools',
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
