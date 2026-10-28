// Bảng hằng số và đổi đơn vị (DT-29 phần 29d, YCTD-328): hằng số vật lí theo CODATA 2018 (số đúng tuyệt đối ghi "chính xác"),
// làm tròn bốn chữ số có nghĩa; đổi đơn vị độ dài, khối lượng, thời gian, tốc độ, diện tích, thể tích, nhiệt độ. Không import gì
export interface PhysicalConstant {
  name: string;
  symbol: string;
  value: string;
  unit: string;
  note?: string;
}

export const PHYSICAL_CONSTANTS: readonly PhysicalConstant[] = [
  { name: 'Tốc độ ánh sáng trong chân không', symbol: 'c', value: '299 792 458', unit: 'm/s', note: 'chính xác' },
  {
    name: 'Gia tốc rơi tự do (giá trị thường dùng)',
    symbol: 'g',
    value: '9,8',
    unit: 'm/s²',
    note: 'gần đúng, thay đổi theo nơi',
  },
  { name: 'Hằng số hấp dẫn', symbol: 'G', value: '6,674 × 10⁻¹¹', unit: 'N·m²/kg²' },
  { name: 'Số Avogadro', symbol: 'Nₐ', value: '6,022 × 10²³', unit: 'mol⁻¹', note: 'chính xác 6,02214076 × 10²³' },
  {
    name: 'Điện tích nguyên tố',
    symbol: 'e',
    value: '1,602 × 10⁻¹⁹',
    unit: 'C',
    note: 'chính xác 1,602176634 × 10⁻¹⁹',
  },
  { name: 'Hằng số Planck', symbol: 'h', value: '6,626 × 10⁻³⁴', unit: 'J·s', note: 'chính xác 6,62607015 × 10⁻³⁴' },
  { name: 'Hằng số Boltzmann', symbol: 'k', value: '1,381 × 10⁻²³', unit: 'J/K', note: 'chính xác 1,380649 × 10⁻²³' },
  { name: 'Hằng số khí', symbol: 'R', value: '8,314', unit: 'J/(mol·K)' },
  { name: 'Khối lượng electron', symbol: 'mₑ', value: '9,109 × 10⁻³¹', unit: 'kg' },
  { name: 'Khối lượng proton', symbol: 'mₚ', value: '1,673 × 10⁻²⁷', unit: 'kg' },
  { name: 'Khối lượng neutron', symbol: 'mₙ', value: '1,675 × 10⁻²⁷', unit: 'kg' },
  { name: 'Đơn vị khối lượng nguyên tử', symbol: 'u', value: '1,661 × 10⁻²⁷', unit: 'kg' },
  { name: 'Hằng số điện', symbol: 'ε₀', value: '8,854 × 10⁻¹²', unit: 'F/m' },
  { name: 'Hằng số Coulomb', symbol: 'k', value: '8,988 × 10⁹', unit: 'N·m²/C²', note: 'thường lấy 9 × 10⁹' },
  { name: 'Thể tích mol khí ở điều kiện chuẩn (25 °C, 1 bar)', symbol: 'V', value: '24,79', unit: 'L/mol' },
];

export interface UnitDefinition {
  key: string;
  label: string;
  // Hệ số đổi sang đơn vị gốc của nhóm (nhiệt độ đổi riêng)
  factor: number;
}

export interface UnitGroup {
  key: string;
  label: string;
  units: readonly UnitDefinition[];
}

export const UNIT_GROUPS: readonly UnitGroup[] = [
  {
    key: 'length',
    label: 'Độ dài',
    units: [
      { key: 'mm', label: 'mm', factor: 0.001 },
      { key: 'cm', label: 'cm', factor: 0.01 },
      { key: 'dm', label: 'dm', factor: 0.1 },
      { key: 'm', label: 'm', factor: 1 },
      { key: 'km', label: 'km', factor: 1000 },
    ],
  },
  {
    key: 'mass',
    label: 'Khối lượng',
    units: [
      { key: 'mg', label: 'mg', factor: 0.000001 },
      { key: 'g', label: 'g', factor: 0.001 },
      { key: 'kg', label: 'kg', factor: 1 },
      { key: 'ta', label: 'tạ', factor: 100 },
      { key: 't', label: 'tấn', factor: 1000 },
    ],
  },
  {
    key: 'time',
    label: 'Thời gian',
    units: [
      { key: 's', label: 'giây', factor: 1 },
      { key: 'min', label: 'phút', factor: 60 },
      { key: 'h', label: 'giờ', factor: 3600 },
      { key: 'day', label: 'ngày', factor: 86400 },
    ],
  },
  {
    key: 'speed',
    label: 'Tốc độ',
    units: [
      { key: 'm/s', label: 'm/s', factor: 1 },
      { key: 'km/h', label: 'km/h', factor: 1000 / 3600 },
    ],
  },
  {
    key: 'area',
    label: 'Diện tích',
    units: [
      { key: 'cm2', label: 'cm²', factor: 0.0001 },
      { key: 'm2', label: 'm²', factor: 1 },
      { key: 'ha', label: 'ha', factor: 10000 },
      { key: 'km2', label: 'km²', factor: 1000000 },
    ],
  },
  {
    key: 'volume',
    label: 'Thể tích',
    units: [
      { key: 'ml', label: 'mL (cm³)', factor: 0.001 },
      { key: 'l', label: 'L (dm³)', factor: 1 },
      { key: 'm3', label: 'm³', factor: 1000 },
    ],
  },
  {
    key: 'temperature',
    label: 'Nhiệt độ',
    units: [
      { key: 'C', label: '°C', factor: 1 },
      { key: 'K', label: 'K', factor: 1 },
      { key: 'F', label: '°F', factor: 1 },
    ],
  },
];

function toCelsius(value: number, unit: string): number {
  if (unit === 'K') return value - 273.15;
  if (unit === 'F') return ((value - 32) * 5) / 9;
  return value;
}

function fromCelsius(value: number, unit: string): number {
  if (unit === 'K') return value + 273.15;
  if (unit === 'F') return (value * 9) / 5 + 32;
  return value;
}

export function convertUnit(groupKey: string, value: number, from: string, to: string): number | null {
  const group = UNIT_GROUPS.find((item) => item.key === groupKey);
  if (!group) {
    return null;
  }
  if (groupKey === 'temperature') {
    return Number(fromCelsius(toCelsius(value, from), to).toPrecision(12));
  }
  const source = group.units.find((unit) => unit.key === from);
  const target = group.units.find((unit) => unit.key === to);
  if (!source || !target) {
    return null;
  }
  return Number(((value * source.factor) / target.factor).toPrecision(12));
}
