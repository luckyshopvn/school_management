import { Injectable } from '@nestjs/common';
import type {
  SigningDossierStatus,
  SigningEventAction,
  SigningObjectType,
  SigningSignatureType,
  SystemDatabase,
} from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, validationError } from '@school-management/server';
import {
  isSigningProvider,
  PERMISSION_CODES,
  SIGNING_DOSSIER_ROOTS,
  SIGNING_HIDDEN_OBJECT_TYPES,
  SIGNING_IDENTITY_OBJECT_TYPES,
  SIGNING_OBJECT_LABELS,
  SIGNING_SIGNATURE_TYPE_LABELS,
  type SigningDocument,
} from '@school-management/shared';
import { sql, type Kysely, type Transaction } from 'kysely';
import { createHash, randomUUID } from 'node:crypto';
import type { CurrentUser } from '../authentication/current-user.js';
import { ChildDataProtection } from '../common/child-data-protection.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { notFoundError } from '../common/request-fields.js';
import { buildPdf, CONTENT_TYPES, type TableFileSheet } from '../exports/table-file.js';
import { buildFacilitiesWorkbook, fileStamp, type ExportedFile } from '../facilities/facilities-workbook.js';
import { FileStorage } from '../files/file-storage.js';
import { DossierSigner, withHeading } from './dossier-signer.js';
import { DossierXmlWriter } from './dossier-xml.js';
import {
  buildDossierContent,
  classLogRows,
  CLASS_LOG_COLUMNS,
  contentHash,
  describeChanges,
  documentSheets,
  dossierTitle,
  listSigningObjects,
  sheetsDocument,
} from './signing-content.js';

