import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { Clock } from '@school-management/server';
import {
  FOOD_CERTIFICATE_TYPES,
  FOOD_CERTIFICATE_WARNING_DAYS,
  FOOD_LOT_EXPIRY_WARNING_DAYS,
  FOOD_SAMPLE_RETENTION_HOURS,
  MY_WORK_DUE_SOON_DAYS,
  PERMISSION_CODES,
  PROFESSIONAL_STATUS_LABELS,
  type MyWorkItem,
  type MyWorkSourceCode,
} from '@school-management/shared';
import type { Kysely } from 'kysely';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { ProfessionalRecordsService } from '../professional-records/professional-records.js';
import { LEADER_ROLE, MANAGER_ROLE, TeachingAccess } from '../teaching/teaching-access.js';

// Nguồn việc của Việc của tôi (DT-18 phần 18e, YCTD-142). Mỗi phân hệ cung cấp một nguồn qua giao diện chung MyWorkSource:
// nguồn trả các việc đang chờ chính người dùng (được giao, chờ ý kiến, chờ ký, chờ duyệt, bị trả lại, chưa nộp). Phần sau thêm
// phân hệ thì viết thêm một lớp nguồn và khai báo ở MY_WORK_SOURCE_TYPES, không sửa màn hình. Nguồn đọc thẳng bảng của phân
// hệ với đúng điều kiện "chờ tôi" của danh sách tương ứng; không ghi dữ liệu (hạn tự động của KPI vẫn áp khi mở phân hệ KPI).
// Cách chọn nguồn và điều kiện do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11
export abstract class MyWorkSource {
  abstract readonly code: MyWorkSourceCode;
  abstract collect(currentUser: CurrentUser): Promise<MyWorkItem[]>;
}

const MAXIMUM_PER_SOURCE = 200;
const DAY = 86_400_000;

// Hạn dạng ngày (YYYY-MM-DD) hoặc thời điểm; quá hạn khi đã qua, sắp đến hạn khi còn trong MY_WORK_DUE_SOON_DAYS ngày
export function deadlineState(deadline: string | Date | null, now: Date): { overdue: boolean; due_soon: boolean } {
  if (!deadline) {
    return { overdue: false, due_soon: false };
  }
  const today = VIETNAM_DATE.format(now);
  if (typeof deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
    const soon = VIETNAM_DATE.format(new Date(now.getTime() + MY_WORK_DUE_SOON_DAYS * DAY));
    return { overdue: deadline < today, due_soon: deadline >= today && deadline <= soon };
  }
  const at = deadline instanceof Date ? deadline : new Date(deadline);
  return {
    overdue: at.getTime() < now.getTime(),
    due_soon: at.getTime() >= now.getTime() && at.getTime() <= now.getTime() + MY_WORK_DUE_SOON_DAYS * DAY,
  };
}

function iso(value: string | Date | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : value;
}

function item(
  now: Date,
  value: Omit<MyWorkItem, 'overdue' | 'due_soon' | 'deadline' | 'received_at'> & {
    deadline: string | Date | null;
    received_at: string | Date | null;
  },
): MyWorkItem {
  return {
    ...value,
    deadline: iso(value.deadline),
    received_at: iso(value.received_at),
    ...deadlineState(value.deadline, now),
  };
}

async function ownStaff(database: Kysely<SchoolYearDatabase>, currentUser: CurrentUser) {
  return database
    .selectFrom('staff')
    .select(['id', 'org_unit_id', 'department_id'])
    .where('user_id', '=', currentUser.id)
    .where('status', '=', 'active')
    .executeTakeFirst();
}

const INCOMING_ROLE_LABELS: Record<string, string> = {
  leader: 'Trình lãnh đạo',
  main: 'Xử lý chính',
  coordinate: 'Phối hợp',
  view: 'Xem để biết',
};

// Văn bản đến (18a): dòng phân công của tôi đang chờ (trình lãnh đạo, xử lý chính, phối hợp, xem để biết) như mục Chờ xử lý;
// văn thư thêm văn bản liên thông chờ vào sổ và đề nghị gia hạn chờ quyết định
@Injectable()
export class IncomingWorkSource extends MyWorkSource {
  readonly code = 'incoming' as const;
  constructor(
    private readonly databases: Databases,
    private readonly clock: Clock,
  ) {
    super();
  }

