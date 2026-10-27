// Gom tệp mảnh thay đổi ở tai_lieu/thay_doi_cho_gom/ vào tài liệu chung 01, 02, 03, 23, 24, index (YCTD-291).
// Mỗi PR chỉ thêm một tệp mảnh nên các PR song song không còn xung đột ở tài liệu chung; một PR gom (nhánh gom-…) đổ mọi
// tệp mảnh theo thứ tự merge vào main, chốt số phiên bản phần mềm, tăng số phiên bản tài liệu một lần rồi xoá tệp mảnh.
//
// Cách dùng:
//   node scripts/gom-thay-doi.mjs --kiem        chỉ kiểm định dạng tệp mảnh (CI chạy bước này)
//   node scripts/gom-thay-doi.mjs               gom vào tài liệu chung và xoá tệp mảnh đã gom
//   thêm --thu-muc <đường dẫn tai_lieu>, --ngay <YYYY-MM-DD> khi cần (kiểm thử)
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const THU_MUC_MANH = 'thay_doi_cho_gom';
export const CHO_PHIEN_BAN = '{PHIEN_BAN}';

const TEN_TEP_MANH = /^YCTD-(\d+)-[a-z0-9-]+\.md$/;
const NGAY = /^\d{4}-\d{2}-\d{2}$/;
const PHIEN_BAN = /^(\d+)\.(\d+)\.(\d+)$/;
const KHONG_PHIEN_BAN = 'không';

// Tên mục trong tệp mảnh, theo chữ đầu sau "## "
const MUC = {
  '02': 'nhatKy',
  24: 'yeuCau',
  23: 'phienBan',
  '01': 'bangPhienBan',
  index: 'soDem',
  Nối: 'noiDong',
  Thêm: 'themDong',
};

const TEP = {
  keHoach: '01_KE_HOACH_TONG_THE.md',
  nhatKy: '02_NHAT_KY_DU_AN.md',
  phienBan: '23_LICH_SU_PHIEN_BAN.md',
  yeuCau: '24_YEU_CAU_THAY_DOI.md',
  mucLuc: 'index.md',
};

