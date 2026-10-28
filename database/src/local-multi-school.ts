import type { Kysely } from 'kysely';
import type { PlatformDatabase } from '../platform/schema.js';
import { CATALOG_LEVELS, searchText, type CatalogLevelCode } from './school-catalog.js';
import { writeAudit } from './provision-school.js';

// Bản nhiều trường trên máy phát triển (YCTD-310): chạy song song với bản một trường đang có, dùng cơ sở dữ liệu nền tảng riêng và cổng
// riêng; trường demo của bản một trường được nhận làm trường của nền tảng (adopt-existing, trỏ tới cơ sở dữ liệu cũ, không chép). Tệp
// này giữ phần logic kiểm thử được của lệnh `nhieu-truong-cuc-bo` (local-multi-school-command.ts): ghi tệp môi trường riêng, gắn trường
// demo vào danh mục đơn vị để ô chọn Sở → Cấp, Phường / Xã → Trường tìm thấy.

// Cập nhật tệp môi trường dạng KEY=VALUE: giữ nguyên dòng chú thích và biến khác, thay giá trị biến đã có, thêm biến chưa có ở cuối;
// giá trị null thì bỏ dòng của biến đó
export function updateEnvironmentText(text: string, updates: Record<string, string | null>): string {
  const pending = new Map(Object.entries(updates));
  const lines = text === '' ? [] : text.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
  const result: string[] = [];
  for (const line of lines) {
    const key = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line)?.[1];
    if (key && pending.has(key)) {
      const value = pending.get(key);
      pending.delete(key);
      if (value !== null && value !== undefined) {
        result.push(`${key}=${value}`);
      }
      continue;
    }
    result.push(line);
  }
  for (const [key, value] of pending) {
    if (value !== null) {
      result.push(`${key}=${value}`);
    }
  }
  return `${result.join('\n')}\n`;
}

// Đọc giá trị biến trong tệp môi trường (bỏ ngoặc kép bao ngoài nếu có); không có thì undefined
export function readEnvironmentValue(text: string, key: string): string | undefined {
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line);
    if (match?.[1] === key) {
      const value = (match[2] ?? '').trim();
      return value.replace(/^"(.*)"$/, '$1') || undefined;
    }
  }
  return undefined;
}

export interface DemoCatalogUnitOptions {
  schoolCode: string;
  moetCode: string;
  name: string;
  departmentCode: string;
  communeCode: string;
  levels: string[];
}

export class DemoCatalogError extends Error {}

// Thêm hoặc cập nhật đơn vị của trường demo trong danh mục (nguồn `demo-local`, chỉ ở máy phát triển) rồi gắn mã đó vào trường của
// nền tảng. Sở, phường phải có sẵn trong danh mục đã nạp; phường phải thuộc sở. Chạy lặp được
export async function linkDemoCatalogUnit(
  platform: Kysely<PlatformDatabase>,
  options: DemoCatalogUnitOptions,
): Promise<{ unitId: string; departmentName: string; communeName: string }> {
  const levels = options.levels.map((level) => level.trim().toUpperCase()).filter(Boolean);
  const unknown = levels.filter((level) => !CATALOG_LEVELS.some((item) => item.code === level));
  if (levels.length === 0 || unknown.length > 0) {
    throw new DemoCatalogError(
      `Cấp học phải là một hoặc nhiều mã ${CATALOG_LEVELS.map((item) => item.code).join(', ')}${unknown.length ? ` (sai: ${unknown.join(', ')})` : ''}`,
    );
  }
  const name = options.name.replace(/\s+/g, ' ').trim();
  if (!name || !options.moetCode.trim()) {
    throw new DemoCatalogError('Cần tên trường và mã đơn vị của trường demo');
  }
  const department = await platform
    .selectFrom('catalog_departments')
    .select('name')
    .where('code', '=', options.departmentCode)
    .executeTakeFirst();
  if (!department) {
    throw new DemoCatalogError(`Danh mục chưa có sở mã ${options.departmentCode}: nạp danh mục trước`);
  }
  const commune = await platform
    .selectFrom('catalog_communes')
    .select(['name', 'department_code'])
    .where('code', '=', options.communeCode)
    .executeTakeFirst();
  if (!commune || commune.department_code !== options.departmentCode) {
    throw new DemoCatalogError(
      `Phường, xã mã ${options.communeCode} không có trong danh mục của sở ${options.departmentCode}`,
    );
  }
  const school = await platform
    .selectFrom('schools')
    .select(['id', 'moet_code'])
    .where('code', '=', options.schoolCode)
    .executeTakeFirst();
  if (!school) {
    throw new DemoCatalogError(`Nền tảng chưa có trường mã ${options.schoolCode}: chạy bước nhận trường demo trước`);
  }
  const moetCode = options.moetCode.trim();
  return platform.transaction().execute(async (transaction) => {
    const now = new Date();
    const unit = await transaction
      .insertInto('catalog_units')
      .values({
        moet_code: moetCode,
        name,
        name_search: searchText(name),
        department_code: options.departmentCode,
        commune_code: options.communeCode,
        source: 'demo-local',
        quality_flags: [],
      })
      .onConflict((conflict) =>
        conflict.column('moet_code').doUpdateSet({
          name,
          name_search: searchText(name),
          department_code: options.departmentCode,
          commune_code: options.communeCode,
          commune_name_raw: null,
          source: 'demo-local',
          status: 'active',
          quality_flags: [],
          last_seen_at: now,
          updated_at: now,
        }),
      )
      .returning('id')
      .executeTakeFirstOrThrow();
    await transaction.deleteFrom('catalog_unit_levels').where('unit_id', '=', unit.id).execute();
    await transaction
      .insertInto('catalog_unit_levels')
      .values([...new Set(levels)].map((level) => ({ unit_id: unit.id, level_code: level as CatalogLevelCode })))
      .execute();
    // Mã đã gắn trường khác thì gỡ ở trường kia trước (chỉ mục duy nhất trên schools.moet_code)
    await transaction
      .updateTable('schools')
      .set({ moet_code: null })
      .where('moet_code', '=', moetCode)
      .where('id', '!=', school.id)
      .execute();
    await transaction.updateTable('schools').set({ moet_code: moetCode }).where('id', '=', school.id).execute();
    await writeAudit(transaction, {
      actorType: 'cli',
      action: 'catalog.link-demo-unit',
      schoolId: school.id,
      details: { before: school.moet_code, after: moetCode },
    });
    return { unitId: unit.id, departmentName: department.name, communeName: commune.name };
  });
}
