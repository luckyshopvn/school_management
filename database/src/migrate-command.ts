import { readConnectionString } from './environment.js';
import { migrateToLatest, type DatabaseKind } from './migrate.js';

const databaseKinds: DatabaseKind[] = ['identity', 'system', 'school-year'];

for (const kind of databaseKinds) {
  const { error, results } = await migrateToLatest(kind, readConnectionString(kind));
  for (const result of results ?? []) {
    console.log(`${kind}: ${result.migrationName} ${result.status}`);
  }
  if (error) {
    console.error(`${kind}: chạy tệp thay đổi cấu trúc thất bại`, error);
    process.exitCode = 1;
    break;
  }
  console.log(`${kind}: đã ở phiên bản cấu trúc mới nhất`);
}
