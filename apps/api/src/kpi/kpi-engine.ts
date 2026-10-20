import type { KpiCriterionItem, KpiRuleConfig, KpiSubjectGroupCode } from '@school-management/shared';

// Máy chấm KPI (DT-18 phần 18d, YCTD-139): mọi phép tính đọc tham số từ cấu hình của phiên bản bộ quy tắc, không ghi cứng
// điểm chuẩn, tỷ lệ, ngưỡng hay hạn

// Làm tròn 2 chữ số thập phân
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Số ngày làm việc chậm: đếm ngày làm việc sau hạn đến hết ngày hoàn thành
export function lateWorkingDays(deadline: string, finishedOn: string, isWorkDay: (date: string) => boolean): number {
  if (finishedOn <= deadline) {
    return 0;
  }
  let count = 0;
  let cursor = Date.parse(`${deadline}T00:00:00Z`);
  const end = Date.parse(`${finishedOn}T00:00:00Z`);
  while (cursor < end) {
    cursor += 86_400_000;
    if (isWorkDay(new Date(cursor).toISOString().slice(0, 10))) {
      count += 1;
    }
  }
  return count;
}

// Tỷ lệ tiến độ theo số ngày chậm; chưa hoàn thành thì lấy mức cuối (0%)
export function progressPercentFor(config: KpiRuleConfig, lateDays: number | null): number {
  const levels = config.progress_levels;
  if (lateDays === null) {
    return levels.at(-1)?.percent ?? 0;
  }
  for (const level of levels) {
    if (level.max_late_days === null || lateDays <= level.max_late_days) {
      return level.percent;
    }
  }
  return 0;
}

export interface KpiTaskMeasure {
  percent: number;
  onTime: boolean;
  zeroProgress: boolean;
  // Mức cho phép coi là vượt yêu cầu; việc vượt yêu cầu còn cần cấp có thẩm quyền xác nhận
  canExceed: boolean;
}

// Tỷ lệ hoàn thành của một việc theo cách chấm của bộ quy tắc
export function taskMeasure(
  config: KpiRuleConfig,
  input: { progressPercent: number | null; qualityCode: string | null; resultCode: string | null },
): KpiTaskMeasure {
  if (config.scoring_mode === 'level_scale') {
    const level = config.result_levels.find((item) => item.code === input.resultCode);
    const percent = level?.percent ?? 0;
    return {
      percent,
      onTime: Boolean(level?.on_time),
      zeroProgress: !level || Boolean(level.zero_progress),
      canExceed: Boolean(level?.exceeded),
    };
  }
  const progress = input.progressPercent ?? 0;
  const quality = config.quality_levels.find((item) => item.code === input.qualityCode)?.percent ?? 0;
  const weightTotal = config.weights.progress + config.weights.quality || 1;
  const percent = (progress * config.weights.progress + quality * config.weights.quality) / weightTotal;
  return {
    percent: Math.min(100, round2(percent)),
    onTime: progress >= 100,
    zeroProgress: progress <= 0,
    canExceed: progress >= 100 && quality >= 100,
  };
}

export interface KpiTaskScores {
  maxConverted: number;
  execution: number;
  converted: number;
  bonus: number;
}

// Điểm thực hiện = điểm chuẩn × tỷ lệ (không vượt điểm chuẩn); điểm quy đổi = hệ số độ khó × điểm thực hiện (không vượt
// điểm quy đổi tối đa); điểm thưởng = tỷ lệ thưởng × điểm quy đổi
export function taskScores(
  config: KpiRuleConfig,
  input: { standardScore: number; difficultyWeight: number; percent: number; bonusApproved: boolean },
): KpiTaskScores {
  const maxConverted = round2(input.standardScore * input.difficultyWeight);
  const execution = Math.min(input.standardScore, round2((input.standardScore * input.percent) / 100));
  const converted = Math.min(maxConverted, round2(execution * input.difficultyWeight));
  const bonus = input.bonusApproved ? round2((converted * config.bonus.rate_percent) / 100) : 0;
  return { maxConverted, execution, converted, bonus };
}

// Tiêu chí chung áp dụng cho nhóm đối tượng
export function criteriaFor(config: KpiRuleConfig, group: KpiSubjectGroupCode): KpiCriterionItem[] {
  return config.general.groups.flatMap((item) =>
    item.items.filter((criterion) => criterion.subject_groups.includes(group)),
  );
}

export interface KpiTaskForTotal {
  inPlan: boolean;
  counted: boolean;
  graded: boolean;
  maxConverted: number;
  converted: number;
  bonus: number;
  onTime: boolean;
  exceeded: boolean;
  zeroProgress: boolean;
}

export interface KpiTotals {
  planMax: number;
  actualTotal: number;
  taskScore: number;
  bonus: number;
  total: number;
  taskCount: number;
  onTimePercent: number;
  exceedingPercent: number;
  zeroProgressPercent: number;
}

