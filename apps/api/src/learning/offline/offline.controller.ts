import { Body, Controller, Get, Put } from '@nestjs/common';
import { PERMISSION_CODES } from '@school-management/shared';
import {
  AuthenticatedUser,
  RequirePermission,
  StudentEndpoint,
  RequirePlanModule,
} from '../../authentication/authentication.guard.js';
import type { CurrentUser } from '../../authentication/current-user.js';
import type { RequestBody } from '../../common/request-fields.js';
import { OfflineLearningService } from './offline.js';

// Tuyến cấu hình học khi mạng yếu (DT-28 phần 28j, YCTD-280): Ban Giám hiệu đọc, ghi (kiểm ở dịch vụ); học sinh đọc ở kênh student
const STAFF_PERMISSIONS = [
  PERMISSION_CODES.learningTeach,
  PERMISSION_CODES.learningTemplate,
  PERMISSION_CODES.learningDecide,
  PERMISSION_CODES.learningView,
];

@RequirePlanModule('online-learning')
@Controller('learning/offline')
@RequirePermission(...STAFF_PERMISSIONS)
export class OfflineLearningController {
  constructor(private readonly offline: OfflineLearningService) {}

  @Get('config')
  config(@AuthenticatedUser() user: CurrentUser) {
    return this.offline.config(user);
  }

  @Put('config')
  save(@Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.offline.saveConfig(user, body);
  }
}

@RequirePlanModule('online-learning')
@Controller('student/offline')
@StudentEndpoint()
@RequirePermission(PERMISSION_CODES.learningStudy)
export class StudentOfflineController {
  constructor(private readonly offline: OfflineLearningService) {}

  @Get()
  config(@AuthenticatedUser() user: CurrentUser) {
    return this.offline.studentConfig(user);
  }
}
