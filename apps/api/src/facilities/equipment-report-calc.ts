// Tính tổng hợp thiết bị dạy học (khảo sát mục 4, dòng 2.1; DT-14 phần 14d, YCTD-102). Hàm thuần, không đọc cơ sở dữ
// liệu, để kiểm thử từng quy tắc:
// - định mức tối thiểu của một thiết bị = số lượng của một nhóm, lớp × số nhóm, lớp cùng nhóm tuổi; thiết bị tính theo học
//   sinh thì = số lượng × sĩ số từng lớp, làm tròn lên từng lớp;
// - hiện có = số nhập tay (dòng của đơn vị và của lớp) + số tài sản gắn với thiết bị còn dùng được (trong kho, đã cấp
//   phát, đang cho mượn); lọc theo lớp thì chỉ tính dòng nhập tay và tài sản đặt tại lớp đó;
// - thừa = hiện có vượt định mức, thiếu = định mức chưa có; tỷ lệ đáp ứng = min(hiện có, định mức) / định mức, tối đa 100%;
// - nhu cầu bổ sung năm sau = số nhập tay ở dòng của đơn vị nếu có, nếu không thì bằng số thiếu;
// - thiết bị ngoài danh mục tối thiểu không có định mức của Bộ: chỉ hiện số hiện có và nhu cầu nhập tay
export interface CalcItem {
  id: string;
  code: string;
  name: string;
  unit: string;
  equipment_group: string;
  development_area: string | null;
  age_group: string;
  quantity: number;
  norm_basis: string;
  is_minimum: boolean;
  order_no: number;
}

export interface CalcClass {
  id: string;
  name: string;
  org_unit_id: string;
  age_group: string | null;
  child_count: number;
  // Nhóm áp định mức (YCTD-345): nhóm tuổi Mầm non hoặc mã khối của cấp phổ thông; không có thì dùng age_group
  norm_group?: string | null;
  school_level?: string | null;
}

export const normGroupOf = (row: Pick<CalcClass, 'age_group' | 'norm_group'>) =>
  row.norm_group !== undefined ? row.norm_group : row.age_group;

export interface CalcHolding {
  equipment_item_id: string;
  org_unit_id: string;
  class_id: string | null;
  quantity: number;
  next_year_need: number | null;
}

export interface CalcAsset {
  equipment_item_id: string;
  org_unit_id: string;
  class_id: string | null;
}

export interface EquipmentReportRow {
  equipment_item_id: string;
  code: string;
  name: string;
  unit: string;
  equipment_group: string;
  development_area: string | null;
  age_group: string;
  is_minimum: boolean;
  quantity: number;
  norm_basis: string;
  class_count: number;
  norm: number | null;
  available: number;
  manual_quantity: number;
  asset_quantity: number;
  surplus: number | null;
  shortage: number | null;
  next_year_need: number | null;
  need_source: 'manual' | 'shortage' | null;
  rate_percent: number | null;
}

export interface EquipmentClassSummary {
  class_id: string;
  class_name: string;
  org_unit_id: string;
  age_group: string | null;
  child_count: number;
  norm: number;
  covered: number;
  rate_percent: number | null;
}

