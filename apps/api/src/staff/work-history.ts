import { Body, Controller, Delete, Get, HttpCode, Injectable, Param, Patch, Post, Req } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { notFoundError, readOptionalUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { readWorkDate, readWorkText, WorkAccess } from '../work/work-access.js';

// Quá trình công tác và chứng chỉ của nhân sự (P07-03; BR-37, BR-46; YCTD-81). Phòng nhân sự ghi thêm mốc công tác
// (đơn vị, phòng ban, chức danh, từ ngày, đến ngày); mốc đã ghi không sửa, chỉ ghi ngày kết thúc cho mốc đang mở. Mốc ở
// đơn vị khác đơn vị chính là ghi nhận nhân sự làm nhiều đơn vị (BR-37). Chứng chỉ ghi tên, số hiệu, nơi cấp, ngày cấp,
// ngày hết hạn; ghi nhầm thì xóa. Người xem hồ sơ nhân sự trong phạm vi và chính nhân sự đó xem được
interface HistoryInput {
  orgUnitId: string | null;
  fromDate: string;
  toDate: string | null;
  departmentId: string | null;
  jobTitleId: string | null;
  note: string | null;
}

interface CertificateInput {
  name: string;
  certificateNo: string | null;
  issuedBy: string;
  issuedDate: string;
  expireDate: string | null;
  note: string | null;
}

@Injectable()
export class WorkHistoryService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: WorkAccess,
  ) {}

  async read(currentUser: CurrentUser, staffId: string) {
    const { database } = await this.currentSchoolYear.require();
    const staff = await this.access.staff(database, staffId);
    const isSelf = staff.user_id === currentUser.id;
    if (
      !isSelf &&
      !(await this.access.canManage(currentUser, PERMISSION_CODES.staffView, staff.org_unit_id)) &&
      !(await this.access.canManage(currentUser, PERMISSION_CODES.workHistoryManage, staff.org_unit_id))
    ) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem quá trình công tác của nhân sự này');
    }
    const history = await database
      .selectFrom('staff_work_history')
      .innerJoin('org_units', 'org_units.id', 'staff_work_history.org_unit_id')
      .leftJoin('departments', 'departments.id', 'staff_work_history.department_id')
      .leftJoin('job_titles', 'job_titles.id', 'staff_work_history.job_title_id')
      .selectAll('staff_work_history')
      .select([
        'org_units.name as unit_name',
        'departments.name as department_name',
        'job_titles.name as job_title_name',
      ])
      .where('staff_work_history.staff_id', '=', staffId)
      .orderBy('staff_work_history.from_date', 'desc')
      .execute();
    const certificates = await database
      .selectFrom('staff_certificates')
      .selectAll()
      .where('staff_id', '=', staffId)
      .orderBy('issued_date', 'desc')
      .execute();
    return {
      staff_id: staffId,
      can_manage: await this.access.canManage(currentUser, PERMISSION_CODES.workHistoryManage, staff.org_unit_id),
      history: history.map((row) => ({ ...row, is_main_unit: row.org_unit_id === staff.org_unit_id })),
      certificates,
    };
  }

  async addHistory(currentUser: CurrentUser, staffId: string, input: HistoryInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const staff = await this.assertManager(database, currentUser, staffId);
    const orgUnitId = input.orgUnitId ?? staff.org_unit_id;
    const unit = await database
      .selectFrom('org_units')
      .select(['id', 'status'])
      .where('id', '=', orgUnitId)
      .executeTakeFirst();
    if (!unit) {
      throw validationError([{ field: 'org_unit_id', message: 'Không tìm thấy đơn vị' }]);
    }
    await this.assertCatalogs(database, orgUnitId, input);
    const created = await database.transaction().execute(async (transaction) => {
      const row = await transaction
        .insertInto('staff_work_history')
        .values({
          staff_id: staffId,
          org_unit_id: orgUnitId,
          from_date: input.fromDate,
          to_date: input.toDate,
          department_id: input.departmentId,
          job_title_id: input.jobTitleId,
          note: input.note,
          created_by: origin.actorUserId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: staff.org_unit_id,
        entityName: 'staff_work_history',
        entityId: row.id,
        action: 'create',
        before: null,
        after: row,
      });
      return row;
    });
    return created;
  }

  // Ghi ngày kết thúc cho mốc công tác đang mở
  async closeHistory(currentUser: CurrentUser, historyId: string, toDate: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const row = await database
      .selectFrom('staff_work_history')
      .selectAll()
      .where('id', '=', historyId)
      .executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy mốc công tác', 'staff_work_history');
    }
    const staff = await this.assertManager(database, currentUser, row.staff_id);
    if (row.to_date !== null) {
      throw new ApplicationError('ERR_CONFLICT', 'Mốc công tác đã có ngày kết thúc; sai thì ghi thêm mốc mới', [
        { field: 'to_date', message: 'Đã có ngày kết thúc' },
      ]);
    }
    if (toDate < row.from_date) {
      throw validationError([{ field: 'to_date', message: 'Đến ngày không trước từ ngày' }]);
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('staff_work_history')
        .set({ to_date: toDate })
        .where('id', '=', historyId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: staff.org_unit_id,
        entityName: 'staff_work_history',
        entityId: historyId,
        action: 'update',
        before: row,
        after: updated,
      });
      return updated;
    });
  }

  async addCertificate(currentUser: CurrentUser, staffId: string, input: CertificateInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const staff = await this.assertManager(database, currentUser, staffId);
    return database.transaction().execute(async (transaction) => {
      const row = await transaction
        .insertInto('staff_certificates')
        .values({
          staff_id: staffId,
          name: input.name,
          certificate_no: input.certificateNo,
          issued_by: input.issuedBy,
          issued_date: input.issuedDate,
          expire_date: input.expireDate,
          note: input.note,
          created_by: origin.actorUserId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: staff.org_unit_id,
        entityName: 'staff_certificates',
        entityId: row.id,
        action: 'create',
        before: null,
        after: row,
      });
      return row;
    });
  }

  async deleteCertificate(currentUser: CurrentUser, certificateId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const row = await database
      .selectFrom('staff_certificates')
      .selectAll()
      .where('id', '=', certificateId)
      .executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy chứng chỉ', 'staff_certificate');
    }
    const staff = await this.assertManager(database, currentUser, row.staff_id);
    await database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('staff_certificates').where('id', '=', certificateId).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: staff.org_unit_id,
        entityName: 'staff_certificates',
        entityId: certificateId,
        action: 'delete',
        before: row,
        after: null,
      });
    });
    return { id: certificateId };
  }

  private async assertManager(database: Kysely<SchoolYearDatabase>, currentUser: CurrentUser, staffId: string) {
    const staff = await this.access.staff(database, staffId);
    await this.access.assertManage(
      currentUser,
      PERMISSION_CODES.workHistoryManage,
      staff.org_unit_id,
      'Bạn không có quyền ghi quá trình công tác của nhân sự này',
    );
    return staff;
  }

  // Phòng ban và chức danh phải thuộc đơn vị của mốc công tác
  private async assertCatalogs(database: Kysely<SchoolYearDatabase>, orgUnitId: string, input: HistoryInput) {
    if (input.departmentId) {
      const department = await database
        .selectFrom('departments')
        .select('org_unit_id')
        .where('id', '=', input.departmentId)
        .executeTakeFirst();
      if (!department || department.org_unit_id !== orgUnitId) {
        throw validationError([{ field: 'department_id', message: 'Phòng ban phải thuộc đơn vị của mốc công tác' }]);
      }
    }
    if (input.jobTitleId) {
      const jobTitle = await database
        .selectFrom('job_titles')
        .select('org_unit_id')
        .where('id', '=', input.jobTitleId)
        .executeTakeFirst();
      if (!jobTitle || jobTitle.org_unit_id !== orgUnitId) {
        throw validationError([{ field: 'job_title_id', message: 'Chức danh phải thuộc đơn vị của mốc công tác' }]);
      }
    }
  }
}

