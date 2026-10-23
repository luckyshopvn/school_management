import { sql, type Kysely } from 'kysely';
import { createDatabase } from './connection.js';
import { replaceDatabaseName } from './environment.js';

// Lệnh kiểm đối chiếu chuyển dữ liệu đa cấp học (DT-19 phần 19f, YCTD-156). Chỉ đọc: đếm dữ liệu nghiệp vụ của từng cơ sở dữ
// liệu năm học (kể cả năm đã đóng) và kiểm toàn vẹn cấp học; chạy trước và sau chuyển rồi so khớp số đếm. Kết quả chỉ có số
// đếm, tên cơ sở dữ liệu, tên năm học và mô tả lỗi, không có dữ liệu cá nhân. Năm đã đóng chưa có cột cấp (giữ cấu trúc, QU-11)
// thì chỉ đếm, ghi là chưa có cột cấp
const LEVEL_CODES = ['MN', 'TH', 'THCS', 'THPT'];

// Bảng nghiệp vụ được đếm; bảng chưa có ở năm học cũ ghi null
export const COUNTED_TABLES = [
  'grade_levels',
  'classes',
  'children',
  'staff',
  'fee_schedules',
  'receipts',
  'attendance_records',
  'health_check_results',
  'final_year_records',
] as const;

export interface YearLevelReport {
  database_name: string;
  academic_year: string;
  status: string;
  has_level_columns: boolean;
  counts: Record<string, number | null>;
  issues: string[];
}

export interface LevelReport {
  generated_at: string;
  enabled_levels: string[];
  system_issues: string[];
  years: YearLevelReport[];
}

async function columnExists(database: Kysely<unknown>, table: string, column: string): Promise<boolean> {
  const result = await sql<{ found: number }>`select 1 as found from information_schema.columns
    where table_schema = current_schema() and table_name = ${table} and column_name = ${column}`.execute(database);
  return result.rows.length > 0;
}

async function tableExists(database: Kysely<unknown>, table: string): Promise<boolean> {
  const result = await sql<{ found: number }>`select 1 as found from information_schema.tables
    where table_schema = current_schema() and table_name = ${table}`.execute(database);
  return result.rows.length > 0;
}

async function countOf(database: Kysely<unknown>, query: ReturnType<typeof sql<{ total: string }>>): Promise<number> {
  const result = await query.execute(database);
  return Number(result.rows[0]?.total ?? 0);
}

// Kiểm một cơ sở dữ liệu năm học
export async function checkSchoolYearDatabase(
  database: Kysely<unknown>,
): Promise<Pick<YearLevelReport, 'has_level_columns' | 'counts' | 'issues'>> {
  const counts: Record<string, number | null> = {};
  for (const table of COUNTED_TABLES) {
    if (!(await tableExists(database, table))) {
      counts[table] = null;
      continue;
    }
    const softDeleted = await columnExists(database, table, 'deleted_at');
    counts[table] = await countOf(
      database,
      softDeleted
        ? sql<{ total: string }>`select count(*) as total from ${sql.table(table)} where deleted_at is null`
        : sql<{ total: string }>`select count(*) as total from ${sql.table(table)}`,
    );
  }
  const hasLevelColumns =
    (await columnExists(database, 'classes', 'school_level')) &&
    (await columnExists(database, 'grade_levels', 'school_level')) &&
    (await tableExists(database, 'org_unit_levels'));
  const issues: string[] = [];
  if (!hasLevelColumns) {
    return { has_level_columns: false, counts, issues };
  }
  const codes = sql.join(LEVEL_CODES.map((code) => sql.lit(code)));
  const checks: Array<[string, ReturnType<typeof sql<{ total: string }>>]> = [
    [
      'lớp lệch cấp với khối',
      sql`select count(*) as total from classes join grade_levels on grade_levels.code = classes.grade_level
        where classes.school_level <> grade_levels.school_level`,
    ],
    [
      'đơn vị chưa có cấp',
      sql`select count(*) as total from org_units
        where not exists (select 1 from org_unit_levels where org_unit_levels.org_unit_id = org_units.id)`,
    ],
    [
      'lớp đang dùng thuộc cấp mà đơn vị không có',
      sql`select count(*) as total from classes where status = 'active'
        and exists (select 1 from org_unit_levels where org_unit_levels.org_unit_id = classes.org_unit_id)
        and not exists (select 1 from org_unit_levels where org_unit_levels.org_unit_id = classes.org_unit_id
          and org_unit_levels.school_level = classes.school_level)`,
    ],
    ['khối có mã cấp lạ', sql`select count(*) as total from grade_levels where school_level not in (${codes})`],
    ['lớp có mã cấp lạ', sql`select count(*) as total from classes where school_level not in (${codes})`],
    [
      'cấp Mầm non có lớp nhưng chưa có chương trình mặc định',
      sql`select count(*) as total from (select 1 from classes where school_level = 'MN' limit 1) as nursery
        where not exists (select 1 from curricula where school_level = 'MN' and is_default)`,
    ],
  ];
  for (const [label, query] of checks) {
    const total = await countOf(database, query);
    if (total > 0) {
      issues.push(`${label}: ${total}`);
    }
  }
  return { has_level_columns: true, counts, issues };
}

