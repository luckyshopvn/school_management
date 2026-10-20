import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, FORM_CONTROL_CLASS } from '@school-management/ui';
import { formatDate, messageOf } from '../archives/archive-ui.js';
import { verifyOutgoing } from './outgoing-api.js';

// Trang tra cứu công khai của mã QR in trên văn bản đi đã ký (DT-18 phần 18b, YCTD-140): không cần đăng nhập; người nhận
// đối chiếu số ký hiệu, ngày ban hành, người ký, mã băm của bản đã ký. Trích yếu chỉ hiện với văn bản không mật đã ban hành
function initialCode(): string {
  return new URLSearchParams(window.location.search).get('ma')?.trim().toUpperCase() ?? '';
}

export function VerifyDocumentPage() {
  const [input, setInput] = useState(initialCode);
  const [code, setCode] = useState(initialCode);
  const result = useQuery({
    queryKey: ['outgoing-verify', code],
    queryFn: () => verifyOutgoing(code),
    enabled: code.length > 0,
    retry: false,
  });
  const data = result.data;
  const row = (label: string, value: string | null | undefined) => (
    <div className="grid grid-cols-1 gap-1 border-b border-border py-2 md:grid-cols-[12rem_1fr]">
      <dt className="text-label font-medium text-text-secondary">{label}</dt>
      <dd className="break-all text-content text-text">{value ?? ''}</dd>
    </div>
  );
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 bg-page p-4">
      <h1 className="text-page-title font-bold text-text">Tra cứu văn bản</h1>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setCode(input.trim().toUpperCase());
        }}
      >
        <label className="flex flex-col gap-1 text-label font-medium text-text">
          Mã tra cứu
          <input className={FORM_CONTROL_CLASS} value={input} onChange={(event) => setInput(event.target.value)} />
        </label>
        <Button type="submit" variant="primary">
          Tra cứu
        </Button>
      </form>
      {result.error ? <Alert tone="danger">{messageOf(result.error)}</Alert> : null}
      {data ? (
        <section aria-label="Kết quả tra cứu" className="rounded-xl border border-border bg-card p-4">
          <Alert tone={data.issued ? 'success' : 'warning'}>
            {data.issued ? 'Văn bản đã ban hành' : 'Văn bản đã ký, chưa ban hành'}
          </Alert>
          <dl>
            {row('Đơn vị ban hành', data.school_name)}
            {row('Số ký hiệu', data.symbol)}
            {row('Ngày ban hành', formatDate(data.issue_date))}
            {row('Trích yếu', data.summary ?? (data.issued ? '(Văn bản mật, không hiện trích yếu)' : ''))}
            {row('Người ký', [data.signer_name, data.signer_title].filter(Boolean).join(', '))}
            {row(
              'Thời điểm ký',
              data.signed_at ? new Date(data.signed_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '',
            )}
            {row('Hình thức ký', data.internal_signature ? 'Ký xác nhận nội bộ (không phải chữ ký số)' : 'Ký số')}
            {row('Mã băm SHA-256 của bản đã ký', data.signed_sha256)}
          </dl>
        </section>
      ) : null}
    </main>
  );
}
