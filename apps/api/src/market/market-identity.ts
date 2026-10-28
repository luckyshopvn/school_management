import { createHash } from 'node:crypto';
import { Body, Controller, Get, HttpCode, Inject, Injectable, Post, Req } from '@nestjs/common';
import { ApplicationError, validationError } from '@school-management/server';
import {
  IdentityProviderError,
  newAuthorizationParameters,
  OidcIdentityProvider,
  type ExternalIdentityResult,
  type ExternalProviderDefinition,
} from '@school-management/server/external-identity';
import type { Request } from 'express';
import { PublicEndpoint } from '../authentication/authentication.guard.js';
import { API_CONFIGURATION, type ApiConfiguration } from '../common/configuration.js';
import type { RequestBody } from '../common/request-fields.js';
import { MarketAccountsService } from './market-accounts.js';
import { MarketContext, marketNotFound } from './market-context.js';

// Xác minh danh tính gia sư và đăng nhập bằng OIDC ở chợ gia sư (DT-27 phần 27g, YCTD-257; tài liệu 32 mục 19.2 "xác minh lý lịch gia
// sư ở chợ mở", 19.5). Dùng bộ nối OIDC của DT-25 (chuyển sang packages/server). Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - chỉ ứng dụng Gia sư dùng (tên miền của ứng dụng Gia sư); nhà cung cấp khai ở MARKET_IDENTITY_PROVIDERS, ứng dụng đăng ký ở nhà
//   cung cấp là của chợ;
// - địa chỉ quay về do ứng dụng gửi nhưng phải là `/xac-minh` trên đúng tên miền của ứng dụng Gia sư (nhà cung cấp cũng kiểm);
// - lượt chuyển hướng lưu ở cơ sở dữ liệu chợ, hạn 10 phút, dùng một lần, chỉ lưu băm của state;
// - xác minh: nhà cung cấp phải trả ngày sinh và đủ 18 tuổi; một người (mã đối tượng của nhà cung cấp) chỉ gắn một tài khoản gia sư;
//   chợ chỉ lưu băm của mã đối tượng, không lưu ngày sinh, chỉ lưu "đủ 18 tuổi";
// - đăng nhập: chỉ tài khoản gia sư đã xác minh danh tính bằng đúng nhà cung cấp đó; không tự tạo tài khoản
const REQUEST_LIFETIME_MS = 10 * 60 * 1000;
const RETURN_PATH = '/xac-minh';
const ADULT_AGE = 18;

function hashState(state: string): string {
  return createHash('sha256').update(`market-oidc-state:${state}`).digest('hex');
}

export function hashSubject(provider: string, subject: string): string {
  return createHash('sha256').update(`market-oidc-subject:${provider}:${subject}`).digest('hex');
}

@Injectable()
export class MarketIdentityService {
  private readonly providers = new Map<string, OidcIdentityProvider>();

  constructor(
    private readonly market: MarketContext,
    private readonly accounts: MarketAccountsService,
    @Inject(API_CONFIGURATION) private readonly configuration: ApiConfiguration,
  ) {}

  // Chỉ nhà cung cấp trả ngày sinh (khai `birthdate_claim`) mới xác nhận được đủ 18 tuổi
  private definitions(): ExternalProviderDefinition[] {
    return (this.configuration.marketIdentityProviders ?? []).filter((item) => item.birthdateClaim);
  }

  private provider(code: string): OidcIdentityProvider {
    const definition = this.definitions().find((item) => item.code === code);
    if (!definition?.clientId) {
      throw validationError([{ field: 'provider', message: 'Nhà cung cấp định danh chưa được nền tảng khai' }]);
    }
    let provider = this.providers.get(code);
    if (!provider) {
      provider = new OidcIdentityProvider(definition, {
        clientId: definition.clientId,
        clientSecret: definition.clientSecret,
      });
      this.providers.set(code, provider);
    }
    return provider;
  }

