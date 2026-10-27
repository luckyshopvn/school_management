import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock } from '@school-management/server';
import type { Kysely, Selectable, Transaction } from 'kysely';
import type { CurrentUser } from '../../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../../common/current-school-year.js';
import { notFoundError, type RequestBody } from '../../common/request-fields.js';
import { LearningService } from '../learning.js';
import { buildCertificatePdf } from './certificate-pdf.js';
import {
  abbreviateName,
  certificateCode,
  configOf,
  courseCompleted,
  earnedBadges,
  normalizeCode,
  parseConfig,
  recognitionRule,
  verificationPage,
  type SectionProgress,
} from './recognition-rules.js';

// Huy hiệu và chứng nhận hoàn thành (DT-28 phần 28i, YCTD-279; tài liệu 32 mục 20.7; GD-155: tắt mặc định, không bảng xếp hạng,
// chứng nhận chỉ cho khoá tự chọn). Huy hiệu tự động tính khi học sinh, phụ huynh, giáo viên mở danh sách (ghi một lần mỗi tiêu
// chí); giáo viên của lớp học trực tuyến trao, thu hồi huy hiệu kèm lý do; giáo viên của khoá tự chọn cấp, thu hồi chứng nhận cho học
// sinh đã hoàn thành khoá. Trang kiểm tra công khai của trường tra theo mã. Quyền lớp học trực tuyến qua cửa của lõi 28b
type YearExecutor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;
type SpaceRow = Selectable<SchoolYearDatabase['course_spaces']>;
type BadgeRow = Selectable<SchoolYearDatabase['learning_badges']>;
type CertificateRow = Selectable<SchoolYearDatabase['course_certificates']>;
const CONFIG_KEY = 'learning_recognition';

const presentBadge = (row: BadgeRow) => ({
  id: row.id,
  space_id: row.space_id,
  kind: row.kind,
  title: row.title,
  reason: row.reason,
  awarded_by_name: row.awarded_by_name,
  awarded_at: row.awarded_at,
});

const presentCertificate = (row: CertificateRow) => ({
  id: row.id,
  code: row.code,
  space_id: row.space_id,
  course_title: row.course_title,
  holder_name: row.holder_name,
  issued_at: row.issued_at,
  issued_by_name: row.issued_by_name,
  revoked_at: row.revoked_at,
  revoke_reason: row.revoke_reason,
});

