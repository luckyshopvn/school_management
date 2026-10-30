import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, FORM_CONTROL_CLASS } from '@school-management/ui';
import { cleanImage } from '../clean-image.js';
import {
  fetchTutorImage,
  readTutorOverview,
  readTutorThread,
  reportTutorMessage,
  sendTutorMessage,
  tutorErrorMessage,
  type TutorMessage,
  type TutorOverview,
  type TutorThread,
} from './ai-tutor-api.js';
import { TUTOR_IMAGE_TYPES, tutorImagesProblem } from './ai-tutor-math.js';
import { ParentRequestButton } from './ParentRequestButton.js';
import { TurnMeter } from './TurnMeter.js';
import { TutorMarkdown } from './TutorMarkdown.js';

// Trang trò chuyện với gia sư AI (YCTD-383 lát L2, MH-597): chọn môn, hỏi, nhận gợi ý từng bước, thanh số lượt còn lại, "Xem lời giải đầy
// đủ" (mở sau hai lượt tự làm), "Báo câu trả lời sai", danh sách hội thoại cũ. Máy chủ quyết định lượt, kiểm duyệt, khóa.
// Lát L4: nút gửi ảnh bài tập (chỉ gói Nâng cao; gói khác khóa nút kèm lời nhắc nâng gói), xem trước ảnh, ảnh trong hội thoại, ảnh đã xóa
// sau 30 ngày, đề gia sư chép từ ảnh
const formatTime = (iso: string) =>
  new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(
    new Date(iso),
  );

const SOLUTION_ATTEMPTS = 2;

// Ảnh em đã gửi: tải kèm mã phiên rồi hiện; ảnh đã xóa sau 30 ngày chỉ còn nhãn
function TutorImage({ image }: { image: TutorMessage['images'][number] }) {
  const [url, setUrl] = useState<string>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (image.deleted) {
      return undefined;
    }
    let objectUrl: string | undefined;
    let active = true;
    fetchTutorImage(image.id)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) {
          setUrl(objectUrl);
        } else {
          URL.revokeObjectURL(objectUrl);
        }
      })
      .catch(() => setFailed(true));
    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [image.id, image.deleted]);
  if (image.deleted || failed) {
    return (
      <span className="rounded-lg border border-border bg-page px-2 py-1 text-label text-text-secondary">
        {image.deleted ? (image.deleted_label ?? 'Ảnh đã xóa sau 30 ngày') : 'Không tải được ảnh'}
      </span>
    );
  }
  return url ? (
    <img src={url} alt="Ảnh bài tập em gửi" className="max-h-48 max-w-full rounded-lg border border-border bg-page" />
  ) : (
    <span className="text-label">Đang tải ảnh…</span>
  );
}

function MessageBubble({
  message,
  onReport,
  canReport,
}: {
  message: TutorMessage;
  onReport(message: TutorMessage): void;
  canReport: boolean;
}) {
  if (message.role === 'student') {
    return (
      <li className="flex max-w-[88%] flex-col gap-1 self-end rounded-xl rounded-br-sm bg-brand px-3 py-2 text-label text-white">
        <span className="sr-only">Em hỏi:</span>
        {message.images.length > 0 ? (
          <span className="flex flex-wrap gap-2">
            {message.images.map((image) => (
              <TutorImage key={image.id} image={image} />
            ))}
          </span>
        ) : null}
        <span className="whitespace-pre-wrap break-words">{message.body}</span>
        {message.image_text ? (
          <span className="whitespace-pre-wrap break-words rounded-lg bg-page px-2 py-1 text-text">
            Ảnh em gửi đã được chép thành chữ: {message.image_text}
            <span className="block text-text-secondary">Đề chưa đúng thì em gõ lại đề ở câu tiếp theo nhé.</span>
          </span>
        ) : null}
      </li>
    );
  }
  return (
    <li className="flex max-w-[88%] flex-col gap-1 self-start rounded-xl rounded-bl-sm border border-border bg-page px-3 py-2 text-label text-text">
      <span className="sr-only">Gia sư trả lời:</span>
      {message.step_label ? (
        <span className="text-label font-semibold text-brand-strong">{message.step_label}</span>
      ) : null}
      <TutorMarkdown text={message.body} />
      {message.step !== 'safety' ? (
        message.reported ? (
          <span className="text-label text-text-secondary">Em đã báo câu trả lời này sai</span>
        ) : canReport ? (
          <div>
            <Button variant="text" className="px-0 py-1" onClick={() => onReport(message)}>
              Báo câu trả lời sai
            </Button>
          </div>
        ) : null
      ) : null}
    </li>
  );
}

