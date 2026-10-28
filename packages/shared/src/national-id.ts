// Số định danh cá nhân (số CCCD, 12 chữ số) làm tên đăng nhập của tài khoản trường (YCTD-311). Cấu trúc theo Thông tư
// 59/2021/TT-BCA: 3 số đầu là mã tỉnh nơi đăng ký khai sinh, số thứ 4 là thế kỷ sinh và giới tính, số thứ 5 và 6 là hai số cuối
// năm sinh, 6 số cuối ngẫu nhiên. Chỉ chặn khi sai rõ ràng: không đủ 12 chữ số, mã tỉnh không có trong danh mục, hoặc lệch năm
// sinh đã biết. Không kiểm tra với cơ sở dữ liệu quốc gia về dân cư. Dùng chung ở dịch vụ định danh và máy chủ API
export const NATIONAL_ID_PATTERN = /^\d{12}$/;

// Mã tỉnh, thành phố trực thuộc trung ương (63 tỉnh, phụ lục mã của Thông tư 07/2016/TT-BCA). Sau sắp xếp tỉnh năm 2025, số định
// danh đã cấp giữ nguyên mã cũ nên danh mục cũ vẫn là danh mục kiểm tra
const PROVINCE_CODES = new Set(
  (
    '001 002 004 006 008 010 011 012 014 015 017 019 020 022 024 025 026 027 030 031 033 034 035 036 037 038 040 042 044 ' +
    '045 046 048 049 051 052 054 056 058 060 062 064 066 067 068 070 072 074 075 077 079 080 082 083 084 086 087 089 091 ' +
    '092 093 094 095 096'
  ).split(' '),
);

export function isNationalIdShaped(value: string | null | undefined): value is string {
  return typeof value === 'string' && NATIONAL_ID_PATTERN.test(value);
}

// Năm sinh suy từ số thứ 4 (0, 1 là thế kỷ 20; 2, 3 là thế kỷ 21; ...) và số thứ 5, 6
export function nationalIdBirthYear(nationalId: string): number {
  return 1900 + Math.floor(Number(nationalId[3]) / 2) * 100 + Number(nationalId.slice(4, 6));
}

// Lý do số CCCD sai rõ ràng, hoặc null khi chấp nhận
export function nationalIdProblem(value: string, birthYear?: number | null): string | null {
  if (!NATIONAL_ID_PATTERN.test(value)) {
    return 'Số CCCD (số định danh cá nhân) gồm đúng 12 chữ số';
  }
  if (!PROVINCE_CODES.has(value.slice(0, 3))) {
    return `Số CCCD có mã tỉnh ${value.slice(0, 3)} không có trong danh mục, kiểm tra lại 3 số đầu`;
  }
  if (birthYear && nationalIdBirthYear(value) !== birthYear) {
    return 'Số CCCD không khớp năm sinh (số thứ 4 đến 6), kiểm tra lại';
  }
  return null;
}

// Số CCCD là dữ liệu cá nhân (Nghị định 13/2023/NĐ-CP): danh sách, nhật ký chỉ hiện 4 số cuối
export function maskNationalIdNumber(value: string): string {
  return `********${value.slice(-4)}`;
}

// Tên đăng nhập có dạng số CCCD thì che, tên khác giữ nguyên
export function maskLoginIdentifier<T extends string | null>(value: T): T {
  return (isNationalIdShaped(value) ? maskNationalIdNumber(value) : value) as T;
}
