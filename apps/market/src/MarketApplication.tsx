import { ChildSafetyPolicy, MarketShell, MessageInbox } from '@school-management/market-client';
import { ParentArea } from './ParentArea.js';
import { ParentBookings } from './ParentBookings.js';
import { TutorSearch } from './TutorSearch.js';

// Chợ gia sư cho phụ huynh (DT-27 phần 27f, YCTD-256; tài liệu 32 mục 19.5): trang công khai, đăng ký, đăng nhập phụ huynh, khu phụ
// huynh (hồ sơ con, đồng ý, liên kết với trường). Gia sư dùng ứng dụng riêng apps/tutor (YCTD-262, quyết định của Eric ngày 2026-10-28).
// Tìm gia sư, trang gia sư theo Mẫu 02 (27g, TutorSearch); đặt buổi, thanh toán giả lập là của 27h; tin nhắn, báo cáo vi phạm, phòng học
// có ghi hình, chính sách an toàn trẻ em là của 27i
export function MarketApplication() {
  return (
    <MarketShell
      kind="parent"
      title="Chợ gia sư"
      intro={(site) => (
        <section aria-label="Giới thiệu" className="flex flex-col gap-2">
          <p>
            Phụ huynh tìm gia sư trực tuyến cho con; gia sư được xác minh trước khi nhận học sinh. Mọi tin nhắn giữa gia
            sư và học sinh luôn có phụ huynh.
          </p>
          {site?.tutor_url ? (
            <p>
              Bạn là gia sư? <a href={site.tutor_url}>Mở ứng dụng Gia sư</a>
            </p>
          ) : null}
          <TutorSearch />
          <ChildSafetyPolicy />
        </section>
      )}
    >
      <TutorSearch />
      <ParentBookings />
      <MessageInbox role="parent" />
      <ParentArea />
      <ChildSafetyPolicy />
    </MarketShell>
  );
}
