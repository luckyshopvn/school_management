import { Inject, Injectable } from '@nestjs/common';
import { ApplicationError, validationError } from '@school-management/server';
import { randomUUID } from 'node:crypto';
import { IDENTITY_CONFIGURATION, type IdentityConfiguration } from '../common/configuration.js';
import { Infrastructure } from '../common/infrastructure.js';
import { IdentitySettingsService } from '../settings/identity-settings.service.js';
import { randomCaptchaText, renderCaptchaPng } from './captcha-image.js';

// Mã xác nhận dạng ảnh của trang đăng nhập và quên mật khẩu cổng quản trị (DT-16 phần 16c). Đáp án giữ ở Redis 5 phút,
// dùng một lần: so đúng hay sai đều xóa, muốn thử lại phải lấy ảnh mới. Đăng nhập cổng quản trị cần mã khi cấu hình
// "luôn hiện mã xác nhận" bật hoặc tài khoản đã nhập sai đủ số lần cấu hình trong 15 phút gần nhất; ứng dụng giáo viên,
// phụ huynh không có ô nhập mã nên không áp dụng
const CAPTCHA_LIFETIME_SECONDS = 300;
const FAILURE_WINDOW_SECONDS = 15 * 60;
const CAPTCHA_ID_PATTERN = /^[0-9a-f-]{36}$/;
const PLATFORM_CAPTCHAS_PER_MINUTE = 30;
const PLATFORM_FAILURE_THRESHOLD = 3;

export interface CaptchaChallenge {
  captcha_id: string;
  image: string;
  expires_in_seconds: number;
}

export interface CaptchaAnswer {
  captchaId: string | undefined;
  captchaText: string | undefined;
}

@Injectable()
export class CaptchaService {
  constructor(
    @Inject(IDENTITY_CONFIGURATION) private readonly configuration: IdentityConfiguration,
    private readonly infrastructure: Infrastructure,
    private readonly identitySettings: IdentitySettingsService,
  ) {}

  private key(kind: string, value: string): string {
    return `${this.infrastructure.keyPrefix()}:${kind}:${value}`;
  }

  async issue(): Promise<CaptchaChallenge> {
    const captchaId = randomUUID();
    const text = randomCaptchaText();
    await this.infrastructure.redis.set(this.key('captcha', captchaId), text, 'EX', CAPTCHA_LIFETIME_SECONDS);
    return {
      captcha_id: captchaId,
      image: `data:image/png;base64,${renderCaptchaPng(text).toString('base64')}`,
      expires_in_seconds: CAPTCHA_LIFETIME_SECONDS,
    };
  }

  // Không phân biệt chữ hoa, chữ thường và bỏ khoảng trắng hai đầu
  async verify(answer: CaptchaAnswer): Promise<boolean> {
    if (!answer.captchaId || !CAPTCHA_ID_PATTERN.test(answer.captchaId) || !answer.captchaText) {
      return false;
    }
    const key = this.key('captcha', answer.captchaId);
    const [[, expected]] = (await this.infrastructure.redis.multi().get(key).del(key).exec()) as [[unknown, unknown]];
    return typeof expected === 'string' && expected === answer.captchaText.trim().toUpperCase();
  }

  // Bắt buộc nhập đúng mã thì mới kiểm tra tiếp; lỗi gắn với ô captcha để trang đăng nhập hiện ảnh mới
  async assertSolved(answer: CaptchaAnswer): Promise<void> {
    if (await this.verify(answer)) {
      return;
    }
    throw validationError([
      {
        field: 'captcha',
        message: answer.captchaText ? 'Mã xác nhận không đúng hoặc đã hết hạn' : 'Nhập mã xác nhận trong ảnh',
      },
    ]);
  }

  async requiredForLogin(loginIdentifier: string): Promise<boolean> {
    const rules = await this.identitySettings.captchaRules();
    if (rules.always) {
      return true;
    }
    const failures = Number(await this.infrastructure.redis.get(this.failureKey(loginIdentifier)));
    return failures >= rules.failureThreshold;
  }

  // Đếm cả tên đăng nhập không tồn tại để việc hiện mã không lộ tài khoản có hay không
  async registerFailure(loginIdentifier: string): Promise<void> {
    const key = this.failureKey(loginIdentifier);
    const count = await this.infrastructure.redis.incr(key);
    if (count === 1) {
      await this.infrastructure.redis.expire(key, FAILURE_WINDOW_SECONDS);
    }
  }

  async clearFailures(loginIdentifier: string): Promise<void> {
    await this.infrastructure.redis.del(this.failureKey(loginIdentifier));
  }

  private failureKey(loginIdentifier: string): string {
    return this.key('login-failures', loginIdentifier.toLowerCase());
  }

