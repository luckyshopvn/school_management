import { Body, Controller, Get, HttpCode, Injectable, Post, Put, Query, Req, Res } from '@nestjs/common';
import type { PhysicalEducationResult, SchoolYearDatabase, StudentHealthTerm } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { EYE_CONDITIONS, PERMISSION_CODES, PHYSICAL_EDUCATION_RESULTS } from '@school-management/shared';
import ExcelJS from 'exceljs';
import type { Request, Response } from 'express';
import type { Kysely, Transaction } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { isUuid, notFoundError, type RequestBody } from '../common/request-fields.js';
import { HealthAccess } from './health-access.js';
import { readNote } from './health-fields.js';
import { parseMeasure } from './growth.js';
import {
  EYE_CONDITION_VALUES,
  STUDENT_HEALTH_RULE,
  TERMS,
  latestGrowthByChild,
  termRangeOf,
  type TermRange,
} from './student-health-calc.js';

// Thông tin sức khỏe học sinh theo học kỳ (DT-16 phần 16h; khảo sát mục 4.6 của Sở): nhân viên y tế (P10.health.manage
// trong phạm vi đơn vị) nhập theo lớp cân nặng, chiều cao, kết quả giáo dục thể chất, biết bơi, bệnh về mắt; "Lấy dữ liệu
// từ 4.3" chép số đo gần nhất của các đợt cân đo trong học kỳ. Người xem: như số đo cân nặng, chiều cao (vai trò văn phòng
// được xem sức khỏe, y tế, người xem báo cáo cân đo của đơn vị, giáo viên chủ nhiệm của lớp)
const HEIGHT_RANGE = { minimum: 30, maximum: 200 };
const WEIGHT_RANGE = { minimum: 1, maximum: 150 };
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PHYSICAL_EDUCATION_VALUES = PHYSICAL_EDUCATION_RESULTS.map((item) => item.value) as PhysicalEducationResult[];
const NO_ID = '00000000-0000-0000-0000-000000000000';
const nonEmpty = (ids: string[]) => (ids.length > 0 ? ids : [NO_ID]);
const toNumber = (value: string | null) => (value === null ? null : Number(value));
const dateText = (value: unknown) =>
  value instanceof Date ? VIETNAM_DATE.format(value) : String(value ?? '').slice(0, 10);

export interface StudentHealthInput {
  child_id: string;
  weight_kg: number | null;
  height_cm: number | null;
  measured_on: string | null;
  physical_education: PhysicalEducationResult | null;
  can_swim: boolean | null;
  eye_conditions: string[];
  note: string | null;
}

interface ClassRecord {
  id: string;
  name: string;
  org_unit_id: string;
}

const isEmpty = (input: StudentHealthInput) =>
  input.weight_kg === null &&
  input.height_cm === null &&
  input.physical_education === null &&
  input.can_swim === null &&
  input.eye_conditions.length === 0 &&
  input.note === null;

