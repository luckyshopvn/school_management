// Bộ tính biểu thức của máy tính khoa học và vẽ đồ thị (DT-29 phần 29d, YCTD-328): tự viết, không dùng eval hay Function. Hỗ trợ
// số (dấu chấm hoặc dấu phẩy thập phân), + − × ÷ ^, ngoặc, dấu trừ một ngôi, nhân ngầm (2x, 2(3), 2π), hằng π và e, biến x, hàm
// sin cos tan (theo độ hoặc radian), asin acos atan, sqrt (√), cbrt, ln, log (cơ số 10), abs, phần trăm và giai thừa (!).
// Không import gì để kiểm thử bằng node --test

export type AngleUnit = 'deg' | 'rad';

type Token =
  | { kind: 'number'; value: number }
  | { kind: 'name'; value: string }
  | { kind: 'operator'; value: '+' | '-' | '*' | '/' | '^' | '!' | '%' }
  | { kind: 'open' }
  | { kind: 'close' };

export class ExpressionError extends Error {}

const FUNCTIONS = new Set(['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sqrt', 'cbrt', 'ln', 'log', 'abs']);
const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

function tokenize(source: string): Token[] {
  const text = source
    .replace(/[×·]/g, '*')
    .replace(/[÷:]/g, '/')
    .replace(/[−–]/g, '-')
    .replace(/π/g, 'pi')
    .replace(/√/g, 'sqrt')
    .toLowerCase();
  const tokens: Token[] = [];
  let index = 0;
  while (index < text.length) {
    const character = text[index] ?? '';
    if (/\s/.test(character)) {
      index += 1;
      continue;
    }
    if (/[0-9.,]/.test(character)) {
      let end = index;
      while (end < text.length && /[0-9.,]/.test(text[end] ?? '')) {
        end += 1;
      }
      const raw = text.slice(index, end).replace(',', '.');
      if (!/^(\d+\.?\d*|\.\d+)$/.test(raw)) {
        throw new ExpressionError(`Số không hợp lệ: ${text.slice(index, end)}`);
      }
      tokens.push({ kind: 'number', value: Number(raw) });
      index = end;
      continue;
    }
    if (/[a-z]/.test(character)) {
      let end = index;
      while (end < text.length && /[a-z]/.test(text[end] ?? '')) {
        end += 1;
      }
      const word = text.slice(index, end);
      // Tách "xpi", "2sinx" thành tên đã biết, đọc từ trái sang phải
      let position = 0;
      while (position < word.length) {
        const rest = word.slice(position);
        const match = [...FUNCTIONS, 'pi', 'e', 'x']
          .sort((left, right) => right.length - left.length)
          .find((name) => rest.startsWith(name));
        if (!match) {
          throw new ExpressionError(`Không hiểu "${rest}"`);
        }
        tokens.push({ kind: 'name', value: match });
        position += match.length;
      }
      index = end;
      continue;
    }
    if ('+-*/^!%'.includes(character)) {
      tokens.push({ kind: 'operator', value: character as '+' });
      index += 1;
      continue;
    }
    if (character === '(') {
      tokens.push({ kind: 'open' });
      index += 1;
      continue;
    }
    if (character === ')') {
      tokens.push({ kind: 'close' });
      index += 1;
      continue;
    }
    throw new ExpressionError(`Không hiểu kí tự "${character}"`);
  }
  return tokens;
}

function factorial(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 170) {
    throw new ExpressionError('Giai thừa chỉ cho số nguyên từ 0 đến 170');
  }
  let result = 1;
  for (let factor = 2; factor <= value; factor += 1) {
    result *= factor;
  }
  return result;
}

// Phân tích đệ quy theo độ ưu tiên: cộng trừ < nhân chia (kể cả nhân ngầm) < dấu một ngôi < luỹ thừa (kết hợp phải) < hậu tố
class Parser {
  private position = 0;
  private readonly tokens: Token[];
  private readonly variables: { x?: number };
  private readonly unit: AngleUnit;

  // Không dùng tham số kiểu private readonly ở hàm dựng: Node chạy kiểm thử chỉ bỏ kiểu, không chuyển mã
  constructor(tokens: Token[], variables: { x?: number }, unit: AngleUnit) {
    this.tokens = tokens;
    this.variables = variables;
    this.unit = unit;
  }

  parse(): number {
    if (this.tokens.length === 0) {
      throw new ExpressionError('Chưa nhập biểu thức');
    }
    const value = this.sum();
    if (this.position < this.tokens.length) {
      throw new ExpressionError('Biểu thức thừa phần cuối');
    }
    return value;
  }

  private peek(): Token | undefined {
    return this.tokens[this.position];
  }

  private sum(): number {
    let value = this.product();
    for (;;) {
      const token = this.peek();
      if (token?.kind === 'operator' && (token.value === '+' || token.value === '-')) {
        this.position += 1;
        const right = this.product();
        value = token.value === '+' ? value + right : value - right;
      } else {
        return value;
      }
    }
  }

  private startsFactor(token: Token | undefined): boolean {
    return token?.kind === 'number' || token?.kind === 'name' || token?.kind === 'open';
  }

