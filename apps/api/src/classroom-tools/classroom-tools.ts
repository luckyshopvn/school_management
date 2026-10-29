import { Body, Controller, Delete, Get, HttpCode, Injectable, Param, Post, Put, Query, Req } from '@nestjs/common';
import { vietnamDate, type SchoolYearDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import { sql, type Kysely } from 'kysely';
import type { Request } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { isUuid, notFoundError, readRequiredUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { ChildScope } from '../children/child-scope.js';
import { ConductService } from '../conduct/conduct.js';
import { GroupSetsService } from '../child-groups/group-sets.js';

// Công cụ lớp học trên ứng dụng giáo viên (DT-23 phần 23b, YCTD-212; tài liệu 47 mục 15.4): gọi tên ngẫu nhiên, chia nhóm,
// bảng điểm nhanh. Máy giáo viên bốc ngẫu nhiên và giữ đồng hồ; máy chủ chỉ cấp danh sách lớp thật, ghi lượt gọi, bản chia
// nhóm, dòng điểm của buổi và chuyển điểm vào nề nếp, thi đua (DT-21) khi giáo viên chọn tiêu chí và xác nhận. Các lượt gọi
// và dòng điểm ghi lúc mất mạng được gửi lại sau, mỗi dòng mang `client_id` do máy sinh nên gửi lại nhiều lần không trùng.
// Quyền: giáo viên được phân công lớp hoặc vai trò đơn vị xem được lớp (cùng phạm vi xem trẻ của điểm danh); xác nhận vào nề
// nếp cần quyền ghi nề nếp
export const CLASSROOM_TOOLS_RULE_CODE = 'YCTD-212';
export const MAX_CALLS_PER_REQUEST = 100;
export const MAX_SCORE_EVENTS_PER_REQUEST = 200;
export const MAX_GROUPS = 50;
export const MAX_SCORE_DELTA = 50;
// Thời điểm bấm trên máy chỉ tin trong khoảng này so với giờ máy chủ; ngoài khoảng thì lấy giờ máy chủ
const MAX_CLIENT_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CLIENT_AHEAD_MS = 5 * 60 * 1000;
const MAX_CONDUCT_QUANTITY = 50;
const DEFAULT_ROSTER_TTL_HOURS = 24;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface CallInput {
  client_id: string;
  child_id: string;
  called_at: string | null;
}

export interface GroupInput {
  name: string;
  child_ids: string[];
}

export type ScoreTarget = { kind: 'group'; key: string } | { kind: 'student'; key: string };

export interface ScoreEventInput {
  client_id: string;
  target_kind: 'group' | 'student';
  group_name: string | null;
  child_id: string | null;
  delta: number;
  note: string | null;
  occurred_at: string | null;
}

function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function readClientTime(value: unknown, field: string, errors: FieldError[]): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    errors.push({ field, message: 'Thời điểm dạng ISO 8601' });
    return null;
  }
  return value;
}

// Thời điểm của dòng ghi lúc ngoại tuyến: tin giờ máy trong khoảng hợp lý, ngoài khoảng thì lấy giờ máy chủ
export function clampClientTime(value: string | null, now: Date): Date {
  if (value === null) {
    return now;
  }
  const time = Date.parse(value);
  if (time > now.getTime() + MAX_CLIENT_AHEAD_MS || time < now.getTime() - MAX_CLIENT_AGE_MS) {
    return now;
  }
  return new Date(time);
}

