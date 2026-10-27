import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { SchoolYearDatabase, ScormStandard } from '@school-management/database';
import { Clock, currentTenant } from '@school-management/server';
import type { Kysely, Transaction } from 'kysely';
import { decodeFileName, type UploadedPart } from '../../activities/content-files.js';
import type { CurrentUser } from '../../authentication/current-user.js';
import { API_CONFIGURATION, type ApiConfiguration } from '../../common/configuration.js';
import { CurrentSchoolYearResolver } from '../../common/current-school-year.js';
import { Databases } from '../../common/databases.js';
import { notFoundError, type RequestBody } from '../../common/request-fields.js';
import { storageKey } from '../../common/resource-names.js';
import { FileStorage } from '../../files/file-storage.js';
import { LearningResourcesService } from '../../learning-resources/learning-resources.js';
import type { CompletionRule } from '../learning-rules.js';
import { LearningService } from '../learning.js';
import {
  activityResult,
  contentSecurityPolicy,
  contentTypeOf,
  initialValues,
  injectShim,
  LAUNCH_TOKEN_SECONDS,
  normalizeCommit,
  readScormPackage,
  safeEntryPath,
  scormRule,
  shimScript,
  signLaunch,
  verifyLaunch,
  type AttemptState,
  type LaunchClaims,
  type ScormSco,
} from './scorm-rules.js';

// Gói SCORM (DT-28 phần 28h, YCTD-278; tài liệu 32 mục 20.7). Gói là học liệu loại `scorm` của kho 22h1: tệp zip là một phiên bản
// của học liệu (qua `LearningResourcesService.addTypedFileVersion`, duyệt như mọi học liệu), tệp đã giải nén lưu ở kho tệp theo
// `storageKey('scorm', gói, số thứ tự)`. Hoạt động loại `scorm` của lõi 28b trỏ tới học liệu đã công bố; học sinh mở bài nhận mã
// truy cập ngắn hạn (trường, gói, hoạt động, học sinh, nguồn gốc trang cha, hạn) ký HMAC; tệp của gói phục vụ ở
// `/api/v1/scorm-content/<mã>/<đường dẫn>` với CSP `sandbox allow-scripts` (nguồn gốc riêng, không đọc được phiên, cookie của
// ứng dụng), chỉ nạp từ chính gói. Trang SCO được gắn bộ chuyển API; trang cha nhận `postMessage` rồi gửi lên tuyến ghi kết quả
type YearExecutor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;
type PackageFiles = Record<string, { key: string; type: string; size: number }>;

interface PackageRow {
  id: string;
  resource_id: string;
  version_id: string;
  standard: ScormStandard;
  title: string;
  scos: ScormSco[];
  files: PackageFiles;
}

const numberOrNull = (value: string | null) => (value === null ? null : Number(value));
const SINGLE_SCHOOL = 'single';

export interface ServedFile {
  body: Buffer;
  contentType: string;
  headers: Record<string, string>;
}

@Injectable()
export class ScormPackagesService {
  constructor(
    private readonly databases: Databases,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly learning: LearningService,
    private readonly resources: LearningResourcesService,
    private readonly fileStorage: FileStorage,
    private readonly clock: Clock,
    @Inject(API_CONFIGURATION) private readonly configuration: ApiConfiguration,
  ) {}

  private get system() {
    return this.databases.system;
  }

  private signingKey() {
    return createHash('sha256').update('scorm-launch').update(this.configuration.childDataHashKey).digest();
  }

  private schoolId() {
    return currentTenant()?.schoolId ?? SINGLE_SCHOOL;
  }

  private rowOf(row: {
    id: string;
    resource_id: string;
    version_id: string;
    standard: ScormStandard;
    title: string;
    scos: unknown;
    files: unknown;
  }): PackageRow {
    return { ...row, scos: row.scos as ScormSco[], files: row.files as PackageFiles };
  }

  // ---------- Nhập gói

