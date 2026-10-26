import { ExternalProviderButtons } from '@school-management/ui';
import { portalExternalRequest } from './external-identity.js';

// Điểm mở rộng cho nút đăng nhập bằng nhà cung cấp định danh ngoài (DT-24 để chỗ, DT-25 bước 25b điền: OIDC, sẵn cho VNeID). Trang đăng
// nhập luôn dựng thành phần này dưới nút Đăng nhập; chưa có nhà cung cấp thì không hiện gì.
// - `mode`: `directory` ở tên miền chung (cần đơn vị đã chọn, `unitCode`), `school` ở tên miền của trường, `single` ở chế độ một
//   trường;
// - `unitCode`: mã Bộ của đơn vị đã chọn và đang dùng nền tảng (chỉ ở `directory`), trống là chưa chọn.
// Ở tên miền chung không hiện nút: cấu hình bật tắt, liên kết và lượt đăng nhập đều theo trường nên luồng phải chạy ở tên miền của
// trường (người dùng mở trang đăng nhập riêng của trường)
export interface ExternalLoginProvidersProperties {
  mode: 'single' | 'school' | 'directory';
  unitCode: string | null;
}

export function ExternalLoginProviders({ mode }: ExternalLoginProvidersProperties) {
  if (mode === 'directory') {
    return null;
  }
  return (
    <ExternalProviderButtons request={portalExternalRequest} channel="portal" basePath={import.meta.env.BASE_URL} />
  );
}
