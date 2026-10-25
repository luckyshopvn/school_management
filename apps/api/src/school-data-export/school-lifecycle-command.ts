import { writeFile } from 'node:fs/promises';
import {
  dueDeletions,
  lifecycleEnvironmentOf,
  purgeSchool,
  TenancyRuntime,
  type Actor,
} from '@school-management/database';
import { runAsSchool, type TenantContext } from '@school-management/server';
import { tenantStoragePrefix } from '@school-management/server/resource-names';
import type { Kysely } from 'kysely';
import {
  readConfigurationFromEnvironment,
  readPlatformCommandSettings,
  type PlatformCommandSettings,
} from '../common/configuration.js';
import { Databases } from '../common/databases.js';
import { FileStorage, S3FileStorage } from '../files/file-storage.js';
import { buildSchoolDataArchive, schoolArchiveSources } from './school-data-archive.js';

// Lệnh xuất và xóa vĩnh viễn dữ liệu một trường của nền tảng nhiều trường (DT-SaaS phần S2, YCTD-193; tài liệu 32 mục 14.5),
// chạy trong ảnh máy chủ API với biến môi trường của máy chủ API và của nền tảng (PLATFORM_DATABASE_URL, PLATFORM_MASTER_KEY,
// PLATFORM_ADMIN_DATABASE_URL):
//   node dist/school-data-export/school-lifecycle-command.js export --code <mã> --out <tệp.zip>
//        gói ZIP toàn bộ dữ liệu của trường (cùng định dạng gói của DT-18 phần 18h, thêm cơ sở dữ liệu định danh không có cột
//        bí mật) để bàn giao trước khi xóa
//   node dist/school-data-export/school-lifecycle-command.js purge-due [--code <mã>]
//        xóa vĩnh viễn trường đã quá hạn chờ: cơ sở dữ liệu, vai trò, khóa, tên miền (thư viện vòng đời) và tệp của trường ở kho
//        tệp; ghi bản ghi chứng minh đã xóa. Khóa Redis của trường (giới hạn đăng nhập, mã xác nhận, việc xếp thời khóa biểu) đều
//        có hạn sống tối đa 2 giờ nên tự hết, lệnh không xóa
function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

// Tệp của trường ở kho tệp: mọi khóa do storageKey tạo trong ngữ cảnh của trường
export function purgeSchoolStorage(storage: FileStorage, tenant: TenantContext): Promise<number> {
  return runAsSchool(tenant, async () => storage.deletePrefix(tenantStoragePrefix()));
}

async function exportSchool(
  runtime: TenancyRuntime,
  settings: PlatformCommandSettings,
  code: string,
  out: string,
): Promise<void> {
  const configuration = readConfigurationFromEnvironment({ multiTenant: true });
  const school = await runtime.platform.selectFrom('schools').select('id').where('code', '=', code).executeTakeFirst();
  const record = school ? await runtime.registry.loadSchool(school.id) : null;
  if (!record || !configuration.objectStorage) {
    throw new Error(`Không tìm thấy trường ${code} hoặc chưa cấu hình kho tệp`);
  }
  const databases = new Databases(configuration, runtime);
  const storage = new S3FileStorage(configuration.objectStorage);
  try {
    const archive = await runAsSchool(record.context, async () => {
      const sources = await schoolArchiveSources(databases);
      sources.push({
        label: 'dinh-danh',
        description: 'Cơ sở dữ liệu định danh (không có mật khẩu, mã bí mật)',
        database: runtime.connections.database<unknown>(record.context, 'identity', 'identity') as Kysely<unknown>,
      });
      return buildSchoolDataArchive({
        sources,
        fileStorage: storage,
        generatedAt: new Date(),
        generatedBy: { user_id: null, full_name: settings.actorName },
      });
    });
    await writeFile(out, archive.buffer);
    console.log(`Đã xuất ${archive.rowCount} dòng, ${archive.manifest.files.included} tệp vào ${out}`);
  } finally {
    await databases.onModuleDestroy();
  }
}

async function purgeDue(runtime: TenancyRuntime, settings: PlatformCommandSettings, only: string | undefined) {
  const configuration = readConfigurationFromEnvironment({ multiTenant: true });
  const environment = lifecycleEnvironmentOf(runtime, settings.lifecycle);
  const actor: Actor = { type: 'cli', name: settings.actorName };
  const storage = configuration.objectStorage ? new S3FileStorage(configuration.objectStorage) : null;
  const codes = (await dueDeletions(environment)).filter((code) => !only || code === only);
  for (const code of codes) {
    // Nạp ngữ cảnh của trường trước khi xóa khóa và cơ sở dữ liệu ở nền tảng
    const school = await runtime.platform
      .selectFrom('schools')
      .select('id')
      .where('code', '=', code)
      .executeTakeFirstOrThrow();
    const record = await runtime.registry.loadSchool(school.id);
    const proof = await purgeSchool(environment, code, actor, {
      ...(storage && record ? { purgeStorage: () => purgeSchoolStorage(storage, record.context) } : {}),
    });
    console.log(`Đã xóa vĩnh viễn trường ${code}: ${JSON.stringify(proof)}`);
  }
  console.log(`${codes.length} trường đã xóa`);
}

async function main(): Promise<number> {
  const command = process.argv[2];
  const settings = readPlatformCommandSettings();
  if (!settings.tenancy || (command !== 'export' && command !== 'purge-due')) {
    console.error(
      'Dùng: school-lifecycle-command.js export --code <mã> --out <tệp.zip> | purge-due [--code <mã>] (cần PLATFORM_DATABASE_URL)',
    );
    return 2;
  }
  const runtime = new TenancyRuntime(settings.tenancy);
  try {
    if (command === 'export') {
      const code = option('--code');
      const out = option('--out');
      if (!code || !out) {
        console.error('Cần --code và --out');
        return 2;
      }
      await exportSchool(runtime, settings, code, out);
    } else {
      await purgeDue(runtime, settings, option('--code'));
    }
    return 0;
  } finally {
    await runtime.close();
  }
}

if (process.argv[1]?.endsWith('school-lifecycle-command.js')) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
