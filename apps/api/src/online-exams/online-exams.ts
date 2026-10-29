import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import {
  PERMISSION_CODES,
  PROCTOR_EVENT_LABELS,
  RECORDING_RETENTION_DEFAULT_DAYS,
  type ExamAttemptPolicy,
  type ExamCameraFallback,
  type ExamMode,
  type ExamResultMode,
  type ExamSingleSessionMode,
  type ExamVariantMode,
  type ExamViolationAction,
  type ProctorEventType,
  type SchoolLevelCode,
} from '@school-management/shared';
import type { Kysely } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { notFoundError } from '../common/request-fields.js';
import { ExamGradingService } from '../exam-grading/exam-grading.js';
import { OPTION_KEYS } from '../exams/exam-rules.js';
import { GroupSetsReader } from '../child-groups/group-sets.js';
import { AttemptEngine } from './attempt-engine.js';
import { assertOnlineExamModule, ONLINE_EXAM_RULE_CODE } from './student-exams.js';
import {
  countViolations,
  generateRoomCode,
  keysToLabels,
  parseNetworkRange,
  windowState,
  type AttemptLayout,
} from './online-exam-rules.js';

// Phía giáo viên của thi trực tuyến (DT-23 phần 23a, YCTD-211): công tắc cho học sinh đăng nhập theo cấp, giao đề đã khoá cho lớp
// hoặc học sinh, theo dõi bài làm (số lần rời bài, sự kiện camera, phiên thứ hai), chấm câu tự luận, nộp thay, công bố kết quả.
// Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - quyền giao đề dùng P02.exam.assign: người quản lý (P02.exam.manage) giao cho mọi lớp cùng cấp, khối của đề; giáo viên khác
//   chỉ giao cho lớp mình chủ nhiệm hoặc dạy môn của đề (như tạo bài kiểm tra của lớp ở 22g2) và chỉ theo dõi bài do mình giao
//   hoặc của lớp mình dạy;
// - chỉ giao đề đã khoá (có mã đề, câu có bản chụp); đề có câu tự luận chỉ cho làm một lần (điểm tự luận gắn với lượt làm);
// - cấp học đã tắt thi trực tuyến thì không giao được;
// - điểm vào sổ điểm chỉ qua luồng 22g2: bài nộp xong tự vào phiếu chấm của bài kiểm tra lớp, giáo viên khoá điểm rồi xác nhận
//   chuyển ở 8.5 Chấm bài kiểm tra; sự kiện chống gian lận chỉ là căn cứ để giáo viên xét, không tự trừ điểm.
type Database = Kysely<SchoolYearDatabase>;

const MANAGE = PERMISSION_CODES.examManage;
export const ONLINE_EXAM_LEVELS: SchoolLevelCode[] = ['TH', 'THCS', 'THPT'];

