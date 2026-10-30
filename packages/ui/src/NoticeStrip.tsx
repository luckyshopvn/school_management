import type { ReactNode } from 'react';

// Dải thông báo một dòng (TD-24, YCTD-384): thay khối thông báo cao ở đầu trang; nội dung cắt một dòng, nút Xem mở đủ nội dung,
// nút Ẩn. Nội dung đầy đủ vẫn nằm trong thuộc tính title để đọc khi cắt
export function NoticeStrip({
  title,
  children,
  fullText,
  onOpen,
  openLabel = 'Xem',
  onDismiss,
  regionLabel = 'Thông báo của hệ thống',
}: {
  title?: string;
  children: ReactNode;
  fullText?: string;
  onOpen?(): void;
  openLabel?: string;
  onDismiss?(): void;
  regionLabel?: string;
}) {
  return (
    <div
      role="region"
      aria-label={regionLabel}
      className="flex min-h-12 items-center gap-2 rounded-pc-nho bg-pc-thong-tin-nen pl-4 pr-1 text-pc-co-noi-dung text-pc-thong-tin"
    >
      <p className="m-0 min-w-0 flex-1 truncate" title={fullText}>
        {title ? <strong>{title}: </strong> : null}
        {children}
      </p>
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="min-h-pc-cham rounded-pc-nho px-2 font-semibold focus-visible:outline-3 focus-visible:outline-pc-nhan"
        >
          {openLabel}
        </button>
      ) : null}
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Ẩn thông báo"
          className="grid size-pc-cham place-items-center rounded-pc-nho text-xl focus-visible:outline-3 focus-visible:outline-pc-nhan"
        >
          <span aria-hidden="true">×</span>
        </button>
      ) : null}
    </div>
  );
}
