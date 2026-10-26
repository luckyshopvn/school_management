import { Body, Controller, Get, HttpCode, Injectable, Post, Query, Req, Res } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  readBearerToken,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request, Response } from 'express';
import type { Kysely, Transaction } from 'kysely';
import { randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import { IdentityClient } from '../authentication/identity-client.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { ChildScope } from '../children/child-scope.js';
import { findStudents, readStudentListFilter, type StudentListFilter } from '../children/student-list.js';
import { buildStudentWorkbook, fileStamp, sendWorkbook } from '../children/student-workbook.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { ChildDataProtection } from '../common/child-data-protection.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { isUuid, notFoundError, type RequestBody } from '../common/request-fields.js';
import { buildTableFile } from '../exports/table-file.js';
import { BULK_LIMIT, logExportedFile, STUDENT_RECORDS_RULE_CODE } from './student-records-common.js';

// Tài khoản học và thi của học sinh (mục 4.1.10 của Sở) và mã định danh, mật khẩu mặc định của học sinh (mục 5.4), DT-16
// phần 16g. Trẻ mầm non không tự đăng nhập và hệ thống chưa có phần mềm học, thi trực tuyến nên tài khoản chỉ lưu nội bộ
// (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11): "Khởi tạo" tạo tên đăng nhập, mật khẩu cho học sinh chưa có tài
// khoản, "Cấp lại mật khẩu" tạo mật khẩu mới. Mật khẩu chỉ hiện một lần ở màn hình và tệp danh sách tài khoản vừa tạo; hệ thống
// chỉ lưu giá trị băm (scrypt có muối). Tên đăng nhập là "hs" kèm mã định danh Bộ GD&ĐT, chưa có mã thì "hs" kèm số thứ tự
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, length: number) => Promise<Buffer>;
const KEY_LENGTH = 32;
const PAGE_LIMIT = 200;
const EXPORT_LIMIT = 10_000;
// Bỏ các ký tự dễ nhầm (0, O, 1, l, I) để in, đọc cho phụ huynh
const PASSWORD_ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PASSWORD_LENGTH = 8;

export function generatePassword(): string {
  return Array.from({ length: PASSWORD_LENGTH }, () => PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)]).join('');
}

export async function hashLearningPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyLearningPassword(password: string, stored: string): Promise<boolean> {
  const [method, salt, key] = stored.split('$');
  if (method !== 'scrypt' || !salt || !key) {
    return false;
  }
  const expected = Buffer.from(key, 'base64');
  const actual = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length);
  return timingSafeEqual(actual, expected);
}

export type IssueMode = 'create' | 'reset';

