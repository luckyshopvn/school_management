import { ApiError, fetchWithSession, readError, requestJson } from '../session/api-client.js';

// Gọi các điểm cuối học bạ số, khen thưởng học sinh, hoàn thành chương trình (DT-20 phần 20e, YCTD-163)
export type CompletionOutcome = 'promoted' | 'level_completed' | 'pending_support' | 'retained';
export type SupportPlan = 'summer_training' | 'retest';

export interface ClassAccess {
  approve: boolean;
  homeroom: boolean;
  view: boolean;
}

export interface AwardTitle {
  id: string;
  code: string;
  name: string;
  kind: 'year_end' | 'special';
  basis: 'excellent' | 'outstanding' | null;
  status?: 'active' | 'inactive';
}

export interface ClassAwards {
  access: ClassAccess;
  titles: AwardTitle[];
  rows: Array<{
    child_id: string;
    full_name: string;
    year_result: string | null;
    suggested_title_ids: string[];
    awards: Array<{
      id: string;
      title_name: string;
      achievement: string | null;
      status: 'proposed' | 'approved' | 'rejected';
      lookup_code: string | null;
      decision_note: string | null;
    }>;
  }>;
}

export interface ClassCompletion {
  access: ClassAccess;
  year_end_locked: boolean;
  last_grade: boolean;
  next_grade_level: string | null;
  rows: Array<{
    child_id: string;
    full_name: string;
    year_result: string | null;
    suggested_outcome: CompletionOutcome | null;
    result: {
      outcome: CompletionOutcome;
      support_plan: SupportPlan | null;
      support_result: 'completed' | 'not_completed' | null;
      support_note: string | null;
      next_grade_level: string | null;
      confirmed_by_name: string;
    } | null;
  }>;
}

export interface ClassRecords {
  access: ClassAccess;
  year_end_locked: boolean;
  rows: Array<{
    child_id: string;
    full_name: string;
    record: {
      id: string;
      status: 'draft' | 'signed';
      homeroom_comment: string | null;
      signed_at: string | null;
      signer_name: string | null;
    } | null;
  }>;
}

export const messageOf = (error: unknown) =>
  error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';

export const readTitles = () => requestJson<AwardTitle[]>('/api/v1/learning-records/award-titles?school_level=TH');
export const loadTitleDefaults = () =>
  requestJson<{ created: number }>('/api/v1/learning-records/award-titles/defaults', {
    method: 'POST',
    body: JSON.stringify({ school_level: 'TH' }),
  });
export const readClassAwards = (classId: string) =>
  requestJson<ClassAwards>(`/api/v1/learning-records/classes/${classId}/awards`);
export const proposeAward = (
  classId: string,
  input: { child_id: string; title_id: string; achievement: string | null },
) => requestJson(`/api/v1/learning-records/classes/${classId}/awards`, { method: 'POST', body: JSON.stringify(input) });
export const decideAward = (awardId: string, input: { approve: boolean; note: string | null }) =>
  requestJson(`/api/v1/learning-records/awards/${awardId}/decide`, { method: 'POST', body: JSON.stringify(input) });
export const readCompletion = (classId: string) =>
  requestJson<ClassCompletion>(`/api/v1/learning-records/classes/${classId}/completion`);
export const saveCompletion = (
  classId: string,
  entries: Array<{
    child_id: string;
    support_plan: SupportPlan | null;
    support_result: 'completed' | 'not_completed' | null;
    support_note: string | null;
  }>,
) =>
  requestJson<ClassCompletion>(`/api/v1/learning-records/classes/${classId}/completion`, {
    method: 'PUT',
    body: JSON.stringify({ entries }),
  });
export const readClassRecords = (classId: string) =>
  requestJson<ClassRecords>(`/api/v1/learning-records/classes/${classId}/learning-records`);
export const prepareRecords = (classId: string) =>
  requestJson<{ prepared: number; skipped_signed: number }>(
    `/api/v1/learning-records/classes/${classId}/learning-records/prepare`,
    { method: 'POST' },
  );
export const saveComment = (recordId: string, comment: string) =>
  requestJson(`/api/v1/learning-records/learning-records/${recordId}`, {
    method: 'PATCH',
    body: JSON.stringify({ homeroom_comment: comment || null }),
  });
export const signRecord = (recordId: string) =>
  requestJson(`/api/v1/learning-records/learning-records/${recordId}/sign`, { method: 'POST' });
export const reopenRecord = (recordId: string, reason: string) =>
  requestJson(`/api/v1/learning-records/learning-records/${recordId}/reopen`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });

// Tải tệp PDF (học bạ, giấy khen) bằng phiên đăng nhập
export async function downloadPdf(path: string, fileName: string): Promise<void> {
  const response = await fetchWithSession(path);
  if (!response.ok) {
    throw await readError(response);
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
