import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req } from '@nestjs/common';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import type { RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { AiTutorSchoolSalesService } from './school-sales.js';

// Điểm cuối Gia sư AI do trường bán (YCTD-383 lát L1a). Quản trị trường (MH-599) dùng quyền quản lý kết nối ngoài như màn hình Trợ lý
// AI; phụ huynh (MH-598) chỉ thao tác trên con của mình (máy chủ kiểm người giám hộ)
const MANAGE = PERMISSION_CODES.integrationManage;
const ID_MESSAGE = 'Mã không hợp lệ';

@Controller('ai-tutor/school')
export class AiTutorSchoolAdminController {
  constructor(private readonly sales: AiTutorSchoolSalesService) {}

  @Get()
  @RequirePermission(MANAGE)
  overview() {
    return this.sales.overview();
  }

  @Put('settings')
  @RequirePermission(MANAGE)
  saveSettings(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.sales.saveSettings(body, currentUser, originOf(request, currentUser));
  }

  @Post('plans')
  @RequirePermission(MANAGE)
  createPlan(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.sales.createPlan(body, currentUser, originOf(request, currentUser));
  }

  @Put('plans/:planId')
  @RequirePermission(MANAGE)
  updatePlan(
    @Param('planId', uuidParameter(ID_MESSAGE)) planId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.sales.updatePlan(planId, body, originOf(request, currentUser));
  }

  @Get('purchases')
  @RequirePermission(MANAGE)
  purchases(@Query('month') month: string | undefined) {
    return this.sales.purchases(month === '' ? undefined : month);
  }
}

@Controller('children/:id/ai-tutor')
export class ChildAiTutorController {
  constructor(private readonly sales: AiTutorSchoolSalesService) {}

  @Get()
  view(@Param('id') childId: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.sales.childView(currentUser, childId);
  }

  @Post('purchases')
  purchase(
    @Param('id') childId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.sales.purchase(currentUser, childId, body, originOf(request, currentUser));
  }

  @Post('purchases/:subscriptionId/cancel')
  @HttpCode(200)
  cancel(
    @Param('id') childId: string,
    @Param('subscriptionId', uuidParameter(ID_MESSAGE)) subscriptionId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.sales.cancel(currentUser, childId, subscriptionId, originOf(request, currentUser));
  }

  @Get('purchases/:subscriptionId/upgrade-quote')
  upgradeQuote(
    @Param('id') childId: string,
    @Param('subscriptionId', uuidParameter(ID_MESSAGE)) subscriptionId: string,
    @Query('plan_id') planId: string | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.sales.upgradePreview(currentUser, childId, subscriptionId, planId);
  }

  @Post('purchases/:subscriptionId/upgrade')
  @HttpCode(200)
  upgrade(
    @Param('id') childId: string,
    @Param('subscriptionId', uuidParameter(ID_MESSAGE)) subscriptionId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.sales.upgrade(currentUser, childId, subscriptionId, body, originOf(request, currentUser));
  }
}
