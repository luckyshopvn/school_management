import { Body, Controller, Get, Injectable, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { CashAccountType } from '@school-management/database';
import { ApplicationError, Clock, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import {
  conflictOnDuplicate,
  isUuid,
  notFoundError,
  readOptionalText,
  readRequiredText,
  readRequiredUuid,
  readStatus,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { readAmount, readEnum } from '../fees/fee-catalog-fields.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';

// Quỹ tiền mặt và tài khoản ngân hàng của đơn vị, nơi nhận tiền của phiếu thu (P06-05, BR-34, YCTD-53).
// Số dư đầu chỉ nhập khi khai báo; số dư hiện tại chỉ thay đổi qua phiếu thu, phiếu chi và giao dịch
const ACCOUNT_TYPES: readonly CashAccountType[] = ['cash', 'bank'];
const COLUMNS = [
  'id',
  'org_unit_id',
  'account_type',
  'name',
  'bank_name',
  'account_number',
  'opening_balance',
  'current_balance',
  'status',
] as const;
const VIEW_PERMISSIONS = ['P06.view', PERMISSION_CODES.receiptManage, PERMISSION_CODES.cashAccountManage];

interface AccountChanges {
  name?: string;
  bank_name?: string | null;
  account_number?: string | null;
  status?: 'active' | 'inactive';
}

function toView<Row extends { opening_balance: string; current_balance: string }>(row: Row) {
  return { ...row, opening_balance: Number(row.opening_balance), current_balance: Number(row.current_balance) };
}

@Injectable()
export class CashAccountsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly clock: Clock,
  ) {}

  async list(currentUser: CurrentUser, filter: { orgUnitId: string; status?: 'active' | 'inactive' }) {
    await this.assertCanView(currentUser, filter.orgUnitId);
    const { database } = await this.currentSchoolYear.require();
    let query = database.selectFrom('cash_accounts').select(COLUMNS).where('org_unit_id', '=', filter.orgUnitId);
    if (filter.status) {
      query = query.where('status', '=', filter.status);
    }
    return (await query.orderBy('account_type').orderBy('name').execute()).map(toView);
  }

  async create(
    currentUser: CurrentUser,
    input: {
      org_unit_id: string;
      account_type: CashAccountType;
      name: string;
      bank_name: string | null;
      account_number: string | null;
      opening_balance: number;
    },
    origin: ChangeOrigin,
  ) {
    await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.cashAccountManage, input.org_unit_id);
    const { database } = await this.currentSchoolYear.require();
    return conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const created = await transaction
          .insertInto('cash_accounts')
          .values({ ...input, current_balance: input.opening_balance, created_by: origin.actorUserId })
          .returning(COLUMNS)
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: input.org_unit_id,
          entityName: 'cash_accounts',
          entityId: created.id,
          action: 'create',
          before: null,
          after: created,
        });
        return toView(created);
      }),
      'Tên quỹ hoặc tài khoản đã có trong đơn vị',
      'name',
    );
  }

  // Loại tài khoản, đơn vị và số dư không đổi qua sửa thông tin để số liệu đã ghi giữ đúng (BR-35)
  async update(currentUser: CurrentUser, accountId: string, changes: AccountChanges, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const existing = await database
      .selectFrom('cash_accounts')
      .select(COLUMNS)
      .where('id', '=', accountId)
      .executeTakeFirst();
    if (!existing) {
      throw notFoundError('Không tìm thấy quỹ hoặc tài khoản', 'cash_account');
    }
    await this.organizationScopes.assertCanAccess(
      currentUser,
      PERMISSION_CODES.cashAccountManage,
      existing.org_unit_id,
    );
    if (existing.account_type === 'bank' && (changes.bank_name === null || changes.account_number === null)) {
      throw validationError([
        { field: 'bank_name', message: 'Tài khoản ngân hàng bắt buộc có ngân hàng và số tài khoản' },
      ]);
    }
    return conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const updated = await transaction
          .updateTable('cash_accounts')
          .set({ ...changes, updated_at: this.clock.now() })
          .where('id', '=', accountId)
          .returning(COLUMNS)
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: existing.org_unit_id,
          entityName: 'cash_accounts',
          entityId: accountId,
          action: 'update',
          before: existing,
          after: updated,
        });
        return toView(updated);
      }),
      'Tên quỹ hoặc tài khoản đã có trong đơn vị',
      'name',
    );
  }

  private async assertCanView(currentUser: CurrentUser, orgUnitId: string): Promise<void> {
    for (const permission of VIEW_PERMISSIONS) {
      const scope = await this.organizationScopes.resolveStaff(currentUser, permission);
      if (scope.wholeSchool || scope.orgUnitIds.includes(orgUnitId)) {
        return;
      }
    }
    throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem quỹ và tài khoản của đơn vị này');
  }
}

// Nhân sự tài chính xem; kế toán và kế toán trưởng khai báo (MH-11)
@Controller('cash-accounts')
export class CashAccountsController {
  constructor(private readonly accounts: CashAccountsService) {}

  @Get()
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    if (!isUuid(query.org_unit_id)) {
      errors.push({ field: 'org_unit_id', message: 'Bắt buộc chọn đơn vị' });
    }
    const status = readStatus(query.status === undefined ? undefined : { status: query.status }, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.accounts.list(currentUser, { orgUnitId: query.org_unit_id ?? '', status });
  }

  @Post()
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const accountType = readEnum(body, 'account_type', ACCOUNT_TYPES, errors, true) ?? 'cash';
    const input = {
      org_unit_id: readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị'),
      account_type: accountType,
      name: readRequiredText(body, 'name', errors),
      bank_name: accountType === 'bank' ? readRequiredText(body, 'bank_name', errors) : null,
      account_number: accountType === 'bank' ? readRequiredText(body, 'account_number', errors) : null,
      opening_balance: readAmount(body?.opening_balance ?? 0, 'opening_balance', errors),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.accounts.create(currentUser, input, originOf(request, currentUser));
  }

  @Patch(':id')
  update(
    @Param('id', uuidParameter('Mã quỹ hoặc tài khoản không hợp lệ')) accountId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    for (const field of ['account_type', 'org_unit_id', 'opening_balance', 'current_balance']) {
      if (body?.[field] !== undefined) {
        errors.push({ field, message: 'Không sửa được trường này' });
      }
    }
    const changes: AccountChanges = {
      name: body?.name === undefined ? undefined : readRequiredText(body, 'name', errors),
      bank_name: readOptionalText(body, 'bank_name', errors),
      account_number: readOptionalText(body, 'account_number', errors),
      status: readStatus(body, errors),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.accounts.update(currentUser, accountId, changes, originOf(request, currentUser));
  }
}
