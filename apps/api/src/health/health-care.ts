import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Query, Req } from '@nestjs/common';
import type { HealthReportType, MedicalEventSeverity, SchoolYearDatabase } from '@school-management/database';
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
import { queueNotification } from '../common/notification-queue.js';
import { isUuid, notFoundError, readRequiredUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { guardianUserIds, isGuardianOf, smsGuardianUserIds } from '../finance/receivables.js';
import { HealthAccess, type HealthChild } from './health-access.js';
import { readDecimal, readHealthDate, readNote } from './health-fields.js';
import { HealthRecordsService } from './health-records.js';

// Sự kiện y tế, chăm sóc hằng ngày, tổng hợp sức khỏe của trẻ, yêu cầu báo cáo sức khỏe (P10-07, P10-08, P10-12; BR-52,
// BR-53, BR-87, BR-88; YCTD-74). Sự kiện y tế ghi xong thì phụ huynh nhận thông báo ngay, sự kiện nặng gửi kèm tin nhắn;
// phụ huynh xác nhận đã biết một lần, người ghi chỉ thấy trạng thái, không nhắc lại
const SEVERITIES: MedicalEventSeverity[] = ['mild', 'moderate', 'severe'];
const SEVERITY_LABELS: Record<MedicalEventSeverity, string> = { mild: 'nhẹ', moderate: 'vừa', severe: 'nặng' };
const REPORT_TYPES: HealthReportType[] = ['growth', 'medical', 'full'];
const CARE_DAYS_IN_SUMMARY = 30;

const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

@Injectable()
export class HealthCareService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: HealthAccess,
    private readonly records: HealthRecordsService,
    private readonly clock: Clock,
  ) {}

  private today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  async recordEvent(
    currentUser: CurrentUser,
    input: {
      child_id: string;
      occurred_at: Date;
      symptoms: string;
      handling: string;
      handler_name: string | null;
      severity: MedicalEventSeverity;
    },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const child = await this.access.assertCanWrite(
      currentUser,
      database,
      input.child_id,
      PERMISSION_CODES.medicalEventRecord,
    );
    if (input.occurred_at.getTime() > this.clock.now().getTime()) {
      throw validationError([{ field: 'occurred_at', message: 'Thời điểm xảy ra không sau hiện tại' }]);
    }
    const now = this.clock.now();
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('medical_events')
        .values({
          child_id: child.id,
          org_unit_id: child.org_unit_id,
          occurred_at: input.occurred_at,
          symptoms: input.symptoms,
          handling: input.handling,
          handler_name: input.handler_name ?? origin.actorName ?? 'Người ghi',
          severity: input.severity,
          recorded_by: origin.actorUserId,
          notified_guardians_at: now,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      const guardians = await guardianUserIds(transaction, child.id);
      await queueNotification(transaction, {
        orgUnitId: child.org_unit_id,
        templateCode: 'medical_event',
        title: 'Sự kiện y tế của con',
        body: `${child.full_name} (${SEVERITY_LABELS[input.severity]}): ${input.symptoms}. Đã xử lý: ${input.handling}`,
        targetType: 'medical_events',
        targetId: created.id,
        recipients: [
          ...guardians.map((userId) => ({ userId, channel: 'in_app' as const })),
          ...(input.severity === 'severe' ? await smsGuardianUserIds(transaction, child.id) : []).map((userId) => ({
            userId,
            channel: 'sms' as const,
          })),
        ],
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: child.org_unit_id,
        entityName: 'medical_events',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  // Danh sách sự kiện y tế theo trẻ hoặc theo đơn vị và khoảng ngày cho y tế, Ban Giám hiệu, quản lý đơn vị
  async listEvents(
    currentUser: CurrentUser,
    filter: { childId: string | null; orgUnitId: string | null; from: string | null; to: string | null },
  ) {
    const { database } = await this.currentSchoolYear.require();
    let query = database
      .selectFrom('medical_events')
      .innerJoin('children', 'children.id', 'medical_events.child_id')
      .select([
        'medical_events.id',
        'medical_events.child_id',
        'children.full_name',
        'medical_events.occurred_at',
        'medical_events.symptoms',
        'medical_events.handling',
        'medical_events.handler_name',
        'medical_events.severity',
        'medical_events.notified_guardians_at',
        'medical_events.parent_acknowledged_at',
      ])
      .orderBy('medical_events.occurred_at', 'desc');
    if (filter.childId) {
      await this.access.assertCanRead(currentUser, database, filter.childId);
      query = query.where('medical_events.child_id', '=', filter.childId);
    } else {
      const scope = await this.access.officeUnitScope(currentUser, PERMISSION_CODES.medicalEventRecord);
      if (!scope.wholeSchool && scope.orgUnitIds.length === 0) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Chọn trẻ để xem sự kiện y tế');
      }
      if (!scope.wholeSchool) {
        query = query.where('medical_events.org_unit_id', 'in', scope.orgUnitIds);
      }
      if (filter.orgUnitId) {
        query = query.where('medical_events.org_unit_id', '=', filter.orgUnitId);
      }
    }
    if (filter.from) {
      query = query.where('medical_events.occurred_at', '>=', new Date(`${filter.from}T00:00:00+07:00`));
    }
    if (filter.to) {
      query = query.where('medical_events.occurred_at', '<', new Date(`${addDays(filter.to, 1)}T00:00:00+07:00`));
    }
    return query.execute();
  }

  // BR-88: phụ huynh của trẻ xác nhận đã biết một lần
  async acknowledgeEvent(currentUser: CurrentUser, eventId: string) {
    const { database } = await this.currentSchoolYear.require();
    const event = await database
      .selectFrom('medical_events')
      .select(['id', 'child_id', 'parent_acknowledged_at'])
      .where('id', '=', eventId)
      .executeTakeFirst();
    if (!event) {
      throw notFoundError('Không tìm thấy sự kiện y tế', 'medical_event');
    }
    if (!(await isGuardianOf(database, event.child_id, currentUser.id))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ phụ huynh của trẻ xác nhận được');
    }
    if (event.parent_acknowledged_at) {
      return { id: event.id, parent_acknowledged_at: event.parent_acknowledged_at };
    }
    return database
      .updateTable('medical_events')
      .set({ parent_acknowledged_at: this.clock.now(), parent_acknowledged_by: currentUser.id })
      .where('id', '=', eventId)
      .returning(['id', 'parent_acknowledged_at'])
      .executeTakeFirstOrThrow();
  }

  // P10-12: giáo viên chủ nhiệm hoặc y tế ghi chăm sóc hằng ngày, chỉ cho ngày hôm nay hoặc trước đó
  async recordCare(
    currentUser: CurrentUser,
    input: {
      child_id: string;
      care_date: string | undefined;
      temperature: number | null;
      condition_note: string | null;
      special_care_note: string | null;
    },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const child = await this.access.assertCanWrite(
      currentUser,
      database,
      input.child_id,
      PERMISSION_CODES.dailyCareRecord,
    );
    const careDate = input.care_date ?? this.today();
    if (careDate > this.today()) {
      throw validationError([{ field: 'care_date', message: 'Ngày chăm sóc không sau hôm nay' }]);
    }
    if (input.temperature === null && input.condition_note === null && input.special_care_note === null) {
      throw validationError([
        { field: 'temperature', message: 'Cần nhập nhiệt độ, tình trạng hoặc chăm sóc đặc biệt' },
      ]);
    }
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('daily_care_logs')
        .values({
          child_id: child.id,
          care_date: careDate,
          recorded_at: this.clock.now(),
          temperature: input.temperature,
          condition_note: input.condition_note,
          special_care_note: input.special_care_note,
          recorded_by: origin.actorUserId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: child.org_unit_id,
        entityName: 'daily_care_logs',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return { ...created, temperature: created.temperature === null ? null : Number(created.temperature) };
    });
  }

  async careLogs(currentUser: CurrentUser, childId: string, from: string | null, to: string | null) {
    const { database } = await this.currentSchoolYear.require();
    await this.access.assertCanRead(currentUser, database, childId);
    return this.careLogsOf(database, childId, from ?? addDays(this.today(), -CARE_DAYS_IN_SUMMARY), to ?? this.today());
  }

  private async careLogsOf(database: Kysely<SchoolYearDatabase>, childId: string, from: string, to: string) {
    const rows = await database
      .selectFrom('daily_care_logs')
      .select(['id', 'care_date', 'recorded_at', 'temperature', 'condition_note', 'special_care_note'])
      .where('child_id', '=', childId)
      .where('care_date', '>=', from)
      .where('care_date', '<=', to)
      .orderBy('recorded_at', 'desc')
      .execute();
    return rows.map((row) => ({ ...row, temperature: row.temperature === null ? null : Number(row.temperature) }));
  }

  private async eventsOf(database: Kysely<SchoolYearDatabase>, childId: string, from: string, to: string) {
    return database
      .selectFrom('medical_events')
      .select(['id', 'occurred_at', 'symptoms', 'handling', 'handler_name', 'severity', 'parent_acknowledged_at'])
      .where('child_id', '=', childId)
      .where('occurred_at', '>=', new Date(`${from}T00:00:00+07:00`))
      .where('occurred_at', '<', new Date(`${addDays(to, 1)}T00:00:00+07:00`))
      .orderBy('occurred_at', 'desc')
      .execute();
  }

  // Tổng hợp sức khỏe của trẻ cho phụ huynh và người được xem (MP-08, MG-09, MH-16)
  async summary(currentUser: CurrentUser, childId: string) {
    const { database } = await this.currentSchoolYear.require();
    const child = await this.access.assertCanRead(currentUser, database, childId);
    const today = this.today();
    const profile = await database
      .selectFrom('health_profiles')
      .select(['blood_type', 'has_allergies', 'allergies', 'chronic_conditions', 'note'])
      .where('child_id', '=', childId)
      .executeTakeFirst();
    return {
      child: { id: child.id, full_name: child.full_name, dob: child.dob, gender: child.gender },
      profile: profile ?? null,
      measurements: await this.records.measurements(currentUser, childId),
      check_results: await this.records.publishedResultsOf(database, child),
      medical_events: await this.eventsOf(database, childId, '1900-01-01', today),
      daily_care: await this.careLogsOf(database, childId, addDays(today, -CARE_DAYS_IN_SUMMARY), today),
    };
  }

  // P10-08: phụ huynh yêu cầu báo cáo sức khỏe của con theo loại và kỳ
  async requestReport(
    currentUser: CurrentUser,
    input: {
      child_id: string;
      report_type: HealthReportType;
      period_from: string;
      period_to: string;
      note: string | null;
    },
  ) {
    const { database } = await this.currentSchoolYear.require();
    if (!(await isGuardianOf(database, input.child_id, currentUser.id))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ phụ huynh của trẻ gửi được yêu cầu báo cáo sức khỏe');
    }
    if (input.period_to < input.period_from || input.period_to > this.today()) {
      throw validationError([
        { field: 'period_to', message: 'Kỳ báo cáo phải kết thúc không sau hôm nay và không trước ngày bắt đầu' },
      ]);
    }
    const child = await this.access.findChild(database, input.child_id);
    const pending = await database
      .selectFrom('health_report_requests')
      .select('id')
      .where('child_id', '=', input.child_id)
      .where('status', '=', 'pending')
      .executeTakeFirst();
    if (pending) {
      throw ruleViolationError('P10-08', 'Con đang có một yêu cầu báo cáo chờ y tế gửi');
    }
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('health_report_requests')
        .values({ ...input, org_unit_id: child.org_unit_id, requested_by: currentUser.id })
        .returning(['id', 'child_id', 'report_type', 'period_from', 'period_to', 'note', 'status', 'requested_at'])
        .executeTakeFirstOrThrow();
      await queueNotification(transaction, {
        orgUnitId: child.org_unit_id,
        templateCode: 'health_report_requested',
        title: 'Yêu cầu báo cáo sức khỏe',
        body: `Phụ huynh của ${child.full_name} yêu cầu báo cáo sức khỏe từ ${input.period_from} đến ${input.period_to}`,
        targetType: 'health_report_requests',
        targetId: created.id,
        recipients: [{ roleCode: 'VT-09', orgUnitId: child.org_unit_id, channel: 'in_app' }],
      });
      return created;
    });
  }

  async listReports(currentUser: CurrentUser, status: 'pending' | 'sent' | null) {
    const { database } = await this.currentSchoolYear.require();
    let query = database
      .selectFrom('health_report_requests')
      .innerJoin('children', 'children.id', 'health_report_requests.child_id')
      .select([
        'health_report_requests.id',
        'health_report_requests.child_id',
        'children.full_name',
        'health_report_requests.report_type',
        'health_report_requests.period_from',
        'health_report_requests.period_to',
        'health_report_requests.note',
        'health_report_requests.status',
        'health_report_requests.requested_at',
        'health_report_requests.report_data',
        'health_report_requests.response_note',
        'health_report_requests.sent_at',
      ])
      .orderBy('health_report_requests.requested_at', 'desc');
    const scope = await this.access.officeUnitScope(currentUser, PERMISSION_CODES.healthManage);
    if (scope.wholeSchool) {
      // Y tế gán ở Trường chính xem mọi yêu cầu
    } else if (scope.orgUnitIds.length > 0) {
      query = query.where('health_report_requests.org_unit_id', 'in', scope.orgUnitIds);
    } else {
      query = query.where('health_report_requests.requested_by', '=', currentUser.id);
    }
    if (status) {
      query = query.where('health_report_requests.status', '=', status);
    }
    return query.execute();
  }

  // Y tế tổng hợp dữ liệu của kỳ theo loại báo cáo rồi gửi; phụ huynh nhận thông báo và xem báo cáo trên ứng dụng
  async sendReport(currentUser: CurrentUser, requestId: string, responseNote: string | null, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const request = await database
      .selectFrom('health_report_requests')
      .selectAll()
      .where('id', '=', requestId)
      .executeTakeFirst();
    if (!request) {
      throw notFoundError('Không tìm thấy yêu cầu báo cáo', 'health_report_request');
    }
    if (!(await this.access.canWriteUnit(currentUser, PERMISSION_CODES.healthManage, request.org_unit_id))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền gửi báo cáo sức khỏe của đơn vị này');
    }
    if (request.status === 'sent') {
      throw ruleViolationError('P10-08', 'Yêu cầu này đã được gửi báo cáo');
    }
    const child = await this.access.findChild(database, request.child_id);
    const reportData = await this.compile(database, child, request);
    return database.transaction().execute(async (transaction) => {
      const sent = await transaction
        .updateTable('health_report_requests')
        .set({
          status: 'sent',
          report_data: JSON.stringify(reportData),
          response_note: responseNote,
          sent_by: origin.actorUserId,
          sent_at: this.clock.now(),
        })
        .where('id', '=', requestId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await queueNotification(transaction, {
        orgUnitId: request.org_unit_id,
        templateCode: 'health_report_sent',
        title: 'Báo cáo sức khỏe của con',
        body: `Đã có báo cáo sức khỏe của ${child.full_name} từ ${request.period_from} đến ${request.period_to}`,
        targetType: 'health_report_requests',
        targetId: requestId,
        recipients: [{ userId: request.requested_by, channel: 'in_app' }],
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: request.org_unit_id,
        entityName: 'health_report_requests',
        entityId: requestId,
        action: 'update',
        before: { status: 'pending' },
        after: { status: 'sent' },
      });
      return sent;
    });
  }

  private async compile(
    database: Kysely<SchoolYearDatabase>,
    child: HealthChild,
    request: { report_type: HealthReportType; period_from: string; period_to: string },
  ) {
    const data: Record<string, unknown> = {
      child: { full_name: child.full_name, dob: child.dob, gender: child.gender },
      period_from: request.period_from,
      period_to: request.period_to,
    };
    if (request.report_type === 'growth' || request.report_type === 'full') {
      data.measurements = await database
        .selectFrom('health_measurements')
        .select(['measured_on', 'height_cm', 'weight_kg', 'vision_left', 'vision_right'])
        .where('child_id', '=', child.id)
        .where('measured_on', '>=', request.period_from)
        .where('measured_on', '<=', request.period_to)
        .orderBy('measured_on')
        .execute();
      data.check_results = (await this.records.publishedResultsOf(database, child)).filter((row) => {
        // Kết quả thuộc kỳ báo cáo theo ngày công bố
        const published = row.published_at ? VIETNAM_DATE.format(row.published_at) : '';
        return published >= request.period_from && published <= request.period_to;
      });
    }
    if (request.report_type === 'medical' || request.report_type === 'full') {
      data.medical_events = await this.eventsOf(database, child.id, request.period_from, request.period_to);
      data.daily_care = await this.careLogsOf(database, child.id, request.period_from, request.period_to);
    }
    return data;
  }
}

function check(errors: FieldError[]) {
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

function optionalDate(value: unknown, field: string): string | null {
  const errors: FieldError[] = [];
  const date = readHealthDate({ [field]: value }, field, errors, false);
  check(errors);
  return date ?? null;
}

@Controller()
export class HealthCareController {
  constructor(private readonly care: HealthCareService) {}

  @Post('medical-events')
  @HttpCode(201)
  recordEvent(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const occurred = body?.occurred_at;
    let occurredAt = new Date(NaN);
    if (typeof occurred !== 'string' || Number.isNaN(Date.parse(occurred))) {
      errors.push({ field: 'occurred_at', message: 'Thời điểm xảy ra dạng ISO 8601' });
    } else {
      occurredAt = new Date(occurred);
    }
    const severity = body?.severity as MedicalEventSeverity;
    if (!SEVERITIES.includes(severity)) {
      errors.push({ field: 'severity', message: 'Mức độ là mild, moderate hoặc severe' });
    }
    const input = {
      child_id: readRequiredUuid(body, 'child_id', errors, 'Bắt buộc chọn trẻ'),
      occurred_at: occurredAt,
      symptoms: readNote(body, 'symptoms', errors, true) ?? '',
      handling: readNote(body, 'handling', errors, true) ?? '',
      handler_name: readNote(body, 'handler_name', errors),
      severity,
    };
    check(errors);
    return this.care.recordEvent(currentUser, input, originOf(request, currentUser));
  }

  @Get('medical-events')
  listEvents(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    for (const field of ['child_id', 'org_unit_id']) {
      if (query[field] !== undefined && !isUuid(query[field])) {
        throw validationError([{ field, message: 'Mã không hợp lệ' }]);
      }
    }
    return this.care.listEvents(currentUser, {
      childId: query.child_id ?? null,
      orgUnitId: query.org_unit_id ?? null,
      from: optionalDate(query.from, 'from'),
      to: optionalDate(query.to, 'to'),
    });
  }

  @Post('medical-events/:id/acknowledge')
  @HttpCode(200)
  acknowledgeEvent(
    @Param('id', uuidParameter('Mã sự kiện không hợp lệ')) eventId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.care.acknowledgeEvent(currentUser, eventId);
  }

  @Post('daily-care-logs')
  @HttpCode(201)
  recordCare(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      child_id: readRequiredUuid(body, 'child_id', errors, 'Bắt buộc chọn trẻ'),
      care_date: readHealthDate(body, 'care_date', errors, false),
      temperature: readDecimal(body, 'temperature', errors, { minimum: 34, maximum: 43 }),
      condition_note: readNote(body, 'condition_note', errors),
      special_care_note: readNote(body, 'special_care_note', errors),
    };
    check(errors);
    return this.care.recordCare(currentUser, input, originOf(request, currentUser));
  }

  @Get('children/:id/daily-care-logs')
  careLogs(
    @Param('id', uuidParameter('Mã trẻ không hợp lệ')) childId: string,
    @Query() query: Record<string, string | undefined>,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.care.careLogs(currentUser, childId, optionalDate(query.from, 'from'), optionalDate(query.to, 'to'));
  }

  @Get('children/:id/health')
  summary(
    @Param('id', uuidParameter('Mã trẻ không hợp lệ')) childId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.care.summary(currentUser, childId);
  }

  @Post('health-report-requests')
  @HttpCode(201)
  requestReport(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const reportType = body?.report_type as HealthReportType;
    if (!REPORT_TYPES.includes(reportType)) {
      errors.push({ field: 'report_type', message: 'Loại báo cáo là growth, medical hoặc full' });
    }
    const input = {
      child_id: readRequiredUuid(body, 'child_id', errors, 'Bắt buộc chọn trẻ'),
      report_type: reportType,
      period_from: readHealthDate(body, 'period_from', errors, true) ?? '',
      period_to: readHealthDate(body, 'period_to', errors, true) ?? '',
      note: readNote(body, 'note', errors),
    };
    check(errors);
    return this.care.requestReport(currentUser, input);
  }

  @Get('health-report-requests')
  listReports(@Query('status') status: unknown, @AuthenticatedUser() currentUser: CurrentUser) {
    if (status !== undefined && status !== 'pending' && status !== 'sent') {
      throw validationError([{ field: 'status', message: 'Trạng thái là pending hoặc sent' }]);
    }
    return this.care.listReports(currentUser, (status as 'pending' | 'sent' | undefined) ?? null);
  }

  @Post('health-report-requests/:id/send')
  @HttpCode(200)
  sendReport(
    @Param('id', uuidParameter('Mã yêu cầu không hợp lệ')) requestId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const note = readNote(body, 'response_note', errors);
    check(errors);
    return this.care.sendReport(currentUser, requestId, note, originOf(request, currentUser));
  }
}
