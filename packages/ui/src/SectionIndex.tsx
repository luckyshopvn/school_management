// Mục lục biểu mẫu dài (TD-31, YCTD-384): từ 1280 điểm ảnh là cột trái dính khi cuộn; dưới 1280 là hàng nút cuộn ngang dính trên cùng.
// Phần có lỗi kiểm tra dữ liệu gắn nhãn số lỗi để người dùng tới thẳng chỗ cần sửa
export interface FormSection {
  id: string;
  label: string;
  errorCount?: number;
}

export function SectionIndex({
  sections,
  current,
  onSelect,
  label = 'Các phần của biểu mẫu',
}: {
  sections: FormSection[];
  current: string;
  onSelect(id: string): void;
  label?: string;
}) {
  return (
    <nav
      aria-label={label}
      className="sticky top-14 z-10 flex gap-2 overflow-x-auto bg-pc-nen-trang py-1.5 xl:top-20 xl:flex-col xl:gap-0.5 xl:rounded-pc-lon xl:border xl:border-pc-vien xl:bg-pc-the xl:p-2"
    >
      {sections.map((section) => (
        <button
          key={section.id}
          type="button"
          aria-current={section.id === current ? 'true' : undefined}
          onClick={() => onSelect(section.id)}
          className="flex min-h-pc-cham shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-pc-vien-o-nhap bg-pc-the px-3 text-left text-pc-co-noi-dung text-pc-chu focus-visible:outline-3 focus-visible:outline-pc-nhan aria-[current]:border-pc-nhan aria-[current]:bg-pc-nhan-nhat aria-[current]:font-semibold aria-[current]:text-pc-nhan-dam xl:rounded-pc-nho xl:border-0"
        >
          <span className="xl:flex-1">{section.label}</span>
          {section.errorCount ? (
            <span className="rounded-full bg-pc-nguy-hiem-nen px-2 text-pc-co-nhan font-semibold text-pc-nguy-hiem">
              {section.errorCount} lỗi
            </span>
          ) : null}
        </button>
      ))}
    </nav>
  );
}
