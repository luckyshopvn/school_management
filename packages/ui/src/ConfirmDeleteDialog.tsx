import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button.js';
import { DIALOG_NARROW_FULL_SCREEN_CLASS } from './dialog.js';

// Hộp xác nhận xóa theo mẫu của Sở (DT-15 phần 15a): phải tích "Tôi đã đọc và đồng ý xóa …" thì nút Xóa mới bấm được
export interface ConfirmDeleteDialogProperties {
  open: boolean;
  // Đối tượng bị xóa, ví dụ "3 tài khoản" hoặc "vai trò Giáo viên chủ nhiệm"
  subject: string;
  title?: string;
  children?: ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm(): void;
  onCancel(): void;
}

export function ConfirmDeleteDialog({
  open,
  subject,
  title = 'Xác nhận xóa',
  children,
  confirmLabel = 'Xóa',
  busy,
  onConfirm,
  onCancel,
}: ConfirmDeleteDialogProperties) {
  const dialogReference = useRef<HTMLDialogElement>(null);
  const [agreed, setAgreed] = useState(false);
  const titleId = useId();
  const checkboxId = useId();

  useEffect(() => {
    const dialog = dialogReference.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      // Mỗi lần mở phải tích lại
      setAgreed(false);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogReference}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className={`m-auto w-full max-w-md rounded-xl border border-border bg-card p-6 text-text shadow-lg backdrop:bg-text/40 ${DIALOG_NARROW_FULL_SCREEN_CLASS}`}
    >
      <h2 id={titleId} className="text-section-title font-semibold">
        {title}
      </h2>
      {children ? <div className="mt-3 text-content text-text-secondary">{children}</div> : null}
      <div className="mt-4 flex items-start gap-2 text-content">
        <input
          id={checkboxId}
          type="checkbox"
          className="mt-1 h-4 w-4"
          checked={agreed}
          disabled={busy}
          onChange={(event) => setAgreed(event.target.checked)}
        />
        <label htmlFor={checkboxId}>Tôi đã đọc và đồng ý xóa {subject}</label>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <Button onClick={onCancel} disabled={busy}>
          Hủy
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={!agreed || busy}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
