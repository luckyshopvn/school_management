import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Optional,
  Logger,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { JobScheduler } from '../common/job-scheduler.js';
import { currentTenant, isMultiTenantMode, requireTenant } from '@school-management/server';
import { Clock, ruleViolationError, validationError, type FieldError } from '@school-management/server';
import {
  encodeGenerationQueueItem,
  GENERATION_QUEUE_KEY,
  GENERATION_TTL_SECONDS,
  MAXIMUM_TIME_LIMIT_SECONDS,
  MAXIMUM_VARIANT_COUNT,
  MINIMUM_TIME_LIMIT_SECONDS,
  generationCancelKey,
  generationJobKey,
  generationResultKey,
  generationStateKey,
  type GenerationJob,
  type GenerationResult,
  type GenerationState,
} from '@school-management/server/timetable-generation';
import {
  CONSTRAINT_LABELS,
  DEFAULT_WEIGHTS,
  HARD_CONSTRAINT_CODES,
  MAXIMUM_WEIGHT,
  SOFT_CONSTRAINT_CODES,
  checkTimetableInput,
  normalizeWeights,
  solveTimetable,
  type SoftConstraintCode,
  type SolverDemand,
  type SolverInput,
  type SolverPlacement,
  type SolverSlotRef,
} from '@school-management/server/timetable-solver';
import { PERMISSION_CODES, type SchoolLevelCode } from '@school-management/shared';
import type { Request } from 'express';
import { Redis } from 'ioredis';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { readSchoolLevel } from '../catalogs/school-level-fields.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { API_CONFIGURATION, type ApiConfiguration } from '../common/configuration.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { isUuid, notFoundError, readRequiredText, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { TimetablesService } from './timetables.js';

// Máy xếp thời khoá biểu (DT-20 phần 22c2, YCTD-164): cài đặt mức quan trọng của ràng buộc, quy tắc xếp của môn, tiết giáo
// viên báo bận; dựng đề bài từ phân công (20a), khung giờ tiết, số tiết của chương trình; đẩy lần xếp cho tiến trình chạy nền
// (apps/worker) qua hàng đợi Redis; đọc tiến độ, lưu các phương án; phương án chọn thành bản nháp (source = 'generator') rồi
// sửa tay, ban hành theo luồng phiên bản của 22c1. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - số tiết của môn lấy theo chương trình của khối lớp (như kiểm tra xung đột của 22c1), giáo viên theo phân công môn ở lớp;
// - phòng riêng của môn (ví dụ phòng Tin học) chỉ áp cho lớp cùng đơn vị với phòng;
// - lần xếp chưa được tiến trình chạy nền nhận sau 10 phút, hoặc đang chạy mà quá giới hạn thời gian 5 phút không báo tiến độ,
//   thì ghi lỗi để người dùng biết và chạy lại.
const MANAGE = PERMISSION_CODES.timetableManage;
const QUEUE_TIMEOUT_MILLISECONDS = 10 * 60_000;
const RUNNING_GRACE_MILLISECONDS = 5 * 60_000;
const RUN_COLUMNS = [
  'id',
  'school_level',
  'status',
  'weights',
  'time_limit_seconds',
  'variant_count',
  'percent',
  'best_score',
  'best_hard',
  'message',
  'issues',
  'created_by_name',
  'created_at',
  'updated_at',
  'finished_at',
] as const;

// Hàng đợi tới tiến trình chạy nền. Máy chủ chạy thật dùng Redis; kiểm thử không có Redis thì chạy máy xếp ngay trong tiến
// trình máy chủ API với cùng giao thức (đề bài, tiến độ, kết quả theo mã lần xếp)
export abstract class TimetableGenerationQueue {
  abstract enqueue(job: GenerationJob): Promise<void>;
  abstract readState(runId: string): Promise<GenerationState | null>;
  abstract readResult(runId: string): Promise<GenerationResult | null>;
  abstract cancel(runId: string): Promise<void>;
  close(): Promise<void> {
    return Promise.resolve();
  }
}

export class RedisTimetableGenerationQueue extends TimetableGenerationQueue {
  private readonly redis: Redis;
  private readonly logger = new Logger('TimetableGenerationQueue');

  constructor(redisUrl: string) {
    super();
    this.redis = new Redis(redisUrl, { maxRetriesPerRequest: 3, lazyConnect: true });
    this.redis.on('error', (error: Error) => this.logger.warn(`Redis của hàng đợi máy xếp lỗi: ${error.message}`));
  }

  async enqueue(job: GenerationJob) {
    await this.redis.set(generationJobKey(job.run_id), JSON.stringify(job), 'EX', GENERATION_TTL_SECONDS);
    await this.redis.rpush(
      GENERATION_QUEUE_KEY,
      encodeGenerationQueueItem(job.run_id, requireTenant('hàng đợi máy xếp')?.keyPrefix ?? ''),
    );
  }

  async readState(runId: string) {
    const text = await this.redis.get(generationStateKey(runId));
    return text ? (JSON.parse(text) as GenerationState) : null;
  }

  async readResult(runId: string) {
    const text = await this.redis.get(generationResultKey(runId));
    return text ? (JSON.parse(text) as GenerationResult) : null;
  }

  async cancel(runId: string) {
    await this.redis.set(generationCancelKey(runId), '1', 'EX', GENERATION_TTL_SECONDS);
  }

  override async close() {
    this.redis.disconnect();
  }
}

export class InProcessTimetableGenerationQueue extends TimetableGenerationQueue {
  private readonly states = new Map<string, GenerationState>();
  private readonly results = new Map<string, GenerationResult>();
  private readonly cancelled = new Set<string>();
  readonly running = new Map<string, Promise<void>>();

  async enqueue(job: GenerationJob) {
    const state = (status: GenerationState['status'], percent: number, message: string | null = null) => ({
      status,
      percent,
      variant: 0,
      variant_count: job.variant_count,
      best_score: null,
      best_hard: null,
      message,
      updated_at: new Date().toISOString(),
    });
    this.states.set(job.run_id, state('running', 0));
    const work = (async () => {
      await new Promise<void>((resolve) => setImmediate(resolve));
      const result = await solveTimetable(job.input, {
        time_limit_ms: job.time_limit_seconds * 1000,
        variant_count: job.variant_count,
        seed: job.seed,
        on_progress: (progress) => {
          this.states.set(job.run_id, { ...state('running', progress.percent), best_score: progress.best_score });
          return this.cancelled.has(job.run_id);
        },
      });
      this.results.set(job.run_id, result);
      this.states.set(job.run_id, {
        ...state(result.status === 'stopped' ? 'cancelled' : 'completed', 100),
        best_score: result.variants[0]?.score ?? null,
        best_hard: result.variants[0]?.hard_count ?? null,
        issues: result.issues,
      });
    })().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.states.set(job.run_id, state('failed', 0, `Máy xếp lỗi: ${message}`));
    });
    this.running.set(job.run_id, work);
  }

  async readState(runId: string) {
    return this.states.get(runId) ?? null;
  }

  async readResult(runId: string) {
    return this.results.get(runId) ?? null;
  }

  async cancel(runId: string) {
    this.cancelled.add(runId);
  }

  // Kiểm thử chờ lần xếp chạy xong
  async settle(runId: string) {
    await this.running.get(runId);
  }
}

