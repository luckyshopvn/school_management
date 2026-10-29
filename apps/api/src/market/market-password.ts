import { hash, verify } from '@node-rs/argon2';
import { Body, Controller, HttpCode, Injectable, Post, Put, Req } from '@nestjs/common';
import { ApplicationError, unauthenticatedError, validationError } from '@school-management/server';
import type { Request } from 'express';
import { PublicEndpoint } from '../authentication/authentication.guard.js';
import type { RequestBody } from '../common/request-fields.js';
import { checkMarketPassword, normalizePhone } from './market-accounts.js';
import { MarketContext } from './market-context.js';
import { MarketMessenger } from './market-messenger.js';
import {
  hashSessionToken,
  hashVerificationCode,
  MARKET_CODE_LIFETIME_MS,
  MARKET_CODE_MAX_ATTEMPTS,
  newVerificationCode,
  sameHash,
} from './market-tokens.js';

// Mật khẩu và thông tin tài khoản chợ gia sư (YCTD-364, thiết kế Eric duyệt ngày 2026-10-28; việc T-M5 của rà soát giao diện), dùng chung
// cho phụ huynh và gia sư:
// - đổi mật khẩu khi đang đăng nhập: phải nhập mật khẩu hiện tại; đổi xong thì mọi phiên khác bị thu hồi;
// - quên mật khẩu: gửi mã 6 số (mục đích `reset`) tới thư điện tử hoặc số điện thoại đã đăng ký, hiệu lực 10 phút, nhập sai quá số lần thì
//   phải lấy mã mới; câu trả lời không cho biết tài khoản có tồn tại hay không; đặt lại xong thì mọi phiên bị thu hồi, gỡ khóa đăng nhập;
// - xác nhận lại mật khẩu (thoát chế độ con đọc tin nhắn của phụ huynh);
// - sửa tên hiển thị. Đổi thư điện tử, số điện thoại cần xác nhận kênh mới nên chưa làm
const RESEND_INTERVAL_MS = 60 * 1000;

function text(body: RequestBody, field: string): string {
  const value = body?.[field];
  return typeof value === 'string' ? value.trim() : '';
}

@Injectable()
export class MarketPasswordService {
  constructor(
    private readonly market: MarketContext,
    private readonly messenger: MarketMessenger,
  ) {}

  private async currentHash(accountId: string): Promise<string | null> {
    const row = await this.market.database
      .selectFrom('market_accounts')
      .select('password_hash')
      .where('id', '=', accountId)
      .executeTakeFirstOrThrow();
    return row.password_hash;
  }

  private async setPassword(accountId: string, password: string, keepToken: string | null) {
    const passwordHash = await hash(password);
    const now = this.market.now();
    await this.market.database.transaction().execute(async (trx) => {
      await trx
        .updateTable('market_accounts')
        .set({ password_hash: passwordHash, failed_login_count: 0, locked_until: null, updated_at: now })
        .where('id', '=', accountId)
        .execute();
      let sessions = trx
        .updateTable('market_sessions')
        .set({ revoked_at: now })
        .where('account_id', '=', accountId)
        .where('revoked_at', 'is', null);
      if (keepToken) sessions = sessions.where('token_hash', '!=', hashSessionToken(keepToken));
      await sessions.execute();
    });
  }

  async change(request: Request, body: RequestBody) {
    const account = await this.market.account(request);
    const current = typeof body?.current_password === 'string' ? body.current_password : '';
    const next = typeof body?.new_password === 'string' ? body.new_password : '';
    const stored = await this.currentHash(account.id);
    if (!stored || !(await verify(stored, current).catch(() => false))) {
      throw validationError([{ field: 'current_password', message: 'Mật khẩu hiện tại không đúng' }]);
    }
    const errors = checkMarketPassword(next).map((error) => ({ ...error, field: 'new_password' }));
    if (errors.length > 0) throw validationError(errors);
    const token = (request.header('authorization') ?? '').split(' ')[1] ?? null;
    await this.setPassword(account.id, next, token);
    await this.market.audit({ actorType: 'account', actorId: account.id, action: 'account.password-change' });
    return { changed: true };
  }

  async confirm(request: Request, body: RequestBody) {
    const account = await this.market.account(request);
    const password = typeof body?.password === 'string' ? body.password : '';
    const stored = await this.currentHash(account.id);
    if (!stored || !(await verify(stored, password).catch(() => false))) throw unauthenticatedError();
    return { confirmed: true };
  }

  private async accountByLogin(request: Request, login: string) {
    // Thư điện tử, số điện thoại là duy nhất trên mọi loại tài khoản nên không cần lọc theo loại (YCTD-368)
    await this.market.assertMarketHost(request);
    const email = login.includes('@') ? login.toLowerCase() : null;
    const phone = email ? null : normalizePhone(login);
    if (!login) return undefined;
    return this.market.database
      .selectFrom('market_accounts')
      .select(['id', 'kind', 'email', 'phone', 'status'])
      .where(email ? 'email' : 'phone', '=', (email ?? phone) as string)
      .where('status', 'in', ['active', 'pending'])
      .executeTakeFirst();
  }

