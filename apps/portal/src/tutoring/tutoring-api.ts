import type {
  SchoolLevelCode,
  TutoringAttendanceStatus,
  TutoringAudience,
  TutoringCancelRefund,
  TutoringContentType,
  TutoringCreditStatus,
  TutoringDelivery,
  TutoringFeeBasis,
  TutoringFundingSource,
  TutoringProgramStatus,
  TutoringRegistrationStatus,
  TutoringRuleSet,
} from '@school-management/shared';
import { downloadFile } from '../growth/growth-api.js';
import { fetchWithSession, readError, requestJson } from '../session/api-client.js';

// Gia sư trong trường, phía nhà trường (DT-27 phần 27b, YCTD-252)
export interface TutoringMeta {
  can_manage: boolean;
  rules: TutoringRuleSet;
  subjects: Array<{ id: string; code: string; name: string; school_level: SchoolLevelCode }>;
  classes: Array<{ id: string; name: string; grade_level: string; school_level: SchoolLevelCode }>;
  teachers: Array<{ user_id: string; name: string }>;
}

export interface ProgramSummary {
  id: string;
  name: string;
  school_level: SchoolLevelCode;
  content_type: TutoringContentType;
  audience: TutoringAudience | null;
  charges_fee: boolean;
  fee_basis: TutoringFeeBasis | null;
  fee_amount: string | null;
  delivery: TutoringDelivery;
  status: TutoringProgramStatus;
  starts_on: string;
  ends_on: string;
  created_by_name: string;
  subject_name: string | null;
}

export interface ProgramSession {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  periods: number;
  location: string | null;
  status: 'scheduled' | 'cancelled';
  cancel_reason: string | null;
}

export interface ProgramRegistration {
  id: string;
  child_id: string;
  child_name: string;
  guardian_name: string;
  status: TutoringRegistrationStatus;
  submitted_at: string;
  decided_by_name: string | null;
  reject_reason: string | null;
  note: string | null;
}

export interface ProgramDetail extends ProgramSummary {
  // Thu phí và thù lao (YCTD-253); số tiền là chuỗi số đồng
  cancel_refund: TutoringCancelRefund;
  pay_rate_per_period: string | null;
  funding_source: TutoringFundingSource;
  recording_enabled: boolean;
  description: string | null;
  topic: string | null;
  registration_form: string;
  max_students: number | null;
  reject_reason: string | null;
  decided_by_name: string | null;
  teachers: Array<{ teacher_user_id: string; teacher_name: string }>;
  classes: Array<{ id: string; name: string }>;
  candidates: Array<{ id: string; full_name: string; source: 'suggested' | 'manual' }>;
  sessions: ProgramSession[];
  registrations: ProgramRegistration[];
  can_manage: boolean;
  can_teach: boolean;
}

export interface SessionRow extends ProgramSession {
  program_id: string;
  program_name: string;
  content_type: TutoringContentType;
  attendance_confirmed_at: string | null;
}

export interface AttendanceView {
  // Người dạy buổi để tính thù lao (YCTD-253)
  teachers: Array<{ teacher_user_id: string; teacher_name: string }>;
  taught_by_user_id: string | null;
  session: {
    id: string;
    program_name: string;
    session_date: string;
    start_time: string;
    end_time: string;
    status: string;
  };
  students: Array<{
    child_id: string;
    full_name: string;
    status: TutoringAttendanceStatus | null;
    source: 'room_log' | 'teacher' | null;
    joined_at: string | null;
    left_at: string | null;
    confirmed_at: string | null;
    note: string | null;
  }>;
}

export interface ExemptionRow {
  id: string;
  decision_no: string;
  decision_date: string;
  max_periods_per_week: number;
  file_name: string | null;
  note: string | null;
  subject_name: string;
  created_by_name: string;
  children: Array<{ id: string; full_name: string }>;
}

export interface RulesView {
  current: TutoringRuleSet;
  rules: Array<{
    id: string;
    effective_from: string;
    max_curriculum_periods_per_week: number;
    curriculum_blocked_levels: SchoolLevelCode[];
    legal_basis: string;
    created_by_name: string | null;
  }>;
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
});

