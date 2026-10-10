import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  changePassword as requestPasswordChange,
  loginWithOneTimeCode,
  loginWithPassword,
  logout as requestLogout,
  refreshSession,
  type TokenResponse,
} from './api-client.js';

export type SessionStatus = 'checking' | 'signed-out' | 'signed-in';

interface SessionValue {
  status: SessionStatus;
  passwordChangeRequired: boolean;
  // Mật khẩu vừa dùng để đăng nhập, giữ trong bộ nhớ để màn hình kích hoạt điền sẵn mật khẩu hiện tại
  lastPassword: string | undefined;
  loginWithPassword(phone: string, password: string): Promise<void>;
  loginWithOneTimeCode(phone: string, code: string): Promise<void>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  logout(): Promise<void>;
}

const SessionContext = createContext<SessionValue | undefined>(undefined);

// Mở ứng dụng thì thử làm mới phiên bằng cookie; phiên kênh phụ huynh làm mới được trong 30 ngày (XT-02)
export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('checking');
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);
  const [lastPassword, setLastPassword] = useState<string>();

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
      lastPassword,
      async loginWithPassword(phone, password) {
        const tokens = await loginWithPassword(phone, password);
        setLastPassword(tokens.password_change_required ? password : undefined);
        applyTokens(tokens);
      },
      async loginWithOneTimeCode(phone, code) {
        applyTokens(await loginWithOneTimeCode(phone, code));
      },
      async changePassword(currentPassword, newPassword) {
        applyTokens(await requestPasswordChange(currentPassword, newPassword));
        setLastPassword(undefined);
      },
      async logout() {
        try {
          await requestLogout();
        } finally {
          setLastPassword(undefined);
          setPasswordChangeRequired(false);
          setStatus('signed-out');
        }
      },
    }),
    [status, passwordChangeRequired, lastPassword, applyTokens],
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