  // Chỉ ở tên miền của ứng dụng Gia sư
  private async assertTutorApp(request: Request) {
    const { settings, kind } = await this.market.assertMarketHost(request);
    if (kind !== 'tutor') {
      throw marketNotFound();
    }
    return settings;
  }

  async list(request: Request) {
    await this.assertTutorApp(request);
    return this.definitions()
      .filter((item) => item.clientId)
      .map((item) => ({ code: item.code, display_name: item.displayName }));
  }

  private returnUrl(raw: unknown, tutorHost: string | null): string {
    let url: URL;
    try {
      url = new URL(typeof raw === 'string' ? raw : '');
    } catch {
      throw validationError([{ field: 'return_url', message: 'Địa chỉ quay về không hợp lệ' }]);
    }
    if (
      !tutorHost ||
      url.hostname !== tutorHost ||
      url.pathname !== RETURN_PATH ||
      (url.protocol !== 'https:' && url.protocol !== 'http:')
    ) {
      throw validationError([
        { field: 'return_url', message: 'Địa chỉ quay về phải là trang xác minh của ứng dụng Gia sư' },
      ]);
    }
    return `${url.origin}${RETURN_PATH}`;
  }

  async start(request: Request, body: RequestBody) {
    const settings = await this.assertTutorApp(request);
    const purpose = body?.purpose === 'login' ? 'login' : 'verify';
    const accountId = purpose === 'verify' ? (await this.market.account(request)).id : null;
    const code = typeof body?.provider === 'string' ? body.provider : '';
    const provider = this.provider(code);
    const parameters = newAuthorizationParameters(this.returnUrl(body?.return_url, settings.tutorHost));
    await this.market.database
      .insertInto('market_oidc_requests')
      .values({
        state_hash: hashState(parameters.state),
        purpose,
        provider: code,
        account_id: accountId,
        nonce: parameters.nonce,
        code_verifier: parameters.codeVerifier,
        redirect_uri: parameters.redirectUri,
        expires_at: new Date(this.market.now().getTime() + REQUEST_LIFETIME_MS),
        used_at: null,
      })
      .execute();
    try {
      return { authorization_url: await provider.authorizationUrl(parameters) };
    } catch (error) {
      if (error instanceof IdentityProviderError) {
        throw new ApplicationError('ERR_CONFLICT', 'Không kết nối được nhà cung cấp định danh, thử lại sau');
      }
      throw error;
    }
  }

  async complete(request: Request, body: RequestBody) {
    await this.assertTutorApp(request);
    const state = typeof body?.state === 'string' ? body.state : '';
    const code = typeof body?.code === 'string' ? body.code : '';
    const now = this.market.now();
    const row = state
      ? await this.market.database
          .updateTable('market_oidc_requests')
          .set({ used_at: now })
          .where('state_hash', '=', hashState(state))
          .where('used_at', 'is', null)
          .where('expires_at', '>', now)
          .returningAll()
          .executeTakeFirst()
      : undefined;
    if (!row || !code) {
      throw validationError([{ field: 'state', message: 'Lượt xác minh đã hết hạn hoặc đã dùng, hãy bắt đầu lại' }]);
    }
    let identity: ExternalIdentityResult;
    try {
      identity = await this.provider(row.provider).exchange(
        code,
        { state, nonce: row.nonce, codeVerifier: row.code_verifier, redirectUri: row.redirect_uri },
        now,
      );
    } catch (error) {
      if (error instanceof IdentityProviderError) {
        throw validationError([{ field: 'code', message: 'Nhà cung cấp định danh không xác nhận được, hãy thử lại' }]);
      }
      throw error;
    }
    const subject = hashSubject(row.provider, identity.subject);
    if (row.purpose === 'login') {
      return this.login(row.provider, subject);
    }
    return this.verify(row.account_id as string, row.provider, subject, identity);
  }

