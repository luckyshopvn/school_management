import type {
  ClassStage,
  SigningCertificateStatus,
  SigningDocument,
  SigningDossierStatus,
  SigningObjectType,
  SigningSignatureType,
  SigningSyncStatus,
} from '@school-management/shared';
import { downloadExport, saveResponseFile } from '../exports/export-api.js';
import { fetchWithSession, readError, requestJson } from '../session/api-client.js';

// Gọi điểm cuối của phân hệ Quản lý kí hồ sơ (DT-16 phần 16k; DT-17 phần 17b thêm xem hồ sơ kí, tệp XML, file lỗi)
export interface SigningEvent {
  id: string;
  action: string;
  note: string | null;
  actor_name: string;
  created_at: string;
}

export interface SigningSchoolInfo {
  code: string | null;
  name: string | null;
  principal_name: string | null;
  email: string | null;
  website: string | null;
}

export interface SigningCertificate {
  school: SigningSchoolInfo;
  provider_in_list: boolean;
  signature_type: SigningSignatureType;
  provider: string | null;
  login_name: string | null;
  holder_name: string | null;
  holder_title: string | null;
  serial_number: string | null;
  valid_from: string | null;
  valid_to: string | null;
  status: SigningCertificateStatus;
  registered_at: string | null;
  registered_by_name: string | null;
  sync_status: SigningSyncStatus;
  synced_on: string | null;
  sync_note: string | null;
  synced_by_name: string | null;
  has_seal: boolean;
  seal_file_name: string | null;
  updated_at: string | null;
  expired: boolean;
  can_manage: boolean;
  digital_signer: boolean;
  signer_description: string;
  events: SigningEvent[];
}

export type CertificateInput = Pick<
  SigningCertificate,
  | 'signature_type'
  | 'provider'
  | 'login_name'
  | 'holder_name'
  | 'holder_title'
  | 'serial_number'
  | 'valid_from'
  | 'valid_to'
>;

export interface SigningDossier {
  id: string;
  code: string;
  object_type: SigningObjectType;
  object_id: string;
  period: string;
  object_label: string;
  status: SigningDossierStatus;
  file_name: string;
  file_sha256: string;
  created_by_name: string;
  created_at: string;
  signature_method: string | null;
  signed_file_name: string | null;
  signed_sha256: string | null;
  signed_at: string | null;
  signed_by_name: string | null;
  changed_at: string | null;
  change_summary: string | null;
  checked_at: string | null;
  completed_at: string | null;
  completed_by_name: string | null;
  sent_on: string | null;
  sent_note: string | null;
  sent_by_name: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  updated_at: string;
  xml_file_name: string | null;
  xml_sha256: string | null;
  note: string | null;
}

export interface SigningObject {
  object_id: string;
  object_label: string;
  detail: string | null;
  code: string | null;
  principal_name: string | null;
  stage: ClassStage | null;
  dob: string | null;
  person_status: string | null;
  job_position: string | null;
  class_id: string | null;
  class_name: string | null;
  create_error: string | null;
  dossier: SigningDossier | null;
}

export interface SigningDossierView {
  dossier: SigningDossier;
  root: string;
  document: SigningDocument;
  signature: null | {
    signed_by_name: string | null;
    signed_at: string;
    method: string | null;
    digital: boolean;
    description: string;
    signature_type: SigningSignatureType | null;
    provider: string | null;
    holder_name: string | null;
    serial_number: string | null;
    original_sha256: string;
    signed_sha256: string | null;
  };
  xml_schema: string | null;
}

export const readCertificate = (): Promise<SigningCertificate> => requestJson('/api/v1/signing/certificate');

export const saveCertificate = (input: CertificateInput): Promise<SigningCertificate> =>
  requestJson('/api/v1/signing/certificate', { method: 'PUT', body: JSON.stringify(input) });

export const certificateAction = (
  action: 'register' | 'revoke' | 'unsync',
  reason?: string,
): Promise<SigningCertificate> =>
  requestJson(`/api/v1/signing/certificate/${action}`, {
    method: 'POST',
    ...(reason ? { body: JSON.stringify({ reason }) } : {}),
  });

export const markCertificateSynced = (syncedOn: string, note: string | null): Promise<SigningCertificate> =>
  requestJson('/api/v1/signing/certificate/sync', {
    method: 'POST',
    body: JSON.stringify({ synced_on: syncedOn, note }),
  });

export function uploadSeal(file: File): Promise<SigningCertificate> {
  const form = new FormData();
  form.set('file', file, file.name);
  return requestJson('/api/v1/signing/certificate/seal', { method: 'POST', body: form });
}

export const deleteSeal = (): Promise<SigningCertificate> =>
  requestJson('/api/v1/signing/certificate/seal', { method: 'DELETE' });

