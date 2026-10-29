import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  changePassword as requestPasswordChange,
  exitImpersonation as requestExitImpersonation,
  startImpersonation as requestStartImpersonation,
  login as requestLogin,
  logout as requestLogout,
  refreshSession,
  type CaptchaAnswer,
  type TokenResponse,
} from './api-client.js';

import { clearStartupNoticesShown } from '../pages/startup-notices-state.js';

export type SessionStatus = 'checking' | 'signed-out' | 'signed-in';

interface SessionValue {
  status: SessionStatus;
  passwordChangeRequired: boolean;
  // Mật khẩu đã hết hạn nên phải đổi; số ngày còn lại khi sắp hết hạn (YCTD-110)
  passwordExpired: boolean;
  passwordExpiresInDays: number | null;
  login(
    loginIdentifier: string,
    password: string,
    captcha?: CaptchaAnswer,
    otpCode?: string,
    remember?: boolean,
  ): Promise<void>;
  changePassword(currentPassword: string, newPassword: string, otpCode?: string): Promise<void>;
  logout(): Promise<void>;
  // Đăng nhập thay và thoát (DT-18 phần 18h); dữ liệu đã tải của phiên trước bị xóa khỏi bộ nhớ đệm
  startImpersonation(userId: string, reason: string): Promise<void>;
  exitImpersonation(): Promise<void>;
}

const SessionContext = createContext<SessionValue | undefined>(undefined);

// Mở trang thì thử làm mới phiên bằng cookie; không được thì về màn hình đăng nhập
export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SessionStatus>('checking');
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);
  const [passwordExpired, setPasswordExpired] = useState(false);
  const [passwordExpiresInDays, setPasswordExpiresInDays] = useState<number | null>(null);

  const applyTokens = useCallback((tokens: TokenResponse) => {
    setPasswordChangeRequired(tokens.password_change_required);
    setPasswordExpired(tokens.password_expired ?? false);
    setPasswordExpiresInDays(tokens.password_expires_in_days ?? null);
    setStatus('signed-in');
  }, []);

  useEffect(() => {
    refreshSession()
      .then(applyTokens)
      .catch(() => setStatus('signed-out'));
  }, [applyTokens]);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      passwordChangeRequired,
      passwordExpired,
      passwordExpiresInDays,
      async login(loginIdentifier, password, captcha, otpCode, remember) {
        applyTokens(await requestLogin(loginIdentifier, password, captcha, otpCode, remember));
      },
      async changePassword(currentPassword, newPassword, otpCode) {
        applyTokens(await requestPasswordChange(currentPassword, newPassword, otpCode));
        await queryClient.invalidateQueries();
      },
      async startImpersonation(userId, reason) {
        const tokens = await requestStartImpersonation(userId, reason);
        queryClient.clear();
        clearStartupNoticesShown();
        applyTokens(tokens);
      },
      async exitImpersonation() {
        const result = await requestExitImpersonation();
        queryClient.clear();
        if (result.signedOut) {
          setStatus('signed-out');
          return;
        }
        applyTokens(await refreshSession());
      },
      async logout() {
        try {
          await requestLogout();
        } finally {
          queryClient.clear();
          // Lần đăng nhập sau lại hiện hộp thông báo khi vào trang (DT-16 phần 16c)
          clearStartupNoticesShown();
          setPasswordChangeRequired(false);
          setPasswordExpired(false);
          setPasswordExpiresInDays(null);
          setStatus('signed-out');
        }
      },
    }),
    [status, passwordChangeRequired, passwordExpired, passwordExpiresInDays, applyTokens, queryClient],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession phải dùng bên trong SessionProvider');
  }
  return value;
}
