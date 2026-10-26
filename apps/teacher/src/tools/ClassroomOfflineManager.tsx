import { useEffect } from 'react';
import { useSession } from '../session/session.js';
import { refreshPolicy } from './classroom-policy.js';
import { flushQueue } from './classroom-store.js';

// Chạy ngầm khi đã đăng nhập (DT-23 phần 23b, YCTD-212): áp cấu hình ngoại tuyến của trường (đăng ký hoặc gỡ service worker)
// và gửi hàng đợi điểm, lượt gọi lúc mất mạng mỗi khi có mạng lại. Không vẽ gì
export function ClassroomOfflineManager() {
  const session = useSession();
  const signedIn = session.status === 'signed-in';

  useEffect(() => {
    if (!signedIn) {
      return;
    }
    const sync = () => {
      void flushQueue();
    };
    refreshPolicy()
      .catch(() => undefined)
      .finally(sync);
    window.addEventListener('online', sync);
    return () => window.removeEventListener('online', sync);
  }, [signedIn]);

  return null;
}
