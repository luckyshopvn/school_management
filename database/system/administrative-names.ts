// Khóa so khớp tên đơn vị hành chính (DT-15 phần 15h1): bỏ dấu, chữ thường, bỏ dấu câu và khoảng trắng thừa, bỏ tiền tố
// loại đơn vị ("Phường", "Xã", "Quận", "Thành phố"…), bỏ số 0 đầu của tên là số. Nhờ vậy "Phường Bến Nghé", "P. Bến
// Nghé", "bến nghé" cùng một khóa; "Phường 01" và "Phường 1" cùng khóa "1". Tên trùng khóa chỉ phân biệt theo đơn vị cha
const TYPE_PREFIXES = [
  'thanh pho ',
  'tp ',
  'tinh ',
  'thi xa ',
  'thi tran ',
  'quan ',
  'huyen ',
  'phuong ',
  'xa ',
  'dac khu ',
  'p ',
  'q ',
  'tt ',
];

// Tên viết tắt hay gặp trong tệp CSDL ngành
const ALIASES: Record<string, string> = {
  hcm: 'ho chi minh',
  'tp hcm': 'ho chi minh',
  tphcm: 'ho chi minh',
  brvt: 'ba ria vung tau',
};

export function administrativeNameKey(value: string): string {
  let key = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[.,\-–()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  key = ALIASES[key] ?? key;
  const prefix = TYPE_PREFIXES.find((candidate) => key.startsWith(candidate) && key.length > candidate.length);
  if (prefix) {
    key = key.slice(prefix.length);
  }
  key = ALIASES[key] ?? key;
  return /^\d+$/.test(key) ? String(Number(key)) : key;
}