  async collect(currentUser: CurrentUser): Promise<MyWorkItem[]> {
    const now = this.clock.now();
    const system = this.databases.system;
    const rows = await system
      .selectFrom('incoming_document_assignments as mine')
      .innerJoin('incoming_documents', 'incoming_documents.id', 'mine.document_id')
      .select([
        'incoming_documents.id',
        'incoming_documents.summary',
        'incoming_documents.symbol',
        'incoming_documents.issuer_name',
        'mine.role',
        'mine.deadline',
        'mine.created_at',
        'mine.read_at',
      ])
      .where('mine.user_id', '=', currentUser.id)
      .where('mine.status', '=', 'pending')
      .orderBy('mine.created_at', 'desc')
      .limit(MAXIMUM_PER_SOURCE)
      .execute();
    const items = rows.map((row) =>
      item(now, {
        source: this.code,
        kind: INCOMING_ROLE_LABELS[row.role] ?? row.role,
        title: row.summary,
        detail: [row.symbol, row.issuer_name, row.read_at ? null : 'chưa đọc'].filter(Boolean).join(' – '),
        link: row.role === 'view' ? '/incoming-documents/for-information' : '/incoming-documents',
        deadline: row.deadline,
        received_at: row.created_at,
      }),
    );
    const scope = currentUser.organizationScope(PERMISSION_CODES.incomingDocumentRegister);
    if (scope.wholeSchool) {
      const waiting = await system
        .selectFrom('incoming_documents')
        .select(['id', 'summary', 'symbol', 'received_at', 'created_at'])
        .where('status', '=', 'pending_registration')
        .orderBy('created_at', 'desc')
        .limit(MAXIMUM_PER_SOURCE)
        .execute();
      for (const row of waiting) {
        items.push(
          item(now, {
            source: this.code,
            kind: 'Chờ vào sổ',
            title: row.summary,
            detail: row.symbol,
            link: '/incoming-documents/interconnect',
            deadline: null,
            received_at: row.received_at ?? row.created_at,
          }),
        );
      }
      const extensions = await system
        .selectFrom('incoming_document_assignments as assignments')
        .innerJoin('incoming_documents', 'incoming_documents.id', 'assignments.document_id')
        .select([
          'incoming_documents.summary',
          'assignments.user_name',
          'assignments.extension_until',
          'assignments.created_at',
        ])
        .where('assignments.extension_status', '=', 'requested')
        .limit(MAXIMUM_PER_SOURCE)
        .execute();
      for (const row of extensions) {
        items.push(
          item(now, {
            source: this.code,
            kind: 'Đề nghị gia hạn',
            title: row.summary,
            detail: `${row.user_name} xin gia hạn đến ${row.extension_until ?? ''}`,
            link: '/incoming-documents/manage',
            deadline: null,
            received_at: row.created_at,
          }),
        );
      }
    }
    return items;
  }
}

// Văn bản đi (18b): chờ tôi cho ý kiến (lượt mới nhất), chờ tôi ký, dự thảo của tôi bị trả lại; văn thư thêm văn bản đã ký
// chờ cấp số
@Injectable()
export class OutgoingWorkSource extends MyWorkSource {
  readonly code = 'outgoing' as const;
  constructor(
    private readonly databases: Databases,
    private readonly clock: Clock,
  ) {
    super();
  }

  async collect(currentUser: CurrentUser): Promise<MyWorkItem[]> {
    const now = this.clock.now();
    const system = this.databases.system;
    const me = currentUser.id;
    const opinions = await system
      .selectFrom('outgoing_document_opinions as mine')
      .innerJoin('outgoing_documents', 'outgoing_documents.id', 'mine.document_id')
      .select([
        'outgoing_documents.summary',
        'outgoing_documents.drafter_name',
        'mine.deadline',
        'mine.created_at',
        'mine.status',
      ])
      .where('outgoing_documents.status', '=', 'consulting')
      .where('mine.user_id', '=', me)
      .where('mine.status', 'in', ['pending', 'answered'])
      .whereRef(
        'mine.round',
        '=',
        (eb) =>
          eb
            .selectFrom('outgoing_document_opinions as latest')
            .select((inner) => inner.fn.max('latest.round').as('round'))
            .whereRef('latest.document_id', '=', 'mine.document_id') as never,
      )
      .limit(MAXIMUM_PER_SOURCE)
      .execute();
    const items = opinions.map((row) =>
      item(now, {
        source: this.code,
        kind: row.status === 'answered' ? 'Đã cho ý kiến, chờ kết thúc' : 'Cho ý kiến',
        title: row.summary,
        detail: `Người soạn: ${row.drafter_name}`,
        link: '/outgoing-documents',
        deadline: row.deadline,
        received_at: row.created_at,
      }),
    );
    const documents = await system
      .selectFrom('outgoing_documents')
      .select(['summary', 'drafter_name', 'status', 'return_note', 'submitted_at', 'returned_at', 'signer_id'])
      .where((eb) =>
        eb.or([
          eb.and([eb('status', '=', 'pending_signature'), eb('signer_id', '=', me)]),
          eb.and([
            eb('status', '=', 'draft'),
            eb('return_note', 'is not', null),
            eb.or([eb('drafter_id', '=', me), eb('created_by', '=', me)]),
          ]),
        ]),
      )
      .limit(MAXIMUM_PER_SOURCE)
      .execute();
    for (const row of documents) {
      const signing = row.status === 'pending_signature';
      if (signing && !currentUser.hasPermission(PERMISSION_CODES.outgoingDocumentSign)) {
        continue;
      }
      items.push(
        item(now, {
          source: this.code,
          kind: signing ? 'Chờ ký' : 'Bị trả lại',
          title: row.summary,
          detail: signing ? `Người soạn: ${row.drafter_name}` : row.return_note,
          link: '/outgoing-documents',
          deadline: null,
          received_at: signing ? row.submitted_at : row.returned_at,
        }),
      );
    }
    if (currentUser.organizationScope(PERMISSION_CODES.outgoingDocumentIssue).wholeSchool) {
      const signed = await system
        .selectFrom('outgoing_documents')
        .select(['summary', 'signer_name', 'signed_at'])
        .where('status', '=', 'signed')
        .limit(MAXIMUM_PER_SOURCE)
        .execute();
      for (const row of signed) {
        items.push(
          item(now, {
            source: this.code,
            kind: 'Chờ cấp số',
            title: row.summary,
            detail: row.signer_name ? `Người ký: ${row.signer_name}` : null,
            link: '/outgoing-documents/manage',
            deadline: null,
            received_at: row.signed_at,
          }),
        );
      }
    }
    return items;
  }
}

