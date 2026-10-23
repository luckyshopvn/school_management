import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { ConductCriterionKind } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES, type SchoolLevelCode } from '@school-management/shared';
import type { Request } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { readSchoolLevel } from '../catalogs/school-level-fields.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import {
  conflictOnDuplicate,
  isUuid,
  notFoundError,
  readInteger,
  readOptionalText,
  readRequiredText,
  readRequiredUuid,
  readStatus,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { conductPeriod, DEFAULT_CONDUCT_CRITERIA, rankClasses } from './conduct-calc.js';

// Nề nếp và thi đua lớp (DT-20 phần 20b, YCTD-159; tài liệu 32 mục 11.4), tuỳ trường: Ban Giám hiệu bật ở 1.4 Cấu hình trường,
// đặt điểm nền mỗi tuần, khai báo tiêu chí cộng hoặc trừ điểm (nạp bộ mặc định của Tiểu học được). Giáo viên trực tuần ghi
// điểm theo lớp và ngày, ghi thay đội cờ đỏ (học sinh không có tài khoản) ở ô "Người báo". Tổng hợp, xếp hạng theo tuần, tháng,
// học kỳ tính khi xem. Chưa bật thì chỉ đọc, sửa được cấu hình. Không dùng bảng thi đua cán bộ của 22d
export const CONDUCT_RULE_CODE = 'YCTD-159';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CRITERION_COLUMNS = ['id', 'code', 'name', 'kind', 'points', 'school_level', 'order_no', 'status'] as const;
const KINDS: ConductCriterionKind[] = ['plus', 'minus'];

function readDate(value: unknown, field: string, errors: FieldError[]): string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    errors.push({ field, message: 'Ngày theo dạng YYYY-MM-DD' });
    return '';
  }
  return value;
}

interface CriterionInput {
  code: string;
  name: string;
  kind: ConductCriterionKind;
  points: number;
  school_level: SchoolLevelCode;
  order_no: number;
}

