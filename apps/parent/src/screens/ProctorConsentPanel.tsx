import { useEffect, useState } from 'react';
import { PROCTOR_CONSENT_AGE, PROCTOR_CONSENT_SCOPE_LABELS, type ProctorConsentScope } from '@school-management/shared';
import { Alert, Button } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Đồng ý cho con thi trực tuyến có giám sát bằng camera (DT-23 phần 23e, YCTD-215): phụ huynh đồng ý hoặc thu hồi từng loại
// (giáo viên coi thi xem camera trực tiếp, ghi hình); học sinh dưới 16 tuổi chỉ vào được bài có giám sát khi đã có đồng ý
interface ChildConsent {
  child_id: string;
  full_name: string;
  needs_parent_consent: boolean;
  consents: Record<ProctorConsentScope, { granted_at: string; source: string; granted_by_name: string } | null>;
}

const SCOPES: ProctorConsentScope[] = ['live', 'record'];

export function ProctorConsentPanel({ child }: { child: { id: string; full_name: string } }) {
  const [consent, setConsent] = useState<ChildConsent>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    requestJson<{ items: ChildConsent[] }>('/api/v1/parent/exam-proctor-consents')
      .then((reply) => setConsent(reply.items.find((item) => item.child_id === child.id)))
      .catch(() => setErrorMessage('Không tải được trạng thái đồng ý'));
  }, [child.id]);

  const change = async (scope: ProctorConsentScope, granted: boolean) => {
    setBusy(true);
    setErrorMessage(undefined);
    try {
      const consents = await requestJson<ChildConsent['consents']>('/api/v1/parent/exam-proctor-consents', {
        method: 'PUT',
        body: JSON.stringify({ child_id: child.id, scope, granted }),
      });
      setConsent((current) => (current ? { ...current, consents } : current));
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-2" aria-label={`Đồng ý giám sát thi của ${child.full_name}`}>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      <p className="text-label text-text-secondary">
        Một số bài thi trực tuyến do nhà trường tổ chức có giám sát bằng camera. Học sinh dưới {PROCTOR_CONSENT_AGE}{' '}
        tuổi chỉ vào được bài có giám sát khi phụ huynh đồng ý từng loại dưới đây; phụ huynh thu hồi bất cứ lúc nào, có
        hiệu lực từ lần giám sát tiếp theo. Hình camera không được dùng để nhận diện danh tính; bản ghi (nếu có) lưu mã
        hoá, tự xoá sau thời hạn của nhà trường, chỉ giáo viên giao bài và người quản lý xem.
      </p>
      {consent ? (
        <ul className="flex flex-col gap-2">
          {SCOPES.map((scope) => {
            const current = consent.consents[scope];
            return (
              <li
                key={scope}
                aria-label={PROCTOR_CONSENT_SCOPE_LABELS[scope]}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3"
              >
                <span className="flex-1 text-content">
                  {PROCTOR_CONSENT_SCOPE_LABELS[scope]}:{' '}
                  <strong>
                    {current
                      ? `Đã đồng ý (${new Date(current.granted_at).toLocaleDateString('vi-VN')}, ${current.source === 'parent' ? 'trên ứng dụng' : 'văn bản ghi nhận tại trường'})`
                      : 'Chưa đồng ý'}
                  </strong>
                </span>
                {current ? (
                  <Button disabled={busy} onClick={() => void change(scope, false)}>
                    Thu hồi đồng ý
                  </Button>
                ) : (
                  <Button variant="primary" disabled={busy} onClick={() => void change(scope, true)}>
                    Đồng ý
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      ) : errorMessage ? null : (
        <p className="text-label text-text-secondary">Đang tải…</p>
      )}
    </section>
  );
}
