import { CARD_ANSWERS, CARD_CELLS, cardPattern } from './answer-card.ts';

// Bản in thẻ đáp án giấy (DT-23 phần 23c, YCTD-213): khổ A4, 12 thẻ một trang (3 x 4) hoặc một thẻ một trang; mỗi thẻ in số thứ tự
// trong lớp (không in họ tên), chữ A ở cạnh trên, B cạnh phải, C cạnh dưới, D cạnh trái. Mẫu thẻ do dự án tự thiết kế
export const CARDS_PER_PAGE = 12;

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string,
  );
}

// Hình thẻ dạng SVG (đơn vị mm): ô đen theo mẫu, bốn chữ đáp án quay về phía cạnh của mình
export function cardSvg(number: number, sizeMm = 50): string {
  const grid = cardPattern(number);
  const margin = sizeMm * 0.18;
  const cell = (sizeMm - margin * 2) / CARD_CELLS;
  const cells = grid
    .flatMap((row, r) =>
      row.map((black, c) =>
        black
          ? `<rect x="${(margin + c * cell).toFixed(2)}" y="${(margin + r * cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}"/>`
          : '',
      ),
    )
    .join('');
  const center = sizeMm / 2;
  const edge = margin / 2;
  const font = (margin * 0.75).toFixed(2);
  const letters = CARD_ANSWERS.map((letter, index) => {
    const rotate = index * 90;
    return `<text x="${center}" y="${edge}" font-size="${font}" text-anchor="middle" dominant-baseline="central" transform="rotate(${rotate} ${center} ${center})">${letter}</text>`;
  }).join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${sizeMm}mm" height="${sizeMm}mm" viewBox="0 0 ${sizeMm} ${sizeMm}" aria-label="Thẻ số ${number}">` +
    `<g fill="#000">${cells}</g><g font-family="Arial, sans-serif" font-weight="700" fill="#000">${letters}</g>` +
    `<text x="${(sizeMm - margin * 0.4).toFixed(2)}" y="${(sizeMm - margin * 0.25).toFixed(2)}" font-size="${(margin * 0.45).toFixed(2)}" text-anchor="end" font-family="Arial, sans-serif" fill="#555">${number}</text>` +
    `</svg>`
  );
}

// Trang in hoàn chỉnh: thẻ theo số thứ tự từ 1 đến `count`
export function cardSheetHtml(options: { className: string; count: number; perPage: 1 | 12 }): string {
  const numbers = Array.from({ length: Math.max(0, Math.min(options.count, 99)) }, (_, index) => index + 1);
  const pages: number[][] = [];
  for (let index = 0; index < numbers.length; index += options.perPage) {
    pages.push(numbers.slice(index, index + options.perPage));
  }
  const size = options.perPage === 1 ? 150 : 55;
  const body = pages
    .map(
      (page) =>
        `<section class="page">${page
          .map(
            (number) => `<figure class="card">${cardSvg(number, size)}<figcaption>Số ${number}</figcaption></figure>`,
          )
          .join('')}</section>`,
    )
    .join('');
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Thẻ đáp án lớp ${escapeHtml(options.className)}</title>
<style>
@page { size: A4 portrait; margin: 10mm; }
body { margin: 0; font-family: Arial, sans-serif; }
h1 { font-size: 14pt; margin: 0 0 4mm; }
.page { display: grid; grid-template-columns: repeat(${options.perPage === 1 ? 1 : 3}, 1fr); gap: 6mm; page-break-after: always; justify-items: center; }
.card { margin: 0; display: flex; flex-direction: column; align-items: center; }
figcaption { font-size: 9pt; color: #555; }
@media screen { body { padding: 10mm; } }
</style></head><body><h1>Thẻ đáp án lớp ${escapeHtml(options.className)}: giơ thẻ với chữ đáp án ở phía trên</h1>${body}</body></html>`;
}