@Injectable()
export class RecognitionService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly learning: LearningService,
    private readonly clock: Clock,
  ) {}

  // ---------- Cấu hình của trường

  private async readConfig(database: YearExecutor) {
    const row = await database
      .selectFrom('settings')
      .innerJoin('org_units', 'org_units.id', 'settings.org_unit_id')
      .select('settings.value')
      .where('org_units.unit_type', '=', 'truong_chinh')
      .where('settings.key', '=', CONFIG_KEY)
      .executeTakeFirst();
    return configOf(row?.value);
  }

  private async assertLeadership(currentUser: CurrentUser) {
    const context = await this.learning.context(currentUser);
    if (!(context.canDecide || (context.canView && context.canApprove))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ Ban Giám hiệu bật, tắt huy hiệu và chứng nhận');
    }
  }

  async config(currentUser: CurrentUser) {
    await this.assertLeadership(currentUser);
    const { database } = await this.currentSchoolYear.require();
    return this.readConfig(database);
  }

  async saveConfig(currentUser: CurrentUser, body: RequestBody) {
    await this.assertLeadership(currentUser);
    const config = parseConfig(body);
    const { database } = await this.currentSchoolYear.require();
    const unit = await database
      .selectFrom('org_units')
      .select('id')
      .where('unit_type', '=', 'truong_chinh')
      .executeTakeFirst();
    if (!unit) {
      throw recognitionRule('Chưa có Trường chính để lưu cấu hình');
    }
    await database
      .insertInto('settings')
      .values({ org_unit_id: unit.id, key: CONFIG_KEY, value_type: 'text', value: JSON.stringify(config) })
      .onConflict((conflict) => conflict.columns(['org_unit_id', 'key']).doUpdateSet({ value: JSON.stringify(config) }))
      .execute();
    return config;
  }

  private async schoolName(database: YearExecutor) {
    const unit = await database
      .selectFrom('org_units')
      .select('name')
      .where('unit_type', '=', 'truong_chinh')
      .executeTakeFirst();
    return unit?.name ?? 'Trường';
  }

  // ---------- Tiến độ của một em

  private async sectionsOf(database: YearExecutor, childId: string): Promise<Map<string, SectionProgress[]>> {
    const learning = await this.learning.learningOfChild(database, childId);
    return new Map(
      learning.spaces.map((space) => [
        space.id,
        space.sections.map((section) => ({
          id: section.id,
          title: section.title,
          activities: section.activities.map((activity) => ({ required: activity.required, status: activity.status })),
        })),
      ]),
    );
  }

  // Bài nộp (không tính bản nháp) của em theo lớp học trực tuyến: bài cá nhân của em, bài nhóm của nhóm em
  private async submissionsOf(database: YearExecutor, childId: string) {
    const rows = await database
      .selectFrom('assignment_recipients')
      .innerJoin('assignments', 'assignments.id', 'assignment_recipients.assignment_id')
      .innerJoin('course_activities', 'course_activities.id', 'assignments.activity_id')
      .innerJoin('assignment_submissions', (join) =>
        join.onRef('assignment_submissions.assignment_id', '=', 'assignments.id'),
      )
      .select([
        'course_activities.space_id',
        'assignment_submissions.child_id',
        'assignment_submissions.group_id',
        'assignment_recipients.group_id as recipient_group_id',
        'assignment_submissions.late',
        'assignment_submissions.submitted_at',
        'assignment_submissions.status',
      ])
      .where('assignment_recipients.child_id', '=', childId)
      .where('assignment_submissions.status', '<>', 'draft')
      .execute();
    const bySpace = new Map<string, Array<{ late: boolean; submitted_at: Date }>>();
    for (const row of rows) {
      const own = row.recipient_group_id ? row.group_id === row.recipient_group_id : row.child_id === childId;
      if (!own || !row.submitted_at) continue;
      const list = bySpace.get(row.space_id) ?? [];
      list.push({ late: row.late, submitted_at: row.submitted_at });
      bySpace.set(row.space_id, list);
    }
    return bySpace;
  }

  // Ghi huy hiệu tự động em đã đạt (mỗi tiêu chí một lần, kể cả đã bị thu hồi thì không trao lại)
  private async evaluate(database: YearExecutor, childId: string, spaceIds: string[] | null) {
    const [sections, submissions] = await Promise.all([
      this.sectionsOf(database, childId),
      this.submissionsOf(database, childId),
    ]);
    for (const [spaceId, spaceSections] of sections) {
      if (spaceIds && !spaceIds.includes(spaceId)) continue;
      const earned = earnedBadges(spaceSections, submissions.get(spaceId) ?? []);
      if (earned.length === 0) continue;
      await database
        .insertInto('learning_badges')
        .values(
          earned.map((badge) => ({
            child_id: childId,
            space_id: spaceId,
            kind: badge.kind,
            section_id: badge.section_id,
            criterion_key: badge.criterion_key,
            title: badge.title,
          })),
        )
        .onConflict((conflict) =>
          conflict
            .columns(['child_id', 'space_id', 'criterion_key'])
            .where('criterion_key', 'is not', null)
            .doNothing(),
        )
        .execute();
    }
    return sections;
  }

  private async recognitionOf(database: YearExecutor, childId: string) {
    const config = await this.readConfig(database);
    if (config.badges_enabled) {
      await this.evaluate(database, childId, null);
    }
    const [badges, certificates, spaces] = await Promise.all([
      config.badges_enabled
        ? database
            .selectFrom('learning_badges')
            .selectAll()
            .where('child_id', '=', childId)
            .where('revoked_at', 'is', null)
            .orderBy('awarded_at', 'desc')
            .execute()
        : Promise.resolve([]),
      config.certificates_enabled
        ? database
            .selectFrom('course_certificates')
            .selectAll()
            .where('child_id', '=', childId)
            .where('revoked_at', 'is', null)
            .orderBy('issued_at', 'desc')
            .execute()
        : Promise.resolve([]),
      database.selectFrom('course_spaces').select(['id', 'title']).execute(),
    ]);
    const titleOf = new Map(spaces.map((space) => [space.id, space.title]));
    return {
      badges_enabled: config.badges_enabled,
      certificates_enabled: config.certificates_enabled,
      badges: badges.map((row) => ({ ...presentBadge(row), space_title: titleOf.get(row.space_id) ?? null })),
      certificates: certificates.map(presentCertificate),
    };
  }

  async studentRecognition(currentUser: CurrentUser) {
    const { database, childId } = await this.learning.studentContext(currentUser);
    return this.recognitionOf(database, childId);
  }

  async childRecognition(currentUser: CurrentUser, childId: string) {
    const { database } = await this.currentSchoolYear.require();
    await this.learning.guardianOrStaff(currentUser, database, childId);
    return this.recognitionOf(database, childId);
  }

  // ---------- Giáo viên của lớp học trực tuyến

  private async teaching(currentUser: CurrentUser, spaceId: string) {
    const access = await this.learning.spaceAccess(currentUser, spaceId);
    if (!access.canTeach) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ giáo viên của lớp học trực tuyến trao huy hiệu, cấp chứng nhận');
    }
    return access;
  }

  private async studentOf(database: YearExecutor, space: SpaceRow, childId: unknown) {
    const students = await this.learning.students(database, space);
    const student = students.find((item) => item.id === childId);
    if (!student) {
      throw notFoundError('Học sinh không học lớp học trực tuyến này', 'child');
    }
    return student;
  }

  // Huy hiệu, chứng nhận của từng học sinh (xếp theo tên, không đếm hay xếp hạng); khoá tự chọn có cột hoàn thành và chứng nhận
  async spaceRecognition(currentUser: CurrentUser, spaceId: string) {
    const { database, space, canTeach } = await this.learning.spaceAccess(currentUser, spaceId);
    const config = await this.readConfig(database);
    const students = await this.learning.students(database, space);
    const rows = [];
    for (const student of students) {
      const sections =
        config.badges_enabled || config.certificates_enabled
          ? (
              await (config.badges_enabled
                ? this.evaluate(database, student.id, [space.id])
                : this.sectionsOf(database, student.id))
            ).get(space.id)
          : undefined;
      rows.push({ child_id: student.id, full_name: student.full_name, completed: courseCompleted(sections ?? []) });
    }
    const childIds = students.map((student) => student.id);
    const [badges, certificates] = await Promise.all([
      childIds.length > 0 && config.badges_enabled
        ? database
            .selectFrom('learning_badges')
            .selectAll()
            .where('space_id', '=', space.id)
            .where('child_id', 'in', childIds)
            .where('revoked_at', 'is', null)
            .orderBy('awarded_at')
            .execute()
        : Promise.resolve([]),
      childIds.length > 0 && config.certificates_enabled
        ? database
            .selectFrom('course_certificates')
            .selectAll()
            .where('space_id', '=', space.id)
            .where('child_id', 'in', childIds)
            .where('revoked_at', 'is', null)
            .execute()
        : Promise.resolve([]),
    ]);
    return {
      badges_enabled: config.badges_enabled,
      certificates_enabled: config.certificates_enabled && space.kind === 'elective',
      can_teach: canTeach,
      students: rows
        .sort((left, right) => left.full_name.localeCompare(right.full_name, 'vi'))
        .map((row) => ({
          ...row,
          badges: badges.filter((badge) => badge.child_id === row.child_id).map(presentBadge),
          certificate: certificates.find((item) => item.child_id === row.child_id)
            ? presentCertificate(certificates.find((item) => item.child_id === row.child_id) as CertificateRow)
            : null,
        })),
    };
  }

  async award(currentUser: CurrentUser, spaceId: string, body: RequestBody) {
    const { context, database, space } = await this.teaching(currentUser, spaceId);
    if (!(await this.readConfig(database)).badges_enabled) {
      throw recognitionRule('Trường chưa bật huy hiệu');
    }
    const student = await this.studentOf(database, space, body?.child_id);
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    if (title === '' || title.length > 120 || reason === '' || reason.length > 500) {
      throw recognitionRule('Huy hiệu cần tên (tối đa 120 ký tự) và lý do (tối đa 500 ký tự)', [
        ...(title === '' || title.length > 120 ? [{ field: 'title', message: 'Từ 1 đến 120 ký tự' }] : []),
        ...(reason === '' || reason.length > 500 ? [{ field: 'reason', message: 'Từ 1 đến 500 ký tự' }] : []),
      ]);
    }
    const row = await database
      .insertInto('learning_badges')
      .values({
        child_id: student.id,
        space_id: space.id,
        kind: 'teacher_award',
        title,
        reason,
        awarded_by: context.userId,
        awarded_by_name: context.name,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return presentBadge(row);
  }

  async revokeBadge(currentUser: CurrentUser, badgeId: string, body: RequestBody) {
    const { database } = await this.currentSchoolYear.require();
    const badge = await database.selectFrom('learning_badges').selectAll().where('id', '=', badgeId).executeTakeFirst();
    if (!badge || badge.revoked_at) {
      throw notFoundError('Không tìm thấy huy hiệu', 'learning_badge');
    }
    const { context } = await this.teaching(currentUser, badge.space_id);
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    if (reason === '' || reason.length > 500) {
      throw recognitionRule('Ghi lý do thu hồi, tối đa 500 ký tự', [
        { field: 'reason', message: 'Từ 1 đến 500 ký tự' },
      ]);
    }
    await database
      .updateTable('learning_badges')
      .set({ revoked_at: this.clock.now(), revoked_by: context.userId, revoke_reason: reason })
      .where('id', '=', badgeId)
      .execute();
    return { id: badgeId, revoked: true };
  }

  // ---------- Chứng nhận

  async issueCertificate(currentUser: CurrentUser, spaceId: string, body: RequestBody) {
    const { context, database, space } = await this.teaching(currentUser, spaceId);
    if (!(await this.readConfig(database)).certificates_enabled) {
      throw recognitionRule('Trường chưa bật chứng nhận hoàn thành');
    }
    if (space.kind !== 'elective') {
      throw recognitionRule('Chứng nhận chỉ cấp cho khoá tự chọn');
    }
    const student = await this.studentOf(database, space, body?.child_id);
    const sections = (await this.sectionsOf(database, student.id)).get(space.id) ?? [];
    if (!courseCompleted(sections)) {
      throw recognitionRule('Học sinh chưa hoàn thành mọi hoạt động bắt buộc của khoá');
    }
    const existing = await database
      .selectFrom('course_certificates')
      .select('id')
      .where('child_id', '=', student.id)
      .where('space_id', '=', space.id)
      .where('revoked_at', 'is', null)
      .executeTakeFirst();
    if (existing) {
      throw new ApplicationError('ERR_CONFLICT', 'Học sinh đã có chứng nhận còn hiệu lực của khoá này');
    }
    const schoolName = await this.schoolName(database);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const row = await database
        .insertInto('course_certificates')
        .values({
          code: certificateCode(),
          child_id: student.id,
          space_id: space.id,
          course_title: space.title,
          school_name: schoolName,
          holder_name: student.full_name,
          holder_short_name: abbreviateName(student.full_name),
          issued_by: context.userId,
          issued_by_name: context.name,
        })
        .onConflict((conflict) => conflict.column('code').doNothing())
        .returningAll()
        .executeTakeFirst();
      if (row) return presentCertificate(row);
    }
    throw new ApplicationError('ERR_CONFLICT', 'Không sinh được mã chứng nhận, thử lại');
  }

  async revokeCertificate(currentUser: CurrentUser, certificateId: string, body: RequestBody) {
    const { database } = await this.currentSchoolYear.require();
    const certificate = await database
      .selectFrom('course_certificates')
      .selectAll()
      .where('id', '=', certificateId)
      .executeTakeFirst();
    if (!certificate || certificate.revoked_at) {
      throw notFoundError('Không tìm thấy chứng nhận còn hiệu lực', 'course_certificate');
    }
    const { context } = await this.teaching(currentUser, certificate.space_id);
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    if (reason === '' || reason.length > 500) {
      throw recognitionRule('Ghi lý do thu hồi, tối đa 500 ký tự', [
        { field: 'reason', message: 'Từ 1 đến 500 ký tự' },
      ]);
    }
    await database
      .updateTable('course_certificates')
      .set({ revoked_at: this.clock.now(), revoked_by: context.userId, revoke_reason: reason })
      .where('id', '=', certificateId)
      .execute();
    return { id: certificateId, revoked: true };
  }

  private async pdfOf(database: YearExecutor, certificate: CertificateRow, origin: string) {
    if (certificate.revoked_at) {
      throw recognitionRule('Chứng nhận đã bị thu hồi');
    }
    const config = await this.readConfig(database);
    return {
      fileName: `chung-nhan-${certificate.code.toLowerCase()}.pdf`,
      body: await buildCertificatePdf({
        certificate,
        template: config.certificate,
        verifyUrl: `${origin}/api/v1/public/certificates/${certificate.code}`,
      }),
    };
  }

  private async certificate(database: YearExecutor, certificateId: string) {
    const row = await database
      .selectFrom('course_certificates')
      .selectAll()
      .where('id', '=', certificateId)
      .executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy chứng nhận', 'course_certificate');
    }
    return row;
  }

  // Tệp PDF cho giáo viên xem được lớp, phụ huynh của em, chính học sinh
  async staffOrGuardianPdf(currentUser: CurrentUser, certificateId: string, origin: string) {
    const { database } = await this.currentSchoolYear.require();
    const row = await this.certificate(database, certificateId);
    const guardian = await this.learning.guardianOrStaff(currentUser, database, row.child_id).catch(() => null);
    if (guardian === null) {
      await this.learning.spaceAccess(currentUser, row.space_id);
    }
    return this.pdfOf(database, row, origin);
  }

  async studentPdf(currentUser: CurrentUser, certificateId: string, origin: string) {
    const { database, childId } = await this.learning.studentContext(currentUser);
    const row = await this.certificate(database, certificateId);
    if (row.child_id !== childId) {
      throw notFoundError('Không tìm thấy chứng nhận', 'course_certificate');
    }
    return this.pdfOf(database, row, origin);
  }

  // Trang kiểm tra công khai (theo tên miền của trường): mã sai dạng hay không có thì báo không tìm thấy
  async verify(codeValue: unknown) {
    const code = normalizeCode(codeValue);
    const current = await this.currentSchoolYear.find();
    const row =
      code && current
        ? await current.database
            .selectFrom('course_certificates')
            .select(['course_title', 'school_name', 'holder_short_name', 'issued_at', 'revoked_at'])
            .where('code', '=', code)
            .executeTakeFirst()
        : undefined;
    return { found: Boolean(row), html: verificationPage(code ?? String(codeValue ?? '').slice(0, 20), row ?? null) };
  }
}
