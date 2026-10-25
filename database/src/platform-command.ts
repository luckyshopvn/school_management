import { randomBytes } from 'node:crypto';
import { adoptExistingSchool, hostFromSiteSetting } from './adopt-existing.js';
import { createDatabase } from './connection.js';
import { readConnectionString } from './environment.js';
import { migrateToLatest } from './migrate.js';
import { readMasterKey } from './tenancy-runtime.js';
import { applyPlanLifecycle } from './school-plans.js';
import type { PlatformDatabase } from '../platform/schema.js';

// Lệnh quản trị nền tảng nhiều trường (DT-SaaS phần S1a, tài liệu 32 mục 14.5):
//   generate-master-key         in khóa gốc mới (32 byte, base64) để đặt vào PLATFORM_MASTER_KEY của nền tảng
//   migrate                     chạy tệp thay đổi cấu trúc của cơ sở dữ liệu nền tảng (PLATFORM_DATABASE_URL)
//   adopt-existing --code <mã> --name <tên> [--domains a,b]
//                               nhận bản triển khai đang chạy làm trường số 1: dùng lại cơ sở dữ liệu hiện có (không đổi tên,
//                               không chép dữ liệu); khóa dữ liệu trẻ lấy từ CHILD_DATA_ENCRYPTION_KEY, CHILD_DATA_HASH_KEY;
//                               tên miền lấy từ --domains hoặc PORTAL_SITE, PARENT_SITE, TEACHER_SITE, API_SITE; chạy lặp được
//   plan-lifecycle              chuyển trạng thái trường theo hạn dùng thử, hạn đã trả phí (S5a): chỉ đọc, tạm ngưng; in trường cần
//                               nhắc; chạy lặp được trong ngày (S1b gọi cùng hàm từ bộ lập lịch)

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
  throw new Error('Lệnh: generate-master-key | migrate | adopt-existing --code <mã> --name <tên> [--domains a,b]');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
