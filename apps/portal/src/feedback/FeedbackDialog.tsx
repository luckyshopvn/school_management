import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, Button, DIALOG_NARROW_FULL_SCREEN_CLASS } from '@school-management/ui';
import { ApiError } from '../session/api-client.js';
import { FEEDBACK_TYPE_LABELS, submitFeedback, type FeedbackInput, type FeedbackType } from './feedback-api.js';

// Biểu mẫu "Gửi phản hồi" mở từ chân trang (DT-15 phần 15g, YCTD-110) theo biểu mẫu của Sở: trang đang mở, loại ý kiến,
// tiêu đề, nội dung, số điện thoại, thư điện tử liên hệ, ảnh chụp màn hình (JPEG, PNG tối đa 5 MB). Nhãn bên trái, nút
// Gửi; quy tắc do máy chủ kiểm tra
const MAXIMUM_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const inputClass =
  'w-full rounded-lg border bg-card px-3 py-2 text-content text-text outline-none focus:border-border-strong focus:ring-2 focus:ring-selected';

function Row({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-1 md:grid-cols-[10rem_1fr] md:items-start md:gap-3">
      <label htmlFor={htmlFor} className="text-label font-medium text-text md:pt-2">
        {label}
      </label>
      <div className="flex flex-col gap-1">
        {children}
        {error ? (
          <p id={`${htmlFor}-error`} className="text-label text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

const emptyInput = (pageUrl: string): FeedbackInput => ({
  feedback_type: '',
  title: '',
  content: '',
  page_url: pageUrl,
  contact_phone: '',
  contact_email: '',
  attachment: null,
});

export function FeedbackDialog({
  pageUrl,
  onClose,
  onSent,
}: {
  pageUrl: string;
  onClose(): void;
  onSent(message: string): void;
}) {
  const dialogReference = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const id = useId();
  const queryClient = useQueryClient();
  const [input, setInput] = useState<FeedbackInput>(() => emptyInput(pageUrl));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string>();
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const dialog = dialogReference.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  const field = (name: keyof FeedbackInput) => `${id}-${name}`;
  const describedBy = (name: keyof FeedbackInput) => (errors[name] ? `${field(name)}-error` : undefined);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setErrorMessage(undefined);
    if (input.attachment && input.attachment.size > MAXIMUM_ATTACHMENT_BYTES) {
      setErrors({ attachment: 'Ảnh đính kèm tối đa 5 MB' });
      return;
    }
    setSending(true);
    try {
      await submitFeedback(input);
      await queryClient.invalidateQueries({ queryKey: ['my-feedback'] });
      onSent('Đã gửi ý kiến phản hồi');
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
        setErrors(Object.fromEntries(error.details.map((detail) => [detail.field, detail.message])));
      } else {
        setErrorMessage('Không kết nối được tới máy chủ, vui lòng thử lại');
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <dialog
      ref={dialogReference}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className={`m-auto w-full max-w-2xl rounded-xl border border-border bg-card p-6 text-text shadow-lg backdrop:bg-text/40 ${DIALOG_NARROW_FULL_SCREEN_CLASS}`}
    >
      <form onSubmit={send} noValidate className="flex flex-col gap-4">
        <h2 id={titleId} className="text-section-title font-semibold">
          Gửi phản hồi
        </h2>
        {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
        <Row label="Đường dẫn trang" htmlFor={field('page_url')}>
          <input id={field('page_url')} className={`${inputClass} border-border`} value={input.page_url} readOnly />
        </Row>
        <Row label="Loại ý kiến" htmlFor={field('feedback_type')} error={errors.feedback_type}>
          <select
            id={field('feedback_type')}
            className={`${inputClass} ${errors.feedback_type ? 'border-danger' : 'border-border'}`}
            value={input.feedback_type}
            aria-invalid={errors.feedback_type ? true : undefined}
            aria-describedby={describedBy('feedback_type')}
            onChange={(event) => setInput({ ...input, feedback_type: event.target.value as FeedbackType | '' })}
          >
            <option value="">Chọn loại ý kiến</option>
            {(Object.keys(FEEDBACK_TYPE_LABELS) as FeedbackType[]).map((type) => (
              <option key={type} value={type}>
                {FEEDBACK_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Tiêu đề" htmlFor={field('title')} error={errors.title}>
          <input
            id={field('title')}
            className={`${inputClass} ${errors.title ? 'border-danger' : 'border-border'}`}
            maxLength={200}
            value={input.title}
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={describedBy('title')}
            onChange={(event) => setInput({ ...input, title: event.target.value })}
          />
        </Row>
        <Row label="Nội dung" htmlFor={field('content')} error={errors.content}>
          <textarea
            id={field('content')}
            rows={5}
            maxLength={5000}
            className={`${inputClass} ${errors.content ? 'border-danger' : 'border-border'}`}
            value={input.content}
            aria-invalid={errors.content ? true : undefined}
            aria-describedby={describedBy('content')}
            onChange={(event) => setInput({ ...input, content: event.target.value })}
          />
        </Row>
        <Row label="Số điện thoại" htmlFor={field('contact_phone')} error={errors.contact_phone}>
          <input
            id={field('contact_phone')}
            inputMode="tel"
            className={`${inputClass} ${errors.contact_phone ? 'border-danger' : 'border-border'}`}
            value={input.contact_phone}
            aria-invalid={errors.contact_phone ? true : undefined}
            aria-describedby={describedBy('contact_phone')}
            onChange={(event) => setInput({ ...input, contact_phone: event.target.value })}
          />
        </Row>
        <Row label="Thư điện tử" htmlFor={field('contact_email')} error={errors.contact_email}>
          <input
            id={field('contact_email')}
            type="email"
            className={`${inputClass} ${errors.contact_email ? 'border-danger' : 'border-border'}`}
            value={input.contact_email}
            aria-invalid={errors.contact_email ? true : undefined}
            aria-describedby={describedBy('contact_email')}
            onChange={(event) => setInput({ ...input, contact_email: event.target.value })}
          />
        </Row>
        <Row label="Ảnh chụp màn hình" htmlFor={field('attachment')} error={errors.attachment}>
          <input
            id={field('attachment')}
            type="file"
            accept="image/png,image/jpeg"
            className="text-label"
            aria-describedby={describedBy('attachment')}
            onChange={(event) => setInput({ ...input, attachment: event.target.files?.[0] ?? null })}
          />
          <p className="text-label text-text-secondary">Không bắt buộc; ảnh JPEG hoặc PNG, tối đa 5 MB.</p>
        </Row>
        <div className="flex justify-end gap-3">
          <Button onClick={onClose} disabled={sending}>
            Hủy
          </Button>
          <Button type="submit" variant="primary" disabled={sending}>
            {sending ? 'Đang gửi…' : 'Gửi'}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
