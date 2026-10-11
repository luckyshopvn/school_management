import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Put, Req } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  readBearerToken,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely, Transaction } from 'kysely';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import { IdentityClient } from '../authentication/identity-client.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification } from '../common/notification-queue.js';
import {
  notFoundError,
  readOptionalUuid,
  readRequiredText,
  readRequiredUuid,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { DebtsService } from '../fees/debts.service.js';
import { isGuardianOf } from '../finance/receivables.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { ChildScope } from './child-scope.js';

// Chuyển đơn vị (P02-07, LP-02), thôi học (P02-08, LP-03, BR-10, BR-24), đồng ý sử dụng hình ảnh (P02-09, BR-65) và cờ
// trẻ con nhân viên (BR-09) cho trẻ đã có hồ sơ; các điểm Claude tự chọn theo ủy quyền ghi ở YCTD-67
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PARENT_ROLE = 'VT-14';

function readDate(body: RequestBody, field: string, errors: FieldError[]): string | null {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string' || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    errors.push({ field, message: 'Ngày dạng YYYY-MM-DD' });
    return null;
  }
  return value;
}

@Injectable()
export class ChildLifecycleService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly identityClient: IdentityClient,
    private readonly debts: DebtsService,
    private readonly childScope: ChildScope,
    private readonly clock: Clock,
  ) {}

  // Trạng thái và lịch sử đồng ý hình ảnh: người xem được hồ sơ trẻ thì xem được (BR-65)
  async readConsent(currentUser: CurrentUser, childId: string) {
    const { database } = await this.currentSchoolYear.require();
    await this.findChild(database, childId);
    await this.childScope.assertCanRead(currentUser, database, childId);
    return this.consentView(database, childId);
  }

  private today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  // Chuyển trẻ sang lớp của đơn vị khác: còn công nợ thì chặn; người thực hiện phải có quyền ở cả hai đơn vị; tài khoản
  // phụ huynh được thêm vai trò phụ huynh ở đơn vị mới
  async transferUnit(
    currentUser: CurrentUser,
    accessToken: string,
    childId: string,
    input: { classId: string; effectiveDate: string | null; reason: string; confirmOverCapacity: boolean },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const child = await this.findChild(database, childId);
    await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.childApprove, child.org_unit_id);
    if (child.status !== 'active') {
      throw ruleViolationError('LP-02', 'Chỉ chuyển đơn vị được trẻ đang học');
    }
    const targetClass = await database
      .selectFrom('classes')
      .select(['id', 'org_unit_id', 'name', 'max_size', 'status'])
      .where('id', '=', input.classId)
      .executeTakeFirst();
    if (!targetClass || targetClass.status !== 'active') {
      throw validationError([{ field: 'class_id', message: 'Lớp không có hoặc đã đóng' }]);
    }
    if (targetClass.org_unit_id === child.org_unit_id) {
      throw validationError([{ field: 'class_id', message: 'Lớp cùng đơn vị, dùng chức năng chuyển lớp' }]);
    }
    await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.childApprove, targetClass.org_unit_id);
    const current = await database
      .selectFrom('class_enrollments')
      .select(['id', 'class_id', 'from_date'])
      .where('child_id', '=', childId)
      .where('is_current', '=', true)
      .executeTakeFirst();
    const effectiveDate = input.effectiveDate ?? this.today();
    if (effectiveDate > this.today() || (current && effectiveDate < current.from_date)) {
      throw validationError([
        { field: 'effective_date', message: 'Ngày hiệu lực không sau hôm nay và không trước ngày vào lớp hiện tại' },
      ]);
    }
    const debt = await this.debts.summaryOf(database, childId);
    if (debt.outstanding_amount > 0) {
      throw ruleViolationError('LP-02', 'Trẻ còn công nợ, cần tất toán trước khi chuyển đơn vị', [
        { field: 'outstanding_amount', message: String(debt.outstanding_amount) },
      ]);
    }
    const enrolled = await database
      .selectFrom('class_enrollments')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .where('class_id', '=', targetClass.id)
      .where('is_current', '=', true)
      .executeTakeFirstOrThrow();
    if (Number(enrolled.count) >= targetClass.max_size && !input.confirmOverCapacity) {
      throw ruleViolationError('BR-04', 'Lớp đã đủ sĩ số, xác nhận để tiếp tục', [
        { field: 'enrolled_count', message: enrolled.count },
        { field: 'max_size', message: String(targetClass.max_size) },
      ]);
    }
    const guardians = await database
      .selectFrom('child_guardians')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .select(['guardians.full_name', 'guardians.phone'])
      .where('child_guardians.child_id', '=', childId)
      .where('guardians.user_id', 'is not', null)
      .execute();
    for (const guardian of guardians) {
      if (guardian.phone) {
        await this.identityClient.ensureGuardianAccount(accessToken, {
          phone: guardian.phone,
          full_name: guardian.full_name,
          org_unit_id: targetClass.org_unit_id,
        });
      }
    }
    const homeroomTeachers = await database
      .selectFrom('class_staff_assignments')
      .select('staff_user_id')
      .where('class_id', '=', targetClass.id)
      .where('assignment_role', '=', 'homeroom')
      .where('status', '=', 'active')
      .execute();
    return database.transaction().execute(async (transaction) => {
      if (current) {
        await transaction
          .updateTable('class_enrollments')
          .set({ is_current: false, to_date: effectiveDate, updated_at: this.clock.now() })
          .where('id', '=', current.id)
          .execute();
      }
      await transaction
        .insertInto('class_enrollments')
        .values({
          child_id: childId,
          class_id: targetClass.id,
          from_date: effectiveDate,
          reason: `Chuyển đơn vị: ${input.reason}`,
          created_by: origin.actorUserId,
        })
        .execute();
      await transaction
        .updateTable('children')
        .set({ org_unit_id: targetClass.org_unit_id, updated_at: this.clock.now() })
        .where('id', '=', childId)
        .execute();
      const transfer = await transaction
        .insertInto('child_unit_transfers')
        .values({
          child_id: childId,
          from_org_unit_id: child.org_unit_id,
          to_org_unit_id: targetClass.org_unit_id,
          from_class_id: current?.class_id ?? null,
          to_class_id: targetClass.id,
          effective_date: effectiveDate,
          reason: input.reason,
          created_by: origin.actorUserId,
        })
        .returning(['id', 'from_org_unit_id', 'to_org_unit_id', 'from_class_id', 'to_class_id', 'effective_date'])
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: child.org_unit_id,
        entityName: 'children',
        entityId: childId,
        action: 'update',
        before: { org_unit_id: child.org_unit_id, class_id: current?.class_id ?? null },
        after: {
          org_unit_id: targetClass.org_unit_id,
          class_id: targetClass.id,
          effective_date: effectiveDate,
          reason: input.reason,
        },
      });
      await queueNotification(transaction, {
        orgUnitId: targetClass.org_unit_id,
        templateCode: 'child_transferred_in',
        title: 'Trẻ chuyển đến lớp',
        body: `${child.full_name} chuyển đến lớp ${targetClass.name} từ ngày ${effectiveDate}`,
        targetType: 'children',
        targetId: childId,
        recipients: homeroomTeachers.map((teacher) => ({ userId: teacher.staff_user_id, channel: 'in_app' as const })),
      });
      return { child_id: childId, ...transfer };
    });
  }

  // Thôi học: hồ sơ giữ nguyên, trạng thái thôi học, lớp hiện tại kết thúc ở ngày thôi học, đăng ký dịch vụ của các tháng
  // sau tháng thôi học bị hủy; học phí tháng thôi học tính theo ngày học đến ngày thôi học khi tính học phí kỳ đó (BR-23);
  // số dư có còn lại do Hiệu trưởng quyết định hoàn bằng phiếu chi hoàn tiền hoặc giữ để bù trừ (BR-24)
  async withdraw(
    currentUser: CurrentUser,
    childId: string,
    input: { leaveDate: string | null; reason: string },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const child = await this.findChild(database, childId);
    await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.childApprove, child.org_unit_id);
    if (child.status !== 'active' && child.status !== 'paused') {
      throw ruleViolationError('LP-03', 'Chỉ ghi nhận thôi học cho trẻ đang học hoặc tạm nghỉ');
    }
    const leaveDate = input.leaveDate ?? this.today();
    const current = await database
      .selectFrom('class_enrollments')
      .select(['id', 'class_id', 'from_date'])
      .where('child_id', '=', childId)
      .where('is_current', '=', true)
      .executeTakeFirst();
    const earliest = current?.from_date ?? child.enroll_date ?? leaveDate;
    if (leaveDate > this.today() || leaveDate < earliest) {
      throw validationError([
        { field: 'leave_date', message: 'Ngày thôi học không sau hôm nay và không trước ngày vào lớp hiện tại' },
      ]);
    }
    const [year, month] = leaveDate.split('-').map(Number) as [number, number];
    const homeroomTeachers = current
      ? await database
          .selectFrom('class_staff_assignments')
          .select('staff_user_id')
          .where('class_id', '=', current.class_id)
          .where('assignment_role', '=', 'homeroom')
          .where('status', '=', 'active')
          .execute()
      : [];
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('children')
        .set({ status: 'withdrawn', leave_date: leaveDate, leave_reason: input.reason, updated_at: this.clock.now() })
        .where('id', '=', childId)
        .execute();
      if (current) {
        await transaction
          .updateTable('class_enrollments')
          .set({ is_current: false, to_date: leaveDate, updated_at: this.clock.now() })
          .where('id', '=', current.id)
          .execute();
      }
      await transaction
        .updateTable('service_registrations')
        .set({ status: 'cancelled' })
        .where('child_id', '=', childId)
        .where((expression) =>
          expression.or([
            expression('period_year', '>', year),
            expression.and([expression('period_year', '=', year), expression('period_month', '>', month)]),
          ]),
        )
        .where('status', 'in', ['active', 'pending_late', 'pending_cancel'])
        .execute();
      await transaction
        .updateTable('summer_registrations')
        .set({ status: 'cancelled', cancelled_by: origin.actorUserId, cancelled_at: this.clock.now() })
        .where('child_id', '=', childId)
        .where((expression) =>
          expression.or([
            expression('period_year', '>', year),
            expression.and([expression('period_year', '=', year), expression('period_month', '>', month)]),
          ]),
        )
        .where('status', '=', 'active')
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: child.org_unit_id,
        entityName: 'children',
        entityId: childId,
        action: 'update',
        before: { status: child.status, class_id: current?.class_id ?? null },
        after: { status: 'withdrawn', leave_date: leaveDate, leave_reason: input.reason },
      });
      await queueNotification(transaction, {
        orgUnitId: child.org_unit_id,
        templateCode: 'child_withdrawn',
        title: 'Trẻ thôi học',
        body: `${child.full_name} thôi học từ sau ngày ${leaveDate}`,
        targetType: 'children',
        targetId: childId,
        recipients: [
          ...homeroomTeachers.map((teacher) => ({ userId: teacher.staff_user_id, channel: 'in_app' as const })),
          { roleCode: 'VT-04', orgUnitId: child.org_unit_id, channel: 'in_app' as const },
        ],
      });
    });
    const debt = await this.debts.summaryOf(database, childId);
    return {
      child_id: childId,
      status: 'withdrawn' as const,
      leave_date: leaveDate,
      leave_reason: input.reason,
      outstanding_amount: debt.outstanding_amount,
      credit_amount: debt.credit_amount,
    };
  }

  // Đồng ý hoặc rút đồng ý sử dụng hình ảnh: phụ huynh của trẻ làm trên ứng dụng; nhà trường ghi nhận giấy ký tay kèm bản
  // chụp; mỗi lần đều lưu lịch sử người, cách, thời điểm (BR-65)
  async photoConsent(
    currentUser: CurrentUser,
    childId: string,
    input: { action: 'grant' | 'withdraw'; fileId: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const child = await this.findChild(database, childId);
    const isParent =
      currentUser.description.assignments.some((assignment) => assignment.role_code === PARENT_ROLE) &&
      (await isGuardianOf(database, childId, currentUser.id));
    let method: 'app' | 'paper' = 'app';
    if (!isParent) {
      if (!currentUser.hasPermission(PERMISSION_CODES.childApprove)) {
        throw new ApplicationError(
          'ERR_FORBIDDEN',
          'Chỉ phụ huynh của trẻ hoặc quản lý đơn vị thay đổi được đồng ý hình ảnh',
        );
      }
      await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.childApprove, child.org_unit_id);
      method = 'paper';
      if (!input.fileId) {
        throw validationError([{ field: 'file_id', message: 'Ghi nhận bằng giấy ký tay cần tải bản chụp' }]);
      }
      const file = await database
        .selectFrom('files')
        .select(['purpose', 'org_unit_id'])
        .where('id', '=', input.fileId)
        .executeTakeFirst();
      if (!file || file.purpose !== 'photo_consent' || file.org_unit_id !== child.org_unit_id) {
        throw validationError([{ field: 'file_id', message: 'Tệp không có hoặc không đúng loại' }]);
      }
    }
    const state = input.action === 'grant' ? 'granted' : 'refused';
    const fileId = method === 'paper' ? input.fileId : null;
    const homeroomTeachers = await database
      .selectFrom('class_enrollments')
      .innerJoin('class_staff_assignments', 'class_staff_assignments.class_id', 'class_enrollments.class_id')
      .select('class_staff_assignments.staff_user_id')
      .where('class_enrollments.child_id', '=', childId)
      .where('class_enrollments.is_current', '=', true)
      .where('class_staff_assignments.status', '=', 'active')
      .execute();
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('children')
        .set({
          photo_consent: state,
          photo_consent_method: method,
          photo_consent_by: origin.actorUserId,
          photo_consent_at: this.clock.now(),
          ...(state === 'granted' ? { photo_consent_file_id: fileId } : {}),
          updated_at: this.clock.now(),
        })
        .where('id', '=', childId)
        .execute();
      await transaction
        .insertInto('photo_consent_histories')
        .values({ child_id: childId, action: state, method, file_id: fileId, actor_user_id: origin.actorUserId })
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: child.org_unit_id,
        entityName: 'children',
        entityId: childId,
        action: 'update',
        before: { photo_consent: child.photo_consent },
        after: { photo_consent: state, photo_consent_method: method, photo_consent_file_id: fileId },
      });
      if (state === 'refused') {
        await queueNotification(transaction, {
          orgUnitId: child.org_unit_id,
          templateCode: 'photo_consent_withdrawn',
          title: 'Phụ huynh không đồng ý sử dụng hình ảnh',
          body: `Không công bố hình ảnh có ${child.full_name}`,
          targetType: 'children',
          targetId: childId,
          recipients: [...new Set(homeroomTeachers.map((row) => row.staff_user_id))].map((userId) => ({
            userId,
            channel: 'in_app' as const,
          })),
        });
      }
    });
    return this.consentView(database, childId);
  }

  async consentView(database: Executor, childId: string) {
    const child = await database
      .selectFrom('children')
      .select(['photo_consent', 'photo_consent_method', 'photo_consent_at', 'photo_consent_file_id'])
      .where('id', '=', childId)
      .executeTakeFirstOrThrow();
    const history = await database
      .selectFrom('photo_consent_histories')
      .select(['action', 'method', 'file_id', 'actor_user_id', 'created_at'])
      .where('child_id', '=', childId)
      .orderBy('created_at', 'desc')
      .execute();
    return { child_id: childId, ...child, history };
  }

  // Gắn hoặc bỏ cờ trẻ con nhân viên cho trẻ đã có hồ sơ (BR-09): nhân sự liên quan phải là tài khoản nhân sự của đơn vị
  async staffChild(
    currentUser: CurrentUser,
    accessToken: string,
    childId: string,
    input: { isStaffChild: boolean; relatedStaffUserId: string | null; relatedStaffRoleCode: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const child = await this.findChild(database, childId);
    await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.childApprove, child.org_unit_id);
    let relatedName: string | null = null;
    if (input.isStaffChild) {
      if (!input.relatedStaffUserId || !input.relatedStaffRoleCode) {
        throw validationError([
          { field: 'related_staff_user_id', message: 'Trẻ con nhân viên cần chọn nhân sự liên quan' },
        ]);
      }
      const staff = (
        await this.identityClient.listStaff(accessToken, input.relatedStaffRoleCode, child.org_unit_id)
      ).find((entry) => entry.user_id === input.relatedStaffUserId);
      if (!staff) {
        throw validationError([{ field: 'related_staff_user_id', message: 'Không tìm thấy nhân sự ở đơn vị này' }]);
      }
      relatedName = staff.full_name;
    }
    const values = {
      is_staff_child: input.isStaffChild,
      related_staff_user_id: input.isStaffChild ? input.relatedStaffUserId : null,
      related_staff_name: relatedName,
    };
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('children')
        .set({ ...values, updated_at: this.clock.now() })
        .where('id', '=', childId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: child.org_unit_id,
        entityName: 'children',
        entityId: childId,
        action: 'update',
        before: {
          is_staff_child: child.is_staff_child,
          related_staff_user_id: child.related_staff_user_id,
        },
        after: values,
      });
    });
    return { child_id: childId, ...values };
  }

  private async findChild(database: Executor, childId: string) {
    const child = await database
      .selectFrom('children')
      .select([
        'id',
        'org_unit_id',
        'status',
        'full_name',
        'enroll_date',
        'photo_consent',
        'is_staff_child',
        'related_staff_user_id',
      ])
      .where('id', '=', childId)
      .executeTakeFirst();
    if (!child) {
      throw notFoundError('Hồ sơ không tồn tại hoặc đã bị xóa khỏi phạm vi của bạn', 'child');
    }
    return child;
  }
}

