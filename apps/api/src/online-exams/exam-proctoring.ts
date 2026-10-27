import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import {
  Inject,
  Injectable,
  Logger,
  Optional,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  isMultiTenantMode,
  ruleViolationError,
  validationError,
} from '@school-management/server';
import {
  PERMISSION_CODES,
  PROCTOR_CONSENT_SCOPES,
  PROCTOR_MAX_LIVE_VIEWS,
  PROCTOR_SIGNAL_KINDS,
  PROCTOR_VIEW_STALE_SECONDS,
  RECORDING_CHUNK_MAX_BYTES,
  RECORDING_CHUNK_SECONDS,
  needsParentConsent,
  type IceServerConfig,
  type ProctorConsentScope,
  type ProctorSignalKind,
} from '@school-management/shared';
import type { Kysely } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { API_CONFIGURATION, type ApiConfiguration } from '../common/configuration.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { JobScheduler } from '../common/job-scheduler.js';
import { notFoundError } from '../common/request-fields.js';
import { FileStorage } from '../files/file-storage.js';
import { ExamRateLimiter } from './exam-rate-limit.js';
import { OnlineExamsService } from './online-exams.js';
import { activeConsents } from './proctor-consent.js';
import { assertOnlineExamModule, ONLINE_EXAM_RULE_CODE, StudentExamsService } from './student-exams.js';

// Giám thị camera cho thi trực tuyến (DT-23 phần 23e, YCTD-215). Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - xem trực tiếp bằng WebRTC: giáo viên là bên gọi (offer), học sinh trả lời (answer) bằng camera của mình; hình ảnh đi thẳng giữa
//   hai trình duyệt (qua coturn khi cần), máy chủ API chỉ chuyển thông điệp báo hiệu ngắn hạn qua bảng `exam_proctor_signals`
//   (hỏi lại định kỳ, không cần kết nối web socket); mỗi phiên xem ghi vào nhật ký người xem;
// - mặc định tắt: trường bật xem trực tiếp, ghi hình ở cấu hình thi trực tuyến, giáo viên bật theo bài giao; học sinh phải xác nhận
//   thông báo, học sinh dưới 16 tuổi cần cha mẹ đồng ý từng loại (kiểm cả lúc xem và lúc ghi, nên thu hồi đồng ý có hiệu lực ngay);
// - phát hiện vắng mặt, nhiều khuôn mặt, rời màn hình vẫn chạy trên máy học sinh (23a) và ghi thành sự kiện, không gửi hình;
// - ghi hình tuỳ chọn: trình duyệt học sinh ghi từng đoạn ngắn và tải lên; máy chủ mã hoá AES-256-GCM rồi lưu ở kho tệp theo
//   khoá lưu trữ, giữ theo số ngày của trường (mặc định 30), chỉ người giao bài và người quản lý xem, phát qua máy chủ có kiểm
//   quyền và ghi nhật ký, không có nút tải xuống; không nhận diện danh tính sinh trắc.
type Database = Kysely<SchoolYearDatabase>;
const MANAGE = PERMISSION_CODES.examManage;
const MAXIMUM_SIGNAL_CHARS = 24_000;
const MAXIMUM_CHUNKS = 2_000;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const WEBM_SIGNATURE = [0x1a, 0x45, 0xdf, 0xa3];

export function encryptBytes(key: Buffer, body: Buffer): Buffer {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const encrypted = Buffer.concat([cipher.update(body), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]);
}

export function decryptBytes(key: Buffer, raw: Buffer): Buffer {
  const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, NONCE_BYTES));
  decipher.setAuthTag(raw.subarray(NONCE_BYTES, NONCE_BYTES + TAG_BYTES));
  return Buffer.concat([decipher.update(raw.subarray(NONCE_BYTES + TAG_BYTES)), decipher.final()]);
}

// Tên đăng nhập và mật khẩu TURN có hạn theo cách "TURN REST API" của coturn (use-auth-secret)
export function turnCredentials(secret: string, subject: string, now: Date, ttlSeconds: number) {
  const username = `${Math.floor(now.getTime() / 1000) + ttlSeconds}:${subject}`;
  return { username, credential: createHmac('sha1', secret).update(username).digest('base64') };
}

