import { sql, type Kysely } from 'kysely';
import type { PlatformAuditActorType, PlatformDatabase } from '../platform/schema.js';

// Danh mục đơn vị giáo dục toàn quốc ở cơ sở dữ liệu nền tảng (DT-24, YCTD-220; tài liệu 32 mục 16).
// Nguồn là tệp CSV theo cột của bản khảo sát ô chọn đơn vị trên trang đăng nhập của hệ thống ngành (một dòng mỗi trường hoặc mỗi
// cặp trường, cấp học) và tệp phường, xã. Kho mã công khai không chứa tệp thật; trên máy chủ, quản trị nền tảng nạp bằng lệnh
// `platform catalog-import` hoặc ở cổng nền tảng. Quy tắc làm sạch (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11):
// - mã trường là chuỗi bất biến, giữ nguyên (chỉ bỏ khoảng trắng hai đầu); mã không theo dạng 8 hoặc 10 chữ số vẫn nhập, gắn cờ;
// - không suy ra tỉnh từ hai số đầu mã trường: sở lấy theo cột mã sở;
// - mã trùng khuôn số căn cước (12 chữ số bắt đầu bằng 0) hoặc đã che ở nguồn thì không nhập, ghi vào báo cáo là bị loại và không
//   ghi giá trị mã;
// - tên rỗng thì đặt "Đơn vị mã <mã>" và gắn cờ; thiếu hoặc sai mã xã thì để trống xã, giữ tên xã ở nguồn, gắn cờ;
// - nhập lặp lại được: so từng đơn vị theo mã, chỉ ghi phần đổi; báo cáo thêm, sửa, giữ nguyên, bỏ qua.

export const CATALOG_LEVELS = [
  { code: 'MN', moetCode: '01', name: 'Mầm non' },
  { code: 'TH', moetCode: '02', name: 'Tiểu học' },
  { code: 'THCS', moetCode: '03', name: 'Trung học cơ sở' },
  { code: 'THPT', moetCode: '04', name: 'Trung học phổ thông' },
  { code: 'GDTX', moetCode: '05', name: 'Giáo dục thường xuyên' },
] as const;

export type CatalogLevelCode = (typeof CATALOG_LEVELS)[number]['code'];

export const CATALOG_QUALITY_FLAGS: Record<string, string> = {
  name_missing: 'Nguồn không có tên, đặt tên tạm theo mã',
  code_nonstandard: 'Mã không theo dạng 8 hoặc 10 chữ số',
  commune_missing: 'Nguồn không ghi phường, xã',
  commune_invalid: 'Mã phường, xã ở nguồn không đúng 5 chữ số',
  level_missing: 'Nguồn không ghi cấp học',
  level_unknown: 'Có cấp học không có trong danh mục cấp học',
};

const MASKED_MARKER = /DA_CHE|\[.*\]/i;
const PERSONAL_ID_PATTERN = /^0\d{11}$/;
const STANDARD_CODE = /^(\d{8}|\d{10})$/;
const MAX_SKIPPED_IN_REPORT = 500;
const CHUNK = 500;