function check(errors: FieldError[]) {
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

@Controller()
export class WorkHistoryController {
  constructor(private readonly workHistory: WorkHistoryService) {}

  @Get('staff/:id/work-history')
  read(
    @Param('id', uuidParameter('Mã nhân sự không hợp lệ')) staffId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.workHistory.read(currentUser, staffId);
  }

  @Post('staff/:id/work-history')
  @HttpCode(201)
  addHistory(
    @Param('id', uuidParameter('Mã nhân sự không hợp lệ')) staffId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = {
      orgUnitId: readOptionalUuid(body, 'org_unit_id', errors) ?? null,
      fromDate: readWorkDate(body, 'from_date', errors, true) ?? '',
      toDate: readWorkDate(body, 'to_date', errors),
      departmentId: readOptionalUuid(body, 'department_id', errors) ?? null,
      jobTitleId: readOptionalUuid(body, 'job_title_id', errors) ?? null,
      note: readWorkText(body, 'note', errors, { maximum: 500 }),
    };
    if (input.toDate && input.fromDate && input.toDate < input.fromDate) {
      errors.push({ field: 'to_date', message: 'Đến ngày không trước từ ngày' });
    }
    if (!input.departmentId && !input.jobTitleId && !input.note) {
      errors.push({ field: 'note', message: 'Ghi ít nhất phòng ban, chức danh hoặc nội dung công tác' });
    }
    check(errors);
    return this.workHistory.addHistory(currentUser, staffId, input, originOf(request, currentUser));
  }

  @Patch('staff-work-history/:id')
  closeHistory(
    @Param('id', uuidParameter('Mã mốc công tác không hợp lệ')) historyId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const toDate = readWorkDate(body, 'to_date', errors, true);
    check(errors);
    return this.workHistory.closeHistory(currentUser, historyId, toDate as string, originOf(request, currentUser));
  }

  @Post('staff/:id/certificates')
  @HttpCode(201)
  addCertificate(
    @Param('id', uuidParameter('Mã nhân sự không hợp lệ')) staffId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = {
      name: readWorkText(body, 'name', errors, { required: true, maximum: 200 }) ?? '',
      certificateNo: readWorkText(body, 'certificate_no', errors, { maximum: 100 }),
      issuedBy: readWorkText(body, 'issued_by', errors, { required: true, maximum: 200 }) ?? '',
      issuedDate: readWorkDate(body, 'issued_date', errors, true) ?? '',
      expireDate: readWorkDate(body, 'expire_date', errors),
      note: readWorkText(body, 'note', errors, { maximum: 500 }),
    };
    if (input.expireDate && input.issuedDate && input.expireDate < input.issuedDate) {
      errors.push({ field: 'expire_date', message: 'Ngày hết hạn không trước ngày cấp' });
    }
    check(errors);
    return this.workHistory.addCertificate(currentUser, staffId, input, originOf(request, currentUser));
  }

  @Delete('staff-certificates/:id')
  deleteCertificate(
    @Param('id', uuidParameter('Mã chứng chỉ không hợp lệ')) certificateId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.workHistory.deleteCertificate(currentUser, certificateId, originOf(request, currentUser));
  }
}
