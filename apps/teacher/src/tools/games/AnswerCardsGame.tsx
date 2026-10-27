import { useEffect, useRef, useState } from 'react';
import { Alert, Button } from '@school-management/ui';
import type { RosterSnapshot } from '../classroom-store.js';
import { CARD_ANSWERS, MAX_CARD_NUMBER, type CardAnswer } from './answer-card.ts';
import { cardSheetHtml } from './card-print.ts';
import { mergeScans, scanCards, toGray } from './card-scanner.ts';
import type { GameQuestion } from './game-logic.ts';
import type { GameAnswer } from './games-api.js';
import type { GameResult } from './GamesTool.js';
import { QuestionView } from './QuestionView.js';

// Thẻ đáp án giấy (DT-23 phần 23c, YCTD-213): in thẻ theo số thứ tự trong lớp, chiếu câu hỏi, học sinh giơ thẻ, giáo viên quét
// bằng camera điện thoại trong trình duyệt. Ảnh chỉ xử lý trên máy (không gửi đi, không lưu); giáo viên sửa tay được trước khi chấm.
// Chỉ lưu học sinh nào chọn đáp án nào cho câu nào
const FRAME_WIDTH = 480;
const SCAN_INTERVAL_MS = 250;

function Scanner({ onScanned }: { onScanned(cards: ReturnType<typeof scanCards>): void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [problem, setProblem] = useState<string>();
  // Hàm nhận kết quả đổi mỗi lần vẽ lại; giữ trong ref để camera không mở lại sau mỗi lần đọc
  const callback = useRef(onScanned);
  callback.current = onScanned;
  useEffect(() => {
    let stream: MediaStream | undefined;
    let timer: number | undefined;
    const canvas = document.createElement('canvas');
    if (!navigator.mediaDevices?.getUserMedia) {
      setProblem('Trình duyệt này không mở được camera; nhập đáp án bằng tay ở bảng dưới');
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((media) => {
        stream = media;
        if (video.current) {
          video.current.srcObject = media;
          void video.current.play();
        }
        timer = window.setInterval(() => {
          const element = video.current;
          if (!element || element.videoWidth === 0) return;
          const scale = FRAME_WIDTH / element.videoWidth;
          canvas.width = FRAME_WIDTH;
          canvas.height = Math.round(element.videoHeight * scale);
          const context = canvas.getContext('2d', { willReadFrequently: true });
          if (!context) return;
          context.drawImage(element, 0, 0, canvas.width, canvas.height);
          const frame = context.getImageData(0, 0, canvas.width, canvas.height);
          callback.current(scanCards(toGray(frame.data, frame.width, frame.height)));
        }, SCAN_INTERVAL_MS);
      })
      .catch(() =>
        setProblem('Không mở được camera (chưa cho phép hoặc không có camera); nhập đáp án bằng tay ở bảng dưới'),
      );
    return () => {
      if (timer) window.clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  return problem ? (
    <Alert tone="info">{problem}</Alert>
  ) : (
    <video ref={video} muted playsInline className="w-full rounded-lg bg-black" aria-label="Camera quét thẻ" />
  );
}

export function AnswerCardsGame({
  questions,
  students,
  onFinish,
  onCancel,
}: {
  questions: GameQuestion[];
  students: RosterSnapshot['students'];
  onFinish(result: GameResult): void;
  onCancel(): void;
}) {
  const [position, setPosition] = useState(0);
  const [picks, setPicks] = useState<Record<number, CardAnswer>>({});
  const [scanning, setScanning] = useState(false);
  const [checked, setChecked] = useState(false);
  const [answers, setAnswers] = useState<GameAnswer[]>([]);
  const question = questions[position] as GameQuestion;
  const correct = question.answer[0] ?? '';
  const byNumber = new Map(
    students.filter((student) => student.order_no <= MAX_CARD_NUMBER).map((student) => [student.order_no, student]),
  );
  const counted = Object.entries(picks).filter(([number]) => byNumber.has(Number(number)));
  const rightCount = counted.filter(([, answer]) => answer === correct).length;

  function openPrint(perPage: 1 | 12) {
    const html = cardSheetHtml({
      className: 'lớp',
      count: Math.max(...students.map((student) => student.order_no), 0),
      perPage,
    });
    const opened = window.open('', '_blank');
    if (opened) {
      opened.document.open();
      opened.document.write(html);
      opened.document.close();
    }
  }

  function next() {
    const recorded: GameAnswer[] = counted.map(([number, answer]) => ({
      question_id: question.id,
      child_id: (byNumber.get(Number(number)) as { id: string }).id,
      group_name: null,
      answer,
      correct: answer === correct,
    }));
    const all = [...answers, ...recorded];
    setAnswers(all);
    setPicks({});
    setChecked(false);
    setScanning(false);
    if (position + 1 >= questions.length) {
      onFinish({
        title: `Thẻ đáp án giấy (${questions.length} câu)`,
        config: { cards: byNumber.size },
        group_scores: {},
        question_ids: questions.map((item) => item.id),
        answers: all,
      });
      return;
    }
    setPosition(position + 1);
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-section-title font-semibold">Thẻ đáp án giấy</h2>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => openPrint(12)}>In thẻ (12 thẻ một trang)</Button>
        <Button onClick={() => openPrint(1)}>In thẻ lẻ</Button>
      </div>
      <p className="text-label text-text-secondary">
        Mỗi học sinh một thẻ theo số thứ tự trong lớp. Giơ thẻ với chữ đáp án ở phía trên. Ảnh camera chỉ xử lý trên máy
        này, không gửi đi.
      </p>
      <QuestionView question={question} revealed={checked} label={`Câu ${position + 1} / ${questions.length}`} />
      {!checked ? (
        <Button onClick={() => setScanning(!scanning)}>{scanning ? 'Tắt camera' : 'Bật camera quét thẻ'}</Button>
      ) : null}
      {scanning && !checked ? (
        <Scanner onScanned={(cards) => cards.length && setPicks((previous) => mergeScans(previous, cards))} />
      ) : null}
      <p role="status" className="text-content font-medium">
        Đã nhận {counted.length} / {byNumber.size} thẻ
        {checked
          ? `; đúng ${rightCount} (${counted.length ? Math.round((rightCount / counted.length) * 100) : 0}%)`
          : ''}
      </p>
      <table aria-label="Đáp án theo học sinh" className="text-content">
        <tbody>
          {[...byNumber.values()]
            .sort((left, right) => left.order_no - right.order_no)
            .map((student) => {
              const pick = picks[student.order_no];
              return (
                <tr
                  key={student.id}
                  className={checked && pick ? (pick === correct ? 'text-success' : 'text-danger') : ''}
                >
                  <td className="pr-2">{student.order_no}</td>
                  <td className="pr-2">{student.full_name}</td>
                  <td>
                    <select
                      aria-label={`Đáp án của số ${student.order_no}`}
                      value={pick ?? ''}
                      disabled={checked}
                      onChange={(event) => {
                        const value = event.target.value as CardAnswer | '';
                        const nextPicks = { ...picks };
                        if (value) nextPicks[student.order_no] = value;
                        else delete nextPicks[student.order_no];
                        setPicks(nextPicks);
                      }}
                      className="rounded border border-border px-2 py-1"
                    >
                      <option value="">Chưa có</option>
                      {CARD_ANSWERS.map((answer) => (
                        <option key={answer} value={answer}>
                          {answer}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
      {!checked ? (
        <Button
          variant="primary"
          onClick={() => {
            setScanning(false);
            setChecked(true);
          }}
        >
          Chấm câu này
        </Button>
      ) : (
        <Button variant="primary" onClick={next}>
          {position + 1 >= questions.length ? 'Kết thúc và lưu' : 'Câu tiếp'}
        </Button>
      )}
      <Button onClick={onCancel}>Thôi</Button>
    </div>
  );
}
