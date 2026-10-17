import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import type { AssignmentRole, ClassAgeGroup, ClassStatus } from '@school-management/database';
import { readBearerToken, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request, Response } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import {
  readInteger,
  readOptionalText,
  readOptionalUuid,
  readRequiredInteger,
  readRequiredText,
  readRequiredUuid,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { sendWorkbook } from '../children/student-workbook.js';
import { readTableFileFormat } from '../exports/table-file.js';
import {
  CLASS_AGE_GROUP_KEYS,
  CLASS_EXPORT_COLUMNS,
  CLASS_STATUSES,
  DEFAULT_CLASS_EXPORT_COLUMNS,
  readClassListFilter,
  readExportColumns,
} from './class-list.js';
import { ClassesService, type AssignmentListFilter, type ClassChanges, type ClassInput } from './classes.service.js';

const SIZE_RANGE = { min: 1, max: 200 };
const SORT_ORDER_RANGE = { min: 0, max: 9999 };
const MIXED_AGE_COUNTS = [2, 3];
const ASSIGNMENT_ROLES: AssignmentRole[] = ['homeroom', 'subject'];
const ASSIGNMENT_STATES = ['assigned', 'unassigned'] as const;
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAXIMUM_BULK_CLASSES = 200;

// Danh sách mã lớp được chọn ở lưới, tối đa 200 lớp mỗi lần, không trùng
function readClassIds(body: RequestBody, errors: FieldError[]): string[] {
  const ids = body?.class_ids;
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.length > MAXIMUM_BULK_CLASSES ||
    ids.some((id) => typeof id !== 'string' || !UUID_PATTERN.test(id))
  ) {
    errors.push({ field: 'class_ids', message: `Chọn từ 1 đến ${MAXIMUM_BULK_CLASSES} lớp` });
    return [];
  }
  return [...new Set(ids as string[])];
}

type SoClassFields = Pick<
  ClassInput,
  | 'age_group'
  | 'sort_order'
  | 'two_sessions_per_day'
  | 'mixed_age_count'
  | 'is_combined'
  | 'combined_into_class_id'
  | 'boarding'
>;

// Thông tin lớp theo Sở (YCTD-111); trường không gửi thì không đổi (sửa) hoặc lấy mặc định (tạo)
function readSoClassFields(body: RequestBody, errors: FieldError[]): Partial<SoClassFields> {
  const fields: Partial<SoClassFields> = {};
  const ageGroup = body?.age_group;
  if (ageGroup !== undefined) {
    if (ageGroup === null || ageGroup === '') {
      fields.age_group = null;
    } else if (CLASS_AGE_GROUP_KEYS.includes(ageGroup as ClassAgeGroup)) {
      fields.age_group = ageGroup as ClassAgeGroup;
    } else {
      errors.push({ field: 'age_group', message: 'Nhóm tuổi không có trong danh mục' });
    }
  }
  if (body?.sort_order === null) {
    fields.sort_order = null;
  } else {
    const sortOrder = readInteger(body, 'sort_order', errors, SORT_ORDER_RANGE);
    if (sortOrder !== undefined) {
      fields.sort_order = sortOrder;
    }
  }
  const mixedAge = body?.mixed_age_count;
  if (mixedAge !== undefined) {
    if (mixedAge === null) {
      fields.mixed_age_count = null;
    } else if (MIXED_AGE_COUNTS.includes(mixedAge as number)) {
      fields.mixed_age_count = mixedAge as number;
    } else {
      errors.push({ field: 'mixed_age_count', message: 'Lớp ghép 2 hoặc 3 độ tuổi, hoặc bỏ trống' });
    }
  }
  for (const field of ['two_sessions_per_day', 'is_combined', 'boarding'] as const) {
    const value = body?.[field];
    if (value === undefined) {
      continue;
    }
    if (typeof value !== 'boolean') {
      errors.push({ field, message: 'Chọn true hoặc false' });
    } else {
      fields[field] = value;
    }
  }
  const combinedInto = readOptionalUuid(body, 'combined_into_class_id', errors);
  if (combinedInto !== undefined) {
    fields.combined_into_class_id = combinedInto;
  }
  return fields;
}

