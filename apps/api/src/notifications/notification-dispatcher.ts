import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
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
  private running = false;

  constructor(
    @Inject(API_CONFIGURATION) private readonly configuration: ApiConfiguration,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly settings: SettingsService,
    private readonly calendar: SchoolCalendar,
    private readonly sms: SmsGateway,
    private readonly zalo: ZaloSender,
    private readonly clock: Clock,
  ) {}

  onApplicationBootstrap() {
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
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      await this.remindJournals();
      await this.dispatchPending();
    } catch (error) {
      this.logger.error('Tiến trình gửi thông báo lỗi', error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
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
          'notifications.title',
          'notifications.body',
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
      const zaloActive = this.zalo.available && (await readIntegration(transaction, 'zalo')).enabled;
      for (const recipient of pending) {
        if (recipient.channel === 'in_app') {
          await transaction
            .updateTable('notification_recipients')
            .set({ channel_status: 'sent', sent_at: now, delivered_via: 'in_app' })
            .where('id', '=', recipient.id)
            .execute();
          result.sent += 1;
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
