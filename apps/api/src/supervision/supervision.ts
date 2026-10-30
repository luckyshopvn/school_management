import { Body, Controller, Get, HttpCode, Injectable, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Kysely, Transaction } from 'kysely';
import type {
  SchoolYearDatabase,
  StudentRuleKind,
  StudentRuleParentNotice,
  SupervisionSchoolLevel,
} from '@school-management/database';
import { Clock, ruleViolationError, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import {
  conflictOnDuplicate,
  isUuid,
  notFoundError,
  readInteger,
  readOptionalText,
  readOptionalUuid,
  readRequiredText,
  readRequiredUuid,
  readStatus,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { coversZone, defaultRuleItems, isClockTime, vietnamMoment, type SupervisionLevel } from './supervision-calc.js';

// Giám thị và rèn luyện từng học sinh, lát L1 (YCTD-391; đề xuất Eric duyệt ngày 2026-10-30): khu vực trong trường, danh mục nội
// quy theo cấp (mục có thể gắn tiêu chí nề nếp lớp cùng cấp), phân công giám thị trực theo nhân sự, khối, khu vực, thứ, giờ; tra
// người đang trực một khu vực ở một thời điểm (`findOnDutySupervisors`, dùng cho cảnh báo camera của YCTD-389). Ghi nhận vi phạm,
// khen từng học sinh làm ở lát sau. Người có quyền ghi nhận chỉ đọc danh mục; người có quyền quản lý sửa
export const SUPERVISION_RULE_CODE = 'YCTD-391';
const LEVELS: SupervisionLevel[] = ['TH', 'THCS', 'THPT'];
const KINDS: StudentRuleKind[] = ['violation', 'commendation'];
const NOTICES: StudentRuleParentNotice[] = ['none', 'immediate', 'daily_digest'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ZONE_COLUMNS = ['id', 'name', 'description', 'order_no', 'status'] as const;
const RULE_COLUMNS = [
  'id',
  'code',
  'name',
  'kind',
  'school_level',
  'parent_notice',
  'class_criterion_id',
  'order_no',
  'status',
] as const;
const ASSIGNMENT_COLUMNS = [
  'supervision_assignments.id',
  'supervision_assignments.staff_id',
  'supervision_assignments.school_level',
  'supervision_assignments.grade_levels',
  'supervision_assignments.zone_ids',
  'supervision_assignments.weekdays',
  'supervision_assignments.start_time',
  'supervision_assignments.end_time',
  'supervision_assignments.from_date',
  'supervision_assignments.to_date',
  'supervision_assignments.note',
  'supervision_assignments.status',
  'supervision_assignments.updated_by_name',
] as const;

type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

interface RuleItemInput {
  code: string;
  name: string;
  kind: StudentRuleKind;
  school_level: SupervisionSchoolLevel;
  parent_notice: StudentRuleParentNotice;
  class_criterion_id: string | null;
  order_no: number;
}

interface AssignmentInput {
  staff_id: string;
  school_level: SupervisionSchoolLevel;
  grade_levels: string[];
  zone_ids: string[];
  weekdays: number[];
  start_time: string;
  end_time: string;
  from_date: string | null;
  to_date: string | null;
  note: string | null;
}

export interface OnDutySupervisor {
  user_id: string;
  staff_id: string;
  full_name: string;
}

@Injectable()
export class SupervisionService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly clock: Clock,
  ) {}

  async zones() {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return [];
    }
    return current.database
      .selectFrom('school_zones')
      .select(ZONE_COLUMNS)
      .orderBy('order_no')
      .orderBy('name')
      .execute();
  }

  async createZone(input: { name: string; description: string | null; order_no: number }, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    return conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const created = await transaction
          .insertInto('school_zones')
          .values(input)
          .returning(ZONE_COLUMNS)
          .executeTakeFirstOrThrow();
        await audit(transaction, origin, 'school_zones', created.id, 'create', null, created);
        return created;
      }),
      'Tên khu vực đã có',
      'name',
    );
  }

  async updateZone(
    zoneId: string,
    changes: { name?: string; description?: string | null; order_no?: number; status?: 'active' | 'inactive' },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const existing = await database
      .selectFrom('school_zones')
      .select(ZONE_COLUMNS)
      .where('id', '=', zoneId)
      .executeTakeFirst();
    if (!existing) {
      throw notFoundError('Không tìm thấy khu vực', 'school_zone');
    }
    return conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const updated = await transaction
          .updateTable('school_zones')
          .set({ ...changes, updated_at: this.clock.now() })
          .where('id', '=', zoneId)
          .returning(ZONE_COLUMNS)
          .executeTakeFirstOrThrow();
        await audit(transaction, origin, 'school_zones', zoneId, 'update', existing, updated);
        return updated;
      }),
      'Tên khu vực đã có',
      'name',
    );
  }

  async ruleItems(level?: SupervisionSchoolLevel) {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return [];
    }
    return current.database
      .selectFrom('student_rule_items')
      .leftJoin('conduct_criteria', 'conduct_criteria.id', 'student_rule_items.class_criterion_id')
      .select([
        'student_rule_items.id',
        'student_rule_items.code',
        'student_rule_items.name',
        'student_rule_items.kind',
        'student_rule_items.school_level',
        'student_rule_items.parent_notice',
        'student_rule_items.class_criterion_id',
        'student_rule_items.order_no',
        'student_rule_items.status',
        'conduct_criteria.name as class_criterion_name',
        'conduct_criteria.points as class_criterion_points',
      ])
      .$if(level !== undefined, (query) => query.where('student_rule_items.school_level', '=', level ?? 'TH'))
      .orderBy('student_rule_items.school_level')
      .orderBy('student_rule_items.kind', 'desc')
      .orderBy('student_rule_items.order_no')
      .orderBy('student_rule_items.code')
      .execute();
  }

  // Tiêu chí nề nếp lớp gắn vào mục nội quy: cùng cấp, đang dùng; vi phạm gắn tiêu chí trừ điểm, khen gắn tiêu chí cộng điểm
  private async assertClassCriterion(
    database: Executor,
    criterionId: string,
    level: SupervisionSchoolLevel,
    kind: StudentRuleKind,
  ): Promise<void> {
    const criterion = await database
      .selectFrom('conduct_criteria')
      .select(['kind', 'school_level', 'status'])
      .where('id', '=', criterionId)
      .executeTakeFirst();
    if (!criterion || criterion.status !== 'active') {
      throw validationError([{ field: 'class_criterion_id', message: 'Tiêu chí nề nếp không có hoặc đã ngừng dùng' }]);
    }
    if (criterion.school_level !== level) {
      throw ruleViolationError(SUPERVISION_RULE_CODE, 'Tiêu chí nề nếp không cùng cấp với mục nội quy', [
        { field: 'class_criterion_id', message: 'Chọn tiêu chí nề nếp của cùng cấp' },
      ]);
    }
    if ((kind === 'violation') !== (criterion.kind === 'minus')) {
      throw ruleViolationError(SUPERVISION_RULE_CODE, 'Vi phạm gắn tiêu chí trừ điểm, khen gắn tiêu chí cộng điểm', [
        { field: 'class_criterion_id', message: 'Loại tiêu chí không khớp loại mục nội quy' },
      ]);
    }
  }

  async createRuleItem(input: RuleItemInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    if (input.class_criterion_id) {
      await this.assertClassCriterion(database, input.class_criterion_id, input.school_level, input.kind);
    }
    return conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const created = await transaction
          .insertInto('student_rule_items')
          .values(input)
          .returning(RULE_COLUMNS)
          .executeTakeFirstOrThrow();
        await audit(transaction, origin, 'student_rule_items', created.id, 'create', null, created);
        return created;
      }),
      'Mã mục nội quy đã có ở cấp này',
      'code',
    );
  }

  async updateRuleItem(
    itemId: string,
    changes: {
      name?: string;
      parent_notice?: StudentRuleParentNotice;
      class_criterion_id?: string | null;
      order_no?: number;
      status?: 'active' | 'inactive';
    },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const existing = await database
      .selectFrom('student_rule_items')
      .select(RULE_COLUMNS)
      .where('id', '=', itemId)
      .executeTakeFirst();
    if (!existing) {
      throw notFoundError('Không tìm thấy mục nội quy', 'student_rule_item');
    }
    if (changes.class_criterion_id) {
      await this.assertClassCriterion(database, changes.class_criterion_id, existing.school_level, existing.kind);
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('student_rule_items')
        .set({ ...changes, updated_at: this.clock.now() })
        .where('id', '=', itemId)
        .returning(RULE_COLUMNS)
        .executeTakeFirstOrThrow();
      await audit(transaction, origin, 'student_rule_items', itemId, 'update', existing, updated);
      return updated;
    });
  }

  // Nạp bộ nội quy mặc định của cấp; mã đã có ở cấp thì bỏ qua
  async loadDefaultRuleItems(level: SupervisionSchoolLevel, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const existing = new Set(
      (await database.selectFrom('student_rule_items').select('code').where('school_level', '=', level).execute()).map(
        (row) => row.code,
      ),
    );
    const created: string[] = [];
    const defaults = defaultRuleItems(level);
    let order = 0;
    for (const item of defaults) {
      order += 1;
      if (existing.has(item.code)) {
        continue;
      }
      await this.createRuleItem({ ...item, school_level: level, class_criterion_id: null, order_no: order }, origin);
      created.push(item.code);
    }
    return { created, skipped: defaults.map((item) => item.code).filter((code) => !created.includes(code)) };
  }

  // Nhân sự đang làm việc, đã có tài khoản, trong phạm vi đơn vị của người phân công
  async staffOptions(currentUser: CurrentUser) {
    const { database } = await this.currentSchoolYear.require();
    const scope = await this.organizationScopes.resolve(currentUser, PERMISSION_CODES.supervisionManage);
    return database
      .selectFrom('staff')
      .select(['id', 'full_name', 'org_unit_id'])
      .where('status', '=', 'active')
      .where('user_id', 'is not', null)
      .$if(!scope.wholeSchool, (query) =>
        query.where('org_unit_id', 'in', [...scope.orgUnitIds, '00000000-0000-0000-0000-000000000000']),
      )
      .orderBy('full_name')
      .execute();
  }

  async assignments(
    currentUser: CurrentUser,
    filter: { staffId: string | null; level: SupervisionSchoolLevel | null },
  ) {
    const { database } = await this.currentSchoolYear.require();
    const scope = await this.organizationScopes.resolve(currentUser, PERMISSION_CODES.supervisionManage);
    return database
      .selectFrom('supervision_assignments')
      .innerJoin('staff', 'staff.id', 'supervision_assignments.staff_id')
      .select([...ASSIGNMENT_COLUMNS, 'staff.full_name as staff_name'])
      .$if(filter.staffId !== null, (query) =>
        query.where('supervision_assignments.staff_id', '=', filter.staffId ?? ''),
      )
      .$if(filter.level !== null, (query) =>
        query.where('supervision_assignments.school_level', '=', filter.level ?? 'TH'),
      )
      .$if(!scope.wholeSchool, (query) =>
        query.where('staff.org_unit_id', 'in', [...scope.orgUnitIds, '00000000-0000-0000-0000-000000000000']),
      )
      .orderBy('supervision_assignments.status')
      .orderBy('staff.full_name')
      .orderBy('supervision_assignments.start_time')
      .execute();
  }

  private async assertAssignmentReferences(
    database: Executor,
    currentUser: CurrentUser,
    input: Pick<AssignmentInput, 'staff_id' | 'school_level' | 'grade_levels' | 'zone_ids'>,
  ): Promise<void> {
    const staff = await database
      .selectFrom('staff')
      .select(['org_unit_id', 'status', 'user_id'])
      .where('id', '=', input.staff_id)
      .executeTakeFirst();
    if (!staff) {
      throw notFoundError('Không tìm thấy nhân sự', 'staff');
    }
    await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.supervisionManage, staff.org_unit_id);
    if (staff.status !== 'active' || !staff.user_id) {
      throw ruleViolationError(SUPERVISION_RULE_CODE, 'Chỉ phân công nhân sự đang làm việc và đã có tài khoản', [
        { field: 'staff_id', message: 'Nhân sự đã nghỉ hoặc chưa có tài khoản' },
      ]);
    }
    const errors: FieldError[] = [];
    if (input.grade_levels.length > 0) {
      const found = await database
        .selectFrom('grade_levels')
        .select('code')
        .where('code', 'in', input.grade_levels)
        .where('school_level', '=', input.school_level)
        .execute();
      if (found.length !== new Set(input.grade_levels).size) {
        errors.push({ field: 'grade_levels', message: 'Có khối không thuộc cấp đã chọn' });
      }
    }
    if (input.zone_ids.length > 0) {
      const found = await database
        .selectFrom('school_zones')
        .select('id')
        .where('id', 'in', input.zone_ids)
        .where('status', '=', 'active')
        .execute();
      if (found.length !== new Set(input.zone_ids).size) {
        errors.push({ field: 'zone_ids', message: 'Có khu vực không có hoặc đã ngừng dùng' });
      }
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
  }

  async createAssignment(currentUser: CurrentUser, input: AssignmentInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    await this.assertAssignmentReferences(database, currentUser, input);
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('supervision_assignments')
        .values({ ...input, updated_by_name: currentUser.description.full_name })
        .returning('id')
        .executeTakeFirstOrThrow();
      await audit(transaction, origin, 'supervision_assignments', created.id, 'create', null, input);
      return this.assignment(transaction, created.id);
    });
  }

  async updateAssignment(
    currentUser: CurrentUser,
    assignmentId: string,
    changes: Partial<Omit<AssignmentInput, 'staff_id'>> & { status?: 'active' | 'inactive' },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const existing = await this.assignment(database, assignmentId);
    const merged = {
      ...existing,
      ...Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined)),
    } as typeof existing;
    if (merged.start_time >= merged.end_time) {
      throw validationError([{ field: 'end_time', message: 'Giờ kết thúc phải sau giờ bắt đầu' }]);
    }
    if (merged.from_date && merged.to_date && merged.from_date > merged.to_date) {
      throw validationError([{ field: 'to_date', message: 'Ngày kết thúc không trước ngày bắt đầu' }]);
    }
    await this.assertAssignmentReferences(database, currentUser, merged);
    return database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('supervision_assignments')
        .set({ ...changes, updated_by_name: currentUser.description.full_name, updated_at: this.clock.now() })
        .where('id', '=', assignmentId)
        .execute();
      await audit(transaction, origin, 'supervision_assignments', assignmentId, 'update', existing, changes);
      return this.assignment(transaction, assignmentId);
    });
  }

  private async assignment(database: Executor, assignmentId: string) {
    const row = await database
      .selectFrom('supervision_assignments')
      .innerJoin('staff', 'staff.id', 'supervision_assignments.staff_id')
      .select([...ASSIGNMENT_COLUMNS, 'staff.full_name as staff_name'])
      .where('supervision_assignments.id', '=', assignmentId)
      .executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy phân công trực', 'supervision_assignment');
    }
    return row;
  }

  // Người đang trực khu vực ở thời điểm (giờ Việt Nam): phân công đang dùng phủ khu vực, nhân sự đang làm việc có tài khoản.
  // Danh sách trống thì nơi gọi báo cho người có quyền quản lý rèn luyện (Ban giám hiệu)
  async findOnDutySupervisors(zoneId: string, at?: Date): Promise<OnDutySupervisor[]> {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return [];
    }
    const moment = vietnamMoment(at ?? this.clock.now());
    const rows = await current.database
      .selectFrom('supervision_assignments')
      .innerJoin('staff', 'staff.id', 'supervision_assignments.staff_id')
      .select([
        'supervision_assignments.zone_ids',
        'supervision_assignments.weekdays',
        'supervision_assignments.start_time',
        'supervision_assignments.end_time',
        'supervision_assignments.from_date',
        'supervision_assignments.to_date',
        'staff.id as staff_id',
        'staff.user_id',
        'staff.full_name',
      ])
      .where('supervision_assignments.status', '=', 'active')
      .where('staff.status', '=', 'active')
      .where('staff.user_id', 'is not', null)
      .execute();
    const found = new Map<string, OnDutySupervisor>();
    for (const row of rows) {
      if (row.user_id && coversZone(row, zoneId, moment)) {
        found.set(row.user_id, { user_id: row.user_id, staff_id: row.staff_id, full_name: row.full_name });
      }
    }
    return [...found.values()].sort((left, right) => left.full_name.localeCompare(right.full_name, 'vi'));
  }
}

