import { Inject, Injectable, Optional } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, currentTenant, validationError } from '@school-management/server';
import {
  participantMinutes,
  parseVideoIdentity,
  parseVideoRoomName,
  PERMISSION_CODES,
  videoGrantsFor,
  videoIdentity,
  videoRoomName,
  type VideoRoomRole,
} from '@school-management/shared';
import type { Kysely, Transaction } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { notFoundError } from '../common/request-fields.js';
import { VIDEO_PROVIDER, type VideoRoomEvent, type VideoRoomProvider } from './video-provider.js';

// Lớp video trực tiếp (DT-27 phần 27a, YCTD-251; tài liệu 47 mục 19.2 phần 3, 4 và 19.5). Từ YCTD-384 lát L2 (Eric chốt ngày
// 2026-10-30) chương trình gia sư trong trường bị bỏ: không còn phòng của buổi gia sư, ghi hình, bản ghi, đồng ý ghi hình của cha mẹ.
// Phần còn lại dùng chung cho giờ học trực tuyến (DT-28 phần 28g):
// - cấu hình của trường (số người dự tối đa một phòng), bộ nối máy chủ video, tên phòng theo trường;
// - phòng tức thời do giáo viên mở, chỉ chủ phòng và Ban Giám hiệu (quyền quyết định dạy học trực tuyến) vào được;
// - mã vào phòng chỉ dùng để vào trong 10 phút, cấp lại mỗi lần vào;
// - nhật ký vào ra từ sự kiện gọi lại của máy chủ video; phút người dự mỗi tháng theo gói: vượt thì không mở phòng mới, không cấp mã vào.
type Database = Kysely<SchoolYearDatabase>;
type Executor = Database | Transaction<SchoolYearDatabase>;

export const VIDEO_RULE_CODE = 'YCTD-251';
const MANAGE = PERMISSION_CODES.learningDecide;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ZONE_OFFSET = 7 * 3600_000;
// Mã định danh của dòng cấu hình video duy nhất trong nhật ký thao tác
const SETTINGS_ENTITY_ID = '00000000-0000-4000-8000-000000000251';

interface RoomRow {
  id: string;
  kind: 'session' | 'instant';
  title: string;
  host_user_id: string;
  host_name: string;
  status: 'open' | 'ended';
  max_participants: number;
  lobby_enabled: boolean;
}

// Phòng của phần khác dùng chung bộ nối, tên phòng và giới hạn phút của 27a (DT-28 phần 28g: giờ học trực tuyến, phòng nhóm):
// sự kiện gọi lại của phòng không thuộc bảng `video_rooms` chuyển cho phần đã đăng ký; phút người dự của phần đó cộng vào phút của gói
export interface VideoRoomExtension {
  handleEvent(database: Executor, roomId: string, event: VideoRoomEvent): Promise<boolean>;
  usageEvents(database: Executor, since: Date): Promise<Array<{ identity: string; kind: 'join' | 'leave'; at: Date }>>;
}

export interface JoinResult {
  status: 'ready' | 'waiting';
  room_id: string;
  title: string;
  role: VideoRoomRole;
  identity: string;
  url?: string;
  token?: string;
  can_speak?: boolean;
  can_share?: boolean;
}

