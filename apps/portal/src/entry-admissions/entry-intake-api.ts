import type {
  AdmissionDecision,
  AdmissionDocument,
  AdmissionProgramType,
  AdmissionRecordType,
  AdvancedReviewStatus,
  FinalYearFileKind,
  FinalYearResidenceType,
} from '@school-management/shared';
import { downloadExport, saveResponseFile } from '../exports/export-api.js';
import { fetchWithSession, readError, requestJson } from '../session/api-client.js';
import type { ImportRowError } from './entry-admissions-api.js';

// Gọi điểm cuối của 1.3 đến 1.7 phân hệ Tuyển sinh đầu cấp và 5.11 phân hệ Mầm non (DT-17 phần 17d)
export type IntakeScreen = 'intake' | 'advanced' | 'notices' | 'transfer' | 'transferred';

export interface IntakeCampaign {
  id: string;
  name: string;
  status: string;
  org_unit_id: string;
  program_type: AdmissionProgramType;
  target_academic_year_id: string | null;
  open_from: string;
  open_to: string;
}

export interface IntakeOptions {
  academic_years: Array<{ id: string; name: string; status: string }>;
  org_units: Array<{ id: string; name: string; unit_type: string }>;
  classes: Array<{ id: string; name: string; org_unit_id: string }>;
  relationships: Array<{ id: string; name: string }>;
}

export interface IntakeFile {
  id: string;
  kind: FinalYearFileKind;
  file_name: string;
  content_type: string;
  uploaded_by_name: string;
  created_at: string;
}

export interface IntakeRow {
  id: string;
  code: string;
  campaign_id: string;
  campaign_name: string;
  program_type: AdmissionProgramType;
  org_unit_id: string;
  org_unit_name: string;
  source: 'online' | 'staff' | 'routing';
  status: string;
  full_name: string;
  dob: string;
  gender: 'male' | 'female';
  place_of_birth: string | null;
  national_id: string;
  has_national_id: boolean;
  residence_type: FinalYearResidenceType | null;
  current_residence: string | null;
  address: string | null;
  residential_group: string | null;
  quarter: string | null;
  ward: string | null;
  province: string | null;
  guardian_full_name: string;
  guardian_phone: string;
  guardian_email: string | null;
  guardian_relationship_item_id: string | null;
  relationship_name: string | null;
  father_name: string | null;
  mother_name: string | null;
  final_year_ward: string | null;
  final_year_school: string | null;
  routed: boolean;
  submitted_documents: AdmissionDocument[];
  admission_decision: AdmissionDecision;
  advanced_criteria: string | null;
  advanced_achievements: string | null;
  registered_at: string | null;
  school_review: AdvancedReviewStatus;
  school_reviewed_by_name: string | null;
  ward_review: AdvancedReviewStatus;
  child_has_allergies: boolean | null;
  notice_content: string | null;
  last_notice_at: string | null;
  record_type: AdmissionRecordType;
  has_parent_account: boolean;
  target_org_unit_id: string | null;
  target_org_unit_name: string | null;
  planned_class_id: string | null;
  planned_class_name: string | null;
  created_child_id: string | null;
  student_code: string | null;
  child_status: string | null;
  transfer_package_code: string | null;
  transfer_guid: string | null;
  transferred_at: string | null;
  last_transfer_note: string | null;
  last_transfer_succeeded: boolean | null;
  cancelled_at: string | null;
  files: IntakeFile[];
}

export type IntakeFilter = Partial<Record<string, string>>;
export type IntakeInput = Partial<Record<string, string | boolean | null>>;

export interface ActionResult {
  done: number;
  skipped: Array<{ id: string; full_name: string; reason: string }>;
}

export interface TransferResult {
  application_id: string;
  code: string;
  full_name: string;
  national_id: string;
  guid: string | null;
  succeeded: boolean;
  note: string;
}

export interface ResultRow {
  id: string;
  package_code: string;
  guid: string | null;
  succeeded: boolean;
  note: string | null;
  actor_name: string;
  created_at: string;
  application_id: string;
  code: string;
  full_name: string;
  student_code: string;
  national_id: string;
}

