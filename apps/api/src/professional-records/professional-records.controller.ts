import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
import type { ProfessionalBranch, ProfessionalDocumentStatus } from '@school-management/database';
import { validationError, type FieldError } from '@school-management/server';
import {
  KPI_SCHOOL_LEVELS,
  PERMISSION_CODES,
  PROFESSIONAL_APPROVAL_FLOW_LABELS,
  PROFESSIONAL_BRANCH_LABELS,
  PROFESSIONAL_MAXIMUM_FILE_BYTES,
  PROFESSIONAL_STATUS_LABELS,
  type KpiSchoolLevelCode,
} from '@school-management/shared';
import type { Request, Response } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import { isUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import {
  readBoolean,
  readChoice,
  readDate,
  readInteger,
  readText,
  readUuid,
  readUuidList,
  throwIfAny,
} from '../incoming-documents/incoming-fields.js';
import {
  PROFESSIONAL_PERMISSIONS,
  ProfessionalRecordsService,
  type DocumentFilter,
  type FolderInput,
  type RoundInput,
} from './professional-records.js';

// Điểm cuối của hồ sơ chuyên môn (DT-18 phần 18e, YCTD-142). Bộ bảo vệ chỉ chặn người không có quyền nào của hồ sơ chuyên
// môn; chủ hồ sơ, tổ trưởng của tổ, trưởng nhóm, phạm vi đơn vị của Ban Giám hiệu và người quản lý kho kiểm tra ở dịch vụ
const MANAGE = PERMISSION_CODES.professionalRecordManage;
const DOCUMENT_MESSAGE = 'Mã hồ sơ không hợp lệ';
const VIEWS = new Set(['mine', 'groups', 'school', 'review']);
const LEVEL_LABELS = Object.fromEntries(KPI_SCHOOL_LEVELS.map((level) => [level.value, level.label])) as Record<
  KpiSchoolLevelCode,
  string
>;
// Hạn nộp nhập dạng YYYY-MM-DDTHH:mm theo giờ Việt Nam hoặc thời điểm ISO đầy đủ
const DUE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

interface UploadedPart {
  originalname: string;
  size: number;
  buffer: Buffer;
}

function readNote(body: RequestBody, required = false): string | null {
  const errors: FieldError[] = [];
  const note = readText(body, 'note', errors, { maximum: 2000, required });
  throwIfAny(errors);
  return note;
}

function readFolder(body: RequestBody): FolderInput {
  const errors: FieldError[] = [];
  const branch = readChoice(body, 'branch', PROFESSIONAL_BRANCH_LABELS, 'personal', errors);
  if (!body?.branch) {
    errors.push({ field: 'branch', message: 'Bắt buộc chọn' });
  }
  const level = body?.school_level;
  let schoolLevel: KpiSchoolLevelCode | null = null;
  if (level !== undefined && level !== null && level !== '') {
    schoolLevel = readChoice(body, 'school_level', LEVEL_LABELS, 'MN', errors);
  }
  const input: FolderInput = {
    parent_id: readUuid(body, 'parent_id', errors),
    branch,
    name: readText(body, 'name', errors, { required: true, maximum: 200 }) ?? '',
    description: readText(body, 'description', errors, { maximum: 1000 }),
    school_level: schoolLevel,
    approval_flow: readChoice(body, 'approval_flow', PROFESSIONAL_APPROVAL_FLOW_LABELS, 'two_level', errors),
    requires_signing: readBoolean(body, 'requires_signing', errors),
    sort_order: readInteger(body, 'sort_order', errors, { min: 0, max: 100000 }, 0) ?? 0,
    status: readChoice<'active' | 'inactive'>(
      body,
      'status',
      { active: 'Đang dùng', inactive: 'Ngừng dùng' },
      'active',
      errors,
    ),
  };
  throwIfAny(errors);
  return input;
}

function readDue(body: RequestBody, errors: FieldError[]): Date {
  const value = body?.due_at;
  if (typeof value !== 'string' || value === '') {
    errors.push({ field: 'due_at', message: 'Bắt buộc nhập' });
    return new Date(0);
  }
  const parsed = DUE_PATTERN.test(value) ? new Date(`${value}:00+07:00`) : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    errors.push({ field: 'due_at', message: 'Hạn nộp dạng YYYY-MM-DDTHH:mm' });
    return new Date(0);
  }
  return parsed;
}

