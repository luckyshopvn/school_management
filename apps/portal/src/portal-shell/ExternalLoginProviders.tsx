// Điểm mở rộng cho nút đăng nhập bằng nhà cung cấp định danh ngoài (DT-24 để chỗ, DT-25 điền: OIDC, sẵn cho VNeID). Trang đăng
// nhập luôn dựng thành phần này dưới nút Đăng nhập; chưa có nhà cung cấp thì không hiện gì.
// - `mode`: `directory` ở tên miền chung (cần đơn vị đã chọn, `unitCode`), `school` ở tên miền của trường, `single` ở chế độ một
//   trường;
// - `unitCode`: mã Bộ của đơn vị đã chọn và đang dùng nền tảng (chỉ ở `directory`), trống là chưa chọn.
export interface ExternalLoginProvidersProperties {
  mode: 'single' | 'school' | 'directory';
  unitCode: string | null;
}

export function ExternalLoginProviders(properties: ExternalLoginProvidersProperties) {
  void properties;
  return null;
}