export default function StudentAiTutorScreen({ onClose }: { onClose(): void }) {
  const [overview, setOverview] = useState<TutorOverview | null>(null);
  const [thread, setThread] = useState<TutorThread | null>(null);
  const [subjectCode, setSubjectCode] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [notice, setNotice] = useState<string>();
  // Ảnh đã nén, chờ gửi kèm câu hỏi; địa chỉ xem trước giải phóng khi bỏ ảnh hoặc rời trang
  const [images, setImages] = useState<Array<{ blob: Blob; url: string }>>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef(images);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);
  useEffect(() => () => imagesRef.current.forEach((image) => URL.revokeObjectURL(image.url)), []);

  function clearImages() {
    images.forEach((image) => URL.revokeObjectURL(image.url));
    setImages([]);
  }

  function removeImage(url: string) {
    URL.revokeObjectURL(url);
    setImages((current) => current.filter((image) => image.url !== url));
  }

  async function pickImages(list: FileList | null) {
    const picked = [...(list ?? [])];
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (!overview || picked.length === 0) {
      return;
    }
    const problem = tutorImagesProblem(picked, images.length, overview.images.max_count);
    if (problem) {
      setErrorMessage(problem);
      return;
    }
    try {
      const cleaned = await Promise.all(picked.map((file) => cleanImage(file)));
      if (cleaned.some((blob) => blob.size > overview.images.max_bytes)) {
        setErrorMessage(
          `Ảnh vượt ${Math.round(overview.images.max_bytes / 1024 / 1024)} MB, em chụp gần phần đề bài hơn nhé`,
        );
        return;
      }
      setErrorMessage(undefined);
      setImages((current) => [...current, ...cleaned.map((blob) => ({ blob, url: URL.createObjectURL(blob) }))]);
    } catch {
      setErrorMessage('Không đọc được ảnh, em chọn ảnh khác nhé');
    }
  }

  const loadOverview = useCallback(async () => {
    try {
      const next = await readTutorOverview();
      setOverview(next);
      setSubjectCode((current) => current || next.subjects[0]?.code || '');
    } catch (error) {
      setErrorMessage(tutorErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [thread?.messages.length]);

  async function openConversation(id: string) {
    setErrorMessage(undefined);
    setNotice(undefined);
    try {
      setThread(await readTutorThread(id));
    } catch (error) {
      setErrorMessage(tutorErrorMessage(error));
    }
  }

  function startNew() {
    setThread(null);
    setText('');
    clearImages();
    setErrorMessage(undefined);
    setNotice(undefined);
  }

  async function send(mode: 'hint' | 'solution') {
    if (sending) {
      return;
    }
    setSending(true);
    setErrorMessage(undefined);
    setNotice(undefined);
    try {
      const result = await sendTutorMessage(
        mode === 'solution'
          ? { conversation_id: thread?.conversation.id, mode }
          : thread
            ? { conversation_id: thread.conversation.id, text, mode }
            : { subject_code: subjectCode, text, mode },
        mode === 'hint' ? images.map((image) => image.blob) : [],
      );
      setThread((current) => ({
        conversation: result.conversation,
        messages: [
          ...(current?.conversation.id === result.conversation.id ? current.messages : []),
          ...result.messages,
        ],
        attempts: result.attempts,
        solution_unlocked: result.solution_unlocked,
      }));
      setText('');
      if (mode === 'hint') {
        clearImages();
      }
      if (result.turn === 'released') {
        setNotice('Câu này không tính lượt hỏi.');
      }
      setOverview((current) =>
        current
          ? {
              ...current,
              balance: result.balance,
              conversations: [
                result.conversation,
                ...current.conversations.filter((item) => item.id !== result.conversation.id),
              ],
            }
          : current,
      );
      // Lát L5: vừa hết lượt thì lấy lại trạng thái lời nhờ cha mẹ từ máy chủ để hiện nút "Gửi lời nhờ cha mẹ"
      if (result.balance.remaining === 0) {
        void readTutorOverview()
          .then((next) =>
            setOverview((current) => (current ? { ...current, parent_request: next.parent_request } : current)),
          )
          .catch(() => undefined);
      }
    } catch (error) {
      setErrorMessage(tutorErrorMessage(error));
    } finally {
      setSending(false);
    }
  }

  async function report(message: TutorMessage) {
    try {
      await reportTutorMessage(message.id);
      setThread((current) =>
        current
          ? {
              ...current,
              messages: current.messages.map((item) => (item.id === message.id ? { ...item, reported: true } : item)),
            }
          : current,
      );
      setNotice('Cảm ơn em đã báo. Nhà trường sẽ xem lại câu trả lời này.');
    } catch (error) {
      setErrorMessage(tutorErrorMessage(error));
    }
  }

  const locked = overview && !overview.access.allowed ? overview.access : null;
  const canAsk =
    overview !== null &&
    overview.subscribed &&
    overview.ready &&
    !locked &&
    overview.balance.remaining > 0 &&
    (thread !== null || subjectCode !== '');
  const remainingAttempts = Math.max(0, SOLUTION_ATTEMPTS - (thread?.attempts ?? 0));
  const imagesAllowed = overview?.images.allowed === true;
  const canPickImage = canAsk && imagesAllowed && images.length < (overview?.images.max_count ?? 0);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-page-title font-bold text-text">Gia sư AI</h1>
        <Button onClick={onClose}>Về trang chủ</Button>
      </header>
      {overview?.subscribed ? <TurnMeter balance={overview.balance} /> : null}
      {overview && !overview.subscribed ? (
        <Alert tone="warning">Em chưa có gói. Nhờ cha mẹ đăng ký Gia sư AI trong ứng dụng phụ huynh.</Alert>
      ) : null}
      {overview?.subscribed && overview.unavailable_reason ? (
        <Alert tone="info">{overview.unavailable_reason}</Alert>
      ) : null}
      {/* Trạng thái khóa theo bản mẫu MH-597 (YCTD-383 lát L3): tiêu đề đậm, dòng dưới là lý do và lúc mở lại */}
      {locked ? (
        <Alert tone="warning">
          <strong>{locked.title}</strong> {locked.message}
          {/* Lúc bị khóa em không gửi được câu nào, nên vẫn hiện nơi tìm giúp đỡ */}
          {locked.code !== 'read_only' ? (
            <span className="mt-1 block">
              Nếu em đang buồn hoặc bị bắt nạt, hãy nói với bố mẹ, thầy cô hoặc gọi miễn phí Tổng đài quốc gia bảo vệ
              trẻ em 111 (24 giờ mỗi ngày).
            </span>
          ) : null}
        </Alert>
      ) : null}
      {overview?.subscribed && overview.ready && overview.balance.remaining === 0 ? (
        <Alert tone="warning">
          Em đã dùng hết lượt hỏi. Nhờ cha mẹ mua thêm lượt hoặc gói tháng trong ứng dụng phụ huynh.
        </Alert>
      ) : null}
      {/* Lát L5: chưa có gói hoặc hết lượt thì gửi lời nhờ cha mẹ (MH-596) */}
      {overview ? (
        <ParentRequestButton key={JSON.stringify(overview.parent_request)} initial={overview.parent_request} />
      ) : null}
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {notice ? <Alert tone="info">{notice}</Alert> : null}

      <section aria-label="Hội thoại cũ" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex-1 text-label font-semibold text-text">Hội thoại cũ</h2>
          {thread ? <Button onClick={startNew}>Hỏi bài mới</Button> : null}
        </div>
        {overview && overview.conversations.length === 0 ? (
          <p className="text-label text-text-secondary">Em chưa có hội thoại nào. Lịch sử giữ 12 tháng.</p>
        ) : (
          <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
            {overview?.conversations.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  aria-current={thread?.conversation.id === item.id ? 'true' : undefined}
                  className={`flex w-full flex-wrap items-baseline gap-x-2 rounded-lg border px-3 py-2 text-left text-label ${
                    thread?.conversation.id === item.id ? 'border-brand bg-selected' : 'border-border bg-card'
                  }`}
                  onClick={() => void openConversation(item.id)}
                >
                  <span className="font-medium text-text">{item.topic ?? 'Chưa có chủ đề'}</span>
                  <span className="text-text-secondary">
                    {item.subject_name} · {formatTime(item.last_message_at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-label={thread ? `Hội thoại ${thread.conversation.subject_name}` : 'Câu hỏi mới'}
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      >
        {thread ? (
          <h2 className="text-label font-semibold text-text">
            {thread.conversation.subject_name}
            {thread.conversation.topic ? `: ${thread.conversation.topic}` : ''}
          </h2>
        ) : (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-label font-semibold text-text">Chọn môn</legend>
            <div className="flex flex-wrap gap-2">
              {overview?.subjects.map((subject) => (
                <button
                  key={subject.code}
                  type="button"
                  aria-pressed={subjectCode === subject.code}
                  className={`rounded-full border px-3 py-1 text-label ${
                    subjectCode === subject.code
                      ? 'border-brand bg-brand text-white'
                      : 'border-border-strong bg-card text-text'
                  }`}
                  onClick={() => setSubjectCode(subject.code)}
                >
                  {subject.name}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <ol aria-label="Tin nhắn" className="flex flex-col gap-2">
          {thread?.messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onReport={report}
              canReport={locked?.code !== 'read_only'}
            />
          ))}
        </ol>
        <div ref={endRef} />
        <p aria-live="polite" className="text-label text-text-secondary">
          {sending ? 'Gia sư đang trả lời…' : ''}
        </p>

        {thread ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={!thread.solution_unlocked || !canAsk || sending} onClick={() => void send('solution')}>
              Xem lời giải đầy đủ
            </Button>
            {!thread.solution_unlocked ? (
              <span className="text-label text-text-secondary">
                Em tự làm thêm {remainingAttempts} lượt để mở lời giải đầy đủ
              </span>
            ) : null}
          </div>
        ) : null}

        <form
          aria-label="Gửi câu hỏi cho gia sư"
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            void send('hint');
          }}
        >
          <label className="flex flex-1 flex-col gap-1 text-label text-text">
            {thread ? 'Câu trả lời hoặc câu hỏi tiếp của em' : 'Câu hỏi của em'}
            <textarea
              className={FORM_CONTROL_CLASS}
              rows={3}
              maxLength={2000}
              value={text}
              disabled={!canAsk}
              onChange={(event) => setText(event.target.value)}
            />
          </label>
          <Button
            type="submit"
            variant="primary"
            disabled={!canAsk || sending || (text.trim() === '' && images.length === 0)}
          >
            Gửi
          </Button>
        </form>
        {overview?.subscribed ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept={TUTOR_IMAGE_TYPES.join(',')}
                multiple
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(event) => void pickImages(event.target.files)}
              />
              <Button disabled={!canPickImage || sending} onClick={() => fileInputRef.current?.click()}>
                Gửi ảnh bài tập
              </Button>
              {imagesAllowed ? (
                <span className="text-label text-text-secondary">
                  Tối đa {overview.images.max_count} ảnh mỗi câu. Ảnh tự xóa sau {overview.images.retention_days} ngày.
                </span>
              ) : (
                <span className="text-label text-text-secondary">
                  Gửi ảnh bài tập chỉ có ở gói Nâng cao. Nhờ cha mẹ nâng gói trong ứng dụng phụ huynh.
                </span>
              )}
            </div>
            {images.length > 0 ? (
              <ul aria-label="Ảnh chờ gửi" className="flex flex-wrap gap-2">
                {images.map((image, index) => (
                  <li key={image.url} className="flex flex-col items-start gap-1">
                    <img
                      src={image.url}
                      alt={`Ảnh chờ gửi ${index + 1}`}
                      className="h-24 w-24 rounded-lg border border-border bg-page object-cover"
                    />
                    <Button variant="text" className="px-0 py-1" onClick={() => removeImage(image.url)}>
                      Bỏ ảnh {index + 1}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
            {imagesAllowed ? (
              <p className="text-label text-text-secondary">
                Chỉ chụp phần đề bài. Đừng chụp tên, khuôn mặt, số điện thoại hay giấy tờ: ảnh có thông tin cá nhân sẽ
                bị bỏ và không tính lượt.
              </p>
            ) : null}
          </div>
        ) : null}
        <p className="text-label text-text-secondary">
          Đừng gửi tên, số điện thoại, địa chỉ hay số định danh: câu có thông tin cá nhân sẽ bị chặn và không tính lượt.
        </p>
      </section>
    </main>
  );
}
