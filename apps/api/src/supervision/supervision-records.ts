import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Query, Req } from '@nestjs/common';
import { sql, type Transaction } from 'kysely';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification } from '../common/notification-queue.js';
import {
  isUuid,
  notFoundError,
  readOptionalText,
  readOptionalUuid,
  readRequiredText,
  readRequiredUuid,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { SupervisionAccess } from './supervision-access.js';
import { vietnamMoment } from './supervision-calc.js';
import { SUPERVISION_RULE_CODE } from './supervision.js';

// Ghi nhận vi phạm, khen từng học sinh, lát L2 (YCTD-391): giám thị, giáo viên chủ nhiệm, giáo viên bộ môn ghi cho học sinh
// trong phạm vi (`SupervisionAccess`), chọn mục nội quy cùng cấp với lớp, khu vực, mô tả, tối đa 3 ảnh bằng chứng. Mục có gắn
// tiêu chí nề nếp lớp và trường đã bật nề nếp thì ghi thêm một dòng điểm cho lớp (Eric chọn ngày 2026-10-30). Giáo viên chủ
// nhiệm của lớp nhận tin trong ứng dụng; báo phụ huynh làm ở lát L3. Thu hồi: người ghi trong ngày, giáo viên chủ nhiệm của lớp,
// người quản lý rèn luyện; dòng điểm lớp đi kèm bị xóa. Ghi nhận không tự trừ điểm, không tự xếp mức rèn luyện
const MAXIMUM_CHILDREN = 30;
const MAXIMUM_EVIDENCE = 3;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const KIND_LABELS = { violation: 'vi phạm', commendation: 'khen' } as const;
const RECORD_COLUMNS = [
  'student_conduct_records.id',
  'student_conduct_records.child_id',
  'student_conduct_records.class_id',
  'student_conduct_records.rule_item_id',
  'student_conduct_records.rule_name',
  'student_conduct_records.kind',
  'student_conduct_records.occurred_at',
  'student_conduct_records.zone_id',
  'student_conduct_records.description',
  'student_conduct_records.evidence_file_ids',
  'student_conduct_records.source',
  'student_conduct_records.class_conduct_entry_id',
  'student_conduct_records.recorded_by',
  'student_conduct_records.recorded_by_name',
  'student_conduct_records.status',
  'student_conduct_records.revoked_reason',
  'student_conduct_records.revoked_by_name',
  'student_conduct_records.revoked_at',
  'student_conduct_records.created_at',
] as const;


interface RecordInput {
  childIds: string[];
  ruleItemId: string;
  occurredAt: Date | null;
  zoneId: string | null;
  description: string | null;
  evidenceFileIds: string[];
}

interface RecordFilter {
  from: string;
  to: string;
  classId: string | null;
  childId: string | null;
  mine: boolean;
}

// Ngày giờ Việt Nam đầu ngày `from` và cuối ngày `to` theo giờ UTC
function vietnamDayRange(from: string, to: string): { start: Date; end: Date } {
  return {
    start: new Date(`${from}T00:00:00+07:00`),
    end: new Date(Date.parse(`${to}T00:00:00+07:00`) + 86_400_000),
  };
}

@Injectable()
export class SupervisionRecordsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: SupervisionAccess,
    private readonly clock: Clock,
  ) {}

  // Lớp, cấp người dùng được ghi nhận; dùng để hiện bộ lọc và danh mục nội quy trên ứng dụng giáo viên
  async scope(currentUser: CurrentUser) {
    const { database } = await this.currentSchoolYear.require();
    const classIds = [...(await this.access.classIds(currentUser, database))];
    const classes =
      classIds.length === 0
        ? []
        : await database
            .selectFrom('classes')
            .select(['id', 'name', 'org_unit_id', 'school_level', 'grade_level'])
            .where('id', 'in', classIds)
            .orderBy('school_level')
            .orderBy('name')
            .execute();
    return {
      classes,
      school_levels: [...new Set(classes.map((row) => row.school_level))],
      can_manage: currentUser.hasPermission(PERMISSION_CODES.supervisionManage),
    };
  }

  // Tìm học sinh đang học ở lớp trong phạm vi, theo tên (ít nhất 2 ký tự) hoặc theo lớp
  async students(currentUser: CurrentUser, filter: { search: string | null; classId: string | null }) {
    const { database } = await this.currentSchoolYear.require();
    const classIds = await this.access.classIds(currentUser, database);
    if (filter.classId && !classIds.has(filter.classId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Lớp không thuộc phạm vi ghi nhận của bạn');
    }
    const allowed = filter.classId ? [filter.classId] : [...classIds];
    if (allowed.length === 0) {
      return [];
    }
    return database
      .selectFrom('class_enrollments')
      .innerJoin('children', 'children.id', 'class_enrollments.child_id')
      .innerJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select([
        'children.id as child_id',
        'children.full_name',
        'classes.id as class_id',
        'classes.name as class_name',
        'classes.org_unit_id',
        'classes.school_level',
      ])
      .where('class_enrollments.class_id', 'in', allowed)
      .where('class_enrollments.is_current', '=', true)
      .where('children.status', '=', 'active')
      .$if(filter.search !== null, (query) =>
        query.where('children.full_name', 'ilike', `%${(filter.search ?? '').replace(/[%_\\]/g, '\\$&')}%`),
      )
      .orderBy('classes.name')
      .orderBy('class_enrollments.order_number')
      .orderBy('children.full_name')
      .limit(filter.search !== null ? 30 : 200)
      .execute();
  }

  async records(currentUser: CurrentUser, filter: RecordFilter) {
    const { database } = await this.currentSchoolYear.require();
    const classIds = filter.mine ? [] : [...(await this.access.classIds(currentUser, database))];
    const range = vietnamDayRange(filter.from, filter.to);
    return database
      .selectFrom('student_conduct_records')
      .innerJoin('children', 'children.id', 'student_conduct_records.child_id')
      .innerJoin('classes', 'classes.id', 'student_conduct_records.class_id')
      .leftJoin('school_zones', 'school_zones.id', 'student_conduct_records.zone_id')
      .select([...RECORD_COLUMNS, 'children.full_name', 'classes.name as class_name', 'school_zones.name as zone_name'])
      .where('student_conduct_records.occurred_at', '>=', range.start)
      .where('student_conduct_records.occurred_at', '<', range.end)
      .where((expression) =>
        classIds.length === 0
          ? expression('student_conduct_records.recorded_by', '=', currentUser.id)
          : expression.or([
              expression('student_conduct_records.recorded_by', '=', currentUser.id),
              expression('student_conduct_records.class_id', 'in', classIds),
            ]),
      )
      .$if(filter.classId !== null, (query) =>
        query.where('student_conduct_records.class_id', '=', filter.classId ?? ''),
      )
      .$if(filter.childId !== null, (query) =>
        query.where('student_conduct_records.child_id', '=', filter.childId ?? ''),
      )
      .orderBy('student_conduct_records.occurred_at', 'desc')
      .limit(500)
      .execute();
  }

  async record(currentUser: CurrentUser, input: RecordInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const classIds = await this.access.classIds(currentUser, database);
    const rule = await database
      .selectFrom('student_rule_items')
      .leftJoin('conduct_criteria', 'conduct_criteria.id', 'student_rule_items.class_criterion_id')
      .select([
        'student_rule_items.id',
        'student_rule_items.name',
        'student_rule_items.kind',
        'student_rule_items.school_level',
        'student_rule_items.status',
        'conduct_criteria.id as criterion_id',
        'conduct_criteria.kind as criterion_kind',
        'conduct_criteria.points as criterion_points',
        'conduct_criteria.status as criterion_status',
      ])
      .where('student_rule_items.id', '=', input.ruleItemId)
      .executeTakeFirst();
    if (!rule || rule.status !== 'active') {
      throw validationError([{ field: 'rule_item_id', message: 'Mục nội quy không có hoặc đã ngừng dùng' }]);
    }
    const students = await database
      .selectFrom('class_enrollments')
      .innerJoin('children', 'children.id', 'class_enrollments.child_id')
      .innerJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select([
        'children.id as child_id',
        'children.full_name',
        'classes.id as class_id',
        'classes.name as class_name',
        'classes.org_unit_id',
        'classes.school_level',
      ])
      .where('class_enrollments.child_id', 'in', input.childIds)
      .where('class_enrollments.is_current', '=', true)
      .where('children.status', '=', 'active')
      .execute();
    for (const childId of input.childIds) {
      const student = students.find((row) => row.child_id === childId);
      if (!student || !classIds.has(student.class_id)) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Có học sinh không thuộc phạm vi ghi nhận của bạn', [
          { field: 'child_ids', message: childId },
        ]);
      }
      if (student.school_level !== rule.school_level) {
        throw ruleViolationError(SUPERVISION_RULE_CODE, 'Mục nội quy không cùng cấp với lớp của học sinh', [
          { field: 'rule_item_id', message: `${student.full_name} học lớp ${student.class_name}` },
        ]);
      }
    }
    if (input.zoneId) {
      const zone = await database
        .selectFrom('school_zones')
        .select('status')
        .where('id', '=', input.zoneId)
        .executeTakeFirst();
      if (!zone || zone.status !== 'active') {
        throw validationError([{ field: 'zone_id', message: 'Khu vực không có hoặc đã ngừng dùng' }]);
      }
    }
    if (input.evidenceFileIds.length > 0) {
      const files = await database
        .selectFrom('files')
        .select('id')
        .where('id', 'in', input.evidenceFileIds)
        .where('purpose', '=', 'conduct_evidence')
        .where('created_by', '=', currentUser.id)
        .execute();
      const linked = await database
        .selectFrom('student_conduct_records')
        .select('id')
        .where(sql<boolean>`evidence_file_ids && cast(${input.evidenceFileIds} as uuid[])`)
        .executeTakeFirst();
      if (files.length !== input.evidenceFileIds.length || linked) {
        throw validationError([
          { field: 'evidence_file_ids', message: 'Ảnh bằng chứng phải do bạn vừa tải lên và chưa gắn ghi nhận khác' },
        ]);
      }
    }
    const occurredAt = input.occurredAt ?? this.clock.now();
    const conduct = await database.selectFrom('conduct_settings').select('enabled').executeTakeFirst();
    const addClassPoints =
      rule.criterion_id !== null && rule.criterion_status === 'active' && (conduct?.enabled ?? false);
    const created = await database.transaction().execute(async (transaction) => {
      const ids: string[] = [];
      for (const childId of input.childIds) {
        const student = students.find((row) => row.child_id === childId);
        if (!student) {
          continue;
        }
        const classEntryId = addClassPoints
          ? await this.addClassPoints(transaction, currentUser, {
              classId: student.class_id,
              criterionId: rule.criterion_id ?? '',
              points: (rule.criterion_kind === 'plus' ? 1 : -1) * (rule.criterion_points ?? 0),
              date: vietnamMoment(occurredAt).date,
              note: `Ghi nhận ${KIND_LABELS[rule.kind]} của ${student.full_name}`,
            })
          : null;
        const row = await transaction
          .insertInto('student_conduct_records')
          .values({
            child_id: childId,
            class_id: student.class_id,
            rule_item_id: rule.id,
            rule_name: rule.name,
            kind: rule.kind,
            occurred_at: occurredAt,
            zone_id: input.zoneId,
            description: input.description,
            evidence_file_ids: input.evidenceFileIds,
            source: 'manual',
            class_conduct_entry_id: classEntryId,
            recorded_by: currentUser.id,
            recorded_by_name: currentUser.description.full_name,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        ids.push(row.id);
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: student.org_unit_id,
          entityName: 'student_conduct_records',
          entityId: row.id,
          action: 'create',
          before: null,
          after: { child_id: childId, rule_item_id: rule.id, kind: rule.kind, class_conduct_entry_id: classEntryId },
        });
        await this.notifyHomeroom(transaction, currentUser, {
          recordId: row.id,
          childId,
          childName: student.full_name,
          className: student.class_name,
          classId: student.class_id,
          orgUnitId: student.org_unit_id,
          title: `Ghi nhận ${KIND_LABELS[rule.kind]}: ${rule.name}`,
        });
      }
      return ids;
    });
    return { record_ids: created, class_points_added: addClassPoints };
  }

  private async addClassPoints(
    transaction: Transaction<SchoolYearDatabase>,
    currentUser: CurrentUser,
    input: { classId: string; criterionId: string; points: number; date: string; note: string },
  ): Promise<string> {
    const entry = await transaction
      .insertInto('conduct_entries')
      .values({
        class_id: input.classId,
        criterion_id: input.criterionId,
        entry_date: input.date,
        quantity: 1,
        points: input.points,
        note: input.note.slice(0, 500),
        reported_by: null,
        recorded_by: currentUser.id,
        recorded_by_name: currentUser.description.full_name,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return entry.id;
  }

  private async notifyHomeroom(
    transaction: Transaction<SchoolYearDatabase>,
    currentUser: CurrentUser,
    input: {
      recordId: string;
      childId: string;
      childName: string;
      className: string;
      classId: string;
      orgUnitId: string;
      title: string;
    },
  ): Promise<void> {
    const teachers = await transaction
      .selectFrom('class_staff_assignments')
      .select('staff_user_id')
      .where('class_id', '=', input.classId)
      .where('assignment_role', '=', 'homeroom')
      .where('status', '=', 'active')
      .where('staff_user_id', '!=', currentUser.id)
      .execute();
    if (teachers.length === 0) {
      return;
    }
    await queueNotification(transaction, {
      orgUnitId: input.orgUnitId,
      templateCode: 'conduct_record_created',
      title: input.title,
      body: `${currentUser.description.full_name} ghi cho ${input.childName}, lớp ${input.className}`,
      targetType: 'student_conduct_records',
      targetId: input.recordId,
      recipients: teachers.map((teacher) => ({ userId: teacher.staff_user_id, channel: 'in_app' as const })),
    });
  }

  async revoke(currentUser: CurrentUser, recordId: string, reason: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const record = await database
      .selectFrom('student_conduct_records')
      .innerJoin('classes', 'classes.id', 'student_conduct_records.class_id')
      .select([...RECORD_COLUMNS, 'classes.org_unit_id'])
      .where('student_conduct_records.id', '=', recordId)
      .executeTakeFirst();
    if (!record) {
      throw notFoundError('Không tìm thấy ghi nhận', 'student_conduct_record');
    }
    await this.access.assertCanViewRecord(currentUser, database, record);
    if (record.status === 'revoked') {
      throw ruleViolationError(SUPERVISION_RULE_CODE, 'Ghi nhận đã thu hồi');
    }
    const sameDay = vietnamMoment(record.created_at).date === vietnamMoment(this.clock.now()).date;
    const homeroom = await database
      .selectFrom('class_staff_assignments')
      .select('id')
      .where('class_id', '=', record.class_id)
      .where('staff_user_id', '=', currentUser.id)
      .where('assignment_role', '=', 'homeroom')
      .where('status', '=', 'active')
      .executeTakeFirst();
    const manager =
      currentUser.hasPermission(PERMISSION_CODES.supervisionManage) &&
      (await this.access.classIds(currentUser, database)).has(record.class_id);
    const ownSameDay = record.recorded_by === currentUser.id && sameDay;
    if (!ownSameDay && !homeroom && !manager) {
      throw ruleViolationError(
        SUPERVISION_RULE_CODE,
        'Người ghi chỉ thu hồi trong ngày ghi; sau đó giáo viên chủ nhiệm hoặc Ban Giám hiệu thu hồi',
      );
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('student_conduct_records')
        .set({
          status: 'revoked',
          revoked_reason: reason,
          revoked_by_name: currentUser.description.full_name,
          revoked_at: this.clock.now(),
          class_conduct_entry_id: null,
        })
        .where('id', '=', recordId)
        .execute();
      if (record.class_conduct_entry_id) {
        await transaction.deleteFrom('conduct_entries').where('id', '=', record.class_conduct_entry_id).execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: record.org_unit_id,
        entityName: 'student_conduct_records',
        entityId: recordId,
        action: 'update',
        before: { status: record.status, class_conduct_entry_id: record.class_conduct_entry_id },
        after: { status: 'revoked', revoked_reason: reason },
      });
    });
    return { id: recordId, status: 'revoked' as const };
  }
}

