import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  changePassword as requestPasswordChange,
  login as requestLogin,
  logout as requestLogout,
  refreshSession,
  type TokenResponse,
} from './api-client.js';

export type SessionStatus = 'checking' | 'signed-out' | 'signed-in';

interface SessionValue {
  status: SessionStatus;
  passwordChangeRequired: boolean;
  login(loginIdentifier: string, password: string): Promise<void>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  logout(): Promise<void>;
}

const SessionContext = createContext<SessionValue | undefined>(undefined);

// Mở trang thì thử làm mới phiên bằng cookie; không được thì về màn hình đăng nhập
export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SessionStatus>('checking');
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);

  const applyTokens = useCallback((tokens: TokenResponse) => {
    setPasswordChangeRequired(tokens.password_change_required);
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
      async login(loginIdentifier, password) {
        applyTokens(await requestLogin(loginIdentifier, password));
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
          setPasswordChangeRequired(false);
          setStatus('signed-out');
        }
      },
    }),
    [status, passwordChangeRequired, applyTokens, queryClient],
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