  // Kiểm và giải nén gói trước khi lưu: bản kê, chuẩn, SCO, đường dẫn, loại tệp, cỡ; hợp lệ thì lưu zip làm phiên bản mới của
  // học liệu (người soạn, học liệu còn sửa được) rồi lưu từng tệp đã giải nén
  async upload(currentUser: CurrentUser, resourceId: string, part: UploadedPart | undefined) {
    if (!part || part.size === 0) {
      throw scormRule('Chọn tệp zip của gói SCORM', [{ field: 'file', message: 'Chọn tệp' }]);
    }
    const { manifest, entries } = readScormPackage(part.buffer);
    const version = await this.resources.addTypedFileVersion(
      currentUser,
      resourceId,
      {
        fileName: decodeFileName(part),
        body: part.buffer,
        contentType: 'application/zip',
        storageKey: storageKey('learning-resources', resourceId, randomUUID()),
      },
      'scorm',
    );
    const packageId = randomUUID();
    const files: PackageFiles = {};
    let index = 0;
    let total = 0;
    try {
      for (const [path, body] of entries) {
        index += 1;
        const key = storageKey('scorm', packageId, String(index));
        const type = contentTypeOf(path) as string;
        await this.fileStorage.put(key, body, type);
        files[path] = { key, type, size: body.length };
        total += body.length;
      }
      const row = await this.system
        .insertInto('scorm_packages')
        .values({
          id: packageId,
          resource_id: resourceId,
          version_id: version.id,
          standard: manifest.standard,
          title: manifest.title,
          scos: JSON.stringify(manifest.scos),
          files: JSON.stringify(files),
          file_count: entries.size,
          total_bytes: total,
          created_by: currentUser.id,
        })
        .returning(['id', 'standard', 'title', 'scos', 'file_count', 'total_bytes'])
        .executeTakeFirstOrThrow();
      return { ...row, version_no: version.version_no, total_bytes: Number(row.total_bytes) };
    } catch (error) {
      await this.fileStorage.deletePrefix(storageKey('scorm', packageId)).catch(() => undefined);
      throw error;
    }
  }

  // Gói của các phiên bản học liệu mà người xem thấy được (kiểm qua `detail` của 22h1)
  async packagesOfResource(currentUser: CurrentUser, resourceId: string) {
    const detail = (await this.resources.detail(currentUser, resourceId)) as {
      versions: Array<{ id: string; version_no: number }>;
    };
    const versionIds = detail.versions.map((version) => version.id);
    if (versionIds.length === 0) return [];
    const rows = await this.system
      .selectFrom('scorm_packages')
      .select(['id', 'version_id', 'standard', 'title', 'scos', 'file_count', 'total_bytes', 'created_at'])
      .where('version_id', 'in', versionIds)
      .execute();
    return rows.map((row) => ({
      ...row,
      total_bytes: Number(row.total_bytes),
      version_no: detail.versions.find((version) => version.id === row.version_id)?.version_no ?? null,
    }));
  }

  // Gói của bản đã công bố của học liệu (học liệu hoạt động dùng)
  async publishedPackage(resourceId: string): Promise<PackageRow | null> {
    const row = await this.system
      .selectFrom('learning_resources')
      .innerJoin('learning_resource_versions', (join) =>
        join
          .onRef('learning_resource_versions.resource_id', '=', 'learning_resources.id')
          .onRef('learning_resource_versions.version_no', '=', 'learning_resources.published_version'),
      )
      .innerJoin('scorm_packages', 'scorm_packages.version_id', 'learning_resource_versions.id')
      .select([
        'scorm_packages.id',
        'scorm_packages.resource_id',
        'scorm_packages.version_id',
        'scorm_packages.standard',
        'scorm_packages.title',
        'scorm_packages.scos',
        'scorm_packages.files',
        'learning_resources.status',
      ])
      .where('learning_resources.id', '=', resourceId)
      .executeTakeFirst();
    if (!row || row.status === 'hidden' || row.status === 'retired') return null;
    return this.rowOf(row);
  }

