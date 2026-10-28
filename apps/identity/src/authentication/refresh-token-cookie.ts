import type { Request, Response } from 'express';
import { API_VERSION_PREFIX } from '@school-management/shared';
import { currentTenant, type Clock } from '@school-management/server';
import type { SessionChannel } from '@school-management/database';

// Mã làm mới gửi cho trình duyệt bằng cookie httpOnly, SameSite=Strict, Secure (BM-71).
// Mỗi kênh một cookie riêng vì ba kênh dùng chung tên miền (Q-118); không thì đăng nhập kênh này đè phiên kênh kia
// Tiền tố __Secure- (DT-SaaS phần S8b): trình duyệt chỉ nhận cookie này khi có thuộc tính Secure và đến từ trang an toàn, nên một trang
// không an toàn (hoặc tên miền anh em bị chiếm) không đặt đè được mã làm mới
export const SECURE_COOKIE_PREFIX = '__Secure-';
const REFRESH_TOKEN_COOKIE_NAMES: Record<SessionChannel, string> = {
  portal: SECURE_COOKIE_PREFIX + 'refresh_token',
  teacher: SECURE_COOKIE_PREFIX + 'refresh_token_teacher',
  parent: SECURE_COOKIE_PREFIX + 'refresh_token_parent',
  student: SECURE_COOKIE_PREFIX + 'refresh_token_student',
};
const COOKIE_PATH = `${API_VERSION_PREFIX}/auth`;

// Nhiều trường: tên cookie có mã trường, nên cookie đặt từ tên miền của trường khác (các trường là tên miền anh em của cùng tên
// miền hệ thống) không bao giờ được đọc như mã làm mới của trường này (DT-SaaS phần S1a)
function cookieName(channel: SessionChannel): string {
  const tenant = currentTenant();
  return tenant ? `${REFRESH_TOKEN_COOKIE_NAMES[channel]}__${tenant.code}` : REFRESH_TOKEN_COOKIE_NAMES[channel];
}

export function setRefreshTokenCookie(
  response: Response,
  channel: SessionChannel,
  refreshToken: string,
  expiresAt: Date,
  clock: Clock,
  // false: cookie phiên (không có hạn), mất khi đóng trình duyệt (YCTD-310, không tích "Ghi nhớ")
  persistent = true,
): void {
  response.cookie(cookieName(channel), refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: COOKIE_PATH,
    ...(persistent ? { maxAge: Math.max(0, expiresAt.getTime() - clock.now().getTime()) } : {}),
  });
}

export function clearRefreshTokenCookie(response: Response, channel: SessionChannel): void {
  response.clearCookie(cookieName(channel), {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: COOKIE_PATH,
  });
}

export function readRefreshTokenCookie(request: Request, channel: SessionChannel): string | undefined {
  const header = request.header('cookie');
  if (!header) {
    return undefined;
  }
  for (const part of header.split(';')) {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex > 0 && part.slice(0, separatorIndex).trim() === cookieName(channel)) {
      return decodeURIComponent(part.slice(separatorIndex + 1).trim());
    }
  }
  return undefined;
}