function readRound(body: RequestBody): RoundInput {
  const errors: FieldError[] = [];
  const departments = readUuidList(body, 'department_ids', errors);
  const input: RoundInput = {
    folder_id: readUuid(body, 'folder_id', errors, true) ?? '',
    title: readText(body, 'title', errors, { required: true, maximum: 300 }) ?? '',
    description: readText(body, 'description', errors, { maximum: 2000 }),
    submitter_kind: readChoice<'staff' | 'group'>(
      body,
      'submitter_kind',
      { staff: 'Cá nhân', group: 'Tổ, nhóm' },
      'staff',
      errors,
    ),
    org_unit_id: readUuid(body, 'org_unit_id', errors),
    department_ids: departments.length > 0 ? departments : null,
    opens_on: readDate(body, 'opens_on', errors, true) ?? '',
    due_at: readDue(body, errors),
  };
  throwIfAny(errors);
  return input;
}

function readFilter(query: Record<string, unknown>): DocumentFilter {
  const errors: FieldError[] = [];
  const view = typeof query.view === 'string' && VIEWS.has(query.view) ? query.view : 'mine';
  const pick = (field: string) => {
    const value = query[field];
    if (value === undefined || value === '') {
      return null;
    }
    if (!isUuid(value)) {
      errors.push({ field, message: 'Mã không hợp lệ' });
      return null;
    }
    return value;
  };
  const status = typeof query.status === 'string' && query.status in PROFESSIONAL_STATUS_LABELS ? query.status : null;
  const q = typeof query.q === 'string' && query.q.trim() !== '' ? query.q.trim().slice(0, 200) : null;
  const filter: DocumentFilter = {
    view: view as DocumentFilter['view'],
    all: query.all === 'true',
    folder_id: pick('folder_id'),
    round_id: pick('round_id'),
    status: status as ProfessionalDocumentStatus | null,
    q,
    processed: query.processed === 'true',
  };
  throwIfAny(errors);
  return filter;
}