// Giao việc (18c) và việc của Quản lý công việc: phân công cho tôi hoặc cho đơn vị tôi quản lý chưa xong (trừ vai theo dõi),
// việc tôi giao hoặc chỉ đạo có kết quả chờ phê duyệt, việc cũ được giao cho tôi chưa xong
@Injectable()
export class DirectiveWorkSource extends MyWorkSource {
  readonly code = 'directives' as const;
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly clock: Clock,
  ) {
    super();
  }

  async collect(currentUser: CurrentUser): Promise<MyWorkItem[]> {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return [];
    }
    const database = current.database;
    const now = this.clock.now();
    const staff = await ownStaff(database, currentUser);
    const managed = await database
      .selectFrom('org_units')
      .select('id')
      .where('manager_user_id', '=', currentUser.id)
      .execute();
    const managedIds = managed.map((unit) => unit.id);
    const items: MyWorkItem[] = [];
    if (staff || managedIds.length > 0) {
      const assignments = await database
        .selectFrom('task_assignments')
        .innerJoin('tasks', 'tasks.id', 'task_assignments.task_id')
        .select([
          'tasks.title',
          'tasks.assigner_name',
          'task_assignments.role',
          'task_assignments.status',
          'task_assignments.due_date',
          'task_assignments.created_at',
        ])
        .where('tasks.task_type', '=', 'directive')
        .where('tasks.status', '!=', 'cancelled')
        .where('task_assignments.status', 'in', ['todo', 'in_progress'])
        .where('task_assignments.role', '!=', 'follow')
        .where((eb) => {
          const conditions = [];
          if (staff) {
            conditions.push(eb('task_assignments.staff_id', '=', staff.id));
          }
          if (managedIds.length > 0) {
            conditions.push(
              eb.and([
                eb('task_assignments.target_type', '=', 'unit'),
                eb('task_assignments.org_unit_id', 'in', managedIds),
              ]),
            );
          }
          return eb.or(conditions);
        })
        .orderBy('task_assignments.due_date')
        .limit(MAXIMUM_PER_SOURCE)
        .execute();
      for (const row of assignments) {
        items.push(
          item(now, {
            source: this.code,
            kind: row.role === 'main' ? 'Xử lý chính' : 'Phối hợp',
            title: row.title,
            detail: `Người giao: ${row.assigner_name}`,
            link: '/directives/inbox',
            deadline: row.due_date,
            received_at: row.created_at,
          }),
        );
      }
    }
    const approvals = await database
      .selectFrom('tasks')
      .select(['tasks.title', 'tasks.due_date', 'tasks.updated_at'])
      .where('tasks.task_type', '=', 'directive')
      .where('tasks.status', '!=', 'cancelled')
      .where((eb) =>
        eb.or([eb('tasks.assigner_user_id', '=', currentUser.id), eb('tasks.leader_user_id', '=', currentUser.id)]),
      )
      .where((eb) =>
        eb.exists(
          eb
            .selectFrom('task_assignments')
            .select('task_assignments.id')
            .whereRef('task_assignments.task_id', '=', 'tasks.id')
            .where('task_assignments.status', '=', 'pending_approval'),
        ),
      )
      .limit(MAXIMUM_PER_SOURCE)
      .execute();
    for (const row of approvals) {
      items.push(
        item(now, {
          source: this.code,
          kind: 'Chờ phê duyệt kết quả',
          title: row.title,
          detail: null,
          link: '/directives/outbox',
          deadline: null,
          received_at: row.updated_at,
        }),
      );
    }
    if (staff) {
      const tasks = await database
        .selectFrom('tasks')
        .select(['title', 'assigner_name', 'due_date', 'created_at'])
        .where('task_type', '=', 'assigned')
        .where('assignee_staff_id', '=', staff.id)
        .where('status', 'in', ['todo', 'in_progress'])
        .limit(MAXIMUM_PER_SOURCE)
        .execute();
      for (const row of tasks) {
        items.push(
          item(now, {
            source: this.code,
            kind: 'Việc được giao',
            title: row.title,
            detail: `Người giao: ${row.assigner_name}`,
            link: '/work',
            deadline: row.due_date,
            received_at: row.created_at,
          }),
        );
      }
    }
    return items;
  }
}

