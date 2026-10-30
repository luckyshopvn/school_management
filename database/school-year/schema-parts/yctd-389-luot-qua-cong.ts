import type { Generated } from 'kysely';
import type { CreatedTimestamp } from '../schema.js';

// Thẻ QR và lượt qua cổng, lát L1 (YCTD-389; migration năm học 0240_create_gate_passes)
export type GatePassDirection = 'in' | 'out';
export type GatePassMethod = 'qr' | 'rfid' | 'device' | 'camera';
export type GatePassReviewStatus = 'confirmed' | 'needs_review' | 'rejected';

export interface GateCardsTable {
  id: Generated<string>;
  child_id: string;
  code: string;
  issued_by: string;
  issued_at: CreatedTimestamp;
  revoked_at: Date | null;
  revoked_by: string | null;
}

export interface GatePassesTable {
  id: Generated<string>;
  child_id: string;
  org_unit_id: string;
  direction: GatePassDirection;
  passed_at: Date;
  method: GatePassMethod;
  confidence: Generated<string>;
  review_status: Generated<GatePassReviewStatus>;
  gate_card_id: string | null;
  // Thiết bị gửi lượt (lát L2, migration 0245_add_gate_pass_device); thiết bị ở cơ sở dữ liệu hệ thống
  device_id: string | null;
  recorded_by: string | null;
  external_id: string | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  review_note: string | null;
  created_at: CreatedTimestamp;
}

declare module '../schema.js' {
  interface SchoolYearDatabase {
    gate_cards: GateCardsTable;
    gate_passes: GatePassesTable;
  }
}
