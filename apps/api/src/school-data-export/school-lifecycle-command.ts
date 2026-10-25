import { writeFile } from 'node:fs/promises';
import {
  dueDeletions,
  lifecycleEnvironmentOf,
  purgeSchool,
  readTenancyConfiguration,
  TenancyRuntime,
  type Actor,
} from '@school-management/database';
import { runAsSchool } from '@school-management/server';
import { Redis } from 'ioredis';
import type { Kysely } from 'kysely';
import { readConfigurationFromEnvironment } from '../common/configuration.js';
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
//        xóa vĩnh viễn trường đã quá hạn chờ: cơ sở dữ liệu, vai trò, khóa, tên miền (thư viện vòng đời), tệp ở kho tệp có tiền
//        tố tenants/<tiền tố>/ và khóa Redis của trường; ghi bản ghi chứng minh đã xóa
const ACTOR: Actor = {
  type: 'cli',
  name: process.env.PLATFORM_CLI_ACTOR?.trim() || 'Lệnh vòng đời trường (máy chủ API)',
};

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

// Tệp của trường ở kho tệp (khóa do storageKey tạo có tiền tố tenants/<tiền tố của trường>/)
export async function purgeSchoolStorage(storage: FileStorage, keyPrefix: string): Promise<number> {
  if (!/^[A-Za-z0-9._-]+$/.test(keyPrefix)) {
    throw new Error('Tiền tố khóa của trường không hợp lệ');
  }
  return storage.deletePrefix(`tenants/${keyPrefix}/`);
}

// Khóa Redis của trường: cacheKey tạo `t:<tiền tố>:...`, dịch vụ định danh tạo `<tiền tố dịch vụ>:t:<tiền tố>:...`
export async function purgeSchoolCache(redis: Redis, keyPrefix: string): Promise<number> {
  if (!/^[A-Za-z0-9._-]+$/.test(keyPrefix)) {
    throw new Error('Tiền tố khóa của trường không hợp lệ');
  }
  let deleted = 0;
  for (const pattern of [`t:${keyPrefix}:*`, `*:t:${keyPrefix}:*`]) {
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 500);
      if (keys.length > 0) {
        deleted += await redis.del(...keys);
      }
      cursor = next;
    } while (cursor !== '0');
  }
  return deleted;
}

async function exportSchool(runtime: TenancyRuntime, code: string, out: string): Promise<void> {
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
        generatedBy: { user_id: null, full_name: ACTOR.name },
      });
    });
    await writeFile(out, archive.buffer);
    console.log(`Đã xuất ${archive.rowCount} dòng, ${archive.manifest.files.included} tệp vào ${out}`);
  } finally {
    await databases.onModuleDestroy();
  }
}

async function purgeDue(runtime: TenancyRuntime, only: string | undefined): Promise<void> {
  const configuration = readConfigurationFromEnvironment({ multiTenant: true });
  const environment = lifecycleEnvironmentOf(runtime);
  const storage = configuration.objectStorage ? new S3FileStorage(configuration.objectStorage) : null;
  const redis = configuration.redisUrl ? new Redis(configuration.redisUrl, { maxRetriesPerRequest: 3 }) : null;
  try {
    const codes = (await dueDeletions(environment)).filter((code) => !only || code === only);
    for (const code of codes) {
      const record = await purgeSchool(environment, code, ACTOR, {
        ...(storage ? { purgeStorage: (prefix: string) => purgeSchoolStorage(storage, prefix) } : {}),
        ...(redis ? { purgeCache: (prefix: string) => purgeSchoolCache(redis, prefix) } : {}),
      });
      console.log(`Đã xóa vĩnh viễn trường ${code}: ${JSON.stringify(record)}`);
    }
    console.log(`${codes.length} trường đã xóa`);
  } finally {
    redis?.disconnect();
  }
}

async function main(): Promise<number> {
  const command = process.argv[2];
  const configuration = readTenancyConfiguration(process.env);
  if (!configuration || (command !== 'export' && command !== 'purge-due')) {
    console.error(
      'Dùng: school-lifecycle-command.js export --code <mã> --out <tệp.zip> | purge-due [--code <mã>] (cần PLATFORM_DATABASE_URL)',
    );
    return 2;
  }
  const runtime = new TenancyRuntime(configuration);
  try {
    if (command === 'export') {
      const code = option('--code');
      const out = option('--out');
      if (!code || !out) {
        console.error('Cần --code và --out');
        return 2;
      }
      await exportSchool(runtime, code, out);
    } else {
      await purgeDue(runtime, option('--code'));
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
