// Mã trường dùng làm tên miền con và tiền tố khóa: chữ thường, số, gạch ngang; 3 đến 32 ký tự; không bắt đầu hoặc kết thúc
// bằng gạch ngang. Danh sách mã dành riêng cấu hình được ở nền tảng (platform_settings), đây là bộ mặc định
export const SCHOOL_CODE_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,30})[a-z0-9]$/;

export const DEFAULT_RESERVED_SCHOOL_CODES: readonly string[] = [
  'www',
  'api',
  'platform',
  'admin',
  'mail',
  'app',
  'identity',
  'portal',
  'static',
  'assets',
  'cdn',
  'staging',
  'test',
  'demo',
  'support',
  'status',
  'login',
  'auth',
  'localhost',
];

export function validateSchoolCode(
  code: string,
  reserved: readonly string[] = DEFAULT_RESERVED_SCHOOL_CODES,
): string | null {
  if (!SCHOOL_CODE_PATTERN.test(code)) {
    return 'Mã trường gồm 3 đến 32 ký tự chữ thường, số hoặc gạch ngang, không bắt đầu hoặc kết thúc bằng gạch ngang';
  }
  if (code.includes('--')) {
    return 'Mã trường không có hai gạch ngang liền nhau';
  }
  if (reserved.includes(code)) {
    return 'Mã trường thuộc danh sách dành riêng';
  }
  return null;
}
