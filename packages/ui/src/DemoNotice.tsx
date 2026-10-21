import { useEffect, useState } from 'react';
import { Button } from './Button.js';

// Bản trình diễn (DT-18 phần 18h) cho ứng dụng giáo viên, phụ huynh: đọc điểm cuối công khai /api/v1/public/demo; máy chủ
// không phải bản trình diễn thì không hiện gì
export interface DemoNoticeAccount {
  login: string;
  full_name: string;
  role_name: string;
  app: 'portal' | 'teacher' | 'parent';
}

interface DemoNoticeStatus {
  enabled: boolean;
  password: string | null;
  accounts: DemoNoticeAccount[];
}

let cached: Promise<DemoNoticeStatus | null> | undefined;

function readDemoStatus(): Promise<DemoNoticeStatus | null> {
  cached ??= fetch('/api/v1/public/demo', { credentials: 'same-origin' })
    .then((response) => (response.ok ? (response.json() as Promise<DemoNoticeStatus>) : null))
    .catch(() => null);
  return cached;
}

function useDemoStatus(): DemoNoticeStatus | null {
  const [status, setStatus] = useState<DemoNoticeStatus | null>(null);
  useEffect(() => {
    let active = true;
    void readDemoStatus().then((value) => {
      if (active) {
        setStatus(value);
      }
    });
    return () => {
      active = false;
    };
  }, []);
  return status;
}

export function DemoBanner() {
  const status = useDemoStatus();
  if (!status?.enabled) {
    return null;
  }
  return (
    <div role="note" className="bg-header-accent px-4 py-1.5 text-center text-label font-medium text-text">
      Bản trình diễn: dữ liệu giả, không gửi tin nhắn, Zalo hay thu tiền thật.
    </div>
  );
}

// Chọn vai ở màn hình đăng nhập của bản trình diễn: bấm thì đăng nhập bằng tài khoản trình diễn của ứng dụng này
export function DemoAccountPicker({
  app,
  onPick,
}: {
  app: DemoNoticeAccount['app'];
  onPick(login: string, password: string): void;
}) {
  const status = useDemoStatus();
  const accounts = status?.accounts.filter((account) => account.app === app) ?? [];
  if (!status?.enabled || !status.password || accounts.length === 0) {
    return null;
  }
  const password = status.password;
  return (
    <section
      aria-label="Bản trình diễn: chọn vai"
      className="flex w-full max-w-sm flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-sm"
    >
      <h2 className="text-content font-semibold text-text">Bản trình diễn: chọn tài khoản để vào thử</h2>
      <p className="text-label text-text-secondary">Mật khẩu chung: {password}</p>
      {accounts.map((account) => (
        <Button key={account.login} onClick={() => onPick(account.login, password)}>
          {account.role_name}: {account.full_name}
        </Button>
      ))}
    </section>
  );
}
