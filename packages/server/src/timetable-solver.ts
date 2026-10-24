// Máy xếp thời khoá biểu (DT-20 phần 22c2, YCTD-164). Hàm thuần, không đọc cơ sở dữ liệu, không gọi dịch vụ ngoài: tiến trình
// chạy nền (apps/worker) nhận đề bài do máy chủ API dựng từ phân công (20a), khung giờ tiết và số tiết của chương trình, rồi
// trả các phương án. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - thuật toán: xếp tham lam (tiết khó xếp trước, mỗi tiết vào ô làm tăng chi phí ít nhất) rồi tìm kiếm cục bộ kiểu luyện
//   kim (chuyển một tiết sang ô khác của lớp hoặc đổi chỗ hai tiết của lớp), có giới hạn thời gian; mỗi phương án chạy với
//   một hạt giống ngẫu nhiên riêng nên cho kết quả khác nhau, phương án trùng nhau bị bỏ;
// - ràng buộc cứng (luôn bắt buộc, mỗi vi phạm tính 1000 điểm phạt): giáo viên trùng tiết, phòng trùng tiết, giáo viên dạy
//   vào tiết đã báo bận, tiết không xếp được vì lớp hết ô; mỗi lớp một tiết một môn là cách biểu diễn nên không thể vi phạm;
// - ràng buộc mềm có mức quan trọng 0 đến 10 (0 là tắt), điểm phạt nhân với mức: tiết đôi (môn cần hai tiết liền trong một
//   buổi), môn tránh tiết cuối buổi, rải đều trong tuần (số tiết một ngày của môn không quá mức chia đều hoặc mức trường
//   đặt), giáo viên ít tiết trống giữa buổi, lớp không có tiết trống giữa buổi;
// - đề bài không thể xếp (lớp, giáo viên, phòng cần nhiều tiết hơn số ô có thể dùng) được báo ngay ở `issues`, máy vẫn xếp
//   phần xếp được và ghi từng vi phạm còn lại vào phương án.
export const SOFT_CONSTRAINT_CODES = [
  'double_period',
  'avoid_last_period',
  'spread_week',
  'teacher_gaps',
  'class_gaps',
] as const;
export type SoftConstraintCode = (typeof SOFT_CONSTRAINT_CODES)[number];

export const HARD_CONSTRAINT_CODES = ['teacher_clash', 'room_clash', 'teacher_unavailable', 'unplaced'] as const;
export type HardConstraintCode = (typeof HARD_CONSTRAINT_CODES)[number];

export const CONSTRAINT_LABELS: Record<SoftConstraintCode | HardConstraintCode, string> = {
  double_period: 'Tiết đôi',
  avoid_last_period: 'Môn tránh tiết cuối buổi',
  spread_week: 'Rải đều trong tuần',
  teacher_gaps: 'Giáo viên ít tiết trống',
  class_gaps: 'Lớp không có tiết trống giữa buổi',
  teacher_clash: 'Giáo viên không dạy hai lớp cùng tiết',
  room_clash: 'Phòng không dùng cho hai lớp cùng tiết',
  teacher_unavailable: 'Giáo viên không dạy vào tiết đã báo bận',
  unplaced: 'Xếp đủ số tiết của môn',
};

export const DEFAULT_WEIGHTS: Record<SoftConstraintCode, number> = {
  double_period: 5,
  avoid_last_period: 3,
  spread_week: 6,
  teacher_gaps: 4,
  class_gaps: 8,
};

export const HARD_PENALTY = 1000;
export const MAXIMUM_WEIGHT = 10;

export interface SolverPeriod {
  period_no: number;
  session: 'morning' | 'afternoon';
}

export interface SolverDemand {
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  teacher_id: string | null;
  teacher_name: string | null;
  room_id: string | null;
  room_name: string | null;
  // Số tiết mỗi tuần; số lẻ làm tròn lên như kiểm tra xung đột của 22c1
  periods: number;
  double_period?: boolean;
  avoid_last_period?: boolean;
  // Số tiết tối đa một ngày; trống thì lấy mức chia đều (tiết đôi được 2)
  max_per_day?: number | null;
}

export interface SolverSlotRef {
  weekday: number;
  period_no: number;
}