@Injectable()
export class ConductService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly databases: Databases,
    private readonly organizationScopes: OrganizationScopes,
    private readonly clock: Clock,
  ) {}

  async settings() {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return { enabled: false, base_points: 100, updated_by_name: null, updated_at: null };
    }
    const row = await current.database
      .selectFrom('conduct_settings')
      .select(['enabled', 'base_points', 'updated_by_name', 'updated_at'])
      .executeTakeFirst();
    return row ?? { enabled: false, base_points: 100, updated_by_name: null, updated_at: null };
  }

  async saveSettings(currentUser: CurrentUser, input: { enabled: boolean; basePoints: number }, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const before = await this.settings();
    await database.transaction().execute(async (transaction) => {
      await transaction
        .insertInto('conduct_settings')
        .values({
          id: 1,
          enabled: input.enabled,
          base_points: input.basePoints,
          updated_by_name: currentUser.description.full_name,
          updated_at: this.clock.now(),
        })
        .onConflict((conflict) =>
          conflict.column('id').doUpdateSet({
            enabled: input.enabled,
            base_points: input.basePoints,
            updated_by_name: currentUser.description.full_name,
            updated_at: this.clock.now(),
          }),
        )
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'conduct_settings',
        entityId: '00000000-0000-0000-0000-000000000001',
        action: 'update',
        before,
        after: { enabled: input.enabled, base_points: input.basePoints },
      });
    });
    return this.settings();
  }

  private async assertEnabled(): Promise<void> {
    if (!(await this.settings()).enabled) {
      throw ruleViolationError(CONDUCT_RULE_CODE, 'Trường chưa bật nề nếp, thi đua lớp ở Cấu hình trường');
    }
  }

  async criteria(level?: SchoolLevelCode) {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return [];
    }
    return current.database
      .selectFrom('conduct_criteria')
      .select(CRITERION_COLUMNS)
      .$if(level !== undefined, (query) => query.where('school_level', '=', level ?? 'TH'))
      .orderBy('school_level')
      .orderBy('kind', 'desc')
      .orderBy('order_no')
      .orderBy('code')
      .execute();
  }

  async createCriterion(input: CriterionInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    return conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const created = await transaction
          .insertInto('conduct_criteria')
          .values(input)
          .returning(CRITERION_COLUMNS)
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: null,
          entityName: 'conduct_criteria',
          entityId: created.id,
          action: 'create',
          before: null,
          after: created,
        });
        return created;
      }),
      'Mã tiêu chí đã có',
      'code',
    );
  }

  async updateCriterion(
    criterionId: string,
    changes: Partial<Omit<CriterionInput, 'code' | 'kind'>> & { status?: 'active' | 'inactive' },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const existing = await database
      .selectFrom('conduct_criteria')
      .select(CRITERION_COLUMNS)
      .where('id', '=', criterionId)
      .executeTakeFirst();
    if (!existing) {
      throw notFoundError('Không tìm thấy tiêu chí', 'conduct_criterion');
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('conduct_criteria')
        .set({ ...changes, updated_at: this.clock.now() })
        .where('id', '=', criterionId)
        .returning(CRITERION_COLUMNS)
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'conduct_criteria',
        entityId: criterionId,
        action: 'update',
        before: existing,
        after: updated,
      });
      return updated;
    });
  }

  // Nạp bộ tiêu chí mặc định; mã đã có thì bỏ qua
  async loadDefaults(level: SchoolLevelCode, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const existing = new Set(
      (await database.selectFrom('conduct_criteria').select('code').execute()).map((row) => row.code),
    );
    const created: string[] = [];
    let order = 0;
    for (const item of DEFAULT_CONDUCT_CRITERIA) {
      order += 1;
      if (existing.has(item.code)) {
        continue;
      }
      await this.createCriterion({ ...item, school_level: level, order_no: order }, origin);
      created.push(item.code);
    }
    return {
      created,
      skipped: DEFAULT_CONDUCT_CRITERIA.map((item) => item.code).filter((code) => !created.includes(code)),
    };
  }

  private async findClass(classId: string) {
    const { database } = await this.currentSchoolYear.require();
    const row = await database
      .selectFrom('classes')
      .select(['id', 'name', 'org_unit_id', 'school_level', 'status'])
      .where('id', '=', classId)
      .executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy lớp', 'class');
    }
    return row;
  }

  async entries(currentUser: CurrentUser, filter: { classId: string | null; from: string; to: string }) {
    const { database } = await this.currentSchoolYear.require();
    const scope = await this.organizationScopes.resolve(currentUser, PERMISSION_CODES.conductRecord);
    return database
      .selectFrom('conduct_entries')
      .innerJoin('classes', 'classes.id', 'conduct_entries.class_id')
      .innerJoin('conduct_criteria', 'conduct_criteria.id', 'conduct_entries.criterion_id')
      .select([
        'conduct_entries.id',
        'conduct_entries.class_id',
        'classes.name as class_name',
        'conduct_entries.criterion_id',
        'conduct_criteria.name as criterion_name',
        'conduct_criteria.kind',
        'conduct_entries.entry_date',
        'conduct_entries.quantity',
        'conduct_entries.points',
        'conduct_entries.note',
        'conduct_entries.reported_by',
        'conduct_entries.recorded_by_name',
        'conduct_entries.created_at',
      ])
      .where('conduct_entries.entry_date', '>=', filter.from)
      .where('conduct_entries.entry_date', '<=', filter.to)
      .$if(filter.classId !== null, (query) => query.where('conduct_entries.class_id', '=', filter.classId ?? ''))
      .$if(!scope.wholeSchool, (query) => query.where('classes.org_unit_id', 'in', [...scope.orgUnitIds, '']))
      .orderBy('conduct_entries.entry_date', 'desc')
      .orderBy('classes.name')
      .orderBy('conduct_entries.created_at', 'desc')
      .execute();
  }

  async record(
    currentUser: CurrentUser,
    input: {
      classId: string;
      criterionId: string;
      date: string;
      quantity: number;
      note: string | null;
      reportedBy: string | null;
    },
    origin: ChangeOrigin,
  ) {
    await this.assertEnabled();
    const classRow = await this.findClass(input.classId);
    await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.conductRecord, classRow.org_unit_id);
    if (classRow.status !== 'active') {
      throw ruleViolationError(CONDUCT_RULE_CODE, 'Lớp đã đóng');
    }
    const { database } = await this.currentSchoolYear.require();
    const criterion = await database
      .selectFrom('conduct_criteria')
      .select(['id', 'kind', 'points', 'school_level', 'status'])
      .where('id', '=', input.criterionId)
      .executeTakeFirst();
    if (!criterion || criterion.status !== 'active') {
      throw validationError([{ field: 'criterion_id', message: 'Tiêu chí không có hoặc đã ngừng dùng' }]);
    }
    if (criterion.school_level !== classRow.school_level) {
      throw ruleViolationError(CONDUCT_RULE_CODE, 'Tiêu chí không cùng cấp với lớp', [
        { field: 'criterion_id', message: 'Chọn tiêu chí của cấp của lớp' },
      ]);
    }
    const points = (criterion.kind === 'plus' ? 1 : -1) * criterion.points * input.quantity;
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('conduct_entries')
        .values({
          class_id: input.classId,
          criterion_id: input.criterionId,
          entry_date: input.date,
          quantity: input.quantity,
          points,
          note: input.note,
          reported_by: input.reportedBy,
          recorded_by: currentUser.id,
          recorded_by_name: currentUser.description.full_name,
        })
        .returning(['id', 'class_id', 'criterion_id', 'entry_date', 'quantity', 'points', 'note', 'reported_by'])
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: classRow.org_unit_id,
        entityName: 'conduct_entries',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  // Người ghi xóa được dòng của mình trong ngày; người quản lý xóa được mọi dòng
  async remove(currentUser: CurrentUser, entryId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const entry = await database
      .selectFrom('conduct_entries')
      .innerJoin('classes', 'classes.id', 'conduct_entries.class_id')
      .selectAll('conduct_entries')
      .select('classes.org_unit_id')
      .where('conduct_entries.id', '=', entryId)
      .executeTakeFirst();
    if (!entry) {
      throw notFoundError('Không tìm thấy dòng nề nếp', 'conduct_entry');
    }
    const ownToday =
      entry.recorded_by === currentUser.id &&
      new Date(entry.created_at).toDateString() === this.clock.now().toDateString();
    if (!currentUser.hasPermission(PERMISSION_CODES.conductManage) && !ownToday) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ xóa được dòng mình ghi trong ngày');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('conduct_entries').where('id', '=', entryId).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: entry.org_unit_id,
        entityName: 'conduct_entries',
        entityId: entryId,
        action: 'delete',
        before: entry,
        after: null,
      });
    });
    return { id: entryId, deleted: true };
  }

  // Khoảng ngày của học kỳ theo lịch riêng của cấp nếu có, không thì lịch chung (19b)
  private async termRange(level: SchoolLevelCode, term: 'first_term' | 'second_term') {
    const { academicYearId } = await this.currentSchoolYear.require();
    const rows = await this.databases.system
      .selectFrom('academic_terms')
      .select(['school_level', 'start_date', 'end_date'])
      .where('academic_year_id', '=', academicYearId)
      .where('term_type', '=', term)
      .where((expression) =>
        expression.or([expression('school_level', 'is', null), expression('school_level', '=', level)]),
      )
      .execute();
    const row = rows.find((item) => item.school_level === level) ?? rows.find((item) => item.school_level === null);
    if (!row) {
      throw ruleViolationError(CONDUCT_RULE_CODE, 'Năm học chưa khai báo học kỳ này');
    }
    const text = (value: unknown) =>
      value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
    return { from: text(row.start_date), to: text(row.end_date) };
  }

  // Tổng hợp, xếp hạng lớp của cấp trong kỳ (tuần, tháng, học kỳ); lọc đơn vị, khối
  async ranking(
    currentUser: CurrentUser,
    filter: {
      period: 'week' | 'month' | 'first_term' | 'second_term';
      date: string;
      level: SchoolLevelCode;
      orgUnitId: string | null;
      gradeLevel: string | null;
    },
  ) {
    const { database } = await this.currentSchoolYear.require();
    const scope = await this.organizationScopes.resolve(currentUser, PERMISSION_CODES.conductRecord);
    if (filter.orgUnitId) {
      await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.conductRecord, filter.orgUnitId);
    }
    const period =
      filter.period === 'week' || filter.period === 'month'
        ? conductPeriod(filter.period, filter.date)
        : conductPeriod('range', filter.date, await this.termRange(filter.level, filter.period));
    const classes = await database
      .selectFrom('classes')
      .select(['id as class_id', 'name as class_name', 'grade_level'])
      .where('status', '=', 'active')
      .where('school_level', '=', filter.level)
      .$if(filter.orgUnitId !== null, (query) => query.where('org_unit_id', '=', filter.orgUnitId ?? ''))
      .$if(filter.orgUnitId === null && !scope.wholeSchool, (query) =>
        query.where('org_unit_id', 'in', [...scope.orgUnitIds, '']),
      )
      .$if(filter.gradeLevel !== null, (query) => query.where('grade_level', '=', filter.gradeLevel ?? ''))
      .execute();
    const entries =
      classes.length === 0
        ? []
        : await database
            .selectFrom('conduct_entries')
            .select(['class_id', 'entry_date', 'points'])
            .where(
              'class_id',
              'in',
              classes.map((row) => row.class_id),
            )
            .where('entry_date', '>=', period.from)
            .where('entry_date', '<=', period.to)
            .execute();
    const settings = await this.settings();
    return {
      period: filter.period,
      from: period.from,
      to: period.to,
      weeks: period.weeks.length,
      base_points: settings.base_points,
      enabled: settings.enabled,
      classes: rankClasses(classes, entries, period, settings.base_points),
    };
  }
}

