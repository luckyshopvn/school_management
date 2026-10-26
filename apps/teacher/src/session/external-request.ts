import type { ExternalRequest } from '@school-management/ui';
import { requestJson } from './api-client.js';

// Gọi giao diện lập trình cho đăng nhập, liên kết bằng nhà cung cấp định danh bên ngoài (DT-25 bước 25b): kèm mã phiên nếu đang đăng
// nhập, gặp mã hết hạn thì làm mới một lần
export const externalRequest: ExternalRequest = <T>(path: string, init: { method?: string; body?: unknown } = {}) =>
  requestJson<T>(path, {
    method: init.method ?? 'GET',
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