export function parseCallsInput(body: RequestBody): { classId: string; calls: CallInput[] } {
  const errors: FieldError[] = [];
  const classId = readRequiredUuid(body, 'class_id', errors, 'Bắt buộc chọn lớp');
  const raw = asArray(body?.calls);
  const calls: CallInput[] = [];
  if (!raw || raw.length === 0 || raw.length > MAX_CALLS_PER_REQUEST) {
    errors.push({ field: 'calls', message: `Cần từ 1 đến ${MAX_CALLS_PER_REQUEST} lượt gọi` });
  } else {
    raw.forEach((item, index) => {
      const entry = (item ?? {}) as Record<string, unknown>;
      if (!isUuid(entry.client_id) || !isUuid(entry.child_id)) {
        errors.push({ field: `calls[${index}]`, message: 'Cần client_id và child_id hợp lệ' });
        return;
      }
      calls.push({
        client_id: entry.client_id,
        child_id: entry.child_id,
        called_at: readClientTime(entry.called_at, `calls[${index}].called_at`, errors),
      });
    });
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return { classId, calls };
}

export function parseGroupsInput(body: RequestBody): GroupInput[] {
  const errors: FieldError[] = [];
  const raw = asArray(body?.groups);
  const groups: GroupInput[] = [];
  if (!raw || raw.length === 0 || raw.length > MAX_GROUPS) {
    errors.push({ field: 'groups', message: `Cần từ 1 đến ${MAX_GROUPS} nhóm` });
  } else {
    const names = new Set<string>();
    const members = new Set<string>();
    raw.forEach((item, index) => {
      const entry = (item ?? {}) as Record<string, unknown>;
      const name = typeof entry.name === 'string' ? entry.name.trim() : '';
      const childIds = asArray(entry.child_ids);
      if (name === '' || name.length > 60) {
        errors.push({ field: `groups[${index}].name`, message: 'Tên nhóm từ 1 đến 60 ký tự' });
      } else if (names.has(name)) {
        errors.push({ field: `groups[${index}].name`, message: 'Tên nhóm không trùng nhau' });
      }
      names.add(name);
      if (!childIds || !childIds.every(isUuid)) {
        errors.push({ field: `groups[${index}].child_ids`, message: 'Danh sách học sinh không hợp lệ' });
        return;
      }
      for (const childId of childIds as string[]) {
        if (members.has(childId)) {
          errors.push({ field: `groups[${index}].child_ids`, message: 'Một học sinh chỉ thuộc một nhóm' });
        }
        members.add(childId);
      }
      groups.push({ name, child_ids: childIds as string[] });
    });
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return groups;
}

export function parseScoreEventsInput(body: RequestBody): {
  classId: string;
  sessionKey: string;
  events: ScoreEventInput[];
} {
  const errors: FieldError[] = [];
  const classId = readRequiredUuid(body, 'class_id', errors, 'Bắt buộc chọn lớp');
  const sessionKey = readRequiredUuid(body, 'session_key', errors, 'Bắt buộc có mã buổi');
  const raw = asArray(body?.events);
  const events: ScoreEventInput[] = [];
  if (!raw || raw.length === 0 || raw.length > MAX_SCORE_EVENTS_PER_REQUEST) {
    errors.push({ field: 'events', message: `Cần từ 1 đến ${MAX_SCORE_EVENTS_PER_REQUEST} dòng điểm` });
  } else {
    raw.forEach((item, index) => {
      const entry = (item ?? {}) as Record<string, unknown>;
      const field = `events[${index}]`;
      const kind = entry.target_kind;
      const delta = entry.delta;
      const groupName = typeof entry.group_name === 'string' ? entry.group_name.trim() : '';
      const note = typeof entry.note === 'string' ? entry.note.trim() : '';
      if (!isUuid(entry.client_id)) {
        errors.push({ field: `${field}.client_id`, message: 'client_id không hợp lệ' });
        return;
      }
      if (kind !== 'group' && kind !== 'student') {
        errors.push({ field: `${field}.target_kind`, message: 'Đối tượng là group hoặc student' });
        return;
      }
      if (kind === 'group' && (groupName === '' || groupName.length > 60)) {
        errors.push({ field: `${field}.group_name`, message: 'Tên nhóm từ 1 đến 60 ký tự' });
        return;
      }
      if (kind === 'student' && !isUuid(entry.child_id)) {
        errors.push({ field: `${field}.child_id`, message: 'Mã học sinh không hợp lệ' });
        return;
      }
      if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta as number) > MAX_SCORE_DELTA) {
        errors.push({
          field: `${field}.delta`,
          message: `Điểm cộng, trừ là số nguyên khác 0, tối đa ${MAX_SCORE_DELTA}`,
        });
        return;
      }
      if (note.length > 200) {
        errors.push({ field: `${field}.note`, message: 'Ghi chú tối đa 200 ký tự' });
        return;
      }
      events.push({
        client_id: entry.client_id,
        target_kind: kind,
        group_name: kind === 'group' ? groupName : null,
        child_id: kind === 'student' ? (entry.child_id as string) : null,
        delta: delta as number,
        note: note === '' ? null : note,
        occurred_at: readClientTime(entry.occurred_at, `${field}.occurred_at`, errors),
      });
    });
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return { classId, sessionKey, events };
}

export interface ScoreRow {
  target_kind: 'group' | 'student';
  group_name: string | null;
  child_id: string | null;
  delta: number;
  confirmed: boolean;
}

export interface ScoreTotal {
  target_kind: 'group' | 'student';
  key: string;
  total: number;
  pending: number;
}

// Tổng điểm theo đối tượng: `total` là mọi dòng, `pending` là phần chưa chuyển vào nề nếp
export function tallyScores(rows: ScoreRow[]): ScoreTotal[] {
  const totals = new Map<string, ScoreTotal>();
  for (const row of rows) {
    const key = row.target_kind === 'group' ? (row.group_name ?? '') : (row.child_id ?? '');
    const id = `${row.target_kind}:${key}`;
    const current = totals.get(id) ?? { target_kind: row.target_kind, key, total: 0, pending: 0 };
    current.total += row.delta;
    if (!row.confirmed) {
      current.pending += row.delta;
    }
    totals.set(id, current);
  }
  return [...totals.values()];
}

// Chia số lượng nề nếp lớn hơn mức một dòng cho phép thành nhiều dòng
export function splitConductQuantity(quantity: number): number[] {
  const parts: number[] = [];
  let rest = quantity;
  while (rest > 0) {
    parts.push(Math.min(rest, MAX_CONDUCT_QUANTITY));
    rest -= MAX_CONDUCT_QUANTITY;
  }
  return parts;
}

@Injectable()
export class ClassroomToolsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly childScope: ChildScope,
    private readonly conduct: ConductService,
    private readonly groupSets: GroupSetsService,
    private readonly clock: Clock,
  ) {}

  // Cấu hình theo trường của công cụ lớp học: công tắc ngoại tuyến, hạn lưu danh sách lớp (GD-108), nề nếp có bật không, công cụ
  // trường tắt ở Hộp công cụ giảng dạy (DT-29, YCTD-325)
  async config() {
    const current = await this.currentSchoolYear.find();
    let offlineEnabled = true;
    let ttlHours = DEFAULT_ROSTER_TTL_HOURS;
    let disabledTools: string[] = [];
    if (current) {
      const rows = await current.database
        .selectFrom('settings')
        .innerJoin('org_units', 'org_units.id', 'settings.org_unit_id')
        .select(['settings.key', 'settings.value'])
        .where('org_units.unit_type', '=', 'truong_chinh')
        .where('settings.key', 'in', [
          'classroom_offline_enabled',
          'classroom_roster_ttl_hours',
          'teaching_tools_disabled',
        ])
        .execute();
      for (const row of rows) {
        if (row.key === 'classroom_offline_enabled' && typeof row.value === 'boolean') {
          offlineEnabled = row.value;
        }
        if (row.key === 'classroom_roster_ttl_hours' && Number.isInteger(row.value)) {
          ttlHours = row.value as number;
        }
        if (row.key === 'teaching_tools_disabled' && Array.isArray(row.value)) {
          disabledTools = row.value.filter((code): code is string => typeof code === 'string');
        }
      }
    }
    const conduct = await this.conduct.settings();
    return {
      offline_enabled: offlineEnabled,
      roster_ttl_hours: ttlHours,
      conduct_enabled: conduct.enabled,
      disabled_tools: disabledTools,
    };
  }

  // Danh sách lớp gọn: số thứ tự, họ tên, mã học sinh; không điểm, nhận xét, thông tin phụ huynh. Học sinh vắng hôm nay
  // (điểm danh hoặc phụ huynh báo vắng) đánh dấu để công cụ loại khi gọi tên
  async roster(currentUser: CurrentUser, classId: string) {
    const { database } = await this.currentSchoolYear.require();
    const classRecord = await this.assertCanUse(currentUser, database, classId);
    const today = vietnamDate(this.clock.now());
    const rows = await database
      .selectFrom('class_enrollments')
      .innerJoin('children', 'children.id', 'class_enrollments.child_id')
      .select(['children.id', 'children.full_name', 'children.moet_student_code', 'class_enrollments.order_number'])
      .where('class_enrollments.class_id', '=', classId)
      .where('class_enrollments.is_current', '=', true)
      .where('children.status', '=', 'active')
      .where('children.deleted_at', 'is', null)
      .orderBy(sql`class_enrollments.order_number nulls last`)
      .orderBy('children.full_name')
      .execute();
    const absentToday = new Set<string>();
    if (rows.length > 0) {
      const ids = rows.map((row) => row.id);
      const attendance = await database
        .selectFrom('attendance_records')
        .select('child_id')
        .where('child_id', 'in', ids)
        .where('attendance_date', '=', today)
        .where('status', 'in', ['absent_notified', 'absent_unnotified'])
        .execute();
      const advised = await database
        .selectFrom('absence_records')
        .select('child_id')
        .where('child_id', 'in', ids)
        .where('absence_date', '=', today)
        .execute();
      for (const row of [...attendance, ...advised]) {
        absentToday.add(row.child_id);
      }
    }
    return {
      class_id: classRecord.id,
      class_name: classRecord.name,
      generated_at: this.clock.now().toISOString(),
      students: rows.map((row, index) => ({
        id: row.id,
        order_no: row.order_number ?? index + 1,
        full_name: row.full_name,
        code: row.moet_student_code,
        absent_today: absentToday.has(row.id),
      })),
    };
  }

  async recordCalls(currentUser: CurrentUser, input: { classId: string; calls: CallInput[] }) {
    const { database } = await this.currentSchoolYear.require();
    await this.assertCanUse(currentUser, database, input.classId);
    await this.assertEnrolled(
      database,
      input.classId,
      input.calls.map((call) => call.child_id),
    );
    const now = this.clock.now();
    const inserted = await database
      .insertInto('classroom_call_logs')
      .values(
        input.calls.map((call) => ({
          client_id: call.client_id,
          class_id: input.classId,
          child_id: call.child_id,
          called_by: currentUser.id,
          called_by_name: currentUser.description.full_name,
          called_at: clampClientTime(call.called_at, now),
        })),
      )
      .onConflict((conflict) => conflict.column('client_id').doNothing())
      .returning('id')
      .execute();
    return { saved: inserted.length, duplicates: input.calls.length - inserted.length };
  }

  async calls(currentUser: CurrentUser, classId: string) {
    const { database } = await this.currentSchoolYear.require();
    await this.assertCanUse(currentUser, database, classId);
    return database
      .selectFrom('classroom_call_logs')
      .innerJoin('children', 'children.id', 'classroom_call_logs.child_id')
      .select([
        'classroom_call_logs.id',
        'classroom_call_logs.child_id',
        'children.full_name',
        'classroom_call_logs.called_by_name',
        'classroom_call_logs.called_at',
      ])
      .where('classroom_call_logs.class_id', '=', classId)
      .orderBy('classroom_call_logs.called_at', 'desc')
      .limit(100)
      .execute();
  }

  // Giáo viên xóa lượt gọi của mình; một lượt hoặc cả lịch sử của lớp
  async removeCalls(currentUser: CurrentUser, classId: string, callId: string | null) {
    const { database } = await this.currentSchoolYear.require();
    await this.assertCanUse(currentUser, database, classId);
    const removed = await database
      .deleteFrom('classroom_call_logs')
      .where('class_id', '=', classId)
      .where('called_by', '=', currentUser.id)
      .$if(callId !== null, (query) => query.where('id', '=', callId ?? ''))
      .returning('id')
      .execute();
    if (callId !== null && removed.length === 0) {
      throw notFoundError('Không tìm thấy lượt gọi của bạn', 'classroom_call');
    }
    return { deleted: removed.length };
  }

  // Bản chia nhóm đang dùng là bộ nhóm `classroom` mới nhất của giáo viên cho lớp (DT-28 phần 28a, YCTD-271)
  async grouping(currentUser: CurrentUser, classId: string) {
    const { database } = await this.currentSchoolYear.require();
    await this.assertCanUse(currentUser, database, classId);
    const current = await this.groupSets.classroomGrouping(database, classId, currentUser.id);
    return current ? { groups: current.groups, updated_at: current.updated_at } : { groups: [], updated_at: null };
  }

  // Lưu bản chia thành bộ nhóm `classroom` (chọn bộ sẵn có thì ghi kèm mã bộ nguồn). Bảng `classroom_groupings` của 23b còn
  // được ghi song song một bản phát hành để bản ứng dụng cũ đọc được; máy chủ không đọc bảng đó nữa
  async saveGrouping(
    currentUser: CurrentUser,
    classId: string,
    groups: GroupInput[],
    origin: ChangeOrigin,
    sourceGroupSetId: string | null = null,
  ) {
    const { database } = await this.currentSchoolYear.require();
    await this.assertCanUse(currentUser, database, classId);
    await this.assertEnrolled(
      database,
      classId,
      groups.flatMap((group) => group.child_ids),
    );
    const serialized = JSON.stringify(groups);
    const now = this.clock.now();
    await database
      .insertInto('classroom_groupings')
      .values({ class_id: classId, owner_user_id: currentUser.id, groups: serialized })
      .onConflict((conflict) =>
        conflict
          .constraint('classroom_groupings_class_owner_unique')
          .doUpdateSet({ groups: serialized, updated_at: now }),
      )
      .execute();
    await this.groupSets.saveClassroomGrouping(currentUser, classId, groups, origin, sourceGroupSetId);
    return this.grouping(currentUser, classId);
  }

  async recordScores(
    currentUser: CurrentUser,
    input: { classId: string; sessionKey: string; events: ScoreEventInput[] },
  ) {
    const { database } = await this.currentSchoolYear.require();
    await this.assertCanUse(currentUser, database, input.classId);
    await this.assertEnrolled(
      database,
      input.classId,
      input.events.flatMap((event) => (event.child_id ? [event.child_id] : [])),
    );
    const now = this.clock.now();
    const inserted = await database
      .insertInto('classroom_score_events')
      .values(
        input.events.map((event) => ({
          client_id: event.client_id,
          session_key: input.sessionKey,
          class_id: input.classId,
          target_kind: event.target_kind,
          group_name: event.group_name,
          child_id: event.child_id,
          delta: event.delta,
          note: event.note,
          recorded_by: currentUser.id,
          recorded_by_name: currentUser.description.full_name,
          occurred_at: clampClientTime(event.occurred_at, now),
        })),
      )
      .onConflict((conflict) => conflict.column('client_id').doNothing())
      .returning('id')
      .execute();
    return { saved: inserted.length, duplicates: input.events.length - inserted.length };
  }

  // Dòng điểm của buổi do chính giáo viên ghi, kèm tổng theo nhóm, học sinh
  async scores(currentUser: CurrentUser, classId: string, sessionKey: string) {
    const { database } = await this.currentSchoolYear.require();
    await this.assertCanUse(currentUser, database, classId);
    const events = await database
      .selectFrom('classroom_score_events')
      .leftJoin('children', 'children.id', 'classroom_score_events.child_id')
      .select([
        'classroom_score_events.id',
        'classroom_score_events.target_kind',
        'classroom_score_events.group_name',
        'classroom_score_events.child_id',
        'children.full_name as child_name',
        'classroom_score_events.delta',
        'classroom_score_events.note',
        'classroom_score_events.occurred_at',
        'classroom_score_events.confirmed_at',
        'classroom_score_events.conduct_entry_id',
      ])
      .where('classroom_score_events.class_id', '=', classId)
      .where('classroom_score_events.session_key', '=', sessionKey)
      .where('classroom_score_events.recorded_by', '=', currentUser.id)
      .orderBy('classroom_score_events.occurred_at')
      .execute();
    return {
      session_key: sessionKey,
      events,
      totals: tallyScores(
        events.map((event) => ({
          target_kind: event.target_kind,
          group_name: event.group_name,
          child_id: event.child_id,
          delta: event.delta,
          confirmed: event.confirmed_at !== null,
        })),
      ),
    };
  }

  // Bỏ buổi: xóa các dòng chưa chuyển vào nề nếp; dòng đã chuyển giữ để đối chiếu với dòng nề nếp
  async discardSession(currentUser: CurrentUser, classId: string, sessionKey: string) {
    const { database } = await this.currentSchoolYear.require();
    await this.assertCanUse(currentUser, database, classId);
    const removed = await database
      .deleteFrom('classroom_score_events')
      .where('class_id', '=', classId)
      .where('session_key', '=', sessionKey)
      .where('recorded_by', '=', currentUser.id)
      .where('confirmed_at', 'is', null)
      .returning('id')
      .execute();
    return { deleted: removed.length };
  }

  // Chuyển điểm của buổi vào nề nếp, thi đua: giáo viên chọn tiêu chí và xác nhận. Tổng điểm của các đối tượng được chọn
  // đổi thành số lần của tiêu chí (tiêu chí cộng cho tổng dương, tiêu chí trừ cho tổng âm), tách nhiều dòng nếu quá 50 lần.
  // Dòng điểm được giữ chỗ trước (confirmed_at) để hai lần bấm không chuyển đôi; ghi nề nếp lỗi thì trả lại
  async confirmToConduct(
    currentUser: CurrentUser,
    classId: string,
    sessionKey: string,
    input: { criterionId: string; targets: ScoreTarget[] | null; date: string | null },
    origin: ReturnType<typeof originOf>,
  ) {
    const { database } = await this.currentSchoolYear.require();
    await this.assertCanUse(currentUser, database, classId);
    const date = input.date ?? vietnamDate(this.clock.now());
    const criterion = await database
      .selectFrom('conduct_criteria')
      .select(['id', 'kind'])
      .where('id', '=', input.criterionId)
      .executeTakeFirst();
    if (!criterion) {
      throw validationError([{ field: 'criterion_id', message: 'Tiêu chí không có' }]);
    }
    const claimed = await database
      .updateTable('classroom_score_events')
      .set({ confirmed_at: this.clock.now() })
      .where('class_id', '=', classId)
      .where('session_key', '=', sessionKey)
      .where('recorded_by', '=', currentUser.id)
      .where('confirmed_at', 'is', null)
      .$if(input.targets !== null, (query) =>
        query.where((expression) =>
          expression.or(
            (input.targets ?? []).map((target) =>
              target.kind === 'group'
                ? expression.and([expression('target_kind', '=', 'group'), expression('group_name', '=', target.key)])
                : expression.and([expression('target_kind', '=', 'student'), expression('child_id', '=', target.key)]),
            ),
          ),
        ),
      )
      .returning(['id', 'target_kind', 'group_name', 'child_id', 'delta'])
      .execute();
    const release = async () => {
      if (claimed.length > 0) {
        await database
          .updateTable('classroom_score_events')
          .set({ confirmed_at: null })
          .where(
            'id',
            'in',
            claimed.map((event) => event.id),
          )
          .execute();
      }
    };
    const net = claimed.reduce((total, event) => total + event.delta, 0);
    const entryIds: string[] = [];
    try {
      if (claimed.length === 0) {
        throw ruleViolationError(CLASSROOM_TOOLS_RULE_CODE, 'Không có điểm nào của buổi để chuyển vào nề nếp');
      }
      if (net === 0 || net > 0 !== (criterion.kind === 'plus')) {
        throw ruleViolationError(
          CLASSROOM_TOOLS_RULE_CODE,
          net === 0
            ? 'Tổng điểm đã chọn bằng 0, không có gì để ghi'
            : criterion.kind === 'plus'
              ? 'Tổng điểm đã chọn là điểm trừ: chọn tiêu chí trừ điểm'
              : 'Tổng điểm đã chọn là điểm cộng: chọn tiêu chí cộng điểm',
          [{ field: 'criterion_id', message: 'Tiêu chí không cùng chiều với tổng điểm của buổi' }],
        );
      }
      const note = await this.summaryNote(database, claimed);
      for (const quantity of splitConductQuantity(Math.abs(net))) {
        const entry = await this.conduct.record(
          currentUser,
          { classId, criterionId: input.criterionId, date, quantity, note, reportedBy: null },
          origin,
        );
        entryIds.push(entry.id);
      }
      await database
        .updateTable('classroom_score_events')
        .set({ conduct_entry_id: entryIds[0] ?? null })
        .where(
          'id',
          'in',
          claimed.map((event) => event.id),
        )
        .execute();
      return { confirmed_events: claimed.length, net, quantity: Math.abs(net), conduct_entry_ids: entryIds };
    } catch (error) {
      // Đã ghi một phần các dòng nề nếp (tổng quá 50 lần, một dòng sau lỗi) thì giữ các dòng điểm là đã chuyển để lần sau không ghi trùng
      if (entryIds.length > 0) {
        await database
          .updateTable('classroom_score_events')
          .set({ conduct_entry_id: entryIds[0] ?? null })
          .where(
            'id',
            'in',
            claimed.map((event) => event.id),
          )
          .execute();
      } else {
        await release();
      }
      throw error;
    }
  }

  // "Bảng điểm nhanh: Nhóm 1 (+5), An (-1)": ghi chú của dòng nề nếp, tối đa 500 ký tự
  private async summaryNote(
    database: Kysely<SchoolYearDatabase>,
    events: Array<{
      target_kind: 'group' | 'student';
      group_name: string | null;
      child_id: string | null;
      delta: number;
    }>,
  ): Promise<string> {
    const childIds = [...new Set(events.flatMap((event) => (event.child_id ? [event.child_id] : [])))];
    const names = new Map<string, string>();
    if (childIds.length > 0) {
      for (const row of await database
        .selectFrom('children')
        .select(['id', 'full_name'])
        .where('id', 'in', childIds)
        .execute()) {
        names.set(row.id, row.full_name);
      }
    }
    const totals = tallyScores(events.map((event) => ({ ...event, confirmed: false })));
    const parts = totals.map((total) => {
      const label = total.target_kind === 'group' ? total.key : (names.get(total.key) ?? 'học sinh');
      return `${label} (${total.total > 0 ? '+' : ''}${total.total})`;
    });
    const text = `Bảng điểm nhanh: ${parts.join(', ')}`;
    return text.length > 500 ? `${text.slice(0, 497)}...` : text;
  }

  // Lớp tồn tại và người gọi được phân công, hoặc có vai trò đơn vị xem được lớp (cùng phạm vi xem trẻ của điểm danh)
  private async assertCanUse(currentUser: CurrentUser, database: Kysely<SchoolYearDatabase>, classId: string) {
    const classRecord = await database
      .selectFrom('classes')
      .select(['id', 'org_unit_id', 'name', 'status'])
      .where('id', '=', classId)
      .executeTakeFirst();
    if (!classRecord) {
      throw notFoundError('Không tìm thấy lớp', 'class');
    }
    const scope = await this.childScope.resolve(currentUser, database);
    if (!(
      scope.wholeSchool ||
      scope.unitIds.includes(classRecord.org_unit_id) ||
      scope.classIds.includes(classRecord.id)
    )) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không phụ trách lớp này');
    }
    return classRecord;
  }

  // Học sinh phải từng được xếp vào lớp (danh sách ngoại tuyến có thể cũ hơn danh sách hiện tại một chút)
  private async assertEnrolled(database: Kysely<SchoolYearDatabase>, classId: string, childIds: string[]) {
    const unique = [...new Set(childIds)];
    if (unique.length === 0) {
      return;
    }
    const found = await database
      .selectFrom('class_enrollments')
      .select('child_id')
      .where('class_id', '=', classId)
      .where('child_id', 'in', unique)
      .execute();
    const known = new Set(found.map((row) => row.child_id));
    const missing = unique.filter((id) => !known.has(id));
    if (missing.length > 0) {
      throw validationError([{ field: 'child_id', message: 'Có học sinh không thuộc lớp này' }]);
    }
  }
}

