import { useCallback, useState, type ReactNode } from 'react';
import type { PortalQuickLinkPath } from '@school-management/shared';
import { Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';

// Phần dùng chung của các màn hình giao việc, lịch, hồ sơ công việc, báo cáo (DT-18 phần 18c, YCTD-141)
export const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
export const todayText = () => VIETNAM_DATE.format(new Date());
export const shiftDate = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
// Thứ Hai đầu tuần của một ngày
export function mondayOf(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return shiftDate(date, day === 0 ? -6 : 1 - day);
}
export const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' });
export const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });

export function useToast() {
  const [toast, setToast] = useState<string>();
  const close = useCallback(() => setToast(undefined), []);
  return { toast, setToast, close };
}

export function Page({
  path,
  children,
  toast,
  onToastClose,
}: {
  path: PortalQuickLinkPath;
  children: ReactNode;
  toast?: string;
  onToastClose?(): void;
}) {
  return (
    <AppShell>
      <Toast message={toast} onClose={onToastClose ?? (() => undefined)} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle(path)}</h1>
        {children}
      </div>
    </AppShell>
  );
}

export function Tabs<Value extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: Value;
  options: Array<{ value: Value; label: string }>;
  onChange(value: Value): void;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1 border-b border-border">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={`-mb-px rounded-t-lg border border-b-0 px-3 py-2 text-content ${
            value === option.value
              ? 'border-border bg-card font-semibold text-text'
              : 'border-transparent text-text-secondary'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <h2 className="text-section-title font-semibold text-text">{title}</h2>
      {children}
    </section>
  );
}
