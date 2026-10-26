import { revokePushOnSignOut } from '@school-management/pwa';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  changeStudentPassword,
  refreshStudentSession,
  requestStudentJson,
  studentLogin,
  studentLogout,
  type CaptchaAnswer,
  type TokenResponse,
} from './student-api.js';

export type StudentSessionStatus = 'checking' | 'signed-out' | 'signed-in';

interface StudentSessionValue {
  status: StudentSessionStatus;
  passwordChangeRequired: boolean;
  lastPassword: string | undefined;
  login(login: string, password: string, captcha?: CaptchaAnswer): Promise<void>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  logout(): Promise<void>;
}

const StudentSessionContext = createContext<StudentSessionValue | undefined>(undefined);

// Mở màn hình học sinh thì thử làm mới phiên bằng cookie của kênh student (hạn 12 giờ)
export function StudentSessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<StudentSessionStatus>('checking');
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);
  const [lastPassword, setLastPassword] = useState<string>();

  const applyTokens = useCallback((tokens: TokenResponse) => {
    setPasswordChangeRequired(tokens.password_change_required);
    setStatus('signed-in');
  }, []);

  useEffect(() => {
    refreshStudentSession()
      .then(applyTokens)
      .catch(() => setStatus('signed-out'));
  }, [applyTokens]);

  const value = useMemo<StudentSessionValue>(
    () => ({
      status,
      passwordChangeRequired,
      lastPassword,
      async login(login, password, captcha) {
        const tokens = await studentLogin(login, password, captcha);
        setLastPassword(tokens.password_change_required ? password : undefined);
        applyTokens(tokens);
      },
      async changePassword(currentPassword, newPassword) {
        applyTokens(await changeStudentPassword(currentPassword, newPassword));
        setLastPassword(undefined);
      },
      async logout() {
        try {
          // Máy dùng chung không nhận đẩy của học sinh trước (DT-26 phần 26b); cần mã phiên nên gọi trước khi đăng xuất
          await revokePushOnSignOut(import.meta.env.BASE_URL, requestStudentJson);
          await studentLogout();
        } finally {
          setLastPassword(undefined);
          setPasswordChangeRequired(false);
          setStatus('signed-out');
        }
      },
    }),
    [status, passwordChangeRequired, lastPassword, applyTokens],
  );

  return <StudentSessionContext.Provider value={value}>{children}</StudentSessionContext.Provider>;
}

export function useStudentSession(): StudentSessionValue {
  const value = useContext(StudentSessionContext);
  if (!value) {
    throw new Error('useStudentSession phải dùng bên trong StudentSessionProvider');
  }
  return value;
}
