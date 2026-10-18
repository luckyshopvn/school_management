import {
  FACILITY_INVESTMENT_CATEGORIES,
  FACILITY_STANDARD_LEVELS,
  ROOM_BLOCKS,
  ROOM_TYPES,
  type FacilityStandardLevelCode,
} from '@school-management/shared';

// Tính số liệu của 1.2 Báo cáo cơ sở vật chất và gợi ý hiện trạng của 6.1 (DT-16 phần 16i, YCTD-128). Hàm thuần, không
// đọc cơ sở dữ liệu, để kiểm thử từng quy tắc:
// - số liệu phòng: mỗi khối một dòng, dưới khối là từng loại phòng có phòng ("Trong đó"); cột tổng số, kiên cố, bán kiên
//   cố, tạm, nhờ mượn thuê, chưa khai báo hiện trạng, diện tích; chỉ tính phòng đang dùng;
// - nhà vệ sinh: phòng loại Phòng vệ sinh đang dùng theo đối tượng sử dụng (học sinh, cán bộ giáo viên nhân viên, dùng
//   chung, chưa khai báo): số phòng, đạt chuẩn, chưa đạt chuẩn, riêng nam nữ, số chỗ; kèm số phòng sinh hoạt chung có vệ
//   sinh khép kín hoặc liền kề;
// - mức độ đạt chuẩn của trường là mức thấp nhất của năm khối; còn khối chưa đánh giá thì chưa xác định
export interface ReportRoom {
  room_block: string | null;
  room_type: string | null;
  condition: string | null;
  area_m2: number | null;
  status: string;
  facility_attributes: Record<string, unknown>;
}