function readKind(value: unknown, errors: FieldError[]): ConductCriterionKind {
  if (!KINDS.includes(value as ConductCriterionKind)) {
    errors.push({ field: 'kind', message: 'Loại là plus (cộng điểm) hoặc minus (trừ điểm)' });
    return 'plus';
  }
  return value as ConductCriterionKind;
}

@Controller('conduct')
export class ConductController {
  constructor(private readonly conduct: ConductService) {}

  @Get('settings')
  settings() {
    return this.conduct.settings();
  }

  @Put('settings')
  @RequirePermission(PERMISSION_CODES.conductManage)
  saveSettings(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    if (typeof body?.enabled !== 'boolean') {
      errors.push({ field: 'enabled', message: 'Phải là đúng hoặc sai' });
    }
    const basePoints = readInteger(body, 'base_points', errors, { min: 0, max: 1000 }) ?? 100;
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.conduct.saveSettings(
      currentUser,
      { enabled: body?.enabled === true, basePoints },
      originOf(request, currentUser),
    );
  }

  @Get('criteria')
  criteria(@Query('school_level') level?: string) {
    const errors: FieldError[] = [];
    const parsed = readSchoolLevel({ school_level: level }, 'school_level', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.conduct.criteria(parsed);
  }

  @Post('criteria')
  @RequirePermission(PERMISSION_CODES.conductManage)
  createCriterion(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input: CriterionInput = {
      code: readRequiredText(body, 'code', errors),
      name: readRequiredText(body, 'name', errors),
      kind: readKind(body?.kind, errors),
      points: readInteger(body, 'points', errors, { min: 1, max: 100 }) ?? 1,
      school_level: readSchoolLevel(body, 'school_level', errors) ?? 'TH',
      order_no: readInteger(body, 'order_no', errors, { min: 0, max: 9999 }) ?? 0,
    };
    if (body?.points === undefined) {
      errors.push({ field: 'points', message: 'Bắt buộc nhập' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.conduct.createCriterion(input, originOf(request, currentUser));
  }

  @Post('criteria/defaults')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.conductManage)
  loadDefaults(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const level = readSchoolLevel(body, 'school_level', errors) ?? 'TH';
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.conduct.loadDefaults(level, originOf(request, currentUser));
  }

  @Patch('criteria/:id')
  @RequirePermission(PERMISSION_CODES.conductManage)
  updateCriterion(
    @Param('id', uuidParameter('Mã tiêu chí không hợp lệ')) criterionId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    for (const field of ['code', 'kind']) {
      if (body?.[field] !== undefined) {
        errors.push({ field, message: 'Mã và loại của tiêu chí không đổi được' });
      }
    }
    const changes = {
      name: body?.name === undefined ? undefined : readRequiredText(body, 'name', errors),
      points: readInteger(body, 'points', errors, { min: 1, max: 100 }),
      order_no: readInteger(body, 'order_no', errors, { min: 0, max: 9999 }),
      status: readStatus(body, errors),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.conduct.updateCriterion(criterionId, changes, originOf(request, currentUser));
  }

  @Get('entries')
  @RequirePermission(PERMISSION_CODES.conductRecord)
  entries(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const from = readDate(query.from, 'from', errors);
    const to = readDate(query.to ?? query.from, 'to', errors);
    if (query.class_id !== undefined && query.class_id !== '' && !isUuid(query.class_id)) {
      errors.push({ field: 'class_id', message: 'Mã lớp không hợp lệ' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.conduct.entries(currentUser, { classId: query.class_id || null, from, to });
  }

  @Post('entries')
  @RequirePermission(PERMISSION_CODES.conductRecord)
  record(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      classId: readRequiredUuid(body, 'class_id', errors, 'Bắt buộc chọn lớp'),
      criterionId: readRequiredUuid(body, 'criterion_id', errors, 'Bắt buộc chọn tiêu chí'),
      date: readDate(body?.date, 'date', errors),
      quantity: readInteger(body, 'quantity', errors, { min: 1, max: 50 }) ?? 1,
      note: readOptionalText(body, 'note', errors) ?? null,
      reportedBy: readOptionalText(body, 'reported_by', errors) ?? null,
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.conduct.record(currentUser, input, originOf(request, currentUser));
  }

  @Delete('entries/:id')
  @RequirePermission(PERMISSION_CODES.conductRecord)
  remove(
    @Param('id', uuidParameter('Mã dòng không hợp lệ')) entryId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.conduct.remove(currentUser, entryId, originOf(request, currentUser));
  }

  @Get('ranking')
  @RequirePermission(PERMISSION_CODES.conductRecord)
  ranking(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const period = (query.period ?? 'week') as 'week' | 'month' | 'first_term' | 'second_term';
    if (!['week', 'month', 'first_term', 'second_term'].includes(period)) {
      errors.push({ field: 'period', message: 'Kỳ là week, month, first_term hoặc second_term' });
    }
    const date = readDate(query.date, 'date', errors);
    const level = readSchoolLevel(query, 'school_level', errors) ?? 'TH';
    if (query.org_unit_id && !isUuid(query.org_unit_id)) {
      errors.push({ field: 'org_unit_id', message: 'Mã không hợp lệ' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.conduct.ranking(currentUser, {
      period,
      date,
      level,
      orgUnitId: query.org_unit_id || null,
      gradeLevel: query.grade_level || null,
    });
  }
}