// Ảnh con dấu tải bằng mã phiên nên dựng địa chỉ blob để hiện
export async function readSealUrl(): Promise<string> {
  const response = await fetchWithSession('/api/v1/signing/certificate/seal');
  if (!response.ok) {
    throw await readError(response);
  }
  return URL.createObjectURL(await response.blob());
}

export async function listSigningObjects(type: SigningObjectType, period: string): Promise<SigningObject[]> {
  const query = new URLSearchParams({ object_type: type, ...(type === 'class_log' ? { period } : {}) });
  return (await requestJson<{ items: SigningObject[] }>(`/api/v1/signing/objects?${query.toString()}`)).items;
}

export const createDossiers = (
  type: SigningObjectType,
  objectIds: string[],
  period: string,
  note: string | null,
): Promise<{
  created: number;
  codes: string[];
  errors: Array<{ object_id: string; object_label: string; reason: string }>;
}> =>
  requestJson('/api/v1/signing/dossiers', {
    method: 'POST',
    body: JSON.stringify({
      object_type: type,
      object_ids: objectIds,
      ...(type === 'class_log' ? { period } : {}),
      ...(note ? { note } : {}),
    }),
  });

export const signDossiers = (ids: string[]): Promise<{ signed: number }> =>
  requestJson('/api/v1/signing/dossiers/sign', { method: 'POST', body: JSON.stringify({ ids }) });

export const checkDossierChanges = (
  ids: string[],
): Promise<{ items: Array<{ id: string; code: string; changed: boolean; change_summary: string | null }> }> =>
  requestJson('/api/v1/signing/dossiers/check-changes', { method: 'POST', body: JSON.stringify({ ids }) });

export const cancelDossier = (id: string, reason: string): Promise<SigningDossier> =>
  requestJson(`/api/v1/signing/dossiers/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) });

export const completeDossiers = (ids: string[]): Promise<{ completed: number }> =>
  requestJson('/api/v1/signing/dossiers/complete', { method: 'POST', body: JSON.stringify({ ids }) });

export const uncompleteDossier = (id: string): Promise<SigningDossier> =>
  requestJson(`/api/v1/signing/dossiers/${id}/uncomplete`, { method: 'POST', body: JSON.stringify({}) });

export const markDossiersSent = (ids: string[], sentOn: string, note: string | null): Promise<{ sent: number }> =>
  requestJson('/api/v1/signing/dossiers/mark-sent', {
    method: 'POST',
    body: JSON.stringify({ ids, sent_on: sentOn, note }),
  });

export function listSigningSubmissions(filter: {
  objectType: SigningObjectType | '';
  status: SigningDossierStatus | '';
}): Promise<{ items: SigningDossier[]; school: SigningSchoolInfo }> {
  const query = new URLSearchParams();
  if (filter.objectType) {
    query.set('object_type', filter.objectType);
  }
  if (filter.status) {
    query.set('status', filter.status);
  }
  return requestJson(`/api/v1/signing/submissions${query.size ? `?${query.toString()}` : ''}`);
}

export const readDossierView = (id: string): Promise<SigningDossierView> =>
  requestJson(`/api/v1/signing/dossiers/${id}/view`);

export async function downloadDossierFile(
  dossier: SigningDossier,
  version: 'original' | 'signed' | 'xml',
): Promise<void> {
  const response = await fetchWithSession(`/api/v1/signing/dossiers/${dossier.id}/file?version=${version}`);
  if (!response.ok) {
    throw await readError(response);
  }
  saveResponseFile(
    await response.blob(),
    response.headers.get('content-disposition') ?? '',
    version === 'signed'
      ? (dossier.signed_file_name ?? dossier.file_name)
      : version === 'xml'
        ? (dossier.xml_file_name ?? `${dossier.code}.xml`)
        : dossier.file_name,
  );
}

// In hồ sơ: mở tệp PDF (bản đã kí nếu có) ở thẻ mới của trình duyệt để in
export async function openDossierFile(dossier: SigningDossier): Promise<void> {
  const version = dossier.signed_file_name ? 'signed' : 'original';
  const response = await fetchWithSession(`/api/v1/signing/dossiers/${dossier.id}/file?version=${version}`);
  if (!response.ok) {
    throw await readError(response);
  }
  const url = URL.createObjectURL(await response.blob());
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const exportClassLog = (classId: string, month: string) =>
  downloadExport('/api/v1/signing/class-log/export', { class_id: classId, month }, `so-dau-bai-${month}.xlsx`);

// Tải file lỗi: đối tượng tạo hồ sơ không được của loại đang xem
export async function downloadCreateErrors(type: SigningObjectType): Promise<void> {
  const response = await fetchWithSession(`/api/v1/signing/create-errors/file?object_type=${type}`);
  if (!response.ok) {
    throw await readError(response);
  }
  saveResponseFile(
    await response.blob(),
    response.headers.get('content-disposition') ?? '',
    `loi-tao-ho-so-${type}.xlsx`,
  );
}
