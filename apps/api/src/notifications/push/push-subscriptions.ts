import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Optional,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import {
  parseApnsKey,
  parseFcmServiceAccount,
  readActiveVapidKeys,
  readNativePushCredentials,
  type NativePushCredentials,
  type PushSubscriptionApp,
  type SystemDatabase,
  type TenancyRuntime,
} from '@school-management/database';
import { Clock, currentTenant, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Kysely } from 'kysely';
import { AuthenticatedUser, PublicEndpoint, RequirePermission } from '../../authentication/authentication.guard.js';
import type { CurrentUser } from '../../authentication/current-user.js';
import { API_CONFIGURATION, TENANCY_RUNTIME, type ApiConfiguration } from '../../common/configuration.js';
import { Databases } from '../../common/databases.js';
import { decryptSecret, encryptSecret } from '../../common/secret-encryption.js';
import { notFoundError, type RequestBody } from '../../common/request-fields.js';
import { uuidParameter } from '../../common/uuid-parameter.js';
import { isPushGroupCode, PUSH_GROUPS, pushGroupOf } from './push-groups.js';
import type { PushCredentials, PushTarget, VapidCredentials } from './push-transport.js';

// Đăng ký thông báo đẩy và tuỳ chọn theo nhóm (DT-26 phần 26b, YCTD-232; tài liệu 32 mục 18):
// - mỗi người dùng nhiều máy; địa chỉ đăng ký và khóa nhận lưu mã hóa bằng khóa của trường, mã băm có khóa để chống trùng; một địa
//   chỉ còn hiệu lực chỉ thuộc một người (máy dùng chung đổi người thì đăng ký của người trước bị thu hồi);
// - đăng xuất: ứng dụng gọi `POST /push/subscriptions/unsubscribe` với địa chỉ của máy trước khi đăng xuất;
// - tuỳ chọn tắt theo nhóm chỉ áp cho kênh đẩy (thông báo trong ứng dụng vẫn có); loại do quản trị trường đánh dấu khẩn không tắt được;
// - khóa công khai VAPID trả qua điểm cuối công khai: nhiều trường đọc ở cơ sở dữ liệu nền tảng (khóa của nền tảng), một trường lấy
//   từ cấu hình.
// Đẩy gốc (phần 26g, YCTD-237): ứng dụng cài đặt gửi mã thiết bị FCM (Android) hoặc APNs (iOS) qua cùng điểm cuối với `kind`, `token`;
// mã thiết bị lưu mã hóa ở cột địa chỉ đăng ký, mã băm có khóa theo loại và mã; `origin` là địa chỉ gốc của ứng dụng web của trường
// trên máy (gửi kèm trong nội dung đẩy để ứng dụng mở đúng trường khi chạm thông báo). Khóa FCM, APNs của nền tảng đọc ở cơ sở dữ liệu
// nền tảng (giữ 5 phút) hoặc tệp khóa của bản một trường.
const APPS: readonly PushSubscriptionApp[] = ['teacher', 'parent', 'student'];
const MAXIMUM_ENDPOINT_LENGTH = 1024;
const MAXIMUM_DEVICES = 20;
const VAPID_CACHE_MILLISECONDS = 5 * 60_000;
type NativeKind = 'fcm' | 'apns';
const TOKEN_PATTERNS: Record<NativeKind, RegExp> = {
  // Mã đăng ký FCM: chữ, số, dấu hai chấm, gạch dưới, gạch ngang (thường khoảng 160 ký tự)
  fcm: /^[A-Za-z0-9_:-]{32,1024}$/,
  // Mã thiết bị APNs: chuỗi thập lục phân (32 byte trở lên)
  apns: /^[0-9a-f]{64,200}$/,
};

function nativeKind(value: unknown): NativeKind | null {
  return value === 'fcm' || value === 'apns' ? value : null;
}

function base64UrlBytes(value: string): number {
  return /^[A-Za-z0-9_-]+={0,2}$/.test(value) ? Buffer.from(value, 'base64url').length : -1;
}

export interface ActiveSubscription {
  id: string;
  target: PushTarget;
  // Địa chỉ gốc của ứng dụng lúc đăng ký (đẩy gốc dùng để mở đúng trường)
  origin: string | null;
}

