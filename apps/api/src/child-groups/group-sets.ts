import { Body, Controller, Get, HttpCode, Injectable, Param, Patch, Post, Query, Req } from '@nestjs/common';
import {
  vietnamDate,
  type GroupSetMethod,
  type GroupSetPurpose,
  type SchoolLevelCode,
  type SchoolYearDatabase,
} from '@school-management/database';
import { ApplicationError, Clock, validationError, type FieldError } from '@school-management/server';
import { termAverage } from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely, Transaction } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { ChildScope } from '../children/child-scope.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import {
  conflictOnDuplicate,
  isUuid,
  notFoundError,
  readOptionalUuid,
  readRequiredUuid,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { readScoreConfig } from '../scores/scores.js';
import { TimetablesService } from '../timetables/timetables.js';
import {
  MAX_GROUPS_PER_SET,
  findViolations,
  nextLeader,
  pickLeader,
  seededRandom,
  splitStudents,
  timetableGroups,
  type SplitMethod,
  type SplitMode,
  type SplitStudent,
  type SplitViolation,
} from './group-split.js';

// Bộ nhóm dùng chung của lớp (DT-28 phần 28a, YCTD-271; tài liệu 32 mục 20.7). Một bộ nhóm là một cách chia một lớp (môn tuỳ
// chọn) thành các nhóm `child_groups` có `group_set_id`; công cụ lớp học 23b, hoạt động, bài tập, đề 23a, học nhóm của DT-28
// đều dùng bộ nhóm thay vì giữ danh sách nhóm riêng. Chia lại là bộ mới, bộ cũ lưu trữ. Mức năng lực khi chia theo năng lực
// chỉ tính tạm trong yêu cầu, không lưu, không trả ra; học sinh, phụ huynh chỉ thấy nhóm của mình (GD-140).
// Quyền: giáo viên được phân công lớp (chủ nhiệm, bộ môn trong thời khoá biểu đang áp dụng) hoặc vai trò đơn vị xem được lớp
// lập và xem bộ nhóm của lớp; sửa bộ do người lập hoặc Ban Giám hiệu, quản lý đơn vị
export const GROUP_SETS_RULE_CODE = 'YCTD-271';

type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

export type { GroupSetMethod, GroupSetPurpose };
export type AbilitySource = 'term_average' | 'subject_level';
export type LeaderMode = 'none' | 'random' | 'rotate';

const PURPOSES: readonly GroupSetPurpose[] = ['subject', 'activity', 'classroom'];
const METHODS: readonly GroupSetMethod[] = [
  'manual',
  'random',
  'ability_mixed',
  'ability_tiered',
  'gender_balanced',
  'timetable_group',
];
const ABILITY_METHODS: readonly GroupSetMethod[] = ['ability_mixed', 'ability_tiered'];
const MAX_NAME = 120;
const MAX_GROUP_NAME = 60;
const MAX_CONSTRAINTS = 100;

export interface GroupDraft {
  name: string;
  child_ids: string[];
  leader_child_id: string | null;
}

export interface GroupSetInput {
  classId: string;
  subjectId: string | null;
  purpose: GroupSetPurpose;
  name: string | null;
  method: GroupSetMethod;
  mode: SplitMode;
  seed: number | null;
  abilitySource: AbilitySource | null;
  balanceGender: boolean;
  excludeAbsent: boolean;
  apart: Array<[string, string]>;
  together: Array<[string, string]>;
  leaderMode: LeaderMode;
  groups: GroupDraft[] | null;
  replacesId: string | null;
}

// Bộ nhóm đang dùng của một lớp, dạng gọn cho phần khác đọc (hàm đọc ổn định, xem GroupSetsReader)
export interface GroupSetSummary {
  id: string;
  class_id: string;
  subject_id: string | null;
  name: string;
  purpose: GroupSetPurpose;
  method: GroupSetMethod;
  owner_user_id: string;
  created_at: Date;
}

export interface GroupOfSet {
  id: string;
  name: string;
  position: number;
  leader_child_id: string | null;
  child_ids: string[];
}

function oneOf<Value extends string>(value: unknown, allowed: readonly Value[]): value is Value {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

function readPairs(value: unknown, field: string, errors: FieldError[]): Array<[string, string]> {
  if (value === undefined || value === null) {
    return [];
  }
  if (
    !Array.isArray(value) ||
    value.length > MAX_CONSTRAINTS ||
    value.some(
      (pair) =>
        !Array.isArray(pair) || pair.length !== 2 || !isUuid(pair[0]) || !isUuid(pair[1]) || pair[0] === pair[1],
    )
  ) {
    errors.push({ field, message: `Tối đa ${MAX_CONSTRAINTS} cặp hai học sinh khác nhau` });
    return [];
  }
  return (value as Array<[string, string]>).map(([first, second]) => [first, second]);
}

function readGroups(value: unknown, errors: FieldError[]): GroupDraft[] | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_GROUPS_PER_SET) {
    errors.push({ field: 'groups', message: `Cần từ 1 đến ${MAX_GROUPS_PER_SET} nhóm` });
    return null;
  }
  const names = new Set<string>();
  const groups: GroupDraft[] = [];
  value.forEach((item, index) => {
    const entry = (item ?? {}) as Record<string, unknown>;
    const name = typeof entry.name === 'string' ? entry.name.trim() : '';
    if (name === '' || name.length > MAX_GROUP_NAME) {
      errors.push({ field: `groups[${index}].name`, message: `Tên nhóm từ 1 đến ${MAX_GROUP_NAME} ký tự` });
    } else if (names.has(name)) {
      errors.push({ field: `groups[${index}].name`, message: 'Tên nhóm không trùng nhau' });
    }
    names.add(name);
    const childIds = entry.child_ids;
    if (!Array.isArray(childIds) || childIds.some((id) => !isUuid(id))) {
      errors.push({ field: `groups[${index}].child_ids`, message: 'Danh sách học sinh không hợp lệ' });
      return;
    }
    const leader = entry.leader_child_id;
    if (leader !== undefined && leader !== null && (!isUuid(leader) || !childIds.includes(leader))) {
      errors.push({ field: `groups[${index}].leader_child_id`, message: 'Nhóm trưởng phải là thành viên của nhóm' });
    }
    groups.push({
      name,
      child_ids: [...new Set(childIds as string[])],
      leader_child_id: isUuid(leader) ? leader : null,
    });
  });
  return groups;
}

