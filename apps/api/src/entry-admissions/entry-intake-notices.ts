import { Injectable } from '@nestjs/common';
import { Clock, ruleViolationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { CurrentUser } from '../authentication/current-user.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { ChildDataProtection, maskNationalId } from '../common/child-data-protection.js';
import { queueNotification } from '../common/notification-queue.js';
import { notFoundError } from '../common/request-fields.js';
import {
  buildErrorWorkbook,
  buildTemplate,
  parseDate,
  readSheet,
  type ImportColumn,
  type RowError,
} from '../imports/excel.js';
import { ENTRY_INTAKE_RULE, EntryIntakeService, INTAKE_VIEW, type IntakeFilter, type YesNo } from './entry-intake.js';

// 1.5 Gửi thông báo tuyển sinh đầu cấp (DT-17 phần 17d, khảo sát mục 10.2.4): người nhận là hồ sơ của 1.4 và học sinh ngoài
// hệ thống nhập từ Excel. Mỗi người nhận có "Nội dung gửi" riêng (nhập từ Excel hoặc "Sao chép nội dung" từ khối soạn tin);
// dòng chưa có nội dung riêng gửi nội dung đang soạn. Gửi qua kênh thông báo của ứng dụng phụ huynh và Zalo OA tới tài
// khoản phụ huynh có cùng số điện thoại; chưa có tài khoản thì ghi chưa gửi được, tin nhắn SMS chờ kết nối nhà cung cấp
// (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11)
const MANAGE = PERMISSION_CODES.entryIntakeManage;
const MAXIMUM_CONTENT = 1000;
const NATIONAL_ID_PATTERN = /^\d{12}$/;
const PHONE_PATTERN = /^0\d{9,10}$/;
export const NO_ACCOUNT_NOTE = 'Chưa có tài khoản ứng dụng phụ huynh; tin nhắn SMS chờ kết nối nhà cung cấp';

export interface NoticeRecipient {
  key: string;
  application_id: string | null;
  contact_id: string | null;
  external: boolean;
  national_id: string;
  full_name: string;
  dob: string | null;
  gender: 'male' | 'female' | null;
  phone: string | null;
  notice_content: string | null;
  final_year_school: string | null;
  moet_code: string | null;
  program_type: string | null;
  routed: boolean;
  admission_decision: string | null;
  ward: string | null;
  quarter: string | null;
  last_notice_at: Date | null;
  has_parent_account: boolean;
}

export interface NoticeTargets {
  application_ids: string[];
  contact_ids: string[];
}

const CONTENT_COLUMNS: ImportColumn[] = [
  { key: 'national_id', header: 'Số ĐDCN', note: '12 chữ số; để trống thì tìm theo mã hồ sơ' },
  { key: 'code', header: 'Mã hồ sơ', note: 'Mã hồ sơ tuyển sinh (TS-…)' },
  { key: 'full_name', header: 'Họ và tên', note: 'Để đối chiếu' },
  { key: 'notice_content', header: 'Nội dung gửi (*)', note: `Tối đa ${MAXIMUM_CONTENT} ký tự` },
];
const EXTERNAL_COLUMNS: ImportColumn[] = [
  { key: 'full_name', header: 'Họ và tên (*)', note: '' },
  { key: 'dob', header: 'Ngày sinh', note: 'DD/MM/YYYY' },
  { key: 'gender', header: 'Giới tính', note: 'Nam hoặc Nữ' },
  { key: 'national_id', header: 'Số ĐDCN', note: '12 chữ số' },
  { key: 'phone', header: 'Số điện thoại (*)', note: '10 hoặc 11 chữ số, bắt đầu bằng 0' },
  { key: 'final_year_school', header: 'Cuối Cấp', note: 'Trường cuối cấp' },
  { key: 'notice_content', header: 'Nội dung gửi', note: `Tối đa ${MAXIMUM_CONTENT} ký tự` },
];

export function readNoticeContent(value: unknown, errors: FieldError[], field = 'content'): string {
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push({ field, message: 'Bắt buộc nhập nội dung tin nhắn' });
    return '';
  }
  if (value.trim().length > MAXIMUM_CONTENT) {
    errors.push({ field, message: `Tối đa ${MAXIMUM_CONTENT} ký tự` });
  }
  return value.trim();
}

