import type { ReactNode } from 'react';

// Thanh thao tác hàng loạt (TD-28, YCTD-384): điện thoại là thanh dính đáy màn hình, chừa vùng an toàn (GT-03); từ 768 điểm ảnh là dải
// "Đã chọn N …" trên lưới. Hiện số đã chọn, nút Bỏ chọn và các thao tác do màn hình truyền vào; không hiện khi chưa chọn dòng nào
export function SelectionBar({
  count,
  noun,
  onClear,
  children,
}: {
  count: number;
  noun: string;
  onClear(): void;
  children: ReactNode;
}) {
  if (count === 0) {
    return null;
  }
  return (
    <div
      role="toolbar"
      aria-label={`Thao tác với ${count} ${noun} đã chọn`}
      className="fixed inset-x-0 bottom-0 z-30 flex flex-wrap items-center gap-2 bg-pc-nhan-dam px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] text-pc-co-noi-dung text-pc-chu-tren-nhan md:static md:rounded-pc-nho md:bg-pc-thong-tin-nen md:py-1.5 md:pl-4 md:text-pc-thong-tin"
    >
      <button
        type="button"
        onClick={onClear}
        aria-label="Bỏ chọn"
        className="grid size-pc-cham place-items-center rounded-pc-nho text-xl focus-visible:outline-3 focus-visible:outline-current md:hidden"
      >
        <span aria-hidden="true">×</span>
      </button>
      <span aria-live="polite" className="mr-auto font-semibold">
        Đã chọn {count} {noun}
      </span>
      {children}
      <button
        type="button"
        onClick={onClear}
        className="hidden min-h-pc-cham rounded-pc-nho px-2 font-semibold focus-visible:outline-3 focus-visible:outline-current md:inline-block"
      >
        Bỏ chọn
      </button>
    </div>
  );
}
