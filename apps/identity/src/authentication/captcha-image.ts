import { randomInt } from 'node:crypto';
import { deflateSync } from 'node:zlib';

// Ảnh mã xác nhận tự sinh ở máy chủ, không dùng dịch vụ bên ngoài (DT-16 phần 16c). Mỗi ký tự vẽ bằng các nét trên lưới
// 4 x 6, xoay và dịch ngẫu nhiên, thêm đường nhiễu và chấm nhiễu, rồi mã hóa thành ảnh PNG. Ảnh là điểm ảnh nên không
// đọc được đáp án từ mã nguồn của ảnh như ảnh SVG. Bộ ký tự bỏ các ký tự dễ nhầm (0, O, 1, I, B, 8, S, G, Q, D, Z)
type Stroke = Array<[number, number]>;

const GLYPHS: Record<string, Stroke[]> = {
  '2': [
    [
      [0, 1],
      [1, 0],
      [3, 0],
      [4, 1],
      [4, 2],
      [0, 6],
      [4, 6],
    ],
  ],
  '3': [
    [
      [0, 0],
      [4, 0],
      [2, 2.5],
      [3.5, 3],
      [4, 4.5],
      [3, 6],
      [0, 6],
    ],
  ],
  '4': [
    [
      [3, 6],
      [3, 0],
      [0, 4],
      [4, 4],
    ],
  ],
  '5': [
    [
      [4, 0],
      [0, 0],
      [0, 3],
      [3, 3],
      [4, 4],
      [4, 5],
      [3, 6],
      [0, 6],
    ],
  ],
  '6': [
    [
      [4, 0],
      [1, 0],
      [0, 1],
      [0, 5],
      [1, 6],
      [3, 6],
      [4, 5],
      [4, 4],
      [3, 3],
      [0, 3],
    ],
  ],
  '7': [
    [
      [0, 0],
      [4, 0],
      [1.5, 6],
    ],
  ],
  '9': [
    [
      [4, 3],
      [1, 3],
      [0, 2],
      [0, 1],
      [1, 0],
      [3, 0],
      [4, 1],
      [4, 6],
      [0, 6],
    ],
  ],
  A: [
    [
      [0, 6],
      [2, 0],
      [4, 6],
    ],
    [
      [1, 3.5],
      [3, 3.5],
    ],
  ],
  C: [
    [
      [4, 0],
      [1, 0],
      [0, 1],
      [0, 5],
      [1, 6],
      [4, 6],
    ],
  ],
  E: [
    [
      [4, 0],
      [0, 0],
      [0, 6],
      [4, 6],
    ],
    [
      [0, 3],
      [3, 3],
    ],
  ],
  F: [
    [
      [4, 0],
      [0, 0],
      [0, 6],
    ],
    [
      [0, 3],
      [3, 3],
    ],
  ],
  H: [
    [
      [0, 0],
      [0, 6],
    ],
    [
      [4, 0],
      [4, 6],
    ],
    [
      [0, 3],
      [4, 3],
    ],
  ],
  K: [
    [
      [0, 0],
      [0, 6],
    ],
    [
      [4, 0],
      [0, 3.5],
    ],
    [
      [1.5, 2.5],
      [4, 6],
    ],
  ],
  L: [
    [
      [0, 0],
      [0, 6],
      [4, 6],
    ],
  ],
  M: [
    [
      [0, 6],
      [0, 0],
      [2, 3],
      [4, 0],
      [4, 6],
    ],
  ],
  N: [
    [
      [0, 6],
      [0, 0],
      [4, 6],
      [4, 0],
    ],
  ],
  P: [
    [
      [0, 6],
      [0, 0],
      [3, 0],
      [4, 1],
      [4, 2],
      [3, 3],
      [0, 3],
    ],
  ],
  R: [
    [
      [0, 6],
      [0, 0],
      [3, 0],
      [4, 1],
      [4, 2],
      [3, 3],
      [0, 3],
    ],
    [
      [2, 3],
      [4, 6],
    ],
  ],
  T: [
    [
      [0, 0],
      [4, 0],
    ],
    [
      [2, 0],
      [2, 6],
    ],
  ],
  U: [
    [
      [0, 0],
      [0, 5],
      [1, 6],
      [3, 6],
      [4, 5],
      [4, 0],
    ],
  ],
  V: [
    [
      [0, 0],
      [2, 6],
      [4, 0],
    ],
  ],
  W: [
    [
      [0, 0],
      [1, 6],
      [2, 3],
      [3, 6],
      [4, 0],
    ],
  ],
  X: [
    [
      [0, 0],
      [4, 6],
    ],
    [
      [4, 0],
      [0, 6],
    ],
  ],
  Y: [
    [
      [0, 0],
      [2, 3],
      [4, 0],
    ],
    [
      [2, 3],
      [2, 6],
    ],
  ],
};