  private async packageById(id: string): Promise<PackageRow | null> {
    const row = await this.system
      .selectFrom('scorm_packages')
      .select(['id', 'resource_id', 'version_id', 'standard', 'title', 'scos', 'files'])
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? this.rowOf(row) : null;
  }

  // ---------- Mở bài

  private launchUrl(token: string) {
    const base = this.configuration.scormContentOrigin ?? '';
    return `${base}/api/v1/scorm-content/${token}/`;
  }

  private present(
    pkg: PackageRow,
    token: string,
    attempts: Array<{ sco_identifier: string; completion: string; success: string; score: string | null }>,
  ) {
    return {
      package_id: pkg.id,
      standard: pkg.standard,
      title: pkg.title,
      content_origin: this.configuration.scormContentOrigin ?? null,
      expires_in: LAUNCH_TOKEN_SECONDS,
      scos: pkg.scos.map((sco) => {
        const attempt = attempts.find((row) => row.sco_identifier === sco.identifier);
        return {
          identifier: sco.identifier,
          title: sco.title,
          url: `${this.launchUrl(token)}${sco.href}`,
          completion: attempt?.completion ?? 'not_attempted',
          success: attempt?.success ?? 'unknown',
          score: numberOrNull(attempt?.score ?? null),
        };
      }),
    };
  }

  private claims(
    pkg: PackageRow,
    activityId: string | null,
    childId: string | null,
    origin: string | undefined,
  ): LaunchClaims {
    if (!origin || !/^https?:\/\/[^/]+$/.test(origin)) {
      throw scormRule('Không xác định được trang mở bài (thiếu nguồn gốc)');
    }
    return {
      s: this.schoolId(),
      p: pkg.id,
      a: activityId,
      c: childId,
      o: origin,
      e: Math.floor(this.clock.now().getTime() / 1000) + LAUNCH_TOKEN_SECONDS,
    };
  }

  // Học sinh mở hoạt động loại `scorm` đã giao, đang mở; mã truy cập theo em và hoạt động
  async studentLaunch(currentUser: CurrentUser, activityId: string, origin: string | undefined) {
    const { database, childId } = await this.learning.studentContext(currentUser);
    const activity = await this.learning.openActivityForChild(database, childId, activityId);
    if (activity.kind !== 'scorm') {
      throw scormRule('Hoạt động không phải gói SCORM');
    }
    const resourceId = (activity.settings as Record<string, unknown> | null)?.resource_id;
    const pkg = typeof resourceId === 'string' ? await this.publishedPackage(resourceId) : null;
    if (!pkg) {
      throw scormRule('Học liệu của hoạt động chưa có gói SCORM đã công bố');
    }
    const attempts = await database
      .selectFrom('scorm_attempts')
      .select(['sco_identifier', 'completion', 'success', 'score'])
      .where('activity_id', '=', activityId)
      .where('child_id', '=', childId)
      .execute();
    const token = signLaunch(this.signingKey(), this.claims(pkg, activityId, childId, origin));
    return this.present(pkg, token, attempts);
  }

  // Người soạn, người duyệt xem trước gói của một phiên bản (không ghi kết quả)
  async preview(currentUser: CurrentUser, resourceId: string, packageId: string, origin: string | undefined) {
    const visible = await this.packagesOfResource(currentUser, resourceId);
    const pkg = visible.some((row) => row.id === packageId) ? await this.packageById(packageId) : null;
    if (!pkg) {
      throw notFoundError('Không tìm thấy gói SCORM', 'scorm_package');
    }
    const token = signLaunch(this.signingKey(), this.claims(pkg, null, null, origin));
    return this.present(pkg, token, []);
  }

  // ---------- Phát tệp của gói

