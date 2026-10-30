// Kiểm thử tập lệnh gom tệp mảnh thay đổi (scripts/gom-thay-doi.mjs, YCTD-291) trên bộ tài liệu thu nhỏ ở thư mục tạm
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { docTepManh, gomThayDoi, kiemTepManh, kiemThuMuc } from '../../scripts/gom-thay-doi.mjs';

const DAU = (ten, phienBan) =>
  `# ${ten}\n\n- Phiên bản: ${phienBan}\n- Ngày cập nhật: 2026-10-26\n- Trạng thái: Đang cập nhật\n`;

const TAI_LIEU = {
  '01_KE_HOACH_TONG_THE.md': `${DAU('01. KẾ HOẠCH', '1.73')}\n## 3. Mốc\n\n| Phiên bản | Nội dung | Ghi chú |\n|---|---|---|\n| 0.144.0 | Thi trực tuyến | YCTD-211 |\n| 1.0.0 | Giai đoạn 1 | Đã có |\n`,
  '02_NHAT_KY_DU_AN.md': `${DAU('02. NHẬT KÝ', '0.79')}\n## Nhật ký theo ngày\n\n### 2026-10-26 — Mục cũ\n\n- Cũ.\n`,
  '03_DANH_SACH_CONG_VIEC.md': `${DAU('03. CÔNG VIỆC', '0.76')}\n| Phân hệ | Trạng thái | Việc còn lại |\n|---|---|---|\n| P02 Trẻ | Hoàn thành | DT-23 phần 23a (YCTD-211) |\n`,
  '07_QUY_TAC_NGHIEP_VU.md': '### BR-237\n### BR-238\n',
  '11_TIEU_CHI_NGHIEM_THU.md': '| AC-879 |\n| AC-880 |\n',
  '21_KICH_BAN_KIEM_THU.md': '| CT-1107 |\n| CT-1108 | CT-23a-1 |\n',
  '23_LICH_SU_PHIEN_BAN.md': `${DAU('23. PHIÊN BẢN', '0.63')}\n## 2. Danh sách phiên bản\n\n### Phiên bản 0.144.0 – 2026-10-26\n\n- Cũ.\n`,
  '24_YEU_CAU_THAY_DOI.md': `${DAU('24. YÊU CẦU', '0.76')}\n## Quy ước\n\nMã dạng YCTD-nn.\n\n### YCTD-290: Cũ – 2026-10-26\n\n- Cũ.\n`,
  'index.md': `# MỤC LỤC\n\n- Ngày cập nhật: 2026-10-26\n\n| Số | Tệp | Mô tả |\n|---|---|---|\n| 07 | 07 | BR-01 đến BR-237 |\n| 11 | 11 | AC-01 đến AC-879 |\n| 14 | 14 | 281 màn hình, cây menu |\n| 21 | 21 | CT-001 đến CT-1107 |\n| 24 | 24 | YCTD-01 đến YCTD-290, đánh giá |\n\n| Hạng mục | Số lượng | Ghi chú |\n|---|---|---|\n| Màn hình dự kiến | 321 | MH-337 (YCTD-212) |\n| Yêu cầu thay đổi | 194 | Từ YCTD-01 đến YCTD-290 |\n`,
};

function tepManh({ so, ten, phienBan = '0.145.0', them = '' }) {
  const coPhienBan = phienBan !== 'không';
  return [
    '---',
    `yctd: YCTD-${so}`,
    `tieu_de: ${ten}`,
    'ngay: 2026-10-27',
    `phien_ban_de_xuat: ${phienBan}`,
    '---',
    '',
    '## 02 Nhật ký',
    '',
    `### 2026-10-27 — ${ten}`,
    '',
    '#### Thay đổi',
    '',
    coPhienBan ? `- Xem YCTD-${so}, phiên bản {PHIEN_BAN}.` : `- Xem YCTD-${so}.`,
    '',
    '## 24 Yêu cầu thay đổi',
    '',
    `### YCTD-${so}: ${ten} – 2026-10-27`,
    '',
    '- Trạng thái: Đã triển khai',
    ...(coPhienBan
      ? [
          '',
          '## 23',
          '',
          '### Phiên bản {PHIEN_BAN} – 2026-10-27',
          '',
          `- Phạm vi: ${ten}.`,
          '',
          '## 01',
          '',
          `| {PHIEN_BAN} | ${ten} | YCTD-${so} |`,
        ]
      : []),
    them,
    '',
  ].join('\n');
}

