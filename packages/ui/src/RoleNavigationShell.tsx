import type { MouseEvent, ReactNode } from 'react';

// Khung theo vai, phần máy tính (TD-21, KC-09; YCTD-395): từ 1024 px có thanh bên trắng 240 px và thanh đầu trắng; dưới 1024 px
// chỉ vẽ nội dung nên giao diện điện thoại, máy tính bảng dọc giữ như trước. Thanh tiêu đề `ApplicationHeader` của từng màn ẩn từ
// 1024 px vì thanh đầu của khung đã có tên màn. Mục là liên kết, nhóm chỉ có nhãn chữ (không dùng tiêu đề, danh sách) để không
// trùng vai trò với nút, tiêu đề của màn hình bên trong
export interface RoleNavigationItem {
  key: string;
  label: string;
  icon?: ReactNode;
  // Số việc chờ, hiện nhãn đỏ cạnh mục
  count?: number;
  countLabel?: string;
  current?: boolean;
  // Mục đang chọn làm ngữ cảnh (ví dụ lớp đang chọn), khác trang đang mở
  selected?: boolean;
  onSelect(): void;
}

export interface RoleNavigationGroup {
  key: string;
  label?: string;
  // Thụt vào, có vạch trái: các mục thuộc mục ngay trên (ví dụ chức năng của lớp đang chọn)
  nested?: boolean;
  items: RoleNavigationItem[];
}

export interface RoleNavigationShellProperties {
  // Lớp vai của phong cách theo vai: vai-giao-vien, vai-phu-huynh, vai-hoc-sinh
  roleClassName: string;
  applicationName: string;
  applicationIcon?: ReactNode;
  unitName?: string;
  // Tên màn đang mở, hiện ở thanh đầu
  location: string;
  userName?: string;
  groups: RoleNavigationGroup[];
  footer?: RoleNavigationItem[];
  children: ReactNode;
}

function NavigationLink({ item }: { item: RoleNavigationItem }) {
  return (
    <a
      href="#"
      title={item.label}
      aria-current={item.current ? 'page' : item.selected ? 'true' : undefined}
      onClick={(event: MouseEvent) => {
        event.preventDefault();
        item.onSelect();
      }}
      className="flex min-h-11 items-center gap-3 rounded-pc-nho px-3 text-pc-co-noi-dung text-pc-chu hover:bg-pc-nen-trang focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-pc-nhan aria-[current=page]:bg-pc-nhan-nhat aria-[current=page]:font-semibold aria-[current=page]:text-pc-nhan-dam aria-[current=true]:font-semibold aria-[current=true]:text-pc-nhan-dam"
    >
      {item.icon ? (
        <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center">
          {item.icon}
        </span>
      ) : null}
      <span className="min-w-0 truncate">{item.label}</span>
      {item.count ? (
        <span
          aria-label={item.countLabel ?? `${item.count} việc chờ`}
          className="ml-auto grid h-5.5 min-w-5.5 shrink-0 place-items-center rounded-full bg-pc-nguy-hiem px-1.5 text-pc-co-nhan font-bold text-white"
        >
          {item.count}
        </span>
      ) : null}
    </a>
  );
}

export function RoleNavigationShell({
  roleClassName,
  applicationName,
  applicationIcon,
  unitName,
  location,
  userName,
  groups,
  footer = [],
  children,
}: RoleNavigationShellProperties) {
  const initials = (userName ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((word) => word[0])
    .join('')
    .toLocaleUpperCase('vi');
  return (
    <div className={`pc-theo-vai ${roleClassName} lg:grid lg:min-h-screen lg:grid-cols-[15rem_minmax(0,1fr)]`}>
      <nav
        aria-label="Điều hướng chính"
        className="hidden border-r border-pc-vien bg-pc-the px-3 pt-4 pb-3 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:gap-0.5 lg:overflow-y-auto"
      >
        <div className="flex items-center gap-2.5 px-1.5 pb-3.5">
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-pc-nho bg-pc-nhan text-pc-chu-tren-nhan"
          >
            {applicationIcon}
          </span>
          <span className="min-w-0">
            <span className="block text-pc-co-tieu-de-nho font-bold leading-tight text-pc-chu">{applicationName}</span>
            {unitName ? (
              <span className="block truncate text-pc-co-nhan text-pc-chu-phu" title={unitName}>
                {unitName}
              </span>
            ) : null}
          </span>
        </div>
        {groups.map((group) => (
          <div
            key={group.key}
            className={
              group.nested ? 'ml-3 flex flex-col gap-0.5 border-l-2 border-pc-ke pl-2' : 'flex flex-col gap-0.5'
            }
          >
            {group.label ? (
              <p className="mx-3 mt-3.5 mb-1 text-pc-co-nhan font-semibold text-pc-chu-phu">{group.label}</p>
            ) : null}
            {group.items.map((item) => (
              <NavigationLink key={item.key} item={item} />
            ))}
          </div>
        ))}
        {footer.length > 0 ? (
          <div className="mt-auto flex flex-col gap-0.5 border-t border-pc-vien pt-3">
            {footer.map((item) => (
              <NavigationLink key={item.key} item={item} />
            ))}
          </div>
        ) : null}
      </nav>
      <div className="min-w-0 lg:bg-pc-nen-trang lg:[&_[data-application-header]]:hidden">
        <div className="sticky top-0 z-30 hidden h-16 items-center gap-3 border-b border-pc-vien bg-pc-the px-7 lg:flex">
          <p className="min-w-0 flex-1 truncate text-pc-co-noi-dung font-semibold text-pc-chu">{location}</p>
          {userName ? (
            <span className="flex shrink-0 items-center gap-2.5 text-pc-co-noi-dung font-semibold text-pc-chu">
              <span
                aria-hidden="true"
                className="grid size-10 place-items-center rounded-full bg-pc-nhan-nhat text-pc-co-nhan font-bold text-pc-nhan-dam"
              >
                {initials}
              </span>
              {userName}
            </span>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}