  private product(): number {
    let value = this.unary();
    for (;;) {
      const token = this.peek();
      if (token?.kind === 'operator' && (token.value === '*' || token.value === '/')) {
        this.position += 1;
        const right = this.unary();
        if (token.value === '/' && right === 0) {
          throw new ExpressionError('Không chia được cho 0');
        }
        value = token.value === '*' ? value * right : value / right;
      } else if (this.startsFactor(token)) {
        value *= this.unary();
      } else {
        return value;
      }
    }
  }

  private unary(): number {
    const token = this.peek();
    if (token?.kind === 'operator' && (token.value === '-' || token.value === '+')) {
      this.position += 1;
      const value = this.unary();
      return token.value === '-' ? -value : value;
    }
    return this.power();
  }

  private power(): number {
    const base = this.postfix();
    const token = this.peek();
    if (token?.kind === 'operator' && token.value === '^') {
      this.position += 1;
      return base ** this.unary();
    }
    return base;
  }

  private postfix(): number {
    let value = this.primary();
    for (;;) {
      const token = this.peek();
      if (token?.kind === 'operator' && token.value === '!') {
        this.position += 1;
        value = factorial(value);
      } else if (token?.kind === 'operator' && token.value === '%') {
        this.position += 1;
        value /= 100;
      } else {
        return value;
      }
    }
  }

  private primary(): number {
    const token = this.peek();
    if (!token) {
      throw new ExpressionError('Biểu thức thiếu phần cuối');
    }
    this.position += 1;
    if (token.kind === 'number') {
      return token.value;
    }
    if (token.kind === 'open') {
      const value = this.sum();
      if (this.peek()?.kind !== 'close') {
        throw new ExpressionError('Thiếu dấu đóng ngoặc');
      }
      this.position += 1;
      return value;
    }
    if (token.kind === 'name') {
      if (token.value === 'x') {
        if (this.variables.x === undefined) {
          throw new ExpressionError('Biểu thức có biến x');
        }
        return this.variables.x;
      }
      const constant = CONSTANTS[token.value];
      if (constant !== undefined) {
        return constant;
      }
      // Đối số là một thừa số (sin 30, sin(30)); luỹ thừa sau đó áp cho kết quả của hàm: sin(30)^2 = (sin 30)^2
      return this.call(token.value, this.postfix());
    }
    throw new ExpressionError('Biểu thức không đúng');
  }

  private call(name: string, argument: number): number {
    const toRadians = (value: number) => (this.unit === 'deg' ? (value * Math.PI) / 180 : value);
    const fromRadians = (value: number) => (this.unit === 'deg' ? (value * 180) / Math.PI : value);
    // Làm tròn để sin 180°, cos 90° ra đúng 0
    const clean = (value: number) => (Math.abs(value) < 1e-12 ? 0 : value);
    switch (name) {
      case 'sin':
        return clean(Math.sin(toRadians(argument)));
      case 'cos':
        return clean(Math.cos(toRadians(argument)));
      case 'tan': {
        if (this.unit === 'deg' && Math.abs((((argument % 180) + 180) % 180) - 90) < 1e-9) {
          throw new ExpressionError('tan không xác định tại góc này');
        }
        return clean(Math.tan(toRadians(argument)));
      }
      case 'asin':
      case 'acos': {
        if (argument < -1 || argument > 1) {
          throw new ExpressionError(`${name} chỉ nhận giá trị từ −1 đến 1`);
        }
        return fromRadians(name === 'asin' ? Math.asin(argument) : Math.acos(argument));
      }
      case 'atan':
        return fromRadians(Math.atan(argument));
      case 'sqrt':
        if (argument < 0) {
          throw new ExpressionError('Không lấy căn bậc hai của số âm');
        }
        return Math.sqrt(argument);
      case 'cbrt':
        return Math.cbrt(argument);
      case 'ln':
      case 'log':
        if (argument <= 0) {
          throw new ExpressionError(`${name} chỉ nhận số dương`);
        }
        return name === 'ln' ? Math.log(argument) : Math.log10(argument);
      case 'abs':
        return Math.abs(argument);
      default:
        throw new ExpressionError(`Không có hàm ${name}`);
    }
  }
}

export function evaluateExpression(source: string, options: { x?: number; unit?: AngleUnit } = {}): number {
  const value = new Parser(tokenize(source), { x: options.x }, options.unit ?? 'deg').parse();
  if (!Number.isFinite(value)) {
    throw new ExpressionError('Kết quả quá lớn hoặc không xác định');
  }
  return value;
}

// Hiện kết quả theo cách viết Việt Nam: dấu phẩy thập phân, tối đa 10 chữ số có nghĩa, số rất lớn hoặc rất nhỏ dạng a × 10^n
export function formatResult(value: number): string {
  if (value === 0) {
    return '0';
  }
  const magnitude = Math.abs(value);
  if (magnitude >= 1e12 || magnitude < 1e-6) {
    const [mantissa, exponent] = value.toExponential(8).split('e');
    const trimmed = (mantissa ?? '').replace(/\.?0+$/, '').replace('.', ',');
    return `${trimmed} × 10^${Number(exponent)}`;
  }
  const rounded = Number(value.toPrecision(10));
  return rounded.toLocaleString('vi-VN', { maximumFractionDigits: 10, useGrouping: false });
}