// Phòng họp (18c): đăng ký phòng họp chờ duyệt cho người duyệt phòng họp
@Injectable()
export class ScheduleWorkSource extends MyWorkSource {
  readonly code = 'schedules' as const;
  constructor(
    private readonly databases: Databases,
    private readonly clock: Clock,
  ) {
    super();
  }

  async collect(currentUser: CurrentUser): Promise<MyWorkItem[]> {
    if (!currentUser.hasPermission(PERMISSION_CODES.meetingRoomManage)) {
      return [];
    }
    const now = this.clock.now();
    const rows = await this.databases.system
      .selectFrom('room_bookings')
      .innerJoin('meeting_rooms', 'meeting_rooms.id', 'room_bookings.room_id')
      .select([
        'room_bookings.title',
        'room_bookings.requested_by_name',
        'room_bookings.starts_at',
        'room_bookings.created_at',
        'meeting_rooms.name as room_name',
      ])
      .where('room_bookings.status', '=', 'pending')
      .where('room_bookings.ends_at', '>', now)
      .orderBy('room_bookings.starts_at')
      .limit(MAXIMUM_PER_SOURCE)
      .execute();
    return rows.map((row) =>
      item(now, {
        source: this.code,
        kind: 'Duyệt đăng ký phòng họp',
        title: row.title,
        detail: `${row.room_name} – ${row.requested_by_name}`,
        link: '/room-bookings',
        deadline: row.starts_at,
        received_at: row.created_at,
      }),
    );
  }
}

