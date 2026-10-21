import { createDatabase, type SystemDatabase } from '@school-management/database';
import { readConfigurationFromEnvironment } from '../common/configuration.js';
import { DemoGuardError, resetDemoEnvironment } from './demo-seed.js';

// Lệnh của bản trình diễn (DT-18 phần 18h, YCTD-145), chạy trong ảnh máy chủ API với biến môi trường của máy chủ API và
// IDENTITY_DATABASE_URL:
//   node dist/demo/demo-command.js reset --confirm [--interval-hours 24]   tạo hoặc đặt lại dữ liệu trình diễn một lần
//   node dist/demo/demo-command.js schedule --confirm [--interval-hours 24] chạy mãi: đặt lại khi đến giờ đặt lại tới
// Không có --confirm thì không làm gì. Lệnh từ chối chạy trên cơ sở dữ liệu đã có dữ liệu thật (xem demo-seed.ts).
const CHECK_MILLISECONDS = 5 * 60_000;

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function resetOnce(intervalHours: number): Promise<boolean> {
  const identityDatabaseUrl = process.env.IDENTITY_DATABASE_URL;
  if (!identityDatabaseUrl) {
    throw new Error('Thiếu biến môi trường IDENTITY_DATABASE_URL');
  }
  const { report, nextResetAt } = await resetDemoEnvironment({
    configuration: readConfigurationFromEnvironment(),
    identityDatabaseUrl,
    resetIntervalHours: intervalHours,
  });
  console.log(`Lần đặt lại tới: ${nextResetAt.toISOString()}`);
  return report.steps.every((item) => item.ok);
}

async function nextResetAt(): Promise<Date | null> {
  const system = createDatabase<SystemDatabase>(readConfigurationFromEnvironment().systemDatabaseUrl);
  try {
    const row = await system.selectFrom('demo_environment').select('next_reset_at').executeTakeFirst();
    return row?.next_reset_at ?? null;
  } finally {
    await system.destroy();
  }
}

async function main(): Promise<number> {
  const command = process.argv[2];
  const intervalHours = Number(option('--interval-hours') ?? 24);
  if ((command !== 'reset' && command !== 'schedule') || !process.argv.includes('--confirm')) {
    console.error('Dùng: demo-command.js reset|schedule --confirm [--interval-hours 24]');
    return 2;
  }
  if (!Number.isInteger(intervalHours) || intervalHours < 1 || intervalHours > 720) {
    console.error('--interval-hours phải là số nguyên từ 1 đến 720');
    return 2;
  }
  try {
    if (command === 'reset') {
      return (await resetOnce(intervalHours)) ? 0 : 1;
    }
    // Tự đặt lại định kỳ: chưa có dữ liệu trình diễn thì tạo ngay, sau đó chờ đến giờ đặt lại tới
    for (;;) {
      const due = await nextResetAt();
      if (!due || due.getTime() <= Date.now()) {
        await resetOnce(intervalHours);
      }
      await new Promise((resolve) => setTimeout(resolve, CHECK_MILLISECONDS));
    }
  } catch (error) {
    console.error(error instanceof DemoGuardError ? error.message : error);
    return 1;
  }
}

process.exitCode = await main();
