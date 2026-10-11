import { Body, Controller, Delete, Get, HttpCode, Injectable, Param, Post, Put, Req } from '@nestjs/common';
import type { PayCalculationMethod, PayItemKind, TaxBracket } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import {
  conflictOnDuplicate,
  notFoundError,
  readRequiredText,
  readRequiredUuid,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { readEnum } from '../fees/fee-catalog-fields.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';

// Danh mục phụ cấp, thưởng, khấu trừ chung toàn trường (P08-11, BR-44); khoản gán cho từng nhân sự và số người phụ thuộc;
// biểu thuế thu nhập cá nhân lũy tiến từng phần theo tháng (YCTD-60). Thưởng tháng là một loại phụ cấp cố định
export interface PayItemTypeInput {
  kind: PayItemKind;
  code: string;
  name: string;
  calculationMethod: PayCalculationMethod;
  defaultAmount: number | null;
  ratePercent: number | null;
  isTaxExempt: boolean;
  isMandatoryInsurance: boolean;
}

const KINDS: readonly PayItemKind[] = ['allowance', 'deduction'];
const METHODS: readonly PayCalculationMethod[] = ['fixed_monthly', 'per_workday', 'percent_of_base'];
const TYPE_COLUMNS = [
  'id',
  'kind',
  'code',
  'name',
  'calculation_method',
  'default_amount',
  'rate_percent',
  'is_tax_exempt',
  'is_mandatory_insurance',
  'status',
] as const;

function readMoney(value: unknown, field: string, errors: FieldError[], required: boolean): number | null {
  if ((value === undefined || value === null || value === '') && !required) {
    return null;
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 10_000_000_000) {
    errors.push({ field, message: 'Số tiền là số nguyên đồng, không âm' });
    return null;
  }
  return value;
}

function readPercent(value: unknown, field: string, errors: FieldError[], required: boolean): number | null {
  if ((value === undefined || value === null || value === '') && !required) {
    return null;
  }
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 100 ||
    Math.round(value * 1000) !== value * 1000
  ) {
    errors.push({ field, message: 'Tỷ lệ phần trăm từ 0 đến 100, tối đa ba chữ số thập phân' });
    return null;
  }
  return value;
}

function readType(body: RequestBody, errors: FieldError[]): PayItemTypeInput {
  const kind = readEnum(body, 'kind', KINDS, errors, true) ?? 'allowance';
  const calculationMethod = readEnum(body, 'calculation_method', METHODS, errors, true) ?? 'fixed_monthly';
  const isPercent = calculationMethod === 'percent_of_base';
  const input = {
    kind,
    code: readRequiredText(body, 'code', errors),
    name: readRequiredText(body, 'name', errors),
    calculationMethod,
    defaultAmount: isPercent ? null : readMoney(body?.default_amount, 'default_amount', errors, false),
    ratePercent: isPercent ? readPercent(body?.rate_percent, 'rate_percent', errors, false) : null,
    isTaxExempt: body?.is_tax_exempt === true,
    isMandatoryInsurance: body?.is_mandatory_insurance === true,
  };
  if (kind === 'deduction' && input.isTaxExempt) {
    errors.push({ field: 'is_tax_exempt', message: 'Chỉ phụ cấp mới đánh dấu miễn thuế' });
  }
  if (kind === 'allowance' && input.isMandatoryInsurance) {
    errors.push({ field: 'is_mandatory_insurance', message: 'Chỉ khấu trừ mới đánh dấu bảo hiểm bắt buộc' });
  }
  return input;
}