describe('gom tệp mảnh thay đổi', () => {
  let thuMuc;
  const doc = (ten) => readFileSync(join(thuMuc, ten), 'utf8');
  const ghiManh = (ten, noiDung) => writeFileSync(join(thuMuc, 'thay_doi_cho_gom', ten), noiDung);

  beforeEach(() => {
    thuMuc = mkdtempSync(join(tmpdir(), 'gom-thay-doi-'));
    mkdirSync(join(thuMuc, 'thay_doi_cho_gom'));
    writeFileSync(join(thuMuc, 'thay_doi_cho_gom', 'README.md'), '# Không phải tệp mảnh\n');
    for (const [ten, noiDung] of Object.entries(TAI_LIEU)) writeFileSync(join(thuMuc, ten), noiDung);
  });
  afterEach(() => rmSync(thuMuc, { recursive: true, force: true }));

  it('gom theo thứ tự merge, chốt phiên bản, tăng phiên bản tài liệu một lần, xoá tệp mảnh', () => {
    ghiManh(
      'YCTD-233-khung-kiem-thu.md',
      tepManh({
        so: 233,
        ten: 'Khung kiểm thử',
        them: [
          '',
          '## index Số đếm',
          '',
          '| 14 | màn hình | +2 |',
          '| Màn hình dự kiến | Số lượng | +2 |',
          '',
          '## Nối dòng',
          '',
          '| 03_DANH_SACH_CONG_VIEC.md | P02 Trẻ | DT-26 phần 26c (YCTD-233, {PHIEN_BAN}) |',
        ].join('\n'),
      }),
    );
    ghiManh('YCTD-231-vo-ung-dung.md', tepManh({ so: 231, ten: 'Vỏ ứng dụng', phienBan: '0.144.1' }));
    ghiManh('YCTD-292-sua-kiem-thu.md', tepManh({ so: 292, ten: 'Sửa kiểm thử', phienBan: 'không' }));

    // Thứ tự merge giả định: 233 trước, 231 sau, 292 cuối
    const thuTu = ['YCTD-233', 'YCTD-231', 'YCTD-292'];
    const sapXep = (tep) =>
      [...tep].sort((a, b) => thuTu.findIndex((t) => a.includes(t)) - thuTu.findIndex((t) => b.includes(t)));
    const { daGom } = gomThayDoi({ thuMuc, ngay: '2026-10-28', sapXep });

    assert.deepEqual(
      daGom.map((g) => [g.tenTep, g.phienBan]),
      [
        ['YCTD-233-khung-kiem-thu.md', '0.145.0'],
        ['YCTD-231-vo-ung-dung.md', '0.145.1'],
        ['YCTD-292-sua-kiem-thu.md', null],
      ],
    );

    const nhatKy = doc('02_NHAT_KY_DU_AN.md');
    assert.match(nhatKy, /- Phiên bản: 0\.80\n- Ngày cập nhật: 2026-10-28/);
    const viTri = ['Sửa kiểm thử', 'Vỏ ứng dụng', 'Khung kiểm thử', 'Mục cũ'].map((t) => nhatKy.indexOf(`— ${t}`));
    assert.deepEqual(
      [...viTri].sort((a, b) => a - b),
      viTri,
      'mục merge sau cùng nằm trên cùng',
    );
    assert.match(nhatKy, /Xem YCTD-233, phiên bản 0\.145\.0\./);
    assert.ok(!nhatKy.includes('{PHIEN_BAN}'));

    const yeuCau = doc('24_YEU_CAU_THAY_DOI.md');
    assert.match(yeuCau, /- Phiên bản: 0\.77\n/);
    assert.ok(yeuCau.indexOf('### YCTD-292') < yeuCau.indexOf('### YCTD-231'));
    assert.ok(yeuCau.indexOf('### YCTD-233') < yeuCau.indexOf('### YCTD-290'));
    assert.ok(yeuCau.indexOf('Mã dạng YCTD-nn.') < yeuCau.indexOf('### YCTD-292'));

    const phienBan = doc('23_LICH_SU_PHIEN_BAN.md');
    assert.match(phienBan, /- Phiên bản: 0\.64\n/);
    assert.ok(phienBan.indexOf('### Phiên bản 0.145.1') < phienBan.indexOf('### Phiên bản 0.145.0'));
    assert.ok(phienBan.indexOf('### Phiên bản 0.145.0') < phienBan.indexOf('### Phiên bản 0.144.0'));

    const keHoach = doc('01_KE_HOACH_TONG_THE.md');
    assert.match(keHoach, /- Phiên bản: 1\.74\n/);
    assert.match(
      keHoach,
      /\| 0\.144\.0 .*\n\| 0\.145\.0 \| Khung kiểm thử \| YCTD-233 \|\n\| 0\.145\.1 \| Vỏ ứng dụng \| YCTD-231 \|\n\| 1\.0\.0 \|/,
    );

    const congViec = doc('03_DANH_SACH_CONG_VIEC.md');
    assert.match(congViec, /- Phiên bản: 0\.77\n/);
    assert.match(
      congViec,
      /\| P02 Trẻ \| Hoàn thành \| DT-23 phần 23a \(YCTD-211\); DT-26 phần 26c \(YCTD-233, 0\.145\.0\) \|/,
    );

    const mucLuc = doc('index.md');
    assert.match(mucLuc, /- Ngày cập nhật: 2026-10-28/);
    assert.match(mucLuc, /\| 14 \| 14 \| 283 màn hình, cây menu \|/);
    assert.match(mucLuc, /\| Màn hình dự kiến \| 323 \|/);
    assert.match(mucLuc, /\| Yêu cầu thay đổi \| 197 \| Từ YCTD-01 đến YCTD-292 \|/);
    assert.match(mucLuc, /YCTD-01 đến YCTD-292, đánh giá/);
    assert.match(mucLuc, /BR-01 đến BR-238/);
    assert.match(mucLuc, /AC-01 đến AC-880/);
    assert.match(mucLuc, /CT-001 đến CT-1108/);

    assert.ok(!existsSync(join(thuMuc, 'thay_doi_cho_gom', 'YCTD-233-khung-kiem-thu.md')));
    assert.ok(existsSync(join(thuMuc, 'thay_doi_cho_gom', 'README.md')));
    assert.deepEqual(kiemThuMuc(thuMuc), { soTep: 0, loi: [] });
  });

  it('không có tệp mảnh thì không sửa gì', () => {
    assert.deepEqual(gomThayDoi({ thuMuc, ngay: '2026-10-28' }).daGom, []);
    assert.equal(doc('02_NHAT_KY_DU_AN.md'), TAI_LIEU['02_NHAT_KY_DU_AN.md']);
  });

  it('tệp mảnh sai định dạng thì gom dừng, không ghi gì', () => {
    ghiManh('YCTD-233-khung.md', tepManh({ so: 233, ten: 'Khung' }));
    ghiManh('YCTD-234-loi.md', tepManh({ so: 234, ten: 'Lỗi' }).replace('## 24 Yêu cầu thay đổi', '## 25 Sai'));
    assert.throws(() => gomThayDoi({ thuMuc, ngay: '2026-10-28' }), /YCTD-234-loi\.md: .*mục không hỗ trợ/);
    assert.equal(doc('02_NHAT_KY_DU_AN.md'), TAI_LIEU['02_NHAT_KY_DU_AN.md']);
    assert.ok(existsSync(join(thuMuc, 'thay_doi_cho_gom', 'YCTD-233-khung.md')));
  });

  it('chế độ kiểm báo các lỗi định dạng thường gặp', () => {
    const kiem = (ten, noiDung) => kiemTepManh(docTepManh(ten, noiDung), TAI_LIEU);
    assert.deepEqual(kiem('YCTD-233-dung.md', tepManh({ so: 233, ten: 'Đúng' })), []);
    assert.deepEqual(kiem('YCTD-292-khong.md', tepManh({ so: 292, ten: 'Không', phienBan: 'không' })), []);

    const loi = (ten, noiDung) => kiem(ten, noiDung).join('\n');
    assert.match(loi('YCTD_233.md', tepManh({ so: 233, ten: 'X' })), /tên tệp/);
    assert.match(loi('YCTD-234-x.md', tepManh({ so: 233, ten: 'X' })), /không khớp tên tệp/);
    assert.match(loi('YCTD-233-x.md', tepManh({ so: 233, ten: 'X', phienBan: '0.145' })), /phien_ban_de_xuat/);
    assert.match(
      loi(
        'YCTD-233-x.md',
        tepManh({ so: 233, ten: 'X' }).replace('### Phiên bản {PHIEN_BAN}', '### Phiên bản 0.145.0'),
      ),
      /\{PHIEN_BAN\}/,
    );
    assert.match(loi('YCTD-290-x.md', tepManh({ so: 290, ten: 'X' })), /đã có trong 24/);
    assert.match(
      loi('YCTD-233-x.md', tepManh({ so: 233, ten: 'X' }).replace('### 2026-10-27 —', '### Ngày —')),
      /mục 02/,
    );
    assert.match(
      loi('YCTD-233-x.md', tepManh({ so: 233, ten: 'X', them: '\n## index\n\n| Yêu cầu thay đổi | Số lượng | +1 |' })),
      /tự đếm/,
    );
    assert.match(
      loi('YCTD-233-x.md', tepManh({ so: 233, ten: 'X', them: '\n## index\n\n| 99 | màn hình | +1 |' })),
      /không có dòng "99"/,
    );
    assert.match(
      loi('YCTD-233-x.md', tepManh({ so: 233, ten: 'X', them: '\n## index\n\n| 14 | bảng | +1 |' })),
      /không có số trước "bảng"/,
    );
    assert.match(
      loi(
        'YCTD-233-x.md',
        tepManh({ so: 233, ten: 'X', them: '\n## Nối dòng\n\n| 03_DANH_SACH_CONG_VIEC.md | P99 | x |' }),
      ),
      /không có dòng bảng "P99"/,
    );
    assert.match(
      loi(
        'YCTD-292-x.md',
        tepManh({ so: 292, ten: 'X', phienBan: 'không', them: '\n## 23\n\n### Phiên bản {PHIEN_BAN} – 2026-10-27' }),
      ),
      /không có mục 23/,
    );
  });

  it('chế độ kiểm báo hai tệp mảnh trùng mã YCTD', () => {
    ghiManh('YCTD-233-mot.md', tepManh({ so: 233, ten: 'Một' }));
    ghiManh('YCTD-233-hai.md', tepManh({ so: 233, ten: 'Hai' }));
    const { soTep, loi } = kiemThuMuc(thuMuc);
    assert.equal(soTep, 2);
    assert.match(loi.map((k) => k.loi.join('; ')).join('\n'), /YCTD-233 trùng với tệp/);
  });

  it('phiếu làm theo lát: tệp của lát sau cùng mã YCTD không bị bắt trùng', () => {
    ghiManh('YCTD-233-mot.md', tepManh({ so: 233, ten: 'Lát L0' }));
    ghiManh('YCTD-233-l1b-hai.md', tepManh({ so: 233, ten: 'Lát L1b' }));
    const { soTep, loi } = kiemThuMuc(thuMuc);
    assert.equal(soTep, 2);
    assert.deepEqual(
      loi.flatMap((k) => k.loi),
      [],
    );
  });

  describe('mục Thêm dòng', () => {
    const DAC_TA =
      '# 14. ĐẶC TẢ\n\n## 3. Màn hình\n\n| Mã | Tên | Ghi chú |\n|---|---|---|\n| MH-348 | Cũ | |\n| MH-349 | Cũ hơn | |\n\n## 4. Khác\n\n| Mã | Tên | Ghi chú |\n|---|---|---|\n| MH-900 | Khác | |\n';
    const themDong = (...dong) => ['', '## Thêm dòng', '', ...dong].join('\n');

    beforeEach(() => writeFileSync(join(thuMuc, '14_DAC_TA_GIAO_DIEN.md'), DAC_TA));

    it('chèn sau dòng neo và cuối bảng theo thứ tự merge, giữ nguyên dòng mới, điền phiên bản', () => {
      ghiManh(
        'YCTD-253-hoc-phi.md',
        tepManh({
          so: 253,
          ten: 'Học phí',
          them: themDong(
            '| 14_DAC_TA_GIAO_DIEN.md | MH-348 | MH-360 | Thu phí ({PHIEN_BAN}) | a \\| b |',
            '| 14_DAC_TA_GIAO_DIEN.md | MH-348 | MH-361 | Thu phí 2 | |',
            '| 14_DAC_TA_GIAO_DIEN.md | cuối bảng 3. Màn hình | MH-362 | Cuối 1 | |',
          ),
        }),
      );
      ghiManh(
        'YCTD-254-khoa-hoc.md',
        tepManh({
          so: 254,
          ten: 'Khoá học',
          them: themDong(
            '| 14_DAC_TA_GIAO_DIEN.md | MH-348 | MH-370 | Khoá học | |',
            '| 14_DAC_TA_GIAO_DIEN.md | cuối bảng 3. Màn hình | MH-371 | Cuối 2 | |',
          ),
        }),
      );
      const thuTu = ['YCTD-253', 'YCTD-254'];
      const sapXep = (tep) =>
        [...tep].sort((a, b) => thuTu.findIndex((t) => a.includes(t)) - thuTu.findIndex((t) => b.includes(t)));
      assert.deepEqual(kiemThuMuc(thuMuc).loi, []);
      gomThayDoi({ thuMuc, ngay: '2026-10-28', sapXep });

      const bang = doc('14_DAC_TA_GIAO_DIEN.md')
        .split('\n')
        .filter((d) => d.startsWith('| MH-'));
      assert.deepEqual(bang, [
        '| MH-348 | Cũ | |',
        '| MH-360 | Thu phí (0.145.0) | a \\| b |',
        '| MH-361 | Thu phí 2 | |',
        '| MH-370 | Khoá học | |',
        '| MH-349 | Cũ hơn | |',
        '| MH-362 | Cuối 1 | |',
        '| MH-371 | Cuối 2 | |',
        '| MH-900 | Khác | |',
      ]);
    });

    it('chế độ kiểm báo neo không có, sai số ô, trùng mã dòng', () => {
      const loi = (dong) =>
        kiemTepManh(docTepManh('YCTD-253-x.md', tepManh({ so: 253, ten: 'X', them: themDong(dong) })), {
          ...TAI_LIEU,
          '14_DAC_TA_GIAO_DIEN.md': DAC_TA,
        }).join('\n');
      assert.equal(loi('| 14_DAC_TA_GIAO_DIEN.md | MH-349 | MH-360 | Mới | |'), '');
      assert.match(loi('| 14_DAC_TA_GIAO_DIEN.md | MH-347 | MH-360 | Mới | |'), /không có dòng bảng "MH-347"/);
      assert.match(
        loi('| 14_DAC_TA_GIAO_DIEN.md | cuối bảng 9. Không có | MH-360 | Mới | |'),
        /không có bảng sau tiêu đề/,
      );
      assert.match(loi('| 14_DAC_TA_GIAO_DIEN.md | MH-349 | MH-360 | Mới |'), /dòng mới có 2 ô, bảng .* có 3 ô/);
      assert.match(loi('| 14_DAC_TA_GIAO_DIEN.md | MH-349 | MH-348 | Trùng | |'), /đã có dòng "MH-348"/);
      assert.match(loi('| 99_KHONG_CO.md | MH-349 | MH-360 | Mới | |'), /không có tệp tai_lieu\/99_KHONG_CO\.md/);
      assert.match(loi('| 14_DAC_TA_GIAO_DIEN.md | MH-349 |'), /phải dạng/);
    });

    it('chế độ kiểm báo hai tệp mảnh thêm cùng một mã dòng', () => {
      ghiManh(
        'YCTD-253-mot.md',
        tepManh({ so: 253, ten: 'Một', them: themDong('| 14_DAC_TA_GIAO_DIEN.md | MH-349 | MH-360 | Một | |') }),
      );
      ghiManh(
        'YCTD-254-hai.md',
        tepManh({ so: 254, ten: 'Hai', them: themDong('| 14_DAC_TA_GIAO_DIEN.md | MH-348 | MH-360 | Hai | |') }),
      );
      const { loi } = kiemThuMuc(thuMuc);
      assert.match(loi.map((k) => k.loi.join('; ')).join('\n'), /"MH-360" ở 14_DAC_TA_GIAO_DIEN\.md trùng với tệp/);
    });
  });
});
