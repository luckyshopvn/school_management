// Phần thương hiệu bên trái trang đăng nhập (mẫu thiết kế Login.dc.html): nền xanh của thanh đầu trang, biểu trưng, tên Sở, tên trường
// màu vàng nhấn, câu giới thiệu và ba ứng dụng dùng chung một tài khoản. Tên trường, biểu trưng lấy từ dữ liệu trang đăng nhập đang có
// (cấu hình thương hiệu, thông tin trường, trang của tên miền chung), không viết cứng.
// Trên điện thoại phần này xếp lên trên khung đăng nhập, rút gọn khoảng đệm và ẩn câu mô tả dài để khung đăng nhập lên gần đầu.
const APPS = ['Cổng quản trị', 'Ứng dụng giáo viên', 'Ứng dụng phụ huynh'];

export interface LoginHeroProperties {
  // Tên hiển thị chính (giữ mã kiểm thử `login-title`)
  title: string;
  // Dòng nhỏ phía trên tên: Sở GD&ĐT của trường khi có
  parentUnit: string | null;
  logoUrl: string | null;
}

export function LoginHero({ title, parentUnit, logoUrl }: LoginHeroProperties) {
  return (
    <section className="flex flex-col justify-between gap-6 bg-header px-4 py-6 text-white md:min-h-screen md:flex-1 md:gap-10 md:px-12 md:py-14">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-card text-brand">
          {logoUrl ? (
            <img src={logoUrl} alt="Biểu trưng" className="h-10 w-10 rounded object-contain" />
          ) : (
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M22 10 12 5 2 10l10 5 10-5Z" />
              <path d="M6 12v5c3 2 9 2 12 0v-5" />
            </svg>
          )}
        </div>
        <div className="flex min-w-0 flex-col">
          {parentUnit ? <span className="text-label text-selected">{parentUnit}</span> : null}
          <p
            className="text-section-title font-bold uppercase tracking-wide text-header-accent"
            data-testid="login-title"
          >
            {title}
          </p>
        </div>
      </div>
      <div className="flex max-w-md flex-col gap-4">
        <p className="text-page-title font-bold leading-tight md:text-4xl">Một nơi cho mọi việc của nhà trường</p>
        <p className="hidden text-base leading-relaxed text-selected md:block">
          Hồ sơ học sinh, sổ điểm, điểm danh, khoản thu và văn bản, dùng chung một tài khoản cho ban giám hiệu, giáo
          viên và phụ huynh.
        </p>
      </div>
      <ul className="flex flex-wrap gap-2" aria-label="Ứng dụng dùng chung tài khoản">
        {APPS.map((app) => (
          <li key={app} className="rounded-2xl border border-white/30 px-3 py-1.5 text-label">
            {app}
          </li>
        ))}
      </ul>
    </section>
  );
}