// Kiểm cơ sở dữ liệu hệ thống và mọi cơ sở dữ liệu năm học có trong danh sách
export async function collectLevelReport(systemConnectionString: string, now = new Date()): Promise<LevelReport> {
  const system = createDatabase<unknown>(systemConnectionString);
  try {
    const systemIssues: string[] = [];
    let enabled: string[] = ['MN'];
    if (await tableExists(system, 'school_levels')) {
      const rows = await sql<{
        code: string;
      }>`select code from school_levels where is_enabled order by order_no, code`.execute(system);
      enabled = rows.rows.map((row) => row.code);
      if (enabled.length === 0) {
        systemIssues.push('trường không bật cấp học nào');
      }
    } else {
      systemIssues.push('chưa có bảng school_levels');
    }
    for (const table of ['academic_terms', 'school_weeks']) {
      if (await columnExists(system, table, 'school_level')) {
        const total = await countOf(
          system,
          sql<{ total: string }>`select count(*) as total from ${sql.table(table)}
            where school_level is not null and school_level not in (${sql.join(LEVEL_CODES.map((code) => sql.lit(code)))})`,
        );
        if (total > 0) {
          systemIssues.push(`${table} có mã cấp lạ: ${total}`);
        }
      }
    }
    const years = await sql<{ database_name: string; name: string; status: string }>`select
        academic_year_databases.database_name, academic_years.name, academic_year_databases.status
      from academic_year_databases join academic_years on academic_years.id = academic_year_databases.academic_year_id
      order by academic_years.start_date nulls last, academic_years.name`.execute(system);
    const reports: YearLevelReport[] = [];
    for (const year of years.rows) {
      const database = createDatabase<unknown>(replaceDatabaseName(systemConnectionString, year.database_name));
      try {
        reports.push({
          database_name: year.database_name,
          academic_year: year.name,
          status: year.status,
          ...(await checkSchoolYearDatabase(database)),
        });
      } finally {
        await database.destroy();
      }
    }
    return { generated_at: now.toISOString(), enabled_levels: enabled, system_issues: systemIssues, years: reports };
  } finally {
    await system.destroy();
  }
}

// So khớp số đếm hai lần kiểm (trước và sau chuyển); trả danh sách khác biệt, trống là khớp
export function compareLevelReports(before: LevelReport, after: LevelReport): string[] {
  const differences: string[] = [];
  for (const previous of before.years) {
    const current = after.years.find((year) => year.database_name === previous.database_name);
    if (!current) {
      differences.push(`${previous.database_name}: không còn trong lần kiểm sau`);
      continue;
    }
    for (const [table, count] of Object.entries(previous.counts)) {
      if (count !== null && current.counts[table] !== count) {
        differences.push(`${previous.database_name}.${table}: ${count} thành ${current.counts[table] ?? 'không có'}`);
      }
    }
  }
  return differences;
}
