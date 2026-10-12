import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Query, Req } from '@nestjs/common';
import type { MedicationRequestStatus, SchoolYearDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import type { Request } from 'express';
import { sql, type Kysely } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification } from '../common/notification-queue.js';
import { isUuid, notFoundError, readRequiredUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { guardianUserIds, isGuardianOf } from '../finance/receivables.js';
import { readHealthDate, readNote } from '../health/health-fields.js';
import { MedicationAccess } from './medication-access.js';

// Yêu cầu dặn thuốc, nhận thuốc và cho uống thuốc (P10-03, P10-04; BR-48, BR-49, BR-50, BR-86, BR-88; YCTD-75).
// Trạng thái: Chờ nhận (pending) → Đang cho uống (administering) → Hoàn thành (completed), hoặc Từ chối (rejected).
// Phụ huynh gửi đủ tên thuốc, liều, giờ, thời gian dùng, dị ứng và ít nhất một ảnh thuốc; người nhận thuốc xác nhận nhận
// rồi mới ghi liều; mỗi liều theo ngày và giờ chỉ ghi một lần; bỏ liều phải có lý do và báo phụ huynh xác nhận đã biết
const STATUSES: MedicationRequestStatus[] = ['pending', 'administering', 'completed', 'rejected'];
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAXIMUM_TIMES = 6;
const MAXIMUM_PHOTOS = 5;
const MAXIMUM_DAYS = 30;
const DAY_MS = 86_400_000;

const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);

export interface MedicationRequestInput {
  child_id: string;
  medicine_name: string;
  dosage: string;
  times: string[];
  from_date: string;
  to_date: string;
  allergy_note: string;
  note: string | null;
  medicine_photo_ids: string[];
  prescription_photo_id: string | null;
}

export interface AdministrationInput {
  request_id: string;
  scheduled_date: string | undefined;
  scheduled_time: string;
  is_skipped: boolean;
  skip_reason: string | null;
  dose_note: string | null;
}

interface ListFilter {
  childId: string | null;
  status: MedicationRequestStatus | null;
  orgUnitId: string | null;
  classId: string | null;
}

