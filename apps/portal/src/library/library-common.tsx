import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { PortalQuickLinkPath } from '@school-management/shared';
import { Alert, Button, ConfirmDialog, TextField, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import {
  listTitles,
  lookupReaders,
  messageOf,
  READER_KIND_LABELS,
  type LibraryTitle,
  type Reader,
} from './library-api.js';

// Phần dùng chung của các trang thư viện (DT-22 phần 22a, YCTD-181): khung trang có tiêu đề và thông báo nổi, phân trang,
// chọn bạn đọc (quét số thẻ hoặc gõ tên), chọn ấn phẩm, hộp thoại nhập lý do
export const SELECT_CLASS = 'rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
export const TH_CLASS = 'px-3 py-2';
export const HEAD_CLASS = 'text-left text-label font-medium text-text-secondary';
export const PAGE_SIZE = 50;

export function useToast(): { message: string | undefined; show(message: string): void; close(): void } {
  const [message, setMessage] = useState<string>();
  const close = useCallback(() => setMessage(undefined), []);
  return { message, show: setMessage, close };
}

export function LibraryFrame({
  path,
  toast,
  children,
}: {
  path: PortalQuickLinkPath;
  toast: { message: string | undefined; close(): void };
  children: ReactNode;
}) {
  return (
    <AppShell>
      <Toast message={toast.message} onClose={toast.close} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle(path)}</h1>
        {children}
      </div>
    </AppShell>
  );
}

export function Panel({ children }: { children: ReactNode }) {
  return <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">{children}</section>;
}

export function TabBar<T extends string>({
  tabs,
  value,
  label,
  onChange,
}: {
  tabs: Record<T, string>;
  value: T;
  label: string;
  onChange(tab: T): void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label={label}>
      {(Object.keys(tabs) as T[]).map((code) => (
        <Button
          key={code}
          role="tab"
          aria-selected={value === code}
          variant={value === code ? 'primary' : 'secondary'}
          onClick={() => onChange(code)}
        >
          {tabs[code]}
        </Button>
      ))}
    </div>
  );
}

export function ErrorAlert({ error }: { error: unknown }) {
  return error ? <Alert tone="danger">{messageOf(error)}</Alert> : null;
}

export function Pager({
  total,
  offset,
  limit = PAGE_SIZE,
  onChange,
}: {
  total: number;
  offset: number;
  limit?: number;
  onChange(offset: number): void;
}) {
  if (total <= limit) {
    return <p className="text-label text-text-secondary">Tổng {total} dòng</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-3 text-label text-text-secondary">
      <span>
        {offset + 1} đến {Math.min(offset + limit, total)} trên tổng {total} dòng
      </span>
      <Button disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}>
        Trang trước
      </Button>
      <Button disabled={offset + limit >= total} onClick={() => onChange(offset + limit)}>
        Trang sau
      </Button>
    </div>
  );
}

export function describeReader(reader: Pick<Reader, 'full_name' | 'card_no' | 'reader_kind' | 'class_name'>): string {
  return `${reader.full_name} (${reader.card_no}, ${READER_KIND_LABELS[reader.reader_kind].toLowerCase()}${reader.class_name ? ` lớp ${reader.class_name}` : ''})`;
}

