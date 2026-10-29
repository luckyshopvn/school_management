import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@school-management/ui';
import { markStartupNoticesShown, startupNoticesShown } from '../pages/startup-notices-state.js';
import { listActiveAnnouncements, readPortalContext } from './portal-shell-api.js';
import { formatDate } from './SystemAnnouncementsPage.js';

// Hộp thông báo bật lên khi vào cổng quản trị theo Sở (DT-16 phần 16c): thông báo hệ thống đang hiệu lực, mật khẩu sắp
// hết hạn (nối với hạn mật khẩu của phần 15g, YCTD-110) và nhắc cập nhật mã định danh điện tử của tổ chức theo NĐ 69
// cho người cập nhật được hồ sơ trường. Hiện một lần mỗi lần đăng nhập; không có gì để báo thì không hiện
export function StartupNotices() {
  const [pending] = useState(() => !startupNoticesShown());
  const [open, setOpen] = useState(false);
  const announcements = useQuery({
    queryKey: ['active-announcements'],
    queryFn: listActiveAnnouncements,
    enabled: pending,
  });
  const context = useQuery({ queryKey: ['portal-context'], queryFn: readPortalContext });
  const reminder = context.data?.organization_id_reminder ?? false;
  const items = announcements.data ?? [];
  const ready = pending && !announcements.isPending && !context.isPending;
  const hasNotices = items.length > 0 || reminder;

  useEffect(() => {
    if (!ready) {
      return;
    }
    if (hasNotices) {
      setOpen(true);
    } else {
      markStartupNoticesShown();
    }
  }, [ready, hasNotices]);

  const close = () => {
    markStartupNoticesShown();
    setOpen(false);
  };

  if (!open) {
    return null;
  }
  // YCTD-331: dải thông báo ở đầu nội dung thay hộp bật lên che trang; mỗi thông báo một dòng, bấm Đóng thì ẩn tới lần đăng
  // nhập sau. Nhắc mật khẩu sắp hết hạn đã có dải cảnh báo riêng ở đầu trang nên không lặp lại ở đây
  return (
    <section
      aria-labelledby="thong-bao-khi-vao-trang"
      className="mb-4 flex flex-wrap items-start gap-x-4 gap-y-2 rounded-lg bg-selected px-4 py-2.5 text-content text-text"
    >
      <h2 id="thong-bao-khi-vao-trang" className="font-semibold">
        Thông báo
      </h2>
      <ul className="flex min-w-0 flex-[1_1_20rem] flex-col gap-1">
        {items.map((item) => (
          <li key={item.id} aria-label={item.title}>
            <h3 className="inline font-semibold">{item.title}</h3>
            <span className="whitespace-pre-wrap">: {item.content}</span>
            <span className="text-label text-text-secondary">
              {' '}
              (từ {formatDate(item.valid_from)}
              {item.valid_until ? ` đến ${formatDate(item.valid_until)}` : ''})
            </span>
          </li>
        ))}
        {reminder ? (
          <li aria-label="Mã định danh tổ chức">
            <h3 className="inline font-semibold">Cập nhật mã định danh điện tử của tổ chức</h3>
            <span>
              : theo Nghị định 69/2024/NĐ-CP, cần nhập mã 12 chữ số vào hồ sơ trường.{' '}
              <Link to="/school-profile" className="font-medium text-link underline" onClick={close}>
                Cập nhật hồ sơ trường
              </Link>
            </span>
          </li>
        ) : null}
      </ul>
      <Button variant="text" onClick={close}>
        Đóng
      </Button>
    </section>
  );
}