// Điểm phần công việc = min(điểm tối đa, điểm tối đa × B / A); A là tổng điểm quy đổi tối đa của việc đầu kỳ còn hiệu
// lực, B là tổng điểm quy đổi thực tế gồm cả việc phát sinh. Tổng điểm = tiêu chí chung + phần công việc + thưởng, không vượt
// điểm tối đa
export function evaluationTotals(config: KpiRuleConfig, generalScore: number, tasks: KpiTaskForTotal[]): KpiTotals {
  const counted = tasks.filter((task) => task.counted);
  const planMax = round2(counted.filter((task) => task.inPlan).reduce((sum, task) => sum + task.maxConverted, 0));
  const actualTotal = round2(counted.filter((task) => task.graded).reduce((sum, task) => sum + task.converted, 0));
  const partMax = config.task_part.max;
  const taskScore = planMax > 0 ? Math.min(partMax, round2((partMax * actualTotal) / planMax)) : 0;
  const bonus = Math.min(
    config.bonus.max_total,
    round2(counted.filter((task) => task.graded).reduce((sum, task) => sum + task.bonus, 0)),
  );
  const total = Math.min(config.total_max, round2(generalScore + taskScore + bonus));
  const share = (predicate: (task: KpiTaskForTotal) => boolean) =>
    counted.length ? round2((counted.filter(predicate).length * 100) / counted.length) : 0;
  return {
    planMax,
    actualTotal,
    taskScore,
    bonus,
    total,
    taskCount: counted.length,
    onTimePercent: share((task) => task.graded && task.onTime),
    exceedingPercent: share((task) => task.graded && task.exceeded),
    zeroProgressPercent: share((task) => !task.graded || task.zeroProgress),
  };
}

// Mức xếp loại đề xuất theo ngưỡng điểm và điều kiện; có trường hợp loại trừ thì lấy mức thấp nhất
export function suggestRank(config: KpiRuleConfig, totals: KpiTotals, exclusions: string[]): string | null {
  const ranks = [...config.ranks].sort((left, right) => right.min_score - left.min_score);
  const lowest = ranks.at(-1)?.code ?? null;
  if (exclusions.length > 0) {
    return lowest;
  }
  for (const rank of ranks) {
    if (totals.total < rank.min_score) {
      continue;
    }
    if (rank.require_all_on_time && (totals.taskCount === 0 || totals.onTimePercent < 100)) {
      continue;
    }
    if (rank.min_exceeding_percent !== undefined && totals.exceedingPercent < rank.min_exceeding_percent) {
      continue;
    }
    if (rank.max_zero_progress_percent !== undefined && totals.zeroProgressPercent > rank.max_zero_progress_percent) {
      continue;
    }
    return rank.code;
  }
  return lowest;
}

export function rankLabel(config: KpiRuleConfig | undefined, code: string | null | undefined): string {
  if (!code) {
    return '';
  }
  return config?.ranks.find((rank) => rank.code === code)?.label ?? code;
}

export interface KpiQuotaRow {
  rank: string | null;
  isHead: boolean;
  group: KpiSubjectGroupCode;
}

export interface KpiQuotaResult {
  group: KpiSubjectGroupCode | 'all';
  base: number;
  limit: number;
  excellent: number;
  exceeded: boolean;
}

// Số người tối đa được xếp loại xuất sắc: tỷ lệ × số người tính làm gốc (làm tròn xuống), theo nhóm đối tượng nếu cấu hình
export function excellentQuota(config: KpiRuleConfig, rows: KpiQuotaRow[]): KpiQuotaResult[] {
  const quota = config.excellent_quota;
  const ranks = [...config.ranks].sort((left, right) => right.min_score - left.min_score);
  const excellentCode = ranks[0]?.code;
  const goodCodes = ranks.slice(0, 2).map((rank) => rank.code);
  const eligible = rows.filter((row) => !(quota.exclude_heads && row.isHead));
  const groups: Array<KpiSubjectGroupCode | 'all'> = quota.by_group ? ['leader', 'staff'] : ['all'];
  return groups.map((group) => {
    const members = group === 'all' ? eligible : eligible.filter((row) => row.group === group);
    const base =
      quota.base === 'all' ? members.length : members.filter((row) => row.rank && goodCodes.includes(row.rank)).length;
    const limit = Math.floor((base * quota.percent) / 100);
    const excellent = members.filter((row) => row.rank === excellentCode).length;
    return { group, base, limit, excellent, exceeded: excellent > limit };
  });
}

