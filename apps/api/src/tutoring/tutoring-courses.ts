import { createHmac, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, currentTenant, validationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Kysely, Transaction } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { API_CONFIGURATION, type ApiConfiguration } from '../common/configuration.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { notFoundError } from '../common/request-fields.js';
import { FileStorage } from '../files/file-storage.js';
import { isDone, summarizeProgress, type ResultStatus } from '../learning/learning-rules.js';
import { LearningService } from '../learning/learning.js';
import { assertTutoringModule } from './tutoring.js';

// Khoá học ghi sẵn của chương trình gia sư, phần riêng của gia sư (DT-27 phần 27d1, YCTD-254; tài liệu 32 mục 19.5, YCTD-270).
// Khoá, chương, hoạt động, điều kiện mở, kết quả hoạt động là của lõi LMS 28b; tiến độ cho học sinh, giáo viên, phụ huynh để cho 27d2
// (sau khi 28d gộp). Phần này:
// - gắn chương trình gia sư với một khoá tự chọn (`course_spaces` loại `elective`) của 28b, giáo viên của chương trình là giáo viên
//   của khoá; học sinh có đơn được duyệt được ghi danh vào khoá, đơn rút hoặc không duyệt thì gỡ khỏi khoá;
// - phát video bài học (hoạt động `resource` của khoá trỏ tới học liệu 22h1 là tệp video đã công bố) theo đoạn (HTTP Range) bằng đường
//   dẫn ký 5 phút do điểm cuối có đăng nhập cấp; mỗi lần cấp đường dẫn ghi nhật ký xem; trả `content-disposition: inline`, không lưu
//   đệm, giao diện không có nút tải. Chuyển mã nhiều độ phân giải là tuỳ chọn, mặc định tắt: phát tệp gốc.
// Phần 27d2 (YCTD-261, sau khi 28d gộp): tiến độ dùng kết quả hoạt động của 28b, 28d, không có bảng riêng:
// - học sinh (kênh student) xem video thì trình phát báo phần trăm đã xem; kết quả của em ghi `activity_results` (phần trăm chỉ tăng,
//   xem từ 90% thì hoàn thành nếu cách tính là "xem xong") và nhật ký học tập; xem video phải theo điều kiện mở của 28b;
// - cha mẹ, học sinh thấy tiến độ của em trong khoá (hoạt động bắt buộc xong, quá hạn, từng bài, điểm); giáo viên dạy, Ban Giám hiệu
//   thấy tiến độ từng học sinh của khoá (cùng cách tính với bảng tiến độ của 28d ở Học trực tuyến).
type Database = Kysely<SchoolYearDatabase>;
type Executor = Database | Transaction<SchoolYearDatabase>;

const MANAGE = PERMISSION_CODES.tutoringManage;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LINK_SECONDS = 300;
// Xem từ chừng này phần trăm video thì coi là xem xong (bỏ qua đoạn kết, phần giới thiệu cuối bài)
const WATCHED_PERCENT = 90;

// Đồng bộ ghi danh khoá theo đơn của chương trình: đơn được duyệt thì đang học, đơn khác thì gỡ (giữ lịch sử ghi danh của 28b)
export async function syncTutoringCourseEnrollments(executor: Executor, programId: string, actorUserId: string | null) {
  const link = await executor
    .selectFrom('tutoring_program_courses')
    .select('course_space_id')
    .where('program_id', '=', programId)
    .executeTakeFirst();
  if (!link) {
    return;
  }
  const registrations = await executor
    .selectFrom('tutoring_registrations')
    .select(['child_id', 'status'])
    .where('program_id', '=', programId)
    .execute();
  const approved = new Set(registrations.filter((row) => row.status === 'approved').map((row) => row.child_id));
  const now = new Date();
  for (const childId of approved) {
    await executor
      .insertInto('course_enrollments')
      .values({
        space_id: link.course_space_id,
        child_id: childId,
        status: 'active',
        decided_by: actorUserId,
        decided_at: now,
      })
      .onConflict((conflict) =>
        conflict
          .columns(['space_id', 'child_id'])
          .doUpdateSet({ status: 'active', decided_by: actorUserId, decided_at: now }),
      )
      .execute();
  }
  const others = registrations.filter((row) => !approved.has(row.child_id)).map((row) => row.child_id);
  if (others.length > 0) {
    await executor
      .updateTable('course_enrollments')
      .set({ status: 'removed', decided_by: actorUserId, decided_at: now })
      .where('space_id', '=', link.course_space_id)
      .where('child_id', 'in', others)
      .where('status', '=', 'active')
      .execute();
  }
}