export interface SolverInput {
  days: number[];
  periods: SolverPeriod[];
  demands: SolverDemand[];
  // Tiết giáo viên đã báo bận: mã giáo viên → các ô
  teacher_unavailable?: Record<string, SolverSlotRef[]>;
  weights?: Partial<Record<SoftConstraintCode, number>>;
}

export interface SolverOptions {
  time_limit_ms: number;
  variant_count: number;
  seed?: number;
  // Đồng hồ đo thời gian, kiểm thử thay được
  now?: () => number;
  // Gọi khoảng 4 lần mỗi giây; trả true để dừng sớm (người dùng huỷ)
  on_progress?: (progress: SolverProgress) => Promise<boolean | void> | boolean | void;
}

export interface SolverProgress {
  variant: number;
  variant_count: number;
  percent: number;
  best_score: number;
  best_hard: number;
}

export interface SolverPlacement {
  class_id: string;
  subject_id: string;
  teacher_id: string | null;
  room_id: string | null;
  weekday: number;
  period_no: number;
}

export interface SolverViolation {
  code: HardConstraintCode;
  message: string;
  class_id?: string;
  teacher_id?: string;
  room_id?: string;
  weekday?: number;
  period_no?: number;
}

export interface SolverIssue {
  code: 'class_capacity' | 'teacher_capacity' | 'room_capacity' | 'no_periods' | 'missing_teacher';
  severity: 'hard' | 'soft';
  message: string;
}

export interface SolverVariant {
  variant_no: number;
  score: number;
  hard_count: number;
  soft: Array<{ code: SoftConstraintCode; penalty: number; weight: number }>;
  violations: SolverViolation[];
  placements: SolverPlacement[];
}

export interface SolverResult {
  status: 'feasible' | 'infeasible' | 'stopped';
  issues: SolverIssue[];
  variants: SolverVariant[];
}

const DAY_LABEL = (weekday: number) => (weekday === 7 ? 'Chủ nhật' : `Thứ ${weekday + 1}`);

// Số giả ngẫu nhiên có hạt giống (mulberry32) để kết quả lặp lại được khi kiểm thử
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function normalizeWeights(weights: Partial<Record<SoftConstraintCode, unknown>> | undefined) {
  const result = { ...DEFAULT_WEIGHTS };
  for (const code of SOFT_CONSTRAINT_CODES) {
    const value = weights?.[code];
    if (typeof value === 'number' && Number.isFinite(value)) {
      result[code] = Math.min(MAXIMUM_WEIGHT, Math.max(0, Math.round(value)));
    }
  }
  return result;
}

interface Slot {
  weekday: number;
  period_no: number;
  day: number;
  // Buổi trong ngày, đánh số liên tục theo ngày để tính tiết trống trong một buổi
  block: number;
  last: boolean;
}

interface Unit {
  demand: number;
  classIndex: number;
  teacher: number;
  room: number;
}

// Dựng mô hình chỉ số từ đề bài; dùng chung cho xếp và chấm
class Model {
  readonly slots: Slot[] = [];
  readonly blocks: number[][] = [];
  readonly classIds: string[] = [];
  readonly classNames: string[] = [];
  readonly teacherIds: string[] = [];
  readonly teacherNames: string[] = [];
  readonly roomIds: string[] = [];
  readonly roomNames: string[] = [];
  readonly units: Unit[] = [];
  readonly unitsOfClass: number[][] = [];
  readonly demandsOfClass: number[][] = [];
  readonly unavailable: Uint8Array[] = [];
  readonly demandMaxPerDay: number[] = [];
  readonly demandCount: number[] = [];
  readonly weights: Record<SoftConstraintCode, number>;

