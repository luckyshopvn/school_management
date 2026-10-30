// Sinh biến CSS từ packages/ui/tokens.json (YCTD-384, 15_HE_THONG_THIET_KE.md mục 2.6, 2.7 GT-01).
//   node packages/ui/scripts/sinh-bien-thiet-ke.mjs          ghi src/bien-thiet-ke.css và src/bien-thiet-ke-tailwind.css
//   node packages/ui/scripts/sinh-bien-thiet-ke.mjs --kiem   báo lỗi nếu hai tệp đã sinh khác nguồn (kiểm thử của gói gọi hàm này)
// Tệp biến thuần dùng được cho ứng dụng không dùng Tailwind (cổng vận hành); tệp Tailwind ánh xạ biến thành lớp tiện ích.
// Giá trị tối nằm dưới lớp `.che-do-toi`, chưa ứng dụng nào đặt lớp này (GT-06).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const GOI = join(dirname(fileURLToPath(import.meta.url)), '..');
export const TEP_BIEN = join(GOI, 'src', 'bien-thiet-ke.css');
export const TEP_TAILWIND = join(GOI, 'src', 'bien-thiet-ke-tailwind.css');
const DAU_TEP =
  '/* Tệp sinh tự động từ packages/ui/tokens.json bằng scripts/sinh-bien-thiet-ke.mjs; không sửa tay (YCTD-384) */\n';

// Phong cách theo vai không có thanh bên tối: thanh bên trắng (TD-21, KC-09), lấy theo biến của chính phong cách
const THEO_VAI_SUY_RA = {
  'thanh-ben': 'var(--pc-the)',
  'chu-thanh-ben': 'var(--pc-chu)',
  'chu-phu-thanh-ben': 'var(--pc-chu-phu)',
  'ke-thanh-ben': 'var(--pc-vien)',
  'chon-thanh-ben': 'var(--pc-nhan-nhat)',
  'chu-chon-thanh-ben': 'var(--pc-nhan-dam)',
};

export function docNguon() {
  return JSON.parse(readFileSync(join(GOI, 'tokens.json'), 'utf8'));
}

const khoi = (boChon, dong) => `${boChon} {\n${dong.map((d) => `  ${d}`).join('\n')}\n}\n`;
const mau = (bang, cheDo) =>
  Object.entries(bang).map(([ten, giaTri]) => `--pc-${ten}: ${giaTri[cheDo].toLowerCase()};`);
const hinh = (bang) => Object.entries(bang).map(([ten, giaTri]) => `--pc-${ten}: ${giaTri};`);

export function sinhBien(nguon) {
  const { chung, 'phong-cach': phongCach, vai } = nguon;
  const hanhChinh = phongCach['hanh-chinh'];
  const theoVai = phongCach['theo-vai'];
  const goc = [
    `--pc-phong-chu: ${chung['phong-chu']};`,
    ...Object.entries(chung['co-chu']).map(([ten, giaTri]) => `--pc-co-${ten}: ${giaTri};`),
    ...Object.entries(chung.khoang).map(([ten, giaTri]) => `--pc-khoang-${ten}: ${giaTri};`),
    `--pc-vung-cham: ${chung['vung-cham']};`,
    ...mau(chung.mau, 'sang'),
    // Mặc định theo phong cách hành chính để thành phần dùng chung hiện đúng cả khi trang chưa đặt lớp phong cách
    ...mau(hanhChinh.mau, 'sang'),
    ...hinh(hanhChinh.hinh),
  ];
  const suyRa = Object.entries(THEO_VAI_SUY_RA).map(([ten, giaTri]) => `--pc-${ten}: ${giaTri};`);
  let css = DAU_TEP;
  css += khoi(':root', goc);
  css += khoi('.pc-hanh-chinh', [...mau(hanhChinh.mau, 'sang'), ...hinh(hanhChinh.hinh)]);
  css += khoi('.pc-theo-vai', [...mau(theoVai.mau, 'sang'), ...hinh(theoVai.hinh), ...suyRa]);
  for (const [ten, bang] of Object.entries(vai)) {
    css += khoi(`.vai-${ten}`, mau(bang, 'sang'));
  }
  css += '/* Chế độ tối: định nghĩa sẵn, chưa bật (GT-06, Q-384-2) */\n';
  css += khoi('.che-do-toi', mau(chung.mau, 'toi'));
  css += khoi('.che-do-toi .pc-hanh-chinh,\n.che-do-toi.pc-hanh-chinh', mau(hanhChinh.mau, 'toi'));
  css += khoi('.che-do-toi .pc-theo-vai,\n.che-do-toi.pc-theo-vai', mau(theoVai.mau, 'toi'));
  for (const [ten, bang] of Object.entries(vai)) {
    css += khoi(`.che-do-toi .vai-${ten},\n.che-do-toi.vai-${ten}`, mau(bang, 'toi'));
  }
  return css;
}

export function sinhTailwind(nguon) {
  const { chung, 'phong-cach': phongCach, vai } = nguon;
  const tenMau = new Set([
    ...Object.keys(chung.mau),
    ...Object.keys(phongCach['hanh-chinh'].mau),
    ...Object.keys(phongCach['theo-vai'].mau),
    ...Object.keys(THEO_VAI_SUY_RA),
    ...Object.values(vai).flatMap((bang) => Object.keys(bang)),
  ]);
  const dong = [
    '--font-pc: var(--pc-phong-chu);',
    ...Object.keys(chung['co-chu']).map((ten) => `--text-pc-co-${ten}: var(--pc-co-${ten});`),
    ...[...tenMau].map((ten) => `--color-pc-${ten}: var(--pc-${ten});`),
    '--radius-pc-nho: var(--pc-bo-nho);',
    '--radius-pc-lon: var(--pc-bo-lon);',
    '--radius-pc-nut: var(--pc-bo-nut);',
    '--shadow-pc: var(--pc-bong);',
    '--spacing-pc-cham: var(--pc-vung-cham);',
  ];
  return DAU_TEP + khoi('@theme inline', dong);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const nguon = docNguon();
  const can = [
    [TEP_BIEN, sinhBien(nguon)],
    [TEP_TAILWIND, sinhTailwind(nguon)],
  ];
  if (process.argv.includes('--kiem')) {
    const lech = can.filter(([tep, noiDung]) => readFileSync(tep, 'utf8') !== noiDung);
    if (lech.length) {
      console.error(`Tệp biến khác tokens.json, chạy lại tập lệnh sinh: ${lech.map(([tep]) => tep).join(', ')}`);
      process.exit(1);
    }
    console.log('Tệp biến khớp tokens.json');
  } else {
    for (const [tep, noiDung] of can) writeFileSync(tep, noiDung);
    console.log('Đã sinh tệp biến từ tokens.json');
  }
}