@Injectable()
export class StudentHealthService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly databases: Databases,
    private readonly access: HealthAccess,
    private readonly clock: Clock,
  ) {}

  private today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  // Học kỳ của năm học đang dùng theo lịch năm học
  async termRanges(): Promise<TermRange[]> {
    const { academicYearId } = await this.currentSchoolYear.require();
    const rows = await this.databases.system
      .selectFrom('academic_terms')
      .select(['term_type', 'start_date', 'end_date'])
      .where('academic_year_id', '=', academicYearId)
      .execute();
    return rows.map((row) => ({
      term_type: row.term_type,
      start_date: dateText(row.start_date),
      end_date: dateText(row.end_date),
    }));
  }

  private async findClass(database: Kysely<SchoolYearDatabase>, classId: string): Promise<ClassRecord> {
    const record = await database
      .selectFrom('classes')
      .select(['id', 'name', 'org_unit_id'])
      .where('id', '=', classId)
      .executeTakeFirst();
    if (!record) {
      throw notFoundError('Không tìm thấy lớp', 'class');
    }
    return record;
  }

  private async canRead(database: Kysely<SchoolYearDatabase>, currentUser: CurrentUser, classRecord: ClassRecord) {
    if (await this.access.officeCanAccess(currentUser, classRecord.org_unit_id)) {
      return true;
    }
    if (await this.access.canWriteUnit(currentUser, PERMISSION_CODES.healthManage, classRecord.org_unit_id)) {
      return true;
    }
    const scope = await this.access.officeUnitScope(currentUser, PERMISSION_CODES.growthReport);
    if (scope.wholeSchool || scope.orgUnitIds.includes(classRecord.org_unit_id)) {
      return true;
    }
    return this.access.isHomeroom(database, currentUser, classRecord.id);
  }

  private async assertWrite(currentUser: CurrentUser, classRecord: ClassRecord) {
    if (!(await this.access.canWriteUnit(currentUser, PERMISSION_CODES.healthManage, classRecord.org_unit_id))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền nhập thông tin sức khỏe của lớp này');
    }
  }

  // Học sinh đang học của lớp (lớp hiện tại)
  private enrolled(database: Kysely<SchoolYearDatabase>, classId: string) {
    return database
      .selectFrom('class_enrollments')
      .innerJoin('children', 'children.id', 'class_enrollments.child_id')
      .select(['children.id', 'children.full_name', 'children.dob', 'children.gender', 'children.org_unit_id'])
      .where('class_enrollments.class_id', '=', classId)
      .where('class_enrollments.is_current', '=', true)
      .where('children.status', '=', 'active')
      .orderBy('children.full_name')
      .execute();
  }

  // Số đo của các đợt cân đo (4.3.1) của đơn vị cho các học sinh
  private async growthPoints(database: Kysely<SchoolYearDatabase>, orgUnitId: string, childIds: string[]) {
    const rows = await database
      .selectFrom('health_measurements')
      .innerJoin('growth_rounds', 'growth_rounds.id', 'health_measurements.growth_round_id')
      .select([
        'health_measurements.child_id',
        'health_measurements.weight_kg',
        'health_measurements.height_cm',
        'growth_rounds.id as growth_round_id',
        'growth_rounds.name as round_name',
        'growth_rounds.measured_on',
      ])
      .where('growth_rounds.org_unit_id', '=', orgUnitId)
      .where('health_measurements.child_id', 'in', nonEmpty(childIds))
      .execute();
    return rows.map((row) => ({
      child_id: row.child_id,
      growth_round_id: row.growth_round_id,
      round_name: row.round_name,
      measured_on: dateText(row.measured_on),
      weight_kg: toNumber(row.weight_kg),
      height_cm: toNumber(row.height_cm),
    }));
  }

  // Bảng nhập của một lớp trong một học kỳ kèm số đo 4.3 gần nhất của học kỳ để đối chiếu
  async grid(currentUser: CurrentUser, classId: string, term: StudentHealthTerm) {
    const { database } = await this.currentSchoolYear.require();
    const classRecord = await this.findClass(database, classId);
    if (!(await this.canRead(database, currentUser, classRecord))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không được xem thông tin sức khỏe của lớp này');
    }
    const children = await this.enrolled(database, classId);
    const childIds = children.map((child) => child.id);
    const records = await database
      .selectFrom('student_health_records')
      .selectAll()
      .where('term_type', '=', term)
      .where('child_id', 'in', nonEmpty(childIds))
      .execute();
    const byChild = new Map(records.map((record) => [record.child_id, record]));
    const terms = await this.termRanges();
    const growth = latestGrowthByChild(
      await this.growthPoints(database, classRecord.org_unit_id, childIds),
      terms,
      term,
    );
    return {
      class: { id: classRecord.id, name: classRecord.name, org_unit_id: classRecord.org_unit_id },
      term,
      term_range: termRangeOf(terms, term),
      can_edit: await this.access.canWriteUnit(currentUser, PERMISSION_CODES.healthManage, classRecord.org_unit_id),
      rows: children.map((child) => {
        const record = byChild.get(child.id);
        return {
          child_id: child.id,
          full_name: child.full_name,
          dob: child.dob,
          gender: child.gender,
          record_id: record?.id ?? null,
          measured_on: record?.measured_on ? dateText(record.measured_on) : null,
          weight_kg: record ? toNumber(record.weight_kg) : null,
          height_cm: record ? toNumber(record.height_cm) : null,
          growth_round_id: record?.growth_round_id ?? null,
          physical_education: record?.physical_education ?? null,
          can_swim: record?.can_swim ?? null,
          eye_conditions: record?.eye_conditions ?? [],
          note: record?.note ?? null,
          latest_growth: growth.get(child.id) ?? null,
        };
      }),
    };
  }

  private async upsert(
    transaction: Transaction<SchoolYearDatabase>,
    orgUnitId: string,
    term: StudentHealthTerm,
    childId: string,
    values: Partial<{
      measured_on: string | null;
      weight_kg: number | null;
      height_cm: number | null;
      growth_round_id: string | null;
      physical_education: PhysicalEducationResult | null;
      can_swim: boolean | null;
      eye_conditions: string[];
      note: string | null;
    }>,
    origin: ChangeOrigin,
  ) {
    const existing = await transaction
      .selectFrom('student_health_records')
      .selectAll()
      .where('child_id', '=', childId)
      .where('term_type', '=', term)
      .executeTakeFirst();
    const saved = existing
      ? await transaction
          .updateTable('student_health_records')
          .set({ ...values, recorded_by: origin.actorUserId, updated_at: this.clock.now() })
          .where('id', '=', existing.id)
          .returningAll()
          .executeTakeFirstOrThrow()
      : await transaction
          .insertInto('student_health_records')
          .values({
            child_id: childId,
            org_unit_id: orgUnitId,
            term_type: term,
            ...values,
            recorded_by: origin.actorUserId,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
    await writeAuditLog(transaction, {
      origin,
      orgUnitId,
      entityName: 'student_health_records',
      entityId: saved.id,
      action: existing ? 'update' : 'create',
      before: existing ?? null,
      after: saved,
    });
  }

  // Ghi thông tin sức khỏe của nhiều học sinh trong lớp; dòng để trống mọi ô thì xóa thông tin của học sinh trong học kỳ
  async save(
    currentUser: CurrentUser,
    classId: string,
    term: StudentHealthTerm,
    inputs: StudentHealthInput[],
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const classRecord = await this.findClass(database, classId);
    await this.assertWrite(currentUser, classRecord);
    const members = new Set((await this.enrolled(database, classId)).map((child) => child.id));
    const outside = inputs.findIndex((input) => !members.has(input.child_id));
    if (outside >= 0) {
      throw validationError([{ field: `rows[${outside}].child_id`, message: 'Học sinh không đang học ở lớp này' }]);
    }
    const today = this.today();
    return database.transaction().execute(async (transaction) => {
      let saved = 0;
      let removed = 0;
      for (const input of inputs) {
        if (isEmpty(input)) {
          const existing = await transaction
            .selectFrom('student_health_records')
            .selectAll()
            .where('child_id', '=', input.child_id)
            .where('term_type', '=', term)
            .executeTakeFirst();
          if (existing) {
            await transaction.deleteFrom('student_health_records').where('id', '=', existing.id).execute();
            await writeAuditLog(transaction, {
              origin,
              orgUnitId: classRecord.org_unit_id,
              entityName: 'student_health_records',
              entityId: existing.id,
              action: 'delete',
              before: existing,
              after: null,
            });
            removed += 1;
          }
          continue;
        }
        const measured = input.weight_kg !== null || input.height_cm !== null;
        await this.upsert(
          transaction,
          classRecord.org_unit_id,
          term,
          input.child_id,
          {
            weight_kg: input.weight_kg,
            height_cm: input.height_cm,
            measured_on: measured ? (input.measured_on ?? today) : null,
            physical_education: input.physical_education,
            can_swim: input.can_swim,
            eye_conditions: input.eye_conditions,
            note: input.note,
          },
          origin,
        );
        saved += 1;
      }
      return { saved_count: saved, removed_count: removed };
    });
  }

  // "Lấy dữ liệu từ 4.3": chép cân nặng, chiều cao, ngày đo của đợt cân đo gần nhất trong học kỳ cho các học sinh của lớp;
  // không đổi các ô khác
  async pullGrowth(currentUser: CurrentUser, classId: string, term: StudentHealthTerm, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const classRecord = await this.findClass(database, classId);
    await this.assertWrite(currentUser, classRecord);
    const children = await this.enrolled(database, classId);
    const latest = latestGrowthByChild(
      await this.growthPoints(
        database,
        classRecord.org_unit_id,
        children.map((child) => child.id),
      ),
      await this.termRanges(),
      term,
    );
    if (latest.size === 0) {
      throw ruleViolationError(
        STUDENT_HEALTH_RULE,
        'Chưa có số đo của học sinh nào trong các đợt cân đo (4.3.1) thuộc học kỳ này',
      );
    }
    await database.transaction().execute(async (transaction) => {
      for (const [childId, point] of latest) {
        await this.upsert(
          transaction,
          classRecord.org_unit_id,
          term,
          childId,
          {
            weight_kg: point.weight_kg,
            height_cm: point.height_cm,
            measured_on: point.measured_on,
            growth_round_id: point.growth_round_id,
          },
          origin,
        );
      }
    });
    return { updated_count: latest.size, missing_count: children.length - latest.size };
  }

  // Xuất bảng của lớp ra Excel; ghi nhật ký xuất có dữ liệu cá nhân (BR-74)
  async exportGrid(
    currentUser: CurrentUser,
    classId: string,
    term: StudentHealthTerm,
    query: Record<string, unknown>,
    ip: string | null,
  ) {
    const grid = await this.grid(currentUser, classId, term);
    const termLabel = term === 'first_term' ? 'Học kỳ I' : 'Học kỳ II';
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sức khỏe học sinh');
    sheet.addRow([`Thông tin sức khỏe học sinh lớp ${grid.class.name}, ${termLabel}`]);
    sheet.getRow(1).font = { bold: true };
    sheet.addRow([
      'STT',
      'Họ tên',
      'Ngày sinh',
      'Giới tính',
      'Cân nặng (kg)',
      'Chiều cao (cm)',
      'Ngày đo',
      'Giáo dục thể chất',
      'Biết bơi',
      'Bệnh về mắt',
      'Ghi chú',
    ]);
    sheet.getRow(2).font = { bold: true };
    grid.rows.forEach((row, index) => {
      sheet.addRow([
        index + 1,
        row.full_name,
        row.dob,
        row.gender === 'female' ? 'Nữ' : 'Nam',
        row.weight_kg ?? '',
        row.height_cm ?? '',
        row.measured_on ?? '',
        PHYSICAL_EDUCATION_RESULTS.find((item) => item.value === row.physical_education)?.label ?? '',
        row.can_swim === null ? '' : row.can_swim ? 'Có' : 'Không',
        row.eye_conditions
          .map((value) => EYE_CONDITIONS.find((item) => item.value === value)?.label ?? value)
          .join(', '),
        row.note ?? '',
      ]);
    });
    sheet.columns.forEach((column, index) => {
      column.width = index === 1 ? 28 : index === 9 ? 30 : 14;
    });
    const fileName = `suc-khoe-hoc-sinh-${term === 'first_term' ? 'hk1' : 'hk2'}.xlsx`;
    const { database } = await this.currentSchoolYear.require();
    const log = await database
      .insertInto('export_logs')
      .values({
        user_id: currentUser.id,
        actor_name: currentUser.description.full_name,
        report_code: 'student-health',
        filters_data: JSON.stringify(query),
        org_unit_ids: [grid.class.org_unit_id],
        row_count: grid.rows.length,
        contains_personal_data: true,
        file_name: fileName,
        ip_address: ip,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return { buffer: Buffer.from(await workbook.xlsx.writeBuffer()), fileName, logId: log.id };
  }
}

export function readTerm(value: unknown, errors: FieldError[]): StudentHealthTerm {
  if (typeof value !== 'string' || !TERMS.includes(value as StudentHealthTerm)) {
    errors.push({ field: 'term', message: 'Học kỳ là first_term hoặc second_term' });
    return 'first_term';
  }
  return value as StudentHealthTerm;
}

function readClassId(value: unknown, errors: FieldError[]): string {
  if (!isUuid(value)) {
    errors.push({ field: 'class_id', message: 'Chọn lớp' });
    return NO_ID;
  }
  return value;
}

function check(errors: FieldError[]) {
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

export function readStudentHealthRows(body: RequestBody, errors: FieldError[]): StudentHealthInput[] {
  const raw = body?.rows;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 500) {
    errors.push({ field: 'rows', message: 'Danh sách học sinh từ 1 đến 500 dòng' });
    return [];
  }
  const seen = new Set<string>();
  return raw.map((item: unknown, index) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const field = (name: string) => `rows[${index}].${name}`;
    const childId = row.child_id;
    if (!isUuid(childId) || seen.has(childId)) {
      errors.push({ field: field('child_id'), message: 'Mã học sinh không hợp lệ hoặc bị lặp' });
    } else {
      seen.add(childId);
    }
    const measure = (name: string, range: { minimum: number; maximum: number }, digits: number, label: string) => {
      const value = row[name];
      const parsed = value === undefined || value === null ? null : parseMeasure(String(value), range, digits);
      if (parsed === undefined) {
        errors.push({ field: field(name), message: `${label} từ ${range.minimum} đến ${range.maximum}` });
        return null;
      }
      return parsed;
    };
    const physical = row.physical_education ?? null;
    if (physical !== null && physical !== '' && !PHYSICAL_EDUCATION_VALUES.includes(physical as PhysicalEducationResult)) {
      errors.push({ field: field('physical_education'), message: 'Giáo dục thể chất là passed hoặc not_passed' });
    }
    const canSwim = row.can_swim ?? null;
    if (canSwim !== null && typeof canSwim !== 'boolean') {
      errors.push({ field: field('can_swim'), message: 'Biết bơi là true, false hoặc để trống' });
    }
    const eyes = row.eye_conditions ?? [];
    const eyeList = Array.isArray(eyes) ? eyes : [];
    if (!Array.isArray(eyes) || eyeList.some((value) => !EYE_CONDITION_VALUES.includes(value as never))) {
      errors.push({ field: field('eye_conditions'), message: `Bệnh về mắt trong: ${EYE_CONDITION_VALUES.join(', ')}` });
    }
    const measuredOn = row.measured_on;
    if (
      measuredOn !== undefined &&
      measuredOn !== null &&
      measuredOn !== '' &&
      (typeof measuredOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(measuredOn))
    ) {
      errors.push({ field: field('measured_on'), message: 'Ngày đo dạng YYYY-MM-DD' });
    }
    return {
      child_id: isUuid(childId) ? childId : NO_ID,
      weight_kg: measure('weight_kg', WEIGHT_RANGE, 2, 'Cân nặng (kg)'),
      height_cm: measure('height_cm', HEIGHT_RANGE, 1, 'Chiều cao (cm)'),
      measured_on: typeof measuredOn === 'string' && measuredOn !== '' ? measuredOn : null,
      physical_education:
        physical === '' || physical === null ? null : ((physical as PhysicalEducationResult | undefined) ?? null),
      can_swim: typeof canSwim === 'boolean' ? canSwim : null,
      eye_conditions: [...new Set(eyeList.map(String))].filter((value) =>
        EYE_CONDITION_VALUES.includes(value as never),
      ),
      note: readNote(row, 'note', errors),
    };
  });
}

@Controller()
export class StudentHealthController {
  constructor(private readonly studentHealth: StudentHealthService) {}

  @Get('student-health')
  grid(
    @Query('class_id') classId: unknown,
    @Query('term') term: unknown,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = { classId: readClassId(classId, errors), term: readTerm(term, errors) };
    check(errors);
    return this.studentHealth.grid(currentUser, input.classId, input.term);
  }

  @Put('student-health')
  save(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const classId = readClassId(body?.class_id, errors);
    const term = readTerm(body?.term, errors);
    const rows = readStudentHealthRows(body, errors);
    check(errors);
    return this.studentHealth.save(currentUser, classId, term, rows, originOf(request, currentUser));
  }

  @Post('student-health/pull-growth')
  @HttpCode(200)
  pullGrowth(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const classId = readClassId(body?.class_id, errors);
    const term = readTerm(body?.term, errors);
    check(errors);
    return this.studentHealth.pullGrowth(currentUser, classId, term, originOf(request, currentUser));
  }

  @Get('student-health/export')
  async exportGrid(
    @Query() query: Record<string, unknown>,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const classId = readClassId(query.class_id, errors);
    const term = readTerm(query.term, errors);
    check(errors);
    const file = await this.studentHealth.exportGrid(currentUser, classId, term, query, request.ip ?? null);
    response.setHeader('content-type', XLSX_TYPE);
    response.setHeader('content-disposition', `attachment; filename="${file.fileName}"`);
    response.setHeader('x-export-log-id', file.logId);
    response.setHeader('cache-control', 'no-store');
    response.send(file.buffer);
  }
}
