import { Injectable } from '@nestjs/common';
import type { ImportType, SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Kysely, Transaction } from 'kysely';
import { randomUUID } from 'node:crypto';
import { IdentityClient } from '../authentication/identity-client.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { ChildDataProtection } from '../common/child-data-protection.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification } from '../common/notification-queue.js';
import { notFoundError } from '../common/request-fields.js';
import { nextDocumentCode } from '../fees/document-codes.js';
import { MAXIMUM_AMOUNT } from '../fees/fee-catalog-fields.js';
import { RegistrationPeriods } from '../fees/registration-periods.js';
import { FileStorage } from '../files/file-storage.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { buildTemplate, parseDate, readSheet, type ImportColumn, type RowError, type SheetRow } from './excel.js';

// Nhập dữ liệu ban đầu: lớp, trẻ kèm phụ huynh (P01-13), mã định danh ngành (P02-12) (YCTD-46) và công nợ đầu kỳ
// (P01-13, AC-184; YCTD-54)
export const IMPORT_COLUMNS: Record<ImportType, ImportColumn[]> = {
  classes: [
    { key: 'unit_code', header: 'Mã đơn vị', note: 'Mã của Trường chính, Phân hiệu hoặc Điểm trường, bắt buộc' },
    { key: 'class_code', header: 'Mã lớp', note: 'Không trùng trong một đơn vị, bắt buộc' },
    { key: 'class_name', header: 'Tên lớp', note: 'Bắt buộc' },
    { key: 'grade_level', header: 'Mã bậc học', note: 'Mã trong danh mục bậc học đang dùng, bắt buộc' },
    { key: 'max_size', header: 'Sĩ số tối đa', note: 'Số nguyên từ 1 đến 200, bắt buộc' },
    { key: 'room_code', header: 'Mã phòng', note: 'Mã phòng học đang dùng của cùng đơn vị, để trống nếu chưa có' },
  ],
  children: [
    { key: 'unit_code', header: 'Mã đơn vị', note: 'Mã đơn vị của lớp, bắt buộc' },
    { key: 'class_code', header: 'Mã lớp', note: 'Lớp đang dùng của đơn vị, bắt buộc' },
    { key: 'full_name', header: 'Họ tên trẻ', note: 'Tối đa 100 ký tự, bắt buộc' },
    { key: 'dob', header: 'Ngày sinh', note: 'Dạng ngày của Excel, YYYY-MM-DD hoặc DD/MM/YYYY, bắt buộc' },
    { key: 'gender', header: 'Giới tính', note: 'Nam hoặc Nữ, bắt buộc' },
    { key: 'national_id', header: 'Số định danh cá nhân', note: 'Mười hai chữ số, không trùng, bắt buộc' },
    { key: 'moet_code', header: 'Mã định danh ngành', note: 'Để trống nếu chưa có' },
    { key: 'place_of_birth', header: 'Nơi sinh', note: 'Không bắt buộc' },
    { key: 'address', header: 'Địa chỉ', note: 'Không bắt buộc' },
    {
      key: 'allergies',
      header: 'Dị ứng',
      note: 'Ghi "Không" nếu không có dị ứng, hoặc ghi dị ứng gì; bắt buộc (BR-06)',
    },
    { key: 'chronic_conditions', header: 'Bệnh nền', note: 'Không bắt buộc' },
    { key: 'enroll_date', header: 'Ngày vào lớp', note: 'Để trống là ngày nhập' },
    { key: 'guardian1_name', header: 'Họ tên phụ huynh 1', note: 'Bắt buộc; phụ huynh 1 là liên hệ chính' },
    {
      key: 'guardian1_relationship',
      header: 'Quan hệ phụ huynh 1',
      note: 'Tên hoặc mã trong danh mục Quan hệ với trẻ, bắt buộc',
    },
    { key: 'guardian1_phone', header: 'Số điện thoại phụ huynh 1', note: '10 chữ số bắt đầu bằng 0' },
    { key: 'guardian2_name', header: 'Họ tên phụ huynh 2', note: 'Không bắt buộc' },
    { key: 'guardian2_relationship', header: 'Quan hệ phụ huynh 2', note: 'Bắt buộc khi có phụ huynh 2' },
    { key: 'guardian2_phone', header: 'Số điện thoại phụ huynh 2', note: '10 chữ số bắt đầu bằng 0' },
  ],
  moet_codes: [
    { key: 'national_id', header: 'Số định danh cá nhân', note: 'Mười hai chữ số, bắt buộc' },
    { key: 'moet_code', header: 'Mã định danh ngành', note: 'Mã do cơ sở dữ liệu ngành cấp, bắt buộc' },
    { key: 'full_name', header: 'Họ tên trẻ', note: 'Để đối chiếu, không bắt buộc' },
  ],
  opening_debts: [
    { key: 'national_id', header: 'Số định danh cá nhân', note: 'Mười hai chữ số của trẻ đã có, bắt buộc' },
    { key: 'full_name', header: 'Họ tên trẻ', note: 'Để đối chiếu; ghi thì phải khớp hồ sơ' },
    { key: 'amount', header: 'Số tiền', note: 'Số nguyên đồng lớn hơn 0, bắt buộc' },
    { key: 'due_date', header: 'Ngày đến hạn', note: 'Dạng ngày của Excel, YYYY-MM-DD hoặc DD/MM/YYYY, bắt buộc' },
    { key: 'note', header: 'Ghi chú', note: 'Không bắt buộc, tối đa 500 ký tự' },
  ],
};

