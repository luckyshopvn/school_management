import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, Res } from '@nestjs/common';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request, Response } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import type { RequestBody } from '../common/request-fields.js';
import { sendWorkbook } from '../facilities/facilities-workbook.js';
import { TutoringFinanceService } from './tutoring-finance.js';

// Điểm cuối thu chi của gia sư trong trường (DT-27 phần 27c, YCTD-253): báo cáo và tệp Excel, thù lao giáo viên vào bảng lương,
// khoản trừ của buổi bị hủy (Ban Giám hiệu, kế toán)
const MANAGE = PERMISSION_CODES.tutoringManage;
const CREDIT_HANDLERS = [MANAGE, PERMISSION_CODES.invoiceAdjustmentCreate, PERMISSION_CODES.paymentManage];
// Báo cáo và thù lao: Ban Giám hiệu và kế toán (nhập thưởng, khấu trừ của lương; lập phiếu chi)
const FINANCE_VIEWERS = [MANAGE, PERMISSION_CODES.bonusDeductionManage, PERMISSION_CODES.paymentManage];

@Controller('tutoring/finance')
export class TutoringFinanceController {
  constructor(private readonly finance: TutoringFinanceService) {}

  @Get('report')
  @RequirePermission(...FINANCE_VIEWERS)
  report(@Query('from') from: string, @Query('to') to: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.finance.report(currentUser, from, to);
  }

  @Get('report/export')
  @RequirePermission(...FINANCE_VIEWERS)
  async exportReport(
    @Query('from') from: string,
    @Query('to') to: string,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    sendWorkbook(response, await this.finance.exportReport(currentUser, from, to, request.ip ?? null));
  }

  @Get('teacher-pay')
  @RequirePermission(...FINANCE_VIEWERS)
  previewPay(@Query('month') month: string) {
    return this.finance.previewPay(month);
  }

  @Post('teacher-pay/push')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.bonusDeductionManage)
  pushPay(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser, @Req() request: Request) {
    return this.finance.pushPay(currentUser, body?.month, originOf(request, currentUser));
  }

  @Get('credits')
  @RequirePermission(...CREDIT_HANDLERS)
  credits(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.finance.listCredits(currentUser);
  }

  @Post('credits/:id/adjust')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.invoiceAdjustmentCreate)
  adjust(@Param('id') id: string, @AuthenticatedUser() currentUser: CurrentUser, @Req() request: Request) {
    return this.finance.adjustCredit(currentUser, id, originOf(request, currentUser));
  }

  @Post('credits/:id/deduct-next')
  @HttpCode(200)
  @RequirePermission(...CREDIT_HANDLERS)
  deductNext(@Param('id') id: string, @AuthenticatedUser() currentUser: CurrentUser, @Req() request: Request) {
    return this.finance.deductCreditNext(currentUser, id, originOf(request, currentUser));
  }

  @Post('credits/:id/close')
  @HttpCode(200)
  @RequirePermission(...CREDIT_HANDLERS)
  close(
    @Param('id') id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Req() request: Request,
  ) {
    return this.finance.closeCredit(currentUser, id, body?.note, originOf(request, currentUser));
  }
}
