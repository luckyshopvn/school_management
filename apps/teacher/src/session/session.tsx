import { revokePushOnSignOut } from '@school-management/pwa';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { clearClassroomData } from '../tools/classroom-store.js';
import {
  ApiError,
  changePassword as requestPasswordChange,
  loginWithPassword,
  logout as requestLogout,
  refreshSession,
  requestJson,
  type CaptchaAnswer,
  type TokenResponse,
} from './api-client.js';

// 'offline': mất mạng lúc mở ứng dụng nên chưa xác nhận được phiên; chỉ công cụ lớp học dùng được (DT-23 phần 23b, GD-108)
export type SessionStatus = 'checking' | 'signed-out' | 'signed-in' | 'offline';

interface SessionValue {
  status: SessionStatus;
  passwordChangeRequired: boolean;
  login(loginIdentifier: string, password: string, otpCode?: string, captcha?: CaptchaAnswer): Promise<void>;
  changePassword(currentPassword: string, newPassword: string, otpCode?: string): Promise<void>;
  logout(): Promise<void>;
  // Thử xác nhận lại phiên khi có mạng trở lại
  retry(): void;
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

  // Máy chủ trả lời là phiên hết hạn hoặc không có: đăng xuất và xóa dữ liệu công cụ lớp học trên máy. Không có phản hồi
  // (mất mạng, máy chủ lỗi) thì chưa kết luận gì: vào chế độ ngoại tuyến, có mạng lại thì xác nhận tiếp (DT-23 phần 23b)
  const check = useCallback(() => {
    refreshSession()
      .then(applyTokens)
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status < 500) {
          clearClassroomData();
          setStatus('signed-out');
        } else {
          setStatus('offline');
        }
      });
  }, [applyTokens]);

  useEffect(check, [check]);

  useEffect(() => {
    if (status !== 'offline') {
      return;
    }
    window.addEventListener('online', check);
    return () => window.removeEventListener('online', check);
  }, [status, check]);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      passwordChangeRequired,
      async login(loginIdentifier, password, otpCode, captcha) {
        applyTokens(await loginWithPassword(loginIdentifier, password, otpCode, captcha));
      },
      async changePassword(currentPassword, newPassword, otpCode) {
        applyTokens(await requestPasswordChange(currentPassword, newPassword, otpCode));
      },
      retry: check,
      async logout() {
        try {
          // Máy dùng chung không nhận đẩy của người dùng trước (DT-26 phần 26b); cần mã phiên nên gọi trước khi đăng xuất
          await revokePushOnSignOut(import.meta.env.BASE_URL, requestJson);
          await requestLogout();
        } finally {
          // Danh sách lớp lưu trên máy xóa khi đăng xuất (DT-23 phần 23b, GD-108)
          clearClassroomData();
          setPasswordChangeRequired(false);
          setStatus('signed-out');
        }
      },
    }),
    [status, passwordChangeRequired, applyTokens, check],
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