@Injectable()
export class MedicationRequestsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: MedicationAccess,
    private readonly clock: Clock,
  ) {}

  private today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  // P10-03: phụ huynh gửi yêu cầu; chuyển cho y tế, hoặc giáo viên chủ nhiệm khi đơn vị bật không có nhân viên y tế
  async submit(currentUser: CurrentUser, input: MedicationRequestInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    if (!(await isGuardianOf(database, input.child_id, currentUser.id))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ phụ huynh của trẻ gửi được yêu cầu dặn thuốc');
    }
    const child = await this.access.findChild(database, input.child_id);
    const status = await database
      .selectFrom('children')
      .select('status')
      .where('id', '=', child.id)
      .executeTakeFirstOrThrow();
    if (status.status !== 'active') {
      throw ruleViolationError('P10-03', 'Trẻ không còn đang học, không gửi được yêu cầu dặn thuốc');
    }
    const errors: FieldError[] = [];
    if (input.from_date < this.today()) {
      errors.push({ field: 'from_date', message: 'Ngày bắt đầu không trước hôm nay' });
    }
    if (input.to_date < input.from_date) {
      errors.push({ field: 'to_date', message: 'Ngày kết thúc không trước ngày bắt đầu' });
    } else if (daysBetween(input.from_date, input.to_date) >= MAXIMUM_DAYS) {
      errors.push({ field: 'to_date', message: `Mỗi yêu cầu dùng thuốc tối đa ${MAXIMUM_DAYS} ngày` });
    }
    const fileIds = [
      ...input.medicine_photo_ids,
      ...(input.prescription_photo_id ? [input.prescription_photo_id] : []),
    ];
    const files = await database
      .selectFrom('files')
      .select(['id', 'purpose', 'org_unit_id', 'created_by'])
      .where('id', 'in', fileIds)
      .execute();
    const valid = (fileId: string, purpose: string) =>
      files.some(
        (file) =>
          file.id === fileId &&
          file.purpose === purpose &&
          file.created_by === currentUser.id &&
          file.org_unit_id === child.org_unit_id,
      );
    if (!input.medicine_photo_ids.every((fileId) => valid(fileId, 'medicine_photo'))) {
      errors.push({ field: 'medicine_photo_ids', message: 'Ảnh thuốc không hợp lệ, hãy tải lại ảnh thuốc' });
    }
    if (input.prescription_photo_id && !valid(input.prescription_photo_id, 'prescription')) {
      errors.push({ field: 'prescription_photo_id', message: 'Ảnh đơn thuốc không hợp lệ, hãy tải lại' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const assignedRole = (await this.access.noMedicalStaff(child.org_unit_id)) ? 'homeroom' : 'nurse';
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('medication_requests')
        .values({
          ...input,
          times: [...input.times].sort(),
          org_unit_id: child.org_unit_id,
          class_id: child.class_id,
          requested_by: currentUser.id,
          assigned_role: assignedRole,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      const homeroomUsers =
        assignedRole === 'homeroom' && child.class_id
          ? await transaction
              .selectFrom('class_staff_assignments')
              .select('staff_user_id')
              .where('class_id', '=', child.class_id)
              .where('assignment_role', '=', 'homeroom')
              .where('status', '=', 'active')
              .execute()
          : [];
      await queueNotification(transaction, {
        orgUnitId: child.org_unit_id,
        templateCode: 'medication_requested',
        title: 'Yêu cầu dặn thuốc mới',
        body: `Phụ huynh của ${child.full_name} dặn thuốc ${input.medicine_name}, ${input.dosage}, lúc ${created.times.join(', ')}`,
        targetType: 'medication_requests',
        targetId: created.id,
        recipients:
          assignedRole === 'homeroom'
            ? homeroomUsers.map((row) => ({ userId: row.staff_user_id, channel: 'in_app' as const }))
            : [{ roleCode: 'VT-09', orgUnitId: child.org_unit_id, channel: 'in_app' as const }],
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: child.org_unit_id,
        entityName: 'medication_requests',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  async list(currentUser: CurrentUser, filter: ListFilter) {
    const { database } = await this.currentSchoolYear.require();
    let query = this.requestQuery(database);
    if (filter.childId) {
      await this.access.assertCanRead(currentUser, database, filter.childId);
      query = query.where('medication_requests.child_id', '=', filter.childId);
    } else {
      const scope = await this.access.listScope(currentUser, database);
      if (!scope.wholeSchool) {
        const { orgUnitIds, homeroomClassIds, guardianChildIds } = scope;
        if (orgUnitIds.length + homeroomClassIds.length + guardianChildIds.length === 0) {
          return [];
        }
        query = query.where((expression) =>
          expression.or([
            ...(orgUnitIds.length > 0 ? [expression('medication_requests.org_unit_id', 'in', orgUnitIds)] : []),
            ...(homeroomClassIds.length > 0 ? [expression('class_enrollments.class_id', 'in', homeroomClassIds)] : []),
            ...(guardianChildIds.length > 0
              ? [expression('medication_requests.child_id', 'in', guardianChildIds)]
              : []),
          ]),
        );
      }
    }
    if (filter.status) {
      query = query.where('medication_requests.status', '=', filter.status);
    }
    if (filter.orgUnitId) {
      query = query.where('medication_requests.org_unit_id', '=', filter.orgUnitId);
    }
    if (filter.classId) {
      query = query.where('class_enrollments.class_id', '=', filter.classId);
    }
    const rows = await query.orderBy('medication_requests.created_at', 'desc').limit(200).execute();
    return this.withAdministrations(database, rows);
  }

  async read(currentUser: CurrentUser, requestId: string) {
    const { database } = await this.currentSchoolYear.require();
    const row = await this.requestQuery(database).where('medication_requests.id', '=', requestId).executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy yêu cầu dặn thuốc', 'medication_request');
    }
    await this.access.assertCanRead(currentUser, database, row.child_id);
    const [detailed] = await this.withAdministrations(database, [row]);
    return {
      ...detailed,
      can_administer: await this.access.canAdminister(currentUser, database, {
        org_unit_id: row.org_unit_id,
        class_id: row.current_class_id,
      }),
    };
  }

  // P10-04, BR-49: người nhận thuốc xác nhận đã nhận trước khi thuốc vào danh sách cần cho uống
  async receive(
    currentUser: CurrentUser,
    requestId: string,
    input: { received_quantity: string | null; received_note: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const request = await this.load(database, requestId);
    const child = await this.access.assertCanAdminister(currentUser, database, request.child_id);
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('medication_requests')
        .set({ ...input, status: 'administering', received_by: currentUser.id, received_at: this.clock.now() })
        .where('id', '=', requestId)
        .where('status', '=', 'pending')
        .returningAll()
        .executeTakeFirst();
      if (!updated) {
        throw ruleViolationError('BR-49', 'Yêu cầu dặn thuốc không ở trạng thái chờ nhận');
      }
      await this.notifyGuardians(transaction, child, requestId, {
        templateCode: 'medication_received',
        title: 'Nhà trường đã nhận thuốc',
        body: `Đã nhận thuốc ${request.medicine_name} của ${child.full_name}`,
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: child.org_unit_id,
        entityName: 'medication_requests',
        entityId: requestId,
        action: 'update',
        before: { status: 'pending' },
        after: { status: 'administering', ...input },
      });
      return updated;
    });
  }

  async reject(currentUser: CurrentUser, requestId: string, reason: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const request = await this.load(database, requestId);
    const child = await this.access.assertCanAdminister(currentUser, database, request.child_id);
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('medication_requests')
        .set({ status: 'rejected', reject_reason: reason, rejected_by: currentUser.id, rejected_at: this.clock.now() })
        .where('id', '=', requestId)
        .where('status', '=', 'pending')
        .returningAll()
        .executeTakeFirst();
      if (!updated) {
        throw ruleViolationError('P10-04', 'Chỉ từ chối được yêu cầu đang chờ nhận');
      }
      await this.notifyGuardians(transaction, child, requestId, {
        templateCode: 'medication_rejected',
        title: 'Nhà trường không nhận thuốc',
        body: `Không nhận thuốc ${request.medicine_name} của ${child.full_name}. Lý do: ${reason}`,
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: child.org_unit_id,
        entityName: 'medication_requests',
        entityId: requestId,
        action: 'update',
        before: { status: 'pending' },
        after: { status: 'rejected', reject_reason: reason },
      });
      return updated;
    });
  }

  // Kết thúc sớm (phụ huynh dặn ngừng thuốc); hết liều theo lịch thì hệ thống tự chuyển hoàn thành
  async complete(currentUser: CurrentUser, requestId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const request = await this.load(database, requestId);
    const child = await this.access.assertCanAdminister(currentUser, database, request.child_id);
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('medication_requests')
        .set({ status: 'completed', completed_at: this.clock.now() })
        .where('id', '=', requestId)
        .where('status', '=', 'administering')
        .returningAll()
        .executeTakeFirst();
      if (!updated) {
        throw ruleViolationError('P10-04', 'Chỉ hoàn thành được yêu cầu đang cho uống');
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: child.org_unit_id,
        entityName: 'medication_requests',
        entityId: requestId,
        action: 'update',
        before: { status: 'administering' },
        after: { status: 'completed' },
      });
      return updated;
    });
  }

  // BR-50: ghi một liều đã cho uống hoặc bỏ liều kèm lý do; mỗi ngày và giờ của yêu cầu chỉ một bản ghi
  async administer(currentUser: CurrentUser, input: AdministrationInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const request = await this.load(database, input.request_id);
    const child = await this.access.assertCanAdminister(currentUser, database, request.child_id);
    if (request.status === 'pending') {
      throw ruleViolationError('BR-49', 'Chưa xác nhận nhận thuốc nên chưa ghi được liều');
    }
    if (request.status !== 'administering') {
      throw ruleViolationError('P10-04', 'Yêu cầu dặn thuốc đã kết thúc, không ghi thêm liều');
    }
    const scheduledDate = input.scheduled_date ?? this.today();
    if (!request.times.includes(input.scheduled_time)) {
      throw validationError([
        { field: 'scheduled_time', message: `Giờ cho uống phải là một trong ${request.times.join(', ')}` },
      ]);
    }
    if (scheduledDate > this.today()) {
      throw validationError([{ field: 'scheduled_date', message: 'Không ghi liều cho ngày sau hôm nay' }]);
    }
    if (scheduledDate < request.from_date || scheduledDate > request.to_date) {
      throw ruleViolationError('P10-04', 'Ngày ghi liều nằm ngoài thời gian dùng thuốc của yêu cầu');
    }
    const existing = await this.findDose(database, request.id, scheduledDate, input.scheduled_time);
    if (existing) {
      throw this.duplicateDose(existing);
    }
    const created = await database
      .transaction()
      .execute(async (transaction) => {
        const row = await transaction
          .insertInto('medication_administrations')
          .values({
            request_id: request.id,
            scheduled_date: scheduledDate,
            scheduled_time: input.scheduled_time,
            administered_at: input.is_skipped ? null : this.clock.now(),
            administered_by: currentUser.id,
            dose_note: input.dose_note,
            is_skipped: input.is_skipped,
            skip_reason: input.is_skipped ? input.skip_reason : null,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
        if (input.is_skipped) {
          await this.notifyGuardians(transaction, child, row.id, {
            templateCode: 'medication_dose_skipped',
            title: 'Bỏ liều thuốc của con',
            body: `${child.full_name} bỏ liều ${request.medicine_name} lúc ${input.scheduled_time} ngày ${scheduledDate}. Lý do: ${input.skip_reason ?? ''}`,
            targetType: 'medication_administrations',
          });
        }
        const recorded = await transaction
          .selectFrom('medication_administrations')
          .select((expression) => expression.fn.countAll<string>().as('count'))
          .where('request_id', '=', request.id)
          .executeTakeFirstOrThrow();
        const totalDoses = (daysBetween(request.from_date, request.to_date) + 1) * request.times.length;
        if (Number(recorded.count) >= totalDoses) {
          await transaction
            .updateTable('medication_requests')
            .set({ status: 'completed', completed_at: this.clock.now() })
            .where('id', '=', request.id)
            .execute();
        }
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: child.org_unit_id,
          entityName: 'medication_administrations',
          entityId: row.id,
          action: 'create',
          before: null,
          after: row,
        });
        return row;
      })
      .catch(async (error: unknown) => {
        if ((error as { code?: string }).code === '23505') {
          const duplicate = await this.findDose(database, request.id, scheduledDate, input.scheduled_time);
          if (duplicate) {
            throw this.duplicateDose(duplicate);
          }
        }
        throw error;
      });
    return created;
  }

  // BR-88: phụ huynh xác nhận đã biết thông báo bỏ liều một lần; không nhắc lại
  async acknowledge(currentUser: CurrentUser, administrationId: string) {
    const { database } = await this.currentSchoolYear.require();
    const dose = await database
      .selectFrom('medication_administrations')
      .innerJoin('medication_requests', 'medication_requests.id', 'medication_administrations.request_id')
      .select([
        'medication_administrations.id',
        'medication_administrations.is_skipped',
        'medication_administrations.parent_acknowledged_at',
        'medication_requests.child_id',
      ])
      .where('medication_administrations.id', '=', administrationId)
      .executeTakeFirst();
    if (!dose) {
      throw notFoundError('Không tìm thấy liều thuốc', 'medication_administration');
    }
    if (!(await isGuardianOf(database, dose.child_id, currentUser.id))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ phụ huynh của trẻ xác nhận được');
    }
    if (!dose.is_skipped) {
      throw ruleViolationError('BR-88', 'Chỉ xác nhận đã biết với thông báo bỏ liều');
    }
    if (dose.parent_acknowledged_at) {
      return { id: dose.id, parent_acknowledged_at: dose.parent_acknowledged_at };
    }
    return database
      .updateTable('medication_administrations')
      .set({ parent_acknowledged_at: this.clock.now(), parent_acknowledged_by: currentUser.id })
      .where('id', '=', administrationId)
      .returning(['id', 'parent_acknowledged_at'])
      .executeTakeFirstOrThrow();
  }

  // Danh sách liều cần cho uống trong ngày theo giờ, của các yêu cầu đang cho uống trong phạm vi người xem
  async schedule(
    currentUser: CurrentUser,
    input: { date: string | undefined; orgUnitId: string | null; classId: string | null },
  ) {
    const { database } = await this.currentSchoolYear.require();
    const filter = { ...input, date: input.date ?? this.today() };
    const requests = (
      await this.list(currentUser, {
        childId: null,
        status: null,
        orgUnitId: filter.orgUnitId,
        classId: filter.classId,
      })
    ).filter(
      // Yêu cầu tự hoàn thành sau liều cuối vẫn hiện trong lịch của ngày để thấy liều đã ghi
      (request) =>
        (request.status === 'administering' || request.status === 'completed') &&
        request.from_date <= filter.date &&
        request.to_date >= filter.date,
    );
    const allowed = new Map<string, boolean>();
    const rows = [];
    for (const request of requests) {
      const key = `${request.org_unit_id}:${request.current_class_id ?? ''}`;
      if (!allowed.has(key)) {
        allowed.set(
          key,
          await this.access.canAdminister(currentUser, database, {
            org_unit_id: request.org_unit_id,
            class_id: request.current_class_id,
          }),
        );
      }
      for (const time of request.times) {
        rows.push({
          request_id: request.id,
          child_id: request.child_id,
          full_name: request.full_name,
          class_name: request.class_name,
          medicine_name: request.medicine_name,
          dosage: request.dosage,
          scheduled_date: filter.date,
          scheduled_time: time,
          administration:
            request.administrations.find(
              (dose) => dose.scheduled_date === filter.date && dose.scheduled_time === time,
            ) ?? null,
          can_administer: request.status === 'administering' && (allowed.get(key) ?? false),
        });
      }
    }
    return rows.sort(
      (left, right) =>
        left.scheduled_time.localeCompare(right.scheduled_time) || left.full_name.localeCompare(right.full_name),
    );
  }

  private requestQuery(database: Kysely<SchoolYearDatabase>) {
    return database
      .selectFrom('medication_requests')
      .innerJoin('children', 'children.id', 'medication_requests.child_id')
      .leftJoin('class_enrollments', (join) =>
        join
          .onRef('class_enrollments.child_id', '=', 'medication_requests.child_id')
          .on('class_enrollments.is_current', '=', true),
      )
      .leftJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select([
        'medication_requests.id',
        'medication_requests.child_id',
        'children.full_name',
        'medication_requests.org_unit_id',
        'class_enrollments.class_id as current_class_id',
        'classes.name as class_name',
        'medication_requests.medicine_name',
        'medication_requests.dosage',
        'medication_requests.times',
        'medication_requests.from_date',
        'medication_requests.to_date',
        'medication_requests.allergy_note',
        'medication_requests.note',
        'medication_requests.medicine_photo_ids',
        'medication_requests.prescription_photo_id',
        'medication_requests.assigned_role',
        'medication_requests.status',
        'medication_requests.received_quantity',
        'medication_requests.received_note',
        'medication_requests.received_at',
        'medication_requests.reject_reason',
        'medication_requests.rejected_at',
        'medication_requests.completed_at',
        'medication_requests.created_at',
      ]);
  }

  private async withAdministrations<Row extends { id: string }>(database: Kysely<SchoolYearDatabase>, rows: Row[]) {
    const doses =
      rows.length === 0
        ? []
        : await database
            .selectFrom('medication_administrations')
            .select([
              'id',
              'request_id',
              'scheduled_date',
              'scheduled_time',
              'administered_at',
              'administered_by',
              'dose_note',
              'is_skipped',
              'skip_reason',
              'parent_acknowledged_at',
            ])
            .where(
              'request_id',
              'in',
              rows.map((row) => row.id),
            )
            .orderBy('scheduled_date')
            .orderBy('scheduled_time')
            .execute();
    return rows.map((row) => ({
      ...row,
      administrations: doses.filter((dose) => dose.request_id === row.id),
    }));
  }

  private async load(database: Kysely<SchoolYearDatabase>, requestId: string) {
    const request = await database
      .selectFrom('medication_requests')
      .select(['id', 'child_id', 'medicine_name', 'times', 'from_date', 'to_date', 'status'])
      .where('id', '=', requestId)
      .executeTakeFirst();
    if (!request) {
      throw notFoundError('Không tìm thấy yêu cầu dặn thuốc', 'medication_request');
    }
    return request;
  }

  private findDose(database: Kysely<SchoolYearDatabase>, requestId: string, date: string, time: string) {
    return database
      .selectFrom('medication_administrations')
      .select(['id', 'administered_at', 'is_skipped', 'skip_reason'])
      .where('request_id', '=', requestId)
      .where('scheduled_date', '=', date)
      .where('scheduled_time', '=', time)
      .executeTakeFirst();
  }

  // CT-055: trùng liều thì chặn và trả liều đã ghi
  private duplicateDose(existing: {
    id: string;
    administered_at: Date | null;
    is_skipped: boolean;
    skip_reason: string | null;
  }) {
    return new ApplicationError('ERR_CONFLICT', 'Liều này đã được ghi', [
      { field: 'administration_id', message: existing.id },
      {
        field: 'existing',
        message: existing.is_skipped
          ? `Đã bỏ liều: ${existing.skip_reason ?? ''}`
          : `Đã cho uống lúc ${existing.administered_at?.toISOString() ?? ''}`,
      },
    ]);
  }

  private async notifyGuardians(
    executor: Kysely<SchoolYearDatabase>,
    child: { id: string; org_unit_id: string },
    targetId: string,
    message: { templateCode: string; title: string; body: string; targetType?: string },
  ) {
    const guardians = await guardianUserIds(executor, child.id);
    await queueNotification(executor, {
      orgUnitId: child.org_unit_id,
      templateCode: message.templateCode,
      title: message.title,
      body: message.body,
      targetType: message.targetType ?? 'medication_requests',
      targetId,
      recipients: guardians.map((userId) => ({ userId, channel: 'in_app' as const })),
    });
  }
}

