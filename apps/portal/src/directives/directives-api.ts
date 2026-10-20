import type {
  DirectiveAssignmentStatus,
  DirectivePriority,
  DirectiveRecurrence,
  DirectiveRole,
  DirectiveStatusFilter,
  DirectiveTarget,
  RoomBookingStatusKey,
  ScheduleSessionKey,
  WorkFileStatusKey,
} from '@school-management/shared';
import { saveResponseFile } from '../exports/export-api.js';
import { fetchWithSession, readError, requestJson } from '../session/api-client.js';

// Giao việc, lịch đơn vị, phòng họp, hồ sơ công việc, báo cáo theo VNPT iOffice (DT-18 phần 18c, YCTD-141)
const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

function query(values: Record<string, string | number | boolean | undefined | null>): string {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '' && value !== false) {
      parameters.set(key, String(value));
    }
  }
  const text = parameters.toString();
  return text ? `?${text}` : '';
}

async function download(path: string, fallbackName: string): Promise<void> {
  const response = await fetchWithSession(path);
  if (!response.ok) {
    throw await readError(response);
  }
  saveResponseFile(await response.blob(), response.headers.get('content-disposition') ?? '', fallbackName);
}

export interface Paged<Item> {
  items: Item[];
  total: number;
  page: number;
  page_size: number;
}

// ---- Giao việc ----

export interface DirectiveOptions {
  units: Array<{
    id: string;
    name: string;
    unit_type: string;
    departments: Array<{ id: string; name: string }>;
    staff: Array<{ id: string; full_name: string; department_id: string | null; job_title_name: string | null }>;
  }>;
  leaders: Array<{ user_id: string; user_name: string; title: string | null }>;
}

export interface AssignmentDraft {
  role: DirectiveRole;
  target_type: DirectiveTarget;
  org_unit_id?: string | null;
  department_id?: string | null;
  staff_id?: string | null;
  start_date?: string | null;
  due_date?: string | null;
}

export interface DirectiveInput {
  content: string;
  leader_user_id: string | null;
  priority: DirectivePriority;
  start_date: string | null;
  duration_days: number | null;
  remind_assigner: boolean;
  recurrence: DirectiveRecurrence;
  source_document_id: string | null;
  related_documents: string | null;
  assignments: AssignmentDraft[];
}

export interface InboxItem {
  assignment_id: string;
  id: string;
  role: DirectiveRole;
  target_type: DirectiveTarget;
  status: DirectiveAssignmentStatus;
  progress_percent: number;
  start_date: string;
  due_date: string;
  approval_result: 'done' | 'not_done' | null;
  title: string;
  priority: DirectivePriority;
  assigner_name: string;
  leader_name: string | null;
  source_document_label: string | null;
  org_unit_name: string;
  department_name: string | null;
  staff_name: string | null;
  overdue: boolean;
  on_time: boolean | null;
}

export interface OutboxItem {
  id: string;
  task_type: 'directive' | 'assigned';
  title: string;
  priority: DirectivePriority;
  status: 'todo' | 'in_progress' | 'done' | 'cancelled';
  progress_percent: number;
  start_date: string | null;
  due_date: string | null;
  leader_name: string | null;
  assigner_name: string;
  source_document_label: string | null;
  main_handlers: string;
  coordinate_handlers: string;
  follow_handlers: string;
  pending_approval: number;
  overdue: boolean;
}

export interface DirectiveAssignment {
  id: string;
  parent_id: string | null;
  role: DirectiveRole;
  target_type: DirectiveTarget;
  org_unit_id: string;
  department_id: string | null;
  staff_id: string | null;
  org_unit_name: string;
  department_name: string | null;
  staff_name: string | null;
  start_date: string;
  due_date: string;
  status: DirectiveAssignmentStatus;
  progress_percent: number;
  approval_result: 'done' | 'not_done' | null;
  approval_note: string | null;
  result_note: string | null;
  overdue: boolean;
  on_time: boolean | null;
  can_update: boolean;
  can_delegate: boolean;
  can_approve: boolean;
  can_revoke: boolean;
}

