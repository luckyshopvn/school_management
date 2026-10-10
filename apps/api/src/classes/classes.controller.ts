import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { AssignmentRole, ClassStatus } from '@school-management/database';
import { readBearerToken, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import {
  isUuid,
  readInteger,
  readOptionalText,
  readOptionalUuid,
  readRequiredInteger,
  readRequiredText,
  readRequiredUuid,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { ClassesService, type ClassChanges } from './classes.service.js';

const SIZE_RANGE = { min: 1, max: 200 };
const CLASS_STATUSES: ClassStatus[] = ['active', 'closed'];
const ASSIGNMENT_ROLES: AssignmentRole[] = ['homeroom', 'subject'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function readOptionalDate(body: RequestBody, field: string, errors: FieldError[]): string | null {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    errors.push({ field, message: 'Ngày dạng YYYY-MM-DD' });
    return null;
  }
  return value;
}

// Lớp học và phân công giáo viên (P02-05); ai có vai trò ở đơn vị đều xem được, P02.class.manage mới sửa được (YCTD-44)
@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Get()
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    if (query.org_unit_id !== undefined && !isUuid(query.org_unit_id)) {
      errors.push({ field: 'org_unit_id', message: 'Mã không hợp lệ' });
    }
    if (query.status !== undefined && !CLASS_STATUSES.includes(query.status as ClassStatus)) {
      errors.push({ field: 'status', message: 'Trạng thái là active hoặc closed' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.classesService.list(currentUser, {
      orgUnitId: query.org_unit_id,
      status: query.status as ClassStatus | undefined,
      gradeLevel: query.grade_level || undefined,
      mine: query.mine === 'true',
    });
  }

  @Post()
  @RequirePermission(PERMISSION_CODES.classManage)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      org_unit_id: readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị'),
      code: readRequiredText(body, 'code', errors),
      name: readRequiredText(body, 'name', errors),
      grade_level: readRequiredText(body, 'grade_level', errors),
      room_id: readOptionalUuid(body, 'room_id', errors) ?? null,
      max_size: readRequiredInteger(body, 'max_size', errors, SIZE_RANGE),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.classesService.create(currentUser, input, originOf(request, currentUser));
  }

  @Patch(':id')
  @RequirePermission(PERMISSION_CODES.classManage)
  update(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const changes: ClassChanges = {
      code: body?.code === undefined ? undefined : readRequiredText(body, 'code', errors),
      name: body?.name === undefined ? undefined : readRequiredText(body, 'name', errors),
      grade_level: body?.grade_level === undefined ? undefined : readRequiredText(body, 'grade_level', errors),
      room_id: readOptionalUuid(body, 'room_id', errors),
      max_size: readInteger(body, 'max_size', errors, SIZE_RANGE),
    };
    if (body?.status !== undefined) {
      if (!CLASS_STATUSES.includes(body.status as ClassStatus)) {
        errors.push({ field: 'status', message: 'Trạng thái là active hoặc closed' });
      } else {
        changes.status = body.status as ClassStatus;
      }
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.classesService.update(currentUser, classId, changes, originOf(request, currentUser));
  }

  @Get(':id/staff-assignments')
  listAssignments(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.classesService.listAssignments(currentUser, classId);
  }

  @Post(':id/staff-assignments')
  @RequirePermission(PERMISSION_CODES.classManage)
  addAssignment(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const staffUserId = readRequiredUuid(body, 'staff_user_id', errors, 'Bắt buộc chọn giáo viên');
    const role = body?.assignment_role;
    if (!ASSIGNMENT_ROLES.includes(role as AssignmentRole)) {
      errors.push({ field: 'assignment_role', message: 'Vai trò trong lớp là homeroom hoặc subject' });
    }
    const subjectName = readOptionalText(body, 'subject_name', errors) ?? null;
    if (role === 'subject' && !subjectName) {
      errors.push({ field: 'subject_name', message: 'Bắt buộc nhập môn dạy của giáo viên bộ môn' });
    }
    const fromDate = readOptionalDate(body, 'from_date', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.classesService.addAssignment(
      currentUser,
      readBearerToken(request.header('authorization')),
      classId,
      {
        staff_user_id: staffUserId,
        assignment_role: role as AssignmentRole,
        subject_name: subjectName,
        from_date: fromDate,
      },
      originOf(request, currentUser),
    );
  }

  @Patch(':id/staff-assignments/:assignmentId')
  @RequirePermission(PERMISSION_CODES.classManage)
  endAssignment(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Param('assignmentId', uuidParameter('Mã phân công không hợp lệ')) assignmentId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    if (body?.status !== 'ended') {
      errors.push({ field: 'status', message: 'Chỉ kết thúc được phân công, gửi status là ended' });
    }
    const toDate = readOptionalDate(body, 'to_date', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.classesService.endAssignment(
      currentUser,
      classId,
      assignmentId,
      toDate,
      originOf(request, currentUser),
    );
  }
}
