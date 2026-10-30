import { useState } from 'react';
import { Alert, Button } from '@school-management/ui';
import { requestParents, tutorErrorMessage, type ParentRequestState } from './ai-tutor-api.js';

// Nút "Gửi lời nhờ cha mẹ" (YCTD-383 lát L5, bản mẫu MH-596): hiện khi em chưa có gói hoặc đã hết lượt. Máy chủ chọn lý do, gửi thông
// báo cho cha mẹ có tài khoản ứng dụng phụ huynh, mỗi lý do một lần trong 24 giờ; em không gõ nội dung
const formatMoment = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(
    new Date(value),
  );

export function ParentRequestButton({ initial }: { initial: ParentRequestState | null }) {
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  if (!state?.reason) {
    return null;
  }
  if (!state.guardian_account) {
    return (
      <p className="text-label text-text-secondary">
        Cha mẹ chưa có tài khoản ứng dụng phụ huynh. Em nói trực tiếp với cha mẹ nhé.
      </p>
    );
  }
  if (state.next_allowed_at && state.last_sent_at) {
    return (
      <Alert tone="success">
        Đã gửi lời nhờ cha mẹ lúc {formatMoment(state.last_sent_at)}. Em gửi lại được sau{' '}
        {formatMoment(state.next_allowed_at)}.
      </Alert>
    );
  }
  const send = async () => {
    setBusy(true);
    setErrorMessage(undefined);
    try {
      setState(await requestParents());
    } catch (error) {
      setErrorMessage(tutorErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-2">
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      <div>
        <Button variant="primary" disabled={busy} onClick={() => void send()}>
          Gửi lời nhờ cha mẹ
        </Button>
      </div>
    </div>
  );
}
