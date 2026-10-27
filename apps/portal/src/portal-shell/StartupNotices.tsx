import { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button, DIALOG_NARROW_FULL_SCREEN_CLASS } from '@school-management/ui';
import { useSession } from '../session/session.js';
import { markStartupNoticesShown, startupNoticesShown } from '../pages/startup-notices-state.js';
import { listActiveAnnouncements, readPortalContext } from './portal-shell-api.js';
import { formatDate } from './SystemAnnouncementsPage.js';

// Hộp thông báo bật lên khi vào cổng quản trị theo Sở (DT-16 phần 16c): thông báo hệ thống đang hiệu lực, mật khẩu sắp
// hết hạn (nối với hạn mật khẩu của phần 15g, YCTD-110) và nhắc cập nhật mã định danh điện tử của tổ chức theo NĐ 69
// cho người cập nhật được hồ sơ trường. Hiện một lần mỗi lần đăng nhập; không có gì để báo thì không hiện
export function StartupNotices() {
  const session = useSession();
  const [pending] = useState(() => !startupNoticesShown());
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const announcements = useQuery({
    queryKey: ['active-announcements'],
    queryFn: listActiveAnnouncements,
    enabled: pending,
  });
  const context = useQuery({ queryKey: ['portal-context'], queryFn: readPortalContext });
  const passwordDays = session.passwordExpiresInDays;
  const reminder = context.data?.organization_id_reminder ?? false;
  const items = announcements.data ?? [];
  const ready = pending && !announcements.isPending && !context.isPending;
  const hasNotices = items.length > 0 || passwordDays !== null || reminder;

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

  useEffect(() => {
    const element = dialog.current;
    if (open && element && !element.open) {
      element.showModal();
    }
  }, [open]);

  const close = () => {
    markStartupNoticesShown();
    dialog.current?.close();
    setOpen(false);
  };

  if (!open) {
    return null;
  }
  return (
    <dialog
      ref={dialog}
      aria-labelledby="thong-bao-khi-vao-trang"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      className={`m-auto w-full max-w-xl rounded-xl border border-border bg-card p-6 text-text shadow-lg backdrop:bg-text/40 ${DIALOG_NARROW_FULL_SCREEN_CLASS}`}
    >
      <h2 id="thong-bao-khi-vao-trang" className="text-section-title font-semibold">
        Thông báo
      </h2>
      <div className="mt-3 flex max-h-[60vh] flex-col gap-4 overflow-y-auto text-content">
        {items.map((item) => (
          <section key={item.id} className="flex flex-col gap-1" aria-label={item.title}>
            <h3 className="font-semibold">{item.title}</h3>
            <p className="whitespace-pre-wrap text-text">{item.content}</p>
            <p className="text-label text-text-secondary">
              Hiệu lực từ {formatDate(item.valid_from)}
              {item.valid_until ? ` đến ${formatDate(item.valid_until)}` : ''}
            </p>
          </section>
        ))}
        {passwordDays !== null ? (
          <section className="flex flex-col gap-1 rounded-lg border border-warning p-3" aria-label="Hết hạn mật khẩu">
            <h3 className="font-semibold">Mật khẩu sắp hết hạn</h3>
            <p>
              Mật khẩu sẽ hết hạn sau {passwordDays} ngày.{' '}
              <Link to="/change-password" className="font-medium text-link underline" onClick={close}>
                Đổi mật khẩu
              </Link>
            </p>
          </section>
        ) : null}
        {reminder ? (
          <section
            className="flex flex-col gap-1 rounded-lg border border-warning p-3"
            aria-label="Mã định danh tổ chức"
          >
            <h3 className="font-semibold">Cập nhật mã định danh điện tử của tổ chức</h3>
            <p>
              Theo Nghị định 69/2024/NĐ-CP, trường cần cập nhật mã định danh điện tử của tổ chức (12 chữ số) vào hồ sơ
              trường.{' '}
              <Link to="/school-profile" className="font-medium text-link underline" onClick={close}>
                Cập nhật hồ sơ trường
              </Link>
            </p>
          </section>
        ) : null}
      </div>
      <div className="mt-6 flex justify-end">
        <Button variant="primary" onClick={close}>
          Đóng
        </Button>
      </div>
    </dialog>
  );
}