// Lớp học và phân công giáo viên (P02-05); ai có vai trò ở đơn vị đều xem được, P02.class.manage mới sửa được (YCTD-44)
@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Get()
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const filter = readClassListFilter(query, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.classesService.list(currentUser, { ...filter, mine: query.mine === 'true' });
  }

  // Xuất Excel hoặc PDF (DT-16 phần 16a) danh sách lớp theo bộ lọc và các cột đang hiện trên lưới; cần quyền xuất dữ liệu (BR-74, YCTD-111)
  @Post('export')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.dataExport)
  async exportList(
    @Body() body: RequestBody,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const filter = readClassListFilter(body ?? {}, errors);
    const columns = readExportColumns(body, CLASS_EXPORT_COLUMNS, DEFAULT_CLASS_EXPORT_COLUMNS, errors);
    const format = readTableFileFormat(body?.format);
    if (!format) {
      errors.push({ field: 'format', message: 'Định dạng xuất là xlsx hoặc pdf' });
    }
    if (errors.length > 0 || !format) {
      throw validationError(errors);
    }
    sendWorkbook(
      response,
      await this.classesService.exportList(currentUser, filter, columns, request.ip ?? null, format),
    );
  }

  // Xóa lớp và thao tác hàng loạt trên các lớp được chọn ở lưới (DT-16 phần 16e)
  @Post('delete')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.classManage)
  remove(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const ids = readClassIds(body, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.classesService.remove(currentUser, ids, originOf(request, currentUser));
  }

  @Post('bulk-update')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.classManage)
  bulkUpdate(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const ids = readClassIds(body, errors);
    const changes: Pick<ClassChanges, 'status' | 'two_sessions_per_day' | 'boarding'> = {};
    if (body?.status !== undefined) {
      if (!CLASS_STATUSES.includes(body.status as ClassStatus)) {
        errors.push({ field: 'status', message: 'Trạng thái là active hoặc closed' });
      } else {
        changes.status = body.status as ClassStatus;
      }
    }
    for (const field of ['two_sessions_per_day', 'boarding'] as const) {
      const value = body?.[field];
      if (value === undefined) {
        continue;
      }
      if (typeof value !== 'boolean') {
        errors.push({ field, message: 'Chọn true hoặc false' });
      } else {
        changes[field] = value;
      }
    }
    if (errors.length === 0 && Object.keys(changes).length === 0) {
      errors.push({ field: 'changes', message: 'Chọn ít nhất một thông tin cần đổi' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.classesService.bulkUpdate(currentUser, ids, changes, originOf(request, currentUser));
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
      age_group: null,
      sort_order: null,
      two_sessions_per_day: false,
      mixed_age_count: null,
      is_combined: false,
      combined_into_class_id: null,
      boarding: false,
      ...readSoClassFields(body, errors),
    };
    if (!input.is_combined) {
      input.combined_into_class_id = null;
    }
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
      ...readSoClassFields(body, errors),
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

// 3.3 Phân công phụ trách lớp (khảo sát mục 3.3, YCTD-111): ai xem được lớp đều xem được; phân công, kết thúc phân công vẫn
// qua nhóm điểm cuối của lớp (cần P02.class.manage); Xuất Excel cần quyền xuất dữ liệu
function readAssignmentFilter(query: Record<string, unknown>, errors: FieldError[]): AssignmentListFilter {
  const filter = readClassListFilter(
    { org_unit_id: query.org_unit_id, grade_level: query.grade_level, q: query.q },
    errors,
  );
  const role = query.assignment_role;
  if (role !== undefined && role !== null && role !== '' && !ASSIGNMENT_ROLES.includes(role as AssignmentRole)) {
    errors.push({ field: 'assignment_role', message: 'Vai trò trong lớp là homeroom hoặc subject' });
  }
  const assignment = query.assignment;
  if (assignment !== undefined && assignment !== null && assignment !== '' && !ASSIGNMENT_STATES.includes(assignment as never)) {
    errors.push({ field: 'assignment', message: 'Tình trạng phân công là assigned hoặc unassigned' });
  }
  return {
    orgUnitId: filter.orgUnitId,
    gradeLevel: filter.gradeLevel,
    q: filter.q,
    role: ASSIGNMENT_ROLES.includes(role as AssignmentRole) ? (role as AssignmentRole) : undefined,
    assignment: ASSIGNMENT_STATES.includes(assignment as never)
      ? (assignment as AssignmentListFilter['assignment'])
      : undefined,
  };
}

@Controller('class-assignments')
export class ClassAssignmentsController {
  constructor(private readonly classesService: ClassesService) {}

  @Get()
  list(
    @Query() query: Record<string, string | undefined>,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const filter = readAssignmentFilter(query, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.classesService.listAssignmentRows(
      currentUser,
      filter,
      readBearerToken(request.header('authorization')),
    );
  }

  @Post('export')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.dataExport)
  async export(
    @Body() body: RequestBody,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const filter = readAssignmentFilter(body ?? {}, errors);
    const format = readTableFileFormat(body?.format);
    if (!format) {
      errors.push({ field: 'format', message: 'Định dạng xuất là xlsx hoặc pdf' });
    }
    if (errors.length > 0 || !format) {
      throw validationError(errors);
    }
    sendWorkbook(
      response,
      await this.classesService.exportAssignments(
        currentUser,
        filter,
        request.ip ?? null,
        format,
        readBearerToken(request.header('authorization')),
      ),
    );
  }
}
