import { sql, type Kysely } from 'kysely';
import { HCM_ADMINISTRATIVE_UNITS } from '../system/data/hcm-administrative-units.js';
import type { AdminUnitLevel, AggregateCategory, PlatformDatabase } from '../platform/schema.js';

// Đơn vị cấp trên (DT-SaaS phần S6, YCTD-202; tài liệu 32 mục 14.5 "S6"): hàm dùng chung cho dịch vụ định danh (cây đơn vị, tài
// khoản cấp trên), máy chủ API (bản chụp tổng hợp, số liệu cho cấp trên) và kiểm thử. Claude tự chọn theo ủy quyền của Eric ngày
// 2026-10-11:
// - phạm vi của tài khoản cấp trên là cây con của nút được gán; trường thuộc cây con có mặt trong số liệu của một nhóm khi trường
//   đang đồng ý cho đúng **cấp** của tài khoản (Bộ, Sở, Phòng) và đúng nhóm số liệu;
// - số liệu cộng dồn chỉ từ bản chụp mới nhất của mỗi trường (không truy vấn cơ sở dữ liệu của trường);
// - ẩn nhóm nhỏ: số người (học sinh, nhân sự) từ 1 đến dưới ngưỡng thay bằng "ẩn"; tổng của một nút ít hơn ngưỡng trường thì không
//   hiện tổng (vẫn so sánh được từng trường đã đồng ý cho cấp này). Ngưỡng cấu hình `PARENT_ORG_MIN_GROUP`, mặc định 5 (giả định).
export const ADMIN_UNIT_LEVELS: readonly AdminUnitLevel[] = ['ministry', 'department', 'commune'];
export const ADMIN_UNIT_LEVEL_LABELS: Record<AdminUnitLevel, string> = {
  ministry: 'Bộ',
  department: 'Sở',
  commune: 'Phòng Văn hóa – Xã hội',
};
export const AGGREGATE_CATEGORIES: readonly AggregateCategory[] = [
  'scale',
  'attendance',
  'learning',
  'facilities',
  'staff',
  'emis',
];
export const AGGREGATE_CATEGORY_LABELS: Record<AggregateCategory, string> = {
  scale: 'Quy mô',
  attendance: 'Chuyên cần',
  learning: 'Kết quả học tập',
  facilities: 'Cơ sở vật chất',
  staff: 'Nhân sự',
  emis: 'EMIS',
};
export const DEFAULT_MIN_GROUP = 5;
const SNAPSHOT_RETENTION_DAYS = 400;

// Cấp con hợp lệ: Bộ có Sở, Sở có Phòng; Phòng là nút lá
export const CHILD_LEVEL: Record<AdminUnitLevel, AdminUnitLevel | null> = {
  ministry: 'department',
  department: 'commune',
  commune: null,
};

export function isAggregateCategory(value: unknown): value is AggregateCategory {
  return typeof value === 'string' && (AGGREGATE_CATEGORIES as readonly string[]).includes(value);
}

export function isAdminUnitLevel(value: unknown): value is AdminUnitLevel {
  return typeof value === 'string' && (ADMIN_UNIT_LEVELS as readonly string[]).includes(value);
}

// Mã của nút và mọi nút con cháu đang dùng (nút đã gộp, ngừng không tính)
export async function subtreeUnitIds(platform: Kysely<PlatformDatabase>, unitId: string): Promise<string[]> {
  const result = await sql<{ id: string }>`
    with recursive tree as (
      select id from admin_units where id = ${unitId}
      union all
      select child.id from admin_units child join tree on child.parent_id = tree.id where child.status = 'active'
    )
    select id from tree`.execute(platform);
  return result.rows.map((row) => row.id);
}

export interface ScopedSchool {
  id: string;
  code: string;
  name: string;
  admin_unit_id: string;
}

// Trường thuộc cây con của nút, đang phục vụ, và đang đồng ý cho cấp, nhóm số liệu này
export async function consentedSchools(
  platform: Kysely<PlatformDatabase>,
  unitId: string,
  level: AdminUnitLevel,
  category: AggregateCategory,
): Promise<ScopedSchool[]> {
  const units = await subtreeUnitIds(platform, unitId);
  if (!units.length) {
    return [];
  }
  const rows = await platform
    .selectFrom('schools')
    .innerJoin('school_aggregate_consents as consent', 'consent.school_id', 'schools.id')
    .select(['schools.id', 'schools.code', 'schools.name', 'schools.admin_unit_id'])
    .where('schools.admin_unit_id', 'in', units)
    .where('schools.status', 'in', ['trial', 'active', 'read_only'])
    .where('consent.level', '=', level)
    .where('consent.category', '=', category)
    .where('consent.revoked_at', 'is', null)
    .orderBy('schools.name')
    .execute();
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    admin_unit_id: row.admin_unit_id as string,
  }));
}

export interface SchoolSnapshot {
  school_id: string;
  academic_year: string | null;
  metrics: Record<string, unknown>;
  captured_at: Date;
}

