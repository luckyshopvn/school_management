import { useEffect, useState } from 'react';
import { Alert, ApplicationHeader, Button } from '@school-management/ui';
import { fetchCurrentUser, type CurrentUser } from '../session/api-client.js';
import { useSession } from '../session/session.js';

// Trang chủ tạm của ứng dụng phụ huynh; các màn hình MP-xx làm ở các đợt sau
export function HomeScreen() {
  const session = useSession();
  const [user, setUser] = useState<CurrentUser>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchCurrentUser()
      .then(setUser)
      .catch(() => setFailed(true));
  }, []);

  return (
    <div className="min-h-screen">
      <ApplicationHeader title="Ứng dụng phụ huynh" />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
        {failed ? <Alert tone="danger">Không tải được thông tin tài khoản, vui lòng thử lại</Alert> : null}
        {user ? (
          <h1 className="text-page-title font-bold text-text">Xin chào, {user.full_name}</h1>
        ) : (
          <div className="h-8 w-48 animate-pulse rounded bg-border" aria-hidden="true" />
        )}
        <p className="text-content text-text-secondary">Thông tin của con sẽ hiển thị ở đây.</p>
        <div>
          <Button onClick={() => void session.logout()}>Đăng xuất</Button>
        </div>
      </main>
    </div>
  );
}