function readTargets(value: unknown, errors: FieldError[]): ScoreTarget[] | null {
  if (value === undefined || value === null) {
    return null;
  }
  const raw = asArray(value);
  if (!raw || raw.length === 0 || raw.length > 200) {
    errors.push({ field: 'targets', message: 'Danh sách đối tượng từ 1 đến 200 phần tử' });
    return null;
  }
  const targets: ScoreTarget[] = [];
  for (const item of raw) {
    const entry = (item ?? {}) as Record<string, unknown>;
    if (
      (entry.kind === 'group' && typeof entry.key === 'string' && entry.key.trim() !== '') ||
      (entry.kind === 'student' && isUuid(entry.key))
    ) {
      targets.push({ kind: entry.kind, key: entry.key as string } as ScoreTarget);
    } else {
      errors.push({ field: 'targets', message: 'Mỗi đối tượng có kind (group, student) và key hợp lệ' });
      break;
    }
  }
  return targets;
}

@Controller('classroom-tools')
export class ClassroomToolsController {
  constructor(private readonly tools: ClassroomToolsService) {}

  @Get('config')
  config() {
    return this.tools.config();
  }

  @Get('classes/:classId/roster')
  roster(
    @Param('classId', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.tools.roster(user, classId);
  }

  @Post('calls')
  @HttpCode(200)
  recordCalls(@Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.tools.recordCalls(user, parseCallsInput(body));
  }

  @Get('classes/:classId/calls')
  calls(
    @Param('classId', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.tools.calls(user, classId);
  }

  @Delete('classes/:classId/calls')
  clearCalls(
    @Param('classId', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.tools.removeCalls(user, classId, null);
  }

  @Delete('classes/:classId/calls/:callId')
  removeCall(
    @Param('classId', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Param('callId', uuidParameter('Mã lượt gọi không hợp lệ')) callId: string,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.tools.removeCalls(user, classId, callId);
  }

  @Get('classes/:classId/grouping')
  grouping(
    @Param('classId', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.tools.grouping(user, classId);
  }

  @Put('classes/:classId/grouping')
  saveGrouping(
    @Param('classId', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    const groups = parseGroupsInput(body);
    if (body?.group_set_id !== undefined && body?.group_set_id !== null && !isUuid(body.group_set_id)) {
      throw validationError([{ field: 'group_set_id', message: 'Mã bộ nhóm không hợp lệ' }]);
    }
    return this.tools.saveGrouping(
      user,
      classId,
      groups,
      originOf(request, user),
      isUuid(body?.group_set_id) ? body.group_set_id : null,
    );
  }

  @Post('scores')
  @HttpCode(200)
  recordScores(@Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.tools.recordScores(user, parseScoreEventsInput(body));
  }

  @Get('classes/:classId/scores')
  scores(
    @Param('classId', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Query('session_key') sessionKey: string | undefined,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    if (!isUuid(sessionKey)) {
      throw validationError([{ field: 'session_key', message: 'Mã buổi không hợp lệ' }]);
    }
    return this.tools.scores(user, classId, sessionKey);
  }

  @Delete('classes/:classId/scores/:sessionKey')
  discard(
    @Param('classId', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Param('sessionKey', uuidParameter('Mã buổi không hợp lệ')) sessionKey: string,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.tools.discardSession(user, classId, sessionKey);
  }

  @Post('classes/:classId/scores/:sessionKey/confirm')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.conductRecord)
  confirm(
    @Param('classId', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Param('sessionKey', uuidParameter('Mã buổi không hợp lệ')) sessionKey: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const criterionId = readRequiredUuid(body, 'criterion_id', errors, 'Bắt buộc chọn tiêu chí');
    const targets = readTargets(body?.targets, errors);
    const date = body?.date === undefined || body?.date === null ? null : String(body.date);
    if (date !== null && (!DATE_PATTERN.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)))) {
      errors.push({ field: 'date', message: 'Ngày theo dạng YYYY-MM-DD' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.tools.confirmToConduct(
      user,
      classId,
      sessionKey,
      { criterionId, targets, date },
      originOf(request, user),
    );
  }
}
