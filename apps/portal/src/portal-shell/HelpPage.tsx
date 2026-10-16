import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AppShell } from '../pages/AppShell.js';
import { readLoginOptions } from './portal-shell-api.js';

// Hướng dẫn ở menu người dùng (DT-16 phần 16c): hướng dẫn ngắn cách dùng khung trang chung của cổng quản trị. Hướng dẫn
// nghiệp vụ của từng màn hình nằm ở tài liệu của trường
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <h2 className="text-section-title font-semibold text-text">{title}</h2>
      <div className="flex flex-col gap-2 text-content text-text">{children}</div>
    </section>
  );
}

export function HelpPage() {
  const options = useQuery({ queryKey: ['login-options'], queryFn: readLoginOptions, retry: false });
  return (
    <AppShell>
      <div className="flex max-w-4xl flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">Hướng dẫn</h1>
        <Section title="1. Đăng nhập">
          <p>
            Đăng nhập bằng số điện thoại hoặc tên đăng nhập và mật khẩu. Tích "Ghi nhớ tài khoản" để lần sau trình duyệt
            điền sẵn tên đăng nhập; mật khẩu không bao giờ được ghi nhớ.
          </p>
          <p>
            Nhập sai mật khẩu nhiều lần thì phải nhập thêm mã xác nhận trong ảnh; bấm "Làm mới mã" nếu ảnh khó đọc. Sai 5 lần
            liên tiếp thì tài khoản tạm khóa 15 phút.
          </p>
          <p>
            Quên mật khẩu: bấm "Quên mật khẩu?" ở trang đăng nhập, nhập số điện thoại hoặc tên đăng nhập, nhận mã qua tin
            nhắn rồi đặt mật khẩu mới. Mật khẩu mới phải có ít nhất 8 ký tự, có cả chữ và số, khác các mật khẩu dùng gần
            đây.
          </p>
        </Section>
        <Section title="2. Thanh đầu trang">
          <p>
            Bên trái là tên trường và ô chọn phân hệ (Quản lý giáo dục Mầm non, Cơ sở vật chất, Báo cáo số liệu, Quản trị hệ
            thống…). Mỗi phân hệ có menu ngang đánh số riêng ngay dưới thanh đầu trang.
          </p>
          <p>
            Bên phải là ô ngữ cảnh "Cấp MN · năm học · học kỳ", chuông thông báo, lưới ứng dụng liên kết và menu người dùng.
            Menu người dùng có Thông báo, Hồ sơ nhân sự cá nhân, Đổi mật khẩu, Cấu hình hiển thị lưới, Danh sách ý kiến đã
            gửi, Hướng dẫn và Thoát.
          </p>
          <p>
            Khi vào trang, hộp "Thông báo" hiện các thông báo của nhà trường, nhắc mật khẩu sắp hết hạn và nhắc cập nhật mã
            định danh điện tử của tổ chức theo Nghị định 69 (người quản lý hồ sơ trường).
          </p>
        </Section>
        <Section title="3. Màn hình danh sách">
          <p>
            Lưới dữ liệu có ô tìm kiếm, "Mở rộng tìm kiếm", chọn cột hiển thị, số dòng mỗi trang và phân trang. Cấu hình của
            từng lưới được lưu theo tài khoản; số dòng mặc định đặt ở "Cấu hình hiển thị lưới" trong menu người dùng.
          </p>
          <p>Xóa dữ liệu cần tích "Tôi đã đọc và đồng ý xóa" trong hộp xác nhận.</p>
        </Section>
        <Section title="4. Hỗ trợ">
          <p>
            Bấm "Gửi phản hồi" ở chân trang để góp ý hoặc báo lỗi kèm ảnh chụp màn hình; xem lại ở "Danh sách ý kiến đã
            gửi".
          </p>
          {options.data?.hotline ? (
            <p>
              Đường dây nóng hỗ trợ: <span className="font-semibold">{options.data.hotline}</span>
            </p>
          ) : null}
        </Section>
      </div>
    </AppShell>
  );
}
