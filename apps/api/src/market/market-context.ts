import { Inject, Injectable, Optional, type OnModuleDestroy } from '@nestjs/common';
import {
  createMarketplaceConnection,
  readMarketSettings,
  type MarketAccountKind,
  type MarketplaceDatabase,
  type MarketSettings,
  type PlatformDatabase,
  type TenancyRuntime,
} from '@school-management/database';
import {
  ApplicationError,
  Clock,
  extractTenantHost,
  normalizeHost,
  PlatformOperatorTokenVerifier,
  readBearerToken,
  unauthenticatedError,
} from '@school-management/server';
import type { Request } from 'express';
import type { Kysely } from 'kysely';
import { API_CONFIGURATION, TENANCY_RUNTIME, type ApiConfiguration } from '../common/configuration.js';
import { hashSessionToken } from './market-tokens.js';

// Ngữ cảnh của chợ gia sư ở máy chủ API (DT-27 phần 27f, YCTD-256; tài liệu 32 mục 19.3, 19.5). Claude tự chọn theo ủy quyền của Eric
// ngày 2026-10-11:
// - điểm cuối nằm ở `/api/v1/market/*`, đường dẫn không cần trường (như `/api/v1/parent-org/*`): không có ngữ cảnh trường nên không
//   với tới được cơ sở dữ liệu của trường nào (`Databases` ném lỗi khi thiếu trường);
// - kết nối riêng tới cơ sở dữ liệu `marketplace` bằng vai trò `marketplace` (MARKETPLACE_DATABASE_URL), vai trò này không có quyền
//   trên cơ sở dữ liệu của trường; chỉ chạy ở chế độ nhiều trường (cấu hình chợ nằm ở cơ sở dữ liệu nền tảng);
// - phần của người dùng chợ chỉ phục vụ ở tên miền dành riêng của chợ khi chợ bật; phần quản trị chỉ phục vụ ở tên miền của cổng nền
//   tảng với mã phiên vận hành. Tên miền khác (kể cả của trường) 404, không lộ là chợ có tồn tại;
// - phiên của chợ là chuỗi ngẫu nhiên (bảng market_sessions), không phải mã phiên ký của trường
export const MARKET_PATH_PREFIX = '/api/v1/market/';

export function marketNotFound(): ApplicationError {
  return new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy');
}

export interface MarketAccount {
  id: string;
  kind: 'parent' | 'tutor';
  display_name: string;
  status: 'pending' | 'active' | 'locked' | 'closed';
}

@Injectable()
export class MarketContext implements OnModuleDestroy {
  private marketplace: Kysely<MarketplaceDatabase> | null = null;
  private readonly operators: PlatformOperatorTokenVerifier;

