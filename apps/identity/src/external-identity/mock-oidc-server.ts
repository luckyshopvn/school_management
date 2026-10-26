import { createHash, randomBytes, randomUUID } from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { exportJWK, generateKeyPair, SignJWT, type JWK, type CryptoKey } from 'jose';

// Nhà cung cấp OIDC giả lập chạy cục bộ cho kiểm thử đơn vị và kiểm thử giao diện (DT-25, YCTD-225). Không gọi dịch vụ thật, không có
// khóa thật: khóa ký sinh mới mỗi lần chạy. Có discovery, JWKS, trang ủy quyền (chuyển hướng ngay về địa chỉ quay về với mã), điểm cuối
// đổi mã kiểm PKCE, mã ứng dụng, khóa bí mật và địa chỉ quay về; có thể quay khóa và cố ý làm hỏng id_token (sai chữ ký, sai nonce, sai
// đối tượng, sai bên phát hành, hết hạn) để kiểm bộ nối từ chối
export type MockTamper = 'signature' | 'nonce' | 'audience' | 'issuer' | 'expired';

export interface MockIdentity {
  subject: string;
  acr?: string;
  birthdate?: string;
  tamper?: MockTamper;
}

interface IssuedCode {
  identity: MockIdentity;
  clientId: string;
  redirectUri: string;
  nonce: string;
  codeChallenge: string;
}

interface SigningKey {
  kid: string;
  privateKey: CryptoKey;
  publicJwk: JWK;
}

async function newSigningKey(): Promise<SigningKey> {
  const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true });
  const kid = randomUUID();
  return { kid, privateKey, publicJwk: { ...(await exportJWK(publicKey)), kid, alg: 'RS256', use: 'sig' } };
}

export interface MockOidcServerOptions {
  port?: number;
  clientId?: string;
  clientSecret?: string;
  path?: string;
}

export class MockOidcServer {
  readonly clientId: string;
  readonly clientSecret: string;
  // Danh tính trang ủy quyền trả cho lượt tiếp theo (kiểm thử giao diện đặt trước khi bấm nút)
  nextIdentity: MockIdentity | null = null;
  // Số lần bộ khóa được tải (để kiểm thử quay khóa)
  jwksRequests = 0;
  private keys: SigningKey[] = [];
  private readonly codes = new Map<string, IssuedCode>();
  private server: http.Server | null = null;
  private baseUrl = '';

  constructor(private readonly options: MockOidcServerOptions = {}) {
    this.clientId = options.clientId ?? 'ung-dung-thu';
    this.clientSecret = options.clientSecret ?? randomBytes(16).toString('hex');
  }

  get issuer(): string {
    return `${this.baseUrl}${this.options.path ?? '/oidc-gia-lap'}`;
  }

  async start(): Promise<this> {
    this.keys = [await newSigningKey()];
    this.server = http.createServer((request, response) => {
      this.handle(request, response).catch(() => {
        response.statusCode = 500;
        response.end();
      });
    });
    await new Promise<void>((resolve) => this.server?.listen(this.options.port ?? 0, '127.0.0.1', resolve));
    const address = this.server.address() as AddressInfo;
    this.baseUrl = `http://127.0.0.1:${address.port}`;
    return this;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
    this.server = null;
  }

  // Quay khóa: khóa mới ký từ nay; giữ khóa cũ trong JWKS nếu `keepPrevious`
  async rotateKeys(keepPrevious = false): Promise<void> {
    const next = await newSigningKey();
    this.keys = keepPrevious ? [next, ...this.keys] : [next];
  }

  // Giả lập người dùng đăng nhập ở trang của nhà cung cấp: trả mã ủy quyền cho địa chỉ ủy quyền mà dịch vụ định danh tạo ra
  authorize(authorizationUrl: string, identity: MockIdentity): { code: string; state: string; redirectUri: string } {
    const url = new URL(authorizationUrl);
    const query = url.searchParams;
    if (query.get('response_type') !== 'code' || query.get('code_challenge_method') !== 'S256') {
      throw new Error('Yêu cầu ủy quyền không đúng chuẩn');
    }
    if (query.get('client_id') !== this.clientId || !(query.get('scope') ?? '').split(' ').includes('openid')) {
      throw new Error('Sai mã ứng dụng hoặc thiếu phạm vi openid');
    }
    const code = randomBytes(24).toString('base64url');
    this.codes.set(code, {
      identity,
      clientId: this.clientId,
      redirectUri: query.get('redirect_uri') ?? '',
      nonce: query.get('nonce') ?? '',
      codeChallenge: query.get('code_challenge') ?? '',
    });
    return { code, state: query.get('state') ?? '', redirectUri: query.get('redirect_uri') ?? '' };
  }