export interface MediaRow {
  activity_id: string;
  title: string;
  section_title: string;
  resource_id: string;
}

@Injectable()
export class TutoringCoursesService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly databases: Databases,
    private readonly fileStorage: FileStorage,
    private readonly clock: Clock,
    @Inject(API_CONFIGURATION) private readonly configuration: ApiConfiguration,
    private readonly learning: LearningService,
  ) {}

  private async database(): Promise<Database> {
    assertTutoringModule();
    return (await this.currentSchoolYear.require()).database;
  }

  private async program(database: Executor, programId: string) {
    if (!UUID.test(programId)) {
      throw notFoundError('Không tìm thấy chương trình', 'program');
    }
    const program = await database
      .selectFrom('tutoring_programs')
      .select(['id', 'name', 'school_level', 'status', 'description'])
      .where('id', '=', programId)
      .executeTakeFirst();
    if (!program) {
      throw notFoundError('Không tìm thấy chương trình', 'program');
    }
    return program;
  }

  private async teaches(database: Executor, userId: string, programId: string) {
    return Boolean(
      await database
        .selectFrom('tutoring_program_teachers')
        .select('program_id')
        .where('program_id', '=', programId)
        .where('teacher_user_id', '=', userId)
        .executeTakeFirst(),
    );
  }

  // Giáo viên dạy chương trình (hoặc Ban Giám hiệu) tạo khoá học ghi sẵn của chương trình đã duyệt; tạo rồi thì trả khoá đã có
  async attachCourse(currentUser: CurrentUser, programId: string, origin: ChangeOrigin) {
    const database = await this.database();
    const program = await this.program(database, programId);
    if (!currentUser.hasPermission(MANAGE) && !(await this.teaches(database, currentUser.id, programId))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ giáo viên dạy chương trình hoặc Ban Giám hiệu tạo khoá học');
    }
    if (program.status !== 'approved') {
      throw new ApplicationError('ERR_CONFLICT', 'Chỉ tạo khoá học cho chương trình đã duyệt');
    }
    if (program.school_level === 'MN') {
      throw new ApplicationError('ERR_CONFLICT', 'Khoá học trực tuyến chỉ có từ Tiểu học');
    }
    const existing = await database
      .selectFrom('tutoring_program_courses')
      .select('course_space_id')
      .where('program_id', '=', programId)
      .executeTakeFirst();
    if (existing) {
      return this.course(currentUser, programId);
    }
    await database.transaction().execute(async (transaction) => {
      const space = await transaction
        .insertInto('course_spaces')
        .values({
          kind: 'elective',
          school_level: program.school_level as 'TH' | 'THCS' | 'THPT',
          title: program.name,
          description: program.description,
          visible_to_students: true,
          enrollment_mode: 'teacher',
          created_by: currentUser.id,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      const teachers = await transaction
        .selectFrom('tutoring_program_teachers')
        .select(['teacher_user_id', 'teacher_name'])
        .where('program_id', '=', programId)
        .execute();
      if (teachers.length > 0) {
        await transaction
          .insertInto('course_space_teachers')
          .values(
            teachers.map((teacher) => ({
              space_id: space.id,
              user_id: teacher.teacher_user_id,
              user_name: teacher.teacher_name,
              source: 'manual' as const,
            })),
          )
          .execute();
      }
      await transaction
        .insertInto('tutoring_program_courses')
        .values({
          program_id: programId,
          course_space_id: space.id,
          created_by_name: currentUser.description.full_name,
        })
        .execute();
      await syncTutoringCourseEnrollments(transaction, programId, currentUser.id);
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'tutoring_program_courses',
        entityId: space.id,
        action: 'create',
        before: null,
        after: { program_id: programId, course_space_id: space.id },
      });
    });
    return this.course(currentUser, programId);
  }

  // Bài video của khoá: hoạt động học liệu đã công bố, học liệu là tệp video đã công bố của kho 22h1
  private async mediaOf(database: Executor, spaceId: string): Promise<MediaRow[]> {
    const activities = await database
      .selectFrom('course_activities')
      .innerJoin('course_sections', 'course_sections.id', 'course_activities.section_id')
      .select([
        'course_activities.id',
        'course_activities.title',
        'course_activities.settings',
        'course_sections.title as section_title',
        'course_sections.position as section_position',
        'course_activities.position',
      ])
      .where('course_activities.space_id', '=', spaceId)
      .where('course_activities.kind', '=', 'resource')
      .where('course_activities.status', '=', 'published')
      .orderBy('course_sections.position')
      .orderBy('course_activities.position')
      .execute();
    const withResource = activities
      .map((activity) => ({
        activity,
        resourceId: (activity.settings as { resource_id?: unknown } | null)?.resource_id,
      }))
      .filter(
        (row): row is { activity: (typeof activities)[number]; resourceId: string } =>
          typeof row.resourceId === 'string' && UUID.test(row.resourceId),
      );
    if (withResource.length === 0) {
      return [];
    }
    const videos = await this.publishedVideos(withResource.map((row) => row.resourceId));
    return withResource
      .filter((row) => videos.has(row.resourceId))
      .map((row) => ({
        activity_id: row.activity.id,
        title: row.activity.title,
        section_title: row.activity.section_title,
        resource_id: row.resourceId,
      }));
  }

  // Bản đã công bố của các học liệu là tệp video: mã học liệu → khoá tệp, kiểu nội dung
  private async publishedVideos(resourceIds: string[]) {
    const rows = await this.databases.system
      .selectFrom('learning_resources')
      .innerJoin('learning_resource_versions', (join) =>
        join
          .onRef('learning_resource_versions.resource_id', '=', 'learning_resources.id')
          .onRef('learning_resource_versions.version_no', '=', 'learning_resources.published_version'),
      )
      .select([
        'learning_resources.id',
        'learning_resource_versions.storage_key',
        'learning_resource_versions.content_type',
      ])
      .where('learning_resources.id', 'in', resourceIds)
      .where('learning_resources.status', '=', 'published')
      .where('learning_resource_versions.kind', '=', 'file')
      .execute();
    return new Map(
      rows
        .filter((row) => row.storage_key && (row.content_type ?? '').startsWith('video/'))
        .map((row) => [row.id, { storageKey: row.storage_key as string, contentType: row.content_type as string }]),
    );
  }

  // Khoá của chương trình và bài video, cho giáo viên dạy, Ban Giám hiệu
  async course(currentUser: CurrentUser, programId: string) {
    const database = await this.database();
    await this.program(database, programId);
    if (!currentUser.hasPermission(MANAGE) && !(await this.teaches(database, currentUser.id, programId))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ giáo viên dạy chương trình hoặc Ban Giám hiệu xem khoá học');
    }
    return this.courseView(database, programId);
  }

  // Tiến độ từng học sinh của khoá cho giáo viên dạy, Ban Giám hiệu: hoạt động bắt buộc xong, quá hạn, phần trăm đã xem từng video
  async courseProgress(currentUser: CurrentUser, programId: string) {
    const database = await this.database();
    await this.program(database, programId);
    if (!currentUser.hasPermission(MANAGE) && !(await this.teaches(database, currentUser.id, programId))) {
      throw new ApplicationError(
        'ERR_FORBIDDEN',
        'Chỉ giáo viên dạy chương trình hoặc Ban Giám hiệu xem tiến độ khoá học',
      );
    }
    const link = await database
      .selectFrom('tutoring_program_courses')
      .select('course_space_id')
      .where('program_id', '=', programId)
      .executeTakeFirst();
    if (!link) {
      return { course_id: null, videos: [], students: [] };
    }
    const spaceId = link.course_space_id;
    const [activities, students, videos] = await Promise.all([
      database
        .selectFrom('course_activities')
        .select(['id', 'section_id', 'required', 'due_at'])
        .where('space_id', '=', spaceId)
        .where('status', '=', 'published')
        .execute(),
      database
        .selectFrom('course_enrollments')
        .innerJoin('children', 'children.id', 'course_enrollments.child_id')
        .select(['children.id', 'children.full_name'])
        .where('course_enrollments.space_id', '=', spaceId)
        .where('course_enrollments.status', '=', 'active')
        .orderBy('children.full_name')
        .execute(),
      this.mediaOf(database, spaceId),
    ]);
    const results =
      activities.length === 0 || students.length === 0
        ? []
        : await database
            .selectFrom('activity_results')
            .select(['activity_id', 'child_id', 'status', 'progress', 'score'])
            .where(
              'activity_id',
              'in',
              activities.map((activity) => activity.id),
            )
            .where(
              'child_id',
              'in',
              students.map((student) => student.id),
            )
            .execute();
    const now = this.clock.now();
    return {
      course_id: spaceId,
      videos: videos.map((video) => ({ activity_id: video.activity_id, title: video.title })),
      students: students.map((student) => {
        const own = results.filter((row) => row.child_id === student.id);
        const byActivity = new Map(
          own.map((row) => [row.activity_id, { ...row, score: row.score === null ? null : Number(row.score) }]),
        );
        return {
          child_id: student.id,
          full_name: student.full_name,
          summary: summarizeProgress(activities, byActivity, now),
          videos: Object.fromEntries(
            videos.map((video) => {
              const row = byActivity.get(video.activity_id);
              return [video.activity_id, { status: row?.status ?? 'not_started', progress: row?.progress ?? 0 }];
            }),
          ),
        };
      }),
    };
  }

  // Tiến độ của một em trong khoá (cha mẹ, học sinh): cùng cách tính với danh sách học của em ở 28b, thêm phần trăm đã xem video
  private async childProgress(database: Executor, childId: string, spaceId: string, videoIds: string[]) {
    const learning = await this.learning.learningOfChild(database, childId);
    const space = learning.spaces.find((row) => row.id === spaceId);
    const watched =
      videoIds.length === 0
        ? []
        : await database
            .selectFrom('activity_results')
            .select(['activity_id', 'status', 'progress'])
            .where('child_id', '=', childId)
            .where('activity_id', 'in', videoIds)
            .execute();
    const byVideo = new Map(watched.map((row) => [row.activity_id, row]));
    return {
      summary: space?.summary ?? { required: 0, done: 0, overdue: 0, percent: 0 },
      activities: (space?.sections ?? []).flatMap((section) =>
        section.activities.map((activity) => ({
          id: activity.id,
          section_title: section.title,
          title: activity.title,
          kind_label: activity.kind_label,
          required: activity.required,
          due_at: activity.due_at,
          open: activity.open,
          status: activity.status,
          score: activity.score,
        })),
      ),
      videos: Object.fromEntries(
        videoIds.map((id) => {
          const row = byVideo.get(id);
          return [id, { status: row?.status ?? 'not_started', progress: row?.progress ?? 0 }];
        }),
      ),
    };
  }

  // Học sinh xem video: trình phát báo phần trăm đã xem; chỉ tăng, xem từ 90% thì hoàn thành (cách tính "xem xong"), ghi nhật ký học tập
  async reportProgress(currentUser: CurrentUser, childId: string, activityId: string, percentValue: unknown) {
    if (typeof percentValue !== 'number' || !Number.isInteger(percentValue) || percentValue < 0 || percentValue > 100) {
      throw validationError([{ field: 'percent', message: 'Phần trăm đã xem là số nguyên từ 0 đến 100' }]);
    }
    const database = await this.database();
    await this.mediaActivity(database, activityId);
    const activity = await this.learning.openActivityForChild(database, childId, activityId);
    const current = await database
      .selectFrom('activity_results')
      .select(['status', 'progress', 'score', 'level'])
      .where('activity_id', '=', activityId)
      .where('child_id', '=', childId)
      .executeTakeFirst();
    const before = current?.progress ?? 0;
    if (current && (isDone(current.status) || current.status === 'failed' || percentValue <= before)) {
      return { status: current.status, progress: before };
    }
    const progress = Math.max(before, percentValue);
    const status: ResultStatus =
      progress >= WATCHED_PERCENT && activity.completion_rule === 'view' ? 'completed' : 'in_progress';
    await this.learning.writeResult(
      database,
      activity,
      childId,
      { status, progress, score: current?.score === undefined ? null : Number(current.score), level: current?.level },
      { userId: currentUser.id, kind: 'student', verb: status === 'completed' ? 'completed' : 'progressed' },
    );
    return { status, progress };
  }

  private async courseView(database: Executor, programId: string, childId?: string) {
    const link = await database
      .selectFrom('tutoring_program_courses')
      .innerJoin('course_spaces', 'course_spaces.id', 'tutoring_program_courses.course_space_id')
      .select(['course_spaces.id', 'course_spaces.title', 'tutoring_program_courses.created_at'])
      .where('tutoring_program_courses.program_id', '=', programId)
      .executeTakeFirst();
    if (!link) {
      return { course: null, videos: [] };
    }
    const enrolled = await database
      .selectFrom('course_enrollments')
      .select((builder) => builder.fn.countAll<string>().as('count'))
      .where('space_id', '=', link.id)
      .where('status', '=', 'active')
      .executeTakeFirstOrThrow();
    const videos = await this.mediaOf(database, link.id);
    return {
      course: { id: link.id, title: link.title, enrolled: Number(enrolled.count) },
      videos,
      ...(childId
        ? {
            progress: await this.childProgress(
              database,
              childId,
              link.id,
              videos.map((video) => video.activity_id),
            ),
          }
        : {}),
    };
  }

  // Cha mẹ: khoá của chương trình mà con có đơn được duyệt
  async childCourse(currentUser: CurrentUser, childId: string, programId: string) {
    const database = await this.database();
    await this.assertGuardianEnrolled(database, currentUser, childId, programId);
    return this.courseView(database, programId, childId);
  }

  // Học sinh (kênh student): các khoá gia sư mình được ghi danh
  async studentCourses(childId: string) {
    const database = await this.database();
    const programs = await database
      .selectFrom('tutoring_program_courses')
      .innerJoin('tutoring_programs', 'tutoring_programs.id', 'tutoring_program_courses.program_id')
      .innerJoin('course_enrollments', 'course_enrollments.space_id', 'tutoring_program_courses.course_space_id')
      .select(['tutoring_programs.id', 'tutoring_programs.name'])
      .where('course_enrollments.child_id', '=', childId)
      .where('course_enrollments.status', '=', 'active')
      .execute();
    const result = [];
    for (const program of programs) {
      result.push({
        program_id: program.id,
        program_name: program.name,
        ...(await this.courseView(database, program.id, childId)),
      });
    }
    return result;
  }

  private async assertGuardianEnrolled(
    database: Executor,
    currentUser: CurrentUser,
    childId: string,
    programId: string,
  ) {
    if (!UUID.test(childId) || !UUID.test(programId)) {
      throw notFoundError('Không tìm thấy học sinh', 'child');
    }
    const row = await database
      .selectFrom('tutoring_registrations')
      .innerJoin('child_guardians', 'child_guardians.child_id', 'tutoring_registrations.child_id')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .select('tutoring_registrations.id')
      .where('tutoring_registrations.child_id', '=', childId)
      .where('tutoring_registrations.program_id', '=', programId)
      .where('tutoring_registrations.status', '=', 'approved')
      .where('guardians.user_id', '=', currentUser.id)
      .executeTakeFirst();
    if (!row) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ cha mẹ của học sinh có đơn được duyệt xem khoá học');
    }
  }

  // Bài video và chương trình của nó; chỉ hoạt động của khoá gắn với chương trình gia sư
  private async mediaActivity(database: Executor, activityId: string) {
    if (!UUID.test(activityId)) {
      throw notFoundError('Không tìm thấy bài học', 'course_activity');
    }
    const row = await database
      .selectFrom('course_activities')
      .innerJoin('tutoring_program_courses', 'tutoring_program_courses.course_space_id', 'course_activities.space_id')
      .select(['course_activities.id', 'course_activities.space_id', 'tutoring_program_courses.program_id'])
      .where('course_activities.id', '=', activityId)
      .executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy bài học', 'course_activity');
    }
    const media = (await this.mediaOf(database, row.space_id)).find((item) => item.activity_id === activityId);
    if (!media) {
      throw notFoundError('Bài học không phải video đã công bố', 'course_activity');
    }
    return { ...row, media };
  }

  // Khoá ký đường dẫn: khoá băm dữ liệu trẻ của trường (chế độ nhiều trường) hoặc của bản triển khai
  private signingKey(): Buffer {
    return currentTenant()?.childDataHashKey ?? this.configuration.childDataHashKey;
  }

  private signature(payload: string): string {
    return createHmac('sha256', this.signingKey()).update(`tutoring-media:${payload}`).digest('base64url');
  }

  // Đường dẫn xem có hạn 5 phút; người xem là giáo viên dạy, Ban Giám hiệu (`childId` trống), cha mẹ của học sinh có đơn được duyệt
  // hoặc học sinh đang học khoá (`childId`); mỗi lần ghi nhật ký xem
  async mediaLink(
    currentUser: CurrentUser,
    activityId: string,
    access: { childId: string | null; student: boolean },
    origin: ChangeOrigin,
  ) {
    const database = await this.database();
    const activity = await this.mediaActivity(database, activityId);
    if (access.childId === null) {
      if (!currentUser.hasPermission(MANAGE) && !(await this.teaches(database, currentUser.id, activity.program_id))) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Không có quyền xem bài học này');
      }
    } else if (access.student) {
      const enrolled = await database
        .selectFrom('course_enrollments')
        .select('child_id')
        .where('space_id', '=', activity.space_id)
        .where('child_id', '=', access.childId)
        .where('status', '=', 'active')
        .executeTakeFirst();
      if (!enrolled) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Học sinh chưa được ghi danh khoá học này');
      }
      // 27d2: bài còn khoá theo điều kiện mở của 28b thì chưa xem được; mở xem ghi nhật ký học tập (hoàn thành khi xem đủ, không phải khi
      // mở)
      await this.learning.openActivityForChild(database, access.childId, activityId);
      await database
        .insertInto('learning_events')
        .values({
          space_id: activity.space_id,
          activity_id: activityId,
          child_id: access.childId,
          actor_user_id: currentUser.id,
          actor_kind: 'student',
          verb: 'opened',
          result: null,
        })
        .execute();
    } else {
      await this.assertGuardianEnrolled(database, currentUser, access.childId, activity.program_id);
    }
    await database.transaction().execute(async (transaction) => {
      const view = await transaction
        .insertInto('tutoring_media_views')
        .values({
          activity_id: activityId,
          viewer_user_id: currentUser.id,
          viewer_name: currentUser.description.full_name,
          child_id: access.childId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'tutoring_media_views',
        entityId: view.id,
        action: 'create',
        before: null,
        after: { activity_id: activityId, child_id: access.childId },
      });
    });
    const expires = Math.floor(this.clock.now().getTime() / 1000) + LINK_SECONDS;
    const payload = Buffer.from(JSON.stringify({ a: activityId, e: expires })).toString('base64url');
    return {
      url: `/api/v1/tutoring/course-media/${activityId}/stream?token=${payload}.${this.signature(payload)}`,
      expires_at: new Date(expires * 1000).toISOString(),
    };
  }

  // Phát theo đoạn: kiểm đường dẫn ký, trả cả tệp hoặc đoạn theo tiêu đề Range (206)
  async stream(activityId: string, token: unknown, range: string | undefined) {
    const [payload, signature] = typeof token === 'string' ? token.split('.') : [];
    const expected = payload ? this.signature(payload) : '';
    if (
      !payload ||
      !signature ||
      expected.length !== signature.length ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
    ) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Đường dẫn xem không hợp lệ');
    }
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { a: string; e: number };
    if (claims.a !== activityId || claims.e * 1000 < this.clock.now().getTime()) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Đường dẫn xem đã hết hạn');
    }
    const database = (await this.currentSchoolYear.require()).database;
    const activity = await this.mediaActivity(database, activityId);
    const video = (await this.publishedVideos([activity.media.resource_id])).get(activity.media.resource_id);
    if (!video) {
      throw notFoundError('Không tìm thấy video', 'learning_resource');
    }
    const contents = await this.fileStorage.get(video.storageKey);
    const total = contents.length;
    const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
    if (!match || (match[1] === '' && match[2] === '')) {
      return { status: 200, contents, total, contentType: video.contentType, start: 0, end: total - 1 };
    }
    let start: number;
    let end: number;
    if (match[1] === '') {
      // Đoạn cuối: "bytes=-N"
      start = Math.max(0, total - Number(match[2]));
      end = total - 1;
    } else {
      start = Number(match[1]);
      end = match[2] === '' ? total - 1 : Math.min(Number(match[2]), total - 1);
    }
    if (start >= total || start > end) {
      return { status: 416, contents: Buffer.alloc(0), total, contentType: video.contentType, start: 0, end: 0 };
    }
    return {
      status: 206,
      contents: contents.subarray(start, end + 1),
      total,
      contentType: video.contentType,
      start,
      end,
    };
  }
}
