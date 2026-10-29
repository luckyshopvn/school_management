import { useState } from 'react';
import { Alert, Button } from '@school-management/ui';
import { evaluateExpression, ExpressionError, formatResult, type AngleUnit } from './expression.ts';

// Máy tính khoa học (DT-29 phần 29d, YCTD-328; THCS, THPT): gõ hoặc bấm biểu thức, tính theo độ hoặc radian, lịch sử phép tính
// trong buổi. Bộ tính tự viết (không dùng eval), chạy trên máy, không lưu
const KEYS: Array<{ label: string; insert: string; aria?: string }> = [
  { label: 'sin', insert: 'sin(' },
  { label: 'cos', insert: 'cos(' },
  { label: 'tan', insert: 'tan(' },
  { label: '√', insert: '√(', aria: 'Căn bậc hai' },
  { label: 'xʸ', insert: '^', aria: 'Luỹ thừa' },
  { label: 'asin', insert: 'asin(' },
  { label: 'acos', insert: 'acos(' },
  { label: 'atan', insert: 'atan(' },
  { label: 'ln', insert: 'ln(' },
  { label: 'log', insert: 'log(' },
  { label: '(', insert: '(' },
  { label: ')', insert: ')' },
  { label: 'π', insert: 'π' },
  { label: 'e', insert: 'e' },
  { label: 'n!', insert: '!', aria: 'Giai thừa' },
  { label: '7', insert: '7' },
  { label: '8', insert: '8' },
  { label: '9', insert: '9' },
  { label: '÷', insert: '÷', aria: 'Chia' },
  { label: '%', insert: '%', aria: 'Phần trăm' },
  { label: '4', insert: '4' },
  { label: '5', insert: '5' },
  { label: '6', insert: '6' },
  { label: '×', insert: '×', aria: 'Nhân' },
  { label: '−', insert: '−', aria: 'Trừ' },
  { label: '1', insert: '1' },
  { label: '2', insert: '2' },
  { label: '3', insert: '3' },
  { label: '+', insert: '+', aria: 'Cộng' },
  { label: ',', insert: ',', aria: 'Dấu phẩy thập phân' },
  { label: '0', insert: '0' },
];

export function CalculatorTool() {
  const [expression, setExpression] = useState('');
  const [unit, setUnit] = useState<AngleUnit>('deg');
  const [result, setResult] = useState<string>();
  const [problem, setProblem] = useState<string>();
  const [history, setHistory] = useState<Array<{ expression: string; result: string }>>([]);

  const calculate = () => {
    try {
      const value = formatResult(evaluateExpression(expression, { unit }));
      setResult(value);
      setProblem(undefined);
      setHistory((previous) => [{ expression, result: value }, ...previous].slice(0, 20));
    } catch (error) {
      if (!(error instanceof ExpressionError)) {
        throw error;
      }
      setResult(undefined);
      setProblem(error.message);
    }
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <section aria-label="Máy tính" className="flex flex-1 flex-col gap-3">
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            calculate();
          }}
        >
          <label className="flex flex-col gap-1 text-label font-medium text-text">
            Biểu thức
            <input
              value={expression}
              onChange={(event) => setExpression(event.target.value)}
              inputMode="text"
              autoComplete="off"
              className="rounded-lg border border-border bg-card px-3 py-3 font-mono text-section-title text-text"
            />
          </label>
          <p
            aria-live="polite"
            aria-label="Kết quả"
            className="min-h-12 text-right text-4xl font-bold tabular-nums text-text"
          >
            {result !== undefined ? `= ${result}` : ''}
          </p>
          {problem ? <Alert tone="warning">{problem}</Alert> : null}
          <div className="flex items-center gap-2">
            <div role="group" aria-label="Đơn vị góc" className="flex gap-1">
              {(['deg', 'rad'] as const).map((item) => (
                <Button
                  key={item}
                  aria-pressed={unit === item}
                  className={unit === item ? 'border-brand bg-selected' : ''}
                  onClick={() => setUnit(item)}
                >
                  {item === 'deg' ? 'Độ' : 'Radian'}
                </Button>
              ))}
            </div>
            <Button className="ml-auto" onClick={() => setExpression((value) => value.slice(0, -1))}>
              Xóa lùi
            </Button>
            <Button
              onClick={() => {
                setExpression('');
                setResult(undefined);
                setProblem(undefined);
              }}
            >
              Xóa hết
            </Button>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {KEYS.map((key) => (
              <button
                key={key.label}
                type="button"
                aria-label={key.aria ?? key.label}
                onClick={() => setExpression((value) => value + key.insert)}
                className="min-h-12 rounded-lg border border-border-strong bg-card text-section-title text-text hover:bg-selected"
              >
                {key.label}
              </button>
            ))}
            <Button type="submit" variant="primary" className="col-span-4 min-h-12 text-section-title">
              =
            </Button>
          </div>
        </form>
      </section>
      <aside aria-label="Lịch sử phép tính" className="flex flex-col gap-2 lg:w-72">
        <h3 className="text-content font-semibold text-text">Lịch sử trong buổi</h3>
        {history.length === 0 ? <p className="text-label text-text-secondary">Chưa có phép tính nào</p> : null}
        <ul className="flex flex-col gap-1">
          {history.map((item, index) => (
            <li key={index}>
              <button
                type="button"
                onClick={() => setExpression(item.expression)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-left text-label text-text"
              >
                {item.expression} = <strong>{item.result}</strong>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