// KPI (18d): việc được giao chờ tôi xác nhận, việc đang làm chờ minh chứng và tự đánh giá, phiếu tự đánh giá chưa nộp; với
// người chấm: đăng ký chờ duyệt, kết quả chờ chấm, đề nghị gia hạn, phiếu chờ cấp trên đánh giá. Việc đã quá hạn duyệt, hạn
// chấm thì không hiện vì phân hệ KPI tự xử lý khi mở
@Injectable()
export class KpiWorkSource extends MyWorkSource {
  readonly code = 'kpi' as const;
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly clock: Clock,
  ) {
    super();
  }

  async collect(currentUser: CurrentUser): Promise<MyWorkItem[]> {
    const participate = currentUser.hasPermission(PERMISSION_CODES.kpiParticipate);
    const manage = currentUser.hasPermission(PERMISSION_CODES.kpiManage);
    if (!participate && !manage) {
      return [];
    }
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return [];
    }
    const database = current.database;
    const now = this.clock.now();
    const staff = await ownStaff(database, currentUser);
    if (!staff) {
      return [];
    }
    const items: MyWorkItem[] = [];
    const base = database
      .selectFrom('kpi_tasks')
      .innerJoin('kpi_periods', 'kpi_periods.id', 'kpi_tasks.period_id')
      .innerJoin('staff as performer', 'performer.id', 'kpi_tasks.staff_id')
      .where('kpi_periods.status', '=', 'open');
    if (participate) {
      const mine = await base
        .select([
          'kpi_tasks.name',
          'kpi_tasks.status',
          'kpi_tasks.deadline',
          'kpi_tasks.approval_due_at',
          'kpi_tasks.assigned_by_name',
          'kpi_tasks.created_at',
          'kpi_periods.name as period_name',
        ])
        .where('kpi_tasks.staff_id', '=', staff.id)
        .where('kpi_tasks.status', 'in', ['assigned', 'in_progress', 'rework'])
        .limit(MAXIMUM_PER_SOURCE)
        .execute();
      for (const row of mine) {
        if (row.status === 'assigned' && row.approval_due_at && row.approval_due_at < now) {
          continue;
        }
        items.push(
          item(now, {
            source: this.code,
            kind:
              row.status === 'assigned'
                ? 'Xác nhận việc được giao'
                : row.status === 'rework'
                  ? 'Bị trả lại, làm lại'
                  : 'Nộp minh chứng, tự đánh giá',
            title: row.name,
            detail: [row.period_name, row.assigned_by_name ? `Người giao: ${row.assigned_by_name}` : null]
              .filter(Boolean)
              .join(' – '),
            link: '/kpi/my-tasks',
            deadline: row.status === 'assigned' ? row.approval_due_at : row.deadline,
            received_at: row.created_at,
          }),
        );
      }
      const evaluations = await database
        .selectFrom('kpi_evaluations')
        .innerJoin('kpi_periods', 'kpi_periods.id', 'kpi_evaluations.period_id')
        .select(['kpi_periods.name', 'kpi_periods.self_to', 'kpi_evaluations.status', 'kpi_evaluations.updated_at'])
        .where('kpi_periods.status', '=', 'open')
        .where('kpi_evaluations.staff_id', '=', staff.id)
        .where('kpi_evaluations.status', 'in', ['draft', 'returned'])
        .where('kpi_periods.self_from', '<=', VIETNAM_DATE.format(now))
        .execute();
      for (const row of evaluations) {
        items.push(
          item(now, {
            source: this.code,
            kind: row.status === 'returned' ? 'Phiếu tự đánh giá bị trả lại' : 'Tự đánh giá, xếp loại',
            title: row.name,
            detail: null,
            link: '/kpi/my-evaluation',
            deadline: row.self_to,
            received_at: row.updated_at,
          }),
        );
      }
    }
    // Việc tôi chấm: người chấm được chỉ định hoặc cấp trên trực tiếp của người thực hiện
    const managedRows = await base
      .leftJoin('kpi_profiles', 'kpi_profiles.staff_id', 'kpi_tasks.staff_id')
      .select([
        'kpi_tasks.name',
        'kpi_tasks.status',
        'kpi_tasks.extension_status',
        'kpi_tasks.approval_due_at',
        'kpi_tasks.grading_due_at',
        'kpi_tasks.updated_at',
        'performer.full_name',
      ])
      .where('kpi_tasks.staff_id', '!=', staff.id)
      .where((eb) =>
        eb.or([eb('kpi_tasks.evaluator_staff_id', '=', staff.id), eb('kpi_profiles.superior_staff_id', '=', staff.id)]),
      )
      .where((eb) =>
        eb.or([
          eb('kpi_tasks.status', 'in', ['pending_approval', 'self_assessed']),
          eb('kpi_tasks.extension_status', '=', 'pending'),
        ]),
      )
      .limit(MAXIMUM_PER_SOURCE)
      .execute();
    for (const row of managedRows) {
      const due =
        row.status === 'pending_approval'
          ? row.approval_due_at
          : row.status === 'self_assessed'
            ? row.grading_due_at
            : null;
      if (due && due < now) {
        continue;
      }
      items.push(
        item(now, {
          source: this.code,
          kind:
            row.extension_status === 'pending'
              ? 'Duyệt gia hạn'
              : row.status === 'pending_approval'
                ? 'Duyệt đăng ký việc'
                : 'Chấm điểm việc',
          title: row.name,
          detail: row.full_name,
          link: row.status === 'self_assessed' ? '/kpi/grading' : '/kpi/assignments',
          deadline: due,
          received_at: row.updated_at,
        }),
      );
    }
    const submitted = await database
      .selectFrom('kpi_evaluations')
      .innerJoin('kpi_periods', 'kpi_periods.id', 'kpi_evaluations.period_id')
      .innerJoin('kpi_profiles', 'kpi_profiles.staff_id', 'kpi_evaluations.staff_id')
      .innerJoin('staff', 'staff.id', 'kpi_evaluations.staff_id')
      .select(['kpi_periods.name', 'kpi_periods.review_to', 'staff.full_name', 'kpi_evaluations.submitted_at'])
      .where('kpi_periods.status', '=', 'open')
      .where('kpi_evaluations.status', '=', 'submitted')
      .where('kpi_profiles.superior_staff_id', '=', staff.id)
      .limit(MAXIMUM_PER_SOURCE)
      .execute();
    for (const row of submitted) {
      items.push(
        item(now, {
          source: this.code,
          kind: 'Đánh giá, xếp loại cán bộ',
          title: `${row.full_name} – ${row.name}`,
          detail: null,
          link: '/kpi/evaluations',
          deadline: row.review_to,
          received_at: row.submitted_at,
        }),
      );
    }
    return items;
  }
}

// Hồ sơ chuyên môn (18e): hồ sơ chờ tôi duyệt, hồ sơ của tôi bị trả lại, đợt nộp đang mở tôi chưa nộp
@Injectable()
export class ProfessionalWorkSource extends MyWorkSource {
  readonly code = 'professional' as const;
  constructor(
    private readonly records: ProfessionalRecordsService,
    private readonly clock: Clock,
  ) {
    super();
  }

