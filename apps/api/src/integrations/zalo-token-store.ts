import type { SystemDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import { decryptSecret, encryptSecret } from '../common/secret-encryption.js';
import type { FetchFunction } from './facebook-publisher.js';

// Kho khóa truy cập Zalo Official Account (G3-08; YCTD-92). Khóa truy cập sống khoảng 25 giờ; khóa làm mới chỉ dùng được
// một lần, mỗi lần làm mới Zalo trả khóa làm mới mới (hạn 3 tháng) nên phải lưu ngay khóa mới nhất, mã hóa, ở cơ sở dữ liệu
// hệ thống (dùng chung toàn trường, giữ qua các năm học). Làm mới khi khóa còn dưới 5 phút hoặc khi Zalo báo khóa không
// hợp lệ. Hai lớp chống làm mới hai lần: trong một tiến trình chỉ một lời gọi làm mới chạy (các lời gọi khác chờ cùng kết
// quả); giữa nhiều tiến trình, khóa dòng FOR UPDATE rồi đọc lại, tiến trình đến sau thấy khóa đã mới thì dùng luôn.
// Kho trống thì lấy ZALO_OA_REFRESH_TOKEN (và ZALO_OA_ACCESS_TOKEN nếu có) ở biến môi trường làm khóa ban đầu; khóa làm
// mới hết hạn thì người quản trị dán khóa mới trên màn hình Kết nối ngoài
export const ZALO_REFRESH_URL = 'https://oauth.zaloapp.com/v4/oa/access_token';
export const REFRESH_MARGIN_MS = 5 * 60_000;
// Khóa truy cập lấy từ biến môi trường không rõ hạn: coi như còn 1 giờ, sai thì Zalo báo -216 và máy chủ làm mới
const SEEDED_ACCESS_TOKEN_TTL_MS = 60 * 60_000;

export interface ZaloTokenStoreOptions {
  appId: string | null;
  appSecret: string | null;
  seedRefreshToken: string | null;
  seedAccessToken: string | null;
  fetcher?: FetchFunction;
  now?: () => Date;
}

export interface ZaloTokenStatus {
  refresh_token_configured: boolean;
  access_token_expires_at: Date | null;
  refreshed_at: Date | null;
}

export class ZaloTokenStore {
  private inFlight: Promise<string> | null = null;
  private readonly fetcher: FetchFunction;
  private readonly now: () => Date;

  // Cơ sở dữ liệu và khóa có thể là hàm để đọc theo từng lần dùng (nhiều trường: theo trường trong ngữ cảnh, DT-SaaS phần S1a)
  constructor(
    private readonly systemSource: Kysely<SystemDatabase> | (() => Kysely<SystemDatabase>),
    private readonly keySource: Buffer | (() => Buffer),
    private readonly optionsSource: ZaloTokenStoreOptions | (() => Promise<ZaloTokenStoreOptions>),
    extras: Pick<ZaloTokenStoreOptions, 'fetcher' | 'now'> = {},
  ) {
    const base = typeof optionsSource === 'function' ? extras : optionsSource;
    this.fetcher = base.fetcher ?? ((input, init) => fetch(input, init));
    this.now = base.now ?? (() => new Date());
  }

  // Cấu hình ban đầu của Zalo: cố định, hoặc hàm đọc theo từng lần dùng (nhiều trường: theo cấu hình của trường, DT-SaaS phần S3)
  private resolveOptions(): Promise<ZaloTokenStoreOptions> {
    return typeof this.optionsSource === 'function' ? this.optionsSource() : Promise.resolve(this.optionsSource);
  }

  private get system(): Kysely<SystemDatabase> {
    return typeof this.systemSource === 'function' ? this.systemSource() : this.systemSource;
  }

  private get encryptionKey(): Buffer {
    return typeof this.keySource === 'function' ? this.keySource() : this.keySource;
  }

  // Khóa truy cập còn hạn; sắp hết hạn thì làm mới trước
  async accessToken(): Promise<string> {
    await this.seedIfEmpty();
    const row = await this.read();
    if (row?.access_token_encrypted && row.access_token_expires_at && this.fresh(row.access_token_expires_at)) {
      return decryptSecret(this.encryptionKey, row.access_token_encrypted);
    }
    return this.refresh(null);
  }

  // Làm mới khóa; staleAccessToken là khóa vừa bị Zalo từ chối (null khi làm mới vì sắp hết hạn)
  refresh(staleAccessToken: string | null): Promise<string> {
    if (!this.inFlight) {
      this.inFlight = this.refreshLocked(staleAccessToken).finally(() => {
        this.inFlight = null;
      });
    }
    return this.inFlight;
  }

  // Người quản trị dán khóa làm mới mới; khóa truy cập cũ bị bỏ để lần gửi sau làm mới bằng khóa vừa dán
  // Trả mã dòng và cho biết đã có khóa trước đó hay chưa để ghi nhật ký (không ghi giá trị khóa)
  async replaceRefreshToken(
    refreshToken: string,
    actorUserId: string | null,
  ): Promise<{ id: string; replaced: boolean }> {
    await this.inFlight?.catch(() => undefined);
    const before = await this.read();
    const values = {
      refresh_token_encrypted: encryptSecret(this.encryptionKey, refreshToken),
      access_token_encrypted: null,
      access_token_expires_at: null,
      updated_by: actorUserId,
    };
    const saved = await this.system
      .insertInto('integration_credentials')
      .values({ connector: 'zalo', ...values })
      .onConflict((conflict) => conflict.column('connector').doUpdateSet({ ...values, updated_at: this.now() }))
      .returning('id')
      .executeTakeFirstOrThrow();
    return { id: saved.id, replaced: Boolean(before?.refresh_token_encrypted) };
  }

  async status(): Promise<ZaloTokenStatus> {
    await this.seedIfEmpty();
    const row = await this.read();
    return {
      refresh_token_configured: Boolean(row?.refresh_token_encrypted),
      access_token_expires_at: row?.access_token_expires_at ?? null,
      refreshed_at: row?.refreshed_at ?? null,
    };
  }

  private fresh(expiresAt: Date): boolean {
    return expiresAt.getTime() - this.now().getTime() > REFRESH_MARGIN_MS;
  }

  private read() {
    return this.system
      .selectFrom('integration_credentials')
      .selectAll()
      .where('connector', '=', 'zalo')
      .executeTakeFirst();
  }

  private async seedIfEmpty(): Promise<void> {
    const options = await this.resolveOptions();
    if (!options.seedRefreshToken || (await this.read())) {
      return;
    }
    await this.system
      .insertInto('integration_credentials')
      .values({
        connector: 'zalo',
        refresh_token_encrypted: encryptSecret(this.encryptionKey, options.seedRefreshToken),
        access_token_encrypted: options.seedAccessToken
          ? encryptSecret(this.encryptionKey, options.seedAccessToken)
          : null,
        access_token_expires_at: options.seedAccessToken
          ? new Date(this.now().getTime() + SEEDED_ACCESS_TOKEN_TTL_MS)
          : null,
      })
      .onConflict((conflict) => conflict.column('connector').doNothing())
      .execute();
  }

  private async refreshLocked(staleAccessToken: string | null): Promise<string> {
    const { appId, appSecret } = await this.resolveOptions();
    if (!appId || !appSecret) {
      throw new Error('Trường chưa cấu hình App ID và App Secret của Zalo để làm mới khóa Zalo');
    }
    await this.seedIfEmpty();
    return this.system.transaction().execute(async (transaction) => {
      const row = await transaction
        .selectFrom('integration_credentials')
        .selectAll()
        .where('connector', '=', 'zalo')
        .forUpdate()
        .executeTakeFirst();
      if (!row?.refresh_token_encrypted) {
        throw new Error('Chưa có khóa làm mới Zalo; người quản trị cần nhập khóa làm mới trên màn hình Kết nối ngoài');
      }
      // Tiến trình khác đã làm mới trong lúc chờ khóa dòng: dùng luôn khóa mới, không làm mới lần nữa
      if (row.access_token_encrypted && row.access_token_expires_at && this.fresh(row.access_token_expires_at)) {
        const current = decryptSecret(this.encryptionKey, row.access_token_encrypted);
        if (current !== staleAccessToken) {
          return current;
        }
      }
      const refreshToken = decryptSecret(this.encryptionKey, row.refresh_token_encrypted);
      let response: Response;
      try {
        response = await this.fetcher(ZALO_REFRESH_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded', secret_key: appSecret },
          body: new URLSearchParams({ refresh_token: refreshToken, app_id: appId, grant_type: 'refresh_token' }),
        });
      } catch {
        throw new Error('Không kết nối được tới Zalo để làm mới khóa, vui lòng thử lại');
      }
      const result = (await response.json().catch(() => ({}))) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: string | number;
        error?: number;
        error_description?: string;
        error_name?: string;
      };
      if (!response.ok || !result.access_token || !result.refresh_token) {
        const reason = result.error_description ?? result.error_name ?? String(response.status);
        throw new Error(
          `Zalo từ chối làm mới khóa (${reason}${result.error !== undefined ? `, mã ${result.error}` : ''}); ` +
            'nếu khóa làm mới đã hết hạn, người quản trị cần nhập khóa làm mới mới',
        );
      }
      const now = this.now();
      const expiresInSeconds = Number(result.expires_in) > 0 ? Number(result.expires_in) : 3600;
      await transaction
        .updateTable('integration_credentials')
        .set({
          access_token_encrypted: encryptSecret(this.encryptionKey, result.access_token),
          access_token_expires_at: new Date(now.getTime() + expiresInSeconds * 1000),
          // Khóa làm mới cũ đã bị Zalo vô hiệu, phải lưu khóa mới ngay trong cùng giao dịch
          refresh_token_encrypted: encryptSecret(this.encryptionKey, result.refresh_token),
          refreshed_at: now,
          updated_at: now,
        })
        .where('connector', '=', 'zalo')
        .execute();
      return result.access_token;
    });
  }
}
