import { useMemo, useState } from 'react';
import { Button } from '@school-management/ui';
import { addScore, planRounds, ranking, roundPoints } from './game-logic.ts';
import type { GameAnswer } from './games-api.js';
import { groupButton, QuestionView, type GameProperties } from './QuestionView.js';

// Hỏi đáp theo vòng (DT-23 phần 23c): chia câu thành các vòng, mỗi câu giáo viên mở đáp án rồi chọn các nhóm trả lời đúng; điểm
// mỗi câu đúng tăng theo vòng khi bật; bảng điểm và xếp hạng theo nhóm
export function QuizRoundsGame({ questions, groups, onFinish, onCancel }: GameProperties) {
  const [rounds, setRounds] = useState(Math.min(3, questions.length));
  const [escalate, setEscalate] = useState(true);
  const [started, setStarted] = useState(false);
  const [position, setPosition] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [correct, setCorrect] = useState<string[]>([]);
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(groups.map((group) => [group.name, 0])),
  );
  const [answers, setAnswers] = useState<GameAnswer[]>([]);
  const order = useMemo(
    () =>
      planRounds(
        questions.map((question) => question.id),
        rounds,
      ).flatMap((round) => round.question_ids.map((id) => ({ id, round: round.round }))),
    [questions, rounds],
  );
  const current = order[position];
  const question = questions.find((item) => item.id === current?.id);

  if (!started) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-section-title font-semibold">Hỏi đáp theo vòng</h2>
        <label className="flex flex-col gap-1 text-label font-medium">
          Số vòng
          <input
            aria-label="Số vòng"
            type="number"
            min={1}
            max={questions.length}
            value={rounds}
            onChange={(event) => setRounds(Math.max(1, Math.min(questions.length, Number(event.target.value) || 1)))}
            className="rounded-lg border border-border bg-card px-3 py-2"
          />
        </label>
        <label className="flex items-center gap-2 text-label">
          <input type="checkbox" checked={escalate} onChange={(event) => setEscalate(event.target.checked)} />
          Vòng sau điểm cao hơn (vòng 2 nhân 2, vòng 3 nhân 3)
        </label>
        <Button variant="primary" onClick={() => setStarted(true)}>
          Vào vòng 1
        </Button>
        <Button onClick={onCancel}>Thôi</Button>
      </div>
    );
  }

  function next() {
    if (!current) return;
    const points = roundPoints(current.round, 1, escalate);
    let nextScores = scores;
    for (const group of correct) nextScores = addScore(nextScores, group, points);
    setScores(nextScores);
    const recorded: GameAnswer[] = groups.map((group) => ({
      question_id: current.id,
      child_id: null,
      group_name: group.name,
      answer: null,
      correct: correct.includes(group.name),
    }));
    const allAnswers = [...answers, ...recorded];
    setAnswers(allAnswers);
    setRevealed(false);
    setCorrect([]);
    if (position + 1 >= order.length) {
      onFinish({
        title: `Hỏi đáp theo vòng (${rounds} vòng)`,
        config: { rounds, escalate },
        group_scores: nextScores,
        question_ids: questions.map((item) => item.id),
        answers: allAnswers,
      });
      return;
    }
    setPosition(position + 1);
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-section-title font-semibold">
        Vòng {current?.round} / {rounds}
      </h2>
      {question ? (
        <QuestionView question={question} revealed={revealed} label={`Câu ${position + 1} / ${order.length}`} />
      ) : null}
      {!revealed ? (
        <Button variant="primary" onClick={() => setRevealed(true)}>
          Mở đáp án
        </Button>
      ) : (
        <>
          <div role="group" aria-label="Nhóm trả lời đúng" className="grid grid-cols-2 gap-2">
            {groups.map((group) => (
              <button
                key={group.name}
                type="button"
                aria-pressed={correct.includes(group.name)}
                className={groupButton}
                onClick={() =>
                  setCorrect(
                    correct.includes(group.name)
                      ? correct.filter((name) => name !== group.name)
                      : [...correct, group.name],
                  )
                }
              >
                {group.name} đúng
              </button>
            ))}
          </div>
          <Button variant="primary" onClick={next}>
            {position + 1 >= order.length ? 'Kết thúc và lưu' : 'Câu tiếp'}
          </Button>
        </>
      )}
      <table aria-label="Điểm các nhóm" className="text-content">
        <tbody>
          {ranking(scores).map((row) => (
            <tr key={row.group}>
              <td className="pr-3">{row.rank}.</td>
              <td className="pr-3">{row.group}</td>
              <td className="font-semibold">{row.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
