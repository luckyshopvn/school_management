import { useState } from 'react';
import { Button } from './Button.js';
import { TextField } from './TextField.js';

// Ô mã xác nhận gửi tới số điện thoại của tài khoản, kèm nút gửi mã (YCTD-323: đổi mật khẩu mặc định lần đầu). onSend gọi máy chủ và trả
// số điện thoại đã che để báo đã gửi tới đâu; lỗi khi gửi (quá số lần mỗi giờ) hiện dưới ô
export interface PhoneCodeFieldProperties {
  value: string;
  onChange: (value: string) => void;
  onSend: () => Promise<{ phone: string }>;
  error?: string;
}

export function PhoneCodeField({ value, onChange, onSend, error }: PhoneCodeFieldProperties) {
  const [sentTo, setSentTo] = useState<string>();
  const [sendError, setSendError] = useState<string>();
  const [sending, setSending] = useState(false);

  async function send() {
    setSendError(undefined);
    setSending(true);
    try {
      setSentTo((await onSend()).phone);
    } catch (caught) {
      setSendError(caught instanceof Error ? caught.message : 'Không gửi được mã, vui lòng thử lại');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-label text-text-secondary">
        Lần đầu đổi mật khẩu mặc định cần mã xác nhận gửi tới số điện thoại của tài khoản.
      </p>
      <Button variant="secondary" onClick={() => void send()} disabled={sending}>
        {sentTo ? 'Gửi lại mã' : 'Gửi mã xác nhận'}
      </Button>
      {sentTo ? (
        <p role="status" className="text-label text-text-secondary">
          Đã gửi mã tới số {sentTo}.
        </p>
      ) : null}
      <TextField
        label="Mã xác nhận"
        name="otp_code"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        error={sendError ?? error}
      />
    </div>
  );
}
