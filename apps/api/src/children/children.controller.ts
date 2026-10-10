import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { ChildGender, ChildStatus, PhotoConsent } from '@school-management/database';
import { readBearerToken, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
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
import { ChildrenService, type ChildChanges, type GuardianInput, type HealthInput } from './children.service.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const NATIONAL_ID_PATTERN = /^\d{12}$/;
const PHONE_PATTERN = /^0\d{9}$/;
const GENDERS: ChildGender[] = ['male', 'female'];
const CONSENTS: PhotoConsent[] = ['granted', 'refused', 'pending'];
const STATUSES: ChildStatus[] = ['draft', 'pending', 'active', 'paused', 'withdrawn', 'graduated'];
const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

function readLimitedText(
  body: RequestBody,
  field: string,
  errors: FieldError[],
  maximum: number,
): string | null | undefined {
  const value = readOptionalText(body, field, errors);
  if (value && value.length > maximum) {
    errors.push({ field, message: `Tối đa ${maximum} ký tự` });
  }
  return value;
}

function readDate(body: RequestBody, field: string, errors: FieldError[], required: boolean): string | undefined {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    if (required) {
      errors.push({ field, message: 'Bắt buộc nhập' });
    }
    return undefined;
  }
  if (typeof value !== 'string' || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    errors.push({ field, message: 'Ngày dạng YYYY-MM-DD' });
    return undefined;
  }
  return value;
}

// Ngày sinh không lớn hơn ngày hiện tại (QT-01 mục 10)
function readBirthDate(body: RequestBody, errors: FieldError[], required: boolean): string | undefined {
  const dob = readDate(body, 'dob', errors, required);
  if (dob && dob > VIETNAM_DATE.format(new Date())) {
    errors.push({ field: 'dob', message: 'Ngày sinh không lớn hơn ngày hiện tại' });
  }
  return dob;
}

function readNationalId(body: RequestBody, errors: FieldError[], required: boolean): string | undefined {
  const value = body?.national_id;
  if (value === undefined || value === null || value === '') {
    if (required) {
      errors.push({ field: 'national_id', message: 'Bắt buộc nhập số định danh cá nhân' });
    }
    return undefined;
  }
  if (typeof value !== 'string' || !NATIONAL_ID_PATTERN.test(value.trim())) {
    errors.push({ field: 'national_id', message: 'Số định danh cá nhân gồm mười hai chữ số' });
    return undefined;
  }
  return value.trim();
}

function readHealth(value: unknown, errors: FieldError[]): HealthInput {
  const health = (value ?? {}) as Record<string, unknown>;
  const hasAllergies = health.has_allergies;
  if (hasAllergies !== undefined && hasAllergies !== null && typeof hasAllergies !== 'boolean') {
    errors.push({ field: 'health.has_allergies', message: 'Chọn có hoặc không có dị ứng' });
  }
  const allergies = readLimitedText(health, 'allergies', errors, 500) ?? null;
  if (hasAllergies === true && !allergies) {
    errors.push({ field: 'health.allergies', message: 'Cần ghi dị ứng gì' });
  }
  return {
    has_allergies: typeof hasAllergies === 'boolean' ? hasAllergies : null,
    allergies: hasAllergies === false ? null : allergies,
    chronic_conditions: readLimitedText(health, 'chronic_conditions', errors, 500) ?? null,
    blood_type: readLimitedText(health, 'blood_type', errors, 10) ?? null,
    note: readLimitedText(health, 'note', errors, 1000) ?? null,
  };
}

