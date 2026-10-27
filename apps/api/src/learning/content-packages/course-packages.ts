import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ApplicationError, Clock } from '@school-management/server';
import type { CurrentUser } from '../../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../../common/current-school-year.js';
import { Databases } from '../../common/databases.js';
import { FileStorage } from '../../files/file-storage.js';
import { LearningResourcesService } from '../../learning-resources/learning-resources.js';
import { parseTemplateContent, type TemplateContent } from '../learning-template-rules.js';
import { learningRule } from '../learning-rules.js';
import { LearningService } from '../learning.js';
import {
  buildCoursePackage,
  COURSE_PACKAGE_FORMAT,
  MAXIMUM_COURSE_PACKAGE_BYTES,
  readCoursePackage,
  referencedResources,
  remapContent,
  type CoursePackageResource,
} from './course-package-rules.js';
import { ScormPackagesService } from './scorm.js';

// Xuất, nhập khoá học giữa các trường (DT-28 phần 28h, YCTD-278). Xuất: khoá học mẫu người xem thấy được (bản đang soạn với người
// soạn, bản đã duyệt với người khác) kèm học liệu đã công bố mà hoạt động tham chiếu (tệp, liên kết, gói SCORM); học liệu chưa công
// bố, giấy phép bị chặn hoặc không rõ thì không đóng gói (ghi lý do). Nhập: người soạn khoá mẫu nhận gói thành khoá mẫu nháp của
// mình (qua duyệt như khoá tự soạn); học liệu đã có trong kho (cùng mã băm tệp hoặc cùng liên kết) dùng lại, còn lại tạo học liệu
// nháp của người nhập và gửi duyệt theo 22h1; gói SCORM qua cùng bước kiểm, giải nén của `ScormPackagesService`
@Injectable()
export class CoursePackagesService {
  constructor(
    private readonly databases: Databases,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly learning: LearningService,
    private readonly resources: LearningResourcesService,
    private readonly scorm: ScormPackagesService,
    private readonly fileStorage: FileStorage,
    private readonly clock: Clock,
  ) {}

  private get system() {
    return this.databases.system;
  }

  private async schoolName() {
    const { database } = await this.currentSchoolYear.require();
    const unit = await database
      .selectFrom('org_units')
      .select('name')
      .where('unit_type', '=', 'truong_chinh')
      .executeTakeFirst();
    return unit?.name ?? 'Trường';
  }

  // ---------- Xuất

