import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, FORM_CONTROL_CLASS } from '@school-management/ui';
import { errorText, marketRequest } from '@school-management/market-client';
import { STATUS_LABELS, uploadDocument, type Listing, type VerificationKind } from './tutor-api.js';

// Xác minh từng bậc của gia sư (DT-27 phần 27g, YCTD-257): danh tính qua nhà cung cấp định danh (chuyển sang trang của nhà cung cấp rồi
// quay về /xac-minh), bằng cấp, phiếu lý lịch tư pháp (cấp trong 6 tháng), đăng ký kinh doanh. Giấy tờ mã hóa ở máy chủ, chỉ nhân viên
// duyệt của nền tảng xem
const DOCUMENT_FIELDS: Record<
  Exclude<VerificationKind, 'identity'>,
  { title: string; fields: Array<{ name: string; label: string; type?: string }> }
> = {
  degree: {
    title: 'Bằng cấp',
    fields: [
      { name: 'title', label: 'Tên văn bằng, chứng chỉ' },
      { name: 'institution', label: 'Nơi cấp' },
    ],
  },
  criminal_record: {
    title: 'Phiếu lý lịch tư pháp',
    fields: [{ name: 'issued_on', label: 'Ngày cấp', type: 'date' }],
  },
  business_registration: {
    title: 'Đăng ký kinh doanh (bắt buộc khi dạy môn của chương trình phổ thông có thu tiền)',
    fields: [{ name: 'registration_no', label: 'Số đăng ký kinh doanh' }],
  },
};

export function TutorVerification({ listing, onChange }: { listing: Listing; onChange: (next: Listing) => void }) {
  const [providers, setProviders] = useState<Array<{ code: string; display_name: string }>>([]);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  useEffect(() => {
    marketRequest<Array<{ code: string; display_name: string }>>('GET', '/identity/providers')
      .then(setProviders)
      .catch(() => setProviders([]));
  }, []);

  const verifyIdentity = (provider: string) => {
    marketRequest<{ authorization_url: string }>('POST', '/identity/start', {
      provider,
      purpose: 'verify',
      return_url: `${window.location.origin}/xac-minh`,
    })
      .then((result) => window.location.assign(result.authorization_url))
      .catch((caught: unknown) => setError(errorText(caught)));
  };

  const submitDocument = (kind: Exclude<VerificationKind, 'identity'>) => (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    uploadDocument(kind, form)
      .then((next) => {
        setError(undefined);
        setMessage(`Đã nộp ${DOCUMENT_FIELDS[kind].title.toLowerCase()}, chờ nền tảng duyệt`);
        onChange(next);
      })
      .catch((caught: unknown) => setError(errorText(caught)));
  };

  const state = listing.verification_state;
  return (
    <section aria-label="Xác minh gia sư" className="flex flex-col gap-3">
      <h2 className="text-section-title font-semibold">Xác minh</h2>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}
      <section className="flex flex-col gap-2 rounded-lg border p-3" aria-label="Danh tính">
        <h3 className="font-semibold">Danh tính (đủ 18 tuổi)</h3>
        <p>
          Trạng thái: <strong>{STATUS_LABELS[state.identity]}</strong>
          {listing.verifications.identity?.note ? ` – ${listing.verifications.identity.note}` : ''}
        </p>
        {state.identity !== 'approved' ? (
          providers.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {providers.map((provider) => (
                <Button key={provider.code} variant="primary" onClick={() => verifyIdentity(provider.code)}>
                  Xác minh bằng {provider.display_name}
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-text-secondary">Nền tảng chưa khai nhà cung cấp định danh.</p>
          )
        ) : null}
      </section>
      {(Object.keys(DOCUMENT_FIELDS) as Array<Exclude<VerificationKind, 'identity'>>).map((kind) => (
        <form
          key={kind}
          aria-label={DOCUMENT_FIELDS[kind].title}
          className="flex flex-col gap-2 rounded-lg border p-3"
          onSubmit={submitDocument(kind)}
        >
          <h3 className="font-semibold">{DOCUMENT_FIELDS[kind].title}</h3>
          <p>
            Trạng thái: <strong>{STATUS_LABELS[state[kind]]}</strong>
            {listing.verifications[kind]?.note ? ` – ${listing.verifications[kind]?.note}` : ''}
            {listing.verifications[kind]?.valid_until
              ? ` (hiệu lực đến ${listing.verifications[kind]?.valid_until})`
              : ''}
          </p>
          {listing.uploads_enabled ? (
            <>
              {DOCUMENT_FIELDS[kind].fields.map((field) => (
                <label key={field.name} className="flex flex-col">
                  {field.label}
                  <input className={FORM_CONTROL_CLASS} name={field.name} type={field.type ?? 'text'} required />
                </label>
              ))}
              <label className="flex flex-col">
                Tệp (PDF, JPEG, PNG, tối đa 10 MB)
                <input className={FORM_CONTROL_CLASS} name="file" type="file" accept=".pdf,.jpg,.jpeg,.png" required />
              </label>
              <Button type="submit">Nộp {DOCUMENT_FIELDS[kind].title.split(' (')[0]?.toLowerCase()}</Button>
            </>
          ) : (
            <p className="text-text-secondary">Nền tảng chưa bật nhận tệp giấy tờ.</p>
          )}
        </form>
      ))}
    </section>
  );
}
