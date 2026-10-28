import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

// Ô chọn có tìm kiếm (DT-24, đăng nhập theo đơn vị): gõ để lọc, danh sách lấy theo trang từ máy chủ (không tải cả danh mục), phím
// mũi tên và Enter để chọn, Esc để đóng. Theo mẫu combobox của WAI-ARIA: ô nhập có vai trò combobox, danh sách là listbox
export interface SearchSelectOption {
  code: string;
  label: string;
  hint?: string | null;
}

export interface SearchSelectProperties {
  label: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  value: SearchSelectOption | null;
  onChange: (value: SearchSelectOption | null) => void;
  // Lấy một trang lựa chọn theo chữ đang gõ; máy chủ giới hạn số dòng mỗi trang
  load: (query: string, offset: number) => Promise<{ items: SearchSelectOption[]; has_more: boolean }>;
  // Đổi khóa (ví dụ đổi Sở) thì nạp lại danh sách
  reloadKey?: string;
  error?: string;
}

export function SearchSelect({
  label,
  required,
  disabled,
  placeholder,
  value,
  onChange,
  load,
  reloadKey = '',
  error,
}: SearchSelectProperties) {
  const inputId = useId();
  const listId = `${inputId}-list`;
  const [text, setText] = useState(value?.label ?? '');
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<SearchSelectOption[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const latest = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    setText(value?.label ?? '');
  }, [value]);

  const query = open && text !== (value?.label ?? '') ? text : '';

  function fetchPage(offset: number) {
    const request = ++latest.current;
    setLoading(true);
    setLoadError(false);
    loadRef
      .current(query.trim(), offset)
      .then((page) => {
        if (request !== latest.current) {
          return;
        }
        setOptions((current) => (offset === 0 ? page.items : [...current, ...page.items]));
        setHasMore(page.has_more);
        if (offset === 0) {
          setActive(0);
        }
      })
      .catch(() => {
        if (request === latest.current) {
          setLoadError(true);
        }
      })
      .finally(() => {
        if (request === latest.current) {
          setLoading(false);
        }
      });
  }

  // Gõ xong 250 ms mới gọi máy chủ
  useEffect(() => {
    if (!open || disabled) {
      return;
    }
    const timer = setTimeout(() => fetchPage(0), 250);
    return () => clearTimeout(timer);
  }, [open, query, reloadKey, disabled]);

  function choose(option: SearchSelectOption) {
    onChange(option);
    setText(option.label);
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(index + 1, Math.max(options.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      const option = options[active];
      if (option) {
        choose(option);
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
      setText(value?.label ?? '');
    }
  }

  const errorId = `${inputId}-error`;
  return (
    <div className="relative flex flex-col gap-2">
      <label htmlFor={inputId} className="text-label font-medium text-text">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </label>
      <div className="relative">
        <input
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-required={required ? true : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setOpen(true);
            if (value && event.target.value !== value.label) {
              onChange(null);
            }
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Chờ lượt bấm vào một dòng của danh sách xong mới đóng
            setTimeout(() => {
              setOpen(false);
              setText((current) => (value && current !== value.label ? value.label : current));
            }, 150);
          }}
          onKeyDown={onKeyDown}
          className={`w-full rounded-lg border bg-page py-2 pl-3 pr-9 text-content text-text outline-none placeholder:text-text-secondary focus:border-border-strong focus:bg-card focus:ring-2 focus:ring-selected disabled:cursor-not-allowed disabled:opacity-70 ${error ? 'border-danger' : 'border-border'}`}
        />
        {/* Mũi tên như ô chọn của mẫu trang đăng nhập (YCTD-310); bấm vào ô nhập mở danh sách */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary"
        >
          <path d="M2 4h8L6 9z" fill="currentColor" />
        </svg>
      </div>
      {open && !disabled ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-md"
        >
          {options.map((option, index) => (
            <li
              key={option.code}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={value?.code === option.code}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(option);
              }}
              onMouseEnter={() => setActive(index)}
              className={`cursor-pointer px-3 py-1.5 text-content ${index === active ? 'bg-selected' : ''}`}
            >
              <span className="text-text">{option.label}</span>
              {option.hint ? <span className="block text-label text-text-secondary">{option.hint}</span> : null}
            </li>
          ))}
          {loading ? <li className="px-3 py-1.5 text-label text-text-secondary">Đang tải...</li> : null}
          {!loading && loadError ? (
            <li className="px-3 py-1.5 text-label text-danger">Không tải được danh sách, gõ lại để thử lại</li>
          ) : null}
          {!loading && !loadError && options.length === 0 ? (
            <li className="px-3 py-1.5 text-label text-text-secondary">Không có kết quả</li>
          ) : null}
          {!loading && hasMore ? (
            <li>
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  fetchPage(options.length);
                }}
                className="w-full px-3 py-1.5 text-left text-label font-medium text-link hover:underline"
              >
                Xem thêm
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
      {error ? (
        <p id={errorId} className="text-label text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
