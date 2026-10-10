import type { Request, Response } from 'express';
import { API_VERSION_PREFIX } from '@school-management/shared';
import type { Clock } from '@school-management/server';
import type { SessionChannel } from '@school-management/database';

// Mã làm mới gửi cho trình duyệt bằng cookie httpOnly, SameSite=Strict, Secure (BM-71).
// Mỗi kênh một cookie riêng vì ba kênh dùng chung tên miền (Q-118); không thì đăng nhập kênh này đè phiên kênh kia
const REFRESH_TOKEN_COOKIE_NAMES: Record<SessionChannel, string> = {
  portal: 'refresh_token',
  teacher: 'refresh_token_teacher',
  parent: 'refresh_token_parent',
};
const COOKIE_PATH = `${API_VERSION_PREFIX}/auth`;

export function setRefreshTokenCookie(
  response: Response,
  channel: SessionChannel,
  refreshToken: string,
  expiresAt: Date,
  clock: Clock,
): void {
  response.cookie(REFRESH_TOKEN_COOKIE_NAMES[channel], refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: COOKIE_PATH,
    maxAge: Math.max(0, expiresAt.getTime() - clock.now().getTime()),
  });
}

export function clearRefreshTokenCookie(response: Response, channel: SessionChannel): void {
  response.clearCookie(REFRESH_TOKEN_COOKIE_NAMES[channel], {
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
    if (separatorIndex > 0 && part.slice(0, separatorIndex).trim() === REFRESH_TOKEN_COOKIE_NAMES[channel]) {
      return decodeURIComponent(part.slice(separatorIndex + 1).trim());
    }
  }
  return undefined;
}