export async function latestSnapshots(
  platform: Kysely<PlatformDatabase>,
  schoolIds: string[],
  category: AggregateCategory,
): Promise<Map<string, SchoolSnapshot>> {
  if (!schoolIds.length) {
    return new Map();
  }
  const rows = await sql<SchoolSnapshot>`
    select distinct on (school_id) school_id, academic_year, metrics, captured_at
    from aggregate_snapshots
    where category = ${category} and school_id in (${sql.join(schoolIds)})
    order by school_id, captured_at desc`.execute(platform);
  return new Map(rows.rows.map((row) => [row.school_id, row]));
}

// Ghi bản chụp mới của một trường, một nhóm; xóa bản quá hạn giữ
export async function recordAggregateSnapshot(
  platform: Kysely<PlatformDatabase>,
  schoolId: string,
  category: AggregateCategory,
  academicYear: string | null,
  metrics: Record<string, unknown>,
  now = new Date(),
): Promise<void> {
  await platform
    .insertInto('aggregate_snapshots')
    .values({
      school_id: schoolId,
      category,
      academic_year: academicYear,
      metrics: JSON.stringify(metrics),
      captured_at: now,
    })
    .execute();
  await platform
    .deleteFrom('aggregate_snapshots')
    .where('school_id', '=', schoolId)
    .where('captured_at', '<', new Date(now.getTime() - SNAPSHOT_RETENTION_DAYS * 86_400_000))
    .execute();
}

type MetricValue = number | MetricTree;
interface MetricTree {
  [key: string]: MetricValue;
}

// Cộng dồn số theo khóa, kể cả nhóm lồng nhau (theo khối lớp, tình trạng phòng...)
export function sumMetrics(items: Array<Record<string, unknown>>): MetricTree {
  const total: MetricTree = {};
  const add = (target: MetricTree, source: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(source)) {
      if (key === 'rate') {
        continue;
      }
      if (typeof value === 'number' && Number.isFinite(value)) {
        target[key] = (typeof target[key] === 'number' ? (target[key] as number) : 0) + value;
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        const nested = (typeof target[key] === 'object' ? target[key] : {}) as MetricTree;
        target[key] = nested;
        add(nested, value as Record<string, unknown>);
      }
    }
  };
  for (const item of items) {
    add(total, item);
  }
  return withRates(total);
}

// Tỉ lệ tính lại sau khi cộng dồn (không cộng tỉ lệ)
function withRates(metrics: MetricTree): MetricTree {
  const records = metrics.records;
  const present = metrics.present;
  if (typeof records === 'number' && typeof present === 'number') {
    metrics.rate = records > 0 ? Math.round((present / records) * 1000) / 10 : 0;
  }
  return metrics;
}

// Khóa là số đo không phải số người (diện tích, số phòng, số lớp, số biểu, số dòng, số ngày) thì không ẩn
const NOT_PEOPLE = new Set(['area_m2', 'rooms', 'classes', 'forms', 'rows', 'days', 'records', 'rate']);

// Ẩn ô số người từ 1 đến dưới ngưỡng: trả null và liệt kê đường dẫn khóa đã ẩn
export function suppressSmallCells(
  metrics: Record<string, unknown>,
  minGroup: number,
  path: string[] = [],
  hidden: string[] = [],
): { metrics: Record<string, unknown>; hidden: string[] } {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metrics)) {
    if (typeof value === 'number') {
      const people = !NOT_PEOPLE.has(key) && !path.some((part) => part.startsWith('rooms_') || part === 'forms');
      if (people && value > 0 && value < minGroup) {
        out[key] = null;
        hidden.push([...path, key].join('.'));
      } else {
        out[key] = value;
      }
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = suppressSmallCells(value as Record<string, unknown>, minGroup, [...path, key], hidden).metrics;
    } else {
      out[key] = value;
    }
  }
  return { metrics: out, hidden };
}

export interface AggregateView {
  unit: { id: string; code: string; name: string; level: AdminUnitLevel };
  category: AggregateCategory;
  min_group: number;
  schools_count: number;
  // Tổng của nút; null khi ít trường hơn ngưỡng
  total: Record<string, unknown> | null;
  total_hidden_reason: string | null;
  hidden_cells: string[];
  // Từng nút con trực tiếp (cộng dồn cây con của nút con)
  children: Array<{
    id: string;
    code: string;
    name: string;
    level: AdminUnitLevel;
    schools_count: number;
    total: Record<string, unknown> | null;
  }>;
  // So sánh giữa các trường đã đồng ý
  schools: Array<{
    id: string;
    code: string;
    name: string;
    unit_id: string;
    captured_at: Date | null;
    metrics: Record<string, unknown> | null;
  }>;
}

