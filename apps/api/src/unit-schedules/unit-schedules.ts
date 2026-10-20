import { Injectable } from '@nestjs/common';
import type {
  RoomBookingStatus,
  ScheduleSession,
  ScheduleTemplateItem,
  SchoolYearDatabase,
  SystemDatabase,
} from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, validationError, type FieldError } from '@school-management/server';
import {
  PERMISSION_CODES,
  ROOM_BOOKING_STATUS_LABELS,
  SCHEDULE_SESSION_LABELS,
  WEEKDAY_LABELS,
} from '@school-management/shared';
import { sql, type Kysely, type Transaction } from 'kysely';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { queueNotification } from '../common/notification-queue.js';
import { notFoundError, type RequestBody } from '../common/request-fields.js';
import type { TableFileFormat } from '../exports/table-file.js';
import { buildFacilitiesWorkbook, fileStamp } from '../facilities/facilities-workbook.js';
import { DocumentAdminService } from '../incoming-documents/document-admin.js';
import { DIRECTIVE_RULE_CODE, shiftDate } from '../work/directive-fields.js';
import { readWorkDate, readWorkText } from '../work/work-access.js';

// Lịch đơn vị và phòng họp theo VNPT iOffice (DT-18 phần 18c, YCTD-141; quyết định của Eric ngày 2026-10-19):
// - Đăng ký lịch đơn vị: lịch tuần thứ Hai đến Chủ nhật theo buổi sáng, chiều; mỗi dòng có giờ, nội dung, chủ trì, thành
//   phần, địa điểm, ghi chú, người tham dự. Dòng mới là bản nháp chỉ người đăng ký lịch thấy; công bố thì mọi người có quyền
//   xem lịch thấy và người tham dự nhận thông báo. Lịch của đơn vị trống là lịch toàn trường;
// - Phòng họp: dòng lịch chọn phòng họp thì kèm một lượt đăng ký phòng; người duyệt phòng họp tự duyệt, người khác chờ duyệt.
//   Hai lượt chờ duyệt hoặc đã duyệt của một phòng không được chồng giờ;
// - Mẫu lịch: các dòng theo thứ và buổi, áp vào một tuần thành các dòng nháp;
// - Lịch họp: xem theo tuần, tháng, tất cả hoặc "Lịch của tôi" (mình tham dự hoặc mình đăng ký); lọc đơn vị, địa điểm,
//   thành phần; xuất Excel, PDF.
// Chi tiết do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-141
type Executor = Kysely<SystemDatabase> | Transaction<SystemDatabase>;

const MANAGE = PERMISSION_CODES.scheduleManage;
const ROOMS = PERMISSION_CODES.meetingRoomManage;
const SESSIONS: ScheduleSession[] = ['morning', 'afternoon'];
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAXIMUM_RANGE_DAYS = 62;
const MAXIMUM_TEMPLATE_ITEMS = 100;

export interface EntryInput {
  org_unit_id: string | null;
  entry_date: string;
  session: ScheduleSession;
  start_time: string | null;
  end_time: string | null;
  content: string;
  chair_name: string | null;
  participants: string | null;
  location: string | null;
  note: string | null;
  attendee_ids: string[];
  room_id: string | null;
}

export interface BookingInput {
  room_id: string;
  title: string;
  chair_name: string | null;
  participants: string | null;
  date: string;
  start_time: string;
  end_time: string;
  note: string | null;
}

export interface ScheduleFilter {
  from: string;
  to: string;
  orgUnitId: string | null;
  mine: boolean;
  location: string | null;
  participant: string | null;
}

export function readTime(body: RequestBody, field: string, errors: FieldError[], required = false): string | null {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    if (required) {
      errors.push({ field, message: 'Bắt buộc nhập giờ' });
    }
    return null;
  }
  if (typeof value !== 'string' || !TIME_PATTERN.test(value)) {
    errors.push({ field, message: 'Giờ dạng HH:MM' });
    return null;
  }
  return value;
}

function readId(body: RequestBody, field: string, errors: FieldError[]): string | null {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value)) {
    errors.push({ field, message: 'Mã không hợp lệ' });
    return null;
  }
  return value;
}