  constructor(
    @Inject(API_CONFIGURATION) private readonly configuration: ApiConfiguration,
    private readonly clock: Clock,
    @Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null = null,
  ) {
    this.operators = new PlatformOperatorTokenVerifier(
      configuration.tokenPublicKeyPem,
      configuration.tokenPreviousPublicKeyPem ?? null,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.marketplace?.destroy();
    this.marketplace = null;
  }

  // Chợ chạy được khi có nền tảng nhiều trường và có kết nối marketplace; thiếu một trong hai thì mọi điểm cuối của chợ 404
  get available(): boolean {
    return Boolean(this.tenancy && this.configuration.marketplaceDatabaseUrl);
  }

  get platform(): Kysely<PlatformDatabase> {
    if (!this.tenancy) {
      throw marketNotFound();
    }
    return this.tenancy.platform;
  }

  get database(): Kysely<MarketplaceDatabase> {
    const url = this.configuration.marketplaceDatabaseUrl;
    if (!this.tenancy || !url) {
      throw marketNotFound();
    }
    this.marketplace ??= createMarketplaceConnection(url);
    return this.marketplace;
  }

  now(): Date {
    return this.clock.now();
  }

  settings(): Promise<MarketSettings> {
    return readMarketSettings(this.platform);
  }

  private hostOf(request: Request): string | undefined {
    const tenancy = this.tenancy;
    if (!tenancy) {
      return undefined;
    }
    return extractTenantHost(
      request.headers,
      tenancy.configuration.hostSource,
      tenancy.configuration.edgeSecret ?? undefined,
    );
  }

  // Phần của người dùng chợ: chợ bật và đúng một trong hai tên miền dành riêng; tên miền của chợ là ứng dụng phụ huynh, tên miền của
  // ứng dụng Gia sư là của gia sư (YCTD-262). Trả cấu hình và vai của tên miền để bên gọi dùng tiếp
  async assertMarketHost(request: Request): Promise<{ settings: MarketSettings; kind: MarketAccountKind }> {
    if (!this.available) {
      throw marketNotFound();
    }
    const settings = await this.settings();
    if (!settings.enabled) {
      throw marketNotFound();
    }
    const host = this.hostOf(request);
    const marketHost = normalizeHost(settings.host ?? undefined);
    const tutorHost = normalizeHost(settings.tutorHost ?? undefined);
    if (marketHost && host === marketHost) {
      return { settings, kind: 'parent' };
    }
    if (tutorHost && host === tutorHost) {
      return { settings, kind: 'tutor' };
    }
    throw marketNotFound();
  }

  // Phần quản trị: tên miền của cổng nền tảng và mã phiên vận hành; trả mã người vận hành
  async operator(request: Request): Promise<string> {
    const consoleHost = normalizeHost(this.configuration.platformConsoleHost ?? undefined);
    if (!this.available || !consoleHost || this.hostOf(request) !== consoleHost) {
      throw marketNotFound();
    }
    const operatorId = await this.operators.verify(readBearerToken(request.header('authorization')), this.clock.now());
    const row = await this.platform
      .selectFrom('platform_operators')
      .select('status')
      .where('id', '=', operatorId)
      .executeTakeFirst();
    if (row?.status !== 'active') {
      throw unauthenticatedError();
    }
    return operatorId;
  }

  // Tài khoản của phiên chợ đang dùng; tài khoản chưa xác nhận chỉ gọi được điểm cuối cho phép trạng thái chờ
  // Phiên chỉ dùng được ở ứng dụng của vai: tài khoản phụ huynh ở tên miền của chợ, tài khoản gia sư ở tên miền của ứng dụng Gia sư
  async account(request: Request, options: { allowPending?: boolean } = {}): Promise<MarketAccount> {
    const { kind } = await this.assertMarketHost(request);
    const token = readBearerToken(request.header('authorization'));
    const row = await this.database
      .selectFrom('market_sessions')
      .innerJoin('market_accounts', 'market_accounts.id', 'market_sessions.account_id')
      .select([
        'market_accounts.id',
        'market_accounts.kind',
        'market_accounts.display_name',
        'market_accounts.status',
        'market_sessions.expires_at',
        'market_sessions.revoked_at',
      ])
      .where('market_sessions.token_hash', '=', hashSessionToken(token))
      .executeTakeFirst();
    if (!row || row.revoked_at || row.expires_at.getTime() <= this.clock.now().getTime() || row.kind !== kind) {
      throw unauthenticatedError();
    }
    if (row.status === 'locked' || row.status === 'closed' || (row.status === 'pending' && !options.allowPending)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Tài khoản chưa xác nhận hoặc đã khóa');
    }
    return { id: row.id, kind: row.kind, display_name: row.display_name, status: row.status };
  }

  async audit(entry: {
    actorType: 'account' | 'operator' | 'system';
    actorId?: string | null;
    action: string;
    target?: string | null;
    details?: unknown;
  }): Promise<void> {
    await this.database
      .insertInto('market_audit_log')
      .values({
        actor_type: entry.actorType,
        actor_id: entry.actorId ?? null,
        action: entry.action,
        target: entry.target ?? null,
        details: JSON.stringify(entry.details ?? {}),
      })
      .execute();
  }
}