export function createGenerationQueue(configuration: ApiConfiguration): TimetableGenerationQueue {
  return configuration.redisUrl
    ? new RedisTimetableGenerationQueue(configuration.redisUrl)
    : new InProcessTimetableGenerationQueue();
}

export interface SubjectRuleInput {
  subject_id: string;
  double_period: boolean;
  avoid_last_period: boolean;
  max_per_day: number | null;
  room_id: string | null;
}

export interface GeneratorSettingsInput {
  weights: Record<SoftConstraintCode, number>;
  time_limit_seconds: number;
  variant_count: number;
}

function readInteger(body: RequestBody, field: string, min: number, max: number, errors: FieldError[]) {
  const value = body?.[field];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    errors.push({ field, message: `Là số nguyên từ ${min} đến ${max}` });
    return min;
  }
  return value;
}

export function parseGeneratorSettings(body: RequestBody): GeneratorSettingsInput {
  const errors: FieldError[] = [];
  const raw = (typeof body?.weights === 'object' && body.weights !== null ? body.weights : {}) as Record<
    string,
    unknown
  >;
  for (const code of SOFT_CONSTRAINT_CODES) {
    const value = raw[code];
    if (
      value !== undefined &&
      (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > MAXIMUM_WEIGHT)
    ) {
      errors.push({ field: `weights.${code}`, message: `Mức quan trọng là số nguyên từ 0 đến ${MAXIMUM_WEIGHT}` });
    }
  }
  const settings = {
    weights: normalizeWeights(raw as Partial<Record<SoftConstraintCode, number>>),
    time_limit_seconds: readInteger(
      body,
      'time_limit_seconds',
      MINIMUM_TIME_LIMIT_SECONDS,
      MAXIMUM_TIME_LIMIT_SECONDS,
      errors,
    ),
    variant_count: readInteger(body, 'variant_count', 1, MAXIMUM_VARIANT_COUNT, errors),
  };
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return settings;
}

export function parseSubjectRules(body: RequestBody): SubjectRuleInput[] {
  const raw = body?.rules;
  if (!Array.isArray(raw)) {
    throw validationError([{ field: 'rules', message: 'Cần danh sách quy tắc của môn' }]);
  }
  const errors: FieldError[] = [];
  const rules = raw.map((value, index) => {
    const item = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
    const prefix = `rules[${index}]`;
    if (!isUuid(item.subject_id)) {
      errors.push({ field: `${prefix}.subject_id`, message: 'Mã môn không hợp lệ' });
    }
    const max = item.max_per_day;
    if (
      max !== null &&
      max !== undefined &&
      (typeof max !== 'number' || !Number.isInteger(max) || max < 1 || max > 10)
    ) {
      errors.push({ field: `${prefix}.max_per_day`, message: 'Số tiết tối đa một ngày từ 1 đến 10' });
    }
    if (item.room_id !== null && item.room_id !== undefined && !isUuid(item.room_id)) {
      errors.push({ field: `${prefix}.room_id`, message: 'Mã phòng không hợp lệ' });
    }
    return {
      subject_id: item.subject_id as string,
      double_period: item.double_period === true,
      avoid_last_period: item.avoid_last_period === true,
      max_per_day: (max as number | null | undefined) ?? null,
      room_id: (item.room_id as string | null | undefined) ?? null,
    };
  });
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return rules;
}

export function parseBusySlots(body: RequestBody): SolverSlotRef[] {
  const raw = body?.slots;
  if (!Array.isArray(raw)) {
    throw validationError([{ field: 'slots', message: 'Cần danh sách tiết bận' }]);
  }
  const seen = new Set<string>();
  const errors: FieldError[] = [];
  const slots: SolverSlotRef[] = [];
  raw.forEach((value, index) => {
    const item = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
    const { weekday, period_no: periodNo } = item;
    if (typeof weekday !== 'number' || !Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
      errors.push({ field: `slots[${index}].weekday`, message: 'Thứ là số nguyên từ 1 đến 7' });
      return;
    }
    if (typeof periodNo !== 'number' || !Number.isInteger(periodNo) || periodNo < 1 || periodNo > 15) {
      errors.push({ field: `slots[${index}].period_no`, message: 'Tiết là số nguyên từ 1 đến 15' });
      return;
    }
    const key = `${weekday}:${periodNo}`;
    if (!seen.has(key)) {
      seen.add(key);
      slots.push({ weekday, period_no: periodNo });
    }
  });
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return slots;
}

