import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, currentTenant, validationError } from '@school-management/server';
import {
  participantMinutes,
  parseVideoIdentity,
  parseVideoRoomName,
  PERMISSION_CODES,
  VIDEO_RECORDING_CONSENT_TEXT,
  videoGrantsFor,
  videoIdentity,
  videoRoomName,
  type VideoRoomRole,
} from '@school-management/shared';
import type { Kysely, Transaction } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { API_CONFIGURATION, type ApiConfiguration } from '../common/configuration.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { notFoundError } from '../common/request-fields.js';
import { storageKey } from '../common/resource-names.js';
import { FileStorage } from '../files/file-storage.js';
import { assertTutoringModule } from '../tutoring/tutoring.js';
import { TutoringService } from '../tutoring/tutoring.js';
import { VIDEO_PROVIDER, type VideoRoomEvent, type VideoRoomProvider } from './video-provider.js';

// Lớp video trực tiếp (DT-27 phần 27a, YCTD-251; tài liệu 32 mục 19.2 phần 3, 4 và 19.5). Claude tự chọn theo ủy quyền của Eric ngày
// 2026-10-11 ở chỗ kế hoạch chưa chốt:
// - phòng của buổi gia sư do giáo viên dạy chương trình (hoặc Ban Giám hiệu) mở; phòng tức thời do giáo viên mở;
// - vai trò và quyền: giáo viên dạy là chủ phòng; học sinh có đơn được duyệt (kênh student) nói, chia sẻ màn hình khi được cho; cha mẹ
//   của học sinh đó vào xem, nói khi được cho; Ban Giám hiệu vào xem. Phòng chờ bật thì học sinh, cha mẹ đợi chủ phòng cho vào;
// - mã vào phòng chỉ dùng để vào trong 10 phút, cấp lại mỗi lần vào;
// - nhật ký vào ra từ sự kiện gọi lại của máy chủ video; học sinh vào ra phòng của buổi thì ghi sang điểm danh gợi ý của 27b;
// - phút người dự mỗi tháng và dung lượng bản ghi theo gói (S5a): vượt thì không mở phòng mới, không cấp mã vào, không ghi mới;
// - ghi hình: chương trình bật ghi hình và mọi học sinh có đơn được duyệt có đồng ý ghi hình còn hiệu lực của cha mẹ; bản ghi ở kho
//   tệp theo `storageKey('video-recordings', …)`, xem bằng đường dẫn ký ngắn hạn (5 phút), mỗi lần lấy đường dẫn ghi nhật ký xem,
//   không có nút tải; việc nền xóa bản ghi hết hạn (trừ bản đang giữ vì tranh chấp, báo cáo).
type Database = Kysely<SchoolYearDatabase>;
type Executor = Database | Transaction<SchoolYearDatabase>;

export const VIDEO_RULE_CODE = 'YCTD-251';
const MANAGE = PERMISSION_CODES.tutoringManage;
const TEACH = PERMISSION_CODES.tutoringTeach;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VIEW_LINK_SECONDS = 300;
const ZONE_OFFSET = 7 * 3600_000;
// Mã định danh của dòng cấu hình video duy nhất trong nhật ký thao tác
const SETTINGS_ENTITY_ID = '00000000-0000-4000-8000-000000000251';

const videoError = (message: string) =>
  new ApplicationError('ERR_RULE_VIOLATION', message, [], undefined, VIDEO_RULE_CODE);

interface RoomRow {
  id: string;
  kind: 'session' | 'instant';
  tutoring_session_id: string | null;
  title: string;
  host_user_id: string;
  host_name: string;
  status: 'open' | 'ended';
  max_participants: number;
  lobby_enabled: boolean;
  recording_allowed: boolean;
}

export interface JoinResult {
  status: 'ready' | 'waiting';
  room_id: string;
  title: string;
  role: VideoRoomRole;
  identity: string;
  url?: string;
  token?: string;
  recording?: boolean;
  can_speak?: boolean;
  can_share?: boolean;
}

