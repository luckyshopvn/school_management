import { Body, Controller, Get, HttpCode, Injectable, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { ExtracurricularFeeType, SchoolYearDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely, Transaction } from 'kysely';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { isUuid, notFoundError, readRequiredUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { isGuardianOf } from '../finance/receivables.js';
import { ActivityAccess, check, covers, MAXIMUM_CONTENT, NO_ID, readDate, readText } from './activity-access.js';
import { chargeRegistration } from './extracurricular-fees.js';

// Hoạt động ngoại khóa và đăng ký (P14-10, P14-11; BR-19, BR-72, BR-85; YCTD-78). Quản lý đơn vị hoặc giáo viên lập hoạt
// động, chỉ tiêu, phí (miễn phí, theo hoạt động, theo tháng) rồi công bố; phụ huynh đăng ký cho con, nhà trường đăng ký
// thay. Đủ chỉ tiêu thì từ chối; phí vào khoản phải thu của trẻ; thôi tham gia giữa tháng không giảm phí tháng đó
const FEE_TYPES: ExtracurricularFeeType[] = ['free', 'per_activity', 'monthly'];
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

interface ActivityInput {
  name?: string;
  description?: string | null;
  start_date?: string;
  end_date?: string;
  grade_levels?: string[];
  quota?: number;
  fee_type?: ExtracurricularFeeType;
  fee_amount?: number;
}

@Injectable()
export class ExtracurricularService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: ActivityAccess,
    private readonly clock: Clock,
  ) {}

  private today() {
    return VIETNAM_DATE.format(this.clock.now());
  }

  async create(currentUser: CurrentUser, orgUnitId: string, input: Required<ActivityInput>, origin: ChangeOrigin) {
    await this.access.assertStaff(
      currentUser,
      PERMISSION_CODES.extracurricularManage,
      orgUnitId,
      'Bạn không có quyền lập hoạt động ngoại khóa của đơn vị này',
    );
    validateFee(input.fee_type, input.fee_amount);
    if (input.end_date < input.start_date) {
      throw validationError([{ field: 'end_date', message: 'Ngày kết thúc không trước ngày bắt đầu' }]);
    }
    const { database } = await this.currentSchoolYear.require();
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('extracurricular_activities')
        .values({
          ...input,
          grade_levels: JSON.stringify(input.grade_levels),
          org_unit_id: orgUnitId,
          created_by: currentUser.id,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId,
        entityName: 'extracurricular_activities',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return normalize(created);
    });
  }

  // Sửa khi nháp; đã công bố chỉ sửa tên, mô tả, ngày kết thúc và tăng chỉ tiêu; phí không đổi sau khi công bố
  async update(currentUser: CurrentUser, id: string, input: ActivityInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const existing = await this.findManaged(database, currentUser, id);
    if (existing.status === 'closed') {
      throw ruleViolationError('P14-10', 'Hoạt động ngoại khóa đã đóng');
    }
    if (existing.status === 'published') {
      if (input.fee_type !== undefined || input.fee_amount !== undefined || input.start_date !== undefined) {
        throw ruleViolationError('P14-10', 'Hoạt động đã công bố không đổi phí và ngày bắt đầu');
      }
      if (input.quota !== undefined && input.quota < (await this.activeCount(database, id))) {
        throw ruleViolationError('P14-10', 'Chỉ tiêu không nhỏ hơn số trẻ đã đăng ký');
      }
    }
    validateFee(input.fee_type ?? existing.fee_type, input.fee_amount ?? Number(existing.fee_amount));
    if ((input.end_date ?? existing.end_date) < (input.start_date ?? existing.start_date)) {
      throw validationError([{ field: 'end_date', message: 'Ngày kết thúc không trước ngày bắt đầu' }]);
    }
    const { grade_levels: gradeLevels, ...rest } = input;
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('extracurricular_activities')
        .set({
          ...rest,
          ...(gradeLevels !== undefined ? { grade_levels: JSON.stringify(gradeLevels) } : {}),
          updated_at: this.clock.now(),
        })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: existing.org_unit_id,
        entityName: 'extracurricular_activities',
        entityId: id,
        action: 'update',
        before: existing,
        after: updated,
      });
      return normalize(updated);
    });
  }

  async setStatus(currentUser: CurrentUser, id: string, status: 'published' | 'closed', origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const existing = await this.findManaged(database, currentUser, id);
    const allowed = status === 'published' ? existing.status === 'draft' : existing.status === 'published';
    if (!allowed) {
      throw ruleViolationError(
        'P14-10',
        status === 'published' ? 'Chỉ công bố hoạt động nháp' : 'Chỉ đóng hoạt động đã công bố',
      );
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('extracurricular_activities')
        .set({ status, updated_at: this.clock.now() })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: existing.org_unit_id,
        entityName: 'extracurricular_activities',
        entityId: id,
        action: 'update',
        before: { status: existing.status },
        after: { status },
      });
      return normalize(updated);
    });
  }

  // Nhân sự xem trong phạm vi; phụ huynh xem hoạt động đã công bố của đơn vị có con, kèm đăng ký của con mình
  async list(currentUser: CurrentUser, orgUnitId: string | null) {
    const { database } = await this.currentSchoolYear.require();
    const staffUnits = await this.viewUnits(currentUser);
    const children = await this.access.guardianChildren(database, currentUser);
    const childUnits = [...new Set(children.map((child) => child.org_unit_id))];
    let query = database
      .selectFrom('extracurricular_activities')
      .selectAll()
      .where((expression) =>
        expression.or([
          staffUnits.wholeSchool
            ? expression.lit(true)
            : expression('org_unit_id', 'in', staffUnits.orgUnitIds.length ? staffUnits.orgUnitIds : [NO_ID]),
          expression.and([
            expression('status', '=', 'published'),
            expression('org_unit_id', 'in', childUnits.length ? childUnits : [NO_ID]),
          ]),
        ]),
      );
    if (orgUnitId) {
      query = query.where('org_unit_id', '=', orgUnitId);
    }
    const rows = await query.orderBy('start_date', 'desc').execute();
    if (rows.length === 0) {
      return [];
    }
    const registrations = await database
      .selectFrom('extracurricular_registrations')
      .select(['id', 'activity_id', 'child_id', 'status', 'effective_from', 'effective_to'])
      .where(
        'activity_id',
        'in',
        rows.map((row) => row.id),
      )
      .execute();
    const childIds = children.map((child) => child.child_id);
    return rows.map((row) => {
      const active = registrations.filter(
        (registration) => registration.activity_id === row.id && registration.status === 'active',
      );
      return {
        ...normalize(row),
        registered_count: active.length,
        remaining: Math.max(row.quota - active.length, 0),
        can_manage: covers(staffUnits, row.org_unit_id),
        my_registrations: registrations.filter(
          (registration) => registration.activity_id === row.id && childIds.includes(registration.child_id),
        ),
      };
    });
  }

  async registrations(currentUser: CurrentUser, activityId: string) {
    const { database } = await this.currentSchoolYear.require();
    const activity = await this.findActivity(database, activityId);
    let query = database
      .selectFrom('extracurricular_registrations')
      .innerJoin('children', 'children.id', 'extracurricular_registrations.child_id')
      .selectAll('extracurricular_registrations')
      .select('children.full_name as child_name')
      .where('extracurricular_registrations.activity_id', '=', activityId);
    if (!covers(await this.viewUnits(currentUser), activity.org_unit_id)) {
      const childIds = (await this.access.guardianChildren(database, currentUser)).map((child) => child.child_id);
      if (childIds.length === 0) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem danh sách đăng ký');
      }
      query = query.where('extracurricular_registrations.child_id', 'in', childIds);
    }
    return query.orderBy('extracurricular_registrations.registered_at').execute();
  }

  // P14-11: kiểm tra chỉ tiêu trong giao dịch có khóa hoạt động để hai đăng ký đồng thời không vượt chỉ tiêu
  async register(currentUser: CurrentUser, activityId: string, childId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const activity = await this.findActivity(database, activityId);
    const child = await database
      .selectFrom('children')
      .leftJoin('class_enrollments', (join) =>
        join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
      )
      .leftJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select(['children.id', 'children.full_name', 'children.org_unit_id', 'children.status', 'classes.grade_level'])
      .where('children.id', '=', childId)
      .executeTakeFirst();
    if (!child) {
      throw notFoundError('Không tìm thấy trẻ', 'child');
    }
    await this.assertCanRegister(database, currentUser, child.id, child.org_unit_id);
    if (activity.status !== 'published') {
      throw ruleViolationError('P14-11', 'Hoạt động ngoại khóa chưa công bố hoặc đã đóng');
    }
    const today = this.today();
    if (activity.end_date < today) {
      throw ruleViolationError('P14-11', 'Hoạt động ngoại khóa đã kết thúc');
    }
    if (child.status !== 'active' || child.org_unit_id !== activity.org_unit_id) {
      throw ruleViolationError('P14-11', 'Chỉ đăng ký cho trẻ đang học trong đơn vị của hoạt động');
    }
    const gradeLevels = activity.grade_levels as string[];
    if (gradeLevels.length > 0 && !gradeLevels.includes(child.grade_level ?? '')) {
      throw ruleViolationError('P14-11', 'Hoạt động không dành cho bậc học của trẻ');
    }
    const effectiveFrom = activity.start_date > today ? activity.start_date : today;
    const now = this.clock.now();
    return database.transaction().execute(async (transaction) => {
      await transaction
        .selectFrom('extracurricular_activities')
        .select('id')
        .where('id', '=', activityId)
        .forUpdate()
        .executeTakeFirstOrThrow();
      const existing = await transaction
        .selectFrom('extracurricular_registrations')
        .select('id')
        .where('activity_id', '=', activityId)
        .where('child_id', '=', childId)
        .where('status', '=', 'active')
        .executeTakeFirst();
      if (existing) {
        throw new ApplicationError('ERR_CONFLICT', 'Trẻ đã đăng ký hoạt động này');
      }
      if ((await this.activeCount(transaction, activityId)) >= activity.quota) {
        throw ruleViolationError('P14-11', 'Hoạt động ngoại khóa đã đủ chỉ tiêu, hết chỗ');
      }
      const created = await transaction
        .insertInto('extracurricular_registrations')
        .values({
          activity_id: activityId,
          child_id: childId,
          org_unit_id: activity.org_unit_id,
          registered_by: currentUser.id,
          effective_from: effectiveFrom,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      const charge =
        activity.fee_type === 'free'
          ? null
          : await chargeRegistration(
              transaction,
              {
                registrationId: created.id,
                childId,
                childName: child.full_name,
                orgUnitId: activity.org_unit_id,
                activityName: activity.name,
                monthly: activity.fee_type === 'monthly',
                amount: Number(activity.fee_amount),
                effectiveFrom,
                today,
                now,
              },
              origin,
            );
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: activity.org_unit_id,
        entityName: 'extracurricular_registrations',
        entityId: created.id,
        action: 'create',
        before: null,
        after: { ...created, charge },
      });
      return { ...created, charge };
    });
  }

  // Thôi tham gia từ hôm nay: phí tháng hiện tại giữ nguyên, các kỳ sau không thu; phí theo hoạt động không hoàn
  async withdraw(currentUser: CurrentUser, registrationId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const registration = await database
      .selectFrom('extracurricular_registrations')
      .selectAll()
      .where('id', '=', registrationId)
      .executeTakeFirst();
    if (!registration) {
      throw notFoundError('Không tìm thấy đăng ký', 'extracurricular_registration');
    }
    await this.assertCanRegister(database, currentUser, registration.child_id, registration.org_unit_id);
    if (registration.status !== 'active') {
      throw new ApplicationError('ERR_CONFLICT', 'Đăng ký đã thôi');
    }
    const today = this.today();
    const effectiveTo = today < registration.effective_from ? registration.effective_from : today;
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('extracurricular_registrations')
        .set({
          status: 'withdrawn',
          effective_to: effectiveTo,
          withdrawn_by: currentUser.id,
          withdrawn_at: this.clock.now(),
        })
        .where('id', '=', registrationId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: registration.org_unit_id,
        entityName: 'extracurricular_registrations',
        entityId: registrationId,
        action: 'update',
        before: { status: 'active' },
        after: { status: 'withdrawn', effective_to: effectiveTo },
      });
      return updated;
    });
  }

  // Phụ huynh của trẻ, hoặc nhân sự có quyền ngoại khóa hay quyền đăng ký dịch vụ ở đơn vị của trẻ
  private async assertCanRegister(database: Executor, currentUser: CurrentUser, childId: string, orgUnitId: string) {
    if (
      (await this.access.canStaff(currentUser, PERMISSION_CODES.extracurricularManage, orgUnitId)) ||
      (await this.access.canStaff(currentUser, PERMISSION_CODES.registrationManage, orgUnitId))
    ) {
      return;
    }
    if (!(await isGuardianOf(database, childId, currentUser.id))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ phụ huynh của trẻ hoặc nhà trường đăng ký được');
    }
  }

  private async viewUnits(currentUser: CurrentUser) {
    const units = new Set<string>();
    for (const permission of [
      PERMISSION_CODES.extracurricularManage,
      PERMISSION_CODES.registrationManage,
      PERMISSION_CODES.feeCalculationManage,
    ]) {
      const scope = await this.access.staffScope(currentUser, permission);
      if (scope.wholeSchool) {
        return { wholeSchool: true, orgUnitIds: [] };
      }
      scope.orgUnitIds.forEach((id) => units.add(id));
    }
    return { wholeSchool: false, orgUnitIds: [...units] };
  }

  private async activeCount(database: Executor, activityId: string): Promise<number> {
    const row = await database
      .selectFrom('extracurricular_registrations')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .where('activity_id', '=', activityId)
      .where('status', '=', 'active')
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }

  private async findActivity(database: Executor, id: string) {
    const activity = await database
      .selectFrom('extracurricular_activities')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!activity) {
      throw notFoundError('Không tìm thấy hoạt động ngoại khóa', 'extracurricular_activity');
    }
    return activity;
  }

  private async findManaged(database: Executor, currentUser: CurrentUser, id: string) {
    const activity = await this.findActivity(database, id);
    await this.access.assertStaff(
      currentUser,
      PERMISSION_CODES.extracurricularManage,
      activity.org_unit_id,
      'Bạn không có quyền quản lý hoạt động ngoại khóa này',
    );
    return activity;
  }
}

