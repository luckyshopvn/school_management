import { useEffect, useRef, useState } from 'react';
import { WEBSITE_STATUS_LABELS, type WebsiteContentStatus } from '@school-management/shared';
import { ConfirmDialog, FORM_CONTROL_CLASS, StatusBadge, type StatusTone } from '@school-management/ui';
import { fileObjectUrl, type WebsiteEvent } from './website-api.js';

// Phần dùng chung của các màn hình Website trường (DT-18 phần 18f, YCTD-144)
const STATUS_TONES: Record<WebsiteContentStatus, StatusTone> = {
  draft: 'neutral',
  pending: 'warning',
  published: 'success',
  unpublished: 'danger',
};

export function ContentStatus({ status }: { status: WebsiteContentStatus }) {
  return <StatusBadge tone={STATUS_TONES[status]} label={WEBSITE_STATUS_LABELS[status]} />;
}

const DATE_TIME = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export const formatDateTime = (value: string | null | undefined) => (value ? DATE_TIME.format(new Date(value)) : '');

const ACTION_LABELS: Record<string, string> = {
  create: 'Tạo mới',
  update: 'Sửa',
  submit: 'Gửi duyệt',
  approve: 'Duyệt và đăng',
  return: 'Trả lại',
  unpublish: 'Gỡ xuống',
  file_add: 'Thêm tệp',
  file_delete: 'Xóa tệp',
  cover: 'Đổi ảnh bìa',
  delete: 'Xóa',
};

export function EventHistory({ events }: { events: WebsiteEvent[] }) {
  if (events.length === 0) {
    return null;
  }
  return (
    <details className="text-label text-text-secondary">
      <summary className="cursor-pointer font-medium text-text">Lịch sử ({events.length})</summary>
      <ul className="mt-2 flex flex-col gap-1">
        {events.map((event) => (
          <li key={event.id}>
            {formatDateTime(event.created_at)} · {event.actor_name} · {ACTION_LABELS[event.action] ?? event.action}
            {event.note ? `: ${event.note}` : ''}
          </li>
        ))}
      </ul>
    </details>
  );
}

// Ảnh trong trang quản trị: tải bằng phiên đăng nhập rồi hiện qua địa chỉ blob
export function AdminImage({ fileId, alt, className }: { fileId: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let active = true;
    let created: string | undefined;
    fileObjectUrl(fileId)
      .then((value) => {
        created = value;
        if (active) {
          setUrl(value);
        } else {
          URL.revokeObjectURL(value);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
      if (created) {
        URL.revokeObjectURL(created);
      }
    };
  }, [fileId]);
  return url ? (
    <img src={url} alt={alt} className={className} />
  ) : (
    <span className={`${className ?? ''} inline-block bg-page`} />
  );
}

// Hộp nhập lý do bắt buộc (trả lại, gỡ xuống)
export function ReasonDialog({
  open,
  title,
  label,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  label: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm(reason: string): void;
  onCancel(): void;
}) {
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (open) {
      setReason('');
    }
  }, [open]);
  return (
    <ConfirmDialog
      open={open}
      title={title}
      confirmLabel={confirmLabel}
      busy={busy}
      onCancel={onCancel}
      onConfirm={() => {
        if (reason.trim()) {
          onConfirm(reason.trim());
        }
      }}
    >
      <label className="flex flex-col gap-1 text-label font-medium text-text">
        {label}
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          maxLength={1000}
          className={FORM_CONTROL_CLASS}
        />
      </label>
    </ConfirmDialog>
  );
}

// Ô soạn nội dung có định dạng: in đậm, nghiêng, gạch chân, tiêu đề, danh sách, trích dẫn, liên kết. Máy chủ lọc lại HTML
// theo danh sách thẻ cho phép trước khi lưu
const TOOLS: Array<{ label: string; title: string; command: string; value?: string }> = [
  { label: 'B', title: 'In đậm', command: 'bold' },
  { label: 'I', title: 'In nghiêng', command: 'italic' },
  { label: 'U', title: 'Gạch chân', command: 'underline' },
  { label: 'H2', title: 'Tiêu đề lớn', command: 'formatBlock', value: 'h2' },
  { label: 'H3', title: 'Tiêu đề nhỏ', command: 'formatBlock', value: 'h3' },
  { label: 'Đoạn', title: 'Đoạn văn', command: 'formatBlock', value: 'p' },
  { label: '• Danh sách', title: 'Danh sách dấu chấm', command: 'insertUnorderedList' },
  { label: '1. Danh sách', title: 'Danh sách đánh số', command: 'insertOrderedList' },
  { label: '“ ”', title: 'Trích dẫn', command: 'formatBlock', value: 'blockquote' },
];

export function RichTextEditor({
  value,
  onChange,
  label,
  disabled,
}: {
  value: string;
  onChange(html: string): void;
  label: string;
  disabled?: boolean;
}) {
  const editor = useRef<HTMLDivElement>(null);
  // Chỉ đặt nội dung khi giá trị đổi từ ngoài (mở bài khác), để con trỏ không nhảy khi gõ
  useEffect(() => {
    if (editor.current && editor.current.innerHTML !== value) {
      editor.current.innerHTML = value;
    }
  }, [value]);
  const run = (command: string, argument?: string) => {
    editor.current?.focus();
    document.execCommand(command, false, argument);
    onChange(editor.current?.innerHTML ?? '');
  };
  return (
    <div className="flex flex-col rounded-lg border border-border bg-card">
      {!disabled ? (
        <div role="toolbar" aria-label="Định dạng nội dung" className="flex flex-wrap gap-1 border-b border-border p-1">
          {TOOLS.map((tool) => (
            <button
              key={tool.title}
              type="button"
              title={tool.title}
              aria-label={tool.title}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => run(tool.command, tool.value)}
              className="rounded px-2 py-1 text-label text-text hover:bg-selected"
            >
              {tool.label}
            </button>
          ))}
          <button
            type="button"
            title="Chèn liên kết"
            aria-label="Chèn liên kết"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              const url = window.prompt('Địa chỉ liên kết (https://...)');
              if (url && /^(https?:\/\/|mailto:|tel:)/i.test(url)) {
                run('createLink', url);
              }
            }}
            className="rounded px-2 py-1 text-label text-text hover:bg-selected"
          >
            Liên kết
          </button>
        </div>
      ) : null}
      <div
        ref={editor}
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={() => onChange(editor.current?.innerHTML ?? '')}
        className="prose min-h-48 max-w-none p-3 text-content text-text outline-none [&_h2]:text-lg [&_h2]:font-bold [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6"
      />
    </div>
  );
}
