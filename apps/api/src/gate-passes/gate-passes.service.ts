import { Injectable } from '@nestjs/common';
import type { GatePassDirection, GatePassMethod, SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Kysely, Transaction } from 'kysely';
import { SchoolCalendar, VIETNAM_DATE } from '../attendance/school-calendar.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { ChildScope } from '../children/child-scope.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification } from '../common/notification-queue.js';
import { notFoundError } from '../common/request-fields.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { SettingsService } from '../settings/settings.service.js';
import {
  GATE_CARD_CODE_PATTERN,
  generateGateCardCode,
  isDuplicatePass,
  normalizeGateCardCode,
  shouldAutoMarkLate,
  suggestAttendanceStatus,
  vietnamTimeOfDay,
} from './gate-pass-rules.js';

// Thẻ QR và lượt qua cổng của học sinh, lát L1 (YCTD-389; tai_lieu/ban_mau/yctd-389/DAC_TA.md mục 4).
// Lượt qua cổng là gợi ý cho giáo viên; chỉ "Đi muộn" từ thẻ được tự ghi; không bao giờ tự ghi vắng
const RECENT_LIMIT = 30;
const MAXIMUM_RANGE_DAYS = 31;

export interface GatePassSummary {
  first_in_pass_id: string | null;
  first_in: Date | null;
  last_out: Date | null;
  first_in_method: GatePassMethod | null;
  suggested_status: 'present' | 'late' | null;
}

interface ChildContext {
  id: string;
  full_name: string;
  org_unit_id: string;
  status: string;
  class_id: string | null;
  class_name: string | null;
}