@Controller('children')
export class ChildLifecycleController {
  constructor(private readonly lifecycle: ChildLifecycleService) {}

  @Post(':id/transfer-unit')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.childApprove)
  transferUnit(
    @Param('id', uuidParameter('Mã trẻ không hợp lệ')) childId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const classId = readRequiredUuid(body, 'class_id', errors, 'Bắt buộc chọn lớp');
    const reason = readRequiredText(body, 'reason', errors);
    const effectiveDate = readDate(body, 'effective_date', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.lifecycle.transferUnit(
      currentUser,
      readBearerToken(request.header('authorization')),
      childId,
      {
        classId: classId ?? '',
        effectiveDate,
        reason: reason ?? '',
        confirmOverCapacity: body?.confirm_over_capacity === true,
      },
      originOf(request, currentUser),
    );
  }

  @Post(':id/withdraw')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.childApprove)
  withdraw(
    @Param('id', uuidParameter('Mã trẻ không hợp lệ')) childId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const reason = readRequiredText(body, 'reason', errors);
    const leaveDate = readDate(body, 'leave_date', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.lifecycle.withdraw(
      currentUser,
      childId,
      { leaveDate, reason: reason ?? '' },
      originOf(request, currentUser),
    );
  }

  @Get(':id/photo-consent')
  readConsent(
    @Param('id', uuidParameter('Mã trẻ không hợp lệ')) childId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.lifecycle.readConsent(currentUser, childId);
  }

  @Post(':id/photo-consent')
  @HttpCode(200)
  photoConsent(
    @Param('id', uuidParameter('Mã trẻ không hợp lệ')) childId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const action = body?.action;
    if (action !== 'grant' && action !== 'withdraw') {
      errors.push({ field: 'action', message: 'Là grant hoặc withdraw' });
    }
    const fileId = readOptionalUuid(body, 'file_id', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.lifecycle.photoConsent(
      currentUser,
      childId,
      { action: action as 'grant' | 'withdraw', fileId: fileId ?? null },
      originOf(request, currentUser),
    );
  }

  @Put(':id/staff-child')
  @RequirePermission(PERMISSION_CODES.childApprove)
  staffChild(
    @Param('id', uuidParameter('Mã trẻ không hợp lệ')) childId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    if (typeof body?.is_staff_child !== 'boolean') {
      errors.push({ field: 'is_staff_child', message: 'Phải là đúng hoặc sai' });
    }
    const relatedStaffUserId = readOptionalUuid(body, 'related_staff_user_id', errors);
    const roleCode = typeof body?.related_staff_role_code === 'string' ? body.related_staff_role_code : null;
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.lifecycle.staffChild(
      currentUser,
      readBearerToken(request.header('authorization')),
      childId,
      {
        isStaffChild: body?.is_staff_child === true,
        relatedStaffUserId: relatedStaffUserId ?? null,
        relatedStaffRoleCode: roleCode,
      },
      originOf(request, currentUser),
    );
  }
}
