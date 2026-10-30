// Nhóm nút chọn một (TD-26, YCTD-384): các nút liền nhau cao 44 điểm ảnh, `role="group"`, `aria-pressed`; nút đang chọn tô màu
// trạng thái tương ứng (ví dụ điểm danh Có, Phép, Vắng) hoặc màu nhấn khi không có màu trạng thái
export type ChoiceTone = 'success' | 'warning' | 'danger';

export interface ChoiceOption<Value extends string> {
  value: Value;
  label: string;
  tone?: ChoiceTone;
}

const PRESSED_CLASSES: Record<ChoiceTone | 'accent', string> = {
  success: 'aria-pressed:bg-pc-thanh-cong-nen aria-pressed:text-pc-thanh-cong',
  warning: 'aria-pressed:bg-pc-canh-bao-nen aria-pressed:text-pc-canh-bao',
  danger: 'aria-pressed:bg-pc-nguy-hiem-nen aria-pressed:text-pc-nguy-hiem',
  accent: 'aria-pressed:bg-pc-nhan-nhat aria-pressed:text-pc-nhan-dam',
};

export function ChoiceGroup<Value extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  options: ChoiceOption<Value>[];
  value: Value | undefined;
  onChange(value: Value): void;
  disabled?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex shrink-0 overflow-hidden rounded-pc-nut border border-pc-vien-o-nhap bg-pc-the"
    >
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={`min-h-pc-cham min-w-13 px-2.5 text-pc-co-nhan font-semibold text-pc-chu focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-pc-nhan disabled:cursor-not-allowed disabled:opacity-60 ${
            index > 0 ? 'border-l border-pc-vien-o-nhap' : ''
          } ${PRESSED_CLASSES[option.tone ?? 'accent']}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
