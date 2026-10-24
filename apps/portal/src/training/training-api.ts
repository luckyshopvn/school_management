import type {
  CompetencyTerm,
  StaffCertificateKind,
  TrainingCourseStatus,
  TrainingMode,
  TrainingOrganizerKind,
  TrainingRegistrationStatus,
  TrainingResult,
} from '@school-management/shared';
import { saveResponseFile } from '../exports/export-api.js';
import { fetchWithSession, readError, requestJson } from '../session/api-client.js';

// Hồ sơ bồi dưỡng giáo viên (DT-22 phần 22e, YCTD-182)
const API = '/api/v1';
const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

async function download(path: string, fallbackName: string): Promise<void> {
  const response = await fetchWithSession(path);
  if (!response.ok) {
    throw await readError(response);
  }
  saveResponseFile(await response.blob(), response.headers.get('content-disposition') ?? '', fallbackName);
}

export interface TrainingTopic {
  id: string;
  code: string;
  name: string;
  program_no: number;
  default_periods: number;
  competency_domain_code: string | null;
  status: 'active' | 'inactive';
}

export interface CompetencyDomain {
  id: string;
  code: string;
  name: string;
  description: string | null;
  order_no: number;
  status: 'active' | 'inactive';
}

export interface TrainingCatalog {
  settings: {
    annual_required_periods: number;
    competency_gap_level: number;
    certificate_issuer: string | null;
    legal_basis: string | null;
  };
  topics: TrainingTopic[];
  domains: CompetencyDomain[];
  levels: Array<{ level_no: number; name: string; description: string | null }>;
}

export interface TrainingCourse {
  id: string;
  name: string;
  topic_id: string | null;
  topic_name: string | null;
  program_no: number | null;
  organizer_kind: TrainingOrganizerKind;
  organizer_name: string | null;
  mode: TrainingMode;
  location: string | null;
  start_date: string;
  end_date: string;
  periods: number;
  sessions: number;
  quota: number | null;
  registration_deadline: string | null;
  issues_certificate: boolean;
  status: TrainingCourseStatus;
  note: string | null;
  registered: number;
  approved: number;
  my_registration: { id: string; status: TrainingRegistrationStatus; result: TrainingResult | null } | null;
}

export interface TrainingCourseInput {
  name: string;
  topic_id: string | null;
  organizer_kind: TrainingOrganizerKind;
  organizer_name: string | null;
  mode: TrainingMode;
  location: string | null;
  start_date: string;
  end_date: string;
  periods: number;
  sessions: number;
  quota: number | null;
  registration_deadline: string | null;
  issues_certificate: boolean;
}

export interface TrainingRegistration {
  id: string;
  staff_id: string;
  staff_name: string;
  department_name: string | null;
  status: TrainingRegistrationStatus;
  note: string | null;
  team_reviewed_by_name: string | null;
  reviewed_by_name: string | null;
  attended_sessions: number | null;
  result: TrainingResult | null;
  credited_periods: number | null;
  result_comment: string | null;
  can_team_review: boolean;
  certificate: { id: string; lookup_code: string | null; issued_date: string } | null;
}

export interface TrainingCourseDetail {
  course: TrainingCourse;
  can_manage: boolean;
  registrations: TrainingRegistration[];
}

export interface StaffCertificate {
  id: string;
  name: string;
  certificate_no: string | null;
  issued_by: string;
  issued_date: string;
  expire_date: string | null;
  kind: StaffCertificateKind;
  periods: number | null;
  lookup_code: string | null;
  revoked_at: string | null;
  expiring_soon: boolean;
}

export interface CompetencyGap {
  domain_code: string;
  domain_name: string;
  level: number;
  topics: TrainingTopic[];
}

export interface MyTraining {
  year_name: string;
  staff: { id: string; full_name: string };
  required_periods: number;
  total_periods: number;
  missing_periods: number;
  registrations: Array<
    TrainingRegistration & { course_name: string; start_date: string; end_date: string; course_periods: number }
  >;
  certificates: StaffCertificate[];
  competency_gaps: CompetencyGap[];
}

export interface TrainingRecords {
  year_name: string;
  required_periods: number;
  rows: Array<{
    staff_id: string;
    full_name: string;
    department_name: string | null;
    courses: number;
    course_periods: number;
    manual_periods: number;
    total_periods: number;
    missing_periods: number;
    certificates: number;
    expiring_certificates: number;
  }>;
  departments: Array<{
    department_id: string | null;
    department_name: string | null;
    staff: number;
    completed: number;
  }>;
  plan: { courses: number; completed: number };
}

export interface CompetencyScore {
  domain_code: string;
  domain_name: string;
  self_level: number;
  confirmed_level: number | null;
  reason: string | null;
}

export interface MyCompetency {
  term: CompetencyTerm;
  domains: CompetencyDomain[];
  levels: TrainingCatalog['levels'];
  assessment: {
    id: string;
    status: 'submitted' | 'confirmed';
    confirmed_by_name: string | null;
    scores: CompetencyScore[];
  } | null;
  gaps: CompetencyGap[];
}

