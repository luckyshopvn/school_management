import { Controller, Get, Param, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Response } from 'express';
import type { UploadedPart } from '../../activities/content-files.js';
import { AuthenticatedUser, RequirePermission } from '../../authentication/authentication.guard.js';
import type { CurrentUser } from '../../authentication/current-user.js';
import { uuidParameter } from '../../common/uuid-parameter.js';
import { MAXIMUM_COURSE_PACKAGE_BYTES } from './course-package-rules.js';
import { CoursePackagesService } from './course-packages.js';

// Xuất, nhập gói khoá học giữa các trường (DT-28 phần 28h, YCTD-278), nhóm /learning như khoá học mẫu của 28b; ai xuất được khoá
// nào, ai nhập được kiểm ở dịch vụ (người xem được khoá mẫu; người soạn khoá mẫu)
const STAFF_PERMISSIONS = [
  PERMISSION_CODES.learningTeach,
  PERMISSION_CODES.learningTemplate,
  PERMISSION_CODES.learningDecide,
  PERMISSION_CODES.learningView,
];

@Controller('learning')
@RequirePermission(...STAFF_PERMISSIONS)
export class CoursePackagesController {
  constructor(private readonly packages: CoursePackagesService) {}

  @Get('templates/:id/package')
  async export(
    @Param('id', uuidParameter('Mã khoá mẫu không hợp lệ')) id: string,
    @Res() response: Response,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    const result = await this.packages.exportTemplate(user, id);
    response.setHeader('content-type', 'application/gzip');
    response.setHeader('content-disposition', `attachment; filename="${result.fileName}"`);
    response.setHeader('x-package-skipped', String(result.skipped.length));
    response.setHeader('cache-control', 'no-store');
    response.send(result.buffer);
  }

  @Post('template-packages')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_COURSE_PACKAGE_BYTES, files: 1 } }))
  import(@UploadedFile() file: UploadedPart | undefined, @AuthenticatedUser() user: CurrentUser) {
    return this.packages.importPackage(user, file?.buffer);
  }

  @Get('template-packages')
  transfers(@AuthenticatedUser() user: CurrentUser) {
    return this.packages.transfers(user);
  }
}
