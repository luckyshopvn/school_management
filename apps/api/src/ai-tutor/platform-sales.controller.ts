import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticatedUser, PublicEndpoint } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import type { RequestBody } from '../common/request-fields.js';
import { PlatformAiTutorSalesService } from './platform-sales.js';

// Điểm cuối của việc nền tảng bán thẳng gói gia sư AI (YCTD-383 lát L1b). Phần của phụ huynh theo tên miền của trường, mã phiên của phụ
// huynh; phần vận hành ở đường dẫn không cần trường `/api/v1/platform-ai-tutor/*`, chỉ phục vụ ở tên miền cổng nền tảng với mã phiên vận
// hành (vai trò quản trị, kế toán)
@Controller('ai-tutor/direct')
export class AiTutorDirectPurchaseController {
  constructor(private readonly sales: PlatformAiTutorSalesService) {}

  @Get('children/:childId')
  overview(@Param('childId') childId: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.sales.childOverview(currentUser, childId);
  }

  @Post('children/:childId/orders')
  @HttpCode(201)
  create(
    @Param('childId') childId: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Req() request: Request,
  ) {
    return this.sales.createOrder(currentUser, childId, body, request.ip ?? null);
  }

  @Post('children/:childId/upgrades')
  @HttpCode(201)
  upgrade(
    @Param('childId') childId: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Req() request: Request,
  ) {
    return this.sales.createUpgrade(currentUser, childId, body, request.ip ?? null);
  }

  @Get('orders/:id')
  order(@Param('id') id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.sales.parentOrder(currentUser, id);
  }

  @Post('orders/:id/cancel')
  @HttpCode(200)
  cancel(@Param('id') id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.sales.parentCancel(currentUser, id);
  }

  @Post('orders/:id/simulate-payment')
  @HttpCode(200)
  simulate(@Param('id') id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.sales.parentSimulate(currentUser, id);
  }
}

@Controller('platform-ai-tutor')
@PublicEndpoint()
export class PlatformAiTutorAdminController {
  constructor(private readonly sales: PlatformAiTutorSalesService) {}

  @Get('plans')
  plans(@Req() request: Request) {
    return this.sales.listPlans(request);
  }

  @Post('plans')
  @HttpCode(201)
  createPlan(@Req() request: Request, @Body() body: RequestBody) {
    return this.sales.createPlan(request, body);
  }

  @Put('plans/:id')
  updatePlan(@Req() request: Request, @Param('id') id: string, @Body() body: RequestBody) {
    return this.sales.updatePlan(request, id, body);
  }

  @Post('plans/:id/status')
  @HttpCode(200)
  planStatus(@Req() request: Request, @Param('id') id: string, @Body() body: RequestBody) {
    return this.sales.setPlanStatus(request, id, body);
  }

  @Get('orders')
  orders(@Req() request: Request, @Query('status') status: string | undefined) {
    return this.sales.listOrders(request, status);
  }

  @Get('orders/:id')
  order(@Req() request: Request, @Param('id') id: string) {
    return this.sales.orderDetail(request, id);
  }

  @Post('orders/:id/cancel')
  @HttpCode(200)
  cancel(@Req() request: Request, @Param('id') id: string, @Body() body: RequestBody) {
    return this.sales.operatorCancel(request, id, body);
  }

  @Post('orders/:id/refund')
  @HttpCode(200)
  refund(@Req() request: Request, @Param('id') id: string, @Body() body: RequestBody) {
    return this.sales.refund(request, id, body);
  }
}
