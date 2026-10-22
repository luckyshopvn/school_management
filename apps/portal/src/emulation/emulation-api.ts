import type {
  EmulationAppealKindCode,
  EmulationCampaignStatusCode,
  EmulationCheck,
  EmulationCriterion,
  EmulationDecisionLevelCode,
  EmulationNominationStatusCode,
  EmulationPositionCode,
  EmulationTargetCode,
  EmulationTitleKindCode,
  EmulationVoteCode,
} from '@school-management/shared';
import { saveResponseFile } from '../exports/export-api.js';
import { fetchWithSession, readError, requestJson } from '../session/api-client.js';

// Thi đua, khen thưởng (DT-18 phần 22d, YCTD-148)
const API = '/api/v1';
const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

function query(values: Record<string, string | boolean | undefined | null>): string {
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

export interface EmulationOverview {
  year_name: string;
  has_staff: boolean;
  my_staff: { id: string; full_name: string } | null;
  my_department: { id: string; name: string } | null;
  is_leader: boolean;
  can_use: boolean;
  can_manage: boolean;
  can_decide: boolean;
  can_draft_outgoing: boolean;
  staff: Array<{
    id: string;
    code: string;
    full_name: string;
    user_id: string | null;
    department_id: string | null;
    department_name: string | null;
  }>;
  departments: Array<{ id: string; name: string }>;
  kpi_periods: Array<{ id: string; code: string; name: string; period_type: string; status: string }>;
}

export interface EmulationTitle {
  id: string;
  code: string;
  name: string;
  description: string | null;
  kind: EmulationTitleKindCode;
  target: EmulationTargetCode;
  decision_level: EmulationDecisionLevelCode;
  school_level: string | null;
  min_kpi_rank: string | null;
  requires_initiative: boolean;
  prerequisite_code: string | null;
  consecutive_years: number;
  quota_percent: string | null;
  quota_base_code: string | null;
  vote_threshold_percent: string;
  min_score: string | null;
  criteria: EmulationCriterion[];
  revision: number;
  sort_order: number;
  status: 'active' | 'inactive';
  nomination_count: number;
}

export interface TitleInput {
  code: string;
  name: string;
  description: string | null;
  kind: EmulationTitleKindCode;
  target: EmulationTargetCode;
  decision_level: EmulationDecisionLevelCode;
  min_kpi_rank: string | null;
  requires_initiative: boolean;
  prerequisite_code: string | null;
  consecutive_years: number;
  quota_percent: number | null;
  quota_base_code: string | null;
  vote_threshold_percent: number;
  min_score: number | null;
  criteria: EmulationCriterion[];
  sort_order: number;
  status: 'active' | 'inactive';
}

export interface EmulationCampaign {
  id: string;
  code: string;
  name: string;
  kind: 'regular' | 'thematic';
  description: string | null;
  title_ids: string[];
  titles: Array<{ id: string; code: string; name: string; target: EmulationTargetCode }>;
  kpi_period_id: string | null;
  kpi_period_name: string | null;
  registration_deadline: string | null;
  nomination_deadline: string | null;
  appeal_days: number;
  status: EmulationCampaignStatusCode;
  launched_at: string | null;
  published_at: string | null;
  appeal_deadline: string | null;
  registration_count: number;
  nomination_count: number;
}

export interface CampaignInput {
  code: string;
  name: string;
  kind: 'regular' | 'thematic';
  description: string | null;
  title_ids: string[];
  kpi_period_id: string | null;
  registration_deadline: string | null;
  nomination_deadline: string | null;
  appeal_days: number;
}

export interface EmulationRegistration {
  id: string;
  campaign_id: string;
  campaign_name: string;
  title_id: string;
  title_name: string;
  target: EmulationTargetCode;
  subject_name: string;
  commitment: string | null;
  status: 'pending' | 'accepted' | 'returned';
  review_note: string | null;
  registered_by_name: string;
  created_at: string;
}

export interface SubjectInput {
  campaign_id: string;
  title_id: string;
  target: EmulationTargetCode;
  staff_id?: string | null;
  department_id?: string | null;
}

export interface EmulationNomination {
  id: string;
  campaign_id: string;
  campaign_name: string;
  title_id: string;
  title_code: string;
  title_name: string;
  target: EmulationTargetCode;
  subject_name: string;
  owner_name: string;
  total_score: string;
  kpi_rank_label: string | null;
  status: EmulationNominationStatusCode;
  status_label: string;
  agree_percent: string | null;
  return_note: string | null;
  submitted_at: string | null;
  failed_checks: number;
}

export interface EmulationNominationDetail extends Omit<EmulationNomination, 'failed_checks'> {
  staff_id: string | null;
  department_id: string | null;
  department_name: string | null;
  achievements: string | null;
  initiative: string | null;
  criteria: EmulationCriterion[];
  scores: Record<string, number>;
  eligibility: EmulationCheck[];
  kpi_period_name: string | null;
  kpi_rank: string | null;
  kpi_score: string | null;
  kpi_live: { period_name: string; rank: string | null; rank_label: string | null; score: string } | null;
  vote_threshold_percent: string;
  agree_count: number | null;
  disagree_count: number | null;
  abstain_count: number | null;
  council_note: string | null;
  campaign_status: EmulationCampaignStatusCode;
  appeal_deadline: string | null;
  evidence: Array<{ id: string; document_id: string; note: string | null; title: string; owner_name: string }>;
  appeals: Array<{
    id: string;
    kind: EmulationAppealKindCode;
    content: string;
    status: string;
    response: string | null;
  }>;
  can_edit: boolean;
  can_manage: boolean;
}

export interface EvidenceOption {
  id: string;
  title: string;
  status: string;
  owner_name: string;
  folder_name: string;
}

export interface CouncilMember {
  id: string;
  user_id: string;
  name: string;
  position: EmulationPositionCode;
}

export interface EmulationMeeting {
  id: string;
  campaign_id: string;
  held_at: string;
  location: string | null;
  content: string | null;
  conclusion: string | null;
  member_count: number;
  attendee_count: number | null;
  status: 'voting' | 'closed';
  minutes_file_id: string | null;
  nomination_count?: number;
  voted_members: number;
}

export interface Council {
  campaign: EmulationCampaign;
  members: CouncilMember[];
  meetings: EmulationMeeting[];
  waiting_count: number;
}

export interface MeetingDetail extends EmulationMeeting {
  is_member: boolean;
  nominations: Array<{
    id: string;
    title_name: string;
    target: EmulationTargetCode;
    subject_name: string;
    total_score: string;
    kpi_rank_label: string | null;
    vote_threshold_percent: string;
    status: EmulationNominationStatusCode;
    agree_count: number | null;
    disagree_count: number | null;
    abstain_count: number | null;
    agree_percent: string | null;
    my_choice: EmulationVoteCode | null;
    failed_checks: number;
  }>;
}

export interface EmulationAppeal {
  id: string;
  campaign_id: string;
  campaign_name: string;
  nomination_id: string | null;
  subject_name: string | null;
  title_name: string | null;
  kind: EmulationAppealKindCode;
  content: string;
  submitted_by_name: string;
  deadline: string;
  status: 'pending' | 'accepted' | 'rejected';
  response: string | null;
  resolved_by_name: string | null;
  created_at: string;
}

export interface EmulationDecision {
  id: string;
  campaign_id: string;
  campaign_name: string;
  kind: 'decision' | 'proposal';
  title: string;
  basis: string | null;
  signer_name: string | null;
  signer_title: string | null;
  status: 'draft' | 'issued';
  number: string | null;
  issue_date: string | null;
  outgoing_document_id: string | null;
  upper_number: string | null;
  upper_date: string | null;
  upper_issuer: string | null;
  nomination_count: number;
}

export interface DecisionDetail extends EmulationDecision {
  lines: Array<{
    id: string;
    subject_name: string;
    title_name: string;
    target: EmulationTargetCode;
    status: EmulationNominationStatusCode;
    status_label: string;
    department: string | null;
    award: { id: string; lookup_code: string } | null;
  }>;
  outgoing: { id: string; status: string; symbol: string | null; issue_date: string | null; summary: string } | null;
  can_decide: boolean;
}

export interface DecisionInput {
  campaign_id: string;
  kind: 'decision' | 'proposal';
  title: string;
  basis: string | null;
  signer_name: string | null;
  signer_title: string | null;
  nomination_ids: string[];
}

export interface AwardRow {
  id: string;
  source: 'decision' | 'manual';
  year_name: string;
  year_start: number;
  title_code: string;
  title_name: string;
  target: EmulationTargetCode;
  staff_id: string | null;
  subject_name: string;
  staff_code: string | null;
  staff_department: string | null;
  department_name: string | null;
  decision_number: string | null;
  decision_date: string | null;
  issuer: string | null;
  lookup_code: string;
  note: string | null;
  editable: boolean;
}

export interface ManualAwardInput {
  year_name: string;
  title_code: string;
  title_name: string;
  title_kind: EmulationTitleKindCode;
  target: EmulationTargetCode;
  staff_id: string | null;
  department_id: string | null;
  decision_number: string | null;
  decision_date: string | null;
  issuer: string | null;
  note: string | null;
}

export interface CampaignReport {
  campaign: EmulationCampaign;
  staff_count: number;
  by_title: Array<{
    title_id: string;
    code: string;
    name: string;
    target_label: string;
    registered: number;
    registration_accepted: number;
    nominated: number;
    passed: number;
    failed: number;
    awarded: number;
  }>;
  appeals: { total: number; pending: number; accepted: number; rejected: number };
}

export interface AwardVerification {
  code: string;
  school_name: string;
  subject_name: string;
  title_name: string;
  kind_label: string;
  target_label: string;
  year_name: string;
  decision_number: string | null;
  decision_date: string | null;
  issuer: string | null;
}

export const readEmulationOverview = (): Promise<EmulationOverview> => requestJson(`${API}/emulation/overview`);

export const listTitles = (includeInactive = false): Promise<EmulationTitle[]> =>
  requestJson(`${API}/emulation/titles${query({ include_inactive: includeInactive })}`);
export const saveTitle = (id: string | null, input: TitleInput): Promise<EmulationTitle> =>
  requestJson(id ? `${API}/emulation/titles/${id}` : `${API}/emulation/titles`, json(id ? 'PUT' : 'POST', input));
export const deleteTitle = (id: string): Promise<void> => requestJson(`${API}/emulation/titles/${id}`, json('DELETE'));
export const loadDefaultTitles = (): Promise<{ created: number; skipped: number }> =>
  requestJson(`${API}/emulation/titles/defaults`, json('POST', {}));

export const listCampaigns = (): Promise<EmulationCampaign[]> => requestJson(`${API}/emulation/campaigns`);
export const saveCampaign = (id: string | null, input: CampaignInput): Promise<EmulationCampaign> =>
  requestJson(id ? `${API}/emulation/campaigns/${id}` : `${API}/emulation/campaigns`, json(id ? 'PUT' : 'POST', input));
export const deleteCampaign = (id: string): Promise<void> =>
  requestJson(`${API}/emulation/campaigns/${id}`, json('DELETE'));
export const campaignAction = (id: string, action: 'launch' | 'publish' | 'close'): Promise<EmulationCampaign> =>
  requestJson(`${API}/emulation/campaigns/${id}/${action}`, json('POST', {}));
export const downloadLaunchDocument = (id: string, format: 'pdf' | 'docx') =>
  download(`${API}/emulation/campaigns/${id}/launch-document${query({ format })}`, `phat-dong.${format}`);

export const listRegistrations = (campaignId: string, view: 'mine' | 'all'): Promise<EmulationRegistration[]> =>
  requestJson(`${API}/emulation/registrations${query({ campaign_id: campaignId, view })}`);
export const register = (input: SubjectInput & { commitment: string | null }): Promise<EmulationRegistration> =>
  requestJson(`${API}/emulation/registrations`, json('POST', input));
export const deleteRegistration = (id: string): Promise<void> =>
  requestJson(`${API}/emulation/registrations/${id}`, json('DELETE'));
export const reviewRegistrations = (
  ids: string[],
  accept: boolean,
  note: string | null,
): Promise<{ updated: number }> =>
  requestJson(`${API}/emulation/registrations/review`, json('POST', { ids, accept, note }));

export const listNominations = (filter: {
  view: 'mine' | 'review';
  campaign_id?: string;
  status?: string;
}): Promise<EmulationNomination[]> => requestJson(`${API}/emulation/nominations${query(filter)}`);
export const createNomination = (input: SubjectInput): Promise<EmulationNominationDetail> =>
  requestJson(`${API}/emulation/nominations`, json('POST', input));
export const readNomination = (id: string): Promise<EmulationNominationDetail> =>
  requestJson(`${API}/emulation/nominations/${id}`);
export const updateNomination = (
  id: string,
  input: { achievements: string | null; initiative: string | null; scores: Record<string, number> },
): Promise<EmulationNominationDetail> => requestJson(`${API}/emulation/nominations/${id}`, json('PUT', input));
export const deleteNomination = (id: string): Promise<void> =>
  requestJson(`${API}/emulation/nominations/${id}`, json('DELETE'));
export const nominationAction = (
  id: string,
  action: 'submit' | 'withdraw' | 'accept' | 'return',
  note?: string,
): Promise<EmulationNominationDetail> =>
  requestJson(`${API}/emulation/nominations/${id}/${action}`, json('POST', note === undefined ? {} : { note }));
export const listEvidenceOptions = (id: string): Promise<EvidenceOption[]> =>
  requestJson(`${API}/emulation/nominations/${id}/evidence-options`);
export const addEvidence = (id: string, documentId: string, note: string | null): Promise<EmulationNominationDetail> =>
  requestJson(`${API}/emulation/nominations/${id}/evidence`, json('POST', { document_id: documentId, note }));
export const removeEvidence = (id: string, evidenceId: string): Promise<EmulationNominationDetail> =>
  requestJson(`${API}/emulation/nominations/${id}/evidence/${evidenceId}`, json('DELETE'));
export const downloadEvidence = (id: string, evidenceId: string) =>
  download(`${API}/emulation/nominations/${id}/evidence/${evidenceId}/file`, 'minh-chung');
export const downloadNominationReport = (id: string, format: 'pdf' | 'docx') =>
  download(`${API}/emulation/nominations/${id}/report${query({ format })}`, `bao-cao-thanh-tich.${format}`);

export const readCouncil = (campaignId: string): Promise<Council> =>
  requestJson(`${API}/emulation/campaigns/${campaignId}/council`);
export const saveCouncil = (
  campaignId: string,
  members: Array<{ user_id: string; position: EmulationPositionCode }>,
): Promise<Council> => requestJson(`${API}/emulation/campaigns/${campaignId}/council`, json('PUT', { members }));
export const openMeeting = (
  campaignId: string,
  input: { held_at: string; location: string | null; content: string | null },
): Promise<MeetingDetail> => requestJson(`${API}/emulation/campaigns/${campaignId}/meetings`, json('POST', input));
export const readMeeting = (id: string): Promise<MeetingDetail> => requestJson(`${API}/emulation/meetings/${id}`);
export const closeMeeting = (
  id: string,
  input: { attendee_count: number | null; conclusion: string | null },
): Promise<MeetingDetail> => requestJson(`${API}/emulation/meetings/${id}/close`, json('POST', input));
export const downloadMinutes = (id: string) =>
  download(`${API}/emulation/meetings/${id}/minutes`, 'bien-ban-hoi-dong.pdf');
export const listVoting = (): Promise<MeetingDetail[]> => requestJson(`${API}/emulation/voting`);
export const castVotes = (
  id: string,
  votes: Array<{ nomination_id: string; choice: EmulationVoteCode }>,
): Promise<MeetingDetail> => requestJson(`${API}/emulation/meetings/${id}/votes`, json('PUT', { votes }));

export const listAppeals = (view: 'mine' | 'all'): Promise<EmulationAppeal[]> =>
  requestJson(`${API}/emulation/appeals${query({ view })}`);
export const submitAppeal = (input: {
  campaign_id: string;
  nomination_id: string | null;
  kind: EmulationAppealKindCode;
  content: string;
}): Promise<EmulationAppeal> => requestJson(`${API}/emulation/appeals`, json('POST', input));
export const resolveAppeal = (id: string, accept: boolean, response: string): Promise<EmulationAppeal> =>
  requestJson(`${API}/emulation/appeals/${id}/resolve`, json('POST', { accept, response }));

export const listDecisions = (): Promise<EmulationDecision[]> => requestJson(`${API}/emulation/decisions`);
export const readDecision = (id: string): Promise<DecisionDetail> => requestJson(`${API}/emulation/decisions/${id}`);
export const saveDecision = (id: string | null, input: DecisionInput): Promise<DecisionDetail> =>
  requestJson(id ? `${API}/emulation/decisions/${id}` : `${API}/emulation/decisions`, json(id ? 'PUT' : 'POST', input));
export const deleteDecision = (id: string): Promise<void> =>
  requestJson(`${API}/emulation/decisions/${id}`, json('DELETE'));
export const createOutgoingDraft = (id: string): Promise<DecisionDetail> =>
  requestJson(`${API}/emulation/decisions/${id}/outgoing`, json('POST', {}));
export const issueDecision = (
  id: string,
  input: { number: string | null; issue_date: string | null },
): Promise<DecisionDetail> => requestJson(`${API}/emulation/decisions/${id}/issue`, json('POST', input));
export const recordUpperResult = (
  id: string,
  input: { number: string; date: string; issuer: string; awarded_ids: string[] },
): Promise<DecisionDetail> => requestJson(`${API}/emulation/decisions/${id}/upper-result`, json('POST', input));
export const downloadDecision = (id: string, format: 'pdf' | 'docx') =>
  download(`${API}/emulation/decisions/${id}/document${query({ format })}`, `quyet-dinh.${format}`);
export const downloadCertificate = (id: string) =>
  download(`${API}/emulation/awards/${id}/certificate`, 'giay-khen.pdf');

export const listHistory = (filter: { q?: string; target?: string; title_code?: string }): Promise<AwardRow[]> =>
  requestJson(`${API}/emulation/history${query(filter)}`);
export const exportHistory = (filter: { q?: string; target?: string; title_code?: string }) =>
  download(`${API}/emulation/history/export${query({ ...filter, format: 'xlsx' })}`, 'so-theo-doi-khen-thuong.xlsx');
export const addManualAward = (input: ManualAwardInput): Promise<AwardRow> =>
  requestJson(`${API}/emulation/history`, json('POST', input));
export const deleteManualAward = (id: string): Promise<void> =>
  requestJson(`${API}/emulation/history/${id}`, json('DELETE'));

export const readCampaignReport = (id: string): Promise<CampaignReport> =>
  requestJson(`${API}/emulation/campaigns/${id}/report`);
export const exportCampaignReport = (id: string) =>
  download(`${API}/emulation/campaigns/${id}/report/export${query({ format: 'xlsx' })}`, 'bao-cao-thi-dua.xlsx');

// Tra cứu giấy khen (trang công khai, không cần đăng nhập)
export async function verifyAward(code: string): Promise<AwardVerification> {
  const response = await fetch(`${API}/public/emulation-awards/verify${query({ code })}`);
  if (!response.ok) {
    throw await readError(response);
  }
  return (await response.json()) as AwardVerification;
}
