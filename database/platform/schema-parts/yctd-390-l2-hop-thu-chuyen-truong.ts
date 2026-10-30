import type { ColumnType, Generated } from 'kysely';

// Hộp thư chuyển trường, lát L2 (YCTD-390; migration nền tảng 0258_create_student_transfer_mailbox)
export type TransferMailboxState = 'sent' | 'opened' | 'accepted' | 'rejected' | 'revoked' | 'expired';

export interface WrappedTransferSecret {
  ephemeral_public_key: string;
  iv: string;
  ciphertext: string;
  tag: string;
}

export interface SchoolTransferSettingsTable {
  school_id: string;
  enabled: Generated<boolean>;
  updated_by_name: string | null;
  updated_at: Generated<Date>;
}

export interface SchoolTransferKeysTable {
  school_id: string;
  encryption_public_key: string;
  encryption_private_key_encrypted: string;
  signing_public_key: string;
  signing_private_key_encrypted: string;
  created_at: Generated<Date>;
}

export interface TransferMailboxTable {
  id: Generated<string>;
  kind: 'student_transfer';
  package_code: string;
  from_school_id: string;
  to_school_id: string;
  state: Generated<TransferMailboxState>;
  envelope: Buffer | null;
  wrapped_secret: ColumnType<WrappedTransferSecret | null, string | null, string | null>;
  envelope_sha256: string;
  signature: string;
  decision_note: string | null;
  sent_at: Generated<Date>;
  decided_at: Date | null;
  expires_at: Date;
  purge_after: Date | null;
  updated_at: Generated<Date>;
}

declare module '../schema.js' {
  interface PlatformDatabase {
    school_transfer_settings: SchoolTransferSettingsTable;
    school_transfer_keys: SchoolTransferKeysTable;
    transfer_mailbox: TransferMailboxTable;
  }
}
