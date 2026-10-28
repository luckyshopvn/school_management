import { useCallback, useEffect, useState } from 'react';
import {
  ChildSafetyPolicy,
  MarketShell,
  marketRequest,
  MessageInbox,
  type Child,
} from '@school-management/market-client';
import { ParentArea } from './ParentArea.js';
import { ParentBookings } from './ParentBookings.js';
import { SafetyPage } from './SafetyPage.js';
import { TutorSearch } from './TutorSearch.js';

// Chợ gia sư cho phụ huynh (DT-27 phần 27f, YCTD-256; tài liệu 32 mục 19.5): trang công khai, đăng ký, đăng nhập phụ huynh, khu phụ
// huynh (hồ sơ con, đồng ý, liên kết với trường). Gia sư dùng ứng dụng riêng apps/tutor (YCTD-262, quyết định của Eric ngày 2026-10-28).
// Tìm gia sư, trang gia sư theo Mẫu 02 (27g, TutorSearch); đặt buổi, thanh toán giả lập là của 27h; tin nhắn, báo cáo vi phạm, phòng học
// có ghi hình, chính sách an toàn trẻ em là của 27i. Từ YCTD-360 (thiết kế duyệt ngày 2026-10-28) khu phụ huynh chia trang theo thanh
// điều hướng ở đầu trang thay cho một trang dài; trang đang mở ghi ở phần # của địa chỉ để tải lại vẫn đúng trang
const PAGES = [
  { key: 'tim-gia-su', label: 'Tìm gia sư' },
  { key: 'buoi-hoc', label: 'Buổi học của con' },
  { key: 'tin-nhan', label: 'Tin nhắn' },
  { key: 'ho-so-con', label: 'Hồ sơ con' },
  { key: 'an-toan', label: 'An toàn' },
] as const;
type Page = (typeof PAGES)[number]['key'];

function pageFromHash(): Page | null {
  const key = window.location.hash.replace(/^#/, '');
  return PAGES.find((row) => row.key === key)?.key ?? null;
}

// Mở khu phụ huynh: chưa có hồ sơ con thì vào thẳng trang Hồ sơ con để thêm con trước khi tìm gia sư
function ParentHome({ page, onPage }: { page: Page | null; onPage: (next: Page) => void }) {
  useEffect(() => {
    if (page) return;
    marketRequest<{ children: Child[] }>('GET', '/children')
      .then((view) => onPage(view.children.length === 0 ? 'ho-so-con' : 'tim-gia-su'))
      .catch(() => onPage('tim-gia-su'));
  }, [page, onPage]);
  if (page === 'tim-gia-su') return <TutorSearch onBooked={() => onPage('buoi-hoc')} />;
  if (page === 'buoi-hoc') return <ParentBookings />;
  if (page === 'tin-nhan') return <MessageInbox role="parent" />;
  if (page === 'ho-so-con') return <ParentArea />;
  if (page === 'an-toan') return <SafetyPage />;
  return null;
}

export function MarketApplication() {
  const [page, setPage] = useState<Page | null>(pageFromHash);
  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const open = useCallback((next: Page) => {
    setPage(next);
    window.history.replaceState(null, '', `#${next}`);
  }, []);
  return (
    <MarketShell
      kind="parent"
      title="Chợ gia sư"
      navigation={
        <nav aria-label="Điều hướng chợ" className="flex flex-wrap gap-1">
          {PAGES.map((row) => (
            <button
              key={row.key}
              type="button"
              aria-current={page === row.key ? 'page' : undefined}
              className={`min-h-11 rounded-lg px-3 font-medium ${
                page === row.key ? 'bg-selected text-brand-strong' : 'text-text hover:bg-page'
              }`}
              onClick={() => open(row.key)}
            >
              {row.label}
            </button>
          ))}
        </nav>
      }
      intro={(site) => (
        <section aria-label="Giới thiệu" className="flex flex-col gap-5">
          {site?.tutor_url ? (
            <p className="text-label text-text-secondary">
              Bạn là gia sư? <a href={site.tutor_url}>Mở ứng dụng Gia sư</a>
            </p>
          ) : null}
          <TutorSearch />
          <ChildSafetyPolicy />
        </section>
      )}
    >
      <ParentHome page={page} onPage={open} />
    </MarketShell>
  );
}