  constructor(readonly input: SolverInput) {
    this.weights = normalizeWeights(input.weights);
    const days = [...new Set(input.days)].sort((left, right) => left - right);
    const periods = [...input.periods].sort((left, right) => left.period_no - right.period_no);
    days.forEach((weekday, day) => {
      let previousSession: string | null = null;
      periods.forEach((period, index) => {
        if (period.session !== previousSession) {
          previousSession = period.session;
          this.blocks.push([]);
        }
        const next = periods[index + 1];
        const slotIndex = this.slots.length;
        this.slots.push({
          weekday,
          period_no: period.period_no,
          day,
          block: this.blocks.length - 1,
          last: !next || next.session !== period.session,
        });
        (this.blocks[this.blocks.length - 1] as number[]).push(slotIndex);
      });
    });
    const indexOf = (ids: string[], names: string[], id: string, name: string | null) => {
      let index = ids.indexOf(id);
      if (index < 0) {
        index = ids.length;
        ids.push(id);
        names.push(name ?? id);
      }
      return index;
    };
    input.demands.forEach((demand, demandIndex) => {
      const classIndex = indexOf(this.classIds, this.classNames, demand.class_id, demand.class_name);
      while (this.unitsOfClass.length <= classIndex) {
        this.unitsOfClass.push([]);
        this.demandsOfClass.push([]);
      }
      (this.demandsOfClass[classIndex] as number[]).push(demandIndex);
      const teacher = demand.teacher_id
        ? indexOf(this.teacherIds, this.teacherNames, demand.teacher_id, demand.teacher_name)
        : -1;
      const room = demand.room_id ? indexOf(this.roomIds, this.roomNames, demand.room_id, demand.room_name) : -1;
      const count = Math.max(0, Math.ceil(demand.periods));
      this.demandCount.push(count);
      const even = Math.ceil(count / Math.max(1, days.length));
      this.demandMaxPerDay.push(
        demand.max_per_day && demand.max_per_day > 0
          ? demand.max_per_day
          : Math.max(even, demand.double_period && count >= 2 ? 2 : 1),
      );
      for (let index = 0; index < count; index += 1) {
        (this.unitsOfClass[classIndex] as number[]).push(this.units.length);
        this.units.push({ demand: demandIndex, classIndex, teacher, room });
      }
    });
    for (const teacherId of this.teacherIds) {
      const mask = new Uint8Array(this.slots.length);
      for (const busy of input.teacher_unavailable?.[teacherId] ?? []) {
        const index = this.slotIndex(busy.weekday, busy.period_no);
        if (index >= 0) {
          mask[index] = 1;
        }
      }
      this.unavailable.push(mask);
    }
  }

  slotIndex(weekday: number, periodNo: number): number {
    return this.slots.findIndex((slot) => slot.weekday === weekday && slot.period_no === periodNo);
  }

  demand(index: number): SolverDemand {
    return this.input.demands[index] as SolverDemand;
  }

  slotText(slot: number): string {
    const value = this.slots[slot] as Slot;
    return `${DAY_LABEL(value.weekday)} tiết ${value.period_no}`;
  }
}

// Kiểm tra trước khi xếp: số tiết cần so với số ô dùng được của lớp, giáo viên, phòng
export function checkTimetableInput(input: SolverInput): SolverIssue[] {
  const model = new Model(input);
  const issues: SolverIssue[] = [];
  const slotCount = model.slots.length;
  if (slotCount === 0) {
    issues.push({
      code: 'no_periods',
      severity: 'hard',
      message: 'Chưa có khung giờ tiết học hoặc ngày học trong tuần của cấp',
    });
    return issues;
  }
  model.classIds.forEach((_, classIndex) => {
    const need = (model.unitsOfClass[classIndex] as number[]).length;
    if (need > slotCount) {
      issues.push({
        code: 'class_capacity',
        severity: 'hard',
        message: `Lớp ${model.classNames[classIndex]} cần ${need} tiết/tuần nhưng khung chỉ có ${slotCount} ô`,
      });
    }
  });
  model.teacherIds.forEach((_, teacher) => {
    const need = model.units.filter((unit) => unit.teacher === teacher).length;
    const free = slotCount - (model.unavailable[teacher] as Uint8Array).reduce((sum, value) => sum + value, 0);
    if (need > free) {
      issues.push({
        code: 'teacher_capacity',
        severity: 'hard',
        message: `Giáo viên ${model.teacherNames[teacher]} được phân ${need} tiết/tuần nhưng chỉ có ${free} ô không bận`,
      });
    }
  });
  model.roomIds.forEach((_, room) => {
    const need = model.units.filter((unit) => unit.room === room).length;
    if (need > slotCount) {
      issues.push({
        code: 'room_capacity',
        severity: 'hard',
        message: `Phòng ${model.roomNames[room]} cần ${need} tiết/tuần nhưng khung chỉ có ${slotCount} ô`,
      });
    }
  });
  const missing = new Set<string>();
  for (const demand of input.demands) {
    if (!demand.teacher_id && demand.periods > 0) {
      missing.add(`${demand.class_name}: ${demand.subject_name}`);
    }
  }
  if (missing.size > 0) {
    issues.push({
      code: 'missing_teacher',
      severity: 'soft',
      message: `Chưa phân công giáo viên (vẫn xếp tiết, không kiểm trùng giáo viên): ${[...missing].join('; ')}`,
    });
  }
  return issues;
}