  private async login(provider: string, subject: string) {
    const linked = await this.market.database
      .selectFrom('market_external_identities')
      .innerJoin('market_accounts', 'market_accounts.id', 'market_external_identities.account_id')
      .select(['market_accounts.id', 'market_accounts.kind', 'market_accounts.status'])
      .where('market_external_identities.provider', '=', provider)
      .where('market_external_identities.subject', '=', subject)
      .executeTakeFirst();
    if (!linked || linked.kind !== 'tutor' || linked.status !== 'active') {
      throw new ApplicationError(
        'ERR_FORBIDDEN',
        'Chưa có tài khoản gia sư nào xác minh bằng định danh này; đăng nhập bằng mật khẩu rồi xác minh danh tính',
      );
    }
    await this.market.audit({
      actorType: 'account',
      actorId: linked.id,
      action: 'account.login-oidc',
      target: provider,
    });
    return { ...(await this.accounts.openSession(linked.id)), status: 'active' };
  }

  private async verify(accountId: string, provider: string, subject: string, identity: ExternalIdentityResult) {
    const database = this.market.database;
    const reject = async (note: string) => {
      await database
        .insertInto('market_tutor_verifications')
        .values({
          account_id: accountId,
          kind: 'identity',
          status: 'rejected',
          details: JSON.stringify({ provider }),
          document_id: null,
          decided_at: this.market.now(),
          decided_by: 'oidc',
          note,
          valid_until: null,
        })
        .onConflict((conflict) =>
          conflict.columns(['account_id', 'kind']).doUpdateSet({
            status: 'rejected',
            details: JSON.stringify({ provider }),
            submitted_at: this.market.now(),
            decided_at: this.market.now(),
            decided_by: 'oidc',
            note,
          }),
        )
        .execute();
      await this.market.audit({
        actorType: 'account',
        actorId: accountId,
        action: 'verification.identity-reject',
        details: { note },
      });
      return { kind: 'identity', status: 'rejected', note };
    };
    if (identity.ageYears === null) {
      return reject('Nhà cung cấp không trả ngày sinh nên chưa xác nhận được đủ 18 tuổi');
    }
    if (identity.ageYears < ADULT_AGE) {
      return reject('Gia sư ở chợ phải đủ 18 tuổi');
    }
    const other = await database
      .selectFrom('market_external_identities')
      .select('account_id')
      .where('provider', '=', provider)
      .where('subject', '=', subject)
      .executeTakeFirst();
    if (other && other.account_id !== accountId) {
      return reject('Định danh này đã xác minh cho một tài khoản gia sư khác');
    }
    const now = this.market.now();
    await database.transaction().execute(async (trx) => {
      await trx
        .insertInto('market_external_identities')
        .values({ provider, subject, account_id: accountId })
        .onConflict((conflict) => conflict.columns(['provider', 'subject']).doNothing())
        .execute();
      const details = JSON.stringify({ provider, adult: true, assurance: identity.assurance });
      await trx
        .insertInto('market_tutor_verifications')
        .values({
          account_id: accountId,
          kind: 'identity',
          status: 'approved',
          details,
          document_id: null,
          decided_at: now,
          decided_by: 'oidc',
          note: null,
          valid_until: null,
        })
        .onConflict((conflict) =>
          conflict.columns(['account_id', 'kind']).doUpdateSet({
            status: 'approved',
            details,
            submitted_at: now,
            decided_at: now,
            decided_by: 'oidc',
            note: null,
          }),
        )
        .execute();
    });
    await this.market.audit({
      actorType: 'account',
      actorId: accountId,
      action: 'verification.identity-approve',
      target: provider,
    });
    return { kind: 'identity', status: 'approved', note: null };
  }
}

@Controller('market/identity')
@PublicEndpoint()
export class MarketIdentityController {
  constructor(private readonly identity: MarketIdentityService) {}

  @Get('providers')
  list(@Req() request: Request) {
    return this.identity.list(request);
  }

  @Post('start')
  @HttpCode(200)
  start(@Req() request: Request, @Body() body: RequestBody) {
    return this.identity.start(request, body);
  }

  @Post('complete')
  @HttpCode(200)
  complete(@Req() request: Request, @Body() body: RequestBody) {
    return this.identity.complete(request, body);
  }
}