function audit(
  transaction: Transaction<SchoolYearDatabase>,
  origin: ChangeOrigin,
  entityName: string,
  entityId: string,
  action: 'create' | 'update',
  before: unknown,
  after: unknown,
) {
  return writeAuditLog(transaction, { origin, orgUnitId: null, entityName, entityId, action, before, after });
}

function readLevel(source: Record<string, unknown> | undefined, field: string, errors: FieldError[]) {
  const value = source?.[field];
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (!LEVELS.includes(value as SupervisionLevel)) {
    errors.push({ field, message: 'Cấp học là TH, THCS hoặc THPT' });
    return undefined;
  }
  return value as SupervisionSchoolLevel;
}

function readChoice<T extends string>(
  body: RequestBody,
  field: string,
  choices: readonly T[],
  message: string,
  errors: FieldError[],
): T | undefined {
  const value = body?.[field];
  if (value === undefined) {
    return undefined;
  }
  if (!choices.includes(value as T)) {
    errors.push({ field, message });
    return undefined;
  }
  return value as T;
}

function readTextList(body: RequestBody, field: string, errors: FieldError[]): string[] | undefined {
  const value = body?.[field];
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.trim() === '')) {
    errors.push({ field, message: 'Phải là danh sách mã' });
    return undefined;
  }
  return [...new Set(value.map((item: string) => item.trim()))];
}

