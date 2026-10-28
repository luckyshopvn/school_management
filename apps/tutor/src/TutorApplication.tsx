import { MarketShell } from '@school-management/market-client';
import { UpdateBanner } from '@school-management/pwa';
import { TutorArea } from './TutorArea.js';

// Ứng dụng Gia sư của chợ gia sư (DT-27, YCTD-262; quyết định của Eric ngày 2026-10-28 "làm thêm ứng dụng cho gia sư"): đăng ký, đăng
// nhập gia sư, hồ sơ và cơ sở dạy thêm (27f). Các phần sau thêm vào ứng dụng này: xác minh danh tính, lý lịch, trang công khai (27g);
// lịch dạy, buổi, thu nhập (27h); báo cáo an toàn (27i). Phụ huynh dùng ứng dụng Chợ gia sư (apps/market)
export function TutorApplication() {
  return (
    <>
      <UpdateBanner />
      <MarketShell
        kind="tutor"
        title="Gia sư"
        intro={(site) => (
          <section aria-label="Giới thiệu" className="flex flex-col gap-2">
            <p>
              Mở hồ sơ gia sư trực tuyến. Gia sư được xác minh danh tính và lý lịch trước khi nhận học sinh; mọi tin
              nhắn với học sinh luôn có phụ huynh.
            </p>
            {site?.market_url ? (
              <p>
                Bạn là phụ huynh? <a href={site.market_url}>Mở Chợ gia sư</a>
              </p>
            ) : null}
          </section>
        )}
      >
        <TutorArea />
      </MarketShell>
    </>
  );
}