// Trạng thái một lời giải: ô của từng tiết, lưới lớp, số tiết của giáo viên, phòng ở từng ô; chi phí theo lớp, giáo viên,
// phòng giữ sẵn để tính chênh lệch khi đổi một tiết
class State {
  readonly slotOf: Int32Array;
  readonly classGrid: Int32Array[];
  readonly teacherCount: Int32Array[];
  readonly roomCount: Int32Array[];
  readonly classCost: Float64Array;
  readonly teacherCost: Float64Array;
  readonly roomCost: Float64Array;
  unplaced = 0;

  constructor(private readonly model: Model) {
    const slots = model.slots.length;
    this.slotOf = new Int32Array(model.units.length).fill(-1);
    this.classGrid = model.classIds.map(() => new Int32Array(slots).fill(-1));
    this.teacherCount = model.teacherIds.map(() => new Int32Array(slots));
    this.roomCount = model.roomIds.map(() => new Int32Array(slots));
    this.classCost = new Float64Array(model.classIds.length);
    this.teacherCost = new Float64Array(model.teacherIds.length);
    this.roomCost = new Float64Array(model.roomIds.length);
    this.unplaced = model.units.length;
  }

  copyFrom(other: State) {
    this.slotOf.set(other.slotOf);
    this.classGrid.forEach((grid, index) => grid.set(other.classGrid[index] as Int32Array));
    this.teacherCount.forEach((grid, index) => grid.set(other.teacherCount[index] as Int32Array));
    this.roomCount.forEach((grid, index) => grid.set(other.roomCount[index] as Int32Array));
    this.classCost.set(other.classCost);
    this.teacherCost.set(other.teacherCost);
    this.roomCost.set(other.roomCost);
    this.unplaced = other.unplaced;
  }

  // Đặt hoặc gỡ một tiết, không tính lại chi phí
  put(unit: number, slot: number) {
    const value = this.model.units[unit] as Unit;
    (this.classGrid[value.classIndex] as Int32Array)[slot] = unit;
    if (value.teacher >= 0) {
      (this.teacherCount[value.teacher] as Int32Array)[slot]! += 1;
    }
    if (value.room >= 0) {
      (this.roomCount[value.room] as Int32Array)[slot]! += 1;
    }
    if (this.slotOf[unit] === -1) {
      this.unplaced -= 1;
    }
    this.slotOf[unit] = slot;
  }

  take(unit: number) {
    const value = this.model.units[unit] as Unit;
    const slot = this.slotOf[unit] as number;
    if (slot < 0) {
      return;
    }
    (this.classGrid[value.classIndex] as Int32Array)[slot] = -1;
    if (value.teacher >= 0) {
      (this.teacherCount[value.teacher] as Int32Array)[slot]! -= 1;
    }
    if (value.room >= 0) {
      (this.roomCount[value.room] as Int32Array)[slot]! -= 1;
    }
    this.slotOf[unit] = -1;
    this.unplaced += 1;
  }

