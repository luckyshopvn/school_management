import { randomInt } from 'node:crypto';

// Mật khẩu tạm 12 ký tự, có chữ và số, bỏ các ký tự dễ nhầm như O, 0, l, 1 (PQ-14)
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';
const ALL = LETTERS + DIGITS;

export function generateTemporaryPassword(): string {
  const characters = [LETTERS[randomInt(LETTERS.length)], DIGITS[randomInt(DIGITS.length)]];
  while (characters.length < 12) {
    characters.push(ALL[randomInt(ALL.length)]);
  }
  for (let index = characters.length - 1; index > 0; index--) {
    const swapIndex = randomInt(index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }
  return characters.join('');
}
