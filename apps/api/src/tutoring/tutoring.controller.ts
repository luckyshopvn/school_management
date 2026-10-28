import {
  Body,
  Controller,
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
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request, Response } from 'express';
import { AuthenticatedUser, RequirePermission, RequirePlanModule } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import type { RequestBody } from '../common/request-fields.js';
import { parseProgramInput, TutoringService } from './tutoring.js';

// Điểm cuối của gia sư trong trường (DT-27 phần 27b, YCTD-252): nhóm /tutoring cho giáo viên và Ban Giám hiệu (cổng quản trị, ứng
// dụng giáo viên), nhóm /children/{id}/tutoring cho cha mẹ (ứng dụng phụ huynh, theo quan hệ phụ huynh với học sinh)
const TEACH = PERMISSION_CODES.tutoringTeach;
const MANAGE = PERMISSION_CODES.tutoringManage;
const MAXIMUM_DECISION_BYTES = 10 * 1024 * 1024;

interface UploadedPart {
  originalname: string;
  size: number;
  buffer: Buffer;
  mimetype: string;
}

const reasonOf = (body: RequestBody) => (typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) : null);

@RequirePlanModule('tutoring')
@Controller('tutoring')
export class TutoringController {
  constructor(private readonly tutoring: TutoringService) {}

  @Get('meta')
  @RequirePermission(TEACH, MANAGE)
  meta(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.tutoring.meta(currentUser);
  }

  @Get('rules')
  @RequirePermission(TEACH, MANAGE)
  rules() {
    return this.tutoring.listRules();
  }

  @Post('rules')
  @RequirePermission(MANAGE)
  addRule(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser, @Req() request: Request) {
    return this.tutoring.addRule(currentUser, body, originOf(request, currentUser));
  }

  @Get('programs')
  @RequirePermission(TEACH, MANAGE)
  programs(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.tutoring.listPrograms(currentUser);
  }

  @Post('programs')
  @RequirePermission(TEACH, MANAGE)
  create(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser, @Req() request: Request) {
    return this.tutoring.saveProgram(currentUser, null, parseProgramBody(body), originOf(request, currentUser));
  }

  @Get('programs/:id')
  @RequirePermission(TEACH, MANAGE)
  program(@Param('id') id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.tutoring.getProgram(currentUser, id);
  }

  @Put('programs/:id')
  @RequirePermission(TEACH, MANAGE)
  update(
    @Param('id') id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Req() request: Request,
  ) {
    return this.tutoring.saveProgram(currentUser, id, parseProgramBody(body), originOf(request, currentUser));
  }

  @Post('programs/:id/submit')
  @HttpCode(200)
  @RequirePermission(TEACH, MANAGE)
  submit(
    @Param('id') id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Req() request: Request,
  ) {
    return this.tutoring.transition(currentUser, id, 'submit', reasonOf(body), originOf(request, currentUser));
  }

  @Post('programs/:id/approve')
  @HttpCode(200)
  @RequirePermission(TEACH, MANAGE)
  approve(
    @Param('id') id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Req() request: Request,
  ) {
    return this.tutoring.transition(currentUser, id, 'approve', reasonOf(body), originOf(request, currentUser));
  }

  @Post('programs/:id/reject')
  @HttpCode(200)
  @RequirePermission(TEACH, MANAGE)
  reject(
    @Param('id') id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Req() request: Request,
  ) {
    return this.tutoring.transition(currentUser, id, 'reject', reasonOf(body), originOf(request, currentUser));
  }

  @Post('programs/:id/close')
  @HttpCode(200)
  @RequirePermission(TEACH, MANAGE)
  close(
    @Param('id') id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Req() request: Request,
  ) {
    return this.tutoring.transition(currentUser, id, 'close', reasonOf(body), originOf(request, currentUser));
  }

  @Get('programs/:id/candidate-suggestions')
  @RequirePermission(TEACH, MANAGE)
  suggestions(@Param('id') id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.tutoring.suggestCandidates(currentUser, id);
  }

  @Put('programs/:id/candidates')
  @RequirePermission(TEACH, MANAGE)
  candidates(
    @Param('id') id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Req() request: Request,
  ) {
    return this.tutoring.setCandidates(currentUser, id, body, originOf(request, currentUser));
  }

  @Post('programs/:id/sessions')
  @RequirePermission(TEACH, MANAGE)
  createSessions(
    @Param('id') id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Req() request: Request,
  ) {
    return this.tutoring.createSessions(currentUser, id, body, originOf(request, currentUser));
  }

  @Get('programs/:id/registrations')
  @RequirePermission(TEACH, MANAGE)
  registrations(@Param('id') id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.tutoring.listRegistrations(currentUser, id);
  }

  @Post('programs/:id/messages')
  @RequirePermission(TEACH, MANAGE)
  message(
    @Param('id') id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Req() request: Request,
  ) {
    return this.tutoring.messageGuardian(currentUser, id, body, originOf(request, currentUser));
  }

