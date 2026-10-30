import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ApplicationHeader, Button, QrScanner, StatusBadge } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Quét thẻ QR ghi lượt vào, ra cổng (YCTD-389 lát L1): bảo vệ hoặc quản lý đơn vị chọn hướng rồi quét; quét lại trong 5 phút
// là cùng một lượt; lượt vào muộn được tự ghi "Đi muộn" ở điểm danh, phụ huynh nhận thông báo
interface ScanResult {
  id: string;
  child_name: string;
  class_name: string | null;
  direction: 'in' | 'out';
  passed_at: string;
  duplicate: boolean;
  auto_late: boolean;
}

interface RecentPass {
  id: string;
  child_name: string;
  direction: 'in' | 'out';
  passed_at: string;
  method: string;
  review_status: 'confirmed' | 'needs_review' | 'rejected';
}

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ';
}

function timeOf(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }).format(
    new Date(value),
  );
}

export function GateScanScreen({ onBack }: { onBack(): void }) {
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [result, setResult] = useState<{ tone: 'success' | 'warning' | 'danger'; text: string }>();
  const [recent, setRecent] = useState<RecentPass[]>();
  const [loadError, setLoadError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const loadRecent = useCallback(() => {
    requestJson<RecentPass[]>('/api/v1/gate-passes/recent')
      .then((rows) => {
        setRecent(rows);
        setLoadError(undefined);
      })
      .catch((error: unknown) => setLoadError(messageOf(error)));
  }, []);

  useEffect(loadRecent, [loadRecent]);

  async function scan(code: string) {
    // Máy ảnh đọc liên tục: bỏ qua mã mới khi lượt trước chưa xong
    if (busyRef.current) {
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const pass = await requestJson<ScanResult>('/api/v1/gate-passes', {
        method: 'POST',
        body: JSON.stringify({ code, direction }),
      });
      const where = pass.class_name ? ` (lớp ${pass.class_name})` : '';
      const action = pass.direction === 'in' ? 'vào' : 'ra';
      if (pass.duplicate) {
        setResult({
          tone: 'warning',
          text: `${pass.child_name}${where} đã quét ${action} lúc ${timeOf(pass.passed_at)}; không ghi thêm.`,
        });
      } else {
        setResult({
          tone: 'success',
          text: `${pass.child_name}${where}: ${action} lúc ${timeOf(pass.passed_at)}.${pass.auto_late ? ' Đã ghi đi muộn.' : ''}`,
        });
      }
      loadRecent();
    } catch (error) {
      setResult({ tone: 'danger', text: messageOf(error) });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <ApplicationHeader title="Ứng dụng giáo viên" />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6 md:max-w-3xl">
        <div className="flex items-center gap-3">
          <Button variant="text" onClick={onBack}>
            Quay lại
          </Button>
          <h1 className="text-section-title font-bold text-text">Quét thẻ vào, ra cổng</h1>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-label font-medium text-text">Hướng</legend>
          <div className="flex gap-2">
            <Button
              variant={direction === 'in' ? 'primary' : 'secondary'}
              aria-pressed={direction === 'in'}
              onClick={() => setDirection('in')}
            >
              Vào trường
            </Button>
            <Button
              variant={direction === 'out' ? 'primary' : 'secondary'}
              aria-pressed={direction === 'out'}
              onClick={() => setDirection('out')}
            >
              Ra cổng
            </Button>
          </div>
        </fieldset>
        <QrScanner
          onScan={(code) => void scan(code)}
          manualLabel="Mã in trên thẻ (16 ký tự)"
          manualPlaceholder="ABCD EFGH IJKL MNOP"
          disabled={busy}
        />
        {busy ? <p className="text-content text-text-secondary">Đang ghi…</p> : null}
        {result ? <Alert tone={result.tone}>{result.text}</Alert> : null}
        <section className="flex flex-col gap-2" aria-labelledby="luot-hom-nay">
          <h2 id="luot-hom-nay" className="text-content font-bold text-text">
            Lượt hôm nay
          </h2>
          {loadError ? (
            <Alert tone="danger">
              {loadError}{' '}
              <Button variant="text" onClick={loadRecent}>
                Thử lại
              </Button>
            </Alert>
          ) : null}
          {!recent && !loadError ? <p className="text-content text-text-secondary">Đang tải…</p> : null}
          {recent && recent.length === 0 ? (
            <p className="text-content text-text-secondary">Chưa có lượt nào hôm nay.</p>
          ) : null}
          <ul className="flex flex-col gap-2">
            {(recent ?? []).map((pass) => (
              <li
                key={pass.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2"
              >
                <span className="min-w-0 break-words text-content text-text">
                  <span className="font-semibold">{timeOf(pass.passed_at)}</span> {pass.child_name}
                </span>
                {pass.review_status === 'rejected' ? (
                  <StatusBadge tone="neutral" label="Đã báo nhầm" />
                ) : (
                  <StatusBadge
                    tone={pass.direction === 'in' ? 'success' : 'info'}
                    label={pass.direction === 'in' ? 'Vào' : 'Ra'}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