function check(errors: FieldError[]) {
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

function readTimes(body: RequestBody, errors: FieldError[]): string[] {
  const value = body?.times;
  if (!Array.isArray(value) || value.length === 0) {
    errors.push({ field: 'times', message: 'Bắt buộc nhập ít nhất một giờ cho uống' });
    return [];
  }
  if (
    value.length > MAXIMUM_TIMES ||
    !value.every((time) => typeof time === 'string' && TIME_PATTERN.test(time)) ||
    new Set(value).size !== value.length
  ) {
    errors.push({ field: 'times', message: `Giờ cho uống dạng HH:MM, không trùng, tối đa ${MAXIMUM_TIMES} giờ` });
    return [];
  }
  return value as string[];
}

function readPhotoIds(body: RequestBody, errors: FieldError[]): string[] {
  const value = body?.medicine_photo_ids;
  if (!Array.isArray(value) || value.length === 0) {
    errors.push({ field: 'medicine_photo_ids', message: 'Bắt buộc gửi ít nhất một ảnh thuốc' });
    return [];
  }
  if (value.length > MAXIMUM_PHOTOS || !value.every(isUuid) || new Set(value).size !== value.length) {
    errors.push({ field: 'medicine_photo_ids', message: `Tối đa ${MAXIMUM_PHOTOS} ảnh thuốc, mã ảnh hợp lệ` });
    return [];
  }
  return value;
}

function optionalUuid(body: RequestBody, field: string, errors: FieldError[]): string | null {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (!isUuid(value)) {
    errors.push({ field, message: 'Mã không hợp lệ' });
    return null;
  }
  return value;
}

@Controller()
export class MedicationRequestsController {
  constructor(private readonly requests: MedicationRequestsService) {}

  @Post('medication-requests')
  @HttpCode(201)
  submit(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input: MedicationRequestInput = {
      child_id: readRequiredUuid(body, 'child_id', errors, 'Bắt buộc chọn trẻ'),
      medicine_name: readNote(body, 'medicine_name', errors, true) ?? '',
      dosage: readNote(body, 'dosage', errors, true) ?? '',
      times: readTimes(body, errors),
      from_date: readHealthDate(body, 'from_date', errors, true) ?? '',
      to_date: readHealthDate(body, 'to_date', errors, true) ?? '',
      allergy_note: readNote(body, 'allergy_note', errors, true) ?? '',
      note: readNote(body, 'note', errors),
      medicine_photo_ids: readPhotoIds(body, errors),
      prescription_photo_id: optionalUuid(body, 'prescription_photo_id', errors),
    };
    check(errors);
    return this.requests.submit(currentUser, input, originOf(request, currentUser));
  }

  @Get('medication-requests')
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    for (const field of ['child_id', 'org_unit_id', 'class_id']) {
      if (query[field] !== undefined && !isUuid(query[field])) {
        throw validationError([{ field, message: 'Mã không hợp lệ' }]);
      }
    }
    const status = query.status as MedicationRequestStatus | undefined;
    if (status !== undefined && !STATUSES.includes(status)) {
      throw validationError([
        { field: 'status', message: 'Trạng thái là pending, administering, completed hoặc rejected' },
      ]);
    }
    return this.requests.list(currentUser, {
      childId: query.child_id ?? null,
      status: status ?? null,
      orgUnitId: query.org_unit_id ?? null,
      classId: query.class_id ?? null,
    });
  }

  @Get('medication-requests/:id')
  read(
    @Param('id', uuidParameter('Mã yêu cầu không hợp lệ')) requestId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.requests.read(currentUser, requestId);
  }

  @Post('medication-requests/:id/receive')
  @HttpCode(200)
  receive(
    @Param('id', uuidParameter('Mã yêu cầu không hợp lệ')) requestId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = {
      received_quantity: readNote(body, 'received_quantity', errors),
      received_note: readNote(body, 'received_note', errors),
    };
    check(errors);
    return this.requests.receive(currentUser, requestId, input, originOf(request, currentUser));
  }

  @Post('medication-requests/:id/reject')
  @HttpCode(200)
  reject(
    @Param('id', uuidParameter('Mã yêu cầu không hợp lệ')) requestId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const reason = readNote(body, 'reason', errors, true) ?? '';
    check(errors);
    return this.requests.reject(currentUser, requestId, reason, originOf(request, currentUser));
  }

  @Post('medication-requests/:id/complete')
  @HttpCode(200)
  complete(
    @Param('id', uuidParameter('Mã yêu cầu không hợp lệ')) requestId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.requests.complete(currentUser, requestId, originOf(request, currentUser));
  }

  @Get('medication-schedules')
  schedule(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    for (const field of ['org_unit_id', 'class_id']) {
      if (query[field] !== undefined && !isUuid(query[field])) {
        errors.push({ field, message: 'Mã không hợp lệ' });
      }
    }
    const date = readHealthDate(query, 'date', errors, false);
    check(errors);
    return this.requests.schedule(currentUser, {
      date,
      orgUnitId: query.org_unit_id ?? null,
      classId: query.class_id ?? null,
    });
  }

  @Post('medication-administrations')
  @HttpCode(201)
  administer(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const isSkipped = body?.is_skipped === true;
    if (body?.is_skipped !== undefined && typeof body.is_skipped !== 'boolean') {
      errors.push({ field: 'is_skipped', message: 'Bỏ liều là true hoặc false' });
    }
    const scheduledTime = body?.scheduled_time;
    if (typeof scheduledTime !== 'string' || !TIME_PATTERN.test(scheduledTime)) {
      errors.push({ field: 'scheduled_time', message: 'Bắt buộc chọn giờ cho uống dạng HH:MM' });
    }
    const input: AdministrationInput = {
      request_id: readRequiredUuid(body, 'request_id', errors, 'Bắt buộc chọn yêu cầu dặn thuốc'),
      scheduled_date: readHealthDate(body, 'scheduled_date', errors, false),
      scheduled_time: typeof scheduledTime === 'string' ? scheduledTime : '',
      is_skipped: isSkipped,
      skip_reason: readNote(body, 'skip_reason', errors, isSkipped),
      dose_note: readNote(body, 'dose_note', errors),
    };
    if (isSkipped && !input.skip_reason && !errors.some((error) => error.field === 'skip_reason')) {
      errors.push({ field: 'skip_reason', message: 'Bỏ liều phải nhập lý do' });
    }
    check(errors);
    return this.requests.administer(currentUser, input, originOf(request, currentUser));
  }

  @Post('medication-administrations/:id/acknowledge')
  @HttpCode(200)
  acknowledge(
    @Param('id', uuidParameter('Mã liều thuốc không hợp lệ')) administrationId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.requests.acknowledge(currentUser, administrationId);
  }
}

// Ảnh thuốc, ảnh đơn thuốc gắn với yêu cầu dặn thuốc nào (dùng khi tải tệp)
export function medicationRequestOfFile(database: Kysely<SchoolYearDatabase>, fileId: string) {
  return database
    .selectFrom('medication_requests')
    .select(['id', 'child_id'])
    .where(sql<boolean>`${fileId}::uuid = any(medicine_photo_ids) or prescription_photo_id = ${fileId}::uuid`)
    .executeTakeFirst();
}
