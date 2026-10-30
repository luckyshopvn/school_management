// Sinh chỉ mục tệp thay đổi cấu trúc và kiểu bảng của từng loại cơ sở dữ liệu (YCTD-294).
// Mỗi phần làm song song chỉ thêm tệp riêng: migrations/<số>_<tên>.ts và (khi thêm bảng) schema-parts/<phần>.ts, không sửa danh
// sách chung nên các PR song song không còn xung đột ở index.ts, schema.ts. Tập lệnh đọc hai thư mục đó rồi sinh:
//   <loại>/migrations.generated.ts     danh sách tệp thay đổi cấu trúc, xếp theo tên tệp (Kysely cũng chạy theo thứ tự tên)
//   <loại>/schema-parts.generated.ts   xuất lại kiểu của các tệp schema-parts/, kéo phần mở rộng SchoolYearDatabase… vào chương trình
// Tệp sinh ra không đưa lên kho (.gitignore): bước dựng, kiểm kiểu của gói tự chạy tập lệnh trước tsc.
//
// Cách dùng:
//   node database/sinh-chi-muc.mjs           sinh lại các tệp chỉ mục
//   node database/sinh-chi-muc.mjs --kiem    chỉ kiểm: tên tệp đúng mẫu, mỗi tệp xuất đúng tên, tệp chỉ mục (nếu có) không lệch
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const GOC = fileURLToPath(new URL('.', import.meta.url));
export const LOAI = ['identity', 'system', 'school-year', 'platform'];

const TEN_TEP_THAY_DOI = /^(\d{4})_[a-z0-9_]+\.ts$/;
const TEN_TEP_PHAN = /^[a-z0-9]+(?:-[a-z0-9]+)*\.ts$/;
const DAU_TEP =
  '// Tệp sinh tự động bởi database/sinh-chi-muc.mjs (YCTD-294). Không sửa tay, không đưa lên kho: thêm tệp vào thư mục rồi dựng lại.\n';

function tepTs(thuMuc) {
  if (!existsSync(thuMuc)) return [];
  return readdirSync(thuMuc)
    .filter((ten) => ten.endsWith('.ts') && !ten.endsWith('.d.ts') && !ten.endsWith('.test.ts'))
    .sort();
}

// Nội dung hai tệp chỉ mục của một loại cơ sở dữ liệu cùng các lỗi tìm thấy
export function lapChiMuc(goc, loai) {
  const loi = [];
  const thuMucThayDoi = join(goc, loai, 'migrations');
  const dongNhap = [];
  const dongDanhSach = [];
  for (const ten of tepTs(thuMucThayDoi)) {
    const duongDan = relative(goc, join(thuMucThayDoi, ten)).replaceAll('\\', '/');
    if (!TEN_TEP_THAY_DOI.test(ten)) {
      loi.push(`${duongDan}: tên tệp thay đổi cấu trúc phải dạng <4 chữ số>_<chữ thường, số, gạch dưới>.ts`);
      continue;
    }
    if (!/^export const migration\b/m.test(readFileSync(join(thuMucThayDoi, ten), 'utf8'))) {
      loi.push(`${duongDan}: thiếu "export const migration" (mỗi tệp thay đổi cấu trúc xuất một hằng tên migration)`);
      continue;
    }
    const khoa = ten.slice(0, -'.ts'.length);
    dongNhap.push(`import { migration as m_${khoa} } from './migrations/${khoa}.js';`);
    dongDanhSach.push(`  '${khoa}': m_${khoa},`);
  }
  const thayDoi = [
    DAU_TEP + "import type { Migration } from 'kysely/migration';",
    ...dongNhap,
    '',
    `export const migrations: Record<string, Migration> = {`,
    ...dongDanhSach,
    '};',
    '',
  ].join('\n');

  const thuMucPhan = join(goc, loai, 'schema-parts');
  const dongXuat = [];
  for (const ten of tepTs(thuMucPhan)) {
    const duongDan = relative(goc, join(thuMucPhan, ten)).replaceAll('\\', '/');
    if (!TEN_TEP_PHAN.test(ten)) {
      loi.push(
        `${duongDan}: tên tệp kiểu bảng của phần phải dạng chữ thường, số, gạch nối (ví dụ dt-28h-goi-scorm.ts)`,
      );
      continue;
    }
    if (!readFileSync(join(thuMucPhan, ten), 'utf8').includes("declare module '../schema.js'")) {
      loi.push(`${duongDan}: thiếu "declare module '../schema.js'" để thêm bảng vào giao diện cơ sở dữ liệu`);
      continue;
    }
    dongXuat.push(`export type * from './schema-parts/${ten.slice(0, -'.ts'.length)}.js';`);
  }
  const kieu = [DAU_TEP.trimEnd(), ...dongXuat, 'export {};', ''].join('\n');

  return {
    loi,
    tep: [
      { duongDan: join(goc, loai, 'migrations.generated.ts'), noiDung: thayDoi },
      { duongDan: join(goc, loai, 'schema-parts.generated.ts'), noiDung: kieu },
    ],
  };
}

function chay() {
  const kiem = process.argv.includes('--kiem');
  const loi = [];
  for (const loai of LOAI) {
    const chiMuc = lapChiMuc(GOC, loai);
    loi.push(...chiMuc.loi);
    for (const { duongDan, noiDung } of chiMuc.tep) {
      const tenTuongDoi = relative(GOC, duongDan).replaceAll('\\', '/');
      if (kiem) {
        if (existsSync(duongDan) && readFileSync(duongDan, 'utf8') !== noiDung) {
          loi.push(`${tenTuongDoi}: lệch với thư mục, chạy lại node database/sinh-chi-muc.mjs`);
        }
      } else if (!existsSync(duongDan) || readFileSync(duongDan, 'utf8') !== noiDung) {
        writeFileSync(duongDan, noiDung);
      }
    }
  }
  if (loi.length > 0) {
    for (const dong of loi) console.error(`database/${dong}`);
    process.exit(1);
  }
  if (kiem) console.log('Chỉ mục cơ sở dữ liệu: đúng mẫu.');
}

chay();
