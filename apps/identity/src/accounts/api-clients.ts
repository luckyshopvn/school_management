import { createHash, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Injectable,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { ApiClientScope } from '@school-management/database';
import {
  Clock,
  readBearerToken,
  unauthenticatedError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import { AccessTokenGuard, type AuthenticatedRequest } from '../authentication/access-token.guard.js';
import { Infrastructure } from '../common/infrastructure.js';
import { forbidden } from './account-authority.js';
import type { CallerContext } from './accounts.service.js';
import { loadAssignments } from './assignments.js';
import { writeIdentityAuditLog } from './identity-audit-log.js';

// Khóa API cho đối tác chỉ đọc (P01-14; BM-65, BM-66; YCTD-63). Hiệu trưởng cấp và thu hồi; khóa chỉ hiện một lần khi
// cấp, lưu dạng băm. Máy chủ API gửi khóa và địa chỉ mạng của đối tác tới điểm cuối kiểm tra để biết phạm vi dữ liệu
const SCOPES: readonly ApiClientScope[] = ['reports', 'finance', 'children', 'staff'];
const PERSONAL_SCOPES: readonly ApiClientScope[] = ['children', 'staff'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const COLUMNS = [
  'id',
  'name',
  'partner_type',
  'scopes',
  'legal_basis',
  'key_prefix',
  'allowed_ips',
  'valid_until',
  'status',
  'created_at',
  'revoked_at',
  'last_used_at',
] as const;

export interface ApiClientInput {
  name: string;
  partnerType: string;
  scopes: ApiClientScope[];
  legalBasis: string | null;
  allowedIps: string[];
  validUntil: string;
}

const uuidParameter = (field: string) =>
  new ParseUUIDPipe({ exceptionFactory: () => validationError([{ field, message: 'Mã không hợp lệ' }]) });

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

// Địa chỉ IPv4 đi qua ổ cắm IPv6 có dạng ::ffff:a.b.c.d
export function normalizeIp(ip: string): string {
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

@Injectable()
export class ApiClientsService {
  constructor(
    private readonly infrastructure: Infrastructure,
    private readonly clock: Clock,
  ) {}

  private get database() {
    return this.infrastructure.database;
  }

  async list(caller: CallerContext) {
    await this.assertManager(caller);
    return this.database.selectFrom('api_clients').select(COLUMNS).orderBy('created_at', 'desc').execute();
  }

  async create(caller: CallerContext, input: ApiClientInput) {
    await this.assertManager(caller);
    if (input.validUntil <= VIETNAM_DATE.format(this.clock.now())) {
      throw validationError([{ field: 'valid_until', message: 'Ngày hết hạn phải sau hôm nay' }]);
    }
    const key = `sm_${randomBytes(24).toString('base64url')}`;
    const created = await this.database.transaction().execute(async (transaction) => {
      const row = await transaction
        .insertInto('api_clients')
        .values({
          name: input.name,
          partner_type: input.partnerType,
          scopes: JSON.stringify(input.scopes),
          legal_basis: input.legalBasis,
          key_prefix: key.slice(0, 10),
          key_hash: hashKey(key),
          allowed_ips: JSON.stringify(input.allowedIps.map(normalizeIp)),
          valid_until: input.validUntil,
          created_by: caller.claims.userId,
        })
        .returning(COLUMNS)
        .executeTakeFirstOrThrow();
      await writeIdentityAuditLog(transaction, {
        actorUserId: caller.claims.userId,
        entityName: 'api_clients',
        entityId: row.id,
        action: 'create',
        before: null,
        after: { ...input, key_prefix: row.key_prefix },
        ipAddress: caller.ipAddress,
      });
      return row;
    });
    // Khóa đầy đủ chỉ trả về một lần ở đây
    return { ...created, api_key: key };
  }

  async revoke(caller: CallerContext, clientId: string) {
    await this.assertManager(caller);
    const existing = await this.database
      .selectFrom('api_clients')
      .select(COLUMNS)
      .where('id', '=', clientId)
      .executeTakeFirst();
    if (!existing) {
      throw validationError([{ field: 'id', message: 'Không tìm thấy khóa API' }]);
    }
    return this.database.transaction().execute(async (transaction) => {
      const row = await transaction
        .updateTable('api_clients')
        .set({ status: 'revoked', revoked_by: caller.claims.userId, revoked_at: this.clock.now() })
        .where('id', '=', clientId)
        .returning(COLUMNS)
        .executeTakeFirstOrThrow();
      await writeIdentityAuditLog(transaction, {
        actorUserId: caller.claims.userId,
        entityName: 'api_clients',
        entityId: clientId,
        action: 'revoke',
        before: { status: existing.status },
        after: { status: 'revoked' },
        ipAddress: caller.ipAddress,
      });
      return row;
    });
  }

  // Khóa còn hiệu lực, chưa hết hạn, gọi từ địa chỉ mạng cho phép thì trả phạm vi; ngược lại từ chối như mã phiên sai
  async verify(input: { key: string; ip: string }) {
    const client = await this.database
      .selectFrom('api_clients')
      .select(['id', 'name', 'scopes', 'legal_basis', 'allowed_ips', 'valid_until', 'status'])
      .where('key_hash', '=', hashKey(input.key))
      .executeTakeFirst();
    const today = VIETNAM_DATE.format(this.clock.now());
    if (
      !client ||
      client.status !== 'active' ||
      client.valid_until < today ||
      !client.allowed_ips.includes(normalizeIp(input.ip))
    ) {
      throw unauthenticatedError('Khóa API không hợp lệ, đã thu hồi, hết hạn hoặc gọi từ địa chỉ mạng không được phép');
    }
    await this.database
      .updateTable('api_clients')
      .set({ last_used_at: this.clock.now() })
      .where('id', '=', client.id)
      .execute();
    return { id: client.id, name: client.name, scopes: client.scopes, legal_basis: client.legal_basis };
  }

  private async assertManager(caller: CallerContext): Promise<void> {
    const assignments = (await loadAssignments(this.database, [caller.claims.userId])).get(caller.claims.userId) ?? [];
    if (!assignments.some((assignment) => assignment.permissions.includes(PERMISSION_CODES.apiClientManage))) {
      throw forbidden('Chỉ Hiệu trưởng được quản lý khóa API cho đối tác');
    }
  }
}

function callerOf(request: AuthenticatedRequest): CallerContext {
  return {
    claims: request.accessTokenClaims,
    accessToken: readBearerToken(request.header('authorization')),
    ipAddress: request.ip ?? null,
  };
}

function readInput(body: Record<string, unknown> | undefined): ApiClientInput {
  const errors: FieldError[] = [];
  const text = (field: string, maximum: number) => {
    const value = typeof body?.[field] === 'string' ? (body[field] as string).trim() : '';
    if (!value || value.length > maximum) {
      errors.push({ field, message: `Bắt buộc nhập, tối đa ${maximum} ký tự` });
    }
    return value;
  };
  const name = text('name', 200);
  const partnerType = text('partner_type', 100);
  const scopes = Array.isArray(body?.scopes) ? (body.scopes as unknown[]) : [];
  if (scopes.length === 0 || scopes.some((scope) => !SCOPES.includes(scope as ApiClientScope))) {
    errors.push({ field: 'scopes', message: `Chọn ít nhất một phạm vi trong: ${SCOPES.join(', ')}` });
  }
  const legalBasis = typeof body?.legal_basis === 'string' && body.legal_basis.trim() ? body.legal_basis.trim() : null;
  // Đối tác chỉ đọc dữ liệu cá nhân khi khóa ghi căn cứ pháp lý (BM-66)
  if (!legalBasis && scopes.some((scope) => PERSONAL_SCOPES.includes(scope as ApiClientScope))) {
    errors.push({ field: 'legal_basis', message: 'Phạm vi có dữ liệu cá nhân bắt buộc ghi căn cứ pháp lý' });
  }
  const allowedIps = Array.isArray(body?.allowed_ips) ? (body.allowed_ips as unknown[]) : [];
  if (allowedIps.length === 0 || allowedIps.some((ip) => typeof ip !== 'string' || isIP(ip) === 0)) {
    errors.push({ field: 'allowed_ips', message: 'Nhập ít nhất một địa chỉ mạng hợp lệ' });
  }
  const validUntil = body?.valid_until;
  if (typeof validUntil !== 'string' || !DATE_PATTERN.test(validUntil)) {
    errors.push({ field: 'valid_until', message: 'Ngày hết hạn dạng YYYY-MM-DD' });
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return {
    name,
    partnerType,
    scopes: [...new Set(scopes as ApiClientScope[])],
    legalBasis,
    allowedIps: allowedIps as string[],
    validUntil: validUntil as string,
  };
}

@Controller('api-clients')
export class ApiClientsController {
  constructor(private readonly apiClients: ApiClientsService) {}

  @Get()
  @UseGuards(AccessTokenGuard)
  list(@Req() request: AuthenticatedRequest) {
    return this.apiClients.list(callerOf(request));
  }

  @Post()
  @UseGuards(AccessTokenGuard)
  create(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown> | undefined) {
    return this.apiClients.create(callerOf(request), readInput(body));
  }

  @Post(':id/revoke')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard)
  revoke(@Req() request: AuthenticatedRequest, @Param('id', uuidParameter('id')) clientId: string) {
    return this.apiClients.revoke(callerOf(request), clientId);
  }

  // Máy chủ API gọi để kiểm tra khóa của đối tác; không cần mã phiên, chỉ trả phạm vi khi khóa hợp lệ
  @Post('verify')
  @HttpCode(200)
  verify(@Req() _request: Request, @Body() body: Record<string, unknown> | undefined) {
    const key = typeof body?.key === 'string' ? body.key : '';
    const ip = typeof body?.ip === 'string' ? body.ip : '';
    if (!key || !ip) {
      throw unauthenticatedError('Thiếu khóa API');
    }
    return this.apiClients.verify({ key, ip });
  }
}