@Injectable()
export class LearningAccountsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly childScope: ChildScope,
    private readonly protection: ChildDataProtection,
    private readonly clock: Clock,
    private readonly identityClient: IdentityClient,
  ) {}

  private async accountsOf(database: Executor, childIds: string[]) {
    return childIds.length
      ? database
          .selectFrom('student_learning_accounts')
          .select(['child_id', 'username', 'issued_at', 'issued_by_name', 'reset_count', 'identity_user_id'])
          .where('child_id', 'in', childIds)
          .execute()
      : [];
  }

  private async page(currentUser: CurrentUser, filter: StudentListFilter, page: { limit: number; offset: number }) {
    const { database } = await this.currentSchoolYear.require();
    const scope = await this.childScope.resolve(currentUser, database);
    const hash = filter.nationalId ? this.protection.hash(filter.nationalId) : null;
    const result = await findStudents(database, this.childScope, scope, filter, hash, page);
    const accounts = await this.accountsOf(
      database,
      result.rows.map((row) => row.id),
    );
    return {
      database,
      total: result.total,
      items: result.rows.map((row) => {
        const account = accounts.find((item) => item.child_id === row.id);
        return {
          id: row.id,
          org_unit_id: row.org_unit_id,
          moet_student_code: row.moet_student_code,
          full_name: row.full_name,
          dob: row.dob,
          status: row.status,
          class_name: row.class_name,
          username: account?.username ?? null,
          issued_at: account?.issued_at ?? null,
          issued_by_name: account?.issued_by_name ?? null,
          reset_count: account?.reset_count ?? 0,
          // Đã nối với người dùng kênh student (DT-23 phần 23a); tài khoản cấp trước đó cần "Cấp lại mật khẩu" một lần
          sign_in_ready: Boolean(account?.identity_user_id),
        };
      }),
    };
  }

  async list(currentUser: CurrentUser, filter: StudentListFilter, page: number, pageSize: number) {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return { items: [], page, page_size: pageSize, total: 0, total_pages: 1 };
    }
    const { total, items } = await this.page(currentUser, filter, {
      limit: Math.min(pageSize, PAGE_LIMIT),
      offset: (page - 1) * pageSize,
    });
    return { items, page, page_size: pageSize, total, total_pages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  // Danh sách tài khoản (không có mật khẩu) theo bộ lọc
  async exportList(currentUser: CurrentUser, filter: StudentListFilter, ipAddress: string | null) {
    const { database, total, items } = await this.page(currentUser, filter, { limit: EXPORT_LIMIT, offset: 0 });
    if (total > EXPORT_LIMIT) {
      throw ruleViolationError(STUDENT_RECORDS_RULE_CODE, `Tối đa ${EXPORT_LIMIT} học sinh mỗi tệp, thu hẹp bộ lọc`);
    }
    const createdAt = this.clock.now();
    return buildStudentWorkbook({
      database,
      currentUser,
      reportCode: 'learning-accounts',
      title: 'Tài khoản học và thi của học sinh',
      fileName: `tai-khoan-hoc-sinh-${fileStamp(createdAt)}.xlsx`,
      filters: { ...filter, nationalId: filter.nationalId ? 'đã nhập' : undefined },
      orgUnitIds: [...new Set(items.map((item) => item.org_unit_id))],
      columns: [
        { key: 'moet_student_code', label: 'Mã định danh Bộ GD&ĐT' },
        { key: 'full_name', label: 'Họ tên' },
        { key: 'class_name', label: 'Lớp' },
        { key: 'username', label: 'Tên đăng nhập' },
        { key: 'state', label: 'Tình trạng' },
        { key: 'issued_at', label: 'Ngày cấp mật khẩu' },
      ],
      rows: items.map((item) => ({
        ...item,
        username: item.username ?? '',
        state: item.username ? 'Đã khởi tạo' : 'Chưa khởi tạo',
        issued_at: item.issued_at
          ? new Date(item.issued_at).toISOString().slice(0, 10).split('-').reverse().join('/')
          : '',
      })),
      ipAddress,
      createdAt,
    });
  }

  private async nextUsername(database: Executor, moetCode: string | null, taken: Set<string>): Promise<string> {
    const base = moetCode ? `hs${moetCode.toLowerCase().replace(/[^a-z0-9]/g, '')}` : '';
    if (base && !taken.has(base)) {
      const used = await database
        .selectFrom('student_learning_accounts')
        .select('id')
        .where('username', '=', base)
        .executeTakeFirst();
      if (!used) {
        return base;
      }
    }
    const count = await database
      .selectFrom('student_learning_accounts')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    for (let sequence = Number(count.count) + 1; ; sequence += 1) {
      const candidate = `hs${String(sequence).padStart(6, '0')}`;
      if (taken.has(candidate)) {
        continue;
      }
      const used = await database
        .selectFrom('student_learning_accounts')
        .select('id')
        .where('username', '=', candidate)
        .executeTakeFirst();
      if (!used) {
        return candidate;
      }
    }
  }

  // "Khởi tạo" (học sinh chưa có tài khoản) hoặc "Cấp lại mật khẩu" (học sinh đã có tài khoản). Trả về mật khẩu một lần và
  // tệp danh sách tài khoản vừa tạo; tệp có mật khẩu nên ghi nhật ký xuất có dữ liệu cá nhân (BR-74)
  async issue(
    currentUser: CurrentUser,
    childIds: string[],
    mode: IssueMode,
    origin: ChangeOrigin,
    ipAddress: string | null,
    accessToken: string,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const scope = await this.childScope.resolve(currentUser, database);
    const children = await database
      .selectFrom('children')
      .leftJoin('class_enrollments', (join) =>
        join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
      )
      .leftJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select([
        'children.id',
        'children.org_unit_id',
        'children.full_name',
        'children.status',
        'children.moet_student_code',
        'classes.name as class_name',
      ])
      .where('children.id', 'in', childIds)
      .where(this.childScope.filter(scope))
      .execute();
    if (children.length !== childIds.length) {
      throw notFoundError('Có học sinh không tồn tại hoặc nằm ngoài phạm vi của bạn', 'child');
    }
    const notActive = children.filter((child) => !['active', 'paused'].includes(child.status));
    if (notActive.length > 0) {
      throw ruleViolationError(
        STUDENT_RECORDS_RULE_CODE,
        'Chỉ cấp tài khoản cho học sinh đang học hoặc tạm nghỉ',
        notActive.map((child) => ({ field: 'child_ids', message: child.full_name })),
      );
    }
    const accounts = await this.accountsOf(database, childIds);
    const targets = children.filter((child) =>
      mode === 'create'
        ? !accounts.some((account) => account.child_id === child.id)
        : accounts.some((account) => account.child_id === child.id),
    );
    if (targets.length === 0) {
      throw ruleViolationError(
        STUDENT_RECORDS_RULE_CODE,
        mode === 'create'
          ? 'Các học sinh đã chọn đều đã có tài khoản; dùng Cấp lại mật khẩu'
          : 'Các học sinh đã chọn chưa có tài khoản; dùng Khởi tạo tài khoản',
      );
    }
    const now = this.clock.now();
    const issued: Array<{
      child_id: string;
      full_name: string;
      class_name: string;
      username: string;
      password: string;
    }> = [];
    await database.transaction().execute(async (transaction) => {
      const taken = new Set<string>();
      for (const child of targets) {
        const password = generatePassword();
        const passwordHash = await hashLearningPassword(password);
        const existing = accounts.find((account) => account.child_id === child.id);
        let username: string;
        if (existing) {
          username = existing.username;
          await transaction
            .updateTable('student_learning_accounts')
            .set((expression) => ({
              password_hash: passwordHash,
              issued_at: now,
              issued_by_name: origin.actorName,
              reset_count: expression('reset_count', '+', 1),
              updated_at: now,
            }))
            .where('child_id', '=', child.id)
            .execute();
        } else {
          username = await this.nextUsername(transaction, child.moet_student_code, taken);
          await transaction
            .insertInto('student_learning_accounts')
            .values({
              child_id: child.id,
              username,
              password_hash: passwordHash,
              issued_at: now,
              issued_by_name: origin.actorName,
              created_by: origin.actorUserId,
            })
            .execute();
        }
        taken.add(username);
        issued.push({
          child_id: child.id,
          full_name: child.full_name,
          class_name: child.class_name ?? '',
          username,
          password,
        });
        // Nhật ký không ghi mật khẩu
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: child.org_unit_id,
          entityName: 'student_learning_accounts',
          entityId: child.id,
          action: existing ? 'update' : 'create',
          before: existing ? { username, reset_count: existing.reset_count } : null,
          after: { username, password_issued: true, mode },
        });
      }
      // Người dùng định danh của kênh student gắn một-một với tài khoản (DT-23 phần 23a, GD-105): gọi trong giao dịch để lỗi
      // ở dịch vụ định danh hoàn tác cả lần cấp, học sinh không cầm mật khẩu không đăng nhập được
      const synced = await this.identityClient.syncStudentAccounts(
        accessToken,
        issued.map((item) => ({
          username: item.username,
          full_name: item.full_name,
          password: item.password,
          org_unit_id: targets.find((child) => child.id === item.child_id)?.org_unit_id ?? '',
        })),
      );
      for (const item of synced.items) {
        await transaction
          .updateTable('student_learning_accounts')
          .set({ identity_user_id: item.user_id })
          .where('username', '=', item.username)
          .execute();
      }
    });
    const buffer = await buildTableFile(
      'xlsx',
      [
        {
          title: 'Tài khoản học và thi',
          columns: [
            { key: 'full_name', label: 'Họ tên' },
            { key: 'class_name', label: 'Lớp' },
            { key: 'username', label: 'Tên đăng nhập' },
            { key: 'password', label: 'Mật khẩu' },
          ],
          rows: issued,
          numbered: true,
        },
      ],
      now,
    );
    const file = await logExportedFile(database, currentUser, {
      reportCode: 'learning-account-passwords',
      fileName: `mat-khau-hoc-sinh-${fileStamp(now)}.xlsx`,
      buffer,
      rowCount: issued.length,
      orgUnitIds: [...new Set(targets.map((child) => child.org_unit_id))],
      filters: { mode, child_count: issued.length },
      ipAddress,
    });
    return {
      mode,
      items: issued,
      skipped: children.length - targets.length,
      file: { name: file.fileName, content_base64: buffer.toString('base64') },
    };
  }
}

