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
import { validationError } from '@school-management/server';
import {
  PERMISSION_CODES,
  PROCTOR_CONSENT_SCOPES,
  RECORDING_CHUNK_MAX_BYTES,
  type ProctorConsentScope,
} from '@school-management/shared';
import type { Request, Response } from 'express';
import {
  AuthenticatedUser,
  RequirePermission,
  StudentEndpoint,
  RequirePlanModule,
} from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import type { RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { ExamProctoringService, readSignalKind, readSignalPayload } from './exam-proctoring.js';

// Điểm cuối giám thị camera của thi trực tuyến (DT-23 phần 23e, YCTD-215): phía giáo viên (xem trực tiếp, xem lại bản ghi, đồng ý
// của cha mẹ), phía học sinh (trả lời xem trực tiếp, tải bản ghi), phía phụ huynh (đồng ý)
const ASSIGN = PERMISSION_CODES.examAssign;
const idPipe = () => uuidParameter('Mã không hợp lệ');

function readAfter(value: string | undefined): number {
  const number = Number(value ?? 0);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}

function readScope(value: unknown): ProctorConsentScope {
  if (!PROCTOR_CONSENT_SCOPES.includes(value as ProctorConsentScope)) {
    throw validationError([{ field: 'scope', message: 'Loại đồng ý là live hoặc record' }]);
  }
  return value as ProctorConsentScope;
}

function readGranted(body: RequestBody): boolean {
  if (typeof body?.granted !== 'boolean') {
    throw validationError([{ field: 'granted', message: 'Chọn đồng ý (true) hoặc thu hồi (false)' }]);
  }
  return body.granted;
}

function readChildId(body: RequestBody): string {
  if (typeof body?.child_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.child_id)) {
    throw validationError([{ field: 'child_id', message: 'Mã học sinh không hợp lệ' }]);
  }
  return body.child_id;
}

@RequirePlanModule('online-exam')
@Controller('online-exams')
export class ExamProctoringController {
  constructor(private readonly service: ExamProctoringService) {}

  @Get('proctor/ice')
  @RequirePermission(ASSIGN)
  ice(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.service.iceServers(`teacher-${currentUser.id}`);
  }

  @Post('attempts/:id/proctor/views')
  @HttpCode(200)
  @RequirePermission(ASSIGN)
  startView(@Param('id', idPipe()) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.service.startView(currentUser, id);
  }

  @Get('proctor/views/:viewId/signals')
  @RequirePermission(ASSIGN)
  poll(
    @Param('viewId', idPipe()) viewId: string,
    @Query('after') after: string | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.service.teacherPoll(currentUser, viewId, readAfter(after));
  }

  @Post('proctor/views/:viewId/signals')
  @HttpCode(200)
  @RequirePermission(ASSIGN)
  signal(
    @Param('viewId', idPipe()) viewId: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.service.teacherSignal(
      currentUser,
      viewId,
      readSignalKind(body?.kind),
      readSignalPayload(body?.payload),
    );
  }

  @Delete('proctor/views/:viewId')
  @RequirePermission(ASSIGN)
  endView(@Param('viewId', idPipe()) viewId: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.service.endView(currentUser, viewId);
  }

  @Get('attempts/:id/proctor')
  @RequirePermission(ASSIGN)
  attempt(@Param('id', idPipe()) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.service.attemptProctor(currentUser, id);
  }

  // Xem lại bản ghi: phát qua máy chủ, không cho tải xuống, không lưu đệm
  @Get('attempts/:id/recording')
  @RequirePermission(ASSIGN)
  async recording(
    @Param('id', idPipe()) id: string,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const parts = await this.service.recordingParts(currentUser, id, originOf(request, currentUser));
    response.setHeader('content-type', 'video/webm');
    response.setHeader('content-disposition', 'inline');
    response.setHeader('cache-control', 'no-store, private');
    response.setHeader('x-content-type-options', 'nosniff');
    for await (const part of parts) {
      response.write(part);
    }
    response.end();
  }

  @Get('assignments/:id/proctor/consents')
  @RequirePermission(ASSIGN)
  consents(@Param('id', idPipe()) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.service.assignmentConsents(currentUser, id);
  }

  @Put('proctor/consents')
  @RequirePermission(ASSIGN)
  recordConsent(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const guardian = typeof body?.guardian_name === 'string' ? body.guardian_name.trim().slice(0, 120) : '';
    const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 300) : '';
    return this.service.recordSchoolConsent(
      currentUser,
      {
        child_id: readChildId(body),
        scope: readScope(body?.scope),
        granted: readGranted(body),
        guardian_name: guardian || null,
        note: note || null,
      },
      originOf(request, currentUser),
    );
  }
}

@RequirePlanModule('online-exam')
@Controller('student')
@StudentEndpoint()
@RequirePermission(PERMISSION_CODES.examTake)
export class StudentProctoringController {
  constructor(private readonly service: ExamProctoringService) {}

  @Get('proctor/ice')
  ice(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.service.iceServers(`student-${currentUser.id}`);
  }

  @Get('attempts/:id/proctor')
  poll(
    @Param('id', idPipe()) id: string,
    @Query('after') after: string | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.service.studentPoll(currentUser, id, readAfter(after));
  }

  @Post('attempts/:id/proctor/signals')
  @HttpCode(200)
  signal(@Param('id', idPipe()) id: string, @Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    if (typeof body?.view_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.view_id)) {
      throw validationError([{ field: 'view_id', message: 'Mã phiên xem không hợp lệ' }]);
    }
    return this.service.studentSignal(
      currentUser,
      id,
      body.view_id,
      readSignalKind(body?.kind),
      readSignalPayload(body?.payload),
    );
  }

  @Post('attempts/:id/recording/chunks')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('chunk', { limits: { fileSize: RECORDING_CHUNK_MAX_BYTES, files: 1 } }))
  chunk(
    @Param('id', idPipe()) id: string,
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!file) {
      throw validationError([{ field: 'chunk', message: 'Thiếu đoạn bản ghi' }]);
    }
    return this.service.storeChunk(currentUser, id, Number(body?.seq), file.buffer);
  }
}

// Phụ huynh đồng ý cho con thi có xem trực tiếp, ghi hình: không cần quyền, máy chủ kiểm tra quan hệ phụ huynh với từng học sinh
@RequirePlanModule('online-exam')
@Controller('parent/exam-proctor-consents')
export class ParentProctorConsentsController {
  constructor(private readonly service: ExamProctoringService) {}

  @Get()
  list(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.service.listForParent(currentUser);
  }

  @Put()
  set(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.service.setForParent(
      currentUser,
      { child_id: readChildId(body), scope: readScope(body?.scope), granted: readGranted(body) },
      originOf(request, currentUser),
    );
  }
}