interface Registration {
  kind: 'web_push' | NativeKind;
  hash: string;
  endpointEncrypted: string;
  keysEncrypted: string;
  app: PushSubscriptionApp;
  label: string;
  origin: string | null;
}

@Injectable()
export class PushSubscriptions {
  private vapidCache: { at: number; keys: VapidCredentials | null } | null = null;
  private nativeCache: { at: number; credentials: NativePushCredentials } | null = null;

  constructor(
    @Inject(API_CONFIGURATION) private readonly configuration: ApiConfiguration,
    private readonly databases: Databases,
    private readonly clock: Clock,
    @Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null = null,
  ) {}

  private get system(): Kysely<SystemDatabase> {
    return this.databases.system;
  }

  private hash(endpoint: string): string {
    return createHmac('sha256', this.configuration.childDataHashKey).update(`push:${endpoint}`).digest('hex');
  }

  enabled(): boolean {
    return Boolean(this.configuration.push?.provider || this.configuration.push?.nativeProvider);
  }

  // Khóa FCM, APNs đang dùng; nhiều trường đọc ở cơ sở dữ liệu nền tảng (giữ 5 phút), một trường đọc tệp khóa một lần. Bộ giả lập
  // không cần khóa: trả khóa giả để bộ nối giả lập nhận gửi
  async native(): Promise<NativePushCredentials> {
    const push = this.configuration.push;
    if (!push?.nativeProvider) {
      return { fcm: null, apns: null };
    }
    const now = this.clock.now().getTime();
    if (this.nativeCache && (!this.tenancy || now - this.nativeCache.at < VAPID_CACHE_MILLISECONDS)) {
      return this.nativeCache.credentials;
    }
    let credentials: NativePushCredentials;
    if (push.nativeProvider === 'development') {
      credentials = {
        fcm: { projectId: 'gia-lap', clientEmail: 'gia-lap@example.test', privateKey: '' },
        apns: {
          keyId: 'GIALAP0000',
          teamId: 'GIALAP0000',
          bundleId: 'gia.lap',
          privateKey: '',
          environment: 'sandbox',
        },
      };
    } else if (this.tenancy) {
      credentials = await readNativePushCredentials(this.tenancy.platform, this.tenancy.configuration.masterKey);
    } else {
      credentials = {
        fcm: push.fcmServiceAccountFile
          ? parseFcmServiceAccount(await readFile(push.fcmServiceAccountFile, 'utf8'))
          : null,
        apns: push.apnsKeyFile
          ? parseApnsKey({
              privateKey: await readFile(push.apnsKeyFile, 'utf8'),
              keyId: push.apnsKeyId ?? '',
              teamId: push.apnsTeamId ?? '',
              bundleId: push.apnsBundleId ?? '',
              environment: push.apnsEnvironment,
            })
          : null,
      };
    }
    this.nativeCache = { at: now, credentials };
    return credentials;
  }

  // Khóa của mọi bộ nối cho tiến trình gửi
  async credentials(): Promise<PushCredentials> {
    const [vapid, native] = await Promise.all([this.configuration.push?.provider ? this.vapid() : null, this.native()]);
    return { vapid, fcm: native.fcm, apns: native.apns };
  }

  // Khóa VAPID đang dùng; nhiều trường đọc ở cơ sở dữ liệu nền tảng (giữ 5 phút), một trường lấy từ cấu hình
  async vapid(): Promise<VapidCredentials | null> {
    const push = this.configuration.push;
    if (!this.tenancy) {
      return push?.vapidPublicKey && push.vapidPrivateKey && push.vapidSubject
        ? { publicKey: push.vapidPublicKey, privateKey: push.vapidPrivateKey, subject: push.vapidSubject }
        : null;
    }
    const now = this.clock.now().getTime();
    if (this.vapidCache && now - this.vapidCache.at < VAPID_CACHE_MILLISECONDS) {
      return this.vapidCache.keys;
    }
    const keys = await readActiveVapidKeys(this.tenancy.platform, this.tenancy.configuration.masterKey);
    this.vapidCache = { at: now, keys };
    return keys;
  }

