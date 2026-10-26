import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CARD_ANSWERS, cardHeldAs, cardPattern, decodeCard, MAX_CARD_NUMBER, rotateClockwise } from './answer-card.ts';
import { mergeScans, otsuThreshold, scanCards, type GrayImage } from './card-scanner.ts';
import {
  addScore,
  buildCrossword,
  crosswordCells,
  crosswordConflicts,
  crosswordWord,
  planRounds,
  ranking,
  roundPoints,
  spinTarget,
  wheelIndexAt,
} from './game-logic.ts';

// Trò chơi kiến thức và thẻ đáp án giấy (DT-23 phần 23c, YCTD-213), kịch bản CT-23c-1 đến CT-23c-3: phần thuần chạy với nguồn ngẫu
// nhiên cố định; ảnh thẻ là ảnh tổng hợp vẽ trong kiểm thử (không có ảnh thật của học sinh)
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe('ô chữ, vòng quay, hỏi đáp theo vòng', () => {
  it('CT-23c-1: từ của ô chữ bỏ dấu; lưới giao nhau đúng chữ; số thứ tự theo vị trí; từ không xếp được báo lại', () => {
    assert.equal(crosswordWord('Đồng bằng sông Cửu Long'), 'DONGBANGSONGCUULONG');
    assert.equal(crosswordWord('  ô-xi '), 'OXI');
    const items = [
      { question_id: 'q1', clue: 'Thủ đô của Việt Nam', answer: 'Hà Nội' },
      { question_id: 'q2', clue: 'Chất khí con người hít vào', answer: 'Ô xi' },
      { question_id: 'q3', clue: 'Số nguyên tố chẵn duy nhất', answer: 'hai' },
      { question_id: 'q4', clue: 'Hành tinh đỏ', answer: 'Hỏa tinh' },
      { question_id: 'q5', clue: 'Không có chữ chung', answer: 'xyz' },
    ];
    const crossword = buildCrossword(items, seeded(3));
    assert.ok(crossword.entries.length >= 3, JSON.stringify(crossword));
    assert.ok(crossword.skipped.includes('q5'));
    assert.deepEqual(crosswordConflicts(crossword), []);
    const cells = crosswordCells(crossword);
    for (const entry of crossword.entries) {
      const letters = [...entry.word].map(
        (_, index) =>
          cells[entry.row + (entry.direction === 'down' ? index : 0)]?.[
            entry.col + (entry.direction === 'across' ? index : 0)
          ]?.letter,
      );
      assert.equal(letters.join(''), entry.word);
      assert.equal(cells[entry.row]?.[entry.col]?.number, entry.number);
    }
    // Giáo viên sửa tay làm hai từ chồng sai chữ: báo xung đột
    const edited = {
      ...crossword,
      entries: crossword.entries.map((entry, index) =>
        index === 1 ? { ...entry, word: 'Z'.repeat(entry.word.length) } : entry,
      ),
    };
    assert.ok(crosswordConflicts(edited).length >= 2);
  });

  it('CT-23c-2: vòng quay dừng đúng ô đã bốc; vòng hỏi đáp chia đều, điểm tăng theo vòng, xếp hạng cùng điểm cùng hạng', () => {
    const random = seeded(11);
    let angle = 0;
    for (let index = 0; index < 50; index += 1) {
      const size = 2 + (index % 9);
      const spin = spinTarget(angle, size, random);
      assert.ok(spin.angle - angle >= 360 * 3);
      assert.equal(wheelIndexAt(spin.angle, size), spin.index);
      angle = spin.angle;
    }
    const plan = planRounds(['a', 'b', 'c', 'd', 'e', 'f', 'g'], 3);
    assert.deepEqual(
      plan.map((round) => round.question_ids.length),
      [3, 2, 2],
    );
    assert.equal(roundPoints(3, 1, true), 3);
    assert.equal(roundPoints(3, 2, false), 2);
    let scores = addScore({}, 'Nhóm 1', 3);
    scores = addScore(scores, 'Nhóm 2', 3);
    scores = addScore(scores, 'Nhóm 3', 1);
    assert.deepEqual(
      ranking(scores).map((row) => [row.group, row.rank]),
      [
        ['Nhóm 1', 1],
        ['Nhóm 2', 1],
        ['Nhóm 3', 3],
      ],
    );
  });
});