  // Tệp theo mã truy cập: mã sai, hết hạn, của trường khác, gói không còn thì 404; trang SCO được gắn bộ chuyển API với giá trị
  // ban đầu của em
  async serve(token: string, rawPath: string): Promise<ServedFile> {
    const claims = verifyLaunch(this.signingKey(), token, Math.floor(this.clock.now().getTime() / 1000));
    if (!claims || claims.s !== this.schoolId()) {
      throw notFoundError('Không tìm thấy', 'scorm_content');
    }
    const pkg = await this.packageById(claims.p);
    let decoded: string;
    try {
      decoded = decodeURIComponent(rawPath);
    } catch {
      decoded = rawPath;
    }
    const path = safeEntryPath(decoded);
    const file = pkg && path ? pkg.files[path] : undefined;
    if (!pkg || !path || !file) {
      throw notFoundError('Không tìm thấy', 'scorm_content');
    }
    let body = await this.fileStorage.get(file.key);
    const sco = pkg.scos.find((item) => item.href.split(/[?#]/)[0] === path);
    const html = file.type.startsWith('text/html') || file.type.startsWith('application/xhtml');
    if (sco && html) {
      const state = claims.a && claims.c ? await this.attemptState(claims.a, claims.c, sco.identifier) : null;
      const learnerId = createHash('sha256')
        .update(`${claims.c ?? 'xem-truoc'}:${claims.a ?? ''}`)
        .digest('hex')
        .slice(0, 16);
      const script = shimScript({
        standard: pkg.standard,
        sco: sco.identifier,
        origin: claims.o,
        values: initialValues(pkg.standard, learnerId, state),
      });
      body = Buffer.from(injectShim(body.toString('utf8'), script), 'utf8');
    }
    return {
      body,
      contentType: file.type,
      headers: {
        'content-security-policy': contentSecurityPolicy(this.configuration.scormContentOrigin ? claims.o : "'self'"),
        'access-control-allow-origin': '*',
        'cross-origin-resource-policy': 'cross-origin',
        'cache-control': html ? 'no-store' : 'private, max-age=600',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
      },
    };
  }

  private async attemptState(activityId: string, childId: string, scoIdentifier: string): Promise<AttemptState | null> {
    const { database } = await this.currentSchoolYear.require();
    const row = await database
      .selectFrom('scorm_attempts')
      .select(['completion', 'success', 'score', 'location', 'suspend_data'])
      .where('activity_id', '=', activityId)
      .where('child_id', '=', childId)
      .where('sco_identifier', '=', scoIdentifier)
      .executeTakeFirst();
    return row ? { ...row, score: numberOrNull(row.score) } : null;
  }

  // ---------- Ghi kết quả

  // Trang của học sinh gửi các giá trị bộ chuyển API nhận được; lưu trạng thái của SCO, kết thúc phiên thì cộng thời gian, rồi
  // tính lại kết quả hoạt động
  async studentCommit(currentUser: CurrentUser, activityId: string, body: RequestBody) {
    const { database, childId } = await this.learning.studentContext(currentUser);
    const activity = await this.learning.openActivityForChild(database, childId, activityId);
    const resourceId = (activity.settings as Record<string, unknown> | null)?.resource_id;
    const pkg =
      activity.kind === 'scorm' && typeof resourceId === 'string' ? await this.publishedPackage(resourceId) : null;
    if (!pkg) {
      throw scormRule('Hoạt động không có gói SCORM đã công bố');
    }
    const sco = pkg.scos.find((item) => item.identifier === body?.sco);
    if (!sco) {
      throw scormRule('SCO không có trong gói', [{ field: 'sco', message: 'SCO không hợp lệ' }]);
    }
    const input = normalizeCommit(pkg.standard, body?.values);
    const finished = body?.finished === true;
    const now = this.clock.now();
    const changes = {
      ...(input.completion ? { completion: input.completion } : {}),
      ...(input.success ? { success: input.success } : {}),
      ...(input.score !== null ? { score: input.score } : {}),
      ...(input.location !== null ? { location: input.location } : {}),
      ...(input.suspend_data !== null ? { suspend_data: input.suspend_data } : {}),
    };
    await database
      .insertInto('scorm_attempts')
      .values({
        activity_id: activityId,
        child_id: childId,
        package_id: pkg.id,
        sco_identifier: sco.identifier,
        completion: input.completion ?? 'incomplete',
        success: input.success ?? 'unknown',
        score: input.score,
        location: input.location,
        suspend_data: input.suspend_data,
        total_seconds: finished ? input.session_seconds : 0,
        session_count: finished ? 1 : 0,
        updated_at: now,
      })
      .onConflict((conflict) =>
        conflict.columns(['activity_id', 'child_id', 'sco_identifier']).doUpdateSet((builder) => ({
          ...changes,
          package_id: pkg.id,
          total_seconds: finished
            ? builder('scorm_attempts.total_seconds', '+', input.session_seconds)
            : builder.ref('scorm_attempts.total_seconds'),
          session_count: finished
            ? builder('scorm_attempts.session_count', '+', 1)
            : builder.ref('scorm_attempts.session_count'),
          updated_at: now,
        })),
      )
      .execute();
    return this.writeActivityResult(database, activity, childId, pkg, currentUser.id);
  }

  private async writeActivityResult(
    database: YearExecutor,
    activity: Awaited<ReturnType<LearningService['openActivityForChild']>>,
    childId: string,
    pkg: PackageRow,
    userId: string,
  ) {
    const attempts = await database
      .selectFrom('scorm_attempts')
      .select(['sco_identifier', 'completion', 'success', 'score', 'total_seconds'])
      .where('activity_id', '=', activity.id)
      .where('child_id', '=', childId)
      .execute();
    const result = activityResult(
      activity.completion_rule as CompletionRule,
      activity.pass_score === null ? null : Number(activity.pass_score),
      pkg.scos.map((sco) => sco.identifier),
      attempts.map((row) => ({ ...row, score: numberOrNull(row.score) })),
    );
    const current = await database
      .selectFrom('activity_results')
      .select('status')
      .where('activity_id', '=', activity.id)
      .where('child_id', '=', childId)
      .executeTakeFirst();
    // Giáo viên đã ghi kết quả (hoặc đã miễn) thì gói không ghi đè
    if (current?.status !== 'excused' && !(activity.completion_rule === 'teacher' && current)) {
      await this.learning.writeResult(
        database,
        activity,
        childId,
        { status: result.status, score: result.score },
        { userId, kind: 'student', verb: result.status === 'in_progress' ? 'progressed' : 'completed' },
      );
    }
    return {
      status: result.status,
      score: result.score,
      scos: attempts.map((row) => ({
        identifier: row.sco_identifier,
        completion: row.completion,
        success: row.success,
        score: numberOrNull(row.score),
        total_seconds: row.total_seconds,
      })),
    };
  }

  // Giáo viên dạy được hoạt động xem lượt chạy gói của cả lớp
  async activityAttempts(currentUser: CurrentUser, activityId: string) {
    const { database, space, activity } = await this.learning.teacherActivity(currentUser, activityId);
    if (activity.kind !== 'scorm') {
      throw scormRule('Hoạt động không phải gói SCORM');
    }
    const [students, attempts] = await Promise.all([
      this.learning.students(database, space),
      database.selectFrom('scorm_attempts').selectAll().where('activity_id', '=', activityId).execute(),
    ]);
    return students.map((student) => ({
      child_id: student.id,
      full_name: student.full_name,
      scos: attempts
        .filter((row) => row.child_id === student.id)
        .map((row) => ({
          identifier: row.sco_identifier,
          completion: row.completion,
          success: row.success,
          score: numberOrNull(row.score),
          total_seconds: row.total_seconds,
          updated_at: row.updated_at,
        })),
    }));
  }
}