export interface DirectiveDetail {
  id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'done' | 'cancelled';
  priority: DirectivePriority;
  recurrence: DirectiveRecurrence;
  next_reminder_on: string | null;
  remind_assigner: boolean;
  duration_days: number | null;
  start_date: string | null;
  due_date: string | null;
  progress_percent: number;
  assigner_name: string;
  leader_name: string | null;
  source_document_id: string | null;
  source_document_label: string | null;
  related_documents: string | null;
  cancel_reason: string | null;
  overdue: boolean;
  can_edit: boolean;
  assignments: DirectiveAssignment[];
  updates: Array<{
    id: string;
    assignment_id: string | null;
    content: string | null;
    progress_percent: number;
    created_by_name: string;
    created_at: string;
  }>;
  files: Array<{ id: string; file_name: string; size_bytes: number; created_by_name: string; created_at: string }>;
}

const TASKS = '/api/v1/task-directives';

export const readDirectiveOptions = (): Promise<DirectiveOptions> => requestJson(`${TASKS}/options`);
export const createDirective = (input: DirectiveInput): Promise<DirectiveDetail> =>
  requestJson(TASKS, json('POST', input));
export const listInbox = (filter: {
  status?: DirectiveStatusFilter | '';
  role?: DirectiveRole | '';
  target?: DirectiveTarget | '';
  q?: string;
  page: number;
  page_size: number;
}): Promise<Paged<InboxItem>> => requestJson(`${TASKS}${query({ box: 'inbox', ...filter })}`);
export const listOutbox = (filter: {
  status?: DirectiveStatusFilter | '';
  q?: string;
  page: number;
  page_size: number;
}): Promise<Paged<OutboxItem>> => requestJson(`${TASKS}${query({ box: 'outbox', ...filter })}`);
export const readDirective = (id: string): Promise<DirectiveDetail> => requestJson(`${TASKS}/${id}`);
export const updateDirective = (id: string, patch: Record<string, unknown>): Promise<DirectiveDetail> =>
  requestJson(`${TASKS}/${id}`, json('PATCH', patch));
export const cancelDirective = (id: string, reason: string): Promise<DirectiveDetail> =>
  requestJson(`${TASKS}/${id}/cancel`, json('POST', { reason }));
export const addAssignments = (
  id: string,
  assignments: AssignmentDraft[],
  parentId: string | null,
): Promise<DirectiveDetail> =>
  requestJson(`${TASKS}/${id}/assignments`, json('POST', { assignments, parent_id: parentId }));
export const revokeAssignment = (id: string, assignmentId: string, reason: string | null): Promise<DirectiveDetail> =>
  requestJson(`${TASKS}/${id}/assignments/${assignmentId}/revoke`, json('POST', { reason }));
export const reportProgress = (
  id: string,
  assignmentId: string,
  progress: number,
  content: string | null,
): Promise<DirectiveDetail> =>
  requestJson(
    `${TASKS}/${id}/assignments/${assignmentId}/progress`,
    json('POST', { progress_percent: progress, content }),
  );
export const approveAssignment = (
  id: string,
  assignmentId: string,
  result: 'done' | 'not_done',
  note: string | null,
): Promise<DirectiveDetail> =>
  requestJson(`${TASKS}/${id}/assignments/${assignmentId}/approve`, json('POST', { result, note }));
export async function uploadDirectiveFile(id: string, file: File): Promise<DirectiveDetail> {
  const form = new FormData();
  form.append('file', file);
  const response = await fetchWithSession(`${TASKS}/${id}/files`, { method: 'POST', body: form });
  if (!response.ok) {
    throw await readError(response);
  }
  return (await response.json()) as DirectiveDetail;
}
export const downloadDirectiveFile = (id: string, file: { id: string; file_name: string }) =>
  download(`${TASKS}/${id}/files/${file.id}`, file.file_name);
export const deleteDirectiveFile = (id: string, fileId: string): Promise<DirectiveDetail> =>
  requestJson(`${TASKS}/${id}/files/${fileId}`, json('DELETE'));
export const listDocumentTasks = (
  documentId: string,
): Promise<Array<{ id: string; title: string; status: string; due_date: string | null; assigner_name: string }>> =>
  requestJson(`/api/v1/incoming-documents/${documentId}/tasks`);

// ---- Lịch đơn vị, phòng họp ----

export interface MeetingRoom {
  id: string;
  name: string;
  location: string | null;
  capacity: number | null;
  equipment: string | null;
  sort_order: number;
  active: boolean;
}