@Injectable()
export class GatePassesService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly childScope: ChildScope,
    private readonly calendar: SchoolCalendar,
    private readonly settings: SettingsService,
    private readonly clock: Clock,
  ) {}

  // Thẻ của học sinh đang học trong lớp, để in (MH-640 phần in thẻ); chỉ người cấp thẻ của đơn vị xem được mã
  async classCards(currentUser: CurrentUser, classId: string) {
    const { database } = await this.currentSchoolYear.require();
    const classRecord = await this.findClass(database, classId);
    await this.organizationScopes.assertCanAccess(
      currentUser,
      PERMISSION_CODES.gateCardManage,
      classRecord.org_unit_id,
    );
    const rows = await database
      .selectFrom('class_enrollments')
      .innerJoin('children', 'children.id', 'class_enrollments.child_id')
      .leftJoin('gate_cards', (join) =>
        join.onRef('gate_cards.child_id', '=', 'children.id').on('gate_cards.revoked_at', 'is', null),
      )
      .select(['children.id as child_id', 'children.full_name', 'gate_cards.code', 'gate_cards.issued_at'])
      .where('class_enrollments.class_id', '=', classId)
      .where('class_enrollments.is_current', '=', true)
      .where('children.status', '=', 'active')
      .orderBy('children.full_name')
      .execute();
    return { class_id: classId, class_name: classRecord.name, children: rows };
  }

  // Cấp thẻ cho học sinh chưa có thẻ; học sinh trong `reissueChildIds` được cấp lại (thẻ cũ bị thu hồi, không quét được nữa)
  async issueCards(currentUser: CurrentUser, classId: string, reissueChildIds: string[], origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const classRecord = await this.findClass(database, classId);
    await this.organizationScopes.assertCanAccess(
      currentUser,
      PERMISSION_CODES.gateCardManage,
      classRecord.org_unit_id,
    );
    const current = await this.classCards(currentUser, classId);
    const enrolled = new Set(current.children.map((child) => child.child_id));
    const outside = reissueChildIds.filter((childId) => !enrolled.has(childId));
    if (outside.length > 0) {
      throw ruleViolationError(
        'QT-02',
        'Chỉ cấp lại thẻ cho học sinh đang học trong lớp',
        outside.map((childId) => ({ field: 'reissue_child_ids', message: childId })),
      );
    }
    const reissue = new Set(reissueChildIds);
    const targets = current.children.filter((child) => child.code === null || reissue.has(child.child_id));
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      for (const child of targets) {
        if (child.code !== null) {
          await transaction
            .updateTable('gate_cards')
            .set({ revoked_at: now, revoked_by: origin.actorUserId })
            .where('child_id', '=', child.child_id)
            .where('revoked_at', 'is', null)
            .execute();
        }
        const card = await transaction
          .insertInto('gate_cards')
          .values({ child_id: child.child_id, code: generateGateCardCode(), issued_by: origin.actorUserId })
          .returning(['id', 'child_id'])
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: classRecord.org_unit_id,
          entityName: 'gate_cards',
          entityId: card.id,
          action: 'create',
          before: child.code === null ? null : { child_id: child.child_id, reissued: true },
          after: { child_id: child.child_id },
        });
      }
    });
    return { ...(await this.classCards(currentUser, classId)), issued_count: targets.length };
  }

  // Quét thẻ ở cổng: ghi lượt vào hoặc ra, gộp lượt quét lại trong 5 phút, tự ghi "Đi muộn", báo phụ huynh
  async recordScan(currentUser: CurrentUser, rawCode: string, direction: GatePassDirection, origin: ChangeOrigin) {
    const code = normalizeGateCardCode(rawCode);
    if (!GATE_CARD_CODE_PATTERN.test(code)) {
      throw ruleViolationError('QT-02', 'Mã thẻ không đúng dạng; quét lại hoặc nhập 16 ký tự in trên thẻ');
    }
    const { database } = await this.currentSchoolYear.require();
    const card = await database
      .selectFrom('gate_cards')
      .select(['id', 'child_id', 'revoked_at'])
      .where('code', '=', code)
      .executeTakeFirst();
    if (!card) {
      throw notFoundError('Không tìm thấy thẻ này', 'gate_card');
    }
    const child = await this.findChild(database, card.child_id);
    await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.gatePassRecord, child.org_unit_id);
    if (card.revoked_at !== null) {
      throw ruleViolationError('QT-02', `Thẻ của ${child.full_name} đã bị thu hồi; dùng thẻ mới`);
    }
    if (child.status !== 'active') {
      throw ruleViolationError('QT-02', `${child.full_name} không còn đang học`);
    }
    const passedAt = this.clock.now();
    const date = VIETNAM_DATE.format(passedAt);
    const previous = await database
      .selectFrom('gate_passes')
      .select(['id', 'direction', 'passed_at'])
      .where('child_id', '=', child.id)
      .where('review_status', '!=', 'rejected')
      .orderBy('passed_at', 'desc')
      .executeTakeFirst();
    if (previous && isDuplicatePass(previous, direction, passedAt)) {
      return {
        id: previous.id,
        child_id: child.id,
        child_name: child.full_name,
        class_name: child.class_name,
        direction,
        passed_at: previous.passed_at,
        duplicate: true,
        auto_late: false,
      };
    }
    const schoolStartTime = await this.schoolStartTime(child.org_unit_id);
    const isSchoolDay = (await this.calendar.reasonNotSchoolDay(date)) === null;
    const result = await database.transaction().execute(async (transaction) => {
      const pass = await transaction
        .insertInto('gate_passes')
        .values({
          child_id: child.id,
          org_unit_id: child.org_unit_id,
          direction,
          passed_at: passedAt,
          method: 'qr',
          gate_card_id: card.id,
          recorded_by: origin.actorUserId,
        })
        .returning(['id', 'passed_at'])
        .executeTakeFirstOrThrow();
      const existing = await transaction
        .selectFrom('attendance_records')
        .select('id')
        .where('child_id', '=', child.id)
        .where('attendance_date', '=', date)
        .executeTakeFirst();
      const autoLate =
        child.class_id !== null &&
        shouldAutoMarkLate({
          direction,
          method: 'qr',
          passedAt,
          schoolStartTime,
          isSchoolDay,
          hasAttendanceRecord: existing !== undefined,
        });
      if (autoLate && child.class_id) {
        await transaction
          .insertInto('attendance_records')
          .values({
            child_id: child.id,
            class_id: child.class_id,
            org_unit_id: child.org_unit_id,
            attendance_date: date,
            status: 'late',
            note: `Tự ghi theo lượt vào cổng lúc ${vietnamTimeOfDay(passedAt)} (thẻ QR)`,
            source: 'system',
            recorded_by: origin.actorUserId,
            recorded_at: passedAt,
            is_backfilled: false,
          })
          .onConflict((conflict) => conflict.columns(['child_id', 'attendance_date']).doNothing())
          .execute();
      }
      await this.notifyGuardians(transaction, child, direction, passedAt);
      return { pass, autoLate };
    });
    return {
      id: result.pass.id,
      child_id: child.id,
      child_name: child.full_name,
      class_name: child.class_name,
      direction,
      passed_at: result.pass.passed_at,
      duplicate: false,
      auto_late: result.autoLate,
    };
  }

  // Lượt qua cổng gần nhất hôm nay trong phạm vi quét của người dùng (danh sách ở màn hình cổng)
  async recent(currentUser: CurrentUser) {
    const scope = await this.organizationScopes.resolve(currentUser, PERMISSION_CODES.gatePassRecord);
    if (!scope.wholeSchool && scope.orgUnitIds.length === 0) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền ghi lượt qua cổng');
    }
    const { database } = await this.currentSchoolYear.require();
    const start = this.startOfVietnamDay(this.clock.now());
    return database
      .selectFrom('gate_passes')
      .innerJoin('children', 'children.id', 'gate_passes.child_id')
      .select([
        'gate_passes.id',
        'gate_passes.child_id',
        'children.full_name as child_name',
        'gate_passes.direction',
        'gate_passes.passed_at',
        'gate_passes.method',
        'gate_passes.review_status',
      ])
      .where('gate_passes.passed_at', '>=', start)
      .$if(!scope.wholeSchool, (query) => query.where('gate_passes.org_unit_id', 'in', scope.orgUnitIds))
      .orderBy('gate_passes.passed_at', 'desc')
      .limit(RECENT_LIMIT)
      .execute();
  }

  // Báo nhận nhầm: giáo viên chủ nhiệm của lớp hoặc người quản lý điểm danh của đơn vị hủy một lượt; phụ huynh nhận đính chính
  async reject(currentUser: CurrentUser, passId: string, note: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const pass = await database
      .selectFrom('gate_passes')
      .select(['id', 'child_id', 'direction', 'passed_at', 'review_status'])
      .where('id', '=', passId)
      .executeTakeFirst();
    if (!pass) {
      throw notFoundError('Không tìm thấy lượt qua cổng', 'gate_pass');
    }
    const child = await this.findChild(database, pass.child_id);
    await this.assertCanReview(currentUser, database, child);
    if (pass.review_status === 'rejected') {
      throw ruleViolationError('QT-02', 'Lượt này đã được báo nhận nhầm');
    }
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('gate_passes')
        .set({ review_status: 'rejected', reviewed_by: origin.actorUserId, reviewed_at: now, review_note: note })
        .where('id', '=', pass.id)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: child.org_unit_id,
        entityName: 'gate_passes',
        entityId: pass.id,
        action: 'update',
        before: { review_status: pass.review_status },
        after: { review_status: 'rejected', review_note: note },
      });
      // Lượt đã chắc chắn thì phụ huynh đã nhận thông báo, cần đính chính
      if (pass.review_status === 'confirmed') {
        await queueNotification(transaction, {
          orgUnitId: child.org_unit_id,
          templateCode: 'gate_pass_corrected',
          title: 'Đính chính lượt qua cổng',
          body: `Nhà trường đính chính: lượt ${pass.direction === 'in' ? 'vào trường' : 'ra cổng'} của ${child.full_name} lúc ${vietnamTimeOfDay(pass.passed_at)} là nhận nhầm`,
          targetType: 'children',
          targetId: child.id,
          recipients: (await this.guardianUserIds(transaction, child.id)).map((userId) => ({
            userId,
            channel: 'in_app' as const,
          })),
        });
      }
    });
    return { id: pass.id, review_status: 'rejected' as const };
  }

  // Lượt qua cổng của một học sinh trong khoảng ngày: phụ huynh của em và người được xem hồ sơ em (MH-643)
  async childPasses(currentUser: CurrentUser, childId: string, fromDate: string, toDate: string) {
    const { database } = await this.currentSchoolYear.require();
    await this.childScope.assertCanRead(currentUser, database, childId);
    const from = new Date(`${fromDate}T00:00:00+07:00`);
    const to = new Date(new Date(`${toDate}T00:00:00+07:00`).getTime() + 86_400_000);
    if (to <= from || to.getTime() - from.getTime() > MAXIMUM_RANGE_DAYS * 86_400_000) {
      throw ruleViolationError('QT-02', `Khoảng ngày từ 1 đến ${MAXIMUM_RANGE_DAYS} ngày`);
    }
    return database
      .selectFrom('gate_passes')
      .select(['id', 'direction', 'passed_at', 'method', 'review_status', 'review_note'])
      .where('child_id', '=', childId)
      .where('passed_at', '>=', from)
      .where('passed_at', '<', to)
      .where('review_status', '!=', 'needs_review')
      .orderBy('passed_at')
      .execute();
  }

  // Tóm tắt lượt qua cổng trong ngày cho bảng điểm danh (MH-640): bỏ lượt đã báo nhầm và lượt chờ xem
  async summaries(
    database: Kysely<SchoolYearDatabase>,
    orgUnitId: string,
    childIds: string[],
    date: string,
  ): Promise<Map<string, GatePassSummary>> {
    const result = new Map<string, GatePassSummary>();
    if (childIds.length === 0) {
      return result;
    }
    const from = new Date(`${date}T00:00:00+07:00`);
    const to = new Date(from.getTime() + 86_400_000);
    const passes = await database
      .selectFrom('gate_passes')
      .select(['id', 'child_id', 'direction', 'passed_at', 'method'])
      .where('child_id', 'in', childIds)
      .where('passed_at', '>=', from)
      .where('passed_at', '<', to)
      .where('review_status', '=', 'confirmed')
      .orderBy('passed_at')
      .execute();
    const schoolStartTime = await this.schoolStartTime(orgUnitId);
    for (const pass of passes) {
      const summary = result.get(pass.child_id) ?? {
        first_in_pass_id: null,
        first_in: null,
        last_out: null,
        first_in_method: null,
        suggested_status: null,
      };
      if (pass.direction === 'in' && summary.first_in === null) {
        summary.first_in_pass_id = pass.id;
        summary.first_in = pass.passed_at;
        summary.first_in_method = pass.method;
        summary.suggested_status = suggestAttendanceStatus(pass.passed_at, schoolStartTime) as 'present' | 'late';
      }
      if (pass.direction === 'out') {
        summary.last_out = pass.passed_at;
      }
      result.set(pass.child_id, summary);
    }
    return result;
  }

  private async notifyGuardians(
    transaction: Transaction<SchoolYearDatabase>,
    child: ChildContext,
    direction: GatePassDirection,
    passedAt: Date,
  ): Promise<void> {
    const time = vietnamTimeOfDay(passedAt);
    await queueNotification(transaction, {
      orgUnitId: child.org_unit_id,
      templateCode: direction === 'in' ? 'gate_arrived' : 'gate_left',
      title: direction === 'in' ? 'Con đã vào trường' : 'Con đã ra khỏi cổng trường',
      body:
        direction === 'in'
          ? `${child.full_name} đã vào trường lúc ${time}. Nếu không đúng, báo nhà trường trong ứng dụng.`
          : `${child.full_name} đã ra khỏi cổng trường lúc ${time}.`,
      targetType: 'children',
      targetId: child.id,
      recipients: (await this.guardianUserIds(transaction, child.id)).map((userId) => ({
        userId,
        channel: 'in_app' as const,
      })),
    });
  }

  private startOfVietnamDay(moment: Date): Date {
    return new Date(`${VIETNAM_DATE.format(moment)}T00:00:00+07:00`);
  }

  private async schoolStartTime(orgUnitId: string): Promise<string> {
    const setting = (await this.settings.effective(orgUnitId)).find((item) => item.key === 'school_start_time');
    return typeof setting?.value === 'string' ? setting.value : '07:30';
  }

  // Xem lại lượt: giáo viên chủ nhiệm đang được phân công lớp của học sinh, hoặc người có quyền quản lý điểm danh của đơn vị
  private async assertCanReview(
    currentUser: CurrentUser,
    database: Kysely<SchoolYearDatabase>,
    child: ChildContext,
  ): Promise<void> {
    if (child.class_id && currentUser.description.assignments.some((assignment) => assignment.role_code === 'VT-07')) {
      const homeroom = await database
        .selectFrom('class_staff_assignments')
        .select('id')
        .where('class_id', '=', child.class_id)
        .where('staff_user_id', '=', currentUser.id)
        .where('assignment_role', '=', 'homeroom')
        .where('status', '=', 'active')
        .executeTakeFirst();
      if (homeroom) {
        return;
      }
    }
    if (currentUser.hasPermission(PERMISSION_CODES.attendanceManage)) {
      await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.attendanceManage, child.org_unit_id);
      return;
    }
    throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không phụ trách lớp của học sinh này');
  }

  private async findClass(database: Kysely<SchoolYearDatabase>, classId: string) {
    const classRecord = await database
      .selectFrom('classes')
      .select(['id', 'org_unit_id', 'name'])
      .where('id', '=', classId)
      .executeTakeFirst();
    if (!classRecord) {
      throw notFoundError('Không tìm thấy lớp', 'class');
    }
    return classRecord;
  }

  private async findChild(database: Kysely<SchoolYearDatabase>, childId: string): Promise<ChildContext> {
    const child = await database
      .selectFrom('children')
      .leftJoin('class_enrollments', (join) =>
        join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
      )
      .leftJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select([
        'children.id',
        'children.full_name',
        'children.org_unit_id',
        'children.status',
        'class_enrollments.class_id',
        'classes.name as class_name',
      ])
      .where('children.id', '=', childId)
      .executeTakeFirst();
    if (!child) {
      throw notFoundError('Không tìm thấy học sinh', 'child');
    }
    return child;
  }

  private async guardianUserIds(
    database: Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>,
    childId: string,
  ): Promise<string[]> {
    const rows = await database
      .selectFrom('child_guardians')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .select('guardians.user_id')
      .where('child_guardians.child_id', '=', childId)
      .where('guardians.user_id', 'is not', null)
      .execute();
    return [...new Set(rows.map((row) => row.user_id).filter((id): id is string => id !== null))];
  }
}
