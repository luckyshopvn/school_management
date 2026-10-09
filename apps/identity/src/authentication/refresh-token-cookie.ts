import type { Request, Response } from 'express';
import { API_VERSION_PREFIX } from '@school-management/shared';
import type { Clock } from '@school-management/server';

// Mã làm mới gửi cho trình duyệt bằng cookie httpOnly, SameSite=Strict, Secure (BM-71)
export const REFRESH_TOKEN_COOKIE_NAME = 'refresh_token';
const COOKIE_PATH = `${API_VERSION_PREFIX}/auth`;

export function setRefreshTokenCookie(response: Response, refreshToken: string, expiresAt: Date, clock: Clock): void {
  response.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: COOKIE_PATH,
    maxAge: Math.max(0, expiresAt.getTime() - clock.now().getTime()),
  });
}

export function clearRefreshTokenCookie(response: Response): void {
  response.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: COOKIE_PATH,
  });
}

export function readRefreshTokenCookie(request: Request): string | undefined {
  const header = request.header('cookie');
  if (!header) {
    return undefined;
  }
  for (const part of header.split(';')) {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex > 0 && part.slice(0, separatorIndex).trim() === REFRESH_TOKEN_COOKIE_NAME) {
      return decodeURIComponent(part.slice(separatorIndex + 1).trim());
    }
  }
  return undefined;
}