export interface RoomBooking {
  id: string;
  room_id: string;
  room_name: string;
  title: string;
  chair_name: string | null;
  participants: string | null;
  starts_at: string;
  ends_at: string;
  note: string | null;
  status: RoomBookingStatusKey;
  requested_by_name: string;
  decided_by_name: string | null;
  decision_note: string | null;
  can_decide: boolean;
  can_cancel: boolean;
}

export interface ScheduleEntry {
  id: string;
  org_unit_id: string | null;
  org_unit_name: string;
  entry_date: string;
  session: ScheduleSessionKey;
  start_time: string | null;
  end_time: string | null;
  content: string;
  chair_name: string | null;
  participants: string | null;
  location: string | null;
  note: string | null;
  status: 'draft' | 'published';
  room_id: string | null;
  room_name: string | null;
  room_status: RoomBookingStatusKey | null;
  attendees: Array<{ user_id: string; user_name: string }>;
  can_edit: boolean;
}

export interface ScheduleTemplateItem {
  weekday: number;
  session: ScheduleSessionKey;
  start_time: string | null;
  end_time: string | null;
  content: string;
  chair_name: string | null;
  participants: string | null;
  location: string | null;
  note: string | null;
}

export interface ScheduleTemplate {
  id: string;
  name: string;
  org_unit_id: string | null;
  items: ScheduleTemplateItem[];
}

export interface ScheduleQuery {
  from: string;
  to: string;
  org_unit_id?: string;
  view?: 'mine' | '';
  location?: string;
  participant?: string;
}

export const listRooms = (activeOnly = false): Promise<MeetingRoom[]> =>
  requestJson(`/api/v1/meeting-rooms${query({ active: activeOnly })}`);
export const saveRoom = (id: string | null, room: Record<string, unknown>): Promise<MeetingRoom> =>
  requestJson(id ? `/api/v1/meeting-rooms/${id}` : '/api/v1/meeting-rooms', json(id ? 'PUT' : 'POST', room));
export const deleteRoom = (id: string): Promise<void> => requestJson(`/api/v1/meeting-rooms/${id}`, json('DELETE'));
export const listBookings = (filter: {
  from?: string;
  to?: string;
  room_id?: string;
  status?: RoomBookingStatusKey | '';
  mine?: boolean;
}): Promise<RoomBooking[]> => requestJson(`/api/v1/room-bookings${query(filter)}`);
export const createBooking = (input: Record<string, unknown>): Promise<RoomBooking> =>
  requestJson('/api/v1/room-bookings', json('POST', input));
export const decideBooking = (id: string, approve: boolean, note: string | null): Promise<RoomBooking> =>
  requestJson(`/api/v1/room-bookings/${id}/${approve ? 'approve' : 'reject'}`, json('POST', { note }));
export const cancelBooking = (id: string): Promise<RoomBooking> =>
  requestJson(`/api/v1/room-bookings/${id}/cancel`, json('POST', {}));
export const listEntries = (filter: ScheduleQuery): Promise<ScheduleEntry[]> =>
  requestJson(`/api/v1/unit-schedules${query({ ...filter })}`);
export const saveEntry = (id: string | null, entry: Record<string, unknown>): Promise<ScheduleEntry> =>
  requestJson(id ? `/api/v1/unit-schedules/${id}` : '/api/v1/unit-schedules', json(id ? 'PUT' : 'POST', entry));
export const deleteEntry = (id: string): Promise<void> => requestJson(`/api/v1/unit-schedules/${id}`, json('DELETE'));
export const publishEntries = (input: {
  from: string;
  to: string;
  org_unit_id: string | null;
}): Promise<{ published: number }> => requestJson('/api/v1/unit-schedules/publish', json('POST', input));
export const exportEntries = (filter: ScheduleQuery, format: 'xlsx' | 'pdf') =>
  download(`/api/v1/unit-schedules/export${query({ ...filter, format })}`, `lich-hop.${format}`);
export const listTemplates = (): Promise<ScheduleTemplate[]> => requestJson('/api/v1/unit-schedule-templates');
export const saveTemplate = (id: string | null, template: Record<string, unknown>): Promise<ScheduleTemplate> =>
  requestJson(
    id ? `/api/v1/unit-schedule-templates/${id}` : '/api/v1/unit-schedule-templates',
    json(id ? 'PUT' : 'POST', template),
  );
