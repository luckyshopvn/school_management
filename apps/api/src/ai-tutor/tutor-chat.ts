import { Inject, Injectable, Logger, OnApplicationBootstrap, Optional } from '@nestjs/common';
import {
  readPlatformAiKey,
  readPlatformAiSettings,
  type SchoolYearDatabase,
  type SystemDatabase,
  type TenancyRuntime,
} from '@school-management/database';
import {
  ApplicationError,
  Clock,
  currentTenant,
  isMultiTenantMode,
  ruleViolationError,
  validationError,
} from '@school-management/server';
import { sql, type Kysely, type Selectable } from 'kysely';
import { randomUUID } from 'node:crypto';
import { AI_PROVIDERS } from '../ai-assistant/ai-assistant.js';
import { buildNameIndex, PERSONAL_DATA_LABELS, scanPersonalData } from '../ai-assistant/ai-prompt.js';
import {
  AiProviderError,
  type AiCompletion,
  type AiConversationTurn,
  type AiPromptImage,
  type AiProvider,
  type AiProviderRegistry,
  type AiProviderSettings,
} from '../ai-assistant/ai-provider.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { JobScheduler } from '../common/job-scheduler.js';
import { TENANCY_RUNTIME } from '../common/configuration.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { storageKey } from '../common/resource-names.js';
import { isUuid, notFoundError, type RequestBody } from '../common/request-fields.js';
import { studentChildOf } from '../common/student-account.js';
import { FileStorage } from '../files/file-storage.js';
import { aiTutorAccess, type AiTutorAccess } from './ai-tutor-access.js';
import { activeExamFor, openBlockedAssignmentFor, quietWindowOf } from './ai-tutor-locks.js';
import { AiTutorParentRequestService } from './parent-requests.js';
import { AiTutorSafetyFlagService } from './safety-flags.js';
import { vietnamMonthOf, type AiTutorSchoolLevel } from './ai-tutor-rules.js';
import {
  aiTutorTurnBalance,
  captureAiTutorTurn,
  holdAiTutorTurn,
  releaseAiTutorTurn,
  releaseStaleAiTutorHolds,
} from './ai-tutor-turns.js';
import { asAiTutorLevel } from './school-sales-rules.js';
import {
  attemptsOf,
  buildRewritePrompt,
  buildTutorSystemPrompt,
  HISTORY_MESSAGES,
  IMAGE_PERSONAL_DATA_REPLY,
  isSolutionUnlocked,
  isUnsafeReply,
  moderateStudentText,
  NO_ANSWER_REPLY,
  parseRewrite,
  parseTutorReply,
  QUESTION_MAX_LENGTH,
  REFUSAL_REPLY,
  REPORT_NOTE_MAX_LENGTH,
  retentionCutoff,
  revealsFinalAnswer,
  SAFETY_REPLIES,
  STEP_LABELS,
  TUTOR_MAX_TOKENS,
  TUTOR_RULES,
  type StudentModeration,
  type TutorMode,
  type TutorStep,
} from './tutor-chat-rules.js';
import {
  checkTutorImages,
  IMAGE_DELETED_LABEL,
  IMAGE_MAX_BYTES,
  IMAGE_MAX_COUNT,
  IMAGE_RETENTION_DAYS,
  imageRetentionCutoff,
  type IncomingImage,
} from './tutor-images.js';

// Trò chuyện bằng chữ của học sinh với gia sư AI (YCTD-383 lát L2; bản mẫu MH-596, MH-597; quyết định của Eric ngày 2026-10-30):
// - chỉ dùng khóa AI của nền tảng (Q8); token ghi trên câu trả lời, việc nền tổng hợp theo nguồn gói (`tutor-usage.ts`);
// - mỗi câu hỏi là một lượt: tạm giữ trước khi gọi, trừ sau khi nhà cung cấp trả lời, hoàn khi lỗi, khi có dữ liệu cá nhân, khi bị chặn
//   bởi kiểm duyệt (câu hỏi hoặc câu trả lời), khi ngoài học tập;
// - lời nhắc cố định theo cấp, khối, môn; gợi ý theo thang; lời giải đầy đủ chỉ mở sau hai lượt tự làm; câu trả lời lộ đáp án quá sớm thì
//   viết lại, viết lại vẫn lộ thì thay bằng câu cố định;
// - câu có dấu hiệu tự hại hoặc bị bắt nạt: trả lời theo mẫu có số 111, không gửi nhà cung cấp, ghi cờ cảnh báo (lát L3 báo giáo viên
//   chủ nhiệm);
// - lịch sử giữ 12 tháng: em xem lại hội thoại của mình; cha mẹ chỉ xem chủ đề và số lượt; giáo viên không có điểm cuối nào để xem.
// Lát L4 (ảnh bài tập, Q5): chỉ gói tháng đang dùng có quyền gửi ảnh (gói Nâng cao) mới gửi được, kiểm trước khi giữ lượt; ảnh JPEG, PNG,
// WebP, tối đa 3 ảnh mỗi câu, mỗi ảnh tối đa 4 MB, bỏ siêu dữ liệu trước khi lưu và gửi đi; gia sư chép đề từ ảnh, đề chép được quét dữ
// liệu cá nhân và kiểm duyệt như câu chữ; ảnh có thông tin cá nhân thì không lưu ảnh, hoàn lượt, nhắc em; ảnh chỉ lưu khi câu được trả lời
// bình thường, ở kho tệp của trường; việc nền xóa ảnh sau 30 ngày. Chỉ em xem lại ảnh của mình; cha mẹ, giáo viên không có điểm cuối xem ảnh.
// Hội thoại ở cơ sở dữ liệu hệ thống của trường; con, lớp, môn, người giám hộ ở cơ sở dữ liệu năm học đang dùng
type SystemClient = Kysely<SystemDatabase>;
type MessageRow = Selectable<SystemDatabase['ai_tutor_messages']>;
type ConversationRow = Selectable<SystemDatabase['ai_tutor_conversations']>;
type ImageRow = Selectable<SystemDatabase['ai_tutor_message_images']>;

const MAINTENANCE_JOB_SECONDS = 600;

