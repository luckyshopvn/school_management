import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { ChildGender, SchoolYearDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import ExcelJS from 'exceljs';
import type { Request, Response } from 'express';
import type { Kysely, Transaction } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { isUuid, notFoundError, readRequiredUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { MAXIMUM_IMPORT_BYTES, parseDate, readSheet, type ImportColumn, type RowError } from '../imports/excel.js';
import { foldText } from '../imports/moet-columns.js';
import { check, optionalUuid, type QueryValues } from '../reports/report-filters.js';
import { ReportsService } from '../reports/reports.service.js';
import { assessGrowth, referenceCurve, type GrowthAssessment } from './growth-calc.js';
import {
  applyUnderweightOption,
  GROWTH_STATUS_LABELS,
  inChannel,
  summarizeGrowth,
  type GrowthChannel,
  type GrowthChildRow,
} from './growth-summary.js';
import { HealthAccess } from './health-access.js';
import { readHealthDate, readNote } from './health-fields.js';

// Cân nặng, chiều cao theo đợt cân đo (DT-14 phần 14a, YCTD-102; mục 4.3.1, 4.3.2 của hệ thống Sở). Nhân viên y tế
// (P10.health.manage trong phạm vi đơn vị) lập đợt, nhập số đo theo lớp hoặc từ Excel; số đo lưu trong bảng số đo sức
// khỏe sẵn có; chỉ số Z và kênh tăng trưởng tính theo chuẩn WHO mỗi lần đọc. Xem số đo: vai trò văn phòng được xem sức
// khỏe trong đơn vị và giáo viên chủ nhiệm của lớp (BR-53); báo cáo tổng hợp theo quyền P17.report.growth
const HEIGHT_RANGE = { minimum: 30, maximum: 200 };
const WEIGHT_RANGE = { minimum: 1, maximum: 150 };
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const CHANNELS: GrowthChannel[] = [
  'normal',
  'underweight',
  'above_age',
  'stunted',
  'wasted',
  'overweight',
  'obese',
  'not_measured',
];
const NO_ID = '00000000-0000-0000-0000-000000000000';
const nonEmpty = (ids: string[]) => (ids.length > 0 ? ids : [NO_ID]);
const toNumber = (value: string | null) => (value === null ? null : Number(value));

export const GROWTH_IMPORT_COLUMNS: ImportColumn[] = [
  {
    key: 'child_id',
    header: 'Mã học sinh trên hệ thống',
    note: 'Có sẵn trong tệp mẫu tải từ màn hình, giữ nguyên; để trống thì so khớp theo họ tên và ngày sinh',
  },
  { key: 'full_name', header: 'Họ tên', note: 'Họ tên học sinh' },
  { key: 'dob', header: 'Ngày sinh', note: 'Dạng ngày của Excel, YYYY-MM-DD hoặc DD/MM/YYYY' },
  { key: 'class_name', header: 'Lớp', note: 'Để đối chiếu, không bắt buộc' },
  { key: 'weight_kg', header: 'Cân nặng (kg)', note: 'Số từ 1 đến 150, tối đa hai chữ số thập phân' },
  { key: 'height_cm', header: 'Chiều cao (cm)', note: 'Số từ 30 đến 200, một chữ số thập phân' },
  { key: 'note', header: 'Ghi chú', note: 'Không bắt buộc' },
];

export interface MeasurementInput {
  child_id: string;
  weight_kg: number | null;
  height_cm: number | null;
  note: string | null;
}

export interface GrowthReportFilter {
  roundId: string | null;
  month: string | null;
  orgUnitId: string | null;
  gender: ChildGender | null;
  channel: GrowthChannel | null;
}

export function readGrowthReportFilter(query: QueryValues, errors: FieldError[]): GrowthReportFilter {
  const roundId = optionalUuid(query, 'round_id', errors);
  const month = query.month?.trim() || null;
  if (month !== null && !MONTH_PATTERN.test(month)) {
    errors.push({ field: 'month', message: 'Tháng theo dạng YYYY-MM' });
  }
  if (!roundId && !month) {
    errors.push({ field: 'round_id', message: 'Chọn đợt cân đo hoặc tháng' });
  }
  const gender = query.gender?.trim() || null;
  if (gender !== null && gender !== 'male' && gender !== 'female') {
    errors.push({ field: 'gender', message: 'Giới tính là male hoặc female' });
  }
  const channel = query.channel?.trim() || null;
  if (channel !== null && !CHANNELS.includes(channel as GrowthChannel)) {
    errors.push({ field: 'channel', message: `Kênh là ${CHANNELS.join(', ')}` });
  }
  return {
    roundId,
    month,
    orgUnitId: optionalUuid(query, 'org_unit_id', errors),
    gender: gender as ChildGender | null,
    channel: channel as GrowthChannel | null,
  };
}

// Số thập phân trong khoảng, chấp nhận dấu phẩy thập phân; trống trả null
export function parseMeasure(
  text: string,
  range: { minimum: number; maximum: number },
  digits: number,
): number | null | undefined {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') {
    return null;
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < range.minimum || value > range.maximum) {
    return undefined;
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

interface RoundRecord {
  id: string;
  org_unit_id: string;
  name: string;
  measured_on: string;
  note: string | null;
}

@Injectable()
export class GrowthService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: HealthAccess,
    private readonly reports: ReportsService,
    private readonly clock: Clock,
  ) {}

  private today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  // Người xem được số đo của đơn vị: vai trò văn phòng được xem sức khỏe, y tế của đơn vị, người xem báo cáo cân đo
  private async canReadUnit(currentUser: CurrentUser, orgUnitId: string): Promise<boolean> {
    if (await this.access.officeCanAccess(currentUser, orgUnitId)) {
      return true;
    }
    if (await this.access.canWriteUnit(currentUser, PERMISSION_CODES.healthManage, orgUnitId)) {
      return true;
    }
    const scope = await this.access.officeUnitScope(currentUser, PERMISSION_CODES.growthReport);
    return scope.wholeSchool || scope.orgUnitIds.includes(orgUnitId);
  }

  private async homeroomClassIds(database: Kysely<SchoolYearDatabase>, currentUser: CurrentUser, orgUnitId: string) {
    const rows = await database
      .selectFrom('class_staff_assignments')
      .innerJoin('classes', 'classes.id', 'class_staff_assignments.class_id')
      .select('classes.id')
      .where('class_staff_assignments.staff_user_id', '=', currentUser.id)
      .where('class_staff_assignments.assignment_role', '=', 'homeroom')
      .where('class_staff_assignments.status', '=', 'active')
      .where('classes.org_unit_id', '=', orgUnitId)
      .execute();
    return rows.map((row) => row.id);
  }

  private async findRound(database: Kysely<SchoolYearDatabase>, roundId: string): Promise<RoundRecord> {
    const round = await database
      .selectFrom('growth_rounds')
      .select(['id', 'org_unit_id', 'name', 'measured_on', 'note'])
      .where('id', '=', roundId)
      .executeTakeFirst();
    if (!round) {
      throw notFoundError('Không tìm thấy đợt cân đo', 'growth_round');
    }
    return round;
  }

  async listRounds(currentUser: CurrentUser, orgUnitId: string) {
    const { database } = await this.currentSchoolYear.require();
    if (
      !(await this.canReadUnit(currentUser, orgUnitId)) &&
      (await this.homeroomClassIds(database, currentUser, orgUnitId)).length === 0
    ) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không được xem số đo của đơn vị này');
    }
    const rounds = await database
      .selectFrom('growth_rounds')
      .leftJoin('health_measurements', 'health_measurements.growth_round_id', 'growth_rounds.id')
      .select(['growth_rounds.id', 'growth_rounds.name', 'growth_rounds.measured_on', 'growth_rounds.note'])
      .select((expression) => expression.fn.count<string>('health_measurements.id').as('measurement_count'))
      .where('growth_rounds.org_unit_id', '=', orgUnitId)
      .groupBy('growth_rounds.id')
      .orderBy('growth_rounds.measured_on', 'desc')
      .execute();
    const canManage = await this.access.canWriteUnit(currentUser, PERMISSION_CODES.healthManage, orgUnitId);
    return rounds.map((round) => ({
      ...round,
      org_unit_id: orgUnitId,
      measurement_count: Number(round.measurement_count),
      can_manage: canManage,
    }));
  }

  async createRound(
    currentUser: CurrentUser,
    input: { org_unit_id: string; name: string; measured_on: string; note: string | null },
    origin: ChangeOrigin,
  ) {
    if (!(await this.access.canWriteUnit(currentUser, PERMISSION_CODES.healthManage, input.org_unit_id))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền lập đợt cân đo cho đơn vị này');
    }
    if (input.measured_on > this.today()) {
      throw validationError([{ field: 'measured_on', message: 'Ngày cân đo không sau hôm nay' }]);
    }
    const { database } = await this.currentSchoolYear.require();
    const duplicate = await database
      .selectFrom('growth_rounds')
      .select('id')
      .where('org_unit_id', '=', input.org_unit_id)
      .where('name', '=', input.name)
      .executeTakeFirst();
    if (duplicate) {
      throw ruleViolationError('YCTD-102', 'Đơn vị đã có đợt cân đo cùng tên');
    }
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('growth_rounds')
        .values({ ...input, created_by: origin.actorUserId })
        .returning(['id', 'org_unit_id', 'name', 'measured_on', 'note'])
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: input.org_unit_id,
        entityName: 'growth_rounds',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  // Xóa đợt lập nhầm khi chưa có số đo nào
  async removeRound(currentUser: CurrentUser, roundId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const round = await this.findRound(database, roundId);
    if (!(await this.access.canWriteUnit(currentUser, PERMISSION_CODES.healthManage, round.org_unit_id))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xóa đợt cân đo của đơn vị này');
    }
    const used = await database
      .selectFrom('health_measurements')
      .select('id')
      .where('growth_round_id', '=', roundId)
      .executeTakeFirst();
    if (used) {
      throw ruleViolationError('YCTD-102', 'Đợt đã có số đo, không xóa được');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('growth_rounds').where('id', '=', roundId).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: round.org_unit_id,
        entityName: 'growth_rounds',
        entityId: roundId,
        action: 'delete',
        before: round,
        after: null,
      });
    });
  }

  // Trẻ đang học trong các lớp của đơn vị vào ngày cân đo kèm số đo của đợt
  private async roundRows(
    database: Kysely<SchoolYearDatabase>,
    rounds: RoundRecord[],
    classIds: string[] | null,
  ): Promise<GrowthChildRow[]> {
    if (rounds.length === 0) {
      return [];
    }
    const gradeLevels = await database.selectFrom('grade_levels').select(['code', 'name', 'order_no']).execute();
    const grades = new Map(gradeLevels.map((grade) => [grade.code, grade]));
    const units = new Map(
      (await database.selectFrom('org_units').select(['id', 'name']).execute()).map((unit) => [unit.id, unit.name]),
    );
    // Mỗi đơn vị lấy ngày của đợt muộn nhất làm ngày xét sĩ số; số đo của trẻ lấy theo đợt muộn nhất có số đo
    const byUnit = new Map<string, RoundRecord[]>();
    for (const round of rounds) {
      byUnit.set(round.org_unit_id, [...(byUnit.get(round.org_unit_id) ?? []), round]);
    }
    const result: GrowthChildRow[] = [];
    for (const [orgUnitId, unitRounds] of byUnit) {
      const sorted = [...unitRounds].sort((a, b) => b.measured_on.localeCompare(a.measured_on));
      const referenceDate = sorted[0]?.measured_on ?? this.today();
      const enrolled = await database
        .selectFrom('class_enrollments')
        .innerJoin('classes', 'classes.id', 'class_enrollments.class_id')
        .innerJoin('children', 'children.id', 'class_enrollments.child_id')
        .select([
          'children.id as child_id',
          'children.full_name',
          'children.dob',
          'children.gender',
          'classes.id as class_id',
          'classes.name as class_name',
          'classes.grade_level',
        ])
        .where('classes.org_unit_id', '=', orgUnitId)
        .$if(classIds !== null, (query) => query.where('classes.id', 'in', nonEmpty(classIds ?? [])))
        .where('class_enrollments.from_date', '<=', referenceDate)
        .where((expression) =>
          expression.or([
            expression('class_enrollments.to_date', 'is', null),
            expression('class_enrollments.to_date', '>', referenceDate),
          ]),
        )
        .orderBy('children.full_name')
        .execute();
      const measurements = await database
        .selectFrom('health_measurements')
        .innerJoin('growth_rounds', 'growth_rounds.id', 'health_measurements.growth_round_id')
        .select([
          'health_measurements.child_id',
          'health_measurements.weight_kg',
          'health_measurements.height_cm',
          'growth_rounds.measured_on',
        ])
        .where(
          'health_measurements.growth_round_id',
          'in',
          sorted.map((round) => round.id),
        )
        .where('health_measurements.child_id', 'in', nonEmpty(enrolled.map((row) => row.child_id)))
        .orderBy('growth_rounds.measured_on', 'desc')
        .execute();
      const latest = new Map<string, (typeof measurements)[number]>();
      for (const row of measurements) {
        if (!latest.has(row.child_id)) {
          latest.set(row.child_id, row);
        }
      }
      for (const child of enrolled) {
        const measurement = latest.get(child.child_id);
        const grade = grades.get(child.grade_level);
        const weight = measurement ? toNumber(measurement.weight_kg) : null;
        const height = measurement ? toNumber(measurement.height_cm) : null;
        result.push({
          child_id: child.child_id,
          full_name: child.full_name,
          dob: child.dob,
          gender: child.gender,
          org_unit_id: orgUnitId,
          org_unit_name: units.get(orgUnitId) ?? '',
          class_id: child.class_id,
          class_name: child.class_name,
          grade_level: child.grade_level,
          grade_name: grade?.name ?? child.grade_level,
          grade_order: grade?.order_no ?? 999,
          measured_on: measurement?.measured_on ?? null,
          weight_kg: weight,
          height_cm: height,
          assessment: measurement
            ? assessGrowth(child, measurement.measured_on, { weight_kg: weight, height_cm: height })
            : null,
        });
      }
    }
    return result;
  }

  // Bảng nhập theo lớp (4.3.1): tháng tuổi, cân nặng, chiều cao, BMI, chỉ số Z và kênh tăng trưởng
  async grid(currentUser: CurrentUser, roundId: string, classId: string) {
    const { database } = await this.currentSchoolYear.require();
    const round = await this.findRound(database, roundId);
    const classRecord = await database
      .selectFrom('classes')
      .select(['id', 'name', 'org_unit_id'])
      .where('id', '=', classId)
      .executeTakeFirst();
    if (!classRecord || classRecord.org_unit_id !== round.org_unit_id) {
      throw notFoundError('Không tìm thấy lớp trong đơn vị của đợt cân đo', 'class');
    }
    if (
      !(await this.canReadUnit(currentUser, round.org_unit_id)) &&
      !(await this.access.isHomeroom(database, currentUser, classId))
    ) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không được xem số đo của lớp này');
    }
    const rows = await this.roundRows(database, [round], [classId]);
    const notes = new Map(
      (
        await database
          .selectFrom('health_measurements')
          .select(['child_id', 'note'])
          .where('growth_round_id', '=', roundId)
          .execute()
      ).map((row) => [row.child_id, row.note]),
    );
    return {
      round,
      class: { id: classRecord.id, name: classRecord.name },
      can_edit: await this.access.canWriteUnit(currentUser, PERMISSION_CODES.healthManage, round.org_unit_id),
      rows: rows.map((row) => ({
        child_id: row.child_id,
        full_name: row.full_name,
        dob: row.dob,
        gender: row.gender,
        weight_kg: row.weight_kg,
        height_cm: row.height_cm,
        note: notes.get(row.child_id) ?? null,
        assessment: row.assessment ?? assessGrowth(row, round.measured_on, { weight_kg: null, height_cm: null }),
      })),
    };
  }

  // Lưu số đo của nhiều trẻ trong đợt; để trống cả cân nặng và chiều cao là xóa số đo của trẻ trong đợt
  async saveMeasurements(currentUser: CurrentUser, roundId: string, inputs: MeasurementInput[], origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const round = await this.findRound(database, roundId);
    if (round.measured_on > this.today()) {
      throw validationError([{ field: 'measured_on', message: 'Chưa đến ngày cân đo' }]);
    }
    const children = new Map<string, { org_unit_id: string; dob: string }>();
    for (const input of inputs) {
      const child = await this.access.assertCanWrite(
        currentUser,
        database,
        input.child_id,
        PERMISSION_CODES.healthManage,
      );
      if (child.org_unit_id !== round.org_unit_id) {
        throw ruleViolationError('YCTD-102', `Trẻ ${child.full_name} không thuộc đơn vị của đợt cân đo`);
      }
      if (child.dob > round.measured_on) {
        throw validationError([{ field: 'child_id', message: `Trẻ ${child.full_name} sinh sau ngày cân đo` }]);
      }
      children.set(input.child_id, child);
    }
    return database.transaction().execute(async (transaction) => {
      let saved = 0;
      let removed = 0;
      for (const input of inputs) {
        const result = await this.saveOne(transaction, round, input, origin);
        saved += result === 'saved' ? 1 : 0;
        removed += result === 'removed' ? 1 : 0;
      }
      return { saved_count: saved, removed_count: removed };
    });
  }

  private async saveOne(
    transaction: Transaction<SchoolYearDatabase>,
    round: RoundRecord,
    input: MeasurementInput,
    origin: ChangeOrigin,
  ): Promise<'saved' | 'removed' | 'unchanged'> {
    const existing = await transaction
      .selectFrom('health_measurements')
      .select(['id', 'measured_on', 'weight_kg', 'height_cm', 'note'])
      .where('growth_round_id', '=', round.id)
      .where('child_id', '=', input.child_id)
      .executeTakeFirst();
    const audit = (entityId: string, action: 'create' | 'update' | 'delete', before: unknown, after: unknown) =>
      writeAuditLog(transaction, {
        origin,
        orgUnitId: round.org_unit_id,
        entityName: 'health_measurements',
        entityId,
        action,
        before,
        after,
      });
    if (input.weight_kg === null && input.height_cm === null) {
      if (!existing) {
        return 'unchanged';
      }
      await transaction.deleteFrom('health_measurements').where('id', '=', existing.id).execute();
      await audit(existing.id, 'delete', existing, null);
      return 'removed';
    }
    const values = { weight_kg: input.weight_kg, height_cm: input.height_cm, note: input.note };
    if (existing) {
      const updated = await transaction
        .updateTable('health_measurements')
        .set({ ...values, measured_on: round.measured_on, recorded_by: origin.actorUserId })
        .where('id', '=', existing.id)
        .returning(['id', 'measured_on', 'weight_kg', 'height_cm', 'note'])
        .executeTakeFirstOrThrow();
      await audit(existing.id, 'update', existing, updated);
      return 'saved';
    }
    const created = await transaction
      .insertInto('health_measurements')
      .values({
        child_id: input.child_id,
        measured_on: round.measured_on,
        growth_round_id: round.id,
        ...values,
        vision_left: null,
        vision_right: null,
        recorded_by: origin.actorUserId,
      })
      .returning(['id', 'measured_on', 'weight_kg', 'height_cm', 'note'])
      .executeTakeFirstOrThrow();
    await audit(created.id, 'create', null, created);
    return 'saved';
  }

  // Tệp mẫu nhập số đo của một lớp, có sẵn danh sách trẻ và số đo đã nhập
  async template(currentUser: CurrentUser, roundId: string, classId: string) {
    const grid = await this.grid(currentUser, roundId, classId);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Cân đo');
    sheet.addRow(GROWTH_IMPORT_COLUMNS.map((column) => column.header));
    sheet.getRow(1).font = { bold: true };
    for (const row of grid.rows) {
      sheet.addRow([
        row.child_id,
        row.full_name,
        row.dob,
        grid.class.name,
        row.weight_kg ?? '',
        row.height_cm ?? '',
        row.note ?? '',
      ]);
    }
    sheet.columns.forEach((column, index) => {
      column.width = index === 0 ? 38 : 20;
    });
    const guide = workbook.addWorksheet('Hướng dẫn');
    guide.addRow(['Cột', 'Cách ghi']);
    guide.getRow(1).font = { bold: true };
    guide.addRow(['Đợt cân đo', `${grid.round.name}, ngày ${grid.round.measured_on}`]);
    for (const column of GROWTH_IMPORT_COLUMNS) {
      guide.addRow([column.header, column.note]);
    }
    guide.getColumn(1).width = 32;
    guide.getColumn(2).width = 90;
    return {
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
      fileName: `can-do-${grid.round.measured_on}.xlsx`,
    };
  }

  // Nhập số đo từ Excel: kiểm tra cả tệp, có lỗi thì không lưu dòng nào
  async importFile(currentUser: CurrentUser, roundId: string, body: Buffer, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const round = await this.findRound(database, roundId);
    if (!(await this.access.canWriteUnit(currentUser, PERMISSION_CODES.healthManage, round.org_unit_id))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền nhập số đo cho đơn vị này');
    }
    const sheetRows = await readSheet(body, GROWTH_IMPORT_COLUMNS);
    const candidates = await this.roundRows(database, [round], null);
    const byId = new Map(candidates.map((row) => [row.child_id, row]));
    const errors: RowError[] = [];
    const inputs: MeasurementInput[] = [];
    const seen = new Set<string>();
    for (const { row, values } of sheetRows) {
      let child: GrowthChildRow | undefined;
      if (values.child_id) {
        child = byId.get(values.child_id);
        if (!child) {
          errors.push({ row, column: 'Mã học sinh trên hệ thống', message: 'Không có học sinh này trong đơn vị' });
          continue;
        }
      } else {
        const dob = parseDate(values.dob ?? '');
        const matches = candidates.filter(
          (candidate) => foldText(candidate.full_name) === foldText(values.full_name ?? '') && candidate.dob === dob,
        );
        if (matches.length !== 1) {
          errors.push({
            row,
            column: 'Họ tên',
            message: matches.length === 0 ? 'Không tìm thấy học sinh theo họ tên và ngày sinh' : 'Trùng nhiều học sinh',
          });
          continue;
        }
        child = matches[0];
      }
      if (!child) {
        continue;
      }
      if (seen.has(child.child_id)) {
        errors.push({ row, column: null, message: 'Học sinh xuất hiện nhiều lần trong tệp' });
        continue;
      }
      seen.add(child.child_id);
      const weight = parseMeasure(values.weight_kg ?? '', WEIGHT_RANGE, 2);
      const height = parseMeasure(values.height_cm ?? '', HEIGHT_RANGE, 1);
      if (weight === undefined) {
        errors.push({ row, column: 'Cân nặng (kg)', message: 'Cân nặng là số từ 1 đến 150' });
      }
      if (height === undefined) {
        errors.push({ row, column: 'Chiều cao (cm)', message: 'Chiều cao là số từ 30 đến 200' });
      }
      const note = (values.note ?? '').trim();
      if (note.length > 1000) {
        errors.push({ row, column: 'Ghi chú', message: 'Tối đa 1000 ký tự' });
      }
      if (weight === undefined || height === undefined) {
        continue;
      }
      // Dòng để trống cả hai số đo được bỏ qua, không xóa số đã nhập
      if (weight !== null || height !== null) {
        inputs.push({ child_id: child.child_id, weight_kg: weight, height_cm: height, note: note || null });
      }
    }
    if (errors.length > 0) {
      return { saved_count: 0, removed_count: 0, errors };
    }
    const result = await this.saveMeasurements(currentUser, roundId, inputs, origin);
    return { ...result, errors: [] as RowError[] };
  }

  // Biểu đồ tăng trưởng của một trẻ: các lần đo (số đo sức khỏe, kết quả đợt khám) và đường chuẩn WHO
  async childGrowth(currentUser: CurrentUser, childId: string) {
    const { database } = await this.currentSchoolYear.require();
    const child = await this.access.assertCanRead(currentUser, database, childId);
    const measurements = await database
      .selectFrom('health_measurements')
      .select(['measured_on', 'weight_kg', 'height_cm', 'growth_round_id'])
      .where('child_id', '=', childId)
      .where((expression) =>
        expression.or([expression('weight_kg', 'is not', null), expression('height_cm', 'is not', null)]),
      )
      .execute();
    const results = await database
      .selectFrom('health_check_results')
      .innerJoin('health_check_campaigns', 'health_check_campaigns.id', 'health_check_results.campaign_id')
      .select([
        'health_check_campaigns.to_date as measured_on',
        'health_check_results.weight_kg',
        'health_check_results.height_cm',
        'health_check_results.published_at',
      ])
      .where('health_check_results.child_id', '=', childId)
      .where((expression) =>
        expression.or([
          expression('health_check_results.weight_kg', 'is not', null),
          expression('health_check_results.height_cm', 'is not', null),
        ]),
      )
      .execute();
    const isGuardianOnly =
      !(await this.canReadUnit(currentUser, child.org_unit_id)) &&
      !(await this.access.isHomeroom(database, currentUser, child.class_id));
    const points = [
      ...measurements.map((row) => ({
        measured_on: row.measured_on,
        source: row.growth_round_id ? ('growth_round' as const) : ('measurement' as const),
        weight_kg: toNumber(row.weight_kg),
        height_cm: toNumber(row.height_cm),
      })),
      // Phụ huynh chỉ thấy kết quả khám đã công bố (BR-69)
      ...results
        .filter((row) => !isGuardianOnly || row.published_at !== null)
        .map((row) => ({
          measured_on: row.measured_on,
          source: 'health_check' as const,
          weight_kg: toNumber(row.weight_kg),
          height_cm: toNumber(row.height_cm),
        })),
    ]
      .filter((point) => point.measured_on >= child.dob)
      .sort((a, b) => a.measured_on.localeCompare(b.measured_on))
      .map((point) => ({ ...point, assessment: assessGrowth(child, point.measured_on, point) }));
    const months = points.map((point) => point.assessment.age_months);
    const fromMonth = Math.max(0, Math.min(...months, 36) - 6);
    const toMonth = Math.max(...months, fromMonth + 12) + 6;
    return {
      child: { id: child.id, full_name: child.full_name, dob: child.dob, gender: child.gender },
      points,
      curves: {
        weight_for_age: referenceCurve('weight_for_age', child.gender, fromMonth, toMonth),
        height_for_age: referenceCurve('height_for_age', child.gender, fromMonth, toMonth),
      },
    };
  }

  // Tổng hợp theo lớp, khối, đơn vị (4.3.2): một đợt, hoặc mọi đợt trong tháng của các đơn vị trong phạm vi
  async report(currentUser: CurrentUser, filter: GrowthReportFilter) {
    const scope = await this.reports.unitScope(currentUser, PERMISSION_CODES.growthReport, filter.orgUnitId, false);
    const { database } = await this.currentSchoolYear.require();
    let rounds: RoundRecord[];
    if (filter.roundId) {
      const round = await this.findRound(database, filter.roundId);
      if (!scope.orgUnitIds.includes(round.org_unit_id)) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Đợt cân đo nằm ngoài phạm vi của bạn');
      }
      rounds = [round];
    } else {
      const month = filter.month ?? '';
      const [year = 0, monthNumber = 0] = month.split('-').map(Number);
      const nextMonth =
        monthNumber === 12 ? `${year + 1}-01-01` : `${year}-${String(monthNumber + 1).padStart(2, '0')}-01`;
      rounds = await database
        .selectFrom('growth_rounds')
        .select(['id', 'org_unit_id', 'name', 'measured_on', 'note'])
        .where('org_unit_id', 'in', scope.orgUnitIds)
        .where('measured_on', '>=', `${month}-01`)
        .where('measured_on', '<', nextMonth)
        .execute();
    }
    const rows = applyUnderweightOption(
      await this.roundRows(database, rounds, null),
      await this.underweightWeightForHeight(database),
    );
    const summary = summarizeGrowth(rows, filter.gender);
    const children = summary.children
      .filter((row) => !filter.channel || inChannel(row, filter.channel))
      .map((row) => flattenChild(row));
    return {
      rounds,
      gender: filter.gender,
      channel: filter.channel,
      classes: summary.classes,
      grades: summary.grades,
      units: summary.units,
      totals: summary.totals,
      children,
    };
  }

  // Ô tính cân nặng/chiều cao cho trẻ nhẹ cân ở 1.4 Cấu hình trường của Trường chính (DT-16 phần 16e), chưa đặt là bật
  private async underweightWeightForHeight(database: Kysely<SchoolYearDatabase>): Promise<boolean> {
    const setting = await database
      .selectFrom('settings')
      .innerJoin('org_units', 'org_units.id', 'settings.org_unit_id')
      .select('settings.value')
      .where('org_units.unit_type', '=', 'truong_chinh')
      .where('settings.key', '=', 'underweight_growth_calculation')
      .executeTakeFirst();
    return setting?.value !== false;
  }

  // Xuất tổng hợp ra Excel (4.3.2): bảng theo lớp, theo khối và danh sách học sinh theo kênh đang lọc; ghi nhật ký xuất có
  // dữ liệu cá nhân (BR-74)
  async exportReport(currentUser: CurrentUser, filter: GrowthReportFilter, query: QueryValues, ip: string | null) {
    const report = await this.report(currentUser, filter);
    const workbook = new ExcelJS.Workbook();
    const addSheet = (title: string, columns: Array<[string, string]>, rows: Array<Record<string, unknown>>) => {
      const sheet = workbook.addWorksheet(title);
      sheet.addRow(columns.map(([, label]) => label));
      sheet.getRow(1).font = { bold: true };
      for (const row of rows) {
        sheet.addRow(
          columns.map(([key]) => {
            const value = row[key];
            return typeof value === 'string' && key.endsWith('_status')
              ? (GROWTH_STATUS_LABELS[value] ?? value)
              : (value ?? '');
          }),
        );
      }
      sheet.columns.forEach((column) => {
        column.width = 18;
      });
    };
    addSheet(
      'Theo lớp',
      [['org_unit_name', 'Đơn vị'], ['grade_name', 'Khối'], ['class_name', 'Lớp'], ...SUMMARY_COLUMNS],
      report.classes,
    );
    addSheet(
      'Theo khối',
      [['grade_name', 'Khối'], ['class_count', 'Số lớp'], ...SUMMARY_COLUMNS],
      [...report.grades, { grade_name: 'Tổng cộng', class_count: report.classes.length, ...report.totals }],
    );
    addSheet('Danh sách học sinh', CHILD_COLUMNS, report.children);
    const fileName = `tong-hop-can-do-${filter.month ?? report.rounds[0]?.measured_on ?? 'dot'}.xlsx`;
    const { database } = await this.currentSchoolYear.require();
    const log = await database
      .insertInto('export_logs')
      .values({
        user_id: currentUser.id,
        actor_name: currentUser.description.full_name,
        report_code: 'growth',
        filters_data: JSON.stringify(query),
        org_unit_ids: [...new Set(report.rounds.map((round) => round.org_unit_id))],
        row_count: report.children.length,
        contains_personal_data: true,
        file_name: fileName,
        ip_address: ip,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return { buffer: Buffer.from(await workbook.xlsx.writeBuffer()), fileName, logId: log.id };
  }
}

const SUMMARY_COLUMNS: Array<[string, string]> = [
  ['enrolled', 'Số học sinh'],
  ['enrolled_female', 'Trong đó nữ'],
  ['measured', 'Được cân đo'],
  ['measured_percent', 'Tỷ lệ cân đo (%)'],
  ['weight_normal', 'Cân nặng bình thường'],
  ['underweight', 'SDD thể nhẹ cân'],
  ['underweight_female', 'SDD nhẹ cân: nữ'],
  ['underweight_percent', 'SDD nhẹ cân (%)'],
  ['above_age', 'Cân nặng cao hơn tuổi'],
  ['above_age_percent', 'Cao hơn tuổi (%)'],
  ['height_normal', 'Chiều cao bình thường'],
  ['stunted', 'SDD thể thấp còi'],
  ['stunted_female', 'SDD thấp còi: nữ'],
  ['stunted_percent', 'SDD thấp còi (%)'],
  ['weight_height_normal', 'Cân nặng theo chiều cao bình thường'],
  ['wasted', 'SDD thể gầy còm'],
  ['wasted_percent', 'SDD gầy còm (%)'],
  ['overweight', 'Thừa cân'],
  ['overweight_percent', 'Thừa cân (%)'],
  ['obese', 'Béo phì'],
  ['obese_female', 'Béo phì: nữ'],
  ['obese_percent', 'Béo phì (%)'],
  ['all_normal', 'Phát triển bình thường cả ba kênh'],
];

const CHILD_COLUMNS: Array<[string, string]> = [
  ['org_unit_name', 'Đơn vị'],
  ['class_name', 'Lớp'],
  ['full_name', 'Họ tên'],
  ['dob', 'Ngày sinh'],
  ['gender_label', 'Giới tính'],
  ['measured_on', 'Ngày cân đo'],
  ['age_months', 'Tháng tuổi'],
  ['weight_kg', 'Cân nặng (kg)'],
  ['height_cm', 'Chiều cao (cm)'],
  ['bmi', 'BMI'],
  ['weight_for_age_z', 'Z cân nặng theo tuổi'],
  ['height_for_age_z', 'Z chiều cao theo tuổi'],
  ['weight_for_height_z', 'Z cân nặng theo chiều cao'],
  ['bmi_for_age_z', 'Z BMI theo tuổi'],
  ['weight_status', 'Kênh cân nặng'],
  ['height_status', 'Kênh chiều cao'],
  ['weight_height_status', 'Kênh cân nặng theo chiều cao'],
];

export function flattenChild(row: GrowthChildRow) {
  const assessment: Partial<GrowthAssessment> = row.assessment ?? {};
  return {
    child_id: row.child_id,
    full_name: row.full_name,
    dob: row.dob,
    gender: row.gender,
    class_name: row.class_name,
    grade_name: row.grade_name,
    org_unit_name: row.org_unit_name,
    gender_label: row.gender === 'female' ? 'Nữ' : 'Nam',
    measured_on: row.measured_on,
    age_months: assessment.age_months ?? null,
    weight_kg: row.weight_kg,
    height_cm: row.height_cm,
    bmi: assessment.bmi ?? null,
    weight_for_age_z: assessment.weight_for_age_z ?? null,
    height_for_age_z: assessment.height_for_age_z ?? null,
    weight_for_height_z: assessment.weight_for_height_z ?? null,
    bmi_for_age_z: assessment.bmi_for_age_z ?? null,
    weight_status: assessment.weight_status ?? null,
    height_status: assessment.height_status ?? null,
    weight_height_status: assessment.weight_height_status ?? null,
  };
}

export type GrowthReport = Awaited<ReturnType<GrowthService['report']>>;

interface UploadedPart {
  originalname: string;
  size: number;
  buffer: Buffer;
}

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function readMeasurementRows(body: RequestBody, errors: FieldError[]): MeasurementInput[] {
  const raw = body?.rows;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 500) {
    errors.push({ field: 'rows', message: 'Danh sách số đo từ 1 đến 500 dòng' });
    return [];
  }
  const seen = new Set<string>();
  return raw.map((item: unknown, index) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const field = (name: string) => `rows[${index}].${name}`;
    const childId = row.child_id;
    if (!isUuid(childId) || seen.has(childId)) {
      errors.push({ field: field('child_id'), message: 'Mã trẻ không hợp lệ hoặc bị lặp' });
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
    return {
      child_id: isUuid(childId) ? childId : NO_ID,
      weight_kg: measure('weight_kg', WEIGHT_RANGE, 2, 'Cân nặng (kg)'),
      height_cm: measure('height_cm', HEIGHT_RANGE, 1, 'Chiều cao (cm)'),
      note: readNote(row, 'note', errors),
    };
  });
}