export const tutoringApi = {
  meta: () => requestJson<TutoringMeta>('/api/v1/tutoring/meta'),
  programs: () => requestJson<ProgramSummary[]>('/api/v1/tutoring/programs'),
  program: (id: string) => requestJson<ProgramDetail>(`/api/v1/tutoring/programs/${id}`),
  createProgram: (body: unknown) => requestJson<{ id: string }>('/api/v1/tutoring/programs', json('POST', body)),
  updateProgram: (id: string, body: unknown) =>
    requestJson<{ id: string }>(`/api/v1/tutoring/programs/${id}`, json('PUT', body)),
  transition: (id: string, action: 'submit' | 'approve' | 'reject' | 'close', reason?: string) =>
    requestJson<{ status: string }>(
      `/api/v1/tutoring/programs/${id}/${action}`,
      json('POST', reason ? { reason } : {}),
    ),
  suggestions: (id: string) =>
    requestJson<Array<{ id: string; full_name: string }>>(`/api/v1/tutoring/programs/${id}/candidate-suggestions`),
  setCandidates: (id: string, childIds: string[], suggestedIds: string[]) =>
    requestJson(
      `/api/v1/tutoring/programs/${id}/candidates`,
      json('PUT', { child_ids: childIds, suggested_ids: suggestedIds }),
    ),
  createSessions: (id: string, body: unknown) =>
    requestJson<{ count: number; periods: number }>(`/api/v1/tutoring/programs/${id}/sessions`, json('POST', body)),
  decide: (registrationId: string, approve: boolean, reason?: string) =>
    requestJson(
      `/api/v1/tutoring/registrations/${registrationId}/${approve ? 'approve' : 'reject'}`,
      json('POST', reason ? { reason } : {}),
    ),
  message: (id: string, childId: string, content: string) =>
    requestJson(`/api/v1/tutoring/programs/${id}/messages`, json('POST', { child_id: childId, content })),
  sessions: (from: string, to: string) => requestJson<SessionRow[]>(`/api/v1/tutoring/sessions?from=${from}&to=${to}`),
  cancelSession: (id: string, reason: string) =>
    requestJson(`/api/v1/tutoring/sessions/${id}/cancel`, json('POST', { reason })),
  attendance: (id: string) => requestJson<AttendanceView>(`/api/v1/tutoring/sessions/${id}/attendance`),
  confirmAttendance: (
    id: string,
    entries: Array<{ child_id: string; status: TutoringAttendanceStatus }>,
    taughtByUserId?: string,
  ) =>
    requestJson<{ confirmed: number; notified: number }>(
      `/api/v1/tutoring/sessions/${id}/attendance`,
      json('PUT', taughtByUserId ? { entries, taught_by_user_id: taughtByUserId } : { entries }),
    ),
  exemptions: () => requestJson<ExemptionRow[]>('/api/v1/tutoring/exemptions'),
  async createExemption(form: FormData): Promise<{ id: string }> {
    const response = await fetchWithSession('/api/v1/tutoring/exemptions', { method: 'POST', body: form });
    if (!response.ok) {
      throw await readError(response);
    }
    return (await response.json()) as { id: string };
  },
  rules: () => requestJson<RulesView>('/api/v1/tutoring/rules'),
  addRule: (body: unknown) => requestJson('/api/v1/tutoring/rules', json('POST', body)),
  // Thu chi gia sư (DT-27 phần 27c, YCTD-253)
  financeReport: (from: string, to: string) =>
    requestJson<FinanceReport>(`/api/v1/tutoring/finance/report?from=${from}&to=${to}`),
  exportFinance: (from: string, to: string) =>
    downloadFile(`/api/v1/tutoring/finance/report/export?from=${from}&to=${to}`, `thu-chi-gia-su-${from}-${to}.xlsx`),
  teacherPay: (month: string) => requestJson<TeacherPayPreview>(`/api/v1/tutoring/finance/teacher-pay?month=${month}`),
  pushTeacherPay: (month: string) =>
    requestJson<{ pushed: Array<{ teacher_name: string; sessions: number; amount: number }>; skipped: PendingPay[] }>(
      '/api/v1/tutoring/finance/teacher-pay/push',
      json('POST', { month }),
    ),
  credits: () => requestJson<CreditRow[]>('/api/v1/tutoring/finance/credits'),
  creditAction: (id: string, action: 'adjust' | 'deduct-next' | 'close', note?: string) =>
    requestJson(`/api/v1/tutoring/finance/credits/${id}/${action}`, json('POST', note ? { note } : {})),
};

export interface PendingPay {
  session_id: string;
  session_date: string;
  program_name: string;
  teacher_name: string | null;
  periods: number;
  rate: number | null;
  amount: number | null;
  funding_source: TutoringFundingSource;
  problem: string | null;
}

export interface TeacherPayPreview {
  month: string;
  payroll_status: string | null;
  rows: PendingPay[];
  total: number;
}

export interface CreditRow {
  id: string;
  amount: number;
  reason: string;
  mode: TutoringCancelRefund;
  status: TutoringCreditStatus;
  program_name: string;
  child_name: string;
  invoice_code: string | null;
  adjustment_code: string | null;
  adjustment_rejected: boolean;
  deducted: number;
  remaining: number;
  deducted_on: string[];
  closed_note: string | null;
  actionable: boolean;
}

export interface FinanceProgramRow {
  program_id: string;
  name: string;
  content_type: TutoringContentType;
  charges_fee: boolean;
  fee_basis: TutoringFeeBasis | null;
  fee_amount: number | null;
  funding_source: TutoringFundingSource;
  billed: number;
  billed_draft: number;
  deducted: number;
  adjusted: number;
  refunded: number;
  credit_open: number;
  net_income: number;
  teacher_pay: number;
  teacher_periods: number;
  teacher_pay_pending: number;
}

export interface FinanceReport {
  from: string;
  to: string;
  programs: FinanceProgramRow[];
  totals: {
    billed: number;
    deducted: number;
    adjusted: number;
    refunded: number;
    net_income: number;
    teacher_pay: number;
    teacher_pay_school_budget: number;
    teacher_pay_tutoring_fees: number;
  };
  credits: CreditRow[];
}
