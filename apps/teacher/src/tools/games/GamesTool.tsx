import { useEffect, useMemo, useState } from 'react';
import { Alert, Button } from '@school-management/ui';
import { messageOf } from '../classroom-api.js';
import type { Group } from '../classroom-logic.ts';
import { readGrouping } from '../classroom-store.js';
import type { RosterSnapshot } from '../classroom-store.js';
import { AnswerCardsGame } from './AnswerCardsGame.js';
import { CrosswordGame } from './CrosswordGame.js';
import { QuizRoundsGame } from './QuizRoundsGame.js';
import { WheelGame } from './WheelGame.js';
import { shuffle, type GameQuestion, type GameQuestionType } from './game-logic.ts';
import {
  fetchCatalog,
  fetchGameSessions,
  fetchQuestions,
  type GameAnswer,
  type GameCatalog,
  type GameKind,
  type GameSessionSummary,
} from './games-api.js';
import { addToScoreboard, flushGames, readQuestionSet, recordGame, saveQuestionSet } from './games-store.js';

// Trò chơi kiến thức ở màn hình lớp và thẻ đáp án giấy (DT-23 phần 23c, YCTD-213; tài liệu 47 mục 15.4): giáo viên điều khiển, học
// sinh không cần thiết bị. Câu hỏi chỉ lấy từ ngân hàng câu hỏi đã duyệt (22g1) của khối của lớp; kết quả mỗi câu ghi vào lịch sử
// sử dụng câu hỏi; điểm nhóm không vào sổ điểm, chỉ chuyển sang bảng điểm nhanh (23b) khi giáo viên chọn
export interface GameResult {
  title: string;
  config: Record<string, unknown>;
  group_scores: Record<string, number>;
  question_ids: string[];
  answers: GameAnswer[];
}

const GAMES: Array<{ key: GameKind; label: string; types: GameQuestionType[]; hint: string }> = [
  {
    key: 'quiz_rounds',
    label: 'Hỏi đáp theo vòng',
    types: ['multiple_choice', 'true_false', 'short_answer'],
    hint: 'Các nhóm trả lời theo vòng, điểm theo nhóm',
  },
  {
    key: 'wheel',
    label: 'Vòng quay',
    types: ['multiple_choice', 'true_false', 'short_answer'],
    hint: 'Quay chọn câu hỏi, chọn nhóm hoặc phần thưởng',
  },
  {
    key: 'crossword',
    label: 'Ô chữ',
    types: ['short_answer'],
    hint: 'Ô chữ sinh từ câu có đáp án ngắn, giáo viên chỉnh tay được',
  },
  {
    key: 'answer_cards',
    label: 'Thẻ đáp án giấy',
    types: ['multiple_choice'],
    hint: 'Học sinh giơ thẻ in sẵn, giáo viên quét bằng camera',
  },
];

const LEVELS = [
  { key: '', label: 'Mọi mức' },
  { key: 'recognition', label: 'Nhận biết' },
  { key: 'comprehension', label: 'Thông hiểu' },
  { key: 'application', label: 'Vận dụng' },
  { key: 'high_application', label: 'Vận dụng cao' },
];

const DEFAULT_TEAMS: Group[] = [
  { name: 'Đội 1', child_ids: [] },
  { name: 'Đội 2', child_ids: [] },
];

const select = 'rounded-lg border border-border bg-card px-3 py-2 text-content text-text';