  @Post('registrations/:id/approve')
  @HttpCode(200)
  @RequirePermission(TEACH, MANAGE)
  approveRegistration(
    @Param('id') id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Req() request: Request,
  ) {
    return this.tutoring.decideRegistration(currentUser, id, true, reasonOf(body), originOf(request, currentUser));
  }

  @Post('registrations/:id/reject')
  @HttpCode(200)
  @RequirePermission(TEACH, MANAGE)
  rejectRegistration(
    @Param('id') id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Req() request: Request,
  ) {
    return this.tutoring.decideRegistration(currentUser, id, false, reasonOf(body), originOf(request, currentUser));
  }

  @Get('sessions')
  @RequirePermission(TEACH, MANAGE)
  sessions(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const today = this.tutoring.today();
    return this.tutoring.listSessions(currentUser, from ?? today, to ?? from ?? today);
  }

  @Post('sessions/:id/cancel')
  @HttpCode(200)
  @RequirePermission(TEACH, MANAGE)
  cancel(
    @Param('id') id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Req() request: Request,
  ) {
    return this.tutoring.cancelSession(currentUser, id, reasonOf(body) ?? '', originOf(request, currentUser));
  }

  @Get('sessions/:id/attendance')
  @RequirePermission(TEACH, MANAGE)
  attendance(@Param('id') id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.tutoring.attendance(currentUser, id);
  }

  @Put('sessions/:id/attendance')
  @RequirePermission(TEACH, MANAGE)
  confirm(
    @Param('id') id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Req() request: Request,
  ) {
    return this.tutoring.confirmAttendance(currentUser, id, body, originOf(request, currentUser));
  }

  // Bộ giả lập nhật ký phòng video đến khi 27a gộp: giáo viên của buổi ghi sự kiện vào, ra để thử điểm danh gợi ý
  @Post('sessions/:id/room-events')
  @HttpCode(200)
  @RequirePermission(TEACH, MANAGE)
  async roomEvents(@Param('id') id: string, @Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    await this.tutoring.attendance(currentUser, id);
    const events = Array.isArray(body?.events) ? (body.events as Array<Record<string, unknown>>) : [];
    const parsed = events.slice(0, 200).map((event) => ({
      childId: String(event?.child_id ?? ''),
      kind: event?.kind === 'leave' ? ('leave' as const) : ('join' as const),
      at: new Date(String(event?.at ?? '')),
    }));
    if (parsed.length === 0 || parsed.some((event) => Number.isNaN(event.at.getTime()))) {
      throw validationError([{ field: 'events', message: 'Danh sách sự kiện vào, ra phòng không hợp lệ' }]);
    }
    return this.tutoring.recordRoomEvents(id, parsed, 'mock');
  }

  @Get('exemptions')
  @RequirePermission(MANAGE)
  exemptions() {
    return this.tutoring.listExemptions();
  }

  @Post('exemptions')
  @RequirePermission(MANAGE)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_DECISION_BYTES, files: 1 } }))
  createExemption(
    @UploadedFile() file: UploadedPart | undefined,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Req() request: Request,
  ) {
    const upload =
      file && file.size > 0
        ? {
            fileName: Buffer.from(file.originalname, 'latin1').toString('utf8'),
            body: file.buffer,
            contentType: file.mimetype,
          }
        : null;
    return this.tutoring.createExemption(currentUser, body, upload, originOf(request, currentUser));
  }

  @Get('exemptions/:id/file')
  @RequirePermission(MANAGE)
  async exemptionFile(@Param('id') id: string, @Res() response: Response) {
    const file = await this.tutoring.exemptionFile(id);
    response.setHeader('content-type', 'application/octet-stream');
    response.setHeader('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    response.send(file.body);
  }
}

// Cha mẹ xem chương trình mở cho con, gửi và rút đơn đăng ký, xem lịch học và điểm danh đã xác nhận
@RequirePlanModule('tutoring')
@Controller('children/:id/tutoring')
export class ChildTutoringController {
  constructor(private readonly tutoring: TutoringService) {}

  @Get()
  overview(@Param('id') childId: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.tutoring.childOverview(currentUser, childId);
  }

  @Post('registrations')
  register(
    @Param('id') childId: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Req() request: Request,
  ) {
    return this.tutoring.register(currentUser, childId, body, originOf(request, currentUser));
  }

  @Post('registrations/:registrationId/withdraw')
  @HttpCode(200)
  withdraw(
    @Param('id') childId: string,
    @Param('registrationId') registrationId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Req() request: Request,
  ) {
    return this.tutoring.withdraw(currentUser, childId, registrationId, originOf(request, currentUser));
  }
}

function parseProgramBody(body: RequestBody) {
  return parseProgramInput(body as Record<string, unknown> | undefined);
}