  async collect(currentUser: CurrentUser): Promise<MyWorkItem[]> {
    const codes = [
      PERMISSION_CODES.professionalRecordUse,
      PERMISSION_CODES.professionalRecordReview,
      PERMISSION_CODES.professionalRecordApprove,
      PERMISSION_CODES.professionalRecordManage,
    ];
    if (!codes.some((code) => currentUser.hasPermission(code))) {
      return [];
    }
    const now = this.clock.now();
    const pending = await this.records.pendingWork(currentUser);
    return [
      ...pending.review.map((row) =>
        item(now, {
          source: this.code,
          kind: PROFESSIONAL_STATUS_LABELS[row.status],
          title: row.title,
          detail: row.owner_name,
          link: '/professional-records/review',
          deadline: null,
          received_at: row.updated_at,
        }),
      ),
      ...pending.returned.map((row) =>
        item(now, {
          source: this.code,
          kind: 'Hồ sơ bị trả lại',
          title: row.title,
          detail: row.return_note,
          link: '/professional-records',
          deadline: null,
          received_at: row.updated_at,
        }),
      ),
      ...pending.rounds.map((round) =>
        item(now, {
          source: this.code,
          kind: round.submitter_kind === 'staff' ? 'Nộp hồ sơ theo đợt' : 'Nộp hồ sơ của tổ theo đợt',
          title: round.title,
          detail: round.document_id ? 'Đã tạo hồ sơ, chưa nộp' : 'Chưa tạo hồ sơ',
          link: '/professional-rounds',
          deadline: round.due_at,
          received_at: round.created_at,
        }),
      ),
    ];
  }
}

// Kế hoạch bài dạy (P03): tổ trưởng chuyên môn duyệt kế hoạch đã gửi, quản lý đơn vị duyệt sau tổ trưởng, trong phạm vi đơn vị
@Injectable()
export class TeachingWorkSource extends MyWorkSource {
  readonly code = 'teaching' as const;
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly teachingAccess: TeachingAccess,
    private readonly clock: Clock,
  ) {
    super();
  }

  async collect(currentUser: CurrentUser): Promise<MyWorkItem[]> {
    const permission = PERMISSION_CODES.lessonPlanReview;
    if (!currentUser.hasPermission(permission)) {
      return [];
    }
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return [];
    }
    const now = this.clock.now();
    const manager = await this.teachingAccess.scopeOfRoles(currentUser, [MANAGER_ROLE], permission);
    const leader = await this.teachingAccess.scopeOfRoles(currentUser, [LEADER_ROLE], permission);
    const condition = (
      scope: { wholeSchool: boolean; orgUnitIds: string[] },
      statuses: Array<'submitted' | 'leader_approved'>,
    ) => (scope.wholeSchool || scope.orgUnitIds.length > 0 ? { scope, statuses } : null);
    const parts = [condition(manager, ['submitted', 'leader_approved']), condition(leader, ['submitted'])].filter(
      (part): part is NonNullable<typeof part> => part !== null,
    );
    if (parts.length === 0) {
      return [];
    }
    const rows = await current.database
      .selectFrom('lesson_plans')
      .innerJoin('lessons', 'lessons.id', 'lesson_plans.lesson_id')
      .innerJoin('classes', 'classes.id', 'lesson_plans.class_id')
      .select([
        'lessons.name',
        'classes.name as class_name',
        'lesson_plans.teacher_name',
        'lesson_plans.planned_date',
        'lesson_plans.status',
        'lesson_plans.submitted_at',
      ])
      .where('lesson_plans.teacher_id', '!=', currentUser.id)
      .where((eb) =>
        eb.or(
          parts.map((part) =>
            eb.and([
              eb('lesson_plans.status', 'in', part.statuses),
              ...(part.scope.wholeSchool ? [] : [eb('lesson_plans.org_unit_id', 'in', part.scope.orgUnitIds)]),
            ]),
          ),
        ),
      )
      .orderBy('lesson_plans.planned_date')
      .limit(MAXIMUM_PER_SOURCE)
      .execute();
    return rows.map((row) =>
      item(now, {
        source: this.code,
        kind: row.status === 'leader_approved' ? 'Duyệt sau tổ trưởng' : 'Duyệt kế hoạch bài dạy',
        title: `${row.name} – ${row.class_name}`,
        detail: row.teacher_name,
        link: '/teaching',
        deadline: row.planned_date,
        received_at: row.submitted_at,
      }),
    );
  }
}

// Kí hồ sơ (16k, 17b): hồ sơ của năm học hiện hành đã tạo chờ kí, cho người có quyền kí
@Injectable()
export class SigningWorkSource extends MyWorkSource {
  readonly code = 'signing' as const;
  constructor(
    private readonly databases: Databases,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly clock: Clock,
  ) {
    super();
  }