// Tên bỏ dấu, chữ thường, gộp khoảng trắng: dùng để tìm kiếm không phân biệt dấu
export function searchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanText(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

// Bộ đọc CSV theo RFC 4180 (dấu phẩy, ngoặc kép, xuống dòng trong ô), bỏ dấu BOM đầu tệp
export function parseCsv(text: string): string[][] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let fieldStarted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index] as string;
    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"' && !fieldStarted) {
      quoted = true;
      fieldStarted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
      fieldStarted = false;
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && input[index + 1] === '\n') {
        index += 1;
      }
      row.push(field);
      if (row.length > 1 || row[0] !== '') {
        rows.push(row);
      }
      row = [];
      field = '';
      fieldStarted = false;
    } else {
      field += character;
      fieldStarted = true;
    }
  }
  if (fieldStarted || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

interface CsvTable {
  header: Map<string, number>;
  rows: string[][];
}

function readTable(text: string, required: string[], label: string): CsvTable {
  const [headerRow, ...rows] = parseCsv(text);
  const header = new Map((headerRow ?? []).map((name, index) => [name.trim().toLowerCase(), index]));
  const missing = required.filter((name) => !header.has(name));
  if (missing.length > 0) {
    throw new CatalogImportError(`Tệp ${label} thiếu cột ${missing.join(', ')}`);
  }
  return { header, rows };
}

function cell(table: CsvTable, row: string[], name: string): string {
  const index = table.header.get(name);
  return index === undefined ? '' : (row[index] ?? '');
}

export class CatalogImportError extends Error {}

export interface PreparedUnit {
  moetCode: string;
  name: string;
  departmentCode: string;
  communeCode: string | null;
  communeNameRaw: string | null;
  schoolYear: string | null;
  levels: Set<CatalogLevelCode>;
  flags: Set<string>;
  line: number;
}

export interface SkippedRow {
  line: number;
  reason: string;
  code?: string;
}

export interface PreparedCatalog {
  departments: Map<string, string>;
  communes: Map<string, { departmentCode: string; name: string }>;
  units: Map<string, PreparedUnit>;
  skipped: SkippedRow[];
  rowsRead: number;
}

function levelFromMoetCode(value: string): CatalogLevelCode | null {
  return CATALOG_LEVELS.find((level) => level.moetCode === value.trim())?.code ?? null;
}

function levelFromName(value: string): CatalogLevelCode | null {
  const text = searchText(value);
  return CATALOG_LEVELS.find((level) => searchText(level.name) === text)?.code ?? null;
}

function schoolYearOf(value: string): string | null {
  const text = value.trim();
  if (/^\d{4}$/.test(text)) {
    return `${text}-${Number(text) + 1}`;
  }
  return /^\d{4}-\d{4}$/.test(text) ? text : null;
}

// Đọc và làm sạch hai tệp nguồn, chưa ghi gì vào cơ sở dữ liệu
export function prepareCatalog(unitsCsv: string | null, communesCsv: string | null): PreparedCatalog {
  const prepared: PreparedCatalog = {
    departments: new Map(),
    communes: new Map(),
    units: new Map(),
    skipped: [],
    rowsRead: 0,
  };
  const skip = (line: number, reason: string, code?: string) =>
    prepared.skipped.push({ line, reason, ...(code ? { code } : {}) });
  const department = (line: number, codeText: string, nameText: string): string | null => {
    const code = codeText.trim();
    if (!/^\d{2}$/.test(code)) {
      skip(line, 'Mã sở trống hoặc không đúng 2 chữ số');
      return null;
    }
    const name = cleanText(nameText);
    if (name && !prepared.departments.has(code)) {
      prepared.departments.set(code, name);
    }
    if (!prepared.departments.has(code)) {
      prepared.departments.set(code, `Sở mã ${code}`);
    }
    return code;
  };

  if (communesCsv) {
    const table = readTable(communesCsv, ['ma_so', 'ma_phuong_xa', 'ten_phuong_xa'], 'phường, xã');
    table.rows.forEach((row, index) => {
      const line = index + 2;
      prepared.rowsRead += 1;
      const departmentCode = department(line, cell(table, row, 'ma_so'), cell(table, row, 'ten_so'));
      if (!departmentCode) {
        return;
      }
      const code = cell(table, row, 'ma_phuong_xa').trim();
      const name = cleanText(cell(table, row, 'ten_phuong_xa'));
      if (!/^\d{5}$/.test(code) || !name) {
        skip(line, 'Phường, xã thiếu tên hoặc mã không đúng 5 chữ số');
        return;
      }
      prepared.communes.set(code, { departmentCode, name });
    });
  }

  if (unitsCsv) {
    const table = readTable(unitsCsv, ['ma_so', 'ma_truong', 'ten_truong'], 'đơn vị');
    table.rows.forEach((row, index) => {
      const line = index + 2;
      prepared.rowsRead += 1;
      const rawCode = cell(table, row, 'ma_truong').trim();
      if (!rawCode) {
        skip(line, 'Thiếu mã trường');
        return;
      }
      if (MASKED_MARKER.test(rawCode) || PERSONAL_ID_PATTERN.test(rawCode)) {
        skip(
          line,
          'Mã trùng khuôn số căn cước công dân (đã che ở nguồn hoặc 12 chữ số bắt đầu bằng 0): không nhập',
          '[đã che]',
        );
        return;
      }
      if (rawCode.length > 40 || /\p{Cc}/u.test(rawCode)) {
        skip(line, 'Mã trường dài quá 40 ký tự hoặc có ký tự điều khiển');
        return;
      }
      const departmentCode = department(line, cell(table, row, 'ma_so'), cell(table, row, 'ten_so'));
      if (!departmentCode) {
        return;
      }
      const levelCodes = cell(table, row, 'ma_cap_hoc')
        .split(';')
        .filter((value) => value.trim() !== '');
      const levelNames = cell(table, row, 'cap_hoc')
        .split(';')
        .filter((value) => value.trim() !== '');
      const flags = new Set<string>();
      const levels = new Set<CatalogLevelCode>();
      for (const value of levelCodes.length > 0 ? levelCodes : levelNames) {
        const level = levelCodes.length > 0 ? levelFromMoetCode(value) : levelFromName(value);
        if (level) {
          levels.add(level);
        } else {
          flags.add('level_unknown');
        }
      }
      const existing = prepared.units.get(rawCode);
      if (existing) {
        // Tệp theo cấp: cùng mã ở nhiều dòng là trường liên cấp; khác sở là dữ liệu nguồn mâu thuẫn, giữ dòng đầu
        if (existing.departmentCode !== departmentCode) {
          skip(line, `Mã trường đã có ở sở ${existing.departmentCode} (dòng ${existing.line}): giữ dòng đầu`, rawCode);
          return;
        }
        levels.forEach((level) => existing.levels.add(level));
        flags.forEach((flag) => existing.flags.add(flag));
        if (existing.levels.size > 0) {
          existing.flags.delete('level_missing');
        }
        return;
      }
      if (!STANDARD_CODE.test(rawCode)) {
        flags.add('code_nonstandard');
      }
      let name = cleanText(cell(table, row, 'ten_truong'));
      if (!name) {
        name = `Đơn vị mã ${rawCode}`;
        flags.add('name_missing');
      }
      const communeCodeText = cell(table, row, 'ma_phuong_xa').trim();
      const communeName = cleanText(cell(table, row, 'ten_phuong_xa'));
      let communeCode: string | null = null;
      if (/^\d{5}$/.test(communeCodeText)) {
        communeCode = communeCodeText;
        if (communeName && !prepared.communes.has(communeCode)) {
          prepared.communes.set(communeCode, { departmentCode, name: communeName });
        }
      } else if (communeCodeText && communeCodeText !== '-1') {
        flags.add('commune_invalid');
      } else {
        flags.add('commune_missing');
      }
      if (levels.size === 0) {
        flags.add('level_missing');
      }
      prepared.units.set(rawCode, {
        moetCode: rawCode,
        name: name.slice(0, 300),
        departmentCode,
        communeCode,
        communeNameRaw: communeCode ? null : communeName || null,
        schoolYear: schoolYearOf(cell(table, row, 'nam_hoc')),
        levels,
        flags,
        line,
      });
    });
  }

  // Mã xã có ở trường nhưng không có tên ở cả hai tệp: để trống xã, gắn cờ
  for (const unit of prepared.units.values()) {
    if (unit.communeCode && !prepared.communes.has(unit.communeCode)) {
      unit.communeCode = null;
      unit.flags.add('commune_invalid');
    }
  }
  return prepared;
}

export interface CatalogImportActor {
  type: PlatformAuditActorType;
  id?: string | null;
  name: string;
}

export interface CatalogImportOptions {
  unitsCsv?: string | null;
  communesCsv?: string | null;
  source: string;
  fileName?: string | null;
  dryRun?: boolean;
  // Đơn vị của các sở có trong tệp mà không còn trong tệp thì chuyển "ngừng hoạt động" (không xóa; mã bất biến)
  deactivateMissing?: boolean;
  actor: CatalogImportActor;
  now?: Date;
}

export interface CatalogImportTotals {
  rows_read: number;
  departments_inserted: number;
  departments_updated: number;
  communes_inserted: number;
  communes_updated: number;
  units_inserted: number;
  units_updated: number;
  units_unchanged: number;
  units_skipped: number;
  units_flagged: number;
  units_missing: number;
  units_deactivated: number;
}

export interface CatalogImportReport {
  run_id: string | null;
  dry_run: boolean;
  totals: CatalogImportTotals;
  flags: Record<string, number>;
  skipped: SkippedRow[];
}

interface ExistingUnit {
  id: string;
  name: string;
  department_code: string;
  commune_code: string | null;
  commune_name_raw: string | null;
  school_year: string | null;
  status: string;
  quality_flags: string[];
  levels: string[];
}

function sortedFlags(flags: Set<string>): string[] {
  return [...flags].sort();
}

function sameUnit(existing: ExistingUnit, unit: PreparedUnit): boolean {
  return (
    existing.name === unit.name &&
    existing.department_code === unit.departmentCode &&
    existing.commune_code === unit.communeCode &&
    existing.commune_name_raw === unit.communeNameRaw &&
    existing.school_year === unit.schoolYear &&
    existing.status === 'active' &&
    [...existing.quality_flags].sort().join(',') === sortedFlags(unit.flags).join(',') &&
    [...existing.levels].sort().join(',') === [...unit.levels].sort().join(',')
  );
}

function chunks<T>(items: T[], size = CHUNK): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

// Nhập hoặc cập nhật danh mục từ CSV; chạy lặp được (so theo mã). Chạy thử (dryRun) chỉ tính báo cáo, không ghi danh mục
export async function importSchoolCatalog(
  platform: Kysely<PlatformDatabase>,
  options: CatalogImportOptions,
): Promise<CatalogImportReport> {
  if (!options.unitsCsv && !options.communesCsv) {
    throw new CatalogImportError('Cần tệp đơn vị hoặc tệp phường, xã');
  }
  const prepared = prepareCatalog(options.unitsCsv ?? null, options.communesCsv ?? null);
  const now = options.now ?? new Date();
  const dryRun = Boolean(options.dryRun);
  const flags: Record<string, number> = {};
  for (const unit of prepared.units.values()) {
    unit.flags.forEach((flag) => (flags[flag] = (flags[flag] ?? 0) + 1));
  }
  const totals: CatalogImportTotals = {
    rows_read: prepared.rowsRead,
    departments_inserted: 0,
    departments_updated: 0,
    communes_inserted: 0,
    communes_updated: 0,
    units_inserted: 0,
    units_updated: 0,
    units_unchanged: 0,
    units_skipped: prepared.skipped.length,
    units_flagged: [...prepared.units.values()].filter((unit) => unit.flags.size > 0).length,
    units_missing: 0,
    units_deactivated: 0,
  };

  await platform.transaction().execute(async (transaction) => {
    const departments = new Map(
      (await transaction.selectFrom('catalog_departments').select(['code', 'name']).execute()).map((row) => [
        row.code,
        row.name,
      ]),
    );
    const departmentRows = [...prepared.departments].filter(([code, name]) => departments.get(code) !== name);
    for (const [code] of departmentRows) {
      if (departments.has(code)) {
        totals.departments_updated += 1;
      } else {
        totals.departments_inserted += 1;
      }
    }
    const communes = new Map(
      (await transaction.selectFrom('catalog_communes').select(['code', 'name', 'department_code']).execute()).map(
        (row) => [row.code, row],
      ),
    );
    const communeRows = [...prepared.communes].filter(([code, value]) => {
      const current = communes.get(code);
      return !current || current.name !== value.name || current.department_code !== value.departmentCode;
    });
    for (const [code] of communeRows) {
      if (communes.has(code)) {
        totals.communes_updated += 1;
      } else {
        totals.communes_inserted += 1;
      }
    }

    const existingRows = await transaction
      .selectFrom('catalog_units')
      .select([
        'id',
        'moet_code',
        'name',
        'department_code',
        'commune_code',
        'commune_name_raw',
        'school_year',
        'status',
        'quality_flags',
        sql<
          string[]
        >`coalesce((select array_agg(level_code) from catalog_unit_levels where unit_id = catalog_units.id), '{}')`.as(
          'levels',
        ),
      ])
      .execute();
    const existing = new Map<string, ExistingUnit>(existingRows.map((row) => [row.moet_code, row]));
    const inserts: PreparedUnit[] = [];
    const updates: Array<{ id: string; unit: PreparedUnit }> = [];
    const unchanged: string[] = [];
    for (const unit of prepared.units.values()) {
      const current = existing.get(unit.moetCode);
      if (!current) {
        inserts.push(unit);
      } else if (sameUnit(current, unit)) {
        unchanged.push(current.id);
      } else {
        updates.push({ id: current.id, unit });
      }
    }
    totals.units_inserted = inserts.length;
    totals.units_updated = updates.length;
    totals.units_unchanged = unchanged.length;
    const importedDepartments = new Set([...prepared.units.values()].map((unit) => unit.departmentCode));
    const missing = existingRows.filter(
      (row) =>
        row.status === 'active' && importedDepartments.has(row.department_code) && !prepared.units.has(row.moet_code),
    );
    totals.units_missing = missing.length;

    if (dryRun) {
      return;
    }
    for (const [code, name] of departmentRows) {
      await transaction
        .insertInto('catalog_departments')
        .values({ code, name, updated_at: now })
        .onConflict((conflict) => conflict.column('code').doUpdateSet({ name, status: 'active', updated_at: now }))
        .execute();
    }
    for (const part of chunks(communeRows)) {
      await transaction
        .insertInto('catalog_communes')
        .values(
          part.map(([code, value]) => ({
            code,
            department_code: value.departmentCode,
            name: value.name,
            name_search: searchText(value.name),
            updated_at: now,
          })),
        )
        .onConflict((conflict) =>
          conflict.column('code').doUpdateSet((builder) => ({
            department_code: builder.ref('excluded.department_code'),
            name: builder.ref('excluded.name'),
            name_search: builder.ref('excluded.name_search'),
            status: 'active',
            updated_at: now,
          })),
        )
        .execute();
    }
    for (const part of chunks(inserts)) {
      const created = await transaction
        .insertInto('catalog_units')
        .values(
          part.map((unit) => ({
            moet_code: unit.moetCode,
            name: unit.name,
            name_search: searchText(unit.name),
            department_code: unit.departmentCode,
            commune_code: unit.communeCode,
            commune_name_raw: unit.communeNameRaw,
            school_year: unit.schoolYear,
            source: options.source,
            quality_flags: sortedFlags(unit.flags),
            last_seen_at: now,
            updated_at: now,
          })),
        )
        .returning(['id', 'moet_code'])
        .execute();
      const ids = new Map(created.map((row) => [row.moet_code, row.id]));
      const levels = part.flatMap((unit) =>
        [...unit.levels].map((level) => ({ unit_id: ids.get(unit.moetCode) as string, level_code: level })),
      );
      if (levels.length > 0) {
        await transaction.insertInto('catalog_unit_levels').values(levels).execute();
      }
    }
    for (const part of chunks(updates)) {
      const values = sql.join(
        part.map(
          ({ id, unit }) =>
            sql`(${id}::uuid, ${unit.name}, ${searchText(unit.name)}, ${unit.departmentCode}, ${unit.communeCode}::text, ${unit.communeNameRaw}::text, ${unit.schoolYear}::text, ${sortedFlags(unit.flags)}::text[])`,
        ),
      );
      await sql`update catalog_units as unit set name = item.name, name_search = item.name_search,
          department_code = item.department_code, commune_code = item.commune_code, commune_name_raw = item.commune_name_raw,
          school_year = item.school_year, quality_flags = item.quality_flags, status = 'active', source = ${options.source},
          last_seen_at = ${now}, updated_at = ${now}
        from (values ${values}) as item(id, name, name_search, department_code, commune_code, commune_name_raw, school_year, quality_flags)
        where unit.id = item.id`.execute(transaction);
      const ids = part.map(({ id }) => id);
      await transaction.deleteFrom('catalog_unit_levels').where('unit_id', 'in', ids).execute();
      const levels = part.flatMap(({ id, unit }) =>
        [...unit.levels].map((level) => ({ unit_id: id, level_code: level })),
      );
      if (levels.length > 0) {
        await transaction.insertInto('catalog_unit_levels').values(levels).execute();
      }
    }
    for (const part of chunks(unchanged, 5_000)) {
      await transaction.updateTable('catalog_units').set({ last_seen_at: now }).where('id', 'in', part).execute();
    }
    if (options.deactivateMissing && missing.length > 0) {
      for (const part of chunks(
        missing.map((row) => row.id),
        5_000,
      )) {
        await transaction
          .updateTable('catalog_units')
          .set({ status: 'inactive', updated_at: now })
          .where('id', 'in', part)
          .execute();
      }
      totals.units_deactivated = missing.length;
    }
  });

  const skipped = prepared.skipped.slice(0, MAX_SKIPPED_IN_REPORT);
  const run = await platform
    .insertInto('catalog_import_runs')
    .values({
      source: options.source,
      file_name: options.fileName ?? null,
      dry_run: dryRun,
      totals: JSON.stringify({
        ...totals,
        ...Object.fromEntries(Object.entries(flags).map(([key, value]) => [`flag_${key}`, value])),
      }),
      skipped: JSON.stringify(skipped),
      actor_type: options.actor.type,
      actor_id: options.actor.id ?? null,
      actor_name: options.actor.name,
      started_at: now,
      finished_at: new Date(),
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await platform
    .insertInto('platform_audit_log')
    .values({
      actor_type: options.actor.type,
      actor_id: options.actor.id ?? null,
      action: dryRun ? 'catalog.import-dry-run' : 'catalog.import',
      school_id: null,
      details: JSON.stringify({ run_id: run.id, source: options.source, totals }),
    })
    .execute();
  return { run_id: run.id, dry_run: dryRun, totals, flags, skipped };
}

// ---------- Truy vấn cho ô chọn đơn vị và cổng nền tảng ----------

export interface CatalogPage<T> {
  items: T[];
  has_more: boolean;
}

export interface CatalogUnitSummary {
  moet_code: string;
  name: string;
  commune_code: string | null;
  commune_name: string | null;
  levels: string[];
}

export interface CatalogUnitDetail extends CatalogUnitSummary {
  department_code: string;
  department_name: string;
  school_year: string | null;
  status: string;
  quality_flags: string[];
  // Trường đã khởi tạo trên nền tảng gắn với đơn vị (null: chỉ có trong danh mục)
  school: { id: string; code: string; status: string } | null;
}

export const CATALOG_PAGE_LIMIT = 50;

function pageLimit(value: number | undefined, fallback = 20): number {
  return Math.min(CATALOG_PAGE_LIMIT, Math.max(1, Math.trunc(value ?? fallback) || fallback));
}

function pageOffset(value: number | undefined): number {
  return Math.min(100_000, Math.max(0, Math.trunc(value ?? 0) || 0));
}

function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

export async function catalogDepartments(platform: Kysely<PlatformDatabase>) {
  return platform
    .selectFrom('catalog_departments')
    .select(['code', 'name'])
    .where('status', '=', 'active')
    .orderBy('code')
    .execute();
}
// Có sở (và phường, xã) thì chỉ trả cấp học có đơn vị đang hoạt động trong phạm vi đó: ô Cấp của trang đăng nhập không đưa ra
// cấp học dẫn tới danh sách trường rỗng (YCTD-310)
// học → Trường không đưa ra cấp học dẫn tới danh sách trường rỗng (YCTD-310, đăng nhập kiểu SMIS)
export async function catalogLevels(
  platform: Kysely<PlatformDatabase>,
  scope: { department?: string | null; commune?: string | null } = {},
) {
  let query = platform.selectFrom('catalog_levels').select(['code', 'moet_code', 'name']);
  const { department, commune } = scope;
  if (department) {
    query = query.where((builder) =>
      builder.exists(
        builder
          .selectFrom('catalog_unit_levels')
          .innerJoin('catalog_units', 'catalog_units.id', 'catalog_unit_levels.unit_id')
          .select('catalog_unit_levels.unit_id')
          .whereRef('catalog_unit_levels.level_code', '=', 'catalog_levels.code')
          .where('catalog_units.department_code', '=', department)
          .where('catalog_units.status', '=', 'active')
          .$if(Boolean(commune), (inner) => inner.where('catalog_units.commune_code', '=', commune as string)),
      ),
    );
  }
  return query.orderBy('sort').execute();
}

export async function catalogCommunes(
  platform: Kysely<PlatformDatabase>,
  filter: { department: string; q?: string; limit?: number; offset?: number },
): Promise<CatalogPage<{ code: string; name: string }>> {
  const limit = pageLimit(filter.limit, CATALOG_PAGE_LIMIT);
  let query = platform
    .selectFrom('catalog_communes')
    .select(['code', 'name'])
    .where('department_code', '=', filter.department)
    .where('status', '=', 'active');
  const text = searchText(filter.q ?? '');
  if (text) {
    query = query.where((builder) =>
      builder.or([builder('name_search', 'like', likePattern(text)), builder('code', 'like', `${text}%`)]),
    );
  }
  const rows = await query
    .orderBy('name_search')
    .limit(limit + 1)
    .offset(pageOffset(filter.offset))
    .execute();
  return { items: rows.slice(0, limit), has_more: rows.length > limit };
}

export interface CatalogUnitFilter {
  department: string;
  level?: string | null;
  commune?: string | null;
  q?: string | null;
  flag?: string | null;
  limit?: number;
  offset?: number;
  includeInactive?: boolean;
}

export async function searchCatalogUnits(
  platform: Kysely<PlatformDatabase>,
  filter: CatalogUnitFilter,
): Promise<CatalogPage<CatalogUnitSummary & { quality_flags: string[]; status: string }>> {
  const limit = pageLimit(filter.limit);
  let query = platform
    .selectFrom('catalog_units')
    .leftJoin('catalog_communes', 'catalog_communes.code', 'catalog_units.commune_code')
    .select([
      'catalog_units.id',
      'catalog_units.moet_code',
      'catalog_units.name',
      'catalog_units.commune_code',
      'catalog_units.status',
      'catalog_units.quality_flags',
      sql<string | null>`coalesce(catalog_communes.name, catalog_units.commune_name_raw)`.as('commune_name'),
    ])
    .where('catalog_units.department_code', '=', filter.department);
  if (!filter.includeInactive) {
    query = query.where('catalog_units.status', '=', 'active');
  }
  if (filter.level) {
    const level = filter.level;
    query = query.where((builder) =>
      builder.exists(
        builder
          .selectFrom('catalog_unit_levels')
          .select('catalog_unit_levels.unit_id')
          .whereRef('catalog_unit_levels.unit_id', '=', 'catalog_units.id')
          .where('catalog_unit_levels.level_code', '=', level),
      ),
    );
  }
  if (filter.commune) {
    query = query.where('catalog_units.commune_code', '=', filter.commune);
  }
  if (filter.flag) {
    query = query.where(sql<boolean>`${filter.flag} = any(catalog_units.quality_flags)`);
  }
  const text = searchText(filter.q ?? '');
  if (text) {
    query = query.where((builder) =>
      builder.or([
        builder('catalog_units.name_search', 'like', likePattern(text)),
        builder(sql`lower(catalog_units.moet_code)`, 'like', `${text.replace(/[\\%_]/g, '')}%`),
      ]),
    );
  }
  const rows = await query
    .orderBy('catalog_units.name_search')
    .orderBy('catalog_units.moet_code')
    .limit(limit + 1)
    .offset(pageOffset(filter.offset))
    .execute();
  const page = rows.slice(0, limit);
  const levels = page.length
    ? await platform
        .selectFrom('catalog_unit_levels')
        .innerJoin('catalog_levels', 'catalog_levels.code', 'catalog_unit_levels.level_code')
        .select(['catalog_unit_levels.unit_id', 'catalog_unit_levels.level_code'])
        .where(
          'catalog_unit_levels.unit_id',
          'in',
          page.map((row) => row.id),
        )
        .orderBy('catalog_levels.sort')
        .execute()
    : [];
  return {
    items: page.map(({ id, ...row }) => ({
      ...row,
      levels: levels.filter((level) => level.unit_id === id).map((level) => level.level_code),
    })),
    has_more: rows.length > limit,
  };
}

export async function catalogUnitByCode(
  platform: Kysely<PlatformDatabase>,
  moetCode: string,
): Promise<CatalogUnitDetail | null> {
  const row = await platform
    .selectFrom('catalog_units')
    .innerJoin('catalog_departments', 'catalog_departments.code', 'catalog_units.department_code')
    .leftJoin('catalog_communes', 'catalog_communes.code', 'catalog_units.commune_code')
    .select([
      'catalog_units.id',
      'catalog_units.moet_code',
      'catalog_units.name',
      'catalog_units.department_code',
      'catalog_departments.name as department_name',
      'catalog_units.commune_code',
      sql<string | null>`coalesce(catalog_communes.name, catalog_units.commune_name_raw)`.as('commune_name'),
      'catalog_units.school_year',
      'catalog_units.status',
      'catalog_units.quality_flags',
    ])
    .where('catalog_units.moet_code', '=', moetCode)
    .executeTakeFirst();
  if (!row) {
    return null;
  }
  const levels = await platform
    .selectFrom('catalog_unit_levels')
    .innerJoin('catalog_levels', 'catalog_levels.code', 'catalog_unit_levels.level_code')
    .select('catalog_unit_levels.level_code')
    .where('catalog_unit_levels.unit_id', '=', row.id)
    .orderBy('catalog_levels.sort')
    .execute();
  const school = await platform
    .selectFrom('schools')
    .select(['id', 'code', 'status'])
    .where('moet_code', '=', moetCode)
    .where('status', '!=', 'deleted')
    .executeTakeFirst();
  return {
    moet_code: row.moet_code,
    name: row.name,
    department_code: row.department_code,
    department_name: row.department_name,
    commune_code: row.commune_code,
    commune_name: row.commune_name,
    school_year: row.school_year,
    status: row.status,
    quality_flags: row.quality_flags,
    levels: levels.map((level) => level.level_code),
    school: school ?? null,
  };
}

export async function catalogStatistics(platform: Kysely<PlatformDatabase>) {
  const count = async (table: 'catalog_departments' | 'catalog_communes' | 'catalog_units') =>
    Number(
      (
        await platform
          .selectFrom(table)
          .select((builder) => builder.fn.countAll<string>().as('count'))
          .executeTakeFirstOrThrow()
      ).count,
    );
  const [departments, communes, units] = await Promise.all([
    count('catalog_departments'),
    count('catalog_communes'),
    count('catalog_units'),
  ]);
  const byLevel = await platform
    .selectFrom('catalog_unit_levels')
    .select(['level_code', (builder) => builder.fn.countAll<string>().as('count')])
    .groupBy('level_code')
    .execute();
  const flags = await sql<{ flag: string; count: string }>`select flag, count(*) as count
    from catalog_units, unnest(quality_flags) as flag group by flag order by flag`.execute(platform);
  const linked = await platform
    .selectFrom('schools')
    .select((builder) => builder.fn.countAll<string>().as('count'))
    .where('moet_code', 'is not', null)
    .where('status', '!=', 'deleted')
    .executeTakeFirstOrThrow();
  const runs = await platform
    .selectFrom('catalog_import_runs')
    .select(['id', 'source', 'file_name', 'dry_run', 'totals', 'actor_name', 'started_at', 'finished_at'])
    .orderBy('started_at', 'desc')
    .limit(10)
    .execute();
  return {
    departments,
    communes,
    units,
    by_level: Object.fromEntries(byLevel.map((row) => [row.level_code, Number(row.count)])),
    flags: Object.fromEntries(flags.rows.map((row) => [row.flag, Number(row.count)])),
    linked_schools: Number(linked.count),
    runs,
  };
}