// Phân hệ Quản lý kí hồ sơ (mục 6 của Sở), bản chạy nội bộ (DT-16 phần 16k; quyết định của Eric ngày 2026-10-16: tính năng
// cần hệ thống bên ngoài làm bản chạy nội bộ, có đủ màn hình, cột, nút như Sở, nút ghi đúng việc làm, có chỗ nối để cắm kết
// nối thật). Quy trình một hồ sơ:
// - Tạo hồ sơ: lập tệp PDF từ dữ liệu hiện tại của đối tượng (trường, lớp, nhân sự, học sinh, sổ đầu bài theo tháng), cấp mã
//   định danh hồ sơ, lưu tệp và mã băm SHA-256;
// - Kí xác nhận nội bộ: người có quyền kí, khi chứng thư số nhà trường đã đăng ký kí nội bộ và còn hiệu lực, lập tệp đã kí qua
//   DossierSigner (bản nội bộ không phải chữ ký số);
// - Tải thông tin thay đổi: so dữ liệu hiện tại với số liệu đã lập hồ sơ, ghi ngày thay đổi và nội dung khác biệt;
// - Hủy hồ sơ (chưa xác nhận hoàn thành) để tạo lại; Xác nhận hoàn thành hồ sơ đã kí, khóa hồ sơ; Hủy xác nhận khi chưa gửi;
// - Đánh dấu đã gửi: phần mềm không truyền hồ sơ lên cấp trên; người dùng tải tệp đã kí, nộp bằng tay rồi đánh dấu kèm ngày.
// Mọi thao tác cần phạm vi toàn trường; lịch sử ghi ở signing_events.
// DT-17 phần 17b (YCTD-133) chỉnh theo bốn mẫu thật của Sở: nội dung theo phần và mục của Sở, thêm tệp dữ liệu XML, kiểu chữ
// ký và nhà phát hành theo biểu mẫu đăng ký của Sở, đối tượng tạo hồ sơ không được ghi lý do ("Tải file lỗi"), không tạo hồ
// sơ sổ đầu bài mới ở cấp Mầm non. Hồ sơ nhân sự, học sinh in đủ số định danh, CCCD, sổ BHXH theo mẫu (quyết định của Eric
// ngày 2026-10-19, ngoại lệ có kiểm soát của quy định che số ở YCTD-13): chỉ người có quyền xem số định danh ở phạm vi toàn
// trường tạo, xem, tải, tải thông tin thay đổi của hai loại hồ sơ này
export const SIGNING_RULE_CODE = 'YCTD-130';
export const SIGNING_SO_RULE_CODE = 'YCTD-133';
const VIEW = PERMISSION_CODES.signingView;
const MANAGE = PERMISSION_CODES.signingManage;
const SIGN = PERMISSION_CODES.signingSign;
const CERTIFICATE = PERMISSION_CODES.signingCertificate;
const NATIONAL_ID = PERMISSION_CODES.nationalIdView;
export const CONTENT_TYPE_XML = 'application/xml; charset=utf-8';
export const MAXIMUM_SEAL_BYTES = 1024 * 1024;
export const MAXIMUM_BATCH = 500;
const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const VIETNAM_TIME = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const IMAGE_SIGNATURES: Array<{ contentType: string; bytes: number[] }> = [
  { contentType: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { contentType: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
];
const ACTIVE_STATUSES: SigningDossierStatus[] = ['created', 'signed', 'completed', 'sent'];

export interface CertificateInput {
  signature_type: SigningSignatureType;
  provider: string | null;
  login_name: string | null;
  holder_name: string | null;
  holder_title: string | null;
  serial_number: string | null;
  valid_from: string | null;
  valid_to: string | null;
}

const DOSSIER_COLUMNS = [
  'id',
  'code',
  'object_type',
  'object_id',
  'period',
  'object_label',
  'status',
  'file_name',
  'file_sha256',
  'created_by_name',
  'created_at',
  'signature_method',
  'signed_file_name',
  'signed_sha256',
  'signed_at',
  'signed_by_name',
  'changed_at',
  'change_summary',
  'checked_at',
  'completed_at',
  'completed_by_name',
  'sent_on',
  'sent_note',
  'sent_by_name',
  'cancelled_at',
  'cancelled_by_name',
  'cancel_reason',
  'updated_at',
  'xml_file_name',
  'xml_sha256',
  'note',
] as const;

const sha256 = (body: Buffer) => createHash('sha256').update(body).digest('hex');

// Số liệu đã lập hồ sơ: từ phần 17b lưu nội dung theo phần và mục; hồ sơ của 16k chỉ lưu bảng của tệp PDF
interface DossierSnapshot {
  title: string;
  document?: SigningDocument;
  sheets?: TableFileSheet[];
}

const snapshotSheets = (snapshot: DossierSnapshot) =>
  snapshot.sheets ?? (snapshot.document ? documentSheets(snapshot.document) : []);

function detectImage(body: Buffer): string | undefined {
  return IMAGE_SIGNATURES.find((signature) => signature.bytes.every((byte, index) => body[index] === byte))
    ?.contentType;
}

@Injectable()
export class SigningService {
  constructor(
    private readonly databases: Databases,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly fileStorage: FileStorage,
    private readonly signer: DossierSigner,
    private readonly xmlWriter: DossierXmlWriter,
    private readonly protection: ChildDataProtection,
    private readonly clock: Clock,
  ) {}

  private readonly decrypt = (encoded: string) => this.protection.decrypt(encoded);

  // Hồ sơ nhân sự, học sinh in đủ số định danh: cần thêm quyền xem số định danh ở phạm vi toàn trường
  private canSeeIdentity(currentUser: CurrentUser): boolean {
    return currentUser.organizationScope(NATIONAL_ID).wholeSchool;
  }

  private assertIdentity(currentUser: CurrentUser, type: SigningObjectType): void {
    if (SIGNING_IDENTITY_OBJECT_TYPES.includes(type) && !this.canSeeIdentity(currentUser)) {
      throw new ApplicationError(
        'ERR_FORBIDDEN',
        `${SIGNING_OBJECT_LABELS[type]} in đủ số định danh, số CCCD: cần quyền xem số định danh cá nhân ở phạm vi toàn trường`,
      );
    }
  }

  private get system(): Kysely<SystemDatabase> {
    return this.databases.system;
  }

  // Có một trong các quyền và quyền đó ở phạm vi toàn trường
  private assertAny(currentUser: CurrentUser, codes: string[], message: string): void {
    if (!codes.some((code) => currentUser.organizationScope(code).wholeSchool)) {
      throw new ApplicationError('ERR_FORBIDDEN', message);
    }
  }

  private today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  private async event(
    executor: Kysely<SystemDatabase> | Transaction<SystemDatabase>,
    dossierId: string | null,
    action: SigningEventAction,
    note: string | null,
    currentUser: CurrentUser,
  ): Promise<void> {
    await executor
      .insertInto('signing_events')
      .values({
        dossier_id: dossierId,
        action,
        note: note?.slice(0, 2000) ?? null,
        actor_id: currentUser.id,
        actor_name: currentUser.description.full_name,
      })
      .execute();
  }

  // ---- 1.1 Chứng thư số nhà trường, 2.1 Đồng bộ chứng thư số ----

  private certificateRow() {
    return this.system.selectFrom('signing_certificates').selectAll().executeTakeFirst();
  }

  private async ensureCertificate() {
    await this.system
      .insertInto('signing_certificates')
      .values({ singleton: true })
      .onConflict((conflict) => conflict.column('singleton').doNothing())
      .execute();
    const row = await this.certificateRow();
    if (!row) {
      throw new Error('Không tạo được bản ghi chứng thư số');
    }
    return row;
  }

  async certificate(currentUser: CurrentUser) {
    this.assertAny(currentUser, [VIEW, CERTIFICATE], 'Bạn không có quyền xem chứng thư số nhà trường');
    const row = await this.certificateRow();
    const events = row
      ? await this.system
          .selectFrom('signing_events')
          .select(['id', 'action', 'note', 'actor_name', 'created_at'])
          .where('dossier_id', 'is', null)
          .orderBy('created_at', 'desc')
          .limit(50)
          .execute()
      : [];
    return {
      school: await this.schoolInfo(),
      // Nhà phát hành nhập tự do ở 16k ngoài năm giá trị của Sở: giữ lại, hiện cảnh báo, chọn lại mới đăng ký được
      provider_in_list: !row?.provider || isSigningProvider(row.provider),
      signature_type: row?.signature_type ?? 'remote',
      provider: row?.provider ?? null,
      login_name: row?.login_name ?? null,
      holder_name: row?.holder_name ?? null,
      holder_title: row?.holder_title ?? null,
      serial_number: row?.serial_number ?? null,
      valid_from: row?.valid_from ?? null,
      valid_to: row?.valid_to ?? null,
      status: row?.status ?? 'draft',
      registered_at: row?.registered_at ?? null,
      registered_by_name: row?.registered_by_name ?? null,
      sync_status: row?.sync_status ?? 'not_synced',
      synced_on: row?.synced_on ?? null,
      sync_note: row?.sync_note ?? null,
      synced_by_name: row?.synced_by_name ?? null,
      has_seal: Boolean(row?.seal_storage_key),
      seal_file_name: row?.seal_file_name ?? null,
      updated_at: row?.updated_at ?? null,
      expired: Boolean(row?.valid_to && row.valid_to < this.today()),
      can_manage: currentUser.organizationScope(CERTIFICATE).wholeSchool,
      digital_signer: this.signer.digital,
      signer_description: this.signer.description,
      events,
    };
  }

  // Mã trường, tên trường, email, website hiện ở 1.1 và 2.1 như Sở; tên hiệu trưởng dùng cho lưới 2.2, 2.3
  // Chưa có năm học hoặc chưa có Trường chính thì để trống
  private async schoolInfo() {
    const empty = { code: null, name: null, principal_name: null, email: null, website: null };
    try {
      const { academicYearId, database } = await this.currentSchoolYear.require();
      const [school] = await listSigningObjects(database, academicYearId, 'school');
      if (!school) {
        return empty;
      }
      const profile = await database
        .selectFrom('school_profiles')
        .select('general')
        .where('org_unit_id', '=', school.object_id)
        .executeTakeFirst();
      const general = (profile?.general ?? {}) as Record<string, unknown>;
      const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
      return {
        code: school.code,
        name: school.object_label,
        principal_name: school.principal_name,
        email: text(general.email),
        website: text(general.website),
      };
    } catch (error) {
      if (error instanceof ApplicationError) {
        return empty;
      }
      throw error;
    }
  }

  private assertEditableCertificate(status: string): void {
    if (status === 'registered') {
      throw ruleViolationError(
        SIGNING_RULE_CODE,
        'Chứng thư đang đăng ký kí nội bộ; bấm "Hủy đăng ký" trước khi sửa thông tin hoặc ảnh con dấu',
      );
    }
  }

  async saveCertificate(currentUser: CurrentUser, input: CertificateInput) {
    this.assertAny(currentUser, [CERTIFICATE], 'Bạn không có quyền khai báo chứng thư số nhà trường');
    if (input.valid_from && input.valid_to && input.valid_from > input.valid_to) {
      throw validationError([{ field: 'valid_to', message: 'Ngày hết hiệu lực phải sau ngày bắt đầu hiệu lực' }]);
    }
    const row = await this.ensureCertificate();
    this.assertEditableCertificate(row.status);
    await this.system.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('signing_certificates')
        .set({ ...input, updated_at: this.clock.now(), updated_by: currentUser.id })
        .where('id', '=', row.id)
        .execute();
      await this.event(transaction, null, 'certificate_save', input.provider, currentUser);
    });
    return this.certificate(currentUser);
  }

  // Đăng ký kí nội bộ: chứng thư dùng được cho nút "Kí xác nhận nội bộ" khi đủ người đứng tên, nhà phát hành, còn hiệu lực
  // Lý do ghi vào lịch sử yêu cầu đăng ký chứng thư số cùng kiểu chữ ký, nhà phát hành, tên đăng nhập (như biểu mẫu của Sở)
  async registerCertificate(currentUser: CurrentUser, reason: string | null = null) {
    this.assertAny(currentUser, [CERTIFICATE], 'Bạn không có quyền đăng ký chứng thư số nhà trường');
    const row = await this.ensureCertificate();
    if (row.status === 'registered') {
      throw ruleViolationError(SIGNING_RULE_CODE, 'Chứng thư đã đăng ký kí nội bộ');
    }
    const missing = [
      !row.holder_name ? { field: 'holder_name', message: 'Nhập người đứng tên chứng thư rồi bấm Ghi' } : null,
      !row.provider ? { field: 'provider', message: 'Chọn nhà phát hành chứng thư rồi bấm Ghi' } : null,
      !row.login_name ? { field: 'login_name', message: 'Nhập tên đăng nhập rồi bấm Ghi' } : null,
    ].filter((item): item is { field: string; message: string } => item !== null);
    if (missing.length > 0) {
      throw ruleViolationError(SIGNING_RULE_CODE, 'Chưa đủ thông tin chứng thư để đăng ký', missing);
    }
    if (!isSigningProvider(row.provider)) {
      throw ruleViolationError(
        SIGNING_SO_RULE_CODE,
        `Nhà phát hành "${row.provider}" không có trong danh sách của Sở; chọn lại nhà phát hành rồi bấm Ghi`,
        [{ field: 'provider', message: 'Chọn VNPT-CA, BkavCA, VIETTEL, Ban Cơ yếu Chính phủ hoặc MISA' }],
      );
    }
    if (row.valid_to && row.valid_to < this.today()) {
      throw ruleViolationError(SIGNING_RULE_CODE, 'Chứng thư đã hết hiệu lực; cập nhật ngày hết hiệu lực trước');
    }
    await this.system.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('signing_certificates')
        .set({
          status: 'registered',
          registered_at: this.clock.now(),
          registered_by: currentUser.id,
          registered_by_name: currentUser.description.full_name,
          updated_at: this.clock.now(),
          updated_by: currentUser.id,
        })
        .where('id', '=', row.id)
        .execute();
      await this.event(
        transaction,
        null,
        'certificate_register',
        [SIGNING_SIGNATURE_TYPE_LABELS[row.signature_type], row.provider, row.login_name, reason]
          .filter(Boolean)
          .join(' – '),
        currentUser,
      );
    });
    return this.certificate(currentUser);
  }

  async revokeCertificate(currentUser: CurrentUser) {
    this.assertAny(currentUser, [CERTIFICATE], 'Bạn không có quyền hủy đăng ký chứng thư số nhà trường');
    const row = await this.ensureCertificate();
    if (row.status !== 'registered') {
      throw ruleViolationError(SIGNING_RULE_CODE, 'Chứng thư chưa đăng ký kí nội bộ');
    }
    await this.system.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('signing_certificates')
        .set({ status: 'revoked', updated_at: this.clock.now(), updated_by: currentUser.id })
        .where('id', '=', row.id)
        .execute();
      await this.event(transaction, null, 'certificate_revoke', null, currentUser);
    });
    return this.certificate(currentUser);
  }

  async uploadSeal(currentUser: CurrentUser, file: { fileName: string; body: Buffer }) {
    this.assertAny(currentUser, [CERTIFICATE], 'Bạn không có quyền tải ảnh con dấu');
    const contentType = detectImage(file.body);
    if (!contentType) {
      throw validationError([{ field: 'file', message: 'Ảnh con dấu là ảnh PNG hoặc JPEG' }]);
    }
    if (file.body.length > MAXIMUM_SEAL_BYTES) {
      throw validationError([{ field: 'file', message: 'Ảnh con dấu tối đa 1 MB' }]);
    }
    const row = await this.ensureCertificate();
    this.assertEditableCertificate(row.status);
    const storageKey = `signing-seal/${randomUUID()}`;
    await this.fileStorage.put(storageKey, file.body, contentType);
    await this.system.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('signing_certificates')
        .set({
          seal_file_name: file.fileName.slice(0, 200),
          seal_content_type: contentType,
          seal_storage_key: storageKey,
          updated_at: this.clock.now(),
          updated_by: currentUser.id,
        })
        .where('id', '=', row.id)
        .execute();
      await this.event(transaction, null, 'seal_upload', file.fileName.slice(0, 200), currentUser);
    });
    if (row.seal_storage_key) {
      await this.fileStorage.delete(row.seal_storage_key);
    }
    return this.certificate(currentUser);
  }

  async deleteSeal(currentUser: CurrentUser) {
    this.assertAny(currentUser, [CERTIFICATE], 'Bạn không có quyền xóa ảnh con dấu');
    const row = await this.ensureCertificate();
    this.assertEditableCertificate(row.status);
    if (!row.seal_storage_key) {
      throw ruleViolationError(SIGNING_RULE_CODE, 'Chưa có ảnh con dấu');
    }
    await this.system.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('signing_certificates')
        .set({
          seal_file_name: null,
          seal_content_type: null,
          seal_storage_key: null,
          updated_at: this.clock.now(),
          updated_by: currentUser.id,
        })
        .where('id', '=', row.id)
        .execute();
      await this.event(transaction, null, 'seal_delete', null, currentUser);
    });
    await this.fileStorage.delete(row.seal_storage_key);
    return this.certificate(currentUser);
  }

  async seal(currentUser: CurrentUser): Promise<{ body: Buffer; contentType: string }> {
    this.assertAny(currentUser, [VIEW, CERTIFICATE], 'Bạn không có quyền xem ảnh con dấu');
    const row = await this.certificateRow();
    if (!row?.seal_storage_key || !row.seal_content_type) {
      throw notFoundError('Chưa có ảnh con dấu', 'signing_seal');
    }
    return { body: await this.fileStorage.get(row.seal_storage_key), contentType: row.seal_content_type };
  }

  // 2.1 Đồng bộ chứng thư số: chưa kết nối với Bộ nên người dùng đăng ký đồng bộ ở hệ thống của Bộ rồi đánh dấu kèm ngày
  async markSynced(currentUser: CurrentUser, input: { syncedOn: string; note: string | null }) {
    this.assertAny(currentUser, [CERTIFICATE], 'Bạn không có quyền đánh dấu đồng bộ chứng thư');
    const row = await this.ensureCertificate();
    if (row.status !== 'registered') {
      throw ruleViolationError(SIGNING_RULE_CODE, 'Đăng ký kí nội bộ cho chứng thư trước khi đánh dấu đồng bộ');
    }
    if (input.syncedOn > this.today()) {
      throw validationError([{ field: 'synced_on', message: 'Ngày đồng bộ không được sau ngày hiện tại' }]);
    }
    await this.system.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('signing_certificates')
        .set({
          sync_status: 'synced',
          synced_on: input.syncedOn,
          sync_note: input.note,
          synced_by: currentUser.id,
          synced_by_name: currentUser.description.full_name,
          updated_at: this.clock.now(),
          updated_by: currentUser.id,
        })
        .where('id', '=', row.id)
        .execute();
      await this.event(
        transaction,
        null,
        'certificate_sync',
        [`Ngày đồng bộ ${input.syncedOn}`, input.note].filter(Boolean).join('; '),
        currentUser,
      );
    });
    return this.certificate(currentUser);
  }

  async unmarkSynced(currentUser: CurrentUser) {
    this.assertAny(currentUser, [CERTIFICATE], 'Bạn không có quyền đặt lại trạng thái đồng bộ');
    const row = await this.ensureCertificate();
    if (row.sync_status !== 'synced') {
      throw ruleViolationError(SIGNING_RULE_CODE, 'Chứng thư chưa đánh dấu đồng bộ');
    }
    await this.system.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('signing_certificates')
        .set({
          sync_status: 'not_synced',
          synced_on: null,
          sync_note: null,
          synced_by: null,
          synced_by_name: null,
          updated_at: this.clock.now(),
          updated_by: currentUser.id,
        })
        .where('id', '=', row.id)
        .execute();
      await this.event(transaction, null, 'certificate_unsync', null, currentUser);
    });
    return this.certificate(currentUser);
  }

  // ---- 2.2 Kí hồ sơ trường, lớp, nhân sự, học sinh ----

  // Đối tượng của một loại kèm hồ sơ chưa hủy (nếu có) trong năm học đang dùng và lý do của lần tạo hồ sơ không được gần nhất;
  // sổ đầu bài theo tháng
  async objects(currentUser: CurrentUser, type: SigningObjectType, period: string) {
    this.assertAny(currentUser, [VIEW, MANAGE, SIGN], 'Bạn không có quyền xem hồ sơ kí');
    const { academicYearId, database } = await this.currentSchoolYear.require();
    const month = type === 'class_log' ? period : '';
    const [objects, dossiers, errors] = await Promise.all([
      listSigningObjects(database, academicYearId, type),
      this.system
        .selectFrom('signing_dossiers')
        .select(DOSSIER_COLUMNS)
        .where('academic_year_id', '=', academicYearId)
        .where('object_type', '=', type)
        .where('period', '=', month)
        .where('status', 'in', ACTIVE_STATUSES)
        .execute(),
      this.createErrors(academicYearId, type, month),
    ]);
    const byObject = new Map(dossiers.map((dossier) => [dossier.object_id, dossier]));
    const errorOf = new Map(errors.map((error) => [error.object_id, error]));
    return objects.map((object) => ({
      ...object,
      dossier: byObject.get(object.object_id) ?? null,
      create_error: byObject.has(object.object_id) ? null : (errorOf.get(object.object_id)?.reason ?? null),
    }));
  }

  private createErrors(academicYearId: string, type: SigningObjectType, period: string) {
    return this.system
      .selectFrom('signing_create_errors')
      .select(['object_id', 'object_label', 'reason', 'created_by_name', 'created_at'])
      .where('academic_year_id', '=', academicYearId)
      .where('object_type', '=', type)
      .where('period', '=', period)
      .orderBy('object_label')
      .execute();
  }

  private async yearName(academicYearId: string): Promise<string | null> {
    const year = await this.system
      .selectFrom('academic_years')
      .select('name')
      .where('id', '=', academicYearId)
      .executeTakeFirst();
    return year?.name ?? null;
  }

  private async heading(academicYearId: string, title: string, code: string, at: Date): Promise<string[]> {
    const year = await this.yearName(academicYearId);
    const { database } = await this.currentSchoolYear.require();
    const root = await database
      .selectFrom('org_units')
      .select('name')
      .where('unit_type', '=', 'truong_chinh')
      .executeTakeFirst();
    return [
      title,
      [root?.name, year ? `Năm học ${year}` : null].filter(Boolean).join(' – '),
      `Mã định danh hồ sơ: ${code} – lập lúc ${VIETNAM_TIME.format(at)}`,
    ];
  }

  // Tạo hồ sơ cho các đối tượng chọn: đối tượng thiếu mục bắt buộc thì không tạo, ghi lý do để hiện ở cột Ghi chú và "Tải
  // file lỗi"; các đối tượng còn lại vẫn tạo. Không đối tượng nào tạo được thì báo lỗi kèm lý do từng đối tượng. Mỗi hồ sơ
  // có tệp PDF và tệp dữ liệu XML lập từ cùng số liệu
  async create(
    currentUser: CurrentUser,
    input: { objectType: SigningObjectType; objectIds: string[]; period: string; note?: string | null },
  ) {
    this.assertAny(currentUser, [MANAGE], 'Bạn không có quyền tạo hồ sơ kí');
    if (SIGNING_HIDDEN_OBJECT_TYPES.includes(input.objectType)) {
      throw ruleViolationError(
        SIGNING_SO_RULE_CODE,
        'Cấp Mầm non không kí sổ đầu bài: không tạo hồ sơ sổ đầu bài mới; hồ sơ đã có vẫn xem, tải, xác nhận được',
      );
    }
    this.assertIdentity(currentUser, input.objectType);
    const { academicYearId, database } = await this.currentSchoolYear.require();
    const period = input.objectType === 'class_log' ? input.period : '';
    const existing = await this.system
      .selectFrom('signing_dossiers')
      .select(['object_label', 'code'])
      .where('academic_year_id', '=', academicYearId)
      .where('object_type', '=', input.objectType)
      .where('object_id', 'in', input.objectIds)
      .where('period', '=', period)
      .where('status', 'in', ACTIVE_STATUSES)
      .execute();
    if (existing.length > 0) {
      throw ruleViolationError(
        SIGNING_RULE_CODE,
        `Đã có hồ sơ chưa hủy: ${existing.map((item) => `${item.object_label} (${item.code})`).join(', ')}; hủy hồ sơ cũ trước khi tạo lại`,
      );
    }
    // Lập số liệu của mọi đối tượng trước khi ghi; đối tượng không có trong dữ liệu thì báo không tìm thấy
    const contents = [];
    for (const objectId of input.objectIds) {
      contents.push({
        objectId,
        content: await buildDossierContent(
          database,
          academicYearId,
          input.objectType,
          objectId,
          period,
          this.decrypt,
        ),
      });
    }
    const errors = contents
      .filter(({ content }) => content.missing.length > 0)
      .map(({ objectId, content }) => ({
        object_id: objectId,
        object_label: content.label,
        reason: `Thiếu mục bắt buộc: ${content.missing.join(', ')}`,
      }));
    for (const error of errors) {
      await this.system
        .insertInto('signing_create_errors')
        .values({
          academic_year_id: academicYearId,
          object_type: input.objectType,
          object_id: error.object_id,
          period,
          object_label: error.object_label,
          reason: error.reason,
          created_by: currentUser.id,
          created_by_name: currentUser.description.full_name,
        })
        .onConflict((conflict) =>
          conflict.constraint('signing_create_errors_object_unique').doUpdateSet({
            object_label: error.object_label,
            reason: error.reason,
            created_by: currentUser.id,
            created_by_name: currentUser.description.full_name,
            created_at: this.clock.now(),
          }),
        )
        .execute();
    }
    if (errors.length === contents.length) {
      throw ruleViolationError(
        SIGNING_SO_RULE_CODE,
        'Không tạo được hồ sơ nào; xem lý do ở cột Ghi chú hoặc bấm "Tải file lỗi"',
        errors.map((error) => ({ field: 'object_ids', message: `${error.object_label}: ${error.reason}` })),
      );
    }
    const yearName = await this.yearName(academicYearId);
    const created: string[] = [];
    for (const { objectId, content } of contents.filter((item) => item.content.missing.length === 0)) {
      const now = this.clock.now();
      const sequence = await sql<{ value: string }>`select nextval('signing_dossier_code') as value`.execute(
        this.system,
      );
      const code = `KHS-${String(sequence.rows[0]?.value ?? '0').padStart(6, '0')}`;
      const title = dossierTitle(input.objectType, content.label);
      const sheets = documentSheets(content.document);
      const pdf = await buildPdf(withHeading(sheets, await this.heading(academicYearId, title, code, now)), now, {
        orientation: 'portrait',
        subject: title,
      });
      const xml = this.xmlWriter.write({ code, academicYearName: yearName, createdAt: now, document: content.document });
      const storageKey = `signing-dossier/${randomUUID()}`;
      const xmlStorageKey = `signing-dossier/${randomUUID()}`;
      await this.fileStorage.put(storageKey, pdf, CONTENT_TYPES.pdf);
      await this.fileStorage.put(xmlStorageKey, xml, CONTENT_TYPE_XML);
      try {
        await this.system.transaction().execute(async (transaction) => {
          const row = await transaction
            .insertInto('signing_dossiers')
            .values({
              academic_year_id: academicYearId,
              code,
              object_type: input.objectType,
              object_id: objectId,
              period,
              object_label: content.label,
              snapshot: JSON.stringify({ title, document: content.document } satisfies DossierSnapshot),
              content_hash: contentHash(sheets),
              file_name: `${code}.pdf`,
              storage_key: storageKey,
              file_sha256: sha256(pdf),
              size_bytes: pdf.length,
              xml_file_name: `${code}.xml`,
              xml_storage_key: xmlStorageKey,
              xml_sha256: sha256(xml),
              xml_size_bytes: xml.length,
              note: input.note ?? null,
              created_by: currentUser.id,
              created_by_name: currentUser.description.full_name,
            })
            .returning('id')
            .executeTakeFirstOrThrow();
          await transaction
            .deleteFrom('signing_create_errors')
            .where('academic_year_id', '=', academicYearId)
            .where('object_type', '=', input.objectType)
            .where('object_id', '=', objectId)
            .where('period', '=', period)
            .execute();
          await this.event(transaction, row.id, 'create', title, currentUser);
        });
      } catch (error) {
        await this.fileStorage.delete(storageKey);
        await this.fileStorage.delete(xmlStorageKey);
        throw error;
      }
      created.push(code);
    }
    return { created: created.length, codes: created, errors };
  }

  // "Tải file lỗi": đối tượng tạo hồ sơ không được của loại đang xem kèm lý do
  async createErrorFile(
    currentUser: CurrentUser,
    type: SigningObjectType,
    period: string,
    ipAddress: string | null,
  ): Promise<ExportedFile> {
    this.assertAny(currentUser, [VIEW, MANAGE, SIGN], 'Bạn không có quyền tải file lỗi của hồ sơ kí');
    const { academicYearId, database } = await this.currentSchoolYear.require();
    const month = type === 'class_log' ? period : '';
    const errors = await this.createErrors(academicYearId, type, month);
    const createdAt = this.clock.now();
    return buildFacilitiesWorkbook({
      database,
      currentUser,
      reportCode: 'signing-create-errors',
      fileName: `loi-tao-ho-so-${type}-${fileStamp(createdAt)}.xlsx`,
      filters: { object_type: type, ...(month ? { period: month } : {}) },
      orgUnitIds: [],
      ipAddress,
      createdAt,
      sheets: [
        {
          title: 'Lỗi tạo hồ sơ',
          heading: [`${SIGNING_OBJECT_LABELS[type]}: đối tượng tạo hồ sơ không được`],
          columns: [
            { key: 'label', label: 'Đối tượng', width: 36 },
            { key: 'reason', label: 'Lý do', width: 70 },
            { key: 'actor', label: 'Người tạo', width: 24 },
            { key: 'at', label: 'Thời điểm', width: 20 },
          ],
          rows: errors.map((error) => ({
            label: error.object_label,
            reason: error.reason,
            actor: error.created_by_name,
            at: VIETNAM_TIME.format(error.created_at),
          })),
        },
      ],
    });
  }

  private async dossiers(ids: string[]) {
    const { academicYearId } = await this.currentSchoolYear.require();
    const rows = await this.system
      .selectFrom('signing_dossiers')
      .selectAll()
      .where('id', 'in', ids)
      .where('academic_year_id', '=', academicYearId)
      .execute();
    if (rows.length !== ids.length) {
      throw notFoundError('Không có hồ sơ này trong năm học đang dùng', 'signing_dossier');
    }
    return rows;
  }

  private assertStatus(
    rows: Array<{ code: string; status: SigningDossierStatus }>,
    allowed: SigningDossierStatus[],
    message: string,
  ): void {
    const wrong = rows.filter((row) => !allowed.includes(row.status));
    if (wrong.length > 0) {
      throw ruleViolationError(SIGNING_RULE_CODE, `${message}: ${wrong.map((row) => row.code).join(', ')}`);
    }
  }

  // Kí xác nhận nội bộ các hồ sơ đã tạo: lập tệp đã kí từ đúng số liệu lúc tạo hồ sơ
  async sign(currentUser: CurrentUser, ids: string[]) {
    this.assertAny(currentUser, [SIGN], 'Bạn không có quyền kí hồ sơ');
    const certificate = await this.certificateRow();
    if (certificate?.status !== 'registered') {
      throw ruleViolationError(
        SIGNING_RULE_CODE,
        'Chứng thư số nhà trường chưa đăng ký kí nội bộ (mục 1.1); đăng ký trước khi kí hồ sơ',
      );
    }
    if (certificate.valid_to && certificate.valid_to < this.today()) {
      throw ruleViolationError(SIGNING_RULE_CODE, 'Chứng thư số nhà trường đã hết hiệu lực');
    }
    if (!isSigningProvider(certificate.provider)) {
      throw ruleViolationError(
        SIGNING_SO_RULE_CODE,
        'Nhà phát hành chứng thư không có trong danh sách của Sở; hủy đăng ký, chọn lại nhà phát hành rồi đăng ký lại (mục 1.1)',
      );
    }
    const rows = await this.dossiers(ids);
    this.assertStatus(rows, ['created'], 'Chỉ kí hồ sơ đã tạo, chưa kí');
    const sealImage =
      certificate.seal_storage_key && certificate.seal_content_type
        ? `data:${certificate.seal_content_type};base64,${(await this.fileStorage.get(certificate.seal_storage_key)).toString('base64')}`
        : null;
    for (const row of rows) {
      const snapshot = row.snapshot as DossierSnapshot;
      const signedAt = this.clock.now();
      const result = await this.signer.sign({
        code: row.code,
        title: snapshot.title,
        heading: await this.heading(row.academic_year_id, snapshot.title, row.code, row.created_at),
        sheets: snapshotSheets(snapshot),
        originalPdf: await this.fileStorage.get(row.storage_key),
        originalSha256: row.file_sha256,
        signedAt,
        signerName: currentUser.description.full_name,
        certificate: {
          signatureTypeLabel: SIGNING_SIGNATURE_TYPE_LABELS[certificate.signature_type],
          provider: certificate.provider,
          holderName: certificate.holder_name,
          holderTitle: certificate.holder_title,
          serialNumber: certificate.serial_number,
        },
        sealImage,
      });
      const storageKey = `signing-dossier/${randomUUID()}`;
      await this.fileStorage.put(storageKey, result.pdf, CONTENT_TYPES.pdf);
      const updated = await this.system.transaction().execute(async (transaction) => {
        const changed = await transaction
          .updateTable('signing_dossiers')
          .set({
            status: 'signed',
            signature_method: result.method,
            signed_file_name: `${row.code}-da-ki.pdf`,
            signed_storage_key: storageKey,
            signed_sha256: sha256(result.pdf),
            signed_size_bytes: result.pdf.length,
            signed_at: signedAt,
            signed_by: currentUser.id,
            signed_by_name: currentUser.description.full_name,
            updated_at: signedAt,
          })
          .where('id', '=', row.id)
          .where('status', '=', 'created')
          .executeTakeFirst();
        if (Number(changed.numUpdatedRows) === 1) {
          await this.event(
            transaction,
            row.id,
            'sign',
            this.signer.digital ? 'Kí số' : 'Kí xác nhận nội bộ',
            currentUser,
          );
        }
        return Number(changed.numUpdatedRows) === 1;
      });
      if (!updated) {
        await this.fileStorage.delete(storageKey);
      }
    }
    return { signed: rows.length };
  }

  // Tải thông tin thay đổi: so dữ liệu hiện tại của đối tượng với số liệu đã lập hồ sơ
  async checkChanges(currentUser: CurrentUser, ids: string[]) {
    this.assertAny(currentUser, [MANAGE], 'Bạn không có quyền tải thông tin thay đổi của hồ sơ');
    const { database } = await this.currentSchoolYear.require();
    const rows = await this.dossiers(ids);
    for (const type of new Set(rows.map((row) => row.object_type))) {
      this.assertIdentity(currentUser, type);
    }
    this.assertStatus(rows, ACTIVE_STATUSES, 'Hồ sơ đã hủy');
    const results = [];
    for (const row of rows) {
      const now = this.clock.now();
      let summary: string | null;
      try {
        const current = await buildDossierContent(
          database,
          row.academic_year_id,
          row.object_type,
          row.object_id,
          row.period,
          this.decrypt,
        );
        const snapshot = row.snapshot as DossierSnapshot;
        const sheets = documentSheets(current.document);
        // Hồ sơ lập trước phần 17b theo mẫu cũ nên luôn khác mẫu của Sở; ghi rõ để người dùng tạo lại
        summary =
          contentHash(sheets) === row.content_hash
            ? null
            : snapshot.document
              ? (describeChanges(snapshotSheets(snapshot), sheets) ?? 'Dữ liệu có thay đổi')
              : 'Hồ sơ lập theo mẫu cũ (trước khi theo mẫu của Sở); hủy và tạo lại hồ sơ để theo mẫu mới';
      } catch (error) {
        if (!(error instanceof ApplicationError) || error.code !== 'ERR_NOT_FOUND') {
          throw error;
        }
        summary = 'Đối tượng của hồ sơ không còn trong dữ liệu';
      }
      await this.system.transaction().execute(async (transaction) => {
        await transaction
          .updateTable('signing_dossiers')
          .set({
            checked_at: now,
            change_summary: summary,
            changed_at: summary ? (row.changed_at && row.change_summary === summary ? row.changed_at : now) : null,
            updated_at: now,
          })
          .where('id', '=', row.id)
          .execute();
        await this.event(transaction, row.id, 'check_changes', summary ?? 'Không có thay đổi', currentUser);
      });
      results.push({ id: row.id, code: row.code, changed: summary !== null, change_summary: summary });
    }
    return { items: results };
  }

  async cancel(currentUser: CurrentUser, id: string, reason: string) {
    this.assertAny(currentUser, [MANAGE], 'Bạn không có quyền hủy hồ sơ');
    const [row] = await this.dossiers([id]);
    this.assertStatus([row!], ['created', 'signed'], 'Chỉ hủy hồ sơ chưa xác nhận hoàn thành');
    await this.system.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('signing_dossiers')
        .set({
          status: 'cancelled',
          cancelled_at: this.clock.now(),
          cancelled_by: currentUser.id,
          cancelled_by_name: currentUser.description.full_name,
          cancel_reason: reason,
          updated_at: this.clock.now(),
        })
        .where('id', '=', id)
        .execute();
      await this.event(transaction, id, 'cancel', reason, currentUser);
    });
    return this.read(currentUser, id);
  }

  // ---- 2.3 Xác nhận hoàn thành và gửi hồ sơ ----

  async submissions(
    currentUser: CurrentUser,
    filter: { objectType?: SigningObjectType; status?: SigningDossierStatus },
  ) {
    this.assertAny(currentUser, [VIEW, MANAGE], 'Bạn không có quyền xem hồ sơ kí');
    const { academicYearId } = await this.currentSchoolYear.require();
    let query = this.system
      .selectFrom('signing_dossiers')
      .select(DOSSIER_COLUMNS)
      .where('academic_year_id', '=', academicYearId)
      .where('status', 'in', filter.status ? [filter.status] : ['signed', 'completed', 'sent']);
    if (filter.objectType) {
      query = query.where('object_type', '=', filter.objectType);
    }
    // Tên trường, tên hiệu trưởng là cột của lưới 2.3 như Sở
    const [items, school] = await Promise.all([
      query.orderBy('signed_at', 'desc').orderBy('code', 'desc').execute(),
      this.schoolInfo(),
    ]);
    return { items, school };
  }

  async complete(currentUser: CurrentUser, ids: string[]) {
    this.assertAny(currentUser, [MANAGE], 'Bạn không có quyền xác nhận hoàn thành hồ sơ');
    const rows = await this.dossiers(ids);
    this.assertStatus(rows, ['signed'], 'Chỉ xác nhận hoàn thành hồ sơ đã kí');
    await this.system.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('signing_dossiers')
        .set({
          status: 'completed',
          completed_at: this.clock.now(),
          completed_by: currentUser.id,
          completed_by_name: currentUser.description.full_name,
          updated_at: this.clock.now(),
        })
        .where('id', 'in', ids)
        .execute();
      for (const id of ids) {
        await this.event(transaction, id, 'complete', null, currentUser);
      }
    });
    return { completed: ids.length };
  }

  async uncomplete(currentUser: CurrentUser, id: string, reason: string | null) {
    this.assertAny(currentUser, [MANAGE], 'Bạn không có quyền hủy xác nhận hồ sơ');
    const [row] = await this.dossiers([id]);
    this.assertStatus([row!], ['completed'], 'Chỉ hủy xác nhận hồ sơ đã xác nhận hoàn thành, chưa gửi');
    await this.system.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('signing_dossiers')
        .set({
          status: 'signed',
          completed_at: null,
          completed_by: null,
          completed_by_name: null,
          updated_at: this.clock.now(),
        })
        .where('id', '=', id)
        .execute();
      await this.event(transaction, id, 'uncomplete', reason, currentUser);
    });
    return this.read(currentUser, id);
  }

  // Đánh dấu đã gửi: hồ sơ đã xác nhận hoàn thành; phần mềm không truyền tệp đi
  async markSent(currentUser: CurrentUser, ids: string[], input: { sentOn: string; note: string | null }) {
    this.assertAny(currentUser, [MANAGE], 'Bạn không có quyền đánh dấu đã gửi hồ sơ');
    if (input.sentOn > this.today()) {
      throw validationError([{ field: 'sent_on', message: 'Ngày gửi không được sau ngày hiện tại' }]);
    }
    const rows = await this.dossiers(ids);
    this.assertStatus(rows, ['completed'], 'Chỉ đánh dấu đã gửi hồ sơ đã xác nhận hoàn thành');
    const earlier = rows.filter((row) => row.completed_at && VIETNAM_DATE.format(row.completed_at) > input.sentOn);
    if (earlier.length > 0) {
      throw validationError([
        {
          field: 'sent_on',
          message: `Ngày gửi trước ngày xác nhận hoàn thành: ${earlier.map((row) => row.code).join(', ')}`,
        },
      ]);
    }
    await this.system.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('signing_dossiers')
        .set({
          status: 'sent',
          sent_on: input.sentOn,
          sent_note: input.note,
          sent_by: currentUser.id,
          sent_by_name: currentUser.description.full_name,
          marked_sent_at: this.clock.now(),
          updated_at: this.clock.now(),
        })
        .where('id', 'in', ids)
        .execute();
      for (const id of ids) {
        await this.event(
          transaction,
          id,
          'mark_sent',
          [`Ngày gửi ${input.sentOn}`, input.note].filter(Boolean).join('; '),
          currentUser,
        );
      }
    });
    return { sent: ids.length };
  }

  // ---- Chung ----

  async read(currentUser: CurrentUser, id: string) {
    this.assertAny(currentUser, [VIEW, MANAGE, SIGN], 'Bạn không có quyền xem hồ sơ kí');
    const row = await this.system
      .selectFrom('signing_dossiers')
      .select(DOSSIER_COLUMNS)
      .where('id', '=', id)
      .executeTakeFirst();
    if (!row) {
      throw notFoundError('Không có hồ sơ này', 'signing_dossier');
    }
    const events = await this.system
      .selectFrom('signing_events')
      .select(['id', 'action', 'note', 'actor_name', 'created_at'])
      .where('dossier_id', '=', id)
      .orderBy('created_at', 'desc')
      .execute();
    return { ...row, events };
  }

  private async exportLog(
    currentUser: CurrentUser,
    row: { code: string; object_type: SigningObjectType },
    version: string,
    fileName: string,
    ipAddress: string | null,
    reportCode = 'signing-dossier',
  ): Promise<string> {
    const { database } = await this.currentSchoolYear.require();
    const log = await database
      .insertInto('export_logs')
      .values({
        user_id: currentUser.id,
        actor_name: currentUser.description.full_name,
        report_code: reportCode,
        filters_data: JSON.stringify({ dossier: row.code, version }),
        org_unit_ids: [],
        row_count: 1,
        contains_personal_data: row.object_type !== 'school',
        file_name: fileName,
        ip_address: ipAddress,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return log.id;
  }

  // Tệp hồ sơ: bản đã kí (nếu có), bản gốc hoặc tệp dữ liệu XML; mỗi lần tải ghi nhật ký xuất ở năm học đang dùng (BR-74)
  async file(
    currentUser: CurrentUser,
    id: string,
    version: 'original' | 'signed' | 'xml',
    ipAddress: string | null,
  ): Promise<ExportedFile> {
    this.assertAny(currentUser, [VIEW, MANAGE, SIGN], 'Bạn không có quyền tải tệp hồ sơ');
    const row = await this.system.selectFrom('signing_dossiers').selectAll().where('id', '=', id).executeTakeFirst();
    if (!row) {
      throw notFoundError('Không có hồ sơ này', 'signing_dossier');
    }
    this.assertIdentity(currentUser, row.object_type);
    if (version === 'signed' && !row.signed_storage_key) {
      throw ruleViolationError(SIGNING_RULE_CODE, 'Hồ sơ chưa kí nên chưa có tệp đã kí');
    }
    if (version === 'xml' && !row.xml_storage_key) {
      throw ruleViolationError(
        SIGNING_SO_RULE_CODE,
        'Hồ sơ lập trước khi theo mẫu của Sở nên không có tệp dữ liệu XML; hủy và tạo lại hồ sơ',
      );
    }
    const storageKey =
      version === 'signed' ? row.signed_storage_key! : version === 'xml' ? row.xml_storage_key! : row.storage_key;
    const fileName =
      version === 'signed' ? row.signed_file_name! : version === 'xml' ? row.xml_file_name! : row.file_name;
    const logId = await this.exportLog(currentUser, row, version, fileName, ipAddress);
    return {
      buffer: await this.fileStorage.get(storageKey),
      fileName,
      logId,
      contentType: version === 'xml' ? CONTENT_TYPE_XML : CONTENT_TYPES.pdf,
      rowCount: 1,
    };
  }

  // Cửa sổ "Xem hồ sơ kí": khung "Thông tin chữ ký số" (người kí, thời điểm, chứng thư, mã băm) và nội dung hồ sơ theo phần và
  // mục đã lập; hồ sơ nhân sự, học sinh có số định danh nên mỗi lần xem ghi nhật ký xuất như tải tệp
  async view(currentUser: CurrentUser, id: string, ipAddress: string | null) {
    this.assertAny(currentUser, [VIEW, MANAGE, SIGN], 'Bạn không có quyền xem hồ sơ kí');
    const row = await this.system.selectFrom('signing_dossiers').selectAll().where('id', '=', id).executeTakeFirst();
    if (!row) {
      throw notFoundError('Không có hồ sơ này', 'signing_dossier');
    }
    this.assertIdentity(currentUser, row.object_type);
    const snapshot = row.snapshot as DossierSnapshot;
    const document = snapshot.document ?? sheetsDocument(row.object_type, snapshot.title, snapshot.sheets ?? []);
    if (row.object_type !== 'school' && row.object_type !== 'class') {
      await this.exportLog(currentUser, row, 'view', row.code, ipAddress, 'signing-dossier-view');
    }
    const certificate = row.signed_at ? await this.certificateRow() : undefined;
    return {
      dossier: Object.fromEntries(DOSSIER_COLUMNS.map((column) => [column, row[column]])),
      root: SIGNING_DOSSIER_ROOTS[row.object_type],
      document,
      signature: row.signed_at
        ? {
            signed_by_name: row.signed_by_name,
            signed_at: row.signed_at,
            method: row.signature_method,
            digital: this.signer.digital,
            description: this.signer.description,
            signature_type: certificate?.signature_type ?? null,
            provider: certificate?.provider ?? null,
            holder_name: certificate?.holder_name ?? null,
            serial_number: certificate?.serial_number ?? null,
            original_sha256: row.file_sha256,
            signed_sha256: row.signed_sha256,
          }
        : null,
      xml_schema: row.xml_storage_key ? this.xmlWriter.schema : null,
    };
  }

  // Xuất dữ liệu sổ đầu bài của lớp trong tháng ra Excel (cấp Mầm non ẩn nút này từ phần 17b; giữ cho cấp học khác)
  async exportClassLog(
    currentUser: CurrentUser,
    classId: string,
    month: string,
    ipAddress: string | null,
  ): Promise<ExportedFile> {
    this.assertAny(currentUser, [VIEW, MANAGE, SIGN], 'Bạn không có quyền xuất dữ liệu sổ đầu bài');
    const { academicYearId, database } = await this.currentSchoolYear.require();
    const content = await buildDossierContent(database, academicYearId, 'class_log', classId, month, this.decrypt);
    const createdAt = this.clock.now();
    return buildFacilitiesWorkbook({
      database,
      currentUser,
      reportCode: 'signing-class-log',
      fileName: `so-dau-bai-${month}-${fileStamp(createdAt)}.xlsx`,
      filters: { class_id: classId, month },
      orgUnitIds: [],
      ipAddress,
      createdAt,
      sheets: [
        {
          title: 'Sổ đầu bài',
          heading: [`${SIGNING_OBJECT_LABELS.class_log}: ${content.label}`],
          columns: CLASS_LOG_COLUMNS,
          rows: await classLogRows(database, classId, month),
        },
      ],
    });
  }
}
