// Khóa so khớp tên đơn vị hành chính (DT-15 phần 15h1): chữ thường, bỏ dấu câu và khoảng trắng thừa, dấu thanh đặt cùng
// một chỗ trong từng tiếng (kiểu cũ "Hoà" và kiểu mới "Hòa" như nhau), bỏ tiền tố loại đơn vị ("Phường", "Xã", "Quận",
// "Thành phố"…), bỏ số 0 đầu của tên là số. Nhờ vậy "Phường Bến Nghé", "P. Bến Nghé", "bến nghé" cùng một khóa; "Phường
// 01" và "Phường 1" cùng khóa "1". Giữ dấu vì có tên chỉ khác nhau ở dấu (Xã Thanh An, Xã Thạnh An). Tên trùng khóa chỉ
// phân biệt theo đơn vị cha
const TONE_MARKS = /[̣̀́̃̉]/g;

// Dấu thanh của mỗi tiếng chuyển xuống cuối tiếng; dấu mũ, dấu trăng, dấu móc giữ nguyên chỗ
function normalizeTones(value: string): string {
  return value
    .normalize('NFD')
    .split(' ')
    .map((word) => word.replace(TONE_MARKS, '') + (word.match(TONE_MARKS) ?? []).join(''))
    .join(' ');
}

function baseKey(value: string): string {
  return normalizeTones(
    value
      .toLowerCase()
      .replace(/[.,\-–()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

const TYPE_PREFIXES = [
  'thành phố ',
  'tp ',
  'tỉnh ',
  'thị xã ',
  'thị trấn ',
  'quận ',
  'huyện ',
  'phường ',
  'xã ',
  'đặc khu ',
  'p ',
  'q ',
  'tt ',
].map(baseKey);

// Tên viết tắt hay gặp trong tệp CSDL ngành
const ALIASES = new Map(
  [
    ['hcm', 'hồ chí minh'],
    ['tp hcm', 'hồ chí minh'],
    ['tphcm', 'hồ chí minh'],
    ['brvt', 'bà rịa vũng tàu'],
  ].map(([alias, name]) => [baseKey(alias ?? ''), baseKey(name ?? '')]),
);

export function administrativeNameKey(value: string): string {
  let key = baseKey(value);
  key = ALIASES.get(key) ?? key;
  const prefix = TYPE_PREFIXES.find(
    (candidate) => key.startsWith(`${candidate} `) && key.length > candidate.length + 1,
  );
  if (prefix) {
    key = key.slice(prefix.length + 1);
  }
  key = ALIASES.get(key) ?? key;
  return (/^\d+$/.test(key) ? String(Number(key)) : key).normalize('NFC');
}