// Tìm bạn đọc theo số thẻ quét hoặc theo tên (ít nhất 2 ký tự); chọn một người trong kết quả
export function ReaderPicker({
  selected,
  onSelect,
  label = 'Bạn đọc (quét số thẻ hoặc gõ tên)',
}: {
  selected: Reader | undefined;
  onSelect(reader: Reader | undefined): void;
  label?: string;
}) {
  const [text, setText] = useState('');
  const search = useMutation({
    mutationFn: () => lookupReaders(text.trim()),
    onSuccess: (readers) => {
      if (readers.length === 1 && readers[0]) {
        onSelect(readers[0]);
        setText('');
      }
    },
  });
  if (selected) {
    return (
      <div className="flex flex-col gap-2 text-label font-medium text-text">
        {label}
        <div className="flex flex-wrap items-center gap-3 text-content font-normal">
          <span className="font-semibold">{describeReader(selected)}</span>
          {selected.status === 'locked' ? <span className="text-danger">Thẻ đang khóa</span> : null}
          <span className="text-text-secondary">
            Đang mượn {selected.open_loans}, quá hạn {selected.overdue_loans}
          </span>
          <Button onClick={() => onSelect(undefined)}>Chọn người khác</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (text.trim().length >= 2) {
            search.mutate();
          }
        }}
      >
        <TextField label={label} value={text} onChange={(event) => setText(event.target.value)} />
        <Button type="submit" disabled={search.isPending || text.trim().length < 2}>
          Tìm bạn đọc
        </Button>
      </form>
      <ErrorAlert error={search.error} />
      {search.data && search.data.length === 0 ? (
        <Alert tone="info">Không thấy bạn đọc. Cấp thẻ ở 1.2 Bạn đọc (nút Đồng bộ thẻ) rồi thử lại.</Alert>
      ) : null}
      {search.data && search.data.length > 1 ? (
        <ul className="flex flex-col gap-1 text-content">
          {search.data.map((reader) => (
            <li key={reader.id}>
              <Button variant="text" onClick={() => onSelect(reader)}>
                {describeReader(reader)}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// Tìm ấn phẩm theo từ khóa rồi chọn một đầu sách
export function TitlePicker({
  label = 'Tìm ấn phẩm',
  actionLabel = 'Chọn',
  onPick,
}: {
  label?: string;
  actionLabel?: string;
  onPick(title: LibraryTitle): void;
}) {
  const [text, setText] = useState('');
  const search = useMutation({ mutationFn: () => listTitles({ query: text.trim(), limit: 10, offset: 0 }) });
  return (
    <div className="flex flex-col gap-2">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          search.mutate();
        }}
      >
        <TextField label={label} value={text} onChange={(event) => setText(event.target.value)} />
        <Button type="submit" disabled={search.isPending}>
          Tìm
        </Button>
      </form>
      <ErrorAlert error={search.error} />
      {search.data && search.data.items.length === 0 ? <Alert tone="info">Không có ấn phẩm phù hợp.</Alert> : null}
      {search.data && search.data.items.length > 0 ? (
        <ul className="flex flex-col gap-1 text-content">
          {search.data.items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-3">
              <span>
                {item.title}
                {item.authors ? ` · ${item.authors}` : ''} ({item.category_name}, sẵn sàng {item.copies_available}/
                {item.copies_total})
              </span>
              <Button onClick={() => onPick(item)}>{actionLabel}</Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// Hộp thoại nhập lý do (khóa thẻ, thanh lý, báo mất, xử lý bản thiếu)
export function ReasonDialog({
  open,
  title,
  description,
  label = 'Lý do',
  confirmLabel,
  required = true,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  label?: string;
  confirmLabel: string;
  required?: boolean;
  busy?: boolean;
  onConfirm(reason: string): void;
  onCancel(): void;
}) {
  const [reason, setReason] = useState('');
  const [attempted, setAttempted] = useState(false);
  useEffect(() => {
    if (open) {
      setReason('');
      setAttempted(false);
    }
  }, [open]);
  return (
    <ConfirmDialog
      open={open}
      title={title}
      confirmLabel={confirmLabel}
      busy={busy}
      onConfirm={() => {
        if (required && reason.trim() === '') {
          setAttempted(true);
          return;
        }
        onConfirm(reason.trim());
      }}
      onCancel={onCancel}
    >
      <div className="flex flex-col gap-3">
        <p>{description}</p>
        <TextField
          label={label}
          value={reason}
          error={attempted && required && reason.trim() === '' ? 'Bắt buộc nhập' : undefined}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>
    </ConfirmDialog>
  );
}

export function EmptyRow({ columns, message }: { columns: number; message: string }) {
  return (
    <tr>
      <td colSpan={columns} className="px-3 py-4 text-center text-text-secondary">
        {message}
      </td>
    </tr>
  );
}

export function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}
