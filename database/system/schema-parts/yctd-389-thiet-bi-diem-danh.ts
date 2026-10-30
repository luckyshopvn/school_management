import type { ColumnType, Generated } from 'kysely';

// Thiết bị điểm danh của trường, lát L2 (YCTD-389; migration hệ thống 0141_create_attendance_devices)
export type AttendanceDeviceKind = 'qr_scanner' | 'rfid_reader' | 'face_terminal' | 'camera_station';
export type AttendanceDeviceDirection = 'in' | 'out' | 'both';

export interface AttendanceDevicesTable {
  id: Generated<string>;
  org_unit_id: string;
  kind: AttendanceDeviceKind;
  name: string;
  location_name: string | null;
  direction: AttendanceDeviceDirection;
  key_hash: string;
  key_hint: string;
  last_seen_at: Date | null;
  disabled_at: Date | null;
  created_by: string;
  created_at: ColumnType<Date, Date | undefined, never>;
  updated_at: Generated<Date>;
}

declare module '../schema.js' {
  interface SystemDatabase {
    attendance_devices: AttendanceDevicesTable;
  }
}
