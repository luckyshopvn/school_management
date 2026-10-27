import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Req, Res } from '@nestjs/common';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request, Response } from 'express';
import {
  AuthenticatedUser,
  PublicEndpoint,
  RequirePermission,
  StudentEndpoint,
} from '../../authentication/authentication.guard.js';
import type { CurrentUser } from '../../authentication/current-user.js';
import type { RequestBody } from '../../common/request-fields.js';
import { uuidParameter } from '../../common/uuid-parameter.js';
import { AdmissionsRateLimiter } from '../../admissions/public-rate-limit.js';
import { RecognitionService } from './recognition.js';

// Tuyến huy hiệu, chứng nhận hoàn thành (DT-28 phần 28i, YCTD-279). Cấu hình của trường chỉ Ban Giám hiệu (kiểm ở dịch vụ); trao,
// thu hồi huy hiệu, cấp, thu hồi chứng nhận cho giáo viên của lớp học trực tuyến; phụ huynh kiểm theo học sinh; học sinh ở kênh
// student; trang kiểm tra chứng nhận công khai theo tên miền của trường, có giới hạn tần suất
const STAFF_PERMISSIONS = [
  PERMISSION_CODES.learningTeach,
  PERMISSION_CODES.learningTemplate,
  PERMISSION_CODES.learningDecide,
  PERMISSION_CODES.learningView,
];
const ID = uuidParameter('Mã không hợp lệ');

// Nguồn gốc của trang (đường dẫn kiểm tra in trên chứng nhận): tiêu đề Origin nếu có, không thì giao thức và tên miền của yêu cầu
function originOf(request: Request): string {
  const origin = request.header('origin');
  if (origin && /^https?:\/\/[^/]+$/.test(origin)) return origin;
  const protocol = request.header('x-forwarded-proto')?.split(',')[0]?.trim() || request.protocol;
  return `${protocol}://${request.header('x-forwarded-host') ?? request.header('host') ?? 'localhost'}`;
}

function sendPdf(response: Response, file: { fileName: string; body: Buffer }) {
  response.setHeader('content-type', 'application/pdf');
  response.setHeader('content-disposition', `attachment; filename="${file.fileName}"`);
  response.setHeader('cache-control', 'no-store');
  response.send(file.body);
}

@Controller('learning')
export class RecognitionController {
  constructor(private readonly recognition: RecognitionService) {}

  @RequirePermission(...STAFF_PERMISSIONS)
  @Get('recognition/config')
  config(@AuthenticatedUser() user: CurrentUser) {
    return this.recognition.config(user);
  }

  @RequirePermission(...STAFF_PERMISSIONS)
  @Put('recognition/config')
  saveConfig(@Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.recognition.saveConfig(user, body);
  }

  @RequirePermission(...STAFF_PERMISSIONS)
  @Get('spaces/:id/recognition')
  space(@Param('id', ID) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.recognition.spaceRecognition(user, id);
  }

  @RequirePermission(...STAFF_PERMISSIONS)
  @Post('spaces/:id/badges')
  award(@Param('id', ID) id: string, @Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.recognition.award(user, id, body);
  }

  @RequirePermission(...STAFF_PERMISSIONS)
  @Delete('badges/:id')
  revokeBadge(@Param('id', ID) id: string, @Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.recognition.revokeBadge(user, id, body);
  }

  @RequirePermission(...STAFF_PERMISSIONS)
  @Post('spaces/:id/certificates')
  issue(@Param('id', ID) id: string, @Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.recognition.issueCertificate(user, id, body);
  }

  @RequirePermission(...STAFF_PERMISSIONS)
  @Post('certificates/:id/revoke')
  @HttpCode(200)
  revoke(@Param('id', ID) id: string, @Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.recognition.revokeCertificate(user, id, body);
  }

  // Phụ huynh (và cán bộ xem được lớp): không gắn quyền, kiểm theo học sinh như lõi 28b
  @Get('children/:childId/recognition')
  child(@Param('childId', ID) childId: string, @AuthenticatedUser() user: CurrentUser) {
    return this.recognition.childRecognition(user, childId);
  }

  @Get('certificates/:id/pdf')
  async pdf(
    @Param('id', ID) id: string,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    sendPdf(response, await this.recognition.staffOrGuardianPdf(user, id, originOf(request)));
  }
}

@Controller('student/recognition')
@StudentEndpoint()
@RequirePermission(PERMISSION_CODES.learningStudy)
export class StudentRecognitionController {
  constructor(private readonly recognition: RecognitionService) {}

  @Get()
  mine(@AuthenticatedUser() user: CurrentUser) {
    return this.recognition.studentRecognition(user);
  }

  @Get('certificates/:id/pdf')
  async pdf(
    @Param('id', ID) id: string,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    sendPdf(response, await this.recognition.studentPdf(user, id, originOf(request)));
  }
}

@Controller('public/certificates')
@PublicEndpoint()
export class PublicCertificatesController {
  constructor(
    private readonly recognition: RecognitionService,
    private readonly limiter: AdmissionsRateLimiter,
  ) {}

  @Get(':code')
  async verify(@Param('code') code: string, @Req() request: Request, @Res() response: Response) {
    this.limiter.hit('read', request.ip);
    const result = await this.recognition.verify(code);
    response
      .status(result.found ? 200 : 404)
      .setHeader('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'")
      .setHeader('x-content-type-options', 'nosniff')
      .setHeader('referrer-policy', 'no-referrer')
      .setHeader('cache-control', 'no-store')
      .type('text/html; charset=utf-8')
      .send(result.html);
  }
}
