import { Controller, Get, Inject, Optional, Query, Req, Res } from '@nestjs/common';
import type { TenancyRuntime } from '@school-management/database';
import { ApplicationError } from '@school-management/server';
import type { Request, Response } from 'express';
import { AdmissionsRateLimiter } from '../admissions/public-rate-limit.js';
import { PublicEndpoint } from '../authentication/authentication.guard.js';
import { TENANCY_RUNTIME } from './configuration.js';

// Đường dẫn của nhóm điểm cuối không cần trường, dùng cho `isTenantFreePath` của lớp trung gian trường
export const TENANT_FREE_PATHS = new Set([
  '/api/v1/health',
  '/api/v1/internal/jobs/tick',
  '/api/v1/public/website/domain-check',
  '/api/v1/public/schools/resolve',
  '/api/v1/public/schools/picker',
  // Thông báo tiền vào của cổng thanh toán của nền tảng (S5b): không thuộc trường nào
  '/api/v1/platform-billing/webhooks/payos',
  '/api/v1/platform-billing/webhooks/sepay',
  '/api/v1/platform-billing/webhooks/casso',
  // Sự kiện của máy chủ video (DT-27 phần 27a): một địa chỉ cho mọi trường, trường lấy từ tên phòng
  '/api/v1/video/webhook',
]);

const PICKER_PAGE = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Chọn trường</title>
<style>
body{font-family:system-ui,sans-serif;margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f6f8;color:#1b2733}
main{background:#fff;padding:32px;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.08);width:min(92vw,380px)}
input,button{font:inherit;padding:10px 12px;border-radius:8px;border:1px solid #b8c2cc;width:100%;box-sizing:border-box}
button{background:#1d5fd1;color:#fff;border-color:#1d5fd1;margin-top:12px;cursor:pointer}
p{color:#a02020;min-height:1.2em}
</style>
</head>
<body>
<main>
<h1>Chọn trường</h1>
<label for="code">Mã trường</label>
<input id="code" autocomplete="off" autofocus>
<button id="go" type="button">Vào trường</button>
<p id="message" role="alert"></p>
</main>
<script>
const message = document.getElementById('message');
async function go() {
  message.textContent = '';
  const code = document.getElementById('code').value.trim();
  if (!code) { message.textContent = 'Nhập mã trường'; return; }
  const response = await fetch('/api/v1/public/schools/resolve?code=' + encodeURIComponent(code));
  if (!response.ok) { message.textContent = 'Không tìm thấy trường với mã này'; return; }
  const body = await response.json();
  window.location.assign(body.url);
}
document.getElementById('go').addEventListener('click', go);
document.getElementById('code').addEventListener('keydown', (event) => { if (event.key === 'Enter') void go(); });
</script>
</body>
</html>
`;

// Trang chọn trường ở tên miền gốc của hệ thống (DT-SaaS phần S1b, tài liệu 32 mục 14.7): người dùng nhập mã trường rồi chuyển tới
// địa chỉ của trường. Không cần trường; không liệt kê trường (tránh lộ danh sách khách hàng), có giới hạn tần suất theo địa chỉ mạng;
// chưa đặt PLATFORM_ROOT_DOMAIN thì không có trang này (404)
@Controller('public/schools')
@PublicEndpoint()
export class SchoolPickerController {
  constructor(
    private readonly limiter: AdmissionsRateLimiter,
    @Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null = null,
  ) {}

  @Get('picker')
  picker(@Res() response: Response) {
    if (!this.tenancy?.configuration.rootDomain) {
      throw new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy trang');
    }
    response.status(200).type('text/html; charset=utf-8').send(PICKER_PAGE);
  }

  @Get('resolve')
  async resolve(@Query('code') code: string | undefined, @Req() request: Request) {
    this.limiter.hit('read', request.ip);
    const url = this.tenancy && typeof code === 'string' ? await this.tenancy.resolveSchoolAddress(code) : null;
    if (!url) {
      throw new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy trường');
    }
    return { url };
  }
}
