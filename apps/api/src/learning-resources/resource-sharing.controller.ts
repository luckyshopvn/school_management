import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { ResourceQuestionItemKind } from '@school-management/database';
import { validationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Response } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { isUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { MAXIMUM_PACKAGE_BYTES, parseRubric } from './resource-sharing-rules.js';
import { ResourceSharingService } from './resource-sharing.js';

// Điểm cuối kho học liệu, phần câu hỏi và chia sẻ (DT-22 phần 22h2, YCTD-184). Tiền tố riêng để không lẫn với
// `/learning-resources/{id}` của 22h1
const RESOURCE_PERMISSIONS = [
  PERMISSION_CODES.learningResourceUse,
  PERMISSION_CODES.learningResourceReview,
  PERMISSION_CODES.learningResourceApprove,
  PERMISSION_CODES.learningResourceManage,
  PERMISSION_CODES.learningResourceShare,
];
const ID = 'Mã không hợp lệ';
const KINDS: ResourceQuestionItemKind[] = ['question', 'exam', 'matrix'];
const COGNITIVE = ['recognition', 'comprehension', 'application', 'high_application'];

interface UploadedPart {
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

@Controller('resource-sharing')
@RequirePermission(...RESOURCE_PERMISSIONS)
export class ResourceSharingController {
  constructor(private readonly sharing: ResourceSharingService) {}

  // ---- Câu hỏi, đề, ma trận của ngân hàng trong kho ----

  @Get('bank')
  bank(@Query() query: Record<string, unknown>, @AuthenticatedUser() currentUser: CurrentUser) {
    const kind = (text(query, 'kind') ?? 'question') as ResourceQuestionItemKind;
    const subjectId = text(query, 'subject_id');
    const level = text(query, 'cognitive_level');
    if (!KINDS.includes(kind) || (subjectId && !isUuid(subjectId)) || (level && !COGNITIVE.includes(level))) {
      throw validationError([{ field: 'query', message: 'Bộ lọc không hợp lệ' }]);
    }
    return this.sharing.bank(currentUser, {
      kind,
      q: text(query, 'q'),
      subject_id: subjectId,
      grade_level_code: text(query, 'grade_level_code', 20),
      cognitive_level: level,
    });
  }

  @Get('statistics')
  statistics(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.sharing.statistics(currentUser);
  }

  @Get('collections/:id/items')
  collectionItems(@Param('id', uuidParameter(ID)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.sharing.collectionItems(currentUser, id);
  }

  @Put('collections/:id/items')
  setCollectionItems(
    @Param('id', uuidParameter(ID)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const items = Array.isArray(body?.items) ? (body.items as Array<Record<string, unknown>>) : null;
    if (!items || items.some((item) => !KINDS.includes(item?.kind as ResourceQuestionItemKind) || !isUuid(item?.id))) {
      throw validationError([{ field: 'items', message: 'Mỗi mục có kind (question, exam, matrix) và id' }]);
    }
    return this.sharing.setCollectionItems(
      currentUser,
      id,
      items.map((item) => ({ kind: item.kind as ResourceQuestionItemKind, id: item.id as string })),
    );
  }

  // ---- Rubric ----

  @Get('rubrics')
  rubrics(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.sharing.rubrics(currentUser);
  }

  @Post('rubrics')
  createRubric(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.sharing.saveRubric(currentUser, null, parseRubric(body));
  }

  @Put('rubrics/:id')
  updateRubric(
    @Param('id', uuidParameter(ID)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.sharing.saveRubric(currentUser, id, parseRubric(body));
  }

  @Post('rubrics/:id/clone')
  cloneRubric(@Param('id', uuidParameter(ID)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.sharing.cloneRubric(currentUser, id);
  }

  @Post('rubrics/:id/archive')
  @HttpCode(200)
  archiveRubric(@Param('id', uuidParameter(ID)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.sharing.setRubricStatus(currentUser, id, 'archived');
  }

  @Post('rubrics/:id/restore')
  @HttpCode(200)
  restoreRubric(@Param('id', uuidParameter(ID)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.sharing.setRubricStatus(currentUser, id, 'active');
  }

  @Get('rubrics/:id/print')
  async printRubric(
    @Param('id', uuidParameter(ID)) id: string,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Res() response: Response,
  ) {
    sendBuffer(response, await this.sharing.printRubric(currentUser, id));
  }

  // ---- Gói chia sẻ liên trường ----

  @Get('packages/preview')
  @RequirePermission(PERMISSION_CODES.learningResourceShare)
  preview(@Query('collection_id') collectionId: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    if (!isUuid(collectionId)) {
      throw validationError([{ field: 'collection_id', message: 'Chọn bộ sưu tập' }]);
    }
    return this.sharing.packagePreview(currentUser, collectionId);
  }

  @Get('packages/export')
  @RequirePermission(PERMISSION_CODES.learningResourceShare)
  async exportPackage(
    @Query() query: Record<string, unknown>,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Res() response: Response,
  ) {
    const collectionId = text(query, 'collection_id');
    const school = text(query, 'source_school', 300);
    if (!isUuid(collectionId) || !school) {
      throw validationError([{ field: 'source_school', message: 'Chọn bộ sưu tập, ghi tên trường nguồn' }]);
    }
    sendBuffer(response, await this.sharing.exportPackage(currentUser, collectionId, school));
  }

  @Get('packages/imports')
  @RequirePermission(PERMISSION_CODES.learningResourceShare)
  imports(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.sharing.packageImports(currentUser);
  }

  @Post('packages/import')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.learningResourceShare)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_PACKAGE_BYTES, files: 1 } }))
  importPackage(@UploadedFile() file: UploadedPart | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    if (!file || file.size === 0) {
      throw validationError([{ field: 'file', message: 'Bắt buộc chọn tệp gói' }]);
    }
    return this.sharing.importPackage(currentUser, file.buffer);
  }
}
