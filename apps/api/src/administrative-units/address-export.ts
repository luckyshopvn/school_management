import { ADDRESS_TYPE_LABELS, type SuggestionStatus } from './address-catalog.js';
import type { OldAddressRow } from './administrative-units.js';

// Xuất Excel lưới "Địa chỉ học sinh theo địa danh cũ" của 4.1.11 (DT-16 phần 16b): cột như lưới, theo các cột đang hiện
// và bộ lọc của màn hình. Xã cũ chia cho nhiều xã mới thì ghi mọi xã mới, cách nhau dấu chấm phẩy
const SUGGESTION_LABELS: Record<SuggestionStatus, string> = {
  suggested: 'Có đề xuất',
  multiple: 'Nhiều xã/phường mới',
  none: 'Chưa có đối chiếu',
};

const formatDate = (value: string) => value.split('-').reverse().join('/');

export const ADDRESS_EXPORT_COLUMNS: Array<{ id: string; label: string; value(row: OldAddressRow): string }> = [
  { id: 'moet_student_code', label: 'Mã định danh Bộ GD&ĐT', value: (row) => row.moet_student_code ?? '' },
  { id: 'full_name', label: 'Họ tên', value: (row) => row.full_name },
  { id: 'dob', label: 'Ngày sinh', value: (row) => formatDate(row.dob) },
  { id: 'class_name', label: 'Lớp', value: (row) => row.class_name ?? '' },
  { id: 'address_type', label: 'Loại địa chỉ', value: (row) => ADDRESS_TYPE_LABELS[row.address_type] },
  { id: 'old_province', label: 'Tỉnh/Thành phố cũ', value: (row) => row.old_province },
  { id: 'old_district', label: 'Quận/Huyện cũ', value: (row) => row.old_district },
  { id: 'old_ward', label: 'Xã/Phường cũ', value: (row) => row.old_ward },
  { id: 'old_ward_code', label: 'Mã xã/phường cũ', value: (row) => row.old_ward_code ?? '' },
  { id: 'new_province', label: 'Tỉnh/Thành phố mới', value: (row) => row.candidates[0]?.province_name ?? '' },
  {
    id: 'new_ward',
    label: 'Xã/Phường mới',
    value: (row) => row.candidates.map((candidate) => candidate.ward_name).join('; '),
  },
  {
    id: 'new_ward_code',
    label: 'Mã xã/phường mới',
    value: (row) => row.candidates.map((candidate) => candidate.code ?? '').join('; '),
  },
  { id: 'suggestion', label: 'Tình trạng', value: (row) => SUGGESTION_LABELS[row.suggestion] },
];

// Cột hiện mặc định trên lưới
export const DEFAULT_ADDRESS_EXPORT_COLUMNS = ADDRESS_EXPORT_COLUMNS.map((column) => column.id).filter(
  (id) => id !== 'old_ward_code' && id !== 'new_ward_code',
);