  // Điểm phạt mềm của một lớp theo từng ràng buộc (chưa nhân mức)
  classPenalties(
    classIndex: number,
  ): Record<'double_period' | 'avoid_last_period' | 'spread_week' | 'class_gaps', number> {
    const model = this.model;
    const grid = this.classGrid[classIndex] as Int32Array;
    const dayCount = model.slots.length === 0 ? 0 : (model.slots[model.slots.length - 1] as Slot).day + 1;
    let doublePeriod = 0;
    let avoidLast = 0;
    let spread = 0;
    let gaps = 0;
    for (const block of model.blocks) {
      let first = -1;
      let last = -1;
      let used = 0;
      block.forEach((slot, position) => {
        if ((grid[slot] as number) >= 0) {
          if (first < 0) {
            first = position;
          }
          last = position;
          used += 1;
        }
      });
      if (first >= 0) {
        gaps += last - first + 1 - used;
      }
    }
    for (const demandIndex of model.demandsOfClass[classIndex] as number[]) {
      const demand = model.demand(demandIndex);
      const perDay = new Int32Array(dayCount);
      let pairs = 0;
      for (const block of model.blocks) {
        let run = 0;
        for (const slot of block) {
          const unit = grid[slot] as number;
          if (unit >= 0 && (model.units[unit] as Unit).demand === demandIndex) {
            run += 1;
            perDay[(model.slots[slot] as Slot).day]! += 1;
            if (demand.avoid_last_period && (model.slots[slot] as Slot).last) {
              avoidLast += 1;
            }
          } else {
            pairs += Math.floor(run / 2);
            run = 0;
          }
        }
        pairs += Math.floor(run / 2);
      }
      if (demand.double_period) {
        doublePeriod += Math.max(0, Math.floor((model.demandCount[demandIndex] as number) / 2) - pairs);
      }
      const limit = model.demandMaxPerDay[demandIndex] as number;
      for (const count of perDay) {
        spread += Math.max(0, count - limit);
      }
    }
    return { double_period: doublePeriod, avoid_last_period: avoidLast, spread_week: spread, class_gaps: gaps };
  }

  computeClass(classIndex: number): number {
    const penalties = this.classPenalties(classIndex);
    const weights = this.model.weights;
    return (
      penalties.double_period * weights.double_period +
      penalties.avoid_last_period * weights.avoid_last_period +
      penalties.spread_week * weights.spread_week +
      penalties.class_gaps * weights.class_gaps
    );
  }

  teacherPenalties(teacher: number) {
    const model = this.model;
    const counts = this.teacherCount[teacher] as Int32Array;
    const busy = model.unavailable[teacher] as Uint8Array;
    let clash = 0;
    let unavailable = 0;
    let gaps = 0;
    for (const block of model.blocks) {
      let first = -1;
      let last = -1;
      let used = 0;
      block.forEach((slot, position) => {
        const count = counts[slot] as number;
        if (count > 0) {
          clash += count - 1;
          unavailable += busy[slot] ? count : 0;
          if (first < 0) {
            first = position;
          }
          last = position;
          used += 1;
        }
      });
      if (first >= 0) {
        gaps += last - first + 1 - used;
      }
    }
    return { clash, unavailable, gaps };
  }

  computeTeacher(teacher: number): number {
    const penalties = this.teacherPenalties(teacher);
    return (penalties.clash + penalties.unavailable) * HARD_PENALTY + penalties.gaps * this.model.weights.teacher_gaps;
  }

  computeRoom(room: number): number {
    let clash = 0;
    for (const count of this.roomCount[room] as Int32Array) {
      if (count > 1) {
        clash += count - 1;
      }
    }
    return clash * HARD_PENALTY;
  }

  recomputeAll() {
    this.model.classIds.forEach((_, index) => (this.classCost[index] = this.computeClass(index)));
    this.model.teacherIds.forEach((_, index) => (this.teacherCost[index] = this.computeTeacher(index)));
    this.model.roomIds.forEach((_, index) => (this.roomCost[index] = this.computeRoom(index)));
  }

  total(): number {
    let sum = this.unplaced * HARD_PENALTY;
    for (const value of this.classCost) sum += value;
    for (const value of this.teacherCost) sum += value;
    for (const value of this.roomCost) sum += value;
    return sum;
  }

  hardCount(): number {
    let count = this.unplaced;
    this.model.teacherIds.forEach((_, teacher) => {
      const penalties = this.teacherPenalties(teacher);
      count += penalties.clash + penalties.unavailable;
    });
    this.model.roomIds.forEach((_, room) => {
      count += Math.round(this.computeRoom(room) / HARD_PENALTY);
    });
    return count;
  }
}

