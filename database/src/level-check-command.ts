import { readFileSync, writeFileSync } from 'node:fs';
import { readConnectionString } from './environment.js';
import { collectLevelReport, compareLevelReports, type LevelReport } from './level-check.js';

// Lệnh kiểm đối chiếu đa cấp học (DT-19 phần 19f, YCTD-156), chỉ đọc:
//   pnpm --filter @school-management/database level-check -- --out truoc.json
//   pnpm --filter @school-management/database level-check -- --compare truoc.json --out sau.json
// Thoát mã 1 khi có lỗi toàn vẹn hoặc số đếm lệch so với lần kiểm trước. Chạy ở bản sao dữ liệu thử, không chạy thẳng bản thật
function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const report = await collectLevelReport(readConnectionString('system'));
console.log(`Cấp đang bật: ${report.enabled_levels.join(', ')}`);
for (const issue of report.system_issues) {
  console.log(`Hệ thống: ${issue}`);
}
for (const year of report.years) {
  const counts = Object.entries(year.counts)
    .map(([table, count]) => `${table}=${count ?? '-'}`)
    .join(' ');
  console.log(`${year.academic_year} (${year.database_name}, ${year.status}): ${counts}`);
  if (!year.has_level_columns) {
    console.log('  chưa có cột cấp (năm học đã đóng giữ cấu trúc cũ)');
  }
  for (const issue of year.issues) {
    console.log(`  lỗi: ${issue}`);
  }
}
let failed = report.system_issues.length > 0 || report.years.some((year) => year.issues.length > 0);
const comparePath = argument('--compare');
if (comparePath) {
  const before = JSON.parse(readFileSync(comparePath, 'utf8')) as LevelReport;
  const differences = compareLevelReports(before, report);
  console.log(differences.length === 0 ? 'Số đếm khớp với lần kiểm trước' : 'Số đếm lệch:');
  for (const difference of differences) {
    console.log(`  ${difference}`);
  }
  failed = failed || differences.length > 0;
}
const outPath = argument('--out');
if (outPath) {
  writeFileSync(outPath, JSON.stringify(report, null, 2));
}
process.exitCode = failed ? 1 : 0;