export function GamesTool({ snapshot, online }: { snapshot: RosterSnapshot; online: boolean }) {
  const classId = snapshot.class_id;
  const [kind, setKind] = useState<GameKind>('quiz_rounds');
  const [catalog, setCatalog] = useState<GameCatalog>();
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [level, setLevel] = useState('');
  const [count, setCount] = useState(10);
  const [questions, setQuestions] = useState<GameQuestion[]>([]);
  const [playing, setPlaying] = useState(false);
  const [startedAt, setStartedAt] = useState('');
  const [notice, setNotice] = useState<{ tone: 'danger' | 'info' | 'success'; text: string }>();
  const [lastScores, setLastScores] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<GameSessionSummary[]>([]);
  const groups = useMemo(() => {
    const saved = readGrouping(classId);
    return saved.length > 0 ? saved : DEFAULT_TEAMS;
  }, [classId]);
  const game = GAMES.find((item) => item.key === kind) as (typeof GAMES)[number];

  useEffect(() => {
    setCatalog(undefined);
    setQuestions([]);
    setPlaying(false);
    if (!online) return;
    fetchCatalog(classId)
      .then(setCatalog)
      .catch((error: unknown) => setNotice({ tone: 'danger', text: messageOf(error) }));
    void flushGames();
    fetchGameSessions(classId)
      .then((reply) => setHistory(reply.items))
      .catch(() => undefined);
  }, [classId, online]);

  const subject = catalog?.subjects.find((item) => item.id === subjectId);
  const saved = readQuestionSet(classId, new Date());

  async function load() {
    setNotice(undefined);
    try {
      const reply = await fetchQuestions(classId, {
        subjectId,
        ...(topicId ? { topicId } : {}),
        ...(level ? { cognitiveLevel: level } : {}),
        types: game.types,
        limit: count,
      });
      let items = shuffle(reply.items, Math.random);
      if (kind === 'answer_cards') {
        // Thẻ có bốn đáp án A đến D, một đáp án đúng
        items = items.filter((item) => item.options.length <= 4 && item.answer.length === 1);
      }
      if (items.length === 0) {
        setNotice({ tone: 'info', text: 'Chưa có câu hỏi đã duyệt phù hợp với lựa chọn này' });
        return;
      }
      setQuestions(items);
      saveQuestionSet({
        class_id: classId,
        subject_name: subject?.name ?? '',
        saved_at: new Date().toISOString(),
        questions: items,
      });
    } catch (error) {
      setNotice({ tone: 'danger', text: messageOf(error) });
    }
  }

  function start(items: GameQuestion[]) {
    setQuestions(items);
    setStartedAt(new Date().toISOString());
    setLastScores({});
    setNotice(undefined);
    setPlaying(true);
  }

  async function finish(result: GameResult) {
    setPlaying(false);
    setLastScores(result.group_scores);
    try {
      const outcome = await recordGame({
        client_id: crypto.randomUUID(),
        class_id: classId,
        kind,
        title: result.title,
        started_at: startedAt || new Date().toISOString(),
        finished_at: new Date().toISOString(),
        config: result.config,
        group_scores: result.group_scores,
        question_ids: result.question_ids,
        answers: result.answers,
      });
      setNotice({
        tone: 'success',
        text: outcome === 'saved' ? 'Đã lưu kết quả lượt chơi' : 'Đang mất mạng: kết quả lượt chơi sẽ gửi khi có mạng',
      });
      if (outcome === 'saved' && online) {
        fetchGameSessions(classId)
          .then((reply) => setHistory(reply.items))
          .catch(() => undefined);
      }
    } catch (error) {
      setNotice({ tone: 'danger', text: messageOf(error) });
    }
  }

  if (playing) {
    const common = {
      questions,
      groups,
      onFinish: (result: GameResult) => void finish(result),
      onCancel: () => setPlaying(false),
    };
    return (
      <section aria-label="Trò chơi đang chơi" className="flex flex-col gap-3">
        {kind === 'quiz_rounds' ? <QuizRoundsGame {...common} /> : null}
        {kind === 'wheel' ? <WheelGame {...common} /> : null}
        {kind === 'crossword' ? <CrosswordGame {...common} /> : null}
        {kind === 'answer_cards' ? (
          <AnswerCardsGame
            questions={questions}
            students={snapshot.students}
            onFinish={common.onFinish}
            onCancel={common.onCancel}
          />
        ) : null}
      </section>
    );
  }

  return (
    <section aria-label="Trò chơi" className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Loại trò chơi" className="grid grid-cols-2 gap-2">
        {GAMES.map((item) => (
          <button
            key={item.key}
            type="button"
            role="radio"
            aria-checked={kind === item.key}
            onClick={() => {
              setKind(item.key);
              setQuestions([]);
            }}
            className={`rounded-lg px-3 py-2 text-left text-label ${kind === item.key ? 'bg-brand text-white' : 'border border-border-strong bg-card text-text'}`}
          >
            <strong className="block">{item.label}</strong>
            <span>{item.hint}</span>
          </button>
        ))}
      </div>
      {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}
      {online ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
          <label className="flex flex-col gap-1 text-label font-medium text-text">
            Môn
            <select
              aria-label="Môn"
              className={select}
              value={subjectId}
              onChange={(event) => {
                setSubjectId(event.target.value);
                setTopicId('');
              }}
            >
              <option value="">Chọn môn</option>
              {catalog?.subjects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          {catalog && catalog.subjects.length === 0 ? (
            <p className="text-label text-text-secondary">
              Khối {catalog.grade_level} chưa có câu hỏi đã duyệt trong ngân hàng câu hỏi.
            </p>
          ) : null}
          {subject && subject.topics.length > 0 ? (
            <label className="flex flex-col gap-1 text-label font-medium text-text">
              Chủ đề
              <select
                aria-label="Chủ đề"
                className={select}
                value={topicId}
                onChange={(event) => setTopicId(event.target.value)}
              >
                <option value="">Mọi chủ đề</option>
                {subject.topics.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.count})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="flex flex-col gap-1 text-label font-medium text-text">
            Mức nhận thức
            <select
              aria-label="Mức nhận thức"
              className={select}
              value={level}
              onChange={(event) => setLevel(event.target.value)}
            >
              {LEVELS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-label font-medium text-text">
            Số câu
            <input
              aria-label="Số câu"
              type="number"
              min={1}
              max={60}
              value={count}
              onChange={(event) => setCount(Math.max(1, Math.min(60, Number(event.target.value) || 1)))}
              className={select}
            />
          </label>
          <Button variant="primary" disabled={!subjectId} onClick={() => void load()}>
            Lấy câu hỏi
          </Button>
        </div>
      ) : (
        <p className="text-label text-text-secondary">
          {saved
            ? `Mất mạng: dùng bộ câu hỏi đã lưu (${saved.subject_name}, ${saved.questions.length} câu).`
            : 'Mất mạng: cần có mạng để lấy câu hỏi lần đầu.'}
        </p>
      )}
      {questions.length > 0 ? (
        <Button variant="primary" onClick={() => start(questions)}>
          Bắt đầu với {questions.length} câu
        </Button>
      ) : !online && saved ? (
        <Button variant="primary" onClick={() => start(saved.questions)}>
          Bắt đầu với bộ câu hỏi đã lưu
        </Button>
      ) : null}
      {kind !== 'answer_cards' ? (
        <p className="text-label text-text-secondary">
          Nhóm: {groups.map((group) => group.name).join(', ')}
          {groups === DEFAULT_TEAMS ? ' (chưa chia nhóm ở thẻ Chia nhóm nên dùng hai đội)' : ''}
        </p>
      ) : null}
      {Object.values(lastScores).some((value) => value !== 0) ? (
        <div
          className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3"
          aria-label="Điểm lượt vừa chơi"
        >
          <p className="text-content">
            {Object.entries(lastScores)
              .map(([group, value]) => `${group}: ${value}`)
              .join('; ')}
          </p>
          <Button
            onClick={() => {
              const added = addToScoreboard(classId, lastScores, new Date());
              setLastScores({});
              setNotice({
                tone: 'success',
                text: `Đã chuyển ${added} dòng điểm sang Bảng điểm; vào nề nếp khi xác nhận ở Bảng điểm`,
              });
            }}
          >
            Chuyển điểm nhóm sang Bảng điểm
          </Button>
        </div>
      ) : null}
      {history.length > 0 ? (
        <div aria-label="Lượt chơi gần đây" className="flex flex-col gap-1 text-label text-text-secondary">
          <strong className="text-text">Lượt chơi gần đây</strong>
          {history.slice(0, 5).map((item) => (
            <span key={item.id}>
              {new Date(item.finished_at).toLocaleString('vi-VN')}: {item.title} ({item.question_count} câu)
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