  // Mã xác nhận của đăng nhập cổng vận hành nền tảng (YCTD-313), cùng cơ chế với đăng nhập cổng quản trị: trang luôn hiện ô mã;
  // có gửi mã thì phải đúng; không gửi mã chỉ được khi tài khoản nhập sai chưa tới PLATFORM_FAILURE_THRESHOLD lần trong 15 phút.
  // Cổng không thuộc trường nào nên khóa Redis nằm ở nhóm "platform" của dịch vụ định danh thay vì theo trường. Đúng mã và đúng
  // mật khẩu nhưng còn thiếu mã xác thực hai lớp thì cấp "lượt đã qua" gắn với mã ảnh và tên đăng nhập trong 5 phút, để bước
  // nhập mã hai lớp không phải giải ảnh lần nữa
  private platformKey(kind: string, value: string): string {
    return `${this.configuration.redisKeyPrefix}:platform:${kind}:${value}`;
  }

  async issuePlatform(ipAddress: string): Promise<CaptchaChallenge> {
    // Giới hạn số ảnh mỗi địa chỉ trong một phút để điểm cuối công khai không bị dùng làm đầy Redis
    const rateKey = this.platformKey('captcha-rate', `${ipAddress}:${Math.floor(Date.now() / 60_000)}`);
    const count = await this.infrastructure.redis.incr(rateKey);
    if (count === 1) {
      await this.infrastructure.redis.expire(rateKey, 120);
    }
    if (count > PLATFORM_CAPTCHAS_PER_MINUTE) {
      throw new ApplicationError('ERR_RATE_LIMIT', 'Lấy mã xác nhận quá nhiều lần, vui lòng thử lại sau một phút');
    }
    const captchaId = randomUUID();
    const text = randomCaptchaText();
    await this.infrastructure.redis.set(this.platformKey('captcha', captchaId), text, 'EX', CAPTCHA_LIFETIME_SECONDS);
    return {
      captcha_id: captchaId,
      image: `data:image/png;base64,${renderCaptchaPng(text).toString('base64')}`,
      expires_in_seconds: CAPTCHA_LIFETIME_SECONDS,
    };
  }

  // Lượt đã qua (bước mã hai lớp) và mã trong ảnh đều dùng một lần
  async assertPlatformSolved(answer: CaptchaAnswer, login: string): Promise<void> {
    const validId = answer.captchaId !== undefined && CAPTCHA_ID_PATTERN.test(answer.captchaId);
    if (validId && !answer.captchaText) {
      const key = this.platformKey('captcha-pass', answer.captchaId as string);
      const [[, passedLogin]] = (await this.infrastructure.redis.multi().get(key).del(key).exec()) as [
        [unknown, unknown],
      ];
      if (typeof passedLogin === 'string' && passedLogin === login.trim().toLowerCase()) {
        return;
      }
    }
    if (answer.captchaText) {
      let solved = false;
      if (validId) {
        const key = this.platformKey('captcha', answer.captchaId as string);
        const [[, expected]] = (await this.infrastructure.redis.multi().get(key).del(key).exec()) as [
          [unknown, unknown],
        ];
        solved = typeof expected === 'string' && expected === answer.captchaText.trim().toUpperCase();
      }
      if (!solved) {
        throw validationError([{ field: 'captcha', message: 'Mã xác nhận không đúng hoặc đã hết hạn' }]);
      }
      return;
    }
    const failures = Number(await this.infrastructure.redis.get(this.platformFailureKey(login)));
    if (failures >= PLATFORM_FAILURE_THRESHOLD) {
      throw validationError([{ field: 'captcha', message: 'Nhập mã xác nhận trong ảnh' }]);
    }
  }

  // Đếm cả tên đăng nhập không tồn tại để việc đòi mã không lộ tài khoản có hay không
  async registerPlatformFailure(login: string): Promise<void> {
    const key = this.platformFailureKey(login);
    const count = await this.infrastructure.redis.incr(key);
    if (count === 1) {
      await this.infrastructure.redis.expire(key, FAILURE_WINDOW_SECONDS);
    }
  }

  async clearPlatformFailures(login: string): Promise<void> {
    await this.infrastructure.redis.del(this.platformFailureKey(login));
  }

  private platformFailureKey(login: string): string {
    return this.platformKey('login-failures', login.trim().toLowerCase());
  }

  async grantPlatformPass(captchaId: string, login: string): Promise<void> {
    await this.infrastructure.redis.set(
      this.platformKey('captcha-pass', captchaId),
      login.trim().toLowerCase(),
      'EX',
      CAPTCHA_LIFETIME_SECONDS,
    );
  }
}