export function parseGroupSetInput(body: RequestBody): GroupSetInput {
  const errors: FieldError[] = [];
  const classId = readRequiredUuid(body, 'class_id', errors, 'Bắt buộc chọn lớp');
  const subjectId = readOptionalUuid(body, 'subject_id', errors) ?? null;
  const purpose = body?.purpose ?? 'subject';
  if (!oneOf(purpose, PURPOSES)) {
    errors.push({ field: 'purpose', message: 'Mục đích là subject, activity hoặc classroom' });
  }
  const method = body?.method ?? (body?.groups ? 'manual' : 'random');
  if (!oneOf(method, METHODS)) {
    errors.push({ field: 'method', message: 'Cách chia không hợp lệ' });
  }
  let name: string | null = null;
  if (body?.name !== undefined && body?.name !== null && body?.name !== '') {
    if (typeof body.name !== 'string' || body.name.trim() === '' || body.name.trim().length > MAX_NAME) {
      errors.push({ field: 'name', message: `Tên bộ nhóm từ 1 đến ${MAX_NAME} ký tự` });
    } else {
      name = body.name.trim();
    }
  }
  const by = body?.by ?? 'count';
  const value = body?.value ?? 4;
  if (
    !oneOf(by, ['count', 'size'] as const) ||
    !Number.isInteger(value) ||
    (value as number) < 1 ||
    (value as number) > MAX_GROUPS_PER_SET
  ) {
    errors.push({ field: 'value', message: `Chia theo số nhóm hoặc số người, giá trị từ 1 đến ${MAX_GROUPS_PER_SET}` });
  }
  const seed = body?.seed;
  if (
    seed !== undefined &&
    seed !== null &&
    (!Number.isInteger(seed) || (seed as number) < 0 || (seed as number) > 2 ** 31)
  ) {
    errors.push({ field: 'seed', message: 'Hạt ngẫu nhiên là số nguyên không âm' });
  }
  const abilitySource = body?.ability_source ?? null;
  if (abilitySource !== null && !oneOf(abilitySource, ['term_average', 'subject_level'] as const)) {
    errors.push({
      field: 'ability_source',
      message:
        abilitySource === 'activity'
          ? 'Kết quả hoạt động dùng được khi phần 28d (tiến độ, bảng điểm hoạt động) có trong hệ thống'
          : 'Nguồn năng lực là term_average hoặc subject_level',
    });
  }
  const leaderMode = body?.leader_mode ?? 'none';
  if (!oneOf(leaderMode, ['none', 'random', 'rotate'] as const)) {
    errors.push({ field: 'leader_mode', message: 'Cách chọn nhóm trưởng là none, random hoặc rotate' });
  }
  const groups = readGroups(body?.groups, errors);
  if (method === 'manual' && groups === null) {
    errors.push({ field: 'groups', message: 'Chia tay cần danh sách nhóm' });
  }
  const input: GroupSetInput = {
    classId,
    subjectId,
    purpose: purpose as GroupSetPurpose,
    name,
    method: method as GroupSetMethod,
    mode: { by: by as 'count' | 'size', value: value as number },
    seed: (seed as number | undefined) ?? null,
    abilitySource: abilitySource as AbilitySource | null,
    balanceGender: body?.balance_gender === true,
    excludeAbsent: body?.exclude_absent === true,
    apart: readPairs(body?.apart, 'apart', errors),
    together: readPairs(body?.together, 'together', errors),
    leaderMode: leaderMode as LeaderMode,
    groups,
    replacesId: readOptionalUuid(body, 'replaces_id', errors) ?? null,
  };
  if (ABILITY_METHODS.includes(input.method) && input.subjectId === null && input.groups === null) {
    errors.push({ field: 'subject_id', message: 'Chia theo năng lực cần chọn môn' });
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return input;
}

interface ClassContext {
  id: string;
  org_unit_id: string;
  name: string;
  school_level: SchoolLevelCode;
}

// Hàm đọc ổn định cho các phần khác (28b lõi LMS, 28c bài nhóm, 28e học nhóm, đích nhóm của đề 23a): chỉ đọc, nhận đúng cơ sở
// dữ liệu năm học đang dùng, không kiểm quyền (phần gọi tự kiểm quyền theo nghiệp vụ của mình). Đổi chữ ký hàm ở đây phải qua
// YCTD vì phần khác đang dựa vào
@Injectable()
export class GroupSetsReader {
  // Bộ nhóm đang dùng của lớp, mới nhất trước; lọc theo môn và mục đích khi cần
  async activeSets(
    database: Executor,
    filter: { classId: string; subjectId?: string | null; purpose?: GroupSetPurpose },
  ): Promise<GroupSetSummary[]> {
    let query = database
      .selectFrom('group_sets')
      .select(['id', 'class_id', 'subject_id', 'name', 'purpose', 'method', 'owner_user_id', 'created_at'])
      .where('class_id', '=', filter.classId)
      .where('status', '=', 'active');
    if (filter.subjectId !== undefined) {
      query =
        filter.subjectId === null
          ? query.where('subject_id', 'is', null)
          : query.where('subject_id', '=', filter.subjectId);
    }
    if (filter.purpose) {
      query = query.where('purpose', '=', filter.purpose);
    }
    return query.orderBy('created_at', 'desc').execute();
  }

  // Các nhóm của một bộ theo thứ tự, kèm học sinh (theo họ tên) và nhóm trưởng
  async groupsOfSet(database: Executor, groupSetId: string): Promise<GroupOfSet[]> {
    const groups = await database
      .selectFrom('child_groups')
      .select(['id', 'name', 'position', 'leader_child_id'])
      .where('group_set_id', '=', groupSetId)
      .orderBy('position')
      .orderBy('name')
      .execute();
    if (groups.length === 0) {
      return [];
    }
    const members = await database
      .selectFrom('child_group_members')
      .innerJoin('children', 'children.id', 'child_group_members.child_id')
      .select(['child_group_members.group_id', 'child_group_members.child_id'])
      .where(
        'child_group_members.group_id',
        'in',
        groups.map((group) => group.id),
      )
      .orderBy('children.full_name')
      .execute();
    return groups.map((group, index) => ({
      id: group.id,
      name: group.name,
      position: group.position ?? index + 1,
      leader_child_id: group.leader_child_id,
      child_ids: members.filter((member) => member.group_id === group.id).map((member) => member.child_id),
    }));
  }

  async childIdsOfGroup(database: Executor, groupId: string): Promise<string[]> {
    const rows = await database
      .selectFrom('child_group_members')
      .select('child_id')
      .where('group_id', '=', groupId)
      .execute();
    return rows.map((row) => row.child_id);
  }

  // Nhóm của một học sinh trong các bộ đang dùng (tuỳ chọn chỉ một bộ)
  async groupsOfChild(
    database: Executor,
    childId: string,
    filter: { groupSetId?: string } = {},
  ): Promise<Array<{ group_set_id: string; group_id: string; group_name: string }>> {
    let query = database
      .selectFrom('child_group_members')
      .innerJoin('child_groups', 'child_groups.id', 'child_group_members.group_id')
      .innerJoin('group_sets', 'group_sets.id', 'child_groups.group_set_id')
      .select(['group_sets.id as group_set_id', 'child_groups.id as group_id', 'child_groups.name as group_name'])
      .where('child_group_members.child_id', '=', childId)
      .where('group_sets.status', '=', 'active');
    if (filter.groupSetId) {
      query = query.where('group_sets.id', '=', filter.groupSetId);
    }
    return query.orderBy('group_sets.created_at', 'desc').execute();
  }
}

@Injectable()
export class GroupSetsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly childScope: ChildScope,
    private readonly timetables: TimetablesService,
    private readonly reader: GroupSetsReader,
    private readonly clock: Clock,
  ) {}

  // Lớp và quyền: vai trò đơn vị xem được lớp, giáo viên được phân công lớp hoặc dạy lớp (đúng môn nếu chọn môn) trong bản
  // thời khoá biểu đang áp dụng. canManageAll là Ban Giám hiệu, quản lý đơn vị (sửa được bộ của người khác)
  private async access(
    currentUser: CurrentUser,
    database: Kysely<SchoolYearDatabase>,
    classId: string,
    subjectId: string | null,
  ) {
    const classRow = await database
      .selectFrom('classes')
      .select(['id', 'org_unit_id', 'name', 'school_level'])
      .where('id', '=', classId)
      .executeTakeFirst();
    if (!classRow) {
      throw notFoundError('Không tìm thấy lớp', 'class');
    }
    const scope = await this.childScope.resolve(currentUser, database);
    const canManageAll = scope.wholeSchool || scope.unitIds.includes(classRow.org_unit_id);
    if (canManageAll || scope.classIds.includes(classRow.id)) {
      return { classRow: classRow as ClassContext, canManageAll };
    }
    const versions = await this.timetables.applyingVersions(
      database,
      vietnamDate(this.clock.now()),
      classRow.school_level,
    );
    if (versions.length > 0) {
      let teaching = database
        .selectFrom('timetable_lessons')
        .select('id')
        .where(
          'version_id',
          'in',
          versions.map((version) => version.id),
        )
        .where('class_id', '=', classId)
        .where('teacher_user_id', '=', currentUser.id);
      if (subjectId) {
        teaching = teaching.where('subject_id', '=', subjectId);
      }
      if (await teaching.executeTakeFirst()) {
        return { classRow: classRow as ClassContext, canManageAll };
      }
    }
    throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không được phân công lớp hoặc môn này');
  }

  private async loadSet(database: Executor, groupSetId: string) {
    const set = await database.selectFrom('group_sets').selectAll().where('id', '=', groupSetId).executeTakeFirst();
    if (!set) {
      throw notFoundError('Không tìm thấy bộ nhóm', 'group_set');
    }
    return set;
  }

  private async assertCanEdit(
    currentUser: CurrentUser,
    database: Kysely<SchoolYearDatabase>,
    set: { class_id: string; subject_id: string | null; owner_user_id: string; status: string },
  ) {
    const { canManageAll } = await this.access(currentUser, database, set.class_id, set.subject_id);
    if (!canManageAll && set.owner_user_id !== currentUser.id) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người lập bộ nhóm hoặc Ban Giám hiệu được sửa bộ nhóm này');
    }
    if (set.status !== 'active') {
      throw validationError([{ field: 'group_set', message: 'Bộ nhóm đã lưu trữ, không sửa được' }]);
    }
  }

  // Học sinh đang học của lớp, kèm giới và vắng hôm nay (điểm danh hoặc phụ huynh báo vắng)
  private async classStudents(database: Executor, classId: string) {
    const rows = await database
      .selectFrom('class_enrollments')
      .innerJoin('children', 'children.id', 'class_enrollments.child_id')
      .select(['children.id', 'children.full_name', 'children.gender'])
      .where('class_enrollments.class_id', '=', classId)
      .where('class_enrollments.is_current', '=', true)
      .where('children.status', '=', 'active')
      .where('children.deleted_at', 'is', null)
      .orderBy('children.full_name')
      .execute();
    const absent = new Set<string>();
    if (rows.length > 0) {
      const today = vietnamDate(this.clock.now());
      const ids = rows.map((row) => row.id);
      const [attendance, advised] = await Promise.all([
        database
          .selectFrom('attendance_records')
          .select('child_id')
          .where('child_id', 'in', ids)
          .where('attendance_date', '=', today)
          .where('status', 'in', ['absent_notified', 'absent_unnotified'])
          .execute(),
        database
          .selectFrom('absence_records')
          .select('child_id')
          .where('child_id', 'in', ids)
          .where('absence_date', '=', today)
          .execute(),
      ]);
      for (const row of [...attendance, ...advised]) {
        absent.add(row.child_id);
      }
    }
    return rows.map((row) => ({ ...row, absent: absent.has(row.id) }));
  }

  // Năng lực tạm để chia (GD-140): THCS, THPT điểm trung bình môn học kỳ gần nhất có điểm (chưa đủ điểm để tính trung bình
  // học kỳ thì lấy trung bình cộng các điểm đã có); Tiểu học mức đạt môn của kỳ đánh giá gần nhất, quy thứ bậc ra số
  private async abilities(
    database: Executor,
    classRow: ClassContext,
    subjectId: string,
    source: AbilitySource,
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (source === 'term_average') {
      const entries = await database
        .selectFrom('score_entries')
        .select(['child_id', 'term_type', 'kind', 'score'])
        .where('class_id', '=', classRow.id)
        .where('subject_id', '=', subjectId)
        .execute();
      const term = entries.some((entry) => entry.term_type === 'second_term') ? 'second_term' : 'first_term';
      const config = await readScoreConfig(database, classRow.school_level);
      const byChild = new Map<string, typeof entries>();
      for (const entry of entries.filter((row) => row.term_type === term)) {
        byChild.set(entry.child_id, [...(byChild.get(entry.child_id) ?? []), entry]);
      }
      for (const [childId, own] of byChild) {
        const scoreOf = (kind: string) => {
          const found = own.find((entry) => entry.kind === kind);
          return found ? Number(found.score) : null;
        };
        const average = termAverage(
          {
            regular: own.filter((entry) => entry.kind === 'regular').map((entry) => Number(entry.score)),
            mid: scoreOf('mid'),
            final: scoreOf('final'),
          },
          config,
        );
        result.set(childId, average ?? own.reduce((total, entry) => total + Number(entry.score), 0) / own.length);
      }
      return result;
    }
    const latest = await database
      .selectFrom('subject_results')
      .innerJoin('assessment_periods', 'assessment_periods.id', 'subject_results.period_id')
      .select('subject_results.period_id')
      .where('subject_results.class_id', '=', classRow.id)
      .where('subject_results.subject_id', '=', subjectId)
      .where('subject_results.level_code', 'is not', null)
      .orderBy('assessment_periods.order_no', 'desc')
      .executeTakeFirst();
    if (!latest) {
      return result;
    }
    const [results, levels] = await Promise.all([
      database
        .selectFrom('subject_results')
        .select(['child_id', 'level_code'])
        .where('period_id', '=', latest.period_id)
        .where('class_id', '=', classRow.id)
        .where('subject_id', '=', subjectId)
        .execute(),
      database
        .selectFrom('assessment_levels')
        .select(['code', 'rank'])
        .where('school_level', '=', classRow.school_level)
        .where('scale', '=', 'subject')
        .execute(),
    ]);
    const maxRank = Math.max(0, ...levels.map((level) => level.rank));
    const rankOf = new Map(levels.map((level) => [level.code, level.rank]));
    for (const row of results) {
      const rank = row.level_code === null ? undefined : rankOf.get(row.level_code);
      if (rank !== undefined) {
        result.set(row.child_id, maxRank + 1 - rank);
      }
    }
    return result;
  }

  // Bộ nhóm theo tiết nhóm của bản thời khoá biểu đang áp dụng (21b) và tổ hợp môn đang hiệu lực của học sinh (21a)
  private async timetableDrafts(
    database: Executor,
    classRow: ClassContext,
    studentIds: string[],
  ): Promise<GroupDraft[]> {
    const versions = await this.timetables.applyingVersions(
      database,
      vietnamDate(this.clock.now()),
      classRow.school_level,
    );
    if (versions.length === 0) {
      throw validationError([{ field: 'method', message: 'Chưa có thời khoá biểu đang áp dụng cho lớp' }]);
    }
    const lessons = await database
      .selectFrom('timetable_lessons')
      .innerJoin('subjects', 'subjects.id', 'timetable_lessons.subject_id')
      .select(['timetable_lessons.group_no', 'timetable_lessons.subject_id', 'subjects.name as subject_name'])
      .where(
        'timetable_lessons.version_id',
        'in',
        versions.map((version) => version.id),
      )
      .where('timetable_lessons.class_id', '=', classRow.id)
      .where('timetable_lessons.group_no', '>', 0)
      .execute();
    if (lessons.length === 0) {
      throw validationError([{ field: 'method', message: 'Thời khoá biểu của lớp không có tiết nhóm' }]);
    }
    const registrations =
      studentIds.length === 0
        ? []
        : await database
            .selectFrom('child_subject_combinations')
            .select(['child_id', 'combination_id', 'previous_combination_id', 'status'])
            .where('child_id', 'in', studentIds)
            .execute();
    const effective = new Map(
      registrations.map((row) => [
        row.child_id,
        row.status === 'approved' ? row.combination_id : row.previous_combination_id,
      ]),
    );
    const combinationIds = [...new Set([...effective.values()].filter((id): id is string => id !== null))];
    const subjects =
      combinationIds.length === 0
        ? []
        : await database
            .selectFrom('subject_combination_subjects')
            .select(['combination_id', 'subject_id'])
            .where('combination_id', 'in', combinationIds)
            .execute();
    return timetableGroups(
      lessons,
      studentIds.map((id) => ({
        id,
        subject_ids: new Set(
          subjects.filter((row) => row.combination_id === effective.get(id)).map((row) => row.subject_id),
        ),
      })),
    ).map((group) => ({ name: group.name, child_ids: group.child_ids, leader_child_id: null }));
  }

  // Tính các nhóm (chưa lưu) theo cách chia; dùng cho xem trước và cho lưu khi không gửi kèm danh sách nhóm
  private async draft(database: Executor, classRow: ClassContext, input: GroupSetInput) {
    const students = await this.classStudents(database, classRow.id);
    const pool = input.excludeAbsent ? students.filter((student) => !student.absent) : students;
    const seed = input.seed ?? Math.floor(Math.random() * 2 ** 31);
    let groups: GroupDraft[];
    let violations: SplitViolation[] = [];
    if (input.method === 'manual') {
      groups = input.groups ?? [];
    } else if (input.method === 'timetable_group') {
      groups = await this.timetableDrafts(
        database,
        classRow,
        pool.map((student) => student.id),
      );
    } else {
      let abilities = new Map<string, number>();
      if (ABILITY_METHODS.includes(input.method) && input.subjectId) {
        const source = input.abilitySource ?? (classRow.school_level === 'TH' ? 'subject_level' : 'term_average');
        abilities = await this.abilities(database, classRow, input.subjectId, source);
      }
      const split = splitStudents(
        pool.map((student): SplitStudent => ({
          id: student.id,
          gender: student.gender,
          ability: abilities.get(student.id) ?? null,
        })),
        {
          method: input.method as SplitMethod,
          mode: input.mode,
          seed,
          balanceGender: input.balanceGender,
          apart: input.apart,
          together: input.together,
        },
      );
      violations = split.violations;
      // Thành viên mỗi nhóm theo thứ tự họ tên như danh sách lớp, để nhóm trưởng luân phiên đi đúng thứ tự hiển thị
      const order = new Map(students.map((student, index) => [student.id, index]));
      groups = split.groups.map((childIds, index) => ({
        name: `Nhóm ${index + 1}`,
        child_ids: [...childIds].sort((first, second) => (order.get(first) ?? 0) - (order.get(second) ?? 0)),
        leader_child_id: null,
      }));
    }
    if (input.leaderMode !== 'none') {
      const random = seededRandom(seed + 1);
      groups = groups.map((group) => ({
        ...group,
        leader_child_id:
          group.leader_child_id ??
          (input.leaderMode === 'random' ? pickLeader(group.child_ids, random) : nextLeader(group.child_ids, null)),
      }));
    }
    return { groups, violations, seed, excluded: students.length - pool.length };
  }

  private async assertMembers(database: Executor, classId: string, groups: GroupDraft[], allowOverlap: boolean) {
    const all = groups.flatMap((group) => group.child_ids);
    if (!allowOverlap && new Set(all).size !== all.length) {
      throw validationError([{ field: 'groups', message: 'Một học sinh chỉ thuộc một nhóm của bộ' }]);
    }
    const unique = [...new Set(all)];
    if (unique.length === 0) {
      return;
    }
    const found = await database
      .selectFrom('class_enrollments')
      .select('child_id')
      .where('class_id', '=', classId)
      .where('is_current', '=', true)
      .where('child_id', 'in', unique)
      .execute();
    if (found.length !== unique.length) {
      throw validationError([{ field: 'groups', message: 'Có học sinh không thuộc lớp này' }]);
    }
  }

  async preview(currentUser: CurrentUser, input: GroupSetInput) {
    const { database } = await this.currentSchoolYear.require();
    const { classRow } = await this.access(currentUser, database, input.classId, input.subjectId);
    const result = await this.draft(database, classRow, input);
    return {
      groups: result.groups,
      violations: result.violations,
      seed: result.seed,
      excluded_absent: result.excluded,
    };
  }

  async create(currentUser: CurrentUser, input: GroupSetInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const { classRow } = await this.access(currentUser, database, input.classId, input.subjectId);
    if (input.replacesId) {
      const replaced = await this.loadSet(database, input.replacesId);
      if (replaced.class_id !== classRow.id) {
        throw validationError([{ field: 'replaces_id', message: 'Bộ nhóm thay thế phải cùng lớp' }]);
      }
      await this.assertCanEdit(currentUser, database, replaced);
    }
    const computed = input.groups ? null : await this.draft(database, classRow, input);
    const groups = input.groups ?? computed?.groups ?? [];
    await this.assertMembers(database, classRow.id, groups, input.method === 'timetable_group');
    const violations = findViolations(
      groups.map((group) => group.child_ids),
      input,
    );
    const params = {
      by: input.mode.by,
      value: input.mode.value,
      seed: computed?.seed ?? input.seed,
      ability_source: ABILITY_METHODS.includes(input.method)
        ? (input.abilitySource ?? (classRow.school_level === 'TH' ? 'subject_level' : 'term_average'))
        : null,
      balance_gender: input.balanceGender,
      exclude_absent: input.excludeAbsent,
      apart: input.apart,
      together: input.together,
      leader_mode: input.leaderMode,
    };
    const id = await this.insertSet(database, currentUser, origin, {
      classRow,
      subjectId: input.subjectId,
      purpose: input.purpose,
      name: input.name ?? (await this.defaultName(database, classRow, input)),
      method: input.method,
      params,
      groups,
      replacesId: input.replacesId,
    });
    return { ...(await this.read(currentUser, id)), violations };
  }

  private async defaultName(database: Executor, classRow: ClassContext, input: GroupSetInput) {
    const subject = input.subjectId
      ? await database.selectFrom('subjects').select('name').where('id', '=', input.subjectId).executeTakeFirst()
      : undefined;
    const date = vietnamDate(this.clock.now()).split('-').reverse().join('/');
    return `${subject ? `${subject.name} ` : ''}${classRow.name} ${date}`.slice(0, MAX_NAME);
  }

  // Ghi bộ nhóm và các nhóm trong một giao dịch; bộ được thay thế chuyển sang lưu trữ
  private async insertSet(
    database: Kysely<SchoolYearDatabase>,
    currentUser: CurrentUser,
    origin: ChangeOrigin,
    input: {
      classRow: ClassContext;
      subjectId: string | null;
      purpose: GroupSetPurpose;
      name: string;
      method: GroupSetMethod;
      params: Record<string, unknown>;
      groups: GroupDraft[];
      replacesId: string | null;
    },
  ): Promise<string> {
    const now = this.clock.now();
    return conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        if (input.replacesId) {
          await transaction
            .updateTable('group_sets')
            .set({ status: 'archived', archived_at: now, updated_at: now })
            .where('id', '=', input.replacesId)
            .execute();
        }
        const set = await transaction
          .insertInto('group_sets')
          .values({
            org_unit_id: input.classRow.org_unit_id,
            class_id: input.classRow.id,
            subject_id: input.subjectId,
            name: input.name,
            purpose: input.purpose,
            method: input.method,
            params: JSON.stringify(input.params),
            owner_user_id: currentUser.id,
            owner_name: currentUser.description.full_name,
            replaces_id: input.replacesId,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
        for (const [index, group] of input.groups.entries()) {
          const created = await transaction
            .insertInto('child_groups')
            .values({
              org_unit_id: input.classRow.org_unit_id,
              name: group.name,
              created_by: currentUser.id,
              group_set_id: set.id,
              class_id: input.classRow.id,
              position: index + 1,
              leader_child_id: group.leader_child_id,
            })
            .returning('id')
            .executeTakeFirstOrThrow();
          if (group.child_ids.length > 0) {
            await transaction
              .insertInto('child_group_members')
              .values(
                group.child_ids.map((childId) => ({
                  group_id: created.id,
                  child_id: childId,
                  added_by: currentUser.id,
                  role: childId === group.leader_child_id ? ('leader' as const) : ('member' as const),
                })),
              )
              .execute();
          }
        }
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: input.classRow.org_unit_id,
          entityName: 'group_sets',
          entityId: set.id,
          action: 'create',
          before: null,
          after: { ...set, groups: input.groups.map((group) => ({ name: group.name, size: group.child_ids.length })) },
        });
        return set.id;
      }),
      'Tên nhóm trong bộ bị trùng',
      'groups',
    );
  }

  async list(
    currentUser: CurrentUser,
    filter: { classId: string; subjectId: string | null; purpose: GroupSetPurpose | null; includeArchived: boolean },
  ) {
    const { database } = await this.currentSchoolYear.require();
    await this.access(currentUser, database, filter.classId, null);
    let query = database
      .selectFrom('group_sets')
      .leftJoin('subjects', 'subjects.id', 'group_sets.subject_id')
      .select([
        'group_sets.id',
        'group_sets.class_id',
        'group_sets.subject_id',
        'subjects.name as subject_name',
        'group_sets.name',
        'group_sets.purpose',
        'group_sets.method',
        'group_sets.status',
        'group_sets.owner_user_id',
        'group_sets.owner_name',
        'group_sets.replaces_id',
        'group_sets.created_at',
        'group_sets.archived_at',
        (expression) =>
          expression
            .selectFrom('child_groups')
            .select(expression.fn.countAll<string>().as('count'))
            .whereRef('child_groups.group_set_id', '=', 'group_sets.id')
            .as('group_count'),
      ])
      .where('group_sets.class_id', '=', filter.classId);
    if (!filter.includeArchived) {
      query = query.where('group_sets.status', '=', 'active');
    }
    if (filter.subjectId) {
      query = query.where('group_sets.subject_id', '=', filter.subjectId);
    }
    if (filter.purpose) {
      query = query.where('group_sets.purpose', '=', filter.purpose);
    }
    const rows = await query.orderBy('group_sets.created_at', 'desc').execute();
    return rows.map((row) => ({ ...row, group_count: Number(row.group_count ?? 0) }));
  }

  // Môn của cấp học của lớp, để giáo viên chọn môn khi chia theo năng lực
  async classSubjects(currentUser: CurrentUser, classId: string) {
    const { database } = await this.currentSchoolYear.require();
    const { classRow } = await this.access(currentUser, database, classId, null);
    return database
      .selectFrom('subjects')
      .select(['id', 'code', 'name'])
      .where('school_level', '=', classRow.school_level)
      .where('status', '=', 'active')
      .orderBy('order_no')
      .execute();
  }

  async read(currentUser: CurrentUser, groupSetId: string) {
    const { database } = await this.currentSchoolYear.require();
    const set = await this.loadSet(database, groupSetId);
    const { canManageAll } = await this.access(currentUser, database, set.class_id, set.subject_id);
    const groups = await this.reader.groupsOfSet(database, groupSetId);
    const names = await this.childNames(
      database,
      groups.flatMap((group) => group.child_ids),
    );
    return {
      ...set,
      can_edit: set.status === 'active' && (canManageAll || set.owner_user_id === currentUser.id),
      groups: groups.map((group) => ({
        ...group,
        members: group.child_ids.map((childId) => ({
          child_id: childId,
          full_name: names.get(childId) ?? 'Học sinh',
          is_leader: childId === group.leader_child_id,
        })),
      })),
    };
  }

  private async childNames(database: Executor, childIds: string[]) {
    const unique = [...new Set(childIds)];
    if (unique.length === 0) {
      return new Map<string, string>();
    }
    const rows = await database.selectFrom('children').select(['id', 'full_name']).where('id', 'in', unique).execute();
    return new Map(rows.map((row) => [row.id, row.full_name]));
  }

  async update(
    currentUser: CurrentUser,
    groupSetId: string,
    patch: { name?: string; archive?: boolean },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const set = await this.loadSet(database, groupSetId);
    await this.assertCanEdit(currentUser, database, set);
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      const row = await transaction
        .updateTable('group_sets')
        .set({
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.archive ? { status: 'archived' as const, archived_at: now } : {}),
          updated_at: now,
        })
        .where('id', '=', groupSetId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: set.org_unit_id,
        entityName: 'group_sets',
        entityId: groupSetId,
        action: 'update',
        before: set,
        after: row,
      });
    });
    return this.read(currentUser, groupSetId);
  }

  // Chuyển một học sinh sang nhóm khác của bộ, hoặc bỏ khỏi bộ (to_group_id trống), hoặc thêm học sinh mới vào lớp vào nhóm
  async moveMember(currentUser: CurrentUser, groupSetId: string, input: { childId: string; toGroupId: string | null }) {
    const { database } = await this.currentSchoolYear.require();
    const set = await this.loadSet(database, groupSetId);
    await this.assertCanEdit(currentUser, database, set);
    const groups = await this.reader.groupsOfSet(database, groupSetId);
    if (input.toGroupId && !groups.some((group) => group.id === input.toGroupId)) {
      throw validationError([{ field: 'to_group_id', message: 'Nhóm đích không thuộc bộ nhóm này' }]);
    }
    if (input.toGroupId) {
      await this.assertMembers(
        database,
        set.class_id,
        [{ name: '', child_ids: [input.childId], leader_child_id: null }],
        true,
      );
    }
    const from = groups.find((group) => group.child_ids.includes(input.childId)) ?? null;
    if (from?.id === input.toGroupId) {
      return this.read(currentUser, groupSetId);
    }
    if (!from && !input.toGroupId) {
      throw validationError([{ field: 'child_id', message: 'Học sinh không thuộc nhóm nào của bộ' }]);
    }
    await database.transaction().execute(async (transaction) => {
      if (from) {
        await transaction
          .deleteFrom('child_group_members')
          .where('group_id', '=', from.id)
          .where('child_id', '=', input.childId)
          .execute();
        if (from.leader_child_id === input.childId) {
          await transaction
            .updateTable('child_groups')
            .set({ leader_child_id: null })
            .where('id', '=', from.id)
            .execute();
        }
      }
      if (input.toGroupId) {
        await transaction
          .insertInto('child_group_members')
          .values({ group_id: input.toGroupId, child_id: input.childId, added_by: currentUser.id })
          .execute();
      }
      await transaction
        .insertInto('child_group_member_events')
        .values({
          group_set_id: groupSetId,
          group_id: input.toGroupId ?? (from as GroupOfSet).id,
          child_id: input.childId,
          event: from && input.toGroupId ? 'moved' : input.toGroupId ? 'added' : 'removed',
          from_group_id: from && input.toGroupId ? from.id : null,
          actor_user_id: currentUser.id,
          actor_name: currentUser.description.full_name,
        })
        .execute();
      await transaction
        .updateTable('group_sets')
        .set({ updated_at: this.clock.now() })
        .where('id', '=', groupSetId)
        .execute();
    });
    return this.read(currentUser, groupSetId);
  }

  // Đặt nhóm trưởng của một nhóm (child_id trống là bỏ nhóm trưởng)
  async setLeader(currentUser: CurrentUser, groupSetId: string, groupId: string, childId: string | null) {
    const { database } = await this.currentSchoolYear.require();
    const set = await this.loadSet(database, groupSetId);
    await this.assertCanEdit(currentUser, database, set);
    const group = (await this.reader.groupsOfSet(database, groupSetId)).find((row) => row.id === groupId);
    if (!group) {
      throw notFoundError('Không tìm thấy nhóm trong bộ', 'child_group');
    }
    if (childId !== null && !group.child_ids.includes(childId)) {
      throw validationError([{ field: 'child_id', message: 'Nhóm trưởng phải là thành viên của nhóm' }]);
    }
    await database
      .transaction()
      .execute((transaction) => this.writeLeader(transaction, currentUser, groupSetId, group, childId));
    return this.read(currentUser, groupSetId);
  }

  private async writeLeader(
    transaction: Transaction<SchoolYearDatabase>,
    currentUser: CurrentUser,
    groupSetId: string,
    group: GroupOfSet,
    childId: string | null,
  ) {
    if (group.leader_child_id === childId) {
      return;
    }
    await transaction
      .updateTable('child_groups')
      .set({ leader_child_id: childId })
      .where('id', '=', group.id)
      .execute();
    await transaction
      .updateTable('child_group_members')
      .set({ role: 'member' })
      .where('group_id', '=', group.id)
      .execute();
    if (childId) {
      await transaction
        .updateTable('child_group_members')
        .set({ role: 'leader' })
        .where('group_id', '=', group.id)
        .where('child_id', '=', childId)
        .execute();
    }
    const events: Array<{ child: string; event: 'leader_set' | 'leader_unset' }> = [];
    if (group.leader_child_id) {
      events.push({ child: group.leader_child_id, event: 'leader_unset' });
    }
    if (childId) {
      events.push({ child: childId, event: 'leader_set' });
    }
    if (events.length > 0) {
      await transaction
        .insertInto('child_group_member_events')
        .values(
          events.map((entry) => ({
            group_set_id: groupSetId,
            group_id: group.id,
            child_id: entry.child,
            event: entry.event,
            actor_user_id: currentUser.id,
            actor_name: currentUser.description.full_name,
          })),
        )
        .execute();
    }
  }

  // Đổi nhóm trưởng mọi nhóm của bộ: ngẫu nhiên, hoặc luân phiên sang bạn kế tiếp (dùng mỗi tuần)
  async changeLeaders(currentUser: CurrentUser, groupSetId: string, mode: 'random' | 'rotate') {
    const { database } = await this.currentSchoolYear.require();
    const set = await this.loadSet(database, groupSetId);
    await this.assertCanEdit(currentUser, database, set);
    const groups = await this.reader.groupsOfSet(database, groupSetId);
    const random = seededRandom(Math.floor(Math.random() * 2 ** 31));
    await database.transaction().execute(async (transaction) => {
      for (const group of groups) {
        const next =
          mode === 'random' ? pickLeader(group.child_ids, random) : nextLeader(group.child_ids, group.leader_child_id);
        await this.writeLeader(transaction, currentUser, groupSetId, group, next);
      }
    });
    return this.read(currentUser, groupSetId);
  }

  // Nhóm của con cho phụ huynh (và nhân sự xem được học sinh): tên bộ, môn, tên nhóm, nhóm trưởng, bạn trong nhóm; không có
  // cách chia, tham số hay năng lực
  async childGroups(currentUser: CurrentUser, childId: string) {
    const { database } = await this.currentSchoolYear.require();
    const guardian = await database
      .selectFrom('child_guardians')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .select('guardians.id')
      .where('child_guardians.child_id', '=', childId)
      .where('guardians.user_id', '=', currentUser.id)
      .executeTakeFirst();
    if (!guardian) {
      const visible = await database
        .selectFrom('children')
        .select('children.id')
        .where('children.id', '=', childId)
        .where(this.childScope.filter(await this.childScope.resolve(currentUser, database)))
        .executeTakeFirst();
      if (!visible) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ phụ huynh của học sinh hoặc nhân sự phụ trách xem được nhóm');
      }
    }
    const memberships = await this.reader.groupsOfChild(database, childId);
    if (memberships.length === 0) {
      return [];
    }
    const sets = await database
      .selectFrom('group_sets')
      .leftJoin('subjects', 'subjects.id', 'group_sets.subject_id')
      .select(['group_sets.id', 'group_sets.name', 'group_sets.purpose', 'subjects.name as subject_name'])
      .where(
        'group_sets.id',
        'in',
        memberships.map((row) => row.group_set_id),
      )
      .execute();
    const members = await database
      .selectFrom('child_group_members')
      .innerJoin('children', 'children.id', 'child_group_members.child_id')
      .innerJoin('child_groups', 'child_groups.id', 'child_group_members.group_id')
      .select(['child_group_members.group_id', 'children.id', 'children.full_name', 'child_groups.leader_child_id'])
      .where(
        'child_group_members.group_id',
        'in',
        memberships.map((row) => row.group_id),
      )
      .orderBy('children.full_name')
      .execute();
    return memberships.map((membership) => {
      const set = sets.find((row) => row.id === membership.group_set_id);
      const own = members.filter((row) => row.group_id === membership.group_id);
      return {
        group_set_id: membership.group_set_id,
        set_name: set?.name ?? '',
        purpose: set?.purpose ?? 'subject',
        subject_name: set?.subject_name ?? null,
        group_id: membership.group_id,
        group_name: membership.group_name,
        leader_name: own.find((row) => row.id === row.leader_child_id)?.full_name ?? null,
        members: own.map((row) => row.full_name),
      };
    });
  }

  // Bản chia nhóm đang dùng của công cụ lớp học (23b): bộ `classroom` mới nhất của giáo viên cho lớp
  async classroomGrouping(database: Executor, classId: string, ownerUserId: string) {
    const set = await database
      .selectFrom('group_sets')
      .select(['id', 'updated_at'])
      .where('class_id', '=', classId)
      .where('owner_user_id', '=', ownerUserId)
      .where('purpose', '=', 'classroom')
      .where('status', '=', 'active')
      .orderBy('created_at', 'desc')
      .executeTakeFirst();
    if (!set) {
      return null;
    }
    const groups = await this.reader.groupsOfSet(database, set.id);
    return {
      id: set.id,
      updated_at: set.updated_at,
      groups: groups.map((group) => ({ name: group.name, child_ids: group.child_ids })),
    };
  }

  // Lưu bản chia của công cụ lớp học thành bộ `classroom` mới thay bộ đang dùng; bản chia không đổi thì giữ bộ cũ
  async saveClassroomGrouping(
    currentUser: CurrentUser,
    classId: string,
    groups: Array<{ name: string; child_ids: string[] }>,
    origin: ChangeOrigin,
    sourceGroupSetId: string | null,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const { classRow } = await this.access(currentUser, database, classId, null);
    const current = await this.classroomGrouping(database, classId, currentUser.id);
    const sameAs = (left: Array<{ name: string; child_ids: string[] }>) =>
      JSON.stringify(left.map((group) => [group.name, [...group.child_ids].sort()])) ===
      JSON.stringify(groups.map((group) => [group.name, [...group.child_ids].sort()]));
    if (current && sameAs(current.groups)) {
      return current.id;
    }
    return this.insertSet(database, currentUser, origin, {
      classRow,
      subjectId: null,
      purpose: 'classroom',
      name: `Công cụ lớp học ${classRow.name}`.slice(0, MAX_NAME),
      method: 'manual',
      params: { source: 'classroom_tools', ...(sourceGroupSetId ? { source_group_set_id: sourceGroupSetId } : {}) },
      groups: groups.map((group) => ({ name: group.name, child_ids: group.child_ids, leader_child_id: null })),
      replacesId: current?.id ?? null,
    });
  }
}

