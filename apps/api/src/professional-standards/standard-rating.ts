import type { ProfessionalLevel } from '@school-management/database';

// Xếp loại chung của phiếu chuẩn nghề nghiệp (YCTD-102) theo cách xếp loại của Thông tư 26/2018/TT-BGDĐT và Thông tư
// 25/2018/TT-BGDĐT (cần đối chiếu văn bản): tiêu chí trọng yếu là tiêu chí đánh dấu is_key trên danh mục (mặc định tiêu
// chí thuộc tiêu chuẩn 1 và 2), Hiệu trưởng sửa được.
// - Chưa đạt: có tiêu chí Chưa đạt (hoặc phiếu không có tiêu chí)
// - Tốt: mọi tiêu chí từ Khá trở lên, ít nhất 2/3 số tiêu chí Tốt, mọi tiêu chí trọng yếu Tốt
// - Khá: mọi tiêu chí từ Đạt trở lên, ít nhất 2/3 số tiêu chí từ Khá trở lên, mọi tiêu chí trọng yếu từ Khá trở lên
// - Đạt: mọi tiêu chí từ Đạt trở lên nhưng không đủ điều kiện Khá
export const PROFESSIONAL_LEVELS: ProfessionalLevel[] = ['not_met', 'met', 'good', 'excellent'];

export const LEVEL_LABELS: Record<ProfessionalLevel, string> = {
  not_met: 'Chưa đạt',
  met: 'Đạt',
  good: 'Khá',
  excellent: 'Tốt',
};

const RANK: Record<ProfessionalLevel, number> = { not_met: 0, met: 1, good: 2, excellent: 3 };

export function atLeast(level: ProfessionalLevel, minimum: ProfessionalLevel): boolean {
  return RANK[level] >= RANK[minimum];
}

// Ít nhất 2/3 tổng số tiêu chí, so sánh bằng số nguyên để không lệch do làm tròn
function twoThirds(count: number, total: number): boolean {
  return count * 3 >= total * 2;
}

export function overallLevel(items: Array<{ rating: ProfessionalLevel; isKey: boolean }>): ProfessionalLevel {
  if (items.length === 0 || items.some((item) => item.rating === 'not_met')) {
    return 'not_met';
  }
  const total = items.length;
  const keys = items.filter((item) => item.isKey);
  if (
    items.every((item) => atLeast(item.rating, 'good')) &&
    twoThirds(items.filter((item) => item.rating === 'excellent').length, total) &&
    keys.every((item) => item.rating === 'excellent')
  ) {
    return 'excellent';
  }
  if (
    twoThirds(items.filter((item) => atLeast(item.rating, 'good')).length, total) &&
    keys.every((item) => atLeast(item.rating, 'good'))
  ) {
    return 'good';
  }
  return 'met';
}
