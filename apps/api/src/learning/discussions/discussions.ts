import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, type FieldError } from '@school-management/server';
import { PERMISSION_CODES, scanContactInfo, type ContactFinding } from '@school-management/shared';
import type { Kysely, Selectable, Transaction } from 'kysely';
import { randomUUID } from 'node:crypto';
import { decodeFileName, type UploadedPart } from '../../activities/content-files.js';
import type { CurrentUser } from '../../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../../common/current-school-year.js';
import { queueNotification } from '../../common/notification-queue.js';
import { isUuid, notFoundError, type RequestBody } from '../../common/request-fields.js';
import { storageKey } from '../../common/resource-names.js';
import { FileStorage } from '../../files/file-storage.js';
import { TimetablesService } from '../../timetables/timetables.js';
import { LearningService } from '../learning.js';
import {
  calendarStart,
  discussionRule,
  GROUP_FILE_BYTES,
  guardianGroupView,
  isOpenNow,
  MAX_BAN_DAYS,
  MAX_BODY,
  MAX_NOTE,
  MAX_TITLE,
  openHoursOf,
  questionPending,
  readText,
  REPORT_DUE_DAYS,
  studentCanSee,
  throwIfErrors,
  weekCalendar,
} from './discussion-rules.js';

// Giao tiếp trong lớp và nhóm (DT-28 phần 28e, YCTD-275; tài liệu 32 mục 20.7): thông báo lớp, diễn đàn, hỏi đáp ở lớp học trực
// tuyến; bảng tin, việc, ghi chú, tệp của không gian học nhóm; hàng chờ báo cáo vi phạm; lịch học tập của học sinh. Quyền lớp học
// trực tuyến lấy qua cửa của lõi 28b; nhóm lấy từ bộ nhóm 28a. An toàn trẻ em (trường không tắt được): giáo viên của lớp và người
// lập bộ nhóm luôn thấy mọi nội dung; không có tin nhắn riêng giữa hai học sinh; chữ học sinh viết được lọc thông tin liên lạc;
// học sinh xóa là ẩn, vẫn lưu; ngoài giờ mở học sinh chỉ đọc
type YearExecutor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;
type ThreadRow = Selectable<SchoolYearDatabase['discussion_threads']>;
type SpaceRow = Selectable<SchoolYearDatabase['course_spaces']>;
type Author = { userId: string; name: string; kind: 'teacher' | 'student' | 'staff'; childId: string | null };
const FILE_TYPES = [
  { contentType: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { contentType: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { contentType: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
];

const presentThread = (thread: ThreadRow) => ({
  id: thread.id,
  scope: thread.scope,
  space_id: thread.space_id,
  group_id: thread.group_id,
  kind: thread.kind,
  title: thread.title,
  body: thread.body,
  section_id: thread.section_id,
  activity_id: thread.activity_id,
  private: thread.private,
  status: thread.status,
  accepted_post_id: thread.accepted_post_id,
  author_name: thread.author_name,
  author_kind: thread.author_kind,
  author_child_id: thread.author_child_id,
  hidden: thread.hidden_at !== null,
  last_post_at: thread.last_post_at,
  created_at: thread.created_at,
});

@Injectable()
export class DiscussionsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly learning: LearningService,
    private readonly timetables: TimetablesService,
    private readonly fileStorage: FileStorage,
    private readonly clock: Clock,
  ) {}

  // ---------- Đọc chung

  private async setting(database: YearExecutor, key: string): Promise<unknown> {
    const row = await database
      .selectFrom('settings')
      .innerJoin('org_units', 'org_units.id', 'settings.org_unit_id')
      .select('settings.value')
      .where('org_units.unit_type', '=', 'truong_chinh')
      .where('settings.key', '=', key)
      .executeTakeFirst();
    return row?.value ?? null;
  }

  private async blockedWords(database: YearExecutor): Promise<string[]> {
    const value = await this.setting(database, 'discussion_blocked_words');
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }

  // Học sinh viết được: trong giờ mở (GD-144, trường tự cấu hình) và không bị tạm khóa quyền viết
  private async assertStudentCanWrite(database: YearExecutor, childId: string) {
    const now = this.clock.now();
    if (!isOpenNow(openHoursOf(await this.setting(database, 'discussion_open_hours')), now)) {
      throw discussionRule('Ngoài giờ mở thảo luận của trường, em chỉ đọc được');
    }
    const ban = await database
      .selectFrom('discussion_write_bans')
      .select(['until', 'reason'])
      .where('child_id', '=', childId)
      .where('until', '>', now)
      .orderBy('until', 'desc')
      .executeTakeFirst();
    if (ban) {
      throw discussionRule(`Em đang tạm không viết được đến ${ban.until.toISOString().slice(0, 10)}: ${ban.reason}`);
    }
  }

  // Lọc chữ của học sinh: che thông tin liên lạc và từ ngữ của trường; có từ ngữ thì gửi hàng chờ của trường
  private async filtered(database: YearExecutor, author: Author, text: string) {
    if (author.kind !== 'student') {
      return { text, findings: [] as ContactFinding[] };
    }
    const result = scanContactInfo(text, await this.blockedWords(database));
    return { text: result.masked, findings: result.findings };
  }

  private async fileFilterReport(
    database: YearExecutor,
    threadId: string,
    postId: string | null,
    findings: ContactFinding[],
  ) {
    if (!findings.some((finding) => finding.kind === 'word')) return;
    await database
      .insertInto('discussion_reports')
      .values({
        thread_id: threadId,
        post_id: postId,
        source: 'filter',
        reason: 'Bộ lọc phát hiện từ ngữ trong danh sách của trường',
        due_at: new Date(this.clock.now().getTime() + REPORT_DUE_DAYS * 86_400_000),
      })
      .execute();
  }

  private async posts(database: YearExecutor, threadId: string, includeHidden: boolean) {
    let query = database
      .selectFrom('discussion_posts')
      .select(['id', 'body', 'author_name', 'author_kind', 'author_child_id', 'hidden_at', 'flags', 'created_at'])
      .where('thread_id', '=', threadId)
      .orderBy('created_at');
    if (!includeHidden) query = query.where('hidden_at', 'is', null);
    const rows = await query.execute();
    return rows.map((row) => ({
      id: row.id,
      body: row.body,
      author_name: row.author_name,
      author_kind: row.author_kind,
      author_child_id: row.author_child_id,
      hidden: row.hidden_at !== null,
      flags: includeHidden ? row.flags : undefined,
      created_at: row.created_at,
    }));
  }

  private async insertThread(
    database: YearExecutor,
    author: Author,
    values: {
      scope: 'course_space' | 'group';
      space_id: string | null;
      group_id: string | null;
      kind: ThreadRow['kind'];
      title: string;
      body: string;
      section_id?: string | null;
      activity_id?: string | null;
      private?: boolean;
    },
  ) {
    const title = await this.filtered(database, author, values.title);
    const body = await this.filtered(database, author, values.body);
    const findings = [...title.findings, ...body.findings];
    const thread = await database
      .insertInto('discussion_threads')
      .values({
        ...values,
        title: title.text,
        body: body.text,
        author_user_id: author.userId,
        author_name: author.name,
        author_kind: author.kind,
        author_child_id: author.childId,
        flags: JSON.stringify(findings),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    await this.fileFilterReport(database, thread.id, null, findings);
    return { thread, masked: findings.length > 0 };
  }

  private async insertPost(database: YearExecutor, thread: ThreadRow, author: Author, raw: string) {
    if (thread.status === 'locked' && author.kind === 'student') {
      throw discussionRule('Chủ đề đã khoá, không trả lời thêm được');
    }
    const body = await this.filtered(database, author, raw);
    const post = await database
      .insertInto('discussion_posts')
      .values({
        thread_id: thread.id,
        body: body.text,
        author_user_id: author.userId,
        author_name: author.name,
        author_kind: author.kind,
        author_child_id: author.childId,
        flags: JSON.stringify(body.findings),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    await database
      .updateTable('discussion_threads')
      .set({ last_post_at: this.clock.now(), updated_at: this.clock.now() })
      .where('id', '=', thread.id)
      .execute();
    await this.fileFilterReport(database, thread.id, post.id, body.findings);
    return { id: post.id, body: post.body, masked: body.findings.length > 0, created_at: post.created_at };
  }

  private parseThread(body: RequestBody, kinds: readonly string[]) {
    const errors: FieldError[] = [];
    const kind = typeof body?.kind === 'string' && kinds.includes(body.kind) ? body.kind : null;
    if (!kind) errors.push({ field: 'kind', message: `Loại là ${kinds.join(', ')}` });
    const title = readText(body, 'title', MAX_TITLE, errors);
    const text = readText(body, 'body', MAX_BODY, errors);
    throwIfErrors(errors);
    return {
      kind: kind as ThreadRow['kind'],
      title,
      body: text,
      section_id: isUuid(body?.section_id) ? body.section_id : null,
      activity_id: isUuid(body?.activity_id) ? body.activity_id : null,
      private: body?.private === true,
    };
  }

  private async findThread(database: YearExecutor, threadId: string) {
    const thread = await database
      .selectFrom('discussion_threads')
      .selectAll()
      .where('id', '=', threadId)
      .executeTakeFirst();
    if (!thread) {
      throw notFoundError('Không tìm thấy chủ đề', 'discussion_thread');
    }
    return thread;
  }

  private staffAuthor(currentUser: CurrentUser, kind: 'teacher' | 'staff' = 'teacher'): Author {
    return { userId: currentUser.id, name: currentUser.description.full_name, kind, childId: null };
  }

  // ---------- Nhân sự: lớp học trực tuyến

  async listThreads(currentUser: CurrentUser, spaceId: string, kind: string | undefined) {
    const { database } = await this.learning.spaceAccess(currentUser, spaceId);
    let query = database.selectFrom('discussion_threads').selectAll().where('space_id', '=', spaceId);
    if (kind) query = query.where('kind', '=', kind as ThreadRow['kind']);
    const rows = await query.orderBy('last_post_at', 'desc').limit(200).execute();
    const settings = await database
      .selectFrom('discussion_space_settings')
      .select('students_can_post_topics')
      .where('space_id', '=', spaceId)
      .executeTakeFirst();
    return { threads: rows.map(presentThread), students_can_post_topics: settings?.students_can_post_topics ?? false };
  }

  async createThread(currentUser: CurrentUser, spaceId: string, body: RequestBody) {
    const { database, space, canTeach } = await this.learning.spaceAccess(currentUser, spaceId);
    if (!canTeach) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ giáo viên của lớp học trực tuyến đăng thông báo, mở chủ đề');
    }
    const input = this.parseThread(body, ['announcement', 'forum', 'question']);
    const { thread } = await this.insertThread(database, this.staffAuthor(currentUser), {
      scope: 'course_space',
      space_id: spaceId,
      group_id: null,
      ...input,
    });
    if (input.kind === 'announcement') {
      await this.notifyAnnouncement(database, space, thread);
    }
    return presentThread(thread);
  }

  // Thông báo lớp tới học sinh (tài khoản học) và phụ huynh qua hàng đợi thông báo; tin đẩy không có dữ liệu cá nhân
  private async notifyAnnouncement(database: YearExecutor, space: SpaceRow, thread: ThreadRow) {
    const students = await this.learning.students(database, space);
    const childIds = students.map((student) => student.id);
    if (childIds.length === 0) return;
    const [guardians, accounts, unit] = await Promise.all([
      database
        .selectFrom('child_guardians')
        .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
        .select('guardians.user_id')
        .where('child_guardians.child_id', 'in', childIds)
        .where('guardians.user_id', 'is not', null)
        .execute(),
      database
        .selectFrom('student_learning_accounts')
        .select('identity_user_id')
        .where('child_id', 'in', childIds)
        .where('identity_user_id', 'is not', null)
        .execute(),
      database
        .selectFrom('children')
        .select('org_unit_id')
        .where('id', '=', childIds[0] ?? '')
        .executeTakeFirst(),
    ]);
    const users = [
      ...new Set([
        ...guardians.flatMap((row) => (row.user_id ? [row.user_id] : [])),
        ...accounts.flatMap((row) => (row.identity_user_id ? [row.identity_user_id] : [])),
      ]),
    ];
    await queueNotification(database, {
      orgUnitId: unit?.org_unit_id ?? null,
      templateCode: 'class_announcement',
      title: `Thông báo lớp ${space.title}: ${thread.title}`,
      body: thread.body.slice(0, 1500),
      targetType: 'discussion_thread',
      targetId: thread.id,
      recipients: users.map((userId) => ({ userId, channel: 'in_app' as const })),
    });
    await queueNotification(database, {
      orgUnitId: unit?.org_unit_id ?? null,
      templateCode: 'class_announcement_push',
      title: 'Có thông báo lớp mới',
      body: 'Mở ứng dụng để đọc thông báo của lớp học trực tuyến',
      targetType: 'discussion_thread',
      targetId: thread.id,
      recipients: guardians.flatMap((row) => (row.user_id ? [{ userId: row.user_id, channel: 'push' as const }] : [])),
    });
  }

  // Giáo viên của lớp (hoặc người xem được lớp) xem chủ đề kèm mọi trả lời, kể cả đã ẩn; nhóm: người lập bộ nhóm, giáo viên của lớp
  private async staffThread(currentUser: CurrentUser, threadId: string) {
    const { database } = await this.currentSchoolYear.require();
    const thread = await this.findThread(database, threadId);
    if (thread.space_id) {
      const access = await this.learning.spaceAccess(currentUser, thread.space_id);
      return { database, thread, canModerate: access.canTeach };
    }
    await this.groupStaff(currentUser, database, thread.group_id ?? '');
    return { database, thread, canModerate: true };
  }

  async thread(currentUser: CurrentUser, threadId: string) {
    const { database, thread } = await this.staffThread(currentUser, threadId);
    return {
      thread: { ...presentThread(thread), flags: thread.flags },
      posts: await this.posts(database, thread.id, true),
    };
  }

  async reply(currentUser: CurrentUser, threadId: string, body: RequestBody) {
    const { database, thread } = await this.staffThread(currentUser, threadId);
    const errors: FieldError[] = [];
    const text = readText(body, 'body', MAX_BODY, errors);
    throwIfErrors(errors);
    return this.insertPost(database, thread, this.staffAuthor(currentUser), text);
  }

  async accept(currentUser: CurrentUser, threadId: string, body: RequestBody) {
    const { database, thread, canModerate } = await this.staffThread(currentUser, threadId);
    if (!canModerate || thread.kind !== 'question') {
      throw discussionRule('Chỉ giáo viên của lớp xác nhận câu trả lời của câu hỏi');
    }
    const postId = isUuid(body?.post_id) ? body.post_id : null;
    if (postId) {
      const post = await database
        .selectFrom('discussion_posts')
        .select('id')
        .where('id', '=', postId)
        .where('thread_id', '=', thread.id)
        .where('hidden_at', 'is', null)
        .executeTakeFirst();
      if (!post) throw discussionRule('Câu trả lời không thuộc câu hỏi này');
    }
    await database
      .updateTable('discussion_threads')
      .set({ accepted_post_id: postId, updated_at: this.clock.now() })
      .where('id', '=', thread.id)
      .execute();
    return { accepted_post_id: postId };
  }

  async lock(currentUser: CurrentUser, threadId: string, locked: boolean) {
    const { database, thread, canModerate } = await this.staffThread(currentUser, threadId);
    if (!canModerate) throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ giáo viên của lớp khoá chủ đề');
    await database
      .updateTable('discussion_threads')
      .set({ status: locked ? 'locked' : 'open', updated_at: this.clock.now() })
      .where('id', '=', thread.id)
      .execute();
    return { status: locked ? 'locked' : 'open' };
  }

  // Ẩn chủ đề hoặc một trả lời (vẫn lưu); hiện lại được
  async hide(currentUser: CurrentUser, threadId: string, body: RequestBody) {
    const { database, thread, canModerate } = await this.staffThread(currentUser, threadId);
    if (!canModerate) throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ giáo viên của lớp ẩn nội dung');
    const hidden = body?.hidden !== false;
    const values = { hidden_at: hidden ? this.clock.now() : null, hidden_by: hidden ? currentUser.id : null };
    if (isUuid(body?.post_id)) {
      await database
        .updateTable('discussion_posts')
        .set(values)
        .where('id', '=', body.post_id)
        .where('thread_id', '=', thread.id)
        .execute();
    } else {
      await database.updateTable('discussion_threads').set(values).where('id', '=', thread.id).execute();
    }
    return { hidden };
  }

  async updateSpaceSettings(currentUser: CurrentUser, spaceId: string, body: RequestBody) {
    const { database, canTeach } = await this.learning.spaceAccess(currentUser, spaceId);
    if (!canTeach) throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ giáo viên của lớp đổi cài đặt thảo luận');
    const values = {
      students_can_post_topics: body?.students_can_post_topics === true,
      updated_by: currentUser.id,
      updated_at: this.clock.now(),
    };
    await database
      .insertInto('discussion_space_settings')
      .values({ space_id: spaceId, ...values })
      .onConflict((builder) => builder.column('space_id').doUpdateSet(values))
      .execute();
    return { students_can_post_topics: values.students_can_post_topics };
  }

  // Hàng chờ câu hỏi của giáo viên: câu chưa có giáo viên trả lời, chưa xác nhận câu trả lời; quá 48 giờ là quá hạn
  async pendingQuestions(currentUser: CurrentUser, spaceId: string) {
    const { database } = await this.learning.spaceAccess(currentUser, spaceId);
    const questions = await database
      .selectFrom('discussion_threads')
      .selectAll()
      .where('space_id', '=', spaceId)
      .where('kind', '=', 'question')
      .where('hidden_at', 'is', null)
      .orderBy('created_at')
      .execute();
    const replied = questions.length
      ? await database
          .selectFrom('discussion_posts')
          .select('thread_id')
          .distinct()
          .where(
            'thread_id',
            'in',
            questions.map((row) => row.id),
          )
          .where('author_kind', '=', 'teacher')
          .execute()
      : [];
    const repliedIds = new Set(replied.map((row) => row.thread_id));
    const now = this.clock.now();
    return questions
      .map((thread) => ({ thread, state: questionPending(thread, repliedIds.has(thread.id), now) }))
      .filter((row) => row.state.pending)
      .map((row) => ({ ...presentThread(row.thread), overdue: row.state.overdue }));
  }

  // ---------- Không gian học nhóm

  private async groupOf(database: YearExecutor, groupId: string) {
    const group = await database
      .selectFrom('child_groups')
      .innerJoin('group_sets', 'group_sets.id', 'child_groups.group_set_id')
      .innerJoin('classes', 'classes.id', 'child_groups.class_id')
      .select([
        'child_groups.id',
        'child_groups.name',
        'child_groups.class_id',
        'child_groups.leader_child_id',
        'group_sets.id as group_set_id',
        'group_sets.name as group_set_name',
        'group_sets.owner_user_id',
        'group_sets.status as set_status',
        'classes.school_level',
      ])
      .where('child_groups.id', '=', groupId)
      .executeTakeFirst();
    if (!group) {
      throw notFoundError('Không tìm thấy nhóm', 'child_group');
    }
    return group;
  }

  // Người lập bộ nhóm, giáo viên được phân công lớp, người xử lý vi phạm của trường
  private async groupStaff(currentUser: CurrentUser, database: YearExecutor, groupId: string) {
    const group = await this.groupOf(database, groupId);
    if (group.owner_user_id === currentUser.id || currentUser.hasPermission(PERMISSION_CODES.discussionModerate)) {
      return group;
    }
    const assigned = await database
      .selectFrom('class_staff_assignments')
      .select('id')
      .where('class_id', '=', group.class_id ?? '')
      .where('staff_user_id', '=', currentUser.id)
      .where('status', '=', 'active')
      .executeTakeFirst();
    if (!assigned) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người lập bộ nhóm, giáo viên của lớp xem không gian nhóm này');
    }
    return group;
  }

  private async workspace(database: YearExecutor, groupId: string, options: { discussions: boolean; notes: boolean }) {
    const [members, threads, tasks, note, files] = await Promise.all([
      database
        .selectFrom('child_group_members')
        .innerJoin('children', 'children.id', 'child_group_members.child_id')
        .select(['children.id as child_id', 'children.full_name'])
        .where('child_group_members.group_id', '=', groupId)
        .orderBy('children.full_name')
        .execute(),
      options.discussions
        ? database
            .selectFrom('discussion_threads')
            .selectAll()
            .where('group_id', '=', groupId)
            .where('hidden_at', 'is', null)
            .orderBy('last_post_at', 'desc')
            .execute()
        : Promise.resolve([]),
      database
        .selectFrom('group_tasks')
        .select(['id', 'title', 'assignee_child_id', 'due_on', 'status', 'created_by_name', 'updated_at'])
        .where('group_id', '=', groupId)
        .orderBy('created_at')
        .execute(),
      options.notes
        ? database
            .selectFrom('group_notes')
            .select(['version', 'content', 'edited_by_name', 'created_at'])
            .where('group_id', '=', groupId)
            .orderBy('version', 'desc')
            .executeTakeFirst()
        : Promise.resolve(undefined),
      database
        .selectFrom('group_files')
        .select(['id', 'file_name', 'content_type', 'size_bytes', 'uploaded_by_name', 'created_at'])
        .where('group_id', '=', groupId)
        .where('hidden_at', 'is', null)
        .orderBy('created_at', 'desc')
        .execute(),
    ]);
    const posts = new Map<string, Awaited<ReturnType<DiscussionsService['posts']>>>();
    for (const thread of threads) posts.set(thread.id, await this.posts(database, thread.id, false));
    return {
      members,
      threads: threads.map((thread) => ({ ...presentThread(thread), posts: posts.get(thread.id) ?? [] })),
      tasks,
      note: note ?? null,
      files,
    };
  }

  async groupWorkspace(currentUser: CurrentUser, groupId: string) {
    const { database } = await this.currentSchoolYear.require();
    const group = await this.groupStaff(currentUser, database, groupId);
    return { group, ...(await this.workspace(database, groupId, { discussions: true, notes: true })) };
  }

  async staffGroupThread(currentUser: CurrentUser, groupId: string, body: RequestBody) {
    const { database } = await this.currentSchoolYear.require();
    await this.groupStaff(currentUser, database, groupId);
    const input = this.parseThread({ ...body, kind: 'group_board' }, ['group_board']);
    const { thread } = await this.insertThread(database, this.staffAuthor(currentUser), {
      scope: 'group',
      space_id: null,
      group_id: groupId,
      kind: 'group_board',
      title: input.title,
      body: input.body,
    });
    return presentThread(thread);
  }

  // ---------- Cấu hình thảo luận của trường (Ban Giám hiệu): giờ mở (GD-144, mặc định không giới hạn), từ ngữ lọc

  private async assertLeadership(currentUser: CurrentUser) {
    const context = await this.learning.context(currentUser);
    if (!(context.canDecide || (context.canView && context.canApprove))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ Ban Giám hiệu cấu hình thảo luận của trường');
    }
  }

  async discussionConfig(currentUser: CurrentUser) {
    await this.assertLeadership(currentUser);
    const { database } = await this.currentSchoolYear.require();
    return {
      open_hours: openHoursOf(await this.setting(database, 'discussion_open_hours')),
      blocked_words: await this.blockedWords(database),
    };
  }

  async saveDiscussionConfig(currentUser: CurrentUser, body: RequestBody) {
    await this.assertLeadership(currentUser);
    const { database } = await this.currentSchoolYear.require();
    const unit = await database
      .selectFrom('org_units')
      .select('id')
      .where('unit_type', '=', 'truong_chinh')
      .executeTakeFirst();
    if (!unit) {
      throw discussionRule('Chưa có Trường chính để lưu cấu hình');
    }
    const errors: FieldError[] = [];
    const hours = body?.open_hours === null || body?.open_hours === undefined ? null : openHoursOf(body.open_hours);
    if (body?.open_hours && !hours) {
      errors.push({ field: 'open_hours', message: 'Giờ mở dạng HH:MM cho ngày học hoặc cuối tuần' });
    }
    const words = Array.isArray(body?.blocked_words)
      ? [
          ...new Set(
            body.blocked_words.filter((word): word is string => typeof word === 'string').map((word) => word.trim()),
          ),
        ]
          .filter((word) => word.length >= 2 && word.length <= 50)
          .slice(0, 200)
      : [];
    throwIfErrors(errors);
    for (const [key, value] of [
      ['discussion_open_hours', hours],
      ['discussion_blocked_words', words],
    ] as const) {
      await database
        .insertInto('settings')
        .values({ org_unit_id: unit.id, key, value_type: 'text', value: JSON.stringify(value) })
        .onConflict((builder) => builder.columns(['org_unit_id', 'key']).doUpdateSet({ value: JSON.stringify(value) }))
        .execute();
    }
    return { open_hours: hours, blocked_words: words };
  }

  // ---------- Hàng chờ báo cáo vi phạm của trường

  private async reportScope(currentUser: CurrentUser, database: YearExecutor) {
    if (!currentUser.hasPermission(PERMISSION_CODES.discussionModerate)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xử lý báo cáo vi phạm');
    }
    const context = await this.learning.context(currentUser);
    if (context.canDecide || (context.canView && context.canApprove)) return null;
    const classes = await database
      .selectFrom('class_staff_assignments')
      .select('class_id')
      .where('staff_user_id', '=', currentUser.id)
      .where('assignment_role', '=', 'homeroom')
      .where('status', '=', 'active')
      .execute();
    return classes.map((row) => row.class_id);
  }

  private async threadClass(database: YearExecutor, thread: ThreadRow): Promise<string | null> {
    if (thread.space_id) {
      const space = await database
        .selectFrom('course_spaces')
        .select('class_id')
        .where('id', '=', thread.space_id)
        .executeTakeFirst();
      return space?.class_id ?? null;
    }
    const group = await database
      .selectFrom('child_groups')
      .select('class_id')
      .where('id', '=', thread.group_id ?? '')
      .executeTakeFirst();
    return group?.class_id ?? null;
  }

  async reports(currentUser: CurrentUser, status: string | undefined) {
    const { database } = await this.currentSchoolYear.require();
    const classIds = await this.reportScope(currentUser, database);
    const rows = await database
      .selectFrom('discussion_reports')
      .innerJoin('discussion_threads', 'discussion_threads.id', 'discussion_reports.thread_id')
      .leftJoin('discussion_posts', 'discussion_posts.id', 'discussion_reports.post_id')
      .select([
        'discussion_reports.id',
        'discussion_reports.thread_id',
        'discussion_reports.post_id',
        'discussion_reports.source',
        'discussion_reports.reason',
        'discussion_reports.reporter_kind',
        'discussion_reports.status',
        'discussion_reports.due_at',
        'discussion_reports.resolution',
        'discussion_reports.created_at',
        'discussion_threads.title as thread_title',
        'discussion_threads.body as thread_body',
        'discussion_threads.author_name as thread_author',
        'discussion_threads.author_child_id as thread_child_id',
        'discussion_posts.body as post_body',
        'discussion_posts.author_name as post_author',
        'discussion_posts.author_child_id as post_child_id',
      ])
      .where('discussion_reports.status', '=', status === 'closed' ? 'resolved' : 'open')
      .orderBy('discussion_reports.due_at')
      .limit(200)
      .execute();
    const now = this.clock.now();
    const visible = [];
    for (const row of rows) {
      if (classIds !== null) {
        const thread = await this.findThread(database, row.thread_id);
        const classId = await this.threadClass(database, thread);
        if (!classId || !classIds.includes(classId)) continue;
      }
      visible.push({ ...row, overdue: row.status === 'open' && row.due_at < now });
    }
    return visible;
  }

  // Xử lý báo cáo: đóng (đã xử lý hoặc bỏ qua) kèm ghi chú; có thể ẩn nội dung bị báo cáo và tạm khóa quyền viết của người viết
  async resolveReport(currentUser: CurrentUser, reportId: string, body: RequestBody) {
    const { database } = await this.currentSchoolYear.require();
    const classIds = await this.reportScope(currentUser, database);
    const report = await database
      .selectFrom('discussion_reports')
      .selectAll()
      .where('id', '=', reportId)
      .executeTakeFirst();
    if (!report) throw notFoundError('Không tìm thấy báo cáo', 'discussion_report');
    const thread = await this.findThread(database, report.thread_id);
    if (classIds !== null) {
      const classId = await this.threadClass(database, thread);
      if (!classId || !classIds.includes(classId)) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Báo cáo không thuộc lớp bạn chủ nhiệm');
      }
    }
    const errors: FieldError[] = [];
    const status = body?.status === 'dismissed' ? 'dismissed' : body?.status === 'resolved' ? 'resolved' : null;
    if (!status) errors.push({ field: 'status', message: 'Kết quả là resolved hoặc dismissed' });
    const resolution = readText(body, 'resolution', 1000, errors);
    const banDays = body?.ban_days ?? null;
    if (
      banDays !== null &&
      (typeof banDays !== 'number' || !Number.isInteger(banDays) || banDays < 1 || banDays > MAX_BAN_DAYS)
    ) {
      errors.push({ field: 'ban_days', message: `Tạm khóa từ 1 đến ${MAX_BAN_DAYS} ngày` });
    }
    throwIfErrors(errors);
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('discussion_reports')
        .set({
          status: status as 'resolved' | 'dismissed',
          resolution,
          resolved_by: currentUser.id,
          resolved_by_name: currentUser.description.full_name,
          resolved_at: now,
        })
        .where('id', '=', report.id)
        .execute();
      if (body?.hide === true) {
        const values = { hidden_at: now, hidden_by: currentUser.id };
        if (report.post_id) {
          await transaction.updateTable('discussion_posts').set(values).where('id', '=', report.post_id).execute();
        } else {
          await transaction.updateTable('discussion_threads').set(values).where('id', '=', report.thread_id).execute();
        }
      }
      if (banDays !== null) {
        const post = report.post_id
          ? await transaction
              .selectFrom('discussion_posts')
              .select('author_child_id')
              .where('id', '=', report.post_id)
              .executeTakeFirst()
          : undefined;
        const childId = post ? post.author_child_id : thread.author_child_id;
        if (!childId) {
          throw discussionRule('Người viết không phải học sinh, không tạm khóa được');
        }
        await transaction
          .insertInto('discussion_write_bans')
          .values({
            child_id: childId,
            until: new Date(now.getTime() + (banDays as number) * 86_400_000),
            reason: resolution,
            report_id: report.id,
            created_by: currentUser.id,
            created_by_name: currentUser.description.full_name,
          })
          .execute();
      }
    });
    return { id: report.id, status };
  }

  // ---------- Học sinh

  private async student(currentUser: CurrentUser) {
    const { database, childId } = await this.learning.studentContext(currentUser);
    const child = await database
      .selectFrom('children')
      .select('full_name')
      .where('id', '=', childId)
      .executeTakeFirstOrThrow();
    const author: Author = { userId: currentUser.id, name: child.full_name, kind: 'student', childId };
    return { database, childId, author };
  }

  private async studentSpace(database: YearExecutor, childId: string, spaceId: string) {
    const learning = await this.learning.learningOfChild(database, childId);
    const space = learning.spaces.find((row) => row.id === spaceId);
    if (!space) {
      throw notFoundError('Không tìm thấy lớp học trực tuyến của em', 'course_space');
    }
    return space;
  }

  // Chủ đề học sinh mở được: chủ đề của lớp em học (chưa ẩn, câu hỏi riêng chỉ của em) hoặc của nhóm em là thành viên
  private async studentThreadAccess(database: YearExecutor, childId: string, threadId: string) {
    const thread = await this.findThread(database, threadId);
    if (thread.space_id) {
      await this.studentSpace(database, childId, thread.space_id);
    } else {
      await this.assertMember(database, thread.group_id ?? '', childId);
    }
    if (!studentCanSee(thread, childId)) {
      throw notFoundError('Không tìm thấy chủ đề', 'discussion_thread');
    }
    return thread;
  }

  async studentThreads(currentUser: CurrentUser, spaceId: string, kind: string | undefined) {
    const { database, childId } = await this.student(currentUser);
    await this.studentSpace(database, childId, spaceId);
    let query = database
      .selectFrom('discussion_threads')
      .selectAll()
      .where('space_id', '=', spaceId)
      .where('hidden_at', 'is', null);
    if (kind) query = query.where('kind', '=', kind as ThreadRow['kind']);
    const rows = await query.orderBy('last_post_at', 'desc').limit(200).execute();
    const settings = await database
      .selectFrom('discussion_space_settings')
      .select('students_can_post_topics')
      .where('space_id', '=', spaceId)
      .executeTakeFirst();
    return {
      threads: rows.filter((thread) => studentCanSee(thread, childId)).map(presentThread),
      can_post_topics: settings?.students_can_post_topics ?? false,
      open_now: isOpenNow(openHoursOf(await this.setting(database, 'discussion_open_hours')), this.clock.now()),
    };
  }

  // Học sinh hỏi (câu hỏi, có thể riêng với giáo viên) hoặc mở chủ đề diễn đàn khi giáo viên cho; không đăng thông báo
  async studentCreateThread(currentUser: CurrentUser, spaceId: string, body: RequestBody) {
    const { database, childId, author } = await this.student(currentUser);
    await this.studentSpace(database, childId, spaceId);
    const input = this.parseThread(body, ['forum', 'question']);
    if (input.kind === 'forum') {
      const settings = await database
        .selectFrom('discussion_space_settings')
        .select('students_can_post_topics')
        .where('space_id', '=', spaceId)
        .executeTakeFirst();
      if (!settings?.students_can_post_topics) {
        throw discussionRule('Giáo viên chưa cho học sinh mở chủ đề ở diễn đàn lớp');
      }
    }
    await this.assertStudentCanWrite(database, childId);
    const { thread, masked } = await this.insertThread(database, author, {
      scope: 'course_space',
      space_id: spaceId,
      group_id: null,
      ...input,
      private: input.kind === 'question' ? input.private : false,
    });
    return { ...presentThread(thread), masked };
  }

  async studentThread(currentUser: CurrentUser, threadId: string) {
    const { database, childId } = await this.student(currentUser);
    const thread = await this.studentThreadAccess(database, childId, threadId);
    return { thread: presentThread(thread), posts: await this.posts(database, thread.id, false) };
  }

  async studentReply(currentUser: CurrentUser, threadId: string, body: RequestBody) {
    const { database, childId, author } = await this.student(currentUser);
    const thread = await this.studentThreadAccess(database, childId, threadId);
    if (thread.kind === 'announcement') {
      throw discussionRule('Thông báo lớp không có trả lời');
    }
    if (thread.private && thread.author_child_id !== childId) {
      throw discussionRule('Câu hỏi riêng chỉ người hỏi và giáo viên trả lời');
    }
    const errors: FieldError[] = [];
    const text = readText(body, 'body', MAX_BODY, errors);
    throwIfErrors(errors);
    await this.assertStudentCanWrite(database, childId);
    return this.insertPost(database, thread, author, text);
  }

  // Học sinh xóa trả lời của mình là ẩn: nội dung vẫn lưu cho giáo viên, người xử lý
  async studentHidePost(currentUser: CurrentUser, postId: string) {
    const { database, childId } = await this.student(currentUser);
    const result = await database
      .updateTable('discussion_posts')
      .set({ hidden_at: this.clock.now(), hidden_by: currentUser.id })
      .where('id', '=', postId)
      .where('author_child_id', '=', childId)
      .where('hidden_at', 'is', null)
      .executeTakeFirst();
    if (Number(result.numUpdatedRows) === 0) {
      throw notFoundError('Không tìm thấy trả lời của em', 'discussion_post');
    }
    return { id: postId, hidden: true };
  }

  private async report(
    database: YearExecutor,
    reporter: { userId: string; kind: 'student' | 'guardian' | 'teacher' | 'staff' },
    thread: ThreadRow,
    body: RequestBody,
  ) {
    const errors: FieldError[] = [];
    const reason = readText(body, 'reason', 500, errors);
    throwIfErrors(errors);
    const postId = isUuid(body?.post_id) ? body.post_id : null;
    if (postId) {
      const post = await database
        .selectFrom('discussion_posts')
        .select('id')
        .where('id', '=', postId)
        .where('thread_id', '=', thread.id)
        .executeTakeFirst();
      if (!post) throw discussionRule('Trả lời không thuộc chủ đề này');
    }
    return database
      .insertInto('discussion_reports')
      .values({
        thread_id: thread.id,
        post_id: postId,
        source: 'report',
        reason,
        reporter_user_id: reporter.userId,
        reporter_kind: reporter.kind,
        due_at: new Date(this.clock.now().getTime() + REPORT_DUE_DAYS * 86_400_000),
      })
      .returning(['id', 'status', 'due_at'])
      .executeTakeFirstOrThrow();
  }

  async studentReport(currentUser: CurrentUser, threadId: string, body: RequestBody) {
    const { database, childId } = await this.student(currentUser);
    const thread = await this.studentThreadAccess(database, childId, threadId);
    return this.report(database, { userId: currentUser.id, kind: 'student' }, thread, body);
  }

  async staffReport(currentUser: CurrentUser, threadId: string, body: RequestBody) {
    const { database, thread } = await this.staffThread(currentUser, threadId);
    return this.report(database, { userId: currentUser.id, kind: 'teacher' }, thread, body);
  }

  private async assertMember(database: YearExecutor, groupId: string, childId: string) {
    const group = await this.groupOf(database, groupId);
    const member = await database
      .selectFrom('child_group_members')
      .select('child_id')
      .where('group_id', '=', groupId)
      .where('child_id', '=', childId)
      .executeTakeFirst();
    if (!member || group.set_status !== 'active') {
      throw notFoundError('Không tìm thấy nhóm của em', 'child_group');
    }
    return group;
  }

  async studentGroups(currentUser: CurrentUser) {
    const { database, childId } = await this.student(currentUser);
    return database
      .selectFrom('child_group_members')
      .innerJoin('child_groups', 'child_groups.id', 'child_group_members.group_id')
      .innerJoin('group_sets', 'group_sets.id', 'child_groups.group_set_id')
      .select([
        'child_groups.id',
        'child_groups.name',
        'group_sets.name as group_set_name',
        'child_groups.leader_child_id',
      ])
      .where('child_group_members.child_id', '=', childId)
      .where('group_sets.status', '=', 'active')
      .orderBy('group_sets.created_at', 'desc')
      .execute();
  }

  async studentGroup(currentUser: CurrentUser, groupId: string) {
    const { database, childId } = await this.student(currentUser);
    const group = await this.assertMember(database, groupId, childId);
    return {
      group: {
        id: group.id,
        name: group.name,
        group_set_name: group.group_set_name,
        leader_child_id: group.leader_child_id,
      },
      open_now: isOpenNow(openHoursOf(await this.setting(database, 'discussion_open_hours')), this.clock.now()),
      ...(await this.workspace(database, groupId, { discussions: true, notes: true })),
    };
  }

  async studentGroupThread(currentUser: CurrentUser, groupId: string, body: RequestBody) {
    const { database, childId, author } = await this.student(currentUser);
    await this.assertMember(database, groupId, childId);
    const input = this.parseThread({ ...body, kind: 'group_board' }, ['group_board']);
    await this.assertStudentCanWrite(database, childId);
    const { thread, masked } = await this.insertThread(database, author, {
      scope: 'group',
      space_id: null,
      group_id: groupId,
      kind: 'group_board',
      title: input.title,
      body: input.body,
    });
    return { ...presentThread(thread), masked };
  }

  async studentAddTask(currentUser: CurrentUser, groupId: string, body: RequestBody) {
    const { database, childId, author } = await this.student(currentUser);
    await this.assertMember(database, groupId, childId);
    await this.assertStudentCanWrite(database, childId);
    const errors: FieldError[] = [];
    const title = (await this.filtered(database, author, readText(body, 'title', MAX_TITLE, errors))).text;
    const assignee = isUuid(body?.assignee_child_id) ? body.assignee_child_id : null;
    const due = typeof body?.due_on === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.due_on) ? body.due_on : null;
    throwIfErrors(errors);
    if (assignee) {
      const member = await database
        .selectFrom('child_group_members')
        .select('child_id')
        .where('group_id', '=', groupId)
        .where('child_id', '=', assignee)
        .executeTakeFirst();
      if (!member) throw discussionRule('Người làm phải là thành viên của nhóm');
    }
    return database
      .insertInto('group_tasks')
      .values({
        group_id: groupId,
        title,
        assignee_child_id: assignee,
        due_on: due,
        created_by: currentUser.id,
        created_by_name: author.name,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async studentUpdateTask(currentUser: CurrentUser, taskId: string, body: RequestBody) {
    const { database, childId } = await this.student(currentUser);
    const task = await database.selectFrom('group_tasks').selectAll().where('id', '=', taskId).executeTakeFirst();
    if (!task) throw notFoundError('Không tìm thấy việc', 'group_task');
    await this.assertMember(database, task.group_id, childId);
    await this.assertStudentCanWrite(database, childId);
    const status = body?.status;
    if (status !== 'todo' && status !== 'doing' && status !== 'done') {
      throw discussionRule('Trạng thái là todo, doing hoặc done', [
        { field: 'status', message: 'Trạng thái không hợp lệ' },
      ]);
    }
    return database
      .updateTable('group_tasks')
      .set({ status, updated_at: this.clock.now() })
      .where('id', '=', taskId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  // Ghi chú chung có phiên bản: gửi số phiên bản đang sửa; khác bản mới nhất thì báo tải lại (bạn khác vừa sửa)
  async studentSaveNote(currentUser: CurrentUser, groupId: string, body: RequestBody) {
    const { database, childId, author } = await this.student(currentUser);
    await this.assertMember(database, groupId, childId);
    await this.assertStudentCanWrite(database, childId);
    const content = typeof body?.content === 'string' ? body.content : '';
    if (content.length > MAX_NOTE) {
      throw discussionRule(`Ghi chú tối đa ${MAX_NOTE} ký tự`, [{ field: 'content', message: 'Quá dài' }]);
    }
    const latest = await database
      .selectFrom('group_notes')
      .select('version')
      .where('group_id', '=', groupId)
      .orderBy('version', 'desc')
      .executeTakeFirst();
    const current = latest?.version ?? 0;
    if (typeof body?.version === 'number' && body.version !== current) {
      throw new ApplicationError('ERR_CONFLICT', 'Ghi chú vừa được bạn cùng nhóm sửa, tải lại để xem bản mới nhất');
    }
    const masked = (await this.filtered(database, author, content)).text;
    return database
      .insertInto('group_notes')
      .values({
        group_id: groupId,
        version: current + 1,
        content: masked,
        edited_by: currentUser.id,
        edited_by_name: author.name,
      })
      .returning(['version', 'content', 'edited_by_name', 'created_at'])
      .executeTakeFirstOrThrow();
  }

  async studentUploadFile(currentUser: CurrentUser, groupId: string, part: UploadedPart | undefined) {
    const { database, childId, author } = await this.student(currentUser);
    await this.assertMember(database, groupId, childId);
    await this.assertStudentCanWrite(database, childId);
    if (!part) throw discussionRule('Chưa chọn tệp', [{ field: 'file', message: 'Chọn tệp' }]);
    const type = FILE_TYPES.find((entry) => entry.bytes.every((byte, index) => part.buffer[index] === byte));
    if (!type || part.buffer.length > GROUP_FILE_BYTES) {
      throw discussionRule('Chỉ nhận ảnh JPEG, PNG hoặc tệp PDF tối đa 10 MB', [
        { field: 'file', message: 'Tệp không nhận' },
      ]);
    }
    const key = storageKey('group-files', groupId, randomUUID());
    await this.fileStorage.put(key, part.buffer, type.contentType);
    return database
      .insertInto('group_files')
      .values({
        group_id: groupId,
        file_name: decodeFileName(part).slice(0, 200),
        content_type: type.contentType,
        size_bytes: part.buffer.length,
        storage_key: key,
        uploaded_by: currentUser.id,
        uploaded_by_name: author.name,
      })
      .returning(['id', 'file_name', 'content_type', 'size_bytes', 'created_at'])
      .executeTakeFirstOrThrow();
  }

  async groupFile(currentUser: CurrentUser, fileId: string, as: 'student' | 'staff') {
    const { database } = await this.currentSchoolYear.require();
    const file = await database.selectFrom('group_files').selectAll().where('id', '=', fileId).executeTakeFirst();
    if (!file || file.hidden_at !== null) throw notFoundError('Không tìm thấy tệp', 'group_file');
    if (as === 'student') {
      const { childId } = await this.student(currentUser);
      await this.assertMember(database, file.group_id, childId);
    } else {
      await this.groupStaff(currentUser, database, file.group_id);
    }
    return { file, body: await this.fileStorage.get(file.storage_key) };
  }

  // ---------- Lịch học tập

  private async calendar(database: YearExecutor, childId: string, fromValue: unknown) {
    const from = calendarStart(fromValue, this.clock.now());
    const enrollment = await database
      .selectFrom('class_enrollments')
      .innerJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select(['classes.id', 'classes.school_level'])
      .where('class_enrollments.child_id', '=', childId)
      .where('class_enrollments.is_current', '=', true)
      .executeTakeFirst();
    const view = enrollment ? await this.timetables.view({ classId: enrollment.id, date: from }) : null;
    const slots = view && enrollment ? (view.slots[enrollment.school_level] ?? []) : [];
    const learning = await this.learning.learningOfChild(database, childId);
    return {
      from,
      items: weekCalendar({
        from,
        lessons: (view?.lessons ?? [])
          .filter((lesson) => lesson.group_no === 0)
          .map((lesson) => ({
            weekday: lesson.weekday,
            period_no: lesson.period_no,
            subject_name: lesson.subject_name,
            start_time: slots.find((slot) => slot.period_no === lesson.period_no)?.start_time ?? null,
          })),
        activities: learning.spaces.flatMap((space) =>
          space.sections.flatMap((section) =>
            section.activities.map((activity) => ({
              title: activity.title,
              space: space.title,
              due_at: activity.due_at ? new Date(activity.due_at) : null,
              opens_at: activity.opens_at ? new Date(activity.opens_at) : null,
            })),
          ),
        ),
      }),
    };
  }

  async studentCalendar(currentUser: CurrentUser, from: unknown) {
    const { database, childId } = await this.student(currentUser);
    return this.calendar(database, childId, from);
  }

  // ---------- Phụ huynh

  async childCalendar(currentUser: CurrentUser, childId: string, from: unknown) {
    const { database } = await this.currentSchoolYear.require();
    await this.learning.guardianOrStaff(currentUser, database, childId);
    return this.calendar(database, childId, from);
  }

  async childAnnouncements(currentUser: CurrentUser, childId: string) {
    const { database } = await this.currentSchoolYear.require();
    await this.learning.guardianOrStaff(currentUser, database, childId);
    const learning = await this.learning.learningOfChild(database, childId);
    const spaceIds = learning.spaces.map((space) => space.id);
    if (spaceIds.length === 0) return [];
    const rows = await database
      .selectFrom('discussion_threads')
      .selectAll()
      .where('space_id', 'in', spaceIds)
      .where('kind', '=', 'announcement')
      .where('hidden_at', 'is', null)
      .orderBy('created_at', 'desc')
      .limit(50)
      .execute();
    const titles = new Map(learning.spaces.map((space) => [space.id, space.title]));
    return rows.map((row) => ({ ...presentThread(row), space_title: titles.get(row.space_id ?? '') ?? '' }));
  }

  // Không gian nhóm của con theo GD-145: Tiểu học đọc toàn bộ; THCS, THPT thấy thành viên, việc, hạn, tệp, không đọc thảo luận
  async childGroups(currentUser: CurrentUser, childId: string) {
    const { database } = await this.currentSchoolYear.require();
    await this.learning.guardianOrStaff(currentUser, database, childId);
    const groups = await database
      .selectFrom('child_group_members')
      .innerJoin('child_groups', 'child_groups.id', 'child_group_members.group_id')
      .innerJoin('group_sets', 'group_sets.id', 'child_groups.group_set_id')
      .innerJoin('classes', 'classes.id', 'child_groups.class_id')
      .select(['child_groups.id', 'child_groups.name', 'group_sets.name as group_set_name', 'classes.school_level'])
      .where('child_group_members.child_id', '=', childId)
      .where('group_sets.status', '=', 'active')
      .execute();
    const result = [];
    for (const group of groups) {
      const view = guardianGroupView(group.school_level);
      result.push({ group, view, ...(await this.workspace(database, group.id, view)) });
    }
    return result;
  }
}