// Bậc thuế tăng dần theo mức thu nhập tính thuế, bậc cuối không có mức trần
export function readBrackets(value: unknown, errors: FieldError[]): TaxBracket[] {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push({ field: 'brackets', message: 'Cần ít nhất một bậc thuế' });
    return [];
  }
  const brackets: TaxBracket[] = [];
  value.forEach((entry: unknown, index) => {
    const row = (entry ?? {}) as Record<string, unknown>;
    const last = index === value.length - 1;
    const upTo = last ? null : readMoney(row.up_to, `brackets.${index}.up_to`, errors, true);
    const rate = readPercent(row.rate_percent, `brackets.${index}.rate_percent`, errors, true) ?? 0;
    if (!last && upTo !== null && index > 0 && upTo <= (brackets[index - 1]?.up_to ?? 0)) {
      errors.push({ field: `brackets.${index}.up_to`, message: 'Mức trần các bậc phải tăng dần' });
    }
    brackets.push({ up_to: upTo, rate_percent: rate });
  });
  return brackets;
}

@Injectable()
export class PayItemsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly clock: Clock,
  ) {}

  async listTypes() {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return [];
    }
    const rows = await current.database
      .selectFrom('pay_item_types')
      .select(TYPE_COLUMNS)
      .orderBy('kind')
      .orderBy('code')
      .execute();
    return rows.map((row) => this.typeView(row));
  }

  async createType(currentUser: CurrentUser, input: PayItemTypeInput, origin: ChangeOrigin) {
    this.assertPermission(
      currentUser,
      PERMISSION_CODES.payItemTypeManage,
      'Bạn không có quyền khai báo danh mục lương',
    );
    const { database } = await this.currentSchoolYear.require();
    const created = await conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const row = await transaction
          .insertInto('pay_item_types')
          .values({ ...this.typeColumns(input), created_by: origin.actorUserId })
          .returning(TYPE_COLUMNS)
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: null,
          entityName: 'pay_item_types',
          entityId: row.id,
          action: 'create',
          before: null,
          after: input,
        });
        return row;
      }),
      'Mã khoản đã tồn tại',
      'code',
    );
    return this.typeView(created);
  }

  async updateType(
    currentUser: CurrentUser,
    typeId: string,
    input: PayItemTypeInput & { status: 'active' | 'inactive' },
    origin: ChangeOrigin,
  ) {
    this.assertPermission(
      currentUser,
      PERMISSION_CODES.payItemTypeManage,
      'Bạn không có quyền khai báo danh mục lương',
    );
    const { database } = await this.currentSchoolYear.require();
    const existing = await database
      .selectFrom('pay_item_types')
      .select(TYPE_COLUMNS)
      .where('id', '=', typeId)
      .executeTakeFirst();
    if (!existing) {
      throw notFoundError('Không tìm thấy khoản trong danh mục lương', 'pay_item_type');
    }
    if (existing.kind !== input.kind) {
      throw validationError([{ field: 'kind', message: 'Không đổi được phụ cấp thành khấu trừ hoặc ngược lại' }]);
    }
    const updated = await conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const row = await transaction
          .updateTable('pay_item_types')
          .set({ ...this.typeColumns(input), status: input.status, updated_at: this.clock.now() })
          .where('id', '=', typeId)
          .returning(TYPE_COLUMNS)
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: null,
          entityName: 'pay_item_types',
          entityId: typeId,
          action: 'update',
          before: existing,
          after: input,
        });
        return row;
      }),
      'Mã khoản đã tồn tại',
      'code',
    );
    return this.typeView(updated);
  }

  // Khoản gán và số người phụ thuộc của một nhân sự: người xem được hợp đồng hoặc quản lý khoản gán trong phạm vi
  async staffItems(currentUser: CurrentUser, staffId: string) {
    const { database } = await this.currentSchoolYear.require();
    const staff = await this.loadStaff(staffId);
    const canView =
      (await this.inScope(currentUser, PERMISSION_CODES.contractView, staff.org_unit_id)) ||
      (await this.inScope(currentUser, PERMISSION_CODES.staffPayItemManage, staff.org_unit_id)) ||
      staff.user_id === currentUser.id;
    if (!canView) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem khoản lương của nhân sự này');
    }
    const items = await database
      .selectFrom('staff_pay_items')
      .innerJoin('pay_item_types', 'pay_item_types.id', 'staff_pay_items.pay_item_type_id')
      .select([
        'staff_pay_items.id',
        'staff_pay_items.pay_item_type_id',
        'staff_pay_items.amount',
        'staff_pay_items.rate_percent',
        'pay_item_types.kind',
        'pay_item_types.code',
        'pay_item_types.name',
        'pay_item_types.calculation_method',
        'pay_item_types.default_amount',
        'pay_item_types.rate_percent as default_rate_percent',
        'pay_item_types.status',
      ])
      .where('staff_pay_items.staff_id', '=', staffId)
      .orderBy('pay_item_types.kind')
      .orderBy('pay_item_types.code')
      .execute();
    return {
      staff_id: staffId,
      dependents_count: staff.dependents_count,
      can_manage: await this.inScope(currentUser, PERMISSION_CODES.staffPayItemManage, staff.org_unit_id),
      items: items.map((item) => ({
        ...item,
        amount: item.amount === null ? null : Number(item.amount),
        rate_percent: item.rate_percent === null ? null : Number(item.rate_percent),
        default_amount: item.default_amount === null ? null : Number(item.default_amount),
        default_rate_percent: item.default_rate_percent === null ? null : Number(item.default_rate_percent),
      })),
    };
  }

  async addStaffItem(
    currentUser: CurrentUser,
    staffId: string,
    input: { payItemTypeId: string; amount: number | null; ratePercent: number | null },
    origin: ChangeOrigin,
  ) {
    const staff = await this.loadStaff(staffId);
    await this.assertStaffManager(currentUser, staff.org_unit_id);
    const { database } = await this.currentSchoolYear.require();
    const type = await database
      .selectFrom('pay_item_types')
      .select(['calculation_method', 'status', 'default_amount', 'rate_percent'])
      .where('id', '=', input.payItemTypeId)
      .executeTakeFirst();
    if (!type || type.status !== 'active') {
      throw validationError([{ field: 'pay_item_type_id', message: 'Khoản không có hoặc đã ngừng dùng' }]);
    }
    const isPercent = type.calculation_method === 'percent_of_base';
    const amount = isPercent ? null : input.amount;
    const ratePercent = isPercent ? input.ratePercent : null;
    if (
      isPercent ? ratePercent === null && type.rate_percent === null : amount === null && type.default_amount === null
    ) {
      throw validationError([
        { field: isPercent ? 'rate_percent' : 'amount', message: 'Danh mục chưa có mức chung, cần nhập mức riêng' },
      ]);
    }
    await conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const row = await transaction
          .insertInto('staff_pay_items')
          .values({
            staff_id: staffId,
            pay_item_type_id: input.payItemTypeId,
            amount,
            rate_percent: ratePercent,
            created_by: origin.actorUserId,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: staff.org_unit_id,
          entityName: 'staff_pay_items',
          entityId: row.id,
          action: 'create',
          before: null,
          after: { staff_id: staffId, ...input },
        });
      }),
      'Nhân sự đã có khoản này',
      'pay_item_type_id',
    );
    return this.staffItems(currentUser, staffId);
  }

  async removeStaffItem(currentUser: CurrentUser, itemId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const item = await database.selectFrom('staff_pay_items').selectAll().where('id', '=', itemId).executeTakeFirst();
    if (!item) {
      throw notFoundError('Không tìm thấy khoản đã gán', 'staff_pay_item');
    }
    const staff = await this.loadStaff(item.staff_id);
    await this.assertStaffManager(currentUser, staff.org_unit_id);
    await database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('staff_pay_items').where('id', '=', itemId).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: staff.org_unit_id,
        entityName: 'staff_pay_items',
        entityId: itemId,
        action: 'delete',
        before: item,
        after: null,
      });
    });
  }

  async setDependents(currentUser: CurrentUser, staffId: string, count: number, origin: ChangeOrigin) {
    const staff = await this.loadStaff(staffId);
    await this.assertStaffManager(currentUser, staff.org_unit_id);
    const { database } = await this.currentSchoolYear.require();
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('staff')
        .set({ dependents_count: count, updated_at: this.clock.now() })
        .where('id', '=', staffId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: staff.org_unit_id,
        entityName: 'staff',
        entityId: staffId,
        action: 'update',
        before: { dependents_count: staff.dependents_count },
        after: { dependents_count: count },
      });
    });
    return this.staffItems(currentUser, staffId);
  }

  // Biểu thuế: mọi người xem bảng lương hoặc khai biểu thuế đều xem được
  async listTaxTables(currentUser: CurrentUser) {
    if (
      !currentUser.hasPermission(PERMISSION_CODES.payrollView) &&
      !currentUser.hasPermission(PERMISSION_CODES.taxTableManage)
    ) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem biểu thuế');
    }
    const { database } = await this.currentSchoolYear.require();
    const rows = await database.selectFrom('tax_tables').selectAll().orderBy('effective_from', 'desc').execute();
    return rows.map((row) => ({
      ...row,
      personal_deduction: Number(row.personal_deduction),
      dependent_deduction: Number(row.dependent_deduction),
    }));
  }

  // Thêm phiên bản biểu thuế có ngày hiệu lực là ngày 1 của một tháng
  async createTaxTable(
    currentUser: CurrentUser,
    input: { effectiveFrom: string; personalDeduction: number; dependentDeduction: number; brackets: TaxBracket[] },
    origin: ChangeOrigin,
  ) {
    this.assertPermission(currentUser, PERMISSION_CODES.taxTableManage, 'Chỉ kế toán trưởng được khai biểu thuế');
    const { database } = await this.currentSchoolYear.require();
    const used = await database
      .selectFrom('payrolls')
      .select(['period_year', 'period_month'])
      .where('status', '!=', 'draft')
      .execute();
    if (
      used.some((row) => `${row.period_year}-${String(row.period_month).padStart(2, '0')}-01` >= input.effectiveFrom)
    ) {
      throw ruleViolationError(
        'BR-44',
        'Đã có bảng lương trình duyệt từ ngày hiệu lực này, chọn ngày hiệu lực muộn hơn',
      );
    }
    const created = await conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const row = await transaction
          .insertInto('tax_tables')
          .values({
            effective_from: input.effectiveFrom,
            personal_deduction: input.personalDeduction,
            dependent_deduction: input.dependentDeduction,
            brackets: JSON.stringify(input.brackets),
            created_by: origin.actorUserId,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: null,
          entityName: 'tax_tables',
          entityId: row.id,
          action: 'create',
          before: null,
          after: input,
        });
        return row;
      }),
      'Đã có biểu thuế cùng ngày hiệu lực',
      'effective_from',
    );
    return (await this.listTaxTables(currentUser)).find((row) => row.id === created.id);
  }

  private typeColumns(input: PayItemTypeInput) {
    return {
      kind: input.kind,
      code: input.code,
      name: input.name,
      calculation_method: input.calculationMethod,
      default_amount: input.defaultAmount,
      rate_percent: input.ratePercent,
      is_tax_exempt: input.isTaxExempt,
      is_mandatory_insurance: input.isMandatoryInsurance,
    };
  }

  private typeView<Row extends { default_amount: string | null; rate_percent: string | null }>(row: Row) {
    return {
      ...row,
      default_amount: row.default_amount === null ? null : Number(row.default_amount),
      rate_percent: row.rate_percent === null ? null : Number(row.rate_percent),
    };
  }

  private async loadStaff(staffId: string) {
    const { database } = await this.currentSchoolYear.require();
    const staff = await database
      .selectFrom('staff')
      .select(['id', 'org_unit_id', 'user_id', 'dependents_count'])
      .where('id', '=', staffId)
      .executeTakeFirst();
    if (!staff) {
      throw notFoundError('Không tìm thấy hồ sơ nhân sự', 'staff');
    }
    return staff;
  }

  private assertPermission(currentUser: CurrentUser, permission: string, message: string) {
    if (!currentUser.hasPermission(permission)) {
      throw new ApplicationError('ERR_FORBIDDEN', message);
    }
  }

  private async assertStaffManager(currentUser: CurrentUser, orgUnitId: string) {
    if (!(await this.inScope(currentUser, PERMISSION_CODES.staffPayItemManage, orgUnitId))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền gán khoản lương cho nhân sự của đơn vị này');
    }
  }

  private async inScope(currentUser: CurrentUser, permission: string, orgUnitId: string): Promise<boolean> {
    const scope = await this.organizationScopes.resolveStaff(currentUser, permission);
    return scope.wholeSchool || scope.orgUnitIds.includes(orgUnitId);
  }
}

