import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { PlatformValidationError } from './platform-api.js';

// Thành phần dùng chung của các trang cổng vận hành thiết kế lại ở YCTD-370 (tài liệu 15 mục thành phần cổng vận hành): hộp thoại thay
// hộp nhập, hộp xác nhận của trình duyệt; dải thông báo kết quả; khối rỗng; khung xương khi tải; chặn bấm gửi lặp

// Nội dung lỗi của máy chủ: lỗi theo từng ô ghép lại, không có thì thông điệp chung
export function errorMessage(caught: unknown, fallback = 'Không thực hiện được, vui lòng thử lại'): string {
  if (caught instanceof PlatformValidationError && caught.problems.length) {
    return caught.problems.map((problem) => problem.message).join('; ');
  }
  return caught instanceof Error && caught.message ? caught.message : fallback;
}

// Lỗi máy chủ báo cho một ô (details[].field)
export function fieldError(caught: unknown, field: string): string | undefined {
  return caught instanceof PlatformValidationError
    ? caught.problems.find((problem) => problem.field === field)?.message
    : undefined;
}

export interface Outcome {
  tone: 'ok' | 'danger';
  text: string;
}

// Dải kết quả đầu trang: thành công đọc nhẹ (status), thất bại đọc ngay (alert)
export function OutcomeBanner({ outcome, onClose }: { outcome: Outcome | null; onClose?: () => void }) {
  if (!outcome) {
    return null;
  }
  return (
    <div className="banner" data-tone={outcome.tone} role={outcome.tone === 'ok' ? 'status' : 'alert'}>
      <span>{outcome.text}</span>
      {onClose ? (
        <button type="button" className="button-link" onClick={onClose}>
          Đóng
        </button>
      ) : null}
    </div>
  );
}

// Lỗi tải dữ liệu của trang, có nút tải lại
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="banner" data-tone="danger" role="alert">
      <span>{message}</span>
      <button type="button" className="button-link" onClick={onRetry}>
        Tải lại
      </button>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children ? <span>{children}</span> : null}
    </div>
  );
}

export function Skeleton({ lines = 4, label = 'Đang tải' }: { lines?: number; label?: string }) {
  return (
    <div role="status" aria-label={label}>
      {Array.from({ length: lines }, (_, index) => (
        <span key={index} className="skeleton" style={{ width: `${100 - (index % 3) * 15}%` }} />
      ))}
    </div>
  );
}

export function NoAccess() {
  return (
    <section className="card" aria-label="Không có quyền">
      <EmptyState title="Bạn không có quyền xem trang này">
        Trang này không thuộc vai trò của tài khoản. Cần quyền, hãy liên hệ quản trị nền tảng.
      </EmptyState>
    </section>
  );
}

// Hộp thoại dùng chung: hiện khi được gắn vào cây; Esc và nút × gọi onClose, trừ hộp thông tin hiện một lần (dismissible=false) chỉ
// đóng bằng nút của nó. Trình duyệt giữ tiêu điểm trong hộp; đóng xong trả tiêu điểm về nút đã mở
export function Dialog({
  title,
  onClose,
  dismissible = true,
  wide = false,
  children,
}: {
  title: string;
  onClose: () => void;
  dismissible?: boolean;
  wide?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) {
      return undefined;
    }
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    return () => {
      dialog.close();
      opener?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? 'wide' : undefined}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) {
          onClose();
        }
      }}
    >
      <div className="dialog-head">
        <h2 id={titleId}>{title}</h2>
        {dismissible ? (
          <button type="button" className="dialog-close" aria-label="Đóng" onClick={onClose}>
            ×
          </button>
        ) : null}
      </div>
      {children}
    </dialog>
  );
}

// Hỏi xác nhận trước thao tác không hoàn tác được; nút xác nhận đỏ khi là thao tác phá hủy
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  danger = false,
  busy = false,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog title={title} onClose={onCancel}>
      <div className="dialog-body">
        {children}
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <div className="dialog-foot">
        <button type="button" className="button-secondary" onClick={onCancel}>
          Quay lại
        </button>
        <button
          type="button"
          className={danger ? 'button-danger' : 'button-primary'}
          disabled={busy}
          aria-busy={busy}
          onClick={onConfirm}
        >
          {busy ? 'Đang xử lý…' : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}

// Chạy một thao tác gửi lên máy chủ, bỏ qua lần bấm khi thao tác trước chưa xong
export function useBusy(): [boolean, (task: () => Promise<void>) => Promise<void>] {
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const run = useCallback(async (task: () => Promise<void>) => {
    if (running.current) {
      return;
    }
    running.current = true;
    setBusy(true);
    try {
      await task();
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);
  return [busy, run];
}

// Giờ theo kiểu Việt Nam, để trống khi không có
export function dateTime(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString('vi-VN') : '';
}