const matches = (expected: YesNo | null, actual: boolean) => expected === null || (expected === 'yes') === actual;

@Injectable()
export class EntryIntakeNoticesService {
  constructor(
    private readonly intake: EntryIntakeService,
    private readonly protection: ChildDataProtection,
    private readonly clock: Clock,
  ) {}

  private async campaign(currentUser: CurrentUser, campaignId: string, permission: string | string[]) {
    const database = await this.intake.database();
    const campaign = await database
      .selectFrom('admission_campaigns')
      .select(['id', 'org_unit_id', 'name'])
      .where('id', '=', campaignId)
      .executeTakeFirst();
    if (!campaign) {
      throw notFoundError('Không tìm thấy đợt tuyển sinh', 'admission_campaign');
    }
    await this.intake.assertUnit(currentUser, permission, campaign.org_unit_id);
    return { database, campaign };
  }

  // Người nhận theo bộ lọc của Sở; học sinh ngoài hệ thống chỉ qua các ô lọc áp dụng được (số điện thoại, đã gửi, họ tên,
  // số định danh)
  async recipients(currentUser: CurrentUser, filter: IntakeFilter): Promise<{ items: NoticeRecipient[] }> {
    if (!filter.campaign_id) {
      return { items: [] };
    }
    const { database } = await this.campaign(currentUser, filter.campaign_id, INTAKE_VIEW);
    const { rows } = await this.intake.screenRows(currentUser, 'notices', filter);
    const items: NoticeRecipient[] = rows.map((row) => ({
      key: `a:${row.id}`,
      application_id: row.id,
      contact_id: null,
      external: false,
      national_id: row.national_id,
      full_name: row.full_name,
      dob: row.dob,
      gender: row.gender,
      phone: row.guardian_phone || null,
      notice_content: row.notice_content,
      final_year_school: row.final_year_school,
      moet_code: row.student_code,
      program_type: row.program_type,
      routed: row.routed,
      admission_decision: row.admission_decision,
      ward: row.ward,
      quarter: row.quarter,
      last_notice_at: row.last_notice_at,
      has_parent_account: row.has_parent_account,
    }));
    const onlyApplications =
      filter.program_type !== null ||
      filter.routed !== null ||
      filter.decision !== null ||
      filter.ward !== null ||
      filter.quarter !== null;
    if (!onlyApplications) {
      const contacts = await database
        .selectFrom('entry_admission_contacts')
        .selectAll()
        .where('campaign_id', '=', filter.campaign_id)
        .orderBy('full_name')
        .execute();
      const sent = await database
        .selectFrom('entry_admission_notice_recipients')
        .select(['contact_id', (expression) => expression.fn.max('created_at').as('last_at')])
        .where(
          'contact_id',
          'in',
          contacts.length ? contacts.map((contact) => contact.id) : ['00000000-0000-0000-0000-000000000000'],
        )
        .where('delivered', '=', true)
        .groupBy('contact_id')
        .execute();
      const phones = contacts.map((contact) => contact.phone).filter((phone): phone is string => !!phone);
      const accounts = new Set(
        phones.length
          ? (
              await database
                .selectFrom('guardians')
                .select('phone')
                .where('phone', 'in', phones)
                .where('user_id', 'is not', null)
                .execute()
            ).map((row) => row.phone)
          : [],
      );
      const name = filter.q?.toLocaleLowerCase('vi') ?? null;
      const nationalId = filter.national_id?.replace(/\s/g, '') ?? null;
      for (const contact of contacts) {
        const lastAt = sent.find((row) => row.contact_id === contact.id)?.last_at ?? null;
        if (
          (name && !contact.full_name.toLocaleLowerCase('vi').includes(name)) ||
          (nationalId && !(contact.national_id_last4 && nationalId.endsWith(contact.national_id_last4))) ||
          !matches(filter.has_phone, !!contact.phone) ||
          !matches(filter.notice_sent, lastAt !== null)
        ) {
          continue;
        }
        items.push({
          key: `c:${contact.id}`,
          application_id: null,
          contact_id: contact.id,
          external: true,
          national_id: contact.national_id_last4 ? maskNationalId(contact.national_id_last4) : '',
          full_name: contact.full_name,
          dob: contact.dob ? String(contact.dob).slice(0, 10) : null,
          gender: contact.gender,
          phone: contact.phone,
          notice_content: contact.notice_content,
          final_year_school: contact.final_year_school,
          moet_code: null,
          program_type: null,
          routed: false,
          admission_decision: null,
          ward: null,
          quarter: null,
          last_notice_at: lastAt ? new Date(lastAt) : null,
          has_parent_account: contact.phone ? accounts.has(contact.phone) : false,
        });
      }
    }
    return { items };
  }

