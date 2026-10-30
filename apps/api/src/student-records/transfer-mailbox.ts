import { Inject, Injectable, Optional } from '@nestjs/common';
import type { PlatformDatabase, TenancyRuntime } from '@school-management/database';
import { ApplicationError, Clock, currentTenant, ruleViolationError, validationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import { sql, type Kysely } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { TENANCY_RUNTIME } from '../common/configuration.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { notFoundError } from '../common/request-fields.js';
import type { RowError } from '../imports/excel.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import {
  generateMailboxSecret,
  generateSchoolTransferKeys,
  MAILBOX_EXPIRY_DAYS,
  MAILBOX_PURGE_DAYS,
  signedText,
  signEnvelope,
  unwrapSecret,
  verifyEnvelope,
  wrapSecret,
  type SchoolTransferKeyRow,
} from './transfer-mailbox-rules.js';
import { openTransferPackage, type OpenedTransferPackage } from './transfer-package-rules.js';
import { TransferPackagesService, type TransferPackageInput } from './transfer-packages.js';

// Hộp thư chuyển trường giữa các trường trên nền tảng, lát L2 (YCTD-390; BR-510 đến BR-514, BM-260 đến BM-262). Chỉ có ở bản nhiều
// trường. Mỗi trường tự bật nhận, gửi hồ sơ chuyển trường trong hệ thống (mặc định tắt); danh bạ chỉ có trường đã bật, không có dữ
// liệu học sinh. Trường đi gửi gói đã ký, mã hóa cho đúng trường đến; trường đến chỉ thấy, mở thư gửi cho mình; trường đi chỉ thấy
// trạng thái thư mình gửi. Không trường nào ghi vào cơ sở dữ liệu của trường kia: trường đi thấy "Trường đến đã tiếp nhận" rồi tự
// duyệt chuyển đi như lát L1
const DAY = 24 * 60 * 60 * 1000;
const mailboxRule = (code: string, message: string) => ruleViolationError(code, message);
const MAXIMUM_NOTE = 500;

export interface MailboxDirectoryEntry {
  school_id: string;
  name: string;
  moet_code: string | null;
  commune_name: string | null;
  school_levels: string[];
}

