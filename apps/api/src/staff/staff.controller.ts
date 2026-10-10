import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req } from '@nestjs/common';
import type { ContractType } from '@school-management/database';
import { readBearerToken, validationError, type FieldError } from '@school-management/server';
import type { Request } from 'express';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import {
  isUuid,
  readOptionalText,
  readOptionalUuid,
  readRequiredText,
  readRequiredUuid,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { readAmount, readEnum } from '../fees/fee-catalog-fields.js';
import { StaffService, type ContractInput, type StaffInput } from './staff.service.js';

// Hồ sơ nhân sự và hợp đồng lao động (P07-01, P07-02, P07-04; YCTD-58). Quyền kiểm tra ở tầng nghiệp vụ theo đơn vị
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ID_NUMBER_PATTERN = /^\d{12}$/;
const CONTRACT_TYPES: readonly ContractType[] = ['probation', 'fixed_term', 'indefinite'];
const MAXIMUM_TEXT = 500;

function readDate(body: RequestBody, field: string, errors: FieldError[], required: boolean): string | null {
  const value = body?.[field];
  if ((value === undefined || value === null || value === '') && !required) {
    return null;
  }
  if (typeof value !== 'string' || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    errors.push({ field, message: 'Ngày theo dạng YYYY-MM-DD' });
    return null;
  }
  return value;
}

function readStaff(body: RequestBody, errors: FieldError[]): StaffInput {
  const gender = readEnum(body, 'gender', ['male', 'female'] as const, errors, false) ?? null;
  const idNumber = readOptionalText(body, 'id_number', errors);
  if (idNumber && !ID_NUMBER_PATTERN.test(idNumber)) {
    errors.push({ field: 'id_number', message: 'Số định danh cá nhân gồm mười hai chữ số' });
  }
  return {
    orgUnitId: readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị chính'),
    code: readRequiredText(body, 'code', errors),
    fullName: readRequiredText(body, 'full_name', errors),
    dob: readDate(body, 'dob', errors, false),
    gender,
    phone: readOptionalText(body, 'phone', errors) ?? null,
    email: readOptionalText(body, 'email', errors) ?? null,
    address: readOptionalText(body, 'address', errors) ?? null,
    idNumber,
    departmentId: readOptionalUuid(body, 'department_id', errors) ?? null,
    jobTitleId: readOptionalUuid(body, 'job_title_id', errors) ?? null,
    startDate: readDate(body, 'start_date', errors, true) ?? '',
  };
}

function readAllowances(body: RequestBody, errors: FieldError[]): Array<{ name: string; amount: number }> {
  const value = body?.allowances ?? [];
  if (!Array.isArray(value)) {
    errors.push({ field: 'allowances', message: 'Danh sách phụ cấp không hợp lệ' });
    return [];
  }
  return value.map((entry: unknown, index) => {
    const row = (entry ?? {}) as Record<string, unknown>;
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    if (!name) {
      errors.push({ field: `allowances.${index}.name`, message: 'Bắt buộc nhập tên phụ cấp' });
    }
    return { name, amount: readAmount(row.amount, `allowances.${index}.amount`, errors, 1) };
  });
}

@Controller()
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get('staff')
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    for (const field of ['org_unit_id', 'department_id']) {
      if (query[field] !== undefined && !isUuid(query[field])) {
        errors.push({ field, message: 'Mã không hợp lệ' });
      }
    }
    const status = readEnum(query, 'status', ['active', 'terminated'] as const, errors, false) ?? null;
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.staff.list(currentUser, {
      orgUnitId: query.org_unit_id ?? null,
      departmentId: query.department_id ?? null,
      status,
      search: query.search?.trim() || null,
    });
  }

  @Get('staff/me')
  me(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.staff.me(currentUser);
  }

  @Get('staff/expiring-contracts')
  expiring(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.staff.expiring(currentUser);
  }

  @Get('staff/:id')
  read(
    @Param('id', uuidParameter('Mã nhân sự không hợp lệ')) staffId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.staff.read(currentUser, staffId);
  }

  @Post('staff')
  @HttpCode(201)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = readStaff(body, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.staff.create(currentUser, input, originOf(request, currentUser));
  }

  @Put('staff/:id')
  update(
    @Param('id', uuidParameter('Mã nhân sự không hợp lệ')) staffId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = readStaff(body, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.staff.update(currentUser, staffId, input, originOf(request, currentUser));
  }

  @Post('staff/:id/account')
  @HttpCode(200)
  linkAccount(
    @Param('id', uuidParameter('Mã nhân sự không hợp lệ')) staffId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const login = readRequiredText(body, 'login', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.staff.linkAccount(
      currentUser,
      readBearerToken(request.header('authorization')),
      staffId,
      login,
      originOf(request, currentUser),
    );
  }

  @Delete('staff/:id/account')
  unlinkAccount(
    @Param('id', uuidParameter('Mã nhân sự không hợp lệ')) staffId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.staff.unlinkAccount(currentUser, staffId, originOf(request, currentUser));
  }

  @Post('staff/:id/contracts')
  @HttpCode(201)
  createContract(
    @Param('id', uuidParameter('Mã nhân sự không hợp lệ')) staffId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input: ContractInput = {
      contractNo: readRequiredText(body, 'contract_no', errors),
      contractType: readEnum(body, 'contract_type', CONTRACT_TYPES, errors, true) ?? 'fixed_term',
      startDate: readDate(body, 'start_date', errors, true) ?? '',
      endDate: readDate(body, 'end_date', errors, false),
      baseSalary: readAmount(body?.base_salary, 'base_salary', errors, 1),
      allowances: readAllowances(body, errors),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.staff.createContract(currentUser, staffId, input, originOf(request, currentUser));
  }

  @Post('employment-contracts/:id/terminate')
  @HttpCode(200)
  terminate(
    @Param('id', uuidParameter('Mã hợp đồng không hợp lệ')) contractId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const terminatedOn = readDate(body, 'terminated_on', errors, true) ?? '';
    const reason = readRequiredText(body, 'reason', errors);
    if (reason.length > MAXIMUM_TEXT) {
      errors.push({ field: 'reason', message: `Tối đa ${MAXIMUM_TEXT} ký tự` });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.staff.terminateContract(
      currentUser,
      readBearerToken(request.header('authorization')),
      contractId,
      { terminatedOn, reason },
      originOf(request, currentUser),
    );
  }
}