function readGuardian(value: unknown, field: string, errors: FieldError[]): GuardianInput {
  const guardian = (value ?? {}) as Record<string, unknown>;
  const localErrors: FieldError[] = [];
  const fullName = readRequiredText(guardian, 'full_name', localErrors);
  if (fullName.length > 100) {
    localErrors.push({ field: 'full_name', message: 'Tối đa 100 ký tự' });
  }
  const phone = readOptionalText(guardian, 'phone', localErrors) ?? null;
  if (phone && !PHONE_PATTERN.test(phone)) {
    localErrors.push({ field: 'phone', message: 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0' });
  }
  const relationship = readRequiredUuid(guardian, 'relationship_item_id', localErrors, 'Bắt buộc chọn quan hệ');
  errors.push(...localErrors.map((error) => ({ field: `${field}.${error.field}`, message: error.message })));
  return {
    full_name: fullName,
    phone,
    relationship_item_id: relationship,
    is_primary: guardian.is_primary === true,
    occupation: readOptionalText(guardian, 'occupation', errors) ?? null,
    email: readOptionalText(guardian, 'email', errors) ?? null,
    address: readOptionalText(guardian, 'address', errors) ?? null,
  };
}

// Hồ sơ trẻ (P02-01, 02, 03, 06, 10; QT-01; YCTD-45)
@Controller()
export class ChildrenController {
  constructor(private readonly childrenService: ChildrenService) {}

  @Get('children')
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.page_size ?? 20);
    if (!Number.isInteger(page) || page < 1) {
      errors.push({ field: 'page', message: 'Số trang bắt đầu từ 1' });
    }
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      errors.push({ field: 'page_size', message: 'Cỡ trang từ 1 đến 100' });
    }
    for (const field of ['org_unit_id', 'class_id']) {
      if (query[field] !== undefined && !isUuid(query[field])) {
        errors.push({ field, message: 'Mã không hợp lệ' });
      }
    }
    if (query.status !== undefined && !STATUSES.includes(query.status as ChildStatus)) {
      errors.push({ field: 'status', message: 'Trạng thái không hợp lệ' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.childrenService.list(currentUser, {
      orgUnitId: query.org_unit_id,
      classId: query.class_id,
      status: query.status as ChildStatus | undefined,
      q: query.q?.trim() || undefined,
      page,
      pageSize,
    });
  }

  @Get('children/check-duplicate')
  @RequirePermission(PERMISSION_CODES.childManage)
  checkDuplicate(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    if (!isUuid(query.org_unit_id)) {
      errors.push({ field: 'org_unit_id', message: 'Bắt buộc chọn đơn vị' });
    }
    if (!query.full_name?.trim()) {
      errors.push({ field: 'full_name', message: 'Bắt buộc nhập' });
    }
    if (!query.dob || !DATE_PATTERN.test(query.dob)) {
      errors.push({ field: 'dob', message: 'Ngày dạng YYYY-MM-DD' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.childrenService.findPossibleDuplicates(currentUser, {
      orgUnitId: query.org_unit_id ?? '',
      fullName: query.full_name ?? '',
      dob: query.dob ?? '',
    });
  }

  @Post('children')
  @RequirePermission(PERMISSION_CODES.childManage)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const fullName = readRequiredText(body, 'full_name', errors);
    if (fullName.length > 100) {
      errors.push({ field: 'full_name', message: 'Tối đa 100 ký tự' });
    }
    const gender = body?.gender as ChildGender;
    if (!GENDERS.includes(gender)) {
      errors.push({ field: 'gender', message: 'Giới tính là male hoặc female' });
    }
    const photoConsent = body?.photo_consent as PhotoConsent;
    if (!CONSENTS.includes(photoConsent)) {
      errors.push({
        field: 'photo_consent',
        message: 'Bắt buộc chọn đồng ý, không đồng ý hoặc chờ phụ huynh xác nhận',
      });
    }
    const rawGuardians = Array.isArray(body?.guardians) ? (body.guardians as unknown[]) : [];
    if (rawGuardians.length === 0) {
      errors.push({ field: 'guardians', message: 'Cần ít nhất một phụ huynh' });
    }
    const guardians = rawGuardians.map((guardian, index) => readGuardian(guardian, `guardians.${index}`, errors));
    if (guardians.filter((guardian) => guardian.is_primary).length > 1) {
      errors.push({ field: 'guardians', message: 'Chỉ một phụ huynh là liên hệ chính' });
    }
    const phones = guardians.map((guardian) => guardian.phone).filter((phone): phone is string => phone !== null);
    if (new Set(phones).size !== phones.length) {
      errors.push({ field: 'guardians', message: 'Hai phụ huynh không dùng chung một số điện thoại' });
    }
    const input = {
      org_unit_id: readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị'),
      full_name: fullName,
      dob: readBirthDate(body, errors, true) ?? '',
      gender,
      place_of_birth: readLimitedText(body, 'place_of_birth', errors, 200) ?? null,
      address: readLimitedText(body, 'address', errors, 300) ?? null,
      national_id: readNationalId(body, errors, true) ?? '',
      moet_student_code: readLimitedText(body, 'moet_student_code', errors, 50) ?? null,
      birth_certificate_file_id: readRequiredUuid(
        body,
        'birth_certificate_file_id',
        errors,
        'Bắt buộc tải bản chụp giấy khai sinh',
      ),
      special_needs_note: readLimitedText(body, 'special_needs_note', errors, 1000) ?? null,
      note: readLimitedText(body, 'note', errors, 1000) ?? null,
      is_staff_child: body?.is_staff_child === true,
      related_staff_user_id: readOptionalUuid(body, 'related_staff_user_id', errors) ?? null,
      related_staff_role_code: readOptionalText(body, 'related_staff_role_code', errors) ?? null,
      photo_consent: photoConsent,
      photo_consent_file_id: readOptionalUuid(body, 'photo_consent_file_id', errors) ?? null,
      health: readHealth(body?.health, errors),
      guardians,
      confirm_possible_duplicate: body?.confirm_possible_duplicate === true,
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.childrenService.create(
      currentUser,
      readBearerToken(request.header('authorization')),
      input,
      originOf(request, currentUser),
    );
  }

  @Get('children/:id')
  get(
    @Param('id', uuidParameter('Mã trẻ không hợp lệ')) childId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.childrenService.get(currentUser, childId);
  }

  @Patch('children/:id')
  @RequirePermission(PERMISSION_CODES.childManage, PERMISSION_CODES.childApprove)
  update(
    @Param('id', uuidParameter('Mã trẻ không hợp lệ')) childId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const changes: ChildChanges = {
      full_name: body?.full_name === undefined ? undefined : readRequiredText(body, 'full_name', errors),
      dob: readBirthDate(body, errors, false),
      place_of_birth: readLimitedText(body, 'place_of_birth', errors, 200),
      address: readLimitedText(body, 'address', errors, 300),
      national_id: readNationalId(body, errors, false),
      moet_student_code: readLimitedText(body, 'moet_student_code', errors, 50),
      birth_certificate_file_id: readOptionalUuid(body, 'birth_certificate_file_id', errors) ?? undefined,
      special_needs_note: readLimitedText(body, 'special_needs_note', errors, 1000),
      note: readLimitedText(body, 'note', errors, 1000),
      reason: readLimitedText(body, 'reason', errors, 500),
    };
    if (body?.gender !== undefined) {
      if (!GENDERS.includes(body.gender as ChildGender)) {
        errors.push({ field: 'gender', message: 'Giới tính là male hoặc female' });
      } else {
        changes.gender = body.gender as ChildGender;
      }
    }
    if (body?.health !== undefined) {
      const health = readHealth(body.health, errors);
      const provided = body.health as Record<string, unknown>;
      changes.health = Object.fromEntries(
        Object.entries(health).filter(([key]) => provided[key] !== undefined),
      ) as Partial<HealthInput>;
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.childrenService.update(currentUser, childId, changes, originOf(request, currentUser));
  }

  @Post('children/:id/submit')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.childManage)
  submit(
    @Param('id', uuidParameter('Mã trẻ không hợp lệ')) childId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.childrenService.submit(
      currentUser,
      readBearerToken(request.header('authorization')),
      childId,
      originOf(request, currentUser),
    );
  }

  @Post('children/:id/approve')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.childApprove)
  approve(
    @Param('id', uuidParameter('Mã trẻ không hợp lệ')) childId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const classId = readRequiredUuid(body, 'class_id', errors, 'Bắt buộc chọn lớp');
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.childrenService.approve(
      currentUser,
      readBearerToken(request.header('authorization')),
      childId,
      { classId, confirmOverCapacity: body?.confirm_over_capacity === true },
      originOf(request, currentUser),
    );
  }

  @Post('children/:id/reject')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.childApprove)
  reject(
    @Param('id', uuidParameter('Mã trẻ không hợp lệ')) childId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const reason = readRequiredText(body, 'reason', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.childrenService.reject(currentUser, childId, reason, originOf(request, currentUser));
  }

  @Get('children/:id/national-id')
  @RequirePermission(PERMISSION_CODES.nationalIdView)
  nationalId(
    @Param('id', uuidParameter('Mã trẻ không hợp lệ')) childId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.childrenService.nationalId(currentUser, childId, originOf(request, currentUser));
  }

  @Post('children/:id/guardians')
  @RequirePermission(PERMISSION_CODES.childManage, PERMISSION_CODES.childApprove)
  addGuardian(
    @Param('id', uuidParameter('Mã trẻ không hợp lệ')) childId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const guardian = readGuardian(body, 'guardian', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.childrenService.addGuardian(currentUser, childId, guardian, originOf(request, currentUser));
  }

  @Patch('children/:id/guardians/:guardianId')
  @RequirePermission(PERMISSION_CODES.childManage, PERMISSION_CODES.childApprove)
  setPrimaryGuardian(
    @Param('id', uuidParameter('Mã trẻ không hợp lệ')) childId: string,
    @Param('guardianId', uuidParameter('Mã phụ huynh không hợp lệ')) guardianId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (body?.is_primary !== true) {
      throw validationError([{ field: 'is_primary', message: 'Chỉ đặt được phụ huynh làm liên hệ chính' }]);
    }
    return this.childrenService.setPrimaryGuardian(currentUser, childId, guardianId, originOf(request, currentUser));
  }

  @Post('children/:id/transfer-class')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.childApprove)
  transferClass(
    @Param('id', uuidParameter('Mã trẻ không hợp lệ')) childId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const classId = readRequiredUuid(body, 'class_id', errors, 'Bắt buộc chọn lớp đích');
    const reason = readRequiredText(body, 'reason', errors);
    const fromDate = readDate(body, 'from_date', errors, false) ?? null;
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.childrenService.transferClass(
      currentUser,
      childId,
      { classId, fromDate, reason, confirmOverCapacity: body?.confirm_over_capacity === true },
      originOf(request, currentUser),
    );
  }

  @Get('classes/:id/children')
  classChildren(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.childrenService.classChildren(currentUser, classId);
  }
}