function sendFile(response: Response, file: { file_name: string; content_type: string }, body: Buffer) {
  response.setHeader('content-type', file.content_type);
  response.setHeader('content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.file_name)}`);
  response.setHeader('cache-control', 'no-store');
  response.send(body);
}

@Controller()
@RequirePermission(...PROFESSIONAL_PERMISSIONS)
export class ProfessionalRecordsController {
  constructor(private readonly records: ProfessionalRecordsService) {}

  @Get('professional-records/overview')
  overview(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.records.overview(currentUser);
  }

  @Get('professional-records/options')
  options(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.records.options(currentUser);
  }

  @Put('professional-records/lock')
  @RequirePermission(MANAGE)
  lock(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const locked = readBoolean(body, 'locked', errors);
    throwIfAny(errors);
    return this.records.setLock(currentUser, locked, originOf(request, currentUser));
  }

  @Get('professional-records/statistics')
  statistics(@Query('round_id') roundId: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    if (roundId !== undefined && roundId !== '' && !isUuid(roundId)) {
      throw validationError([{ field: 'round_id', message: 'Mã đợt không hợp lệ' }]);
    }
    return this.records.statistics(currentUser, roundId || null);
  }

  // ---- Thư mục ----

  @Get('professional-folders')
  folders(
    @Query('branch') branch: string | undefined,
    @Query('include_inactive') includeInactive: string | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const value = branch && branch in PROFESSIONAL_BRANCH_LABELS ? (branch as ProfessionalBranch) : null;
    return this.records.folders(currentUser, value, includeInactive === 'true');
  }

  @Post('professional-folders')
  @RequirePermission(MANAGE)
  createFolder(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.records.createFolder(currentUser, readFolder(body), originOf(request, currentUser));
  }

  @Post('professional-folders/defaults')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  defaults(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    if (!body?.school_level) {
      errors.push({ field: 'school_level', message: 'Bắt buộc chọn cấp học' });
    }
    const level = readChoice(body, 'school_level', LEVEL_LABELS, 'MN', errors);
    throwIfAny(errors);
    return this.records.loadDefaults(currentUser, level, originOf(request, currentUser));
  }

  @Put('professional-folders/:id')
  @RequirePermission(MANAGE)
  updateFolder(
    @Param('id', uuidParameter('Mã thư mục không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.records.updateFolder(currentUser, id, readFolder(body), originOf(request, currentUser));
  }

  @Delete('professional-folders/:id')
  @HttpCode(204)
  @RequirePermission(MANAGE)
  async deleteFolder(
    @Param('id', uuidParameter('Mã thư mục không hợp lệ')) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    await this.records.deleteFolder(currentUser, id, originOf(request, currentUser));
  }

  // ---- Nhóm công tác ----

  @Get('professional-work-groups')
  workGroups(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.records.workGroups(currentUser);
  }

  @Post('professional-work-groups')
  @RequirePermission(MANAGE)
  createWorkGroup(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.records.saveWorkGroup(currentUser, null, readWorkGroup(body), originOf(request, currentUser));
  }

  @Put('professional-work-groups/:id')
  @RequirePermission(MANAGE)
  updateWorkGroup(
    @Param('id', uuidParameter('Mã nhóm không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.records.saveWorkGroup(currentUser, id, readWorkGroup(body), originOf(request, currentUser));
  }

  // ---- Đợt nộp ----

  @Get('professional-rounds')
  rounds(@Query('status') status: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    const value = status === 'open' || status === 'closed' ? status : 'all';
    return this.records.rounds(currentUser, value);
  }

  @Post('professional-rounds')
  @RequirePermission(MANAGE)
  createRound(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.records.createRound(currentUser, readRound(body), originOf(request, currentUser));
  }

  @Put('professional-rounds/:id')
  @RequirePermission(MANAGE)
  updateRound(
    @Param('id', uuidParameter('Mã đợt không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.records.updateRound(currentUser, id, readRound(body), originOf(request, currentUser));
  }

  @Post('professional-rounds/:id/close')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  close(
    @Param('id', uuidParameter('Mã đợt không hợp lệ')) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.records.setRoundStatus(currentUser, id, 'closed', originOf(request, currentUser));
  }

  @Post('professional-rounds/:id/reopen')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  reopen(
    @Param('id', uuidParameter('Mã đợt không hợp lệ')) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.records.setRoundStatus(currentUser, id, 'open', originOf(request, currentUser));
  }

  @Get('professional-rounds/:id/status')
  roundStatus(
    @Param('id', uuidParameter('Mã đợt không hợp lệ')) id: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.records.roundStatus(currentUser, id);
  }

  @Post('professional-rounds/:id/remind')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  remind(@Param('id', uuidParameter('Mã đợt không hợp lệ')) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.records.remind(currentUser, id);
  }

  // ---- Hồ sơ ----

  @Get('professional-documents')
  list(@Query() query: Record<string, unknown>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.records.list(currentUser, readFilter(query));
  }

  @Post('professional-documents')
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      folder_id: readUuid(body, 'folder_id', errors, true) ?? '',
      round_id: readUuid(body, 'round_id', errors),
      title: readText(body, 'title', errors, { required: true, maximum: 300 }) ?? '',
      description: readText(body, 'description', errors, { maximum: 2000 }),
      department_id: readUuid(body, 'department_id', errors),
      work_group_id: readUuid(body, 'work_group_id', errors),
    };
    throwIfAny(errors);
    return this.records.create(currentUser, input, originOf(request, currentUser));
  }

  @Get('professional-documents/:id')
  view(@Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.records.view(currentUser, id);
  }

  @Put('professional-documents/:id')
  update(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = {
      title: readText(body, 'title', errors, { required: true, maximum: 300 }) ?? '',
      description: readText(body, 'description', errors, { maximum: 2000 }),
    };
    throwIfAny(errors);
    return this.records.update(currentUser, id, input, originOf(request, currentUser));
  }

  @Delete('professional-documents/:id')
  @HttpCode(204)
  async remove(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    await this.records.remove(currentUser, id, originOf(request, currentUser));
  }

  @Post('professional-documents/:id/versions')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: PROFESSIONAL_MAXIMUM_FILE_BYTES, files: 1 } }))
  upload(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @UploadedFile() file: UploadedPart | undefined,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!file || file.size === 0) {
      throw validationError([{ field: 'file', message: 'Bắt buộc chọn tệp' }]);
    }
    return this.records.upload(
      currentUser,
      id,
      { fileName: Buffer.from(file.originalname, 'latin1').toString('utf8'), body: file.buffer },
      readNote(body),
      originOf(request, currentUser),
    );
  }

  @Get('professional-documents/:id/versions/:versionId/file')
  async versionFile(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @Param('versionId', uuidParameter('Mã phiên bản không hợp lệ')) versionId: string,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const { file, body } = await this.records.versionFile(currentUser, id, versionId);
    sendFile(response, file, body);
  }

  @Get('professional-documents/:id/signed-file')
  async signedFile(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const { file, body } = await this.records.signedFile(currentUser, id);
    sendFile(response, file, body);
  }

  @Post('professional-documents/:id/submit')
  @HttpCode(200)
  submit(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.records.submit(currentUser, id, readNote(body));
  }

  @Post('professional-documents/:id/withdraw')
  @HttpCode(200)
  withdraw(@Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.records.withdraw(currentUser, id);
  }

  @Post('professional-documents/:id/leader-approve')
  @HttpCode(200)
  leaderApprove(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.records.leaderApprove(currentUser, id, readNote(body));
  }

  @Post('professional-documents/:id/approve')
  @HttpCode(200)
  approve(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.records.approve(currentUser, id, readNote(body));
  }

  @Post('professional-documents/:id/return')
  @HttpCode(200)
  giveBack(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.records.giveBack(currentUser, id, readNote(body, true) as string);
  }
}