export const deleteTemplate = (id: string): Promise<void> =>
  requestJson(`/api/v1/unit-schedule-templates/${id}`, json('DELETE'));
export const applyTemplate = (
  id: string,
  weekOf: string,
  orgUnitId: string | null,
): Promise<{ created: number; week_start: string }> =>
  requestJson(`/api/v1/unit-schedule-templates/${id}/apply`, json('POST', { week_of: weekOf, org_unit_id: orgUnitId }));

// ---- Hồ sơ công việc ----

export type WorkFileBox = 'personal' | 'shared' | 'transferred' | 'archive' | 'expired';

export interface WorkFile {
  id: string;
  code: string;
  title: string;
  year: number;
  description: string | null;
  org_unit_id: string | null;
  owner_name: string;
  status: WorkFileStatusKey;
  retention: 'permanent' | 'limited';
  retention_years: number | null;
  opened_on: string;
  closed_on: string | null;
  transferred_from_name: string | null;
  transferred_at: string | null;
  transfer_note: string | null;
  return_note: string | null;
  archived_on: string | null;
  archive_record_code: string | null;
  expiry_year: number | null;
  item_count?: number;
  share_permission?: 'view' | 'edit';
}

export interface WorkFileDetail extends WorkFile {
  items: Array<{
    id: string;
    item_type: 'incoming_document' | 'task' | 'note';
    incoming_document_id: string | null;
    task_id: string | null;
    title: string;
    note: string | null;
    added_by_name: string;
    created_at: string;
  }>;
  shares: Array<{ user_id: string; user_name: string; permission: 'view' | 'edit' }>;
  events: Array<{ id: string; action: string; note: string | null; actor_name: string; created_at: string }>;
  is_owner: boolean;
  can_edit: boolean;
  can_edit_items: boolean;
  can_close: boolean;
  can_reopen: boolean;
  can_submit: boolean;
  can_accept: boolean;
}

const FILES = '/api/v1/work-files';

export const listWorkFiles = (box: WorkFileBox, filter: { year?: string; q?: string }): Promise<WorkFile[]> =>
  requestJson(`${FILES}${query({ box, ...filter })}`);
export const readWorkFile = (id: string): Promise<WorkFileDetail> => requestJson(`${FILES}/${id}`);
export const saveWorkFile = (id: string | null, input: Record<string, unknown>): Promise<WorkFileDetail> =>
  requestJson(id ? `${FILES}/${id}` : FILES, json(id ? 'PUT' : 'POST', input));
export const deleteWorkFile = (id: string): Promise<void> => requestJson(`${FILES}/${id}`, json('DELETE'));
export const addWorkFileItem = (id: string, item: Record<string, unknown>): Promise<WorkFileDetail> =>
  requestJson(`${FILES}/${id}/items`, json('POST', item));
export const removeWorkFileItem = (id: string, itemId: string): Promise<WorkFileDetail> =>
  requestJson(`${FILES}/${id}/items/${itemId}`, json('DELETE'));
export const shareWorkFile = (
  id: string,
  shares: Array<{ user_id: string; permission: 'view' | 'edit' }>,
): Promise<WorkFileDetail> => requestJson(`${FILES}/${id}/shares`, json('PUT', { shares }));
export const transferWorkFile = (id: string, userId: string, note: string | null): Promise<unknown> =>
  requestJson(`${FILES}/${id}/transfer`, json('POST', { user_id: userId, note }));
export const workFileAction = (
  id: string,
  action: 'close' | 'reopen' | 'submit' | 'accept' | 'return',
  body: Record<string, unknown> = {},
): Promise<WorkFileDetail> => requestJson(`${FILES}/${id}/${action}`, json('POST', body));

// ---- Báo cáo ----

export type ReportKind = 'incoming' | 'summary' | 'statistics';
export interface ReportFilter {
  from: string;
  to: string;
  org_unit_id?: string;
}

export const readReport = <Result>(kind: ReportKind, filter: ReportFilter): Promise<Result> =>
  requestJson(`/api/v1/document-reports/${kind}${query({ ...filter })}`);
export const exportReport = (kind: ReportKind, filter: ReportFilter, format: 'xlsx' | 'pdf') =>
  download(`/api/v1/document-reports/export${query({ kind, format, ...filter })}`, `bao-cao.${format}`);