export interface CompetencyTable {
  term: CompetencyTerm;
  domains: CompetencyDomain[];
  levels: TrainingCatalog['levels'];
  gap_level: number;
  rows: Array<{
    id: string;
    staff_name: string;
    department_name: string | null;
    status: 'submitted' | 'confirmed';
    scores: CompetencyScore[];
  }>;
  averages: Array<{ domain_code: string; average: number | null }>;
}

export interface CertificateVerification {
  code: string;
  staff_name: string;
  certificate_name: string;
  course_name: string | null;
  issued_by: string;
  issued_date: string;
  periods: number | null;
  status: 'valid' | 'revoked';
}

export const readTrainingCatalog = (): Promise<TrainingCatalog> => requestJson(`${API}/training/catalog`);
export const saveTrainingSettings = (input: Partial<TrainingCatalog['settings']>) =>
  requestJson(`${API}/training/settings`, json('PUT', input));
export const saveTrainingTopic = (id: string | null, input: Partial<TrainingTopic>) =>
  requestJson(id ? `${API}/training/topics/${id}` : `${API}/training/topics`, json(id ? 'PATCH' : 'POST', input));
export const saveCompetencyDomain = (id: string | null, input: Partial<CompetencyDomain>) =>
  requestJson(
    id ? `${API}/training/competency-domains/${id}` : `${API}/training/competency-domains`,
    json(id ? 'PATCH' : 'POST', input),
  );

export const listTrainingCourses = (): Promise<TrainingCourse[]> => requestJson(`${API}/training/courses`);
export const createTrainingCourse = (input: TrainingCourseInput): Promise<TrainingCourse> =>
  requestJson(`${API}/training/courses`, json('POST', input));
export const setTrainingCourseStatus = (id: string, status: TrainingCourseStatus) =>
  requestJson(`${API}/training/courses/${id}`, json('PATCH', { status }));
export const readTrainingCourse = (id: string): Promise<TrainingCourseDetail> =>
  requestJson(`${API}/training/courses/${id}`);
export const registerTrainingCourse = (id: string, note: string | null) =>
  requestJson(`${API}/training/courses/${id}/registrations`, json('POST', { note }));
export const cancelTrainingRegistration = (id: string) =>
  requestJson(`${API}/training/registrations/${id}/cancel`, json('POST'));
export const reviewTrainingRegistration = (id: string, decision: 'approve' | 'reject', note: string | null) =>
  requestJson(`${API}/training/registrations/${id}/review`, json('POST', { decision, note }));
export const saveTrainingResults = (
  id: string,
  results: Array<{
    registration_id: string;
    attended_sessions: number | null;
    result: TrainingResult | null;
    comment: string | null;
  }>,
) => requestJson(`${API}/training/courses/${id}/results`, json('PUT', { results }));
export const issueTrainingCertificates = (id: string): Promise<{ issued: number }> =>
  requestJson(`${API}/training/courses/${id}/certificates`, json('POST'));
export const downloadCourseCertificates = (id: string) =>
  download(`${API}/training/courses/${id}/certificates.pdf`, 'chung-nhan.pdf');
export const downloadTrainingCertificate = (id: string) =>
  download(`${API}/training/certificates/${id}/pdf`, 'chung-nhan.pdf');
export const revokeTrainingCertificate = (id: string, reason: string) =>
  requestJson(`${API}/training/certificates/${id}/revoke`, json('POST', { reason }));
export const reissueTrainingCertificate = (id: string) =>
  requestJson(`${API}/training/certificates/${id}/reissue`, json('POST'));
export const addStaffCertificate = (input: {
  name: string;
  issued_by: string;
  issued_date: string;
  expire_date: string | null;
  periods: number | null;
  certificate_no: string | null;
}) => requestJson(`${API}/training/certificates`, json('POST', input));
export const deleteStaffCertificate = (id: string) => requestJson(`${API}/training/certificates/${id}`, json('DELETE'));

export const readMyTraining = (): Promise<MyTraining> => requestJson(`${API}/training/mine`);
export const readTrainingRecords = (): Promise<TrainingRecords> => requestJson(`${API}/training/records`);
export const readMyCompetency = (term: CompetencyTerm): Promise<MyCompetency> =>
  requestJson(`${API}/training/competency/mine?term=${term}`);
export const submitMyCompetency = (term: CompetencyTerm, scores: Array<{ domain_code: string; level: number }>) =>
  requestJson(`${API}/training/competency/mine`, json('PUT', { term, scores }));
export const readCompetencyTable = (term: CompetencyTerm): Promise<CompetencyTable> =>
  requestJson(`${API}/training/competency?term=${term}`);
export const confirmCompetency = (
  id: string,
  scores: Array<{ domain_code: string; level: number; reason: string | null }>,
) => requestJson(`${API}/training/competency/${id}/confirm`, json('POST', { scores }));

// Tra cứu chứng nhận (trang công khai, không cần đăng nhập)
export async function verifyTrainingCertificate(code: string): Promise<CertificateVerification> {
  const response = await fetch(`${API}/public/training-certificates/verify?code=${encodeURIComponent(code)}`);
  if (!response.ok) {
    throw await readError(response);
  }
  return (await response.json()) as CertificateVerification;
}