export const CAPTCHA_ALPHABET = Object.keys(GLYPHS).join('');
export const CAPTCHA_LENGTH = 5;
const WIDTH = 170;
const HEIGHT = 56;

export function randomCaptchaText(length = CAPTCHA_LENGTH): string {
  return Array.from({ length }, () => CAPTCHA_ALPHABET[randomInt(0, CAPTCHA_ALPHABET.length)]).join('');
}

class Canvas {
  readonly pixels = new Uint8Array(WIDTH * HEIGHT * 3);

  constructor(background: [number, number, number]) {
    for (let index = 0; index < WIDTH * HEIGHT; index++) {
      this.pixels.set(background, index * 3);
    }
  }

  dot(x: number, y: number, radius: number, color: [number, number, number]): void {
    for (let dy = Math.floor(-radius); dy <= Math.ceil(radius); dy++) {
      for (let dx = Math.floor(-radius); dx <= Math.ceil(radius); dx++) {
        const px = Math.round(x + dx);
        const py = Math.round(y + dy);
        if (px >= 0 && px < WIDTH && py >= 0 && py < HEIGHT && dx * dx + dy * dy <= radius * radius) {
          this.pixels.set(color, (py * WIDTH + px) * 3);
        }
      }
    }
  }

  line(x1: number, y1: number, x2: number, y2: number, radius: number, color: [number, number, number]): void {
    const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 2));
    for (let step = 0; step <= steps; step++) {
      const ratio = step / steps;
      this.dot(x1 + (x2 - x1) * ratio, y1 + (y2 - y1) * ratio, radius, color);
    }
  }
}

function jitter(range: number): number {
  return (randomInt(0, 2001) / 1000 - 1) * range;
}

function darkColor(): [number, number, number] {
  return [randomInt(10, 90), randomInt(20, 90), randomInt(60, 140)];
}

// Vẽ chuỗi ký tự thành ảnh PNG; ký tự không có trong bộ ký tự bị bỏ qua
export function renderCaptchaPng(text: string): Buffer {
  const canvas = new Canvas([randomInt(225, 246), randomInt(230, 248), randomInt(235, 250)]);
  for (let index = 0; index < 140; index++) {
    canvas.dot(randomInt(0, WIDTH), randomInt(0, HEIGHT), 0.8, [randomInt(120, 200), randomInt(120, 200), randomInt(120, 200)]);
  }
  const cellWidth = (WIDTH - 16) / text.length;
  [...text].forEach((character, index) => {
    const strokes = GLYPHS[character];
    if (!strokes) {
      return;
    }
    const scale = 5.5 + jitter(0.8);
    const angle = jitter(0.35);
    const centerX = 8 + cellWidth * (index + 0.5) + jitter(3);
    const centerY = HEIGHT / 2 + jitter(4);
    const color = darkColor();
    const transform = ([x, y]: [number, number]): [number, number] => {
      const localX = (x - 2) * scale;
      const localY = (y - 3) * scale;
      return [
        centerX + localX * Math.cos(angle) - localY * Math.sin(angle),
        centerY + localX * Math.sin(angle) + localY * Math.cos(angle),
      ];
    };
    for (const stroke of strokes) {
      for (let point = 1; point < stroke.length; point++) {
        const [x1, y1] = transform(stroke[point - 1] as [number, number]);
        const [x2, y2] = transform(stroke[point] as [number, number]);
        canvas.line(x1, y1, x2, y2, 1.7, color);
      }
    }
  });
  // Đường nhiễu cắt qua chữ
  for (let index = 0; index < 4; index++) {
    canvas.line(
      randomInt(0, Math.floor(WIDTH / 3)),
      randomInt(0, HEIGHT),
      randomInt(Math.floor((WIDTH * 2) / 3), WIDTH),
      randomInt(0, HEIGHT),
      0.7,
      darkColor(),
    );
  }
  return encodePng(canvas.pixels, WIDTH, HEIGHT);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
}

// Ảnh PNG màu RGB 8 bit, mỗi dòng có byte lọc 0
function encodePng(pixels: Uint8Array, width: number, height: number): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let row = 0; row < height; row++) {
    raw[row * (width * 3 + 1)] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + row * width * 3, width * 3).copy(raw, row * (width * 3 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
