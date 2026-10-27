import type { Group } from '../classroom-logic.ts';
import { answerText, type GameQuestion } from './game-logic.ts';
import type { GameResult } from './GamesTool.js';

// Phần dùng chung của các trò chơi (DT-23 phần 23c): hiện câu hỏi cỡ chữ lớn để chiếu lên màn hình lớp, mở đáp án khi giáo viên bấm
export interface GameProperties {
  questions: GameQuestion[];
  groups: Group[];
  onFinish(result: GameResult): void;
  onCancel(): void;
}

export function QuestionView({
  question,
  revealed,
  label,
}: {
  question: GameQuestion;
  revealed: boolean;
  label?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4" aria-label="Câu hỏi">
      {label ? <span className="text-label text-text-secondary">{label}</span> : null}
      <p className="whitespace-pre-wrap text-section-title font-semibold text-text">{question.content}</p>
      {question.question_type !== 'short_answer' ? (
        <ul className="flex flex-col gap-1 text-content">
          {question.options.map((option) => (
            <li key={option.key}>
              <strong>{option.key}.</strong> {option.content}
            </li>
          ))}
        </ul>
      ) : null}
      {revealed ? (
        <p role="status" className="rounded-md bg-page px-3 py-2 text-content font-medium text-text">
          Đáp án: {answerText(question)}
        </p>
      ) : null}
    </div>
  );
}

export const groupButton =
  'rounded-lg border border-border-strong bg-card px-3 py-2 text-label font-medium text-text aria-pressed:bg-brand aria-pressed:text-white';
