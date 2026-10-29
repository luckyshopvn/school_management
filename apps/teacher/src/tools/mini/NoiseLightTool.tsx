import { useEffect, useRef, useState } from 'react';
import { Alert, Button } from '@school-management/ui';
import { noiseLight, rootMeanSquare, type NoiseLight } from './mini-logic.ts';

// Đèn giữ trật tự (DT-29 phần 29b, YCTD-326): đo độ ồn của lớp bằng micro của máy giáo viên, đèn xanh, vàng, đỏ theo độ nhạy giáo
// viên chọn. Âm thanh chỉ đo mức to nhỏ ngay trên máy: không ghi âm, không lưu, không gửi đi; bấm Dừng hoặc rời công cụ thì tắt
// micro
const LIGHTS: Record<NoiseLight, { label: string; color: string }> = {
  green: { label: 'Đèn xanh: lớp đang yên lặng', color: '#16a34a' },
  yellow: { label: 'Đèn vàng: lớp hơi ồn', color: '#ca8a04' },
  red: { label: 'Đèn đỏ: lớp ồn quá', color: '#dc2626' },
};

export function NoiseLightTool() {
  const [listening, setListening] = useState(false);
  const [light, setLight] = useState<NoiseLight>('green');
  const [sensitivity, setSensitivity] = useState(5);
  const [problem, setProblem] = useState<string>();
  const sensitivityRef = useRef(sensitivity);
  sensitivityRef.current = sensitivity;

  useEffect(() => {
    if (!listening) {
      return;
    }
    let stream: MediaStream | undefined;
    let context: AudioContext | undefined;
    let frame = 0;
    let cancelled = false;
    // Mức đã làm mượt để đèn không nháy theo từng tiếng động ngắn
    let smoothed = 0;
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: false })
      .then((media) => {
        if (cancelled) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = media;
        context = new AudioContext();
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        context.createMediaStreamSource(media).connect(analyser);
        const samples = new Float32Array(analyser.fftSize);
        const measure = () => {
          analyser.getFloatTimeDomainData(samples);
          smoothed = smoothed * 0.85 + rootMeanSquare(samples) * 0.15;
          setLight(noiseLight(smoothed, sensitivityRef.current));
          frame = requestAnimationFrame(measure);
        };
        measure();
      })
      .catch(() => {
        setProblem('Không mở được micro. Hãy cho phép trình duyệt dùng micro rồi bấm Bắt đầu đo lại.');
        setListening(false);
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close();
    };
  }, [listening]);

  const current = LIGHTS[light];
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-label text-text-secondary">
        Chỉ đo độ to nhỏ ngay trên máy này; không ghi âm, không lưu, không gửi đi.
      </p>
      {problem ? <Alert tone="warning">{problem}</Alert> : null}
      <div
        role="status"
        aria-label={listening ? current.label : 'Chưa đo'}
        className="flex h-56 w-56 items-center justify-center rounded-full border-8 border-border"
        style={{ backgroundColor: listening ? current.color : '#e2e8f0' }}
      />
      <p className="text-section-title font-semibold text-text">{listening ? current.label : 'Chưa đo'}</p>
      <label className="flex w-full max-w-sm flex-col gap-1 text-label font-medium text-text">
        Độ nhạy: {sensitivity}
        <input
          type="range"
          min={1}
          max={10}
          value={sensitivity}
          onChange={(event) => setSensitivity(Number(event.target.value))}
        />
      </label>
      {listening ? (
        <Button onClick={() => setListening(false)}>Dừng đo, tắt micro</Button>
      ) : (
        <Button
          variant="primary"
          onClick={() => {
            setProblem(undefined);
            setListening(true);
          }}
        >
          Bắt đầu đo
        </Button>
      )}
    </div>
  );
}