export interface NoticeRecipient {
  key: string;
  application_id: string | null;
  contact_id: string | null;
  external: boolean;
  national_id: string;
  full_name: string;
  dob: string | null;
  gender: 'male' | 'female' | null;
  phone: string | null;
  notice_content: string | null;
  final_year_school: string | null;
  moet_code: string | null;
  last_notice_at: string | null;
  has_parent_account: boolean;
}

const BASE = '/api/v1/entry-intake';
const clean = (filter: IntakeFilter) =>
  Object.fromEntries(Object.entries(filter).filter(([, value]) => value !== undefined && value !== '')) as Record<
    string,
    string
  >;

// "Kết quả: đã làm N, bỏ qua M: tên (lý do)" cho thông báo sau thao tác hàng loạt
export function describeResult(result: ActionResult, verb = 'Đã thực hiện cho'): string {
  return (
    `${verb} ${result.done} hồ sơ` +
    (result.skipped.length
      ? `; bỏ qua ${result.skipped.length}: ${result.skipped.map((item) => `${item.full_name} (${item.reason})`).join('; ')}`
      : '')
  );
}

export const listIntakeCampaigns = () => requestJson<{ items: IntakeCampaign[] }>(`${BASE}/campaigns`);
export const readIntakeOptions = () => requestJson<IntakeOptions>(`${BASE}/options`);
export const updateIntakeCampaign = (
  id: string,
  input: { program_type: AdmissionProgramType; target_academic_year_id: string | null },
) => requestJson<{ updated: boolean }>(`${BASE}/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(input) });

export const listIntake = (screen: IntakeScreen, filter: IntakeFilter) =>
  requestJson<{ items: IntakeRow[] }>(
    `${BASE}/applications?${new URLSearchParams({ screen, ...clean(filter) }).toString()}`,
  );
export const updateIntake = (id: string, input: IntakeInput) =>
  requestJson<IntakeRow>(`${BASE}/applications/${id}`, { method: 'PUT', body: JSON.stringify(input) });

const post = <Result>(path: string, body: unknown) =>
  requestJson<Result>(`${BASE}${path}`, { method: 'POST', body: JSON.stringify(body) });

export const saveIntake = (
  items: Array<{ id: string; submitted_documents: AdmissionDocument[]; admission_decision: AdmissionDecision }>,
) => post<ActionResult>('/save', { items });
export const reviewAdvanced = (ids: string[], review: AdvancedReviewStatus) =>
  post<ActionResult>('/review', { ids, review });
export const removeIntake = (ids: string[]) => post<ActionResult>('/remove', { ids });
export const cancelIntake = (ids: string[]) => post<ActionResult>('/cancel', { ids });

export const exportIntake = (screen: IntakeScreen, filter: IntakeFilter) =>
  downloadExport(`${BASE}/export`, { screen, filter: clean(filter) }, `${screen}.xlsx`);
export const downloadIntakeForms = (ids: string[], kind: 'information' | 'registration') =>
  downloadExport(`${BASE}/forms`, { ids, kind }, kind === 'registration' ? 'phieu-dang-ky.pdf' : 'phieu-thong-tin.pdf');
export const downloadEvidence = (ids: string[]) => downloadExport(`${BASE}/evidence`, { ids }, 'minh-chung.zip');

async function downloadGet(path: string, fallback: string) {
  const response = await fetchWithSession(`${BASE}${path}`);
  if (!response.ok) {
    throw await readError(response);
  }
  saveResponseFile(await response.blob(), response.headers.get('content-disposition') ?? '', fallback);
}

export const downloadRoutingTemplate = () => downloadGet('/import-template', 'mau-danh-sach-phan-tuyen.xlsx');
export const downloadNoticeTemplate = (kind: 'content' | 'external') =>
  downloadGet(`/notices/template?kind=${kind}`, 'mau-thong-bao.xlsx');

// Tải tệp Excel lên; errorFile=true lưu tệp kèm cột nội dung lỗi ("Tải danh sách lỗi")
async function importFile<Result>(path: string, fields: Record<string, string>, file: File, errorFile: boolean) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }
  form.set('file', file);
  const response = await fetchWithSession(`${BASE}${path}${errorFile ? '?error_file=true' : ''}`, {
    method: 'POST',
    body: form,
  });
  if (!response.ok) {
    throw await readError(response);
  }
  if (errorFile) {
    saveResponseFile(await response.blob(), response.headers.get('content-disposition') ?? '', 'danh-sach-loi.xlsx');
    return null;
  }
  return (await response.json()) as Result;
}

export const importRouting = (campaignId: string, file: File, errorFile = false) =>
  importFile<{ created: number; errors: ImportRowError[] }>('/import', { campaign_id: campaignId }, file, errorFile);
export const importNotices = (campaignId: string, kind: 'content' | 'external', file: File, errorFile = false) =>
  importFile<{ created?: number; updated?: number; errors: ImportRowError[] }>(
    '/notices/import',
    { campaign_id: campaignId, kind },
    file,
    errorFile,
  );

export async function uploadIntakeFile(applicationId: string, kind: FinalYearFileKind, file: File) {
  const form = new FormData();
  form.set('kind', kind);
  form.set('file', file);
  return requestJson<IntakeFile>(`${BASE}/applications/${applicationId}/files`, { method: 'POST', body: form });
}

export async function openIntakeFile(fileId: string) {
  const response = await fetchWithSession(`${BASE}/files/${fileId}`);
  if (!response.ok) {
    throw await readError(response);
  }
  window.open(URL.createObjectURL(await response.blob()), '_blank', 'noopener');
}

export const removeIntakeFile = (fileId: string) =>
  requestJson<{ removed: boolean }>(`${BASE}/files/${fileId}`, { method: 'DELETE' });

export const listNoticeRecipients = (filter: IntakeFilter) =>
  requestJson<{ items: NoticeRecipient[] }>(
    `${BASE}/notices/recipients?${new URLSearchParams(clean(filter)).toString()}`,
  );
const targetsOf = (rows: NoticeRecipient[]) => ({
  application_ids: rows.map((row) => row.application_id).filter((id): id is string => id !== null),
  contact_ids: rows.map((row) => row.contact_id).filter((id): id is string => id !== null),
});
export const copyNoticeContent = (campaignId: string, content: string, rows: NoticeRecipient[]) =>
  post<{ updated: number }>('/notices/copy', { campaign_id: campaignId, content, ...targetsOf(rows) });
export const sendNotice = (campaignId: string, content: string, rows: NoticeRecipient[]) =>
  post<{ recipients: number; delivered: number; not_delivered: number }>('/notices/send', {
    campaign_id: campaignId,
    content,
    ...targetsOf(rows),
  });

export const updateTransfers = (
  items: Array<{ id: string; target_org_unit_id: string | null; record_type: AdmissionRecordType }>,
) => requestJson<ActionResult>(`${BASE}/transfers`, { method: 'PUT', body: JSON.stringify({ items }) });
export const arrangeClasses = (ids: string[], classId: string | null) =>
  post<ActionResult>('/transfers/arrange', { ids, class_id: classId });
export const runTransfer = (ids: string[], clearClasses: boolean, confirmDuplicates: boolean) =>
  post<{ package_code: string; results: TransferResult[] }>('/transfers/run', {
    ids,
    clear_classes: clearClasses,
    confirm_duplicates: confirmDuplicates,
  });
export const listTransferResults = (kind: 'transfer' | 'cancel', packageCode: string) =>
  requestJson<{ packages: string[]; items: ResultRow[] }>(
    `${BASE}/transfers/results?${new URLSearchParams(clean({ kind, package_code: packageCode })).toString()}`,
  );
export const cancelTransferred = (ids: string[]) =>
  post<{ package_code: string; results: TransferResult[] }>('/transfers/cancel', { ids });
