import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, ConfirmDialog, StatusBadge } from '@school-management/ui';
import { messageOf } from '../imports/import-api.js';
import type { StudentTransfer } from './students-api.js';
import { ImportPackageDialog } from './TransferPackageDialogs.js';
import {
  listInbox,
  MAILBOX_STATE_LABELS,
  readMailboxSettings,
  rejectMailboxPackage,
  searchMailboxDirectory,
  sendTransferPackage,
  updateMailboxSettings,
  type InboxItem,
  type MailboxDirectoryEntry,
} from './transfer-mailbox-api.js';
import { OPTIONAL_TRANSFER_PART_LABELS, type OptionalTransferPart } from './transfer-packages-api.js';

// Hộp thư chuyển trường giữa các trường trên nền tảng (YCTD-390 lát L2): bật nhận và gửi trong hệ thống (mặc định tắt), hộp hồ sơ
// chuyển đến qua hệ thống (MH-652), gửi gói cho trường trong danh bạ (MH-651). Chỉ hiện ở bản nhiều trường
const inputClass = 'mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
const formatDateTime = (value: string | null) => (value ? new Date(value).toLocaleString('vi-VN') : '');
const OPTIONAL_PARTS = Object.keys(OPTIONAL_TRANSFER_PART_LABELS) as OptionalTransferPart[];

export const MAILBOX_SETTINGS_KEY = ['student-transfers', 'mailbox', 'settings'];

export function useMailboxSettings() {
  return useQuery({ queryKey: MAILBOX_SETTINGS_KEY, queryFn: readMailboxSettings, staleTime: 60_000 });
}

