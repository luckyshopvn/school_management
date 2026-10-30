import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase, SystemDatabase } from '@school-management/database';
import { ApplicationError, Clock } from '@school-management/server';
import type { Kysely } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import { actorNameOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { queueNotification, type NotificationRecipient } from '../common/notification-queue.js';
import { isUuid, notFoundError } from '../common/request-fields.js';

// Báo giáo viên chủ nhiệm khi gia sư AI ghi cờ cảnh báo tự hại hoặc bị bắt nạt (YCTD-383 lát L3, Q7). Quyết định của lát:
// - người nhận là giáo viên chủ nhiệm đang được phân công của lớp hiện tại của em; lớp chưa có giáo viên chủ nhiệm (hoặc em chưa xếp lớp)
//   thì báo Hiệu trưởng (VT-02) và Phó Hiệu trưởng (VT-15) của đơn vị: hai vai trò sẵn có có quyền quản lý hồ sơ học sinh và chịu
//   trách nhiệm chung về học sinh của trường, không dùng vai trò tuyển sinh hay kế toán;
// - thông báo chỉ có tên em, lớp và lời nhắc mở danh sách cờ, không có loại dấu hiệu hay câu em gửi (thông báo đẩy vốn chỉ có câu chung);
// - danh sách cờ chỉ có học sinh, lớp, loại dấu hiệu, thời điểm và đoạn trích ngắn của chính câu em gửi; không có toàn bộ hội thoại;
// - quyền xem tính lúc xem: giáo viên chủ nhiệm thấy cờ của em đang học lớp mình chủ nhiệm; Ban Giám hiệu thấy cờ của em ở lớp chưa có giáo
//   viên chủ nhiệm trong phạm vi đơn vị được gán; cha mẹ, giáo viên bộ môn, giáo viên chủ nhiệm lớp khác không thấy;
// - báo và đánh dấu đã xử lý đều ghi nhật ký thao tác.
type YearDatabase = Kysely<SchoolYearDatabase>;

const EXCERPT_LENGTH = 160;
const LEADERSHIP_ROLES = ['VT-02', 'VT-15'] as const;
const NOTIFY_BATCH = 50;
const LIST_LIMIT = 500;
const NO_ACTOR = '00000000-0000-0000-0000-000000000000';
const SYSTEM_ORIGIN: ChangeOrigin = { actorUserId: NO_ACTOR, actorName: 'Gia sư AI (tự động)', ipAddress: null };

export const SAFETY_FLAG_LABELS = { self_harm: 'Dấu hiệu tự hại', bullying: 'Dấu hiệu bị bắt nạt' } as const;

export function excerptOf(body: string): string {
  const text = body.replace(/\s+/g, ' ').trim();
  return text.length <= EXCERPT_LENGTH ? text : `${text.slice(0, EXCERPT_LENGTH - 1).trimEnd()}…`;
}

interface Placement {
  childName: string;
  classId: string | null;
  className: string | null;
  orgUnitId: string | null;
  homeroomUserIds: string[];
}

@Injectable()
export class AiTutorSafetyFlagService {
  constructor(
    private readonly databases: Databases,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly clock: Clock,
  ) {}

  private get system(): Kysely<SystemDatabase> {
    return this.databases.system;
  }

  // Lớp hiện tại và giáo viên chủ nhiệm đang được phân công của từng em
  private async placements(database: YearDatabase, childIds: string[]): Promise<Map<string, Placement>> {
    const result = new Map<string, Placement>();
    if (childIds.length === 0) {
      return result;
    }
    const [children, enrollments] = await Promise.all([
      database.selectFrom('children').select(['id', 'full_name']).where('id', 'in', childIds).execute(),
      database
        .selectFrom('class_enrollments')
        .innerJoin('classes', 'classes.id', 'class_enrollments.class_id')
        .select(['class_enrollments.child_id', 'classes.id', 'classes.name', 'classes.org_unit_id'])
        .where('class_enrollments.child_id', 'in', childIds)
        .where('class_enrollments.is_current', '=', true)
        .execute(),
    ]);
    const classIds = [...new Set(enrollments.map((row) => row.id))];
    const homerooms = classIds.length
      ? await database
          .selectFrom('class_staff_assignments')
          .select(['class_id', 'staff_user_id'])
          .where('class_id', 'in', classIds)
          .where('assignment_role', '=', 'homeroom')
          .where('status', '=', 'active')
          .execute()
      : [];
    for (const child of children) {
      const enrollment = enrollments.find((row) => row.child_id === child.id);
      result.set(child.id, {
        childName: child.full_name,
        classId: enrollment?.id ?? null,
        className: enrollment?.name ?? null,
        orgUnitId: enrollment?.org_unit_id ?? null,
        homeroomUserIds: enrollment
          ? homerooms.filter((row) => row.class_id === enrollment.id).map((row) => row.staff_user_id)
          : [],
      });
    }
    return result;
  }

  private async rootUnitId(database: YearDatabase): Promise<string | null> {
    const root = await database
      .selectFrom('org_units')
      .select('id')
      .where('unit_type', '=', 'truong_chinh')
      .executeTakeFirst();
    return root?.id ?? null;
  }

  // Báo các cờ chưa báo. Nhận cờ trước (ghi `notified_at` có điều kiện) để lời gọi lúc em gửi và việc nền không báo trùng; tạo thông báo
  // lỗi thì trả cờ về chưa báo để lần sau báo lại
  async notifyPending(database: YearDatabase | null, now: Date = this.clock.now()): Promise<number> {
    const year = database ?? (await this.currentSchoolYear.find())?.database;
    if (!year) {
      return 0;
    }
    const pending = await this.system
      .selectFrom('ai_tutor_safety_flags')
      .select(['id', 'child_id', 'kind', 'created_at'])
      .where('notified_at', 'is', null)
      .orderBy('created_at')
      .limit(NOTIFY_BATCH)
      .execute();
    if (pending.length === 0) {
      return 0;
    }
    const placements = await this.placements(year, [...new Set(pending.map((flag) => flag.child_id))]);
    const rootUnit = await this.rootUnitId(year);
    let notified = 0;
    for (const flag of pending) {
      const claimed = await this.system
        .updateTable('ai_tutor_safety_flags')
        .set({ notified_at: now })
        .where('id', '=', flag.id)
        .where('notified_at', 'is', null)
        .executeTakeFirst();
      if (Number(claimed.numUpdatedRows) === 0) {
        continue;
      }
      try {
        const placement = placements.get(flag.child_id);
        const unit = placement?.orgUnitId ?? rootUnit;
        const homeroom = placement?.homeroomUserIds ?? [];
        const recipients: NotificationRecipient[] =
          homeroom.length > 0
            ? homeroom.map((userId) => ({ userId, channel: 'in_app' as const }))
            : unit
              ? LEADERSHIP_ROLES.map((roleCode) => ({ roleCode, orgUnitId: unit, channel: 'in_app' as const }))
              : [];
        const name = placement?.childName ?? 'Một học sinh';
        const classPart = placement?.className ? ` lớp ${placement.className}` : '';
        await queueNotification(year, {
          orgUnitId: unit,
          templateCode: 'ai_tutor_safety_flag',
          title: 'Gia sư AI: học sinh cần thầy cô quan tâm',
          body: `${name}${classPart} có câu gửi Gia sư AI cần thầy cô quan tâm. Mở mục "Gia sư AI: cờ cần xử lý" để xem và đánh dấu đã xử lý.`,
          targetType: 'ai_tutor_safety_flags',
          targetId: flag.id,
          recipients,
        });
        await writeAuditLog(year, {
          origin: SYSTEM_ORIGIN,
          orgUnitId: unit,
          entityName: 'ai_tutor_safety_flags',
          entityId: flag.id,
          action: 'update',
          before: { notified_at: null },
          after: {
            notified_at: now.toISOString(),
            child_id: flag.child_id,
            kind: flag.kind,
            notified_to: homeroom.length > 0 ? 'homeroom' : 'leadership',
            recipient_count: recipients.length,
          },
        });
        notified += 1;
      } catch (error) {
        await this.system
          .updateTable('ai_tutor_safety_flags')
          .set({ notified_at: null })
          .where('id', '=', flag.id)
          .execute();
        throw error;
      }
    }
    return notified;
  }

  // Phạm vi xem của tài khoản: lớp đang chủ nhiệm; Ban Giám hiệu xem lớp chưa có giáo viên chủ nhiệm (toàn trường hoặc đơn vị được gán)
  private async viewerScope(database: YearDatabase, currentUser: CurrentUser) {
    const homeroomClasses = await database
      .selectFrom('class_staff_assignments')
      .select('class_id')
      .where('staff_user_id', '=', currentUser.id)
      .where('assignment_role', '=', 'homeroom')
      .where('status', '=', 'active')
      .execute();
    const rootUnit = await this.rootUnitId(database);
    const leadership = currentUser.description.assignments.filter((assignment) =>
      (LEADERSHIP_ROLES as readonly string[]).includes(assignment.role_code),
    );
    const wholeSchool = leadership.some(
      (assignment) => assignment.org_unit_id === null || assignment.org_unit_id === rootUnit,
    );
    const units = new Set(leadership.flatMap((assignment) => (assignment.org_unit_id ? [assignment.org_unit_id] : [])));
    return {
      homeroomClassIds: new Set(homeroomClasses.map((row) => row.class_id)),
      leadership: leadership.length > 0,
      wholeSchool,
      units,
    };
  }

  private canSee(
    scope: Awaited<ReturnType<AiTutorSafetyFlagService['viewerScope']>>,
    placement: Placement | undefined,
  ) {
    if (placement?.classId && scope.homeroomClassIds.has(placement.classId)) {
      return true;
    }
    if (!scope.leadership || (placement && placement.homeroomUserIds.length > 0)) {
      return false;
    }
    return (
      scope.wholeSchool ||
      (placement?.orgUnitId !== null && placement?.orgUnitId !== undefined && scope.units.has(placement.orgUnitId))
    );
  }

  async list(currentUser: CurrentUser) {
    const { database } = await this.currentSchoolYear.require();
    const scope = await this.viewerScope(database, currentUser);
    if (scope.homeroomClassIds.size === 0 && !scope.leadership) {
      return { pending_count: 0, flags: [] };
    }
    const rows = await this.system
      .selectFrom('ai_tutor_safety_flags')
      .innerJoin('ai_tutor_messages', 'ai_tutor_messages.id', 'ai_tutor_safety_flags.message_id')
      .select([
        'ai_tutor_safety_flags.id',
        'ai_tutor_safety_flags.child_id',
        'ai_tutor_safety_flags.kind',
        'ai_tutor_safety_flags.created_at',
        'ai_tutor_safety_flags.resolved_at',
        'ai_tutor_safety_flags.resolved_by_name',
        'ai_tutor_messages.body',
      ])
      .orderBy('ai_tutor_safety_flags.created_at', 'desc')
      .limit(LIST_LIMIT)
      .execute();
    const placements = await this.placements(database, [...new Set(rows.map((row) => row.child_id))]);
    const flags = rows
      .filter((row) => this.canSee(scope, placements.get(row.child_id)))
      .map((row) => {
        const placement = placements.get(row.child_id);
        return {
          id: row.id,
          child_name: placement?.childName ?? '',
          class_name: placement?.className ?? null,
          kind: row.kind,
          kind_label: SAFETY_FLAG_LABELS[row.kind],
          created_at: row.created_at,
          excerpt: excerptOf(row.body),
          resolved: row.resolved_at !== null,
          resolved_at: row.resolved_at,
          resolved_by_name: row.resolved_by_name,
        };
      });
    // Cờ chưa xử lý lên trước, mới nhất trước
    flags.sort((left, right) => Number(left.resolved) - Number(right.resolved));
    return { pending_count: flags.filter((flag) => !flag.resolved).length, flags };
  }

  async resolve(currentUser: CurrentUser, flagId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const flag = isUuid(flagId)
      ? await this.system
          .selectFrom('ai_tutor_safety_flags')
          .select(['id', 'child_id', 'kind', 'resolved_at'])
          .where('id', '=', flagId)
          .executeTakeFirst()
      : undefined;
    const scope = await this.viewerScope(database, currentUser);
    const placement = flag ? (await this.placements(database, [flag.child_id])).get(flag.child_id) : undefined;
    if (!flag || !this.canSee(scope, placement)) {
      // Cờ của lớp khác cũng trả "không tìm thấy" để không lộ là có
      throw notFoundError('Không tìm thấy cờ cảnh báo', 'ai_tutor_safety_flag');
    }
    if (currentUser.description.support) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Phiên hỗ trợ không đánh dấu cờ cảnh báo');
    }
    if (flag.resolved_at) {
      return { id: flag.id, resolved: true };
    }
    const now = this.clock.now();
    const name = actorNameOf(currentUser);
    await this.system
      .updateTable('ai_tutor_safety_flags')
      .set({ resolved_at: now, resolved_by: currentUser.id, resolved_by_name: name })
      .where('id', '=', flag.id)
      .where('resolved_at', 'is', null)
      .execute();
    await writeAuditLog(database, {
      origin,
      orgUnitId: placement?.orgUnitId ?? null,
      entityName: 'ai_tutor_safety_flags',
      entityId: flag.id,
      action: 'update',
      before: { resolved_at: null },
      after: { resolved_at: now.toISOString(), resolved_by_name: name },
    });
    return { id: flag.id, resolved: true };
  }
}