export interface FacilityFigureRow {
  key: string;
  label: string;
  level: 'block' | 'type' | 'total';
  total: number;
  permanent: number;
  semi_permanent: number;
  temporary: number;
  borrowed: number;
  unspecified: number;
  area_m2: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

function emptyRow(key: string, label: string, level: FacilityFigureRow['level']): FacilityFigureRow {
  return { key, label, level, total: 0, permanent: 0, semi_permanent: 0, temporary: 0, borrowed: 0, unspecified: 0, area_m2: 0 };
}

function addRoom(row: FacilityFigureRow, room: ReportRoom) {
  row.total += 1;
  if (
    room.condition === 'permanent' ||
    room.condition === 'semi_permanent' ||
    room.condition === 'temporary' ||
    room.condition === 'borrowed'
  ) {
    row[room.condition] += 1;
  } else {
    row.unspecified += 1;
  }
  row.area_m2 = round2(row.area_m2 + (room.area_m2 ?? 0));
}

export function buildFacilityFigures(rooms: ReportRoom[]): FacilityFigureRow[] {
  const active = rooms.filter((room) => room.status === 'active');
  const result: FacilityFigureRow[] = [];
  const total = emptyRow('total', 'Tổng số phòng', 'total');
  const blocks: Array<{ value: string; label: string }> = ROOM_BLOCKS.map((block) => ({ value: block.value, label: block.label }));
  blocks.push({ value: 'unassigned', label: 'Chưa phân khối' });
  for (const block of blocks) {
    const inBlock = active.filter((room) => (room.room_block ?? 'unassigned') === block.value);
    if (block.value === 'unassigned' && inBlock.length === 0) {
      continue;
    }
    const blockRow = emptyRow(block.value, block.label, 'block');
    inBlock.forEach((room) => {
      addRoom(blockRow, room);
      addRoom(total, room);
    });
    result.push(blockRow);
    const types = ROOM_TYPES.filter((type) => type.block === block.value);
    for (const type of types) {
      const ofType = inBlock.filter((room) => room.room_type === type.value);
      if (ofType.length === 0) {
        continue;
      }
      const typeRow = emptyRow(`${block.value}.${type.value}`, `Trong đó: ${type.label}`, 'type');
      ofType.forEach((room) => addRoom(typeRow, room));
      result.push(typeRow);
    }
    const untyped = inBlock.filter((room) => !types.some((type) => type.value === room.room_type));
    if (untyped.length > 0 && block.value !== 'unassigned') {
      const typeRow = emptyRow(`${block.value}.unassigned`, 'Trong đó: chưa chọn loại phòng', 'type');
      untyped.forEach((room) => addRoom(typeRow, room));
      result.push(typeRow);
    }
  }
  return [total, ...result];
}

export interface ToiletRow {
  key: string;
  label: string;
  rooms: number;
  met: number;
  not_met: number;
  unassessed: number;
  separate_gender: number;
  seats: number;
}

const TOILET_USERS = [
  { key: 'children', label: 'Nhà vệ sinh dùng cho học sinh' },
  { key: 'staff', label: 'Nhà vệ sinh dùng cho cán bộ, giáo viên, nhân viên' },
  { key: 'shared', label: 'Nhà vệ sinh dùng chung' },
  { key: 'unassigned', label: 'Chưa khai báo đối tượng sử dụng' },
];

export function buildToiletFigures(rooms: ReportRoom[]) {
  const toilets = rooms.filter((room) => room.status === 'active' && room.room_type === 'toilet');
  const total: ToiletRow = {
    key: 'total',
    label: 'Tổng số nhà vệ sinh',
    rooms: 0,
    met: 0,
    not_met: 0,
    unassessed: 0,
    separate_gender: 0,
    seats: 0,
  };
  const rows: ToiletRow[] = [];
  for (const user of TOILET_USERS) {
    const ofUser = toilets.filter((room) => {
      const value = room.facility_attributes.toilet_users;
      return user.key === 'unassigned'
        ? !TOILET_USERS.some((item) => item.key !== 'unassigned' && item.key === value)
        : value === user.key;
    });
    if (user.key === 'unassigned' && ofUser.length === 0) {
      continue;
    }
    const row: ToiletRow = { ...total, key: user.key, label: user.label, rooms: 0 };
    for (const room of ofUser) {
      const standard = room.facility_attributes.toilet_standard;
      const seats = room.facility_attributes.toilet_seats;
      row.rooms += 1;
      row.met += standard === 'met' ? 1 : 0;
      row.not_met += standard === 'not_met' ? 1 : 0;
      row.unassessed += standard === 'met' || standard === 'not_met' ? 0 : 1;
      row.separate_gender += room.facility_attributes.toilet_separate_gender === true ? 1 : 0;
      row.seats += typeof seats === 'number' ? seats : 0;
    }
    for (const key of ['rooms', 'met', 'not_met', 'unassessed', 'separate_gender', 'seats'] as const) {
      total[key] += row[key];
    }
    rows.push(row);
  }
  // Phòng sinh hoạt chung của nhóm, lớp có vệ sinh khép kín hoặc liền kề (thuộc tính Vệ sinh của phòng)
  const groupRooms = rooms.filter((room) => room.status === 'active' && room.room_type === 'group_room');
  return {
    rows: [total, ...rows],
    group_rooms: groupRooms.length,
    group_rooms_ensuite: groupRooms.filter((room) => room.facility_attributes.toilet === 'ensuite').length,
    group_rooms_adjacent: groupRooms.filter((room) => room.facility_attributes.toilet === 'adjacent').length,
  };
}

const LEVEL_ORDER: FacilityStandardLevelCode[] = ['not_met', 'level_1', 'level_2'];

// Mức của trường: thấp nhất trong các khối; chưa đánh giá đủ năm khối thì null
export function overallStandardLevel(
  levels: Array<{ room_block: string; level: string }>,
): FacilityStandardLevelCode | null {
  let lowest: FacilityStandardLevelCode | null = null;
  for (const block of ROOM_BLOCKS) {
    const level = levels.find((item) => item.room_block === block.value)?.level as FacilityStandardLevelCode | undefined;
    if (!level || !LEVEL_ORDER.includes(level)) {
      return null;
    }
    if (lowest === null || LEVEL_ORDER.indexOf(level) < LEVEL_ORDER.indexOf(lowest)) {
      lowest = level;
    }
  }
  return lowest;
}

export const standardLevelLabel = (level: string | null) =>
  FACILITY_STANDARD_LEVELS.find((item) => item.value === level)?.label ?? 'Chưa đánh giá';

// Gợi ý hiện trạng của 6.1 từ khai báo phòng: phòng đang dùng của loại phòng ứng với chỉ tiêu theo hiện trạng. Phòng "Tạm"
// không có cột riêng ở 6.1 nên chỉ báo số để người nhập tự xếp (thường là cấp 4 xuống cấp)
export function investmentSuggestions(rooms: ReportRoom[]) {
  return FACILITY_INVESTMENT_CATEGORIES.map((category) => {
    const ofType = rooms.filter((room) => room.status === 'active' && room.room_type === category.roomType);
    const count = (condition: string) => ofType.filter((room) => room.condition === condition).length;
    return {
      category: category.value,
      rooms: ofType.length,
      permanent: count('permanent'),
      semi_permanent: count('semi_permanent'),
      temporary: count('temporary'),
      borrowed: count('borrowed'),
      unspecified: ofType.filter((room) => !room.condition).length,
    };
  });
}
