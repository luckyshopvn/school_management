import { requestJson } from '../session/api-client.js';
import type { OptionalTransferPart, TransferPackagePreview } from './transfer-packages-api.js';

// Hộp thư chuyển trường giữa các trường trên nền tảng (YCTD-390 lát L2)
export type MailboxState = 'sent' | 'opened' | 'accepted' | 'rejected' | 'revoked' | 'expired';
export const MAILBOX_STATE_LABELS: Record<MailboxState, string> = {
  sent: 'Đã gửi, chờ trường đến',
  opened: 'Trường đến đang xem',
  accepted: 'Trường đến đã tiếp nhận',
  rejected: 'Trường đến từ chối',
  revoked: 'Đã thu hồi',
  expired: 'Hết hạn',
};

export interface MailboxSettings {
  available: boolean;
  enabled: boolean;
  updated_by_name: string | null;
  updated_at: string | null;
}

export interface MailboxDirectoryEntry {
  school_id: string;
  name: string;
  moet_code: string | null;
  commune_name: string | null;
  school_levels: string[];
}

export interface OutboxItem {
  id: string;
  package_code: string;
  state: MailboxState;
  decision_note: string | null;
  sent_at: string;
  decided_at: string | null;
  expires_at: string;
  to_school_name: string;
}

export interface InboxItem {
  id: string;
  package_code: string;
  state: MailboxState;
  sent_at: string;
  decided_at: string | null;
  expires_at: string;
  from_school_name: string;
  from_school_moet_code: string | null;
}

const send = <T>(method: string, path: string, body?: unknown) =>
  requestJson<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });

export const readMailboxSettings = () => requestJson<MailboxSettings>('/api/v1/student-transfers/mailbox/settings');
export const updateMailboxSettings = (enabled: boolean) =>
  send<MailboxSettings>('PUT', '/api/v1/student-transfers/mailbox/settings', { enabled });
export const searchMailboxDirectory = (query: string) =>
  requestJson<MailboxDirectoryEntry[]>(`/api/v1/student-transfers/mailbox/directory?q=${encodeURIComponent(query)}`);
export const listOutbox = () => requestJson<OutboxItem[]>('/api/v1/student-transfers/mailbox/outbox');
export const listInbox = () => requestJson<InboxItem[]>('/api/v1/student-transfers/mailbox/inbox');

export const sendTransferPackage = (
  transferId: string,
  input: {
    toSchoolId: string;
    optionalParts: OptionalTransferPart[];
    consentRecorded: boolean;
    applicationReceived: boolean;
  },
) =>
  send<{ mailbox_id: string; package_code: string; to_school_name: string; state: MailboxState }>(
    'POST',
    `/api/v1/student-transfers/${transferId}/send`,
    {
      to_school_id: input.toSchoolId,
      optional_parts: input.optionalParts,
      consent_recorded: input.consentRecorded,
      application_received: input.applicationReceived,
    },
  );

export const revokeTransferPackage = (transferId: string) =>
  send<{ state: MailboxState }>('POST', `/api/v1/student-transfers/${transferId}/revoke`);

export const previewMailboxPackage = (mailboxId: string) =>
  send<TransferPackagePreview & { mailbox_id: string }>(
    'POST',
    `/api/v1/student-transfers/mailbox/${mailboxId}/preview`,
  );

export const acceptMailboxPackage = (
  mailboxId: string,
  input: { classId: string; fromDate: string; confirmOverCapacity: boolean },
) =>
  send<{
    errors: Array<{ row: number; column: string | null; message: string }>;
    transfer_id: string | null;
    child_id: string | null;
  }>('POST', `/api/v1/student-transfers/mailbox/${mailboxId}/accept`, {
    class_id: input.classId,
    ...(input.fromDate ? { from_date: input.fromDate } : {}),
    confirm_over_capacity: input.confirmOverCapacity,
  });

export const rejectMailboxPackage = (mailboxId: string, note: string) =>
  send<{ state: MailboxState }>('POST', `/api/v1/student-transfers/mailbox/${mailboxId}/reject`, { note });