@Injectable()
export class TimetableGeneratorService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly timetables: TimetablesService,
    private readonly queue: TimetableGenerationQueue,
    private readonly clock: Clock,
    @Optional() @Inject(API_CONFIGURATION) private readonly configuration: ApiConfiguration | null = null,
  ) {}

  async settings(level: SchoolLevelCode) {
    const { database } = await this.currentSchoolYear.require();
    const row = await database
      .selectFrom('timetable_generator_settings')
      .select(['weights', 'time_limit_seconds', 'variant_count', 'updated_at'])
      .where('school_level', '=', level)
      .executeTakeFirst();
    return {
      school_level: level,
      weights: normalizeWeights(row?.weights as Partial<Record<SoftConstraintCode, number>> | undefined),
      time_limit_seconds: row?.time_limit_seconds ?? 60,
      variant_count: row?.variant_count ?? 3,
      updated_at: row?.updated_at ?? null,
      soft_constraints: SOFT_CONSTRAINT_CODES.map((code) => ({
        code,
        label: CONSTRAINT_LABELS[code],
        default_weight: DEFAULT_WEIGHTS[code],
      })),
      hard_constraints: HARD_CONSTRAINT_CODES.map((code) => ({ code, label: CONSTRAINT_LABELS[code] })),
    };
  }

  async saveSettings(level: SchoolLevelCode, input: GeneratorSettingsInput, origin: ChangeOrigin) {
    const { database, academicYearId } = await this.currentSchoolYear.require();
    const before = await this.settings(level);
    await database.transaction().execute(async (transaction) => {
      await transaction
        .insertInto('timetable_generator_settings')
        .values({
          school_level: level,
          weights: JSON.stringify(input.weights),
          time_limit_seconds: input.time_limit_seconds,
          variant_count: input.variant_count,
          updated_by: origin.actorUserId,
        })
        .onConflict((conflict) =>
          conflict.column('school_level').doUpdateSet({
            weights: JSON.stringify(input.weights),
            time_limit_seconds: input.time_limit_seconds,
            variant_count: input.variant_count,
            updated_by: origin.actorUserId,
            updated_at: this.clock.now(),
          }),
        )
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'timetable_generator_settings',
        entityId: academicYearId,
        action: 'update',
        before: { school_level: level, weights: before.weights, time_limit_seconds: before.time_limit_seconds },
        after: { school_level: level, ...input },
      });
    });
    return this.settings(level);
  }

  // Môn của cấp kèm quy tắc xếp và phòng chọn được
  async subjectRules(level: SchoolLevelCode) {
    const { database } = await this.currentSchoolYear.require();
    const [subjects, rooms] = await Promise.all([
      database
        .selectFrom('subjects')
        .leftJoin('timetable_subject_rules', 'timetable_subject_rules.subject_id', 'subjects.id')
        .select([
          'subjects.id as subject_id',
          'subjects.code as subject_code',
          'subjects.name as subject_name',
          'timetable_subject_rules.double_period',
          'timetable_subject_rules.avoid_last_period',
          'timetable_subject_rules.max_per_day',
          'timetable_subject_rules.room_id',
        ])
        .where('subjects.school_level', '=', level)
        .where('subjects.status', '=', 'active')
        .orderBy('subjects.order_no')
        .execute(),
      database
        .selectFrom('rooms')
        .select(['id', 'code', 'name', 'org_unit_id'])
        .where('status', '=', 'active')
        .orderBy('code')
        .execute(),
    ]);
    return {
      subjects: subjects.map((subject) => ({
        ...subject,
        double_period: subject.double_period ?? false,
        avoid_last_period: subject.avoid_last_period ?? false,
      })),
      rooms,
    };
  }

  async saveSubjectRules(level: SchoolLevelCode, rules: SubjectRuleInput[], origin: ChangeOrigin) {
    const { database, academicYearId } = await this.currentSchoolYear.require();
    const subjectIds = rules.map((rule) => rule.subject_id);
    const subjects = subjectIds.length
      ? await database.selectFrom('subjects').select(['id', 'school_level']).where('id', 'in', subjectIds).execute()
      : [];
    const roomIds = rules.map((rule) => rule.room_id).filter((id): id is string => !!id);
    const rooms = roomIds.length
      ? await database.selectFrom('rooms').select('id').where('id', 'in', roomIds).execute()
      : [];
    const errors: FieldError[] = [];
    rules.forEach((rule, index) => {
      if (subjects.find((subject) => subject.id === rule.subject_id)?.school_level !== level) {
        errors.push({ field: `rules[${index}].subject_id`, message: 'Môn không có hoặc không cùng cấp' });
      }
      if (rule.room_id && !rooms.some((room) => room.id === rule.room_id)) {
        errors.push({ field: `rules[${index}].room_id`, message: 'Không có phòng này' });
      }
    });
    if (errors.length > 0) {
      throw validationError(errors);
    }
    await database.transaction().execute(async (transaction) => {
      for (const rule of rules) {
        const values = {
          double_period: rule.double_period,
          avoid_last_period: rule.avoid_last_period,
          max_per_day: rule.max_per_day,
          room_id: rule.room_id,
          updated_by: origin.actorUserId,
        };
        await transaction
          .insertInto('timetable_subject_rules')
          .values({ subject_id: rule.subject_id, ...values })
          .onConflict((conflict) =>
            conflict.column('subject_id').doUpdateSet({ ...values, updated_at: this.clock.now() }),
          )
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'timetable_subject_rules',
        entityId: academicYearId,
        action: 'update',
        before: null,
        after: { school_level: level, rules },
      });
    });
    return this.subjectRules(level);
  }

  // Giáo viên được phân công dạy môn ở lớp của cấp, kèm tiết đã báo bận
  async teacherBusy(level: SchoolLevelCode) {
    const { database } = await this.currentSchoolYear.require();
    const teachers = await database
      .selectFrom('class_staff_assignments')
      .innerJoin('classes', 'classes.id', 'class_staff_assignments.class_id')
      .select(['class_staff_assignments.staff_user_id', 'class_staff_assignments.staff_name'])
      .where('classes.school_level', '=', level)
      .where('classes.status', '=', 'active')
      .where('class_staff_assignments.status', '=', 'active')
      .where('class_staff_assignments.subject_id', 'is not', null)
      .distinct()
      .orderBy('class_staff_assignments.staff_name')
      .execute();
    const busy = await database
      .selectFrom('timetable_teacher_busy')
      .select(['teacher_user_id', 'weekday', 'period_no'])
      .orderBy('weekday')
      .orderBy('period_no')
      .execute();
    return {
      slots: await this.timetables.periodSlots(level),
      school_days: await this.timetables.schoolDays(level),
      teachers: [...new Map(teachers.map((teacher) => [teacher.staff_user_id, teacher])).values()].map((teacher) => ({
        teacher_user_id: teacher.staff_user_id,
        teacher_name: teacher.staff_name,
        busy: busy
          .filter((row) => row.teacher_user_id === teacher.staff_user_id)
          .map((row) => ({ weekday: row.weekday, period_no: row.period_no })),
      })),
    };
  }

  async saveTeacherBusy(teacherUserId: string, slots: SolverSlotRef[], origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const teacher = await database
      .selectFrom('class_staff_assignments')
      .select('staff_name')
      .where('staff_user_id', '=', teacherUserId)
      .where('status', '=', 'active')
      .executeTakeFirst();
    if (!teacher) {
      throw notFoundError('Giáo viên chưa được phân công giảng dạy', 'teacher');
    }
    await database.transaction().execute(async (transaction) => {
      const before = await transaction
        .selectFrom('timetable_teacher_busy')
        .select(['weekday', 'period_no'])
        .where('teacher_user_id', '=', teacherUserId)
        .execute();
      await transaction.deleteFrom('timetable_teacher_busy').where('teacher_user_id', '=', teacherUserId).execute();
      if (slots.length > 0) {
        await transaction
          .insertInto('timetable_teacher_busy')
          .values(
            slots.map((slot) => ({
              teacher_user_id: teacherUserId,
              teacher_name: teacher.staff_name,
              weekday: slot.weekday,
              period_no: slot.period_no,
              created_by: origin.actorUserId,
            })),
          )
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'timetable_teacher_busy',
        entityId: teacherUserId,
        action: 'update',
        before: { slots: before },
        after: { slots },
      });
    });
    return { teacher_user_id: teacherUserId, busy: slots };
  }

  // Đề bài của máy xếp: lớp đang hoạt động của cấp, môn và số tiết theo chương trình, giáo viên theo phân công, quy tắc môn
  async buildInput(level: SchoolLevelCode, weights: Record<SoftConstraintCode, number>): Promise<SolverInput> {
    const { database } = await this.currentSchoolYear.require();
    const classes = await database
      .selectFrom('classes')
      .select(['id', 'name', 'org_unit_id'])
      .where('school_level', '=', level)
      .where('status', '=', 'active')
      .orderBy('name')
      .execute();
    const classIds = classes.map((row) => row.id);
    const [planned, teachers, rules, rooms, busy, slots, days] = await Promise.all([
      this.timetables.plannedSubjects(database, classIds, level),
      this.timetables.assignedTeachers(database, classIds),
      database
        .selectFrom('timetable_subject_rules')
        .select(['subject_id', 'double_period', 'avoid_last_period', 'max_per_day', 'room_id'])
        .execute(),
      database.selectFrom('rooms').select(['id', 'name', 'org_unit_id']).execute(),
      database.selectFrom('timetable_teacher_busy').select(['teacher_user_id', 'weekday', 'period_no']).execute(),
      this.timetables.periodSlots(level),
      this.timetables.schoolDays(level),
    ]);
    const demands: SolverDemand[] = [];
    for (const classRow of classes) {
      for (const [subjectId, plan] of planned.get(classRow.id) ?? new Map()) {
        // Môn học lựa chọn của THPT (21a) học theo nhóm: nhập tay hoặc Excel, máy xếp không xếp cả lớp (21b)
        if (plan.periods <= 0 || plan.elective) continue;
        const teacher = teachers.get(`${classRow.id}:${subjectId}`);
        const rule = rules.find((item) => item.subject_id === subjectId);
        const room = rule?.room_id ? rooms.find((item) => item.id === rule.room_id) : undefined;
        const usableRoom = room && room.org_unit_id === classRow.org_unit_id ? room : undefined;
        demands.push({
          class_id: classRow.id,
          class_name: classRow.name,
          subject_id: subjectId,
          subject_name: plan.subject_name,
          teacher_id: teacher?.staff_user_id ?? null,
          teacher_name: teacher?.staff_name ?? null,
          room_id: usableRoom?.id ?? null,
          room_name: usableRoom?.name ?? null,
          periods: plan.periods,
          double_period: rule?.double_period ?? false,
          avoid_last_period: rule?.avoid_last_period ?? false,
          max_per_day: rule?.max_per_day ?? null,
        });
      }
    }
    const teacherUnavailable: Record<string, SolverSlotRef[]> = {};
    for (const row of busy) {
      (teacherUnavailable[row.teacher_user_id] ??= []).push({ weekday: row.weekday, period_no: row.period_no });
    }
    return {
      days,
      periods: slots.map((slot) => ({ period_no: slot.period_no, session: slot.session })),
      demands,
      teacher_unavailable: teacherUnavailable,
      weights,
    };
  }

  // Kiểm tra dữ liệu trước khi xếp: số lớp, giáo viên, tiết cần xếp và các vấn đề làm không xếp được
  async precheck(level: SchoolLevelCode) {
    const settings = await this.settings(level);
    const input = await this.buildInput(level, settings.weights);
    return {
      classes: new Set(input.demands.map((demand) => demand.class_id)).size,
      teachers: new Set(input.demands.map((demand) => demand.teacher_id).filter(Boolean)).size,
      lessons: input.demands.reduce((sum, demand) => sum + Math.ceil(demand.periods), 0),
      slots: input.days.length * input.periods.length,
      issues: checkTimetableInput(input),
    };
  }

  // Nhiều trường (DT-SaaS phần S1b): một trường không chiếm máy xếp của cả hệ thống, số lần xếp đang chạy cùng lúc có hạn mức (hạn mức
  // theo gói do phần S5a thay thế). Chế độ một trường không giới hạn thêm ngoài quy tắc mỗi cấp một lần
  private async assertWithinActiveRunQuota(
    database: Awaited<ReturnType<CurrentSchoolYearResolver['require']>>['database'],
  ): Promise<void> {
    if (!isMultiTenantMode()) {
      return;
    }
    const limit = this.configuration?.timetableMaxActiveRuns ?? 2;
    const active = await database
      .selectFrom('timetable_generation_runs')
      .select((builder) => builder.fn.countAll<string>().as('count'))
      .where('status', 'in', ['queued', 'running'])
      .executeTakeFirstOrThrow();
    if (Number(active.count) >= limit) {
      throw ruleViolationError(
        TIMETABLE_RULE_CODE_22C2,
        `Trường đang có ${limit} lần xếp chưa xong, là số tối đa chạy cùng lúc; chờ xong hoặc huỷ bớt`,
      );
    }
  }

  async startRun(
    currentUser: CurrentUser,
    level: SchoolLevelCode,
    overrides: GeneratorSettingsInput | null,
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const active = await database
      .selectFrom('timetable_generation_runs')
      .select('id')
      .where('school_level', '=', level)
      .where('status', 'in', ['queued', 'running'])
      .executeTakeFirst();
    if (active) {
      await this.syncRun(active.id);
      const still = await database
        .selectFrom('timetable_generation_runs')
        .select('status')
        .where('id', '=', active.id)
        .executeTakeFirstOrThrow();
      if (still.status === 'queued' || still.status === 'running') {
        throw ruleViolationError(TIMETABLE_RULE_CODE_22C2, 'Cấp này đang có một lần xếp chưa xong; chờ xong hoặc huỷ');
      }
    }
    await this.assertWithinActiveRunQuota(database);
    const settings = overrides ?? (await this.settings(level));
    const input = await this.buildInput(level, settings.weights);
    if (input.demands.length === 0) {
      throw ruleViolationError(
        TIMETABLE_RULE_CODE_22C2,
        'Chưa có lớp nào của cấp có môn theo chương trình; khai báo ở 7.1, 7.2 trước khi xếp',
      );
    }
    const run = await database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('timetable_generation_runs')
        .values({
          school_level: level,
          weights: JSON.stringify(settings.weights),
          time_limit_seconds: settings.time_limit_seconds,
          variant_count: settings.variant_count,
          issues: JSON.stringify(checkTimetableInput(input)),
          created_by: currentUser.id,
          created_by_name: currentUser.description.full_name,
        })
        .returning(RUN_COLUMNS)
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'timetable_generation_runs',
        entityId: created.id,
        action: 'create',
        before: null,
        after: { school_level: level, ...settings, lessons: input.demands.length },
      });
      return created;
    });
    await this.queue.enqueue({
      run_id: run.id,
      input,
      time_limit_seconds: settings.time_limit_seconds,
      variant_count: settings.variant_count,
      seed: Math.floor(Math.random() * 2 ** 31),
    });
    return run;
  }

  async listRuns(level: SchoolLevelCode) {
    const { database } = await this.currentSchoolYear.require();
    const pending = await database
      .selectFrom('timetable_generation_runs')
      .select('id')
      .where('school_level', '=', level)
      .where('status', 'in', ['queued', 'running'])
      .execute();
    for (const run of pending) {
      await this.syncRun(run.id);
    }
    return database
      .selectFrom('timetable_generation_runs')
      .select(RUN_COLUMNS)
      .where('school_level', '=', level)
      .orderBy('created_at', 'desc')
      .limit(20)
      .execute();
  }

  async run(runId: string) {
    await this.syncRun(runId);
    const { database } = await this.currentSchoolYear.require();
    const run = await database
      .selectFrom('timetable_generation_runs')
      .select(RUN_COLUMNS)
      .where('id', '=', runId)
      .executeTakeFirst();
    if (!run) {
      throw notFoundError('Không tìm thấy lần xếp', 'timetable_generation_run');
    }
    const variants = await database
      .selectFrom('timetable_generation_variants')
      .leftJoin('timetable_versions', 'timetable_versions.id', 'timetable_generation_variants.version_id')
      .select([
        'timetable_generation_variants.variant_no',
        'timetable_generation_variants.score',
        'timetable_generation_variants.hard_count',
        'timetable_generation_variants.soft',
        'timetable_generation_variants.violations',
        'timetable_generation_variants.version_id',
        'timetable_versions.name as version_name',
      ])
      .where('timetable_generation_variants.run_id', '=', runId)
      .orderBy('timetable_generation_variants.variant_no')
      .execute();
    return {
      ...run,
      variants: variants.map((variant) => ({
        ...variant,
        score: Number(variant.score),
        soft: (variant.soft as Array<{ code: SoftConstraintCode; penalty: number; weight: number }>).map((item) => ({
          ...item,
          label: CONSTRAINT_LABELS[item.code],
        })),
        violations: (variant.violations as unknown[]).slice(0, 100),
        violation_count: (variant.violations as unknown[]).length,
      })),
    };
  }

  // Tiết của một phương án kèm tên lớp, môn, giáo viên, phòng để xem trước trên lưới
  async variant(runId: string, variantNo: number) {
    const { database } = await this.currentSchoolYear.require();
    const row = await this.findVariant(runId, variantNo);
    const placements = row.placements as SolverPlacement[];
    const classIds = [...new Set(placements.map((item) => item.class_id))];
    const subjectIds = [...new Set(placements.map((item) => item.subject_id))];
    const roomIds = [...new Set(placements.map((item) => item.room_id).filter((id): id is string => !!id))];
    const [classes, subjects, rooms, teachers] = await Promise.all([
      classIds.length
        ? database.selectFrom('classes').select(['id', 'name']).where('id', 'in', classIds).execute()
        : [],
      subjectIds.length
        ? database.selectFrom('subjects').select(['id', 'name']).where('id', 'in', subjectIds).execute()
        : [],
      roomIds.length ? database.selectFrom('rooms').select(['id', 'name']).where('id', 'in', roomIds).execute() : [],
      this.timetables.assignedTeachers(database, classIds),
    ]);
    const nameOf = (rows: Array<{ id: string; name: string }>, id: string | null) =>
      rows.find((item) => item.id === id)?.name ?? null;
    return {
      run_id: runId,
      variant_no: variantNo,
      school_level: row.school_level,
      slots: await this.timetables.periodSlots(row.school_level),
      lessons: placements.map((item, index) => ({
        id: `${variantNo}-${index}`,
        class_id: item.class_id,
        class_name: nameOf(classes, item.class_id) ?? '',
        weekday: item.weekday,
        period_no: item.period_no,
        subject_id: item.subject_id,
        subject_name: nameOf(subjects, item.subject_id) ?? '',
        teacher_user_id: item.teacher_id,
        teacher_name: item.teacher_id
          ? ([...teachers.values()].find((teacher) => teacher.staff_user_id === item.teacher_id)?.staff_name ?? null)
          : null,
        room_id: item.room_id,
        room_name: nameOf(rooms, item.room_id),
      })),
    };
  }

  private async findVariant(runId: string, variantNo: number) {
    const { database } = await this.currentSchoolYear.require();
    const row = await database
      .selectFrom('timetable_generation_variants')
      .innerJoin('timetable_generation_runs', 'timetable_generation_runs.id', 'timetable_generation_variants.run_id')
      .select([
        'timetable_generation_variants.id',
        'timetable_generation_variants.placements',
        'timetable_generation_variants.hard_count',
        'timetable_generation_variants.version_id',
        'timetable_generation_runs.school_level',
      ])
      .where('timetable_generation_variants.run_id', '=', runId)
      .where('timetable_generation_variants.variant_no', '=', variantNo)
      .executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy phương án', 'timetable_generation_variant');
    }
    return row;
  }

  async cancel(runId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const run = await database
      .selectFrom('timetable_generation_runs')
      .select(['id', 'status'])
      .where('id', '=', runId)
      .executeTakeFirst();
    if (!run) {
      throw notFoundError('Không tìm thấy lần xếp', 'timetable_generation_run');
    }
    if (run.status !== 'queued' && run.status !== 'running') {
      throw ruleViolationError(TIMETABLE_RULE_CODE_22C2, 'Lần xếp đã kết thúc');
    }
    await this.queue.cancel(runId);
    if (run.status === 'queued') {
      await database
        .updateTable('timetable_generation_runs')
        .set({ status: 'cancelled', message: 'Đã huỷ', finished_at: this.clock.now(), updated_at: this.clock.now() })
        .where('id', '=', runId)
        .where('status', '=', 'queued')
        .execute();
    }
    await writeAuditLog(database, {
      origin,
      orgUnitId: null,
      entityName: 'timetable_generation_runs',
      entityId: runId,
      action: 'update',
      before: { status: run.status },
      after: { status: 'cancelled' },
    });
    return this.run(runId);
  }

  // Phương án chọn thành bản nháp mới; sửa tay, kiểm tra, ban hành như bản nhập tay (22c1)
  async applyVariant(
    runId: string,
    variantNo: number,
    input: { name: string; effective_from: string },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const variant = await this.findVariant(runId, variantNo);
    const placements = variant.placements as SolverPlacement[];
    const classIds = [...new Set(placements.map((item) => item.class_id))];
    const teachers = await this.timetables.assignedTeachers(database, classIds);
    return database.transaction().execute(async (transaction) => {
      const version = await transaction
        .insertInto('timetable_versions')
        .values({
          school_level: variant.school_level,
          name: input.name,
          effective_from: input.effective_from,
          source: 'generator',
          note: `Phương án ${variantNo} của máy xếp`,
          created_by: origin.actorUserId,
        })
        .returning(['id', 'school_level', 'name', 'effective_from', 'status', 'source'])
        .executeTakeFirstOrThrow();
      if (placements.length > 0) {
        await transaction
          .insertInto('timetable_lessons')
          .values(
            placements.map((item) => {
              const teacher = teachers.get(`${item.class_id}:${item.subject_id}`);
              return {
                version_id: version.id,
                class_id: item.class_id,
                weekday: item.weekday,
                period_no: item.period_no,
                subject_id: item.subject_id,
                teacher_user_id: teacher?.staff_user_id ?? null,
                teacher_name: teacher?.staff_name ?? null,
                room_id: item.room_id,
              };
            }),
          )
          .execute();
      }
      await transaction
        .updateTable('timetable_generation_variants')
        .set({ version_id: version.id })
        .where('id', '=', variant.id)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'timetable_versions',
        entityId: version.id,
        action: 'create',
        before: null,
        after: { ...version, run_id: runId, variant_no: variantNo, lessons: placements.length },
      });
      return version;
    });
  }

  // Đọc tiến độ từ hàng đợi; xong thì lưu phương án (chỉ một lần), quá hạn thì ghi lỗi
  async syncRun(runId: string) {
    const { database } = await this.currentSchoolYear.require();
    const run = await database
      .selectFrom('timetable_generation_runs')
      .select(['id', 'status', 'created_at', 'updated_at', 'time_limit_seconds'])
      .where('id', '=', runId)
      .executeTakeFirst();
    if (!run || (run.status !== 'queued' && run.status !== 'running')) {
      return;
    }
    const now = this.clock.now();
    const state = await this.queue.readState(runId);
    if (!state) {
      if (now.getTime() - run.created_at.getTime() > QUEUE_TIMEOUT_MILLISECONDS) {
        await this.finish(
          runId,
          'failed',
          'Tiến trình chạy nền chưa nhận lần xếp sau 10 phút; kiểm tra tiến trình rồi xếp lại',
        );
      }
      return;
    }
    if (state.status === 'running' || state.status === 'queued') {
      const stale = now.getTime() - Date.parse(state.updated_at);
      if (stale > run.time_limit_seconds * 1000 + RUNNING_GRACE_MILLISECONDS) {
        await this.finish(runId, 'failed', 'Tiến trình chạy nền ngừng báo tiến độ; xếp lại');
        return;
      }
      await database
        .updateTable('timetable_generation_runs')
        .set({
          status: 'running',
          percent: state.percent,
          best_score: state.best_score,
          best_hard: state.best_hard,
          updated_at: now,
        })
        .where('id', '=', runId)
        .where('status', 'in', ['queued', 'running'])
        .execute();
      return;
    }
    if (state.status === 'failed') {
      await this.finish(runId, 'failed', state.message ?? 'Máy xếp lỗi');
      return;
    }
    const result = await this.queue.readResult(runId);
    await database.transaction().execute(async (transaction) => {
      const claimed = await transaction
        .updateTable('timetable_generation_runs')
        .set({
          status: state.status,
          percent: 100,
          best_score: result?.variants[0]?.score ?? null,
          best_hard: result?.variants[0]?.hard_count ?? null,
          message: state.message ?? summaryOf(result),
          issues: JSON.stringify(result?.issues ?? state.issues ?? []),
          finished_at: now,
          updated_at: now,
        })
        .where('id', '=', runId)
        .where('status', 'in', ['queued', 'running'])
        .returning('id')
        .executeTakeFirst();
      if (!claimed || !result || result.variants.length === 0) {
        return;
      }
      await transaction
        .insertInto('timetable_generation_variants')
        .values(
          result.variants.map((variant) => ({
            run_id: runId,
            variant_no: variant.variant_no,
            score: variant.score,
            hard_count: variant.hard_count,
            soft: JSON.stringify(variant.soft),
            violations: JSON.stringify(variant.violations),
            placements: JSON.stringify(variant.placements),
          })),
        )
        .execute();
    });
  }

  private async finish(runId: string, status: 'failed' | 'cancelled', message: string) {
    const { database } = await this.currentSchoolYear.require();
    await database
      .updateTable('timetable_generation_runs')
      .set({ status, message, finished_at: this.clock.now(), updated_at: this.clock.now() })
      .where('id', '=', runId)
      .where('status', 'in', ['queued', 'running'])
      .execute();
  }

  // Lần xếp chưa xong của mọi cấp, cho tiến trình định kỳ
  async syncPending() {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return;
    }
    const pending = await current.database
      .selectFrom('timetable_generation_runs')
      .select('id')
      .where('status', 'in', ['queued', 'running'])
      .execute();
    for (const run of pending) {
      await this.syncRun(run.id);
    }
  }
}

