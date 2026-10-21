import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button } from '@school-management/ui';
import { ApiError } from '../session/api-client.js';
import { useSession } from '../session/session.js';
import { readDemoStatus } from './administration-api.js';

// Trang chọn vai của bản trình diễn (DT-18 phần 18h): chỉ hiện khi máy chủ là bản trình diễn; bấm một vai thì đăng nhập
// bằng tài khoản trình diễn của vai đó (dữ liệu giả, mật khẩu chung hiện công khai)
export function DemoRolePicker() {
  const session = useSession();
  const demo = useQuery({ queryKey: ['demo-status'], queryFn: readDemoStatus, retry: false });
  const [busyLogin, setBusyLogin] = useState<string>();
  const [error, setError] = useState<string>();
  const accounts = demo.data?.accounts.filter((account) => account.app === 'portal') ?? [];
  if (!demo.data?.enabled || !demo.data.password) {
    return null;
  }
  const password = demo.data.password;
  return (
    <section
      aria-label="Bản trình diễn: chọn vai"
      className="flex w-full max-w-sm flex-col gap-3 rounded-xl border border-border bg-card p-6 shadow-sm"
    >
      <h2 className="text-section-title font-semibold text-text">Bản trình diễn: chọn vai để vào thử</h2>
      <p className="text-label text-text-secondary">
        Dữ liệu giả, tự đặt lại định kỳ; không gửi tin nhắn hay thu tiền thật. Mật khẩu chung: {password}
      </p>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="flex flex-col gap-2">
        {accounts.map((account) => (
          <Button
            key={account.login}
            disabled={busyLogin !== undefined}
            onClick={() => {
              setBusyLogin(account.login);
              setError(undefined);
              session.login(account.login, password).catch((caught: unknown) => {
                setBusyLogin(undefined);
                setError(caught instanceof ApiError ? caught.message : 'Không kết nối được tới máy chủ, vui lòng thử lại');
              });
            }}
          >
            {account.role_name}: {account.full_name}
          </Button>
        ))}
      </div>
    </section>
  );
}
