import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  changePassword as requestPasswordChange,
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
  login(loginIdentifier: string, password: string, captcha?: CaptchaAnswer): Promise<void>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  logout(): Promise<void>;
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
      async login(loginIdentifier, password, captcha) {
        applyTokens(await requestLogin(loginIdentifier, password, captcha));
      },
      async changePassword(currentPassword, newPassword) {
        applyTokens(await requestPasswordChange(currentPassword, newPassword));
        await queryClient.invalidateQueries();
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
