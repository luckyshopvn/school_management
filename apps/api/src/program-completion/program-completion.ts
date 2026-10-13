import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Put, Query, Req, Res } from '@nestjs/common';
import type { ProgramCompletionResult, SchoolYearDatabase } from '@school-management/database';
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
import { sql, type Kysely } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser, OrganizationScope } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { isUuid, notFoundError, readRequiredUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { TeachingAccess } from '../teaching/teaching-access.js';

// Quản lý hoàn thành chương trình giáo dục mầm non (YCTD-102, theo mục 4.4 hệ thống của Sở GD&ĐT TP.HCM): cuối năm học
// trường ghi cho từng trẻ của lớp mẫu giáo 5-6 tuổi (bậc học có tháng tuổi bắt đầu từ 60) kết quả Hoàn thành hoặc Chưa
// hoàn thành chương trình kèm ghi chú. Giáo viên chủ nhiệm ghi cho lớp mình, quản lý đơn vị ghi cho lớp trong đơn vị; Ban
// Giám hiệu xác nhận danh sách của lớp khi mọi trẻ đang học đã có kết quả, đã xác nhận thì khóa, hủy xác nhận phải ghi lý do.
// Thống kê số trẻ hoàn thành, tỷ lệ theo lớp và đơn vị; xuất danh sách ra Excel có ghi nhật ký xuất (BR-74)
type Executor = Kysely<SchoolYearDatabase>;

export const ELIGIBLE_MINIMUM_MONTHS = 60;
export const COMPLETION_RULE = 'YCTD-102';
const RESULTS: ProgramCompletionResult[] = ['completed', 'not_completed'];
const RESULT_LABELS: Record<ProgramCompletionResult, string> = {
  completed: 'Hoàn thành',
  not_completed: 'Chưa hoàn thành',
};
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MAXIMUM_NOTE = 500;
const MAXIMUM_ITEMS = 200;

interface CompletionItem {
  childId: string;
  result: ProgramCompletionResult;
  note: string | null;
}

interface EligibleClass {
  id: string;
  org_unit_id: string;
  org_unit_name: string;
  code: string;
  name: string;
  grade_level: string;
  grade_level_name: string;
}

// Tỷ lệ hoàn thành theo phần trăm, làm tròn 2 chữ số; lớp chưa có trẻ là 0
export function completionRate(completed: number, total: number): number {
  return total === 0 ? 0 : Math.round((completed / total) * 10_000) / 100;
}

@Injectable()
export class ProgramCompletionService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: TeachingAccess,
    private readonly clock: Clock,
  ) {}

  // Phạm vi đọc: vai trò văn phòng có quyền ghi hoặc xác nhận theo đơn vị; giáo viên có quyền ghi thấy lớp chủ nhiệm
  private async readScope(currentUser: CurrentUser, database: Executor) {
    const [manage, approve] = await Promise.all([
      this.access.officeScope(currentUser, PERMISSION_CODES.programCompletionManage),
      this.access.officeScope(currentUser, PERMISSION_CODES.programCompletionApprove),
    ]);
    const office: OrganizationScope =
      manage.wholeSchool || approve.wholeSchool
        ? { wholeSchool: true, orgUnitIds: [] }
        : { wholeSchool: false, orgUnitIds: [...new Set([...manage.orgUnitIds, ...approve.orgUnitIds])] };
    let classIds: string[] = [];
    if (currentUser.hasPermission(PERMISSION_CODES.programCompletionManage) && this.access.isTeacher(currentUser)) {
      classIds = (
        await database
          .selectFrom('class_staff_assignments')
          .select('class_id')
          .where('staff_user_id', '=', currentUser.id)
          .where('assignment_role', '=', 'homeroom')
          .where('status', '=', 'active')
          .execute()
      ).map((row) => row.class_id);
    }
    return { office, classIds };
  }

  private eligibleClasses(database: Executor) {
    return database
      .selectFrom('classes')
      .innerJoin('grade_levels', 'grade_levels.code', 'classes.grade_level')
      .innerJoin('org_units', 'org_units.id', 'classes.org_unit_id')
      .select([
        'classes.id',
        'classes.org_unit_id',
        'org_units.name as org_unit_name',
        'classes.code',
        'classes.name',
        'classes.grade_level',
        'grade_levels.name as grade_level_name',
      ])
      .where('grade_levels.age_from_months', '>=', ELIGIBLE_MINIMUM_MONTHS)
      .orderBy('org_units.code')
      .orderBy('classes.name');
  }

  private async visibleClasses(currentUser: CurrentUser, database: Executor, orgUnitId: string | null) {
    const { office, classIds } = await this.readScope(currentUser, database);
    if (!office.wholeSchool && office.orgUnitIds.length === 0 && classIds.length === 0) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem kết quả hoàn thành chương trình');
    }
    let query = this.eligibleClasses(database);
    if (!office.wholeSchool) {
      const unitIds = office.orgUnitIds;
      query = query.where((expression) =>
        expression.or([
          ...(unitIds.length ? [expression('classes.org_unit_id', 'in', unitIds)] : []),
          ...(classIds.length ? [expression('classes.id', 'in', classIds)] : []),
        ]),
      );
    }
    if (orgUnitId) {
      query = query.where('classes.org_unit_id', '=', orgUnitId);
    }
    return query.execute();
  }

  // Số trẻ đang học (trạng thái đang học, lớp hiện tại), số hoàn thành, chưa hoàn thành, chưa ghi; trạng thái xác nhận
  private async summaries(database: Executor, classes: EligibleClass[]) {
    if (classes.length === 0) {
      return [];
    }
    const ids = classes.map((row) => row.id);
    const counts = await database
      .selectFrom('class_enrollments')
      .innerJoin('children', 'children.id', 'class_enrollments.child_id')
      .leftJoin('program_completions', 'program_completions.child_id', 'children.id')
      .select([
        'class_enrollments.class_id',
        sql<string>`count(*)`.as('children_count'),
        sql<string>`count(*) filter (where program_completions.result = 'completed')`.as('completed_count'),
        sql<string>`count(*) filter (where program_completions.result = 'not_completed')`.as('not_completed_count'),
      ])
      .where('class_enrollments.is_current', '=', true)
      .where('children.status', '=', 'active')
      .where('class_enrollments.class_id', 'in', ids)
      .groupBy('class_enrollments.class_id')
      .execute();
    const confirmations = await database
      .selectFrom('program_completion_confirmations')
      .selectAll()
      .where('class_id', 'in', ids)
      .execute();
    return classes.map((row) => {
      const count = counts.find((entry) => entry.class_id === row.id);
      const childrenCount = Number(count?.children_count ?? 0);
      const completed = Number(count?.completed_count ?? 0);
      const notCompleted = Number(count?.not_completed_count ?? 0);
      const confirmation = confirmations.find((entry) => entry.class_id === row.id);
      return {
        ...row,
        children_count: childrenCount,
        completed_count: completed,
        not_completed_count: notCompleted,
        unmarked_count: childrenCount - completed - notCompleted,
        completion_rate: completionRate(completed, childrenCount),
        confirmed: confirmation !== undefined,
        confirmed_by_name: confirmation?.confirmed_by_name ?? null,
        confirmed_at: confirmation?.confirmed_at ?? null,
      };
    });
  }

  async listClasses(currentUser: CurrentUser, orgUnitId: string | null) {
    const { database } = await this.currentSchoolYear.require();
    return this.summaries(database, await this.visibleClasses(currentUser, database, orgUnitId));
  }

  // Thống kê theo đơn vị và toàn bộ phạm vi
  async statistics(currentUser: CurrentUser, orgUnitId: string | null) {
    const classes = await this.listClasses(currentUser, orgUnitId);
    const units = new Map<
      string,
      {
        org_unit_id: string;
        org_unit_name: string;
        class_count: number;
        confirmed_class_count: number;
        children_count: number;
        completed_count: number;
        not_completed_count: number;
        unmarked_count: number;
        completion_rate: number;
      }
    >();
    for (const row of classes) {
      const unit = units.get(row.org_unit_id) ?? {
        org_unit_id: row.org_unit_id,
        org_unit_name: row.org_unit_name,
        class_count: 0,
        confirmed_class_count: 0,
        children_count: 0,
        completed_count: 0,
        not_completed_count: 0,
        unmarked_count: 0,
        completion_rate: 0,
      };
      unit.class_count += 1;
      unit.confirmed_class_count += row.confirmed ? 1 : 0;
      unit.children_count += row.children_count;
      unit.completed_count += row.completed_count;
      unit.not_completed_count += row.not_completed_count;
      unit.unmarked_count += row.unmarked_count;
      unit.completion_rate = completionRate(unit.completed_count, unit.children_count);
      units.set(row.org_unit_id, unit);
    }
    const children = classes.reduce((sum, row) => sum + row.children_count, 0);
    const completed = classes.reduce((sum, row) => sum + row.completed_count, 0);
    return {
      classes,
      units: [...units.values()],
      total: {
        class_count: classes.length,
        children_count: children,
        completed_count: completed,
        not_completed_count: classes.reduce((sum, row) => sum + row.not_completed_count, 0),
        unmarked_count: classes.reduce((sum, row) => sum + row.unmarked_count, 0),
        completion_rate: completionRate(completed, children),
      },
    };
  }

  private async eligibleClass(database: Executor, classId: string): Promise<EligibleClass> {
    const found = await this.eligibleClasses(database).where('classes.id', '=', classId).executeTakeFirst();
    if (!found) {
      const exists = await database.selectFrom('classes').select('id').where('id', '=', classId).executeTakeFirst();
      if (!exists) {
        throw notFoundError('Không tìm thấy lớp', 'class');
      }
      throw ruleViolationError(COMPLETION_RULE, 'Chỉ ghi hoàn thành chương trình cho lớp mẫu giáo 5-6 tuổi');
    }
    return found;
  }

  private async assertCanRead(currentUser: CurrentUser, database: Executor, found: EligibleClass) {
    const { office, classIds } = await this.readScope(currentUser, database);
    if (!this.access.inScope(office, found.org_unit_id) && !classIds.includes(found.id)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Lớp này nằm ngoài phạm vi của bạn');
    }
  }

  private async canManage(currentUser: CurrentUser, database: Executor, found: EligibleClass) {
    if (
      this.access.inScope(
        await this.access.officeScope(currentUser, PERMISSION_CODES.programCompletionManage),
        found.org_unit_id,
      )
    ) {
      return true;
    }
    return (
      currentUser.hasPermission(PERMISSION_CODES.programCompletionManage) &&
      this.access.isTeacher(currentUser) &&
      this.access.assignmentOf(database, currentUser, found.id, true)
    );
  }

  private async canApprove(currentUser: CurrentUser, found: EligibleClass) {
    return this.access.inScope(
      await this.access.officeScope(currentUser, PERMISSION_CODES.programCompletionApprove),
      found.org_unit_id,
    );
  }

  private childrenOf(database: Executor, classId: string) {
    return database
      .selectFrom('class_enrollments')
      .innerJoin('children', 'children.id', 'class_enrollments.child_id')
      .leftJoin('program_completions', 'program_completions.child_id', 'children.id')
      .select([
        'children.id as child_id',
        'children.full_name',
        'children.dob',
        'children.gender',
        'program_completions.result',
        'program_completions.note',
        'program_completions.recorded_by_name',
        'program_completions.updated_at',
      ])
      .where('class_enrollments.class_id', '=', classId)
      .where('class_enrollments.is_current', '=', true)
      .where('children.status', '=', 'active')
      .orderBy('children.full_name')
      .execute();
  }

  async readClass(currentUser: CurrentUser, classId: string) {
    const { database } = await this.currentSchoolYear.require();
    const found = await this.eligibleClass(database, classId);
    await this.assertCanRead(currentUser, database, found);
    const [summary] = await this.summaries(database, [found]);
    return {
      ...summary!,
      can_manage: await this.canManage(currentUser, database, found),
      can_approve: await this.canApprove(currentUser, found),
      children: await this.childrenOf(database, classId),
    };
  }

  // Ghi kết quả nhiều trẻ một lần (cả lớp hoặc một phần); lớp đã xác nhận thì khóa
  async record(currentUser: CurrentUser, classId: string, items: CompletionItem[], origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const found = await this.eligibleClass(database, classId);
    if (!(await this.canManage(currentUser, database, found))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền ghi kết quả của lớp này');
    }
    await database.transaction().execute(async (transaction) => {
      // Khóa dòng lớp để xác nhận và ghi kết quả không chạy xen nhau
      await sql`select id from classes where id = ${classId} for update`.execute(transaction);
      const confirmed = await transaction
        .selectFrom('program_completion_confirmations')
        .select('id')
        .where('class_id', '=', classId)
        .executeTakeFirst();
      if (confirmed) {
        throw ruleViolationError(COMPLETION_RULE, 'Danh sách của lớp đã được xác nhận, không sửa được');
      }
      const members = new Set(
        (
          await transaction
            .selectFrom('class_enrollments')
            .innerJoin('children', 'children.id', 'class_enrollments.child_id')
            .select('children.id')
            .where('class_enrollments.class_id', '=', classId)
            .where('class_enrollments.is_current', '=', true)
            .where('children.status', '=', 'active')
            .execute()
        ).map((row) => row.id),
      );
      const outside = items.filter((item) => !members.has(item.childId));
      if (outside.length > 0) {
        throw validationError([{ field: 'items', message: 'Có trẻ không đang học lớp này' }]);
      }
      const now = this.clock.now();
      for (const item of items) {
        await transaction
          .insertInto('program_completions')
          .values({
            child_id: item.childId,
            class_id: classId,
            org_unit_id: found.org_unit_id,
            result: item.result,
            note: item.note,
            recorded_by: origin.actorUserId,
            recorded_by_name: origin.actorName,
          })
          .onConflict((conflict) =>
            conflict.column('child_id').doUpdateSet({
              class_id: classId,
              org_unit_id: found.org_unit_id,
              result: item.result,
              note: item.note,
              recorded_by: origin.actorUserId,
              recorded_by_name: origin.actorName,
              updated_at: now,
            }),
          )
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: found.org_unit_id,
        entityName: 'program_completions',
        entityId: classId,
        action: 'update',
        before: null,
        after: { items },
      });
    });
    return this.readClass(currentUser, classId);
  }

  // Ban Giám hiệu xác nhận khi mọi trẻ đang học của lớp đã có kết quả
  async confirm(currentUser: CurrentUser, classId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const found = await this.eligibleClass(database, classId);
    if (!(await this.canApprove(currentUser, found))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xác nhận danh sách của lớp này');
    }
    await database.transaction().execute(async (transaction) => {
      await sql`select id from classes where id = ${classId} for update`.execute(transaction);
      const existing = await transaction
        .selectFrom('program_completion_confirmations')
        .select('id')
        .where('class_id', '=', classId)
        .executeTakeFirst();
      if (existing) {
        throw ruleViolationError(COMPLETION_RULE, 'Danh sách của lớp đã được xác nhận');
      }
      const [summary] = await this.summaries(transaction, [found]);
      if (!summary || summary.children_count === 0) {
        throw ruleViolationError(COMPLETION_RULE, 'Lớp chưa có trẻ đang học');
      }
      if (summary.unmarked_count > 0) {
        throw ruleViolationError(COMPLETION_RULE, `Còn ${summary.unmarked_count} trẻ chưa ghi kết quả`);
      }
      const row = await transaction
        .insertInto('program_completion_confirmations')
        .values({
          class_id: classId,
          org_unit_id: found.org_unit_id,
          completed_count: summary.completed_count,
          children_count: summary.children_count,
          confirmed_by: origin.actorUserId,
          confirmed_by_name: origin.actorName,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: found.org_unit_id,
        entityName: 'program_completion_confirmations',
        entityId: row.id,
        action: 'create',
        before: null,
        after: row,
      });
    });
    return this.readClass(currentUser, classId);
  }

  async unconfirm(currentUser: CurrentUser, classId: string, reason: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const found = await this.eligibleClass(database, classId);
    if (!(await this.canApprove(currentUser, found))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền hủy xác nhận danh sách của lớp này');
    }
    await database.transaction().execute(async (transaction) => {
      const removed = await transaction
        .deleteFrom('program_completion_confirmations')
        .where('class_id', '=', classId)
        .returningAll()
        .executeTakeFirst();
      if (!removed) {
        throw ruleViolationError(COMPLETION_RULE, 'Danh sách của lớp chưa được xác nhận');
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: found.org_unit_id,
        entityName: 'program_completion_confirmations',
        entityId: removed.id,
        action: 'delete',
        before: removed,
        after: { reason },
      });
    });
    return this.readClass(currentUser, classId);
  }

  // Xuất danh sách của một lớp hoặc mọi lớp mẫu giáo 5-6 tuổi trong phạm vi (có thể lọc đơn vị)
  async export(
    currentUser: CurrentUser,
    filter: { classId: string | null; orgUnitId: string | null },
    ipAddress: string | null,
  ) {
    const { database } = await this.currentSchoolYear.require();
    let classes: EligibleClass[];
    if (filter.classId) {
      const found = await this.eligibleClass(database, filter.classId);
      await this.assertCanRead(currentUser, database, found);
      classes = [found];
    } else {
      classes = await this.visibleClasses(currentUser, database, filter.orgUnitId);
    }
    const summaries = await this.summaries(database, classes);
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Hoàn thành chương trình');
    worksheet.addRow([
      'STT',
      'Đơn vị',
      'Lớp',
      'Họ tên trẻ',
      'Ngày sinh',
      'Giới tính',
      'Kết quả',
      'Ghi chú',
      'Xác nhận',
    ]);
    worksheet.getRow(1).font = { bold: true };
    let rowCount = 0;
    for (const summary of summaries) {
      for (const child of await this.childrenOf(database, summary.id)) {
        rowCount += 1;
        worksheet.addRow([
          rowCount,
          summary.org_unit_name,
          summary.name,
          child.full_name,
          child.dob,
          child.gender === 'male' ? 'Nam' : 'Nữ',
          child.result ? RESULT_LABELS[child.result] : 'Chưa ghi',
          child.note ?? '',
          summary.confirmed ? 'Đã xác nhận' : 'Chưa xác nhận',
        ]);
      }
    }
    worksheet.columns.forEach((column) => {
      column.width = 22;
    });
    const stamp = this.clock.now().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
    const fileName = `hoan-thanh-chuong-trinh-${stamp}.xlsx`;
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const log = await database
      .insertInto('export_logs')
      .values({
        user_id: currentUser.id,
        actor_name: currentUser.description.full_name,
        report_code: 'program-completion',
        filters_data: JSON.stringify({ class_id: filter.classId, org_unit_id: filter.orgUnitId }),
        org_unit_ids: [...new Set(classes.map((row) => row.org_unit_id))],
        row_count: rowCount,
        contains_personal_data: true,
        file_name: fileName,
        ip_address: ipAddress,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return { buffer, fileName, logId: log.id };
  }
}

function check(errors: FieldError[]) {
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

function optionalQueryUuid(query: Record<string, string | undefined>, field: string, errors: FieldError[]) {
  const value = query[field];
  if (value === undefined || value === '') {
    return null;
  }
  if (!isUuid(value)) {
    errors.push({ field, message: 'Mã không hợp lệ' });
    return null;
  }
  return value;
}

function readItems(body: RequestBody, errors: FieldError[]): CompletionItem[] {
  const raw = body?.items;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAXIMUM_ITEMS) {
    errors.push({ field: 'items', message: `Từ 1 đến ${MAXIMUM_ITEMS} trẻ` });
    return [];
  }
  const seen = new Set<string>();
  return raw.map((entry: unknown, index) => {
    const item = (typeof entry === 'object' && entry !== null ? entry : {}) as RequestBody;
    const childId = readRequiredUuid(item, 'child_id', errors, 'Bắt buộc chọn trẻ');
    if (childId && seen.has(childId)) {
      errors.push({ field: `items[${index}].child_id`, message: 'Trẻ bị lặp' });
    }
    seen.add(childId);
    const result = item?.result as ProgramCompletionResult;
    if (!RESULTS.includes(result)) {
      errors.push({ field: `items[${index}].result`, message: 'Kết quả là completed hoặc not_completed' });
    }
    const note = item?.note;
    if (note !== undefined && note !== null && (typeof note !== 'string' || note.trim().length > MAXIMUM_NOTE)) {
      errors.push({ field: `items[${index}].note`, message: `Ghi chú tối đa ${MAXIMUM_NOTE} ký tự` });
    }
    return {
      childId,
      result,
      note: typeof note === 'string' && note.trim() !== '' ? note.trim() : null,
    };
  });
}

@Controller()
export class ProgramCompletionController {
  constructor(private readonly completions: ProgramCompletionService) {}

  @Get('program-completion/classes')
  listClasses(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const orgUnitId = optionalQueryUuid(query, 'org_unit_id', errors);
    check(errors);
    return this.completions.listClasses(currentUser, orgUnitId);
  }

  @Get('program-completion/statistics')
  statistics(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const orgUnitId = optionalQueryUuid(query, 'org_unit_id', errors);
    check(errors);
    return this.completions.statistics(currentUser, orgUnitId);
  }

  @Get('program-completion/export')
  async export(
    @Query() query: Record<string, string | undefined>,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const filter = {
      classId: optionalQueryUuid(query, 'class_id', errors),
      orgUnitId: optionalQueryUuid(query, 'org_unit_id', errors),
    };
    check(errors);
    const result = await this.completions.export(currentUser, filter, request.ip ?? null);
    response.setHeader('content-type', XLSX_TYPE);
    response.setHeader('content-disposition', `attachment; filename="${result.fileName}"`);
    response.setHeader('x-export-log-id', result.logId);
    response.setHeader('cache-control', 'no-store');
    response.send(result.buffer);
  }

  @Get('program-completion/classes/:id')
  readClass(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.completions.readClass(currentUser, classId);
  }

  @Put('program-completion/classes/:id')
  record(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const items = readItems(body, errors);
    check(errors);
    return this.completions.record(currentUser, classId, items, originOf(request, currentUser));
  }

  @Post('program-completion/classes/:id/confirm')
  @HttpCode(200)
  confirm(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.completions.confirm(currentUser, classId, originOf(request, currentUser));
  }

  @Post('program-completion/classes/:id/unconfirm')
  @HttpCode(200)
  unconfirm(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    if (reason === '' || reason.length > MAXIMUM_NOTE) {
      throw validationError([{ field: 'reason', message: `Bắt buộc nhập lý do, tối đa ${MAXIMUM_NOTE} ký tự` }]);
    }
    return this.completions.unconfirm(currentUser, classId, reason, originOf(request, currentUser));
  }
}