function readUuidList(body: RequestBody, field: string, errors: FieldError[]): string[] | undefined {
  const list = readTextList(body, field, errors);
  if (list && list.some((item) => !isUuid(item))) {
    errors.push({ field, message: 'Có mã không hợp lệ' });
    return undefined;
  }
  return list;
}

function readWeekdays(body: RequestBody, errors: FieldError[]): number[] | undefined {
  const value = body?.weekdays;
  if (value === undefined) {
    return undefined;
  }
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((item) => !Number.isInteger(item) || item < 1 || item > 7)
  ) {
    errors.push({ field: 'weekdays', message: 'Chọn ít nhất một thứ trong tuần (1 là thứ hai, 7 là chủ nhật)' });
    return undefined;
  }
  return [...new Set(value as number[])].sort();
}

function readTime(body: RequestBody, field: string, errors: FieldError[]): string | undefined {
  const value = body?.[field];
  if (value === undefined) {
    return undefined;
  }
  if (!isClockTime(value)) {
    errors.push({ field, message: 'Giờ theo dạng HH:MM' });
    return undefined;
  }
  return value;
}

function readOptionalDate(body: RequestBody, field: string, errors: FieldError[]): string | null | undefined {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    return value === undefined ? undefined : null;
  }
  if (typeof value !== 'string' || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    errors.push({ field, message: 'Ngày theo dạng YYYY-MM-DD' });
    return undefined;
  }
  return value;
}