function readWorkGroup(body: RequestBody) {
  const errors: FieldError[] = [];
  const raw = body?.members;
  const members: Array<{ staff_id: string; is_leader: boolean }> = [];
  if (raw !== undefined && raw !== null) {
    if (!Array.isArray(raw) || raw.length > 200) {
      errors.push({ field: 'members', message: 'Danh sách thành viên tối đa 200 người' });
    } else {
      for (const item of raw as Array<Record<string, unknown>>) {
        if (!item || !isUuid(item.staff_id)) {
          errors.push({ field: 'members', message: 'Mã nhân sự không hợp lệ' });
          break;
        }
        if (!members.some((member) => member.staff_id === item.staff_id)) {
          members.push({ staff_id: item.staff_id, is_leader: item.is_leader === true });
        }
      }
    }
  }
  const input = {
    org_unit_id: readUuid(body, 'org_unit_id', errors, true) ?? '',
    name: readText(body, 'name', errors, { required: true, maximum: 200 }) ?? '',
    description: readText(body, 'description', errors, { maximum: 1000 }),
    status: readChoice<'active' | 'inactive'>(
      body,
      'status',
      { active: 'Đang dùng', inactive: 'Ngừng dùng' },
      'active',
      errors,
    ),
    members,
  };
  throwIfAny(errors);
  return input;
}
