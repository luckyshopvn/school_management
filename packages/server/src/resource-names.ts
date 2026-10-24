// Tên khóa ở kho tệp (S3) và ở bộ nhớ đệm (Redis) tạo qua một chỗ (tài liệu 32 mục 9.2, viết sẵn cho đa thuê bao): khi
// chạy nhiều trường (DT-SaaS) chỉ cần thêm tiền tố của trường ở đây, mã nghiệp vụ không tự ghép đường dẫn. Mỗi phần là một
// đoạn không rỗng, không có dấu "/" hay ":" để hai phần ghép không thành khóa của chỗ khác. Các phân hệ cũ ghép tay sẽ
// chuyển dần sang hàm này
const PART_PATTERN = /^[A-Za-z0-9._-]+$/;

function checkedParts(parts: string[]): string[] {
  if (parts.length === 0 || parts.some((part) => !PART_PATTERN.test(part))) {
    throw new Error(`Tên khóa không hợp lệ: ${parts.join(', ')}`);
  }
  return parts;
}

// Khóa của một tệp ở kho tệp, ví dụ storageKey('incoming-documents', documentId, fileId)
export function storageKey(...parts: string[]): string {
  return checkedParts(parts).join('/');
}

// Khóa ở bộ nhớ đệm, ví dụ cacheKey('incoming-documents', 'counts', userId)
export function cacheKey(...parts: string[]): string {
  return checkedParts(parts).join(':');
}