@Injectable()
export class ExamProctoringService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly exams: OnlineExamsService,
    private readonly students: StudentExamsService,
    private readonly fileStorage: FileStorage,
    @Inject(API_CONFIGURATION) private readonly configuration: ApiConfiguration,
    private readonly clock: Clock,
    private readonly limiter: ExamRateLimiter,
  ) {}

  // Danh sách máy chủ ICE cho trình duyệt: STUN, và TURN với thông tin đăng nhập có hạn khi có khoá dùng chung
  iceServers(subject: string): { ice_servers: IceServerConfig[] } {
    const settings = this.configuration.webrtc;
    const servers: IceServerConfig[] = [];
    if (settings?.stunUrls.length) {
      servers.push({ urls: settings.stunUrls });
    }
    if (settings?.turnUrls.length && settings.turnSecret) {
      servers.push({
        urls: settings.turnUrls,
        ...turnCredentials(settings.turnSecret, subject, this.clock.now(), settings.turnTtlSeconds),
      });
    }
    return { ice_servers: servers };
  }

  private staleBefore(): Date {
    return new Date(this.clock.now().getTime() - PROCTOR_VIEW_STALE_SECONDS * 1000);
  }

  private async attemptWithAssignment(database: Database, attemptId: string) {
    const attempt = await database
      .selectFrom('exam_attempts')
      .innerJoin('exam_assignments', 'exam_assignments.id', 'exam_attempts.assignment_id')
      .select([
        'exam_attempts.id',
        'exam_attempts.assignment_id',
        'exam_attempts.child_id',
        'exam_attempts.status',
        'exam_attempts.camera_state',
        'exam_attempts.proctor_notice_at',
        'exam_attempts.submitted_at',
        'exam_assignments.proctor_live',
        'exam_assignments.proctor_record',
        'exam_assignments.created_by',
      ])
      .where('exam_attempts.id', '=', attemptId)
      .executeTakeFirst();
    if (!attempt) {
      throw notFoundError('Không tìm thấy bài làm', 'exam_attempt');
    }
    return attempt;
  }

  private async consentMissing(database: Database, childId: string, scope: ProctorConsentScope): Promise<boolean> {
    const child = await database
      .selectFrom('children')
      .select('dob')
      .where('id', '=', childId)
      .executeTakeFirstOrThrow();
    if (
      !needsParentConsent(child.dob === null ? null : String(child.dob), this.clock.now().toISOString().slice(0, 10))
    ) {
      return false;
    }
    return !(await activeConsents(database, childId)).includes(scope);
  }

  // ----- Giáo viên: xem trực tiếp -----

  async startView(currentUser: CurrentUser, attemptId: string) {
    assertOnlineExamModule();
    const { database } = await this.currentSchoolYear.require();
    const attempt = await this.attemptWithAssignment(database, attemptId);
    await this.exams.assertCanManage(database, currentUser, attempt.assignment_id);
    if (!attempt.proctor_live) {
      throw ruleViolationError(ONLINE_EXAM_RULE_CODE, 'Bài thi này không bật xem camera trực tiếp');
    }
    const settings = await this.exams.readSchoolSettings(database);
    if (!settings.allow_live_proctoring) {
      throw ruleViolationError(ONLINE_EXAM_RULE_CODE, 'Trường đã tắt xem camera trực tiếp ở Cấu hình thi trực tuyến');
    }
    if (attempt.status !== 'in_progress') {
      throw ruleViolationError(ONLINE_EXAM_RULE_CODE, 'Học sinh không còn đang làm bài');
    }
    if (attempt.camera_state !== 'granted') {
      throw ruleViolationError(ONLINE_EXAM_RULE_CODE, 'Học sinh chưa bật camera');
    }
    if (await this.consentMissing(database, attempt.child_id, 'live')) {
      throw ruleViolationError(ONLINE_EXAM_RULE_CODE, 'Cha mẹ chưa đồng ý (hoặc đã thu hồi) cho xem camera trực tiếp');
    }
    const now = this.clock.now();
    await database
      .updateTable('exam_proctor_views')
      .set({ ended_at: now })
      .where('attempt_id', '=', attemptId)
      .where('viewer_id', '=', currentUser.id)
      .where('kind', '=', 'live')
      .where('ended_at', 'is', null)
      .execute();
    const active = await database
      .selectFrom('exam_proctor_views')
      .innerJoin('exam_attempts', 'exam_attempts.id', 'exam_proctor_views.attempt_id')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .where('exam_attempts.assignment_id', '=', attempt.assignment_id)
      .where('exam_proctor_views.kind', '=', 'live')
      .where('exam_proctor_views.ended_at', 'is', null)
      .where('exam_proctor_views.last_seen_at', '>=', this.staleBefore())
      .executeTakeFirstOrThrow();
    if (Number(active.count) >= PROCTOR_MAX_LIVE_VIEWS) {
      throw ruleViolationError(
        ONLINE_EXAM_RULE_CODE,
        `Một bài thi chỉ xem trực tiếp tối đa ${PROCTOR_MAX_LIVE_VIEWS} camera cùng lúc`,
      );
    }
    const view = await database
      .insertInto('exam_proctor_views')
      .values({
        attempt_id: attemptId,
        kind: 'live',
        viewer_id: currentUser.id,
        viewer_name: currentUser.description.full_name,
        last_seen_at: now,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return { view_id: view.id };
  }

  private async ownView(database: Database, currentUser: CurrentUser, viewId: string) {
    const view = await database
      .selectFrom('exam_proctor_views')
      .innerJoin('exam_attempts', 'exam_attempts.id', 'exam_proctor_views.attempt_id')
      .select([
        'exam_proctor_views.id',
        'exam_proctor_views.attempt_id',
        'exam_proctor_views.viewer_id',
        'exam_proctor_views.ended_at',
        'exam_attempts.status as attempt_status',
      ])
      .where('exam_proctor_views.id', '=', viewId)
      .where('exam_proctor_views.viewer_id', '=', currentUser.id)
      .where('exam_proctor_views.kind', '=', 'live')
      .executeTakeFirst();
    if (!view) {
      throw notFoundError('Không tìm thấy phiên xem', 'exam_proctor_view');
    }
    return view;
  }

  async teacherPoll(currentUser: CurrentUser, viewId: string, after: number) {
    assertOnlineExamModule();
    const { database } = await this.currentSchoolYear.require();
    const view = await this.ownView(database, currentUser, viewId);
    const ended = view.ended_at !== null || view.attempt_status !== 'in_progress';
    if (ended) {
      return { ended: true, signals: [] as Array<{ id: number; kind: ProctorSignalKind; payload: string }> };
    }
    await database
      .updateTable('exam_proctor_views')
      .set({ last_seen_at: this.clock.now() })
      .where('id', '=', viewId)
      .execute();
    const rows = await database
      .selectFrom('exam_proctor_signals')
      .select(['id', 'kind', 'payload'])
      .where('view_id', '=', viewId)
      .where('direction', '=', 'to_teacher')
      .where('id', '>', String(after))
      .orderBy('id')
      .limit(100)
      .execute();
    return { ended: false, signals: rows.map((row) => ({ id: Number(row.id), kind: row.kind, payload: row.payload })) };
  }

  async teacherSignal(currentUser: CurrentUser, viewId: string, kind: ProctorSignalKind, payload: string) {
    assertOnlineExamModule();
    if (kind === 'answer') {
      throw validationError([{ field: 'kind', message: 'Giáo viên gửi offer hoặc ice' }]);
    }
    const { database } = await this.currentSchoolYear.require();
    const view = await this.ownView(database, currentUser, viewId);
    if (view.ended_at !== null || view.attempt_status !== 'in_progress') {
      throw ruleViolationError(ONLINE_EXAM_RULE_CODE, 'Phiên xem đã kết thúc');
    }
    await database
      .insertInto('exam_proctor_signals')
      .values({ view_id: viewId, direction: 'to_student', kind, payload })
      .execute();
    return { sent: true };
  }

  async endView(currentUser: CurrentUser, viewId: string) {
    assertOnlineExamModule();
    const { database } = await this.currentSchoolYear.require();
    await this.ownView(database, currentUser, viewId);
    await database
      .updateTable('exam_proctor_views')
      .set({ ended_at: this.clock.now() })
      .where('id', '=', viewId)
      .where('ended_at', 'is', null)
      .execute();
    await database.deleteFrom('exam_proctor_signals').where('view_id', '=', viewId).execute();
    return { ended: true };
  }

  // ----- Học sinh: trả lời xem trực tiếp, tải bản ghi -----

  private async studentAttempt(student: { database: Database; childId: string }, attemptId: string) {
    const attempt = await this.attemptWithAssignment(student.database, attemptId);
    if (attempt.child_id !== student.childId) {
      throw notFoundError('Không tìm thấy bài làm', 'exam_attempt');
    }
    return attempt;
  }

  // Máy học sinh hỏi định kỳ: có phiên xem nào đang mở không và thông điệp báo hiệu mới
  async studentPoll(currentUser: CurrentUser, attemptId: string, after: number) {
    const student = await this.students.resolve(currentUser);
    this.limiter.hit(student.childId);
    const attempt = await this.studentAttempt(student, attemptId);
    const idle = { active: false, watching: 0, active_view_ids: [] as string[], signals: [], cursor: after };
    if (attempt.status !== 'in_progress' || !attempt.proctor_live) {
      return idle;
    }
    const views = await student.database
      .selectFrom('exam_proctor_views')
      .select('id')
      .where('attempt_id', '=', attemptId)
      .where('kind', '=', 'live')
      .where('ended_at', 'is', null)
      .where('last_seen_at', '>=', this.staleBefore())
      .execute();
    const ids = views.map((view) => view.id);
    const rows = ids.length
      ? await student.database
          .selectFrom('exam_proctor_signals')
          .select(['id', 'view_id', 'kind', 'payload'])
          .where('view_id', 'in', ids)
          .where('direction', '=', 'to_student')
          .where('id', '>', String(after))
          .orderBy('id')
          .limit(100)
          .execute()
      : [];
    return {
      active: true,
      watching: ids.length,
      active_view_ids: ids,
      signals: rows.map((row) => ({ id: Number(row.id), view_id: row.view_id, kind: row.kind, payload: row.payload })),
      cursor: rows.length ? Number(rows[rows.length - 1]!.id) : after,
    };
  }

  async studentSignal(
    currentUser: CurrentUser,
    attemptId: string,
    viewId: string,
    kind: ProctorSignalKind,
    payload: string,
  ) {
    const student = await this.students.resolve(currentUser);
    this.limiter.hit(student.childId);
    if (kind === 'offer') {
      throw validationError([{ field: 'kind', message: 'Học sinh gửi answer hoặc ice' }]);
    }
    const attempt = await this.studentAttempt(student, attemptId);
    const view = await student.database
      .selectFrom('exam_proctor_views')
      .select(['id', 'ended_at'])
      .where('id', '=', viewId)
      .where('attempt_id', '=', attemptId)
      .where('kind', '=', 'live')
      .executeTakeFirst();
    if (!view || view.ended_at !== null || attempt.status !== 'in_progress') {
      throw ruleViolationError(ONLINE_EXAM_RULE_CODE, 'Phiên xem đã kết thúc');
    }
    await student.database
      .insertInto('exam_proctor_signals')
      .values({ view_id: viewId, direction: 'to_teacher', kind, payload })
      .execute();
    return { sent: true };
  }

  // Một đoạn bản ghi của lượt làm: kiểm bài có bật ghi hình, học sinh đã xác nhận thông báo, cha mẹ còn đồng ý (dưới 16 tuổi);
  // đoạn gửi lại cùng số thứ tự thì bỏ qua
  async storeChunk(currentUser: CurrentUser, attemptId: string, seq: number, body: Buffer) {
    const student = await this.students.resolve(currentUser);
    this.limiter.hit(student.childId);
    const { database } = student;
    const attempt = await this.studentAttempt(student, attemptId);
    if (!attempt.proctor_record || attempt.proctor_notice_at === null) {
      throw ruleViolationError(ONLINE_EXAM_RULE_CODE, 'Bài thi này không ghi hình');
    }
    if (attempt.status !== 'in_progress') {
      throw ruleViolationError(ONLINE_EXAM_RULE_CODE, 'Bài đã nộp, không nhận thêm bản ghi');
    }
    const settings = await this.exams.readSchoolSettings(database);
    if (!settings.allow_recording) {
      throw ruleViolationError(ONLINE_EXAM_RULE_CODE, 'Trường đã tắt ghi hình ở Cấu hình thi trực tuyến');
    }
    if (await this.consentMissing(database, attempt.child_id, 'record')) {
      throw ruleViolationError(ONLINE_EXAM_RULE_CODE, 'Cha mẹ chưa đồng ý (hoặc đã thu hồi) cho ghi hình');
    }
    if (!Number.isInteger(seq) || seq < 0 || seq >= MAXIMUM_CHUNKS) {
      throw validationError([{ field: 'seq', message: `Số thứ tự đoạn từ 0 đến ${MAXIMUM_CHUNKS - 1}` }]);
    }
    if (body.length === 0 || body.length > RECORDING_CHUNK_MAX_BYTES) {
      throw validationError([{ field: 'chunk', message: 'Đoạn bản ghi trống hoặc quá lớn' }]);
    }
    if (seq === 0 && !WEBM_SIGNATURE.every((byte, index) => body[index] === byte)) {
      throw validationError([{ field: 'chunk', message: 'Đoạn đầu phải là video WebM' }]);
    }
    const existing = await database
      .selectFrom('exam_recording_chunks')
      .select('seq')
      .where('attempt_id', '=', attemptId)
      .where('seq', '=', seq)
      .executeTakeFirst();
    if (existing) {
      return { stored: false };
    }
    const now = this.clock.now();
    const storageKey = `exam-recordings/${attemptId}/${seq}`;
    await this.fileStorage.put(
      storageKey,
      encryptBytes(this.configuration.childDataEncryptionKey, body),
      'application/octet-stream',
    );
    await database
      .insertInto('exam_recording_chunks')
      .values({
        attempt_id: attemptId,
        seq,
        storage_key: storageKey,
        size_bytes: body.length,
        expires_at: new Date(now.getTime() + settings.recording_retention_days * 86_400_000),
      })
      .onConflict((conflict) => conflict.columns(['attempt_id', 'seq']).doNothing())
      .execute();
    return { stored: true };
  }

  // ----- Giáo viên: thông tin giám sát của lượt làm, xem lại bản ghi -----

  async attemptProctor(currentUser: CurrentUser, attemptId: string) {
    assertOnlineExamModule();
    const { database } = await this.currentSchoolYear.require();
    const attempt = await this.attemptWithAssignment(database, attemptId);
    await this.exams.assertCanManage(database, currentUser, attempt.assignment_id);
    const [views, chunks] = await Promise.all([
      database
        .selectFrom('exam_proctor_views')
        .select(['kind', 'viewer_name', 'started_at', 'ended_at'])
        .where('attempt_id', '=', attemptId)
        .orderBy('started_at', 'desc')
        .limit(200)
        .execute(),
      database
        .selectFrom('exam_recording_chunks')
        .select((expression) => [
          expression.fn.countAll<string>().as('count'),
          expression.fn.min('expires_at').as('expires_at'),
        ])
        .where('attempt_id', '=', attemptId)
        .executeTakeFirstOrThrow(),
    ]);
    const count = Number(chunks.count);
    return {
      proctor_live: attempt.proctor_live,
      proctor_record: attempt.proctor_record,
      camera_state: attempt.camera_state,
      notice_at: attempt.proctor_notice_at,
      can_watch_recording: this.canWatchRecording(currentUser, attempt.created_by),
      recording:
        count > 0
          ? { chunks: count, approx_seconds: count * RECORDING_CHUNK_SECONDS, expires_at: chunks.expires_at }
          : null,
      views,
    };
  }

  private canWatchRecording(currentUser: CurrentUser, createdBy: string): boolean {
    return currentUser.hasPermission(MANAGE) || createdBy === currentUser.id;
  }

  // Phát lại bản ghi: chỉ người giao bài và người quản lý; mỗi lần xem ghi nhật ký; ghép các đoạn đã giải mã thành một video WebM
  async recordingParts(currentUser: CurrentUser, attemptId: string, origin: ChangeOrigin) {
    assertOnlineExamModule();
    const { database } = await this.currentSchoolYear.require();
    const attempt = await this.attemptWithAssignment(database, attemptId);
    await this.exams.assertCanManage(database, currentUser, attempt.assignment_id);
    if (!this.canWatchRecording(currentUser, attempt.created_by)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người giao bài và người quản lý đề, kiểm tra xem được bản ghi');
    }
    const chunks = await database
      .selectFrom('exam_recording_chunks')
      .select(['storage_key', 'seq'])
      .where('attempt_id', '=', attemptId)
      .where('expires_at', '>', this.clock.now())
      .orderBy('seq')
      .execute();
    if (chunks.length === 0) {
      throw notFoundError('Bài làm này không có bản ghi (chưa ghi hoặc đã hết hạn giữ)', 'exam_recording');
    }
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      const view = await transaction
        .insertInto('exam_proctor_views')
        .values({
          attempt_id: attemptId,
          kind: 'recording',
          viewer_id: currentUser.id,
          viewer_name: currentUser.description.full_name,
          last_seen_at: now,
          ended_at: now,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'exam_proctor_views',
        entityId: view.id,
        action: 'create',
        before: null,
        after: { attempt_id: attemptId, kind: 'recording' },
      });
    });
    const key = this.configuration.childDataEncryptionKey;
    const storage = this.fileStorage;
    return (async function* () {
      for (const chunk of chunks) {
        yield decryptBytes(key, await storage.get(chunk.storage_key));
      }
    })();
  }

  // ----- Đồng ý của cha mẹ -----

  private async setConsent(
    database: Database,
    input: {
      childId: string;
      scope: ProctorConsentScope;
      granted: boolean;
      source: 'parent' | 'school';
      byId: string;
      byName: string;
      note: string | null;
    },
    origin: ChangeOrigin,
  ) {
    if (!PROCTOR_CONSENT_SCOPES.includes(input.scope)) {
      throw validationError([{ field: 'scope', message: 'Loại đồng ý là live hoặc record' }]);
    }
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      const active = await transaction
        .selectFrom('exam_proctor_consents')
        .select('id')
        .where('child_id', '=', input.childId)
        .where('scope', '=', input.scope)
        .where('revoked_at', 'is', null)
        .executeTakeFirst();
      if (input.granted && !active) {
        const created = await transaction
          .insertInto('exam_proctor_consents')
          .values({
            child_id: input.childId,
            scope: input.scope,
            source: input.source,
            granted_by: input.byId,
            granted_by_name: input.byName,
            note: input.note,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: null,
          entityName: 'exam_proctor_consents',
          entityId: created.id,
          action: 'create',
          before: null,
          after: { child_id: input.childId, scope: input.scope, source: input.source },
        });
      } else if (!input.granted && active) {
        await transaction
          .updateTable('exam_proctor_consents')
          .set({ revoked_at: now, revoked_by_name: input.byName })
          .where('id', '=', active.id)
          .execute();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: null,
          entityName: 'exam_proctor_consents',
          entityId: active.id,
          action: 'update',
          before: { revoked: false },
          after: { revoked: true },
        });
      }
    });
  }

  private async consentView(database: Database, childIds: string[]) {
    if (childIds.length === 0) {
      return new Map<
        string,
        Record<ProctorConsentScope, { granted_at: Date; source: string; granted_by_name: string } | null>
      >();
    }
    const rows = await database
      .selectFrom('exam_proctor_consents')
      .select(['child_id', 'scope', 'source', 'granted_at', 'granted_by_name'])
      .where('child_id', 'in', childIds)
      .where('revoked_at', 'is', null)
      .execute();
    const map = new Map<
      string,
      Record<ProctorConsentScope, { granted_at: Date; source: string; granted_by_name: string } | null>
    >();
    for (const id of childIds) {
      map.set(id, { live: null, record: null });
    }
    for (const row of rows) {
      map.get(row.child_id)![row.scope] = {
        granted_at: row.granted_at,
        source: row.source,
        granted_by_name: row.granted_by_name,
      };
    }
    return map;
  }

  // Giáo viên: tình trạng đồng ý của học sinh trong bài giao
  async assignmentConsents(currentUser: CurrentUser, assignmentId: string) {
    assertOnlineExamModule();
    const { database } = await this.currentSchoolYear.require();
    const detail = await this.exams.detail(currentUser, assignmentId);
    const ids = detail.students.map((student) => student.child_id);
    const consents = await this.consentView(database, ids);
    const dobs = ids.length
      ? await database.selectFrom('children').select(['id', 'dob']).where('id', 'in', ids).execute()
      : [];
    const today = this.clock.now().toISOString().slice(0, 10);
    return {
      proctor_live: detail.proctor_live,
      proctor_record: detail.proctor_record,
      students: detail.students.map((student) => {
        const dob = dobs.find((row) => row.id === student.child_id)?.dob;
        return {
          child_id: student.child_id,
          full_name: student.full_name,
          needs_parent_consent: needsParentConsent(dob === undefined || dob === null ? null : String(dob), today),
          consents: consents.get(student.child_id) ?? { live: null, record: null },
        };
      }),
    };
  }

  // Trường ghi nhận (hoặc thu hồi) văn bản đồng ý của cha mẹ: người quản lý đề, kiểm tra
  async recordSchoolConsent(
    currentUser: CurrentUser,
    input: {
      child_id: string;
      scope: ProctorConsentScope;
      granted: boolean;
      guardian_name: string | null;
      note: string | null;
    },
    origin: ChangeOrigin,
  ) {
    assertOnlineExamModule();
    if (!currentUser.hasPermission(MANAGE)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người quản lý đề, kiểm tra ghi nhận đồng ý của cha mẹ');
    }
    const { database } = await this.currentSchoolYear.require();
    const child = await database
      .selectFrom('children')
      .select('id')
      .where('id', '=', input.child_id)
      .executeTakeFirst();
    if (!child) {
      throw notFoundError('Không tìm thấy học sinh', 'child');
    }
    if (input.granted && !input.guardian_name) {
      throw validationError([{ field: 'guardian_name', message: 'Nhập họ tên người đã đồng ý' }]);
    }
    await this.setConsent(
      database,
      {
        childId: input.child_id,
        scope: input.scope,
        granted: input.granted,
        source: 'school',
        byId: currentUser.id,
        byName: input.guardian_name
          ? `${input.guardian_name} (ghi nhận: ${currentUser.description.full_name})`
          : currentUser.description.full_name,
        note: input.note,
      },
      origin,
    );
    return (await this.consentView(database, [input.child_id])).get(input.child_id);
  }

  private async guardianChildIds(database: Database, userId: string): Promise<string[]> {
    const rows = await database
      .selectFrom('child_guardians')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .select('child_guardians.child_id')
      .where('guardians.user_id', '=', userId)
      .execute();
    return [...new Set(rows.map((row) => row.child_id))];
  }

  // Phụ huynh: các con và tình trạng đồng ý
  async listForParent(currentUser: CurrentUser) {
    assertOnlineExamModule();
    const { database } = await this.currentSchoolYear.require();
    const ids = await this.guardianChildIds(database, currentUser.id);
    const children = ids.length
      ? await database
          .selectFrom('children')
          .select(['id', 'full_name', 'dob'])
          .where('id', 'in', ids)
          .where('status', '=', 'active')
          .where('deleted_at', 'is', null)
          .orderBy('full_name')
          .execute()
      : [];
    const consents = await this.consentView(
      database,
      children.map((child) => child.id),
    );
    const today = this.clock.now().toISOString().slice(0, 10);
    return {
      items: children.map((child) => ({
        child_id: child.id,
        full_name: child.full_name,
        needs_parent_consent: needsParentConsent(child.dob === null ? null : String(child.dob), today),
        consents: consents.get(child.id) ?? { live: null, record: null },
      })),
    };
  }

  async setForParent(
    currentUser: CurrentUser,
    input: { child_id: string; scope: ProctorConsentScope; granted: boolean },
    origin: ChangeOrigin,
  ) {
    assertOnlineExamModule();
    const { database } = await this.currentSchoolYear.require();
    const ids = await this.guardianChildIds(database, currentUser.id);
    if (!ids.includes(input.child_id)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Học sinh này không phải con của bạn');
    }
    await this.setConsent(
      database,
      {
        childId: input.child_id,
        scope: input.scope,
        granted: input.granted,
        source: 'parent',
        byId: currentUser.id,
        byName: currentUser.description.full_name,
        note: null,
      },
      origin,
    );
    return (await this.consentView(database, [input.child_id])).get(input.child_id);
  }

  // ----- Dọn dẹp -----

  // Xóa các đoạn bản ghi quá hạn (cả tệp ở kho) và thông điệp báo hiệu cũ; trả số đã xóa
  async purgeExpired(): Promise<{ chunks: number; signals: number }> {
    const { database } = await this.currentSchoolYear.require();
    const now = this.clock.now();
    const expired = await database
      .selectFrom('exam_recording_chunks')
      .select(['attempt_id', 'seq', 'storage_key'])
      .where('expires_at', '<=', now)
      .limit(500)
      .execute();
    for (const chunk of expired) {
      await this.fileStorage.delete(chunk.storage_key);
      await database
        .deleteFrom('exam_recording_chunks')
        .where('attempt_id', '=', chunk.attempt_id)
        .where('seq', '=', chunk.seq)
        .execute();
    }
    const signals = await database
      .deleteFrom('exam_proctor_signals')
      .where('created_at', '<', new Date(now.getTime() - 3_600_000))
      .executeTakeFirst();
    return { chunks: expired.length, signals: Number(signals.numDeletedRows) };
  }
}