  async collect(currentUser: CurrentUser): Promise<MyWorkItem[]> {
    if (!currentUser.hasPermission(PERMISSION_CODES.signingSign)) {
      return [];
    }
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return [];
    }
    const now = this.clock.now();
    const rows = await this.databases.system
      .selectFrom('signing_dossiers')
      .select(['object_label', 'code', 'created_by_name', 'created_at'])
      .where('academic_year_id', '=', current.academicYearId)
      .where('status', '=', 'created')
      .orderBy('created_at', 'desc')
      .limit(MAXIMUM_PER_SOURCE)
      .execute();
    return rows.map((row) =>
      item(now, {
        source: this.code,
        kind: 'Hồ sơ chờ kí',
        title: row.object_label,
        detail: `${row.code} – ${row.created_by_name}`,
        link: '/signing-dossiers',
        deadline: null,
        received_at: row.created_at,
      }),
    );
  }
}

// Nghỉ phép (P08): đơn nghỉ phép chờ duyệt trong phạm vi đơn vị của người duyệt, không gồm đơn của chính mình (BR-40)
@Injectable()
export class LeaveWorkSource extends MyWorkSource {
  readonly code = 'leave' as const;
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly clock: Clock,
  ) {
    super();
  }

  async collect(currentUser: CurrentUser): Promise<MyWorkItem[]> {
    const permission = PERMISSION_CODES.leaveApprove;
    if (!currentUser.hasPermission(permission)) {
      return [];
    }
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return [];
    }
    const scope = await this.organizationScopes.resolveStaff(currentUser, permission);
    if (!scope.wholeSchool && scope.orgUnitIds.length === 0) {
      return [];
    }
    const now = this.clock.now();
    let query = current.database
      .selectFrom('leave_requests')
      .innerJoin('staff', 'staff.id', 'leave_requests.staff_id')
      .select([
        'staff.full_name',
        'leave_requests.from_date',
        'leave_requests.to_date',
        'leave_requests.days',
        'leave_requests.requested_at',
      ])
      .where('leave_requests.status', '=', 'pending')
      .where((eb) => eb.or([eb('staff.user_id', 'is', null), eb('staff.user_id', '!=', currentUser.id)]))
      .orderBy('leave_requests.from_date')
      .limit(MAXIMUM_PER_SOURCE);
    if (!scope.wholeSchool) {
      query = query.where('staff.org_unit_id', 'in', scope.orgUnitIds);
    }
    const rows = await query.execute();
    return rows.map((row) =>
      item(now, {
        source: this.code,
        kind: 'Duyệt đơn nghỉ phép',
        title: row.full_name,
        detail: `${row.from_date} đến ${row.to_date} (${Number(row.days)} ngày)`,
        link: '/leave-requests',
        deadline: row.from_date,
        received_at: row.requested_at,
      }),
    );
  }
}

