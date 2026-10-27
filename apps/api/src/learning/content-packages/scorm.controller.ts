import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request, Response } from 'express';
import type { UploadedPart } from '../../activities/content-files.js';
import {
  AuthenticatedUser,
  PublicEndpoint,
  RequirePermission,
  StudentEndpoint,
} from '../../authentication/authentication.guard.js';
import type { CurrentUser } from '../../authentication/current-user.js';
import type { RequestBody } from '../../common/request-fields.js';
import { uuidParameter } from '../../common/uuid-parameter.js';
import { MAXIMUM_SCORM_PACKAGE_BYTES } from './scorm-rules.js';
import { ScormPackagesService } from './scorm.js';

// Tuyến gói SCORM (DT-28 phần 28h, YCTD-278):
// - Kho học liệu: tải gói zip lên học liệu loại `scorm` (người soạn), xem gói của các phiên bản, xem trước (người xem được học
//   liệu theo 22h1); cùng quyền của kho học liệu.
// - Giáo viên: lượt chạy gói của lớp ở hoạt động loại `scorm`.
// - Học sinh (kênh student): mở bài nhận mã truy cập, gửi giá trị bộ chuyển API.
// - Tệp của gói: không cần mã phiên, chỉ cần mã truy cập ngắn hạn trong đường dẫn
const RESOURCE_PERMISSIONS = [
  PERMISSION_CODES.learningResourceUse,
  PERMISSION_CODES.learningResourceReview,
  PERMISSION_CODES.learningResourceApprove,
  PERMISSION_CODES.learningResourceManage,
];
const ID = uuidParameter('Mã không hợp lệ');
const ACTIVITY_ID = uuidParameter('Mã hoạt động không hợp lệ');

@Controller('learning-resources')
@RequirePermission(...RESOURCE_PERMISSIONS)
export class ScormResourcesController {
  constructor(private readonly scorm: ScormPackagesService) {}

  @Post(':id/scorm')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_SCORM_PACKAGE_BYTES + 1, files: 1 } }))
  upload(
    @Param('id', ID) id: string,
    @UploadedFile() file: UploadedPart | undefined,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.scorm.upload(user, id, file);
  }

  @Get(':id/scorm')
  packages(@Param('id', ID) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.scorm.packagesOfResource(user, id);
  }

  @Post(':id/scorm/:packageId/preview')
  @HttpCode(200)
  preview(
    @Param('id', ID) id: string,
    @Param('packageId', ID) packageId: string,
    @Headers('origin') origin: string | undefined,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.scorm.preview(user, id, packageId, origin);
  }
}

@Controller('learning')
export class ScormActivitiesController {
  constructor(private readonly scorm: ScormPackagesService) {}

  @RequirePermission(PERMISSION_CODES.learningTeach, PERMISSION_CODES.learningView)
  @Get('activities/:id/scorm-attempts')
  attempts(@Param('id', ACTIVITY_ID) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.scorm.activityAttempts(user, id);
  }
}

@Controller('student/scorm')
@StudentEndpoint()
@RequirePermission(PERMISSION_CODES.learningStudy)
export class StudentScormController {
  constructor(private readonly scorm: ScormPackagesService) {}

  @Post('activities/:id/launch')
  @HttpCode(200)
  launch(
    @Param('id', ACTIVITY_ID) id: string,
    @Headers('origin') origin: string | undefined,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.scorm.studentLaunch(user, id, origin);
  }

  @Post('activities/:id/commit')
  @HttpCode(200)
  commit(@Param('id', ACTIVITY_ID) id: string, @Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.scorm.studentCommit(user, id, body);
  }
}

export const SCORM_CONTENT_PREFIX = '/api/v1/scorm-content/';

@Controller('scorm-content')
@PublicEndpoint()
export class ScormContentController {
  constructor(private readonly scorm: ScormPackagesService) {}

  @Get(':token/*path')
  async file(@Param('token') token: string, @Req() request: Request, @Res() response: Response) {
    const prefix = `${SCORM_CONTENT_PREFIX}${token}/`;
    const path = request.path.startsWith(prefix) ? request.path.slice(prefix.length) : '';
    const served = await this.scorm.serve(token, path);
    // Tệp của gói được nhúng trong khung của ứng dụng: bỏ chặn khung chung, giới hạn bằng CSP frame-ancestors
    response.removeHeader('X-Frame-Options');
    response.removeHeader('Cross-Origin-Opener-Policy');
    for (const [name, value] of Object.entries(served.headers)) {
      response.setHeader(name, value);
    }
    response.setHeader('content-type', served.contentType);
    response.send(served.body);
  }
}