// Vẽ thẻ vào ảnh xám: mỗi ô `cell` điểm ảnh, nền trắng, nhiễu nhẹ
function render(
  cards: Array<{ grid: boolean[][]; x: number; y: number }>,
  width: number,
  height: number,
  cell: number,
  random: () => number,
): GrayImage {
  const data = new Uint8Array(width * height).fill(235);
  for (const card of cards) {
    card.grid.forEach((row, r) =>
      row.forEach((black, c) => {
        if (!black) return;
        for (let y = 0; y < cell; y += 1) {
          for (let x = 0; x < cell; x += 1) {
            data[(card.y + r * cell + y) * width + card.x + c * cell + x] = 25;
          }
        }
      }),
    );
  }
  for (let index = 0; index < data.length; index += 1) {
    data[index] = Math.max(0, Math.min(255, (data[index] as number) + Math.round((random() - 0.5) * 40)));
  }
  return { width, height, data };
}

describe('thẻ đáp án giấy', () => {
  it('CT-23c-3: mọi số thẻ giải mã đúng ở cả bốn đáp án; thẻ hỏng hoặc không phải thẻ bị bỏ qua', () => {
    for (let number = 1; number <= MAX_CARD_NUMBER; number += 1) {
      for (const answer of CARD_ANSWERS) {
        assert.deepEqual(decodeCard(cardHeldAs(number, answer)), { number, answer });
      }
    }
    assert.throws(() => cardPattern(0));
    assert.throws(() => cardPattern(MAX_CARD_NUMBER + 1));
    // Đảo một ô dữ liệu: bit kiểm tra không khớp
    const broken = cardPattern(42).map((row) => [...row]);
    (broken[2] as boolean[])[2] = !(broken[2] as boolean[])[2];
    assert.equal(decodeCard(broken), null);
    // Ô toàn đen, toàn trắng
    assert.equal(decodeCard(Array.from({ length: 6 }, () => Array<boolean>(6).fill(true))), null);
    assert.equal(decodeCard(Array.from({ length: 6 }, () => Array<boolean>(6).fill(false))), null);
    assert.deepEqual(
      rotateClockwise(rotateClockwise(rotateClockwise(rotateClockwise(cardPattern(7))))),
      cardPattern(7),
    );
  });

  it('CT-23c-3: đọc nhiều thẻ trong một khung hình có nhiễu, mỗi thẻ một hướng; gộp khung sau đè khung trước', () => {
    const random = seeded(5);
    const held = [
      { number: 1, answer: 'A' as const },
      { number: 12, answer: 'B' as const },
      { number: 27, answer: 'C' as const },
      { number: 35, answer: 'D' as const },
      { number: 99, answer: 'B' as const },
    ];
    const cell = 7;
    const image = render(
      held.map((card, index) => ({
        grid: cardHeldAs(card.number, card.answer),
        x: 10 + (index % 3) * 70,
        y: 10 + Math.floor(index / 3) * 70,
      })),
      230,
      160,
      cell,
      random,
    );
    const threshold = otsuThreshold(image);
    assert.ok(threshold > 40 && threshold < 220, String(threshold));
    const scanned = scanCards(image);
    assert.deepEqual(
      scanned.map((card) => [card.number, card.answer]),
      held.map((card) => [card.number, card.answer]),
    );
    const merged = mergeScans({ 12: 'A', 50: 'C' }, scanned);
    assert.equal(merged[12], 'B', 'lần giơ sau đè lần trước');
    assert.equal(merged[50], 'C');
  });
});