@Injectable()
export class VideoRoomsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly tutoring: TutoringService,
    private readonly fileStorage: FileStorage,
    private readonly clock: Clock,
    @Inject(API_CONFIGURATION) private readonly configuration: ApiConfiguration,
    @Optional() @Inject(VIDEO_PROVIDER) private readonly provider: VideoRoomProvider | null = null,
  ) {}

  // Video chưa bật ở máy chủ thì báo rõ; phân hệ gia sư ngoài gói thì chặn như 27b
  private requireProvider(): VideoRoomProvider {
    if (!this.provider) {
      throw new ApplicationError('ERR_CONFLICT', 'Máy chủ chưa bật lớp video trực tiếp');
    }
    return this.provider;
  }

  private async database(): Promise<Database> {
    assertTutoringModule();
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
    return database.selectFrom('video_settings').selectAll().executeTakeFirstOrThrow();
  }

  async saveSettings(currentUser: CurrentUser, body: Record<string, unknown> | undefined, origin: ChangeOrigin) {
    const database = await this.database();
    const max = body?.max_participants;
    const retention = body?.recording_retention_days;
    const errors = [];
    if (typeof max !== 'number' || !Number.isInteger(max) || max < 2 || max > 50) {
      errors.push({ field: 'max_participants', message: 'Số người dự tối đa từ 2 đến 50' });
    }
    if (typeof retention !== 'number' || !Number.isInteger(retention) || retention < 7 || retention > 365) {
      errors.push({ field: 'recording_retention_days', message: 'Thời hạn giữ bản ghi từ 7 đến 365 ngày' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const values = {
      max_participants: max as number,
      recording_retention_days: retention as number,
      lobby_enabled: body?.lobby_enabled !== false,
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
    const minutes = participantMinutes(
      events.map((event) => ({ identity: `${event.room_id}/${event.identity}`, kind: event.kind, at: event.at })),
      now,
    );
    const stored = await executor
      .selectFrom('video_recordings')
      .select((builder) => builder.fn.sum<string>('size_bytes').as('bytes'))
      .where('status', 'in', ['recording', 'ready'])
      .executeTakeFirst();
    const plan = currentTenant()?.plan;
    return {
      minutes_used: minutes,
      minutes_limit: plan?.videoMaxMinutes ?? null,
      recording_mb_used: Math.ceil(Number(stored?.bytes ?? 0) / 1024 / 1024),
      recording_mb_limit: plan?.videoMaxRecordingMb ?? null,
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
      .select([
        'id',
        'kind',
        'tutoring_session_id',
        'title',
        'host_user_id',
        'host_name',
        'status',
        'max_participants',
        'lobby_enabled',
        'recording_allowed',
      ])
      .where('id', '=', roomId)
      .executeTakeFirst();
    if (!room) {
      throw notFoundError('Không tìm thấy phòng video', 'video_room');
    }
    return room;
  }

  private async sessionOf(database: Executor, sessionId: string) {
    if (!UUID.test(sessionId)) {
      throw notFoundError('Không tìm thấy buổi học', 'session');
    }
    const session = await database
      .selectFrom('tutoring_sessions')
      .innerJoin('tutoring_programs', 'tutoring_programs.id', 'tutoring_sessions.program_id')
      .select([
        'tutoring_sessions.id',
        'tutoring_sessions.program_id',
        'tutoring_sessions.session_date',
        'tutoring_sessions.start_time',
        'tutoring_sessions.status',
        'tutoring_programs.name as program_name',
        'tutoring_programs.recording_enabled',
      ])
      .where('tutoring_sessions.id', '=', sessionId)
      .executeTakeFirst();
    if (!session) {
      throw notFoundError('Không tìm thấy buổi học', 'session');
    }
    return session;
  }

  private async teaches(database: Executor, userId: string, programId: string): Promise<boolean> {
    const row = await database
      .selectFrom('tutoring_program_teachers')
      .select('program_id')
      .where('program_id', '=', programId)
      .where('teacher_user_id', '=', userId)
      .executeTakeFirst();
    return Boolean(row);
  }

  private async programOfRoom(database: Executor, room: RoomRow): Promise<string | null> {
    if (!room.tutoring_session_id) {
      return null;
    }
    return (await this.sessionOf(database, room.tutoring_session_id)).program_id;
  }

  private async isHost(database: Executor, currentUser: CurrentUser, room: RoomRow): Promise<boolean> {
    if (room.host_user_id === currentUser.id) {
      return true;
    }
    const programId = await this.programOfRoom(database, room);
    return programId !== null && (await this.teaches(database, currentUser.id, programId));
  }

  private async assertHost(database: Executor, currentUser: CurrentUser, room: RoomRow) {
    if (!(await this.isHost(database, currentUser, room)) && !currentUser.hasPermission(MANAGE)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ giáo viên dạy buổi hoặc Ban Giám hiệu điều khiển phòng');
    }
  }

  private async createProviderRoom(room: { id: string; max_participants: number }) {
    await this.requireProvider().createRoom(this.roomNameOf(room.id), { maxParticipants: room.max_participants });
  }

  // Giáo viên dạy chương trình (hoặc Ban Giám hiệu) mở phòng của buổi; mở lại phòng đã kết thúc của cùng buổi
  async openSessionRoom(currentUser: CurrentUser, sessionId: string, origin: ChangeOrigin) {
    this.requireProvider();
    const database = await this.database();
    const session = await this.sessionOf(database, sessionId);
    if (!currentUser.hasPermission(MANAGE) && !(await this.teaches(database, currentUser.id, session.program_id))) {
      throw new ApplicationError(
        'ERR_FORBIDDEN',
        'Chỉ giáo viên dạy chương trình hoặc Ban Giám hiệu mở phòng của buổi',
      );
    }
    if (session.status === 'cancelled') {
      throw new ApplicationError('ERR_CONFLICT', 'Buổi học đã hủy');
    }
    await this.assertMinutes(database);
    const settings = await database.selectFrom('video_settings').selectAll().executeTakeFirstOrThrow();
    const existing = await database
      .selectFrom('video_rooms')
      .select('id')
      .where('tutoring_session_id', '=', sessionId)
      .executeTakeFirst();
    const room = await database.transaction().execute(async (transaction) => {
      const saved = existing
        ? await transaction
            .updateTable('video_rooms')
            .set({
              status: 'open',
              ended_at: null,
              host_user_id: currentUser.id,
              host_name: currentUser.description.full_name,
            })
            .where('id', '=', existing.id)
            .returning(['id', 'max_participants'])
            .executeTakeFirstOrThrow()
        : await transaction
            .insertInto('video_rooms')
            .values({
              kind: 'session',
              tutoring_session_id: sessionId,
              title: `${session.program_name} ${String(session.session_date).slice(0, 10)}`,
              host_user_id: currentUser.id,
              host_name: currentUser.description.full_name,
              provider: this.requireProvider().code,
              max_participants: settings.max_participants,
              lobby_enabled: settings.lobby_enabled,
              recording_allowed: session.recording_enabled,
            })
            .returning(['id', 'max_participants'])
            .executeTakeFirstOrThrow();
      await transaction
        .updateTable('tutoring_sessions')
        .set({ video_room_ref: saved.id })
        .where('id', '=', sessionId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'video_rooms',
        entityId: saved.id,
        action: existing ? 'update' : 'create',
        before: null,
        after: { kind: 'session', tutoring_session_id: sessionId, status: 'open' },
      });
      return saved;
    });
    await this.createProviderRoom(room);
    return this.join(currentUser, room.id, null);
  }

  // Phòng tức thời của giáo viên (gặp riêng có cha mẹ, hỏi đáp): chỉ giáo viên và Ban Giám hiệu vào được, học sinh, cha mẹ vào qua
  // phòng của buổi
  async openInstantRoom(currentUser: CurrentUser, title: unknown, origin: ChangeOrigin) {
    this.requireProvider();
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
          tutoring_session_id: null,
          title: name,
          host_user_id: currentUser.id,
          host_name: currentUser.description.full_name,
          provider: this.requireProvider().code,
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
    await this.createProviderRoom(room);
    return this.join(currentUser, room.id, null);
  }

  // Vai trò của người dùng trong phòng: chủ phòng, Ban Giám hiệu xem; cha mẹ của học sinh có đơn được duyệt (theo `childId`)
  private async roleFor(
    database: Executor,
    currentUser: CurrentUser,
    room: RoomRow,
    childId: string | null,
  ): Promise<{ role: VideoRoomRole; identity: string; childId: string | null }> {
    if (currentUser.session?.channel !== 'student' && childId === null) {
      if (await this.isHost(database, currentUser, room)) {
        return { role: 'host', identity: videoIdentity('host', currentUser.id), childId: null };
      }
      if (currentUser.hasPermission(MANAGE)) {
        return { role: 'observer', identity: videoIdentity('observer', currentUser.id), childId: null };
      }
      throw new ApplicationError('ERR_FORBIDDEN', 'Không có quyền vào phòng này');
    }
    const programId = await this.programOfRoom(database, room);
    if (!programId || !childId) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Không có quyền vào phòng này');
    }
    const registration = await database
      .selectFrom('tutoring_registrations')
      .select('id')
      .where('program_id', '=', programId)
      .where('child_id', '=', childId)
      .where('status', '=', 'approved')
      .executeTakeFirst();
    if (!registration) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Học sinh chưa có đơn được duyệt của chương trình');
    }
    if (currentUser.session?.channel === 'student') {
      return { role: 'student', identity: videoIdentity('student', childId), childId };
    }
    const guardian = await database
      .selectFrom('child_guardians')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .select('guardians.id')
      .where('child_guardians.child_id', '=', childId)
      .where('guardians.user_id', '=', currentUser.id)
      .executeTakeFirst();
    if (!guardian) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ cha mẹ, người giám hộ của học sinh vào xem được');
    }
    return { role: 'guardian', identity: videoIdentity('guardian', currentUser.id), childId };
  }

  // Vào phòng: chủ phòng, Ban Giám hiệu vào ngay; học sinh, cha mẹ vào phòng chờ nếu phòng có phòng chờ và chưa được cho vào.
  // Mỗi lần vào cấp mã mới, dùng để vào trong 10 phút
  async join(currentUser: CurrentUser, roomId: string, childId: string | null): Promise<JoinResult> {
    const provider = this.requireProvider();
    const database = await this.database();
    const room = await this.loadRoom(database, roomId);
    if (room.status !== 'open') {
      throw new ApplicationError('ERR_CONFLICT', 'Phòng chưa mở hoặc đã kết thúc');
    }
    const { role, identity, childId: child } = await this.roleFor(database, currentUser, room, childId);
    await this.assertMinutes(database);
    const autoAdmit = role === 'host' || role === 'observer' || !room.lobby_enabled;
    const now = this.clock.now();
    await database
      .insertInto('video_room_admissions')
      .values({
        room_id: room.id,
        identity,
        role,
        display_name: currentUser.description.full_name,
        user_id: currentUser.id,
        child_id: child,
        requested_at: now,
        admitted_at: autoAdmit ? now : null,
        admitted_by_name: autoAdmit ? 'Tự động' : null,
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
    const recording = await this.activeRecording(database, room.id);
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
      recording: recording !== undefined,
      can_speak: role === 'host' || role === 'student' || admission.can_speak,
      can_share: role === 'host' || admission.can_share,
    };
  }

  // Thông tin phòng cho chủ phòng: người chờ, người đã vào, bản ghi đang chạy, phút còn lại
  async roomDetail(currentUser: CurrentUser, roomId: string) {
    const database = await this.database();
    const room = await this.loadRoom(database, roomId);
    await this.assertHost(database, currentUser, room);
    const [admissions, recording, usage] = await Promise.all([
      database
        .selectFrom('video_room_admissions')
        .select(['identity', 'role', 'display_name', 'requested_at', 'admitted_at', 'can_speak', 'can_share'])
        .where('room_id', '=', roomId)
        .orderBy('requested_at')
        .execute(),
      this.activeRecording(database, roomId),
      this.usage(database),
    ]);
    return { ...room, admissions, recording: recording ?? null, usage };
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
    await this.assertHost(database, currentUser, room);
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

  // Kết thúc phòng: dừng ghi đang chạy, đóng phòng ở máy chủ video
  async endRoom(currentUser: CurrentUser, roomId: string, origin: ChangeOrigin) {
    const provider = this.requireProvider();
    const database = await this.database();
    const room = await this.loadRoom(database, roomId);
    await this.assertHost(database, currentUser, room);
    if ((await this.activeRecording(database, roomId)) !== undefined) {
      await this.stopRecording(currentUser, roomId, origin);
    }
    await provider.endRoom(this.roomNameOf(roomId)).catch(() => undefined);
    await this.markEnded(database, roomId, origin);
    return { id: roomId, status: 'ended' };
  }

  private async markEnded(database: Executor, roomId: string, origin: ChangeOrigin | null) {
    const now = this.clock.now();
    // Người còn trong phòng khi phòng kết thúc coi như ra lúc kết thúc (đo phút, điểm danh)
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
    const database = (await this.currentSchoolYear.require()).database;
    if (event.kind === 'recording_ended' && event.recording) {
      await this.finishRecording(
        database,
        event.recording.egressId,
        event.recording.succeeded,
        event.recording.sizeBytes,
      );
      return { handled: true };
    }
    if (!parsed || !UUID.test(parsed.roomId)) {
      return { handled: false };
    }
    const room = await database
      .selectFrom('video_rooms')
      .select(['id', 'status'])
      .where('id', '=', parsed.roomId)
      .executeTakeFirst();
    if (!room) {
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
    // Học sinh vào ra phòng của buổi gia sư: nguồn điểm danh gợi ý của 27b (giáo viên xác nhận)
    if (identity.role === 'student') {
      const room = await database
        .selectFrom('video_rooms')
        .select('tutoring_session_id')
        .where('id', '=', roomId)
        .executeTakeFirst();
      if (room?.tutoring_session_id) {
        await this.tutoring.recordRoomEvents(
          room.tutoring_session_id,
          [{ childId: identity.id, kind: event.kind, at: event.at }],
          'room_log',
        );
      }
    }
  }

  // ---------- Ghi hình

  private async activeRecording(database: Executor, roomId: string) {
    return database
      .selectFrom('video_recordings')
      .select(['id', 'started_at', 'started_by_name'])
      .where('room_id', '=', roomId)
      .where('status', '=', 'recording')
      .executeTakeFirst();
  }

  // Ghi được khi: chương trình bật ghi hình, mọi học sinh có đơn được duyệt có đồng ý ghi hình còn hiệu lực của cha mẹ, gói còn dung
  // lượng bản ghi. Phòng tức thời không ghi
  async startRecording(currentUser: CurrentUser, roomId: string, origin: ChangeOrigin) {
    const provider = this.requireProvider();
    const database = await this.database();
    const room = await this.loadRoom(database, roomId);
    await this.assertHost(database, currentUser, room);
    if (room.status !== 'open') {
      throw new ApplicationError('ERR_CONFLICT', 'Phòng đã kết thúc');
    }
    if ((await this.activeRecording(database, roomId)) !== undefined) {
      throw new ApplicationError('ERR_CONFLICT', 'Phòng đang ghi');
    }
    const programId = await this.programOfRoom(database, room);
    if (!programId) {
      throw videoError('Phòng tức thời không ghi hình');
    }
    const program = await database
      .selectFrom('tutoring_programs')
      .select('recording_enabled')
      .where('id', '=', programId)
      .executeTakeFirstOrThrow();
    if (!program.recording_enabled) {
      throw videoError('Chương trình chưa bật ghi hình (trong trường ghi hình tắt mặc định)');
    }
    const missing = await database
      .selectFrom('tutoring_registrations')
      .innerJoin('children', 'children.id', 'tutoring_registrations.child_id')
      .leftJoin('video_recording_consents', (join) =>
        join
          .onRef('video_recording_consents.program_id', '=', 'tutoring_registrations.program_id')
          .onRef('video_recording_consents.child_id', '=', 'tutoring_registrations.child_id')
          .on('video_recording_consents.withdrawn_at', 'is', null),
      )
      .select('children.full_name')
      .where('tutoring_registrations.program_id', '=', programId)
      .where('tutoring_registrations.status', '=', 'approved')
      .where('video_recording_consents.id', 'is', null)
      .execute();
    if (missing.length > 0) {
      throw new ApplicationError(
        'ERR_RULE_VIOLATION',
        `Chưa có đồng ý ghi hình của cha mẹ: ${missing.map((row) => row.full_name).join(', ')}`,
        missing.map((row) => ({ field: 'consent', message: row.full_name })),
        undefined,
        VIDEO_RULE_CODE,
      );
    }
    const usage = await this.usage(database);
    if (usage.recording_mb_limit !== null && usage.recording_mb_used >= usage.recording_mb_limit) {
      throw new ApplicationError(
        'PLAN_LIMIT_EXCEEDED',
        usage.recording_mb_limit === 0
          ? 'Gói dịch vụ của trường không có ghi hình lớp video'
          : 'Trường đã dùng hết dung lượng bản ghi video của gói',
        [{ field: 'video_max_recording_mb', message: String(usage.recording_mb_limit) }],
      );
    }
    const settings = await database.selectFrom('video_settings').selectAll().executeTakeFirstOrThrow();
    const recordingId = randomUUID();
    const key = storageKey('video-recordings', roomId, `${recordingId}.mp4`);
    const { egressId } = await provider.startRecording(this.roomNameOf(roomId), key);
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      await transaction
        .insertInto('video_recordings')
        .values({
          id: recordingId,
          room_id: roomId,
          egress_id: egressId,
          storage_key: key,
          started_by_name: currentUser.description.full_name,
          started_at: now,
          expires_at: new Date(now.getTime() + settings.recording_retention_days * 86_400_000),
        })
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'video_recordings',
        entityId: recordingId,
        action: 'create',
        before: null,
        after: { room_id: roomId, status: 'recording' },
      });
    });
    return { id: recordingId, status: 'recording' };
  }

  async stopRecording(currentUser: CurrentUser, roomId: string, origin: ChangeOrigin) {
    const provider = this.requireProvider();
    const database = await this.database();
    const room = await this.loadRoom(database, roomId);
    await this.assertHost(database, currentUser, room);
    const recording = await database
      .selectFrom('video_recordings')
      .select(['id', 'egress_id', 'storage_key'])
      .where('room_id', '=', roomId)
      .where('status', '=', 'recording')
      .executeTakeFirst();
    if (!recording?.egress_id) {
      throw new ApplicationError('ERR_CONFLICT', 'Phòng không đang ghi');
    }
    const stopped = await provider.stopRecording(recording.egress_id);
    if (stopped.completed) {
      if (stopped.completed.contents) {
        await this.fileStorage.put(recording.storage_key, stopped.completed.contents, 'video/mp4');
      }
      await this.finishRecording(database, recording.egress_id, true, stopped.completed.sizeBytes);
    }
    await writeAuditLog(database, {
      origin,
      orgUnitId: null,
      entityName: 'video_recordings',
      entityId: recording.id,
      action: 'update',
      before: { status: 'recording' },
      after: { status: stopped.completed ? 'ready' : 'stopping' },
    });
    return { id: recording.id, status: stopped.completed ? 'ready' : 'recording' };
  }

  private async finishRecording(database: Executor, egressId: string, succeeded: boolean, sizeBytes: number) {
    await database
      .updateTable('video_recordings')
      .set({ status: succeeded ? 'ready' : 'failed', ended_at: this.clock.now(), size_bytes: sizeBytes })
      .where('egress_id', '=', egressId)
      .where('status', '=', 'recording')
      .execute();
  }

  // Bản ghi của buổi: giáo viên dạy, Ban Giám hiệu, cha mẹ của học sinh có đơn được duyệt
  async sessionRecordings(currentUser: CurrentUser, sessionId: string, childId: string | null) {
    const database = await this.database();
    const session = await this.sessionOf(database, sessionId);
    await this.assertCanViewProgram(database, currentUser, session.program_id, childId);
    return database
      .selectFrom('video_recordings')
      .innerJoin('video_rooms', 'video_rooms.id', 'video_recordings.room_id')
      .select([
        'video_recordings.id',
        'video_recordings.status',
        'video_recordings.started_at',
        'video_recordings.ended_at',
        'video_recordings.size_bytes',
        'video_recordings.expires_at',
        'video_recordings.hold_reason',
      ])
      .where('video_rooms.tutoring_session_id', '=', sessionId)
      .where('video_recordings.status', '!=', 'deleted')
      .orderBy('video_recordings.started_at')
      .execute();
  }

  private async assertCanViewProgram(
    database: Executor,
    currentUser: CurrentUser,
    programId: string,
    childId: string | null,
  ) {
    if (childId === null) {
      if (currentUser.hasPermission(MANAGE) || (await this.teaches(database, currentUser.id, programId))) {
        return;
      }
      throw new ApplicationError('ERR_FORBIDDEN', 'Không có quyền xem bản ghi của buổi');
    }
    const allowed = await database
      .selectFrom('tutoring_registrations')
      .innerJoin('child_guardians', 'child_guardians.child_id', 'tutoring_registrations.child_id')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .select('tutoring_registrations.id')
      .where('tutoring_registrations.program_id', '=', programId)
      .where('tutoring_registrations.child_id', '=', childId)
      .where('tutoring_registrations.status', 'in', ['approved', 'withdrawn'])
      .where('guardians.user_id', '=', currentUser.id)
      .executeTakeFirst();
    if (!allowed) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Không có quyền xem bản ghi của buổi');
    }
  }

  private viewSignature(payload: string): string {
    const secret = this.configuration.video?.apiSecret ?? '';
    return createHmac('sha256', `video-view:${secret}`).update(payload).digest('base64url');
  }

  // Đường dẫn xem có hạn 5 phút; mỗi lần lấy đường dẫn ghi nhật ký xem
  async viewLink(currentUser: CurrentUser, recordingId: string, childId: string | null, origin: ChangeOrigin) {
    this.requireProvider();
    const database = await this.database();
    if (!UUID.test(recordingId)) {
      throw notFoundError('Không tìm thấy bản ghi', 'video_recording');
    }
    const recording = await database
      .selectFrom('video_recordings')
      .innerJoin('video_rooms', 'video_rooms.id', 'video_recordings.room_id')
      .select(['video_recordings.id', 'video_recordings.status', 'video_rooms.tutoring_session_id'])
      .where('video_recordings.id', '=', recordingId)
      .executeTakeFirst();
    if (!recording || !recording.tutoring_session_id) {
      throw notFoundError('Không tìm thấy bản ghi', 'video_recording');
    }
    const session = await this.sessionOf(database, recording.tutoring_session_id);
    await this.assertCanViewProgram(database, currentUser, session.program_id, childId);
    if (recording.status !== 'ready') {
      throw new ApplicationError('ERR_CONFLICT', 'Bản ghi chưa sẵn sàng hoặc đã xóa theo hạn');
    }
    await database.transaction().execute(async (transaction) => {
      const view = await transaction
        .insertInto('video_recording_views')
        .values({
          recording_id: recordingId,
          viewer_user_id: currentUser.id,
          viewer_name: currentUser.description.full_name,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'video_recording_views',
        entityId: view.id,
        action: 'create',
        before: null,
        after: { recording_id: recordingId, viewer: currentUser.description.full_name },
      });
    });
    const expires = Math.floor(this.clock.now().getTime() / 1000) + VIEW_LINK_SECONDS;
    const payload = Buffer.from(JSON.stringify({ r: recordingId, e: expires })).toString('base64url');
    return {
      url: `/api/v1/video/recordings/${recordingId}/stream?token=${payload}.${this.viewSignature(payload)}`,
      expires_at: new Date(expires * 1000).toISOString(),
    };
  }

  async streamRecording(recordingId: string, token: unknown): Promise<Buffer> {
    const [payload, signature] = typeof token === 'string' ? token.split('.') : [];
    const expected = payload ? this.viewSignature(payload) : '';
    if (
      !payload ||
      !signature ||
      expected.length !== signature.length ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
    ) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Đường dẫn xem không hợp lệ');
    }
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { r: string; e: number };
    if (claims.r !== recordingId || claims.e * 1000 < this.clock.now().getTime()) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Đường dẫn xem đã hết hạn');
    }
    const database = (await this.currentSchoolYear.require()).database;
    const recording = await database
      .selectFrom('video_recordings')
      .select(['storage_key', 'status'])
      .where('id', '=', recordingId)
      .executeTakeFirst();
    if (!recording || recording.status !== 'ready') {
      throw notFoundError('Không tìm thấy bản ghi', 'video_recording');
    }
    return this.fileStorage.get(recording.storage_key);
  }

  // Giữ bản ghi quá hạn vì tranh chấp, báo cáo (Ban Giám hiệu); bỏ giữ thì hết hạn theo cấu hình
  async holdRecording(currentUser: CurrentUser, recordingId: string, reason: unknown, origin: ChangeOrigin) {
    const database = await this.database();
    if (!currentUser.hasPermission(MANAGE)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ Ban Giám hiệu giữ bản ghi');
    }
    const text = typeof reason === 'string' ? reason.trim().slice(0, 500) : '';
    const updated = await database
      .updateTable('video_recordings')
      .set({ hold_reason: text.length >= 3 ? text : null })
      .where('id', '=', recordingId)
      .where('status', '!=', 'deleted')
      .returning(['id', 'hold_reason'])
      .executeTakeFirst();
    if (!updated) {
      throw notFoundError('Không tìm thấy bản ghi', 'video_recording');
    }
    await writeAuditLog(database, {
      origin,
      orgUnitId: null,
      entityName: 'video_recordings',
      entityId: recordingId,
      action: 'update',
      before: null,
      after: { hold_reason: updated.hold_reason },
    });
    return updated;
  }

  // Việc nền: xóa tệp bản ghi hết hạn (trừ bản đang giữ), mỗi lần tối đa 200 bản
  async purgeExpired(): Promise<number> {
    const database = (await this.currentSchoolYear.require()).database;
    const rows = await database
      .selectFrom('video_recordings')
      .select(['id', 'storage_key'])
      .where('status', 'in', ['ready', 'failed'])
      .where('hold_reason', 'is', null)
      .where('expires_at', '<', this.clock.now())
      .limit(200)
      .execute();
    for (const row of rows) {
      await this.fileStorage.delete(row.storage_key).catch(() => undefined);
      await database
        .updateTable('video_recordings')
        .set({ status: 'deleted', deleted_at: this.clock.now(), size_bytes: 0 })
        .where('id', '=', row.id)
        .execute();
    }
    return rows.length;
  }

  // ---------- Đồng ý ghi hình của cha mẹ (theo chương trình, rút lại được)

  async consents(currentUser: CurrentUser, childId: string) {
    const database = await this.database();
    await this.assertGuardianOf(database, currentUser, childId);
    return database
      .selectFrom('video_recording_consents')
      .select(['program_id', 'consented_at', 'withdrawn_at'])
      .where('child_id', '=', childId)
      .where('withdrawn_at', 'is', null)
      .execute();
  }

  private async assertGuardianOf(database: Executor, currentUser: CurrentUser, childId: string) {
    if (!UUID.test(childId)) {
      throw notFoundError('Không tìm thấy học sinh', 'child');
    }
    const guardian = await database
      .selectFrom('child_guardians')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .select('guardians.full_name')
      .where('child_guardians.child_id', '=', childId)
      .where('guardians.user_id', '=', currentUser.id)
      .executeTakeFirst();
    if (!guardian) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ cha mẹ, người giám hộ của học sinh làm được việc này');
    }
  }

  async setConsent(currentUser: CurrentUser, childId: string, programId: string, agree: boolean, origin: ChangeOrigin) {
    const database = await this.database();
    await this.assertGuardianOf(database, currentUser, childId);
    if (!UUID.test(programId)) {
      throw notFoundError('Không tìm thấy chương trình', 'program');
    }
    const registration = await database
      .selectFrom('tutoring_registrations')
      .select('id')
      .where('program_id', '=', programId)
      .where('child_id', '=', childId)
      .where('status', 'in', ['pending', 'approved'])
      .executeTakeFirst();
    if (!registration) {
      throw new ApplicationError('ERR_CONFLICT', 'Học sinh chưa đăng ký chương trình này');
    }
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('video_recording_consents')
        .set({ withdrawn_at: now })
        .where('program_id', '=', programId)
        .where('child_id', '=', childId)
        .where('withdrawn_at', 'is', null)
        .execute();
      if (agree) {
        await transaction
          .insertInto('video_recording_consents')
          .values({
            program_id: programId,
            child_id: childId,
            guardian_user_id: currentUser.id,
            guardian_name: currentUser.description.full_name,
            consent_text: VIDEO_RECORDING_CONSENT_TEXT,
            consent_hash: createHash('sha256').update(VIDEO_RECORDING_CONSENT_TEXT).digest('hex'),
            consented_at: now,
          })
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'video_recording_consents',
        entityId: programId,
        action: agree ? 'create' : 'update',
        before: null,
        after: { child_id: childId, agree },
      });
    });
    return { program_id: programId, child_id: childId, agree };
  }

  // Phòng của buổi đang mở mà cha mẹ hoặc học sinh vào được (danh sách buổi phía cha mẹ, học sinh)
  async openRoomsOfChild(childId: string) {
    const database = await this.database();
    return database
      .selectFrom('video_rooms')
      .innerJoin('tutoring_sessions', 'tutoring_sessions.id', 'video_rooms.tutoring_session_id')
      .innerJoin('tutoring_registrations', 'tutoring_registrations.program_id', 'tutoring_sessions.program_id')
      .select(['video_rooms.id as room_id', 'video_rooms.title', 'tutoring_sessions.id as session_id'])
      .where('video_rooms.status', '=', 'open')
      .where('tutoring_registrations.child_id', '=', childId)
      .where('tutoring_registrations.status', '=', 'approved')
      .execute();
  }

  // Học sinh ở kênh student: tài khoản học nối đúng một học sinh đang học
  async studentChild(currentUser: CurrentUser): Promise<string> {
    const database = await this.database();
    const account = await database
      .selectFrom('student_learning_accounts')
      .innerJoin('children', 'children.id', 'student_learning_accounts.child_id')
      .select(['children.id', 'children.status', 'children.deleted_at'])
      .where('student_learning_accounts.identity_user_id', '=', currentUser.id)
      .executeTakeFirst();
    if (!account || account.status !== 'active' || account.deleted_at !== null) {
      throw new ApplicationError(
        'ERR_FORBIDDEN',
        'Tài khoản chưa nối với học sinh đang học, nhờ nhà trường kiểm tra lại',
      );
    }
    return account.id;
  }

  isTeacher(currentUser: CurrentUser): boolean {
    return currentUser.hasPermission(TEACH) || currentUser.hasPermission(MANAGE);
  }
}