  async exportTemplate(currentUser: CurrentUser, templateId: string) {
    const template = (await this.learning.template(currentUser, templateId)) as unknown as {
      title: string;
      description: string | null;
      school_level: 'TH' | 'THCS' | 'THPT';
      grade_level_code: string | null;
      subject_code: string | null;
      subject_name: string | null;
      content: TemplateContent | null;
    };
    const content = template.content;
    if (!content?.sections) {
      throw learningRule('Khoá mẫu chưa có bản đã duyệt để xuất');
    }
    const ids = referencedResources(content);
    const rows =
      ids.length === 0
        ? []
        : await this.system
            .selectFrom('learning_resources')
            .innerJoin('resource_types', 'resource_types.id', 'learning_resources.type_id')
            .leftJoin('resource_licenses', 'resource_licenses.id', 'learning_resources.license_id')
            .leftJoin('learning_resource_versions', (join) =>
              join
                .onRef('learning_resource_versions.resource_id', '=', 'learning_resources.id')
                .onRef('learning_resource_versions.version_no', '=', 'learning_resources.published_version'),
            )
            .select([
              'learning_resources.id',
              'learning_resources.title',
              'learning_resources.description',
              'learning_resources.school_level',
              'learning_resources.grade_level_code',
              'learning_resources.subject_code',
              'learning_resources.subject_name',
              'learning_resources.keywords',
              'learning_resources.author_name',
              'learning_resources.language',
              'learning_resources.duration_minutes',
              'learning_resources.license_source',
              'learning_resources.origin',
              'learning_resources.status',
              'learning_resources.published_version',
              'resource_types.code as type_code',
              'resource_licenses.code as license_code',
              'resource_licenses.blocked',
              'resource_licenses.private_only',
              'learning_resource_versions.kind',
              'learning_resource_versions.storage_key',
              'learning_resource_versions.file_name',
              'learning_resource_versions.content_type',
              'learning_resource_versions.sha256',
              'learning_resource_versions.url',
              'learning_resource_versions.link_title',
            ])
            .where('learning_resources.id', 'in', ids)
            .execute();
    const resources: CoursePackageResource[] = [];
    const skipped: Array<{ title: string; reason: string }> = [];
    let size = 0;
    for (const row of rows) {
      const reason =
        row.published_version === null || row.status === 'hidden' || row.status === 'retired'
          ? 'Chưa công bố hoặc đang ẩn, ngừng dùng'
          : !row.license_code
            ? 'Thiếu giấy phép'
            : row.blocked || row.private_only
              ? 'Giấy phép bị chặn hoặc không rõ'
              : row.kind !== 'file' && row.kind !== 'link'
                ? 'Kế hoạch bài dạy tham chiếu không đóng gói được'
                : null;
      if (reason) {
        skipped.push({ title: row.title, reason });
        continue;
      }
      let data: string | null = null;
      if (row.kind === 'file' && row.storage_key) {
        const body = await this.fileStorage.get(row.storage_key);
        size += body.length;
        if (size > MAXIMUM_COURSE_PACKAGE_BYTES) {
          throw learningRule('Gói khoá học vượt 300 MB; hãy tách khoá nhỏ hơn');
        }
        data = body.toString('base64');
      }
      resources.push({
        ref: row.id,
        scorm: row.type_code === 'scorm',
        title: row.title,
        description: row.description,
        type_code: row.type_code,
        school_level: row.school_level,
        grade_level_code: row.grade_level_code,
        subject_code: row.subject_code,
        subject_name: row.subject_name,
        keywords: row.keywords,
        author_name: row.author_name,
        language: row.language,
        duration_minutes: row.duration_minutes,
        license_code: row.license_code as string,
        license_source: row.license_source,
        origin: row.origin,
        kind: row.kind as 'file' | 'link',
        file_name: row.file_name,
        content_type: row.content_type,
        sha256: row.sha256,
        data,
        url: row.url,
        link_title: row.link_title,
      });
    }
    const code = `KHOA-${randomUUID().slice(0, 8).toUpperCase()}`;
    const sourceSchool = await this.schoolName();
    const buffer = buildCoursePackage({
      format: COURSE_PACKAGE_FORMAT,
      package_code: code,
      source_school: sourceSchool,
      created_at: this.clock.now().toISOString(),
      template: {
        title: template.title,
        description: template.description,
        school_level: template.school_level,
        grade_level_code: template.grade_level_code,
        subject_code: template.subject_code,
        subject_name: template.subject_name,
        content,
      },
      resources,
    });
    await this.system
      .insertInto('course_package_transfers')
      .values({
        direction: 'export',
        package_code: code,
        source_school: sourceSchool,
        template_id: templateId,
        template_title: template.title,
        resource_count: resources.length,
        skipped: JSON.stringify(skipped),
        actor_user_id: currentUser.id,
        actor_name: currentUser.description.full_name,
      })
      .execute();
    return { buffer, fileName: `${code.toLowerCase()}.khoahoc.gz`, code, skipped };
  }

  // ---------- Nhập

