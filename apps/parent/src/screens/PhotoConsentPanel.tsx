import { useEffect, useState } from 'react';
import { Alert, Button } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// MP-09 Đồng ý sử dụng hình ảnh của con (P02-09, BR-65; YCTD-67): phụ huynh đồng ý hoặc rút đồng ý, xem lịch sử
interface ConsentView {
  photo_consent: 'pending' | 'granted' | 'refused';
  history: Array<{ action: 'pending' | 'granted' | 'refused'; method: 'app' | 'paper' | null; created_at: string }>;
}

const LABELS = { pending: 'Chưa xác nhận', granted: 'Đồng ý', refused: 'Không đồng ý' } as const;

export function PhotoConsentPanel({ child }: { child: { id: string; full_name: string } }) {
  const [consent, setConsent] = useState<ConsentView>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    requestJson<ConsentView>(`/api/v1/children/${child.id}/photo-consent`)
      .then(setConsent)
      .catch(() => setErrorMessage('Không tải được trạng thái đồng ý'));
  }, [child.id]);

  const change = async (action: 'grant' | 'withdraw') => {
    setBusy(true);
    setErrorMessage(undefined);
    try {
      setConsent(
        await requestJson<ConsentView>(`/api/v1/children/${child.id}/photo-consent`, {
          method: 'POST',
          body: JSON.stringify({ action }),
        }),
      );
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-2" aria-label={`Đồng ý hình ảnh của ${child.full_name}`}>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      <p className="text-content">
        Sử dụng hình ảnh của con: <strong>{consent ? LABELS[consent.photo_consent] : '...'}</strong>
      </p>
      <p className="text-label text-text-secondary">
        Nhà trường chỉ công bố hình ảnh có con khi phụ huynh đồng ý. Phụ huynh rút đồng ý bất cứ lúc nào.
      </p>
      <div className="flex flex-wrap gap-2">
        {consent?.photo_consent !== 'granted' ? (
          <Button variant="primary" disabled={busy} onClick={() => void change('grant')}>
            Đồng ý sử dụng hình ảnh
          </Button>
        ) : (
          <Button disabled={busy} onClick={() => void change('withdraw')}>
            Rút đồng ý
          </Button>
        )}
      </div>
      <ul className="flex flex-col gap-1 text-label text-text-secondary">
        {(consent?.history ?? []).map((row) => (
          <li key={row.created_at}>
            {new Date(row.created_at).toLocaleString('vi-VN')}: {LABELS[row.action]}
            {row.method === 'paper' ? ' (giấy ký tay)' : row.method === 'app' ? ' (trên ứng dụng)' : ''}
          </li>
        ))}
      </ul>
    </section>
  );
}