interface StudentContext {
  database: Kysely<SchoolYearDatabase>;
  childId: string;
  schoolLevel: AiTutorSchoolLevel | null;
  gradeLevelCode: string;
  className: string | null;
  classId: string | null;
  readOnly: boolean;
}

interface Resolved {
  provider: AiProvider;
  credentials: AiProviderSettings;
}

interface Outcome {
  studentModeration: StudentModeration | null;
  tutorBody: string;
  step: TutorStep;
  topic: string | null;
  completion: { model: string; inputTokens: number; outputTokens: number } | null;
  capture: boolean;
  releaseReason: string | null;
  // Đề chép từ ảnh (lát L4), lưu kèm câu hỏi khi câu được trả lời bình thường
  imageText: string | null;
}

interface TutorRequest {
  mode: TutorMode;
  conversationId: string | null;
  subjectCode: string;
  text: string;
  images: AiPromptImage[];
}

function messageView(row: MessageRow, images: readonly ImageRow[] = []) {
  return {
    id: row.id,
    role: row.role,
    body: row.body,
    image_text: row.image_text,
    images: images.map((image) => ({
      id: image.id,
      content_type: image.content_type,
      deleted: image.deleted_at !== null,
      deleted_label: image.deleted_at !== null ? IMAGE_DELETED_LABEL : null,
    })),
    step: row.step,
    step_label: row.step ? STEP_LABELS[row.step] : null,
    request_kind: row.request_kind,
    blocked: row.moderation !== null,
    reported: row.reported_at !== null,
    created_at: row.created_at,
  };
}

function conversationView(row: ConversationRow) {
  return {
    id: row.id,
    subject_code: row.subject_code,
    subject_name: row.subject_name,
    topic: row.topic,
    created_at: row.created_at,
    last_message_at: row.last_message_at,
  };
}

const NO_TURNS_MESSAGE = 'Em đã dùng hết lượt hỏi. Nhờ cha mẹ mua thêm lượt hoặc gói tháng trong ứng dụng phụ huynh.';
const IMAGES_NOT_ALLOWED_MESSAGE =
  'Gửi ảnh bài tập chỉ có ở gói Nâng cao. Em gõ đề bài bằng chữ, hoặc nhờ cha mẹ nâng gói trong ứng dụng phụ huynh; lượt hỏi không bị trừ';
const DEFAULT_IMAGE_QUESTION = 'Em gửi ảnh bài tập, nhờ gia sư gợi ý.';
const IMAGE_FOLDER = 'ai-tutor-images';
const IMAGE_PURGE_BATCH = 500;

@Injectable()
export class AiTutorChatService {
  private readonly logger = new Logger(AiTutorChatService.name);

  constructor(
    private readonly databases: Databases,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly clock: Clock,
    @Inject(AI_PROVIDERS) private readonly providers: AiProviderRegistry,
    private readonly safetyFlags: AiTutorSafetyFlagService,
    private readonly parentRequests: AiTutorParentRequestService,
    private readonly fileStorage: FileStorage,
    @Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null = null,
  ) {}

  private get system(): SystemClient {
    return this.databases.system;
  }

  // ---------- Học sinh, khóa, nhà cung cấp

  private async student(currentUser: CurrentUser): Promise<StudentContext> {
    const { database } = await this.currentSchoolYear.require();
    const account = await studentChildOf(database, currentUser);
    if (!account || account.status !== 'active' || account.deleted_at !== null) {
      throw new ApplicationError(
        'ERR_FORBIDDEN',
        'Tài khoản chưa nối với học sinh đang học, nhờ nhà trường kiểm tra lại',
      );
    }
    const enrollment = await database
      .selectFrom('class_enrollments')
      .innerJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select(['classes.id', 'classes.name', 'classes.school_level', 'classes.grade_level'])
      .where('class_enrollments.child_id', '=', account.id)
      .where('class_enrollments.is_current', '=', true)
      .executeTakeFirst();
    const readOnly = currentUser.supportViewChildId !== null;
    return {
      database,
      childId: account.id,
      schoolLevel: asAiTutorLevel(enrollment?.school_level),
      gradeLevelCode: enrollment?.grade_level ?? '',
      className: enrollment?.name ?? null,
      classId: enrollment?.id ?? null,
      readOnly,
    };
  }

  // Khóa của lát L3 kiểm ở máy chủ mỗi lần xem trang và trước khi giữ lượt (câu bị khóa không trừ lượt)
  private async accessOf(context: StudentContext, now: Date): Promise<AiTutorAccess> {
    if (context.readOnly) {
      return aiTutorAccess({ readOnly: true, exam: null, blockedAssignment: null, quietStart: '', quietEnd: '', now });
    }
    const [exam, blockedAssignment, quiet] = await Promise.all([
      activeExamFor(context.database, { childId: context.childId, classId: context.classId }, now),
      openBlockedAssignmentFor(context.database, context.childId, now),
      quietWindowOf(this.system),
    ]);
    return aiTutorAccess({
      readOnly: false,
      exam,
      blockedAssignment,
      quietStart: quiet.start,
      quietEnd: quiet.end,
      now,
    });
  }

  // Chỉ khóa AI của nền tảng (Q8): thiếu ngữ cảnh nền tảng, khóa chưa bật hoặc nhà cung cấp chưa hỗ trợ thì không dùng được
  private async resolve(): Promise<Resolved | { reason: string }> {
    const tenant = currentTenant();
    if (!this.tenancy || !tenant) {
      return { reason: 'Gia sư AI chỉ có ở nền tảng nhiều trường' };
    }
    const platform = this.tenancy.platform;
    const [key, settings] = await Promise.all([
      readPlatformAiKey(platform, this.tenancy.configuration.masterKey),
      readPlatformAiSettings(platform),
    ]);
    if (!key?.enabled) {
      return { reason: 'Gia sư AI đang tạm nghỉ, em quay lại sau nhé' };
    }
    const provider = this.providers.get(settings.provider);
    if (!provider) {
      return { reason: 'Gia sư AI đang tạm nghỉ, em quay lại sau nhé' };
    }
    return { provider, credentials: { apiKey: key.apiKey, model: settings.model, endpoint: settings.endpoint } };
  }

