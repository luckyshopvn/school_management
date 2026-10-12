import { Body, Controller, Delete, Get, HttpCode, Injectable, Param, Post, Query, Req } from '@nestjs/common';
import type { LostItemReportType, LostItemStatus, SchoolYearDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification, type NotificationRecipient } from '../common/notification-queue.js';
import { notFoundError, readOptionalUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { nextDocumentCode } from '../fees/document-codes.js';
import { guardianUserIds } from '../finance/receivables.js';
import { readHealthDate } from '../health/health-fields.js';
import { InteractionAccess, readChoice, readLimitedText } from './interaction-access.js';

// Đồ bị mất của trẻ (P02-11; BR-72, BR-75; YCTD-79). Phụ huynh báo mất đồ của con, giáo viên chủ nhiệm nhận thông báo;
// giáo viên ghi nhận đồ nhặt được của lớp; giáo viên chủ nhiệm hoặc quản lý đơn vị có quyền P02.lost-item.manage đánh dấu
// đã tìm thấy, đóng phiếu với kết quả đã trả hoặc không tìm thấy. Phiếu đang báo được hủy (chuyển trạng thái, không xóa
// cứng); phiếu đã đóng không xóa được. Mã phiếu DBM-000001 theo năm học
const REPORT_TYPES: LostItemReportType[] = ['lost', 'found'];
const STATUSES: LostItemStatus[] = ['reported', 'found', 'returned', 'not_found', 'cancelled'];
const CLOSED: LostItemStatus[] = ['returned', 'not_found'];

interface LostItemRow {
  id: string;
  code: string;
  org_unit_id: string;
  child_id: string | null;
  class_id: string | null;
  status: LostItemStatus;
  reported_by: string;
  description: string;
}

@Injectable()
export class LostItemsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: InteractionAccess,
    private readonly clock: Clock,
  ) {}

  private async canManage(
    database: Kysely<SchoolYearDatabase>,
    currentUser: CurrentUser,
    orgUnitId: string,
    classIds: Array<string | null>,
  ): Promise<boolean> {
    if (await this.access.canManageUnit(currentUser, PERMISSION_CODES.lostItemManage, orgUnitId)) {
      return true;
    }
    const teacherClasses = await this.access.teacherClassIds(database, currentUser, PERMISSION_CODES.lostItemManage);
    return classIds.some((classId) => classId !== null && teacherClasses.includes(classId));
  }

  private async childClassId(database: Kysely<SchoolYearDatabase>, childId: string | null) {
    return childId ? (await this.access.findChild(database, childId)).class_id : null;
  }

  private async findItem(database: Kysely<SchoolYearDatabase>, itemId: string): Promise<LostItemRow> {
    const item = await database
      .selectFrom('lost_items')
      .select(['id', 'code', 'org_unit_id', 'child_id', 'class_id', 'status', 'reported_by', 'description'])
      .where('id', '=', itemId)
      .executeTakeFirst();
    if (!item) {
      throw notFoundError('Không tìm thấy phiếu đồ bị mất', 'lost_item');
    }
    return item;
  }

  private async assertCanManageItem(database: Kysely<SchoolYearDatabase>, currentUser: CurrentUser, item: LostItemRow) {
    const classIds = [item.class_id, await this.childClassId(database, item.child_id)];
    if (!(await this.canManage(database, currentUser, item.org_unit_id, classIds))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xử lý phiếu đồ bị mất này');
    }
  }

  // BR-72: phụ huynh chỉ xem phiếu của con mình
  private async assertCanViewItem(database: Kysely<SchoolYearDatabase>, currentUser: CurrentUser, item: LostItemRow) {
    if (item.child_id && (await this.access.isGuardianOf(database, item.child_id, currentUser.id))) {
      return;
    }
    const classIds = [item.class_id, await this.childClassId(database, item.child_id)];
    if (!(await this.canManage(database, currentUser, item.org_unit_id, classIds))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem phiếu đồ bị mất này');
    }
  }

  async report(
    currentUser: CurrentUser,
    input: {
      report_type: LostItemReportType;
      child_id: string | null;
      class_id: string | null;
      description: string;
      noticed_on: string | undefined;
    },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const today = VIETNAM_DATE.format(this.clock.now());
    const noticedOn = input.noticed_on ?? today;
    if (noticedOn > today) {
      throw validationError([{ field: 'noticed_on', message: 'Ngày phát hiện không sau hôm nay' }]);
    }
    let orgUnitId: string;
    let classId: string | null;
    let childName: string | null = null;
    let reporterIsGuardian = false;
    if (input.child_id) {
      const child = await this.access.findChild(database, input.child_id);
      orgUnitId = child.org_unit_id;
      classId = child.class_id;
      childName = child.full_name;
      reporterIsGuardian = await this.access.isGuardianOf(database, child.id, currentUser.id);
    } else if (input.class_id) {
      const classRow = await database
        .selectFrom('classes')
        .select(['id', 'org_unit_id'])
        .where('id', '=', input.class_id)
        .executeTakeFirst();
      if (!classRow) {
        throw notFoundError('Không tìm thấy lớp', 'class');
      }
      orgUnitId = classRow.org_unit_id;
      classId = classRow.id;
    } else {
      throw validationError([{ field: 'child_id', message: 'Chọn trẻ hoặc lớp của đồ bị mất' }]);
    }
    if (input.report_type === 'lost' && !input.child_id) {
      throw validationError([{ field: 'child_id', message: 'Báo mất đồ cần chọn trẻ' }]);
    }
    // Phụ huynh chỉ báo mất đồ của con mình; ghi nhận đồ nhặt được là việc của giáo viên, quản lý
    const staffAllowed = await this.canManage(database, currentUser, orgUnitId, [classId]);
    if (input.report_type === 'found' ? !staffAllowed : !reporterIsGuardian && !staffAllowed) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền lập phiếu đồ bị mất cho trẻ này');
    }
    return database.transaction().execute(async (transaction) => {
      const code = await nextDocumentCode(transaction, 'lost_item', 'DBM');
      const now = this.clock.now();
      const created = await transaction
        .insertInto('lost_items')
        .values({
          code,
          org_unit_id: orgUnitId,
          child_id: input.child_id,
          class_id: classId,
          report_type: input.report_type,
          description: input.description,
          noticed_on: noticedOn,
          status: input.report_type === 'lost' ? 'reported' : 'found',
          reported_by: currentUser.id,
          reported_at: now,
          ...(input.report_type === 'found' ? { found_by: currentUser.id, found_at: now } : {}),
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      let recipients: NotificationRecipient[];
      if (reporterIsGuardian) {
        const homerooms = await this.access.homeroomUserIds(transaction, classId);
        recipients = homerooms.length
          ? homerooms.map((userId) => ({ userId, channel: 'in_app' as const }))
          : [{ roleCode: 'VT-03', orgUnitId, channel: 'in_app' }];
      } else {
        recipients = input.child_id
          ? (await guardianUserIds(transaction, input.child_id)).map((userId) => ({
              userId,
              channel: 'in_app' as const,
            }))
          : [];
      }
      await queueNotification(transaction, {
        orgUnitId,
        templateCode: input.report_type === 'lost' ? 'lost_item_reported' : 'lost_item_found',
        title:
          input.report_type === 'lost' ? `Phụ huynh báo mất đồ${childName ? ` của ${childName}` : ''}` : 'Đồ nhặt được',
        body: `${code}: ${input.description}`,
        targetType: 'lost_items',
        targetId: created.id,
        recipients,
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId,
        entityName: 'lost_items',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  async list(
    currentUser: CurrentUser,
    filter: { childId: string | null; classId: string | null; status: LostItemStatus | null },
  ) {
    const { database } = await this.currentSchoolYear.require();
    if (filter.childId) {
      const child = await this.access.findChild(database, filter.childId);
      if (
        !(await this.access.isGuardianOf(database, child.id, currentUser.id)) &&
        !(await this.canManage(database, currentUser, child.org_unit_id, [child.class_id]))
      ) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem phiếu đồ bị mất của trẻ này');
      }
    }
    const scope = await this.access.managerScope(currentUser, PERMISSION_CODES.lostItemManage);
    const teacherClasses = await this.access.teacherClassIds(database, currentUser, PERMISSION_CODES.lostItemManage);
    let query = database
      .selectFrom('lost_items')
      .leftJoin('children', 'children.id', 'lost_items.child_id')
      .leftJoin('classes', 'classes.id', 'lost_items.class_id')
      .select([
        'lost_items.id',
        'lost_items.code',
        'lost_items.org_unit_id',
        'lost_items.child_id',
        'children.full_name as child_name',
        'lost_items.class_id',
        'classes.name as class_name',
        'lost_items.report_type',
        'lost_items.description',
        'lost_items.noticed_on',
        'lost_items.status',
        'lost_items.reported_by',
        'lost_items.reported_at',
        'lost_items.found_at',
        'lost_items.found_note',
        'lost_items.closed_at',
        'lost_items.result_note',
      ])
      .orderBy('lost_items.reported_at', 'desc');
    if (!scope.wholeSchool) {
      query = query.where((expression) => {
        const conditions = [
          expression(
            'lost_items.child_id',
            'in',
            expression
              .selectFrom('child_guardians')
              .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
              .select('child_guardians.child_id')
              .where('guardians.user_id', '=', currentUser.id),
          ),
        ];
        if (scope.orgUnitIds.length) {
          conditions.push(expression('lost_items.org_unit_id', 'in', scope.orgUnitIds));
        }
        if (teacherClasses.length) {
          conditions.push(expression('lost_items.class_id', 'in', teacherClasses));
        }
        return expression.or(conditions);
      });
    }
    if (filter.childId) {
      query = query.where('lost_items.child_id', '=', filter.childId);
    }
    if (filter.classId) {
      query = query.where('lost_items.class_id', '=', filter.classId);
    }
    if (filter.status) {
      query = query.where('lost_items.status', '=', filter.status);
    }
    return query.execute();
  }

  async get(currentUser: CurrentUser, itemId: string) {
    const { database } = await this.currentSchoolYear.require();
    const item = await this.findItem(database, itemId);
    await this.assertCanViewItem(database, currentUser, item);
    return database.selectFrom('lost_items').selectAll().where('id', '=', itemId).executeTakeFirstOrThrow();
  }

  private async notifyGuardians(
    database: Kysely<SchoolYearDatabase>,
    item: LostItemRow,
    title: string,
    body: string,
    templateCode: string,
  ) {
    if (!item.child_id) {
      return;
    }
    const guardians = await guardianUserIds(database, item.child_id);
    await queueNotification(database, {
      orgUnitId: item.org_unit_id,
      templateCode,
      title,
      body,
      targetType: 'lost_items',
      targetId: item.id,
      recipients: guardians.map((userId) => ({ userId, channel: 'in_app' as const })),
    });
  }

  async markFound(currentUser: CurrentUser, itemId: string, note: string | null, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const item = await this.findItem(database, itemId);
    await this.assertCanManageItem(database, currentUser, item);
    if (item.status !== 'reported') {
      throw ruleViolationError('P02-11', 'Chỉ phiếu đang báo mới chuyển sang đã tìm thấy');
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('lost_items')
        .set({ status: 'found', found_by: currentUser.id, found_at: this.clock.now(), found_note: note })
        .where('id', '=', itemId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.notifyGuardians(
        transaction,
        item,
        'Đã tìm thấy đồ của con',
        `${item.code}: ${item.description}${note ? `. ${note}` : ''}`,
        'lost_item_found',
      );
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: item.org_unit_id,
        entityName: 'lost_items',
        entityId: itemId,
        action: 'update',
        before: { status: item.status },
        after: { status: 'found' },
      });
      return updated;
    });
  }

  async close(
    currentUser: CurrentUser,
    itemId: string,
    input: { result: 'returned' | 'not_found'; result_note: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const item = await this.findItem(database, itemId);
    await this.assertCanManageItem(database, currentUser, item);
    if (item.status !== 'reported' && item.status !== 'found') {
      throw ruleViolationError('P02-11', 'Phiếu đã đóng hoặc đã hủy');
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('lost_items')
        .set({
          status: input.result,
          closed_by: currentUser.id,
          closed_at: this.clock.now(),
          result_note: input.result_note,
        })
        .where('id', '=', itemId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.notifyGuardians(
        transaction,
        item,
        input.result === 'returned' ? 'Đã trả đồ cho con' : 'Không tìm thấy đồ của con',
        `${item.code}: ${item.description}${input.result_note ? `. ${input.result_note}` : ''}`,
        'lost_item_closed',
      );
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: item.org_unit_id,
        entityName: 'lost_items',
        entityId: itemId,
        action: 'update',
        before: { status: item.status },
        after: { status: input.result },
      });
      return updated;
    });
  }

  // BR-75: không xóa cứng; phiếu đang báo được người báo hoặc người xử lý hủy, phiếu đã đóng bị chặn
  async cancel(currentUser: CurrentUser, itemId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const item = await this.findItem(database, itemId);
    if (item.reported_by !== currentUser.id) {
      await this.assertCanManageItem(database, currentUser, item);
    }
    if (CLOSED.includes(item.status)) {
      throw ruleViolationError('BR-75', 'Phiếu đồ bị mất đã đóng, không xóa được');
    }
    if (item.status !== 'reported') {
      throw ruleViolationError(
        'P02-11',
        item.status === 'cancelled' ? 'Phiếu đã hủy' : 'Đồ đã được tìm thấy, đóng phiếu thay vì xóa',
      );
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('lost_items')
        .set({ status: 'cancelled', cancelled_by: currentUser.id, cancelled_at: this.clock.now() })
        .where('id', '=', itemId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: item.org_unit_id,
        entityName: 'lost_items',
        entityId: itemId,
        action: 'delete',
        before: { status: item.status },
        after: { status: 'cancelled' },
      });
      return updated;
    });
  }
}