function validateFee(feeType: ExtracurricularFeeType, amount: number) {
  if (feeType === 'free' ? amount !== 0 : amount <= 0) {
    throw validationError([
      {
        field: 'fee_amount',
        message: feeType === 'free' ? 'Hoạt động miễn phí có mức phí 0' : 'Mức phí phải lớn hơn 0',
      },
    ]);
  }
}

function normalize<Row extends { fee_amount: string | number }>(row: Row) {
  return { ...row, fee_amount: Number(row.fee_amount) };
}

function readActivityInput(body: RequestBody, errors: FieldError[], creating: boolean): ActivityInput {
  const input: ActivityInput = {};
  const name = readText(body, 'name', errors, { required: creating });
  if (name) {
    input.name = name;
  }
  const description = readText(body, 'description', errors, { maximum: MAXIMUM_CONTENT });
  if (description !== undefined) {
    input.description = description;
  }
  const start = readDate(body, 'start_date', errors, creating);
  if (start) {
    input.start_date = start;
  }
  const end = readDate(body, 'end_date', errors, creating);
  if (end) {
    input.end_date = end;
  }
  if (body?.grade_levels !== undefined) {
    if (!Array.isArray(body.grade_levels) || body.grade_levels.some((value) => typeof value !== 'string')) {
      errors.push({ field: 'grade_levels', message: 'Danh sách mã bậc học' });
    } else {
      input.grade_levels = body.grade_levels as string[];
    }
  } else if (creating) {
    input.grade_levels = [];
  }
  const quota = body?.quota;
  if (quota !== undefined || creating) {
    if (typeof quota !== 'number' || !Number.isInteger(quota) || quota < 1 || quota > 10000) {
      errors.push({ field: 'quota', message: 'Chỉ tiêu là số nguyên từ 1 đến 10000' });
    } else {
      input.quota = quota;
    }
  }
  const feeType = body?.fee_type;
  if (feeType !== undefined || creating) {
    if (!FEE_TYPES.includes(feeType as ExtracurricularFeeType)) {
      errors.push({ field: 'fee_type', message: 'Cách thu là free, per_activity hoặc monthly' });
    } else {
      input.fee_type = feeType as ExtracurricularFeeType;
    }
  }
  const amount = body?.fee_amount;
  if (amount !== undefined) {
    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 0 || amount > 1_000_000_000) {
      errors.push({ field: 'fee_amount', message: 'Mức phí là số nguyên đồng không âm' });
    } else {
      input.fee_amount = amount;
    }
  } else if (creating) {
    input.fee_amount = 0;
  }
  return input;
}