export const TIMETABLE_RULE_CODE_22C2 = 'YCTD-164';

function summaryOf(result: GenerationResult | null): string | null {
  if (!result) {
    return 'Không đọc được kết quả của máy xếp';
  }
  const best = result.variants[0];
  if (!best) {
    return result.issues[0]?.message ?? 'Máy xếp không cho phương án nào';
  }
  return best.hard_count === 0
    ? `${result.variants.length} phương án, phương án tốt nhất không vi phạm ràng buộc bắt buộc`
    : `Phương án tốt nhất còn ${best.hard_count} vi phạm ràng buộc bắt buộc; xem chi tiết và điều chỉnh dữ liệu`;
}

// Lưu kết quả cả khi không ai mở màn hình theo dõi; cùng nhịp với tiến trình gửi thông báo, 0 là tắt (kiểm thử tự gọi)
@Injectable()
export class TimetableGenerationJobs implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('TimetableGenerationJobs');
  private timer: NodeJS.Timeout | null = null;
  private readonly running = new Set<string>();

  constructor(
    @Inject(API_CONFIGURATION) private readonly configuration: ApiConfiguration,
    private readonly generator: TimetableGeneratorService,
    private readonly queue: TimetableGenerationQueue,
    @Optional() @Inject(JobScheduler) private readonly scheduler: JobScheduler | null = null,
  ) {}

  onApplicationBootstrap() {
    // Nhiều trường (DT-SaaS phần S1b): bộ lập lịch gọi tick cho từng trường đang phục vụ, trong ngữ cảnh của trường
    if (isMultiTenantMode()) {
      this.scheduler?.register({
        name: 'timetable-sync',
        intervalSeconds: this.configuration.notificationDispatchIntervalSeconds ?? 60,
        run: () => this.tick(),
      });
      return;
    }
    const seconds = this.configuration.notificationDispatchIntervalSeconds ?? 60;
    if (seconds > 0) {
      this.timer = setInterval(() => void this.tick(), seconds * 1000);
      this.timer.unref();
    }
  }

  async onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    await this.queue.close();
  }

  async tick(): Promise<void> {
    if (this.running.has(currentTenant()?.code ?? '')) {
      return;
    }
    const tenantKey = currentTenant()?.code ?? '';
    this.running.add(tenantKey);
    try {
      await this.generator.syncPending();
    } catch (error) {
      this.logger.error('Tiến trình lưu kết quả máy xếp lỗi', error instanceof Error ? error.stack : String(error));
    } finally {
      this.running.delete(tenantKey);
    }
  }
}