  // "Sao chép nội dung": ghi nội dung đang soạn vào "Nội dung gửi" của người nhận đã chọn
  async copy(
    currentUser: CurrentUser,
    campaignId: string,
    content: string,
    targets: NoticeTargets,
    origin: ChangeOrigin,
  ) {
    const { database, campaign } = await this.campaign(currentUser, campaignId, MANAGE);
    await database.transaction().execute(async (transaction) => {
      if (targets.application_ids.length) {
        await transaction
          .updateTable('admission_applications')
          .set({ notice_content: content, updated_at: this.clock.now() })
          .where('campaign_id', '=', campaign.id)
          .where('id', 'in', targets.application_ids)
          .execute();
      }
      if (targets.contact_ids.length) {
        await transaction
          .updateTable('entry_admission_contacts')
          .set({ notice_content: content })
          .where('campaign_id', '=', campaign.id)
          .where('id', 'in', targets.contact_ids)
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: campaign.org_unit_id,
        entityName: 'admission_campaigns',
        entityId: campaign.id,
        action: 'update',
        before: null,
        after: { notice_content: content, recipients: targets.application_ids.length + targets.contact_ids.length },
      });
    });
    return { updated: targets.application_ids.length + targets.contact_ids.length };
  }

  // "Gửi thông báo": mỗi người nhận một thông báo với nội dung riêng của dòng hoặc nội dung đang soạn
  async send(
    currentUser: CurrentUser,
    campaignId: string,
    content: string | null,
    targets: NoticeTargets,
    origin: ChangeOrigin,
  ) {
    const { database, campaign } = await this.campaign(currentUser, campaignId, MANAGE);
    const applications = targets.application_ids.length
      ? await database
          .selectFrom('admission_applications')
          .select(['id', 'child_full_name as full_name', 'guardian_phone as phone', 'notice_content'])
          .where('campaign_id', '=', campaign.id)
          .where('id', 'in', targets.application_ids)
          .execute()
      : [];
    const contacts = targets.contact_ids.length
      ? await database
          .selectFrom('entry_admission_contacts')
          .select(['id', 'full_name', 'phone', 'notice_content'])
          .where('campaign_id', '=', campaign.id)
          .where('id', 'in', targets.contact_ids)
          .execute()
      : [];
    const all = [
      ...applications.map((row) => ({ ...row, kind: 'application' as const })),
      ...contacts.map((row) => ({ ...row, kind: 'contact' as const })),
    ];
    if (all.length === 0) {
      throw ruleViolationError(ENTRY_INTAKE_RULE, 'Chọn người nhận trong đợt tuyển sinh');
    }
    const missingContent = all.filter((row) => !row.notice_content && !content);
    if (missingContent.length > 0) {
      throw ruleViolationError(ENTRY_INTAKE_RULE, 'Soạn nội dung tin nhắn hoặc nhập "Nội dung gửi" cho người nhận');
    }
    const phones = [...new Set(all.map((row) => row.phone).filter((phone): phone is string => !!phone))];
    const accounts = phones.length
      ? await database
          .selectFrom('guardians')
          .select(['phone', 'user_id'])
          .where('phone', 'in', phones)
          .where('user_id', 'is not', null)
          .execute()
      : [];
    let delivered = 0;
    const notice = await database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('entry_admission_notices')
        .values({
          campaign_id: campaign.id,
          content: content ?? '',
          sent_by: origin.actorUserId,
          sent_by_name: origin.actorName,
        })
        .returning(['id', 'sent_at'])
        .executeTakeFirstOrThrow();
      for (const row of all) {
        const body = row.notice_content ?? content ?? '';
        const users = [
          ...new Set(accounts.filter((account) => account.phone === row.phone).map((item) => item.user_id!)),
        ];
        if (users.length > 0) {
          await queueNotification(transaction, {
            orgUnitId: campaign.org_unit_id,
            templateCode: 'entry_admission_notice',
            title: `Thông báo tuyển sinh: ${campaign.name}`,
            body,
            targetType: row.kind === 'application' ? 'admission_applications' : 'entry_admission_contacts',
            targetId: row.id,
            recipients: users.flatMap((userId) => [
              { userId, channel: 'in_app' as const },
              { userId, channel: 'zalo' as const },
            ]),
          });
          delivered += 1;
        }
        await transaction
          .insertInto('entry_admission_notice_recipients')
          .values({
            notice_id: created.id,
            application_id: row.kind === 'application' ? row.id : null,
            contact_id: row.kind === 'contact' ? row.id : null,
            phone: row.phone,
            content: body,
            channels: users.length > 0 ? 'Ứng dụng phụ huynh, Zalo OA' : null,
            delivered: users.length > 0,
            note: users.length > 0 ? null : row.phone ? NO_ACCOUNT_NOTE : 'Chưa có số điện thoại',
          })
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: campaign.org_unit_id,
        entityName: 'entry_admission_notices',
        entityId: created.id,
        action: 'create',
        before: null,
        after: { recipients: all.length, delivered },
      });
      return created;
    });
    return { notice_id: notice.id, recipients: all.length, delivered, not_delivered: all.length - delivered };
  }

  async template(kind: 'content' | 'external'): Promise<Buffer> {
    return buildTemplate(
      kind === 'content' ? 'Nội dung gửi' : 'Học sinh ngoài hệ thống',
      kind === 'content' ? CONTENT_COLUMNS : EXTERNAL_COLUMNS,
    );
  }

  // "Nhập từ Excel": nội dung gửi riêng của từng hồ sơ trong đợt, tìm theo số định danh hoặc mã hồ sơ
  async importContent(
    currentUser: CurrentUser,
    campaignId: string,
    body: Buffer,
    origin: ChangeOrigin,
    errorFile: boolean,
  ): Promise<{ updated: number; errors: RowError[] } | { errorWorkbook: Buffer }> {
    const { database, campaign } = await this.campaign(currentUser, campaignId, MANAGE);
    const sheet = await readSheet(body, CONTENT_COLUMNS);
    const applications = await database
      .selectFrom('admission_applications')
      .select(['id', 'code', 'child_national_id_hash'])
      .where('campaign_id', '=', campaign.id)
      .execute();
    const errors: RowError[] = [];
    const changes: Array<{ id: string; content: string }> = [];
    for (const row of sheet) {
      const nationalId = (row.values.national_id ?? '').trim();
      const code = (row.values.code ?? '').trim();
      const content = (row.values.notice_content ?? '').trim();
      const fieldErrors: FieldError[] = [];
      readNoticeContent(content, fieldErrors, 'notice_content');
      for (const error of fieldErrors) {
        errors.push({ row: row.row, column: 'Nội dung gửi (*)', message: error.message });
      }
      if (nationalId && !NATIONAL_ID_PATTERN.test(nationalId)) {
        errors.push({ row: row.row, column: 'Số ĐDCN', message: 'Số định danh cá nhân gồm 12 chữ số' });
        continue;
      }
      const hash = nationalId ? this.protection.hash(nationalId) : null;
      const found = applications.find((item) =>
        hash ? item.child_national_id_hash === hash : code !== '' && item.code === code,
      );
      if (!found) {
        errors.push({
          row: row.row,
          column: nationalId ? 'Số ĐDCN' : 'Mã hồ sơ',
          message: 'Không tìm thấy hồ sơ trong đợt',
        });
        continue;
      }
      if (fieldErrors.length === 0) {
        changes.push({ id: found.id, content });
      }
    }
    if (errorFile) {
      return { errorWorkbook: buildErrorWorkbook(body, errors, 1) };
    }
    if (errors.length > 0) {
      return { updated: 0, errors };
    }
    await database.transaction().execute(async (transaction) => {
      for (const change of changes) {
        await transaction
          .updateTable('admission_applications')
          .set({ notice_content: change.content, updated_at: this.clock.now() })
          .where('id', '=', change.id)
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: campaign.org_unit_id,
        entityName: 'admission_campaigns',
        entityId: campaign.id,
        action: 'update',
        before: null,
        after: { imported_notice_contents: changes.length },
      });
    });
    return { updated: changes.length, errors: [] };
  }

  // "Nhập từ Excel học sinh ngoài hệ thống": người nhận không có hồ sơ trong đợt
  async importExternal(
    currentUser: CurrentUser,
    campaignId: string,
    body: Buffer,
    origin: ChangeOrigin,
    errorFile: boolean,
  ): Promise<{ created: number; errors: RowError[] } | { errorWorkbook: Buffer }> {
    const { database, campaign } = await this.campaign(currentUser, campaignId, MANAGE);
    const sheet = await readSheet(body, EXTERNAL_COLUMNS);
    const errors: RowError[] = [];
    const values: Array<{
      campaign_id: string;
      full_name: string;
      dob: string | null;
      gender: 'male' | 'female' | null;
      national_id_encrypted: string | null;
      national_id_last4: string | null;
      phone: string;
      final_year_school: string | null;
      notice_content: string | null;
      created_by: string;
    }> = [];
    for (const row of sheet) {
      const text = (key: string) => (row.values[key] ?? '').trim();
      const fail = (header: string, message: string) => errors.push({ row: row.row, column: header, message });
      const fullName = text('full_name');
      if (!fullName || fullName.length > 100) {
        fail('Họ và tên (*)', 'Bắt buộc nhập, tối đa 100 ký tự');
      }
      const dob = text('dob') ? parseDate(text('dob')) : null;
      if (text('dob') && !dob) {
        fail('Ngày sinh', 'Ngày sinh dạng DD/MM/YYYY');
      }
      const genderText = text('gender').toLocaleLowerCase('vi');
      const gender = genderText === 'nam' ? 'male' : genderText === 'nữ' ? 'female' : null;
      if (genderText && !gender) {
        fail('Giới tính', 'Giới tính là Nam hoặc Nữ');
      }
      const nationalId = text('national_id');
      if (nationalId && !NATIONAL_ID_PATTERN.test(nationalId)) {
        fail('Số ĐDCN', 'Số định danh cá nhân gồm 12 chữ số');
      }
      const phone = text('phone');
      if (!PHONE_PATTERN.test(phone)) {
        fail('Số điện thoại (*)', 'Số điện thoại gồm 10 hoặc 11 chữ số, bắt đầu bằng 0');
      }
      const content = text('notice_content');
      if (content.length > MAXIMUM_CONTENT) {
        fail('Nội dung gửi', `Tối đa ${MAXIMUM_CONTENT} ký tự`);
      }
      if (errors.some((error) => error.row === row.row)) {
        continue;
      }
      values.push({
        campaign_id: campaign.id,
        full_name: fullName,
        dob,
        gender,
        national_id_encrypted: nationalId ? this.protection.encrypt(nationalId) : null,
        national_id_last4: nationalId ? nationalId.slice(-4) : null,
        phone,
        final_year_school: text('final_year_school') || null,
        notice_content: content || null,
        created_by: origin.actorUserId,
      });
    }
    if (errorFile) {
      return { errorWorkbook: buildErrorWorkbook(body, errors, 1) };
    }
    if (errors.length > 0) {
      return { created: 0, errors };
    }
    await database.transaction().execute(async (transaction) => {
      await transaction.insertInto('entry_admission_contacts').values(values).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: campaign.org_unit_id,
        entityName: 'entry_admission_contacts',
        entityId: campaign.id,
        action: 'create',
        before: null,
        after: { created: values.length },
      });
    });
    return { created: values.length, errors: [] };
  }
}
