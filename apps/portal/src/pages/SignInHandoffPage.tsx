import { useEffect, useState } from 'react';
import { Alert } from '@school-management/ui';
import { ApiError } from '../session/api-client.js';
import { exchangeHandoff } from '../portal-shell/unit-directory-api.js';

// Trang nhận phiên sau khi đăng nhập theo đơn vị ở tên miền chung (DT-24, YCTD-220): mã chuyển phiên một lần nằm sau dấu # (không
// gửi lên máy chủ trong địa chỉ, không vào nhật ký truy cập); đổi mã lấy cookie phiên của tên miền này rồi vào trang chủ
function codeFromLocation(): string {
  return new URLSearchParams(window.location.hash.replace(/^#/, '')).get('code') ?? '';
}

export function SignInHandoffPage() {
  const [code] = useState(codeFromLocation);
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    // Xóa mã khỏi thanh địa chỉ và lịch sử ngay khi đọc
    window.history.replaceState(null, '', window.location.pathname);
    if (!code) {
      setErrorMessage('Thiếu mã chuyển phiên, vui lòng đăng nhập lại');
      return;
    }
    exchangeHandoff(code)
      .then(() => window.location.replace(import.meta.env.BASE_URL))
      .catch((error: unknown) =>
        setErrorMessage(error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại'),
      );
  }, [code]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-page-title font-bold text-text">Đang vào hệ thống</h1>
        {errorMessage ? (
          <>
            <Alert tone="danger">{errorMessage}</Alert>
            <a href={import.meta.env.BASE_URL} className="text-label font-medium text-link hover:underline">
              Về trang đăng nhập
            </a>
          </>
        ) : (
          <p className="text-label text-text-secondary">Đang mở phiên làm việc của trường...</p>
        )}
      </div>
    </main>
  );
}
