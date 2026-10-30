import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ruleViolationError } from '@school-management/server';
import { sql, type Kysely } from 'kysely';
import { queueNotification } from '../common/notification-queue.js';

// Lời nhờ cha mẹ của gia sư AI (YCTD-383 lát L5; bản mẫu MH-596, Eric chọn ngày 2026-10-30): em chưa có gói hoặc đã hết lượt thì bấm
// "Gửi lời nhờ cha mẹ"; cha mẹ, người giám hộ có tài khoản liên kết với em nhận thông báo trong ứng dụng phụ huynh. Quyết định của lát
// (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11):
// - lý do do máy chủ xác định từ số lượt: chưa có gói đang dùng thì nhờ đăng ký, có gói mà hết lượt thì nhờ mua thêm lượt hoặc gia hạn;
//   còn lượt thì không gửi được; em không tự gõ nội dung, thông báo là câu cố định có tên em;
// - mỗi lý do gửi tối đa một lần trong 24 giờ cho mỗi em; lần gửi chính là thông báo đã tạo (không thêm bảng mới);
// - em chưa có cha mẹ có tài khoản thì không tạo thông báo, em được nhắc nói trực tiếp với cha mẹ;
// - gửi được cả khi gia sư đang khóa (thi, bài tập, khung giờ) vì không gọi nhà cung cấp, không dùng lượt; phiên xem hỗ trợ thì không.
export type ParentRequestReason = 'no_plan' | 'no_turns';

export const PARENT_REQUEST_RULE = 'BR-530';
export const PARENT_REQUEST_INTERVAL_HOURS = 24;
const INTERVAL_MS = PARENT_REQUEST_INTERVAL_HOURS * 3_600_000;
const TARGET_TYPE = 'children';

export const PARENT_REQUEST_TEMPLATES: Record<ParentRequestReason, string> = {
  no_plan: 'ai_tutor_parent_request_plan',
  no_turns: 'ai_tutor_parent_request_turns',
};

const VIETNAM_MOMENT = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Asia/Ho_Chi_Minh',
});

// Lý do nhờ cha mẹ theo số lượt của em; còn lượt thì không cần nhờ
export function parentRequestReason(balance: { subscribed: boolean; remaining: number }): ParentRequestReason | null {
  if (!balance.subscribed) {
    return 'no_plan';
  }
  return balance.remaining > 0 ? null : 'no_turns';
}

export function parentRequestNotification(childName: string, reason: ParentRequestReason) {
  return {
    title: 'Gia sư AI: con nhờ cha mẹ',
    body:
      reason === 'no_plan'
        ? `${childName} nhờ cha mẹ đăng ký gói Gia sư AI. Cha mẹ mở mục Gia sư AI của con trong ứng dụng phụ huynh để chọn gói mua qua trường hoặc mua trực tiếp.`
        : `${childName} đã dùng hết lượt hỏi Gia sư AI và nhờ cha mẹ mua thêm lượt hoặc gia hạn gói. Cha mẹ mở mục Gia sư AI của con trong ứng dụng phụ huynh.`,
  };
}

export interface ParentRequestState {
  reason: ParentRequestReason | null;
  guardian_account: boolean;
  last_sent_at: Date | null;
  next_allowed_at: Date | null;
}

type YearClient = Kysely<SchoolYearDatabase>;

@Injectable()
export class AiTutorParentRequestService {
  private async guardianUserIds(database: YearClient, childId: string): Promise<string[]> {
    const rows = await database
      .selectFrom('child_guardians')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .select('guardians.user_id')
      .where('child_guardians.child_id', '=', childId)
      .where('guardians.user_id', 'is not', null)
      .execute();
    return [...new Set(rows.flatMap((row) => (row.user_id ? [row.user_id] : [])))];
  }

  private async lastSent(database: YearClient, childId: string, reason: ParentRequestReason): Promise<Date | null> {
    const row = await database
      .selectFrom('notifications')
      .select('created_at')
      .where('template_code', '=', PARENT_REQUEST_TEMPLATES[reason])
      .where('target_type', '=', TARGET_TYPE)
      .where('target_id', '=', childId)
      .orderBy('created_at', 'desc')
      .executeTakeFirst();
    return row ? new Date(row.created_at) : null;
  }

  async state(
    database: YearClient,
    childId: string,
    balance: { subscribed: boolean; remaining: number },
    now: Date,
  ): Promise<ParentRequestState> {
    const reason = parentRequestReason(balance);
    const [guardians, lastSent] = await Promise.all([
      this.guardianUserIds(database, childId),
      reason ? this.lastSent(database, childId, reason) : Promise.resolve(null),
    ]);
    const nextAllowed = lastSent ? new Date(lastSent.getTime() + INTERVAL_MS) : null;
    return {
      reason,
      guardian_account: guardians.length > 0,
      last_sent_at: lastSent,
      next_allowed_at: nextAllowed && nextAllowed.getTime() > now.getTime() ? nextAllowed : null,
    };
  }

  // Gửi lời nhờ: khóa theo em trong giao dịch để hai lần bấm cùng lúc chỉ tạo một thông báo
  async send(
    database: YearClient,
    childId: string,
    balance: { subscribed: boolean; remaining: number },
    now: Date,
  ): Promise<ParentRequestState & { notified: number }> {
    const reason = parentRequestReason(balance);
    if (!reason) {
      throw ruleViolationError(PARENT_REQUEST_RULE, 'Em còn lượt hỏi nên chưa cần nhờ cha mẹ');
    }
    const notified = await database.transaction().execute(async (transaction) => {
      await sql`select pg_advisory_xact_lock(hashtext(${`ai_tutor_parent_request:${childId}`}))`.execute(transaction);
      const lastSent = await this.lastSent(transaction, childId, reason);
      if (lastSent && lastSent.getTime() + INTERVAL_MS > now.getTime()) {
        throw ruleViolationError(
          PARENT_REQUEST_RULE,
          `Em đã gửi lời nhờ cha mẹ lúc ${VIETNAM_MOMENT.format(lastSent)}. Em gửi lại được sau ${VIETNAM_MOMENT.format(new Date(lastSent.getTime() + INTERVAL_MS))}`,
        );
      }
      const guardians = await this.guardianUserIds(transaction, childId);
      if (guardians.length === 0) {
        throw ruleViolationError(
          PARENT_REQUEST_RULE,
          'Cha mẹ chưa có tài khoản ứng dụng phụ huynh nên chưa nhận được lời nhờ. Em nói trực tiếp với cha mẹ nhé',
        );
      }
      const child = await transaction
        .selectFrom('children')
        .select(['full_name', 'org_unit_id'])
        .where('id', '=', childId)
        .executeTakeFirstOrThrow();
      await queueNotification(transaction, {
        orgUnitId: child.org_unit_id,
        templateCode: PARENT_REQUEST_TEMPLATES[reason],
        ...parentRequestNotification(child.full_name, reason),
        targetType: TARGET_TYPE,
        targetId: childId,
        recipients: guardians.map((userId) => ({ userId, channel: 'in_app' as const })),
      });
      return guardians.length;
    });
    return { ...(await this.state(database, childId, balance, now)), notified };
  }
}