  async publicKey() {
    const keys = this.configuration.push?.provider ? await this.vapid() : null;
    const native = await this.native();
    return {
      enabled: Boolean(keys),
      public_key: keys?.publicKey ?? null,
      // Ứng dụng cài đặt chỉ xin quyền, lấy mã thiết bị khi bộ nối của nền tảng máy đã có khóa
      native: { fcm: Boolean(native.fcm), apns: Boolean(native.apns) },
    };
  }

  async list(currentUser: CurrentUser) {
    const rows = await this.system
      .selectFrom('push_subscriptions')
      .select(['id', 'app', 'kind', 'device_label', 'origin', 'created_at', 'last_seen_at', 'last_success_at'])
      .where('user_id', '=', currentUser.id)
      .where('revoked_at', 'is', null)
      .orderBy('last_seen_at', 'desc')
      .execute();
    return { enabled: this.enabled(), items: rows };
  }

  async subscribe(currentUser: CurrentUser, body: RequestBody) {
    const kind = nativeKind(body?.kind);
    if (kind) {
      return this.subscribeNative(currentUser, body, kind);
    }
    const errors: FieldError[] = [];
    const endpoint = typeof body?.endpoint === 'string' ? body.endpoint.trim() : '';
    const keys = (body?.keys ?? {}) as Record<string, unknown>;
    const p256dh = typeof keys.p256dh === 'string' ? keys.p256dh : '';
    const auth = typeof keys.auth === 'string' ? keys.auth : '';
    const app = body?.app;
    const label = typeof body?.device_label === 'string' ? body.device_label.trim().slice(0, 80) : '';
    const url = URL.canParse(endpoint) ? new URL(endpoint) : null;
    if (!url || url.protocol !== 'https:' || endpoint.length > MAXIMUM_ENDPOINT_LENGTH) {
      errors.push({ field: 'endpoint', message: 'Địa chỉ đăng ký đẩy phải là https, tối đa 1024 ký tự' });
    }
    if (base64UrlBytes(p256dh) !== 65 || base64UrlBytes(auth) !== 16) {
      errors.push({ field: 'keys', message: 'Khóa nhận đẩy không đúng (p256dh 65 byte, auth 16 byte, base64url)' });
    }
    if (typeof app !== 'string' || !APPS.includes(app as PushSubscriptionApp)) {
      errors.push({ field: 'app', message: 'Ứng dụng là teacher, parent hoặc student' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.register(currentUser, {
      kind: 'web_push',
      hash: this.hash(endpoint),
      endpointEncrypted: encryptSecret(this.configuration.childDataEncryptionKey, endpoint),
      keysEncrypted: encryptSecret(this.configuration.childDataEncryptionKey, JSON.stringify({ p256dh, auth })),
      app: app as PushSubscriptionApp,
      label,
      origin: typeof body?.origin === 'string' ? body.origin.slice(0, 255) : null,
    });
  }

  // Ứng dụng cài đặt: mã thiết bị FCM hoặc APNs; `origin` là địa chỉ gốc của ứng dụng web của trường đang mở trong ứng dụng
  private async subscribeNative(currentUser: CurrentUser, body: RequestBody, kind: NativeKind) {
    const errors: FieldError[] = [];
    const raw = typeof body?.token === 'string' ? body.token.trim() : '';
    const token = kind === 'apns' ? raw.toLowerCase() : raw;
    const app = body?.app;
    const label = typeof body?.device_label === 'string' ? body.device_label.trim().slice(0, 80) : '';
    const origin = typeof body?.origin === 'string' ? body.origin.trim() : '';
    if (!TOKEN_PATTERNS[kind].test(token)) {
      errors.push({
        field: 'token',
        message: kind === 'fcm' ? 'Mã thiết bị FCM không đúng' : 'Mã thiết bị APNs không đúng',
      });
    }
    if (typeof app !== 'string' || !APPS.includes(app as PushSubscriptionApp)) {
      errors.push({ field: 'app', message: 'Ứng dụng là teacher, parent hoặc student' });
    }
    const url = URL.canParse(origin) ? new URL(origin) : null;
    if (!url || !['https:', 'http:'].includes(url.protocol) || origin.length > 255) {
      errors.push({ field: 'origin', message: 'Địa chỉ ứng dụng của trường là http hoặc https, tối đa 255 ký tự' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.register(currentUser, {
      kind,
      hash: this.hash(`${kind}:${token}`),
      endpointEncrypted: encryptSecret(this.configuration.childDataEncryptionKey, token),
      keysEncrypted: encryptSecret(this.configuration.childDataEncryptionKey, '{}'),
      app: app as PushSubscriptionApp,
      label,
      origin,
    });
  }

  private async register(currentUser: CurrentUser, registration: Registration) {
    const now = this.clock.now();
    const { hash, label, origin } = registration;
    return this.system.transaction().execute(async (transaction) => {
      const existing = await transaction
        .selectFrom('push_subscriptions')
        .select(['id', 'user_id'])
        .where('endpoint_hash', '=', hash)
        .where('revoked_at', 'is', null)
        .executeTakeFirst();
      if (existing && existing.user_id === currentUser.id) {
        await transaction
          .updateTable('push_subscriptions')
          .set({
            keys_encrypted: registration.keysEncrypted,
            app: registration.app,
            last_seen_at: now,
            failure_count: 0,
            ...(label ? { device_label: label } : {}),
            ...(origin ? { origin } : {}),
          })
          .where('id', '=', existing.id)
          .execute();
        return { id: existing.id, created: false };
      }
      if (existing) {
        await transaction
          .updateTable('push_subscriptions')
          .set({ revoked_at: now, revoked_reason: 'reassigned' })
          .where('id', '=', existing.id)
          .execute();
      }
      const active = await transaction
        .selectFrom('push_subscriptions')
        .select(['id'])
        .where('user_id', '=', currentUser.id)
        .where('revoked_at', 'is', null)
        .orderBy('last_seen_at', 'asc')
        .execute();
      // Giữ tối đa 20 máy mỗi người: máy lâu không thấy nhất bị thu hồi
      const overflow = active.slice(0, Math.max(0, active.length - MAXIMUM_DEVICES + 1)).map((row) => row.id);
      if (overflow.length > 0) {
        await transaction
          .updateTable('push_subscriptions')
          .set({ revoked_at: now, revoked_reason: 'device-limit' })
          .where('id', 'in', overflow)
          .execute();
      }
      const created = await transaction
        .insertInto('push_subscriptions')
        .values({
          user_id: currentUser.id,
          app: registration.app,
          kind: registration.kind,
          endpoint_hash: hash,
          endpoint_encrypted: registration.endpointEncrypted,
          keys_encrypted: registration.keysEncrypted,
          origin,
          device_label: label || null,
          last_seen_at: now,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      return { id: created.id, created: true };
    });
  }

  async revoke(currentUser: CurrentUser, id: string) {
    const updated = await this.system
      .updateTable('push_subscriptions')
      .set({ revoked_at: this.clock.now(), revoked_reason: 'user' })
      .where('id', '=', id)
      .where('user_id', '=', currentUser.id)
      .where('revoked_at', 'is', null)
      .executeTakeFirst();
    if (Number(updated.numUpdatedRows) === 0) {
      throw notFoundError('Không tìm thấy máy đã đăng ký', 'push_subscription');
    }
    return { id, revoked: true };
  }

  // Đăng xuất trên máy: thu hồi đăng ký của địa chỉ (hoặc mã thiết bị `kind`, `token` của ứng dụng cài đặt) này, chỉ của chính
  // người gọi
  async unsubscribe(currentUser: CurrentUser, body: RequestBody) {
    const kind = nativeKind(body?.kind);
    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    const endpoint =
      kind && token
        ? `${kind}:${kind === 'apns' ? token.toLowerCase() : token}`
        : typeof body?.endpoint === 'string'
          ? body.endpoint.trim()
          : '';
    if (!endpoint) {
      throw validationError([{ field: 'endpoint', message: 'Bắt buộc nhập' }]);
    }
    const updated = await this.system
      .updateTable('push_subscriptions')
      .set({ revoked_at: this.clock.now(), revoked_reason: 'logout' })
      .where('endpoint_hash', '=', this.hash(endpoint))
      .where('user_id', '=', currentUser.id)
      .where('revoked_at', 'is', null)
      .executeTakeFirst();
    return { revoked: Number(updated.numUpdatedRows) > 0 };
  }

  // Đăng ký còn hiệu lực của một người (giải mã để gửi); dùng ở tiến trình gửi
  async activeFor(userId: string): Promise<ActiveSubscription[]> {
    const rows = await this.system
      .selectFrom('push_subscriptions')
      .select(['id', 'kind', 'origin', 'endpoint_encrypted', 'keys_encrypted'])
      .where('user_id', '=', userId)
      .where('revoked_at', 'is', null)
      .execute();
    const key = this.configuration.childDataEncryptionKey;
    return rows.map((row): ActiveSubscription => {
      const endpoint = decryptSecret(key, row.endpoint_encrypted);
      const target: PushTarget =
        row.kind === 'web_push'
          ? {
              kind: 'web_push',
              endpoint,
              keys: JSON.parse(decryptSecret(key, row.keys_encrypted)) as { p256dh: string; auth: string },
            }
          : { kind: row.kind, token: endpoint };
      return { id: row.id, origin: row.origin, target };
    });
  }

  async hasActive(userId: string): Promise<boolean> {
    const row = await this.system
      .selectFrom('push_subscriptions')
      .select('id')
      .where('user_id', '=', userId)
      .where('revoked_at', 'is', null)
      .executeTakeFirst();
    return row !== undefined;
  }

  async recordOutcome(id: string, outcome: 'sent' | 'expired' | 'error'): Promise<void> {
    const now = this.clock.now();
    const query = this.system.updateTable('push_subscriptions').where('id', '=', id);
    if (outcome === 'sent') {
      await query.set({ last_success_at: now, failure_count: 0 }).execute();
    } else if (outcome === 'expired') {
      await query.set({ revoked_at: now, revoked_reason: 'expired' }).where('revoked_at', 'is', null).execute();
    } else {
      await query.set((builder) => ({ failure_count: builder('failure_count', '+', 1) })).execute();
    }
  }

  // Đăng ký không thấy quá số ngày cấu hình (mặc định 90) thì thu hồi
  async cleanup(): Promise<number> {
    const days = this.configuration.push?.subscriptionRetentionDays ?? 90;
    if (days <= 0) {
      return 0;
    }
    const before = new Date(this.clock.now().getTime() - days * 86_400_000);
    const result = await this.system
      .updateTable('push_subscriptions')
      .set({ revoked_at: this.clock.now(), revoked_reason: 'stale' })
      .where('revoked_at', 'is', null)
      .where('last_seen_at', '<', before)
      .executeTakeFirst();
    return Number(result.numUpdatedRows);
  }

  // Người dùng có nhận đẩy cho loại thông báo này không: loại khẩn luôn nhận; còn lại theo tuỳ chọn của nhóm (mặc định bật)
  async allows(userId: string, templateCode: string): Promise<boolean> {
    const urgent = await this.system
      .selectFrom('notification_urgent_templates')
      .select('template_code')
      .where('template_code', '=', templateCode)
      .executeTakeFirst();
    if (urgent) {
      return true;
    }
    const preference = await this.system
      .selectFrom('notification_preferences')
      .select('push_enabled')
      .where('user_id', '=', userId)
      .where('group_code', '=', pushGroupOf(templateCode).code)
      .executeTakeFirst();
    return preference?.push_enabled ?? true;
  }

  async preferences(currentUser: CurrentUser) {
    const rows = await this.system
      .selectFrom('notification_preferences')
      .select(['group_code', 'push_enabled'])
      .where('user_id', '=', currentUser.id)
      .execute();
    const saved = new Map(rows.map((row) => [row.group_code, row.push_enabled]));
    return {
      groups: PUSH_GROUPS.map((group) => ({
        code: group.code,
        label: group.label,
        push_enabled: saved.get(group.code) ?? true,
      })),
    };
  }

  async updatePreferences(currentUser: CurrentUser, body: RequestBody) {
    const groups = body?.groups;
    if (!groups || typeof groups !== 'object' || Array.isArray(groups)) {
      throw validationError([{ field: 'groups', message: 'Gửi { groups: { <mã nhóm>: true|false } }' }]);
    }
    const entries = Object.entries(groups as Record<string, unknown>);
    const invalid = entries.filter(([code, value]) => !isPushGroupCode(code) || typeof value !== 'boolean');
    if (invalid.length > 0) {
      throw validationError(
        invalid.map(([code]) => ({
          field: `groups.${code}`,
          message: 'Nhóm không có hoặc giá trị không phải đúng sai',
        })),
      );
    }
    const now = this.clock.now();
    for (const [code, value] of entries) {
      await this.system
        .insertInto('notification_preferences')
        .values({ user_id: currentUser.id, group_code: code, push_enabled: value as boolean, updated_at: now })
        .onConflict((conflict) =>
          conflict.columns(['user_id', 'group_code']).doUpdateSet({ push_enabled: value as boolean, updated_at: now }),
        )
        .execute();
    }
    return this.preferences(currentUser);
  }

  async urgentTemplates() {
    const rows = await this.system
      .selectFrom('notification_urgent_templates')
      .select(['template_code', 'marked_by_name', 'marked_at'])
      .orderBy('template_code')
      .execute();
    return { items: rows };
  }

  async setUrgentTemplates(currentUser: CurrentUser, body: RequestBody) {
    const codes = body?.template_codes;
    if (
      !Array.isArray(codes) ||
      codes.length > 100 ||
      codes.some((code) => typeof code !== 'string' || !/^[a-z0-9_]{2,80}$/.test(code))
    ) {
      throw validationError([{ field: 'template_codes', message: 'Danh sách mã loại thông báo (tối đa 100)' }]);
    }
    const unique = [...new Set(codes as string[])];
    await this.system.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('notification_urgent_templates').execute();
      if (unique.length > 0) {
        await transaction
          .insertInto('notification_urgent_templates')
          .values(
            unique.map((code) => ({
              template_code: code,
              marked_by: currentUser.id,
              marked_by_name: currentUser.description.full_name,
            })),
          )
          .execute();
      }
    });
    return this.urgentTemplates();
  }

  // Tên trường trong nội dung đẩy: tên của trường ở chế độ nhiều trường
  schoolName(): string | null {
    return currentTenant()?.name ?? null;
  }
}

@Controller('public/push')
@PublicEndpoint()
export class PublicPushController {
  constructor(private readonly subscriptions: PushSubscriptions) {}

  // Khóa công khai VAPID cho giao diện đăng ký đẩy; chưa bật đẩy thì `enabled: false`
  @Get('vapid-public-key')
  publicKey() {
    return this.subscriptions.publicKey();
  }
}

@Controller('push')
export class PushController {
  constructor(private readonly subscriptions: PushSubscriptions) {}

  @Get('subscriptions')
  list(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.subscriptions.list(currentUser);
  }

  @Post('subscriptions')
  @HttpCode(200)
  subscribe(@AuthenticatedUser() currentUser: CurrentUser, @Body() body: RequestBody) {
    return this.subscriptions.subscribe(currentUser, body);
  }

  @Post('subscriptions/unsubscribe')
  @HttpCode(200)
  unsubscribe(@AuthenticatedUser() currentUser: CurrentUser, @Body() body: RequestBody) {
    return this.subscriptions.unsubscribe(currentUser, body);
  }

  @Delete('subscriptions/:id')
  revoke(
    @AuthenticatedUser() currentUser: CurrentUser,
    @Param('id', uuidParameter('Mã máy đã đăng ký không đúng')) id: string,
  ) {
    return this.subscriptions.revoke(currentUser, id);
  }

  @Get('preferences')
  preferences(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.subscriptions.preferences(currentUser);
  }

  @Put('preferences')
  updatePreferences(@AuthenticatedUser() currentUser: CurrentUser, @Body() body: RequestBody) {
    return this.subscriptions.updatePreferences(currentUser, body);
  }

  @Get('urgent-templates')
  @RequirePermission(PERMISSION_CODES.settingManage)
  urgentTemplates() {
    return this.subscriptions.urgentTemplates();
  }

  @Put('urgent-templates')
  @RequirePermission(PERMISSION_CODES.settingManage)
  setUrgentTemplates(@AuthenticatedUser() currentUser: CurrentUser, @Body() body: RequestBody) {
    return this.subscriptions.setUrgentTemplates(currentUser, body);
  }
}