function readName(body: RequestBody, errors: FieldError[]): string | undefined {
  if (body?.name === undefined) {
    return undefined;
  }
  if (typeof body.name !== 'string' || body.name.trim() === '' || body.name.trim().length > MAX_NAME) {
    errors.push({ field: 'name', message: `Tên bộ nhóm từ 1 đến ${MAX_NAME} ký tự` });
    return undefined;
  }
  return body.name.trim();
}

function check(errors: FieldError[]) {
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

@Controller('group-sets')
export class GroupSetsController {
  constructor(private readonly groupSets: GroupSetsService) {}

  @Get()
  list(
    @Query('class_id') classId: string | undefined,
    @Query('subject_id') subjectId: string | undefined,
    @Query('purpose') purpose: string | undefined,
    @Query('include_archived') includeArchived: string | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    if (!isUuid(classId)) {
      errors.push({ field: 'class_id', message: 'Bắt buộc chọn lớp' });
    }
    if (subjectId !== undefined && subjectId !== '' && !isUuid(subjectId)) {
      errors.push({ field: 'subject_id', message: 'Mã không hợp lệ' });
    }
    if (purpose !== undefined && purpose !== '' && !oneOf(purpose, PURPOSES)) {
      errors.push({ field: 'purpose', message: 'Mục đích là subject, activity hoặc classroom' });
    }
    check(errors);
    return this.groupSets.list(currentUser, {
      classId: classId as string,
      subjectId: subjectId || null,
      purpose: (purpose || null) as GroupSetPurpose | null,
      includeArchived: includeArchived === 'true',
    });
  }

  @Post('preview')
  @HttpCode(200)
  preview(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.groupSets.preview(currentUser, parseGroupSetInput(body));
  }

  @Post()
  @HttpCode(201)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.groupSets.create(currentUser, parseGroupSetInput(body), originOf(request, currentUser));
  }

  @Get('subjects')
  subjects(@Query('class_id') classId: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    if (!isUuid(classId)) {
      throw validationError([{ field: 'class_id', message: 'Bắt buộc chọn lớp' }]);
    }
    return this.groupSets.classSubjects(currentUser, classId);
  }

  @Get('children/:childId')
  childGroups(
    @Param('childId', uuidParameter('Mã học sinh không hợp lệ')) childId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.groupSets.childGroups(currentUser, childId);
  }

  @Get(':id')
  read(
    @Param('id', uuidParameter('Mã bộ nhóm không hợp lệ')) id: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.groupSets.read(currentUser, id);
  }

  @Patch(':id')
  update(
    @Param('id', uuidParameter('Mã bộ nhóm không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const name = readName(body, errors);
    if (body?.status !== undefined && body.status !== 'archived') {
      errors.push({ field: 'status', message: 'Chỉ chuyển được sang archived' });
    }
    check(errors);
    return this.groupSets.update(
      currentUser,
      id,
      { name, archive: body?.status === 'archived' },
      originOf(request, currentUser),
    );
  }

  @Post(':id/move')
  @HttpCode(200)
  move(
    @Param('id', uuidParameter('Mã bộ nhóm không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const childId = readRequiredUuid(body, 'child_id', errors, 'Bắt buộc chọn học sinh');
    const toGroupId = readOptionalUuid(body, 'to_group_id', errors) ?? null;
    check(errors);
    return this.groupSets.moveMember(currentUser, id, { childId, toGroupId });
  }

  @Post(':id/groups/:groupId/leader')
  @HttpCode(200)
  setLeader(
    @Param('id', uuidParameter('Mã bộ nhóm không hợp lệ')) id: string,
    @Param('groupId', uuidParameter('Mã nhóm không hợp lệ')) groupId: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const childId = readOptionalUuid(body, 'child_id', errors) ?? null;
    check(errors);
    return this.groupSets.setLeader(currentUser, id, groupId, childId);
  }

  @Post(':id/leaders')
  @HttpCode(200)
  changeLeaders(
    @Param('id', uuidParameter('Mã bộ nhóm không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!oneOf(body?.mode, ['random', 'rotate'] as const)) {
      throw validationError([{ field: 'mode', message: 'Cách đổi nhóm trưởng là random hoặc rotate' }]);
    }
    return this.groupSets.changeLeaders(currentUser, id, body.mode);
  }
}