@Injectable()
export class VideoRoomsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly clock: Clock,
    @Optional() @Inject(VIDEO_PROVIDER) private readonly provider: VideoRoomProvider | null = null,
  ) {}

  private readonly extensions: VideoRoomExtension[] = [];

  registerExtension(extension: VideoRoomExtension) {
    this.extensions.push(extension);
  }

  // Video chưa bật ở máy chủ thì báo rõ
  private requireProvider(): VideoRoomProvider {
    if (!this.provider) {
      throw new ApplicationError('ERR_CONFLICT', 'Máy chủ chưa bật lớp video trực tiếp');
    }
    return this.provider;
  }

  private async database(): Promise<Database> {
    return (await this.currentSchoolYear.require()).database;
  }

  // Phần trường trong tên phòng: mã trường ở chế độ nhiều trường, `local` ở chế độ một trường
  private schoolPart(): string {
    return currentTenant()?.schoolId ?? 'local';
  }

  roomNameOf(roomId: string): string {
    return videoRoomName(this.schoolPart(), roomId);
  }

  status() {
    return { enabled: this.provider !== null, provider: this.provider?.code ?? null };
  }

  // ---------- Cấu hình của trường

  async settings() {
    const database = await this.database();
    return database
      .selectFrom('video_settings')
      .select(['max_participants', 'updated_by_name', 'updated_at'])
      .executeTakeFirstOrThrow();
  }

  async saveSettings(currentUser: CurrentUser, body: Record<string, unknown> | undefined, origin: ChangeOrigin) {
    const database = await this.database();
    const max = body?.max_participants;
    if (typeof max !== 'number' || !Number.isInteger(max) || max < 2 || max > 50) {
      throw validationError([{ field: 'max_participants', message: 'Số người dự tối đa từ 2 đến 50' }]);
    }
    const values = {
      max_participants: max,
      updated_by_name: currentUser.description.full_name,
      updated_at: this.clock.now(),
    };
    await database.transaction().execute(async (transaction) => {
      await transaction.updateTable('video_settings').set(values).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'video_settings',
        entityId: SETTINGS_ENTITY_ID,
        action: 'update',
        before: null,
        after: values,
      });
    });
    return this.settings();
  }

  // ---------- Giới hạn của gói

  private monthStart(): Date {
    const local = new Date(this.clock.now().getTime() + ZONE_OFFSET);
    return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - ZONE_OFFSET);
  }

  async usage(database?: Executor) {
    const executor = database ?? (await this.database());
    const now = this.clock.now();
    const events = await executor
      .selectFrom('video_room_events')
      .select(['identity', 'room_id', 'kind', 'at'])
      .where('at', '>=', this.monthStart())
      .orderBy('at')
      .execute();
    const extensionEvents = (
      await Promise.all(this.extensions.map((extension) => extension.usageEvents(executor, this.monthStart())))
    ).flat();
    const minutes = participantMinutes(
      [
        ...events.map((event) => ({ identity: `${event.room_id}/${event.identity}`, kind: event.kind, at: event.at })),
        ...extensionEvents,
      ],
      now,
    );
    return {
      minutes_used: minutes,
      minutes_limit: currentTenant()?.plan?.videoMaxMinutes ?? null,
    };
  }

  private async assertMinutes(database: Executor) {
    const usage = await this.usage(database);
    if (usage.minutes_limit !== null && usage.minutes_used >= usage.minutes_limit) {
      throw new ApplicationError(
        'PLAN_LIMIT_EXCEEDED',
        usage.minutes_limit === 0
          ? 'Gói dịch vụ của trường không có lớp video'
          : 'Trường đã dùng hết số phút lớp video của gói trong tháng này',
        [{ field: 'video_max_minutes', message: String(usage.minutes_limit) }],
      );
    }
  }

  // ---------- Phòng

  private async loadRoom(database: Executor, roomId: string): Promise<RoomRow> {
    if (!UUID.test(roomId)) {
      throw notFoundError('Không tìm thấy phòng video', 'video_room');
    }
    const room = await database
      .selectFrom('video_rooms')
      .select(['id', 'kind', 'title', 'host_user_id', 'host_name', 'status', 'max_participants', 'lobby_enabled'])
      .where('id', '=', roomId)
      .executeTakeFirst();
    if (!room) {
      throw notFoundError('Không tìm thấy phòng video', 'video_room');
    }
    return room;
  }

  private assertHost(currentUser: CurrentUser, room: RoomRow) {
    if (room.host_user_id !== currentUser.id && !currentUser.hasPermission(MANAGE)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ chủ phòng hoặc Ban Giám hiệu điều khiển phòng');
    }
  }

  // Phòng tức thời của giáo viên (gặp riêng, hỏi đáp): chỉ chủ phòng và Ban Giám hiệu vào được
  async openInstantRoom(currentUser: CurrentUser, title: unknown, origin: ChangeOrigin) {
    const provider = this.requireProvider();
    const database = await this.database();
    const name = typeof title === 'string' ? title.trim().slice(0, 200) : '';
    if (name.length < 3) {
      throw validationError([{ field: 'title', message: 'Tên phòng từ 3 ký tự' }]);
    }
    await this.assertMinutes(database);
    const settings = await database.selectFrom('video_settings').selectAll().executeTakeFirstOrThrow();
    const room = await database.transaction().execute(async (transaction) => {
      const saved = await transaction
        .insertInto('video_rooms')
        .values({
          kind: 'instant',
          title: name,
          host_user_id: currentUser.id,
          host_name: currentUser.description.full_name,
          provider: provider.code,
          max_participants: settings.max_participants,
          lobby_enabled: settings.lobby_enabled,
        })
        .returning(['id', 'max_participants'])
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'video_rooms',
        entityId: saved.id,
        action: 'create',
        before: null,
        after: { kind: 'instant', title: name },
      });
      return saved;
    });
    await provider.createRoom(this.roomNameOf(room.id), { maxParticipants: room.max_participants });
    return this.join(currentUser, room.id);
  }

  // Vai trò của người dùng trong phòng: chủ phòng; Ban Giám hiệu vào xem
  private roleFor(currentUser: CurrentUser, room: RoomRow): { role: VideoRoomRole; identity: string } {
    if (currentUser.session?.channel !== 'student') {
      if (room.host_user_id === currentUser.id) {
        return { role: 'host', identity: videoIdentity('host', currentUser.id) };
      }
      if (currentUser.hasPermission(MANAGE)) {
        return { role: 'observer', identity: videoIdentity('observer', currentUser.id) };
      }
    }
    throw new ApplicationError('ERR_FORBIDDEN', 'Không có quyền vào phòng này');
  }

  // Vào phòng: chủ phòng, Ban Giám hiệu vào ngay. Mỗi lần vào cấp mã mới, dùng để vào trong 10 phút
  async join(currentUser: CurrentUser, roomId: string): Promise<JoinResult> {
    const provider = this.requireProvider();
    const database = await this.database();
    const room = await this.loadRoom(database, roomId);
    if (room.status !== 'open') {
      throw new ApplicationError('ERR_CONFLICT', 'Phòng chưa mở hoặc đã kết thúc');
    }
    const { role, identity } = this.roleFor(currentUser, room);
    await this.assertMinutes(database);
    const now = this.clock.now();
    await database
      .insertInto('video_room_admissions')
      .values({
        room_id: room.id,
        identity,
        role,
        display_name: currentUser.description.full_name,
        user_id: currentUser.id,
        child_id: null,
        requested_at: now,
        admitted_at: now,
        admitted_by_name: 'Tự động',
      })
      .onConflict((conflict) =>
        conflict.columns(['room_id', 'identity']).doUpdateSet({ display_name: currentUser.description.full_name }),
      )
      .execute();
    const admission = await database
      .selectFrom('video_room_admissions')
      .select(['admitted_at', 'can_speak', 'can_share'])
      .where('room_id', '=', room.id)
      .where('identity', '=', identity)
      .executeTakeFirstOrThrow();
    const base = { room_id: room.id, title: room.title, role, identity };
    if (!admission.admitted_at) {
      return { ...base, status: 'waiting' };
    }
    const token = await provider.issueToken({
      roomName: this.roomNameOf(room.id),
      identity,
      displayName: currentUser.description.full_name,
      grants: videoGrantsFor(role, { speak: admission.can_speak, share: admission.can_share }),
    });
    return {
      ...base,
      status: 'ready',
      url: provider.clientUrl,
      token,
      can_speak: role === 'host' || admission.can_speak,
      can_share: role === 'host' || admission.can_share,
    };
  }

  // Thông tin phòng cho chủ phòng: người chờ, người đã vào, phút còn lại
  async roomDetail(currentUser: CurrentUser, roomId: string) {
    const database = await this.database();
    const room = await this.loadRoom(database, roomId);
    this.assertHost(currentUser, room);
    const [admissions, usage] = await Promise.all([
      database
        .selectFrom('video_room_admissions')
        .select(['identity', 'role', 'display_name', 'requested_at', 'admitted_at', 'can_speak', 'can_share'])
        .where('room_id', '=', roomId)
        .orderBy('requested_at')
        .execute(),
      this.usage(database),
    ]);
    return { ...room, admissions, usage };
  }

  private async admissionOf(database: Executor, roomId: string, identity: string) {
    const admission = await database
      .selectFrom('video_room_admissions')
      .select(['identity', 'role', 'admitted_at', 'can_speak', 'can_share'])
      .where('room_id', '=', roomId)
      .where('identity', '=', identity)
      .executeTakeFirst();
    if (!admission) {
      throw notFoundError('Không tìm thấy người dự', 'video_participant');
    }
    return admission;
  }

  // Chủ phòng cho vào từ phòng chờ, cho nói, cho chia sẻ màn hình, mời ra
  async updateParticipant(
    currentUser: CurrentUser,
    roomId: string,
    identity: string,
    body: Record<string, unknown> | undefined,
    origin: ChangeOrigin,
  ) {
    const provider = this.requireProvider();
    const database = await this.database();
    const room = await this.loadRoom(database, roomId);
    this.assertHost(currentUser, room);
    const admission = await this.admissionOf(database, roomId, identity);
    if (admission.role === 'host') {
      throw new ApplicationError('ERR_CONFLICT', 'Không đổi quyền của chủ phòng');
    }
    const roomName = this.roomNameOf(roomId);
    if (body?.remove === true) {
      await database
        .deleteFrom('video_room_admissions')
        .where('room_id', '=', roomId)
        .where('identity', '=', identity)
        .execute();
      await provider.removeParticipant(roomName, identity).catch(() => undefined);
      return { identity, removed: true };
    }
    const changes = {
      ...(body?.admit === true && !admission.admitted_at
        ? { admitted_at: this.clock.now(), admitted_by_name: currentUser.description.full_name }
        : {}),
      ...(typeof body?.can_speak === 'boolean' ? { can_speak: body.can_speak } : {}),
      ...(typeof body?.can_share === 'boolean' ? { can_share: body.can_share } : {}),
    };
    if (Object.keys(changes).length === 0) {
      throw validationError([{ field: 'admit', message: 'Chọn cho vào, cho nói, cho chia sẻ hoặc mời ra' }]);
    }
    const updated = await database.transaction().execute(async (transaction) => {
      const row = await transaction
        .updateTable('video_room_admissions')
        .set(changes)
        .where('room_id', '=', roomId)
        .where('identity', '=', identity)
        .returning(['identity', 'role', 'admitted_at', 'can_speak', 'can_share'])
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'video_room_admissions',
        entityId: roomId,
        action: 'update',
        before: { identity, can_speak: admission.can_speak, can_share: admission.can_share },
        after: { identity, ...changes },
      });
      return row;
    });
    if (admission.admitted_at && ('can_speak' in changes || 'can_share' in changes)) {
      await provider
        .updatePermissions(
          roomName,
          identity,
          videoGrantsFor(admission.role, { speak: updated.can_speak, share: updated.can_share }),
        )
        .catch(() => undefined);
    }
    return updated;
  }

  // Kết thúc phòng: đóng phòng ở máy chủ video
  async endRoom(currentUser: CurrentUser, roomId: string, origin: ChangeOrigin) {
    const provider = this.requireProvider();
    const database = await this.database();
    const room = await this.loadRoom(database, roomId);
    this.assertHost(currentUser, room);
    await provider.endRoom(this.roomNameOf(roomId)).catch(() => undefined);
    await this.markEnded(database, roomId, origin);
    return { id: roomId, status: 'ended' };
  }

  private async markEnded(database: Executor, roomId: string, origin: ChangeOrigin | null) {
    const now = this.clock.now();
    // Người còn trong phòng khi phòng kết thúc coi như ra lúc kết thúc (đo phút)
    const events = await database
      .selectFrom('video_room_events')
      .select(['identity', 'role', 'kind', 'at'])
      .where('room_id', '=', roomId)
      .orderBy('at')
      .execute();
    const inside = new Map<string, string>();
    for (const event of events) {
      if (event.kind === 'join') inside.set(event.identity, event.role);
      else inside.delete(event.identity);
    }
    for (const [identity] of inside) {
      await this.recordEvent(database, roomId, { kind: 'leave', roomName: '', identity, at: now }, 'room_end');
    }
    await database
      .updateTable('video_rooms')
      .set({ status: 'ended', ended_at: now })
      .where('id', '=', roomId)
      .execute();
    if (origin) {
      await writeAuditLog(database, {
        origin,
        orgUnitId: null,
        entityName: 'video_rooms',
        entityId: roomId,
        action: 'update',
        before: { status: 'open' },
        after: { status: 'ended' },
      });
    }
  }

  // ---------- Sự kiện gọi lại của máy chủ video (chạy trong ngữ cảnh của trường theo tên phòng)

  schoolOfRoom(roomName: string): string | null {
    return parseVideoRoomName(roomName)?.school ?? null;
  }

  async handleEvent(event: VideoRoomEvent): Promise<{ handled: boolean }> {
    const parsed = parseVideoRoomName(event.roomName);
    if (!parsed || !UUID.test(parsed.roomId)) {
      return { handled: false };
    }
    const database = await this.database();
    const room = await database
      .selectFrom('video_rooms')
      .select(['id', 'status'])
      .where('id', '=', parsed.roomId)
      .executeTakeFirst();
    if (!room) {
      for (const extension of this.extensions) {
        if (await extension.handleEvent(database, parsed.roomId, event)) {
          return { handled: true };
        }
      }
      return { handled: false };
    }
    if (event.kind === 'room_ended') {
      if (room.status === 'open') {
        await this.markEnded(database, room.id, null);
      }
      return { handled: true };
    }
    await this.recordEvent(database, room.id, event, 'webhook');
    return { handled: true };
  }

  private async recordEvent(database: Executor, roomId: string, event: VideoRoomEvent, source: string) {
    const identity = event.identity ? parseVideoIdentity(event.identity) : null;
    if (!identity || (event.kind !== 'join' && event.kind !== 'leave')) {
      return;
    }
    await database
      .insertInto('video_room_events')
      .values({
        room_id: roomId,
        identity: event.identity as string,
        role: identity.role,
        kind: event.kind,
        at: event.at,
        source,
      })
      .execute();
  }
}
