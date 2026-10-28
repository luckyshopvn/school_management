import { isModuleInPlan, paidFeatureMessage } from '@school-management/shared';
import {
  Inject,
  Injectable,
  Optional,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { JobScheduler } from '../common/job-scheduler.js';
import { currentTenant, isMultiTenantMode } from '@school-management/server';
import type { SchoolYearDatabase } from '@school-management/database';
import { Clock } from '@school-management/server';
import { sql, type Kysely } from 'kysely';
import { SchoolCalendar, VIETNAM_DATE } from '../attendance/school-calendar.js';
import { API_CONFIGURATION, type ApiConfiguration } from '../common/configuration.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification } from '../common/notification-queue.js';
import { SettingsService } from '../settings/settings.service.js';
import { readIntegration } from '../integrations/integrations.js';
import { ZaloSender } from '../integrations/zalo-sender.js';
import { SmsGateway } from './sms-gateway.js';
import { buildPushMessage, pushGroupOf } from './push/push-groups.js';
import { PUSH_SENDER, type PushSender } from './push/push-sender.js';
import { PushSubscriptions } from './push/push-subscriptions.js';

// Tiến trình chạy nền của thông báo (CB-05, CB-07; YCTD-71):
// - thông báo trong ứng dụng chuyển sang đã gửi ngay khi tiến trình nhận;
// - tin nhắn gửi tới số điện thoại phụ huynh của tài khoản nhận; lỗi thì thử lại sau 15 phút, tối đa 5 lần rồi ghi lỗi;
// - mỗi người nhận tối đa 5 tin nhắn thông báo mỗi ngày, tin vượt ghi trạng thái `limited`; mã một lần do dịch vụ định danh
//   gửi nên không tính vào giới hạn này (KT-09);
// - đến giờ nhắc của đơn vị (`journal_reminder_time`), lớp còn trẻ chưa có nhật ký đã công bố trong ngày học thì giáo viên
//   chủ nhiệm và quản lý đơn vị nhận nhắc, mỗi lớp một lần mỗi ngày;
// - kênh zalo (G3-08, YCTD-90): khi nhà trường bật Zalo Official Account và số điện thoại của người nhận đã liên kết thì gửi
//   qua Zalo, không thì gửi tin nhắn theo các quy tắc trên; Zalo lỗi thì gửi ngay bằng tin nhắn. Tin qua Zalo tính chung
//   giới hạn 5 tin mỗi ngày với tin nhắn; `delivered_via` ghi kênh thực tế.
// - kênh push (DT-26 phần 26b, YCTD-232): người nhận trong ứng dụng (tài khoản cụ thể) có đăng ký đẩy còn hiệu lực và chưa tắt nhóm
//   của loại thông báo thì có thêm một dòng người nhận kênh push; gửi tới mọi máy đã đăng ký qua bộ nối PushSender với nội dung không
//   có dữ liệu cá nhân (push-groups.ts); máy báo hết hạn thì thu hồi đăng ký; lỗi tạm thời thử lại như tin nhắn; không tính vào giới
//   hạn tin nhắn trong ngày; cùng người, cùng nhóm đã đẩy trong PUSH_COALESCE_MINUTES (mặc định 5) phút thì gộp (ghi `limited`).
export const MAXIMUM_ATTEMPTS = 5;
export const RETRY_DELAY_MILLISECONDS = 15 * 60_000;
export const DAILY_SMS_LIMIT = 5;
const BATCH_SIZE = 200;
const VIETNAM_TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

@Injectable()
export class NotificationDispatcher implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('NotificationDispatcher');
  private timer: NodeJS.Timeout | null = null;
  private readonly running = new Set<string>();

  constructor(
    @Inject(API_CONFIGURATION) private readonly configuration: ApiConfiguration,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly settings: SettingsService,
    private readonly calendar: SchoolCalendar,
    private readonly sms: SmsGateway,
    private readonly zalo: ZaloSender,
    private readonly clock: Clock,
    private readonly pushSubscriptions: PushSubscriptions,
    @Optional() @Inject(JobScheduler) private readonly scheduler: JobScheduler | null = null,
    @Optional() @Inject(PUSH_SENDER) private readonly pushSender: PushSender | null = null,
  ) {}

  onApplicationBootstrap() {
    // Nhiều trường (DT-SaaS phần S1b): bộ lập lịch gọi tick cho từng trường đang phục vụ, trong ngữ cảnh của trường
    if (isMultiTenantMode()) {
      this.scheduler?.register({
        name: 'notification-dispatch',
        intervalSeconds: this.configuration.notificationDispatchIntervalSeconds ?? 60,
        run: () => this.tick(),
      });
      return;
    }
    const seconds = this.configuration.notificationDispatchIntervalSeconds ?? 60;
    if (seconds > 0) {
      this.timer = setInterval(() => void this.tick(), seconds * 1000);
      this.timer.unref();
    }
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  // Một lượt chạy; lượt trước chưa xong thì bỏ qua lượt này
  async tick(): Promise<void> {
    if (this.running.has(currentTenant()?.code ?? '')) {
      return;
    }
    const tenantKey = currentTenant()?.code ?? '';
    this.running.add(tenantKey);
    try {
      await this.remindJournals();
      await this.dispatchPending();
      if (this.pushSender) {
        await this.pushSubscriptions.cleanup();
      }
    } catch (error) {
      this.logger.error('Tiến trình gửi thông báo lỗi', error instanceof Error ? error.stack : String(error));
    } finally {
      this.running.delete(tenantKey);
    }
  }

  async dispatchPending(): Promise<{ sent: number; retried: number; failed: number; limited: number }> {
    const result = { sent: 0, retried: 0, failed: 0, limited: 0 };
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return result;
    }
    const database = current.database;
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      const pending = await transaction
        .selectFrom('notification_recipients')
        .innerJoin('notifications', 'notifications.id', 'notification_recipients.notification_id')
        .select([
          'notification_recipients.id',
          'notification_recipients.user_id',
          'notification_recipients.channel',
          'notification_recipients.attempt_count',
          'notification_recipients.notification_id',
          'notifications.title',
          'notifications.body',
          'notifications.template_code',
        ])
        .where('notification_recipients.channel_status', '=', 'pending')
        .where((builder) =>
          builder.or([
            builder('notification_recipients.next_attempt_at', 'is', null),
            builder('notification_recipients.next_attempt_at', '<=', now),
          ]),
        )
        .orderBy('notifications.created_at')
        .limit(BATCH_SIZE)
        .forUpdate('notification_recipients')
        .skipLocked()
        .execute();
      const startOfDay = new Date(`${VIETNAM_DATE.format(now)}T00:00:00+07:00`);
      const zaloActive = (await this.zalo.isAvailable()) && (await readIntegration(transaction, 'zalo')).enabled;
      for (const recipient of pending) {
        if (recipient.channel === 'in_app') {
          await transaction
            .updateTable('notification_recipients')
            .set({ channel_status: 'sent', sent_at: now, delivered_via: 'in_app' })
            .where('id', '=', recipient.id)
            .execute();
          result.sent += 1;
          if (
            this.pushSender &&
            recipient.user_id &&
            (await this.pushSubscriptions.hasActive(recipient.user_id)) &&
            (await this.pushSubscriptions.allows(recipient.user_id, recipient.template_code))
          ) {
            await transaction
              .insertInto('notification_recipients')
              .values({ notification_id: recipient.notification_id, user_id: recipient.user_id, channel: 'push' })
              .execute();
          }
          continue;
        }
        if (recipient.channel === 'push') {
          const outcome = await this.dispatchPush(transaction, recipient, now);
          result[outcome] += 1;
          continue;
        }
        const fail = async (message: string) => {
          await transaction
            .updateTable('notification_recipients')
            .set({ channel_status: 'failed', attempt_count: recipient.attempt_count + 1, last_error: message })
            .where('id', '=', recipient.id)
            .execute();
          result.failed += 1;
        };
        // Tin nhắn SMS, Zalo là tính năng trả phí tính theo tin cho trường (YCTD-314, GD-162): gói chưa có thì không gửi, thông báo vẫn
        // đến người nhận qua ứng dụng và thông báo đẩy
        const plan = currentTenant()?.plan;
        if (plan && !isModuleInPlan('sms-zalo', plan.modules)) {
          await transaction
            .updateTable('notification_recipients')
            .set({ channel_status: 'limited', last_error: paidFeatureMessage('sms-zalo') })
            .where('id', '=', recipient.id)
            .execute();
          result.limited += 1;
          continue;
        }
        const phone = recipient.user_id ? await this.phoneOf(transaction, recipient.user_id) : null;
        if (!phone) {
          await fail('Người nhận không có số điện thoại');
          continue;
        }
        const sentToday = await transaction
          .selectFrom('notification_recipients')
          .select(sql<string>`count(*)`.as('count'))
          .where('user_id', '=', recipient.user_id)
          .where('channel', 'in', ['sms', 'zalo'])
          .where('channel_status', '=', 'sent')
          .where('sent_at', '>=', startOfDay)
          .executeTakeFirstOrThrow();
        if (Number(sentToday.count) >= DAILY_SMS_LIMIT) {
          await transaction
            .updateTable('notification_recipients')
            .set({ channel_status: 'limited', last_error: `Đã đủ ${DAILY_SMS_LIMIT} tin nhắn trong ngày` })
            .where('id', '=', recipient.id)
            .execute();
          result.limited += 1;
          continue;
        }
        const text = `${recipient.title}: ${recipient.body}`;
        const follower =
          recipient.channel === 'zalo' && zaloActive
            ? await transaction
                .selectFrom('zalo_followers')
                .select('zalo_user_id')
                .where('phone', '=', phone)
                .executeTakeFirst()
            : undefined;
        let deliveredVia: 'sms' | 'zalo' = 'sms';
        let zaloError: string | null = null;
        if (follower) {
          try {
            await this.zalo.send(follower.zalo_user_id, text);
            deliveredVia = 'zalo';
          } catch (error) {
            zaloError = error instanceof Error ? error.message : String(error);
          }
        }
        try {
          if (deliveredVia === 'sms') {
            await this.sms.send(phone, text);
          }
          await transaction
            .updateTable('notification_recipients')
            .set({
              channel_status: 'sent',
              sent_at: now,
              attempt_count: recipient.attempt_count + 1,
              last_error: zaloError ? `Gửi Zalo lỗi, đã gửi tin nhắn: ${zaloError}` : null,
              delivered_via: deliveredVia,
            })
            .where('id', '=', recipient.id)
            .execute();
          result.sent += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const attempts = recipient.attempt_count + 1;
          if (attempts >= MAXIMUM_ATTEMPTS) {
            await fail(message);
            continue;
          }
          await transaction
            .updateTable('notification_recipients')
            .set({
              attempt_count: attempts,
              last_error: message,
              next_attempt_at: new Date(now.getTime() + RETRY_DELAY_MILLISECONDS),
            })
            .where('id', '=', recipient.id)
            .execute();
          result.retried += 1;
        }
      }
    });
    return result;
  }

  // Gửi một dòng kênh push tới mọi máy của người nhận; trả loại kết quả để cộng vào thống kê
  private async dispatchPush(
    transaction: Kysely<SchoolYearDatabase>,
    recipient: {
      id: string;
      user_id: string | null;
      attempt_count: number;
      notification_id: string;
      template_code: string;
    },
    now: Date,
  ): Promise<'sent' | 'retried' | 'failed' | 'limited'> {
    const mark = (values: Record<string, unknown>) =>
      transaction.updateTable('notification_recipients').set(values).where('id', '=', recipient.id).execute();
    const subscriptions =
      this.pushSender && recipient.user_id ? await this.pushSubscriptions.activeFor(recipient.user_id) : [];
    if (!this.pushSender || subscriptions.length === 0) {
      await mark({ channel_status: 'failed', last_error: 'Người nhận không còn máy đăng ký đẩy' });
      return 'failed';
    }
    const coalesceMinutes = this.configuration.push?.coalesceMinutes ?? 5;
    if (coalesceMinutes > 0 && recipient.attempt_count === 0) {
      const group = pushGroupOf(recipient.template_code).code;
      const recent = await transaction
        .selectFrom('notification_recipients')
        .innerJoin('notifications', 'notifications.id', 'notification_recipients.notification_id')
        .select('notifications.template_code')
        .where('notification_recipients.user_id', '=', recipient.user_id)
        .where('notification_recipients.channel', '=', 'push')
        .where('notification_recipients.delivered_via', '=', 'push')
        .where('notification_recipients.sent_at', '>=', new Date(now.getTime() - coalesceMinutes * 60_000))
        .execute();
      if (recent.some((row) => pushGroupOf(row.template_code).code === group)) {
        await mark({
          channel_status: 'limited',
          last_error: `Gộp với thông báo cùng nhóm đã đẩy trong ${coalesceMinutes} phút`,
        });
        return 'limited';
      }
    }
    const message = buildPushMessage({
      notificationId: recipient.notification_id,
      templateCode: recipient.template_code,
      schoolName: this.pushSubscriptions.schoolName(),
    });
    const credentials = await this.pushSubscriptions.credentials();
    let delivered = 0;
    let available = 0;
    let lastError: string | null = null;
    for (const subscription of subscriptions) {
      try {
        // Ứng dụng cài đặt mở đúng trường khi chạm thông báo: kèm địa chỉ gốc của ứng dụng lúc đăng ký
        const outcome = await this.pushSender.send(
          subscription.target,
          subscription.origin ? { ...message, data: { ...message.data, app_url: subscription.origin } } : message,
          credentials,
        );
        if (outcome === 'unavailable') {
          continue;
        }
        available += 1;
        await this.pushSubscriptions.recordOutcome(subscription.id, outcome);
        if (outcome === 'sent') {
          delivered += 1;
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        await this.pushSubscriptions.recordOutcome(subscription.id, 'error');
      }
    }
    const attempts = recipient.attempt_count + 1;
    if (delivered > 0) {
      await mark({
        channel_status: 'sent',
        sent_at: now,
        attempt_count: attempts,
        delivered_via: 'push',
        last_error: lastError,
      });
      return 'sent';
    }
    if (!lastError) {
      await mark({
        channel_status: 'failed',
        attempt_count: attempts,
        last_error: available === 0 ? 'Chưa bật bộ nối đẩy cho các máy đã đăng ký' : 'Mọi máy đăng ký đẩy đã hết hạn',
      });
      return 'failed';
    }
    if (attempts >= MAXIMUM_ATTEMPTS) {
      await mark({ channel_status: 'failed', attempt_count: attempts, last_error: lastError });
      return 'failed';
    }
    await mark({
      attempt_count: attempts,
      last_error: lastError,
      next_attempt_at: new Date(now.getTime() + RETRY_DELAY_MILLISECONDS),
    });
    return 'retried';
  }

  async remindJournals(): Promise<number> {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return 0;
    }
    const database = current.database;
    const now = this.clock.now();
    const today = VIETNAM_DATE.format(now);
    const time = VIETNAM_TIME.format(now);
    const classes = await database
      .selectFrom('classes')
      .select(['id', 'org_unit_id', 'name'])
      .where('status', '=', 'active')
      .execute();
    const reminderTimes = new Map<string, string | null>();
    let reminded = 0;
    let schoolDay: boolean | undefined;
    for (const classRecord of classes) {
      if (!reminderTimes.has(classRecord.org_unit_id)) {
        const setting = (await this.settings.effective(classRecord.org_unit_id)).find(
          (item) => item.key === 'journal_reminder_time',
        );
        reminderTimes.set(classRecord.org_unit_id, typeof setting?.value === 'string' ? setting.value : null);
      }
      const reminderTime = reminderTimes.get(classRecord.org_unit_id);
      if (!reminderTime || time < reminderTime) {
        continue;
      }
      schoolDay ??= (await this.calendar.reasonNotSchoolDay(today)) === null;
      if (!schoolDay) {
        return 0;
      }
      if (await this.alreadyReminded(database, classRecord.id, today)) {
        continue;
      }
      const missing = await database
        .selectFrom('class_enrollments')
        .leftJoin('daily_journals', (join) =>
          join
            .onRef('daily_journals.child_id', '=', 'class_enrollments.child_id')
            .on('daily_journals.journal_date', '=', today)
            .on('daily_journals.status', '=', 'published'),
        )
        .select(sql<string>`count(*)`.as('count'))
        .where('class_enrollments.class_id', '=', classRecord.id)
        .where('class_enrollments.is_current', '=', true)
        .where('daily_journals.id', 'is', null)
        .executeTakeFirstOrThrow();
      if (Number(missing.count) === 0) {
        continue;
      }
      const homeroom = await database
        .selectFrom('class_staff_assignments')
        .select('staff_user_id')
        .where('class_id', '=', classRecord.id)
        .where('assignment_role', '=', 'homeroom')
        .where('status', '=', 'active')
        .execute();
      await queueNotification(database, {
        orgUnitId: classRecord.org_unit_id,
        templateCode: 'journal_reminder',
        title: 'Nhắc ghi nhật ký',
        body: `Lớp ${classRecord.name} còn ${missing.count} trẻ chưa có nhật ký ngày ${today}`,
        targetType: 'classes',
        targetId: classRecord.id,
        recipients: [
          ...homeroom.map((row) => ({ userId: row.staff_user_id, channel: 'in_app' as const })),
          { roleCode: 'VT-03', orgUnitId: classRecord.org_unit_id, channel: 'in_app' as const },
        ],
      });
      reminded += 1;
    }
    return reminded;
  }

  private async alreadyReminded(database: Kysely<SchoolYearDatabase>, classId: string, today: string) {
    const existing = await database
      .selectFrom('notifications')
      .select('id')
      .where('template_code', '=', 'journal_reminder')
      .where('target_id', '=', classId)
      .where('created_at', '>=', new Date(`${today}T00:00:00+07:00`))
      .executeTakeFirst();
    return existing !== undefined;
  }

  private async phoneOf(database: Kysely<SchoolYearDatabase>, userId: string): Promise<string | null> {
    const guardian = await database
      .selectFrom('guardians')
      .select('phone')
      .where('user_id', '=', userId)
      .where('phone', 'is not', null)
      .executeTakeFirst();
    return guardian?.phone ?? null;
  }
}