function readLevel(value: unknown): SchoolLevelCode {
  const errors: FieldError[] = [];
  const level = readSchoolLevel({ school_level: value }, 'school_level', errors);
  if (!level) {
    throw validationError(errors.length > 0 ? errors : [{ field: 'school_level', message: 'Bắt buộc chọn cấp học' }]);
  }
  return level;
}

@Controller('timetable-generator')
@RequirePermission(MANAGE)
export class TimetableGeneratorController {
  constructor(private readonly generator: TimetableGeneratorService) {}

  @Get('settings')
  settings(@Query('school_level') level: string | undefined) {
    return this.generator.settings(readLevel(level ?? 'TH'));
  }

  @Put('settings')
  saveSettings(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.generator.saveSettings(
      readLevel(body?.school_level),
      parseGeneratorSettings(body),
      originOf(request, currentUser),
    );
  }

  @Get('subject-rules')
  subjectRules(@Query('school_level') level: string | undefined) {
    return this.generator.subjectRules(readLevel(level ?? 'TH'));
  }

  @Put('subject-rules')
  saveSubjectRules(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.generator.saveSubjectRules(
      readLevel(body?.school_level),
      parseSubjectRules(body),
      originOf(request, currentUser),
    );
  }

  @Get('teacher-busy')
  teacherBusy(@Query('school_level') level: string | undefined) {
    return this.generator.teacherBusy(readLevel(level ?? 'TH'));
  }