// Bán trú, an toàn thực phẩm (DT-18 phần 22b, BR-144, BR-145): người kiểm thực thấy lô chờ kiểm tra trước khi chế biến và mẫu
// lưu đã đủ 24 giờ chờ hủy; bếp thấy lô chờ kiểm tra, lô còn trong bếp sắp hết hạn dùng, giấy tờ của nhà cung cấp sắp hết hạn
// hoặc đã hết hạn (cảnh báo trước 30 ngày)
@Injectable()
export class FoodSafetyWorkSource extends MyWorkSource {
  readonly code = 'food_safety' as const;
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly clock: Clock,
  ) {
    super();
  }

  async collect(currentUser: CurrentUser): Promise<MyWorkItem[]> {
    const inspect = currentUser.hasPermission(PERMISSION_CODES.foodSafetyInspect);
    const manage = currentUser.hasPermission(PERMISSION_CODES.kitchenManage);
    if (!inspect && !manage) {
      return [];
    }
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return [];
    }
    const database = current.database;
    const now = this.clock.now();
    const today = VIETNAM_DATE.format(now);
    const dayAfter = (days: number) =>
      new Date(Date.parse(`${today}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
    // null là toàn trường
    const units = async (permission: string) => {
      const scope = await this.organizationScopes.resolveStaff(currentUser, permission);
      return scope.wholeSchool ? null : scope.orgUnitIds;
    };
    const items: MyWorkItem[] = [];
    const lotUnits = await units(inspect ? PERMISSION_CODES.foodSafetyInspect : PERMISSION_CODES.kitchenManage);
    if (lotUnits === null || lotUnits.length > 0) {
      const pending = await database
        .selectFrom('food_lots')
        .innerJoin('ingredients', 'ingredients.id', 'food_lots.ingredient_id')
        .select(['food_lots.code', 'ingredients.name', 'food_lots.received_date', 'food_lots.created_at'])
        .where('food_lots.status', '=', 'pending')
        .$if(lotUnits !== null, (query) => query.where('food_lots.org_unit_id', 'in', lotUnits ?? []))
        .orderBy('food_lots.received_date')
        .limit(MAXIMUM_PER_SOURCE)
        .execute();
      for (const row of pending) {
        items.push(
          item(now, {
            source: this.code,
            kind: 'Lô chờ kiểm tra trước khi chế biến',
            title: `${row.name} (${row.code})`,
            detail: `Nhập ngày ${row.received_date}`,
            link: '/food-safety/inspections',
            deadline: row.received_date,
            received_at: row.created_at,
          }),
        );
      }
    }
    const sampleUnits = inspect ? await units(PERMISSION_CODES.foodSafetyInspect) : [];
    if (sampleUnits === null || sampleUnits.length > 0) {
      const due = await database
        .selectFrom('food_samples')
        .select(['dish_name', 'sample_date', 'sampled_at'])
        .where('status', '=', 'stored')
        .where('sampled_at', '<=', new Date(now.getTime() - FOOD_SAMPLE_RETENTION_HOURS * 3_600_000))
        .$if(sampleUnits !== null, (query) => query.where('org_unit_id', 'in', sampleUnits ?? []))
        .orderBy('sampled_at')
        .limit(MAXIMUM_PER_SOURCE)
        .execute();
      for (const row of due) {
        items.push(
          item(now, {
            source: this.code,
            kind: 'Mẫu thức ăn lưu chờ hủy',
            title: row.dish_name,
            detail: `Lưu ngày ${row.sample_date}, đã đủ ${FOOD_SAMPLE_RETENTION_HOURS} giờ`,
            link: '/food-safety/samples',
            deadline: null,
            received_at: row.sampled_at,
          }),
        );
      }
    }
    const manageUnits = manage ? await units(PERMISSION_CODES.kitchenManage) : [];
    if (manageUnits === null || manageUnits.length > 0) {
      const certificates = await database
        .selectFrom('food_supplier_certificates')
        .innerJoin('food_suppliers', 'food_suppliers.id', 'food_supplier_certificates.supplier_id')
        .select([
          'food_suppliers.name',
          'food_supplier_certificates.certificate_type',
          'food_supplier_certificates.number',
          'food_supplier_certificates.expires_on',
          'food_supplier_certificates.updated_at',
        ])
        .where('food_supplier_certificates.status', '=', 'active')
        .where('food_suppliers.status', '=', 'active')
        .where('food_supplier_certificates.expires_on', '<=', dayAfter(FOOD_CERTIFICATE_WARNING_DAYS))
        .$if(manageUnits !== null, (query) => query.where('food_suppliers.org_unit_id', 'in', manageUnits ?? []))
        .orderBy('food_supplier_certificates.expires_on')
        .limit(MAXIMUM_PER_SOURCE)
        .execute();
      for (const row of certificates) {
        const type = FOOD_CERTIFICATE_TYPES.find((entry) => entry.value === row.certificate_type)?.label ?? '';
        items.push(
          item(now, {
            source: this.code,
            kind:
              (row.expires_on ?? '') < today ? 'Giấy tờ nhà cung cấp đã hết hạn' : 'Giấy tờ nhà cung cấp sắp hết hạn',
            title: row.name,
            detail: `${type} số ${row.number}`,
            link: '/food-safety/supplier-records',
            deadline: row.expires_on,
            received_at: row.updated_at,
          }),
        );
      }
      const lots = await database
        .selectFrom('food_lots')
        .innerJoin('ingredients', 'ingredients.id', 'food_lots.ingredient_id')
        .select(['food_lots.code', 'ingredients.name', 'food_lots.expiry_date', 'food_lots.created_at'])
        .where('food_lots.status', '=', 'accepted')
        .where('food_lots.expiry_date', '<=', dayAfter(FOOD_LOT_EXPIRY_WARNING_DAYS))
        .$if(manageUnits !== null, (query) => query.where('food_lots.org_unit_id', 'in', manageUnits ?? []))
        .orderBy('food_lots.expiry_date')
        .limit(MAXIMUM_PER_SOURCE)
        .execute();
      for (const row of lots) {
        items.push(
          item(now, {
            source: this.code,
            kind: 'Lô sắp hết hạn dùng',
            title: `${row.name} (${row.code})`,
            detail: 'Dùng trước hạn hoặc đóng lô (đã dùng hết, hủy)',
            link: '/food-safety/lots',
            deadline: row.expiry_date,
            received_at: row.created_at,
          }),
        );
      }
    }
    return items;
  }
}

export const MY_WORK_SOURCE_TYPES = [
  IncomingWorkSource,
  OutgoingWorkSource,
  DirectiveWorkSource,
  ScheduleWorkSource,
  KpiWorkSource,
  ProfessionalWorkSource,
  TeachingWorkSource,
  SigningWorkSource,
  LeaveWorkSource,
  FoodSafetyWorkSource,
];
