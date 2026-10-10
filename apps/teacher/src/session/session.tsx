import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  changePassword as requestPasswordChange,
  loginWithPassword,
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

// Mở ứng dụng thì thử làm mới phiên bằng cookie của kênh giáo viên; phiên làm mới được trong 30 ngày (XT-02)
export function SessionProvider({ children }: { children: ReactNode }) {
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
        applyTokens(await loginWithPassword(loginIdentifier, password));
      },
      async changePassword(currentPassword, newPassword) {
        applyTokens(await requestPasswordChange(currentPassword, newPassword));
      },
      async logout() {
        try {
          await requestLogout();
        } finally {
          setPasswordChangeRequired(false);
          setStatus('signed-out');
        }
      },
    }),
    [status, passwordChangeRequired, applyTokens],
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