  private async subjects(context: StudentContext) {
    if (!context.schoolLevel) {
      return [];
    }
    return context.database
      .selectFrom('subjects')
      .select(['code', 'name'])
      .where('school_level', '=', context.schoolLevel)
      .where('status', '=', 'active')
      .orderBy('order_no')
      .orderBy('name')
      .execute();
  }

  private async balance(childId: string, now: Date) {
    const [remaining, rows] = await Promise.all([
      aiTutorTurnBalance(this.system, childId, now),
      this.system
        .selectFrom('ai_tutor_subscriptions')
        .select(['turns', 'valid_from', 'valid_until'])
        .where('child_id', '=', childId)
        .where('status', '=', 'active')
        .where('valid_until', '>', now)
        .execute(),
    ]);
    const current = rows.filter(
      (row) => row.valid_from !== null && row.valid_from.getTime() <= now.getTime() && row.valid_until !== null,
    );
    return {
      monthly: remaining.monthly,
      top_up: remaining.topUp,
      remaining: remaining.monthly + remaining.topUp,
      total: current.reduce((sum, row) => sum + row.turns, 0),
      subscribed: current.length > 0,
    };
  }

  // Gói Nâng cao: gói tháng đang dùng có quyền gửi ảnh (gói lượt dùng quyền của gói tháng, Q5)
  private async imagesAllowed(childId: string, now: Date): Promise<boolean> {
    const row = await this.system
      .selectFrom('ai_tutor_subscriptions')
      .select('id')
      .where('child_id', '=', childId)
      .where('status', '=', 'active')
      .where('plan_kind', '=', 'monthly')
      .where('allow_images', '=', true)
      .where('valid_from', '<=', now)
      .where('valid_until', '>', now)
      .executeTakeFirst();
    return row !== undefined;
  }

  // ---------- Trang của em (MH-596, MH-597)

  async overview(currentUser: CurrentUser) {
    const context = await this.student(currentUser);
    const now = this.clock.now();
    const [balance, subjects, resolved, access, imagesAllowed] = await Promise.all([
      this.balance(context.childId, now),
      this.subjects(context),
      this.resolve(),
      this.accessOf(context, now),
      this.imagesAllowed(context.childId, now),
    ]);
    // Phiên xem hỗ trợ không thấy hội thoại của em (riêng tư của học sinh)
    const conversations = context.readOnly
      ? []
      : await this.system
          .selectFrom('ai_tutor_conversations')
          .selectAll()
          .where('child_id', '=', context.childId)
          .orderBy('last_message_at', 'desc')
          .limit(50)
          .execute();
    const unavailable = !context.schoolLevel
      ? 'Gia sư AI dành cho học sinh Tiểu học, Trung học cơ sở, Trung học phổ thông'
      : 'reason' in resolved
        ? resolved.reason
        : null;
    // Lát L5: lời nhờ cha mẹ (MH-596); phiên xem hỗ trợ không gửi được nên không cần trạng thái
    const parentRequest =
      context.readOnly || !context.schoolLevel
        ? null
        : await this.parentRequests.state(context.database, context.childId, balance, now);
    return {
      child: {
        school_level: context.schoolLevel,
        grade_level_code: context.gradeLevelCode,
        class_name: context.className,
      },
      access,
      ready: unavailable === null,
      unavailable_reason: unavailable,
      balance: {
        monthly: balance.monthly,
        top_up: balance.top_up,
        remaining: balance.remaining,
        total: balance.total,
      },
      subscribed: balance.subscribed,
      images: {
        allowed: imagesAllowed,
        max_count: IMAGE_MAX_COUNT,
        max_bytes: IMAGE_MAX_BYTES,
        retention_days: IMAGE_RETENTION_DAYS,
      },
      subjects,
      conversations: conversations.map(conversationView),
      parent_request: parentRequest,
    };
  }