function readPaging(query: Record<string, string | undefined>, errors: FieldError[]) {
  const page = Number(query.page ?? 1);
  const pageSize = Number(query.page_size ?? 20);
  if (!Number.isInteger(page) || page < 1) {
    errors.push({ field: 'page', message: 'Số trang bắt đầu từ 1' });
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > PAGE_LIMIT) {
    errors.push({ field: 'page_size', message: `Cỡ trang từ 1 đến ${PAGE_LIMIT}` });
  }
  return { page, pageSize };
}

@Controller('learning-accounts')
export class LearningAccountsController {
  constructor(private readonly service: LearningAccountsService) {}

  @Get()
  @RequirePermission(PERMISSION_CODES.accountManage)
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const { page, pageSize } = readPaging(query, errors);
    const filter = readStudentListFilter(query, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.service.list(currentUser, filter, page, pageSize);
  }

  @Post('export')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.accountManage)
  async exportList(
    @Body() body: RequestBody,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!currentUser.hasPermission(PERMISSION_CODES.dataExport)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Xuất danh sách tài khoản cần quyền xuất dữ liệu');
    }
    const errors: FieldError[] = [];
    const filter = readStudentListFilter(body ?? {}, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    sendWorkbook(response, await this.service.exportList(currentUser, filter, request.ip ?? null));
  }

  @Post('issue')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.accountManage)
  issue(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const raw = body?.child_ids;
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > BULK_LIMIT || !raw.every(isUuid)) {
      errors.push({ field: 'child_ids', message: `Chọn từ 1 đến ${BULK_LIMIT} học sinh` });
    }
    const mode = body?.mode;
    if (mode !== 'create' && mode !== 'reset') {
      errors.push({ field: 'mode', message: 'Chọn khởi tạo hoặc cấp lại mật khẩu' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.service.issue(
      currentUser,
      [...new Set(raw as string[])],
      mode as IssueMode,
      originOf(request, currentUser),
      request.ip ?? null,
      readBearerToken(request.header('authorization')),
    );
  }
}