// Chi phí của những lớp, giáo viên, phòng chịu ảnh hưởng khi đổi một hay hai tiết
function affectedCost(state: State, model: Model, units: number[], recompute: boolean): number {
  const classes = new Set<number>();
  const teachers = new Set<number>();
  const rooms = new Set<number>();
  for (const unit of units) {
    const value = model.units[unit] as Unit;
    classes.add(value.classIndex);
    if (value.teacher >= 0) teachers.add(value.teacher);
    if (value.room >= 0) rooms.add(value.room);
  }
  let sum = 0;
  for (const index of classes) {
    if (recompute) state.classCost[index] = state.computeClass(index);
    sum += state.classCost[index] as number;
  }
  for (const index of teachers) {
    if (recompute) state.teacherCost[index] = state.computeTeacher(index);
    sum += state.teacherCost[index] as number;
  }
  for (const index of rooms) {
    if (recompute) state.roomCost[index] = state.computeRoom(index);
    sum += state.roomCost[index] as number;
  }
  return sum;
}

// Xếp tham lam: tiết của giáo viên dạy nhiều và môn tiết đôi trước; mỗi tiết vào ô trống của lớp làm tăng chi phí ít nhất
function construct(state: State, model: Model, random: () => number) {
  const teacherLoad = model.teacherIds.map(
    (_, teacher) => model.units.filter((unit) => unit.teacher === teacher).length,
  );
  const order = model.units
    .map((unit, index) => ({
      index,
      key:
        (unit.teacher >= 0 ? (teacherLoad[unit.teacher] as number) : 0) +
        (unit.room >= 0 ? 5 : 0) +
        (model.demand(unit.demand).double_period ? 3 : 0) +
        random(),
    }))
    .sort((left, right) => right.key - left.key)
    .map((item) => item.index);
  for (const unit of order) {
    const grid = state.classGrid[(model.units[unit] as Unit).classIndex] as Int32Array;
    let bestSlot = -1;
    let bestCost = Infinity;
    for (let slot = 0; slot < model.slots.length; slot += 1) {
      if ((grid[slot] as number) >= 0) continue;
      state.put(unit, slot);
      const cost = affectedCost(state, model, [unit], true) + random() * 0.01;
      state.take(unit);
      if (cost < bestCost) {
        bestCost = cost;
        bestSlot = slot;
      }
    }
    if (bestSlot >= 0) {
      state.put(unit, bestSlot);
    }
  }
  state.recomputeAll();
}

// Tiết đang dính vi phạm cứng, để ưu tiên chọn khi tìm kiếm
function conflictedUnits(state: State, model: Model): number[] {
  const result: number[] = [];
  model.units.forEach((unit, index) => {
    const slot = state.slotOf[index] as number;
    if (slot < 0) return;
    if (
      unit.teacher >= 0 &&
      (((state.teacherCount[unit.teacher] as Int32Array)[slot] as number) > 1 ||
        (model.unavailable[unit.teacher] as Uint8Array)[slot])
    ) {
      result.push(index);
    } else if (unit.room >= 0 && ((state.roomCount[unit.room] as Int32Array)[slot] as number) > 1) {
      result.push(index);
    }
  });
  return result;
}

const yieldToEventLoop = () => new Promise<void>((resolve) => setImmediate(resolve));

