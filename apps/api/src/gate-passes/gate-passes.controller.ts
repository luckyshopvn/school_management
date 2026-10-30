import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import { validationError, type FieldError } from '@school-management/server';
import type { Request } from 'express';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import { isUuid, readOptionalText, readRequiredText, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { GatePassesService } from './gate-passes.service.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function readDate(value: unknown, field: string, errors: FieldError[]): string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    errors.push({ field, message: 'Ngày dạng YYYY-MM-DD' });
    return '';
  }
  return value;
}

// Thẻ QR và lượt qua cổng, lát L1 (YCTD-389). Quyền kiểm tra ở tầng nghiệp vụ
@Controller()
export class GatePassesController {
  constructor(private readonly gatePasses: GatePassesService) {}

  @Get('classes/:id/gate-cards')
  classCards(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.gatePasses.classCards(currentUser, classId);
  }

  @Post('classes/:id/gate-cards')
  @HttpCode(200)
  issueCards(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const raw = body?.reissue_child_ids ?? [];
    if (!Array.isArray(raw) || !raw.every(isUuid)) {
      throw validationError([{ field: 'reissue_child_ids', message: 'Danh sách mã học sinh không hợp lệ' }]);
    }
    return this.gatePasses.issueCards(currentUser, classId, raw as string[], originOf(request, currentUser));
  }

  @Post('gate-passes')
  @HttpCode(200)
  record(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const code = readRequiredText(body, 'code', errors);
    const direction = body?.direction;
    if (direction !== 'in' && direction !== 'out') {
      errors.push({ field: 'direction', message: 'Hướng là vào hoặc ra' });
    }
    if (code && code.length > 64) {
      errors.push({ field: 'code', message: 'Mã thẻ quá dài' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.gatePasses.recordScan(currentUser, code, direction as 'in' | 'out', originOf(request, currentUser));
  }

  @Get('gate-passes/recent')
  recent(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.gatePasses.recent(currentUser);
  }

  @Post('gate-passes/:id/reject')
  @HttpCode(200)
  reject(
    @Param('id', uuidParameter('Mã lượt qua cổng không hợp lệ')) passId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const note = readOptionalText(body, 'note', errors) ?? 'Nhận nhầm';
    if (note.length > 500) {
      errors.push({ field: 'note', message: 'Tối đa 500 ký tự' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.gatePasses.reject(currentUser, passId, note, originOf(request, currentUser));
  }

  @Get('children/:id/gate-passes')
  childPasses(
    @Param('id', uuidParameter('Mã học sinh không hợp lệ')) childId: string,
    @Query('from') from: unknown,
    @Query('to') to: unknown,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const fromDate = readDate(from, 'from', errors);
    const toDate = readDate(to, 'to', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.gatePasses.childPasses(currentUser, childId, fromDate, toDate);
  }
}