export interface EquipmentReport {
  rows: EquipmentReportRow[];
  classes: EquipmentClassSummary[];
  totals: { item_count: number; met_count: number; norm: number; covered: number; rate_percent: number | null };
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const percent = (covered: number, norm: number) => (norm > 0 ? Math.round((covered / norm) * 1000) / 10 : null);

export function classNorm(item: Pick<CalcItem, 'quantity' | 'norm_basis'>, childCount: number): number {
  return item.norm_basis === 'child' ? Math.ceil(round2(item.quantity * childCount)) : item.quantity;
}

export function buildEquipmentReport(input: {
  items: CalcItem[];
  classes: CalcClass[];
  holdings: CalcHolding[];
  assets: CalcAsset[];
  classId: string | null;
}): EquipmentReport {
  const classes = input.classId ? input.classes.filter((row) => row.id === input.classId) : input.classes;
  const inScope = (row: { class_id: string | null }) => (input.classId ? row.class_id === input.classId : true);
  const rows: EquipmentReportRow[] = [];
  const classTotals = new Map<string, { norm: number; covered: number }>(
    classes.map((row) => [row.id, { norm: 0, covered: 0 }]),
  );
  const sortedItems = [...input.items].sort(
    (left, right) => left.order_no - right.order_no || left.code.localeCompare(right.code),
  );
  for (const item of sortedItems) {
    const matching = classes.filter((row) => normGroupOf(row) === item.age_group);
    const holdings = input.holdings.filter((row) => row.equipment_item_id === item.id && inScope(row));
    const manual = round2(holdings.reduce((sum, row) => sum + row.quantity, 0));
    const assetQuantity = input.assets.filter((row) => row.equipment_item_id === item.id && inScope(row)).length;
    const available = round2(manual + assetQuantity);
    // Nhóm tuổi không có lớp nào trong phạm vi và chưa có số hiện có thì không hiện
    if (matching.length === 0 && available === 0) {
      continue;
    }
    const manualNeeds = input.classId
      ? []
      : holdings.filter((row) => row.class_id === null && row.next_year_need !== null);
    const manualNeed = manualNeeds.length
      ? round2(manualNeeds.reduce((sum, row) => sum + (row.next_year_need ?? 0), 0))
      : null;
    if (!item.is_minimum) {
      rows.push({
        ...describe(item),
        class_count: matching.length,
        norm: null,
        available,
        manual_quantity: manual,
        asset_quantity: assetQuantity,
        surplus: null,
        shortage: null,
        next_year_need: manualNeed,
        need_source: manualNeed === null ? null : 'manual',
        rate_percent: null,
      });
      continue;
    }
    const norm = round2(matching.reduce((sum, row) => sum + classNorm(item, row.child_count), 0));
    const shortage = round2(Math.max(0, norm - available));
    const surplus = round2(Math.max(0, available - norm));
    rows.push({
      ...describe(item),
      class_count: matching.length,
      norm,
      available,
      manual_quantity: manual,
      asset_quantity: assetQuantity,
      surplus,
      shortage,
      next_year_need: manualNeed ?? shortage,
      need_source: manualNeed === null ? 'shortage' : 'manual',
      rate_percent: percent(Math.min(available, norm), norm),
    });
    // Mức đáp ứng của từng lớp chỉ tính số đặt tại lớp đó
    for (const row of matching) {
      const total = classTotals.get(row.id);
      if (!total) {
        continue;
      }
      const classAvailable =
        input.holdings
          .filter((holding) => holding.equipment_item_id === item.id && holding.class_id === row.id)
          .reduce((sum, holding) => sum + holding.quantity, 0) +
        input.assets.filter((asset) => asset.equipment_item_id === item.id && asset.class_id === row.id).length;
      const classNormValue = classNorm(item, row.child_count);
      total.norm += classNormValue;
      total.covered += Math.min(classAvailable, classNormValue);
    }
  }
  const minimumRows = rows.filter((row) => row.norm !== null);
  const norm = round2(minimumRows.reduce((sum, row) => sum + (row.norm ?? 0), 0));
  const covered = round2(minimumRows.reduce((sum, row) => sum + Math.min(row.available, row.norm ?? 0), 0));
  return {
    rows,
    classes: classes.map((row) => {
      const total = classTotals.get(row.id) ?? { norm: 0, covered: 0 };
      return {
        class_id: row.id,
        class_name: row.name,
        org_unit_id: row.org_unit_id,
        age_group: normGroupOf(row),
        child_count: row.child_count,
        norm: round2(total.norm),
        covered: round2(total.covered),
        rate_percent: percent(total.covered, total.norm),
      };
    }),
    totals: {
      item_count: minimumRows.length,
      met_count: minimumRows.filter((row) => (row.norm ?? 0) > 0 && row.shortage === 0).length,
      norm,
      covered,
      rate_percent: percent(covered, norm),
    },
  };
}

function describe(item: CalcItem) {
  return {
    equipment_item_id: item.id,
    code: item.code,
    name: item.name,
    unit: item.unit,
    equipment_group: item.equipment_group,
    development_area: item.development_area,
    age_group: item.age_group,
    is_minimum: item.is_minimum,
    quantity: item.quantity,
    norm_basis: item.norm_basis,
  };
}
