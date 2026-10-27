import { useMemo, useState } from 'react';
import { Alert, Button } from '@school-management/ui';
import {
  addScore,
  buildCrossword,
  crosswordCells,
  crosswordConflicts,
  crosswordWord,
  normalizeCrossword,
  ranking,
  type Crossword,
  type CrosswordEntry,
} from './game-logic.ts';
import type { GameAnswer } from './games-api.js';
import { groupButton, type GameProperties } from './QuestionView.js';

// Ô chữ (DT-23 phần 23c): sinh từ câu có đáp án ngắn; giáo viên sửa gợi ý, từ, vị trí, hướng hoặc bỏ từ trước khi chơi (lưới báo ô
// chồng sai chữ). Khi chơi: chọn hàng, nhóm trả lời đúng thì mở chữ của hàng đó và cộng điểm theo số chữ
export function CrosswordGame({ questions, groups, onFinish, onCancel }: GameProperties) {
  const initial = useMemo(
    () =>
      buildCrossword(
        questions.map((question) => ({
          question_id: question.id,
          clue: question.content,
          answer: question.answer[0] ?? '',
        })),
      ),
    [questions],
  );
  const [crossword, setCrossword] = useState<Crossword>(initial);
  const [editing, setEditing] = useState(true);
  const [opened, setOpened] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(groups.map((group) => [group.name, 0])),
  );
  const [answers, setAnswers] = useState<GameAnswer[]>([]);
  const conflicts = crosswordConflicts(crossword);
  const cells = crosswordCells(crossword);
  const openCells = new Set(
    crossword.entries
      .filter((entry) => opened.includes(entry.question_id))
      .flatMap((entry) =>
        [...entry.word].map(
          (_, index) =>
            `${entry.row + (entry.direction === 'down' ? index : 0)},${entry.col + (entry.direction === 'across' ? index : 0)}`,
        ),
      ),
  );

  function update(questionId: string, change: Partial<CrosswordEntry>) {
    const entries = crossword.entries.map((entry) =>
      entry.question_id === questionId ? { ...entry, ...change } : entry,
    );
    setCrossword(normalizeCrossword(entries, crossword.skipped));
  }

  function remove(questionId: string) {
    setCrossword(
      normalizeCrossword(
        crossword.entries.filter((entry) => entry.question_id !== questionId),
        [...crossword.skipped, questionId],
      ),
    );
  }

  function resolve(entry: CrosswordEntry, groupName: string | null) {
    if (groupName) setScores(addScore(scores, groupName, entry.word.length));
    setAnswers([
      ...answers,
      ...groups.map((group) => ({
        question_id: entry.question_id,
        child_id: null,
        group_name: group.name,
        answer: null,
        correct: group.name === groupName,
      })),
    ]);
    setOpened([...opened, entry.question_id]);
    setActive(null);
  }

  const activeEntry = crossword.entries.find((entry) => entry.question_id === active);
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-section-title font-semibold">Ô chữ</h2>
      {crossword.entries.length === 0 ? (
        <Alert tone="info">Không xếp được ô chữ từ các câu này; lấy thêm câu có đáp án ngắn.</Alert>
      ) : null}
      {crossword.skipped.length > 0 ? (
        <p className="text-label text-text-secondary">
          {crossword.skipped.length} câu không xếp được vào lưới (đáp án quá dài hoặc không có chữ chung).
        </p>
      ) : null}
      {conflicts.length > 0 ? (
        <Alert tone="danger">Có từ chồng sai chữ ở ô giao nhau; sửa vị trí hoặc bỏ từ.</Alert>
      ) : null}
      <div className="overflow-x-auto">
        <table aria-label="Lưới ô chữ" className="border-collapse">
          <tbody>
            {cells.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td
                    key={c}
                    className={`relative h-8 w-8 border text-center text-content font-semibold ${cell ? 'border-text bg-card' : 'border-transparent'}`}
                  >
                    {cell?.number ? (
                      <span className="absolute left-0.5 top-0 text-[9px] font-normal">{cell.number}</span>
                    ) : null}
                    {cell && (editing || openCells.has(`${r},${c}`)) ? cell.letter : ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ol className="flex flex-col gap-2" aria-label="Gợi ý">
        {crossword.entries.map((entry) => (
          <li key={entry.question_id} className="rounded-lg border border-border bg-card p-2 text-content">
            <strong>
              {entry.number}. {entry.direction === 'across' ? 'Hàng ngang' : 'Hàng dọc'} ({entry.word.length} chữ):
            </strong>{' '}
            {editing ? (
              <span className="mt-1 grid grid-cols-2 gap-1 text-label">
                <input
                  aria-label={`Gợi ý ${entry.number}`}
                  value={entry.clue}
                  onChange={(event) => update(entry.question_id, { clue: event.target.value })}
                  className="col-span-2 rounded border border-border px-2 py-1"
                />
                <input
                  aria-label={`Từ ${entry.number}`}
                  value={entry.word}
                  onChange={(event) => update(entry.question_id, { word: crosswordWord(event.target.value) })}
                  className="rounded border border-border px-2 py-1"
                />
                <select
                  aria-label={`Hướng ${entry.number}`}
                  value={entry.direction}
                  onChange={(event) =>
                    update(entry.question_id, { direction: event.target.value as 'across' | 'down' })
                  }
                  className="rounded border border-border px-2 py-1"
                >
                  <option value="across">Ngang</option>
                  <option value="down">Dọc</option>
                </select>
                <input
                  aria-label={`Hàng ${entry.number}`}
                  type="number"
                  value={entry.row}
                  onChange={(event) => update(entry.question_id, { row: Number(event.target.value) || 0 })}
                  className="rounded border border-border px-2 py-1"
                />
                <input
                  aria-label={`Cột ${entry.number}`}
                  type="number"
                  value={entry.col}
                  onChange={(event) => update(entry.question_id, { col: Number(event.target.value) || 0 })}
                  className="rounded border border-border px-2 py-1"
                />
                <button
                  type="button"
                  className="col-span-2 text-left text-danger underline"
                  onClick={() => remove(entry.question_id)}
                >
                  Bỏ từ này
                </button>
              </span>
            ) : (
              <>
                {entry.clue}{' '}
                {!opened.includes(entry.question_id) ? (
                  <button type="button" className="underline" onClick={() => setActive(entry.question_id)}>
                    Chọn hàng này
                  </button>
                ) : (
                  <span className="text-text-secondary">(đã mở)</span>
                )}
              </>
            )}
          </li>
        ))}
      </ol>
      {editing ? (
        <>
          <Button
            onClick={() =>
              setCrossword(
                buildCrossword(
                  crossword.entries.map((entry) => ({
                    question_id: entry.question_id,
                    clue: entry.clue,
                    answer: entry.word,
                  })),
                ),
              )
            }
          >
            Xếp lại lưới
          </Button>
          <Button
            variant="primary"
            disabled={crossword.entries.length === 0 || conflicts.length > 0}
            onClick={() => setEditing(false)}
          >
            Bắt đầu chơi (ẩn chữ)
          </Button>
        </>
      ) : null}
      {activeEntry ? (
        <div role="group" aria-label="Nhóm trả lời đúng" className="grid grid-cols-2 gap-2">
          {groups.map((group) => (
            <button
              key={group.name}
              type="button"
              className={groupButton}
              onClick={() => resolve(activeEntry, group.name)}
            >
              {group.name} đúng
            </button>
          ))}
          <button type="button" className={groupButton} onClick={() => resolve(activeEntry, null)}>
            Mở chữ, không nhóm nào đúng
          </button>
        </div>
      ) : null}
      <p className="text-content" aria-label="Điểm các nhóm">
        {ranking(scores)
          .map((row) => `${row.group}: ${row.score}`)
          .join('; ')}
      </p>
      {!editing ? (
        <Button
          variant="primary"
          onClick={() =>
            onFinish({
              title: `Ô chữ (${crossword.entries.length} hàng)`,
              config: {
                entries: crossword.entries.map(({ question_id, word, row, col, direction }) => ({
                  question_id,
                  word,
                  row,
                  col,
                  direction,
                })),
              },
              group_scores: scores,
              question_ids: crossword.entries.map((entry) => entry.question_id),
              answers,
            })
          }
        >
          Kết thúc và lưu
        </Button>
      ) : null}
      <Button onClick={onCancel}>Thôi</Button>
    </div>
  );
}
