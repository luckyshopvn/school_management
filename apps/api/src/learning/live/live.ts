import { Inject, Injectable, Optional, type OnModuleInit } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES, parseVideoIdentity, videoGrantsFor, videoIdentity } from '@school-management/shared';
import type { Kysely, Selectable, Transaction } from 'kysely';
import type { CurrentUser } from '../../authentication/current-user.js';
import type { ChangeOrigin } from '../../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../../common/current-school-year.js';
import { isUuid, notFoundError, type RequestBody } from '../../common/request-fields.js';
import { GroupSetsReader, GroupSetsService } from '../../child-groups/group-sets.js';
import { VIDEO_PROVIDER, type VideoRoomEvent, type VideoRoomProvider } from '../../video/video-provider.js';
import { VideoRoomsService, type VideoRoomExtension } from '../../video/video-rooms.js';
import { isOpenNow, openHoursOf } from '../discussions/discussion-rules.js';
import { LearningService } from '../learning.js';
import {
  attendanceOf,
  durationOf,
  liveRule,
  MAX_NOTICE_LENGTH,
  parseBreakoutRequest,
  resultOfAttendance,
  splitRandom,
  teacherWatching,
} from './live-rules.js';

// Giờ học trực tuyến, phòng video nhóm, phòng chia nhỏ (DT-28 phần 28g, YCTD-277; tài liệu 47 mục 20.7). Dùng lại 27a: bộ nối phòng
// video, tên phòng theo trường, mã vào phòng theo vai trò, sự kiện gọi lại có chữ ký và giới hạn phút của gói (không thêm dịch vụ
// video). Quyền lớp học trực tuyến qua cửa của lõi 28b, quyền nhóm như không gian nhóm của 28e. Claude tự chọn theo ủy quyền của Eric
// ngày 2026-10-11 ở chỗ kế hoạch chưa chốt:
// - giáo viên của lớp học trực tuyến mở phòng giờ học và là chủ phòng; Ban Giám hiệu, tổ trưởng vào xem; học sinh vào khi hoạt động
//   đã giao, đang mở với em và phòng đang mở;
// - phòng nhóm: người lập bộ nhóm, giáo viên của lớp mở và vào (chủ phòng); người xử lý vi phạm vào xem; học sinh của nhóm tự mở chỉ khi
//   giáo viên bật cho bộ nhóm và trong giờ mở của trường (GD-144, Eric đã chốt 2026-10-28), ngoài giờ mở thì không vào phòng học sinh
//   tự mở; giáo viên vào lúc nào cũng được và học sinh luôn thấy "giáo viên đang xem" (GD-149); báo cáo từ phòng vào hàng chờ của 28e;
// - phòng chia nhỏ từ phòng giờ học: theo bộ nhóm có sẵn hoặc chia ngẫu nhiên (lưu thành bộ nhóm `classroom` khi lớp học trực tuyến
//   gắn lớp); thông báo tới mọi phòng, gọi tất cả về, chuyển học sinh, "gọi giáo viên";
// - không ghi hình (GD-131 của 27a giữ tắt mặc định với giờ học của trường).
type YearExecutor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;
type RoomRow = Selectable<SchoolYearDatabase['learning_live_rooms']>;
type Role = 'host' | 'student' | 'observer';
const DEFAULT_MAX_PARTICIPANTS = 50;
const REPORT_DUE_DAYS = 3;

export interface LiveJoin {
  status: 'ready';
  room_id: string;
  title: string;
  role: Role;
  identity: string;
  url: string;
  token: string;
  recording: false;
  can_speak: boolean;
  can_share: boolean;
}