@Controller()
export class LostItemsController {
  constructor(private readonly lostItems: LostItemsService) {}

  @Post('lost-items')
  @HttpCode(201)
  report(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      report_type: readChoice(body, 'report_type', errors, REPORT_TYPES, 'lost'),
      child_id: readOptionalUuid(body, 'child_id', errors) ?? null,
      class_id: readOptionalUuid(body, 'class_id', errors) ?? null,
      description: readLimitedText(body, 'description', errors, { required: true, maximum: 1000 }) ?? '',
      noticed_on: readHealthDate(body, 'noticed_on', errors, false),
    };
    if (errors.length) {
      throw validationError(errors);
    }
    return this.lostItems.report(currentUser, input, originOf(request, currentUser));
  }

  @Get('lost-items')
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const filter = {
      childId: readOptionalUuid(query, 'child_id', errors) ?? null,
      classId: readOptionalUuid(query, 'class_id', errors) ?? null,
      status: query.status === undefined ? null : readChoice(query, 'status', errors, STATUSES),
    };
    if (errors.length) {
      throw validationError(errors);
    }
    return this.lostItems.list(currentUser, filter);
  }

  @Get('lost-items/:id')
  get(
    @Param('id', uuidParameter('Mã phiếu không hợp lệ')) itemId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.lostItems.get(currentUser, itemId);
  }

  @Post('lost-items/:id/found')
  @HttpCode(200)
  markFound(
    @Param('id', uuidParameter('Mã phiếu không hợp lệ')) itemId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const note = readLimitedText(body, 'found_note', errors, { maximum: 1000 });
    if (errors.length) {
      throw validationError(errors);
    }
    return this.lostItems.markFound(currentUser, itemId, note, originOf(request, currentUser));
  }

  @Post('lost-items/:id/close')
  @HttpCode(200)
  close(
    @Param('id', uuidParameter('Mã phiếu không hợp lệ')) itemId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = {
      result: readChoice(body, 'result', errors, ['returned', 'not_found'] as const),
      result_note: readLimitedText(body, 'result_note', errors, { maximum: 1000 }),
    };
    if (errors.length) {
      throw validationError(errors);
    }
    return this.lostItems.close(currentUser, itemId, input, originOf(request, currentUser));
  }

  @Delete('lost-items/:id')
  @HttpCode(200)
  cancel(
    @Param('id', uuidParameter('Mã phiếu không hợp lệ')) itemId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.lostItems.cancel(currentUser, itemId, originOf(request, currentUser));
  }
}