function readDate(value: unknown, field: string, errors: FieldError[]): string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    errors.push({ field, message: 'Ngày theo dạng YYYY-MM-DD' });
    return '';
  }
  return value;
}

function readUuidList(body: RequestBody, field: string, max: number, errors: FieldError[]): string[] {
  const value = body?.[field];
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value) || value.length > max || value.some((item) => typeof item !== 'string' || !isUuid(item))) {
    errors.push({ field, message: `Danh sách mã hợp lệ, tối đa ${max} mục` });
    return [];
  }
  return [...new Set(value as string[])];
}

@Controller('supervision')
export class SupervisionRecordsController {
  constructor(private readonly records: SupervisionRecordsService) {}

  @Get('my-scope')
  @RequirePermission(PERMISSION_CODES.supervisionRecord, PERMISSION_CODES.supervisionManage)
  scope(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.records.scope(currentUser);
  }

  @Get('students')
  @RequirePermission(PERMISSION_CODES.supervisionRecord, PERMISSION_CODES.supervisionManage)
  students(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const search = query.search?.trim() || null;
    if (search !== null && search.length < 2) {
      errors.push({ field: 'search', message: 'Nhập ít nhất 2 ký tự' });
    }
    if (query.class_id && !isUuid(query.class_id)) {
      errors.push({ field: 'class_id', message: 'Mã lớp không hợp lệ' });
    }
    if (search === null && !query.class_id) {
      errors.push({ field: 'search', message: 'Nhập tên hoặc chọn lớp' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.records.students(currentUser, { search, classId: query.class_id || null });
  }

  @Get('records')
  @RequirePermission(PERMISSION_CODES.supervisionRecord, PERMISSION_CODES.supervisionManage)
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const from = readDate(query.from, 'from', errors);
    const to = readDate(query.to ?? query.from, 'to', errors);
    if (from && to && from > to) {
      errors.push({ field: 'to', message: 'Ngày kết thúc không trước ngày bắt đầu' });
    }
    for (const field of ['class_id', 'child_id']) {
      if (query[field] && !isUuid(query[field])) {
        errors.push({ field, message: 'Mã không hợp lệ' });
      }
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.records.records(currentUser, {
      from,
      to,
      classId: query.class_id || null,
      childId: query.child_id || null,
      mine: query.mine === 'true',
    });
  }

  @Post('records')
  @RequirePermission(PERMISSION_CODES.supervisionRecord)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const childIds = readUuidList(body, 'child_ids', MAXIMUM_CHILDREN, errors);
    if (childIds.length === 0 && !errors.some((error) => error.field === 'child_ids')) {
      errors.push({ field: 'child_ids', message: 'Chọn ít nhất một học sinh' });
    }
    let occurredAt: Date | null = null;
    if (body?.occurred_at !== undefined && body.occurred_at !== null) {
      occurredAt = typeof body.occurred_at === 'string' ? new Date(body.occurred_at) : new Date(Number.NaN);
      if (Number.isNaN(occurredAt.getTime()) || occurredAt.getTime() > Date.now() + 5 * 60_000) {
        errors.push({ field: 'occurred_at', message: 'Thời điểm theo dạng ISO 8601, không sau hiện tại' });
      }
    }
    const description = readOptionalText(body, 'description', errors) ?? null;
    if (description && description.length > 500) {
      errors.push({ field: 'description', message: 'Tối đa 500 ký tự' });
    }
    const input: RecordInput = {
      childIds,
      ruleItemId: readRequiredUuid(body, 'rule_item_id', errors, 'Bắt buộc chọn mục nội quy'),
      occurredAt,
      zoneId: readOptionalUuid(body, 'zone_id', errors) ?? null,
      description,
      evidenceFileIds: readUuidList(body, 'evidence_file_ids', MAXIMUM_EVIDENCE, errors),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.records.record(currentUser, input, originOf(request, currentUser));
  }

  @Post('records/:id/revoke')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.supervisionRecord, PERMISSION_CODES.supervisionManage)
  revoke(
    @Param('id', uuidParameter('Mã ghi nhận không hợp lệ')) recordId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const reason = readRequiredText(body, 'reason', errors);
    if (reason.length > 500) {
      errors.push({ field: 'reason', message: 'Tối đa 500 ký tự' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.records.revoke(currentUser, recordId, reason, originOf(request, currentUser));
  }
}
