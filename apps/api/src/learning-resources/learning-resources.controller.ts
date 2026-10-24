import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { validationError } from '@school-management/server';
import {
  LEARNING_RESOURCE_MAXIMUM_FILE_BYTES,
  PERMISSION_CODES,
  type LearningResourceReportKind,
} from '@school-management/shared';
import type { Response } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { isUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { parseLearningResource } from './learning-resource-rules.js';
import { LearningResourcesService } from './learning-resources.js';

// Điểm cuối kho học liệu số (DT-22 phần 22h1, YCTD-183)
const RESOURCE_PERMISSIONS = [
  PERMISSION_CODES.learningResourceUse,
  PERMISSION_CODES.learningResourceReview,
  PERMISSION_CODES.learningResourceApprove,
  PERMISSION_CODES.learningResourceManage,
];
const ID = 'Mã không hợp lệ';
const REPORT_KINDS: LearningResourceReportKind[] = ['content', 'file', 'copyright'];

interface UploadedPart {
  originalname: string;
  buffer: Buffer;
  size: number;
}

function sendBuffer(response: Response, file: { fileName: string; contentType: string; buffer: Buffer }) {
  response.setHeader('content-type', file.contentType);
  response.setHeader('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
  response.setHeader('cache-control', 'no-store');
  response.send(file.buffer);
}

function text(query: Record<string, unknown>, key: string, maximum = 200): string | null {
  const value = query[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim().slice(0, maximum) : null;
}

function uuidOrNull(query: Record<string, unknown>, key: string): string | null {
  const value = text(query, key);
  if (value !== null && !isUuid(value)) {
    throw validationError([{ field: key, message: ID }]);
  }
  return value;
}

function note(body: RequestBody, field = 'note'): string | null {
  const value = body?.[field];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string' || value.length > 2000) {
    throw validationError([{ field, message: 'Tối đa 2000 ký tự' }]);
  }
  return value.trim() === '' ? null : value.trim();
}

@Controller('learning-resources')
@RequirePermission(...RESOURCE_PERMISSIONS)
export class LearningResourcesController {
  constructor(private readonly resources: LearningResourcesService) {}

  // ---- Danh mục ----

  @Get('catalog')
  catalog() {
    return this.resources.catalog();
  }

  @Post('types')
  @RequirePermission(PERMISSION_CODES.learningResourceManage)
  createType(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.resources.saveType(currentUser, null, body);
  }

  @Patch('types/:id')
  @RequirePermission(PERMISSION_CODES.learningResourceManage)
  updateType(
    @Param('id', uuidParameter(ID)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.resources.saveType(currentUser, id, body);
  }

  @Post('licenses')
  @RequirePermission(PERMISSION_CODES.learningResourceManage)
  createLicense(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.resources.saveLicense(currentUser, null, body);
  }

  @Patch('licenses/:id')
  @RequirePermission(PERMISSION_CODES.learningResourceManage)
  updateLicense(
    @Param('id', uuidParameter(ID)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.resources.saveLicense(currentUser, id, body);
  }

  @Post('topics')
  createTopic(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.resources.saveTopic(currentUser, null, body);
  }

  @Patch('topics/:id')
  @RequirePermission(PERMISSION_CODES.learningResourceManage)
  updateTopic(
    @Param('id', uuidParameter(ID)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.resources.saveTopic(currentUser, id, body);
  }

  // ---- Bộ sưu tập (đặt trước :id) ----

  @Get('collections')
  collections(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.resources.collections(currentUser);
  }

  @Post('collections')
  createCollection(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.resources.saveCollection(currentUser, null, body);
  }

  @Get('collections/:id')
  collection(@Param('id', uuidParameter(ID)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.resources.collection(currentUser, id);
  }

  @Patch('collections/:id')
  updateCollection(
    @Param('id', uuidParameter(ID)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.resources.saveCollection(currentUser, id, body);
  }

  @Delete('collections/:id')
  @HttpCode(204)
  async deleteCollection(@Param('id', uuidParameter(ID)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    await this.resources.deleteCollection(currentUser, id);
  }

  @Put('collections/:id/items')
  setItems(
    @Param('id', uuidParameter(ID)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const ids = body?.resource_ids;
    if (!Array.isArray(ids) || ids.some((value) => !isUuid(value))) {
      throw validationError([{ field: 'resource_ids', message: 'Danh sách mã học liệu không hợp lệ' }]);
    }
    return this.resources.setCollectionItems(currentUser, id, ids as string[]);
  }

  @Get('collections/:id/export')
  async exportCollection(
    @Param('id', uuidParameter(ID)) id: string,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Res() response: Response,
  ) {
    sendBuffer(response, await this.resources.exportCollection(currentUser, id));
  }

  // ---- Báo lỗi, thống kê ----

  @Get('reports')
  reports(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.resources.reports(currentUser);
  }

  @Post('reports/:id/handle')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.learningResourceManage)
  handleReport(
    @Param('id', uuidParameter(ID)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const status = body?.status;
    if (status !== 'resolved' && status !== 'rejected') {
      throw validationError([{ field: 'status', message: 'Kết quả là resolved hoặc rejected' }]);
    }
    const response = note(body, 'response');
    if (!response) {
      throw validationError([{ field: 'response', message: 'Bắt buộc trả lời người báo lỗi' }]);
    }
    return this.resources.handleReport(currentUser, id, { status, response, hide: body?.hide === true });
  }

  @Get('statistics')
  @RequirePermission(
    PERMISSION_CODES.learningResourceReview,
    PERMISSION_CODES.learningResourceApprove,
    PERMISSION_CODES.learningResourceManage,
  )
  statistics(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.resources.statistics(currentUser);
  }

  // ---- Học liệu ----

  @Get()
  search(@Query() query: Record<string, unknown>, @AuthenticatedUser() currentUser: CurrentUser) {
    const scope = query.scope === 'mine' || query.scope === 'review' ? query.scope : 'all';
    return this.resources.search(currentUser, {
      q: text(query, 'q'),
      type_id: uuidOrNull(query, 'type_id'),
      school_level: text(query, 'school_level', 10),
      grade_level_code: text(query, 'grade_level_code', 20),
      subject_code: text(query, 'subject_code', 50),
      topic_id: uuidOrNull(query, 'topic_id'),
      license_id: uuidOrNull(query, 'license_id'),
      scope,
    });
  }

  @Post()
  create(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.resources.create(currentUser, parseLearningResource(body));
  }

  @Get(':id')
  detail(@Param('id', uuidParameter(ID)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.resources.detail(currentUser, id);
  }

  @Put(':id')
  update(
    @Param('id', uuidParameter(ID)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.resources.update(currentUser, id, parseLearningResource(body));
  }

  @Post(':id/files')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: LEARNING_RESOURCE_MAXIMUM_FILE_BYTES + 1, files: 1 } }),
  )
  addFile(
    @Param('id', uuidParameter(ID)) id: string,
    @UploadedFile() file: UploadedPart | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!file || file.size === 0) {
      throw validationError([{ field: 'file', message: 'Chọn tệp học liệu' }]);
    }
    return this.resources.addFile(currentUser, id, {
      fileName: Buffer.from(file.originalname, 'latin1').toString('utf8'),
      body: file.buffer,
    });
  }

  @Post(':id/links')
  addLink(
    @Param('id', uuidParameter(ID)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.resources.addLink(currentUser, id, body);
  }

  @Post(':id/lesson-plans')
  addLessonPlan(
    @Param('id', uuidParameter(ID)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!isUuid(body?.lesson_plan_id)) {
      throw validationError([{ field: 'lesson_plan_id', message: 'Bắt buộc chọn kế hoạch bài dạy' }]);
    }
    return this.resources.addLessonPlan(currentUser, id, body.lesson_plan_id);
  }

  @Post(':id/submit')
  @HttpCode(200)
  submit(@Param('id', uuidParameter(ID)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.resources.submit(currentUser, id);
  }

  @Post(':id/review')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.learningResourceReview, PERMISSION_CODES.learningResourceApprove)
  review(
    @Param('id', uuidParameter(ID)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const decision = body?.decision;
    if (decision !== 'approve' && decision !== 'return') {
      throw validationError([{ field: 'decision', message: 'Quyết định là approve hoặc return' }]);
    }
    return this.resources.review(currentUser, id, decision, note(body));
  }

  @Post(':id/:action(hide|restore|retire)')
  @HttpCode(200)
  lifecycle(
    @Param('id', uuidParameter(ID)) id: string,
    @Param('action') action: 'hide' | 'restore' | 'retire',
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.resources.setLifecycle(currentUser, id, action, note(body));
  }

  @Get(':id/download')
  async download(
    @Param('id', uuidParameter(ID)) id: string,
    @Query('version') version: string | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Res() response: Response,
  ) {
    const versionNo = version === undefined ? null : Number(version);
    if (versionNo !== null && (!Number.isInteger(versionNo) || versionNo < 1)) {
      throw validationError([{ field: 'version', message: 'Phiên bản là số nguyên dương' }]);
    }
    const result = await this.resources.download(currentUser, id, versionNo);
    if (result.kind === 'file') {
      sendBuffer(response, result);
      return;
    }
    response.json(result);
  }

  @Post(':id/reports')
  report(
    @Param('id', uuidParameter(ID)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const kind = body?.kind as LearningResourceReportKind;
    if (!REPORT_KINDS.includes(kind)) {
      throw validationError([{ field: 'kind', message: 'Loại báo lỗi là content, file hoặc copyright' }]);
    }
    const description = note(body, 'description');
    if (!description) {
      throw validationError([{ field: 'description', message: 'Bắt buộc mô tả lỗi' }]);
    }
    return this.resources.report(currentUser, id, kind, description);
  }
}