const TEMPLATE_TITLES: Record<ImportType, string> = {
  classes: 'Lớp học',
  children: 'Trẻ và phụ huynh',
  moet_codes: 'Mã định danh ngành',
  opening_debts: 'Công nợ đầu kỳ',
};

const PHONE_PATTERN = /^0\d{9}$/;
const NATIONAL_ID_PATTERN = /^\d{12}$/;
const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

interface ClassRow {
  org_unit_id: string;
  code: string;
  name: string;
  grade_level: string;
  max_size: number;
  room_id: string | null;
}

interface ChildRow {
  org_unit_id: string;
  class_id: string;
  full_name: string;
  dob: string;
  gender: 'male' | 'female';
  national_id: string;
  moet_student_code: string | null;
  place_of_birth: string | null;
  address: string | null;
  has_allergies: boolean;
  allergies: string | null;
  chronic_conditions: string | null;
  enroll_date: string;
  guardians: Array<{ full_name: string; phone: string | null; relationship_item_id: string }>;
}

interface OpeningDebtRow {
  child_id: string;
  org_unit_id: string;
  amount: number;
  due_date: string;
  note: string | null;
}

type UploadType = 'classes' | 'children' | 'opening_debts';

export interface ImportJobView {
  id: string;
  import_type: ImportType;
  status: 'validated' | 'failed' | 'committed';
  total_rows: number;
  error_rows: number;
  errors: RowError[];
  created_at: Date;
  committed_at: Date | null;
}

type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