// Việc nền: dọn bản ghi quá hạn mỗi giờ (một trường: hẹn giờ trong tiến trình; nhiều trường: bộ lập lịch theo từng trường)
@Injectable()
export class ExamProctoringJobs implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('ExamProctoringJobs');
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly proctoring: ExamProctoringService,
    @Optional() @Inject(JobScheduler) private readonly scheduler: JobScheduler | null = null,
  ) {}

  onApplicationBootstrap() {
    const run = async () => {
      try {
        await this.proctoring.purgeExpired();
      } catch (error) {
        this.logger.warn(`Không dọn được bản ghi giám thị: ${error instanceof Error ? error.message : String(error)}`);
      }
    };
    if (isMultiTenantMode()) {
      this.scheduler?.register({ name: 'exam-proctoring-cleanup', intervalSeconds: 3600, run });
      return;
    }
    this.timer = setInterval(() => void run(), 3_600_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }
}

export function readSignalKind(value: unknown): ProctorSignalKind {
  if (!PROCTOR_SIGNAL_KINDS.includes(value as ProctorSignalKind)) {
    throw validationError([
      { field: 'kind', message: `Loại thông điệp là một trong: ${PROCTOR_SIGNAL_KINDS.join(', ')}` },
    ]);
  }
  return value as ProctorSignalKind;
}

export function readSignalPayload(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAXIMUM_SIGNAL_CHARS) {
    throw validationError([{ field: 'payload', message: `Nội dung thông điệp tối đa ${MAXIMUM_SIGNAL_CHARS} ký tự` }]);
  }
  return value;
}
