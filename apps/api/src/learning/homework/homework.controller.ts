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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PERMISSION_CODES } from '@school-management/shared';
import type { UploadedPart } from '../../activities/content-files.js';
import { AuthenticatedUser, RequirePermission } from '../../authentication/authentication.guard.js';
import type { CurrentUser } from '../../authentication/current-user.js';
import type { RequestBody } from '../../common/request-fields.js';
import { uuidParameter } from '../../common/uuid-parameter.js';
import { AssignmentsService } from '../assignments/assignments.js';
import { HomeworkService } from './homework.js';

// Tuyến bài về nhà (DT-28 phần 28f, YCTD-276), nhóm /learning. Giao từ sổ đầu bài, lịch khối lượng của bài cần
// `P02.assignment.manage` và là giáo viên của lớp học trực tuyến; quy tắc của trường, khối lượng của lớp kiểm vai trò ở dịch vụ
// (Ban Giám hiệu; giáo viên, chủ nhiệm của lớp). Tuyến của phụ huynh (`children/...`) không gắn quyền, kiểm ở dịch vụ theo học
// sinh như lõi 28b; nộp thay chỉ khi con chưa có tài khoản học
const ACTIVITY_ID = uuidParameter('Mã hoạt động không hợp lệ');
const CHILD_ID = uuidParameter('Mã học sinh không hợp lệ');
const MAXIMUM_PART_BYTES = 25 * 1024 * 1024;

@Controller('learning')
export class HomeworkController {
  constructor(
    private readonly homework: HomeworkService,
    private readonly assignments: AssignmentsService,
  ) {}

  // ---------- Quy tắc của trường

  @Get('homework/policies')
  policies(@AuthenticatedUser() user: CurrentUser) {
    return this.homework.policies(user);
  }

  @Put('homework/policies')
  savePolicy(@Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.homework.savePolicy(user, body);
  }

  @Delete('homework/policies/:id')
  removePolicy(
    @Param('id', uuidParameter('Mã quy tắc không hợp lệ')) id: string,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.homework.removePolicy(user, id);
  }

  @Put('homework/reminder-time')
  reminderTime(@Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.homework.saveReminderTime(user, body);
  }

  // ---------- Khối lượng

  @Get('homework/workload')
  workload(
    @Query('class_id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Query('from') from: string | undefined,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.homework.classWorkload(user, classId, from);
  }

  @RequirePermission(PERMISSION_CODES.assignmentManage)
  @Get('homework/activities/:id/workload')
  activityWorkload(@Param('id', ACTIVITY_ID) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.homework.activityWorkload(user, id);
  }

  @Post('homework/activities/:id/override')
  @HttpCode(200)
  override(@Param('id', ACTIVITY_ID) id: string, @Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.homework.approveOverride(user, id, body);
  }

  @RequirePermission(PERMISSION_CODES.assignmentManage)
  @Get('homework/activities/:id/absences')
  absences(@Param('id', ACTIVITY_ID) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.homework.absences(user, id);
  }

  // ---------- Sổ đầu bài

  @Get('homework/class-logs/:id')
  lesson(@Param('id', uuidParameter('Mã tiết không hợp lệ')) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.homework.lessonHomework(user, id);
  }

  @RequirePermission(PERMISSION_CODES.assignmentManage)
  @Post('homework/class-logs/:id')
  create(
    @Param('id', uuidParameter('Mã tiết không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.homework.createFromClassLog(user, id, body);
  }

  // ---------- Phụ huynh

  @Get('children/:childId/homework')
  childHomework(@Param('childId', CHILD_ID) childId: string, @AuthenticatedUser() user: CurrentUser) {
    return this.homework.childHomework(user, childId);
  }

  @Post('children/:childId/homework/:id/acknowledge')
  @HttpCode(200)
  acknowledge(
    @Param('childId', CHILD_ID) childId: string,
    @Param('id', ACTIVITY_ID) id: string,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.homework.acknowledge(user, childId, id);
  }

  @Get('children/:childId/homework/:id')
  proxyView(
    @Param('childId', CHILD_ID) childId: string,
    @Param('id', ACTIVITY_ID) id: string,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.assignments.guardianAssignment(user, childId, id);
  }

  @Post('children/:childId/homework/:id/items/:itemId/files')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_PART_BYTES, files: 1 } }))
  proxyUpload(
    @Param('childId', CHILD_ID) childId: string,
    @Param('id', ACTIVITY_ID) id: string,
    @Param('itemId', uuidParameter('Mã câu không hợp lệ')) itemId: string,
    @UploadedFile() file: UploadedPart | undefined,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.assignments.guardianUpload(user, childId, id, itemId, file);
  }

  @Delete('children/:childId/homework/:id/files/:fileId')
  proxyRemoveFile(
    @Param('childId', CHILD_ID) childId: string,
    @Param('id', ACTIVITY_ID) id: string,
    @Param('fileId', uuidParameter('Mã tệp không hợp lệ')) fileId: string,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.assignments.guardianRemoveFile(user, childId, id, fileId);
  }

  @Post('children/:childId/homework/:id/submit')
  @HttpCode(200)
  proxySubmit(
    @Param('childId', CHILD_ID) childId: string,
    @Param('id', ACTIVITY_ID) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.assignments.guardianSubmit(user, childId, id, body);
  }

  @Post('children/:childId/homework/:id/submissions/:submissionId/comments')
  comment(
    @Param('childId', CHILD_ID) childId: string,
    @Param('id', ACTIVITY_ID) id: string,
    @Param('submissionId', uuidParameter('Mã bài nộp không hợp lệ')) submissionId: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.assignments.guardianComment(user, childId, id, submissionId, body);
  }
}