// Số liệu tổng hợp của một nút cho tài khoản cấp trên ở cấp `level`
export async function aggregateForUnit(
  platform: Kysely<PlatformDatabase>,
  unitId: string,
  level: AdminUnitLevel,
  category: AggregateCategory,
  minGroup = DEFAULT_MIN_GROUP,
): Promise<AggregateView> {
  const unit = await platform
    .selectFrom('admin_units')
    .select(['id', 'code', 'name', 'level'])
    .where('id', '=', unitId)
    .executeTakeFirstOrThrow();
  const schools = await consentedSchools(platform, unitId, level, category);
  const snapshots = await latestSnapshots(
    platform,
    schools.map((school) => school.id),
    category,
  );
  const hidden: string[] = [];
  const summarize = (members: ScopedSchool[]) => {
    const metrics = members.map((school) => snapshots.get(school.id)?.metrics).filter(Boolean) as Array<
      Record<string, unknown>
    >;
    if (members.length < minGroup || metrics.length === 0) {
      return null;
    }
    return suppressSmallCells(sumMetrics(metrics), minGroup, [], hidden).metrics;
  };
  const children = await platform
    .selectFrom('admin_units')
    .select(['id', 'code', 'name', 'level'])
    .where('parent_id', '=', unitId)
    .where('status', '=', 'active')
    .orderBy('name')
    .execute();
  const childViews = [];
  for (const child of children) {
    const units = new Set(await subtreeUnitIds(platform, child.id));
    const members = schools.filter((school) => units.has(school.admin_unit_id));
    childViews.push({ ...child, schools_count: members.length, total: summarize(members) });
  }
  const total = summarize(schools);
  return {
    unit,
    category,
    min_group: minGroup,
    schools_count: schools.length,
    total,
    total_hidden_reason:
      total === null && schools.length > 0 && schools.length < minGroup
        ? `Ít hơn ${minGroup} trường đã đồng ý: không hiện tổng để không suy ra từng trường; xem so sánh từng trường`
        : null,
    hidden_cells: [...new Set(hidden)],
    children: childViews,
    schools: schools.map((school) => {
      const snapshot = snapshots.get(school.id);
      return {
        id: school.id,
        code: school.code,
        name: school.name,
        unit_id: school.admin_unit_id,
        captured_at: snapshot?.captured_at ?? null,
        metrics: snapshot ? suppressSmallCells(snapshot.metrics, minGroup, [], hidden).metrics : null,
      };
    }),
  };
}

export interface AdminUnitSeed {
  level: AdminUnitLevel;
  code: string;
  name: string;
  parent_code: string | null;
}

// Bộ nút mặc định: Bộ Giáo dục và Đào tạo, Sở Giáo dục và Đào tạo của tỉnh, thành có danh mục hành chính sau sắp xếp năm 2025 trong
// kho (hiện là TP.HCM theo Nghị quyết 1685/NQ-UBTVQH15, Nghị quyết 202/2025/QH15, mã của Cục Thống kê), và Phòng Văn hóa – Xã
// hội của từng xã, phường mới. Tỉnh, thành khác nạp bằng tệp danh mục (cùng dạng) sau khi đọc văn bản gốc; sửa được sau khi nạp
export function defaultAdminUnits(): AdminUnitSeed[] {
  const units: AdminUnitSeed[] = [
    { level: 'ministry', code: 'bo-gddt', name: 'Bộ Giáo dục và Đào tạo', parent_code: null },
  ];
  HCM_ADMINISTRATIVE_UNITS.provinces.forEach(([period, code, name], index) => {
    if (period !== 'new' || !code) {
      return;
    }
    const departmentCode = `so-${code}`;
    units.push({
      level: 'department',
      code: departmentCode,
      name: `Sở Giáo dục và Đào tạo ${name.replace(/^(Thành phố|Tỉnh) /, '')}`,
      parent_code: 'bo-gddt',
    });
    for (const [province, wardCode, wardName] of HCM_ADMINISTRATIVE_UNITS.newWards) {
      if (province === index && wardCode) {
        units.push({
          level: 'commune',
          code: `px-${wardCode}`,
          name: `Phòng Văn hóa – Xã hội ${wardName}`,
          parent_code: departmentCode,
        });
      }
    }
  });
  return units;
}

// Nạp danh sách nút (bỏ qua mã đã có, giữ nguyên tên đã sửa); nút cha phải có trước hoặc nằm trước trong danh sách
export async function importAdminUnits(
  platform: Kysely<PlatformDatabase>,
  units: AdminUnitSeed[],
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  await platform.transaction().execute(async (transaction) => {
    for (const unit of units) {
      const existing = await transaction
        .selectFrom('admin_units')
        .select('id')
        .where('code', '=', unit.code)
        .executeTakeFirst();
      if (existing) {
        skipped += 1;
        continue;
      }
      const parent = unit.parent_code
        ? await transaction
            .selectFrom('admin_units')
            .select(['id', 'level'])
            .where('code', '=', unit.parent_code)
            .executeTakeFirst()
        : null;
      if (unit.parent_code && !parent) {
        throw new Error(`Chưa có nút cha ${unit.parent_code} của ${unit.code}`);
      }
      if ((parent ? CHILD_LEVEL[parent.level] : 'ministry') !== unit.level) {
        throw new Error(`Cấp của ${unit.code} không hợp với nút cha`);
      }
      await transaction
        .insertInto('admin_units')
        .values({ level: unit.level, code: unit.code, name: unit.name, parent_id: parent?.id ?? null })
        .execute();
      created += 1;
    }
  });
  return { created, skipped };
}
