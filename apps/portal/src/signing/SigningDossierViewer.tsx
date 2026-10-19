import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SIGNING_SIGNATURE_TYPE_LABELS, type SigningDocumentSection } from '@school-management/shared';
import { Alert, Button } from '@school-management/ui';
import { formatDateTime, messageOf } from './SigningCertificatePage.js';
import { downloadDossierFile, openDossierFile, readDossierView, type SigningDossierView } from './signing-api.js';

// Cửa sổ "Xem hồ sơ kí" như Sở (DT-17 phần 17b, YCTD-133): bên trái "Thông tin chữ ký số" (người kí, thời điểm, chứng thư,
// mã băm), bên phải nội dung hồ sơ theo phần và mục đã lập (cùng số liệu với tệp XML, tệp PDF); Phóng to, Tải xuống (tệp
// PDF, tệp XML), In (mở tệp PDF ở thẻ mới). Bản nội bộ không có chữ ký số nên khung chữ ký ghi rõ "kí xác nhận nội bộ"
function SignaturePanel({ view }: { view: SigningDossierView }) {
  const signature = view.signature;
  const rows: Array<[string, string]> = signature
    ? [
        ['Người kí', signature.signed_by_name ?? ''],
        ['Thời điểm kí', formatDateTime(signature.signed_at)],
        ['Cách kí', signature.digital ? 'Chữ ký số' : 'Kí xác nhận nội bộ, không phải chữ ký số'],
        ['Kiểu chữ ký', signature.signature_type ? SIGNING_SIGNATURE_TYPE_LABELS[signature.signature_type] : ''],
        ['Nhà phát hành', signature.provider ?? ''],
        ['Người đứng tên chứng thư', signature.holder_name ?? ''],
        ['Số sê-ri chứng thư', signature.serial_number ?? ''],
        ['Mã băm tệp gốc (SHA-256)', signature.original_sha256],
        ['Mã băm tệp đã kí (SHA-256)', signature.signed_sha256 ?? ''],
      ]
    : [
        ['Trạng thái', 'Chờ ký'],
        ['Mã băm tệp gốc (SHA-256)', view.dossier.file_sha256],
      ];
  return (
    <section aria-label="Thông tin chữ ký số" className="flex flex-col gap-3 rounded border border-border p-4">
      <h3 className="text-section-title font-semibold text-text">Thông tin chữ ký số</h3>
      <dl className="flex flex-col gap-2 text-label">
        {[['Mã định danh hồ sơ', view.dossier.code] as [string, string], ...rows].map(([label, value]) => (
          <div key={label} className="flex flex-col">
            <dt className="text-text-secondary">{label}</dt>
            <dd className="break-all text-text">{value || '—'}</dd>
          </div>
        ))}
      </dl>
      {signature && !signature.digital ? (
        <p className="text-label text-text-secondary">{signature.description}</p>
      ) : null}
    </section>
  );
}

function SectionView({ section }: { section: SigningDocumentSection }) {
  return (
    <section aria-label={section.title} className="flex flex-col gap-2">
      <h4 className="font-semibold text-text">{section.title}</h4>
      {section.items ? (
        <table className="w-full border-collapse text-label">
          <tbody>
            {section.items.map((item) => (
              <tr key={item.key} className="border-b border-border">
                <th scope="row" className="w-2/5 py-1 pr-3 text-left font-normal text-text-secondary">
                  {item.label}
                </th>
                <td className="py-1 text-text">{item.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {section.table ? (
        section.table.rows.length === 0 ? (
          <p className="text-label text-text-secondary">Chưa có dữ liệu.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-label">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-1 pr-3 text-left">STT</th>
                  {section.table.columns.map((column) => (
                    <th key={column.key} className="py-1 pr-3 text-left">
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.table.rows.map((row, index) => (
                  <tr key={index} className="border-b border-border">
                    <td className="py-1 pr-3">{index + 1}</td>
                    {section.table?.columns.map((column) => (
                      <td key={column.key} className="py-1 pr-3">
                        {row[column.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </section>
  );
}

export function SigningDossierViewer({ dossierId, onClose }: { dossierId: string; onClose(): void }) {
  const dialogReference = useRef<HTMLDialogElement>(null);
  const [wide, setWide] = useState(false);
  const [error, setError] = useState<string>();
  const view = useQuery({ queryKey: ['signing', 'view', dossierId], queryFn: () => readDossierView(dossierId) });
  useEffect(() => {
    const dialog = dialogReference.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }, []);
  const data = view.data;
  const run = (task: Promise<void>) => {
    setError(undefined);
    task.catch((reason: unknown) => setError(messageOf(reason)));
  };
  return (
    <dialog
      ref={dialogReference}
      aria-label="Xem hồ sơ kí"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className={`m-auto w-full rounded-xl border border-border bg-card p-6 text-text shadow-lg backdrop:bg-text/40 ${
        wide ? 'max-w-[96vw]' : 'max-w-5xl'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-section-title font-semibold">
          Xem hồ sơ kí{data ? `: ${data.document.title} – ${data.dossier.object_label}` : ''}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="text" onClick={() => setWide(!wide)}>
            {wide ? 'Thu nhỏ' : 'Phóng to'}
          </Button>
          {data ? (
            <>
              <Button
                variant="secondary"
                onClick={() =>
                  run(downloadDossierFile(data.dossier, data.dossier.signed_file_name ? 'signed' : 'original'))
                }
              >
                Tải xuống
              </Button>
              {data.dossier.xml_file_name ? (
                <Button variant="secondary" onClick={() => run(downloadDossierFile(data.dossier, 'xml'))}>
                  Tải tệp XML
                </Button>
              ) : null}
              <Button variant="secondary" onClick={() => run(openDossierFile(data.dossier))}>
                In
              </Button>
            </>
          ) : null}
          <Button onClick={onClose}>Đóng</Button>
        </div>
      </div>
      {view.isError ? (
        <div className="mt-4">
          <Alert tone="danger">{messageOf(view.error)}</Alert>
        </div>
      ) : null}
      {error ? (
        <div className="mt-4">
          <Alert tone="danger">{error}</Alert>
        </div>
      ) : null}
      {!data && !view.isError ? <div className="mt-4 h-40 animate-pulse rounded bg-border" aria-hidden="true" /> : null}
      {data ? (
        <div className="mt-4 grid max-h-[70vh] grid-cols-1 gap-4 overflow-y-auto md:grid-cols-[18rem_1fr]">
          <SignaturePanel view={data} />
          <article aria-label="Nội dung hồ sơ" className="flex flex-col gap-4">
            <p className="text-label text-text-secondary">
              Loại hồ sơ {data.root}
              {data.xml_schema
                ? ` – tệp dữ liệu XML theo lược đồ ${data.xml_schema}`
                : ' – hồ sơ lập trước khi có tệp XML'}
            </p>
            {data.document.sections.map((section) => (
              <SectionView key={section.key} section={section} />
            ))}
          </article>
        </div>
      ) : null}
    </dialog>
  );
}
