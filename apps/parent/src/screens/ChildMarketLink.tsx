import { useEffect, useState } from 'react';
import { Alert, Button } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Liên kết hồ sơ con ở Chợ gia sư với trường (DT-27 phần 27f, YCTD-256): cha mẹ lấy mã 10 phút rồi dán ở chợ. Mã chỉ mang mã trường, mã
// học sinh dạng băm, cấp và lớp; chợ không đọc được dữ liệu nào khác của trường. Chỉ hiện khi nền tảng đã nối chợ
export function ChildMarketLink({ childId }: { childId: string }) {
  const [available, setAvailable] = useState(false);
  const [code, setCode] = useState<{ code: string; expires_at: string }>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    requestJson<{ available: boolean }>(`/api/v1/children/${childId}/market-link`)
      .then((result) => setAvailable(result.available))
      .catch(() => setAvailable(false));
  }, [childId]);
  if (!available) {
    return null;
  }
  return (
    <section aria-label="Liên kết với Chợ gia sư" className="flex flex-col gap-2">
      <h3 className="text-content font-semibold">Liên kết với Chợ gia sư</h3>
      <p className="text-label text-text-secondary">
        Lấy mã rồi dán ở hồ sơ con trên Chợ gia sư (hiệu lực 10 phút). Chợ chỉ nhận mã trường, mã học sinh đã băm, cấp
        và lớp của con.
      </p>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {code ? (
        <p className="break-all rounded border p-2 font-mono text-label" aria-label="Mã liên kết">
          {code.code}
        </p>
      ) : null}
      <Button
        onClick={() =>
          void requestJson<{ code: string; expires_at: string }>(`/api/v1/children/${childId}/market-link`, {
            method: 'POST',
          })
            .then((result) => {
              setError(undefined);
              setCode(result);
            })
            .catch((caught: unknown) =>
              setError(caught instanceof ApiError ? caught.message : 'Không kết nối được tới máy chủ'),
            )
        }
      >
        Lấy mã liên kết
      </Button>
    </section>
  );
}
