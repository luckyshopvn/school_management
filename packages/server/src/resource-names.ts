// Tên khóa ở kho tệp (S3) và ở bộ nhớ đệm (Redis) tạo qua một chỗ (tài liệu 32 mục 9.2, viết sẵn cho đa thuê bao): khi
// chạy nhiều trường (DT-SaaS) chỉ cần thêm tiền tố của trường ở đây, mã nghiệp vụ không tự ghép đường dẫn. Mỗi phần là một
// đoạn không rỗng, không có dấu "/" hay ":" để hai phần ghép không thành khóa của chỗ khác. Các phân hệ cũ ghép tay sẽ
// chuyển dần sang hàm này
import { requireTenant } from './tenant-context.js';

const PART_PATTERN = /^[A-Za-z0-9._-]+$/;

function checkedParts(parts: string[]): string[] {
  if (parts.length === 0 || parts.some((part) => !PART_PATTERN.test(part))) {
    throw new Error(`Tên khóa không hợp lệ: ${parts.join(', ')}`);
  }
  return parts;
}

// Khóa của một tệp ở kho tệp, ví dụ storageKey('incoming-documents', documentId, fileId). Ở chế độ nhiều trường khóa có tiền
// tố của trường (`tenants/<mã>/...`) lấy từ ngữ cảnh; thiếu ngữ cảnh là lỗi. Trường số 1 có tiền tố trống nên khóa hiện có còn đúng
export function storageKey(...parts: string[]): string {
  const tenant = requireTenant('kho tệp');
  const prefix = tenant?.keyPrefix ? ['tenants', tenant.keyPrefix] : [];
  return checkedParts([...prefix, ...parts]).join('/');
}

// Khóa ở bộ nhớ đệm, ví dụ cacheKey('incoming-documents', 'counts', userId); ở chế độ nhiều trường có tiền tố `t:<mã>`
export function cacheKey(...parts: string[]): string {
  const tenant = requireTenant('bộ nhớ đệm');
  const prefix = tenant?.keyPrefix ? ['t', tenant.keyPrefix] : [];
  return checkedParts([...prefix, ...parts]).join(':');
}

// Khóa ở bộ nhớ đệm với tiền tố của trường cho sẵn (không đọc ngữ cảnh): tiến trình nền không có ngữ cảnh trường, nhận tiền tố kèm việc
// (DT-SaaS phần S1b). Tiền tố trống là trường số 1 hoặc chế độ một trường: khóa như cacheKey khi không có trường
export function cacheKeyWithPrefix(keyPrefix: string, ...parts: string[]): string {
  const prefix = keyPrefix ? ['t', keyPrefix] : [];
  return checkedParts([...prefix, ...parts]).join(':');
}