// Khoảng mã ở index tự tính lại từ tài liệu gốc khi gom
const KHOANG_MA = [
  { tep: '07_QUY_TAC_NGHIEP_VU.md', tim: /\bBR-(\d+)\b/g, mau: /(BR-01 đến BR-)(\d+)/g },
  { tep: '11_TIEU_CHI_NGHIEM_THU.md', tim: /\bAC-(\d+)\b/g, mau: /(AC-01 đến AC-)(\d+)/g },
  { tep: '21_KICH_BAN_KIEM_THU.md', tim: /\bCT-(\d+)\b/g, mau: /(CT-001 đến CT-)(\d+)/g },
  { tep: TEP.yeuCau, tim: /^### YCTD-(\d+)\b/gm, mau: /(YCTD-01 đến YCTD-)(\d+)/g },
];

const DONG_SO_YCTD = 'Yêu cầu thay đổi';

function oBang(dong) {
  const khop = /^\|(.*)\|\s*$/.exec(dong);
  return khop ? khop[1].split('|').map((o) => o.trim()) : null;
}

// Vị trí các dấu | không thoát (\|) trong một dòng bảng
function viTriPhanCach(dong) {
  const viTri = [];
  for (let i = 0; i < dong.length; i += 1) {
    if (dong[i] === '\\') i += 1;
    else if (dong[i] === '|') viTri.push(i);
  }
  return viTri;
}

const NEO_CUOI_BANG = 'cuối bảng ';

/** Đọc một dòng mục Thêm dòng: "| <tệp> | <neo> | <ô 1> | <ô 2> | … |" → { tep, neo, dongMoi } (dòng mới giữ nguyên văn). */
export function docDongThem(dong) {
  const viTri = viTriPhanCach(dong);
  if (viTri[0] !== 0 || viTri.length < 5 || dong.slice(viTri.at(-1)).trim() !== '|') return null;
  const tep = dong.slice(viTri[0] + 1, viTri[1]).trim();
  const neo = dong.slice(viTri[1] + 1, viTri[2]).trim();
  const dongMoi = dong.slice(viTri[2]).trimEnd();
  return tep && neo ? { tep, neo, dongMoi } : null;
}

const soO = (dong) => viTriPhanCach(dong.trimEnd()).length - 1;

// Dòng bảng cuối cùng của bảng đầu tiên sau tiêu đề "#… <tiêu đề>" (so khớp đầu chuỗi); -1 nếu không có
function dongCuoiBang(dong, tieuDe) {
  let i = dong.findIndex((d) => {
    const khop = /^#+\s+(.*)$/.exec(d);
    return khop !== null && khop[1].trim().startsWith(tieuDe);
  });
  if (i < 0) return -1;
  i += 1;
  while (i < dong.length && !dong[i].startsWith('|') && !/^#+\s/.test(dong[i])) i += 1;
  if (i >= dong.length || !dong[i].startsWith('|')) return -1;
  while (i + 1 < dong.length && dong[i + 1].startsWith('|')) i += 1;
  return i;
}

/** Dòng neo của mục Thêm dòng: dòng bảng có ô đầu đúng bằng khoá, hoặc dòng cuối bảng sau tiêu đề ("cuối bảng <tiêu đề>"). */
function timNeo(dong, neo) {
  return neo.startsWith(NEO_CUOI_BANG)
    ? dongCuoiBang(dong, neo.slice(NEO_CUOI_BANG.length).trim())
    : timDongBang(dong, neo);
}

function catDongTrong(dong) {
  let dau = 0;
  let cuoi = dong.length;
  while (dau < cuoi && dong[dau].trim() === '') dau += 1;
  while (cuoi > dau && dong[cuoi - 1].trim() === '') cuoi -= 1;
  return dong.slice(dau, cuoi);
}

/** Đọc một tệp mảnh thành { tenTep, dauTep, muc, loi } (loi là danh sách lỗi cú pháp). */
export function docTepManh(tenTep, noiDung) {
  const loi = [];
  const dong = noiDung.replace(/\r\n/g, '\n').split('\n');
  const dauTep = {};
  const muc = {};
  let i = 0;
  if (dong[0] !== '---') {
    loi.push('thiếu phần đầu tệp (dòng đầu phải là ---)');
  } else {
    i = 1;
    while (i < dong.length && dong[i] !== '---') {
      const khop = /^([a-z_]+):\s*(.*)$/.exec(dong[i]);
      if (khop) dauTep[khop[1]] = khop[2].trim();
      else if (dong[i].trim() !== '') loi.push(`dòng đầu tệp không hiểu: "${dong[i]}"`);
      i += 1;
    }
    if (i >= dong.length) loi.push('phần đầu tệp không có dòng --- đóng');
    i += 1;
  }
  let hienTai = null;
  for (; i < dong.length; i += 1) {
    const tieuDe = /^## (\S+)/.exec(dong[i]);
    if (tieuDe) {
      hienTai = MUC[tieuDe[1]] ?? null;
      if (!hienTai) loi.push(`mục không hỗ trợ: "${dong[i]}"`);
      else if (muc[hienTai]) loi.push(`mục lặp: "${dong[i]}"`);
      else muc[hienTai] = [];
      continue;
    }
    if (hienTai) muc[hienTai].push(dong[i]);
    else if (dong[i].trim() !== '') loi.push(`nội dung nằm ngoài mục: "${dong[i]}"`);
  }
  for (const khoa of Object.keys(muc)) muc[khoa] = catDongTrong(muc[khoa]);
  return { tenTep, dauTep, muc, loi };
}

function timDongBang(dong, khoa) {
  return dong.findIndex((d) => {
    const o = oBang(d);
    return o !== null && o[0] === khoa;
  });
}

function soTheoCum(o, cum) {
  // "Số lượng" là ô thứ hai (cả ô là một số); cụm khác là số đứng ngay trước cụm đó, lần xuất hiện đầu tiên trong dòng
  if (cum === 'Số lượng') return /^\d+$/.test(o[1] ?? '') ? { o: 1, mau: /^\d+$/ } : null;
  const mau = new RegExp(`(\\d+)( ${cum.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`);
  const viTri = o.findIndex((x) => mau.test(x));
  return viTri < 0 ? null : { o: viTri, mau };
}

/** Kiểm một tệp mảnh đã đọc; tai_lieu dùng để kiểm khoá dòng có thật. Trả danh sách lỗi. */
export function kiemTepManh(manh, taiLieu) {
  const loi = [...manh.loi];
  const ten = TEN_TEP_MANH.exec(manh.tenTep);
  if (!ten) loi.push('tên tệp phải dạng YCTD-<số>-<ten-ngan>.md (chữ thường không dấu, gạch nối)');
  const { yctd, tieu_de: tieuDe, ngay, phien_ban_de_xuat: deXuat } = manh.dauTep;
  if (!/^YCTD-\d+$/.test(yctd ?? '')) loi.push('đầu tệp thiếu "yctd: YCTD-<số>"');
  else if (ten && yctd !== `YCTD-${ten[1]}`) loi.push(`yctd ${yctd} không khớp tên tệp`);
  if (!tieuDe) loi.push('đầu tệp thiếu "tieu_de"');
  if (!NGAY.test(ngay ?? '')) loi.push('đầu tệp thiếu "ngay: YYYY-MM-DD"');
  const coPhienBan = deXuat !== KHONG_PHIEN_BAN;
  if (deXuat === undefined || (coPhienBan && !PHIEN_BAN.test(deXuat))) {
    loi.push(`"phien_ban_de_xuat" phải là số dạng 0.145.0 hoặc "${KHONG_PHIEN_BAN}"`);
  }
  const { nhatKy, yeuCau, phienBan, bangPhienBan, soDem, noiDong, themDong } = manh.muc;
  if (!nhatKy?.length) loi.push('thiếu mục "## 02"');
  else if (!/^### \d{4}-\d{2}-\d{2} — \S/.test(nhatKy[0]))
    loi.push('mục 02 phải bắt đầu bằng "### YYYY-MM-DD — <tên>"');
  if (!yeuCau?.length) loi.push('thiếu mục "## 24"');
  else if (yctd && !yeuCau[0].startsWith(`### ${yctd}: `))
    loi.push(`mục 24 phải bắt đầu bằng "### ${yctd}: <tên> – <ngày>"`);
  for (const [tenMuc, khoi] of [
    ['02', nhatKy],
    ['24', yeuCau],
    ['23', phienBan],
  ]) {
    if (khoi?.some((d) => /^#{1,2} /.test(d))) loi.push(`mục ${tenMuc} không được chứa tiêu đề cấp 1, 2`);
  }
  if (coPhienBan) {
    if (!phienBan?.length) loi.push('có phiên bản đề xuất thì phải có mục "## 23"');
    else if (!phienBan[0].startsWith(`### Phiên bản ${CHO_PHIEN_BAN} – `)) {
      loi.push(`mục 23 phải bắt đầu bằng "### Phiên bản ${CHO_PHIEN_BAN} – <ngày>"`);
    }
  } else if (phienBan || bangPhienBan) {
    loi.push(`"phien_ban_de_xuat: ${KHONG_PHIEN_BAN}" thì không có mục 23, 01`);
  }
  for (const d of bangPhienBan ?? []) {
    if (!d.startsWith(`| ${CHO_PHIEN_BAN} |`)) loi.push(`dòng mục 01 phải bắt đầu bằng "| ${CHO_PHIEN_BAN} |": "${d}"`);
  }
  const mucLuc = taiLieu?.[TEP.mucLuc]?.split('\n');
  for (const d of soDem ?? []) {
    const o = oBang(d);
    if (!o || o.length !== 3 || !/^[+-]\d+$/.test(o[2])) {
      loi.push(`dòng mục index phải dạng "| <khoá dòng> | <cụm sau số> | +N |": "${d}"`);
      continue;
    }
    if (o[0] === DONG_SO_YCTD) {
      loi.push(`không ghi dòng "${DONG_SO_YCTD}" ở mục index: tập lệnh gom tự đếm`);
      continue;
    }
    if (!mucLuc) continue;
    const viTri = timDongBang(mucLuc, o[0]);
    if (viTri < 0) loi.push(`index không có dòng "${o[0]}"`);
    else if (!soTheoCum(oBang(mucLuc[viTri]), o[1])) loi.push(`dòng "${o[0]}" ở index không có số trước "${o[1]}"`);
  }
  for (const d of noiDong ?? []) {
    const o = oBang(d);
    if (!o || o.length !== 3 || !o[2]) {
      loi.push(`dòng mục Nối dòng phải dạng "| <tệp> | <khoá dòng> | <nội dung nối> |": "${d}"`);
      continue;
    }
    if (!taiLieu) continue;
    const vanBan = taiLieu[o[0]];
    if (vanBan === undefined) loi.push(`Nối dòng: không có tệp tai_lieu/${o[0]}`);
    else if (timDongBang(vanBan.split('\n'), o[1]) < 0) loi.push(`Nối dòng: ${o[0]} không có dòng bảng "${o[1]}"`);
  }
  for (const d of themDong ?? []) {
    const them = docDongThem(d);
    if (!them) {
      loi.push(
        `dòng mục Thêm dòng phải dạng "| <tệp> | <khoá dòng đứng trước hoặc ${NEO_CUOI_BANG}<tiêu đề>> | <ô 1> | <ô 2> | … |": "${d}"`,
      );
      continue;
    }
    if (!taiLieu) continue;
    const vanBan = taiLieu[them.tep];
    if (vanBan === undefined) {
      loi.push(`Thêm dòng: không có tệp tai_lieu/${them.tep}`);
      continue;
    }
    const dong = vanBan.split('\n');
    const neo = timNeo(dong, them.neo);
    if (neo < 0) {
      loi.push(
        `Thêm dòng: ${them.tep} không có ${them.neo.startsWith(NEO_CUOI_BANG) ? 'bảng sau tiêu đề' : 'dòng bảng'} "${them.neo}"`,
      );
      continue;
    }
    if (soO(dong[neo]) !== soO(them.dongMoi)) {
      loi.push(
        `Thêm dòng: dòng mới có ${soO(them.dongMoi)} ô, bảng ở ${them.tep} có ${soO(dong[neo])} ô: "${them.dongMoi}"`,
      );
    }
    const khoaMoi = oBang(them.dongMoi)?.[0];
    if (khoaMoi && timDongBang(dong, khoaMoi) >= 0)
      loi.push(`Thêm dòng: ${them.tep} đã có dòng "${khoaMoi}": lấy mã khác`);
  }
  if (yctd && taiLieu?.[TEP.yeuCau] && new RegExp(`^### ${yctd}:`, 'm').test(taiLieu[TEP.yeuCau])) {
    loi.push(`${yctd} đã có trong ${TEP.yeuCau}: lấy số khác`);
  }
  return loi;
}

function docThuMuc(thuMuc) {
  const thuMucManh = join(thuMuc, THU_MUC_MANH);
  const tep = existsSync(thuMucManh)
    ? readdirSync(thuMucManh).filter((t) => t.endsWith('.md') && t !== 'README.md')
    : [];
  const manh = tep.map((t) => docTepManh(t, readFileSync(join(thuMucManh, t), 'utf8')));
  return { thuMucManh, manh };
}

function docTaiLieu(thuMuc, ten) {
  const duongDan = join(thuMuc, ten);
  return existsSync(duongDan) ? readFileSync(duongDan, 'utf8').replace(/\r\n/g, '\n') : undefined;
}

function taiLieuCanDoc(thuMuc, manh) {
  const ten = new Set([...Object.values(TEP), ...KHOANG_MA.map((k) => k.tep)]);
  for (const m of manh) {
    for (const d of m.muc.noiDong ?? []) ten.add(oBang(d)?.[0] ?? '');
    for (const d of m.muc.themDong ?? []) ten.add(docDongThem(d)?.tep ?? '');
  }
  const taiLieu = {};
  for (const t of ten) {
    if (!t || t.includes('..')) continue;
    const vanBan = docTaiLieu(thuMuc, t);
    if (vanBan !== undefined) taiLieu[t] = vanBan;
  }
  return taiLieu;
}

/** Kiểm mọi tệp mảnh trong thư mục; trả { soTep, loi: [{ tenTep, loi }] }. */
export function kiemThuMuc(thuMuc) {
  const { manh } = docThuMuc(thuMuc);
  const taiLieu = taiLieuCanDoc(thuMuc, manh);
  const ketQua = manh.map((m) => ({ tenTep: m.tenTep, loi: kiemTepManh(m, taiLieu) }));
  const daThay = new Map();
  for (const m of manh) {
    const yctd = m.dauTep.yctd;
    if (!yctd) continue;
    if (daThay.has(yctd)) {
      ketQua.find((k) => k.tenTep === m.tenTep).loi.push(`${yctd} trùng với tệp ${daThay.get(yctd)}`);
    } else daThay.set(yctd, m.tenTep);
  }
  // Hai tệp mảnh thêm cùng một mã dòng vào cùng một tài liệu
  const dongThem = new Map();
  for (const m of manh) {
    for (const d of m.muc.themDong ?? []) {
      const them = docDongThem(d);
      const khoa = them && oBang(them.dongMoi)?.[0];
      if (!khoa) continue;
      const ma = `${them.tep} ${khoa}`;
      if (dongThem.has(ma) && dongThem.get(ma) !== m.tenTep) {
        ketQua
          .find((k) => k.tenTep === m.tenTep)
          .loi.push(`Thêm dòng: "${khoa}" ở ${them.tep} trùng với tệp ${dongThem.get(ma)}`);
      } else dongThem.set(ma, m.tenTep);
    }
  }
  return { soTep: manh.length, loi: ketQua.filter((k) => k.loi.length > 0) };
}

/** Thứ tự merge: thời điểm tệp được thêm vào lịch sử nhánh chính (cha đầu); tệp chưa commit xếp cuối. */
export function thuTuTheoGit(duongDanTep) {
  const thoiDiem = new Map();
  for (const tep of duongDanTep) {
    let giay = Number.POSITIVE_INFINITY;
    try {
      const ra = execFileSync('git', ['log', '--first-parent', '--diff-filter=A', '--format=%ct', '--', tep], {
        cwd: dirname(tep),
        encoding: 'utf8',
      }).trim();
      // Tệp có thể bị xoá rồi thêm lại; lấy lần thêm gần nhất (dòng đầu)
      if (ra) giay = Number(ra.split('\n')[0]);
    } catch {
      // Không có git: giữ cuối danh sách, xếp theo tên
    }
    thoiDiem.set(tep, giay);
  }
  return [...duongDanTep].sort((a, b) => thoiDiem.get(a) - thoiDiem.get(b) || a.localeCompare(b));
}

function tangPhienBan(hienTai, deXuat) {
  const [chinh, phu, sua] = PHIEN_BAN.exec(hienTai).slice(1).map(Number);
  const laSua = Number(PHIEN_BAN.exec(deXuat)[3]) !== 0;
  return laSua ? `${chinh}.${phu}.${sua + 1}` : `${chinh}.${phu + 1}.0`;
}

function tangPhienBanTaiLieu(vanBan, ngay) {
  return vanBan
    .replace(/^- Phiên bản: (\d+)\.(\d+)$/m, (_, chinh, phu) => `- Phiên bản: ${chinh}.${Number(phu) + 1}`)
    .replace(/^- Ngày cập nhật: .*$/m, `- Ngày cập nhật: ${ngay}`);
}

function chen(vanBan, timViTri, khoi, tenTep) {
  const dong = vanBan.split('\n');
  const viTri = timViTri(dong);
  if (viTri < 0) throw new Error(`không tìm thấy chỗ chèn trong ${tenTep}`);
  dong.splice(viTri, 0, ...khoi);
  return dong.join('\n');
}

const sauTieuDe = (tieuDe) => (dong) => {
  let i = dong.findIndex((d) => d.startsWith(tieuDe));
  if (i < 0) return -1;
  i += 1;
  while (i < dong.length && dong[i].trim() === '') i += 1;
  return i;
};

function noiDong(vanBan, khoa, noiDung) {
  const dong = vanBan.split('\n');
  const viTri = timDongBang(dong, khoa);
  const o = oBang(dong[viTri]);
  const cuoi = o.length - 1;
  o[cuoi] = o[cuoi] ? `${o[cuoi]}; ${noiDung}` : noiDung;
  dong[viTri] = `| ${o.join(' | ')} |`;
  return dong.join('\n');
}

// daThem đếm số dòng đã chèn sau mỗi neo trong lần gom này, để nhiều tệp cùng chèn sau một neo giữ thứ tự merge
function themDongBang(vanBan, { tep, neo, dongMoi }, daThem) {
  const dong = vanBan.split('\n');
  const viTri = timNeo(dong, neo);
  if (viTri < 0) throw new Error(`không tìm thấy neo "${neo}" trong ${tep}`);
  const ma = `${tep} ${neo}`;
  const truoc = neo.startsWith(NEO_CUOI_BANG) ? 0 : (daThem.get(ma) ?? 0);
  dong.splice(viTri + 1 + truoc, 0, dongMoi);
  daThem.set(ma, truoc + 1);
  return dong.join('\n');
}

function congSo(vanBan, khoa, cum, them) {
  const dong = vanBan.split('\n');
  const viTri = timDongBang(dong, khoa);
  const o = oBang(dong[viTri]);
  const { o: soO, mau } = soTheoCum(o, cum);
  if (cum === 'Số lượng') o[soO] = String(Number(o[soO]) + them);
  else o[soO] = o[soO].replace(mau, (_, so, phanSau) => `${Number(so) + them}${phanSau}`);
  dong[viTri] = `| ${o.join(' | ')} |`;
  return dong.join('\n');
}

/**
 * Gom mọi tệp mảnh vào tài liệu chung. Trả { daGom: [{ tenTep, phienBan }] }.
 * Ném lỗi (không ghi gì) nếu có tệp mảnh sai định dạng.
 */
export function gomThayDoi({ thuMuc, ngay, sapXep = thuTuTheoGit }) {
  const kiem = kiemThuMuc(thuMuc);
  if (kiem.loi.length > 0) {
    throw new Error(`tệp mảnh sai định dạng:\n${kiem.loi.map((k) => `${k.tenTep}: ${k.loi.join('; ')}`).join('\n')}`);
  }
  const { thuMucManh, manh } = docThuMuc(thuMuc);
  if (manh.length === 0) return { daGom: [] };
  const theoDuongDan = new Map(manh.map((m) => [join(thuMucManh, m.tenTep), m]));
  const thuTu = sapXep([...theoDuongDan.keys()]).map((d) => theoDuongDan.get(d));
  const taiLieu = taiLieuCanDoc(thuMuc, manh);
  const daSua = new Set();
  const sua = (ten, ham) => {
    taiLieu[ten] = ham(taiLieu[ten]);
    daSua.add(ten);
  };

  const daThem = new Map();
  let phienBanHienTai = /^### Phiên bản (\d+\.\d+\.\d+)/m.exec(taiLieu[TEP.phienBan])[1];
  const daGom = [];
  for (const m of thuTu) {
    const { muc } = m;
    let phienBan = null;
    if (m.dauTep.phien_ban_de_xuat !== KHONG_PHIEN_BAN) {
      phienBan = tangPhienBan(phienBanHienTai, m.dauTep.phien_ban_de_xuat);
      phienBanHienTai = phienBan;
    }
    const dien = (khoi) => khoi.map((d) => (phienBan ? d.split(CHO_PHIEN_BAN).join(phienBan) : d));
    // Mục mới nhất ở trên cùng: gom theo thứ tự merge, mỗi tệp chèn lên đầu nên tệp merge sau cùng nằm trên cùng
    sua(TEP.nhatKy, (v) => chen(v, sauTieuDe('## Nhật ký theo ngày'), [...dien(muc.nhatKy), ''], TEP.nhatKy));
    sua(TEP.yeuCau, (v) =>
      chen(v, (d) => d.findIndex((x) => x.startsWith('### YCTD-')), [...dien(muc.yeuCau), ''], TEP.yeuCau),
    );
    if (muc.phienBan) {
      sua(TEP.phienBan, (v) =>
        chen(v, sauTieuDe('## 2. Danh sách phiên bản'), [...dien(muc.phienBan), ''], TEP.phienBan),
      );
    }
    if (muc.bangPhienBan?.length) {
      // Bảng mốc phát hành ở 01 xếp tăng dần, các bản 0.x đứng ngay trước dòng 1.0.0
      sua(TEP.keHoach, (v) =>
        chen(v, (d) => d.findIndex((x) => x.startsWith('| 1.0.0 |')), dien(muc.bangPhienBan), TEP.keHoach),
      );
    }
    for (const d of muc.soDem ?? []) {
      const [khoa, cum, them] = oBang(d);
      sua(TEP.mucLuc, (v) => congSo(v, khoa, cum, Number(them)));
    }
    for (const d of muc.noiDong ?? []) {
      const [ten, khoa, noiDung] = oBang(d);
      sua(ten, (v) => noiDong(v, khoa, dien([noiDung])[0]));
    }
    for (const d of muc.themDong ?? []) {
      const them = docDongThem(d);
      sua(them.tep, (v) => themDongBang(v, { ...them, dongMoi: dien([them.dongMoi])[0] }, daThem));
    }
    sua(TEP.mucLuc, (v) => congSo(v, DONG_SO_YCTD, 'Số lượng', 1));
    daGom.push({ tenTep: m.tenTep, phienBan });
  }

  for (const { tep, tim, mau } of KHOANG_MA) {
    const nguon = taiLieu[tep];
    if (!nguon) continue;
    const lonNhat = Math.max(0, ...[...nguon.matchAll(tim)].map((k) => Number(k[1])));
    sua(TEP.mucLuc, (v) => v.replace(mau, (khop, dau, so) => `${dau}${Math.max(Number(so), lonNhat)}`));
  }

  for (const ten of daSua) {
    const vanBan =
      ten === TEP.mucLuc
        ? taiLieu[ten].replace(/^- Ngày cập nhật: .*$/m, `- Ngày cập nhật: ${ngay}`)
        : tangPhienBanTaiLieu(taiLieu[ten], ngay);
    writeFileSync(join(thuMuc, ten), vanBan);
  }
  for (const m of thuTu) rmSync(join(thuMucManh, m.tenTep));
  return { daGom };
}

function homNay() {
  const d = new Date();
  const so = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${so(d.getMonth() + 1)}-${so(d.getDate())}`;
}

function chay(thamSo) {
  const lay = (ten) => {
    const i = thamSo.indexOf(ten);
    return i >= 0 ? thamSo[i + 1] : undefined;
  };
  const goc = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const thuMuc = resolve(lay('--thu-muc') ?? join(goc, 'tai_lieu'));
  if (thamSo.includes('--kiem')) {
    const { soTep, loi } = kiemThuMuc(thuMuc);
    for (const k of loi) {
      for (const l of k.loi) console.log(`::error file=${relative(goc, join(thuMuc, THU_MUC_MANH, k.tenTep))}::${l}`);
    }
    console.log(`Đã kiểm ${soTep} tệp mảnh, ${loi.length} tệp có lỗi.`);
    return loi.length > 0 ? 1 : 0;
  }
  const { daGom } = gomThayDoi({ thuMuc, ngay: lay('--ngay') ?? homNay() });
  for (const g of daGom) console.log(`Đã gom ${g.tenTep}${g.phienBan ? ` → phiên bản ${g.phienBan}` : ''}`);
  console.log(`Đã gom ${daGom.length} tệp mảnh. Rà lại thay đổi rồi commit ở nhánh gom-…`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = chay(process.argv.slice(2));
}