  private async handle(request: http.IncomingMessage, response: http.ServerResponse): Promise<void> {
    const url = new URL(request.url ?? '/', this.baseUrl);
    const base = this.options.path ?? '/oidc-gia-lap';
    const send = (status: number, body: unknown) => {
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(JSON.stringify(body));
    };
    if (request.method === 'GET' && url.pathname === `${base}/.well-known/openid-configuration`) {
      send(200, {
        issuer: this.issuer,
        authorization_endpoint: `${this.issuer}/authorize`,
        token_endpoint: `${this.issuer}/token`,
        jwks_uri: `${this.issuer}/jwks`,
        response_types_supported: ['code'],
        subject_types_supported: ['pairwise'],
        id_token_signing_alg_values_supported: ['RS256'],
        code_challenge_methods_supported: ['S256'],
      });
      return;
    }
    if (request.method === 'GET' && url.pathname === `${base}/jwks`) {
      this.jwksRequests += 1;
      send(200, { keys: this.keys.map((key) => key.publicJwk) });
      return;
    }
    if (request.method === 'GET' && url.pathname === `${base}/authorize`) {
      if (!this.nextIdentity) {
        send(400, { error: 'access_denied' });
        return;
      }
      const issued = this.authorize(url.toString(), this.nextIdentity);
      const target = new URL(issued.redirectUri);
      target.searchParams.set('code', issued.code);
      target.searchParams.set('state', issued.state);
      response.writeHead(302, { location: target.toString() });
      response.end();
      return;
    }
    if (request.method === 'POST' && url.pathname === `${base}/token`) {
      const chunks: Buffer[] = [];
      for await (const chunk of request) {
        chunks.push(chunk as Buffer);
      }
      const form = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
      send(...(await this.token(form, request.headers.authorization)));
      return;
    }
    send(404, { error: 'not_found' });
  }

  private async token(form: URLSearchParams, authorization: string | undefined): Promise<[number, unknown]> {
    let clientId = form.get('client_id');
    let clientSecret = form.get('client_secret');
    if (authorization?.startsWith('Basic ')) {
      const [id, secret] = Buffer.from(authorization.slice(6), 'base64').toString('utf8').split(':');
      clientId = decodeURIComponent(id ?? '');
      clientSecret = decodeURIComponent(secret ?? '');
    }
    if (clientId !== this.clientId || clientSecret !== this.clientSecret) {
      return [401, { error: 'invalid_client' }];
    }
    const code = form.get('code') ?? '';
    const issued = this.codes.get(code);
    this.codes.delete(code);
    if (!issued || form.get('grant_type') !== 'authorization_code' || form.get('redirect_uri') !== issued.redirectUri) {
      return [400, { error: 'invalid_grant' }];
    }
    const challenge = createHash('sha256')
      .update(form.get('code_verifier') ?? '')
      .digest('base64url');
    if (challenge !== issued.codeChallenge) {
      return [400, { error: 'invalid_grant', error_description: 'PKCE' }];
    }
    const identity = issued.identity;
    const signing = identity.tamper === 'signature' ? await newSigningKey() : (this.keys[0] as SigningKey);
    const now = Math.floor(Date.now() / 1000);
    const claims: Record<string, unknown> = {
      nonce: identity.tamper === 'nonce' ? 'nonce-khac' : issued.nonce,
      ...(identity.acr ? { acr: identity.acr } : {}),
      ...(identity.birthdate ? { birthdate: identity.birthdate } : {}),
    };
    const idToken = await new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: signing.kid })
      .setIssuer(identity.tamper === 'issuer' ? 'https://ben-phat-hanh-khac.localhost' : this.issuer)
      .setAudience(identity.tamper === 'audience' ? 'ung-dung-khac' : issued.clientId)
      .setSubject(identity.subject)
      .setIssuedAt(identity.tamper === 'expired' ? now - 7200 : now)
      .setExpirationTime(identity.tamper === 'expired' ? now - 3600 : now + 300)
      .sign(signing.privateKey);
    return [
      200,
      { access_token: randomBytes(16).toString('hex'), token_type: 'Bearer', expires_in: 300, id_token: idToken },
    ];
  }
}
