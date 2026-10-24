// Tên khóa ở kho tệp và bộ nhớ đệm tạo qua một chỗ (tài liệu 32 mục 9.2). Hàm nằm ở gói dùng chung của máy chủ để tiến trình
// chạy nền (apps/worker) dùng cùng cách đặt tên với máy chủ API (DT-20 phần 22c2)
export { cacheKey, storageKey } from '@school-management/server/resource-names';
