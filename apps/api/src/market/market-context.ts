import { Inject, Injectable, Optional, type OnModuleDestroy } from '@nestjs/common';
import {
  createMarketplaceConnection,
  readMarketSettings,
  type MarketplaceDatabase,
  type MarketSettings,
  type PlatformDatabase,
  type PlatformOperatorRole,
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

// Ngữ cảnh của chợ gia sư ở máy chủ API (DT-27 phần 27f, YCTD-256; tài liệu 47 mục 19.3, 19.5). Claude tự chọn theo ủy quyền của Eric
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

  // Phần của người dùng chợ: chợ bật và đúng tên miền dành riêng của chợ. Từ YCTD-368 (GD-185) phụ huynh và gia sư dùng chung một ứng
  // dụng ở tên miền này; vai lấy từ loại tài khoản của phiên (`account`, `requireReady`), không từ tên miền. Tên miền cũ của ứng dụng
  // Gia sư (`tutorHost`) chỉ được tầng biên chuyển hướng về đây, máy chủ API không phục vụ nó
  async assertMarketHost(request: Request): Promise<{ settings: MarketSettings }> {
    if (!this.available) {
      throw marketNotFound();
    }
    const settings = await this.settings();
    if (!settings.enabled) {
      throw marketNotFound();
    }
    const marketHost = normalizeHost(settings.host ?? undefined);
    if (!marketHost || this.hostOf(request) !== marketHost) {
      throw marketNotFound();
    }
    return { settings };
  }

  // Phần quản trị: tên miền của cổng nền tảng và mã phiên vận hành; trả mã người vận hành. roles là vai trò được làm việc này theo
  // OPERATOR_PERMISSIONS, không truyền là chỉ quản trị; còn mật khẩu tạm thì phải đổi trước (YCTD-323)
  async operator(request: Request, roles: readonly PlatformOperatorRole[] = ['quan_tri']): Promise<string> {
    const consoleHost = normalizeHost(this.configuration.platformConsoleHost ?? undefined);
    if (!this.available || !consoleHost || this.hostOf(request) !== consoleHost) {
      throw marketNotFound();
    }
    const operatorId = await this.operators.verify(readBearerToken(request.header('authorization')), this.clock.now());
    const row = await this.platform
      .selectFrom('platform_operators')
      .select(['status', 'role', 'must_change_password'])
      .where('id', '=', operatorId)
      .executeTakeFirst();
    if (row?.status !== 'active') {
      throw unauthenticatedError();
    }
    if (row.must_change_password) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn cần đổi mật khẩu tạm trước khi tiếp tục');
    }
    if (!roles.includes(row.role)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Vai trò vận hành của bạn không được làm thao tác này');
    }
    return operatorId;
  }

  // Tài khoản của phiên chợ đang dùng; tài khoản chưa xác nhận chỉ gọi được điểm cuối cho phép trạng thái chờ
  // Phiên của cả hai vai dùng ở cùng tên miền (YCTD-368); điểm cuối riêng của một vai kiểm loại tài khoản qua requireReady
  async account(request: Request, options: { allowPending?: boolean } = {}): Promise<MarketAccount> {
    await this.assertMarketHost(request);
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
    if (!row || row.revoked_at || row.expires_at.getTime() <= this.clock.now().getTime()) {
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
