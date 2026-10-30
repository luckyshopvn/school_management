import { useEffect, useRef, type ReactNode } from 'react';

// Ngăn dưới (TD-27, YCTD-384): điện thoại mở từ đáy màn hình, có tay cầm, lớp phủ, chừa vùng an toàn (GT-03); từ 768 điểm ảnh hiện
// như hộp thoại giữa màn hình. Dùng thẻ <dialog> mở dạng phủ: Esc, nút Đóng, bấm ra lớp phủ đều đóng (nút quay lại của Android qua
// vỏ ứng dụng gọi Esc, GT-04); trình duyệt trả tiêu điểm về nút đã mở
export function BottomSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose(): void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) {
      return;
    }
    if (open && !element.open) {
      element.showModal();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-label={title}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) {
          onClose();
        }
      }}
      className="mb-0 mt-auto w-full max-w-none rounded-t-[1.25rem] bg-pc-the p-0 text-pc-chu shadow-2xl backdrop:bg-black/45 md:m-auto md:max-w-lg md:rounded-pc-lon"
    >
      <div className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-2">
        <div aria-hidden="true" className="mx-auto mb-3 h-1 w-10 rounded-full bg-pc-vien-o-nhap md:hidden" />
        <div className="mb-2 flex items-center gap-2">
          <h2 className="m-0 flex-1 text-pc-co-tieu-de-vung font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="grid size-pc-cham place-items-center rounded-pc-nho text-xl focus-visible:outline-3 focus-visible:outline-pc-nhan"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