function describe(state: State, model: Model, variantNo: number, unplacedReason: string): SolverVariant {
  const violations: SolverViolation[] = [];
  model.teacherIds.forEach((teacherId, teacher) => {
    const counts = state.teacherCount[teacher] as Int32Array;
    counts.forEach((count, slot) => {
      if (count > 1) {
        const classes = model.units
          .map((unit, index) => ({ unit, index }))
          .filter(({ unit, index }) => unit.teacher === teacher && state.slotOf[index] === slot)
          .map(({ unit }) => model.classNames[unit.classIndex]);
        violations.push({
          code: 'teacher_clash',
          message: `Giáo viên ${model.teacherNames[teacher]} dạy ${count} lớp cùng ${model.slotText(slot)}: ${classes.join(', ')}`,
          teacher_id: teacherId,
          weekday: (model.slots[slot] as Slot).weekday,
          period_no: (model.slots[slot] as Slot).period_no,
        });
      }
      if (count > 0 && (model.unavailable[teacher] as Uint8Array)[slot]) {
        violations.push({
          code: 'teacher_unavailable',
          message: `Giáo viên ${model.teacherNames[teacher]} được xếp vào ${model.slotText(slot)} đã báo bận`,
          teacher_id: teacherId,
          weekday: (model.slots[slot] as Slot).weekday,
          period_no: (model.slots[slot] as Slot).period_no,
        });
      }
    });
  });
  model.roomIds.forEach((roomId, room) => {
    (state.roomCount[room] as Int32Array).forEach((count, slot) => {
      if (count > 1) {
        violations.push({
          code: 'room_clash',
          message: `Phòng ${model.roomNames[room]} dùng cho ${count} lớp cùng ${model.slotText(slot)}`,
          room_id: roomId,
          weekday: (model.slots[slot] as Slot).weekday,
          period_no: (model.slots[slot] as Slot).period_no,
        });
      }
    });
  });
  const unplaced = new Map<number, number>();
  model.units.forEach((unit, index) => {
    if (state.slotOf[index] === -1) unplaced.set(unit.demand, (unplaced.get(unit.demand) ?? 0) + 1);
  });
  for (const [demandIndex, count] of unplaced) {
    const demand = model.demand(demandIndex);
    violations.push({
      code: 'unplaced',
      message: `Lớp ${demand.class_name}: còn ${count} tiết môn ${demand.subject_name} ${unplacedReason}`,
      class_id: demand.class_id,
    });
  }
  const totals = { double_period: 0, avoid_last_period: 0, spread_week: 0, class_gaps: 0, teacher_gaps: 0 };
  model.classIds.forEach((_, classIndex) => {
    const penalties = state.classPenalties(classIndex);
    totals.double_period += penalties.double_period;
    totals.avoid_last_period += penalties.avoid_last_period;
    totals.spread_week += penalties.spread_week;
    totals.class_gaps += penalties.class_gaps;
  });
  model.teacherIds.forEach((_, teacher) => {
    totals.teacher_gaps += state.teacherPenalties(teacher).gaps;
  });
  const placements: SolverPlacement[] = [];
  model.units.forEach((unit, index) => {
    const slot = state.slotOf[index] as number;
    if (slot < 0) return;
    const demand = model.demand(unit.demand);
    placements.push({
      class_id: demand.class_id,
      subject_id: demand.subject_id,
      teacher_id: demand.teacher_id,
      room_id: demand.room_id,
      weekday: (model.slots[slot] as Slot).weekday,
      period_no: (model.slots[slot] as Slot).period_no,
    });
  });
  placements.sort(
    (left, right) =>
      left.class_id.localeCompare(right.class_id) || left.weekday - right.weekday || left.period_no - right.period_no,
  );
  return {
    variant_no: variantNo,
    score: Math.round(state.total() * 100) / 100,
    hard_count: violations.length === 0 ? 0 : state.hardCount(),
    soft: SOFT_CONSTRAINT_CODES.map((code) => ({ code, penalty: totals[code], weight: model.weights[code] })),
    violations,
    placements,
  };
}

// Chấm một thời khoá biểu có sẵn (bản nháp sửa tay) theo cùng thang điểm của máy xếp
export function scoreTimetable(input: SolverInput, placements: SolverPlacement[]): SolverVariant {
  const model = new Model(input);
  const state = new State(model);
  const used = new Set<number>();
  for (const placement of placements) {
    const slot = model.slotIndex(placement.weekday, placement.period_no);
    const classIndex = model.classIds.indexOf(placement.class_id);
    if (slot < 0 || classIndex < 0) continue;
    const unit = (model.unitsOfClass[classIndex] as number[]).find(
      (candidate) =>
        !used.has(candidate) &&
        model.demand((model.units[candidate] as Unit).demand).subject_id === placement.subject_id,
    );
    if (unit === undefined || (state.classGrid[classIndex] as Int32Array)[slot] !== -1) continue;
    used.add(unit);
    state.put(unit, slot);
  }
  state.recomputeAll();
  return describe(state, model, 1, 'chưa xếp');
}

