import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { AttendanceDeviceDirection, AttendanceDeviceKind, GatePassDirection } from '@school-management/database';
import { ApplicationError, Clock, validationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { CurrentUser } from '../authentication/current-user.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { notFoundError } from '../common/request-fields.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { StaffAttendanceService } from '../staff-attendance/staff-attendance.service.js';
import { GATE_CARD_CODE_PATTERN, normalizeGateCardCode } from './gate-pass-rules.js';
import { GatePassesService } from './gate-passes.service.js';
import { readPunchFile } from './punch-file.js';

// Thiết bị điểm danh, lát L2 (YCTD-389; tai_lieu/ban_mau/yctd-389/DAC_TA.md mục 3 phương án C, BM-232). Thiết bị gửi lượt qua cổng
// bằng khóa riêng (tiêu đề `x-device-key`), máy chủ chỉ lưu mã băm. Mã người trên thiết bị là mã thẻ QR của học sinh hoặc mã cán bộ.
// Thiết bị thật chưa nối; bộ giả lập ở scripts/gia-lap-may-cham-cong.mjs
export const MAXIMUM_EVENTS_PER_REQUEST = 500;
// Thiết bị gửi bù tối đa 7 ngày; thời điểm trong tương lai quá 5 phút (lệch đồng hồ) bị từ chối
const BACKFILL_DAYS = 7;
const CLOCK_SKEW_MILLISECONDS = 5 * 60 * 1000;
// Lượt gửi bù quá 30 phút thì không báo phụ huynh nữa
const NOTIFY_WINDOW_MILLISECONDS = 30 * 60 * 1000;
const DEVICE_COLUMNS = [
  'id',
  'org_unit_id',
  'kind',
  'name',
  'location_name',
  'direction',
  'key_hint',
  'last_seen_at',
  'disabled_at',
  'created_at',
] as const;

export interface DeviceInput {
  orgUnitId: string;
  kind: AttendanceDeviceKind;
  name: string;
  locationName: string | null;
  direction: AttendanceDeviceDirection;
}

export interface DeviceEvent {
  externalId: string;
  code: string;
  direction: GatePassDirection | null;
  occurredAt: Date;
}

export type DeviceEventStatus = 'recorded' | 'duplicate' | 'unchanged' | 'manual_kept' | 'unknown_code' | 'rejected';

interface DeviceRecord {
  id: string;
  org_unit_id: string;
  name: string;
  direction: AttendanceDeviceDirection;
  created_by: string;
  disabled_at: Date | null;
}

export function hashDeviceKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

function newDeviceKey(): { key: string; hash: string; hint: string } {
  const key = `tbd_${randomBytes(32).toString('base64url')}`;
  return { key, hash: hashDeviceKey(key), hint: key.slice(-4) };
}

@Injectable()
export class AttendanceDevicesService {
  constructor(
    private readonly databases: Databases,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly gatePasses: GatePassesService,
    private readonly staffAttendance: StaffAttendanceService,
    private readonly clock: Clock,
  ) {}

  // Thiết bị trong phạm vi quản lý thiết bị của người dùng (MH-641)
  async list(currentUser: CurrentUser) {
    const scope = await this.organizationScopes.resolve(currentUser, PERMISSION_CODES.gateDeviceManage);
    if (!scope.wholeSchool && scope.orgUnitIds.length === 0) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền quản lý thiết bị điểm danh');
    }
    return this.databases.system
      .selectFrom('attendance_devices')
      .select(DEVICE_COLUMNS)
      .$if(!scope.wholeSchool, (query) => query.where('org_unit_id', 'in', scope.orgUnitIds))
      .orderBy('created_at')
      .execute();
  }

  // Khai báo thiết bị; khóa chỉ trả một lần
  async create(currentUser: CurrentUser, input: DeviceInput, origin: ChangeOrigin) {
    await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.gateDeviceManage, input.orgUnitId);
    const secret = newDeviceKey();
    const device = await this.databases.system
      .insertInto('attendance_devices')
      .values({
        org_unit_id: input.orgUnitId,
        kind: input.kind,
        name: input.name,
        location_name: input.locationName,
        direction: input.direction,
        key_hash: secret.hash,
        key_hint: secret.hint,
        created_by: origin.actorUserId,
      })
      .returning(DEVICE_COLUMNS)
      .executeTakeFirstOrThrow();
    await this.audit(origin, device.org_unit_id, device.id, 'create', null, { name: device.name, kind: device.kind });
    return { ...device, key: secret.key };
  }

  // Đổi khóa (mất khóa, nghi lộ): khóa cũ hết hiệu lực ngay
  async rotateKey(currentUser: CurrentUser, deviceId: string, origin: ChangeOrigin) {
    const device = await this.findManaged(currentUser, deviceId);
    const secret = newDeviceKey();
    const updated = await this.databases.system
      .updateTable('attendance_devices')
      .set({ key_hash: secret.hash, key_hint: secret.hint, updated_at: this.clock.now() })
      .where('id', '=', device.id)
      .returning(DEVICE_COLUMNS)
      .executeTakeFirstOrThrow();
    await this.audit(origin, device.org_unit_id, device.id, 'update', null, { key_rotated: true });
    return { ...updated, key: secret.key };
  }

  // Tắt hoặc bật lại thiết bị; thiết bị tắt gửi lượt bị từ chối
  async setDisabled(currentUser: CurrentUser, deviceId: string, disabled: boolean, origin: ChangeOrigin) {
    const device = await this.findManaged(currentUser, deviceId);
    const updated = await this.databases.system
      .updateTable('attendance_devices')
      .set({ disabled_at: disabled ? this.clock.now() : null, updated_at: this.clock.now() })
      .where('id', '=', device.id)
      .returning(DEVICE_COLUMNS)
      .executeTakeFirstOrThrow();
    await this.audit(
      origin,
      device.org_unit_id,
      device.id,
      'update',
      { disabled: device.disabled_at !== null },
      { disabled },
    );
    return updated;
  }

  // Điểm nhận công khai của thiết bị: xác thực khóa, ghi từng lượt, trả kết quả từng lượt theo mã sự kiện của thiết bị
  async receive(rawKey: string | undefined, events: DeviceEvent[], ipAddress: string | null) {
    const device = await this.authenticate(rawKey);
    const now = this.clock.now();
    await this.databases.system
      .updateTable('attendance_devices')
      .set({ last_seen_at: now })
      .where('id', '=', device.id)
      .execute();
    const origin: ChangeOrigin = { actorUserId: device.created_by, actorName: `Thiết bị: ${device.name}`, ipAddress };
    const results = [];
    for (const event of events) {
      // Mã sự kiện chỉ duy nhất trong một thiết bị: ghép mã thiết bị để không trùng giữa các máy
      const scoped = { ...event, externalId: `thiet-bi:${device.id}:${event.externalId}` };
      results.push({ external_id: event.externalId, ...(await this.recordEvent(device, scoped, origin, now)) });
    }
    return { device_id: device.id, results };
  }

  // Nhập tệp xuất từ máy chấm công của một thiết bị (khi máy không gửi được qua mạng)
  async importFile(currentUser: CurrentUser, deviceId: string, fileName: string, body: Buffer, origin: ChangeOrigin) {
    const device = await this.findManaged(currentUser, deviceId);
    let rows;
    try {
      rows = await readPunchFile(fileName, body);
    } catch (error) {
      throw validationError([
        { field: 'file', message: error instanceof Error ? error.message : 'Không đọc được tệp' },
      ]);
    }
    const now = this.clock.now();
    const counts: Record<DeviceEventStatus, number> = {
      recorded: 0,
      duplicate: 0,
      unchanged: 0,
      manual_kept: 0,
      unknown_code: 0,
      rejected: 0,
    };
    const errors: Array<{ line: number; message: string }> = [];
    for (const row of rows) {
      if (row.error || !row.occurredAt) {
        counts.rejected++;
        errors.push({ line: row.line, message: row.error ?? 'Dòng không hợp lệ' });
        continue;
      }
      // Mã sự kiện dựng từ thiết bị, mã, thời điểm: nhập lại cùng tệp không ghi trùng
      const externalId = `tep:${hashDeviceKey(`${device.id}|${row.code}|${row.occurredAt.toISOString()}`).slice(0, 40)}`;
      const result = await this.recordEvent(
        device,
        { externalId, code: row.code, direction: row.direction, occurredAt: row.occurredAt },
        origin,
        now,
      );
      counts[result.status]++;
      if (result.status === 'rejected' || result.status === 'unknown_code') {
        errors.push({ line: row.line, message: result.message ?? 'Không ghi được' });
      }
    }
    return { total: rows.length, counts, errors: errors.slice(0, 50) };
  }

  private async recordEvent(
    device: DeviceRecord,
    event: DeviceEvent,
    origin: ChangeOrigin,
    now: Date,
  ): Promise<{ status: DeviceEventStatus; message?: string }> {
    const age = now.getTime() - event.occurredAt.getTime();
    if (age > BACKFILL_DAYS * 86_400_000 || age < -CLOCK_SKEW_MILLISECONDS) {
      return { status: 'rejected', message: `Thời điểm phải trong ${BACKFILL_DAYS} ngày gần nhất` };
    }
    const { database } = await this.currentSchoolYear.require();
    const code = normalizeGateCardCode(event.code);
    if (GATE_CARD_CODE_PATTERN.test(code)) {
      const card = await database
        .selectFrom('gate_cards')
        .select(['id', 'child_id'])
        .where('code', '=', code)
        .where('revoked_at', 'is', null)
        .executeTakeFirst();
      if (!card) {
        return { status: 'unknown_code', message: 'Không có thẻ còn hiệu lực với mã này' };
      }
      const child = await this.gatePasses.findChild(database, card.child_id);
      if (child.status !== 'active' || !(await this.covers(device, child.org_unit_id))) {
        return { status: 'rejected', message: 'Học sinh không thuộc đơn vị của thiết bị hoặc không còn học' };
      }
      const direction = event.direction ?? (device.direction === 'both' ? null : device.direction);
      if (!direction) {
        return { status: 'rejected', message: 'Thiết bị hai chiều phải gửi hướng vào hoặc ra' };
      }
      const pass = await this.gatePasses.recordChildPass(database, child, {
        direction,
        passedAt: event.occurredAt,
        method: 'device',
        gateCardId: card.id,
        deviceId: device.id,
        recordedBy: origin.actorUserId,
        externalId: event.externalId,
        notify: age <= NOTIFY_WINDOW_MILLISECONDS,
      });
      return { status: pass.duplicate ? 'duplicate' : 'recorded' };
    }
    const staff = await database
      .selectFrom('staff')
      .select('org_unit_id')
      .where('code', '=', event.code.trim())
      .executeTakeFirst();
    if (!staff) {
      return { status: 'unknown_code', message: 'Không có học sinh hoặc cán bộ với mã này' };
    }
    if (!(await this.covers(device, staff.org_unit_id))) {
      return { status: 'rejected', message: 'Cán bộ không thuộc đơn vị của thiết bị' };
    }
    try {
      const status = await this.staffAttendance.recordDevicePunch(
        database,
        event.code.trim(),
        event.occurredAt,
        origin,
      );
      return status === 'unknown_code' ? { status, message: 'Không có học sinh hoặc cán bộ với mã này' } : { status };
    } catch (error) {
      return { status: 'rejected', message: error instanceof ApplicationError ? error.message : 'Không ghi được' };
    }
  }

  // Thiết bị đặt ở trường chính nhận người của mọi đơn vị; thiết bị ở đơn vị cấp 2 chỉ nhận người của đơn vị đó
  private async covers(device: DeviceRecord, orgUnitId: string): Promise<boolean> {
    if (device.org_unit_id === orgUnitId) {
      return true;
    }
    const { database } = await this.currentSchoolYear.require();
    const unit = await database
      .selectFrom('org_units')
      .select('unit_type')
      .where('id', '=', device.org_unit_id)
      .executeTakeFirst();
    return unit?.unit_type === 'truong_chinh';
  }

  private async authenticate(rawKey: string | undefined): Promise<DeviceRecord> {
    if (!rawKey || rawKey.length > 200) {
      throw new ApplicationError('ERR_UNAUTHENTICATED', 'Thiếu hoặc sai khóa thiết bị');
    }
    const device = await this.databases.system
      .selectFrom('attendance_devices')
      .select(['id', 'org_unit_id', 'name', 'direction', 'created_by', 'disabled_at'])
      .where('key_hash', '=', hashDeviceKey(rawKey))
      .executeTakeFirst();
    if (!device || device.disabled_at !== null) {
      throw new ApplicationError('ERR_UNAUTHENTICATED', 'Thiếu hoặc sai khóa thiết bị');
    }
    return device;
  }

  private async findManaged(currentUser: CurrentUser, deviceId: string): Promise<DeviceRecord> {
    const device = await this.databases.system
      .selectFrom('attendance_devices')
      .select(['id', 'org_unit_id', 'name', 'direction', 'created_by', 'disabled_at'])
      .where('id', '=', deviceId)
      .executeTakeFirst();
    if (!device) {
      throw notFoundError('Không tìm thấy thiết bị', 'attendance_device');
    }
    await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.gateDeviceManage, device.org_unit_id);
    return device;
  }

  // Nhật ký thao tác nằm ở cơ sở dữ liệu năm học; chưa mở năm học thì bỏ qua (thiết bị vẫn khai báo được)
  private async audit(
    origin: ChangeOrigin,
    orgUnitId: string,
    deviceId: string,
    action: 'create' | 'update',
    before: unknown,
    after: unknown,
  ): Promise<void> {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return;
    }
    await writeAuditLog(current.database, {
      origin,
      orgUnitId,
      entityName: 'attendance_devices',
      entityId: deviceId,
      action,
      before: before as Record<string, unknown> | null,
      after: after as Record<string, unknown>,
    });
  }
}
