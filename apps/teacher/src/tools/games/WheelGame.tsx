import { useState } from 'react';
import { Button } from '@school-management/ui';
import { addScore, ranking, spinTarget } from './game-logic.ts';
import type { GameAnswer } from './games-api.js';
import { groupButton, QuestionView, type GameProperties } from './QuestionView.js';

// Vòng quay (DT-23 phần 23c): quay chọn câu hỏi, chọn nhóm trả lời, hoặc chọn phần thưởng do giáo viên đặt. Hình vòng quay tự vẽ
// bằng SVG; ô dừng do máy bốc ngẫu nhiên rồi vòng quay dừng đúng ô đó
type Mode = 'questions' | 'groups' | 'rewards';

const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];

function Wheel({ labels, angle }: { labels: string[]; angle: number }) {
  const size = labels.length;
  const slice = 360 / size;
  const point = (degrees: number, radius: number) => {
    const radians = ((degrees - 90) * Math.PI) / 180;
    return `${100 + radius * Math.cos(radians)} ${100 + radius * Math.sin(radians)}`;
  };
  return (
    <div className="relative mx-auto h-64 w-64">
      <svg
        viewBox="0 0 200 200"
        className="h-full w-full"
        style={{ transform: `rotate(${angle}deg)`, transition: 'transform 3s cubic-bezier(0.15, 0.6, 0.2, 1)' }}
        aria-hidden="true"
      >
        {labels.map((label, index) => (
          <g key={index}>
            <path
              d={`M100 100 L${point(index * slice, 95)} A95 95 0 ${slice > 180 ? 1 : 0} 1 ${point((index + 1) * slice, 95)} Z`}
              fill={COLORS[index % COLORS.length]}
              stroke="#fff"
              strokeWidth="1"
            />
            <text
              x="100"
              y="22"
              fill="#fff"
              fontSize={size > 10 ? 7 : 10}
              textAnchor="middle"
              transform={`rotate(${index * slice + slice / 2} 100 100)`}
            >
              {label.length > 14 ? `${label.slice(0, 13)}…` : label}
            </text>
          </g>
        ))}
      </svg>
      <div
        className="absolute left-1/2 top-0 h-0 w-0 -translate-x-1/2 border-x-8 border-t-[16px] border-x-transparent border-t-text"
        aria-hidden="true"
      />
    </div>
  );
}

export function WheelGame({ questions, groups, onFinish, onCancel }: GameProperties) {
  const [mode, setMode] = useState<Mode>('questions');
  const [rewardsText, setRewardsText] = useState('Cộng 1 điểm\nCộng 2 điểm\nĐược chọn bạn trả lời\nThêm lượt quay');
  const [angle, setAngle] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [remaining, setRemaining] = useState(questions.map((question) => question.id));
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(groups.map((group) => [group.name, 0])),
  );
  const [answers, setAnswers] = useState<GameAnswer[]>([]);
  const [used, setUsed] = useState<string[]>([]);

  const rewards = rewardsText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const labels =
    mode === 'questions'
      ? remaining.map((id) => `Câu ${questions.findIndex((question) => question.id === id) + 1}`)
      : mode === 'groups'
        ? groups.map((group) => group.name)
        : rewards;
  const question =
    mode === 'questions' && picked !== null ? questions.find((item) => item.id === remaining[picked]) : undefined;

  function spin() {
    if (labels.length === 0 || spinning) return;
    const target = spinTarget(angle, labels.length, Math.random);
    setRevealed(false);
    setSpinning(true);
    setPicked(null);
    setAngle(target.angle);
    window.setTimeout(() => {
      setPicked(target.index);
      setSpinning(false);
    }, 3100);
  }

  function award(groupName: string | null) {
    if (!question) return;
    if (groupName) setScores(addScore(scores, groupName, 1));
    setAnswers([
      ...answers,
      ...groups.map((group) => ({
        question_id: question.id,
        child_id: null,
        group_name: group.name,
        answer: null,
        correct: group.name === groupName,
      })),
    ]);
    setUsed([...used, question.id]);
    setRemaining(remaining.filter((id) => id !== question.id));
    setPicked(null);
    setRevealed(false);
  }

  function finish() {
    onFinish({
      title: 'Vòng quay',
      config: { rewards },
      group_scores: scores,
      // Chỉ câu đã quay trúng mới tính là đã dùng
      question_ids: used.length ? used : questions.slice(0, 1).map((item) => item.id),
      answers,
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-section-title font-semibold">Vòng quay</h2>
      <div role="radiogroup" aria-label="Quay chọn" className="grid grid-cols-3 gap-2">
        {(
          [
            ['questions', 'Câu hỏi'],
            ['groups', 'Nhóm'],
            ['rewards', 'Phần thưởng'],
          ] as Array<[Mode, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={mode === key}
            className={groupButton}
            aria-pressed={mode === key}
            onClick={() => {
              setMode(key);
              setPicked(null);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === 'rewards' ? (
        <label className="flex flex-col gap-1 text-label font-medium">
          Phần thưởng (mỗi dòng một ô)
          <textarea
            aria-label="Phần thưởng"
            rows={4}
            value={rewardsText}
            onChange={(event) => setRewardsText(event.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2"
          />
        </label>
      ) : null}
      {labels.length > 0 ? (
        <Wheel labels={labels} angle={angle} />
      ) : (
        <p className="text-content">Đã dùng hết câu hỏi.</p>
      )}
      <Button variant="primary" disabled={spinning || labels.length === 0} onClick={spin}>
        {spinning ? 'Đang quay…' : 'Quay'}
      </Button>
      {picked !== null && mode !== 'questions' ? (
        <p role="status" className="text-center text-section-title font-semibold">
          {labels[picked]}
        </p>
      ) : null}
      {question ? (
        <>
          <QuestionView question={question} revealed={revealed} />
          {!revealed ? (
            <Button onClick={() => setRevealed(true)}>Mở đáp án</Button>
          ) : (
            <div role="group" aria-label="Nhóm trả lời đúng" className="grid grid-cols-2 gap-2">
              {groups.map((group) => (
                <button key={group.name} type="button" className={groupButton} onClick={() => award(group.name)}>
                  {group.name} đúng
                </button>
              ))}
              <button type="button" className={groupButton} onClick={() => award(null)}>
                Không nhóm nào đúng
              </button>
            </div>
          )}
        </>
      ) : null}
      <p className="text-content" aria-label="Điểm các nhóm">
        {ranking(scores)
          .map((row) => `${row.group}: ${row.score}`)
          .join('; ')}
      </p>
      <Button variant="primary" onClick={finish} disabled={used.length === 0}>
        Kết thúc và lưu
      </Button>
      <Button onClick={onCancel}>Thôi</Button>
    </div>
  );
}
