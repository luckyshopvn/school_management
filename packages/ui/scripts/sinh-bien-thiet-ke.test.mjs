// Kiểm thử nguồn biến thiết kế (YCTD-384): tệp sinh khớp tokens.json; mọi cặp chữ, nền đạt tương phản WCAG 2.1 AA ở cả chế độ
// sáng và tối (AC-1202): chữ 4,5:1, viền ô nhập 3:1 (WCAG 1.4.11)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { docNguon, sinhBien, sinhTailwind, TEP_BIEN, TEP_TAILWIND } from './sinh-bien-thiet-ke.mjs';

const nguon = docNguon();

function doSang(hex) {
  const kenh = hex
    .slice(1)
    .match(/../g)
    .map((cap) => parseInt(cap, 16) / 255)
    .map((giaTri) => (giaTri <= 0.03928 ? giaTri / 12.92 : ((giaTri + 0.055) / 1.055) ** 2.4));
  return 0.2126 * kenh[0] + 0.7152 * kenh[1] + 0.0722 * kenh[2];
}
function tuongPhan(mot, hai) {
  const [sang, toi] = [doSang(mot), doSang(hai)].sort((a, b) => b - a);
  return (sang + 0.05) / (toi + 0.05);
}

// Cặp [chữ hoặc viền, nền, ngưỡng]
const CAP_PHONG_CACH = [
  ['chu', 'nen-trang', 4.5],
  ['chu', 'the', 4.5],
  ['chu-phu', 'nen-trang', 4.5],
  ['chu-phu', 'the', 4.5],
  ['vien-o-nhap', 'the', 3],
  ['vien-o-nhap', 'nen-trang', 3],
];
const CAP_NHAN = [
  ['chu-tren-nhan', 'nhan', 4.5],
  ['nhan-dam', 'nhan-nhat', 4.5],
  ['nhan-dam', 'the', 4.5],
  ['nhan', 'the', 3],
];
const CAP_THANH_BEN = [
  ['chu-thanh-ben', 'thanh-ben', 4.5],
  ['chu-phu-thanh-ben', 'thanh-ben', 4.5],
  ['chu-chon-thanh-ben', 'chon-thanh-ben', 4.5],
];
const TRANG_THAI = ['thanh-cong', 'canh-bao', 'nguy-hiem', 'thong-tin', 'trung-tinh'];

describe('nguồn biến thiết kế', () => {
  it('tệp đã sinh khớp tokens.json', () => {
    assert.equal(
      readFileSync(TEP_BIEN, 'utf8'),
      sinhBien(nguon),
      'chạy node packages/ui/scripts/sinh-bien-thiet-ke.mjs',
    );
    assert.equal(
      readFileSync(TEP_TAILWIND, 'utf8'),
      sinhTailwind(nguon),
      'chạy node packages/ui/scripts/sinh-bien-thiet-ke.mjs',
    );
  });

  for (const cheDo of ['sang', 'toi']) {
    it(`màu trạng thái đạt tương phản ở chế độ ${cheDo}`, () => {
      for (const ten of TRANG_THAI) {
        const chu = nguon.chung.mau[ten][cheDo];
        const nen = nguon.chung.mau[`${ten}-nen`][cheDo];
        assert.ok(tuongPhan(chu, nen) >= 4.5, `${ten} trên nền nhạt ${cheDo}: ${tuongPhan(chu, nen).toFixed(2)}`);
      }
    });

    it(`phong cách hành chính đạt tương phản ở chế độ ${cheDo}`, () => {
      const bang = nguon['phong-cach']['hanh-chinh'].mau;
      for (const [chu, nen, nguong] of [...CAP_PHONG_CACH, ...CAP_NHAN, ...CAP_THANH_BEN]) {
        const giaTri = tuongPhan(bang[chu][cheDo], bang[nen][cheDo]);
        assert.ok(giaTri >= nguong, `${chu} trên ${nen} (${cheDo}): ${giaTri.toFixed(2)} < ${nguong}`);
      }
    });

    it(`phong cách theo vai và từng vai đạt tương phản ở chế độ ${cheDo}`, () => {
      const bang = nguon['phong-cach']['theo-vai'].mau;
      for (const [chu, nen, nguong] of CAP_PHONG_CACH) {
        const giaTri = tuongPhan(bang[chu][cheDo], bang[nen][cheDo]);
        assert.ok(giaTri >= nguong, `${chu} trên ${nen} (${cheDo}): ${giaTri.toFixed(2)} < ${nguong}`);
      }
      for (const [ten, mauVai] of Object.entries(nguon.vai)) {
        const gop = { ...bang, ...mauVai };
        for (const [chu, nen, nguong] of CAP_NHAN) {
          const giaTri = tuongPhan(gop[chu][cheDo], gop[nen][cheDo]);
          assert.ok(giaTri >= nguong, `vai ${ten}: ${chu} trên ${nen} (${cheDo}): ${giaTri.toFixed(2)} < ${nguong}`);
        }
      }
    });
  }

  it('cỡ chữ không nhỏ hơn 14 điểm ảnh và chữ ô nhập 16 điểm ảnh (Q-89, TN-04)', () => {
    for (const [ten, giaTri] of Object.entries(nguon.chung['co-chu'])) {
      assert.ok(parseFloat(giaTri) * 16 >= 14, `cỡ chữ ${ten} = ${giaTri}`);
    }
    assert.equal(parseFloat(nguon.chung['co-chu']['o-nhap']) * 16, 16);
    assert.equal(parseFloat(nguon.chung['vung-cham']) * 16, 44);
  });
});
