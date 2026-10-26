import { ExternalSignInCallback, type ExternalRequest } from '@school-management/ui';
import { requestJson } from '../session/api-client.js';
import { useSession } from '../session/session.js';

// Nối các thành phần đăng nhập, liên kết bằng nhà cung cấp định danh bên ngoài (DT-25 bước 25b) với giao diện lập trình của cổng quản
// trị: gửi kèm mã phiên nếu đang đăng nhập, gặp mã hết hạn thì làm mới một lần
export const portalExternalRequest: ExternalRequest = <T,>(
  path: string,
  init: { method?: string; body?: unknown } = {},
) =>
  requestJson<T>(path, {
    method: init.method ?? 'GET',
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });

// Trang /dang-nhap/ben-ngoai: mở được cả khi đã hay chưa đăng nhập (lượt liên kết quay về khi đang đăng nhập)
export function ExternalSignInCallbackPage() {
  const session = useSession();
  return (
    <ExternalSignInCallback
      request={portalExternalRequest}
      basePath={import.meta.env.BASE_URL}
      ready={session.status !== 'checking'}
      afterLink={`${import.meta.env.BASE_URL.replace(/\/?$/, '/')}my-profile`}
    />
  );
}