// Nhật ký thao tác ghi mã thực thể dạng uuid; công tắc theo cấp khoá bằng mã cấp nên lấy uuid cố định từ mã cấp
function settingEntityId(level: string): string {
  const hex = createHash('md5').update(`online_exam_settings:${level}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export interface AssignmentInput {
  exam_id: string;
  title: string | null;
  opens_at: Date;
  closes_at: Date;
  duration_minutes: number;
  max_attempts: number;
  attempt_policy: ExamAttemptPolicy;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  variant_mode: ExamVariantMode;
  fixed_variant_code: string | null;
  result_mode: ExamResultMode;
  fullscreen_required: boolean;
  max_violations: number;
  violation_action: ExamViolationAction;
  camera_enabled: boolean;
  camera_fallback: ExamCameraFallback;
  single_session_mode: ExamSingleSessionMode;
  // Chế độ thi; để trống là mặc định của trường (at-school)
  exam_mode: ExamMode | null;
  // Giám thị camera (DT-23 phần 23e): trường phải bật ở cấu hình thi trực tuyến
  proctor_live: boolean;
  proctor_record: boolean;
  term_type: 'first_term' | 'second_term';
  score_kind: 'regular' | 'mid' | 'final';
  score_seq: number;
  true_false_rule: 'tiered' | 'proportional';
  absent_policy: 'skip' | 'zero';
  class_ids: string[];
  child_ids: string[];
  // Nhóm của bộ nhóm đang dùng (DT-28 phần 28a, YCTD-271)
  group_ids: string[];
}

export interface AssignmentChanges {
  title?: string;
  opens_at?: Date;
  closes_at?: Date;
  result_mode?: ExamResultMode;
}

@Injectable()
export class OnlineExamsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly engine: AttemptEngine,
    private readonly grading: ExamGradingService,
    private readonly groupSets: GroupSetsReader,
    private readonly clock: Clock,
  ) {}

  // Công tắc cho học sinh tự đăng nhập theo cấp (GD-105): chưa có dòng nghĩa là bật
  async settings() {
    assertOnlineExamModule();
    const { database } = await this.currentSchoolYear.require();
    const rows = await database
      .selectFrom('online_exam_settings')
      .select(['school_level', 'student_login_enabled', 'updated_by_name', 'updated_at'])
      .execute();
    return ONLINE_EXAM_LEVELS.map((level) => {
      const row = rows.find((item) => item.school_level === level);
      return {
        school_level: level,
        student_login_enabled: row?.student_login_enabled ?? true,
        updated_by_name: row?.updated_by_name ?? null,
        updated_at: row?.updated_at ?? null,
      };
    });
  }

  async updateSetting(currentUser: CurrentUser, level: SchoolLevelCode, enabled: boolean, origin: ChangeOrigin) {
    assertOnlineExamModule();
    if (!currentUser.hasPermission(MANAGE)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người quản lý đề, kiểm tra bật, tắt thi trực tuyến theo cấp');
    }
    const { database } = await this.currentSchoolYear.require();
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      const before = await transaction
        .selectFrom('online_exam_settings')
        .select('student_login_enabled')
        .where('school_level', '=', level)
        .executeTakeFirst();
      await transaction
        .insertInto('online_exam_settings')
        .values({
          school_level: level,
          student_login_enabled: enabled,
          updated_by: currentUser.id,
          updated_by_name: currentUser.description.full_name,
        })
        .onConflict((conflict) =>
          conflict.column('school_level').doUpdateSet({
            student_login_enabled: enabled,
            updated_by: currentUser.id,
            updated_by_name: currentUser.description.full_name,
            updated_at: now,
          }),
        )
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'online_exam_settings',
        entityId: settingEntityId(level),
        action: before ? 'update' : 'create',
        before: before ? { student_login_enabled: before.student_login_enabled } : null,
        after: { school_level: level, student_login_enabled: enabled },
      });
    });
    return this.settings();
  }

  // Cấu hình thi trực tuyến của cả trường: chế độ thi mặc định, cho phép thi từ xa, dải mạng của trường, thời hạn mã phòng
  async readSchoolSettings(database: Database) {
    const row = await database.selectFrom('online_exam_school_settings').selectAll().executeTakeFirst();
    return {
      default_exam_mode: row?.default_exam_mode ?? ('at-school' as ExamMode),
      allow_remote: row?.allow_remote ?? false,
      allowed_networks: (row?.allowed_networks as string[] | undefined) ?? [],
      room_code_minutes: row?.room_code_minutes ?? 60,
      allow_live_proctoring: row?.allow_live_proctoring ?? false,
      allow_recording: row?.allow_recording ?? false,
      recording_retention_days: row?.recording_retention_days ?? RECORDING_RETENTION_DEFAULT_DAYS,
      updated_by_name: row?.updated_by_name ?? null,
      updated_at: row?.updated_at ?? null,
    };
  }

  async schoolSettings() {
    assertOnlineExamModule();
    const { database } = await this.currentSchoolYear.require();
    return this.readSchoolSettings(database);
  }

  async updateSchoolSettings(
    currentUser: CurrentUser,
    input: {
      default_exam_mode: ExamMode;
      allow_remote: boolean;
      allowed_networks: string[];
      room_code_minutes: number;
      allow_live_proctoring?: boolean;
      allow_recording?: boolean;
      recording_retention_days?: number;
    },
    origin: ChangeOrigin,
  ) {
    assertOnlineExamModule();
    if (!currentUser.hasPermission(MANAGE)) {
      throw new ApplicationError(
        'ERR_FORBIDDEN',
        'Chỉ người quản lý đề, kiểm tra đặt chế độ thi và dải mạng của trường',
      );
    }
    const invalid = input.allowed_networks.filter((text) => parseNetworkRange(text) === null);
    if (invalid.length > 0) {
      throw validationError([
        { field: 'allowed_networks', message: `Dải mạng không hợp lệ: ${invalid.join(', ')} (ví dụ 10.0.0.0/8)` },
      ]);
    }
    if (input.default_exam_mode === 'remote' && !input.allow_remote) {
      throw validationError([
        { field: 'default_exam_mode', message: 'Chế độ thi từ xa phải được bật trước khi đặt làm mặc định' },
      ]);
    }
    const { database } = await this.currentSchoolYear.require();
    const before = await this.readSchoolSettings(database);
    const now = this.clock.now();
    const values = {
      allow_live_proctoring: input.allow_live_proctoring ?? before.allow_live_proctoring,
      allow_recording: input.allow_recording ?? before.allow_recording,
      recording_retention_days: input.recording_retention_days ?? before.recording_retention_days,
      default_exam_mode: input.default_exam_mode,
      allow_remote: input.allow_remote,
      allowed_networks: JSON.stringify(input.allowed_networks),
      room_code_minutes: input.room_code_minutes,
      updated_by: currentUser.id,
      updated_by_name: currentUser.description.full_name,
    };
    await database.transaction().execute(async (transaction) => {
      await transaction
        .insertInto('online_exam_school_settings')
        .values({ id: true, ...values })
        .onConflict((conflict) => conflict.column('id').doUpdateSet({ ...values, updated_at: now }))
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'online_exam_school_settings',
        entityId: settingEntityId('school'),
        action: 'update',
        before,
        after: input,
      });
    });
    return this.readSchoolSettings(database);
  }

  // Phòng thi của bài giao (chế độ at-school): mã, hạn, số học sinh được vào và đã vào
  private async roomsOf(database: Database, assignmentId: string) {
    const rooms = await database
      .selectFrom('exam_rooms')
      .select(['id', 'code', 'opened_by_name', 'opened_at', 'expires_at', 'closed_at'])
      .where('assignment_id', '=', assignmentId)
      .orderBy('opened_at', 'desc')
      .execute();
    const members = rooms.length
      ? await database
          .selectFrom('exam_room_students')
          .select(['room_id', 'entered_at'])
          .where(
            'room_id',
            'in',
            rooms.map((room) => room.id),
          )
          .execute()
      : [];
    const now = this.clock.now();
    return rooms.map((room) => {
      const mine = members.filter((member) => member.room_id === room.id);
      return {
        id: room.id,
        code: room.code,
        opened_by_name: room.opened_by_name,
        opened_at: room.opened_at,
        expires_at: room.expires_at,
        closed_at: room.closed_at,
        open: room.closed_at === null && room.expires_at > now,
        students: mine.length,
        entered: mine.filter((member) => member.entered_at !== null).length,
      };
    });
  }

  // Giám thị mở phòng thi: mã 6 chữ số có hạn (mặc định theo trường), danh sách học sinh được vào (bỏ trống là mọi học sinh được giao)
  async openRoom(currentUser: CurrentUser, assignmentId: string, childIds: string[] | null, origin: ChangeOrigin) {
    assertOnlineExamModule();
    const { database } = await this.currentSchoolYear.require();
    const assignment = await this.assertCanManage(database, currentUser, assignmentId);
    if (assignment.status === 'cancelled') {
      throw ruleViolationError(ONLINE_EXAM_RULE_CODE, 'Bài thi đã huỷ, không mở phòng được');
    }
    if (assignment.exam_mode !== 'at-school') {
      throw ruleViolationError(ONLINE_EXAM_RULE_CODE, 'Bài thi từ xa không có phòng thi');
    }
    const roster = ((await this.rosters(database, [assignmentId])).get(assignmentId) ?? []).map((row) => row.child_id);
    const chosen = childIds ?? roster;
    if (chosen.length === 0 || chosen.some((id) => !roster.includes(id))) {
      throw validationError([{ field: 'child_ids', message: 'Chọn ít nhất một học sinh trong danh sách được giao' }]);
    }
    const settings = await this.readSchoolSettings(database);
    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + settings.room_code_minutes * 60_000);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = generateRoomCode();
      try {
        await database.transaction().execute(async (transaction) => {
          const row = await transaction
            .insertInto('exam_rooms')
            .values({
              assignment_id: assignmentId,
              code,
              opened_by: currentUser.id,
              opened_by_name: currentUser.description.full_name,
              expires_at: expiresAt,
            })
            .returning('id')
            .executeTakeFirstOrThrow();
          await transaction
            .insertInto('exam_room_students')
            .values(chosen.map((childId) => ({ room_id: row.id, child_id: childId })))
            .execute();
          await writeAuditLog(transaction, {
            origin,
            orgUnitId: null,
            entityName: 'exam_rooms',
            entityId: row.id,
            action: 'create',
            before: null,
            after: { assignment_id: assignmentId, students: chosen.length, expires_at: expiresAt },
          });
        });
        return this.detail(currentUser, assignmentId);
      } catch (error) {
        // Trùng mã với phòng đang mở khác: bốc mã khác
        if (!(error instanceof Error) || !/exam_rooms_open_code_index/.test(error.message)) {
          throw error;
        }
      }
    }
    throw new ApplicationError('ERR_INTERNAL', 'Không tạo được mã phòng thi, thử lại');
  }

  async closeRoom(currentUser: CurrentUser, roomId: string, origin: ChangeOrigin) {
    assertOnlineExamModule();
    const { database } = await this.currentSchoolYear.require();
    const room = await database.selectFrom('exam_rooms').selectAll().where('id', '=', roomId).executeTakeFirst();
    if (!room) {
      throw notFoundError('Không tìm thấy phòng thi', 'exam_room');
    }
    await this.assertCanManage(database, currentUser, room.assignment_id);
    if (room.closed_at !== null) {
      throw ruleViolationError(ONLINE_EXAM_RULE_CODE, 'Phòng thi đã đóng');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('exam_rooms')
        .set({ closed_at: this.clock.now(), closed_by_name: currentUser.description.full_name })
        .where('id', '=', roomId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'exam_rooms',
        entityId: roomId,
        action: 'update',
        before: { closed: false },
        after: { closed: true },
      });
    });
    return this.detail(currentUser, room.assignment_id);
  }

  // Đề đã khoá, lớp giao được (theo quyền của người gọi): dùng lại danh sách của 22g2
  async lockedExams(level: SchoolLevelCode) {
    assertOnlineExamModule();
    return this.grading.lockedExams(level);
  }

  async classesFor(currentUser: CurrentUser, examId: string) {
    assertOnlineExamModule();
    return this.grading.classesFor(currentUser, examId);
  }

  // Lớp người này được giao đề, theo dõi: người quản lý mọi lớp; người khác lớp chủ nhiệm hoặc dạy môn của đề
  private async teachableClassIds(
    database: Database,
    currentUser: CurrentUser,
    subjectId: string | null,
  ): Promise<Set<string> | 'all'> {
    if (currentUser.hasPermission(MANAGE)) {
      return 'all';
    }
    const rows = await database
      .selectFrom('class_staff_assignments')
      .select(['class_id', 'assignment_role', 'subject_id'])
      .where('staff_user_id', '=', currentUser.id)
      .where('status', '=', 'active')
      .execute();
    return new Set(
      rows
        .filter((row) => row.assignment_role === 'homeroom' || subjectId === null || row.subject_id === subjectId)
        .map((row) => row.class_id),
    );
  }

  async createAssignment(currentUser: CurrentUser, input: AssignmentInput, origin: ChangeOrigin) {
    assertOnlineExamModule();
    const { database } = await this.currentSchoolYear.require();
    const exam = await database
      .selectFrom('exams')
      .select(['id', 'title', 'school_level', 'grade_level_code', 'subject_id', 'status'])
      .where('id', '=', input.exam_id)
      .executeTakeFirst();
    if (!exam) {
      throw notFoundError('Không tìm thấy đề', 'exam');
    }
    if (exam.status !== 'locked') {
      throw ruleViolationError(ONLINE_EXAM_RULE_CODE, 'Chỉ giao được đề đã khoá');
    }
    if (!ONLINE_EXAM_LEVELS.includes(exam.school_level)) {
      throw ruleViolationError(ONLINE_EXAM_RULE_CODE, 'Thi trực tuyến có từ cấp Tiểu học trở lên');
    }
    const setting = await database
      .selectFrom('online_exam_settings')
      .select('student_login_enabled')
      .where('school_level', '=', exam.school_level)
      .executeTakeFirst();
    if (setting && !setting.student_login_enabled) {
      throw ruleViolationError(ONLINE_EXAM_RULE_CODE, 'Trường đã tắt thi trực tuyến cho cấp học của đề này');
    }
    const content = await this.engine.loadContent(database, exam.id);
    if (content.variants.length === 0) {
      throw ruleViolationError(ONLINE_EXAM_RULE_CODE, 'Đề chưa trộn mã đề');
    }
    if (input.variant_mode === 'fixed' && !content.variants.some((row) => row.code === input.fixed_variant_code)) {
      throw validationError([{ field: 'fixed_variant_code', message: 'Mã đề không có trong đề' }]);
    }
    if (input.max_attempts > 1 && content.questions.some((question) => question.question_type === 'essay')) {
      throw ruleViolationError(
        ONLINE_EXAM_RULE_CODE,
        'Đề có câu tự luận chỉ cho làm một lần vì điểm tự luận gắn với từng lượt làm',
      );
    }
    const now = this.clock.now();
    if (input.closes_at <= now) {
      throw validationError([{ field: 'closes_at', message: 'Giờ đóng phải sau thời điểm hiện tại' }]);
    }
    if (input.closes_at <= input.opens_at) {
      throw validationError([{ field: 'closes_at', message: 'Giờ đóng phải sau giờ mở' }]);
    }
    const schoolSettings = await this.readSchoolSettings(database);
    const examMode: ExamMode = input.exam_mode ?? schoolSettings.default_exam_mode;
    if (examMode === 'remote' && !schoolSettings.allow_remote) {
      throw ruleViolationError(
        ONLINE_EXAM_RULE_CODE,
        'Trường chưa bật chế độ thi từ xa; mặc định chỉ thi tại trường, quản trị trường bật ở Cấu hình thi trực tuyến',
      );
    }
    if (input.proctor_live || input.proctor_record) {
      const missing: FieldError[] = [];
      if (input.proctor_live && !schoolSettings.allow_live_proctoring) {
        missing.push({ field: 'proctor_live', message: 'Trường chưa bật xem camera trực tiếp' });
      }
      if (input.proctor_record && !schoolSettings.allow_recording) {
        missing.push({ field: 'proctor_record', message: 'Trường chưa bật ghi hình' });
      }
      if (missing.length > 0) {
        throw ruleViolationError(
          ONLINE_EXAM_RULE_CODE,
          'Trường chưa bật giám sát bằng camera; quản trị trường bật ở Cấu hình thi trực tuyến',
          missing,
        );
      }
      if (!input.camera_enabled) {
        throw validationError([
          { field: 'camera_enabled', message: 'Giám sát bằng camera cần bật camera cho bài thi' },
        ]);
      }
    }
    const scope = await this.teachableClassIds(database, currentUser, exam.subject_id);
    // Đích nhóm (DT-28 phần 28a): nhóm phải thuộc bộ nhóm đang dùng; thành viên lúc giao được kiểm và giao như học sinh
    const groups = input.group_ids.length
      ? await database
          .selectFrom('child_groups')
          .innerJoin('group_sets', 'group_sets.id', 'child_groups.group_set_id')
          .select(['child_groups.id', 'child_groups.name'])
          .where('child_groups.id', 'in', input.group_ids)
          .where('group_sets.status', '=', 'active')
          .execute()
      : [];
    if (groups.length !== input.group_ids.length) {
      throw notFoundError('Có nhóm không tồn tại hoặc thuộc bộ nhóm đã lưu trữ', 'child_group');
    }
    const memberSource = new Map<string, string>();
    for (const group of groups) {
      const members = await this.groupSets.childIdsOfGroup(database, group.id);
      if (members.length === 0) {
        throw validationError([{ field: 'group_ids', message: `Nhóm ${group.name} chưa có học sinh` }]);
      }
      for (const childId of members) {
        if (!input.child_ids.includes(childId) && !memberSource.has(childId)) {
          memberSource.set(childId, group.id);
        }
      }
    }
    const allChildIds = [...input.child_ids, ...memberSource.keys()];
    const classes = input.class_ids.length
      ? await database
          .selectFrom('classes')
          .select(['id', 'school_level', 'grade_level', 'name'])
          .where('id', 'in', input.class_ids)
          .execute()
      : [];
    if (classes.length !== input.class_ids.length) {
      throw notFoundError('Có lớp không tồn tại', 'class');
    }
    const children = allChildIds.length
      ? await database
          .selectFrom('children')
          .leftJoin('class_enrollments', (join) =>
            join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
          )
          .leftJoin('classes', 'classes.id', 'class_enrollments.class_id')
          .select([
            'children.id',
            'children.status',
            'classes.id as class_id',
            'classes.school_level',
            'classes.grade_level',
          ])
          .where('children.id', 'in', allChildIds)
          .where('children.deleted_at', 'is', null)
          .execute()
      : [];
    if (children.length !== allChildIds.length) {
      throw notFoundError('Có học sinh không tồn tại', 'child');
    }
    const classProblems = [
      ...classes.map((row) => ({ id: row.id, school_level: row.school_level, grade_level: row.grade_level })),
      ...children.map((row) => ({ id: row.class_id, school_level: row.school_level, grade_level: row.grade_level })),
    ];
    for (const row of classProblems) {
      if (!row.id || row.school_level !== exam.school_level || row.grade_level !== exam.grade_level_code) {
        throw validationError([
          { field: 'targets', message: 'Lớp hoặc học sinh khác cấp, khối của đề, hoặc chưa xếp lớp' },
        ]);
      }
      if (scope !== 'all' && !scope.has(row.id)) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ giao đề cho lớp mình chủ nhiệm hoặc dạy môn của đề');
      }
    }
    const created = await database.transaction().execute(async (transaction) => {
      const row = await transaction
        .insertInto('exam_assignments')
        .values({
          exam_id: exam.id,
          school_level: exam.school_level,
          title: input.title ?? exam.title,
          opens_at: input.opens_at,
          closes_at: input.closes_at,
          duration_minutes: input.duration_minutes,
          max_attempts: input.max_attempts,
          attempt_policy: input.attempt_policy,
          shuffle_questions: input.shuffle_questions,
          shuffle_options: input.shuffle_options,
          variant_mode: input.variant_mode,
          fixed_variant_code: input.variant_mode === 'fixed' ? input.fixed_variant_code : null,
          result_mode: input.result_mode,
          fullscreen_required: input.fullscreen_required,
          max_violations: input.max_violations,
          violation_action: input.violation_action,
          camera_enabled: input.camera_enabled,
          camera_fallback: input.camera_fallback,
          single_session_mode: input.single_session_mode,
          exam_mode: examMode,
          proctor_live: input.proctor_live,
          proctor_record: input.proctor_record,
          term_type: input.term_type,
          score_kind: input.score_kind,
          score_seq: input.score_kind === 'regular' ? input.score_seq : 1,
          true_false_rule: input.true_false_rule,
          absent_policy: input.absent_policy,
          created_by: currentUser.id,
          created_by_name: currentUser.description.full_name,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      const targets = [
        ...input.class_ids.map((classId) => ({
          assignment_id: row.id,
          kind: 'class' as const,
          class_id: classId,
          child_id: null,
          group_id: null,
        })),
        ...input.child_ids.map((childId) => ({
          assignment_id: row.id,
          kind: 'student' as const,
          class_id: null,
          child_id: childId,
          group_id: null,
        })),
        ...groups.map((group) => ({
          assignment_id: row.id,
          kind: 'group' as const,
          class_id: null,
          child_id: null,
          group_id: group.id,
        })),
        ...[...memberSource.entries()].map(([childId, groupId]) => ({
          assignment_id: row.id,
          kind: 'student' as const,
          class_id: null,
          child_id: childId,
          group_id: groupId,
        })),
      ];
      await transaction.insertInto('exam_assignment_targets').values(targets).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'exam_assignments',
        entityId: row.id,
        action: 'create',
        before: null,
        after: { ...input, exam_title: exam.title },
      });
      return row;
    });
    return this.detail(currentUser, created.id);
  }

  // Danh sách học sinh được giao của các bài: lớp thì học sinh đang học của lớp, cộng học sinh được giao riêng
  private async rosters(database: Database, assignmentIds: string[]) {
    const roster = new Map<string, Array<{ child_id: string; full_name: string; class_name: string | null }>>();
    if (assignmentIds.length === 0) {
      return roster;
    }
    const targets = await database
      .selectFrom('exam_assignment_targets')
      .select(['assignment_id', 'kind', 'class_id', 'child_id'])
      .where('assignment_id', 'in', assignmentIds)
      .execute();
    const classIds = [...new Set(targets.flatMap((target) => (target.class_id ? [target.class_id] : [])))];
    const childIds = [...new Set(targets.flatMap((target) => (target.child_id ? [target.child_id] : [])))];
    const members = classIds.length
      ? await database
          .selectFrom('class_enrollments')
          .innerJoin('children', 'children.id', 'class_enrollments.child_id')
          .innerJoin('classes', 'classes.id', 'class_enrollments.class_id')
          .select(['class_enrollments.class_id', 'children.id as child_id', 'children.full_name', 'classes.name'])
          .where('class_enrollments.class_id', 'in', classIds)
          .where('class_enrollments.is_current', '=', true)
          .where('children.status', '=', 'active')
          .where('children.deleted_at', 'is', null)
          .orderBy('children.full_name')
          .execute()
      : [];
    const singles = childIds.length
      ? await database
          .selectFrom('children')
          .leftJoin('class_enrollments', (join) =>
            join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
          )
          .leftJoin('classes', 'classes.id', 'class_enrollments.class_id')
          .select(['children.id as child_id', 'children.full_name', 'classes.name'])
          .where('children.id', 'in', childIds)
          .execute()
      : [];
    for (const assignmentId of assignmentIds) {
      const mine = targets.filter((target) => target.assignment_id === assignmentId);
      const rows = new Map<string, { child_id: string; full_name: string; class_name: string | null }>();
      for (const target of mine) {
        if (target.class_id) {
          for (const member of members.filter((row) => row.class_id === target.class_id)) {
            rows.set(member.child_id, {
              child_id: member.child_id,
              full_name: member.full_name,
              class_name: member.name,
            });
          }
        } else {
          const single = singles.find((row) => row.child_id === target.child_id);
          if (single) {
            rows.set(single.child_id, {
              child_id: single.child_id,
              full_name: single.full_name,
              class_name: single.name,
            });
          }
        }
      }
      roster.set(
        assignmentId,
        [...rows.values()].sort((left, right) => left.full_name.localeCompare(right.full_name, 'vi')),
      );
    }
    return roster;
  }

  // Người này xem, quản lý được bài giao không: người quản lý, người giao, hoặc người chủ nhiệm hay dạy môn của đề ở mọi lớp được
  // giao (PQ-109); thao tác trên bài, lượt làm áp cho mọi học sinh của bài nên phải có phạm vi với mọi lớp
  async assertCanManage(database: Database, currentUser: CurrentUser, assignmentId: string) {
    const assignment = await database
      .selectFrom('exam_assignments')
      .innerJoin('exams', 'exams.id', 'exam_assignments.exam_id')
      .innerJoin('subjects', 'subjects.id', 'exams.subject_id')
      .select([
        'exam_assignments.id',
        'exam_assignments.exam_id',
        'exam_assignments.title',
        'exam_assignments.created_by',
        'exam_assignments.created_by_name',
        'exam_assignments.opens_at',
        'exam_assignments.closes_at',
        'exam_assignments.duration_minutes',
        'exam_assignments.max_attempts',
        'exam_assignments.attempt_policy',
        'exam_assignments.shuffle_questions',
        'exam_assignments.shuffle_options',
        'exam_assignments.variant_mode',
        'exam_assignments.fixed_variant_code',
        'exam_assignments.result_mode',
        'exam_assignments.results_released_at',
        'exam_assignments.fullscreen_required',
        'exam_assignments.max_violations',
        'exam_assignments.violation_action',
        'exam_assignments.camera_enabled',
        'exam_assignments.camera_fallback',
        'exam_assignments.single_session_mode',
        'exam_assignments.exam_mode',
        'exam_assignments.proctor_live',
        'exam_assignments.proctor_record',
        'exam_assignments.term_type',
        'exam_assignments.score_kind',
        'exam_assignments.score_seq',
        'exam_assignments.status',
        'exams.school_level',
        'exams.subject_id',
        'subjects.name as subject_name',
      ])
      .where('exam_assignments.id', '=', assignmentId)
      .executeTakeFirst();
    if (!assignment) {
      throw notFoundError('Không tìm thấy bài thi đã giao', 'exam_assignment');
    }
    if (currentUser.hasPermission(MANAGE) || assignment.created_by === currentUser.id) {
      return assignment;
    }
    const scope = await this.teachableClassIds(database, currentUser, assignment.subject_id);
    const targets = await database
      .selectFrom('exam_assignment_targets')
      .leftJoin('class_enrollments', (join) =>
        join
          .onRef('class_enrollments.child_id', '=', 'exam_assignment_targets.child_id')
          .on('class_enrollments.is_current', '=', true),
      )
      .select(['exam_assignment_targets.class_id', 'class_enrollments.class_id as enrolled_class_id'])
      .where('exam_assignment_targets.assignment_id', '=', assignmentId)
      .execute();
    const taught =
      scope !== 'all' &&
      targets.length > 0 &&
      targets.every(
        (target) =>
          (target.class_id !== null && scope.has(target.class_id)) ||
          (target.enrolled_class_id !== null && scope.has(target.enrolled_class_id)),
      );
    if (!taught) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không giao hay dạy lớp của bài thi này');
    }
    return assignment;
  }

  async list(currentUser: CurrentUser, level: SchoolLevelCode) {
    assertOnlineExamModule();
    const { database } = await this.currentSchoolYear.require();
    const rows = await database
      .selectFrom('exam_assignments')
      .innerJoin('exams', 'exams.id', 'exam_assignments.exam_id')
      .innerJoin('subjects', 'subjects.id', 'exams.subject_id')
      .select([
        'exam_assignments.id',
        'exam_assignments.title',
        'exam_assignments.created_by',
        'exam_assignments.created_by_name',
        'exam_assignments.opens_at',
        'exam_assignments.closes_at',
        'exam_assignments.duration_minutes',
        'exam_assignments.status',
        'exams.subject_id',
        'subjects.name as subject_name',
      ])
      .where('exam_assignments.school_level', '=', level)
      .orderBy('exam_assignments.opens_at', 'desc')
      .execute();
    // Người quản lý thấy mọi bài; giáo viên chỉ thấy bài mình giao hoặc của lớp mình dạy (kiểm từng bài)
    const manager = currentUser.hasPermission(MANAGE);
    const visible: typeof rows = manager ? [...rows] : [];
    for (const row of manager ? [] : rows) {
      try {
        await this.assertCanManage(database, currentUser, row.id);
        visible.push(row);
      } catch (error) {
        if (!(error instanceof ApplicationError) || error.code !== 'ERR_FORBIDDEN') {
          throw error;
        }
      }
    }
    await this.engine.finalizeExpired(database);
    const ids = visible.map((row) => row.id);
    const rosters = await this.rosters(database, ids);
    const attempts = ids.length
      ? await database
          .selectFrom('exam_attempts')
          .select(['assignment_id', 'child_id', 'status', 'flagged'])
          .where('assignment_id', 'in', ids)
          .execute()
      : [];
    const now = this.clock.now();
    return visible.map((row) => {
      const mine = attempts.filter((attempt) => attempt.assignment_id === row.id);
      return {
        id: row.id,
        title: row.title,
        subject_name: row.subject_name,
        created_by_name: row.created_by_name,
        opens_at: row.opens_at,
        closes_at: row.closes_at,
        duration_minutes: row.duration_minutes,
        status: row.status,
        window: windowState(now, row.opens_at, row.closes_at),
        students: rosters.get(row.id)?.length ?? 0,
        started: new Set(mine.map((attempt) => attempt.child_id)).size,
        submitted: new Set(mine.filter((attempt) => attempt.status === 'submitted').map((attempt) => attempt.child_id))
          .size,
        flagged: new Set(mine.filter((attempt) => attempt.flagged).map((attempt) => attempt.child_id)).size,
      };
    });
  }

  // Chi tiết, theo dõi một bài giao: cấu hình, đối tượng, từng học sinh (số lượt, trạng thái, điểm, số lần rời bài, camera)
  async detail(currentUser: CurrentUser, assignmentId: string) {
    assertOnlineExamModule();
    const { database } = await this.currentSchoolYear.require();
    const assignment = await this.assertCanManage(database, currentUser, assignmentId);
    await this.engine.finalizeExpired(database, { assignmentId });
    const [rosters, targets, attempts, events] = await Promise.all([
      this.rosters(database, [assignmentId]),
      database
        .selectFrom('exam_assignment_targets')
        .leftJoin('classes', 'classes.id', 'exam_assignment_targets.class_id')
        .leftJoin('children', 'children.id', 'exam_assignment_targets.child_id')
        .leftJoin('child_groups', 'child_groups.id', 'exam_assignment_targets.group_id')
        .select([
          'exam_assignment_targets.kind',
          'exam_assignment_targets.class_id',
          'exam_assignment_targets.child_id',
          'exam_assignment_targets.group_id',
          'classes.name as class_name',
          'children.full_name as child_name',
          'child_groups.name as group_name',
        ])
        .where('exam_assignment_targets.assignment_id', '=', assignmentId)
        .execute(),
      database
        .selectFrom('exam_attempts')
        .select([
          'id',
          'child_id',
          'attempt_no',
          'status',
          'started_at',
          'submitted_at',
          'submit_reason',
          'objective_score',
          'essay_score',
          'total_score',
          'max_score',
          'needs_marking',
          'flagged',
          'flag_reasons',
          'camera_state',
          'sheet_synced',
        ])
        .where('assignment_id', '=', assignmentId)
        .orderBy('attempt_no')
        .execute(),
      database
        .selectFrom('exam_attempt_events')
        .innerJoin('exam_attempts', 'exam_attempts.id', 'exam_attempt_events.attempt_id')
        .select(['exam_attempt_events.attempt_id', 'exam_attempt_events.event_type', 'exam_attempt_events.occurred_at'])
        .where('exam_attempts.assignment_id', '=', assignmentId)
        .execute(),
    ]);
    const now = this.clock.now();
    return {
      id: assignment.id,
      exam_id: assignment.exam_id,
      title: assignment.title,
      subject_name: assignment.subject_name,
      school_level: assignment.school_level,
      created_by_name: assignment.created_by_name,
      status: assignment.status,
      window: windowState(now, assignment.opens_at, assignment.closes_at),
      opens_at: assignment.opens_at,
      closes_at: assignment.closes_at,
      duration_minutes: assignment.duration_minutes,
      max_attempts: assignment.max_attempts,
      attempt_policy: assignment.attempt_policy,
      shuffle_questions: assignment.shuffle_questions,
      shuffle_options: assignment.shuffle_options,
      variant_mode: assignment.variant_mode,
      fixed_variant_code: assignment.fixed_variant_code,
      result_mode: assignment.result_mode,
      results_released_at: assignment.results_released_at,
      fullscreen_required: assignment.fullscreen_required,
      max_violations: assignment.max_violations,
      violation_action: assignment.violation_action,
      camera_enabled: assignment.camera_enabled,
      camera_fallback: assignment.camera_fallback,
      single_session_mode: assignment.single_session_mode,
      exam_mode: assignment.exam_mode,
      proctor_live: assignment.proctor_live,
      proctor_record: assignment.proctor_record,
      rooms: await this.roomsOf(database, assignmentId),
      term_type: assignment.term_type,
      score_kind: assignment.score_kind,
      score_seq: assignment.score_seq,
      // Học sinh được giao qua nhóm hiện dưới dòng nhóm, không hiện riêng
      targets: targets
        .filter((target) => !(target.kind === 'student' && target.group_id !== null))
        .map((target) => ({
          kind: target.kind,
          label:
            target.kind === 'class'
              ? (target.class_name ?? '')
              : target.kind === 'group'
                ? (target.group_name ?? '')
                : (target.child_name ?? ''),
        })),
      students: (rosters.get(assignmentId) ?? []).map((student) => {
        const mine = attempts.filter((attempt) => attempt.child_id === student.child_id);
        const mineEvents = events.filter((event) => mine.some((attempt) => attempt.id === event.attempt_id));
        const counts: Record<string, number> = {};
        for (const event of mineEvents) {
          counts[event.event_type] = (counts[event.event_type] ?? 0) + 1;
        }
        return {
          ...student,
          attempts: mine.map((attempt) => ({
            id: attempt.id,
            attempt_no: attempt.attempt_no,
            status: attempt.status,
            started_at: attempt.started_at,
            submitted_at: attempt.submitted_at,
            submit_reason: attempt.submit_reason,
            objective_score: attempt.objective_score === null ? null : Number(attempt.objective_score),
            total_score: attempt.total_score === null ? null : Number(attempt.total_score),
            max_score: attempt.max_score === null ? null : Number(attempt.max_score),
            needs_marking: attempt.needs_marking,
            flagged: attempt.flagged,
            flag_reasons: attempt.flag_reasons as string[],
            camera_state: attempt.camera_state,
            sheet_synced: attempt.sheet_synced,
          })),
          violations: countViolations(mineEvents),
          event_counts: counts,
        };
      }),
    };
  }

  async update(currentUser: CurrentUser, assignmentId: string, changes: AssignmentChanges, origin: ChangeOrigin) {
    assertOnlineExamModule();
    const { database } = await this.currentSchoolYear.require();
    const assignment = await this.assertCanManage(database, currentUser, assignmentId);
    if (assignment.status === 'cancelled') {
      throw ruleViolationError(ONLINE_EXAM_RULE_CODE, 'Bài thi đã huỷ, không sửa được');
    }
    const opens = changes.opens_at ?? assignment.opens_at;
    const closes = changes.closes_at ?? assignment.closes_at;
    if (closes <= opens) {
      throw validationError([{ field: 'closes_at', message: 'Giờ đóng phải sau giờ mở' }]);
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('exam_assignments')
        .set({ ...changes, updated_at: this.clock.now() })
        .where('id', '=', assignmentId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'exam_assignments',
        entityId: assignmentId,
        action: 'update',
        before: {
          title: assignment.title,
          opens_at: assignment.opens_at,
          closes_at: assignment.closes_at,
          result_mode: assignment.result_mode,
        },
        after: changes,
      });
    });
    return this.detail(currentUser, assignmentId);
  }

  // Huỷ bài: học sinh không vào được nữa; lượt đang làm được chốt như giáo viên nộp thay
  async cancel(currentUser: CurrentUser, assignmentId: string, origin: ChangeOrigin) {
    assertOnlineExamModule();
    const { database } = await this.currentSchoolYear.require();
    const assignment = await this.assertCanManage(database, currentUser, assignmentId);
    if (assignment.status === 'cancelled') {
      throw ruleViolationError(ONLINE_EXAM_RULE_CODE, 'Bài thi đã huỷ');
    }
    await database
      .updateTable('exam_assignments')
      .set({ status: 'cancelled', updated_at: this.clock.now() })
      .where('id', '=', assignmentId)
      .execute();
    const open = await database
      .selectFrom('exam_attempts')
      .select('id')
      .where('assignment_id', '=', assignmentId)
      .where('status', '=', 'in_progress')
      .execute();
    for (const attempt of open) {
      await this.engine.finalize(database, attempt.id, 'teacher');
    }
    await writeAuditLog(database, {
      origin,
      orgUnitId: null,
      entityName: 'exam_assignments',
      entityId: assignmentId,
      action: 'update',
      before: { status: assignment.status },
      after: { status: 'cancelled' },
    });
    return this.detail(currentUser, assignmentId);
  }

  async releaseResults(currentUser: CurrentUser, assignmentId: string, origin: ChangeOrigin) {
    assertOnlineExamModule();
    const { database } = await this.currentSchoolYear.require();
    const assignment = await this.assertCanManage(database, currentUser, assignmentId);
    if (assignment.result_mode !== 'teacher_release') {
      throw ruleViolationError(ONLINE_EXAM_RULE_CODE, 'Bài này không chọn chế độ giáo viên công bố kết quả');
    }
    const now = this.clock.now();
    await database
      .updateTable('exam_assignments')
      .set({ results_released_at: now, updated_at: now })
      .where('id', '=', assignmentId)
      .execute();
    await writeAuditLog(database, {
      origin,
      orgUnitId: null,
      entityName: 'exam_assignments',
      entityId: assignmentId,
      action: 'update',
      before: { results_released_at: assignment.results_released_at },
      after: { results_released_at: now },
    });
    return this.detail(currentUser, assignmentId);
  }

  // Bài làm của một lượt cho giáo viên xem: câu hỏi, đáp án đúng, câu trả lời, điểm, dòng thời gian sự kiện
  async attemptDetail(currentUser: CurrentUser, attemptId: string) {
    assertOnlineExamModule();
    const { database } = await this.currentSchoolYear.require();
    const attempt = await database
      .selectFrom('exam_attempts')
      .selectAll()
      .where('id', '=', attemptId)
      .executeTakeFirst();
    if (!attempt) {
      throw notFoundError('Không tìm thấy bài làm', 'exam_attempt');
    }
    const assignment = await this.assertCanManage(database, currentUser, attempt.assignment_id);
    const [content, student, events] = await Promise.all([
      this.engine.loadContent(database, assignment.exam_id),
      database
        .selectFrom('children')
        .select(['id', 'full_name'])
        .where('id', '=', attempt.child_id)
        .executeTakeFirstOrThrow(),
      database
        .selectFrom('exam_attempt_events')
        .select(['event_type', 'occurred_at', 'client_at', 'detail'])
        .where('attempt_id', '=', attemptId)
        .orderBy('occurred_at')
        .execute(),
    ]);
    const variant = content.variants.find((row) => row.code === attempt.variant_code);
    const layout = attempt.layout as AttemptLayout;
    const answers = attempt.answers as Record<string, string[]>;
    const marks = attempt.essay_marks as Record<string, number>;
    const results = attempt.results as Array<{
      question_id: string;
      number: number;
      earned: number;
      correct: boolean | null;
    }>;
    const items = new Map((variant?.items ?? []).map((item) => [item.number, item]));
    return {
      id: attempt.id,
      assignment_id: attempt.assignment_id,
      title: assignment.title,
      child_id: student.id,
      full_name: student.full_name,
      attempt_no: attempt.attempt_no,
      status: attempt.status,
      variant_code: attempt.variant_code,
      started_at: attempt.started_at,
      deadline_at: attempt.deadline_at,
      submitted_at: attempt.submitted_at,
      submit_reason: attempt.submit_reason,
      objective_score: attempt.objective_score === null ? null : Number(attempt.objective_score),
      essay_score: attempt.essay_score === null ? null : Number(attempt.essay_score),
      total_score: attempt.total_score === null ? null : Number(attempt.total_score),
      max_score: attempt.max_score === null ? null : Number(attempt.max_score),
      needs_marking: attempt.needs_marking,
      flagged: attempt.flagged,
      flag_reasons: attempt.flag_reasons as string[],
      camera_state: attempt.camera_state,
      sheet_synced: attempt.sheet_synced,
      events: events.map((event) => ({
        type: event.event_type,
        label: PROCTOR_EVENT_LABELS[event.event_type as ProctorEventType],
        occurred_at: event.occurred_at,
        client_at: event.client_at,
        detail: event.detail,
      })),
      questions: layout.order.flatMap((number, index) => {
        const item = items.get(number);
        const snapshot = item ? content.snapshots.get(item.question_id) : undefined;
        const question = content.questions.find((row) => row.question_id === item?.question_id);
        const result = results.find((row) => row.number === number);
        if (!item || !snapshot || !question) {
          return [];
        }
        const given = answers[String(number)] ?? [];
        return [
          {
            position: index + 1,
            number,
            question_id: item.question_id,
            type: question.question_type,
            content: snapshot.content,
            options:
              question.question_type === 'multiple_choice'
                ? (layout.options[String(number)] ?? []).map((key, labelIndex) => ({
                    label: OPTION_KEYS[labelIndex] as string,
                    content:
                      snapshot.options.find((option) => option.key === item.option_order[OPTION_KEYS.indexOf(key)])
                        ?.content ?? '',
                  }))
                : question.question_type === 'true_false'
                  ? snapshot.options.map((option, optionIndex) => ({
                      label: ['a', 'b', 'c', 'd', 'e', 'f'][optionIndex] as string,
                      content: option.content,
                    }))
                  : [],
            score: question.score,
            student_answer: question.question_type === 'essay' ? given : keysToLabels(layout, number, given),
            correct_answer: question.question_type === 'essay' ? [] : keysToLabels(layout, number, item.answer),
            guidance: question.question_type === 'essay' ? snapshot.guidance : null,
            earned: result?.earned ?? null,
            correct: result?.correct ?? null,
            essay_mark: marks[item.question_id] ?? null,
          },
        ];
      }),
    };
  }

  // Giáo viên nhập điểm câu tự luận của lượt đã nộp: chấm lại, cập nhật phiếu chấm của 22g2 (nếu chưa khoá điểm)
  async markEssay(currentUser: CurrentUser, attemptId: string, marks: Record<string, number>, origin: ChangeOrigin) {
    assertOnlineExamModule();
    const { database } = await this.currentSchoolYear.require();
    const attempt = await database
      .selectFrom('exam_attempts')
      .selectAll()
      .where('id', '=', attemptId)
      .executeTakeFirst();
    if (!attempt) {
      throw notFoundError('Không tìm thấy bài làm', 'exam_attempt');
    }
    const assignment = await this.assertCanManage(database, currentUser, attempt.assignment_id);
    if (attempt.status !== 'submitted') {
      throw ruleViolationError(ONLINE_EXAM_RULE_CODE, 'Chỉ chấm tự luận sau khi bài đã nộp');
    }
    const content = await this.engine.loadContent(database, assignment.exam_id);
    for (const [questionId, mark] of Object.entries(marks)) {
      const question = content.questions.find((row) => row.question_id === questionId);
      if (!question || question.question_type !== 'essay') {
        throw validationError([{ field: 'marks', message: 'Điểm tự luận ghi cho câu không phải tự luận của đề' }]);
      }
      if (!Number.isFinite(mark) || mark < 0 || mark > question.score) {
        throw validationError([{ field: 'marks', message: `Điểm câu tự luận từ 0 đến ${question.score}` }]);
      }
    }
    const before = attempt.essay_marks as Record<string, number>;
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('exam_attempts')
        .set({ essay_marks: JSON.stringify({ ...before, ...marks }), updated_at: this.clock.now() })
        .where('id', '=', attemptId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'exam_attempts',
        entityId: attemptId,
        action: 'update',
        before: { essay_marks: before },
        after: { essay_marks: { ...before, ...marks } },
      });
    });
    await this.engine.regrade(database, attemptId);
    return this.attemptDetail(currentUser, attemptId);
  }

  async forceSubmit(currentUser: CurrentUser, attemptId: string, origin: ChangeOrigin) {
    assertOnlineExamModule();
    const { database } = await this.currentSchoolYear.require();
    const attempt = await database
      .selectFrom('exam_attempts')
      .selectAll()
      .where('id', '=', attemptId)
      .executeTakeFirst();
    if (!attempt) {
      throw notFoundError('Không tìm thấy bài làm', 'exam_attempt');
    }
    await this.assertCanManage(database, currentUser, attempt.assignment_id);
    if (attempt.status !== 'in_progress') {
      throw ruleViolationError(ONLINE_EXAM_RULE_CODE, 'Bài đã nộp');
    }
    await this.engine.finalize(database, attemptId, 'teacher');
    await writeAuditLog(database, {
      origin,
      orgUnitId: null,
      entityName: 'exam_attempts',
      entityId: attemptId,
      action: 'update',
      before: { status: 'in_progress' },
      after: { status: 'submitted', reason: 'teacher' },
    });
    return this.attemptDetail(currentUser, attemptId);
  }
}