@Controller()
export class PayItemsController {
  constructor(private readonly payItems: PayItemsService) {}

  @Get('pay-item-types')
  listTypes() {
    return this.payItems.listTypes();
  }

  @Post('pay-item-types')
  @HttpCode(201)
  createType(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = readType(body, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.payItems.createType(currentUser, input, originOf(request, currentUser));
  }

  @Put('pay-item-types/:id')
  updateType(
    @Param('id', uuidParameter('Mã khoản không hợp lệ')) typeId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = readType(body, errors);
    const status = readEnum(body, 'status', ['active', 'inactive'] as const, errors, true);
    if (errors.length > 0 || !status) {
      throw validationError(errors);
    }
    return this.payItems.updateType(currentUser, typeId, { ...input, status }, originOf(request, currentUser));
  }

  @Get('staff/:id/pay-items')
  staffItems(
    @Param('id', uuidParameter('Mã nhân sự không hợp lệ')) staffId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.payItems.staffItems(currentUser, staffId);
  }

  @Post('staff/:id/pay-items')
  @HttpCode(201)
  addStaffItem(
    @Param('id', uuidParameter('Mã nhân sự không hợp lệ')) staffId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = {
      payItemTypeId: readRequiredUuid(body, 'pay_item_type_id', errors, 'Bắt buộc chọn khoản'),
      amount: readMoney(body?.amount, 'amount', errors, false),
      ratePercent: readPercent(body?.rate_percent, 'rate_percent', errors, false),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.payItems.addStaffItem(currentUser, staffId, input, originOf(request, currentUser));
  }

  @Delete('staff-pay-items/:id')
  @HttpCode(204)
  async removeStaffItem(
    @Param('id', uuidParameter('Mã khoản đã gán không hợp lệ')) itemId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ): Promise<void> {
    await this.payItems.removeStaffItem(currentUser, itemId, originOf(request, currentUser));
  }

  @Put('staff/:id/dependents')
  setDependents(
    @Param('id', uuidParameter('Mã nhân sự không hợp lệ')) staffId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const count = body?.dependents_count;
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > 20) {
      throw validationError([{ field: 'dependents_count', message: 'Số người phụ thuộc từ 0 đến 20' }]);
    }
    return this.payItems.setDependents(currentUser, staffId, count, originOf(request, currentUser));
  }

  @Get('tax-tables')
  taxTables(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.payItems.listTaxTables(currentUser);
  }

  @Post('tax-tables')
  @HttpCode(201)
  createTaxTable(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const effectiveFrom = body?.effective_from;
    if (typeof effectiveFrom !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])-01$/.test(effectiveFrom)) {
      errors.push({ field: 'effective_from', message: 'Ngày hiệu lực là ngày 1 của một tháng, dạng YYYY-MM-01' });
    }
    const input = {
      effectiveFrom: String(effectiveFrom),
      personalDeduction: readMoney(body?.personal_deduction, 'personal_deduction', errors, true) ?? 0,
      dependentDeduction: readMoney(body?.dependent_deduction, 'dependent_deduction', errors, true) ?? 0,
      brackets: readBrackets(body?.brackets, errors),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.payItems.createTaxTable(currentUser, input, originOf(request, currentUser));
  }
}