// Kiểm tra cấu hình bộ quy tắc trước khi ghi; trả danh sách lỗi theo đường dẫn trường
export function validateRuleConfig(value: unknown): Array<{ field: string; message: string }> {
  const errors: Array<{ field: string; message: string }> = [];
  const config = (typeof value === 'object' && value !== null ? value : {}) as Partial<KpiRuleConfig>;
  const number = (field: string, item: unknown, minimum = 0, maximum = 1000) => {
    if (typeof item !== 'number' || !Number.isFinite(item) || item < minimum || item > maximum) {
      errors.push({ field, message: `Số từ ${minimum} đến ${maximum}` });
    }
  };
  const list = (field: string, item: unknown, allowEmpty = false): item is unknown[] => {
    if (!Array.isArray(item) || (!allowEmpty && item.length === 0)) {
      errors.push({ field, message: 'Bắt buộc có ít nhất một dòng' });
      return false;
    }
    return true;
  };
  const codes = (field: string, items: Array<{ code?: unknown }>) => {
    const seen = new Set<string>();
    items.forEach((item, index) => {
      if (typeof item?.code !== 'string' || item.code.trim() === '' || item.code.length > 30) {
        errors.push({ field: `${field}.${index}.code`, message: 'Mã từ 1 đến 30 ký tự' });
      } else if (seen.has(item.code)) {
        errors.push({ field: `${field}.${index}.code`, message: 'Mã bị trùng' });
      } else {
        seen.add(item.code);
      }
    });
  };
  if (config.scoring_mode !== 'progress_quality' && config.scoring_mode !== 'level_scale') {
    errors.push({ field: 'scoring_mode', message: 'Cách chấm là progress_quality hoặc level_scale' });
  }
  number('total_max', config.total_max, 1, 1000);
  number('task_part.max', config.task_part?.max, 0, 1000);
  number('general.max', config.general?.max, 0, 1000);
  if (list('general.groups', config.general?.groups, true)) {
    const total = { leader: 0, staff: 0 };
    config.general!.groups.forEach((group, groupIndex) => {
      if (!list(`general.groups.${groupIndex}.items`, group?.items, true)) {
        return;
      }
      for (const [index, item] of group.items.entries()) {
        number(`general.groups.${groupIndex}.items.${index}.max_score`, item?.max_score, 0, 100);
        if (
          !Array.isArray(item?.subject_groups) ||
          item.subject_groups.some((code) => code !== 'leader' && code !== 'staff')
        ) {
          errors.push({
            field: `general.groups.${groupIndex}.items.${index}.subject_groups`,
            message: 'Nhóm đối tượng là leader, staff',
          });
          continue;
        }
        for (const code of item.subject_groups) {
          total[code] += item.max_score;
        }
      }
    });
    for (const code of ['leader', 'staff'] as const) {
      if (config.general?.max !== undefined && round2(total[code]) !== config.general.max) {
        errors.push({
          field: 'general.groups',
          message: `Tổng điểm tiêu chí chung của nhóm ${code} khác ${config.general.max}`,
        });
      }
    }
  }
  if (list('axes', config.axes)) {
    codes('axes', config.axes);
  }
  if (list('task_types', config.task_types)) {
    codes('task_types', config.task_types);
    config.task_types.forEach((item, index) =>
      number(`task_types.${index}.standard_score`, item?.standard_score, 0.01, 1000),
    );
  }
  if (list('difficulty_levels', config.difficulty_levels)) {
    codes('difficulty_levels', config.difficulty_levels);
    config.difficulty_levels.forEach((item, index) =>
      number(`difficulty_levels.${index}.weight`, item?.weight, 0.01, 10),
    );
  }
  if (config.scoring_mode === 'progress_quality') {
    number('weights.progress', config.weights?.progress, 0, 100);
    number('weights.quality', config.weights?.quality, 0, 100);
    if (list('progress_levels', config.progress_levels)) {
      config.progress_levels.forEach((item, index) =>
        number(`progress_levels.${index}.percent`, item?.percent, 0, 100),
      );
    }
    if (list('quality_levels', config.quality_levels)) {
      codes('quality_levels', config.quality_levels);
      config.quality_levels.forEach((item, index) => number(`quality_levels.${index}.percent`, item?.percent, 0, 100));
    }
  }
  if (config.scoring_mode === 'level_scale' && list('result_levels', config.result_levels)) {
    codes('result_levels', config.result_levels);
    config.result_levels.forEach((item, index) => number(`result_levels.${index}.percent`, item?.percent, 0, 100));
  }
  number('bonus.rate_percent', config.bonus?.rate_percent, 0, 100);
  number('bonus.max_total', config.bonus?.max_total, 0, 100);
  if (list('ranks', config.ranks)) {
    codes('ranks', config.ranks);
    config.ranks.forEach((item, index) => number(`ranks.${index}.min_score`, item?.min_score, 0, 1000));
  }
  if (list('exclusions', config.exclusions, true)) {
    codes('exclusions', config.exclusions);
  }
  number('excellent_quota.percent', config.excellent_quota?.percent, 0, 100);
  number('deadlines.approval_days', config.deadlines?.approval_days, 0, 60);
  number('deadlines.grading_days', config.deadlines?.grading_days, 0, 60);
  number('deadlines.max_returns', config.deadlines?.max_returns, 0, 10);
  if (list('subject_groups', config.subject_groups)) {
    codes('subject_groups', config.subject_groups);
  }
  if (list('job_positions', config.job_positions, true)) {
    codes('job_positions', config.job_positions);
  }
  if (!Array.isArray(config.forms)) {
    errors.push({ field: 'forms', message: 'Danh sách mẫu báo cáo' });
  }
  return errors;
}
