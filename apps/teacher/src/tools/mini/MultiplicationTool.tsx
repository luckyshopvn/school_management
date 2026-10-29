import { useState } from 'react';
import { Button } from '@school-management/ui';
import { multiplicationQuestion, multiplicationRows } from './primary-logic.ts';

// Bảng cửu chương (DT-29 phần 29c, YCTD-327; Tiểu học): xem bảng nhân 2 đến 9, hỏi nhanh trong bảng đang chọn hoặc trộn các bảng;
// giáo viên bấm Hiện đáp án sau khi học sinh trả lời. Không lưu kết quả, không cần danh sách lớp
export function MultiplicationTool() {
  const [table, setTable] = useState(2);
  const [mixed, setMixed] = useState(false);
  const [question, setQuestion] = useState(() => multiplicationQuestion(2));
  const [shown, setShown] = useState(false);
  const [asked, setAsked] = useState(1);

  const ask = (nextTable: number, nextMixed: boolean) => {
    setQuestion(multiplicationQuestion(nextMixed ? null : nextTable));
    setShown(false);
    setAsked((count) => count + 1);
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <section aria-label="Bảng nhân" className="flex flex-col gap-3 lg:w-96">
        <div role="group" aria-label="Chọn bảng" className="grid grid-cols-4 gap-2">
          {[2, 3, 4, 5, 6, 7, 8, 9].map((value) => (
            <Button
              key={value}
              aria-pressed={value === table}
              className={value === table ? 'border-brand bg-selected' : ''}
              onClick={() => {
                setTable(value);
                setMixed(false);
                ask(value, false);
              }}
            >
              Bảng {value}
            </Button>
          ))}
        </div>
        <ol
          aria-label={`Bảng nhân ${table}`}
          className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl border border-border bg-card p-3"
        >
          {multiplicationRows(table).map((row) => (
            <li
              key={row.right}
              className={`rounded px-2 py-1 text-section-title tabular-nums text-text ${
                !mixed && question.left === table && question.right === row.right ? 'bg-selected font-bold' : ''
              }`}
            >
              {table} × {row.right} = {row.product}
            </li>
          ))}
        </ol>
      </section>
      <section aria-label="Hỏi nhanh" className="flex flex-1 flex-col gap-3">
        <div role="group" aria-label="Phạm vi câu hỏi" className="grid grid-cols-2 gap-2">
          <Button
            aria-pressed={!mixed}
            className={!mixed ? 'border-brand bg-selected' : ''}
            onClick={() => {
              setMixed(false);
              ask(table, false);
            }}
          >
            Hỏi trong bảng {table}
          </Button>
          <Button
            aria-pressed={mixed}
            className={mixed ? 'border-brand bg-selected' : ''}
            onClick={() => {
              setMixed(true);
              ask(table, true);
            }}
          >
            Trộn bảng 2 đến 9
          </Button>
        </div>
        <div className="flex min-h-48 flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card p-6">
          <p aria-live="polite" aria-label="Câu hỏi" className="text-7xl font-bold tabular-nums text-text">
            {question.left} × {question.right} = {shown ? question.left * question.right : '?'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => setShown(true)}>
            Hiện đáp án
          </Button>
          <Button variant="primary" className="flex-1" onClick={() => ask(table, mixed)}>
            Câu khác
          </Button>
        </div>
        <p className="text-label text-text-secondary">Đã hỏi {asked} câu trong buổi. Không lưu kết quả.</p>
      </section>
    </div>
  );
}