@Controller()
export class GrowthController {
  constructor(private readonly growth: GrowthService) {}

  @Get('growth-rounds')
  listRounds(@Query('org_unit_id') orgUnitId: unknown, @AuthenticatedUser() currentUser: CurrentUser) {
    if (!isUuid(orgUnitId)) {
      throw validationError([{ field: 'org_unit_id', message: 'Chọn đơn vị' }]);
    }
    return this.growth.listRounds(currentUser, orgUnitId);
  }

  @Post('growth-rounds')
  @HttpCode(201)
  createRound(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      org_unit_id: readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị'),
      name: readNote(body, 'name', errors, true) ?? '',
      measured_on: readHealthDate(body, 'measured_on', errors, true) ?? '',
      note: readNote(body, 'note', errors),
    };
    check(errors);
    return this.growth.createRound(currentUser, input, originOf(request, currentUser));
  }

  @Delete('growth-rounds/:id')
  @HttpCode(204)
  async removeRound(
    @Param('id', uuidParameter('Mã đợt cân đo không hợp lệ')) roundId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    await this.growth.removeRound(currentUser, roundId, originOf(request, currentUser));
  }

  @Get('growth-rounds/:id/measurements')
  grid(
    @Param('id', uuidParameter('Mã đợt cân đo không hợp lệ')) roundId: string,
    @Query('class_id') classId: unknown,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!isUuid(classId)) {
      throw validationError([{ field: 'class_id', message: 'Chọn lớp' }]);
    }
    return this.growth.grid(currentUser, roundId, classId);
  }

  @Put('growth-rounds/:id/measurements')
  save(
    @Param('id', uuidParameter('Mã đợt cân đo không hợp lệ')) roundId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const rows = readMeasurementRows(body, errors);
    check(errors);
    return this.growth.saveMeasurements(currentUser, roundId, rows, originOf(request, currentUser));
  }

  @Get('growth-rounds/:id/template')
  async template(
    @Param('id', uuidParameter('Mã đợt cân đo không hợp lệ')) roundId: string,
    @Query('class_id') classId: unknown,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!isUuid(classId)) {
      throw validationError([{ field: 'class_id', message: 'Chọn lớp' }]);
    }
    const file = await this.growth.template(currentUser, roundId, classId);
    response.setHeader('content-type', XLSX_TYPE);
    response.setHeader('content-disposition', `attachment; filename="${file.fileName}"`);
    response.send(file.buffer);
  }

  @Post('growth-rounds/:id/import')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_IMPORT_BYTES, files: 1 } }))
  importFile(
    @Param('id', uuidParameter('Mã đợt cân đo không hợp lệ')) roundId: string,
    @UploadedFile() file: UploadedPart | undefined,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!file || file.size === 0) {
      throw validationError([{ field: 'file', message: 'Bắt buộc chọn tệp' }]);
    }
    return this.growth.importFile(currentUser, roundId, file.buffer, originOf(request, currentUser));
  }

  @Get('children/:id/growth')
  childGrowth(
    @Param('id', uuidParameter('Mã trẻ không hợp lệ')) childId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.growth.childGrowth(currentUser, childId);
  }

  @Get('reports/growth')
  report(@Query() query: QueryValues, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const filter = readGrowthReportFilter(query, errors);
    check(errors);
    return this.growth.report(currentUser, filter);
  }

  @Get('reports/growth/export')
  async exportReport(
    @Query() query: QueryValues,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const filter = readGrowthReportFilter(query, errors);
    check(errors);
    const file = await this.growth.exportReport(currentUser, filter, query, request.ip ?? null);
    response.setHeader('content-type', XLSX_TYPE);
    response.setHeader('content-disposition', `attachment; filename="${file.fileName}"`);
    response.setHeader('x-export-log-id', file.logId);
    response.setHeader('cache-control', 'no-store');
    response.send(file.buffer);
  }
}