function readShortText(body: RequestBody, field: string, max: number, errors: FieldError[]) {
  const value = readOptionalText(body, field, errors);
  if (value && value.length > max) {
    errors.push({ field, message: `Tối đa ${max} ký tự` });
  }
  return value;
}

const KIND_MESSAGE = 'Loại là violation (vi phạm) hoặc commendation (khen)';
const NOTICE_MESSAGE = 'Báo phụ huynh là none (không), immediate (ngay) hoặc daily_digest (gộp cuối ngày)';

@Controller('supervision')
export class SupervisionController {
  constructor(private readonly supervision: SupervisionService) {}

  @Get('zones')
  @RequirePermission(PERMISSION_CODES.supervisionRecord, PERMISSION_CODES.supervisionManage)
  zones() {
    return this.supervision.zones();
  }

  @Post('zones')
  @RequirePermission(PERMISSION_CODES.supervisionManage)
  createZone(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      name: readRequiredText(body, 'name', errors),
      description: readShortText(body, 'description', 500, errors) ?? null,
      order_no: readInteger(body, 'order_no', errors, { min: 0, max: 9999 }) ?? 0,
    };
    if (input.name.length > 100) {
      errors.push({ field: 'name', message: 'Tối đa 100 ký tự' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.supervision.createZone(input, originOf(request, currentUser));
  }

  @Patch('zones/:id')
  @RequirePermission(PERMISSION_CODES.supervisionManage)
  updateZone(
    @Param('id', uuidParameter('Mã khu vực không hợp lệ')) zoneId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const name = body?.name === undefined ? undefined : readRequiredText(body, 'name', errors);
    if (name && name.length > 100) {
      errors.push({ field: 'name', message: 'Tối đa 100 ký tự' });
    }
    const changes = {
      name,
      description: readShortText(body, 'description', 500, errors),
      order_no: readInteger(body, 'order_no', errors, { min: 0, max: 9999 }),
      status: readStatus(body, errors),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.supervision.updateZone(zoneId, changes, originOf(request, currentUser));
  }

  @Get('rule-items')
  @RequirePermission(PERMISSION_CODES.supervisionRecord, PERMISSION_CODES.supervisionManage)
  ruleItems(@Query('school_level') level?: string) {
    const errors: FieldError[] = [];
    const parsed = readLevel({ school_level: level }, 'school_level', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.supervision.ruleItems(parsed);
  }

  @Post('rule-items')
  @RequirePermission(PERMISSION_CODES.supervisionManage)
  createRuleItem(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const level = readLevel(body, 'school_level', errors);
    const kind = readChoice(body, 'kind', KINDS, KIND_MESSAGE, errors);
    if (!level) {
      errors.push({ field: 'school_level', message: 'Bắt buộc chọn cấp' });
    }
    if (!kind) {
      errors.push({ field: 'kind', message: KIND_MESSAGE });
    }
    const input: RuleItemInput = {
      code: readRequiredText(body, 'code', errors),
      name: readRequiredText(body, 'name', errors),
      kind: kind ?? 'violation',
      school_level: level ?? 'TH',
      parent_notice: readChoice(body, 'parent_notice', NOTICES, NOTICE_MESSAGE, errors) ?? 'daily_digest',
      class_criterion_id: readOptionalUuid(body, 'class_criterion_id', errors) ?? null,
      order_no: readInteger(body, 'order_no', errors, { min: 0, max: 9999 }) ?? 0,
    };
    if (input.code.length > 30) {
      errors.push({ field: 'code', message: 'Tối đa 30 ký tự' });
    }
    if (input.name.length > 200) {
      errors.push({ field: 'name', message: 'Tối đa 200 ký tự' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.supervision.createRuleItem(input, originOf(request, currentUser));
  }

  @Post('rule-items/defaults')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.supervisionManage)
  loadDefaults(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const level = readLevel(body, 'school_level', errors);
    if (!level && errors.length === 0) {
      errors.push({ field: 'school_level', message: 'Bắt buộc chọn cấp' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.supervision.loadDefaultRuleItems(level ?? 'TH', originOf(request, currentUser));
  }

  @Patch('rule-items/:id')
  @RequirePermission(PERMISSION_CODES.supervisionManage)
  updateRuleItem(
    @Param('id', uuidParameter('Mã mục nội quy không hợp lệ')) itemId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    for (const field of ['code', 'kind', 'school_level']) {
      if (body?.[field] !== undefined) {
        errors.push({ field, message: 'Mã, loại và cấp của mục nội quy không đổi được' });
      }
    }
    const name = body?.name === undefined ? undefined : readRequiredText(body, 'name', errors);
    if (name && name.length > 200) {
      errors.push({ field: 'name', message: 'Tối đa 200 ký tự' });
    }
    const changes = {
      name,
      parent_notice: readChoice(body, 'parent_notice', NOTICES, NOTICE_MESSAGE, errors),
      class_criterion_id: readOptionalUuid(body, 'class_criterion_id', errors),
      order_no: readInteger(body, 'order_no', errors, { min: 0, max: 9999 }),
      status: readStatus(body, errors),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.supervision.updateRuleItem(itemId, changes, originOf(request, currentUser));
  }

  @Get('staff-options')
  @RequirePermission(PERMISSION_CODES.supervisionManage)
  staffOptions(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.supervision.staffOptions(currentUser);
  }

  @Get('assignments')
  @RequirePermission(PERMISSION_CODES.supervisionManage)
  assignments(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    if (query.staff_id && !isUuid(query.staff_id)) {
      errors.push({ field: 'staff_id', message: 'Mã nhân sự không hợp lệ' });
    }
    const level = readLevel(query, 'school_level', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.supervision.assignments(currentUser, { staffId: query.staff_id || null, level: level ?? null });
  }

  @Post('assignments')
  @RequirePermission(PERMISSION_CODES.supervisionManage)
  createAssignment(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const level = readLevel(body, 'school_level', errors);
    if (!level && !errors.some((error) => error.field === 'school_level')) {
      errors.push({ field: 'school_level', message: 'Bắt buộc chọn cấp' });
    }
    const weekdays = readWeekdays(body, errors);
    if (weekdays === undefined && body?.weekdays === undefined) {
      errors.push({ field: 'weekdays', message: 'Chọn ít nhất một thứ trong tuần' });
    }
    const startTime = readTime(body, 'start_time', errors);
    const endTime = readTime(body, 'end_time', errors);
    for (const [field, value] of [
      ['start_time', body?.start_time],
      ['end_time', body?.end_time],
    ] as const) {
      if (value === undefined) {
        errors.push({ field, message: 'Bắt buộc nhập' });
      }
    }
    if (startTime && endTime && startTime >= endTime) {
      errors.push({ field: 'end_time', message: 'Giờ kết thúc phải sau giờ bắt đầu' });
    }
    const input: AssignmentInput = {
      staff_id: readRequiredUuid(body, 'staff_id', errors, 'Bắt buộc chọn nhân sự'),
      school_level: level ?? 'TH',
      grade_levels: readTextList(body, 'grade_levels', errors) ?? [],
      zone_ids: readUuidList(body, 'zone_ids', errors) ?? [],
      weekdays: weekdays ?? [],
      start_time: startTime ?? '',
      end_time: endTime ?? '',
      from_date: readOptionalDate(body, 'from_date', errors) ?? null,
      to_date: readOptionalDate(body, 'to_date', errors) ?? null,
      note: readShortText(body, 'note', 500, errors) ?? null,
    };
    if (input.from_date && input.to_date && input.from_date > input.to_date) {
      errors.push({ field: 'to_date', message: 'Ngày kết thúc không trước ngày bắt đầu' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.supervision.createAssignment(currentUser, input, originOf(request, currentUser));
  }

  @Patch('assignments/:id')
  @RequirePermission(PERMISSION_CODES.supervisionManage)
  updateAssignment(
    @Param('id', uuidParameter('Mã phân công không hợp lệ')) assignmentId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    if (body?.staff_id !== undefined) {
      errors.push({
        field: 'staff_id',
        message: 'Không đổi nhân sự của phân công; ngừng phân công này và tạo phân công mới',
      });
    }
    const changes = {
      school_level: readLevel(body, 'school_level', errors),
      grade_levels: readTextList(body, 'grade_levels', errors),
      zone_ids: readUuidList(body, 'zone_ids', errors),
      weekdays: readWeekdays(body, errors),
      start_time: readTime(body, 'start_time', errors),
      end_time: readTime(body, 'end_time', errors),
      from_date: readOptionalDate(body, 'from_date', errors),
      to_date: readOptionalDate(body, 'to_date', errors),
      note: readShortText(body, 'note', 500, errors),
      status: readStatus(body, errors),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.supervision.updateAssignment(currentUser, assignmentId, changes, originOf(request, currentUser));
  }

  // Tra người đang trực một khu vực ở một thời điểm (mặc định là bây giờ); để Ban giám hiệu kiểm tra lịch trực và để phiên camera
  // kiểm thử cùng một hàm dùng khi gửi cảnh báo
  @Get('on-duty')
  @RequirePermission(PERMISSION_CODES.supervisionManage)
  onDuty(@Query() query: Record<string, string | undefined>) {
    const errors: FieldError[] = [];
    if (!query.zone_id || !isUuid(query.zone_id)) {
      errors.push({ field: 'zone_id', message: 'Bắt buộc chọn khu vực' });
    }
    const at = query.at ? new Date(query.at) : undefined;
    if (at && Number.isNaN(at.getTime())) {
      errors.push({ field: 'at', message: 'Thời điểm theo dạng ISO 8601' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.supervision.findOnDutySupervisors(query.zone_id ?? '', at);
  }
}
