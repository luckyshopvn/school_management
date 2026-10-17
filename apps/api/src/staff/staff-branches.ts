import { Body, Controller, Get, HttpCode, Injectable, Post, Query, Req } from '@nestjs/common';
import { ApplicationError, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { isUuid, type RequestBody } from '../common/request-fields.js';
import { optionalUuid, type QueryValues } from '../reports/report-filters.js';
import { ReportsService } from '../reports/reports.service.js';
import { FULL_NAME_ORDER, GIVEN_NAME_ORDER } from './staff-list.js';

// 3.1.2 Nhân sự phân hiệu (DT-16 phần 16f, mục 3.1.2 của Sở): nhân sự có một đơn vị chính (hồ sơ) và có thể làm việc ở các
// phân hiệu, điểm trường khác. "Gán phân hiệu" ghi tay; "Lấy theo phân hiệu giảng dạy" lấy đơn vị của các lớp nhân sự đang
// được phân công (3.3 Phân công phụ trách lớp, theo tài khoản liên kết) và thay các dòng đã lấy lần trước. Gán phân hiệu
// chỉ để thống kê, tra cứu; không đổi phạm vi quyền của tài khoản (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11)
const PAGE_SIZE_LIMIT = 200;
const MAXIMUM_IDS = 200;

@Injectable()
export class StaffBranchesService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly reports: ReportsService,
  ) {}

  // Phân hiệu, điểm trường đang hoạt động để chọn
  private async branchUnits() {
    const { database } = await this.currentSchoolYear.require();
    return database
      .selectFrom('org_units')
      .select(['id', 'code', 'name', 'unit_type'])
      .where('status', '=', 'active')
      .where('unit_type', 'in', ['phan_hieu', 'diem_truong'])
      .orderBy('code')
      .execute();
  }

  async list(
    currentUser: CurrentUser,
    filter: { orgUnitId: string | null; branchId: string | null; q: string | null; page: number; pageSize: number },
  ) {
    const scope = await this.reports.unitScope(currentUser, PERMISSION_CODES.staffView, filter.orgUnitId, false);
    const { database } = await this.currentSchoolYear.require();
    let query = database
      .selectFrom('staff')
      .innerJoin('org_units', 'org_units.id', 'staff.org_unit_id')
      .where('staff.org_unit_id', 'in', scope.orgUnitIds.length > 0 ? scope.orgUnitIds : [''])
      .where('staff.status', '=', 'active');
    if (filter.q) {
      const pattern = `%${filter.q.replace(/[%_\\]/g, '\\$&')}%`;
      query = query.where((expression) =>
        expression.or([expression('staff.full_name', 'ilike', pattern), expression('staff.code', 'ilike', pattern)]),
      );
    }
    if (filter.branchId) {
      const branchId = filter.branchId;
      query = query.where((expression) =>
        expression.exists(
          expression
            .selectFrom('staff_branch_assignments')
            .select('staff_branch_assignments.id')
            .whereRef('staff_branch_assignments.staff_id', '=', 'staff.id')
            .where('staff_branch_assignments.org_unit_id', '=', branchId),
        ),
      );
    }
    const counted = await query
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    const pageSize = Math.min(filter.pageSize, PAGE_SIZE_LIMIT);
    const rows = await query
      .select([
        'staff.id',
        'staff.code',
        'staff.full_name',
        'staff.user_id',
        'staff.org_unit_id',
        'org_units.name as unit_name',
      ])
      .orderBy(GIVEN_NAME_ORDER)
      .orderBy(FULL_NAME_ORDER)
      .orderBy('staff.id')
      .limit(pageSize)
      .offset((filter.page - 1) * pageSize)
      .execute();
    const assignments =
      rows.length === 0
        ? []
        : await database
            .selectFrom('staff_branch_assignments')
            .innerJoin('org_units', 'org_units.id', 'staff_branch_assignments.org_unit_id')
            .select([
              'staff_branch_assignments.staff_id',
              'staff_branch_assignments.org_unit_id',
              'staff_branch_assignments.source',
              'org_units.name',
            ])
            .where(
              'staff_branch_assignments.staff_id',
              'in',
              rows.map((row) => row.id),
            )
            .orderBy('org_units.code')
            .execute();
    const total = Number(counted.count);
    return {
      items: rows.map(({ user_id: userId, ...row }) => ({
        ...row,
        has_account: Boolean(userId),
        branches: assignments
          .filter((item) => item.staff_id === row.id)
          .map((item) => ({ org_unit_id: item.org_unit_id, name: item.name, source: item.source })),
      })),
      branch_units: await this.branchUnits(),
      page: filter.page,
      page_size: pageSize,
      total,
      total_pages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  // Nhân sự được chọn phải trong phạm vi quản lý hồ sơ nhân sự của người thao tác
  private async managedStaff(currentUser: CurrentUser, staffIds: string[]) {
    const scope = await this.reports.unitScope(currentUser, PERMISSION_CODES.staffManage, null, false);
    const { database } = await this.currentSchoolYear.require();
    const rows = await database
      .selectFrom('staff')
      .select(['id', 'org_unit_id', 'full_name', 'user_id', 'status'])
      .where('id', 'in', staffIds)
      .execute();
    if (rows.length !== staffIds.length) {
      throw validationError([{ field: 'staff_ids', message: 'Có hồ sơ nhân sự không tồn tại' }]);
    }
    const outside = rows.find((row) => !scope.orgUnitIds.includes(row.org_unit_id));
    if (outside) {
      throw new ApplicationError('ERR_FORBIDDEN', `${outside.full_name} ngoài phạm vi quản lý của bạn`);
    }
    return { database, rows };
  }

  async assign(currentUser: CurrentUser, staffIds: string[], branchIds: string[], origin: ChangeOrigin) {
    const { database, rows } = await this.managedStaff(currentUser, staffIds);
    const branches = await this.branchUnits();
    const unknown = branchIds.find((id) => !branches.some((branch) => branch.id === id));
    if (unknown) {
      throw validationError([{ field: 'org_unit_ids', message: 'Chọn phân hiệu, điểm trường đang hoạt động' }]);
    }
    let added = 0;
    await database.transaction().execute(async (transaction) => {
      for (const row of rows) {
        const targets = branchIds.filter((id) => id !== row.org_unit_id);
        if (targets.length === 0) {
          continue;
        }
        const inserted = await transaction
          .insertInto('staff_branch_assignments')
          .values(
            targets.map((orgUnitId) => ({
              staff_id: row.id,
              org_unit_id: orgUnitId,
              source: 'manual' as const,
              created_by: origin.actorUserId,
            })),
          )
          .onConflict((conflict) => conflict.columns(['staff_id', 'org_unit_id']).doUpdateSet({ source: 'manual' }))
          .returning('org_unit_id')
          .execute();
        added += inserted.length;
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: row.org_unit_id,
          entityName: 'staff_branch_assignments',
          entityId: row.id,
          action: 'create',
          before: null,
          after: { org_unit_ids: targets, source: 'manual' },
        });
      }
    });
    return { assigned_count: added };
  }

  async unassign(currentUser: CurrentUser, staffIds: string[], branchIds: string[], origin: ChangeOrigin) {
    const { database, rows } = await this.managedStaff(currentUser, staffIds);
    let removed = 0;
    await database.transaction().execute(async (transaction) => {
      for (const row of rows) {
        const deleted = await transaction
          .deleteFrom('staff_branch_assignments')
          .where('staff_id', '=', row.id)
          .where('org_unit_id', 'in', branchIds)
          .returning('org_unit_id')
          .execute();
        if (deleted.length === 0) {
          continue;
        }
        removed += deleted.length;
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: row.org_unit_id,
          entityName: 'staff_branch_assignments',
          entityId: row.id,
          action: 'delete',
          before: { org_unit_ids: deleted.map((item) => item.org_unit_id) },
          after: null,
        });
      }
    });
    return { removed_count: removed };
  }

  // "Lấy theo phân hiệu giảng dạy": đơn vị (phân hiệu, điểm trường, khác đơn vị chính) của các lớp đang hoạt động mà nhân
  // sự đang được phân công; thay các dòng đã lấy theo giảng dạy lần trước, giữ các dòng gán tay
  async fromTeaching(currentUser: CurrentUser, staffIds: string[], origin: ChangeOrigin) {
    const { database, rows } = await this.managedStaff(currentUser, staffIds);
    const branches = new Set((await this.branchUnits()).map((branch) => branch.id));
    const userIds = rows.map((row) => row.user_id).filter((id): id is string => Boolean(id));
    const teaching =
      userIds.length === 0
        ? []
        : await database
            .selectFrom('class_staff_assignments')
            .innerJoin('classes', 'classes.id', 'class_staff_assignments.class_id')
            .select(['class_staff_assignments.staff_user_id', 'classes.org_unit_id'])
            .where('class_staff_assignments.status', '=', 'active')
            .where('classes.status', '=', 'active')
            .where('class_staff_assignments.staff_user_id', 'in', userIds)
            .execute();
    let assigned = 0;
    let withoutAccount = 0;
    await database.transaction().execute(async (transaction) => {
      for (const row of rows) {
        if (!row.user_id) {
          withoutAccount += 1;
          continue;
        }
        const targets = [
          ...new Set(
            teaching
              .filter((item) => item.staff_user_id === row.user_id)
              .map((item) => item.org_unit_id)
              .filter((id) => id !== row.org_unit_id && branches.has(id)),
          ),
        ];
        await transaction
          .deleteFrom('staff_branch_assignments')
          .where('staff_id', '=', row.id)
          .where('source', '=', 'teaching')
          .execute();
        if (targets.length > 0) {
          const inserted = await transaction
            .insertInto('staff_branch_assignments')
            .values(
              targets.map((orgUnitId) => ({
                staff_id: row.id,
                org_unit_id: orgUnitId,
                source: 'teaching' as const,
                created_by: origin.actorUserId,
              })),
            )
            .onConflict((conflict) => conflict.columns(['staff_id', 'org_unit_id']).doNothing())
            .returning('org_unit_id')
            .execute();
          assigned += inserted.length;
        }
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: row.org_unit_id,
          entityName: 'staff_branch_assignments',
          entityId: row.id,
          action: 'update',
          before: null,
          after: { org_unit_ids: targets, source: 'teaching' },
        });
      }
    });
    return { assigned_count: assigned, without_account_count: withoutAccount };
  }
}