@Injectable()
export class LiveLearningService implements OnModuleInit, VideoRoomExtension {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly learning: LearningService,
    private readonly videoRooms: VideoRoomsService,
    private readonly groupSets: GroupSetsService,
    private readonly groupReader: GroupSetsReader,
    private readonly clock: Clock,
    @Optional() @Inject(VIDEO_PROVIDER) private readonly provider: VideoRoomProvider | null = null,
  ) {}

  onModuleInit() {
    this.videoRooms.registerExtension(this);
  }

  // ---------- Dùng chung với 27a: sự kiện gọi lại, phút của gói

  async handleEvent(database: YearExecutor, roomId: string, event: VideoRoomEvent): Promise<boolean> {
    const room = await database
      .selectFrom('learning_live_rooms')
      .select(['id', 'status'])
      .where('id', '=', roomId)
      .executeTakeFirst();
    if (!room) return false;
    if (event.kind === 'room_ended') {
      if (room.status === 'open') await this.markEnded(database, [room.id]);
      return true;
    }
    const parsed = event.identity ? parseVideoIdentity(event.identity) : null;
    if (!parsed || parsed.role === 'guardian' || (event.kind !== 'join' && event.kind !== 'leave')) return true;
    await database
      .insertInto('learning_live_events')
      .values({
        room_id: room.id,
        identity: event.identity as string,
        role: parsed.role,
        kind: event.kind,
        at: event.at,
        source: 'webhook',
      })
      .execute();
    await database
      .updateTable('learning_live_participants')
      .set({ left_at: event.kind === 'leave' ? event.at : null })
      .where('room_id', '=', room.id)
      .where('identity', '=', event.identity as string)
      .execute();
    return true;
  }

  async usageEvents(database: YearExecutor, since: Date) {
    const events = await database
      .selectFrom('learning_live_events')
      .select(['room_id', 'identity', 'kind', 'at'])
      .where('at', '>=', since)
      .execute();
    return events.map((event) => ({ identity: `${event.room_id}/${event.identity}`, kind: event.kind, at: event.at }));
  }

  // ---------- Phòng

  private requireProvider(): VideoRoomProvider {
    if (!this.provider) {
      throw new ApplicationError('ERR_CONFLICT', 'Máy chủ chưa bật lớp video trực tiếp');
    }
    return this.provider;
  }

  private async assertMinutes(database: YearExecutor) {
    const usage = await this.videoRooms.usage(database);
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

  private async loadRoom(database: YearExecutor, roomId: string): Promise<RoomRow> {
    const room = isUuid(roomId)
      ? await database.selectFrom('learning_live_rooms').selectAll().where('id', '=', roomId).executeTakeFirst()
      : undefined;
    if (!room) throw notFoundError('Không tìm thấy phòng học trực tuyến', 'learning_live_room');
    return room;
  }

  private async openRoom(
    database: YearExecutor,
    opener: { id: string; name: string; kind: 'teacher' | 'student' },
    values: {
      kind: RoomRow['kind'];
      space_id?: string | null;
      activity_id?: string | null;
      group_id?: string | null;
      parent_room_id?: string | null;
      title: string;
      ends_at?: Date | null;
    },
  ): Promise<RoomRow> {
    const provider = this.requireProvider();
    await this.assertMinutes(database);
    const settings = await database.selectFrom('video_settings').select('max_participants').executeTakeFirst();
    const room = await database
      .insertInto('learning_live_rooms')
      .values({
        ...values,
        title: values.title.slice(0, 200),
        opened_by: opener.id,
        opened_by_name: opener.name,
        opened_by_kind: opener.kind,
        provider: provider.code,
        max_participants: settings?.max_participants ?? DEFAULT_MAX_PARTICIPANTS,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    await provider.createRoom(this.videoRooms.roomNameOf(room.id), { maxParticipants: room.max_participants });
    return room;
  }

  // Cấp mã vào phòng (mỗi lần vào cấp mã mới) và ghi người đang trong phòng
  private async enter(
    database: YearExecutor,
    room: RoomRow,
    person: { role: Role; id: string; userId: string; name: string; childId: string | null; share: boolean },
  ): Promise<LiveJoin> {
    if (room.status !== 'open') throw liveRule('Phòng chưa mở hoặc đã kết thúc');
    const provider = this.requireProvider();
    await this.assertMinutes(database);
    const identity = videoIdentity(person.role, person.id);
    const now = this.clock.now();
    await database
      .insertInto('learning_live_participants')
      .values({
        room_id: room.id,
        identity,
        role: person.role,
        display_name: person.name,
        user_id: person.userId,
        child_id: person.childId,
        joined_at: now,
        left_at: null,
      })
      .onConflict((conflict) =>
        conflict
          .columns(['room_id', 'identity'])
          .doUpdateSet({ joined_at: now, left_at: null, display_name: person.name }),
      )
      .execute();
    const token = await provider.issueToken({
      roomName: this.videoRooms.roomNameOf(room.id),
      identity,
      displayName: person.name,
      grants: videoGrantsFor(person.role, { speak: person.role !== 'observer', share: person.share }),
    });
    return {
      status: 'ready',
      room_id: room.id,
      title: room.title,
      role: person.role,
      identity,
      url: provider.clientUrl,
      token,
      recording: false,
      can_speak: person.role !== 'observer',
      can_share: person.role === 'host' || person.share,
    };
  }

  private async markEnded(database: YearExecutor, roomIds: string[]) {
    if (roomIds.length === 0) return;
    const now = this.clock.now();
    await database
      .updateTable('learning_live_rooms')
      .set({ status: 'ended', ended_at: now })
      .where('id', 'in', roomIds)
      .where('status', '=', 'open')
      .execute();
    await database
      .updateTable('learning_live_participants')
      .set({ left_at: now })
      .where('room_id', 'in', roomIds)
      .where('left_at', 'is', null)
      .execute();
  }

  private async endProviderRooms(roomIds: string[]) {
    for (const roomId of roomIds) {
      await this.provider?.endRoom(this.videoRooms.roomNameOf(roomId)).catch(() => undefined);
    }
  }

  private async participants(database: YearExecutor, roomIds: string[]) {
    if (roomIds.length === 0) return [];
    return database
      .selectFrom('learning_live_participants')
      .select(['room_id', 'identity', 'role', 'display_name', 'child_id', 'joined_at', 'left_at'])
      .where('room_id', 'in', roomIds)
      .orderBy('joined_at')
      .execute();
  }

  // ---------- Quyền

  // Cán bộ với phòng: chủ phòng (giáo viên dạy lớp học trực tuyến, người lập bộ nhóm, giáo viên của lớp) hoặc người xem
  private async staffRole(
    currentUser: CurrentUser,
    database: YearExecutor,
    room: RoomRow,
  ): Promise<'host' | 'observer'> {
    if (room.kind === 'group') {
      return (await this.groupStaff(currentUser, database, room.group_id as string)).role;
    }
    const { canTeach } = await this.learning.spaceAccess(currentUser, room.space_id as string);
    return canTeach ? 'host' : 'observer';
  }

  private async assertHost(currentUser: CurrentUser, database: YearExecutor, room: RoomRow) {
    if ((await this.staffRole(currentUser, database, room)) !== 'host') {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ giáo viên của lớp, của nhóm điều khiển phòng');
    }
  }

  private async groupOf(database: YearExecutor, groupId: string) {
    const group = isUuid(groupId)
      ? await database
          .selectFrom('child_groups')
          .innerJoin('group_sets', 'group_sets.id', 'child_groups.group_set_id')
          .select([
            'child_groups.id',
            'child_groups.name',
            'child_groups.class_id',
            'group_sets.id as group_set_id',
            'group_sets.name as group_set_name',
            'group_sets.owner_user_id',
            'group_sets.owner_name',
            'group_sets.status as set_status',
          ])
          .where('child_groups.id', '=', groupId)
          .executeTakeFirst()
      : undefined;
    if (!group) throw notFoundError('Không tìm thấy nhóm', 'child_group');
    return group;
  }

  // Như không gian nhóm của 28e: người lập bộ nhóm, giáo viên được phân công lớp là chủ phòng; người xử lý vi phạm vào xem
  private async groupStaff(currentUser: CurrentUser, database: YearExecutor, groupId: string) {
    const group = await this.groupOf(database, groupId);
    if (group.owner_user_id === currentUser.id) return { group, role: 'host' as const };
    const assigned = await database
      .selectFrom('class_staff_assignments')
      .select('id')
      .where('class_id', '=', group.class_id ?? '')
      .where('staff_user_id', '=', currentUser.id)
      .where('status', '=', 'active')
      .executeTakeFirst();
    if (assigned) return { group, role: 'host' as const };
    if (currentUser.hasPermission(PERMISSION_CODES.discussionModerate)) return { group, role: 'observer' as const };
    throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người lập bộ nhóm, giáo viên của lớp vào phòng nhóm này');
  }

  private async childName(database: YearExecutor, childId: string) {
    const child = await database
      .selectFrom('children')
      .select('full_name')
      .where('id', '=', childId)
      .executeTakeFirst();
    return child?.full_name ?? 'Học sinh';
  }

  private async openHoursNow(database: YearExecutor): Promise<boolean> {
    const row = await database
      .selectFrom('settings')
      .innerJoin('org_units', 'org_units.id', 'settings.org_unit_id')
      .select('settings.value')
      .where('org_units.unit_type', '=', 'truong_chinh')
      .where('settings.key', '=', 'discussion_open_hours')
      .executeTakeFirst();
    return isOpenNow(openHoursOf(row?.value ?? null), this.clock.now());
  }

  private async isGroupMember(database: YearExecutor, groupId: string, childId: string) {
    const member = await database
      .selectFrom('child_group_members')
      .innerJoin('child_groups', 'child_groups.id', 'child_group_members.group_id')
      .innerJoin('group_sets', 'group_sets.id', 'child_groups.group_set_id')
      .select('child_group_members.child_id')
      .where('child_group_members.group_id', '=', groupId)
      .where('child_group_members.child_id', '=', childId)
      .where('group_sets.status', '=', 'active')
      .executeTakeFirst();
    return Boolean(member);
  }

  private async studentOpenAllowed(database: YearExecutor, groupSetId: string) {
    const setting = await database
      .selectFrom('learning_group_room_settings')
      .select('student_open')
      .where('group_set_id', '=', groupSetId)
      .executeTakeFirst();
    return setting?.student_open === true;
  }

  // ---------- Giờ học trực tuyến (cán bộ)

  private async liveActivity(currentUser: CurrentUser, activityId: string) {
    const access = await this.learning.teacherActivity(currentUser, activityId);
    if (access.activity.kind !== 'live_session') {
      throw liveRule('Hoạt động không phải giờ học trực tuyến');
    }
    return access;
  }

  private async roomsOfActivity(database: YearExecutor, activityId: string) {
    return database
      .selectFrom('learning_live_rooms')
      .selectAll()
      .where('activity_id', '=', activityId)
      .orderBy('created_at')
      .execute();
  }

  async session(currentUser: CurrentUser, activityId: string) {
    const { database, space, activity } = await this.liveActivity(currentUser, activityId);
    const rooms = await this.roomsOfActivity(database, activity.id);
    const main = [...rooms].reverse().find((room) => room.kind === 'live_session' && room.status === 'open') ?? null;
    const breakouts = main ? rooms.filter((room) => room.parent_room_id === main.id && room.status === 'open') : [];
    const students = await this.learning.students(database, space);
    const roomIds = rooms.map((room) => room.id);
    const [participants, events, members, help, results, notices] = await Promise.all([
      this.participants(database, main ? [main.id, ...breakouts.map((room) => room.id)] : []),
      roomIds.length === 0
        ? Promise.resolve([])
        : database
            .selectFrom('learning_live_events')
            .select(['identity', 'kind', 'at'])
            .where('room_id', 'in', roomIds)
            .execute(),
      main
        ? database
            .selectFrom('learning_breakout_members')
            .select(['child_id', 'room_id'])
            .where('parent_room_id', '=', main.id)
            .execute()
        : Promise.resolve([]),
      breakouts.length === 0
        ? Promise.resolve([])
        : database
            .selectFrom('learning_live_help_requests')
            .select(['id', 'room_id', 'child_id', 'child_name', 'created_at'])
            .where(
              'room_id',
              'in',
              breakouts.map((room) => room.id),
            )
            .where('resolved_at', 'is', null)
            .orderBy('created_at')
            .execute(),
      database
        .selectFrom('activity_results')
        .select(['child_id', 'status'])
        .where('activity_id', '=', activity.id)
        .execute(),
      main
        ? database
            .selectFrom('learning_live_notices')
            .select(['id', 'body', 'sent_by_name', 'created_at'])
            .where('room_id', '=', main.id)
            .orderBy('created_at', 'desc')
            .limit(10)
            .execute()
        : Promise.resolve([]),
    ]);
    const names = new Map(students.map((student) => [student.id, student.full_name]));
    const attendance = attendanceOf(
      students.map((student) => student.id),
      events,
      this.clock.now(),
      durationOf(activity.settings),
    ).map((row) => ({
      ...row,
      full_name: names.get(row.child_id) ?? '',
      result: results.find((result) => result.child_id === row.child_id)?.status ?? null,
    }));
    return {
      activity: {
        id: activity.id,
        title: activity.title,
        status: activity.status,
        opens_at: activity.opens_at,
        duration_minutes: durationOf(activity.settings),
      },
      room: main
        ? {
            id: main.id,
            status: main.status,
            participants: participants.filter((row) => row.room_id === main.id && row.left_at === null),
          }
        : null,
      breakouts: breakouts.map((room) => ({
        id: room.id,
        title: room.title,
        group_id: room.group_id,
        ends_at: room.ends_at,
        members: members
          .filter((member) => member.room_id === room.id)
          .map((member) => ({ child_id: member.child_id, full_name: names.get(member.child_id) ?? '' })),
        present: participants.filter((row) => row.room_id === room.id && row.left_at === null),
        help: help.filter((row) => row.room_id === room.id),
      })),
      notices,
      attendance,
      group_sets: await this.setsOf(currentUser, database, space),
    };
  }

  // Giáo viên mở phòng của giờ học (mở lại nếu phòng trước đã kết thúc) và vào làm chủ phòng
  async openSession(currentUser: CurrentUser, activityId: string) {
    // Cửa của lõi chỉ cho giáo viên dạy lớp học trực tuyến
    const { database, activity } = await this.liveActivity(currentUser, activityId);
    if (activity.status !== 'published') throw liveRule('Giao giờ học cho học sinh trước khi mở phòng');
    const existing = await database
      .selectFrom('learning_live_rooms')
      .selectAll()
      .where('activity_id', '=', activity.id)
      .where('kind', '=', 'live_session')
      .where('status', '=', 'open')
      .executeTakeFirst();
    const room =
      existing ??
      (await this.openRoom(
        database,
        { id: currentUser.id, name: currentUser.description.full_name, kind: 'teacher' },
        { kind: 'live_session', space_id: activity.space_id, activity_id: activity.id, title: activity.title },
      ));
    return this.enter(database, room, this.staffPerson(currentUser, 'host'));
  }

  private staffPerson(currentUser: CurrentUser, role: 'host' | 'observer') {
    return {
      role,
      id: currentUser.id,
      userId: currentUser.id,
      name: currentUser.description.full_name,
      childId: null,
      share: role === 'host',
    };
  }

  async staffJoin(currentUser: CurrentUser, roomId: string) {
    const { database } = await this.currentSchoolYear.require();
    const room = await this.loadRoom(database, roomId);
    const role = await this.staffRole(currentUser, database, room);
    return this.enter(database, room, this.staffPerson(currentUser, role));
  }

  // Rời phòng: học sinh thôi thấy "giáo viên đang xem" ngay, không đợi sự kiện gọi lại
  async staffLeave(currentUser: CurrentUser, roomId: string) {
    const { database } = await this.currentSchoolYear.require();
    const room = await this.loadRoom(database, roomId);
    const role = await this.staffRole(currentUser, database, room);
    await this.leave(database, room.id, videoIdentity(role, currentUser.id));
    return { left: true };
  }

  private async leave(database: YearExecutor, roomId: string, identity: string) {
    await database
      .updateTable('learning_live_participants')
      .set({ left_at: this.clock.now() })
      .where('room_id', '=', roomId)
      .where('identity', '=', identity)
      .where('left_at', 'is', null)
      .execute();
  }

  // Kết thúc phòng (kèm các phòng chia nhỏ của phòng giờ học)
  async endRoom(currentUser: CurrentUser, roomId: string) {
    const { database } = await this.currentSchoolYear.require();
    const room = await this.loadRoom(database, roomId);
    await this.assertHost(currentUser, database, room);
    const children = await database
      .selectFrom('learning_live_rooms')
      .select('id')
      .where('parent_room_id', '=', room.id)
      .where('status', '=', 'open')
      .execute();
    const ids = [room.id, ...children.map((child) => child.id)];
    await this.markEnded(database, ids);
    await this.endProviderRooms(ids);
    return { ended: true };
  }

  // Giáo viên xác nhận điểm danh: có mặt ghi hoàn thành, vắng ghi chưa học, có phép ghi được miễn
  async confirmAttendance(currentUser: CurrentUser, activityId: string, body: RequestBody) {
    const { database, space, activity } = await this.liveActivity(currentUser, activityId);
    const entries = Array.isArray(body?.entries) ? (body.entries as Array<Record<string, unknown>>) : [];
    const students = new Set((await this.learning.students(database, space)).map((student) => student.id));
    const errors: FieldError[] = [];
    const parsed = entries.map((entry, index) => {
      const status = resultOfAttendance(entry?.status);
      const childId = typeof entry?.child_id === 'string' ? entry.child_id : '';
      if (!status || !students.has(childId)) {
        errors.push({
          field: `entries[${index}]`,
          message: 'Học sinh của lớp và trạng thái có mặt, vắng hoặc có phép',
        });
      }
      return { childId, status };
    });
    if (entries.length === 0) errors.push({ field: 'entries', message: 'Chưa có học sinh nào để xác nhận' });
    if (errors.length > 0) throw validationError(errors);
    await database.transaction().execute(async (transaction) => {
      for (const entry of parsed) {
        await this.learning.writeResult(
          transaction,
          activity,
          entry.childId,
          {
            status: entry.status as 'completed' | 'not_started' | 'excused',
            progress: entry.status === 'completed' ? 100 : 0,
          },
          { userId: currentUser.id, kind: 'teacher', verb: 'completed' },
        );
      }
    });
    return { recorded: parsed.length };
  }

  // ---------- Phòng chia nhỏ

  private async hostedSession(currentUser: CurrentUser, roomId: string) {
    const { database } = await this.currentSchoolYear.require();
    const room = await this.loadRoom(database, roomId);
    if (room.kind !== 'live_session' || room.status !== 'open') {
      throw liveRule('Phòng chia nhỏ chỉ tạo từ phòng giờ học đang mở');
    }
    await this.assertHost(currentUser, database, room);
    return { database, room };
  }

  private async openBreakouts(database: YearExecutor, parentId: string) {
    return database
      .selectFrom('learning_live_rooms')
      .selectAll()
      .where('parent_room_id', '=', parentId)
      .where('status', '=', 'open')
      .execute();
  }

  async createBreakouts(currentUser: CurrentUser, roomId: string, body: RequestBody, origin: ChangeOrigin) {
    const { database, room } = await this.hostedSession(currentUser, roomId);
    const { space, activity } = await this.learning.teacherActivity(currentUser, room.activity_id as string);
    const students = await this.learning.students(database, space);
    const request = parseBreakoutRequest(body, students.length);
    if (request.errors.length > 0) throw validationError(request.errors);
    let groups: Array<{ id: string | null; name: string; child_ids: string[] }>;
    if (request.groupSetId) {
      const set = await database
        .selectFrom('group_sets')
        .select(['id', 'class_id', 'status', 'owner_user_id'])
        .where('id', '=', isUuid(request.groupSetId) ? request.groupSetId : '00000000-0000-0000-0000-000000000000')
        .executeTakeFirst();
      const ownSet = space.class_id ? set?.class_id === space.class_id : set?.owner_user_id === currentUser.id;
      if (!set || set.status !== 'active' || !ownSet) {
        throw liveRule('Bộ nhóm không thuộc lớp của lớp học trực tuyến này');
      }
      groups = (await this.groupReader.groupsOfSet(database, set.id)).map((group) => ({
        id: group.id,
        name: group.name,
        child_ids: group.child_ids,
      }));
    } else {
      const split = splitRandom(
        students.map((student) => student.id),
        request.count as number,
        request.seed,
      );
      const drafts = split.map((childIds, index) => ({
        name: `Phòng ${index + 1}`,
        child_ids: childIds,
        leader_child_id: null,
      }));
      if (space.class_id) {
        // Lưu thành bộ nhóm của tiết học (mục đích classroom) để dùng lại, xem lại cách chia
        const created = (await this.groupSets.create(
          currentUser,
          {
            classId: space.class_id,
            subjectId: space.subject_id,
            purpose: 'classroom',
            name: `Phòng chia nhỏ: ${activity.title}`.slice(0, 120),
            method: 'random',
            mode: { by: 'count', value: request.count as number },
            seed: request.seed,
            abilitySource: null,
            balanceGender: false,
            excludeAbsent: false,
            apart: [],
            together: [],
            leaderMode: 'none',
            groups: drafts,
            replacesId: null,
          },
          origin,
        )) as { id: string };
        groups = (await this.groupReader.groupsOfSet(database, created.id)).map((group) => ({
          id: group.id,
          name: group.name,
          child_ids: group.child_ids,
        }));
      } else {
        groups = drafts.map((draft) => ({ id: null, name: draft.name, child_ids: draft.child_ids }));
      }
    }
    const enrolled = new Set(students.map((student) => student.id));
    const previous = await this.openBreakouts(database, room.id);
    await this.markEnded(
      database,
      previous.map((row) => row.id),
    );
    await this.endProviderRooms(previous.map((row) => row.id));
    await database.deleteFrom('learning_breakout_members').where('parent_room_id', '=', room.id).execute();
    const endsAt = new Date(this.clock.now().getTime() + request.minutes * 60_000);
    const opener = { id: currentUser.id, name: currentUser.description.full_name, kind: 'teacher' as const };
    for (const group of groups) {
      const breakout = await this.openRoom(database, opener, {
        kind: 'breakout',
        space_id: room.space_id,
        activity_id: room.activity_id,
        group_id: group.id,
        parent_room_id: room.id,
        title: `${room.title}: ${group.name}`,
        ends_at: endsAt,
      });
      const members = group.child_ids.filter((childId) => enrolled.has(childId));
      if (members.length > 0) {
        await database
          .insertInto('learning_breakout_members')
          .values(members.map((childId) => ({ parent_room_id: room.id, child_id: childId, room_id: breakout.id })))
          .execute();
      }
    }
    return { rooms: groups.length, ends_at: endsAt, seed: request.groupSetId ? null : request.seed };
  }

  // Gọi tất cả về phòng chính: kết thúc các phòng chia nhỏ
  async closeBreakouts(currentUser: CurrentUser, roomId: string) {
    const { database, room } = await this.hostedSession(currentUser, roomId);
    const breakouts = await this.openBreakouts(database, room.id);
    const ids = breakouts.map((row) => row.id);
    await this.markEnded(database, ids);
    await this.endProviderRooms(ids);
    await database.deleteFrom('learning_breakout_members').where('parent_room_id', '=', room.id).execute();
    await database
      .updateTable('learning_live_help_requests')
      .set({ resolved_at: this.clock.now() })
      .where('room_id', 'in', ids.length > 0 ? ids : [room.id])
      .where('resolved_at', 'is', null)
      .execute();
    return { closed: ids.length };
  }

  async sendNotice(currentUser: CurrentUser, roomId: string, body: RequestBody) {
    const { database, room } = await this.hostedSession(currentUser, roomId);
    const text = typeof body?.body === 'string' ? body.body.trim() : '';
    if (text === '' || text.length > MAX_NOTICE_LENGTH) {
      throw validationError([{ field: 'body', message: `Thông báo từ 1 đến ${MAX_NOTICE_LENGTH} ký tự` }]);
    }
    return database
      .insertInto('learning_live_notices')
      .values({ room_id: room.id, body: text, sent_by_name: currentUser.description.full_name })
      .returning(['id', 'body', 'sent_by_name', 'created_at'])
      .executeTakeFirstOrThrow();
  }

  async moveStudent(currentUser: CurrentUser, roomId: string, body: RequestBody) {
    const { database, room } = await this.hostedSession(currentUser, roomId);
    const target = typeof body?.room_id === 'string' ? body.room_id : '';
    const childId = typeof body?.child_id === 'string' ? body.child_id : '';
    const breakouts = await this.openBreakouts(database, room.id);
    if (!breakouts.some((row) => row.id === target)) throw liveRule('Chọn một phòng chia nhỏ đang mở');
    const { space } = await this.learning.teacherActivity(currentUser, room.activity_id as string);
    const students = await this.learning.students(database, space);
    if (!students.some((student) => student.id === childId))
      throw liveRule('Học sinh không thuộc lớp học trực tuyến này');
    await database
      .insertInto('learning_breakout_members')
      .values({
        parent_room_id: room.id,
        child_id: childId,
        room_id: target,
        moved_by_name: currentUser.description.full_name,
      })
      .onConflict((conflict) =>
        conflict.columns(['parent_room_id', 'child_id']).doUpdateSet({
          room_id: target,
          moved_by_name: currentUser.description.full_name,
          updated_at: this.clock.now(),
        }),
      )
      .execute();
    return { moved: true };
  }

  async resolveHelp(currentUser: CurrentUser, helpId: string) {
    const { database } = await this.currentSchoolYear.require();
    const help = isUuid(helpId)
      ? await database.selectFrom('learning_live_help_requests').selectAll().where('id', '=', helpId).executeTakeFirst()
      : undefined;
    if (!help) throw notFoundError('Không tìm thấy lượt gọi giáo viên', 'learning_live_help_request');
    await this.assertHost(currentUser, database, await this.loadRoom(database, help.room_id));
    await database
      .updateTable('learning_live_help_requests')
      .set({ resolved_at: this.clock.now() })
      .where('id', '=', help.id)
      .execute();
    return { resolved: true };
  }

  // ---------- Phòng nhóm (cán bộ)

  private async setsOf(currentUser: CurrentUser, database: YearExecutor, space: { class_id: string | null }) {
    if (space.class_id) return this.groupReader.activeSets(database, { classId: space.class_id });
    return database
      .selectFrom('group_sets')
      .select(['id', 'class_id', 'subject_id', 'name', 'purpose', 'method', 'owner_user_id', 'created_at'])
      .where('owner_user_id', '=', currentUser.id)
      .where('status', '=', 'active')
      .orderBy('created_at', 'desc')
      .execute();
  }

  // Bộ nhóm đang dùng của lớp gắn lớp học trực tuyến (khoá tự chọn không gắn lớp: bộ nhóm do chính giáo viên lập), mỗi nhóm kèm
  // phòng đang mở; cài đặt học sinh tự mở theo bộ
  async spaceGroups(currentUser: CurrentUser, spaceId: string) {
    const { database, space } = await this.learning.spaceAccess(currentUser, spaceId);
    const sets = await this.setsOf(currentUser, database, space);
    const result = [];
    for (const set of sets) {
      const groups = await this.groupReader.groupsOfSet(database, set.id);
      const rooms =
        groups.length === 0
          ? []
          : await database
              .selectFrom('learning_live_rooms')
              .selectAll()
              .where('kind', '=', 'group')
              .where('status', '=', 'open')
              .where(
                'group_id',
                'in',
                groups.map((group) => group.id),
              )
              .execute();
      const present = await this.participants(
        database,
        rooms.map((room) => room.id),
      );
      result.push({
        id: set.id,
        name: set.name,
        purpose: set.purpose,
        student_open: await this.studentOpenAllowed(database, set.id),
        groups: groups.map((group) => {
          const room = rooms.find((row) => row.group_id === group.id);
          return {
            id: group.id,
            name: group.name,
            member_count: group.child_ids.length,
            room: room
              ? {
                  id: room.id,
                  opened_by_name: room.opened_by_name,
                  opened_by_kind: room.opened_by_kind,
                  present: present.filter((row) => row.room_id === room.id && row.left_at === null),
                }
              : null,
          };
        }),
      });
    }
    return { open_now: await this.openHoursNow(database), sets: result };
  }

  async saveGroupSetting(currentUser: CurrentUser, groupSetId: string, body: RequestBody) {
    const { database } = await this.currentSchoolYear.require();
    const groups = isUuid(groupSetId) ? await this.groupReader.groupsOfSet(database, groupSetId) : [];
    const first = groups[0];
    if (!first) throw notFoundError('Không tìm thấy bộ nhóm', 'group_set');
    if ((await this.groupStaff(currentUser, database, first.id)).role !== 'host') {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người lập bộ nhóm, giáo viên của lớp đổi cài đặt phòng nhóm');
    }
    if (typeof body?.student_open !== 'boolean') {
      throw validationError([{ field: 'student_open', message: 'Chọn bật hoặc tắt' }]);
    }
    const values = {
      student_open: body.student_open,
      updated_by_name: currentUser.description.full_name,
      updated_at: this.clock.now(),
    };
    await database
      .insertInto('learning_group_room_settings')
      .values({ group_set_id: groupSetId, ...values })
      .onConflict((conflict) => conflict.column('group_set_id').doUpdateSet(values))
      .execute();
    return { group_set_id: groupSetId, student_open: body.student_open };
  }

  private async openGroupRoom(
    database: YearExecutor,
    group: { id: string; name: string },
    opener: { id: string; name: string; kind: 'teacher' | 'student' },
  ) {
    const existing = await database
      .selectFrom('learning_live_rooms')
      .selectAll()
      .where('kind', '=', 'group')
      .where('group_id', '=', group.id)
      .where('status', '=', 'open')
      .executeTakeFirst();
    return (
      existing ??
      this.openRoom(database, opener, { kind: 'group', group_id: group.id, title: `Phòng nhóm ${group.name}` })
    );
  }

  async staffOpenGroup(currentUser: CurrentUser, groupId: string) {
    const { database } = await this.currentSchoolYear.require();
    const { group, role } = await this.groupStaff(currentUser, database, groupId);
    if (role !== 'host')
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người lập bộ nhóm, giáo viên của lớp mở phòng nhóm');
    const room = await this.openGroupRoom(database, group, {
      id: currentUser.id,
      name: currentUser.description.full_name,
      kind: 'teacher',
    });
    return this.enter(database, room, this.staffPerson(currentUser, 'host'));
  }

  // ---------- Học sinh

  private async studentRoomAccess(database: YearExecutor, childId: string, room: RoomRow) {
    if (room.kind === 'live_session') {
      await this.learning.openActivityForChild(database, childId, room.activity_id as string);
      return;
    }
    if (room.kind === 'breakout') {
      const member = await database
        .selectFrom('learning_breakout_members')
        .select('room_id')
        .where('parent_room_id', '=', room.parent_room_id as string)
        .where('child_id', '=', childId)
        .executeTakeFirst();
      if (member?.room_id !== room.id) throw notFoundError('Em không ở phòng chia nhỏ này', 'learning_live_room');
      return;
    }
    if (!(await this.isGroupMember(database, room.group_id as string, childId))) {
      throw notFoundError('Không tìm thấy phòng nhóm của em', 'learning_live_room');
    }
  }

  // Giờ học đang mở của em (kèm phòng chia nhỏ em được xếp) và phòng nhóm của các nhóm em thuộc
  async studentOverview(currentUser: CurrentUser) {
    const { database, childId } = await this.learning.studentContext(currentUser);
    const learning = await this.learning.learningOfChild(database, childId);
    const liveActivities = learning.spaces.flatMap((space) =>
      space.sections.flatMap((section) =>
        section.activities
          .filter((activity) => activity.kind === 'live_session' && activity.open)
          .map((activity) => ({
            id: activity.id,
            title: activity.title,
            space: space.title,
            opens_at: activity.opens_at,
          })),
      ),
    );
    const sessionRooms =
      liveActivities.length === 0
        ? []
        : await database
            .selectFrom('learning_live_rooms')
            .selectAll()
            .where('kind', '=', 'live_session')
            .where('status', '=', 'open')
            .where(
              'activity_id',
              'in',
              liveActivities.map((activity) => activity.id),
            )
            .execute();
    const assignments =
      sessionRooms.length === 0
        ? []
        : await database
            .selectFrom('learning_breakout_members')
            .innerJoin('learning_live_rooms', 'learning_live_rooms.id', 'learning_breakout_members.room_id')
            .select([
              'learning_breakout_members.parent_room_id',
              'learning_live_rooms.id',
              'learning_live_rooms.title',
              'learning_live_rooms.ends_at',
            ])
            .where('learning_breakout_members.child_id', '=', childId)
            .where('learning_live_rooms.status', '=', 'open')
            .where(
              'learning_breakout_members.parent_room_id',
              'in',
              sessionRooms.map((room) => room.id),
            )
            .execute();
    const groups = await database
      .selectFrom('child_group_members')
      .innerJoin('child_groups', 'child_groups.id', 'child_group_members.group_id')
      .innerJoin('group_sets', 'group_sets.id', 'child_groups.group_set_id')
      .select([
        'child_groups.id',
        'child_groups.name',
        'group_sets.id as group_set_id',
        'group_sets.name as group_set_name',
      ])
      .where('child_group_members.child_id', '=', childId)
      .where('group_sets.status', '=', 'active')
      .orderBy('group_sets.created_at', 'desc')
      .execute();
    const groupRooms =
      groups.length === 0
        ? []
        : await database
            .selectFrom('learning_live_rooms')
            .selectAll()
            .where('kind', '=', 'group')
            .where('status', '=', 'open')
            .where(
              'group_id',
              'in',
              groups.map((group) => group.id),
            )
            .execute();
    const openNow = await this.openHoursNow(database);
    const groupList = [];
    for (const group of groups) {
      const room = groupRooms.find((row) => row.group_id === group.id);
      const studentOpen = await this.studentOpenAllowed(database, group.group_set_id);
      groupList.push({
        id: group.id,
        name: group.name,
        group_set_name: group.group_set_name,
        room: room ? { id: room.id, opened_by_kind: room.opened_by_kind } : null,
        can_open: !room && studentOpen && openNow,
        can_join: room !== undefined && (room.opened_by_kind === 'teacher' || openNow),
      });
    }
    return {
      open_now: openNow,
      sessions: liveActivities.map((activity) => {
        const room = sessionRooms.find((row) => row.activity_id === activity.id);
        const breakout = room ? assignments.find((row) => row.parent_room_id === room.id) : undefined;
        return {
          ...activity,
          room_id: room?.id ?? null,
          breakout: breakout ? { id: breakout.id, title: breakout.title, ends_at: breakout.ends_at } : null,
        };
      }),
      groups: groupList.filter((group) => group.room !== null || group.can_open),
    };
  }

  private async studentPerson(database: YearExecutor, currentUser: CurrentUser, childId: string, share: boolean) {
    return {
      role: 'student' as const,
      id: childId,
      userId: currentUser.id,
      name: await this.childName(database, childId),
      childId,
      share,
    };
  }

  async studentJoinSession(currentUser: CurrentUser, activityId: string) {
    const { database, childId } = await this.learning.studentContext(currentUser);
    const activity = await this.learning.openActivityForChild(database, childId, activityId);
    if (activity.kind !== 'live_session') throw liveRule('Hoạt động không phải giờ học trực tuyến');
    const room = await database
      .selectFrom('learning_live_rooms')
      .selectAll()
      .where('activity_id', '=', activity.id)
      .where('kind', '=', 'live_session')
      .where('status', '=', 'open')
      .executeTakeFirst();
    if (!room) throw liveRule('Giáo viên chưa mở phòng giờ học');
    return this.enter(database, room, await this.studentPerson(database, currentUser, childId, false));
  }

  async studentOpenGroup(currentUser: CurrentUser, groupId: string) {
    const { database, childId } = await this.learning.studentContext(currentUser);
    if (!(await this.isGroupMember(database, groupId, childId))) {
      throw notFoundError('Không tìm thấy nhóm của em', 'child_group');
    }
    const group = await this.groupOf(database, groupId);
    if (!(await this.studentOpenAllowed(database, group.group_set_id))) {
      throw liveRule('Giáo viên chưa bật cho nhóm tự mở phòng video');
    }
    if (!(await this.openHoursNow(database))) {
      throw liveRule('Ngoài giờ mở phòng nhóm của trường, em chưa mở được phòng');
    }
    const room = await this.openGroupRoom(database, group, {
      id: currentUser.id,
      name: await this.childName(database, childId),
      kind: 'student',
    });
    return this.enter(database, room, await this.studentPerson(database, currentUser, childId, true));
  }

  async studentJoinRoom(currentUser: CurrentUser, roomId: string) {
    const { database, childId } = await this.learning.studentContext(currentUser);
    const room = await this.loadRoom(database, roomId);
    await this.studentRoomAccess(database, childId, room);
    if (room.kind === 'group' && room.opened_by_kind === 'student' && !(await this.openHoursNow(database))) {
      throw liveRule('Ngoài giờ mở phòng nhóm của trường, em chưa vào được phòng');
    }
    return this.enter(
      database,
      room,
      await this.studentPerson(database, currentUser, childId, room.kind !== 'live_session'),
    );
  }

  // Trạng thái phòng em đang ở: giáo viên đang xem (GD-149), thông báo của giáo viên, hạn phòng chia nhỏ, phòng em được chuyển tới
  async studentRoom(currentUser: CurrentUser, roomId: string) {
    const { database, childId } = await this.learning.studentContext(currentUser);
    const room = await this.loadRoom(database, roomId);
    const parentId = room.kind === 'breakout' ? (room.parent_room_id as string) : room.id;
    let movedTo: string | null = null;
    if (room.kind === 'breakout') {
      const member = await database
        .selectFrom('learning_breakout_members')
        .select('room_id')
        .where('parent_room_id', '=', parentId)
        .where('child_id', '=', childId)
        .executeTakeFirst();
      if (!member) {
        if (!(await this.isSessionStudent(database, childId, room))) {
          throw notFoundError('Em không ở phòng chia nhỏ này', 'learning_live_room');
        }
      } else if (member.room_id !== room.id) {
        movedTo = member.room_id;
      }
    } else {
      await this.studentRoomAccess(database, childId, room);
    }
    const [participants, notices, breakout] = await Promise.all([
      this.participants(database, [room.id]),
      database
        .selectFrom('learning_live_notices')
        .select(['id', 'body', 'sent_by_name', 'created_at'])
        .where('room_id', '=', parentId)
        .orderBy('created_at', 'desc')
        .limit(5)
        .execute(),
      room.kind === 'live_session'
        ? database
            .selectFrom('learning_breakout_members')
            .innerJoin('learning_live_rooms', 'learning_live_rooms.id', 'learning_breakout_members.room_id')
            .select(['learning_live_rooms.id', 'learning_live_rooms.title', 'learning_live_rooms.ends_at'])
            .where('learning_breakout_members.parent_room_id', '=', room.id)
            .where('learning_breakout_members.child_id', '=', childId)
            .where('learning_live_rooms.status', '=', 'open')
            .executeTakeFirst()
        : Promise.resolve(undefined),
    ]);
    return {
      id: room.id,
      kind: room.kind,
      title: room.title,
      status: room.status,
      ends_at: room.ends_at,
      teacher_watching: teacherWatching(participants),
      notices,
      breakout: breakout ?? null,
      moved_to: movedTo,
      parent_room_id: room.parent_room_id,
    };
  }

  private async isSessionStudent(database: YearExecutor, childId: string, room: RoomRow) {
    try {
      await this.learning.openActivityForChild(database, childId, room.activity_id as string);
      return true;
    } catch {
      return false;
    }
  }

  async studentLeave(currentUser: CurrentUser, roomId: string) {
    const { database, childId } = await this.learning.studentContext(currentUser);
    const room = await this.loadRoom(database, roomId);
    await this.leave(database, room.id, videoIdentity('student', childId));
    return { left: true };
  }

  async studentHelp(currentUser: CurrentUser, roomId: string) {
    const { database, childId } = await this.learning.studentContext(currentUser);
    const room = await this.loadRoom(database, roomId);
    if (room.kind !== 'breakout' || room.status !== 'open') throw liveRule('Gọi giáo viên từ phòng chia nhỏ đang mở');
    await this.studentRoomAccess(database, childId, room);
    await database
      .insertInto('learning_live_help_requests')
      .values({ room_id: room.id, child_id: childId, child_name: await this.childName(database, childId) })
      .onConflict((conflict) => conflict.columns(['room_id', 'child_id']).where('resolved_at', 'is', null).doNothing())
      .execute();
    return { requested: true };
  }

  // Báo cáo từ phòng vào hàng chờ của trường (28e): báo cáo gắn chủ đề hệ thống "Phòng video" của nhóm hoặc của lớp học trực tuyến
  async studentReport(currentUser: CurrentUser, roomId: string, body: RequestBody) {
    const { database, childId } = await this.learning.studentContext(currentUser);
    const room = await this.loadRoom(database, roomId);
    await this.studentRoomAccess(database, childId, room);
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    if (reason === '' || reason.length > 500) {
      throw validationError([{ field: 'reason', message: 'Lý do từ 1 đến 500 ký tự' }]);
    }
    const threadId = await this.reportThread(database, room);
    return database
      .insertInto('discussion_reports')
      .values({
        thread_id: threadId,
        post_id: null,
        source: 'report',
        reason: `[Phòng video: ${room.title}] ${reason}`.slice(0, 500),
        reporter_user_id: currentUser.id,
        reporter_kind: 'student',
        due_at: new Date(this.clock.now().getTime() + REPORT_DUE_DAYS * 86_400_000),
      })
      .returning(['id', 'status', 'due_at'])
      .executeTakeFirstOrThrow();
  }

  private async reportThread(database: YearExecutor, room: RoomRow): Promise<string> {
    const title = 'Phòng video (báo cáo từ phòng học trực tuyến)';
    if (room.group_id) {
      const group = await this.groupOf(database, room.group_id);
      const existing = await database
        .selectFrom('discussion_threads')
        .select('id')
        .where('scope', '=', 'group')
        .where('group_id', '=', group.id)
        .where('title', '=', title)
        .executeTakeFirst();
      if (existing) return existing.id;
      return (
        await database
          .insertInto('discussion_threads')
          .values({
            scope: 'group',
            space_id: null,
            group_id: group.id,
            kind: 'group_board',
            title,
            body: 'Chủ đề hệ thống nối báo cáo từ phòng video của nhóm vào hàng chờ của trường.',
            author_user_id: group.owner_user_id,
            author_name: group.owner_name,
            author_kind: 'staff',
            author_child_id: null,
            status: 'locked',
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    const spaceId = room.space_id as string;
    const existing = await database
      .selectFrom('discussion_threads')
      .select('id')
      .where('scope', '=', 'course_space')
      .where('space_id', '=', spaceId)
      .where('title', '=', title)
      .executeTakeFirst();
    if (existing) return existing.id;
    return (
      await database
        .insertInto('discussion_threads')
        .values({
          scope: 'course_space',
          space_id: spaceId,
          group_id: null,
          kind: 'question',
          title,
          body: 'Chủ đề hệ thống nối báo cáo từ phòng video của lớp học trực tuyến vào hàng chờ của trường.',
          private: true,
          author_user_id: room.opened_by,
          author_name: room.opened_by_name,
          author_kind: 'staff',
          author_child_id: null,
          status: 'locked',
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
  }
}
