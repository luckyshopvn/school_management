// Sinh chỉ mục đăng ký các phần của máy chủ API (YCTD-294).
// Mỗi phần làm song song thêm một tệp src/dang-ky/<phần>.ts (bộ điều khiển, dịch vụ, bước chuyển năm học) thay vì sửa danh sách
// chung ở application.module.ts, nên các PR song song không còn xung đột ở đó. Tập lệnh đọc thư mục src/dang-ky/ rồi sinh
// src/dang-ky.generated.ts, xếp theo tên tệp. Tệp sinh ra không đưa lên kho (.gitignore): bước dựng, kiểm kiểu tự chạy tập lệnh
// trước tsc.
//
// Cách dùng:
//   node apps/api/sinh-dang-ky.mjs           sinh lại chỉ mục
//   node apps/api/sinh-dang-ky.mjs --kiem    chỉ kiểm: tên tệp đúng mẫu, chỉ mục (nếu có) không lệch, mọi bộ điều khiển đã đăng ký
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const NGUON = fileURLToPath(new URL('./src', import.meta.url));
const THU_MUC_PHAN = join(NGUON, 'dang-ky');
const CHI_MUC = join(NGUON, 'dang-ky.generated.ts');
const TEN_TEP_PHAN = /^[a-z0-9]+(?:-[a-z0-9]+)*\.ts$/;

function tepPhan() {
  if (!existsSync(THU_MUC_PHAN)) return [];
  return readdirSync(THU_MUC_PHAN)
    .filter((ten) => ten.endsWith('.ts') && !ten.endsWith('.d.ts') && !ten.endsWith('.test.ts'))
    .sort();
}

function lapChiMuc(loi) {
  const dongNhap = [];
  const tenBien = [];
  for (const ten of tepPhan()) {
    if (!TEN_TEP_PHAN.test(ten)) {
      loi.push(`src/dang-ky/${ten}: tên tệp phải dạng chữ thường, số, gạch nối (ví dụ dt-28h-goi-scorm.ts)`);
      continue;
    }
    if (!/^export default\b/m.test(readFileSync(join(THU_MUC_PHAN, ten), 'utf8'))) {
      loi.push(`src/dang-ky/${ten}: thiếu "export default { ... } satisfies PhanDangKy"`);
      continue;
    }
    const goc = ten.slice(0, -'.ts'.length);
    const bien = `p_${goc.replaceAll('-', '_')}`;
    dongNhap.push(`import ${bien} from './dang-ky/${goc}.js';`);
    tenBien.push(bien);
  }
  return [
    '// Tệp sinh tự động bởi apps/api/sinh-dang-ky.mjs (YCTD-294). Không sửa tay, không đưa lên kho: thêm tệp vào src/dang-ky/ rồi dựng lại.',
    "import type { PhanDangKy } from './common/dang-ky-phan.js';",
    ...dongNhap,
    '',
    `export const CAC_PHAN_DANG_KY: readonly PhanDangKy[] = [${tenBien.join(', ')}];`,
    '',
  ].join('\n');
}

function tepNguon(thuMuc, ketQua = []) {
  for (const muc of readdirSync(thuMuc, { withFileTypes: true })) {
    const duongDan = join(thuMuc, muc.name);
    if (muc.isDirectory()) tepNguon(duongDan, ketQua);
    else if (muc.name.endsWith('.ts') && !muc.name.endsWith('.test.ts') && !muc.name.endsWith('.generated.ts')) {
      ketQua.push(duongDan);
    }
  }
  return ketQua;
}

// Bộ điều khiển (@Controller) khai báo trong src mà không có tên ở application.module.ts hay tệp nào ở src/dang-ky/: quên đăng ký
// thì đường dẫn trả 404. Bộ điều khiển sinh trong hàm (không "export class" ngay sau trang trí) không xét
function boDieuKhienChuaDangKy() {
  const dangKy = [
    readFileSync(join(NGUON, 'application.module.ts'), 'utf8'),
    ...tepPhan().map((ten) => readFileSync(join(THU_MUC_PHAN, ten), 'utf8')),
  ].join('\n');
  const thieu = [];
  for (const tep of tepNguon(NGUON)) {
    const noiDung = readFileSync(tep, 'utf8');
    for (const khop of noiDung.matchAll(/@Controller\(/g)) {
      const lop = /\b(export\s+)?class\s+(\w+)/.exec(noiDung.slice(khop.index));
      if (!lop?.[1]) continue;
      if (!new RegExp(`\\b${lop[2]}\\b`).test(dangKy)) {
        thieu.push(`src/${tep.slice(NGUON.length + 1).replaceAll('\\', '/')}: bộ điều khiển ${lop[2]} chưa đăng ký`);
      }
    }
  }
  return thieu;
}

function chay() {
  const kiem = process.argv.includes('--kiem');
  const loi = [];
  const noiDung = lapChiMuc(loi);
  if (kiem) {
    if (existsSync(CHI_MUC) && readFileSync(CHI_MUC, 'utf8') !== noiDung) {
      loi.push('src/dang-ky.generated.ts: lệch với thư mục src/dang-ky/, chạy lại node apps/api/sinh-dang-ky.mjs');
    }
    loi.push(
      ...boDieuKhienChuaDangKy().map(
        (dong) => `${dong}: thêm vào tệp đăng ký của phần ở src/dang-ky/ (xem src/common/dang-ky-phan.ts)`,
      ),
    );
  } else if (!existsSync(CHI_MUC) || readFileSync(CHI_MUC, 'utf8') !== noiDung) {
    writeFileSync(CHI_MUC, noiDung);
  }
  if (loi.length > 0) {
    for (const dong of loi) console.error(`apps/api/${dong}`);
    process.exit(1);
  }
  if (kiem) console.log('Đăng ký máy chủ API: đủ, chỉ mục khớp.');
}

chay();