  async forgot(request: Request, body: RequestBody) {
    const account = await this.accountByLogin(request, text(body, 'login'));
    if (account) {
      const last = await this.market.database
        .selectFrom('market_verification_codes')
        .select('created_at')
        .where('account_id', '=', account.id)
        .where('purpose', '=', 'reset')
        .orderBy('created_at', 'desc')
        .executeTakeFirst();
      if (!last || this.market.now().getTime() - last.created_at.getTime() >= RESEND_INTERVAL_MS) {
        const code = newVerificationCode();
        const channel = account.email ? 'email' : 'sms';
        await this.market.database
          .insertInto('market_verification_codes')
          .values({
            account_id: account.id,
            channel,
            purpose: 'reset',
            code_hash: hashVerificationCode(account.id, code),
            expires_at: new Date(this.market.now().getTime() + MARKET_CODE_LIFETIME_MS),
          })
          .execute();
        await this.messenger.send({
          channel,
          to: (account.email ?? account.phone) as string,
          text: `Mã đặt lại mật khẩu Chợ gia sư của bạn là ${code}, hiệu lực 10 phút. Bạn không yêu cầu thì bỏ qua tin này.`,
        });
        await this.market.audit({ actorType: 'account', actorId: account.id, action: 'account.password-reset-code' });
      }
    }
    // Không cho biết tài khoản có tồn tại hay không
    return { sent: true };
  }

  async reset(request: Request, body: RequestBody) {
    const account = await this.accountByLogin(request, text(body, 'login'));
    const code = text(body, 'code');
    const next = typeof body?.new_password === 'string' ? body.new_password : '';
    const errors = checkMarketPassword(next).map((error) => ({ ...error, field: 'new_password' }));
    if (errors.length > 0) throw validationError(errors);
    const row = account
      ? await this.market.database
          .selectFrom('market_verification_codes')
          .select(['id', 'code_hash', 'attempts', 'expires_at'])
          .where('account_id', '=', account.id)
          .where('purpose', '=', 'reset')
          .where('used_at', 'is', null)
          .orderBy('created_at', 'desc')
          .executeTakeFirst()
      : undefined;
    const now = this.market.now();
    if (!account || !row || row.expires_at.getTime() <= now.getTime() || row.attempts >= MARKET_CODE_MAX_ATTEMPTS) {
      throw validationError([{ field: 'code', message: 'Mã đã hết hạn hoặc nhập sai quá số lần, hãy lấy mã mới' }]);
    }
    if (!/^\d{6}$/.test(code) || !sameHash(row.code_hash, hashVerificationCode(account.id, code))) {
      await this.market.database
        .updateTable('market_verification_codes')
        .set((eb) => ({ attempts: eb('attempts', '+', 1) }))
        .where('id', '=', row.id)
        .execute();
      throw validationError([{ field: 'code', message: 'Mã không đúng' }]);
    }
    await this.market.database
      .updateTable('market_verification_codes')
      .set({ used_at: now })
      .where('id', '=', row.id)
      .execute();
    await this.setPassword(account.id, next, null);
    await this.market.audit({ actorType: 'account', actorId: account.id, action: 'account.password-reset' });
    return { reset: true };
  }

  async updateProfile(request: Request, body: RequestBody) {
    const account = await this.market.account(request);
    const name = text(body, 'display_name');
    if (name.length < 2 || name.length > 80) {
      throw validationError([{ field: 'display_name', message: 'Tên hiển thị từ 2 đến 80 ký tự' }]);
    }
    if (account.status !== 'active') throw new ApplicationError('ERR_CONFLICT', 'Tài khoản chưa xác nhận');
    await this.market.database
      .updateTable('market_accounts')
      .set({ display_name: name, updated_at: this.market.now() })
      .where('id', '=', account.id)
      .execute();
    await this.market.audit({ actorType: 'account', actorId: account.id, action: 'account.profile-update' });
    return { display_name: name };
  }
}

@Controller('market')
@PublicEndpoint()
export class MarketPasswordController {
  constructor(private readonly passwords: MarketPasswordService) {}

  @Post('auth/password/change')
  @HttpCode(200)
  change(@Req() request: Request, @Body() body: RequestBody) {
    return this.passwords.change(request, body);
  }

  @Post('auth/password/confirm')
  @HttpCode(200)
  confirm(@Req() request: Request, @Body() body: RequestBody) {
    return this.passwords.confirm(request, body);
  }

  @Post('auth/password/forgot')
  @HttpCode(200)
  forgot(@Req() request: Request, @Body() body: RequestBody) {
    return this.passwords.forgot(request, body);
  }

  @Post('auth/password/reset')
  @HttpCode(200)
  reset(@Req() request: Request, @Body() body: RequestBody) {
    return this.passwords.reset(request, body);
  }

  @Put('me')
  updateProfile(@Req() request: Request, @Body() body: RequestBody) {
    return this.passwords.updateProfile(request, body);
  }
}
