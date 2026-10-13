import { Controller, Get, HttpCode, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PublicEndpoint } from '../authentication/authentication.guard.js';
import { OnlinePaymentsService } from './online-payments.service.js';

// Điểm cuối công khai nhận thông báo tiền vào của nhà cung cấp thật (BM-62; YCTD-92): không dùng mã phiên, xác thực bằng
// chữ ký hoặc khóa của từng nhà cung cấp; cổng chưa bật trên máy chủ thì trả 404
@Controller('payment-webhooks')
@PublicEndpoint()
export class PaymentWebhooksController {
  constructor(private readonly onlinePayments: OnlinePaymentsService) {}

  // PayOS cần mã 200 kèm {success: true}
  @Post('payos')
  @HttpCode(200)
  async payos(@Req() request: Request) {
    await this.onlinePayments.receiveWebhook('payos', { headers: request.headers, body: request.body as unknown });
    return { success: true };
  }

  // SePay cần mã 200 hoặc 201 kèm {success: true} trong 30 giây
  @Post('sepay')
  @HttpCode(200)
  async sepay(@Req() request: Request) {
    await this.onlinePayments.receiveWebhook('sepay', { headers: request.headers, body: request.body as unknown });
    return { success: true };
  }

  @Post('casso')
  @HttpCode(200)
  async casso(@Req() request: Request) {
    await this.onlinePayments.receiveWebhook('casso', { headers: request.headers, body: request.body as unknown });
    return { success: true };
  }

  // VNPay gọi IPN bằng GET, đọc kết quả ở thân JSON {RspCode, Message}
  @Get('vnpay-ipn')
  vnpay(@Query() query: Record<string, unknown>) {
    return this.onlinePayments.receiveVnpayIpn(query);
  }
}
