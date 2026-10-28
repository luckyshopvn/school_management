import { useEffect, useState } from 'react';
import { Alert } from './Alert.js';

// Vào ứng dụng của trường bằng đường liên kết hỗ trợ một lần (YCTD-315): quản trị nền tảng bấm "Ứng dụng của trường" ở cổng vận
// hành, nhận /support-login?code=… của từng ứng dụng; trang đổi mã lấy phiên của kênh này (cookie mã làm mới của kênh) rồi mở trang
// đầu của ứng dụng. Mọi thao tác vẫn là của tài khoản hỗ trợ của trường và ghi vào nhật ký phiên hỗ trợ
export type SupportChannel = 'teacher' | 'parent' | 'student';

export function isSupportSignInLocation(basePath: string): boolean {
  return window.location.pathname === `${basePath.replace(/\/$/, '')}/support-login`;
}

export function SupportSignIn({ channel, basePath }: { channel: SupportChannel; basePath: string }) {
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code') ?? '';
    if (!code) {
      setErrorMessage('Thiếu mã trong đường liên kết hỗ trợ');
      return;
    }
    fetch('/api/v1/auth/support/exchange', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, channel }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
          throw new Error(body?.error?.message ?? 'Đường liên kết hỗ trợ không dùng được');
        }
        window.location.replace(basePath);
      })
      .catch((error: unknown) =>
        setErrorMessage(error instanceof Error ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại'),
      );
  }, [channel, basePath]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-page-title font-bold text-text">Phiên hỗ trợ</h1>
        {errorMessage ? (
          <Alert tone="danger">{errorMessage}</Alert>
        ) : (
          <p className="text-label text-text-secondary">Đang mở phiên hỗ trợ...</p>
        )}
      </div>
    </main>
  );
}