function throwIfAny(errors: FieldError[]) {
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

// Buổi của một giờ: trước 12 giờ là sáng
export function sessionOf(time: string): ScheduleSession {
  return time < '12:00' ? 'morning' : 'afternoon';
}

// Thứ Hai đầu tuần của một ngày
export function weekStart(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return shiftDate(date, day === 0 ? -6 : 1 - day);
}

// Thời điểm theo giờ Việt Nam
export function vietnamTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00+07:00`);
}

export function parseEntry(body: RequestBody): EntryInput {
  const errors: FieldError[] = [];
  const startTime = readTime(body, 'start_time', errors);
  const endTime = readTime(body, 'end_time', errors);
  const input: EntryInput = {
    org_unit_id: readId(body, 'org_unit_id', errors),
    entry_date: readWorkDate(body, 'entry_date', errors, true) ?? '',
    session: SESSIONS.includes(body?.session as ScheduleSession)
      ? (body?.session as ScheduleSession)
      : startTime
        ? sessionOf(startTime)
        : 'morning',
    start_time: startTime,
    end_time: endTime,
    content: readWorkText(body, 'content', errors, { required: true }) ?? '',
    chair_name: readWorkText(body, 'chair_name', errors, { maximum: 200 }),
    participants: readWorkText(body, 'participants', errors, { maximum: 1000 }),
    location: readWorkText(body, 'location', errors, { maximum: 200 }),
    note: readWorkText(body, 'note', errors, { maximum: 1000 }),
    attendee_ids: [],
    room_id: readId(body, 'room_id', errors),
  };
  if (body?.session !== undefined && !SESSIONS.includes(body.session as ScheduleSession)) {
    errors.push({ field: 'session', message: 'Buổi là morning (sáng) hoặc afternoon (chiều)' });
  }
  if (endTime && (!startTime || endTime <= startTime)) {
    errors.push({ field: 'end_time', message: 'Giờ kết thúc sau giờ bắt đầu' });
  }
  if (input.room_id && (!startTime || !endTime)) {
    errors.push({ field: 'start_time', message: 'Đăng ký phòng họp cần giờ bắt đầu và giờ kết thúc' });
  }
  const attendees = body?.attendee_ids;
  if (attendees !== undefined && attendees !== null) {
    if (
      !Array.isArray(attendees) ||
      attendees.length > 200 ||
      attendees.some((id) => typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id))
    ) {
      errors.push({ field: 'attendee_ids', message: 'Danh sách người tham dự không hợp lệ' });
    } else {
      input.attendee_ids = [...new Set(attendees as string[])];
    }
  }
  throwIfAny(errors);
  return input;
}

export function parseBooking(body: RequestBody): BookingInput {
  const errors: FieldError[] = [];
  const input: BookingInput = {
    room_id: readId(body, 'room_id', errors) ?? '',
    title: readWorkText(body, 'title', errors, { required: true, maximum: 500 }) ?? '',
    chair_name: readWorkText(body, 'chair_name', errors, { maximum: 200 }),
    participants: readWorkText(body, 'participants', errors, { maximum: 1000 }),
    date: readWorkDate(body, 'date', errors, true) ?? '',
    start_time: readTime(body, 'start_time', errors, true) ?? '',
    end_time: readTime(body, 'end_time', errors, true) ?? '',
    note: readWorkText(body, 'note', errors, { maximum: 1000 }),
  };
  if (!input.room_id && !errors.some((error) => error.field === 'room_id')) {
    errors.push({ field: 'room_id', message: 'Chọn phòng họp' });
  }
  if (input.start_time && input.end_time && input.end_time <= input.start_time) {
    errors.push({ field: 'end_time', message: 'Giờ kết thúc sau giờ bắt đầu' });
  }
  throwIfAny(errors);
  return input;
}

export function parseTemplateItems(value: unknown): ScheduleTemplateItem[] {
  const errors: FieldError[] = [];
  if (!Array.isArray(value) || value.length > MAXIMUM_TEMPLATE_ITEMS) {
    throw validationError([{ field: 'items', message: `Mẫu lịch có tối đa ${MAXIMUM_TEMPLATE_ITEMS} dòng` }]);
  }
  const items = value.map((raw, index) => {
    const body = (raw ?? {}) as NonNullable<RequestBody>;
    const rowErrors: FieldError[] = [];
    const weekday = body.weekday;
    if (typeof weekday !== 'number' || !Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
      rowErrors.push({ field: 'weekday', message: 'Thứ từ 1 (thứ Hai) đến 7 (Chủ nhật)' });
    }
    if (!SESSIONS.includes(body.session as ScheduleSession)) {
      rowErrors.push({ field: 'session', message: 'Buổi là morning hoặc afternoon' });
    }
    const item: ScheduleTemplateItem = {
      weekday: weekday as number,
      session: body.session as ScheduleSession,
      start_time: readTime(body, 'start_time', rowErrors),
      end_time: readTime(body, 'end_time', rowErrors),
      content: readWorkText(body, 'content', rowErrors, { required: true }) ?? '',
      chair_name: readWorkText(body, 'chair_name', rowErrors, { maximum: 200 }),
      participants: readWorkText(body, 'participants', rowErrors, { maximum: 1000 }),
      location: readWorkText(body, 'location', rowErrors, { maximum: 200 }),
      note: readWorkText(body, 'note', rowErrors, { maximum: 1000 }),
    };
    if (item.end_time && (!item.start_time || item.end_time <= item.start_time)) {
      rowErrors.push({ field: 'end_time', message: 'Giờ kết thúc sau giờ bắt đầu' });
    }
    errors.push(...rowErrors.map((error) => ({ field: `items[${index}].${error.field}`, message: error.message })));
    return item;
  });
  throwIfAny(errors);
  return items;
}

function hasPermission(currentUser: CurrentUser, code: string): boolean {
  return currentUser.hasPermission(code);
}

@Injectable()
export class UnitSchedulesService {
  constructor(
    private readonly databases: Databases,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly admin: DocumentAdminService,
    private readonly clock: Clock,
  ) {}

  private get system(): Kysely<SystemDatabase> {
    return this.databases.system;
  }

  // ---- Phạm vi đăng ký lịch: lịch toàn trường cần quyền toàn trường, lịch của đơn vị cần quyền ở đơn vị đó ----

  private canManageUnit(currentUser: CurrentUser, orgUnitId: string | null): boolean {
    const scope = currentUser.organizationScope(MANAGE);
    return scope.wholeSchool || (orgUnitId !== null && scope.orgUnitIds.includes(orgUnitId));
  }

  private assertManageUnit(currentUser: CurrentUser, orgUnitId: string | null) {
    if (!this.canManageUnit(currentUser, orgUnitId)) {
      throw new ApplicationError(
        'ERR_FORBIDDEN',
        orgUnitId ? 'Đơn vị này nằm ngoài phạm vi đăng ký lịch của bạn' : 'Lịch toàn trường cần quyền toàn trường',
      );
    }
  }

  // ---- Phòng họp ----

  listRooms(activeOnly: boolean) {
    let query = this.system.selectFrom('meeting_rooms').selectAll();
    if (activeOnly) {
      query = query.where('active', '=', true);
    }
    return query.orderBy('sort_order').orderBy('name').execute();
  }

  private parseRoom(body: RequestBody) {
    const errors: FieldError[] = [];
    const capacity = body?.capacity;
    if (
      capacity !== undefined &&
      capacity !== null &&
      capacity !== '' &&
      (typeof capacity !== 'number' || !Number.isInteger(capacity) || capacity < 1 || capacity > 10000)
    ) {
      errors.push({ field: 'capacity', message: 'Sức chứa là số nguyên từ 1 đến 10000' });
    }
    const sortOrder = body?.sort_order ?? 0;
    if (typeof sortOrder !== 'number' || !Number.isInteger(sortOrder)) {
      errors.push({ field: 'sort_order', message: 'STT hiển thị là số nguyên' });
    }
    const room = {
      name: readWorkText(body, 'name', errors, { required: true, maximum: 200 }) ?? '',
      location: readWorkText(body, 'location', errors, { maximum: 200 }),
      capacity: typeof capacity === 'number' ? capacity : null,
      equipment: readWorkText(body, 'equipment', errors, { maximum: 1000 }),
      sort_order: typeof sortOrder === 'number' ? sortOrder : 0,
      active: body?.active === undefined ? true : body.active === true,
    };
    throwIfAny(errors);
    return room;
  }

  async saveRoom(id: string | null, body: RequestBody) {
    const room = this.parseRoom(body);
    try {
      if (id) {
        const updated = await this.system
          .updateTable('meeting_rooms')
          .set({ ...room, updated_at: this.clock.now() })
          .where('id', '=', id)
          .returningAll()
          .executeTakeFirst();
        if (!updated) {
          throw notFoundError('Không tìm thấy phòng họp', 'meeting_room');
        }
        return updated;
      }
      return await this.system.insertInto('meeting_rooms').values(room).returningAll().executeTakeFirstOrThrow();
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ApplicationError('ERR_CONFLICT', 'Tên phòng họp đã có', [{ field: 'name', message: 'Tên đã có' }]);
      }
      throw error;
    }
  }

  async deleteRoom(id: string) {
    const used = await this.system
      .selectFrom('room_bookings')
      .select('id')
      .where('room_id', '=', id)
      .executeTakeFirst();
    if (used) {
      throw ruleViolationError(DIRECTIVE_RULE_CODE, 'Phòng họp đã có lượt đăng ký, chỉ ngừng sử dụng được');
    }
    const deleted = await this.system.deleteFrom('meeting_rooms').where('id', '=', id).executeTakeFirst();
    if (Number(deleted.numDeletedRows) === 0) {
      throw notFoundError('Không tìm thấy phòng họp', 'meeting_room');
    }
  }

  // ---- Đăng ký phòng họp ----

  async listBookings(
    currentUser: CurrentUser,
    filter: { from: string | null; to: string | null; roomId: string | null; status: RoomBookingStatus | null; mine: boolean },
  ) {
    let query = this.system
      .selectFrom('room_bookings')
      .innerJoin('meeting_rooms', 'meeting_rooms.id', 'room_bookings.room_id')
      .selectAll('room_bookings')
      .select(['meeting_rooms.name as room_name', 'meeting_rooms.location as room_location']);
    if (filter.from) {
      query = query.where('room_bookings.ends_at', '>', vietnamTime(filter.from, '00:00'));
    }
    if (filter.to) {
      query = query.where('room_bookings.starts_at', '<', vietnamTime(shiftDate(filter.to, 1), '00:00'));
    }
    if (filter.roomId) {
      query = query.where('room_bookings.room_id', '=', filter.roomId);
    }
    if (filter.status) {
      query = query.where('room_bookings.status', '=', filter.status);
    }
    if (filter.mine) {
      query = query.where('room_bookings.requested_by', '=', currentUser.id);
    }
    const rows = await query.orderBy('room_bookings.starts_at').limit(1000).execute();
    const canDecide = hasPermission(currentUser, ROOMS);
    return rows.map((row) => ({
      ...row,
      status_label: ROOM_BOOKING_STATUS_LABELS[row.status],
      can_decide: canDecide && row.status === 'pending',
      can_cancel:
        (row.requested_by === currentUser.id || canDecide) && (row.status === 'pending' || row.status === 'approved'),
    }));
  }

  // Lượt chờ duyệt hoặc đã duyệt khác của cùng phòng chồng giờ; khóa theo phòng để hai yêu cầu cùng lúc không cùng lọt
  private async assertFree(
    executor: Executor,
    roomId: string,
    startsAt: Date,
    endsAt: Date,
    exceptId: string | null,
    statuses: RoomBookingStatus[],
  ) {
    await sql`select pg_advisory_xact_lock(hashtext(${`room-bookings:${roomId}`}))`.execute(executor);
    let query = executor
      .selectFrom('room_bookings')
      .select(['title', 'starts_at', 'ends_at', 'status'])
      .where('room_id', '=', roomId)
      .where('status', 'in', statuses)
      .where('starts_at', '<', endsAt)
      .where('ends_at', '>', startsAt);
    if (exceptId) {
      query = query.where('id', '!=', exceptId);
    }
    const clash = await query.executeTakeFirst();
    if (clash) {
      const format = (date: Date) =>
        new Intl.DateTimeFormat('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit',
        }).format(date);
      throw ruleViolationError(
        DIRECTIVE_RULE_CODE,
        `Phòng họp đã có lịch "${clash.title.slice(0, 100)}" (${ROOM_BOOKING_STATUS_LABELS[clash.status].toLowerCase()}) từ ${format(clash.starts_at)} đến ${format(clash.ends_at)}`,
        [{ field: 'start_time', message: 'Trùng giờ với lượt đăng ký khác' }],
      );
    }
  }

  private async findRoom(executor: Executor, roomId: string) {
    const room = await executor
      .selectFrom('meeting_rooms')
      .select(['id', 'name', 'location', 'active'])
      .where('id', '=', roomId)
      .executeTakeFirst();
    if (!room || !room.active) {
      throw validationError([{ field: 'room_id', message: 'Không tìm thấy phòng họp đang sử dụng' }]);
    }
    return room;
  }

  private async insertBooking(executor: Executor, currentUser: CurrentUser, input: BookingInput) {
    await this.findRoom(executor, input.room_id);
    const startsAt = vietnamTime(input.date, input.start_time);
    const endsAt = vietnamTime(input.date, input.end_time);
    await this.assertFree(executor, input.room_id, startsAt, endsAt, null, ['pending', 'approved']);
    const autoApprove = hasPermission(currentUser, ROOMS);
    const now = this.clock.now();
    return executor
      .insertInto('room_bookings')
      .values({
        room_id: input.room_id,
        title: input.title,
        chair_name: input.chair_name,
        participants: input.participants,
        starts_at: startsAt,
        ends_at: endsAt,
        note: input.note,
        status: autoApprove ? 'approved' : 'pending',
        requested_by: currentUser.id,
        requested_by_name: currentUser.description.full_name,
        decided_by: autoApprove ? currentUser.id : null,
        decided_by_name: autoApprove ? currentUser.description.full_name : null,
        decided_at: autoApprove ? now : null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async createBooking(currentUser: CurrentUser, body: RequestBody) {
    const input = parseBooking(body);
    return this.system.transaction().execute((transaction) => this.insertBooking(transaction, currentUser, input));
  }

  async decideBooking(currentUser: CurrentUser, id: string, approve: boolean, note: string | null) {
    const booking = await this.system.transaction().execute(async (transaction) => {
      const row = await transaction
        .selectFrom('room_bookings')
        .selectAll()
        .where('id', '=', id)
        .forUpdate()
        .executeTakeFirst();
      if (!row) {
        throw notFoundError('Không tìm thấy lượt đăng ký phòng họp', 'room_booking');
      }
      if (row.status !== 'pending') {
        throw ruleViolationError(DIRECTIVE_RULE_CODE, 'Lượt đăng ký không ở trạng thái chờ phê duyệt');
      }
      if (approve) {
        await this.assertFree(transaction, row.room_id, row.starts_at, row.ends_at, row.id, ['approved']);
      } else if (!note) {
        throw validationError([{ field: 'note', message: 'Nhập lý do từ chối' }]);
      }
      return transaction
        .updateTable('room_bookings')
        .set({
          status: approve ? 'approved' : 'rejected',
          decided_by: currentUser.id,
          decided_by_name: currentUser.description.full_name,
          decided_at: this.clock.now(),
          decision_note: note,
          updated_at: this.clock.now(),
        })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
    });
    await this.notifyUsers(
      [booking.requested_by],
      approve ? 'Đăng ký phòng họp được phê duyệt' : 'Đăng ký phòng họp bị từ chối',
      `${booking.title}${note ? `. ${note}` : ''}`,
      'room_booking',
      booking.id,
    );
    return booking;
  }

  async cancelBooking(currentUser: CurrentUser, id: string) {
    const row = await this.system.selectFrom('room_bookings').selectAll().where('id', '=', id).executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy lượt đăng ký phòng họp', 'room_booking');
    }
    if (row.requested_by !== currentUser.id && !hasPermission(currentUser, ROOMS)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người đăng ký hoặc người duyệt phòng họp hủy được');
    }
    if (row.status !== 'pending' && row.status !== 'approved') {
      throw ruleViolationError(DIRECTIVE_RULE_CODE, 'Lượt đăng ký đã bị từ chối hoặc đã hủy');
    }
    return this.system
      .updateTable('room_bookings')
      .set({ status: 'cancelled', updated_at: this.clock.now() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  // ---- Lịch đơn vị ----

  async listEntries(currentUser: CurrentUser, filter: ScheduleFilter) {
    if (shiftDate(filter.from, MAXIMUM_RANGE_DAYS) < filter.to) {
      throw validationError([{ field: 'to', message: `Xem tối đa ${MAXIMUM_RANGE_DAYS} ngày một lần` }]);
    }
    let query = this.system
      .selectFrom('unit_schedule_entries')
      .leftJoin('room_bookings', 'room_bookings.id', 'unit_schedule_entries.room_booking_id')
      .leftJoin('meeting_rooms', 'meeting_rooms.id', 'room_bookings.room_id')
      .selectAll('unit_schedule_entries')
      .select([
        'room_bookings.room_id',
        'room_bookings.status as room_status',
        'meeting_rooms.name as room_name',
      ])
      .where('unit_schedule_entries.entry_date', '>=', filter.from)
      .where('unit_schedule_entries.entry_date', '<=', filter.to);
    // Bản nháp chỉ người đăng ký lịch của đơn vị đó thấy
    const scope = currentUser.organizationScope(MANAGE);
    if (!scope.wholeSchool) {
      query = query.where((expression) =>
        expression.or([
          expression('unit_schedule_entries.status', '=', 'published'),
          ...(scope.orgUnitIds.length > 0
            ? [expression('unit_schedule_entries.org_unit_id', 'in', scope.orgUnitIds)]
            : []),
        ]),
      );
    }
    if (filter.orgUnitId) {
      query = query.where('unit_schedule_entries.org_unit_id', '=', filter.orgUnitId);
    }
    if (filter.location) {
      query = query.where((expression) =>
        expression.or([
          expression('unit_schedule_entries.location', 'ilike', `%${escapeLike(filter.location as string)}%`),
          expression('meeting_rooms.name', 'ilike', `%${escapeLike(filter.location as string)}%`),
        ]),
      );
    }
    if (filter.participant) {
      query = query.where('unit_schedule_entries.participants', 'ilike', `%${escapeLike(filter.participant)}%`);
    }
    if (filter.mine) {
      query = query.where((expression) =>
        expression.or([
          expression('unit_schedule_entries.created_by', '=', currentUser.id),
          expression.exists(
            expression
              .selectFrom('unit_schedule_attendees')
              .select('unit_schedule_attendees.entry_id')
              .whereRef('unit_schedule_attendees.entry_id', '=', 'unit_schedule_entries.id')
              .where('unit_schedule_attendees.user_id', '=', currentUser.id),
          ),
        ]),
      );
    }
    const rows = await query
      .orderBy('unit_schedule_entries.entry_date')
      .orderBy('unit_schedule_entries.session')
      .orderBy('unit_schedule_entries.start_time')
      .limit(2000)
      .execute();
    const ids = rows.map((row) => row.id);
    const attendees = ids.length
      ? await this.system
          .selectFrom('unit_schedule_attendees')
          .selectAll()
          .where('entry_id', 'in', ids)
          .orderBy('user_name')
          .execute()
      : [];
    const unitNames = await this.unitNames(rows.map((row) => row.org_unit_id));
    return rows.map((row) => ({
      ...row,
      org_unit_name: row.org_unit_id ? (unitNames.get(row.org_unit_id) ?? '') : 'Toàn trường',
      attendees: attendees
        .filter((attendee) => attendee.entry_id === row.id)
        .map((attendee) => ({ user_id: attendee.user_id, user_name: attendee.user_name })),
      can_edit: this.canManageUnit(currentUser, row.org_unit_id),
    }));
  }

  private async unitNames(ids: Array<string | null>): Promise<Map<string, string>> {
    const wanted = [...new Set(ids.filter((id): id is string => id !== null))];
    const current = await this.currentSchoolYear.find();
    if (!current || wanted.length === 0) {
      return new Map();
    }
    const rows = await (current.database as Kysely<SchoolYearDatabase>)
      .selectFrom('org_units')
      .select(['id', 'name'])
      .where('id', 'in', wanted)
      .execute();
    return new Map(rows.map((row) => [row.id, row.name]));
  }

  private async findEntry(executor: Executor, id: string) {
    const entry = await executor
      .selectFrom('unit_schedule_entries')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!entry) {
      throw notFoundError('Không tìm thấy dòng lịch', 'unit_schedule_entry');
    }
    return entry;
  }

  async saveEntry(currentUser: CurrentUser, id: string | null, body: RequestBody) {
    const input = parseEntry(body);
    this.assertManageUnit(currentUser, input.org_unit_id);
    const accounts = await this.admin.resolveAccounts(input.attendee_ids, 'attendee_ids');
    const savedId = await this.system.transaction().execute(async (transaction) => {
      let bookingId: string | null = null;
      let previousBookingId: string | null = null;
      if (id) {
        const existing = await this.findEntry(transaction, id);
        this.assertManageUnit(currentUser, existing.org_unit_id);
        previousBookingId = existing.room_booking_id;
      }
      let location = input.location;
      if (input.room_id) {
        // Đổi phòng hoặc giờ thì hủy lượt cũ, đăng ký lượt mới
        const previous = previousBookingId
          ? await transaction
              .selectFrom('room_bookings')
              .selectAll()
              .where('id', '=', previousBookingId)
              .executeTakeFirst()
          : undefined;
        const startsAt = vietnamTime(input.entry_date, input.start_time as string);
        const endsAt = vietnamTime(input.entry_date, input.end_time as string);
        const same =
          previous &&
          previous.room_id === input.room_id &&
          previous.starts_at.getTime() === startsAt.getTime() &&
          previous.ends_at.getTime() === endsAt.getTime() &&
          (previous.status === 'pending' || previous.status === 'approved');
        if (same) {
          bookingId = previous.id;
          await transaction
            .updateTable('room_bookings')
            .set({ title: input.content.slice(0, 500), chair_name: input.chair_name, participants: input.participants })
            .where('id', '=', previous.id)
            .execute();
        } else {
          if (previous) {
            await transaction
              .updateTable('room_bookings')
              .set({ status: 'cancelled', updated_at: this.clock.now() })
              .where('id', '=', previous.id)
              .where('status', 'in', ['pending', 'approved'])
              .execute();
          }
          const booking = await this.insertBooking(transaction, currentUser, {
            room_id: input.room_id,
            title: input.content.slice(0, 500),
            chair_name: input.chair_name,
            participants: input.participants,
            date: input.entry_date,
            start_time: input.start_time as string,
            end_time: input.end_time as string,
            note: input.note,
          });
          bookingId = booking.id;
        }
        const room = await this.findRoom(transaction, input.room_id);
        location = location ?? [room.name, room.location].filter(Boolean).join(', ');
      } else if (previousBookingId) {
        await transaction
          .updateTable('room_bookings')
          .set({ status: 'cancelled', updated_at: this.clock.now() })
          .where('id', '=', previousBookingId)
          .where('status', 'in', ['pending', 'approved'])
          .execute();
      }
      const values = {
        org_unit_id: input.org_unit_id,
        entry_date: input.entry_date,
        session: input.session,
        start_time: input.start_time,
        end_time: input.end_time,
        content: input.content,
        chair_name: input.chair_name,
        participants: input.participants,
        location,
        note: input.note,
        room_booking_id: bookingId,
      };
      let entryId = id;
      if (id) {
        await transaction
          .updateTable('unit_schedule_entries')
          .set({ ...values, updated_at: this.clock.now() })
          .where('id', '=', id)
          .execute();
        await transaction.deleteFrom('unit_schedule_attendees').where('entry_id', '=', id).execute();
      } else {
        const created = await transaction
          .insertInto('unit_schedule_entries')
          .values({ ...values, created_by: currentUser.id, created_by_name: currentUser.description.full_name })
          .returning('id')
          .executeTakeFirstOrThrow();
        entryId = created.id;
      }
      if (input.attendee_ids.length > 0) {
        await transaction
          .insertInto('unit_schedule_attendees')
          .values(
            input.attendee_ids.map((userId) => ({
              entry_id: entryId as string,
              user_id: userId,
              user_name: accounts.get(userId)?.full_name ?? '',
            })),
          )
          .execute();
      }
      return entryId as string;
    });
    return (await this.entriesByIds(currentUser, [savedId]))[0];
  }

  private async entriesByIds(currentUser: CurrentUser, ids: string[]) {
    const dates = await this.system
      .selectFrom('unit_schedule_entries')
      .select(['id', 'entry_date'])
      .where('id', 'in', ids)
      .execute();
    if (dates.length === 0) {
      return [];
    }
    const sorted = dates.map((row) => row.entry_date).sort();
    const rows = await this.listEntries(currentUser, {
      from: sorted[0] as string,
      to: sorted.at(-1) as string,
      orgUnitId: null,
      mine: false,
      location: null,
      participant: null,
    });
    return rows.filter((row) => ids.includes(row.id));
  }

  async deleteEntry(currentUser: CurrentUser, id: string) {
    await this.system.transaction().execute(async (transaction) => {
      const entry = await this.findEntry(transaction, id);
      this.assertManageUnit(currentUser, entry.org_unit_id);
      if (entry.room_booking_id) {
        await transaction
          .updateTable('room_bookings')
          .set({ status: 'cancelled', updated_at: this.clock.now() })
          .where('id', '=', entry.room_booking_id)
          .where('status', 'in', ['pending', 'approved'])
          .execute();
      }
      await transaction.deleteFrom('unit_schedule_entries').where('id', '=', id).execute();
    });
  }

  // Công bố các dòng nháp của đơn vị trong khoảng ngày; người tham dự nhận thông báo
  async publish(currentUser: CurrentUser, input: { from: string; to: string; orgUnitId: string | null }) {
    this.assertManageUnit(currentUser, input.orgUnitId);
    let query = this.system
      .updateTable('unit_schedule_entries')
      .set({ status: 'published', published_at: this.clock.now(), updated_at: this.clock.now() })
      .where('status', '=', 'draft')
      .where('entry_date', '>=', input.from)
      .where('entry_date', '<=', input.to);
    query = input.orgUnitId
      ? query.where('org_unit_id', '=', input.orgUnitId)
      : query.where('org_unit_id', 'is', null);
    const published = await query.returning(['id', 'content', 'entry_date']).execute();
    if (published.length > 0) {
      const attendees = await this.system
        .selectFrom('unit_schedule_attendees')
        .select('user_id')
        .distinct()
        .where(
          'entry_id',
          'in',
          published.map((row) => row.id),
        )
        .execute();
      await this.notifyUsers(
        attendees.map((row) => row.user_id),
        'Lịch đơn vị mới công bố',
        `Lịch từ ${formatDate(input.from)} đến ${formatDate(input.to)} có ${published.length} nội dung`,
        'unit_schedule',
        published[0]?.id as string,
      );
    }
    return { published: published.length };
  }

  private async notifyUsers(userIds: string[], title: string, body: string, targetType: string, targetId: string) {
    const recipients = [...new Set(userIds)];
    const current = await this.currentSchoolYear.find();
    if (!current || recipients.length === 0) {
      return;
    }
    await queueNotification(current.database as Kysely<SchoolYearDatabase>, {
      orgUnitId: null,
      templateCode: targetType,
      title,
      body: body.slice(0, 1000),
      targetType,
      targetId,
      recipients: recipients.map((userId) => ({ userId, channel: 'in_app' })),
    });
  }

  // Xuất lịch họp ra Excel hoặc PDF theo bộ lọc đang xem; ghi nhật ký xuất ở năm học đang dùng
  async exportEntries(
    currentUser: CurrentUser,
    filter: ScheduleFilter,
    format: TableFileFormat,
    ipAddress: string | null,
  ) {
    const rows = await this.listEntries(currentUser, filter);
    const { database } = await this.currentSchoolYear.require();
    const now = this.clock.now();
    return buildFacilitiesWorkbook({
      database: database as Kysely<SchoolYearDatabase>,
      currentUser,
      reportCode: 'unit_schedule',
      fileName: `lich-hop-${filter.from}-${filter.to}-${fileStamp(now)}`,
      filters: filter as unknown as Record<string, unknown>,
      orgUnitIds: filter.orgUnitId ? [filter.orgUnitId] : [],
      ipAddress,
      createdAt: now,
      format,
      sheets: [
        {
          title: 'Lịch họp',
          heading: [
            `LỊCH CÔNG TÁC TỪ NGÀY ${formatDate(filter.from)} ĐẾN NGÀY ${formatDate(filter.to)}`,
            ...(filter.mine ? ['Lịch của tôi'] : []),
          ],
          columns: [
            { key: 'day', label: 'Thứ, ngày', width: 18 },
            { key: 'session', label: 'Buổi', width: 8 },
            { key: 'time', label: 'Giờ', width: 12 },
            { key: 'content', label: 'Nội dung', width: 50 },
            { key: 'chair_name', label: 'Chủ trì', width: 20 },
            { key: 'participants', label: 'Thành phần', width: 30 },
            { key: 'location', label: 'Địa điểm', width: 20 },
            { key: 'note', label: 'Ghi chú', width: 20 },
          ],
          rows: rows.map((row) => ({
            day: `${WEEKDAY_LABELS[(new Date(`${row.entry_date}T00:00:00Z`).getUTCDay() + 6) % 7]}, ${formatDate(row.entry_date)}`,
            session: SCHEDULE_SESSION_LABELS[row.session],
            time: [row.start_time, row.end_time].filter(Boolean).join(' – '),
            content: row.content,
            chair_name: row.chair_name,
            participants: row.participants,
            location: row.location ?? row.room_name,
            note: row.note,
          })),
        },
      ],
    });
  }

  // ---- Mẫu lịch ----

  listTemplates() {
    return this.system.selectFrom('unit_schedule_templates').selectAll().orderBy('name').execute();
  }

  async saveTemplate(currentUser: CurrentUser, id: string | null, body: RequestBody) {
    const errors: FieldError[] = [];
    const name = readWorkText(body, 'name', errors, { required: true, maximum: 200 }) ?? '';
    const orgUnitId = readId(body, 'org_unit_id', errors);
    throwIfAny(errors);
    const items = parseTemplateItems(body?.items ?? []);
    this.assertManageUnit(currentUser, orgUnitId);
    try {
      if (id) {
        const updated = await this.system
          .updateTable('unit_schedule_templates')
          .set({ name, org_unit_id: orgUnitId, items: JSON.stringify(items), updated_at: this.clock.now() })
          .where('id', '=', id)
          .returningAll()
          .executeTakeFirst();
        if (!updated) {
          throw notFoundError('Không tìm thấy mẫu lịch', 'unit_schedule_template');
        }
        return updated;
      }
      return await this.system
        .insertInto('unit_schedule_templates')
        .values({
          name,
          org_unit_id: orgUnitId,
          items: JSON.stringify(items),
          created_by: currentUser.id,
          created_by_name: currentUser.description.full_name,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ApplicationError('ERR_CONFLICT', 'Tên mẫu lịch đã có', [{ field: 'name', message: 'Tên đã có' }]);
      }
      throw error;
    }
  }

  async deleteTemplate(id: string) {
    const deleted = await this.system.deleteFrom('unit_schedule_templates').where('id', '=', id).executeTakeFirst();
    if (Number(deleted.numDeletedRows) === 0) {
      throw notFoundError('Không tìm thấy mẫu lịch', 'unit_schedule_template');
    }
  }

  // Áp mẫu vào tuần có ngày đã chọn: mỗi dòng của mẫu thành một dòng nháp của đơn vị
  async applyTemplate(currentUser: CurrentUser, id: string, input: { weekOf: string; orgUnitId: string | null }) {
    this.assertManageUnit(currentUser, input.orgUnitId);
    const template = await this.system
      .selectFrom('unit_schedule_templates')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!template) {
      throw notFoundError('Không tìm thấy mẫu lịch', 'unit_schedule_template');
    }
    if (template.items.length === 0) {
      throw ruleViolationError(DIRECTIVE_RULE_CODE, 'Mẫu lịch chưa có dòng nào');
    }
    const monday = weekStart(input.weekOf);
    await this.system
      .insertInto('unit_schedule_entries')
      .values(
        template.items.map((item) => ({
          org_unit_id: input.orgUnitId,
          entry_date: shiftDate(monday, item.weekday - 1),
          session: item.session,
          start_time: item.start_time,
          end_time: item.end_time,
          content: item.content,
          chair_name: item.chair_name,
          participants: item.participants,
          location: item.location,
          note: item.note,
          created_by: currentUser.id,
          created_by_name: currentUser.description.full_name,
        })),
      )
      .execute();
    return { created: template.items.length, week_start: monday };
  }

  today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }
}

function formatDate(date: string): string {
  return date.split('-').reverse().join('/');
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