  // Lát L5: em chưa có gói hoặc hết lượt gửi lời nhờ cha mẹ mua hoặc gia hạn (BR-530)
  async requestParents(currentUser: CurrentUser) {
    const context = await this.student(currentUser);
    if (context.readOnly) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Phiên xem hỗ trợ chỉ xem, không gửi lời nhờ cha mẹ');
    }
    if (!context.schoolLevel) {
      throw ruleViolationError(
        TUTOR_RULES.turns,
        'Gia sư AI dành cho học sinh Tiểu học, Trung học cơ sở, Trung học phổ thông',
      );
    }
    const now = this.clock.now();
    const balance = await this.balance(context.childId, now);
    return this.parentRequests.send(context.database, context.childId, balance, now);
  }

  private async ownConversation(childId: string, conversationId: string): Promise<ConversationRow> {
    const row = isUuid(conversationId)
      ? await this.system
          .selectFrom('ai_tutor_conversations')
          .selectAll()
          .where('id', '=', conversationId)
          .where('child_id', '=', childId)
          .executeTakeFirst()
      : undefined;
    if (!row) {
      // Hội thoại của em khác cũng trả "không tìm thấy" để không lộ là có
      throw notFoundError('Không tìm thấy hội thoại', 'ai_tutor_conversation');
    }
    return row;
  }

  private messagesOf(conversationId: string) {
    return this.system
      .selectFrom('ai_tutor_messages')
      .selectAll()
      .where('conversation_id', '=', conversationId)
      .orderBy('created_at')
      .orderBy('role')
      .execute();
  }

  private async viewsOf(messages: readonly MessageRow[]) {
    const ids = messages.filter((row) => row.role === 'student').map((row) => row.id);
    const images =
      ids.length === 0
        ? []
        : await this.system
            .selectFrom('ai_tutor_message_images')
            .selectAll()
            .where('message_id', 'in', ids)
            .orderBy('position')
            .execute();
    return messages.map((row) =>
      messageView(
        row,
        images.filter((image) => image.message_id === row.id),
      ),
    );
  }

  private progressOf(messages: readonly MessageRow[]) {
    const facts = messages
      .filter((row) => row.role === 'student' && row.request_kind !== null)
      .map((row) => ({ requestKind: row.request_kind as 'ask' | 'solution', moderation: row.moderation }));
    return { attempts: attemptsOf(facts), solution_unlocked: isSolutionUnlocked(facts) };
  }

  async conversation(currentUser: CurrentUser, conversationId: string) {
    const context = await this.student(currentUser);
    if (context.readOnly) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Phiên xem hỗ trợ không xem hội thoại của học sinh');
    }
    const conversation = await this.ownConversation(context.childId, conversationId);
    const messages = await this.messagesOf(conversation.id);
    return {
      conversation: conversationView(conversation),
      messages: await this.viewsOf(messages),
      ...this.progressOf(messages),
    };
  }

  // Ảnh em đã gửi: chỉ chính em (không phiên xem hỗ trợ); ảnh của em khác, ảnh đã xóa trả "không tìm thấy"
  async image(currentUser: CurrentUser, imageId: string): Promise<{ contentType: string; body: Buffer }> {
    const context = await this.student(currentUser);
    if (context.readOnly) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Phiên xem hỗ trợ không xem ảnh của học sinh');
    }
    const row = isUuid(imageId)
      ? await this.system
          .selectFrom('ai_tutor_message_images')
          .innerJoin('ai_tutor_messages', 'ai_tutor_messages.id', 'ai_tutor_message_images.message_id')
          .innerJoin('ai_tutor_conversations', 'ai_tutor_conversations.id', 'ai_tutor_messages.conversation_id')
          .select(['ai_tutor_message_images.storage_key', 'ai_tutor_message_images.content_type'])
          .where('ai_tutor_message_images.id', '=', imageId)
          .where('ai_tutor_conversations.child_id', '=', context.childId)
          .executeTakeFirst()
      : undefined;
    if (!row) {
      throw notFoundError('Không tìm thấy ảnh', 'ai_tutor_image');
    }
    if (!row.storage_key) {
      throw notFoundError(IMAGE_DELETED_LABEL, 'ai_tutor_image');
    }
    return { contentType: row.content_type, body: await this.fileStorage.get(row.storage_key) };
  }

  // ---------- Gửi câu hỏi

  // Câu hỏi gửi dạng JSON (chỉ chữ) hoặc nhiều phần (chữ kèm ảnh `images`, lát L4)
  private readRequest(body: RequestBody, files: readonly IncomingImage[]): TutorRequest {
    const mode: TutorMode = body?.mode === 'solution' ? 'solution' : 'hint';
    if (body?.mode !== undefined && body.mode !== 'hint' && body.mode !== 'solution') {
      throw validationError([{ field: 'mode', message: 'Chế độ là hint hoặc solution' }]);
    }
    const conversationId =
      typeof body?.conversation_id === 'string' && body.conversation_id !== '' ? body.conversation_id : null;
    const subjectCode = typeof body?.subject_code === 'string' ? body.subject_code.trim() : '';
    let text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (mode === 'solution') {
      if (files.length > 0) {
        throw validationError([{ field: 'images', message: 'Xem lời giải đầy đủ không gửi kèm ảnh' }]);
      }
      if (!conversationId) {
        throw validationError([{ field: 'conversation_id', message: 'Chọn hội thoại để xem lời giải' }]);
      }
      return { mode, conversationId, subjectCode, text: 'Em muốn xem lời giải đầy đủ.', images: [] };
    }
    const checked = checkTutorImages(files);
    if (!checked.ok) {
      throw validationError([{ field: checked.field, message: checked.message }]);
    }
    if (!text && checked.images.length > 0) {
      text = DEFAULT_IMAGE_QUESTION;
    }
    if (!text) {
      throw validationError([{ field: 'text', message: 'Em hãy nhập câu hỏi' }]);
    }
    if (text.length > QUESTION_MAX_LENGTH) {
      throw validationError([{ field: 'text', message: `Câu hỏi tối đa ${QUESTION_MAX_LENGTH} ký tự` }]);
    }
    if (!conversationId && !subjectCode) {
      throw validationError([{ field: 'subject_code', message: 'Em hãy chọn môn' }]);
    }
    return { mode, conversationId, subjectCode, text, images: checked.images };
  }

  private async nameIndex(database: Kysely<SchoolYearDatabase>): Promise<Set<string>> {
    const [children, guardians, staff] = await Promise.all([
      database.selectFrom('children').select('full_name').execute(),
      database.selectFrom('guardians').select('full_name').execute(),
      database.selectFrom('staff').select('full_name').execute(),
    ]);
    return buildNameIndex([...children, ...guardians, ...staff].map((row) => row.full_name));
  }

  // Lượt cũ gửi kèm: chỉ các cặp câu hỏi, câu trả lời bình thường; câu bị chặn và câu trả lời theo mẫu không gửi đi
  private historyOf(messages: readonly MessageRow[]): AiConversationTurn[] {
    const turns: AiConversationTurn[] = [];
    for (let index = 0; index < messages.length - 1; index += 1) {
      const question = messages[index] as MessageRow;
      const answer = messages[index + 1] as MessageRow;
      if (
        question.role === 'student' &&
        answer.role === 'tutor' &&
        question.moderation === null &&
        answer.step !== 'refusal' &&
        answer.step !== 'safety'
      ) {
        // Ảnh không gửi lại ở lượt sau, chỉ gửi đề bài gia sư đã chép từ ảnh
        const content = question.image_text
          ? `${question.body}\n\nĐề bài trong ảnh em đã gửi: ${question.image_text}`
          : question.body;
        turns.push({ role: 'user', content }, { role: 'assistant', content: answer.body });
        index += 1;
      }
    }
    return turns.slice(-HISTORY_MESSAGES);
  }

  async send(currentUser: CurrentUser, body: RequestBody, files: readonly IncomingImage[] = []) {
    const context = await this.student(currentUser);
    const access = await this.accessOf(context, this.clock.now());
    if (!access.allowed) {
      throw ruleViolationError(TUTOR_RULES.turns, `${access.title} ${access.message}`, [
        { field: 'lock', message: access.code },
      ]);
    }
    if (!context.schoolLevel) {
      throw ruleViolationError(
        TUTOR_RULES.turns,
        'Gia sư AI dành cho học sinh Tiểu học, Trung học cơ sở, Trung học phổ thông',
      );
    }
    const request = this.readRequest(body, files);
    let conversation: ConversationRow | null = null;
    let subject: { code: string; name: string };
    let previous: MessageRow[] = [];
    if (request.conversationId) {
      conversation = await this.ownConversation(context.childId, request.conversationId);
      subject = { code: conversation.subject_code, name: conversation.subject_name };
      previous = await this.messagesOf(conversation.id);
      if (request.mode === 'solution' && !this.progressOf(previous).solution_unlocked) {
        throw ruleViolationError(
          TUTOR_RULES.hints,
          'Em hãy tự làm thêm để mở lời giải đầy đủ: cần ít nhất hai lượt tự làm trong hội thoại này',
        );
      }
    } else {
      const found = (await this.subjects(context)).find((item) => item.code === request.subjectCode);
      if (!found) {
        throw validationError([{ field: 'subject_code', message: 'Môn không có ở cấp học của em' }]);
      }
      subject = found;
    }
    const resolved = await this.resolve();
    if ('reason' in resolved) {
      throw ruleViolationError(TUTOR_RULES.turns, resolved.reason);
    }

    const now = this.clock.now();
    // Ảnh chỉ ở gói Nâng cao: kiểm trước khi giữ lượt, gói khác không bị trừ lượt
    if (request.images.length > 0 && !(await this.imagesAllowed(context.childId, now))) {
      throw ruleViolationError(TUTOR_RULES.images, IMAGES_NOT_ALLOWED_MESSAGE, [{ field: 'images', message: 'plan' }]);
    }
    const hold = await holdAiTutorTurn(this.system, context.childId, now);
    if (!hold.ok) {
      throw ruleViolationError(TUTOR_RULES.turns, NO_TURNS_MESSAGE);
    }
    let settled = false;
    try {
      // Dữ liệu cá nhân: hoàn lượt, không lưu câu hỏi
      const names = await this.nameIndex(context.database);
      const findings = scanPersonalData(request.text, names);
      if (findings.length > 0) {
        settled = await releaseAiTutorTurn(this.system, hold.entryId, 'Có dữ liệu cá nhân', this.clock.now());
        throw ruleViolationError(
          TUTOR_RULES.safety,
          `Câu hỏi có ${findings.map((kind) => PERSONAL_DATA_LABELS[kind]).join(', ')}. Em hãy bỏ thông tin cá nhân rồi hỏi lại; lượt hỏi không bị trừ`,
        );
      }
      let outcome: Outcome;
      try {
        outcome = await this.answer(context, subject, request, previous, resolved, names);
      } catch (error) {
        settled = await releaseAiTutorTurn(this.system, hold.entryId, 'Lỗi nhà cung cấp AI', this.clock.now());
        throw error;
      }
      // Ảnh chỉ lưu khi câu được trả lời bình thường; lưu tệp trước, lỗi khi ghi cơ sở dữ liệu thì xóa tệp vừa lưu
      const images = outcome.capture ? await this.putImages(context.childId, request.images) : [];
      let stored: Awaited<ReturnType<AiTutorChatService['store']>>;
      try {
        stored = await this.store(context, conversation, subject, request, outcome, hold.entryId, now, images);
      } catch (error) {
        await this.removeFiles(images.map((image) => image.storageKey));
        throw error;
      }
      if (outcome.studentModeration === 'self_harm' || outcome.studentModeration === 'bullying') {
        // Lỗi khi báo không làm hỏng câu trả lời của em: việc nền báo lại cờ chưa báo
        await this.safetyFlags
          .notifyPending(context.database, this.clock.now())
          .catch((error: unknown) => this.logger.warn(`Chưa báo được cờ cảnh báo của gia sư AI: ${String(error)}`));
      }
      const settledAt = this.clock.now();
      settled = outcome.capture
        ? await captureAiTutorTurn(this.system, hold.entryId, settledAt)
        : await releaseAiTutorTurn(this.system, hold.entryId, outcome.releaseReason ?? 'Không tính lượt', settledAt);
      const messages = await this.messagesOf(stored.conversation.id);
      return {
        conversation: conversationView(stored.conversation),
        messages: await this.viewsOf(stored.messages),
        turn: outcome.capture ? 'captured' : 'released',
        balance: await this.balance(context.childId, settledAt).then((balance) => ({
          monthly: balance.monthly,
          top_up: balance.top_up,
          remaining: balance.remaining,
          total: balance.total,
        })),
        ...this.progressOf(messages),
      };
    } finally {
      if (!settled) {
        await releaseAiTutorTurn(this.system, hold.entryId, 'Lỗi khi xử lý câu hỏi', this.clock.now());
      }
    }
  }

  // Kiểm duyệt câu hỏi, gọi nhà cung cấp, kiểm tra câu trả lời. Lỗi nhà cung cấp thì ném lỗi (nơi gọi hoàn lượt)
  private async answer(
    context: StudentContext,
    subject: { code: string; name: string },
    request: TutorRequest,
    previous: readonly MessageRow[],
    resolved: Resolved,
    names: Set<string>,
  ): Promise<Outcome> {
    const hasImages = request.images.length > 0;
    const flagged = moderateStudentText(request.text);
    if (flagged === 'self_harm' || flagged === 'bullying') {
      return {
        studentModeration: flagged,
        tutorBody: SAFETY_REPLIES[flagged],
        step: 'safety',
        topic: null,
        completion: null,
        capture: false,
        releaseReason: flagged === 'self_harm' ? 'Kiểm duyệt: dấu hiệu tự hại' : 'Kiểm duyệt: dấu hiệu bị bắt nạt',
        imageText: null,
      };
    }
    if (flagged === 'unsafe') {
      return {
        studentModeration: 'unsafe',
        tutorBody: REFUSAL_REPLY,
        step: 'refusal',
        topic: null,
        completion: null,
        capture: false,
        releaseReason: 'Kiểm duyệt: nội dung không phù hợp',
        imageText: null,
      };
    }
    const system = buildTutorSystemPrompt({
      schoolLevel: context.schoolLevel as AiTutorSchoolLevel,
      gradeLevelCode: context.gradeLevelCode,
      subjectName: subject.name,
      mode: request.mode,
      hasImages,
    });
    const calls: AiCompletion[] = [];
    const call = async (prompt: Parameters<AiProvider['complete']>[0]) => {
      try {
        const completion = await resolved.provider.complete(prompt, resolved.credentials);
        calls.push(completion);
        return completion;
      } catch (error) {
        if (calls.length > 0 && error instanceof AiProviderError) {
          return null;
        }
        throw ruleViolationError(
          TUTOR_RULES.turns,
          `${error instanceof AiProviderError ? error.message : 'Nhà cung cấp AI không trả được kết quả'}. Em thử lại sau; lượt hỏi không bị trừ`,
        );
      }
    };
    const first = await call({
      kind: 'tutor',
      system,
      user: request.text,
      maxTokens: TUTOR_MAX_TOKENS,
      history: this.historyOf(previous),
      ...(hasImages ? { images: request.images } : {}),
    });
    const tokens = () => ({
      model: calls[0]?.model ?? resolved.credentials.model,
      inputTokens: calls.reduce((sum, item) => sum + item.inputTokens, 0),
      outputTokens: calls.reduce((sum, item) => sum + item.outputTokens, 0),
    });
    const parsed = first ? parseTutorReply(first.text, request.mode) : null;
    if (!parsed) {
      throw ruleViolationError(
        TUTOR_RULES.turns,
        'Gia sư AI trả lời không đọc được. Em thử hỏi lại; lượt hỏi không bị trừ',
      );
    }
    // Ảnh (lát L4): đề chép từ ảnh quét dữ liệu cá nhân và kiểm duyệt như câu chữ; nhà cung cấp báo có thông tin cá nhân, đề chép được hoặc
    // câu trả lời có dữ liệu cá nhân thì không lưu ảnh, không hiện câu trả lời, hoàn lượt
    const imageText = hasImages ? parsed.imageText : '';
    if (hasImages) {
      const personal =
        parsed.personalData ||
        scanPersonalData(imageText, names).length > 0 ||
        scanPersonalData(parsed.reply, names).length > 0;
      if (personal) {
        return {
          studentModeration: 'personal_data',
          tutorBody: IMAGE_PERSONAL_DATA_REPLY,
          step: 'safety',
          topic: null,
          completion: tokens(),
          capture: false,
          releaseReason: 'Ảnh có dữ liệu cá nhân',
          imageText: null,
        };
      }
      const imageFlag = imageText ? moderateStudentText(imageText) : null;
      if (imageFlag === 'self_harm' || imageFlag === 'bullying') {
        return {
          studentModeration: imageFlag,
          tutorBody: SAFETY_REPLIES[imageFlag],
          step: 'safety',
          topic: null,
          completion: tokens(),
          capture: false,
          releaseReason:
            imageFlag === 'self_harm' ? 'Kiểm duyệt ảnh: dấu hiệu tự hại' : 'Kiểm duyệt ảnh: dấu hiệu bị bắt nạt',
          imageText: null,
        };
      }
      if (imageFlag === 'unsafe') {
        return {
          studentModeration: 'unsafe',
          tutorBody: REFUSAL_REPLY,
          step: 'refusal',
          topic: null,
          completion: tokens(),
          capture: false,
          releaseReason: 'Kiểm duyệt ảnh: nội dung không phù hợp',
          imageText: null,
        };
      }
    }
    if (parsed.step === 'refusal') {
      return {
        studentModeration: 'off_topic',
        tutorBody: parsed.reply,
        step: 'refusal',
        topic: null,
        completion: tokens(),
        capture: false,
        releaseReason: 'Ngoài học tập',
        imageText: null,
      };
    }
    if (isUnsafeReply(parsed.reply)) {
      return {
        studentModeration: null,
        tutorBody: REFUSAL_REPLY,
        step: 'refusal',
        topic: null,
        completion: tokens(),
        capture: false,
        releaseReason: 'Kiểm duyệt: câu trả lời không phù hợp',
        imageText: null,
      };
    }
    let reply = parsed.reply;
    let step = parsed.step;
    if (request.mode === 'hint') {
      if (step === 'solution') {
        step = 'method';
      }
      const opening = previous.find((row) => row.role === 'student');
      // Đề bài gồm câu hỏi đầu, câu mới và đề chép từ ảnh: đáp án có sẵn trong đề không tính là lộ đáp án
      const question = [opening?.body ?? request.text, opening?.image_text ?? '', imageText].join('\n');
      if (revealsFinalAnswer(reply, parsed.finalAnswer, `${question}\n${request.text}`)) {
        const rewritten = await call(buildRewritePrompt(reply, parsed.finalAnswer));
        const candidate = rewritten ? parseRewrite(rewritten.text) : null;
        reply =
          candidate &&
          !isUnsafeReply(candidate) &&
          !revealsFinalAnswer(candidate, parsed.finalAnswer, `${question}\n${request.text}`)
            ? candidate
            : NO_ANSWER_REPLY;
      }
    }
    const topicFindings = parsed.topic ? scanPersonalData(parsed.topic, names) : [];
    return {
      studentModeration: null,
      tutorBody: reply,
      step,
      topic: topicFindings.length === 0 ? parsed.topic : null,
      completion: tokens(),
      capture: true,
      releaseReason: null,
      imageText: imageText || null,
    };
  }

  private async store(
    context: StudentContext,
    existing: ConversationRow | null,
    subject: { code: string; name: string },
    request: { mode: TutorMode; text: string },
    outcome: Outcome,
    ledgerEntryId: string,
    now: Date,
    images: ReadonlyArray<{ storageKey: string; contentType: AiPromptImage['mediaType']; sizeBytes: number }>,
  ) {
    return this.system.transaction().execute(async (transaction) => {
      const conversation =
        existing ??
        (await transaction
          .insertInto('ai_tutor_conversations')
          .values({
            child_id: context.childId,
            school_level: context.schoolLevel as AiTutorSchoolLevel,
            grade_level_code: context.gradeLevelCode || 'khong-ro',
            subject_code: subject.code,
            subject_name: subject.name,
            topic: outcome.topic,
            created_at: now,
            last_message_at: now,
          })
          .returningAll()
          .executeTakeFirstOrThrow());
      const question = await transaction
        .insertInto('ai_tutor_messages')
        .values({
          conversation_id: conversation.id,
          role: 'student',
          body: request.text,
          request_kind: request.mode === 'solution' ? 'solution' : 'ask',
          moderation: outcome.studentModeration,
          image_text: outcome.imageText,
          created_at: now,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      if (images.length > 0) {
        await transaction
          .insertInto('ai_tutor_message_images')
          .values(
            images.map((image, index) => ({
              message_id: question.id,
              child_id: context.childId,
              position: index + 1,
              storage_key: image.storageKey,
              content_type: image.contentType,
              size_bytes: image.sizeBytes,
              created_at: now,
            })),
          )
          .execute();
      }
      const reply = await transaction
        .insertInto('ai_tutor_messages')
        .values({
          conversation_id: conversation.id,
          role: 'tutor',
          body: outcome.tutorBody,
          step: outcome.step,
          ledger_entry_id: ledgerEntryId,
          model: outcome.completion?.model ?? null,
          input_tokens: outcome.completion?.inputTokens ?? null,
          output_tokens: outcome.completion?.outputTokens ?? null,
          created_at: new Date(now.getTime() + 1),
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      if (outcome.studentModeration === 'self_harm' || outcome.studentModeration === 'bullying') {
        await transaction
          .insertInto('ai_tutor_safety_flags')
          .values({
            child_id: context.childId,
            conversation_id: conversation.id,
            message_id: question.id,
            kind: outcome.studentModeration,
            created_at: now,
          })
          .execute();
      }
      const updated = await transaction
        .updateTable('ai_tutor_conversations')
        .set((expression) => ({
          last_message_at: new Date(now.getTime() + 1),
          topic: outcome.topic ? expression.fn.coalesce('topic', sql.val(outcome.topic)) : expression.ref('topic'),
        }))
        .where('id', '=', conversation.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      return { conversation: updated, messages: [question, reply] };
    });
  }

  private async putImages(childId: string, images: readonly AiPromptImage[]) {
    const stored: Array<{ storageKey: string; contentType: AiPromptImage['mediaType']; sizeBytes: number }> = [];
    try {
      for (const image of images) {
        const key = storageKey(IMAGE_FOLDER, childId, randomUUID());
        await this.fileStorage.put(key, image.data, image.mediaType);
        stored.push({ storageKey: key, contentType: image.mediaType, sizeBytes: image.data.length });
      }
    } catch (error) {
      await this.removeFiles(stored.map((image) => image.storageKey));
      throw error;
    }
    return stored;
  }

  private async removeFiles(keys: readonly string[]) {
    for (const key of keys) {
      await this.fileStorage
        .delete(key)
        .catch((error: unknown) => this.logger.warn(`Chưa xóa được ảnh gia sư AI: ${String(error)}`));
    }
  }

  // ---------- Báo câu trả lời sai

  async report(currentUser: CurrentUser, messageId: string, body: RequestBody) {
    const context = await this.student(currentUser);
    if (context.readOnly) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Phiên xem hỗ trợ chỉ đọc');
    }
    const note = typeof body?.note === 'string' ? body.note.trim() : '';
    if (note.length > REPORT_NOTE_MAX_LENGTH) {
      throw validationError([{ field: 'note', message: `Ghi chú tối đa ${REPORT_NOTE_MAX_LENGTH} ký tự` }]);
    }
    const message = isUuid(messageId)
      ? await this.system
          .selectFrom('ai_tutor_messages')
          .innerJoin('ai_tutor_conversations', 'ai_tutor_conversations.id', 'ai_tutor_messages.conversation_id')
          .select(['ai_tutor_messages.id', 'ai_tutor_messages.role', 'ai_tutor_messages.step'])
          .where('ai_tutor_messages.id', '=', messageId)
          .where('ai_tutor_conversations.child_id', '=', context.childId)
          .executeTakeFirst()
      : undefined;
    if (!message || message.role !== 'tutor' || message.step === 'safety') {
      throw notFoundError('Không tìm thấy câu trả lời của gia sư', 'ai_tutor_message');
    }
    await this.system
      .updateTable('ai_tutor_messages')
      .set({ reported_at: this.clock.now(), report_note: note || null })
      .where('id', '=', message.id)
      .where('reported_at', 'is', null)
      .execute();
    return { id: message.id, reported: true };
  }

  // ---------- Cha mẹ: chủ đề và số lượt (không có toàn văn)

  async parentTopics(currentUser: CurrentUser, childId: string) {
    const { database } = await this.currentSchoolYear.require();
    const guardian = isUuid(childId)
      ? await database
          .selectFrom('child_guardians')
          .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
          .select('child_guardians.child_id')
          .where('child_guardians.child_id', '=', childId)
          .where('guardians.user_id', '=', currentUser.id)
          .executeTakeFirst()
      : undefined;
    if (!guardian) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ cha mẹ, người giám hộ của học sinh làm được việc này');
    }
    const now = this.clock.now();
    const rows = await this.system
      .selectFrom('ai_tutor_conversations')
      .leftJoin('ai_tutor_messages', (join) =>
        join
          .onRef('ai_tutor_messages.conversation_id', '=', 'ai_tutor_conversations.id')
          .on('ai_tutor_messages.role', '=', 'tutor'),
      )
      .leftJoin('ai_tutor_turn_ledger', (join) =>
        join
          .onRef('ai_tutor_turn_ledger.id', '=', 'ai_tutor_messages.ledger_entry_id')
          .on('ai_tutor_turn_ledger.status', '=', 'captured'),
      )
      .select([
        'ai_tutor_conversations.subject_name',
        'ai_tutor_conversations.topic',
        'ai_tutor_conversations.created_at',
        'ai_tutor_conversations.last_message_at',
        sql<string>`count(ai_tutor_turn_ledger.id)`.as('turns'),
      ])
      .where('ai_tutor_conversations.child_id', '=', childId)
      .groupBy([
        'ai_tutor_conversations.id',
        'ai_tutor_conversations.subject_name',
        'ai_tutor_conversations.topic',
        'ai_tutor_conversations.created_at',
        'ai_tutor_conversations.last_message_at',
      ])
      .orderBy('ai_tutor_conversations.last_message_at', 'desc')
      .limit(200)
      .execute();
    const month = vietnamMonthOf(now);
    const monthStart = new Date(`${month}T00:00:00+07:00`);
    const used = await this.system
      .selectFrom('ai_tutor_turn_ledger')
      .select(sql<string>`count(*)`.as('turns'))
      .where('child_id', '=', childId)
      .where('status', '=', 'captured')
      .where('settled_at', '>=', monthStart)
      .executeTakeFirstOrThrow();
    // Lát L5 (MH-598 "Chủ đề nhiều nhất"): ba chủ đề có nhiều lượt đã trừ nhất trong tháng; chủ đề do gia sư đặt, đã quét dữ liệu cá nhân
    const topTopics = await this.system
      .selectFrom('ai_tutor_turn_ledger')
      .innerJoin('ai_tutor_messages', 'ai_tutor_messages.ledger_entry_id', 'ai_tutor_turn_ledger.id')
      .innerJoin('ai_tutor_conversations', 'ai_tutor_conversations.id', 'ai_tutor_messages.conversation_id')
      .select(['ai_tutor_conversations.topic', sql<string>`count(distinct ai_tutor_turn_ledger.id)`.as('turns')])
      .where('ai_tutor_turn_ledger.child_id', '=', childId)
      .where('ai_tutor_turn_ledger.status', '=', 'captured')
      .where('ai_tutor_turn_ledger.settled_at', '>=', monthStart)
      .where('ai_tutor_messages.role', '=', 'tutor')
      .where('ai_tutor_conversations.topic', 'is not', null)
      .groupBy('ai_tutor_conversations.topic')
      .orderBy(sql`count(distinct ai_tutor_turn_ledger.id)`, 'desc')
      .orderBy('ai_tutor_conversations.topic')
      .limit(3)
      .execute();
    return {
      month,
      turns_this_month: Number(used.turns),
      top_topics: topTopics.map((row) => ({ topic: row.topic as string, turns: Number(row.turns) })),
      topics: rows.map((row) => ({
        subject_name: row.subject_name,
        topic: row.topic,
        turns: Number(row.turns),
        started_at: row.created_at,
        last_message_at: row.last_message_at,
      })),
    };
  }

  // ---------- Việc nền: hoàn lượt tạm giữ quá hạn, xóa lịch sử quá 12 tháng

  async purgeExpired(now: Date = this.clock.now()): Promise<number> {
    const cutoff = retentionCutoff(now);
    const deleted = await this.system
      .deleteFrom('ai_tutor_messages')
      .where('created_at', '<', cutoff)
      .executeTakeFirst();
    await this.system
      .deleteFrom('ai_tutor_conversations')
      .where('last_message_at', '<', cutoff)
      .where((expression) =>
        expression.not(
          expression.exists(
            expression
              .selectFrom('ai_tutor_messages')
              .select('ai_tutor_messages.id')
              .whereRef('ai_tutor_messages.conversation_id', '=', 'ai_tutor_conversations.id'),
          ),
        ),
      )
      .execute();
    return Number(deleted.numDeletedRows);
  }

  // Xóa ảnh từ đủ 30 ngày (Q5): xóa tệp ở kho rồi xóa khóa tệp, ghi lúc xóa; dòng còn lại để tin nhắn hiện "Ảnh đã xóa sau 30 ngày". Kho
  // lỗi thì để lần chạy sau xóa lại
  async purgeImages(now: Date = this.clock.now()): Promise<number> {
    const rows = await this.system
      .selectFrom('ai_tutor_message_images')
      .select(['id', 'storage_key'])
      .where('deleted_at', 'is', null)
      .where('created_at', '<=', imageRetentionCutoff(now))
      .orderBy('created_at')
      .limit(IMAGE_PURGE_BATCH)
      .execute();
    let deleted = 0;
    for (const row of rows) {
      try {
        if (row.storage_key) {
          await this.fileStorage.delete(row.storage_key);
        }
      } catch (error) {
        this.logger.warn(`Chưa xóa được ảnh gia sư AI quá 30 ngày: ${String(error)}`);
        continue;
      }
      await this.system
        .updateTable('ai_tutor_message_images')
        .set({ storage_key: null, deleted_at: now })
        .where('id', '=', row.id)
        .execute();
      deleted += 1;
    }
    return deleted;
  }

  async maintain(
    now: Date = this.clock.now(),
  ): Promise<{ released: number; purged: number; notified: number; images: number }> {
    const released = await releaseStaleAiTutorHolds(this.system, now);
    // Ảnh xóa trước lịch sử 12 tháng để tệp không còn sót khi tin nhắn bị xóa
    const images = await this.purgeImages(now);
    const purged = await this.purgeExpired(now);
    // Cờ cảnh báo chưa báo được lúc em gửi (lỗi tạm thời) thì báo lại ở đây
    const notified = await this.safetyFlags.notifyPending(null, now);
    return { released, purged, notified, images };
  }
}

// Việc nền theo trường (chỉ nhiều trường)
@Injectable()
export class AiTutorChatMaintenanceJob implements OnApplicationBootstrap {
  private readonly logger = new Logger(AiTutorChatMaintenanceJob.name);

  constructor(
    private readonly chat: AiTutorChatService,
    @Optional() @Inject(JobScheduler) private readonly scheduler: JobScheduler | null = null,
  ) {}

  onApplicationBootstrap() {
    if (isMultiTenantMode()) {
      this.scheduler?.register({
        name: 'ai-tutor-chat-maintenance',
        intervalSeconds: MAINTENANCE_JOB_SECONDS,
        run: async () => {
          const result = await this.chat.maintain();
          if (result.released > 0 || result.purged > 0 || result.notified > 0 || result.images > 0) {
            this.logger.log(
              `Gia sư AI: hoàn ${result.released} lượt tạm giữ quá hạn, xóa ${result.purged} tin nhắn quá hạn giữ, xóa ${result.images} ảnh quá 30 ngày, báo ${result.notified} cờ cảnh báo`,
            );
          }
        },
      });
    }
  }
}