@Injectable()
export class ImportsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly fileStorage: FileStorage,
    private readonly protection: ChildDataProtection,
    private readonly identityClient: IdentityClient,
    private readonly periods: RegistrationPeriods,
    private readonly clock: Clock,
  ) {}

  template(type: ImportType): Promise<Buffer> {
    return buildTemplate(TEMPLATE_TITLES[type], IMPORT_COLUMNS[type]);
  }

  // Tải tệp lên và kiểm tra toàn bộ; lưu tệp gốc ở kho tệp để ghi lại khi không còn dòng lỗi (P01-13)
  async upload(
    currentUser: CurrentUser,
    type: UploadType,
    fileName: string,
    body: Buffer,
    origin: ChangeOrigin,
  ): Promise<ImportJobView> {
    const { database } = await this.currentSchoolYear.require();
    const rows = await readSheet(body, IMPORT_COLUMNS[type]);
    const { errors } = await this.validate(database, currentUser, type, rows);
    const storageKey = `import/${randomUUID()}`;
    await this.fileStorage.put(storageKey, body, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return database.transaction().execute(async (transaction) => {
      const file = await transaction
        .insertInto('files')
        .values({
          org_unit_id: null,
          purpose: 'import',
          file_name: fileName.slice(0, 200),
          content_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size_bytes: body.length,
          storage_key: storageKey,
          created_by: origin.actorUserId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      const job = await transaction
        .insertInto('data_import_jobs')
        .values({
          import_type: type,
          file_id: file.id,
          status: errors.length > 0 ? 'failed' : 'validated',
          total_rows: rows.length,
          error_rows: new Set(errors.map((error) => error.row)).size,
          errors: JSON.stringify(errors),
          created_by: origin.actorUserId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      return this.readJob(transaction, job.id);
    });
  }

  async get(jobId: string): Promise<ImportJobView> {
    const { database } = await this.currentSchoolYear.require();
    return this.readJob(database, jobId);
  }

  // Kiểm tra lại toàn bộ rồi mới ghi; còn dòng lỗi thì không ghi dòng nào (AC-183)
  async commit(
    currentUser: CurrentUser,
    accessToken: string,
    jobId: string,
    origin: ChangeOrigin,
  ): Promise<ImportJobView> {
    const { database, academicYearId } = await this.currentSchoolYear.require();
    const job = await database
      .selectFrom('data_import_jobs')
      .innerJoin('files', 'files.id', 'data_import_jobs.file_id')
      .select(['data_import_jobs.id', 'data_import_jobs.import_type', 'data_import_jobs.status', 'files.storage_key'])
      .where('data_import_jobs.id', '=', jobId)
      .executeTakeFirst();
    if (!job || job.import_type === 'moet_codes') {
      throw notFoundError('Không tìm thấy lần nhập', 'data_import_job');
    }
    if (job.status !== 'validated') {
      throw ruleViolationError(
        'P01-13',
        job.status === 'committed' ? 'Lần nhập này đã ghi dữ liệu' : 'Tệp còn dòng lỗi; sửa tệp và tải lên lại',
      );
    }
    const type = job.import_type;
    const rows = await readSheet(await this.fileStorage.get(job.storage_key), IMPORT_COLUMNS[type]);
    const validated = await this.validate(database, currentUser, type, rows);
    if (validated.errors.length > 0) {
      await database
        .updateTable('data_import_jobs')
        .set({
          status: 'failed',
          errors: JSON.stringify(validated.errors),
          error_rows: new Set(validated.errors.map((error) => error.row)).size,
        })
        .where('id', '=', jobId)
        .execute();
      throw ruleViolationError('P01-13', 'Dữ liệu đã thay đổi từ lúc kiểm tra; tệp còn dòng lỗi, không ghi dòng nào');
    }

    // Tài khoản phụ huynh tạo trước khi ghi; gọi lại với cùng số điện thoại không tạo trùng
    const accounts = new Map<string, { userId: string; created: boolean }>();
    if (type === 'opening_debts') {
      return this.commitOpeningDebts(database, validated.openingDebts, jobId, origin);
    }
    if (type === 'children') {
      for (const row of validated.children) {
        for (const guardian of row.guardians) {
          if (guardian.phone && !accounts.has(guardian.phone)) {
            const account = await this.identityClient.ensureGuardianAccount(accessToken, {
              phone: guardian.phone,
              full_name: guardian.full_name,
              org_unit_id: row.org_unit_id,
            });
            accounts.set(guardian.phone, { userId: account.user_id, created: account.created });
          }
        }
      }
    }

    return database.transaction().execute(async (transaction) => {
      if (type === 'classes') {
        for (const row of validated.classes) {
          const created = await transaction
            .insertInto('classes')
            .values({ ...row, academic_year_id: academicYearId, created_by: origin.actorUserId })
            .returning(['id', 'org_unit_id', 'code', 'name', 'grade_level', 'room_id', 'max_size'])
            .executeTakeFirstOrThrow();
          await writeAuditLog(transaction, {
            origin,
            orgUnitId: created.org_unit_id,
            entityName: 'classes',
            entityId: created.id,
            action: 'create',
            before: null,
            after: { ...created, import_job_id: jobId },
          });
        }
      } else {
        for (const row of validated.children) {
          await this.insertImportedChild(transaction, row, accounts, origin, jobId);
        }
        await queueNotification(transaction, {
          orgUnitId: null,
          templateCode: 'guardian_account_created',
          title: 'Tài khoản phụ huynh đã được tạo',
          body: 'Tài khoản ứng dụng phụ huynh đã được tạo, đăng nhập bằng mật khẩu mặc định nhà trường cung cấp',
          targetType: 'data_import_jobs',
          targetId: jobId,
          recipients: [...accounts.values()]
            .filter((account) => account.created)
            .map((account) => ({ userId: account.userId, channel: 'sms' as const })),
        });
      }
      await transaction
        .updateTable('data_import_jobs')
        .set({ status: 'committed', committed_by: origin.actorUserId, committed_at: this.clock.now() })
        .where('id', '=', jobId)
        .execute();
      return this.readJob(transaction, jobId);
    });
  }

  // Nhập mã ngành: dòng khớp số định danh được gán ngay; dòng không khớp hoặc trùng mã được báo (P02-12, AC-202)
  async importMoetCodes(currentUser: CurrentUser, fileName: string, body: Buffer, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const rows = await readSheet(body, IMPORT_COLUMNS.moet_codes);
    const scope = await this.organizationScopes.resolve(currentUser, PERMISSION_CODES.childManage);
    const errors: RowError[] = [];
    const codesInFile = new Map<string, number>();
    for (const { row, values } of rows) {
      if (values.moet_code) {
        codesInFile.set(values.moet_code, (codesInFile.get(values.moet_code) ?? 0) + 1);
      }
      if (!NATIONAL_ID_PATTERN.test(values.national_id ?? '')) {
        errors.push({ row, column: 'Số định danh cá nhân', message: 'Số định danh cá nhân gồm mười hai chữ số' });
      }
      if (!values.moet_code) {
        errors.push({ row, column: 'Mã định danh ngành', message: 'Bắt buộc nhập' });
      }
    }
    const assignments: Array<{ childId: string; orgUnitId: string; code: string; before: string | null }> = [];
    for (const { row, values } of rows) {
      if (errors.some((error) => error.row === row)) {
        continue;
      }
      const code = values.moet_code ?? '';
      if ((codesInFile.get(code) ?? 0) > 1) {
        errors.push({ row, column: 'Mã định danh ngành', message: 'Mã này xuất hiện nhiều lần trong tệp' });
        continue;
      }
      const child = await database
        .selectFrom('children')
        .select(['id', 'org_unit_id', 'moet_student_code'])
        .where('national_id_hash', '=', this.protection.hash(values.national_id ?? ''))
        .executeTakeFirst();
      if (!child || (!scope.wholeSchool && !scope.orgUnitIds.includes(child.org_unit_id))) {
        errors.push({
          row,
          column: 'Số định danh cá nhân',
          message: 'Không có trẻ nào khớp số định danh này trong phạm vi của bạn',
        });
        continue;
      }
      const owner = await database
        .selectFrom('children')
        .select('id')
        .where('moet_student_code', '=', code)
        .where('id', '!=', child.id)
        .executeTakeFirst();
      if (owner) {
        errors.push({ row, column: 'Mã định danh ngành', message: 'Mã đã gán cho trẻ khác' });
        continue;
      }
      assignments.push({ childId: child.id, orgUnitId: child.org_unit_id, code, before: child.moet_student_code });
    }
    return database.transaction().execute(async (transaction) => {
      for (const assignment of assignments) {
        await transaction
          .updateTable('children')
          .set({ moet_student_code: assignment.code, updated_at: this.clock.now() })
          .where('id', '=', assignment.childId)
          .execute();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: assignment.orgUnitId,
          entityName: 'children',
          entityId: assignment.childId,
          action: 'update',
          before: { moet_student_code: assignment.before },
          after: { moet_student_code: assignment.code },
        });
      }
      const storageKey = `import/${randomUUID()}`;
      await this.fileStorage.put(storageKey, body, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      const file = await transaction
        .insertInto('files')
        .values({
          org_unit_id: null,
          purpose: 'import',
          file_name: fileName.slice(0, 200),
          content_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size_bytes: body.length,
          storage_key: storageKey,
          created_by: origin.actorUserId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      const job = await transaction
        .insertInto('data_import_jobs')
        .values({
          import_type: 'moet_codes',
          file_id: file.id,
          status: 'committed',
          total_rows: rows.length,
          error_rows: new Set(errors.map((error) => error.row)).size,
          errors: JSON.stringify(errors),
          created_by: origin.actorUserId,
          committed_by: origin.actorUserId,
          committed_at: this.clock.now(),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      return { ...(await this.readJob(transaction, job.id)), assigned_rows: assignments.length };
    });
  }

  private async readJob(database: Executor, jobId: string): Promise<ImportJobView> {
    const job = await database
      .selectFrom('data_import_jobs')
      .select(['id', 'import_type', 'status', 'total_rows', 'error_rows', 'errors', 'created_at', 'committed_at'])
      .where('id', '=', jobId)
      .executeTakeFirst();
    if (!job) {
      throw notFoundError('Không tìm thấy lần nhập', 'data_import_job');
    }
    return { ...job, errors: job.errors as RowError[] };
  }

  private async validate(
    database: Executor,
    currentUser: CurrentUser,
    type: UploadType,
    rows: SheetRow[],
  ): Promise<{ errors: RowError[]; classes: ClassRow[]; children: ChildRow[]; openingDebts: OpeningDebtRow[] }> {
    if (type === 'opening_debts') {
      const errors: RowError[] = [];
      const openingDebts = await this.validateOpeningDebts(database, currentUser, rows, errors);
      return { errors, classes: [], children: [], openingDebts };
    }
    const units = await database.selectFrom('org_units').select(['id', 'code', 'status']).execute();
    const scope = await this.organizationScopes.resolve(currentUser, PERMISSION_CODES.importChildren);
    const errors: RowError[] = [];
    const resolveUnit = (row: number, code: string | undefined) => {
      const unit = units.find((item) => item.code === code);
      if (!unit || unit.status !== 'active') {
        errors.push({ row, column: 'Mã đơn vị', message: 'Không có đơn vị đang dùng với mã này' });
        return undefined;
      }
      if (!scope.wholeSchool && !scope.orgUnitIds.includes(unit.id)) {
        errors.push({ row, column: 'Mã đơn vị', message: 'Đơn vị này nằm ngoài phạm vi của bạn' });
        return undefined;
      }
      return unit.id;
    };
    if (type === 'classes') {
      return {
        errors,
        classes: await this.validateClasses(database, rows, resolveUnit, errors),
        children: [],
        openingDebts: [],
      };
    }
    return {
      errors,
      classes: [],
      children: await this.validateChildren(database, rows, resolveUnit, errors),
      openingDebts: [],
    };
  }

  // Trẻ tìm theo số định danh trong phạm vi của kế toán; mỗi trẻ một hóa đơn đầu kỳ trong năm học (YCTD-54)
  private async validateOpeningDebts(
    database: Executor,
    currentUser: CurrentUser,
    rows: SheetRow[],
    errors: RowError[],
  ): Promise<OpeningDebtRow[]> {
    const scope = await this.organizationScopes.resolveStaff(currentUser, PERMISSION_CODES.openingDebtImport);
    const seen = new Set<string>();
    const result: OpeningDebtRow[] = [];
    for (const { row, values } of rows) {
      const before = errors.length;
      const amount = Number(values.amount);
      if (!Number.isInteger(amount) || amount <= 0 || amount > MAXIMUM_AMOUNT) {
        errors.push({ row, column: 'Số tiền', message: 'Số nguyên đồng lớn hơn 0' });
      }
      const dueDate = parseDate(values.due_date ?? '');
      if (!dueDate) {
        errors.push({ row, column: 'Ngày đến hạn', message: 'Ngày không hợp lệ' });
      }
      const note = values.note || null;
      if (note && note.length > 500) {
        errors.push({ row, column: 'Ghi chú', message: 'Tối đa 500 ký tự' });
      }
      if (!NATIONAL_ID_PATTERN.test(values.national_id ?? '')) {
        errors.push({ row, column: 'Số định danh cá nhân', message: 'Số định danh cá nhân gồm mười hai chữ số' });
        continue;
      }
      const child = await database
        .selectFrom('children')
        .select(['id', 'org_unit_id', 'full_name'])
        .where('national_id_hash', '=', this.protection.hash(values.national_id ?? ''))
        .executeTakeFirst();
      if (!child || (!scope.wholeSchool && !scope.orgUnitIds.includes(child.org_unit_id))) {
        errors.push({
          row,
          column: 'Số định danh cá nhân',
          message: 'Không có trẻ nào khớp số định danh này trong phạm vi của bạn',
        });
        continue;
      }
      if (values.full_name && values.full_name.trim() !== child.full_name) {
        errors.push({ row, column: 'Họ tên trẻ', message: `Không khớp hồ sơ: ${child.full_name}` });
      }
      if (seen.has(child.id)) {
        errors.push({ row, column: 'Số định danh cá nhân', message: 'Trẻ xuất hiện nhiều lần trong tệp' });
      }
      seen.add(child.id);
      const existing = await database
        .selectFrom('invoices')
        .select('id')
        .where('child_id', '=', child.id)
        .where('invoice_kind', '=', 'opening')
        .executeTakeFirst();
      if (existing) {
        errors.push({ row, column: 'Số định danh cá nhân', message: 'Trẻ đã có công nợ đầu kỳ trong năm học' });
      }
      if (errors.length === before) {
        result.push({ child_id: child.id, org_unit_id: child.org_unit_id, amount, due_date: dueDate ?? '', note });
      }
    }
    return result;
  }

  // Mỗi dòng thành một hóa đơn đầu kỳ đã phát hành ở tháng đầu năm học, thu bằng phiếu thu như hóa đơn thường
  private async commitOpeningDebts(
    database: Kysely<SchoolYearDatabase>,
    rows: OpeningDebtRow[],
    jobId: string,
    origin: ChangeOrigin,
  ): Promise<ImportJobView> {
    const first = (await this.periods.list())[0];
    if (!first) {
      throw ruleViolationError('P01-13', 'Năm học chưa có lịch học kỳ');
    }
    const [year, month] = first.period.split('-').map(Number);
    return database.transaction().execute(async (transaction) => {
      for (const row of rows) {
        const code = await nextDocumentCode(transaction, 'invoice', 'HD');
        const invoice = await transaction
          .insertInto('invoices')
          .values({
            code,
            child_id: row.child_id,
            org_unit_id: row.org_unit_id,
            period_year: year ?? 0,
            period_month: month ?? 0,
            invoice_kind: 'opening',
            status: 'issued',
            total_amount: row.amount,
            basis: JSON.stringify({ import_job_id: jobId }),
            review_flags: JSON.stringify([]),
            due_date: row.due_date,
            issued_at: this.clock.now(),
            issued_by: origin.actorUserId,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await transaction
          .insertInto('invoice_items')
          .values({
            invoice_id: invoice.id,
            item_type: 'opening',
            service_id: null,
            description: 'Công nợ đầu kỳ',
            quantity: 1,
            unit_price: row.amount,
            amount: row.amount,
            basis_note: row.note,
          })
          .execute();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: row.org_unit_id,
          entityName: 'invoices',
          entityId: invoice.id,
          action: 'create',
          before: null,
          after: { code, invoice_kind: 'opening', amount: row.amount, due_date: row.due_date, import_job_id: jobId },
        });
      }
      await transaction
        .updateTable('data_import_jobs')
        .set({ status: 'committed', committed_by: origin.actorUserId, committed_at: this.clock.now() })
        .where('id', '=', jobId)
        .execute();
      return this.readJob(transaction, jobId);
    });
  }

  private async validateClasses(
    database: Executor,
    rows: SheetRow[],
    resolveUnit: (row: number, code: string | undefined) => string | undefined,
    errors: RowError[],
  ): Promise<ClassRow[]> {
    const gradeLevels = await database
      .selectFrom('grade_levels')
      .select('code')
      .where('status', '=', 'active')
      .execute();
    const rooms = await database
      .selectFrom('rooms')
      .select(['id', 'org_unit_id', 'code'])
      .where('status', '=', 'active')
      .execute();
    const existing = await database.selectFrom('classes').select(['org_unit_id', 'code']).execute();
    const seen = new Set<string>();
    const result: ClassRow[] = [];
    for (const { row, values } of rows) {
      const before = errors.length;
      const orgUnitId = resolveUnit(row, values.unit_code);
      for (const [key, header] of [
        ['class_code', 'Mã lớp'],
        ['class_name', 'Tên lớp'],
        ['grade_level', 'Mã bậc học'],
      ] as const) {
        if (!values[key]) {
          errors.push({ row, column: header, message: 'Bắt buộc nhập' });
        }
      }
      if (values.grade_level && !gradeLevels.some((level) => level.code === values.grade_level)) {
        errors.push({ row, column: 'Mã bậc học', message: 'Bậc học không có hoặc đã ngừng sử dụng' });
      }
      const maxSize = Number(values.max_size);
      if (!Number.isInteger(maxSize) || maxSize < 1 || maxSize > 200) {
        errors.push({ row, column: 'Sĩ số tối đa', message: 'Số nguyên từ 1 đến 200' });
      }
      const room = values.room_code
        ? rooms.find((item) => item.code === values.room_code && item.org_unit_id === orgUnitId)
        : undefined;
      if (values.room_code && !room) {
        errors.push({ row, column: 'Mã phòng', message: 'Không có phòng đang dùng với mã này ở đơn vị của lớp' });
      }
      const key = `${orgUnitId}:${values.class_code}`;
      if (orgUnitId && values.class_code) {
        if (seen.has(key)) {
          errors.push({ row, column: 'Mã lớp', message: 'Mã lớp trùng với dòng khác trong tệp' });
        } else if (existing.some((item) => item.org_unit_id === orgUnitId && item.code === values.class_code)) {
          errors.push({ row, column: 'Mã lớp', message: 'Mã lớp đã có trong đơn vị' });
        }
        seen.add(key);
      }
      if (errors.length === before && orgUnitId) {
        result.push({
          org_unit_id: orgUnitId,
          code: values.class_code ?? '',
          name: values.class_name ?? '',
          grade_level: values.grade_level ?? '',
          max_size: maxSize,
          room_id: room?.id ?? null,
        });
      }
    }
    return result;
  }

  private async validateChildren(
    database: Executor,
    rows: SheetRow[],
    resolveUnit: (row: number, code: string | undefined) => string | undefined,
    errors: RowError[],
  ): Promise<ChildRow[]> {
    const classes = await database
      .selectFrom('classes')
      .select(['id', 'org_unit_id', 'code'])
      .where('status', '=', 'active')
      .execute();
    const relationships = await database
      .selectFrom('catalog_items')
      .select(['id', 'code', 'name'])
      .where('catalog_type', '=', 'parent_relationship')
      .where('status', '=', 'active')
      .execute();
    const findRelationship = (text: string) =>
      relationships.find(
        (item) => item.code.toLowerCase() === text.toLowerCase() || item.name.toLowerCase() === text.toLowerCase(),
      );
    const today = VIETNAM_DATE.format(this.clock.now());
    const nationalIdsInFile = new Map<string, number>();
    const moetCodesInFile = new Map<string, number>();
    for (const { values } of rows) {
      if (values.national_id) {
        nationalIdsInFile.set(values.national_id, (nationalIdsInFile.get(values.national_id) ?? 0) + 1);
      }
      if (values.moet_code) {
        moetCodesInFile.set(values.moet_code, (moetCodesInFile.get(values.moet_code) ?? 0) + 1);
      }
    }
    const result: ChildRow[] = [];
    for (const { row, values } of rows) {
      const before = errors.length;
      const fail = (column: string, message: string) => errors.push({ row, column, message });
      const orgUnitId = resolveUnit(row, values.unit_code);
      const classRecord = classes.find((item) => item.code === values.class_code && item.org_unit_id === orgUnitId);
      if (orgUnitId && !classRecord) {
        fail('Mã lớp', 'Không có lớp đang dùng với mã này ở đơn vị');
      }
      const fullName = values.full_name ?? '';
      if (!fullName) {
        fail('Họ tên trẻ', 'Bắt buộc nhập');
      } else if (fullName.length > 100) {
        fail('Họ tên trẻ', 'Tối đa 100 ký tự');
      }
      const dob = values.dob ? parseDate(values.dob) : null;
      if (!values.dob) {
        fail('Ngày sinh', 'Bắt buộc nhập');
      } else if (!dob || dob > today) {
        fail('Ngày sinh', 'Ngày không hợp lệ hoặc lớn hơn ngày hiện tại');
      }
      const gender =
        values.gender?.toLowerCase() === 'nam' ? 'male' : values.gender?.toLowerCase() === 'nữ' ? 'female' : null;
      if (!gender) {
        fail('Giới tính', 'Ghi Nam hoặc Nữ');
      }
      const nationalId = values.national_id ?? '';
      if (!NATIONAL_ID_PATTERN.test(nationalId)) {
        fail('Số định danh cá nhân', 'Số định danh cá nhân gồm mười hai chữ số');
      } else if ((nationalIdsInFile.get(nationalId) ?? 0) > 1) {
        fail('Số định danh cá nhân', 'Trùng với dòng khác trong tệp');
      } else if (
        await database
          .selectFrom('children')
          .select('id')
          .where('national_id_hash', '=', this.protection.hash(nationalId))
          .executeTakeFirst()
      ) {
        fail('Số định danh cá nhân', 'Đã có hồ sơ trẻ với số định danh này');
      }
      const moetCode = values.moet_code || null;
      if (moetCode) {
        if ((moetCodesInFile.get(moetCode) ?? 0) > 1) {
          fail('Mã định danh ngành', 'Trùng với dòng khác trong tệp');
        } else if (
          await database
            .selectFrom('children')
            .select('id')
            .where('moet_student_code', '=', moetCode)
            .executeTakeFirst()
        ) {
          fail('Mã định danh ngành', 'Mã đã gán cho trẻ khác');
        }
      }
      const allergyText = values.allergies ?? '';
      if (!allergyText) {
        fail('Dị ứng', 'Ghi "Không" hoặc ghi dị ứng gì (BR-06)');
      }
      const enrollDate = values.enroll_date ? parseDate(values.enroll_date) : today;
      if (!enrollDate) {
        fail('Ngày vào lớp', 'Ngày không hợp lệ');
      }
      const guardians: ChildRow['guardians'] = [];
      for (const index of [1, 2] as const) {
        const name = values[`guardian${index}_name`] ?? '';
        const relationshipText = values[`guardian${index}_relationship`] ?? '';
        const phone = values[`guardian${index}_phone`] || null;
        if (index === 2 && !name && !relationshipText && !phone) {
          continue;
        }
        if (!name) {
          fail(`Họ tên phụ huynh ${index}`, 'Bắt buộc nhập');
        }
        const relationship = findRelationship(relationshipText);
        if (!relationship) {
          fail(`Quan hệ phụ huynh ${index}`, 'Không có trong danh mục Quan hệ với trẻ');
        }
        if (phone && !PHONE_PATTERN.test(phone)) {
          fail(`Số điện thoại phụ huynh ${index}`, 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0');
        }
        if (relationship) {
          guardians.push({ full_name: name, phone, relationship_item_id: relationship.id });
        }
      }
      if (guardians.length === 2 && guardians[0]?.phone && guardians[0].phone === guardians[1]?.phone) {
        fail('Số điện thoại phụ huynh 2', 'Hai phụ huynh không dùng chung một số điện thoại');
      }
      if (!guardians.some((guardian) => guardian.phone)) {
        fail('Số điện thoại phụ huynh 1', 'Cần ít nhất một người liên hệ có số điện thoại (BR-06)');
      }
      if (errors.length === before && orgUnitId && classRecord && dob && gender && enrollDate) {
        const noAllergy = allergyText.toLowerCase() === 'không';
        result.push({
          org_unit_id: orgUnitId,
          class_id: classRecord.id,
          full_name: fullName,
          dob,
          gender,
          national_id: nationalId,
          moet_student_code: moetCode,
          place_of_birth: values.place_of_birth || null,
          address: values.address || null,
          has_allergies: !noAllergy,
          allergies: noAllergy ? null : allergyText,
          chronic_conditions: values.chronic_conditions || null,
          enroll_date: enrollDate,
          guardians,
        });
      }
    }
    return result;
  }

  // Trẻ nhập vào thẳng trạng thái đang học; giấy khai sinh bổ sung sau; đồng ý hình ảnh chờ phụ huynh xác nhận (YCTD-46)
  private async insertImportedChild(
    transaction: Transaction<SchoolYearDatabase>,
    row: ChildRow,
    accounts: Map<string, { userId: string; created: boolean }>,
    origin: ChangeOrigin,
    jobId: string,
  ): Promise<void> {
    const now = this.clock.now();
    const child = await transaction
      .insertInto('children')
      .values({
        org_unit_id: row.org_unit_id,
        full_name: row.full_name,
        dob: row.dob,
        gender: row.gender,
        place_of_birth: row.place_of_birth,
        address: row.address,
        national_id_encrypted: this.protection.encrypt(row.national_id),
        national_id_hash: this.protection.hash(row.national_id),
        national_id_last4: row.national_id.slice(-4),
        moet_student_code: row.moet_student_code,
        birth_certificate_file_id: null,
        status: 'active',
        photo_consent: 'pending',
        photo_consent_by: origin.actorUserId,
        photo_consent_at: now,
        enroll_date: row.enroll_date,
        approved_by: origin.actorUserId,
        approved_at: now,
        created_by: origin.actorUserId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await transaction
      .insertInto('health_profiles')
      .values({
        child_id: child.id,
        has_allergies: row.has_allergies,
        allergies: row.allergies,
        chronic_conditions: row.chronic_conditions,
        created_by: origin.actorUserId,
      })
      .execute();
    await transaction
      .insertInto('photo_consent_histories')
      .values({ child_id: child.id, action: 'pending', actor_user_id: origin.actorUserId })
      .execute();
    for (const [index, guardian] of row.guardians.entries()) {
      const existing = guardian.phone
        ? await transaction.selectFrom('guardians').select('id').where('phone', '=', guardian.phone).executeTakeFirst()
        : undefined;
      const account = guardian.phone ? accounts.get(guardian.phone) : undefined;
      const guardianId =
        existing?.id ??
        (
          await transaction
            .insertInto('guardians')
            .values({
              full_name: guardian.full_name,
              phone: guardian.phone,
              user_id: account?.userId ?? null,
              created_by: origin.actorUserId,
            })
            .returning('id')
            .executeTakeFirstOrThrow()
        ).id;
      if (existing && account) {
        await transaction
          .updateTable('guardians')
          .set({ user_id: account.userId })
          .where('id', '=', existing.id)
          .execute();
      }
      await transaction
        .insertInto('child_guardians')
        .values({
          child_id: child.id,
          guardian_id: guardianId,
          relationship_item_id: guardian.relationship_item_id,
          is_primary: index === 0,
          created_by: origin.actorUserId,
        })
        .execute();
    }
    await transaction
      .insertInto('class_enrollments')
      .values({
        child_id: child.id,
        class_id: row.class_id,
        from_date: row.enroll_date,
        reason: 'Nhập dữ liệu ban đầu',
        created_by: origin.actorUserId,
      })
      .execute();
    await writeAuditLog(transaction, {
      origin,
      orgUnitId: row.org_unit_id,
      entityName: 'children',
      entityId: child.id,
      action: 'create',
      before: null,
      after: {
        full_name: row.full_name,
        dob: row.dob,
        class_id: row.class_id,
        status: 'active',
        import_job_id: jobId,
        national_id_masked: `********${row.national_id.slice(-4)}`,
      },
    });
  }

  assertImportType(value: unknown): ImportType {
    if (value === 'classes' || value === 'children' || value === 'moet_codes' || value === 'opening_debts') {
      return value;
    }
    throw new ApplicationError(
      'ERR_VALIDATION',
      'Loại dữ liệu nhập là classes, children, moet_codes hoặc opening_debts',
      [{ field: 'type', message: 'Loại không hợp lệ' }],
    );
  }
}