export function SendPackageDialog({
  transfer,
  onDone,
  onCancel,
}: {
  transfer: StudentTransfer;
  onDone(message: string): void;
  onCancel(): void;
}) {
  const [search, setSearch] = useState('');
  const [school, setSchool] = useState<MailboxDirectoryEntry>();
  const [optional, setOptional] = useState<OptionalTransferPart[]>([]);
  const [consent, setConsent] = useState(false);
  const [application, setApplication] = useState(false);
  const directory = useQuery({
    queryKey: ['student-transfers', 'mailbox', 'directory', search],
    queryFn: () => searchMailboxDirectory(search.trim()),
  });
  const send = useMutation({
    mutationFn: () =>
      sendTransferPackage(transfer.id, {
        toSchoolId: school?.school_id ?? '',
        optionalParts: optional,
        consentRecorded: consent,
        applicationReceived: application,
      }),
    onSuccess: (result) => onDone(`Đã gửi gói ${result.package_code} cho ${result.to_school_name}`),
  });
  return (
    <ConfirmDialog
      open
      title={`Gửi hồ sơ qua hệ thống – ${transfer.full_name}`}
      confirmLabel="Ký và gửi gói"
      busy={send.isPending || !school || !application || (optional.length > 0 && !consent)}
      onCancel={onCancel}
      onConfirm={() => send.mutate()}
    >
      <div className="flex flex-col gap-3">
        <p className="text-label text-text-secondary">
          Gói được ký, mã hóa cho đúng trường đến; trường đến chỉ thấy gói này, không đọc được dữ liệu khác của trường.
          Danh bạ chỉ có trường đã bật nhận hồ sơ chuyển trường trong hệ thống.
        </p>
        <label className="text-label font-medium text-text">
          Tìm trường đến theo tên hoặc mã trường
          <input value={search} onChange={(event) => setSearch(event.target.value)} className={inputClass} />
        </label>
        {directory.isError ? <Alert tone="danger">{messageOf(directory.error)}</Alert> : null}
        <div role="radiogroup" aria-label="Trường đến" className="flex max-h-60 flex-col gap-2 overflow-y-auto">
          {(directory.data ?? []).map((entry) => (
            <label
              key={entry.school_id}
              className="flex items-start gap-2 rounded-lg border border-border p-3 text-content"
            >
              <input
                type="radio"
                name="truong-den"
                className="mt-1 h-5 w-5"
                checked={school?.school_id === entry.school_id}
                onChange={() => setSchool(entry)}
              />
              <span>
                <span className="font-medium">{entry.name}</span>
                <span className="block text-label text-text-secondary">
                  {[
                    entry.moet_code ? `Mã ${entry.moet_code}` : null,
                    entry.commune_name,
                    entry.school_levels.join(', '),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
            </label>
          ))}
          {directory.data && directory.data.length === 0 ? (
            <p className="text-label text-text-secondary">Không có trường nào phù hợp trong danh bạ.</p>
          ) : null}
        </div>
        <label className="flex items-start gap-2 text-content">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5"
            checked={application}
            onChange={(event) => setApplication(event.target.checked)}
          />
          Đã nhận đơn xin chuyển trường do cha mẹ hoặc người giám hộ ký
        </label>
        <h3 className="text-label font-semibold text-text">Chỉ gửi khi phụ huynh đồng ý</h3>
        {OPTIONAL_PARTS.map((part) => (
          <label key={part} className="flex items-start gap-2 text-content">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5"
              checked={optional.includes(part)}
              onChange={(event) =>
                setOptional(event.target.checked ? [...optional, part] : optional.filter((item) => item !== part))
              }
            />
            {OPTIONAL_TRANSFER_PART_LABELS[part]}
          </label>
        ))}
        {optional.length > 0 ? (
          <label className="flex items-start gap-2 text-content">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            Phụ huynh đã đồng ý bằng đơn giấy cho các mục chọn thêm (học sinh từ đủ 7 tuổi cũng đồng ý)
          </label>
        ) : null}
        {send.error ? <Alert tone="danger">{messageOf(send.error)}</Alert> : null}
      </div>
    </ConfirmDialog>
  );
}

export function TransferMailboxPanel({
  canApprove,
  onChanged,
}: {
  canApprove: boolean;
  onChanged(message: string): void;
}) {
  const queryClient = useQueryClient();
  const settings = useMailboxSettings();
  const [opening, setOpening] = useState<InboxItem>();
  const [rejecting, setRejecting] = useState<InboxItem>();
  const [note, setNote] = useState('');
  const enabled = settings.data?.available === true && settings.data.enabled;
  const inbox = useQuery({
    queryKey: ['student-transfers', 'mailbox', 'inbox'],
    queryFn: listInbox,
    enabled: enabled && canApprove,
  });
  const refresh = async (message: string) => {
    setOpening(undefined);
    setRejecting(undefined);
    onChanged(message);
    await queryClient.invalidateQueries({ queryKey: ['student-transfers'] });
    await queryClient.invalidateQueries({ queryKey: ['student-movements'] });
  };
  const toggle = useMutation({
    mutationFn: (next: boolean) => updateMailboxSettings(next),
    onSuccess: (result) =>
      void refresh(
        result.enabled
          ? 'Đã bật nhận, gửi hồ sơ chuyển trường trong hệ thống'
          : 'Đã tắt nhận, gửi hồ sơ chuyển trường trong hệ thống',
      ),
  });
  const reject = useMutation({
    mutationFn: () => rejectMailboxPackage(rejecting?.id ?? '', note.trim()),
    onSuccess: () => void refresh('Đã từ chối gói chuyển trường'),
  });
  if (!settings.data?.available) {
    return null;
  }
  const waiting = (inbox.data ?? []).filter((item) => item.state === 'sent' || item.state === 'opened');
  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      aria-label="Hộp thư chuyển trường"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-label font-semibold text-text">Chuyển trường trong hệ thống</h3>
        <StatusBadge tone={enabled ? 'success' : 'neutral'} label={enabled ? 'Đang bật' : 'Đang tắt'} />
      </div>
      <p className="text-label text-text-secondary">
        Bật thì trường có trong danh bạ chuyển trường, gửi và nhận gói hồ sơ đã ký, mã hóa với trường khác dùng School
        Management. Trường khác không đọc được dữ liệu của trường ngoài gói đã gửi.
      </p>
      {canApprove ? (
        <span className="flex flex-wrap gap-2">
          <Button disabled={toggle.isPending} onClick={() => toggle.mutate(!enabled)}>
            {enabled ? 'Tắt chuyển trường trong hệ thống' : 'Bật chuyển trường trong hệ thống'}
          </Button>
        </span>
      ) : null}
      {toggle.error ? <Alert tone="danger">{messageOf(toggle.error)}</Alert> : null}
      {enabled && canApprove ? (
        <>
          <h4 className="text-label font-semibold text-text">Hồ sơ chuyển đến qua hệ thống ({waiting.length} chờ)</h4>
          {inbox.isError ? <Alert tone="danger">{messageOf(inbox.error)}</Alert> : null}
          <ul className="flex flex-col gap-2">
            {(inbox.data ?? []).map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
                <span className="font-medium">{item.from_school_name}</span>
                <span className="text-label text-text-secondary">
                  {item.package_code} · gửi {formatDateTime(item.sent_at)}
                </span>
                <StatusBadge
                  tone={item.state === 'accepted' ? 'success' : item.state === 'rejected' ? 'danger' : 'warning'}
                  label={MAILBOX_STATE_LABELS[item.state]}
                />
                {item.state === 'sent' || item.state === 'opened' ? (
                  <span className="ml-auto flex flex-wrap gap-1">
                    <Button variant="text" onClick={() => setOpening(item)}>
                      Xem gói
                    </Button>
                    <Button
                      variant="text"
                      onClick={() => {
                        setNote('');
                        setRejecting(item);
                      }}
                    >
                      Từ chối
                    </Button>
                  </span>
                ) : null}
              </li>
            ))}
            {inbox.data && inbox.data.length === 0 ? (
              <li className="text-label text-text-secondary">Chưa có gói chuyển đến qua hệ thống.</li>
            ) : null}
          </ul>
        </>
      ) : null}
      {opening ? (
        <ImportPackageDialog
          mailboxId={opening.id}
          onDone={(message) => void refresh(message)}
          onCancel={() => setOpening(undefined)}
        />
      ) : null}
      {rejecting ? (
        <ConfirmDialog
          open
          title={`Từ chối gói ${rejecting.package_code}`}
          confirmLabel="Từ chối"
          busy={reject.isPending || !note.trim()}
          onCancel={() => setRejecting(undefined)}
          onConfirm={() => reject.mutate()}
        >
          <div className="flex flex-col gap-3">
            <p>Trường {rejecting.from_school_name} thấy lý do từ chối. Không ghi thông tin cá nhân của học sinh.</p>
            <label className="text-label font-medium text-text">
              Lý do từ chối
              <input
                value={note}
                maxLength={500}
                onChange={(event) => setNote(event.target.value)}
                className={inputClass}
              />
            </label>
            {reject.error ? <Alert tone="danger">{messageOf(reject.error)}</Alert> : null}
          </div>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
