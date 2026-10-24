import type {
  GraduationConfig,
  GraduationLevel,
  GraduationMinutesKind,
  GraduationSubmissionKind,
} from '@school-management/shared';
import { ApiError, fetchWithSession, readError, requestJson } from '../session/api-client.js';

// Gọi các điểm cuối xét tốt nghiệp THCS, THPT và hồ sơ thi (DT-21 phần 21f, YCTD-174)
export interface GraduationSession {
  id: string;
  school_level: GraduationLevel;
  name: string;
  academic_year_name: string;
  exam_date: string | null;
  status: 'open' | 'finalized';
}

export interface GraduationDecision {
  outcome: 'graduated' | 'not_graduated';
  status: 'proposed' | 'confirmed';
  exam_average: string | null;
  score: string | null;
  note: string | null;
  certificate_no: string | null;
}

export interface GraduationCandidate {
  id: string;
  child_id: string;
  full_name: string;
  class_name: string;
  exam_number: string | null;
  eligible: boolean;
  eligibility_note: string | null;
  priority_points: number;
  incentive_points: number;
  grades: { g10: number | null; g11: number | null; g12: number | null };
  school_average: number | null;
  exam_subjects: string[];
  exempt_subjects: string[];
  room_id: string | null;
  scores: Array<{ subject_code: string; score: number }>;
  decision: GraduationDecision | null;
}

export interface GraduationView {
  session: GraduationSession;
  config: GraduationConfig;
  subjects: Array<{ code: string; name: string }>;
  candidates: GraduationCandidate[];
  rooms: Array<{ id: string; code: string; name: string; capacity: number; proctors: string | null }>;
  minutes: Array<{
    id: string;
    kind: GraduationMinutesKind;
    title: string;
    created_by_name: string;
    created_at: string;
  }>;
  submissions: Array<{
    id: string;
    kind: GraduationSubmissionKind;
    file_name: string;
    exported_by_name: string;
    exported_at: string;
    status: 'exported' | 'sent';
    sent_by_name: string | null;
    note: string | null;
  }>;
  dossiers: Array<{ id: string; full_name: string; destination: string | null; status: 'prepared' | 'sent' }>;
}

const json = (method: string, body: unknown) => ({ method, body: JSON.stringify(body) });

export const messageOf = (error: unknown): string =>
  error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';

export const readGraduationConfig = (level: GraduationLevel): Promise<{ config: GraduationConfig }> =>
  requestJson(`/api/v1/graduation/config?school_level=${level}`);
export const saveGraduationConfig = (level: GraduationLevel, config: GraduationConfig) =>
  requestJson('/api/v1/graduation/config', json('PUT', { school_level: level, config }));
export const listGraduationSessions = (level: GraduationLevel): Promise<GraduationSession[]> =>
  requestJson(`/api/v1/graduation/sessions?school_level=${level}`);
export const createGraduationSession = (level: GraduationLevel, name: string, examDate: string | null) =>
  requestJson<GraduationSession>(
    '/api/v1/graduation/sessions',
    json('POST', { school_level: level, name, exam_date: examDate }),
  );
export const readGraduationView = (sessionId: string): Promise<GraduationView> =>
  requestJson(`/api/v1/graduation/sessions/${sessionId}`);
export const generateCandidates = (sessionId: string) =>
  requestJson<{ created: number; updated: number }>(`/api/v1/graduation/sessions/${sessionId}/candidates/generate`, {
    method: 'POST',
  });
export const updateCandidate = (
  candidateId: string,
  patch: {
    priority_points?: number;
    incentive_points?: number;
    exam_subjects?: string[];
    exempt_subjects?: string[];
    grades?: { g10?: number | null; g11?: number | null; g12?: number | null };
  },
) => requestJson(`/api/v1/graduation/candidates/${candidateId}`, json('PATCH', patch));
export const saveCandidateScores = (
  candidateId: string,
  scores: Array<{ subject_code: string; score: number | null }>,
) => requestJson(`/api/v1/graduation/candidates/${candidateId}/scores`, json('PUT', { scores }));
export const assignExamNumbers = (sessionId: string) =>
  requestJson<{ assigned: number }>(`/api/v1/graduation/sessions/${sessionId}/exam-numbers`, { method: 'POST' });
export const addRoom = (
  sessionId: string,
  input: { code: string; name: string; capacity: number; proctors: string | null },
) => requestJson(`/api/v1/graduation/sessions/${sessionId}/rooms`, json('POST', input));
export const assignRooms = (sessionId: string) =>
  requestJson<{ assigned: number }>(`/api/v1/graduation/sessions/${sessionId}/rooms/assign`, { method: 'POST' });
export const evaluateSession = (sessionId: string) =>
  requestJson<{ proposed: number; incomplete: number }>(`/api/v1/graduation/sessions/${sessionId}/evaluate`, {
    method: 'POST',
  });
export const confirmSession = (sessionId: string) =>
  requestJson<{ graduated: number; total: number }>(`/api/v1/graduation/sessions/${sessionId}/confirm`, {
    method: 'POST',
  });
export const addMinutes = (sessionId: string, input: { kind: GraduationMinutesKind; title: string; content: string }) =>
  requestJson(`/api/v1/graduation/sessions/${sessionId}/minutes`, json('POST', input));
export const markSubmissionSent = (submissionId: string, note: string | null) =>
  requestJson(`/api/v1/graduation/submissions/${submissionId}/mark-sent`, json('POST', { note }));
export const prepareDossiers = (sessionId: string, destination: string | null) =>
  requestJson<{ created: number; skipped: Array<{ full_name: string; reason: string }> }>(
    `/api/v1/graduation/sessions/${sessionId}/transfer-dossiers`,
    json('POST', { destination }),
  );
export const markDossierSent = (dossierId: string) =>
  requestJson(`/api/v1/graduation/transfer-dossiers/${dossierId}/mark-sent`, { method: 'POST' });

// Tải tệp (PDF, xlsx) bằng phiên đăng nhập
export async function downloadFile(path: string, fileName: string): Promise<void> {
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
