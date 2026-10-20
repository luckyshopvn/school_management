import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import jsQR from 'jsqr';
import { Button } from './Button.js';

// Quét mã QR bằng máy ảnh của điện thoại hoặc máy tính (DT-18 phần 18g): đọc khung hình của máy ảnh sau, giải mã bằng
// jsQR ngay trên trình duyệt (không gửi ảnh đi đâu), báo mã đọc được một lần rồi chờ mã khác. Máy không có máy ảnh, chưa
// cho phép dùng máy ảnh hoặc tem mờ thì nhập tay mã in dưới mã QR
export interface QrScannerProperties {
  onScan(text: string): void;
  // Nhãn của ô nhập tay
  manualLabel?: string;
  disabled?: boolean;
}

const SCAN_INTERVAL_MS = 250;

export function QrScanner({ onScan, manualLabel = 'Mã tem', disabled = false }: QrScannerProperties) {
  const inputId = useId();
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const handler = useRef(onScan);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string>();
  const [manual, setManual] = useState('');
  handler.current = onScan;

  useEffect(() => {
    if (!active) {
      return;
    }
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let last = '';
    let cancelled = false;
    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Trình duyệt không cho dùng máy ảnh. Nhập mã tem ở ô bên dưới.');
        setActive(false);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      } catch {
        setError('Chưa được phép dùng máy ảnh. Cho phép trong cài đặt trình duyệt hoặc nhập mã tem.');
        setActive(false);
        return;
      }
      if (cancelled || !video.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      video.current.srcObject = stream;
      await video.current.play().catch(() => undefined);
      timer = setInterval(() => {
        const element = video.current;
        const surface = canvas.current;
        if (!element || !surface || element.readyState < 2 || element.videoWidth === 0) {
          return;
        }
        surface.width = element.videoWidth;
        surface.height = element.videoHeight;
        const context = surface.getContext('2d', { willReadFrequently: true });
        if (!context) {
          return;
        }
        context.drawImage(element, 0, 0, surface.width, surface.height);
        const image = context.getImageData(0, 0, surface.width, surface.height);
        const code = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
        if (code?.data && code.data !== last) {
          last = code.data;
          handler.current(code.data);
        }
      }, SCAN_INTERVAL_MS);
    };
    setError(undefined);
    void start();
    return () => {
      cancelled = true;
      if (timer) {
        clearInterval(timer);
      }
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [active]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (manual.trim()) {
      handler.current(manual.trim());
      setManual('');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button variant={active ? 'secondary' : 'primary'} disabled={disabled} onClick={() => setActive(!active)}>
          {active ? 'Tắt máy ảnh' : 'Quét mã QR'}
        </Button>
      </div>
      {error ? <p className="text-label text-danger">{error}</p> : null}
      {active ? (
        <video
          ref={video}
          muted
          playsInline
          aria-label="Khung quét mã QR"
          className="aspect-square w-full max-w-sm rounded-xl bg-black object-cover"
        />
      ) : null}
      <canvas ref={canvas} hidden />
      <form className="flex flex-wrap items-end gap-2" onSubmit={submit}>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor={inputId} className="text-label font-medium text-text">
            {manualLabel}
          </label>
          <input
            id={inputId}
            value={manual}
            disabled={disabled}
            autoComplete="off"
            placeholder="TB-…"
            onChange={(event) => setManual(event.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-content"
          />
        </div>
        <Button type="submit" disabled={disabled || !manual.trim()}>
          Tra mã
        </Button>
      </form>
    </div>
  );
}