export async function solveTimetable(input: SolverInput, options: SolverOptions): Promise<SolverResult> {
  const now = options.now ?? (() => Date.now());
  const issues = checkTimetableInput(input);
  if (issues.some((issue) => issue.code === 'no_periods')) {
    return { status: 'infeasible', issues, variants: [] };
  }
  const model = new Model(input);
  const variantCount = Math.max(1, Math.min(10, Math.floor(options.variant_count)));
  const started = now();
  const perVariant = Math.max(1, options.time_limit_ms / variantCount);
  const variants: SolverVariant[] = [];
  const signatures = new Set<string>();
  let stopped = false;
  let lastReport = 0;
  const report = async (variant: number, fraction: number, best: number, hard: number) => {
    const percent = Math.min(99, Math.floor(((variant + fraction) / variantCount) * 100));
    const result = await options.on_progress?.({
      variant: variant + 1,
      variant_count: variantCount,
      percent,
      best_score: Math.round(best * 100) / 100,
      best_hard: hard,
    });
    if (result === true) stopped = true;
  };
  for (let variant = 0; variant < variantCount && !stopped; variant += 1) {
    const random = createRandom((options.seed ?? 20_261_024) + variant * 7919);
    const state = new State(model);
    construct(state, model, random);
    const best = new State(model);
    best.copyFrom(state);
    let current = state.total();
    let bestCost = current;
    const variantStart = now();
    const deadline = Math.min(started + options.time_limit_ms, variantStart + perVariant);
    const startTemperature = 2 + bestCost / Math.max(1, model.units.length) / 4;
    let iteration = 0;
    let hot = conflictedUnits(state, model);
    while (model.units.length > 0) {
      iteration += 1;
      if ((iteration & 1023) === 0) {
        const time = now();
        if (time >= deadline || bestCost === 0) break;
        if (time - lastReport >= 250) {
          lastReport = time;
          await report(
            variant,
            (time - variantStart) / Math.max(1, deadline - variantStart),
            bestCost,
            best.hardCount(),
          );
          await yieldToEventLoop();
          if (stopped) break;
        }
        hot = conflictedUnits(state, model);
      }
      const fraction = Math.min(1, (now() - variantStart) / Math.max(1, deadline - variantStart));
      const temperature = startTemperature * (1 - fraction) + 0.05;
      const unit =
        hot.length > 0 && random() < 0.6
          ? (hot[Math.floor(random() * hot.length)] as number)
          : Math.floor(random() * model.units.length);
      const from = state.slotOf[unit] as number;
      if (from < 0) continue;
      const classIndex = (model.units[unit] as Unit).classIndex;
      const grid = state.classGrid[classIndex] as Int32Array;
      const to = Math.floor(random() * model.slots.length);
      if (to === from) continue;
      const other = grid[to] as number;
      const touched = other >= 0 ? [unit, other] : [unit];
      const before = affectedCost(state, model, touched, false);
      state.take(unit);
      if (other >= 0) state.take(other);
      state.put(unit, to);
      if (other >= 0) state.put(other, from);
      const after = affectedCost(state, model, touched, true);
      const delta = after - before;
      if (delta <= 0 || random() < Math.exp(-delta / temperature)) {
        current += delta;
        if (current < bestCost - 1e-9) {
          bestCost = current;
          best.copyFrom(state);
        }
      } else {
        state.take(unit);
        if (other >= 0) state.take(other);
        state.put(unit, from);
        if (other >= 0) state.put(other, to);
        affectedCost(state, model, touched, true);
      }
    }
    best.recomputeAll();
    const described = describe(best, model, variants.length + 1, 'không xếp được vì lớp hết ô');
    const signature = described.placements
      .map((item) => `${item.class_id}:${item.subject_id}:${item.weekday}:${item.period_no}`)
      .join('|');
    if (!signatures.has(signature)) {
      signatures.add(signature);
      variants.push(described);
    }
    // Báo tiến độ cả khi phương án xong sớm (đạt điểm 0 trước hạn)
    await report(variant, 1, bestCost, described.hard_count);
    await yieldToEventLoop();
    // Hết giờ chung thì không xếp thêm phương án
    if (now() >= started + options.time_limit_ms) break;
  }
  variants.sort((left, right) => left.score - right.score);
  variants.forEach((variant, index) => (variant.variant_no = index + 1));
  const status = stopped ? 'stopped' : (variants[0]?.hard_count ?? 1) === 0 ? 'feasible' : 'infeasible';
  return { status, issues, variants };
}
