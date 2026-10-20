import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req } from '@nestjs/common';
import { validationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import type { RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { WORK_FILE_BOXES, WorkFilesService, type WorkFileBox } from './work-files.js';

// Điểm cuối hồ sơ công việc (DT-18 phần 18c, YCTD-141). Cán bộ có quyền hồ sơ công việc dùng hồ sơ của mình; văn thư lưu
// trữ (quyền 5.10) xem hồ sơ nộp lưu, tiếp nhận, trả về, xem hồ sơ hết hạn bảo quản
const USE = PERMISSION_CODES.workFileUse;
const ARCHIVE_MANAGE = PERMISSION_CODES.archiveManage;
const ARCHIVE_VIEW = PERMISSION_CODES.archiveView;
const ANY = [USE, ARCHIVE_MANAGE, ARCHIVE_VIEW];
const FILE_MESSAGE = 'Mã hồ sơ không hợp lệ';

@Controller()
export class WorkFilesController {
  constructor(private readonly files: WorkFilesService) {}

  @Get('work-files')
  @RequirePermission(...ANY)
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const box = (query.box ?? 'personal') as WorkFileBox;
    if (!WORK_FILE_BOXES.includes(box)) {
      throw validationError([{ field: 'box', message: `Hộp hồ sơ là một trong: ${WORK_FILE_BOXES.join(', ')}` }]);
    }
    const year = query.year ? Number(query.year) : null;
    if (year !== null && (!Number.isInteger(year) || year < 1900 || year > 2200)) {
      throw validationError([{ field: 'year', message: 'Năm không hợp lệ' }]);
    }
    return this.files.list(currentUser, box, { year, search: query.q?.trim().slice(0, 200) || null });
  }

  @Post('work-files')
  @RequirePermission(USE)
  create(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.files.create(currentUser, body);
  }

  @Get('work-files/:id')
  @RequirePermission(...ANY)
  detail(@Param('id', uuidParameter(FILE_MESSAGE)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.files.detail(currentUser, id);
  }

  @Put('work-files/:id')
  @RequirePermission(USE)
  update(
    @Param('id', uuidParameter(FILE_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.files.update(currentUser, id, body);
  }

  @Delete('work-files/:id')
  @HttpCode(204)
  @RequirePermission(USE)
  async remove(@Param('id', uuidParameter(FILE_MESSAGE)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    await this.files.remove(currentUser, id);
  }

  @Post('work-files/:id/items')
  @RequirePermission(USE)
  addItem(
    @Param('id', uuidParameter(FILE_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.files.addItem(currentUser, id, body);
  }

  @Delete('work-files/:id/items/:itemId')
  @RequirePermission(USE)
  removeItem(
    @Param('id', uuidParameter(FILE_MESSAGE)) id: string,
    @Param('itemId', uuidParameter('Mã thành phần không hợp lệ')) itemId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.files.removeItem(currentUser, id, itemId);
  }

  @Put('work-files/:id/shares')
  @RequirePermission(USE)
  share(
    @Param('id', uuidParameter(FILE_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.files.share(currentUser, id, body);
  }

  @Post('work-files/:id/transfer')
  @HttpCode(200)
  @RequirePermission(USE)
  transfer(
    @Param('id', uuidParameter(FILE_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.files.transfer(currentUser, id, body);
  }

  @Post('work-files/:id/close')
  @HttpCode(200)
  @RequirePermission(USE)
  close(
    @Param('id', uuidParameter(FILE_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.files.setStatus(currentUser, id, 'close', body);
  }

  @Post('work-files/:id/reopen')
  @HttpCode(200)
  @RequirePermission(USE)
  reopen(
    @Param('id', uuidParameter(FILE_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.files.setStatus(currentUser, id, 'reopen', body);
  }

  @Post('work-files/:id/submit')
  @HttpCode(200)
  @RequirePermission(USE)
  submit(
    @Param('id', uuidParameter(FILE_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.files.setStatus(currentUser, id, 'submit', body);
  }

  @Post('work-files/:id/accept')
  @HttpCode(200)
  @RequirePermission(ARCHIVE_MANAGE)
  accept(
    @Param('id', uuidParameter(FILE_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.files.accept(currentUser, id, body, originOf(request, currentUser));
  }

  @Post('work-files/:id/return')
  @HttpCode(200)
  @RequirePermission(ARCHIVE_MANAGE)
  returnFile(
    @Param('id', uuidParameter(FILE_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.files.returnFile(currentUser, id, body);
  }
}