@Controller()
export class ExtracurricularController {
  constructor(private readonly extracurricular: ExtracurricularService) {}

  @Get('extracurricular-activities')
  list(@Query('org_unit_id') orgUnitId: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    if (orgUnitId !== undefined && !isUuid(orgUnitId)) {
      throw validationError([{ field: 'org_unit_id', message: 'Mã không hợp lệ' }]);
    }
    return this.extracurricular.list(currentUser, orgUnitId ?? null);
  }

  @Post('extracurricular-activities')
  @HttpCode(201)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const orgUnitId = readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị');
    const input = readActivityInput(body, errors, true);
    check(errors);
    return this.extracurricular.create(
      currentUser,
      orgUnitId,
      { description: null, ...input } as Required<ActivityInput>,
      originOf(request, currentUser),
    );
  }

  @Patch('extracurricular-activities/:id')
  update(
    @Param('id', uuidParameter('Mã hoạt động không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = readActivityInput(body, errors, false);
    check(errors);
    return this.extracurricular.update(currentUser, id, input, originOf(request, currentUser));
  }

  @Post('extracurricular-activities/:id/publish')
  @HttpCode(200)
  publish(
    @Param('id', uuidParameter('Mã hoạt động không hợp lệ')) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.extracurricular.setStatus(currentUser, id, 'published', originOf(request, currentUser));
  }

  @Post('extracurricular-activities/:id/close')
  @HttpCode(200)
  close(
    @Param('id', uuidParameter('Mã hoạt động không hợp lệ')) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.extracurricular.setStatus(currentUser, id, 'closed', originOf(request, currentUser));
  }

  @Get('extracurricular-activities/:id/registrations')
  registrations(
    @Param('id', uuidParameter('Mã hoạt động không hợp lệ')) id: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.extracurricular.registrations(currentUser, id);
  }

  @Post('extracurricular-activities/:id/registrations')
  @HttpCode(201)
  register(
    @Param('id', uuidParameter('Mã hoạt động không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const childId = readRequiredUuid(body, 'child_id', errors, 'Bắt buộc chọn trẻ');
    check(errors);
    return this.extracurricular.register(currentUser, id, childId, originOf(request, currentUser));
  }

  @Post('extracurricular-registrations/:id/withdraw')
  @HttpCode(200)
  withdraw(
    @Param('id', uuidParameter('Mã đăng ký không hợp lệ')) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.extracurricular.withdraw(currentUser, id, originOf(request, currentUser));
  }
}
