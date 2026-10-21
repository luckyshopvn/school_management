import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { IMPERSONATION_LIFETIME_MINUTES } from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS } from '@school-management/ui';
import { ApiError } from '../session/api-client.js';
import { useSession } from '../session/session.js';

// Hộp thoại đăng nhập thay ở 1.4 Danh sách người dùng (DT-18 phần 18h): ghi lý do; máy chủ kiểm tra quyền, không cho vào
// tài khoản có quyền cao hơn, ghi nhật ký
export function ImpersonateDialog({
  account,
  onClose,
}: {
  account: { id: string; full_name: string };
  onClose(): void;
}) {
  const dialogReference = useRef<HTMLDialogElement>(null);
  const reasonId = useId();
  const session = useSession();
  const navigate = useNavigate();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    dialogReference.current?.showModal();
  }, []);

  const submit = () => {
    setBusy(true);
    setError(undefined);
    session
      .startImpersonation(account.id, reason)
      .then(() => navigate({ to: '/' }))
      .catch((caught: unknown) => {
        setBusy(false);
        setError(
          caught instanceof ApiError
            ? caught.details.map((detail) => detail.message).join('; ') || caught.message
            : 'Không kết nối được tới máy chủ, vui lòng thử lại',
        );
      });
  };

  return (
    <dialog
      ref={dialogReference}
      aria-labelledby={`${reasonId}-title`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-full max-w-md rounded-xl border border-border bg-card p-6 text-text shadow-lg backdrop:bg-text/40"
    >
      <h2 id={`${reasonId}-title`} className="text-section-title font-semibold">
        Đăng nhập thay {account.full_name}
      </h2>
      <div className="mt-3 flex flex-col gap-3 text-content text-text-secondary">
        <p>
          Bạn sẽ thao tác bằng tài khoản này trong tối đa {IMPERSONATION_LIFETIME_MINUTES} phút để hỗ trợ người dùng.
          Mọi thao tác được ghi nhật ký kèm tên bạn; không đổi được mật khẩu, không thao tác chứng thư số và kí số.
        </p>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <label htmlFor={reasonId} className="text-label font-medium text-text">
          Lý do đăng nhập thay
        </label>
        <textarea
          id={reasonId}
          className={FORM_CONTROL_CLASS}
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <Button onClick={onClose} disabled={busy}>
          Hủy
        </Button>
        <Button variant="primary" onClick={submit} disabled={busy || reason.trim().length < 5}>
          Đăng nhập thay
        </Button>
      </div>
    </dialog>
  );
}