function readIds(body: RequestBody, field: string, errors: FieldError[], label: string): string[] {
  const value = body?.[field];
  if (!Array.isArray(value) || value.length === 0 || value.length > MAXIMUM_IDS || value.some((id) => !isUuid(id))) {
    errors.push({ field, message: `Chọn từ 1 đến ${MAXIMUM_IDS} ${label}` });
    return [];
  }
  return [...new Set(value as string[])];
}

@Controller('staff-branches')
export class StaffBranchesController {
  constructor(private readonly branches: StaffBranchesService) {}

  @Get()
  @RequirePermission(PERMISSION_CODES.staffView)
  list(@Query() query: QueryValues, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const orgUnitId = optionalUuid(query, 'org_unit_id', errors);
    const branchId = optionalUuid(query, 'branch_id', errors);
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.page_size ?? 20);
    if (!Number.isInteger(page) || page < 1) {
      errors.push({ field: 'page', message: 'Số trang bắt đầu từ 1' });
    }
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > PAGE_SIZE_LIMIT) {
      errors.push({ field: 'page_size', message: 'Cỡ trang từ 1 đến 200' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.branches.list(currentUser, {
      orgUnitId,
      branchId,
      q: query.q?.trim().slice(0, 100) || null,
      page,
      pageSize,
    });
  }

  @Post('assign')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.staffManage)
  assign(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const staffIds = readIds(body, 'staff_ids', errors, 'nhân sự');
    const branchIds = readIds(body, 'org_unit_ids', errors, 'phân hiệu');
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.branches.assign(currentUser, staffIds, branchIds, originOf(request, currentUser));
  }

  @Post('unassign')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.staffManage)
  unassign(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const staffIds = readIds(body, 'staff_ids', errors, 'nhân sự');
    const branchIds = readIds(body, 'org_unit_ids', errors, 'phân hiệu');
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.branches.unassign(currentUser, staffIds, branchIds, originOf(request, currentUser));
  }

  @Post('from-teaching')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.staffManage)
  fromTeaching(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const staffIds = readIds(body, 'staff_ids', errors, 'nhân sự');
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.branches.fromTeaching(currentUser, staffIds, originOf(request, currentUser));
  }
}
