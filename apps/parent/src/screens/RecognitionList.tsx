import { useEffect, useState } from 'react';
import { Alert, Button } from '@school-management/ui';

// Huy hiệu, chứng nhận của một em (DT-28 phần 28i, YCTD-279): dùng chung cho học sinh (`#hoc-sinh`) và phụ huynh. Chỉ hiện khi
// trường đã bật; không so sánh với bạn khác. Chứng nhận tải dạng PDF, có mã kiểm tra
export interface RecognitionView {
  badges_enabled: boolean;
  certificates_enabled: boolean;
  badges: Array<{ id: string; title: string; reason: string | null; space_title: string | null; awarded_at: string }>;
  certificates: Array<{ id: string; code: string; course_title: string; issued_at: string }>;
}

export function RecognitionList({
  label,
  load,
  download,
}: {
  label: string;
  load(): Promise<RecognitionView>;
  download(certificateId: string): Promise<Blob>;
}) {
  const [data, setData] = useState<RecognitionView>();
  const [errorMessage, setErrorMessage] = useState<string>();
  useEffect(() => {
    load()
      .then(setData)
      .catch(() => setData(undefined));
  }, [load]);
  if (!data || (!data.badges_enabled && !data.certificates_enabled)) {
    return null;
  }
  const save = async (certificate: RecognitionView['certificates'][number]) => {
    try {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(await download(certificate.id));
      link.download = `chung-nhan-${certificate.code.toLowerCase()}.pdf`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      setErrorMessage('Không tải được chứng nhận');
    }
  };
  return (
    <section aria-label={label} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <h3 className="text-body font-semibold text-text">{label}</h3>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {data.badges_enabled ? (
        data.badges.length > 0 ? (
          <ul className="flex flex-col gap-1 text-label text-text" aria-label="Huy hiệu">
            {data.badges.map((badge) => (
              <li key={badge.id}>
                <strong>{badge.title}</strong>
                {badge.space_title ? ` · ${badge.space_title}` : ''}
                {badge.reason ? ` · ${badge.reason}` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-label text-text-secondary">Chưa có huy hiệu.</p>
        )
      ) : null}
      {data.certificates_enabled && data.certificates.length > 0 ? (
        <ul className="flex flex-col gap-1 text-label text-text" aria-label="Chứng nhận hoàn thành">
          {data.certificates.map((certificate) => (
            <li key={certificate.id} className="flex flex-wrap items-center gap-2">
              <span>
                Chứng nhận {certificate.course_title} · mã {certificate.code}
              </span>
              <Button variant="text" onClick={() => void save(certificate)}>
                Tải chứng nhận
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
