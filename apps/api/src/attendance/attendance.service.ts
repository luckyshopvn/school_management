import { Injectable } from '@nestjs/common';
import type { AttendanceStatus, SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, validationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import { sql, type Kysely } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification } from '../common/notification-queue.js';
import { notFoundError } from '../common/request-fields.js';
import { ChildScope } from '../children/child-scope.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { SettingsService } from '../settings/settings.service.js';
import { SchoolCalendar } from './school-calendar.js';

// Điểm danh trong ngày, chốt ngày và báo vắng (P04-01, 02, 06; QT-02; BR-12, BR-13, BR-16; YCTD-47)
export const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  'present',
  'absent_notified',
  'absent_unnotified',
  'late',
  'early_leave',
  'late_and_early_leave',
];
// Trẻ có mặt, đi muộn hoặc về sớm đều tính một suất ăn trong ngày (BR-58, Q-39)
const MEAL_STATUSES: AttendanceStatus[] = ['present', 'late', 'early_leave', 'late_and_early_leave'];
const MAXIMUM_ABSENCE_DAYS = 31;

export interface AttendanceEntry {
  child_id: string;
  status: AttendanceStatus;
  note: string | null;
}

interface ClassContext {
  id: string;
  org_unit_id: string;
  name: string;
  status: 'active' | 'closed';
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly childScope: ChildScope,
    private readonly calendar: SchoolCalendar,
    private readonly settings: SettingsService,
    private readonly clock: Clock,
  ) {}

  // Bảng điểm danh: trẻ đang học của lớp, trạng thái đã lưu, báo vắng đã có; chưa lưu thì chưa đánh dấu
  async sheet(currentUser: CurrentUser, classId: string, date: string) {
    const { database } = await this.currentSchoolYear.require();
    const classRecord = await this.findClass(database, classId);
    await this.assertCanRead(currentUser, database, classRecord);
    await this.calendar.assertSchoolDay(date);
    const summerChildren = await this.summerChildren(database, date);
    const children = await database
      .selectFrom('class_enrollments')
      .innerJoin('children', 'children.id', 'class_enrollments.child_id')
      .leftJoin('attendance_records', (join) =>
        join
          .onRef('attendance_records.child_id', '=', 'children.id')
          .on('attendance_records.attendance_date', '=', date),
      )
      .leftJoin('absence_records', (join) =>
        join.onRef('absence_records.child_id', '=', 'children.id').on('absence_records.absence_date', '=', date),
      )
      .select([
        'children.id as child_id',
        'children.full_name',
        'attendance_records.status',
        'attendance_records.note',
        'attendance_records.is_backfilled',
        'absence_records.reason as absence_reason',
        'absence_records.is_advised as absence_is_advised',
      ])
      .where('class_enrollments.class_id', '=', classId)
      .where('class_enrollments.is_current', '=', true)
      .where('children.status', '=', 'active')
      .$if(summerChildren !== null, (query) => query.where('children.id', 'in', summerChildren ?? []))
      .orderBy('children.full_name')
      .execute();
    const day = await database
      .selectFrom('attendance_days')
      .select(['status', 'locked_at', 'unlock_reason'])
      .where('class_id', '=', classId)
      .where('attendance_date', '=', date)
      .executeTakeFirst();
    const rows = children.map((child) => ({
      child_id: child.child_id,
      full_name: child.full_name,
      // Trẻ đã báo vắng mà chưa có bản ghi thì hiện sẵn là nghỉ có báo (AC-16)
      status: child.status ?? (child.absence_is_advised ? ('absent_notified' as const) : null),
      saved: child.status !== null,
      note: child.note ?? child.absence_reason ?? null,
      is_backfilled: child.is_backfilled ?? false,
      absence:
        child.absence_is_advised === null
          ? null
          : { reason: child.absence_reason, is_advised: child.absence_is_advised },
    }));
    return {
      class_id: classId,
      class_name: classRecord.name,
      date,
      day_status: day?.status ?? 'open',
      locked_at: day?.locked_at ?? null,
      can_edit: await this.canWrite(currentUser, database, classRecord),
      children: rows,
      summary: this.summarize(rows.map((row) => (row.saved ? row.status : null))),
    };
  }

  // Lưu điểm danh; chống trùng theo trẻ và ngày; ngày đã chốt thì phải có lý do và ghi nhật ký (BR-12, AC-14, AC-15)
  async save(
    currentUser: CurrentUser,
    classId: string,
    input: { date: string; entries: AttendanceEntry[]; reason: string | null; offlineRecordedAt: Date | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const classRecord = await this.findClass(database, classId);
    const writer = await this.assertCanWrite(currentUser, database, classRecord);
    await this.calendar.assertSchoolDay(input.date);
    if (input.date > this.calendar.today(this.clock.now())) {
      throw ruleViolationError('QT-02', 'Không điểm danh trước cho ngày chưa tới');
    }
    const day = await database
      .selectFrom('attendance_days')
      .select('status')
      .where('class_id', '=', classId)
      .where('attendance_date', '=', input.date)
      .executeTakeFirst();
    const locked = day?.status === 'locked';
    if (locked && !input.reason) {
      throw validationError([{ field: 'reason', message: 'Ngày đã chốt; nhập lý do để sửa điểm danh' }]);
    }
    // Chỉ ghi cho trẻ đang học của lớp; trẻ đã chuyển lớp bị bỏ qua kèm cảnh báo (BR-16, QT-02 E2).
    // Ngày kỳ hè chỉ trẻ đã đăng ký học hè tháng đó (BR-92)
    const summerChildren = await this.summerChildren(database, input.date);
    const enrolled = new Set(
      (
        await database
          .selectFrom('class_enrollments')
          .innerJoin('children', 'children.id', 'class_enrollments.child_id')
          .select('class_enrollments.child_id')
          .where('class_enrollments.class_id', '=', classId)
          .where('class_enrollments.is_current', '=', true)
          .where('children.status', '=', 'active')
          .$if(summerChildren !== null, (query) => query.where('children.id', 'in', summerChildren ?? []))
          .execute()
      ).map((row) => row.child_id),
    );
    const accepted = input.entries.filter((entry) => enrolled.has(entry.child_id));
    const skipped = input.entries.filter((entry) => !enrolled.has(entry.child_id)).map((entry) => entry.child_id);
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      const before = accepted.length
        ? await transaction
            .selectFrom('attendance_records')
            .select(['child_id', 'status', 'note'])
            .where('attendance_date', '=', input.date)
            .where(
              'child_id',
              'in',
              accepted.map((entry) => entry.child_id),
            )
            .execute()
        : [];
      for (const entry of accepted) {
        await transaction
          .insertInto('attendance_records')
          .values({
            child_id: entry.child_id,
            class_id: classId,
            org_unit_id: classRecord.org_unit_id,
            attendance_date: input.date,
            status: entry.status,
            note: entry.note,
            source: writer,
            recorded_by: origin.actorUserId,
            recorded_at: input.offlineRecordedAt ?? now,
            is_backfilled: input.offlineRecordedAt !== null,
          })
          .onConflict((conflict) =>
            conflict.columns(['child_id', 'attendance_date']).doUpdateSet({
              status: entry.status,
              note: entry.note,
              class_id: classId,
              source: writer,
              recorded_by: origin.actorUserId,
              recorded_at: input.offlineRecordedAt ?? now,
              is_backfilled: input.offlineRecordedAt !== null,
              updated_at: now,
            }),
          )
          .execute();
      }
      await transaction
        .insertInto('attendance_days')
        .values({ class_id: classId, attendance_date: input.date, status: 'open' })
        .onConflict((conflict) => conflict.columns(['class_id', 'attendance_date']).doNothing())
        .execute();
      if (locked) {
        const changed = accepted.filter((entry) => {
          const previous = before.find((row) => row.child_id === entry.child_id);
          return !previous || previous.status !== entry.status || previous.note !== entry.note;
        });
        for (const entry of changed) {
          await writeAuditLog(transaction, {
            origin,
            orgUnitId: classRecord.org_unit_id,
            entityName: 'attendance_records',
            entityId: entry.child_id,
            action: 'update',
            before: before.find((row) => row.child_id === entry.child_id) ?? null,
            after: { status: entry.status, note: entry.note, attendance_date: input.date, reason: input.reason },
          });
        }
        if (changed.length > 0) {
          await queueNotification(transaction, {
            orgUnitId: classRecord.org_unit_id,
            templateCode: 'attendance_amended',
            title: 'Điểm danh đã chốt được sửa',
            body: `Điểm danh lớp ${classRecord.name} ngày ${input.date} được sửa: ${input.reason}`,
            targetType: 'classes',
            targetId: classId,
            recipients: [{ roleCode: 'VT-03', orgUnitId: classRecord.org_unit_id, channel: 'in_app' }],
          });
        }
      }
    });
    return { ...(await this.sheet(currentUser, classId, input.date)), skipped_child_ids: skipped };
  }

  // Chốt ngày: mọi trẻ đã được đánh dấu; báo bếp và kế toán; trẻ vắng không báo thì báo phụ huynh (QT-02 bước 8, mục 9)
  async lock(currentUser: CurrentUser, classId: string, date: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const classRecord = await this.findClass(database, classId);
    await this.assertCanWrite(currentUser, database, classRecord);
    await this.calendar.assertSchoolDay(date);
    const sheet = await this.sheet(currentUser, classId, date);
    if (sheet.day_status === 'locked') {
      throw ruleViolationError('BR-12', 'Ngày này đã chốt điểm danh');
    }
    const unmarked = sheet.children.filter((child) => !child.saved);
    if (unmarked.length > 0) {
      throw ruleViolationError(
        'BR-12',
        'Còn trẻ chưa được điểm danh',
        unmarked.map((child) => ({ field: 'child_id', message: child.child_id })),
      );
    }
    const absentees = sheet.children.filter((child) => child.status === 'absent_unnotified');
    const guardians = absentees.length
      ? await database
          .selectFrom('child_guardians')
          .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
          .select(['child_guardians.child_id', 'guardians.user_id'])
          .where(
            'child_guardians.child_id',
            'in',
            absentees.map((child) => child.child_id),
          )
          .where('guardians.user_id', 'is not', null)
          .execute()
      : [];
    await database.transaction().execute(async (transaction) => {
      await transaction
        .insertInto('attendance_days')
        .values({
          class_id: classId,
          attendance_date: date,
          status: 'locked',
          locked_by: origin.actorUserId,
          locked_at: this.clock.now(),
        })
        .onConflict((conflict) =>
          conflict
            .columns(['class_id', 'attendance_date'])
            .doUpdateSet({ status: 'locked', locked_by: origin.actorUserId, locked_at: this.clock.now() }),
        )
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: classRecord.org_unit_id,
        entityName: 'attendance_days',
        entityId: classId,
        action: 'update',
        before: { status: 'open', attendance_date: date },
        after: { status: 'locked', attendance_date: date, summary: sheet.summary },
      });
      await queueNotification(transaction, {
        orgUnitId: classRecord.org_unit_id,
        templateCode: 'attendance_locked',
        title: 'Đã chốt điểm danh',
        body: `Lớp ${classRecord.name} ngày ${date}: ${sheet.summary.meal_count} suất ăn`,
        targetType: 'classes',
        targetId: classId,
        recipients: [
          { roleCode: 'VT-10', orgUnitId: classRecord.org_unit_id, channel: 'in_app' },
          { roleCode: 'VT-04', orgUnitId: classRecord.org_unit_id, channel: 'in_app' },
        ],
      });
      for (const child of absentees) {
        const recipients = guardians
          .filter((guardian) => guardian.child_id === child.child_id && guardian.user_id)
          .flatMap((guardian) => [
            { userId: guardian.user_id ?? '', channel: 'in_app' as const },
            { userId: guardian.user_id ?? '', channel: 'sms' as const },
          ]);
        await queueNotification(transaction, {
          orgUnitId: classRecord.org_unit_id,
          templateCode: 'child_absent_unnotified',
          title: 'Trẻ vắng mặt hôm nay',
          body: `${child.full_name} vắng mặt ngày ${date}, nhà trường chưa nhận được báo vắng`,
          targetType: 'children',
          targetId: child.child_id,
          recipients,
        });
      }
    });
    return this.sheet(currentUser, classId, date);
  }

  // Mở lại ngày đã chốt kèm lý do (QT-02 mục 7)
  async unlock(currentUser: CurrentUser, classId: string, date: string, reason: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const classRecord = await this.findClass(database, classId);
    await this.assertCanWrite(currentUser, database, classRecord);
    const day = await database
      .selectFrom('attendance_days')
      .select('status')
      .where('class_id', '=', classId)
      .where('attendance_date', '=', date)
      .executeTakeFirst();
    if (day?.status !== 'locked') {
      throw ruleViolationError('BR-12', 'Ngày này chưa chốt điểm danh');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('attendance_days')
        .set({ status: 'open', unlocked_by: origin.actorUserId, unlocked_at: this.clock.now(), unlock_reason: reason })
        .where('class_id', '=', classId)
        .where('attendance_date', '=', date)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: classRecord.org_unit_id,
        entityName: 'attendance_days',
        entityId: classId,
        action: 'update',
        before: { status: 'locked', attendance_date: date },
        after: { status: 'open', attendance_date: date, reason },
      });
      await queueNotification(transaction, {
        orgUnitId: classRecord.org_unit_id,
        templateCode: 'attendance_amended',
        title: 'Điểm danh đã chốt được mở lại',
        body: `Điểm danh lớp ${classRecord.name} ngày ${date} được mở lại: ${reason}`,
        targetType: 'classes',
        targetId: classId,
        recipients: [{ roleCode: 'VT-03', orgUnitId: classRecord.org_unit_id, channel: 'in_app' }],
      });
    });
    return this.sheet(currentUser, classId, date);
  }

  // Báo vắng một hoặc nhiều ngày; báo trước giờ bắt đầu học là nghỉ có báo, báo sau là báo muộn (BR-13)
  async reportAbsence(
    currentUser: CurrentUser,
    input: { childId: string; fromDate: string; toDate: string; reason: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const child = await database
      .selectFrom('children')
      .leftJoin('class_enrollments', (join) =>
        join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
      )
      .select([
        'children.id',
        'children.org_unit_id',
        'children.full_name',
        'children.status',
        'class_enrollments.class_id',
      ])
      .where('children.id', '=', input.childId)
      .executeTakeFirst();
    if (!child) {
      throw notFoundError('Không tìm thấy trẻ', 'child');
    }
    const source = await this.absenceSource(currentUser, database, child);
    if (child.status !== 'active' || !child.class_id) {
      throw ruleViolationError('QT-02', 'Chỉ báo vắng được cho trẻ đang học');
    }
    const dates = this.datesBetween(input.fromDate, input.toDate);
    const schoolDates: string[] = [];
    for (const date of dates) {
      const summerChildren = await this.summerChildren(database, date);
      if (
        !(await this.calendar.reasonNotSchoolDay(date)) &&
        (summerChildren === null || summerChildren.includes(child.id))
      ) {
        schoolDates.push(date);
      }
    }
    if (schoolDates.length === 0) {
      throw ruleViolationError('BR-91', 'Không có ngày học nào trong khoảng đã chọn');
    }
    const startTime = await this.schoolStartTime(child.org_unit_id);
    const now = this.clock.now();
    const homeroomTeachers = await database
      .selectFrom('class_staff_assignments')
      .select('staff_user_id')
      .where('class_id', '=', child.class_id)
      .where('assignment_role', '=', 'homeroom')
      .where('status', '=', 'active')
      .execute();
    await database.transaction().execute(async (transaction) => {
      for (const date of schoolDates) {
        const isAdvised = now < new Date(`${date}T${startTime}:00+07:00`);
        await transaction
          .insertInto('absence_records')
          .values({
            child_id: child.id,
            org_unit_id: child.org_unit_id,
            absence_date: date,
            reason: input.reason,
            is_advised: isAdvised,
            advised_at: now,
            source,
            reported_by: origin.actorUserId,
          })
          .onConflict((conflict) =>
            conflict
              .columns(['child_id', 'absence_date'])
              .doUpdateSet({ reason: input.reason, reported_by: origin.actorUserId }),
          )
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: child.org_unit_id,
        entityName: 'absence_records',
        entityId: child.id,
        action: 'create',
        before: null,
        after: { dates: schoolDates, reason: input.reason, source },
      });
      if (source === 'parent') {
        await queueNotification(transaction, {
          orgUnitId: child.org_unit_id,
          templateCode: 'absence_reported',
          title: 'Phụ huynh báo vắng',
          body: `Phụ huynh báo vắng cho ${child.full_name}: ${schoolDates.join(', ')}`,
          targetType: 'children',
          targetId: child.id,
          recipients: homeroomTeachers.map((teacher) => ({
            userId: teacher.staff_user_id,
            channel: 'in_app' as const,
          })),
        });
      }
    });
    return this.absences(currentUser, child.id, input.fromDate, input.toDate);
  }

  async absences(currentUser: CurrentUser, childId: string, fromDate: string, toDate: string) {
    const { database } = await this.currentSchoolYear.require();
    await this.childScope.assertCanRead(currentUser, database, childId);
    return database
      .selectFrom('absence_records')
      .select(['id', 'child_id', 'absence_date', 'reason', 'is_advised', 'source', 'advised_at'])
      .where('child_id', '=', childId)
      .where('absence_date', '>=', fromDate)
      .where('absence_date', '<=', toDate)
      .orderBy('absence_date')
      .execute();
  }

  // Điểm danh của một trẻ theo tháng cho phụ huynh và người được xem trẻ (MP-02)
  async childAttendance(currentUser: CurrentUser, childId: string, month: string) {
    const { database } = await this.currentSchoolYear.require();
    await this.childScope.assertCanRead(currentUser, database, childId);
    const fromDate = `${month}-01`;
    const toDate = sql<string>`(date_trunc('month', ${fromDate}::date) + interval '1 month - 1 day')::date`;
    const records = await database
      .selectFrom('attendance_records')
      .select(['attendance_date', 'status', 'note'])
      .where('child_id', '=', childId)
      .where('attendance_date', '>=', fromDate)
      .where('attendance_date', '<=', toDate)
      .orderBy('attendance_date')
      .execute();
    const absences = await database
      .selectFrom('absence_records')
      .select(['absence_date', 'reason', 'is_advised'])
      .where('child_id', '=', childId)
      .where('absence_date', '>=', fromDate)
      .where('absence_date', '<=', toDate)
      .orderBy('absence_date')
      .execute();
    return { child_id: childId, month, records, absences };
  }

  // Ngày kỳ hè trả danh sách trẻ đã đăng ký học hè tháng đó; ngày thường trả null là không lọc (BR-92, YCTD-50)
  private async summerChildren(database: Kysely<SchoolYearDatabase>, date: string): Promise<string[] | null> {
    if (!(await this.calendar.isSummerDay(date))) {
      return null;
    }
    const rows = await database
      .selectFrom('summer_registrations')
      .select('child_id')
      .where('period_year', '=', Number(date.slice(0, 4)))
      .where('period_month', '=', Number(date.slice(5, 7)))
      .where('status', '=', 'active')
      .execute();
    // Danh sách rỗng vẫn phải lọc hết, nên dùng mã không tồn tại thay cho mảng rỗng
    return rows.length > 0 ? rows.map((row) => row.child_id) : ['00000000-0000-0000-0000-000000000000'];
  }

  private summarize(statuses: Array<AttendanceStatus | null>) {
    const count = (status: AttendanceStatus) => statuses.filter((value) => value === status).length;
    return {
      total: statuses.length,
      unmarked: statuses.filter((value) => value === null).length,
      present: count('present'),
      late: count('late'),
      early_leave: count('early_leave') + count('late_and_early_leave'),
      absent_notified: count('absent_notified'),
      absent_unnotified: count('absent_unnotified'),
      meal_count: statuses.filter((value) => value !== null && MEAL_STATUSES.includes(value)).length,
    };
  }

  private datesBetween(fromDate: string, toDate: string): string[] {
    if (toDate < fromDate) {
      throw validationError([{ field: 'to_date', message: 'Ngày kết thúc không trước ngày bắt đầu' }]);
    }
    const dates: string[] = [];
    for (
      let cursor = new Date(`${fromDate}T00:00:00Z`);
      cursor.toISOString().slice(0, 10) <= toDate;
      cursor = new Date(cursor.getTime() + 86_400_000)
    ) {
      dates.push(cursor.toISOString().slice(0, 10));
      if (dates.length > MAXIMUM_ABSENCE_DAYS) {
        throw validationError([{ field: 'to_date', message: `Mỗi lần báo vắng tối đa ${MAXIMUM_ABSENCE_DAYS} ngày` }]);
      }
    }
    return dates;
  }

  private async schoolStartTime(orgUnitId: string): Promise<string> {
    const setting = (await this.settings.effective(orgUnitId)).find((item) => item.key === 'school_start_time');
    return typeof setting?.value === 'string' ? setting.value : '07:30';
  }

  private async findClass(database: Kysely<SchoolYearDatabase>, classId: string): Promise<ClassContext> {
    const classRecord = await database
      .selectFrom('classes')
      .select(['id', 'org_unit_id', 'name', 'status'])
      .where('id', '=', classId)
      .executeTakeFirst();
    if (!classRecord) {
      throw notFoundError('Không tìm thấy lớp', 'class');
    }
    return classRecord;
  }

  // Xem bảng điểm danh: vai trò văn phòng trong đơn vị hoặc giáo viên được phân công lớp (QT-02 mục 2)
  private async assertCanRead(
    currentUser: CurrentUser,
    database: Kysely<SchoolYearDatabase>,
    classRecord: ClassContext,
  ): Promise<void> {
    const scope = await this.childScope.resolve(currentUser, database);
    if (!(
      scope.wholeSchool ||
      scope.unitIds.includes(classRecord.org_unit_id) ||
      scope.classIds.includes(classRecord.id)
    )) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không phụ trách lớp này');
    }
  }

  private async canWrite(
    currentUser: CurrentUser,
    database: Kysely<SchoolYearDatabase>,
    classRecord: ClassContext,
  ): Promise<boolean> {
    return (await this.writer(currentUser, database, classRecord)) !== null;
  }

  // Ghi điểm danh: giáo viên chủ nhiệm đang được phân công lớp, hoặc quản lý đơn vị có P04.attendance.manage (BR-16)
  private async assertCanWrite(
    currentUser: CurrentUser,
    database: Kysely<SchoolYearDatabase>,
    classRecord: ClassContext,
  ): Promise<'teacher' | 'manager'> {
    if (classRecord.status !== 'active') {
      throw ruleViolationError('BR-02', 'Lớp đã đóng');
    }
    const writer = await this.writer(currentUser, database, classRecord);
    if (!writer) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không phụ trách lớp này');
    }
    return writer;
  }

  private async writer(
    currentUser: CurrentUser,
    database: Kysely<SchoolYearDatabase>,
    classRecord: ClassContext,
  ): Promise<'teacher' | 'manager' | null> {
    const homeroom = await database
      .selectFrom('class_staff_assignments')
      .select('id')
      .where('class_id', '=', classRecord.id)
      .where('staff_user_id', '=', currentUser.id)
      .where('assignment_role', '=', 'homeroom')
      .where('status', '=', 'active')
      .executeTakeFirst();
    if (homeroom && currentUser.description.assignments.some((assignment) => assignment.role_code === 'VT-07')) {
      return 'teacher';
    }
    if (currentUser.hasPermission(PERMISSION_CODES.attendanceManage)) {
      const scope = await this.organizationScopes.resolve(currentUser, PERMISSION_CODES.attendanceManage);
      if (scope.wholeSchool || scope.orgUnitIds.includes(classRecord.org_unit_id)) {
        return 'manager';
      }
    }
    return null;
  }

  // Phụ huynh báo cho con mình; giáo viên chủ nhiệm và quản lý đơn vị ghi thay (BR-13, AC-97)
  private async absenceSource(
    currentUser: CurrentUser,
    database: Kysely<SchoolYearDatabase>,
    child: { id: string; class_id: string | null; org_unit_id: string },
  ): Promise<'parent' | 'teacher' | 'manager'> {
    const guardian = await database
      .selectFrom('child_guardians')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .select('guardians.id')
      .where('child_guardians.child_id', '=', child.id)
      .where('guardians.user_id', '=', currentUser.id)
      .executeTakeFirst();
    if (guardian) {
      return 'parent';
    }
    if (child.class_id) {
      const writer = await this.writer(currentUser, database, {
        id: child.class_id,
        org_unit_id: child.org_unit_id,
        name: '',
        status: 'active',
      });
      if (writer) {
        return writer;
      }
    }
    throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền báo vắng cho trẻ này');
  }
}