@Injectable()
export class TransferMailboxService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly packages: TransferPackagesService,
    private readonly clock: Clock,
    @Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null = null,
  ) {}

  // Bản một trường hoặc chưa có ngữ cảnh trường: không có hộp thư
  private context(): { platform: Kysely<PlatformDatabase>; schoolId: string; masterKey: Buffer } | null {
    const tenant = currentTenant();
    return this.tenancy && tenant
      ? { platform: this.tenancy.platform, schoolId: tenant.schoolId, masterKey: this.tenancy.configuration.masterKey }
      : null;
  }

  private require() {
    const context = this.context();
    if (!context) {
      throw notFoundError('Hộp thư chuyển trường chỉ có ở bản nhiều trường', 'transfer_mailbox');
    }
    return context;
  }

  private async enabled(platform: Kysely<PlatformDatabase>, schoolId: string): Promise<boolean> {
    const row = await platform
      .selectFrom('school_transfer_settings')
      .select('enabled')
      .where('school_id', '=', schoolId)
      .executeTakeFirst();
    return row?.enabled ?? false;
  }

  private async requireEnabled(platform: Kysely<PlatformDatabase>, schoolId: string) {
    if (!(await this.enabled(platform, schoolId))) {
      throw mailboxRule('BR-510', 'Trường chưa bật nhận, gửi hồ sơ chuyển trường trong hệ thống');
    }
  }

  // Khóa của trường; tạo lần đầu khi cần
  private async keysOf(platform: Kysely<PlatformDatabase>, schoolId: string, masterKey: Buffer) {
    const existing = await platform
      .selectFrom('school_transfer_keys')
      .selectAll()
      .where('school_id', '=', schoolId)
      .executeTakeFirst();
    if (existing) {
      return existing;
    }
    await platform
      .insertInto('school_transfer_keys')
      .values({ school_id: schoolId, ...generateSchoolTransferKeys(masterKey) })
      .onConflict((conflict) => conflict.column('school_id').doNothing())
      .execute();
    return platform
      .selectFrom('school_transfer_keys')
      .selectAll()
      .where('school_id', '=', schoolId)
      .executeTakeFirstOrThrow();
  }

  // Xóa gói đã quá hạn giữ, đặt hết hạn cho thư chưa ai mở quá 90 ngày (BM-242); chạy mỗi lần trường xem hộp thư
  private async purge(platform: Kysely<PlatformDatabase>) {
    const now = this.clock.now();
    await platform
      .updateTable('transfer_mailbox')
      .set({ state: 'expired', updated_at: now, purge_after: now })
      .where('state', 'in', ['sent', 'opened'])
      .where('expires_at', '<', now)
      .execute();
    await platform
      .updateTable('transfer_mailbox')
      .set({ envelope: null, wrapped_secret: null, updated_at: now })
      .where('purge_after', '<=', now)
      .where('envelope', 'is not', null)
      .execute();
  }

  // ---------- Cài đặt

  async settings() {
    const context = this.context();
    if (!context) {
      return { available: false, enabled: false, updated_by_name: null, updated_at: null };
    }
    const row = await context.platform
      .selectFrom('school_transfer_settings')
      .selectAll()
      .where('school_id', '=', context.schoolId)
      .executeTakeFirst();
    return {
      available: true,
      enabled: row?.enabled ?? false,
      updated_by_name: row?.updated_by_name ?? null,
      updated_at: row?.updated_at ?? null,
    };
  }

  async updateSettings(enabled: boolean, origin: ChangeOrigin) {
    const { platform, schoolId, masterKey } = this.require();
    const now = this.clock.now();
    await platform
      .insertInto('school_transfer_settings')
      .values({ school_id: schoolId, enabled, updated_by_name: origin.actorName, updated_at: now })
      .onConflict((conflict) =>
        conflict.column('school_id').doUpdateSet({ enabled, updated_by_name: origin.actorName, updated_at: now }),
      )
      .execute();
    if (enabled) {
      await this.keysOf(platform, schoolId, masterKey);
    }
    const { database } = await this.currentSchoolYear.require();
    await writeAuditLog(database, {
      origin,
      orgUnitId: null,
      entityName: 'school_transfer_settings',
      entityId: schoolId,
      action: 'update',
      before: null,
      after: { enabled },
    });
    return this.settings();
  }

  // ---------- Danh bạ trường (không có dữ liệu học sinh)

  async directory(query: string | null): Promise<MailboxDirectoryEntry[]> {
    const { platform, schoolId } = this.require();
    await this.requireEnabled(platform, schoolId);
    let selection = platform
      .selectFrom('schools')
      .innerJoin('school_transfer_settings', 'school_transfer_settings.school_id', 'schools.id')
      .leftJoin('catalog_units', 'catalog_units.moet_code', 'schools.moet_code')
      .leftJoin('catalog_communes', 'catalog_communes.code', 'catalog_units.commune_code')
      .select([
        'schools.id as school_id',
        'schools.name',
        'schools.moet_code',
        'schools.school_levels',
        sql<string | null>`coalesce(catalog_communes.name, catalog_units.commune_name_raw)`.as('commune_name'),
      ])
      .where('school_transfer_settings.enabled', '=', true)
      .where('schools.status', 'in', ['active', 'trial'])
      .where('schools.id', '!=', schoolId);
    if (query) {
      const pattern = `%${query.replace(/[%_\\]/g, '\\$&')}%`;
      selection = selection.where((expression) =>
        expression.or([
          expression('schools.name', 'ilike', pattern),
          expression('schools.moet_code', 'ilike', pattern),
        ]),
      );
    }
    const rows = await selection.orderBy('schools.name').limit(50).execute();
    return rows.map((row) => ({
      school_id: row.school_id,
      name: row.name,
      moet_code: row.moet_code,
      commune_name: row.commune_name,
      school_levels: Array.isArray(row.school_levels) ? (row.school_levels as string[]) : [],
    }));
  }

  // ---------- Trường đi: gửi, thu hồi

  async send(
    currentUser: CurrentUser,
    transferId: string,
    input: TransferPackageInput & { toSchoolId: string },
    origin: ChangeOrigin,
  ) {
    const { platform, schoolId, masterKey } = this.require();
    await this.requireEnabled(platform, schoolId);
    if (input.toSchoolId === schoolId) {
      throw validationError([{ field: 'to_school_id', message: 'Chọn trường khác trường mình' }]);
    }
    const receiver = await platform
      .selectFrom('schools')
      .innerJoin('school_transfer_settings', 'school_transfer_settings.school_id', 'schools.id')
      .select(['schools.id', 'schools.name', 'schools.moet_code', 'schools.code'])
      .where('schools.id', '=', input.toSchoolId)
      .where('school_transfer_settings.enabled', '=', true)
      .where('schools.status', 'in', ['active', 'trial'])
      .executeTakeFirst();
    if (!receiver) {
      throw mailboxRule('BR-510', 'Trường đến không có trong danh bạ chuyển trường');
    }
    const { database } = await this.currentSchoolYear.require();
    const current = await database
      .selectFrom('student_transfers')
      .select(['mailbox_id', 'org_unit_id'])
      .where('id', '=', transferId)
      .executeTakeFirst();
    if (current?.mailbox_id) {
      const previous = await platform
        .selectFrom('transfer_mailbox')
        .select('state')
        .where('id', '=', current.mailbox_id)
        .executeTakeFirst();
      if (previous && ['sent', 'opened', 'accepted'].includes(previous.state)) {
        throw mailboxRule('BR-511', 'Đề nghị đã có gói đang gửi hoặc đã được tiếp nhận; thu hồi trước khi gửi lại');
      }
    }
    const senderKeys = await this.keysOf(platform, schoolId, masterKey);
    const receiverKeys = await this.keysOf(platform, receiver.id, masterKey);
    const secret = generateMailboxSecret();
    const sealed = await this.packages.seal(currentUser, transferId, input, origin, {
      password: secret,
      destination: { school_name: receiver.name, code: receiver.moet_code ?? receiver.code },
    });
    const now = this.clock.now();
    const signature = signEnvelope(
      masterKey,
      senderKeys,
      signedText(sealed.packageCode, schoolId, receiver.id, sealed.sealed.sha256),
    );
    const mailbox = await platform
      .insertInto('transfer_mailbox')
      .values({
        kind: 'student_transfer',
        package_code: sealed.packageCode,
        from_school_id: schoolId,
        to_school_id: receiver.id,
        envelope: sealed.sealed.body,
        wrapped_secret: JSON.stringify(wrapSecret(receiverKeys.encryption_public_key, secret)),
        envelope_sha256: sealed.sealed.sha256,
        signature,
        sent_at: now,
        expires_at: new Date(now.getTime() + MAILBOX_EXPIRY_DAYS * DAY),
      })
      .returning(['id', 'state', 'sent_at', 'expires_at'])
      .executeTakeFirstOrThrow();
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('student_transfers')
        .set({ mailbox_id: mailbox.id, partner_school_id: receiver.id, updated_at: now })
        .where('id', '=', transferId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: sealed.transfer.org_unit_id,
        entityName: 'student_transfers',
        entityId: transferId,
        action: 'update',
        before: { mailbox_id: current?.mailbox_id ?? null },
        after: { mailbox_id: mailbox.id, to_school_id: receiver.id, package_code: sealed.packageCode },
      });
    });
    return {
      mailbox_id: mailbox.id,
      package_code: sealed.packageCode,
      to_school_name: receiver.name,
      state: mailbox.state,
      sent_at: mailbox.sent_at,
      expires_at: mailbox.expires_at,
    };
  }

  async revoke(currentUser: CurrentUser, transferId: string, origin: ChangeOrigin) {
    const { platform, schoolId } = this.require();
    const { database } = await this.currentSchoolYear.require();
    const transfer = await database
      .selectFrom('student_transfers')
      .select(['id', 'org_unit_id', 'mailbox_id'])
      .where('id', '=', transferId)
      .where('direction', '=', 'out')
      .executeTakeFirst();
    if (!transfer?.mailbox_id) {
      throw notFoundError('Đề nghị chưa gửi qua hộp thư', 'transfer_mailbox');
    }
    await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.childApprove, transfer.org_unit_id);
    const now = this.clock.now();
    const revoked = await platform
      .updateTable('transfer_mailbox')
      .set({ state: 'revoked', decided_at: now, updated_at: now, purge_after: now })
      .where('id', '=', transfer.mailbox_id)
      .where('from_school_id', '=', schoolId)
      .where('state', 'in', ['sent', 'opened'])
      .returning('id')
      .executeTakeFirst();
    if (!revoked) {
      throw mailboxRule('BR-511', 'Chỉ thu hồi được gói trường đến chưa tiếp nhận hoặc từ chối');
    }
    await this.purge(platform);
    await writeAuditLog(database, {
      origin,
      orgUnitId: transfer.org_unit_id,
      entityName: 'student_transfers',
      entityId: transfer.id,
      action: 'update',
      before: null,
      after: { mailbox_id: transfer.mailbox_id, state: 'revoked' },
    });
    return { mailbox_id: transfer.mailbox_id, state: 'revoked' };
  }

  // Trạng thái các thư trường mình đã gửi (lưới chuyển đi hiện "Trường đến đã tiếp nhận"...)
  async outbox() {
    const context = this.context();
    if (!context) {
      return [];
    }
    await this.purge(context.platform);
    return context.platform
      .selectFrom('transfer_mailbox')
      .innerJoin('schools', 'schools.id', 'transfer_mailbox.to_school_id')
      .select([
        'transfer_mailbox.id',
        'transfer_mailbox.package_code',
        'transfer_mailbox.state',
        'transfer_mailbox.decision_note',
        'transfer_mailbox.sent_at',
        'transfer_mailbox.decided_at',
        'transfer_mailbox.expires_at',
        'schools.name as to_school_name',
      ])
      .where('transfer_mailbox.from_school_id', '=', context.schoolId)
      .orderBy('transfer_mailbox.sent_at', 'desc')
      .limit(500)
      .execute();
  }

  // ---------- Trường đến: hộp nhận, xem, tiếp nhận, từ chối

  async inbox() {
    const context = this.context();
    if (!context) {
      return [];
    }
    await this.purge(context.platform);
    return context.platform
      .selectFrom('transfer_mailbox')
      .innerJoin('schools', 'schools.id', 'transfer_mailbox.from_school_id')
      .select([
        'transfer_mailbox.id',
        'transfer_mailbox.package_code',
        'transfer_mailbox.state',
        'transfer_mailbox.sent_at',
        'transfer_mailbox.decided_at',
        'transfer_mailbox.expires_at',
        'schools.name as from_school_name',
        'schools.moet_code as from_school_moet_code',
      ])
      .where('transfer_mailbox.to_school_id', '=', context.schoolId)
      .orderBy('transfer_mailbox.sent_at', 'desc')
      .limit(500)
      .execute();
  }

  // Mở thư gửi cho trường mình: kiểm chữ ký của trường đi, giải mã mật khẩu bằng khóa của trường mình, mở gói như lát L1
  private async open(mailboxId: string): Promise<{
    opened: OpenedTransferPackage;
    platform: Kysely<PlatformDatabase>;
    row: { id: string; from_school_id: string; package_code: string; state: string };
  }> {
    const { platform, schoolId, masterKey } = this.require();
    await this.requireEnabled(platform, schoolId);
    const row = await platform
      .selectFrom('transfer_mailbox')
      .selectAll()
      .where('id', '=', mailboxId)
      .where('to_school_id', '=', schoolId)
      .executeTakeFirst();
    if (!row) {
      throw notFoundError('Không có thư chuyển trường này', 'transfer_mailbox');
    }
    if (!['sent', 'opened'].includes(row.state) || !row.envelope || !row.wrapped_secret) {
      throw mailboxRule('BR-511', 'Gói đã được xử lý, đã thu hồi hoặc đã hết hạn');
    }
    const senderKeys = await platform
      .selectFrom('school_transfer_keys')
      .select('signing_public_key')
      .where('school_id', '=', row.from_school_id)
      .executeTakeFirst();
    const data = signedText(row.package_code, row.from_school_id, schoolId, row.envelope_sha256);
    if (!senderKeys || !verifyEnvelope(senderKeys.signing_public_key, data, row.signature)) {
      throw mailboxRule('BR-512', 'Chữ ký của trường đi không hợp lệ; không mở gói');
    }
    const ownKeys = (await this.keysOf(platform, schoolId, masterKey)) as SchoolTransferKeyRow;
    const secret = unwrapSecret(masterKey, ownKeys, row.wrapped_secret);
    const opened = openTransferPackage(Buffer.from(row.envelope), secret);
    if (opened.sha256 !== row.envelope_sha256 || opened.manifest.package_code !== row.package_code) {
      throw mailboxRule('BR-512', 'Gói không khớp mã băm đã ký');
    }
    return { opened, platform, row };
  }

  async preview(mailboxId: string) {
    const { opened, platform, row } = await this.open(mailboxId);
    if (row.state === 'sent') {
      await platform
        .updateTable('transfer_mailbox')
        .set({ state: 'opened', updated_at: this.clock.now() })
        .where('id', '=', row.id)
        .where('state', '=', 'sent')
        .execute();
    }
    return { mailbox_id: row.id, ...(await this.packages.previewOpened(opened)) };
  }

  async accept(
    currentUser: CurrentUser,
    accessToken: string,
    mailboxId: string,
    input: { classId: string; fromDate: string; confirmOverCapacity: boolean },
    origin: ChangeOrigin,
  ): Promise<{ errors: RowError[]; transfer_id: string | null; child_id: string | null }> {
    const { opened, platform, row } = await this.open(mailboxId);
    const result = await this.packages.acceptOpened(currentUser, accessToken, opened, input, origin);
    if (!result.transfer_id) {
      return result;
    }
    const now = this.clock.now();
    await platform
      .updateTable('transfer_mailbox')
      .set({
        state: 'accepted',
        decided_at: now,
        updated_at: now,
        purge_after: new Date(now.getTime() + MAILBOX_PURGE_DAYS * DAY),
      })
      .where('id', '=', row.id)
      .execute();
    const { database } = await this.currentSchoolYear.require();
    await database
      .updateTable('student_transfers')
      .set({ mailbox_id: row.id, partner_school_id: row.from_school_id, updated_at: now })
      .where('id', '=', result.transfer_id)
      .execute();
    return result;
  }

  async reject(currentUser: CurrentUser, mailboxId: string, note: string, origin: ChangeOrigin) {
    const { platform, schoolId } = this.require();
    if (!currentUser.hasPermission(PERMISSION_CODES.childApprove)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Cần quyền duyệt hồ sơ');
    }
    if (!note.trim() || note.length > MAXIMUM_NOTE) {
      throw validationError([{ field: 'note', message: `Nhập lý do từ chối, tối đa ${MAXIMUM_NOTE} ký tự` }]);
    }
    const now = this.clock.now();
    const rejected = await platform
      .updateTable('transfer_mailbox')
      .set({
        state: 'rejected',
        decision_note: note.trim(),
        decided_at: now,
        updated_at: now,
        purge_after: new Date(now.getTime() + MAILBOX_PURGE_DAYS * DAY),
      })
      .where('id', '=', mailboxId)
      .where('to_school_id', '=', schoolId)
      .where('state', 'in', ['sent', 'opened'])
      .returning(['id', 'package_code'])
      .executeTakeFirst();
    if (!rejected) {
      throw notFoundError('Không có thư chuyển trường chờ xử lý này', 'transfer_mailbox');
    }
    const { database } = await this.currentSchoolYear.require();
    await writeAuditLog(database, {
      origin,
      orgUnitId: null,
      entityName: 'transfer_mailbox',
      entityId: rejected.id,
      action: 'update',
      before: null,
      after: { state: 'rejected', package_code: rejected.package_code, note: note.trim() },
    });
    return { mailbox_id: rejected.id, state: 'rejected' };
  }
}