  @Put('teacher-busy/:teacherUserId')
  saveTeacherBusy(
    @Param('teacherUserId', uuidParameter('Mã giáo viên không hợp lệ')) teacherUserId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.generator.saveTeacherBusy(teacherUserId, parseBusySlots(body), originOf(request, currentUser));
  }

  @Get('precheck')
  precheck(@Query('school_level') level: string | undefined) {
    return this.generator.precheck(readLevel(level ?? 'TH'));
  }
}

@Controller('timetable-generations')
@RequirePermission(MANAGE)
export class TimetableGenerationsController {
  constructor(private readonly generator: TimetableGeneratorService) {}

  @Get()
  list(@Query('school_level') level: string | undefined) {
    return this.generator.listRuns(readLevel(level ?? 'TH'));
  }

  // Bắt đầu một lần xếp; không gửi mức quan trọng thì dùng cài đặt đã lưu của cấp
  @Post()
  start(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const level = readLevel(body?.school_level);
    const overrides = body?.weights === undefined ? null : parseGeneratorSettings(body);
    return this.generator.startRun(currentUser, level, overrides, originOf(request, currentUser));
  }

  @Get(':id')
  read(@Param('id', uuidParameter('Mã lần xếp không hợp lệ')) runId: string) {
    return this.generator.run(runId);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(
    @Param('id', uuidParameter('Mã lần xếp không hợp lệ')) runId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.generator.cancel(runId, originOf(request, currentUser));
  }

  @Get(':id/variants/:no')
  variant(
    @Param('id', uuidParameter('Mã lần xếp không hợp lệ')) runId: string,
    @Param('no', ParseIntPipe) variantNo: number,
  ) {
    return this.generator.variant(runId, variantNo);
  }

  @Post(':id/variants/:no/apply')
  @HttpCode(200)
  apply(
    @Param('id', uuidParameter('Mã lần xếp không hợp lệ')) runId: string,
    @Param('no', ParseIntPipe) variantNo: number,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const name = readRequiredText(body, 'name', errors);
    const effectiveFrom = body?.effective_from;
    if (
      typeof effectiveFrom !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom) ||
      Number.isNaN(Date.parse(effectiveFrom))
    ) {
      errors.push({ field: 'effective_from', message: 'Ngày dạng YYYY-MM-DD' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.generator.applyVariant(
      runId,
      variantNo,
      { name, effective_from: effectiveFrom as string },
      originOf(request, currentUser),
    );
  }
}