  async importPackage(currentUser: CurrentUser, body: Buffer | undefined) {
    const context = await this.learning.context(currentUser);
    if (!context.canTemplate) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền soạn khoá học mẫu');
    }
    if (!body || body.length === 0) {
      throw learningRule('Chọn tệp gói khoá học', [{ field: 'file', message: 'Chọn tệp' }]);
    }
    const { manifest, problems } = readCoursePackage(body);
    const [types, licenses] = await Promise.all([
      this.system.selectFrom('resource_types').select(['id', 'code', 'status']).execute(),
      this.system.selectFrom('resource_licenses').select(['id', 'code', 'blocked', 'private_only', 'status']).execute(),
    ]);
    const { database } = await this.currentSchoolYear.require();
    const subjects = await database.selectFrom('subjects').select(['id', 'code']).execute();
    const other = types.find((type) => type.code === 'other');
    const mapping = new Map<string, string>();
    const skipped: Array<{ title: string; reason: string }> = [];
    let created = 0;
    for (const item of manifest.resources) {
      const problem = problems.get(item.ref);
      if (problem) {
        skipped.push({ title: String(item.title ?? item.ref), reason: problem });
        continue;
      }
      const license = licenses.find((row) => row.code === item.license_code && row.status === 'active');
      if (!license || license.blocked || license.private_only) {
        skipped.push({
          title: item.title,
          reason: 'Giấy phép không có trong danh mục của trường, bị chặn hoặc không rõ',
        });
        continue;
      }
      const duplicate =
        item.kind === 'file'
          ? await this.system
              .selectFrom('learning_resource_versions')
              .innerJoin('learning_resources', 'learning_resources.id', 'learning_resource_versions.resource_id')
              .select('learning_resources.id')
              .where('learning_resource_versions.sha256', '=', item.sha256 as string)
              .where('learning_resources.status', 'not in', ['retired'])
              .executeTakeFirst()
          : await this.system
              .selectFrom('learning_resource_versions')
              .innerJoin('learning_resources', 'learning_resources.id', 'learning_resource_versions.resource_id')
              .select('learning_resources.id')
              .where('learning_resource_versions.url', '=', item.url as string)
              .where('learning_resources.status', 'not in', ['retired'])
              .executeTakeFirst();
      if (duplicate) {
        mapping.set(item.ref, duplicate.id);
        continue;
      }
      const type = item.scorm
        ? types.find((row) => row.code === 'scorm')
        : (types.find((row) => row.code === item.type_code && row.status === 'active') ?? other);
      try {
        const resource = await this.resources.create(currentUser, {
          title: item.title.slice(0, 300),
          description: item.description ?? null,
          type_id: type?.id as string,
          school_level: ['MN', 'TH', 'THCS', 'THPT'].includes(item.school_level ?? '') ? item.school_level : null,
          grade_level_code: item.grade_level_code ?? null,
          subject_code: subjects.some((row) => row.code === item.subject_code) ? item.subject_code : null,
          topic_id: null,
          week_no: null,
          keywords: Array.isArray(item.keywords) ? item.keywords.slice(0, 20) : [],
          author_name: item.author_name ?? null,
          language: item.language || 'vi',
          duration_minutes: item.duration_minutes ?? null,
          license_id: license.id,
          license_source: item.license_source ?? null,
          origin:
            `Gói khoá học ${manifest.package_code} của ${manifest.source_school}${item.origin ? `; ${item.origin}` : ''}`.slice(
              0,
              1000,
            ),
          responsible_name: context.name,
          license_expires_on: null,
          visibility: 'school',
        });
        if (item.scorm) {
          const zip = Buffer.from(item.data as string, 'base64');
          await this.scorm.upload(currentUser, resource.id, {
            fieldname: 'file',
            originalname: Buffer.from(item.file_name ?? 'goi-scorm.zip', 'utf8').toString('latin1'),
            encoding: '7bit',
            mimetype: 'application/zip',
            size: zip.length,
            buffer: zip,
          } as never);
        } else if (item.kind === 'file') {
          await this.resources.addFile(currentUser, resource.id, {
            fileName: item.file_name as string,
            body: Buffer.from(item.data as string, 'base64'),
          });
        } else {
          await this.resources.addLink(currentUser, resource.id, { url: item.url, link_title: item.link_title });
        }
        await this.resources.submit(currentUser, resource.id);
        mapping.set(item.ref, resource.id);
        created += 1;
      } catch (error) {
        skipped.push({ title: item.title, reason: error instanceof Error ? error.message : 'Không nhập được' });
      }
    }
    const remapped = remapContent(manifest.template.content, mapping);
    skipped.push(...remapped.dropped);
    const errors: Array<{ field: string; message: string }> = [];
    const content = parseTemplateContent(remapped.content, errors);
    if (errors.length > 0) {
      throw learningRule(
        `Nội dung khoá học trong gói không hợp lệ: ${errors.map((error) => error.message).join('; ')}`,
      );
    }
    const subject = subjects.find((row) => row.code === manifest.template.subject_code);
    const template = (await this.learning.createTemplate(currentUser, {
      title: manifest.template.title.slice(0, 300),
      description: manifest.template.description?.slice(0, 2000) ?? null,
      school_level: manifest.template.school_level,
      grade_level_code: manifest.template.grade_level_code,
      ...(subject ? { subject_id: subject.id } : {}),
      content,
    })) as { id: string; title: string };
    await this.system
      .insertInto('course_package_transfers')
      .values({
        direction: 'import',
        package_code: manifest.package_code,
        source_school: manifest.source_school,
        template_id: template.id,
        template_title: template.title,
        resource_count: created,
        skipped: JSON.stringify(skipped),
        actor_user_id: currentUser.id,
        actor_name: currentUser.description.full_name,
      })
      .execute();
    return {
      template_id: template.id,
      title: template.title,
      created_resources: created,
      reused: mapping.size - created,
      skipped,
    };
  }

  async transfers(currentUser: CurrentUser) {
    const context = await this.learning.context(currentUser);
    if (!context.canTemplate && !context.canApprove) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem nhật ký gói khoá học');
    }
    return this.system
      .selectFrom('course_package_transfers')
      .selectAll()
      .orderBy('created_at', 'desc')
      .limit(100)
      .execute();
  }
}
